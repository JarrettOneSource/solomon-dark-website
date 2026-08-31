import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
  NATIVE_DEMON_CONTROLLER_POINT_SCALE,
  NATIVE_DEMON_EXTREMITY_DRAW_SCALE,
  NATIVE_DEMON_STEP_INTERVAL_MAXIMUM_TICKS,
  NATIVE_DEMON_STEP_INTERVAL_MINIMUM_TICKS,
  createNativeDemonArticulationState,
  nativeDemonArticulationRoot,
  nativeDemonArticulationSample,
  nativeDemonExtremityTarget,
  stepNativeDemonArticulation,
} from '../core-kernels/boneyard-demon-articulation.ts'
import {
  createNativeImpFlightState,
  nativeImpEffectFrame,
  stepNativeImpFlight,
} from '../core-kernels/boneyard-imp-flight.ts'
import {
  NATIVE_BADGUY_GAIT_PHASE_DIVISOR,
  NATIVE_BADGUY_GAIT_PHASE_PERIOD,
  NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
  NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
  NATIVE_SKELETON_BODY_GAIT_POSES,
  advanceNativeEnemyLocomotionPhase,
  advanceNativeEnemyStridePhase,
  nativeSkeletonBodyGaitPose,
} from '../core-kernels/boneyard-skeleton-family-animation.ts'
import {
  NATIVE_MAGE_CAST_BODY_POSES,
  nativeMageBodyPose,
} from '../core-kernels/boneyard-mage-lightning.ts'
import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  nativeEnemyActionFrame,
  nativeEnemyIdleAnimationSample,
  nativeZombieArticulationPose,
  nativeZombieBeatPose,
} from './native-enemy-animation.ts'

test('Badguy locomotion advances independent native gait and Skeleton body phases', () => {
  assert.equal(NATIVE_BADGUY_GAIT_PHASE_DIVISOR, 25)
  assert.equal(NATIVE_BADGUY_GAIT_PHASE_PERIOD, 8)
  assert.equal(NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR, 35)
  assert.equal(NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD, 4)
  assert.deepEqual(NATIVE_SKELETON_BODY_GAIT_POSES, [0, 1, 2, 1, 0.5])

  assert.equal(advanceNativeEnemyLocomotionPhase(7, 25, 1, 25, 8), 8)
  assert.equal(advanceNativeEnemyLocomotionPhase(8, 25, 1, 25, 8), 1)
  assert.equal(advanceNativeEnemyLocomotionPhase(3, 35, 1, 35, 4), 4)
  assert.equal(advanceNativeEnemyLocomotionPhase(4, 35, 1, 35, 4), 1)
  assert.equal(advanceNativeEnemyLocomotionPhase(0, 17.5, 2, 35, 4), 1)
  assert.equal(advanceNativeEnemyStridePhase(90, 2, 4), 122)

  assert.deepEqual(
    [0, 1, 2, 3, 4].map(nativeSkeletonBodyGaitPose),
    [0, 1, 2, 1, 0.5],
  )
})

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
    rearArmPose: 1,
  })
  assert.deepEqual(nativeZombieBeatPose(50, 1), {
    complete: false,
    frontArmPose: 2,
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
    rearArmPose: 0,
  })
  assert.equal(nativeZombieBeatPose(125, 0).complete, true)
})

test('Imp flight uses constructor fields and collision-driven bounce VFX', () => {
  const constructorDraws = draws([0.25, 0.6, 0.75, 0.75])
  assert.deepEqual(createNativeImpFlightState(constructorDraws, 4.5), {
    baseHorizontalSpeed: 4.5,
    bodyRotationDeg: 33.75,
    bodyVariant: 2,
    effectAlpha: 0,
    effectPhase: 2.5,
    horizontalSpeed: 4.5,
    verticalOffset: 0,
    verticalVelocity: 0,
  })

  const bounce = stepNativeImpFlight({
    baseHorizontalSpeed: 4.5,
    bodyRotationDeg: 22.5,
    bodyVariant: 2,
    effectAlpha: 0.4,
    effectPhase: 9.9,
    horizontalSpeed: 2,
    verticalOffset: 0,
    verticalVelocity: 0.4,
  }, draws([0.5, 0.99, 0, 0.15, 0.75, 0]))
  assert.equal(bounce.bounced, true)
  assert.equal(bounce.state.effectPhase, 0.40000000000000036)
  assert.equal(bounce.state.effectAlpha, 1)
  assert.equal(bounce.state.horizontalSpeed, 7.875)
  assert.equal(bounce.state.bodyVariant, 0)
  assert.equal(bounce.state.bodyRotationDeg, 9)
  assert.equal(bounce.state.verticalOffset, 0)
  assert.ok(Math.abs(bounce.state.verticalVelocity + 5.97) < 1e-12)
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
  assert.equal(idle.bodyRotationRadians, 20 * Math.PI / 180)
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
  assert.equal(attack.bodyRotationRadians, (26 / 3) * 0.5 * Math.PI / 180)
  assert.equal(attack.frontArmRotationRadians, 25 * Math.PI / 180)
  assert.equal(attack.rearArmRotationRadians, -7 * Math.PI / 180)
})

