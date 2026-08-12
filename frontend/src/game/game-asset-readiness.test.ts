import assert from 'node:assert/strict'
import test from 'node:test'

import { collectAssetSources, loadAssetBatch } from './game-asset-readiness.ts'

test('collects a stable unique manifest from nested asset groups', () => {
  assert.deepEqual(
    collectAssetSources({ first: ['a.png', 'b.png'], second: { repeat: 'a.png', last: 'c.png' } }),
    ['a.png', 'b.png', 'c.png'],
  )
})

test('reports actual task completions and resolves only after every asset', async () => {
  const releases = new Map<string, () => void>()
  const progress: Array<readonly [number, number]> = []
  const loading = loadAssetBatch(
    ['one', 'two', 'one'],
    (source) => new Promise<void>((resolve) => releases.set(source, resolve)),
    ({ completed, total }) => progress.push([completed, total]),
  )

  assert.deepEqual(progress, [[0, 2]])
  releases.get('two')?.()
  await Promise.resolve()
  assert.deepEqual(progress, [[0, 2], [1, 2]])
  releases.get('one')?.()
  await loading
  assert.deepEqual(progress, [[0, 2], [1, 2], [2, 2]])
})
