"""Offline tests: only inert Git fixtures; never launch a package or Linux fixture."""
import argparse
import importlib.util
import json
import os
import re
from datetime import timedelta
from pathlib import Path
import signal
import subprocess
import tempfile
import unittest
from unittest.mock import patch, Mock

SPEC = importlib.util.spec_from_file_location('paired', Path(__file__).with_name('linux-paired-control.py'))
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)


def row(pid=22, ppid=10, start=100, state='S'):
    return dict(pid=pid, ppid=ppid, pgid=pid, sid=pid, startTicks=start, state=state)


def valid(code=0):
    return {'naturalExit': True, 'truncated': False, 'cleanupValid': True,
            'error': None, 'rootReturnCode': code, 'rootIdentity': row(pid=40),
            'cleanup': {'provenEmpty': True, 'signals': [row(pid=42)], 'escalated': False}}


class IdentityTests(unittest.TestCase):
    def test_stat_ignores_parentheses_and_private_command(self):
        text = '22 (private ) command) S 10 22 22 ' + ' '.join(['0'] * 15) + ' 100 0'
        self.assertEqual(P.parse_stat(text), row())
        self.assertNotIn('private', json.dumps(P.parse_stat(text)))

    def test_bad_stat_is_rejected(self):
        for value in ('', '22 bad', '22 (x) S 1', '0 (x) S ' + '0 ' * 21):
            with self.subTest(value=value), self.assertRaises((ValueError, IndexError)):
                P.parse_stat(value)

    def test_non_child_never_opens_pidfd(self):
        opened = Mock()
        with self.assertRaisesRegex(ValueError, 'non-child'):
            P.open_owned(22, 10, read=lambda _: row(ppid=1), open_fd=opened)
        opened.assert_not_called()

    def test_reused_pid_is_rejected_and_fd_closed(self):
        closed = Mock()
        records = iter([row(), row(start=101)])
        with self.assertRaisesRegex(ValueError, 'changed PID'):
            P.open_owned(22, 10, read=lambda _: next(records), open_fd=lambda *_: 50, close_fd=closed)
        closed.assert_called_once_with(50)

    def test_parent_change_is_rejected_and_fd_closed(self):
        closed = Mock()
        records = iter([row(), row(ppid=11)])
        with self.assertRaisesRegex(ValueError, 'changed PID'):
            P.open_owned(22, 10, read=lambda _: next(records), open_fd=lambda *_: 50, close_fd=closed)
        closed.assert_called_once_with(50)

    def test_exit_race_closes_fd(self):
        read = Mock(side_effect=[row(), FileNotFoundError()])
        closed = Mock()
        with self.assertRaises(FileNotFoundError):
            P.open_owned(22, 10, read=read, open_fd=lambda *_: 50, close_fd=closed)
        closed.assert_called_once_with(50)

    def test_proven_live_identity_returns_open_pidfd(self):
        closed = Mock()
        self.assertEqual(P.open_owned(22, 10, read=lambda _: row(), open_fd=lambda *_: 50, close_fd=closed), (50, row()))
        closed.assert_not_called()

    def drain_scenario(self, at):
        clock = [0]
        replies = iter([(0, 0), (22, 15)])
        def wait(*_):
            try:
                answer = next(replies)
            except StopIteration:
                raise ChildProcessError()
            clock[0] = at if answer[0] == 0 else at + 1
            return answer
        with patch.object(P.time, 'monotonic', side_effect=lambda: clock[0]), \
             patch.object(P.time, 'sleep'), \
             patch.object(P.os, 'waitpid', side_effect=wait), \
             patch.object(P, 'child_pids', side_effect=[[22], []]), \
             patch.object(P, 'open_owned', return_value=(50, row())), \
             patch.object(P.signal, 'pidfd_send_signal', create=True) as sent, \
             patch.object(P.os, 'close') as closed:
            value = P.drain_children(10)
        return value, sent, closed

    def test_term_uses_only_verified_pidfd_then_reaps(self):
        value, sent, closed = self.drain_scenario(3)
        sent.assert_called_once_with(50, signal.SIGTERM, None, 0)
        closed.assert_called_once_with(50)
        self.assertTrue(value['provenEmpty'])
        self.assertFalse(value['escalated'])
        self.assertEqual(value['signals'][0]['startTicks'], 100)

    def test_sigkill_escalation_is_recorded_as_invalidating(self):
        value, sent, _ = self.drain_scenario(8)
        sent.assert_called_once_with(50, signal.SIGKILL, None, 0)
        self.assertTrue(value['escalated'])

    def test_echild_and_proc_disagreement_is_unsafe(self):
        with patch.object(P.os, 'waitpid', side_effect=ChildProcessError()), \
             patch.object(P, 'child_pids', return_value=[22]), \
             patch.object(P.signal, 'pidfd_send_signal', create=True) as sent:
            with self.assertRaisesRegex(ValueError, 'disagrees'):
                P.drain_children(10)
        sent.assert_not_called()

    def test_ownership_uncertainty_stops_without_signal(self):
        with patch.object(P.time, 'monotonic', return_value=3), \
             patch.object(P.os, 'waitpid', return_value=(0, 0)), \
             patch.object(P, 'child_pids', return_value=[22]), \
             patch.object(P, 'open_owned', side_effect=ValueError('uncertain ownership')), \
             patch.object(P.signal, 'pidfd_send_signal', create=True) as sent:
            with self.assertRaisesRegex(ValueError, 'uncertain'):
                P.drain_children(10)
        sent.assert_not_called()

    def test_drain_deadline_cannot_claim_empty(self):
        with patch.object(P.time, 'monotonic', side_effect=[0, 16, 16]), \
             patch.object(P, 'child_pids', return_value=[22]):
            value = P.drain_children(10)
        self.assertFalse(value['provenEmpty'])
        self.assertEqual(value.get('boundedOut'), 'deadline')

    def fake_reaping(self, total, seconds_per_reap=0, echild_seconds=0, proc_seconds=0):
        clock, count = [0], [0]
        def wait(*_):
            if count[0] < total:
                count[0] += 1
                clock[0] += seconds_per_reap
                return 1000 + count[0], 0
            clock[0] += echild_seconds
            raise ChildProcessError()
        def children(_):
            clock[0] += proc_seconds
            return []
        with patch.object(P.time, 'monotonic', side_effect=lambda: clock[0]), \
             patch.object(P.time, 'sleep'), patch.object(P.os, 'waitpid', side_effect=wait) as waited, \
             patch.object(P, 'child_pids', side_effect=children), \
             patch.object(P.signal, 'pidfd_send_signal', create=True) as sent:
            value = P.drain_children(10)
        sent.assert_not_called()
        return value, waited.call_count

    def test_review_300_exits_cannot_reap_for_300_seconds(self):
        value, calls = self.fake_reaping(300, seconds_per_reap=1)
        self.assertFalse(value['provenEmpty'])
        self.assertEqual(value.get('boundedOut'), 'deadline')
        self.assertLessEqual(calls, P.CLEANUP_SECONDS)
        self.assertLessEqual(len(value['reaped']), P.MAX_CHILDREN)

    def test_review_one_reap_past_deadline_cannot_accept_following_echild(self):
        value, calls = self.fake_reaping(1, seconds_per_reap=16)
        self.assertFalse(value['provenEmpty'])
        self.assertEqual(value.get('boundedOut'), 'deadline')
        self.assertEqual(calls, 1)

    def test_review_257_or_300_exits_exhaust_total_reap_budget(self):
        for total in (256, 257, 300):
            with self.subTest(total=total):
                value, calls = self.fake_reaping(total)
                self.assertFalse(value['provenEmpty'])
                self.assertEqual(value.get('boundedOut'), 'child-accounting-limit')
                self.assertEqual(calls, P.MAX_CHILDREN)
                self.assertEqual(len(value['reaped']), P.MAX_CHILDREN)

    def test_echild_itself_after_deadline_cannot_claim_empty(self):
        value, _ = self.fake_reaping(0, echild_seconds=16)
        self.assertFalse(value['provenEmpty'])
        self.assertEqual(value.get('boundedOut'), 'deadline')

    def test_proc_confirmation_after_deadline_cannot_claim_empty(self):
        value, _ = self.fake_reaping(0, proc_seconds=16)
        self.assertFalse(value['provenEmpty'])
        self.assertEqual(value.get('boundedOut'), 'deadline')

    def test_reaped_and_live_identities_share_one_conservative_bound(self):
        replies = iter([(pid, 0) for pid in range(1000, 1255)] + [(0, 0)])
        with patch.object(P.time, 'monotonic', return_value=0), \
             patch.object(P.time, 'sleep'), \
             patch.object(P.os, 'waitpid', side_effect=lambda *_: next(replies)), \
             patch.object(P, 'child_pids', return_value=[22]), \
             patch.object(P, 'open_owned', return_value=(50, row())), \
             patch.object(P.signal, 'pidfd_send_signal', create=True) as sent, \
             patch.object(P.os, 'close') as closed:
            value = P.drain_children(10)
        self.assertFalse(value['provenEmpty'])
        self.assertEqual(value.get('boundedOut'), 'child-accounting-limit')
        self.assertEqual(value.get('accountedChildren'), 256)
        sent.assert_not_called()
        closed.assert_called_once_with(50)

    def test_unsupported_platform_cannot_enable_subreaper(self):
        with patch.object(P.sys, 'platform', 'darwin'), patch.object(P.ctypes, 'CDLL') as library:
            with self.assertRaisesRegex(ValueError, 'Unsupported'):
                P.enable_subreaper()
        library.assert_not_called()


