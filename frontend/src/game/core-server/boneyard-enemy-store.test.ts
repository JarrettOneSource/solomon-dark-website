import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../core-kernels/actor-physics.ts'
import { actorHeadingFromVector } from '../core-kernels/actor-heading.ts'
import { NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM } from '../core-kernels/boneyard-zombie-beat.ts'
import {
  NATIVE_BADGUY_GAIT_PHASE_DIVISOR,
  NATIVE_BADGUY_GAIT_PHASE_PERIOD,
  NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
  NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
  NATIVE_SKELETON_HEAD_FACING_OFFSETS,
  NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT,
  NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER,
  advanceNativeEnemyLocomotionPhase,
  nativeSkeletonBodyGaitPose,
} from '../core-kernels/boneyard-skeleton-family-animation.ts'
import type { BoneyardWaveEnemyToken } from '../core-kernels/boneyard-wave-schema.ts'
import {
  nextBoneyardWaveRandom,
  randomBoneyardWaveInteger,
} from '../core-kernels/boneyard-wave-timeline.ts'
import {
  createNativeRng,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import { nativeSlumpgutRecipe } from '../core-kernels/native-survival-slumpgut.ts'
import {
  nativePortalChildPosition,
  nativePortalProgram,
  nativePortalRecipe,
} from '../core-kernels/native-survival-portal.ts'
import type {
  NativeSecondaryMovementModifierKind,
  NativeSecondaryTargetEffectPatch,
  NativeSecondaryTargetEffectState,
} from '../core-kernels/native-secondary-abilities.ts'
import { buildNativeEnemySteering } from '../core-kernels/native-enemy-pathfinding.ts'
import {
  BOUNDED_ENEMY_COLD_SLOW_TICKS,
  BOUNDED_ENEMY_POISON_DURATION_SECONDS,
  NATIVE_WRAITH_DAZZLE_TICKS,
} from '../core-kernels/boneyard-enemy-modifiers.ts'
import {
  NATIVE_MAGE_FACING_COUNT,
  NATIVE_MAGE_BODY_POSE_COUNT,
  nativeMageBodyAttachment,
  nativeMageBodyPose,
  nativeMageFacingBucket,
  nativeMageLightningDurationTicks,
} from '../core-kernels/boneyard-mage-lightning.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE,
  NATIVE_ARCHER_ACTION_PROGRAM,
  NATIVE_DEMON_BOMB_ACTION_PROGRAM,
  NATIVE_MAGE_ACTION_PROGRAMS,
  NATIVE_IMP_CONSTRUCTION_MAXIMUM,
  NATIVE_IMP_CONTACT_BASE_RADIUS,
  NATIVE_IMP_CONTACT_RADIUS_SCALE,
  NATIVE_IMP_SPLIT_CHILD_COUNT,
  NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM,
  NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK,
  NATIVE_DEMON_RAW_FIRE_BURST_TICKS,
  NATIVE_SKELETON_ACTION_PROGRAMS,
  NATIVE_SKELETON_CLAW_MARKERS,
  NATIVE_SKELETON_WEAPON_MARKERS,
  boneyardEnemyActorFlags,
  boneyardEnemyCollisionRadius,
  boneyardEnemyLiveCount,
  applyBoneyardStaffDisable,
  createBoneyardEnemyStore,
  damageBoneyardEnemy,
  emitBoneyardPlayerDamageSound,
  nativeWizardOuchCooldownReady,
  nativeSecondaryActorSpeedScale,
  positionBoneyardEnemy,
  setBoneyardEnemyHurricaneContactCooldown,
  stepBoneyardEnemyStore,
  type BoneyardEnemyActor,
  type BoneyardEnemyMovementRequest,
  type BoneyardEnemySpellSegmentRequest,
  type BoneyardEnemyStore,
  type BoneyardEnemyStoreStepResult,
  type BoneyardEnemyTargets,
} from './boneyard-enemy-store.ts'

const TOKENS = Object.keys(BONEYARD_WAVE_ENEMY_TYPES).filter((token) => (
  token !== 'PORTAL'
)) as Exclude<BoneyardWaveEnemyToken, 'PORTAL'>[]
const FAR_PLAYERS: BoneyardEnemyTargets = {
  player: {
    alive: true,
    collisionRadius: 25,
    connected: true,
    eligible: true,
    position: { x: 500, y: 0 },
    velocityPerTick: { x: 0, y: 0 },
  },
}
const DIRECT_MOVEMENT = (request: BoneyardEnemyMovementRequest) => request.requestedPosition
const NO_WORLD_CONTACT = () => null
const CLEAR_SPELL_SEGMENT = (request: BoneyardEnemySpellSegmentRequest) => request.end

test('native cell binding preserves same-cell order and appends cross-cell rebinds at the tail', () => {
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('cell-order', 10), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: {},
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [
      intent('SKELETON', 1, { x: 50, y: 50 }),
      intent('SKELETON', 2, { x: 75, y: 50 }),
    ],
    tick: 0,
  }).store
  assert.deepEqual(spawned.actors.map((actor) => ({
    cell: actor.nativeCellBindingOrder,
    registration: actor.nativeRegistrationOrder,
  })), [
    { cell: 10, registration: 10 },
    { cell: 11, registration: 11 },
  ])
  assert.equal(spawned.nextNativeCellBindingOrder, 12)
  assert.equal(spawned.nextNativeRegistrationOrder, 12)

  const sameCell = positionBoneyardEnemy(spawned, 2, { x: 90, y: 50 }).store
  assert.equal(sameCell.actors[1]!.nativeCellBindingOrder, 11)
  assert.equal(sameCell.nextNativeCellBindingOrder, 12)

  const crossed = positionBoneyardEnemy(sameCell, 1, { x: 110, y: 50 }).store
  assert.equal(crossed.actors[0]!.nativeCellBindingOrder, 12)
  assert.equal(crossed.actors[0]!.nativeRegistrationOrder, 10)
  const returned = positionBoneyardEnemy(crossed, 1, { x: 50, y: 50 }).store
  assert.equal(returned.actors[0]!.nativeCellBindingOrder, 13)
  assert.equal(returned.actors[1]!.nativeCellBindingOrder, 11)
  assert.equal(returned.nextNativeCellBindingOrder, 14)
  assert.equal(returned.nextNativeRegistrationOrder, 12)
})

test('a UIDGroup placement cache reuses only its first final root', () => {
  let placementCalls = 0
  const result = stepBoneyardEnemyStore(createBoneyardEnemyStore('placement-group'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [
      { ...intent('SKELETONARCHER', 1, { x: 10, y: 20 }), placementGroupId: 9 },
      { ...intent('SKELETONARCHER', 2, { x: 30, y: 40 }), placementGroupId: 9 },
      intent('SKELETONARCHER', 3, { x: 50, y: 60 }),
    ],
    resolveSpawnPlacement: ({ position, rngState }) => {
      placementCalls += 1
      return {
        position: { x: position.x + placementCalls * 100, y: position.y },
        rngState,
      }
    },
    tick: 0,
  })

  assert.equal(placementCalls, 2)
  assert.deepEqual(result.store.actors.map(({ position }) => position), [
    { x: 110, y: 20 },
    { x: 110, y: 20 },
    { x: 250, y: 60 },
  ])
})

test('a paused hostile tick materializes authored spawns without advancing existing enemy state', () => {
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('tutorial-pause'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [intent('SKELETON', 1, { x: 0, y: 0 })],
    tick: 0,
  })
  const existing = structuredClone(spawned.store.actors[0])
  const held = stepBoneyardEnemyStore(spawned.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    paused: true,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [intent('SKELETON', 2, { x: 50, y: 0 })],
    tick: 50,
  })
  assert.deepEqual(held.store.actors[0], existing)
  assert.equal(held.store.actors.length, 2)
  assert.equal(held.store.lastStepTick, 50)
  assert.deepEqual(held.events, [])
  assert.deepEqual(held.playerDamage, [])
  assert.deepEqual(held.playerKnockbacks, [])
  assert.deepEqual(held.rewards, [])
  assert.deepEqual(held.spawnedActorIds, [2])

  const heldAgain = stepBoneyardEnemyStore(held.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    paused: true,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 100,
  })
  assert.deepEqual(heldAgain.store, { ...held.store, lastStepTick: 100 })

  const released = stepBoneyardEnemyStore(heldAgain.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 101,
  })
  assert.notDeepEqual(released.store.actors, heldAgain.store.actors)
})

test('Badguy Hurricane cooldown is constructor-randomized, target-owned, and drops ten per tick', () => {
  const spawned = spawnOne('hurricane-cooldown', 'SKELETON', { x: 0, y: 0 }, FAR_PLAYERS)
  const initial = spawned.store.actors[0]!.hurricaneContactCooldown
  assert.ok(initial >= 0 && initial < 100)
  const armed = setBoneyardEnemyHurricaneContactCooldown(spawned.store, 1, 100)
  const oneTick = step(armed, 1, FAR_PLAYERS)
  assert.equal(oneTick.store.actors[0]!.hurricaneContactCooldown, 90)
  const threeTicks = step(oneTick.store, 3, FAR_PLAYERS)
  assert.equal(threeTicks.store.actors[0]!.hurricaneContactCooldown, 70)
})

test('Frozen timeScale fully stops enemies and exposes the exact thaw scalar', () => {
  const effect = {
    circleSlowFactor: 1,
    circleSlowTicks: 0,
    coldSlowFactor: 1,
    coldSlowMaterial: false,
    coldSlowTicks: 0,
    dazzleMaximumTicks: 0,
    dazzleTicks: 0,
    disruptedTicks: 0,
    electricBurn: null,
    fleeTicks: 0,
    frostBurnDamagePerTick: 0,
    frostBurnOwnerId: null,
    frostBurnSkillId: null,
    frostBurnSourceActorId: null,
    frostBurnTicks: 0,
    frozenTicks: 500,
    frozenTimeScale: 0,
    movementModifierOrder: ['frozen'],
    prismaticTicks: 0,
    stunFactor: 1,
    stunTicks: 0,
    steamed: null,
    targetId: 1,
    timeScale: 0,
    weakenFactor: 1,
    worldKey: 'boneyard:test',
  } as const
  assert.equal(nativeSecondaryActorSpeedScale(effect), 0)
  assert.equal(nativeSecondaryActorSpeedScale({
    ...effect,
    frozenTicks: 200,
    frozenTimeScale: Math.fround(0.005),
    timeScale: Math.fround(0.005),
  }), Math.fround(0.005))
})

test('temporary target scalars never rewrite authored config for any ordinary enemy family', () => {
  const effects = [
    ['cold-slow', { coldSlowFactor: 0.5, coldSlowTicks: 2 }],
    ['circle-slow', { circleSlowFactor: 0.5, circleSlowTicks: 2 }],
    ['frozen', { frozenTicks: 2, frozenTimeScale: 0 }],
    ['stun', { stunFactor: 0.5, stunTicks: 2 }],
    ['dazzle', { dazzleMaximumTicks: 100, dazzleTicks: 100 }],
    ['weaken', { weakenFactor: 0.5 }],
  ] as const satisfies readonly (readonly [string, NativeSecondaryTargetEffectPatch])[]

  for (const token of TOKENS) {
    for (const [effectName, patch] of effects) {
      const spawned = spawnOne(
        `temporary-${token}-${effectName}`,
        token,
        { x: 0, y: 0 },
        FAR_PLAYERS,
      )
      const actor = spawned.store.actors[0]!
      const effect = targetEffect(actor.id, patch)
      const first = stepWithEffects(spawned.store, 1, FAR_PLAYERS, {
        [actor.id]: effect,
      })
      assert.deepEqual(
        first.store.actors[0]!.config,
        actor.config,
        `${token}/${effectName} rewrote config on its first active tick`,
      )
      const second = stepWithEffects(first.store, 2, FAR_PLAYERS, {
        [actor.id]: effect,
      })
      assert.deepEqual(
        second.store.actors[0]!.config,
        actor.config,
        `${token}/${effectName} compounded config on a refreshed tick`,
      )
      const expired = stepWithEffects(second.store, 3, FAR_PLAYERS, {})
      assert.deepEqual(
        expired.store.actors[0]!.config,
        actor.config,
        `${token}/${effectName} did not restore after expiry`,
      )
    }
  }
})

test('Frost freeze and Lightning Stun alter only live action ticks and then restore full progress', () => {
  const near = { player: livingTarget(10, 0) }

  let frozen = spawnOne('frost-freeze-expiry', 'SKELETON', { x: 0, y: 0 }, near)
  frozen = step(frozen.store, 1, near)
  const frozenStart = skeletonActionProgress(frozen)
  const held = stepWithEffects(frozen.store, 2, near, {
    1: targetEffect(1, { frozenTicks: 1, frozenTimeScale: 0 }),
  })
  assert.equal(skeletonActionProgress(held), frozenStart)
  const thawed = stepWithEffects(held.store, 3, near, {})
  assert.ok(skeletonActionProgress(thawed) > frozenStart)

  let stunned = spawnOne('lightning-stun-expiry', 'SKELETON', { x: 0, y: 0 }, near)
  stunned = step(stunned.store, 1, near)
  const stunStart = skeletonActionProgress(stunned)
  const slowed = stepWithEffects(stunned.store, 2, near, {
    1: targetEffect(1, { stunFactor: 0.5, stunTicks: 1 }),
  })
  const slowedProgress = skeletonActionProgress(slowed) - stunStart
  const recovered = stepWithEffects(slowed.store, 3, near, {})
  const recoveredProgress = skeletonActionProgress(recovered)
    - skeletonActionProgress(slowed)
  assert.ok(Math.abs(recoveredProgress - slowedProgress * 2) < 1e-12)
})

test('Turn Undead weakening remains one fixed factor across repeated target ticks', () => {
  const near = { player: livingTarget(10, 0) }
  let result = spawnOne('turn-undead-weaken', 'SKELETON', { x: 0, y: 0 }, near)
  const authoredConfig = result.store.actors[0]!.config
  const damage: number[] = []
  for (let tick = 1; tick <= 60; tick += 1) {
    result = stepWithEffects(result.store, tick, near, {
      1: targetEffect(1, { weakenFactor: 0.5 }),
    })
    damage.push(...result.playerDamage.map(({ amount }) => amount))
  }
  assert.deepEqual(damage, [1.5, 1.5, 1.5])
  assert.deepEqual(result.store.actors[0]!.config, authoredConfig)
})

test('Wizard ouch consumes cue then inclusive cooldown draws on the active enemy RNG stream', () => {
  const source = createBoneyardEnemyStore('wizard-ouch')
  const cueDraw = randomBoneyardWaveInteger(source.rngState, 3)
  const cooldownDraw = randomBoneyardWaveInteger(cueDraw.state, 41)
  const sounds = ['wizard-ouch-1', 'wizard-ouch-2', 'wizard-ouch-3'] as const
  const emitted = emitBoneyardPlayerDamageSound(source, {
    actorId: 7,
    currentHealth: 35,
    playerId: 'wizard',
    position: { x: 120, y: 240 },
    tick: 101,
  })

  assert.deepEqual(emitted.event, {
    actorId: 7,
    eventId: 1,
    gainScale: 0.625,
    pitch: 1,
    sound: sounds[cueDraw.value],
    sourcePosition: { x: 120, y: 240 },
    targetPlayerId: 'wizard',
    tick: 101,
    type: 'player-damage-sound',
  })
  assert.equal(emitted.delayTicks, 20 + cooldownDraw.value)
  assert.equal(emitted.store.nextEventId, 2)
  assert.equal(emitted.store.rngState, cooldownDraw.state)
  assert.equal(source.nextEventId, 1)
  assert.equal(emitBoneyardPlayerDamageSound(source, {
    actorId: 7,
    currentHealth: 45,
    playerId: 'wizard',
    position: { x: 0, y: 0 },
    tick: 102,
  }).event.gainScale, 0.25)
  assert.equal(emitBoneyardPlayerDamageSound(source, {
    actorId: 7,
    currentHealth: 25,
    playerId: 'wizard',
    position: { x: 0, y: 0 },
    tick: 102,
  }).event.gainScale, 1)
  assert.equal(nativeWizardOuchCooldownReady(140, 140), false)
  assert.equal(nativeWizardOuchCooldownReady(141, 140), true)
})

