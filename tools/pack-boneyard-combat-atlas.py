#!/usr/bin/env python3
"""Reconstruct native combat atlas pages from exact retail record crops."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


PAGE_SIZE = 2048
PAGE_PREFIX = "boneyard-combat-atlas"
ATLAS_SPECS = (
    ("BadGuys", "badguys.json"),
    ("Demon", "demon.json"),
    ("DeadHawg", "deadhawg.json"),
    ("Golem", "golem.json"),
)
EXPECTED_SOURCE_COUNT = 3164
EXPECTED_PAGE_COUNT = 4
EXPECTED_PAGE_SHA256 = (
    "af5717b37c81306d515eed6d9f8717fa97bd1c63b9530a7079738c457c97443e",
    "0a6feca43b7f1a35f09d43494a1c794c7962d555e52b13703439b72085529ae4",
    "3758ce24d516f0ca6349e57b988d8a84e8d6f89fb3827856d7bb521618281af0",
    "586bb06b4fc69f0d90c90da99871e1cd97d5f250a1e83edbba82a4b7504294ac",
)


@dataclass(frozen=True)
class NativeFrame:
    atlas: str
    entry: int
    height: int
    page: int
    path: Path
    width: int
    x: int
    y: int


def source_key(frame: NativeFrame) -> str:
    return f"boneyard-combat:{frame.atlas}:{frame.entry}"


def build_native_pages(
    root: Path,
) -> tuple[list[NativeFrame], list[Image.Image]]:
    assets_directory = root / "frontend" / "src" / "assets" / "game" / "boneyard"
    manifest_directory = root / "frontend" / "src" / "editor" / "manifest"
    frames: list[NativeFrame] = []
    pages: list[Image.Image] = []

    for page_index, (atlas, manifest_name) in enumerate(ATLAS_SPECS):
        manifest = json.loads((manifest_directory / manifest_name).read_text())
        if manifest.get("atlas") != atlas:
            raise SystemExit(f"native atlas manifest identity drifted: {manifest_name}")
        page_size = manifest.get("pngSize")
        if not isinstance(page_size, dict):
            raise SystemExit(f"native atlas page size is absent: {manifest_name}")
        width = page_size.get("w")
        height = page_size.get("h")
        if not isinstance(width, int) or not isinstance(height, int):
            raise SystemExit(f"native atlas page size is invalid: {manifest_name}")
        if width > PAGE_SIZE or height > PAGE_SIZE:
            raise SystemExit(f"native atlas exceeds {PAGE_SIZE}px: {atlas} {width}x{height}")

        page = Image.new("RGBA", (width, height))
        pixels = page.load()
        covered = bytearray(width * height)
        entries = manifest.get("entries")
        if not isinstance(entries, list):
            raise SystemExit(f"native atlas entries are absent: {manifest_name}")

        for entry in entries:
            if not isinstance(entry, dict) or entry.get("empty"):
                continue
            entry_id = entry.get("id")
            file_name = entry.get("file")
            rectangle = entry.get("rect")
            if (
                not isinstance(entry_id, int)
                or not isinstance(file_name, str)
                or not isinstance(rectangle, dict)
            ):
                raise SystemExit(f"native atlas entry is malformed: {atlas}:{entry_id}")
            x = rectangle.get("x")
            y = rectangle.get("y")
            frame_width = rectangle.get("w")
            frame_height = rectangle.get("h")
            if not all(isinstance(value, int) for value in (x, y, frame_width, frame_height)):
                raise SystemExit(f"native atlas rectangle is malformed: {atlas}:{entry_id}")
            assert isinstance(x, int)
            assert isinstance(y, int)
            assert isinstance(frame_width, int)
            assert isinstance(frame_height, int)
            if (
                x < 0
                or y < 0
                or frame_width < 1
                or frame_height < 1
                or x + frame_width > width
                or y + frame_height > height
            ):
                raise SystemExit(f"native atlas rectangle is out of bounds: {atlas}:{entry_id}")

            path = assets_directory / file_name
            with Image.open(path) as source:
                image = source.convert("RGBA")
            if image.size != (frame_width, frame_height):
                raise SystemExit(
                    f"native record crop geometry drifted: {atlas}:{entry_id} "
                    f"{image.width}x{image.height} != {frame_width}x{frame_height}"
                )

            frame_pixels = image.load()
            for local_y in range(frame_height):
                page_y = y + local_y
                row = page_y * width
                for local_x in range(frame_width):
                    page_x = x + local_x
                    index = row + page_x
                    pixel = frame_pixels[local_x, local_y]
                    if covered[index] and pixels[page_x, page_y] != pixel:
                        raise SystemExit(
                            f"overlapping native records disagree: {atlas}:{entry_id} "
                            f"at {page_x},{page_y}"
                        )
                    pixels[page_x, page_y] = pixel
                    covered[index] = 1

            frames.append(NativeFrame(
                atlas=atlas,
                entry=entry_id,
                height=frame_height,
                page=page_index,
                path=path,
                width=frame_width,
                x=x,
                y=y,
            ))
        pages.append(page)

    frames.sort(key=lambda frame: (frame.atlas, frame.entry))
    return frames, pages


def verify_reconstruction(
    frames: list[NativeFrame],
    pages: list[Image.Image],
) -> None:
    for frame in frames:
        with Image.open(frame.path) as source:
            expected = source.convert("RGBA")
        actual = pages[frame.page].crop((
            frame.x,
            frame.y,
            frame.x + frame.width,
            frame.y + frame.height,
        ))
        if actual.tobytes() != expected.tobytes():
            raise SystemExit(
                f"native page record differs after reconstruction: {frame.atlas}:{frame.entry}"
            )


def generated_module(frames: list[NativeFrame], pages: list[Image.Image]) -> bytes:
    page_imports = "\n".join(
        f"import page{index} from '../../assets/game/{PAGE_PREFIX}-{index}.png'"
        for index in range(len(pages))
    )
    page_values = ", ".join(f"page{index}" for index in range(len(pages)))
    rows = [
        f"  [{json.dumps(source_key(frame))}, "
        f"[{frame.page},{frame.x},{frame.y},{frame.width},{frame.height},"
        f"{frame.width},{frame.height},0,0]]"
        for frame in frames
    ]
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

export const BONEYARD_COMBAT_ATLAS_SOURCES = [{page_values}] as const
export const BONEYARD_COMBAT_ATLAS_FRAMES: ReadonlyMap<string, BoneyardCombatPackedFrame> = new Map([
{',\n'.join(rows)}
])
"""
    return source.encode("utf-8")


