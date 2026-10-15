"""Verify one original-harness control on retained Linux bytes; never build or launch."""
import argparse
import hashlib
import importlib.util
import json
import os
import pathlib
import stat
import subprocess
import sys
import zipfile

SPEC = importlib.util.spec_from_file_location("source_qualification", pathlib.Path(__file__).with_name("linux-source-qualification.py"))
Q = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(Q)
ARTIFACT_ID = 11997259442
RUN_ID = 38787359411
JOB_ID = 116602702052
ORCHESTRATION = "0d8ae95e7af35d62464b5d80d6d2698bac43bae4"
OUTER_SHA = "70ca300f9cbf665c3700899a5b716153249d60c5dff496db40e625fd592defa7"
INNER_SHA = "79edf19e60a82ff0ec5f4a512f9797e36ab6bc9269f5b9c87020e37a0dcc5a27"
INNER_BYTES = 330254721
MANIFEST_SHA = "4aab907f1c26c352c0f733120e954c7dd480e369533b68169cb966fff4dd3864"
INVENTORIES = {
    "package": (1081, "5039b8a9bec0168858befbb46ad836e4b5db6119d1b7ce3e22f0a58a44a040ad"),
    "playwright": (128, "fbc4fa90e621c5c93bc7c61699fb097cb533b2ddb35e8a892e61a3f81fb8027e"),
}
REQUIRED_STEPS = ("source", "install", "package", "smoke")
BRANCH = "refs/heads/codex/diagnose-intel-c20-sh9aksle"
require = Q.require


def check_metadata(meta, failed):
    require(meta["id"] == ARTIFACT_ID and meta["name"] == f"linux-new-package-39875413-{RUN_ID}"
            and meta["expired"] is False and meta["digest"] == "sha256:" + OUTER_SHA,
            "Wrong retained artifact identity")
    require(meta["workflow_run"]["id"] == RUN_ID and meta["workflow_run"]["head_sha"] == ORCHESTRATION,
            "Wrong retained artifact source run")
    require(failed["id"] == JOB_ID and failed["run_id"] == RUN_ID and failed["head_sha"] == ORCHESTRATION
            and failed["run_attempt"] == 1 and failed["conclusion"] == "failure"
            and failed["name"] == "Original Linux acceptance on newly built 39875413",
            "Wrong failed qualification identity")
    steps = {step["name"]: step["conclusion"] for step in failed["steps"]}
    require(steps["Verify packaged offline save and peer gameplay"] == "failure", "Original failure is missing")
    for name in ("Verify clean pinned source and qualification contract", "Run original desktop tests",
                 "Build standalone app from exact source with original generator", "Archive newly built app with original archiver",
                 "Bind retained archive to package and dependency inventories", "Retain newly built package before acceptance can fail"):
        require(steps[name] == "success", "Missing retained-package provenance step")


def check_zip_members(infos, outer=False):
    names = [entry.filename for entry in infos]
    require(len(names) == len(set(names)), "Duplicate archive paths")
    if outer:
        require(set(names) == {"Solomon-Darker-linux-x64.zip", "Solomon-Darker-linux-x64.zip.sha256", "desktop-release.json"},
                "Unexpected outer archive members")
    else:
        require(len(names) == 1082, "Wrong inner archive entry count")
    for entry in infos:
        path = pathlib.PurePosixPath(entry.filename)
        mode = entry.external_attr >> 16
        require(not path.is_absolute() and ".." not in path.parts and "\\" not in entry.filename,
                "Unsafe archive path")
        require(not stat.S_ISLNK(mode) and not stat.S_ISCHR(mode) and not stat.S_ISBLK(mode)
                and not stat.S_ISFIFO(mode) and not stat.S_ISSOCK(mode), "Unexpected archive entry kind")
        if not outer:
            require(path.parts and path.parts[0] == "Solomon Darker-linux-x64", "Wrong inner archive root")


def retained_package_record(source):
    result = Q.package_record(source)
    require(result["archive"]["sha256"] == INNER_SHA and result["archive"]["bytes"] == INNER_BYTES,
            "Retained archive bytes changed")
    manifest = source / "frontend/dist-desktop/Solomon Darker-linux-x64/desktop-package-manifest.json"
    require(Q.sha256(manifest) == MANIFEST_SHA, "Retained manifest bytes changed")
    result.update(kind="retained-exact-source-package", packageArtifactId=ARTIFACT_ID,
                  qualificationRunId=RUN_ID, qualificationJobId=JOB_ID,
                  limit="Exact retained package from failed qualification 38787359411. No rebuild; not the unretained earlier 38766573551 bytes.")
    return result


def verify_inventory(evidence, label, suffix):
    path = evidence / f"{label}-files-{suffix}.json"
    count, digest = INVENTORIES[label]
    require(len(Q.read_json(path)) == count and Q.sha256(path) == digest,
            "Inventory differs from the retained failing package or original pinned Playwright: " + label)