test('materialization gives all eight families stable actor and event identities', () => {
  const lootSeedWrites: number[] = []
  const result = stepBoneyardEnemyStore(createBoneyardEnemyStore('families'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    rollLootSeed: () => {
      const seed = 1_000 + lootSeedWrites.length
      lootSeedWrites.push(seed)
      return seed
    },
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => TOKENS.map((token, index) => intent(
      token,
      index + 41,
      { x: index * 10, y: 0 },
      token === 'SKELETON' ? ['FLAG_FAST'] : [],
    )),
    tick: 0,
  })

  assert.deepEqual(result.spawnedActorIds, [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(result.store.actors.map((actor) => actor.sourceSpawnIntentId), [
    41, 42, 43, 44, 45, 46, 47, 48,
  ])
  assert.deepEqual(result.store.actors.map((actor) => actor.config.enemyToken), TOKENS)
  assert.deepEqual(lootSeedWrites, [1_000, 1_001, 1_002, 1_003, 1_004, 1_005, 1_006, 1_007])
  assert.deepEqual(result.store.actors.map(({ lootSeed }) => lootSeed), lootSeedWrites)
  assert.deepEqual(result.store.actors.map((actor) => actor.brain.family), [
    'coffin',
    'demon',
    'imp',
    'skeleton',
    'archer',
    'mage',
    'wraith',
    'zombie',
  ])
  assert.deepEqual(result.events.map((event) => event.eventId), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.ok(result.events.every((event) => event.type === 'enemy-spawned'))
  assert.equal(result.store.nextActorId, 9)
  assert.equal(result.store.nextEventId, 9)
  assert.equal(boneyardEnemyLiveCount(result.store), 8)
  const skeleton = result.store.actors.find((actor) => actor.config.enemyToken === 'SKELETON')
  assert.deepEqual(skeleton?.config.flags, ['FLAG_FAST'])
  assert.equal(Object.isFrozen(skeleton?.config.flags), true)
  assert.ok(result.store.actors.every((actor) => actor.lastDamageTick === null))
  assert.deepEqual(
    result.store.actors.map((actor) => actor.lighting),
    TOKENS.map(() => ({ charge: 0, glow: 0, providerCopies: 0 })),
  )
  assert.deepEqual(
    result.store.actors.map((actor) => actor.lightRegistration),
    [0, 1, 2, 3, 4, 5, 6, 7].map((registrationOrdinal) => ({
      managerLane: 'actor',
      registrationOrdinal,
    })),
  )
})

test('Skeleton, Archer, and Mage schedulers replace retained seeds in native order', () => {
  for (const [token, distance, phase, expectedWrites, expectedSeed] of [
    ['SKELETON', 10, 'attack', [100, 101], 101],
    ['SKELETONARCHER', 200, 'attack', [100], null],
    ['SKELETONMAGE', 150, 'cast', [100, 101, 102], 102],
  ] as const) {
    const writes: number[] = []
    const rollLootSeed = () => {
      const seed = 100 + writes.length
      writes.push(seed)
      return seed
    }
    const players = { player: livingTarget(distance, 0) }
    let result = stepBoneyardEnemyStore(createBoneyardEnemyStore(`loot-seed-${token}`), {
      clipSpellSegment: CLEAR_SPELL_SEGMENT,
      firstProjectileWorldContact: NO_WORLD_CONTACT,
      players,
      rollLootSeed,
      resolveMovement: DIRECT_MOVEMENT,
      resolveSpawnIntents: () => [intent(token, 1, { x: 0, y: 0 })],
      tick: 0,
    })
    assert.equal(result.store.actors[0]?.lootSeed, 100)
    result = stepBoneyardEnemyStore(result.store, {
      clipSpellSegment: CLEAR_SPELL_SEGMENT,
      firstProjectileWorldContact: NO_WORLD_CONTACT,
      players,
      rollLootSeed,
      resolveMovement: DIRECT_MOVEMENT,
      resolveSpawnIntents: () => [],
      tick: 1,
    })
    assert.equal(result.store.actors[0]?.brain.phase, phase)
    const actor = result.store.actors[0]!
    if (expectedSeed === null) {
      if (actor.brain.family !== 'archer') throw new Error('expected Archer brain')
      assert.equal(actor.lootSeed, actor.brain.aimSeed)
      assert.ok(actor.lootSeed >= 0 && actor.lootSeed < 1_000_000)
    } else {
      assert.equal(actor.lootSeed, expectedSeed)
    }
    assert.deepEqual(writes, expectedWrites)
  }
})

test('enemy fixed ticks own every native persistent-light writer, reset, and enrollment gate', () => {
  let skeleton = spawnOne(
    'light-skeleton',
    'SKELETON',
    { x: 0, y: 0 },
    FAR_PLAYERS,
    ['FLAG_BURNING'],
  )
  skeleton = step(skeleton.store, 1, FAR_PLAYERS)
  assert.deepEqual(skeleton.store.actors[0]!.lighting, {
    charge: 0,
    glow: 0.05,
    providerCopies: 1,
  })

  const normalArcher = step(
    spawnOne('light-archer-normal', 'SKELETONARCHER', { x: 0, y: 0 }, FAR_PLAYERS).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.deepEqual(normalArcher.lighting, {
    charge: 0.02,
    glow: 0,
    providerCopies: 0,
  })

  const fireArcher = step(
    spawnOne(
      'light-archer-fire',
      'SKELETONARCHER',
      { x: 0, y: 0 },
      FAR_PLAYERS,
      ['FLAG_POISONARROW', 'FLAG_FIREARROW'],
    ).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.deepEqual(fireArcher.lighting, {
    charge: 0.02,
    glow: 0,
    providerCopies: 1,
  })

  const poisonArcher = step(
    spawnOne(
      'light-archer-poison',
      'SKELETONARCHER',
      { x: 0, y: 0 },
      FAR_PLAYERS,
      ['FLAG_FIREARROW', 'FLAG_POISONARROW'],
    ).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.equal(poisonArcher.lighting.providerCopies, 0)

  const burningFireArcher = step(
    spawnOne(
      'light-archer-burning-fire',
      'SKELETONARCHER',
      { x: 0, y: 0 },
      FAR_PLAYERS,
      ['FLAG_BURNING', 'FLAG_FIREARROW'],
    ).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.deepEqual(burningFireArcher.lighting, {
    charge: 0.02,
    glow: 0.05,
    providerCopies: 2,
  })

  const ordinaryMage = step(
    spawnOne('light-mage', 'SKELETONMAGE', { x: 0, y: 0 }, FAR_PLAYERS).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.deepEqual(ordinaryMage.lighting, {
    charge: 0.02,
    glow: 0,
    providerCopies: 1,
  })

  const burningMage = step(
    spawnOne(
      'light-mage-burning',
      'SKELETONMAGE',
      { x: 0, y: 0 },
      FAR_PLAYERS,
      ['FLAG_BURNING'],
    ).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.deepEqual(burningMage.lighting, {
    charge: 0.02,
    glow: 0.1,
    providerCopies: 2,
  })

  for (const [flag, expectedCharge, expectedCopies] of [
    ['FLAG_CASTFIRE', 0, 0],
    ['FLAG_CASTLIGHTNING', 1, 1],
  ] as const) {
    let result = spawnOne(
      `light-mage-dispatch-${flag}`,
      'SKELETONMAGE',
      { x: 0, y: 0 },
      { player: livingTarget(150, 0) },
      [flag],
    )
    const actor = result.store.actors[0]!
    const brain = actor.brain
    if (brain.family !== 'mage') throw new Error('expected Mage brain')
    result = {
      ...result,
      store: {
        ...result.store,
        actors: [{
          ...actor,
          brain: {
            ...brain,
            actionProgress: NATIVE_MAGE_ACTION_PROGRAMS.short.markerProgress,
            castProgram: 'short',
            castRoll: 0,
            markerEmitted: false,
            phase: 'cast',
          },
          lighting: { charge: 0.8, glow: 0, providerCopies: 1 },
        }],
      },
    }
    result = step(result.store, 1, { player: livingTarget(150, 0) })
    assert.deepEqual(result.store.actors[0]!.lighting, {
      charge: expectedCharge,
      glow: 0,
      providerCopies: expectedCopies,
    })
  }

  const spawnedImp = spawnOne('light-imp', 'IMP', { x: 0, y: 0 }, FAR_PLAYERS)
  const imp = step({
    ...spawnedImp.store,
    actors: [{
      ...spawnedImp.store.actors[0]!,
      config: { ...spawnedImp.store.actors[0]!.config, scale: 0 },
    }],
  }, 1, FAR_PLAYERS).store.actors[0]!
  assert.deepEqual(imp.lighting, {
    charge: 0,
    glow: 0.01,
    providerCopies: 0,
  })

  const zombie = step(
    spawnOne('light-zombie', 'ZOMBIE', { x: 0, y: 0 }, FAR_PLAYERS).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.deepEqual(zombie.lighting, { charge: 0, glow: 0, providerCopies: 0 })

  const wraith = step(
    spawnOne(
      'light-wraith',
      'WRAITH',
      { x: 0, y: 0 },
      FAR_PLAYERS,
      ['FLAG_BURNING'],
    ).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.deepEqual(wraith.lighting, {
    charge: 0,
    glow: 0.05,
    providerCopies: 1,
  })

  const demon = step(
    spawnOne('light-demon', 'DEMON', { x: 0, y: 0 }, FAR_PLAYERS).store,
    1,
    FAR_PLAYERS,
  ).store.actors[0]!
  assert.deepEqual(demon.lighting, { charge: 0, glow: 0, providerCopies: 1 })

  let coffin = spawnOne('light-coffin', 'COFFIN', { x: 0, y: 0 }, FAR_PLAYERS)
  coffin = step(coffin.store, 1, FAR_PLAYERS)
  assert.equal(coffin.store.actors[0]!.lighting.providerCopies, 0)
  coffin = withCoffinRemaining(coffin, 1)
  coffin = step(coffin.store, 2, FAR_PLAYERS)
  assert.equal(coffin.store.actors[0]!.brain.phase, 'rising')
  assert.equal(coffin.store.actors[0]!.lighting.providerCopies, 1)
})

test('native hostile flags begin on the Coffin rising edge and end on death', () => {
  for (const token of TOKENS.filter((candidate) => candidate !== 'COFFIN')) {
    const actor = spawnOne(`actor-flags-${token}`, token, { x: 0, y: 0 }, FAR_PLAYERS)
      .store.actors[0]!
    assert.equal(boneyardEnemyActorFlags(actor), 0x2, token)
  }

  let coffin = spawnOne('actor-flags-coffin', 'COFFIN', { x: 0, y: 0 }, FAR_PLAYERS)
  assert.equal(boneyardEnemyActorFlags(coffin.store.actors[0]!), 0)
  coffin = withCoffinRemaining(coffin, 1)
  coffin = step(coffin.store, 1, FAR_PLAYERS)
  const risen = coffin.store.actors[0]!
  assert.equal(risen.brain.family, 'coffin')
  if (risen.brain.family !== 'coffin') throw new Error('expected Coffin brain')
  assert.equal(risen.brain.phase, 'rising')
  assert.equal(boneyardEnemyActorFlags(risen), 0x2)
  for (const phase of ['holding', 'opening', 'open'] as const) {
    assert.equal(boneyardEnemyActorFlags({
      ...risen,
      brain: { ...risen.brain, phase },
    }), 0x2, phase)
  }

  const killed = damageBoneyardEnemy(coffin.store, {
    actorId: risen.id,
    amount: risen.currentHealth,
    sourcePlayerId: 'player',
    tick: 1,
  })
  assert.equal(killed.killed, true)
  assert.equal(boneyardEnemyActorFlags(killed.store.actors[0]!), 0)
})

test('Mage lighting reads the pre-action pose and only exact native pose four pauses charge', () => {
  const spawned = spawnOne(
    'light-mage-pose-order',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    { player: livingTarget(150, 0) },
  )
  const source = spawned.store.actors[0]!
  if (source.brain.family !== 'mage') throw new Error('expected Mage brain')

  const enteringPoseFour = step({
    ...spawned.store,
    actors: [{
      ...source,
      bodyPose: 3,
      brain: {
        ...source.brain,
        actionProgress: 24.8,
        castProgram: 'short',
        castRoll: 0,
        markerEmitted: true,
        phase: 'cast',
      },
      lighting: { charge: 0.3, glow: 0, providerCopies: 1 },
    }],
  }, 1, { player: livingTarget(150, 0) }).store.actors[0]!
  assert.ok(enteringPoseFour.brain.family === 'mage')
  assert.equal(Math.floor(enteringPoseFour.brain.actionProgress), 25)
  assert.equal(enteringPoseFour.lighting.charge, 0.32)

  const leavingPoseFour = step({
    ...spawned.store,
    actors: [{
      ...source,
      bodyPose: 4,
      brain: {
        ...source.brain,
        actionProgress: 37.8,
        castProgram: 'short',
        castRoll: 0,
        markerEmitted: true,
        phase: 'cast',
      },
      lighting: { charge: 0.3, glow: 0, providerCopies: 1 },
    }],
  }, 1, { player: livingTarget(150, 0) }).store.actors[0]!
  assert.ok(leavingPoseFour.brain.family === 'mage')
  assert.equal(Math.floor(leavingPoseFour.brain.actionProgress), 38)
  assert.equal(leavingPoseFour.lighting.charge, 0.3)

  const nonCastPoseFour = step({
    ...spawned.store,
    actors: [{
      ...source,
      bodyPose: 4,
      gaitPose: 5,
      lighting: { charge: 0.3, glow: 0, providerCopies: 1 },
    }],
  }, 1, { player: livingTarget(150, 0) }).store.actors[0]!
  assert.equal(nonCastPoseFour.lighting.charge, 0.3)

  const gaitPoseFour = step({
    ...spawned.store,
    actors: [{
      ...source,
      bodyPose: 3,
      gaitPose: 4,
      lighting: { charge: 0.3, glow: 0, providerCopies: 1 },
    }],
  }, 1, { player: livingTarget(150, 0) }).store.actors[0]!
  assert.equal(gaitPoseFour.lighting.charge, 0.32)

  const lightningSpawned = spawnOne(
    'light-mage-cold-lightning-dispatch',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    { player: livingTarget(150, 0) },
    ['FLAG_CASTLIGHTNING'],
  )
  const lightningSource = lightningSpawned.store.actors[0]!
  if (lightningSource.brain.family !== 'mage') throw new Error('expected Mage brain')
  const dispatched = step({
    ...lightningSpawned.store,
    actors: [{
      ...lightningSource,
      bodyPose: 4,
      brain: {
        ...lightningSource.brain,
        actionProgress: NATIVE_MAGE_ACTION_PROGRAMS.short.markerProgress,
        castProgram: 'short',
        castRoll: 0,
        markerEmitted: false,
        phase: 'cast',
      },
    }],
  }, 1, { player: livingTarget(150, 0) })
  assert.deepEqual(dispatched.store.actors[0]!.lighting, {
    charge: 1,
    glow: 0,
    providerCopies: 0,
  })
  assert.deepEqual(
    step(dispatched.store, 2, { player: livingTarget(150, 0) })
      .store.actors[0]!.lighting,
    { charge: 1, glow: 0, providerCopies: 1 },
  )
})

test('native zero-speed gates preserve each family recurrence and enrollment rule', () => {
  for (const [token, flags, expected] of [
    ['SKELETON', ['FLAG_BURNING'], { charge: 0.3, glow: 0.4, providerCopies: 0 }],
    [
      'SKELETONARCHER',
      ['FLAG_BURNING', 'FLAG_FIREARROW'],
      { charge: 0.3, glow: 0.4, providerCopies: 0 },
    ],
    [
      'SKELETONMAGE',
      ['FLAG_BURNING'],
      { charge: 0.3, glow: 0.4, providerCopies: 0 },
    ],
    ['IMP', [], { charge: 0.3, glow: 0.4 + 0.01, providerCopies: 0 }],
    [
      'WRAITH',
      ['FLAG_BURNING'],
      { charge: 0.3, glow: 0.4 + 0.05, providerCopies: 1 },
    ],
    ['DEMON', [], { charge: 0.3, glow: 0.4, providerCopies: 1 }],
  ] as const) {
    const spawned = spawnOne(
      `light-zero-speed-${token}`,
      token,
      { x: 0, y: 0 },
      FAR_PLAYERS,
      flags,
    )
    const actor = spawned.store.actors[0]!
    const result = step({
      ...spawned.store,
      actors: [{
        ...actor,
        config: { ...actor.config, scale: 0 },
        lighting: { charge: 0.3, glow: 0.4, providerCopies: 2 },
      }],
    }, 1, FAR_PLAYERS)
    assert.deepEqual(result.store.actors[0]!.lighting, expected, token)
  }
})

test('Archer death pose clears charge and every enrolled provider copy', () => {
  const kill = (store: BoneyardEnemyStore): BoneyardEnemyActor => {
    const actor = store.actors[0]!
    const damaged = damageBoneyardEnemy(store, {
      actorId: actor.id,
      amount: actor.currentHealth + actor.shieldHealth + 1,
      sourcePlayerId: 'player',
      tick: 1,
    })
    assert.equal(damaged.killed, true)
    return damaged.store.actors[0]!
  }

  const fire = step(
    spawnOne(
      'light-archer-death-fire',
      'SKELETONARCHER',
      { x: 0, y: 0 },
      FAR_PLAYERS,
      ['FLAG_FIREARROW'],
    ).store,
    1,
    FAR_PLAYERS,
  )
  assert.deepEqual(kill(fire.store).lighting, {
    charge: 0,
    glow: 0,
    providerCopies: 0,
  })

  const burningFire = step(
    spawnOne(
      'light-archer-death-burning-fire',
      'SKELETONARCHER',
      { x: 0, y: 0 },
      FAR_PLAYERS,
      ['FLAG_BURNING', 'FLAG_FIREARROW'],
    ).store,
    1,
    FAR_PLAYERS,
  )
  assert.deepEqual(kill(burningFire.store).lighting, {
    charge: 0,
    glow: 0.05,
    providerCopies: 0,
  })
})

test('target selection is nearest, insertion-stable, cadence-bound, and rejects dead peers', () => {
  const tiedPlayers: BoneyardEnemyTargets = {
    zulu: livingTarget(10, 0),
    alpha: livingTarget(-10, 0),
    dead: { ...livingTarget(1, 0), alive: false },
    disconnected: { ...livingTarget(2, 0), connected: false },
    spectator: { ...livingTarget(3, 0), eligible: false },
  }
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('targets'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: tiedPlayers,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [intent('SKELETON', 1, { x: 0, y: 0 })],
    tick: 0,
  })
  assert.equal(result.store.actors[0]!.targetPlayerId, 'zulu')

  result = stepBoneyardEnemyStore(result.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: {
      ...tiedPlayers,
      alpha: { ...tiedPlayers.alpha!, alive: false },
    },
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 1,
  })
  assert.equal(result.store.actors[0]!.targetPlayerId, 'zulu')

  result = stepBoneyardEnemyStore(result.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: {
      alpha: livingTarget(100, 0),
      nearer: livingTarget(5, 0),
      zulu: livingTarget(10, 0),
    },
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 300,
  })
  assert.equal(result.store.actors[0]!.targetPlayerId, 'nearer')
})

test('every mobile retail family wanders through common steering without a target', () => {
  for (const token of TOKENS.filter((candidate) => candidate !== 'COFFIN')) {
    let result = spawnOne(`targetless-${token}`, token, { x: 0, y: 0 }, {})
    const initial = result.store.actors[0]!
    result = step(result.store, 2, {})
    const actor = result.store.actors[0]!
    assert.equal(actor.targetPlayerId, null)
    assert.notDeepEqual(actor.position, initial.position, `${token} must wander targetless`)
  }
})

test('stalled state-0D reorientation faces the target while suspending locomotion', () => {
  const spawned = spawnOne('state-0d-reorientation', 'SKELETON', { x: 0, y: 0 }, FAR_PLAYERS)
  const source = spawned.store.actors[0]!
  let store: BoneyardEnemyStore = {
    ...spawned.store,
    actors: [{
      ...source,
      headingDeg: 0,
      path: { ...source.path, reorientationTicksRemaining: 2 },
    }],
  }
  let result = step(store, 1, FAR_PLAYERS)
  assert.deepEqual(result.store.actors[0]!.position, source.position)
  assert.equal(result.store.actors[0]!.headingDeg, 90)
  assert.equal(result.store.actors[0]!.path.reorientationTicksRemaining, 1)

  result = step(result.store, 2, FAR_PLAYERS)
  assert.deepEqual(result.store.actors[0]!.position, source.position)
  assert.equal(result.store.actors[0]!.path.reorientationTicksRemaining, 0)

  result = step(result.store, 3, FAR_PLAYERS)
  assert.ok(result.store.actors[0]!.position.x > source.position.x)
})

test('two-tick movement sends the recovered delta and radius through collision authority', () => {
  const requests: BoneyardEnemyMovementRequest[] = []
  let result = spawnOne('movement', 'SKELETON', { x: 0, y: 0 }, FAR_PLAYERS)
  const actor = result.store.actors[0]!
  result = stepBoneyardEnemyStore(result.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: (request) => {
      requests.push(request)
      return { x: request.position.x + request.delta.x / 2, y: request.position.y }
    },
    resolveSpawnIntents: () => [],
    tick: 1,
  })
  assert.equal(requests.length, 0)
  result = stepBoneyardEnemyStore(result.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: (request) => {
      requests.push(request)
      return { x: request.position.x + request.delta.x / 2, y: request.position.y }
    },
    resolveSpawnIntents: () => [],
    tick: 2,
  })

  const movementScalar = Math.fround(
    actor.config.chaseSpeed
      * actor.config.baseSpeed
      * actor.config.scale
      * actor.path.speedFactor,
  )
  const expected = buildNativeEnemySteering(actor.path, {
    actorHeadingDeg: actor.headingDeg,
    actorPosition: actor.position,
    cadenceTicks: 2,
    movementPerTick: 0.25 * movementScalar,
    radialDirection: 1,
    statusFactor: 1,
    tangentDirection: 0,
    targetHeadingDeg: 0,
    targetPosition: FAR_PLAYERS.player!.position,
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0]!.actorId, actor.id)
  assert.deepEqual(requests[0]!.delta, expected.delta)
  assert.equal(requests[0]!.radius, actor.config.collisionRadius)
  assert.equal(result.store.actors[0]!.position.x, expected.delta.x / 2)
  assert.equal(
    result.store.actors[0]!.gaitPose,
    advanceNativeEnemyLocomotionPhase(
      actor.gaitPose,
      movementScalar,
      2,
      NATIVE_BADGUY_GAIT_PHASE_DIVISOR,
      NATIVE_BADGUY_GAIT_PHASE_PERIOD,
    ),
  )
  const expectedBodyPhase = advanceNativeEnemyLocomotionPhase(
    actor.bodyGaitPhase,
    movementScalar,
    2,
    NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
    NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
  )
  assert.equal(result.store.actors[0]!.bodyGaitPhase, expectedBodyPhase)
  assert.equal(result.store.actors[0]!.bodyPose, nativeSkeletonBodyGaitPose(expectedBodyPhase))
  assert.equal(result.store.actors[0]!.lastMovementTick, 2)
  assert.equal(result.store.actors[0]!.nextMovementTick, 4)
})

test('blocked requested movement still advances Skeleton limb and upper-body locomotion', () => {
  let result = spawnOne('blocked-skeleton-walk', 'SKELETON', { x: 0, y: 0 }, FAR_PLAYERS)
  const gaitPoses = new Set<number>()
  const bodyPoses = new Set<number>()
  let movementRequests = 0

  for (let tick = 1; tick <= 180; tick += 1) {
    result = stepBoneyardEnemyStore(result.store, {
      firstProjectileWorldContact: NO_WORLD_CONTACT,
      players: FAR_PLAYERS,
      resolveMovement: (request) => {
        movementRequests += 1
        return request.position
      },
      resolveSpawnIntents: () => [],
      tick,
    })
    gaitPoses.add(Math.floor(result.store.actors[0]!.gaitPose))
    bodyPoses.add(Math.floor(result.store.actors[0]!.bodyPose))
  }

  assert.ok(movementRequests > 0)
  assert.deepEqual(result.store.actors[0]!.position, { x: 0, y: 0 })
  assert.equal(result.store.actors[0]!.lastMovementTick, null)
  assert.ok(gaitPoses.size > 1, JSON.stringify([...gaitPoses]))
  assert.deepEqual([...bodyPoses].sort((left, right) => left - right), [0, 1, 2])
})

test('every mobile survival family enters the shared blocked-goal route owner', () => {
  for (const token of [
    'SKELETON',
    'SKELETONARCHER',
    'SKELETONMAGE',
    'IMP',
    'ZOMBIE',
    'DEMON',
  ] as const) {
    const players = { player: livingTarget(1_000, 0) }
    const spawned = spawnOne(`shared-route-${token}`, token, { x: 0, y: 0 }, players)
    const clearances: number[] = []
    const result = stepBoneyardEnemyStore(spawned.store, {
      clipSpellSegment: CLEAR_SPELL_SEGMENT,
      firstProjectileWorldContact: NO_WORLD_CONTACT,
      navigation: {
        findRoute: ({ end, navigationClearance, start }) => {
          clearances.push(navigationClearance)
          return [
            { ...start },
            { x: 0, y: 100 },
            { x: 100, y: 100 },
            { ...end },
          ]
        },
        isPathClear: () => false,
      },
      players,
      resolveMovement: DIRECT_MOVEMENT,
      resolveSpawnIntents: () => [],
      tick: 2,
    })
    assert.deepEqual(clearances, [token === 'DEMON' ? 50 : 25], token)
    assert.deepEqual(result.store.actors[0]!.path.routeWaypoints, [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ], token)
  }
})

test('Wraith special flight bypasses inherited route and collision owners', () => {
  const players = { player: livingTarget(1_000, 0) }
  const spawned = spawnOne('wraith-special-route', 'WRAITH', { x: 0, y: 0 }, players)
  const result = stepBoneyardEnemyStore(spawned.store, {
    clipSpellSegment: CLEAR_SPELL_SEGMENT,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    navigation: {
      findRoute: () => assert.fail('Wraith special vector does not call NavMesh'),
      isPathClear: () => assert.fail('Wraith special vector does not call route LOS'),
    },
    players,
    resolveMovement: () => assert.fail('Wraith special vector bypasses movement collision'),
    resolveSpawnIntents: () => [],
    tick: 2,
  })
  assert.notDeepEqual(result.store.actors[0]!.position, { x: 0, y: 0 })
  assert.equal(result.store.actors[0]!.config.collisionRadius, 15)
  assert.equal(result.store.actors[0]!.path.routeWaypoints, null)
})

test('stationary Coffin does not invoke its inherited route slot', () => {
  const players = { player: livingTarget(1_000, 0) }
  const spawned = spawnOne('stationary-coffin-route', 'COFFIN', { x: 0, y: 0 }, players)
  const result = stepBoneyardEnemyStore(spawned.store, {
    clipSpellSegment: CLEAR_SPELL_SEGMENT,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    navigation: {
      findRoute: () => assert.fail('Coffin has no live locomotion caller'),
      isPathClear: () => assert.fail('Coffin has no live locomotion caller'),
    },
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 2,
  })
  assert.deepEqual(result.store.actors[0]!.position, { x: 0, y: 0 })
})

test('Skeleton-family wrappers retain or replace the common body gait exactly', () => {
  const cases = [
    { body: 'gait', flags: [], seed: 'bare-skeleton-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_SWORD'], seed: 'sword-skeleton-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_MACE'], seed: 'mace-skeleton-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_FLAIL'], seed: 'flail-skeleton-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_AXE'], seed: 'axe-skeleton-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_PIKE'], seed: 'pike-skeleton-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_ARMOR'], seed: 'armored-skeleton-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_ARMOR', 'FLAG_SWORD'], seed: 'armored-sword-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_ARMOR', 'FLAG_MACE'], seed: 'armored-mace-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_ARMOR', 'FLAG_FLAIL'], seed: 'armored-flail-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_ARMOR', 'FLAG_AXE'], seed: 'armored-axe-gait', token: 'SKELETON' },
    { body: 'zero', flags: ['FLAG_ARMOR', 'FLAG_PIKE'], seed: 'armored-pike-gait', token: 'SKELETON' },
    { body: 'gait', flags: [], seed: 'archer-gait', token: 'SKELETONARCHER' },
    { body: 'rest', flags: [], seed: 'mage-gait', token: 'SKELETONMAGE' },
    { body: 'unchanged', flags: [], seed: 'zombie-shared-gait', token: 'ZOMBIE' },
  ] as const

  for (const entry of cases) {
    let result = spawnOne(entry.seed, entry.token, { x: 0, y: 0 }, FAR_PLAYERS, entry.flags)
    const before = result.store.actors[0]!
    result = step(result.store, 1, FAR_PLAYERS)
    result = step(result.store, 2, FAR_PLAYERS)
    const after = result.store.actors[0]!
    const movementScalar = Math.fround(
      before.config.chaseSpeed * before.config.baseSpeed * before.config.scale,
    )
    const expectedGait = advanceNativeEnemyLocomotionPhase(
      before.gaitPose,
      movementScalar,
      2,
      NATIVE_BADGUY_GAIT_PHASE_DIVISOR,
      NATIVE_BADGUY_GAIT_PHASE_PERIOD,
    )
    const expectedBodyPhase = advanceNativeEnemyLocomotionPhase(
      before.bodyGaitPhase,
      movementScalar,
      2,
      NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
      NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
    )
    assert.equal(after.gaitPose, expectedGait, entry.seed)
    assert.equal(after.bodyGaitPhase, expectedBodyPhase, entry.seed)
    switch (entry.body) {
      case 'gait':
        assert.equal(after.bodyPose, nativeSkeletonBodyGaitPose(expectedBodyPhase), entry.seed)
        break
      case 'zero':
        assert.equal(after.bodyPose, 0, entry.seed)
        break
      case 'rest':
        assert.ok(before.restBodyPose === 0 || before.restBodyPose === 1, entry.seed)
        assert.equal(after.bodyPose, before.restBodyPose, entry.seed)
        break
      case 'unchanged':
        assert.equal(after.bodyPose, before.bodyPose, entry.seed)
        break
    }
  }
})

test('Skeleton hit latch pauses both locomotion phases until its strict end', () => {
  const spawned = spawnOne('skeleton-hit-pauses-gait', 'SKELETON', { x: 0, y: 0 }, FAR_PLAYERS)
  const before = spawned.store.actors[0]!
  let result = {
    ...spawned,
    store: damageBoneyardEnemy(spawned.store, {
      actorId: before.id,
      amount: 1,
      sourcePlayerId: 'player',
      tick: 0,
    }).store,
  }

  for (let tick = 1; tick < 20; tick += 1) result = step(result.store, tick, FAR_PLAYERS)
  const paused = result.store.actors[0]!
  assert.deepEqual(paused.position, before.position)
  assert.equal(paused.gaitPose, before.gaitPose)
  assert.equal(paused.bodyGaitPhase, before.bodyGaitPhase)

  result = step(result.store, 20, FAR_PLAYERS)
  const resumed = result.store.actors[0]!
  assert.notDeepEqual(resumed.position, before.position)
  assert.notEqual(resumed.gaitPose, before.gaitPose)
  assert.notEqual(resumed.bodyGaitPhase, before.bodyGaitPhase)
})

