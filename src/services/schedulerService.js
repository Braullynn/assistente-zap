const cron = require('node-cron');
const chalk = require('chalk');
const ReminderModel = require('../models/reminderModel');
const whatsappService = require('./whatsappService');

const inMemoryTimers = new Set();

const schedulerService = {
    addTimer: (reminder, ms) => {
        inMemoryTimers.add(reminder.id);
        setTimeout(async () => {
            if (!inMemoryTimers.has(reminder.id)) return;
            inMemoryTimers.delete(reminder.id);
            
            const message = `⏰ *LEMBRETE DA LAURA* ⏰\n\nOlá ${reminder.nome}, você me pediu para te lembrar disso agora:\n👉 *${reminder.titulo}*`;
            try {
                await ReminderModel.deleteById(reminder.id);
                const success = await whatsappService.sendMessage(reminder.telefone, message);
                if (success) {
                    console.log(chalk.green(`✅ [TIMER] Lembrete #${reminder.id} enviado e removido.`));
                }
            } catch (err) {
                console.error(`Falha no timer do lembrete #${reminder.id}:`, err.message);
            }
        }, ms);
    },

    init: () => {
        console.log(chalk.cyan('⏰ [SCHEDULER] Motor de lembretes ativo (checagem 1x/min)'));
        
        // Executa a cada minuto
        cron.schedule('* * * * *', async () => {
            try {
                const pending = await ReminderModel.getPendingReminders();
                
                if (pending.length > 0) {
                    let enviouAlgo = false;
                    
                    for (const reminder of pending) {
                        // Ignora se tem um timer em memória de alta precisão cuidando desse lembrete
                        if (inMemoryTimers.has(reminder.id)) {
                            continue;
                        }
                        
                        enviouAlgo = true;
                        const message = `⏰ *LEMBRETE DA LAURA* ⏰\n\nOlá ${reminder.nome}, você me pediu para te lembrar disso agora:\n👉 *${reminder.titulo}*`;
                        
                        try {
                            const success = await whatsappService.sendMessage(reminder.telefone, message);
                            
                            if (success) {
                                await ReminderModel.deleteById(reminder.id);
                                console.log(chalk.green(`✅ [SCHEDULER FALLBACK] Lembrete #${reminder.id} enviado e removido.`));
                            } else {
                                console.log(chalk.red(`❌ [SCHEDULER] Falha ao enviar lembrete #${reminder.id}. Mantendo no banco para nova tentativa.`));
                            }
                            
                        } catch (err) {
                            console.error(`Falha ao disparar lembrete #${reminder.id}:`, err.message);
                        }
                    }
                    if (enviouAlgo) {
                        console.log(`Rotina do scheduler concluída.`);
                    }
                }
            } catch (error) {
                console.error('Erro no ciclo do scheduler:', error);
            }
        });
    }
};

module.exports = schedulerService;
