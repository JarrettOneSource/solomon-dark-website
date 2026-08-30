import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BONEYARD_ENEMY_FLAGS,
  evaluateBoneyardEnemyConfig,
  type BoneyardEnemyFlag,
} from './boneyard-enemy-config.ts'
import type { BoneyardWaveEnemyToken } from './boneyard-wave-schema.ts'
import { nativeSlumpgutRecipe } from './native-survival-slumpgut.ts'
import {
  buildNativeEnemySteering,
  createNativeEnemyPathState,
  NATIVE_ENEMY_FLANK_SPEED_FACTOR,
  NATIVE_ENEMY_FLANK_TURN_FACTOR,
  NATIVE_ENEMY_PATH_FACTOR_DECAY,
  NATIVE_ENEMY_REORIENTATION_TICKS,
  nativeEnemyTargetRefreshTicks,
  selectNativeEnemyFlank,
  stepNativeEnemyPathRecovery,
  stepNativeEnemyReorientation,
  type NativeEnemyPathState,
} from './native-enemy-pathfinding.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  drawNativeSign,
  type NativeRngState,
} from './native-rng.ts'

const BASE_PATH: NativeEnemyPathState = Object.freeze({
  baseTurnRate: 1,
  flankAngleDeg: 0,
  flankRadius: 100,
  flankTicksRemaining: 0,
  reorientationTicksRemaining: 0,
  routePreviousVector: null,
  routeRefreshTicksRemaining: 0,
  routeTicksRemaining: 0,
  routeWaypointIndex: 0,
  routeWaypoints: null,
  speedFactor: 1,
  stalledMovementTicks: 0,
  turnFactor: 1,
  wanderHeadingDeg: 0,
})

test('constructs common steering state in exact draw order and maps all path modes', () => {
  const source = createNativeRng(71)
  const wander = drawNativeFloat(source, 360)
  const turn = drawNativeFloat(wander.state, Math.fround(0.5))
  const magnitude = drawNativeFloat(turn.state, 90)
  const angle = drawNativeSign(magnitude.state, magnitude.value)
  const radius = drawNativeFloat(angle.state, 100)
  const constructed = createNativeEnemyPathState(source)
  assert.deepEqual(constructed.rngState, radius.state)
  assert.deepEqual(constructed.state, {
    baseTurnRate: Math.fround(0.5 + turn.value),
    flankAngleDeg: angle.value,
    flankRadius: radius.value,
    flankTicksRemaining: 0,
    reorientationTicksRemaining: 0,
    routePreviousVector: null,
    routeRefreshTicksRemaining: 0,
    routeTicksRemaining: 0,
    routeWaypointIndex: 0,
    routeWaypoints: null,
    speedFactor: 1,
    stalledMovementTicks: 0,
    turnFactor: 1,
    wanderHeadingDeg: wander.value,
  })
  assert.deepEqual([0, 1, 2, 3].map((mode) => (
    nativeEnemyTargetRefreshTicks(mode as 0 | 1 | 2 | 3)
  )), [1_000, 300, 100, 10])
})

test('common target, active-flank, and targetless steering turn gradually', () => {
  const request = {
    actorHeadingDeg: 0,
    actorPosition: { x: 0, y: 0 },
    cadenceTicks: 2,
    movementPerTick: 0.25,
    radialDirection: 1 as const,
    statusFactor: 1,
    tangentDirection: 0 as const,
    targetHeadingDeg: 0,
    targetPosition: { x: 100, y: 0 },
  }
  const target = buildNativeEnemySteering(BASE_PATH, request)
  assert.equal(target.headingDeg, 2)
  assert.ok(target.delta.x > 0 && target.delta.x < 0.02)
  assert.ok(target.delta.y < -0.49)

  const flank = buildNativeEnemySteering({
    ...BASE_PATH,
    flankTicksRemaining: 2,
    turnFactor: NATIVE_ENEMY_FLANK_TURN_FACTOR,
  }, { ...request, targetHeadingDeg: 90 })
  assert.ok(Math.abs(flank.headingDeg - 2 * NATIVE_ENEMY_FLANK_TURN_FACTOR) < 1e-9)
  assert.equal(flank.state.flankTicksRemaining, 0)

  const wander = buildNativeEnemySteering(
    { ...BASE_PATH, wanderHeadingDeg: 90 },
    { ...request, targetPosition: null },
  )
  assert.equal(wander.headingDeg, 2)
  assert.ok(wander.delta.x > 0 && wander.delta.y < 0)
})

