import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { NATIVE_SKILL_CATALOG } from './player-progression.ts'

const LEDGER_HEADING = '### 2026-08-21 v49 complete 82-row effect and presentation ledger'
const ledger = readFileSync(
  new URL('../../../../docs/game-native-parity-re.md', import.meta.url),
  'utf8',
).split(LEDGER_HEADING)[1]?.split('The mechanical property audit')[0]

test('the parity ledger names every compiled skill and explicitly closes its light/audio disposition', () => {
  assert.ok(ledger, 'the authoritative 82-row closure ledger is missing')
  const rows = [...ledger.matchAll(
    /^\| (\d+) ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm,
  )]
  assert.equal(rows.length, 82)
  const ids = rows.map((match) => Number(match[1]))
  assert.deepEqual(ids, Array.from({ length: 82 }, (_, id) => id))
  for (const [index, match] of rows.entries()) {
    const skill = NATIVE_SKILL_CATALOG[index]!
    assert.equal(`${match[1]} ${match[2]!.trim()}`, `${skill.id} ${skill.name}`)
    assert.ok(match[3]!.trim().length > 0, `skill ${skill.id} has no effect disposition`)
    assert.match(match[4]!, /light/i, `skill ${skill.id} has no explicit light disposition`)
    assert.match(match[4]!, /audio|cue|loop|sound/i, `skill ${skill.id} has no audio disposition`)
    assert.match(match[5]!, /closed/, `skill ${skill.id} is not closed`)
  }
})
