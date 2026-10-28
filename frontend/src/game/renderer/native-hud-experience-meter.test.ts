import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, Graphics, Sprite, Texture, TextureSource } from 'pixi.js'
import { nativeHudModalSlideLayout } from '../native-hud-layout.ts'
import { addNativeHudExperienceMeter } from './native-hud-experience-meter.ts'

test('native XP fill follows current progress under the shared sliding HUD owner', () => {
  const layer = new Container()
  const source = new TextureSource({ height: 64, width: 64 })
  const texture = new Texture({ source })
  const update = addNativeHudExperienceMeter(layer, { fill: texture, frame: texture },
    nativeHudModalSlideLayout(1600, 900, 0).backpack, 0.5)
  const [fill, mask, frame] = layer.children
  assert.ok(fill instanceof Sprite)
  assert.ok(mask instanceof Graphics)
  assert.ok(frame instanceof Sprite)
  assert.equal(fill.mask, mask)
  assert.deepEqual([fill.x, fill.y, fill.width, fill.height], [798, 833, 4, 48])
  assert.deepEqual([frame.x, frame.y, frame.width, frame.height], [794.5, 829, 12, 56])
  for (const [progress, top, height] of [[0.5, 857, 24], [0.75, 845, 36], [1, 833, 48], [0, 0, 0]] as const) {
    update(progress)
    const bounds = mask.getLocalBounds()
    assert.equal(bounds.height, height)
    if (height > 0) assert.deepEqual([bounds.x, bounds.y, bounds.width], [798, top, 4])
    assert.equal(layer.children.length, 3)
    assert.equal(layer.children[0], fill)
  }
  for (const slide of [0, 7.5, 15, 7.5, 0]) {
    layer.y = slide
    assert.equal(fill.getGlobalPosition().y, 833 + slide)
    assert.equal(frame.getGlobalPosition().y, 829 + slide)
    assert.equal(mask.parent, layer)
  }
  layer.destroy({ children: true })
  texture.destroy(true)
})