test('Skeleton and Mage own the native head turn while Archer remains constructor-zero', () => {
  const winningState = skeletonHeadTurnState(0)
  const winningGate = drawNativeInteger(
    winningState,
    NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT,
  )
  const winningOffset = drawNativeInteger(
    winningGate.state,
    NATIVE_SKELETON_HEAD_FACING_OFFSETS.length,
  )

  const contactPlayers = { player: livingTarget(10, 0) }
  let skeleton = spawnOne(
    'skeleton-head-turn',
    'SKELETON',
    { x: 0, y: 0 },
    contactPlayers,
  )
  skeleton = step({
    ...skeleton.store,
    headFacingRngState: winningState,
  }, 1, contactPlayers)
  assert.equal(skeleton.store.actors[0]!.brain.phase, 'attack')
  assert.equal(skeleton.store.actors[0]!.headFacingOffset, -1)
  assert.deepEqual(skeleton.store.headFacingRngState, winningOffset.state)

  const activeSkeleton = skeleton.store.actors[0]!
  const activeSkeletonBrain = activeSkeleton.brain
  if (activeSkeletonBrain.family !== 'skeleton') throw new Error('expected Skeleton brain')
  skeleton = step({
    ...skeleton.store,
    actors: [{
      ...activeSkeleton,
      brain: {
        ...activeSkeletonBrain,
        actionProgress: 0,
        contactTargetPlayerId: null,
        phase: 'approach',
      },
    }],
    headFacingRngState: nonWinningSkeletonHeadTurnState(),
  }, 2, FAR_PLAYERS)
  assert.equal(skeleton.store.actors[0]!.headFacingOffset, 0)

  const rangedPlayers = { player: livingTarget(150, 0) }
  let mage = spawnOne(
    'mage-head-turn',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    rangedPlayers,
  )
  mage = step({
    ...mage.store,
    headFacingRngState: winningState,
  }, 1, rangedPlayers)
  assert.equal(mage.store.actors[0]!.brain.phase, 'cast')
  assert.equal(mage.store.actors[0]!.headFacingOffset, 0)
  assert.deepEqual(mage.store.headFacingRngState, winningOffset.state)
  mage = step({
    ...mage.store,
    headFacingRngState: winningState,
  }, 2, rangedPlayers)
  assert.equal(mage.store.actors[0]!.headFacingOffset, -1)

  let archer = spawnOne(
    'archer-static-head',
    'SKELETONARCHER',
    { x: 0, y: 0 },
    rangedPlayers,
  )
  archer = step({
    ...archer.store,
    headFacingRngState: winningState,
  }, 1, rangedPlayers)
  assert.equal(archer.store.actors[0]!.brain.phase, 'attack')
  assert.equal(archer.store.actors[0]!.headFacingOffset, 0)
  assert.deepEqual(archer.store.headFacingRngState, winningState)
})

test('lethal handoff clears active Skeleton and Mage head-facing before projection', () => {
  const winningState = skeletonHeadTurnState(0)
  const skeletonPlayers = { player: livingTarget(10, 0) }
  let skeleton = spawnOne(
    'skeleton-lethal-head-handoff',
    'SKELETON',
    { x: 0, y: 0 },
    skeletonPlayers,
  )
  skeleton = step({
    ...skeleton.store,
    headFacingRngState: winningState,
  }, 1, skeletonPlayers)
  const activeSkeleton = skeleton.store.actors[0]!
  assert.equal(activeSkeleton.headFacingOffset, -1)
  const killedSkeleton = damageBoneyardEnemy(skeleton.store, {
    actorId: activeSkeleton.id,
    amount: activeSkeleton.currentHealth,
    sourcePlayerId: 'player',
    tick: 1,
  })
  assert.equal(killedSkeleton.store.actors[0]!.lifeState, 'dying')
  assert.equal(killedSkeleton.store.actors[0]!.headFacingOffset, 0)

  const magePlayers = { player: livingTarget(150, 0) }
  let mage = spawnOne(
    'mage-lethal-head-handoff',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    magePlayers,
  )
  mage = step({ ...mage.store, headFacingRngState: winningState }, 1, magePlayers)
  mage = step({ ...mage.store, headFacingRngState: winningState }, 2, magePlayers)
  const activeMage = mage.store.actors[0]!
  assert.equal(activeMage.headFacingOffset, -1)
  const killedMage = damageBoneyardEnemy(mage.store, {
    actorId: activeMage.id,
    amount: activeMage.currentHealth,
    sourcePlayerId: 'player',
    tick: 2,
  })
  assert.equal(killedMage.store.actors[0]!.lifeState, 'dying')
  assert.equal(killedMage.store.actors[0]!.headFacingOffset, 0)
})

test('Skeleton claw, weapon, and Pike preserve exact marker and strict-end ticks', () => {
  assert.deepEqual(NATIVE_SKELETON_ACTION_PROGRAMS, {
    claw: { markerProgress: 4, progressPerTick: 0.125, strictEnd: 7 },
    pike: { markerProgress: 2, progressPerTick: 0.125, strictEnd: 12 },
    weapon: { markerProgress: 9, progressPerTick: 0.25, strictEnd: 24 },
  })
  assert.deepEqual(NATIVE_SKELETON_CLAW_MARKERS, [4, 8])
  assert.deepEqual(NATIVE_SKELETON_WEAPON_MARKERS, [9, 20])
  verifySkeletonProgram([], 'claw', [32, 33, 57], 57)
  verifySkeletonProgram(['FLAG_SWORD'], 'weapon', [36, 80], 97)
  verifySkeletonProgram(['FLAG_PIKE'], 'pike', [16], 97)
})

test('Skeleton action poses take priority and locomotion body gait resumes afterward', () => {
  const near = { player: livingTarget(10, 0) }
  let result = spawnOne('skeleton-action-gait-resume', 'SKELETON', { x: 0, y: 0 }, near)
  const initial = result.store.actors[0]!
  result = step(result.store, 1, near)
  assert.equal(result.store.actors[0]!.brain.phase, 'attack')
  assert.equal(result.store.actors[0]!.bodyPose, 4)

  let tick = 2
  for (; tick <= 60 && result.store.actors[0]!.brain.phase === 'attack'; tick += 1) {
    result = step(result.store, tick, near)
  }
  const completed = result.store.actors[0]!
  assert.equal(completed.brain.phase, 'approach')
  assert.equal(completed.gaitPose, initial.gaitPose)
  assert.equal(completed.bodyGaitPhase, initial.bodyGaitPhase)
  assert.equal(completed.bodyPose, 4)

  result = step(result.store, tick, FAR_PLAYERS)
  const resumed = result.store.actors[0]!
  const movementScalar = Math.fround(
    completed.config.chaseSpeed * completed.config.baseSpeed * completed.config.scale,
  )
  const expectedBodyPhase = advanceNativeEnemyLocomotionPhase(
    completed.bodyGaitPhase,
    movementScalar,
    2,
    NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
    NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
  )
  assert.equal(resumed.bodyGaitPhase, expectedBodyPhase)
  assert.equal(resumed.bodyPose, nativeSkeletonBodyGaitPose(expectedBodyPhase))
  assert.notEqual(resumed.gaitPose, completed.gaitPose)
})

