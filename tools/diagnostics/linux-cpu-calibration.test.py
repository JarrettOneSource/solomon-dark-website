import importlib.util
import json
import pathlib
import subprocess
import unittest

spec = importlib.util.spec_from_file_location('calibration', pathlib.Path(__file__).with_name('linux-cpu-calibration.py'))
calibration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(calibration)


class CalibrationTests(unittest.TestCase):
    def fixture(self, *, path='/private-sentinel/child', files=None, sysconf=None, affinity=None, platform='linux'):
        data = {
            '/proc/123/cgroup': '0::' + path + '\n',
            '/proc/123/mountinfo': '20 19 0:24 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n',
            '/sys/fs/cgroup/private-sentinel/child/cpu.max': '200000 100000\n',
            '/sys/fs/cgroup/private-sentinel/cpu.max': '50000 100000\n',
        }
        data.update(files or {})
        reads = []
        def read(path):
            reads.append(path)
            if path not in data or data[path] is None:
                raise FileNotFoundError()
            return data[path]
        result = calibration.calibrate(123, read=read, sysconf=sysconf or (lambda name: {'SC_CLK_TCK': 100, 'SC_NPROCESSORS_ONLN': 8}[name]), affinity=affinity or (lambda pid: {0, 2, 3, 5}), platform=platform)
        self.assertNotIn('private-sentinel', json.dumps(result))
        return result, reads

    def assert_projection_limited(self, results):
        script = """
import { readFileSync } from 'node:fs'
import { safeCpuCalibration } from './linux-launch-observer.mjs'
process.stdout.write(JSON.stringify(JSON.parse(readFileSync(0, 'utf8')).map(safeCpuCalibration)))
"""
        projected = json.loads(subprocess.run(
            ['node', '--input-type=module', '-e', script], input=json.dumps(results),
            text=True, capture_output=True, check=True, timeout=10, cwd=pathlib.Path(__file__).parent,
        ).stdout)
        self.assertEqual(len(projected), len(results))
        for original, result in zip(results, projected):
            self.assertEqual(result['driverCgroupStatus'], original['driverCgroupStatus'])
            self.assertEqual(result['status'], 'limited')
            self.assertEqual(result['driverCgroupLevels'], 0)
            self.assertIsNone(result['driverCgroupQuotaCpuCount'])
            self.assertIsNone(result['driverVisibleCpuUpperBound'])

    def test_membership_whitespace_and_controls_are_not_normalized(self):
        results = []
        for path in ['/', '/private-sentinel/child']:
            for suffix in [' ', '\t', '\r', '\v', '\f', '\x00']:
                for terminator in ['', '\n']:
                    membership = '0::' + path + suffix + terminator
                    with self.subTest(membership=membership):
                        result, reads = self.fixture(files={'/proc/123/cgroup': membership})
                        self.assertEqual(result['driverCgroupStatus'], 'malformed')
                        self.assertIsNone(result['driverCgroupQuotaCpuCount'])
                        self.assertEqual(result['driverCgroupLevels'], 0)
                        self.assertFalse(any(entry.endswith('/cpu.max') for entry in reads))
                        results.append(result)
        self.assert_projection_limited(results)

    def test_extra_blank_or_ambiguous_membership_records_are_unsupported(self):
        record = '0::/private-sentinel/child'
        results = []
        for membership in [
            '', '\n', '\n' + record + '\n', record + '\n\n', record + '\n\n\n',
            record + '\n \n', record + '\n\t\n', record + '\n' + record + '\n',
            record + '\n0::/other\n', record + '\n2:cpu,cpuacct:/other\n',
        ]:
            with self.subTest(membership=membership):
                result, reads = self.fixture(files={'/proc/123/cgroup': membership})
                self.assertEqual(result['driverCgroupStatus'], 'unsupported')
                self.assertIsNone(result['driverCgroupQuotaCpuCount'])
                self.assertEqual(result['driverCgroupLevels'], 0)
                self.assertFalse(any(entry.endswith('/cpu.max') for entry in reads))
                results.append(result)
        self.assert_projection_limited(results)

    def test_valid_root_and_nested_membership_keep_exact_quota_paths(self):
        for path, status, quota_paths in [
            ('/', 'no-visible-limit', ['/sys/fs/cgroup/cpu.max']),
            ('/private-sentinel/child', 'finite', [
                '/sys/fs/cgroup/private-sentinel/child/cpu.max',
                '/sys/fs/cgroup/private-sentinel/cpu.max', '/sys/fs/cgroup/cpu.max',
            ]),
        ]:
            for terminator in ['', '\n']:
                with self.subTest(path=path, terminator=terminator):
                    result, reads = self.fixture(files={'/proc/123/cgroup': '0::' + path + terminator})
                    self.assertEqual(result['driverCgroupStatus'], status)
                    self.assertEqual(result['driverCgroupQuotaCpuCount'], 0.5 if status == 'finite' else None)
                    self.assertEqual(result['driverCgroupLevels'], len(quota_paths))
                    self.assertEqual(reads, ['/proc/123/cgroup', '/proc/123/mountinfo', *quota_paths])

    def test_parent_quota_limits_visible_driver_allowance(self):
        result, reads = self.fixture()
        self.assertEqual(result, {
            'clockTicksPerSecond': 100, 'clockTicksStatus': 'available',
            'onlineCpuCount': 8, 'onlineCpuStatus': 'available',
            'driverAffinityCpuCount': 4, 'driverAffinityStatus': 'available',
            'driverCgroupStatus': 'finite', 'driverCgroupQuotaCpuCount': 0.5, 'driverCgroupLevels': 3,
        })
        self.assertEqual(len(reads), 5)

    def test_root_and_all_unlimited_are_disclosed_as_no_visible_limit(self):
        for path, files, levels in [('/', {}, 1), ('/private-sentinel/child', {
            '/sys/fs/cgroup/private-sentinel/child/cpu.max': 'max 100000\n',
            '/sys/fs/cgroup/private-sentinel/cpu.max': 'max 100000\n',
        }, 3)]:
            result, _ = self.fixture(path=path, files=files)
            self.assertEqual(result['driverCgroupStatus'], 'no-visible-limit')
            self.assertIsNone(result['driverCgroupQuotaCpuCount'])
            self.assertEqual(result['driverCgroupLevels'], levels)

    def test_malformed_missing_and_nonpositive_quota_fail_limited(self):
        for text in [None, '', 'bad', '0 100000', '-1 100000', 'max 0', '2 0', '1 2 3', 'nan 100000', '1e6 100000', '9007199254740992 1']:
            result, _ = self.fixture(files={'/sys/fs/cgroup/private-sentinel/cpu.max': text})
            self.assertIn(result['driverCgroupStatus'], ['unavailable', 'malformed'])
            self.assertIsNone(result['driverCgroupQuotaCpuCount'])

    def test_unsafe_ambiguous_unmounted_v1_and_hidden_roots_are_not_assumed(self):
        cases = [
            {'/proc/123/cgroup': '2:cpu,cpuacct:/private-sentinel\n'},
            {'/proc/123/cgroup': '0::/private-sentinel\n0::/other\n'},
            {'/proc/123/mountinfo': '20 19 0:24 /hidden /sys/fs/cgroup rw - cgroup2 cgroup rw\n'},
            {'/proc/123/mountinfo': 'malformed\n'},
        ]
        for files in cases:
            result, _ = self.fixture(files=files)
            self.assertIn(result['driverCgroupStatus'], ['unsupported', 'malformed'])
            self.assertIsNone(result['driverCgroupQuotaCpuCount'])
        for path in ['/../private-sentinel', '/private-sentinel/..', '//private-sentinel', '/./child', '/x/' + 'x/' * 33, '/x' * 2000]:
            result, reads = self.fixture(path=path)
            self.assertIn(result['driverCgroupStatus'], ['malformed', 'limited'])
            self.assertTrue(all('/cpu.max' not in entry for entry in reads))

    def test_platform_unknown_clock_and_empty_affinity_do_not_invent_values(self):
        result, reads = self.fixture(platform='darwin')
        self.assertEqual(result['driverCgroupStatus'], 'unsupported')
        self.assertEqual(reads, [])
        for value in [0, -1, True, '100', float('nan'), 10**15]:
            result, _ = self.fixture(sysconf=lambda name: value, affinity=lambda pid: set())
            self.assertIsNone(result['clockTicksPerSecond'])
            self.assertIsNone(result['onlineCpuCount'])
            self.assertIsNone(result['driverAffinityCpuCount'])
            self.assertEqual(result['clockTicksStatus'], 'unavailable')
        def unavailable(_):
            raise OSError('private-sentinel')
        result, _ = self.fixture(sysconf=unavailable, affinity=unavailable)
        self.assertEqual(result['driverAffinityStatus'], 'unavailable')

    def test_bounded_read_rejects_oversize_and_symlink(self):
        import tempfile
        with tempfile.TemporaryDirectory() as root:
            root = pathlib.Path(root)
            path = root / 'data'
            path.write_text('x' * (calibration.MAX_READ_BYTES + 1))
            with self.assertRaises(ValueError):
                calibration.read_bounded(str(path))
            path.write_text('max 100000\n')
            alias = root / 'alias'
            alias.symlink_to(path)
            with self.assertRaises(OSError):
                calibration.read_bounded(str(alias))


if __name__ == '__main__':
    unittest.main()
