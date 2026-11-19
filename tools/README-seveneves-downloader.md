# Seveneves free-pack downloader

This utility collects the public free / name-your-price ($0 minimum) packs listed on Seveneves.ai's itch.io creator page. It does not download paid packs or submit payments.

## Run on Windows

1. Install Python 3.10+.
2. Open a terminal in this folder.
3. Run:

```powershell
py -m pip install playwright
py -m playwright install chromium
py seveneves_downloader.py --dry-run
py seveneves_downloader.py
```

The first command only lists packs the script identifies as free/PWYW. The second opens a visible browser, follows each free download flow, saves files under `seven_eves_downloads/`, extracts ZIPs and writes a manifest.

## Notes

- The browser is visible so any consent page or anti-bot challenge can be handled normally.
- It never fills in payment details or clicks a paid purchase option.
- itch.io can change its page markup; if a pack is marked for manual review, open that pack in the browser and download it normally.
- Some creator pages contain paid products with separate free samples. The script currently targets full packs advertised as free or name-your-price; it does not automatically infer free sample links on paid product pages.
- Review each downloaded pack's licence before use. The packs generally allow use in commercial games but prohibit redistribution of the original asset files.
- Keep downloaded third-party source ZIPs out of the public Grindstone repository.
