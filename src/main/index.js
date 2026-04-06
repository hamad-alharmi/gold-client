const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { createMainWindow } = require('./window');
const logger = require('./utils/logger');
const { initPaths } = require('./utils/paths');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

const authHandlers     = require('./ipc/auth');
const instanceHandlers = require('./ipc/instances');
const launcherHandlers = require('./ipc/launcher');
const modHandlers      = require('./ipc/mods');
const settingsHandlers = require('./ipc/settings');

const store = new Store({
  schema: {
    auth:     { type: 'object', properties: { type:{type:'string',default:'offline'}, username:{type:'string',default:''}, uuid:{type:'string',default:''}, accessToken:{type:'string',default:''} } },
    settings: { type: 'object', properties: { ram:{type:'number',default:2048}, javaPath:{type:'string',default:''}, resolution:{type:'object',default:{width:1280,height:720}}, jvmArgs:{type:'string',default:''}, closeOnLaunch:{type:'boolean',default:false}, performanceMode:{type:'boolean',default:true}, showConsole:{type:'boolean',default:false}, discordRPC:{type:'boolean',default:true}, autoUpdate:{type:'boolean',default:true}, theme:{type:'string',default:'dark'} } },
    instances:   { type: 'array',  default: [] },
    lastVersion: { type: 'string', default: '' },
  },
});

global.store = store;
global.mainWindow = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (global.mainWindow) { if (global.mainWindow.isMinimized()) global.mainWindow.restore(); global.mainWindow.focus(); }
  });
}

app.whenReady().then(async () => {
  logger.info('Gold Client starting up...');
  await initPaths();
  global.mainWindow = createMainWindow();

  authHandlers.register(ipcMain, store);
  instanceHandlers.register(ipcMain, store);
  launcherHandlers.register(ipcMain, store);
  modHandlers.register(ipcMain, store);
  settingsHandlers.register(ipcMain, store);

  ipcMain.handle('app:get-version',          ()      => app.getVersion());
  ipcMain.handle('app:get-path',             (_, n)  => app.getPath(n));
  ipcMain.handle('app:show-item-in-folder',  (_, p)  => shell.showItemInFolder(p));
  ipcMain.handle('app:open-external',        (_, u)  => shell.openExternal(u));
  ipcMain.handle('app:quit',                 ()      => app.quit());
  ipcMain.handle('app:minimize',             ()      => global.mainWindow?.minimize());
  ipcMain.handle('app:maximize',             ()      => global.mainWindow?.isMaximized() ? global.mainWindow.unmaximize() : global.mainWindow?.maximize());
  ipcMain.handle('dialog:open-file',         async (_, o) => dialog.showOpenDialog(global.mainWindow, o));
  ipcMain.handle('dialog:open-directory',    async (_, o) => dialog.showOpenDialog(global.mainWindow, { ...o, properties: ['openDirectory'] }));

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    autoUpdater.on('update-available',  (i) => global.mainWindow?.webContents.send('updater:update-available', i));
    autoUpdater.on('update-downloaded', (i) => global.mainWindow?.webContents.send('updater:update-downloaded', i));
    autoUpdater.on('download-progress', (p) => global.mainWindow?.webContents.send('updater:download-progress', p));
    ipcMain.handle('updater:install-update', () => autoUpdater.quitAndInstall());
  }

  logger.info('Gold Client initialized');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) global.mainWindow = createMainWindow(); });
app.on('before-quit', () => logger.info('Gold Client shutting down...'));
