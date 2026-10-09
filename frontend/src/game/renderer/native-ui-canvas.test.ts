import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { nativeUiCanvasResolution } from './native-ui-canvas.ts'
import { observeGameDevicePixelRatio } from './game-device-pixel-ratio.ts'

test('UI backing density covers physical desktop, Retina and scaled mobile pixels', () => {
  const logical = { width: 1600, height: 900 }
  assert.equal(nativeUiCanvasResolution(logical, logical, 1), 1)
  assert.equal(nativeUiCanvasResolution(logical, { width: 1920, height: 1080 }, 2), 2.4)
  assert.equal(nativeUiCanvasResolution(logical, { width: 736, height: 414 }, 3), 1.38)
  assert.equal(nativeUiCanvasResolution(logical, { width: 1200, height: 675 }, 2), 1.5)
  assert.equal(nativeUiCanvasResolution(logical, { width: 2400, height: 1350 }, 2), 3)
})

test('CSS transform precision does not add a spurious backing pixel', () => {
  assert.equal(nativeUiCanvasResolution({ width: 1600, height: 900 }, { width: 1920.0001220703125, height: 1080 }, 2), 2.4)
})

test('a nonuniform surface allocates enough density for either axis', () => {
  assert.equal(nativeUiCanvasResolution({ width: 1600, height: 900 }, { width: 1600, height: 1080 }, 2), 2.4)
})

test('display density rearms on every DPR-only change and disconnects at teardown', () => {
  const queries: Array<{ query: string; listeners: Set<() => void> }> = []
  const target = {
    devicePixelRatio: 1,
    matchMedia(query: string) {
      const listeners = new Set<() => void>()
      queries.push({ query, listeners })
      return {
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      } as unknown as MediaQueryList
    },
  }
  const observed: number[] = []
  const disconnect = observeGameDevicePixelRatio(() => observed.push(target.devicePixelRatio), target)
  assert.deepEqual(observed, [])
  assert.equal(queries[0]!.query, '(resolution: 1dppx)')
  for (const density of [2, 1.25, 1]) {
    const previous = queries.at(-1)!
    assert.equal(previous.listeners.size, 1)
    target.devicePixelRatio = density
    for (const listener of [...previous.listeners]) listener()
    assert.equal(previous.listeners.size, 0)
    assert.equal(queries.at(-1)!.query, `(resolution: ${density}dppx)`)
    assert.equal(queries.at(-1)!.listeners.size, 1)
  }
  assert.deepEqual(observed, [2, 1.25, 1])
  const queued = [...queries.at(-1)!.listeners]
  disconnect()
  disconnect()
  assert.equal(queries.at(-1)!.listeners.size, 0)
  // A dispatched event queued before scene teardown must not resize or rearm.
  for (const listener of queued) listener()
  assert.equal(queries.length, 4)
  assert.deepEqual(observed, [2, 1.25, 1])
})

test('both world scenes subscribe their existing resize owner to DPR changes', () => {
  for (const scene of ['HubScene', 'BoneyardScene']) {
    const source = readFileSync(new URL(`../${scene}.tsx`, import.meta.url), 'utf8')
    assert.match(source, /observeGameDevicePixelRatio\(resize\)/)
    assert.match(source, /observer\.disconnect\(\)\s+disconnectPixelRatio\(\)/)
  }
})
