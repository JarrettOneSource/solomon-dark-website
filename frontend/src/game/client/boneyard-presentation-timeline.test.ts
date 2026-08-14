import assert from 'node:assert/strict'
import test from 'node:test'
import { createIdlePlayerPrimaryCast } from '../core-kernels/player-character.ts'
import { createPrimarySpellSimulation } from '../core-kernels/primary-spells.ts'

import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import {
  createBoneyardPresentationTimeline,
  type BoneyardGameSnapshot,
} from './boneyard-presentation-timeline.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'fire',
} as const

function playerAt(x: number): ProtocolPlayerState {
  return {
    config: { ...CHARACTER },
    footstepTick: x,
    gaitDegrees: x,
    headingIndex: 0,
    position: { x, y: 200 },
    primaryCast: createIdlePlayerPrimaryCast(),
    velocity: { x: 100, y: 0 },
    walkCyclePrimary: x / 10 % 5,
  }
}

function snapshotAt(tick: number, playerX: number, gateTipX: number): BoneyardGameSnapshot {
  return {
    hostPlayerId: 'local',
    players: { local: playerAt(playerX) },
    primarySpells: createPrimarySpellSimulation(),
    tick,
    world: {
      encounter: {
        acceleration: tick >= 105 ? -3 : -7,
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
      gateLeaves: [{
        fenceEid: 'gate-1',
        hinge: { x: 50, y: 300 },
        id: 'gate-1:0',
        side: 0,
        tip: { x: gateTipX, y: 300 },
      }],
      kind: 'boneyard',
      runId: 'run-1',
      waves: {
        enemies: [{
          enemyToken: 'SKELETON',
          flags: ['FLAG_WEAK'],
          headingDeg: 90,
          id: 1,
          locationPolicy: 'near-player',
          nativeTypeId: 1001,
          position: { x: gateTipX + 300, y: 500 },
          spawnTick: 90,
          targetPlayerId: 'local',
        }],
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

test('interpolates Boneyard actors and gate leaves at display time', () => {
  const timeline = createBoneyardPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: snapshotAt(100, 10, 100),
    serverTickRate: 100,
    snapshotRate: 20,
  })
  timeline.push(snapshotAt(105, 20, 120), 50)

  assert.equal(timeline.sample(50).players.local.position.x, 10)
  assert.equal(timeline.sample(75).players.local.position.x, 15)
  assert.equal(timeline.sample(75).players.local.footstepTick, 10)
  assert.equal(timeline.sample(75).world.gateLeaves[0].tip.x, 110)
  assert.equal(timeline.sample(75).world.encounter?.position.x, 315)
  assert.equal(timeline.sample(75).world.encounter?.acceleration, -5)
  assert.equal(timeline.sample(75).world.encounter?.digFrame, 17)
  assert.equal(timeline.sample(75).world.encounter?.phase, 'digging')
  assert.equal(timeline.sample(75).world.encounter?.transitionOffsetY, 10)
  assert.deepEqual(timeline.sample(75).world.encounter?.voiceEvents, [])
  assert.equal(timeline.sample(75).world.waves?.enemies[0].position.x, 410)
  assert.equal(timeline.sample(75).world.waves?.phase, 'dormant')
  assert.equal(timeline.sample(100).players.local.position.x, 20)
  assert.equal(timeline.sample(100).players.local.footstepTick, 20)
  assert.equal(timeline.sample(100).world.encounter?.phase, 'escaping')
  assert.equal(timeline.sample(100).world.encounter?.digFrame, 5)
  assert.deepEqual(timeline.sample(100).world.encounter?.voiceEvents, [
    { cue: 'solomon-hello-1', id: 1 },
  ])
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
  assert.notEqual(frame.world.waves?.enemies[0], initial.world.waves?.enemies[0])
})