test('Demon owns native planted endpoints, scale lanes, action lock, and vertical bob', () => {
  assert.equal(NATIVE_DEMON_EXTREMITY_DRAW_SCALE, 0.8)
  assert.equal(NATIVE_DEMON_CONTROLLER_DRAW_SCALE, 1.2)
  assert.equal(NATIVE_DEMON_CONTROLLER_POINT_SCALE, 1.5)

  assert.deepEqual(
    nativeDemonExtremityTarget({ x: 100, y: 200 }, 0, 1, 'front'),
    { x: 112, y: 170 },
  )
  assert.deepEqual(
    nativeDemonExtremityTarget({ x: 100, y: 200 }, 0, 1, 'rear'),
    { x: 88, y: 170 },
  )
  for (let facing = 0; facing < 18; facing += 1) {
    const front = nativeDemonExtremityTarget(
      { x: 100, y: 200 },
      facing * 20,
      1,
      'front',
    )
    const rear = nativeDemonExtremityTarget(
      { x: 100, y: 200 },
      facing * 20,
      1,
      'rear',
    )
    assert.ok(Math.abs(Math.hypot(front.x - rear.x, front.y - rear.y) - 24) < 1e-10)
    assert.ok(Math.abs(Math.hypot(
      (front.x + rear.x) * 0.5 - 100,
      (front.y + rear.y) * 0.5 - 200,
    ) - 30) < 1e-10)
  }
  const bucketed = nativeDemonExtremityTarget({ x: 100, y: 200 }, 90, 2, 'front')
  assert.ok(Math.abs(bucketed.x - 163.25602144473882) < 1e-12)
  assert.ok(Math.abs(bucketed.y - 213.21649541227717) < 1e-12)

  let state = createNativeDemonArticulationState(
    7,
    20,
    { x: 100, y: 200 },
    0,
    1,
  )
  assert.ok(state.stepIntervalTicks >= NATIVE_DEMON_STEP_INTERVAL_MINIMUM_TICKS)
  assert.ok(state.stepIntervalTicks <= NATIVE_DEMON_STEP_INTERVAL_MAXIMUM_TICKS)
  assert.deepEqual(state.front.current, { x: 112, y: 170 })
  assert.deepEqual(state.rear.current, { x: 88, y: 170 })
  assert.deepEqual(nativeDemonArticulationRoot(state), { x: 100, y: 170 })
  assert.equal(state.front.phase, 1)
  assert.equal(state.rear.phase, 1)

  const replantTick = state.stepIntervalTicks
  state = stepNativeDemonArticulation(state, {
    active: true,
    actorId: 7,
    headingDeg: 0,
    position: { x: 110, y: 200 },
    scale: 1,
    spawnTick: 20,
    tick: replantTick,
  })
  assert.equal(state.front.phase, (0 + 0.015) * 1.06)
  assert.ok(state.front.current.x > 112 && state.front.current.x < 122)
  assert.ok(state.front.liftY < 0)
  assert.equal(state.rear.phase, 1)

  const frozen = stepNativeDemonArticulation(state, {
    active: false,
    actorId: 7,
    headingDeg: 0,
    position: { x: 120, y: 200 },
    scale: 1,
    spawnTick: 20,
    tick: replantTick + 1,
  })
  assert.deepEqual(frozen, state)

  for (let tick = replantTick + 1; state.completedSteps === 0; tick += 1) {
    state = stepNativeDemonArticulation(state, {
      active: true,
      actorId: 7,
      headingDeg: 0,
      position: { x: 110, y: 200 },
      scale: 1,
      spawnTick: 20,
      tick,
    })
  }
  assert.equal(state.front.phase, 1)
  assert.equal(state.front.liftY, -Math.sin(Math.PI) * 6)
  assert.ok(state.frontBaseRotationDeg >= -20 && state.frontBaseRotationDeg < 10)
  assert.ok(state.rearBaseRotationDeg >= -20 && state.rearBaseRotationDeg < 10)

  const idle = nativeDemonArticulationSample(state, 90, 20, 0, { x: 110, y: 200 }, 1)
  assert.equal(
    idle.frontRotationRadians,
    (2 + state.frontBaseRotationDeg) * Math.PI / 180,
  )
  assert.equal(
    idle.rearRotationRadians,
    (2 + state.rearBaseRotationDeg) * Math.PI / 180,
  )
  assert.ok(idle.verticalOffset < 0)
  assert.ok(Number.isFinite(idle.frontExtremityOffset.x))
  assert.ok(Number.isFinite(idle.frontExtremityOffset.y))
  assert.ok(Number.isFinite(idle.rearExtremityOffset.x))
  assert.ok(Number.isFinite(idle.rearExtremityOffset.y))

  const bomb = nativeDemonArticulationSample(state, 90, 20, 1, { x: 110, y: 200 }, 1)
  assert.equal(bomb.frontRotationRadians, 40 * Math.PI / 180)
  assert.equal(bomb.rearRotationRadians, -40 * Math.PI / 180)
  assert.equal(bomb.verticalOffset, idle.verticalOffset)
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
