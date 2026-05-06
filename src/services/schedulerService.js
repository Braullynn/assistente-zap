const cron = require('node-cron');
const chalk = require('chalk');
const ReminderModel = require('../models/reminderModel');
const whatsappService = require('./whatsappService');

const schedulerService = {
    init: () => {
        console.log(chalk.cyan('⏰ [SCHEDULER] Motor de lembretes ativo (checagem 1x/min)'));
        
        // Executa a cada minuto
        cron.schedule('* * * * *', async () => {
            try {
                const pending = await ReminderModel.getPendingReminders();
                
                if (pending.length > 0) {
                    console.log(`Encontrados ${pending.length} lembretes para disparar.`);
                    
                    for (const reminder of pending) {
                        const message = `⏰ *LEMBRETE DA LAURA* ⏰\n\nOlá ${reminder.nome}, você me pediu para te lembrar disso agora:\n👉 *${reminder.titulo}*`;
                        
                        try {
                            const success = await whatsappService.sendMessage(reminder.telefone, message);
                            
                            if (success) {
                                await ReminderModel.deleteById(reminder.id);
                                console.log(chalk.green(`✅ [SCHEDULER] Lembrete #${reminder.id} enviado e removido.`));
                            } else {
                                console.log(chalk.red(`❌ [SCHEDULER] Falha ao enviar lembrete #${reminder.id}. Mantendo no banco para nova tentativa.`));
                            }
                            
                        } catch (err) {
                            console.error(`Falha ao disparar lembrete #${reminder.id}:`, err.message);
                            // Se falhar, o lembrete continua no banco para tentar no próximo minuto
                        }
                    }
                }
            } catch (error) {
                console.error('Erro no ciclo do scheduler:', error);
            }
        });
    }
};

module.exports = schedulerService;
