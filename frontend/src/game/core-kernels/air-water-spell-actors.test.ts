import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeAirPrismaticActor,
  createNativeAirStormActor,
  createNativeWaterAuraActor,
  createNativeWaterHailActor,
  nativeWaterHailLifeAtAge,
  createNativeWaterFreezeWave,
  drawNativeDisintegratePercentile,
  drawNativeStormInitialHeading,
  NATIVE_FREEZE_WAVE_INITIAL_RADIUS,
  NATIVE_HAIL_MINIMUM_HEIGHT,
  NATIVE_STORM_FADE_TICKS,
  resetNativeStormStrikeDelay,
  stepNativeAirStormActor,
  stepNativeWaterHailActor,
  stepNativeWaterFreezeWave,
  type NativeAirPrismaticSkillProfile,
  type NativeAirStormSkillProfile,
  type NativeWaterRingSkillProfile,
  type NativeWaterHailTickResult,
} from './air-water-spell-actors.ts'
import { createNativeRng } from './native-rng.ts'

const STORM = {
  activeTicks: 1_200,
  damageMaximum: 14,
  damageMinimum: 8,
  firstStrikeTicks: 50,
  frequencyFactor: 1.5,
  kind: 'air-storm',
  manaCost: 30,
  moving: true,
  rank: 2,
  skillId: 27,
} satisfies NativeAirStormSkillProfile

test('Storm and Tornado snapshot their rank payload and consume movement RNG', () => {
  const initial = createNativeRng(17)
  const heading = drawNativeStormInitialHeading(initial)
  const storm = createNativeAirStormActor(
    4,
    'air-player',
    'boneyard:run',
    90,
    { x: 10, y: 20 },
    STORM,
    heading.value,
  )
  const first = stepNativeAirStormActor(storm, heading.rng)
  assert.equal(first.actor?.activeTicksRemaining, 1_199)
  assert.equal(first.actor?.ageTicks, 1)
  assert.equal(first.actor?.alpha, Math.fround(0.05))
  assert.equal(storm.scale, Math.fround(0.01))
  assert.equal(first.actor?.scale, Math.fround(Math.fround(0.01) * 1.2))
  assert.equal(first.actor?.strikeTicksRemaining, 49)
  assert.notDeepEqual(first.actor?.position, storm.position)
  assert.notDeepEqual(first.rng, heading.rng)
})

test('Storm resets the inclusive 30..120 delay through its frequency factor', () => {
  const actor = createNativeAirStormActor(
    1,
    'air-player',
    'boneyard:run',
    0,
    { x: 0, y: 0 },
    STORM,
    0,
  )
  const reset = resetNativeStormStrikeDelay(actor, createNativeRng(2))
  assert.ok(reset.actor.strikeTicksRemaining >= Math.trunc(30 / 1.5))
  assert.ok(reset.actor.strikeTicksRemaining <= Math.trunc(120 / 1.5))
})

test('Storm owns 101 fade ticks after the active clock', () => {
  let actor = {
    ...createNativeAirStormActor(1, 'air', 'world', 0, { x: 0, y: 0 }, STORM, 0),
    activeTicksRemaining: 0,
    alpha: 1,
  }
  let ticks = 0
  let rng = createNativeRng(1)
  while (actor) {
    const stepped = stepNativeAirStormActor(actor, rng)
    actor = stepped.actor!
    rng = stepped.rng
    ticks += 1
  }
  assert.equal(ticks, NATIVE_STORM_FADE_TICKS)
})

test('Disintegrate uses the event-local native high-tail percentile', () => {
  const initial = createNativeRng(11)
  const zero = drawNativeDisintegratePercentile(initial, 0)
  assert.equal(zero.success, false)
  const certain = drawNativeDisintegratePercentile(initial, 100)
  assert.equal(certain.success, true)
  assert.deepEqual(zero.rng, certain.rng)
})

