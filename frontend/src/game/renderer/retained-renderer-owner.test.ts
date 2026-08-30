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
