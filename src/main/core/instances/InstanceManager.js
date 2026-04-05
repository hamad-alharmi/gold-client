const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const { Paths } = require('../../utils/paths');

function listInstances(store) { return store.get('instances', []); }
function getInstance(store, id) { return listInstances(store).find(i => i.id === id) || null; }

async function createInstance(store, data) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const instance = { id, name: data.name || 'New Instance', mcVersion: data.mcVersion || '1.21.1', modLoader: data.modLoader || 'vanilla', modLoaderVersion: data.modLoaderVersion || '', icon: data.icon || 'grass', background: data.background || '', group: data.group || 'Default', playTime: 0, lastPlayed: null, createdAt: now, overrides: data.overrides || {} };
  const dir = Paths.instance(id);
  await fs.ensureDir(path.join(dir, 'mods'));
  await fs.ensureDir(path.join(dir, 'config'));
  await fs.ensureDir(path.join(dir, 'screenshots'));
  await fs.ensureDir(path.join(dir, 'resourcepacks'));
  await fs.ensureDir(path.join(dir, 'saves'));
  await fs.writeJson(path.join(dir, 'instance.json'), instance, { spaces: 2 });
  const instances = listInstances(store);
  instances.push(instance);
  store.set('instances', instances);
  logger.info(`Created instance "${instance.name}" (${id})`);
  return instance;
}

async function updateInstance(store, id, updates) {
  const instances = listInstances(store);
  const idx = instances.findIndex(i => i.id === id);
  if (idx === -1) throw new Error(`Instance "${id}" not found`);
  const { id: _, createdAt: __, ...safeUpdates } = updates;
  const updated = { ...instances[idx], ...safeUpdates };
  instances[idx] = updated;
  store.set('instances', instances);
  const dir = Paths.instance(id);
  if (await fs.pathExists(dir)) await fs.writeJson(path.join(dir, 'instance.json'), updated, { spaces: 2 });
  logger.info(`Updated instance "${updated.name}" (${id})`);
  return updated;
}

async function deleteInstance(store, id, deleteFiles = true) {
  const instances = listInstances(store);
  const instance = instances.find(i => i.id === id);
  if (!instance) throw new Error(`Instance "${id}" not found`);
  store.set('instances', instances.filter(i => i.id !== id));
  if (deleteFiles) { const dir = Paths.instance(id); if (await fs.pathExists(dir)) await fs.remove(dir); }
  logger.info(`Deleted instance "${instance.name}" (${id})`);
}

async function recordPlaySession(store, id, sessionSeconds) {
  const instance = listInstances(store).find(i => i.id === id);
  if (!instance) return;
  await updateInstance(store, id, { lastPlayed: new Date().toISOString(), playTime: (instance.playTime || 0) + Math.floor(sessionSeconds) });
}

async function duplicateInstance(store, id) {
  const original = getInstance(store, id);
  if (!original) throw new Error(`Instance "${id}" not found`);
  return createInstance(store, { ...original, name: `${original.name} (Copy)`, playTime: 0, lastPlayed: null });
}

module.exports = { listInstances, getInstance, createInstance, updateInstance, deleteInstance, recordPlaySession, duplicateInstance };
