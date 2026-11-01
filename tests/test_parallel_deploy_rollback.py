from pathlib import Path
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import subprocess
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ParallelCaddyDeploymentTests(unittest.TestCase):
    def test_route_changes_observe_both_save_barriers_and_unchanged_routes_do_not_restart_pixi(self):
        script = (ROOT / 'ops/local-ci/deploy-runtime.sh').read_text()
        helpers = script[script.index('request_game_restart() {'):script.index('preflight_units() {')]
        install_caddy = script[script.index('install_caddy_config() {'):script.index('on_exit() {')]
        # Exercise the real cutover policy after immutable artifact/unit preflight.
        policy = script[script.index('current_sha='):script.index('# The backup includes final saves')]
        scenarios = [
            ('identical-release', False, False, False, [], True),
            ('same-revision-route-drift', False, True, False, [], False),
            ('website-route-change', True, True, False, ['pixi', 'rust'], True),
            ('rust-only-release', False, False, True, ['rust'], True),
        ]
        for name, website_changed, route_changed, rust_changed, expected_saves, succeeds in scenarios:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                live, stage, units, backup = [root / part for part in ('live', 'stage', 'units', 'backup')]
                for path in (live / 'wwwroot', live / 'RustSite', live / 'GameHost/Pixi',
                             stage / 'wwwroot', stage / 'RustSite', stage / 'Deploy/M5Worker', units, backup):
                    path.mkdir(parents=True, exist_ok=True)
                current_website, current_rust = 'a' * 40, 'b' * 40
                target_website = 'c' * 40 if website_changed else current_website
                target_rust = 'd' * 40 if rust_changed else current_rust
                publication_id, sequence = 'ce' * 16, 8
                (live / 'DEPLOYED_GIT_SHA').write_text(current_website)
                (live / 'GameHost/Pixi/release.env').touch()
                (live / 'game-artifact.json').write_text(json.dumps({'revision': current_rust}))
                game_source = json.dumps({'revision': current_rust}).encode()
                (live / 'game-source-artifact.json').write_bytes(game_source)
                target_source = json.dumps({'revision': target_rust}).encode()
                for mount, game in [('wwwroot', current_website), ('RustSite', current_rust)]:
                    (live / mount / 'deployment.json').write_text(json.dumps({
                        'revision': current_website, 'gameRevision': game, 'ready': True,
                        'deploymentId': 'ab' * 16, 'deploymentSequence': sequence - 1,
                    }))
                worker = stage / 'Deploy/M5Worker/deployment-publication.py'
                worker.write_bytes((ROOT / 'ops/local-ci/deployment-publication.py').read_bytes())
                unit_names = ['solomon-dark-game.service', 'solomon-dark-rust-game.service',
                              'solomon-dark-rust-api.service']
                unit_bytes = b''
                for unit in unit_names:
                    content = f'owned fixture {unit}\n'.encode()
                    (units / unit).write_bytes(content)
                    unit_bytes += content
                prior_route = 'owned prior route\n'
                candidate_route = 'owned candidate route\n' if route_changed else prior_route
                (root / 'caddy-site').write_text(prior_route)
                (root / 'caddy-candidate').write_text(candidate_route)
                (root / 'game.env').write_text('SDR_GAME_SUPERVISOR_SECRET=owned-test-secret\n')
                actions = root / 'actions'
                actions.touch()
                saved = []
                servers = []
                threads = []

                def authority(client):
                    class Handler(BaseHTTPRequestHandler):
                        def log_message(self, *_args):
                            pass

                        def send(self, payload):
                            self.send_response(200)
                            self.end_headers()
                            self.wfile.write(json.dumps(payload).encode())

                        def do_GET(self):
                            payload = {'status': 'ok', 'draining': False}
                            if client == 'rust':
                                payload['deploymentProtocol'] = 2
                            self.send(payload)

                        def do_POST(self):
                            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                            document = root / f'{client}-save'
                            # The authority's external acknowledgement represents the
                            # browser's completed persistence, rather than an early ACK.
                            with document.open('w') as output:
                                output.write(f'final checkpoint for {client}')
                                output.flush()
                                os.fsync(output.fileno())
                            saved.append(client)
                            with actions.open('a') as output:
                                output.write(f'saved {client}\n')
                            payload = {'status': 'ready', 'targetRevision': body['targetRevision'],
                                       'players': 1, 'savedPlayers': 1, 'unacknowledgedPlayers': 0}
                            if client == 'rust':
                                payload['deploymentId'] = self.headers['X-Solomon-Deployment-Id']
                                payload['deploymentSequence'] = int(self.headers['X-Solomon-Deployment-Sequence'])
                            self.send(payload)
                    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
                    thread = threading.Thread(target=server.serve_forever)
                    servers.append(server)
                    threads.append(thread)
                    thread.start()
                    return f'http://127.0.0.1:{server.server_port}'

                pixi_url, rust_url = authority('pixi'), authority('rust')
                environment = os.environ | {
                    'live': str(live), 'stage': str(stage), 'backup_dir': str(backup),
                    'caddy_site': str(root / 'caddy-site'), 'caddy_candidate': str(root / 'caddy-candidate'),
                    'service_log': str(actions), 'game_env': str(root / 'game.env'),
                    'game_supervisor_url': pixi_url, 'target_sha': target_website,
                    'target_game_revision': target_rust, 'deployment_id': publication_id,
                    'expected_game_checksum': hashlib.sha256(target_source).hexdigest(),
                    'expected_game_unit_checksum': hashlib.sha256(unit_bytes).hexdigest(),
                }
                # Only privileged host/process boundaries are substituted. File
                # comparisons, publication writes, HTTP drain requests and policy run.
                boundaries = '''
systemctl() { printf '%s\\n' "$*" >>"$service_log"; }
chown() { :; }
validate_caddy() { :; }
install() {
    if [[ "$1" == -d ]]; then mkdir -p "${@: -1}"; return; fi
    while [[ "$1" == -* ]]; do shift 2; done
    cp "$1" "$2"
}
'''
                program = ('set -Eeuo pipefail\ncaddy_changed=0\ndrained_units=()\nstopped_units=()\n'
                           + boundaries + helpers + install_caddy
                           + policy.replace('/etc/systemd/system', str(units)).replace(
                               'http://127.0.0.1:5232', rust_url)
                           + '\ninstall_caddy_config\n')
                try:
                    result = subprocess.run(['/bin/bash', '-c', program], env=environment,
                                            capture_output=True, text=True, timeout=10)
                    self.assertEqual(result.returncode == 0, succeeds, result.stdout + result.stderr)
                    self.assertEqual(saved, expected_saves)
                    events = actions.read_text().splitlines()
                    if route_changed and website_changed:
                        self.assertEqual((root / 'caddy-site').read_text(), candidate_route)
                        reload_at = events.index('reload caddy.service')
                        for client in expected_saves:
                            self.assertLess(events.index(f'saved {client}'), reload_at)
                            self.assertEqual((root / f'{client}-save').read_text(), f'final checkpoint for {client}')
                    else:
                        self.assertNotIn('reload caddy.service', events)
                        self.assertEqual((root / 'caddy-site').read_text(), prior_route)
                    if not succeeds:
                        self.assertIn('unchanged-game deployment requires publication-aware game clients', result.stderr)
                        self.assertEqual(events, [])
                    if not website_changed and not route_changed:
                        self.assertFalse(any('solomon-dark-revived.service' in event
                                             or 'solomon-dark-game.service' in event for event in events))
                    for mount in ('wwwroot', 'RustSite'):
                        self.assertTrue(json.loads((live / mount / 'deployment.json').read_text())['ready'])
                finally:
                    for server in servers:
                        server.shutdown()
                    for thread in threads:
                        thread.join()
                    for server in servers:
                        server.server_close()


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
