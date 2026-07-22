import assert from 'node:assert/strict'
import test from 'node:test'

import { liftedSpriteSource } from './lifted-sprite.ts'

function loadedImage(width: number, height: number): HTMLImageElement {
  return {
    complete: true,
    naturalWidth: width,
    naturalHeight: height,
  } as HTMLImageElement
}

test('lifted sprite pixels are rendered once and reused for every frame', () => {
  const image = loadedImage(48, 72)
  const filters: string[] = []
  const draws: unknown[][] = []
  let canvasCount = 0

  const makeCanvas = () => {
    canvasCount += 1
    let filter = 'none'
    const context = {
      get filter() { return filter },
      set filter(value: string) { filter = value; filters.push(value) },
      drawImage(...args: unknown[]) { draws.push(args) },
    }
    return {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement
  }

  const first = liftedSpriteSource(image, makeCanvas)
  const second = liftedSpriteSource(image, makeCanvas)

  assert.equal(first, second)
  assert.notEqual(first, image)
  assert.equal(canvasCount, 1)
  assert.equal((first as HTMLCanvasElement).width, 48)
  assert.equal((first as HTMLCanvasElement).height, 72)
  assert.deepEqual(filters, ['brightness(1.12)'])
  assert.deepEqual(draws, [[image, 0, 0]])
})

test('an undecoded sprite stays unfiltered until its pixels are available', () => {
  const image = {
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
  } as HTMLImageElement
  let canvasCount = 0

  const source = liftedSpriteSource(image, () => {
    canvasCount += 1
    throw new Error('canvas should not be created')
  })

  assert.equal(source, image)
  assert.equal(canvasCount, 0)
})