test('armor selects the native claw body table and retains its wrapped first pose', () => {
  const players = { player: livingTarget(10, 0) }
  let result = spawnOne(
    'armored-claw-body-table',
    'SKELETON',
    { x: 0, y: 0 },
    players,
    ['FLAG_ARMOR'],
  )
  const initialGaitPose = result.store.actors[0]!.gaitPose
  result = step(result.store, 1, players)
  assert.equal(result.store.actors[0]!.config.enemyToken, 'SKELETON')
  assert.equal(result.store.actors[0]!.bodyPose, 2)
  const bodyPoses = new Set<number>()
  for (let tick = 2; tick <= 60; tick += 1) {
    result = step(result.store, tick, players)
    bodyPoses.add(result.store.actors[0]!.bodyPose)
    if (result.store.actors[0]!.brain.phase === 'approach') break
  }
  assert.deepEqual([...bodyPoses].sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(result.store.actors[0]!.bodyPose, 2)
  assert.equal(result.store.actors[0]!.gaitPose, initialGaitPose)
})

test('settled native circle contact begins a Skeleton action and reaches its marker', () => {
  let result = spawnOne(
    'settled-skeleton-contact',
    'SKELETON',
    { x: 0, y: 0 },
    FAR_PLAYERS,
  )
  const actor = result.store.actors[0]!
  const contactPlayers = {
    player: livingTarget(
      actor.config.collisionRadius + 25 + NATIVE_ACTOR_SEPARATION_EPSILON,
      0,
    ),
  }

  result = step(result.store, 1, contactPlayers)
  assert.equal(result.store.actors[0]!.brain.phase, 'attack')

  const damage = []
  for (let tick = 2; tick <= 60; tick += 1) {
    result = step(result.store, tick, contactPlayers)
    damage.push(...result.playerDamage)
  }
  assert.ok(damage.length > 0)

  let beyond = spawnOne(
    'beyond-settled-skeleton-contact',
    'SKELETON',
    { x: 0, y: 0 },
    FAR_PLAYERS,
  )
  const beyondActor = beyond.store.actors[0]!
  beyond = step(beyond.store, 1, {
    player: livingTarget(
      beyondActor.config.collisionRadius + 25 + NATIVE_ACTOR_SEPARATION_EPSILON + 0.0001,
      0,
    ),
  })
  assert.equal(beyond.store.actors[0]!.brain.phase, 'approach')
})

test('Staff Disable persistently composes native action and movement factors', () => {
  const near = { player: livingTarget(10, 0) }
  let attack = spawnOne('staff-disable-action', 'SKELETON', { x: 0, y: 0 }, near)
  attack = {
    ...attack,
    store: applyBoneyardStaffDisable(attack.store, attack.store.actors[0]!.id),
  }
  attack = step(attack.store, 1, near)
  let markerTick = -1
  for (let tick = 2; tick <= 100 && markerTick < 0; tick += 1) {
    attack = step(attack.store, tick, near)
    if (attack.events.some((event) => event.type === 'attack-marker')) markerTick = tick
  }
  assert.equal(markerTick, 65)
  assert.equal(attack.store.actors[0]!.staffActionFactor, 0.5)

  let baseline = spawnOne(
    'staff-disable-movement',
    'SKELETON',
    { x: 0, y: 0 },
    FAR_PLAYERS,
  )
  let slowed = {
    ...baseline,
    store: applyBoneyardStaffDisable(baseline.store, baseline.store.actors[0]!.id),
  }
  const baselineBeforeMovement = baseline.store.actors[0]!
  const slowedBeforeMovement = slowed.store.actors[0]!
  const initialPosition = baseline.store.actors[0]!.position
  for (let tick = 1; tick <= 20; tick += 1) {
    baseline = step(baseline.store, tick, FAR_PLAYERS)
    slowed = step(slowed.store, tick, FAR_PLAYERS)
    if (
      baseline.store.actors[0]!.position.x !== initialPosition.x
      || baseline.store.actors[0]!.position.y !== initialPosition.y
    ) break
  }
  const baselineDistance = Math.hypot(
    baseline.store.actors[0]!.position.x - initialPosition.x,
    baseline.store.actors[0]!.position.y - initialPosition.y,
  )
  const slowedDistance = Math.hypot(
    slowed.store.actors[0]!.position.x - initialPosition.x,
    slowed.store.actors[0]!.position.y - initialPosition.y,
  )
  const expectedDistance = (actor: BoneyardEnemyActor): number => {
    const movementScalar = Math.fround(
      actor.config.chaseSpeed
        * actor.config.baseSpeed
        * actor.staffMovementFactor
        * actor.config.scale
        * actor.path.speedFactor,
    )
    const steering = buildNativeEnemySteering(actor.path, {
      actorHeadingDeg: actor.headingDeg,
      actorPosition: actor.position,
      cadenceTicks: 2,
      movementPerTick: 0.25 * movementScalar,
      radialDirection: 1,
      statusFactor: actor.staffMovementFactor,
      tangentDirection: 0,
      targetHeadingDeg: 0,
      targetPosition: FAR_PLAYERS.player!.position,
    })
    return Math.hypot(steering.delta.x, steering.delta.y)
  }
  assert.equal(baselineDistance, expectedDistance(baselineBeforeMovement))
  assert.equal(slowedDistance, expectedDistance(slowedBeforeMovement))

  const compounded = applyBoneyardStaffDisable(
    slowed.store,
    slowed.store.actors[0]!.id,
  ).actors[0]!
  assert.equal(compounded.staffActionFactor, 0.25)
  assert.equal(compounded.staffMovementFactor, 0.5625)
})

test('each native claw crossing independently re-checks its staged target and reach', () => {
  const near = { player: livingTarget(10, 0) }
  const far = { player: livingTarget(500, 0) }
  let result = spawnOne('claw-three-contact-recheck', 'SKELETON', { x: 0, y: 0 }, near)
  result = step(result.store, 1, near)

  const markerTicks: number[] = []
  const damageTicks: number[] = []
  for (let tick = 2; tick <= 58; tick += 1) {
    const players = tick === 34 ? far : near
    result = step(result.store, tick, players)
    if (result.events.some((event) => event.type === 'attack-marker')) {
      markerTicks.push(tick - 1)
    }
    if (result.playerDamage.length > 0) {
      damageTicks.push(tick - 1)
      assert.deepEqual(result.playerDamage.map(({ amount }) => amount), [3])
    }
  }

  assert.deepEqual(markerTicks, [32, 33, 57])
  assert.deepEqual(damageTicks, [32, 57])
})

test('each native weapon marker independently re-checks its staged target and reach', () => {
  const near = { player: livingTarget(10, 0) }
  const far = { player: livingTarget(500, 0) }
  let result = spawnOne(
    'weapon-two-contact-recheck',
    'SKELETON',
    { x: 0, y: 0 },
    near,
    ['FLAG_SWORD'],
  )
  result = step(result.store, 1, near)

  const markerTicks: number[] = []
  const damageTicks: number[] = []
  for (let tick = 2; tick <= 82; tick += 1) {
    const players = tick === 81 ? far : near
    result = step(result.store, tick, players)
    if (result.events.some((event) => event.type === 'attack-marker')) {
      markerTicks.push(tick - 1)
    }
    if (result.playerDamage.length > 0) damageTicks.push(tick - 1)
  }

  assert.deepEqual(markerTicks, [36, 80])
  assert.deepEqual(damageTicks, [36])
})

test('melee markers never transfer a scheduled hit to a reacquired target', () => {
  const originalPlayers = {
    alpha: livingTarget(10, 0),
    beta: livingTarget(100, 0),
  }
  let result = spawnOne(
    'locked-melee-target',
    'SKELETON',
    { x: 0, y: 0 },
    originalPlayers,
  )
  result = step(result.store, 1, originalPlayers)
  assert.equal(result.store.actors[0]!.brain.phase, 'attack')

  const reacquiredPlayers = {
    alpha: { ...livingTarget(10, 0), alive: false },
    beta: livingTarget(10, 0),
  }
  let marker = null as (typeof result.events)[number] | null
  for (let tick = 2; tick <= 40 && marker === null; tick += 1) {
    result = step(result.store, tick, reacquiredPlayers)
    marker = result.events.find((event) => event.type === 'attack-marker') ?? null
  }

  assert.equal(result.store.actors[0]!.targetPlayerId, 'beta')
  assert.equal(marker?.targetPlayerId, 'alpha')
  assert.deepEqual(result.playerDamage, [])
})

test('melee markers re-check the scheduled target against family reach', () => {
  const players = { player: livingTarget(10, 0) }
  let result = spawnOne(
    'marker-time-reach',
    'SKELETON',
    { x: 0, y: 0 },
    players,
  )
  result = step(result.store, 1, players)
  for (let tick = 2; tick <= 32; tick += 1) {
    result = step(result.store, tick, players)
  }

  result = step(result.store, 33, { player: livingTarget(500, 0) })

  assert.ok(result.events.some((event) => event.type === 'attack-marker'))
  assert.deepEqual(result.playerDamage, [])
})

test('Archer and Mage use their recovered variable progress programs', () => {
  assert.deepEqual(NATIVE_ARCHER_ACTION_PROGRAM, {
    markerProgress: 13,
    progressPerTick: 0.0843750015,
    strictEnd: 16,
  })
  let archer = spawnOne(
    'archer-program',
    'SKELETONARCHER',
    { x: 0, y: 0 },
    { player: livingTarget(200, 0) },
  )
  const archerInitialGaitPose = archer.store.actors[0]!.gaitPose
  archer = step(archer.store, 1, { player: livingTarget(200, 0) })
  assert.equal(archer.store.actors[0]!.brain.phase, 'attack')
  const archerStartTick = 1
  let archerImpact = false
  let archerMarkerTick = -1
  let archerCompletionTick = -1
  let archerProjectileNativeTypeId: number | null = null
  for (let tick = 2; tick <= 220; tick += 1) {
    archer = step(archer.store, tick, { player: livingTarget(200, 0) })
    if (archer.events.some((event) => event.type === 'attack-marker')) archerMarkerTick = tick
    archerProjectileNativeTypeId ??= archer.store.projectiles[0]?.nativeTypeId ?? null
    if (archer.playerDamage.some((damage) => damage.actorId === 1)) {
      archerImpact = true
      assert.ok(archer.events.some((event) => event.type === 'projectile-impact'))
      assert.ok(archer.events.some((event) => event.type === 'projectile-retired'))
    }
    const archerPhase: string = archer.store.actors[0]!.brain.phase
    if (archerCompletionTick < 0 && archerPhase === 'range-control') {
      archerCompletionTick = tick
      break
    }
  }
  assert.equal(archerMarkerTick - archerStartTick, 155)
  assert.equal(archerCompletionTick - archerStartTick, 190)
  assert.equal(archerProjectileNativeTypeId, 0x7da)
  assert.equal(archerImpact, true)
  assert.equal(archer.store.projectiles.length, 0)
  assert.equal(archer.store.actors[0]!.bodyPose, 8)
  assert.equal(archer.store.actors[0]!.gaitPose, archerInitialGaitPose)

  let mage = spawnOne(
    'mage-program',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    { player: livingTarget(150, 0) },
  )
  const mageInitialGaitPose = mage.store.actors[0]!.gaitPose
  assert.ok(mage.store.actors[0]!.bodyPose === 0 || mage.store.actors[0]!.bodyPose === 1)
  mage = step(mage.store, 1, { player: livingTarget(150, 0) })
  assert.equal(mage.store.actors[0]!.bodyPose, 2)
  const began = mage.store.actors[0]!.brain
  assert.equal(began.family, 'mage')
  if (began.family !== 'mage') throw new Error('expected Mage brain')
  const base = NATIVE_MAGE_ACTION_PROGRAMS[began.castProgram]
  mage = step(mage.store, 2, { player: livingTarget(150, 0) })
  const advanced = mage.store.actors[0]!.brain
  assert.equal(advanced.family, 'mage')
  if (advanced.family !== 'mage') throw new Error('expected Mage brain')
  assert.equal(
    advanced.actionProgress,
    0.253125012 * (1 + began.castRoll) * mage.store.actors[0]!.config.attackSpeed,
  )
  assert.ok(base.markerProgress === 25 || base.markerProgress === 31)
  assert.ok(base.strictEnd === 41 || base.strictEnd === 47)

  let sawMarker = false
  let mageTick = 3
  for (; mageTick < 500 && !sawMarker; mageTick += 1) {
    mage = step(mage.store, mageTick, { player: livingTarget(150, 0) })
    sawMarker = mage.events.some((event) => event.type === 'attack-marker')
  }
  assert.equal(sawMarker, true)
  assert.deepEqual(mage.store.projectiles.map((projectile) => [
    projectile.id,
    projectile.nativeTypeId,
  ]), [[1, 0x7eb]])
  assert.deepEqual(mage.store.projectiles[0]!.lightRegistration, {
    managerLane: 'transient',
    registrationOrdinal: 0,
  })
  for (; mageTick < 700 && mage.store.actors[0]!.brain.phase === 'cast'; mageTick += 1) {
    mage = step(mage.store, mageTick, { player: livingTarget(150, 0) })
  }
  assert.equal(mage.store.actors[0]!.brain.phase, 'range-control')
  assert.equal(mage.store.actors[0]!.bodyPose, 0)
  assert.equal(mage.store.actors[0]!.gaitPose, mageInitialGaitPose)
})

test('every Archer and Mage range mode uses one strict native maximum with no retreat band', () => {
  const variants = [
    [[], 0],
    [['FLAG_RANGEDOWN'], 1],
    [['FLAG_RANGEUP'], 2],
    [['FLAG_RANGEEASY'], 3],
  ] as const
  for (const [flags, mode] of variants) {
    for (const [token, actionPhase] of [
      ['SKELETONARCHER', 'attack'],
      ['SKELETONMAGE', 'cast'],
    ] as const) {
      let inside = spawnOne(
        `${token}-${mode}-inside`,
        token,
        { x: 0, y: 0 },
        { player: livingTarget(1_000, 0) },
        flags,
      )
      const insideBrain = inside.store.actors[0]!.brain
      if (insideBrain.family !== 'archer' && insideBrain.family !== 'mage') {
        throw new Error('expected ranged Skeleton-family brain')
      }
      const insideDistance = insideBrain.attackRange - 1
      inside = step(inside.store, 1, { player: livingTarget(insideDistance, 0) })
      assert.equal(inside.store.actors[0]!.brain.phase, actionPhase)

      let near = spawnOne(
        `${token}-${mode}-near`,
        token,
        { x: 0, y: 0 },
        { player: livingTarget(10, 0) },
        flags,
      )
      near = step(near.store, 1, { player: livingTarget(10, 0) })
      assert.equal(near.store.actors[0]!.brain.phase, actionPhase)

      let far = spawnOne(
        `${token}-${mode}-far`,
        token,
        { x: 0, y: 0 },
        { player: livingTarget(1_000, 0) },
        flags,
      )
      const farBrain = far.store.actors[0]!.brain
      if (farBrain.family !== 'archer' && farBrain.family !== 'mage') {
        throw new Error('expected ranged Skeleton-family brain')
      }
      const farDistance = farBrain.attackRange + 1
      far = step(far.store, 2, { player: livingTarget(farDistance, 0) })
      assert.ok(far.store.actors[0]!.position.x > 0, `${token} mode ${mode} must approach`)

      let boundary = spawnOne(
        `${token}-${mode}-boundary`,
        token,
        { x: 0, y: 0 },
        { player: livingTarget(1_000, 0) },
        flags,
      )
      const boundaryBrain = boundary.store.actors[0]!.brain
      if (boundaryBrain.family !== 'archer' && boundaryBrain.family !== 'mage') {
        throw new Error('expected ranged Skeleton-family brain')
      }
      boundary = step(boundary.store, 2, {
        player: livingTarget(boundaryBrain.attackRange, 0),
      })
      assert.notEqual(boundary.store.actors[0]!.brain.phase, actionPhase)
    }
  }
})

test('native target-facing actions follow a moving player throughout windup', () => {
  for (const token of [
    'SKELETON',
    'SKELETONARCHER',
    'SKELETONMAGE',
    'ZOMBIE',
  ] as const) {
    const north = { player: livingTarget(0, -10) }
    let result = spawnOne(`moving-action-target-${token}`, token, { x: 0, y: 0 }, north)
    result = step(result.store, 1, north)
    assert.ok(
      ['attack', 'cast', 'swipe'].includes(result.store.actors[0]!.brain.phase),
      `${token} did not enter its action`,
    )
    result = step(result.store, 2, { player: livingTarget(10, 0) })
    assert.equal(result.store.actors[0]!.headingDeg, 90, token)
  }

  const north = { player: livingTarget(0, -200) }
  let archer = spawnOne('moving-action-target-arrow-release', 'SKELETONARCHER', {
    x: 0,
    y: 0,
  }, north)
  archer = step(archer.store, 1, north)
  const archerBrain = archer.store.actors[0]!.brain
  if (archerBrain.family !== 'archer') throw new Error('expected Archer brain')
  archer = withActorBrain(archer, 0, {
    ...archerBrain,
    actionProgress: NATIVE_ARCHER_ACTION_PROGRAM.markerProgress,
    markerEmitted: false,
  })
  archer = step(archer.store, 2, { player: livingTarget(200, 0) })
  assert.equal(archer.store.projectiles[0]!.headingDeg, 90)
})

test('Archer modes consume target velocity and RNG while payload and extra arrows stay orthogonal', () => {
  const movingTarget = {
    player: {
      ...livingTarget(0, -200),
      velocityPerTick: { x: 1, y: 0 },
    },
  }
  const normal = forcedArcherVolley('archer-normal', [], movingTarget)
  const leading = forcedArcherVolley('archer-leading', ['FLAG_LEADING'], movingTarget)
  const scatter = forcedArcherVolley('archer-scatter', ['FLAG_SCATTERSHOT'], movingTarget)
  const random = forcedArcherVolley('archer-random', ['FLAG_RANDOMSHOT'], movingTarget)
  assert.equal(normal.store.projectiles[0]!.headingDeg, 0)
  assert.ok(leading.store.projectiles[0]!.headingDeg > 0)
  assert.ok(Math.abs(signedHeading(scatter.store.projectiles[0]!.headingDeg)) <= 25)
  assert.ok(Number.isFinite(random.store.projectiles[0]!.headingDeg))

  const fire = forcedArcherVolley(
    'archer-fire-multishot',
    ['FLAG_FIREARROW'],
    { player: livingTarget(200, 0) },
    2,
  )
  const fireArrows = fire.store.projectiles.map((projectile) => ({
    damage: projectile.damage,
    headingDeg: projectile.headingDeg,
    lightRegistration: projectile.lightRegistration,
    payload: projectile.payload,
  }))
  assert.equal(fireArrows.length, 3)
  assert.deepEqual(fireArrows.map(({ damage, payload }) => ({ damage, payload })), [
    { damage: 8, payload: 'fire' },
    { damage: 8, payload: 'fire' },
    { damage: 8, payload: 'fire' },
  ])
  assert.equal(fireArrows[0]!.headingDeg, 90)
  assert.ok(fireArrows[1]!.headingDeg >= 79 && fireArrows[1]!.headingDeg <= 81)
  assert.ok(fireArrows[2]!.headingDeg >= 99 && fireArrows[2]!.headingDeg <= 101)
  assert.deepEqual(fireArrows.map(({ lightRegistration }) => lightRegistration), [
    { managerLane: 'transient', registrationOrdinal: 0 },
    { managerLane: 'transient', registrationOrdinal: 1 },
    { managerLane: 'transient', registrationOrdinal: 2 },
  ])
  assert.deepEqual(fire.events.map(({ type }) => type), [
    'attack-marker',
    'enemy-action-sound',
    'projectile-spawned',
    'projectile-spawned',
    'projectile-spawned',
  ])
  const shotSound = fire.events[1]!
  assert.equal(shotSound.sound, 'shoot-arrow')
  assert.ok(shotSound.pitch! >= 0.9 && shotSound.pitch! <= 1.1)
  const poison = forcedArcherVolley(
    'archer-poison',
    ['FLAG_POISONARROW'],
    { player: livingTarget(200, 0) },
  ).store.projectiles[0]!
  assert.deepEqual({
    damage: poison.damage,
    lightRegistration: poison.lightRegistration,
    payload: poison.payload,
    poisonDamage: poison.poisonDamage,
    poisonDuration: poison.poisonDuration,
  }, {
    damage: 4,
    lightRegistration: null,
    payload: 'poison',
    poisonDamage: 12,
    poisonDuration: BOUNDED_ENEMY_POISON_DURATION_SECONDS,
  })
})

test('Arrow arc countdown is independent from its settled opacity retirement lane', () => {
  let result = forcedArcherVolley(
    'archer-arrow-arc-lifecycle',
    [],
    { player: livingTarget(200, 0) },
  )
  const born = result.store.projectiles[0]!
  assert.equal(born.verticalOffset, -25)
  assert.equal(born.visualScale, 5)
  assert.equal(born.settledTicksRemaining, born.lifetimeTicks)

  result = step(result.store, 2, {})
  const airborne = result.store.projectiles[0]!
  assert.equal(airborne.verticalOffset, -24.25)
  const radians = born.headingDeg * Math.PI / 180
  assert.equal(airborne.visualPhaseDeg, Math.fround(actorHeadingFromVector(
    Math.sin(radians) * born.minimumSpeed,
    -Math.cos(radians) * born.minimumSpeed
      + (-25 / airborne.verticalOffset) * born.minimumSpeed * 0.25,
  )))

  result = step(result.store, 31, {})
  const landed = result.store.projectiles[0]!
  assert.equal(landed.ageTicks, 30)
  assert.equal(landed.verticalOffset, -2.5)
  assert.ok(landed.speed < born.speed)
  assert.equal(landed.visualScale, 5)

  result = step(result.store, 32, {})
  const fading = result.store.projectiles[0]!
  assert.equal(fading.verticalOffset, 0)
  assert.equal(fading.speed, 0)
  assert.ok(fading.visualScale < 5)

  result = step(result.store, 80, {})
  assert.equal(result.store.projectiles.length, 1)
  assert.ok(result.store.projectiles[0]!.ageTicks > born.lifetimeTicks)
  result = step(result.store, 140, {})
  assert.equal(result.store.projectiles.length, 0)
})

test('Fire Arrow impact uses its unsigned half-scale burst and one transient wrapper', () => {
  const players = { player: livingTarget(200, 0) }
  const spawned = forcedArcherVolley(
    'archer-fire-impact-burst',
    ['FLAG_FIREARROW'],
    players,
  )
  const projectile = spawned.store.projectiles[0]!
  const rotation = nextBoneyardWaveRandom(spawned.store.rngState)
  const angularMagnitude = nextBoneyardWaveRandom(rotation.state)
  const angularSign = randomBoneyardWaveInteger(angularMagnitude.state, 2)
  const scale = nextBoneyardWaveRandom(angularSign.state)
  const result = stepBoneyardEnemyStore(spawned.store, {
    firstProjectileWorldContact: () => 1,
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 2,
  })
  const glow = result.store.projectileEffects.find(
    ({ kind }) => kind === 'fire-burst-glow',
  )!
  const frame = result.store.projectileEffects.find(
    ({ kind }) => kind === 'fire-burst-frame',
  )!
  const radians = projectile.headingDeg * Math.PI / 180
  assert.deepEqual(frame.position, {
    x: projectile.position.x + Math.sin(radians) * projectile.speed,
    y: projectile.position.y - Math.cos(radians) * projectile.speed - 10,
  })
  assert.deepEqual(glow.position, frame.position)
  assert.ok(frame.scale >= 0.5 && frame.scale <= 0.6)
  assert.equal(glow.scale, frame.scale * 5)
  assert.deepEqual(glow.lightRegistration, {
    managerLane: 'transient',
    registrationOrdinal: projectile.lightRegistration!.registrationOrdinal + 1,
  })
  assert.equal(frame.lightRegistration, null)
  assert.equal(result.store.rngState, scale.state)
})

test('Mage self and ally shields preserve 50/450 strength and 1000/500 cadence', () => {
  for (const [shieldFlag, strong, expectedStrength, expectedInterval] of [
    ['FLAG_SHIELD', false, 50, 1_000],
    ['FLAG_SHIELD', true, 450, 500],
    ['FLAG_SHIELDOTHERS', false, 50, 1_000],
    ['FLAG_SHIELDOTHERS', true, 450, 500],
  ] as const) {
    const flags = strong
      ? [shieldFlag, 'FLAG_SHIELDSTRONG', 'FLAG_SHIELDFAST']
      : [shieldFlag]
    let result = stepBoneyardEnemyStore(createBoneyardEnemyStore(`shield-${flags.join('-')}`), {
      firstProjectileWorldContact: NO_WORLD_CONTACT,
      players: { player: livingTarget(150, 0) },
      resolveMovement: DIRECT_MOVEMENT,
      resolveSpawnIntents: () => [
        intent('SKELETONMAGE', 1, { x: 0, y: 0 }, flags),
        intent('SKELETON', 2, { x: 20, y: 0 }),
      ],
      tick: 0,
    })
    const mageBrain = result.store.actors[0]!.brain
    assert.equal(mageBrain.family, 'mage')
    if (mageBrain.family !== 'mage') throw new Error('expected Mage brain')
    assert.equal(mageBrain.shieldTicksRemaining, expectedInterval)
    result = withActorBrain(result, 0, { ...mageBrain, shieldTicksRemaining: 1 })
    result = step(result.store, 1, { player: livingTarget(150, 0) })
    const refreshedBrain = result.store.actors[0]!.brain
    assert.equal(refreshedBrain.family, 'mage')
    if (refreshedBrain.family !== 'mage') throw new Error('expected Mage brain')
    assert.equal(refreshedBrain.shieldTicksRemaining, expectedInterval)
    const selfShield = shieldFlag === 'FLAG_SHIELD' ? expectedStrength : 0
    const allyShield = shieldFlag === 'FLAG_SHIELDOTHERS' ? expectedStrength : 0
    assert.equal(result.store.actors[0]!.shieldHealth, selfShield)
    assert.equal(result.store.actors[1]!.shieldHealth, allyShield)
  }
})

test('Mage ally shields accept only the three stock runtime recipient types', () => {
  for (const [token, eligible] of [
    ['SKELETON', true],
    ['SKELETONARCHER', true],
    ['ZOMBIE', true],
    ['SKELETONMAGE', false],
    ['IMP', false],
    ['WRAITH', false],
    ['DEMON', false],
    ['COFFIN', false],
  ] as const) {
    let result = stepBoneyardEnemyStore(createBoneyardEnemyStore(`shield-recipient-${token}`), {
      firstProjectileWorldContact: NO_WORLD_CONTACT,
      players: { player: livingTarget(150, 0) },
      resolveMovement: DIRECT_MOVEMENT,
      resolveSpawnIntents: () => [
        intent('SKELETONMAGE', 1, { x: 0, y: 0 }, ['FLAG_SHIELDOTHERS']),
        intent(token, 2, { x: 20, y: 0 }),
      ],
      tick: 0,
    })
    const brain = result.store.actors[0]!.brain
    assert.equal(brain.family, 'mage')
    if (brain.family !== 'mage') throw new Error('expected Mage brain')
    result = withActorBrain(result, 0, { ...brain, shieldTicksRemaining: 1 })
    result = step(result.store, 1, { player: livingTarget(150, 0) })
    assert.equal(result.store.actors[1]!.shieldHealth, eligible ? 50 : 0, token)
  }
})

test('shield damage suppresses body hits, never overflows health, and breaks natively', () => {
  const players = { player: livingTarget(150, 0) }
  let result = spawnOne(
    'shield-absorption',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    players,
    ['FLAG_SHIELD'],
  )
  const brain = result.store.actors[0]!.brain
  assert.equal(brain.family, 'mage')
  if (brain.family !== 'mage') throw new Error('expected Mage brain')
  result = withActorBrain(result, 0, { ...brain, shieldTicksRemaining: 1 })
  result = step(result.store, 1, players)
  const initialHealth = result.store.actors[0]!.currentHealth
  assert.equal(result.store.actors[0]!.shieldPulse, 3)
  assert.equal(result.store.actors[0]!.shieldSoundCooldownTicks, 0)
  const appliedStore = result.store

  const absorbed = damageBoneyardEnemy(result.store, {
    actorId: result.store.actors[0]!.id,
    amount: 20,
    sourcePlayerId: 'player',
    tick: 1,
  })
  assert.equal(absorbed.killed, false)
  assert.equal(absorbed.store.actors[0]!.currentHealth, initialHealth)
  assert.equal(absorbed.store.actors[0]!.shieldHealth, 30)
  assert.equal(absorbed.store.actors[0]!.shieldMaximumHealth, 50)
  assert.equal(absorbed.store.actors[0]!.lastDamageTick, null)
  assert.equal(absorbed.store.actors[0]!.lastDamagedByPlayerId, null)
  assert.equal(absorbed.store.actors[0]!.shieldPulse, 2)
  assert.equal(absorbed.store.actors[0]!.shieldSoundCooldownTicks, 10)
  assert.equal(absorbed.events.length, 1)
  assert.equal(absorbed.events[0]?.type, 'enemy-damage-sound')
  assert.equal(absorbed.events[0]?.sound, 'hit-shield')
  assert.ok(absorbed.events[0]!.pitch! >= 0.8 && absorbed.events[0]!.pitch! < 0.85)

  const timed = step(absorbed.store, 2, players)
  assert.equal(timed.store.actors[0]!.shieldPulse, 1.95)
  assert.equal(timed.store.actors[0]!.shieldSoundCooldownTicks, 9)

  const exhausted = damageBoneyardEnemy(timed.store, {
    actorId: timed.store.actors[0]!.id,
    amount: 31,
    sourcePlayerId: 'player',
    tick: 2,
  })
  assert.equal(exhausted.killed, false)
  assert.equal(exhausted.store.actors[0]!.currentHealth, initialHealth)
  assert.equal(exhausted.store.actors[0]!.shieldHealth, 0)
  assert.equal(exhausted.store.actors[0]!.shieldMaximumHealth, 0)
  assert.equal(exhausted.store.actors[0]!.lastDamageTick, null)
  assert.deepEqual(exhausted.events.map(({ sound }) => sound), ['pop-shield'])
  assert.equal(exhausted.events[0]?.pitch, 0.8)
  assert.equal(exhausted.store.deathEffects.length, 20)
  assert.ok(exhausted.store.deathEffects.every((effect) => (
    effect.atlas === 'BadGuys'
    && effect.blendMode === 'add'
    && effect.entry === 69
    && effect.kind === 'fade'
    && effect.position.x === timed.store.actors[0]!.position.x
    && effect.position.y === timed.store.actors[0]!.position.y - 30
    && effect.alpha >= 0.5
    && effect.alpha < 1.25
    && effect.alphaLossPerTick === 0.05
    && effect.rotationDeg >= 0
    && effect.rotationDeg < 360
    && effect.scale >= 1.5
    && effect.scale < 1.75
    && effect.role === 'shield-break-particle'
    && effect.velocity.x === 0
    && effect.velocity.y === 0
  )))

  const immediateBreak = damageBoneyardEnemy(appliedStore, {
    actorId: appliedStore.actors[0]!.id,
    amount: 10_000,
    sourcePlayerId: 'player',
    tick: 1,
  })
  assert.equal(immediateBreak.killed, false)
  assert.equal(immediateBreak.store.actors[0]!.currentHealth, initialHealth)
  assert.deepEqual(immediateBreak.events.map(({ sound }) => sound), [
    'hit-shield',
    'pop-shield',
  ])
  const brightParticle = immediateBreak.store.deathEffects.find(({ alpha }) => alpha > 1)
  assert.ok(brightParticle)
  const faded = step(immediateBreak.store, 2, players).store.deathEffects
    .find(({ id }) => id === brightParticle.id)
  assert.ok(faded)
  assert.ok(Math.abs(faded.alpha - (brightParticle.alpha - 0.05)) < 1e-12)

  const firstCue = damageBoneyardEnemy(appliedStore, {
    actorId: appliedStore.actors[0]!.id,
    amount: 1,
    sourcePlayerId: 'player',
    tick: 1,
  })
  const cooling = step(firstCue.store, 10, players)
  const throttled = damageBoneyardEnemy(cooling.store, {
    actorId: cooling.store.actors[0]!.id,
    amount: 1,
    sourcePlayerId: 'player',
    tick: 10,
  })
  assert.deepEqual(throttled.events, [])
  const ready = step(throttled.store, 11, players)
  const replayed = damageBoneyardEnemy(ready.store, {
    actorId: ready.store.actors[0]!.id,
    amount: 1,
    sourcePlayerId: 'player',
    tick: 11,
  })
  assert.deepEqual(replayed.events.map(({ sound }) => sound), ['hit-shield'])
  assert.equal(replayed.store.actors[0]!.shieldPulse, 2)
  assert.equal(replayed.store.actors[0]!.shieldSoundCooldownTicks, 10)
})

test('Skeleton-family and Zombie hurt sounds use the prior 20-tick body latch', () => {
  for (const [token, expectedSound] of [
    ['SKELETON', 'bone-crack'],
    ['SKELETONARCHER', 'bone-crack'],
    ['SKELETONMAGE', 'bone-crack'],
    ['ZOMBIE', 'zombie-ouch'],
  ] as const) {
    let store = spawnOne(
      `hurt-${token}`,
      token,
      { x: 0, y: 0 },
      FAR_PLAYERS,
    ).store
    const actorId = store.actors[0]!.id
    const first = damageBoneyardEnemy(store, {
      actorId,
      amount: 0.1,
      sourcePlayerId: 'player',
      tick: 0,
    })
    assert.deepEqual(first.events.map(({ sound }) => sound), [expectedSound])
    assert.ok(first.events[0]!.pitch! >= 0.9 && first.events[0]!.pitch! < 1.1)
    assert.equal(first.store.actors[0]!.lastDamageTick, 0)

    const refreshed = damageBoneyardEnemy(first.store, {
      actorId,
      amount: 0.1,
      sourcePlayerId: 'player',
      tick: 10,
    })
    assert.deepEqual(refreshed.events, [])
    assert.equal(refreshed.store.actors[0]!.lastDamageTick, 10)

    const quiet = damageBoneyardEnemy(refreshed.store, {
      actorId,
      amount: 0.1,
      sourcePlayerId: 'player',
      tick: 30,
    })
    assert.deepEqual(quiet.events.map(({ sound }) => sound), [expectedSound])
    store = quiet.store
    assert.equal(store.actors[0]!.lastDamageTick, 30)
  }

  for (const token of ['COFFIN', 'DEMON', 'IMP', 'WRAITH'] as const) {
    const silent = spawnOne(`hurt-${token}-negative`, token, { x: 0, y: 0 }, FAR_PLAYERS)
    assert.deepEqual(damageBoneyardEnemy(silent.store, {
      actorId: silent.store.actors[0]!.id,
      amount: 0.1,
      sourcePlayerId: 'player',
      tick: 0,
    }).events, [])
  }
})

test('Mage body attachment source covers all authored poses and native facing buckets', () => {
  assert.deepEqual(nativeMageBodyAttachment(0, 0), { x: 24.5, y: -14 })
  assert.deepEqual(nativeMageBodyAttachment(0, 90), { x: -3, y: 8 })
  assert.deepEqual(nativeMageBodyAttachment(0, 180), { x: -24.5, y: -11.5 })
  assert.deepEqual(nativeMageBodyAttachment(0, 270), { x: 3, y: -33 })
  assert.equal(nativeMageFacingBucket(0), 0)
  assert.equal(nativeMageFacingBucket(90), 5)
  assert.equal(nativeMageFacingBucket(180), 9)
  assert.equal(nativeMageFacingBucket(270), 14)
  assert.equal(nativeMageFacingBucket(20), 1)
  assert.equal(nativeMageFacingBucket(-20), 0)

  for (let pose = 0; pose < NATIVE_MAGE_BODY_POSE_COUNT; pose += 1) {
    for (let facing = 0; facing < NATIVE_MAGE_FACING_COUNT; facing += 1) {
      const attachment = nativeMageBodyAttachment(pose, facing * 20 - 10)
      assert.ok(Number.isFinite(attachment.x) && Number.isFinite(attachment.y))
    }
  }
  assert.deepEqual(nativeMageBodyAttachment(-1, 0), nativeMageBodyAttachment(0, 0))
  assert.deepEqual(nativeMageBodyAttachment(99, 0), { x: 4, y: -38.5 })
  assert.equal(nativeMageBodyPose({
    actionProgress: 24,
    bodyPose: 0,
    castProgram: 'short',
    phase: 'cast',
  }), 3)
  assert.equal(nativeMageBodyPose({
    actionProgress: 25,
    bodyPose: 0,
    castProgram: 'short',
    phase: 'cast',
  }), 4)
  assert.equal(nativeMageBodyPose({
    actionProgress: 38,
    bodyPose: 0,
    castProgram: 'short',
    phase: 'cast',
  }), 3)
  assert.equal(nativeMageBodyPose({
    actionProgress: 45,
    bodyPose: 0,
    castProgram: 'long',
    phase: 'cast',
  }), 0)
  assert.equal(nativeMageBodyPose({
    actionProgress: 0,
    bodyPose: 1,
    castProgram: 'short',
    phase: 'range-control',
  }), 1)
})

test('all Mage elements emit their authoritative damage, status, payload, and lightning channel', () => {
  const fire = forcedMageAttack('mage-fire', ['FLAG_CASTFIRE'])
  assert.deepEqual(mageProjectileSummary(fire), {
    coldSlowTicks: 0,
    damage: 24,
    kind: 'firebolt',
    payload: 'fire',
    poisonDamage: 0,
    poisonDuration: 0,
  })
  const frost = forcedMageAttack('mage-frost', ['FLAG_CASTFROST'])
  assert.deepEqual(mageProjectileSummary(frost), {
    coldSlowTicks: BOUNDED_ENEMY_COLD_SLOW_TICKS,
    damage: 6,
    kind: 'guided-missile',
    payload: 'cold',
    poisonDamage: 0,
    poisonDuration: 0,
  })
  const poison = forcedMageAttack('mage-poison', ['FLAG_CASTPOISON'])
  assert.deepEqual(mageProjectileSummary(poison), {
    coldSlowTicks: 0,
    damage: 24,
    kind: 'guided-missile',
    payload: 'poison',
    poisonDamage: 24,
    poisonDuration: BOUNDED_ENEMY_POISON_DURATION_SECONDS,
  })

  let lightning = forcedMageAttack('mage-lightning', ['FLAG_CASTLIGHTNING'])
  assert.equal(lightning.store.projectiles.length, 0)
  assert.deepEqual(lightning.playerDamage.map((damage) => ({
    amount: damage.amount,
    playerId: damage.playerId,
  })), [{ amount: 12, playerId: 'player' }])
  assert.ok(lightning.events.every((event) => event.type !== ('mage-lightning' as string)))
  const first = lightning.store.mageLightningPulses[0]!
  assert.equal(first.tick, 1)
  assert.equal(first.ownerActorId, lightning.store.actors[0]!.id)
  assert.deepEqual(first.source, { x: 23, y: -16 })
  assert.deepEqual(first.midpoint, { x: 75, y: 0 })
  assert.equal(first.contact.kind, 'target-attached')
  if (first.contact.kind !== 'target-attached') throw new Error('expected target contact')
  assert.equal(first.contact.targetPlayerId, 'player')
  assert.ok(Math.hypot(first.endpoint.x - 150, first.endpoint.y) < 10)
  assert.ok(Math.hypot(first.contact.localOffset.x, first.contact.localOffset.y) < 15)
  assert.notDeepEqual(
    { x: first.endpoint.x - 150, y: first.endpoint.y },
    first.contact.localOffset,
  )
  assert.equal(nativeMageLightningDurationTicks(1), 50)
  assert.equal((lightning.store.actors[0]!.brain as { lightningTicksRemaining: number })
    .lightningTicksRemaining, 49)

  const birthTicks = [first.tick]
  for (let tick = 2; tick <= 50; tick += 1) {
    lightning = step(lightning.store, tick, { player: livingTarget(150, 0) })
    const born = lightning.store.mageLightningPulses.find((pulse) => pulse.tick === tick)
    assert.ok(born, `missing Mage lightning pulse at tick ${tick}`)
    birthTicks.push(born.tick)
  }
  assert.equal(birthTicks.length, 50)
  assert.deepEqual(birthTicks, Array.from({ length: 50 }, (_, index) => index + 1))
  assert.deepEqual(lightning.store.mageLightningPulses.map(({ tick }) => tick), [46, 47, 48, 49, 50])
  lightning = step(lightning.store, 51, { player: livingTarget(150, 0) })
  assert.ok(!lightning.store.mageLightningPulses.some(({ tick }) => tick === 51))
})

test('Mage lightning uses a clipped world contact without reusing endpoint displacement', () => {
  const blockedPoint = { x: 60, y: -4 }
  const result = forcedMageAttack(
    'mage-lightning-blocked',
    ['FLAG_CASTLIGHTNING'],
    () => blockedPoint,
  )
  const pulse = result.store.mageLightningPulses[0]!
  assert.deepEqual(pulse.midpoint, { x: 75, y: 0 })
  assert.equal(pulse.contact.kind, 'world')
  if (pulse.contact.kind !== 'world') throw new Error('expected world contact')
  const endpointOffset = {
    x: pulse.endpoint.x - blockedPoint.x,
    y: pulse.endpoint.y - blockedPoint.y,
  }
  const contactOffset = {
    x: pulse.contact.position.x - blockedPoint.x,
    y: pulse.contact.position.y - blockedPoint.y,
  }
  assert.ok(Math.hypot(endpointOffset.x, endpointOffset.y) < 10)
  assert.ok(Math.hypot(contactOffset.x, contactOffset.y) < 15)
  assert.notDeepEqual(endpointOffset, contactOffset)
})

test('Mage lightning preserves its dispatch target identity after attachment becomes invalid', () => {
  let result = forcedMageAttack('mage-lightning-detached', ['FLAG_CASTLIGHTNING'])
  const detachedTarget = { ...livingTarget(150, 0), alive: false }
  result = step(result.store, 2, { player: detachedTarget })

  const pulse = result.store.mageLightningPulses.find(({ tick }) => tick === 2)!
  assert.equal(pulse.contact.kind, 'world')
  const brain = result.store.actors[0]!.brain
  assert.equal(brain.family, 'mage')
  if (brain.family !== 'mage') throw new Error('expected Mage brain')
  assert.equal(brain.lightningTargetPlayerId, 'player')
  assert.deepEqual(brain.lightningTargetPosition, { x: 150, y: 0 })
})

test('Wraith contact immediately applies damage and the exact 50-tick Dazzle duration', () => {
  const players = { player: livingTarget(10, 0) }
  let result = spawnOne('wraith-dazzle', 'WRAITH', { x: 0, y: 0 }, players)
  result = step(result.store, 1, players)

  assert.equal(result.playerDamage.length, 1)
  assert.equal(result.playerDamage[0]!.amount, 4)
  assert.equal(result.playerDamage[0]!.dazzleTicks, NATIVE_WRAITH_DAZZLE_TICKS)
})

test('Wraith contact is strict at 40 units and repeated overlap resets flight without duplicate damage', () => {
  const boundaryPlayers = { player: livingTarget(40, 0) }
  let boundary = spawnOne(
    'wraith-contact-boundary',
    'WRAITH',
    { x: 0, y: 0 },
    boundaryPlayers,
  )
  boundary = step(boundary.store, 1, boundaryPlayers)
  assert.deepEqual(boundary.playerDamage, [])

  const insidePlayers = { player: livingTarget(39.999, 0) }
  let inside = spawnOne('wraith-contact-inside', 'WRAITH', { x: 0, y: 0 }, insidePlayers)
  inside = step(inside.store, 1, insidePlayers)
  assert.equal(inside.playerDamage.length, 1)
  const contacted = inside.store.actors[0]!.brain
  assert.equal(contacted.family, 'wraith')
  if (contacted.family !== 'wraith') throw new Error('expected Wraith brain')
  assert.equal(contacted.contactCooldownTicks, 50)
  assert.equal(contacted.currentSpeed, Math.fround(contacted.baseFlybySpeed * 50))

  inside = {
    ...inside,
    store: {
      ...inside.store,
      actors: inside.store.actors.map(actor => ({
        ...actor,
        nextMovementTick: Number.MAX_SAFE_INTEGER,
      })),
    },
  }
  inside = stepBoneyardEnemyStore(inside.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: insidePlayers,
    resolveMovement: () => assert.fail('Wraith flight bypasses movement collision'),
    resolveSpawnIntents: () => [],
    tick: 2,
  })
  assert.deepEqual(inside.playerDamage, [])
  const repeated = inside.store.actors[0]!.brain
  assert.equal(repeated.family, 'wraith')
  if (repeated.family !== 'wraith') throw new Error('expected Wraith brain')
  assert.equal(repeated.contactCooldownTicks, 50)
  assert.equal(repeated.currentSpeed, Math.fround(repeated.baseFlybySpeed * 50))
  assert.ok(repeated.flybyTicksRemaining >= 200 && repeated.flybyTicksRemaining <= 800)
})

