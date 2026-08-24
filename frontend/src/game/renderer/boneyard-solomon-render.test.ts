import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { SolomonDigState } from '../core-kernels/boneyard.ts'
import type { BoneyardSolomonSnapshot } from '../protocol/game-state.ts'
import {
  boneyardSolomonVisualState,
  nativeSolomonDirection,
} from './boneyard-solomon-render.ts'

const DIG: SolomonDigState = {
  frameProgram: [0, 3, 17],
  gravePosition: { x: 10, y: 20 },
  lanternPosition: { x: 30, y: 40 },
  position: { x: 50, y: 60 },
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
  position: { x: 50, y: 60 },
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
  const shadow = readFileSync(new URL(
    '../../assets/game/boneyard/deadhawg/013.png',
    import.meta.url,
  ))
  assert.equal(shadow.readUInt32BE(16), 46)
  assert.equal(shadow.readUInt32BE(20), 10)
  assert.equal(
    createHash('sha256').update(shadow).digest('hex'),
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

test('keeps Flydirt in Solomon child-manager order after body and mouth', () => {
  const source = readFileSync(new URL(
    './boneyard-world-renderer.ts',
    import.meta.url,
  ), 'utf8')
  assert.match(source, /this\.mouth\.zIndex = 1/)
  assert.match(source, /this\.dirtRoot\.zIndex = 2/)
  assert.match(source, /this\.dirtRoot\.tint = lighting\.dirtTint/)
})

test('uses the native 15-way 24-degree direction selector', () => {
  assert.equal(nativeSolomonDirection(0), 0)
  assert.equal(nativeSolomonDirection(11.999), 0)
  assert.equal(nativeSolomonDirection(12), 1)
  assert.equal(nativeSolomonDirection(348), 0)
  assert.equal(nativeSolomonDirection(359.999), 0)
})

test('selects exact native dig, dialogue body, and mouth records', () => {
  const digging = boneyardSolomonVisualState(ENCOUNTER, DIG, 10)
  assert.equal(digging.bodyPose, 17)
  assert.equal(digging.nativeBodyRecord, 19)
  assert.equal(digging.nativeMouthRecord, null)
  assert.equal(digging.offsetY, 7.5)
  assert.equal(digging.shadowVisible, true)

  const dialogue = boneyardSolomonVisualState({
    ...ENCOUNTER,
    headingDeg: 48,
    mouthPose: 2,
    phase: 'speaking',
  }, DIG, 0)
  assert.equal(dialogue.direction, 2)
  assert.equal(dialogue.clipBottomWorldY, DIG.position.y)
  assert.equal(dialogue.nativeBodyRecord, 215)
  assert.equal(dialogue.nativeMouthRecord, 260)
})

test('preserves the native emergence offset under the fixed ground-line clip', () => {
  const dialogue = boneyardSolomonVisualState({
    ...ENCOUNTER,
    phase: 'speaking',
    transitionOffsetY: 6,
  }, DIG, 0)

  assert.equal(dialogue.offsetY, 6)
  assert.equal(dialogue.clipBottomWorldY, DIG.position.y)
})

test('holds the dialogue body aloft, then selects walk pose zero during retreat', () => {
  const hold = boneyardSolomonVisualState({
    ...ENCOUNTER,
    motion: 10,
    phase: 'retreat-hold',
  }, DIG, 0)
  assert.equal(hold.bodyBank, 'dialogue')
  assert.equal(hold.offsetY, 10)

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
  assert.equal(retreat.clipBottomWorldY, DIG.position.y)
  assert.equal(retreat.shadowVisible, false)

  const descending = boneyardSolomonVisualState({
    ...ENCOUNTER,
    acceleration: 0,
    phase: 'retreat-accelerating',
  }, DIG, 0)
  assert.equal(descending.clipBottomWorldY, null)
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
