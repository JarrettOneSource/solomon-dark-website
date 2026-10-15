"""One ordered original/passive Linux pair; inert without an explicit phase.

No product mutation, rebuild, workflow dispatch, retries, or browser calls.
The process-local subreaper is used only in a dedicated trial supervisor.
"""
import argparse
import ctypes
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import select
import signal
import subprocess
import sys
import time

REVIEWED = 'ab612bbab50db542db7964ba79b80a6e02a7cdf3'
BRANCH = 'refs/heads/codex/diagnose-intel-c20-sh9aksle'
REPOSITORY = 'JarrettOneSource/solomon-dark-website'
ORDER = ('original', 'passive')
CEILING_SECONDS = 360
JOB_SECONDS = 1200
UPLOAD_RESERVE_SECONDS = 180
CHECK_RESERVE_SECONDS = 30
CLEANUP_SECONDS = 15
MAX_CHILDREN = 256
PINS = {
    'linux-retained-control.py': '82109f1e2b0084b81f8c4f42660a4100869a1ae19dc921c449f1649b83889c22',
    'linux-source-qualification.py': '7390eee6092cf4c485740843b3da1b0ea708a7856b159ec94918461be4bc3982',
    'package-inventory.py': '94d080a1024511d2d3805ee0f008975e490c77c6a55f3cb0250f10021926a5fe',
    'linux-launch-diagnostic.mjs': '1ee591ad5465d50840b094dadf9d3d9f84a8effb0427f1f44fde69c004bca295',
    'linux-launch-observer.mjs': 'f04fdcdb64978b07d4ba1a68261551983373a5463271e1abaa69d205da12a766',
    'linux-cpu-calibration.py': '19cf313482dd4d89d16f326102677728c1e831cdc1b0910057b33680c531f84c',
}
CANDIDATES = ('.github/workflows/linux-paired-control.yml',
              'tools/diagnostics/linux-paired-control.py',
              'tools/diagnostics/linux-paired-control.test.py',
              'tools/diagnostics/linux-paired-control-plan.md')
PATCHED_PLAYWRIGHT = '93437f02c406a0d18a9b6c5ac70083e6306148361cea3047e540a53f94cbe078'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text())


def save(path, value):
    # Every evidence record is write-once. A duplicate is a stop, not a retry.
    with Path(path).open('x') as stream:
        stream.write(json.dumps(value, indent=2, allow_nan=False) + '\n')


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def helpers(reviewed):
    actual = {name: digest(reviewed / name) for name in PINS}
    require(actual == PINS, 'Reviewed helper bytes changed')
    return load_module(reviewed / 'linux-retained-control.py', 'paired_retained')


def disjoint_outputs(source, reviewed, evidence, runtime):
    protected = (source, reviewed, Path(__file__).resolve().parents[2])
    for output in (evidence, runtime):
        for other in protected:
            require(output != other and output not in other.parents and other not in output.parents,
                    'Output overlaps source/tools')
    require(evidence != runtime and evidence not in runtime.parents and runtime not in evidence.parents,
            'Evidence/runtime must be disjoint')


def hosted_guard(env, evidence, runtime):
    require(sys.platform == 'linux' and platform.machine() == 'x86_64', 'Linux x64 required; no package launch')
    expected = {'GITHUB_ACTIONS': 'true', 'RUNNER_OS': 'Linux', 'GITHUB_REPOSITORY': REPOSITORY,
                'GITHUB_REF': BRANCH, 'GITHUB_RUN_ATTEMPT': '1', 'GITHUB_JOB': 'pair-linux'}
    require(all(env.get(k) == v for k, v in expected.items()), 'Wrong hosted repository/ref/job/attempt')
    require(re.fullmatch(r'[1-9][0-9]*', env.get('GITHUB_RUN_ID', '')) is not None, 'Missing run ID')
    require(re.fullmatch(r'[0-9a-f]{40}', env.get('GITHUB_SHA', '')) is not None, 'Missing orchestration SHA')
    temp = Path(env['RUNNER_TEMP']).resolve(strict=True)
    require(evidence == temp / 'linux-paired-evidence' and runtime == temp / 'linux-paired-runtime',
            'Unexpected fixed hosted output paths')


