import assert from 'node:assert/strict'
import test from 'node:test'

import { BatchableMesh, Container, MeshGeometry, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js'

import {
  nativeSpriteRecordTexture,
  nativeSpriteRecordPageTexture,
  nativeSpriteRecordTrimmedTexture,
  nativeSpriteRecordUvs,
} from './native-sprite-record-texture.ts'
import { isolateTextureSamples, textureSampleBounds } from './texture-sample-bounds.ts'

test('full-source native records keep their UV matrix in batched meshes after updates', () => {
  const source = new TextureSource({ width: 16, height: 8 })
  const texture = nativeSpriteRecordTexture({ source, frame: new Rectangle(0, 0, 16, 8) })
  const geometry = new MeshGeometry({ uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) })
  const mesh = new BatchableMesh()
  mesh.geometry = geometry
  mesh.setTexture(texture)
  try {
    for (let update = 0; update < 3; update += 1) {
      texture.update()
      assert.equal(texture.textureMatrix.isSimple, false)
      assert.deepEqual([...mesh.uvs], [.5 / 16, .5 / 8, 16.25 / 16, .5 / 8,
        16.25 / 16, 8.25 / 8, .5 / 16, 8.25 / 8])
    }
  } finally { geometry.destroy(true); texture.destroy(true) }
})

test('authored fractional sample bounds preserve raw UVs and collapse subtexel spans at their center', () => {
  const source = new TextureSource({ width: 32, height: 16 })
  const texture = new Texture({ source, frame: new Rectangle(3.25, 2.125, .5, .25) })
  const uvs = { ...texture.uvs }
  const framed = isolateTextureSamples(texture)
  try {
    assert.equal(framed, texture)
    assert.deepEqual(texture.uvs, uvs)
    assert.deepEqual([...textureSampleBounds(texture)], [3.5 / 32, 2.25 / 16, 3.5 / 32, 2.25 / 16])
    source.resize(64, 32); texture.update()
    assert.deepEqual([...textureSampleBounds(texture)], [3.5 / 64, 2.25 / 32, 3.5 / 64, 2.25 / 32])
  } finally { texture.destroy(true) }
})

test('record slices and absolute-UV views preserve original sample ownership after source updates', () => {
  const source = new TextureSource({ width: 128, height: 64 })
  const record = nativeSpriteRecordTexture({
    source, frame: new Rectangle(20, 12, 10, 8), sourceUv: [.25, .25, .75, .75],
  })
  const page = nativeSpriteRecordPageTexture(record)
  const bounds = textureSampleBounds(record)
  try {
    assert.deepEqual(Array.from(bounds), [20.5 / 128, 12.5 / 64, 29.5 / 128, 19.5 / 64])
    assert.equal(textureSampleBounds(page), bounds)
    assert.equal(page.textureMatrix.isSimple, true)
    assert.deepEqual(record.frame, new Rectangle(22.5, 14, 5, 4))
    source.resize(256, 128)
    record.update()
    assert.equal(textureSampleBounds(record), bounds)
    assert.deepEqual(Array.from(bounds), [20.5 / 256, 12.5 / 128, 29.5 / 256, 19.5 / 128])
  } finally {
    page.destroy(false); record.destroy(true)
  }
})

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

test('retiring animated sprites does not retain them through shared native records', () => {
  const source = new TextureSource({ height: 64, width: 64 })
  const records = [0, 16].map(x => nativeSpriteRecordTexture({
    frame: new Rectangle(x, 0, 16, 16),
    source,
  }))
  const listenersBefore = records.map(record => record.listenerCount('update'))
  for (let index = 0; index < 1_000; index += 1) {
    const parent = new Container()
    const sprite = new Sprite(records[0])
    parent.addChild(sprite)
    sprite.texture = records[1]!
    sprite.texture = records[0]!
    parent.destroy({ children: true })
  }
  assert.deepEqual(records.map(record => record.listenerCount('update')), listenersBefore)
  for (const record of records) {
    const uvs = { ...record.uvs }
    record.update()
    assert.deepEqual(record.uvs, uvs)
    record.destroy(false)
  }
  source.destroy()
})

test('alpha-trimmed records retain logical geometry and interpolate original native UVs', () => {
  const source = new TextureSource({ height: 2_048, width: 2_048 })
  const record = nativeSpriteRecordTexture({
    frame: new Rectangle(526, 1_948, 63, 63),
    source,
    trim: new Rectangle(0, 0, 63, 63),
  })
  const trimmed = nativeSpriteRecordTrimmedTexture(record, {
    height: 60,
    width: 63,
    x: 0,
    y: 2,
  })

  assert.deepEqual(trimmed.frame, new Rectangle(526, 1_950, 63, 60))
  assert.deepEqual(trimmed.orig, new Rectangle(0, 0, 63, 63))
  assert.deepEqual(trimmed.trim, new Rectangle(0, 2, 63, 60))
  assert.deepEqual(trimmed.uvs, nativeSpriteRecordUvs(
    record.frame,
    { height: source.height, width: source.width },
    [0, 2 / 63, 1, 62 / 63],
  ))
  trimmed.update()
  assert.deepEqual(trimmed.uvs, nativeSpriteRecordUvs(
    record.frame,
    { height: source.height, width: source.width },
    [0, 2 / 63, 1, 62 / 63],
  ))
  trimmed.destroy(false)
  record.destroy(true)
})

test('alpha trim rejects nested and out-of-record rectangles', () => {
  const source = new TextureSource({ height: 16, width: 16 })
  const record = nativeSpriteRecordTexture({
    frame: new Rectangle(0, 0, 16, 16),
    source,
  })
  const trimmed = nativeSpriteRecordTrimmedTexture(record, {
    height: 14,
    width: 14,
    x: 1,
    y: 1,
  })
  assert.throws(
    () => nativeSpriteRecordTrimmedTexture(trimmed, {
      height: 12,
      width: 12,
      x: 1,
      y: 1,
    }),
    /requires an untrimmed source record/,
  )
  assert.throws(
    () => nativeSpriteRecordTrimmedTexture(record, {
      height: 16,
      width: 16,
      x: 1,
      y: 0,
    }),
    /must fit its logical record/,
  )
  trimmed.destroy(false)
  record.destroy(true)
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
