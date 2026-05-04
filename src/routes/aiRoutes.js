const express = require('express');
const aiService = require('../services/aiService');
const authMiddleware = require('../config/authMiddleware');
const ReminderModel = require('../models/reminderModel');
const MessageModel = require('../models/messageModel');
const whatsappService = require('../services/whatsappService');
const chalk = require('chalk');
const router = express.Router();

// Rota para buscar histórico de mensagens
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const history = MessageModel.getHistory(req.user.id);
        // Formata para o frontend (role e text)
        const formatted = history.map(m => ({
            role: m.role === 'model' ? 'laura' : 'user',
            text: m.parts[0].text
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para limpar histórico
router.delete('/history', authMiddleware, async (req, res) => {
    try {
        MessageModel.clearHistory(req.user.id);
        res.json({ message: 'Histórico limpo' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota de teste para simular conversa com a Laura via Painel Web
router.post('/test-chat', authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;
        const userFromDb = UserModel.findById(userId);
        const userTelefone = userFromDb ? userFromDb.telefone : null;
        const userName = req.user.nome;

        // 1. Pega histórico do banco
        const history = MessageModel.getHistory(userId);

        // 2. Chama a IA com histórico
        const aiResult = await aiService.interpret(message, userName, history);
        
        // 3. Salva a mensagem do usuário
        if (message) {
            MessageModel.create(userId, 'user', message);
        }
        
        // 4. Executa ações no banco (CREATE/DELETE)
        let successExtra = '';
        if (aiResult.intent === 'CREATE' && aiResult.data && aiResult.data.titulo && aiResult.data.data_hora) {
            try {
                ReminderModel.create(userId, aiResult.data.titulo, aiResult.data.data_hora);
                console.log(chalk.green(`[TESTE] Lembrete criado: ${aiResult.data.titulo}`));
                // Mensagem de sucesso garantida se a IA não gerou uma boa
                if (!aiResult.message || aiResult.message.includes('{')) {
                    aiResult.message = `Combinado, ${userName}! Já anotei aqui: "${aiResult.data.titulo}" para o dia ${new Date(aiResult.data.data_hora).toLocaleString('pt-BR')}. 😉`;
                }
            } catch (dbError) {
                console.error(chalk.red('[ERRO DB]'), dbError.message);
                aiResult.message = "Poxa, tive um problema ao salvar seu lembrete no banco de dados.";
            }
        }

        // 5. Salva a resposta da Laura na memória
        if (aiResult.message) {
            MessageModel.create(userId, 'model', aiResult.message);
        }

        // 6. Envia cópia para o WhatsApp (Pedido do Usuário: Poupar API mas enviar cópia)
        if (userTelefone && aiResult.message) {
            console.log(chalk.cyan(`[WHATSAPP] Enviando cópia da resposta para ${userTelefone}...`));
            whatsappService.sendMessage(userTelefone, aiResult.message);
        }

        res.json(aiResult);
    } catch (error) {
        console.error(chalk.red('[ERRO ROTA AI]'), error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
