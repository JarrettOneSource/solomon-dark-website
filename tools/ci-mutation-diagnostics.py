"""Bounded, read-only diagnostics; never a substitute for the renderer quality gate."""

import argparse
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True)


def summarize_mutation(report):
    inventory = []
    files = []
    totals = Counter()
    for filename, file in sorted(report['files'].items()):
        source_hash = sha256(file['source'].encode('utf-8')).hexdigest()
        counts = Counter()
        ids = set()
        for mutant in file['mutants']:
            mutant_id = str(mutant['id'])
            if mutant_id in ids:
                raise ValueError(f'Duplicate mutant ID in {filename}: {mutant_id}')
            ids.add(mutant_id)
            counts[mutant['status']] += 1
            # Serialize before sorting: IDs are strings and locations are objects.
            # Include every generated mutant, even ignored or non-testable ones.
            inventory.append(canonical_json({
                'file': filename,
                'source_sha256': source_hash,
                'id': mutant_id,
                'mutator': mutant['mutatorName'],
                'location': mutant['location'],
                'replacement': mutant['replacement'],
            }))
        totals.update(counts)
        files.append({'file': filename, 'source_sha256': source_hash,
                      'generated_mutants': len(file['mutants']), 'statuses': dict(sorted(counts.items()))})
    canonical_inventory = '\n'.join(sorted(inventory)) + '\n'
    return {'file_count': len(files), 'generated_mutants': sum(totals.values()),
            'inventory_sha256': sha256(canonical_inventory.encode('utf-8')).hexdigest(),
            'statuses': dict(sorted(totals.items())), 'files': files}


def collect(directory):
    result = {'measured_at': datetime.now(timezone.utc).isoformat(),
              'diagnostic_only': True, 'mutation_report': 'unavailable'}
    mutation_path = directory / 'mutation/mutation.json'
    if mutation_path.is_file():
        result['mutation_report'] = 'available'
        result['mutation'] = summarize_mutation(json.loads(mutation_path.read_text()))
    else:
        result['limitation'] = 'No final mutation report; incomplete progress is not a passing result.'
    summary_path = directory / 'summary.json'
    if summary_path.is_file():
        summary = json.loads(summary_path.read_text())
        result['quality_summary'] = {
            key: summary[key] for key in ['measuredAt', 'coverage', 'mutation', 'failures'] if key in summary
        }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path('frontend/reports/renderer-quality'))
    args = parser.parse_args()
    print(json.dumps(collect(args.directory), sort_keys=True, indent=2))


if __name__ == '__main__':
    main()
