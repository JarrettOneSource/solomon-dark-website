import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { before, mock } from 'node:test'
import { Container, DOMAdapter, Graphics, MeshSimple, Sprite, Texture } from 'pixi.js'
import { NATIVE, type PlacedObject, type Polyline } from '../../editor/model.ts'
import { nativeFenceGrate } from '../../editor/native-fence-geometry.ts'
import { buildNativeRenderPlan } from '../../editor/native-render-plan.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import { NativeBoneyardLightIndex } from './boneyard-lighting.ts'
import { BoneyardScrubShadowPresentation } from './boneyard-scrub-shadow-presentation.ts'
import { destroyResidentTexture } from './boneyard-resident-lifetime.ts'
import { nativeBuildingLightGrid, nativeBuildingMeshGrid } from './boneyard-static-surface-lighting.ts'
import { usesNativeDiffuseColor } from './native-texture-color.ts'
import {
  STATIC_ART_MANIFEST, assertArrayNear, assertNear, expectedRecordUvs, mappedTextureUvs,
  staticArtConsumerResident, staticArtDocument, staticArtExpectedRecord,
  staticArtPackedRecords, staticArtPage, staticArtTexture,
  withStaticWorldFixture,
} from './static-native-art-test-fixtures.ts'

const nativeArt = () => import('./boneyard-native-static-art.ts')
let surfaceModule: typeof import('./boneyard-building-surface-view.ts')
let hitModule: typeof import('./native-scenery-hit-view.ts')
before(async () => {
  // Shader precision discovery is browser-only. These tests inspect retained
  // geometry, UV matrices and ownership and never create a renderer or draw.
  const canvas = mock.method(DOMAdapter.get(), 'createCanvas', () => ({ getContext: () => null }))
  try {
    surfaceModule = await import('./boneyard-building-surface-view.ts')
    hitModule = await import('./native-scenery-hit-view.ts')
  } finally { canvas.mock.restore() }
})
const position = { x: 933.454345703125, y: 1616.375 }
const range = (start: number, count: number) => Array.from({ length: count }, (_, index) => start + index)

test('every admitted DeadHawg record preserves its complete native page rectangle and registration', async () => {
  const { nativeStaticArtRecord } = await nativeArt()
  const packed = staticArtPackedRecords()
  assert.equal(STATIC_ART_MANIFEST.entries.length, 348)
  assert.equal(packed.size, 335)
  assert.deepEqual(STATIC_ART_MANIFEST.entries.filter(row => row.empty).map(row => row.id), range(251, 13))
  for (const row of STATIC_ART_MANIFEST.entries) {
    assert.deepEqual(nativeStaticArtRecord(row.id), staticArtExpectedRecord(row.id), `record ${row.id}`)
    if (row.empty) assert.equal(packed.has(row.id), false, `empty record ${row.id} is not uploaded`)
    else assert.deepEqual(packed.get(row.id), [
      2, row.rect.x, row.rect.y, row.rect.w, row.rect.h, row.rect.w, row.rect.h, 0, 0,
    ], `record ${row.id} must not route crop coordinates through a full-page UV map`)
  }
  for (const entry of [-1, 348, 1_000, NaN, 1.5]) assert.equal(nativeStaticArtRecord(entry), null)
})

test('named main families and all generic record selector paths retain admission and precedence', async () => {
  const { nativeStaticMainArtEntry } = await nativeArt()
  for (const [typeId, first, count] of [
    [NATIVE.monument, 156, 21], [NATIVE.gravestone, 97, 17],
    [NATIVE.tree, 264, 19], [NATIVE.building, 148, 4], [NATIVE.goodie, 145, 3],
  ]) {
    for (let variant = 0; variant < count!; variant += 1) {
      const object = { eid: `family-${typeId}-${variant}`, typeId: typeId!, variant, pos: position }
      const layer = buildNativeRenderPlan(staticArtDocument([object])).shadows[0]!
      assert.equal(nativeStaticMainArtEntry(layer), first! + variant, object.eid)
    }
  }
  for (let entry = 0; entry < 348; entry += 1) {
    for (const selector of [
      { atlasEntry: entry, atlasEntries: [36], sprite: { atlas: 'DeadHawg', entry: 97 } },
      { atlasEntries: [entry], sprite: { atlas: 'DeadHawg', entry: 97 } },
      { sprite: { atlas: 'DeadHawg', entry } },
    ]) {
      const object = { eid: `generic-${entry}`, typeId: 9_999, pos: position, ...selector } as PlacedObject
      const plan = buildNativeRenderPlan(staticArtDocument([object]))
      assert.equal(plan.shadows.length, 1)
      assert.equal(nativeStaticMainArtEntry(plan.shadows[0]!), entry, JSON.stringify(selector))
    }
  }
  assert.equal(buildNativeRenderPlan(staticArtDocument([{ eid: 'unsupported', typeId: 9_999, pos: position }])).shadows.length, 0)
  // Scrub has a legacy glyph selector independent of generic object overrides.
  for (let variant = 0; variant < 19; variant += 1) {
    const object = { eid: `scrub-${variant}`, typeId: 2062, variant, pos: position, atlasEntry: 36 }
    const layer = buildNativeRenderPlan(staticArtDocument([object])).shadows[0]!
    assert.equal(nativeStaticMainArtEntry(layer), 264 + variant)
  }
})

