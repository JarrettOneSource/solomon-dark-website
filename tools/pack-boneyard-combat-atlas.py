#!/usr/bin/env python3
"""Pack exact BadGuys and Demon records into bounded runtime atlas pages."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops


PAGE_SIZE = 2048
PAGE_PREFIX = "boneyard-combat-atlas"
SOURCE_DIRECTORIES = ("badguys", "demon")
EXPECTED_SOURCE_COUNT = 2625
EXPECTED_PAGE_COUNT = 2


@dataclass(frozen=True)
class SourceRecord:
    height: int
    rectangle: int | None
    trim_x: int
    trim_y: int
    width: int


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
    return sorted(
        path
        for directory in SOURCE_DIRECTORIES
        for path in (assets_directory / directory).glob("*.png")
    )


def source_key(path: Path) -> str:
    atlas = {"badguys": "BadGuys", "demon": "Demon"}.get(path.parent.name)
    if atlas is None:
        raise SystemExit(f"unknown Boneyard combat atlas directory: {path.parent.name}")
    return f"boneyard-combat:{atlas}:{int(path.stem)}"


def collect_sources(
    paths: list[Path],
) -> tuple[dict[Path, SourceRecord], list[PackedRectangle]]:
    sources: dict[Path, SourceRecord] = {}
    rectangles: list[PackedRectangle] = []
    unique: dict[tuple[tuple[int, int], bytes], list[int]] = {}

    for path in paths:
        image = Image.open(path).convert("RGBA")
        bounds = exact_pixel_bounds(image)
        if bounds is None:
            sources[path] = SourceRecord(image.height, None, 0, 0, image.width)
            continue
        cropped = image.crop(bounds)
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
        sources[path] = SourceRecord(
            image.height,
            rectangle_index,
            bounds[0],
            bounds[1],
            image.width,
        )

    return sources, rectangles


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
                f"Boneyard combat visual exceeds {PAGE_SIZE}px atlas page: "
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
    sources: dict[Path, SourceRecord],
    rectangles: list[PackedRectangle],
    pages: list[Image.Image],
) -> None:
    for path in paths:
        expected = Image.open(path).convert("RGBA")
        source = sources[path]
        actual = Image.new("RGBA", (source.width, source.height))
        if source.rectangle is not None:
            rectangle = rectangles[source.rectangle]
            crop = pages[rectangle.page].crop((
                rectangle.x,
                rectangle.y,
                rectangle.x + rectangle.image.width,
                rectangle.y + rectangle.image.height,
            ))
            actual.paste(crop, (source.trim_x, source.trim_y))
        if actual.tobytes() != expected.tobytes():
            raise SystemExit(f"packed Boneyard combat record differs: {path}")


def png_bytes(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, "PNG", optimize=True, compress_level=9)
    return output.getvalue()


def generated_module(
    assets_directory: Path,
    paths: list[Path],
    sources: dict[Path, SourceRecord],
    rectangles: list[PackedRectangle],
    pages: list[Image.Image],
) -> bytes:
    page_imports = "\n".join(
        f"import page{index} from '../../assets/game/{PAGE_PREFIX}-{index}.png'"
        for index in range(len(pages))
    )
    page_values = ", ".join(f"page{index}" for index in range(len(pages)))
    rows = []
    for index, path in enumerate(paths):
        source = sources[path]
        if source.rectangle is None:
            packed = None
        else:
            rectangle = rectangles[source.rectangle]
            packed = [
                rectangle.page,
                rectangle.x,
                rectangle.y,
                rectangle.image.width,
                rectangle.image.height,
                source.width,
                source.height,
                source.trim_x,
                source.trim_y,
            ]
        rows.append(
            f"  [{json.dumps(source_key(path))}, "
            f"{json.dumps(packed, separators=(',', ':'))}]"
        )
    page_dimensions = [[page.width, page.height] for page in pages]
    decoded_bytes = sum(page.width * page.height * 4 for page in pages)
    source = f"""// Generated by tools/pack-boneyard-combat-atlas.py. Do not edit.
{page_imports}

