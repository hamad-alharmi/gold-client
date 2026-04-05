const { execFile, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const logger = require('../../utils/logger');
const { Paths } = require('../../utils/paths');

const JAVA_PATHS = {
  win32: ['C:\\Program Files\\Java','C:\\Program Files\\Eclipse Adoptium','C:\\Program Files\\Microsoft',process.env.JAVA_HOME,path.join(os.homedir(),'.jdks'),Paths.java()].filter(Boolean),
  darwin: ['/Library/Java/JavaVirtualMachines','/opt/homebrew/opt',process.env.JAVA_HOME,Paths.java()].filter(Boolean),
  linux: ['/usr/lib/jvm','/usr/local/lib/jvm',process.env.JAVA_HOME,Paths.java()].filter(Boolean),
};

async function probeJava(javaExe) {
  return new Promise(resolve => {
    execFile(javaExe, ['-XshowSettings:vm','-version'], { timeout: 5000 }, (err, stdout, stderr) => {
      const out = (stdout+stderr).toLowerCase();
      if (err && !out.includes('java version') && !out.includes('openjdk')) return resolve(null);
      const m = out.match(/(?:java|openjdk) version "([^"]+)"|version "([^"]+)"/i);
      const versionStr = (m?.[1]||m?.[2]||'').trim();
      if (!versionStr) return resolve(null);
      const major = versionStr.startsWith('1.') ? parseInt(versionStr.split('.')[1],10) : parseInt(versionStr.split('.')[0],10);
      const is64bit = out.includes('64-bit')||out.includes('64 bit');
      const vendor = out.includes('adoptium')?'Eclipse Adoptium':out.includes('microsoft')?'Microsoft':out.includes('zulu')?'Azul Zulu':out.includes('graalvm')?'GraalVM':'OpenJDK';
      resolve({ path: javaExe, version: versionStr, major, is64bit, vendor });
    });
  });
}

async function findJavaInDir(dir) {
  const found = [];
  if (!await fs.pathExists(dir)) return found;
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  try {
    for (const entry of await fs.readdir(dir)) {
      const ep = path.join(dir, entry);
      if (!(await fs.stat(ep).catch(()=>null))?.isDirectory()) continue;
      for (const c of [path.join(ep,'bin',exe), path.join(ep,'jre','bin',exe), path.join(ep,'Contents','Home','bin',exe)])
        if (await fs.pathExists(c)) found.push(c);
    }
  } catch {}
  return found;
}

async function detectAllJava() {
  const exePaths = new Set();
  const exe = process.platform==='win32'?'java.exe':'java';
  if (process.env.JAVA_HOME) { const p = path.join(process.env.JAVA_HOME,'bin',exe); if (await fs.pathExists(p)) exePaths.add(p); }
  try { const sys = await new Promise((res,rej)=>exec(process.platform==='win32'?'where java':'which java',(e,o)=>e?rej(e):res(o.trim().split('\n')[0].trim()))); if (sys) exePaths.add(sys); } catch {}
  for (const dir of JAVA_PATHS[process.platform]||[]) (await findJavaInDir(dir)).forEach(p=>exePaths.add(p));
  const results = [];
  for (const exe of exePaths) { const info = await probeJava(exe); if (info) { results.push(info); logger.debug(`Found Java ${info.version} at ${exe}`); } }
  const unique = [...new Map(results.map(j=>[j.path,j])).values()].sort((a,b)=>b.major-a.major);
  logger.info(`Detected ${unique.length} Java installation(s)`);
  return unique;
}

function selectBestJava(mcVersion, available) {
  if (!available.length) return null;
  const [, minor] = mcVersion.split('.').map(Number);
  const req = minor>=21?21:minor>=17?17:8;
  return available.filter(j=>j.major>=req&&j.is64bit).sort((a,b)=>Math.abs(a.major-req)-Math.abs(b.major-req))[0] || available[0];
}

module.exports = { detectAllJava, probeJava, selectBestJava };
