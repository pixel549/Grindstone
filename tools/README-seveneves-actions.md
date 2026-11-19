# Seveneves asset collector — run from your phone

The GitHub Actions workflow runs the downloader on a GitHub-hosted Linux machine. You do not need Python, Termux, or a computer.

## Start a collection

1. Open the Grindstone repository on GitHub.
2. Open the **Actions** tab.
3. Select **Collect Seveneves free asset packs** in the workflow list.
4. Tap **Run workflow**.
5. Leave **dry_run** unticked to download packs. Optionally set **limit** to a small number for a first test; leave it as `0` to process every eligible pack.
6. Tap **Run workflow** to start.

When the run finishes, open that run and scroll to **Artifacts**. Download **seven-eves-asset-collection**. GitHub keeps the artifact for seven days.

## Safety and limitations

- Only public creator pages advertised as **Name your own price** or explicitly free are eligible. Paid or unclear pages are skipped.
- The workflow never enters payment details, pays, or bypasses access controls.
- itch.io may change its download page markup. Packs that cannot be resolved are recorded in `manifest.json` for manual follow-up.
- The manifest records each pack URL and collection status. Review the licence included with every pack before using it.
- Do not upload the downloaded source archives or raw third-party assets into the public Grindstone repository where the licence prohibits redistribution.
- The workflow runs headlessly; interactive consent or anti-bot challenges cannot be completed inside the run. If itch.io presents one, affected packs may need manual download.
