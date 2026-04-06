<div align="center">

# ⚔️ Gold Client

**A high-performance, polished Minecraft launcher — inspired by Lunar & Feather Client**

[![Electron](https://img.shields.io/badge/Electron-29-blue?logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwind-css)](https://tailwindcss.com)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#)

</div>

---

## ✨ Feature Overview

| Feature | Details |
|---------|----------|
| 🎮 **Launcher** | Offline login + Microsoft auth scaffold |
| 📦 **All MC Versions** | Live from Mojang's API with snapshot toggle |
| 🧩 **Mod Loaders** | Fabric, Forge, Quilt, Vanilla |
| 📂 **Instance Manager** | Create / edit / duplicate / delete — fully isolated |
| 🔌 **Mod Manager** | Drag & drop .jar import, toggle enable/disable, validate |
| ⚡ **JVM Optimizer** | Aikar's G1GC + ZGC flags for maximum FPS |
| 🖥️ **Console** | Live game log viewer with color-coded output + export |
| 🎨 **Custom UI** | Frameless window, dark gold theme, Framer Motion animations |
| 🔄 **Auto-updater** | electron-updater integration ready for GitHub Releases |

---

## ⚡ FPS Optimization (The Core)

Gold Client generates optimal JVM flags automatically via `JVMOptimizer.js`:

```
# For 2–8 GB RAM (G1GC — Aikar's flags)
-Xms4096M -Xmx4096M
-XX:+UseG1GC
-XX:G1HeapRegionSize=8M       ← scaled to heap size
-XX:G1NewSizePercent=30
-XX:G1MaxNewSizePercent=40
-XX:InitiatingHeapOccupancyPercent=15
-XX:MaxTenuringThreshold=1
-XX:+DisableExplicitGC         ← blocks mod GC spikes
-XX:+AlwaysPreTouch            ← pre-allocates pages
-XX:+UseStringDeduplication    ← reduces heap pressure
-XX:+ParallelRefProcEnabled
-Dlog4j2.formatMsgNoLookups=true  ← Log4Shell fix

# For 8+ GB RAM + Java 17+ (ZGC — sub-ms pauses)
-XX:+UseZGC -XX:+ZUncommit -XX:+ZProactive
```

All flags are auto-selected based on your system RAM and Java version. Users can also add custom flags.

---

## 📁 Project Structure

```
gold-client/
├── src/
│   ├── main/                        # Electron main process (Node.js)
│   │   ├── index.js                 # Entry point + IPC registration + lifecycle
│   │   ├── window.js                # BrowserWindow factory (frameless)
│   │   ├── preload.js               # contextBridge IPC bridge — secure API
│   │   ├── ipc/
│   │   │   ├── auth.js              # Offline login + MS auth stub
│   │   │   ├── instances.js         # Instance CRUD
│   │   │   ├── launcher.js          # Launch/kill game + session tracking
│   │   │   ├── mods.js              # Mod list/import/toggle/validate
│   │   │   └── settings.js          # Settings + Java detection
│   │   ├── core/
│   │   │   ├── minecraft/
│   │   │   │   ├── GameLauncher.js  # MCLC wrapper, Java selection, progress events
│   │   │   │   ├── JavaManager.js   # Multi-JVM detection across all install paths
│   │   │   │   └── VersionManager.js# Mojang + Fabric API with 10-min disk cache
│   │   │   ├── instances/
│   │   │   │   └── InstanceManager.js # CRUD + playtime tracking + directory setup
│   │   │   ├── mods/
│   │   │   │   └── ModManager.js    # JAR metadata parsing: Fabric/Forge/Quilt/Legacy
│   │   │   └── optimization/
│   │   │       └── JVMOptimizer.js  # Aikar G1GC + ZGC + Shenandoah flag builder
│   │   └── utils/
│   │       ├── logger.js            # Winston rotating file + colorized console log
│   │       ├── paths.js             # Centralized cross-platform path resolution
│   │       └── downloader.js        # SHA1-validated file downloader with retries
│   └── renderer/                    # React renderer process
│       ├── App.jsx                  # Root router + global event subscriptions
│       ├── index.jsx                # ReactDOM entry + Toaster config
│       ├── index.html               # HTML shell with CSP + Google Fonts
│       ├── components/
│       │   ├── TitleBar.jsx         # Custom frameless title bar (drag region)
│       │   ├── Sidebar.jsx          # Collapsible animated navigation
│       │   ├── LaunchButton.jsx     # Smart launch/stop with progress overlay
│       │   └── modals/
│       │       ├── CreateInstanceModal.jsx  # Version picker + loader selector
│       │       └── EditInstanceModal.jsx
│       ├── pages/
│       │   ├── Home.jsx             # Dashboard: featured instance + system stats
│       │   ├── Instances.jsx        # Full CRUD with search + context menu
│       │   ├── Mods.jsx             # Drag-drop mod manager + toggle + validate
│       │   ├── Settings.jsx         # RAM slider + Java + JVM flags + toggles
│       │   ├── Console.jsx          # Live log viewer with color coding + export
│       │   └── Login.jsx            # Auth screen with offline + MS scaffold
│       ├── store/
│       │   └── useStore.js          # Zustand global state (auth, instances, mods, launch)
│       ├── styles/
│       │   └── globals.css          # Tailwind base + component layer + utilities
│       └── utils/
│           └── helpers.js           # Date, bytes, playtime formatting + color seed
├── build-resources/                 # Icons for installer (add icon.ico / icon.icns)
├── package.json                     # All deps + electron-builder config
├── vite.config.js                   # Vite for renderer (HMR in dev)
├── tailwind.config.js               # Gold + Dark color scales + custom animations
└── postcss.config.js
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Java | ≥ 17 (to launch Minecraft) |

### Development

```bash
# Clone
git clone https://github.com/hamad-alharmi/gold-client.git
cd gold-client

# Install dependencies
npm install

# Start in dev mode (Vite HMR + Electron)
npm run dev
```

This starts:
- Vite dev server at `http://localhost:3000` (renderer with hot reload)
- Electron watching for changes (auto-restarts)

### Production Build

```bash
# Windows — produces NSIS .exe installer
npm run build:win

# macOS — produces .dmg
npm run build:mac

# Linux — produces AppImage + .deb
npm run build:linux
```

Output → `dist-electron/`

---

## 📂 Data Directories

All game data lives in `~/.goldclient/` — shared across instances for efficiency:

```
~/.goldclient/
├── instances/
│   └── {uuid}/            ← per-instance isolation
│       ├── mods/          ← .jar files (disabled = .jar.disabled)
│       ├── config/
│       ├── screenshots/
│       ├── saves/
│       └── instance.json  ← metadata
├── assets/                ← shared MC asset cache
├── libraries/             ← shared MC library cache
├── versions/              ← version manifests + JARs
└── runtime/java/          ← bundled Java (future)
```

Settings stored in electron-store at:
- Windows: `%APPDATA%\gold-client\config.json`
- macOS: `~/Library/Application Support/gold-client/config.json`
- Linux: `~/.config/gold-client/config.json`

---

## 🛡️ Security Model

| Setting | Value | Reason |
|---------|-------|--------|
| `contextIsolation` | `true` | Renderer has no direct Node access |
| `nodeIntegration` | `false` | No Node.js globals in renderer |
| `sandbox` | `false` | MCLC needs native modules |
| IPC bridge | `contextBridge` only | All renderer→main comms go through typed API |
| Log4Shell | `-Dlog4j2.formatMsgNoLookups=true` | Applied to all launches |

---

## 🗺️ Roadmap

- [ ] Microsoft OAuth (Azure AD app registration)
- [ ] Modrinth / CurseForge mod search + install
- [ ] Discord Rich Presence
- [ ] Resource pack & shader manager
- [ ] Auto-install Fabric / Forge loaders
- [ ] Multiple accounts support
- [ ] Instance screenshots gallery
- [ ] Mod update checker
- [ ] macOS / Linux polish pass

---

## 📄 License

MIT © Gold Client Team

---

> *Gold Client is not affiliated with Mojang Studios or Microsoft Corporation.*
