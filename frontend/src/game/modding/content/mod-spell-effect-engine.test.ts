import assert from 'node:assert/strict'
import test from 'node:test'

import { ModSpellEffectEngine } from './mod-spell-effect-engine.ts'

const scope = { id: 'player-1:run-1', kind: 'participant-run' } as const
const damage = {
  fields: { amount: 3, target: 'hostiles_in_area' },
  kind: 'rule-definition',
  operation: 'effect.damage',
  source: { column: 1, file: 'scripts/main.lua', line: 1 },
} as const

test('area, projectile, and channel prefabs select deterministic bounded targets', () => {
  const area = new ModSpellEffectEngine(100)
  area.spawn({
    contentId: '1001',
    fields: {
      duration: '100ms',
      effects: [damage],
      every: '50ms',
      prefab: 'area',
      radius: 20,
    },
    modId: 'example.spells',
    origin: { x: 0, y: 0 },
    ownerPlayerId: 'player-1',
    scope,
    target: { x: 10, y: 0 },
    tick: 0,
  })
  const areaBatch = area.tick({
    players: new Map([['player-1', { x: 0, y: 0 }]]),
    targets: [
      { id: 2, kind: 'native-enemy', x: 12, y: 0 },
      { id: 1, kind: 'native-enemy', x: 100, y: 0 },
    ],
    tick: 1,
  })[0]!
  assert.deepEqual(areaBatch.intents.map(intent => intent.fields.target), [
    { id: 2, kind: 'native-enemy' },
  ])
  const areaCheckpoint = area.checkpoint()
  area.tick({ players: new Map(), targets: [], tick: 10 })
  area.restore(areaCheckpoint)
  assert.equal(area.project().length, 1)

  const projectile = new ModSpellEffectEngine(100)
  projectile.spawn({
    contentId: '1001',
    fields: {
      duration: '1s',
      effects: [damage],
      prefab: 'projectile',
      radius: 6,
      speed: 1_000,
    },
    modId: 'example.spells',
    origin: { x: 0, y: 0 },
    ownerPlayerId: 'player-1',
    scope,
    target: { x: 100, y: 0 },
    tick: 0,
  })
  assert.deepEqual(projectile.tick({
    players: new Map(),
    targets: [{ id: 7, kind: 'mod-enemy', x: 50, y: 0 }],
    tick: 10,
  })[0]?.intents[0]?.fields.target, { id: 7, kind: 'mod-enemy' })
  assert.equal(projectile.project().length, 0)

  const channel = new ModSpellEffectEngine(100)
  channel.spawn({
    contentId: '1001',
    fields: {
      duration: '1s',
      effects: [damage],
      every: '100ms',
      prefab: 'channel',
      width: 5,
    },
    modId: 'example.spells',
    origin: { x: 0, y: 0 },
    ownerPlayerId: 'player-1',
    scope,
    target: { x: 100, y: 0 },
    tick: 0,
  })
  assert.equal(channel.tick({
    players: new Map([['player-1', { x: 5, y: 0 }]]),
    targets: [{ id: 9, kind: 'native-enemy', x: 50, y: 3 }],
    tick: 1,
  })[0]?.intents.length, 1)
  channel.tick({ players: new Map(), targets: [], tick: 2 })
  assert.equal(channel.project().length, 0)
})
