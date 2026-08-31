#!/usr/bin/env python3
"""Validate/copy stock skill-picker pages and the authoritative skill catalog.

The complete reusable atlas/font manifest is owned by
`extract-native-ui-kit.py`; this focused extractor no longer writes a second
partial UI manifest.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import struct
from dataclasses import dataclass
from pathlib import Path

COMMON_HEADER_SIZE = 45
POINT_SIZE = 8


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

    source_catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    runtime_catalog = {
        "skills": [
            {
                "id": row["id"],
                "name": row["name"],
                "family": row["family"],
                "skills_atlas_icon_record": row["skills_atlas_icon_record"],
                "config": row["config"],
            }
            for row in source_catalog["skills"]
        ]
    }
    write_if_changed(
        args.catalog_output,
        (json.dumps(runtime_catalog, indent=2) + "\n").encode(),
    )
    print(
        "Validated stock skill-picker pages and copied the 82-row skill catalog; "
        "the complete UI manifest is generated by extract-native-ui-kit.py."
    )


if __name__ == "__main__":
    main()
