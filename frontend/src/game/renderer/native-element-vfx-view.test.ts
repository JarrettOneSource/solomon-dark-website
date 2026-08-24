import assert from 'node:assert/strict'
import test from 'node:test'
import { Texture } from 'pixi.js'

import { colorToTint, NativeElementVfxView } from './native-element-vfx-view.ts'

test('native float colors map to Pixi RGB tint values', () => {
  assert.equal(colorToTint([1, 1, 1]), 0xffffff)
  assert.equal(colorToTint([1, 0.5, 0]), 0xff8000)
  assert.equal(colorToTint([-1, 0.5, 2]), 0x0080ff)
})

test('hidden retained element views do not build or apply painter plans', () => {
  const view = new NativeElementVfxView('ether', {
    core: [Texture.EMPTY],
    ray: [Texture.EMPTY],
    spark: [Texture.EMPTY],
  })
  view.container.visible = false
  view.update(12, 1)
  assert.equal(view.sprites.length, 0)

  view.container.visible = true
  view.update(12, 1)
  assert.ok(view.sprites.length > 0)
  view.destroy()
})
