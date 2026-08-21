import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import { selectHubPlayerAtPoint } from './hub-player-selection.ts'

function sharedHubSnapshot() {
  const snapshot = createGameSnapshot(createGameSimulation({
    local: { discipline: 'arcane', displayName: 'Local', element: 'ether' },
    back: { discipline: 'arcane', displayName: 'Back', element: 'air' },
    front: { discipline: 'arcane', displayName: 'Front', element: 'fire' },
    private: { discipline: 'arcane', displayName: 'Private', element: 'water' },
  }), 'local')
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  snapshot.players.local!.position = { x: 100, y: 100 }
  snapshot.players.back!.position = { x: 200, y: 200 }
  snapshot.players.front!.position = { x: 202, y: 220 }
  snapshot.players.private!.position = { x: 200, y: 230 }
  snapshot.world.participants.private!.region = 'library'
  return snapshot
}

test('Hub selection excludes self and other regions', () => {
  const snapshot = sharedHubSnapshot()
  assert.equal(selectHubPlayerAtPoint(snapshot, 'local', { x: 100, y: 100 }), null)
  assert.equal(selectHubPlayerAtPoint(snapshot, 'local', { x: 200, y: 230 }), 'front')
})

test('Hub selection follows player painter depth for overlapping visible actors', () => {
  const snapshot = sharedHubSnapshot()
  assert.equal(selectHubPlayerAtPoint(snapshot, 'local', { x: 201, y: 210 }), 'front')
  snapshot.players.back!.position = { x: 200, y: 240 }
  assert.equal(selectHubPlayerAtPoint(snapshot, 'local', { x: 201, y: 220 }), 'back')
})

test('Hub player selection uses a mobile-friendly visual actor target', () => {
  const snapshot = sharedHubSnapshot()
  snapshot.players.front!.position = { x: 400, y: 400 }
  assert.equal(selectHubPlayerAtPoint(snapshot, 'local', { x: 235, y: 180 }), 'back')
  assert.equal(selectHubPlayerAtPoint(snapshot, 'local', { x: 260, y: 150 }), null)
})
