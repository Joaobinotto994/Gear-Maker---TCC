const mongoose = require('mongoose');

const PedalboardSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String },
  categorias: { type: [String], default: [] },
estilo: {
  type: [String], // agora é array de strings
  enum: [ // lista fixa de estilos
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
  default: ["Outro"] // default agora é array
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
        spec: { type: String, default: '' } // 👈 NOVO CAMPO
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

  // ← NOVO CAMPO
  imagem: { type: String }, // URL ou base64 da imagem final do board
   imagemCard: { type: String }, // nova imagem opcional para o card
   fundo: { type: String }, // URL ou base64 da imagem de fundo
   annotations: { type: Array, default: [] }, 
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Usuario" }]  
});

module.exports = mongoose.model('Pedalboard', PedalboardSchema);