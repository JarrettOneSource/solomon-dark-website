import assert from 'node:assert/strict'
import test from 'node:test'
import { createIdlePlayerPrimaryCast } from '../core-kernels/player-character.ts'
import { createPrimarySpellSimulation } from '../core-kernels/primary-spells.ts'
import {
  createBoneyardArenaTransition,
  startBoneyardArenaTransition,
  stepBoneyardArenaTransition,
} from '../core-kernels/boneyard-arena-transition.ts'

import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createPlayerDeathDrawPlan } from '../player-character-presentation.ts'
import {
  BOUNDED_PLAYER_DEATH_BURST_PROGRAM,
  PlayerDeathBurstCrossingTracker,
  playerDeathBurstLayers,
} from '../renderer/player-death-burst-presentation.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import type {
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemySnapshot,
  BoneyardMageLightningPulseSnapshot,
  BoneyardMaggotSnapshot,
} from '../protocol/game-state.ts'
import {
  createBoneyardPresentationTimeline,
  type BoneyardGameSnapshot,
} from './boneyard-presentation-timeline.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'fire',
} as const
const DEFAULT_SNAPSHOT = createGameSnapshot(createGameSimulation(), null)
const DEFAULT_PLAYER = DEFAULT_SNAPSHOT.players['local-player']!
const LIGHTING = DEFAULT_PLAYER.lighting

function playerAt(x: number): ProtocolPlayerState {
  return {
    config: { ...CHARACTER },
    economy: DEFAULT_PLAYER.economy,
    footstepTick: x,
    gaitDegrees: x,
    headingIndex: 0,
    lighting: LIGHTING,
    position: { x, y: 200 },
    primaryCast: createIdlePlayerPrimaryCast(),
    progression: DEFAULT_PLAYER.progression,
    velocity: { x: 100, y: 0 },
    walkCyclePrimary: x / 10 % 5,
  }
}

function enemyAt(x: number): BoneyardEnemySnapshot {
  return {
    animation: {
      action: null,
      actionProgress: 0,
      alpha: 1,
      bodyPose: 0,
      coffinPose: 0,
      coffinSecondaryPose: null,
      coffinState: 'closed',
      deathEpoch: 0,
      deathTick: 0,
      demonFrontJointRotationRadians: 0,
      demonFrontLimbRotationRadians: 0,
      demonRearJointRotationRadians: 0,
      demonRearLimbRotationRadians: 0,
      effects: [{
        alpha: x / 1_000,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 49,
        id: 10,
        offset: { x: x / 10, y: -2 },
        role: 'magic-shield',
        rotationRadians: 0,
        scale: 1,
      }],
      gaitPose: x / 10,
      headFacingOffset: 0,
      hitFlash: 0,
      impBodyRotationRadians: 0,
      impEffectAlpha: 0,
      impEffectFrame: 0,
      maggots: [],
      state: 'locomotion',
      verticalOffset: 0,
      zombieAngularOffsetDeg: 0,
      zombieAttackSide: 0,
      zombieBodyRotationRadians: 0,
      zombieBodyType: -1,
      zombieFlyblownSide: -1,
      zombieFrontArmPose: 0,
      zombieFrontArmRotationRadians: 0,
      zombieHeadType: -1,
      zombieHeadRotationRadians: 0,
      zombieRearArmPose: 0,
      zombieRearArmRotationRadians: 0,
    },
    armored: false,
    currentHealth: 6,
    enemyToken: 'SKELETON',
    flags: ['FLAG_WEAK'],
    headingDeg: 90,
    id: 1,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    lighting: {
      charge: 0,
      glow: 0,
      providerCopies: 0,
    },
    mageCloak: false,
    maximumHealth: 6,
    nativeTypeId: 1001,
    position: { x, y: 500 },
    shieldHealth: x / 10,
    shieldMaximumHealth: 100,
    spawnTick: 90,
  }
}

function enemyProjectileAt(x: number): BoneyardEnemyProjectileSnapshot {
  return {
    ageTicks: x / 10,
    contactRadius: 8,
    headingDeg: 90,
    homing: false,
    id: 1,
    kind: 'arrow',
    lightRegistration: null,
    lifetimeTicks: 300,
    nativeTypeId: 0x7da,
    ownerActorId: 1,
    payload: 'normal',
    position: { x, y: 475 },
    speed: x / 100,
    spawnTick: 90,
    verticalOffset: -x / 10,
    visualPhaseDeg: x,
    visualScale: 1 + x / 1_000,
  }
}