test('Hail birth keeps native size and consumes the nine-word Bouncer and handler sequence', () => {
  const initial = createNativeRng(37)
  const born = createNativeWaterHailActor(
    9,
    'water',
    'boneyard:run',
    44,
    { x: 100, y: 200 },
    { x: 0, y: -1 },
    initial,
  )
  assert.equal(born.actor.ageTicks, 0)
  assert.equal(born.actor.life, Math.fround(2))
  assert.ok(born.actor.height <= 0)
  assert.ok(born.actor.savedBounceVelocity <= -2)
  assert.ok(born.actor.savedBounceVelocity >= -5)
  assert.ok(born.actor.scale >= Math.fround(0.4) && born.actor.scale <= Math.fround(0.6))
  assert.ok(born.actor.rotationStepDegrees >= 1 && born.actor.rotationStepDegrees <= 11)
  assert.equal(born.actor.horizontalVelocity.x, 0)
  assert.ok(born.actor.horizontalVelocity.y <= -4)
  assert.ok(born.actor.horizontalVelocity.y >= -6)

  // Four Bouncer words, two signed Float0.1 words, then
  // Float15, Integer100001, Float2.
  assert.equal(born.rng.indexA, (initial.indexA + 9) % 55)
  assert.equal(born.rng.indexB, (initial.indexB + 9) % 55)
})

test('Hail keeps signed native scale endpoints through its complete lifetime', () => {
  for (const [signWord, expectedScale] of [[0, 0.6000000238418579], [64, 0.4000000059604645]] as const) {
    const words = new Array<number>(55).fill(0)
    // The four inherited Bouncer words precede Hail magnitude and sign.
    words[1] = 50_000 * 64
    words[4] = 100_000 * 64
    words[5] = signWord
    words[6] = 50_000 * 64
    words[7] = 25_000 * 64
    words[8] = 75_000 * 64
    const born = createNativeWaterHailActor(
      1, 'water', 'boneyard:run', 0, { x: 100, y: 0 }, { x: 1, y: 0 },
      { indexA: 0, indexB: 31, words },
    )
    assert.equal(born.actor.scale, expectedScale)
    assert.deepEqual(born.actor.position, { x: 107.5, y: -5.662342346113292e-7 })
    assert.deepEqual(born.actor.horizontalVelocity, { x: 5.5, y: 0 })
    let stepped: NativeWaterHailTickResult = born
    let ticks = 0
    while (stepped.actor !== null) {
      assert.equal(stepped.actor.scale, expectedScale)
      stepped = stepNativeWaterHailActor(stepped.actor, stepped.rng)
      ticks += 1
    }
    assert.equal(ticks, 134)
  }
})

test('Hail lifetime height envelope includes the complete first bounce arc', () => {
  const born = createNativeWaterHailActor(
    9,
    'water',
    'boneyard:run',
    44,
    { x: 100, y: 200 },
    { x: 1, y: 0 },
    createNativeRng(41),
  )
  let actor = {
    ...born.actor,
    height: Math.fround(-0.0002),
    savedBounceVelocity: -5,
  }
  let rng = born.rng
  let minimum = actor.height
  while (actor) {
    minimum = Math.min(minimum, actor.height)
    const stepped = stepNativeWaterHailActor(actor, rng)
    actor = stepped.actor!
    rng = stepped.rng
  }
  assert.equal(minimum, -79.45001220703125)
  assert.equal(minimum, NATIVE_HAIL_MINIMUM_HEIGHT)
})

test('Cold Aura snapshots native fade and its two cosmetic RNG draws', () => {
  const initial = createNativeRng(43)
  const born = createNativeWaterAuraActor(
    10,
    'water',
    'boneyard:run',
    44,
    { x: 100, y: 200 },
    720,
    initial,
  )
  assert.equal(born.actor.alphaDecay, Math.fround(0.15 / 720))
  assert.equal(born.actor.durationTicks, 2_400)
  assert.ok(born.actor.rotationStepDegrees >= 0)
  assert.ok(born.actor.rotationStepDegrees < 1)
  assert.ok(born.actor.initialRotationDegrees >= 0)
  assert.ok(born.actor.initialRotationDegrees < 360)
  assert.equal(born.rng.indexA, (initial.indexA + 2) % 55)
  assert.equal(born.rng.indexB, (initial.indexB + 2) % 55)
})

