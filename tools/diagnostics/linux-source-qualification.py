"""Bind the unchanged Linux acceptance run to newly built exact-source bytes.

This helper never builds, launches, patches, or instruments the product. The
workflow runs the original commands directly; bookkeeping cannot turn their
failure or missing evidence into acceptance.
"""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess
import sys

SOURCE = "39875413fa2d3313d5d42170993c7dfa3e885cd1"
TREE = "4d921486310f73246c3adf92c0e84b9077112a68"
NODE_ARCHIVE_SHA256 = "325c0f1261e0c61bcae369a1274028e9cfb7ab7949c05512c5b1e630f7e80e12"
FILES = {
    ".node-version": "157c2eb0de1187ac028e89bcff580f1feab7eea2a280b110998c9472e19b4d98",
    "frontend/package.json": "17e05b12e1cd22dd04533e3c33ab1ef402c4b87f40587dfa7874c1f702d7c208",
    "frontend/package-lock.json": "39baac153d64862e69097379b82d53ce26ac5a1455990672a9a2ca7b288776a0",
    "frontend/tools/package-desktop.mjs": "a3f0c8d9421288248a9617fabc01763912a6da9438ee120ecc425bc6c44866ab",
    "frontend/tools/archive-desktop.mjs": "96f426f27149fd7a2ae12c2e2940a4cff2ea965b06ddcd52d58ede26a978c635",
    "frontend/tools/smoke-desktop-runtime.mjs": "036d980d4147f03a9043f7800866bc5b9a283a86de5a8e12f51d1f5bbbf3d3e3",
    ".github/workflows/validate.yml": "eeedb7ca6c45921cc266167f7e5e1b8548e50769ecad6ec660781f0050334b37",
}
REQUIRED_STEPS = ("source", "install", "tests", "build", "archive", "package",
                  "retain_package", "checkpoint", "smoke")
SCREENSHOTS = ("launcher.png", "solo.png", "resumed.png", "update-prompt.png",
               "peer-host-boneyard.png", "peer-guest-boneyard.png")
FORBIDDEN_OVERRIDES = ("NODE_OPTIONS", "NODE_PATH", "ELECTRON_RUN_AS_NODE", "SDR_BUILD_REVISION",
                       "SDR_DESKTOP_APP", "SDR_DESKTOP_NODE", "SDR_DESKTOP_GAME_HOST",
                       "SDR_DESKTOP_CLIENT_ROOT", "SDR_DESKTOP_BUILD_JSON", "SDR_DESKTOP_USER_DATA")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def check_paths(source, evidence):
    source, evidence = source.resolve(strict=True), evidence.resolve()
    tools_root = pathlib.Path(__file__).resolve().parents[2]
    for protected in (source, tools_root):
        require(evidence != protected and evidence not in protected.parents
                and protected not in evidence.parents,
                "Evidence must be disjoint from product and qualification tools")
    return source, evidence


def git(source, *args):
    return subprocess.check_output(["git", "-C", str(source), *args], text=True).strip()


def check_source(source):
    require(not any(name in os.environ for name in FORBIDDEN_OVERRIDES),
            "Runtime or source override is present; values are not recorded")
    require(git(source, "rev-parse", "HEAD") == SOURCE, "Wrong product commit")
    require(git(source, "rev-parse", "HEAD^{tree}") == TREE, "Wrong product tree")
    require(not git(source, "status", "--porcelain", "--untracked-files=all"), "Product tree is dirty")
    files = {name: sha256(source / name) for name in FILES}
    require(files == FILES, "Original source, package, dependency or harness bytes changed")
    return {"revision": SOURCE, "tree": TREE, "clean": True, "sha256": files,
            "runtimeAndSourceOverridesAbsent": True,
            "sourceTimestamp": int(git(source, "show", "-s", "--format=%ct", "HEAD"))}


def check_manifest(manifest, timestamp):
    expected = {"schemaVersion": 1, "revision": SOURCE, "sourceTimestamp": timestamp,
                "platform": "linux", "arch": "x64", "executable": "solomon-darker",
                "electronVersion": "43.4.0",
                "nodeRuntime": {"version": "22.17.0", "sha256": NODE_ARCHIVE_SHA256}}
    require(manifest == expected, "Packaged manifest does not match exact Linux source/runtime")


def package_record(source):
    source_record = check_source(source)
    output = source / "frontend/dist-desktop"
    app = output / "Solomon Darker-linux-x64"
    manifest = read_json(app / "desktop-package-manifest.json")
    check_manifest(manifest, source_record["sourceTimestamp"])
    executable = app / "solomon-darker"
    require(executable.is_file() and os.access(executable, os.X_OK), "Missing Linux executable")
    build = {key: manifest[key] for key in ("schemaVersion", "revision", "sourceTimestamp")}
    require(read_json(output / "desktop-release.json") == build, "Wrong release manifest")
    require(read_json(app / "resources/app/desktop-build.json") == build, "Wrong embedded build")
    require(read_json(app / "resources/app/client/deployment.json") == {"revision": SOURCE},
            "Wrong embedded client revision")
    archive = output / "Solomon-Darker-linux-x64.zip"
    digest = sha256(archive)
    require((output / (archive.name + ".sha256")).read_text().strip()
            == digest + "  " + archive.name, "Archive checksum mismatch")
    return {"kind": "newly-built-exact-source-package", "source": source_record,
            "manifest": manifest, "archive": {"filename": archive.name,
            "bytes": archive.stat().st_size, "sha256": digest},
            "originalFailedRun": 38766573551,
            "limit": "New package from the same source; original failed Linux package was not retained."}


