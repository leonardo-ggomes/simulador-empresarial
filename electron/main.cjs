/**
 * Processo principal do Electron - Aurora Business Lab
 * Sobe o servidor Express/Socket.IO embutido e abre a janela apontando para ele.
 * O servidor escuta em 0.0.0.0 para que os alunos acessem pela rede local.
 */
const { app, BrowserWindow, Menu, shell, dialog, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { pathToFileURL } = require('node:url');

const PORTA_PADRAO = Number(process.env.PORT) || 3000;
let mainWindow = null;
let httpServer = null;
let porta = PORTA_PADRAO;

// Evita duas instâncias disputando o mesmo banco/porta
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function enderecosRede() {
  const lista = [];
  for (const itens of Object.values(os.networkInterfaces())) {
    for (const i of itens || []) {
      if (i.family === 'IPv4' && !i.internal) lista.push(i.address);
    }
  }
  return lista;
}

function portaLivre(p) {
  return new Promise((resolve) => {
    const t = net.createServer();
    t.once('error', () => resolve(false));
    t.once('listening', () => t.close(() => resolve(true)));
    t.listen(p, '0.0.0.0');
  });
}

async function escolherPorta() {
  if (await portaLivre(PORTA_PADRAO)) return PORTA_PADRAO;
  for (let p = PORTA_PADRAO + 1; p < PORTA_PADRAO + 50; p++) {
    if (await portaLivre(p)) return p;
  }
  return 0; // deixa o SO escolher
}

/** Segredo de sessão persistente (gerado uma vez por instalação) */
function carregarSegredo(dir) {
  const arq = path.join(dir, 'session.secret');
  try {
    return fs.readFileSync(arq, 'utf8').trim();
  } catch {
    const segredo = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(arq, segredo, { mode: 0o600 });
    return segredo;
  }
}

async function iniciarServidor() {
  const dados = app.getPath('userData');
  fs.mkdirSync(dados, { recursive: true });

  process.env.AURORA_DB_PATH = process.env.AURORA_DB_PATH || path.join(dados, 'aurora.sqlite');
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || carregarSegredo(dados);
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';

  const raiz = app.getAppPath();
  const { createApp } = await import(pathToFileURL(path.join(raiz, 'src', 'server.js')).href);
  const { server } = createApp();
  httpServer = server;

  porta = await escolherPorta();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(porta, '0.0.0.0', () => {
      porta = server.address().port;
      resolve();
    });
  });
  console.log(`Aurora Business Lab em http://localhost:${porta} | dados: ${dados}`);
}

function mostrarEnderecoAlunos() {
  const ips = enderecosRede();
  const urls = ips.map((ip) => `http://${ip}:${porta}`);
  const texto = urls.length
    ? `Alunos na mesma rede (Wi-Fi/LAN) acessam por:\n\n${urls.join('\n')}`
    : 'Nenhuma rede detectada. Conecte-se a uma rede para que os alunos acessem.';
  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      title: 'Endereço para os alunos',
      message: 'Endereço para os alunos',
      detail: texto + '\n\nSe o Firewall do Windows perguntar, permita o acesso em redes privadas.',
      buttons: urls.length ? ['Copiar endereço', 'Fechar'] : ['Fechar'],
      defaultId: 0,
      cancelId: urls.length ? 1 : 0,
    })
    .then((r) => {
      if (urls.length && r.response === 0) clipboard.writeText(urls[0]);
    });
}

function criarMenu() {
  const modelo = [
    {
      label: 'Aurora',
      submenu: [
        { label: 'Endereço para os alunos…', accelerator: 'CmdOrCtrl+E', click: mostrarEnderecoAlunos },
        { label: 'Abrir pasta de dados', click: () => shell.openPath(app.getPath('userData')) },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
        { role: 'resetZoom', label: 'Zoom padrão' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Diminuir zoom' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
}

function criarJanela() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b1020',
    title: 'Aurora Business Lab',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://localhost:${porta}`);

  // Links externos abrem no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${porta}`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  try {
    await iniciarServidor();
    criarMenu();
    criarJanela();
  } catch (err) {
    console.error(err);
    dialog.showErrorBox('Aurora Business Lab', `Falha ao iniciar o servidor:\n\n${err.stack || err}`);
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow && httpServer) criarJanela();
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', () => {
  try { httpServer?.close(); } catch { /* ignora */ }
});
