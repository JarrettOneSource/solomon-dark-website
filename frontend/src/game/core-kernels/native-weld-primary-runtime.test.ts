import assert from 'node:assert/strict'
import test from 'node:test'
import type { NativeWeldPrimarySkillProfile } from './native-primary-skill-profile.ts'
import { createNativeRng, drawNativeFloat, drawNativeInteger } from './native-rng.ts'
import {
  createNativeWeldChannelActor,
  createNativeWeldPersistentActor,
  createNativeWeldMeteor,
  drawNativeWeldDamage,
  nativeWeldAudioPlan,
  nativeGroundSparkPrivateWord,
  nativeWeldMissileFanHeading,
  releaseNativeWeldPersistentActor,
  spawnNativeWeldOneShot,
  stepNativeWeldProjectile,
  stepNativeWeldWorldActor,
  updateNativeWeldPersistentActor,
} from './native-weld-primary-runtime.ts'

test('welded missiles share one damage draw and consume constructor RNG in fan order', () => {
  const rng = createNativeRng(17)
  const expectedDamage = drawNativeFloat(rng, 6)
  const phase0 = drawNativeFloat(expectedDamage.state, 360)
  const seed0 = drawNativeInteger(phase0.state, 100_000)
  const phase1 = drawNativeFloat(seed0.state, 360)
  const seed1 = drawNativeInteger(phase1.state, 100_000)
  const spawned = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 },
    firstId: 40,
    origin: { x: 10, y: 20 },
    ownerId: 'p1',
    primarySkill: profile(1000, [4, 10, 12, 2, 1.25, 3, 8, 2, 3]),
    rng,
    targets: [],
    underpowered: false,
    worldKey: 'boneyard:1',
  })

  assert.deepEqual(spawned.projectiles.map(({ damage }) => damage), [
    Math.fround(4 + expectedDamage.value),
    Math.fround(4 + expectedDamage.value),
  ])
  assert.deepEqual(spawned.projectiles.map(({ headingDegrees }) => headingDegrees), [105, 75])
  assert.deepEqual(
    spawned.projectiles.map(({ basePresentationPhaseDegrees }) => basePresentationPhaseDegrees),
    [phase0.value, phase1.value],
  )
  assert.deepEqual(spawned.projectiles.map(({ presentationSeed }) => presentationSeed), [
    seed0.value,
    seed1.value,
  ])
  assert.deepEqual(spawned.rng, seed1.state)
})

