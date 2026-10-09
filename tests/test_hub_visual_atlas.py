from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
PACKER_PATH = ROOT / "tools/pack-hub-visual-atlas.py"
SPEC = spec_from_file_location("hub_visual_atlas_packer", PACKER_PATH)
PACKER = module_from_spec(SPEC)
sys.modules[SPEC.name] = PACKER
SPEC.loader.exec_module(PACKER)


class HubVisualAtlasTests(unittest.TestCase):
    def test_source_selection_keeps_native_ground_auxiliaries_loose(self):
        included = ("hub-tent-back.png", "hub-room-library-props.png")
        excluded = (
            "hub-hagatha-ground-glow.png",
            "hub-luthacus-ground-shadow.png",
            "hub-hud-font.png",
            "hub-primary-fire.png",
            "hub-trader-inventory-atlas.png",
            "hub-visual-atlas-0.png",
            "unrelated.png",
        )
        with tempfile.TemporaryDirectory(prefix="sdr-hub-atlas-sources-") as directory:
            assets = Path(directory)
            for name in (*included, *excluded):
                (assets / name).touch()
            self.assertEqual(
                [path.name for path in PACKER.source_paths(assets)],
                sorted(included),
            )

    def test_new_unclassified_source_remains_visible_to_the_census(self):
        with tempfile.TemporaryDirectory(prefix="sdr-hub-atlas-new-source-") as directory:
            assets = Path(directory)
            (assets / "hub-new-authored-source.png").touch()
            self.assertEqual(
                [path.name for path in PACKER.source_paths(assets)],
                ["hub-new-authored-source.png"],
            )

    def test_selected_sources_match_the_existing_runtime_membership(self):
        generated = (ROOT / "frontend/src/game/renderer/hub-visual-atlas.generated.ts")
        members = re.findall(
            r"^import source\d+ from '../../assets/game/([^']+)'$",
            generated.read_text(encoding="utf-8"),
            re.MULTILINE,
        )
        selected = PACKER.source_paths(ROOT / "frontend/src/assets/game")
        self.assertEqual(len(members), 87)
        self.assertEqual(PACKER.EXPECTED_SOURCE_COUNT, 87)
        self.assertEqual([path.name for path in selected], members)

    def test_committed_atlas_pixels_and_metadata_are_current(self):
        result = subprocess.run(
            [sys.executable, str(PACKER_PATH), "--check"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(
            "Packed 582 Hub frames from 87 sources into 3 bounded pages.",
            result.stdout,
        )


if __name__ == "__main__":
    unittest.main()
