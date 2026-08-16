import assert from 'node:assert/strict'
import test from 'node:test'

import { nativeDemonArticulationSample } from '../core-kernels/boneyard-demon-articulation.ts'
import {
  createNativeImpFlightState,
  nativeImpEffectFrame,
  stepNativeImpFlight,
} from '../core-kernels/boneyard-imp-flight.ts'
import {
  NATIVE_MAGE_CAST_BODY_POSES,
  nativeMageBodyPose,
} from '../core-kernels/boneyard-mage-lightning.ts'
import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  NATIVE_ENEMY_DEATH_PROGRAMS,
  nativeEnemyActionFrame,
  nativeEnemyIdleAnimationSample,
  nativeZombieArticulationPose,
  nativeZombieBeatPose,
} from './native-enemy-animation.ts'

test('stock Skeleton, Archer, Mage, and Demon selectors are recorded exactly', () => {
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['skeleton-claw-a'].frames,
    [4, 5, 6, 7, 8, 9, 10, 11],
  )
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['skeleton-claw-b'].frames,
    [2, 3, 4, 5, 6, 7, 8, 9],
  )
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['skeleton-weapon'].frames,
    [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1],
  )
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['skeleton-pike'].frames,
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  )
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['archer-shot'].frames,
    [3, 4, 5, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 8, 8, 8, 8],
  )
  assert.equal(NATIVE_ENEMY_ACTION_PROGRAMS['mage-cast-short'].frames.length, 42)
  assert.equal(NATIVE_ENEMY_ACTION_PROGRAMS['mage-cast-long'].frames.length, 48)
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['demon-bomb'].frames,
    [0, 0, 0, 1, 1, 1, 1, 1, 0],
  )
  assert.deepEqual(NATIVE_ENEMY_ACTION_PROGRAMS['demon-bomb'].eventMarkers, [4])
  assert.equal(NATIVE_ENEMY_ACTION_PROGRAMS['demon-bomb'].strictEnd, 8)
  assert.equal(NATIVE_ENEMY_ACTION_PROGRAMS['demon-bomb'].progressPerTick, 0.09375)
})

test('Mage lightning attachment pose shares every renderer action selector', () => {
  for (const castProgram of ['short', 'long'] as const) {
    const action = `mage-cast-${castProgram}` as const
    const poses = NATIVE_MAGE_CAST_BODY_POSES[castProgram]
    assert.strictEqual(NATIVE_ENEMY_ACTION_PROGRAMS[action].frames, poses)

    for (let frame = 0; frame <= poses.length + 2; frame += 1) {
      for (const fraction of [0, 0.25, 0.999]) {
        const actionProgress = frame + fraction
        assert.equal(
          nativeMageBodyPose({
            actionProgress,
            bodyPose: 0,
            castProgram,
            phase: 'cast',
          }),
          nativeEnemyActionFrame(action, actionProgress).selector,
          `${castProgram} progress ${actionProgress}`,
        )
      }
    }
  }
})

test('native strict completion boundaries do not complete on equality', () => {
  for (const name of [
    'skeleton-claw-a',
    'skeleton-claw-b',
    'skeleton-weapon',
    'skeleton-pike',
    'archer-shot',
    'mage-cast-short',
    'mage-cast-long',
    'demon-bomb',
  ] as const) {
    const end = NATIVE_ENEMY_ACTION_PROGRAMS[name].strictEnd
    assert.equal(nativeEnemyActionFrame(name, end).complete, false, name)
    assert.equal(nativeEnemyActionFrame(name, end + Number.EPSILON * Math.max(1, end)).complete, true, name)
  }
})

test('stock fixed-tick rates reproduce the recovered nominal marker and end ticks', () => {
  const nominalTicks = {
    'skeleton-claw-a': { end: 57, marker: 32 },
    'skeleton-weapon': { end: 97, marker: 36 },
    'skeleton-pike': { end: 97, marker: 16 },
    'archer-shot': { end: 190, marker: 155 },
  } as const
  for (const [name, ticks] of Object.entries(nominalTicks) as [
    keyof typeof nominalTicks,
    { end: number; marker: number },
  ][]) {
    const program = NATIVE_ENEMY_ACTION_PROGRAMS[name]
    assert.ok((ticks.marker - 1) * program.progressPerTick < program.eventMarkers[0])
    assert.ok(ticks.marker * program.progressPerTick >= program.eventMarkers[0])
    assert.ok((ticks.end - 1) * program.progressPerTick <= program.strictEnd)
    assert.ok(ticks.end * program.progressPerTick > program.strictEnd)
  }
  assert.deepEqual(NATIVE_ENEMY_ACTION_PROGRAMS['mage-cast-short'].rateFactors, [
    'one-plus-cast-roll',
    'attack-speed',
  ])
})

test('event markers and terminal selectors remain sampled after completion', () => {
  const before = nativeEnemyActionFrame('archer-shot', 12.999)
  const marker = nativeEnemyActionFrame('archer-shot', 13)
  const complete = nativeEnemyActionFrame('archer-shot', 17)

  assert.deepEqual(before.eventMarkersReached, [])
  assert.deepEqual(marker.eventMarkersReached, [13])
  assert.equal(marker.selector, 8)
  assert.equal(complete.selector, 8)
  assert.equal(complete.complete, true)
})

