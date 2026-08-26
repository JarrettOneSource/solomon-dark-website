#!/usr/bin/env python3
"""Pack exact Hub-world visuals into bounded runtime atlas pages.

The extracted PNGs remain the reviewable pixel oracle. Runtime pages split the
known authored sheets into logical frames, trim transparent padding, retain
logical origin metadata, and deduplicate byte-identical frames.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops


PAGE_SIZE = 2048
PAGE_PREFIX = "hub-visual-atlas"
SOURCE_PATTERN = "hub-*.png"
EXPECTED_SOURCE_COUNT = 87

# filename: columns, rows, logical frame width, logical frame height
SHEET_LAYOUTS: dict[str, tuple[int, int, int, int]] = {
    "hub-astronomer-assistants.png": (12, 1, 150, 150),
    "hub-astronomer-green-gesture.png": (5, 1, 450, 450),
    "hub-astronomer-green-idle.png": (4, 1, 450, 450),
    "hub-astronomer-green-transition.png": (3, 1, 450, 450),
    "hub-astronomer-red-gesture.png": (5, 1, 450, 450),
    "hub-astronomer-red-idle.png": (4, 1, 450, 450),
    "hub-astronomer-red-transition.png": (3, 1, 450, 450),
    "hub-astronomer-telescope.png": (5, 1, 374, 292),
    "hub-courtyard-depth-props.png": (4, 1, 508, 263),
    "hub-npc-items-frames.png": (4, 1, 200, 200),
    "hub-npc-perk-witch-crossfades.png": (4, 1, 25, 25),
    "hub-npc-perk-witch-frames.png": (8, 1, 150, 150),
    "hub-npc-potion.png": (5, 1, 35, 49),
    "hub-npc-skorcha-frames.png": (7, 1, 350, 350),
    "hub-room-arch-chancellor.png": (3, 1, 150, 150),
    "hub-room-dowser.png": (4, 1, 150, 150),
    "hub-room-librarian-frames.png": (4, 1, 150, 150),
    "hub-room-library-props.png": (3, 1, 1024, 1024),
    "hub-room-memorator.png": (16, 1, 170, 170),
    "hub-room-mortuary-paintings.png": (10, 1, 74, 224),
    "hub-room-polisher.png": (4, 1, 150, 150),
    "hub-room-storeroom-props.png": (3, 1, 1075, 800),
    "hub-student-head.png": (1, 24, 170, 170),
    "hub-student-prop-0.png": (1, 24, 170, 170),
    "hub-student-prop-1.png": (1, 24, 170, 170),
    "hub-student-prop-2.png": (1, 24, 170, 170),
    "hub-student-prop-3.png": (1, 24, 170, 170),
    "hub-student-prop-4.png": (1, 24, 170, 170),
    "hub-student-read.png": (5, 24, 170, 170),
    "hub-student-walk.png": (5, 24, 170, 170),
    "hub-teacher-burst-frames.png": (11, 1, 31, 140),
    "hub-teacher-frames.png": (4, 1, 150, 150),
    "hub-tent-balloons.png": (5, 1, 54, 72),
}


@dataclass(frozen=True)
class SourceFrame:
    rectangle: int | None
    trim_x: int
    trim_y: int


@dataclass(frozen=True)
class SourceSheet:
    columns: int
    rows: int
    original_width: int
    original_height: int
    frames: tuple[SourceFrame, ...]


@dataclass
class PackedRectangle:
    image: Image.Image
    page: int = -1
    x: int = -1
    y: int = -1


@dataclass
class Shelf:
    height: int
    used_width: int
    y: int


def source_paths(assets_directory: Path) -> list[Path]:
    return [
        path
        for path in sorted(assets_directory.glob(SOURCE_PATTERN))
        if not path.name.startswith("hub-hud-")
        and not path.name.startswith("hub-primary-")
        and path.name != "hub-trader-inventory-atlas.png"
        and not path.name.startswith(f"{PAGE_PREFIX}-")
    ]


def source_layout(path: Path, image: Image.Image) -> tuple[int, int, int, int]:
    layout = SHEET_LAYOUTS.get(path.name, (1, 1, image.width, image.height))
    columns, rows, width, height = layout
    if image.size != (columns * width, rows * height):
        raise SystemExit(
            f"Hub sheet geometry changed for {path.name}: "
            f"{image.width}x{image.height} != {columns}x{rows} of {width}x{height}"
        )
    return layout


def collect_sources(
    paths: list[Path],
) -> tuple[dict[str, SourceSheet], list[PackedRectangle]]:
    sheets: dict[str, SourceSheet] = {}
    rectangles: list[PackedRectangle] = []
    unique: dict[tuple[tuple[int, int], bytes], list[int]] = {}

    for path in paths:
        image = Image.open(path).convert("RGBA")
        columns, rows, original_width, original_height = source_layout(path, image)
        frames: list[SourceFrame] = []
        for row in range(rows):
            for column in range(columns):
                left = column * original_width
                top = row * original_height
                cell = image.crop((
                    left,
                    top,
                    left + original_width,
                    top + original_height,
                ))
                bounds = exact_pixel_bounds(cell)
                if bounds is None:
                    frames.append(SourceFrame(None, 0, 0))
                    continue
                cropped = cell.crop(bounds)
                pixels = cropped.tobytes()
                key = (cropped.size, hashlib.sha256(pixels).digest())
                rectangle_index = None
                for candidate in unique.get(key, []):
                    if rectangles[candidate].image.tobytes() == pixels:
                        rectangle_index = candidate
                        break
                if rectangle_index is None:
                    rectangle_index = len(rectangles)
                    rectangles.append(PackedRectangle(cropped))
                    unique.setdefault(key, []).append(rectangle_index)
                frames.append(SourceFrame(rectangle_index, bounds[0], bounds[1]))

        sheets[path.name] = SourceSheet(
            columns=columns,
            rows=rows,
            original_width=original_width,
            original_height=original_height,
            frames=tuple(frames),
        )

    return sheets, rectangles


def exact_pixel_bounds(image: Image.Image) -> tuple[int, int, int, int] | None:
    red, green, blue, alpha = image.split()
    color = ImageChops.lighter(red, green)
    color = ImageChops.lighter(color, blue)
    return ImageChops.lighter(color, alpha).getbbox()


def pack_rectangles(rectangles: list[PackedRectangle]) -> list[Image.Image]:
    shelves_by_page: list[list[Shelf]] = []
    page_extents: list[list[int]] = []
    order = sorted(
        range(len(rectangles)),
        key=lambda index: (
            -rectangles[index].image.height,
            -rectangles[index].image.width,
            index,
        ),
    )

    for rectangle_index in order:
        rectangle = rectangles[rectangle_index]
        padded_width = rectangle.image.width + 2
        padded_height = rectangle.image.height + 2
        if padded_width > PAGE_SIZE or padded_height > PAGE_SIZE:
            raise SystemExit(
                f"Hub visual exceeds {PAGE_SIZE}px atlas page: "
                f"{rectangle.image.width}x{rectangle.image.height}"
            )

        placed = False
        for page_index, shelves in enumerate(shelves_by_page):
            for shelf in shelves:
                if (
                    padded_height <= shelf.height
                    and shelf.used_width + padded_width <= PAGE_SIZE
                ):
                    rectangle.page = page_index
                    rectangle.x = shelf.used_width + 1
                    rectangle.y = shelf.y + 1
                    shelf.used_width += padded_width
                    placed = True
                    break
            if placed:
                break
            used_height = sum(shelf.height for shelf in shelves)
            if used_height + padded_height <= PAGE_SIZE:
                shelves.append(Shelf(padded_height, padded_width, used_height))
                rectangle.page = page_index
                rectangle.x = 1
                rectangle.y = used_height + 1
                placed = True
                break

        if not placed:
            rectangle.page = len(shelves_by_page)
            rectangle.x = 1
            rectangle.y = 1
            shelves_by_page.append([Shelf(padded_height, padded_width, 0)])
            page_extents.append([0, 0])

        extent = page_extents[rectangle.page]
        extent[0] = max(extent[0], rectangle.x + rectangle.image.width + 1)
        extent[1] = max(extent[1], rectangle.y + rectangle.image.height + 1)

    pages = [Image.new("RGBA", tuple(extent)) for extent in page_extents]
    for rectangle in rectangles:
        pages[rectangle.page].paste(rectangle.image, (rectangle.x, rectangle.y))
    return pages


def verify_reconstruction(
    paths: list[Path],
    sheets: dict[str, SourceSheet],
    rectangles: list[PackedRectangle],
    pages: list[Image.Image],
) -> None:
    for path in paths:
        source = Image.open(path).convert("RGBA")
        sheet = sheets[path.name]
        for index, frame in enumerate(sheet.frames):
            column = index % sheet.columns
            row = index // sheet.columns
            expected = source.crop((
                column * sheet.original_width,
                row * sheet.original_height,
                (column + 1) * sheet.original_width,
                (row + 1) * sheet.original_height,
            ))
            actual = Image.new(
                "RGBA",
                (sheet.original_width, sheet.original_height),
            )
            if frame.rectangle is not None:
                rectangle = rectangles[frame.rectangle]
                crop = pages[rectangle.page].crop((
                    rectangle.x,
                    rectangle.y,
                    rectangle.x + rectangle.image.width,
                    rectangle.y + rectangle.image.height,
                ))
                actual.paste(crop, (frame.trim_x, frame.trim_y))
            if actual.tobytes() != expected.tobytes():
                raise SystemExit(
                    f"packed Hub frame differs from source: "
                    f"{path.name}:{column}:{row}"
                )


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, "PNG", optimize=True, compress_level=9)
    return output.getvalue()


def generated_module(
    paths: list[Path],
    sheets: dict[str, SourceSheet],
    rectangles: list[PackedRectangle],
    pages: list[Image.Image],
) -> bytes:
    rectangle_rows = [
        [
            rectangle.page,
            rectangle.x,
            rectangle.y,
            rectangle.image.width,
            rectangle.image.height,
        ]
        for rectangle in rectangles
    ]
    sheet_rows = {
        path.name: [
            sheets[path.name].columns,
            sheets[path.name].rows,
            sheets[path.name].original_width,
            sheets[path.name].original_height,
            [
                None
                if frame.rectangle is None
                else [frame.rectangle, frame.trim_x, frame.trim_y]
                for frame in sheets[path.name].frames
            ],
        ]
        for path in paths
    }
    source_imports = "\n".join(
        f"import source{index} from '../../assets/game/{path.name}'"
        for index, path in enumerate(paths)
    )
    page_imports = "\n".join(
        f"import page{index} from '../../assets/game/{PAGE_PREFIX}-{index}.png'"
        for index in range(len(pages))
    )
    page_values = ", ".join(f"page{index}" for index in range(len(pages)))
    source_values = ", ".join(f"source{index}" for index in range(len(paths)))
    sheet_entries = ",\n".join(
        f"  [source{index}, {json.dumps(sheet_rows[path.name], separators=(',', ':'))}]"
        for index, path in enumerate(paths)
    )
    page_dimensions = [[page.width, page.height] for page in pages]
    decoded_bytes = sum(page.width * page.height * 4 for page in pages)
    source = f"""// Generated by tools/pack-hub-visual-atlas.py. Do not edit.
{source_imports}
{page_imports}