test('flank selection installs exact factors and inactive factors decay', () => {
  const source = createNativeRng(91)
  const wander = drawNativeFloat(source, 360)
  const duration = drawNativeInteger(wander.state, 201)
  const selected = selectNativeEnemyFlank(BASE_PATH, source, true)
  assert.deepEqual(selected.rngState, duration.state)
  assert.equal(selected.state.wanderHeadingDeg, wander.value)
  assert.equal(selected.state.flankTicksRemaining, 200 + duration.value)
  assert.equal(selected.state.speedFactor, NATIVE_ENEMY_FLANK_SPEED_FACTOR)
  assert.equal(selected.state.turnFactor, NATIVE_ENEMY_FLANK_TURN_FACTOR)

  const decayed = stepNativeEnemyPathRecovery({
    ...selected.state,
    flankTicksRemaining: 0,
    stalledMovementTicks: 7,
  }, selected.rngState, {
    flankingEnabled: true,
    requestedDistance: 1,
    statusFactor: 1,
    tick: 1,
    traveledDistance: 1,
  })
  assert.equal(decayed.state.stalledMovementTicks, 6)
  assert.equal(
    decayed.state.speedFactor,
    NATIVE_ENEMY_FLANK_SPEED_FACTOR * NATIVE_ENEMY_PATH_FACTOR_DECAY,
  )
  assert.equal(
    decayed.state.turnFactor,
    NATIVE_ENEMY_FLANK_TURN_FACTOR * NATIVE_ENEMY_PATH_FACTOR_DECAY,
  )
})

test('periodic and 25-stall recovery preserve their native winning rolls', () => {
  const periodic = stepNativeEnemyPathRecovery(BASE_PATH, rngForInteger(150, 23), {
    flankingEnabled: true,
    requestedDistance: 1,
    statusFactor: 1,
    tick: 20,
    traveledDistance: 1,
  })
  assert.ok(periodic.state.flankTicksRemaining >= 200)
  assert.ok(periodic.state.flankTicksRemaining <= 400)

  const state0dRng = rngForInteger(15, 3)
  const state0dBranch = drawNativeInteger(state0dRng, 15)
  const state0dDuration = drawNativeInteger(
    state0dBranch.state,
    NATIVE_ENEMY_REORIENTATION_TICKS.randomCount,
  )
  const state0d = stepNativeEnemyPathRecovery({
    ...BASE_PATH,
    stalledMovementTicks: 24,
  }, state0dRng, {
    flankingEnabled: true,
    requestedDistance: 1,
    statusFactor: 1,
    tick: 1,
    traveledDistance: 0,
  })
  assert.equal(state0d.triggeredState0D, true)
  assert.equal(state0d.state.stalledMovementTicks, 25)
  assert.equal(
    state0d.state.reorientationTicksRemaining,
    NATIVE_ENEMY_REORIENTATION_TICKS.minimum + state0dDuration.value,
  )
  assert.deepEqual(state0d.rngState, state0dDuration.state)
  const reoriented = stepNativeEnemyReorientation(
    state0d.state,
    0,
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  )
  assert.equal(reoriented.headingDeg, 90)
  assert.equal(
    reoriented.state.reorientationTicksRemaining,
    state0d.state.reorientationTicksRemaining - 1,
  )

  const reroute = stepNativeEnemyPathRecovery({
    ...BASE_PATH,
    stalledMovementTicks: 24,
  }, rngForInteger(15, 4), {
    flankingEnabled: true,
    requestedDistance: 1,
    statusFactor: 1,
    tick: 1,
    traveledDistance: 0,
  })
  assert.equal(reroute.triggeredState0D, false)
  assert.ok(reroute.state.flankTicksRemaining >= 200)
  assert.ok(reroute.state.flankTicksRemaining <= 400)
})

