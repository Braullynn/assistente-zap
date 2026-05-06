const express = require('express');
const UserModel = require('../models/userModel');
const authMiddleware = require('../config/authMiddleware');
const router = express.Router();

// Listar todos os usuários (Protegido)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const users = await UserModel.listAll();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar usuário (Protegido contra IDOR)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (String(req.user.id) !== String(req.params.id)) {
            return res.status(403).json({ error: 'Você só pode deletar sua própria conta.' });
        }
        await UserModel.delete(req.params.id);
        res.json({ message: 'Usuário deletado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar usuário (Protegido contra IDOR e XSS)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        if (String(req.user.id) !== String(req.params.id)) {
            return res.status(403).json({ error: 'Você só pode editar sua própria conta.' });
        }
        const nome = req.body.nome ? req.body.nome.replace(/[<>]/g, '').trim() : undefined;
        const telefone = req.body.telefone ? req.body.telefone.replace(/[<>]/g, '').trim() : undefined;
        
        await UserModel.update(req.params.id, nome, telefone);
        res.json({ message: 'Usuário atualizado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
