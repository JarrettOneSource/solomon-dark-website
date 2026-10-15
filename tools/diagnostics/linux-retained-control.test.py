"""Offline control-contract tests. No product launch, extraction or build."""
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import stat
import tempfile
import unittest
import zipfile
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).with_name("linux-retained-control.py")
SPEC = importlib.util.spec_from_file_location("retained_control", SCRIPT)
C = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(C)


def metadata():
    meta = {"id": C.ARTIFACT_ID, "name": f"linux-new-package-39875413-{C.RUN_ID}", "expired": False,
            "digest": "sha256:" + C.OUTER_SHA, "workflow_run": {"id": C.RUN_ID, "head_sha": C.ORCHESTRATION}}
    names = ["Verify clean pinned source and qualification contract", "Run original desktop tests",
             "Build standalone app from exact source with original generator", "Archive newly built app with original archiver",
             "Bind retained archive to package and dependency inventories", "Retain newly built package before acceptance can fail"]
    failed = {"id": C.JOB_ID, "run_id": C.RUN_ID, "head_sha": C.ORCHESTRATION, "run_attempt": 1,
              "conclusion": "failure", "name": "Original Linux acceptance on newly built 39875413",
              "steps": [{"name": name, "conclusion": "success"} for name in names]
              + [{"name": "Verify packaged offline save and peer gameplay", "conclusion": "failure"}]}
    return meta, failed


def member(name, kind=stat.S_IFREG):
    item = zipfile.ZipInfo(name)
    item.external_attr = (kind | 0o644) << 16
    return item


