#!/usr/bin/env python3
"""Extracts registered animation frame strips from the game's sprite bundles.

The .bundle files beside each atlas are packed records (45 bytes + optional
8-byte extras) of: atlas rect (4×f32), logical cell size (2×i32), the rect
echoed (2×f32), and the sprite's offset within its cell (2×f32). Animation
Most animation banks store 18 headings per pose consecutively, so their
fixed-heading cycles use every 18th record; exceptions are noted below. Frames
are composed back onto their logical cells (perfect registration), cropped to
their shared bounding box, scaled, and appended into a horizontal strip for
CSS steps() animation.

Usage: extract-anims.py <path-to-game-images-dir>
"""
import os
import struct
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: extract-anims.py <path-to-game-images-dir>")

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "frontend", "src", "assets", "game")
TMP = "/tmp/sdr-anim"
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


def strip(atlas, recs, indices, name, height, extra_rotate=None):
    """Compose each frame on its cell, crop all by the union bbox, scale to
    `height`, append into OUT/<name>.png. Prints frame geometry for the TS side."""
    frames = [recs[i] for i in indices]
    # union bbox of the placed rects across frames, in cell coordinates
    x0 = min(f["cw"] / 2 + f["ox"] - f["w"] / 2 for f in frames)
    y0 = min(f["ch"] / 2 + f["oy"] - f["h"] / 2 for f in frames)
    x1 = max(f["cw"] / 2 + f["ox"] + f["w"] / 2 for f in frames)
    y1 = max(f["ch"] / 2 + f["oy"] + f["h"] / 2 for f in frames)
    x0, y0 = int(x0) - 1, int(y0) - 1
    bw, bh = int(x1 - x0) + 2, int(y1 - y0) + 2
    tiles = []
    for k, f in enumerate(frames):
        px = f["cw"] / 2 + f["ox"] - f["w"] / 2
        py = f["ch"] / 2 + f["oy"] - f["h"] / 2
        t = f"{TMP}/{name}-{k}.png"
        args = [f"{SRC}/{atlas}.png",
                "-crop", f"{f['w']}x{f['h']}+{f['x']}+{f['y']}", "+repage",
                "-background", "none",
                "-extent", f"{f['cw']}x{f['ch']}-{int(px)}-{int(py)}",
                "-crop", f"{bw}x{bh}+{x0}+{y0}", "+repage"]
        if extra_rotate:
            args += ["-rotate", str(extra_rotate), "-background", "none"]
        args += ["-resize", f"x{height}", t]
        magick(*args)
        tiles.append(t)
    out = os.path.join(OUT, f"{name}.png")
    magick(*tiles, "+append", out)
    res = subprocess.run(["magick", "identify", "-format", "%wx%h", out],
                         capture_output=True, text=True, check=True)
    tw, th = res.stdout.split("x")
    print(f"{name}: {len(frames)} frames, {int(tw)//len(frames)}x{th} each")


def single(atlas, recs, index, name):
    """Crop and trim one bundle record without inventing animation frames."""
    frame = recs[index]
    out = os.path.join(OUT, f"{name}.png")
    magick(f"{SRC}/{atlas}.png",
           "-crop", f"{frame['w']}x{frame['h']}+{frame['x']}+{frame['y']}",
           "+repage", "-trim", "+repage", out)
    res = subprocess.run(["magick", "identify", "-format", "%wx%h", out],
                         capture_output=True, text=True, check=True)
    print(f"{name}: single, {res.stdout}")


solomon = parse_bundle(f"{SRC}/Solomon.bundle")

# Solomon's movement bank (records 95-184) is the exception to the usual
# 18-heading layout: six poses x 15 headings. Heading 4 faces right, with a
# clean side-on robe and staff silhouette. Record 24 is the matching idle pose.
strip("Solomon", solomon, range(99, 175, 15), "anim-solomon-walk", 64)
strip("Solomon", solomon, [24], "solomon-stand", 64)

badguys = parse_bundle(f"{SRC}/BadGuys.bundle")

# The long-tailed fireball is one standalone record. Its atlas neighbors are
# unrelated sprites; the separate records 255-266 are an upright flame loop,
# not extra projectile frames.
single("BadGuys", badguys, 50, "anim-fireball")

# Spell projectiles suitable for ambient flybys: two real registered cycles
# plus two single-frame directional bolts.
strip("BadGuys", badguys, range(246, 251), "anim-spell-ether-wisp", 64)
strip("BadGuys", badguys, range(271, 283), "anim-spell-cyan-orb", 36)
single("BadGuys", badguys, 22, "fx-spell-purple-bolt")
single("BadGuys", badguys, 31, "fx-spell-frost-lance")

# The boneyard crawler — a skeleton dragging itself by its arms. Bank g168
# (records 1117-1332): 12 crawl poses x 18 headings. Heading 9 faces up-screen;
# rotating 90° makes it crawl rightward (baked lighting skew is invisible at
# this size). The page mirrors it with scaleX(-1) for leftward strolls.
strip("BadGuys", badguys, range(1126, 1333, 18), "anim-crawler", 64,
      extra_rotate=90)

# Flying spellbooks from the library stacks (records 122-157): 18-frame
# tumbling rotations, one blue tome, one red.
strip("BadGuys", badguys, range(122, 140), "anim-tome-blue", 44)
strip("BadGuys", badguys, range(140, 158), "anim-tome-red", 44)
