import { create } from 'zustand';

const useStore = create((set) => ({
  // Auth
  auth: null,
  setAuth: (auth) => set({ auth }),

  // Instances
  instances: [],
  setInstances: (instances) => set({ instances }),
  updateInstance: (id, data) => set(s => ({ instances: s.instances.map(i => i.id===id ? {...i,...data} : i) })),
  addInstance: (inst) => set(s => ({ instances: [...s.instances, inst] })),
  removeInstance: (id) => set(s => ({ instances: s.instances.filter(i => i.id!==id) })),

  // Active instance
  activeInstanceId: null,
  setActiveInstanceId: (id) => set({ activeInstanceId: id }),

  // Mods: { [instanceId]: Mod[] }
  mods: {},
  setMods: (instanceId, mods) => set(s => ({ mods: { ...s.mods, [instanceId]: mods } })),

  // Settings
  settings: null,
  setSettings: (settings) => set({ settings }),

  // Launch state
  runningInstances: new Set(),
  launchProgress: {},
  gameLogs: {},

  setInstanceRunning: (id, running) => set(s => {
    const next = new Set(s.runningInstances);
    running ? next.add(id) : next.delete(id);
    return { runningInstances: next };
  }),
  setLaunchProgress: (id, p) => set(s => ({ launchProgress: { ...s.launchProgress, [id]: p } })),
  clearLaunchProgress: (id) => set(s => { const n = {...s.launchProgress}; delete n[id]; return { launchProgress: n }; }),
  appendGameLog: (id, line) => set(s => ({ gameLogs: { ...s.gameLogs, [id]: [...(s.gameLogs[id]||[]).slice(-500), line] } })),
  clearGameLogs: (id) => set(s => ({ gameLogs: { ...s.gameLogs, [id]: [] } })),

  // UI
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  isMaximized: false,
  setIsMaximized: (v) => set({ isMaximized: v }),

  // Versions cache
  versions: null,
  setVersions: (v) => set({ versions: v }),
}));

export default useStore;
