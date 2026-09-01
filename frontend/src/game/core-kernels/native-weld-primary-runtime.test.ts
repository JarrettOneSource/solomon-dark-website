import assert from 'node:assert/strict'
import test from 'node:test'

import './native-weld-hail-contact.test.ts'
import './native-weld-flame-lash.test.ts'
import './native-weld-blizzard.test.ts'
import type { NativeWeldPrimarySkillProfile } from './native-primary-skill-profile.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from './native-rng.ts'
import {
  createNativeWeldMeteorSpawnProgram,
} from './native-weld-meteor.ts'
import {
  createNativeWeldBlizzardChainEffects,
  createNativeWeldChannelActor,
  createNativeWeldPersistentActor,
  createNativeWeldMeteor,
  drawNativeWeldDamage,
  nativeWeldAudioPlan,
  nativeGroundSparkPrivateWord,
  releaseNativeWeldPersistentActor,
  spawnNativeWeldOneShot,
  stepNativeWeldProjectile,
  stepNativeWeldProjectilePresentation,
  stepNativeWeldWorldActor,
  updateNativeWeldPersistentActor,
} from './native-weld-primary-runtime.ts'

test('Blizzard chains own Frost fade and optional chaining-particle births without a beam', () => {
  const rng = createNativeRng(27)
  let registrationOrdinal = 10
  const effects = createNativeWeldBlizzardChainEffects({
    castDirection: { x: 1, y: 0 },
    direction: { x: 1, y: 0 },
    firstId: 10,
    ownerId: 'wizard',
    registerWorldPainter: (managerLane) => ({
      managerLane,
      registrationOrdinal: registrationOrdinal++,
    }),
    rng,
    source: { x: 100, y: 20 },
    tick: 5,
    vector: [8, 2, 2, 0.5, 0, 0.2, 0.04],
    worldKey: 'boneyard:1',
  })
  assert.equal(effects.actors[0]?.kind, 'weld-frost-fade')
  const fade = effects.actors[0]
  assert.ok(fade?.kind === 'weld-frost-fade')
  assert.equal(fade.buildId, 1004)
  assert.equal('position' in fade, false)
  assert.deepEqual(fade.painterRegistrations, [{
    managerLane: 'actor',
    registrationOrdinal: 10,
  }])

  let expected = drawNativeFloat(rng, 10).state
  expected = drawNativeInteger(expected, 100_001).state
  expected = drawNativeFloat(expected, Math.fround(0.5)).state
  expected = drawNativeFloat(expected, Math.fround(0.75)).state
  const selector = drawNativeInteger(expected, 2); expected = selector.state
  if (selector.value === 1) {
    expected = advanceNativeRngWords(expected, 4)
    expected = drawNativeFloat(expected, 10).state
    expected = drawNativeFloat(expected, 2, true).state
    assert.equal(effects.actors[1]?.kind, 'weld-blizzard-chain-frost')
    assert.deepEqual(effects.actors[1]?.painterRegistrations, [{
      managerLane: 'actor',
      registrationOrdinal: 11,
    }])
  } else {
    assert.equal(effects.actors.length, 1)
  }
  assert.deepEqual(effects.rng, expected)
})

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