test('every stone and wood post variant preserves shared endpoint selection and all fence body codes', async () => {
  const { nativeStaticMainArtEntry } = await nativeArt()
  for (const [segmentCode, first, count] of [[0, 36, 7], [4, 320, 28]]) {
    for (let variant = 0; variant < count!; variant += 1) {
      const fence: Polyline = {
        eid: `post-${segmentCode}-${variant}`, typeId: NATIVE.fence, segmentCode,
        startPostVariant: variant, endPostVariant: variant,
        points: [position, { x: position.x + 73.25, y: position.y + 11.125 }],
      }
      const plan = buildNativeRenderPlan(staticArtDocument([], [], [fence]))
      const posts = plan.shadows.filter(layer => layer.kind === 'fence' && layer.part === 'post')
      assert.equal(posts.length, 2)
      for (const post of posts) assert.equal(nativeStaticMainArtEntry(post), first! + variant, fence.eid)
    }
  }
  const fences = range(0, 5).map((segmentCode): Polyline => ({
    eid: `fence-${segmentCode}`, typeId: NATIVE.fence, segmentCode,
    points: [{ x: 10 + segmentCode * 400, y: 30.125 }, { x: 249.75 + segmentCode * 400, y: 55.375 }],
  }))
  const bodies = buildNativeRenderPlan(staticArtDocument([], [], fences)).shadows
    .filter(layer => layer.kind === 'fence' && layer.part === 'body')
  assert.deepEqual(fences.map(fence => bodies.filter(layer => layer.sel.eid === fence.eid).length), [1, 2, 2, 1, 1])
  for (const body of bodies) assert.equal(nativeStaticMainArtEntry(body), null, `body ${body.sel.eid} is not a single record`)
  const shared = buildNativeRenderPlan(staticArtDocument([], [], [
    { ...fences[0]!, points: [position, { x: 20, y: 30 }], startPostVariant: 1 },
    { ...fences[4]!, points: [position, { x: 40, y: 50 }], startPostVariant: 27 },
  ])).shadows.filter(layer => layer.kind === 'fence' && layer.part === 'post')
  assert.equal(shared.length, 3)
  assert.equal(nativeStaticMainArtEntry(shared.find(layer => layer.pos === position)!), 347)
})

