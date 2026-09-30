#!/usr/bin/env python3
"""Install the one maintained M5 worker and its native launchd registration."""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile

FILES = ('deploy-main.sh', 'run-worker.py', 'install.py')
LABEL = 'com.jarrett.solomon-dark-main-deploy'
DEFAULT_ROOT = Path('/Volumes/Drive/solomon-cicd')
VOLUME = Path('/Volumes/Drive')


def mount_information():
    if not VOLUME.is_mount():
        raise RuntimeError('The external CI volume must be mounted before installation')
    return plistlib.loads(subprocess.check_output(['/usr/sbin/diskutil', 'info', '-plist', str(VOLUME)]))


def component_digest(source):
    digest = hashlib.sha256()
    for name in FILES:
        digest.update(name.encode())
        digest.update((source / name).read_bytes())
    return digest.hexdigest()


def atomic_text(path, text):
    temporary = path.with_name(path.name + '.next')
    temporary.write_text(text)
    temporary.replace(path)


def registration_definition(root):
    # A tiny native registration must load even when the SSD is absent at login.
    return {
        'Label': LABEL,
        'ProgramArguments': ['/bin/sh', '-c',
                             'test -f "$1" || exit 0; exec /usr/bin/python3 "$1" --root "$2"',
                             'solomon-cicd', str(root / 'current/run-worker.py'), str(root)],
        'RunAtLoad': True, 'StartInterval': 60, 'ProcessType': 'Background', 'Nice': 10,
        'LowPriorityIO': True, 'ThrottleInterval': 10, 'ExitTimeOut': 45,
    }


def install_version(source, root):
    root = root.resolve()
    if VOLUME not in root.parents:
        raise RuntimeError('The complete CI installation must live on its external volume')
    information = mount_information()
    config_path = root / 'config.json'
    if config_path.exists():
        config = json.loads(config_path.read_text())
        if config['volume_uuid'] != information['VolumeUUID']:
            raise RuntimeError('Installed CI configuration belongs to another volume')
    digest = component_digest(source)
    root.mkdir(exist_ok=True)
    versions = root / 'versions'
    versions.mkdir(exist_ok=True)
    destination = versions / digest
    if not destination.exists():
        temporary = Path(tempfile.mkdtemp(prefix='.install-', dir=versions))
        try:
            for name in FILES:
                shutil.copyfile(source / name, temporary / name)
                (temporary / name).chmod(0o700)
            atomic_text(temporary / 'components.json', json.dumps({
                'format': 1, 'component_digest': digest,
                'files': {name: hashlib.sha256((temporary / name).read_bytes()).hexdigest() for name in FILES},
            }, indent=2) + '\n')
            temporary.rename(destination)
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)
    for name in FILES:
        if (destination / name).read_bytes() != (source / name).read_bytes():
            raise RuntimeError('An installed worker version does not match its admitted source')
    current = root / 'current'
    previous_version = current.resolve() if current.is_symlink() else None
    changed = previous_version != destination
    if changed:
        pointer = root / '.current.next'
        pointer.unlink(missing_ok=True)
        pointer.symlink_to(destination.relative_to(root), target_is_directory=True)
        pointer.replace(current)
        if previous_version is not None:
            previous_pointer = root / '.previous.next'
            previous_pointer.unlink(missing_ok=True)
            previous_pointer.symlink_to(previous_version.relative_to(root), target_is_directory=True)
            previous_pointer.replace(root / 'previous')
    retained_previous = (root / 'previous').resolve() if (root / 'previous').is_symlink() else None
    for directory in ('state', 'logs', 'tmp', 'home', 'data', 'artifacts', 'launchd'):
        (root / directory).mkdir(exist_ok=True)
    if not config_path.exists():
        atomic_text(config_path, json.dumps({'volume_uuid': information['VolumeUUID'], 'environment': {}}, indent=2) + '\n')
        config_path.chmod(0o600)
    # A stable native registration resolves the atomically updated complete worker version.
    plist_path = root / 'launchd' / (LABEL + '.plist')
    data = plistlib.dumps(registration_definition(root), sort_keys=True)
    temporary = plist_path.with_suffix('.plist.next')
    temporary.write_bytes(data)
    temporary.replace(plist_path)
    # Keep the active version and one rollback version, not an unbounded source archive.
    for version in versions.iterdir():
        if version in (destination, retained_previous) or not version.is_dir() or version.is_symlink():
            continue
        manifest = version / 'components.json'
        if manifest.is_file() and json.loads(manifest.read_text()).get('component_digest') == version.name:
            shutil.rmtree(version)
    return changed


@contextmanager
def idle_installation(root):
    root = root.resolve()
    mount_information()
    if VOLUME not in root.parents:
        raise RuntimeError('The complete CI installation must live on its external volume')
    (root / 'state').mkdir(parents=True, exist_ok=True)
    with (root / 'state/deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('The deployment worker is active; install only while it is idle') from None
        yield


def refresh_scheduler(root):
    uid = os.getuid()
    domain = f'gui/{uid}'
    registration = Path.home() / 'Library/LaunchAgents' / (LABEL + '.plist')
    target = root / 'launchd' / (LABEL + '.plist')
    registration.parent.mkdir(parents=True, exist_ok=True)
    owned = False
    if registration.exists() or registration.is_symlink():
        if registration.is_symlink():
            owned = registration.resolve() == target.resolve()
        else:
            old = plistlib.loads(registration.read_bytes())
            owned = old.get('Label') == LABEL and str(root / 'current/run-worker.py') in old.get('ProgramArguments', []) and str(root) in old.get('ProgramArguments', [])
        if not owned:
            raise RuntimeError('An unrelated launchd registration already owns this label')
    existing = subprocess.run(['/bin/launchctl', 'print', domain + '/' + LABEL], capture_output=True, text=True)
    if existing.returncode == 0 and (not owned or str(root / 'current/run-worker.py') not in existing.stdout):
        raise RuntimeError('An unrelated native job already owns this label')
    if registration.is_symlink():
        registration.unlink()
    temporary = registration.with_suffix('.plist.next')
    temporary.write_bytes(target.read_bytes())
    temporary.chmod(0o600)
    temporary.replace(registration)
    if existing.returncode == 0:
        subprocess.run(['/bin/launchctl', 'bootout', domain + '/' + LABEL], check=True)
    subprocess.run(['/bin/launchctl', 'bootstrap', domain, str(registration)], check=True)
    subprocess.run(['/bin/launchctl', 'enable', domain + '/' + LABEL], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument('--no-bootstrap', action='store_true')
    arguments = parser.parse_args()
    arguments.root = arguments.root.resolve()
    if arguments.no_bootstrap:
        changed = install_version(arguments.source, arguments.root)
        print(json.dumps({'installed_root': str(arguments.root), 'components_changed': changed}))
    else:
        with idle_installation(arguments.root):
            changed = install_version(arguments.source, arguments.root)
            (arguments.root / 'state/failed-target').unlink(missing_ok=True)
            refresh_scheduler(arguments.root)
            print(json.dumps({'installed_root': str(arguments.root), 'components_changed': changed}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
