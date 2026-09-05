"""Stock player clothing, weapon attachment, and death image composition."""

from __future__ import annotations

import json
import math
from pathlib import Path
from PIL import Image
from native_bundle_art import (
    SpriteRecord,
    crop,
    float32,
    registered_origin,
    tint,
)
PLAYER_CELL_SIZE = 170
PLAYER_HEADINGS = 24
PLAYER_WALK_POSES = 5
PLAYER_ROBE_FIXED_POSES = 17
PLAYER_STAFF_ATTACHMENT_POSES = 10
PLAYER_ATTACHMENT_DEPTH_BASELINE = 0.5
PRE_CREATE_STAFF_SOCKET_SCALE = 1.100000023841858
PLAYER_DEATH_FACINGS = 6
PLAYER_DEATH_FRAMES = 4
PLAYER_DEATH_ROBE_PRIMARY_BASES = (76, 100, 124)
PLAYER_DEATH_ROBE_SECONDARY_BASES = (148, 172, 196)
PLAYER_DEATH_ROBE_FIXED_BASES = {
    "primary-a": 220,
    "secondary-a": 244,
    "primary-b": 268,
    "secondary-b": 292,
}
PLAYER_DEATH_HAT_PRIMARY_BASES = (316, 340, 364, 388)
PLAYER_DEATH_HAT_SECONDARY_BASES = (412, 412, 412, 436)
PLAYER_PALETTES = {
    # Skills_Wizard_GetPrimaryColor (0x00660760) is the descriptor-facing
    # source of truth. Do not run those results through the robe mix again.
    "air": ((160, 195, 195), (255, 255, 255)),
    "earth": ((144, 179, 144), (255, 255, 255)),
    "ether": ((136, 102, 136), (255, 255, 255)),
    "fire": ((153, 128, 119), (255, 255, 255)),
    "water": ((94, 110, 129), (255, 255, 255)),
}


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
    selector: int = 0,
) -> tuple[float, float]:
    start, end = staff_endpoints(records, heading, pose)
    if selector < 0 or selector > 5:
        raise ValueError(f"staff selector outside 0..5: {selector}")
    body_record = records[5 + selector]
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
    selector: int = 0,
) -> None:
    """Paint the stock staff and both hands as one item-owned depth pass."""
    draw_player_staff_body_pass(
        cell,
        atlas,
        records,
        heading,
        pose,
        front,
        selector,
    )
    draw_player_staff_hands_pass(cell, atlas, records, heading, pose, front)


def draw_player_staff_body_pass(
    cell: Image.Image,
    atlas: Image.Image,
    records: list[SpriteRecord],
    heading: int,
    pose: int,
    front: bool,
    selector: int = 0,
) -> None:
    frame = pose * PLAYER_HEADINGS + heading
    primary_hand = 3244 + frame
    if attachment_is_front(records, primary_hand) != front:
        return
    draw_staff(cell, atlas, records, heading, pose, selector)


def draw_player_staff_hands_pass(
    cell: Image.Image,
    atlas: Image.Image,
    records: list[SpriteRecord],
    heading: int,
    pose: int,
    front: bool,
) -> None:
    draw_player_staff_hand_pass(cell, atlas, records, heading, pose, front, 3244)
    draw_player_staff_hand_pass(cell, atlas, records, heading, pose, front, 3484)


def draw_player_staff_hand_pass(
    cell: Image.Image,
    atlas: Image.Image,
    records: list[SpriteRecord],
    heading: int,
    pose: int,
    front: bool,
    base_record: int,
) -> None:
    frame = pose * PLAYER_HEADINGS + heading
    primary_hand = 3244 + frame
    if attachment_is_front(records, primary_hand) != front:
        return

    # Staff_RenderAttachment builds the shaft first, then draws both hand
    # records for the same heading-and-pose frame. The whole composite is
    # submitted either behind or in front of the robe from primary-hand point
    # zero; the two hands are never split into independent depth passes.
    paste_player_layer(cell, atlas, records[base_record + frame])


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
        # These legacy element-colored sheets serve the ordinary generic body
        # path, whose supported selectors remain the Staff-range 0..9. The
        # complete 17-pose compiled-Robe tables are emitted separately below.
        "robe-fixed": empty_player_sheet(PLAYER_STAFF_ATTACHMENT_POSES),
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

        for pose in range(PLAYER_STAFF_ATTACHMENT_POSES):
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
    selector: int = 0,
) -> Image.Image:
    sheet = empty_player_sheet(PLAYER_STAFF_ATTACHMENT_POSES)
    for heading in range(PLAYER_HEADINGS):
        for pose in range(PLAYER_STAFF_ATTACHMENT_POSES):
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            draw_player_staff_pass(
                cell,
                atlas,
                records,
                heading,
                pose,
                front,
                selector,
            )
            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )
    return sheet