test('Wraith initial flight uses its native high-speed vector instead of ordinary walking speed', () => {
  const players = { player: livingTarget(500, 0) }
  let result = spawnOne('wraith-flight-speed', 'WRAITH', { x: 0, y: 0 }, players)
  result = stepBoneyardEnemyStore(result.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players,
    resolveMovement: () => assert.fail('Wraith flight bypasses movement collision'),
    resolveSpawnIntents: () => [],
    tick: 2,
  })

  const requestedDistance = Math.hypot(
    result.store.actors[0]!.position.x,
    result.store.actors[0]!.position.y,
  )
  assert.ok(requestedDistance >= 8.5 && requestedDistance <= 30)
})

test('Wraith native flight derives from every shared authored chase transform', () => {
  for (const [flags, expectedChaseSpeed] of [
    [[], 1],
    [['FLAG_FAST'], 1.25],
    [['FLAG_SLOW'], 0.5],
    [['FLAG_BURNING'], 1.5],
  ] as const) {
    const spawned = spawnOne(
      `wraith-chase-${flags.join('-') || 'normal'}`,
      'WRAITH',
      { x: 0, y: 0 },
      FAR_PLAYERS,
      flags,
    )
    const actor = spawned.store.actors[0]!
    assert.equal(actor.config.chaseSpeed, expectedChaseSpeed)
    assert.equal(actor.brain.family, 'wraith')
    if (actor.brain.family !== 'wraith') throw new Error('expected Wraith brain')
    assert.equal(actor.brain.baseFlybySpeed, Math.fround(expectedChaseSpeed * 0.8))
  }
})

test('Zombie beat emits one target-radial knockback at exact progress 100', () => {
  const players = { player: livingTarget(10, 0) }
  let result = spawnOne('zombie-knockback', 'ZOMBIE', { x: 0, y: 0 }, players)
  const brain = result.store.actors[0]!.brain
  assert.equal(brain.family, 'zombie')
  if (brain.family !== 'zombie') throw new Error('expected Zombie brain')
  result = withActorBrain(result, 0, {
    ...brain,
    actionProgress: NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress - 1,
    actionRate: 1,
    contactTargetPlayerId: 'player',
    impactStateTicksRemaining: 0,
    markerEmitted: false,
    phase: 'swipe',
  })

  result = step(result.store, 1, players)

  assert.equal(result.playerDamage.length, 1)
  assert.deepEqual(result.playerKnockbacks, [{
    actorId: result.store.actors[0]!.id,
    delta: { x: BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE, y: 0 },
    eventId: result.playerDamage[0]!.eventId,
    playerId: 'player',
  }])
})

test('Zombie beat keeps its native rate, doubled pre-impact clock, and 125 completion', () => {
  const players = { player: livingTarget(10, 0) }
  let result = spawnOne('zombie-beat-clock', 'ZOMBIE', { x: 0, y: 0 }, players)
  const initial = result.store.actors[0]!.brain
  assert.equal(initial.family, 'zombie')
  if (initial.family !== 'zombie') throw new Error('expected Zombie brain')
  const initialSide = initial.attackSide

  result = step(result.store, 1, players)
  const started = result.store.actors[0]!.brain
  assert.equal(started.family, 'zombie')
  if (started.family !== 'zombie') throw new Error('expected Zombie brain')
  assert.equal(started.phase, 'swipe')
  assert.equal(started.attackSide, initialSide === 0 ? 1 : 0)
  assert.ok(started.actionRate >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.minimumRate)
  assert.ok(started.actionRate < (
    NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.minimumRate
    + NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.randomRateRange
  ))

  result = step(result.store, 2, players)
  const doubled = result.store.actors[0]!.brain
  assert.equal(doubled.family, 'zombie')
  if (doubled.family !== 'zombie') throw new Error('expected Zombie brain')
  assert.ok(Math.abs(doubled.actionProgress - started.actionRate * 2) < 1e-12)

  let markerCount = 0
  let markerProgress = 0
  let markerRate = 0
  let tick = 3
  while (tick < 200) {
    result = step(result.store, tick, players)
    markerCount += result.playerDamage.length
    const brain = result.store.actors[0]!.brain
    if (brain.family !== 'zombie') throw new Error('expected Zombie brain')
    if (brain.markerEmitted) {
      markerProgress = brain.actionProgress
      markerRate = brain.actionRate
      break
    }
    tick += 1
  }
  assert.equal(markerCount, 1)
  assert.ok(markerProgress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress)

  tick += 1
  result = step(result.store, tick, players)
  const postMarker = result.store.actors[0]!.brain
  assert.equal(postMarker.family, 'zombie')
  if (postMarker.family !== 'zombie') throw new Error('expected Zombie brain')
  assert.ok(Math.abs(postMarker.actionProgress - (markerProgress + markerRate)) < 1e-12)

  while (tick < 300 && result.store.actors[0]!.brain.phase === 'swipe') {
    tick += 1
    result = step(result.store, tick, players)
    markerCount += result.playerDamage.length
  }
  const completed = result.store.actors[0]!.brain
  assert.equal(completed.family, 'zombie')
  if (completed.family !== 'zombie') throw new Error('expected Zombie brain')
  assert.equal(completed.phase, 'knockback')
  assert.equal(markerCount, 1)
  assert.ok(completed.phaseTicksRemaining > 0)
})

test('Imp contact is an immediate landing edge with native escape, VFX, and audio ownership', () => {
  const players = { player: livingTarget(80, 0) }
  let result = spawnOne('imp-landing-contact', 'IMP', { x: 0, y: 0 }, players)
  const brain = result.store.actors[0]!.brain
  if (brain.family !== 'imp') throw new Error('expected Imp brain')
  let expectedContactVisualRngState = brain.visualRngState
  for (let draw = 0; draw < 17; draw += 1) {
    expectedContactVisualRngState = nextBoneyardWaveRandom(expectedContactVisualRngState).state
  }
  result = withActorBrain(result, 0, {
    ...brain,
    verticalOffset: 0,
    verticalVelocity: 0.4,
  })

  result = step(result.store, 1, players)
  const landed = result.store.actors[0]!
  const landedBrain = landed.brain
  if (landedBrain.family !== 'imp') throw new Error('expected Imp brain')
  assert.equal(landedBrain.phase, 'flight')
  assert.ok(landedBrain.horizontalSpeed >= 4.5 && landedBrain.horizontalSpeed <= 11.25)
  assert.equal(landedBrain.effectAlpha, 1)
  assert.equal(landedBrain.verticalOffset, 0)
  assert.ok(landedBrain.verticalVelocity < 0)
  assert.notEqual(landedBrain.escapeHeadingDeg, null)
  assert.equal(landed.headingDeg, landedBrain.escapeHeadingDeg)
  assert.equal(landedBrain.visualRngState, expectedContactVisualRngState)
  assert.equal(result.playerDamage.length, 1)
  const marker = result.events.find(({ type }) => type === 'attack-marker')
  assert.equal(marker?.eventId, result.playerDamage[0]?.eventId)
  assert.deepEqual(marker?.painterRegistration, {
    managerLane: 'transient',
    registrationOrdinal: 0,
  })
  assert.deepEqual(result.events.map(({ type }) => type), [
    'enemy-action-sound',
    'enemy-action-sound',
    'attack-marker',
  ])
  const actionSounds = result.events.filter(({ type }) => type === 'enemy-action-sound')
  assert.equal(actionSounds.length, 2)
  assert.match(actionSounds[0]!.sound!, /^imp-vocal-[1-8]$/)
  assert.ok(actionSounds[0]!.pitch! >= 1 && actionSounds[0]!.pitch! <= 1.1)
  assert.match(actionSounds[1]!.sound!, /^bite-[1-3]$/)
  assert.ok(actionSounds[1]!.pitch! >= 1 && actionSounds[1]!.pitch! <= 1.25)

  const firstPosition = landed.position
  result = step(result.store, 2, players)
  assert.equal(result.playerDamage.length, 0)
  assert.notDeepEqual(result.store.actors[0]!.position, firstPosition)

  const outsideDistance = (25 + NATIVE_IMP_CONTACT_BASE_RADIUS)
    * NATIVE_IMP_CONTACT_RADIUS_SCALE + 0.01
  let outside = spawnOne(
    'imp-landing-outside-contact',
    'IMP',
    { x: 0, y: 0 },
    { player: livingTarget(outsideDistance, 0) },
  )
  const outsideBrain = outside.store.actors[0]!.brain
  if (outsideBrain.family !== 'imp') throw new Error('expected Imp brain')
  let expectedOutsideVisualRngState = outsideBrain.visualRngState
  for (let draw = 0; draw < 10; draw += 1) {
    expectedOutsideVisualRngState = nextBoneyardWaveRandom(expectedOutsideVisualRngState).state
  }
  outside = withActorBrain(outside, 0, {
    ...outsideBrain,
    verticalOffset: 0,
    verticalVelocity: 0.4,
  })
  outside = step(
    outside.store,
    1,
    { player: livingTarget(outsideDistance, 0) },
  )
  assert.equal(outside.playerDamage.length, 0)
  const outsideSteppedBrain = outside.store.actors[0]!.brain
  if (outsideSteppedBrain.family !== 'imp') throw new Error('expected Imp brain')
  assert.equal(outsideSteppedBrain.visualRngState, expectedOutsideVisualRngState)
  assert.equal(
    outside.events.filter(({ type }) => type === 'enemy-action-sound').length,
    1,
  )
})

test('Demon bomb keeps its action-entry facing and consumes raw FireBurst RNG first', () => {
  const players = { player: livingTarget(100, 0) }
  let result = spawnOne('demon-bomb-muzzle-rng', 'DEMON', { x: 0, y: 0 }, players)
  const brain = result.store.actors[0]!.brain
  if (brain.family !== 'demon') throw new Error('expected Demon brain')
  result = withActorBrain(result, 0, {
    ...brain,
    actionProgress: NATIVE_DEMON_BOMB_ACTION_PROGRAM.markerProgress
      - NATIVE_DEMON_BOMB_ACTION_PROGRAM.progressPerTick,
    markerEmitted: false,
    phase: 'bomb',
  })
  result = {
    ...result,
    store: {
      ...result.store,
      actors: [{ ...result.store.actors[0]!, headingDeg: 37 }],
    },
  }
  let expectedRngState = result.store.rngState
  for (let draw = 0; draw < 5; draw += 1) {
    expectedRngState = nextBoneyardWaveRandom(expectedRngState).state
  }

  result = step(result.store, 1, { player: livingTarget(0, 100) })
  assert.equal(result.store.rngState, expectedRngState)
  assert.deepEqual(result.events.map(({ type }) => type), [
    'attack-marker',
    'projectile-spawned',
  ])
  assert.equal(result.store.actors[0]?.headingDeg, 37)
  assert.equal(result.store.projectiles[0]?.kind, 'demon-bomb')
  assert.equal(result.store.projectiles[0]?.headingDeg, 37)
})

test('remaining action families keep separate approach, special, and cooldown states', () => {
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('bounded-families'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: { player: livingTarget(10, 0) },
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [
      intent('IMP', 1, { x: 0, y: 0 }),
      intent('ZOMBIE', 2, { x: 0, y: 0 }),
      intent('WRAITH', 3, { x: 0, y: 0 }),
      intent('DEMON', 4, { x: 0, y: 0 }),
      intent('COFFIN', 5, { x: 0, y: 0 }),
    ],
    tick: 0,
  })
  result = step(result.store, 1, { player: livingTarget(10, 0) })
  assert.deepEqual(result.store.actors.map((actor) => actor.brain.phase), [
    'flight',
    'swipe',
    'flight',
    'bomb',
    'hidden',
  ])
  const wraith = result.store.actors[2]!.brain
  assert.equal(wraith.family, 'wraith')
  if (wraith.family !== 'wraith') throw new Error('expected Wraith brain')
  assert.equal(wraith.contactCooldownTicks, 50)

  const damagedActorIds = new Set<number>(result.playerDamage.map(({ actorId }) => actorId))
  let tick = 2
  for (; tick <= 250 && result.store.projectiles.length === 0; tick += 1) {
    result = step(result.store, tick, { player: livingTarget(10, 0) })
    for (const damage of result.playerDamage) damagedActorIds.add(damage.actorId)
  }
  assert.ok(damagedActorIds.has(1))
  assert.deepEqual(result.store.projectiles.map((projectile) => [
    projectile.id,
    projectile.kind,
    projectile.nativeTypeId,
  ]), [[1, 'demon-bomb', 0x7f7]])
  assert.deepEqual(result.store.projectiles[0]!.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 5,
  })
  assert.ok(damagedActorIds.has(3), 'Wraith contact damages immediately')
})

test('GuidedMissile deterministically reacquires, homes, contacts, and retires', () => {
  let result = spawnOne(
    'guided-projectile',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    { alpha: livingTarget(150, 0) },
    ['FLAG_CASTFROST'],
  )
  let tick = 1
  for (; tick < 500 && result.store.projectiles.length === 0; tick += 1) {
    result = step(result.store, tick, { alpha: livingTarget(150, 0) })
  }
  assert.equal(result.store.projectiles[0]?.kind, 'guided-missile')
  assert.equal(result.store.projectiles[0]?.nativeTypeId, 0x7ec)
  assert.deepEqual(result.store.projectiles[0]?.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 1,
  })

  const redirectedPlayers: BoneyardEnemyTargets = {
    alpha: { ...livingTarget(150, 0), alive: false },
    beta: livingTarget(0, 100),
  }
  result = step(result.store, tick, redirectedPlayers)
  assert.equal(result.store.projectiles[0]!.targetPlayerId, 'beta')
  assert.equal(result.store.projectiles[0]!.position.x, 0)
  assert.equal(result.store.projectiles[0]!.position.y, 3)

  let impacted = false
  for (tick += 1; tick < 600 && !impacted; tick += 1) {
    result = step(result.store, tick, redirectedPlayers)
    const damage = result.playerDamage.find((entry) => entry.playerId === 'beta')
    if (!damage) continue
    impacted = true
    assert.equal(damage.amount, 6)
    assert.ok(result.events.some((event) => event.type === 'projectile-impact'))
  }
  assert.equal(impacted, true)
  assert.equal(result.store.projectiles.length, 0)
  assert.deepEqual(result.store.projectileEffects.map((effect) => ({
    blendMode: effect.blendMode,
    entry: effect.entry,
    kind: effect.kind,
    tint: effect.tint,
  })), [
    { blendMode: 'add', entry: 110, kind: 'guided-impact-main', tint: 0xffffff },
    { blendMode: 'add', entry: 110, kind: 'guided-impact-main', tint: 0xffffff },
    { blendMode: 'add', entry: 111, kind: 'guided-impact-aura-one', tint: 0x4080ff },
    { blendMode: 'add', entry: 112, kind: 'guided-impact-aura-two', tint: 0x4080ff },
  ])
  assert.ok(result.store.projectileEffects.every(({ alpha, scale }) => (
    alpha === 2 && scale === 2
  )))
})

test('enemy projectiles retire on an earlier static-world contact without damaging a player', () => {
  let result = spawnOne(
    'world-contact',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    { player: livingTarget(150, 0) },
    ['FLAG_CASTFROST'],
  )
  let tick = 1
  for (; tick < 500 && result.store.projectiles.length === 0; tick += 1) {
    result = step(result.store, tick, { player: livingTarget(150, 0) })
  }
  assert.equal(result.store.projectiles[0]?.kind, 'guided-missile')

  result = stepBoneyardEnemyStore(result.store, {
    firstProjectileWorldContact: () => 0.25,
    players: { player: livingTarget(150, 0) },
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick,
  })

  assert.deepEqual(result.playerDamage, [])
  assert.equal(result.store.projectiles.length, 0)
  const projectileEvents = result.events.filter((event) => (
    event.type === 'projectile-impact' || event.type === 'projectile-retired'
  ))
  assert.deepEqual(projectileEvents.map((event) => event.type), [
    'projectile-impact',
    'projectile-retired',
  ])
  assert.ok(projectileEvents.every((event) => event.targetPlayerId === null))
})

test('enemy projectile actor entry wins when it precedes a later world contact', () => {
  const players = { player: livingTarget(50, 0) }
  const spawned = forcedMageAttack(
    'swept-actor-before-world',
    ['FLAG_CASTFROST'],
  )
  assert.equal(spawned.store.projectiles[0]?.position.x, 0)

  const result = stepBoneyardEnemyStore(spawned.store, {
    firstProjectileWorldContact: () => 0.9,
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 51,
  })

  assert.deepEqual(result.playerDamage.map(({ amount, playerId }) => ({
    amount,
    playerId,
  })), [{ amount: 6, playerId: 'player' }])
  assert.equal(result.store.projectiles.length, 0)
  assert.equal(
    result.events.find((event) => event.type === 'projectile-impact')?.targetPlayerId,
    'player',
  )
})

