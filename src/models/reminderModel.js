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
        const now = new Date().toISOString();
        // Lembretes onde a data_hora já passou ou é agora
        return db.prepare('SELECT c.*, u.telefone, u.nome FROM compromissos c JOIN users u ON c.user_id = u.id WHERE c.data_hora <= ?').all(now);
    },

    deleteById: (id) => {
        return db.prepare('DELETE FROM compromissos WHERE id = ?').run(id);
    }
};

module.exports = ReminderModel;
