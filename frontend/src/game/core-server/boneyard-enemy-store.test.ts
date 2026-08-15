import assert from 'node:assert/strict'
import test from 'node:test'

import type { BoneyardWaveEnemyToken } from '../core-kernels/boneyard-wave-schema.ts'
import {
  BOUNDED_ARCHER_RANGE_BANDS,
  BOUNDED_ENEMY_COLD_SLOW_TICKS,
  BOUNDED_ENEMY_POISON_DURATION_SECONDS,
  BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS,
  BOUNDED_MAGE_RANGE_BANDS,
  NATIVE_WRAITH_DAZZLE_TICKS,
} from '../core-kernels/boneyard-enemy-modifiers.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  BOUNDED_ENEMY_ACTION_PROGRAMS,
  BOUNDED_ENEMY_DEATH_PROGRAM_TICKS,
  BOUNDED_ENEMY_GAIT_DISTANCE_PER_POSE,
  BOUNDED_MAGGOT_PROGRAM,
  NATIVE_ARCHER_ACTION_PROGRAM,
  NATIVE_MAGE_ACTION_PROGRAMS,
  NATIVE_SKELETON_ACTION_PROGRAMS,
  NATIVE_SKELETON_CLAW_MARKERS,
  boneyardEnemyLiveCount,
  createBoneyardEnemyStore,
  damageBoneyardEnemy,
  stepBoneyardEnemyStore,
  type BoneyardEnemyActor,
  type BoneyardEnemyMovementRequest,
  type BoneyardEnemyStore,
  type BoneyardEnemyStoreStepResult,
  type BoneyardEnemyTargets,
} from './boneyard-enemy-store.ts'

const TOKENS = Object.keys(BONEYARD_WAVE_ENEMY_TYPES) as BoneyardWaveEnemyToken[]
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

test('materialization gives all eight families stable actor and event identities', () => {
  const result = stepBoneyardEnemyStore(createBoneyardEnemyStore('families'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
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
})

test('target selection is nearest, tie-stable, and immediately rejects dead peers', () => {
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
  assert.equal(result.store.actors[0]!.targetPlayerId, 'alpha')

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
    tick: 26,
  })
  assert.equal(result.store.actors[0]!.targetPlayerId, 'nearer')
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

  const expectedStep = 0.25
    * actor.config.chaseSpeed
    * actor.config.baseSpeed
    * actor.config.scale
    * 2
  assert.equal(requests.length, 1)
  assert.equal(requests[0]!.actorId, actor.id)
  assert.equal(requests[0]!.delta.x, expectedStep)
  assert.equal(requests[0]!.delta.y, 0)
  assert.equal(requests[0]!.radius, actor.config.collisionRadius)
  assert.equal(result.store.actors[0]!.position.x, expectedStep / 2)
  assert.equal(
    result.store.actors[0]!.gaitPose,
    expectedStep / 2 / BOUNDED_ENEMY_GAIT_DISTANCE_PER_POSE,
  )
  assert.equal(result.store.actors[0]!.lastMovementTick, 2)
  assert.equal(result.store.actors[0]!.nextMovementTick, 4)
})

test('Skeleton claw, weapon, and Pike preserve exact marker and strict-end ticks', () => {
  assert.deepEqual(NATIVE_SKELETON_ACTION_PROGRAMS, {
    claw: { markerProgress: 4, progressPerTick: 0.125, strictEnd: 7 },
    pike: { markerProgress: 2, progressPerTick: 0.125, strictEnd: 12 },
    weapon: { markerProgress: 9, progressPerTick: 0.25, strictEnd: 24 },
  })
  assert.deepEqual(NATIVE_SKELETON_CLAW_MARKERS, [4, 8])
  verifySkeletonProgram([], 'claw', [32, 33, 57], 57)
  verifySkeletonProgram(['FLAG_SWORD'], 'weapon', [36], 97)
  verifySkeletonProgram(['FLAG_PIKE'], 'pike', [16], 97)
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

  let mage = spawnOne(
    'mage-program',
    'SKELETONMAGE',
    { x: 0, y: 0 },
    { player: livingTarget(150, 0) },
  )
  mage = step(mage.store, 1, { player: livingTarget(150, 0) })
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
  for (let tick = 3; tick < 500 && !sawMarker; tick += 1) {
    mage = step(mage.store, tick, { player: livingTarget(150, 0) })
    sawMarker = mage.events.some((event) => event.type === 'attack-marker')
  }
  assert.equal(sawMarker, true)
  assert.deepEqual(mage.store.projectiles.map((projectile) => [
    projectile.id,
    projectile.nativeTypeId,
  ]), [[1, 0x7eb]])
})