function maggotAt(x: number, hitFlash: number): BoneyardMaggotSnapshot {
  return {
    alpha: 1,
    currentHealth: 2,
    deathEpoch: 0,
    deathTick: 0,
    headingDeg: 90,
    hitFlash,
    id: 2,
    emergenceTick: x / 10,
    emergenceOrientation: 0,
    launchTrajectory: 'edge',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    maximumHealth: 2,
    ownerCoffinActorId: 1,
    pose: x / 100,
    position: { x, y: 480 },
    spawnTick: 90,
    state: 'emerging',
    verticalOffset: -x / 10,
  }
}

function magePulse(tick: number): BoneyardMageLightningPulseSnapshot {
  return {
    contact: {
      kind: 'world',
      position: { x: tick + 3, y: 27 },
    },
    endpoint: { x: tick + 1, y: 20 },
    id: tick,
    midpoint: { x: tick - 20, y: 10 },
    ownerActorId: 1,
    seed: tick,
    source: { x: tick - 40, y: 0 },
    tick,
  }
}

function snapshotAt(tick: number, playerX: number, gateTipX: number): BoneyardGameSnapshot {
  return {
    hostPlayerId: 'local',
    levelUpBarrier: null,
    players: { local: playerAt(playerX) },
    primarySpells: createPrimarySpellSimulation(),
    secondaryAbilities: DEFAULT_SNAPSHOT.secondaryAbilities,
    run: {
      eligiblePlayerIds: ['local'],
      gameOverEventId: 0,
      gameOverExitTicks: null,
      gameOverTicks: 0,
      lastCompletedRunId: null,
      nextGameOverEventId: 1,
      phase: 'active',
      runId: 'run-1',
    },
    tick,
    world: {
      arenaTransition: createBoneyardArenaTransition(
        { x: 0, y: 0, w: 1_000, h: 1_000 },
        { x: 500, y: 100 },
      ),
      deathEffects: [],
      encounter: {
        acceleration: tick >= 105 ? -3 : -7,
        digAudioEvents: [],
        digFrame: tick >= 105 ? 5 : 17,
        escapeSpeed: tick >= 105 ? 2 : 0,
        headingDeg: tick >= 105 ? 90 : 45,
        lifetimeTicksRemaining: tick >= 105 ? 515 : 0,
        mouthPose: tick >= 105 ? 2 : 0,
        mouthPoseTicksRemaining: 25,
        motion: 0,
        phase: tick >= 105 ? 'escaping' : 'digging',
        phaseTicksRemaining: 0,
        position: { x: playerX + 300, y: 400 },
        runEventId: tick >= 105 ? 1 : 0,
        targetPlayerId: tick >= 105 ? 'local' : null,
        transitionOffsetY: tick >= 105 ? 5 : 15,
        turnRate: tick >= 105 ? 10 : 0,
        voiceEvents: tick >= 105
          ? [{ cue: 'solomon-hello-1', id: 1 }]
          : [],
        voiceTicksRemaining: 0,
        walkCycle: tick >= 105 ? 2.5 : 0,
      },
      enemies: [enemyAt(gateTipX + 300)],
      enemyEvents: [],
      enemyProjectileEffects: [],
      enemyProjectiles: [enemyProjectileAt(gateTipX + 200)],
      gateLeaves: [{
        fenceEid: 'gate-1',
        hinge: { x: 50, y: 300 },
        id: 'gate-1:0',
        side: 0,
        tip: { x: gateTipX, y: 300 },
      }],
      goodies: [],
      kind: 'boneyard',
      lanternLightRegistration: { managerLane: 'actor', registrationOrdinal: 2 },
      loot: [],
      lootEvents: [],
      mageLightningPulses: [],
      maggots: [maggotAt(gateTipX + 100, tick >= 105 ? 1 : 0)],
      runId: 'run-1',
      waves: {
        interwaveDelayTicks: 0,
        pendingSpawnBudget: tick >= 105 ? 13 : 14,
        phase: tick >= 105 ? 'spawning' : 'dormant',
        scheduleIndex: 0,
        spawnDelayTicks: 0,
        waveEventId: tick >= 105 ? 1 : 0,
        waveOrdinal: tick >= 105 ? 1 : 0,
      },
    },
  }
}

