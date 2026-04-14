/**
 * Gold Client — Built-in Mod Injector
 *
 * Automatically copies the bundled gold-client-mod.jar and fabric-api.jar
 * into a Fabric instance's mods folder before launching, so users never
 * have to manually install them.
 *
 * The JARs are shipped inside the launcher's resources directory.
 */

const fs     = require('fs-extra');
const path   = require('path');
const fetch  = require('node-fetch');
const logger = require('../../utils/logger');
const { Paths } = require('../../utils/paths');

// ── Bundled mod filename (shipped with the launcher) ──────────────────────────
const BUNDLED_MOD_NAME = 'gold-client-mod.jar';

// ── Fabric API — downloaded on demand and cached ──────────────────────────────
const FABRIC_API_META =
  'https://api.modrinth.com/v2/project/P7dR8mSH/version?game_versions=[%221.21.1%22]&loaders=[%22fabric%22]';

const FABRIC_API_CACHE_DIR = () => path.join(Paths.base(), 'runtime', 'builtin-mods');

/**
 * Ensure the Gold Client built-in mods are present in the instance's mods folder.
 * Called by GameLauncher before launching a Fabric instance.
 *
 * @param {string}   instanceId
 * @param {string}   mcVersion
 * @param {Function} onProgress  - ({ message, percent })
 */
async function injectBuiltinMods(instanceId, mcVersion, onProgress) {
  const modsDir = Paths.mods(instanceId);
  await fs.ensureDir(modsDir);

  // ── 1. Copy bundled Gold Client title-screen mod ──────────────────────────
  const bundledSrc = getBundledModPath();
  if (bundledSrc && await fs.pathExists(bundledSrc)) {
    const dest = path.join(modsDir, BUNDLED_MOD_NAME);
    if (!await fs.pathExists(dest)) {
      await fs.copy(bundledSrc, dest);
      logger.info(`[Injector] Installed built-in mod: ${BUNDLED_MOD_NAME}`);
    }
  } else {
    logger.warn('[Injector] Bundled gold-client-mod.jar not found — skipping');
  }

  // ── 2. Ensure Fabric API is present (required for the mod to load) ─────────
  await ensureFabricApi(modsDir, mcVersion, onProgress);
}

/**
 * Download Fabric API for the given MC version if not already in the mods dir.
 */
async function ensureFabricApi(modsDir, mcVersion, onProgress) {
  // Check if any fabric-api jar already exists
  const existing = (await fs.readdir(modsDir)).find(
    f => f.toLowerCase().startsWith('fabric-api') && f.endsWith('.jar')
  );
  if (existing) return; // already have it

  // Check cache
  const cacheDir = FABRIC_API_CACHE_DIR();
  await fs.ensureDir(cacheDir);
  const cached = (await fs.readdir(cacheDir)).find(
    f => f.toLowerCase().includes('fabric-api') && f.includes(mcVersion)
  );

  if (cached) {
    await fs.copy(path.join(cacheDir, cached), path.join(modsDir, cached));
    logger.info(`[Injector] Installed Fabric API from cache: ${cached}`);
    return;
  }

  // Download from Modrinth
  try {
    onProgress?.({ message: 'Downloading Fabric API...', percent: 5 });
    logger.info('[Injector] Fetching Fabric API metadata from Modrinth...');

    const metaRes = await fetch(FABRIC_API_META, { timeout: 15000 });
    if (!metaRes.ok) throw new Error(`Modrinth API returned ${metaRes.status}`);

    const versions = await metaRes.json();
    if (!versions.length) {
      logger.warn(`[Injector] No Fabric API found for MC ${mcVersion}`);
      return;
    }

    // Take the latest stable release
    const latest = versions.find(v => v.version_type === 'release') || versions[0];
    const file   = latest.files.find(f => f.primary) || latest.files[0];

    if (!file) {
      logger.warn('[Injector] No primary file in Fabric API version');
      return;
    }

    const filename = file.filename;
    const url      = file.url;

    onProgress?.({ message: `Downloading ${filename}...`, percent: 8 });
    logger.info(`[Injector] Downloading Fabric API: ${filename}`);

    const dlRes = await fetch(url, { timeout: 60000 });
    if (!dlRes.ok) throw new Error(`Download failed: HTTP ${dlRes.status}`);

    const buffer = await dlRes.buffer();

    // Cache it
    await fs.writeFile(path.join(cacheDir, filename), buffer);
    // Copy to mods
    await fs.writeFile(path.join(modsDir, filename), buffer);

    logger.info(`[Injector] Fabric API installed: ${filename}`);
    onProgress?.({ message: 'Fabric API ready', percent: 10 });
  } catch (err) {
    // Non-fatal — the mod just won't load without Fabric API
    logger.warn(`[Injector] Could not auto-install Fabric API: ${err.message}`);
  }
}

/**
 * Resolve the path to the bundled gold-client-mod.jar.
 * In production (packaged app): extraResources/mods/gold-client-mod.jar
 * In development: project root /mods/gold-client-mod.jar
 */
function getBundledModPath() {
  const { app } = require('electron');

  // Production: electron-builder extraResources copies to process.resourcesPath
  const prodPath = path.join(process.resourcesPath || '', 'mods', BUNDLED_MOD_NAME);
  if (require('fs').existsSync(prodPath)) return prodPath;

  // Development: look relative to project root
  const devPath = path.join(app.getAppPath(), 'mods', BUNDLED_MOD_NAME);
  if (require('fs').existsSync(devPath)) return devPath;

  return null;
}

module.exports = { injectBuiltinMods };