test('Meteor crosses its float32 fall lane then pulses every ten of 200 impact ticks', () => {
  let actor = createNativeWeldMeteor({
    bodyScale: 1,
    damage: 12,
    direction: { x: 1, y: 0 },
    fallHeadingDegrees: 20,
    fallHeight: Math.fround(0.05),
    fallStep: Math.fround(0.02),
    id: 5,
    impactTicks: 200,
    origin: { x: 40, y: 80 },
    ownerId: 'p1',
    position: { x: 40, y: 80 },
    privateSeed: 4242,
    tick: 100,
    underpowered: false,
    vector: [8, 16, 20, 1.1, 1.5, 3, 10, 2, 3],
    worldKey: 'boneyard:1',
  })
  let rng = createNativeRng(99)
  let fallTicks = 0
  let impactDebris = 0
  while (actor.phase === 'fall') {
    const stepped = stepNativeWeldWorldActor(actor, rng)
    rng = stepped.rng
    impactDebris += stepped.debris?.length ?? 0
    assert.ok(stepped.actor?.kind === 'weld-meteor')
    actor = stepped.actor
    fallTicks += 1
    assert.ok(fallTicks < 60)
  }
  assert.equal(fallTicks, 3)
  assert.equal(actor.phase, 'impact')
  assert.equal(actor.impactDue, true)
  assert.equal(actor.debris.length, 0)
  assert.equal(impactDebris, 5)
  assert.ok(actor.cameraDisplacement)

  for (let tick = 0; tick < 9; tick += 1) {
    const stepped = stepNativeWeldWorldActor(actor, rng)
    rng = stepped.rng
    assert.ok(stepped.actor?.kind === 'weld-meteor')
    actor = stepped.actor
    assert.equal(actor.pulseDue, false)
  }
  const stepped = stepNativeWeldWorldActor(actor, rng)
  assert.ok(stepped.actor?.kind === 'weld-meteor')
  assert.equal(stepped.actor.pulseDue, true)
  assert.equal(stepped.actor.pulseSequence, 1)
  assert.equal(stepped.actor.impactTicksRemaining, 190)
})

