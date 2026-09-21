import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import {
  BatchableSprite, BatcherPipe, DOMAdapter, InstructionSet, Matrix, Rectangle,
  Sprite, Texture, TextureSource, type Batcher, type WebGLRenderer,
} from 'pixi.js'
import { installNativeBatchMaterial, nativePackedColor } from './native-material-batch.ts'
import { setNativeDiffuseColor } from './native-texture-color.ts'

test('native diffuse packing preserves RGB while clamping and truncating alpha', () => {
  assert.equal(nativePackedColor(0x123456, 0.5), 0x7f563412)
  assert.equal(nativePackedColor(0xffffff, -1), 0x00ffffff)
  assert.equal(nativePackedColor(0xffffff, 2), 0xffffffff)
  assert.equal(nativePackedColor(0x000000, 1), 0xff000000)
})

test('native quad packing preserves every attribute bit and untouched buffer slot', () => {
  const createCanvas = mock.method(DOMAdapter.get(), 'createCanvas', () => ({ getContext: () => null }))
  const renderer = {
    limits: { maxBatchableTextures: 4 },
    shader: { updateUniformGroup() {} },
    runners: { destroy: { add() {}, remove() {} } },
    renderPipes: {},
  } as unknown as WebGLRenderer
  const pipe = new BatcherPipe(renderer, { start() {}, execute() {} })
  renderer.renderPipes.batch = pipe
  const restoreMaterial = installNativeBatchMaterial(renderer, {
    name: 'test-native-quad-packing', fragment: { end: '' },
  })
  const instructionSet = new InstructionSet()
  const source = new TextureSource({ width: 16, height: 16 })
  const texture = new Texture({ source, frame: new Rectangle(2, 3, 5, 7) })
  const renderable = new Sprite(texture)
  try {
    pipe.buildStart(instructionSet)
    const batchers = pipe['_batchersByInstructionSet'] as Record<number, Record<string, Batcher>>
    const batcher = batchers[instructionSet.uid]!.default!
    for (const transform of [new Matrix(), new Matrix(1.25, -0.75, 0.5, -2.125, 17.25, -9.125)]) {
      for (const color of [0, 0x7f563412, 0xffffffff]) {
        for (const premultiplied of [false, true]) {
          source.alphaMode = premultiplied ? 'premultiplied-alpha' : 'no-premultiply-alpha'
          for (const diffuse of [false, true]) {
            setNativeDiffuseColor(renderable, diffuse)
            for (const index of [0, 7, 31]) {
              const textureId = 3
              const element = new BatchableSprite()
              renderable.groupColorAlpha = color
              element.texture = texture
              element.renderable = renderable
              element.transform = transform
              element.roundPixels = index === 0 ? 0 : 1
              element.bounds = { minX: -3.25, minY: -7.125, maxX: 10.5, maxY: 4.75 }
              const actual = new Uint32Array(80).fill(0xdeadbeef)
              const expected = actual.slice()
              const floats = new Float32Array(expected.buffer)
              let offset = index
              const mode = Number(premultiplied) + 2 * Number(diffuse)
              // Compare the complete buffer against the former writer's operation order.
              const write = (x: number, y: number, u: number, v: number): void => {
                floats[offset++] = transform.a * x + transform.c * y + transform.tx
                floats[offset++] = transform.d * y + transform.b * x + transform.ty
                floats[offset++] = u
                floats[offset++] = v
                expected[offset++] = element.color
                expected[offset++] = textureId << 16 | element.roundPixels & 0xffff
                floats[offset++] = mode
              }
              const bounds = element.bounds
              const uvs = texture.uvs
              write(bounds.minX, bounds.minY, uvs.x0, uvs.y0)
              write(bounds.maxX, bounds.minY, uvs.x1, uvs.y1)
              write(bounds.maxX, bounds.maxY, uvs.x2, uvs.y2)
              write(bounds.minX, bounds.maxY, uvs.x3, uvs.y3)
              batcher.packQuadAttributes(element, new Float32Array(actual.buffer), actual, index, textureId)
              assert.deepEqual(actual, expected)
            }
          }
        }
      }
    }
  } finally {
    restoreMaterial()
    createCanvas.mock.restore()
    renderable.destroy()
    texture.destroy(true)
  }
})
