#!/usr/bin/env python3
"""Extract the complete stock UI atlas/font vocabulary for the web UI kit."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import struct
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


RETAIL_SHA256 = "03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3"
RETAIL_SIZE = 4_723_200
COMMON_HEADER_SIZE = 45
POINT_SIZE = 8
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "frontend/src/assets/game"

ATLAS_SPECS = {
    "Bonedit": (84, "1db8dacf1739c94dc93ad86ec30ef0d7609840ccf93523e10ff2e594fd580919", "b34b6b130ad199f75d9e1c8f27f6bc713e1a068e1bf400f1d5412f3d4db5a5ec", (1024, 512), "native-ui-bonedit-atlas.png"),
    "ControlPanel": (116, "d779cd056c089ae587f1fb215938516fa299955d48eaf1a96f0a5ce2b2f7d2b6", "d63bd3ac402fcbc00a60916b6f0aa79f662501acc8f6fbe88ee1676e69b43f86", (512, 128), "settings-control-panel-atlas.png"),
    "Controls": (4, "42f875acb13b33b56056278dba7278e348fd1fd35796c61ef0f14f4034ff2046", "28a64ada386aedc180392ea6cd754654ae54dd186888438a02aa7f2c5930a97f", (512, 1024), "native-ui-controls-atlas.png"),
    "Create": (24, "b1f5c2ed54daa5ee2260fa179f04a3d51f0eae6b167149c3a2561d160e872d53", "9c629ccd3d859384446363ac50e90c19e55f8d5ef8cd17d25604f5a67f3d08eb", (1024, 1024), "native-ui-create-atlas.png"),
    "Fonts": (627, "048aa22cc715ee633f5e31f0400b4a3a9c0a8c8b49d681419e19d5ff676c214a", "dcdcd9697624996376348a4f6d6a2d730adaab98730a7fcbc6ee88f7433db782", (512, 256), "skill-picker-fonts-atlas.png"),
    "GameOver": (3, "680d1503b42d0108b66dca28cdd5adc4d8de532a1d133eed730d70aa78881889", "30c07de43c04b4b843ae85b52443d48087259cbd99992bbfaaa2f704d4884443", (512, 256), "native-ui-game-over-atlas.png"),
    "Inventory": (84, "763b826f6b24f872798c4d08ea8d367e31afcba6042cdbd6f38e8b1f87f83b9c", "527b52fb30453ae9d2bf5a0e1d3b0ee9f822eb7591452a11084e1cf4e2626265", (1024, 512), "hub-trader-inventory-atlas.png"),
    "LevelPicker": (8, "a2ae8f8028d4a4450e7fa0b503b16c57470dfe6afbaa02c56b8d9c791359cfb8", "d97a9f17a1eacdb69835e1f1848ab11416ca450e85cc927c98a25dc40deaf39b", (1024, 1024), "native-ui-level-picker-atlas.png"),
    "Library": (33, "028308e108b779963cffc1cc506e63a37dfe2a1d931cb25eef02074e86d96f1a", "66fe50d1a29015446b27e32f096a3887c8c6a9a3d0525f6de6459934260a3457", (1024, 1024), "native-ui-library-atlas.png"),
    "Loader": (5, "df1be9c59b86619c0151f5e02ea53eb9bcd5ae0ce692193fd48c7c44c7f5ae9b", "73707feca39b56d008a2a0b60950c9d06d01cab8374f5ec66b339d4fdd948722", (512, 256), "native-ui-loader-atlas.png"),
    "Skills": (166, "a1efe484b5cbcc5402d48a2a8dc11e1e26c06763dbb612edd66547700d3259cf", "ac1678d6aef8ddefa0def73754b6688c58f1aeaf88c461a4ed6f92c139ed2638", (1024, 512), "skill-picker-skills-atlas.png"),
    "Title": (25, "f6f1e5956427bfa45bc5e28c87cb2574a25169da96feca62e7efe8691d2b99d8", "86b8bb40b3f7ece277cf0d1038b118bf095b8489bdc344738b2fe8cbe1160ff2", (2048, 1024), "native-ui-title-atlas.png"),
    "UI": (113, "1db00ea8826e787ca9a320c90a33e726991cae00906baddfdc8bde31da697498", "37d5e8fc543af12a9d8019e738dbe1e29b648211144a3782c3a32e71f76cd2eb", (1024, 1024), "skill-picker-ui-atlas.png"),
}

FONT_NAMES = {
    ("ControlPanel", 0): "control-panel",
    ("Fonts", 0): "body",
    ("Fonts", 1): "medium",
    ("Fonts", 2): "special-uppercase",
    ("Fonts", 3): "menu",
    ("Fonts", 4): "heading",
    ("Fonts", 5): "skill-uppercase",
    ("Fonts", 6): "world-and-roster",
    ("Fonts", 7): "timeline",
    ("Fonts", 8): "belt",
}


@dataclass(frozen=True)
class SpriteRecord:
    offset: int
    end: int
    x: float
    y: float
    width: float
    height: float
    logical_width: int
    logical_height: int
    center_x: float
    center_y: float
    rotated: int
    points: tuple[tuple[float, float], ...]


@dataclass(frozen=True)
class FontGlyph:
    glyph_id: int
    metrics: tuple[float, float, float]
    record: SpriteRecord


@dataclass(frozen=True)
class FontGroup:
    metrics: tuple[float, float, float]
    kerning: tuple[tuple[int, int, float], ...]
    glyphs: tuple[FontGlyph, ...]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_bytes(data: bytes, offset: int, size: int, label: str) -> None:
    if offset < 0 or offset + size > len(data):
        raise ValueError(f"{label} at 0x{offset:x} exceeds the bundle")


def parse_record(data: bytes, offset: int) -> SpriteRecord:
    require_bytes(data, offset, COMMON_HEADER_SIZE, "sprite header")
    x, y, width, height = struct.unpack_from("<4f", data, offset)
    logical_width, logical_height = struct.unpack_from("<iI", data, offset + 0x10)
    content_width, content_height, center_x, center_y = struct.unpack_from("<4f", data, offset + 0x18)
    rotated = data[offset + 0x28]
    point_count = struct.unpack_from("<I", data, offset + 0x29)[0]
    end = offset + COMMON_HEADER_SIZE + point_count * POINT_SIZE
    require_bytes(data, offset, end - offset, "sprite payload")
    points = tuple(
        struct.unpack_from("<2f", data, offset + COMMON_HEADER_SIZE + index * POINT_SIZE)
        for index in range(point_count)
    )
    values = (x, y, width, height, content_width, content_height, center_x, center_y, *(value for point in points for value in point))
    if not all(math.isfinite(value) for value in values):
        raise ValueError(f"non-finite sprite value at 0x{offset:x}")
    if rotated not in (0, 1):
        raise ValueError(f"unsupported rotation {rotated} at 0x{offset:x}")
    if not math.isclose(width, content_width) or not math.isclose(height, content_height):
        raise ValueError(f"content rectangle drift at 0x{offset:x}")
    return SpriteRecord(
        offset,
        end,
        x,
        y,
        width,
        height,
        logical_width,
        logical_height,
        center_x,
        center_y,
        rotated,
        points,
    )


def parse_bundle(path: Path) -> tuple[list[SpriteRecord], list[FontGroup]]:
    data = path.read_bytes()
    records: list[SpriteRecord] = []
    offset = 0
    while offset < len(data):
        try:
            record = parse_record(data, offset)
        except ValueError:
            break
        records.append(record)
        offset = record.end
    if offset == len(data):
        return records, []

    groups: list[FontGroup] = []
    while offset < len(data):
        require_bytes(data, offset, 12, "font header")
        metrics = struct.unpack_from("<3f", data, offset)
        offset += 12
        kerning: list[tuple[int, int, float]] = []
        while True:
            require_bytes(data, offset, 4, "kerning key")
            left, right = struct.unpack_from("<HH", data, offset)
            offset += 4
            if left == 0 and right == 0:
                break
            require_bytes(data, offset, 4, "kerning adjustment")
            adjustment = struct.unpack_from("<f", data, offset)[0]
            offset += 4
            kerning.append((left, right, adjustment))
        glyphs: list[FontGlyph] = []
        while True:
            require_bytes(data, offset, 2, "glyph id")
            glyph_id = struct.unpack_from("<H", data, offset)[0]
            offset += 2
            if glyph_id == 0:
                break
            require_bytes(data, offset, 12, "glyph metrics")
            glyph_metrics = struct.unpack_from("<3f", data, offset)
            offset += 12
            record = parse_record(data, offset)
            records.append(record)
            glyphs.append(FontGlyph(glyph_id, glyph_metrics, record))
            offset = record.end
        groups.append(FontGroup(metrics, tuple(kerning), tuple(glyphs)))
    return records, groups


def integer(value: float, label: str) -> int:
    result = round(value)
    if not math.isclose(value, result):
        raise ValueError(f"{label} is not integral: {value}")
    return result


def record_json(record: SpriteRecord) -> dict[str, object]:
    width = integer(record.width, "record width")
    height = integer(record.height, "record height")
    return {
        "frame": [integer(record.x, "record x"), integer(record.y, "record y"), width, height],
        "logicalSize": [record.logical_width, record.logical_height],
        "trimOrigin": [
            (record.logical_width - width) / 2 + record.center_x,
            (record.logical_height - height) / 2 + record.center_y,
        ],
        "rotated": bool(record.rotated),
        "points": [list(point) for point in record.points],
    }


def write_if_changed(path: Path, payload: bytes) -> None:
    if path.is_file() and path.read_bytes() == payload:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def copy_if_changed(source: Path, destination: Path) -> None:
    if destination.is_file() and sha256(destination) == sha256(source):
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images_dir", type=Path)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    images_dir = args.images_dir.resolve()
    output_dir = args.output_dir.resolve()
    executable = images_dir.parent / "SolomonDark.exe"
    if executable.stat().st_size != RETAIL_SIZE or sha256(executable) != RETAIL_SHA256:
        raise ValueError("stock UI extraction source is not retail SolomonDark.exe 0.72.5")

    atlas_json: dict[str, object] = {}
    fonts_json: dict[str, object] = {}
    total_records = 0
    total_glyphs = 0
    for atlas_name, (expected_records, bundle_hash, image_hash, dimensions, output_name) in ATLAS_SPECS.items():
        bundle_path = images_dir / f"{atlas_name}.bundle"
        image_path = images_dir / f"{atlas_name}.png"
        if sha256(bundle_path) != bundle_hash or sha256(image_path) != image_hash:
            raise ValueError(f"{atlas_name} source hash drifted")
        with Image.open(image_path) as image:
            if image.size != dimensions:
                raise ValueError(f"{atlas_name} dimensions drifted: {image.size}")
        records, groups = parse_bundle(bundle_path)
        if len(records) != expected_records:
            raise ValueError(f"{atlas_name} has {len(records)} records; expected {expected_records}")
        if any(record.rotated != 0 for record in records):
            raise ValueError(f"{atlas_name} unexpectedly contains a rotated record")
        copy_if_changed(image_path, output_dir / output_name)
        atlas_json[atlas_name] = {
            "file": output_name,
            "dimensions": list(dimensions),
            "atlasSha256": image_hash,
            "bundleSha256": bundle_hash,
            "records": {str(index): record_json(record) for index, record in enumerate(records)},
        }
        record_index_by_offset = {record.offset: index for index, record in enumerate(records)}
        for group_index, group in enumerate(groups):
            font_name = FONT_NAMES.get((atlas_name, group_index))
            if font_name is None:
                raise ValueError(f"unnamed font wrapper {atlas_name}.{group_index}")
            fonts_json[font_name] = {
                "atlas": atlas_name,
                "group": group_index,
                "metrics": list(group.metrics),
                "spaceAdvance": group.metrics[1],
                "kerning": [list(pair) for pair in group.kerning],
                "glyphs": {
                    str(glyph.glyph_id): {
                        "record": record_index_by_offset[glyph.record.offset],
                        "metrics": list(glyph.metrics),
                        **record_json(glyph.record),
                    }
                    for glyph in group.glyphs
                },
            }
            total_glyphs += len(group.glyphs)
        total_records += len(records)

    if len(atlas_json) != 13 or total_records != 1_292:
        raise ValueError("stock UI atlas census drifted")
    if len(fonts_json) != 10 or total_glyphs != 718:
        raise ValueError("stock UI font census drifted")
    manifest = {
        "schema": "solomon-dark-native-ui-assets-v1",
        "sourceExecutableSha256": RETAIL_SHA256,
        "summary": {
            "atlasCount": 13,
            "recordCount": total_records,
            "fontCount": 10,
            "glyphCount": total_glyphs,
        },
        "atlases": atlas_json,
        "fonts": fonts_json,
    }
    write_if_changed(
        output_dir / "native-ui-assets.json",
        (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8"),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
