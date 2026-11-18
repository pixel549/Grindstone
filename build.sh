#!/usr/bin/env bash
# Builds a signed Grindstone APK without Gradle or the Android SDK manager.
# Needs: aapt, dalvik-exchange (dx), zipalign, apksigner, a JDK, and android-34.jar.
set -euo pipefail
unset JAVA_TOOL_OPTIONS
cd "$(dirname "$0")"
ANDROID_JAR="${ANDROID_JAR:-../sdk/android-34.jar}"
# Framework resources aapt links against. Defaults to ANDROID_JAR; set it to an API 31+ framework-res.apk when
# ANDROID_JAR is an older stub jar (see BUILDING.md).
ANDROID_RES="${ANDROID_RES:-$ANDROID_JAR}"
KEYSTORE="${KEYSTORE:-grindstone.jks}"
KS_PASS="${KS_PASS:-grindstone}"
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/obj"

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias grindstone \
    -keyalg RSA -keysize 2048 -validity 20000 -dname "CN=Grindstone, O=Jake, C=AU" >/dev/null 2>&1
fi

# The 2D Hearth needs no build step: assets/hearth2d.js and assets/lpchero.js run as they are, and the art in
# assets/2d/ is baked by tools2d/bake_world.py and tools2d/bake_hero.py. (The old 3D Hearth lives in legacy3d/ and src3d/.)
rm -f assets/_*.html

echo "› resources"
aapt package -f -m -J "$OUT/gen" -S res -M AndroidManifest.xml -I "$ANDROID_RES"

echo "› compile"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -d "$OUT/obj" \
  $(find src "$OUT/gen" -name '*.java')

echo "› dex"
dalvik-exchange --dex --min-sdk-version=26 --output="$OUT/classes.dex" "$OUT/obj"

echo "› package"
aapt package -f -0 arsc -0 glb -M AndroidManifest.xml -S res -A assets -I "$ANDROID_RES" -F "$OUT/unaligned.apk"
(cd "$OUT" && aapt add unaligned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/unaligned.apk" "$OUT/aligned.apk"

echo "› sign"
apksigner sign --v2-signing-enabled true --v3-signing-enabled true --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --out "$OUT/Grindstone.apk" "$OUT/aligned.apk"
apksigner verify "$OUT/Grindstone.apk"
ls -la "$OUT/Grindstone.apk"