class SupervisorTests(unittest.TestCase):
    def fake_supervision(self, *, timeout=False, leftover=False, escalated=False, wrong_session=False, unsupported=False, bounded=False):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            evidence, runtime = root / 'evidence', root / 'runtime'
            evidence.mkdir(); runtime.mkdir()
            child = Mock(pid=30)
            child.wait.return_value = 0
            def launch(*_args, **_kwargs):
                if leftover:
                    (runtime / 'original/tmp/solomon-darker-smoke-leftover').mkdir()
                return child
            poll = Mock()
            poll.poll.return_value = [] if timeout else [(50, P.select.POLLIN)]
            identity = row(pid=30, ppid=os.getpid())
            if wrong_session:
                identity['sid'] = 1
            cleanup = dict(provenEmpty=True, escalated=escalated, signals=[], reaped=[],
                           boundedOut="deadline" if bounded else None)
            with patch.object(P, 'enable_subreaper', side_effect=ValueError('unsupported') if unsupported else None), \
                 patch.object(P.subprocess, 'Popen', side_effect=launch) as popen, \
                 patch.object(P, 'open_owned', return_value=(50, identity)), \
                 patch.object(P.select, 'poll', return_value=poll, create=True), \
                 patch.object(P.os, 'close'), patch.object(P, 'drain_children', return_value=cleanup):
                code = P.supervise('original', Path('/product'), Path('/reviewed'), evidence, runtime)
            return code, P.read_json(evidence / 'original/supervision.json'), popen, child, poll

    def test_natural_exit_has_one_kernel_wait_and_original_command(self):
        code, result, popen, child, poll = self.fake_supervision()
        self.assertEqual(code, 0)
        self.assertEqual(popen.call_count, 1)
        self.assertEqual(popen.call_args.args[0], ['xvfb-run', '-a', 'npm', 'run', 'smoke:desktop'])
        self.assertTrue(popen.call_args.kwargs['start_new_session'])
        self.assertNotIn('SDR_DESKTOP_APP', popen.call_args.kwargs['env'])
        poll.poll.assert_called_once_with(360000)
        child.wait.assert_called_once_with()
        self.assertTrue(result['cleanupValid'])

    def test_outer_ceiling_invalidates_even_after_complete_cleanup(self):
        code, result, _, child, _ = self.fake_supervision(timeout=True)
        self.assertEqual(code, 1)
        self.assertTrue(result['truncated'])
        self.assertTrue(result['cleanupValid'])
        self.assertFalse(result['naturalExit'])
        child.wait.assert_not_called()

    def test_remaining_profile_blocks_second_trial(self):
        code, result, *_ = self.fake_supervision(leftover=True)
        self.assertEqual(code, 1)
        self.assertFalse(result['cleanupValid'])
        self.assertEqual(result['profileDirectoriesRemaining'], ['solomon-darker-smoke-leftover'])

    def test_kill_escalation_invalidates_even_after_reaping(self):
        code, result, *_ = self.fake_supervision(escalated=True)
        self.assertEqual(code, 1)
        self.assertFalse(result['cleanupValid'])

    def test_bounded_cleanup_cannot_validate_even_with_contradictory_empty_flag(self):
        code, result, *_ = self.fake_supervision(bounded=True)
        self.assertEqual(code, 1)
        self.assertFalse(result['cleanupValid'])

    def test_nonexclusive_root_session_invalidates(self):
        code, result, *_ = self.fake_supervision(wrong_session=True)
        self.assertEqual(code, 1)
        self.assertIn('exclusive session', result['error'])

    def test_failed_subreaper_capability_launches_nothing(self):
        code, result, popen, *_ = self.fake_supervision(unsupported=True)
        self.assertEqual(code, 1)
        self.assertIn('unsupported', result['error'])
        popen.assert_not_called()


