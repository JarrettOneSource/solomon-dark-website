import assert from 'node:assert/strict'
import test from 'node:test'

import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'
import {
  createNativeWeldSteamDetonation,
  spawnNativeWeldSteamActor,
  stepNativeWeldSteamActor,
} from './native-weld-steam.ts'

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

test('Steam detonation is gated by Explosion radius without consuming RNG', () => {
  const rng = createNativeRng(17)
  const result = createNativeWeldSteamDetonation({
    explodeDamage: 8,
    explodeRadius: 0,
    firstFragmentId: 20,
    fragmentCount: 2,
    fragmentDamage: 4,
    origin: { x: 10, y: 20 },
    ownerId: 'p1',
    privateSeed: 123,
    rng,
    tick: 40,
    worldKey: 'boneyard:1',
  })

  assert.equal(result.explosion, null)
  assert.deepEqual(result.fragments, [])
  assert.equal(result.nextId, 20)
  assert.deepEqual(result.rng, rng)
})

test('Steam detonation owns gray Explosion state and three zero-payload particles per fragment', () => {
  const rng = createNativeRng(17)
  const result = createNativeWeldSteamDetonation({
    explodeDamage: 8,
    explodeRadius: 15,
    firstFragmentId: 20,
    fragmentCount: 2,
    fragmentDamage: 4,
    origin: { x: 10, y: 20 },
    ownerId: 'p1',
    privateSeed: 123,
    rng,
    tick: 40,
    worldKey: 'boneyard:1',
  })

  assert.deepEqual(result.rng, advanceNativeRngWords(rng, 2))
  assert.deepEqual(result.explosion, {
    burnDamage: 0,
    damage: 4,
    footprintDimension: Math.fround(Math.fround((15 - 10) * Math.fround(0.18) + 1) * 110),
    origin: { x: 10, y: 20 },
    ownerId: 'p1',
    presentation: 'steam',
    soundPitch: result.explosion?.soundPitch,
    visualScale: Math.fround((15 - 10) * Math.fround(0.18) + 1),
    worldKey: 'boneyard:1',
  })
  assert.ok(result.explosion!.soundPitch >= 0.9 && result.explosion!.soundPitch <= 1.1)
  assert.deepEqual(result.fragments.map(({ id }) => id), [20, 21, 22, 23, 24, 25])
  assert.equal(result.nextId, 26)
  for (const fragment of result.fragments) {
    assert.equal(fragment.kind, 'weld-steam')
    assert.equal(fragment.variant, 'normal')
    assert.equal(fragment.contactEnabled, true)
    assert.equal(fragment.contactDamage, Math.fround(4 / 100))
    assert.equal(fragment.remainingDistance, 10_000_000)
    assert.deepEqual(fragment.vector, [0, 0, 0, 0, 0, 0, 0, 0])
    assert.ok(Math.hypot(fragment.velocity.x, fragment.velocity.y) > 3.8)
    assert.ok(Math.hypot(fragment.velocity.x, fragment.velocity.y) <= 5.4)
  }
})

// Instruction-derived correction: ledger 123 / report133-native-steam-low-mana-evidence.json.
test('weak normal Steam retains contact recurrence and learned payload at quarter alpha', () => {
  const vector = [400, 20, 8, 3, 12, 15, 5, 2]
  const weak = spawnNativeWeldSteamActor({
    damage: 2, direction: { x: 1, y: 0 }, id: 1, origin: { x: 0, y: 0 }, ownerId: 'peer',
    queryOrigin: { x: 0, y: 0 }, rng: createNativeRng(0), tick: 2, underpowered: true,
    vector, worldKey: 'boneyard:steam',
  }).actor!
  assert.equal(weak.variant, 'normal')
  assert.equal(weak.contactEnabled, true, '0x00543266 grants normal contact independently of weak')
  assert.equal(weak.alphaMultiplier, 0.25)
  assert.equal(weak.contactDamage, 2)
  assert.deepEqual(weak.vector, vector)
  let actor = { ...weak, contactTicksRemaining: 1, life: 1, lifeLoss: 0 }
  const due: number[] = []
  for (let tick = 1; tick <= 11; tick++) {
    actor = stepNativeWeldSteamActor(actor)!
    if (actor.contactDue) due.push(tick)
  }
  assert.deepEqual(due, [1, 11])
  const expiredContact = stepNativeWeldSteamActor({ ...actor, life: 0.5, contactTicksRemaining: 1 })!
  assert.equal(expiredContact.contactDue, false, 'the life > .5 gate is strict')
  assert.equal(stepNativeWeldSteamActor({ ...actor, life: 0, lifeLoss: 0.1 }), null)
})

test('the Over selector stays cosmetic when funded and becomes damaging normal Steam when weak', () => {
  let overCount = 0
  for (let seed = 0; seed < 32; seed++) {
    const input = {
      damage: 4, direction: { x: 1, y: 0 }, id: 1, origin: { x: 0, y: 0 }, ownerId: 'owner',
      queryOrigin: { x: 0, y: 0 }, rng: createNativeRng(seed), tick: 2,
      vector: [400, 20, 8, 3, 12, 15, 5, 2], worldKey: 'boneyard:steam',
    }
    const funded = spawnNativeWeldSteamActor({ ...input, underpowered: false })
    const weak = spawnNativeWeldSteamActor({ ...input, damage: 2, underpowered: true })
    assert.deepEqual(weak.rng, funded.rng, `seed ${seed}: unchanged constructor draws`)
    assert.equal(weak.actor!.variant, 'normal')
    assert.equal(weak.actor!.contactEnabled, true)
    if (funded.actor!.variant === 'over') {
      overCount++
      assert.equal(funded.actor!.contactEnabled, false)
      assert.equal(stepNativeWeldSteamActor({
        ...funded.actor!, contactTicksRemaining: 1,
      })!.contactDue, false)
    } else {
      assert.equal(funded.actor!.contactEnabled, true)
      assert.deepEqual(weak.actor!.position, funded.actor!.position)
      assert.equal(weak.actor!.life, funded.actor!.life)
    }
  }
  assert.ok(overCount > 0)
})