test('Tree proxy and Gravestone underlay census keeps independent source selection and painter bands', () => {
  for (let variant = 0; variant < 19; variant += 1) {
    for (let secondaryVariant = 0; secondaryVariant < 21; secondaryVariant += 1) {
      const object = { eid: 'tree', typeId: NATIVE.tree, pos: position, variant, secondaryVariant }
      const plan = buildNativeRenderPlan(staticArtDocument([object]))
      assert.equal(plan.shadows.length, 1, 'runtime main list must exclude proxies')
      assert.equal(plan.proxies.length, variant < 6 && secondaryVariant < 8 ? 1 : 0, `${variant}/${secondaryVariant}`)
      if (plan.proxies.length) {
        assert.equal(plan.proxies[0]!.atlasEntry, 243 + secondaryVariant)
        assert.equal(plan.proxies[0]!.worldY, position.y + 100)
      }
    }
  }
  for (const secondaryAtlasEntry of [243, 250, 251, 263, 36]) {
    const object = { eid: 'override', typeId: NATIVE.tree, pos: position, variant: 0, secondaryAtlasEntry, secondaryVariant: 3 }
    const plan = buildNativeRenderPlan(staticArtDocument([object]))
    assert.deepEqual(plan.proxies.map(layer => layer.atlasEntry), STATIC_ART_MANIFEST.entries[secondaryAtlasEntry]!.empty ? [] : [secondaryAtlasEntry])
    const hidden = { ...object, secondaryVisible: false }
    assert.equal(buildNativeRenderPlan(staticArtDocument([hidden])).proxies.length, 0)
  }
  for (let overlayVariant = 0; overlayVariant < 9; overlayVariant += 1) {
    const object = { eid: 'grave', typeId: NATIVE.gravestone, pos: position, variant: 16, overlayVariant }
    const plan = buildNativeRenderPlan(staticArtDocument([object]))
    assert.deepEqual(plan.underlays.map(layer => layer.atlasEntry), [88 + overlayVariant])
    assert.equal(plan.shadows.length, 1)
    const overridden = { ...object, overlayAtlasEntry: 36 }
    assert.deepEqual(buildNativeRenderPlan(staticArtDocument([overridden])).underlays.map(layer => layer.atlasEntry), [36])
  }
  for (const atlasEntries of [[148, 152], [149, 153], [150, 154], [151, 155], [36, 97]]) {
    const object = { eid: 'building', typeId: NATIVE.building, pos: position, variant: 0, atlasEntries }
    const plan = buildNativeRenderPlan(staticArtDocument([object]))
    assert.equal(plan.proxies[0]!.worldY, position.y + 200)
    assert.deepEqual([plan.shadows[0]!.kind === 'object' ? plan.shadows[0]!.atlasEntry : null, plan.proxies[0]!.atlasEntry], atlasEntries)
  }
  for (let entry = 0; entry < 348; entry += 1) {
    const sprite = { eid: `compact-${entry}`, pos: position, atlasEntry: entry - 114, s0: 31.25, s1: 0.83, s2: 0.67, flags: 1 }
    assert.equal(buildNativeRenderPlan(staticArtDocument([], [sprite])).compact[0]!.atlasEntry, entry)
    const overridden = { ...sprite, atlasEntry: 0, deadHawgEntry: entry }
    assert.equal(buildNativeRenderPlan(staticArtDocument([], [overridden])).compact[0]!.atlasEntry, entry)
  }
})

test('direct record residents preserve fractional translation and camera scale without raster pixels', async () => {
  const { createNativeStaticArtResident, nativeStaticArtRecord } = await nativeArt()
  const page = staticArtPage()
  try {
    for (const entry of [36, 42, 88, 96, 97, 113, 156, 176, 243, 250, 264, 282, 320, 347, 0, 228]) {
      const record = nativeStaticArtRecord(entry)!
      const texture = staticArtTexture(entry, page)
      const resident = createNativeStaticArtResident(record, texture, position, { mainLayerIndex: 17, cleanupSourceKey: `object:${entry}` })
      const root = new Container()
      root.position.set(800 - 1025 * 1.35, 450 - 1719.6666666666667 * 1.35)
      root.scale.set(1.35)
      root.addChild(resident.sprite)
      try {
        assert.ok(resident.sprite instanceof Sprite)
        assert.equal(resident.texture, texture)
        assert.equal(resident.texture.source, page)
        assert.equal(resident.ownsTexture, false)
        assert.equal(resident.pixels.byteLength, 0, `record ${entry} must never pre-rasterize`)
        assert.equal(resident.mainLayerIndex, 17)
        assert.equal(resident.cleanupSourceKey, `object:${entry}`)
        const bounds = resident.sprite.getBounds().rectangle
        assertNear(bounds.x, root.x + (position.x - record.anchorX) * 1.35, `record ${entry} x`)
        assertNear(bounds.y, root.y + (position.y - record.anchorY) * 1.35, `record ${entry} y`)
        assertNear(bounds.width, record.w * 1.35)
        assertNear(bounds.height, record.h * 1.35)
        assert.equal(page.style.scaleMode, 'linear')
        assert.equal(page.alphaMode, 'no-premultiply-alpha')
        destroyResidentTexture(resident)
        assert.equal(texture.destroyed, false)
        assert.equal(page.destroyed, false)
      } finally { root.destroy({ children: true }); texture.destroy(false) }
    }
  } finally { page.destroy() }
})

