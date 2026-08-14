import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BoneyardTreeOcclusionPresentation,
  NATIVE_TREE_ALPHA_STEP,
  NATIVE_TREE_FADED_ALPHA,
  NATIVE_TREE_OCCLUSION_BOUNDS,
  NATIVE_TREE_OCCLUSION_POLYGONS,
  NATIVE_TREE_SCAN_TICKS,
  advanceNativeTreeOcclusionTick,
  createNativeTreeOcclusionState,
  nativeTreeContainsLocalPlayer,
  nativeTreeInitialCountdown,
} from './boneyard-tree-occlusion.ts'

const f32 = Math.fround

const EXPECTED_POLYGONS = [
  [
    [-144.99169921875, -29.943328857421875],
    [-0.612213134765625, 27.99749755859375],
    [56.565765380859375, 24.125244140625],
    [168.14276123046875, -46.191009521484375],
    [206.2191162109375, -216.246826171875],
    [69.4283447265625, -360.5577697753906],
    [-100.83868408203125, -351.3292541503906],
    [-206.94308471679688, -220.44439697265625],
  ],
  [
    [34.5390625, 24.94439697265625],
    [170.04339599609375, -84.96868896484375],
    [193.65924072265625, -250.1349639892578],
    [f32(69.60733), -386.4930114746094],
    [-154.26708984375, -340.7978820800781],
    [f32(-199.1636), -106.99313354492188],
  ],
  [
    [16.047149658203125, 19.9720458984375],
    [179.94097900390625, -53.37811279296875],
    [f32(215.76721), f32(-244.1641)],
    [105.19406127929688, -385.25439453125],
    [f32(-90.86746), -385.4022521972656],
    [-201.05145263671875, -241.98484802246094],
    [-141.13465881347656, -42.06884765625],
  ],
  [
    [-201.69390869140625, 14.09991455078125],
    [-218.04148864746094, -236.62200927734375],
    [-170.2315673828125, -346.2864990234375],
    [-55.71734619140625, -407.4916687011719],
    [f32(64.987335), -381.35382080078125],
    [80.0916748046875, -329.744873046875],
    [168.09814453125, -276.497314453125],
    [137.14453125, 60.330047607421875],
    [12.385467529296875, 123.2774658203125],
    [f32(-77.64615), 110.34982299804688],
  ],
  [
    [-40.584381103515625, 81.09994506835938],
    [196.1593017578125, -17.644989013671875],
    [210.24615478515625, -236.1368408203125],
    [f32(126.72989), -403.3904724121094],
    [-50.68603515625, -449.74072265625],
    [-199.76913452148438, -272.130126953125],
    [-191.6749725341797, 2.33856201171875],
  ],
  [
    [f32(83.820404), f32(77.241486)],
    [174.1181640625, 27.862396240234375],
    [189.88946533203125, -185.66705322265625],
    [125.4027099609375, -358.42230224609375],
    [-55.57757568359375, -372.36444091796875],
    [-219.3686981201172, -216.94699096679688],
    [f32(-150.752), f32(70.62198)],
  ],
  [
    [59.9710693359375, 43.70965576171875],
    [145.29193115234375, -38.3265380859375],
    [17.297210693359375, -482.73516845703125],
    [-21.1787109375, -482.9326171875],
    [-166.0126953125, -44.270599365234375],
    [f32(-92.60953), 43.120849609375],
  ],
  [
    [-143.9478759765625, 6.6715087890625],
    [106.4464111328125, 19.662567138671875],
    [195.913330078125, -154.60531616210938],
    [123.69085693359375, -299.2760314941406],
    [-151.91461181640625, -293.9779357910156],
    [-243.75140380859375, -125.89852905273438],
  ],
] as const

const EXPECTED_BOUNDS = [
  [-206.94308471679688, -360.5577697753906, 413.1622009277344, 388.5552673339844],
  [f32(-199.1636), -386.4930114746094, 392.8228454589844, 411.4374084472656],
  [-201.05145263671875, -385.4022521972656, 416.81866455078125, 405.3742980957031],
  [-218.04148864746094, -407.4916687011719, 386.1396484375, 530.7691650390625],
  [-199.76913452148438, -449.74072265625, 410.0152893066406, 530.8406982421875],
  [-219.3686981201172, -372.36444091796875, 409.2581787109375, 449.6059265136719],
  [-166.0126953125, -482.9326171875, 311.30462646484375, 526.6422729492188],
  [-243.75140380859375, -299.2760314941406, 439.66473388671875, 318.9385986328125],
] as const