def write_or_check(path: Path, expected: bytes, check: bool) -> None:
    if check:
        if not path.is_file() or path.read_bytes() != expected:
            raise SystemExit(f"generated native Boneyard atlas is stale: {path}")
        return
    path.write_bytes(expected)


def verify_native_page_asset(
    path: Path,
    expected_page: Image.Image,
    page_index: int,
    frames: list[NativeFrame],
) -> None:
    if not path.is_file():
        raise SystemExit(f"pinned native Boneyard atlas page is absent: {path}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != EXPECTED_PAGE_SHA256[page_index]:
        raise SystemExit(f"pinned native Boneyard atlas page hash drifted: {path}")
    with Image.open(path) as source:
        committed = source.convert("RGBA")
    if committed.size != expected_page.size:
        raise SystemExit(f"pinned native Boneyard atlas page geometry drifted: {path}")
    for frame in (frame for frame in frames if frame.page == page_index):
        actual = committed.crop((
            frame.x,
            frame.y,
            frame.x + frame.width,
            frame.y + frame.height,
        ))
        with Image.open(frame.path) as source:
            expected = source.convert("RGBA")
        if actual.tobytes() != expected.tobytes():
            raise SystemExit(
                f"pinned native page record differs: {frame.atlas}:{frame.entry}"
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    game_assets = root / "frontend" / "src" / "assets" / "game"
    module_path = (
        root
        / "frontend"
        / "src"
        / "game"
        / "renderer"
        / "boneyard-combat-atlas.generated.ts"
    )
    frames, pages = build_native_pages(root)
    if len(frames) != EXPECTED_SOURCE_COUNT:
        raise SystemExit(
            f"expected {EXPECTED_SOURCE_COUNT} native Boneyard records, found {len(frames)}"
        )
    if len(pages) != EXPECTED_PAGE_COUNT:
        raise SystemExit(
            f"native Boneyard art requires {len(pages)} pages; expected {EXPECTED_PAGE_COUNT}"
        )
    verify_reconstruction(frames, pages)

    expected_page_names = {
        f"{PAGE_PREFIX}-{index}.png" for index in range(len(pages))
    }
    existing_page_names = {
        path.name for path in game_assets.glob(f"{PAGE_PREFIX}-*.png")
    }
    if existing_page_names != expected_page_names:
        raise SystemExit("pinned native Boneyard atlas page membership is stale")

    for index, page in enumerate(pages):
        verify_native_page_asset(
            game_assets / f"{PAGE_PREFIX}-{index}.png",
            page,
            index,
            frames,
        )
    write_or_check(module_path, generated_module(frames, pages), args.check)
    print(
        f"Reconstructed {len(frames)} native Boneyard records on "
        f"{len(pages)} original-layout pages."
    )


if __name__ == "__main__":
    main()
