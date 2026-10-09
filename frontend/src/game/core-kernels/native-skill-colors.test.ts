import assert from 'node:assert/strict'
import test from 'node:test'
import { nativePlayerGroundLightTint, nativePrimarySpellTint } from './native-skill-colors.ts'

// Ledger 090, 2026-10-09: hash-matched provider +0x88, S85 -> S20 -> D25,
// with binary32 stores and the native truncating packed-channel conversion.
const PURE_GOLDENS = [
  [8, 0x624e62], [16, 0x70615b], [24, 0x7b9090],
  [32, 0x48515d], [40, 0x6f846f], [80, 0x624e62],
] as const
const WELD_GOLDENS = [
  0x5c4750, 0x8b808b, 0xa59fa5, 0x9e9893, 0xa59fa5,
  0x8f8f8f, 0xa59fa5, 0x9e9893, 0xb0b4b4, 0xb7baba,
  0x5c4750, 0x70615b, 0x48515d, 0x7b9090, 0x6f846f,
] as const

test('ground light packs every pure primary and effective Plane Orb from native float goldens', () => {
  for (const [skillId, expected] of PURE_GOLDENS) {
    assert.equal(nativePlayerGroundLightTint(skillId, null), expected, `primary ${skillId}`)
  }
})

test('ground light consumes all fifteen native Weld palette branches without early byte quantization', () => {
  for (const [offset, expected] of WELD_GOLDENS.entries()) {
    assert.equal(nativePlayerGroundLightTint(52, 1000 + offset), expected, `Weld ${1000 + offset}`)
  }
})

test('a stored Weld build cannot override a different selected primary', () => {
  for (const [skillId, expected] of PURE_GOLDENS) {
    assert.equal(nativePlayerGroundLightTint(skillId, 1008), expected, `primary ${skillId} with inactive Weld`)
  }
})

test('missing or invalid Weld builds fall through the native ordinary root-seven descriptor', () => {
  for (const buildId of [null, 999, 1015]) {
    assert.equal(nativePlayerGroundLightTint(52, buildId), 0x8f8f8f)
  }
})

test('an unknown nonnegative descriptor has native default class minus one and resolves to Ether', () => {
  assert.equal(nativePlayerGroundLightTint(9000, null), 0x624e62)
  assert.equal(nativePlayerGroundLightTint(9000, 1008), 0x624e62)
  assert.equal(nativePrimarySpellTint(9000, null), 0xffffff, 'the legacy saturated provider is unchanged')
})

test('ground lights require an effective nonnegative selector instead of inventing native global-setting ownership', () => {
  for (const skillId of [-1, -2, .5, NaN, Infinity]) {
    assert.throws(() => nativePlayerGroundLightTint(skillId, null), RangeError)
  }
})

test('ground-light color recovery leaves the existing raw primary-spell tints unchanged', () => {
  for (const [skillId, expected] of [
    [8, 0xff19ff], [16, 0xff5919], [24, 0x19ffff],
    [32, 0x197fff], [40, 0x19ff19], [80, 0xff19ff],
  ]) assert.equal(nativePrimarySpellTint(skillId!, null), expected, `primary ${skillId}`)
})
