const https = require('https');
const http = require('http');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

async function downloadFile(url, destPath, opts = {}) {
  const { onProgress, sha1, retries = 3 } = opts;
  await fs.ensureDir(path.dirname(destPath));
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await _download(url, destPath, onProgress);
      if (sha1) {
        const actual = await computeSha1(destPath);
        if (actual !== sha1) throw new Error(`SHA1 mismatch for ${path.basename(destPath)}`);
      }
      return;
    } catch (err) {
      logger.warn(`Download attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

function _download(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const tmpPath = destPath + '.tmp';
    const handleResponse = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return _download(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const fileStream = fs.createWriteStream(tmpPath);
      res.on('data', (chunk) => { received += chunk.length; if (onProgress && total > 0) onProgress(Math.floor((received / total) * 100), received, total); });
      res.pipe(fileStream);
      fileStream.on('finish', async () => { await fs.move(tmpPath, destPath, { overwrite: true }); resolve(); });
      fileStream.on('error', (e) => { fs.remove(tmpPath).catch(() => {}); reject(e); });
      res.on('error', (e) => { fs.remove(tmpPath).catch(() => {}); reject(e); });
    };
    const req = protocol.get(url, handleResponse);
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

async function downloadFiles(files, onProgress, concurrency = 8) {
  let completed = 0;
  const total = files.length;
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    await Promise.all(batch.map(async ({ url, dest, sha1 }) => {
      if (sha1 && await fs.pathExists(dest) && await computeSha1(dest) === sha1) { completed++; onProgress?.(completed, total, Math.floor((completed/total)*100), url); return; }
      await downloadFile(url, dest, { sha1 });
      completed++;
      onProgress?.(completed, total, Math.floor((completed/total)*100), url);
    }));
  }
}

function computeSha1(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

module.exports = { downloadFile, downloadFiles, computeSha1 };
