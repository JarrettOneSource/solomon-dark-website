#!/usr/bin/env python3
"""Extract the exact normal Game Over title and Solomon Riff registrations.

Usage: extract-game-over-assets.py <path-to-game-images-dir>
"""

import hashlib
import struct
import sys
from pathlib import Path

from PIL import Image


EXPECTED = {
    "GameOver.bundle": "680d1503b42d0108b66dca28cdd5adc4d8de532a1d133eed730d70aa78881889",
    "GameOver.png": "30c07de43c04b4b843ae85b52443d48087259cbd99992bbfaaa2f704d4884443",
    "SolomonRiff.bundle": "387599fc560937de0ba27f1006c73e1ebe5eba8e384ba4d967636543fd570ac4",
    "SolomonRiff.png": "944808bf6aa04acaa11e89535032754aecd04989962a7b198b512de1af2c36f4",
}
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "src/assets/game"


def verified_bytes(path: Path) -> bytes:
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED[path.name]:
        raise RuntimeError(f"{path.name} SHA-256 {digest} does not match stock 0.72.5")
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

    records: list[dict[str, float | int]] = []
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


def crop_record(atlas: Image.Image, record: dict[str, float | int]) -> Image.Image:
    left = int(record["x"])
    top = int(record["y"])
    return atlas.crop((
        left,
        top,
        left + int(record["width"]),
        top + int(record["height"]),
    ))


if len(sys.argv) != 2:
    raise SystemExit("Usage: extract-game-over-assets.py <path-to-game-images-dir>")

source = Path(sys.argv[1])
game_over = Image.open(source / "GameOver.png").convert("RGBA")
verified_bytes(source / "GameOver.png")
game_over_records = parse_bundle(verified_bytes(source / "GameOver.bundle"))
if len(game_over_records) != 3:
    raise RuntimeError("GameOver.bundle must contain exactly three records")

for record_index, output_name in ((0, "game-over-game.png"), (1, "game-over-over.png")):
    crop_record(game_over, game_over_records[record_index]).save(
        OUTPUT_DIR / output_name,
        optimize=True,
    )

riff = Image.open(source / "SolomonRiff.png").convert("RGBA")
verified_bytes(source / "SolomonRiff.png")
riff_records = parse_bundle(verified_bytes(source / "SolomonRiff.bundle"))
if len(riff_records) != 13:
    raise RuntimeError("SolomonRiff.bundle must contain exactly thirteen records")
if any(
    record["cell_width"] != 200 or record["cell_height"] != 200
    for record in riff_records[1:]
):
    raise RuntimeError("live SolomonRiff records must use 200x200 registration cells")

riff_sheet = Image.new("RGBA", (12 * 200, 200))
for frame_index, record in enumerate(riff_records[1:]):
    frame = crop_record(riff, record)
    left = round(100 + float(record["origin_x"]) - int(record["width"]) / 2)
    top = round(100 + float(record["origin_y"]) - int(record["height"]) / 2)
    riff_sheet.alpha_composite(frame, (frame_index * 200 + left, top))
riff_sheet.save(OUTPUT_DIR / "anim-solomon-riff.png", optimize=True)

for output_name in ("game-over-game.png", "game-over-over.png", "anim-solomon-riff.png"):
    path = OUTPUT_DIR / output_name
    print(f"{path}: SHA-256 {hashlib.sha256(path.read_bytes()).hexdigest()}")
