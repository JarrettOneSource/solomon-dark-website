import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { SolomonDigState } from '../core-kernels/boneyard.ts'
import type { BoneyardSolomonSnapshot } from '../protocol/game-state.ts'
import { buildBoneyardPainterOrder } from '../boneyard-painter-order.ts'
import {
  boneyardSolomonPainterLayers,
  boneyardSolomonVisualState,
  nativeSolomonDirection,
} from './boneyard-solomon-render.ts'

const DIG: SolomonDigState = {
  frameProgram: [0, 3, 17],
  gravePosition: { x: 10, y: 20 },
  lanternPosition: { x: -45, y: 93 },
  position: { x: 20, y: 133 },
  ticksPerFrame: 5,
}

const ENCOUNTER: BoneyardSolomonSnapshot = {
  acceleration: 0,
  digBodyOffsetY: 7.5,
  digEvents: [],
  digFrame: 17,
  escapeSpeed: 0,
  headingDeg: 0,
  lifetimeTicksRemaining: 0,
  mouthPose: 0,
  mouthPoseTicksRemaining: 25,
  motion: 0,
  phase: 'digging',
  phaseTicksRemaining: 0,
  position: { x: 20, y: 133 },
  runEventId: 0,
  targetPlayerId: null,
  transitionOffsetY: 0,
  turnRate: 0,
  voiceEvents: [],
  voiceTicksRemaining: 0,
  walkCycle: 0,
}

test('pins the registration-preserving stock Solomon sheets and Flydirt glyph', () => {
  const sheet = readFileSync(new URL(
    '../../assets/game/anim-solomon-encounter.png',
    import.meta.url,
  ))
  assert.equal(sheet.readUInt32BE(16), 3000)
  assert.equal(sheet.readUInt32BE(20), 2000)
  assert.equal(
    createHash('sha256').update(sheet).digest('hex'),
    '0db33945b1acf6e86832f942ad82679c1bc15e7ddd4fc7a633cd5d7b08d6e0ab',
  )
  const graveMark = readFileSync(new URL(
    '../../assets/game/boneyard/deadhawg/013.png',
    import.meta.url,
  ))
  assert.equal(graveMark.readUInt32BE(16), 46)
  assert.equal(graveMark.readUInt32BE(20), 10)
  assert.equal(
    createHash('sha256').update(graveMark).digest('hex'),
    'f3542e9d1b3621fdecd6f68baedf2d4f3c80762bd21ca7aa9fbb66e530db309c',
  )
  const dirt = readFileSync(new URL(
    '../../assets/game/solomon-flydirt.png',
    import.meta.url,
  ))
  assert.equal(dirt.readUInt32BE(16), 28)
  assert.equal(dirt.readUInt32BE(20), 46)
  assert.equal(
    createHash('sha256').update(dirt).digest('hex'),
    '1a2631f8022e0bef521aa112e4059c9ab7df5f6bfafbe6235972b92788ee95e7',
  )
})

test('uses the native 15-way 24-degree direction selector', () => {
  assert.equal(nativeSolomonDirection(0), 0)
  assert.equal(nativeSolomonDirection(11.999), 0)
  assert.equal(nativeSolomonDirection(12), 1)
  assert.equal(nativeSolomonDirection(348), 0)
  assert.equal(nativeSolomonDirection(359.999), 0)
})

test('registers the Lantern before Solomon with exact roots and zero biases', () => {
  assert.deepEqual(boneyardSolomonPainterLayers(
    DIG,
    ENCOUNTER,
    { managerLane: 'actor', registrationOrdinal: 7 },
    { managerLane: 'actor', registrationOrdinal: 8 },
  ), [
    {
      id: 'lantern',
      queueFamily: 'ordinary-dynamic',
      registration: { managerLane: 'actor', registrationOrdinal: 7 },
      sortBias: 0,
      worldY: 93,
    },
    {
      id: 'solomon-actor',
      queueFamily: 'ordinary-dynamic',
      registration: { managerLane: 'actor', registrationOrdinal: 8 },
      sortBias: 0,
      worldY: 133,
    },
  ])
})

