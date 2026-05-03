const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const chalk = require('chalk');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const aiService = {
    interpret: async (text, userName, history = []) => {
        // Garantia de Protocolo: O histórico DEVE começar com uma mensagem do usuário
        while (history.length > 0 && history[0].role !== 'user') {
            history.shift();
        }

        // Sincronização de Horário (Padrão Brasil)
        const now = new Date();
        const localTime = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const systemInstruction = `Você é a Laura, uma assistente virtual focada em agendamentos.
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
        5. ao iniciar uma conversa, apresente sempre seu nome e sua função.

        IMPORTANTE: A data/hora local agora é ${localTime}. Use isso como referência.`;

        try {
            console.log(chalk.magenta(`[GEMINI] Interpretando mensagem de ${userName}...`));
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: systemInstruction
            });

            const chat = model.startChat({
                history: history,
                generationConfig: { maxOutputTokens: 500 }
            });

            const result = await chat.sendMessage(text);
            const response = await result.response;
            const processed = aiService.processOutput(response.text());
            return { ...processed, source: 'GEMINI' };

        } catch (error) {
            // Tratamento limpo para erro de quota
            if (error.message?.includes('429') || error.message?.includes('quota')) {
                console.log(chalk.yellow(`[AVISO] Limite de quota do Gemini excedido.`));
            } else {
                console.error(chalk.red('[ERRO GEMINI]'), error.message);
            }

            // TENTA NVIDIA (2ª Opção)
            if (process.env.NVIDIA_API_KEY) {
                return await aiService.interpretWithNvidia(text, userName, history, systemInstruction);
            }

            // TENTA OPENROUTER (3ª Opção - Backup Final)
            if (process.env.OPENROUTER_API_KEY) {
                return await aiService.interpretWithOpenRouter(text, userName, history, systemInstruction);
            }

            return {
                intent: "UNKNOWN",
                message: "Poxa, meus cérebros estão cansados agora. Pode tentar de novo em um minutinho?",
                source: 'ERRO'
            };
        }
    },

    interpretWithNvidia: async (text, userName, history, systemInstruction) => {
        try {
            console.log(chalk.green(`[NVIDIA] Interpretando mensagem de ${userName}...`));

            const messages = [
                { role: "system", content: systemInstruction },
                ...history.map(h => ({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: typeof h.parts[0].text === 'string' ? h.parts[0].text : JSON.stringify(h.parts[0].text)
                })),
                { role: "user", content: text }
            ];

            const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
                model: "meta/llama-3.1-70b-instruct", 
                messages: messages,
                temperature: 0.5,
                top_p: 1,
                max_tokens: 1024,
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const outputText = response.data.choices[0].message.content;
            const processed = aiService.processOutput(outputText);
            return { ...processed, source: 'NVIDIA' };

        } catch (error) {
            console.error(chalk.red('[ERRO NVIDIA]'), error.response?.data?.message || error.message);
            
            // Se a NVIDIA falhar, ainda tentamos o OpenRouter como última esperança
            if (process.env.OPENROUTER_API_KEY) {
                return await aiService.interpretWithOpenRouter(text, userName, history, systemInstruction);
            }

            return {
                intent: "UNKNOWN",
                message: "Meus sistemas estão um pouco instáveis. Tente novamente em instantes.",
                source: 'ERRO'
            };
        }
    },

    interpretWithOpenRouter: async (text, userName, history, systemInstruction) => {
        try {
            console.log(chalk.cyan(`[OPENROUTER] Interpretando mensagem de ${userName}...`));

            // Reforço para modelos mais simples do OpenRouter entenderem que DEVEM responder em JSON
            const instructionWithFormat = `${systemInstruction}\n\nIMPORTANTE: Responda APENAS com o objeto JSON solicitado, sem textos explicativos antes ou depois.`;

            const messages = [
                { role: "system", content: instructionWithFormat },
                ...history.map(h => ({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: typeof h.parts[0].text === 'string' ? h.parts[0].text : JSON.stringify(h.parts[0].text)
                })),
                { role: "user", content: text }
            ];

            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: "nvidia/nemotron-3-nano-30b-a3b:free",
                messages: messages,
                response_format: { type: "json_object" }
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/Braullynn/assistente-zap',
                    'Content-Type': 'application/json'
                }
            });

            const outputText = response.data.choices[0].message.content;
            const processed = aiService.processOutput(outputText);
            return { ...processed, source: 'OPENROUTER' };

        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            console.error(chalk.red('[ERRO OPENROUTER]'), errorMsg);

            return {
                intent: "UNKNOWN",
                message: "Poxa, meus cérebros estão cansados agora. Pode tentar de novo em um minutinho?",
                source: 'ERRO'
            };
        }
    },

    processOutput: (outputText) => {
        try {
            // 1. Limpeza bruta: Remove blocos de código markdown
            let cleanedText = outputText.replace(/```json/g, '').replace(/```/g, '').trim();

            // 2. Tentar encontrar e parsear o JSON
            const jsonMatch = cleanedText.match(/\{.*\}/s);
            if (jsonMatch) {
                const resultObj = JSON.parse(jsonMatch[0]);
                return {
                    intent: resultObj.intent || "UNKNOWN",
                    data: resultObj.data || null,
                    message: resultObj.message || "Entendido! Como posso ajudar?"
                };
            }

            // 3. Fallback: Se o modelo ignorou o JSON e mandou só texto
            if (cleanedText.length > 0) {
                return {
                    intent: "UNKNOWN",
                    data: null,
                    message: cleanedText
                };
            }
        } catch (e) {
            console.log(chalk.yellow('[AVISO] Falha no processOutput, usando fallback.'));
        }

        return {
            intent: "UNKNOWN",
            message: "Olá! Como posso te ajudar hoje?"
        };
    }
};

module.exports = aiService;
