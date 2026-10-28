import assert from 'node:assert/strict'
import test from 'node:test'
import { BufferImageSource, Texture } from 'pixi.js'
import { createNativeSceneryGlyphMaterial, writeNativeSceneryGlyphColors, type NativeSceneryRgba } from './native-scenery-glyph-material.ts'
import { usesNativeDiffuseColor } from './native-texture-color.ts'

const bytes = (value: number): number[] => [value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24]
const white: NativeSceneryRgba = [1, 1, 1, 1]
function colors(alpha: number | null, callback = white, whole = white): number[][] {
  const result = new Uint32Array(4)
  assert.equal(writeNativeSceneryGlyphColors(result, alpha, callback, whole), true)
  assert.equal(writeNativeSceneryGlyphColors(result, alpha, callback, whole), false)
  return [...result].map(bytes)
}
function texture(): { page: BufferImageSource; texture: Texture } {
  const page = new BufferImageSource({ resource: new Uint8Array(8 * 12 * 4).fill(255), width: 8, height: 12 })
  return { page, texture: new Texture({ source: page }) }
}

test('native original-glyph gradient threshold keeps opaque base and uses TL TR BR BL', () => {
  for (const alpha of [1, .5, .5000000596046448, .5050004720687866]) {
    assert.deepEqual(colors(alpha), Array.from({ length: 4 }, () => [255, 255, 255, 255]))
  }
  for (const [alpha, top] of [[.4999999701976776, 63], [.49000048637390137, 62], [Math.fround(.4), 51], [.489999920129776, 62]]) {
    assert.deepEqual(colors(alpha!).map(color => color[3]), [top, top, 255, 255])
  }
  assert.deepEqual(colors(null, [1, 1, 1, Math.fround(.2)]).map(color => color[3]), [51, 51, 51, 51])
  assert.deepEqual(colors(Math.fround(.4), [1, 1, 1, Math.fround(.2)]).map(color => color[3]), [51, 51, 51, 51])
})

test('native whole-color multiplication differs between ordinary and Tree gradient draws', () => {
  const callback: NativeSceneryRgba = [.6, .6, .6, .2]
  const whole: NativeSceneryRgba = [.5, .5, .5, .5]
  assert.deepEqual(colors(.5, callback, whole), Array.from({ length: 4 }, () => [76, 76, 76, 25]))
  assert.deepEqual(colors(Math.fround(.4), callback, whole), [
    [38, 38, 38, 25], [38, 38, 38, 25], [38, 38, 38, 12], [38, 38, 38, 12],
  ])
})

test('retained Tree ordinary and hit materials keep independent unquantized light inputs', () => {
  const source = texture()
  const main = createNativeSceneryGlyphMaterial(source.texture, 8, 12, true)
  const hit = main.createHitRedraw()
  main.mesh.addChild(hit.display)
  try {
    main.update(Math.fround(.4), .25, .35)
    hit.update(Math.fround(.2), true)
    assert.equal(main.mesh.alpha, 1)
    assert.equal(main.mesh.tint, 0xffffff)
    assert.equal(hit.display.alpha, 1)
    assert.equal(hit.display.tint, 0xffffff)
    assert.equal(usesNativeDiffuseColor(hit.display), true)
    assert.equal(hit.display.blendMode, 'inherit', 'retain the enclosing ordinary alpha blend; diffuse mode is not additive')
    assert.deepEqual([...main.colors].map(bytes), [
      [63, 63, 63, 51], [63, 63, 63, 51], [63, 63, 63, 255], [63, 63, 63, 255],
    ])
    assert.deepEqual([...hit.colors].map(bytes), [
      [58, 0, 0, 51], [58, 0, 0, 51], [58, 0, 0, 17], [58, 0, 0, 17],
    ])
    hit.update(Math.fround(.2), false)
    assert.deepEqual([...hit.colors].map(bytes), Array.from({ length: 4 }, () => [255, 0, 0, 51]))
    main.update(.5, .25, .35)
    hit.update(Math.fround(.2), true)
    assert.deepEqual([...hit.colors].map(bytes), Array.from({ length: 4 }, () => [58, 0, 0, 17]))
  } finally { main.destroy(); source.texture.destroy(false); source.page.destroy() }
})

test('ordinary shared scenery never adopts Tree alpha and its hit avoids ordinary parent tint', () => {
  const source = texture()
  const main = createNativeSceneryGlyphMaterial(source.texture, 8, 12, false)
  const hit = main.createHitRedraw()
  try {
    main.update(.4, .25, .5, [.5, 1, 0])
    hit.update(.2, true)
    assert.deepEqual([...main.colors].map(bytes), Array.from({ length: 4 }, () => [31, 63, 0, 255]))
    assert.deepEqual([...hit.colors].map(bytes), Array.from({ length: 4 }, () => [82, 0, 0, 25]))
  } finally { hit.destroy(); main.destroy(); source.texture.destroy(false); source.page.destroy() }
})

test('original glyph buffers remain independent, upload changed colors and preserve the borrowed atlas', () => {
  const source = texture()
  const main = createNativeSceneryGlyphMaterial(source.texture, 8, 12, true)
  const hit = main.createHitRedraw()
  const mainGeometry = main.mesh.geometry
  const hitGeometry = hit.display.geometry
  const mainColor = mainGeometry.getBuffer('aColor')
  const before = mainColor._updateID
  try {
    assert.equal(main.mesh.shader, null)
    assert.equal(hit.display.shader, null)
    assert.deepEqual([...main.mesh.vertices], [0, 0, 8, 0, 8, 12, 0, 12])
    assert.deepEqual([...mainGeometry.getBuffer('aUV').data], [0, 0, 1, 0, 1, 1, 0, 1])
    assert.deepEqual([...mainGeometry.getIndex().data], [0, 1, 2, 0, 2, 3])
    assert.notEqual(mainGeometry, hitGeometry)
    for (const name of ['aPosition', 'aUV', 'aColor']) {
      assert.notEqual(mainGeometry.getBuffer(name), hitGeometry.getBuffer(name))
    }
    main.update(.4, .35, .35)
    assert.ok(mainColor._updateID > before)
    const updated = mainColor._updateID
    main.update(.4, .35, .35)
    assert.equal(mainColor._updateID, updated)
    hit.update(.2, true)
    const retained = [...main.colors]
    hit.destroy()
    assert.deepEqual([...main.colors], retained)
    assert.equal(main.mesh.destroyed, false)
    assert.equal(source.texture.destroyed, false)
    const second = main.createHitRedraw()
    main.mesh.addChild(second.display)
    second.update(.3, false)
    main.destroy()
    assert.equal(main.mesh.destroyed, true)
    assert.equal(second.display.destroyed, true)
    assert.equal(source.texture.destroyed, false)
    main.destroy()
    second.destroy()
  } finally { main.destroy(); source.texture.destroy(false); source.page.destroy() }
})
