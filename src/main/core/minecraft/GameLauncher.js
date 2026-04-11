/**
 * Gold Client — GameLauncher (v5 — final correct implementation)
 *
 * Changes from v4:
 *
 *  1. JVM flags: customArgs now uses buildJvmArgs with includeMemory:false.
 *     The flags start with -XX:+UnlockExperimentalVMOptions (see JVMOptimizer.js).
 *     MCLC prepends its own JVM base before our customArgs, so as long as our
 *     customArgs start with the unlock flag, all subsequent experimental flags
 *     in our array are covered.
 *
 *  2. Fabric pre-installation: Before launching a Fabric instance, we call
 *     installFabric() to download the Fabric profile JSON from Fabric's meta
 *     API. MCLC's "custom" version mode reads a local JSON file — it does NOT
 *     download Fabric automatically. Without this step you get:
 *     "ENOENT: no such file or directory, ...fabric-loader-X-Y.json"
 *
 *  3. Memory: passed as plain integers (MB) — MCLC isNaN() validates this.
 */

const { Client, Authenticator } = require('minecraft-launcher-core');
const fs     = require('fs-extra');
const logger = require('../../utils/logger');
const { Paths }           = require('../../utils/paths');
const { buildJvmArgs }    = require('../optimization/JVMOptimizer');
const { detectAllJava, selectBestJava } = require('./JavaManager');
const { installFabric }   = require('./FabricInstaller');

/** Map of instanceId → running MCLC Client */
const runningGames = new Map();

