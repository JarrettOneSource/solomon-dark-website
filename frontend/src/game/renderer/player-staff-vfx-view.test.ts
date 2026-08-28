import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  NativePlayerStaffPikeBreakVfx,
  NativePlayerStaffVfx,
} from '../core-kernels/native-player-staff-action.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import {
  nativePlayerStaffPikeBreakDraws,
  nativePlayerStaffVfxRenderPlan,
} from './player-staff-vfx-presentation.ts'

const common = {
  ageTicks: 0,
  alpha: 1,
  id: 1,
  ownerId: 'caster',
  position: { x: 10, y: 20 },
  rotationDegrees: 90,
  scale: 1,
  worldKey: 'boneyard:test',
} as const

test('Staff proc VFX map every proven layer without inventing a light', () => {
  const rows: readonly NativePlayerStaffVfx[] = [{
    ...common,
    alphaLoss: Math.fround(0.05),
    angularVelocityDegrees: 1,
    entry: 15,
    kind: 'player-staff-smoke',
    scale: 8,
  }, {
    ...common,
    alphaLoss: Math.fround(0.25),
    entry: 40,
    kind: 'player-staff-move-fade',
    scale: 4,
    tint: 0xa0c3c3,
    velocity: { x: 0, y: -5 },
    velocityFactor: 1,
  }, {
    ...common,
    alphaLoss: Math.fround(0.05),
    entry: 45,
    kind: 'player-staff-move-fade',
    scale: 0.5,
    tint: 0xa0c3c3,
    velocity: { x: 1, y: -3 },
    velocityFactor: Math.fround(0.92),
  }, {
    ...common,
    alphaLoss: Math.fround(0.1),
    entry: 88,
    kind: 'player-staff-perspective-fade',
    scale: 3,
    tint: 0xa0c3c3,
  }]
  assert.deepEqual(rows.map(nativePlayerStaffVfxRenderPlan), [{
    alpha: 1,
    blendMode: 'add',
    entry: 15,
    light: null,
    position: { x: 10, y: 20 },
    rotationRadians: Math.PI / 2,
    scale: 8,
    tint: null,
  }, {
    alpha: 1,
    blendMode: 'add',
    entry: 40,
    light: null,
    position: { x: 10, y: 20 },
    rotationRadians: Math.PI / 2,
    scale: 4,
    tint: 0xa0c3c3,
  }, {
    alpha: 1,
    blendMode: 'add',
    entry: 45,
    light: null,
    position: { x: 10, y: 20 },
    rotationRadians: Math.PI / 2,
    scale: 0.5,
    tint: 0xa0c3c3,
  }, {
    alpha: 1,
    blendMode: 'add',
    entry: 88,
    light: null,
    position: { x: 10, y: 20 },
    rotationRadians: Math.PI / 2,
    scale: 3,
    tint: 0xa0c3c3,
  }])
})

test('Pike-break reconstructs one additive flash and seven native Bouncer sprites', () => {
  const state: NativePlayerStaffPikeBreakVfx = {
    ageTicks: 0,
    headingDegrees: 0,
    id: 7,
    kind: 'player-staff-pike-break',
    ownerId: 'caster',
    position: { x: 10, y: 20 },
    presentationRng: createNativeRng(19),
    targetId: 'enemy:4',
    worldKey: 'boneyard:test',
  }
  const birth = nativePlayerStaffPikeBreakDraws(state)
  assert.equal(birth.length, 8)
  assert.deepEqual(birth.map(({ entry }) => entry), [15, 55, 55, 55, 55, 55, 55, 55])
  assert.deepEqual(birth[0], {
    alpha: 1,
    blendMode: 'add',
    entry: 15,
    offset: { x: 0, y: -75 },
    role: 'pike-break-flash',
    rotationRadians: 0,
    scaleX: 3,
    scaleY: 3,
    tint: null,
  })
  for (const draw of birth.slice(1)) {
    assert.equal(draw.alpha, 1)
    assert.equal(draw.blendMode, 'normal')
    assert.equal(draw.scaleX, 1)
    assert.equal(draw.scaleY, 1)
    assert.equal(draw.tint, null)
  }

  const afterFlash = nativePlayerStaffPikeBreakDraws({ ...state, ageTicks: 41 })
  assert.equal(afterFlash.some(({ role }) => role === 'pike-break-flash'), false)
  assert.equal(afterFlash.length, 7)
  assert.ok(nativePlayerStaffPikeBreakDraws({ ...state, ageTicks: 99 })[0]!.alpha > 0)
  assert.deepEqual(nativePlayerStaffPikeBreakDraws({ ...state, ageTicks: 100 }), [])
})
