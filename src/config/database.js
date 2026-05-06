const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

// 1. Configuração do SQLite (Local)
const dbPath = path.resolve(__dirname, '../../data/laura.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// 2. Configuração do Supabase (Produção)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const db = {
    mode: process.env.DB_MODE || 'local',
    sqlite,
    supabase
};

console.log(`📡 Banco de dados inicializado em modo: ${db.mode.toUpperCase()}`);

module.exports = db;
