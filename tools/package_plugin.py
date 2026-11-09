#!/usr/bin/env python3
"""Build an optional manual-install ZIP from the Hub-discoverable payload.

Normal Plugin Hub discovery reads loose files from an immutable stable Release
tag; it does not require a ZIP. This archive is for manual SD-card installation.
"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = "vocabulary-highlights"
PAYLOAD = ROOT / f"{PLUGIN}.crosspoint-plugin"
VERSION_RE = re.compile(r"\d+\.\d+\.\d+")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def runtime_files() -> tuple[str, list[tuple[str, Path]]]:
    manifest = json.loads((PAYLOAD / "manifest.json").read_text(encoding="utf-8"))
    version = manifest.get("version")
    require(manifest.get("name") == PLUGIN, "payload ID must match the install directory")
    require(isinstance(version, str) and VERSION_RE.fullmatch(version) is not None,
            "invalid manifest version")
    files = manifest.get("files")
    require(isinstance(files, list) and bool(files), "manifest must declare installed files")
    require(all(isinstance(name, str) for name in files), "manifest filenames must be strings")
    require(len(set(files)) == len(files), "duplicate manifest file")
    require("manifest.json" in files and ("plugin.js" in files or "device.json" in files),
            "required plugin entry points missing")

    installed: list[tuple[str, Path]] = []
    for name in files:
        require(bool(name) and "\\" not in name and not name.startswith("/") and
                all(part not in ("", ".", "..") for part in name.split("/")),
                f"unsafe manifest file path: {name}")
        source = (PAYLOAD / name).resolve()
        require(source.is_relative_to(PAYLOAD.resolve()), f"file escaped payload: {name}")
        require(source.is_file(), f"missing installed file: {name}")
        installed.append((name, source))
    return version, installed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate without creating an archive")
    args = parser.parse_args()
    version, installed = runtime_files()
    if args.check:
        print(f"Plugin Hub payload valid: {PLUGIN} v{version}, {len(installed)} runtime files")
        return

    output_dir = ROOT / "dist"
    output_dir.mkdir(exist_ok=True)
    output = output_dir / f"{PLUGIN}-{version}.zip"
    with zipfile.ZipFile(output, "w") as archive:
        for name, source in sorted(installed):
            info = zipfile.ZipInfo(f"{PLUGIN}/{name}", date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, source.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    print(f"Manual-install archive: {output}")
    print(f"{len(installed)} declared files; extract under /.crosspoint/plugins/")


if __name__ == "__main__":
    main()