def build_player_staff_body_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    front: bool,
    selector: int,
) -> Image.Image:
    sheet = empty_player_sheet(PLAYER_STAFF_ATTACHMENT_POSES)
    for heading in range(PLAYER_HEADINGS):
        for pose in range(PLAYER_STAFF_ATTACHMENT_POSES):
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            draw_player_staff_body_pass(
                cell,
                atlas,
                records,
                heading,
                pose,
                front,
                selector,
            )
            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )
    return sheet


def build_player_staff_hand_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    front: bool,
    base_record: int,
) -> Image.Image:
    sheet = empty_player_sheet(PLAYER_STAFF_ATTACHMENT_POSES)
    for heading in range(PLAYER_HEADINGS):
        for pose in range(PLAYER_STAFF_ATTACHMENT_POSES):
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            draw_player_staff_hand_pass(
                cell,
                atlas,
                records,
                heading,
                pose,
                front,
                base_record,
            )
            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )
    return sheet


def write_player_staff_attachment_program(
    records: list[SpriteRecord],
    output_dir: Path,
) -> None:
    frames = []
    for pose in range(PLAYER_STAFF_ATTACHMENT_POSES):
        pose_frames = []
        for heading in range(PLAYER_HEADINGS):
            record_index = 3244 + pose * PLAYER_HEADINGS + heading
            record = records[record_index]
            if len(record.points) < 3:
                raise ValueError("staff attachment frame is missing native endpoints")
            pose_frames.append({
                "end": list(record.points[2]),
                "front": attachment_is_front(records, record_index),
                "start": list(record.points[1]),
            })
        frames.append(pose_frames)
    payload = {
        "auraRecords": [11, 12, None, None, None, None],
        "bodyLogicalWidths": [records[index].logical_width for index in range(5, 11)],
        "bodyRecords": list(range(5, 11)),
        "frames": frames,
    }
    (output_dir / "player-staff-attachment-program.json").write_text(
        json.dumps(payload, indent=2) + "\n",
        encoding="utf-8",
    )


def verify_player_staff_split(
    atlas: Image.Image,
    records: list[SpriteRecord],
) -> None:
    hands = {
        (front, base_record): build_player_staff_hand_sheet(
            atlas,
            records,
            front,
            base_record,
        )
        for front in (False, True)
        for base_record in (3244, 3484)
    }
    for selector in range(6):
        for front in (False, True):
            reconstructed = build_player_staff_body_sheet(
                atlas,
                records,
                front,
                selector,
            )
            reconstructed.alpha_composite(hands[(front, 3244)])
            reconstructed.alpha_composite(hands[(front, 3484)])
            combined = build_player_staff_sheet(
                atlas,
                records,
                front,
                selector,
            )
            if reconstructed.tobytes() != combined.tobytes():
                raise ValueError(
                    f"staff selector {selector} split does not reconstruct the combined sheet"
                )


