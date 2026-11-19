# Grindstone asset collector — run from your phone

The GitHub Actions workflow runs the collectors on a GitHub-hosted Linux machine. You do not need Python, Termux, or a computer.

## Start a collection

1. Open the Grindstone repository on GitHub.
2. Open the **Actions** tab.
3. Select **Collect Seveneves and animated pixel-art asset packs**.
4. Tap **Run workflow**.
5. Leave **dry_run** unticked to download packs. Optionally set **limit** to a small number for a first test; leave it as 0 to process every eligible Seveneves pack.
6. Tap **Run workflow** to start.

When the run finishes, open that run and scroll to **Artifacts**. Download **seven-eves-asset-collection**. GitHub keeps the artifact for 30 days.

## What it collects

- Free/name-your-price Seveneves packs, using the original itch.io download-page flow.
- PVFX Foundry — CC0 animated effects including fire, water, waterfall, torch, fireflies, sparkles and weather loops.
- Mini Meadow — CC0 nature tiles with animated water and shoreline frames.
- SpritePilot Animated Environment Pack — CC0 water, lava, waterfall, wall torch, banner and swaying grass.

The animation sources and licence notes are documented in tools/README-animated-assets.md.

## Resume behaviour

- Completed source packs are checked against recorded file sizes and SHA-256 hashes and skipped when they still verify.
- Incomplete packs are retried on later runs.
- GitHub Actions cache preserves both collections between runs.
- The first run also attempts to seed the old Seveneves collection from the previous artifact.

## Safety and limitations

- Only public free/name-your-price pages and the listed CC0 animation packs are eligible.
- The workflow never enters payment details, pays, or bypasses access controls.
- itch.io may change its download page markup. Packs that cannot be resolved are recorded in manifest.json for manual follow-up.
- Review each pack's licence and included readme before using it.
- Do not commit downloaded source archives or raw third-party assets to the public Grindstone repository.
- The workflow runs headlessly; interactive consent or anti-bot challenges cannot be completed inside the run. If itch.io presents one, affected packs may need manual download.