function impSnapshotAt(
  tick: number,
  animation: Partial<BoneyardEnemySnapshot['animation']>,
): BoneyardGameSnapshot {
  const snapshot = snapshotAt(tick, 10, 100)
  const source = snapshot.world.enemies[0]!
  return {
    ...snapshot,
    world: {
      ...snapshot.world,
      enemies: [{
        ...source,
        animation: {
          ...source.animation,
          state: 'idle',
          ...animation,
        },
        enemyToken: 'IMP',
        nativeTypeId: 1004,
      }],
    },
  }
}

function deathSnapshotAt(tick: number, deathEpochTick: number): BoneyardGameSnapshot {
  const snapshot = snapshotAt(tick, 10, 100)
  const deathTick = tick - deathEpochTick
  const player = snapshot.players.local
  return {
    ...snapshot,
    players: {
      local: {
        ...player,
        lighting: { ...player.lighting, driveActive: true },
        progression: {
          ...player.progression,
          currentHealth: 0,
          deathEpoch: 1,
          deathTick,
          lifeState: deathTick >= 159 ? 'spectating' : 'dying',
        },
      },
    },
  }
}

test('interpolates Boneyard actors and gate leaves at display time', () => {
  const older = snapshotAt(100, 10, 100)
  const newerBase = snapshotAt(105, 20, 120)
  const newer = {
    ...newerBase,
    players: {
      ...newerBase.players,
      local: {
        ...newerBase.players.local,
        progression: {
          ...newerBase.players.local.progression,
          currentHealth: 40,
          lastDamageTick: 103,
        },
      },
    },
  }
  newer.world.lanternLightRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 7,
  }
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: older,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(newer, 50)

  assert.equal(timeline.sample(50).players.local.position.x, 10)
  assert.equal(timeline.sample(75).players.local.position.x, 15)
  assert.equal(timeline.sample(75).players.local.footstepTick, 10)
  assert.equal(timeline.sample(75).players.local.progression.currentHealth, 50)
  assert.equal(timeline.sample(75).players.local.progression.lastDamageTick, null)
  assert.equal(timeline.sample(75).world.gateLeaves[0].tip.x, 110)
  assert.equal(timeline.sample(75).world.encounter?.position.x, 315)
  assert.equal(timeline.sample(75).world.encounter?.acceleration, -5)
  assert.equal(timeline.sample(75).world.encounter?.digFrame, 17)
  assert.equal(timeline.sample(75).world.encounter?.phase, 'digging')
  assert.equal(timeline.sample(75).world.encounter?.transitionOffsetY, 10)
  assert.deepEqual(timeline.sample(75).world.encounter?.voiceEvents, [])
  assert.equal(timeline.sample(75).world.enemies[0].position.x, 410)
  assert.equal(timeline.sample(75).world.enemies[0].shieldHealth, 41)
  assert.ok(Math.abs(
    timeline.sample(75).world.enemies[0].animation.effects[0]!.alpha - 0.41,
  ) < 1e-9)
  assert.equal(timeline.sample(75).world.enemies[0].animation.effects[0]?.offset.x, 41)
  assert.equal(timeline.sample(75).world.enemyProjectiles[0].position.x, 310)
  assert.equal(timeline.sample(75).world.enemyProjectiles[0].speed, 3.1)
  assert.equal(timeline.sample(75).world.enemyProjectiles[0].verticalOffset, -31)
  assert.equal(timeline.sample(75).world.enemyProjectiles[0].visualPhaseDeg, 310)
  assert.equal(timeline.sample(75).world.enemyProjectiles[0].visualScale, 1.31)
  assert.equal(timeline.sample(75).world.maggots[0].position.x, 210)
  assert.equal(timeline.sample(75).world.maggots[0].emergenceTick, 21)
  assert.equal(timeline.sample(75).world.maggots[0].verticalOffset, -21)
  assert.equal(timeline.sample(75).world.maggots[0].hitFlash, 0.5)
  assert.deepEqual(timeline.sample(75).world.lanternLightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 2,
  })
  assert.notEqual(
    timeline.sample(75).world.lanternLightRegistration,
    older.world.lanternLightRegistration,
  )
  assert.equal(timeline.sample(75).world.waves?.phase, 'dormant')
  assert.equal(timeline.sample(100).players.local.position.x, 20)
  assert.equal(timeline.sample(100).players.local.footstepTick, 20)
  assert.equal(timeline.sample(100).players.local.progression.currentHealth, 40)
  assert.equal(timeline.sample(100).players.local.progression.lastDamageTick, 103)
  assert.equal(timeline.sample(100).world.encounter?.phase, 'escaping')
  assert.equal(timeline.sample(100).world.encounter?.digFrame, 5)
  assert.deepEqual(timeline.sample(100).world.encounter?.voiceEvents, [
    { cue: 'solomon-hello-1', id: 1 },
  ])
  assert.deepEqual(timeline.sample(100).world.lanternLightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 7,
  })
})

