#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import base64
import hmac
import io
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
import urllib.parse
import uuid
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BONEYARD_FIXTURE = ROOT / "tests" / "fixtures" / "flat_multiplayer_test.boneyard"


def package(files: dict[str, bytes], manifest: dict[str, object]) -> bytes:
    entries = {"manifest.json": json.dumps(manifest, separators=(",", ":")).encode(), **files}
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, content in entries.items():
            archive.writestr(path, content)
    return buffer.getvalue()


def content_hash(package_bytes: bytes) -> str:
    aggregate = hashlib.sha256()
    with zipfile.ZipFile(io.BytesIO(package_bytes)) as archive:
        for name in sorted(info.filename for info in archive.infolist() if not info.is_dir()):
            digest = hashlib.sha256(archive.read(name)).hexdigest()
            aggregate.update(f"{name}\0{digest}\n".encode())
    return aggregate.hexdigest()


def crash_package(metadata: dict[str, object], artifacts: dict[str, bytes]) -> bytes:
    artifact_details = [
        {
            "path": path,
            "size": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        for path, content in artifacts.items()
    ]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "report.json",
            json.dumps({"report": metadata, "artifactDetails": artifact_details}),
        )
        for path, content in artifacts.items():
            archive.writestr(path, content)
    return buffer.getvalue()


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


class WebsiteModSyncContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory(prefix="sdr-website-mod-sync-")
        cls.port = free_port()
        cls.origin = f"http://127.0.0.1:{cls.port}"
        cls.dotnet = os.environ.get("SDR_DOTNET") or shutil.which("dotnet")
        if not cls.dotnet:
            raise unittest.SkipTest("dotnet is unavailable")

        cls.jwt_secret = "website-mod-sync-contract-secret-at-least-thirty-two-bytes"
        cls.environment = os.environ.copy()
        cls.environment.update(
            {
                "ASPNETCORE_ENVIRONMENT": "Production",
                "ASPNETCORE_URLS": cls.origin,
                "Storage__Root": cls.temp.name,
                "Jwt__Secret": cls.jwt_secret,
            }
        )
        cls.build_server()
        cls.start_server()

        status, registered = cls.request(
            "POST",
            "/api/auth/register",
            json_body={
                "username": "modsync",
                "email": "modsync@example.invalid",
                "password": "correct-horse-battery-staple",
            },
        )
        if status != 201:
            raise RuntimeError(f"test registration failed: {status} {registered}")
        cls.token = registered["token"]

    @classmethod
    def build_server(cls) -> None:
        result = subprocess.run(
            [
                cls.dotnet,
                "build",
                str(ROOT / "backend/Server.csproj"),
                "--nologo",
            ],
            cwd=ROOT,
            env=cls.environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=180,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(f"website build failed:\n{result.stdout}")

    @classmethod
    def start_server(cls) -> None:
        cls.server = subprocess.Popen(
            [
                cls.dotnet,
                "run",
                "--project",
                str(ROOT / "backend/Server.csproj"),
                "--no-launch-profile",
                "--no-build",
            ],
            cwd=ROOT,
            env=cls.environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if cls.server.poll() is not None:
                output = cls.server.stdout.read() if cls.server.stdout else ""
                raise RuntimeError(f"website exited during startup:\n{output}")
            try:
                status, _ = cls.request("GET", "/api/stats")
                if status == 200:
                    break
            except OSError:
                pass
            time.sleep(0.1)
        else:
            cls.server.terminate()
            try:
                output, _ = cls.server.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                cls.server.kill()
                output, _ = cls.server.communicate(timeout=5)
            raise RuntimeError(f"website did not start within 60 seconds:\n{output}")

    @classmethod
    def stop_server(cls) -> None:
        cls.server.terminate()
        try:
            cls.server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.wait(timeout=5)
        if cls.server.stdout:
            cls.server.stdout.close()

    @classmethod
    def tearDownClass(cls) -> None:
        if hasattr(cls, "server"):
            cls.stop_server()
        if hasattr(cls, "temp"):
            cls.temp.cleanup()

    @classmethod
    def request(
        cls,
        method: str,
        path: str,
        *,
        json_body: object | None = None,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, object]:
        request_headers = dict(headers or {})
        if json_body is not None:
            body = json.dumps(json_body).encode()
            request_headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            cls.origin + path,
            data=body,
            headers=request_headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = response.read()
                return response.status, json.loads(payload) if payload else None
        except urllib.error.HTTPError as error:
            payload = error.read()
            return error.code, json.loads(payload) if payload else None

    @classmethod
    def upload(
        cls,
        name: str,
        version: str,
        archive: bytes,
        *,
        slug: str | None = None,
    ) -> tuple[int, object]:
        boundary = f"----sdr-{uuid.uuid4().hex}"
        fields = {
            "name": name,
            "summary": "Contract test package",
            "description": "Automated package contract coverage.",
            "version": version,
        }
        parts: list[bytes] = []
        for key, value in fields.items():
            parts.append(
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode()
            )
        parts.append(
            (
                f"--{boundary}\r\n"
                'Content-Disposition: form-data; name="file"; filename="mod.zip"\r\n'
                "Content-Type: application/zip\r\n\r\n"
            ).encode()
            + archive
            + b"\r\n"
        )
        parts.append(f"--{boundary}--\r\n".encode())
        path = "/api/mods" if slug is None else f"/api/mods/{slug}/versions"
        return cls.request(
            "POST",
            path,
            body=b"".join(parts),
            headers={
                "Authorization": f"Bearer {cls.token}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
        )

    @classmethod
    def steam_token(cls, steam_id: str) -> str:
        def encode(value: bytes) -> bytes:
            return base64.urlsafe_b64encode(value).rstrip(b"=")

        header = encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
        payload = encode(
            json.dumps(
                {
                    "sub": f"steam:{steam_id}",
                    "jti": uuid.uuid4().hex,
                    "sdr_token_type": "steam-directory",
                    "steam_id": steam_id,
                    "steam_appid": "3362180",
                    "exp": int(time.time()) + 900,
                },
                separators=(",", ":"),
            ).encode()
        )
        signing_input = header + b"." + payload
        signature = encode(
            hmac.new(cls.jwt_secret.encode(), signing_input, hashlib.sha256).digest()
        )
        return b".".join((header, payload, signature)).decode()

    @classmethod
    def crash_upload(
        cls,
        metadata: dict[str, object],
        archive: bytes,
        token: str | None,
    ) -> tuple[int, object]:
        boundary = f"----sdr-crash-{uuid.uuid4().hex}"
        parts = [
            (
                f"--{boundary}\r\n"
                'Content-Disposition: form-data; name="metadata"\r\n'
                "Content-Type: application/json\r\n\r\n"
                f"{json.dumps(metadata, separators=(',', ':'))}\r\n"
            ).encode(),
            (
                f"--{boundary}\r\n"
                'Content-Disposition: form-data; name="archive"; filename="crash-report.zip"\r\n'
                "Content-Type: application/zip\r\n\r\n"
            ).encode()
            + archive
            + b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
        headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        return cls.request(
            "POST",
            "/api/crash-reports",
            body=b"".join(parts),
            headers=headers,
        )

    def test_crash_reports_are_private_persisted_and_attributed(self) -> None:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        client_report_id = str(uuid.uuid4())
        metadata = {
            "clientReportId": client_report_id,
            "launchToken": "0123456789abcdef0123456789abcdef",
            "startedAtUtc": now,
            "crashedAtUtc": now,
            "exitCode": -1073741819,
            "launcherVersion": "0.1.0-contract",
            "loaderVersion": "0.1.0-contract",
            "gameVersion": "0.72.5",
            "runtimeProfile": "release",
            "operatingSystem": "Windows contract",
            "processArchitecture": "X64",
            "dotnetRuntime": ".NET contract",
            "enabledMods": [{"id": "tests.enabled", "version": "1.0.0"}],
            "hasCrashLog": True,
            "minidumpCount": 1,
            "artifacts": ["logs/crash.log", "dumps/crash.dmp"],
        }
        artifacts = {
            "logs/crash.log": b"unhandled exception",
            "dumps/crash.dmp": b"MDMP",
        }
        archive = crash_package(metadata, artifacts)

        status, _ = self.crash_upload(metadata, archive, token=None)
        self.assertEqual(status, 401)

        steam_id = "76561198000009999"
        token = self.steam_token(steam_id)
        status, receipt = self.crash_upload(metadata, archive, token)
        self.assertEqual(status, 201, receipt)
        uuid.UUID(receipt["reportId"])
        self.assertTrue(receipt["submittedAtUtc"].endswith("Z"))

        database_path = Path(self.temp.name) / "sdr.db"
        with sqlite3.connect(database_path) as database:
            row = database.execute(
                """
                SELECT SubmitterUserId, SubmitterSteamId, ClientReportId,
                       ExitCode, ArchivePath, ArchiveSize, ArchiveSha256,
                       HasCrashLog, MinidumpCount
                FROM CrashReports
                WHERE PublicId = ?
                """,
                (receipt["reportId"],),
            ).fetchone()
        self.assertIsNotNone(row)
        self.assertIsNone(row[0])
        self.assertEqual(row[1], steam_id)
        self.assertEqual(row[2], client_report_id)
        self.assertEqual(row[3], metadata["exitCode"])
        stored_archive = Path(self.temp.name) / "crash-reports" / row[4]
        self.assertEqual(stored_archive.read_bytes(), archive)
        self.assertEqual(row[5], len(archive))
        self.assertEqual(row[6], hashlib.sha256(archive).hexdigest())
        self.assertEqual(row[7:], (1, 1))

        status, duplicate = self.crash_upload(metadata, archive, token)
        self.assertEqual(status, 200, duplicate)
        self.assertEqual(duplicate["reportId"], receipt["reportId"])

        account_metadata = {**metadata, "clientReportId": str(uuid.uuid4())}
        account_archive = crash_package(account_metadata, artifacts)
        status, account_receipt = self.crash_upload(
            account_metadata,
            account_archive,
            self.token,
        )
        self.assertEqual(status, 201, account_receipt)
        with sqlite3.connect(database_path) as database:
            account_row = database.execute(
                """
                SELECT SubmitterUserId, SubmitterSteamId
                FROM CrashReports
                WHERE PublicId = ?
                """,
                (account_receipt["reportId"],),
            ).fetchone()
        self.assertIsNotNone(account_row[0])
        self.assertIsNone(account_row[1])

        null_token_metadata = {
            **metadata,
            "clientReportId": str(uuid.uuid4()),
            "launchToken": None,
        }
        status, _ = self.crash_upload(
            null_token_metadata,
            crash_package(null_token_metadata, artifacts),
            self.steam_token("76561198000009998"),
        )
        self.assertEqual(status, 400)

        mismatched_metadata = {**metadata, "clientReportId": str(uuid.uuid4())}
        status, _ = self.crash_upload(
            mismatched_metadata,
            archive,
            self.steam_token("76561198000009997"),
        )
        self.assertEqual(status, 400)
        with sqlite3.connect(database_path) as database:
            mismatched_count = database.execute(
                "SELECT COUNT(*) FROM CrashReports WHERE ClientReportId = ?",
                (mismatched_metadata["clientReportId"],),
            ).fetchone()[0]
        self.assertEqual(mismatched_count, 0)

    def test_package_shapes_exact_resolution_and_lobby_join_manifest(self) -> None:
        boneyard_manifest = {
            "id": "tests.blank-boneyard",
            "name": "Blank Boneyard",
            "version": "1.0.0",
            "priority": 10,
            "overlays": [
                {
                    "target": "sandbox/DarkCloud/mylevels/Blank Test.boneyard",
                    "source": "files/Blank Test.boneyard",
                    "format": "boneyard",
                }
            ],
        }
        fixture = BONEYARD_FIXTURE.read_bytes()
        boneyard_zip = package({"files/Blank Test.boneyard": fixture}, boneyard_manifest)
        status, boneyard = self.upload("Blank Boneyard", "1.0.0", boneyard_zip)
        self.assertEqual(status, 201, boneyard)
        self.assertEqual(boneyard["launcherModId"], boneyard_manifest["id"])
        boneyard_version = boneyard["versions"][0]
        self.assertEqual(boneyard_version["packageSha256"], hashlib.sha256(boneyard_zip).hexdigest())
        self.assertEqual(boneyard_version["contentSha256"], content_hash(boneyard_zip))

        lua_manifest = {
            "id": "tests.lua-only",
            "name": "Lua Only",
            "version": "1.0.0",
            "runtime": {
                "apiVersion": "0.2.0",
                "entryScript": "scripts/main.lua",
                "requiredCapabilities": [],
                "optionalCapabilities": ["ui"],
            },
        }
        lua_zip = package({"scripts/main.lua": b"return true\n"}, lua_manifest)
        status, lua = self.upload("Lua Only", "1.0.0", lua_zip)
        self.assertEqual(status, 201, lua)

        art_manifest = {
            "id": "tests.art-only",
            "name": "Art Only",
            "version": "1.0.0",
            "overlays": [
                {
                    "target": "images/Skills.png",
                    "source": "files/Skills.png",
                }
            ],
        }
        art_zip = package(
            {"files/Skills.png": b"\x89PNG\r\n\x1a\nart-contract-fixture"},
            art_manifest,
        )
        status, art = self.upload("Art Only", "1.0.0", art_zip)
        self.assertEqual(status, 201, art)

        combined_manifest = {
            "id": "tests.combined",
            "name": "Combined",
            "version": "2.0.0",
            "overlays": [
                {
                    "target": "data/levels/survival.boneyard",
                    "source": "files/survival.boneyard",
                },
                {
                    "target": "images/Skills.png",
                    "source": "files/Skills.png",
                }
            ],
            "runtime": {
                "apiVersion": "0.2.0",
                "entryScript": "scripts/main.lua",
            },
            "requiredMods": ["tests.lua-only"],
        }
        combined_zip = package(
            {
                "files/survival.boneyard": fixture,
                "files/Skills.png": b"\x89PNG\r\n\x1a\ncombined-art-contract-fixture",
                "scripts/main.lua": b"return true\n",
            },
            combined_manifest,
        )
        status, combined = self.upload("Combined Mod", "2.0.0", combined_zip)
        self.assertEqual(status, 201, combined)

        invalid_manifest = {
            "id": "tests.invalid-boneyard",
            "name": "Invalid Boneyard",
            "version": "1.0.0",
            "overlays": [
                {
                    "target": "data/levels/survival.boneyard",
                    "source": "files/survival.boneyard",
                    "format": "boneyard",
                }
            ],
        }
        status, _ = self.upload(
            "Invalid Boneyard",
            "1.0.0",
            package({"files/survival.boneyard": b""}, invalid_manifest),
        )
        self.assertEqual(status, 400)

        legacy_target_manifest = {
            **invalid_manifest,
            "id": "tests.legacy-boneyard-target",
            "name": "Legacy Boneyard Target",
            "overlays": [
                {
                    "target": "DarkCloud/mylevels/Legacy.boneyard",
                    "source": "files/Legacy.boneyard",
                    "format": "boneyard",
                }
            ],
        }
        status, _ = self.upload(
            "Legacy Boneyard Target",
            "1.0.0",
            package({"files/Legacy.boneyard": fixture}, legacy_target_manifest),
        )
        self.assertEqual(status, 400)

        exact = []
        for item in (boneyard, lua, art, combined):
            version = item["versions"][0]
            exact.append(
                {
                    "id": item["launcherModId"],
                    "version": version["manifestVersion"],
                    "contentSha256": version["contentSha256"],
                }
            )

        status, resolution = self.request("POST", "/api/mods/resolve", json_body={"mods": exact})
        self.assertEqual(status, 200, resolution)
        self.assertEqual(len(resolution["mods"]), 4)
        self.assertEqual(resolution["missing"], [])
        self.assertTrue(all(not mod["downloadUrl"].startswith("/") for mod in resolution["mods"]))

        status, announce = self.request(
            "POST",
            "/api/lobbies/announce",
            headers={"X-SDR-Lobby-Secret": "ab" * 32},
            json_body={
                "lobbyId": "76561198000000001",
                "hostSteamId": "76561198000000002",
                "hostPlayer": "Contract Host",
                "privacy": "public",
                "friendSteamIds": [],
                "players": 1,
                "maxPlayers": 4,
                "build": {
                    "appId": 3362180,
                    "protocolVersion": 69,
                    "manifestSha256": "cd" * 32,
                    "loaderVersion": "contract-test",
                },
                "game": {"phase": "hub"},
                "mods": exact,
            },
        )
        self.assertEqual(status, 200, announce)

        status, lobbies = self.request("GET", "/api/lobbies")
        self.assertEqual(status, 200, lobbies)
        lobby = lobbies["items"][0]
        self.assertEqual(lobby["mods"], sorted(exact, key=lambda mod: mod["id"]))
        self.assertTrue(lobby["join"]["launchUri"].startswith("solomondarkrevived://join/"))
        self.assertIn("directory=http%3A%2F%2F127.0.0.1", lobby["join"]["launchUri"])

        status, join_manifest = self.request(
            "GET", "/api/lobbies/76561198000000001/join-manifest"
        )
        self.assertEqual(status, 200, join_manifest)
        self.assertEqual(join_manifest["mods"], sorted(exact, key=lambda mod: mod["id"]))

    def test_upload_rejects_unsafe_or_inconsistent_packages(self) -> None:
        native_manifest = {
            "id": "tests.native",
            "name": "Native",
            "version": "1.0.0",
            "runtime": {"apiVersion": "0.2.0", "entryDll": "native/mod.dll"},
        }
        status, _ = self.upload(
            "Native Rejected",
            "1.0.0",
            package({"native/mod.dll": b"not a dll"}, native_manifest),
        )
        self.assertEqual(status, 400)

        lua_with_hidden_dll = {
            "id": "tests.hidden-native",
            "name": "Hidden Native",
            "version": "1.0.0",
            "runtime": {"apiVersion": "0.2.0", "entryScript": "scripts/main.lua"},
        }
        status, _ = self.upload(
            "Hidden Native Rejected",
            "1.0.0",
            package(
                {
                    "scripts/main.lua": b"return true\n",
                    "native/hidden.DLL": b"not a dll",
                },
                lua_with_hidden_dll,
            ),
        )
        self.assertEqual(status, 400)

        mismatch_manifest = {
            "id": "tests.version-mismatch",
            "name": "Mismatch",
            "version": "2.0.0",
            "runtime": {"apiVersion": "0.2.0", "entryScript": "scripts/main.lua"},
        }
        status, _ = self.upload(
            "Version Mismatch",
            "1.0.0",
            package({"scripts/main.lua": b"return true\n"}, mismatch_manifest),
        )
        self.assertEqual(status, 400)

        traversal_buffer = io.BytesIO()
        with zipfile.ZipFile(traversal_buffer, "w") as archive:
            archive.writestr("manifest.json", json.dumps(mismatch_manifest))
            archive.writestr("scripts/main.lua", "return true")
            archive.writestr("../outside.txt", "no")
        status, _ = self.upload("Traversal Rejected", "2.0.0", traversal_buffer.getvalue())
        self.assertEqual(status, 400)

        unknown_field_manifest = {
            "id": "tests.unknown-field",
            "name": "Unknown Field",
            "version": "1.0.0",
            "runtime": {
                "apiVersion": "0.2.0",
                "entryScript": "scripts/main.lua",
                "notInTheContract": True,
            },
        }
        status, _ = self.upload(
            "Unknown Field Rejected",
            "1.0.0",
            package({"scripts/main.lua": b"return true\n"}, unknown_field_manifest),
        )
        self.assertEqual(status, 400)

        forbidden_target_manifest = {
            "id": "tests.forbidden-root-target",
            "name": "Forbidden Root Target",
            "version": "1.0.0",
            "overlays": [
                {
                    "target": "SolomonDark.exe",
                    "source": "files/SolomonDark.exe",
                }
            ],
        }
        status, _ = self.upload(
            "Forbidden Root Target",
            "1.0.0",
            package({"files/SolomonDark.exe": b"not executable"}, forbidden_target_manifest),
        )
        self.assertEqual(status, 400)

    def test_password_ticket_guards_join_manifest(self) -> None:
        database_path = Path(self.temp.name) / "sdr.db"
        with sqlite3.connect(database_path, timeout=10) as database:
            database.execute(
                "UPDATE Users SET SteamId = ? WHERE Username = ?",
                ("76561198000000003", "modsync"),
            )
            database.commit()

        salt = bytes.fromhex("12" * 16)
        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            b"open-sesame",
            salt,
            210_000,
        ).hex()
        status, announce = self.request(
            "POST",
            "/api/lobbies/announce",
            headers={"X-SDR-Lobby-Secret": "ef" * 32},
            json_body={
                "lobbyId": "76561198000000011",
                "hostSteamId": "76561198000000012",
                "hostPlayer": "Warded Host",
                "privacy": "passwordProtected",
                "password": {
                    "algorithm": "pbkdf2-sha256",
                    "iterations": 210_000,
                    "salt": salt.hex(),
                    "hash": password_hash,
                },
                "friendSteamIds": [],
                "players": 1,
                "maxPlayers": 4,
                "build": {
                    "appId": 3362180,
                    "protocolVersion": 69,
                    "manifestSha256": "34" * 32,
                    "loaderVersion": "contract-test",
                },
                "game": {"phase": "hub"},
                "mods": [],
            },
        )
        self.assertEqual(status, 200, announce)

        status, _ = self.request(
            "GET", "/api/lobbies/76561198000000011/join-manifest"
        )
        self.assertEqual(status, 403)

        status, grant = self.request(
            "POST",
            f"/api/lobbies/{announce['id']}/authorize",
            headers={"Authorization": f"Bearer {self.token}"},
            json_body={"passwordHash": password_hash},
        )
        self.assertEqual(status, 200, grant)
        self.assertTrue(grant["launchUri"].startswith("solomondarkrevived://join/"))
        self.assertIn("directory=", grant["launchUri"])
        self.assertIn("ticket=", grant["launchUri"])

        query = urllib.parse.urlencode({"ticket": grant["ticket"]})
        status, manifest = self.request(
            "GET",
            f"/api/lobbies/76561198000000011/join-manifest?{query}",
        )
        self.assertEqual(status, 200, manifest)
        self.assertEqual(manifest["mods"], [])

        tampered = grant["ticket"][:-1] + ("0" if grant["ticket"][-1] != "0" else "1")
        status, _ = self.request(
            "GET",
            "/api/lobbies/76561198000000011/join-manifest?"
            + urllib.parse.urlencode({"ticket": tampered}),
        )
        self.assertEqual(status, 403)

    def test_z_database_schema_upgrades_existing_rows(self) -> None:
        type(self).stop_server()
        database_path = Path(self.temp.name) / "sdr.db"
        with sqlite3.connect(database_path) as database:
            database.executescript(
                """
                DROP INDEX IX_Mods_LauncherModId;
                ALTER TABLE Mods DROP COLUMN LauncherModId;
                DROP INDEX IX_ModVersions_ModId_ManifestVersion_ContentSha256;
                ALTER TABLE ModVersions DROP COLUMN ManifestVersion;
                ALTER TABLE ModVersions DROP COLUMN PackageSha256;
                ALTER TABLE ModVersions DROP COLUMN ContentSha256;
                ALTER TABLE Lobbies DROP COLUMN ActiveModsJson;
                """
            )
        type(self).start_server()

        with sqlite3.connect(database_path) as database:
            columns = {
                table: {
                    row[1]
                    for row in database.execute(f"PRAGMA table_info({table})")
                }
                for table in ("Mods", "ModVersions", "Lobbies", "CrashReports")
            }
        self.assertIn("LauncherModId", columns["Mods"])
        self.assertTrue(
            {"ManifestVersion", "PackageSha256", "ContentSha256"}
            <= columns["ModVersions"]
        )
        self.assertIn("ActiveModsJson", columns["Lobbies"])
        self.assertTrue(
            {"SubmitterUserId", "SubmitterSteamId", "SubmittedAtUtc", "ArchivePath"}
            <= columns["CrashReports"]
        )


if __name__ == "__main__":
    unittest.main()