test('Firebolt trail and impact VFX outlive the retired projectile on native clocks', () => {
  const spawned = forcedMageAttack('firebolt-vfx', ['FLAG_CASTFIRE'])
  const projectile = spawned.store.projectiles[0]!
  assert.equal(projectile.kind, 'firebolt')
  let expectedImpactRngState = spawned.store.rngState
  for (let draw = 0; draw < 9; draw += 1) {
    expectedImpactRngState = nextBoneyardWaveRandom(expectedImpactRngState).state
  }

  let result = stepBoneyardEnemyStore(spawned.store, {
    firstProjectileWorldContact: () => 1,
    players: { player: livingTarget(150, 0) },
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 3,
  })
  assert.equal(result.store.projectiles.length, 0)
  assert.equal(result.store.rngState, expectedImpactRngState)
  assert.deepEqual(result.store.projectileEffects.map(({ entry, kind }) => ({ entry, kind })), [
    { entry: 256, kind: 'firebolt-trail' },
    { entry: 110, kind: 'fire-burst-glow' },
    { entry: 251, kind: 'fire-burst-frame' },
  ])
  const burstGlow = result.store.projectileEffects.find(
    ({ kind }) => kind === 'fire-burst-glow',
  )!
  const burstFrame = result.store.projectileEffects.find(
    ({ kind }) => kind === 'fire-burst-frame',
  )!
  assert.deepEqual(burstGlow.lightRegistration, {
    managerLane: 'transient',
    registrationOrdinal: projectile.lightRegistration!.registrationOrdinal + 1,
  })
  assert.equal(burstFrame.lightRegistration, null)
  assert.deepEqual(burstGlow.position, burstFrame.position)
  assert.ok(burstFrame.scale >= 0.65 && burstFrame.scale <= 0.85)
  assert.equal(burstGlow.scale, burstFrame.scale * 5)

  result = step(result.store, 4, { player: livingTarget(150, 0) })
  const trail = result.store.projectileEffects.find(({ kind }) => kind === 'firebolt-trail')
  const impact = result.store.projectileEffects.find(({ kind }) => kind === 'fire-burst-frame')
  assert.ok(trail)
  assert.ok(impact)
  assert.equal(impact.entry, 251)
  assert.equal(impact.ageTicks, 1)
  assert.equal(trail.ageTicks, 2)
  assert.ok(trail.alpha > 0.6 && trail.alpha < 0.7)

  result = step(result.store, 7, { player: livingTarget(150, 0) })
  assert.equal(
    result.store.projectileEffects.find(({ kind }) => kind === 'fire-burst-frame')?.entry,
    252,
  )
  assert.equal(
    result.store.projectileEffects.some(({ kind }) => kind === 'firebolt-trail'),
    true,
  )

  result = step(result.store, 18, { player: livingTarget(150, 0) })
  assert.equal(
    result.store.projectileEffects.find(({ kind }) => kind === 'fire-burst-frame')?.entry,
    254,
  )
  result = step(result.store, 19, { player: livingTarget(150, 0) })
  assert.equal(
    result.store.projectileEffects.some(({ kind }) => kind === 'fire-burst-frame'),
    false,
  )
})

test('Coffin opening and open charge emit independently of the active Maggot cap', () => {
  let result = spawnOne(
    'coffin-program',
    'COFFIN',
    { x: 0, y: 0 },
    { player: livingTarget(10, 0) },
  )
  result = withCoffinMaximumMaggots(result, 0)
  result = withCoffinRemaining(result, 1)
  result = step(result.store, 1, { player: livingTarget(10, 0) })
  assert.equal(result.store.actors[0]!.brain.phase, 'rising')
  result = withCoffinRemaining(result, 1)
  result = step(result.store, 2, { player: livingTarget(10, 0) })
  const holding = result.store.actors[0]!.brain
  assert.equal(holding.family, 'coffin')
  if (holding.family !== 'coffin') throw new Error('expected Coffin brain')
  assert.ok(holding.phaseTicksRemaining >= 150 && holding.phaseTicksRemaining <= 299)
  result = withCoffinRemaining(result, 1)
  result = step(result.store, 3, { player: livingTarget(10, 0) })
  assert.equal(result.store.actors[0]!.brain.phase, 'opening')
  result = withCoffinRemaining(result, 1)
  result = step(result.store, 4, { player: livingTarget(10, 0) })
  assert.equal(result.store.actors[0]!.brain.phase, 'open')
  const release = result.events.find((event) => event.type === 'coffin-maggot-release')
  assert.equal(release?.count, 3)
  assert.equal(result.store.maggots.length, 3)
  assert.equal(boneyardEnemyLiveCount(result.store), 1)
  assert.equal(new Set(result.store.maggots.map((maggot) => maggot.id)).size, 3)
  assert.ok(result.store.maggots.every((maggot) => (
    (maggot as unknown as { movementPhase?: string }).movementPhase === 'emerging'
  )))
  const coffin = result.store.actors[0]!
  const coffinBrain = coffin.brain
  if (coffinBrain.family !== 'coffin') throw new Error('expected Coffin brain')
  assert.ok(result.store.maggots.every((maggot) => {
    const segment = maggot.launchTrajectory === 'edge'
      ? { end: { x: 15.5, y: -29.5 }, maximum: 200, minimum: 140, start: { x: 5.5, y: 8.5 } }
      : { end: { x: 5.5, y: -41.5 }, maximum: 330, minimum: 270, start: { x: -9.5, y: -4.5 } }
    const start = coffinLaunchPointForTest(segment.start, coffinBrain)
    const end = coffinLaunchPointForTest(segment.end, coffinBrain)
    const sourceHeading = coffinBrain.launchScale < 0
      ? positiveDegrees(360 - maggot.headingDeg)
      : maggot.headingDeg
    const localX = maggot.position.x - coffin.position.x
    const localY = maggot.position.y - coffin.position.y
    return sourceHeading >= segment.minimum
      && sourceHeading < segment.maximum
      && localX >= Math.min(start.x, end.x)
      && localX <= Math.max(start.x, end.x)
      && localY >= start.y - 8
      && localY <= start.y
      && Math.abs(Math.hypot(maggot.launchVelocity.x, maggot.launchVelocity.y) - 1) < 1e-12
      && maggot.emergencePhase >= 0
      && maggot.emergencePhase < 5
      && maggot.landingBounceVelocity >= -0.5
      && maggot.landingBounceVelocity <= 0
      && maggot.verticalVelocity === 0
  }))

  result = step(result.store, 5, FAR_PLAYERS)
  assert.equal(result.events.find((event) => event.type === 'coffin-maggot-release')?.count, 3)
  assert.equal(result.store.maggots.length, 6)
  assert.equal(boneyardEnemyLiveCount(result.store), 1)
  const opened = result.store.actors[0]!.brain
  assert.equal(opened.family, 'coffin')
  if (opened.family !== 'coffin') throw new Error('expected Coffin brain')
  assert.equal(opened.maggotCharge, Math.fround(0.025))

  result = withCoffinCharge(result, 10)
  const before = result.store.maggots.length
  result = step(result.store, 6, FAR_PLAYERS)
  assert.ok(result.store.maggots.length - before >= 0)
  assert.ok(result.store.maggots.length - before <= 1)
  const capped = result.store.actors[0]!.brain
  assert.equal(capped.family, 'coffin')
  if (capped.family !== 'coffin') throw new Error('expected Coffin brain')
  assert.equal(capped.maggotCharge, 10)
})

test('Coffin construction retains Maggot scale before the native Float(5) phase endpoint', () => {
  const result = openedCoffin('maggot-phase-endpoint-907', FAR_PLAYERS)
  const maggot = result.store.maggots.find(({ id }) => id === 3)
  assert.ok(maggot)
  assert.equal(maggot.visualScale, 1.1695511061116122)
  assert.equal(maggot.emergencePhase, 4.999967237235978)
  assert.equal(Math.round(maggot.emergencePhase * 1024), 5 * 1024)
})

test('Maggot landing owns 1-in-5 combat admission and a 30-inactive ceiling', () => {
  let result = openedCoffin('maggot-admission', FAR_PLAYERS)
  result = freezeOpenedCoffin(withCoffinMaximumMaggots(result, 1))
  result = {
    ...result,
    store: {
      ...result.store,
      maggots: result.store.maggots.map((maggot) => ({
        ...maggot,
        landingBounceVelocity: -0.4,
        verticalOffset: -0.01,
        verticalVelocity: 1,
      })),
      rngState: boneyardIntegerState(5, 3),
    },
  }
  result = step(result.store, 5, FAR_PLAYERS)
  assert.equal(result.store.maggots.filter(({ combatActive }) => combatActive).length, 1)
  assert.equal(result.store.maggots.filter(({ combatActive }) => !combatActive).length, 2)
  assert.equal(result.store.maggots.filter(({ combatActive }) => combatActive)[0]?.targetPlayerId, 'player')
  assert.ok(result.store.maggots.filter(({ combatActive }) => !combatActive).every(
    ({ targetPlayerId }) => targetPlayerId === null,
  ))

  result = openedCoffin('maggot-inactive-ceiling', FAR_PLAYERS)
  result = freezeOpenedCoffin(withCoffinMaximumMaggots(result, 0))
  const template = result.store.maggots[0]!
  result = {
    ...result,
    store: {
      ...result.store,
      maggots: Array.from({ length: 31 }, (_, index) => ({
        ...template,
        id: 10_000 + index,
        nativeCellBindingOrder: 10_000 + index,
        nativeRegistrationOrder: 10_000 + index,
        landingBounceVelocity: -0.4,
        verticalOffset: -0.01,
        verticalVelocity: 1,
      })),
    },
  }
  result = step(result.store, 5, FAR_PLAYERS)
  assert.equal(result.store.maggots.length, 30)
  assert.ok(result.store.maggots.every(({ combatActive }) => !combatActive))
  assert.deepEqual(result.retired.map(({ actorId }) => actorId), [10_030])
  assert.equal(boneyardEnemyLiveCount(result.store), 1)
})

test('combat Maggot crawl joins the ordinary blocked-goal route owner', () => {
  const players = { player: livingTarget(500, 0) }
  let result = freezeOpenedCoffin(openedCoffin('maggot-shared-route', players))
  const source = result.store.maggots[0]!
  result = {
    ...result,
    store: {
      ...result.store,
      maggots: [{
        ...source,
        combatActive: true,
        movementPhase: 'crawl',
        nextMovementTick: 0,
        targetPlayerId: 'player',
        verticalOffset: 0,
        verticalVelocity: 0,
      }],
    },
  }
  const clearances: number[] = []
  result = stepBoneyardEnemyStore(result.store, {
    clipSpellSegment: CLEAR_SPELL_SEGMENT,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    navigation: {
      findRoute: ({ end, navigationClearance, start }) => {
        clearances.push(navigationClearance)
        return [start, { x: 0, y: 75 }, { x: 75, y: 75 }, end]
      },
      isPathClear: () => false,
    },
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 100,
  })
  assert.deepEqual(clearances, [25])
  assert.deepEqual(result.store.maggots[0]!.path.routeWaypoints, [
    { x: 0, y: 75 },
    { x: 75, y: 75 },
  ])
})

test('a crawling Maggot bites once, enters death, and cannot damage again', () => {
  let result = freezeOpenedCoffin(
    openedCoffin('one-bite-maggot', { player: livingTarget(10, 0) }),
  )
  const tick = 5
  const source = result.store.maggots[0]!
  result = {
    ...result,
    store: {
      ...result.store,
      maggots: [{
        ...source,
        combatActive: true,
        movementPhase: 'crawl',
        nextAttackTick: tick,
        position: { x: 0, y: 0 },
        verticalOffset: 0,
      }],
    },
  }

  result = step(result.store, tick, { player: livingTarget(10, 0) })
  assert.deepEqual(result.playerDamage.map((damage) => damage.playerId), ['player'])
  assert.equal(result.store.maggots[0]!.lifeState, 'dying')
  result = step(result.store, tick + 1, { player: livingTarget(10, 0) })
  assert.deepEqual(result.playerDamage, [])
})

test('Maggots retire immediately when their Coffin ownership becomes invalid', () => {
  let result = openedCoffin('invalid-maggot-owner', FAR_PLAYERS)
  const coffin = result.store.actors[0]!
  const childIds = result.store.maggots.map((maggot) => maggot.id)
  const damaged = damageBoneyardEnemy(result.store, {
    actorId: coffin.id,
    amount: coffin.currentHealth,
    sourcePlayerId: 'player',
    tick: 4,
  })

  result = step(damaged.store, 5, FAR_PLAYERS)

  assert.equal(result.store.actors.some(({ id }) => id === coffin.id), false)
  assert.equal(
    result.store.maggots.some(({ id }) => childIds.includes(id)),
    false,
  )
  assert.deepEqual(result.retired.map((retirement) => retirement.actorId), [
    coffin.id,
    ...childIds,
  ])
})

test('player-killed Maggot retires once and hands off to independent effects', () => {
  let result = spawnOne(
    'player-killed-maggot',
    'COFFIN',
    { x: 0, y: 0 },
    FAR_PLAYERS,
  )
  for (let tick = 1; tick <= 4; tick += 1) {
    result = withCoffinRemaining(result, 1)
    result = step(result.store, tick, FAR_PLAYERS)
  }
  result = freezeOpenedCoffin(result)
  const maggot = {
    ...result.store.maggots[0]!,
    combatActive: true,
    movementPhase: 'crawl' as const,
    verticalOffset: 0,
  }
  result = {
    ...result,
    store: { ...result.store, maggots: [maggot] },
  }
  assert.ok(maggot.deathOffsets.length <= 2)
  assert.ok(maggot.deathOffsets.every((offset) => Math.hypot(offset.x, offset.y) < 30))
  const damaged = damageBoneyardEnemy(result.store, {
    actorId: maggot.id,
    amount: maggot.currentHealth,
    sourcePlayerId: 'player',
    tick: 4,
  })
  assert.equal(damaged.accepted, true)
  assert.equal(damaged.killed, true)

  result = step(damaged.store, 5, FAR_PLAYERS)
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'enemy-death')
      .map((event) => event.actorId),
    [maggot.id],
  )
  assert.deepEqual(result.retired.map((retirement) => retirement.actorId), [maggot.id])
  assert.equal(result.store.maggots.some(({ id }) => id === maggot.id), false)
  const effects = result.store.deathEffects.filter(
    ({ ownerActorId }) => ownerActorId === maggot.id,
  )
  assert.equal(effects.length, (1 + maggot.deathOffsets.length) * 2)
  assert.equal(effects.filter(({ kind }) => kind === 'bouncer').length, 1 + maggot.deathOffsets.length)
  assert.equal(
    effects.filter(({ kind }) => kind === 'fade-perspective').length,
    1 + maggot.deathOffsets.length,
  )
  const sounds = result.events.filter(({ type }) => type === 'enemy-death-sound')
  assert.equal(sounds.length, 2)
  assert.ok(sounds[0]!.sound?.startsWith('maggot-squish-'))
  assert.ok(sounds[1]!.sound?.startsWith('maggot-squeak-'))
  assert.ok(sounds.every(({ pitch }) => pitch !== undefined && pitch >= 1 && pitch < 1.2))
  assert.equal(sounds[0]!.gainScale, 1)
  assert.ok(sounds[1]!.gainScale! >= 0.25 && sounds[1]!.gainScale! < 0.5)

  result = step(result.store, 6, FAR_PLAYERS)
  assert.equal(result.events.filter((event) => event.type === 'enemy-death').length, 0)
  assert.equal(result.retired.length, 0)

})

test('wave, Imp, and Demon materialization resolve each evaluated collision radius', () => {
  const placementRequests: BoneyardEnemyMovementRequest[] = []
  const resolveMovement = (request: BoneyardEnemyMovementRequest) => {
    if (request.purpose === 'spawn-placement') placementRequests.push(request)
    return request.requestedPosition
  }
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('terminal-children'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement,
    resolveSpawnIntents: () => [
      intent('IMP', 1, { x: 0, y: 0 }, ['FLAG_SPLIT']),
      intent('DEMON', 2, { x: 100, y: 0 }, ['FLAG_DEATHIMPS']),
    ],
    tick: 0,
  })
  let store = result.store
  for (const actor of store.actors) {
    store = damageBoneyardEnemy(store, {
      actorId: actor.id,
      amount: actor.currentHealth,
      sourcePlayerId: 'player',
      tick: 0,
    }).store
  }

  result = stepBoneyardEnemyStore(store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement,
    resolveSpawnIntents: () => [],
    tick: 1,
  })
  const impStep = result
  const recursiveChildren = impStep.store.actors.filter(
    (actor) => actor.lifeState === 'alive',
  )
  result = stepBoneyardEnemyStore(impStep.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement,
    resolveSpawnIntents: () => [],
    tick: 100,
  })
  const children = result.store.actors.filter((actor) => actor.lifeState === 'alive')
  const impParent = store.actors.find((actor) => actor.config.enemyToken === 'IMP')!
  const demonParent = store.actors.find((actor) => actor.config.enemyToken === 'DEMON')!
  if (impParent.config.enemyToken !== 'IMP') throw new Error('expected Imp config')
  assert.equal(children.length, NATIVE_IMP_SPLIT_CHILD_COUNT + 5)
  assert.ok(children.every((actor) => actor.config.enemyToken === 'IMP'))
  assert.equal(placementRequests.length, 2 + NATIVE_IMP_SPLIT_CHILD_COUNT + 5)
  for (const request of placementRequests) {
    const actor = [...store.actors, ...impStep.store.actors, ...result.store.actors]
      .find(({ id }) => id === request.actorId)
    assert.ok(actor)
    assert.equal(request.radius, actor.config.collisionRadius)
  }
  assert.deepEqual(
    [...impStep.spawnedActorIds, ...result.spawnedActorIds],
    children.map((actor) => actor.id),
  )
  assert.equal(new Set(children.map((actor) => actor.id)).size, children.length)
  assert.deepEqual(recursiveChildren.map((child) => child.position), [
    impParent.position,
    impParent.position,
  ])
  assert.deepEqual(recursiveChildren.map((child) => child.headingDeg), [
    (impParent.headingDeg + 270) % 360,
    (impParent.headingDeg + 90) % 360,
  ])
  const terminalOutputs = [...impStep.events, ...result.events].filter(
    (event) => event.type === 'enemy-terminal-output',
  )
  assert.deepEqual(terminalOutputs.map(({ actorId, count, output }) => ({
    actorId,
    count,
    output,
  })), [
    { actorId: impParent.id, count: NATIVE_IMP_SPLIT_CHILD_COUNT, output: 'imp-split' },
    { actorId: demonParent.id, count: 5, output: 'demon-split' },
  ])
  assert.equal(
    terminalOutputs.reduce((count, event) => count + (event.count ?? 0), 0),
    impStep.spawnedActorIds.length + result.spawnedActorIds.length,
  )
  for (const output of terminalOutputs) {
    const childIds = output.actorId === impParent.id
      ? recursiveChildren.map(({ id }) => id)
      : children.slice(NATIVE_IMP_SPLIT_CHILD_COUNT).map(({ id }) => id)
    const events = output.actorId === impParent.id ? impStep.events : result.events
    assert.ok(events
      .filter((event) => event.type === 'enemy-spawned' && childIds.includes(event.actorId))
      .every((event) => event.eventId > output.eventId))
  }
})

test('both Imp descendants inherit one fewer split generation until recursion terminates', () => {
  let result = spawnOne(
    'recursive-imp-split',
    'IMP',
    { x: 0, y: 0 },
    FAR_PLAYERS,
    ['FLAG_SPLIT'],
  )
  const parent = result.store.actors[0]!
  if (parent.config.enemyToken !== 'IMP') throw new Error('expected Imp config')
  result = {
    ...result,
    store: {
      ...result.store,
      actors: [{
        ...parent,
        config: {
          ...parent.config,
          family: { ...parent.config.family, splitDepth: 2 },
        },
      }],
    },
  }
  let store = damageBoneyardEnemy(result.store, {
    actorId: parent.id,
    amount: parent.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  }).store

  result = step(store, 1, FAR_PLAYERS)
  const children = result.store.actors.filter((actor) => actor.lifeState === 'alive')
  assert.equal(children.length, 2)
  assert.ok(children.every((child) => (
    child.config.enemyToken === 'IMP' && child.config.family.splitDepth === 1
  )))

  const child = children[0]!
  store = damageBoneyardEnemy(result.store, {
    actorId: child.id,
    amount: child.currentHealth,
    sourcePlayerId: 'player',
    tick: 1,
  }).store
  result = step(store, 2, FAR_PLAYERS)
  assert.equal(result.spawnedActorIds.length, NATIVE_IMP_SPLIT_CHILD_COUNT)
  const output = result.events.find((event) => (
    event.type === 'enemy-terminal-output' && event.actorId === child.id
  ))
  assert.equal(output?.count, NATIVE_IMP_SPLIT_CHILD_COUNT)
  assert.equal(output?.count, result.spawnedActorIds.length)
  assert.ok(result.events
    .filter((event) => event.type === 'enemy-spawned')
    .every((event) => event.eventId > output!.eventId))
  const grandchildren = result.store.actors.filter(({ id }) => (
    result.spawnedActorIds.includes(id)
  ))
  assert.ok(grandchildren.every((grandchild) => (
    grandchild.config.enemyToken === 'IMP' && grandchild.config.family.splitDepth === 0
  )))
})

test('SPLITMANY terminal count reports binary fan-out while the live guard reports zero', () => {
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('split-many-output-count'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [{
      ...intent('IMP', 1, { x: 0, y: 0 }, ['FLAG_SPLITMANY']),
      waveOrdinal: 35,
    }],
    tick: 0,
  })
  const splitManyParent = result.store.actors[0]!
  if (splitManyParent.config.enemyToken !== 'IMP') throw new Error('expected Imp config')
  assert.ok(splitManyParent.config.family.splitDepth > NATIVE_IMP_SPLIT_CHILD_COUNT)
  let store = damageBoneyardEnemy(result.store, {
    actorId: splitManyParent.id,
    amount: splitManyParent.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  }).store
  result = step(store, 1, FAR_PLAYERS)
  const splitManyOutput = result.events.find((event) => event.type === 'enemy-terminal-output')
  assert.equal(splitManyOutput?.count, NATIVE_IMP_SPLIT_CHILD_COUNT)
  assert.equal(splitManyOutput?.count, result.spawnedActorIds.length)
  assert.ok(result.events
    .filter((event) => event.type === 'enemy-spawned')
    .every((event) => event.eventId > splitManyOutput!.eventId))

  result = stepBoneyardEnemyStore(createBoneyardEnemyStore('split-guard-output-count'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => Array.from({ length: 69 }, (_, index) => intent(
      'IMP',
      index + 1,
      { x: index * 2, y: 0 },
      index === 0 ? ['FLAG_SPLIT'] : [],
    )),
    tick: 0,
  })
  assert.equal(
    result.store.actors.filter(({ config }) => config.enemyToken === 'IMP').length,
    NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM + 1,
  )
  const guardedParent = result.store.actors[0]!
  if (guardedParent.config.enemyToken !== 'IMP') throw new Error('expected Imp config')
  assert.ok(guardedParent.config.family.splitDepth > 0)
  store = damageBoneyardEnemy(result.store, {
    actorId: guardedParent.id,
    amount: guardedParent.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  }).store
  result = step(store, 1, FAR_PLAYERS)
  const guardedOutput = result.events.find((event) => event.type === 'enemy-terminal-output')
  assert.equal(guardedOutput?.count, 0)
  assert.equal(guardedOutput?.count, result.spawnedActorIds.length)
})

test('Demon terminal count reports only child Imps accepted beneath the construction cap', () => {
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('demon-clipped-output-count'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [
      ...Array.from({ length: 69 }, (_, index) => intent(
        'IMP',
        index + 1,
        { x: index * 2, y: 0 },
      )),
      intent('DEMON', 70, { x: 200, y: 0 }, ['FLAG_DEATHIMPS']),
    ],
    tick: 0,
  })
  const demon = result.store.actors.find((actor) => actor.config.enemyToken === 'DEMON')!
  assert.equal(
    result.store.actors.filter(({ config }) => config.enemyToken === 'IMP').length,
    NATIVE_IMP_CONSTRUCTION_MAXIMUM - 1,
  )
  if (demon.config.enemyToken !== 'DEMON') throw new Error('expected Demon config')
  assert.equal(demon.config.family.splitCount, 5)
  const store = damageBoneyardEnemy(result.store, {
    actorId: demon.id,
    amount: demon.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  }).store
  result = step(store, 100, FAR_PLAYERS)
  const output = result.events.find((event) => event.type === 'enemy-terminal-output')
  assert.equal(output?.count, 1)
  assert.equal(output?.count, result.spawnedActorIds.length)
  assert.ok(result.events
    .filter((event) => event.type === 'enemy-spawned')
    .every((event) => event.eventId > output!.eventId))
})