test('Crawling Shock consumes signed pitch then private seed and age per actor', () => {
  const rng = createNativeRng(31)
  const pitch = drawNativeFloat(rng, Math.fround(0.05), true)
  const sound = drawNativeInteger(pitch.state, 3)
  const seed0 = drawNativeInteger(sound.state, 1_000_000)
  const age0 = drawNativeInteger(seed0.state, 360)
  const seed1 = drawNativeInteger(age0.state, 1_000_000)
  const age1 = drawNativeInteger(seed1.state, 360)
  const seed2 = drawNativeInteger(age1.state, 1_000_000)
  const age2 = drawNativeInteger(seed2.state, 360)
  const spawned = spawnNativeWeldOneShot({
    aimDirection: { x: 0, y: -1 },
    firstId: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'p1',
    primarySkill: profile(1009, [7, 9, 2, 0.5, 2, 1.5]),
    rng,
    targets: [],
    underpowered: false,
    worldKey: 'boneyard:1',
  })
  assert.deepEqual(spawned.projectiles.map(({ headingDegrees }) => headingDegrees), [0, 330, 30])
  assert.deepEqual(spawned.projectiles.map(({ contactsRemaining }) => contactsRemaining), [3, 3, 3])
  assert.deepEqual(spawned.projectiles.map(({ position }) => position), [
    { x: 0, y: 15 },
    { x: 0, y: 15 },
    { x: 0, y: 15 },
  ])
  assert.deepEqual(spawned.projectiles.map(({ castSoundVariant }) => castSoundVariant), [
    sound.value,
    sound.value,
    sound.value,
  ])
  assert.deepEqual(
    spawned.projectiles.map(({ presentationSeed }) => presentationSeed),
    [seed0.value, seed1.value, seed2.value],
  )
  assert.deepEqual(
    spawned.projectiles.map(({ groundSparkNativeAgeTicks }) => groundSparkNativeAgeTicks),
    [age0.value, age1.value, age2.value],
  )
  assert.deepEqual(spawned.projectiles.map(({ speed }) => speed), [4, 3, 3])
  assert.deepEqual(spawned.rng, age2.state)
  assert.equal(spawned.projectiles[0]!.castPlaybackRate, Math.fround(1 + pitch.value))
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

test('Meteor constructor subtracts its float32 quarter-range fall draw', () => {
  const actor = createNativeWeldMeteor({
    damage: 12,
    direction: { x: 1, y: 0 },
    id: 6,
    origin: { x: 40, y: 80 },
    ownerId: 'p1',
    presentationPhase: Math.fround(0.25),
    privateSeed: 42,
    tick: 100,
    vector: [8, 16, 20, 1.1, 1.5, 3, 10, 2, 3],
    worldKey: 'boneyard:1',
  })
  assert.equal(actor.fallScalar, Math.fround(0.75))
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
    underpowered: false,
    worldKey: 'boneyard:1',
  }).projectiles[0]!
  assert.equal(projectile.targetId, 'enemy:4')
  const stepped = stepNativeWeldProjectile(projectile, [target('enemy:4', 90, -30)])
  assert.equal(stepped.ageTicks, 1)
  assert.equal(stepped.flightTicks, 1)
  assert.notDeepEqual(stepped.position, projectile.position)
})

test('semantic audio plans retain every native sound and loop registry owner', () => {
  const buildIds = [
    1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009,
  ] as const
  assert.deepEqual(buildIds.map(nativeWeldAudioPlan), [
    audio(1000, 'burning-bolt', [57, 97]),
    audio(1001, 'frost-missile', [38]),
    audio(1002, 'ball-lightning', [], [224, 225]),
    audio(1003, 'flame-lash-loop', [33], [], [157]),
    audio(1004, 'blizzard-beam-loop', [44], [], [160]),
    audio(1005, 'steam-jet-loop', [], [], [172, 157]),
    audio(1006, 'ethereal-boulder-loop', [87], [], [159]),
    audio(1007, 'meteor-swarm-loop', [], [], [165]),
    audio(1008, 'hailstones-loop', [87], [], [160, 159]),
    audio(1009, 'crawling-shock', [], [203, 204, 205]),
  ])
})

test('Ball Lightning consumes one cast-sound selector before its fan phases', () => {
  const rng = createNativeRng(71)
  const damage = drawNativeFloat(rng, 6)
  const pitch = drawNativeFloat(damage.state, Math.fround(0.25))
  const sound = drawNativeInteger(pitch.state, 2)
  const phase0 = drawNativeFloat(sound.state, 360)
  const phase1 = drawNativeFloat(phase0.state, 360)
  const phase2 = drawNativeFloat(phase1.state, 360)
  const spawned = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 20, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1002, [4, 10, 6, 3, 1.1, 2, 0.5]),
    rng, targets: [], underpowered: false, worldKey: 'boneyard:1',
  })
  assert.deepEqual(spawned.projectiles.map(({ castSoundVariant }) => castSoundVariant), [
    sound.value, sound.value, sound.value,
  ])
  assert.deepEqual(
    spawned.projectiles.map(({ basePresentationPhaseDegrees }) => basePresentationPhaseDegrees),
    [phase0.value, phase1.value, phase2.value],
  )
  assert.ok(spawned.projectiles.every(({ castPlaybackRate }) => (
    castPlaybackRate === Math.fround(1 + pitch.value)
  )))
  assert.deepEqual(spawned.rng, phase2.state)
})

