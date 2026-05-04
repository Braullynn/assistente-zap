const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const UserModel = require('../models/userModel');
const ReminderModel = require('../models/reminderModel');
const MessageModel = require('../models/messageModel');
const aiService = require('./aiService');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './data/session' }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        handleSIGINT: false
    }
});

const lastMessageTime = new Map();
const COOLDOWN_MS = 3000;
const sentByBot = new Set(); // Movido para escopo global para acesso pelo sendMessage

const whatsappService = {
    init: () => {
        client.on('qr', (qr) => {
            console.log(chalk.yellow('\n[SISTEMA] Novo QR Code gerado. Escaneie para conectar:'));
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', () => {
            console.log(chalk.green('✅ [LAURA] Conectada e pronta para ajudar!'));
        });

        client.on('message_create', async (msg) => {
            try {
                // Previne que o bot responda as mensagens que ele mesmo gerou e enviou
                if (msg.fromMe && sentByBot.has(msg.body)) {
                    // Limpa do cache após ser processada para evitar vazamento de memória com o tempo
                    sentByBot.delete(msg.body);
                    return;
                }

                // Determina quem é o remetente real e o contexto da conversa
                let from = '';
                
                if (msg.fromMe) {
                    // Foi enviado pelo próprio celular do usuário (Host)
                    const hostPhone = client.info.wid.user;
                    
                    // No WhatsApp Multi-Device, ao mandar mensagem para o chat "Você",
                    // o destino frequentemente vem com o sufixo @lid em vez de @c.us
                    const isSelfChat = msg.to === msg.from || msg.to === client.info.wid._serialized || msg.to.endsWith('@lid');
                    
                    // Se o usuário mandou a mensagem para um amigo/grupo, ignoramos para a Laura não se intrometer.
                    if (!isSelfChat) {
                        return; 
                    }
                    from = hostPhone;
                } else {
                    // Foi enviado por terceiros
                    from = (msg.author || msg.from).replace('@c.us', '').replace('@g.us', '');
                }
                
                // 1. Verificar se o remetente tem cadastro
                const user = UserModel.findByTelefone(from);
                if (!user) return;

                // 2. Anti-Spam
                const now = Date.now();
                if (lastMessageTime.has(from) && (now - lastMessageTime.get(from) < COOLDOWN_MS)) return;
                lastMessageTime.set(from, now);

                // --- 2.5 FILTRO DE MENÇÃO (@Laura) ---
                const mentionRegex = /^@laura\s*/i;
                if (!mentionRegex.test(msg.body)) {
                    return; // Ignora silenciosamente mensagens que não começam com @Laura
                }
                const cleanMessage = msg.body.replace(mentionRegex, '').trim();
                if (!cleanMessage) return; // Ignora se enviou apenas "@Laura" sem nada

                const remetenteLog = msg.fromMe ? `[VOCÊ/HOST -> ${user.nome}]` : `[WHATSAPP - ${user.nome}]`;
                console.log(chalk.blue(`${remetenteLog}: `) + cleanMessage);

                const chat = await msg.getChat();
                await chat.sendStateTyping();

                // 3. Memória (Histórico)
                const history = MessageModel.getHistory(user.id);
                
                // 4. IA
                const aiResult = await aiService.interpret(cleanMessage, user.nome, history);
                
                // 5. Salvar na Memória a mensagem do usuário (evita duplicar se for host, mas é útil)
                // Se a mensagem original foi do host, ainda salvamos como 'user' no contexto da IA
                MessageModel.create(user.id, 'user', cleanMessage);

                // 6. Ações no Banco
                if (aiResult.intent === 'CREATE' && aiResult.data && aiResult.data.titulo && aiResult.data.data_hora) {
                    try {
                        ReminderModel.create(user.id, aiResult.data.titulo, aiResult.data.data_hora);
                        console.log(chalk.green(`[BANCO] Lembrete criado: ${aiResult.data.titulo}`));
                        
                        // Garante mensagem de sucesso se a IA foi econômica
                        if (!aiResult.message || aiResult.message.includes('{')) {
                            aiResult.message = `Tudo certo, ${user.nome}! Lembrete "${aiResult.data.titulo}" agendado para ${new Date(aiResult.data.data_hora).toLocaleString('pt-BR')}. 👍`;
                        }
                    } catch (dbError) {
                        console.error(chalk.red('[ERRO DB]'), dbError.message);
                        aiResult.message = "Houve um erro ao salvar seu lembrete. Pode tentar novamente?";
                    }
                } else if (aiResult.intent === 'DELETE' && aiResult.data && aiResult.data.titulo) {
                    ReminderModel.deleteByTitle(user.id, aiResult.data.titulo);
                }

                // 7. Salvar Resposta da IA na Memória (após possíveis ajustes de sucesso)
                MessageModel.create(user.id, 'model', aiResult.message);

                // Adiciona a resposta no cache antes de enviar para não disparar no message_create novamente
                sentByBot.add(aiResult.message);

                // 8. Responder
                const aiSource = aiResult.source || 'IA';
                console.log(chalk.magenta(`[LAURA (${aiSource})]: `) + aiResult.message);
                await msg.reply(aiResult.message);

                // Timeout de segurança para limpar o cache caso a mensagem demore ou falhe no socket
                setTimeout(() => sentByBot.delete(aiResult.message), 10000);

            } catch (error) {
                console.error(chalk.red('[ERRO WHATSAPP]'), error.message);
            }
        });

        client.initialize();
    },

    sendMessage: async (to, message) => {
        try {
            if (!client.info || !client.info.wid) {
                console.error(chalk.red('[ERRO] WhatsApp não está pronto para enviar mensagens.'));
                return false;
            }

            let chatId = '';
            // Se o destino é o próprio celular (Host), precisamos usar o WID oficial
            // para que a mensagem caia no chat "Você" corretamente, especialmente em Multi-Device
            if (to.replace('@c.us', '') === client.info.wid.user) {
                chatId = client.info.wid._serialized;
            } else {
                // Tenta resolver o ID real (evita erro No LID) para outros contatos
                chatId = to.includes('@c.us') ? to : `${to}@c.us`;
                try {
                    const id = await client.getNumberId(to.replace('@c.us', ''));
                    if (id) chatId = id._serialized;
                } catch (e) {
                    console.log(chalk.gray(`[AVISO] Não foi possível validar o número ${to}, tentando envio direto...`));
                }
            }

            // Adiciona a mensagem ao cache ANTES de enviar para prevenir que o bot 
            // intercepte sua própria mensagem e crie um loop (como estava acontecendo com os lembretes)
            sentByBot.add(message);
            setTimeout(() => sentByBot.delete(message), 10000);

            await client.sendMessage(chatId, message);

            // Força a marcação de "Não Lido" (Unread) se a mensagem for para o próprio host.
            // O WhatsApp suprime notificações sonoras de mensagens enviadas por você mesmo, 
            // mas marcar como não lida garante que a bolinha verde apareça na conversa.
            if (to.replace('@c.us', '') === client.info.wid.user) {
                try {
                    const chat = await client.getChatById(chatId);
                    await chat.markUnread();
                } catch (e) {
                    console.log(chalk.gray('[AVISO] Não foi possível forçar status de não lido.'));
                }
            }

            return true;
        } catch (error) {
            console.error(chalk.red(`[ERRO ENVIO] Falha ao enviar para ${to}:`), error.message);
            return false;
        }
    }
};

module.exports = whatsappService;