test('compact rotation, horizontal squash and alpha stay at the authored fractional root', async () => {
  const { createNativeStaticArtResident, nativeStaticArtRecord } = await nativeArt()
  const page = staticArtPage()
  const texture = staticArtTexture(114, page)
  const record = nativeStaticArtRecord(114)!
  const scaleX = 0.83 * 0.8, scaleY = 0.83, rotationDegrees = 31.25
  const resident = createNativeStaticArtResident(record, texture, position, { rotationDegrees, scaleX, scaleY, alpha: 0.67, cleanupSourceKey: 'sprite:compact' })
  try {
    const angle = rotationDegrees * Math.PI / 180
    const corners = [[0, 0], [record.w, 0], [0, record.h], [record.w, record.h]].map(([x, y]) => {
      const lx = (x! - record.anchorX) * scaleX, ly = (y! - record.anchorY) * scaleY
      return { x: position.x + lx * Math.cos(angle) - ly * Math.sin(angle), y: position.y + lx * Math.sin(angle) + ly * Math.cos(angle) }
    })
    const bounds = resident.sprite.getBounds().rectangle
    assertNear(bounds.x, Math.min(...corners.map(point => point.x)))
    assertNear(bounds.y, Math.min(...corners.map(point => point.y)))
    assertNear(bounds.width, Math.max(...corners.map(point => point.x)) - bounds.x)
    assertNear(bounds.height, Math.max(...corners.map(point => point.y)) - bounds.y)
    assertNear(resident.sprite.alpha, 0.67)
    assert.equal(resident.mainLayerIndex, null)
    assert.equal(resident.cleanupSourceKey, 'sprite:compact')
    assert.ok(resident.x <= bounds.x + 1e-5 && resident.y <= bounds.y + 1e-5)
    assert.ok(resident.x + resident.w >= bounds.x + bounds.width - 1e-5)
    assert.ok(resident.y + resident.h >= bounds.y + bounds.height - 1e-5)
  } finally { destroyResidentTexture(resident); resident.sprite.destroy(); texture.destroy(false); page.destroy() }
})

test('native record TextureMatrix composes normalized mesh UVs exactly once and replays source updates', () => {
  const page = staticArtPage()
  const normalized = [0, 0, 1, 0, 0, 1, 1, 1, 0.375, 0.8]
  try {
    for (const row of STATIC_ART_MANIFEST.entries.filter(row => !row.empty)) {
      const texture = staticArtTexture(row.id, page)
      const expected = expectedRecordUvs(row.id, normalized)
      const matrix = texture.textureMatrix.mapCoord
      assertArrayNear(mappedTextureUvs(texture, normalized), expected, `record ${row.id} first mapping`)
      texture.update()
      page.update()
      assert.equal(texture.textureMatrix.mapCoord, matrix, 'shader retains live matrix identity')
      assertArrayNear(mappedTextureUvs(texture, normalized), expected, `record ${row.id} replay`)
      texture.destroy(false)
      assert.equal(page.destroyed, false)
    }
  } finally { page.destroy() }
})

test('all Building bases and roofs retain native vertex grids, page UVs and borrowed hit redraw geometry', async () => {
  const { createNativeStaticArtResident, nativeStaticArtRecord } = await nativeArt()
  const page = staticArtPage()
  try {
    for (let variant = 0; variant < 4; variant += 1) {
      for (const enhancedEffects of [false, true]) {
        const members = [148 + variant, 152 + variant].map(entry => {
          const record = nativeStaticArtRecord(entry)!
          const texture = staticArtTexture(entry, page)
          const resident = createNativeStaticArtResident(record, texture, position, { enhancedEffects })
          assert.ok(resident.surfaceMesh)
          const grid = nativeBuildingMeshGrid(record.w, record.h, enhancedEffects)
          assert.deepEqual(resident.surfaceMesh.mesh.geometry.getBuffer('aPosition').data, grid.positions)
          assert.deepEqual(resident.surfaceMesh.mesh.geometry.getBuffer('aUV').data, grid.uvs)
          assertArrayNear(mappedTextureUvs(texture, grid.uvs), expectedRecordUvs(entry, grid.uvs), `Building ${entry} UVs`)
          assert.ok(resident.surfaceMesh.mesh.shader)
          const uniforms = resident.surfaceMesh.mesh.shader.resources.textureUniforms.uniforms
          assert.equal(uniforms.uTextureMatrix, texture.textureMatrix.mapCoord)
          return { resident, texture, record }
        })
        try {
          const scalars = Float32Array.from({ length: enhancedEffects ? 9 : 4 }, (_, index) => index / (enhancedEffects ? 8 : 3))
          for (const { resident, record } of members) {
            resident.surfaceMesh!.update(scalars)
            const copy = surfaceModule.createNativeSurfaceRedraw(resident.surfaceMesh!, true)
            const geometry = resident.surfaceMesh!.mesh.geometry
            assert.equal(copy.mesh.geometry, geometry)
            assert.equal(copy.mesh.texture, resident.texture)
            copy.destroy()
            assert.ok(geometry.buffers.every(buffer => !buffer.destroyed))
            const bounds = resident.sprite.getBounds().rectangle
            assertNear(bounds.x, position.x - record.anchorX)
            assertNear(bounds.y, position.y - record.anchorY)
          }
          assert.deepEqual(members[0]!.resident.surfaceMesh!.colors, members[1]!.resident.surfaceMesh!.colors)
          const record = members[0]!.record
          const samples = nativeBuildingLightGrid({ enhancedEffects, position, sprite: record, variant })
          assert.equal(samples.length, scalars.length)
          assertNear(samples[0]!.x, position.x - record.anchorX)
          assertNear(samples[0]!.y, position.y - record.anchorY + [135, 100, 0, 0][variant]!)
          assertNear(samples.at(-1)!.y, position.y - record.anchorY + record.h)
        } finally {
          for (const { resident, texture } of members) {
            const buffers = [...resident.surfaceMesh!.mesh.geometry.buffers]
            destroyResidentTexture(resident)
            assert.ok(buffers.every(buffer => buffer.destroyed))
            assert.equal(texture.destroyed, false)
            texture.destroy(false)
          }
        }
      }
    }
  } finally { page.destroy() }
})

