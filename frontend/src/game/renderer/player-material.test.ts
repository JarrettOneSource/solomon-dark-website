import assert from 'node:assert/strict'
import test from 'node:test'

import { createPlayerCombat } from '../core-kernels/player-combat.ts'
import { createNativeSecondaryPlayerState } from '../core-kernels/native-secondary-abilities.ts'
import { nativePlayerMaterialTint } from './player-material.ts'

test('player status materials preserve native cold and poison colors under world lighting', () => {
  const neutral = { ...createPlayerCombat(), poisonBeforeCold: false }
  const cold = { ...neutral, coldSlowTicksRemaining: 250 }
  const poison = { ...neutral, poisonTicksRemaining: 1_000 }
  assert.equal(nativePlayerMaterialTint(0xffffff, undefined, cold), 0xbfffff)
  assert.equal(nativePlayerMaterialTint(0xffffff, undefined, poison), 0x8cbf8c)
  assert.equal(nativePlayerMaterialTint(0x804020, undefined, poison), 0x463012)
  assert.equal(nativePlayerMaterialTint(0x804020, undefined, neutral), 0x804020)
})

test('overlapping player status materials follow native modifier insertion order', () => {
  const both = {
    ...createPlayerCombat(),
    coldSlowTicksRemaining: 250,
    poisonTicksRemaining: 1_000,
    poisonBeforeCold: true,
  }
  assert.equal(nativePlayerMaterialTint(0xffffff, undefined, both), 0x86dfc6)
  assert.equal(nativePlayerMaterialTint(0xffffff, undefined, {
    ...both,
    poisonBeforeCold: false,
  }), 0x6cbf8c)
})

test('Stoneskin composes with status and world materials without tinting its shield', () => {
  const neutral = { ...createPlayerCombat(), poisonBeforeCold: false }
  const stoneskin = { ...createNativeSecondaryPlayerState(), stoneskinTicksRemaining: 1 }
  assert.equal(nativePlayerMaterialTint(0xffffff, stoneskin, neutral), 0x808080)
  assert.equal(nativePlayerMaterialTint(0x804020, stoneskin, neutral), 0x402010)
  assert.equal(nativePlayerMaterialTint(0xffffff, stoneskin, {
    ...neutral,
    poisonTicksRemaining: 10,
  }), 0x466046)
})
