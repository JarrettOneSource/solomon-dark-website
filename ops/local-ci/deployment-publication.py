#!/usr/bin/env python3
"""Durable publication ordering, independent of immutable game recovery revisions."""
import argparse
import json
import os
from pathlib import Path
import re
import tempfile

MAX_SEQUENCE = (1 << 64) - 1


def sequence(publication):
    value = publication.get('deploymentSequence')
    if value is None and set(publication) == {'revision'}:
        value = 0  # The explicitly supported first legacy-to-Rust cutover.
    if type(value) is not int or not 0 <= value <= MAX_SEQUENCE:
        raise ValueError('The deployment publication has an invalid sequence')
    return value


def next_sequence(path):
    value = sequence(json.loads(Path(path).read_text()))
    if value == MAX_SEQUENCE:
        raise ValueError('The deployment publication sequence is exhausted')
    return value + 1


def is_ready(path, website_revision, game_revision):
    publication = json.loads(Path(path).read_text())
    if set(publication) == {'revision'}:
        return publication['revision'] == website_revision
    return (publication.get('revision') == website_revision
            and publication.get('gameRevision') == game_revision
            and publication.get('ready') is True
            and sequence(publication) > 0
            and isinstance(publication.get('deploymentId'), str)
            and re.fullmatch('[0-9a-f]{32}', publication['deploymentId']) is not None)


def parallel_ready(path, website_revision, game_revision):
    root = Path(path)
    primary = root / 'wwwroot/deployment.json'
    companion = root / 'RustSite/deployment.json'
    if not primary.is_file() or not companion.is_file():
        return False
    if not (is_ready(primary, website_revision, website_revision)
            and is_ready(companion, website_revision, game_revision)):
        return False
    first, second = json.loads(primary.read_text()), json.loads(companion.read_text())
    return (first.get('deploymentId') is not None
            and first['deploymentId'] == second.get('deploymentId')
            and first['deploymentSequence'] == second.get('deploymentSequence'))


def write(path, phase, website_revision, game_revision, deployment_id, deployment_sequence):
    if (not re.fullmatch('[0-9a-f]{40}', website_revision)
            or not re.fullmatch('[0-9a-f]{40}', game_revision)
            or not re.fullmatch('[0-9a-f]{32}', deployment_id)
            or type(deployment_sequence) is not int
            or not 0 < deployment_sequence <= MAX_SEQUENCE
            or phase not in ('pending', 'ready')):
        raise ValueError('The deployment publication identity is invalid')
    path = Path(path)
    publication = {'revision': website_revision, 'gameRevision': game_revision,
                   'deploymentId': deployment_id, 'deploymentSequence': deployment_sequence,
                   'ready': phase == 'ready'}
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.deployment-', delete=False) as output:
        temporary = Path(output.name)
        try:
            json.dump(publication, output, separators=(',', ':'))
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
            os.chmod(temporary, 0o644)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    next_parser = commands.add_parser('next')
    next_parser.add_argument('path')
    ready_parser = commands.add_parser('ready')
    ready_parser.add_argument('path')
    ready_parser.add_argument('website_revision')
    ready_parser.add_argument('game_revision')
    parallel_parser = commands.add_parser('parallel-ready')
    parallel_parser.add_argument('path')
    parallel_parser.add_argument('website_revision')
    parallel_parser.add_argument('game_revision')
    write_parser = commands.add_parser('write')
    for name in ('path', 'phase', 'website_revision', 'game_revision', 'deployment_id'):
        write_parser.add_argument(name)
    write_parser.add_argument('deployment_sequence', type=int)
    args = vars(parser.parse_args())
    command = args.pop('command')
    if command == 'next':
        print(next_sequence(**args))
    elif command == 'ready':
        raise SystemExit(0 if is_ready(**args) else 1)
    elif command == 'parallel-ready':
        raise SystemExit(0 if parallel_ready(**args) else 1)
    else:
        write(**args)