test('Scrub full-page glyph and reflection meshes preserve native UV slices through pooled role changes', () => {
  const page = staticArtPage()
  const reflection = staticArtTexture(21, page)
  const sources = [{ position: { x: position.x - 50, y: position.y }, radius: 1, intensity: 1, castsDirectionalShadow: true }]
  try {
    for (let variant = 0; variant < 19; variant += 1) {
      const entry = 264 + variant, texture = staticArtTexture(entry, page)
      const resident = staticArtConsumerResident(entry, texture, position)
      const root = new Container()
      root.addChild(resident.sprite)
      resident.sprite.zIndex = 7
      const object = { eid: `scrub-${variant}`, typeId: 2062, pos: position, variant, atlasEntry: entry }
      const layers = buildNativeRenderPlan(staticArtDocument([object])).shadows
      const view = new BoneyardScrubShadowPresentation(root, layers, new Map([[0, resident]]), 0, reflection)
      try {
        const frame = view.render(sources, 0, 0, [resident], true, true, () => true)
        assert.equal(frame.quadCount, 2)
        assert.equal(frame.zOrderMismatchCount, 0)
        const container = root.children[0]!
        const reflected = container.children[0] as MeshSimple, shadow = container.children[1] as MeshSimple
        assert.equal(reflected.texture, reflection)
        assert.equal(shadow.texture, texture)
        const full = [0, 0, 1, 0, 0, 1, 1, 1]
        const sliced = [0, 0, 1, 0, 0, Math.fround(1 - Math.fround(0.2)), 1, Math.fround(1 - Math.fround(0.2))]
        const reflectedUvs = reflected.geometry.getBuffer('aUV').data
        const shadowUvs = shadow.geometry.getBuffer('aUV').data
        assertArrayNear(reflectedUvs, full, 'reflection normalized coordinates')
        assertArrayNear(shadowUvs, sliced, 'directional slice remains in record space')
        assertArrayNear(mappedTextureUvs(reflected.texture, reflectedUvs), expectedRecordUvs(21, full), 'reflection source map')
        assertArrayNear(mappedTextureUvs(shadow.texture, shadowUvs), expectedRecordUvs(entry, sliced), 'shadow source map')
        texture.update(); reflection.update(); page.update()
        view.render(sources, 1, 1, [resident], false, false, () => false)
        assert.equal(container.children[0], reflected)
        assert.equal(reflected.texture, texture)
        assertArrayNear(mappedTextureUvs(reflected.texture, reflected.geometry.getBuffer('aUV').data), expectedRecordUvs(entry, full), 'pooled flat glyph source')
        assert.equal(shadow.renderable, false)
        assert.equal(view.render(sources, 2, 2, [], true, true, () => false).quadCount, 0)
      } finally { view.destroy(); root.destroy({ children: true }); texture.destroy(false) }
      assert.equal(page.destroyed, false)
    }
  } finally { reflection.destroy(false); page.destroy() }
})

