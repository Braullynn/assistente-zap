const db = require('../config/database');

const UserModel = {
    create: (nome, telefone, senha_hash) => {
        const info = db.prepare('INSERT INTO users (nome, telefone, senha_hash) VALUES (?, ?, ?)').run(nome, telefone, senha_hash);
        return info.lastInsertRowid;
    },

    findByTelefone: (telefone) => {
        // Busca exata primeiro
        let user = db.prepare('SELECT * FROM users WHERE telefone = ?').get(telefone);
        if (user) return user;

        // Se não achou, tenta normalizar (remover o 9 extra se tiver 13 dígitos, ou adicionar se tiver 12)
        // Ex: 558198822... -> 55818822...
        if (telefone.startsWith('55') && telefone.length === 12) {
            const com9 = '55' + telefone.slice(2, 4) + '9' + telefone.slice(4);
            user = db.prepare('SELECT * FROM users WHERE telefone = ?').get(com9);
        } else if (telefone.startsWith('55') && telefone.length === 13) {
            const sem9 = '55' + telefone.slice(2, 4) + telefone.slice(5);
            user = db.prepare('SELECT * FROM users WHERE telefone = ?').get(sem9);
        }
        
        return user;
    },

    findById: (id) => {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    },

    listAll: () => {
        return db.prepare('SELECT id, nome, telefone, criado_em FROM users').all();
    },

    delete: (id) => {
        return db.prepare('DELETE FROM users WHERE id = ?').run(id);
    },

    update: (id, nome, telefone) => {
        return db.prepare('UPDATE users SET nome = ?, telefone = ? WHERE id = ?').run(nome, telefone, id);
    }
};

module.exports = UserModel;
