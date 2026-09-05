import assert from 'node:assert/strict'
import test from 'node:test'

import { Container, Graphics, Mesh, Sprite, Texture } from 'pixi.js'

import { spawnNativeWeldOneShot, type NativeWeldChannelActorState } from '../core-kernels/native-weld-primary-runtime.ts'
import { createNativeWeldBlizzardSourceGlows } from '../core-kernels/native-weld-blizzard.ts'
import type { NativeWeldHailLineState } from '../core-kernels/native-weld-hail-contact.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { WeldDrawingResources, WeldDrawingView } from './primary-spell-weld-drawing.ts'
import type { NativeWeldVisualPlan } from './primary-spell-weld-native.ts'
import { NATIVE_WELD_SPRITES, NATIVE_WELD_DEADHAWG_SPRITES, nativeWeldVisualPlan } from './primary-spell-weld-native.ts'
import { WeldPrimarySpellView } from './primary-spell-weld-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const textures: PlayerWorldTextures['primarySpells']['weldActors'] = {
  BadGuys: Object.fromEntries(Object.entries(NATIVE_WELD_SPRITES).map(([key, value]) => [key, { ...value, texture: Texture.EMPTY }])),
  DeadHawg: Object.fromEntries(Object.entries(NATIVE_WELD_DEADHAWG_SPRITES).map(([key, value]) => [key, { ...value, texture: Texture.EMPTY }])),
}

function channel(buildId: 1003 | 1004): NativeWeldChannelActorState {
  return {
    ageTicks: 0, birthTick: 1, buildId, direction: { x: 0, y: -1 },
    endpoint: { x: 100, y: -600 }, id: 1, kind: 'weld-channel', lightRegistration: null,
    midpoint: { x: 50, y: -310 }, origin: { x: 0, y: 0 }, ownerId: 'wizard',
    targetId: 'enemy:1', underpowered: false, variant: 0,
    vector: [8, 2, 1, 0.8, 0, 0, 0.2, 0], worldKey: 'boneyard:retained-weld',
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
    const shifted = { ...state, ageTicks: 1, origin: { x: 20, y: 30 }, endpoint: { x: 120, y: -500 } }
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
        assert.deepEqual(mesh.geometry.getIndex().data, new Uint32Array(plan.meshes[index]!.indices))
        assert.equal(mesh.alpha, plan.meshes[index]!.alpha)
        assert.equal(mesh.tint, plan.meshes[index]!.tint)
        assert.equal(mesh.blendMode, plan.meshes[index]!.blend)
      }
      const mask = bands[band]!.children.find(child => child instanceof Graphics)
      assert.ok(mask instanceof Graphics)
      assert.equal(mask.position.x, -shifted.origin.x)
    }
    view.destroy()
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