test('all eight wave families materialize immutable recovered defaults', () => {
  const expected = {
    COFFIN: [100, null, 1, 1, 200, 45, 0.75],
    DEMON: [400, 20, 1, 1, 800, 35, 0.75],
    IMP: [1, 3, 1, 1, 2, 8.75, 4.5],
    SKELETON: [5, 3, 1, 1, 10, 16, (1.25 + 0.5) * 1.25 ** 2],
    SKELETONARCHER: [5, 4, 1, 1, 10, 20, (1.25 + 0.5) * 1.25 ** 2 * 0.75],
    SKELETONMAGE: [5, 3, 0.8, 1, 10, 25, (1.25 + 0.5) * 1.25 ** 2 * 0.75 * 0.65],
    WRAITH: [2, 4, 1, 1, 4, 20, 1],
    ZOMBIE: [105, 35, 1, 1, 210, 21, 0.85],
  } satisfies Record<BoneyardWaveEnemyToken, readonly (number | null)[]>

  for (const enemyToken of Object.keys(expected) as BoneyardWaveEnemyToken[]) {
    const config = evaluateBoneyardEnemyConfig(enemyToken, {
      random: { baseSpeedUnit: 0.5, collisionRadiusUnit: 0.5 },
    })
    assert.deepEqual([
      config.maximumHealth,
      config.primaryDamage,
      config.chaseSpeed,
      config.attackSpeed,
      config.experience,
      config.collisionRadius,
      config.baseSpeed,
    ], expected[enemyToken])
    assert.equal(config.nativeTypeId, {
      COFFIN: 1013,
      DEMON: 1009,
      IMP: 1004,
      SKELETON: 1001,
      SKELETONARCHER: 1002,
      SKELETONMAGE: 1003,
      WRAITH: 1007,
      ZOMBIE: 1006,
    }[enemyToken])
    assert.equal(config.flanking, true)
    assert.equal(config.pathfindingMode, 1)
    assert.equal(Object.isFrozen(config), true)
    assert.equal(Object.isFrozen(config.family), true)
    assert.equal(Object.isFrozen(config.flags), true)
  }
})

test('Slumpgut materializes the authored boss Zombie instead of a flag approximation', () => {
  const recipe = nativeSlumpgutRecipe(
    '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f',
  )
  const config = evaluateBoneyardEnemyConfig('ZOMBIE', {
    authoredRecipe: recipe,
    flanking: false,
    pathfindingMode: 2,
    zombieBodyType: 1,
  })
  assert.equal(config.classification, 'boss')
  assert.equal(config.maximumHealth, 1_575)
  assert.equal(config.primaryDamage, 35)
  assert.equal(config.secondaryDamage, 10)
  assert.equal(config.tertiaryDamage, 15)
  assert.equal(config.extraDamage, 10)
  assert.equal(config.experience, 2_756.25)
  assert.equal(config.chaseSpeed, 1)
  assert.equal(config.attackSpeed, 1)
  assert.equal(config.scale, 1)
  assert.equal(config.flanking, false)
  assert.equal(config.pathfindingMode, 2)
  assert.equal(config.recipeName, 'Slumpgut')
  assert.equal(config.onDeathProgram, 'miniboss-die')
  assert.deepEqual(config.family, {
    bodyType: 3,
    poisonDuration: 10,
    poisonPoolDamage: 15,
    poisonPunchDamage: 10,
    rotten: true,
  })
})

test('common scalar flags apply in source order before Arena scalars', () => {
  const config = evaluateBoneyardEnemyConfig('SKELETON', {
    arenaScalars: {
      attackSpeed: 2,
      chaseSpeed: 3,
      experience: 0.5,
      health: 4,
      primaryDamage: 5,
    },
    flags: [
      'FLAG_WEAK',
      'FLAG_HPDOWN',
      'FLAG_XPBONUS',
      'FLAG_FAST',
      'FLAG_SLOW',
      'FLAG_BURNING',
    ],
  })
  assert.equal(config.maximumHealth, 10)
  assert.equal(config.primaryDamage, 7.5)
  assert.equal(config.experience, 10)
  assert.equal(config.chaseSpeed, 2.8125)
  assert.equal(config.attackSpeed, 1.5)
  assert.equal(config.burning, true)
})

