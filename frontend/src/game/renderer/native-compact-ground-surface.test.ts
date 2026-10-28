import assert from 'node:assert/strict'
import test from 'node:test'
import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import { createNativeDeadSpider } from '../core-kernels/native-dead-spider.ts'
import type { BoneyardSpiderRemainsSnapshot } from '../protocol/spider-state.ts'
import { NativeCompactGroundSurface } from './native-compact-ground-surface.ts'

function scene(selector: number, x = 100, y = 100, rotation = 0, scale = 1): BoneyardScene {
  return { name: 'ground query', environmentMode: 0, bounds: { x: 0, y: 0, w: 800, h: 600 },
    spawn: { x: 0, y: 0, facingDeg: 0 }, objects: [], roads: [], fences: [], terrain: [], solomonDig: null,
    sprites: [{ eid: 'compact', atlasEntry: selector, pos: { x, y }, s0: rotation, s1: scale, s2: 0, flags: 0 }],
  }
}

test('all authored compact selectors admit their centres without a water-only gate', () => {
  for (const selector of [25, 26, 27, 28, 29]) {
    const query = new NativeCompactGroundSurface(scene(selector))
    assert.equal(query.contains({ x: 100, y: 100 }, []), true)
    assert.equal(query.contains({ x: 400, y: 400 }, []), false)
  }
})

test('the surface query subtracts record position without inverting visual transforms', () => {
  const ordinary = new NativeCompactGroundSurface(scene(25))
  const transformed = new NativeCompactGroundSurface(scene(25, 100, 100, 137, 0.1))
  for (const point of [{ x: 130, y: 100 }, { x: 70, y: 90 }, { x: 100, y: 100 }]) {
    assert.equal(transformed.contains(point, []), ordinary.contains(point, []))
  }
  assert.equal(ordinary.contains({ x: 70, y: 90 }, []), false)
})

test('native outer-border cells and record rectangles remain part of admission', () => {
  for (const x of [-25, 850]) {
    const query = new NativeCompactGroundSurface(scene(25, x, 100))
    assert.equal(query.contains({ x, y: 100 }, []), true)
    assert.equal(query.contains({ x: x + 256, y: 100 }, []), false)
  }
})

test('record positions are stored as native float32 before strict contour membership', () => {
  const query = new NativeCompactGroundSurface(scene(25, 100.000003, 100))
  assert.equal(query.contains({ x: 141, y: 94 }, []), false)
  assert.equal(query.contains({ x: 140.99, y: 94 }, []), true)
})

test('the current Spider cohort is admitted and removed in the same presentation frame', () => {
  const query = new NativeCompactGroundSurface({ ...scene(0), sprites: [] })
  const state = createNativeDeadSpider({ x: 100, y: 100 }, 0)
  const remains: BoneyardSpiderRemainsSnapshot[] = [{ id: 1, spawnTick: 0, state: { ...state,
    decal: { entry: 140, position: state.position, rotationDeg: 91, scale: 0.1, alpha: 0.2 },
  } }]
  assert.equal(query.contains(state.position, []), false)
  assert.equal(query.contains(state.position, remains), true)
  assert.equal(query.contains(state.position, []), false)
})

test('native Terrain inner strips take precedence over compact and Spider overlays', () => {
  const source = scene(25, 200, 200)
  const terrain = [{ eid: 'river', pos: { x: 0, y: 0 }, style: 0, uid: 42001,
    points: [{ x: 100, y: 200 }, { x: 300, y: 200 }] }]
  const wet = new NativeCompactGroundSurface({ ...source, sprites: [], terrain })
  assert.equal(wet.contains({ x: 150, y: 200 }, []), true)
  assert.equal(wet.contains({ x: 150, y: 246 }, []), false)
  const crossing = { eid: 'road', typeId: 3007, linkMask: 0 as const, points: [{ x: 200, y: 100 }, { x: 200, y: 300 }] }
  const bridged = new NativeCompactGroundSurface({ ...source, terrain, roads: [crossing] })
  assert.equal(bridged.contains({ x: 200, y: 200 }, []), false)
  assert.equal(bridged.contains({ x: 150, y: 200 }, []), true)
  const state = createNativeDeadSpider({ x: 200, y: 200 }, 0)
  const remains: BoneyardSpiderRemainsSnapshot[] = [{ id: 1, spawnTick: 0, state: { ...state,
    decal: { entry: 140, position: state.position, rotationDeg: 0, scale: 1, alpha: 1 },
  } }]
  assert.equal(bridged.contains({ x: 200, y: 200 }, remains), false)
  const excluded = new NativeCompactGroundSurface({ ...source, terrain: terrain.map((t) => ({ ...t, style: 1 })), roads: [crossing] })
  assert.equal(excluded.contains({ x: 200, y: 200 }, []), true)
})
