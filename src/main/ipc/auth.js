/**
 * Gold Client — Auth IPC Handlers
 * Supports offline login + full Microsoft OAuth flow.
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { loginWithMicrosoft, refreshMicrosoftSession } = require('../core/auth/MicrosoftAuth');

function register(ipcMain, store) {

  // ── Offline Login ─────────────────────────────────────────────────────
  ipcMain.handle('auth:login-offline', async (_, username) => {
    const trimmed = (username || '').trim();

    if (trimmed.length < 2)  throw new Error('Username must be at least 2 characters.');
    if (trimmed.length > 16) throw new Error('Username cannot exceed 16 characters.');
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      throw new Error('Username can only contain letters, numbers, and underscores.');
    }

    const profile = {
      type:         'offline',
      username:     trimmed,
      uuid:         uuidv4(),
      accessToken:  '',
      refreshToken: '',
      clientToken:  '',
      expiresAt:    null,
    };

    store.set('auth', profile);
    logger.info(`Offline login: ${profile.username}`);
    return profile;
  });

  // ── Microsoft Login ─────────────────────────────────────────────────
  ipcMain.handle('auth:login-microsoft', async () => {
    try {
      const profile = await loginWithMicrosoft(global.mainWindow);
      store.set('auth', profile);
      logger.info(`Microsoft login: ${profile.username} (${profile.uuid})`);
      return profile;
    } catch (err) {
      logger.error(`Microsoft login failed: ${err.message}`);
      throw err; // re-throw so renderer can show the error toast
    }
  });

  // ── Token Refresh ──────────────────────────────────────────────────
  // Called automatically before launching if the MS token is near expiry.
  ipcMain.handle('auth:refresh-token', async () => {
    const auth = store.get('auth', null);
    if (!auth || auth.type !== 'microsoft' || !auth.refreshToken) {
      throw new Error('No Microsoft session to refresh.');
    }
    try {
      const profile = await refreshMicrosoftSession(auth.refreshToken);
      store.set('auth', profile);
      logger.info(`Token refreshed for ${profile.username}`);
      return profile;
    } catch (err) {
      logger.error(`Token refresh failed: ${err.message}`);
      // Clear the auth so user has to log in again
      store.set('auth', { type: 'offline', username: '', uuid: '', accessToken: '', refreshToken: '' });
      throw new Error('Your session has expired. Please log in again.');
    }
  });

  // ── Logout ────────────────────────────────────────────────────────
  ipcMain.handle('auth:logout', async () => {
    store.set('auth', { type: 'offline', username: '', uuid: '', accessToken: '', refreshToken: '' });
    logger.info('User logged out');
  });

  // ── Get Profile ────────────────────────────────────────────────────
  ipcMain.handle('auth:get-profile', () => store.get('auth', null));
  ipcMain.handle('auth:is-logged-in', () => !!(store.get('auth', null)?.username));
}

module.exports = { register };