def runner_identity(value, run_id):
    require(type(value) is list and len(value) == 1, 'Expected one same-runner job identity')
    row = value[0]
    require(all(type(row.get(k)) is int and row[k] > 0 for k in ('id', 'run_id', 'run_attempt', 'runner_id')),
            'Numeric runner/job identity is missing')
    require(type(row.get('runner_group_id')) is int and row['runner_group_id'] >= 0, 'Invalid runner group')
    require(row['run_id'] == int(run_id) and row['run_attempt'] == 1
            and row.get('status') == 'in_progress' and row.get('conclusion') is None, 'Wrong active runner job')
    return row


def admit_budget(runner, trials_left, now=None):
    require(trials_left in (1, 2), 'Invalid remaining trial count')
    started = datetime.fromisoformat(runner['started_at'].replace('Z', '+00:00'))
    require(started.tzinfo is not None, 'Job start time needs a timezone')
    now = now or datetime.now(timezone.utc)
    elapsed = (now - started).total_seconds()
    require(0 <= elapsed < JOB_SECONDS, 'Invalid or exhausted hosted job clock')
    needed = trials_left * (CEILING_SECONDS + CLEANUP_SECONDS + CHECK_RESERVE_SECONDS) + UPLOAD_RESERVE_SECONDS
    remaining = JOB_SECONDS - elapsed
    require(remaining >= needed, 'Insufficient job budget; dependent launch blocked')
    return {'at': now.isoformat(), 'jobStartedAt': runner['started_at'], 'remainingSeconds': remaining,
            'requiredSeconds': needed, 'remainingTrials': trials_left, 'uploadReserveSeconds': UPLOAD_RESERVE_SECONDS}


def safe_runtime_environment(env):
    keys = ('DEBUG', 'DEBUG_FILE', 'PWDEBUG', 'PWDEBUGIMPL', 'PW_INSTRUMENT_MODULES',
            'NODE_DEBUG', 'NODE_DEBUG_NATIVE', 'NODE_OPTIONS', 'NODE_PATH',
            'ELECTRON_ENABLE_LOGGING', 'ELECTRON_LOG_FILE', 'ELECTRON_RUN_AS_NODE')
    for key in keys:
        require(not any(env.get(name) for name in (key, 'npm_config_' + key.lower(), 'npm_package_config_' + key.lower())),
                'Unexpected debug/runtime override; values not recorded')


def parse_stat(text):
    end = text.rfind(')')
    require(end > 1 and text[end + 1:end + 2] == ' ', 'Malformed proc stat')
    pid = int(text[:text.index(' (')])
    fields = text[end + 2:].split()
    require(len(fields) >= 20 and pid > 0 and fields[0] in 'RSDZTWtXxKPI', 'Malformed proc fields')
    values = [int(fields[i]) for i in (1, 2, 3, 19)]
    require(all(n >= 0 for n in values), 'Negative proc identity')
    return dict(pid=pid, state=fields[0], ppid=values[0], pgid=values[1], sid=values[2], startTicks=values[3])


def proc_record(pid):
    with Path(f'/proc/{pid}/stat').open() as stream:
        data = stream.read(65537)
    require(len(data) <= 65536, 'Oversized proc stat')
    row = parse_stat(data)
    require(row['pid'] == pid, 'Proc PID mismatch')
    return row


def same_identity(a, b):
    return all(a[k] == b[k] for k in ('pid', 'ppid', 'startTicks'))


def open_owned(pid, owner, *, read=proc_record, open_fd=None, close_fd=os.close):
    before = read(pid)
    require(before['ppid'] == owner, 'Refuse non-child ownership')
    fd = (open_fd or os.pidfd_open)(pid, 0)
    try:
        after = read(pid)
        require(same_identity(before, after) and after['ppid'] == owner, 'Refuse changed PID identity/parent')
        return fd, after
    except BaseException:
        close_fd(fd)
        raise


def child_pids(owner):
    tasks = list(Path(f'/proc/{owner}/task').iterdir())
    require(len(tasks) == 1 and tasks[0].name == str(owner), 'Supervisor must remain single-threaded')
    text = (tasks[0] / 'children').read_text()
    require(len(text) <= 4096, 'Child list limit exceeded')
    values = [int(item) for item in text.split()]
    require(len(values) <= MAX_CHILDREN and len(values) == len(set(values)) and all(x > 0 for x in values),
            'Invalid/bounded-out child list')
    return values


