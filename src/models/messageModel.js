const db = require('../config/database');

const MessageModel = {
    create: async (userId, role, content) => {
        if (db.mode === 'production') {
            await db.supabase.from('messages').insert([{ user_id: userId, role, content }]);
        } else {
            db.sqlite.prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)').run(userId, role, content);
        }
    },

    getHistory: async (userId, limit = 10) => {
        if (db.mode === 'production') {
            const { data, error } = await db.supabase
                .from('messages')
                .select('role, content')
                .eq('user_id', userId)
                .order('criado_em', { ascending: false })
                .limit(limit);
            
            if (error) return [];
            
            const history = data.reverse().map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));

            // Regra do Gemini: O histórico DEVE começar com um papel 'user'
            if (history.length > 0 && history[0].role === 'model') {
                history.shift();
            }
            return history;
        } else {
            let history = db.sqlite.prepare('SELECT role, content FROM messages WHERE user_id = ? ORDER BY criado_em DESC LIMIT ?')
                .all(userId, limit)
                .reverse();

            if (history.length > 0 && history[0].role === 'model') {
                history.shift();
            }

            return history.map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));
        }
    },

    clearHistory: async (userId) => {
        if (db.mode === 'production') {
            await db.supabase.from('messages').delete().eq('user_id', userId);
        } else {
            db.sqlite.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
        }
    }
};

module.exports = MessageModel;
