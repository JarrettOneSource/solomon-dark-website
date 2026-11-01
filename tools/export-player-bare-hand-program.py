#!/usr/bin/env python3
"""Export PlayerWizard's selected bare-hand effect sockets and depth rows."""

import hashlib
import json
import sys
from pathlib import Path

from native_bundle_art import parse_bundle


EXPECTED_SHA256 = "69595c233b6dd61d2273bf60d13e0e2bf7f2dde5db8036ee8fd86e9aae30624b"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: export-player-bare-hand-program.py <Clothes.bundle>")
    source = Path(sys.argv[1])
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError(f"Clothes.bundle SHA-256 {digest} != {EXPECTED_SHA256}")
    records = parse_bundle(source)
    reference = records[316].points[0][1] + 15
    rows = []
    for pose in range(4):
        frames = []
        for heading in range(24):
            first = records[484 + 24 * pose + heading]
            second = records[676 + 24 * pose + heading]
            frames.append([
                *first.points[1],
                max(first.points[0][1], second.points[0][1]),
            ])
        rows.append(frames)
    program = {
        "sourceSha256": digest,
        "firstBankRecord": 484,
        "secondBankRecord": 676,
        "referenceRecord": 316,
        "referenceDepth": reference,
        "rowFields": ["point1X", "point1Y", "maximumPoint0Y"],
        "poses": rows,
    }
    output = Path(__file__).resolve().parents[1] / "frontend/src/assets/game/player-bare-hand-program.json"
    output.write_text(json.dumps(program, indent=2) + "\n")
    print(f"{output}: {len(rows) * len(rows[0])} authored socket/depth rows")


if __name__ == "__main__":
    main()
