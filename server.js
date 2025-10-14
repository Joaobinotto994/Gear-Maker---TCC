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

    const novoUsuario = new User({ nome, email, senha: hashSenha, telefone, dataNascimento });
    await novoUsuario.save();

    res.status(201).json({ message: "Usuário criado com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Erro ao criar usuário", detalhes: err.message });
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

    res.json({ message: "Login efetuado com sucesso!", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao fazer login", detalhes: err.message });
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

// Listar boards do usuário logado
app.get('/boards', autenticarToken, async (req, res) => {
  try {
    const boards = await Board.find({ usuarioId: req.usuario.id });
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


// ------------------------ Pedalboards ------------------------

// Criar pedalboard
app.post('/pedalboards', autenticarToken, upload.single('imagem'), async (req, res) => {
  try {
    const { nome, descricao, categoria, pedais, boards, artista } = req.body;
    const imagem = req.file ? `/uploads/${req.file.filename}` : null;

    if (!nome || !imagem) {
      return res.status(400).json({ erro: "Nome e imagem são obrigatórios." });
    }

    // Parse JSON apenas se for string
    const pedaisParsed = pedais
      ? (typeof pedais === 'string' ? JSON.parse(pedais) : pedais)
      : [];
    const boardsParsed = boards
      ? (typeof boards === 'string' ? JSON.parse(boards) : boards)
      : [];

    const novoPedalboard = new Pedalboard({
      nome,
      descricao,
      categorias: categoria ? [categoria] : [],
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
      imagem
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
      .populate('pedais');
    res.json({ pedalboards });
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
    .populate('pedais');

    res.json(pedalboards);
  } catch (err) {
    res.status(500).json({ error: "Erro ao pesquisar pedalboards", detalhes: err.message });
  }
});

// PUT /pedalboards/:id - Atualiza pedalboard com ou sem nova imagem
app.put('/pedalboards/:id', autenticarToken, upload.single('imagem'), async (req, res) => {
  const { id } = req.params;
  // Para pedais e boards, podem vir como JSON string no FormData
  let { nome, artista, descricao, pedais, boards } = req.body;

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

    // Atualiza imagem se enviou nova
    if (req.file) {
      pedalboard.imagem = `/uploads/${req.file.filename}`;
    }

    // Parse JSON caso pedais/boards venham como string (FormData envia assim)
    if (pedais && typeof pedais === 'string') pedais = JSON.parse(pedais);
    if (boards && typeof boards === 'string') boards = JSON.parse(boards);

    // Reconstrói array de pedais
if (Array.isArray(pedais)) {
  const newPedais = [];
  for (const p of pedais) {
    const existing = p.id ? pedalboard.pedais.id(p.id) : null;
    if (existing) {
      newPedais.push({
        pedalId: existing.pedalId || undefined,
        src: existing.src || undefined,
        x: p.x || 0,
        y: p.y || 0,
        rotation: p.rotation || 0,
        zIndex: p.zIndex || 10,
        widthCm: p.widthCm || existing.widthCm || 8,
        heightCm: p.heightCm || existing.heightCm || 8
      });
    } else {
      newPedais.push({
        pedalId: p.pedalId || undefined,
        src: p.src ? p.src.replace(/^https?:\/\/localhost:3000/, '') : undefined,
        x: p.x || 0,
        y: p.y || 0,
        rotation: p.rotation || 0,
        zIndex: p.zIndex || 10,
        widthCm: p.widthCm || 8,
        heightCm: p.heightCm || 8
      });
    }
  }
  pedalboard.pedais = newPedais;
}

// Reconstrói array de boards
if (Array.isArray(boards)) {
  const newBoards = [];
  for (const b of boards) {
    const existingB = b.id ? pedalboard.boards.id(b.id) : null;
    if (existingB) {
      newBoards.push({
        boardId: existingB.boardId || undefined,
        src: existingB.src || undefined,
        x: b.x || 0,
        y: b.y || 0,
        rotation: b.rotation || 0,
        zIndex: b.zIndex || 10,
        widthCm: b.widthCm || existingB.widthCm || 30,
        heightCm: b.heightCm || existingB.heightCm || 30
      });
    } else {
      newBoards.push({
        boardId: b.boardId || undefined,
        src: b.src ? b.src.replace(/^https?:\/\/localhost:3000/, '') : undefined,
        x: b.x || 0,
        y: b.y || 0,
        rotation: b.rotation || 0,
        zIndex: b.zIndex || 10,
        widthCm: b.widthCm || 30,
        heightCm: b.heightCm || 30
      });
    }
  }
  pedalboard.boards = newBoards;
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
    res.json({ pedalboards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar todos os pedalboards", detalhes: err.message });
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
      heightCm: p.pedalId?.heightCm || p.heightCm || 8
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
      categorias: pedalboard.categorias || [],
      pedais,
      boards,
      imagem: pedalboard.imagem || '/uploads/imagem-placeholder.png'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedalboard", detalhes: err.message });
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
app.get('/pedalboards/:id', autenticarToken, async (req, res) => {
  try {
    const pedalboard = await Pedalboard.findById(req.params.id)
      .populate('pedais.pedalId')
      .populate('boards.boardId');

    if (!pedalboard) return res.status(404).json({ error: "Pedalboard não encontrado" });

    const pedais = (pedalboard.pedais || []).map(p => ({
      src: p.pedalId?.imagem
        ? `/uploads/${p.pedalId.imagem.split('/').pop()}`
        : '/uploads/imagem-placeholder.png',
      x: p.x || 0,
      y: p.y || 0,
      rotation: p.rotation || 0,
      widthCm: p.widthCm || p.pedalId?.widthCm || 8,
      heightCm: p.heightCm || p.pedalId?.heightCm || 8,
      pedalId: p.pedalId?._id || null
    }));

    const boards = (pedalboard.boards || []).map(b => ({
      src: b.boardId?.imagem
        ? `/uploads/${b.boardId.imagem.split('/').pop()}`
        : '/uploads/imagem-placeholder.png',
      x: b.x || 0,
      y: b.y || 0,
      rotation: b.rotation || 0,
      widthCm: b.widthCm || b.boardId?.widthCm || 8,
      heightCm: b.heightCm || b.boardId?.heightCm || 8,
      boardId: b.boardId?._id || null
    }));

    res.json({
      nome: pedalboard.nome,
      artista: pedalboard.artista,
      descricao: pedalboard.descricao,
      pedais,
      boards
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedalboard", detalhes: err.message });
  }
});
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