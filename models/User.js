//trazendo o mongoose para o codigo
const mongoose = require('mongoose');

//criando o schema
const userSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true, //campo obrigatorio
    trim: true //remove espaços do começo e do fim
  },
  email: {
    type: String,
    required: true,
    unique: true, //apenas um email nao pode ter outro igual
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
    match: [/^\d{10,11}$/, "Telefone deve ter 10 ou 11 dígitos"] // ex: 55999999999
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

//Export 
module.exports = mongoose.model('User', userSchema);