export type HubVisualPackedRectangle = readonly [
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
]
export type HubVisualPackedFrame = readonly [
  rectangle: number,
  trimX: number,
  trimY: number,
] | null
export type HubVisualPackedSheet = readonly [
  columns: number,
  rows: number,
  originalWidth: number,
  originalHeight: number,
  frames: readonly HubVisualPackedFrame[],
]

export const HUB_VISUAL_ATLAS_MAX_PAGE_SIZE = {PAGE_SIZE}
export const HUB_VISUAL_ATLAS_DECODED_BYTES = {decoded_bytes}
export const HUB_VISUAL_ATLAS_SOURCE_COUNT = {len(paths)}
export const HUB_VISUAL_ATLAS_FRAME_COUNT = {sum(len(sheet.frames) for sheet in sheets.values())}
export const HUB_VISUAL_ATLAS_EMPTY_FRAME_COUNT = {sum(frame.rectangle is None for sheet in sheets.values() for frame in sheet.frames)}
export const HUB_VISUAL_ATLAS_PACKED_RECTANGLE_COUNT = {len(rectangles)}
export const HUB_VISUAL_ATLAS_PACKED_RGBA_BYTES = {sum(rectangle.image.width * rectangle.image.height * 4 for rectangle in rectangles)}
export const HUB_VISUAL_ATLAS_PAGE_DIMENSIONS = {json.dumps(page_dimensions, separators=(',', ':'))} as const
export const HUB_VISUAL_ATLAS_SOURCES = [{page_values}] as const
export const HUB_VISUAL_ATLAS_ORIGINAL_SOURCES = [{source_values}] as const

