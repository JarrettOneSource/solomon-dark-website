from pathlib import Path
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ParallelDeploymentRollbackTests(unittest.TestCase):
    def test_failed_candidate_restores_files_and_prior_owners_without_replacing_saves(self):
        script = (ROOT / 'ops/local-ci/deploy-runtime.sh').read_text()
        start = script.index('on_exit() {')
        handler = script[start:script.index('trap on_exit EXIT', start)]
        for root_changed in (0, 1):
            with self.subTest(root_changed=root_changed), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                paths = {name: root / name for name in ('live', 'rollback', 'backup_dir', 'units')}
                for path in paths.values():
                    path.mkdir()
                (paths['live'] / 'identity').write_text('candidate')
                (paths['rollback'] / 'identity').write_text('previous')
                old_unit, new_unit = 'solomon-dark-game.service', 'solomon-dark-rust-api.service'
                (paths['units'] / old_unit).write_text('candidate-unit')
                (paths['units'] / new_unit).write_text('new-companion-unit')
                (paths['backup_dir'] / old_unit).write_text('previous-unit')
                (paths['backup_dir'] / 'solomon-dark-revived.caddy').write_text('previous-route')
                for name, value in [('caddy_site', 'candidate-route'), ('artifact', 'upload'),
                                    ('caddy_candidate', 'candidate-route'), ('saves.db', 'newest acknowledged save')]:
                    (root / name).write_text(value)
                environment = os.environ | {name: str(path) for name, path in paths.items()}
                environment.update({name: str(root / name) for name in
                    ('stage', 'failed_release', 'artifact', 'caddy_site', 'caddy_candidate', 'service_log')})
                environment.update({'target_sha': 'a' * 40, 'rollback_needed': '1',
                                    'root_changed': str(root_changed), 'caddy_changed': '1'})
                # Service control/ownership are privileged boundaries. The actual
                # release swaps, backup restores and cleanup run on real files.
                wrappers = '''
systemctl() { printf '%s\\n' "$*" >>"$service_log"; }
journalctl() { :; }
validate_caddy() { :; }
install() {
    while [[ "$1" == -* ]]; do shift 2; done
    cp "$1" "$2"
}
'''
                owned = 'solomon-dark-game.service' if root_changed else 'solomon-dark-rust-game.service'
                api = 'solomon-dark-revived.service' if root_changed else 'solomon-dark-rust-api.service'
                program = 'set -Eeuo pipefail\n' + wrappers + handler.replace(
                    '/etc/systemd/system', str(paths['units'])) + '\n'
                program += f'unit_names=({old_unit} {new_unit})\nchanged_units=({old_unit} {new_unit})\n'
                program += f'drained_units=({owned})\nstopped_units=({owned} {api})\n'
                program += 'trap on_exit EXIT\nexit 17\n'
                result = subprocess.run(['/bin/bash', '-c', program], env=environment,
                                        capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 17, result.stderr)
                self.assertEqual((paths['live'] / 'identity').read_text(), 'previous')
                self.assertEqual((root / 'failed_release/identity').read_text(), 'candidate')
                self.assertFalse(paths['rollback'].exists())
                self.assertEqual((paths['units'] / old_unit).read_text(), 'previous-unit')
                self.assertFalse((paths['units'] / new_unit).exists())
                self.assertEqual((root / 'caddy_site').read_text(), 'previous-route')
                self.assertEqual((root / 'saves.db').read_text(), 'newest acknowledged save')
                self.assertFalse((root / 'artifact').exists())
                self.assertFalse((root / 'caddy_candidate').exists())
                actions = (root / 'service_log').read_text().splitlines()
                self.assertIn(f'restart {owned}', actions)
                self.assertIn(f'start {api}', actions)
                if not root_changed:
                    self.assertFalse(any('solomon-dark-revived.service' in action for action in actions))


if __name__ == '__main__':
    unittest.main()
