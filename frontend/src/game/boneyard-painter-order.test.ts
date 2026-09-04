import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BoneyardPainterOrderPlanner,
  buildBoneyardPainterOrder,
} from './boneyard-painter-order.ts'
import {
  buildNativeRegionPainterOrder,
  NativeRegionPainterPlanner,
  nativeRegionPainterRow,
} from './region-painter-order.ts'
import {
  buildNativeZAnimSplitBands,
  nativeZAnimSplitInsertions,
} from './native-zanim-split.ts'
import {
  NativeHubPainterPlanner,
  nativeHubFixedActorPainterRegistration,
  reserveNativeHubFixedActorPainters,
} from './hub-painter-order.ts'
import { createNativeWorldManagerOrder } from './core-kernels/native-world-manager-order.ts'

test('Hub scene planners preserve hidden roots, nested insertion order, and scene isolation', () => {
  const courtyard = new NativeHubPainterPlanner()
  const privateRoom = new NativeHubPainterPlanner()
  const actor = { zIndex: 0 }
  const hidden = { zIndex: -1 }
  const future = { zIndex: 0 }
  const nested = { zIndex: 0 }
  const persistent = { zIndex: 0 }
  const privateActor = { zIndex: 0 }
  const result = courtyard.apply([
    { ...regionEntry('persistent', 'scenery', 0, 140), target: persistent },
    {
      ...regionEntry('hidden', 'actor', 0, 100),
      target: hidden,
      visible: false,
      insertionTargets: { future, nested },
      insertions: [{
        id: 'future', sortBias: 0, visible: true, worldY: 120,
        insertions: [{ id: 'nested', sortBias: 0, visible: true, worldY: 140 }],
      }],
    },
    { ...regionEntry('actor', 'actor', 1, 140), target: actor },
  ], 100)
  assert.deepEqual(result, [
    { id: 'future', row: 10, zIndex: 1 },
    { id: 'actor', row: 20, zIndex: 2 },
    { id: 'persistent', row: 20, zIndex: 3 },
    { id: 'nested', row: 20, zIndex: 4 },
  ])
  assert.deepEqual([hidden.zIndex, future.zIndex, actor.zIndex, persistent.zIndex, nested.zIndex],
    [-1, 1001, 1002, 1003, 1004])
  const privateResult = privateRoom.apply([
    { ...regionEntry('private', 'actor', 0, -20), target: privateActor },
  ], 0, 50)
  assert.equal(privateActor.zIndex, 51)
  assert.equal(result.length, 4)
  courtyard.clear()
  assert.deepEqual(result, [])
  assert.deepEqual(privateResult, [{ id: 'private', row: -10, zIndex: 1 }])
  courtyard.apply([{ ...regionEntry('actor', 'actor', 0, 0), target: actor }], 0)
  assert.equal(actor.zIndex, 1001)
  assert.equal(nested.zIndex, 1004)
  privateRoom.clear()
})

test('Hub planner rejects duplicate and missing insertion targets and can recover', () => {
  const planner = new NativeHubPainterPlanner()
  const root = { ...regionEntry('root', 'actor', 0, 0), target: { zIndex: 0 } }
  assert.throws(() => planner.apply([{
    ...root, insertionTargets: { root: root.target },
  }], 0), /duplicate native Hub painter target root/)
  assert.throws(() => planner.apply([{
    ...root, insertions: [{ id: 'missing', sortBias: 0, visible: true, worldY: 2 }],
  }], 0), /native Hub painter missing lost its target/)
  assert.deepEqual(planner.apply([root], 0), [{ id: 'root', row: 0, zIndex: 1 }])
  assert.deepEqual(planner.apply([], 0), [])
})

test('painter admission rejects invalid records and releases failed-build state', () => {
  const planner = new NativeRegionPainterPlanner()
  const valid = regionEntry('valid', 'actor', 0, 0)
  const invalid = [
    { ...valid, id: '' },
    { ...valid, worldY: Number.NaN },
    { ...valid, sortBias: Number.POSITIVE_INFINITY },
    { ...valid, registration: { managerLane: 'actor' as const, registrationOrdinal: -1 } },
    { ...valid, registration: { managerLane: 'actor' as const, registrationOrdinal: 0.5 } },
    { ...valid, registration: { managerLane: 'invalid' as 'actor', registrationOrdinal: 0 } },
  ]
  for (const entry of invalid) {
    assert.throws(() => planner.build([entry], 0))
    assert.deepEqual(planner.build([valid], 0).orderedLayers, [
      { id: 'valid', row: 0, zIndex: 1 },
    ])
  }
  assert.throws(() => planner.build([valid], Number.NaN), /reference Y must be finite/)
  assert.throws(() => planner.build([valid, {
    ...valid, registration: { managerLane: 'scenery', registrationOrdinal: 0 },
  }], 0), /duplicate native Region painter id valid/)
  planner.clear()
  assert.throws(() => planner.rootEntryAt(0), /root placement 0 is unavailable/)
  assert.throws(() => planner.isInsertionAt(0), /placement 0 is unavailable/)
  assert.deepEqual(planner.build([{
    id: 'minimal', worldY: 2, sortBias: 0,
    registration: { managerLane: 'actor', registrationOrdinal: 0 },
  }], 0).orderedLayers, [{ id: 'minimal', row: 1, zIndex: 1 }])
})

