import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBoneyardPainterOrder,
  nativePainterRow,
} from './boneyard-painter-order.ts'
import {
  buildNativeRegionPainterOrder,
  nativeRegionPainterRow,
} from './region-painter-order.ts'
import {
  buildNativeZAnimSplitBands,
  nativeZAnimSplitInsertions,
} from './native-zanim-split.ts'

test('shared Region rows retain native truncation on both sides of the reference player', () => {
  assert.equal(nativeRegionPainterRow(100.9, 0, 150.9), -25)
  assert.equal(nativeRegionPainterRow(100.9, -15, 150.9), -32)
  assert.equal(nativeRegionPainterRow(151.9, 0, 150.9), 0)
  assert.equal(nativeRegionPainterRow(152.1, 0, 150.9), 1)
  assert.equal(nativeRegionPainterRow(-1.9, 0, 0.9), 0)
  assert.equal(nativeRegionPainterRow(-2.1, 0, 0.9), -1)
})

test('shared Region queue ignores presentation categories and gathers manager registrations', () => {
  const order = buildNativeRegionPainterOrder({
    referenceY: 100,
    entries: [
      regionEntry('transient:0', 'transient', 0, 100),
      regionEntry('actor:1', 'actor', 1, 100),
      regionEntry('scenery:1', 'scenery', 1, 100),
      regionEntry('actor:0', 'actor', 0, 100),
      regionEntry('scenery:0', 'scenery', 0, 100),
    ],
  })

  assert.deepEqual(order.orderedLayers.map(({ id, row, zIndex }) => ({ id, row, zIndex })), [
    { id: 'actor:0', row: 0, zIndex: 1 },
    { id: 'actor:1', row: 0, zIndex: 2 },
    { id: 'scenery:0', row: 0, zIndex: 3 },
    { id: 'scenery:1', row: 0, zIndex: 4 },
    { id: 'transient:0', row: 0, zIndex: 5 },
  ])
  assert.equal(order.queueEndZIndex, 6)
})

test('PuppetPointer future-row roots append after every persistent manager family', () => {
  const order = buildNativeRegionPainterOrder({
    referenceY: 100,
    entries: [
      {
        ...regionEntry('tree-base', 'scenery', 0, 100),
        insertions: [{ id: 'tree-upper', sortBias: 0, visible: true, worldY: 200 }],
      },
      regionEntry('later-actor', 'actor', 1, 200),
      regionEntry('later-scenery', 'scenery', 1, 200),
      regionEntry('later-transient', 'transient', 0, 200),
    ],
  })

  assert.deepEqual(order.orderedLayers.map(({ id }) => id), [
    'tree-base',
    'later-actor',
    'later-scenery',
    'later-transient',
    'tree-upper',
  ])
})

test('same-row dynamic insertions remain behind entries gathered before queue flush', () => {
  const order = buildNativeRegionPainterOrder({
    referenceY: 100,
    entries: [
      {
        ...regionEntry('producer', 'actor', 0, 100),
        insertions: [{ id: 'proxy', sortBias: 0, visible: true, worldY: 100 }],
      },
      regionEntry('actor-tail', 'actor', 1, 100),
      regionEntry('scenery', 'scenery', 0, 100),
      regionEntry('transient', 'transient', 0, 100),
    ],
  })

  assert.deepEqual(order.orderedLayers.map(({ id }) => id), [
    'producer',
    'actor-tail',
    'scenery',
    'transient',
    'proxy',
  ])
})

test('multiple proxy producers retain their causal owner draw order', () => {
  const order = buildNativeRegionPainterOrder({
    referenceY: 100,
    entries: [
      {
        ...regionEntry('first-owner', 'actor', 0, 100),
        insertions: [{ id: 'first-proxy', sortBias: 0, visible: true, worldY: 300 }],
      },
      {
        ...regionEntry('second-owner', 'actor', 1, 100),
        insertions: [{ id: 'second-proxy', sortBias: 0, visible: true, worldY: 300 }],
      },
      regionEntry('future-scenery', 'scenery', 0, 300),
    ],
  })

  assert.deepEqual(order.orderedLayers.map(({ id }) => id), [
    'first-owner',
    'second-owner',
    'future-scenery',
    'first-proxy',
    'second-proxy',
  ])
})

