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
  const textures = {
    air: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
    core: [Texture.EMPTY],
    earth: new Array(8).fill(Texture.EMPTY),
    fire: new Array(12).fill(Texture.EMPTY),
    ray: [Texture.EMPTY],
    spark: [Texture.EMPTY],
    water: new Array(12).fill(Texture.EMPTY),
  }
  for (const element of ['air', 'earth', 'ether', 'fire', 'water'] as const) {
    const view = new NativeElementVfxView(element, textures)
    view.container.visible = false
    view.update(12, 1)
    assert.equal(view.sprites.length, 0, element)

    view.container.visible = true
    view.update(12, 1)
    assert.ok(view.sprites.length > 0, element)
    view.destroy()
  }
})

test('retained Staff orb views invalidate on selected-primary changes at one tick', () => {
  const textures = {
    air: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
    core: [Texture.EMPTY],
    earth: new Array(8).fill(Texture.EMPTY),
    fire: new Array(12).fill(Texture.EMPTY),
    ray: [Texture.EMPTY],
    spark: [Texture.EMPTY],
    water: new Array(12).fill(Texture.EMPTY),
  }
  const view = new NativeElementVfxView(null, textures)

  view.updateSelectedPrimary(8, 12, 1)
  const etherCount = view.sprites.filter(({ visible }) => visible).length
  assert.ok(etherCount > 4)
  assert.equal(view.selectedPrimaryId, 8)

  view.updateSelectedPrimary(16, 12, 1)
  assert.equal(view.sprites.filter(({ visible }) => visible).length, 3)
  assert.equal(view.selectedPrimaryId, 16)

  view.updateSelectedPrimary(80, 12, 1)
  assert.equal(view.sprites.filter(({ visible }) => visible).length, 0)
  assert.equal(view.selectedPrimaryId, 80)

  view.updateSelectedPrimary(16, 12, 1)
  assert.equal(view.sprites.filter(({ visible }) => visible).length, 3)
  view.destroy()
})
