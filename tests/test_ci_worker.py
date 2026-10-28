import importlib.util
from contextlib import contextmanager
import gzip
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import unittest
import uuid
from unittest.mock import patch

OPS = Path(__file__).resolve().parents[1] / 'ops/local-ci'

# The deployment worker owns POSIX locks, process groups and native Unix jobs.
if os.name != 'posix':
    raise unittest.SkipTest('The machine-local deployment worker requires POSIX; it is covered by Linux CI.')


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, OPS / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load('ci_runner', 'run-worker.py')
installer = load('ci_installer', 'install.py')
artifact = load('ci_artifact', 'check-linux-artifact.py')
publication = load('ci_publication', 'deployment-publication.py')


def worker_fixture(root):
    root.mkdir()
    (root / 'current').mkdir()
    (root / 'tools/bash/bin').mkdir(parents=True)
    (root / 'tools/bash/bin/bash').symlink_to('/bin/bash')
    (root / 'config.json').write_text(json.dumps({'volume_uuid': installer.mount_information()['VolumeUUID'], 'environment': {}}))
    return root / 'current/deploy-main.sh'


@contextmanager
def native_job(definition):
    # launchd requires its registration on storage with real Unix ownership.
    path = Path.home() / 'Library/LaunchAgents' / (definition['Label'] + '.plist')
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise RuntimeError('test registration already exists')
    path.write_bytes(plistlib.dumps(definition))
    path.chmod(0o600)
    job = f'gui/{os.getuid()}/{definition["Label"]}'
    loaded = False
    try:
        subprocess.run(['/bin/launchctl', 'bootstrap', f'gui/{os.getuid()}', str(path)], check=True)
        loaded = True
        yield job
    finally:
        try:
            if loaded:
                subprocess.run(['/bin/launchctl', 'bootout', job], check=True)
        finally:
            path.unlink()


class ComputeOwnershipTests(unittest.TestCase):
    def test_foreign_busy_lease_is_neither_changed_nor_released(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'lease'
            first = runner.ComputeLease(path, {'owner': 'first'})
            second = runner.ComputeLease(path, {'owner': 'second'})
            self.assertTrue(first.acquire())
            before = (path / 'owner.json').read_bytes()
            self.assertFalse(second.acquire())
            second.release()
            self.assertEqual((path / 'owner.json').read_bytes(), before)
            first.release()
            self.assertFalse(path.exists())

    def test_release_refuses_a_changed_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'lease'
            lease = runner.ComputeLease(path, {'owner': 'worker'})
            self.assertTrue(lease.acquire())
            (path / 'owner.json').write_text(json.dumps({'owner': 'foreign'}))
            with self.assertRaisesRegex(RuntimeError, 'changed ownership'):
                lease.release()
            self.assertEqual(json.loads((path / 'owner.json').read_text()), {'owner': 'foreign'})

    def test_missing_installation_defers_without_creating_a_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'unmounted/solomon-cicd'
            self.assertEqual(runner.run_once(root), 0)
            self.assertFalse(root.exists())

    def test_missing_volume_defers_without_creating_a_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            volume = Path(directory) / 'absent-volume'
            with patch.object(runner, 'VOLUME', volume):
                self.assertEqual(runner.run_once(volume / 'solomon-cicd'), 0)
            self.assertFalse(volume.exists())

    def test_real_competing_process_can_acquire_only_after_owner_release(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'lease'
            lease = runner.ComputeLease(path, {'owner': 'parent'})
            self.assertTrue(lease.acquire())
            code = ('import importlib.util, pathlib, sys; '
                    's=importlib.util.spec_from_file_location("runner",sys.argv[1]); '
                    'm=importlib.util.module_from_spec(s); s.loader.exec_module(m); '
                    'x=m.ComputeLease(pathlib.Path(sys.argv[2]),{"owner":"child"}); '
                    'a=x.acquire(); x.release(); raise SystemExit(0 if a else 3)')
            command = [sys.executable, '-c', code, str(OPS / 'run-worker.py'), str(path)]
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 3)
            lease.release()
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 0)
            self.assertFalse(path.exists())