test('Region planner rejects duplicate manager slots and backwards proxy insertion', () => {
  assert.throws(() => buildNativeRegionPainterOrder({
    referenceY: 0,
    entries: [
      regionEntry('first', 'actor', 0, 0),
      regionEntry('duplicate', 'actor', 0, 1),
    ],
  }), /duplicate native actor registration ordinal 0/)
  assert.throws(() => buildNativeRegionPainterOrder({
    referenceY: 0,
    entries: [{
      ...regionEntry('owner', 'actor', 0, 100),
      insertions: [{ id: 'backwards', sortBias: 0, visible: true, worldY: 0 }],
    }],
  }), /cannot insert into a Region row that already painted/)
})

test('ZAnimSplit uses bottom-anchored 25/50-unit clipped AnimPointer bands', () => {
  const enhanced = buildNativeZAnimSplitBands('air:1:body', {
    height: 61,
    y: -31,
  }, true)
  assert.deepEqual(enhanced, [
    {
      clip: { height: 25, width: 10_000, x: 0, y: -31 },
      id: 'air:1:body:band-0',
      painterY: -6,
    },
    {
      clip: { height: 25, width: 10_000, x: 0, y: -6 },
      id: 'air:1:body:band-1',
      painterY: 19,
    },
    {
      clip: { height: 25, width: 10_000, x: 0, y: 19 },
      id: 'air:1:body:band-2',
      painterY: 44,
    },
  ])
  assert.deepEqual(
    buildNativeZAnimSplitBands('blizzard:2', { height: 61, y: -31 }, false)
      .map(({ clip, painterY }) => ({ clip, painterY })),
    [
      { clip: { height: 50, width: 10_000, x: 0, y: -31 }, painterY: 19 },
      { clip: { height: 50, width: 10_000, x: 0, y: 19 }, painterY: 69 },
    ],
  )
  assert.deepEqual(nativeZAnimSplitInsertions(enhanced).map(({ id, worldY }) => ({
    id,
    worldY,
  })), [
    { id: 'air:1:body:band-0', worldY: -6 },
    { id: 'air:1:body:band-1', worldY: 19 },
    { id: 'air:1:body:band-2', worldY: 44 },
  ])
  assert.deepEqual(buildNativeZAnimSplitBands('empty', { height: 0, y: 5 }, true), [])
})

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
        registration: { managerLane: 'actor', registrationOrdinal: 0 },
        worldY: 150,
        sortBias: 0,
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
        registration: { managerLane: 'actor', registrationOrdinal: 0 },
        worldY: 100,
        sortBias: 0,
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
        registration: { managerLane: 'actor', registrationOrdinal: 0 },
        worldY: 100,
        sortBias: 0,
      },
      {
        id: 'water-normal',
        queueFamily: 'zanim',
        registration: { managerLane: 'transient', registrationOrdinal: 0 },
        worldY: 100,
        sortBias: 0,
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

test('reports dynamic Puppet and AnimPointer insertions as explicit proxy roots', () => {
  const order = buildBoneyardPainterOrder({
    referenceY: 100,
    staticLayers: [],
    dynamicLayers: [{
      id: 'hidden-owner',
      insertions: [
        { id: 'split-band-0', sortBias: 0, visible: true, worldY: 125 },
        { id: 'split-band-1', sortBias: 0, visible: true, worldY: 150 },
      ],
      queueFamily: 'ordinary-dynamic',
      registration: { managerLane: 'actor', registrationOrdinal: 0 },
      sortBias: 0,
      visible: false,
      worldY: 100,
    }],
  })

  assert.deepEqual(order.dynamicLayers, [
    { id: 'split-band-0', row: 12, zIndex: 1 },
    { id: 'split-band-1', row: 25, zIndex: 2 },
  ])
  assert.deepEqual(order.proxyLayers, order.dynamicLayers)
})

function regionEntry(
  id: string,
  managerLane: 'actor' | 'scenery' | 'transient',
  registrationOrdinal: number,
  worldY: number,
) {
  return {
    id,
    insertions: [],
    registration: { managerLane, registrationOrdinal },
    sortBias: 0,
    visible: true,
    worldY,
  } as const
}
