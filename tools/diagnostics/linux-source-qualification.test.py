"""Qualification bookkeeping tests; these do not launch or accept the app."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).with_name("linux-source-qualification.py")
spec = importlib.util.spec_from_file_location("qualification", SCRIPT)
qualification = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qualification)


class QualificationTests(unittest.TestCase):
    def test_separate_evidence_root_is_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            source = root / "product"
            source.mkdir()
            self.assertEqual(qualification.check_paths(source, root / "evidence"),
                             (source.resolve(), (root / "evidence").resolve()))

    def test_evidence_rejects_equality_and_both_ancestor_directions_before_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            source = root / "product"
            source.mkdir()
            for evidence in (source, source / "evidence", root):
                with self.subTest(evidence=evidence), self.assertRaises(ValueError):
                    qualification.check_paths(source, evidence)
            self.assertFalse((source / "evidence").exists())

    def test_evidence_symlink_alias_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            source = root / "product"
            source.mkdir()
            (root / "alias").symlink_to(source, target_is_directory=True)
            with self.assertRaises(ValueError):
                qualification.check_paths(source, root / "alias" / "evidence")

    def test_evidence_cannot_overwrite_qualification_tools(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                qualification.check_paths(pathlib.Path(directory), SCRIPT.parent)

    def test_manifest_accepts_exact_candidate_only(self):
        manifest = dict(schemaVersion=1, revision=qualification.SOURCE,
                        sourceTimestamp=123, platform="linux", arch="x64",
                        executable="solomon-darker", electronVersion="43.4.0",
                        nodeRuntime={"version": "22.17.0", "sha256": qualification.NODE_ARCHIVE_SHA256})
        qualification.check_manifest(manifest, 123)
        for key, value in (("revision", "c20fd89cb98c3a76f0852305252f1a3ba06fd59a"),
                           ("sourceTimestamp", 124), ("platform", "darwin"),
                           ("arch", "arm64"), ("executable", "../elsewhere"),
                           ("electronVersion", "43.4.1")):
            with self.subTest(key=key), self.assertRaises(ValueError):
                qualification.check_manifest({**manifest, key: value}, 123)

    def test_manifest_rejects_changed_runtime(self):
        manifest = dict(schemaVersion=1, revision=qualification.SOURCE,
                        sourceTimestamp=123, platform="linux", arch="x64",
                        executable="solomon-darker", electronVersion="43.4.0",
                        nodeRuntime={"version": "23.0.0", "sha256": "a" * 64})
        with self.assertRaises(ValueError):
            qualification.check_manifest(manifest, 123)

    def test_acceptance_requires_every_original_and_preservation_step(self):
        steps = {name: "success" for name in qualification.REQUIRED_STEPS}
        self.assertTrue(qualification.steps_passed(steps))
        for name in qualification.REQUIRED_STEPS:
            for outcome in ("failure", "skipped", "cancelled", ""):
                with self.subTest(name=name, outcome=outcome):
                    self.assertFalse(qualification.steps_passed({**steps, name: outcome}))
            missing = {key: value for key, value in steps.items() if key != name}
            self.assertFalse(qualification.steps_passed(missing))

    def test_original_smoke_success_requires_exact_revision_and_all_screenshots(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            receipt = {"status": "ok", "platform": "linux", "revision": qualification.SOURCE,
                       "offline": {"bundledHostExited": True, "updateCheckFailedWithoutBlockingPlay": True},
                       "updatePrompt": {"shown": True, "dismissedWithoutRestart": True},
                       "peer": {"sharedBoneyardPlayers": 2}}
            (root / "receipt.json").write_text(json.dumps(receipt))
            for name in qualification.SCREENSHOTS:
                (root / name).write_bytes(b"synthetic-image")
            self.assertEqual(qualification.check_smoke(root), receipt)
            (root / "peer-guest-boneyard.png").unlink()
            with self.assertRaises(ValueError):
                qualification.check_smoke(root)
            (root / "peer-guest-boneyard.png").write_bytes(b"synthetic-image")
            receipt["revision"] = "c20fd89cb98c3a76f0852305252f1a3ba06fd59a"
            (root / "receipt.json").write_text(json.dumps(receipt))
            with self.assertRaises(ValueError):
                qualification.check_smoke(root)

    def test_failure_or_partial_receipt_is_never_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            for receipt in ({}, {"status": "failed"},
                            {"status": "ok", "platform": "linux", "revision": qualification.SOURCE}):
                (root / "receipt.json").write_text(json.dumps(receipt))
                with self.assertRaises(ValueError):
                    qualification.check_smoke(root)

    def test_missing_inventory_roots_cannot_emit_empty_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            for label in ("package", "playwright"):
                with self.subTest(label=label), self.assertRaises(ValueError):
                    qualification.inventory_one(root, root, label, "before")
            self.assertEqual(list(root.iterdir()), [])

    def test_runtime_overrides_are_rejected_without_recording_values(self):
        for name in qualification.FORBIDDEN_OVERRIDES:
            with self.subTest(name=name), patch.dict(qualification.os.environ, {name: "sensitive-value"}):
                with self.assertRaisesRegex(ValueError, "values are not recorded"):
                    qualification.check_source(pathlib.Path("nonexistent"))

    def test_package_manifest_embedded_client_and_archive_are_all_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            output = root / "frontend/dist-desktop"
            app = output / "Solomon Darker-linux-x64"
            client = app / "resources/app/client"
            client.mkdir(parents=True)
            build = {"schemaVersion": 1, "revision": qualification.SOURCE, "sourceTimestamp": 123}
            manifest = {**build, "platform": "linux", "arch": "x64", "executable": "solomon-darker",
                        "electronVersion": "43.4.0", "nodeRuntime": {"version": "22.17.0", "sha256": qualification.NODE_ARCHIVE_SHA256}}
            qualification.write_json(app / "desktop-package-manifest.json", manifest)
            qualification.write_json(output / "desktop-release.json", build)
            qualification.write_json(app / "resources/app/desktop-build.json", build)
            qualification.write_json(client / "deployment.json", {"revision": qualification.SOURCE})
            executable = app / "solomon-darker"
            executable.write_bytes(b"synthetic executable")
            executable.chmod(0o755)
            archive = output / "Solomon-Darker-linux-x64.zip"
            archive.write_bytes(b"synthetic package bytes")
            checksum = output / (archive.name + ".sha256")
            checksum.write_text(qualification.sha256(archive) + "  " + archive.name + "\n")
            with patch.object(qualification, "check_source", return_value={"sourceTimestamp": 123}):
                record = qualification.package_record(root)
                self.assertEqual(record["archive"]["sha256"], qualification.sha256(archive))
                self.assertEqual(record["kind"], "newly-built-exact-source-package")
                for path in (output / "desktop-release.json", app / "resources/app/desktop-build.json",
                             client / "deployment.json", app / "desktop-package-manifest.json"):
                    saved = path.read_text()
                    changed = json.loads(saved)
                    changed["revision"] = "c20fd89cb98c3a76f0852305252f1a3ba06fd59a"
                    qualification.write_json(path, changed)
                    with self.subTest(path=path), self.assertRaises(ValueError):
                        qualification.package_record(root)
                    path.write_text(saved)
                archive.write_bytes(b"changed package bytes")
                with self.assertRaisesRegex(ValueError, "checksum"):
                    qualification.package_record(root)

    def test_finish_keeps_failed_smoke_authoritative(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            source_record = {"revision": qualification.SOURCE}
            qualification.write_json(root / "source-before.json", {"product": source_record, "orchestration": {"GITHUB_SHA": "diagnostic"}})
            qualification.write_json(root / "package-before.json", {"archive": "fixture"})
            for label in ("package", "playwright"):
                for suffix in ("before", "after"):
                    qualification.write_json(root / f"{label}-files-{suffix}.json", [{"path": "fixture"}])
            steps = {name: {"outcome": "success"} for name in qualification.REQUIRED_STEPS}
            with patch.object(qualification, "check_source", return_value=source_record), \
                    patch.object(qualification, "package_record", return_value={"archive": "fixture"}), \
                    patch.object(qualification, "inventory_one"), \
                    patch.object(qualification, "check_smoke", return_value={"status": "ok"}):
                for outcome in ("failure", "skipped", "cancelled", "success"):
                    steps["smoke"]["outcome"] = outcome
                    with patch.dict(qualification.os.environ, {"QUALIFICATION_STEPS": json.dumps(steps)}):
                        status = qualification.finish(root, root)
                        result = qualification.read_json(root / "qualification.json")
                        self.assertEqual(result["acceptance"], outcome == "success")
                        self.assertEqual(status, 0 if outcome == "success" else 1)

    def test_finish_collects_later_evidence_after_source_and_package_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            for suffix in ("before", "after"):
                qualification.write_json(root / f"playwright-files-{suffix}.json", [{"path": "fixture"}])
            def inventory(source, evidence, label, suffix):
                if label == "package":
                    raise ValueError("package unavailable")
            with patch.object(qualification, "check_source", side_effect=ValueError("wrong source")), \
                    patch.object(qualification, "package_record", side_effect=ValueError("wrong package")), \
                    patch.object(qualification, "inventory_one", side_effect=inventory), \
                    patch.object(qualification, "check_smoke", return_value={"status": "ok"}):
                self.assertEqual(qualification.finish(root, root), 1)
            result = qualification.read_json(root / "qualification.json")
            self.assertFalse(result["acceptance"])
            self.assertTrue(result["checks"]["playwrightInventoryUnchanged"])
            self.assertTrue(result["checks"]["originalSmokeReceiptComplete"])
            self.assertEqual(len(result["errors"]), 3)


if __name__ == "__main__":
    unittest.main()
