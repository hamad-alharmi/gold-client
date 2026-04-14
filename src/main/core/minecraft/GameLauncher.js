/**
 * Gold Client — GameLauncher (v6)
 * Adds BuiltinModInjector call before Fabric launches so the Gold Client
 * title-screen mod is always present without the user doing anything.
 */

const { Client, Authenticator } = require('minecraft-launcher-core');
const fs     = require('fs-extra');
const logger = require('../../utils/logger');
const { Paths }                = require('../../utils/paths');
const { buildJvmArgs }         = require('../optimization/JVMOptimizer');
const { detectAllJava, selectBestJava } = require('./JavaManager');
const { installFabric }        = require('./FabricInstaller');
const { injectBuiltinMods }    = require('./BuiltinModInjector');

const runningGames = new Map();

async function launchGame(instance, auth, settings, callbacks = {}) {
  const { onProgress, onLog, onStart, onClose } = callbacks;
  const { id: instanceId, name, mcVersion, modLoader, modLoaderVersion } = instance;

  if (runningGames.has(instanceId)) {
    throw new Error(`"${name}" is already running.`);
  }

  await fs.ensureDir(Paths.instance(instanceId));
  await fs.ensureDir(Paths.mods(instanceId));

  // ── 1. Java ───────────────────────────────────────────────────────────────
  onProgress?.({ type: 'java', message: 'Finding Java...', percent: 2 });

  let javaPath = (settings.javaPath || '').trim();
  if (!javaPath) {
    const installs = await detectAllJava();
    if (installs.length === 0) {
      throw new Error(
        'No Java installation found.\n\n' +
        'Please install Java 17 or later:\n' +
        '  https://adoptium.net\n\n' +
        'Or set a custom Java path in Settings → Java.'
      );
    }
    const best = selectBestJava(mcVersion, installs);
    javaPath = (best || installs[0]).path;
    logger.info(`[Launcher] Java: ${javaPath}`);
  }

  // ── 2. Fabric: install profile JSON + inject built-in mods ───────────────
  let customVersionId = null;

  if (modLoader === 'fabric' && modLoaderVersion) {
    // 2a. Download Fabric loader profile JSON if missing
    onProgress?.({ type: 'fabric', message: `Installing Fabric ${modLoaderVersion}...`, percent: 5 });
    try {
      customVersionId = await installFabric(
        mcVersion, modLoaderVersion,
        p => onProgress?.({ type: 'fabric', ...p })
      );
    } catch (err) {
      throw new Error(`Failed to install Fabric: ${err.message}`);
    }

    // 2b. Auto-inject built-in Gold Client mod + Fabric API
    onProgress?.({ type: 'mods', message: 'Installing built-in mods...', percent: 12 });
    try {
      await injectBuiltinMods(instanceId, mcVersion,
        p => onProgress?.({ type: 'mods', ...p })
      );
    } catch (err) {
      // Non-fatal — game can still launch without the built-in mod
      logger.warn(`[Launcher] Built-in mod injection failed: ${err.message}`);
    }
  }

  // Forge check
  if (modLoader === 'forge' && modLoaderVersion) {
    const forgePath = require('path').join(
      Paths.versions(),
      `${mcVersion}-forge-${modLoaderVersion}`,
      `${mcVersion}-forge-${modLoaderVersion}.json`
    );
    if (!await fs.pathExists(forgePath)) {
      throw new Error(
        `Forge ${modLoaderVersion} is not installed for Minecraft ${mcVersion}.\n\n` +
        'Run the official Forge installer and point it at:\n' +
        `  ${Paths.base()}\n\nThen try launching again.`
      );
    }
    customVersionId = `${mcVersion}-forge-${modLoaderVersion}`;
  }

  // ── 3. JVM args (no -Xms/-Xmx — MCLC handles those) ─────────────────────
  const ramMB    = settings.ram || 2048;
  const jvmFlags = buildJvmArgs({
    ramMB,
    performance:   settings.performanceMode !== false,
    gcMode:        'auto',
    extraArgs:     settings.jvmArgs || '',
    includeMemory: false,
  });

  // ── 4. Auth ───────────────────────────────────────────────────────────────
  const authorization = (auth?.type === 'offline' || !auth?.type)
    ? Authenticator.getAuth(auth?.username || 'Player')
    : buildMSAuth(auth);

  // ── 5. Version descriptor ─────────────────────────────────────────────────
  const version = customVersionId
    ? { number: mcVersion, type: 'release', custom: customVersionId }
    : { number: mcVersion, type: 'release' };

  // ── 6. MCLC options ───────────────────────────────────────────────────────
  const launchOptions = {
    clientPackage: null,
    authorization,
    root:    Paths.base(),
    version,
    memory:  { max: ramMB, min: Math.max(512, Math.floor(ramMB / 2)) },
    javaPath,
    customArgs: jvmFlags,
    window: {
      width:      settings.resolution?.width  || 1280,
      height:     settings.resolution?.height || 720,
      fullscreen: false,
    },
    overrides: {
      gameDirectory: Paths.instance(instanceId),
      assetRoot:     Paths.assets(),
      libraryRoot:   Paths.libraries(),
      detached:      false,
    },
  };

  // ── 7. Events ─────────────────────────────────────────────────────────────
  const launcher = new Client();

  launcher.on('progress', e => {
    const pct = e.total > 0 ? Math.floor((e.task / e.total) * 100) : 0;
    onProgress?.({ type: e.type || 'files', message: `Downloading ${e.type || 'files'} (${e.task}/${e.total})`, percent: Math.min(15 + pct * 0.65, 80) });
  });
  launcher.on('download-status', e => {
    const pct = e.total > 0 ? Math.floor((e.current / e.total) * 100) : 0;
    onProgress?.({ type: 'asset', message: `Downloading: ${e.name}`, percent: Math.min(15 + pct * 0.65, 80) });
  });
  launcher.on('debug', msg => { const t = String(msg); logger.debug(`[MCLC] ${t}`); onLog?.(t); });
  launcher.on('data',  line => { const t = typeof line === 'string' ? line.trim() : String(line).trim(); if (t) { logger.debug(`[MC] ${t}`); onLog?.(t); } });
  launcher.on('close', code => { logger.info(`[Launcher] Closed (${instanceId}) code=${code}`); runningGames.delete(instanceId); onClose?.(code); });

  // ── 8. Launch ─────────────────────────────────────────────────────────────
  onProgress?.({ type: 'launch', message: 'Starting Minecraft...', percent: 85 });
  logger.info(`[Launcher] MC ${mcVersion} [${modLoader}] ram=${ramMB}MB`);

  const proc = await launcher.launch(launchOptions);

  if (proc === null) {
    throw new Error(
      'Minecraft failed to start.\n\n' +
      'Common causes:\n' +
      '• Java not installed — get Java 17+ from adoptium.net\n' +
      '• Java version too old (need Java 17+)\n' +
      '• No internet connection (assets download on first launch)\n' +
      '• Corrupted version files — delete ~/.goldclient/versions/<version>/ and retry\n\n' +
      'Open the Console tab for the exact MCLC error.'
    );
  }

  runningGames.set(instanceId, launcher);
  onProgress?.({ type: 'started', message: 'Game launched!', percent: 100 });
  onStart?.();
  logger.info(`[Launcher] Running: ${instanceId}`);
}

function killGame(instanceId) {
  const launcher = runningGames.get(instanceId);
  if (!launcher) return false;
  try { if (typeof launcher.kill === 'function') launcher.kill(); runningGames.delete(instanceId); return true; }
  catch (err) { logger.error(`Kill failed: ${err.message}`); return false; }
}

function getRunningInstances() { return [...runningGames.keys()]; }
function isRunning(id)         { return runningGames.has(id); }

function buildMSAuth(auth) {
  return { access_token: auth.accessToken, client_token: auth.clientToken || '', uuid: auth.uuid, name: auth.username, user_properties: '{}', meta: { type: 'msa', demo: false } };
}

module.exports = { launchGame, killGame, getRunningInstances, isRunning };