def inventory_one(source, evidence, label, suffix):
    roots = {"package": source / "frontend/dist-desktop/Solomon Darker-linux-x64",
             "playwright": source / "frontend/node_modules/playwright-core"}
    root = roots[label]
    require(root.is_dir(), "Missing inventory root: " + label)
    if label == "package":
        require((root / "desktop-package-manifest.json").is_file(), "Missing package manifest")
    else:
        require(read_json(root / "package.json")["version"] == "1.61.1", "Wrong installed Playwright version")
    output = evidence / f"{label}-files-{suffix}.json"
    subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name("package-inventory.py")),
                    str(root), str(output)], check=True)
    require(read_json(output), "Empty inventory: " + label)


def inventory(source, evidence, suffix):
    for label in ("package", "playwright"):
        inventory_one(source, evidence, label, suffix)


def steps_passed(steps):
    return all(steps.get(name) == "success" for name in REQUIRED_STEPS)


def check_smoke(directory):
    receipt = read_json(directory / "receipt.json")
    require(receipt.get("status") == "ok" and receipt.get("platform") == "linux"
            and receipt.get("revision") == SOURCE, "Original smoke receipt is not exact-source success")
    require(receipt.get("offline", {}).get("bundledHostExited") is True
            and receipt.get("offline", {}).get("updateCheckFailedWithoutBlockingPlay") is True
            and receipt.get("updatePrompt", {}).get("shown") is True
            and receipt.get("updatePrompt", {}).get("dismissedWithoutRestart") is True
            and receipt.get("peer", {}).get("sharedBoneyardPlayers") == 2,
            "Original smoke receipt is incomplete")
    require(all((directory / name).is_file() and (directory / name).stat().st_size > 0
                for name in SCREENSHOTS), "Missing original success screenshot")
    return receipt


def finish(source, evidence):
    step_data = json.loads(os.environ.get("QUALIFICATION_STEPS", "{}"))
    steps = {name: step_data.get(name, {}).get("outcome", "") for name in REQUIRED_STEPS}
    result = {"acceptance": False, "scope": "Linux packaged acceptance only; not release approval",
              "productRevision": SOURCE, "productTree": TREE, "steps": steps, "checks": {},
              "packageArtifact": {"id": os.environ.get("PACKAGE_ARTIFACT_ID"),
                                  "digest": os.environ.get("PACKAGE_ARTIFACT_DIGEST")},
              "errors": []}
    try:
        result["sourceAfter"] = check_source(source)
        before = read_json(evidence / "source-before.json")
        require(result["sourceAfter"] == before["product"], "Source provenance changed")
        result["orchestration"] = before["orchestration"]
        result["checks"]["sourceUnchanged"] = True
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        result["errors"].append("source: " + str(error))
    try:
        after = package_record(source)
        require(after == read_json(evidence / "package-before.json"), "Package or archive changed")
        result["checks"]["archiveAndManifestsUnchanged"] = True
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        result["errors"].append("archive: " + str(error))
    # Collect the remaining inventory even if another comparison has failed.
    for label in ("package", "playwright"):
        try:
            inventory_one(source, evidence, label, "after")
            require((evidence / f"{label}-files-before.json").read_bytes()
                    == (evidence / f"{label}-files-after.json").read_bytes(), label + " bytes or modes changed")
            result["checks"][label + "InventoryUnchanged"] = True
        except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
            result["errors"].append(label + " inventory: " + str(error))
    try:
        result["smoke"] = check_smoke(evidence / "smoke")
        result["checks"]["originalSmokeReceiptComplete"] = True
    except (OSError, ValueError, KeyError) as error:
        result["errors"].append("smoke: " + str(error))
    result["acceptance"] = steps_passed(steps) and not result["errors"]
    write_json(evidence / "qualification.json", result)
    return 0 if result["acceptance"] else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("source", "package", "finish"))
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--evidence", type=pathlib.Path, required=True)
    args = parser.parse_args()
    source, evidence = check_paths(args.source, args.evidence)
    if "SDR_DESKTOP_EVIDENCE" in os.environ:
        require(pathlib.Path(os.environ["SDR_DESKTOP_EVIDENCE"]).resolve() == evidence / "smoke",
                "Smoke evidence must be inside the separate evidence root")
    evidence.mkdir(parents=True, exist_ok=True)
    if args.phase == "source":
        require(os.environ.get("GITHUB_RUN_ATTEMPT", "1") == "1", "A repeated hosted attempt is not authorized")
        tools_root = pathlib.Path(__file__).resolve().parents[2]
        if os.environ.get("GITHUB_SHA"):
            require(git(tools_root, "rev-parse", "HEAD") == os.environ["GITHUB_SHA"], "Wrong orchestration checkout")
        write_json(evidence / "source-before.json", {
            "product": check_source(source),
            "orchestration": {name: os.environ.get(name) for name in
                              ("GITHUB_REPOSITORY", "GITHUB_SHA", "GITHUB_REF", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT")},
            "qualificationFiles": {str(path.relative_to(tools_root)): sha256(path) for path in
                                   (pathlib.Path(__file__), pathlib.Path(__file__).with_name("package-inventory.py"),
                                    pathlib.Path(__file__).with_name("linux-source-qualification.test.py"),
                                    tools_root / ".github/workflows/linux-source-qualification.yml")},
            "packageKind": "newly-built-exact-source-package",
            "acceptanceHarness": "Original unmodified smoke:desktop; no diagnostic observer",
        })
    elif args.phase == "package":
        write_json(evidence / "package-before.json", package_record(source))
        inventory(source, evidence, "before")
    else:
        return finish(source, evidence)
    return 0


if __name__ == "__main__":
    sys.exit(main())
