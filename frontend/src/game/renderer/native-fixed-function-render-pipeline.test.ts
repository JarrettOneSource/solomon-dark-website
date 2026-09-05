import assert from 'node:assert/strict'
import test from 'node:test'
import { nativePackedColor } from './native-material-batch.ts'

test('native diffuse packing preserves RGB while clamping and truncating alpha', () => {
  assert.equal(nativePackedColor(0x123456, 0.5), 0x7f563412)
  assert.equal(nativePackedColor(0xffffff, -1), 0x00ffffff)
  assert.equal(nativePackedColor(0xffffff, 2), 0xffffffff)
  assert.equal(nativePackedColor(0x000000, 1), 0xff000000)
})