test('fixed Hub painters require a known id and the first actor registrations', () => {
  assert.throws(() => nativeHubFixedActorPainterRegistration('invalid' as 'teacher'),
    /unknown native Hub painter invalid/)
  const order = createNativeWorldManagerOrder()
  order.register('actor')
  assert.throws(() => reserveNativeHubFixedActorPainters(order), /reservation is not first/)
})

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

test('frame-local Region planner reuses scratch without retaining failed state', () => {
  const planner = new NativeRegionPainterPlanner()
  assert.throws(() => planner.build([
    regionEntry('first', 'actor', 0, 0),
    regionEntry('duplicate', 'actor', 0, 1),
  ], 0), /duplicate native actor registration ordinal 0/)

  const entries = [
    {
      ...regionEntry('owner', 'actor', 0, 100),
      insertions: [{ id: 'future', sortBias: 0, visible: true, worldY: 140 }],
    },
    regionEntry('scenery', 'scenery', 0, 120),
  ]
  const first = planner.build(entries, 100)
  assert.deepEqual(structuredClone(first), buildNativeRegionPainterOrder({
    referenceY: 100,
    entries,
  }))
  const orderedSlots = first.orderedLayers

  const second = planner.build([regionEntry('replacement', 'transient', 0, 90)], 110)
  assert.equal(second, first)
  assert.equal(second.orderedLayers, orderedSlots)
  assert.deepEqual(second.orderedLayers, [
    { id: 'replacement', row: -10, zIndex: 1 },
  ])
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

test('retained Boneyard planner matches the detached builder across consecutive frames', () => {
  const planner = new BoneyardPainterOrderPlanner()
  const input = {
    referenceY: 100,
    staticLayers: [
      { layerIndex: 4, worldY: 90, sortBias: 0, sourceOrder: 0 },
      { layerIndex: 8, worldY: 140, sortBias: 0, sourceOrder: 1 },
    ],
    dynamicLayers: [{
      id: 'actor',
      insertions: [{ id: 'actor-proxy', sortBias: 0, visible: true, worldY: 130 }],
      queueFamily: 'ordinary-dynamic' as const,
      registration: { managerLane: 'actor' as const, registrationOrdinal: 0 },
      sortBias: 0,
      visible: false,
      worldY: 100,
    }],
  }
  const retained = planner.build(input)
  assert.deepEqual(structuredClone(retained), buildBoneyardPainterOrder(input))
  const bands = retained.bands
  const dynamics = retained.dynamicLayers

  const nextInput = {
    ...input,
    referenceY: 120,
    staticLayers: input.staticLayers.slice(1),
    dynamicLayers: [{
      ...input.dynamicLayers[0],
      insertions: undefined,
      visible: true,
      worldY: 160,
    }],
  }
  const next = planner.build(nextInput)
  assert.equal(next, retained)
  assert.equal(next.bands, bands)
  assert.equal(next.dynamicLayers, dynamics)
  assert.deepEqual(structuredClone(next), buildBoneyardPainterOrder(nextInput))
})

test('retained Region planner reuses result storage without retaining retired membership', () => {
  const planner = new NativeRegionPainterPlanner()
  const first = planner.build([
    regionEntry('actor', 'actor', 0, 100),
    regionEntry('scenery', 'scenery', 0, 120),
  ], 100)
  const resultIdentity = first
  const orderedIdentity = first.orderedLayers
  const actorIdentity = first.orderedLayers[0]
  assert.deepEqual(first.orderedLayers.map(({ id, row, zIndex }) => ({ id, row, zIndex })), [
    { id: 'actor', row: 0, zIndex: 1 },
    { id: 'scenery', row: 10, zIndex: 2 },
  ])

  const second = planner.build([
    regionEntry('actor', 'actor', 0, 104),
    regionEntry('scenery', 'scenery', 0, 124),
  ], 100)
  assert.strictEqual(second, resultIdentity)
  assert.strictEqual(second.orderedLayers, orderedIdentity)
  assert.strictEqual(second.orderedLayers[0], actorIdentity)
  assert.deepEqual(second.orderedLayers.map(({ id, row, zIndex }) => ({ id, row, zIndex })), [
    { id: 'actor', row: 2, zIndex: 1 },
    { id: 'scenery', row: 12, zIndex: 2 },
  ])

  const third = planner.build([regionEntry('replacement', 'actor', 1, 100)], 100)
  assert.strictEqual(third.orderedLayers, orderedIdentity)
  assert.equal(third.orderedLayers.length, 1)
  assert.equal(third.orderedLayers[0]?.id, 'replacement')
  planner.clear()
  assert.equal(third.orderedLayers.length, 0)
  assert.equal(third.queueEndZIndex, 1)
})

test('retained Boneyard planner preserves static proxy membership and pooled identities', () => {
  const planner = new BoneyardPainterOrderPlanner()
  const staticLayers = [{
    insertions: [{
      id: 'proxy:tree-upper',
      sortBias: 0,
      visible: true,
      worldY: 140,
    }],
    layerIndex: 0,
    sortBias: 0,
    sourceOrder: 0,
    worldY: 100,
  }]
  const dynamicLayers = [{
    id: 'player',
    queueFamily: 'ordinary-dynamic' as const,
    registration: { managerLane: 'actor' as const, registrationOrdinal: 0 },
    sortBias: 0,
    worldY: 120,
  }]
  const first = planner.build({ dynamicLayers, referenceY: 100, staticLayers })
  const resultIdentity = first
  const bandArrayIdentity = first.bands
  const dynamicArrayIdentity = first.dynamicLayers
  const orderedArrayIdentity = first.orderedLayers
  const proxyArrayIdentity = first.proxyLayers
  const playerIdentity = first.dynamicLayers[0]
  assert.deepEqual(first.bands, [
    { id: 'static-0', layerIndexes: [0], row: 0, zIndex: 1 },
  ])
  assert.deepEqual(first.dynamicLayers, [{ id: 'player', row: 10, zIndex: 2 }])
  assert.deepEqual(first.proxyLayers, [{ id: 'proxy:tree-upper', row: 20, zIndex: 3 }])

  staticLayers[0]!.worldY = 104
  dynamicLayers[0]!.worldY = 124
  const second = planner.build({ dynamicLayers, referenceY: 100, staticLayers })
  assert.strictEqual(second, resultIdentity)
  assert.strictEqual(second.bands, bandArrayIdentity)
  assert.strictEqual(second.dynamicLayers, dynamicArrayIdentity)
  assert.strictEqual(second.orderedLayers, orderedArrayIdentity)
  assert.strictEqual(second.proxyLayers, proxyArrayIdentity)
  assert.strictEqual(second.dynamicLayers[0], playerIdentity)
  assert.deepEqual(second.bands, [
    { id: 'static-0', layerIndexes: [0], row: 2, zIndex: 1 },
  ])
  assert.deepEqual(second.dynamicLayers, [{ id: 'player', row: 12, zIndex: 2 }])

  const third = planner.build({ dynamicLayers: [], referenceY: 100, staticLayers: [] })
  assert.equal(third.bands.length, 0)
  assert.equal(third.dynamicLayers.length, 0)
  assert.equal(third.orderedLayers.length, 0)
  assert.equal(third.proxyLayers.length, 0)
  assert.equal(third.foregroundZIndex, 1)
  planner.clear()
})

test('pure painter builders retain frozen Region snapshot ownership', () => {
  const region = buildNativeRegionPainterOrder({
    entries: [regionEntry('actor', 'actor', 0, 100)],
    referenceY: 100,
  })
  const boneyard = buildBoneyardPainterOrder({
    dynamicLayers: [{
      id: 'actor',
      queueFamily: 'ordinary-dynamic',
      registration: { managerLane: 'actor', registrationOrdinal: 0 },
      sortBias: 0,
      worldY: 100,
    }],
    referenceY: 100,
    staticLayers: [],
  })
  assert.equal(Object.isFrozen(region), true)
  assert.equal(Object.isFrozen(region.orderedLayers), true)
  assert.equal(Object.isFrozen(region.orderedLayers[0]), true)
  assert.equal(Object.isFrozen(boneyard.orderedLayers), true)
  assert.equal(Object.isFrozen(boneyard.orderedLayers[0]), true)
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
