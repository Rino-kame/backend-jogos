const mongoose = require('mongoose');

const jogoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    nota: { type: Number, required: true, min: 0, max: 10 },
    tempoJogo: { type: Number, required: true, min: 0 }, // NOVO CAMPO (horas)
    descricaoCurta: { type: String, required: true, maxlength: 200 },
    descricaoCompleta: { type: String, required: true },
    plataforma: { type: String, required: true },
    dataFinalizacao: { type: Date, required: true },
    imagemCapa: { type: String, required: true },
    categoria: { type: String, required: true, enum: ['zerado', 'platinado'] }
}, { timestamps: true });

jogoSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalZerados: { $sum: { $cond: [{ $eq: ['$categoria', 'zerado'] }, 1, 0] } },
                totalPlatinados: { $sum: { $cond: [{ $eq: ['$categoria', 'platinado'] }, 1, 0] } },
                mediaNotas: { $avg: '$nota' },
                totalHoras: { $sum: '$tempoJogo' } // NOVO: soma total de horas
            }
        }
    ]);

    const melhorJogo = await this.findOne().sort({ nota: -1 });
    const jogoMaisLongo = await this.findOne().sort({ tempoJogo: -1 }); // NOVO: jogo com mais horas

    return {
        totalZerados: stats[0]?.totalZerados || 0,
        totalPlatinados: stats[0]?.totalPlatinados || 0,
        mediaNotas: (stats[0]?.mediaNotas || 0).toFixed(1),
        totalHoras: stats[0]?.totalHoras || 0, // NOVO
        melhorJogo: melhorJogo?.nome || 'Nenhum',
        jogoMaisLongo: jogoMaisLongo?.nome || 'Nenhum' // NOVO
    };
};

module.exports = mongoose.model('Jogo', jogoSchema);