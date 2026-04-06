/**
 * Gold Client - Mod Manager
 * Import, enable/disable, and validate mods per instance.
 * Reads metadata from .jar files: fabric.mod.json, META-INF/mods.toml, mcmod.info, quilt.mod.json
 */

const fs     = require('fs-extra');
const path   = require('path');
const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const { Paths } = require('../../utils/paths');

const META_DB = '.gold-mods.json';

async function loadModDb(instanceId) {
  const p = path.join(Paths.instance(instanceId), META_DB);
  if (!await fs.pathExists(p)) return [];
  return fs.readJson(p).catch(() => []);
}
async function saveModDb(instanceId, mods) {
  await fs.writeJson(path.join(Paths.instance(instanceId), META_DB), mods, { spaces: 2 });
}

async function listMods(instanceId) {
  const modsDir = Paths.mods(instanceId);
  await fs.ensureDir(modsDir);
  let db = await loadModDb(instanceId);
  const files = (await fs.readdir(modsDir).catch(() => [])).filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
  // Sync: add new files
  const known = new Set(db.map(m => m.filename));
  for (const file of files) {
    if (!known.has(file) && !known.has(file + '.disabled')) {
      db.push(await readModMeta(path.join(modsDir, file)));
    }
  }
  // Sync: remove stale entries
  db = db.filter(m => files.includes(m.filename) || files.includes(m.filename.replace('.disabled', '')));
  await saveModDb(instanceId, db);
  return db;
}

async function importMods(instanceId, filePaths) {
  const modsDir = Paths.mods(instanceId);
  await fs.ensureDir(modsDir);
  const db = await loadModDb(instanceId);
  const imported = [];
  for (const src of filePaths) {
    if (!src.endsWith('.jar')) { logger.warn(`Skipping non-jar: ${src}`); continue; }
    const filename = path.basename(src);
    const dest = path.join(modsDir, filename);
    if (db.find(m => m.filename === filename)) { logger.info(`Already imported: ${filename}`); continue; }
    await fs.copy(src, dest, { overwrite: true });
    const meta = await readModMeta(dest);
    db.push(meta); imported.push(meta);
    logger.info(`Imported: ${meta.name} v${meta.version} (${meta.loader})`);
  }
  await saveModDb(instanceId, db);
  return imported;
}

async function removeMod(instanceId, modId) {
  const modsDir = Paths.mods(instanceId);
  let db = await loadModDb(instanceId);
  const mod = db.find(m => m.id === modId);
  if (!mod) throw new Error(`Mod ${modId} not found`);
  for (const candidate of [mod.filename, mod.filename + '.disabled', mod.filename.replace('.disabled', '')]) {
    const fp = path.join(modsDir, candidate);
    if (await fs.pathExists(fp)) { await fs.remove(fp); break; }
  }
  db = db.filter(m => m.id !== modId);
  await saveModDb(instanceId, db);
  logger.info(`Removed: ${mod.name}`);
}

async function toggleMod(instanceId, modId) {
  const modsDir = Paths.mods(instanceId);
  const db = await loadModDb(instanceId);
  const mod = db.find(m => m.id === modId);
  if (!mod) throw new Error(`Mod ${modId} not found`);
  if (mod.enabled) {
    const from = path.join(modsDir, mod.filename), to = from + '.disabled';
    if (await fs.pathExists(from)) await fs.rename(from, to);
    mod.filename += '.disabled'; mod.enabled = false;
  } else {
    const disabled = mod.filename.endsWith('.disabled') ? mod.filename : mod.filename + '.disabled';
    const from = path.join(modsDir, disabled), to = path.join(modsDir, disabled.replace('.disabled', ''));
    if (await fs.pathExists(from)) await fs.rename(from, to);
    mod.filename = disabled.replace('.disabled', ''); mod.enabled = true;
  }
  await saveModDb(instanceId, db);
  logger.info(`${mod.enabled ? 'Enabled' : 'Disabled'}: ${mod.name}`);
  return mod;
}

async function readModMeta(jarPath) {
  const filename = path.basename(jarPath);
  const base = {
    id: uuidv4(), filename,
    name: filename.replace(/[-_]?\d[\d.]*.*\.jar(\.disabled)?$/, '') || filename,
    version: 'Unknown', description: '', author: 'Unknown',
    loader: 'unknown', mcVersion: '',
    enabled: !filename.endsWith('.disabled'),
    size: (await fs.stat(jarPath).catch(() => ({ size: 0 }))).size,
    addedAt: new Date().toISOString(),
  };
  try {
    const zip = new AdmZip(jarPath);
    // Fabric
    const fab = zip.getEntry('fabric.mod.json');
    if (fab) {
      const j = JSON.parse(fab.getData().toString('utf8'));
      return { ...base, name: j.name || base.name, version: j.version || base.version, description: j.description || '', author: Array.isArray(j.authors) ? j.authors.join(', ') : (j.authors || base.author), loader: 'fabric', mcVersion: (j.depends?.minecraft || '') };
    }
    // Forge modern
    const ft = zip.getEntry('META-INF/mods.toml');
    if (ft) {
      const raw = ft.getData().toString('utf8');
      const ex = (k) => raw.match(new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, 'm'))?.[1] || null;
      return { ...base, name: ex('displayName')||ex('modId')||base.name, version: ex('version')||base.version, description: ex('description')||'', author: ex('authors')||base.author, loader: 'forge' };
    }
    // Forge legacy
    const lf = zip.getEntry('mcmod.info');
    if (lf) {
      const j = JSON.parse(lf.getData().toString('utf8'));
      const info = Array.isArray(j) ? j[0] : j.modList?.[0] || j;
      return { ...base, name: info.name||base.name, version: info.version||base.version, description: info.description||'', author: info.authorList?.join(', ')||info.authors||base.author, loader: 'forge', mcVersion: info.mcversion||'' };
    }
    // Quilt
    const qe = zip.getEntry('quilt.mod.json');
    if (qe) {
      const j = JSON.parse(qe.getData().toString('utf8'));
      const meta = j.quilt_loader?.metadata || {};
      return { ...base, name: meta.name||j.quilt_loader?.id||base.name, version: j.quilt_loader?.version||base.version, description: meta.description||'', loader: 'quilt' };
    }
  } catch (err) { logger.debug(`Cannot read meta from ${filename}: ${err.message}`); }
  return base;
}

async function validateMods(instanceId, modLoader) {
  const mods = (await listMods(instanceId)).filter(m => m.enabled);
  const errors = [], warnings = [];
  for (const mod of mods) {
    if (mod.loader !== 'unknown' && mod.loader !== modLoader)
      errors.push(`"${mod.name}" is a ${mod.loader} mod but this instance uses ${modLoader}.`);
  }
  const names = mods.map(m => m.name.toLowerCase());
  const seen = new Set(), dupes = [];
  for (const n of names) { if (seen.has(n)) dupes.push(n); seen.add(n); }
  if (dupes.length) warnings.push(`Duplicate mods: ${dupes.join(', ')}`);
  return { warnings, errors };
}

module.exports = { listMods, importMods, removeMod, toggleMod, validateMods, readModMeta };