test('interpolates the native camera lock while retaining owned combat bounds', () => {
  const older = snapshotAt(100, 10, 100)
  const newer = snapshotAt(105, 20, 120)
  newer.world.arenaTransition = stepBoneyardArenaTransition(
    startBoneyardArenaTransition(newer.world.arenaTransition!),
  )
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: older,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(newer, 50)

  const halfway = timeline.sample(75).world.arenaTransition
  assert.ok(halfway)
  assert.ok(halfway.cameraBounds.y > older.world.arenaTransition!.cameraBounds.y)
  assert.ok(halfway.cameraBounds.y < newer.world.arenaTransition.cameraBounds.y)
  assert.deepEqual(halfway.combatBounds, newer.world.arenaTransition.combatBounds)
  assert.notEqual(halfway.cameraBounds, newer.world.arenaTransition.cameraBounds)
  assert.notEqual(halfway.combatBounds, newer.world.arenaTransition.combatBounds)
})

test('merges every 100 Hz Mage pulse discretely across 20 Hz snapshot boundaries', () => {
  const older = snapshotAt(100, 10, 100)
  older.world.mageLightningPulses = [96, 97, 98, 99, 100].map(magePulse)
  const newer = snapshotAt(105, 20, 120)
  newer.world.mageLightningPulses = [101, 102, 103, 104, 105].map(magePulse)
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: older,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(newer, 50)

  assert.deepEqual(
    timeline.sample(59).world.mageLightningPulses.map(({ tick }) => tick),
    [96, 97, 98, 99, 100],
  )
  assert.deepEqual(
    timeline.sample(60).world.mageLightningPulses.map(({ tick }) => tick),
    [97, 98, 99, 100, 101],
  )
  assert.deepEqual(
    timeline.sample(80).world.mageLightningPulses.map(({ tick }) => tick),
    [99, 100, 101, 102, 103],
  )
  assert.deepEqual(
    timeline.sample(100).world.mageLightningPulses.map(({ tick }) => tick),
    [101, 102, 103, 104, 105],
  )

  const owned = timeline.sample(60).world.mageLightningPulses.at(-1)!
  assert.notEqual(owned, newer.world.mageLightningPulses[0])
  assert.notEqual(owned.source, newer.world.mageLightningPulses[0]!.source)
  assert.notEqual(owned.contact, newer.world.mageLightningPulses[0]!.contact)
  owned.source.x = -999
  assert.equal(timeline.sample(60).world.mageLightningPulses.at(-1)!.source.x, 61)
})

test('late-join Mage pulse state retains only currently live ages', () => {
  const late = snapshotAt(105, 20, 120)
  late.world.mageLightningPulses = [100, 101, 102, 103, 104, 105].map(magePulse)
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: late,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  assert.deepEqual(
    timeline.sample(0).world.mageLightningPulses.map(({ tick }) => tick),
    [101, 102, 103, 104, 105],
  )
})

