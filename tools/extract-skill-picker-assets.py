#!/usr/bin/env python3
"""Extract the stock skill-picker atlases, records, fonts, and skill catalog.

The picker uses trimmed records from the shipped UI/Skills atlases and four
compiled bitmap-font wrappers from Fonts.bundle. Keeping the source atlases
intact avoids hand-cropped geometry drift; this script emits the exact record
metadata needed to create Pixi subtextures at runtime.
"""

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


GAME_EXECUTABLE_SHA256 = (
    "03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3"
)
COMMON_HEADER_SIZE = 45
POINT_SIZE = 8
UI_RECORDS = (
    3, 10, 30, 31, 32, 37, 42, 47, 48, 49, 51, 56, 57, 59, 62, 79,
    82, 100, 107, 108, 109, 110,
)
SKILLS_RECORDS = (0, 5, 6, 12, 13, 14, *range(27, 123), 164, 165)
FONT_GROUPS = {
    "body": 0,
    "medium": 1,
    "menu": 3,
    "skill": 5,
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
    point_count: int


@dataclass(frozen=True)
class FontGlyph:
    glyph_id: int
    metrics: tuple[float, float, float]
    record: SpriteRecord


@dataclass(frozen=True)
class FontGroup:
    header: tuple[float, float, float]
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
    content_width, content_height, center_x, center_y = struct.unpack_from(
        "<4f", data, offset + 0x18
    )
    rotated = data[offset + 0x28]
    point_count = struct.unpack_from("<I", data, offset + 0x29)[0]
    end = offset + COMMON_HEADER_SIZE + point_count * POINT_SIZE
    require_bytes(data, offset, end - offset, "sprite payload")
    numeric = (
        x,
        y,
        width,
        height,
        content_width,
        content_height,
        center_x,
        center_y,
    )
    if not all(math.isfinite(value) for value in numeric):
        raise ValueError(f"non-finite sprite field at 0x{offset:x}")
    if rotated not in (0, 1):
        raise ValueError(f"unsupported rotation byte {rotated} at 0x{offset:x}")
    if not math.isclose(width, content_width) or not math.isclose(
        height, content_height
    ):
        raise ValueError(f"content rectangle drift at 0x{offset:x}")
    return SpriteRecord(
        offset=offset,
        end=end,
        x=x,
        y=y,
        width=width,
        height=height,
        logical_width=logical_width,
        logical_height=logical_height,
        center_x=center_x,
        center_y=center_y,
        rotated=rotated,
        point_count=point_count,
    )


def parse_bundle(path: Path) -> tuple[list[SpriteRecord], list[FontGroup]]:
    data = path.read_bytes()
    direct: list[SpriteRecord] = []
    offset = 0
    while offset < len(data):
        try:
            record = parse_record(data, offset)
        except ValueError:
            break
        direct.append(record)
        offset = record.end
    if offset == len(data):
        return direct, []

    groups: list[FontGroup] = []
    glyph_records: list[SpriteRecord] = []
    while offset < len(data):
        require_bytes(data, offset, 12, "font header")
        header = struct.unpack_from("<3f", data, offset)
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
            metrics = struct.unpack_from("<3f", data, offset)
            offset += 12
            record = parse_record(data, offset)
            glyph_records.append(record)
            glyphs.append(FontGlyph(glyph_id, metrics, record))
            offset = record.end
        groups.append(FontGroup(header, tuple(kerning), tuple(glyphs)))
    return [*direct, *glyph_records], groups


def integer(value: float, label: str) -> int:
    result = round(value)
    if not math.isclose(value, result):
        raise ValueError(f"{label} is not integral: {value}")
    return result


def record_json(record: SpriteRecord) -> dict[str, object]:
    width = integer(record.width, "record width")
    height = integer(record.height, "record height")
    trim_x = (record.logical_width - width) / 2 + record.center_x
    trim_y = (record.logical_height - height) / 2 + record.center_y
    return {
        "frame": [
            integer(record.x, "record x"),
            integer(record.y, "record y"),
            width,
            height,
        ],
        "logicalSize": [record.logical_width, record.logical_height],
        "trimOrigin": [trim_x, trim_y],
        "rotated": bool(record.rotated),
    }


def selected_records(
    records: list[SpriteRecord], indices: tuple[int, ...]
) -> dict[str, object]:
    return {str(index): record_json(records[index]) for index in indices}


def font_json(
    group: FontGroup,
    all_records: list[SpriteRecord],
) -> dict[str, object]:
    record_index_by_offset = {
        record.offset: index for index, record in enumerate(all_records)
    }
    return {
        "metrics": list(group.header),
        "spaceAdvance": group.header[1],
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


def atlas_descriptor(
    name: str,
    image_path: Path,
    bundle_path: Path,
    records: dict[str, object],
) -> dict[str, object]:
    with Image.open(image_path) as image:
        dimensions = list(image.size)
    return {
        "file": f"skill-picker-{name.lower()}-atlas.png",
        "dimensions": dimensions,
        "atlasSha256": sha256(image_path),
        "bundleSha256": sha256(bundle_path),
        "records": records,
    }


def write_if_changed(path: Path, payload: bytes) -> None:
    if path.exists() and path.read_bytes() == payload:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images-dir", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument(
        "--asset-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "frontend/src/assets/game",
    )
    parser.add_argument(
        "--catalog-output",
        type=Path,
        default=(
            Path(__file__).resolve().parents[1]
            / "frontend/src/game/core-kernels/native-skill-catalog.json"
        ),
    )
    args = parser.parse_args()

    parsed: dict[str, tuple[list[SpriteRecord], list[FontGroup]]] = {}
    for name in ("UI", "Skills", "Fonts"):
        parsed[name] = parse_bundle(args.images_dir / f"{name}.bundle")

    ui_records, _ = parsed["UI"]
    skill_records, _ = parsed["Skills"]
    font_records, font_groups = parsed["Fonts"]
    if len(ui_records) != 113 or len(skill_records) != 166:
        raise ValueError("stock UI/Skills record counts drifted")
    if len(font_records) != 627 or len(font_groups) != 9:
        raise ValueError("stock Fonts wrapper inventory drifted")

    args.asset_dir.mkdir(parents=True, exist_ok=True)
    for name in ("UI", "Skills", "Fonts"):
        shutil.copyfile(
            args.images_dir / f"{name}.png",
            args.asset_dir / f"skill-picker-{name.lower()}-atlas.png",
        )

    manifest = {
        "schema": "solomon-dark-skill-picker-assets-v1",
        "sourceExecutableSha256": GAME_EXECUTABLE_SHA256,
        "atlases": {
            "UI": atlas_descriptor(
                "UI",
                args.images_dir / "UI.png",
                args.images_dir / "UI.bundle",
                selected_records(ui_records, UI_RECORDS),
            ),
            "Skills": atlas_descriptor(
                "Skills",
                args.images_dir / "Skills.png",
                args.images_dir / "Skills.bundle",
                selected_records(skill_records, SKILLS_RECORDS),
            ),
            "Fonts": atlas_descriptor(
                "Fonts",
                args.images_dir / "Fonts.png",
                args.images_dir / "Fonts.bundle",
                {},
            ),
        },
        "fonts": {
            name: font_json(font_groups[index], font_records)
            for name, index in FONT_GROUPS.items()
        },
        "catalogSha256": sha256(args.catalog),
    }
    manifest_bytes = (
        json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    ).encode("utf-8")
    write_if_changed(
        args.asset_dir / "skill-picker-native-assets.json",
        manifest_bytes,
    )
    write_if_changed(args.catalog_output, args.catalog.read_bytes())
    print(
        "Extracted stock skill picker: "
        f"{len(UI_RECORDS)} UI records, {len(SKILLS_RECORDS)} Skills records, "
        f"{len(FONT_GROUPS)} bitmap fonts, and 82 catalog entries."
    )


if __name__ == "__main__":
    main()
