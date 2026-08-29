import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { parseBoneyard } from '../../editor/format/boneyard.ts'
import {
  NATIVE_MAGGOT_PROGRAM,
  createBoneyardEnemyStore,
  NATIVE_MAGE_ACTION_PROGRAMS,
  NATIVE_ENEMY_HIT_LATCH_TICKS,
  stepBoneyardEnemyStore,
  type BoneyardEnemyDeathEffect,
  type BoneyardMaggotActor,
} from '../core-server/boneyard-enemy-store.ts'
import { NATIVE_IMP_BODY_POSE_COUNT } from '../core-kernels/boneyard-imp-flight.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import {
  materializeOpeningSolomonSetPiece,
  projectBoneyard,
} from './project-boneyard.ts'
import {
  projectBoneyardEnemyDeathEffect,
  projectBoneyardEnemies,
  projectBoneyardMageLightningPulses,
  projectBoneyardMaggots,
} from './project-boneyard-enemies.ts'

const storyFixture = new URL('../../../public/samples/story0.boneyard', import.meta.url)
const TEST_ENEMY_PATH = Object.freeze({
  baseTurnRate: 0.75,
  flankAngleDeg: 0,
  flankRadius: 0,
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

test('materializes the opening Solomon set piece at the spawn-nearest eligible grave', () => {
  const scene = solomonSelectionScene([
    { eid: 'near-ineligible', typeId: 2029, overlayVariant: 7, pos: { x: 1, y: 0 } },
    { eid: 'far', typeId: 2029, overlayVariant: 8, pos: { x: 9, y: 12 } },
    { eid: 'nearest', typeId: 2029, overlayVariant: 8, pos: { x: 3, y: 4 } },
  ])

  assert.deepEqual(materializeOpeningSolomonSetPiece(scene).solomonDig, {
    frameProgram: [
      0, 0, 0, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17,
      17, 17, 17, 16, 15, 13, 11, 9, 7, 5, 3, 1,
    ],
    gravePosition: { x: 3, y: 4 },
    lanternPosition: { x: -52, y: 77 },
    position: { x: 13, y: 117 },
    ticksPerFrame: 5,
  })
})

test('keeps the first serialized grave when opening candidates tie', () => {
  const scene = solomonSelectionScene([
    { eid: 'first', typeId: 2029, overlayVariant: 8, pos: { x: 3, y: 4 } },
    { eid: 'second', typeId: 2029, overlayVariant: 8, pos: { x: -3, y: -4 } },
  ])

  assert.deepEqual(
    materializeOpeningSolomonSetPiece(scene).solomonDig?.gravePosition,
    { x: 3, y: 4 },
  )
})

test('does not synthesize an opening Solomon set piece without an eligible grave', () => {
  const scene = solomonSelectionScene([
    { eid: 'ordinary-grave', typeId: 2029, overlayVariant: 7, pos: { x: 0, y: 0 } },
  ])

  assert.equal(materializeOpeningSolomonSetPiece(scene).solomonDig, null)
})

test('clears ground clutter at Solomon and only rocks at the opening grave root', () => {
  const root = { x: 13, y: 117 }
  const graveRoot = { x: 3, y: 4 }
  const scene = solomonSelectionScene([
    { eid: 'grave', typeId: 2029, overlayVariant: 8, pos: graveRoot },
  ], [
    compactSprite('covering-large-dirt', 6, root),
    compactSprite('covering-dark-dirt', 7, root),
    compactSprite('covering-small-dark-dirt', 8, root),
    compactSprite('covering-rock-21', 21, root),
    compactSprite('covering-rock-22', 22, root),
    compactSprite('covering-rock-23', 23, { x: root.x, y: root.y + 36 }, 0, 90),
    compactSprite('covering-rock-24', 24, root),
    { ...compactSprite('covering-direct-record', 0, root), deadHawgEntry: 121 },
    compactSprite('grave-root-rock-21', 21, graveRoot),
    compactSprite('grave-root-rock-22', 22, graveRoot),
    compactSprite('grave-root-rock-23', 23, graveRoot),
    compactSprite('grave-root-rock-24', 24, graveRoot),
    { ...compactSprite('grave-root-direct-record', 0, graveRoot), deadHawgEntry: 135 },
    compactSprite('grave-root-dirt', 8, graveRoot),
    compactSprite('outside-grave-rock', 21, { x: graveRoot.x + 40, y: graveRoot.y }),
    compactSprite('covering-foliage', 0, root),
    compactSprite('outside-dark-dirt', 7, { x: root.x + 60, y: root.y }),
    compactSprite('outside-flipped-dark-dirt', 7, { x: root.x + 40, y: root.y }, 1),
  ])

  assert.deepEqual(
    materializeOpeningSolomonSetPiece(scene).sprites.map(({ eid }) => eid),
    [
      'grave-root-dirt',
      'outside-grave-rock',
      'covering-foliage',
      'outside-dark-dirt',
      'outside-flipped-dark-dirt',
    ],
  )
})

test('projects explicit Fencepost selectors and omits the native sentinel', () => {
  const document = parseBoneyard(readFileSync(storyFixture))
  assert.ok(document.fences[0])
  document.fences[0] = {
    ...document.fences[0],
    startPostVariant: 4,
    endPostVariant: 0xffffffff,
  }

  const projected = projectBoneyard(document).fences[0]
  assert.equal(projected.startPostVariant, 4)
  assert.equal('endPostVariant' in projected, false)
})

test('projects process-local Road links as stable endpoint semantics', () => {
  const document = parseBoneyard(readFileSync(storyFixture))
  const projected = projectBoneyard(document)
  assert.equal(projected.roads.length, document.roads.length)
  projected.roads.forEach((road, index) => {
    const source = document.roads[index]!
    assert.equal(
      road.linkMask,
      (source.previousUid !== undefined && source.previousUid !== 0xffffffff ? 1 : 0)
      | (source.nextUid !== undefined && source.nextUid !== 0xffffffff ? 2 : 0),
    )
  })
})

test('projects only Demon raw FireBurst death layers into the direct post-world owner', () => {
  const effect: BoneyardEnemyDeathEffect = {
    ageTicks: 0,
    alpha: 0.5,
    alphaLossPerTick: 0.02,
    angularVelocityDeg: 1,
    atlas: 'BadGuys',
    blendMode: 'add',
    bounceVelocity: 0,
    entry: 251,
    firstEntry: 251,
    frameCount: 4,
    frameTicks: 16 / 3,
    height: 0,
    id: 1,
    kind: 'sprite-array',
    lastStepTick: 10,
    lifetimeTicks: 22,
    opacityTimer: 0,
    ownerActorId: 7,
    position: { x: 100, y: 200 },
    role: 'demon-death-fire-burst-frame',
    rotationDeg: 90,
    scale: 2,
    shadow: false,
    spawnTick: 10,
    tint: 0xffffbf,
    velocity: { x: 0, y: -1 },
    verticalVelocity: 0,
  }
  assert.equal(
    projectBoneyardEnemyDeathEffect(effect).presentationOwner,
    'direct-post-world',
  )
  assert.equal(
    projectBoneyardEnemyDeathEffect({
      ...effect,
      role: 'demon-death-body',
    }).presentationOwner,
    'world-sorted',
  )
})

function solomonSelectionScene(
  objects: BoneyardScene['objects'],
  sprites: BoneyardScene['sprites'] = [],
): BoneyardScene {
  return {
    bounds: { x: -100, y: -100, w: 200, h: 200 },
    environmentMode: 0,
    fences: [],
    name: 'Solomon placement contract',
    objects,
    roads: [],
    solomonDig: null,
    spawn: { x: 0, y: 0, facingDeg: 0 },
    sprites,
    terrain: [],
  }
}

function compactSprite(
  eid: string,
  atlasEntry: number,
  pos: { x: number, y: number },
  flags = 0,
  rotation = 0,
): BoneyardScene['sprites'][number] {
  return {
    atlasEntry,
    eid,
    flags,
    pos,
    s0: rotation,
    s1: 1,
    s2: 1,
  }
}

test('projects the native refreshed 20-tick hit latch for Maggots', () => {
  const maggot: BoneyardMaggotActor = {
    collisionRadius: 8,
    combatActive: true,
    currentHealth: 1,
    damage: 2,
    deathOffsets: [],
    deathEpoch: null,
    deathStartedTick: null,
    deathTick: 0,
    emergencePhase: 0,
    emergenceTick: 24,
    gaitPose: 0,
    headingDeg: 90,
    blizzardPushAccumulator: 0,
    blizzardPushLastTick: null,
    hurricaneContactCooldown: 0,
    id: 1,
    launchTrajectory: 'lid',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    launchVelocity: { x: 0, y: 0 },
    landingBounceVelocity: -0.4,
    lastAttackTick: null,
    lastDamagedByPlayerId: 'player',
    lastDamageTick: 10,
    lastMovementTick: null,
    lifeState: 'alive',
    maximumHealth: 2,
    movementPhase: 'crawl',
    nativeCellBindingOrder: 1,
    nativeRegistrationOrder: 1,
    nextAttackTick: 20,
    nextMovementTick: 12,
    nextTargetRefreshTick: 300,
    ownerCoffinActorId: 2,
    path: TEST_ENEMY_PATH,
    poisonDamage: 0,
    poisonDuration: 0,
    position: { x: 100, y: 200 },
    spawnTick: 0,
    staffActionFactor: 1,
    staffMovementFactor: 1,
    targetPlayerId: 'player',
    terminalEmitted: false,
    verticalOffset: 0,
    verticalVelocity: 0,
  }
  const store = {
    ...createBoneyardEnemyStore('maggot-hit-flash'),
    maggots: [maggot],
  }

  assert.equal(projectBoneyardMaggots(store, 10)[0]?.hitFlash, 1)
  assert.equal(projectBoneyardMaggots(store, 12)[0]?.hitFlash, 0.9)
  assert.ok(Math.abs(
    projectBoneyardMaggots(store, 29)[0]!.hitFlash - 0.05,
  ) < 1e-12)
  assert.equal(projectBoneyardMaggots(store, 30)[0]?.hitFlash, 0)
  assert.equal(NATIVE_ENEMY_HIT_LATCH_TICKS, 20)
  assert.equal(projectBoneyardMaggots({
    ...store,
    maggots: [{ ...maggot, lastDamageTick: null }],
  }, 10)[0]?.hitFlash, 0)
})

test('projects the native refreshed 20-tick hit latch without changing enemy action state', () => {
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('enemy-hit-latch'), {
    firstProjectileWorldContact: () => null,
    players: {
      player: {
        alive: true,
        collisionRadius: 25,
        connected: true,
        eligible: true,
        position: { x: 10, y: 0 },
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 0, y: 0 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const actor = spawned.store.actors[0]!
  if (actor.brain.family !== 'skeleton') throw new Error('expected Skeleton brain')
  const attacking = {
    ...actor,
    brain: {
      ...actor.brain,
      actionProgress: 4,
      markerEmitted: false,
      phase: 'attack' as const,
    },
    lastDamageTick: 10,
  }
  const store = { ...spawned.store, actors: [attacking] }
  const first = projectBoneyardEnemies(store, 10)[0]!
  const finalVisible = projectBoneyardEnemies(store, 29)[0]!
  const expired = projectBoneyardEnemies(store, 30)[0]!

  assert.equal(first.animation.hitFlash, 1)
  assert.ok(Math.abs(finalVisible.animation.hitFlash - 0.05) < 1e-12)
  assert.equal(expired.animation.hitFlash, 0)
  assert.equal(first.animation.state, 'action')
  assert.equal(first.animation.actionProgress, 4)
})

test('projects Maggot emergence trajectory and vertical launch height', () => {
  const source = projectedMaggot({
    emergencePhase: 2.5,
    emergenceTick: 12,
    launchTrajectory: 'lid',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    movementPhase: 'emerging',
    verticalOffset: -20,
  })

  assert.equal(source.emergenceTick, 12)
  assert.equal(source.launchTrajectory, 'lid')
  assert.equal(source.state, 'emerging')
  assert.equal(source.verticalOffset, -20)
})

test('projects a production Maggot bite before death at every default snapshot phase', () => {
  for (let onsetPhase = 0; onsetPhase < 5; onsetPhase += 1) {
    const attackTick = 100 + onsetPhase
    const states: string[] = []
    for (
      let snapshotTick = Math.ceil(attackTick / 5) * 5;
      snapshotTick < attackTick + NATIVE_MAGGOT_PROGRAM.deathTicks;
      snapshotTick += 5
    ) {
      states.push(projectedMaggot({
        deathEpoch: 1,
        deathStartedTick: attackTick,
        deathTick: snapshotTick - attackTick,
        lastAttackTick: attackTick,
        lifeState: 'dying',
      }, snapshotTick).state)
    }
    assert.ok(states.includes('bite'), `phase ${onsetPhase} skipped bite: ${states}`)
    assert.ok(states.includes('death'), `phase ${onsetPhase} skipped death: ${states}`)
  }

  assert.equal(projectedMaggot({
    deathEpoch: 1,
    deathStartedTick: 100,
    lastAttackTick: 100,
    lifeState: 'dying',
  }, 100 + NATIVE_MAGGOT_PROGRAM.bitePresentationTicks - 1).state, 'bite')
  assert.equal(projectedMaggot({
    deathEpoch: 1,
    deathStartedTick: 100,
    lastAttackTick: 100,
    lifeState: 'dying',
  }, 100 + NATIVE_MAGGOT_PROGRAM.bitePresentationTicks).state, 'death')
})

test('projects the native Imp body, bounce, rotation, and upper-effect lifecycle', () => {
  const spawnTick = 100
  const position = { x: 80, y: 120 }
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('imp-flight'), {
    firstProjectileWorldContact: () => null,
    players: {
      player: {
        alive: true,
        collisionRadius: 25,
        connected: true,
        eligible: true,
        position: { x: 400, y: 120 },
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'IMP',
      flags: [],
      id: 17,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.IMP,
      position,
      spawnTick,
      waveOrdinal: 1,
    }],
    tick: spawnTick,
  })
  let store = spawned.store
  const samples = [projectBoneyardEnemies(store, spawnTick)[0]!]
  for (let tick = spawnTick + 1; tick <= spawnTick + 3; tick += 1) {
    store = stepBoneyardEnemyStore(store, {
      firstProjectileWorldContact: () => null,
      players: {
        player: {
          alive: true,
          collisionRadius: 25,
          connected: true,
          eligible: true,
          position: { x: 400, y: 120 },
          velocityPerTick: { x: 0, y: 0 },
        },
      },
      resolveMovement: ({ requestedPosition }) => requestedPosition,
      resolveSpawnIntents: () => [],
      tick,
    }).store
    samples.push(projectBoneyardEnemies(store, tick)[0]!)
  }

  assert.ok(samples[0]!.animation.bodyPose >= 0)
  assert.ok(samples[0]!.animation.bodyPose < NATIVE_IMP_BODY_POSE_COUNT)
  assert.equal(samples[1]!.animation.bodyPose, samples[0]!.animation.bodyPose)
  assert.ok(samples[2]!.animation.bodyPose >= 0)
  assert.ok(samples[2]!.animation.bodyPose < NATIVE_IMP_BODY_POSE_COUNT)
  assert.equal(samples[3]!.animation.bodyPose, samples[2]!.animation.bodyPose)
  assert.equal(samples[0]!.animation.alpha, 1)
  assert.equal(samples[0]!.animation.impEffectAlpha, 0)
  assert.equal(samples[0]!.animation.verticalOffset, 0)
  assert.ok(samples[0]!.animation.impEffectFrame >= 0)
  assert.ok(samples[0]!.animation.impEffectFrame < 10)
  assert.equal(samples[1]!.animation.impEffectAlpha, 0)
  assert.equal(samples[1]!.animation.verticalOffset, 0)
  assert.equal(samples[2]!.animation.impEffectAlpha, 1)
  assert.equal(samples[2]!.animation.verticalOffset, 0)
  assert.ok(samples[2]!.animation.impBodyRotationRadians >= -Math.PI / 3)
  assert.ok(samples[2]!.animation.impBodyRotationRadians <= Math.PI / 3)
  assert.ok(samples[3]!.animation.impEffectAlpha > 0.94)
  assert.ok(samples[3]!.animation.impEffectAlpha < 0.96)
  assert.ok(samples[3]!.animation.verticalOffset < 0)
  assert.deepEqual(
    samples.map(({ id, nativeTypeId, spawnTick: sampleSpawnTick }) => ({
      id,
      nativeTypeId,
      spawnTick: sampleSpawnTick,
    })),
    samples.map(() => ({
      id: samples[0]!.id,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.IMP,
      spawnTick,
    })),
  )
})

test('projects armor, shields, burning, and owned Mage lightning pulses', () => {
  const players = {
    player: {
      alive: true,
      collisionRadius: 25,
      connected: true,
      eligible: true,
      position: { x: 150, y: 0 },
      velocityPerTick: { x: 0, y: 0 },
    },
  } as const
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('projection-modifiers'), {
    firstProjectileWorldContact: () => null,
    players,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETONMAGE',
      flags: ['FLAG_BURNING', 'FLAG_CASTLIGHTNING'],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETONMAGE,
      position: { x: 0, y: 0 },
      spawnTick: 0,
      waveOrdinal: 1,
    }, {
      enemyToken: 'SKELETON',
      flags: ['FLAG_ARMOR'],
      id: 2,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 300, y: 0 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const actor = spawned.store.actors[0]!
  const brain = actor.brain
  assert.equal(brain.family, 'mage')
  if (brain.family !== 'mage') throw new Error('expected Mage brain')
  const startedTick = 10
  const attacked = stepBoneyardEnemyStore({
    ...spawned.store,
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
    }, spawned.store.actors[1]!],
  }, {
    clipSpellSegment: ({ end }) => end,
    firstProjectileWorldContact: () => null,
    players,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [],
    tick: startedTick,
  })
  assert.equal(attacked.playerDamage[0]?.amount, 12)
  const store = {
    ...attacked.store,
    actors: [{
      ...attacked.store.actors[0]!,
      shieldHealth: 25,
      shieldMaximumHealth: 50,
      shieldPulse: 3,
      shieldSoundCooldownTicks: 0,
    }, attacked.store.actors[1]!],
  }

  const projected = projectBoneyardEnemies(store, startedTick)
  const created = projected[0]!
  assert.equal(projected[1]?.armored, true)
  assert.deepEqual(created.lighting, attacked.store.actors[0]!.lighting)
  assert.notEqual(created.lighting, attacked.store.actors[0]!.lighting)
  assert.equal(created.shieldHealth, 25)
  assert.equal(created.shieldMaximumHealth, 50)
  assert.deepEqual(created.animation.effects.map(({ alpha, role }) => ({ alpha, role })), [
    { alpha: 1.25, role: 'magic-shield' },
  ])
  assert.equal(created.animation.effects[0]?.entry, 49)
  assert.deepEqual(created.animation.effects[0]?.offset, { x: 0, y: -30 })
  assert.ok(Math.abs(
    created.animation.effects[0]!.scale
      - (1.5 + 0.1 * Math.sin(startedTick * 20 * Math.PI / 180)),
  ) < 1e-12)
  const pulses = projectBoneyardMageLightningPulses(store)
  assert.equal(pulses.length, 1)
  assert.deepEqual(pulses[0], attacked.store.mageLightningPulses[0])
  assert.notEqual(pulses[0], attacked.store.mageLightningPulses[0])
  assert.notEqual(pulses[0]!.source, attacked.store.mageLightningPulses[0]!.source)
  assert.notEqual(pulses[0]!.contact, attacked.store.mageLightningPulses[0]!.contact)
})

test('projects Skeleton claw programs from armor and keeps body pose independent of gait', () => {
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('claw-projection'), {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [
      {
        enemyToken: 'SKELETON',
        flags: [],
        id: 1,
        locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
        position: { x: 0, y: 0 },
        spawnTick: 0,
        waveOrdinal: 1,
      },
      {
        enemyToken: 'SKELETON',
        flags: ['FLAG_ARMOR'],
        id: 2,
        locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
        position: { x: 40, y: 0 },
        spawnTick: 0,
        waveOrdinal: 1,
      },
    ],
    tick: 0,
  })
  const attacking = spawned.store.actors.map((actor, index) => {
    if (actor.brain.family !== 'skeleton') throw new Error('expected Skeleton brain')
    return {
      ...actor,
      bodyPose: index === 0 ? 4 : 2,
      brain: {
        ...actor.brain,
        actionProgress: 0,
        phase: 'attack' as const,
      },
      gaitPose: 6,
      headFacingOffset: index === 0 ? -1 as const : 1 as const,
    }
  })
  const projected = projectBoneyardEnemies({ ...spawned.store, actors: attacking }, 1)

  assert.deepEqual(projected.map(({ animation }) => ({
    action: animation.action,
    bodyPose: animation.bodyPose,
    gaitPose: animation.gaitPose,
    headFacingOffset: animation.headFacingOffset,
  })), [
    { action: 'skeleton-claw-a', bodyPose: 4, gaitPose: 6, headFacingOffset: -1 },
    { action: 'skeleton-claw-b', bodyPose: 2, gaitPose: 6, headFacingOffset: 1 },
  ])
})

function projectedMaggot(
  overrides: Partial<BoneyardMaggotActor>,
  tick = 12,
) {
  const maggot: BoneyardMaggotActor = {
    collisionRadius: 8,
    combatActive: true,
    currentHealth: 2,
    damage: 2,
    deathOffsets: [],
    deathEpoch: null,
    deathStartedTick: null,
    deathTick: 0,
    emergencePhase: 0,
    emergenceTick: 24,
    gaitPose: 0,
    headingDeg: 90,
    blizzardPushAccumulator: 0,
    blizzardPushLastTick: null,
    hurricaneContactCooldown: 0,
    id: 1,
    launchTrajectory: 'edge',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    launchVelocity: { x: 0, y: 0 },
    landingBounceVelocity: -0.4,
    lastAttackTick: null,
    lastDamagedByPlayerId: null,
    lastDamageTick: null,
    lastMovementTick: null,
    lifeState: 'alive',
    maximumHealth: 2,
    movementPhase: 'crawl',
    nativeCellBindingOrder: 1,
    nativeRegistrationOrder: 1,
    nextAttackTick: 20,
    nextMovementTick: 12,
    nextTargetRefreshTick: 300,
    ownerCoffinActorId: 2,
    path: TEST_ENEMY_PATH,
    poisonDamage: 0,
    poisonDuration: 0,
    position: { x: 100, y: 200 },
    spawnTick: 0,
    staffActionFactor: 1,
    staffMovementFactor: 1,
    targetPlayerId: 'player',
    terminalEmitted: false,
    verticalOffset: 0,
    verticalVelocity: 0,
    ...overrides,
  }
  return projectBoneyardMaggots({
    ...createBoneyardEnemyStore('maggot-emergence'),
    maggots: [maggot],
  }, tick)[0]!
}
