const { BrowserWindow, screen } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createMainWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.floor(Math.min(Math.max(sw * 0.85, 1280), 1600));
  const h = Math.floor(Math.min(Math.max(sh * 0.85, 720), 1000));
  const win = new BrowserWindow({
    width: w, height: h, minWidth: 1100, minHeight: 680, center: true,
    title: 'Gold Client', frame: false, backgroundColor: '#111111', show: false,
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      enableRemoteModule: false, webSecurity: true, sandbox: false,
    },
  });
  if (isDev) { win.loadURL('http://localhost:3000'); win.webContents.openDevTools({ mode: 'detach' }); }
  else { win.loadFile(path.join(__dirname, '../../dist/index.html')); }
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.on('maximize', () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));
  win.webContents.setWindowOpenHandler(({ url }) => { require('electron').shell.openExternal(url); return { action: 'deny' }; });
  return win;
}
module.exports = { createMainWindow };
