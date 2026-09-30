#!/usr/bin/env python3
"""Own one SSD deployment invocation and the shared M5 compute lease."""
import argparse
import datetime
from collections import deque
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import uuid

DEFAULT_ROOT = Path('/Volumes/Drive/solomon-cicd')
VOLUME = Path('/Volumes/Drive')
LEASE = VOLUME / 'codex-acceptance/solomon-heavy-lease'


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write_json(path, data):
    temporary = path.with_name(path.name + '.next')
    temporary.write_text(json.dumps(data, indent=2) + '\n')
    temporary.replace(path)


def storage_ready(root):
    root = root.resolve()
    if VOLUME not in root.parents or not VOLUME.is_mount() or not (root / 'config.json').is_file():
        return False
    result = subprocess.run(['/usr/sbin/diskutil', 'info', '-plist', str(VOLUME)],
                            capture_output=True, check=True)
    import plistlib
    information = plistlib.loads(result.stdout)
    config = json.loads((root / 'config.json').read_text())
    return information.get('VolumeUUID') == config['volume_uuid']


class ComputeLease:
    def __init__(self, path, owner):
        self.path = path
        self.owner = owner
        self.acquired = False

    def acquire(self):
        try:
            self.path.mkdir()
        except FileExistsError:
            return False
        try:
            write_json(self.path / 'owner.json', self.owner)
        except BaseException:
            self.path.rmdir()
            raise
        self.acquired = True
        return True

    def release(self):
        if not self.acquired:
            return
        current = json.loads((self.path / 'owner.json').read_text())
        if current != self.owner:
            raise RuntimeError('The deployment compute lease changed ownership')
        (self.path / 'owner.json').unlink()
        self.path.rmdir()
        self.acquired = False


