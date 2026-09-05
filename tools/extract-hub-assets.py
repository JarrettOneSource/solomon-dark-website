#!/usr/bin/env python3
"""Extract the stock Courtyard, actors, room, and HUD assets."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path
from PIL import Image
from native_bundle_art import (
    build_cropped_strip,
    build_inventory_digit_strip,
    build_registered_composite_strip,
    build_registered_cropped_strip,
    build_registered_strip,
    compose_registered,
    compose_registered_full,
    crop,
    parse_bundle,
    paste_registered,
    registered_sprite,
    save,
)
from hub_room_art import (
    FIXED_ROOM_SPECS,
    build_courtyard,
    build_mortuary_painting_overlay,
    build_mortuary_painting_strip,
    build_registered_world_layer,
    build_scaled_registered_world_layer,
    build_storeroom_background,
    room_layer,
    room_layer_strip,
)
from player_attachment_art import (
    PLAYER_CELL_SIZE,
    PLAYER_DEATH_FACINGS,
    PLAYER_DEATH_HAT_PRIMARY_BASES,
    PLAYER_DEATH_HAT_SECONDARY_BASES,
    PLAYER_DEATH_ROBE_FIXED_BASES,
    PLAYER_DEATH_ROBE_PRIMARY_BASES,
    PLAYER_DEATH_ROBE_SECONDARY_BASES,
    PLAYER_HEADINGS,
    PLAYER_PALETTES,
    build_player_bare_attachment_sheet,
    build_player_colored_layers,
    build_player_death_body_sheet,
    build_player_death_hat_strip,
    build_player_death_layer_sheet,
    build_player_fixed_color_sheet,
    build_player_hat_style_sheet,
    build_player_robe_style_sheet,
    build_player_staff_body_sheet,
    build_player_staff_hand_sheet,
    build_player_staff_sheet,
    build_player_unselected_attachment_sheet,
    build_player_unselected_robe_attachment_sheet,
    build_player_wand_sheet,
    write_player_weapon_attachment_program,
    verify_player_staff_split,
    write_player_death_anchor_data,
    write_player_staff_attachment_program,
)
from student_art import (
    STUDENT_PROP_BASE_COLORS,
    STUDENT_STATE_LAYERS,
    build_student_body_sheet,
    build_student_head_sheet,
    build_student_prop_sheet,
    student_prop_color,
)


ELEMENT_VFX_RECORDS = {
    # These are the exact BadGuys.bundle groups selected by the five stock
    # element renderers (0x00535A30..0x005374C0). The same functions are used
    # by CreateWizardMenu and by the equipped staff orb.
    "earth": tuple(range(238, 246)),
    "fire": tuple(range(255, 267)),
    "water": tuple(range(271, 283)),
    "air": tuple(range(1836, 1840)),
}


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
        registered_sprite(mortuary, mortuary_records[3]),
        output_dir,
        "hub-room-mortuary-painting-easel",
    )
    save(
        build_mortuary_painting_overlay(mortuary, mortuary_records, 7, (15, 28)),
        output_dir,
        "hub-room-mortuary-painting-front",
    )
    save(
        build_mortuary_painting_overlay(mortuary, mortuary_records, 8, (35, 46)),
        output_dir,
        "hub-room-mortuary-painting-marker",
    )
    save(
        Image.open(images_dir / "paintbkg.png").convert("RGBA"),
        output_dir,
        "hub-room-mortuary-portrait-background",
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
    save(
        registered_sprite(mortuary, mortuary_records[5]),
        output_dir,
        "hub-room-mortuary-memorial-glow",
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
        registered_sprite(library, library_records[20]),
        output_dir,
        "hub-room-dowser-marker",
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
        registered_sprite(library, library_records[19]),
        output_dir,
        "hub-room-librarian-marker",
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
        registered_sprite(office, office_records[15]),
        output_dir,
        "hub-room-arch-chancellor-marker",
    )
    save(
        build_registered_strip(office, office_records, tuple(range(23, 27))),
        output_dir,
        "hub-room-polisher",
    )
    save(
        registered_sprite(office, office_records[14]),
        output_dir,
        "hub-room-polisher-marker",
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
        build_registered_composite_strip(
            college,
            college_records,
            (
                tuple(range(148, 160)),
                (25,),
                (23,),
                (28,),
                (29,),
                (27,),
                (20,),
                (24,),
            ),
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
    verify_player_staff_split(clothes, clothes_records)
    save(crop(clothes, clothes_records[1]), output_dir, "player-harden-ice")
    save(crop(clothes, clothes_records[2]), output_dir, "player-mindblast-ring")
    for selector in range(6):
        save(
            build_player_staff_sheet(clothes, clothes_records, False, selector),
            output_dir,
            f"player-character-staff-{selector}-back",
        )
        save(
            build_player_staff_sheet(clothes, clothes_records, True, selector),
            output_dir,
            f"player-character-staff-{selector}-front",
        )
        save(
            build_player_staff_body_sheet(clothes, clothes_records, False, selector),
            output_dir,
            f"player-character-staff-{selector}-body-back",
        )
        save(
            build_player_staff_body_sheet(clothes, clothes_records, True, selector),
            output_dir,
            f"player-character-staff-{selector}-body-front",
        )
    for layer, base_record in (("primary", 3244), ("secondary", 3484)):
        save(
            build_player_staff_hand_sheet(clothes, clothes_records, False, base_record),
            output_dir,
            f"player-character-staff-hand-{layer}-back",
        )
        save(
            build_player_staff_hand_sheet(clothes, clothes_records, True, base_record),
            output_dir,
            f"player-character-staff-hand-{layer}-front",
        )
    for selector, record_index in enumerate((11, 12)):
        save(
            crop(clothes, clothes_records[record_index]),
            output_dir,
            f"player-enchant-staff-aura-{selector}",
        )
    write_player_staff_attachment_program(clothes_records, output_dir)
    save(build_player_staff_sheet(clothes, clothes_records, False), output_dir, "player-character-staff-back")
    save(build_player_staff_sheet(clothes, clothes_records, True), output_dir, "player-character-staff-front")
    save(
        build_player_bare_attachment_sheet(clothes, clothes_records, False),
        output_dir,
        "player-character-bare-attachment-back",
    )
    save(
        build_player_bare_attachment_sheet(clothes, clothes_records, True),
        output_dir,
        "player-character-bare-attachment-front",
    )
    save(
        build_player_unselected_attachment_sheet(clothes, clothes_records, False),
        output_dir,
        "player-character-unselected-attachment-back",
    )
    save(
        build_player_unselected_attachment_sheet(clothes, clothes_records, True),
        output_dir,
        "player-character-unselected-attachment-front",
    )
    save(
        build_player_unselected_robe_attachment_sheet(clothes, clothes_records),
        output_dir,
        "player-character-unselected-robe-attachment",
    )
    wand_sheet = build_player_wand_sheet(clothes, clothes_records)
    write_player_weapon_attachment_program(clothes_records, output_dir)
    save(wand_sheet, output_dir, "player-character-wand-back")
    save(wand_sheet, output_dir, "player-character-wand-front")
    for selector in range(4):
        for secondary in (False, True):
            layer = "secondary" if secondary else "primary"
            save(
                build_player_hat_style_sheet(clothes, clothes_records, selector, secondary),
                output_dir,
                f"player-character-hat-{selector}-{layer}",
            )
    for selector in range(3):
        for secondary in (False, True):
            layer = "secondary" if secondary else "primary"
            save(
                build_player_robe_style_sheet(clothes, clothes_records, selector, secondary),
                output_dir,
                f"player-character-robe-{selector}-{layer}",
            )
    save(build_player_fixed_color_sheet(clothes, clothes_records, False), output_dir, "player-character-robe-fixed-primary")
    save(build_player_fixed_color_sheet(clothes, clothes_records, True), output_dir, "player-character-robe-fixed-secondary")
    for selector, base_record in enumerate(PLAYER_DEATH_ROBE_PRIMARY_BASES):
        save(
            build_player_death_layer_sheet(clothes, clothes_records, base_record),
            output_dir,
            f"player-character-death-robe-primary-{selector}",
        )
    for selector, base_record in enumerate(PLAYER_DEATH_ROBE_SECONDARY_BASES):
        save(
            build_player_death_layer_sheet(clothes, clothes_records, base_record),
            output_dir,
            f"player-character-death-robe-secondary-{selector}",
        )
    for name, base_record in PLAYER_DEATH_ROBE_FIXED_BASES.items():
        save(
            build_player_death_layer_sheet(clothes, clothes_records, base_record),
            output_dir,
            f"player-character-death-robe-fixed-{name}",
        )
    for selector, base_record in enumerate(PLAYER_DEATH_HAT_PRIMARY_BASES):
        save(
            build_player_death_hat_strip(
                clothes,
                clothes_records,
                base_record,
                PLAYER_HEADINGS,
            ),
            output_dir,
            f"player-character-death-hat-primary-{selector}",
        )
    for selector, base_record in enumerate(PLAYER_DEATH_HAT_SECONDARY_BASES):
        save(
            build_player_death_hat_strip(
                clothes,
                clothes_records,
                base_record,
                PLAYER_HEADINGS,
            ),
            output_dir,
            f"player-character-death-hat-secondary-{selector}",
        )
    for name, base_record in {"primary": 16, "secondary": 22}.items():
        save(
            build_player_death_hat_strip(
                clothes,
                clothes_records,
                base_record,
                PLAYER_DEATH_FACINGS,
            ),
            output_dir,
            f"player-character-death-hat-special-{name}",
        )
    for selector in range(6):
        save(
            registered_sprite(clothes, clothes_records[5 + selector]),
            output_dir,
            f"player-character-death-staff-{selector}",
        )
    save(
        registered_sprite(clothes, clothes_records[15]),
        output_dir,
        "player-character-death-wand",
    )
    write_player_death_anchor_data(clothes_records, output_dir)
    for element, (primary, secondary) in PLAYER_PALETTES.items():
        player_layers = build_player_colored_layers(
            clothes,
            clothes_records,
            primary,
            secondary,
        )
        for layer_name, sheet in player_layers.items():
            save(sheet, output_dir, f"player-character-{layer_name}-{element}")
        save(
            build_player_death_body_sheet(
                clothes,
                clothes_records,
                primary,
                secondary,
            ),
            output_dir,
            f"player-character-death-{element}",
        )

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
    save(
        build_registered_strip(
            bad_guys,
            bad_guys_records,
            tuple(range(251, 255)),
        ),
        output_dir,
        "primary-spell-fire-impact",
    )
    save(
        build_registered_strip(
            bad_guys,
            bad_guys_records,
            tuple(range(267, 271)),
        ),
        output_dir,
        "primary-spell-fire-particles",
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
    save(
        build_registered_strip(college, college_records, tuple(range(510, 517))),
        output_dir,
        "hub-npc-skorcha-frames",
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
    save(
        build_registered_strip(college, college_records, tuple(range(517, 525))),
        output_dir,
        "hub-npc-perk-witch-frames",
    )
    save(
        registered_sprite(college, college_records[45]),
        output_dir,
        "hub-npc-perk-witch-accessory",
    )
    save(
        build_registered_strip(college, college_records, tuple(range(89, 93))),
        output_dir,
        "hub-npc-perk-witch-crossfades",
    )
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
        build_registered_composite_strip(
            college,
            college_records,
            tuple((10, index) for index in range(126, 130)),
        ),
        output_dir,
        "hub-npc-items-frames",
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
        "hub-hud-key-backing": 22,
        "hub-hud-mana-reserve": 41,
        "hub-hud-golem": 23,
        "hub-hud-mouse-right": 100,
        "hub-hud-skull": 42,
        "hub-hud-tome": 48,
        "hub-hud-xp-fill": 81,
        "hub-hud-xp-frame": 82,
    }
    for name, index in ui_assets.items():
        save(crop(ui, ui_records[index]), output_dir, name)
    save(
        registered_sprite(ui, ui_records[28]),
        output_dir,
        "hub-npc-walk-to-talk-arrow",
    )
    save(
        registered_sprite(ui, ui_records[88]),
        output_dir,
        "hub-npc-directional-hint",
    )

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
    shutil.copyfile(
        images_dir / "Inventory.png",
        output_dir / "hub-trader-inventory-atlas.png",
    )

    skills = Image.open(images_dir / "Skills.png").convert("RGBA")
    skills_records = parse_bundle(images_dir / "Skills.bundle")
    if len(skills_records) != 166:
        raise ValueError(
            f"Skills.bundle has {len(skills_records)} records; expected 166"
        )
    for source_name in ("UI", "Skills"):
        destination = output_dir / f"skill-picker-{source_name.lower()}-atlas.png"
        if not destination.exists():
            shutil.copyfile(images_dir / f"{source_name}.png", destination)
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
