#!/usr/bin/env python3
"""Extract stock loader, title, and create-menu layers plus bitmap-font labels."""

from __future__ import annotations

import argparse
import math
import struct
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


COMMON_RECORD_SIZE = 45


@dataclass(frozen=True)
class SpriteRecord:
    x: int
    y: int
    width: int
    height: int
    logical_width: int
    logical_height: int
    center_x: float
    center_y: float
    end: int


@dataclass(frozen=True)
class Glyph:
    advance: float
    center_x: float
    center_y: float
    sprite: SpriteRecord


@dataclass(frozen=True)
class FontGroup:
    space_advance: float
    kerning: dict[tuple[int, int], float]
    glyphs: dict[int, Glyph]


def integer(value: float, label: str) -> int:
    rounded = round(value)
    if not math.isclose(value, rounded):
        raise ValueError(f"{label} is not integral: {value}")
    return rounded


def parse_sprite(data: bytes, offset: int) -> SpriteRecord:
    x, y, width, height = struct.unpack_from("<4f", data, offset)
    logical_width, logical_height = struct.unpack_from("<iI", data, offset + 0x10)
    center_x, center_y = struct.unpack_from("<2f", data, offset + 0x20)
    point_count = struct.unpack_from("<I", data, offset + 0x29)[0]
    return SpriteRecord(
        x=integer(x, "atlas x"),
        y=integer(y, "atlas y"),
        width=integer(width, "atlas width"),
        height=integer(height, "atlas height"),
        logical_width=logical_width,
        logical_height=logical_height,
        center_x=center_x,
        center_y=center_y,
        end=offset + COMMON_RECORD_SIZE + point_count * 8,
    )


def parse_common_bundle(path: Path) -> list[SpriteRecord]:
    data = path.read_bytes()
    records: list[SpriteRecord] = []
    offset = 0
    while offset < len(data):
        record = parse_sprite(data, offset)
        records.append(record)
        offset = record.end
    return records


def parse_fonts(path: Path) -> list[FontGroup]:
    data = path.read_bytes()
    offset = parse_sprite(data, 0).end  # stock-dormant direct record zero
    groups: list[FontGroup] = []

    while offset < len(data):
        size, _, _ = struct.unpack_from("<3f", data, offset)
        offset += 12

        kerning: dict[tuple[int, int], float] = {}
        while True:
            left, right = struct.unpack_from("<HH", data, offset)
            if left == 0 and right == 0:
                offset += 4
                break
            kerning[(left, right)] = struct.unpack_from("<f", data, offset + 4)[0]
            offset += 8

        glyphs: dict[int, Glyph] = {}
        while True:
            glyph_id = struct.unpack_from("<H", data, offset)[0]
            if glyph_id == 0:
                offset += 2
                break
            advance, center_x, center_y = struct.unpack_from("<3f", data, offset + 2)
            sprite = parse_sprite(data, offset + 14)
            glyphs[glyph_id] = Glyph(advance, center_x, center_y, sprite)
            offset = sprite.end

        groups.append(FontGroup(size / 2, kerning, glyphs))

    if len(groups) != 9:
        raise ValueError(f"Fonts.bundle has {len(groups)} groups; expected 9")
    return groups


def crop_record(atlas: Image.Image, record: SpriteRecord) -> Image.Image:
    return atlas.crop(
        (
            record.x,
            record.y,
            record.x + record.width,
            record.y + record.height,
        )
    )


def compose_logical_records(
    atlas: Image.Image,
    records: list[SpriteRecord],
) -> Image.Image:
    logical_size = (records[0].logical_width, records[0].logical_height)
    if any(
        (record.logical_width, record.logical_height) != logical_size
        for record in records
    ):
        raise ValueError("composite records do not share one logical canvas")

    result = Image.new("RGBA", logical_size)
    for record in records:
        left = round((record.logical_width - record.width) / 2 + record.center_x)
        top = round((record.logical_height - record.height) / 2 + record.center_y)
        result.alpha_composite(crop_record(atlas, record), (left, top))
    return result