def enable_subreaper():
    require(sys.platform == 'linux' and hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal'),
            'Unsupported Linux pidfd/subreaper capability')
    require(not child_pids(os.getpid()), 'Supervisor had pre-existing children')
    require(signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL, 'Unexpected SIGCHLD disposition')
    # Establish ordinary reaping semantics, clearing any inherited SA_NOCLDWAIT.
    # This changes only this dedicated parent, never the original harness.
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)
    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong]
    libc.prctl.restype = ctypes.c_int
    require(libc.prctl(36, 1, 0, 0, 0) == 0, 'PR_SET_CHILD_SUBREAPER unavailable')
    enabled = ctypes.c_int()
    require(libc.prctl(37, ctypes.addressof(enabled), 0, 0, 0) == 0 and enabled.value == 1,
            'PR_GET_CHILD_SUBREAPER did not verify')


def drain_children(owner):
    """Only signal current direct/adopted children, never a name/group/stale PID."""
    start = time.monotonic()
    result = {'provenEmpty': False, 'signals': [], 'reaped': [], 'escalated': False,
              'boundedOut': None, 'accountedChildren': 0}
    observed = set()
    sent = set()

    def within_bounds():
        result['elapsedSeconds'] = time.monotonic() - start
        # Conservatively charge both live identities and every waitpid result.
        # A live child later reaped uses two slots; the total can never exceed 256.
        result['accountedChildren'] = len(observed) + len(result['reaped'])
        if result['elapsedSeconds'] >= CLEANUP_SECONDS:
            result['boundedOut'] = 'deadline'
        elif result['accountedChildren'] >= MAX_CHILDREN:
            result['boundedOut'] = 'child-accounting-limit'
        return result['boundedOut'] is None

    while within_bounds():
        # Reaping owned child exits is itself an identity-safe kernel operation.
        # Check inside this loop too: a stream of exits must not bypass either cap.
        while True:
            if not within_bounds():
                return result
            try:
                pid, status = os.waitpid(-1, os.WNOHANG)
            except ChildProcessError:
                if not within_bounds():
                    return result
                require(not child_pids(owner), 'ECHILD disagrees with procfs')
                if not within_bounds():
                    return result
                result['provenEmpty'] = True
                return result
            if pid:
                result['reaped'].append({'pid': pid, 'waitStatus': status})
            if not within_bounds():
                return result
            if pid == 0:
                break
        elapsed = result['elapsedSeconds']
        sig = signal.SIGKILL if elapsed >= 7 else signal.SIGTERM if elapsed >= 2 else None
        children = child_pids(owner)
        if not within_bounds():
            return result
        for pid in children:
            if not within_bounds():
                return result
            try:
                fd, row = open_owned(pid, owner)
            except (FileNotFoundError, ProcessLookupError):
                continue  # An exited child will be reaped on the next bounded pass.
            try:
                key = (row['pid'], row['startTicks'])
                observed.add(key)
                if not within_bounds():
                    return result
                if sig is None or row['state'] in ('Z', 'X', 'x') or (key, sig) in sent:
                    continue
                # pidfd binds the kernel task even if the numeric PID is reused.
                signal.pidfd_send_signal(fd, sig, None, 0)
                result['signals'].append(dict(row, signal=signal.Signals(sig).name))
                sent.add((key, sig))
                result['escalated'] |= sig == signal.SIGKILL
            except ProcessLookupError:
                pass
            finally:
                os.close(fd)
        time.sleep(0.05)
    return result


BENIGN_ORPHAN = '''import os, time
child = os.fork()
if child == 0:
    os.setsid()
    grandchild = os.fork()
    if grandchild == 0:
        time.sleep(120)
        os._exit(0)
    os._exit(0)
os.waitpid(child, 0)
'''


def trial_command(label, reviewed):
    if label == 'original':
        return ['xvfb-run', '-a', 'npm', 'run', 'smoke:desktop']
    if label == 'passive':
        return ['xvfb-run', '-a', 'node', str(reviewed / 'linux-launch-diagnostic.mjs'), '--run']
    require(label == 'selftest', 'Unknown trial; extra variants forbidden')
    return [sys.executable, '-B', '-c', BENIGN_ORPHAN]


