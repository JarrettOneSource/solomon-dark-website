#!/usr/bin/env python3
"""Extract the stock Courtyard panorama, actors, and HUD art.

The hub is not a boneyard file. Its presentation is compiled and draws
College.bundle records on a 2000x1024 world. Most scenery records already
carry their final world registration in the bundle; College[42] is the one
repeating floor tile. The local wizard is the stock Clothes-atlas compositor,
not the Solomon[95:185] DriveBy encounter actor.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import struct
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


WORLD_SIZE = (2000, 1024)
FIXED_ROOM_SPECS = {
    "mortuary": {
        "atlas": "Memoratorium",
        "world_size": (1024, 1024),
        "art_offset": (27, 57),
    },
    "storeroom": {
        "atlas": "Storage",
        "world_size": (1075, 800),
        "art_offset": (0, 72.5),
    },
    "library": {
        "atlas": "Library",
        "world_size": (1024, 1024),
        "art_offset": (16, 102.5),
    },
    "office": {
        "atlas": "Office",
        "world_size": (1024, 1024),
        "art_offset": (102.5, 102.5),
    },
}
PLAYER_CELL_SIZE = 170
STUDENT_POSES = 5
PLAYER_HEADINGS = 24
PLAYER_WALK_POSES = 5
PLAYER_ATTACHMENT_POSES = 10
PLAYER_ATTACHMENT_DEPTH_BASELINE = 0.5
PLAYER_PALETTES = {
    # Skills_Wizard_GetPrimaryColor (0x00660760) is the descriptor-facing
    # source of truth. Do not run those results through the robe mix again.
    "air": ((160, 195, 195), (255, 255, 255)),
    "earth": ((144, 179, 144), (255, 255, 255)),
    "ether": ((136, 102, 136), (255, 255, 255)),
    "fire": ((153, 128, 119), (255, 255, 255)),
    "water": ((94, 110, 129), (255, 255, 255)),
}
STUDENT_PALETTE = ((104, 130, 145), (255, 255, 255))
STUDENT_PROP_BASE_COLORS = (
    (255, 0, 0),
    (255, 128, 0),
    (255, 255, 0),
    (0, 255, 0),
    (0, 255, 255),
)
STUDENT_STATE_LAYERS = {
    "walk": {
        "white": (213, 261),
        "primary": (309, 405),
        "secondary": (357, 453),
        "book": None,
    },
    "read": {
        "white": (237, 285),
        "primary": (333, 429),
        "secondary": (381, 477),
        "book": 189,
    },
}
ELEMENT_VFX_RECORDS = {
    # These are the exact BadGuys.bundle groups selected by the five stock
    # element renderers (0x00535A30..0x005374C0). The same functions are used
    # by CreateWizardMenu and by the equipped staff orb.
    "earth": tuple(range(238, 246)),
    "fire": tuple(range(255, 267)),
    "water": tuple(range(271, 283)),
    "air": tuple(range(1836, 1840)),
}
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


@dataclass(frozen=True)
class FontGlyph:
    glyph_id: int
    record_index: int
    advance: float
    offset_x: float
    offset_y: float
    sprite: SpriteRecord


@dataclass(frozen=True)
class FontGroup:
    header: tuple[float, float, float]
    kerning: dict[str, float]
    glyphs: dict[str, FontGlyph]


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


def parse_font_groups(path: Path) -> list[FontGroup]:
    data = path.read_bytes()
    direct_record = parse_sprite_record(data, 0, path.name)
    offset = direct_record.end
    record_index = 1
    groups: list[FontGroup] = []

    while offset < len(data):
        header = struct.unpack_from("<3f", data, offset)
        offset += 12
        kerning: dict[str, float] = {}
        while True:
            left, right = struct.unpack_from("<HH", data, offset)
            offset += 4
            if left == 0 and right == 0:
                break
            adjustment = struct.unpack_from("<f", data, offset)[0]
            offset += 4
            kerning[f"{left}:{right}"] = adjustment

        glyphs: dict[str, FontGlyph] = {}
        while True:
            glyph_id = struct.unpack_from("<H", data, offset)[0]
            offset += 2
            if glyph_id == 0:
                break
            advance, offset_x, offset_y = struct.unpack_from("<3f", data, offset)
            offset += 12
            sprite = parse_sprite_record(data, offset, path.name)
            glyphs[chr(glyph_id)] = FontGlyph(
                glyph_id=glyph_id,
                record_index=record_index,
                advance=advance,
                offset_x=offset_x,
                offset_y=offset_y,
                sprite=sprite,
            )
            record_index += 1
            offset = sprite.end

        groups.append(FontGroup(header=header, kerning=kerning, glyphs=glyphs))

    return groups


def write_ally_font_data(group: FontGroup, output_dir: Path) -> None:
    data = {
        "atlasHeight": 256,
        "atlasWidth": 512,
        "glyphCount": len(group.glyphs),
        "group": 6,
        "header": list(group.header),
        "kerning": group.kerning,
        "kerningCount": len(group.kerning),
        "scale": 0.25,
        "glyphs": {
            char: {
                "advance": glyph.advance,
                "atlasHeight": glyph.sprite.height,
                "atlasWidth": glyph.sprite.width,
                "atlasX": glyph.sprite.x,
                "atlasY": glyph.sprite.y,
                "centerX": glyph.sprite.center_x,
                "centerY": glyph.sprite.center_y,
                "glyphId": glyph.glyph_id,
                "offsetX": glyph.offset_x,
                "offsetY": glyph.offset_y,
                "record": glyph.record_index,
            }
            for char, glyph in group.glyphs.items()
        },
    }
    path = output_dir / "hub-hud-font-group-6.json"
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


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


def room_layer(
    atlas: Image.Image,
    records: list[SpriteRecord],
    world_size: tuple[int, int],
    art_offset: tuple[float, float],
    indices: tuple[int, ...],
) -> Image.Image:
    layer = Image.new("RGBA", world_size)
    offset = (round(art_offset[0]), round(art_offset[1]))
    for index in indices:
        paste_registered(layer, atlas, records[index], offset=offset)
    return layer


def room_layer_strip(
    atlas: Image.Image,
    records: list[SpriteRecord],
    world_size: tuple[int, int],
    art_offset: tuple[float, float],
    indices: tuple[int, ...],
) -> Image.Image:
    frame_width, frame_height = world_size
    strip = Image.new("RGBA", (frame_width * len(indices), frame_height))
    offset_x = round(art_offset[0])
    offset_y = round(art_offset[1])
    for frame, index in enumerate(indices):
        paste_registered(
            strip,
            atlas,
            records[index],
            offset=(frame * frame_width + offset_x, offset_y),
        )
    return strip


def build_storeroom_background(
    atlas: Image.Image,
    records: list[SpriteRecord],
) -> Image.Image:
    spec = FIXED_ROOM_SPECS["storeroom"]
    world = Image.new("RGBA", spec["world_size"], (0, 0, 0, 255))
    floor = crop(atlas, records[1])
    top_offset = round(spec["art_offset"][1])
    for top in range(top_offset, top_offset + 655, floor.height):
        for left in range(0, 1075, floor.width):
            world.alpha_composite(floor, (left, top))
    architecture = room_layer(
        atlas,
        records,
        spec["world_size"],
        spec["art_offset"],
        tuple(range(13, 27)),
    )
    world.alpha_composite(architecture)
    # Storage[5] is the compiled center shelving composition.
    center = crop(atlas, records[5])
    world.alpha_composite(
        center,
        ((world.width - center.width) // 2, (world.height - center.height) // 2),
    )
    return world


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


def build_mortuary_painting_strip(
    atlas: Image.Image,
    records: list[SpriteRecord],
) -> Image.Image:
    marker_slots = (False, True, True, True, False, True, True, False, False, True)
    frame_width = records[3].logical_width
    frame_height = records[3].logical_height
    strip = Image.new("RGBA", (frame_width * 10, frame_height))
    marker = registered_sprite(atlas, records[8])
    for portrait_id, marked in enumerate(marker_slots):
        frame = Image.new("RGBA", (frame_width, frame_height))
        paste_registered(frame, atlas, records[3])
        frame.alpha_composite(crop(atlas, records[14 + portrait_id]), (16, 29))
        frame.alpha_composite(crop(atlas, records[7]), (15, 28))
        if marked:
            # Native submits record 8 at Painting-relative (10, 15). Its
            # registration inside the actor compositor resolves to this full
            # logical marker placement.
            frame.alpha_composite(marker, (35, 46))
        strip.alpha_composite(frame, (portrait_id * frame_width, 0))
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


def build_courtyard(atlas: Image.Image, records: list[SpriteRecord]) -> Image.Image:
    world = Image.new("RGBA", WORLD_SIZE, (0, 0, 0, 255))
    floor = crop(atlas, records[42])
    for top in range(0, WORLD_SIZE[1], floor.height):
        for left in range(0, WORLD_SIZE[0], floor.width):
            world.alpha_composite(floor, (left, top))

    # Native presentation order keeps College[19, 30, 31, 21, 22] out of this
    # flattened background. Courtyard::Present submits that foreground bank
    # after actors. College[20, 23, 24, 25] belong to depth-sorted obstacle
    # actors; record 2 is pre-actor base art. College[7] belongs to the
    # still-later southern architecture.
    scenery = [2, 6, *range(26, 30)]
    for index in scenery:
        paste_registered(world, atlas, records[index])

    # College[13] is drawn at (1500, 1000) with RGBA (1, 1, .5, .25).
    # Its registered origin is (0, 0), leaving the upper edge of the runic
    # ring visible when the camera reaches the lower-right Courtyard.
    paste_registered(
        world,
        atlas,
        records[13],
        offset=(1500, 1000),
        color=(255, 255, 128),
        opacity=0.25,
    )

    for index in range(63, 89):
        paste_registered(world, atlas, records[index])

    # Courtyard::Present walks College[93..105] at 0x0051F9C0..0x0051FA0B
    # and submits every record at (0, 0). Their 2000x1000 bundle registration
    # owns the lower-Courtyard placement; translating this bank moves its
    # assembled black symbol underneath the Teacher.
    for index in range(93, 106):
        paste_registered(world, atlas, records[index])

    return world


def build_registered_world_layer(
    atlas: Image.Image,
    records: list[SpriteRecord],
    indices: tuple[int, ...],
    offset: tuple[int, int] = (0, 0),
) -> Image.Image:
    layer = Image.new("RGBA", WORLD_SIZE)
    for index in indices:
        paste_registered(layer, atlas, records[index], offset=offset)
    return layer


def build_scaled_registered_world_layer(
    atlas: Image.Image,
    records: list[SpriteRecord],
    indices: tuple[int, ...],
    scale: float,
) -> Image.Image:
    layer = Image.new("RGBA", WORLD_SIZE)
    for index in indices:
        paste_registered(layer, atlas, records[index], scale=scale)
    return layer


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


def student_prop_color(color: tuple[int, int, int]) -> tuple[int, int, int]:
    """Replay Color::Saturate(color, 0.85) from Student::Student."""
    red, green, blue = (channel / 255 for channel in color)
    luminance = red * 0.30860000848770142 \
        + green * 0.6093999743461609 \
        + blue * 0.0820000022649765
    return tuple(
        round((luminance * 0.85 + channel * 0.15) * 255)
        for channel in (red, green, blue)
    )


def player_layer_origin(record: SpriteRecord) -> tuple[int, int]:
    left, top = registered_origin(record)
    return (
        left + (PLAYER_CELL_SIZE - record.logical_width) // 2,
        top + (PLAYER_CELL_SIZE - record.logical_height) // 2,
    )


def paste_player_layer(
    cell: Image.Image,
    atlas: Image.Image,
    record: SpriteRecord,
    color: tuple[int, int, int] | None = None,
) -> None:
    sprite = crop(atlas, record)
    if color is not None:
        sprite = tint(sprite, color)
    cell.alpha_composite(sprite, player_layer_origin(record))


def staff_endpoints(
    records: list[SpriteRecord], heading: int, pose: int
) -> tuple[tuple[float, float], tuple[float, float]]:
    # Staff_RenderAttachment reads attachment points 1 and 2 (the second and
    # third serialized points) from the 3244 pose bank. Bundle points are
    # relative to the logical sprite center.
    attachment = records[3244 + pose * PLAYER_HEADINGS + heading]
    if len(attachment.points) < 3:
        raise ValueError("staff attachment frame is missing native endpoints")
    center = PLAYER_CELL_SIZE / 2
    first = attachment.points[1]
    second = attachment.points[2]
    return (
        (center + first[0], center + first[1]),
        (center + second[0], center + second[1]),
    )


def paste_segment(
    cell: Image.Image,
    sprite: Image.Image,
    start: tuple[float, float],
    end: tuple[float, float],
    width: float,
) -> None:
    """Map a sprite onto the native four-vertex attachment quad.

    Staff_RenderAttachment normalizes the endpoint delta, multiplies the
    perpendicular by half of the selected material's logical width, and sends
    those four corners to the ordinary textured-quad painter. A rotate-after-
    resize approximation changes the endpoint registration and leaves the
    right-facing fixed cuff exposed.
    """
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = math.hypot(dx, dy)
    if length <= 0 or width <= 0:
        return

    along_x = dx / length
    along_y = dy / length
    perpendicular_x = -along_y
    perpendicular_y = along_x
    half_width = width / 2
    corners = (
        (start[0] - perpendicular_x * half_width, start[1] - perpendicular_y * half_width),
        (start[0] + perpendicular_x * half_width, start[1] + perpendicular_y * half_width),
        (end[0] - perpendicular_x * half_width, end[1] - perpendicular_y * half_width),
        (end[0] + perpendicular_x * half_width, end[1] + perpendicular_y * half_width),
    )

    left = math.floor(min(point[0] for point in corners)) - 1
    top = math.floor(min(point[1] for point in corners)) - 1
    right = math.ceil(max(point[0] for point in corners)) + 1
    bottom = math.ceil(max(point[1] for point in corners)) + 1

    # Pillow's affine coefficients map destination pixels back into the atlas
    # crop. The half-pixel correction preserves the D3D texture-edge contract.
    source_x_per_x = perpendicular_x * sprite.width / width
    source_x_per_y = perpendicular_y * sprite.width / width
    source_x_origin = (
        ((left - start[0]) * perpendicular_x + (top - start[1]) * perpendicular_y)
        * sprite.width
        / width
        + sprite.width / 2
        - 0.5
    )
    source_y_per_x = along_x * sprite.height / length
    source_y_per_y = along_y * sprite.height / length
    source_y_origin = (
        ((left - start[0]) * along_x + (top - start[1]) * along_y)
        * sprite.height
        / length
        - 0.5
    )
    mapped = sprite.transform(
        (right - left, bottom - top),
        Image.Transform.AFFINE,
        (
            source_x_per_x,
            source_x_per_y,
            source_x_origin,
            source_y_per_x,
            source_y_per_y,
            source_y_origin,
        ),
        Image.Resampling.BILINEAR,
    )
    cell.alpha_composite(mapped, (left, top))


def draw_staff(
    cell: Image.Image,
    atlas: Image.Image,
    records: list[SpriteRecord],
    heading: int,
    pose: int,
) -> tuple[float, float]:
    start, end = staff_endpoints(records, heading, pose)
    body_record = records[5]
    paste_segment(
        cell,
        crop(atlas, body_record),
        start,
        end,
        body_record.logical_width,
    )

    return start


def attachment_is_front(
    records: list[SpriteRecord],
    record_index: int,
) -> bool:
    """Match Wizard_RenderAttachments' point-0 painter-depth comparison."""
    record = records[record_index]
    if not record.points:
        raise ValueError(f"attachment record {record_index} is missing its depth point")
    return record.points[0][1] > PLAYER_ATTACHMENT_DEPTH_BASELINE


