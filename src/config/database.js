const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

let db;

if (process.env.DB_MODE === 'production') {
    // Aqui viria a configuração do Supabase
    // Por enquanto, vamos manter um log ou placeholder
    console.log('DB_MODE: production (Supabase integration pending)');
    // Para fins de dev, usaremos o SQLite mas avisando que o modo é produção
    const dbPath = path.resolve(__dirname, '../../data/laura.db');
    db = new Database(dbPath);
} else {
    const dbPath = path.resolve(__dirname, '../../data/laura.db');
    db = new Database(dbPath);
    console.log('DB_MODE: local (SQLite)');
}

// Configurações iniciais do banco
db.pragma('journal_mode = WAL');

module.exports = db;