test('Hail owns Bouncer motion, bounce RNG, audio sequence, and 134-tick life', () => {
  const born = createNativeWaterHailActor(
    9,
    'water',
    'boneyard:run',
    44,
    { x: 100, y: 200 },
    { x: 1, y: 0 },
    createNativeRng(41),
  )
  const forcedBounce = {
    ...born.actor,
    height: 0.1,
    savedBounceVelocity: -2,
  }
  const bounced = stepNativeWaterHailActor(forcedBounce, born.rng)
  assert.ok(bounced.actor)
  assert.equal(bounced.actor.height, Math.fround(-1.3))
  assert.equal(bounced.actor.verticalVelocity, Math.fround(-1.3))
  assert.equal(bounced.rng.indexA, (born.rng.indexA + (
    bounced.actor.bounceSoundSequence === 1 ? 6 : 3
  )) % 55)

  for (const [signWord, pitch] of [[0, 1.2000000476837158], [64, 0.800000011920929]] as const) {
    for (const sample of [0, 1, 2, 3]) {
      const words = new Array<number>(55).fill(0)
      words[1] = 64 // Integer(3) == 1 admits the sound.
      words[2] = 100_000 * 64
      words[3] = signWord
      words[4] = sample * 64
      const bounced = stepNativeWaterHailActor(forcedBounce, { indexA: 0, indexB: 31, words })
      assert.ok(bounced.actor)
      assert.equal(bounced.actor.bounceSoundSequence, 1)
      assert.equal(bounced.actor.bounceSoundPitch, pitch)
      assert.equal(bounced.actor.bounceSoundIndex, sample)
      assert.equal(bounced.rng.indexA, 6)
      assert.equal(bounced.rng.indexB, 37)
    }
  }

  let actor = born.actor
  let rng = born.rng
  let ticks = 0
  while (actor) {
    const stepped = stepNativeWaterHailActor(actor, rng)
    actor = stepped.actor!
    rng = stepped.rng
    ticks += 1
  }
  assert.equal(ticks, 134)
})

test('Hail respects intermediate native motion stores and preserves its clock at settlement', () => {
  const born = createNativeWaterHailActor(
    1, 'water', 'boneyard:run', 0, { x: 0, y: 0 }, { x: 1, y: 0 }, createNativeRng(37),
  )
  const cases = [
    { height: -0.03700000047683716, verticalVelocity: -0.00017299999308306724,
      bounceProgress: 0.0010000000474974513, nextHeight: -0.037345997989177704,
      nextVelocity: 0.000627000059466809 },
    { height: -0.40700000524520874, verticalVelocity: -0.0019030000548809767,
      bounceProgress: 0.010999999940395355, nextHeight: -0.41080600023269653,
      nextVelocity: 0.006897000130265951 },
  ]
  for (const { nextHeight, nextVelocity, ...motion } of cases) {
    const result = stepNativeWaterHailActor({ ...born.actor, ...motion }, born.rng)
    assert.ok(result.actor)
    assert.equal(result.actor.height, nextHeight)
    assert.equal(result.actor.verticalVelocity, nextVelocity)
  }
  const stopped = stepNativeWaterHailActor({
    ...born.actor, height: Math.fround(-0.1), verticalVelocity: Math.fround(0.1),
    bounceProgress: 0.5, savedBounceVelocity: -1,
  }, born.rng)
  assert.ok(stopped.actor)
  assert.equal(stopped.actor.height, 0)
  assert.equal(stopped.actor.verticalVelocity, 0)
  assert.deepEqual(stopped.actor.horizontalVelocity, { x: 0, y: 0 })
  assert.equal(stopped.actor.rotationStepDegrees, 0)
  assert.equal(stopped.actor.savedBounceVelocity, 0)
  assert.equal(stopped.actor.bounceProgress, 0.5199999809265137)
})

