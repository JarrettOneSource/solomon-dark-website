import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import test from 'node:test'

import {
  GameModContentLoadError,
  gameContentUrl,
  prefetchGameContent,
} from './game-content-cache.ts'

const bytes = new TextEncoder().encode('verified mod pixels')
const asset = {
  byteLength: bytes.length,
  modId: 'tests.cache',
  path: 'sprites/item.png',
  sha256: createHash('sha256').update(bytes).digest('hex'),
}

test('content cache streams, verifies, stores, and reuses one immutable hash', async () => {
  const stored = new Map<string, Response>()
  let requests = 0
  const cache = {
    async delete(key: RequestInfo | URL) { return stored.delete(String(key)) },
    async match(key: RequestInfo | URL) { return stored.get(String(key))?.clone() },
    async put(key: RequestInfo | URL, response: Response) { stored.set(String(key), response.clone()) },
  }
  const cacheStorage = { async open() { return cache as unknown as Cache } }
  const progress: number[] = []
  const options = {
    cacheStorage,
    request: async () => {
      requests += 1
      return new Response(bytes)
    },
    subtle: webcrypto.subtle,
  }
  await prefetchGameContent([asset, asset], value => progress.push(value.completedBytes), options)
  await prefetchGameContent([asset], undefined, options)
  assert.equal(requests, 1)
  assert.equal(stored.has(gameContentUrl(asset)), true)
  assert.equal(progress.at(-1), bytes.length)
})

test('content cache rejects a hash mismatch without storing it', async () => {
  const stored = new Map<string, Response>()
  const cacheStorage = {
    async open() {
      return {
        async delete() { return false },
        async match() { return undefined },
        async put(key: RequestInfo | URL, response: Response) {
          stored.set(String(key), response)
        },
      } as unknown as Cache
    },
  }
  let failure: unknown
  try {
    await prefetchGameContent([{ ...asset, sha256: '0'.repeat(64) }], undefined, {
      cacheStorage,
      request: async () => new Response(bytes),
      subtle: webcrypto.subtle,
    })
  } catch (error) {
    failure = error
  }
  assert.ok(failure instanceof GameModContentLoadError)
  assert.match(failure.message, /failed verification/)
  assert.equal(failure.modId, asset.modId)
  assert.equal(stored.size, 0)
})
