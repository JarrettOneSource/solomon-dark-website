import assert from 'node:assert/strict'
import test from 'node:test'

import { planGameTextureSources } from './game-texture-source-policy.ts'

test('texture source plans classify every source exactly once', () => {
  assert.deepEqual(planGameTextureSources({
    composited: ['composite-a', 'composite-b'],
    stock: ['stock-a'],
    stockFramed: ['framed-a'],
    stockPoint: ['font-a'],
  }), {
    policies: {
      'composite-a': 'composited',
      'composite-b': 'composited',
      'font-a': 'stock-point',
      'framed-a': 'stock-framed',
      'stock-a': 'stock',
    },
    sources: ['stock-a', 'framed-a', 'font-a', 'composite-a', 'composite-b'],
  })
})

test('texture source plans reject missing, duplicate, and conflicting membership', () => {
  assert.throws(() => planGameTextureSources({}), /must not be empty/)
  assert.throws(() => planGameTextureSources({ stock: [''] }), /must not be empty/)
  assert.throws(
    () => planGameTextureSources({ stock: ['same', 'same'] }),
    /classified as both stock and stock/,
  )
  assert.throws(
    () => planGameTextureSources({ composited: ['same'], stock: ['same'] }),
    /classified as both stock and composited/,
  )
  assert.throws(
    () => planGameTextureSources({ stock: ['same'], stockFramed: ['same'] }),
    /classified as both stock and stock-framed/,
  )
})