test('direct Sprite hit redraws borrow source pixels and retain diffuse material without atlas ownership', async () => {
  const { createNativeStaticArtResident, nativeStaticArtRecord } = await nativeArt()
  const page = staticArtPage(), texture = staticArtTexture(156, page)
  const object = { eid: 'monument', typeId: NATIVE.monument, variant: 0, pos: position }
  const layers = buildNativeRenderPlan(staticArtDocument([object])).shadows
  const resident = createNativeStaticArtResident(nativeStaticArtRecord(156)!, texture, position, { mainLayerIndex: 0 })
  const view = new hitModule.NativeSceneryHitView(layers, new Map([[0, resident]]), new Map(), new Map())
  try {
    view.update([{ kind: 'scenery', targetId: 'scenery:monument', hitTick: 10, feedback: { tick: 10, timer: 1, strength: 1 } }], 10, true)
    const redraw = resident.sprite.children[0]
    assert.ok(redraw instanceof Sprite)
    assert.equal(redraw.texture, texture)
    assert.equal(usesNativeDiffuseColor(redraw), true)
    assert.deepEqual([redraw.anchor.x, redraw.anchor.y], [(resident.sprite as Sprite).anchor.x, (resident.sprite as Sprite).anchor.y])
    view.update([], 11, true)
    assert.equal(redraw.destroyed, true)
    assert.equal(texture.destroyed, false)
    assert.equal(page.destroyed, false)
  } finally { view.destroy(); destroyResidentTexture(resident); resident.sprite.destroy({ children: true }); texture.destroy(false); page.destroy() }
})

test('direct negative controls keep their independent terrain, gate and dynamic Goodie owners', () => {
  const world = readFileSync(new URL('./boneyard-static-world.ts', import.meta.url), 'utf8')
  const gate = readFileSync(new URL('./boneyard-gate-views.ts', import.meta.url), 'utf8')
  const scene = readFileSync(new URL('./boneyard-dynamic-scene.ts', import.meta.url), 'utf8')
  assert.match(world, /new NativeBoneyardSurfaceView\(/)
  assert.match(world, /if \(isMovingGateBody\(layer\)\) continue/)
  assert.match(world, /layer\.object\.typeId === NATIVE\.goodie\)[\s\S]{0,100}resident\.sprite\.alpha = 0/)
  assert.match(gate, /createNativeStaticQuad|nativeGateArtVertices/)
  assert.match(scene, /NativeGoodieViews/)
})