test('Hail preserves native settled-zero and full airborne height lifecycle', () => {
  const born = createNativeWaterHailActor(
    9,
    'water',
    'boneyard:run',
    44,
    { x: 100, y: 200 },
    { x: 1, y: 0 },
    createNativeRng(41),
  )
  const settled = {
    ...born.actor,
    bounceProgress: 0.7,
    height: 0,
    life: 1,
  }
  const stationary = stepNativeWaterHailActor(settled, born.rng)
  assert.ok(stationary.actor)
  assert.deepEqual(stationary.rng, born.rng)
  assert.deepEqual(stationary.actor.position, settled.position)
  assert.equal(stationary.actor.bounceProgress, settled.bounceProgress)
  assert.equal(stationary.actor.height, 0)
  const expiredInAir = stepNativeWaterHailActor({
    ...born.actor, height: -10, life: Math.fround(0.015),
  }, born.rng)
  assert.equal(expiredInAir.actor, null)
  assert.deepEqual(expiredInAir.rng, born.rng)

  let airborne = {
    ...born.actor,
    height: Math.fround(-0.0002),
    savedBounceVelocity: -5,
  }
  let rng = born.rng
  let minimumHeight = airborne.height
  while (airborne) {
    const stepped = stepNativeWaterHailActor(airborne, rng)
    airborne = stepped.actor!
    rng = stepped.rng
    if (airborne) minimumHeight = Math.min(minimumHeight, airborne.height)
  }
  assert.ok(minimumHeight < -20)
  assert.ok(minimumHeight >= NATIVE_HAIL_MINIMUM_HEIGHT)
})

test('Hail lifecycle table reproduces every authoritative float32 subtraction', () => {
  let actor = createNativeWaterHailActor(
    1,
    'wizard',
    'boneyard:run-1',
    100,
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    createNativeRng(41),
  ).actor
  let rng = createNativeRng(9)
  for (let ageTicks = 0; actor; ageTicks += 1) {
    assert.equal(nativeWaterHailLifeAtAge(ageTicks), actor.life)
    const stepped = stepNativeWaterHailActor(actor, rng)
    actor = stepped.actor!
    rng = stepped.rng
  }
  assert.throws(() => nativeWaterHailLifeAtAge(-1), /native lifecycle/)
  assert.throws(() => nativeWaterHailLifeAtAge(134), /native lifecycle/)
})

test('Prismatic owns a 100-tick spray actor independent of modifier duration', () => {
  const profile = {
    durationTicks: 750,
    kind: 'air-prismatic',
    manaCost: 20,
    radius: 350,
    rank: 1,
    skillId: 30,
  } satisfies NativeAirPrismaticSkillProfile
  const actor = createNativeAirPrismaticActor(
    1,
    'air',
    'world',
    3,
    { x: 4, y: 5 },
    profile,
  )
  assert.equal(actor.durationTicks, 100)
  assert.equal(actor.modifierDurationTicks, 750)
  assert.equal(actor.radius, 350)
})

test('Ring of Ice expands every tick, queries every tenth tick, and dies on tick 93', () => {
  const profile = {
    freezeDurationTicks: 400,
    kind: 'water-ring',
    manaCost: 15,
    rank: 1,
    skillId: 35,
  } satisfies NativeWaterRingSkillProfile
  let actor = createNativeWaterFreezeWave(
    1,
    'water',
    'world',
    0,
    { x: 20, y: 30 },
    profile,
  )
  const queryTicks: number[] = []
  let removedAt = 0
  for (let tick = 1; tick <= 100; tick += 1) {
    const stepped = stepNativeWaterFreezeWave(actor)
    if (stepped.queryDue) queryTicks.push(tick)
    if (!stepped.actor) {
      removedAt = tick
      break
    }
    actor = stepped.actor
  }
  assert.equal(removedAt, 93)
  assert.deepEqual(queryTicks, [10, 20, 30, 40, 50, 60, 70, 80, 90])
  assert.equal(actor.radius, NATIVE_FREEZE_WAVE_INITIAL_RADIUS + 92 * 6)
})