export type BoneyardCombatPackedFrame = readonly [
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  logicalWidth: number,
  logicalHeight: number,
  trimX: number,
  trimY: number,
] | null

export const BONEYARD_COMBAT_ATLAS_MAX_PAGE_SIZE = {PAGE_SIZE}
export const BONEYARD_COMBAT_ATLAS_DECODED_BYTES = {decoded_bytes}
export const BONEYARD_COMBAT_ATLAS_SOURCE_COUNT = {len(paths)}
export const BONEYARD_COMBAT_ATLAS_EMPTY_SOURCE_COUNT = {sum(record.rectangle is None for record in sources.values())}
export const BONEYARD_COMBAT_ATLAS_PACKED_RECTANGLE_COUNT = {len(rectangles)}
export const BONEYARD_COMBAT_ATLAS_PACKED_RGBA_BYTES = {sum(rectangle.image.width * rectangle.image.height * 4 for rectangle in rectangles)}
export const BONEYARD_COMBAT_ATLAS_PAGE_DIMENSIONS = {json.dumps(page_dimensions, separators=(',', ':'))} as const
export const BONEYARD_COMBAT_ATLAS_SOURCES = [{page_values}] as const
export const BONEYARD_COMBAT_ATLAS_FRAMES: ReadonlyMap<string, BoneyardCombatPackedFrame> = new Map([
{',\n'.join(rows)}
])
"""
    return source.encode("utf-8")


def write_or_check(path: Path, expected: bytes, check: bool) -> None:
    if check:
        if not path.is_file() or path.read_bytes() != expected:
            raise SystemExit(f"generated Boneyard combat atlas is stale: {path}")
        return
    path.write_bytes(expected)


def write_or_check_page(path: Path, page: Image.Image, check: bool) -> None:
    if check:
        if not path.is_file():
            raise SystemExit(f"generated Boneyard combat atlas is stale: {path}")
        with Image.open(path) as source:
            committed = source.convert("RGBA")
        if committed.size != page.size or committed.tobytes() != page.tobytes():
            raise SystemExit(f"generated Boneyard combat atlas is stale: {path}")
        return
    path.write_bytes(png_bytes(page))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    game_assets = root / "frontend" / "src" / "assets" / "game"
    assets_directory = game_assets / "boneyard"
    module_path = (
        root
        / "frontend"
        / "src"
        / "game"
        / "renderer"
        / "boneyard-combat-atlas.generated.ts"
    )
    paths = source_paths(assets_directory)
    if len(paths) != EXPECTED_SOURCE_COUNT:
        raise SystemExit(
            f"expected {EXPECTED_SOURCE_COUNT} Boneyard combat sources, found {len(paths)}"
        )
    sources, rectangles = collect_sources(paths)
    pages = pack_rectangles(rectangles)
    if EXPECTED_PAGE_COUNT is not None and len(pages) != EXPECTED_PAGE_COUNT:
        raise SystemExit(
            f"Boneyard combat visuals require {len(pages)} pages; "
            f"expected {EXPECTED_PAGE_COUNT}"
        )
    verify_reconstruction(paths, sources, rectangles, pages)

    expected_page_names = {
        f"{PAGE_PREFIX}-{index}.png" for index in range(len(pages))
    }
    existing_page_names = {
        path.name for path in game_assets.glob(f"{PAGE_PREFIX}-*.png")
    }
    if args.check and existing_page_names != expected_page_names:
        raise SystemExit("generated Boneyard combat atlas page membership is stale")
    if not args.check:
        for obsolete in sorted(existing_page_names - expected_page_names):
            (game_assets / obsolete).unlink()

    for index, page in enumerate(pages):
        write_or_check_page(
            game_assets / f"{PAGE_PREFIX}-{index}.png",
            page,
            args.check,
        )
    write_or_check(
        module_path,
        generated_module(
            assets_directory,
            paths,
            sources,
            rectangles,
            pages,
        ),
        args.check,
    )
    print(
        f"Packed {len(paths)} Boneyard combat sources into "
        f"{len(pages)} bounded pages ({len(rectangles)} unique crops)."
    )


if __name__ == "__main__":
    main()
