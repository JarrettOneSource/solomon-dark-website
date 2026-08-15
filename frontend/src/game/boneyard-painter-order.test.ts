import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBoneyardPainterOrder,
  nativePainterRow,
} from './boneyard-painter-order.ts'

test('uses the stock two-world-unit effective-Y row formula', () => {
  assert.equal(nativePainterRow(100.9, 0, 150.9), -25)
  assert.equal(nativePainterRow(100.9, -15, 150.9), -32)
  assert.equal(nativePainterRow(151.9, 0, 150.9), 0)
  assert.equal(nativePainterRow(152.1, 0, 150.9), 1)
})

test('splits scenery into bands so an actor can pass behind a Tree or Gravestone', () => {
  const order = buildBoneyardPainterOrder({
    referenceY: 150,
    staticLayers: [
      { layerIndex: 0, worldY: 100, sortBias: 0, sourceOrder: 0 },
      { layerIndex: 1, worldY: 200, sortBias: 0, sourceOrder: 1 },
    ],
    dynamicLayers: [
      {
        id: 'player',
        queueFamily: 'ordinary-dynamic',
        worldY: 150,
        sortBias: 0,
        sourceOrder: 0,
      },
    ],
  })

  assert.deepEqual(order.bands, [
    { id: 'static-0', layerIndexes: [0], row: -25, zIndex: 1 },
    { id: 'static-1', layerIndexes: [1], row: 25, zIndex: 3 },
  ])
  assert.deepEqual(order.dynamicLayers, [
    { id: 'player', row: 0, zIndex: 2 },
  ])
  assert.equal(order.foregroundZIndex, 4)
})

test('keeps a biased Gate body behind its post and gives actors the native same-row tie', () => {
  const order = buildBoneyardPainterOrder({
    referenceY: 100,
    staticLayers: [
      { layerIndex: 0, worldY: 100, sortBias: -15, sourceOrder: 10 },
      { layerIndex: 1, worldY: 100, sortBias: 0, sourceOrder: 1 },
      { layerIndex: 2, worldY: 100, sortBias: 0, sourceOrder: 2 },
    ],
    dynamicLayers: [
      {
        id: 'player',
        queueFamily: 'ordinary-dynamic',
        worldY: 100,
        sortBias: 0,
        sourceOrder: 0,
      },
    ],
  })

  assert.deepEqual(order.bands, [
    { id: 'static-0', layerIndexes: [0], row: -7, zIndex: 1 },
    { id: 'static-1', layerIndexes: [1, 2], row: 0, zIndex: 3 },
  ])
  assert.deepEqual(order.dynamicLayers, [
    { id: 'player', row: 0, zIndex: 2 },
  ])
})

test('places same-row Water Normal ZAnim after ordinary actors and scenery', () => {
  const order = buildBoneyardPainterOrder({
    referenceY: 100,
    staticLayers: [
      { layerIndex: 0, worldY: 100, sortBias: 0, sourceOrder: 0 },
    ],
    dynamicLayers: [
      {
        id: 'player',
        queueFamily: 'ordinary-dynamic',
        worldY: 100,
        sortBias: 0,
        sourceOrder: 0,
      },
      {
        id: 'water-normal',
        queueFamily: 'zanim',
        worldY: 100,
        sortBias: 0,
        sourceOrder: 1,
      },
    ],
  })

  assert.deepEqual(order.dynamicLayers, [
    { id: 'player', row: 0, zIndex: 1 },
    { id: 'water-normal', row: 0, zIndex: 3 },
  ])
  assert.deepEqual(order.bands, [
    { id: 'static-0', layerIndexes: [0], row: 0, zIndex: 2 },
  ])
})
