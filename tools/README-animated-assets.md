# Animated pixel-art asset collector

This collector adds three curated CC0 sources to the Grindstone asset-collection workflow:

- **PVFX Foundry** — broad VFX library with fire, water, waterfalls, torches, fireflies, sparkles, weather and ambient loops.
- **Mini Meadow** — compact 16×16 nature tileset with animated water and shoreline frames.
- **SpritePilot Animated Environment Pack** — water, lava, waterfall, wall torch, banner and swaying grass.

All three pages identify their assets as CC0. The collector saves source archives, extracts ZIP contents safely, records SHA-256 hashes and skips a source pack only when its recorded files still verify.

## Run locally

\`\`\`bash
python -m pip install playwright
python -m playwright install chromium
python tools/animated_assets_downloader.py --out animated_assets_downloads
\`\`\`

Use \`--dry-run\` to list the curated sources without downloading.

## Licence and repository handling

The collected packs are stored as GitHub Actions artifacts, not committed to the public Grindstone repository. Keep each pack's licence/readme files alongside its source assets. Review actual contents and compatibility before integrating any sprite sheets into the game.

The collector does not buy paid packs, bypass access controls, or attempt to access private downloads.
