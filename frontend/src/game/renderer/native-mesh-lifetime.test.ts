import assert from 'node:assert/strict'
import test, { after, before, mock } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Color, Container, DOMAdapter, FillGradient, Graphics, MeshSimple, Particle, ParticleContainer, Texture, WebGLRenderer } from 'pixi.js'
import { createServer, type ViteDevServer } from 'vite'
import { NATIVE_HAGATHA_SELECTORS } from '../core-kernels/native-hagatha-effects.ts'
import { NativeBoneyardWeather } from '../core-kernels/native-boneyard-weather.ts'
import type { NativeSecondaryActorState } from '../core-kernels/native-secondary-abilities.ts'
import { nativeInitialGolemArticulation } from '../core-kernels/native-secondary-golem.ts'
import type { NativeFadeLineActor } from '../core-kernels/native-silk-force.ts'
import type { BoneyardEnemyDeathEffectSnapshot, GameSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { NativeEnemyUnderlayView } from './native-enemy-underlay-view.ts'
import { NativeHagathaSeekerView } from './native-hagatha-seeker-view.ts'
import type { NativeSecondaryWorldView } from './native-secondary-world-view.ts'
import { NativeSpiderWebViews } from './native-spider-web-views.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

let server: ViteDevServer
let secondaryAssets: typeof import('./native-secondary-assets.ts')
let secondaryModule: typeof import('./native-secondary-world-view.ts')
let weatherModule: typeof import('./native-boneyard-weather-view.ts')
let deathEffectModule: typeof import('./native-enemy-death-effect-view.ts')

before(async () => {
  server = await createServer({
    appType: 'custom', logLevel: 'silent',
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    server: { middlewareMode: true },
  })
  secondaryAssets = await server.ssrLoadModule('/src/game/renderer/native-secondary-assets.ts') as typeof import('./native-secondary-assets.ts')
  deathEffectModule = await server.ssrLoadModule('/src/game/renderer/native-enemy-death-effect-view.ts') as typeof import('./native-enemy-death-effect-view.ts')
  // The module's shared filter probes shader precision; these ownership tests do not render.
  const createCanvas = mock.method(DOMAdapter.get(), 'createCanvas', () => ({ getContext: () => null }))
  try {
    secondaryModule = await server.ssrLoadModule('/src/game/renderer/native-secondary-world-view.ts') as typeof import('./native-secondary-world-view.ts')
    weatherModule = await server.ssrLoadModule('/src/game/renderer/native-boneyard-weather-view.ts') as typeof import('./native-boneyard-weather-view.ts')
  } finally {
    createCanvas.mock.restore()
  }
})
after(async () => { await server?.close() })

test('banish gradients reuse cleared canvases, notify texture updates, and release them on retirement', (t) => {
  const canvases = new Map<object, ReturnType<typeof gradientCanvas>>()
  t.mock.method(DOMAdapter.get(), 'createCanvas', (width: number, height: number) => {
    const record = gradientCanvas(width, height)
    canvases.set(record.canvas, record)
    return record.canvas
  })
  const root = new Container()
  const preWorld = new Container()
  const textures = {
    base: Object.fromEntries([15, 333, 334, 335, 336].map(entry => [
      nativeEnemySpriteRecord('BadGuys', entry).source, Texture.EMPTY,
    ])),
  } as BoneyardWorldTextures
  const views = new deathEffectModule.NativeEnemyDeathEffectViews(root, textures, preWorld)
  const bounds = { x: -1000, y: -1000, w: 2000, h: 2000 }
  const effect: BoneyardEnemyDeathEffectSnapshot = {
    ageTicks: 0, alpha: 1, atlas: 'BadGuys', blendMode: 'add', entry: 15,
    height: 0, id: 1, kind: 'banish', ownerActorId: 1,
    painterRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
    presentationOwner: 'world-sorted', position: { x: 10, y: 20 },
    rotationRadians: 0, scale: 1, scaleY: 1, shadow: false, spawnTick: 100, tint: 0xffffff,
  }
  try {
    views.update([effect], { ...bounds, x: 10000 }, 900)
    assert.equal(canvases.size, 0)
    views.update([effect], bounds, 900)
    assert.equal(canvases.size, 6)
    const graphics = root.children[0]!.children.find(child => child instanceof Graphics)
    assert.ok(graphics instanceof Graphics)
    const gradients = graphics.context.instructions.map(instruction => {
      assert.equal(instruction.action, 'fill')
      assert.ok('style' in instruction.data)
      const gradient = instruction.data.style.fill
      assert.ok(gradient instanceof FillGradient)
      return gradient
    })
    const sources = gradients.map(gradient => gradient.texture.source)
    const updates = sources.map(source => t.mock.method(source, 'update'))
    const unloads = sources.map(() => 0)
    const destroys = sources.map(() => 0)
    sources.forEach((source, index) => {
      source.on('unload', () => { unloads[index]! += 1 })
      source.on('destroy', () => { destroys[index]! += 1 })
    })
    views.update([{ ...effect, ageTicks: 50 }], bounds, 900)
    assert.equal(canvases.size, 6)
    const colors = ['rgba(255,128,0,0.5)', 'rgba(255,191,0,0.5)', 'rgba(255,255,255,0.75)']
    gradients.forEach((gradient, index) => {
      assert.equal(gradient.texture.source, sources[index])
      assert.equal(updates[index]!.mock.callCount(), 1)
      const color = Color.shared.setValue(colors[index % 3]!).toHexa()
      const stops = index < 3 ? ['#000000ff', color] : [color, '#000000ff']
      const record = canvases.get(gradient.texture.source.resource)!
      assert.deepEqual(record.paints, [{
        coordinates: [0, 0, 256, 0], stops: stops.map((value, offset) => [offset, value]),
        rectangle: [0, 0, 256, 1],
      }])
    })
    views.update([{ ...effect, ageTicks: 50 }], bounds, 900)
    for (const update of updates) assert.equal(update.mock.callCount(), 1)
    views.update([{ ...effect, ageTicks: 100 }], bounds, 900)
    assert.equal(graphics.context.instructions.length, 2)
    views.update([effect], bounds, 1080)
    assert.equal(graphics.context.instructions.length, 6)
    assert.equal(canvases.size, 6)
    for (const gradient of gradients) {
      assert.equal(canvases.get(gradient.texture.source.resource)!.paints.length, 1)
    }
    views.update([], bounds, 900)
    assert.deepEqual(unloads, [1, 1, 1, 1, 1, 1])
    assert.deepEqual(destroys, [1, 1, 1, 1, 1, 1])
    for (const source of sources) {
      assert.equal(source.destroyed, true)
      assert.equal(source.resource, null)
    }
    assert.equal(root.children.length, 0)
    assert.equal(Texture.EMPTY.destroyed, false)
  } finally {
    views.destroy()
    root.destroy()
    preWorld.destroy()
  }
})

function gradientCanvas(width: number, height: number) {
  interface Paint {
    coordinates: number[]
    stops: [number, string][]
    rectangle: number[]
  }
  const paints: Paint[] = []
  const context = {
    fillStyle: null as null | Omit<Paint, 'rectangle'>,
    createLinearGradient(...coordinates: number[]) {
      const stops: [number, string][] = []
      return { coordinates, stops, addColorStop: (offset: number, color: string) => { stops.push([offset, color]) } }
    },
    clearRect() { paints.length = 0 },
    fillRect(...rectangle: number[]) {
      assert.ok(this.fillStyle)
      paints.push({ coordinates: this.fillStyle.coordinates, stops: this.fillStyle.stops, rectangle })
    },
  }
  return { canvas: { width, height, getContext: () => context }, paints }
}

test('retained weather drops preserve Pixi colors through reuse without redundant normalization', (t) => {
  const weather = new NativeBoneyardWeather({ enhancedEffects: true, initialTick: 0, mode: 2 })
  const colors = [0]
  t.mock.getter(weather, 'activeDropCount', () => colors.length)
  t.mock.getter(weather, 'activeSplashCount', () => 0)
  const visitDrops: NativeBoneyardWeather['visitDrops'] = (_lightAt, visitor) => {
    for (let index = 0; index < colors.length; index += 1) {
      visitor(index, index, 10 + index, 20 + index, 32, colors[index]!)
    }
  }
  t.mock.method(weather, 'visitDrops', visitDrops)
  const root = new Container()
  const view = new weatherModule.NativeBoneyardWeatherView(root, Texture.EMPTY, weather)
  const drops = root.children.find(child => child instanceof ParticleContainer)
  assert.ok(drops instanceof ParticleContainer)
  const expected = new Particle({ texture: Texture.EMPTY })
  try {
    view.update()
    const first = drops.particleChildren[0]
    assert.ok(first instanceof Particle)
    const normalize = t.mock.method(Color.shared, 'setValue')
    for (let channel = 0; channel <= 255; channel += 1) {
      colors[0] = channel * 0x010101
      expected.alpha = 1
      expected.tint = colors[0]
      view.update()
      assert.deepEqual([first.alpha, first.tint, first.color], [expected.alpha, expected.tint, expected.color])
      const calls = normalize.mock.callCount()
      view.update()
      assert.equal(normalize.mock.callCount(), calls)
    }
    colors.splice(0, 1, 0x111111, 0x777777, 0xeeeeee)
    view.update()
    const retained = [...drops.particleChildren]
    colors.length = 1
    view.update()
    for (const particle of retained.slice(1)) {
      assert.ok(particle instanceof Particle)
      expected.tint = particle.tint
      expected.alpha = 0
      assert.deepEqual([particle.alpha, particle.color], [expected.alpha, expected.color])
    }
    colors.length = 0
    view.update()
    assert.ok(retained.every(particle => particle instanceof Particle && particle.alpha === 0))
    colors.push(0xeeeeee, 0x777777, 0x111111)
    view.update()
    assert.deepEqual(drops.particleChildren, retained)
    for (const [index, particle] of retained.entries()) {
      assert.ok(particle instanceof Particle)
      expected.alpha = 1
      expected.tint = colors[index]!
      assert.deepEqual([particle.alpha, particle.tint, particle.color], [expected.alpha, expected.tint, expected.color])
    }
  } finally {
    view.destroy()
    assert.equal(root.children.length, 0)
    assert.equal(drops.particleChildren.length, 0)
    root.destroy()
  }
})

test('enemy underlays release their vertex and UV buffers with the index buffer', () => {
  const root = new Container()
  const textures = {
    base: { [nativeEnemySpriteRecord('BadGuys', 67).source]: Texture.EMPTY },
  } as BoneyardWorldTextures
  const view = new NativeEnemyUnderlayView(root, textures, 'test-underlay')
  view.update({ x: 0, y: 0 }, [{
    alphas: [1, 1, 1, 1], atlas: 'BadGuys', blendMode: 'normal', entry: 67,
    role: 'test-shadow', tint: 0xffffff,
    vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  }], 1)
  const assertRetired = observeRetirement(ownedMeshes(root))
  view.destroy()
  assertRetired()
  assert.equal(root.children.length, 0)
  assert.equal(Texture.EMPTY.destroyed, false)
  root.destroy()
})

test('repeated spider fragment retirement releases every owned geometry and buffer immediately', () => {
  const root = new Container()
  const views = new NativeSpiderWebViews(root)
  for (let cycle = 0; cycle < 100; cycle += 1) {
    const fragments: NativeFadeLineActor[] = [0, 1, 2].map(offset => ({
      id: cycle * 3 + offset,
      spawnTick: cycle,
      state: {
        start: { x: 0, y: 0 }, middle: { x: 10, y: 5 }, end: { x: 20, y: 0 },
        velocity: { x: 1, y: 0 }, opacity: 0.5, opacityLossPerTick: 0.01,
      },
    }))
    views.update([], fragments, cycle, () => 1)
    const meshes = ownedMeshes(root)
    assert.equal(meshes.length, fragments.length)
    const assertRetired = observeRetirement(meshes)
    views.update([], [], cycle + 1, () => 1)
    assertRetired()
    assert.equal(root.children.length, 0)
  }
  views.destroy()
  root.destroy()
  assert.equal(Texture.WHITE.destroyed, false)
})

test('secondary gradient, plane and assembly meshes release on actor retirement and scene destruction', () => {
  for (const kind of ['storm-drop', 'plane-orb-shot', 'golem'] as const) {
    for (const retireActor of [true, false]) {
      const root = new Container()
      const views = secondaryViews(root)
      views.update({ actors: [secondaryActor(kind)] }, 'boneyard:test', 100)
      const assertRetired = observeRetirement(ownedMeshes(root))
      if (retireActor) views.update({ actors: [] }, 'boneyard:test', 101)
      else views.destroy()
      assertRetired()
      assert.equal(root.children.length, 0)
      if (retireActor) views.destroy()
      root.destroy()
    }
  }
  assert.equal(Texture.EMPTY.destroyed, false)
  assert.equal(Texture.WHITE.destroyed, false)
})

test('secondary meshes release when a surviving actor drops its gradient, plane or assembly beam', () => {
  for (const kind of ['storm-drop', 'plane-orb-shot', 'golem'] as const) {
    const root = new Container()
    const views = secondaryViews(root)
    const actor = secondaryActor(kind)
    views.update({ actors: [actor] }, 'boneyard:test', 100)
    const assertRetired = observeRetirement(ownedMeshes(root))
    const next = kind === 'storm-drop' ? { ...actor, phase: 0 }
      : kind === 'golem' ? { ...actor, ageTicks: 400 }
        : { ...actor, kind: 'shockwave' as const }
    views.update({ actors: [next] }, 'boneyard:test', 400)
    assertRetired()
    assert.equal(ownedMeshes(root).length, 0)
    views.destroy()
    root.destroy()
  }
})

test('seeker segments release geometry on loot removal and final destruction', () => {
  const root = new Container()
  const view = new NativeHagathaSeekerView(root)
  view.update(seekerSnapshot(true), 'player')
  const assertRemoved = observeRetirement(ownedMeshes(root))
  view.update(seekerSnapshot(false), 'player')
  assertRemoved()
  assert.equal(ownedMeshes(root).length, 0)
  view.update(seekerSnapshot(true), 'player')
  const assertDestroyed = observeRetirement(ownedMeshes(root))
  view.destroy()
  assertDestroyed()
  root.destroy()
})

function observeRetirement(meshes: readonly MeshSimple[]): () => void {
  assert.ok(meshes.length > 0, 'fixture must create actual meshes')
  const resources = meshes.map(mesh => {
    const geometry = mesh.geometry
    const buffers = [...geometry.buffers]
    const events: string[] = []
    geometry.on('unload', () => {
      assert.ok(buffers.every(buffer => !buffer.destroyed), 'GPU release precedes buffer destruction')
      events.push('unload')
    })
    geometry.on('destroy', () => events.push('destroy'))
    return { mesh, buffers, events }
  })
  return () => {
    for (const { mesh, buffers, events } of resources) {
      assert.equal(mesh.destroyed, true)
      assert.deepEqual(events, ['unload', 'destroy'])
      assert.ok(buffers.every(buffer => buffer.destroyed), 'retired geometry must release every buffer')
    }
  }
}

function ownedMeshes(root: Container): MeshSimple[] {
  return root.children.flatMap(child => child instanceof MeshSimple
    ? [child] : ownedMeshes(child))
}

function secondaryViews(root: Container): NativeSecondaryWorldView {
  const textures = {
    secondary: Object.fromEntries(secondaryAssets.NATIVE_SECONDARY_SPRITE_RECORDS.map(({ atlas, entry }) => [
      secondaryAssets.nativeSecondarySpriteKey(atlas, entry), Texture.EMPTY,
    ])),
    secondarySpecial: { etherPlane: Texture.EMPTY },
  } as PlayerWorldTextures
  const renderer = new WebGLRenderer()
  renderer.render = () => { throw new Error('These mesh fixtures do not require a render target') }
  return new secondaryModule.NativeSecondaryWorldView(root, textures, renderer)
}

function secondaryActor(kind: 'storm-drop' | 'plane-orb-shot' | 'golem'): NativeSecondaryActorState {
  return {
    ageTicks: 100, alpha: 1, damage: 1, enhanced: true,
    endpoint: { x: 140, y: 240 }, frame: 0, freezeTicks: 0,
    golem: kind === 'golem' ? {
      ...nativeInitialGolemArticulation({ x: 100, y: 200 }, 0),
      actionDurationTicks: 0, actionTick: 0, circleSlowTicks: 0, currentHealth: 100, damageMaximum: 8,
      iron: false, maximumHealth: 100, orbitDirection: 0, orbitHeadingRadians: null,
      phase: 'active', poseVariant: 0, provokeRollBound: 1_200, reflectFactor: 0,
      targetPollTicksRemaining: 50,
    } : null,
    hitTargetIds: [], id: 1, kind, lifetimeTicks: 1_000,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 1 }],
    midpoint: { x: 120, y: 180 }, miscLightAppendOrdinal: null, ownerId: 'player',
    phase: -1, position: { x: 100, y: 200 }, presentationRng: null, quantity: 1,
    radius: 400, rank: 1, rotationRadians: 0, scale: 1, skillId: kind === 'golem' ? 45 : 11,
    slowFactor: 0.5, targetId: null, variant: 0, velocity: { x: 1, y: 0 },
    worldKey: 'boneyard:test',
  }
}

function seekerSnapshot(withLoot: boolean): GameSnapshot {
  return {
    tick: 5,
    players: {
      player: {
        position: { x: 0, y: 0 },
        economy: { ownedPerkSelectors: [NATIVE_HAGATHA_SELECTORS.seeker] },
      },
    },
    world: {
      kind: 'boneyard',
      loot: withLoot ? [{ id: 1, kind: 'gold', position: { x: 150, y: 0 } }] : [],
    },
  } as unknown as GameSnapshot
}
