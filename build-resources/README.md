# Build Resources

Place your app icons here before building:

## Required files:

| File | Size | Used for |
|------|------|----------|
| `icon.ico` | 256x256 (multi-size ICO) | Windows installer + taskbar |
| `icon.icns` | macOS icon bundle | macOS DMG |
| `icon.png` | 512x512 PNG | Linux AppImage |
| `installerSidebar.bmp` | 164x314 BMP | Optional — NSIS installer sidebar art |

## How to generate:

If you have a 1024x1024 PNG logo:

```bash
# Install electron-icon-builder
npm install -g electron-icon-builder

# Generate all formats from your source PNG
electron-icon-builder --input=logo.png --output=./build-resources
```

Or use online tools:
- https://www.icoconverter.com  (PNG → ICO)
- https://cloudconvert.com/png-to-icns  (PNG → ICNS)

## Without icons:

If no icon files are present, electron-builder will use its default icon.
The app will still build and run — icons are cosmetic only.

To build without providing icons, remove the icon references from `package.json`:
```json
"win": {
  "target": [{ "target": "nsis", "arch": ["x64"] }]
}
```
