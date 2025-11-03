const mongoose = require('mongoose');

const PedalSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  descricao: { type: String, trim: true },
  imagem: { type: String }, // URL ou caminho da imagem
  categoria: { type: String, trim: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // dono do pedal
  widthCm: { type: Number, default: 8 },   // largura em cm (opcional)
  heightCm: { type: Number, default: 8 },  // altura em cm (opcional)
  createdAt: { type: Date, default: Date.now },
  verified: {
  type: Boolean,
  default: false
}
});

module.exports = mongoose.model('Pedal', PedalSchema);