import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeAirPrismaticActor,
  createNativeAirStormActor,
  createNativeWaterHailActor,
  createNativeWaterFreezeWave,
  drawNativeDisintegratePercentile,
  drawNativeStormInitialHeading,
  NATIVE_FREEZE_WAVE_INITIAL_RADIUS,
  NATIVE_STORM_FADE_TICKS,
  resetNativeStormStrikeDelay,
  stepNativeAirStormActor,
  stepNativeWaterHailActor,
  stepNativeWaterFreezeWave,
  type NativeAirPrismaticSkillProfile,
  type NativeAirStormSkillProfile,
  type NativeWaterRingSkillProfile,
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

test('Hail birth consumes the exact eight-draw Bouncer and handler sequence', () => {
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
  assert.ok(born.actor.scale >= 1 && born.actor.scale <= 2)
  assert.ok(born.actor.rotationStepDegrees >= 1 && born.actor.rotationStepDegrees <= 11)
  assert.equal(born.actor.horizontalVelocity.x, 0)
  assert.ok(born.actor.horizontalVelocity.y <= -4)
  assert.ok(born.actor.horizontalVelocity.y >= -6)

  // Eight one-word draws: Float3, Float20, Float360, Float10, Float1,
  // Float15, Integer100001, Float2.
  assert.equal(born.rng.indexA, (initial.indexA + 8) % 55)
  assert.equal(born.rng.indexB, (initial.indexB + 8) % 55)
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
    bounced.actor.bounceSoundSequence === 1 ? 5 : 3
  )) % 55)

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
