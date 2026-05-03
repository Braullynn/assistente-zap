const express = require('express');
const UserModel = require('../models/userModel');
const authMiddleware = require('../config/authMiddleware');
const router = express.Router();

// Listar todos os usuários (Protegido)
router.get('/', authMiddleware, (req, res) => {
    try {
        const users = UserModel.listAll();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar usuário (Protegido)
router.delete('/:id', authMiddleware, (req, res) => {
    try {
        UserModel.delete(req.params.id);
        res.json({ message: 'Usuário deletado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar usuário (Protegido)
router.put('/:id', authMiddleware, (req, res) => {
    try {
        const { nome, telefone } = req.body;
        UserModel.update(req.params.id, nome, telefone);
        res.json({ message: 'Usuário atualizado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