def draw_player_staff_pass(
    cell: Image.Image,
    atlas: Image.Image,
    records: list[SpriteRecord],
    heading: int,
    pose: int,
    front: bool,
) -> None:
    """Paint the stock staff and both hands as one item-owned depth pass."""
    frame = pose * PLAYER_HEADINGS + heading
    primary_hand = 3244 + frame
    secondary_hand = 3484 + frame
    if attachment_is_front(records, primary_hand) != front:
        return

    # Staff_RenderAttachment builds the shaft first, then draws both hand
    # records for the same heading-and-pose frame. The whole composite is
    # submitted either behind or in front of the robe from primary-hand point
    # zero; the two hands are never split into independent depth passes.
    draw_staff(cell, atlas, records, heading, pose)
    paste_player_layer(cell, atlas, records[primary_hand])
    paste_player_layer(cell, atlas, records[secondary_hand])


def empty_player_sheet(columns: int = 1) -> Image.Image:
    return Image.new(
        "RGBA",
        (PLAYER_CELL_SIZE * columns, PLAYER_CELL_SIZE * PLAYER_HEADINGS),
    )


def build_player_colored_layers(
    atlas: Image.Image,
    records: list[SpriteRecord],
    primary: tuple[int, int, int],
    secondary: tuple[int, int, int],
) -> dict[str, Image.Image]:
    """Preserve Wizard_Render's independently selected and transformed passes."""
    layers = {
        "robe-dynamic": empty_player_sheet(PLAYER_WALK_POSES),
        "robe-fixed": empty_player_sheet(PLAYER_ATTACHMENT_POSES),
        "head": empty_player_sheet(),
    }

    for heading in range(PLAYER_HEADINGS):
        row = (0, heading * PLAYER_CELL_SIZE)

        # The first robe argument is heading + trunc(actor + 0x220) * 24.
        # These two style-selected arrays are exactly five walk poses.
        for pose in range(PLAYER_WALK_POSES):
            dynamic = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            moving_offset = pose * PLAYER_HEADINGS + heading
            paste_player_layer(dynamic, atlas, records[868 + moving_offset], primary)
            paste_player_layer(dynamic, atlas, records[1228 + moving_offset], secondary)
            layers["robe-dynamic"].alpha_composite(
                dynamic,
                (pose * PLAYER_CELL_SIZE, row[1]),
            )

        # The second robe argument selects these four ten-pose banks from
        # actor +0x238. Cast actions use poses 1, 7, and 8 in addition to the
        # ordinary locomotion pose zero.
        for pose in range(PLAYER_ATTACHMENT_POSES):
            fixed = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            fixed_offset = pose * PLAYER_HEADINGS + heading
            paste_player_layer(fixed, atlas, records[1612 + fixed_offset], primary)
            paste_player_layer(fixed, atlas, records[2428 + fixed_offset], primary)
            paste_player_layer(fixed, atlas, records[2020 + fixed_offset], secondary)
            paste_player_layer(fixed, atlas, records[2836 + fixed_offset], secondary)
            layers["robe-fixed"].alpha_composite(
                fixed,
                (pose * PLAYER_CELL_SIZE, row[1]),
            )

        # The loadout slot +0x18 painter runs last under the full gait bob.
        head = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
        paste_player_layer(head, atlas, records[316 + heading], primary)
        paste_player_layer(head, atlas, records[412 + heading], secondary)
        layers["head"].alpha_composite(head, row)

    return layers


