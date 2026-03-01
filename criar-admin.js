const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Usuario = require('./models/Usuario');

async function criarAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');

        // Verificar se já existe
        const existe = await Usuario.findOne({ email: 'admin@email.com' });
        if (existe) {
            console.log('❌ Usuário já existe!');
            process.exit(0);
        }

        // Criar admin
        const admin = new Usuario({
            nome: 'Administrador',
            email: 'admin@email.com',
            senha: 'admin123'
        });

        await admin.save();
        console.log('✅ Admin criado com sucesso!');
        console.log('📌 Email: admin@email.com');
        console.log('📌 Senha: admin123');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

criarAdmin();