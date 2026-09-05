"""Stock bundle parsing and registered sprite composition."""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass
from pathlib import Path
from PIL import Image


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
    points: tuple[tuple[float, float], ...]
    end: int


def integral(value: float, label: str) -> int:
    rounded = round(value)
    if not math.isclose(value, rounded):
        raise ValueError(f"{label} is not integral: {value}")
    return rounded


def parse_sprite_record(data: bytes, offset: int, label: str) -> SpriteRecord:
    x, y, width, height = struct.unpack_from("<4f", data, offset)
    logical_width, logical_height = struct.unpack_from("<iI", data, offset + 0x10)
    content_width, content_height = struct.unpack_from("<2f", data, offset + 0x18)
    center_x, center_y = struct.unpack_from("<2f", data, offset + 0x20)
    rotated = data[offset + 0x28]
    point_count = struct.unpack_from("<I", data, offset + 0x29)[0]
    points = tuple(
        struct.unpack_from("<2f", data, offset + 45 + point_index * 8)
        for point_index in range(point_count)
    )
    if rotated != 0:
        raise ValueError(f"rotated record in {label} is unsupported")
    if not math.isclose(content_width, width) or not math.isclose(content_height, height):
        raise ValueError(f"record in {label} has mismatched content bounds")
    return SpriteRecord(
        x=integral(x, "atlas x"),
        y=integral(y, "atlas y"),
        width=integral(width, "atlas width"),
        height=integral(height, "atlas height"),
        logical_width=logical_width,
        logical_height=logical_height,
        center_x=center_x,
        center_y=center_y,
        points=points,
        end=offset + 45 + point_count * 8,
    )


def parse_bundle(path: Path) -> list[SpriteRecord]:
    data = path.read_bytes()
    records: list[SpriteRecord] = []
    offset = 0
    while offset < len(data):
        record = parse_sprite_record(data, offset, path.name)
        records.append(record)
        offset = record.end
    return records


def crop(atlas: Image.Image, record: SpriteRecord) -> Image.Image:
    return atlas.crop(
        (
            record.x,
            record.y,
            record.x + record.width,
            record.y + record.height,
        )
    )


def registered_origin(record: SpriteRecord, scale: float = 1) -> tuple[int, int]:
    left = ((record.logical_width - record.width) / 2 + record.center_x) * scale
    top = ((record.logical_height - record.height) / 2 + record.center_y) * scale
    return round(left), round(top)


def paste_registered(
    canvas: Image.Image,
    atlas: Image.Image,
    record: SpriteRecord,
    scale: float = 1,
    offset: tuple[int, int] = (0, 0),
    color: tuple[int, int, int] | None = None,
    opacity: float = 1,
) -> None:
    sprite = crop(atlas, record)
    if color is not None:
        alpha = sprite.getchannel("A")
        sprite = Image.new("RGBA", sprite.size, (*color, 255))
        sprite.putalpha(alpha)
    if opacity != 1:
        sprite.putalpha(sprite.getchannel("A").point(lambda value: round(value * opacity)))
    if scale != 1:
        sprite = sprite.resize(
            (round(sprite.width * scale), round(sprite.height * scale)),
            Image.Resampling.LANCZOS,
        )
    left, top = registered_origin(record, scale)
    canvas.alpha_composite(sprite, (left + offset[0], top + offset[1]))


def compose_registered(
    atlas: Image.Image,
    records: list[SpriteRecord],
    indices: tuple[int, ...],
) -> Image.Image:
    logical_sizes = {
        (records[index].logical_width, records[index].logical_height)
        for index in indices
    }
    if len(logical_sizes) != 1:
        raise ValueError(f"composite records have different logical sizes: {indices}")
    canvas = Image.new("RGBA", logical_sizes.pop())
    for index in indices:
        paste_registered(canvas, atlas, records[index])
    bounds = canvas.getbbox()
    if bounds is None:
        raise ValueError(f"composite records are empty: {indices}")
    return canvas.crop(bounds)


def registered_sprite(atlas: Image.Image, record: SpriteRecord) -> Image.Image:
    canvas = Image.new("RGBA", (record.logical_width, record.logical_height))
    paste_registered(canvas, atlas, record)
    return canvas


def compose_registered_full(
    atlas: Image.Image,
    records: list[SpriteRecord],
    indices: tuple[int, ...],
) -> Image.Image:
    logical_sizes = {
        (records[index].logical_width, records[index].logical_height)
        for index in indices
    }
    if len(logical_sizes) != 1:
        raise ValueError(f"composite records have different logical sizes: {indices}")
    canvas = Image.new("RGBA", logical_sizes.pop())
    for index in indices:
        paste_registered(canvas, atlas, records[index])
    return canvas


