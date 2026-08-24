#!/usr/bin/env python3
"""Extract Solomon's exact Flydirt record and records 2..19 dig bank."""

import hashlib
import struct
import sys
from pathlib import Path

from PIL import Image


if len(sys.argv) != 2:
    raise SystemExit("Usage: extract-solomon-dig.py <path-to-game-images-dir>")

SOURCE = Path(sys.argv[1])
DIG_OUTPUT = Path(__file__).resolve().parent.parent / "frontend/src/assets/game/anim-solomon-dig.png"
DIRT_OUTPUT = Path(__file__).resolve().parent.parent / "frontend/src/assets/game/solomon-flydirt.png"
EXPECTED_ATLAS_SHA256 = "057a3661340a3a099cf88c491d88c4268d82b8bb48ab29d214961ce701140126"
EXPECTED_BUNDLE_SHA256 = "a4d85b56f79486361a4ae18a6b4bc2bc1c0e28ba1a57f96ef68cc64e09e9cafa"
EXPECTED_DIRT_SHA256 = "1a2631f8022e0bef521aa112e4059c9ab7df5f6bfafbe6235972b92788ee95e7"


def require_hash(path: Path, expected: str) -> None:
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != expected:
        raise RuntimeError(f"{path.name} SHA-256 {actual} != expected {expected}")


def parse_bundle(path: Path) -> list[dict[str, float | int]]:
    data = path.read_bytes()

    def plausible(offset: int) -> bool:
        if offset >= len(data):
            return offset == len(data)
        try:
            x, y, width, height = struct.unpack_from("<4f", data, offset)
            echoed_width, echoed_height = struct.unpack_from("<2f", data, offset + 24)
        except struct.error:
            return False
        return (
            0 <= x < 4096
            and 0 <= y < 4096
            and 0 < width <= 2048
            and 0 < height <= 2048
            and x == int(x)
            and y == int(y)
            and width == echoed_width
            and height == echoed_height
        )

    records = []
    offset = 0
    while offset < len(data):
        x, y, width, height = struct.unpack_from("<4f", data, offset)
        cell_width, cell_height = struct.unpack_from("<2i", data, offset + 16)
        origin_x, origin_y = struct.unpack_from("<2f", data, offset + 32)
        records.append({
            "x": int(x),
            "y": int(y),
            "width": int(width),
            "height": int(height),
            "cell_width": cell_width,
            "cell_height": cell_height,
            "origin_x": origin_x,
            "origin_y": origin_y,
        })
        next_offset = offset + 45
        while not plausible(next_offset):
            next_offset += 8
        offset = next_offset
    return records


atlas_path = SOURCE / "Solomon.png"
bundle_path = SOURCE / "Solomon.bundle"
require_hash(atlas_path, EXPECTED_ATLAS_SHA256)
require_hash(bundle_path, EXPECTED_BUNDLE_SHA256)
atlas = Image.open(atlas_path).convert("RGBA")
all_records = parse_bundle(bundle_path)
if len(all_records) != 273:
    raise RuntimeError(f"Solomon.bundle has {len(all_records)} records; expected 273")

dirt = all_records[0]
if dirt != {
    "x": 590,
    "y": 975,
    "width": 28,
    "height": 46,
    "cell_width": 28,
    "cell_height": 46,
    "origin_x": 0.0,
    "origin_y": 0.0,
}:
    raise RuntimeError(f"Solomon Flydirt record changed: {dirt}")
dirt_image = atlas.crop((590, 975, 618, 1021))
dirt_image.save(DIRT_OUTPUT, optimize=True)
dirt_sha256 = hashlib.sha256(DIRT_OUTPUT.read_bytes()).hexdigest()
if dirt_sha256 != EXPECTED_DIRT_SHA256:
    raise RuntimeError(
        f"Solomon Flydirt PNG SHA-256 {dirt_sha256} != expected {EXPECTED_DIRT_SHA256}",
    )

records = all_records[2:20]
if any(record["cell_width"] != 200 or record["cell_height"] != 200 for record in records):
    raise RuntimeError("Solomon Dig records no longer use the recovered 200x200 registration")

sheet = Image.new("RGBA", (200 * len(records), 200))
for index, record in enumerate(records):
    width = int(record["width"])
    height = int(record["height"])
    crop = atlas.crop((
        int(record["x"]),
        int(record["y"]),
        int(record["x"]) + width,
        int(record["y"]) + height,
    ))
    left = round(100 + float(record["origin_x"]) - width / 2)
    top = round(100 + float(record["origin_y"]) - height / 2)
    sheet.alpha_composite(crop, (index * 200 + left, top))

sheet.save(DIG_OUTPUT, optimize=True)
print(f"{DIRT_OUTPUT}: exact record 0, 28x46, SHA-256 {dirt_sha256}")
print(f"{DIG_OUTPUT}: {len(records)} exact frames, 200x200 cells")
