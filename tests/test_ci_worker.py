import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

OPS = Path(__file__).resolve().parents[1] / 'ops/local-ci'


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, OPS / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load('ci_runner', 'run-worker.py')
installer = load('ci_installer', 'install.py')
artifact = load('ci_artifact', 'check-linux-artifact.py')


def worker_fixture(root):
    root.mkdir()
    (root / 'current').mkdir()
    (root / 'tools/bash/bin').mkdir(parents=True)
    (root / 'tools/bash/bin/bash').symlink_to('/bin/bash')
    (root / 'config.json').write_text(json.dumps({'volume_uuid': installer.mount_information()['VolumeUUID'], 'environment': {}}))
    return root / 'current/deploy-main.sh'


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
                    'm.LEASE=pathlib.Path(sys.argv[3]); '
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
            with patch.object(runner, 'LEASE', lease):
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
            with patch.object(runner, 'LEASE', lease):
                self.assertEqual(runner.run_once(root), 7)
            self.assertFalse(lease.exists())
            status = json.loads((root / 'state/status.json').read_text())
            self.assertEqual(status['state'], 'failed')
            self.assertEqual(status['exit_code'], 7)
            self.assertEqual(len(status['tail']), 40)
            self.assertTrue(all(len(line) <= 2048 for line in status['tail']))
            self.assertLessEqual((root / 'logs/current.log').stat().st_size, 40 * 2048)


class ArtifactAdmissionTests(unittest.TestCase):
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
            header = bytearray(64)
            header[:6] = b'\x7fELF\x02\x01'
            struct.pack_into('<H', header, 18, 62)
            (root / 'libe_sqlite3.so').write_bytes(header)
            (root / 'Server.deps.json').write_text(json.dumps({'runtimeTarget': {'name': '.NETCoreApp,Version=v10.0/linux-x64'}}))
            self.assertEqual(artifact.check_release(root)['runtime'], 'linux-x64')
            (root / 'Server.deps.json').write_text(json.dumps({'runtimeTarget': {'name': '.NETCoreApp,Version=v10.0/osx-arm64'}}))
            with self.assertRaisesRegex(ValueError, 'another runtime'):
                artifact.check_release(root)
            (root / 'libe_sqlite3.so').unlink()
            with self.assertRaisesRegex(ValueError, 'missing'):
                artifact.check_release(root)

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


if __name__ == '__main__':
    unittest.main()
