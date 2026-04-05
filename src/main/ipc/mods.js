const { shell } = require('electron');
const { Paths } = require('../utils/paths');
const { listMods, importMods, removeMod, toggleMod, validateMods } = require('../core/mods/ModManager');

function register(ipcMain, store) {
  ipcMain.handle('mods:list',     async (_, id)        => listMods(id));
  ipcMain.handle('mods:import',   async (_, id, paths) => importMods(id, paths));
  ipcMain.handle('mods:remove',   async (_, id, mid)   => removeMod(id, mid));
  ipcMain.handle('mods:toggle',   async (_, id, mid)   => toggleMod(id, mid));
  ipcMain.handle('mods:validate', async (_, id) => { const { getInstance } = require('../core/instances/InstanceManager'); const i = getInstance(store, id); return validateMods(id, i?.modLoader || 'vanilla'); });
  ipcMain.handle('mods:open-dir', async (_, id)        => shell.openPath(Paths.mods(id)));
}

module.exports = { register };
