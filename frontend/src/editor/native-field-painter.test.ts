import assert from 'node:assert/strict'
import test from 'node:test'
import { drawNativeEditorField, nativeEditorFieldLattice } from './native-field-painter.ts'

function fixture(dpr = 1) {
  const calls: number[][] = []
  const clips: number[][] = []
  const smoothing: [boolean, ImageSmoothingQuality][] = []
  const ctx = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'high' as ImageSmoothingQuality,
    getTransform: () => ({ a: dpr, b: 0, c: 0, d: dpr, e: 0, f: 0 }),
    save() { smoothing.push([this.imageSmoothingEnabled, this.imageSmoothingQuality]) },
    restore() { [this.imageSmoothingEnabled, this.imageSmoothingQuality] = smoothing.pop()! },
    setTransform() {},
    beginPath() {},
    rect(...args: number[]) { clips.push(args) },
    clip() {},
    drawImage(_image: HTMLImageElement, ...args: number[]) {
      assert.equal(this.imageSmoothingEnabled, true)
      assert.equal(this.imageSmoothingQuality, 'low')
      calls.push(args)
    },
  }
  const image = { complete: true, naturalWidth: 2048, naturalHeight: 2048 } as HTMLImageElement
  return { ctx: ctx as unknown as CanvasRenderingContext2D, image, calls, clips }
}

test('editor always samples record 12 from exact fractional full-atlas endpoints', () => {
  const { ctx, image, calls, clips } = fixture()
  const count = drawNativeEditorField(ctx, image, { x: 0, y: 0, w: 350, h: 350 }, { x: 175, y: 175, zoom: 1 }, 350, 350)
  assert.equal(count, 1)
  const scale = 350 / 349.75
  assert.deepEqual(calls[0], [0.5 - 1399.5 * scale, 0.5 - 1069.5 * scale, 2048 * scale, 2048 * scale])
  assert.deepEqual(clips, [[0, 0, 350, 350]])
  assert.equal(ctx.imageSmoothingEnabled, false)
  assert.equal(ctx.imageSmoothingQuality, 'high')
})

test('native integer-center phase is one physical half pixel at every DPR', () => {
  for (const dpr of [1, 1.25, 2, 2.5, 3]) {
    const { ctx, image, calls, clips } = fixture(dpr)
    drawNativeEditorField(ctx, image, { x: 0, y: 0, w: 350, h: 350 }, { x: 175, y: 175, zoom: 1 }, 350, 350)
    const scale = 350 * dpr / 349.75
    assert.equal(calls[0]![0]! + 1399.5 * scale, 0.5)
    assert.equal(calls[0]![1]! + 1069.5 * scale, 0.5)
    assert.deepEqual(clips, [[0, 0, Math.ceil(350 * dpr), Math.ceil(350 * dpr)]])
  }
})

test('strict primary view excludes touching tiles and preserves full final overhang', () => {
  const { ctx, image, clips } = fixture()
  assert.equal(drawNativeEditorField(ctx, image, { x: -20, y: -30, w: 351, h: 351 }, { x: 505, y: 145, zoom: 1 }, 350, 350), 1)
  assert.deepEqual(clips, [[0, 0, 350, 350]])
  assert.equal(drawNativeEditorField(ctx, image, { x: 0, y: 0, w: 350, h: 350 }, { x: 525, y: 175, zoom: 1 }, 350, 350), 0)
})

test('editor shares retained float32 lattice, with X outer and Y inner iteration', () => {
  const bounds = { x: 1.0010000467300415, y: -0.25, w: 18000, h: 351 }
  const lattice = nativeEditorFieldLattice(bounds)
  assert.equal(nativeEditorFieldLattice(bounds), lattice)
  assert.equal(lattice.x[47], 16451)
  const { ctx, image, calls } = fixture()
  drawNativeEditorField(ctx, image, bounds, { x: 350, y: 350, zoom: 1 }, 700, 700)
  assert.equal(calls.length, 4)
  assert.equal(calls[0]![0], calls[1]![0])
  assert.equal(calls[0]![1], calls[2]![1])
  assert.equal(calls[1]![1], calls[3]![1])
})

test('unready atlas paints no fallback, and next frame immediately uses decoded art', () => {
  const { ctx, image, calls } = fixture()
  const bounds = { x: 0, y: 0, w: 350, h: 350 }
  const cam = { x: 175, y: 175, zoom: 1 }
  Object.assign(image, { complete: false, naturalWidth: 0, naturalHeight: 0 })
  assert.equal(drawNativeEditorField(ctx, image, bounds, cam, 350, 350), -1)
  assert.equal(calls.length, 0)
  Object.assign(image, { complete: true, naturalWidth: 2048, naturalHeight: 2048 })
  assert.equal(drawNativeEditorField(ctx, image, bounds, cam, 350, 350), 1)
  Object.assign(image, { naturalWidth: 512, naturalHeight: 512 })
  assert.throws(() => drawNativeEditorField(ctx, image, bounds, cam, 350, 350), /full 2048/)
})
