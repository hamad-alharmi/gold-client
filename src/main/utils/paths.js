/**
 * Gold Client - Paths Utility
 * Single source of truth for all application paths. No hardcoded paths anywhere else.
 */

const path  = require('path');
const fs    = require('fs-extra');
const { app } = require('electron');

let _baseDir = null;

function getBaseDir() {
  if (_baseDir) return _baseDir;
  const userData = app.getPath('userData');
  _baseDir = path.join(path.dirname(userData), '.goldclient');
  return _baseDir;
}

const Paths = {
  base:        ()    => getBaseDir(),
  instances:   ()    => path.join(getBaseDir(), 'instances'),
  instance:    (id)  => path.join(getBaseDir(), 'instances', id),
  mods:        (id)  => path.join(getBaseDir(), 'instances', id, 'mods'),
  config:      (id)  => path.join(getBaseDir(), 'instances', id, 'config'),
  screenshots: (id)  => path.join(getBaseDir(), 'instances', id, 'screenshots'),
  assets:      ()    => path.join(getBaseDir(), 'assets'),
  libraries:   ()    => path.join(getBaseDir(), 'libraries'),
  versions:    ()    => path.join(getBaseDir(), 'versions'),
  java:        ()    => path.join(getBaseDir(), 'runtime', 'java'),
  loaders:     ()    => path.join(getBaseDir(), 'runtime', 'loaders'),
  logs:        ()    => path.join(app.getPath('userData'), 'logs'),
  temp:        ()    => path.join(getBaseDir(), '.tmp'),
  appIcon:     ()    => path.join(app.getAppPath(), 'assets', 'icons', 'icon.png'),
};

async function initPaths() {
  const dirs = [
    Paths.base(), Paths.instances(), Paths.assets(), Paths.libraries(),
    Paths.versions(), Paths.java(), Paths.loaders(), Paths.temp(), Paths.logs(),
  ];
  for (const d of dirs) await fs.ensureDir(d);
}

module.exports = { Paths, initPaths };
