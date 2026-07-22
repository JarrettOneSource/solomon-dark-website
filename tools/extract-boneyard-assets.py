#!/usr/bin/env python3
"""Extract the native Boneyard editor atlases without changing sprite geometry."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import struct
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

from PIL import Image, ImageDraw, ImageFont


TOOLS_DIR = Path(__file__).resolve().parent
WEBSITE_DIR = TOOLS_DIR.parent
SOLOMON_DARK_DIR = WEBSITE_DIR.parent
DEFAULT_IMAGES_DIR = SOLOMON_DARK_DIR / "SolomonDarkAbandonware" / "images"
ASSET_ROOT = WEBSITE_DIR / "frontend" / "src" / "assets" / "game" / "boneyard"
MANIFEST_ROOT = WEBSITE_DIR / "frontend" / "src" / "editor" / "manifest"
CONTACT_ROOT = TOOLS_DIR / "out"
SHARED_PARSER_PATH = SOLOMON_DARK_DIR / "Mod Loader" / "tools" / "extract_bundles.py"

# Goodie renders its placed sprite from DeadHawg, but its native render/tick path
# also owns BadGuys indicator and effect sprites. Keep that atlas available to the
# editor rather than silently omitting a class-owned art source.
ATLAS_NAMES = ("DeadHawg", "Bonedit", "BadGuys")

THUMB_SIZE = 80
LABEL_HEIGHT = 18
CELL_PADDING = 5
CELL_WIDTH = THUMB_SIZE + CELL_PADDING * 2
CELL_HEIGHT = THUMB_SIZE + LABEL_HEIGHT + CELL_PADDING * 2
CONTACT_BACKGROUND = (112, 112, 112)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "images_dir",
        nargs="?",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help=f"0.72.5 images directory (default: {DEFAULT_IMAGES_DIR})",
    )
    return parser.parse_args()


def load_shared_parser() -> ModuleType:
    if not SHARED_PARSER_PATH.is_file():
        raise FileNotFoundError(f"missing shared bundle parser: {SHARED_PARSER_PATH}")
    spec = importlib.util.spec_from_file_location(
        "solomon_dark_extract_bundles", SHARED_PARSER_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load shared bundle parser: {SHARED_PARSER_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def json_number(value: float) -> int | float:
    return int(value) if value.is_integer() else value


def exact_int(value: float, field: str, atlas_name: str, entry_id: int) -> int:
    if not math.isfinite(value) or not value.is_integer():
        raise ValueError(
            f"{atlas_name}[{entry_id}] {field} must be an integral finite value, "
            f"got {value!r}"
        )
    return int(value)


def record_box(
    record: Any, atlas_name: str, entry_id: int, png_size: tuple[int, int]
) -> tuple[int, int, int, int]:
    x = exact_int(record.x, "x", atlas_name, entry_id)
    y = exact_int(record.y, "y", atlas_name, entry_id)
    width = exact_int(record.width, "width", atlas_name, entry_id)
    height = exact_int(record.height, "height", atlas_name, entry_id)
    if width <= 0 or height <= 0:
        raise ValueError(
            f"{atlas_name}[{entry_id}] has non-positive rect {width}x{height}"
        )
    if x < 0 or y < 0 or x + width > png_size[0] or y + height > png_size[1]:
        raise ValueError(
            f"{atlas_name}[{entry_id}] rect {(x, y, width, height)} exceeds "
            f"atlas {png_size[0]}x{png_size[1]}"
        )
    return x, y, x + width, y + height


def record_extras(
    bundle_data: bytes, record: Any, shared_parser: ModuleType
) -> list[dict[str, int | float]] | None:
    if record.point_count == 0:
        return None
    extras: list[dict[str, int | float]] = []
    offset = record.offset + shared_parser.COMMON_HEADER_SIZE
    for point_index in range(record.point_count):
        x, y = struct.unpack_from(
            "<2f", bundle_data, offset + point_index * shared_parser.POINT_SIZE
        )
        extras.append({"x": json_number(x), "y": json_number(y)})
    return extras


def load_label_font() -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype("DejaVuSans.ttf", 12)
    except OSError:
        return ImageFont.load_default()


def contact_dimensions(entry_count: int) -> tuple[int, int]:
    columns = max(1, math.ceil(math.sqrt(entry_count * CELL_HEIGHT / CELL_WIDTH)))
    return columns, math.ceil(entry_count / columns)


def add_contact_entry(
    sheet: Image.Image,
    draw: ImageDraw.ImageDraw,
    font: ImageFont.ImageFont | ImageFont.FreeTypeFont,
    sprite: Image.Image,
    entry_id: int,
    columns: int,
    empty: bool,
) -> None:
    column = entry_id % columns
    row = entry_id // columns
    cell_x = column * CELL_WIDTH
    cell_y = row * CELL_HEIGHT
    image_x = cell_x + CELL_PADDING
    image_y = cell_y + CELL_PADDING

    if empty:
        draw.line(
            (image_x, image_y, image_x + THUMB_SIZE, image_y + THUMB_SIZE),
            fill=(80, 80, 80),
            width=1,
        )
        draw.line(
            (image_x + THUMB_SIZE, image_y, image_x, image_y + THUMB_SIZE),
            fill=(80, 80, 80),
            width=1,
        )
    else:
        thumbnail = sprite.copy()
        thumbnail.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.Resampling.LANCZOS)
        paste_x = image_x + (THUMB_SIZE - thumbnail.width) // 2
        paste_y = image_y + (THUMB_SIZE - thumbnail.height) // 2
        sheet.paste(thumbnail, (paste_x, paste_y), thumbnail)

    label = str(entry_id)
    label_box = draw.textbbox((0, 0), label, font=font)
    label_width = label_box[2] - label_box[0]
    label_x = cell_x + (CELL_WIDTH - label_width) // 2
    label_y = cell_y + CELL_PADDING + THUMB_SIZE + 1
    draw.text((label_x, label_y), label, fill=(18, 18, 18), font=font)
    draw.rectangle(
        (cell_x, cell_y, cell_x + CELL_WIDTH - 1, cell_y + CELL_HEIGHT - 1),
        outline=(88, 88, 88),
        width=1,
    )


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def extract_atlas(
    images_dir: Path, atlas_name: str, shared_parser: ModuleType
) -> dict[str, int | str]:
    bundle_path = images_dir / f"{atlas_name}.bundle"
    png_path = images_dir / f"{atlas_name}.png"
    if not bundle_path.is_file():
        raise FileNotFoundError(f"missing bundle: {bundle_path}")
    if not png_path.is_file():
        raise FileNotFoundError(f"missing atlas: {png_path}")

    records, auxiliary_groups = shared_parser.parse_bundle(bundle_path)
    if auxiliary_groups:
        raise ValueError(f"{atlas_name} unexpectedly contains auxiliary groups")

    bundle_data = bundle_path.read_bytes()
    atlas_key = atlas_name.lower()
    atlas_output_dir = ASSET_ROOT / atlas_key
    if atlas_output_dir.exists():
        shutil.rmtree(atlas_output_dir)
    atlas_output_dir.mkdir(parents=True)
    MANIFEST_ROOT.mkdir(parents=True, exist_ok=True)
    CONTACT_ROOT.mkdir(parents=True, exist_ok=True)

    with Image.open(png_path) as source_image:
        atlas = source_image.convert("RGBA")
    png_width, png_height = atlas.size
    digits = max(3, len(str(len(records) - 1)))
    columns, rows = contact_dimensions(len(records))
    contact = Image.new(
        "RGB", (columns * CELL_WIDTH, rows * CELL_HEIGHT), CONTACT_BACKGROUND
    )
    contact_draw = ImageDraw.Draw(contact)
    contact_font = load_label_font()

    entries: list[dict[str, Any]] = []
    empty_count = 0
    pixel_digests: dict[tuple[tuple[int, int], str], list[int]] = {}
    for entry_id, record in enumerate(records):
        box = record_box(record, atlas_name, entry_id, atlas.size)
        sprite = atlas.crop(box)
        empty = sprite.getchannel("A").getbbox() is None
        filename = f"{entry_id:0{digits}d}.png"
        relative_file = None if empty else f"{atlas_key}/{filename}"
        if empty:
            empty_count += 1
        else:
            sprite.save(
                atlas_output_dir / filename,
                format="PNG",
                optimize=True,
                compress_level=9,
            )
            digest = (sprite.size, hashlib.sha256(sprite.tobytes()).hexdigest())
            pixel_digests.setdefault(digest, []).append(entry_id)

        x0, y0, x1, y1 = box
        entries.append(
            {
                "id": entry_id,
                "file": relative_file,
                "rect": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0},
                "cell": {"w": record.logical_width, "h": record.logical_height},
                "origin": {
                    "x": json_number(record.center_offset_x),
                    "y": json_number(record.center_offset_y),
                },
                "extras": record_extras(bundle_data, record, shared_parser),
                "empty": empty,
            }
        )
        add_contact_entry(
            contact,
            contact_draw,
            contact_font,
            sprite,
            entry_id,
            columns,
            empty,
        )

    manifest = {
        "atlas": atlas_name,
        "pngSize": {"w": png_width, "h": png_height},
        "entries": entries,
    }
    write_json(MANIFEST_ROOT / f"{atlas_key}.json", manifest)
    contact.save(
        CONTACT_ROOT / f"boneyard-contact-{atlas_key}.png",
        format="PNG",
        optimize=True,
        compress_level=9,
    )

    duplicate_groups = sum(1 for ids in pixel_digests.values() if len(ids) > 1)
    return {
        "atlas": atlas_name,
        "entries": len(records),
        "empty": empty_count,
        "duplicate_groups": duplicate_groups,
    }


PALETTE_CATEGORIES = (
    "graves",
    "trees",
    "flora",
    "buildings",
    "statues",
    "fences",
    "ground",
    "props",
    "fx",
    "markers",
    "unknown",
)


def write_palette_manifest() -> dict[str, int]:
    deadhawg = json.loads(
        (MANIFEST_ROOT / "deadhawg.json").read_text(encoding="utf-8")
    )
    categories: dict[str, list[dict[str, int | str]]] = {
        category: [] for category in PALETTE_CATEGORIES
    }
    assigned: dict[int, str] = {}

    def add(category: str, entry_id: int, label: str) -> None:
        if category not in categories:
            raise ValueError(f"unknown palette category: {category}")
        if entry_id in assigned:
            raise ValueError(
                f"DeadHawg[{entry_id}] is in both {assigned[entry_id]} and {category}"
            )
        if label != label.lower():
            raise ValueError(f"palette label must be lowercase: {label}")
        categories[category].append({"id": entry_id, "label": label})
        assigned[entry_id] = category

    def add_many(category: str, labels: dict[int, str]) -> None:
        for entry_id, label in labels.items():
            add(category, entry_id, label)

    def add_numbered(
        category: str, first: int, last: int, noun: str, digits: int = 2
    ) -> None:
        for entry_id in range(first, last + 1):
            add(category, entry_id, f"{noun} {entry_id - first:0{digits}d}")

    add_many(
        "graves",
        {
            88: "grave rubble",
            89: "grave dirt mound",
            90: "broken grave slab",
            91: "grave haze",
            92: "grave dirt patch",
            93: "grave rubble scatter",
            94: "cracked grave slab",
            95: "open grave",
            96: "empty grave pit",
            97: "rounded headstone",
            98: "stone cross",
            99: "tall obelisk",
            100: "broken cross",
            101: "arched headstone",
            102: "small headstone",
            103: "iron grave marker",
            104: "double headstone",
            105: "celtic cross",
            106: "winged headstone",
            107: "celtic headstone",
            108: "tall headstone",
            109: "inscribed headstone",
            110: "broken headstone",
            111: "square headstone",
            112: "arched grave marker",
            113: "short headstone",
        },
    )

    add("trees", 144, "dead stump")
    add_numbered("trees", 228, 234, "tree root outline", 1)
    add_numbered("trees", 235, 242, "tree shadow", 1)
    add_many(
        "trees",
        {
            243: "autumn canopy",
            244: "red leaf canopy",
            245: "dark leaf canopy",
            246: "willow canopy left",
            247: "willow canopy center",
            248: "willow canopy right",
            249: "fir canopy",
            250: "sparse canopy",
            264: "twisted dead oak",
            265: "forked dead oak",
            266: "crooked dead oak",
            267: "broken dead oak",
            268: "dead pine",
            269: "white dead oak",
        },
    )

    add_many(
        "flora",
        {
            4: "round bramble",
            114: "autumn leaf bed",
            115: "autumn leaf cluster",
            116: "green leaf bed",
            117: "green leaf cluster",
            118: "gray leaf bed",
            119: "gray leaf cluster",
            270: "square hedge",
            271: "round shrub",
            272: "tall shrub",
            279: "cattail clump left",
            280: "cattail clump right",
            281: "grass clump left",
            282: "grass clump right",
        },
    )

    add_many(
        "buildings",
        {
            148: "mausoleum front",
            149: "stone chapel",
            150: "tiled crypt",
            151: "wooden crypt",
            152: "mausoleum roof",
            153: "chapel roof",
            154: "tiled crypt roof",
            155: "wooden crypt roof",
        },
    )

    add_many(
        "statues",
        {
            156: "reclining lion left",
            157: "reclining lion right",
            158: "hooded knight left",
            159: "hooded knight right",
            160: "robed statue left",
            161: "robed statue right",
            162: "winged angel",
            163: "kneeling mourner left",
            164: "kneeling mourner right",
            165: "gargoyle bust",
            166: "stone reliquary",
            167: "mounted knight left",
            168: "mounted knight right",
            169: "winged archer left",
            170: "winged archer right",
            171: "seated mourner left",
            172: "seated mourner right",
            173: "standing knight",
            174: "stone pedestal front",
            175: "stone pedestal left",
            176: "stone pedestal right",
        },
    )

    add_many(
        "fences",
        {
            3: "broken iron grate",
            7: "ornate iron gate",
            8: "gate hinge",
            23: "iron rail",
            133: "broken fence pile left",
            134: "broken fence pile right",
        },
    )
    add_numbered("fences", 36, 42, "stone fencepost", 1)
    add_numbered("fences", 320, 347, "wood fencepost")

    add_many(
        "ground",
        {
            11: "dark moss tile",
            12: "moss stone tile",
            20: "oval shadow",
            27: "ground crack",
            31: "green moss spot",
            33: "small dirt patch",
            34: "round dirt patch",
            35: "wide dirt patch",
            120: "large dirt patch",
            121: "dark dirt patch",
            122: "small dark patch",
            123: "square stone tile",
            124: "diamond stone tile",
            125: "slanted stone tile",
            126: "moss stone square",
            319: "wood plank tile",
        },
    )

    add_many(
        "props",
        {
            13: "low rubble",
            14: "spider cocoon",
            43: "small rock left",
            44: "small rock center",
            45: "small rock right",
            127: "pebble pair",
            128: "pebble trio",
            129: "small pebble pile",
            130: "round pebble pile",
            131: "pebble cluster left",
            132: "pebble cluster right",
            135: "flat rock left",
            136: "flat rock center",
            137: "long flat rock",
            138: "flat rock right",
            145: "ornate coffer",
            146: "stone coffer",
            147: "broken coffer",
            273: "signpost fork left",
            274: "signpost fork right",
            275: "signpost cross left",
            276: "signpost cross right",
            277: "signpost diagonal left",
            278: "signpost diagonal right",
        },
    )
    add_numbered("props", 283, 318, "rock pile")

    add_many(
        "fx",
        {
            0: "green spore burst",
            1: "blind splatter",
            2: "black impact",
            5: "white comet",
            6: "blue vortex",
            9: "white glow",
            15: "gray vortex",
            16: "blue banish ring",
            17: "glass rupture",
            18: "white orb",
            19: "fire burst",
            25: "white arc",
            26: "white wisp",
            28: "white starburst",
            29: "silk burst",
            30: "green mist",
            177: "red leaf mote",
            178: "green leaf mote",
            179: "stone mote",
            200: "earthquake cracks",
            201: "earthquake crack left",
            202: "earthquake crack right",
        },
    )
    add_numbered("fx", 46, 77, "fire frame")
    add_numbered("fx", 78, 87, "golem debris")
    add_numbered("fx", 180, 199, "fire portal frame")
    add_numbered("fx", 203, 207, "white pebble frame")
    add_numbered("fx", 208, 227, "dead spider frame")

    add_many(
        "markers",
        {
            10: "white pixel",
            21: "metal ring",
            22: "pentagram",
            24: "white reticle",
            32: "white point",
        },
    )

    add_many(
        "unknown",
        {
            139: "double shadow mask",
            140: "narrow shadow mask",
            141: "round shadow mask",
            142: "low shadow mask",
            143: "large round mask",
        },
    )

    non_empty_ids = {
        entry["id"] for entry in deadhawg["entries"] if not entry["empty"]
    }
    assigned_ids = set(assigned)
    if assigned_ids != non_empty_ids:
        missing = sorted(non_empty_ids - assigned_ids)
        extra = sorted(assigned_ids - non_empty_ids)
        raise ValueError(f"invalid palette coverage; missing={missing}, extra={extra}")
    for entries in categories.values():
        entries.sort(key=lambda entry: int(entry["id"]))

    write_json(
        MANIFEST_ROOT / "palette.json",
        {"atlas": "DeadHawg", "categories": categories},
    )
    return {category: len(entries) for category, entries in categories.items()}


def write_classes_manifest() -> None:
    classes = {
        "evidence": [
            "Mod Loader/docs/reverse-engineering/native-game-object-catalog.json",
            "Mod Loader/docs/reverse-engineering/native-asset-object-map.json",
            "Mod Loader/docs/reverse-engineering/native-atlas-consumers.json",
            "Mod Loader/docs/reverse-engineering/native-asset-system.md",
            "Mod Loader/docs/reverse-engineering/boneyard-system.md",
        ],
        "classes": [
            {
                "id": 2001,
                "name": "Tree",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(228, 243)),
                        "role": "bounds and reference sprites",
                    },
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(243, 264)),
                        "role": "overlay and foreground sprites",
                    },
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(264, 283)),
                        "role": "visible trunk and canopy sprites",
                    },
                ],
                "variantMappings": [
                    {
                        "selector": "main short at +0x140",
                        "atlas": "DeadHawg",
                        "entryIdsByVariant": list(range(264, 283)),
                        "role": "visible trunk and canopy",
                        "confidence": "verified",
                    },
                    {
                        "selector": "overlay short at +0x142",
                        "atlas": "DeadHawg",
                        "entryIdsByVariant": list(range(243, 264)),
                        "role": "conditional overlay and foreground",
                        "confidence": "verified",
                    },
                ],
                "unresolved": [
                    "The selector relation for DeadHawg entries 228 through 242 is not established."
                ],
            },
            {
                "id": 2009,
                "name": "Monument",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(156, 177)),
                        "role": "monument sprites",
                    }
                ],
                "variantMappings": [
                    {
                        "selector": "short at +0x140",
                        "atlas": "DeadHawg",
                        "entryIdsByVariant": list(range(156, 177)),
                        "role": "monument",
                        "confidence": "verified",
                    }
                ],
                "unresolved": [],
            },
            {
                "id": 2029,
                "name": "Gravestone",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(88, 97)),
                        "role": "grave overlay sprites",
                    },
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(97, 114)),
                        "role": "gravestone base sprites",
                    },
                ],
                "variantMappings": [
                    {
                        "selector": "main short at +0x140",
                        "atlas": "DeadHawg",
                        "entryIdsByVariant": list(range(97, 114)),
                        "role": "gravestone base",
                        "confidence": "verified",
                    },
                    {
                        "selector": "overlay short at +0x142",
                        "atlas": "DeadHawg",
                        "entryIdsByVariant": list(range(88, 97)),
                        "role": "grave overlay",
                        "confidence": "verified",
                    },
                ],
                "unresolved": [],
            },
            {
                "id": 2040,
                "name": "Building",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(148, 152)),
                        "role": "building base sprites",
                    },
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(152, 156)),
                        "role": "building upper sprites",
                    },
                ],
                "variantMappings": [
                    {
                        "selector": "short at +0x140",
                        "atlas": "DeadHawg",
                        "entryIdsByVariant": list(range(148, 152)),
                        "role": "building base",
                        "confidence": "verified",
                    },
                    {
                        "selector": "short at +0x140",
                        "atlas": "DeadHawg",
                        "entryIdsByVariant": list(range(152, 156)),
                        "role": "building upper layer",
                        "confidence": "verified",
                    },
                ],
                "unresolved": [],
            },
            {
                "id": 2061,
                "name": "Goodie",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": [145, 146, 147],
                        "role": "placed coffer states",
                    },
                    {
                        "kind": "atlas",
                        "atlas": "BadGuys",
                        "entryIds": [15, 33, 52, 377, 378, 379, 380],
                        "role": "active indicator and break effects",
                    },
                ],
                "variantMappings": [
                    {
                        "selector": "phase + 2 * subtype",
                        "atlas": "DeadHawg",
                        "entryIds": [145, 146, 147],
                        "formula": "entry id = 145 + phase + 2 * subtype, with native array bounds normalization",
                        "role": "placed coffer state",
                        "confidence": "verified",
                    }
                ],
                "unresolved": [
                    "The BadGuys records are secondary effects, not placement variants. Their internal selectors are not mapped here."
                ],
            },
            {
                "id": 3004,
                "name": "Road",
                "confidence": "probable",
                "artSources": [
                    {
                        "kind": "looseImage",
                        "files": [
                            "road.png",
                            "road2.png",
                            "road3.png",
                            "road4.png",
                            "road5.png",
                        ],
                        "role": "generated road mesh textures",
                    }
                ],
                "variantMappings": [
                    {
                        "selector": "texture byte at +0x8C",
                        "filesByVariant": [
                            "road.png",
                            "road2.png",
                            "road3.png",
                            "road4.png",
                            "road5.png",
                        ],
                        "role": "road texture",
                        "confidence": "probable",
                    }
                ],
                "unresolved": [
                    "The five loose textures and selector are verified. The zero-based file order is probable."
                ],
            },
            {
                "id": 3005,
                "name": "Fence",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "looseImage",
                        "files": ["fencegrate.png"],
                        "role": "intact grate texture",
                    },
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": [3, 7, 8, 23],
                        "role": "broken grate, gate, and rail sprites",
                    },
                    {
                        "kind": "generated",
                        "role": "wall mesh",
                    },
                ],
                "variantMappings": [
                    {
                        "selector": "segment code byte at +0x44",
                        "role": "derived fence object",
                        "confidence": "verified",
                        "variants": [
                            {
                                "variant": 0,
                                "art": [
                                    {
                                        "kind": "looseImage",
                                        "files": ["fencegrate.png"],
                                        "role": "intact grate",
                                    }
                                ],
                            },
                            {
                                "variant": 1,
                                "art": [
                                    {
                                        "kind": "atlas",
                                        "atlas": "DeadHawg",
                                        "entryIds": [3],
                                        "role": "broken grate halves",
                                    }
                                ],
                            },
                            {
                                "variant": 2,
                                "art": [
                                    {
                                        "kind": "atlas",
                                        "atlas": "DeadHawg",
                                        "entryIds": [7, 8],
                                        "role": "hinged gate leaves",
                                    }
                                ],
                            },
                            {
                                "variant": 3,
                                "art": [{"kind": "generated", "role": "wall mesh"}],
                            },
                            {
                                "variant": 4,
                                "art": [
                                    {
                                        "kind": "atlas",
                                        "atlas": "DeadHawg",
                                        "entryIds": [23],
                                        "role": "rail section",
                                    }
                                ],
                            },
                        ],
                    }
                ],
                "unresolved": [],
            },
            {
                "id": 3006,
                "name": "Fencepost",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(36, 43)),
                        "role": "stone fenceposts",
                    },
                    {
                        "kind": "atlas",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(320, 348)),
                        "role": "wood fenceposts",
                    },
                ],
                "variantMappings": [
                    {
                        "selector": "post selector at +0x140 when style +0x144 is zero",
                        "atlas": "DeadHawg",
                        "entryIdsByVariant": list(range(36, 43)),
                        "role": "stone fencepost",
                        "confidence": "verified",
                    },
                    {
                        "selector": "post selector at +0x140 when style +0x144 is nonzero",
                        "atlas": "DeadHawg",
                        "entryIds": list(range(320, 348)),
                        "role": "wood fencepost",
                        "confidence": "verified",
                    },
                ],
                "unresolved": [
                    "The exact style and post selector formula within entries 320 through 347 is not established."
                ],
            },
            {
                "id": 3007,
                "name": "FenceGrate",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "looseImage",
                        "files": ["fencegrate.png"],
                        "role": "repeated grate texture",
                    }
                ],
                "variantMappings": [],
                "unresolved": [
                    "FenceGrate has no atlas entry selector. Its renderer repeats the loose texture over generated geometry."
                ],
            },
            {
                "id": 3009,
                "name": "Terrain",
                "confidence": "verified",
                "artSources": [
                    {
                        "kind": "generated",
                        "role": "vertex and index buffers built by 0x0064F0F0 or 0x0064FA90",
                    }
                ],
                "variantMappings": [],
                "unresolved": [
                    "Terrain has no established atlas entry mapping. Field +0xC0 selects one of two geometry builders; an exact texture binding is not established."
                ],
            },
        ],
    }
    write_json(MANIFEST_ROOT / "classes.json", classes)


def main() -> int:
    args = parse_args()
    images_dir = args.images_dir.resolve()
    shared_parser = load_shared_parser()
    results = [
        extract_atlas(images_dir, atlas_name, shared_parser)
        for atlas_name in ATLAS_NAMES
    ]
    palette_counts = write_palette_manifest()
    write_classes_manifest()
    for result in results:
        print(
            f"{result['atlas']}: {result['entries']} entries, "
            f"{result['empty']} empty, "
            f"{result['duplicate_groups']} duplicate pixel group(s)"
        )
    print(
        "Palette: "
        + ", ".join(
            f"{category}={palette_counts[category]}"
            for category in PALETTE_CATEGORIES
        )
    )
    print(f"Assets: {ASSET_ROOT}")
    print(f"Manifests: {MANIFEST_ROOT}")
    print(f"Contact sheets: {CONTACT_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
