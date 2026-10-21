from importlib.util import module_from_spec, spec_from_file_location
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = spec_from_file_location("game_artifact", ROOT / "tools/fetch-game-artifact.py")
ARTIFACT = module_from_spec(SPEC)
SPEC.loader.exec_module(ARTIFACT)


class GameArtifactDownloadTests(unittest.TestCase):
    def package(self, directory, extra=None):
        path = directory / "game.tar.gz"
        files = {"game-artifact.json": json.dumps({"target": "x86_64-unknown-linux-gnu"}).encode(),
                 "bin/solomon-darker": b"native host", "client/index.html": b"client"}
        with tarfile.open(path, "w:gz") as archive:
            for name, value in files.items():
                member = tarfile.TarInfo(name)
                member.size = len(value)
                archive.addfile(member, io.BytesIO(value))
            if extra is not None:
                archive.addfile(extra)
        return path, hashlib.sha256(path.read_bytes()).hexdigest()

    def test_download_requires_an_explicit_archive_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "exact SDR_GAME_ARTIFACT_SHA256"):
                ARTIFACT.fetch_artifact("https://example.invalid/game.tar.gz", "", Path(directory) / "out")

    def test_verified_archive_materializes_the_matching_client_and_host(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive, digest = self.package(root)
            output = root / "out"
            result = ARTIFACT.fetch_artifact(archive.as_uri(), digest, output)
            self.assertEqual(Path(result["dist"]), output.resolve() / "client")
            self.assertEqual(Path(result["nativeHost"]).read_bytes(), b"native host")
            self.assertEqual((output / "client/index.html").read_bytes(), b"client")

    def test_hash_mismatch_never_extracts_the_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive, _ = self.package(root)
            output = root / "out"
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                ARTIFACT.fetch_artifact(archive.as_uri(), "0" * 64, output)
            self.assertFalse(output.exists())

    def test_verified_archive_still_cannot_escape_or_create_symlinks(self):
        for name, symlink in [("../outside", False), ("client/link", True)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                member = tarfile.TarInfo(name)
                if symlink:
                    member.type = tarfile.SYMTYPE
                    member.linkname = "../../outside"
                archive, digest = self.package(root, member)
                output = root / "out"
                with self.assertRaisesRegex(ValueError, "unsafe entry"):
                    ARTIFACT.fetch_artifact(archive.as_uri(), digest, output)
                self.assertFalse(output.exists())
                self.assertFalse((root / "outside").exists())

    def test_existing_files_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive, digest = self.package(root)
            output = root / "out"
            output.mkdir()
            (output / "retained").write_text("existing")
            with self.assertRaisesRegex(ValueError, "new directory"):
                ARTIFACT.fetch_artifact(archive.as_uri(), digest, output)
            self.assertEqual((output / "retained").read_text(), "existing")


if __name__ == "__main__":
    unittest.main()
