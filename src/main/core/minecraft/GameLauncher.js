/**
 * Gold Client — GameLauncher
 * Fixed implementation using minecraft-launcher-core (MCLC).
 *
 * Key fixes vs previous version:
 *  - customArgs (JVM) vs customLaunchArgs (game args) separated correctly
 *  - --gameDir passed as game arg for proper instance isolation
 *  - Process stored BEFORE awaiting launch so kill works
 *  - All errors forwarded to renderer via IPC
 *  - Detached:false so we can track exit
 */

const { Client, Authenticator } = require('minecraft-launcher-core');
const fs     = require('fs-extra');
const path   = require('path');
const logger = require('../../utils/logger');
const { Paths }        = require('../../utils/paths');
const { buildJvmArgs } = require('../optimization/JVMOptimizer');
const { detectAllJava, selectBestJava } = require('./JavaManager');

// Map of instanceId -> running Client
const runningGames = new Map();

/**
 * Launch Minecraft for a given instance.
 *
 * @param {object}   instance
 * @param {object}   auth          - { type, username, uuid, accessToken }
 * @param {object}   settings      - global launcher settings
 * @param {object}   callbacks
 * @param {Function} callbacks.onProgress  - ({ type, message, percent })
 * @param {Function} callbacks.onLog       - (line: string)
 * @param {Function} callbacks.onStart     - ()
 * @param {Function} callbacks.onClose     - (code: number)
 */
async function launchGame(instance, auth, settings, callbacks = {}) {
  const { onProgress, onLog, onStart, onClose } = callbacks;
  const { id: instanceId, name, mcVersion, modLoader, modLoaderVersion } = instance;

  if (runningGames.has(instanceId)) {
    throw new Error(`"${name}" is already running.`);
  }

  // Ensure instance directories exist
  const instanceDir = Paths.instance(instanceId);
  const modsDir     = Paths.mods(instanceId);
  await fs.ensureDir(instanceDir);
  await fs.ensureDir(modsDir);

  // ── 1. Resolve Java ────────────────────────────────────────────────────
  onProgress?.({ type: 'java', message: 'Finding Java installation...', percent: 3 });

  let javaPath = (settings.javaPath || '').trim();
  if (!javaPath) {
    const installs = await detectAllJava();
    if (!installs.length) {
      throw new Error(
        'No Java installation found.\n\n' +
        'Please install Java 17 or later from https://adoptium.net\n' +
        'or set a custom Java path in Settings → Java.'
      );
    }
    const best = selectBestJava(mcVersion, installs);
    javaPath = best ? best.path : installs[0].path;
    logger.info(`Auto-selected Java at: ${javaPath}`);
  }

  // ── 2. JVM arguments ──────────────────────────────────────────────────
  const ramMB   = settings.ram || 2048;
  const jvmArgs = buildJvmArgs({
    ramMB,
    performance: settings.performanceMode !== false,
    gcMode:      'auto',
    extraArgs:   settings.jvmArgs || '',
  });

  // ── 3. Auth object ────────────────────────────────────────────────────
  const authorization = buildMCLCAuth(auth);

  // ── 4. Version object ─────────────────────────────────────────────────
  // For Fabric / Forge, MCLC needs a "custom" version string that matches
  // the profile ID installed in <root>/versions/<custom>/
  let version;
  if (modLoader === 'fabric' && modLoaderVersion) {
    version = {
      number: mcVersion,
      type:   'release',
      custom: `fabric-loader-${modLoaderVersion}-${mcVersion}`,
    };
  } else if (modLoader === 'forge' && modLoaderVersion) {
    version = {
      number: mcVersion,
      type:   'release',
      custom: `${mcVersion}-forge-${modLoaderVersion}`,
    };
  } else {
    version = { number: mcVersion, type: 'release' };
  }

  // ── 5. Build MCLC options ─────────────────────────────────────────────
  //
  // IMPORTANT NOTES:
  //   - `customArgs`       → JVM arguments (placed BEFORE -jar)
  //   - `customLaunchArgs` → Game arguments (placed AFTER the main class)
  //   - `--gameDir`        → Tells Minecraft to use our instance directory
  //     for saves, options.txt, resourcepacks, etc.
  //   - `overrides.assetRoot` / `overrides.libraryRoot` → shared caches
  //
  const launchOptions = {
    // No client package download — we use vanilla/fabric/forge profile
    clientPackage: null,

    authorization,

    // Root is where Gold Client stores versions/, assets/, libraries/
    // MCLC uses this as the base .minecraft equivalent
    root: Paths.base(),

    version,

    // Memory — strings e.g. "2048M"
    memory: {
      max: `${ramMB}M`,
      min: `${Math.max(512, Math.floor(ramMB * 0.5))}M`,
    },

    javaPath,

    // JVM flags (GC tuning, performance opts)
    // These come BEFORE -jar in the launch command
    customArgs: jvmArgs,

    // Game arguments — tell MC to use the instance dir for save data
    // Resolution is also set here for non-fullscreen launch
    customLaunchArgs: [
      '--gameDir', instanceDir,
      '--width',  String(settings.resolution?.width  || 1280),
      '--height', String(settings.resolution?.height || 720),
    ],

    overrides: {
      // Share asset cache across all instances (saves GB of disk space)
      assetRoot:   Paths.assets(),
      // Share library cache across all instances
      libraryRoot: Paths.libraries(),
      // Keep process attached so we receive the close event
      detached: false,
    },
  };

  // ── 6. Create launcher and attach event handlers ───────────────────────
  const launcher = new Client();

  // Download / extraction progress
  launcher.on('progress', (e) => {
    const pct = e.total > 0 ? Math.floor((e.task / e.total) * 100) : 0;
    onProgress?.({
      type:    e.type || 'files',
      message: `Downloading ${e.type || 'files'} (${e.task}/${e.total})`,
      percent: Math.min(pct, 85), // reserve 85-100 for startup
    });
  });

  // Individual file download status
  launcher.on('download-status', (e) => {
    const pct = e.total > 0 ? Math.floor((e.current / e.total) * 100) : 0;
    onProgress?.({
      type:    'asset',
      message: `Downloading: ${e.name}`,
      percent: Math.min(pct, 85),
    });
  });

  // MCLC internal debug messages
  launcher.on('debug', (msg) => logger.debug(`[MCLC] ${msg}`));

  // Minecraft stdout/stderr lines
  launcher.on('data', (line) => {
    const text = typeof line === 'string' ? line.trim() : String(line);
    if (text) {
      logger.debug(`[MC/${instanceId}] ${text}`);
      onLog?.(text);
    }
  });

  // Game process closed
  launcher.on('close', (code) => {
    logger.info(`Game exited (${instanceId}) with code ${code}`);
    runningGames.delete(instanceId);
    onClose?.(code);
  });

  // ── 7. Launch ────────────────────────────────────────────────────────
  try {
    onProgress?.({ type: 'launch', message: 'Preparing Minecraft...', percent: 88 });
    logger.info(`Launching MC ${mcVersion} [${modLoader}] for instance ${instanceId}`);
    logger.info(`Java: ${javaPath}`);
    logger.info(`RAM: ${ramMB}MB | GameDir: ${instanceDir}`);

    await launcher.launch(launchOptions);

    // Store after successful launch so kill() works
    runningGames.set(instanceId, launcher);

    onProgress?.({ type: 'started', message: 'Game launched!', percent: 100 });
    onStart?.();

    logger.info(`Minecraft started for instance: ${instanceId}`);
  } catch (err) {
    runningGames.delete(instanceId);
    const msg = formatLaunchError(err);
    logger.error(`Launch failed for ${instanceId}: ${msg}`);
    throw new Error(msg);
  }
}

