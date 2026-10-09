import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'tools/ci-mutation-diagnostics.py'
spec = importlib.util.spec_from_file_location('ci_mutation_diagnostics', SCRIPT)
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)


def mutant(identifier, status='Killed'):
    return {'id': identifier, 'status': status, 'mutatorName': 'BooleanLiteral',
            'replacement': 'false', 'location': {'start': {'line': 1, 'column': 1},
                                               'end': {'line': 1, 'column': 5}}}


def fixture():
    return {'files': {'src/b.ts': {'source': 'true', 'mutants': [mutant('10'), mutant('2', 'Ignored')]},
                      'src/a.ts': {'source': 'true', 'mutants': [mutant('1', 'CompileError')]}}}


class MutationDiagnosticsTests(unittest.TestCase):
    def test_inventory_is_independent_of_file_mutant_and_location_key_order(self):
        original = fixture()
        reordered = copy.deepcopy(original)
        reordered['files'] = dict(reversed(list(reordered['files'].items())))
        for file in reordered['files'].values():
            file['mutants'].reverse()
            for item in file['mutants']:
                item['location'] = dict(reversed(list(item['location'].items())))
        self.assertEqual(diagnostics.summarize_mutation(original), diagnostics.summarize_mutation(reordered))

    def test_all_generated_statuses_are_counted(self):
        report = fixture()
        statuses = ['Killed', 'Survived', 'Timeout', 'NoCoverage', 'Ignored', 'CompileError', 'RuntimeError', 'Pending']
        report['files']['src/b.ts']['mutants'] = [mutant(str(i), status) for i, status in enumerate(statuses)]
        result = diagnostics.summarize_mutation(report)
        self.assertEqual(result['generated_mutants'], 9)
        self.assertEqual(result['file_count'], 2)
        self.assertEqual(result['statuses']['CompileError'], 2)
        self.assertEqual(set(result['statuses']), set(statuses))

    def test_inventory_digest_changes_if_a_mutant_is_removed(self):
        original = fixture()
        changed = copy.deepcopy(original)
        changed['files']['src/b.ts']['mutants'].pop()
        self.assertNotEqual(diagnostics.summarize_mutation(original)['inventory_sha256'],
                            diagnostics.summarize_mutation(changed)['inventory_sha256'])

    def test_inventory_digest_covers_identity_and_source_but_not_outcome(self):
        original = fixture()
        expected = diagnostics.summarize_mutation(original)['inventory_sha256']
        for key, value in [('id', 'different'), ('replacement', 'true'), ('mutatorName', 'Other'),
                           ('location', {'start': {'line': 2, 'column': 1}, 'end': {'line': 2, 'column': 5}})]:
            changed = copy.deepcopy(original)
            changed['files']['src/b.ts']['mutants'][0][key] = value
            self.assertNotEqual(expected, diagnostics.summarize_mutation(changed)['inventory_sha256'])
        changed = copy.deepcopy(original)
        changed['files']['src/b.ts']['source'] = 'false'
        self.assertNotEqual(expected, diagnostics.summarize_mutation(changed)['inventory_sha256'])
        changed = copy.deepcopy(original)
        changed['files']['src/b.ts']['mutants'][0]['status'] = 'Timeout'
        self.assertEqual(expected, diagnostics.summarize_mutation(changed)['inventory_sha256'])

    def test_duplicate_ids_in_one_file_are_rejected(self):
        report = fixture()
        report['files']['src/b.ts']['mutants'].append(mutant('2'))
        with self.assertRaisesRegex(ValueError, 'Duplicate mutant ID'):
            diagnostics.summarize_mutation(report)

    def test_same_id_in_different_files_remains_distinct(self):
        report = fixture()
        report['files']['src/a.ts']['mutants'][0]['id'] = '2'
        self.assertEqual(diagnostics.summarize_mutation(report)['generated_mutants'], 3)

    def test_missing_report_is_not_presented_as_success(self):
        with tempfile.TemporaryDirectory() as directory:
            result = diagnostics.collect(Path(directory))
        self.assertTrue(result['diagnostic_only'])
        self.assertEqual(result['mutation_report'], 'unavailable')
        self.assertIn('not a passing result', result['limitation'])
        self.assertNotIn('mutation', result)
        self.assertNotIn('quality_summary', result)

    def test_cli_reports_final_inventory_without_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'mutation').mkdir()
            path = root / 'mutation/mutation.json'
            path.write_text(json.dumps(fixture()))
            before = path.read_bytes()
            result = subprocess.run([sys.executable, str(SCRIPT), '--directory', str(root)],
                                    capture_output=True, text=True, check=True)
            output = json.loads(result.stdout)
            self.assertEqual(output['mutation']['generated_mutants'], 3)
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(sorted(p.name for p in root.iterdir()), ['mutation'])

    def test_invalid_final_report_is_not_silently_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'mutation').mkdir()
            (root / 'mutation/mutation.json').write_text('{invalid')
            result = subprocess.run([sys.executable, str(SCRIPT), '--directory', str(root)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)

    def test_workflow_preserves_gate_runner_permissions_and_failure_propagation(self):
        workflow = (ROOT / '.github/workflows/validate.yml').read_text()
        self.assertIn('runs-on: ubuntu-latest', workflow)
        self.assertIn('timeout-minutes: 150', workflow)
        self.assertIn('permissions:\n  contents: read', workflow)
        self.assertIn('run: /usr/bin/time -v ./scripts/validate.sh\n', workflow)
        self.assertIn('if: ${{ always() }}', workflow)
        self.assertNotIn('continue-on-error', workflow)
        self.assertNotIn('|| true', workflow)


if __name__ == '__main__':
    unittest.main()
