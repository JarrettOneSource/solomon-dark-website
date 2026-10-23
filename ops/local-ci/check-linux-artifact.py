#!/usr/bin/env python3
"""Reject native files that the Linux x64 production runtime cannot load."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import struct
import sys


def require_linux_x64(path):
    with path.open('rb') as source:
        header = source.read(64)
    if len(header) < 20 or header[:4] != b'\x7fELF' or header[4:6] != b'\x02\x01':
        raise ValueError(f'{path.name} is not a little-endian ELF64 runtime asset')
    if struct.unpack_from('<H', header, 18)[0] != 62:
        raise ValueError(f'{path.name} is not an x86-64 runtime asset')


def check_release(root):
    required = [root / 'libe_sqlite3.so', root / 'GameHost/solomon-darker']
    for path in required:
        if not path.is_file():
            raise ValueError(f'Linux release is missing {path.relative_to(root)}')
        require_linux_x64(path)
    for path in root.rglob('*'):
        if path.is_file() and path.suffix in ('.so', '.dylib'):
            require_linux_x64(path)
    dependencies = json.loads((root / 'Server.deps.json').read_text())
    if not dependencies['runtimeTarget']['name'].endswith('/linux-x64'):
        raise ValueError('The managed release dependencies target another runtime')
    game = json.loads((root / 'game-artifact.json').read_text())
    if (game.get('schemaVersion') != 1 or game.get('target') != 'x86_64-unknown-linux-gnu'
            or not re.fullmatch(r'[0-9a-f]{40}', game.get('revision', ''))
            or not isinstance(game.get('files'), dict)):
        raise ValueError('The Rust game manifest does not identify a Linux x64 release')
    client_files = set()
    for name, digest in game['files'].items():
        parts = PurePosixPath(name).parts
        if not parts or name != '/'.join(parts) or '..' in parts or '\\' in name:
            raise ValueError('The Rust game manifest contains an unsafe path')
        if name == 'bin/solomon-darker':
            path = root / 'GameHost/solomon-darker'
        elif name.startswith('client/'):
            client_files.add(name[7:])
            path = root / 'wwwroot/game' / name[7:]
        else:
            raise ValueError('The Rust game manifest contains an unsupported release member')
        if (not re.fullmatch(r'[0-9a-f]{64}', digest) or not path.is_file()
                or path.is_symlink()):
            raise ValueError(f'The Rust game release is missing a regular hashed member: {name}')
        with path.open('rb') as source:
            actual = hashlib.file_digest(source, 'sha256').hexdigest()
        if actual != digest:
            raise ValueError(f'The Rust game release SHA-256 differs: {name}')
    actual_client = set()
    for path in (root / 'wwwroot/game').rglob('*'):
        if path.is_symlink():
            raise ValueError('The Rust game release contains a symbolic link')
        if path.is_file():
            actual_client.add(path.relative_to(root / 'wwwroot/game').as_posix())
    if actual_client != client_files or 'bin/solomon-darker' not in game['files']:
        raise ValueError('The Rust game release membership differs from its manifest')
    deployment = json.loads((root / 'wwwroot/game/deployment.json').read_text())
    if deployment.get('revision') != game['revision']:
        raise ValueError('The Rust game client identifies another revision')
    expected_environment = (f'SDR_GAME_REVISION={game["revision"]}\n'
                            'SDR_GAME_ASSET_DIRECTORY=/opt/solomon-dark-revived/wwwroot/game\n')
    if (root / 'GameHost/release.env').read_text() != expected_environment:
        raise ValueError('The Rust game service identifies another release')
    return {'runtime': 'linux-x64', 'game_revision': game['revision'],
            'native_assets': [p.relative_to(root).as_posix() for p in required]}


if __name__ == '__main__':
    print(json.dumps(check_release(Path(sys.argv[1]))))
