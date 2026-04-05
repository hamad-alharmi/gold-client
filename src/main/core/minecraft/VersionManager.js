const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');
const logger = require('../../utils/logger');
const { Paths } = require('../../utils/paths');

const MOJANG_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC_META    = 'https://meta.fabricmc.net/v2/versions/loader';
const CACHE_TTL = 10 * 60 * 1000;
let _cache = null, _cacheTime = 0;

async function getVersionManifest() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) return _cache;
  const cacheFile = path.join(Paths.versions(), 'version_manifest_v2.json');
  try {
    const res = await fetch(MOJANG_MANIFEST, { timeout: 10000 });
    const data = await res.json();
    await fs.writeJson(cacheFile, data, { spaces: 2 });
    _cache = data; _cacheTime = now;
    return data;
  } catch (err) {
    logger.warn(`Mojang manifest fetch failed: ${err.message}`);
    if (await fs.pathExists(cacheFile)) { const c = await fs.readJson(cacheFile); _cache = c; _cacheTime = now; return c; }
    throw new Error('Cannot fetch version manifest and no disk cache. Check internet.');
  }
}

async function getAvailableVersions(filter = {}) {
  const { includeSnapshots = false, includeOldBeta = false, includeOldAlpha = false } = filter;
  const manifest = await getVersionManifest();
  return manifest.versions.filter(v => {
    if (v.type === 'release') return true;
    if (v.type === 'snapshot') return includeSnapshots;
    if (v.type === 'old_beta') return includeOldBeta;
    if (v.type === 'old_alpha') return includeOldAlpha;
    return false;
  }).map(v => ({ id: v.id, type: v.type, url: v.url, releaseTime: v.releaseTime }));
}

async function getVersionJson(versionId) {
  const versionDir  = path.join(Paths.versions(), versionId);
  const versionFile = path.join(versionDir, `${versionId}.json`);
  await fs.ensureDir(versionDir);
  if (await fs.pathExists(versionFile)) return fs.readJson(versionFile);
  const manifest = await getVersionManifest();
  const entry = manifest.versions.find(v => v.id === versionId);
  if (!entry) throw new Error(`Version "${versionId}" not found`);
  const res = await fetch(entry.url, { timeout: 15000 });
  const data = await res.json();
  await fs.writeJson(versionFile, data, { spaces: 2 });
  return data;
}

async function getFabricVersions(mcVersion) {
  try {
    const res = await fetch(`${FABRIC_META}/${mcVersion}`, { timeout: 10000 });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function getLatestRelease() { const m = await getVersionManifest(); return m.latest.release; }

module.exports = { getVersionManifest, getAvailableVersions, getVersionJson, getFabricVersions, getLatestRelease };