def build_player_fallback_attachment_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    front: bool,
    duplicate_second_bank: bool,
) -> Image.Image:
    """Replay the generic attachment compositor's two directional banks."""
    sheet = empty_player_sheet(PLAYER_WALK_POSES)
    for heading in range(PLAYER_HEADINGS):
        for pose in range(PLAYER_WALK_POSES):
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            offset = pose * PLAYER_HEADINGS + heading
            first_bank = 484 + offset
            second_bank = 676 + offset
            if attachment_is_front(records, first_bank) == front:
                paste_player_layer(cell, atlas, records[first_bank])
            if attachment_is_front(records, second_bank) == front:
                paste_player_layer(cell, atlas, records[second_bank])
            if duplicate_second_bank:
                # 0x00539A5B..0x00539AEC submits this bank once more in both
                # compositor passes when the selected primary is exactly -1.
                paste_player_layer(cell, atlas, records[second_bank])
            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )
    return sheet


def build_player_bare_attachment_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    front: bool,
) -> Image.Image:
    return build_player_fallback_attachment_sheet(atlas, records, front, False)


def build_player_unselected_attachment_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    front: bool,
) -> Image.Image:
    return build_player_fallback_attachment_sheet(atlas, records, front, True)


def build_player_unselected_robe_attachment_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
) -> Image.Image:
    """Extract Item_Robe's 24-way scroll and generated plain Staff pair."""
    sheet = empty_player_sheet()
    center = PLAYER_CELL_SIZE / 2
    material = records[5]
    for heading in range(PLAYER_HEADINGS):
        cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
        paste_player_layer(cell, atlas, records[1588 + heading])
        points = records[460 + heading].points
        if len(points) != 2:
            raise ValueError(
                f"pre-Create Staff socket record {460 + heading} must have two points"
            )
        start = (
            center + float32(points[0][0] * PRE_CREATE_STAFF_SOCKET_SCALE),
            center + float32(points[0][1] * PRE_CREATE_STAFF_SOCKET_SCALE),
        )
        end = (
            center + float32(points[1][0] * PRE_CREATE_STAFF_SOCKET_SCALE),
            center + float32(points[1][1] * PRE_CREATE_STAFF_SOCKET_SCALE),
        )
        paste_segment(
            cell,
            crop(atlas, material),
            start,
            end,
            material.logical_width,
        )
        sheet.alpha_composite(cell, (0, heading * PLAYER_CELL_SIZE))
    return sheet


def build_player_hat_style_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    selector: int,
    secondary: bool,
) -> Image.Image:
    base = (412 if secondary else 316) + selector * PLAYER_HEADINGS
    sheet = empty_player_sheet()
    for heading in range(PLAYER_HEADINGS):
        cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
        paste_player_layer(cell, atlas, records[base + heading])
        sheet.alpha_composite(cell, (0, heading * PLAYER_CELL_SIZE))
    return sheet


def build_player_robe_style_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    selector: int,
    secondary: bool,
) -> Image.Image:
    base = (1228 if secondary else 868) + selector * PLAYER_WALK_POSES * PLAYER_HEADINGS
    sheet = empty_player_sheet(PLAYER_WALK_POSES)
    for heading in range(PLAYER_HEADINGS):
        for pose in range(PLAYER_WALK_POSES):
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            offset = pose * PLAYER_HEADINGS + heading
            paste_player_layer(cell, atlas, records[base + offset])
            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )
    return sheet


def build_player_fixed_color_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    secondary: bool,
) -> Image.Image:
    bases = (2020, 2836) if secondary else (1612, 2428)
    sheet = empty_player_sheet(PLAYER_ROBE_FIXED_POSES)
    for heading in range(PLAYER_HEADINGS):
        for pose in range(PLAYER_ROBE_FIXED_POSES):
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            offset = pose * PLAYER_HEADINGS + heading
            for base in bases:
                paste_player_layer(cell, atlas, records[base + offset])
            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )
    return sheet


def build_player_wand_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
) -> Image.Image:
    sheet = empty_player_sheet(3)
    for heading in range(PLAYER_HEADINGS):
        for pose in range(3):
            frame = pose * PLAYER_HEADINGS + heading
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            paste_player_layer(cell, atlas, records[604 + frame])
            paste_player_layer(cell, atlas, records[796 + frame])
            start, end = records[796 + frame].points
            center = PLAYER_CELL_SIZE / 2
            body = records[15]
            paste_segment(
                cell,
                crop(atlas, body),
                (center + start[0], center + start[1]),
                (center + end[0], center + end[1]),
                body.logical_width,
            )
            sheet.alpha_composite(
                cell,
                (pose * PLAYER_CELL_SIZE, heading * PLAYER_CELL_SIZE),
            )
    return sheet


