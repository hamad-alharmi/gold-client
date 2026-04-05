const logger = require('../utils/logger');
const { launchGame, killGame, getRunningInstances } = require('../core/minecraft/GameLauncher');
const { getAvailableVersions, getFabricVersions } = require('../core/minecraft/VersionManager');
const { getInstance, recordPlaySession } = require('../core/instances/InstanceManager');

const sessionStarts = new Map();

function register(ipcMain, store) {
  ipcMain.handle('launcher:launch', async (event, instanceId) => {
    const instance = getInstance(store, instanceId);
    if (!instance) throw new Error(`Instance "${instanceId}" not found`);
    const auth = store.get('auth');
    const settings = store.get('settings');
    if (!auth?.username) throw new Error('You must be logged in to launch Minecraft.');
    sessionStarts.set(instanceId, Date.now());
    await launchGame(instance, auth, settings, {
      onProgress: (data) => global.mainWindow?.webContents.send('launcher:progress', { instanceId, ...data }),
      onLog: (line) => global.mainWindow?.webContents.send('launcher:log', { instanceId, line }),
      onStart: () => {
        global.mainWindow?.webContents.send('launcher:game-start', { instanceId });
        if (settings.closeOnLaunch) global.mainWindow?.minimize();
      },
      onClose: async (code) => {
        const start = sessionStarts.get(instanceId);
        if (start) { await recordPlaySession(store, instanceId, Math.floor((Date.now()-start)/1000)).catch(()=>{}); sessionStarts.delete(instanceId); }
        global.mainWindow?.webContents.send('launcher:game-close', { instanceId, code });
        if (settings.closeOnLaunch) { global.mainWindow?.show(); global.mainWindow?.restore(); }
      },
    });
  });
  ipcMain.handle('launcher:kill',          async (_, id) => killGame(id));
  ipcMain.handle('launcher:get-status',    () => getRunningInstances());
  ipcMain.handle('launcher:get-versions',  async (_, f) => getAvailableVersions(f || {}));
  ipcMain.handle('launcher:get-mod-loaders', async (_, v) => {
    const fabric = await getFabricVersions(v);
    return { fabric: fabric.slice(0,10).map(f => ({ version: f.loader.version, stable: f.loader.stable })), forge: [] };
  });
}

module.exports = { register };
