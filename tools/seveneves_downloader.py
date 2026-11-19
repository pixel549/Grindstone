#!/usr/bin/env python3
"""Resumable collector for public free/name-your-price Seveneves itch.io packs.

Only public free/zero-minimum downloads are followed. The collector downloads
all files listed on itch.io's actual download page, prefers original archives,
extracts ZIPs safely, and records per-file hashes so completed files are not
downloaded again on later workflow runs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import zipfile
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

from playwright.sync_api import sync_playwright

CREATOR_URL = "https://sevenevesai.itch.io/"
CREATOR_HOST = "sevenevesai.itch.io"
OUT = Path("seven_eves_downloads")
ARCHIVE_EXTS = {".zip", ".7z", ".rar", ".tar", ".gz", ".aseprite"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MANIFEST_NAME = "manifest.json"


def slug_from_url(url: str) -> str:
    path = urlparse(url).path.strip("/")
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", path or "asset-pack")


def clean_name(value: str) -> str:
    value = re.sub(r"[\/]+", "-", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    return re.sub(r"[^\w .()'_-]+", "", value)[:140] or "download"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(out: Path) -> dict:
    path = out / MANIFEST_NAME
    if not path.exists():
        return {"packs": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):  # migrate the original collector's manifest
            return {"packs": {item.get("url", ""): item for item in data if item.get("url")}}
        return data if isinstance(data.get("packs"), dict) else {"packs": {}}
    except (OSError, json.JSONDecodeError):
        return {"packs": {}}


def save_manifest(out: Path, manifest: dict) -> None:
    temp = out / (MANIFEST_NAME + ".tmp")
    temp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    temp.replace(out / MANIFEST_NAME)


def creator_games(page) -> list[str]:
    page.goto(CREATOR_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(1200)
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
    body = page.locator("body").inner_text(timeout=15000).lower()
    return (
        "name your own price" in body
        or re.search(r"\bfree download\b", body) is not None
        or re.search(r"\bdownload\s+for\s+free\b", body) is not None
    )


def get_download_links(page) -> list[tuple[str, str]]:
    """Collect direct file links from the download page and embedded frames."""
    found: dict[str, str] = {}
    for frame in page.frames:
        try:
            anchors = frame.locator("a[href]").all()
        except Exception:
            continue
        for anchor in anchors:
            try:
                href = anchor.get_attribute("href") or ""
                if not href:
                    continue
                full = urljoin(frame.url, href)
                parsed = urlparse(full)
                host = parsed.netloc.lower()
                path = parsed.path.lower()
                if not (host.endswith(".itch.zone") or host.endswith(".itch.io")):
                    continue
                label = clean_name(anchor.inner_text() or "")
                if "/file/" in path or Path(path).suffix.lower() in ARCHIVE_EXTS | IMAGE_EXTS:
                    found.setdefault(full, label or Path(unquote(parsed.path)).name or "download")
            except Exception:
                continue
    return sorted(found.items(), key=lambda item: (
        Path(urlparse(item[0]).path).suffix.lower() not in ARCHIVE_EXTS,
        item[0],
    ))


def open_download_page(page, folder: Path) -> tuple[bool, bool]:
    """Follow itch's explicit zero-cost route, then resolve or trigger the file download."""
    start_url = page.url
    download_now = re.compile(r"download(?: now)?", re.I)
    candidates = [
        page.get_by_role("link", name=download_now),
        page.get_by_role("button", name=download_now),
        page.locator("a.button"),
    ]
    for locator in candidates:
        try:
            for index in range(min(locator.count(), 5)):
                item = locator.nth(index)
                label = (item.inner_text() or "").strip().lower()
                href = item.get_attribute("href") or ""
                if "download" in label or "/download" in href:
                    item.click(timeout=10000)
                    try:
                        page.wait_for_load_state("domcontentloaded", timeout=15000)
                    except Exception:
                        pass
                    page.wait_for_timeout(900)
                    break
            else:
                continue
            break
        except Exception as exc:
            print(f"  [DEBUG] Download Now control: {exc}")

    no_thanks = re.compile(r"no thanks, just take me to the downloads", re.I)
    clicked_no_thanks = False
    for locator in (
        page.get_by_role("button", name=no_thanks),
        page.get_by_role("link", name=no_thanks),
        page.get_by_text(no_thanks),
    ):
        try:
            if locator.count():
                locator.first.click(timeout=10000, force=True)
                clicked_no_thanks = True
                try:
                    page.wait_for_load_state("domcontentloaded", timeout=15000)
                except Exception:
                    pass
                page.wait_for_timeout(1400)
                break
        except Exception as exc:
            print(f"  [DEBUG] No-thanks control: {exc}")

    links = get_download_links(page)
    browser_downloaded = False

    # Some itch download pages provide a Download button rather than a visible file URL.
    if not links:
        exact_download = re.compile(r"^download(?: file)?$", re.I)
        for frame in page.frames:
            for locator in (
                frame.get_by_role("link", name=exact_download),
                frame.get_by_role("button", name=exact_download),
            ):
                try:
                    if not locator.count():
                        continue
                    with page.expect_download(timeout=15000) as download_info:
                        locator.first.click(timeout=8000, force=True)
                    download = download_info.value
                    filename = clean_name(download.suggested_filename)
                    target = folder / filename
                    download.save_as(target)
                    if target.suffix.lower() == ".zip":
                        extract_to = folder / (target.stem + "_extracted")
                        safe_extract(target, extract_to)
                        (extract_to / ".extracted.sha256").write_text(sha256(target), encoding="utf-8")
                    browser_downloaded = True
                    print(f"  Downloaded via browser: {target.name} ({target.stat().st_size} bytes)")
                    break
                except Exception as exc:
                    print(f"  [DEBUG] Browser download control: {exc}")
            if browser_downloaded:
                break

    links = get_download_links(page)
    print(f"  [DEBUG] Download flow: {start_url} -> {page.url}")
    print(f"  [DEBUG] No-thanks action: {'clicked' if clicked_no_thanks else 'not found'}; file links: {len(links)}; browser download: {browser_downloaded}")
    for link, _ in links[:5]:
        print(f"  [DEBUG] File link: {link}")
    return bool(links) or browser_downloaded, browser_downloaded


