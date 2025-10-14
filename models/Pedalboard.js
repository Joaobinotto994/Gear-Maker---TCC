const mongoose = require('mongoose');

const PedalboardSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String },
  categorias: { type: [String], default: [] },
  
  pedais: [
    {
      pedalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pedal' },
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      rotation: { type: Number, default: 0 },
      zIndex: { type: Number, default: 10 },
      src: { type: String },             // ← imagem do pedal no board
      widthCm: { type: Number, default: 8 },  // ← largura
      heightCm: { type: Number, default: 8 }  // ← altura
    }
  ],

  boards: [
    {
      boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      rotation: { type: Number, default: 0 },
      zIndex: { type: Number, default: 10 },
      src: { type: String },             // ← imagem do board
      widthCm: { type: Number, default: 8 },  // ← largura
      heightCm: { type: Number, default: 8 }  // ← altura
    }
  ],

  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  artista: { type: String }
});

module.exports = mongoose.model('Pedalboard', PedalboardSchema);