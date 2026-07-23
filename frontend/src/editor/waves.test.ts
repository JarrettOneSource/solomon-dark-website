import assert from 'node:assert/strict'
import test from 'node:test'

import type { WaveDef } from './waves.ts'
import { parseWaveText, serializeWaveText, validateWaves } from './waves.ts'

const schedule: WaveDef[] = [
  {
    spawn: 14,
    spawnDelay: [50, 300],
    waveDelay: [100, 300],
    maxEnemies: 40,
    next: [1],
    groups: [
      { entries: [{ enemy: 'SKELETON', flags: ['FLAG_WEAK', 'FLAG_HPDOWN'] }] },
      {
        entries: [
          { enemy: 'SKELETON', flags: [] },
          { enemy: 'SKELETONARCHER', flags: ['FLAG_RANGEDOWN'] },
        ],
      },
    ],
  },
  {
    spawn: 20,
    spawnDelay: [40, 200],
    waveDelay: [80, 220],
    maxEnemies: 55,
    zombieWave: true,
    next: [0, 1],
    groups: [{ entries: [{ enemy: 'ZOMBIE', flags: ['FLAG_ROTTEN'] }] }],
  },
]

test('wave schedules survive a serialize/parse round trip', () => {
  const text = serializeWaveText(schedule)
  const parsed = parseWaveText(text)
  assert.deepEqual(parsed, schedule)
})

test('serialized schedules use the retail dialect', () => {
  const text = serializeWaveText(schedule)
  assert.match(text, /^WAVE\n\tNEXT:1\n\tSPAWN:14\n/)
  assert.ok(text.includes('\tSPAWNDELAY:50-300\n'))
  assert.ok(text.includes('\tZOMBIEWAVE\n'))
  assert.ok(text.includes('\t\tSKELETON:FLAG_WEAK|FLAG_HPDOWN\n'))
  assert.ok(text.includes('\t\tSKELETON\n'), 'flagless entries serialize as bare tokens')
  assert.ok(text.includes('\tENDWAVE\n'))
})

test('the stock dialect parses: FORMATION, WAVE:0 suffixes, comments, no ENDWAVE', () => {
  const parsed = parseWaveText(
    [
      '# a marginal note',
      'WAVE:0',
      '\tNEXT:1',
      '\tSPAWN:25',
      '\tSPAWNDELAY:20-50',
      '\tWAVEDELAY:40-60',
      '\tMAXENEMIES:70',
      '\tFORMATION',
      '\t\tskeletonmage:flag_hpdown',
      'WAVE',
      '\tSPAWN:5',
      '\tSPAWNDELAY:1-2',
      '\tWAVEDELAY:1-2',
      '\tMAXENEMIES:10',
      '\tGROUP',
      '\t\tIMP',
    ].join('\n'),
  )
  assert.equal(parsed.length, 2)
  assert.deepEqual(parsed[0].groups, [
    { entries: [{ enemy: 'SKELETONMAGE', flags: ['FLAG_HPDOWN'] }] },
  ])
  assert.deepEqual(parsed[1].groups, [{ entries: [{ enemy: 'IMP', flags: [] }] }])
})

test('unknown enemy tokens are rejected like the loader rejects them', () => {
  assert.throws(
    () => parseWaveText('WAVE\n\tSPAWN:5\n\tGROUP\n\t\tDRAGON:FLAG_WEAK\n'),
    /Unknown enemy token/,
  )
})

test('validation mirrors the loader acceptance rules', () => {
  assert.deepEqual(validateWaves(schedule), [])
  const broken: WaveDef[] = [
    {
      spawn: 0,
      spawnDelay: [10, 5],
      waveDelay: [0, 0],
      maxEnemies: 0,
      next: [7],
      groups: [],
    },
  ]
  const problems = validateWaves(broken)
  assert.ok(problems.some((p) => p.includes('SPAWN')))
  assert.ok(problems.some((p) => p.includes('SPAWNDELAY')))
  assert.ok(problems.some((p) => p.includes('MAXENEMIES')))
  assert.ok(problems.some((p) => p.includes('enemy line')))
  assert.ok(problems.some((p) => p.includes('NEXT')))
})
