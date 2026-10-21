#!/usr/bin/env python3
"""Fetch an explicitly pinned Rust release for Website CI or deployment.

Local builds can instead set SDR_GAME_DIST and SDR_GAME_NATIVE_HOST directly.
The frontend artifact consumer verifies the extracted manifest and every file.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
import tempfile
from urllib.error import URLError
from urllib.request import urlopen


def fetch_artifact(url: str, digest: str, destination: Path) -> dict[str, str]:
    if not url or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("SDR_GAME_ARTIFACT_URL and its exact SDR_GAME_ARTIFACT_SHA256 are required")
    destination = destination.resolve()
    if destination.exists():
        raise ValueError("Rust artifact destination must be a new directory")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".rust-game-download-", dir=destination.parent) as work:
        archive = Path(work) / "artifact.tar.gz"
        try:
            with urlopen(url, timeout=60) as response, archive.open("wb") as output:
                shutil.copyfileobj(response, output, 1024 * 1024)
        except URLError as error:
            # Configured private URLs may contain a credential; never echo that URL.
            raise ValueError("Rust game artifact download failed") from error
        with archive.open("rb") as source:
            actual = hashlib.file_digest(source, "sha256").hexdigest()
        if actual != digest:
            raise ValueError("Rust game artifact archive SHA-256 mismatch")
        staged = Path(work) / "artifact"
        staged.mkdir()
        with tarfile.open(archive, "r:gz") as package:
            for member in package.getmembers():
                path = PurePosixPath(member.name)
                if (path.is_absolute() or ".." in path.parts or "\\" in member.name
                        or not (member.isfile() or member.isdir())):
                    raise ValueError("Rust artifact archive contains an unsafe entry")
            package.extractall(staged, filter="data")
        manifest = json.loads((staged / "game-artifact.json").read_text())
        executable = "solomon-darker.exe" if "windows" in manifest["target"] else "solomon-darker"
        if not (staged / "client").is_dir() or not (staged / "bin" / executable).is_file():
            raise ValueError("Rust artifact archive lacks its client or native host")
        staged.rename(destination)
    return {"dist": str(destination / "client"), "nativeHost": str(destination / "bin" / executable)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path, help="new extraction directory")
    args = parser.parse_args()
    try:
        result = fetch_artifact(os.environ.get("SDR_GAME_ARTIFACT_URL", ""),
                                os.environ.get("SDR_GAME_ARTIFACT_SHA256", ""), args.destination)
    except (ValueError, OSError, KeyError, tarfile.TarError) as error:
        parser.exit(1, f"Rust game artifact: {error}\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