test('Frost Missile consumes inherited and derived presentation phases per actor', () => {
  const rng = createNativeRng(83)
  const damage = drawNativeFloat(rng, 6)
  const playback = drawNativeFloat(damage.state, Math.fround(0.1))
  const base = drawNativeFloat(playback.state, 360)
  const secondary = drawNativeFloat(base.state, 360)
  const aspect = drawNativeFloat(secondary.state, Math.fround(0.25))
  const spawned = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 20, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1001, [4, 10, 6, 1, 1.1, 2, 0.5]),
    rng, targets: [], underpowered: false, worldKey: 'boneyard:1',
  })
  assert.equal(spawned.projectiles[0]!.basePresentationPhaseDegrees, base.value)
  assert.equal(spawned.projectiles[0]!.secondaryPresentationPhaseDegrees, secondary.value)
  assert.equal(spawned.projectiles[0]!.frostPulseAspect, Math.fround(0.5 + aspect.value))
  assert.equal(spawned.projectiles[0]!.castPlaybackRate, Math.fround(1 + playback.value))
  assert.deepEqual(spawned.rng, aspect.state)
})

test('underpowered welded one-shots retain native actors but suppress every learned payload', () => {
  const fire = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 1, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1000, [8, 8, 5, 3, 1.5, 4, 9, 2, 3]),
    rng: createNativeRng(1), targets: [], underpowered: true, worldKey: 'boneyard:1',
  }).projectiles
  assert.equal(fire.length, 1)
  assert.equal(fire[0]!.damage, 4)
  assert.equal(fire[0]!.speed, Math.fround(3 * 0.8))
  assert.equal(fire[0]!.castPlaybackRate, 0.75)
  assert.deepEqual(fire[0]!.vector.slice(3), [1, Math.fround(0.8), 0, 0, 0, 0])

  const frost = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 2, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1001, [8, 8, 5, 3, 1.5, 0.4, 0.8]),
    rng: createNativeRng(2), targets: [], underpowered: true, worldKey: 'boneyard:1',
  }).projectiles
  assert.equal(frost.length, 1)
  assert.equal(frost[0]!.castPlaybackRate, 0.75)
  assert.deepEqual(frost[0]!.vector.slice(3), [1, Math.fround(0.8), 0, 0])

  const ball = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 3, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1002, [8, 8, 5, 3, 1.5, 4, 0.4]),
    rng: createNativeRng(3), targets: [], underpowered: true, worldKey: 'boneyard:1',
  }).projectiles
  assert.equal(ball.length, 1)
  assert.equal(ball[0]!.castPlaybackRate, 0.75)
  assert.equal(ball[0]!.turnInput, Math.fround(2 * 0.8 * 0.75))
  assert.deepEqual(ball[0]!.vector.slice(3), [1, Math.fround(0.8), 0, 1])

  const spark = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 4, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1009, [8, 5, 4, 0.4, 3, 1.5]),
    rng: createNativeRng(4), targets: [], underpowered: true, worldKey: 'boneyard:1',
  }).projectiles
  assert.equal(spark.length, 1)
  assert.equal(spark[0]!.speed, 4)
  assert.equal(spark[0]!.contactsRemaining, 1)
  assert.deepEqual(spark[0]!.vector.slice(2, 5), [0, 1, 0])
  assert.ok(spark[0]!.castPlaybackRate >= Math.fround(0.95 * 0.8))
  assert.ok(spark[0]!.castPlaybackRate <= Math.fround(1.05 * 0.8))
})