test('integrated static world keeps exact fractional sources, ordered fallbacks and atomic per-source retirement', async () => {
  const outside = { x: 4_000.125, y: 4_000.375 }
  const objects = [
    { eid: 'monument', typeId: NATIVE.monument, variant: 0, pos: position },
    { eid: 'outside-grave', typeId: NATIVE.gravestone, variant: 0, pos: outside },
    { eid: 'tree', typeId: NATIVE.tree, variant: 0, pos: { x: 950.25, y: 1600.5 } },
    { eid: 'goodie', typeId: NATIVE.goodie, variant: 0, pos: { x: 975.25, y: 1600.5 } },
    ...range(0, 4).map(variant => ({ eid: `building-${variant}`, typeId: NATIVE.building, variant, pos: { x: 850.25 + variant * 40, y: 1700.5 } })),
  ]
  const compact = (eid: string, atlasEntry: number, pos = position) => ({ eid, atlasEntry, pos, s0: 21.25, s1: 0.83, s2: 0.67, flags: 1 })
  const document = staticArtDocument(objects, [
    compact('before', 0),
    { ...compact('fallback', 348), sprite: { atlas: 'custom', entry: 0, src: 'fixture.png', w: 41, h: 63, anchorX: 19.5, anchorY: 47.5 } },
    compact('after', 1), compact('outside', 2, outside),
  ])
  document.meta.bounds = { x: 0, y: 0, w: 400, h: 400 }
  await withStaticWorldFixture(document, { x: 700, y: 1_200, w: 700, h: 800 }, async (build, root, page) => {
    const main = build.mainResidents.get(0)!
    assert.ok(main)
    assert.ok(main.texture.source === page, 'the real main path must borrow the original atlas instead of a Canvas BufferImageSource')
    assert.equal(main.pixels.byteLength, 0)
    assert.equal(main.ownsTexture, false)
    const record = staticArtExpectedRecord(156)!
    root.position.set(800 - 1025 * 1.35, 450 - 1719.6666666666667 * 1.35)
    root.scale.set(1.35)
    const actual = main.sprite.getBounds().rectangle
    assertNear(actual.x, root.x + (position.x - record.anchorX) * 1.35, 'native direct fractional x')
    assertNear(actual.y, root.y + (position.y - record.anchorY) * 1.35, 'native direct fractional y')
    const base = root.children.find(child => child.label === 'boneyard-base')!
    const baseOwners = build.residents.filter(resident => resident.sprite.parent === base && resident.cleanupSourceKey?.startsWith('sprite:'))
    assert.deepEqual(baseOwners.map(resident => resident.cleanupSourceKey), ['sprite:before', 'sprite:fallback', 'sprite:after', 'sprite:outside'])
    for (const source of ['before', 'after', 'outside']) {
      const resident = baseOwners.find(resident => resident.cleanupSourceKey === `sprite:${source}`)!
      assert.equal(resident.texture.source, page)
      assert.equal(resident.mainLayerIndex, null, 'base art must not enter actor occlusion/scalar lighting')
      assert.equal(resident.pixels.byteLength, 0)
    }
    const fallback = baseOwners.find(resident => resident.cleanupSourceKey === 'sprite:fallback')!
    assert.notEqual(fallback.texture.source, page)
    assert.ok(fallback.pixels.byteLength > 0)
    assert.equal(build.mainResidents.get(3)!.sprite.alpha, 0, 'Goodie remains exclusively dynamic')
    assert.equal(build.treeResidents.size, 1)
    assert.notEqual(build.treeResidents.get('tree')!.main, build.treeResidents.get('tree')!.proxy)
    const { BoneyardStaticLighting } = await import('./boneyard-static-lighting.ts')
    const lighting = new BoneyardStaticLighting(
      { runId: 'fixture', scene: { objects } } as unknown as LoadedBoneyard,
      buildNativeRenderPlan(document).shadows, build.buildingResidents,
      build.wallResidents, build.treeResidents, build.treeInputs, 0,
    )
    const index = new NativeBoneyardLightIndex({ width: 3200, height: 2400 })
    const tree = build.treeResidents.get('tree')!
    const treePosition = objects[2]!.pos
    const texturesBefore = [tree.main.texture, tree.proxy.texture]
    for (const enhancedEffects of [false, true, false, true]) {
      const snapshot = { tick: 100, enhancedEffects, secondaryAbilities: { actors: [{
        kind: 'earthquake-scenery-wobble', worldKey: 'boneyard:fixture', targetId: 2, phase: 6.25,
      }] } } as unknown as GameSnapshot
      const result = lighting.update(snapshot, { x: treePosition.x, y: treePosition.y - 100 }, [...build.mainResidents.values()], false, index, () => 0.63)
      assert.equal(result.treeAlphaMismatchCount, 0)
      assert.equal(result.treeTintMismatchCount, 0)
      assert.equal(result.buildingBaseRoofColorMismatchCount, 0)
      assert.equal(result.buildingVisibleCount, 4)
      assertNear(tree.main.sprite.alpha, 0.4, 'Tree reaches native faded alpha')
      for (const resident of [tree.main, tree.proxy]) {
        assertNear(resident.sprite.rotation, 6.25 * Math.PI / 180)
        assertNear(resident.sprite.x, treePosition.x)
        assertNear(resident.sprite.y, treePosition.y)
        assertNear(resident.sprite.pivot.x, treePosition.x - resident.x)
        assertNear(resident.sprite.pivot.y, treePosition.y - resident.y)
      }
      assert.deepEqual([tree.main.texture, tree.proxy.texture], texturesBefore)
      for (const [id, building] of build.buildingResidents) {
        const variant = Number(id.split('-')[1])
        assert.equal(building.samplePoints.length, enhancedEffects ? 9 : 4)
        for (const [resident, entry] of [[building.main, 148 + variant], [building.roof, 152 + variant]] as const) {
          const grid = nativeBuildingMeshGrid(resident.w, resident.h, enhancedEffects)
          assert.deepEqual(resident.surfaceMesh.mesh.geometry.getBuffer('aPosition').data, grid.positions)
          assertArrayNear(mappedTextureUvs(resident.texture, resident.surfaceMesh.mesh.geometry.getBuffer('aUV').data), expectedRecordUvs(entry, grid.uvs), `regridded Building ${entry}`)
          assert.equal(resident.sprite.tint, 0xffffff)
        }
        assert.deepEqual(building.main.surfaceMesh.colors, building.roof.surfaceMesh.colors)
      }
    }
    const grave = build.residents.filter(resident => resident.cleanupSourceKey === 'object:outside-grave')
    assert.equal(grave.length, 2, 'underlay and main retain the same cleanup source')
    const borrowedRecords = build.residents.filter(resident => resident.ownsTexture === false).map(resident => resident.texture)
    let pageUpdates = 0
    page.on('update', () => { pageUpdates += 1 })
    build.applyOffCameraCleanup()
    assert.equal(build.offCameraCleanupApplied, true)
    assert.equal(build.retiredStaticSourceCount, 2)
    assert.equal(build.retiredStaticResidentCount, 3)
    assert.ok(grave.every(resident => !resident.sprite.renderable && !build.activeResidents.includes(resident)))
    const retiredCompact = baseOwners.find(resident => resident.cleanupSourceKey === 'sprite:outside')!
    assert.equal(retiredCompact.sprite.renderable, false)
    assert.equal(build.activeResidents.includes(retiredCompact), false)
    assert.ok(build.activeResidents.includes(main))
    assert.ok(build.activeResidents.includes(fallback))
    assert.equal(pageUpdates, 0, 'tile repaint must never write/update borrowed original page pixels')
    assert.ok(borrowedRecords.every(texture => !texture.destroyed && texture.source === page))
    const active = [...build.activeResidents]
    build.applyOffCameraCleanup()
    assert.deepEqual(build.activeResidents, active)
    assert.equal(pageUpdates, 0)
  })
})