test('Zombie beat selects exactly one arm at native thresholds', () => {
  assert.deepEqual(nativeZombieBeatPose(49.999, 0), {
    complete: false,
    frontArmPose: 0,
    locomotionActive: true,
    markerReached: false,
    rearArmPose: 0,
  })
  assert.deepEqual(nativeZombieBeatPose(50, 1), {
    complete: false,
    frontArmPose: 1,
    locomotionActive: true,
    markerReached: false,
    rearArmPose: 0,
  })
  assert.equal(nativeZombieBeatPose(80, 1).locomotionActive, false)
  assert.deepEqual(nativeZombieBeatPose(100, 0), {
    complete: false,
    frontArmPose: 0,
    locomotionActive: false,
    markerReached: true,
    rearArmPose: 2,
  })
  assert.equal(nativeZombieBeatPose(125, 0).complete, true)
})

test('Imp flight uses constructor fields and collision-driven bounce VFX', () => {
  const constructorDraws = draws([0.25, 0.6, 0.75])
  assert.deepEqual(createNativeImpFlightState(constructorDraws), {
    bodyRotationDeg: 22.5,
    bodyVariant: 2,
    effectAlpha: 0,
    effectPhase: 2.5,
    verticalOffset: 0,
    verticalVelocity: 0,
  })

  const bounce = stepNativeImpFlight({
    bodyRotationDeg: 22.5,
    bodyVariant: 2,
    effectAlpha: 0.4,
    effectPhase: 9.9,
    verticalOffset: 0,
    verticalVelocity: 0.4,
  }, 2, draws([0.5, 0.99, 0, 0.15]))
  assert.equal(bounce.bounced, true)
  assert.equal(bounce.state.effectPhase, 0.40000000000000036)
  assert.equal(bounce.state.effectAlpha, 1)
  assert.equal(bounce.state.bodyVariant, 3)
  assert.equal(bounce.state.bodyRotationDeg, -60)
  assert.equal(bounce.state.verticalOffset, 0)
  assert.equal(bounce.state.verticalVelocity, -6.75)
  assert.equal(nativeImpEffectFrame(9.999), 9)
})

test('Zombie renderer articulation preserves native quantization and attack side', () => {
  const idle = nativeZombieArticulationPose({
    actionActive: false,
    actionSwing: 0,
    attackSide: 0,
    bodyPhaseDeg: 90,
    frontArmBaseRotationDeg: 20,
    headBaseRotationDeg: -5,
    headPhaseDeg: 180,
    rearArmBaseRotationDeg: 10,
  })
  assert.equal(idle.bodyRotationRadians, 40 * Math.PI / 180)
  assert.equal(idle.headRotationRadians, 15 * Math.PI / 180)
  assert.equal(idle.rearArmRotationRadians, -10 * Math.PI / 180)
  assert.equal(idle.frontArmRotationRadians, 20 * Math.PI / 180)

  const attack = nativeZombieArticulationPose({
    actionActive: true,
    actionSwing: 26,
    attackSide: 1,
    bodyPhaseDeg: 0,
    frontArmBaseRotationDeg: 5,
    headBaseRotationDeg: 0,
    headPhaseDeg: 0,
    rearArmBaseRotationDeg: 7,
  })
  assert.equal(attack.bodyRotationRadians, (26 / 3) * Math.PI / 180)
  assert.equal(attack.frontArmRotationRadians, 35 * Math.PI / 180)
  assert.equal(attack.rearArmRotationRadians, -7 * Math.PI / 180)
})

test('Demon controller uses native idle joints, action lock, and vertical bob', () => {
  const idle = nativeDemonArticulationSample(90, 0, 0)
  assert.equal(idle.frontRotationRadians, 2 * Math.PI / 180)
  assert.equal(idle.rearRotationRadians, 3 * Math.PI / 180)
  assert.ok(idle.verticalOffset < 0)

  const bomb = nativeDemonArticulationSample(90, 0, 1)
  assert.equal(bomb.frontRotationRadians, 40 * Math.PI / 180)
  assert.equal(bomb.rearRotationRadians, -40 * Math.PI / 180)
  assert.equal(bomb.verticalOffset, idle.verticalOffset)
})

test('every family death has a named bounded terminal program', () => {
  assert.deepEqual(
    Object.values(NATIVE_ENEMY_DEATH_PROGRAMS).map((program) => program.name),
    [
      'skeleton-shatter',
      'archer-shatter',
      'mage-shatter',
      'imp-split',
      'zombie-collapse',
      'wraith-dissolve',
      'demon-split',
      'coffin-break',
    ],
  )
  assert.ok(Object.values(NATIVE_ENEMY_DEATH_PROGRAMS).every((program) => (
    program.provenance === 'bounded-web' && program.durationTicks > 0
  )))
  assert.equal(NATIVE_ENEMY_DEATH_PROGRAMS.SKELETON.bodyRemovedAtTick, 0)
  assert.equal(NATIVE_ENEMY_DEATH_PROGRAMS.ZOMBIE.bodyRemovedAtTick, null)
})

test('renderer animation samples have stable authoritative defaults', () => {
  const sample = nativeEnemyIdleAnimationSample({
    alpha: 0.5,
    state: 'locomotion',
  })
  assert.equal(sample.alpha, 0.5)
  assert.equal(sample.state, 'locomotion')
  assert.equal(sample.gaitPose, 0)
  assert.equal(sample.action, null)
  assert.equal(sample.deathEpoch, 0)
  assert.deepEqual(sample.effects, [])
  assert.deepEqual(sample.maggots, [])
})

test('invalid action clocks fail closed', () => {
  assert.throws(() => nativeEnemyActionFrame('demon-bomb', -1), /finite and non-negative/)
  assert.throws(() => nativeEnemyActionFrame('demon-bomb', Number.NaN), /finite and non-negative/)
  assert.throws(() => nativeZombieBeatPose(-1, 0), /finite and non-negative/)
})

function draws(values: readonly number[]): () => number {
  let index = 0
  return () => {
    const value = values[index]
    if (value === undefined) throw new Error('test random stream exhausted')
    index += 1
    return value
  }
}