test('pins all initialized retail Tree visibility polygons and strict bounds', () => {
  assert.deepEqual(
    NATIVE_TREE_OCCLUSION_POLYGONS.map((polygon) => (
      polygon.map((point) => [point.x, point.y])
    )),
    EXPECTED_POLYGONS,
  )
  assert.deepEqual(
    NATIVE_TREE_OCCLUSION_BOUNDS.map((bounds) => [
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
    ]),
    EXPECTED_BOUNDS,
  )
})

test('uses the secondary variant polygon with strict edge exclusion', () => {
  const tree = {
    eid: 'tree-0',
    mainVariant: 0,
    position: { x: 1_000, y: 1_000 },
    secondaryVariant: 0,
    secondaryVisible: true,
  }

  assert.equal(
    nativeTreeContainsLocalPlayer(tree, { x: 1_000, y: 900 }),
    true,
  )
  const vertex = NATIVE_TREE_OCCLUSION_POLYGONS[0][0]
  assert.equal(nativeTreeContainsLocalPlayer(tree, {
    x: tree.position.x + vertex.x,
    y: tree.position.y + vertex.y,
  }), false)
  const bounds = NATIVE_TREE_OCCLUSION_BOUNDS[0]
  assert.equal(nativeTreeContainsLocalPlayer(tree, {
    x: tree.position.x + bounds.x,
    y: tree.position.y - 100,
  }), false)
  assert.equal(nativeTreeContainsLocalPlayer(tree, { x: 1_500, y: 900 }), false)
})

test('matches native scan order, one-tick delay, 40-tick fade, and recovery', () => {
  assert.equal(NATIVE_TREE_SCAN_TICKS, 25)
  assert.equal(NATIVE_TREE_ALPHA_STEP, 0.015)
  assert.equal(NATIVE_TREE_FADED_ALPHA, 0.4)

  let state = createNativeTreeOcclusionState(1)
  state = advanceNativeTreeOcclusionTick(state, true)
  assert.deepEqual(state, {
    countdown: 25,
    currentAlpha: 1,
    targetAlpha: 0.4,
  })

  state = advanceNativeTreeOcclusionTick(state, true)
  assert.equal(state.currentAlpha, 0.985)
  for (let tick = 1; tick < 40; tick += 1) {
    state = advanceNativeTreeOcclusionTick(state, true)
  }
  assert.equal(state.currentAlpha, 0.4)
  assert.equal(state.targetAlpha, 0.4)

  state = { countdown: 25, currentAlpha: 0.4, targetAlpha: 0.4 }
  for (let tick = 0; tick < 24; tick += 1) {
    state = advanceNativeTreeOcclusionTick(state, false)
  }
  assert.equal(state.currentAlpha, 0.4)
  assert.equal(state.targetAlpha, 0.4)
  state = advanceNativeTreeOcclusionTick(state, false)
  assert.equal(state.currentAlpha, 0.4)
  assert.equal(state.targetAlpha, 1)
  state = advanceNativeTreeOcclusionTick(state, false)
  assert.equal(state.currentAlpha, 0.41500000000000004)
})

test('uses a stable browser phase only inside the native 0..24 domain', () => {
  const first = Array.from({ length: 128 }, (_, index) => (
    nativeTreeInitialCountdown(`tree-${index}`)
  ))
  const second = Array.from({ length: 128 }, (_, index) => (
    nativeTreeInitialCountdown(`tree-${index}`)
  ))

  assert.deepEqual(first, second)
  assert.ok(first.every((phase) => Number.isInteger(phase) && phase >= 0 && phase < 25))
  assert.ok(new Set(first).size >= 20)
})

test('advances only eligible Trees from the local player and owns no remote input', () => {
  const presentation = new BoneyardTreeOcclusionPresentation([
    {
      eid: 'active',
      mainVariant: 0,
      position: { x: 0, y: 0 },
      secondaryVariant: 0,
      secondaryVisible: true,
    },
    {
      eid: 'no-secondary',
      mainVariant: 0,
      position: { x: 0, y: 0 },
      secondaryVariant: 0,
      secondaryVisible: false,
    },
    {
      eid: 'unsupported-main',
      mainVariant: 6,
      position: { x: 0, y: 0 },
      secondaryVariant: 0,
      secondaryVisible: true,
    },
  ], 10_000)

  assert.deepEqual(presentation.update(10_000, { x: 0, y: -100 }), [
    { alpha: 1, eid: 'active', position: { x: 0, y: 0 } },
  ])
  const faded = presentation.update(10_065, { x: 0, y: -100 })
  assert.equal(faded[0].alpha, 0.4)
  const recovered = presentation.update(10_130, { x: 500, y: 500 })
  assert.equal(recovered[0].alpha, 1)
})