async function launchGame(instance, auth, settings, callbacks = {}) {
  const { onProgress, onLog, onStart, onClose } = callbacks;
  const { id: instanceId, name, mcVersion, modLoader, modLoaderVersion } = instance;

  if (runningGames.has(instanceId)) {
    throw new Error(`"${name}" is already running.`);
  }

  await fs.ensureDir(Paths.instance(instanceId));
  await fs.ensureDir(Paths.mods(instanceId));

  // ── 1. Resolve Java ────────────────────────────────────────────────────────
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

  // ── 2. Install Fabric loader profile if needed ────────────────────────────
  //
  // MCLC's custom version mode requires the loader profile JSON to already
  // exist at <root>/versions/<versionId>/<versionId>.json.
  // FabricInstaller downloads it from Fabric's meta API.
  //
  let customVersionId = null;

  if (modLoader === 'fabric' && modLoaderVersion) {
    onProgress?.({ type: 'fabric', message: `Installing Fabric ${modLoaderVersion}...`, percent: 5 });
    try {
      customVersionId = await installFabric(
        mcVersion,
        modLoaderVersion,
        (p) => onProgress?.({ type: 'fabric', ...p })
      );
      logger.info(`[Launcher] Fabric ready: ${customVersionId}`);
    } catch (err) {
      throw new Error(`Failed to install Fabric: ${err.message}`);
    }
  }

  // Forge is similar — needs the Forge installer to have been run.
  // For now we warn; full Forge auto-install is a future enhancement.
  if (modLoader === 'forge' && modLoaderVersion) {
    const forgePath = require('path').join(
      Paths.versions(),
      `${mcVersion}-forge-${modLoaderVersion}`,
      `${mcVersion}-forge-${modLoaderVersion}.json`
    );
    if (!await fs.pathExists(forgePath)) {
      throw new Error(
        `Forge ${modLoaderVersion} is not installed for Minecraft ${mcVersion}.\n\n` +
        'Forge requires running the official Forge installer first.\n' +
        'Run the Forge installer and point it at:\n' +
        `  ${Paths.base()}\n\n` +
        'Then try launching again.'
      );
    }
    customVersionId = `${mcVersion}-forge-${modLoaderVersion}`;
  }

  // ── 3. JVM arguments ───────────────────────────────────────────────────────
  //
  // includeMemory: false — MCLC adds -Xms/-Xmx from options.memory.
  // Our customArgs are APPENDED after MCLC's own JVM base array, so
  // -XX:+UnlockExperimentalVMOptions (first in our array) comes after
  // MCLC's base flags but before our G1 flags — which is correct.
  //
  const ramMB    = settings.ram || 2048;
  const jvmFlags = buildJvmArgs({
    ramMB,
    performance:   settings.performanceMode !== false,
    gcMode:        'auto',
    extraArgs:     settings.jvmArgs || '',
    includeMemory: false,
  });

  // ── 4. Auth object ─────────────────────────────────────────────────────────
  const authorization = (auth?.type === 'offline' || !auth?.type)
    ? Authenticator.getAuth(auth?.username || 'Player')
    : buildMSAuth(auth);

  // ── 5. Version descriptor ──────────────────────────────────────────────────
  const version = customVersionId
    ? { number: mcVersion, type: 'release', custom: customVersionId }
    : { number: mcVersion, type: 'release' };

  // ── 6. MCLC launch options ─────────────────────────────────────────────────
  const launchOptions = {
    clientPackage: null,
    authorization,
    root:    Paths.base(),
    version,
    // memory must be plain integers (MCLC isNaN() validation)
    memory: {
      max: ramMB,
      min: Math.max(512, Math.floor(ramMB / 2)),
    },
    javaPath,
    customArgs: jvmFlags,
    // Window size — field is 'window', not 'screen'
    window: {
      width:      settings.resolution?.width  || 1280,
      height:     settings.resolution?.height || 720,
      fullscreen: false,
    },
    overrides: {
      gameDirectory: Paths.instance(instanceId), // per-instance saves/config
      assetRoot:     Paths.assets(),             // shared asset cache
      libraryRoot:   Paths.libraries(),          // shared library cache
      detached:      false,                      // stay attached for close events
    },
  };

  // ── 7. Wire MCLC events ────────────────────────────────────────────────────
  const launcher = new Client();

  launcher.on('progress', (e) => {
    const pct = e.total > 0 ? Math.floor((e.task / e.total) * 100) : 0;
    onProgress?.({
      type:    e.type || 'files',
      message: `Downloading ${e.type || 'files'} (${e.task}/${e.total})`,
      percent: Math.min(20 + pct * 0.6, 80), // map 0-100 → 20-80
    });
  });

  launcher.on('download-status', (e) => {
    const pct = e.total > 0 ? Math.floor((e.current / e.total) * 100) : 0;
    onProgress?.({
      type:    'asset',
      message: `Downloading: ${e.name}`,
      percent: Math.min(20 + pct * 0.6, 80),
    });
  });

  launcher.on('debug', (msg) => {
    const text = String(msg);
    logger.debug(`[MCLC] ${text}`);
    onLog?.(text);
  });

  launcher.on('data', (line) => {
    const text = typeof line === 'string' ? line.trim() : String(line).trim();
    if (text) { logger.debug(`[MC] ${text}`); onLog?.(text); }
  });

  launcher.on('close', (code) => {
    logger.info(`[Launcher] Game closed (${instanceId}) code=${code}`);
    runningGames.delete(instanceId);
    onClose?.(code);
  });

  // ── 8. Launch ──────────────────────────────────────────────────────────────
  onProgress?.({ type: 'launch', message: 'Starting Minecraft...', percent: 85 });
  logger.info(`[Launcher] MC ${mcVersion} [${modLoader}] ram=${ramMB}MB java=${javaPath}`);
  logger.info(`[Launcher] gameDir=${Paths.instance(instanceId)}`);
  logger.info(`[Launcher] customArgs=${jvmFlags.join(' ')}`);

  const proc = await launcher.launch(launchOptions);

  if (proc === null) {
    throw new Error(
      'Minecraft failed to start.\n\n' +
      'Common causes:\n' +
      '• Java not installed — get Java 17+ from adoptium.net\n' +
      '• Java version too old (need Java 17+)\n' +
      '• No internet connection (assets must download on first launch)\n' +
      '• Minecraft version files corrupted — delete\n' +
      '  ~/.goldclient/versions/<version>/ and try again\n\n' +
      'Open the Console tab for the exact MCLC error.'
    );
  }

  runningGames.set(instanceId, launcher);
  onProgress?.({ type: 'started', message: 'Game launched!', percent: 100 });
  onStart?.();
  logger.info(`[Launcher] Process running: ${instanceId}`);
}

function killGame(instanceId) {
  const launcher = runningGames.get(instanceId);
  if (!launcher) { logger.warn(`[Launcher] killGame: no entry for ${instanceId}`); return false; }
  try {
    if (typeof launcher.kill === 'function') launcher.kill();
    runningGames.delete(instanceId);
    return true;
  } catch (err) {
    logger.error(`[Launcher] Kill failed: ${err.message}`);
    return false;
  }
}

function getRunningInstances() { return [...runningGames.keys()]; }
function isRunning(id)         { return runningGames.has(id); }

function buildMSAuth(auth) {
  return {
    access_token:    auth.accessToken,
    client_token:    auth.clientToken || '',
    uuid:            auth.uuid,
    name:            auth.username,
    user_properties: '{}',
    meta: { type: 'msa', demo: false },
  };
}

module.exports = { launchGame, killGame, getRunningInstances, isRunning };