def supervise(label, source, reviewed, evidence, runtime):
    """Called in a fresh dedicated process. No helper child while workload runs."""
    out, work = evidence / label, runtime / label
    out.mkdir()
    work.mkdir()
    (work / 'tmp').mkdir(mode=0o700)
    result = {'label': label, 'outerCeilingSeconds': 30 if label == 'selftest' else CEILING_SECONDS,
              'truncated': False, 'naturalExit': False, 'cleanupValid': False,
              'supervisorPid': os.getpid(), 'error': None}
    child = None
    try:
        enable_subreaper()
        env = dict(os.environ, TMPDIR=str(work / 'tmp'), TMP=str(work / 'tmp'), TEMP=str(work / 'tmp'))
        env['SDR_SOURCE_ROOT'] = str(source)
        if label == 'original':
            env['SDR_DESKTOP_EVIDENCE'] = str(out / 'smoke')
        elif label == 'passive':
            env.update(SDR_DESKTOP_EVIDENCE=str(out / 'observer'),
                       SDR_DIAGNOSTIC_RUNTIME=str(work / 'generated'),
                       SDR_DESKTOP_APP=str(source / 'frontend/dist-desktop/Solomon Darker-linux-x64'))
        command = trial_command(label, reviewed)
        result['command'] = command if label != 'selftest' else ['python3', '-B', '-c', 'benign double-fork/new-session fixture']
        with (out / 'stdout.log').open('xb') as stdout, (out / 'stderr.log').open('xb') as stderr:
            start = time.monotonic()
            child = subprocess.Popen(command, cwd=source / 'frontend', env=env,
                                     stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, start_new_session=True)
            fd, row = open_owned(child.pid, os.getpid())
            try:
                result['rootIdentity'] = row
                require(row['pid'] == row['pgid'] == row['sid'], 'Workload root lacks an exclusive session')
                poll = select.poll()
                poll.register(fd, select.POLLIN)
                # One blocking kernel wait, not an extra during-workload process sampler.
                ready = poll.poll(result['outerCeilingSeconds'] * 1000)
                if ready:
                    require(ready[0][1] & select.POLLIN, 'Unexpected pidfd wait event')
                    result['rootReturnCode'] = child.wait()
                    result['naturalExit'] = True
                else:
                    result['truncated'] = True
            finally:
                os.close(fd)
            result['workloadWallSeconds'] = time.monotonic() - start
    except BaseException as error:
        result['error'] = type(error).__name__ + ': ' + str(error)
    finally:
        try:
            # Never begin trial two before this child/adoption barrier has settled.
            result['cleanup'] = drain_children(os.getpid())
            result['profileDirectoriesRemaining'] = sorted(p.name for p in (work / 'tmp').glob('solomon-darker-smoke-*'))
            result['cleanupValid'] = (result['cleanup']['provenEmpty'] and not result['cleanup']['escalated']
                                      and not result['cleanup'].get('boundedOut')
                                      and not result['profileDirectoriesRemaining'])
        except BaseException as error:
            result['cleanupError'] = type(error).__name__ + ': ' + str(error)
        save(out / 'supervision.json', result)
    return 0 if valid_supervision(result) else 1


def valid_supervision(record):
    return (record.get('naturalExit') is True and record.get('truncated') is False
            and record.get('cleanupValid') is True and record.get('error') is None
            and type(record.get('rootReturnCode')) is int and record['rootReturnCode'] >= 0)


def checkpoint(control, source, evidence, suffix):
    require(control.Q.check_source(source) == read_json(evidence / 'preparation.json')['product'], 'Source changed')
    require(control.retained_package_record(source) == read_json(evidence / 'provenance/package-before.json'),
            'Retained archive/manifests changed')
    for label in control.INVENTORIES:
        path = evidence / 'provenance' / f'{label}-files-{suffix}.json'
        require(not path.exists(), 'Inventory output already exists')
        control.Q.inventory_one(source, evidence / 'provenance', label, suffix)
        control.verify_inventory(evidence / 'provenance', label, suffix)
        require(path.read_bytes() == (evidence / 'provenance' / f'{label}-files-before.json').read_bytes(),
                'Inventory changed across trials')


def original_outcome(control, evidence, supervision):
    require(valid_supervision(supervision), 'Invalid original supervision/cleanup')
    out = evidence / 'original'
    if supervision['rootReturnCode'] == 0:
        control.Q.check_smoke(out / 'smoke')
        return 'pass'
    stderr = (out / 'stderr.log').read_text(errors='replace')
    stdout = (out / 'stdout.log').read_text(errors='replace')
    require('node tools/smoke-desktop-runtime.mjs' in stdout and 'smoke-desktop-runtime.mjs:' in stderr
            and re.search(r'(?:TimeoutError|AssertionError|Error)(?: \[.*?\])?:', stderr),
            'Original failure lacks an original-harness error; startup/infrastructure is invalid')
    require(not (out / 'smoke/receipt.json').exists(), 'Nonzero original exit contradicts success receipt')
    return 'fail'


