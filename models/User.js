const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true, 
    trim: true 
  },
  email: {
    type: String,
    required: true,
    unique: true, 
    match: [/^\S+@\S+\.\S+$/, "Formato de email inválido"]
  },
  senha: {
    type: String,
    required: true,
    minlength: 6
  },
  telefone: {
    type: String,
    required: true,
    match: [/^\d{10,11}$/, "Telefone deve ter 10 ou 11 dígitos"] 
  },
  dataNascimento: {
    type: Date,
    required: true 
  },
  avatar: { type: String, default: "https://via.placeholder.com/40" },
  criadoEm: {
    type: Date,
    default: Date.now
  }
});


module.exports = mongoose.model('User', userSchema);