test('retail wave 35 and 42 recursive deaths obey native Imp caps and protocol capacity', () => {
  const protocolActorCapacity = 8192
  assert.equal(NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM, 68)
  assert.equal(NATIVE_IMP_CONSTRUCTION_MAXIMUM, 70)
  const scenarios = [
    { groupRepeats: 20, waveOrdinal: 35 },
    { groupRepeats: 15, waveOrdinal: 42 },
  ] as const

  for (const { groupRepeats, waveOrdinal } of scenarios) {
    const spawnIntents: BoneyardEnemySpawnIntent[] = []
    let intentId = 1
    for (let group = 0; group < groupRepeats; group += 1) {
      if (waveOrdinal === 42) {
        spawnIntents.push({
          ...intent('DEMON', intentId, { x: group * 4, y: 0 }, ['FLAG_DEATHIMPSMANY']),
          waveOrdinal,
        })
        intentId += 1
      }
      const splitManyPerGroup = waveOrdinal === 42 ? 4 : 1
      for (let index = 0; index < splitManyPerGroup; index += 1) {
        spawnIntents.push({
          ...intent('IMP', intentId, { x: group * 4, y: index * 4 }, ['FLAG_SPLITMANY']),
          waveOrdinal,
        })
        intentId += 1
      }
    }

    let result = stepBoneyardEnemyStore(createBoneyardEnemyStore(`wave-${waveOrdinal}-cap`), {
      firstProjectileWorldContact: NO_WORLD_CONTACT,
      players: FAR_PLAYERS,
      resolveMovement: DIRECT_MOVEMENT,
      resolveSpawnIntents: () => spawnIntents,
      tick: 0,
    })
    let tick = 0
    let maximumActors = result.store.actors.length
    let maximumImps = result.store.actors.filter(({ config }) => config.enemyToken === 'IMP').length
    let sawReducedRecursiveChild = false

    for (let generation = 0; generation < 8; generation += 1) {
      const killable = result.store.actors.filter(({ lifeState }) => lifeState === 'alive')
      if (killable.length === 0) break
      const parentDepths = new Map(killable.flatMap((actor) => (
        actor.config.enemyToken === 'IMP'
          ? [[actor.id, actor.config.family.splitDepth] as const]
          : []
      )))
      let store = result.store
      for (const actor of killable) {
        store = damageBoneyardEnemy(store, {
          actorId: actor.id,
          amount: actor.currentHealth,
          sourcePlayerId: 'player',
          tick,
        }).store
      }
      tick += 1
      result = step(store, tick, FAR_PLAYERS)
      for (const actor of result.store.actors) {
        const config = actor.config
        if (!result.spawnedActorIds.includes(actor.id) || config.enemyToken !== 'IMP') continue
        sawReducedRecursiveChild ||= [...parentDepths.values()].some((depth) => (
          depth > 0 && config.family.splitDepth === depth - 1
        ))
      }
      maximumActors = Math.max(maximumActors, result.store.actors.length)
      maximumImps = Math.max(
        maximumImps,
        result.store.actors.filter(({ config }) => config.enemyToken === 'IMP').length,
      )
      assert.ok(maximumImps <= NATIVE_IMP_CONSTRUCTION_MAXIMUM)
      assert.ok(maximumActors < protocolActorCapacity)

      tick += 100
      result = step(result.store, tick, FAR_PLAYERS)
      maximumActors = Math.max(maximumActors, result.store.actors.length)
    }

    if (waveOrdinal === 35) assert.equal(sawReducedRecursiveChild, true)
    assert.ok(maximumImps >= NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM)
    assert.ok(maximumImps <= NATIVE_IMP_CONSTRUCTION_MAXIMUM)
    assert.ok(maximumActors < protocolActorCapacity)
  }
})

test('lethal damage rewards and terminal outputs once, then hands off to effect actors', () => {
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('death'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => TOKENS.map((token, index) => intent(
      token,
      index + 1,
      { x: index * 10, y: 0 },
      token === 'ZOMBIE' ? ['FLAG_ROTTEN'] : [],
    )),
    tick: 0,
  })
  let store = result.store
  const expectedLootSources = store.actors.map(({ config, id, lootSeed, position }) => ({
    actorId: id,
    lootSource: {
      actorSeed: lootSeed,
      enemyToken: config.enemyToken,
      onDeathProgram: null,
      participantSlot: 0,
      position,
    },
  }))
  for (const actor of store.actors) {
    const damaged = damageBoneyardEnemy(store, {
      actorId: actor.id,
      amount: actor.currentHealth,
      sourcePlayerId: 'player',
      tick: 0,
    })
    assert.equal(damaged.accepted, true)
    assert.equal(damaged.killed, true)
    store = damaged.store
  }
  assert.equal(boneyardEnemyLiveCount(store), 8)
  assert.deepEqual(store.actors.map((actor) => actor.deathEpoch), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.ok(store.actors.every((actor) => actor.lastDamageTick === 0))
  const demonId = store.actors.find(({ config }) => config.enemyToken === 'DEMON')!.id

  result = step(store, 1, FAR_PLAYERS)
  assert.equal(result.rewards.length, 7)
  assert.deepEqual(result.rewards.map((reward) => reward.experience), [
    200, 2, 10, 10, 10, 4, 210,
  ])
  assert.deepEqual(result.rewards.map(({ actorId, lootSource }) => ({
    actorId,
    lootSource,
  })), expectedLootSources.filter(({ actorId }) => actorId !== demonId))
  assert.equal(result.events.filter((event) => event.type === 'enemy-death').length, 7)
  assert.equal(result.events.filter((event) => event.type === 'enemy-terminal-output').length, 7)
  assert.deepEqual(result.store.projectiles.map((projectile) => [
    projectile.id,
    projectile.kind,
    projectile.nativeTypeId,
  ]), [[1, 'poison-pool', 0x806]])
  assert.equal(result.store.projectiles[0]!.lightRegistration, null)
  assert.equal(boneyardEnemyLiveCount(result.store), 1)
  assert.equal(result.retired.length, 7)
  assert.ok(result.store.deathEffects.length > 8)

  result = step(result.store, 2, FAR_PLAYERS)
  assert.equal(result.rewards.length, 0)
  assert.equal(result.events.filter((event) => event.type === 'enemy-death').length, 0)
  result = step(result.store, 50, FAR_PLAYERS)
  assert.equal(result.rewards.length, 0)
  assert.equal(result.retired.length, 0)

  result = step(result.store, 95, FAR_PLAYERS)
  assert.equal(result.rewards.length, 0)
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'enemy-death-sound')
      .map(({ sound }) => sound),
    ['flash', 'demon-die'],
  )
  assert.equal(boneyardEnemyLiveCount(result.store), 1)

  result = step(result.store, 100, FAR_PLAYERS)
  assert.deepEqual(result.rewards.map(({ actorId, experience, lootSource }) => ({
    actorId,
    experience,
    lootSource,
  })), [{
    ...expectedLootSources.find(({ actorId }) => actorId === demonId)!,
    experience: 800,
  }])
  assert.equal(result.events.filter((event) => event.type === 'enemy-death').length, 1)
  assert.equal(result.events.filter((event) => event.type === 'enemy-terminal-output').length, 1)
  assert.deepEqual(result.retired.map(({ actorId }) => actorId), [demonId])
  assert.equal(boneyardEnemyLiveCount(result.store), 0)

  result = step(result.store, 3_001, FAR_PLAYERS)
  assert.equal(result.store.projectiles.length, 0)
  assert.deepEqual(result.store.projectileEffects.map((effect) => ({
    alpha: effect.alpha,
    blendMode: effect.blendMode,
    entry: effect.entry,
    kind: effect.kind,
    scale: effect.scale,
  })), [{
    alpha: 0.5,
    blendMode: 'normal',
    entry: 0,
    kind: 'poison-pool-fade-outer',
    scale: 1.6,
  }, {
    alpha: Math.sin(3_000 * Math.PI / 180) * 0.25 + 0.75,
    blendMode: 'normal',
    entry: 0,
    kind: 'poison-pool-fade-inner',
    scale: 1.2,
  }])

  result = step(result.store, 3_002, FAR_PLAYERS)
  const [outer, inner] = result.store.projectileEffects
  assert.ok(outer)
  assert.ok(inner)
  assert.ok(Math.abs(outer.alpha - 0.4975) < 1e-12)
  assert.ok(Math.abs(
    inner.alpha
      - (Math.sin(3_001 * Math.PI / 180) * 0.25 + 0.75) * 0.995,
  ) < 1e-12)
})

test('Skeleton death hands off immediately to exact independent shatter actors', () => {
  let result = spawnOne('native-skeleton-shatter', 'SKELETON', { x: 100, y: 200 }, FAR_PLAYERS)
  const actor = result.store.actors[0]!
  const damaged = damageBoneyardEnemy(result.store, {
    actorId: actor.id,
    amount: actor.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  })
  assert.deepEqual(damaged.events.map(({ sound }) => sound), ['bone-crack'])
  result = step(damaged.store, 1, FAR_PLAYERS)

  assert.equal(result.store.actors.length, 0)
  assert.equal(result.retired.length, 1)
  assert.equal(result.store.deathEffects.length, 20)
  assert.deepEqual(
    result.store.deathEffects.filter(({ kind }) => kind === 'bouncer').map(({ entry }) => entry)
      .sort((first, second) => first - second),
    [113, 113, 113, 115, 116, 116, 117, 117, 117, 117, 117, 118, 119, 119,
      120, 120, 121, 121, result.store.deathEffects
      .find(({ role }) => role === 'skeleton-skull')!.entry].sort((first, second) => first - second),
  )
  assert.ok(result.store.deathEffects
    .filter(({ kind }) => kind === 'bouncer')
    .every(({ opacityTimer, shadow }) => (
      Math.abs(opacityTimer - 9.985) < 1e-12 && shadow
    )))
  const star = result.store.deathEffects.find(({ kind }) => kind === 'unbind')
  assert.ok(star)
  assert.equal(star.atlas, 'BadGuys')
  assert.equal(star.entry, 86)
  assert.equal(star.alpha, 0.75)
  assert.equal(star.alphaLossPerTick, 0.0225)
  assert.deepEqual(star.position, { x: 101, y: 185 })
  assert.equal(new Set(result.store.deathEffects.map(({ id }) => id)).size, 20)

  const before = result.store.deathEffects.find(({ kind }) => kind === 'bouncer')!
  result = step(result.store, 2, FAR_PLAYERS)
  const after = result.store.deathEffects.find(({ id }) => id === before.id)!
  assert.notDeepEqual(after.position, before.position)
  assert.notEqual(after.height, before.height)
  assert.notEqual(after.rotationDeg, before.rotationDeg)
  assert.ok(result.store.deathEffects.every(({ ownerActorId }) => ownerActorId === actor.id))
})

test('family Unbind stars use the exact primary-only clocks', () => {
  const expected = [
    ['SKELETON', 0.75, 0.0225],
    ['SKELETONARCHER', 0.75, 0.0225],
    ['SKELETONMAGE', 0.75, 0.0225],
    ['IMP', 1, 0.025],
    ['ZOMBIE', 0.75, 0.05],
    ['WRAITH', 1, 0.025],
    ['COFFIN', 0.75, 0.045],
  ] as const

  for (const [token, alpha, alphaLossPerTick] of expected) {
    const result = killOneAndStep(`unbind-${token}`, token)
    const unbind = result.store.deathEffects.find(({ kind }) => kind === 'unbind')
    assert.ok(unbind, `${token} did not create Unbind`)
    assert.equal(unbind.alpha, alpha)
    assert.equal(unbind.opacityTimer, alpha)
    assert.equal(unbind.alphaLossPerTick, alphaLossPerTick)
  }
  assert.equal(
    killOneAndStep('unbind-demon-control', 'DEMON').store.deathEffects
      .some(({ kind }) => kind === 'unbind'),
    false,
  )
})

test('Wraith dissolve keeps the shared additive BadGuys-20 FadeScale core', () => {
  const result = killOneAndStep('wraith-fade-scale-core', 'WRAITH')
  const core = result.store.deathEffects.find(
    ({ role }) => role === 'wraith-dissolve-core',
  )
  assert.ok(core)
  assert.deepEqual(
    { atlas: core.atlas, blendMode: core.blendMode, entry: core.entry },
    { atlas: 'BadGuys', blendMode: 'add', entry: 20 },
  )
})

test('every survival family assembles its native terminal animation classes', () => {
  for (const token of ['SKELETON', 'SKELETONARCHER', 'SKELETONMAGE'] as const) {
    const skeletonFamily = killOneAndStep(`terminal-classes-${token}`, token)
    assert.equal(skeletonFamily.store.deathEffects.filter(
      ({ role }) => role === 'skeleton-bone',
    ).length, 18)
    assert.equal(skeletonFamily.store.deathEffects.filter(
      ({ role }) => role === 'skeleton-skull',
    ).length, 1)
    const unbind = skeletonFamily.store.deathEffects.find(
      ({ role }) => role === 'death-unbind-star',
    )!
    assert.equal(unbind.presentationOwner, 'direct-post-world')
    assert.equal(unbind.painterRegistration, null)
  }

  const ordinaryImp = killOneAndStep('terminal-classes-imp', 'IMP')
  const ordinaryBanish = ordinaryImp.store.deathEffects.find(
    ({ role }) => role === 'imp-banish',
  )!
  const ordinaryArray = ordinaryImp.store.deathEffects.find(
    ({ role }) => role === 'imp-sprite-array',
  )!
  assert.deepEqual(
    {
      banishScale: ordinaryBanish.scale,
      banishTicks: ordinaryBanish.lifetimeTicks,
      frameDamping: ordinaryArray.frameVelocityDamping,
      frameVelocity: ordinaryArray.frameVelocity,
      owner: ordinaryArray.presentationOwner,
      painter: ordinaryArray.painterRegistration,
      spriteScale: ordinaryArray.scale,
    },
    {
      banishScale: 1,
      banishTicks: 100,
      frameDamping: 0.98,
      frameVelocity: 0.5,
      owner: 'pre-world-queue',
      painter: null,
      spriteScale: 2,
    },
  )

  const splitImp = killOneAndStep('terminal-classes-split-imp', 'IMP', ['FLAG_SPLIT'])
  const splitBanish = splitImp.store.deathEffects.find(({ role }) => role === 'imp-banish')!
  const splitArray = splitImp.store.deathEffects.find(
    ({ role }) => role === 'imp-sprite-array',
  )!
  assert.deepEqual(
    {
      banishScale: splitBanish.scale,
      banishTicks: splitBanish.lifetimeTicks,
      frameVelocity: splitArray.frameVelocity,
      spriteScale: splitArray.scale,
    },
    { banishScale: 0.25, banishTicks: 25, frameVelocity: 2, spriteScale: 0.5 },
  )

  const zombie = killOneAndStep('terminal-classes-zombie', 'ZOMBIE')
  const zombieFragments = zombie.store.deathEffects.filter(
    ({ role }) => role === 'zombie-fragment',
  )
  assert.deepEqual(
    zombieFragments.map(({ entry }) => entry).sort((first, second) => first - second),
    [
      2089,
      2090, 2090, 2090,
      2091, 2091, 2091,
      2092,
      2093, 2093,
      2094, 2094,
    ],
  )
  assert.equal(zombieFragments.some(({ entry }) => entry === 2088), false)
  assert.equal(zombie.store.deathEffects.filter(
    ({ role }) => role === 'zombie-gait-fragment',
  ).length, 1)
  assert.equal(zombie.store.deathEffects.filter(
    ({ kind }) => kind === 'fade-perspective-clipped',
  ).length, 1)

  const rotten = killOneAndStep(
    'terminal-classes-rotten-zombie',
    'ZOMBIE',
    ['FLAG_ROTTEN'],
  )
  assert.equal(rotten.store.deathEffects.filter(
    ({ role }) => role === 'zombie-fragment',
  ).length, 22)
  const lateSplats = rotten.store.deathEffects.filter(
    ({ kind }) => kind === 'late-splat',
  )
  assert.ok(lateSplats.length >= 6 && lateSplats.length <= 10)
  assert.ok(lateSplats.every(({ painterRegistration, presentationOwner }) => (
    painterRegistration === null && presentationOwner === 'pre-world-queue'
  )))

  const wraith = killOneAndStep('terminal-classes-wraith', 'WRAITH')
  assert.equal(wraith.store.deathEffects.filter(
    ({ role }) => role.startsWith('wraith-dissolve-ray:'),
  ).length, 12)
  assert.equal(wraith.store.deathEffects.filter(
    ({ role }) => role.startsWith('wraith-dissolve-bouncer:'),
  ).length, 12)
  assert.equal(wraith.store.deathEffects.filter(
    ({ role }) => role === 'wraith-smoky-fragment',
  ).length, 18)
  assert.equal(wraith.store.deathEffects.filter(
    ({ role }) => role === 'wraith-skull',
  ).length, 1)
  assert.ok(wraith.store.deathEffects
    .filter(({ kind }) => kind === 'bouncer' || kind === 'smoky-bouncer')
    .every(({ lastStepTick, opacityTimer }) => lastStepTick === 1 && opacityTimer < 10))

  const coffin = killOneAndStep('terminal-classes-coffin', 'COFFIN')
  assert.equal(coffin.store.deathEffects.filter(
    ({ role }) => role === 'coffin-bone',
  ).length, 18)
  const mainFragments = coffin.store.deathEffects.filter(
    ({ role }) => role.startsWith('coffin-main-fragment:'),
  )
  assert.ok(mainFragments.length >= 40 && mainFragments.length <= 50)
  const extraFragments = coffin.store.deathEffects.filter(
    ({ role }) => role.startsWith('coffin-extra-fragment:'),
  )
  assert.ok(extraFragments.length >= 12 && extraFragments.length <= 15)
  assert.ok([...mainFragments, ...extraFragments].every(({ bounceVelocity }) => (
    bounceVelocity <= -4 && bounceVelocity > -10
  )))
  assert.equal(coffin.store.deathEffects.filter(
    ({ role }) => role === 'coffin-skull',
  ).length, 1)
})

test('Demon death retains its body flames and delayed Anim_FireBurst choreography', () => {
  let result = killOneAndStep('demon-death-choreography', 'DEMON')
  let effects = result.store.deathEffects
  assert.equal(effects.filter(({ kind }) => kind === 'fire-array').length, 5)
  assert.deepEqual(
    effects.filter(({ kind }) => kind === 'fire-array').map(({ spawnTick }) => spawnTick),
    [0, 20, 40, 60, 80],
  )
  assert.equal(effects.some(({ role }) => role === 'demon-death-body'), false)
  assert.equal(result.store.actors[0]?.lifeState, 'dying')
  assert.equal(result.store.actors[0]?.deathTick, 1)

  result = step(result.store, 94, FAR_PLAYERS)
  assert.equal(result.store.deathEffects.some(
    ({ role }) => role === 'demon-death-fire-burst-frame',
  ), false)
  result = step(result.store, 95, FAR_PLAYERS)
  effects = result.store.deathEffects
  assert.equal(
    effects.find(({ role }) => role === 'demon-death-fire-burst-glow')?.spawnTick,
    95,
  )
  assert.equal(
    effects.find(({ role }) => role === 'demon-death-fire-burst-frame')?.spawnTick,
    95,
  )
  const burstGlow = effects.find(
    ({ role }) => role === 'demon-death-fire-burst-glow',
  )!
  const burstFrame = effects.find(
    ({ role }) => role === 'demon-death-fire-burst-frame',
  )!
  assert.deepEqual(burstGlow.position, { x: 12, y: 14 })
  assert.equal(burstGlow.scale, 10)
  assert.equal(burstGlow.lifetimeTicks, NATIVE_DEMON_RAW_FIRE_BURST_TICKS)
  assert.equal(burstFrame.scale, 2)
  assert.equal(burstFrame.frameTicks, 1 / NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK)
  assert.equal(burstFrame.lifetimeTicks, NATIVE_DEMON_RAW_FIRE_BURST_TICKS)
  assert.notEqual(burstFrame.angularVelocityDeg, 0)
  assert.deepEqual(
    result.events
      .filter(({ type }) => type === 'enemy-death-sound')
      .map(({ sound }) => sound),
    ['flash', 'demon-die'],
  )
  assert.equal(result.store.actors[0]?.deathTick, 95)

  result = step(result.store, 100, FAR_PLAYERS)
  assert.equal(result.store.actors.length, 0)
  assert.ok(result.store.deathEffects.some(({ role }) => role === 'demon-banish'))
  assert.ok(result.store.deathEffects.some(({ role }) => role === 'demon-sprite-array'))
  assert.deepEqual(
    result.events
      .filter(({ type }) => type === 'enemy-death-sound')
      .map(({ sound }) => sound),
    ['firey-death'],
  )
  assert.equal(
    result.store.deathEffects.find(
      ({ role }) => role === 'demon-death-fire-burst-frame',
    )?.entry,
    251,
  )
  assert.equal(
    result.store.deathEffects.find(
      ({ role }) => role === 'demon-death-fire-burst-glow',
    )?.alpha,
    0.5 - 5 * (0.5 * NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK / 4),
  )
  result = step(result.store, 101, FAR_PLAYERS)
  assert.equal(
    result.store.deathEffects.find(
      ({ role }) => role === 'demon-death-fire-burst-frame',
    )?.entry,
    252,
  )
})

test('Bouncer draws its horizontal damping branch anew at every ground contact', () => {
  let result = killOneAndStep('bouncer-contact-rng', 'SKELETON')
  const forceGroundContact = (source: BoneyardEnemyStore, effectIndex: number) => ({
    ...source,
    deathEffects: source.deathEffects.map((effect, index) => index === effectIndex
      ? {
          ...effect,
          bounceVelocity: -2,
          height: -0.1,
          velocity: { x: 8, y: 4 },
          verticalVelocity: 1,
        }
      : effect),
  })
  const effectIndex = result.store.deathEffects.findIndex(({ kind }) => kind === 'bouncer')
  assert.notEqual(effectIndex, -1)

  const beforeFirstBounce = result.store.rngState
  result = step(forceGroundContact(result.store, effectIndex), 2, FAR_PLAYERS)
  assert.notEqual(result.store.rngState, beforeFirstBounce)

  const beforeSecondBounce = result.store.rngState
  result = step(forceGroundContact(result.store, effectIndex), 4, FAR_PLAYERS)
  assert.notEqual(result.store.rngState, beforeSecondBounce)
})

test('family death branches emit the recovered ordered sound calls and pitch bands', () => {
  const skeleton = killOneAndStep('death-sound-skeleton', 'SKELETON')
  assertDeathSounds(skeleton, [
    ['skeleton-die', 0.8, 1],
  ])

  const splitImp = killOneAndStep('death-sound-split-imp', 'IMP', ['FLAG_SPLIT'])
  assertDeathSounds(splitImp, [
    ['imp-split', 0.9, 1.1],
  ])

  const ordinaryImp = killOneAndStep('death-sound-ordinary-imp', 'IMP')
  assertDeathSounds(ordinaryImp, [
    ['firey-death', 0.8, 1],
  ])

  const zombie = killOneAndStep('death-sound-zombie', 'ZOMBIE', ['FLAG_ROTTEN'])
  assertDeathSounds(zombie, [
    ['zombie-poison-splat', 0.9, 1.05],
    ['zombie-poison-splat', 0.9, 1.05],
    ['zombie-poison-splat', 0.9, 1.05],
    ['zombie-die', 0.8, 1],
    ['zombie-die-groan', 0.8, 1],
  ])

  const wraith = killOneAndStep('death-sound-wraith', 'WRAITH')
  assertDeathSounds(wraith, [
    ['flash', 1, 1],
    ['banshee-die', 0.9, 1.1],
    ['banshee-die', 0.9, 1.1],
    ['banshee-die', 0.8, 1.2],
  ])

  let demon = killOneAndStep('death-sound-demon', 'DEMON')
  assertDeathSounds(demon, [])
  demon = step(demon.store, 95, FAR_PLAYERS)
  assertDeathSounds(demon, [
    ['flash', 1, 1],
    ['demon-die', 1, 1],
  ])
  demon = step(demon.store, 100, FAR_PLAYERS)
  assertDeathSounds(demon, [
    ['firey-death', 0.8, 1],
  ])

  const coffin = killOneAndStep('death-sound-coffin', 'COFFIN')
  assertDeathSounds(coffin, [
    ['coffin-break', 1, 1.1],
  ])
  const extraFragments = coffin.store.deathEffects.filter(
    ({ role }) => role.startsWith('coffin-extra-fragment:'),
  )
  assert.ok(extraFragments.length >= 12 && extraFragments.length <= 15)
  assert.ok(extraFragments.every(({ atlas, entry }) => (
    (atlas === 'DeadHawg' && entry >= 114 && entry <= 144)
    || (atlas === 'BadGuys' && entry >= 2067 && entry <= 2069)
  )))
  assert.ok(extraFragments.some(({ atlas }) => atlas === 'DeadHawg'))
})

