#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "frontend/public/samples/story0.boneyard"


class BoneyardViewerContractTests(unittest.TestCase):
    def test_fullscreen_route_and_production_sample_are_wired(self) -> None:
        main = (ROOT / "frontend/src/main.tsx").read_text(encoding="utf-8")
        backend = (ROOT / "backend/Program.cs").read_text(encoding="utf-8")

        self.assertIn("path: '/boneyards'", main)
        self.assertIn("import('./pages/BoneyardViewer')", main)
        self.assertIn(
            'frontendContentTypes.Mappings[".boneyard"] = "application/octet-stream";',
            backend,
        )
        self.assertEqual(SAMPLE.stat().st_size, 40_565)
        self.assertEqual(
            hashlib.sha256(SAMPLE.read_bytes()).hexdigest(),
            "d596b4915140f5faa23fd1286e3d622c6189ecb00b9667f5e7b3444a84b8322b",
        )

if __name__ == "__main__":
    unittest.main()
