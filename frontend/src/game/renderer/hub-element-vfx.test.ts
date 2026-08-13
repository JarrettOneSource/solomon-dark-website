import assert from 'node:assert/strict'
import test from 'node:test'
import { colorToTint } from './hub-element-vfx.ts'

test('native float colors map to Pixi RGB tint values', () => {
  assert.equal(colorToTint([1, 1, 1]), 0xffffff)
  assert.equal(colorToTint([1, 0.5, 0]), 0xff8000)
  assert.equal(colorToTint([-1, 0.5, 2]), 0x0080ff)
})
