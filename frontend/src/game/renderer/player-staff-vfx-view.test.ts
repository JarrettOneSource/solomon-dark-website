import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { NativePlayerStaffVfx } from '../core-kernels/native-player-staff-action.ts'
import { nativePlayerStaffVfxRenderPlan } from './player-staff-vfx-presentation.ts'

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
    blendMode: 'normal',
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

test('the shared spell view renders only Staff visual actors', () => {
  const source = readFileSync(
    new URL('./primary-spell-world-view.ts', import.meta.url),
    'utf8',
  )
  assert.match(source, /state\.kind === 'player-staff-smoke'/)
  assert.match(source, /state\.kind === 'player-staff-move-fade'/)
  assert.match(source, /state\.kind === 'player-staff-perspective-fade'/)
  assert.match(source, /new PlayerStaffVfxView\(state, this\.textures\)/)
  for (const kind of [
    'player-staff-contact',
    'player-staff-knockback',
    'player-staff-melee',
    'player-staff-spin',
  ]) {
    assert.doesNotMatch(source, new RegExp(`new .*${kind}`))
  }
})