test('holds enemy-lighting state discretely and returns an owned copy', () => {
  const older = snapshotAt(100, 10, 100)
  const newer = snapshotAt(105, 20, 120)
  older.world.enemies[0]!.lighting = {
    charge: 0.25,
    glow: 0.5,
    providerCopies: 1,
  }
  newer.world.enemies[0]!.lighting = {
    charge: 0.75,
    glow: 1,
    providerCopies: 2,
  }
  newer.world.enemies[0]!.lightRegistration = {
    managerLane: 'actor',
    registrationOrdinal: 9,
  }
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: older,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(newer, 50)

  const midpoint = timeline.sample(75).world.enemies[0]!
  assert.deepEqual(midpoint.lighting, older.world.enemies[0]!.lighting)
  assert.notEqual(midpoint.lighting, older.world.enemies[0]!.lighting)
  assert.deepEqual(midpoint.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 1,
  })
  assert.notEqual(midpoint.lightRegistration, older.world.enemies[0]!.lightRegistration)
  midpoint.lighting.glow = 0
  assert.deepEqual(timeline.sample(75).world.enemies[0]!.lighting, {
    charge: 0.25,
    glow: 0.5,
    providerCopies: 1,
  })
  assert.deepEqual(timeline.sample(100).world.enemies[0]!.lighting, {
    charge: 0.75,
    glow: 1,
    providerCopies: 2,
  })
  assert.deepEqual(timeline.sample(100).world.enemies[0]!.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 9,
  })
})

test('holds authoritative player-lighting state discretely and returns an owned copy', () => {
  const older = snapshotAt(100, 10, 100)
  const newer = snapshotAt(105, 20, 120)
  older.players.local.lighting = {
    ...LIGHTING,
    driveActive: false,
    overlayEffectPhase: 0.135,
  }
  newer.players.local.lighting = {
    ...LIGHTING,
    driveActive: true,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 8 },
    overlayEffectPhase: 0.225,
  }
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: older,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(newer, 50)

  const midpoint = timeline.sample(75).players.local.lighting
  assert.deepEqual(midpoint, older.players.local.lighting)
  assert.notEqual(midpoint, older.players.local.lighting)
  midpoint.overlayEffectPhase = 0
  assert.deepEqual(timeline.sample(75).players.local.lighting, {
    driveActive: false,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
    overlayEffectPhase: 0.135,
  })
  assert.deepEqual(timeline.sample(100).players.local.lighting, newer.players.local.lighting)
  assert.notEqual(
    timeline.sample(100).players.local.lighting.lightRegistration,
    newer.players.local.lighting.lightRegistration,
  )
})

test('interpolates independent death-effect transforms without rerolling art identity', () => {
  const older = snapshotAt(100, 10, 100)
  const newer = snapshotAt(105, 20, 120)
  older.world.deathEffects = [{
    ageTicks: 0,
    alpha: 1,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 117,
    height: -20,
    id: 9,
    kind: 'bouncer',
    ownerActorId: 1,
    position: { x: 100, y: 200 },
    rotationRadians: Math.PI * 1.9,
    scale: 1.2,
    shadow: false,
    spawnTick: 100,
    tint: 0xffffff,
  }]
  newer.world.deathEffects = [{
    ...older.world.deathEffects[0]!,
    ageTicks: 5,
    alpha: 0.75,
    height: -10,
    position: { x: 110, y: 220 },
    rotationRadians: Math.PI * 0.1,
  }]
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: older,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(newer, 50)

  const effect = timeline.sample(75).world.deathEffects[0]!
  assert.equal(effect.id, 9)
  assert.equal(effect.ownerActorId, 1)
  assert.equal(effect.entry, 117)
  assert.equal(effect.ageTicks, 2.5)
  assert.equal(effect.alpha, 0.875)
  assert.equal(effect.height, -15)
  assert.deepEqual(effect.position, { x: 105, y: 210 })
  assert.ok(Math.abs(effect.rotationRadians) < 1e-9)
})

test('interpolates projectile-owned effects after their projectile has retired', () => {
  const older = snapshotAt(100, 10, 100)
  const newer = snapshotAt(105, 20, 120)
  older.world.enemyProjectiles = []
  newer.world.enemyProjectiles = []
  older.world.enemyProjectileEffects = [{
    ageTicks: 5,
    alpha: 0.75,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 260,
    id: 12,
    kind: 'firebolt-trail',
    lifetimeTicks: 12,
    ownerActorId: 1,
    ownerProjectileId: 9,
    phaseOriginTicks: 20,
    position: { x: 100, y: 200 },
    rotationRadians: Math.PI * 1.9,
    scale: 1,
    spawnTick: 95,
    tint: 0xff4949,
  }]
  newer.world.enemyProjectileEffects = [{
    ...older.world.enemyProjectileEffects[0]!,
    ageTicks: 10,
    alpha: 1 / 6,
    position: { x: 110, y: 220 },
    rotationRadians: Math.PI * 0.1,
    scale: 1.2,
  }]
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: older,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(newer, 50)

  const effect = timeline.sample(75).world.enemyProjectileEffects[0]!
  assert.equal(effect.id, 12)
  assert.equal(effect.ownerProjectileId, 9)
  assert.equal(effect.entry, 260)
  assert.equal(effect.ageTicks, 7.5)
  assert.ok(Math.abs(effect.alpha - 11 / 24) < 1e-12)
  assert.deepEqual(effect.position, { x: 105, y: 210 })
  assert.ok(Math.abs(effect.rotationRadians) < 1e-9)
  assert.equal(effect.scale, 1.1)
})

