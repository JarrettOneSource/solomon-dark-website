#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import hmac
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
import uuid
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BONEYARD_FIXTURE = ROOT / "tests" / "fixtures" / "flat_multiplayer_test.boneyard"
ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xz6rAAAAAElFTkSuQmCC"
)
ONE_FRAME_BUNDLE = bytes.fromhex(
    "00000000000000000000803f0000803f01000000010000000000803f0000803f"
    "00000000000000000000000000"
)


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
        cls.leaderboard_secret = "leaderboard-contract-secret-at-least-thirty-two-bytes"
        cls.start_supervisor_stub()
        cls.environment = os.environ.copy()
        cls.environment.update(
            {
                "ASPNETCORE_ENVIRONMENT": "Production",
                "ASPNETCORE_URLS": cls.origin,
                "Storage__Root": cls.temp.name,
                "Jwt__Secret": cls.jwt_secret,
                "GameSessions__AdminSecret": cls.leaderboard_secret,
                "GameSessions__PublicWebSocketOrigin": "wss://game.example.invalid",
                "GameSessions__SupervisorUrl": cls.supervisor_origin,
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
        server_path = ROOT / "backend/bin/Debug/net10.0/Server.dll"
        cls.server = subprocess.Popen(
            [cls.dotnet, str(server_path)],
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
    def start_supervisor_stub(cls) -> None:
        secret = cls.leaderboard_secret

        class SupervisorHandler(BaseHTTPRequestHandler):
            def reply(self, status: int, body: object) -> None:
                encoded = json.dumps(body, separators=(",", ":")).encode()
                self.send_response(status)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

            def authorized(self) -> bool:
                return self.headers.get("Authorization") == f"Bearer {secret}"

            def do_GET(self) -> None:
                if not self.authorized():
                    self.reply(401, {"error": "Unauthorized."})
                elif self.path == "/health":
                    self.reply(200, {"players": 0, "parties": 0, "runs": 0})
                elif self.path == "/admin/hub/parties":
                    self.reply(
                        200,
                        {
                            "items": [
                                {
                                    "id": "listing-safe-7",
                                    "leader": "Hagatha",
                                    "members": ["Hagatha", "Luthacus"],
                                    "memberCount": 2,
                                    "maxMembers": 16,
                                    "status": "playing",
                                    "visibility": "invite-only",
                                    "boneyardName": "The Survival Grounds",
                                }
                            ]
                        },
                    )
                elif self.path == "/admin/join/requests/request-token-01234567890123456789":
                    self.reply(200, {"status": "pending", "intentId": None, "target": None})
                else:
                    self.reply(404, {"error": "Not found."})

            def do_POST(self) -> None:
                if not self.authorized():
                    self.reply(401, {"error": "Unauthorized."})
                    return
                empty_content = {"manifestSha256": "0" * 64, "mods": []}
                if self.path == "/admin/join/resolve":
                    self.reply(
                        201,
                        {
                            "intentId": "intent-0123456789012345678901234",
                            "target": {
                                "content": empty_content,
                                "kind": "private-college",
                                "leader": "Hagatha",
                                "memberCount": 2,
                                "status": "hub",
                                "visibility": "private",
                            },
                        },
                    )
                elif self.path == "/admin/join/public":
                    self.reply(
                        201,
                        {
                            "intentId": "intent-abcdefghijklmnopqrstuvwxyz",
                            "target": {
                                "content": empty_content,
                                "kind": "global-hub",
                                "leader": "Hagatha",
                                "memberCount": 2,
                                "status": "hub",
                                "visibility": "public",
                            },
                        },
                    )
                elif self.path == "/admin/join/requests":
                    self.reply(
                        201,
                        {
                            "requestToken": "request-token-01234567890123456789",
                            "status": "pending",
                        },
                    )
                elif self.path == "/admin/join/admit":
                    self.reply(
                        201,
                        {
                            "credential": "party-ticket",
                            "path": "/game-sessions/01234567890123456789012345678901",
                            "sessionKind": "private-college",
                        },
                    )
                else:
                    self.reply(503, {"error": "Unavailable."})

            def log_message(self, _format: str, *_args: object) -> None:
                pass

        cls.supervisor = ThreadingHTTPServer(("127.0.0.1", 0), SupervisorHandler)
        supervisor_port = cls.supervisor.server_address[1]
        cls.supervisor_origin = f"http://127.0.0.1:{supervisor_port}"
        cls.supervisor_thread = threading.Thread(
            target=cls.supervisor.serve_forever,
            name="sdr-supervisor-contract-stub",
            daemon=True,
        )
        cls.supervisor_thread.start()

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
        if hasattr(cls, "supervisor"):
            cls.supervisor.shutdown()
            cls.supervisor.server_close()
            cls.supervisor_thread.join(timeout=5)
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
    def leaderboard_receipt(cls, user_id: int, entry: dict[str, object]) -> str:
        payload = {
            "version": 1,
            "userId": user_id,
            **entry,
            "completedAtUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        payload_part = base64.urlsafe_b64encode(
            json.dumps(payload, separators=(",", ":")).encode()
        ).rstrip(b"=").decode()
        signature = base64.urlsafe_b64encode(
            hmac.new(
                cls.leaderboard_secret.encode(),
                f"solomon-dark-leaderboard-v1.{payload_part}".encode(),
                hashlib.sha256,
            ).digest()
        ).rstrip(b"=").decode()
        return f"{payload_part}.{signature}"


    @classmethod
    def browser_game_diagnostic_upload(
        cls,
        report: dict[str, object],
        token: str | None = None,
        include_submission_header: bool = True,
    ) -> tuple[int, object]:
        headers = {}
        if include_submission_header:
            headers["X-Solomon-Dark-Diagnostics"] = "browser-game"
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        return cls.request(
            "POST",
            "/api/game/diagnostics",
            json_body=report,
            headers=headers,
        )

    def test_game_session_provisioning_fails_closed_when_supervisor_rejects(self) -> None:
        status, response = self.request("POST", "/api/game/sessions")
        self.assertEqual(status, 400)
        self.assertEqual(response, {"error": "The game session request is invalid."})

        status, response = self.request(
            "POST",
            "/api/game/sessions",
            headers={"X-Solomon-Dark-Session": "provision"},
        )
        self.assertEqual(status, 503)
        self.assertEqual(
            response,
            {"error": "A private game session is not available right now."},
        )

        status, response = self.request(
            "POST", "/api/game/hub",
        )
        self.assertEqual(status, 400)
        self.assertEqual(
            response,
            {"error": "The shared Hub request is invalid."},
        )

        status, response = self.request(
            "POST", "/api/game/hub",
            headers={"X-Solomon-Dark-Session": "enter-hub"},
        )
        self.assertEqual(status, 503)
        self.assertEqual(response, {"error": "The shared Hub is not available right now."})

        for method, path in (
            ("GET", "/api/game/lobbies"),
            ("POST", "/api/game/lobbies"),
            ("POST", "/api/game/lobbies/retired/join"),
        ):
            status, _ = self.request(method, path)
            self.assertEqual(status, 404)

    def test_public_party_directory_exposes_only_the_safe_supervisor_projection(self) -> None:
        status, response = self.request("GET", "/api/game/parties")
        self.assertEqual(status, 200)
        self.assertEqual(
            response,
            {
                "items": [
                    {
                        "id": "listing-safe-7",
                        "leader": "Hagatha",
                        "members": ["Hagatha", "Luthacus"],
                        "memberCount": 2,
                        "maxMembers": 16,
                        "status": "playing",
                        "visibility": "invite-only",
                        "boneyardName": "The Survival Grounds",
                    }
                ]
            },
        )
        serialized = json.dumps(response)
        for private_member in ("playerId", "invitation", "credential", "manifest"):
            self.assertNotIn(private_member, serialized)

    def test_party_join_control_plane_is_guest_capable_and_keeps_intents_in_memory(self) -> None:
        status, resolved = self.request(
            "POST",
            "/api/game/join/resolve",
            json_body={"code": "ABCD-2345"},
        )
        self.assertEqual(status, 200, resolved)
        self.assertEqual(resolved["target"]["kind"], "private-college")
        self.assertNotIn("credential", json.dumps(resolved))

        status, requested = self.request(
            "POST",
            "/api/game/join/requests",
            json_body={
                "listingId": "listing-safe-7",
                "displayName": "Guest Cassia",
                "requesterId": "guest-requester-1234",
            },
        )
        self.assertEqual(status, 200, requested)
        self.assertEqual(requested["status"], "pending")
        status, pending = self.request(
            "GET",
            f"/api/game/join/requests/{requested['requestToken']}",
        )
        self.assertEqual(status, 200, pending)
        self.assertEqual(pending["status"], "pending")

        status, admitted = self.request(
            "POST",
            "/api/game/join/admit",
            json_body={"intentId": resolved["intentId"]},
        )
        self.assertEqual(status, 201, admitted)
        self.assertEqual(admitted["sessionKind"], "private-college")
        self.assertEqual(admitted["credential"], "party-ticket")



    def test_browser_game_diagnostics_are_consent_driven_bounded_and_guest_capable(self) -> None:
        client_log_id = str(uuid.uuid4())
        captured_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        report = {
            "schemaVersion": 1,
            "clientLogId": client_log_id,
            "capturedAtUtc": captured_at,
            "protocolVersion": 21,
            "pageUrl": "https://solomondarker.com/game",
            "sessionId": "shared-hub",
            "online": False,
            "userAgent": "Contract Browser/1.0",
            "droppedEntries": 0,
            "failure": {
                "code": "connection-lost",
                "explanation": "The network connection or the game server stopped responding.",
                "technicalDetail": "WebSocket closed with code 1006.",
                "transportCode": 1006,
                "transportReason": "",
                "transportWasClean": False,
            },
            "entries": [
                {
                    "atUtc": captured_at,
                    "level": "warning",
                    "event": "browser.offline",
                    "message": "The browser reported that this device is offline.",
                    "detail": None,
                },
                {
                    "atUtc": captured_at,
                    "level": "error",
                    "event": "connection.closed",
                    "message": "The game connection closed unexpectedly.",
                    "detail": "close code 1006",
                },
            ],
        }

        status, _ = self.browser_game_diagnostic_upload(
            report,
            include_submission_header=False,
        )
        self.assertEqual(status, 400)

        invalid_label = {
            **report,
            "clientLogId": str(uuid.uuid4()),
            "sessionId": "another-hub",
        }
        status, _ = self.browser_game_diagnostic_upload(invalid_label)
        self.assertEqual(status, 400)

        status, receipt = self.browser_game_diagnostic_upload(report)
        self.assertEqual(status, 201, receipt)
        uuid.UUID(receipt["logId"])

        database_path = Path(self.temp.name) / "sdr.db"
        with closing(sqlite3.connect(database_path)) as database:
            row = database.execute(
                """
                SELECT SubmitterUserId, ClientLogId, ClientVersion,
                       LaunchToken, ArchivePath,
                       ArchiveSize, ArchiveSha256
                FROM DiagnosticLogs
                WHERE PublicId = ?
                """,
                (receipt["logId"],),
            ).fetchone()
        self.assertIsNotNone(row)
        self.assertIsNone(row[0])
        self.assertEqual(row[1], client_log_id)
        self.assertEqual(row[2], "browser-game/21")
        self.assertIsNone(row[3])

        stored_archive = Path(self.temp.name) / "diagnostic-logs" / row[4]
        with zipfile.ZipFile(stored_archive) as archive:
            self.assertEqual(archive.namelist(), ["browser/game-client.json"])
            stored_report = json.loads(archive.read("browser/game-client.json"))
        self.assertEqual(stored_report["capturedAtUtc"].replace("+00:00", "Z"), captured_at)
        stored_report["capturedAtUtc"] = captured_at
        for entry in stored_report["entries"]:
            self.assertEqual(entry["atUtc"].replace("+00:00", "Z"), captured_at)
            entry["atUtc"] = captured_at
        self.assertEqual(stored_report, report)
        self.assertEqual(row[5], stored_archive.stat().st_size)
        self.assertEqual(
            row[6],
            hashlib.sha256(stored_archive.read_bytes()).hexdigest(),
        )

        status, duplicate = self.browser_game_diagnostic_upload(report)
        self.assertEqual(status, 200, duplicate)
        self.assertEqual(duplicate["logId"], receipt["logId"])

        for session_id in (None, "01234567890123456789012345678901"):
            with self.subTest(session_id=session_id):
                sibling_report = {
                    **report,
                    "clientLogId": str(uuid.uuid4()),
                    "sessionId": session_id,
                }
                status, sibling_receipt = self.browser_game_diagnostic_upload(
                    sibling_report
                )
                self.assertEqual(status, 201, sibling_receipt)
                uuid.UUID(sibling_receipt["logId"])


    def test_browser_game_slot_is_account_owned_hashed_and_revision_conditional(self) -> None:
        document = json.dumps(
            {
                "schemaVersion": 4,
                "integrity": "global-clean",
                "mods": [],
                "modState": {},
                "summary": {
                    "character": {
                        "discipline": "arcane",
                        "displayName": "modsync",
                        "element": "ether",
                    },
                    "phase": "hub",
                    "playerId": "player-1",
                    "savedAtTick": 42,
                    "worldKind": "hub",
                },
                "simulation": {},
                "loadedBoneyard": None,
            },
            separators=(",", ":"),
        )
        auth = {"Authorization": f"Bearer {self.token}"}

        status, rejected = self.request(
            "PUT",
            "/api/game/saves/0",
            json_body={"document": document, "expectedRevision": 0},
        )
        self.assertEqual(status, 401, rejected)
        status, rejected = self.request(
            "PUT",
            "/api/game/saves/1",
            headers=auth,
            json_body={"document": document, "expectedRevision": 0},
        )
        self.assertEqual(status, 400, rejected)

        status, created = self.request(
            "PUT",
            "/api/game/saves/0",
            headers=auth,
            json_body={"document": document, "expectedRevision": 0},
        )
        self.assertEqual(status, 200, created)
        self.assertEqual(created["slot"], 0)
        self.assertEqual(created["formatVersion"], 4)
        self.assertEqual(created["revision"], 1)
        self.assertEqual(created["document"], document)
        self.assertEqual(created["size"], len(document.encode()))
        self.assertEqual(created["sha256"], hashlib.sha256(document.encode()).hexdigest())

        status, loaded = self.request("GET", "/api/game/saves/0", headers=auth)
        self.assertEqual(status, 200, loaded)
        self.assertEqual(loaded["save"], created)

        status, conflict = self.request(
            "PUT",
            "/api/game/saves/0",
            headers=auth,
            json_body={"document": document, "expectedRevision": 0},
        )
        self.assertEqual(status, 409, conflict)
        self.assertEqual(conflict["currentRevision"], 1)

        next_document = document.replace('"savedAtTick":42', '"savedAtTick":84')
        status, updated = self.request(
            "PUT",
            "/api/game/saves/0",
            headers=auth,
            json_body={"document": next_document, "expectedRevision": 1},
        )
        self.assertEqual(status, 200, updated)
        self.assertEqual(updated["revision"], 2)
        self.assertEqual(updated["document"], next_document)

        legacy = json.loads(next_document)
        legacy["schemaVersion"] = 3
        del legacy["integrity"]
        legacy_document = json.dumps(legacy, separators=(",", ":"))
        status, legacy_saved = self.request(
            "PUT",
            "/api/game/saves/0",
            headers=auth,
            json_body={"document": legacy_document, "expectedRevision": 2},
        )
        self.assertEqual(status, 200, legacy_saved)
        self.assertEqual(legacy_saved["formatVersion"], 3)
        self.assertEqual(legacy_saved["revision"], 3)

        status, conflict = self.request(
            "DELETE",
            "/api/game/saves/0?expectedRevision=2",
            headers=auth,
        )
        self.assertEqual(status, 409, conflict)
        self.assertEqual(conflict["currentRevision"], 3)
        status, empty = self.request(
            "DELETE",
            "/api/game/saves/0?expectedRevision=3",
            headers=auth,
        )
        self.assertEqual(status, 204, empty)
        status, missing = self.request("GET", "/api/game/saves/0", headers=auth)
        self.assertEqual(status, 200, missing)
        self.assertIsNone(missing["save"])

    def test_game_leaderboards_require_authoritative_receipts_and_rank_independently(self) -> None:
        status, empty = self.request("GET", "/api/game/leaderboards")
        self.assertEqual(status, 200, empty)
        self.assertEqual(empty, {"board": "awesomeness", "items": []})

        first = {
            "runId": "leaderboard-run-a",
            "wizardName": "Volusius",
            "element": "ether",
            "discipline": "arcane",
            "headingIndex": 4,
            "portraitScale": 0.925,
            "level": 1,
            "awesomeness": 91,
            "elapsedTicks": 33950,
            "wave": 1,
            "monstersKilled": 17,
            "awesomestKill": "Skeleton",
            "highestSkills": [
                {"skillId": 7, "rank": 2},
                {"skillId": 11, "rank": 1},
            ],
            "perksUsed": [3, 8],
        }
        status, rejected = self.request(
            "POST",
            "/api/game/leaderboards",
            json_body={"receipt": self.leaderboard_receipt(self.user_id, first)},
        )
        self.assertEqual(status, 401, rejected)
        status, rejected = self.request(
            "POST",
            "/api/game/leaderboards",
            headers={"Authorization": f"Bearer {self.token}"},
            json_body={"receipt": self.leaderboard_receipt(
                self.user_id,
                {**first, "headingIndex": 24},
            )},
        )
        self.assertEqual(status, 400, rejected)
        status, rejected = self.request(
            "POST",
            "/api/game/leaderboards",
            headers={"Authorization": f"Bearer {self.token}"},
            json_body={"receipt": self.leaderboard_receipt(
                self.user_id,
                {**first, "portraitScale": 0.8},
            )},
        )
        self.assertEqual(status, 400, rejected)
        status, rejected = self.request(
            "POST",
            "/api/game/leaderboards",
            headers={"Authorization": f"Bearer {self.token}"},
            json_body={
                "receipt": self.leaderboard_receipt(self.user_id, first),
                "unexpected": "not part of a Hall submission",
            },
        )
        self.assertEqual(status, 400, rejected)

        auth = {"Authorization": f"Bearer {self.token}"}
        status, forged = self.request(
            "POST",
            "/api/game/leaderboards",
            headers=auth,
            json_body=first,
        )
        self.assertEqual(status, 400, forged)
        status, created = self.request(
            "POST",
            "/api/game/leaderboards",
            headers=auth,
            json_body={"receipt": self.leaderboard_receipt(self.user_id, first)},
        )
        self.assertEqual(status, 201, created)
        self.assertEqual(created["accountUsername"], "modsync")
        self.assertEqual(created["awesomeness"], 91)
        self.assertNotIn("email", created)

        status, duplicate = self.request(
            "POST",
            "/api/game/leaderboards",
            headers=auth,
            json_body={"receipt": self.leaderboard_receipt(
                self.user_id,
                {**first, "awesomeness": 999999},
            )},
        )
        self.assertEqual(status, 200, duplicate)
        self.assertEqual(duplicate["awesomeness"], 91)

        concurrent_entry = {
            **first,
            "runId": "leaderboard-run-concurrent",
            "wizardName": "Concurrentius",
            "awesomeness": 1,
            "elapsedTicks": 1,
            "wave": 0,
            "monstersKilled": 0,
        }

        def submit_concurrently(_: int) -> tuple[int, object]:
            return self.request(
                "POST",
                "/api/game/leaderboards",
                headers=auth,
                json_body={"receipt": self.leaderboard_receipt(
                    self.user_id,
                    concurrent_entry,
                )},
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            concurrent = list(executor.map(submit_concurrently, range(2)))
        self.assertEqual(sorted(status for status, _ in concurrent), [200, 201], concurrent)
        self.assertEqual(
            {payload["runId"] for _, payload in concurrent},
            {"leaderboard-run-concurrent"},
        )

        status, registered = self.request(
            "POST",
            "/api/auth/register",
            json_body={
                "username": "leaderpeer",
                "email": "leaderpeer@example.invalid",
                "password": "correct-horse-battery-staple",
            },
        )
        self.assertEqual(status, 201, registered)
        peer_auth = {"Authorization": f"Bearer {registered['token']}"}
        peer_user_id = registered["user"]["id"]

        status, mismatched = self.request(
            "POST",
            "/api/game/leaderboards",
            headers=peer_auth,
            json_body={"receipt": self.leaderboard_receipt(self.user_id, first)},
        )
        self.assertEqual(status, 400, mismatched)

        valid_receipt = self.leaderboard_receipt(self.user_id, {
            **first,
            "runId": "leaderboard-run-tamper",
        })
        tampered_receipt = valid_receipt[:-1] + (
            "A" if valid_receipt[-1] != "A" else "B"
        )
        status, tampered = self.request(
            "POST",
            "/api/game/leaderboards",
            headers=auth,
            json_body={"receipt": tampered_receipt},
        )
        self.assertEqual(status, 400, tampered)
        peer_entries = [
            {
                **first,
                "runId": "leaderboard-run-b",
                "wizardName": "Severina",
                "awesomeness": 80,
                "elapsedTicks": 40000,
                "wave": 3,
                "monstersKilled": 10,
            },
            {
                **first,
                "runId": "leaderboard-run-c",
                "wizardName": "Cassian",
                "awesomeness": 120,
                "elapsedTicks": 30000,
                "wave": 2,
                "monstersKilled": 30,
            },
            {
                **first,
                "runId": "leaderboard-run-d",
                "wizardName": "Aurelia",
                "awesomeness": 120,
                "elapsedTicks": 100,
                "wave": 0,
                "monstersKilled": 0,
            },
        ]
        for entry in peer_entries:
            status, payload = self.request(
                "POST",
                "/api/game/leaderboards",
                headers=peer_auth,
                json_body={"receipt": self.leaderboard_receipt(peer_user_id, entry)},
            )
            self.assertEqual(status, 201, payload)

        expected_first = {
            "awesomeness": "leaderboard-run-d",
            "wave": "leaderboard-run-b",
            "kills": "leaderboard-run-c",
            "time": "leaderboard-run-b",
        }
        for board, run_id in expected_first.items():
            status, leaderboard = self.request(
                "GET",
                f"/api/game/leaderboards?board={board}",
            )
            self.assertEqual(status, 200, leaderboard)
            self.assertEqual(leaderboard["board"], board)
            self.assertEqual(leaderboard["items"][0]["rank"], 1)
            self.assertEqual(leaderboard["items"][0]["runId"], run_id)

        status, rejected = self.request(
            "GET",
            "/api/game/leaderboards?board=unknown",
        )
        self.assertEqual(status, 400, rejected)

    def test_subscriptions_are_account_owned_enabled_and_dependency_resolved(self) -> None:
        dependency_manifest = {
            "id": "tests.web-dependency",
            "name": "Web Dependency",
            "version": "1.0.0",
            "priority": 10,
            "runtime": {
                "apiVersion": "0.2.0",
                "entryScript": "scripts/main.lua",
            },
        }
        status, dependency = self.upload(
            "Web Dependency",
            "1.0.0",
            package({"scripts/main.lua": b"sd.state.set('loaded', true)\n"}, dependency_manifest),
        )
        self.assertEqual(status, 201, dependency)

        combined_manifest = {
            "id": "tests.web-combined",
            "name": "Web Combined",
            "version": "2.0.0",
            "priority": 20,
            "overlays": [
                {
                    "target": "sandbox/DarkCloud/mylevels/Contract.boneyard",
                    "source": "files/Contract.boneyard",
                    "format": "boneyard",
                }
            ],
            "runtime": {
                "apiVersion": "0.2.0",
                "entryScript": "scripts/main.lua",
            },
            "requiredMods": ["tests.web-dependency"],
        }
        status, combined = self.upload(
            "Web Combined",
            "2.0.0",
            package(
                {
                    "files/Contract.boneyard": BONEYARD_FIXTURE.read_bytes(),
                    "scripts/main.lua": b"sd.state.set('combined', true)\n",
                },
                combined_manifest,
            ),
        )
        self.assertEqual(status, 201, combined)

        authorization = {"Authorization": f"Bearer {self.token}"}
        status, subscribed = self.request(
            "PUT",
            f"/api/mods/{combined['slug']}/subscription",
            headers=authorization,
        )
        self.assertEqual(status, 201, subscribed)
        self.assertTrue(subscribed["enabled"])

        status, missing_dependency = self.request(
            "GET",
            "/api/mods/active",
            headers=authorization,
        )
        self.assertEqual(status, 409, missing_dependency)
        self.assertIn("tests.web-dependency", missing_dependency["error"])

        status, _ = self.request(
            "PUT",
            f"/api/mods/{dependency['slug']}/subscription",
            headers=authorization,
        )
        self.assertEqual(status, 201)
        status, active = self.request("GET", "/api/mods/active", headers=authorization)
        self.assertEqual(status, 200, active)
        self.assertEqual(
            [mod["id"] for mod in active["mods"]],
            ["tests.web-dependency", "tests.web-combined"],
        )
        self.assertEqual(active["mods"][0]["hasLua"], True)
        self.assertEqual(active["mods"][1]["boneyardCount"], 1)
        self.assertRegex(active["manifestSha256"], r"^[a-f0-9]{64}$")

        status, subscriptions = self.request(
            "GET",
            "/api/mods/subscriptions",
            headers=authorization,
        )
        self.assertEqual(status, 200, subscriptions)
        self.assertEqual(
            {entry["mod"]["slug"] for entry in subscriptions["items"]},
            {dependency["slug"], combined["slug"]},
        )

        status, disabled = self.request(
            "PATCH",
            f"/api/mods/{dependency['slug']}/subscription",
            headers=authorization,
            json_body={"enabled": False},
        )
        self.assertEqual(status, 200, disabled)
        self.assertFalse(disabled["enabled"])
        status, missing_dependency = self.request(
            "GET",
            "/api/mods/active",
            headers=authorization,
        )
        self.assertEqual(status, 409, missing_dependency)

        status, second = self.request(
            "POST",
            "/api/auth/register",
            json_body={
                "username": "emptycloud",
                "email": "emptycloud@example.invalid",
                "password": "correct-horse-battery-staple",
            },
        )
        self.assertEqual(status, 201, second)
        status, second_subscriptions = self.request(
            "GET",
            "/api/mods/subscriptions",
            headers={"Authorization": f"Bearer {second['token']}"},
        )
        self.assertEqual(status, 200, second_subscriptions)
        self.assertEqual(second_subscriptions["items"], [])

        status, _ = self.request(
            "DELETE",
            f"/api/mods/{combined['slug']}/subscription",
            headers=authorization,
        )
        self.assertEqual(status, 204)
        status, _ = self.request(
            "DELETE",
            f"/api/mods/{combined['slug']}/subscription",
            headers=authorization,
        )
        self.assertEqual(status, 204)

        art_manifest = {
            "id": "tests.native-art-is-retired",
            "name": "Native Art Is Retired",
            "version": "1.0.0",
            "overlays": [
                {"target": "images/Skills.png", "source": "files/Skills.png"}
            ],
        }
        status, rejected = self.upload(
            "Native Art Is Retired",
            "1.0.0",
            package({"files/Skills.png": b"not-web-art"}, art_manifest),
        )
        self.assertEqual(status, 400, rejected)
        self.assertIn("Web-port overlays", rejected["error"])

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

    def test_web_lua_api_02_consumable_package_resolves_active_assets(self) -> None:
        manifest = {
            "id": "tests.web-consumable",
            "name": "Web Consumable",
            "version": "1.0.0",
            "minimumLoaderVersion": "0.1.0-beta.29",
            "runtime": {
                "apiVersion": "0.2.0",
                "entryScript": "scripts/main.lua",
                "requiredCapabilities": [
                    "events.filters.damage",
                    "events.filters.resources",
                    "items.consumables.register",
                    "loot.register",
                    "player.resources.owner",
                    "sprites.local.read",
                    "sprites.local.register",
                    "timer.local.scheduler",
                ],
            },
        }
        status, created = self.upload(
            "Web Consumable",
            "1.0.0",
            package(
                {
                    "scripts/main.lua": b"return true\n",
                    "sprites/item.bundle": ONE_FRAME_BUNDLE,
                    "sprites/item.png": ONE_PIXEL_PNG,
                },
                manifest,
            ),
        )
        self.assertEqual(status, 201, created)
        authorization = {"Authorization": f"Bearer {self.token}"}
        status, subscribed = self.request(
            "PUT",
            f"/api/mods/{created['slug']}/subscription",
            headers=authorization,
        )
        self.assertEqual(status, 201, subscribed)
        status, active = self.request("GET", "/api/mods/active", headers=authorization)
        self.assertEqual(status, 200, active)
        resolved = next(mod for mod in active["mods"] if mod["id"] == manifest["id"])
        self.assertEqual(
            resolved["requiredCapabilities"],
            manifest["runtime"]["requiredCapabilities"],
        )
        self.assertEqual(resolved["assetCount"], 2)
        self.assertEqual(len(resolved["assets"]), 1)
        asset = resolved["assets"][0]
        self.assertEqual(asset["byteLength"], len(ONE_PIXEL_PNG))
        status, content_bytes, headers = self.request_bytes(
            "GET",
            f"/api/game/content/{asset['sha256']}",
        )
        self.assertEqual(status, 200)
        self.assertEqual(content_bytes, ONE_PIXEL_PNG)
        self.assertEqual(headers.get("Content-Type"), "image/png")
        self.assertIn("immutable", headers.get("Cache-Control", ""))

        status, sync_user = self.request(
            "POST",
            "/api/auth/register",
            json_body={
                "username": "partysync",
                "email": "partysync@example.invalid",
                "password": "correct-horse-battery-staple",
            },
        )
        self.assertEqual(status, 201, sync_user)
        sync_body = {
            "mods": [
                {
                    "id": resolved["id"],
                    "slug": resolved["slug"],
                    "version": resolved["version"],
                    "contentSha256": resolved["contentSha256"],
                }
            ]
        }
        status, _ = self.request(
            "POST",
            "/api/mods/subscriptions/sync",
            json_body=sync_body,
        )
        self.assertEqual(status, 401)
        status, synced = self.request(
            "POST",
            "/api/mods/subscriptions/sync",
            headers={"Authorization": f"Bearer {sync_user['token']}"},
            json_body=sync_body,
        )
        self.assertEqual(status, 200, synced)
        self.assertEqual(synced["enabled"], [resolved["slug"]])
        status, _ = self.request(
            "DELETE",
            f"/api/mods/{created['slug']}/subscription",
            headers=authorization,
        )
        self.assertEqual(status, 204)



    def test_z_database_schema_upgrades_existing_rows(self) -> None:
        type(self).stop_server()
        database_path = Path(self.temp.name) / "sdr.db"
        with closing(sqlite3.connect(database_path)) as database, database:
            database.executescript(
                """
                DROP INDEX IX_Mods_PackageId;
                ALTER TABLE Mods RENAME COLUMN PackageId TO LauncherModId;
                DROP INDEX IX_ModVersions_ModId_ManifestVersion_ContentSha256;
                ALTER TABLE ModVersions DROP COLUMN ManifestVersion;
                ALTER TABLE ModVersions DROP COLUMN PackageSha256;
                ALTER TABLE ModVersions DROP COLUMN ContentSha256;
                ALTER TABLE ModVersions ADD COLUMN MinimumLoaderVersion TEXT NULL;
                DROP TABLE ModSubscriptions;
                """
            )
        type(self).start_server()

        with closing(sqlite3.connect(database_path)) as database, database:
            columns = {
                table: {
                    row[1]
                    for row in database.execute(f"PRAGMA table_info({table})")
                }
                for table in (
                    "Mods",
                    "ModVersions",
                    "ModSubscriptions",
                    "GameLeaderboardEntries",
                )
            }
        self.assertIn("PackageId", columns["Mods"])
        self.assertNotIn("LauncherModId", columns["Mods"])
        self.assertTrue(
            {"ManifestVersion", "PackageSha256", "ContentSha256"}
            <= columns["ModVersions"]
        )
        self.assertNotIn("MinimumLoaderVersion", columns["ModVersions"])
        self.assertTrue(
            {"UserId", "ModId", "Enabled", "CreatedAtUtc", "UpdatedAtUtc"}
            <= columns["ModSubscriptions"]
        )
        self.assertTrue(
            {"UserId", "RunId", "Awesomeness", "Wave", "MonstersKilled", "ElapsedTicks", "PortraitScale"}
            <= columns["GameLeaderboardEntries"]
        )


if __name__ == "__main__":
    unittest.main()