def write_player_weapon_attachment_program(records: list[SpriteRecord], output_dir: Path) -> None:
    program = {
        "bare": [list(records[484 + heading].points[1]) for heading in range(PLAYER_HEADINGS)],
        "wand": [
            [
                {
                    "start": list(records[796 + pose * PLAYER_HEADINGS + heading].points[0]),
                    "end": list(records[796 + pose * PLAYER_HEADINGS + heading].points[1]),
                }
                for heading in range(PLAYER_HEADINGS)
            ]
            for pose in range(3)
        ],
    }
    (output_dir / "player-weapon-attachment-program.json").write_text(
        json.dumps(program, indent=2) + "\n", encoding="utf-8",
    )


def build_player_death_body_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    primary: tuple[int, int, int],
    secondary: tuple[int, int, int],
) -> Image.Image:
    """Compose Clothes 28..75 using the stock four-frame/six-facing selector."""
    sheet = Image.new(
        "RGBA",
        (
            PLAYER_CELL_SIZE * PLAYER_DEATH_FRAMES,
            PLAYER_CELL_SIZE * PLAYER_DEATH_FACINGS,
        ),
    )
    for facing in range(PLAYER_DEATH_FACINGS):
        for frame in range(PLAYER_DEATH_FRAMES):
            index = frame * PLAYER_DEATH_FACINGS + facing
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            paste_player_layer(cell, atlas, records[28 + index], primary)
            paste_player_layer(cell, atlas, records[52 + index], secondary)
            sheet.alpha_composite(
                cell,
                (frame * PLAYER_CELL_SIZE, facing * PLAYER_CELL_SIZE),
            )
    return sheet


def build_player_death_layer_sheet(
    atlas: Image.Image,
    records: list[SpriteRecord],
    base_record: int,
) -> Image.Image:
    """Preserve one native four-frame/six-facing corpse layer."""
    sheet = Image.new(
        "RGBA",
        (
            PLAYER_CELL_SIZE * PLAYER_DEATH_FRAMES,
            PLAYER_CELL_SIZE * PLAYER_DEATH_FACINGS,
        ),
    )
    for facing in range(PLAYER_DEATH_FACINGS):
        for frame in range(PLAYER_DEATH_FRAMES):
            index = frame * PLAYER_DEATH_FACINGS + facing
            cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
            paste_player_layer(cell, atlas, records[base_record + index])
            sheet.alpha_composite(
                cell,
                (frame * PLAYER_CELL_SIZE, facing * PLAYER_CELL_SIZE),
            )
    return sheet


def build_player_death_hat_strip(
    atlas: Image.Image,
    records: list[SpriteRecord],
    base_record: int,
    count: int,
) -> Image.Image:
    """Preserve a registered normal or special death-hat selector bank."""
    sheet = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE * count))
    for index in range(count):
        cell = Image.new("RGBA", (PLAYER_CELL_SIZE, PLAYER_CELL_SIZE))
        paste_player_layer(cell, atlas, records[base_record + index])
        sheet.alpha_composite(cell, (0, index * PLAYER_CELL_SIZE))
    return sheet


def write_player_death_anchor_data(
    records: list[SpriteRecord],
    output_dir: Path,
) -> None:
    offsets: list[list[list[float]]] = []
    for frame in range(PLAYER_DEATH_FRAMES):
        frame_offsets: list[list[float]] = []
        for facing in range(PLAYER_DEATH_FACINGS):
            record_index = 76 + frame * PLAYER_DEATH_FACINGS + facing
            points = records[record_index].points
            if not points:
                raise ValueError(f"death anchor record {record_index} has no point zero")
            frame_offsets.append([points[0][0], points[0][1] + 25])
        offsets.append(frame_offsets)
    path = output_dir / "player-character-death-hat-anchors.json"
    path.write_text(json.dumps({
        "offsets": offsets,
    }, indent=2) + "\n", encoding="utf-8")
