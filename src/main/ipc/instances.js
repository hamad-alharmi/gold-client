const { shell } = require('electron');
const { Paths } = require('../utils/paths');
const { listInstances, getInstance, createInstance, updateInstance, deleteInstance, duplicateInstance } = require('../core/instances/InstanceManager');

function register(ipcMain, store) {
  ipcMain.handle('instances:list',      ()        => listInstances(store));
  ipcMain.handle('instances:get',       (_, id)   => getInstance(store, id));
  ipcMain.handle('instances:create',    async (_, d)    => createInstance(store, d));
  ipcMain.handle('instances:update',    async (_, id, d) => updateInstance(store, id, d));
  ipcMain.handle('instances:delete',    async (_, id)   => deleteInstance(store, id));
  ipcMain.handle('instances:duplicate', async (_, id)   => duplicateInstance(store, id));
  ipcMain.handle('instances:open-dir',  async (_, id)   => shell.openPath(Paths.instance(id)));
}

module.exports = { register };
