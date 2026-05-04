process.env.TZ = 'America/Sao_Paulo';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initSchema = require('./src/database/schema');
const schedulerService = require('./src/services/schedulerService');
const whatsappService = require('./src/services/whatsappService');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa o banco de dados, o agendador e o bot WhatsApp
initSchema();
schedulerService.init();
whatsappService.init();

// Configuração de Rate Limit (Proteção contra abuso)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 req por IP
    message: { error: 'Muitas requisições vindas deste IP, tente novamente mais tarde.' }
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // Apenas 10 tentativas de login/registro por hora
    message: { error: 'Limite de tentativas atingido. Tente novamente em uma hora.' }
});

// Middlewares de Segurança
app.use(helmet()); // Adiciona headers de segurança automaticamente
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Apenas origens confiáveis
    credentials: true
}));
app.use(express.json({ limit: '1mb' })); // Limita o tamanho do JSON para evitar DoS
app.use('/api/', limiter); // Aplica rate limit global na API
app.use('/api/auth', authLimiter); // Aplica rate limit mais rígido na autenticação

// Rotas
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/ai', require('./src/routes/aiRoutes'));

// Rota inicial amigável
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1>🤖 Laura AI Backend</h1>
            <p>O servidor está rodando corretamente!</p>
            <p>Para acessar o painel visual, abra: <a href="http://localhost:5173">http://localhost:5173</a></p>
        </div>
    `);
});

// Rota de teste
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', assistente: 'Laura' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
