#!/usr/bin/env python3
"""Collect curated, free CC0 animated pixel-art packs without committing assets."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import time
import zipfile
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

from playwright.sync_api import sync_playwright

SOURCES = [
    {
        "id": "pvfx-foundry",
        "title": "PVFX Foundry",
        "url": "https://nerijs.itch.io/pvfx-foundry",
        "kind": "itch",
        "license": "CC0-1.0",
        "why": "253 pixel-art effects, including fire, water, waterfall, torch, fireflies, sparkles, weather and seamless ambient loops.",
    },
    {
        "id": "mini-meadow",
        "title": "Mini Meadow 16x16 Tileset",
        "url": "https://myobln.itch.io/game-assets",
        "kind": "itch",
        "license": "CC0-1.0",
        "why": "Animated water and shoreline frames, plus a compact nature tileset.",
    },
    {
        "id": "spritepilot-environment",
        "title": "SpritePilot Animated Environment Pack",
        "url": "https://spritepilot.com/free-game-assets/environment",
        "download_url": "https://spritepilot.com/free-assets/environment/spritepilot-environment-pack.zip?v=3eck",
        "kind": "direct",
        "license": "CC0-1.0",
        "why": "Looping water, lava, waterfall, wall torch, banner and swaying grass.",
    },
]

MANIFEST = "manifest.json"
ARCHIVE_EXTS = {".zip", ".7z", ".rar"}


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def digest_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def clean_name(value: str) -> str:
    value = re.sub(r"[\\/]+", "-", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    return re.sub(r"[^\w .()'_-]+", "", value)[:150] or "download"


def load_manifest(out: Path) -> dict:
    path = out / MANIFEST
    if not path.exists():
        return {"sources": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data.get("sources"), dict) else {"sources": {}}
    except (OSError, json.JSONDecodeError):
        return {"sources": {}}


def save_manifest(out: Path, manifest: dict) -> None:
    temp = out / (MANIFEST + ".tmp")
    temp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    temp.replace(out / MANIFEST)


def record_is_complete(record: dict, folder: Path) -> bool:
    if record.get("status") != "complete" or not record.get("files"):
        return False
    for item in record["files"]:
        path = folder / item["path"]
        if not path.is_file() or path.stat().st_size != item.get("size"):
            return False
        if digest_file(path) != item.get("sha256"):
            return False
    return True


def safe_extract(payload: bytes, destination: Path) -> int:
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        root = destination.resolve()
        for member in archive.infolist():
            target = (destination / member.filename).resolve()
            if target != root and root not in target.parents:
                raise ValueError(f"Unsafe ZIP member path: {member.filename}")
        archive.extractall(destination)
    return sum(1 for path in destination.rglob("*") if path.is_file())


def download_name(response, fallback: str) -> str:
    disposition = response.headers.get("content-disposition", "")
    match = re.search(r'filename\*?=(?:UTF-8\'\'|")?([^;"]+)', disposition, re.I)
    if match:
        return clean_name(unquote(match.group(1).strip().strip('"')))
    return clean_name(Path(unquote(urlparse(response.url).path)).name or fallback)


def itch_download_links(page) -> list[str]:
    links = set()
    for anchor in page.locator("a[href]").all():
        href = anchor.get_attribute("href") or ""
        full = urljoin(page.url, href)
        parsed = urlparse(full)
        host = parsed.netloc.lower()
        path = parsed.path.lower()
        if (host.endswith(".itch.zone") or host.endswith(".itch.io")) and (
            "/file/" in path or Path(path).suffix.lower() in ARCHIVE_EXTS
        ):
            links.add(full)
    return sorted(links)


def open_itch_download_page(page, source_url: str) -> bool:
    page.goto(source_url, wait_until="domcontentloaded", timeout=60000)
    body = page.locator("body").inner_text(timeout=15000).lower()
    if not ("name your own price" in body or "free download" in body or "download for free" in body):
        print("  [SKIP] Page no longer clearly advertises a free download.")
        return False

    for locator in (
        page.get_by_role("link", name=re.compile(r"download(?: now)?", re.I)),
        page.get_by_role("button", name=re.compile(r"download(?: now)?", re.I)),
        page.locator("a.button"),
    ):
        try:
            for index in range(min(locator.count(), 5)):
                item = locator.nth(index)
                label = (item.inner_text() or "").strip().lower()
                href = item.get_attribute("href") or ""
                if "download" in label or "/download" in href:
                    item.click(timeout=10000)
                    try:
                        page.wait_for_load_state("domcontentloaded", timeout=20000)
                    except Exception:
                        pass
                    page.wait_for_timeout(800)
                    break
            else:
                continue
            break
        except Exception:
            continue

    try:
        no_thanks = page.get_by_text(re.compile(r"no thanks, just take me to the downloads", re.I))
        if no_thanks.count():
            no_thanks.first.click(timeout=8000)
            page.wait_for_timeout(800)
    except Exception:
        pass
    return bool(itch_download_links(page))


def files_manifest(folder: Path) -> list[dict]:
    result = []
    for path in sorted(folder.rglob("*")):
        if path.is_file() and path.name not in {MANIFEST, MANIFEST + ".tmp"}:
            result.append({
                "path": str(path.relative_to(folder)),
                "size": path.stat().st_size,
                "sha256": digest_file(path),
            })
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path("animated_assets_downloads"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(args.out)

    if args.dry_run:
        for source in SOURCES:
            print(f"[CC0] {source['title']} — {source['url']}")
        print(f"Found {len(SOURCES)} curated CC0 animation packs. No files downloaded.")
        return

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        records = manifest.setdefault("sources", {})

        for index, source in enumerate(SOURCES, 1):
            folder = args.out / source["id"]
            folder.mkdir(parents=True, exist_ok=True)
            previous = records.get(source["id"], {})
            if record_is_complete(previous, folder):
                print(f"[SKIP: verified complete] {source['title']}")
                continue

            print(f"\n[{index}/{len(SOURCES)}] {source['title']}")
            record = {
                "title": source["title"],
                "url": source["url"],
                "license": source["license"],
                "status": "incomplete",
                "files": previous.get("files", []),
                "description": source["why"],
            }
            try:
                if source["kind"] == "direct":
                    response = context.request.get(source["download_url"], timeout=180000)
                    if not response.ok:
                        raise RuntimeError(f"HTTP {response.status} from direct pack URL")
                    payload = response.body()
                    filename = download_name(response, source["id"] + ".zip")
                    target = folder / filename
                    if not target.exists() or digest_file(target) != digest_bytes(payload):
                        target.write_bytes(payload)
                    if not zipfile.is_zipfile(io.BytesIO(payload)):
                        raise RuntimeError("Direct download was not a valid ZIP archive")
                    extracted = folder / "extracted"
                    if not (extracted / ".archive.sha256").exists() or (extracted / ".archive.sha256").read_text().strip() != digest_bytes(payload):
                        count = safe_extract(payload, extracted)
                        (extracted / ".archive.sha256").write_text(digest_bytes(payload), encoding="utf-8")
                    else:
                        count = sum(1 for p in extracted.rglob("*") if p.is_file())
                    if count == 0:
                        raise RuntimeError("Archive contained no files")
                    record["source_file_count"] = 1
                else:
                    if not open_itch_download_page(page, source["url"]):
                        raise RuntimeError("No real itch.io download-page file links found")
                    links = itch_download_links(page)
                    successful = 0
                    failures = []
                    for link in links:
                        try:
                            response = context.request.get(link, timeout=180000)
                            if not response.ok:
                                failures.append(f"HTTP {response.status}: {link}")
                                continue
                            payload = response.body()
                            filename = download_name(response, source["id"] + ".zip")
                            target = folder / filename
                            if not target.exists() or digest_file(target) != digest_bytes(payload):
                                target.write_bytes(payload)
                            if target.suffix.lower() == ".zip" and zipfile.is_zipfile(io.BytesIO(payload)):
                                extracted = folder / (target.stem + "_extracted")
                                marker = extracted / ".archive.sha256"
                                if not marker.exists() or marker.read_text(encoding="utf-8").strip() != digest_bytes(payload):
                                    safe_extract(payload, extracted)
                                    marker.parent.mkdir(parents=True, exist_ok=True)
                                    marker.write_text(digest_bytes(payload), encoding="utf-8")
                            successful += 1
                        except Exception as exc:
                            failures.append(f"{link}: {exc}")
                    record["source_file_count"] = len(links)
                    if failures or not successful:
                        record["failures"] = failures
                        raise RuntimeError("One or more source downloads failed; see manifest")
                files = files_manifest(folder)
                if not files:
                    raise RuntimeError("No files were saved")
                record.update(status="complete", files=files)
                print(f"  [COMPLETE] Saved {len(files)} files")
            except Exception as exc:
                record.update(status="incomplete", files=files_manifest(folder), error=str(exc))
                print(f"  [INCOMPLETE] {exc}")
            records[source["id"]] = record
            save_manifest(args.out, manifest)
            time.sleep(1)

        complete = sum(1 for item in records.values() if item.get("status") == "complete")
        print(f"\nFinished: {complete}/{len(SOURCES)} animation packs complete.")
        browser.close()


if __name__ == "__main__":
    main()