test('Skeleton equipment flags preserve exact ordered HP and damage transforms', () => {
  const config = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_HELM', 'FLAG_SWORD', 'FLAG_ARMOR'],
  })
  assert.deepEqual(config.family, { armor: true, headgear: 1, weapon: 'sword' })
  assert.equal(config.maximumHealth, 104)
  assert.equal(config.primaryDamage, 18)

  const pike = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_HORNED', 'FLAG_PIKE'],
  })
  assert.deepEqual(pike.family, { armor: false, headgear: 2, weapon: 'pike' })
  assert.equal(pike.maximumHealth, 100)
  assert.equal(pike.primaryDamage, 28)
})

test('ARMORMAYBE applies recovered armor durability only when selected', () => {
  const armored = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_ARMORMAYBE'],
    random: { randomArmor: true },
  })
  if (armored.enemyToken !== 'SKELETON') throw new Error('expected Skeleton config')
  assert.equal(armored.family.armor, true)
  assert.equal(armored.maximumHealth, 30)

  const unarmored = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_ARMORMAYBE'],
    random: { randomArmor: false },
  })
  if (unarmored.enemyToken !== 'SKELETON') throw new Error('expected Skeleton config')
  assert.equal(unarmored.family.armor, false)
  assert.equal(unarmored.maximumHealth, 5)
})

test('Archer and Mage flags remain family-specific evaluated lanes', () => {
  const archer = evaluateBoneyardEnemyConfig('SKELETONARCHER', {
    archerExtraArrows: 3,
    archerMultiArrowMode: 2,
    flags: ['FLAG_RANDOMSHOT', 'FLAG_RANGEEASY', 'FLAG_POISONARROW'],
  })
  assert.deepEqual(archer.family, {
    accuracyMode: 3,
    arrowType: 'poison',
    extraArrows: 3,
    headgear: 0,
    multiArrowMode: 2,
    rangeMode: 3,
  })
  assert.equal(archer.secondaryDamage, 12)

  const mage = evaluateBoneyardEnemyConfig('SKELETONMAGE', {
    flags: [
      'FLAG_SHIELD',
      'FLAG_SHIELDOTHERS',
      'FLAG_SHIELDSTRONG',
      'FLAG_SHIELDFAST',
      'FLAG_CASTPOISON',
    ],
  })
  assert.deepEqual(mage.family, {
    cloak: false,
    element: 'poison',
    headgear: 0,
    otherShield: true,
    otherShieldHealth: 450,
    rangeMode: 0,
    selfShield: true,
    selfShieldHealth: 450,
    shieldInterval: 5,
  })
  assert.equal(mage.primaryDamage, 24)

  const cloakedMage = evaluateBoneyardEnemyConfig('SKELETONMAGE', {
    mageCloak: true,
  })
  if (cloakedMage.enemyToken !== 'SKELETONMAGE') throw new Error('expected Mage config')
  assert.equal(cloakedMage.family.cloak, true)
  assert.throws(
    () => evaluateBoneyardEnemyConfig('SKELETON', { mageCloak: true }),
    /only valid for SKELETONMAGE/,
  )
})