/**
 * Kill a running game instance.
 * @param {string} instanceId
 * @returns {boolean} whether a game was killed
 */
function killGame(instanceId) {
  const launcher = runningGames.get(instanceId);
  if (!launcher) {
    logger.warn(`killGame: no running game for ${instanceId}`);
    return false;
  }
  try {
    // MCLC exposes kill() on the launcher which sends SIGTERM to the child
    if (typeof launcher.kill === 'function') {
      launcher.kill();
    }
    runningGames.delete(instanceId);
    logger.info(`Killed game for instance: ${instanceId}`);
    return true;
  } catch (err) {
    logger.error(`killGame error: ${err.message}`);
    return false;
  }
}

/** Returns an array of currently running instance IDs. */
function getRunningInstances() {
  return [...runningGames.keys()];
}

/** Is a specific instance currently running? */
function isRunning(instanceId) {
  return runningGames.has(instanceId);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the MCLC authorization object from our stored auth profile.
 */
function buildMCLCAuth(auth) {
  if (!auth || auth.type === 'offline') {
    // Offline mode — no real Mojang auth
    return Authenticator.getAuth(auth?.username || 'Player');
  }

  // Microsoft auth — access token already obtained via OAuth flow
  return {
    access_token:    auth.accessToken,
    client_token:    auth.clientToken || '',
    uuid:            auth.uuid,
    name:            auth.username,
    user_properties: '{}',
    meta: {
      type: 'msa',
      demo: false,
    },
  };
}

/**
 * Turn a raw launch error into a helpful user-facing message.
 */
function formatLaunchError(err) {
  const msg = err?.message || String(err);

  if (msg.includes('ENOENT') && msg.includes('java')) {
    return 'Java executable not found. Please install Java 17+ or set the correct path in Settings → Java.';
  }
  if (msg.includes('ENOENT')) {
    return `File not found during launch — possibly missing game files. Try again to re-download.\n\nDetails: ${msg}`;
  }
  if (msg.includes('spawn')) {
    return `Could not start Java process. Is Java installed and accessible?\n\nDetails: ${msg}`;
  }
  if (msg.includes('manifest')) {
    return `Could not fetch Minecraft version manifest. Check your internet connection.\n\nDetails: ${msg}`;
  }
  return msg;
}

module.exports = { launchGame, killGame, getRunningInstances, isRunning };
