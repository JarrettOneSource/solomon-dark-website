#!/usr/bin/env python3
from __future__ import annotations

import json
import re
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
            "npm --prefix frontend run test:boneyard",
            "npm --prefix frontend run build",
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
                r"run build",
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


if __name__ == "__main__":
    unittest.main()
