/**
 * Gold Client — Fabric Installer
 *
 * Installs the Fabric loader profile JSON into the versions directory so MCLC
 * can use it as a "custom" version without needing the official Fabric installer.
 *
 * How it works:
 *   1. Fetch the profile JSON from Fabric's meta API:
 *      GET https://meta.fabricmc.net/v2/versions/loader/{mcVersion}/{loaderVersion}/profile/json
 *   2. Save it to:
 *      <root>/versions/fabric-loader-{loaderVersion}-{mcVersion}/
 *                        fabric-loader-{loaderVersion}-{mcVersion}.json
 *   3. MCLC then reads that file via its "custom" version field and proceeds
 *      normally: downloads libraries, assets, etc.
 *
 * This is exactly what Prism Launcher and MultiMC do — they fetch the profile
 * JSON from Fabric's meta API and write it to the versions folder.
 */

const fs     = require('fs-extra');
const path   = require('path');
const fetch  = require('node-fetch');
const logger = require('../../utils/logger');
const { Paths } = require('../../utils/paths');

const FABRIC_PROFILE_URL =
  'https://meta.fabricmc.net/v2/versions/loader/{mcVersion}/{loaderVersion}/profile/json';

/**
 * Ensure the Fabric loader profile JSON exists on disk.
 * Downloads it from Fabric's API if not already present.
 *
 * @param {string} mcVersion      - e.g. "1.21.1"
 * @param {string} loaderVersion  - e.g. "0.16.9"
 * @param {Function} onProgress   - optional ({ message, percent }) callback
 * @returns {Promise<string>}     - the custom version ID used by MCLC
 */
async function installFabric(mcVersion, loaderVersion, onProgress) {
  const versionId  = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const versionDir = path.join(Paths.versions(), versionId);
  const jsonPath   = path.join(versionDir, `${versionId}.json`);

  // Already installed — nothing to do
  if (await fs.pathExists(jsonPath)) {
    logger.info(`[Fabric] Already installed: ${versionId}`);
    return versionId;
  }

  onProgress?.({ message: `Installing Fabric ${loaderVersion} for ${mcVersion}...`, percent: 10 });
  logger.info(`[Fabric] Installing ${versionId}...`);

  const url = FABRIC_PROFILE_URL
    .replace('{mcVersion}',     encodeURIComponent(mcVersion))
    .replace('{loaderVersion}', encodeURIComponent(loaderVersion));

  const res = await fetch(url, { timeout: 20000 });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `Fabric loader ${loaderVersion} is not available for Minecraft ${mcVersion}.\n\n` +
        `Please create a new instance and choose a compatible Fabric version.`
      );
    }
    throw new Error(`Fabric meta API returned HTTP ${res.status} for ${versionId}`);
  }

  const profileJson = await res.json();

  // Validate we got a real profile (must have 'id' and 'mainClass')
  if (!profileJson.id || !profileJson.mainClass) {
    throw new Error(`Fabric profile JSON for ${versionId} is invalid or empty.`);
  }

  // Make sure the version directory exists and write the profile
  await fs.ensureDir(versionDir);
  await fs.writeJson(jsonPath, profileJson, { spaces: 2 });

  onProgress?.({ message: `Fabric ${loaderVersion} installed`, percent: 20 });
  logger.info(`[Fabric] Installed to: ${jsonPath}`);

  return versionId;
}

/**
 * Check if a Fabric version is already installed.
 * @param {string} mcVersion
 * @param {string} loaderVersion
 */
async function isFabricInstalled(mcVersion, loaderVersion) {
  const versionId = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const jsonPath  = path.join(Paths.versions(), versionId, `${versionId}.json`);
  return fs.pathExists(jsonPath);
}

module.exports = { installFabric, isFabricInstalled };
