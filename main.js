const { app, BrowserWindow, ipcMain } = require('electron');
const { Menu, clipboard, shell, nativeImage, webContents } = require('electron');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

let promptsPath = '';
let dictionaryPath = path.join(__dirname, 'dictionary.json');
let favoritesPath = path.join(__dirname, 'favorites.json');

let translateWindow = null;

function createWindow() {
  const statePath = path.join(app.getPath('userData'), 'window-state.json');
  let state = { width: 1000, height: 800, x: undefined, y: undefined };
  try {
    const data = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed.width && parsed.height) {
      state = { width: parsed.width, height: parsed.height, x: parsed.x, y: parsed.y };
    }
  } catch {}

  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: typeof state.x === 'number' ? state.x : undefined,
    y: typeof state.y === 'number' ? state.y : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    }
  });

  win.setMenuBarVisibility(false);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('close', () => {
    const { width, height, x, y } = win.getBounds();
    try {
      fs.writeFileSync(statePath, JSON.stringify({ width, height, x, y }));
    } catch {}
  });

  ipcMain.on('open-translate-window', (_event, url) => {
    if (translateWindow && !translateWindow.isDestroyed()) {
      translateWindow.loadURL(url);
      translateWindow.focus();
      return;
    }

    translateWindow = new BrowserWindow({
      width: 400,
      height: 300,
      parent: win,
      resizable: true,
      webPreferences: {
        sandbox: false
      }
    });
    translateWindow.loadURL(url);

    translateWindow.on('closed', () => {
      translateWindow = null;
    });
  });

  ipcMain.handle('get-translation-text', async () => {
    if (!translateWindow || translateWindow.isDestroyed()) return '';
    try {
      const result = await translateWindow.webContents.executeJavaScript(`
        (() => {
          const span = document.querySelector('span[jsname="W297wb"]');
          return span ? span.innerText : '';
        })();
      `);
      return result;
    } catch (e) {
      return '';
    }
  });
}

app.whenReady().then(() => {
  // store saved prompts and dictionaries in the project root so users can easily edit them
  promptsPath = path.join(__dirname, 'saved_prompts.json');
  dictionaryPath = path.join(__dirname, 'dictionary.json');
  favoritesPath = path.join(__dirname, 'favorites.json');

  if (!fs.existsSync(promptsPath)) {
    fs.writeFileSync(promptsPath, '[]');
  }
  if (!fs.existsSync(dictionaryPath)) {
    fs.writeFileSync(dictionaryPath, '{}');
  }
  if (!fs.existsSync(favoritesPath)) {
    fs.writeFileSync(favoritesPath, '[]');
  }

  ipcMain.handle('save-prompt', (_event, data) => {
    try {
      let list = [];
      try {
        list = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
        if (!Array.isArray(list)) list = [];
      } catch {}
      list.push({ name: data.name, prompt: data.prompt });
      fs.writeFileSync(promptsPath, JSON.stringify(list, null, 2));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('load-prompts', () => {
    try {
      const list = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('delete-prompt', (_event, name) => {
    try {
      let list = [];
      try {
        list = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
        if (!Array.isArray(list)) list = [];
      } catch {}
      const filtered = list.filter(p => p.name !== name);
      fs.writeFileSync(promptsPath, JSON.stringify(filtered, null, 2));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('load-favorites', () => {
    try {
      const list = JSON.parse(fs.readFileSync(favoritesPath, 'utf8'));
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle('save-favorites', (_event, data) => {
    try {
      if (!Array.isArray(data)) return false;
      fs.writeFileSync(favoritesPath, JSON.stringify(data, null, 2));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('add-dict-entry', (_event, data) => {
    try {
      let dict = {};
      try {
        dict = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
        if (typeof dict !== 'object' || Array.isArray(dict)) dict = {};
      } catch {}
      if (!dict[data.jp]) {
        dict[data.jp] = data.en;
        fs.writeFileSync(dictionaryPath, JSON.stringify(dict, null, 2));
      }
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.on('register-context-menu', (_event, id) => {
    const wc = webContents.fromId(id);
    if (!wc) return;
    wc.removeAllListeners('context-menu');
    wc.on('context-menu', (event, params) => {
      const menuTemplate = [
        {
          label: 'コピー',
          enabled: !!params.selectionText,
          click: () => clipboard.writeText(params.selectionText)
        },
        {
          label: 'ブラウザで開く',
          click: () => shell.openExternal(params.pageURL)
        },
        {
          label: '画像をコピー',
          enabled: !!params.srcURL,
          click: () => copyImage(params.srcURL)
        }
      ];
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: BrowserWindow.fromWebContents(wc) });
    });
  });

  function copyImage(url) {
    if (!url) return;
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const img = nativeImage.createFromBuffer(buffer);
          clipboard.writeImage(img);
        } catch {}
      });
    }).on('error', () => {});
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
