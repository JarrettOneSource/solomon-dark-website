#!/usr/bin/env python3
from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SteamAppIdContractTests(unittest.TestCase):
    def test_backend_uses_solomon_dark_app_id_for_tickets_and_sessions(self) -> None:
        application = (
            ROOT / "backend/Services/SteamApplication.cs"
        ).read_text(encoding="utf-8")
        verifier = (
            ROOT / "backend/Services/SteamTicketVerifier.cs"
        ).read_text(encoding="utf-8")
        tokens = (
            ROOT / "backend/Services/TokenService.cs"
        ).read_text(encoding="utf-8")

        self.assertIn("public const uint AppId = 3362180;", application)
        self.assertIn('public const string AppIdText = "3362180";', application)
        self.assertIn("appid={SteamApplication.AppId}", verifier)
        self.assertIn("SteamApplication.AppIdText", tokens)

    def test_retired_spacewar_identity_is_absent(self) -> None:
        paths = [ROOT / "README.md", *(ROOT / "backend/Services").glob("*.cs")]
        for path in paths:
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("Spacewar", text, path)
            self.assertNotIn('"480"', text, path)
            self.assertNotIn("AppId = 480", text, path)

    def test_cloud_save_identity_comes_from_the_verified_steam_link(self) -> None:
        steam_auth = (ROOT / "backend/Api/SteamAuthEndpoints.cs").read_text(encoding="utf-8")
        tokens = (ROOT / "backend/Services/TokenService.cs").read_text(encoding="utf-8")
        saves = (ROOT / "backend/Api/SaveEndpoints.cs").read_text(encoding="utf-8")
        program = (ROOT / "backend/Program.cs").read_text(encoding="utf-8")

        self.assertIn("user.SteamId == verification.SteamId", steam_auth)
        self.assertIn("linkedAccount?.Id", steam_auth)
        self.assertIn("sdr_linked_user_id", tokens)
        self.assertIn('AddPolicy("cloud-save"', program)
        self.assertIn('RequireAuthorization("cloud-save")', saves)
        self.assertIn("user.Id == linkedUserId.Value && user.SteamId == steamId", saves)


if __name__ == "__main__":
    unittest.main()