def passive_outcome(evidence, runtime, supervision):
    require(valid_supervision(supervision), 'Invalid passive supervision/cleanup')
    out = evidence / 'passive/observer'
    binding = read_json(out / 'source-binding.json')
    require(binding.get('driverSha256') == PINS['linux-launch-diagnostic.mjs']
            and binding.get('observerSha256') == PINS['linux-launch-observer.mjs']
            and binding.get('calibrationHelperSha256') == PINS['linux-cpu-calibration.py']
            and binding.get('generatedPlaywrightSha256') == PATCHED_PLAYWRIGHT
            and binding.get('frameObservation') == 'disabled-by-contract'
            and binding.get('observerBrowserRequests') == 'none', 'Passive source binding drift')
    generated = list((runtime / 'passive/generated').glob('linux-launch-*'))
    require(len(generated) == 1, 'Expected one generated passive workload')
    harness = generated[0] / 'capture-workload.mjs'
    require(digest(harness) == binding['generatedHarnessSha256'], 'Generated harness binding mismatch')
    require(digest(generated[0] / 'playwright-core/lib/coreBundle.js') == PATCHED_PLAYWRIGHT, 'Generated bundle mismatch')
    require(not (generated[0] / 'captures').exists(), 'Passive transient captures were not removed')
    # Retain exact generated source for independent review, never transient pixels.
    with (out / 'generated-harness.mjs').open('xb') as stream:
        stream.write(harness.read_bytes())
    outcome = read_json(out / 'launch-outcome.json')
    require(outcome.get('processOwnershipProven') is True and outcome.get('processExitProven') is True
            and outcome.get('cleanupFailed') is False and outcome.get('survivors') == []
            and outcome.get('frameObservation') == 'disabled-by-contract', 'Invalid passive observer cleanup')
    if supervision['rootReturnCode'] == 0:
        require(outcome.get('workloadComplete') is True and outcome.get('failureKind') is None
                and outcome.get('secondLaunch') == 'resolved', 'Passive exit contradicts workload evidence')
        return 'pass'
    require(outcome.get('workloadComplete') is False and outcome.get('failureKind') is not None,
            'Passive nonzero exit lacks a workload failure')
    return 'fail'


def interpretation(original, passive):
    return {
        ('fail', 'pass'): 'Within-runner discordance: reduces separate-runner explanation; order/cache/timing/scheduling/observer causes remain unresolved.',
        ('pass', 'fail'): 'Reverse discordance: passive observation is not uniformly beneficial; order/cache/timing/scheduling/observer effects remain unresolved.',
        ('pass', 'pass'): 'Original failure did not recur here; cannot attribute earlier failures or certify a fix.',
        ('fail', 'fail'): 'Both failed on one runner; inspect actual failure stages. Shared outcome does not establish a shared cause.',
    }[(original, passive)]


def invoke_supervisor(label, args):
    command = [sys.executable, '-B', str(Path(__file__).resolve()), '_supervise', '--trial', label,
               '--source', str(args.source), '--reviewed', str(args.reviewed),
               '--evidence', str(args.evidence), '--runtime', str(args.runtime)]
    # The dedicated supervisor owns its own lifecycle; no broad timeout-kill here.
    return subprocess.run(command, check=False, start_new_session=True).returncode


def prepare(args, control):
    require(not args.evidence.exists() and not args.runtime.exists(), 'Preparation must use new empty roots')
    product = control.Q.check_source(args.source)
    args.evidence.mkdir(parents=True)
    args.runtime.mkdir(parents=True)
    (args.evidence / 'provenance').mkdir()
    own = Path(__file__).resolve().parents[2]
    save(args.evidence / 'preparation.json', {
        'releaseAcceptance': False, 'diagnostic': True, 'order': ORDER, 'maximumWorkloadLaunches': 2,
        'product': product, 'reviewedRevision': REVIEWED, 'reviewedHelperHashes': PINS,
        'candidateFiles': {name: digest(own / name) for name in CANDIDATES},
        'source': str(args.source), 'reviewed': str(args.reviewed),
        'outerSafetyCeilingSecondsPerTrial': CEILING_SECONDS,
        'policy': 'A truncated, unsafe, unproven or byte-drifted first trial blocks the second. No retries.',
    })


