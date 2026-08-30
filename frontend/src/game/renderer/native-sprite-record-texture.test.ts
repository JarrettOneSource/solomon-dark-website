import assert from 'node:assert/strict'
import test from 'node:test'

import { Rectangle, TextureSource } from 'pixi.js'

import {
  nativeSpriteRecordTexture,
  nativeSpriteRecordUvs,
} from './native-sprite-record-texture.ts'

test('common native sprite records retain the constructor UV endpoints', () => {
  assert.deepEqual(nativeSpriteRecordUvs(
    { height: 42, width: 30, x: 300, y: 1_157 },
    { height: 2_048, width: 2_048 },
  ), {
    x0: 300.5 / 2_048,
    x1: 330.25 / 2_048,
    x2: 330.25 / 2_048,
    x3: 300.5 / 2_048,
    y0: 1_157.5 / 2_048,
    y1: 1_157.5 / 2_048,
    y2: 1_199.25 / 2_048,
    y3: 1_199.25 / 2_048,
  })
})

test('native record slices interpolate inside the authored record UV domain', () => {
  assert.deepEqual(nativeSpriteRecordUvs(
    { height: 80, width: 40, x: 10, y: 20 },
    { height: 200, width: 100 },
    [0.25, 0.5, 0.75, 1],
  ), {
    x0: 10.5 / 100 + (50.25 / 100 - 10.5 / 100) * 0.25,
    x1: 10.5 / 100 + (50.25 / 100 - 10.5 / 100) * 0.75,
    x2: 10.5 / 100 + (50.25 / 100 - 10.5 / 100) * 0.75,
    x3: 10.5 / 100 + (50.25 / 100 - 10.5 / 100) * 0.25,
    y0: 20.5 / 200 + (100.25 / 200 - 20.5 / 200) * 0.5,
    y1: 20.5 / 200 + (100.25 / 200 - 20.5 / 200) * 0.5,
    y2: 100.25 / 200,
    y3: 100.25 / 200,
  })
})

test('record textures replay native UVs after a Pixi texture update', () => {
  const source = new TextureSource({ height: 2_048, width: 2_048 })
  const texture = nativeSpriteRecordTexture({
    frame: new Rectangle(559, 1_764, 27, 26),
    source,
  })
  const expected = {
    x0: 559.5 / 2_048,
    x1: 586.25 / 2_048,
    x2: 586.25 / 2_048,
    x3: 559.5 / 2_048,
    y0: 1_764.5 / 2_048,
    y1: 1_764.5 / 2_048,
    y2: 1_790.25 / 2_048,
    y3: 1_790.25 / 2_048,
  }

  assert.deepEqual(texture.uvs, expected)
  texture.update()
  assert.deepEqual(texture.uvs, expected)
  texture.destroy(true)
})

test('native record UV construction rejects invalid pages and slices', () => {
  assert.throws(
    () => nativeSpriteRecordUvs(
      { height: 10, width: 10, x: 0, y: 0 },
      { height: 0, width: 10 },
    ),
    /page height must be positive/,
  )
  assert.throws(
    () => nativeSpriteRecordUvs(
      { height: 10, width: 10, x: 0, y: 0 },
      { height: 10, width: 10 },
      [0.5, 0, 0.5, 1],
    ),
    /ordered unit rectangle/,
  )
})