class MacInstallationTests(unittest.TestCase):
    def setUp(self):
        # Exercise real mount UUID/locks/processes on the test Mac's mounted
        # filesystem. /Volumes/Drive is the M5 deployment path, not a test input.
        self.enterContext(patch.object(installer, 'VOLUME', Path('/')))
        self.enterContext(patch.object(runner, 'VOLUME', Path('/')))

    @unittest.skipUnless(sys.platform == 'darwin', 'native volume identity')
    def test_worker_rejects_a_different_volume_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'ci'
            worker_fixture(root)
            self.assertTrue(runner.storage_ready(root))
            config = root / 'config.json'
            value = json.loads(config.read_text())
            value['volume_uuid'] = 'a-different-volume'
            config.write_text(json.dumps(value))
            self.assertFalse(runner.storage_ready(root))

    @unittest.skipUnless(sys.platform == 'darwin', 'native compiler admission')
    def test_foreign_waiting_compiler_defers_ci_until_it_finishes(self):
        import time
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'ci'
            worker = worker_fixture(root)
            marker = root / 'validation-started'
            worker.write_text('touch "$SDR_DEPLOY_ROOT/validation-started"\n')
            compiler = subprocess.Popen(['/usr/bin/clang', '-x', 'c', '-fsyntax-only', '-'],
                                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    state = subprocess.run(['/bin/ps', '-p', str(compiler.pid), '-o', 'comm='], capture_output=True, text=True)
                    if Path(state.stdout.strip()).name in ('clang', 'clang++'):
                        break
                    time.sleep(0.02)
                else:
                    self.fail('owned waiting compiler did not become ready')
                scanner = runner.active_compilers
                with patch.object(runner, 'LEASE', Path(directory) / 'lease'), patch.object(
                    runner, 'active_compilers',
                    lambda: [entry for entry in scanner() if entry['pid'] == compiler.pid],
                ):
                    self.assertEqual(runner.run_once(root), 0)
                    self.assertFalse(marker.exists(), 'CI work started alongside the compiler')
                    self.assertIsNone(compiler.poll(), 'CI touched the foreign compiler')
                    status = json.loads((root / 'state/status.json').read_text())
                    self.assertEqual(status['state'], 'deferred')
                    self.assertEqual(status['reason'], 'foreign build compiler active')
                    compiler.communicate(input=b'int main(void) { return 0; }\n', timeout=10)
                    self.assertEqual(compiler.returncode, 0)
                    self.assertEqual(runner.run_once(root), 0)
                self.assertTrue(marker.exists(), 'CI did not recover after the compiler ended')
            finally:
                if compiler.poll() is None:
                    compiler.communicate(input=b'int main(void) { return 0; }\n', timeout=10)

    @unittest.skipUnless(sys.platform == 'darwin', 'native process admission')
    def test_idle_node_server_does_not_block_ci_or_get_stopped(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'ci'
            worker = worker_fixture(root)
            marker = root / 'validation-started'
            worker.write_text('touch "$SDR_DEPLOY_ROOT/validation-started"\n')
            server = subprocess.Popen(['node', '-e', 'console.log("ready"); process.stdin.resume()'],
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                self.assertEqual(server.stdout.readline(), b'ready\n')
                scanner = runner.active_compilers
                with patch.object(runner, 'LEASE', Path(directory) / 'lease'), patch.object(
                    runner, 'active_compilers',
                    lambda: [entry for entry in scanner() if entry['pid'] == server.pid],
                ):
                    self.assertEqual(runner.run_once(root), 0)
                self.assertTrue(marker.exists())
                self.assertIsNone(server.poll(), 'CI stopped an unrelated idle server')
            finally:
                server.communicate(input=b'', timeout=10)

    @unittest.skipUnless(sys.platform == 'darwin', 'native launchd registration')
    def test_native_registration_defers_absent_entry_and_runs_when_it_returns(self):
        import time
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'absent-ci'
            definition = installer.registration_definition(root)
            label = installer.LABEL + '.test-' + uuid.uuid4().hex
            definition['Label'] = label
            with native_job(definition) as job:
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline:
                    state = subprocess.check_output(['/bin/launchctl', 'print', job], text=True)
                    if 'last exit code = 0' in state:
                        break
                    time.sleep(0.05)
                else:
                    self.fail('absent entry did not defer successfully')
                self.assertFalse(root.exists())
                (root / 'current').mkdir(parents=True)
                receipt = root / 'ran'
                (root / 'current/run-worker.py').write_text(f'from pathlib import Path\nPath({str(receipt)!r}).write_text("returned")\n')
                subprocess.run(['/bin/launchctl', 'kickstart', job], check=True)
                deadline = time.monotonic() + 10
                while not receipt.exists() and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertEqual(receipt.read_text(), 'returned')

    @unittest.skipUnless(sys.platform == 'darwin', 'native launchd ownership')
    def test_installer_preserves_an_unrelated_native_job_at_the_same_label(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'ci'
            label = installer.LABEL + '.test-' + uuid.uuid4().hex
            with native_job({'Label': label, 'ProgramArguments': ['/usr/bin/true']}) as job:
                (root / 'launchd').mkdir(parents=True)
                with patch.object(installer, 'LABEL', label), patch.object(installer.Path, 'home', return_value=Path(directory) / 'home'):
                    (root / 'launchd' / (label + '.plist')).write_bytes(plistlib.dumps(installer.registration_definition(root)))
                    with self.assertRaisesRegex(RuntimeError, 'unrelated native job'):
                        installer.refresh_scheduler(root)
                    self.assertFalse((Path.home() / 'Library/LaunchAgents' / (label + '.plist')).exists())
                state = subprocess.check_output(['/bin/launchctl', 'print', job], text=True)
                self.assertIn('/usr/bin/true', state)
                self.assertNotIn(str(root / 'current/run-worker.py'), state)

    @unittest.skipUnless(sys.platform == 'darwin', 'native macOS volume installation')
    def test_atomic_complete_versions_reconcile_and_prune(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source'
            source.mkdir()
            root = Path(directory) / 'ci'
            for name in installer.FILES:
                (source / name).write_text(name)
            self.assertTrue(installer.install_version(source, root))
            first = (root / 'current').resolve()
            scheduler = (root / 'launchd' / (installer.LABEL + '.plist')).read_bytes()
            self.assertFalse(installer.install_version(source, root))
            for index in range(3):
                (source / 'run-worker.py').write_text(f'worker{index}')
                self.assertTrue(installer.install_version(source, root))
                self.assertEqual((root / 'current/run-worker.py').read_text(), f'worker{index}')
                self.assertEqual((root / 'launchd' / (installer.LABEL + '.plist')).read_bytes(), scheduler)
            self.assertFalse(first.exists())
            self.assertEqual(len(list((root / 'versions').iterdir())), 2)
            self.assertFalse(installer.install_version(source, root))
            self.assertEqual(len(list((root / 'versions').iterdir())), 2)
            self.assertTrue((root / 'launchd' / (installer.LABEL + '.plist')).is_file())

    @unittest.skipUnless(sys.platform == 'darwin', 'native macOS deployment lock')
    def test_installation_refuses_an_active_worker_before_replacement(self):
        import fcntl
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'ci'
            (root / 'state').mkdir(parents=True)
            with (root / 'state/deploy.lock').open('a') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                with self.assertRaisesRegex(RuntimeError, 'worker is active'):
                    with installer.idle_installation(root):
                        self.fail('active installation was admitted')
            self.assertFalse((root / 'current').exists())
            with installer.idle_installation(root):
                pass

    @unittest.skipUnless(sys.platform == 'darwin', 'native macOS process lifecycle')
    def test_cancellation_terminates_owned_group_and_releases_only_its_lease(self):
        import signal
        import time
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'ci'
            worker = worker_fixture(root)
            worker.write_text('echo $$ > "$SDR_DEPLOY_ROOT/child.pid"\ntrap "exit 0" TERM\nsleep 300 &\necho $! > "$SDR_DEPLOY_ROOT/grandchild.pid"\nwait\n')
            lease = Path(directory) / 'lease'
            code = ('import importlib.util,pathlib,sys; '
                    's=importlib.util.spec_from_file_location("runner",sys.argv[1]); '
                    'm=importlib.util.module_from_spec(s);s.loader.exec_module(m); '
                    'm.VOLUME=pathlib.Path("/"); '
                    'm.LEASE=pathlib.Path(sys.argv[3]); '
                    'm.active_compilers=lambda: []; '
                    'raise SystemExit(m.run_once(pathlib.Path(sys.argv[2])))')
            child = subprocess.Popen([sys.executable, '-c', code, str(OPS / 'run-worker.py'), str(root), str(lease)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                end = time.monotonic() + 10
                while not (root / 'grandchild.pid').exists() and child.poll() is None and time.monotonic() < end:
                    time.sleep(0.02)
                self.assertTrue((root / 'grandchild.pid').exists())
                child.send_signal(signal.SIGTERM)
                output, errors = child.communicate(timeout=10)
                self.assertEqual(child.returncode, 143, errors.decode())
                self.assertFalse(lease.exists())
                status = json.loads((root / 'state/status.json').read_text())
                self.assertEqual(status['state'], 'cancelled')
                self.assertEqual(status['exit_code'], 143)
                grandchild = int((root / 'grandchild.pid').read_text())
                result = subprocess.run(['/bin/ps', '-p', str(grandchild), '-o', 'stat='], capture_output=True, text=True)
                self.assertTrue(not result.stdout.strip() or result.stdout.strip().startswith('Z'), result.stdout)
                self.assertFalse(runner.group_active(int((root / 'child.pid').read_text())))
            finally:
                if child.poll() is None:
                    child.kill()
                    child.communicate()

    @unittest.skipUnless(sys.platform == 'darwin', 'native macOS process lifecycle')
    def test_success_stops_remaining_descendants_before_releasing_compute(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'ci'
            worker = worker_fixture(root)
            worker.write_text('sleep 300 &\necho $$ > "$SDR_DEPLOY_ROOT/group.pid"\nexit 0\n')
            lease = Path(directory) / 'lease'
            with patch.object(runner, 'LEASE', lease), patch.object(runner, 'active_compilers', return_value=[]):
                self.assertEqual(runner.run_once(root), 0)
            self.assertFalse(runner.group_active(int((root / 'group.pid').read_text())))
            self.assertFalse(lease.exists())
            self.assertFalse((root / 'logs/current.log').exists())
            self.assertEqual(json.loads((root / 'state/status.json').read_text())['state'], 'success')

    @unittest.skipUnless(sys.platform == 'darwin', 'native macOS failure lifecycle')
    def test_failed_worker_releases_compute_and_retains_bounded_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'ci'
            worker = worker_fixture(root)
            worker.write_text('for ((i=0;i<100;i++)); do printf "%3000s\\n" error; done\nexit 7\n')
            lease = Path(directory) / 'lease'
            with patch.object(runner, 'LEASE', lease), patch.object(runner, 'active_compilers', return_value=[]):
                self.assertEqual(runner.run_once(root), 7)
            self.assertFalse(lease.exists())
            status = json.loads((root / 'state/status.json').read_text())
            self.assertEqual(status['state'], 'failed')
            self.assertEqual(status['exit_code'], 7)
            self.assertEqual(len(status['tail']), 40)
            self.assertTrue(all(len(line) <= 2048 for line in status['tail']))
            self.assertLessEqual((root / 'logs/current.log').stat().st_size, 40 * 2048)


@unittest.skipUnless(sys.platform == 'linux', 'the deployed service executable is owned by Linux procfs')
class CaddyValidationTests(unittest.TestCase):
    def test_validation_uses_the_live_service_executable_and_preserves_failure(self):
        script = (OPS / 'deploy-runtime.sh').read_text()
        start = script.index('validate_caddy() {')
        helper = script[start:script.index('request_game_restart() {', start)]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            # The running Python process supplies a real procfs executable. Its
            # validation command models the service CLI and reads the real file.
            (root / 'validate').write_text(
                'from pathlib import Path\nimport sys\n'
                'assert sys.argv[1] == "--config"\n'
                'raise SystemExit(0 if Path(sys.argv[2]).read_text() == "valid" else 7)\n')
            retired = root / 'caddy'
            retired.write_text('#!/bin/sh\nprintf used > retired-used\nexit 0\n')
            retired.chmod(0o755)
            config = root / 'Caddyfile'
            child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
            try:
                for contents, expected in [('valid', 0), ('invalid', 7)]:
                    with self.subTest(contents=contents):
                        config.write_text(contents)
                        command = ('set -Eeuo pipefail\n'
                                   'systemctl() { printf "%s\\n" "$test_service_pid"; }\n'
                                   + helper + '\nvalidate_caddy --config "$candidate"\n')
                        result = subprocess.run(['/bin/bash', '-c', command], cwd=root,
                            env=os.environ | {'PATH': str(root) + os.pathsep + os.environ['PATH'],
                                              'test_service_pid': str(child.pid), 'candidate': str(config)},
                            capture_output=True, text=True, timeout=10)
                        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
                        self.assertFalse((root / 'retired-used').exists())
            finally:
                child.terminate()
                child.wait(timeout=10)


class DeploymentPublicationTests(unittest.TestCase):
    def helpers(self):
        script = (OPS / 'deploy-runtime.sh').read_text()
        start = script.index('request_game_restart() {')
        return script[start:script.index('preflight_units() {', start)]

    def test_website_publication_changes_without_mutating_immutable_game_members(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            publication = root / 'deployment.json'
            game = root / 'game'
            game.mkdir()
            (game / 'deployment.json').write_text(json.dumps({'revision': 'a' * 40}))
            immutable = (game / 'deployment.json').read_bytes()
            environment = os.environ | {'target_sha': 'b' * 40, 'target_game_revision': 'a' * 40,
                                        'deployment_id': 'ce' * 16, 'deployment_sequence': '7',
                                        'publication_tool': str(OPS / 'deployment-publication.py'),
                                        'publication': str(publication)}
            for state in ('pending', 'ready'):
                result = subprocess.run(['/bin/bash', '-c', 'set -Eeuo pipefail\n' + self.helpers()
                    + f'write_deployment_publication "$publication" {state} "$target_game_revision"\n'],
                    env=environment, capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(publication.read_text()), {
                    'revision': 'b' * 40, 'gameRevision': 'a' * 40,
                    'deploymentId': 'ce' * 16, 'deploymentSequence': 7, 'ready': state == 'ready',
                })
                self.assertEqual(publication.stat().st_mode & 0o777, 0o644)
                self.assertEqual((game / 'deployment.json').read_bytes(), immutable)
                self.assertEqual(list(root.glob('.deployment-*')), [])

    def test_failed_and_missed_cutovers_keep_monotonic_healthy_publication_order(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'deployment.json'
            legacy = json.dumps({'revision': 'a' * 40})
            path.write_text(legacy)
            self.assertEqual(publication.next_sequence(path), 1)
            publication.write(path, 'pending', 'b' * 40, 'c' * 40, 'ce' * 16, 1)
            self.assertFalse(publication.is_ready(path, 'b' * 40, 'c' * 40),
                             'matching release hashes cannot skip a pending publication')
            # A failed candidate restores the actual prior live publication.
            path.write_text(legacy)
            self.assertEqual(publication.next_sequence(path), 1)
            publication.write(path, 'ready', 'b' * 40, 'c' * 40, 'df' * 16, 1)
            self.assertTrue(publication.is_ready(path, 'b' * 40, 'c' * 40))
            self.assertEqual(publication.next_sequence(path), 2)
            publication.write(path, 'ready', 'd' * 40, 'c' * 40, 'ab' * 16, 2)
            self.assertTrue(publication.is_ready(path, 'd' * 40, 'c' * 40))
            self.assertFalse(publication.is_ready(path, 'd' * 40, 'e' * 40))
            self.assertEqual(publication.next_sequence(path), 3)

    def test_both_parallel_publications_must_identify_one_healthy_transaction(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            primary, companion = root / 'wwwroot/deployment.json', root / 'RustSite/deployment.json'
            primary.parent.mkdir()
            companion.parent.mkdir()
            website, rust = 'a' * 40, 'b' * 40
            publication.write(primary, 'ready', website, website, 'ce' * 16, 4)
            publication.write(companion, 'pending', website, rust, 'ce' * 16, 4)
            self.assertFalse(publication.parallel_ready(root, website, rust))
            publication.write(companion, 'ready', website, rust, 'df' * 16, 4)
            self.assertFalse(publication.parallel_ready(root, website, rust))
            publication.write(companion, 'ready', website, rust, 'ce' * 16, 4)
            self.assertTrue(publication.parallel_ready(root, website, rust))
            publication.write(primary, 'ready', website, rust, 'ce' * 16, 4)
            self.assertFalse(publication.parallel_ready(root, website, rust))

    def test_drain_binds_publication_and_only_changed_game_can_migrate_legacy_clients(self):
        scenarios = [
            (2, True, None, True), (2, False, None, True),
            (None, False, None, True), (None, True, None, False),
            (2, True, 'wrong-publication', False),
        ]
        for protocol, same_game, returned_id, accepted in scenarios:
            with self.subTest(protocol=protocol, same_game=same_game, returned_id=returned_id):
                requests = []
                publication = 'ce' * 16

                class Handler(BaseHTTPRequestHandler):
                    def log_message(self, *_args):
                        pass

                    def do_GET(self):
                        payload = {'status': 'ok', 'draining': False}
                        if protocol is not None:
                            payload['deploymentProtocol'] = protocol
                        self.send_response(200)
                        self.end_headers()
                        self.wfile.write(json.dumps(payload).encode())

                    def do_POST(self):
                        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                        requests.append((dict(self.headers), body))
                        payload = {'status': 'ready', 'targetRevision': body['targetRevision'],
                                   'players': 1, 'savedPlayers': 1, 'unacknowledgedPlayers': 0}
                        if protocol == 2:
                            payload['deploymentId'] = returned_id or publication
                            payload['deploymentSequence'] = 7
                        self.send_response(200)
                        self.end_headers()
                        self.wfile.write(json.dumps(payload).encode())

                server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
                worker = threading.Thread(target=server.serve_forever)
                worker.start()
                try:
                    with tempfile.TemporaryDirectory() as directory:
                        secret = Path(directory) / 'game.env'
                        secret.write_text('SDR_GAME_SUPERVISOR_SECRET=owned-test-secret\n')
                        environment = os.environ | {
                            'game_env': str(secret), 'deployment_id': publication, 'deployment_sequence': '7',
                            'game_supervisor_url': f'http://127.0.0.1:{server.server_port}',
                            'current_game_revision': 'a' * 40,
                            'target_game_revision': ('a' if same_game else 'b') * 40,
                        }
                        result = subprocess.run(['/bin/bash', '-c', 'set -Eeuo pipefail\n'
                            + self.helpers() + 'drain_target_revision=$target_game_revision\ndrain_unit=fixture.service\nrequest_game_restart\n'],
                            env=environment, capture_output=True, text=True, timeout=10)
                        self.assertEqual(result.returncode == 0, accepted, result.stdout + result.stderr)
                        if protocol is None and same_game:
                            self.assertEqual(requests, [], 'legacy unchanged-game drain must fail before saving/closing')
                        else:
                            self.assertEqual(len(requests), 1)
                            headers, body = requests[0]
                            self.assertEqual(headers['X-Solomon-Deployment-Id'], publication)
                            self.assertEqual(headers['X-Solomon-Deployment-Sequence'], '7')
                            self.assertEqual(headers['Authorization'], 'Bearer owned-test-secret')
                            self.assertEqual(body, {'targetRevision': environment['target_game_revision']})
                finally:
                    server.shutdown()
                    worker.join()
                    server.server_close()


class ArtifactAdmissionTests(unittest.TestCase):
    def release(self, root):
        header = bytearray(64)
        header[:6] = b'\x7fELF\x02\x01'
        struct.pack_into('<H', header, 18, 62)
        revision = 'a' * 40
        (root / 'GameHost').mkdir()
        (root / 'wwwroot/game-rust').mkdir(parents=True)
        (root / 'libe_sqlite3.so').write_bytes(header)
        (root / 'GameHost/solomon-darker').write_bytes(header)
        (root / 'Server.deps.json').write_text(json.dumps({
            'runtimeTarget': {'name': '.NETCoreApp,Version=v10.0/linux-x64'}}))
        (root / 'wwwroot/game-rust/deployment.json').write_text(json.dumps({'revision': revision}))
        (root / 'GameHost/release.env').write_text(
            f'SDR_GAME_REVISION={revision}\n'
            'SDR_GAME_ASSET_DIRECTORY=/opt/solomon-dark-revived/wwwroot/game-rust\n'
            'SDR_GAME_SUPERVISOR_PORT=5232\n'
            'SDR_GAME_ML_BOT_CHECKPOINT=/opt/solomon-dark-revived/wwwroot/game-rust/assets/native/ml-bot-policy-v7-selected.sdml\n')
        (root / 'game-artifact.json').write_text(json.dumps({
            'schemaVersion': 1, 'revision': revision, 'target': 'x86_64-unknown-linux-gnu',
            'files': {'bin/solomon-darker': hashlib.sha256(header).hexdigest(),
                      'client/deployment.json': hashlib.sha256(
                          (root / 'wwwroot/game-rust/deployment.json').read_bytes()).hexdigest()}}))

        self.add_source_provenance(root)

    def add_source_provenance(self, root):
        source = (root / 'game-artifact.json').read_bytes()
        (root / 'game-source-artifact.json').write_bytes(source)
        mounted = json.loads(source)
        mounted['remountedFrom'] = {
            'manifestSha256': hashlib.sha256(source).hexdigest(),
            'gameMount': '/game', 'websiteMount': '',
        }
        (root / 'game-artifact.json').write_text(json.dumps(mounted))

    def test_remount_keeps_original_executable_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.release(root)
            host = root / 'GameHost/solomon-darker'
            host.write_bytes(host.read_bytes() + b'changed')
            manifest = json.loads((root / 'game-artifact.json').read_text())
            manifest['files']['bin/solomon-darker'] = hashlib.sha256(host.read_bytes()).hexdigest()
            (root / 'game-artifact.json').write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, 'unchanged'):
                artifact.check_release(root)

    def test_installer_rejects_a_root_that_escapes_the_external_volume(self):
        root = installer.VOLUME / '..' / 'unowned-ci-root'
        with self.assertRaisesRegex(RuntimeError, 'must live on its external volume'):
            installer.install_version(OPS, root)

    def test_only_linux_x64_native_bytes_are_admitted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'node'
            header = bytearray(64)
            header[:6] = b'\x7fELF\x02\x01'
            struct.pack_into('<H', header, 18, 62)
            path.write_bytes(header)
            artifact.require_linux_x64(path)
            struct.pack_into('<H', header, 18, 183)
            path.write_bytes(header)
            with self.assertRaisesRegex(ValueError, 'x86-64'):
                artifact.require_linux_x64(path)
            path.write_bytes(b'\xcf\xfa\xed\xfe' + bytes(60))
            with self.assertRaisesRegex(ValueError, 'ELF64'):
                artifact.require_linux_x64(path)

    def test_managed_release_target_and_required_sqlite_are_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.release(root)
            self.assertEqual(artifact.check_release(root)['runtime'], 'linux-x64')
            (root / 'Server.deps.json').write_text(json.dumps({'runtimeTarget': {'name': '.NETCoreApp,Version=v10.0/osx-arm64'}}))
            with self.assertRaisesRegex(ValueError, 'another runtime'):
                artifact.check_release(root)
            (root / 'libe_sqlite3.so').unlink()
            with self.assertRaisesRegex(ValueError, 'missing'):
                artifact.check_release(root)

    def test_published_native_client_membership_and_service_revision_must_match(self):
        for changed in ['host', 'client', 'unlisted', 'environment', 'target']:
            with self.subTest(changed=changed), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                self.release(root)
                if changed == 'host':
                    with (root / 'GameHost/solomon-darker').open('ab') as native:
                        native.write(b'changed native')
                elif changed == 'client':
                    (root / 'wwwroot/game-rust/deployment.json').write_text('{}')
                elif changed == 'unlisted':
                    (root / 'wwwroot/game-rust/old-game.js').write_text('obsolete')
                elif changed == 'environment':
                    (root / 'GameHost/release.env').write_text('SDR_GAME_REVISION=' + 'b' * 40)
                else:
                    path = root / 'game-artifact.json'
                    manifest = json.loads(path.read_text())
                    manifest['target'] = 'aarch64-apple-darwin'
                    path.write_text(json.dumps(manifest))
                with self.assertRaises(ValueError):
                    artifact.check_release(root)

    def test_linux_publish_preserves_opaque_game_and_site_compression(self):
        dotnet = os.environ.get('SDR_DOTNET') or shutil.which('dotnet')
        if not dotnet:
            self.skipTest('dotnet is unavailable')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / 'reference'
            reference.mkdir()
            self.release(reference)
            project = root / 'backend'
            shutil.copytree(OPS.parents[1] / 'backend', project,
                            ignore=shutil.ignore_patterns('bin', 'obj', 'wwwroot'))
            game = project / 'wwwroot/game-rust'
            shutil.copytree(reference / 'wwwroot/game-rust', game)
            (game / 'client.js').write_bytes(b'// immutable client bytes\n' * 512)
            site = b'// Website asset retains ordinary SDK compression\n' * 512
            (project / 'wwwroot/site.js').write_bytes(site)
            manifest = json.loads((reference / 'game-artifact.json').read_text())
            manifest['files']['client/client.js'] = hashlib.sha256((game / 'client.js').read_bytes()).hexdigest()
            publish = root / 'publish'
            result = subprocess.run([
                dotnet, 'publish', str(project / 'Server.csproj'), '--configuration', 'Release',
                '--runtime', 'linux-x64', '--self-contained', 'false', '-p:UseAppHost=false',
                '--output', str(publish), '--nologo', '--verbosity', 'quiet',
            ], cwd=OPS.parents[1], capture_output=True, text=True, timeout=120)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            shutil.copytree(reference / 'GameHost', publish / 'GameHost', dirs_exist_ok=True)
            (publish / 'game-artifact.json').write_text(json.dumps(manifest))
            self.add_source_provenance(publish)
            self.assertEqual(artifact.check_release(publish)['runtime'], 'linux-x64')
            self.assertTrue(any(gzip.decompress(path.read_bytes()) == site
                                for path in (publish / 'wwwroot').glob('*.gz')),
                            'the game exclusion must retain normal Website compression')

    def test_each_required_installed_component_changes_version_admission(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            for filename in installer.FILES:
                (source / filename).write_text(filename)
            original = installer.component_digest(source)
            for filename in installer.FILES:
                before = (source / filename).read_text()
                (source / filename).write_text(before + '\nchanged')
                self.assertNotEqual(installer.component_digest(source), original, filename)
                (source / filename).write_text(before)
            self.assertEqual(installer.component_digest(source), original)

    @unittest.skipUnless(shutil.which('systemd-analyze'), 'native systemd verification')
    def test_staged_service_preflight_checks_candidate_before_first_cutover(self):
        script = (OPS / 'deploy-runtime.sh').read_text()
        start = script.index('preflight_units() {')
        preflight = script[start:script.index('wait_game() {', start)] + '\npreflight_units\n'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            live, stage, temporary = [root / name for name in ('live', 'stage', 'temporary')]
            (live / 'GameHost').mkdir(parents=True)
            (live / 'GameHost/old-host.mjs').write_text('// prior release\n')
            (stage / 'Deploy').mkdir(parents=True)
            (stage / 'GameHost').mkdir()
            (stage / 'bin').mkdir()
            for executable in ('node', 'dotnet'):
                path = stage / 'bin' / executable
                path.write_text('#!/bin/sh\nexit 0\n')
                path.chmod(0o755)
            temporary.mkdir()
            names = ('solomon-dark-game.service', 'solomon-dark-rust-game.service', 'solomon-dark-rust-api.service')
            host = stage / 'GameHost/solomon-darker'
            canonical = {}
            for name in names:
                canonical[name] = (OPS.parent / 'nfo' / name).read_text().replace(
                    '/opt/solomon-dark-revived', str(live)).replace(
                    '/opt/solomon-dark-node-v22.17.0/bin/node', str(live / 'bin/node')).replace(
                    '/usr/bin/dotnet', str(live / 'bin/dotnet'))
            for case in ('valid', 'missing-host', 'non-executable-host', 'invalid-unit', 'wrong-hash'):
                with self.subTest(case=case):
                    host.write_text('#!/bin/sh\nexit 0\n')
                    host.chmod(0o644 if case == 'non-executable-host' else 0o755)
                    if case == 'missing-host':
                        host.unlink()
                    before = []
                    for name in names:
                        contents = canonical[name]
                        if case == 'invalid-unit' and name == 'solomon-dark-rust-game.service':
                            contents = contents.replace(f'ExecStart={live}/GameHost/solomon-darker', 'ExecStart=relative/solomon-darker')
                        (stage / 'Deploy' / name).write_text(contents)
                        before.append(contents.encode())
                    digest = hashlib.sha256(b''.join(before)).hexdigest()
                    environment = os.environ | {
                        'stage': str(stage), 'live': str(live), 'TMPDIR': str(temporary),
                        'expected_game_unit_checksum': '0' * 64 if case == 'wrong-hash' else digest,
                    }
                    result = subprocess.run(['/bin/bash', '-c', 'set -Eeuo pipefail\n' + preflight],
                                            env=environment, capture_output=True, text=True, timeout=20)
                    if case == 'valid':
                        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    else:
                        self.assertNotEqual(result.returncode, 0, case)
                    self.assertEqual([(stage / 'Deploy' / name).read_bytes() for name in names], before)
                    self.assertEqual(list(temporary.iterdir()), [])



if __name__ == '__main__':
    unittest.main()