def build_player_staff_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    front: bool,
) -> Image.Image:
    sheet = empty_player_sheet(PLAYER_ATTACHMENT_POSES)
    for heading in range(PLAYER_HEADINGS):
        for pose in range(PLAYER_ATTACHMENT_POSES):
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            draw_player_staff_pass(
                cell,
                atlas,
                records,
                heading,
                pose,
                front,
            )
            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )
    return sheet


def build_student_body_sheet(
    college_atlas: Image.Image,
    college_records: list[SpriteRecord],
    clothes_atlas: Image.Image,
    clothes_records: list[SpriteRecord],
    state: str,
) -> Image.Image:
    """Compose the actor-scaled Student body pass."""
    layers = STUDENT_STATE_LAYERS[state]
    primary, secondary = STUDENT_PALETTE
    sheet = Image.new(
        "RGBA",
        (PLAYER_CELL_SIZE * STUDENT_POSES, PLAYER_CELL_SIZE * PLAYER_HEADINGS),
    )

    for heading in range(PLAYER_HEADINGS):
        for pose in range(STUDENT_POSES):
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            moving_offset = pose * PLAYER_HEADINGS + heading
            paste_player_layer(
                cell,
                clothes_atlas,
                clothes_records[868 + moving_offset],
                primary,
            )
            paste_player_layer(
                cell,
                clothes_atlas,
                clothes_records[1228 + moving_offset],
                secondary,
            )

            for base in layers["white"]:
                paste_player_layer(cell, college_atlas, college_records[base + heading])
            for base in layers["primary"]:
                paste_player_layer(
                    cell,
                    college_atlas,
                    college_records[base + heading],
                    primary,
                )
            for base in layers["secondary"]:
                paste_player_layer(
                    cell,
                    college_atlas,
                    college_records[base + heading],
                    secondary,
                )

            book_base = layers["book"]
            if book_base is not None:
                paste_player_layer(
                    cell,
                    college_atlas,
                    college_records[book_base + heading],
                    (126, 87, 58),
                )

            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )

    return sheet


