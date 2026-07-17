#!/usr/bin/env python3
"""Extracts the School of Magic click-effect sprites from BadGuys.png.

Self-contained sibling of extract-anims.py (same .bundle format — see that
file's docstring): spell effects live here, ambient critters live there.
Frame strips play via CSS steps(); singles are plain trimmed sprites.

Usage: extract-fx.py <path-to-game-images-dir>
"""
import os
import struct
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: extract-fx.py <path-to-game-images-dir>")

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "frontend", "src", "assets", "game")
TMP = "/tmp/sdr-fx"
os.makedirs(TMP, exist_ok=True)


def parse_bundle(path):
    data = open(path, "rb").read()
    n = len(data)

    def plausible(o):
        if o >= n:
            return o == n
        try:
            px, py, pw, ph = struct.unpack_from("<4f", data, o)
            pw2, ph2 = struct.unpack_from("<2f", data, o + 24)
        except struct.error:
            return False
        return (0 <= px < 4096 and 0 <= py < 4096 and 0 < pw <= 2048
                and 0 < ph <= 2048 and px == int(px) and py == int(py)
                and pw == pw2 and ph == ph2)

    recs, off = [], 0
    while off < n:
        x, y, w, h = struct.unpack_from("<4f", data, off)
        cw, ch = struct.unpack_from("<2i", data, off + 16)
        ox, oy = struct.unpack_from("<2f", data, off + 32)
        nxt = off + 45
        while not plausible(nxt):
            nxt += 8
        recs.append(dict(x=int(x), y=int(y), w=int(w), h=int(h),
                         cw=cw, ch=ch, ox=ox, oy=oy))
        off = nxt
    return recs


def magick(*args):
    subprocess.run(["magick", *args], check=True)


def report(name):
    out = os.path.join(OUT, f"{name}.png")
    res = subprocess.run(["magick", "identify", "-format", "%wx%h", out],
                         capture_output=True, text=True, check=True)
    print(f"{name}: {res.stdout}")


def strip(recs, indices, name, height):
    """Registered frame strip, frames composed on their shared cell bbox."""
    frames = [recs[i] for i in indices]
    x0 = min(f["cw"] / 2 + f["ox"] - f["w"] / 2 for f in frames) - 1
    y0 = min(f["ch"] / 2 + f["oy"] - f["h"] / 2 for f in frames) - 1
    x1 = max(f["cw"] / 2 + f["ox"] + f["w"] / 2 for f in frames) + 1
    y1 = max(f["ch"] / 2 + f["oy"] + f["h"] / 2 for f in frames) + 1
    bw, bh = int(x1 - x0), int(y1 - y0)
    tiles = []
    for k, f in enumerate(frames):
        px = f["cw"] / 2 + f["ox"] - f["w"] / 2
        py = f["ch"] / 2 + f["oy"] - f["h"] / 2
        t = f"{TMP}/{name}-{k}.png"
        magick(f"{SRC}/BadGuys.png",
               "-crop", f"{f['w']}x{f['h']}+{f['x']}+{f['y']}", "+repage",
               "-background", "none",
               "-extent", f"{f['cw']}x{f['ch']}-{int(px)}-{int(py)}",
               "-crop", f"{bw}x{bh}+{int(x0)}+{int(y0)}", "+repage",
               "-resize", f"x{height}", t)
        tiles.append(t)
    magick(*tiles, "+append", os.path.join(OUT, f"{name}.png"))
    report(name)


def single(recs, index, name):
    r = recs[index]
    magick(f"{SRC}/BadGuys.png",
           "-crop", f"{r['w']}x{r['h']}+{r['x']}+{r['y']}", "+repage",
           os.path.join(OUT, f"{name}.png"))
    report(name)


recs = parse_bundle(f"{SRC}/BadGuys.bundle")

# fire — the 4-frame fireball burst (records 251-254) over the white
# concussion flash (238-245)
strip(recs, range(251, 255), "fx-explosion", 80)
strip(recs, range(238, 246), "fx-flash", 56)

# air — the tall branched cyan bolt and its short arc sibling
single(recs, 376, "fx-bolt")
single(recs, 375, "fx-arc")

# water — the soft shock ring plus the 10-frame ice-crystal shatter
single(recs, 70, "fx-ice-ring")
strip(recs, range(158, 168), "fx-ice-burst", 104)

# earth — boulders and pebbles for the momentary rubble pile
single(recs, 168, "fx-rock-1")
single(recs, 169, "fx-rock-2")
single(recs, 393, "fx-pebble-1")
single(recs, 396, "fx-pebble-2")