test('interpolates the authoritative Imp flight cycle without changing spawn identity', () => {
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: impSnapshotAt(100, {
      alpha: 1,
      bodyPose: 3,
      impBodyRotationRadians: -0.2,
      impEffectAlpha: 1,
      impEffectFrame: 9,
      verticalOffset: 0,
    }),
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(impSnapshotAt(105, {
    alpha: 1,
    bodyPose: 0,
    impBodyRotationRadians: 0.3,
    impEffectAlpha: 0.5,
    impEffectFrame: 1,
    verticalOffset: -4,
  }), 50)

  const midpoint = timeline.sample(75).world.enemies[0]!
  assert.equal(midpoint.animation.bodyPose, 3)
  assert.equal(midpoint.animation.alpha, 1)
  assert.equal(midpoint.animation.impBodyRotationRadians, -0.2)
  assert.equal(midpoint.animation.impEffectAlpha, 0.75)
  assert.equal(midpoint.animation.verticalOffset, -2)
  assert.equal(midpoint.animation.impEffectFrame, 0)
  assert.equal(midpoint.id, 1)
  assert.equal(midpoint.spawnTick, 90)

  const completed = timeline.sample(100).world.enemies[0]!
  assert.equal(completed.animation.bodyPose, 0)
  assert.equal(completed.animation.impBodyRotationRadians, 0.3)
  assert.equal(completed.animation.impEffectAlpha, 0.5)
  assert.equal(completed.animation.impEffectFrame, 1)
  assert.equal(completed.id, midpoint.id)
  assert.equal(completed.spawnTick, midpoint.spawnTick)

  const sameVariant = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: impSnapshotAt(100, {
      bodyPose: 3,
      impBodyRotationRadians: -0.2,
    }),
    serverTickRate: 100,
    snapshotRate: 20,
  })
  sameVariant.push(impSnapshotAt(105, {
    bodyPose: 3,
    impBodyRotationRadians: 0.3,
  }), 50)
  assert.equal(
    sameVariant.sample(75).world.enemies[0]!.animation.impBodyRotationRadians,
    -0.2,
  )
})

test('holds native body and head-facing selectors discretely between authoritative snapshots', () => {
  const withSelectors = (
    snapshot: BoneyardGameSnapshot,
    bodyPose: number,
    headFacingOffset: -1 | 0 | 1,
  ) => ({
    ...snapshot,
    world: {
      ...snapshot.world,
      enemies: [{
        ...snapshot.world.enemies[0]!,
        animation: {
          ...snapshot.world.enemies[0]!.animation,
          bodyPose,
          headFacingOffset,
        },
      }],
    },
  })
  const older = withSelectors(snapshotAt(100, 10, 100), 2, -1)
  const newer = withSelectors(snapshotAt(105, 10, 100), 8, 1)
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: older,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(newer, 50)

  assert.equal(timeline.sample(75).world.enemies[0]!.animation.bodyPose, 2)
  assert.equal(timeline.sample(75).world.enemies[0]!.animation.headFacingOffset, -1)
  assert.equal(timeline.sample(100).world.enemies[0]!.animation.bodyPose, 8)
  assert.equal(timeline.sample(100).world.enemies[0]!.animation.headFacingOffset, 1)
})