def build_student_head_sheet(
    clothes_atlas: Image.Image,
    clothes_records: list[SpriteRecord],
) -> Image.Image:
    """Compose Student_Render's final unscaled primary/secondary head pass."""
    primary, secondary = STUDENT_PALETTE
    sheet = Image.new(
        "RGBA",
        (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE * PLAYER_HEADINGS),
    )
    for heading in range(PLAYER_HEADINGS):
        cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
        paste_player_layer(
            cell,
            clothes_atlas,
            clothes_records[316 + heading],
            primary,
        )
        paste_player_layer(
            cell,
            clothes_atlas,
            clothes_records[412 + heading],
            secondary,
        )
        sheet.alpha_composite(cell, (0, heading * PLAYER_CELL_SIZE))
    return sheet


def build_student_prop_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    color: tuple[int, int, int],
) -> Image.Image:
    """Build the Student renderer's 24-heading carried-object bank."""
    sheet = Image.new(
        "RGBA",
        (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE * PLAYER_HEADINGS),
    )
    for heading in range(PLAYER_HEADINGS):
        cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
        paste_player_layer(cell, atlas, records[165 + heading], color)
        sheet.alpha_composite(cell, (0, heading * PLAYER_CELL_SIZE))
    return sheet


def save(image: Image.Image, output_dir: Path, name: str) -> None:
    image.save(output_dir / f"{name}.png", optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("images_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    images_dir = args.images_dir.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    college = Image.open(images_dir / "College.png").convert("RGBA")
    college_records = parse_bundle(images_dir / "College.bundle")
    if len(college_records) != 543:
        raise ValueError(f"College.bundle has {len(college_records)} records; expected 543")
    save(build_courtyard(college, college_records), output_dir, "hub-courtyard")

    mortuary = Image.open(images_dir / "Memoratorium.png").convert("RGBA")
    mortuary_records = parse_bundle(images_dir / "Memoratorium.bundle")
    if len(mortuary_records) != 76:
        raise ValueError(
            f"Memoratorium.bundle has {len(mortuary_records)} records; expected 76"
        )
    mortuary_spec = FIXED_ROOM_SPECS["mortuary"]
    save(
        room_layer(
            mortuary,
            mortuary_records,
            mortuary_spec["world_size"],
            mortuary_spec["art_offset"],
            (0,),
        ),
        output_dir,
        "hub-room-mortuary-background",
    )
    save(
        build_mortuary_painting_strip(mortuary, mortuary_records),
        output_dir,
        "hub-room-mortuary-paintings",
    )
    save(
        build_registered_composite_strip(
            mortuary,
            mortuary_records,
            tuple((28 + heading, 44 + heading * 2) for heading in range(16)),
        ),
        output_dir,
        "hub-room-memorator",
    )
    save(
        registered_sprite(mortuary, mortuary_records[27]),
        output_dir,
        "hub-room-memorator-marker",
    )
    save(
        registered_sprite(mortuary, mortuary_records[1]),
        output_dir,
        "hub-room-mortuary-flame",
    )

    storage = Image.open(images_dir / "Storage.png").convert("RGBA")
    storage_records = parse_bundle(images_dir / "Storage.bundle")
    if len(storage_records) != 27:
        raise ValueError(f"Storage.bundle has {len(storage_records)} records; expected 27")
    storage_spec = FIXED_ROOM_SPECS["storeroom"]
    save(build_storeroom_background(storage, storage_records), output_dir, "hub-room-storeroom-background")
    save(
        room_layer_strip(
            storage,
            storage_records,
            storage_spec["world_size"],
            storage_spec["art_offset"],
            (2, 3, 4),
        ),
        output_dir,
        "hub-room-storeroom-props",
    )
    save(
        room_layer(
            storage,
            storage_records,
            storage_spec["world_size"],
            storage_spec["art_offset"],
            (11, 12),
        ),
        output_dir,
        "hub-room-storeroom-foreground",
    )
    save(
        registered_sprite(storage, storage_records[0]),
        output_dir,
        "hub-room-storeroom-flame",
    )

    library = Image.open(images_dir / "Library.png").convert("RGBA")
    library_records = parse_bundle(images_dir / "Library.bundle")
    if len(library_records) != 33:
        raise ValueError(f"Library.bundle has {len(library_records)} records; expected 33")
    library_spec = FIXED_ROOM_SPECS["library"]
    library_background = room_layer(
        library,
        library_records,
        library_spec["world_size"],
        library_spec["art_offset"],
        (0,),
    )
    # The return corridor extends 200 logical pixels below the 819-high room art.
    paste_registered(library_background, library, library_records[5], offset=(16, 2))
    save(library_background, output_dir, "hub-room-library-background")
    save(
        room_layer(
            library,
            library_records,
            library_spec["world_size"],
            library_spec["art_offset"],
            (1, 2, 4),
        ),
        output_dir,
        "hub-room-library-foreground",
    )
    save(
        room_layer_strip(
            library,
            library_records,
            library_spec["world_size"],
            library_spec["art_offset"],
            (9, 10, 11),
        ),
        output_dir,
        "hub-room-library-props",
    )
    save(
        build_registered_strip(library, library_records, tuple(range(21, 25))),
        output_dir,
        "hub-room-dowser",
    )
    save(
        compose_registered_full(library, library_records, tuple(range(29, 33))),
        output_dir,
        "hub-room-librarian",
    )
    save(
        build_registered_strip(library, library_records, tuple(range(25, 29))),
        output_dir,
        "hub-room-librarian-frames",
    )
    save(
        registered_sprite(library, library_records[3]),
        output_dir,
        "hub-room-library-flame",
    )

    office = Image.open(images_dir / "Office.png").convert("RGBA")
    office_records = parse_bundle(images_dir / "Office.bundle")
    if len(office_records) != 27:
        raise ValueError(f"Office.bundle has {len(office_records)} records; expected 27")
    office_spec = FIXED_ROOM_SPECS["office"]
    office_background = room_layer(
        office,
        office_records,
        office_spec["world_size"],
        office_spec["art_offset"],
        (1,),
    )
    paste_registered(office_background, office, office_records[4], offset=(102, 2))
    save(office_background, output_dir, "hub-room-office-background")
    save(
        room_layer(
            office,
            office_records,
            office_spec["world_size"],
            office_spec["art_offset"],
            tuple(range(17, 23)),
        ),
        output_dir,
        "hub-room-office-foreground",
    )
    save(
        compose_registered_full(office, office_records, (3,)),
        output_dir,
        "hub-room-arch-desk",
    )
    save(
        build_registered_composite_strip(
            office,
            office_records,
            ((7, 10), (8, 11), (9, 12)),
        ),
        output_dir,
        "hub-room-arch-chancellor",
    )
    save(
        room_layer(
            office,
            office_records,
            office_spec["world_size"],
            office_spec["art_offset"],
            (5,),
        ),
        output_dir,
        "hub-room-office-prop",
    )
    save(
        registered_sprite(office, office_records[2]),
        output_dir,
        "hub-room-office-flame",
    )
    # Courtyard::Present draws these independent, additive, animated masks at
    # world (1000, 500), scale 2. They are not Teacher-local painters.
    save(
        build_scaled_registered_world_layer(
            college,
            college_records,
            tuple(range(106, 119)),
            2,
        ),
        output_dir,
        "hub-seal-pulse",
    )
    save(
        build_scaled_registered_world_layer(
            college,
            college_records,
            (12,),
            2,
        ),
        output_dir,
        "hub-seal-core-pulse",
    )
    save(
        build_registered_cropped_strip(
            college,
            college_records,
            (23, 24, 20, 25),
        ),
        output_dir,
        "hub-courtyard-depth-props",
    )
    save(
        build_registered_world_layer(
            college,
            college_records,
            (19, 30, 31, 21, 22),
        ),
        output_dir,
        "hub-courtyard-foreground",
    )
    for name, index in {
        "hub-southern-battlement": 4,
        "hub-southern-seam": 3,
        "hub-southern-tower": 44,
        "hub-southern-platform-west": 7,
        "hub-southern-platform-east": 43,
    }.items():
        save(crop(college, college_records[index]), output_dir, name)
    save(
        build_registered_cropped_strip(
            college,
            college_records,
            tuple(range(505, 510)),
        ),
        output_dir,
        "hub-astronomer-telescope",
    )
    save(
        build_registered_strip(
            college,
            college_records,
            (*range(134, 140), *range(529, 535)),
        ),
        output_dir,
        "hub-astronomer-assistants",
    )
    for name, indices in {
        "hub-astronomer-red-idle": tuple(range(130, 134)),
        "hub-astronomer-red-transition": tuple(range(140, 143)),
        "hub-astronomer-red-gesture": tuple(range(143, 148)),
        "hub-astronomer-green-idle": tuple(range(525, 529)),
        "hub-astronomer-green-transition": tuple(range(535, 538)),
        "hub-astronomer-green-gesture": tuple(range(538, 543)),
    }.items():
        save(
            build_registered_strip(college, college_records, indices),
            output_dir,
            name,
        )
    save(
        build_registered_world_layer(college, college_records, (33,), (10, 60)),
        output_dir,
        "hub-tent-shadow",
    )
    save(
        build_registered_world_layer(college, college_records, (34,), (10, 60)),
        output_dir,
        "hub-tent-back",
    )
    save(
        build_registered_world_layer(college, college_records, (32,), (10, 60)),
        output_dir,
        "hub-tent-front",
    )
    save(
        build_registered_cropped_strip(
            college,
            college_records,
            tuple(range(54, 59)),
        ),
        output_dir,
        "hub-tent-balloons",
    )
    clothes = Image.open(images_dir / "Clothes.png").convert("RGBA")
    clothes_records = parse_bundle(images_dir / "Clothes.bundle")
    if len(clothes_records) != 3724:
        raise ValueError(
            f"Clothes.bundle has {len(clothes_records)} records; expected 3724"
        )
    save(
        build_player_staff_sheet(clothes, clothes_records, front=False),
        output_dir,
        "player-character-staff-back",
    )
    save(
        build_player_staff_sheet(clothes, clothes_records, front=True),
        output_dir,
        "player-character-staff-front",
    )
    for element, (primary, secondary) in PLAYER_PALETTES.items():
        player_layers = build_player_colored_layers(
            clothes,
            clothes_records,
            primary,
            secondary,
        )
        for layer_name, sheet in player_layers.items():
            save(sheet, output_dir, f"player-character-{layer_name}-{element}")

    bad_guys = Image.open(images_dir / "BadGuys.png").convert("RGBA")
    bad_guys_records = parse_bundle(images_dir / "BadGuys.bundle")
    if len(bad_guys_records) != 2509:
        raise ValueError(
            f"BadGuys.bundle has {len(bad_guys_records)} records; expected 2509"
        )
    for name, record_index in {
        "element-vfx-core": 110,
        "element-vfx-spark": 111,
        "element-vfx-ray": 112,
        "primary-spell-earth-glimmer": 86,
        "primary-spell-earth-rock-0": 168,
        "primary-spell-earth-rock-1": 169,
        "primary-spell-earth-rock-2": 170,
        "primary-spell-earth-rock-center": 171,
        "primary-spell-earth-lit-rock-0": 2008,
        "primary-spell-earth-lit-rock-1": 2009,
        "primary-spell-earth-lit-rock-2": 2010,
        "primary-spell-frost-core": 30,
        "primary-spell-frost-extra": 32,
        "primary-spell-frost-over": 28,
        "primary-spell-frost-spark": 14,
        "primary-spell-magic-missile": 53,
    }.items():
        save(registered_sprite(bad_guys, bad_guys_records[record_index]), output_dir, name)
    for element, indices in ELEMENT_VFX_RECORDS.items():
        save(
            build_registered_strip(bad_guys, bad_guys_records, indices),
            output_dir,
            f"element-vfx-{element}",
        )
    for name, record_index in {
        "hub-teacher-burst-core": 15,
        "actor-shadow": 67,
        "hub-teacher-burst-column": 81,
        "hub-teacher-burst-flare": 82,
    }.items():
        save(
            registered_sprite(bad_guys, bad_guys_records[record_index]),
            output_dir,
            name,
        )
    save(
        build_registered_strip(
            bad_guys,
            bad_guys_records,
            tuple(range(1823, 1834)),
        ),
        output_dir,
        "hub-teacher-burst-frames",
    )

    student_head_sheet = build_student_head_sheet(clothes, clothes_records)
    save(student_head_sheet, output_dir, "hub-student-head")

    for state in STUDENT_STATE_LAYERS:
        student_sheet = build_student_body_sheet(
            college,
            college_records,
            clothes,
            clothes_records,
            state,
        )
        save(student_sheet, output_dir, f"hub-student-{state}")
        if state == "walk":
            portrait = student_sheet.crop((0, 0, PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            portrait.alpha_composite(
                student_head_sheet.crop((0, 0, PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            )
            bounds = portrait.getbbox()
            if bounds is None:
                raise ValueError("student portrait is empty")
            save(portrait.crop(bounds), output_dir, "hub-student-portrait")

    # Student_Render draws two to four objects from College[165..188] around a
    # walking Student. The bank is selected by the actor's 24-way heading; the
    # actor supplies tint, radial distance, and angle. Preserve the grayscale
    # texture modulation and 170x170 registration used by the stock renderer.
    for palette_index, base_color in enumerate(STUDENT_PROP_BASE_COLORS):
        save(
            build_student_prop_sheet(
                college,
                college_records,
                student_prop_color(base_color),
            ),
            output_dir,
            f"hub-student-prop-{palette_index}",
        )

    # Teacher_Render selects exactly one College[501..504] frame. Its auxiliary
    # pass draws College[13] centered at actor + (-40,+30) with alpha 0.25.
    save(registered_sprite(college, college_records[13]), output_dir, "hub-teacher-rune")
    save(
        build_registered_strip(college, college_records, tuple(range(501, 505))),
        output_dir,
        "hub-teacher-frames",
    )

    college_assets = {
        "hub-fountain-particle": 38,
        "hub-hud-help": 37,
        "hub-hud-parchment": 16,
        "hub-marker-talk-right": 59,
        "hub-marker-talk-left": 60,
        "hub-marker-help-right": 61,
        "hub-marker-help-left": 62,
        "hub-prop-statue": 39,
        "hub-prop-statue-aura": 41,
        "hub-npc-perk-witch": 520,
    }
    for name, index in college_assets.items():
        save(crop(college, college_records[index]), output_dir, name)
    for obsolete_marker in ("hub-marker-help.png", "hub-marker-talk.png"):
        obsolete_path = output_dir / obsolete_marker
        if obsolete_path.exists():
            obsolete_path.unlink()
    save(
        compose_registered(college, college_records, (0, 47)),
        output_dir,
        "hub-npc-annalist",
    )
    save(
        compose_registered(college, college_records, (10, 126)),
        output_dir,
        "hub-npc-items",
    )
    save(
        build_cropped_strip(college, college_records, tuple(range(160, 165))),
        output_dir,
        "hub-npc-potion",
    )
    save(
        registered_sprite(college, college_records[17]),
        output_dir,
        "hub-hud-map-play",
    )
    save(
        registered_sprite(college, college_records[18]),
        output_dir,
        "hub-hud-map-compass",
    )

    ui = Image.open(images_dir / "UI.png").convert("RGBA")
    ui_records = parse_bundle(images_dir / "UI.bundle")
    if len(ui_records) != 113:
        raise ValueError(f"UI.bundle has {len(ui_records)} records; expected 113")
    ui_assets = {
        "hub-hud-backpack": 47,
        "hub-hud-bar-blue": 40,
        "hub-hud-bar-red": 26,
        "hub-hud-golem": 23,
        "hub-hud-mouse-right": 100,
        "hub-hud-skull": 42,
        "hub-hud-tome": 48,
        "hub-hud-xp-fill": 81,
        "hub-hud-xp-frame": 82,
    }
    for name, index in ui_assets.items():
        save(crop(ui, ui_records[index]), output_dir, name)

    font_groups = parse_font_groups(images_dir / "Fonts.bundle")
    if len(font_groups) != 9:
        raise ValueError(f"Fonts.bundle has {len(font_groups)} groups; expected 9")
    ally_font = font_groups[6]
    if len(ally_font.glyphs) != 67 or len(ally_font.kerning) != 1_043:
        raise ValueError(
            "Fonts group 6 does not match the native 67-glyph/1043-kerning contract"
        )
    shutil.copyfile(
        images_dir / "Fonts.png",
        output_dir / "hub-hud-font-atlas.png",
    )
    write_ally_font_data(ally_font, output_dir)

    inventory = Image.open(images_dir / "Inventory.png").convert("RGBA")
    inventory_records = parse_bundle(images_dir / "Inventory.bundle")
    if len(inventory_records) != 84:
        raise ValueError(
            f"Inventory.bundle has {len(inventory_records)} records; expected 84"
        )
    inventory_assets = {
        "hub-hud-potion-red": 46,
        "hub-hud-potion-blue": 47,
    }
    for name, index in inventory_assets.items():
        save(crop(inventory, inventory_records[index]), output_dir, name)

    skills = Image.open(images_dir / "Skills.png").convert("RGBA")
    skills_records = parse_bundle(images_dir / "Skills.bundle")
    if len(skills_records) != 166:
        raise ValueError(
            f"Skills.bundle has {len(skills_records)} records; expected 166"
        )
    save(crop(skills, skills_records[99]), output_dir, "hub-hud-secondary-acid-rain")
    save(
        build_inventory_digit_strip(skills, skills_records[7]),
        output_dir,
        "hub-hud-inventory-digits",
    )
    for element, record_index in {
        "ether": 35,
        "fire": 43,
        "air": 51,
        "water": 59,
        "earth": 67,
    }.items():
        save(
            crop(skills, skills_records[record_index]),
            output_dir,
            f"hub-primary-{element}",
        )

    level_picker = Image.open(images_dir / "LevelPicker.png").convert("RGBA")
    level_picker_records = parse_bundle(images_dir / "LevelPicker.bundle")
    if len(level_picker_records) != 8:
        raise ValueError(
            f"LevelPicker.bundle has {len(level_picker_records)} records; expected 8"
        )
    for name, record_index in {
        "annalist": 0,
        "teacher": 2,
        "items": 4,
        "potion": 5,
        "perk-witch": 6,
    }.items():
        save(
            crop(level_picker, level_picker_records[record_index]),
            output_dir,
            f"hub-hud-npc-{name}",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
