import assert from 'node:assert/strict'
import test from 'node:test'

import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'
import { spawnNativeWeldSteamActor, stepNativeWeldSteamActor } from './native-weld-steam.ts'

test('Steam Jet emits only on the even lane and consumes its full constructor program', () => {
  const rng = createNativeRng(31)
  const odd = spawnNativeWeldSteamActor({
    damage: 1, direction: { x: 1, y: 0 }, id: 1, origin: { x: 0, y: 0 }, ownerId: 'p1',
    queryOrigin: { x: 0, y: 0 }, rng, tick: 1, underpowered: false,
    vector: [1, 2, 3, 4, 5, 6, 7, 8],
    worldKey: 'boneyard:1',
  })
  assert.equal(odd.actor, null)
  assert.deepEqual(odd.rng, rng)

  const even = spawnNativeWeldSteamActor({
    damage: 1, direction: { x: 1, y: 0 }, id: 2, origin: { x: 0, y: 0 }, ownerId: 'p1',
    queryOrigin: { x: 0, y: 0 }, rng, tick: 2, underpowered: false,
    vector: [1, 2, 3, 4, 5, 6, 7, 8],
    worldKey: 'boneyard:1',
  })
  assert.ok(even.actor)
  // Integer7 + five floats + Integer10 + Float10 + signed Float45 (two words).
  assert.deepEqual(even.rng, advanceNativeRngWords(rng, 10))
  assert.equal(
    Math.fround(Math.hypot(even.actor.velocity.x, even.actor.velocity.y)),
    Math.fround(Math.fround(5.4) * Math.fround(1.06)),
  )
  assert.ok(even.actor.position.x >= -25 && even.actor.position.x <= -5)
})

test('Steam Jet retains native life, color, scale, and velocity decay lanes', () => {
  const spawned = spawnNativeWeldSteamActor({
    damage: 1, direction: { x: 1, y: 0 }, id: 1, origin: { x: 10, y: 20 }, ownerId: 'p1',
    queryOrigin: { x: 10, y: 20 }, rng: createNativeRng(1), tick: 2, underpowered: true,
    vector: [1, 2, 3, 4, 5, 6, 7, 8], worldKey: 'boneyard:1',
  }).actor!
  assert.equal(spawned.variant, 'normal')
  const stepped = stepNativeWeldSteamActor(spawned)!
  assert.equal(stepped.ageTicks, 1)
  assert.equal(stepped.phase, Math.fround(spawned.colorRise))
  assert.equal(stepped.tintFade, Math.fround(spawned.tintFade - Math.fround(0.25)))
  assert.equal(stepped.blue, Math.fround(spawned.blue - Math.fround(0.125)))
  assert.equal(spawned.alphaMultiplier, Math.fround(0.25))
  assert.notDeepEqual(stepped.position, spawned.position)
  assert.ok(Math.hypot(stepped.velocity.x, stepped.velocity.y)
    < Math.hypot(spawned.velocity.x, spawned.velocity.y))
})

test('Steam Jet stores native terrain termination and contact-clock edges', () => {
  const actor = spawnNativeWeldSteamActor({
    damage: 4,
    direction: { x: 1, y: 0 },
    id: 3,
    obstructionPoint: () => ({ x: 0, y: 0 }),
    origin: { x: 0, y: 0 },
    ownerId: 'p1',
    queryOrigin: { x: 0, y: 0 },
    rng: createNativeRng(0),
    tick: 2,
    underpowered: false,
    vector: [4, 2, 0, 0, 0, 0, 0, 0],
    worldKey: 'boneyard:1',
  }).actor
  assert.ok(actor?.kind === 'weld-steam' && actor.variant === 'normal')
  assert.equal(actor.remainingDistance, 0)
  const stepped = stepNativeWeldSteamActor({ ...actor, contactTicksRemaining: 1 })
  assert.ok(stepped)
  assert.deepEqual(stepped.position, { x: 0, y: 0 })
  assert.deepEqual(stepped.velocity, { x: 0, y: 0 })
  assert.equal(stepped.remainingDistance, 999_999)
  assert.equal(stepped.contactDue, true)
  assert.equal(stepped.contactTicksRemaining, 10)
})
