require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initSchema = require('./src/database/schema');
const schedulerService = require('./src/services/schedulerService');
const whatsappService = require('./src/services/whatsappService');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa o banco de dados, o agendador e o bot WhatsApp
initSchema();
schedulerService.init();
whatsappService.init();

// Middlewares
app.use(cors());
app.use(express.json());

// CSP Middleware básico para evitar erros no console
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:3000;");
    next();
});

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