test('Meteor construction consumes every overwritten and retained native draw', () => {
  const rng = createNativeRng(42)
  const fall = drawNativeFloat(rng, Math.fround(0.25))
  const radius = drawNativeFloat(fall.state, 150)
  const unit = drawNativeInteger(radius.state, 100_001)
  const overwritten = drawNativeFloat(unit.state, Math.fround(0.25))
  const heading = drawNativeFloat(overwritten.state, 40)
  const size = drawNativeFloat(heading.state, Math.fround(0.25))
  const seed = drawNativeInteger(size.state, 10_000_000)
  const spawn = createNativeWeldMeteorSpawnProgram({
    aimDirection: { x: 1, y: 0 },
    center: { x: 40, y: 80 },
    resolvePosition: (candidate) => candidate,
    rng,
    underpowered: false,
    vector: [8, 16, 20, 1.1, 1.5, 3, 10, 2, 3],
  })
  assert.equal(spawn.bodyScale, Math.fround(1 - fall.value))
  assert.equal(spawn.fallHeight, Math.fround(Math.fround(size.value + 1) * 2.5 * 2))
  assert.equal(spawn.fallStep, Math.fround(Math.fround(0.02) * Math.fround(1.1 * 2)))
  assert.equal(spawn.impactTicks, 275)
  assert.equal(spawn.privateSeed, seed.value)
  assert.equal(spawn.fallHeight, Math.fround(Math.fround(size.value + 1) * 2.5 * 2))
  assert.deepEqual(spawn.rng, seed.state)
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

test('welded MagicMissile derivatives preserve their class-specific replacement thresholds', () => {
  const spawn = (buildId: 1000 | 1001 | 1002, speedFactor: number) => (
    spawnNativeWeldOneShot({
      aimDirection: { x: 1, y: 0 },
      firstId: 1,
      origin: { x: 0, y: 0 },
      ownerId: 'p1',
      primarySkill: profile(buildId, [4, 4, 10, 1, speedFactor, 0, 0, 0, 0]),
      rng: createNativeRng(1),
      targets: [],
      underpowered: false,
      worldKey: 'boneyard:1',
    }).projectiles[0]!.reacquiresTarget
  )
  assert.equal(spawn(1000, 1.25), false)
  assert.equal(spawn(1000, 1.3), true)
  assert.equal(spawn(1001, 1), false)
  assert.equal(spawn(1001, 1.1), true)
  assert.equal(spawn(1002, 1), false)
  assert.equal(spawn(1002, 1.1), true)
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

  let expected = aspect.state
  const expectedLanes = []
  for (let lane = 0; lane < 2; lane += 1) {
    const nextAspect = drawNativeFloat(expected, Math.fround(0.25))
    const nextScale = drawNativeFloat(nextAspect.state, Math.fround(0.75))
    const nextRotation = drawNativeFloat(nextScale.state, 45)
    expected = nextRotation.state
    expectedLanes.push({
      aspect: Math.fround(nextAspect.value + 0.5),
      rotationDegrees: nextRotation.value,
      scale: Math.fround(nextScale.value + 0.5),
    })
  }
  const presentation = stepNativeWeldProjectilePresentation(
    spawned.projectiles[0]!,
    aspect.state,
  )
  assert.deepEqual(presentation.projectile.frostPresentationLanes, expectedLanes)
  assert.deepEqual(presentation.rng, expected)
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
  assert.equal(fire[0]!.reacquiresTarget, false)
  assert.deepEqual(fire[0]!.vector.slice(3), [1, Math.fround(0.8), 0, 0, 0, 0])

  const frost = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 2, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1001, [8, 8, 5, 3, 1.5, 0.4, 0.8]),
    rng: createNativeRng(2), targets: [], underpowered: true, worldKey: 'boneyard:1',
  }).projectiles
  assert.equal(frost.length, 1)
  assert.equal(frost[0]!.castPlaybackRate, 0.75)
  assert.equal(frost[0]!.reacquiresTarget, false)
  assert.deepEqual(frost[0]!.vector.slice(3), [1, Math.fround(0.8), 0, 0])

  const ball = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 3, origin: { x: 0, y: 0 },
    ownerId: 'p1', primarySkill: profile(1002, [8, 8, 5, 3, 1.5, 4, 0.4]),
    rng: createNativeRng(3), targets: [], underpowered: true, worldKey: 'boneyard:1',
  }).projectiles
  assert.equal(ball.length, 1)
  assert.equal(ball[0]!.castPlaybackRate, 0.75)
  assert.equal(ball[0]!.reacquiresTarget, false)
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
  assert.equal(source.shellScale, Math.fround(0.18))
  assert.equal(source.flightTicks, 0)
  assert.equal(source.maximumScale, Math.fround(0.75))
  assert.equal(source.toughness, Math.fround(1.5))
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
    Math.fround(Math.fround(0.18) + Math.fround(Math.fround(1.2 * 0.0025) * 3)),
  )
  assert.equal(updated.actor.shellScale, updated.actor.assemblyScale)
  const released = releaseNativeWeldPersistentActor({
    actor: updated.actor,
    firstChildId: 90,
    rng: updated.rng,
    tick: 12,
  })
  assert.ok(released.actors[0]?.kind === 'weld-persistent')
  assert.ok(released.actors[0]?.buildId === 1006)
  assert.equal(released.actors[0].maximumScale, updated.actor.scale)
  assert.equal(released.actors[0].shellScale, updated.actor.shellScale)
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
  const first = released.actors[0]
  assert.ok(first?.buildId === 1006)
  const stepped = stepNativeWeldWorldActor(first, createNativeRng(2))
  assert.ok(stepped.actor?.kind === 'weld-persistent' && stepped.actor.buildId === 1006)
  assert.equal(stepped.actor.flightTicks, 1)
  assert.notDeepEqual(stepped.actor.orientation, first.orientation)

  let capsule: Readonly<{
    from: { x: number; y: number }
    to: { x: number; y: number }
  }> | null = null
  const blocked = stepNativeWeldWorldActor(
    first,
    createNativeRng(2),
    (_actor, from, to) => {
      capsule = { from, to }
      return false
    },
  )
  assert.deepEqual(capsule, {
    from: {
      x: Math.fround(first.origin.x + first.velocity.x),
      y: Math.fround(first.origin.y + first.velocity.y),
    },
    to: {
      x: Math.fround(
        Math.fround(first.origin.x + first.velocity.x) + first.velocity.x,
      ),
      y: Math.fround(
        Math.fround(first.origin.y + first.velocity.y) + first.velocity.y,
      ),
    },
  })
  assert.equal(blocked.actor, null)
  assert.ok(blocked.terrainContact)
  assert.deepEqual(blocked.terrainContact.origin, capsule!.from)
  assert.notDeepEqual(blocked.terrainContact.orientation, first.orientation)
})

