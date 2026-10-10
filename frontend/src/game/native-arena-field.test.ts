import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_GENERATED_BONEYARDS } from './host/native-generated-boneyards.ts'
import { STOCK_TUTORIAL_BONEYARD } from './host/stock-tutorial-boneyard.ts'
import {
  createNativeArenaFieldLattice,
  nativeArenaFieldDescriptor,
  nativeArenaFieldMeshPlan,
  nativeArenaFieldRecord,
  nativeArenaFieldTileCorners,
  nativeArenaFieldVisibleRange,
  type NativeArenaFieldBounds,
} from './native-arena-field.ts'

// Independent Python struct-f32 fixtures prepared before implementation.
// Provenance: native-field-independent-golden-v1, sh9aksle 2026-10-10.
// Source contract SHA256 c2fad7022814f9eca1c6f97ffed0e873952c188840ac18e0681613fb8e2c3a60.
// These prove instruction-derived geometry, not downstream rendered parity.
import GOLDEN from './native-arena-field.golden.json' with { type: 'json' }

function plan(bounds: NativeArenaFieldBounds, view: NativeArenaFieldBounds, mode = 0) {
  const lattice = createNativeArenaFieldLattice(bounds)
  const range = nativeArenaFieldVisibleRange(lattice, view)
  return { lattice, range, mesh: nativeArenaFieldMeshPlan(lattice, range, mode) }
}

function origins(positions: Float32Array): number[][] {
  const output: number[][] = []
  for (let i = 0; i < positions.length; i += 8) output.push([positions[i]!, positions[i + 1]!])
  return output
}

function floatHex(values: readonly number[] | Float32Array): string {
  const bytes = Buffer.alloc(values.length * 4)
  values.forEach((value, i) => bytes.writeFloatLE(value, i * 4))
  return bytes.toString('hex')
}

test('native field selects the correct recovered record for every raw mode byte', () => {
  for (let mode = 0; mode < 256; mode += 1) {
    const expected = mode === 1 || mode === 2 ? 11 : 12
    assert.equal(nativeArenaFieldRecord(mode), expected)
    assert.equal(nativeArenaFieldDescriptor(mode).entry, expected)
  }
  for (const mode of [-1, 256, 1.5, NaN, Infinity]) {
    assert.throws(() => nativeArenaFieldRecord(mode), RangeError)
  }
})

test('native field uses the existing untrimmed DeadHawg catalog and full2048 page', () => {
  for (const [mode, entry, x, y] of [[0, 12, 1399, 1069], [1, 11, 778, 859]]) {
    const descriptor = nativeArenaFieldDescriptor(mode!)
    assert.equal(descriptor.atlas, 'DeadHawg')
    assert.equal(descriptor.entry, entry)
    assert.deepEqual(descriptor.frame, { x, y, width: 350, height: 350 })
    assert.deepEqual(descriptor.page, { width: 2048, height: 2048 })
    assert.equal(descriptor.width, 350)
    assert.equal(descriptor.height, 350)
    assert.equal(descriptor, nativeArenaFieldDescriptor(mode!))
  }
})

test('both field UV records are byte-exact in native mesh TL TR BL BR order', () => {
  for (const row of GOLDEN.uv) {
    const mode = row.record === 11 ? 1 : 0
    const descriptor = nativeArenaFieldDescriptor(mode)
    assert.deepEqual(descriptor.uvs, row.pairs.flat())
    assert.equal(floatHex(descriptor.uvs), row.f32_le_hex)
    const result = plan({ x: 0, y: 0, w: 350, h: 350 }, { x: 0, y: 0, w: 350, h: 350 }, mode)
    assert.equal(floatHex(result.mesh.uvs), row.f32_le_hex)
    assert.deepEqual([...result.mesh.indices], [0, 1, 2, 1, 3, 2])
    assert.ok([...result.mesh.colors].every(value => value === 255))
    // Pixi's helper indexes BR before BL. This distinguishes a missing remap.
    const [tl, tr, bl, br] = row.pairs
    assert.notDeepEqual([...result.mesh.uvs], [tl, tr, br, bl].flat())
  }
})

