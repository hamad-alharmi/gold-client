# Gold Client

A high-performance, modular Minecraft launcher with a native C++ bridge, auto-updater, and full CI/CD pipeline.

## Repository Structure

```
gold-client/
├── .github/workflows/
│   ├── build.yml              # Multi-platform build (push / PR)
│   ├── release.yml            # Installer packaging + GitHub Release (on tag)
│   └── update-manifest.yml   # Auto-updater manifest → gh-pages (on release)
├── launcher-core/             # Kotlin launcher source
├── native-bridge/             # C++ JNI bridge (CMake)
├── installer/
│   ├── windows/launcher.nsi   # NSIS installer script
│   └── linux/appimage.sh      # AppImage build script
├── update-manifest/
│   └── manifest.json          # Auto-updater feed (published to gh-pages)
└── build.gradle.kts
```

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `build.yml` | Push to `main`/`develop`, PRs | Builds JAR + native bridge on all 3 platforms |
| `release.yml` | Push tag `v*.*.*` | Packages installers, creates GitHub Release |
| `update-manifest.yml` | Release published | Generates `manifest.json`, pushes to `gh-pages` |

## Releasing

```bash
git tag v1.0.0
git push origin v1.0.0
```

That's it. The pipeline handles the rest.

## Auto-Updater Manifest URL

```
https://hamad-alharmi.github.io/gold-client/update-manifest/manifest.json
```

## Secrets Required

| Secret | Purpose |
|---|---|
| `GITHUB_TOKEN` | Auto-provided — releases, Pages |
| `SIGNING_KEYSTORE_BASE64` | Base64 JKS for JAR signing (optional) |
| `SIGNING_KEY_ALIAS` | Keystore alias |
| `SIGNING_KEY_PASSWORD` | Key password |
