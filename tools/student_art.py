"""Stock College student body, head, and carried-prop image composition."""

from __future__ import annotations

from PIL import Image
from native_bundle_art import (
    SpriteRecord,
)
from player_attachment_art import (
    PLAYER_CELL_SIZE,
    PLAYER_HEADINGS,
    paste_player_layer,
)
STUDENT_POSES = 5
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
