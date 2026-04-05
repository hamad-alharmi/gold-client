const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

function register(ipcMain, store) {
  ipcMain.handle('auth:login-offline', async (_, username) => {
    if (!username || username.trim().length < 2) throw new Error('Username must be at least 2 characters.');
    if (username.length > 16) throw new Error('Username cannot exceed 16 characters.');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) throw new Error('Username can only contain letters, numbers, and underscores.');
    const profile = { type: 'offline', username: username.trim(), uuid: uuidv4(), accessToken: '' };
    store.set('auth', profile);
    logger.info(`Offline login: ${profile.username}`);
    return profile;
  });
  ipcMain.handle('auth:login-microsoft', async () => { throw new Error('Microsoft auth requires Azure AD registration. Use offline mode for now.'); });
  ipcMain.handle('auth:logout', async () => { store.set('auth', { type: 'offline', username: '', uuid: '', accessToken: '' }); logger.info('User logged out'); });
  ipcMain.handle('auth:get-profile', () => store.get('auth', null));
  ipcMain.handle('auth:is-logged-in', () => !!(store.get('auth', null)?.username));
}

module.exports = { register };
