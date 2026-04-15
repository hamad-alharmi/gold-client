#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-1.0.0}"
APP_DIR="GoldClient.AppDir"

mkdir -p "$APP_DIR/usr/bin" "$APP_DIR/usr/lib"

cp dist/*.jar "$APP_DIR/usr/bin/gold-client.jar"
cp dist/native/*.so "$APP_DIR/usr/lib/" 2>/dev/null || true

cat > "$APP_DIR/AppRun" << 'EOF'
#!/bin/bash
exec java -jar "$(dirname "$0")/usr/bin/gold-client.jar" "$@"
EOF
chmod +x "$APP_DIR/AppRun"

cat > "$APP_DIR/GoldClient.desktop" << EOF
[Desktop Entry]
Name=Gold Client
Exec=AppRun
Icon=gold-client
Type=Application
Categories=Game;
EOF

./appimagetool-x86_64.AppImage "$APP_DIR" "GoldClient-x86_64.AppImage"
echo "AppImage built: GoldClient-x86_64.AppImage"
