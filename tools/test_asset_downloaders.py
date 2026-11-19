#!/usr/bin/env python3
"""Regression tests for the resumable asset collectors."""
from __future__ import annotations
import hashlib
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from animated_assets_downloader import download_name, record_is_complete
from seveneves_downloader import browser_attachment_is_original, pack_is_complete, record_has_duplicate_files

class AssetCollectorTests(unittest.TestCase):
    def test_direct_download_name_uses_fallback_without_content_disposition(self):
        response = SimpleNamespace(headers={}, url="https://cdn.example.test/")
        self.assertEqual(download_name(response, "spritepilot-environment.zip"), "spritepilot-environment.zip")

    def test_animated_manifest_requires_matching_file_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            asset = folder / "water.zip"
            asset.write_bytes(b"asset archive")
            record = {"status": "complete", "files": [{"path": "water.zip", "size": asset.stat().st_size, "sha256": hashlib.sha256(asset.read_bytes()).hexdigest()}]}
            self.assertTrue(record_is_complete(record, folder))
            asset.write_bytes(b"changed")
            self.assertFalse(record_is_complete(record, folder))

    def test_duplicate_browser_attachment_is_recognised_as_preview_only(self):
        record = {"files": [{"path": "preview.png", "sha256": "same-hash"}, {"path": "download.png", "sha256": "same-hash"}]}
        self.assertTrue(record_has_duplicate_files(record))
        self.assertFalse(browser_attachment_is_original(True, record["files"]))
        self.assertTrue(browser_attachment_is_original(True, [{"path": "source.png", "sha256": "unique"}]))
        unique = {"files": [{"path": "source.zip", "sha256": "one"}, {"path": "sheet.png", "sha256": "two"}]}
        self.assertFalse(record_has_duplicate_files(unique))

    def test_seveneves_manifest_requires_matching_file_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            asset = folder / "portrait.png"
            asset.write_bytes(b"source sprite sheet")
            record = {"status": "complete", "files": [{"path": "portrait.png", "size": asset.stat().st_size, "sha256": hashlib.sha256(asset.read_bytes()).hexdigest()}]}
            self.assertTrue(pack_is_complete(record, folder))
            asset.unlink()
            self.assertFalse(pack_is_complete(record, folder))

if __name__ == "__main__":
    unittest.main()
