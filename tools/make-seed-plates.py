#!/usr/bin/env python3
"""Compose seed 'screenshots' (plates) for the Library demo from extracted game art.

The seed mods need gallery images, but no real gameplay captures exist yet, so
this bakes screenshot-shaped scenes — sky, moon, fog, graves, spell fx — from
the same atlases the site chrome uses (frontend/src/assets/game).

Output: backend/seed-assets/plates/<slug>-<n>.png, consumed by SeedData.
Deterministic per scene; safe to re-run.
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "frontend" / "src" / "assets" / "game"
OUT = ROOT / "backend" / "seed-assets" / "plates"

W, H = 1280, 720
GROUND_Y = 600  # top of the playfield's ground band


def art_img(name: str) -> Image.Image:
    return Image.open(ART / name).convert("RGBA")


def frame(name: str, count: int, index: int) -> Image.Image:
    """Crop one frame out of a horizontal animation strip."""
    strip = art_img(name)
    fw = strip.width // count
    return strip.crop((index * fw, 0, (index + 1) * fw, strip.height))


def scaled(im: Image.Image, factor: float) -> Image.Image:
    return im.resize((round(im.width * factor), round(im.height * factor)), Image.NEAREST)


def tinted(im: Image.Image, alpha: float) -> Image.Image:
    out = im.copy()
    out.putalpha(out.getchannel("A").point(lambda v: int(v * alpha)))
    return out


def feathered(im: Image.Image, margin: int) -> Image.Image:
    """Fade a sprite's rectangular edges to transparent (fog/cloud sheets)."""
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rectangle((margin, margin, im.width - margin, im.height - margin), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(margin / 1.5))
    out = im.copy()
    out.putalpha(ImageChops.multiply(im.getchannel("A"), mask))
    return out


