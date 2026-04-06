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

  activeInstanceId: null,
  setActiveInstanceId: (id) => set({ activeInstanceId: id }),

  // Mods: { [instanceId]: Mod[] }
  mods: {},
  setMods: (instanceId, mods) => set(s => ({ mods: { ...s.mods, [instanceId]: mods } })),

  // Settings
  settings: null,
  setSettings: (settings) => set({ settings }),

  // ──────────────────────────────────────────────────────────
  // Launch state
  //
  // runningInstances: Set of instance IDs that are CONFIRMED running
  //   (only added after first game output, not on launch initiation)
  //
  // launchingInstances: Set of instance IDs currently in launch flow
  //   (set when user clicks Launch, cleared when game starts OR fails)
  //   This drives the progress bar on the button — separate from "running".
  //
  // This two-state model prevents the stop button from appearing
  // on a game that failed to launch.
  // ──────────────────────────────────────────────────────────
  runningInstances:  new Set(),
  launchingInstances: new Set(),
  launchProgress:    {},   // { [instanceId]: { message, percent, type } }
  gameLogs:          {},   // { [instanceId]: string[] }

  // Call when user clicks Launch
  setInstanceLaunching: (id, launching) => set(s => {
    const next = new Set(s.launchingInstances);
    launching ? next.add(id) : next.delete(id);
    return { launchingInstances: next };
  }),

  // Call ONLY when game is confirmed running (first output received)
  setInstanceRunning: (id, running) => set(s => {
    const nr = new Set(s.runningInstances);
    const nl = new Set(s.launchingInstances);
    if (running) {
      nr.add(id);
      nl.delete(id); // no longer "launching" — now "running"
    } else {
      nr.delete(id);
      nl.delete(id); // also clear launching in case it was never confirmed
    }
    return { runningInstances: nr, launchingInstances: nl };
  }),

  setLaunchProgress: (id, p) => set(s => ({ launchProgress: { ...s.launchProgress, [id]: p } })),

  clearLaunchProgress: (id) => set(s => {
    const n = { ...s.launchProgress };
    delete n[id];
    return { launchProgress: n };
  }),

  // Clear BOTH launching + running state and progress for an instance
  clearInstanceState: (id) => set(s => {
    const nr = new Set(s.runningInstances);   nr.delete(id);
    const nl = new Set(s.launchingInstances); nl.delete(id);
    const np = { ...s.launchProgress };       delete np[id];
    return { runningInstances: nr, launchingInstances: nl, launchProgress: np };
  }),

  appendGameLog: (id, line) => set(s => ({
    gameLogs: { ...s.gameLogs, [id]: [...(s.gameLogs[id] || []).slice(-500), line] },
  })),
  clearGameLogs: (id) => set(s => ({ gameLogs: { ...s.gameLogs, [id]: [] } })),

  // UI
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  isMaximized: false,
  setIsMaximized: (v) => set({ isMaximized: v }),

  // Version cache
  versions: null,
  setVersions: (v) => set({ versions: v }),
}));

export default useStore;