test('preserves every player corpse frame at 20 Hz for all death-epoch alignments', () => {
  for (let deathEpochTick = 0; deathEpochTick < 5; deathEpochTick += 1) {
    const timeline = createBoneyardPresentationTimeline({
      initialReceivedAtMs: 0,
      initialSnapshot: deathSnapshotAt(145, deathEpochTick),
      serverTickRate: 100,
      snapshotRate: 20,
    })
    const corpseFrames: number[] = []

    for (let snapshotTick = 150; snapshotTick <= 165; snapshotTick += 5) {
      const receivedAtMs = (snapshotTick - 145) * 10
      timeline.push(deathSnapshotAt(snapshotTick, deathEpochTick), receivedAtMs)
      for (let offsetMs = 0; offsetMs <= 50; offsetMs += 10) {
        const player = timeline.sample(receivedAtMs + offsetMs).players.local
        const corpseFrame = createPlayerDeathDrawPlan(
          player.headingIndex,
          player.progression.lifeState,
          player.progression.deathTick,
        ).frame
        if (corpseFrames.at(-1) !== corpseFrame) corpseFrames.push(corpseFrame)
      }
    }

    assert.deepEqual(corpseFrames, [0, 1, 2, 3], `death epoch tick ${deathEpochTick}`)
  }
})

test('presents both native Game Over fades at the 100 Hz simulation clock', () => {
  const gameOverSnapshot = (
    tick: number,
    gameOverTicks: number,
    gameOverExitTicks: number | null,
  ): BoneyardGameSnapshot => {
    const snapshot = snapshotAt(tick, 10, 100)
    return {
      ...snapshot,
      run: {
        ...snapshot.run,
        gameOverEventId: 1,
        gameOverExitTicks,
        gameOverTicks,
        nextGameOverEventId: 2,
        phase: 'game-over',
      },
    }
  }
  const entry = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: gameOverSnapshot(100, 0, null),
    serverTickRate: 100,
    snapshotRate: 20,
  })
  entry.push(gameOverSnapshot(105, 5, null), 50)
  assert.equal(entry.sample(75).run.gameOverTicks, 2)

  const exit = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: gameOverSnapshot(110, 1_000, 1),
    serverTickRate: 100,
    snapshotRate: 20,
  })
  exit.push(gameOverSnapshot(115, 1_005, 6), 50)
  assert.equal(exit.sample(75).run.gameOverExitTicks, 3)
  assert.equal(exit.sample(75).run.gameOverTicks, 1_002)

  const automaticAcceptance = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: gameOverSnapshot(120, 999, null),
    serverTickRate: 100,
    snapshotRate: 20,
  })
  automaticAcceptance.push(gameOverSnapshot(125, 1_004, 5), 50)
  assert.equal(automaticAcceptance.sample(75).run.gameOverExitTicks, null)
  assert.equal(automaticAcceptance.sample(100).run.gameOverExitTicks, 5)
})

test('emits one finite tick-159 death burst for all five snapshot alignments', () => {
  for (let deathEpochTick = 0; deathEpochTick < 5; deathEpochTick += 1) {
    const initial = deathSnapshotAt(145, deathEpochTick)
    const timeline = createBoneyardPresentationTimeline({
      initialReceivedAtMs: 0,
      initialSnapshot: initial,
      serverTickRate: 100,
      snapshotRate: 20,
    })
    const crossing = new PlayerDeathBurstCrossingTracker(initial)
    const triggers = []
    for (let snapshotTick = 150; snapshotTick <= 165; snapshotTick += 5) {
      const receivedAtMs = (snapshotTick - 145) * 10
      timeline.push(deathSnapshotAt(snapshotTick, deathEpochTick), receivedAtMs)
      for (let offsetMs = 0; offsetMs <= 50; offsetMs += 10) {
        triggers.push(...crossing.update(timeline.sample(receivedAtMs + offsetMs)))
      }
    }
    assert.equal(triggers.length, 1, `death epoch tick ${deathEpochTick}`)
    const trigger = triggers[0]!
    const opening = playerDeathBurstLayers(trigger, 0)
    assert.equal(opening.length, BOUNDED_PLAYER_DEATH_BURST_PROGRAM.particleCount)
    assert.equal(opening.length, 18)
    assert.ok(opening.every((layer) => (
      layer.entry === 10
      && layer.alpha === 1
      && layer.scaleX === 0.5
      && layer.scaleY === 0.2
      && layer.tint === 0x808080
      && Math.hypot(layer.offset.x, layer.offset.y) >= 15
      && Math.hypot(layer.offset.x, layer.offset.y) <= 20
    )))
    assert.deepEqual(playerDeathBurstLayers(trigger, 0), opening)
    const ageOne = playerDeathBurstLayers(trigger, 1)
    const ageNine = playerDeathBurstLayers(trigger, 9)
    assert.ok(ageOne.every((layer) => layer.alpha === 0.9))
    assert.ok(ageNine.every((layer) => Math.abs(layer.alpha - 0.1) < 1e-12))
    for (let index = 0; index < opening.length; index += 1) {
      const firstMove = Math.hypot(
        ageOne[index]!.offset.x - opening[index]!.offset.x,
        ageOne[index]!.offset.y - opening[index]!.offset.y,
      )
      const ninthMove = Math.hypot(
        ageNine[index]!.offset.x - opening[index]!.offset.x,
        ageNine[index]!.offset.y - opening[index]!.offset.y,
      )
      assert.ok(firstMove >= 3 && firstMove <= 4)
      assert.ok(ninthMove >= 3 * 6.12579511 && ninthMove <= 4 * 6.12579511)
    }
    assert.deepEqual(
      playerDeathBurstLayers(trigger, BOUNDED_PLAYER_DEATH_BURST_PROGRAM.durationTicks),
      [],
    )
    crossing.destroy()
    assert.deepEqual(crossing.update(deathSnapshotAt(170, deathEpochTick)), [])
  }
})