def render_text(
    atlas: Image.Image,
    font: FontGroup,
    value: str,
    color: tuple[int, int, int, int],
) -> Image.Image:
    cursor = 0.0
    previous: int | None = None
    placements: list[tuple[Glyph, float, float]] = []

    for character in value:
        glyph_id = ord(character)
        if character == " ":
            cursor += font.space_advance
            previous = glyph_id
            continue

        glyph = font.glyphs[glyph_id]
        if previous is not None:
            cursor += font.kerning.get((previous, glyph_id), 0)

        sprite = glyph.sprite
        left = cursor + glyph.center_x - sprite.width / 2 + sprite.center_x
        top = glyph.center_y - sprite.height / 2 + sprite.center_y
        placements.append((glyph, left, top))
        cursor += glyph.advance
        previous = glyph_id

    min_x = math.floor(min(left for _, left, _ in placements))
    min_y = math.floor(min(top for _, _, top in placements))
    max_x = math.ceil(
        max(left + glyph.sprite.width for glyph, left, _ in placements)
    )
    max_y = math.ceil(
        max(top + glyph.sprite.height for glyph, _, top in placements)
    )
    result = Image.new("RGBA", (max_x - min_x, max_y - min_y))

    for glyph, left, top in placements:
        sprite = crop_record(atlas, glyph.sprite)
        tinted = Image.new("RGBA", sprite.size, color)
        tinted.putalpha(sprite.getchannel("A"))
        result.alpha_composite(
            tinted,
            (round(left - min_x), round(top - min_y)),
        )

    return result


