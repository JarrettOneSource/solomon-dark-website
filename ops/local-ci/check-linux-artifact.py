#!/usr/bin/env python3
"""Reject native files that the Linux x64 production runtime cannot load."""
import json
from pathlib import Path
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
    required = [root / 'libe_sqlite3.so']
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
    return {'runtime': 'linux-x64', 'native_assets': [p.relative_to(root).as_posix() for p in required]}


if __name__ == '__main__':
    print(json.dumps(check_release(Path(sys.argv[1]))))