export const HUB_VISUAL_ATLAS_RECTANGLES: readonly HubVisualPackedRectangle[] = {json.dumps(rectangle_rows, separators=(',', ':'))}

export const HUB_VISUAL_ATLAS_SHEETS: ReadonlyMap<string, HubVisualPackedSheet> = new Map([
{sheet_entries}
])
"""
    return source.encode("utf-8")


def write_or_check(path: Path, expected: bytes, check: bool) -> None:
    if check:
        if not path.is_file() or path.read_bytes() != expected:
            raise SystemExit(f"generated Hub visual atlas is stale: {path}")
        return
    path.write_bytes(expected)


def write_or_check_page(path: Path, page: Image.Image, check: bool) -> None:
    if check:
        if not path.is_file():
            raise SystemExit(f"generated Hub visual atlas is stale: {path}")
        with Image.open(path) as source:
            committed = source.convert("RGBA")
        if committed.size != page.size or committed.tobytes() != page.tobytes():
            raise SystemExit(f"generated Hub visual atlas is stale: {path}")
        return
    path.write_bytes(png_bytes(page))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    assets_directory = root / "frontend" / "src" / "assets" / "game"
    module_path = (
        root
        / "frontend"
        / "src"
        / "game"
        / "renderer"
        / "hub-visual-atlas.generated.ts"
    )
    paths = source_paths(assets_directory)
    if len(paths) != EXPECTED_SOURCE_COUNT:
        raise SystemExit(
            f"expected {EXPECTED_SOURCE_COUNT} Hub visual sources, found {len(paths)}"
        )
    missing_layouts = sorted(set(SHEET_LAYOUTS) - {path.name for path in paths})
    if missing_layouts:
        raise SystemExit(f"missing Hub sheet sources: {', '.join(missing_layouts)}")

    sheets, rectangles = collect_sources(paths)
    pages = pack_rectangles(rectangles)
    if len(pages) != 3:
        raise SystemExit(f"Hub visuals require {len(pages)} atlas pages; expected 3")
    verify_reconstruction(paths, sheets, rectangles, pages)

    for index, page in enumerate(pages):
        write_or_check_page(
            assets_directory / f"{PAGE_PREFIX}-{index}.png",
            page,
            args.check,
        )
    write_or_check(
        module_path,
        generated_module(paths, sheets, rectangles, pages),
        args.check,
    )
    print(
        f"Packed {sum(len(sheet.frames) for sheet in sheets.values())} Hub frames "
        f"from {len(paths)} sources into {len(pages)} bounded pages."
    )


if __name__ == "__main__":
    main()
