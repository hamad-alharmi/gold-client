const os = require('os');
const logger = require('../utils/logger');
const { detectAllJava } = require('../core/minecraft/JavaManager');
const { buildJvmArgs, suggestRam, getJvmFlagExplanations } = require('../core/optimization/JVMOptimizer');

const DEFAULT_SETTINGS = { ram: 2048, javaPath: '', resolution: { width: 1280, height: 720 }, jvmArgs: '', closeOnLaunch: false, performanceMode: true, showConsole: false, discordRPC: true, autoUpdate: true, theme: 'dark' };

function register(ipcMain, store) {
  ipcMain.handle('settings:get',    () => store.get('settings', DEFAULT_SETTINGS));
  ipcMain.handle('settings:set',    (_, d) => { const updated = { ...store.get('settings', DEFAULT_SETTINGS), ...d }; store.set('settings', updated); logger.info('Settings updated'); return updated; });
  ipcMain.handle('settings:reset',  () => { store.set('settings', DEFAULT_SETTINGS); return DEFAULT_SETTINGS; });
  ipcMain.handle('settings:detect-java',   async () => detectAllJava());
  ipcMain.handle('settings:get-system-ram', () => { const totalMB = Math.floor(os.totalmem()/1024/1024); const freeMB = Math.floor(os.freemem()/1024/1024); return { totalMB, freeMB, suggestedMB: suggestRam(totalMB) }; });
  ipcMain.handle('settings:get-optimal-jvm', (_, ram) => ({ args: buildJvmArgs({ ramMB: ram, performance: true }), explanations: getJvmFlagExplanations() }));
}

module.exports = { register };
