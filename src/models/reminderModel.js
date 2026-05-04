const db = require('../config/database');

const ReminderModel = {
    create: (userId, titulo, data_hora) => {
        return db.prepare('INSERT INTO compromissos (user_id, titulo, data_hora) VALUES (?, ?, ?)').run(userId, titulo, data_hora);
    },

    listByUser: (userId) => {
        return db.prepare('SELECT id, titulo, data_hora FROM compromissos WHERE user_id = ? ORDER BY data_hora ASC').all(userId);
    },

    deleteByTitle: (userId, titulo) => {
        // Busca aproximada ou exata
        return db.prepare('DELETE FROM compromissos WHERE user_id = ? AND titulo LIKE ?').run(userId, `%${titulo}%`);
    },

    updateTime: (userId, titulo, novaDataHora) => {
        return db.prepare('UPDATE compromissos SET data_hora = ? WHERE user_id = ? AND titulo LIKE ?').run(novaDataHora, userId, `%${titulo}%`);
    },

    getPendingReminders: () => {
        // Gera o horário atual de Brasília de forma ultra-robusta
        const brTime = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }).formatToParts(new Date());

        const part = (type) => brTime.find(p => p.type === type).value;
        const now = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
        
        // Lembretes onde a data_hora já passou ou é agora
        return db.prepare('SELECT c.*, u.telefone, u.nome FROM compromissos c JOIN users u ON c.user_id = u.id WHERE c.data_hora <= ?').all(now);
    },

    deleteById: (id) => {
        return db.prepare('DELETE FROM compromissos WHERE id = ?').run(id);
    }
};

module.exports = ReminderModel;
