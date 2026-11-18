#!/usr/bin/env bash
# Builds a browser copy of Grindstone in web/ from assets/ (no Android needed).
# Usage: tools/web/build_web.sh [outdir]   Serve with: cd web && python3 -m http.server 8765
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-web}"
rm -rf "$OUT" && mkdir -p "$OUT"
cp -r assets/. "$OUT"/
rm -f "$OUT"/_*.html "$OUT"/widgetcam.html
cp tools/web/native-shim.js "$OUT"/native-shim.js
# load the shim before the app, right after the stylesheets
sed -i 's#<script src="core.js"></script>#<script src="native-shim.js"></script>\n<script src="core.js"></script>#' "$OUT"/index.html
grep -q native-shim "$OUT"/index.html || { echo "shim not injected"; exit 1; }
echo "web build in $OUT/ ($(find "$OUT" -type f | wc -l) files)"
