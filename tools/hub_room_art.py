"""Stock College and private-room image composition."""

from __future__ import annotations

from PIL import Image
from native_bundle_art import (
    SpriteRecord,
    crop,
    paste_registered,
    registered_sprite,
)


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


def build_mortuary_painting_overlay(
    atlas: Image.Image,
    records: list[SpriteRecord],
    record_index: int,
    offset: tuple[int, int],
) -> Image.Image:
    frame = Image.new("RGBA", (records[3].logical_width, records[3].logical_height))
    frame.alpha_composite(registered_sprite(atlas, records[record_index]), offset)
    return frame


def build_courtyard(atlas: Image.Image, records: list[SpriteRecord]) -> Image.Image:
    world = Image.new("RGBA", WORLD_SIZE, (0, 0, 0, 255))
    floor = crop(atlas, records[42])
    for top in range(0, WORLD_SIZE[1], floor.height):
        for left in range(0, WORLD_SIZE[0], floor.width):
            world.alpha_composite(floor, (left, top))

    # Native presentation order keeps College[19, 30, 31, 21, 22] out of this
    # flattened background. Courtyard::Present submits that foreground bank
    # after actors. CollegeObstacle selectors own records 20, 23..25, 27..29,
    # and the 148..159 composite; record 2 is pre-actor base art. College[7]
    # belongs to the still-later southern architecture.
    scenery = [2, 6, 26]
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
