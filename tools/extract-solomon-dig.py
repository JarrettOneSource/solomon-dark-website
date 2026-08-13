#!/usr/bin/env python3
"""Extract Solomon.bundle records 2..19 into exact registered 200px cells."""

import struct
import sys
from pathlib import Path

from PIL import Image


if len(sys.argv) != 2:
    raise SystemExit("Usage: extract-solomon-dig.py <path-to-game-images-dir>")

SOURCE = Path(sys.argv[1])
OUTPUT = Path(__file__).resolve().parent.parent / "frontend/src/assets/game/anim-solomon-dig.png"


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


atlas = Image.open(SOURCE / "Solomon.png").convert("RGBA")
records = parse_bundle(SOURCE / "Solomon.bundle")[2:20]
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

sheet.save(OUTPUT, optimize=True)
print(f"{OUTPUT}: {len(records)} exact frames, 200x200 cells")