test('death-burst crossing seeds late joiners and resets without replay on a new run', () => {
  const late = deathSnapshotAt(165, 0)
  const crossing = new PlayerDeathBurstCrossingTracker(late)
  assert.deepEqual(crossing.update(late), [])
  assert.deepEqual(crossing.update(deathSnapshotAt(170, 0)), [])

  const nextRun = deathSnapshotAt(165, 0)
  nextRun.world.runId = 'run-2'
  nextRun.run = { ...nextRun.run, runId: 'run-2' }
  assert.deepEqual(crossing.update(nextRun), [])

  const beforeNextBurst = deathSnapshotAt(158, 0)
  beforeNextBurst.world.runId = 'run-2'
  beforeNextBurst.run = { ...beforeNextBurst.run, runId: 'run-2' }
  beforeNextBurst.players.local.progression.deathEpoch = 2
  beforeNextBurst.players.local.progression.deathTick = 158
  beforeNextBurst.players.local.progression.lifeState = 'dying'
  assert.deepEqual(crossing.update(beforeNextBurst), [])

  const nextBurst = deathSnapshotAt(159, 0)
  nextBurst.world.runId = 'run-2'
  nextBurst.run = { ...nextBurst.run, runId: 'run-2' }
  nextBurst.players.local.progression.deathEpoch = 2
  assert.equal(crossing.update(nextBurst).length, 1)
  assert.deepEqual(crossing.update(nextBurst), [])
})

test('does not interpolate the player death clock across a new death epoch', () => {
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: snapshotAt(100, 10, 100),
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(deathSnapshotAt(105, 103), 50)

  assert.equal(timeline.sample(75).players.local.progression.lifeState, 'alive')
  assert.equal(timeline.sample(75).players.local.progression.deathTick, 0)
  assert.equal(timeline.sample(100).players.local.progression.lifeState, 'dying')
  assert.equal(timeline.sample(100).players.local.progression.deathTick, 2)
})

test('owns returned state and ignores stale Boneyard snapshots', () => {
  const initial = snapshotAt(10, 1, 80)
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: initial,
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(snapshotAt(9, 99, 999), 10)
  const frame = timeline.sample(10)

  assert.equal(timeline.latest().tick, 10)
  assert.deepEqual(frame, initial)
  assert.notEqual(frame, initial)
  assert.notEqual(frame.players.local, initial.players.local)
  assert.notEqual(frame.world.gateLeaves[0], initial.world.gateLeaves[0])
  assert.notEqual(frame.world.encounter, initial.world.encounter)
  assert.notEqual(frame.world.waves, initial.world.waves)
  assert.notEqual(frame.world.enemies[0], initial.world.enemies[0])
  assert.notEqual(frame.world.enemies[0].lighting, initial.world.enemies[0].lighting)
  assert.notEqual(
    frame.world.enemies[0].animation.effects[0],
    initial.world.enemies[0].animation.effects[0],
  )
  assert.notEqual(frame.world.enemyProjectiles[0], initial.world.enemyProjectiles[0])
  assert.notEqual(
    frame.world.enemyProjectileEffects,
    initial.world.enemyProjectileEffects,
  )
  assert.notEqual(frame.world.maggots[0], initial.world.maggots[0])
})