test('direct grate and Rails retain one painter owner, complete repeat geometry and borrowed-source lifetime', async () => {
  const { createNativeStaticFenceResident, nativeStaticArtRecord, nativeStaticRailPositions } = await nativeArt()
  const page = staticArtPage(), grateTexture = new Texture({ source: page })
  const railTexture = staticArtTexture(23, page), rail = nativeStaticArtRecord(23)!
  try {
    for (const points of [
      [{ x: 0.125, y: 0.375 }, { x: 197.625, y: 71.875 }],
      [{ x: 197.625, y: 71.875 }, { x: 0.125, y: 0.375 }],
      [{ x: 19.25, y: 20.5 }, { x: 19.25, y: 197.75 }],
    ]) {
      for (const segmentCode of [0, 4]) {
        const fence = { eid: `composite-${segmentCode}`, typeId: NATIVE.fence, segmentCode, points }
        const layer = buildNativeRenderPlan(staticArtDocument([], [], [fence])).shadows.find(layer => layer.kind === 'fence' && layer.part === 'body')!
        assert.equal(layer.kind, 'fence')
        if (layer.kind !== 'fence') throw new Error('fixture missing fence')
        const resident = createNativeStaticFenceResident(layer, 19, { fenceGrate: grateTexture, glyph: entry => { assert.equal(entry, 23); return railTexture } })!
        const root = new Container()
        root.addChild(resident.sprite)
        try {
          assert.equal(resident.mainLayerIndex, 19)
          assert.equal(resident.ownsTexture, false)
          assert.equal(resident.pixels.byteLength, 0)
          assert.equal(root.children.length, 1, 'pieces remain one depth and lighting owner')
          if (segmentCode === 0) {
            const expected = nativeFenceGrate(points)!
            const mesh = resident.sprite.children[0]
            assert.ok(mesh instanceof MeshSimple)
            assert.ok(resident.sprite.children[1] instanceof Graphics)
            assert.deepEqual(mesh.geometry.getBuffer('aPosition').data, Float32Array.from([
              expected.topStart, expected.topEnd, expected.bottomStart, expected.bottomEnd,
            ].flatMap(point => [point.x, point.y])))
            assert.deepEqual(mesh.geometry.getBuffer('aUV').data, Float32Array.from([0, 0, expected.uSpan, 0, 0, 1, expected.uSpan, 1]))
            assert.ok(expected.uSpan > 1 && expected.uSpan % 1 !== 0, 'fixture exercises repeated and partial final UV span')
            assert.deepEqual(mesh.geometry.getIndex().data, new Uint32Array([0, 1, 2, 2, 1, 3]))
            const geometry = mesh.geometry, buffers = [...geometry.buffers]
            destroyResidentTexture(resident)
            assert.ok(buffers.every(buffer => buffer.destroyed))
          } else {
            const [start, end] = points
            const count = Math.max(1, Math.round(Math.hypot(end!.x - start!.x, end!.y - start!.y) / rail.w))
            const expected = range(0, count).map(index => ({
              x: start!.x + (end!.x - start!.x) * ((index + 0.5) / count),
              y: start!.y + (end!.y - start!.y) * ((index + 0.5) / count),
            }))
            assert.deepEqual(nativeStaticRailPositions(fence, rail.w), expected)
            assert.equal(resident.sprite.children.length, count)
            resident.sprite.children.forEach((child, index) => {
              assert.ok(child instanceof Sprite)
              assert.equal(child.texture, railTexture)
              assertNear(child.x, expected[index]!.x - rail.anchorX)
              assertNear(child.y, expected[index]!.y - rail.anchorY)
            })
            destroyResidentTexture(resident)
          }
          assert.equal(page.destroyed, false)
          assert.equal(grateTexture.destroyed, false)
          assert.equal(railTexture.destroyed, false)
        } finally { root.destroy({ children: true }) }
      }
    }
    assert.deepEqual(nativeStaticRailPositions({ eid: 'zero', typeId: NATIVE.fence, points: [position, position] }, rail.w), [])
  } finally { grateTexture.destroy(false); railTexture.destroy(false); page.destroy() }
})