class Scene:
    def __init__(self, seed: int, sky_top=(13, 10, 20), sky_bottom=(26, 21, 34)):
        self.rng = random.Random(seed)
        self.canvas = Image.new("RGBA", (W, H))
        top, bottom = sky_top, sky_bottom
        for y in range(H):
            t = y / H
            row = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
            self.canvas.paste((*row, 255), (0, y, W, y + 1))

    def paste(self, im: Image.Image, x: int, y: int):
        """Paste with alpha; (x, y) is the sprite's bottom-center anchor."""
        self.canvas.alpha_composite(im, (x - im.width // 2, y - im.height))

    def glow(self, x: int, y: int, radius: int, color, peak=90):
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, peak))
        self.canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius / 2)))

    def ground(self):
        draw = ImageDraw.Draw(self.canvas)
        draw.rectangle((0, GROUND_Y, W, H), fill=(12, 10, 16, 255))
        grass = scaled(art_img("grass-strip.png"), 1.6)
        for x in range(0, W, grass.width):
            self.canvas.alpha_composite(grass, (x, GROUND_Y - grass.height // 3))

    def moon(self, x=1080, y=130, factor=1.2):
        moon = scaled(art_img("moon.png"), factor)
        self.glow(x, y, round(120 * factor), (220, 215, 190), peak=60)
        self.canvas.alpha_composite(moon, (x - moon.width // 2, y - moon.height // 2))

    def clouds(self, name="clouds-purple.png", n=3, alpha=0.5):
        cloud = feathered(scaled(art_img(name), 2.0), 70)
        for _ in range(n):
            x = self.rng.randint(-200, W - 200)
            y = self.rng.randint(-60, 160)
            self.canvas.alpha_composite(tinted(cloud, alpha), (x, y))

    def fog(self, alpha=0.4, y=GROUND_Y - 260):
        sheet = feathered(art_img("fog-1.png" if self.rng.random() < 0.5 else "fog-2.png"), 150)
        self.canvas.alpha_composite(tinted(sheet, alpha), (self.rng.randint(-260, 0), y))

    def rain(self, n=340):
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        for _ in range(n):
            x = self.rng.randint(-60, W)
            y = self.rng.randint(-20, H)
            length = self.rng.randint(14, 30)
            draw.line((x, y, x + length // 3, y + length), fill=(150, 168, 190, self.rng.randint(28, 66)), width=1)
        self.canvas.alpha_composite(layer)

    def vignette(self, strength=0.6):
        mask = Image.radial_gradient("L").resize((W, H)).point(lambda v: int(v * strength))
        black = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        black.putalpha(mask)
        self.canvas.alpha_composite(black)

    def save(self, name: str):
        OUT.mkdir(parents=True, exist_ok=True)
        path = OUT / name
        self.canvas.convert("RGB").save(path, "PNG", optimize=True)
        print(f"{path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB")


def graves(scene: Scene, names: list[str], xs: list[int], factor=2.2, alpha=0.95):
    for name, x in zip(names, xs):
        scene.paste(tinted(scaled(art_img(name), factor), alpha), x, GROUND_Y + 22)


def solomon(scene: Scene, x: int, factor=2.6):
    scene.paste(scaled(frame("anim-solomon-walk.png", 6, 0), factor), x, GROUND_Y + 14)


def skeletons(scene: Scene, xs: list[int], factor=2.2):
    """Imp-and-skull rabble standing in for a wave."""
    for x in xs:
        sprite = "fx-imp.png" if scene.rng.random() < 0.6 else "fx-skull-1819.png"
        scene.paste(scaled(art_img(sprite), factor), x, GROUND_Y + 10 + scene.rng.randint(-6, 6))


def plate_prismatic_1():
    s = Scene(11, sky_top=(15, 10, 26), sky_bottom=(30, 20, 44))
    s.moon(x=170, y=120, factor=1.0)
    s.clouds("clouds-purple.png", n=3, alpha=0.45)
    graves(s, ["grave-cross-1.png", "grave-celtic-cross.png"], [180, 1130])
    s.ground()
    circle = scaled(art_img("circle-arcane.png"), 1.9)
    s.glow(640, GROUND_Y - 40, 190, (65, 227, 255), peak=54)
    s.canvas.alpha_composite(tinted(circle, 0.85), (640 - circle.width // 2, GROUND_Y - circle.height + 70))
    solomon(s, 400)
    skeletons(s, [760, 830, 905, 980], factor=2.4)
    for x, y in [(700, 300), (820, 250), (930, 330)]:
        bolt = scaled(art_img("fx-spell-purple-bolt.png"), 2.4)
        s.glow(x, y, 46, (180, 95, 224), peak=70)
        s.paste(bolt, x, y + bolt.height // 2)
    wisp = scaled(art_img("fx-wisp-cyan.png"), 2.2)
    for x, y in [(520, 380), (585, 330), (660, 300)]:
        s.glow(x, y, 30, (65, 227, 255), peak=60)
        s.paste(wisp, x, y)
    s.fog(0.35)
    s.vignette(0.55)
    s.save("prismatic-shock-rework-1.png")


def plate_prismatic_2():
    s = Scene(12, sky_top=(10, 12, 24), sky_bottom=(22, 26, 40))
    s.moon(x=1090, y=110, factor=1.25)
    s.clouds("clouds-blue.png", n=3, alpha=0.5)
    graves(s, ["grave-arch-small.png", "grave-cross-2.png", "grave-rip.png"], [150, 620, 1000])
    s.paste(scaled(art_img("gargoyle.png"), 2.2), 1180, GROUND_Y + 20)
    s.ground()
    burst = scaled(frame("fx-ice-burst.png", 10, 6), 2.6)
    s.glow(560, GROUND_Y - 60, 150, (140, 220, 255), peak=66)
    s.paste(burst, 560, GROUND_Y + 4)
    for x in (430, 510, 610, 690):
        lance = scaled(art_img("fx-spell-frost-lance.png"), 2.6)
        s.paste(lance, x, s.rng.randint(220, 330))
    solomon(s, 260)
    skeletons(s, [700, 780, 860], factor=2.3)
    s.fog(0.45)
    s.vignette(0.58)
    s.save("prismatic-shock-rework-2.png")


def plate_prismatic_3():
    s = Scene(13, sky_top=(18, 10, 18), sky_bottom=(36, 18, 26))
    s.clouds("clouds-purple.png", n=4, alpha=0.4)
    graves(s, ["grave-celtic-swirl.png", "grave-cross-1.png"], [1120, 90])
    s.ground()
    boom = scaled(frame("fx-explosion.png", 4, 2), 3.2)
    s.glow(800, GROUND_Y - 90, 190, (255, 150, 60), peak=88)
    s.paste(boom, 800, GROUND_Y + 6)
    flame = scaled(art_img("fx-flame.png"), 2.6)
    for x in (700, 760, 850, 910):
        s.paste(flame, x, GROUND_Y + 8)
    fireball = scaled(art_img("fx-fireball.png"), 2.0)
    s.paste(fireball.rotate(-35, expand=True), 520, 320)
    solomon(s, 330)
    skeletons(s, [1010, 1075], factor=2.2)
    s.fog(0.3)
    s.vignette(0.6)
    s.save("prismatic-shock-rework-3.png")


def plate_fleetfinger_1():
    s = Scene(21, sky_top=(11, 11, 20), sky_bottom=(24, 24, 38))
    s.moon(x=200, y=140, factor=1.1)
    s.clouds("clouds-blue.png", n=2, alpha=0.45)
    graves(s, ["grave-arch.png", "grave-cross-2.png", "grave-celtic-cross.png"], [980, 420, 180])
    s.paste(scaled(art_img("statue-wizard.png"), 2.3), 1150, GROUND_Y + 20)
    s.ground()
    solomon(s, 560)
    wisp = scaled(art_img("fx-wisp-cyan.png"), 2.0)
    trail = [(640, 420), (700, 380), (770, 355), (845, 345), (920, 350), (990, 372)]
    for i, (x, y) in enumerate(trail):
        s.glow(x, y, 26, (65, 227, 255), peak=52)
        s.paste(tinted(wisp, 0.45 + i * 0.09), x, y)
    arc = scaled(art_img("fx-arc.png"), 2.4)
    s.paste(arc, 1010, 380)
    s.fog(0.4)
    s.vignette(0.55)
    s.save("fleetfinger-1.png")


def plate_fleetfinger_2():
    s = Scene(22, sky_top=(12, 9, 22), sky_bottom=(26, 19, 40))
    s.clouds("clouds-purple.png", n=3, alpha=0.5)
    graves(s, ["grave-rip.png", "grave-cross-1.png"], [220, 1080])
    s.ground()
    bolt = scaled(art_img("fx-bolt.png"), 2.8)
    for x in (760, 900):
        s.paste(bolt, x, GROUND_Y - 30)
        s.paste(bolt, x, GROUND_Y - 30 - bolt.height + 40)
        s.glow(x, GROUND_Y - 30, 60, (65, 227, 255), peak=84)
    spider = scaled(art_img("fx-spider.png"), 2.4)
    s.paste(spider, 660, GROUND_Y + 6)
    solomon(s, 380)
    skeletons(s, [820, 950], factor=2.2)
    s.fog(0.42)
    s.vignette(0.55)
    s.save("fleetfinger-2.png")


def plate_awful_1():
    s = Scene(31, sky_top=(8, 8, 16), sky_bottom=(20, 17, 30))
    s.moon(x=1060, y=110, factor=1.5)
    s.clouds("clouds-blue.png", n=3, alpha=0.5)
    s.paste(tinted(scaled(art_img("obelisk.png"), 2.6), 0.95), 660, GROUND_Y + 24)
    graves(s, ["grave-celtic-cross.png", "grave-cross-1.png", "grave-arch-small.png", "grave-cross-2.png"], [220, 420, 920, 1130], factor=2.0)
    s.ground()
    solomon(s, 130)
    skeletons(s, [800, 860], factor=2.1)
    s.fog(0.5, y=GROUND_Y - 320)
    s.fog(0.35, y=GROUND_Y - 200)
    s.vignette(0.62)
    s.save("mount-awful-endless-1.png")


def plate_awful_2():
    s = Scene(32, sky_top=(9, 7, 15), sky_bottom=(19, 15, 27))
    s.moon(x=210, y=100, factor=1.1)
    s.clouds("clouds-purple.png", n=3, alpha=0.5)
    graves(s, ["grave-arch.png", "grave-celtic-swirl.png", "grave-cross-2.png", "grave-rip.png"], [300, 520, 760, 950], factor=2.3)
    s.paste(tinted(scaled(art_img("statue-wizard.png"), 2.4), 0.95), 140, GROUND_Y + 20)
    s.ground()
    eyes = scaled(art_img("eyes-left.png"), 1.8)
    for x, y in [(640, 470), (835, 455)]:
        s.glow(x, y, 24, (212, 58, 58), peak=64)
        s.paste(eyes, x, y)
    skeletons(s, [1060, 1130], factor=2.4)
    s.fog(0.5)
    s.vignette(0.66)
    s.save("mount-awful-endless-2.png")


def plate_dratmoor_1():
    s = Scene(41, sky_top=(9, 11, 17), sky_bottom=(18, 24, 32))
    s.clouds("clouds-blue.png", n=4, alpha=0.6)
    graves(s, ["grave-cross-1.png", "grave-rip.png", "grave-celtic-cross.png"], [240, 640, 1040], factor=2.2)
    s.ground()
    flame = scaled(art_img("fx-flame.png"), 2.4)
    for x in (180, 1100):
        s.glow(x, GROUND_Y - 60, 44, (255, 170, 80), peak=72)
        s.paste(flame, x, GROUND_Y - 40)
    solomon(s, 480)
    skeletons(s, [760, 840], factor=2.2)
    s.rain()
    s.fog(0.38)
    s.vignette(0.6)
    s.save("dratmoor-after-dark-1.png")


if __name__ == "__main__":
    plate_prismatic_1()
    plate_prismatic_2()
    plate_prismatic_3()
    plate_fleetfinger_1()
    plate_fleetfinger_2()
    plate_awful_1()
    plate_awful_2()
    plate_dratmoor_1()
