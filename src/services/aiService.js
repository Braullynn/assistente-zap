const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const chalk = require('chalk');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const aiService = {
    interpret: async (text, userName, history = [], activeReminders = []) => {
        // Garantia de Protocolo: O histórico DEVE começar com uma mensagem do usuário
        while (history.length > 0 && history[0].role !== 'user') {
            history.shift();
        }

        // Sincronização de Horário (Padrão Brasil)
        const now = new Date();
        const brParts = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }).formatToParts(now);
        const part = (type) => brParts.find(p => p.type === type).value;
        const localTime = `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}:${part('second')}`;

        // Montagem do Contexto Real da Agenda
        let agendaContext = "O usuário não possui lembretes ativos no banco de dados no momento.";
        if (activeReminders && activeReminders.length > 0) {
            agendaContext = "AGENDA ATUAL DO USUÁRIO (Use apenas isso para responder perguntas sobre o que ele tem agendado):\n" + 
                            activeReminders.map(r => `- ${r.titulo} para ${new Date(r.data_hora).toLocaleString('pt-BR')}`).join('\n');
        }

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
        5. Ao iniciar uma conversa, apresente sempre seu nome e sua função.
        6. REGRA DE OURO: Responda SEMPRE com base APENAS na ÚLTIMA mensagem do usuário. 
        O histórico serve apenas como contexto para a conversa. JAMAIS repita ou recrie 
        agendamentos antigos contidos no histórico sem ordem atual do usuario.
        7. QUANDO O USUÁRIO PERGUNTAR PELA SUA AGENDA/LEMBRETES: Leia o bloco "AGENDA ATUAL DO USUÁRIO" abaixo e responda baseando-se EXCLUSIVAMENTE nele.

        ${agendaContext}

        IMPORTANTE SOBRE CÁLCULO DE TEMPO:
        - A data/hora local ATUAL é RIGOROSAMENTE: ${localTime} (Fuso de Brasília).
        - ATENÇÃO MÁXIMA: Ignore completamente quaisquer horários mencionados nas mensagens anteriores do histórico! Eles são antigos.
        - Se o usuário disser "em X minutos", some os minutos EXATAMENTE ao horário ATUAL (${localTime}).
        - Retorne o campo "data_hora" SEMPRE no formato "YYYY-MM-DDTHH:mm:ss" (sem o Z no final).
        - Use sempre o horário de Brasília como referência absoluta.`;

        // 1. TENTA GROQ PRIMEIRO (Atualmente a mais rápida)
        if (process.env.GROQ_API_KEY) {
            const result = await aiService.interpretWithGroq(text, userName, history, systemInstruction);
            if (result.source !== 'ERRO') return result;
        }

        // 2. TENTA NVIDIA EM SEGUNDO
        if (process.env.NVIDIA_API_KEY) {
            const result = await aiService.interpretWithNvidia(text, userName, history, systemInstruction);
            if (result.source !== 'ERRO') return result;
        }

        // 2. TENTA OPENROUTER EM SEGUNDO
        if (process.env.OPENROUTER_API_KEY) {
            const result = await aiService.interpretWithOpenRouter(text, userName, history, systemInstruction);
            if (result.source !== 'ERRO') return result;
        }

        // 3. TENTA GEMINI POR ÚLTIMO
        if (process.env.GEMINI_API_KEY) {
            const result = await aiService.interpretWithGemini(text, userName, history, systemInstruction);
            if (result.source !== 'ERRO') return result;
        }

        return {
            intent: "UNKNOWN",
            message: "Poxa, meus cérebros estão cansados agora. Pode tentar de novo em um minutinho?",
            source: 'ERRO'
        };
    },

    interpretWithGemini: async (text, userName, history, systemInstruction) => {
        try {
            console.log(chalk.magenta(`[GEMINI] Interpretando mensagem de ${userName}...`));
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                systemInstruction: systemInstruction
            });

            const chat = model.startChat({
                history: history,
                generationConfig: { maxOutputTokens: 500 }
            });

            // Promise de timeout (60 segundos)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 60000);
            });

            // Corre a requisição do Gemini contra o timeout
            const result = await Promise.race([
                chat.sendMessage(text),
                timeoutPromise
            ]);
            const response = await result.response;
            const processed = aiService.processOutput(response.text());
            return { ...processed, source: 'GEMINI' };

        } catch (error) {
            // Tratamento limpo para erro de quota ou timeout
            if (error.message?.includes('TIMEOUT_EXCEEDED')) {
                console.log(chalk.yellow(`[AVISO] Timeout de 60s excedido no Gemini. Passando para próxima IA...`));
            } else if (error.message?.includes('429') || error.message?.includes('quota')) {
                console.log(chalk.yellow(`[AVISO] Limite de quota do Gemini excedido. Passando para próxima IA...`));
            } else {
                console.error(chalk.red('[ERRO GEMINI]'), error.message);
            }
            return { source: 'ERRO' };
        }
    },

    interpretWithGroq: async (text, userName, history, systemInstruction) => {
        try {
            console.log(chalk.yellow(`[GROQ] Interpretando mensagem de ${userName}...`));

            const instructionWithFormat = `${systemInstruction}\n\nIMPORTANTE: Responda APENAS com o objeto JSON solicitado, sem textos explicativos antes ou depois.`;

            const messages = [
                { role: "system", content: instructionWithFormat },
                ...history.map(h => ({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: typeof h.parts[0].text === 'string' ? h.parts[0].text : JSON.stringify(h.parts[0].text)
                })),
                { role: "user", content: text }
            ];

            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile",
                messages: messages,
                temperature: 0.5,
                max_tokens: 1024,
                response_format: { type: "json_object" }
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30s é mais que suficiente para Groq
            });

            const outputText = response.data.choices[0].message.content;
            const processed = aiService.processOutput(outputText);
            return { ...processed, source: 'GROQ' };

        } catch (error) {
            console.error(chalk.red('[ERRO GROQ]'), error.response?.data?.error?.message || error.message);
            return { source: 'ERRO' };
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
                },
                timeout: 60000
            });

            const outputText = response.data.choices[0].message.content;
            const processed = aiService.processOutput(outputText);
            return { ...processed, source: 'NVIDIA' };

        } catch (error) {
            console.error(chalk.red('[ERRO NVIDIA]'), error.response?.data?.message || error.message);
            return { source: 'ERRO' };
        }
    },

    interpretWithOpenRouter: async (text, userName, history, systemInstruction) => {
        try {
            console.log(chalk.cyan(`[OPENROUTER] Interpretando mensagem de ${userName}...`));

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
                },
                timeout: 60000
            });

            const outputText = response.data.choices[0].message.content;
            const processed = aiService.processOutput(outputText);
            return { ...processed, source: 'OPENROUTER' };

        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            console.error(chalk.red('[ERRO OPENROUTER]'), errorMsg);
            return { source: 'ERRO' };
        }
    },

    processOutput: (outputText) => {
        try {
            let cleanedText = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonMatch = cleanedText.match(/\{.*\}/s);
            if (jsonMatch) {
                const resultObj = JSON.parse(jsonMatch[0]);
                return {
                    intent: resultObj.intent || "UNKNOWN",
                    data: resultObj.data || null,
                    message: resultObj.message || "Entendido! Como posso ajudar?"
                };
            }
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
