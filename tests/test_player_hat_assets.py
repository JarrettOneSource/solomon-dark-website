from pathlib import Path
import sys
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from native_bundle_art import SpriteRecord
from player_attachment_art import build_player_hat_style_sheet


class PlayerHatAssetTests(unittest.TestCase):
    def test_exporter_uses_the_native_hat_banks_for_every_style_and_heading(self):
        # Clothes builder 0x004E6187..0x004E6297 aliases the first three
        # secondary arrays; the fourth is the hood, not an attachment bank.
        native_bases = ((316, 412), (340, 412), (364, 412), (388, 436))
        atlas = Image.new("RGBA", (508, 1))
        records = []
        for index in range(508):
            atlas.putpixel((index, 0), (index >> 8, index & 255, 255, 255))
            records.append(SpriteRecord(
                x=index, y=0, width=1, height=1,
                logical_width=170, logical_height=170,
                center_x=0, center_y=0, points=(), end=0,
            ))
        failures = []
        for selector, bases in enumerate(native_bases):
            for secondary, base in zip((False, True), bases):
                sheet = build_player_hat_style_sheet(atlas, records, selector, secondary)
                self.assertEqual(sheet.size, (170, 4080))
                for heading in range(24):
                    record = base + heading
                    expected = Image.new("RGBA", (170, 170))
                    expected.putpixel((84, 84), (record >> 8, record & 255, 255, 255))
                    actual = sheet.crop((0, heading * 170, 170, (heading + 1) * 170))
                    if actual.tobytes() != expected.tobytes():
                        failures.append((selector, secondary, heading, record))
        self.assertEqual(failures, [])

    def test_living_hat_pixels_match_the_native_layers_also_used_by_death(self):
        # Ordinary death retains the same 24-facing Hat layers. Those sheets
        # were independently extracted from the native mapping before this bug.
        assets = ROOT / "frontend/src/assets/game"
        failures = []
        for selector in range(4):
            for layer in ("primary", "secondary"):
                with Image.open(assets / f"player-character-hat-{selector}-{layer}.png") as source:
                    actual = source.convert("RGBA")
                with Image.open(assets / f"player-character-death-hat-{layer}-{selector}.png") as source:
                    expected = source.convert("RGBA")
                self.assertEqual(actual.size, expected.size)
                for heading in range(24):
                    box = (0, heading * 170, 170, (heading + 1) * 170)
                    if actual.crop(box).tobytes() != expected.crop(box).tobytes():
                        failures.append((selector, layer, heading))
        self.assertEqual(failures, [])


if __name__ == "__main__":
    unittest.main()
