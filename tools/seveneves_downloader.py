#!/usr/bin/env python3
"""Download public, free/zero-price Seveneves.ai itch.io asset packs.

Requires: pip install playwright
          playwright install chromium

The browser is intentionally visible so the user can handle any itch.io
consent/challenge screen. The script never submits a payment or accesses
paid-only files. It follows the creator's public profile and only proceeds
when the pack page advertises "Name your own price" or a free download.
"""
from __future__ import annotations

import argparse
import json
import re
import time
import zipfile
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

CREATOR_URL = "https://sevenevesai.itch.io/"
OUT = Path("seven_eves_downloads")
CREATOR_HOST = "sevenevesai.itch.io"


def slug_from_url(url: str) -> str:
    path = urlparse(url).path.strip("/")
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", path or "asset-pack")


def clean_name(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    return re.sub(r"[^\w .()'-]+", "", value)[:100] or "asset-pack"


def creator_games(page) -> list[str]:
    page.goto(CREATOR_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(900)
    found = set()
    for anchor in page.locator("a[href]").all():
        href = anchor.get_attribute("href") or ""
        parsed = urlparse(href)
        if parsed.netloc.lower() == CREATOR_HOST and parsed.path.strip("/") and not any(
            part in parsed.path for part in ("/purchase", "/download", "/user/")
        ):
            found.add(f"https://{CREATOR_HOST}/{parsed.path.strip('/')}")
    return sorted(found)


def is_free_or_pwyw(page) -> bool:
    text = page.locator("body").inner_text(timeout=10000).lower()
    # itch.io labels $0 minimum / pay-what-you-want packs as "Name your own price".
    # A paid minimum (e.g. "$7") is deliberately excluded.
    return (
        "name your own price" in text
        or re.search(r"\bfree download\b", text) is not None
        or re.search(r"\bdownload\s+for\s+free\b", text) is not None
    )


def click_download_flow(page) -> None:
    # Game page -> itch.io's optional contribution screen.
    for pattern in (re.compile(r"^download now$", re.I), re.compile(r"^download$", re.I)):
        locator = page.get_by_role("link", name=pattern)
        if locator.count():
            locator.first.click()
            page.wait_for_load_state("domcontentloaded")
            break

    # Choose the explicitly free route; no payment fields are ever submitted.
    no_thanks = page.get_by_text(re.compile(r"no thanks, just take me to the downloads", re.I))
    if no_thanks.count():
        no_thanks.first.click()
        page.wait_for_load_state("domcontentloaded")


def get_download_links(page) -> list[tuple[str, str]]:
    links = []
    for a in page.locator("a[href]").all():
        href = a.get_attribute("href") or ""
        label = clean_name(a.inner_text() or "")
        full = page.evaluate("(u) => new URL(u, location.href).href", href)
        parsed = urlparse(full)
        host = parsed.netloc.lower()
        is_itch_download_host = host.endswith(".itch.zone") or host.endswith(".itch.io")
        looks_like_file = "/file/" in parsed.path or re.search(r"\.(zip|png|7z|rar|aseprite)(?:$|\?)", full, re.I) is not None
        if is_itch_download_host and looks_like_file:
            if full not in {item[0] for item in links}:
                links.append((full, label or Path(parsed.path).name or "download"))
    return links


def safe_extract(archive: Path, destination: Path) -> None:
    """Extract a ZIP without allowing paths to escape the destination."""
    root = destination.resolve()
    with zipfile.ZipFile(archive) as zf:
        for member in zf.infolist():
            target = (destination / member.filename).resolve()
            if target != root and root not in target.parents:
                raise ValueError(f"Unsafe ZIP member path: {member.filename}")
        zf.extractall(destination)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=OUT, help="download destination")
    parser.add_argument("--limit", type=int, default=0, help="limit number of eligible packs (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="list eligible packs without downloading")
    parser.add_argument("--headed", action="store_true", help="show the browser (not suitable for GitHub Actions)")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        urls = creator_games(page)
        eligible = []
        for url in urls:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                title = clean_name(page.title().replace(" by Seveneves.ai - itch.io", ""))
                if is_free_or_pwyw(page):
                    eligible.append((url, title))
                    print(f"[FREE/PWYW] {title} — {url}")
                else:
                    print(f"[SKIP: paid or unclear] {title} — {url}")
            except Exception as exc:
                print(f"[WARN] Could not inspect {url}: {exc}")

        if args.limit:
            eligible = eligible[: args.limit]
        if args.dry_run:
            (args.out / "manifest.json").write_text(json.dumps([
                {"title": title, "url": url, "status": "eligible-not-downloaded"}
                for url, title in eligible
            ], indent=2), encoding="utf-8")
            print(f"\nFound {len(eligible)} free/name-your-price packs. No files downloaded.")
            browser.close()
            return

        manifest = []
        for index, (url, title) in enumerate(eligible, 1):
            folder = args.out / f"{slug_from_url(url)}"
            folder.mkdir(parents=True, exist_ok=True)
            print(f"\n[{index}/{len(eligible)}] {title}")
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                click_download_flow(page)
                links = get_download_links(page)
                if not links:
                    print("  [MANUAL] No direct file links found; inspect this page in the open browser.")
                    manifest.append({"title": title, "url": url, "status": "manual-check"})
                    continue
                saved = []
                for file_url, label in links:
                    try:
                        # Download through the authenticated browser context; never POST payment.
                        response = context.request.get(file_url, timeout=120000)
                        if not response.ok:
                            print(f"  [WARN] HTTP {response.status}: {label}")
                            continue
                        filename = Path(urlparse(file_url).path).name or label
                        filename = clean_name(filename)
                        target = folder / filename
                        target.write_bytes(response.body())
                        saved.append(str(target))
                        print(f"  Saved {target.name}")
                        if target.suffix.lower() == ".zip":
                            extract_to = folder / target.stem
                            extract_to.mkdir(exist_ok=True)
                            try:
                                safe_extract(target, extract_to)
                                print(f"  Extracted to {extract_to}")
                            except zipfile.BadZipFile:
                                print(f"  [WARN] {target.name} was not a valid ZIP")
                    except Exception as exc:
                        print(f"  [WARN] Download failed for {label}: {exc}")
                manifest.append({
                    "title": title, "url": url, "status": "downloaded" if saved else "no-files",
                    "files": saved,
                })
            except Exception as exc:
                print(f"  [WARN] Could not download {title}: {exc}")
                manifest.append({"title": title, "url": url, "status": "error", "error": str(exc)})
            time.sleep(1)

        (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        (args.out / "README.txt").write_text(
            "Seveneves.ai itch.io asset collection\n"
            "Downloaded from public free/name-your-price pages.\n"
            "Review each pack's included licence before integrating it.\n"
            "Do not redistribute the original packs or standalone assets.\n",
            encoding="utf-8",
        )
        print(f"\nFinished. Review {args.out / 'manifest.json'} and each pack's licence.")
        browser.close()


if __name__ == "__main__":
    main()