def filename_from_response(response, url: str, label: str) -> str:
    headers = response.headers
    disposition = headers.get("content-disposition", "")
    match = re.search(r"filename\*?=(?:UTF-8''|\")?([^;\"]+)", disposition, re.I)
    if match:
        candidate = unquote(match.group(1).strip().strip('"'))
    else:
        candidate = Path(unquote(urlparse(response.url or url).path)).name or label
    return clean_name(candidate)


def safe_extract(archive: Path, destination: Path) -> None:
    root = destination.resolve()
    with zipfile.ZipFile(archive) as zf:
        for member in zf.infolist():
            target = (destination / member.filename).resolve()
            if target != root and root not in target.parents:
                raise ValueError(f"Unsafe ZIP member path: {member.filename}")
        zf.extractall(destination)


def pack_files(folder: Path) -> list[dict]:
    result = []
    for path in sorted(folder.rglob("*")):
        if path.is_file() and path.name not in {MANIFEST_NAME, MANIFEST_NAME + ".tmp"}:
            result.append({
                "path": str(path.relative_to(folder)),
                "size": path.stat().st_size,
                "sha256": sha256(path),
            })
    return result


def pack_is_complete(record: dict, folder: Path) -> bool:
    if record.get("status") != "complete" or not record.get("files"):
        return False
    for item in record["files"]:
        path = folder / item["path"]
        if not path.is_file() or path.stat().st_size != item.get("size"):
            return False
        if item.get("sha256") and sha256(path) != item["sha256"]:
            return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--limit", type=int, default=0, help="limit eligible packs (0 = all)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest(args.out)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        urls = creator_games(page)
        eligible = []
        for url in urls:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                title = clean_name(page.title().replace(" by Seveneves.ai - itch.io", ""))
                if is_free_or_pwyw(page):
                    eligible.append((url, title))
                    print(f"[FREE/PWYW] {title} — {url}")
                else:
                    print(f"[SKIP: paid or unclear] {title} — {url}")
            except Exception as exc:
                print(f"[WARN] Could not inspect {url}: {exc}")

        if args.limit:
            eligible = eligible[:args.limit]
        if args.dry_run:
            print(f"\nFound {len(eligible)} eligible packs. No files downloaded.")
            browser.close()
            return

        records = manifest.setdefault("packs", {})
        for index, (url, title) in enumerate(eligible, 1):
            folder = args.out / slug_from_url(url)
            folder.mkdir(parents=True, exist_ok=True)
            previous = records.get(url, {})
            if pack_is_complete(previous, folder):
                print(f"[SKIP: already complete] {title}")
                continue

            print(f"\n[{index}/{len(eligible)}] {title}")
            record = {"title": title, "url": url, "status": "incomplete", "files": previous.get("files", [])}
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                reached_downloads, browser_downloaded = open_download_page(page, folder)
                links = get_download_links(page)
                if not reached_downloads:
                    record.update(status="manual-check", note="Could not reach a download page with file links; no preview images counted as a complete pack.")
                    records[url] = record
                    save_manifest(args.out, manifest)
                    print("  [MANUAL] No actual download-page files found.")
                    continue

                successful = 1 if browser_downloaded else 0
                failed = []
                for file_url, label in links:
                    try:
                        response = context.request.get(file_url, timeout=180000)
                        if not response.ok:
                            failed.append(f"{label}: HTTP {response.status}")
                            continue
                        content_type = response.headers.get("content-type", "").lower()
                        if "text/html" in content_type:
                            failed.append(f"{label}: itch.io returned a web page instead of an asset file")
                            continue
                        payload = response.body()
                        if not payload:
                            failed.append(f"{label}: empty download")
                            continue
                        filename = filename_from_response(response, file_url, label)
                        if not Path(filename).suffix and zipfile.is_zipfile(io.BytesIO(payload)):
                            filename += ".zip"
                        target = folder / filename
                        digest = hashlib.sha256(payload).hexdigest()
                        if target.exists() and target.stat().st_size == len(payload) and sha256(target) == digest:
                            print(f"  Already present: {target.name}")
                        else:
                            target.write_bytes(payload)
                            print(f"  Downloaded: {target.name} ({len(payload)} bytes)")
                        successful += 1
                        if target.suffix.lower() == ".zip":
                            extract_to = folder / (target.stem + "_extracted")
                            marker = extract_to / ".extracted.sha256"
                            if not marker.exists() or marker.read_text(encoding="utf-8").strip() != digest:
                                extract_to.mkdir(exist_ok=True)
                                try:
                                    safe_extract(target, extract_to)
                                    marker.write_text(digest, encoding="utf-8")
                                    print(f"  Extracted: {extract_to.name}")
                                except zipfile.BadZipFile:
                                    failed.append(f"{target.name}: invalid ZIP archive")
                    except Exception as exc:
                        failed.append(f"{label}: {exc}")

                files = pack_files(folder)
                # A preview-only set is not accepted as a completed original pack.
                has_archive = any(Path(item["path"]).suffix.lower() in ARCHIVE_EXTS for item in files)
                if successful and not failed and (has_archive or any(Path(urlparse(link).path).suffix.lower() not in IMAGE_EXTS for link, _ in links)):
                    record.update(status="complete", files=files, source_file_count=len(links))
                else:
                    record.update(status="incomplete", files=files, source_file_count=len(links), failed=failed,
                                  note="A pack is only complete when all listed downloads succeed and the page exposes an original archive or non-preview source files.")
                records[url] = record
                save_manifest(args.out, manifest)
            except Exception as exc:
                record.update(status="error", error=str(exc))
                records[url] = record
                save_manifest(args.out, manifest)
                print(f"  [WARN] {exc}")
            time.sleep(1)

        (args.out / "README.txt").write_text(
            "Seveneves.ai itch.io asset collection\n"
            "Collected from public free/name-your-price download pages only.\n"
            "The manifest records source URLs, completion state and SHA-256 hashes.\n"
            "Review each pack's licence before integrating it. Do not redistribute assets where prohibited.\n",
            encoding="utf-8",
        )
        complete = sum(1 for item in records.values() if item.get("status") == "complete")
        print(f"\nFinished: {complete}/{len(eligible)} eligible packs marked complete.")
        browser.close()
        if complete < len(eligible):
            raise SystemExit(2)


if __name__ == "__main__":
    main()
