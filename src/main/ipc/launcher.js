/**
 * Gold Client — Launcher IPC Handlers
 * Bridges renderer launch requests to the GameLauncher core.
 * Also handles token refresh before launch if needed.
 */

const logger = require('../utils/logger');
const { launchGame, killGame, getRunningInstances } = require('../core/minecraft/GameLauncher');
const { getAvailableVersions, getFabricVersions }   = require('../core/minecraft/VersionManager');
const { getInstance, recordPlaySession }            = require('../core/instances/InstanceManager');
const { refreshMicrosoftSession }                   = require('../core/auth/MicrosoftAuth');

const sessionStarts = new Map();
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if < 5 min remaining

function register(ipcMain, store) {

  // ── Launch ────────────────────────────────────────────────────────────
  ipcMain.handle('launcher:launch', async (event, instanceId) => {
    const instance = getInstance(store, instanceId);
    if (!instance) throw new Error(`Instance "${instanceId}" not found.`);

    let   auth     = store.get('auth');
    const settings = store.get('settings', {});

    if (!auth?.username) throw new Error('You must be logged in to launch Minecraft.');

    // Auto-refresh Microsoft token if it’s near expiry
    if (auth.type === 'microsoft' && auth.expiresAt) {
      const msLeft = auth.expiresAt - Date.now();
      if (msLeft < TOKEN_REFRESH_BUFFER_MS) {
        try {
          logger.info('MS token nearing expiry, refreshing...');
          auth = await refreshMicrosoftSession(auth.refreshToken);
          store.set('auth', auth);
          global.mainWindow?.webContents.send('auth:token-refreshed', auth);
        } catch (err) {
          logger.error(`Token refresh failed: ${err.message}`);
          store.set('auth', { type: 'offline', username: '', uuid: '', accessToken: '', refreshToken: '' });
          global.mainWindow?.webContents.send('auth:session-expired');
          throw new Error('Your Microsoft session has expired. Please log in again.');
        }
      }
    }

    sessionStarts.set(instanceId, Date.now());

    try {
      await launchGame(instance, auth, settings, {
        onProgress: (data) => {
          global.mainWindow?.webContents.send('launcher:progress', { instanceId, ...data });
        },
        onLog: (line) => {
          global.mainWindow?.webContents.send('launcher:log', { instanceId, line });
        },
        onStart: () => {
          global.mainWindow?.webContents.send('launcher:game-start', { instanceId });
          if (settings.closeOnLaunch) global.mainWindow?.minimize();
        },
        onClose: async (code) => {
          const start = sessionStarts.get(instanceId);
          if (start) {
            const secs = Math.floor((Date.now() - start) / 1000);
            await recordPlaySession(store, instanceId, secs).catch(() => {});
            sessionStarts.delete(instanceId);
          }
          global.mainWindow?.webContents.send('launcher:game-close', { instanceId, code });
          if (settings.closeOnLaunch) {
            global.mainWindow?.show();
            global.mainWindow?.restore();
          }
        },
      });
    } catch (err) {
      sessionStarts.delete(instanceId);
      // Forward the error message to the renderer as a progress event
      global.mainWindow?.webContents.send('launcher:error', { instanceId, message: err.message });
      throw err;
    }
  });

  // ── Kill ─────────────────────────────────────────────────────────────────
  ipcMain.handle('launcher:kill', async (_, instanceId) => killGame(instanceId));
  ipcMain.handle('launcher:get-status', () => getRunningInstances());

  // ── Version list ─────────────────────────────────────────────────────
  ipcMain.handle('launcher:get-versions', async (_, filter) => getAvailableVersions(filter || {}));

  ipcMain.handle('launcher:get-mod-loaders', async (_, mcVersion) => {
    const fabric = await getFabricVersions(mcVersion);
    return {
      fabric: fabric.slice(0, 15).map((f) => ({ version: f.loader.version, stable: f.loader.stable })),
      forge:  [],  // Forge versions require scraping files.minecraftforge.net
    };
  });
}

module.exports = { register };