test('wave spawn resolution observes post-retirement and terminal-child live counts', () => {
  let result = spawnOne('post-step-live-count', 'SKELETON', { x: 0, y: 0 }, FAR_PLAYERS)
  const actor = result.store.actors[0]!
  let store = damageBoneyardEnemy(result.store, {
    actorId: actor.id,
    amount: actor.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  }).store
  let observedLiveCount = -1
  result = stepBoneyardEnemyStore(store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: (liveEnemyCount) => {
      observedLiveCount = liveEnemyCount
      return []
    },
    tick: 1,
  })
  assert.equal(observedLiveCount, 0)
  assert.equal(result.store.actors.length, 0)

  result = spawnOne(
    'post-split-live-count',
    'IMP',
    { x: 0, y: 0 },
    FAR_PLAYERS,
    ['FLAG_SPLIT'],
  )
  store = damageBoneyardEnemy(result.store, {
    actorId: result.store.actors[0]!.id,
    amount: result.store.actors[0]!.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  }).store
  observedLiveCount = -1
  result = stepBoneyardEnemyStore(store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: (liveEnemyCount) => {
      observedLiveCount = liveEnemyCount
      return []
    },
    tick: 1,
  })
  assert.equal(observedLiveCount, result.store.actors.length)
  assert.ok(observedLiveCount > 1)
})

test('wave trigger census counts Zombie actors without treating Coffins as Zombies', () => {
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('zombie-census'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [
      intent('ZOMBIE', 1, { x: 0, y: 0 }),
      intent('COFFIN', 2, { x: 50, y: 0 }),
      intent('SKELETON', 3, { x: 100, y: 0 }),
    ],
    tick: 0,
  })
  let observed: readonly [number, number] | null = null
  result = stepBoneyardEnemyStore(result.store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: (liveEnemyCount, liveZombieCount) => {
      observed = [liveEnemyCount, liveZombieCount]
      return []
    },
    tick: 1,
  })
  assert.deepEqual(observed, [3, 1])
  assert.equal(result.store.actors.some(({ config }) => config.enemyToken === 'COFFIN'), true)
})

test('Slumpgut terminal reward retains the linked Miniboss Die program', () => {
  const recipe = nativeSlumpgutRecipe(
    '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f',
  )
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('slumpgut-death'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [{
      ...intent('ZOMBIE', 1, { x: 25, y: 50 }),
      authoredRecipe: recipe,
      flanking: false,
      pathfindingMode: 2,
      zombieBodyType: 1,
    }],
    tick: 0,
  })
  const actor = result.store.actors[0]!
  result = stepBoneyardEnemyStore(damageBoneyardEnemy(result.store, {
    actorId: actor.id,
    amount: actor.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  }).store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick: 1,
  })
  assert.equal(result.rewards.length, 1)
  assert.equal(result.rewards[0]?.experience, 2_756.25)
  assert.deepEqual(result.rewards[0]?.lootSource, {
    actorSeed: actor.lootSeed,
    enemyToken: 'ZOMBIE',
    onDeathProgram: 'miniboss-die',
    participantSlot: 0,
    policies: recipe.lootPolicies,
    position: { x: 25, y: 50 },
    recipeUid: recipe.uid,
  })
})

function forcedArcherVolley(
  seed: string,
  flags: readonly string[],
  players: BoneyardEnemyTargets,
  extraArrows = 0,
): BoneyardEnemyStoreStepResult {
  let result = spawnOne(seed, 'SKELETONARCHER', { x: 0, y: 0 }, players, flags)
  const actor = result.store.actors[0]!
  if (actor.config.enemyToken !== 'SKELETONARCHER' || actor.brain.family !== 'archer') {
    throw new Error('expected Archer actor')
  }
  result = {
    ...result,
    store: {
      ...result.store,
      actors: [{
        ...actor,
        brain: {
          ...actor.brain,
          actionProgress: NATIVE_ARCHER_ACTION_PROGRAM.markerProgress,
          markerEmitted: false,
          phase: 'attack',
        },
        config: {
          ...actor.config,
          family: {
            ...actor.config.family,
            extraArrows,
            multiArrowMode: extraArrows > 0 ? 3 : actor.config.family.multiArrowMode,
          },
        },
      }],
    },
  }
  return step(result.store, 1, players)
}

function forcedMageAttack(
  seed: string,
  flags: readonly string[],
  clipSpellSegment = CLEAR_SPELL_SEGMENT,
): BoneyardEnemyStoreStepResult {
  const players = { player: livingTarget(150, 0) }
  let result = spawnOne(seed, 'SKELETONMAGE', { x: 0, y: 0 }, players, flags)
  const brain = result.store.actors[0]!.brain
  if (brain.family !== 'mage') throw new Error('expected Mage brain')
  result = withActorBrain(result, 0, {
    ...brain,
    actionProgress: NATIVE_MAGE_ACTION_PROGRAMS.short.markerProgress,
    castProgram: 'short',
    castRoll: 0,
    markerEmitted: false,
    phase: 'cast',
  })
  return step(result.store, 1, players, clipSpellSegment)
}

function mageProjectileSummary(result: BoneyardEnemyStoreStepResult) {
  const projectile = result.store.projectiles[0]!
  return {
    coldSlowTicks: projectile.coldSlowTicks,
    damage: projectile.damage,
    kind: projectile.kind,
    payload: projectile.payload,
    poisonDamage: projectile.poisonDamage,
    poisonDuration: projectile.poisonDuration,
  }
}

function signedHeading(headingDeg: number): number {
  return ((headingDeg + 180) % 360 + 360) % 360 - 180
}

function skeletonHeadTurnState(offsetIndex: number): NativeRngState {
  for (let seed = 1; seed < 1_000_000; seed += 1) {
    const source = createNativeRng(seed)
    const gate = drawNativeInteger(source, NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT)
    if (gate.value !== NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER) continue
    const offset = drawNativeInteger(
      gate.state,
      NATIVE_SKELETON_HEAD_FACING_OFFSETS.length,
    )
    if (offset.value === offsetIndex) return source
  }
  throw new Error(`could not find a Skeleton head-turn seed for offset ${offsetIndex}`)
}

function nonWinningSkeletonHeadTurnState(): NativeRngState {
  for (let seed = 1; seed < 1_000; seed += 1) {
    const source = createNativeRng(seed)
    if (
      drawNativeInteger(source, NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT).value
      !== NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER
    ) return source
  }
  throw new Error('could not find a non-winning Skeleton head-turn seed')
}

function verifySkeletonProgram(
  flags: readonly string[],
  expectedAction: 'claw' | 'pike' | 'weapon',
  expectedMarkerTicks: readonly number[],
  expectedCompletionTick: number,
): void {
  const players = { player: livingTarget(10, 0) }
  let result = spawnOne(`skeleton-${expectedAction}`, 'SKELETON', { x: 0, y: 0 }, players, flags)
  const initialGaitPose = result.store.actors[0]!.gaitPose
  result = step(result.store, 1, players)
  const began = result.store.actors[0]!.brain
  assert.equal(began.family, 'skeleton')
  if (began.family !== 'skeleton') throw new Error('expected Skeleton brain')
  assert.equal(began.phase, 'attack')
  assert.equal(began.action, expectedAction)
  const firstBodyPose = expectedAction === 'claw' ? 4 : 1
  assert.equal(result.store.actors[0]!.bodyPose, firstBodyPose)
  const bodyPoses = new Set([firstBodyPose])
  const markerTicks: number[] = []
  const damageAmounts: number[] = []
  let completionTick = -1
  for (let tick = 2; tick <= expectedCompletionTick + 2; tick += 1) {
    result = step(result.store, tick, players)
    bodyPoses.add(result.store.actors[0]!.bodyPose)
    if (result.playerDamage.length > 0) {
      markerTicks.push(tick - 1)
      damageAmounts.push(...result.playerDamage.map(({ amount }) => amount))
    }
    if (completionTick < 0 && result.store.actors[0]!.brain.phase === 'approach') {
      completionTick = tick
      break
    }
  }
  assert.deepEqual(markerTicks, expectedMarkerTicks)
  if (expectedAction === 'claw') assert.deepEqual(damageAmounts, [3, 3, 3])
  assert.equal(completionTick - 1, expectedCompletionTick)
  assert.ok(bodyPoses.size > 1)
  assert.equal(result.store.actors[0]!.bodyPose, firstBodyPose)
  assert.equal(result.store.actors[0]!.gaitPose, initialGaitPose)
}

test('Portal materializes 45 to 5 and admits its native Imp ejection through placement', () => {
  const placementRadii: number[] = []
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('portal-ejection'), {
    clipSpellSegment: CLEAR_SPELL_SEGMENT,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnPlacement: (request) => {
      placementRadii.push(request.radius)
      assert.equal(request.navigationClearance, 25)
      assert.equal(request.reachabilityRadius, 25)
      return { position: request.position, rngState: request.rngState }
    },
    resolveSpawnIntents: () => [portalIntent(1, { x: 0, y: 0 })],
    tick: 0,
  })
  assert.equal(result.store.actors.length, 1)
  assert.equal(placementRadii[0], 45)
  assert.equal(boneyardEnemyCollisionRadius(result.store.actors[0]!), 45)

  for (let tick = 1; tick <= 10; tick += 1) {
    result = step(result.store, tick, FAR_PLAYERS)
  }
  const portal = result.store.actors[0]!
  assert.equal(portal.brain.family, 'portal')
  assert.equal(boneyardEnemyCollisionRadius(portal), 5)
  assert.deepEqual(
    result.events.filter(({ type }) => type === 'enemy-action-sound').map(({ sound, gainScale }) => ({
      gainScale,
      sound,
    })),
    [{ gainScale: 0.5, sound: 'portal-open' }],
  )

  if (portal.brain.family !== 'portal') throw new Error('expected Portal brain')
  result = withActorBrain(result, 0, { ...portal.brain, ticksUntilEjection: 1 })
  result = stepBoneyardEnemyStore(result.store, {
    clipSpellSegment: CLEAR_SPELL_SEGMENT,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnPlacement: (request) => ({
      position: request.position,
      rngState: request.rngState,
    }),
    resolveSpawnIntents: () => [],
    tick: 11,
  })

  assert.equal(result.store.actors.length, 2)
  const parent = result.store.actors[0]!
  const child = result.store.actors[1]!
  assert.equal(child.config.enemyToken, 'IMP')
  assert.equal(child.config.primaryDamage, 2)
  assert.equal(child.brain.family, 'imp')
  if (child.brain.family !== 'imp') throw new Error('expected Portal child Imp')
  assert.equal(child.brain.baseHorizontalSpeed, 4.5)
  assert.equal(child.brain.horizontalSpeed, 6.75)
  assert.equal(child.brain.verticalOffset, -0.1)
  assert.ok(child.brain.verticalVelocity <= -10 && child.brain.verticalVelocity >= -15)
  assert.deepEqual(
    child.position,
    nativePortalChildPosition(
      parent.position,
      parent.headingDeg,
      child.headingDeg,
      child.config.collisionRadius,
    ),
  )
  assert.ok(result.events.some(({ sound }) => sound === 'fireball-hit'))
})

test('Portal damage and death emit their direct cues, effects, reward, and retirement', () => {
  let spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('portal-terminal'), {
    clipSpellSegment: CLEAR_SPELL_SEGMENT,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [portalIntent(1, { x: 12, y: 34 })],
    tick: 0,
  })
  const actor = spawned.store.actors[0]!
  const hurt = damageBoneyardEnemy(spawned.store, {
    actorId: actor.id,
    amount: 1,
    sourcePlayerId: 'player',
    tick: 0,
  })
  assert.ok(hurt.events.some(({ sound, type }) => (
    type === 'enemy-damage-sound' && sound === 'portal-hurt'
  )))
  const hurtBrain = hurt.store.actors[0]!.brain
  assert.equal(hurtBrain.family, 'portal')
  if (hurtBrain.family !== 'portal') throw new Error('expected damaged Portal brain')
  assert.ok(hurtBrain.hurtTicksRemaining >= 10 && hurtBrain.hurtTicksRemaining <= 24)
  const killed = damageBoneyardEnemy(hurt.store, {
    actorId: actor.id,
    amount: actor.currentHealth,
    sourcePlayerId: 'player',
    tick: 20,
  })
  spawned = step(killed.store, 21, FAR_PLAYERS)
  assert.equal(spawned.store.actors.length, 0)
  assert.ok(spawned.events.some(({ sound, type }) => (
    type === 'enemy-death-sound' && sound === 'portal-die'
  )))
  assert.ok(spawned.events.some(({ output }) => output === 'portal-break'))
  assert.equal(spawned.rewards.length, 1)
  assert.equal(spawned.retired.length, 1)
  assert.ok(spawned.store.deathEffects.some(({ role }) => role === 'portal-terminal-array'))
  assert.ok(spawned.store.deathEffects.some(({ role }) => role === 'portal-black-smoke'))
  assert.equal(
    spawned.store.deathEffects.filter(({ role }) => role === 'portal-decal').length,
    2,
  )
  assert.deepEqual(
    spawned.store.deathEffects
      .filter(({ role }) => role === 'portal-decal')
      .map(({ entry }) => entry),
    [120, 144],
  )
})

function spawnOne(
  seed: string,
  token: BoneyardWaveEnemyToken,
  position: Readonly<{ x: number; y: number }>,
  players: BoneyardEnemyTargets,
  flags: readonly string[] = [],
): BoneyardEnemyStoreStepResult {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore(seed), {
    clipSpellSegment: CLEAR_SPELL_SEGMENT,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [intent(token, 1, position, flags)],
    tick: 0,
  })
}

function killOneAndStep(
  seed: string,
  token: BoneyardWaveEnemyToken,
  flags: readonly string[] = [],
): BoneyardEnemyStoreStepResult {
  const spawned = spawnOne(seed, token, { x: 12, y: 34 }, FAR_PLAYERS, flags)
  const actor = spawned.store.actors[0]!
  return step(damageBoneyardEnemy(spawned.store, {
    actorId: actor.id,
    amount: actor.currentHealth,
    sourcePlayerId: 'player',
    tick: 0,
  }).store, 1, FAR_PLAYERS)
}

function assertDeathSounds(
  result: BoneyardEnemyStoreStepResult,
  expected: readonly (readonly [
    sound: string,
    minimumPitch: number,
    maximumPitch: number,
  ])[],
): void {
  const sounds = result.events.filter(({ type }) => type === 'enemy-death-sound')
  assert.deepEqual(sounds.map(({ sound }) => sound), expected.map(([sound]) => sound))
  assert.ok(sounds.every(({ sourcePosition }) => (
    sourcePosition?.x === 12 && sourcePosition.y === 34
  )))
  sounds.forEach((event, index) => {
    const [, minimumPitch, maximumPitch] = expected[index]!
    assert.ok(event.pitch !== undefined)
    if (minimumPitch === maximumPitch) assert.equal(event.pitch, minimumPitch)
    else {
      assert.ok(event.pitch >= minimumPitch)
      assert.ok(event.pitch < maximumPitch)
    }
  })
}

function step(
  store: BoneyardEnemyStore,
  tick: number,
  players: BoneyardEnemyTargets,
  clipSpellSegment = CLEAR_SPELL_SEGMENT,
): BoneyardEnemyStoreStepResult {
  return stepBoneyardEnemyStore(store, {
    clipSpellSegment,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick,
  })
}

function stepWithEffects(
  store: BoneyardEnemyStore,
  tick: number,
  players: BoneyardEnemyTargets,
  abilityEffects: Readonly<Record<number, NativeSecondaryTargetEffectState>>,
): BoneyardEnemyStoreStepResult {
  return stepBoneyardEnemyStore(store, {
    abilityEffects,
    clipSpellSegment: CLEAR_SPELL_SEGMENT,
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick,
  })
}

function targetEffect(
  targetId: number,
  patch: NativeSecondaryTargetEffectPatch,
): NativeSecondaryTargetEffectState {
  const effect = {
    circleSlowFactor: 1,
    circleSlowTicks: 0,
    coldSlowFactor: 1,
    coldSlowMaterial: false,
    coldSlowTicks: 0,
    dazzleMaximumTicks: 0,
    dazzleTicks: 0,
    disruptedTicks: 0,
    electricBurn: null,
    fleeTicks: 0,
    frostBurnDamagePerTick: 0,
    frostBurnOwnerId: null,
    frostBurnSkillId: null,
    frostBurnSourceActorId: null,
    frostBurnTicks: 0,
    frozenTicks: 0,
    frozenTimeScale: 1,
    prismaticTicks: 0,
    steamed: null,
    stunFactor: 1,
    stunTicks: 0,
    targetId,
    timeScale: 1,
    weakenFactor: 1,
    worldKey: 'boneyard:test',
    ...patch,
  }
  const dazzleFactor = effect.dazzleTicks <= 0 || effect.dazzleMaximumTicks <= 0
    ? 1
    : Math.max(
        1 / effect.dazzleMaximumTicks,
        1 - effect.dazzleTicks / effect.dazzleMaximumTicks,
      )
  const movementModifierOrder: NativeSecondaryMovementModifierKind[] = [
    effect.coldSlowTicks > 0 ? 'cold-slow' : null,
    effect.circleSlowTicks > 0 ? 'circle-slow' : null,
    effect.frozenTicks > 0 ? 'frozen' : null,
    effect.stunTicks > 0 ? 'stun' : null,
    effect.dazzleTicks > 0 ? 'dazzle' : null,
  ].filter((kind): kind is NativeSecondaryMovementModifierKind => kind !== null)
  const movementFactors: Record<NativeSecondaryMovementModifierKind, number> = {
    'circle-slow': effect.circleSlowFactor,
    'cold-slow': effect.coldSlowFactor,
    dazzle: dazzleFactor,
    frozen: effect.frozenTimeScale,
    stun: effect.stunFactor,
  }
  return {
    ...effect,
    movementModifierOrder,
    timeScale: movementModifierOrder.reduce(
      (scale, kind) => Math.fround(scale * movementFactors[kind]),
      Math.fround(1),
    ),
  }
}

function skeletonActionProgress(result: BoneyardEnemyStoreStepResult): number {
  const brain = result.store.actors[0]!.brain
  if (brain.family !== 'skeleton') throw new Error('expected Skeleton brain')
  return brain.actionProgress
}

function withActorBrain(
  result: BoneyardEnemyStoreStepResult,
  index: number,
  brain: BoneyardEnemyActor['brain'],
): BoneyardEnemyStoreStepResult {
  const actors = [...result.store.actors]
  actors[index] = { ...actors[index]!, brain }
  return { ...result, store: { ...result.store, actors } }
}

function withCoffinRemaining(
  result: BoneyardEnemyStoreStepResult,
  phaseTicksRemaining: number,
): BoneyardEnemyStoreStepResult {
  const actor = result.store.actors[0]!
  const brain = actor.brain
  if (brain.family !== 'coffin') throw new Error('expected Coffin brain')
  return withActorBrain(result, 0, { ...brain, phaseTicksRemaining })
}

function withCoffinCharge(
  result: BoneyardEnemyStoreStepResult,
  maggotCharge: number,
): BoneyardEnemyStoreStepResult {
  const actor = result.store.actors[0]!
  const brain = actor.brain
  if (brain.family !== 'coffin') throw new Error('expected Coffin brain')
  return withActorBrain(result, 0, { ...brain, maggotCharge })
}

function freezeOpenedCoffin(
  result: BoneyardEnemyStoreStepResult,
): BoneyardEnemyStoreStepResult {
  const actor = result.store.actors[0]!
  const brain = actor.brain
  if (brain.family !== 'coffin') throw new Error('expected Coffin brain')
  return withActorBrain(result, 0, {
    ...brain,
    phase: 'holding',
    phaseTick: 0,
    phaseTicksRemaining: Number.MAX_SAFE_INTEGER,
  })
}

function withCoffinMaximumMaggots(
  result: BoneyardEnemyStoreStepResult,
  maximumMaggots: number,
): BoneyardEnemyStoreStepResult {
  const actor = result.store.actors[0]!
  if (actor.config.enemyToken !== 'COFFIN') throw new Error('expected Coffin config')
  return {
    ...result,
    store: {
      ...result.store,
      actors: [{
        ...actor,
        config: {
          ...actor.config,
          family: { ...actor.config.family, maximumMaggots },
        },
      }],
    },
  }
}

function openedCoffin(
  seed: string,
  players: BoneyardEnemyTargets,
): BoneyardEnemyStoreStepResult {
  let result = spawnOne(seed, 'COFFIN', { x: 0, y: 0 }, players)
  for (let tick = 1; tick <= 4; tick += 1) {
    result = withCoffinRemaining(result, 1)
    result = step(result.store, tick, players)
  }
  return result
}

function boneyardIntegerState(bound: number, winner: number): number {
  for (let seed = 1; seed < 1_000_000; seed += 1) {
    if (randomBoneyardWaveInteger(seed, bound).value === winner) return seed
  }
  throw new Error(`could not find Boneyard Integer(${bound}) winner ${winner}`)
}

function positiveDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function coffinLaunchPointForTest(
  point: Readonly<{ x: number; y: number }>,
  brain: Extract<BoneyardEnemyActor['brain'], { family: 'coffin' }>,
): Readonly<{ x: number; y: number }> {
  const radians = brain.launchRotationDeg * Math.PI / 180
  const x = point.x * brain.launchScale
  return {
    x: x * Math.cos(radians) - point.y * Math.sin(radians),
    y: x * Math.sin(radians) + point.y * Math.cos(radians),
  }
}

function livingTarget(x: number, y: number) {
  return {
    alive: true,
    collisionRadius: 25,
    connected: true,
    eligible: true,
    position: { x, y },
    velocityPerTick: { x: 0, y: 0 },
  } as const
}

function intent(
  enemyToken: BoneyardWaveEnemyToken,
  id: number,
  position: Readonly<{ x: number; y: number }>,
  flags: readonly string[] = [],
): BoneyardEnemySpawnIntent {
  return {
    enemyToken,
    flags,
    id,
    locationPolicy: 'anywhere',
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken],
    position: { ...position },
    spawnTick: 0,
    waveOrdinal: 1,
  }
}

function portalIntent(
  id: number,
  position: Readonly<{ x: number; y: number }>,
): BoneyardEnemySpawnIntent {
  const phase = nativePortalProgram(
    '9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9',
  ).phases[0]!
  return {
    ...intent('PORTAL', id, position),
    authoredRecipe: nativePortalRecipe(phase),
    flanking: true,
    navigationClearance: 25,
    pathfindingMode: 2,
    placementRadius: 45,
    positionPolicy: phase.placementPolicy,
    reachabilityRadius: 25,
  }
}
