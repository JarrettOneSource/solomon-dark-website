import assert from 'node:assert/strict'
import test from 'node:test'
import type { NativeWeldPrimarySkillProfile } from './native-primary-skill-profile.ts'
import { createNativeRng, drawNativeFloat, drawNativeInteger } from './native-rng.ts'
import {
  createNativeWeldPersistentActor,
  createNativeWeldMeteor,
  drawNativeWeldDamage,
  nativeWeldAudioPlan,
  nativeWeldMissileFanHeading,
  releaseNativeWeldPersistentActor,
  spawnNativeWeldOneShot,
  stepNativeWeldProjectile,
  stepNativeWeldWorldActor,
  updateNativeWeldPersistentActor,
} from './native-weld-primary-runtime.ts'

test('welded missiles share one native float damage draw and consume Fire seeds in fan order', () => {
  const rng = createNativeRng(17)
  const expectedDamage = drawNativeFloat(rng, 6)
  const seed0 = drawNativeInteger(expectedDamage.state, 100_000)
  const seed1 = drawNativeInteger(seed0.state, 100_000)
  const spawned = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 },
    firstId: 40,
    origin: { x: 10, y: 20 },
    ownerId: 'p1',
    primarySkill: profile(1000, [4, 10, 12, 2, 1.25, 3, 8, 2, 3]),
    rng,
    targets: [],
    worldKey: 'boneyard:1',
  })

  assert.deepEqual(spawned.projectiles.map(({ damage }) => damage), [
    Math.fround(4 + expectedDamage.value),
    Math.fround(4 + expectedDamage.value),
  ])
  assert.deepEqual(spawned.projectiles.map(({ headingDegrees }) => headingDegrees), [105, 75])
  assert.deepEqual(spawned.projectiles.map(({ presentationSeed }) => presentationSeed), [
    seed0.value,
    seed1.value,
  ])
  assert.deepEqual(spawned.rng, seed1.state)
})

test('Crawling Shock consumes its one motion draw then creates center and side actors', () => {
  const rng = createNativeRng(31)
  const expected = drawNativeFloat(rng, Math.fround(0.05))
  const spawned = spawnNativeWeldOneShot({
    aimDirection: { x: 0, y: -1 },
    firstId: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'p1',
    primarySkill: profile(1009, [7, 9, 2, 0.5, 2, 1.5]),
    rng,
    targets: [],
    worldKey: 'boneyard:1',
  })
  assert.deepEqual(spawned.projectiles.map(({ headingDegrees }) => headingDegrees), [0, 330, 30])
  assert.deepEqual(spawned.projectiles.map(({ contactsRemaining }) => contactsRemaining), [3, 3, 3])
  assert.deepEqual(spawned.projectiles.map(({ position }) => position), [
    { x: 0, y: 15 },
    { x: 0, y: 15 },
    { x: 0, y: 15 },
  ])
  assert.deepEqual(spawned.rng, expected.state)
  assert.equal(spawned.projectiles[0]!.speed, Math.fround(3 * Math.fround(1.5 * Math.fround(1 + expected.value))))
})

test('weld missile fan matches the retail alternating geometry', () => {
  assert.deepEqual(
    Array.from({ length: 5 }, (_, index) => nativeWeldMissileFanHeading(0, 5, index)),
    [0, 340, 20, 320, 40],
  )
  assert.deepEqual(
    Array.from({ length: 4 }, (_, index) => nativeWeldMissileFanHeading(350, 4, index)),
    [0, 340, 20, 320],
  )
})