def build_registered_strip(
    atlas: Image.Image,
    records: list[SpriteRecord],
    indices: tuple[int, ...],
) -> Image.Image:
    logical_sizes = {
        (records[index].logical_width, records[index].logical_height)
        for index in indices
    }
    if len(logical_sizes) != 1:
        raise ValueError(f"animation records have different logical sizes: {indices}")
    frame_width, frame_height = logical_sizes.pop()
    strip = Image.new("RGBA", (frame_width * len(indices), frame_height))
    for frame, index in enumerate(indices):
        paste_registered(
            strip,
            atlas,
            records[index],
            offset=(frame * frame_width, 0),
        )
    return strip


def build_registered_composite_strip(
    atlas: Image.Image,
    records: list[SpriteRecord],
    frames: tuple[tuple[int, ...], ...],
) -> Image.Image:
    logical_sizes = {
        (records[index].logical_width, records[index].logical_height)
        for frame in frames
        for index in frame
    }
    if len(logical_sizes) != 1:
        raise ValueError(f"animation layers have different logical sizes: {frames}")
    frame_width, frame_height = logical_sizes.pop()
    strip = Image.new("RGBA", (frame_width * len(frames), frame_height))
    for frame_index, frame in enumerate(frames):
        for record_index in frame:
            paste_registered(
                strip,
                atlas,
                records[record_index],
                offset=(frame_index * frame_width, 0),
            )
    return strip


def build_cropped_strip(
    atlas: Image.Image,
    records: list[SpriteRecord],
    indices: tuple[int, ...],
) -> Image.Image:
    sprites = [crop(atlas, records[index]) for index in indices]
    frame_sizes = {sprite.size for sprite in sprites}
    if len(frame_sizes) != 1:
        raise ValueError(f"cropped animation records have different sizes: {indices}")
    frame_width, frame_height = frame_sizes.pop()
    strip = Image.new("RGBA", (frame_width * len(sprites), frame_height))
    for frame, sprite in enumerate(sprites):
        strip.alpha_composite(sprite, (frame * frame_width, 0))
    return strip


def build_registered_cropped_strip(
    atlas: Image.Image,
    records: list[SpriteRecord],
    indices: tuple[int, ...],
) -> Image.Image:
    placements = [
        (*registered_origin(records[index]), records[index])
        for index in indices
    ]
    left = min(origin_x for origin_x, _, _ in placements)
    top = min(origin_y for _, origin_y, _ in placements)
    right = max(origin_x + record.width for origin_x, _, record in placements)
    bottom = max(origin_y + record.height for _, origin_y, record in placements)
    frame_width = right - left
    frame_height = bottom - top
    strip = Image.new("RGBA", (frame_width * len(indices), frame_height))
    for frame, (origin_x, origin_y, record) in enumerate(placements):
        strip.alpha_composite(
            crop(atlas, record),
            (frame * frame_width + origin_x - left, origin_y - top),
        )
    return strip


def build_inventory_digit_strip(
    atlas: Image.Image,
    record: SpriteRecord,
) -> Image.Image:
    source = crop(atlas, record).convert("L")
    if source.size != (79, 14):
        raise ValueError(f"inventory digit source has unexpected size: {source.size}")

    glyph_bounds: list[tuple[int, int]] = []
    glyph_start: int | None = None
    for x in range(source.width + 1):
        occupied = x < source.width and source.crop((x, 0, x + 1, source.height)).getbbox() is not None
        if occupied and glyph_start is None:
            glyph_start = x
        elif not occupied and glyph_start is not None:
            glyph_bounds.append((glyph_start, x))
            glyph_start = None
    if len(glyph_bounds) != 10:
        raise ValueError(f"inventory digit source has {len(glyph_bounds)} glyphs; expected 10")

    mask = Image.new("L", (80, 14))
    for digit, (left, right) in enumerate(glyph_bounds):
        glyph = source.crop((left, 0, right, source.height))
        cell_left = digit * 8 + (8 - glyph.width) // 2
        mask.paste(glyph, (cell_left, 0))
    plaque = Image.new("RGB", mask.size, (190, 172, 128))
    glyph = Image.new("RGB", mask.size, (22, 18, 11))
    return Image.composite(glyph, plaque, mask).convert("RGBA")


def tint(sprite: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    red, green, blue, alpha = sprite.split()
    return Image.merge(
        "RGBA",
        (
            red.point(lambda value: value * color[0] // 255),
            green.point(lambda value: value * color[1] // 255),
            blue.point(lambda value: value * color[2] // 255),
            alpha,
        ),
    )


def float32(value: float) -> float:
    return struct.unpack("<f", struct.pack("<f", value))[0]


def save(image: Image.Image, output_dir: Path, name: str) -> None:
    image.save(output_dir / f"{name}.png", optimize=True)
