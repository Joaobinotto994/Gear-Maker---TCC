const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 
const cors = require('cors');
const path = require('path'); // ← adicionado
const multer = require('multer'); // ← ADICIONE ISSO AQUI

// Configuração do armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // pasta onde os arquivos serão salvos
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext);
  }
});

const upload = multer({ storage });
const app = express();
const PORT = 3000;

// Models
const User = require('./models/User');
const Pedal = require('./models/Pedal'); 
const Pedalboard = require('./models/Pedalboard');
const Board = require('./models/Board');
// Lista de IDs ou emails permitidos a verificar
const usuariosVerificadores = [
  "68f2ac44a5bc316f26869a43"
];

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Middleware de autenticação JWT
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Acesso negado. Token não fornecido." });

  try {
    const usuario = jwt.verify(token, "segredo_do_token_aqui");
    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido ou expirado" });
  }
}

// ------------------------ Usuários ------------------------

// Registro
app.post('/register', async (req, res) => {
  try {
    const { nome, email, senha, telefone, dataNascimento } = req.body;
    const hashSenha = await bcrypt.hash(senha, 10);

   const novoUsuario = new User({ 
  nome, email, senha: hashSenha, telefone, dataNascimento,
  avatar: req.body.avatar || undefined // usa default se não enviado
});
    await novoUsuario.save();

    res.status(201).json({ message: "Usuário criado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Erro ao criar usuário", detalhes: err.message });
  }
});
// Listar todos os usuários (apenas para testes)
app.get('/usuarios', async (req, res) => {
  try {
   const usuarios = await User.find({}, '_id nome email avatar'); // só pega _id, nome e email
    res.json(usuarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar usuários", detalhes: err.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const usuario = await User.findOne({ email });
    if (!usuario) return res.status(400).json({ error: "Usuário não encontrado" });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(400).json({ error: "Senha incorreta" });

    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, nome: usuario.nome },
      "segredo_do_token_aqui",
      { expiresIn: "1h" }
    );

    // ✅ Retorna token + dados do usuário
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

    const decoded = jwt.verify(token, "segredo_do_token_aqui");
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

    const decoded = jwt.verify(token, "segredo_do_token_aqui");
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
// Rota para pegar dados do usuário logado
app.get('/usuarios/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token não fornecido" });

    const decoded = jwt.verify(token, "segredo_do_token_aqui");
    const usuario = await User.findById(decoded.id);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });

    // Retorna os dados do usuário incluindo avatar
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
// ------------------------ Boards ------------------------

// Criar novo board
// Criar Board
app.post('/boards', autenticarToken, upload.single('imagem'), async (req, res) => {
  try {
    const { nome, widthCm, heightCm } = req.body;
    const imagem = req.file ? `/uploads/${req.file.filename}` : null;

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
// Listar todos os boards (de todos os usuários) com filtro de busca
app.get('/boards/todos', autenticarToken, async (req, res) => {
  try {
    const search = req.query.search || "";

    // 🔍 Busca em todos os boards (sem filtrar por usuário)
    const boards = await Board.find({
      nome: { $regex: search, $options: "i" } // busca parcial e case-insensitive
    }).populate("usuarioId", "nome email"); // opcional: exibe nome/email do criador

    res.json(boards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar boards" });
  }
});

// DELETE /boards/:id → excluir um board
app.delete('/boards/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.usuario.id;

  try {
    // Busca o board pelo ID e usuário
    const board = await Board.findById(id);

    if (!board) {
      return res.status(404).json({ error: "Board não encontrado" });
    }

    // Garante que o board pertence ao usuário logado
    if (board.usuarioId.toString() !== userId) {
      return res.status(403).json({ error: "Não autorizado a deletar este board" });
    }

    // Remove o board
    await Board.findByIdAndDelete(id);

    res.json({ message: "Board excluído com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir board", detalhes: err.message });
  }
});

// Listar boards do usuário logado (com filtro de busca)
app.get('/boards', autenticarToken, async (req, res) => {
  try {
    const search = req.query.search || "";

    // 🔍 Busca boards do usuário logado que combinem com o nome digitado
    const boards = await Board.find({
      usuarioId: req.usuario.id,
      nome: { $regex: search, $options: "i" } // busca parcial e case-insensitive
    });

    res.json(boards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar boards" });
  }
});
// Copiar um board existente para a biblioteca do usuário logado
app.post("/boards/copiar/:id", autenticarToken, async (req, res) => {
  try {
    const boardOriginal = await Board.findById(req.params.id);
    if (!boardOriginal) return res.status(404).json({ error: "Board não encontrado" });

    // Cria uma cópia associada ao usuário logado
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
// GET /boards/:id - retorna um board específico do usuário logado
app.get('/boards/:id', autenticarToken, async (req, res) => {
  try {
    const board = await Board.findOne({ _id: req.params.id, usuarioId: req.usuario.id });

    if (!board) {
      return res.status(404).json({ error: "Board não encontrado" });
    }

    // Retorna apenas os campos necessários para o card
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

// ------------------------ Pedalboards ------------------------

// Criar pedalboard com imagemCard
const uploadFields = upload.fields([
  { name: 'imagem', maxCount: 1 },
  { name: 'imagemCard', maxCount: 1 } // adiciona o card
]);

app.post('/pedalboards', autenticarToken, uploadFields, async (req, res) => {
  try {
      const { nome, descricao, categoria, pedais, boards, artista, annotations, estilo } = req.body; // <-- adiciona estilo


    // Pega os arquivos enviados
    let imagem = req.files?.imagem ? `/uploads/${req.files.imagem[0].filename}` : req.body.imagem || null;
    let imagemCard = req.files?.imagemCard ? `/uploads/${req.files.imagemCard[0].filename}` : req.body.imagemCard || null;
    let fundo = req.files?.fundo ? `/uploads/${req.files.fundo[0].filename}` : req.body.fundo || null; // <-- ADICIONE AQUI

    if (!nome || !imagem) {
      return res.status(400).json({ erro: "Nome e imagem principal são obrigatórios." });
    }

    // Parse JSON apenas se for string
    const pedaisParsed = pedais ? (typeof pedais === 'string' ? JSON.parse(pedais) : pedais) : [];
    const boardsParsed = boards ? (typeof boards === 'string' ? JSON.parse(boards) : boards) : [];
    const estilosSelecionados = typeof estilo === 'string' ? JSON.parse(estilo) : estilo;

const novoPedalboard = new Pedalboard({
    nome,
    descricao,
    categorias: categoria ? [categoria] : [],
    estilo: estilosSelecionados, // agora salva como array
    pedais: pedaisParsed.map(p => ({
        pedalId: p.pedalId,
        x: p.x || 0,
        y: p.y || 0,
        rotation: p.rotation || 0,
        zIndex: p.zIndex || 10,
        src: p.src || '/uploads/imagem-placeholder.png',
        widthCm: p.widthCm || 8,
        heightCm: p.heightCm || 8
    })),
    boards: boardsParsed.map(b => ({
        boardId: b.boardId,
        x: b.x || 0,
        y: b.y || 0,
        rotation: b.rotation || 0,
        zIndex: b.zIndex || 10,
        src: b.src || '/uploads/imagem-placeholder.png',
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
// Listar pedalboards do usuário logado
app.get('/meus-pedalboards', autenticarToken, async (req, res) => {
  try {
    const pedalboards = await Pedalboard.find({ usuario: req.usuario.id })
      .populate('pedais')
      .populate('usuario', 'nome email')
      .select("+curtidas"); // 👈 inclui curtidas se o campo for oculto por padrão

    // 🔹 Garante que o campo "estilo" seja sempre retornado
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


// Buscar todos os pedalboards (para pesquisa)
app.get("/pedalboards/search", autenticarToken, async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Informe um termo de pesquisa" });

    const pedalboards = await Pedalboard.find({
      nome: { $regex: q, $options: "i" }
    })
      .populate("usuario", "nome email")
      .populate("pedais")
      .select("+curtidas"); // 👈 adiciona campo curtidas, caso ele esteja oculto

    res.json(pedalboards);
  } catch (err) {
    res.status(500).json({ error: "Erro ao pesquisar pedalboards", detalhes: err.message });
  }
});

// PUT /pedalboards/:id - Atualiza pedalboard com ou sem nova imagem
app.put('/pedalboards/:id', autenticarToken, uploadFields, async (req, res) => {
  const { id } = req.params;
  let { nome, artista, descricao, pedais, boards, annotations, estilo } = req.body;

  try {
    const pedalboard = await Pedalboard.findById(id);
    if (!pedalboard) return res.status(404).json({ error: "Pedalboard não encontrado" });

    if (pedalboard.usuario.toString() !== req.usuario.id) {
      return res.status(403).json({ error: "Não autorizado" });
    }

    // Atualiza campos principais
    pedalboard.nome = nome || pedalboard.nome;
    pedalboard.artista = artista || pedalboard.artista;
    pedalboard.descricao = descricao || pedalboard.descricao;

    // 🔹 Garante que estilo seja sempre array
    if (estilo) {
      pedalboard.estilo = Array.isArray(estilo) ? estilo : JSON.parse(estilo);
    }

    // Atualiza imagens principais
    if (req.files?.imagem) pedalboard.imagem = `/uploads/${req.files.imagem[0].filename}`;
    else if (req.body.imagem) pedalboard.imagem = req.body.imagem;

    if (req.files?.imagemCard) pedalboard.imagemCard = `/uploads/${req.files.imagemCard[0].filename}`;
    else if (req.body.imagemCard) pedalboard.imagemCard = req.body.imagemCard;

    if (req.files?.fundo) pedalboard.fundo = `/uploads/${req.files.fundo[0].filename}`;
    else if (req.body.fundo) pedalboard.fundo = req.body.fundo;

    // Parse JSON caso pedais/boards venham como string
    if (pedais && typeof pedais === 'string') pedais = JSON.parse(pedais);
    if (boards && typeof boards === 'string') boards = JSON.parse(boards);

    // Reconstrói array de pedais (com spec)
    if (Array.isArray(pedais)) {
      pedalboard.pedais = pedais.map(p => {
        const existing = p.id ? pedalboard.pedais.id(p.id) : null;
        return {
          pedalId: existing?.pedalId || p.pedalId || undefined,
          src: existing?.src || p.src || '/uploads/imagem-placeholder.png',
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

    // Reconstrói array de boards
    if (Array.isArray(boards)) {
      pedalboard.boards = boards.map(b => {
        const existingB = b.id ? pedalboard.boards.id(b.id) : null;
        return {
          boardId: existingB?.boardId || b.boardId || undefined,
          src: existingB?.src || b.src || '/uploads/imagem-placeholder.png',
          x: b.x || 0,
          y: b.y || 0,
          rotation: b.rotation || 0,
          zIndex: b.zIndex || 10,
          widthCm: b.widthCm || existingB?.widthCm || 30,
          heightCm: b.heightCm || existingB?.heightCm || 30
        };
      });
    }

    // Atualiza anotações
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

// Listar todos os pedalboards de todos os usuários
app.get('/todos-pedalboards', autenticarToken, async (req, res) => {
  try {
    const pedalboards = await Pedalboard.find()
      .populate('pedais')
      .populate('usuario', 'nome email');

    // 👇 Inclui o campo estilo (caso não exista, retorna null)
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
    // Checa se o usuário logado está na lista de verificadores
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

    // 🔹 Garante que estilo seja sempre array
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

// DELETE /pedalboards/:id → excluir pedalboard
app.delete('/pedalboards/:id', autenticarToken, async (req, res) => {
  const id = req.params.id;
  const userId = req.usuario.id;

  try {
    // busca pelo pedalboard
    const pedalboard = await Pedalboard.findById(id);

    if (!pedalboard) {
      return res.status(404).json({ error: "Pedalboard não encontrado" });
    }

    // garante que o usuário dono é o mesmo logado
    if (pedalboard.usuario.toString() !== userId) {
      return res.status(403).json({ error: "Não autorizado" });
    }

    // exclui o pedalboard
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
  src: p.pedalId?.imagem || p.src || '/uploads/imagem-placeholder.png',
  x: p.x || 0,
  y: p.y || 0,
  rotation: p.rotation || 0,
  zIndex: p.zIndex || 10,
  widthCm: p.pedalId?.widthCm || p.widthCm || 8,
  heightCm: p.pedalId?.heightCm || p.heightCm || 8,
  spec: p.spec || '' // 👈 adiciona aqui
}));

    const boards = (pedalboard.boards || []).map(b => ({
      id: b._id.toString(),
      boardId: b.boardId?._id?.toString() || undefined,
      src: b.boardId?.imagem || b.src || '/uploads/imagem-placeholder.png',
      x: b.x || 0,
      y: b.y || 0,
      rotation: b.rotation || 0,
      zIndex: b.zIndex || 10,
      widthCm: b.boardId?.widthCm || b.widthCm || 30,  // exemplo default board
      heightCm: b.boardId?.heightCm || b.heightCm || 30
    }));

res.json({
  id: pedalboard._id.toString(),
  nome: pedalboard.nome,
  artista: pedalboard.artista,
  descricao: pedalboard.descricao,
  estilo: Array.isArray(pedalboard.estilo) ? pedalboard.estilo : [pedalboard.estilo || "Outro"], // <-- adiciona aqui
  categorias: pedalboard.categorias || [],
  pedais,
  boards,
  imagem: pedalboard.imagem || '/uploads/imagem-placeholder.png',
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
app.get('/pedalboards', autenticarToken, async (req, res) => {
  try {
    const pedalboards = await Pedalboard.find()
      .populate('pedais')
      .populate('usuario', 'nome email')
      .select("+estilo"); // 👈 garante que o campo estilo seja incluído mesmo se tiver select:false no schema

    res.json({
      pedalboards: pedalboards.map(p => ({
        ...p.toObject(),
      estilo: Array.isArray(p.estilo) ? p.estilo : (p.estilo ? [p.estilo] : [])
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Erro ao buscar pedalboards",
      detalhes: err.message
    });
  }
});

// DUPLICAR PEDALBOARD
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
      pedais: original.pedais.map(p => ({
        pedalId: p.pedalId._id,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        zIndex: p.zIndex,
        widthCm: p.widthCm,
        heightCm: p.heightCm,
        src: p.src
      })),
      boards: original.boards.map(b => ({
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
      annotations: original.annotations || [] // ← copiando as annotations
    });

    await clone.save();

    res.status(201).json({
      message: "Pedalboard adicionado com sucesso!",
      novoId: clone._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao adicionar pedalboard." });
  }
});
// Curtir / Descurtir pedalboard
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
    res.json({ mensagem: "Imagem do card enviada!", path: `/uploads/${req.file.filename}` });
});
// Curtir pedalboard

// Listar pedalboards curtidos por um usuário
app.get("/pedalboards/curtidos/:userId", autenticarToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // busca pedalboards onde o array "likes" contém o ID do usuário
    const pedalboardsCurtidos = await Pedalboard.find({ likes: userId })
      .populate("usuario", "nome email")
      .populate("pedais.pedalId", "nome imagem")
      .select("nome artista imagem imagemCard likes verified"); // <-- adicionei verified

    if (!pedalboardsCurtidos.length) {
      return res.status(200).json([]); // retorna vazio se o usuário não curtiu nada
    }

    res.status(200).json(pedalboardsCurtidos);
  } catch (err) {
    console.error("Erro ao buscar pedalboards curtidos:", err);
    res.status(500).json({ error: "Erro ao buscar pedalboards curtidos", detalhes: err.message });
  }
});
// GET /pedalboards/sugeridos/:userId
// GET /pedalboards/sugeridos/:userId
app.get('/pedalboards/sugeridos/:userId', autenticarToken, async (req, res) => {
  try {
    const userId = req.params.userId;

    // 1️⃣ Busca todos os pedalboards curtidos pelo usuário
    const curtidos = await Pedalboard.find({ likes: userId });

    if (!curtidos.length) return res.json([]);

    // 2️⃣ Coletar informações do usuário
    const pedaisCurtidos = new Set();
    let verifiedCurtidos = false;
    const palavrasTitulo = [];

    curtidos.forEach(p => {
      p.pedais.forEach(pedal => pedaisCurtidos.add(pedal.pedalId.toString()));
      if (p.verified) verifiedCurtidos = true;
      palavrasTitulo.push(...p.nome.toLowerCase().split(/\s+/));
    });

    // 3️⃣ Buscar possíveis sugestões (excluindo já curtidos)
    const candidatos = await Pedalboard.find({ _id: { $nin: curtidos.map(p => p._id) } });

    // 4️⃣ Calcular pontuação de relevância
    const sugeridos = candidatos.map(board => {
      let score = 0;

      // Pedais em comum → +5 pontos cada
      const pedaisComuns = board.pedais.filter(p => pedaisCurtidos.has(p.pedalId.toString()));
      score += pedaisComuns.length * 5;

      // Verificado → +3 pontos se usuário curtiu algum verificado
      if (verifiedCurtidos && board.verified) score += 3;

      // Palavras do título → +1 ponto por palavra em comum
      const palavrasBoard = board.nome.toLowerCase().split(/\s+/);
      const palavrasComuns = palavrasBoard.filter(p => palavrasTitulo.includes(p));
      score += palavrasComuns.length;

      return { board, score };
    });

    // 5️⃣ Filtrar apenas os que têm score > 0 e ordenar por pontuação
    const final = sugeridos
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // limite de 20 sugestões
      .map(s => s.board);

    res.json(final);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar sugestões", detalhes: err.message });
  }
});

// ------------------------ Pedais ------------------------

// Criar Pedal
app.post('/pedais', autenticarToken, upload.single('imagem'), async (req, res) => {
  try {
    const { nome, descricao, categoria, widthCm, heightCm } = req.body;

    // 🧩 Ajuste 1: também aceitar imagem via URL (quando o front não envia arquivo)
    const imagem = req.file
      ? `/uploads/${req.file.filename}`
      : req.body.imagem || null;

    if (!nome || !imagem) {
      return res.status(400).json({ erro: "Nome e imagem são obrigatórios." });
    }

    // 🧩 Ajuste 2: garantir que widthCm e heightCm sejam números válidos
    const parsedWidth = parseFloat(widthCm);
    const parsedHeight = parseFloat(heightCm);

    const novoPedal = new Pedal({
      nome,
      descricao,
      imagem,
      categoria,
      widthCm: !isNaN(parsedWidth) ? parsedWidth : 8,  // valor padrão se não vier
      heightCm: !isNaN(parsedHeight) ? parsedHeight : 8,
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


// Listar todos os pedais do usuário logado
app.get('/pedais', autenticarToken, async (req, res) => {
  try {
    const pedais = await Pedal.find({ usuarioId: req.usuario.id });

    // 🔧 Garante que todos os pedais tenham widthCm e heightCm válidos (nunca undefined)
    const pedaisComDimensoes = pedais.map(p => ({
      _id: p._id,
      nome: p.nome,
      descricao: p.descricao,
      imagem: p.imagem,
      categoria: p.categoria,
      usuarioId: p.usuarioId,
      widthCm: p.widthCm || 8,   // valor padrão caso não venha do banco
      heightCm: p.heightCm || 8,
      createdAt: p.createdAt
    }));

    res.json(pedaisComDimensoes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedais", detalhes: err.message });
  }
});


// Listar pedais de um pedalboard específico

// Remover pedal de um pedalboard
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

// Verificar Pedal
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

// Deletar pedal
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
// Buscar pedais de todos os usuários (com filtro opcional por nome)
app.get("/pedais/todos", autenticarToken, async (req, res) => {
  try {
    const search = req.query.search ? req.query.search.trim() : "";

    // Busca pedais por nome (case-insensitive)
    const filtro = search
      ? { nome: { $regex: search, $options: "i" } }
      : {};

    const pedais = await Pedal.find(filtro)
      .populate("usuarioId", "nome email") // para mostrar o criador
      .sort({ createdAt: -1 });

    res.json(pedais);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedais", detalhes: err.message });
  }
});

// Copiar um pedal existente para a biblioteca do usuário logado
app.post("/pedais/copiar/:id", autenticarToken, async (req, res) => {
  try {
    const pedalOriginal = await Pedal.findById(req.params.id);
    if (!pedalOriginal) return res.status(404).json({ error: "Pedal não encontrado" });

    // Cria uma cópia associada ao novo usuário
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
    const pedal = await Pedal.findById(req.params.id); // sem filtro por usuarioId

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

  // Caminho que vamos salvar no banco
  const filePath = `/uploads/${req.file.filename}`;

  res.json({ src: filePath });
});

// ------------------------ Conexão MongoDB ------------------------

const uri = "mongodb+srv://jbinotto36_db_user:a1b2c3@meupedalboardcluster.rliwxam.mongodb.net/meuPedalboardDB?retryWrites=true&w=majority";
mongoose.connect(uri)
  .then(() => console.log('MongoDB conectado com sucesso!'))
  .catch(err => console.log('Erro ao conectar MongoDB:', err));

// Rota de teste
app.get('/', (req, res) => res.send('Servidor rodando!'));

// Rodar servidor
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));