test('retained Earth welds keep native scale ceilings when Bind is absent', () => {
  const ethereal = createNativeWeldPersistentActor({
    buildId: 1006,
    direction: { x: 1, y: 0 },
    id: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    tick: 0,
    vector: [5.5, 15, 1, 1, 0, 1],
    worldKey: 'boneyard:1',
  })
  const hailstones = createNativeWeldPersistentActor({
    buildId: 1008,
    direction: { x: 1, y: 0 },
    id: 2,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    tick: 0,
    vector: [1.3125, 14.75, 1, 0, 0, 0],
    worldKey: 'boneyard:1',
  })

  assert.equal(ethereal.toughness, 0)
  assert.equal(ethereal.maximumScale, Math.fround(0.75))
  assert.equal(hailstones.toughness, 0)
  assert.equal(hailstones.maximumScale, 1)

  const grownEthereal = updateNativeWeldPersistentActor(
    ethereal,
    ethereal.origin,
    ethereal.direction,
    createNativeRng(1),
  ).actor
  const grownHailstones = updateNativeWeldPersistentActor(
    hailstones,
    hailstones.origin,
    hailstones.direction,
    createNativeRng(2),
  ).actor
  assert.ok(grownEthereal.scale > ethereal.scale)
  assert.ok(grownEthereal.scale <= ethereal.maximumScale)
  assert.ok(grownHailstones.scale > hailstones.scale)
  assert.ok(grownHailstones.scale <= hailstones.maximumScale)
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
    vector: [8, 2, 40, 1.5, 0.1, 0.5],
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
  assert.equal(
    updated.actor.scale,
    Math.fround(Math.fround(0.18) + Math.fround(Math.fround(40 * 0.5) * 0.0025) * 3),
  )
  assert.equal(updated.actor.rocks.length, 2)
  assert.equal(updated.actor.rocks[0]!.decay, 1)
  assert.equal(updated.actor.rocks[0]!.phase, 0)
  assert.equal(updated.actor.rocks[0]!.releaseOffset, null)
  assert.equal(updated.hailRockFades.length, 2)
  assert.ok(updated.hailRockFades.every(({ rotationDegrees }) => (
    rotationDegrees >= 0 && rotationDegrees < 20
  )))

  let expected = rng
  for (let index = 0; index < 2; index += 1) {
    expected = drawNativeInteger(expected, 3).state
    expected = drawNativeFloat(expected, 50, true).state
    expected = drawNativeFloat(expected, 50, true).state
    expected = drawNativeFloat(expected, 50, true).state
    if (index === 0) expected = drawNativeFloat(expected, 10).state
    expected = drawNativeFloat(expected, Math.fround(0.75)).state
    expected = drawNativeFloat(expected, 20).state
  }
  assert.deepEqual(updated.rng, expected)

  const presentation = drawNativeFloat(expected, Math.fround(0.75))
  const released = releaseNativeWeldPersistentActor({
    actor: updated.actor,
    firstChildId: 6,
    rng: expected,
    tick: 7,
  })
  assert.deepEqual(released.rng, presentation.state)
  const actor = released.actors[0]
  assert.ok(actor?.buildId === 1008)
  assert.equal(actor.phase, 'flight')
  assert.deepEqual(actor.origin, { x: -10, y: 20 })
  assert.equal(actor.releaseFadeScale, Math.fround(presentation.value + 0.75))
  assert.equal(actor.rocks[0]!.releaseOffset!.x, actor.rocks[0]!.localPosition.x)
  assert.ok(actor.rocks.every(({ damageRemaining, releaseOffset }) => (
    damageRemaining === 8 && releaseOffset !== null
  )))
  const releaseFade = released.actors[1]
  assert.ok(releaseFade?.kind === 'weld-frost-fade')
  assert.equal(releaseFade.birthTick, 7)
  assert.equal(releaseFade.scale, Math.fround(actor.releaseFadeScale * 5))

  const stepped = stepNativeWeldWorldActor(actor, createNativeRng(3))
  assert.ok(stepped.actor?.kind === 'weld-persistent' && stepped.actor.buildId === 1008)
  assert.deepEqual(stepped.actor.origin, { x: 20, y: 20 })
  assert.equal(stepped.actor.collisionRadius, Math.fround(41.5))
  assert.equal(stepped.actor.rocks[0]!.decay, Math.fround(0.95))
  assert.equal(stepped.actor.rocks[0]!.phase, Math.fround(0.025))
  const firstRock = stepped.actor.rocks[0]!
  assert.equal(firstRock.releaseOffset!.x, firstRock.localPosition.x)
  assert.notEqual(firstRock.releaseOffset!.y, Math.fround(
    firstRock.localPosition.y
      + Math.fround(
        Math.fround(50 - firstRock.localPosition.z * Math.fround(0.8))
          - firstRock.localPosition.y,
      ) * Math.fround(0.95),
  ))
})

