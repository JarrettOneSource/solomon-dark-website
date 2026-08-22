#!/usr/bin/env python3
"""Pack extracted player sheets into bounded runtime atlas pages.

The extracted sheets remain the reviewable pixel oracle. Runtime pages trim
transparent 170x170 cells, retain logical trim/origin metadata, and deduplicate
byte-identical cells. This mirrors the native Clothes page-set lifetime without
changing any composed player pixel.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


CELL_SIZE = 170
PAGE_SIZE = 2048
PAGE_PREFIX = "player-character-atlas"
SOURCE_PATTERN = "player-character-*.png"


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
        if not path.name.startswith(f"{PAGE_PREFIX}-")
    ]


def collect_sources(
    paths: list[Path],
) -> tuple[dict[str, SourceSheet], list[PackedRectangle]]:
    sheets: dict[str, SourceSheet] = {}
    rectangles: list[PackedRectangle] = []
    unique: dict[tuple[tuple[int, int], bytes], list[int]] = {}

    for path in paths:
        image = Image.open(path).convert("RGBA")
        if image.width % CELL_SIZE == 0 and image.height % CELL_SIZE == 0:
            columns = image.width // CELL_SIZE
            rows = image.height // CELL_SIZE
            original_width = CELL_SIZE
            original_height = CELL_SIZE
        else:
            columns = 1
            rows = 1
            original_width = image.width
            original_height = image.height

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
                bounds = cell.getchannel("A").getbbox()
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

        sheets[path.stem] = SourceSheet(
            columns=columns,
            rows=rows,
            original_width=original_width,
            original_height=original_height,
            frames=tuple(frames),
        )

    return sheets, rectangles


def pack_rectangles(rectangles: list[PackedRectangle]) -> list[Image.Image]:
    shelves_by_page: list[list[Shelf]] = []
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
            raise ValueError(f"player frame exceeds {PAGE_SIZE}px atlas page")

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

    pages = [Image.new("RGBA", (PAGE_SIZE, PAGE_SIZE)) for _ in shelves_by_page]
    for rectangle in rectangles:
        pages[rectangle.page].alpha_composite(rectangle.image, (rectangle.x, rectangle.y))
    return pages


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, "PNG", optimize=True, compress_level=9)
    return output.getvalue()


def verify_reconstruction(
    paths: list[Path],
    sheets: dict[str, SourceSheet],
    rectangles: list[PackedRectangle],
    pages: list[Image.Image],
) -> None:
    for path in paths:
        source = Image.open(path).convert("RGBA")
        sheet = sheets[path.stem]
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
                actual.alpha_composite(crop, (frame.trim_x, frame.trim_y))
            if actual.tobytes() != expected.tobytes():
                raise SystemExit(
                    f"packed player frame differs from source: {path.name}:{column}:{row}"
                )


def generated_module(
    sheets: dict[str, SourceSheet],
    rectangles: list[PackedRectangle],
    page_count: int,
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
        name: [
            sheet.columns,
            sheet.rows,
            sheet.original_width,
            sheet.original_height,
            [
                None
                if frame.rectangle is None
                else [frame.rectangle, frame.trim_x, frame.trim_y]
                for frame in sheet.frames
            ],
        ]
        for name, sheet in sheets.items()
    }
    imports = "\n".join(
        f"import page{index} from '../../assets/game/{PAGE_PREFIX}-{index}.png'"
        for index in range(page_count)
    )
    pages = ", ".join(f"page{index}" for index in range(page_count))
    source = f"""// Generated by tools/pack-player-character-atlas.py. Do not edit.
{imports}

export type PlayerCharacterPackedRectangle = readonly [
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
]
export type PlayerCharacterPackedFrame = readonly [
  rectangle: number,
  trimX: number,
  trimY: number,
] | null
export type PlayerCharacterPackedSheet = readonly [
  columns: number,
  rows: number,
  originalWidth: number,
  originalHeight: number,
  frames: readonly PlayerCharacterPackedFrame[],
]

export const PLAYER_CHARACTER_ATLAS_PAGE_SIZE = {PAGE_SIZE}
export const PLAYER_CHARACTER_ATLAS_DECODED_BYTES = {page_count * PAGE_SIZE * PAGE_SIZE * 4}
export const PLAYER_CHARACTER_ATLAS_SOURCE_SHEET_COUNT = {len(sheets)}
export const PLAYER_CHARACTER_ATLAS_FRAME_COUNT = {sum(len(sheet.frames) for sheet in sheets.values())}
export const PLAYER_CHARACTER_ATLAS_EMPTY_FRAME_COUNT = {sum(frame.rectangle is None for sheet in sheets.values() for frame in sheet.frames)}
export const PLAYER_CHARACTER_ATLAS_PACKED_RECTANGLE_COUNT = {len(rectangles)}
export const PLAYER_CHARACTER_ATLAS_PACKED_RGBA_BYTES = {sum(rectangle.image.width * rectangle.image.height * 4 for rectangle in rectangles)}
export const PLAYER_CHARACTER_ATLAS_SOURCES = [{pages}] as const

export const PLAYER_CHARACTER_ATLAS_RECTANGLES: readonly PlayerCharacterPackedRectangle[] = {json.dumps(rectangle_rows, separators=(",", ":"))}

export const PLAYER_CHARACTER_ATLAS_SHEETS: Readonly<Record<string, PlayerCharacterPackedSheet>> = {json.dumps(sheet_rows, separators=(",", ":"))}
"""
    return source.encode("utf-8")


def write_or_check(path: Path, expected: bytes, check: bool) -> None:
    if check:
        if not path.is_file() or path.read_bytes() != expected:
            raise SystemExit(f"generated player atlas is stale: {path}")
        return
    path.write_bytes(expected)


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
        / "player-character-atlas.generated.ts"
    )
    paths = source_paths(assets_directory)
    if len(paths) != 79:
        raise SystemExit(f"expected 79 player source sheets, found {len(paths)}")
    sheets, rectangles = collect_sources(paths)
    pages = pack_rectangles(rectangles)
    if len(pages) > 2:
        raise SystemExit(f"player frames require {len(pages)} atlas pages; expected at most 2")
    verify_reconstruction(paths, sheets, rectangles, pages)

    for index, page in enumerate(pages):
        write_or_check(
            assets_directory / f"{PAGE_PREFIX}-{index}.png",
            png_bytes(page),
            args.check,
        )
    write_or_check(
        module_path,
        generated_module(sheets, rectangles, len(pages)),
        args.check,
    )
    print(
        f"Packed {sum(len(sheet.frames) for sheet in sheets.values())} frames "
        f"from {len(sheets)} sheets into {len(pages)} {PAGE_SIZE}px pages."
    )


if __name__ == "__main__":
    main()