class ContractTests(unittest.TestCase):
    def test_reviewed_sparse_checkout_materializes_immutable_suite_inputs(self):
        workflow = (Path(__file__).resolve().parents[2] / '.github/workflows/linux-paired-control.yml').read_text()
        step = workflow.split('      - name: Check out immutable reviewed verification and passive helpers\n', 1)[1].split('      - name:', 1)[0]
        self.assertIn('          ref: ' + P.REVIEWED + '\n', step)
        self.assertIn('          path: reviewed-tools\n', step)
        self.assertIn('          persist-credentials: false\n', step)
        self.assertIn('          sparse-checkout-cone-mode: false\n', step)
        patterns = step.split('          sparse-checkout: |\n', 1)[1].split('          sparse-checkout-cone-mode:', 1)[0]
        patterns = '\n'.join(line.strip() for line in patterns.splitlines()) + '\n'
        required = ('.github/workflows/linux-launch-diagnostic.yml',
                    'tools/diagnostics/linux-launch-diagnostic.test.mjs',
                    'tools/diagnostics/linux-launch-diagnostic.mjs',
                    'tools/diagnostics/linux-launch-observer.mjs',
                    'tools/diagnostics/linux-cpu-calibration.test.py',
                    'tools/diagnostics/linux-cpu-calibration.py')
        excluded = ('.github/workflows/validate.yml', 'frontend/package.json')
        # Use real non-cone matching in a throwaway Git tree. No commit, fetch,
        # helper execution or product process is needed to expose missing inputs.
        with tempfile.TemporaryDirectory(prefix='paired-sparse-fixture-') as directory:
            root = Path(directory)

            def git(*args, input=None):
                return subprocess.run(['git', '-C', str(root), *args], input=input,
                                      text=True, capture_output=True, check=True, timeout=10).stdout.strip()

            git('init', '--quiet')
            for path in required + excluded:
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('inert fixture: ' + path + '\n')
            git('add', '--all')
            tree = git('write-tree')
            git('sparse-checkout', 'set', '--no-cone', '--stdin', input=patterns)
            git('read-tree', '-mu', tree)
            for path in required:
                self.assertEqual((root / path).read_text(), 'inert fixture: ' + path + '\n', path)
            for path in excluded:
                self.assertFalse((root / path).exists(), path)

    def test_paired_workflow_uses_legal_job_env_and_current_step_exports(self):
        workflow = (Path(__file__).resolve().parents[2] / '.github/workflows/linux-paired-control.yml').read_text()
        env = workflow.split('    env:\n', 1)[1].split('    defaults:', 1)[0]
        allowed = {'github', 'needs', 'strategy', 'matrix', 'vars', 'secrets', 'inputs'}
        contexts = set(re.findall(r'\$\{\{\s*([a-zA-Z_]+)\.', env))
        self.assertLessEqual(contexts, allowed)
        self.assertNotIn('PAIR_EVIDENCE:', env)
        self.assertNotIn('PAIR_RUNTIME:', env)
        step = workflow.split('      - name: Check inert pair contract and prepare fresh evidence roots\n', 1)[1].split('      - name:', 1)[0]
        for name, suffix in (('PAIR_EVIDENCE', 'linux-paired-evidence'), ('PAIR_RUNTIME', 'linux-paired-runtime')):
            export = 'export ' + name + '="$RUNNER_TEMP/' + suffix + '"'
            self.assertIn(export, step)
            self.assertLess(step.index(export), step.index('python3'))
            self.assertIn('"' + name + '=$' + name + '"', step)
        self.assertIn('>> "$GITHUB_ENV"', step)
        self.assertLess(step.index('>> "$GITHUB_ENV"'), step.index('python3'))

    def test_exact_fixed_commands_and_order(self):
        self.assertEqual(P.ORDER, ('original', 'passive'))
        self.assertEqual(P.trial_command('original', Path('/reviewed')), ['xvfb-run', '-a', 'npm', 'run', 'smoke:desktop'])
        self.assertEqual(P.trial_command('passive', Path('/reviewed')),
                         ['xvfb-run', '-a', 'node', '/reviewed/linux-launch-diagnostic.mjs', '--run'])
        with self.assertRaises(ValueError):
            P.trial_command('extra', Path('/reviewed'))

    def test_default_cli_is_inert(self):
        with patch.object(P.subprocess, 'Popen') as launch:
            self.assertEqual(P.main([]), 0)
        launch.assert_not_called()

    def test_supervision_validity_never_turns_timeout_into_pass(self):
        self.assertTrue(P.valid_supervision(valid()))
        self.assertTrue(P.valid_supervision(valid(1)), 'A natural workload failure may be a valid diagnostic outcome')
        for key, value in [('truncated', True), ('cleanupValid', False), ('naturalExit', False),
                           ('error', 'failed'), ('rootReturnCode', -9), ('rootReturnCode', None)]:
            with self.subTest(key=key):
                self.assertFalse(P.valid_supervision(dict(valid(), **{key: value})))

    def test_paths_are_disjoint(self):
        P.disjoint_outputs(Path('/product'), Path('/reviewed'), Path('/evidence'), Path('/runtime'))
        for evidence, runtime in [('/product/out', '/runtime'), ('/evidence', '/evidence/runtime'),
                                  ('/', '/runtime'), ('/evidence', '/reviewed/runtime')]:
            with self.subTest(evidence=evidence, runtime=runtime), self.assertRaises(ValueError):
                P.disjoint_outputs(Path('/product'), Path('/reviewed'), Path(evidence), Path(runtime))

    def test_evidence_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as root:
            file = Path(root) / 'record.json'
            P.save(file, {'original': True})
            with self.assertRaises(FileExistsError):
                P.save(file, {'overwritten': True})
            self.assertEqual(P.read_json(file), {'original': True})

    def test_numeric_runner_identity_is_required(self):
        value = dict(id=8, run_id=9, run_attempt=1, runner_id=10, runner_group_id=0, status='in_progress', conclusion=None)
        self.assertEqual(P.runner_identity([value], '9'), value)
        for changed in [dict(value, runner_id=None), dict(value, runner_id=True), dict(value, run_attempt=2),
                        dict(value, status='completed'), dict(value, run_id=8)]:
            with self.subTest(value=changed), self.assertRaises(ValueError):
                P.runner_identity([changed], '9')
        for rows in ([], [value, value]):
            with self.assertRaises(ValueError):
                P.runner_identity(rows, '9')

    def test_matrix_covers_exactly_four_cases_and_no_cause(self):
        for original in ('pass', 'fail'):
            for passive in ('pass', 'fail'):
                self.assertTrue(P.interpretation(original, passive))
        with self.assertRaises(KeyError):
            P.interpretation('not-run', 'pass')

    def test_m2_run_is_blocked_before_any_launch(self):
        with patch.object(P.sys, 'platform', 'darwin'), patch.object(P.subprocess, 'Popen') as launch:
            with self.assertRaisesRegex(ValueError, 'Linux x64'):
                P.hosted_guard({}, Path('/evidence'), Path('/runtime'))
        launch.assert_not_called()


    def test_remaining_budget_is_fixed_and_fail_closed(self):
        start = P.datetime(2026, 10, 15, 22, 0, tzinfo=P.timezone.utc)
        runner = {'started_at': start.isoformat()}
        self.assertEqual(P.admit_budget(runner, 2, now=start)['requiredSeconds'], 990)
        self.assertEqual(P.admit_budget(runner, 1, now=start)['requiredSeconds'], 585)
        from datetime import timedelta
        self.assertEqual(P.admit_budget(runner, 2, now=start + timedelta(seconds=210))['remainingSeconds'], 990)
        for left, elapsed in ((2, 211), (1, 616), (1, 1201), (1, -1)):
            with self.subTest(left=left, elapsed=elapsed), self.assertRaises(ValueError):
                P.admit_budget(runner, left, now=start + timedelta(seconds=elapsed))
        with self.assertRaises(ValueError):
            P.admit_budget({'started_at': '2026-10-15T22:00:00'}, 1, now=start)

    def test_debug_overrides_cannot_instrument_original(self):
        P.safe_runtime_environment({})
        for name in ('DEBUG', 'PWDEBUG', 'NODE_OPTIONS', 'NODE_PATH', 'npm_config_debug', 'ELECTRON_RUN_AS_NODE'):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'override'):
                P.safe_runtime_environment({name: 'private-value'})

    def test_second_admission_is_write_once(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'passive-launch-admission.json'
            P.save(path, {'trial': 'passive'})
            with self.assertRaises(FileExistsError):
                P.save(path, {'trial': 'passive'})


class PairStoppingTests(unittest.TestCase):
    def run_fake(self, *, invalid=None, inventory_failure=None, budget_failure=None,
                 expired_checkpoint=None, checkpoint_elapsed=800, cleanup_bounded=None,
                 first_outcome='fail', second_outcome='pass'):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            evidence, runtime = root / 'evidence', root / 'runtime'
            evidence.mkdir(); runtime.mkdir()
            args = argparse.Namespace(evidence=evidence, runtime=runtime, source=Path('/product'),
                                      reviewed=Path('/reviewed/tools/diagnostics'))
            P.save(evidence / 'preparation.json', {'candidateFiles': {name: 'sha' for name in P.CANDIDATES}})
            start = P.datetime(2026, 10, 15, 22, 0, tzinfo=P.timezone.utc)
            elapsed = [200]
            actual_budget = P.admit_budget
            P.save(evidence / 'runner-identity.json', [dict(started_at=start.isoformat(), id=1, run_id=9, run_attempt=1, runner_id=3,
                                                         runner_group_id=0, status='in_progress', conclusion=None)])
            calls = []
            control = Mock()
            control.Q.git.side_effect = ['a' * 40, P.REVIEWED]
            def invoke(label, _args):
                calls.append(label)
                (evidence / label).mkdir()
                proof = valid(1 if (label == 'original' and first_outcome == 'fail') or (label == 'passive' and second_outcome == 'fail') else 0)
                if label == invalid:
                    proof['truncated'] = True
                if label == cleanup_bounded:
                    proof['cleanupValid'] = False
                    proof['cleanup']['provenEmpty'] = False
                    proof['cleanup']['boundedOut'] = 'child-accounting-limit'
                P.save(evidence / label / 'supervision.json', proof)
                return 1 if label == invalid else 0
            def checkpoint(_c, _s, _e, suffix):
                if suffix == expired_checkpoint:
                    elapsed[0] = checkpoint_elapsed
                if suffix == inventory_failure:
                    raise ValueError('inventory mismatch')
            def budget(_runner, left):
                if expired_checkpoint is not None:
                    return actual_budget(_runner, left, now=start + timedelta(seconds=elapsed[0]))
                if left == budget_failure:
                    raise ValueError('budget exhausted')
                return {'synthetic': True}
            env = dict(GITHUB_RUN_ID='9', GITHUB_SHA='a' * 40, ImageOS='ubuntu', ImageVersion='test')
            with patch.dict(os.environ, env), patch.object(P, 'hosted_guard'), \
                 patch.object(P, 'write_job_summary'), \
                 patch.object(P, 'admit_budget', side_effect=budget), \
                 patch.object(P.platform, 'uname', return_value=('test',) * 6), \
                 patch.object(P, 'digest', return_value='sha'), \
                 patch.object(P, 'checkpoint', side_effect=checkpoint), \
                 patch.object(P, 'invoke_supervisor', side_effect=invoke), \
                 patch.object(P.subprocess, 'check_output', side_effect=['v22.17.0\n', '10.9.2\n']), \
                 patch.object(P.platform, 'python_version', return_value='3.12.15'), \
                 patch.object(P, 'load_module', return_value=Mock(calibrate=lambda _: {})), \
                 patch.object(P, 'original_outcome', return_value=first_outcome), \
                 patch.object(P, 'passive_outcome', return_value=second_outcome), \
                 patch('builtins.print'):
                code = P.run_pair(args, control)
            return code, calls, P.read_json(evidence / 'paired-result.json')

    def test_valid_pair_is_exactly_one_original_then_one_passive(self):
        code, calls, result = self.run_fake()
        self.assertEqual(code, 1, 'Original failure must remain visible as a failed job')
        self.assertEqual(calls, ['selftest', 'original', 'passive'])
        self.assertEqual(result['outcomes'], {'original': 'fail', 'passive': 'pass'})
        self.assertTrue(result['comparisonComplete'])
        self.assertFalse(result['releaseAcceptance'])

    def test_failed_lifecycle_preflight_launches_no_package(self):
        code, calls, result = self.run_fake(invalid='selftest')
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest'])
        self.assertFalse(result['comparisonComplete'])

    def test_invalid_first_supervision_blocks_second(self):
        code, calls, result = self.run_fake(invalid='original')
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest', 'original'])
        self.assertEqual(result['outcomes'], {})

    def test_first_post_inventory_failure_blocks_second(self):
        code, calls, result = self.run_fake(inventory_failure='original-after')
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest', 'original'])
        self.assertIn('inventory mismatch', result['error'])

    def test_initial_inventory_failure_launches_nothing(self):
        code, calls, _ = self.run_fake(inventory_failure='preflight')
        self.assertEqual(code, 1)
        self.assertEqual(calls, [])

    def test_second_invalid_never_repeats_or_adds_variants(self):
        code, calls, result = self.run_fake(invalid='passive')
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest', 'original', 'passive'])
        self.assertEqual(result['outcomes'], {'original': 'fail'})
        self.assertFalse(result['comparisonComplete'])

    def test_insufficient_second_budget_blocks_passive(self):
        code, calls, result = self.run_fake(budget_failure=1)
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest', 'original'])
        self.assertEqual(result['outcomes'], {'original': 'fail'})
        self.assertIn('budget exhausted', result['error'])

    def test_insufficient_initial_budget_launches_no_package(self):
        code, calls, _ = self.run_fake(budget_failure=2)
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest'])

    def test_review_expensive_original_checkpoint_blocks_stale_admission(self):
        code, calls, result = self.run_fake(expired_checkpoint='original-before')
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest'])
        self.assertFalse(result['comparisonComplete'])
        self.assertEqual(result['outcomes'], {})
        self.assertIn('budget', result['error'].lower())

    def test_review_expensive_passive_checkpoint_blocks_stale_admission(self):
        code, calls, result = self.run_fake(expired_checkpoint='passive-before')
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest', 'original'])
        self.assertFalse(result['comparisonComplete'])
        self.assertEqual(result['outcomes'], {'original': 'fail'})
        self.assertIn('budget', result['error'].lower())

    def test_invalid_clock_after_either_checkpoint_blocks_launch(self):
        for label, calls in [('original', ['selftest']), ('passive', ['selftest', 'original'])]:
            with self.subTest(label=label):
                code, actual, result = self.run_fake(expired_checkpoint=label + '-before', checkpoint_elapsed=-1)
                self.assertEqual(code, 1)
                self.assertEqual(actual, calls)
                self.assertFalse(result['comparisonComplete'])

    def test_cleanup_limit_blocks_dependent_second_trial(self):
        code, calls, result = self.run_fake(cleanup_bounded='original')
        self.assertEqual(code, 1)
        self.assertEqual(calls, ['selftest', 'original'])
        self.assertFalse(result['comparisonComplete'])

    def test_all_four_valid_pairs_remain_diagnostic(self):
        for first in ('pass', 'fail'):
            for second in ('pass', 'fail'):
                with self.subTest(first=first, second=second):
                    code, calls, result = self.run_fake(first_outcome=first, second_outcome=second)
                    self.assertEqual(code, 0 if first == second == 'pass' else 1)
                    self.assertEqual(result['allWorkloadsPassed'], first == second == 'pass')
                    self.assertTrue(result['comparisonComplete'])
                    self.assertEqual(calls, ['selftest', 'original', 'passive'])
                    self.assertFalse(result['releaseAcceptance'])


if __name__ == '__main__':
    unittest.main()
