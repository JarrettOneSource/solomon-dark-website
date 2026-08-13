import assert from 'node:assert/strict'
import test from 'node:test'

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
    velocity: { x: 100, y: 0 },
    walkCyclePrimary: x / 10 % 5,
  }
}

function snapshotAt(tick: number, playerX: number, gateTipX: number): BoneyardGameSnapshot {
  return {
    hostPlayerId: 'local',
    players: { local: playerAt(playerX) },
    tick,
    world: {
      gateLeaves: [{
        fenceEid: 'gate-1',
        hinge: { x: 50, y: 300 },
        id: 'gate-1:0',
        side: 0,
        tip: { x: gateTipX, y: 300 },
      }],
      kind: 'boneyard',
      runId: 'run-1',
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
  assert.equal(timeline.sample(100).players.local.position.x, 20)
  assert.equal(timeline.sample(100).players.local.footstepTick, 20)
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
})