class RetainedControlTests(unittest.TestCase):
    def test_exact_retained_metadata_is_accepted(self):
        C.check_metadata(*metadata())

    def test_wrong_artifact_fields_fail_closed(self):
        for key, value in (("id", 1), ("name", "desktop-linux-x64"), ("expired", True), ("digest", "sha256:" + "0" * 64)):
            meta, failed = metadata()
            meta[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                C.check_metadata(meta, failed)
        for key, value in (("id", 1), ("head_sha", C.Q.SOURCE)):
            meta, failed = metadata()
            meta["workflow_run"][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                C.check_metadata(meta, failed)

    def test_wrong_qualification_fields_and_retry_fail_closed(self):
        for key, value in (("id", 1), ("run_id", 1), ("head_sha", C.Q.SOURCE), ("run_attempt", 2),
                           ("conclusion", "success"), ("name", "Desktop (linux-x64)")):
            meta, failed = metadata()
            failed[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                C.check_metadata(meta, failed)

    def test_every_origin_provenance_step_and_original_failure_are_required(self):
        meta, failed = metadata()
        for index in range(len(failed["steps"])):
            bad = copy.deepcopy(failed)
            bad["steps"][index]["conclusion"] = "skipped"
            with self.subTest(index=index), self.assertRaises(ValueError):
                C.check_metadata(meta, bad)
            bad = copy.deepcopy(failed)
            del bad["steps"][index]
            with self.subTest(missing=index), self.assertRaises(KeyError):
                C.check_metadata(meta, bad)

    def test_outer_archive_has_only_original_three_regular_files(self):
        names = ["Solomon-Darker-linux-x64.zip", "Solomon-Darker-linux-x64.zip.sha256", "desktop-release.json"]
        C.check_zip_members([member(name) for name in names], outer=True)
        for bad in ([member(name) for name in names] + [member("extra")], [member(name) for name in names[:-1]],
                    [member(name) for name in names] + [member(names[0])],
                    [member(name, stat.S_IFLNK if index == 0 else stat.S_IFREG) for index, name in enumerate(names)]):
            with self.assertRaises(ValueError):
                C.check_zip_members(bad, outer=True)

    def test_inner_archive_path_count_and_type_guards(self):
        good = [member("Solomon Darker-linux-x64/", stat.S_IFDIR)]
        good += [member(f"Solomon Darker-linux-x64/file-{i}") for i in range(1081)]
        C.check_zip_members(good)
        for name in ("/absolute", "Solomon Darker-linux-x64/../escape", "wrong-root/file", "Solomon Darker-linux-x64/back\\slash"):
            bad = good.copy()
            bad[-1] = member(name)
            with self.subTest(name=name), self.assertRaises(ValueError):
                C.check_zip_members(bad)
        for kind in (stat.S_IFLNK, stat.S_IFCHR, stat.S_IFBLK, stat.S_IFIFO, stat.S_IFSOCK):
            bad = good.copy()
            bad[-1] = member(good[-1].filename, kind)
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                C.check_zip_members(bad)
        with self.assertRaises(ValueError):
            C.check_zip_members(good[:-1])

    def test_retained_package_digest_size_and_manifest_are_required(self):
        record = {"archive": {"sha256": C.INNER_SHA, "bytes": C.INNER_BYTES}, "kind": "newly-built-exact-source-package"}
        with patch.object(C.Q, "package_record", return_value=record.copy()), patch.object(C.Q, "sha256", return_value=C.MANIFEST_SHA):
            self.assertEqual(C.retained_package_record(pathlib.Path("/synthetic"))["kind"], "retained-exact-source-package")
        for field, value in (("sha256", "0" * 64), ("bytes", 1)):
            bad = copy.deepcopy(record)
            bad["archive"][field] = value
            with patch.object(C.Q, "package_record", return_value=bad), self.assertRaises(ValueError):
                C.retained_package_record(pathlib.Path("/synthetic"))
        with patch.object(C.Q, "package_record", return_value=record), patch.object(C.Q, "sha256", return_value="0" * 64), self.assertRaises(ValueError):
            C.retained_package_record(pathlib.Path("/synthetic"))

    def test_inventory_requires_exact_count_and_content_digest(self):
        for label, (count, digest) in C.INVENTORIES.items():
            with patch.object(C.Q, "read_json", return_value=[{}] * count), patch.object(C.Q, "sha256", return_value=digest):
                C.verify_inventory(pathlib.Path("/synthetic"), label, "before")
            with patch.object(C.Q, "read_json", return_value=[{}] * (count - 1)), patch.object(C.Q, "sha256", return_value=digest), self.assertRaises(ValueError):
                C.verify_inventory(pathlib.Path("/synthetic"), label, "before")
            with patch.object(C.Q, "read_json", return_value=[{}] * count), patch.object(C.Q, "sha256", return_value="0" * 64), self.assertRaises(ValueError):
                C.verify_inventory(pathlib.Path("/synthetic"), label, "after")

    def test_every_control_step_must_succeed(self):
        good = {name: "success" for name in C.REQUIRED_STEPS}
        self.assertTrue(C.steps_passed(good))
        for name in good:
            for value in ("failure", "skipped", "cancelled", ""):
                self.assertFalse(C.steps_passed({**good, name: value}))
            self.assertFalse(C.steps_passed({k: v for k, v in good.items() if k != name}))

    def test_final_result_never_promotes_missing_or_failed_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            evidence = pathlib.Path(directory)
            source = evidence / "not-executed"
            source_record = {"revision": C.Q.SOURCE}
            package = {"fixture": "retained-package"}
            C.Q.write_json(evidence / "source-before.json", {"product": source_record, "orchestration": {"fixture": True}})
            C.Q.write_json(evidence / "package-before.json", package)
            for label in C.INVENTORIES:
                for suffix in ("before", "after"):
                    (evidence / f"{label}-files-{suffix}.json").write_text("[]")
            steps = {name: {"outcome": "success"} for name in C.REQUIRED_STEPS}
            with patch.dict(os.environ, {"CONTROL_STEPS": json.dumps(steps)}), patch.object(C.Q, "check_source", return_value=source_record), patch.object(C, "retained_package_record", return_value=package), patch.object(C.Q, "inventory_one"), patch.object(C, "verify_inventory"), patch.object(C.Q, "check_smoke", return_value={"status": "ok"}):
                self.assertEqual(C.finish(source, evidence), 0)
                result = C.Q.read_json(evidence / "retained-control.json")
                self.assertTrue(result["controlPassed"])
                self.assertFalse(result["releaseAcceptance"])
                for label in C.INVENTORIES:
                    with patch.object(C, "verify_inventory", side_effect=ValueError("fixture mismatch")):
                        self.assertEqual(C.finish(source, evidence), 1)
                with patch.object(C.Q, "check_smoke", side_effect=FileNotFoundError("fixture missing screenshot")):
                    self.assertEqual(C.finish(source, evidence), 1)
                with patch.dict(os.environ, {"CONTROL_STEPS": "{}"}):
                    self.assertEqual(C.finish(source, evidence), 1)

    def test_original_receipt_and_all_six_screenshots_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            receipt = {"status": "ok", "platform": "linux", "revision": C.Q.SOURCE,
                       "offline": {"bundledHostExited": True, "updateCheckFailedWithoutBlockingPlay": True},
                       "updatePrompt": {"shown": True, "dismissedWithoutRestart": True},
                       "peer": {"sharedBoneyardPlayers": 2}}
            C.Q.write_json(root / "receipt.json", receipt)
            for name in C.Q.SCREENSHOTS:
                (root / name).write_bytes(b"synthetic-image")
            C.Q.check_smoke(root)
            for name in C.Q.SCREENSHOTS:
                (root / name).unlink()
                with self.assertRaises(ValueError):
                    C.Q.check_smoke(root)
                (root / name).write_bytes(b"synthetic-image")
            for key, value in (("status", "failed"), ("platform", "darwin"), ("revision", "wrong")):
                C.Q.write_json(root / "receipt.json", {**receipt, key: value})
                with self.assertRaises(ValueError):
                    C.Q.check_smoke(root)

    def test_existing_source_guards_and_workload_remain_exact(self):
        source = pathlib.Path(os.environ.get("SDR_SOURCE_ROOT", str(SCRIPT.parents[2])))
        harness = (source / "frontend/tools/smoke-desktop-runtime.mjs").read_bytes()
        self.assertEqual(hashlib.sha256(harness).hexdigest(), C.Q.FILES["frontend/tools/smoke-desktop-runtime.mjs"])
        self.assertEqual(sum(line.strip().startswith("assert.") for line in harness.decode().splitlines()), 19)
        workflow = (SCRIPT.parents[2] / ".github/workflows/linux-retained-control.yml").read_text()
        self.assertEqual(workflow.count("run: xvfb-run -a npm run smoke:desktop"), 1)
        for text in ("npm run package:desktop", "node tools/archive-desktop.mjs", "linux-launch-observer", "--run", "continue-on-error", "workflow_dispatch:", "SDR_DESKTOP_APP:"):
            self.assertNotIn(text, workflow)
        self.assertIn("github.run_attempt == 1", workflow)
        self.assertIn("ref: " + C.Q.SOURCE, workflow)
        self.assertEqual(C.REQUIRED_STEPS, ("source", "install", "package", "smoke"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
