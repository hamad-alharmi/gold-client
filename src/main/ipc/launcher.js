/**
 * Gold Client — Launcher IPC Handlers
 *
 * Fire-and-forget design: the IPC invoke resolves immediately after
 * basic validation, so the renderer stays responsive during the long
 * asset-download phase. All state updates come back as IPC events:
 *
 *   launcher:progress   → download / extract progress
 *   launcher:log        → game stdout / stderr lines
 *   launcher:game-start → Java process confirmed running
 *   launcher:game-close → game exited (code)
 *   launcher:error      → launch failed (message)
 */

const logger = require('../utils/logger');
const { launchGame, killGame, getRunningInstances } = require('../core/minecraft/GameLauncher');
const { getAvailableVersions, getFabricVersions }   = require('../core/minecraft/VersionManager');
const { getInstance, recordPlaySession }            = require('../core/instances/InstanceManager');
const { refreshMicrosoftSession }                   = require('../core/auth/MicrosoftAuth');

const sessionStarts        = new Map();
const TOKEN_REFRESH_MS     = 5 * 60 * 1000; // refresh if < 5 min remaining

function register(ipcMain, store) {

  ipcMain.handle('launcher:launch', async (event, instanceId) => {
    // ── Validate inputs quickly ─────────────────────────────────────────────
    const instance = getInstance(store, instanceId);
    if (!instance) throw new Error(`Instance "${instanceId}" not found.`);

    let auth     = store.get('auth');
    const settings = store.get('settings', {});

    if (!auth?.username) throw new Error('You must be logged in to launch Minecraft.');

    // ── Auto-refresh Microsoft token if near expiry ────────────────────────
    if (auth.type === 'microsoft' && auth.expiresAt) {
      if (auth.expiresAt - Date.now() < TOKEN_REFRESH_MS) {
        try {
          auth = await refreshMicrosoftSession(auth.refreshToken);
          store.set('auth', auth);
          global.mainWindow?.webContents.send('auth:token-refreshed', auth);
        } catch (err) {
          store.set('auth', { type: 'offline', username: '', uuid: '', accessToken: '', refreshToken: '' });
          global.mainWindow?.webContents.send('auth:session-expired');
          throw new Error('Your Microsoft session expired. Please log in again.');
        }
      }
    }

    sessionStarts.set(instanceId, Date.now());

    // ── Fire-and-forget ──────────────────────────────────────────────────
    // launchGame() is awaited but NOT blocking the IPC handler return.
    // Errors are forwarded via launcher:error IPC event.
    launchGame(instance, auth, settings, {

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
        if (settings.closeOnLaunch) { global.mainWindow?.show(); global.mainWindow?.restore(); }
      },

    }).catch((err) => {
      // launchGame rejected — send error to renderer so button resets
      sessionStarts.delete(instanceId);
      logger.error(`[Launcher] Launch failed for ${instanceId}: ${err.message}`);
      global.mainWindow?.webContents.send('launcher:error', {
        instanceId,
        message: err.message,
      });
    });

    // Return immediately — renderer shows progress via IPC events
    // (do not await launchGame here)
  });

  ipcMain.handle('launcher:kill',          async (_, id) => killGame(id));
  ipcMain.handle('launcher:get-status',    ()     => getRunningInstances());
  ipcMain.handle('launcher:get-versions',  async (_, f) => getAvailableVersions(f || {}));
  ipcMain.handle('launcher:get-mod-loaders', async (_, v) => {
    const fabric = await getFabricVersions(v);
    return {
      fabric: fabric.slice(0, 15).map((f) => ({ version: f.loader.version, stable: f.loader.stable })),
      forge:  [],
    };
  });
}

module.exports = { register };