test('Crawling Shock advances its private three-word turn program after the first move', () => {
  const born = spawnNativeWeldOneShot({
    aimDirection: { x: 0, y: -1 }, firstId: 1, origin: { x: 10, y: 20 },
    ownerId: 'p1', primarySkill: profile(1009, [8, 5, 2, 0.5, 1, 1]),
    rng: createNativeRng(91), targets: [], underpowered: false, worldKey: 'boneyard:1',
  }).projectiles[0]!
  const turnWord = nativeGroundSparkPrivateWord(born.presentationSeed!)
  const signWord = nativeGroundSparkPrivateWord(turnWord)
  const speedWord = nativeGroundSparkPrivateWord(signWord)
  const stepped = stepNativeWeldProjectile(born, [])
  assert.deepEqual(stepped.position, { x: 10, y: 31 })
  assert.equal(stepped.presentationSeed, speedWord)
  assert.equal(stepped.speed, speedWord % 4 + 1)
  assert.equal(stepped.groundSparkTurnTicksRemaining, 20)
  assert.equal(stepped.groundSparkNativeAgeTicks, born.groundSparkNativeAgeTicks! + 1)
  assert.notDeepEqual(stepped.direction, born.direction)
})

test('Ball Lightning applies and decays its native temporary acceleration', () => {
  const born = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 1, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1002, [8, 8, 5, 1, 0.5, 0, 1]),
    rng: createNativeRng(12), targets: [], underpowered: false, worldKey: 'boneyard:1',
  }).projectiles[0]!
  assert.equal(Math.hypot(born.velocity.x, born.velocity.y), Math.fround(
    Math.fround(3 * Math.fround(0.5 * 0.8500000238418579)) * 3,
  ))
  const stepped = stepNativeWeldProjectile(born, [])
  assert.equal(stepped.ballLightningAcceleration, Math.fround(2 * 0.8999999761581421))
  assert.equal(Math.hypot(
    stepped.position.x - born.position.x,
    stepped.position.y - born.position.y,
  ), Math.hypot(
    born.velocity.x,
    born.velocity.y,
  ))
  assert.ok(stepped.basePresentationPhaseDegrees! > born.basePresentationPhaseDegrees!)
})

test('welded channel actors retain authoritative Lightning geometry', () => {
  const actor = createNativeWeldChannelActor({
    buildId: 1003, direction: { x: 0, y: -1 }, endpoint: { x: 20, y: 30 },
    id: 9, midpoint: { x: 10, y: 15 }, origin: { x: 0, y: 0 }, ownerId: 'p1',
    targetId: 'enemy:1', tick: 50, vector: [8, 2, 1, 0.8, 0, 0, 0, 0],
    worldKey: 'boneyard:1',
  })
  assert.deepEqual(actor.endpoint, { x: 20, y: 30 })
  assert.deepEqual(actor.midpoint, { x: 10, y: 15 })
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
  assert.equal(source.assemblyScale, Math.fround(0.18))
  assert.equal(source.flightTicks, 0)
  const updated = updateNativeWeldPersistentActor(
    source,
    source.origin,
    source.direction,
    createNativeRng(1),
  )
  assert.equal(updated.actor.buildId, 1006)
  assert.notDeepEqual(updated.actor.orientation, source.orientation)
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
  const first = released.actors[0]
  assert.ok(first?.buildId === 1006)
  const stepped = stepNativeWeldWorldActor(first)
  assert.ok(stepped?.kind === 'weld-persistent' && stepped.buildId === 1006)
  assert.equal(stepped.flightTicks, 1)
  assert.notDeepEqual(stepped.orientation, first.orientation)
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
    damageRollCount: 1,
    kind: 'weld',
    manaCost: values[buildId === 1009 ? 1 : 2]!,
    rank: 1,
    skillId: buildId,
    vector: { buildId, castKind: 'one-shot', values },
  }
}

function audio(
  buildId: Parameters<typeof nativeWeldAudioPlan>[0],
  cue: ReturnType<typeof nativeWeldAudioPlan>['cue'],
  nativeSoundIds: readonly number[] = [],
  nativeSoundVariantIds: readonly number[] = [],
  nativeLoopIds: readonly number[] = [],
): ReturnType<typeof nativeWeldAudioPlan> {
  return {
    buildId,
    cue,
    loop: nativeLoopIds.length > 0,
    nativeLoopIds,
    nativeSoundIds,
    nativeSoundVariantIds,
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