def run_pair(args, control):
    hosted_guard(os.environ, args.evidence, args.runtime)
    summary = {'releaseAcceptance': False, 'comparisonComplete': False, 'order': ORDER,
               'outcomes': {}, 'trialResults': {}, 'allWorkloadsPassed': False, 'error': None, 'maximumWorkloadLaunches': 2}
    # Single admission in these fixed paths; neither restart nor attempt-two reuse is supported.
    save(args.evidence / 'admission.json', {'runId': os.environ['GITHUB_RUN_ID'], 'attempt': 1,
                                         'orchestration': os.environ['GITHUB_SHA']})
    try:
        prep = read_json(args.evidence / 'preparation.json')
        own = Path(__file__).resolve().parents[2]
        require(prep['candidateFiles'] == {name: digest(own / name) for name in CANDIDATES}, 'Candidate changed after preparation')
        require(control.Q.git(own, 'rev-parse', 'HEAD') == os.environ['GITHUB_SHA'], 'Orchestration checkout mismatch')
        require(control.Q.git(args.reviewed.parents[1], 'rev-parse', 'HEAD') == REVIEWED, 'Wrong reviewed checkout')
        require(subprocess.check_output(['node', '--version'], text=True).strip() == 'v22.17.0', 'Wrong Node version')
        require(subprocess.check_output(['npm', '--version'], text=True).strip() == '10.9.2', 'Wrong npm version')
        require(platform.python_version() == '3.12.15', 'Wrong hosted Python version')
        safe_runtime_environment(os.environ)
        summary['runner'] = runner_identity(read_json(args.evidence / 'runner-identity.json'), os.environ['GITHUB_RUN_ID'])
        checkpoint(control, args.source, args.evidence, 'preflight')
        save(args.evidence / 'selftest-launch-admission.json', {'trial': 'selftest', 'runId': os.environ['GITHUB_RUN_ID']})
        require(invoke_supervisor('selftest', args) == 0, 'Benign Linux lifecycle self-test failed')
        proof = read_json(args.evidence / 'selftest/supervision.json')
        require(valid_supervision(proof) and proof['rootReturnCode'] == 0
                and any(r['pid'] != proof['rootIdentity']['pid'] and r['sid'] != proof['rootIdentity']['sid']
                        for r in proof['cleanup']['signals']), 'No proven adopted/new-session child in self-test')
        calibration = load_module(args.reviewed / 'linux-cpu-calibration.py', 'paired_calibration')
        save(args.evidence / 'runner-context.json', {
            'identity': summary['runner'], 'uname': list(platform.uname()),
            'imageOS': os.environ.get('ImageOS'), 'imageVersion': os.environ.get('ImageVersion'),
            'node': '22.17.0', 'npm': '10.9.2', 'python': platform.python_version(),
            'cpu': calibration.calibrate(os.getpid()),
            'cpuScope': 'Prelaunch orchestration-process context only; no utilization, contention or causal claim.',
            'supervision': 'Dedicated subreaper and one pidfd kernel wait per trial. No added process sampler during original workload.',
        })
        require(os.environ.get('ImageOS') and os.environ.get('ImageVersion'), 'Missing runner image identity')
        for index, label in enumerate(ORDER):
            require(not (args.evidence / label).exists() and not (args.runtime / label).exists(), 'Trial state already exists')
            checkpoint(control, args.source, args.evidence, label + '-before')
            # Inventory hashing can be expensive. Admit only on a fresh clock after it.
            save(args.evidence / (label + '-budget-admission.json'), admit_budget(summary['runner'], len(ORDER) - index))
            save(args.evidence / (label + '-launch-admission.json'), {'trial': label, 'runId': os.environ['GITHUB_RUN_ID'], 'index': index})
            code = invoke_supervisor(label, args)
            record = read_json(args.evidence / label / 'supervision.json')
            summary['trialResults'][label] = {'supervision': record, 'outcome': 'invalid-or-incomplete'}
            # Complete inventories are checked even if this supervision result is invalid.
            checkpoint(control, args.source, args.evidence, label + '-after')
            require(code == 0 and valid_supervision(record), label + ' safety/cleanup invalid; comparison incomplete')
            summary['outcomes'][label] = (original_outcome(control, args.evidence, record) if label == 'original'
                                          else passive_outcome(args.evidence, args.runtime, record))
            summary['trialResults'][label]['outcome'] = summary['outcomes'][label]
            save(args.evidence / label / 'outcome.json', {'validDiagnosticOutcome': True, 'outcome': summary['outcomes'][label]})
        summary['comparisonComplete'] = True
        summary['allWorkloadsPassed'] = all(summary['outcomes'][label] == 'pass' for label in ORDER)
        summary['interpretation'] = interpretation(**summary['outcomes'])
    except Exception as error:
        summary['error'] = type(error).__name__ + ': ' + str(error)
        summary['interpretation'] = 'Incomplete/invalid comparison. No causal, fix, acceptance or release conclusion. No additional trial.'
    save(args.evidence / 'paired-result.json', summary)
    print(json.dumps(summary))
    write_job_summary(summary)
    # A valid fail/pass comparison remains a failed job, so original failure is visible.
    return 0 if summary['comparisonComplete'] and summary['allWorkloadsPassed'] else 1


