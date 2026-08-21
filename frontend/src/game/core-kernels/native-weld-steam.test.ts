import assert from 'node:assert/strict'
import test from 'node:test'

import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'
import { spawnNativeWeldSteamActor, stepNativeWeldSteamActor } from './native-weld-steam.ts'

test('Steam Jet emits only on the even lane and consumes its full constructor program', () => {
  const rng = createNativeRng(31)
  const odd = spawnNativeWeldSteamActor({
    direction: { x: 1, y: 0 }, id: 1, origin: { x: 0, y: 0 }, ownerId: 'p1',
    rng, tick: 1, underpowered: false, vector: [1, 2, 3, 4, 5, 6, 7, 8],
    worldKey: 'boneyard:1',
  })
  assert.equal(odd.actor, null)
  assert.deepEqual(odd.rng, rng)

  const even = spawnNativeWeldSteamActor({
    direction: { x: 1, y: 0 }, id: 2, origin: { x: 0, y: 0 }, ownerId: 'p1',
    rng, tick: 2, underpowered: false, vector: [1, 2, 3, 4, 5, 6, 7, 8],
    worldKey: 'boneyard:1',
  })
  assert.ok(even.actor)
  // Integer7 + five floats + Integer10 + Float10 + signed Float45 (two words).
  assert.deepEqual(even.rng, advanceNativeRngWords(rng, 10))
})

test('Steam Jet retains native life, color, scale, and velocity decay lanes', () => {
  const spawned = spawnNativeWeldSteamActor({
    direction: { x: 1, y: 0 }, id: 1, origin: { x: 10, y: 20 }, ownerId: 'p1',
    rng: createNativeRng(1), tick: 2, underpowered: true,
    vector: [1, 2, 3, 4, 5, 6, 7, 8], worldKey: 'boneyard:1',
  }).actor!
  assert.equal(spawned.variant, 'normal')
  const stepped = stepNativeWeldSteamActor(spawned)!
  assert.equal(stepped.ageTicks, 1)
  assert.equal(stepped.phase, Math.fround(spawned.colorRise))
  assert.equal(stepped.tintFade, Math.fround(0.875))
  assert.notDeepEqual(stepped.position, spawned.position)
  assert.ok(Math.hypot(stepped.velocity.x, stepped.velocity.y)
    < Math.hypot(spawned.velocity.x, spawned.velocity.y))
})