def worker_environment(root, config):
    environment = os.environ.copy()
    python = root / 'tools/Python.framework/Versions/3.12'
    environment.update({
        'SDR_DEPLOY_ROOT': str(root), 'SDR_DEPLOY_LOCK_HELD': '1',
        'PATH': ':'.join(map(str, [root / 'tools/node/bin', root / 'tools/bash/bin',
                                  python / 'bin', root / 'tools/dotnet'])) + ':/usr/bin:/bin:/usr/sbin:/sbin',
        'TMPDIR': str(root / 'tmp'),
        'XDG_CONFIG_HOME': str(root / 'home/config'),
        'XDG_CACHE_HOME': str(root / 'cache/xdg'),
        'XDG_DATA_HOME': str(root / 'data'), 'XDG_STATE_HOME': str(root / 'state'),
        'npm_config_cache': str(root / 'cache/npm'),
        'npm_config_userconfig': str(root / 'home/npmrc'),
        'ELECTRON_CACHE': str(root / 'cache/electron'),
        'PYTHONUSERBASE': str(root / 'home/python'),
        'PYTHONDONTWRITEBYTECODE': '1',
        'PYTHONPATH': str(python / 'lib/python3.12/lib-dynload'),
        'PIP_CACHE_DIR': str(root / 'cache/pip'),
        'DOTNET_ROOT': str(root / 'tools/dotnet'),
        'SDR_DOTNET': str(root / 'tools/dotnet/dotnet'),
        'DOTNET_CLI_HOME': str(root / 'home/dotnet'),
        'DOTNET_GENERATE_ASPNET_CERTIFICATE': 'false',
        'DOTNET_CLI_TELEMETRY_OPTOUT': '1', 'DOTNET_SKIP_FIRST_TIME_EXPERIENCE': '1',
        'DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE': 'true',
        'DOTNET_CLI_USE_MSBUILD_SERVER': '0', 'MSBUILDDISABLENODEREUSE': '1',
        'UseSharedCompilation': 'false',
        'NUGET_PACKAGES': str(root / 'cache/nuget'),
        'NUGET_HTTP_CACHE_PATH': str(root / 'cache/nuget-http'),
        'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_SYSTEM': '/dev/null',
        'GIT_TERMINAL_PROMPT': '0',
        'SDR_CHROME_PATH': str(root / 'tools/chrome/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    })
    environment.update(config['environment'])
    return environment


def group_active(group_id):
    rows = subprocess.check_output(['/bin/ps', '-axo', 'pgid=,stat='], text=True).splitlines()
    return any(int(parts[0]) == group_id and not parts[1].startswith('Z')
               for row in rows if len(parts := row.split()) == 2)


def stop_group(child):
    """A finished shell can still have owned compiler/browser descendants."""
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        child.poll()
        # kill(..., 0) also succeeds for zombies; only live descendants own work.
        if not group_active(child.pid):
            return
        time.sleep(0.1)
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    child.wait(timeout=5)
    if group_active(child.pid):
        raise RuntimeError('Owned deployment processes remain active after forced shutdown')


def run_once(root):
    root = root.resolve()
    if not storage_ready(root):
        print('External CI volume is absent or does not match its installed identity; deferred.')
        return 0
    config = json.loads((root / 'config.json').read_text())
    for name in ('state', 'logs', 'tmp', 'home', 'data', 'artifacts'):
        (root / name).mkdir(exist_ok=True)
    with (root / 'state/deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another CI invocation is active; deferred.')
            return 0
        invocation = uuid.uuid4().hex
        owner = {'task_id': 'solomon-cicd', 'worker': 'solomon-cicd', 'root': str(root), 'pid': os.getpid(),
                 'invocation_id': invocation, 'acquired_at_utc': now()}
        lease = ComputeLease(LEASE, owner)
        if not lease.acquire():
            write_json(root / 'state/status.json', {'state': 'deferred', 'reason': 'foreign compute lease', 'at_utc': now()})
            return 0
        log_path = root / 'logs/current.log'
        previous = root / 'logs/previous.log'
        if log_path.exists():
            log_path.replace(previous)
        started = now()
        child = None
        cancelled = False
        cancel_signal = None

        def terminate(signum, _frame):
            nonlocal cancelled, cancel_signal
            cancelled = True
            cancel_signal = signum
            if child is not None:
                raise InterruptedError('CI invocation was cancelled')

        handlers = {number: signal.signal(number, terminate) for number in (signal.SIGTERM, signal.SIGINT)}
        result = 1
        try:
            write_json(root / 'state/status.json', {'state': 'running', 'invocation_id': invocation,
                                                     'pid': os.getpid(), 'started_at_utc': started})
            with log_path.open('w') as log:
                try:
                    child = subprocess.Popen([str(root / 'tools/bash/bin/bash'),
                                              str(root / 'current/deploy-main.sh')],
                                             env=worker_environment(root, config),
                                             stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                    if cancelled:
                        raise InterruptedError('CI invocation was cancelled during startup')
                    code = child.wait(timeout=90 * 60)
                except (subprocess.TimeoutExpired, InterruptedError):
                    cancelled = True
                    code = 128 + cancel_signal if cancel_signal is not None else 124
                except OSError as error:
                    log.write(f'{type(error).__name__}: {error}\n')
                    code = 1
                finally:
                    # Ignore a second cancellation while completing bounded owned shutdown.
                    for number in handlers:
                        signal.signal(number, signal.SIG_IGN)
                    if child is not None:
                        stop_group(child)
            state = 'cancelled' if cancelled else 'success' if code == 0 else 'failed'
            with log_path.open(errors='replace') as log:
                tail = [line.rstrip('\n')[:2047] + '\n' for line in deque(log, maxlen=40)]
            summary = {'state': state, 'invocation_id': invocation, 'started_at_utc': started,
                       'finished_at_utc': now(), 'exit_code': code,
                       'tail': tail}
            write_json(root / 'state/status.json', summary)
            # Full success output is disposable; retain only the bounded diagnostic summary.
            if state == 'success':
                log_path.unlink()
            else:
                log_path.write_text(''.join(tail))
            previous.unlink(missing_ok=True)
            return_code = code if code >= 0 else 128 - code
            result = return_code
        finally:
            for number, handler in handlers.items():
                signal.signal(number, handler)
            if child is None or not group_active(child.pid):
                lease.release()
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    arguments = parser.parse_args()
    return run_once(arguments.root)


if __name__ == '__main__':
    raise SystemExit(main())
