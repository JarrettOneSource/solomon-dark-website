import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import { sameRuntimeScene } from './runtime-scene-identity.ts'

function snapshot() {
  return createGameSnapshot(createGameSimulation({ owner: {
    discipline: 'arcane', displayName: 'Quality owner', element: 'water',
  } }), 'owner')
}

test('paused authoritative quality changes invalidate the Settings scene cache in both directions', () => {
  const current = snapshot()
  assert.equal(sameRuntimeScene(current, current, 'owner'), true)
  assert.equal(sameRuntimeScene(current, { ...current, tick: current.tick + 1 }, 'owner'), true)
  const off = { ...current, enhancedEffects: false }
  assert.equal(sameRuntimeScene(current, off, 'owner'), false,
    'real shared-mode snapshots must reach the authoritative Settings control even at the same tick')
  assert.equal(sameRuntimeScene(off, current, 'owner'), false)
  assert.equal(sameRuntimeScene(null, current, 'owner'), false)
})

test('materializing-owner eligibility changes invalidate the same Settings authority cache', () => {
  const current = snapshot()
  const staging = { ...current, materializingPlayerIds: ['owner'] }
  assert.equal(sameRuntimeScene(current, staging, 'owner'), false)
  assert.equal(sameRuntimeScene(staging, current, 'owner'), false)
  assert.equal(sameRuntimeScene(current, { ...current, materializingPlayerIds: ['guest'] }, 'owner'), true,
    'an unrelated guest does not alter this owner control eligibility')
})
