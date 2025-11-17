const mongoose = require('mongoose');

const PedalboardSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String },
  categorias: { type: [String], default: [] },
estilo: {
  type: [String], 
  enum: [ 
    "Alternativo",
    "Bandinha",
    "Black Metal",
    "Blues",
    "Blues Rock",
    "Country",
    "Doom Metal",
    "Eletronico",
    "Funk",
    "Gaucha",
    "Glam Rock",
    "Gospel",
    "Hard Rock",
    "Jazz",
    "Metal",
    "Nu Metal",
    "Pop",
    "Power Metal",
    "Punk Rock",
    "Reggae",
    "Rock",
    "Rock 70's",
    "Rock Psicodelico",
    "Sertanejo",
    "Sertanejo Universitario",
    "Thrash Metal",
    "Outro"
  ],
  default: ["Outro"] 
},
  pedais: [
    {
      pedalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pedal' },
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      rotation: { type: Number, default: 0 },
      zIndex: { type: Number, default: 10 },
      src: { type: String },
      widthCm: { type: Number, default: 8 },
      heightCm: { type: Number, default: 8 },
        spec: { type: String, default: '' } 
    }
  ],

  boards: [
    {
      boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      rotation: { type: Number, default: 0 },
      zIndex: { type: Number, default: 10 },
      src: { type: String },
      widthCm: { type: Number, default: 8 },
      heightCm: { type: Number, default: 8 }
    }
  ],

  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verified: { type: Boolean, default: false },
  artista: { type: String },
  imagem: { type: String }, 
   imagemCard: { type: String }, 
   fundo: { type: String }, 
   annotations: { type: Array, default: [] }, 
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Usuario" }]  
});

module.exports = mongoose.model('Pedalboard', PedalboardSchema);