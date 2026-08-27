#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CANONICAL_SUITE = "./scripts/validate.sh"
CANONICAL_LINT = f"{CANONICAL_SUITE} lint"
DIRECT_LINT = re.compile(
    r"\bdotnet(?:\.exe)?(?:\s+\S+)*\s+format\b|"
    r"\bnpm(?:\s+\S+)*\s+run\s+lint\b|"
    r"\bnpx\s+oxlint\b"
)


class ValidationContractTests(unittest.TestCase):
    def test_browser_save_versions_match_across_frontend_and_backend(self) -> None:
        frontend = (ROOT / "frontend/src/game/save/game-save-contract.ts").read_text()
        backend = (ROOT / "backend/Services/WebGameSaveInspector.cs").read_text()

        frontend_current = int(
            re.search(r"WEB_GAME_SAVE_SCHEMA_VERSION = (\d+)", frontend).group(1)
        )
        backend_current = int(
            re.search(r"FormatVersion = (\d+)", backend).group(1)
        )
        frontend_legacy = [
            int(value)
            for value in re.findall(
                r"\d+",
                re.search(
                    r"LEGACY_WEB_GAME_SAVE_SCHEMA_VERSIONS = \[([^]]+)\]",
                    frontend,
                ).group(1),
            )
        ]
        backend_legacy = [
            int(value)
            for value in re.findall(
                r"\d+",
                re.search(
                    r"LegacyFormatVersions = \[([^]]+)\]",
                    backend,
                ).group(1),
            )
        ]

        self.assertEqual(backend_current, frontend_current)
        self.assertEqual(backend_legacy, frontend_legacy)

    def test_validation_toolchain_is_pinned(self) -> None:
        global_json = json.loads((ROOT / "global.json").read_text())
        self.assertEqual(
            global_json["sdk"],
            {
                "version": "10.0.302",
                "rollForward": "disable",
                "allowPrerelease": False,
            },
        )
        self.assertEqual((ROOT / ".node-version").read_text().strip(), "22.17.0")

        package = json.loads((ROOT / "frontend/package.json").read_text())
        self.assertEqual(package["packageManager"], "npm@10.9.2")
        self.assertEqual(
            package["engines"],
            {"node": "22.17.0", "npm": "10.9.2"},
        )
        self.assertEqual(package["devDependencies"]["oxlint"], "1.74.0")

        lock = json.loads((ROOT / "frontend/package-lock.json").read_text())
        self.assertEqual(
            lock["packages"][""]["devDependencies"]["oxlint"],
            "1.74.0",
        )
        self.assertEqual(
            lock["packages"]["node_modules/oxlint"]["version"],
            "1.74.0",
        )

    def test_complete_suite_keeps_the_strict_lint_gate(self) -> None:
        script = (ROOT / "scripts/validate.sh").read_text()
        required_commands = [
            '"$dotnet_command" build backend/Server.csproj',
            "python3 -m unittest discover -s tests -p 'test_*.py' -v",
            '"$dotnet_command" format backend/Server.csproj',
            "--verify-no-changes",
            "npm --prefix frontend run lint",
            "npm --prefix frontend run test:web-lua",
            "npm --prefix frontend run test:boneyard",
            "npm --prefix frontend run test:desktop",
            "npm --prefix frontend run build",
            "node frontend/tools/check-production-media-policy.mjs",
        ]
        for command in required_commands:
            with self.subTest(command=command):
                self.assertIn(command, script)

        self.assertRegex(
            script,
            re.compile(
                r"run_all\(\).*?"
                r'build backend/Server\.csproj.*?'
                r"unittest discover.*?"
                r"run_lint.*?"
                r"run test:boneyard.*?"
                r"run test:desktop.*?"
                r"run build.*?"
                r"check-production-media-policy\.mjs",
                re.DOTALL,
            ),
        )
        self.assertRegex(
            script,
            re.compile(r"lint\)\s+install_dependencies\s+run_lint"),
        )

    def test_noncanonical_lint_commands_are_recognized(self) -> None:
        commands = [
            "dotnet format backend/Server.csproj",
            "dotnet.exe format backend/Server.csproj",
            "npm run lint",
            "npm --prefix frontend run lint",
            "npx oxlint",
        ]
        for command in commands:
            with self.subTest(command=command):
                self.assertRegex(command, DIRECT_LINT)

    def test_agents_docs_and_ci_use_only_canonical_entrypoints(self) -> None:
        agents = (ROOT / "AGENTS.md").read_text()
        readme = (ROOT / "README.md").read_text()
        workflow = (ROOT / ".github/workflows/validate.yml").read_text()

        self.assertIn(CANONICAL_SUITE, agents)
        self.assertIn(CANONICAL_LINT, agents)
        self.assertIn(CANONICAL_SUITE, readme)
        self.assertIn(CANONICAL_LINT, readme)
        self.assertIn(f"run: {CANONICAL_SUITE}", workflow)

        routed_files = [
            ROOT / "AGENTS.md",
            ROOT / "README.md",
            *sorted((ROOT / ".github/workflows").glob("*")),
            *[
                path
                for path in sorted((ROOT / "scripts").glob("*.sh"))
                if path.name != "validate.sh"
            ],
        ]
        for path in routed_files:
            with self.subTest(path=path.relative_to(ROOT)):
                self.assertIsNone(
                    DIRECT_LINT.search(path.read_text()),
                    f"{path.relative_to(ROOT)} bypasses {CANONICAL_LINT}",
                )

    def test_main_deployment_owns_browser_game_caddy_routes(self) -> None:
        caddy = (ROOT / "ops/nfo/solomon-dark-revived.caddy").read_text()
        shared_hub = caddy.index("handle /game-hub")
        private_sessions = caddy.index("handle /game-sessions/*")
        website_fallback = caddy.index("\n\thandle {", private_sessions)
        self.assertLess(shared_hub, private_sessions)
        self.assertLess(private_sessions, website_fallback)

        deploy = (ROOT / "ops/local-ci/deploy-main.sh").read_text()
        required_ownership = [
            "ops/nfo/solomon-dark-revived.caddy",
            "Deploy/solomon-dark-revived.caddy",
            "remote_caddy_checksum",
            "target_caddy_checksum",
            'caddy validate --config "$caddy_candidate" --adapter caddyfile',
            'install_caddy_config',
            'restore_caddy_config',
            "systemctl reload caddy.service",
        ]
        for member in required_ownership:
            with self.subTest(member=member):
                self.assertIn(member, deploy)

        self.assertIn("/admin/deployments/restart", deploy)
        self.assertIn('wwwroot/deployment.json', deploy)
        self.assertNotIn("deployment deferred because $sessions game session(s) are active", deploy)

        program = (ROOT / "backend/Program.cs").read_text()
        self.assertIn('"deployment.json"', program)
        self.assertIn('Headers.CacheControl = "no-store"', program)

    def test_main_deployment_owns_selected_ml_checkpoint_cutover(self) -> None:
        deploy = (ROOT / "ops/local-ci/deploy-main.sh").read_text()
        selected = "ml-bot-policy-v7-selected.sdml"
        self.assertGreaterEqual(deploy.count(selected), 3)
        self.assertNotIn("ml-bot-policy-v5-selected.sdml", deploy)
        self.assertIn("install_game_checkpoint_path", deploy)
        self.assertIn("restore_game_checkpoint_path", deploy)

        release_swap = deploy.rindex('mv -- "$stage" "$live"')
        checkpoint_cutover = deploy.rindex("\ninstall_game_checkpoint_path\n")
        services_start = deploy.rindex(
            "systemctl start solomon-dark-game.service solomon-dark-revived.service"
        )
        self.assertLess(release_swap, checkpoint_cutover)
        self.assertLess(checkpoint_cutover, services_start)

        rollback = deploy[
            deploy.index("rollback_release() {") : deploy.index("trap cleanup_upload EXIT")
        ]
        self.assertLess(
            rollback.index("restore_game_checkpoint_path"),
            rollback.index(
                "systemctl start solomon-dark-game.service solomon-dark-revived.service"
            ),
        )

        nfo_readme = (ROOT / "ops/nfo/README.md").read_text()
        self.assertIn(
            "SDR_GAME_ML_BOT_CHECKPOINT=/opt/solomon-dark-revived/"
            "GameHost/ml-bot-policy-v7-selected.sdml",
            nfo_readme,
        )
        self.assertNotIn("SDR_GAME_REVISION", nfo_readme)
        self.assertNotIn("SDR_GAME_REVISION", deploy)
        self.assertNotIn("ml-bot-policy-v5-selected.sdml", nfo_readme)

    def test_main_deployment_owns_game_systemd_unit(self) -> None:
        deploy = (ROOT / "ops/local-ci/deploy-main.sh").read_text()
        unit = (ROOT / "ops/nfo/solomon-dark-game.service").read_text()

        self.assertIn(
            "Environment=SDR_GAME_MEMORIAL_PATH=/var/lib/solomon-dark-game/"
            "memoratorium.json",
            unit,
        )
        self.assertIn("StateDirectory=solomon-dark-game", unit)
        self.assertIn("ops/nfo/solomon-dark-game.service", deploy)
        self.assertGreaterEqual(deploy.count("Deploy/solomon-dark-game.service"), 3)
        self.assertIn("target_game_unit_checksum", deploy)
        self.assertIn("remote_game_unit_checksum", deploy)
        self.assertIn("install_game_unit", deploy)
        self.assertIn("restore_game_unit", deploy)
        self.assertIn("systemctl daemon-reload", deploy)

        release_swap = deploy.rindex('mv -- "$stage" "$live"')
        unit_cutover = deploy.rindex("\ninstall_game_unit\n")
        services_start = deploy.rindex(
            "systemctl start solomon-dark-game.service solomon-dark-revived.service"
        )
        self.assertLess(release_swap, unit_cutover)
        self.assertLess(unit_cutover, services_start)

        rollback = deploy[
            deploy.index("rollback_release() {") : deploy.index("trap cleanup_upload EXIT")
        ]
        self.assertLess(
            rollback.index("restore_game_unit"),
            rollback.index(
                "systemctl start solomon-dark-game.service solomon-dark-revived.service"
            ),
        )

    def test_main_deployment_self_updates_and_suppresses_failed_candidates(self) -> None:
        deploy = (ROOT / "ops/local-ci/deploy-main.sh").read_text()
        install = (ROOT / "ops/local-ci/install.sh").read_text()
        supervisor = (
            ROOT / "frontend/src/game/host/run-game-session-supervisor.ts"
        ).read_text()

        self.assertIn("Deploy/solomon-dark-main-deploy", deploy)
        self.assertIn("install_validated_worker", deploy)
        self.assertIn("discard_artifact", deploy)
        self.assertNotRegex(
            deploy,
            r'unlink -- "\$artifact"\s+"\$checksum_file"',
        )
        self.assertIn("Automatic deployment is suppressed", deploy)
        self.assertIn("record_failed_target", deploy)
        self.assertIn("report_candidate_failure", deploy)
        self.assertIn("journalctl -u solomon-dark-game.service", deploy)
        self.assertIn("failed-target", install)
        self.assertIn("readDeployedRevision", supervisor)
        self.assertNotIn("SDR_GAME_REVISION", supervisor)

        bash = shutil.which("bash")
        if bash is None:
            self.fail("bash is required to validate deployment scripts")
        for script in (
            ROOT / "ops/local-ci/deploy-main.sh",
            ROOT / "ops/local-ci/install.sh",
        ):
            with self.subTest(script=script.name):
                subprocess.run([bash, "-n", script], check=True)


if __name__ == "__main__":
    unittest.main()
