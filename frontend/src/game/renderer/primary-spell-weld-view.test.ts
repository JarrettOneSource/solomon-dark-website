import assert from 'node:assert/strict'
import test, { after } from 'node:test'

import { BatchableMesh, Container, Graphics, Mesh, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js'
import { nativeSpriteRecordTexture } from './native-sprite-record-texture.ts'

import { spawnNativeWeldOneShot, type NativeWeldChannelActorState } from '../core-kernels/native-weld-primary-runtime.ts'
import { createNativeWeldBlizzardSourceGlows } from '../core-kernels/native-weld-blizzard.ts'
import type { NativeWeldHailLineState } from '../core-kernels/native-weld-hail-contact.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { WeldDrawingResources, WeldDrawingView } from './primary-spell-weld-drawing.ts'
import type { NativeWeldVisualPlan } from './primary-spell-weld-native.ts'
import { NATIVE_WELD_SPRITES, NATIVE_WELD_DEADHAWG_SPRITES, nativeWeldVisualPlan } from './primary-spell-weld-native.ts'
import { WeldPrimarySpellView, buildNativeFlameLashSplitBands } from './primary-spell-weld-view.ts'
import { updateNativeMeshVertexColors } from './native-material-batch.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const flamePage = new Texture({ source: new TextureSource({ width: 2048, height: 2048, alphaMode: 'no-premultiply-alpha' }) })
const flameRecord = nativeSpriteRecordTexture({ source: flamePage.source, frame: new Rectangle(1760, 1492, 19, 20) })
after(() => { flameRecord.destroy(false); flamePage.destroy(true) })
const textures: PlayerWorldTextures['primarySpells']['weldActors'] = {
  BadGuys: Object.fromEntries(Object.entries(NATIVE_WELD_SPRITES).map(([key, value]) => [key, { ...value, texture: Number(key) === 25 ? flameRecord : Texture.EMPTY }])),
  DeadHawg: Object.fromEntries(Object.entries(NATIVE_WELD_DEADHAWG_SPRITES).map(([key, value]) => [key, { ...value, texture: Texture.EMPTY }])),
}

function channel(buildId: 1003 | 1004): NativeWeldChannelActorState {
  return {
    enhancedEffects: true,
    ageTicks: 0, birthTick: 1, buildId, direction: { x: 0, y: -1 },
    endpoint: { x: 100, y: -600 }, id: 1, kind: 'weld-channel', lightRegistration: null,
    midpoint: { x: 50, y: -310 }, origin: { x: 0, y: 0 }, ownerId: 'wizard',
    targetId: 'enemy:1', underpowered: false, variant: 0,
    vector: [8, 2, 1, 0.8, 0, 0, 0.2, 0], worldKey: 'boneyard:retained-weld',
    ...(buildId === 1003 ? { flameVisual: {
      kind: 'native-birth-v1' as const, role: 'main' as const, cameraDisplacement: { x: 4, y: 0 }, width: 1,
      start: { x: 0, y: 0 }, control: { x: 50, y: -310 }, end: { x: 100, y: -600 }, offset: { x: 0, y: 0 },
      ribbon: { kind: 'long' as const, phaseDegrees: -3 },
      path: { intensity: 1, radiusFactors: [], creatorRegistration: { managerLane: 'actor' as const, registrationOrdinal: 1 }, miscAppendOrdinal: 0 },
    } } : {}),
  }
}

for (const buildId of [1003, 1004] as const) {
  test(`Weld ${buildId} reuses live band views and releases their shared geometry`, () => {
    const state = channel(buildId)
    const view = new WeldPrimarySpellView(state, textures)
    const bands = view.containers.slice(1)
    assert.ok(bands.length > 10)
    const contents = bands.map(band => band.children[0]!)
    const meshes = contents.map(content => content.children.filter((child): child is Mesh => child instanceof Mesh))
    const geometry = meshes[0]!.map(mesh => mesh.geometry)
    const buffers = geometry.flatMap(resource => resource.buffers)
    const lifetimeEvents = geometry.map(resource => {
      const events: string[] = []
      resource.on('unload', () => {
        assert.ok(resource.buffers.every(buffer => !buffer.destroyed))
        events.push('unload')
      })
      resource.on('destroy', () => events.push('destroy'))
      return events
    })
    const shifted = { ...state, ageTicks: buildId === 1003 ? 0 : 1, origin: { x: 20, y: 30 }, endpoint: { x: 120, y: -500 } }
    view.update(shifted, 40)
    const plan = nativeWeldVisualPlan(shifted, 40)
    for (let band = 0; band < bands.length; band += 1) {
      const current = contents[band]!.children.filter((child): child is Mesh => child instanceof Mesh)
      assert.equal(current.length, plan.meshes.length)
      for (let index = 0; index < current.length; index += 1) {
        const mesh = current[index]!
        assert.equal(mesh, meshes[band]![index], 'an existing band draw must survive an age/position update')
        assert.equal(mesh.geometry, geometry[index], 'clipped views must share the semantic mesh geometry')
        assert.deepEqual(mesh.geometry.getBuffer('aPosition').data, new Float32Array(plan.meshes[index]!.vertices))
        assert.deepEqual(mesh.geometry.getBuffer('aUV').data, new Float32Array(plan.meshes[index]!.uvs))
        assert.deepEqual(mesh.geometry.getIndex().data, buildId === 1003
          ? new Uint16Array(plan.meshes[index]!.indices) : new Uint32Array(plan.meshes[index]!.indices))
        assert.equal(mesh.alpha, plan.meshes[index]!.alpha)
        assert.equal(mesh.tint, plan.meshes[index]!.tint)
        assert.equal(mesh.blendMode, plan.meshes[index]!.blend)
      }
      const mask = bands[band]!.children.find(child => child instanceof Graphics)
      assert.ok(mask instanceof Graphics)
      assert.equal(mask.position.x, buildId === 1003 ? 0 : -shifted.origin.x)
    }
    assert.ok(lifetimeEvents.every(events => events.length === 0))
    view.destroy()
    for (const events of lifetimeEvents) assert.deepEqual(events, ['unload', 'destroy'])
    assert.ok(meshes.flat().every(mesh => mesh.destroyed))
    assert.ok(buffers.every(buffer => buffer.destroyed))
    assert.equal(Texture.EMPTY.destroyed, false)
  })
}

test('Weld channels retain native painter insertions, tint and retirement boundaries', () => {
  const state = channel(1004)
  const view = new WeldPrimarySpellView(state, textures)
  const root = view.painterRoots()[0]!
  assert.equal(root.visible, false)
  assert.equal(root.insertions?.length, view.containers.length - 1)
  assert.equal(root.overlayOwnerId, 'wizard')
  view.setTint('band-0', 0xabcdef)
  assert.equal(view.painterContainer('band-0')?.tint, 0xabcdef)
  assert.equal(view.painterContainer('band-invalid'), null)
  assert.equal(view.painterContainer('band-9999'), null)
  assert.equal(view.painterContainer(''), null)
  view.setTint('', 0x123456)
  assert.equal(view.container.tint, 0x123456)
  view.update({ ...state, buildId: 1003 })
  assert.equal(view.kind, 'weld-channel:1004')
  assert.equal(view.painterRoots()[0]!.insertions?.length, root.insertions?.length)
  view.update({ ...state, endpoint: null })
  assert.deepEqual(view.painterRoots(), [])
  view.destroy()
  const retired = new WeldPrimarySpellView({ ...state, endpoint: null }, textures)
  assert.equal(retired.containers.length, 1)
  retired.destroy()
})

for (const buildId of [1000, 1001, 1002, 1009] as const) {
  test(`Weld ${buildId} keeps unsplit sprite and painter output through pose changes`, () => {
    const state = spawnNativeWeldOneShot({
      aimDirection: { x: 1, y: 0 }, firstId: buildId, origin: { x: 10, y: 20 },
      ownerId: 'wizard', rng: createNativeRng(buildId), targets: [], underpowered: false,
      worldKey: 'boneyard:retained-weld',
      primarySkill: {
        buildId, castKind: 'one-shot', damageFactor: 1, damageMaximum: 8,
        damageMinimum: 8, damageRollCount: 1, rank: 1, kind: 'weld', manaCost: 2, skillId: buildId,
        vector: { buildId, castKind: 'one-shot', values: [8, 8, 2, 1, 1, 1, 1, 0, 0] },
      },
    }).projectiles[0]!
    const view = new WeldPrimarySpellView(state, textures)
    const before = view.container.children.filter((child): child is Sprite => child instanceof Sprite)
    const next = { ...state, ageTicks: 17, position: { x: 30, y: 40 } }
    view.update(next, 33)
    const plan = nativeWeldVisualPlan(next, 33)
    const sprites = view.container.children.filter((child): child is Sprite => child instanceof Sprite)
    assert.equal(sprites.length, plan.sprites.length)
    assert.equal(sprites[0], before[0])
    assert.equal(view.container.position.x, plan.position.x)
    assert.equal(view.container.position.y, plan.position.y)
    if (buildId === 1009) assert.deepEqual(view.painterRoots(), [])
    else assert.equal(view.painterRoots()[0]!.worldY, plan.worldY)
    for (const [index, sprite] of sprites.entries()) {
      assert.equal(sprite.label, `${plan.sprites[index]!.role}:${plan.sprites[index]!.atlas}:${plan.sprites[index]!.record}`)
      assert.equal(sprite.alpha, plan.sprites[index]!.alpha)
      assert.equal(sprite.tint, plan.sprites[index]!.tint)
    }
    view.destroy()
    assert.equal(Texture.EMPTY.destroyed, false)
  })
}

test('Weld drawing keeps layer order and updates changing topology and affine sprite poses', () => {
  const initial: NativeWeldVisualPlan = {
    lines: [{ alpha: 0.5, color: 0xabcdef, end: { x: 10, y: 20 }, role: 'trail', start: { x: 0, y: 0 }, width: 2 }],
    meshes: [{ alpha: 0.75, blend: 'add', indices: [0, 1, 2], record: 43, role: 'beam', tint: 0x123456, uvs: [0, 0, 1, 0, 0, 1], vertices: [0, 0, 20, 0, 0, 30] }],
    position: { x: 0, y: 0 }, regionLightPoint: null, sortBias: 0, worldY: 0,
    sprites: [{ alpha: 0.5, atlas: 'BadGuys', blend: 'normal', matrix: null, offset: { x: 2, y: 3 }, record: 16, role: 'glow', rotationRadians: 0, scaleX: 2, scaleY: 3, tint: 0xabcdef }],
  }
  for (const split of [false, true]) {
    const root = new Container()
    const resources = new WeldDrawingResources()
    const view = new WeldDrawingView(root, resources, textures, split)
    resources.update(initial)
    view.update(initial, resources)
    assert.deepEqual(root.children.map(child => child.label), split
      ? ['glow:BadGuys:16', 'weld:split-lines', 'beam:BadGuys:43']
      : ['weld:lines', 'weld:meshes', 'glow:BadGuys:16'])
    const sprite = root.children.find((child): child is Sprite => child instanceof Sprite)!
    assert.equal(sprite.position.x, 2)
    assert.equal(sprite.scale.y, 3)
    const next: NativeWeldVisualPlan = { ...initial,
      meshes: [{ ...initial.meshes[0]!, indices: [0, 1, 2, 1, 2, 3], uvs: [0, 0, 1, 0, 0, 1, 1, 1], vertices: [0, 0, 20, 0, 0, 30, 20, 30] }],
      sprites: [{ ...initial.sprites[0]!, matrix: { a: 2, b: 0, c: 0, d: 3, tx: 7, ty: 8 } }],
    }
    resources.update(next)
    view.update(next, resources)
    assert.equal(sprite.position.x, 7)
    assert.equal(sprite.position.y, 8)
    assert.equal(sprite.scale.x, 2)
    assert.deepEqual(resources.meshes[0]!.getIndex().data, new Uint32Array([0, 1, 2, 1, 2, 3]))
    const geometry = resources.meshes[0]!
    const buffers = [...geometry.buffers]
    const empty = { ...initial, lines: [], meshes: [], sprites: [] }
    resources.update(empty)
    view.update(empty, resources)
    assert.equal(root.children.some(child => child instanceof Sprite || child instanceof Mesh), false)
    assert.equal(sprite.destroyed, true)
    resources.update(initial)
    view.update(initial, resources)
    assert.equal(resources.meshes[0], geometry)
    root.destroy({ children: true })
    resources.destroy()
    assert.ok(buffers.every(buffer => buffer.destroyed))
  }
})

test('missing Weld atlas entries fail before an incomplete drawing is presented', () => {
  assert.throws(() => new WeldPrimarySpellView(channel(1003), { BadGuys: {}, DeadHawg: {} }), /Missing native Weld mesh texture/)
  const frost = createNativeWeldBlizzardSourceGlows({
    direction: { x: 1, y: 0 }, firstId: 20, origin: { x: 0, y: 0 },
    ownerId: 'wizard', rng: createNativeRng(44), tick: 2,
    vector: [8, 2, 1, 0.8, 0, 0, 0.2], worldKey: 'boneyard:retained-weld',
  }).actors[0]!
  assert.throws(() => new WeldPrimarySpellView(frost, { BadGuys: {}, DeadHawg: {} }), /Missing native Weld texture/)

  const root = new Container()
  const resources = new WeldDrawingResources()
  const view = new WeldDrawingView(root, resources, { BadGuys: {}, DeadHawg: {} }, false)
  const plan = nativeWeldVisualPlan(frost)
  resources.update(plan)
  assert.throws(() => view.update(plan, resources), /Missing native Weld texture/)
  root.destroy({ children: true })
  resources.destroy()
})

test('Hail contact lines retain both native strokes and reject unrelated actor updates', () => {
  const state: NativeWeldHailLineState = {
    ageTicks: 0, birthTick: 1, buildId: 1008, direction: { x: 1, y: 0 }, id: 20,
    kind: 'weld-hail-line', lightRegistration: null, origin: { x: 0, y: 0 },
    ownerId: 'wizard', vector: [], worldKey: 'boneyard:retained-weld',
    alpha: 0.8, alphaStep: -0.1, end: { x: 20, y: 30 }, endAlpha: 0.5,
    start: { x: 10, y: 20 }, width: 2,
  }
  const view = new WeldPrimarySpellView(state, textures)
  const graphics = view.container.children.find((child): child is Graphics => child instanceof Graphics)!
  assert.equal(graphics.context.instructions.length, 2)
  const roots = view.painterRoots()
  view.update({
    ageTicks: 0, id: 1, kind: 'fire-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
    origin: { x: 0, y: 0 }, ownerId: 'wizard', worldKey: state.worldKey,
  })
  view.update(channel(1004))
  assert.equal(view.painterRoots()[0]!.worldY, roots[0]!.worldY)
  view.update({ ...state, alpha: 0.4 })
  assert.equal(graphics.context.instructions.length, 2)
  view.destroy()
})

// CPU-side Pixi resource tests; live GPU pixels and native captures remain a
// separate acceptance stage. Both installed native mesh pipelines consume aColor.
test('Flame uses real packed vertex colors and one full-page absolute UV mapping', () => {
  const state = channel(1003)
  assert.equal(state.flameVisual!.kind, 'native-birth-v1')
  const weak = { ...state, underpowered: true, flameVisual: { ...state.flameVisual!, width: .75 } }
  const view = new WeldPrimarySpellView(weak, textures)
  const meshes = view.containers.slice(1).map(band => band.children[0]!.children.find(child => child instanceof Mesh) as Mesh)
  const mesh = meshes[0]!
  const expected = nativeWeldVisualPlan(weak).meshes[0]!
  assert.equal(mesh.alpha, 1)
  assert.equal(mesh.tint, 0xffffff)
  assert.equal(mesh.shader, null)
  assert.equal(mesh.geometry.attributes.aColor!.format, 'unorm8x4')
  assert.deepEqual(Array.from(mesh.geometry.getBuffer('aColor').data), expected.colors)
  assert.deepEqual(Array.from(mesh.geometry.getBuffer('aColor').data).slice(0, 2), [0, 0])
  assert.ok(Array.from(mesh.geometry.getBuffer('aColor').data).slice(2, -2).every(value => value === 0x7fffffff))
  assert.equal(mesh.texture.source, flameRecord.source)
  assert.notEqual(mesh.texture, flameRecord)
  assert.equal(mesh.texture.frame.x, 0)
  assert.equal(mesh.texture.frame.width, 2048)
  assert.equal(mesh.texture.textureMatrix.isSimple, true)
  assert.equal(flameRecord.textureMatrix.isSimple, false)
  const batchable = new BatchableMesh()
  batchable.geometry = mesh.geometry
  batchable.setTexture(mesh.texture)
  assert.deepEqual(Array.from(batchable.uvs), expected.uvs)
  assert.equal(batchable.uvs, mesh.geometry.getBuffer('aUV').data)
  for (const draw of meshes) {
    assert.equal(draw.geometry, mesh.geometry)
    assert.equal(updateNativeMeshVertexColors(draw), true)
  }
  const page = mesh.texture
  view.destroy()
  assert.equal(page.destroyed, true)
  assert.equal(flameRecord.destroyed, false)
  assert.equal(flameRecord.source.destroyed, false)
})

test('Flame live quality changes retain birth geometry and use padded native band progression', () => {
  const state = channel(1003)
  const view = new WeldPrimarySpellView(state, textures, false)
  const firstBand = view.containers[1]!
  const mesh = firstBand.children[0]!.children.find(child => child instanceof Mesh) as Mesh
  const geometry = mesh.geometry
  const positions = geometry.getBuffer('aPosition')
  const originalWords = [...positions.data]
  const originalUpdate = positions._updateID
  const coarse = view.painterRoots()[0]!.insertions!
  view.setRegionView({ x: 10, y: -300, width: 500, height: 200 })
  view.update(state, 900, 1, true)
  assert.equal(firstBand.children[0]!.children.find(child => child instanceof Mesh), mesh)
  assert.equal(mesh.geometry, geometry)
  assert.deepEqual([...positions.data], originalWords)
  assert.equal(positions._updateID, originalUpdate)
  const enhanced = view.painterRoots()[0]!.insertions!
  assert.ok(enhanced.length > coarse.length)
  assert.equal(enhanced[0]!.worldY, -275)
  assert.equal(enhanced[1]!.worldY, -250)
  assert.ok(enhanced.some(insertion => !insertion.visible))
  assert.equal(view.container.position.x, 0)
  assert.equal(view.container.position.y, 0)
  const mask = firstBand.children.find(child => child instanceof Graphics) as Graphics
  const maskBounds = mask.getLocalBounds()
  assert.equal(maskBounds.minX, 10)
  assert.equal(maskBounds.minY, -300)
  assert.equal(maskBounds.maxX, 510)
  assert.equal(maskBounds.maxY, -275)
  view.update(state, 901, 1, false)
  assert.equal(view.painterRoots()[0]!.insertions!.length, coarse.length)
  assert.equal(view.painterRoots()[0]!.insertions![0]!.worldY, -250)
  assert.equal(positions._updateID, originalUpdate)
  view.update({ ...state, ageTicks: 1 }, 902, 1, true)
  assert.deepEqual(view.painterRoots(), [])
  assert.ok(view.containers.slice(1).every(band => !band.children[0]!.children.some(child => child instanceof Mesh)))
  view.destroy()
})

test('Flame split clips start at the intersection but retain the original padded count', () => {
  const bounds = { x: -40, y: -100, width: 120, height: 101 }
  const region = { x: 0, y: -13, width: 50, height: 60 }
  const enhanced = buildNativeFlameLashSplitBands('test', bounds, true, region)
  assert.deepEqual(enhanced.map(band => band.clip.y), [-13, 12, 37, 62, 87])
  assert.deepEqual(enhanced.map(band => band.painterY), [12, 37, 62, 87, 112])
  assert.ok(enhanced.every(band => band.clip.x === 0 && band.clip.width === 10000 && band.clip.height === 25))
  assert.deepEqual(buildNativeFlameLashSplitBands('test', bounds, false, region).map(band => band.clip.y), [-13, 37, 87])
})

test('Flame missing and legacy birth data stays invisible, including a later visual update', () => {
  const state = channel(1003)
  for (const flameVisual of [undefined, { kind: 'legacy-suppressed' as const }]) {
    const view = new WeldPrimarySpellView({ ...state, flameVisual }, textures)
    assert.deepEqual(view.painterRoots(), [])
    assert.equal(view.containers.length, 1)
    view.update(state)
    assert.deepEqual(view.painterRoots(), [])
    view.destroy()
  }
})

test('World view changes live Flame bands without recreating the retained mesh or outer clip', () => {
  const root = new Container()
  const outerClip = new Graphics().rect(-1000, -1000, 2000, 2000).fill(0xffffff)
  root.mask = outerClip
  const worldTextures = { primarySpells: { weldActors: textures } } as PlayerWorldTextures
  const world = new PrimarySpellWorldView(root, worldTextures)
  const state = { ...channel(1003), painterRegistrations: [{ managerLane: 'actor' as const, registrationOrdinal: 1 }] }
  const spells = { nextId: 2, projectiles: [], transients: [state] }
  world.update(spells, state.worldKey, 10, () => 1, undefined, false, { x: 0, y: -500, width: 800, height: 500 })
  const retained = [...root.children]
  const mesh = retained[1]!.children[0]!.children.find(child => child instanceof Mesh) as Mesh
  const geometry = mesh.geometry
  const coarseCount = world.painterLayers()[0]!.insertions!.length
  let geometryDestroyed = false
  geometry.on('destroy', () => { geometryDestroyed = true })
  world.update(spells, state.worldKey, 11, () => 1, undefined, true, { x: 0, y: -450, width: 800, height: 450 })
  assert.equal(root.children.length, retained.length)
  retained.forEach((container, index) => assert.equal(root.children[index], container))
  assert.equal(retained[1]!.children[0]!.children.find(child => child instanceof Mesh), mesh)
  assert.equal(mesh.geometry, geometry)
  assert.ok(world.painterLayers()[0]!.insertions!.length > coarseCount)
  assert.equal(world.painterLayers()[0]!.insertions![0]!.worldY, -425)
  assert.equal(root.mask, outerClip)
  world.update({ ...spells, transients: [] }, state.worldKey)
  assert.equal(root.children.length, 0)
  assert.equal(geometryDestroyed, true)
  assert.equal(root.mask, outerClip)
  world.destroy()
  root.destroy()
  outerClip.destroy()
})