def save(image: Image.Image, output_dir: Path, name: str) -> None:
    image.save(output_dir / f"{name}.png")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("images_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    images_dir = args.images_dir.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    loader = Image.open(images_dir / "Loader.png").convert("RGBA")
    loader_records = parse_common_bundle(images_dir / "Loader.bundle")
    if len(loader_records) != 5:
        raise ValueError(
            f"Loader.bundle has {len(loader_records)} records; expected 5"
        )
    # Records 0 and 1 are authored vertically. MyLoader rotates each clockwise
    # by 90 degrees, so emit their final raster orientation for a DOM clip that
    # has the same horizontal progress axis as the native renderer.
    save(
        crop_record(loader, loader_records[0]).transpose(
            Image.Transpose.ROTATE_270
        ),
        output_dir,
        "loader-fill",
    )
    save(
        crop_record(loader, loader_records[1]).transpose(
            Image.Transpose.ROTATE_270
        ),
        output_dir,
        "loader-frame",
    )
    save(crop_record(loader, loader_records[2]), output_dir, "loader-logo")
    save(crop_record(loader, loader_records[3]), output_dir, "loader-url")

    title = Image.open(images_dir / "Title.png").convert("RGBA")
    title_records = parse_common_bundle(images_dir / "Title.bundle")
    if len(title_records) != 25:
        raise ValueError(f"Title.bundle has {len(title_records)} records; expected 25")

    title_assets = {
        "main-menu-cloud-base": 0,
        "main-menu-cloud-shadow": 1,
        "main-menu-cloud-detail": 2,
        "main-menu-grass": 4,
        "main-menu-horizon": 5,
        "main-menu-moon": 6,
        "main-menu-logo": 9,
    }
    for name, record_index in title_assets.items():
        save(crop_record(title, title_records[record_index]), output_dir, name)
    for grave_index, record_index in enumerate(range(16, 25)):
        save(
            crop_record(title, title_records[record_index]),
            output_dir,
            f"main-menu-grave-{grave_index}",
        )

    ui = Image.open(images_dir / "UI.png").convert("RGBA")
    ui_records = parse_common_bundle(images_dir / "UI.bundle")
    if len(ui_records) != 113:
        raise ValueError(f"UI.bundle has {len(ui_records)} records; expected 113")
    ui_assets = {
        "create-back-skull": 42,
        "create-name-end": 80,
        "main-menu-flourish": 18,
        "main-menu-quit-corner": 53,
        "main-menu-button-corner": 54,
        "main-menu-button": 101,
        "main-menu-button-hover": 102,
    }
    for name, record_index in ui_assets.items():
        save(crop_record(ui, ui_records[record_index]), output_dir, name)

    name_end = crop_record(ui, ui_records[80])
    save(
        name_end.crop((name_end.width - 1, 0, name_end.width, name_end.height)),
        output_dir,
        "create-name-rail",
    )

    create = Image.open(images_dir / "Create.png").convert("RGBA")
    create_records = parse_common_bundle(images_dir / "Create.bundle")
    if len(create_records) != 24:
        raise ValueError(f"Create.bundle has {len(create_records)} records; expected 24")
    create_assets = {
        "create-discipline-arcane": 0,
        "create-discipline-body": 1,
        "create-choose-discipline": 2,
        "create-choose-element": 3,
        "create-star-large": 4,
        "create-discipline-mind": 5,
        "create-dice": 6,
        "create-arcane-wheel": 7,
        "create-star-small": 8,
        "create-element-ether": 9,
        "create-element-fire": 10,
        "create-element-air": 11,
        "create-element-water": 12,
        "create-element-earth": 13,
    }
    for name, record_index in create_assets.items():
        save(crop_record(create, create_records[record_index]), output_dir, name)
    save(
        compose_logical_records(create, create_records[14:16]),
        output_dir,
        "create-hand-fist",
    )
    save(
        compose_logical_records(create, create_records[16:20]),
        output_dir,
        "create-hand-cupped",
    )
    save(
        compose_logical_records(create, create_records[20:24]),
        output_dir,
        "create-hand-raised",
    )

    # The two labeled-control renderers frame their rows with UI[54] and
    # UI[53]. The native frame helper draws both full corners, then stretches
    # the sprite's rightmost column across the gap between them.
    for name, record_index in {
        "main-menu-button-rail": 54,
        "main-menu-quit-rail": 53,
    }.items():
        corner = crop_record(ui, ui_records[record_index])
        save(
            corner.crop((corner.width - 1, 0, corner.width, corner.height)),
            output_dir,
            name,
        )

    fonts_atlas = Image.open(images_dir / "Fonts.png").convert("RGBA")
    fonts = parse_fonts(images_dir / "Fonts.bundle")
    labels = {
        "main-menu-text-play": (4, "PLAY", (216, 186, 112, 255)),
        "main-menu-text-explore": (3, "explore the", (221, 197, 139, 255)),
        "main-menu-text-dark-cloud": (3, "DARK CLOUD", (221, 197, 139, 255)),
        "main-menu-text-settings": (3, "SETTINGS", (221, 197, 139, 255)),
        "main-menu-text-hall": (3, "HALL of FAME", (221, 197, 139, 255)),
        "main-menu-text-resume": (3, "resume", (221, 197, 139, 255)),
        "main-menu-text-last-game": (3, "LAST GAME", (221, 197, 139, 255)),
        "main-menu-text-new-game": (3, "NEW GAME", (221, 197, 139, 255)),
        "main-menu-text-back": (3, "BACK", (221, 197, 139, 255)),
        "main-menu-text-quit": (3, "quit", (221, 197, 139, 255)),
        "main-menu-text-version": (1, "V.0.72BETA", (216, 186, 112, 255)),
        "create-text-name": (4, "HELVIDIUS", (216, 186, 112, 255)),
        "create-text-name-caption": (1, "WIZARD NAME", (216, 186, 112, 255)),
        "create-text-name-caret": (1, "x", (216, 186, 112, 255)),
    }
    for name, (font_index, value, color) in labels.items():
        save(render_text(fonts_atlas, fonts[font_index], value, color), output_dir, name)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
