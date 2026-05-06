const db = require('../config/database');

const UserModel = {
    create: async (nome, telefone, senha_hash) => {
        if (db.mode === 'production') {
            const { data, error } = await db.supabase
                .from('users')
                .insert([{ nome, telefone, senha_hash }])
                .select();
            if (error) throw error;
            return data[0].id;
        } else {
            const info = db.sqlite.prepare('INSERT INTO users (nome, telefone, senha_hash) VALUES (?, ?, ?)').run(nome, telefone, senha_hash);
            return info.lastInsertRowid;
        }
    },

    findByTelefone: async (telefone) => {
        if (db.mode === 'production') {
            let { data: user, error } = await db.supabase
                .from('users')
                .select('*')
                .eq('telefone', telefone)
                .single();
            
            if (user) return user;

            // Lógica de normalização para o Supabase
            let normalized = null;
            if (telefone.startsWith('55') && telefone.length === 12) {
                normalized = '55' + telefone.slice(2, 4) + '9' + telefone.slice(4);
            } else if (telefone.startsWith('55') && telefone.length === 13) {
                normalized = '55' + telefone.slice(2, 4) + telefone.slice(5);
            }

            if (normalized) {
                let { data: userNorm } = await db.supabase
                    .from('users')
                    .select('*')
                    .eq('telefone', normalized)
                    .single();
                return userNorm;
            }
            return null;
        } else {
            // Busca exata primeiro
            let user = db.sqlite.prepare('SELECT * FROM users WHERE telefone = ?').get(telefone);
            if (user) return user;

            // Se não achou, tenta normalizar
            if (telefone.startsWith('55') && telefone.length === 12) {
                const com9 = '55' + telefone.slice(2, 4) + '9' + telefone.slice(4);
                user = db.sqlite.prepare('SELECT * FROM users WHERE telefone = ?').get(com9);
            } else if (telefone.startsWith('55') && telefone.length === 13) {
                const sem9 = '55' + telefone.slice(2, 4) + telefone.slice(5);
                user = db.sqlite.prepare('SELECT * FROM users WHERE telefone = ?').get(sem9);
            }
            return user;
        }
    },

    findById: async (id) => {
        if (db.mode === 'production') {
            const { data, error } = await db.supabase.from('users').select('*').eq('id', id).single();
            return data;
        } else {
            return db.sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id);
        }
    },

    listAll: async () => {
        if (db.mode === 'production') {
            const { data, error } = await db.supabase.from('users').select('id, nome, criado_em');
            return data;
        } else {
            return db.sqlite.prepare('SELECT id, nome, criado_em FROM users').all();
        }
    },

    delete: async (id) => {
        if (db.mode === 'production') {
            await db.supabase.from('users').delete().eq('id', id);
        } else {
            db.sqlite.prepare('DELETE FROM users WHERE id = ?').run(id);
        }
    },

    update: async (id, nome, telefone) => {
        if (db.mode === 'production') {
            await db.supabase.from('users').update({ nome, telefone }).eq('id', id);
        } else {
            db.sqlite.prepare('UPDATE users SET nome = ?, telefone = ? WHERE id = ?').run(nome, telefone, id);
        }
    }
};

module.exports = UserModel;