test('split, rotten, and Coffin child flags build their recovered payloads', () => {
  const imp = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLIT'],
    random: { splitUnit: 1 },
  })
  if (!('splitDepth' in imp.family)) throw new Error('expected Imp family config')
  assert.equal(imp.family.splitDepth, 2)

  const wave35Minimum = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLITMANY'],
    random: { splitManyGateUnit: 0, splitManyUnit: 0 },
    waveOrdinal: 35,
  })
  const wave35Maximum = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLITMANY'],
    random: { splitManyGateUnit: 1, splitManyUnit: 1 },
    waveOrdinal: 35,
  })
  const wave42Minimum = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLITMANY'],
    random: { splitManyGateUnit: 0, splitManyUnit: 0 },
    waveOrdinal: 42,
  })
  const wave42Maximum = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLITMANY'],
    random: { splitManyGateUnit: 1, splitManyUnit: 1 },
    waveOrdinal: 42,
  })
  if (!('splitDepth' in wave35Minimum.family)) throw new Error('expected Imp family config')
  if (!('splitDepth' in wave35Maximum.family)) throw new Error('expected Imp family config')
  if (!('splitDepth' in wave42Minimum.family)) throw new Error('expected Imp family config')
  if (!('splitDepth' in wave42Maximum.family)) throw new Error('expected Imp family config')
  assert.equal(wave35Minimum.family.splitDepth, 3)
  assert.equal(wave35Maximum.family.splitDepth, 5)
  assert.equal(wave42Minimum.family.splitDepth, 4)
  assert.equal(wave42Maximum.family.splitDepth, 6)

  const zombie = evaluateBoneyardEnemyConfig('ZOMBIE', {
    flags: ['FLAG_ROTTEN'],
  })
  assert.deepEqual(zombie.family, {
    bodyType: 0,
    poisonDuration: 10,
    poisonPoolDamage: 7,
    poisonPunchDamage: 35 / 6,
    rotten: true,
  })
  const bodyTypeZombie = evaluateBoneyardEnemyConfig('ZOMBIE', { zombieBodyType: 1 })
  if (bodyTypeZombie.enemyToken !== 'ZOMBIE') throw new Error('expected Zombie config')
  assert.equal(bodyTypeZombie.family.bodyType, 3)
  assert.throws(
    () => evaluateBoneyardEnemyConfig('COFFIN', { zombieBodyType: 1 }),
    /only valid for ZOMBIE/,
  )

  const coffin = evaluateBoneyardEnemyConfig('COFFIN', {
    flags: ['FLAG_MANYMAGGOTS', 'FLAG_STRONGMAGGOTS'],
  })
  assert.deepEqual(coffin.family, {
    maggotDamage: 5,
    maggotHealth: 5,
    maggotPoisonDamage: 0,
    maximumMaggots: 50,
  })
})

test('source-only flags remain inert and every active recovered flag is accepted', () => {
  const ignored = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_IGNITE', 'FLAG_IMMORTALIZE'],
  })
  assert.deepEqual(ignored.ignoredSourceFlags, ['FLAG_IGNITE', 'FLAG_IMMORTALIZE'])
  assert.equal(ignored.burning, false)

  for (const flag of BONEYARD_ENEMY_FLAGS) {
    if (flag === 'FLAG_NOSKELETONS' || flag === 'FLAG_MORESKELETONS') continue
    assert.doesNotThrow(() => evaluateBoneyardEnemyConfig(tokenForFlag(flag), {
      flags: [flag],
      random: { randomArmor: true, splitUnit: 1 },
      waveOrdinal: 12,
    }))
  }
  assert.throws(
    () => evaluateBoneyardEnemyConfig('SKELETON', { flags: ['FLAG_NOT_NATIVE'] }),
    /unknown Boneyard enemy flag/,
  )
})

test('dormant policy/payload lanes fail closed while custom multi-arrow count is bounded', () => {
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_NOSKELETONS'],
  }), /unsupported dormant skeleton policy none/)
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_MORESKELETONS'],
  }), /unsupported dormant skeleton policy more/)
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETONARCHER', {
    archerExtraArrows: 9,
  }), /extraArrows must be/)
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETON', {
    archerExtraArrows: 1,
  }), /only valid for SKELETONARCHER/)
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETON', {
    archerMultiArrowMode: 1,
  }), /only valid for SKELETONARCHER/)
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETON', {
    pathfindingMode: 4 as 0,
  }), /pathfinding mode/)
})

function tokenForFlag(flag: BoneyardEnemyFlag): BoneyardWaveEnemyToken {
  if (flag.includes('MAGGOT')) return 'COFFIN'
  if (flag.includes('CAST') || flag.includes('SHIELD')) return 'SKELETONMAGE'
  if (flag.includes('ARROW') || flag.includes('RANGE') || (
    flag === 'FLAG_LEADING'
    || flag === 'FLAG_SCATTERSHOT'
    || flag === 'FLAG_RANDOMSHOT'
  )) return 'SKELETONARCHER'
  if (flag === 'FLAG_ROTTEN') return 'ZOMBIE'
  if (flag.includes('SPLIT') || flag.includes('DEATHIMP')) return 'IMP'
  return 'SKELETON'
}

function rngForInteger(bound: number, expected: number): NativeRngState {
  for (let seed = 0; seed < 100_000; seed += 1) {
    const source = createNativeRng(seed)
    if (drawNativeInteger(source, bound).value === expected) return source
  }
  throw new Error(`could not find native RNG seed for ${expected}/${bound}`)
}
