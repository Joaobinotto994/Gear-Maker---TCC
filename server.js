require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 
const cors = require('cors');
const path = require('path');
const multer = require('multer'); 


const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// config do cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// config do multer + cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pedalboards', // pasta que esta na minha conta do cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});



const upload = multer({ storage });
const app = express();
const PORT = process.env.PORT || 3000;

// schemas
const User = require('./models/User');
const Pedal = require('./models/Pedal'); 
const Pedalboard = require('./models/Pedalboard');
const Board = require('./models/Board');
// lista dos usuarios  verificados por ID (conta BoardMakerOficial)
const usuariosVerificadores = [
  "68f2ac44a5bc316f26869a43"
];

app.use(cors());
app.use(express.json({ limit: '10mb' }));



const placeholder = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1234567890/placeholder.png`;

function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) 
    return res.status(401).json({ error: "Acesso negado. Token não fornecido." });

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = usuario;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(403).json({ error: "Seu acesso expirou, faça login novamente!!" });
    }
    return res.status(403).json({ error: "Token inválido. Faça login novamente!" });
  }
}

app.post("/upload-fundo", autenticarToken, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "Nenhuma imagem enviada" });

    const uploadResult = await cloudinary.uploader.upload(image, {
      folder: "pedalboards/fundos",
      resource_type: "image"
    });

    res.json({ url: uploadResult.secure_url });
  } catch (err) {
    console.error("Erro ao enviar fundo:", err);

    // tamanho maximo da imagem
    if (err.message.includes("request entity too large")) {
      return res.status(413).json({
        error: "Imagem é grande demais!! Não é permitido imagens de mais de 9MB"
      });
    }

    res.status(500).json({
      error: "Erro ao enviar fundo",
      detalhes: err.message
    });
  }
});

// ------------------------ USUARIOS ------------------------

// registrar
app.post('/register', async (req, res) => {
  try {
    const { nome, email, senha, telefone, dataNascimento } = req.body;
    const hashSenha = await bcrypt.hash(senha, 10);

   const novoUsuario = new User({ 
  nome, email, senha: hashSenha, telefone, dataNascimento,
  avatar: req.body.avatar || undefined 
});
    await novoUsuario.save();

    res.status(201).json({ message: "Usuário criado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Erro ao criar usuário", detalhes: err.message });
  }
});
// listar só para testes no postman
app.get('/usuarios', async (req, res) => {
  try {
   const usuarios = await User.find({}, '_id nome email avatar'); 
    res.json(usuarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar usuários", detalhes: err.message });
  }
});

// login
app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const usuario = await User.findOne({ email });
    if (!usuario) return res.status(400).json({ error: "Usuário não encontrado" });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(400).json({ error: "Senha incorreta" });

const token = jwt.sign(
  { id: usuario._id, email: usuario.email, nome: usuario.nome },
  process.env.JWT_SECRET,
  { expiresIn: "6h" } 
);

    //dados do token
    res.json({
      message: "Login efetuado com sucesso!",
      token,
      user: { _id: usuario._id, nome: usuario.nome, email: usuario.email }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao fazer login", detalhes: err.message });
  }
});
app.put('/usuarios/me/avatar', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token não fornecido" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await User.findById(decoded.id);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });

    usuario.avatar = req.body.avatar;
    await usuario.save();

    res.json({ message: "Avatar atualizado com sucesso!", avatar: usuario.avatar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar avatar", detalhes: err.message });
  }
});
app.put('/usuarios/me/avatar', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token não fornecido" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await User.findById(decoded.id);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });

    usuario.avatar = req.body.avatar;
    await usuario.save();

    res.json({ message: "Avatar atualizado com sucesso!", avatar: usuario.avatar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar avatar", detalhes: err.message });
  }
});
// dados do usuario logado
app.get('/usuarios/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token não fornecido" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await User.findById(decoded.id);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });

    // retorna os dados do usuário 
    res.json({
      _id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      avatar: usuario.avatar || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar usuário", detalhes: err.message });
  }
});
// ------------------------ BOARDS ------------------------

// criar board
app.post('/boards', autenticarToken, upload.single('imagem'), async (req, res) => {
  try {
    const { nome, widthCm, heightCm } = req.body;
    const imagem = req.file ? req.file.path : null;

    if (!nome || !imagem) 
      return res.status(400).json({ erro: "Nome e imagem são obrigatórios." });

    const novoBoard = new Board({
      nome,
      imagem,
      usuarioId: req.usuario.id,
      widthCm: widthCm ? parseFloat(widthCm) : 30,
      heightCm: heightCm ? parseFloat(heightCm) : 30
    });

    await novoBoard.save();
    res.status(201).json(novoBoard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao criar board" });
  }
});
// lista todos os boards de todos usuarios
app.get('/boards/todos', autenticarToken, async (req, res) => {
  try {
    const search = req.query.search || "";

    const boards = await Board.find({
      nome: { $regex: search, $options: "i" } 
    }).populate("usuarioId", "nome email"); 

    res.json(boards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar boards" });
  }
});

// deletar board
app.delete('/boards/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.usuario.id;

  try {
    const board = await Board.findById(id);

    if (!board) {
      return res.status(404).json({ error: "Board não encontrado" });
    }
    if (board.usuarioId.toString() !== userId) {
      return res.status(403).json({ error: "Não autorizado a deletar este board" });
    }
    await Board.findByIdAndDelete(id);

    res.json({ message: "Board excluído com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir board", detalhes: err.message });
  }
});

// listar boards do usuário logado com filtro de busca
app.get('/boards', autenticarToken, async (req, res) => {
  try {
    const search = req.query.search || "";
    // busca os boards do usuário logado que combinem com o nome digitado
    const boards = await Board.find({
      usuarioId: req.usuario.id,
      nome: { $regex: search, $options: "i" } 
    });
    res.json(boards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar boards" });
  }
});
// copiar/adiciona um board existente para a biblioteca
app.post("/boards/copiar/:id", autenticarToken, async (req, res) => {
  try {
    const boardOriginal = await Board.findById(req.params.id);
    if (!boardOriginal) return res.status(404).json({ error: "Board não encontrado" });
    const novoBoard = new Board({
      nome: boardOriginal.nome,
      imagem: boardOriginal.imagem,
      widthCm: boardOriginal.widthCm || 30,
      heightCm: boardOriginal.heightCm || 30,
      usuarioId: req.usuario.id
    });

    await novoBoard.save();
    res.status(201).json({ message: "Board adicionado à sua biblioteca!", board: novoBoard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao adicionar board", detalhes: err.message });
  }
});
app.patch('/boards/:id/verificar', autenticarToken, async (req, res) => {
  try {
    if (!usuariosVerificadores.includes(req.usuario.id)) {
      return res.status(403).json({ error: "Você não tem permissão para verificar este board" });
    }

    const board = await Board.findByIdAndUpdate(req.params.id, { verified: true }, { new: true });
    if (!board) return res.status(404).json({ error: "Board não encontrado" });

    res.json(board);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao verificar board", detalhes: err.message });
  }
});
//retorna um board especifico do usuário 
app.get('/boards/:id', autenticarToken, async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ error: "Board não encontrado" });
    }

    res.json({
      _id: board._id,
      nome: board.nome,
      imagem: board.imagem,
      widthCm: board.widthCm || 30,
      heightCm: board.heightCm || 30,
      verified: board.verified
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar board", detalhes: err.message });
  }
});

// ------------------------ PEDALBOARDS ------------------------

// cria o pedalboard 
const uploadFields = upload.fields([
  { name: 'imagem', maxCount: 1 },
  { name: 'imagemCard', maxCount: 1 } 
]);

app.post('/pedalboards', autenticarToken, uploadFields, async (req, res) => {
  try {
      const { nome, descricao, categoria, pedais, boards, artista, annotations, estilo } = req.body; 
    let imagem = req.files?.imagem ? req.files.imagem[0].path : req.body.imagem || null;
    let imagemCard = req.files?.imagemCard ? req.files.imagemCard[0].path : req.body.imagemCard || null;
   let fundo = req.files?.fundo ? req.files.fundo[0].path : req.body.fundo || null;

    if (!nome || !imagem) {
      return res.status(400).json({ erro: "Nome e imagem principal são obrigatórios." });
    }
    const pedaisParsed = pedais ? (typeof pedais === 'string' ? JSON.parse(pedais) : pedais) : [];
    const boardsParsed = boards ? (typeof boards === 'string' ? JSON.parse(boards) : boards) : [];
    const estilosSelecionados = typeof estilo === 'string' ? JSON.parse(estilo) : estilo;

const novoPedalboard = new Pedalboard({
    nome,
    descricao,
    categorias: categoria ? [categoria] : [],
    estilo: estilosSelecionados, 
    pedais: pedaisParsed.map(p => ({
        pedalId: p.pedalId,
        x: p.x || 0,
        y: p.y || 0,
        rotation: p.rotation || 0,
        zIndex: p.zIndex || 10,
        src: p.src || p.src || placeholder,
        widthCm: p.widthCm || 8,
        heightCm: p.heightCm || 8
    })),
boards: boardsParsed.map(b => ({
  boardId: b.boardId,
  x: b.x || 0,
  y: b.y || 0,
  rotation: b.rotation || 0,
  zIndex: b.zIndex || 10,
  src: b.src || placeholder, 
  widthCm: b.widthCm || 30,
  heightCm: b.heightCm || 30
})),
    usuario: req.usuario.id,
    artista: artista || req.usuario.nome,
    imagem,
    imagemCard,
    fundo,
    annotations: JSON.parse(annotations || '[]'),
});

    await novoPedalboard.save();

    res.status(201).json({
      message: "Pedalboard criado com sucesso!",
      pedalboard: novoPedalboard
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Erro ao criar pedalboard",
      detalhes: err.message
    });
  }
});
// lista pedalboards do usuário 
app.get('/meus-pedalboards', autenticarToken, async (req, res) => {
  try {
 const pedalboards = await Pedalboard.find({ usuario: req.usuario.id })
  .populate('pedais.pedalId')
  .populate('boards.boardId') 
  .populate('usuario', 'nome email')
  .select("+curtidas");
    const pedalboardsComEstilo = pedalboards.map(p => ({
      ...p.toObject(),
      estilo: Array.isArray(p.estilo) ? p.estilo : (p.estilo ? [p.estilo] : [])
    }));
    res.json({ pedalboards: pedalboardsComEstilo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedalboards", detalhes: err.message });
  }
});

// busca todos os pedalboards para pesquisa
app.get("/pedalboards/search", autenticarToken, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Informe um termo de pesquisa" });

const pedalboards = await Pedalboard.find({
  nome: { $regex: q, $options: "i" }
})
  .populate("usuario", "nome email")
  .populate("pedais.pedalId")
  .populate("boards.boardId") 
  .select("+curtidas"); 

    res.json(pedalboards);
  } catch (err) {
    res.status(500).json({ error: "Erro ao pesquisar pedalboards", detalhes: err.message });
  }
});
// atualiza o pedalboard
app.put('/pedalboards/:id', autenticarToken, uploadFields, async (req, res) => {
  const { id } = req.params;
  let { nome, artista, descricao, pedais, boards, annotations, estilo } = req.body;

  try {
    const pedalboard = await Pedalboard.findById(id);
    if (!pedalboard) return res.status(404).json({ error: "Pedalboard não encontrado" });

    if (pedalboard.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({ error: "Não autorizado" });
    }

    pedalboard.nome = nome || pedalboard.nome;
    pedalboard.artista = artista || pedalboard.artista;
    pedalboard.descricao = descricao || pedalboard.descricao;

    if (estilo) {
      pedalboard.estilo = Array.isArray(estilo) ? estilo : JSON.parse(estilo);
    }

    if (req.files?.imagem) pedalboard.imagem = req.files.imagem[0].path;
    else if (req.body.imagem) pedalboard.imagem = req.body.imagem;

    if (req.files?.imagemCard) pedalboard.imagemCard = req.files.imagemCard[0].path;
    else if (req.body.imagemCard) pedalboard.imagemCard = req.body.imagemCard;

   if (req.files?.fundo) pedalboard.fundo = req.files.fundo[0].path;
    else if (req.body.fundo) pedalboard.fundo = req.body.fundo;

    if (pedais && typeof pedais === 'string') pedais = JSON.parse(pedais);
    if (boards && typeof boards === 'string') boards = JSON.parse(boards);

    if (Array.isArray(pedais)) {
      pedalboard.pedais = pedais.map(p => {
        const existing = p.id ? pedalboard.pedais.id(p.id) : null;
        return {
          pedalId: existing?.pedalId || p.pedalId || undefined,
          src: existing?.src || p.src || p.src || placeholder,
          x: p.x || 0,
          y: p.y || 0,
          rotation: p.rotation || 0,
          zIndex: p.zIndex || 10,
          widthCm: p.widthCm || existing?.widthCm || 8,
          heightCm: p.heightCm || existing?.heightCm || 8,
          spec: p.spec || existing?.spec || ''
        };
      });
    }

    if (Array.isArray(boards)) {
      pedalboard.boards = boards.map(b => {
        const existingB = b.id ? pedalboard.boards.id(b.id) : null;
        return {
          boardId: existingB?.boardId || b.boardId || undefined,
         src: existingB?.src || b.src || placeholder, 
          x: b.x || 0,
          y: b.y || 0,
          rotation: b.rotation || 0,
          zIndex: b.zIndex || 10,
          widthCm: b.widthCm || existingB?.widthCm || 30,
          heightCm: b.heightCm || existingB?.heightCm || 30
        };
      });
    }

    if (annotations) {
      pedalboard.annotations = typeof annotations === 'string' ? JSON.parse(annotations) : annotations;
    }

    await pedalboard.save();

    res.json({ message: "Pedalboard atualizado com sucesso!", pedalboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar pedalboard", detalhes: err.message });
  }
});

app.get('/todos-pedalboards', autenticarToken, async (req, res) => {
  try {
   const pedalboards = await Pedalboard.find()
  .populate('pedais.pedalId')
  .populate('boards.boardId') 
  .populate('usuario', 'nome email');
  
    res.json({ 
      pedalboards: pedalboards.map(p => ({
        ...p.toObject(),
        estilo: Array.isArray(p.estilo) ? p.estilo : (p.estilo ? [p.estilo] : [])
      })) 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      error: "Erro ao buscar todos os pedalboards", 
      detalhes: err.message 
    });
  }
});

app.patch('/pedalboards/:id/verificar', autenticarToken, async (req, res) => {
  try {
    if (!usuariosVerificadores.includes(req.usuario.id)) {
      return res.status(403).json({ error: "Você não tem permissão para verificar este pedalboard" });
    }

    const pedalboard = await Pedalboard.findByIdAndUpdate(
      req.params.id,
      { verified: true },
      { new: true }
    );

    if (!pedalboard) return res.status(404).json({ error: "Pedalboard não encontrado" });

    res.json(pedalboard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao verificar pedalboard", error });
  }
});
app.patch('/pedalboards/:id', autenticarToken, async (req, res) => {
  try {
    const pedalboard = await Pedalboard.findOne({ _id: req.params.id, usuario: req.usuario.id });
    if (!pedalboard) return res.status(404).json({ error: "Pedalboard não encontrado" });

    if (req.body.fundo) pedalboard.fundo = req.body.fundo;
    if (req.body.nome) pedalboard.nome = req.body.nome;
    if (req.body.descricao) pedalboard.descricao = req.body.descricao;

    if (req.body.estilo) {
      pedalboard.estilo = Array.isArray(req.body.estilo) ? req.body.estilo : JSON.parse(req.body.estilo);
    }

    await pedalboard.save();
    res.json({ message: "Pedalboard atualizado!", pedalboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar pedalboard", detalhes: err.message });
  }
});

// excluir pedalboard
app.delete('/pedalboards/:id', autenticarToken, async (req, res) => {
  const id = req.params.id;
  const userId = req.usuario.id;

  try {
    const pedalboard = await Pedalboard.findById(id);

    if (!pedalboard) {
      return res.status(404).json({ error: "Pedalboard não encontrado" });
    }
    if (pedalboard.usuario.toString() !== userId) {
      return res.status(403).json({ error: "Não autorizado" });
    }
    await Pedalboard.findByIdAndDelete(id);

    res.json({ message: "Pedalboard excluído com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir pedalboard", detalhes: err.message });
  }
});
app.get('/pedalboards/:id', autenticarToken, async (req, res) => {
  try {
    const pedalboard = await Pedalboard.findById(req.params.id)
      .populate('usuario', 'nome email')
      .populate('pedais.pedalId', 'imagem nome widthCm heightCm')
      .populate('boards.boardId', 'imagem nome widthCm heightCm');

    if (!pedalboard) return res.status(404).json({ error: "Pedalboard não encontrado" });

    const pedais = (pedalboard.pedais || []).map(p => ({
      id: p._id.toString(),
      pedalId: p.pedalId?._id?.toString() || undefined,
      src: p.pedalId?.imagem || p.src || 'https://placehold.co/200x200?text=Sem+Imagem',
      x: p.x || 0,
      y: p.y || 0,
      rotation: p.rotation || 0,
      zIndex: p.zIndex || 10,
      widthCm: p.pedalId?.widthCm || p.widthCm || 8,
      heightCm: p.pedalId?.heightCm || p.heightCm || 8,
      spec: p.spec || ''
    }));

const boards = (pedalboard.boards || []).map(b => ({
  id: b._id.toString(),
  boardId: b.boardId?._id?.toString() || undefined,
  nome: b.boardId?.nome || "Sem nome",
  src: b.boardId?.imagem || b.src || 'https://placehold.co/300x300?text=Sem+Imagem',
  x: b.x || 0,
  y: b.y || 0,
  rotation: b.rotation || 0,
  zIndex: b.zIndex || 10,
  widthCm: b.boardId?.widthCm || b.widthCm || 30,
  heightCm: b.boardId?.heightCm || b.heightCm || 30
}));

    res.json({
      id: pedalboard._id.toString(),
      nome: pedalboard.nome,
      artista: pedalboard.artista,
      descricao: pedalboard.descricao,
      estilo: Array.isArray(pedalboard.estilo) ? pedalboard.estilo : [pedalboard.estilo || "Outro"],
      categorias: pedalboard.categorias || [],
      pedais,
      boards,
      imagem: pedalboard.imagem || 'https://placehold.co/400x400?text=Sem+Imagem',
      imagemCard: pedalboard.imagemCard || null,
      fundo: pedalboard.fundo || null,
      annotations: pedalboard.annotations || [],
      usuario: {
        id: pedalboard.usuario?._id || null,
        nome: pedalboard.usuario?.nome || "Desconhecido"
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedalboard", detalhes: err.message });
  }
});
// duplica pedalboard
app.post("/pedalboards/duplicar/:id", autenticarToken, async (req, res) => { 
  try {
    const userId = req.usuario.id;
    const { id } = req.params;

    const original = await Pedalboard.findById(id)
      .populate('pedais.pedalId', 'imagem nome widthCm heightCm')
      .populate('boards.boardId', 'imagem nome widthCm heightCm');

    if (!original) return res.status(404).json({ message: "Pedalboard não encontrado." });

    const clone = new Pedalboard({
      nome: original.nome + " (cópia)",
      artista: original.artista,
      descricao: original.descricao,
      estilo: Array.isArray(original.estilo) ? original.estilo : (original.estilo ? [original.estilo] : []),
      usuario: userId,
      pedais: original.pedais
        .filter(p => p.pedalId) 
        .map(p => ({
          pedalId: p.pedalId._id,
          x: p.x,
          y: p.y,
          rotation: p.rotation,
          zIndex: p.zIndex,
          widthCm: p.widthCm,
          heightCm: p.heightCm,
          src: p.src
        })),
      boards: original.boards
        .filter(b => b.boardId) 
        .map(b => ({
          boardId: b.boardId._id,
          x: b.x,
          y: b.y,
          rotation: b.rotation,
          zIndex: b.zIndex,
          widthCm: b.widthCm,
          heightCm: b.heightCm,
          src: b.src
        })),
      imagem: original.imagem,
      imagemCard: original.imagemCard || null,
      fundo: original.fundo || null,
      annotations: original.annotations || []
    });

    await clone.save();

    res.status(201).json({
      message: "Pedalboard adicionado com sucesso!",
      novoId: clone._id
    });
  } catch (err) {
    console.error("Erro ao duplicar pedalboard:", err);
    res.status(500).json({ message: "Erro ao adicionar pedalboard.", detalhes: err.message });
  }
});
// curtir / descurtir
app.post("/pedalboards/:id/curtir", autenticarToken, async (req, res) => {
  try {
    const userId = req.usuario.id;
    const { id } = req.params;

    const pedalboard = await Pedalboard.findById(id);
    if (!pedalboard) return res.status(404).json({ error: "Pedalboard não encontrado" });

    if (!Array.isArray(pedalboard.likes)) pedalboard.likes = [];

    const jaCurtiu = pedalboard.likes.includes(userId);
    if (jaCurtiu) {
      pedalboard.likes = pedalboard.likes.filter(uid => uid.toString() !== userId);
    } else {
      pedalboard.likes.push(userId);
    }

    await pedalboard.save();

    res.json({
      curtido: !jaCurtiu,
      totalLikes: pedalboard.likes.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao curtir/descurtir", detalhes: err.message });
  }
});

app.post('/pedalboards/upload-card', autenticarToken, upload.single('imagemCard'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: "Nenhuma imagem enviada" });
  res.json({ mensagem: "Imagem do card enviada!", path: req.file.path });
});

app.get("/pedalboards/curtidos/:userId", autenticarToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const pedalboardsCurtidos = await Pedalboard.find({ likes: userId })
      .populate("usuario", "nome email")
      .populate("pedais.pedalId", "nome imagem")
      .select("nome artista imagem imagemCard likes verified"); 

    if (!pedalboardsCurtidos.length) {
      return res.status(200).json([]);
    }

    res.status(200).json(pedalboardsCurtidos);
  } catch (err) {
    console.error("Erro ao buscar pedalboards curtidos:", err);
    res.status(500).json({ error: "Erro ao buscar pedalboards curtidos", detalhes: err.message });
  }
});
//campo para atualizações futuras ainda nao usado, mostra pedalboards que o usuario "talvez goste", visando o gosto dos pedalboards.
app.get('/pedalboards/sugeridos/:userId', autenticarToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const curtidos = await Pedalboard.find({ likes: userId });

    if (!curtidos.length) return res.json([]);

    const pedaisCurtidos = new Set();
    let verifiedCurtidos = false;
    const palavrasTitulo = [];

    curtidos.forEach(p => {
      p.pedais.forEach(pedal => pedaisCurtidos.add(pedal.pedalId.toString()));
      if (p.verified) verifiedCurtidos = true;
      palavrasTitulo.push(...p.nome.toLowerCase().split(/\s+/));
    });
    const candidatos = await Pedalboard.find({ _id: { $nin: curtidos.map(p => p._id) } });
    const sugeridos = candidatos.map(board => {
      let score = 0;
      const pedaisComuns = board.pedais.filter(p => pedaisCurtidos.has(p.pedalId.toString()));
      score += pedaisComuns.length * 5;
      if (verifiedCurtidos && board.verified) score += 3;

      const palavrasBoard = board.nome.toLowerCase().split(/\s+/);
      const palavrasComuns = palavrasBoard.filter(p => palavrasTitulo.includes(p));
      score += palavrasComuns.length;

      return { board, score };
    });

    const final = sugeridos
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) 
      .map(s => s.board);

    res.json(final);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar sugestões", detalhes: err.message });
  }
});



// ------------------------ PEDAIS ------------------------

// criar pedal
app.post('/pedais', autenticarToken, upload.single('imagem'), async (req, res) => {
  try {
    const { nome, descricao, categoria, widthCm, heightCm, imagem: imagemUrl } = req.body;
    const imagem = req.file ? req.file.path : imagemUrl || null;

    if (!nome || !imagem) {
      return res.status(400).json({ erro: "Nome e imagem são obrigatórios." });
    }

    const parsedWidth = parseFloat(widthCm);
    const parsedHeight = parseFloat(heightCm);

    const novoPedal = new Pedal({
      nome,
      descricao: descricao || "",
      categoria: categoria || "outros",
      widthCm: !isNaN(parsedWidth) ? parsedWidth : 8,
      heightCm: !isNaN(parsedHeight) ? parsedHeight : 8,
      imagem, 
      usuarioId: req.usuario.id
    });

    await novoPedal.save();

    res.status(201).json({
      message: "Pedal criado com sucesso!",
      pedal: novoPedal
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Erro ao criar pedal",
      detalhes: err.message
    });
  }
});
// lista os pedais do usuario
app.get('/pedais', autenticarToken, async (req, res) => {
  try {
    const pedais = await Pedal.find({ usuarioId: req.usuario.id }).sort({ createdAt: -1 });

    const pedaisComDimensoes = pedais.map(p => ({
      _id: p._id,
      nome: p.nome,
      descricao: p.descricao || "",
      imagem: p.imagem, 
      categoria: p.categoria || "outros",
      usuarioId: p.usuarioId,
      widthCm: p.widthCm || 8,
      heightCm: p.heightCm || 8,
      createdAt: p.createdAt
    }));

    res.json(pedaisComDimensoes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedais", detalhes: err.message });
  }
});

// deletar pedal de um pedalboard
app.delete('/pedalboards/:pedalboardId/pedais/:pedalId', autenticarToken, async (req, res) => {
  const { pedalboardId, pedalId } = req.params;

  try {
    const pedalboard = await Pedalboard.findOne({ _id: pedalboardId, usuario: req.usuario.id });
    if (!pedalboard) return res.status(404).json({ error: "Pedalboard não encontrado" });

    pedalboard.pedais = pedalboard.pedais.filter(id => id.toString() !== pedalId);
    await pedalboard.save();

    res.json({ message: "Pedal removido com sucesso!", pedalboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao remover pedal", detalhes: err.message });
  }
});

app.get("/pedalboards/estilo/:estilo", async (req, res) => {
  try {
    const boards = await Pedalboard.find({ estilo: req.params.estilo });
    res.json(boards);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar pedalboards por estilo." });
  }
});

// verificar pedal
app.patch('/pedais/:id/verificar', autenticarToken, async (req, res) => {
  try {
    if (!usuariosVerificadores.includes(req.usuario.id)) {
      return res.status(403).json({ error: "Você não tem permissão para verificar este pedal" });
    }

    const pedal = await Pedal.findByIdAndUpdate(req.params.id, { verified: true }, { new: true });
    if (!pedal) return res.status(404).json({ error: "Pedal não encontrado" });

    res.json(pedal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao verificar pedal", detalhes: err.message });
  }
});

// deletar pedal
app.delete('/pedais/:id', autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const pedal = await Pedal.findOneAndDelete({ _id: id, usuarioId: req.usuario.id });

    if (!pedal) {
      return res.status(404).json({ error: "Pedal não encontrado ou não pertence a este usuário." });
    }

    res.json({ message: "Pedal excluído com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir pedal", detalhes: err.message });
  }
});
// buscar pedais de todos os usuários 
app.get("/pedais/todos", autenticarToken, async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : "";

    // filtro de pesquisa (categoria/nome)
    const filtro = search
      ? {
          $or: [
            { nome: { $regex: search, $options: "i" } },
            { categoria: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const pedais = await Pedal.find(filtro)
      .populate("usuarioId", "nome email")
      .sort({ createdAt: -1 });

    res.json(pedais);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedais", detalhes: err.message });
  }
});
// pedal existente vai para biblioteca do usuario
app.post("/pedais/copiar/:id", autenticarToken, async (req, res) => {
  try {
    const pedalOriginal = await Pedal.findById(req.params.id);
    if (!pedalOriginal) return res.status(404).json({ error: "Pedal não encontrado" });

    const novoPedal = new Pedal({
      nome: pedalOriginal.nome,
      descricao: pedalOriginal.descricao,
      imagem: pedalOriginal.imagem, 
      categoria: pedalOriginal.categoria,
      widthCm: pedalOriginal.widthCm || 8,
      heightCm: pedalOriginal.heightCm || 8,
      usuarioId: req.usuario.id
    });

    await novoPedal.save();
    res.status(201).json({ message: "Pedal copiado com sucesso!", pedal: novoPedal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao copiar pedal", detalhes: err.message });
  }
});
app.get('/pedais/:id', autenticarToken, async (req, res) => {
  try {
    const pedal = await Pedal.findById(req.params.id);
    if (!pedal) {
      return res.status(404).json({ error: "Pedal não encontrado" });
    }

    res.json({
      _id: pedal._id,
      nome: pedal.nome,
      categoria: pedal.categoria,
      imagem: pedal.imagem, 
      descricao: pedal.descricao,
      widthCm: pedal.widthCm || 8,
      heightCm: pedal.heightCm || 8
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedal", detalhes: err.message });
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  res.json({ src: req.file.path });
});

app.post("/test-upload", upload.single("imagem"), (req, res) => {
  res.json({ url: req.file.path });
});

// ------------------------ CONEXAO COM O MongoDB ------------------------

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado com sucesso!'))
  .catch(err => console.error('❌ Erro ao conectar MongoDB:', err));

// teste
app.get('/', (req, res) => res.send('Servidor rodando!'));

// rodar servidor
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));