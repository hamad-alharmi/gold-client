/**
 * Gold Client — Preload Script
 * Secure contextBridge — the ONLY way renderer talks to main.
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args);
const on     = (ch, cb) => {
  const sub = (_, ...a) => cb(...a);
  ipcRenderer.on(ch, sub);
  return () => ipcRenderer.removeListener(ch, sub);
};

contextBridge.exposeInMainWorld('goldClient', {
  app: {
    getVersion:       ()    => invoke('app:get-version'),
    getPath:          (n)   => invoke('app:get-path', n),
    showItemInFolder: (p)   => invoke('app:show-item-in-folder', p),
    openExternal:     (u)   => invoke('app:open-external', u),
    quit:             ()    => invoke('app:quit'),
    minimize:         ()    => invoke('app:minimize'),
    maximize:         ()    => invoke('app:maximize'),
    onMaximized:      (cb)  => on('window:maximized', cb),
  },

  dialog: {
    openFile:      (o) => invoke('dialog:open-file', o),
    openDirectory: (o) => invoke('dialog:open-directory', o),
  },

  auth: {
    loginOffline:   (u) => invoke('auth:login-offline', u),
    loginMicrosoft: ()  => invoke('auth:login-microsoft'),
    refreshToken:   ()  => invoke('auth:refresh-token'),
    logout:         ()  => invoke('auth:logout'),
    getProfile:     ()  => invoke('auth:get-profile'),
    isLoggedIn:     ()  => invoke('auth:is-logged-in'),
    // Renderer event subscriptions
    onTokenRefreshed: (cb) => on('auth:token-refreshed', cb),
    onSessionExpired: (cb) => on('auth:session-expired', cb),
  },

  instances: {
    list:    ()         => invoke('instances:list'),
    create:  (d)        => invoke('instances:create', d),
    update:  (id, d)    => invoke('instances:update', id, d),
    delete:  (id)       => invoke('instances:delete', id),
    get:     (id)       => invoke('instances:get', id),
    openDir: (id)       => invoke('instances:open-dir', id),
  },

  launcher: {
    launch:        (id) => invoke('launcher:launch', id),
    kill:          (id) => invoke('launcher:kill', id),
    getStatus:     ()   => invoke('launcher:get-status'),
    getVersions:   ()   => invoke('launcher:get-versions'),
    getModLoaders: (v)  => invoke('launcher:get-mod-loaders', v),
    onProgress:    (cb) => on('launcher:progress', cb),
    onLog:         (cb) => on('launcher:log', cb),
    onGameClose:   (cb) => on('launcher:game-close', cb),
    onGameStart:   (cb) => on('launcher:game-start', cb),
    onError:       (cb) => on('launcher:error', cb),
  },

  mods: {
    list:     (id)      => invoke('mods:list', id),
    import:   (id, ps)  => invoke('mods:import', id, ps),
    remove:   (id, mid) => invoke('mods:remove', id, mid),
    toggle:   (id, mid) => invoke('mods:toggle', id, mid),
    validate: (id)      => invoke('mods:validate', id),
    openDir:  (id)      => invoke('mods:open-dir', id),
  },

  settings: {
    get:           ()   => invoke('settings:get'),
    set:           (d)  => invoke('settings:set', d),
    reset:         ()   => invoke('settings:reset'),
    detectJava:    ()   => invoke('settings:detect-java'),
    getSystemRam:  ()   => invoke('settings:get-system-ram'),
    getOptimalJvm: (r)  => invoke('settings:get-optimal-jvm', r),
  },

  updater: {
    installUpdate:      ()   => invoke('updater:install-update'),
    onUpdateAvailable:  (cb) => on('updater:update-available', cb),
    onUpdateDownloaded: (cb) => on('updater:update-downloaded', cb),
    onProgress:         (cb) => on('updater:download-progress', cb),
  },
});
