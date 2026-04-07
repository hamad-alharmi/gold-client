/**
 * Gold Client — GameLauncher (v4 — correct MCLC integration)
 *
 * Fixes vs all previous versions:
 *
 *  1. memory.max / memory.min must be NUMBERS (not strings like '2048M').
 *     MCLC does isNaN(max) to validate — strings with 'M' fail isNaN() = true,
 *     so MCLC silently resets to 1 GB. Passing integers fixes this.
 *
 *  2. customArgs must NOT include -Xms / -Xmx.
 *     MCLC already adds them from the memory option. Duplicates cause Java to
 *     use whichever comes last (confusing) and can sometimes cause JVM errors.
 *
 *  3. No complex Promise wrapper around launch().
 *     Just await launch(), check proc === null (failure), set state, return.
 *     Errors come via launcher:error IPC. Close events are async.
 *
 *  4. IPC handler is fire-and-forget: returns immediately so the renderer
 *     stays responsive during the potentially long asset download phase.
 *     All game state updates arrive via IPC events (progress / start / close / error).
 *
 *  5. runningGames.set() called only after proc !== null confirmed.
 *     Prevents the Stop button appearing when launch fails.
 */

const { Client, Authenticator } = require('minecraft-launcher-core');
const fs     = require('fs-extra');
const logger = require('../../utils/logger');
const { Paths }        = require('../../utils/paths');
const { buildJvmArgs } = require('../optimization/JVMOptimizer');
const { detectAllJava, selectBestJava } = require('./JavaManager');

/** Map of instanceId → running MCLC Client */
const runningGames = new Map();

/**
 * Launch Minecraft for a given instance.
 * Resolves when the Java process has been spawned (not when the game window opens).
 * Rejects if MCLC returns null (Java not found, version files corrupt, etc.).
 *
 * @param {object} instance
 * @param {object} auth
 * @param {object} settings
 * @param {object} callbacks  { onProgress, onLog, onStart, onClose }
 */
