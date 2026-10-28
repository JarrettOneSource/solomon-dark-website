import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeDesaturateColor } from './native-color.ts'

test('native color amount moves toward luminance and preserves alpha', () => {
  assert.deepEqual(nativeDesaturateColor([1, 0, 0, .25], 0), [1, 0, 0, .25])
  const gray = Math.fround(.3086000084877014)
  assert.deepEqual(nativeDesaturateColor([1, 0, 0, .25], 1), [gray, gray, gray, .25])
  const partial = nativeDesaturateColor([1, 0, 0, .25], .7)
  assert.ok(partial[0] < .52 && partial[0] > .51)
  assert.ok(partial[1] > .21 && partial[1] < .22)
  assert.equal(partial[1], partial[2])
})