def prepare_package(source, evidence, archive):
    Q.check_source(source)
    check_metadata(Q.read_json(evidence / "artifact-api.json"), Q.read_json(evidence / "retained-package-failing-job.json"))
    require(Q.sha256(archive) == OUTER_SHA, "Wrong outer artifact bytes")
    output = source / "frontend/dist-desktop"
    require(not output.exists(), "Retained-package destination must be absent")
    with zipfile.ZipFile(archive) as bundle:
        check_zip_members(bundle.infolist(), outer=True)
        output.mkdir()
        bundle.extractall(output)
    inner = output / "Solomon-Darker-linux-x64.zip"
    require(Q.sha256(inner) == INNER_SHA and inner.stat().st_size == INNER_BYTES, "Wrong inner archive bytes")
    require((output / (inner.name + ".sha256")).read_text().strip() == INNER_SHA + "  " + inner.name,
            "Wrong original archive sidecar")
    with zipfile.ZipFile(inner) as bundle:
        check_zip_members(bundle.infolist())
    subprocess.run(["unzip", "-q", str(inner), "-d", str(output)], check=True)
    Q.write_json(evidence / "package-before.json", retained_package_record(source))
    Q.inventory(source, evidence, "before")
    for label in INVENTORIES:
        verify_inventory(evidence, label, "before")


def steps_passed(steps):
    return all(steps.get(name) == "success" for name in REQUIRED_STEPS)


def finish(source, evidence):
    step_data = json.loads(os.environ.get("CONTROL_STEPS", "{}"))
    steps = {name: step_data.get(name, {}).get("outcome", "") for name in REQUIRED_STEPS}
    result = {"controlPassed": False, "releaseAcceptance": False,
              "scope": "One uninstrumented original-harness control on retained Linux bytes; previous failures remain preserved.",
              "productRevision": Q.SOURCE, "productTree": Q.TREE, "steps": steps, "checks": {}, "errors": []}
    try:
        result["sourceAfter"] = Q.check_source(source)
        before = Q.read_json(evidence / "source-before.json")
        require(result["sourceAfter"] == before["product"], "Source provenance changed")
        result["orchestration"] = before["orchestration"]
        result["checks"]["sourceUnchanged"] = True
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        result["errors"].append("source: " + str(error))
    try:
        result["package"] = retained_package_record(source)
        require(result["package"] == Q.read_json(evidence / "package-before.json"), "Retained archive or manifest changed")
        result["checks"]["retainedPackageUnchanged"] = True
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        result["errors"].append("package: " + str(error))
    for label in INVENTORIES:
        try:
            Q.inventory_one(source, evidence, label, "after")
            verify_inventory(evidence, label, "before")
            verify_inventory(evidence, label, "after")
            require((evidence / f"{label}-files-before.json").read_bytes()
                    == (evidence / f"{label}-files-after.json").read_bytes(), "Inventory changed: " + label)
            result["checks"][label + "InventoryUnchanged"] = True
        except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
            result["errors"].append(label + ": " + str(error))
    try:
        result["smoke"] = Q.check_smoke(evidence / "smoke")
        result["checks"]["originalSmokeReceiptComplete"] = True
    except (OSError, ValueError, KeyError) as error:
        result["errors"].append("smoke: " + str(error))
    result["controlPassed"] = steps_passed(steps) and not result["errors"]
    Q.write_json(evidence / "retained-control.json", result)
    return 0 if result["controlPassed"] else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("source", "package", "finish"))
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--evidence", type=pathlib.Path, required=True)
    parser.add_argument("--archive", type=pathlib.Path)
    args = parser.parse_args()
    source, evidence = Q.check_paths(args.source, args.evidence)
    require(os.environ.get("GITHUB_RUN_ATTEMPT", "1") == "1", "Repeated hosted attempts are not allowed")
    require(os.environ.get("GITHUB_REF", BRANCH) == BRANCH, "Wrong control branch")
    require(os.environ.get("GITHUB_REPOSITORY", "JarrettOneSource/solomon-dark-website")
            == "JarrettOneSource/solomon-dark-website", "Wrong repository")
    require(pathlib.Path(os.environ.get("SDR_DESKTOP_EVIDENCE", str(evidence / "smoke"))).resolve() == evidence / "smoke",
            "Smoke evidence must remain in the separate evidence root")
    evidence.mkdir(parents=True, exist_ok=True)
    if args.phase == "source":
        tools_root = pathlib.Path(__file__).resolve().parents[2]
        if os.environ.get("GITHUB_SHA"):
            require(Q.git(tools_root, "rev-parse", "HEAD") == os.environ["GITHUB_SHA"], "Wrong orchestration checkout")
        files = [pathlib.Path(__file__), pathlib.Path(__file__).with_name("linux-retained-control.test.py"),
                 pathlib.Path(__file__).with_name("linux-source-qualification.py"),
                 pathlib.Path(__file__).with_name("package-inventory.py"),
                 tools_root / ".github/workflows/linux-retained-control.yml"]
        Q.write_json(evidence / "source-before.json", {
            "product": Q.check_source(source),
            "orchestration": {name: os.environ.get(name) for name in
                              ("GITHUB_REPOSITORY", "GITHUB_SHA", "GITHUB_REF", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT")},
            "controlFiles": {str(path.relative_to(tools_root)): Q.sha256(path) for path in files},
            "harness": "Original unmodified npm run smoke:desktop, without observer or runtime overrides",
            "packageKind": "retained-exact-source-package", "packageArtifactId": ARTIFACT_ID})
    elif args.phase == "package":
        require(args.archive is not None, "Retained outer archive is required")
        prepare_package(source, evidence, args.archive.resolve(strict=True))
    else:
        return finish(source, evidence)
    return 0


if __name__ == "__main__":
    sys.exit(main())