def write_job_summary(result):
    target = os.environ.get('GITHUB_STEP_SUMMARY')
    if not target:
        return
    lines = ['Same-runner diagnostic pair; release acceptance: false.',
             'Comparison complete: ' + str(result['comparisonComplete']).lower() + '.',
             'Both workloads passed: ' + str(result['allWorkloadsPassed']).lower() + '.']
    for label in ORDER:
        trial = result['trialResults'].get(label, {})
        proof = trial.get('supervision', {})
        lines.append(label + ': ' + trial.get('outcome', 'not launched') +
                     '; root exit=' + str(proof.get('rootReturnCode', 'unavailable')) +
                     '; truncated=' + str(proof.get('truncated', 'unavailable')) +
                     '; cleanup valid=' + str(proof.get('cleanupValid', 'unavailable')) + '.')
    lines.append(result['interpretation'])
    lines.append('Original raw logs/receipt/pixels and separate passive metadata are retained in the artifact. No retry is authorized.')
    with Path(target).open('a') as stream:
        stream.write('\n\n'.join(lines) + '\n')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', nargs='?', choices=('prepare', 'materialize', 'run', '_supervise'))
    for flag in ('source', 'reviewed', 'evidence', 'runtime', 'archive'):
        parser.add_argument('--' + flag, type=Path)
    parser.add_argument('--trial', choices=('selftest', *ORDER))
    args = parser.parse_args(argv)
    if args.phase is None:
        print('Inert paired-control helper. Explicit phase and isolated paths required.'); return 0
    for key in ('source', 'reviewed', 'evidence', 'runtime'):
        value = getattr(args, key)
        require(value is not None, 'Missing ' + key)
        setattr(args, key, value.resolve(strict=key in ('source', 'reviewed')))
    disjoint_outputs(args.source, args.reviewed, args.evidence, args.runtime)
    control = helpers(args.reviewed)
    if args.phase == 'prepare':
        prepare(args, control); return 0
    hosted_guard(os.environ, args.evidence, args.runtime)
    if args.phase == 'materialize':
        require(args.archive is not None, 'Retained archive required')
        require(not (args.evidence / 'provenance/package-before.json').exists(), 'Materialization is single-use')
        control.prepare_package(args.source, args.evidence / 'provenance', args.archive.resolve(strict=True)); return 0
    if args.phase == '_supervise':
        require(args.trial is not None and (args.evidence / 'admission.json').is_file(), 'Missing pair admission')
        admission = read_json(args.evidence / 'admission.json')
        require(admission == {'runId': os.environ['GITHUB_RUN_ID'], 'attempt': 1, 'orchestration': os.environ['GITHUB_SHA']},
                'Pair admission does not match this run')
        trial_admission = read_json(args.evidence / (args.trial + '-launch-admission.json'))
        require(trial_admission['trial'] == args.trial and trial_admission['runId'] == os.environ['GITHUB_RUN_ID'],
                'Missing/incorrect single-use trial admission')
        if args.trial == 'passive':
            prior = read_json(args.evidence / 'original/outcome.json')
            require(prior.get('validDiagnosticOutcome') is True and prior.get('outcome') in ('pass', 'fail')
                    and valid_supervision(read_json(args.evidence / 'original/supervision.json')),
                    'Passive launch lacks valid original barrier/outcome')
        return supervise(args.trial, args.source, args.reviewed, args.evidence, args.runtime)
    return run_pair(args, control)


if __name__ == '__main__':
    sys.exit(main())
