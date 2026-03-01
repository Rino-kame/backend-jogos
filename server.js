const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Jogo = require('./models/Jogo');
const Usuario = require('./models/Usuario');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => {
    console.error('❌ Erro ao conectar ao MongoDB:', err);
    process.exit(1);
});

// ========== ROTAS PÚBLICAS ==========

app.get('/api/jogos', async (req, res) => {
    try {
        const { categoria, busca } = req.query;
        let query = {};

        if (categoria && categoria !== 'todos') {
            query.categoria = categoria;
        }

        if (busca) {
            query.$text = { $search: busca };
        }

        const jogos = await Jogo.find(query).sort({ nota: -1 });
        
        res.json({
            success: true,
            count: jogos.length,
            data: jogos
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/jogos/stats', async (req, res) => {
    try {
        const stats = await Jogo.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/jogos/top5', async (req, res) => {
    try {
        const topJogos = await Jogo.find().sort({ nota: -1 }).limit(5);
        res.json({ success: true, data: topJogos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// ========== ROTAS DE AUTENTICAÇÃO ==========

app.post('/api/auth/registrar', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        const usuarioExiste = await Usuario.findOne({ email });
        if (usuarioExiste) {
            return res.status(400).json({ success: false, message: 'Email já cadastrado' });
        }

        const usuario = new Usuario({ nome, email, senha });
        await usuario.save();

        res.status(201).json({ success: true, message: 'Usuário criado com sucesso' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(401).json({ success: false, message: 'Email ou senha inválidos' });
        }

        const senhaValida = await usuario.compararSenha(senha);
        if (!senhaValida) {
            return res.status(401).json({ success: false, message: 'Email ou senha inválidos' });
        }

        const token = jwt.sign(
            { id: usuario._id, email: usuario.email },
            process.env.JWT_SECRET || 'segredo_super_secreto',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            usuario: {
                id: usuario._id,
                nome: usuario.nome,
                email: usuario.email
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== ROTAS PROTEGIDAS ==========

function autenticarToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token não fornecido' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'segredo_super_secreto', (err, decoded) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Token inválido' });
        }
        req.usuarioId = decoded.id;
        next();
    });
}

// ADICIONAR jogo
app.post('/api/jogos', autenticarToken, async (req, res) => {
    try {
        const { nome, nota, tempoJogo, descricaoCurta, descricaoCompleta, plataforma, dataFinalizacao, imagemCapa, categoria } = req.body;

        if (!nome || !nota || !tempoJogo || !descricaoCurta || !descricaoCompleta || !plataforma || !dataFinalizacao || !imagemCapa || !categoria) {
            return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
        }

        const novoJogo = new Jogo({
            nome,
            nota: parseFloat(nota),
            tempoJogo: parseInt(tempoJogo),
            descricaoCurta,
            descricaoCompleta,
            plataforma,
            dataFinalizacao: new Date(dataFinalizacao),
            imagemCapa,
            categoria
        });

        await novoJogo.save();

        res.status(201).json({
            success: true,
            message: 'Jogo adicionado com sucesso!',
            data: novoJogo
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// EDITAR jogo
app.put('/api/jogos/:id', autenticarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, nota, tempoJogo, descricaoCurta, descricaoCompleta, plataforma, dataFinalizacao, imagemCapa, categoria } = req.body;

        const jogoAtualizado = await Jogo.findByIdAndUpdate(
            id,
            {
                nome,
                nota: parseFloat(nota),
                tempoJogo: parseInt(tempoJogo),
                descricaoCurta,
                descricaoCompleta,
                plataforma,
                dataFinalizacao: new Date(dataFinalizacao),
                imagemCapa,
                categoria
            },
            { new: true, runValidators: true }
        );

        if (!jogoAtualizado) {
            return res.status(404).json({ success: false, message: 'Jogo não encontrado' });
        }

        res.json({
            success: true,
            message: 'Jogo atualizado com sucesso!',
            data: jogoAtualizado
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// EXCLUIR jogo
app.delete('/api/jogos/:id', autenticarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const jogo = await Jogo.findByIdAndDelete(id);
        
        if (!jogo) {
            return res.status(404).json({
                success: false,
                message: 'Jogo não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Jogo excluído com sucesso!'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

// Middleware de erro global
app.use((err, req, res, next) => {
    console.error('Erro:', err);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});