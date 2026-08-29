import assert from 'node:assert/strict'
import test from 'node:test'

import { createBoneyardWorld, boneyardWorldNavigationIsPrepared } from '../core-server/boneyard-world.ts'
import { NATIVE_GENERATED_BONEYARDS } from './native-generated-boneyards.ts'
import { prepareBoneyardWorldNavigationAsync } from './boneyard-navigation-preparer.ts'

test('host prepares every Arena-owned navigation mesh off the event-loop cache', async () => {
  const template = NATIVE_GENERATED_BONEYARDS[0]!
  const loaded = {
    choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' as const },
    geometrySha256: template.geometrySha256,
    runId: 'navigation-preparation-test',
    scene: template.scene,
    seed: 'navigation-preparation-seed',
    sourceSha256: template.sourceSha256,
  }
  const first = createBoneyardWorld(loaded)
  assert.equal(boneyardWorldNavigationIsPrepared(first), false)

  let eventLoopTurns = 0
  const eventLoopProbe = setInterval(() => { eventLoopTurns += 1 }, 5)
  try {
    await prepareBoneyardWorldNavigationAsync(first)
  } finally {
    clearInterval(eventLoopProbe)
  }
  assert.ok(eventLoopTurns >= 20, `navigation preparation blocked the event loop: ${eventLoopTurns}`)
  assert.equal(boneyardWorldNavigationIsPrepared(first), true)

  const sameGeometry = createBoneyardWorld({ ...loaded, runId: 'second-run' })
  assert.equal(boneyardWorldNavigationIsPrepared(sameGeometry), true)
})
