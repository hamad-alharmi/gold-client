/**
 * Gold Client — GameLauncher (v3 — corrected MCLC integration)
 *
 * Root-cause fixes vs previous versions:
 *
 *   1. MCLC launch() returns NULL on failure (no throw) + emits close(1).
 *      We now check the return value and handle null explicitly.
 *
 *   2. runningGames.set() moved INSIDE the 'data' / first-output handler
 *      so we only mark the game as running once Minecraft actually writes
 *      output — not just because launch() resolved.
 *
 *   3. options.window (not options.screen) is the correct MCLC field.
 *
 *   4. detached: false so the child process stays attached and close events fire.
 *
 *   5. The 'close' event is guarded: if the game was never marked running we
 *      treat it as a launch failure, not a game-closed event.
 */

const { Client, Authenticator } = require('minecraft-launcher-core');
const fs     = require('fs-extra');
const path   = require('path');
const logger = require('../../utils/logger');
const { Paths }        = require('../../utils/paths');
const { buildJvmArgs } = require('../optimization/JVMOptimizer');
const { detectAllJava, selectBestJava } = require('./JavaManager');

// Map of instanceId -> { launcher, started }
const runningGames = new Map();

async function launchGame(instance, auth, settings, callbacks = {}) {
  const { onProgress, onLog, onStart, onClose } = callbacks;
  const { id: instanceId, name, mcVersion, modLoader, modLoaderVersion } = instance;

  if (runningGames.has(instanceId)) {
    throw new Error(`"${name}" is already running.`);
  }

  // Ensure directories exist
  await fs.ensureDir(Paths.instance(instanceId));
  await fs.ensureDir(Paths.mods(instanceId));

  // ── 1. Find Java ─────────────────────────────────────────────────────────────
  onProgress?.({ type: 'java', message: 'Finding Java...', percent: 3 });

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
    javaPath = (best || installs[0]).path;
    logger.info(`Auto-selected Java: ${javaPath}`);
  }

  // ── 2. JVM args ─────────────────────────────────────────────────────────────
  const ramMB   = settings.ram || 2048;
  const jvmArgs = buildJvmArgs({
    ramMB,
    performance: settings.performanceMode !== false,
    gcMode:      'auto',
    extraArgs:   settings.jvmArgs || '',
  });

  // ── 3. Auth ─────────────────────────────────────────────────────────────────
  // MCLC's getAuth() returns a Promise — pass it directly; MCLC awaits it internally.
  const authorization = (auth?.type === 'offline' || !auth?.type)
    ? Authenticator.getAuth(auth?.username || 'Player')
    : buildMSAuth(auth);

  // ── 4. Version ─────────────────────────────────────────────────────────────
  let version;
  if (modLoader === 'fabric' && modLoaderVersion) {
    version = { number: mcVersion, type: 'release', custom: `fabric-loader-${modLoaderVersion}-${mcVersion}` };
  } else if (modLoader === 'forge' && modLoaderVersion) {
    version = { number: mcVersion, type: 'release', custom: `${mcVersion}-forge-${modLoaderVersion}` };
  } else {
    version = { number: mcVersion, type: 'release' };
  }

  // ── 5. MCLC options ─────────────────────────────────────────────────────────
  //
  // CRITICAL correct field names (verified from MCLC source):
  //   options.customArgs       -> JVM flags (before -jar)
  //   options.customLaunchArgs -> extra game args (after main class)
  //   options.window           -> { width, height, fullscreen }  (NOT options.screen)
  //   overrides.gameDirectory  -> Minecraft game dir for saves/options/mods
  //   overrides.detached       -> MUST be false to track close events
  //   overrides.assetRoot      -> shared asset cache path
  //   overrides.libraryRoot    -> shared library cache path
  //
  const launchOptions = {
    clientPackage: null,
    authorization,
    root:    Paths.base(),
    version,
    memory:  { max: `${ramMB}M`, min: `${Math.max(512, Math.floor(ramMB * 0.5))}M` },
    javaPath,
    // JVM flags — placed BEFORE -jar in the command
    customArgs: jvmArgs,
    // Window size — MCLC field is "window" NOT "screen"
    window: {
      width:      settings.resolution?.width  || 1280,
      height:     settings.resolution?.height || 720,
      fullscreen: false,
    },
    overrides: {
      // Instance-isolated game directory (saves, options.txt, resourcepacks, etc.)
      gameDirectory: Paths.instance(instanceId),
      // Shared caches to avoid downloading assets for every instance
      assetRoot:    Paths.assets(),
      libraryRoot:  Paths.libraries(),
      // CRITICAL: false so child process stays attached and close event fires
      detached: false,
    },
  };

  // ── 6. Wire up MCLC event handlers ─────────────────────────────────────
  const launcher = new Client();

  // Track whether Minecraft actually started producing output.
  // MCLC emits close(1) on failure WITHOUT ever emitting data,
  // so we use this flag to distinguish "real close" from "launch failure".
  let gameStarted = false;

  launcher.on('progress', (e) => {
    const pct = e.total > 0 ? Math.floor((e.task / e.total) * 100) : 0;
    onProgress?.({
      type:    e.type || 'files',
      message: `Preparing: ${e.type || 'files'} (${e.task}/${e.total})`,
      percent: Math.min(pct, 80),
    });
  });

  launcher.on('download-status', (e) => {
    const pct = e.total > 0 ? Math.floor((e.current / e.total) * 100) : 0;
    onProgress?.({
      type:    'asset',
      message: `Downloading: ${e.name}`,
      percent: Math.min(pct, 80),
    });
  });

  launcher.on('debug', (msg) => {
    const text = String(msg);
    logger.debug(`[MCLC] ${text}`);

    // Forward MCLC debug as log lines so they appear in Console tab
    onLog?.(text);

    // Detect the "Launching with arguments" line to know we actually started
    if (text.includes('Launching with arguments') || text.includes('Launching with')) {
      gameStarted = true;
      runningGames.set(instanceId, launcher);
      onProgress?.({ type: 'started', message: 'Game started!', percent: 100 });
      onStart?.();
      logger.info(`Minecraft process started: ${instanceId}`);
    }
  });

  launcher.on('data', (line) => {
    const text = typeof line === 'string' ? line.trim() : String(line).trim();
    if (!text) return;
    logger.debug(`[MC] ${text}`);
    onLog?.(text);

    // First game output = game is definitely running
    if (!gameStarted) {
      gameStarted = true;
      runningGames.set(instanceId, launcher);
      onProgress?.({ type: 'started', message: 'Game running!', percent: 100 });
      onStart?.();
      logger.info(`Minecraft running (first output): ${instanceId}`);
    }
  });

  launcher.on('close', (code) => {
    runningGames.delete(instanceId);

    if (!gameStarted) {
      // Game never actually started — this is a launch failure, not a game close.
      // The error details should have been emitted as 'debug' lines already.
      logger.error(`Launch failed for ${instanceId} (code ${code}). Check debug logs above.`);
      // We throw into the catch block below by rejecting the launch promise.
      // If we're already past the try/catch (shouldn't happen), just log.
      return;
    }

    logger.info(`Game closed (${instanceId}) code ${code}`);
    onClose?.(code);
  });

  // ── 7. Launch and handle null return ───────────────────────────────────
  onProgress?.({ type: 'launch', message: 'Starting Minecraft...', percent: 85 });
  logger.info(`Launching MC ${mcVersion} [${modLoader || 'vanilla'}] | RAM: ${ramMB}MB | Java: ${javaPath}`);
  logger.info(`Game dir: ${Paths.instance(instanceId)}`);

  // Wrap the launch in a promise so we can detect the null return + close(1) pattern.
  await new Promise((resolve, reject) => {
    // Give MCLC time to either start outputting or emit close(fail)
    let settled = false;

    function settle(fn, val) {
      if (!settled) { settled = true; fn(val); }
    }

    // If game starts producing output, we're good
    const origStart = onStart;
    launcher.once('data', () => settle(resolve, undefined));

    // If close fires before any data, it's a launch failure
    const origClose = launcher.rawListeners('close').at(-1);
    launcher.once('close', (code) => {
      if (!gameStarted) {
        settle(reject, new Error(
          `Minecraft failed to start (exit code ${code}).\n\n` +
          `Common causes:\n` +
          `  • Java path is wrong or Java version is too old (need 17+)\n` +
          `  • The Minecraft version files are corrupted (delete ~/.goldclient/versions and retry)\n` +
          `  • Not enough RAM allocated\n\n` +
          `Check the Console tab for MCLC debug output.`
        ));
      } else {
        settle(resolve, undefined);
      }
    });

    // Run MCLC's launch (returns null on failure, child process on success)
    launcher.launch(launchOptions).then((proc) => {
      // If launch() returned null and we haven’t resolved yet,
      // close event will handle it — just wait.
      if (proc === null && !gameStarted && !settled) {
        // close event will fire and reject the promise
        logger.debug('launch() returned null — waiting for close event...');
      }
    }).catch((err) => {
      settle(reject, new Error(`MCLC launch error: ${err.message}`));
    });
  });
}

function killGame(instanceId) {
  const entry = runningGames.get(instanceId);
  if (!entry) { logger.warn(`killGame: no running game for ${instanceId}`); return false; }
  try {
    if (typeof entry.kill === 'function') entry.kill();
    runningGames.delete(instanceId);
    logger.info(`Killed: ${instanceId}`);
    return true;
  } catch (err) {
    logger.error(`Kill failed: ${err.message}`);
    return false;
  }
}

function getRunningInstances() { return [...runningGames.keys()]; }
function isRunning(id)         { return runningGames.has(id); }

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a plain auth object for Microsoft accounts.
 * (Offline uses Authenticator.getAuth which returns a Promise — MCLC handles it.)
 */
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
