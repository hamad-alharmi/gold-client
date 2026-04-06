/**
 * Gold Client - Game Launcher
 * Orchestrates Minecraft launching via minecraft-launcher-core (MCLC).
 */

const { Client, Authenticator } = require('minecraft-launcher-core');
const fs = require('fs-extra');
const logger = require('../../utils/logger');
const { Paths } = require('../../utils/paths');
const { buildJvmArgs } = require('../optimization/JVMOptimizer');
const { detectAllJava, selectBestJava } = require('./JavaManager');

// Track running processes: instanceId -> Client
const runningGames = new Map();

async function launchGame(instance, auth, settings, { onProgress, onLog, onClose, onStart }) {
  const { id: instanceId, name, mcVersion, modLoader, modLoaderVersion } = instance;

  if (runningGames.has(instanceId)) throw new Error(`"${name}" is already running.`);

  const instanceDir = Paths.instance(instanceId);
  const modsDir     = Paths.mods(instanceId);
  await fs.ensureDir(instanceDir);
  await fs.ensureDir(modsDir);

  // --- Java resolution ---
  onProgress?.({ type: 'java', message: 'Finding Java...', percent: 5 });
  let javaPath = settings.javaPath || '';
  if (!javaPath) {
    const installs = await detectAllJava();
    const best     = selectBestJava(mcVersion, installs);
    if (!best) throw new Error('No compatible Java found. Install Java 17+ or set a custom path in Settings.');
    javaPath = best.path;
    logger.info(`Auto-selected Java ${best.version} at ${javaPath}`);
  }

  // --- JVM args ---
  const customArgs = buildJvmArgs({
    ramMB:       settings.ram || 2048,
    performance: settings.performanceMode !== false,
    gcMode:      'auto',
    extraArgs:   settings.jvmArgs || '',
  });

  // --- MCLC launch options ---
  const launchOptions = {
    clientPackage: null,
    authorization: buildAuth(auth),
    root:          Paths.base(),
    version:       { number: mcVersion, type: 'release' },
    memory:        { max: `${settings.ram || 2048}M`, min: `${Math.floor((settings.ram || 2048) / 2)}M` },
    javaPath,
    customArgs,
    screen: {
      width:      settings.resolution?.width  || 1280,
      height:     settings.resolution?.height || 720,
      fullscreen: false,
    },
    overrides: {
      gameDirectory: instanceDir,
      assetRoot:     Paths.assets(),
      libraryRoot:   Paths.libraries(),
    },
  };

  // Fabric / Forge custom version string
  if (modLoader === 'fabric' && modLoaderVersion) {
    launchOptions.version = { number: mcVersion, type: 'release', custom: `fabric-loader-${modLoaderVersion}-${mcVersion}` };
  } else if (modLoader === 'forge' && modLoaderVersion) {
    launchOptions.version = { number: mcVersion, type: 'release', custom: `${mcVersion}-forge-${modLoaderVersion}` };
  }

  const launcher = new Client();

  launcher.on('progress', (e) => {
    const pct = e.total > 0 ? Math.floor((e.task / e.total) * 100) : 0;
    onProgress?.({ type: e.type || 'download', message: `Downloading ${e.type || 'files'}... (${e.task}/${e.total})`, percent: pct });
  });
  launcher.on('download-status', (e) => {
    const pct = e.total > 0 ? Math.floor((e.current / e.total) * 100) : 0;
    onProgress?.({ type: 'asset', message: `Downloading: ${e.name}`, percent: pct });
  });
  launcher.on('debug', (msg)  => logger.debug(`[MCLC] ${msg}`));
  launcher.on('data',  (line) => { logger.debug(`[MC] ${line}`); onLog?.(line); });
  launcher.on('close', (code) => { logger.info(`Game exited (${instanceId}) code ${code}`); runningGames.delete(instanceId); onClose?.(code); });

  try {
    onProgress?.({ type: 'launch', message: 'Preparing launch...', percent: 90 });
    logger.info(`Launching Minecraft ${mcVersion} (${name})`);
    await launcher.launch(launchOptions);
    runningGames.set(instanceId, launcher);
    onProgress?.({ type: 'started', message: 'Game started!', percent: 100 });
    onStart?.();
    logger.info(`Game started: ${instanceId}`);
  } catch (err) {
    runningGames.delete(instanceId);
    logger.error(`Launch failed: ${err.message}`, err);
    throw err;
  }
}

function killGame(instanceId) {
  const launcher = runningGames.get(instanceId);
  if (!launcher) { logger.warn(`No running game: ${instanceId}`); return false; }
  try { launcher.kill?.(); runningGames.delete(instanceId); logger.info(`Killed: ${instanceId}`); return true; }
  catch (err) { logger.error(`Kill failed: ${err.message}`); return false; }
}

function getRunningInstances() { return [...runningGames.keys()]; }

function buildAuth(auth) {
  if (!auth || auth.type === 'offline') return Authenticator.getAuth(auth?.username || 'Player');
  return { access_token: auth.accessToken, client_token: auth.clientToken || '', uuid: auth.uuid, name: auth.username, user_properties: {} };
}

module.exports = { launchGame, killGame, getRunningInstances };