test('weak retained welds suppress native payloads and obey their distinct release gates', () => {
  const ethereal = createNativeWeldPersistentActor({
    buildId: 1006,
    direction: { x: 1, y: 0 },
    id: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    tick: 0,
    vector: [12, 3, 4, 1.2, 1.5, 2],
    worldKey: 'boneyard:1',
  })
  assert.equal(ethereal.buildId, 1006)
  if (ethereal.buildId !== 1006) throw new Error('expected Ethereal Boulder')
  assert.equal(ethereal.maximumScale, Math.fround(0.75))
  assert.equal(ethereal.toughness, Math.fround(1.5))
  const weakEthereal = updateNativeWeldPersistentActor(
    { ...ethereal, remainingDamage: 8, scale: Math.fround(0.31) },
    ethereal.origin,
    ethereal.direction,
    createNativeRng(1),
    { castProgressFactor: 3, underpowered: true },
  )
  assert.equal(weakEthereal.releaseRequested, true)
  assert.equal(weakEthereal.actor.buildId, 1006)
  if (weakEthereal.actor.buildId !== 1006) throw new Error('expected weak Ethereal Boulder')
  assert.equal(weakEthereal.actor.damage, 6)
  assert.equal(weakEthereal.actor.remainingDamage, 4)
  assert.equal(weakEthereal.actor.quantity, 1)
  assert.equal(weakEthereal.actor.speedFactor, 1)
  assert.ok(weakEthereal.debris.length >= 8)
  assert.notDeepEqual(weakEthereal.rng, createNativeRng(1))

  const hail = createNativeWeldPersistentActor({
    buildId: 1008,
    direction: { x: 1, y: 0 },
    id: 2,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    tick: 0,
    vector: [10, 2, 2, 1.5, 0.4, 0.8],
    worldKey: 'boneyard:1',
  })
  assert.equal(hail.buildId, 1008)
  if (hail.buildId !== 1008) throw new Error('expected Hailstones')
  assert.equal(hail.maximumScale, 1)
  assert.equal(hail.toughness, Math.fround(1.5))
  const weakHail = updateNativeWeldPersistentActor(
    { ...hail, scale: Math.fround(0.31) },
    hail.origin,
    hail.direction,
    createNativeRng(2),
    { castProgressFactor: 2, underpowered: true },
  )
  assert.equal(weakHail.releaseRequested, false)
  assert.equal(weakHail.actor.buildId, 1008)
  if (weakHail.actor.buildId !== 1008) throw new Error('expected weak Hailstones')
  assert.equal(weakHail.actor.scale, Math.fround(0.31))
  assert.equal(weakHail.actor.damage, 5)
  assert.equal(weakHail.actor.pushback, 0)
  assert.equal(weakHail.actor.widen, 0)
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
    cellBindingOrder: 0,
    id,
    kind: 'enemy' as const,
    nativePriority: 0,
    pendingRemove: false,
    position: { x, y },
    registrationOrder: 0,
  }
}
