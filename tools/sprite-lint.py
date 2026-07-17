#!/usr/bin/env python3
"""Report mechanical crop-quality findings for extracted game sprites."""

from collections import deque
from fnmatch import fnmatch
from math import hypot
from pathlib import Path
import sys

from PIL import Image


# These sprites bleed to an edge or tile by design; anim-* also skips margins.
CLIPPED_EDGE_EXCEPTION_PATTERNS = (
    "grass-strip.png",
    "fog-1.png",
    "fog-2.png",
    "clouds-blue.png",
    "clouds-purple.png",
    "anim-*.png",
)

OPAQUE_ALPHA = 25
HARD_ALPHA = 128
MAX_ISLAND_AREA = 8
MIN_ISLAND_DISTANCE = 6
MAX_MARGIN = 12


def connected_components(mask, alpha, width, height):
    """Return area, inclusive bbox, and peak alpha for each 8-connected component."""
    components = []

    for start in range(width * height):
        if not mask[start]:
            continue

        mask[start] = 0
        queue = deque([start])
        area = 0
        peak_alpha = 0
        x0 = x1 = start % width
        y0 = y1 = start // width

        while queue:
            pixel = queue.popleft()
            x = pixel % width
            y = pixel // width
            area += 1
            peak_alpha = max(peak_alpha, alpha[pixel])
            x0 = min(x0, x)
            y0 = min(y0, y)
            x1 = max(x1, x)
            y1 = max(y1, y)

            for neighbor_y in range(max(0, y - 1), min(height, y + 2)):
                row = neighbor_y * width
                for neighbor_x in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = row + neighbor_x
                    if mask[neighbor]:
                        mask[neighbor] = 0
                        queue.append(neighbor)

        components.append((area, (x0, y0, x1, y1), peak_alpha))

    return components


def bbox_distance(first, second):
    """Return the shortest distance between two inclusive pixel bboxes."""
    dx = max(first[0] - second[2], second[0] - first[2], 0)
    dy = max(first[1] - second[3], second[1] - first[3], 0)
    return hypot(dx, dy)


def bboxes_disjoint(first, second):
    return (
        first[2] < second[0]
        or first[0] > second[2]
        or first[3] < second[1]
        or first[1] > second[3]
    )


def format_bbox(bbox):
    return f"({bbox[0]},{bbox[1]})-({bbox[2]},{bbox[3]})"


def inspect_sprite(path):
    with Image.open(path) as image:
        alpha_image = image.convert("RGBA").getchannel("A")
        width, height = alpha_image.size
        alpha = alpha_image.tobytes()
        nontransparent_bbox = alpha_image.getbbox()

    findings = []
    opaque_components = connected_components(
        bytearray(value > OPAQUE_ALPHA for value in alpha), alpha, width, height
    )
    main_bbox = None

    if opaque_components:
        _, main_bbox, _ = max(
            opaque_components, key=lambda component: component[0]
        )
        for area, bbox, _ in opaque_components:
            distance = bbox_distance(bbox, main_bbox)
            if area <= MAX_ISLAND_AREA and distance > MIN_ISLAND_DISTANCE:
                findings.append(
                    "stray-island "
                    f"area={area}px bbox={format_bbox(bbox)} "
                    f"distance={distance:.1f}px"
                )

    is_animation = fnmatch(path.name, "anim-*.png")
    skip_clipped_edge = any(
        fnmatch(path.name, pattern) for pattern in CLIPPED_EDGE_EXCEPTION_PATTERNS
    )
    if not skip_clipped_edge:
        edges = (
            ("top", sum(alpha[x] > HARD_ALPHA for x in range(width))),
            (
                "right",
                sum(alpha[y * width + width - 1] > HARD_ALPHA for y in range(height)),
            ),
            (
                "bottom",
                sum(
                    alpha[(height - 1) * width + x] > HARD_ALPHA
                    for x in range(width)
                ),
            ),
            ("left", sum(alpha[y * width] > HARD_ALPHA for y in range(height))),
        )
        for edge, count in edges:
            if count:
                findings.append(f"clipped-edge edge={edge} count={count}")

    if nontransparent_bbox is not None and not is_animation:
        x0, y0, x1, y1 = nontransparent_bbox
        margins = (
            ("top", y0),
            ("right", width - x1),
            ("bottom", height - y1),
            ("left", x0),
        )
        for edge, margin in margins:
            if margin > MAX_MARGIN:
                findings.append(f"excess-margin edge={edge} margin={margin}px")

    if main_bbox is not None:
        ghost_components = connected_components(
            bytearray(value > 0 for value in alpha), alpha, width, height
        )
        for area, bbox, peak_alpha in ghost_components:
            if peak_alpha <= OPAQUE_ALPHA and bboxes_disjoint(bbox, main_bbox):
                findings.append(
                    "near-invisible-ghost-pixels "
                    f"area={area}px bbox={format_bbox(bbox)}"
                )

    return findings


def main(argv):
    if len(argv) > 1:
        print("usage: sprite-lint.py [sprite-directory]")
        return

    default_directory = (
        Path(__file__).resolve().parent.parent / "frontend/src/assets/game"
    )
    sprite_directory = Path(argv[0]) if argv else default_directory
    paths = sorted(sprite_directory.glob("*.png"), key=lambda path: path.name)

    finding_count = 0
    files_with_findings = 0
    for path in paths:
        findings = inspect_sprite(path)
        if findings:
            files_with_findings += 1
            finding_count += len(findings)
            for finding in findings:
                print(f"{path.name} {finding}")

    clean_count = len(paths) - files_with_findings
    print(
        f"{len(paths)} files scanned, {clean_count} files clean, "
        f"{finding_count} findings in {files_with_findings} files"
    )


if __name__ == "__main__":
    main(sys.argv[1:])
