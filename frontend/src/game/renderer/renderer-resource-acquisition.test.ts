import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'

import { acquireRendererResources } from './renderer-resource-acquisition.ts'

function deferred<Value>() {
  let resolve!: (value: Value) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<Value>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

test('successful acquisition transfers ordered heterogeneous resources without disposing them', async () => {
  const gpu = deferred<{ canvas: string }>()
  const textures = deferred<{ sources: number }>()
  const destroyed: unknown[] = []
  const acquired = acquireRendererResources([
    { promise: gpu.promise, destroy: value => { destroyed.push(value) } },
    { promise: textures.promise, destroy: value => { destroyed.push(value) } },
    { promise: Promise.resolve(), destroy: () => {} },
  ])
  const textureValue = { sources: 3 }
  const gpuValue = { canvas: 'retained' }
  textures.resolve(textureValue)
  gpu.resolve(gpuValue)
  const [application, resources, readiness] = await acquired
  assert.equal(application, gpuValue)
  assert.equal(application.canvas, 'retained')
  assert.equal(resources, textureValue)
  assert.equal(resources.sources, 3)
  assert.equal(readiness, undefined)
  assert.deepEqual(destroyed, [])
})

for (const failingIndex of [0, 1, 2]) {
  test(`resource ${failingIndex} failure rejects promptly and cleans early and late siblings once`, async () => {
    const resources = Array.from({ length: 3 }, () => deferred<number>())
    const destroyed: number[] = []
    const failure = new Error(`resource ${failingIndex} failed`)
    const acquired = acquireRendererResources<number[]>(resources.map(({ promise }) => ({
      promise,
      destroy: value => { destroyed.push(value) },
    })))
    const early = (failingIndex + 1) % resources.length
    const late = (failingIndex + 2) % resources.length
    resources[early]!.resolve(early)
    await setImmediate()
    assert.deepEqual(destroyed, [])
    resources[failingIndex]!.reject(failure)
    await assert.rejects(acquired, error => error === failure)
    await setImmediate()
    assert.deepEqual(destroyed, [early])
    resources[late]!.resolve(late)
    await setImmediate()
    assert.deepEqual(destroyed, [early, late])
    await setImmediate()
    assert.deepEqual(destroyed, [early, late])
  })
}

test('an immediate failure disposes later fulfilled resources without hiding later rejections', async () => {
  const lateSuccess = deferred<number>()
  const lateFailure = deferred<number>()
  const destroyed: number[] = []
  const failure = new Error('first failure')
  const acquired = acquireRendererResources([
    { promise: Promise.reject(failure), destroy: () => { assert.fail('rejected acquisition has no resource') } },
    { promise: lateSuccess.promise, destroy: value => { destroyed.push(value) } },
    { promise: lateFailure.promise, destroy: () => { assert.fail('late rejection has no resource') } },
  ])
  await assert.rejects(acquired, error => error === failure)
  assert.deepEqual(destroyed, [])
  lateFailure.reject(new Error('later failure'))
  lateSuccess.resolve(2)
  await setImmediate()
  assert.deepEqual(destroyed, [2])
})

test('repeated independent failures never dispose a successful replacement', async () => {
  const destroyed: number[] = []
  for (const attempt of [1, 2, 3]) {
    const failure = new Error(`attempt ${attempt}`)
    await assert.rejects(acquireRendererResources([
      { promise: Promise.resolve(attempt), destroy: value => { destroyed.push(value) } },
      { promise: Promise.reject(failure), destroy: () => {} },
    ]), error => error === failure)
  }
  const [replacement] = await acquireRendererResources([
    { promise: Promise.resolve(4), destroy: value => { destroyed.push(value) } },
  ])
  await setImmediate()
  assert.equal(replacement, 4)
  assert.deepEqual(destroyed, [1, 2, 3])
})

test('cleanup exceptions are reported without changing the acquisition error or skipping siblings', async (context) => {
  const failure = new Error('acquisition failed')
  const cleanupFailure = new Error('cleanup failed')
  const asyncCleanupFailure = new Error('asynchronous cleanup failed')
  const lateCleanupFailure = new Error('late cleanup failed')
  const late = deferred<number>()
  const destroyed: number[] = []
  const reports: unknown[][] = []
  context.mock.method(console, 'error', (...args: unknown[]) => { reports.push(args) })
  const acquired = acquireRendererResources([
    { promise: Promise.resolve(1), destroy: value => { destroyed.push(value); throw cleanupFailure } },
    { promise: Promise.reject(failure), destroy: () => {} },
    { promise: Promise.resolve(3), destroy: value => { destroyed.push(value) } },
    { promise: late.promise, destroy: value => { destroyed.push(value); throw lateCleanupFailure } },
    { promise: Promise.resolve(5), destroy: value => { destroyed.push(value); return Promise.reject(asyncCleanupFailure) } },
  ])
  await assert.rejects(acquired, error => error === failure)
  await setImmediate()
  assert.deepEqual(destroyed, [1, 3, 5])
  late.resolve(4)
  await setImmediate()
  assert.deepEqual(destroyed, [1, 3, 5, 4])
  assert.deepEqual(reports.map(([, error]) => error), [cleanupFailure, asyncCleanupFailure, lateCleanupFailure])
})