test('absolute field UVs are never the cropped-frame remapped UVs', () => {
  for (const mode of [0, 1]) {
    const { frame, page, uvs } = nativeArenaFieldDescriptor(mode)
    const mapped = [frame.x / page.width + uvs[0]! * frame.width / page.width,
      frame.y / page.height + uvs[1]! * frame.height / page.height]
    assert.notDeepEqual(mapped, uvs.slice(0, 2))
  }
})

test('field axes and selected origin order match all independent geometry fixtures', () => {
  for (const row of GOLDEN.geometry) {
    const result = plan(row.bounds, row.view)
    assert.deepEqual([...result.lattice.x], row.x_axis, row.name)
    assert.deepEqual([...result.lattice.y], row.y_axis, row.name)
    const selectedOrigins = [...result.lattice.x.slice(result.range.xStart, result.range.xEnd)]
      .flatMap(x => [...result.lattice.y.slice(result.range.yStart, result.range.yEnd)].map(y => [x, y]))
    assert.deepEqual(selectedOrigins, row.visible_origins, row.name)
    const expectedDrawnOrigins = row.name === 'fractional-tiny-world'
      ? [[-0.100006103515625, 0.100006103515625]] : row.visible_origins
    assert.deepEqual(origins(result.mesh.positions), expectedDrawnOrigins, row.name)
    assert.equal(result.range.tileCount, row.visible_origins.length)
  }
})

test('field draw preserves the source registration-center store without moving the cull lattice', () => {
  assert.deepEqual(nativeArenaFieldTileCorners(Math.fround(-0.1), Math.fround(0.1)), {
    left: -0.100006103515625, top: 0.100006103515625,
    right: 349.8999938964844, bottom: 350.1000061035156,
  })
  assert.deepEqual(nativeArenaFieldTileCorners(131071.8984375, 130800.0078125), {
    left: 131071.90625, top: 130800.0078125,
    right: 131421.90625, bottom: 131150,
  })
  const lattice = createNativeArenaFieldLattice({ x: Math.fround(-0.1), y: Math.fround(0.1), w: 0.125, h: 0.125 })
  assert.equal(lattice.x[0], Math.fround(-0.1))
  assert.equal(lattice.y[0], Math.fround(0.1))
})

test('strict native field culls exact touches and correctly includes adjacent-f32 overlap', () => {
  for (const row of GOLDEN.culls) {
    const result = plan({ x: row.tile[0]!, y: row.tile[1]!, w: 350, h: 350 }, row.view)
    assert.equal(result.range.tileCount > 0, row.visible, row.name)
  }
})

test('tile far-edge cull does not introduce a nonexistent f32 store', () => {
  const row = GOLDEN.extended_cull
  assert.ok(row.tile[0]! + 350 > row.view.x)
  assert.equal(Math.fround(row.tile[0]! + 350), row.view.x)
  assert.equal(plan({ x: row.tile[0]!, y: row.tile[1]!, w: 350, h: 350 }, row.view).range.tileCount, 1)
})

test('iterative field recurrence matches independent f32 counterexamples to multiplication', () => {
  for (const row of GOLDEN.recurrence) {
    const lattice = createNativeArenaFieldLattice({ x: row.origin, y: row.origin, w: 131072, h: 131072 })
    assert.equal(lattice.x[row.index], row.iterative)
    assert.equal(lattice.y[row.index], row.iterative)
    assert.equal(Math.fround(Math.fround(row.origin) + row.index * 350), row.direct)
    assert.notEqual(lattice.x[row.index], row.direct)
  }
})

test('final native field tiles remain full-sized beyond authored world edges', () => {
  const result = plan({ x: -20.25, y: 7.5, w: 351, h: 351 }, { x: 500, y: 500, w: 1, h: 1 })
  assert.equal(result.mesh.tileCount, 1)
  assert.deepEqual([...result.mesh.positions], [329.75, 357.5, 679.75, 357.5, 329.75, 707.5, 679.75, 707.5])
})

