const { GoogleGenerativeAI } = require("@google/generative-ai");
const chalk = require('chalk');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const aiService = {
    interpret: async (text, userName, history = []) => {
        console.log(chalk.magenta(`[GEMINI] Interpretando mensagem de ${userName}...`));
        
        // Sincronização de Horário (Padrão Brasil)
        const now = new Date();
        const localTime = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        try {
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                systemInstruction: `Você é a Laura, uma assistente virtual focada em agendamentos.
                Seu objetivo é interpretar mensagens do usuário e retornar SEMPRE um objeto JSON.
                
                Estrutura do JSON:
                {
                  "intent": "CREATE" | "LIST" | "DELETE" | "UPDATE" | "UNKNOWN",
                  "data": { "titulo": "...", "data_hora": "ISO string" },
                  "message": "Sua resposta amigável para o usuário aqui"
                }

                Instruções:
                1. Mantenha um tom prestativo, educado e bacana. Use emojis ocasionalmente.
                2. No campo "message", confirme o que você entendeu e o que vai fazer. Ex: "Claro! Vou te lembrar de comprar pão amanhã às 08:00".
                3. CREATE: Extraia obrigatoriamente um "titulo" descritivo e uma "data_hora" válida.
                4. Se faltar informações, use a intenção UNKNOWN e pergunte educadamente no campo "message".
                
                IMPORTANTE: A data/hora local agora é ${localTime}. Use isso como referência.`
            });

            // Inicia chat com histórico
            const chat = model.startChat({
                history: history,
                generationConfig: { maxOutputTokens: 500 }
            });

            const result = await chat.sendMessage(text);
            const response = await result.response;
            const outputText = response.text();

            // 1. Limpeza bruta: Remove blocos de código markdown se existirem
            let cleanedText = outputText.replace(/```json/g, '').replace(/```/g, '').trim();

            // 2. Tentar encontrar e parsear o JSON
            const jsonMatch = cleanedText.match(/\{.*\}/s);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.log(chalk.yellow('[AVISO] Falha ao parsear JSON, tentando limpar mais...'));
                }
            }
            
            // 3. Fallback inteligente: Se não for um JSON válido, limpa o texto para não mostrar lixo
            const messageMatch = cleanedText.match(/"message":\s*"(.*?)"/);
            let finalMessage = "Olá! Como posso te ajudar hoje?";
            
            if (messageMatch && messageMatch[1]) {
                finalMessage = messageMatch[1];
            } else if (cleanedText && !cleanedText.startsWith('{')) {
                finalMessage = cleanedText;
            }

            // Retorno Garantido
            const resultObj = jsonMatch ? JSON.parse(jsonMatch[0]) : { intent: "UNKNOWN" };
            return {
                intent: resultObj.intent || "UNKNOWN",
                data: resultObj.data || null,
                message: resultObj.message || finalMessage
            };
        } catch (error) {
            console.error(chalk.red('[ERRO IA]'), error.message);
            return { 
                intent: "UNKNOWN", 
                message: "Tive um pequeno soluço aqui no meu cérebro eletrônico... Pode repetir?" 
            };
        }
    }
};

module.exports = aiService;
