const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');

const authController = {
    register: async (req, res) => {
        try {
            const { nome, telefone, senha } = req.body;

            // Se nenhuma senha for fornecida (comum para usuários normais que não logam no painel), gera uma aleatória
            const passwordToUse = senha || require('crypto').randomBytes(8).toString('hex');

            // Verificar se usuário já existe
            const existingUser = UserModel.findByTelefone(telefone);
            if (existingUser) {
                return res.status(400).json({ error: 'Este telefone já está cadastrado.' });
            }

            // Hash da senha
            const salt = await bcrypt.genSalt(10);
            const senha_hash = await bcrypt.hash(passwordToUse, salt);

            // Criar usuário
            const userId = UserModel.create(nome, telefone, senha_hash);

            // Tentar enviar mensagem de boas-vindas (assíncrono)
            const whatsappService = require('../services/whatsappService');
            whatsappService.sendWelcomeMessage(nome, telefone).catch(err => console.log('Erro ao enviar boas-vindas:', err.message));

            res.status(201).json({ message: 'Usuário cadastrado com sucesso!', userId });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao cadastrar usuário: ' + error.message });
        }
    },

    login: async (req, res) => {
        try {
            const { telefone, senha } = req.body;

            // Buscar usuário
            const user = UserModel.findByTelefone(telefone);
            if (!user) {
                return res.status(400).json({ error: 'Telefone ou senha inválidos.' });
            }

            // Verificar senha
            const isMatch = await bcrypt.compare(senha, user.senha_hash);
            if (!isMatch) {
                return res.status(400).json({ error: 'Telefone ou senha inválidos.' });
            }

            // Gerar Token JWT
            const token = jwt.sign(
                { id: user.id, nome: user.nome, telefone: user.telefone },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '1d' }
            );

            res.json({
                token,
                user: { id: user.id, nome: user.nome, telefone: user.telefone }
            });
        } catch (error) {
            res.status(500).json({ error: 'Erro no login: ' + error.message });
        }
    }
};

module.exports = authController;
