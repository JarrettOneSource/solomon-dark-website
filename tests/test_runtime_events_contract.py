#!/usr/bin/env python3
from __future__ import annotations

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
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


class RuntimeEventContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory(prefix="sdr-runtime-events-")
        cls.root = Path(cls.temp.name)
        cls.webroot = cls.root / "wwwroot"
        cls.webroot.mkdir()
        (cls.webroot / "index.html").write_text("<!doctype html><title>Solomon Dark</title>")
        cls.port = free_port()
        cls.origin = f"http://127.0.0.1:{cls.port}"
        cls.secret = "runtime-event-contract-secret-that-is-long-enough"
        cls.database = cls.root / "sdr.db"
        cls.dotnet = os.environ.get("SDR_DOTNET") or shutil.which("dotnet")
        if not cls.dotnet:
            raise unittest.SkipTest("dotnet is unavailable")
        cls.environment = os.environ.copy()
        cls.environment.update(
            {
                "ASPNETCORE_ENVIRONMENT": "Production",
                "ASPNETCORE_URLS": cls.origin,
                "ASPNETCORE_WEBROOT": str(cls.webroot),
                "Jwt__Secret": "runtime-event-jwt-secret-at-least-thirty-two-bytes",
                "RuntimeEvents__Secret": cls.secret,
                "Storage__Root": str(cls.root),
            }
        )
        cls.start_server()

    @classmethod
    def start_server(cls) -> None:
        server_path = ROOT / "backend/bin/Release/net10.0/Server.dll"
        if not server_path.exists():
            raise RuntimeError(f"release server is missing: {server_path}")
        cls.server = subprocess.Popen(
            [cls.dotnet, str(server_path)],
            cwd=ROOT,
            env=cls.environment,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if cls.server.poll() is not None:
                output = cls.server.stdout.read() if cls.server.stdout else ""
                raise RuntimeError(f"website exited during startup:\n{output}")
            try:
                if cls.request("GET", "/api/stats")[0] == 200:
                    return
            except OSError:
                pass
            time.sleep(0.1)
        cls.stop_server()
        raise RuntimeError("website did not start within 30 seconds")

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
        if hasattr(cls, "server") and cls.server.poll() is None:
            cls.stop_server()
        cls.temp.cleanup()

    @classmethod
    def request(
        cls,
        method: str,
        path: str,
        *,
        body: object | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, bytes]:
        request_headers = dict(headers or {})
        encoded = None
        if body is not None:
            encoded = json.dumps(body, separators=(",", ":")).encode()
            request_headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            cls.origin + path,
            data=encoded,
            headers=request_headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def test_runtime_event_outbox_is_private_detailed_and_bounded(self) -> None:
        occurred = datetime.now(timezone.utc).isoformat()
        event = {
            "schemaVersion": 1,
            "component": "game-host",
            "event": "wave.started",
            "message": "A Boneyard wave started.",
            "occurredAtUtc": occurred,
            "details": {
                "boneyardName": "The Survival Grounds",
                "displayName": "Helvidius",
                "runId": "run-contract",
                "wave": 3,
            },
        }
        unauthorized, _ = self.request("POST", "/api/internal/runtime-events", body=event)
        self.assertEqual(unauthorized, 404)
        accepted, _ = self.request(
            "POST",
            "/api/internal/runtime-events",
            body=event,
            headers={"Authorization": f"Bearer {self.secret}"},
        )
        self.assertEqual(accepted, 202)

        document, _ = self.request(
            "GET",
            "/game",
            headers={
                "Accept": "text/html",
                "Accept-Language": "en-US",
                "Sec-Fetch-Dest": "document",
                "User-Agent": "RuntimeEventContractBrowser/1.0",
                "X-Forwarded-For": "203.0.113.45",
            },
        )
        self.assertEqual(document, 200)
        self.assertEqual(self.request("GET", "/api/stats")[0], 200)

        deadline = time.monotonic() + 5
        rows = []
        while time.monotonic() < deadline:
            with closing(sqlite3.connect(self.database)) as db:
                rows = db.execute(
                    """
                    SELECT Id, Source, Component, EventName, Message, DetailsJson,
                           OccurredAtUtc, ExpiresAtUtc
                    FROM RuntimeEvents ORDER BY Id
                    """
                ).fetchall()
            if len(rows) == 1:
                break
            time.sleep(0.05)
        self.assertEqual([row[3] for row in rows], ["wave.started"])
        game_details = json.loads(rows[0][5])
        self.assertEqual(game_details["displayName"], "Helvidius")
        self.assertEqual(game_details["wave"], 3)
        occurred_at = datetime.fromisoformat(rows[0][6]).replace(tzinfo=timezone.utc)
        expires_at = datetime.fromisoformat(rows[0][7]).replace(tzinfo=timezone.utc)
        self.assertAlmostEqual((expires_at - occurred_at).total_seconds(), 30 * 60, delta=1)

        self.stop_server()
        with closing(sqlite3.connect(self.database)) as db:
            db.execute(
                "UPDATE RuntimeEvents SET ExpiresAtUtc = ? WHERE Id = ?",
                ("2000-01-01 00:00:00", rows[0][0]),
            )
            db.executemany(
                """
                INSERT INTO RuntimeEvents
                    (Source, Component, EventName, Message, DetailsJson,
                     OccurredAtUtc, ExpiresAtUtc)
                VALUES ('contract', 'test', 'test.event', 'test', '{}', ?, ?)
                """,
                [
                    ("2026-08-23 12:00:00", "2099-01-01 00:00:00")
                    for _ in range(2_005)
                ],
            )
            db.commit()
        self.start_server()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            with closing(sqlite3.connect(self.database)) as db:
                count = db.execute("SELECT COUNT(*) FROM RuntimeEvents").fetchone()[0]
                expired = db.execute(
                    "SELECT COUNT(*) FROM RuntimeEvents WHERE ExpiresAtUtc <= ?",
                    ("2000-01-01 00:00:00",),
                ).fetchone()[0]
            if count <= 2_000 and expired == 0:
                break
            time.sleep(0.1)
        self.assertLessEqual(count, 2_000)
        self.assertEqual(expired, 0)


if __name__ == "__main__":
    unittest.main()
