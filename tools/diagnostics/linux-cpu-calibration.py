"""Inert on import. Emit only prelaunch driver CPU calibration numbers/statuses."""

import json
import os
import pathlib
import re
import sys

MAX_READ_BYTES = 65536
MAX_LEVELS = 33


def read_bounded(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as source:
        raw = source.read(MAX_READ_BYTES + 1)
    if len(raw) > MAX_READ_BYTES:
        raise ValueError('Calibration read limit')
    return raw.decode('ascii')


def positive_integer(value):
    return value if type(value) is int and 0 < value <= 10**9 else None


def cgroup_allowance(pid, read):
    result = {'driverCgroupStatus': 'unavailable', 'driverCgroupQuotaCpuCount': None, 'driverCgroupLevels': 0}
    try:
        membership = read('/proc/' + str(pid) + '/cgroup')
        # Remove only the proc record's LF terminator; all path bytes must reach validation.
        record = membership.removesuffix('\n')
        # Do not infer a quota from a v1/hybrid hierarchy or an ambiguous owner.
        if '\n' in record or not record.startswith('0::'):
            result['driverCgroupStatus'] = 'unsupported'
            return result
        path = record[3:]
        if len(path) > 4096:
            result['driverCgroupStatus'] = 'limited'
            return result
        parts = path.split('/')[1:] if path != '/' else []
        if not path.startswith('/') or any(part in ['', '.', '..'] or not re.fullmatch(r'[A-Za-z0-9_.:@+-]+', part) for part in parts):
            result['driverCgroupStatus'] = 'malformed'
            return result
        if len(parts) + 1 > MAX_LEVELS:
            result['driverCgroupStatus'] = 'limited'
            return result
        mounts = []
        for line in read('/proc/' + str(pid) + '/mountinfo').splitlines():
            fields = line.split()
            if '-' in fields:
                separator = fields.index('-')
                if len(fields) > separator + 1 and fields[separator + 1] == 'cgroup2':
                    mounts.append(fields)
        if len(mounts) != 1 or len(mounts[0]) < 6 or mounts[0][3:5] != ['/', '/sys/fs/cgroup']:
            result['driverCgroupStatus'] = 'unsupported'
            return result
        quotas = []
        for length in range(len(parts), -1, -1):
            quota_file = pathlib.PurePosixPath('/sys/fs/cgroup').joinpath(*parts[:length], 'cpu.max')
            result['driverCgroupLevels'] += 1
            try:
                text = read(str(quota_file)).strip()
            except FileNotFoundError:
                # The true cgroup-v2 hierarchy root has no cpu.max control.
                # A namespace may still hide upstream limits: this is visible scope only.
                if length == 0:
                    continue
                raise
            match = re.fullmatch(r'(max|[1-9][0-9]{0,15})\s+([1-9][0-9]{0,15})', text)
            if not match:
                result['driverCgroupStatus'] = 'malformed'
                return result
            quota, period = match.groups()
            if int(period) > 2**53 - 1 or (quota != 'max' and int(quota) > 2**53 - 1):
                result['driverCgroupStatus'] = 'malformed'
                return result
            if quota != 'max':
                allowance = int(quota) / int(period)
                if allowance > 10**9:
                    result['driverCgroupStatus'] = 'malformed'
                    return result
                quotas.append(allowance)
        result['driverCgroupStatus'] = 'finite' if quotas else 'no-visible-limit'
        result['driverCgroupQuotaCpuCount'] = min(quotas) if quotas else None
    except (OSError, ValueError, UnicodeError):
        result['driverCgroupStatus'] = 'unavailable'
    return result


def calibrate(pid, *, read=read_bounded, sysconf=os.sysconf, affinity=None, platform=sys.platform):
    result = {}
    for name, field, status in [
        ('SC_CLK_TCK', 'clockTicksPerSecond', 'clockTicksStatus'),
        ('SC_NPROCESSORS_ONLN', 'onlineCpuCount', 'onlineCpuStatus'),
    ]:
        try:
            value = positive_integer(sysconf(name))
        except (OSError, ValueError, AttributeError):
            value = None
        result[field] = value
        result[status] = 'available' if value is not None else 'unavailable'
    try:
        affinity = affinity or getattr(os, 'sched_getaffinity')
        value = positive_integer(len(affinity(pid)))
    except (OSError, ValueError, AttributeError, TypeError):
        value = None
    result['driverAffinityCpuCount'] = value
    result['driverAffinityStatus'] = 'available' if value is not None else 'unavailable'
    if platform == 'linux':
        result.update(cgroup_allowance(pid, read))
    else:
        result.update(driverCgroupStatus='unsupported', driverCgroupQuotaCpuCount=None, driverCgroupLevels=0)
    return result


if __name__ == '__main__':
    # The Node driver supplies only its own PID. Errors are never printed raw.
    if len(sys.argv) != 2 or not re.fullmatch(r'[1-9][0-9]{0,9}', sys.argv[1]):
        raise SystemExit(1)
    try:
        print(json.dumps(calibrate(int(sys.argv[1])), allow_nan=False))
    except Exception:
        raise SystemExit(1) from None
