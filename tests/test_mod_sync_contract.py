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


def save_package(slot: int, name: str, files: dict[str, bytes]) -> bytes:
    manifest = {
        "schemaVersion": 1,
        "slot": slot,
        "name": name,
        "files": [
            {
                "path": path,
                "size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
            for path, content in sorted(files.items())
        ],
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, separators=(",", ":")))
        for path, content in files.items():
            archive.writestr(f"savegames/{path}", content)
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
        cls.user_id = registered["user"]["id"]

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
    def request_bytes(
        cls,
        method: str,
        path: str,
        *,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, bytes, dict[str, str]]:
        request = urllib.request.Request(
            cls.origin + path,
            data=body,
            headers=headers or {},
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, response.read(), dict(response.headers)
        except urllib.error.HTTPError as error:
            return error.code, error.read(), dict(error.headers)

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
    def steam_token(cls, steam_id: str, linked_user_id: int | None = None) -> str:
        def encode(value: bytes) -> bytes:
            return base64.urlsafe_b64encode(value).rstrip(b"=")

        header = encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
        claims = {
            "sub": f"steam:{steam_id}",
            "jti": uuid.uuid4().hex,
            "sdr_token_type": "steam-directory",
            "steam_id": steam_id,
            "steam_appid": "3362180",
            "exp": int(time.time()) + 900,
        }
        if linked_user_id is not None:
            claims["sdr_linked_user_id"] = str(linked_user_id)
        payload = encode(json.dumps(claims, separators=(",", ":")).encode())
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

    @classmethod
    def diagnostic_upload(
        cls,
        metadata: dict[str, object],
        archive: bytes,
        token: str | None,
    ) -> tuple[int, object]:
        boundary = f"----sdr-diagnostic-{uuid.uuid4().hex}"
        parts = [
            (
                f"--{boundary}\r\n"
                'Content-Disposition: form-data; name="metadata"\r\n'
                "Content-Type: application/json\r\n\r\n"
                f"{json.dumps(metadata, separators=(',', ':'))}\r\n"
            ).encode(),
            (
                f"--{boundary}\r\n"
                'Content-Disposition: form-data; name="archive"; filename="diagnostic-log.zip"\r\n'
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
            "/api/diagnostics/logs",
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

    def test_diagnostic_logs_are_private_persisted_and_attributed(self) -> None:
        client_log_id = str(uuid.uuid4())
        metadata = {
            "clientLogId": client_log_id,
            "capturedAtUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "launcherVersion": "0.1.0-contract",
            "operatingSystem": "Windows contract",
            "processArchitecture": "X64",
            "dotnetRuntime": ".NET contract",
            "launchToken": "0123456789abcdef0123456789abcdef",
            "artifacts": ["launcher/transcript.txt", "loader/modloader.log"],
        }
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("launcher/transcript.txt", "contract transcript")
            archive.writestr("loader/modloader.log", "contract loader log")
        package_bytes = buffer.getvalue()

        status, _ = self.diagnostic_upload(metadata, package_bytes, token=None)
        self.assertEqual(status, 401)

        steam_id = "76561198000005555"
        status, receipt = self.diagnostic_upload(
            metadata,
            package_bytes,
            self.steam_token(steam_id),
        )
        self.assertEqual(status, 201, receipt)
        uuid.UUID(receipt["logId"])
        self.assertTrue(receipt["submittedAtUtc"].endswith(("Z", "+00:00")))

        database_path = Path(self.temp.name) / "sdr.db"
        with sqlite3.connect(database_path) as database:
            row = database.execute(
                """
                SELECT SubmitterUserId, SubmitterSteamId, ClientLogId,
                       LauncherVersion, LaunchToken, ArchivePath,
                       ArchiveSize, ArchiveSha256
                FROM DiagnosticLogs
                WHERE PublicId = ?
                """,
                (receipt["logId"],),
            ).fetchone()
        self.assertIsNotNone(row)
        self.assertIsNone(row[0])
        self.assertEqual(row[1], steam_id)
        self.assertEqual(row[2], client_log_id)
        self.assertEqual(row[3], metadata["launcherVersion"])
        self.assertEqual(row[4], metadata["launchToken"])
        stored_archive = Path(self.temp.name) / "diagnostic-logs" / row[5]
        self.assertEqual(stored_archive.read_bytes(), package_bytes)
        self.assertEqual(row[6], len(package_bytes))
        self.assertEqual(row[7], hashlib.sha256(package_bytes).hexdigest())

        status, duplicate = self.diagnostic_upload(
            metadata,
            package_bytes,
            self.steam_token(steam_id),
        )
        self.assertEqual(status, 200, duplicate)
        self.assertEqual(duplicate["logId"], receipt["logId"])

    def test_cloud_saves_are_zip_validated_and_require_a_current_steam_link(self) -> None:
        files = {
            "solomondark/darkdata.cfg": b"dark-data",
            "solomondark/savegames/_survival/gamestate.sav": b"game-state",
            "solomondark/savegames/_survival/Region0._cache": b"region-cache",
        }
        archive = save_package(0, "Contract Run", files)
        website_headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/zip",
        }

        status, rejected = self.request(
            "PUT",
            "/api/saves/0",
            body=archive,
            headers=website_headers,
        )
        self.assertEqual(status, 401, rejected)
        status, rejected = self.request(
            "GET",
            "/api/saves",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(status, 401, rejected)

        steam_id = "76561198000007777"
        database_path = Path(self.temp.name) / "sdr.db"
        with sqlite3.connect(database_path) as database:
            database.execute(
                "UPDATE Users SET SteamId = ? WHERE Id = ?",
                (steam_id, self.user_id),
            )
            database.commit()

        status, uploaded = self.request(
            "PUT",
            "/api/saves/0",
            body=archive,
            headers=website_headers,
        )
        self.assertEqual(status, 200, uploaded)
        self.assertEqual(uploaded["name"], "Contract Run")
        self.assertEqual(uploaded["fileCount"], len(files))
        self.assertEqual(uploaded["formatVersion"], 1)
        self.assertEqual(uploaded["uncompressedSize"], sum(map(len, files.values())))
        self.assertEqual(uploaded["sha256"], hashlib.sha256(archive).hexdigest())

        status, saves = self.request(
            "GET",
            "/api/saves",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(status, 200, saves)
        self.assertEqual([save["slot"] for save in saves], [0])

        status, downloaded, response_headers = self.request_bytes(
            "GET",
            "/api/saves/0",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(downloaded, archive)
        self.assertEqual(response_headers["Content-Type"], "application/zip")
        self.assertIn("solomon-dark-save-1.zip", response_headers["Content-Disposition"])

        linked_token = self.steam_token(steam_id, self.user_id)
        linked_archive = save_package(1, "Steam-linked Run", files)
        status, linked_upload = self.request(
            "PUT",
            "/api/saves/1",
            body=linked_archive,
            headers={
                "Authorization": f"Bearer {linked_token}",
                "Content-Type": "application/zip",
            },
        )
        self.assertEqual(status, 200, linked_upload)
        self.assertEqual(linked_upload["name"], "Steam-linked Run")

        status, _ = self.request(
            "GET",
            "/api/saves",
            headers={"Authorization": f"Bearer {self.steam_token(steam_id)}"},
        )
        self.assertEqual(status, 403)

        status, rejected = self.request(
            "GET",
            "/api/saves",
            headers={
                "Authorization": f"Bearer {self.steam_token('76561198000008888', self.user_id)}"
            },
        )
        self.assertEqual(status, 401, rejected)

        with sqlite3.connect(database_path) as database:
            database.execute("UPDATE Users SET SteamId = NULL WHERE Id = ?", (self.user_id,))
            database.commit()
        status, rejected = self.request(
            "GET",
            "/api/saves",
            headers={"Authorization": f"Bearer {linked_token}"},
        )
        self.assertEqual(status, 401, rejected)

        with sqlite3.connect(database_path) as database:
            database.execute(
                "UPDATE Users SET SteamId = ? WHERE Id = ?",
                (steam_id, self.user_id),
            )
            database.commit()

        bad_hash = save_package(
            2,
            "Bad Hash",
            {"solomondark/darkdata.cfg": b"integrity"},
        )
        with zipfile.ZipFile(io.BytesIO(bad_hash)) as source:
            manifest = json.loads(source.read("manifest.json"))
            manifest["files"][0]["sha256"] = "0" * 64
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as invalid:
            invalid.writestr("manifest.json", json.dumps(manifest))
            invalid.writestr("savegames/solomondark/darkdata.cfg", b"integrity")
        status, rejected = self.request(
            "PUT",
            "/api/saves/2",
            body=buffer.getvalue(),
            headers=website_headers,
        )
        self.assertEqual(status, 400, rejected)
        self.assertIn("integrity", rejected["error"].lower())

        traversal = save_package(
            3,
            "Traversal",
            {"solomondark/../outside.sav": b"no"},
        )
        status, rejected = self.request(
            "PUT",
            "/api/saves/3",
            body=traversal,
            headers=website_headers,
        )
        self.assertEqual(status, 400, rejected)
        self.assertIn("unsafe", rejected["error"].lower())

        unsafe_name = save_package(
            5,
            "unsafe\u0001name",
            {"solomondark/darkdata.cfg": b"no"},
        )
        status, rejected = self.request(
            "PUT",
            "/api/saves/5",
            body=unsafe_name,
            headers=website_headers,
        )
        self.assertEqual(status, 400, rejected)
        self.assertIn("manifest", rejected["error"].lower())

        status, rejected = self.request(
            "PUT",
            "/api/saves/4",
            body=archive,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/octet-stream",
            },
        )
        self.assertEqual(status, 415, rejected)

        status, _ = self.request(
            "DELETE",
            "/api/saves/0",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(status, 204)
        status, _ = self.request(
            "GET",
            "/api/saves/0",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        self.assertEqual(status, 404)
        with sqlite3.connect(database_path) as database:
            database.execute("UPDATE Users SET SteamId = NULL WHERE Id = ?", (self.user_id,))
            database.commit()

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

    def test_mod_updates_return_only_newer_semantic_versions(self) -> None:
        mod_id = "tests.update-resolution"

        def upload_version(version: str, slug: str | None = None) -> tuple[int, object]:
            manifest = {
                "id": mod_id,
                "name": "Update Resolution",
                "version": version,
                "runtime": {
                    "apiVersion": "0.2.0",
                    "entryScript": "scripts/main.lua",
                },
            }
            archive = package(
                {"scripts/main.lua": f'return "{version}"\n'.encode()},
                manifest,
            )
            return self.upload("Update Resolution", version, archive, slug=slug)

        status, created = upload_version("1.0.0")
        self.assertEqual(status, 201, created)
        slug = created["slug"]

        status, version_two = upload_version("2.0.0", slug)
        self.assertEqual(status, 201, version_two)
        expected = next(
            version
            for version in version_two["versions"]
            if version["manifestVersion"] == "2.0.0"
        )

        status, out_of_order = upload_version("1.5.0", slug)
        self.assertEqual(status, 201, out_of_order)

        status, updates = self.request(
            "POST",
            "/api/mods/updates",
            json_body={
                "mods": [
                    {"id": mod_id, "version": "1.0.0"},
                    {"id": "tests.not-published", "version": "1.0.0"},
                ]
            },
        )
        self.assertEqual(status, 200, updates)
        self.assertEqual(
            updates,
            {
                "updates": [
                    {
                        "id": mod_id,
                        "version": "2.0.0",
                        "contentSha256": expected["contentSha256"],
                        "packageSha256": expected["packageSha256"],
                        "downloadUrl": (
                            f"api/mods/{slug}/versions/{expected['id']}/download"
                        ),
                    }
                ]
            },
        )

        for installed_version in ("2.0.0", "3.0.0", "2.0.0+local"):
            status, current = self.request(
                "POST",
                "/api/mods/updates",
                json_body={"mods": [{"id": mod_id, "version": installed_version}]},
            )
            self.assertEqual(status, 200, current)
            self.assertEqual(current, {"updates": []})

        status, invalid = self.request(
            "POST",
            "/api/mods/updates",
            json_body={"mods": [{"id": mod_id, "version": "1.0"}]},
        )
        self.assertEqual(status, 400, invalid)

        status, duplicate = self.request(
            "POST",
            "/api/mods/updates",
            json_body={
                "mods": [
                    {"id": mod_id, "version": "1.0.0"},
                    {"id": mod_id.upper(), "version": "1.0.0"},
                ]
            },
        )
        self.assertEqual(status, 400, duplicate)

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

    def test_steam_session_can_unlink_its_linked_account(self) -> None:
        steam_id = "76561198000006666"
        database_path = Path(self.temp.name) / "sdr.db"
        with sqlite3.connect(database_path) as database:
            database.execute(
                "UPDATE Users SET SteamId = ? WHERE Id = ?",
                (steam_id, self.user_id),
            )
            database.commit()

        status, response = self.request(
            "DELETE",
            "/api/auth/steam",
            headers={"Authorization": f"Bearer {self.steam_token(steam_id)}"},
        )
        self.assertEqual(status, 204, response)

        with sqlite3.connect(database_path) as database:
            linked_steam_id = database.execute(
                "SELECT SteamId FROM Users WHERE Id = ?",
                (self.user_id,),
            ).fetchone()[0]
        self.assertIsNone(linked_steam_id)

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
                ALTER TABLE CloudSaves DROP COLUMN UncompressedSize;
                ALTER TABLE CloudSaves DROP COLUMN FileCount;
                ALTER TABLE CloudSaves DROP COLUMN FormatVersion;
                """
            )
        type(self).start_server()

        with sqlite3.connect(database_path) as database:
            columns = {
                table: {
                    row[1]
                    for row in database.execute(f"PRAGMA table_info({table})")
                }
                for table in ("Mods", "ModVersions", "Lobbies", "CloudSaves", "CrashReports")
            }
        self.assertIn("LauncherModId", columns["Mods"])
        self.assertTrue(
            {"ManifestVersion", "PackageSha256", "ContentSha256"}
            <= columns["ModVersions"]
        )
        self.assertIn("ActiveModsJson", columns["Lobbies"])
        self.assertTrue(
            {"UncompressedSize", "FileCount", "FormatVersion"}
            <= columns["CloudSaves"]
        )
        self.assertTrue(
            {"SubmitterUserId", "SubmitterSteamId", "SubmittedAtUtc", "ArchivePath"}
            <= columns["CrashReports"]
        )


if __name__ == "__main__":
    unittest.main()