test('preserves the stock Lantern-then-Solomon order on an exact painter-row tie', () => {
  const layers = boneyardSolomonPainterLayers(DIG, {
    ...ENCOUNTER,
    position: { x: ENCOUNTER.position.x, y: DIG.lanternPosition.y },
  },
  { managerLane: 'actor', registrationOrdinal: 0 },
  { managerLane: 'actor', registrationOrdinal: 1 })
  const order = buildBoneyardPainterOrder({
    dynamicLayers: layers,
    referenceY: 0,
    staticLayers: [],
  })

  assert.deepEqual(order.dynamicLayers.map(({ id, row }) => ({ id, row })), [
    { id: 'lantern', row: 46 },
    { id: 'solomon-actor', row: 46 },
  ])
})

test('keeps the independent Lantern resident after Solomon is gone', () => {
  assert.deepEqual(boneyardSolomonPainterLayers(DIG, {
    ...ENCOUNTER,
    phase: 'gone',
  },
  { managerLane: 'actor', registrationOrdinal: 3 },
  { managerLane: 'actor', registrationOrdinal: 4 }), [{
    id: 'lantern',
    queueFamily: 'ordinary-dynamic',
    registration: { managerLane: 'actor', registrationOrdinal: 3 },
    sortBias: 0,
    worldY: 93,
  }])
})

test('selects exact native dig, dialogue body, and mouth records', () => {
  const digging = boneyardSolomonVisualState(ENCOUNTER, DIG, 10)
  assert.equal(digging.bodyPose, 17)
  assert.equal(digging.nativeBodyRecord, 19)
  assert.equal(digging.nativeMouthRecord, null)
  assert.equal(digging.offsetY, 12.5)
  assert.deepEqual(digging.clipRectWorld, {
    height: 100, width: 200, x: -80, y: 33,
  })
  assert.equal(digging.graveMarkVisible, true)

  const dialogue = boneyardSolomonVisualState({
    ...ENCOUNTER,
    headingDeg: 48,
    mouthPose: 2,
    phase: 'speaking',
  }, DIG, 0)
  assert.equal(dialogue.direction, 2)
  assert.deepEqual(dialogue.clipRectWorld, {
    height: 1000, width: 2000, x: -980, y: -867,
  })
  assert.equal(dialogue.nativeBodyRecord, 215)
  assert.equal(dialogue.nativeMouthRecord, 260)
})

test('preserves the native emergence offset under the fixed ground-line clip', () => {
  const dialogue = boneyardSolomonVisualState({
    ...ENCOUNTER,
    phase: 'speaking',
    transitionOffsetY: 6,
  }, DIG, 0)

  assert.equal(dialogue.offsetY, 11)
  assert.deepEqual(dialogue.clipRectWorld, {
    height: 1000, width: 2000, x: -980, y: -867,
  })
})

test('holds the dialogue body aloft, then selects walk pose zero during retreat', () => {
  const hold = boneyardSolomonVisualState({
    ...ENCOUNTER,
    motion: 10,
    phase: 'retreat-hold',
  }, DIG, 0)
  assert.equal(hold.bodyBank, 'dialogue')
  assert.equal(hold.offsetY, 15)

  const retreat = boneyardSolomonVisualState({
    ...ENCOUNTER,
    acceleration: -1,
    headingDeg: 96,
    motion: -14,
    phase: 'retreat-accelerating',
  }, DIG, 0)
  assert.equal(retreat.bodyBank, 'walk')
  assert.equal(retreat.bodyPose, 0)
  assert.equal(retreat.nativeBodyRecord, 99)
  assert.equal(retreat.offsetY, -14)
  assert.deepEqual(retreat.clipRectWorld, {
    height: 1000, width: 2000, x: -980, y: -867,
  })
  assert.equal(retreat.graveMarkVisible, false)

  const descending = boneyardSolomonVisualState({
    ...ENCOUNTER,
    acceleration: 0,
    phase: 'retreat-accelerating',
  }, DIG, 0)
  assert.equal(descending.clipRectWorld, null)
})

test('selects the six-pose escape bank and hides Solomon only after expiry', () => {
  const escaping = boneyardSolomonVisualState({
    ...ENCOUNTER,
    headingDeg: 240,
    motion: -18,
    phase: 'escaping',
    walkCycle: 4.9,
  }, DIG, 0)
  assert.equal(escaping.direction, 10)
  assert.equal(escaping.bodyPose, 4)
  assert.equal(escaping.nativeBodyRecord, 165)
  assert.equal(escaping.offsetY, -18)
  assert.equal(escaping.visible, true)

  const gone = boneyardSolomonVisualState({
    ...ENCOUNTER,
    phase: 'gone',
  }, DIG, 0)
  assert.equal(gone.visible, false)
})
