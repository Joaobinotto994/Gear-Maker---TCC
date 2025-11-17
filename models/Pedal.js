const mongoose = require('mongoose');

const PedalSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  descricao: { type: String, trim: true },
  imagem: { type: String }, 
  categoria: { type: String, trim: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  widthCm: { type: Number, default: 8 },   
  heightCm: { type: Number, default: 8 },  
  createdAt: { type: Date, default: Date.now },
  verified: {
  type: Boolean,
  default: false
}
});

module.exports = mongoose.model('Pedal', PedalSchema);