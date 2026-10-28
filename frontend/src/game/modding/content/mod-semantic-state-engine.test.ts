import assert from 'node:assert/strict'
import test from 'node:test'

import { ModSemanticStateEngine } from './mod-semantic-state-engine.ts'

test('semantic state is scoped, viewer-filtered, checkpointed, and removable', () => {
  const engine = new ModSemanticStateEngine(['example.state'])
  engine.set(
    'example.state',
    { id: 'player-1:run-1', kind: 'participant-run' },
    'lesson.complete',
    { count: 1 },
  )
  engine.set(
    'example.state',
    { id: 'party-1', kind: 'party-run' },
    'door.open',
    true,
  )
  assert.deepEqual(engine.project('player-2').map(row => row.key), ['door.open'])
  assert.deepEqual(engine.project('player-1').map(row => row.key), [
    'lesson.complete',
    'door.open',
  ])
  const checkpoint = engine.checkpoint()
  assert.equal(engine.clear(
    'example.state',
    { id: 'party-1', kind: 'party-run' },
    'door.open',
  ), true)
  engine.restore(checkpoint)
  assert.equal(engine.project().length, 2)
  assert.throws(() => engine.set(
    'missing.mod',
    { id: 'party-1', kind: 'party-run' },
    'bad',
    true,
  ), /identity is invalid/)
})