test('every Archer and Mage range mode attacks, approaches, and retreats at its own band', () => {
  const variants = [
    [[], 0],
    [['FLAG_RANGEDOWN'], 1],
    [['FLAG_RANGEUP'], 2],
    [['FLAG_RANGEEASY'], 3],
  ] as const
  for (const [flags, mode] of variants) {
    for (const [token, range, actionPhase] of [
      ['SKELETONARCHER', BOUNDED_ARCHER_RANGE_BANDS[mode], 'attack'],
      ['SKELETONMAGE', BOUNDED_MAGE_RANGE_BANDS[mode], 'cast'],
    ] as const) {
      const insideDistance = (range.minimum + range.maximum) / 2
      let inside = spawnOne(
        `${token}-${mode}-inside`,
        token,
        { x: 0, y: 0 },
        { player: livingTarget(insideDistance, 0) },
        flags,
      )
      inside = step(inside.store, 1, { player: livingTarget(insideDistance, 0) })
      assert.equal(inside.store.actors[0]!.brain.phase, actionPhase)

      const nearDistance = range.minimum - 1
      let near = spawnOne(
        `${token}-${mode}-near`,
        token,
        { x: 0, y: 0 },
        { player: livingTarget(nearDistance, 0) },
        flags,
      )
      near = step(near.store, 2, { player: livingTarget(nearDistance, 0) })
      assert.ok(near.store.actors[0]!.position.x < 0, `${token} mode ${mode} must retreat`)

      const farDistance = range.maximum + 1
      let far = spawnOne(
        `${token}-${mode}-far`,
        token,
        { x: 0, y: 0 },
        { player: livingTarget(farDistance, 0) },
        flags,
      )
      far = step(far.store, 2, { player: livingTarget(farDistance, 0) })
      assert.ok(far.store.actors[0]!.position.x > 0, `${token} mode ${mode} must approach`)
    }
  }
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
  assert.ok(Math.abs(signedHeading(scatter.store.projectiles[0]!.headingDeg)) <= 12)
  assert.ok(Math.abs(signedHeading(random.store.projectiles[0]!.headingDeg)) <= 25)

  const fire = forcedArcherVolley(
    'archer-fire-multishot',
    ['FLAG_FIREARROW'],
    { player: livingTarget(200, 0) },
    2,
  )
  assert.deepEqual(fire.store.projectiles.map((projectile) => ({
    damage: projectile.damage,
    headingDeg: projectile.headingDeg,
    payload: projectile.payload,
  })), [
    { damage: 8, headingDeg: 86, payload: 'fire' },
    { damage: 8, headingDeg: 90, payload: 'fire' },
    { damage: 8, headingDeg: 94, payload: 'fire' },
  ])
  const poison = forcedArcherVolley(
    'archer-poison',
    ['FLAG_POISONARROW'],
    { player: livingTarget(200, 0) },
  ).store.projectiles[0]!
  assert.deepEqual({
    damage: poison.damage,
    payload: poison.payload,
    poisonDamage: poison.poisonDamage,
    poisonDuration: poison.poisonDuration,
  }, {
    damage: 4,
    payload: 'poison',
    poisonDamage: 12,
    poisonDuration: BOUNDED_ENEMY_POISON_DURATION_SECONDS,
  })
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

test('enemy damage consumes shields before health and clears exhausted capacity', () => {
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

  const exhausted = damageBoneyardEnemy(absorbed.store, {
    actorId: absorbed.store.actors[0]!.id,
    amount: 31,
    sourcePlayerId: 'player',
    tick: 1,
  })
  assert.equal(exhausted.killed, false)
  assert.equal(exhausted.store.actors[0]!.currentHealth, initialHealth - 1)
  assert.equal(exhausted.store.actors[0]!.shieldHealth, 0)
  assert.equal(exhausted.store.actors[0]!.shieldMaximumHealth, 0)
})

test('all Mage elements emit their authoritative damage, status, payload, and lightning lifetime', () => {
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
  const created = lightning.store.actors[0]!.lightningEffect
  assert.ok(created)
  const lightningEvent = lightning.events.find((event) => event.type === 'mage-lightning')
  assert.ok(lightningEvent)
  assert.deepEqual(lightningEvent, {
    actorId: lightning.store.actors[0]!.id,
    eventId: created.eventId,
    sourcePosition: { x: 0, y: 0 },
    targetPlayerId: 'player',
    targetPosition: { x: 150, y: 0 },
    tick: 1,
    type: 'mage-lightning',
  })
  assert.equal(created.startedTick, 1)
  for (let age = 1; age < BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS; age += 1) {
    lightning = step(lightning.store, created.startedTick + age, {
      player: livingTarget(150, 0),
    })
    assert.equal(lightning.store.actors[0]!.lightningEffect?.eventId, created.eventId)
  }
  lightning = step(
    lightning.store,
    created.startedTick + BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS,
    { player: livingTarget(150, 0) },
  )
  assert.equal(lightning.store.actors[0]!.lightningEffect, null)
})

test('Wraith contact applies the exact 50-tick Dazzle duration', () => {
  const players = { player: livingTarget(10, 0) }
  let result = spawnOne('wraith-dazzle', 'WRAITH', { x: 0, y: 0 }, players)
  const brain = result.store.actors[0]!.brain
  assert.equal(brain.family, 'wraith')
  if (brain.family !== 'wraith') throw new Error('expected Wraith brain')
  result = withActorBrain(result, 0, {
    ...brain,
    actionTick: BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.markerTick - 1,
    contactTargetPlayerId: 'player',
    markerEmitted: false,
    phase: 'drain',
  })
  result = step(result.store, 1, players)

  assert.equal(result.playerDamage.length, 1)
  assert.equal(result.playerDamage[0]!.dazzleTicks, NATIVE_WRAITH_DAZZLE_TICKS)
})

test('unresolved families keep separate bounded approach, special, and cooldown states', () => {
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
    'contact',
    'swipe',
    'orbit',
    'bomb',
    'hidden',
  ])
  const wraith = result.store.actors[2]!.brain
  assert.equal(wraith.family, 'wraith')
  if (wraith.family !== 'wraith') throw new Error('expected Wraith brain')
  assert.ok(wraith.phaseTicksRemaining >= 200 && wraith.phaseTicksRemaining <= 800)

  const damagedActorIds = new Set<number>()
  for (let tick = 2; tick <= 7; tick += 1) {
    result = step(result.store, tick, { player: livingTarget(10, 0) })
    for (const damage of result.playerDamage) damagedActorIds.add(damage.actorId)
  }
  assert.ok(damagedActorIds.has(1))
  assert.ok(damagedActorIds.has(2))
  assert.deepEqual(result.store.projectiles.map((projectile) => [
    projectile.id,
    projectile.kind,
    projectile.nativeTypeId,
  ]), [[1, 'demon-bomb', 0x7f7]])

  result = withActorBrain(result, 2, {
    ...wraith,
    phase: 'orbit',
    phaseTicksRemaining: 1,
  })
  result = step(result.store, 8, { player: livingTarget(10, 0) })
  assert.ok(result.playerDamage.some((damage) => damage.actorId === 4))
  assert.equal(result.store.actors[2]!.brain.phase, 'drain')
  for (let tick = 9; tick <= 18; tick += 1) {
    result = step(result.store, tick, { player: livingTarget(10, 0) })
  }
  const postDrain = result.store.actors[2]!.brain
  assert.equal(postDrain.family, 'wraith')
  if (postDrain.family !== 'wraith') throw new Error('expected Wraith brain')
  assert.equal(postDrain.phase, 'cooldown')
  assert.equal(
    postDrain.phaseTicksRemaining,
    BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.cooldownTicks,
  )
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

test('Coffin opening emits exactly three emerging helpers, then replenishes below its owned cap', () => {
  let result = spawnOne(
    'coffin-program',
    'COFFIN',
    { x: 0, y: 0 },
    { player: livingTarget(10, 0) },
  )
  result = withCoffinMaximumMaggots(result, 4)
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
  assert.equal(boneyardEnemyLiveCount(result.store), 4)
  assert.equal(new Set(result.store.maggots.map((maggot) => maggot.id)).size, 3)
  assert.ok(result.store.maggots.every((maggot) => (
    (maggot as unknown as { movementPhase?: string }).movementPhase === 'emerging'
  )))
  assert.deepEqual(new Set(result.store.maggots.map((maggot) => (
    (maggot as unknown as { launchTrajectory?: string }).launchTrajectory
  ))), new Set(['lid', 'edge']))

  const openingPositions = new Map(result.store.maggots.map((maggot) => [
    maggot.id,
    { ...maggot.position },
  ]))
  let replenishTick = -1
  for (let tick = 5; tick <= 500 && replenishTick < 0; tick += 1) {
    result = step(result.store, tick, FAR_PLAYERS)
    if (result.events.some((event) => event.type === 'coffin-maggot-release')) {
      replenishTick = tick
    }
  }
  assert.ok(replenishTick > 4)
  assert.equal(result.events.find((event) => event.type === 'coffin-maggot-release')?.count, 1)
  assert.equal(result.store.maggots.filter((maggot) => maggot.lifeState === 'alive').length, 4)
  assert.ok(result.store.maggots.some((maggot) => {
    const initial = openingPositions.get(maggot.id)
    return initial !== undefined
      && (maggot.position.x !== initial.x || maggot.position.y !== initial.y)
  }), 'opening helpers must traverse their emergence trajectories')

  for (let tick = replenishTick + 1; tick <= replenishTick + 200; tick += 1) {
    result = step(result.store, tick, FAR_PLAYERS)
  }
  assert.equal(result.store.maggots.filter((maggot) => maggot.lifeState === 'alive').length, 4)
})

test('a crawling Maggot bites once, enters death, and cannot damage again', () => {
  let result = openedCoffin('one-bite-maggot', { player: livingTarget(10, 0) })
  let tick = 5
  while (result.store.maggots.some((maggot) => (
    (maggot as unknown as { movementPhase?: string }).movementPhase !== 'crawl'
  ))) {
    result = step(result.store, tick, FAR_PLAYERS)
    tick += 1
    if (tick > 200) throw new Error('Maggots did not finish emergence')
  }
  const source = result.store.maggots[0]!
  result = {
    ...result,
    store: {
      ...result.store,
      maggots: [{
        ...source,
        nextAttackTick: tick,
        position: { x: 0, y: 0 },
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

  assert.equal(result.store.maggots.length, 0)
  assert.deepEqual(result.retired.map((retirement) => retirement.actorId), childIds)
})

test('player-killed Maggot emits one death event before later retirement', () => {
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
  const maggot = result.store.maggots[0]!
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
  assert.equal(result.retired.length, 0)
  assert.equal(
    result.store.maggots.find((candidate) => candidate.id === maggot.id)?.terminalEmitted,
    true,
  )

  result = step(result.store, 6, FAR_PLAYERS)
  assert.equal(result.events.filter((event) => event.type === 'enemy-death').length, 0)
  assert.equal(result.retired.length, 0)

  result = step(result.store, 4 + BOUNDED_MAGGOT_PROGRAM.deathTicks, FAR_PLAYERS)
  assert.equal(result.events.filter((event) => event.type === 'enemy-death').length, 0)
  assert.deepEqual(result.retired.map((retirement) => retirement.actorId), [maggot.id])
})

test('Imp and Demon terminal split outputs materialize stable child Imp actors', () => {
  let result = stepBoneyardEnemyStore(createBoneyardEnemyStore('terminal-children'), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players: FAR_PLAYERS,
    resolveMovement: DIRECT_MOVEMENT,
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

  result = step(store, 1, FAR_PLAYERS)
  const children = result.store.actors.filter((actor) => actor.lifeState === 'alive')
  const impParent = store.actors.find((actor) => actor.config.enemyToken === 'IMP')!
  if (impParent.config.enemyToken !== 'IMP') throw new Error('expected Imp config')
  assert.equal(children.length, impParent.config.family.splitCount + 5)
  assert.ok(children.every((actor) => actor.config.enemyToken === 'IMP'))
  assert.deepEqual(result.spawnedActorIds, children.map((actor) => actor.id))
  assert.equal(new Set(children.map((actor) => actor.id)).size, children.length)
})

test('lethal damage rewards and terminal outputs once, then retires after family delays', () => {
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

  result = step(store, 1, FAR_PLAYERS)
  assert.equal(result.rewards.length, 8)
  assert.deepEqual(result.rewards.map((reward) => reward.experience), [
    200, 800, 2, 10, 10, 10, 4, 210,
  ])
  assert.equal(result.events.filter((event) => event.type === 'enemy-death').length, 8)
  assert.equal(result.events.filter((event) => event.type === 'enemy-terminal-output').length, 8)
  assert.deepEqual(result.store.projectiles.map((projectile) => [
    projectile.id,
    projectile.kind,
    projectile.nativeTypeId,
  ]), [[1, 'poison-pool', 0x806]])
  assert.equal(boneyardEnemyLiveCount(result.store), 8)

  result = step(result.store, 2, FAR_PLAYERS)
  assert.equal(result.rewards.length, 0)
  assert.equal(result.events.filter((event) => event.type === 'enemy-death').length, 0)
  result = step(result.store, Math.max(...Object.values(BOUNDED_ENEMY_DEATH_PROGRAM_TICKS)), FAR_PLAYERS)
  assert.equal(result.retired.length, 8)
  assert.equal(boneyardEnemyLiveCount(result.store), 0)
  result = step(result.store, 50, FAR_PLAYERS)
  assert.equal(result.rewards.length, 0)
  assert.equal(result.retired.length, 0)
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
    tick: BOUNDED_ENEMY_DEATH_PROGRAM_TICKS.SKELETON,
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
          family: { ...actor.config.family, extraArrows },
        },
      }],
    },
  }
  return step(result.store, 1, players)
}

function forcedMageAttack(
  seed: string,
  flags: readonly string[],
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
  return step(result.store, 1, players)
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

function verifySkeletonProgram(
  flags: readonly string[],
  expectedAction: 'claw' | 'pike' | 'weapon',
  expectedMarkerTicks: readonly number[],
  expectedCompletionTick: number,
): void {
  const players = { player: livingTarget(10, 0) }
  let result = spawnOne(`skeleton-${expectedAction}`, 'SKELETON', { x: 0, y: 0 }, players, flags)
  result = step(result.store, 1, players)
  const began = result.store.actors[0]!.brain
  assert.equal(began.family, 'skeleton')
  if (began.family !== 'skeleton') throw new Error('expected Skeleton brain')
  assert.equal(began.phase, 'attack')
  assert.equal(began.action, expectedAction)
  const markerTicks: number[] = []
  const damageAmounts: number[] = []
  let completionTick = -1
  for (let tick = 2; tick <= expectedCompletionTick + 2; tick += 1) {
    result = step(result.store, tick, players)
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
}

function spawnOne(
  seed: string,
  token: BoneyardWaveEnemyToken,
  position: Readonly<{ x: number; y: number }>,
  players: BoneyardEnemyTargets,
  flags: readonly string[] = [],
): BoneyardEnemyStoreStepResult {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore(seed), {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [intent(token, 1, position, flags)],
    tick: 0,
  })
}

function step(
  store: BoneyardEnemyStore,
  tick: number,
  players: BoneyardEnemyTargets,
): BoneyardEnemyStoreStepResult {
  return stepBoneyardEnemyStore(store, {
    firstProjectileWorldContact: NO_WORLD_CONTACT,
    players,
    resolveMovement: DIRECT_MOVEMENT,
    resolveSpawnIntents: () => [],
    tick,
  })
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