test('Meteor crosses its float32 fall lane then pulses every ten of 200 impact ticks', () => {
  let actor = createNativeWeldMeteor({
    damage: 12,
    direction: { x: 1, y: 0 },
    id: 5,
    origin: { x: 40, y: 80 },
    ownerId: 'p1',
    presentationPhase: 0,
    privateSeed: 4242,
    tick: 100,
    vector: [8, 16, 20, 1.1, 1.5, 3, 10, 2, 3],
    worldKey: 'boneyard:1',
  })
  for (let tick = 0; tick < 50; tick += 1) {
    const stepped = stepNativeWeldWorldActor(actor)
    assert.ok(stepped?.kind === 'weld-meteor')
    actor = stepped
    assert.equal(actor.phase, 'fall')
  }
  let stepped = stepNativeWeldWorldActor(actor)
  assert.ok(stepped?.kind === 'weld-meteor')
  actor = stepped
  assert.equal(actor.phase, 'impact')
  assert.equal(actor.impactDue, true)

  for (let tick = 0; tick < 9; tick += 1) {
    stepped = stepNativeWeldWorldActor(actor)
    assert.ok(stepped?.kind === 'weld-meteor')
    actor = stepped
    assert.equal(actor.pulseDue, false)
  }
  stepped = stepNativeWeldWorldActor(actor)
  assert.ok(stepped?.kind === 'weld-meteor')
  assert.equal(stepped.pulseDue, true)
  assert.equal(stepped.pulseSequence, 1)
  assert.equal(stepped.impactTicksRemaining, 190)
})

test('weld homing actors retain the nearest native target and advance through shared motion', () => {
  const projectile = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 },
    firstId: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'p1',
    primarySkill: profile(1001, [4, 4, 10, 1, 1, 0.2, 0.3]),
    rng: createNativeRng(1),
    targets: [target('enemy:4', 90, 0)],
    worldKey: 'boneyard:1',
  }).projectiles[0]!
  assert.equal(projectile.targetId, 'enemy:4')
  const stepped = stepNativeWeldProjectile(projectile, [target('enemy:4', 90, -30)])
  assert.equal(stepped.ageTicks, 1)
  assert.equal(stepped.flightTicks, 1)
  assert.notDeepEqual(stepped.position, projectile.position)
})

test('semantic audio plans retain every native loop/start cue ownership', () => {
  assert.deepEqual(nativeWeldAudioPlan(1003), {
    buildId: 1003,
    cue: 'flame-lash-loop',
    loop: true,
    nativeLoopIds: [157],
    startCueId: 33,
  })
  assert.deepEqual(nativeWeldAudioPlan(1005).nativeLoopIds, [172, 157])
  assert.deepEqual(nativeWeldAudioPlan(1008).nativeLoopIds, [160, 159])
  assert.equal(nativeWeldAudioPlan(1000).loop, false)
})

test('fixed damage does not consume the authoritative stream', () => {
  const rng = createNativeRng(9)
  assert.deepEqual(drawNativeWeldDamage(rng, 4.5, 4.5), { rng, value: 4.5 })
})

test('Ethereal Boulder grows in the native float lane and releases the four-piece template', () => {
  const source = createNativeWeldPersistentActor({
    buildId: 1006,
    direction: { x: 0.6, y: 0.8 },
    id: 40,
    origin: { x: 100, y: 200 },
    ownerId: 'p1',
    tick: 10,
    vector: [12, 3, 4, 1.1, 1.5, 1.2],
    worldKey: 'boneyard:1',
  })
  assert.equal(source.buildId, 1006)
  const updated = updateNativeWeldPersistentActor(
    source,
    source.origin,
    source.direction,
    createNativeRng(1),
  )
  assert.equal(updated.actor.buildId, 1006)
  assert.equal(
    updated.actor.scale,
    Math.fround(Math.fround(0.18) + Math.fround(1.2 * 1.5) * 0.0025),
  )
  const released = releaseNativeWeldPersistentActor({
    actor: updated.actor,
    firstChildId: 90,
    rng: updated.rng,
  })
  assert.equal(released.nextId, 93)
  assert.deepEqual(released.actors.map(({ id, origin }) => ({ id, origin })), [
    { id: 40, origin: { x: 118, y: 224 } },
    { id: 90, origin: { x: 124, y: 182 } },
    { id: 91, origin: { x: 76, y: 218 } },
    { id: 92, origin: { x: 91, y: 188 } },
  ])
  assert.deepEqual(released.actors.map((actor) => (
    actor.buildId === 1006 ? actor.speedFactor : null
  )), [Math.fround(1.1), Math.fround(0.95), Math.fround(0.95), Math.fround(0.9)])
  assert.deepEqual(released.actors.map((actor) => (
    actor.buildId === 1006 ? actor.visualScaleFactor : null
  )), [Math.fround(0.75), Math.fround(0.7125), Math.fround(0.7125), Math.fround(0.675)])
})

