const db = require('../config/database');

const MessageModel = {
    create: (userId, role, content) => {
        return db.prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)').run(userId, role, content);
    },

    getHistory: (userId, limit = 10) => {
        let history = db.prepare('SELECT role, content FROM messages WHERE user_id = ? ORDER BY criado_em DESC LIMIT ?')
            .all(userId, limit)
            .reverse();

        // Regra do Gemini: O histórico DEVE começar com um papel 'user'
        if (history.length > 0 && history[0].role === 'model') {
            history.shift(); // Remove a primeira mensagem se for da IA
        }

        return history.map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
        }));
    },

    clearHistory: (userId) => {
        return db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
    }
};

module.exports = MessageModel;