test('131072-wide editor case caches small axes and builds only its visible mesh', () => {
  const row = GOLDEN.large_editor
  const result = plan(row.bounds, row.view)
  assert.equal(result.lattice.x.length, row.x_count)
  assert.equal(result.lattice.y.length, row.y_count)
  assert.equal(result.lattice.x.length + result.lattice.y.length, row.axis_storage_count)
  assert.equal(result.mesh.tileCount, row.visible_count)
  assert.deepEqual(origins(result.mesh.positions), row.visible_origins)
  assert.equal(result.mesh.positions.byteLength + result.mesh.uvs.byteLength
    + result.mesh.colors.byteLength + result.mesh.indices.byteLength, row.visible_mesh_bytes)
  assert.equal(result.lattice.x.length * result.lattice.y.length, row.full_world_tile_count)
})

test('all 13 actual stock rows match golden bounds, modes, records and lattice dimensions', () => {
  const actualRows = [
    ...NATIVE_GENERATED_BONEYARDS.map(({ scene }, row) => ({
      source: 'native-generated-boneyards.ts', row, scene,
    })),
    { source: 'stock-tutorial-boneyard.ts', row: 0, scene: STOCK_TUTORIAL_BONEYARD.scene },
  ]
  assert.equal(actualRows.length, 13)
  assert.deepEqual(actualRows.map(({ source, row }) => ({ source, row })),
    GOLDEN.scene_rows.map(({ source, row }) => ({ source, row })))
  for (const [index, { source, row, scene }] of actualRows.entries()) {
    const expected = GOLDEN.scene_rows[index]!
    const label = `${source} row ${row}`
    assert.deepEqual(scene.bounds, expected.bounds, label)
    assert.equal(scene.environmentMode, expected.mode, label)
    const lattice = createNativeArenaFieldLattice(scene.bounds)
    assert.equal(nativeArenaFieldRecord(scene.environmentMode), expected.selected_native_record, label)
    assert.equal(lattice.x.length, expected.x_count, label)
    assert.equal(lattice.y.length, expected.y_count, label)
  }
})

test('stable visible ranges reuse retained axes and do not shift with camera movement', () => {
  const lattice = createNativeArenaFieldLattice({ x: 1.001, y: -0.125, w: 131072, h: 131072 })
  const x = lattice.x, y = lattice.y
  const first = nativeArenaFieldVisibleRange(lattice, { x: 16000, y: 10000, w: 800, h: 600 })
  for (let i = 0; i < 120; i += 1) {
    assert.deepEqual(nativeArenaFieldVisibleRange(lattice, { x: 16001, y: 10001, w: 800, h: 600 }), first)
    assert.equal(lattice.x, x)
    assert.equal(lattice.y, y)
  }
  assert.notDeepEqual(nativeArenaFieldVisibleRange(lattice, { x: 16351, y: 10001, w: 800, h: 600 }), first)
})

test('empty visible range yields an empty retained mesh and no stray triangles', () => {
  const result = plan({ x: 0, y: 0, w: 350, h: 350 }, { x: 1000, y: 1000, w: 1, h: 1 })
  assert.equal(result.mesh.tileCount, 0)
  for (const buffer of [result.mesh.positions, result.mesh.uvs, result.mesh.indices, result.mesh.colors]) {
    assert.equal(buffer.length, 0)
  }
})

test('finite domain and non-progress resource guards fail boundedly without changing ordinary coordinates', () => {
  for (const [x, w] of [[0, 0], [0, -1], [NaN, 1], [Infinity, 1], [0, Infinity], [2 ** 33, 131072], [1e39, 131072]]) {
    assert.throws(() => createNativeArenaFieldLattice({ x: x!, y: 0, w: w!, h: 350 }), RangeError)
  }
  assert.equal(createNativeArenaFieldLattice({ x: 2 ** 33, y: 0, w: 1, h: 350 }).x.length, 0)
  const lattice = createNativeArenaFieldLattice({ x: 0, y: 0, w: 350, h: 350 })
  for (const view of [{ x: NaN, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: -1, h: 1 }]) {
    assert.throws(() => nativeArenaFieldVisibleRange(lattice, view), RangeError)
  }
  assert.throws(() => nativeArenaFieldMeshPlan(lattice, { xStart: 0, xEnd: 2, yStart: 0, yEnd: 1, tileCount: 2 }, 0), RangeError)
})
