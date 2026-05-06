const db = require('../config/database');

const ReminderModel = {
    create: async (userId, titulo, data_hora) => {
        if (db.mode === 'production') {
            await db.supabase.from('compromissos').insert([{ user_id: userId, titulo, data_hora }]);
        } else {
            db.sqlite.prepare('INSERT INTO compromissos (user_id, titulo, data_hora) VALUES (?, ?, ?)').run(userId, titulo, data_hora);
        }
    },

    listByUser: async (userId) => {
        if (db.mode === 'production') {
            const { data, error } = await db.supabase
                .from('compromissos')
                .select('id, titulo, data_hora')
                .eq('user_id', userId)
                .order('data_hora', { ascending: true });
            return data;
        } else {
            return db.sqlite.prepare('SELECT id, titulo, data_hora FROM compromissos WHERE user_id = ? ORDER BY data_hora ASC').all(userId);
        }
    },

    deleteByTitle: async (userId, titulo) => {
        if (db.mode === 'production') {
            await db.supabase.from('compromissos').delete().eq('user_id', userId).ilike('titulo', `%${titulo}%`);
        } else {
            db.sqlite.prepare('DELETE FROM compromissos WHERE user_id = ? AND titulo LIKE ?').run(userId, `%${titulo}%`);
        }
    },

    updateTime: async (userId, titulo, novaDataHora) => {
        if (db.mode === 'production') {
            await db.supabase.from('compromissos').update({ data_hora: novaDataHora }).eq('user_id', userId).ilike('titulo', `%${titulo}%`);
        } else {
            db.sqlite.prepare('UPDATE compromissos SET data_hora = ? WHERE user_id = ? AND titulo LIKE ?').run(novaDataHora, userId, `%${titulo}%`);
        }
    },

    getPendingReminders: async () => {
        const brTime = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }).formatToParts(new Date());

        const part = (type) => brTime.find(p => p.type === type).value;
        const now = `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
        
        if (db.mode === 'production') {
            // No Supabase, fazemos o JOIN via select se as relações estiverem configuradas
            // Ou buscamos os compromissos e depois os usuários.
            // Assumindo que a relação user_id -> users.id existe:
            const { data, error } = await db.supabase
                .from('compromissos')
                .select('*, users(telefone, nome)')
                .lte('data_hora', now);
            
            if (error) return [];
            // Ajusta o formato para bater com o que o scheduler espera
            return data.map(r => ({
                ...r,
                telefone: r.users.telefone,
                nome: r.users.nome
            }));
        } else {
            return db.sqlite.prepare('SELECT c.*, u.telefone, u.nome FROM compromissos c JOIN users u ON c.user_id = u.id WHERE c.data_hora <= ?').all(now);
        }
    },

    deleteById: async (id) => {
        if (db.mode === 'production') {
            await db.supabase.from('compromissos').delete().eq('id', id);
        } else {
            db.sqlite.prepare('DELETE FROM compromissos WHERE id = ?').run(id);
        }
    }
};

module.exports = ReminderModel;
