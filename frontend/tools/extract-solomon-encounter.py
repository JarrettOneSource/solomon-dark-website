#!/usr/bin/env python3
"""Extract the exact registered Solomon Dig dialogue and escape banks.

Usage: extract-solomon-encounter.py <path-to-game-images-dir>

The output is a 15-column grid of native 200x200 logical cells:
row 0 is the survival dialogue body (Solomon records 213..227), rows 1..3
are its three mouth poses (228..272), and rows 4..9 are the six escape-walk
poses (95..184). Direction is the column in every row.
"""

import hashlib
import struct
import sys
from pathlib import Path

from PIL import Image


EXPECTED_ATLAS_SHA256 = "057a3661340a3a099cf88c491d88c4268d82b8bb48ab29d214961ce701140126"
EXPECTED_BUNDLE_SHA256 = "a4d85b56f79486361a4ae18a6b4bc2bc1c0e28ba1a57f96ef68cc64e09e9cafa"
CELL_SIZE = 200
DIRECTION_COUNT = 15

if len(sys.argv) != 2:
    raise SystemExit("Usage: extract-solomon-encounter.py <path-to-game-images-dir>")

source = Path(sys.argv[1])
atlas_path = source / "Solomon.png"
bundle_path = source / "Solomon.bundle"
output = Path(__file__).resolve().parent.parent / "src/assets/game/anim-solomon-encounter.png"


def require_hash(path: Path, expected: str) -> bytes:
    data = path.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise RuntimeError(f"{path.name} SHA-256 {actual} != expected {expected}")
    return data


def parse_bundle(data: bytes) -> list[dict[str, float | int]]:
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
        offset += 45
        while not plausible(offset):
            offset += 8
    return records


require_hash(atlas_path, EXPECTED_ATLAS_SHA256)
records = parse_bundle(require_hash(bundle_path, EXPECTED_BUNDLE_SHA256))
if len(records) != 273:
    raise RuntimeError(f"Solomon.bundle has {len(records)} records; expected 273")

record_rows = [
    list(range(213, 228)),
    list(range(228, 243)),
    list(range(243, 258)),
    list(range(258, 273)),
    *[list(range(95 + pose * 15, 110 + pose * 15)) for pose in range(6)],
]
selected = [records[index] for row in record_rows for index in row]
if any(
    record["cell_width"] != CELL_SIZE or record["cell_height"] != CELL_SIZE
    for record in selected
):
    raise RuntimeError("Solomon encounter records no longer use 200x200 registration")

atlas = Image.open(atlas_path).convert("RGBA")
sheet = Image.new(
    "RGBA",
    (DIRECTION_COUNT * CELL_SIZE, len(record_rows) * CELL_SIZE),
)
for row_index, row in enumerate(record_rows):
    for direction, record_index in enumerate(row):
        record = records[record_index]
        width = int(record["width"])
        height = int(record["height"])
        crop = atlas.crop((
            int(record["x"]),
            int(record["y"]),
            int(record["x"]) + width,
            int(record["y"]) + height,
        ))
        left = round(CELL_SIZE / 2 + float(record["origin_x"]) - width / 2)
        top = round(CELL_SIZE / 2 + float(record["origin_y"]) - height / 2)
        sheet.alpha_composite(crop, (
            direction * CELL_SIZE + left,
            row_index * CELL_SIZE + top,
        ))

sheet.save(output, optimize=True)
digest = hashlib.sha256(output.read_bytes()).hexdigest()
print(f"{output}: {DIRECTION_COUNT}x{len(record_rows)} exact 200px cells, SHA-256 {digest}")
