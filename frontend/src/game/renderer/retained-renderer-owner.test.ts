import assert from 'node:assert/strict'
import test from 'node:test'

import { createRetainedRendererOwner } from './retained-renderer-owner.ts'

test('retained renderer owner reuses one renderer until scene cleanup', async () => {
  let createCount = 0
  let destroyCount = 0
  const owner = createRetainedRendererOwner(async () => {
    createCount += 1
    return {
      destroy() {
        destroyCount += 1
      },
    }
  })

  const first = await owner.get()
  assert.equal(await owner.get(), first)
  assert.equal(createCount, 1)

  owner.destroy()
  await Promise.resolve()
  assert.equal(destroyCount, 1)

  const replacement = await owner.get()
  assert.notEqual(replacement, first)
  assert.equal(createCount, 2)
  owner.destroy()
  await Promise.resolve()
  assert.equal(destroyCount, 2)
})

test('retained renderer owner destroys an in-flight renderer without poisoning its replacement', async () => {
  const resolvers: Array<(renderer: { destroy(): void }) => void> = []
  const destroyed: number[] = []
  const owner = createRetainedRendererOwner(() => new Promise<{ destroy(): void }>((resolve) => {
    resolvers.push(resolve)
  }))

  const first = owner.get()
  owner.destroy()
  const second = owner.get()
  assert.notEqual(second, first)

  resolvers[0]!({ destroy: () => destroyed.push(1) })
  resolvers[1]!({ destroy: () => destroyed.push(2) })
  await first
  await second
  await Promise.resolve()
  assert.deepEqual(destroyed, [1])

  owner.destroy()
  await Promise.resolve()
  assert.deepEqual(destroyed, [1, 2])
})

test('a failed retained renderer can be acquired again without recreating the scene owner', async () => {
  const failure = new Error('temporary texture failure')
  let creates = 0
  let destroyed = 0
  const replacement = { destroy() { destroyed += 1 } }
  const owner = createRetainedRendererOwner(async () => {
    creates += 1
    if (creates < 3) throw failure
    return replacement
  })
  const first = owner.get()
  assert.equal(owner.get(), first)
  await assert.rejects(first, error => error === failure)
  await assert.rejects(owner.get(), error => error === failure)
  assert.equal(creates, 2)
  assert.equal(await owner.get(), replacement)
  assert.equal(await owner.get(), replacement)
  assert.equal(creates, 3)
  owner.destroy()
  await Promise.resolve()
  assert.equal(destroyed, 1)
})

test('a retired creation rejection does not evict its in-flight replacement', async () => {
  const failure = new Error('retired creation failed')
  const pending: Array<{
    resolve(value: { destroy(): void }): void
    reject(error: unknown): void
  }> = []
  const owner = createRetainedRendererOwner(() => new Promise<{ destroy(): void }>((resolve, reject) => {
    pending.push({ resolve, reject })
  }))
  const first = owner.get()
  owner.destroy()
  const second = owner.get()
  pending[0]!.reject(failure)
  await assert.rejects(first, error => error === failure)
  assert.equal(owner.get(), second)
  assert.equal(pending.length, 2)
  let destroyed = 0
  const replacement = { destroy() { destroyed += 1 } }
  pending[1]!.resolve(replacement)
  assert.equal(await second, replacement)
  assert.equal(await owner.get(), replacement)
  owner.destroy()
  await Promise.resolve()
  assert.equal(destroyed, 1)
})