async function launchGame(instance, auth, settings, callbacks = {}) {
  const { onProgress, onLog, onStart, onClose } = callbacks;
  const { id: instanceId, name, mcVersion, modLoader, modLoaderVersion } = instance;

  if (runningGames.has(instanceId)) {
    throw new Error(`"${name}" is already running.`);
  }

  // Ensure per-instance directories exist
  await fs.ensureDir(Paths.instance(instanceId));
  await fs.ensureDir(Paths.mods(instanceId));

  // ── 1. Resolve Java executable ───────────────────────────────────────────────────
  onProgress?.({ type: 'java', message: 'Finding Java...', percent: 3 });

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
    logger.info(`[Launcher] Auto-selected Java: ${javaPath}`);
  }

  // ── 2. Build JVM arguments (WITHOUT -Xms / -Xmx) ────────────────────────────────
  //
  // CRITICAL: Do NOT include -Xms / -Xmx here.
  // MCLC adds them from options.memory (which must be a plain number).
  // Duplicate memory flags confuse the JVM.
  //
  const ramMB     = settings.ram || 2048;
  const jvmFlags  = buildJvmArgs({
    ramMB,
    performance:    settings.performanceMode !== false,
    gcMode:         'auto',
    extraArgs:      settings.jvmArgs || '',
    includeMemory:  false,   // <-- new flag: skip -Xms / -Xmx
  });

  // ── 3. Authentication object ────────────────────────────────────────────────────
  // Authenticator.getAuth() returns a Promise — MCLC awaits it internally.
  const authorization = (auth?.type === 'offline' || !auth?.type)
    ? Authenticator.getAuth(auth?.username || 'Player')
    : buildMSAuth(auth);

  // ── 4. Version descriptor ────────────────────────────────────────────────────
  const version = buildVersion(mcVersion, modLoader, modLoaderVersion);

  // ── 5. MCLC launch options ───────────────────────────────────────────────────
  //
  // Verified field names from MCLC source (components/handler.js):
  //
  //   options.memory             → { max: NUMBER, min: NUMBER }   (integers, no 'M' suffix!)
  //   options.customArgs         → string[] placed BEFORE -jar
  //   options.customLaunchArgs   → string[] placed AFTER main class (game args)
  //   options.window             → { width, height, fullscreen }  (NOT options.screen!)
  //   overrides.gameDirectory    → Minecraft game dir for saves / options.txt / mods
  //   overrides.assetRoot        → shared asset cache
  //   overrides.libraryRoot      → shared library cache
  //   overrides.detached         → false keeps child attached so close events fire
  //
  const launchOptions = {
    clientPackage: null,
    authorization,
    root:    Paths.base(),
    version,

    // memory.max and memory.min MUST be plain integers.
    // MCLC's getMemory() does isNaN(max) — strings like '2048M' fail isNaN
    // and MCLC silently falls back to 1 GB.
    memory: {
      max: ramMB,
      min: Math.max(512, Math.floor(ramMB / 2)),
    },

    javaPath,

    // JVM flags (GC tuning, perf opts). -Xms/-Xmx are NOT included —
    // MCLC generates those from options.memory above.
    customArgs: jvmFlags,

    // Window size. Field name is 'window', not 'screen'.
    window: {
      width:      settings.resolution?.width  || 1280,
      height:     settings.resolution?.height || 720,
      fullscreen: false,
    },

    overrides: {
      // Per-instance isolated game directory
      gameDirectory: Paths.instance(instanceId),
      // Shared caches: saves re-downloading for every instance
      assetRoot:     Paths.assets(),
      libraryRoot:   Paths.libraries(),
      // Keep child process attached so close events fire correctly
      detached: false,
    },
  };

  // ── 6. Wire up event handlers ───────────────────────────────────────────────────
  const launcher = new Client();

  launcher.on('progress', (e) => {
    const pct = e.total > 0 ? Math.floor((e.task / e.total) * 100) : 0;
    onProgress?.({
      type:    e.type || 'files',
      message: `Downloading ${e.type || 'files'} (${e.task}/${e.total})`,
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

  // ── 7. Launch ─────────────────────────────────────────────────────────────────
  onProgress?.({ type: 'launch', message: 'Starting Minecraft...', percent: 85 });
  logger.info(`[Launcher] Starting MC ${mcVersion} [${modLoader}] ram=${ramMB}MB java=${javaPath}`);
  logger.info(`[Launcher] gameDir=${Paths.instance(instanceId)}`);

  // launcher.launch() returns:
  //   • ChildProcess  → Java process spawned successfully
  //   • null          → Java check failed OR uncaught error (MCLC catches internally)
  //
  // The MCLC source wraps everything in try/catch and emits
  // debug(error) + close(1) + return null on failure.
  const proc = await launcher.launch(launchOptions);

  if (proc === null) {
    // MCLC already emitted the specific debug line with the error reason.
    // The user can see it in the Console tab.
    throw new Error(
      'Minecraft failed to start.\n\n' +
      'Common causes:\n' +
      '\u2022 Java not installed — get Java 17+ from adoptium.net\n' +
      '\u2022 Java version too old (need Java 17+)\n' +
      '\u2022 No internet connection (assets must download on first launch)\n' +
      '\u2022 Minecraft version files corrupted — delete the version folder in\n' +
      '  ~/.goldclient/versions/ and try again\n\n' +
      'Open the Console tab for the exact error from MCLC.'
    );
  }

  // Java process is running — mark as active and notify renderer
  runningGames.set(instanceId, launcher);
  onProgress?.({ type: 'started', message: 'Game launched!', percent: 100 });
  onStart?.();
  logger.info(`[Launcher] Minecraft process running: ${instanceId}`);
}

function killGame(instanceId) {
  const launcher = runningGames.get(instanceId);
  if (!launcher) { logger.warn(`[Launcher] killGame: no running game for ${instanceId}`); return false; }
  try {
    if (typeof launcher.kill === 'function') launcher.kill();
    runningGames.delete(instanceId);
    logger.info(`[Launcher] Killed: ${instanceId}`);
    return true;
  } catch (err) {
    logger.error(`[Launcher] Kill failed: ${err.message}`);
    return false;
  }
}

function getRunningInstances() { return [...runningGames.keys()]; }
function isRunning(id)         { return runningGames.has(id); }

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildVersion(mcVersion, modLoader, modLoaderVersion) {
  if (modLoader === 'fabric' && modLoaderVersion) {
    return { number: mcVersion, type: 'release', custom: `fabric-loader-${modLoaderVersion}-${mcVersion}` };
  }
  if (modLoader === 'forge' && modLoaderVersion) {
    return { number: mcVersion, type: 'release', custom: `${mcVersion}-forge-${modLoaderVersion}` };
  }
  return { number: mcVersion, type: 'release' };
}

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
