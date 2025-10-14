const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  imagem: { type: String, required: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  widthCm: { type: Number, default: 30 },   // tamanho padrão em cm
  heightCm: { type: Number, default: 30 }
});

module.exports = mongoose.model('Board', boardSchema);