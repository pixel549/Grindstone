# Building the APK (for humans and bots)

`build.sh` produces a signed `build/Grindstone.apk` with no Gradle. It works in a stock Ubuntu 24.04 cloud sandbox
where only apt, PyPI, npm and GitHub are reachable (Google's SDK hosts and Maven are blocked). Takes about a minute.

## One-time setup (Ubuntu 24.04, needs sudo)

```bash
sudo apt-get update
sudo apt-get install -y aapt apksigner zipalign dalvik-exchange android-framework-res openjdk-17-jdk-headless
# android.jar for API 34 (compile-time stubs). Google's host is blocked, so take it from GitHub:
git clone --depth 1 --filter=blob:none --sparse https://github.com/Reginer/aosp-android-jar.git /tmp/aj
git -C /tmp/aj sparse-checkout set android-34
mkdir -p ../sdk && cp /tmp/aj/android-34/android.jar ../sdk/android-34.jar
```

Gotchas:
- Install **`dalvik-exchange`**, not `dx`. On Ubuntu `dx` is IBM Data Explorer and fails with "unrecognized parameter".
- Do not install `google-android-platform-*-installer`: it downloads from Google at install time, fails, and leaves apt broken.
- `android-sdk-platform-23` is too old: no `windowSplashScreenBackground`, widget attrs (`targetCellWidth`,
  `previewLayout`, `clipToOutline`) or `MediaStore.Downloads`. That is why resources link against `framework-res.apk`
  (Android 14) and Java compiles against the API 34 jar.

## Build

```bash
ANDROID_JAR=../sdk/android-34.jar \
ANDROID_RES=/usr/share/android-framework-res/framework-res.apk \
KEYSTORE=/path/to/grindstone.jks ./build.sh
```

Output: `build/Grindstone.apk`. Copy it to `Grindstone-<version>.apk` and send it to the user as a file.
On a machine with a real SDK, `ANDROID_RES` can be left out (it defaults to `ANDROID_JAR`).

## Before building

- Bump `versionCode` and `versionName` in `AndroidManifest.xml` (each build must be higher than the last).
- `node --check assets/*.js`, and run the logic tests (`node test/oracle_logic.js`, `people_logic.js`, `events.js`).
  `test/omens.js` rewrites `test/omens.json`; `git checkout` it afterwards.
- Verify: `apksigner verify --print-certs build/Grindstone.apk` and `aapt dump badging build/Grindstone.apk | head -1`.

## Signing key (important)

An update only installs over an existing copy if it is signed with the **same key**. `build.sh` generates a new
`grindstone.jks` if `KEYSTORE` doesn't exist, which gives an APK that will NOT install over the user's current app
(they must uninstall first, which loses app data unless they export a backup). `*.jks` is git-ignored on purpose.
The original `grindstone.jks` (password and alias both `grindstone`) is kept in the user's Google Drive; its location is
in the Claude Project instructions for "Grindstone". Fetch it with the Drive connector or ask the user to attach it,
and pass it as `KEYSTORE`. Never commit it or put its link in this repo (the repo is public). Confirm the built APK's
cert SHA-256 is `47d9ce55e01ccea09489d9a5dd76b8016b06a78f5e93f2a4178db671c042ea51`. If you ever have to generate a
new key, tell the user plainly.
