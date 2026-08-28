#!/usr/bin/env python3
from __future__ import annotations

from contextlib import closing
import json
import os
from pathlib import Path
import re
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
ELEMENT_IDS = (
    "pause",
    "diagnostics",
    "meters",
    "leftJoystick",
    "rightJoystick",
    "slot1",
    "slot2",
    "slot3",
    "slot4",
    "slot5",
    "slot6",
    "slot7",
    "slot8",
    "inventory",
    "skillbook",
    "xp",
    "healthPotion",
    "manaPotion",
)


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def layout_document() -> dict[str, object]:
    return {
        "version": 2,
        "elements": {
            element_id: {
                "rotation": 0,
                "scale": 1,
                "x": 10 + index * 4,
                "y": 15 + index * 3,
            }
            for index, element_id in enumerate(ELEMENT_IDS)
        },
    }


class MobileUiLayoutContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory(prefix="sdr-mobile-ui-layouts-")
        cls.root = Path(cls.temp.name)
        cls.webroot = cls.root / "wwwroot"
        cls.webroot.mkdir()
        (cls.webroot / "index.html").write_text(
            "<!doctype html><title>Solomon Dark</title>",
            encoding="utf-8",
        )
        cls.database = cls.root / "sdr.db"
        cls.port = free_port()
        cls.origin = f"http://127.0.0.1:{cls.port}"
        cls.dotnet = os.environ.get("SDR_DOTNET") or shutil.which("dotnet")
        if not cls.dotnet:
            raise unittest.SkipTest("dotnet is unavailable")
        cls.environment = os.environ.copy()
        cls.environment.update(
            {
                "ASPNETCORE_ENVIRONMENT": "Production",
                "ASPNETCORE_URLS": cls.origin,
                "ASPNETCORE_WEBROOT": str(cls.webroot),
                "Jwt__Secret": "mobile-layout-contract-secret-at-least-thirty-two-bytes",
                "Storage__Root": str(cls.root),
            }
        )
        cls.start_server()
        status, registered = cls.request(
            "POST",
            "/api/auth/register",
            body={
                "username": "layoutauthor",
                "email": "layoutauthor@example.invalid",
                "password": "correct-horse-battery-staple",
            },
        )
        if status != 201:
            raise RuntimeError(f"test registration failed: {status} {registered}")
        cls.token = registered["token"]
        cls.user_id = registered["user"]["id"]

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
    ) -> tuple[int, object]:
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
                payload = response.read()
                return response.status, json.loads(payload) if payload else None
        except urllib.error.HTTPError as error:
            payload = error.read()
            return error.code, json.loads(payload) if payload else None

    def test_publish_is_authenticated_strict_immutable_and_publicly_resolvable(self) -> None:
        document = layout_document()
        unauthorized, body = self.request(
            "POST",
            "/api/game/layouts",
            body={"layout": document},
        )
        self.assertEqual(unauthorized, 401, body)

        malformed = [
            {**document, "version": 1},
            {
                **document,
                "elements": {
                    key: value
                    for key, value in document["elements"].items()
                    if key != "meters"
                },
            },
            {
                **document,
                "elements": {
                    **document["elements"],
                    "extra": document["elements"]["pause"],
                },
            },
            {
                **document,
                "elements": {
                    **document["elements"],
                    "pause": {
                        **document["elements"]["pause"],
                        "scale": 3.01,
                    },
                },
            },
        ]
        auth = {"Authorization": f"Bearer {self.token}"}
        for candidate in malformed:
            status, body = self.request(
                "POST",
                "/api/game/layouts",
                body={"layout": candidate},
                headers=auth,
            )
            self.assertEqual(status, 400, body)

        first_status, first = self.request(
            "POST",
            "/api/game/layouts",
            body={"layout": document},
            headers=auth,
        )
        second_status, second = self.request(
            "POST",
            "/api/game/layouts",
            body={"layout": document},
            headers=auth,
        )
        self.assertEqual(first_status, 201, first)
        self.assertEqual(second_status, 201, second)
        self.assertRegex(first["code"], r"^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$")
        self.assertRegex(second["code"], r"^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$")
        self.assertNotEqual(first["code"], second["code"])
        self.assertEqual(first["layout"], document)
        self.assertEqual(first["author"], {"username": "layoutauthor"})

        anonymous_status, resolved = self.request(
            "GET",
            f"/api/game/layouts/{first['code'].lower()}",
        )
        self.assertEqual(anonymous_status, 200, resolved)
        self.assertEqual(resolved, first)
        missing_status, _ = self.request("GET", "/api/game/layouts/NOPE-NOPE")
        self.assertEqual(missing_status, 404)

        with closing(sqlite3.connect(self.database)) as db:
            rows = db.execute(
                "SELECT Code, AuthorId, Document FROM SharedMobileUiLayouts ORDER BY Id",
            ).fetchall()
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(re.fullmatch(r"[A-HJ-NP-Z2-9]{8}", row[0]) for row in rows))
        self.assertTrue(all(row[1] == self.user_id for row in rows))
        self.assertTrue(all(json.loads(row[2]) == document for row in rows))

        self.stop_server()
        self.start_server()
        durable_status, durable = self.request(
            "GET",
            f"/api/game/layouts/{first['code'].replace('-', '')}",
        )
        self.assertEqual(durable_status, 200, durable)
        self.assertEqual(durable, first)


if __name__ == "__main__":
    unittest.main()