test('Hailstones bucket rebuild consumes native rock RNG in exact field order', () => {
  const rng = createNativeRng(77)
  const source = createNativeWeldPersistentActor({
    buildId: 1008,
    direction: { x: 1, y: 0 },
    id: 5,
    origin: { x: 10, y: 20 },
    ownerId: 'p1',
    tick: 4,
    vector: [8, 2, 8, 1.5, 0.1, 0.5],
    worldKey: 'boneyard:1',
  })
  assert.equal(source.buildId, 1008)
  const updated = updateNativeWeldPersistentActor(
    source,
    source.origin,
    source.direction,
    rng,
  )
  assert.equal(updated.actor.buildId, 1008)
  assert.equal(updated.actor.scale, Math.fround(Math.fround(0.18) + 20 * 0.0025 * 3))
  assert.equal(updated.actor.rocks.length, 2)
  assert.equal(updated.actor.rocks[0]!.decay, 1)
  assert.equal(updated.actor.rocks[0]!.phase, 0)
  assert.equal(updated.actor.rocks[0]!.releaseOffset, null)

  let expected = rng
  for (let index = 0; index < 2; index += 1) {
    expected = drawNativeInteger(expected, 3).state
    expected = drawNativeFloat(expected, 50, true).state
    expected = drawNativeFloat(expected, 50, true).state
    expected = drawNativeFloat(expected, 50, true).state
    if (index === 0) expected = drawNativeFloat(expected, 10).state
    expected = drawNativeFloat(expected, Math.fround(0.75)).state
  }
  assert.deepEqual(updated.rng, expected)

  const presentation = drawNativeFloat(expected, Math.fround(0.75))
  const released = releaseNativeWeldPersistentActor({
    actor: updated.actor,
    firstChildId: 6,
    rng: expected,
  })
  assert.deepEqual(released.rng, presentation.state)
  const actor = released.actors[0]
  assert.ok(actor?.buildId === 1008)
  assert.equal(actor.phase, 'flight')
  assert.deepEqual(actor.origin, { x: 0, y: 20 })
  assert.equal(actor.presentationScale, Math.fround(presentation.value + 0.75))
  assert.ok(actor.rocks.every(({ damageRemaining, releaseOffset }) => (
    damageRemaining === 8 && releaseOffset !== null
  )))

  const stepped = stepNativeWeldWorldActor(actor)
  assert.ok(stepped?.kind === 'weld-persistent' && stepped.buildId === 1008)
  assert.deepEqual(stepped.origin, { x: 10, y: 20 })
  assert.equal(stepped.rocks[0]!.decay, Math.fround(0.95))
  assert.equal(stepped.rocks[0]!.phase, Math.fround(0.025))
})

function profile(
  buildId: 1000 | 1001 | 1002 | 1009,
  values: readonly number[],
): NativeWeldPrimarySkillProfile {
  return {
    buildId,
    castKind: 'one-shot',
    damageFactor: 1,
    damageMaximum: buildId === 1009 ? values[0]! : values[1]!,
    damageMinimum: values[0]!,
    kind: 'weld',
    manaCost: values[buildId === 1009 ? 1 : 2]!,
    rank: 1,
    skillId: buildId,
    vector: { buildId, castKind: 'one-shot', values },
  }
}

function target(id: string, x: number, y: number) {
  return {
    active: true,
    actorFlags: 0x2,
    attachment: { x: 0, y: 0 },
    bodyRadius: 10,
    id,
    kind: 'enemy' as const,
    nativePriority: 0,
    pendingRemove: false,
    position: { x, y },
    registrationOrder: 0,
  }
}
