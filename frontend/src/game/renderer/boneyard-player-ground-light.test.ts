import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { Container, RenderTexture, Sprite, Texture, TextureSource, type Renderer, type RenderOptions } from 'pixi.js'
import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import { createNativeDeadSpider } from '../core-kernels/native-dead-spider.ts'
import type { BoneyardSpiderRemainsSnapshot } from '../protocol/spider-state.ts'
import { BoneyardEnvironmentLightView } from './boneyard-environment-light.ts'
import { nativeDirectEnvironmentLightAlpha, WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE } from './boneyard-environment-light-plan.ts'
import { NativeCompactMaskView } from './native-compact-mask-view.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

const FIRE = 0x70615b, ETHER = 0x624e62, WATER = 0x48515d, AIR = 0x7b9090, HAIL = 0xb0b4b4
const BOUNDS = { x: 0, y: 0, w: 1000, h: 800 }
const player = (selectedPrimarySkillId = 16, weldBuildId: number | null = null, x = 400, y = 300) => ({
  position: { x, y }, progression: { selectedPrimarySkillId, weldBuildId },
})

function fixture(t: TestContext, selectors: readonly number[] = [25]) {
  const root = new Container(), ground = new Container(), borrowed: Texture[] = []
  const base: Record<string, Texture> = {}
  for (const entry of [9, 18, 139, 140, 141, 142, 143]) {
    const record = nativeEnemySpriteRecord('DeadHawg', entry)
    const texture = new Texture({ source: new TextureSource({ width: record.width, height: record.height,
      alphaMode: 'no-premultiply-alpha', scaleMode: 'linear' }) })
    base[record.source] = texture
    borrowed.push(texture)
  }
  const calls: { options: RenderOptions; diffuse: number }[] = []
  const renderer: Pick<Renderer, 'render'> = { render(options) {
    assert.ok(options && !(options instanceof Container))
    calls.push({ options, diffuse: NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor })
  } }
  const scene: BoneyardScene = { name: 'ground-light test', environmentMode: 1, bounds: BOUNDS,
    spawn: { x: 400, y: 300, facingDeg: 0 }, objects: [], roads: [], fences: [], terrain: [], solomonDig: null,
    sprites: selectors.map((selector, index) => ({ eid: `compact-${selector}`, atlasEntry: selector,
      pos: { x: 400 + index * 8, y: 300 }, s0: index * 17, s1: 1, s2: 1, flags: index % 2 })),
  }
  const masks = new NativeCompactMaskView(root, ground, renderer, { base }, scene)
  const aperture = new BoneyardEnvironmentLightView(root, base[nativeEnemySpriteRecord('DeadHawg', 18).source]!)
  const sourcesAlive = () => borrowed.every(texture => !texture.destroyed && !texture.source.destroyed)
  t.after(() => {
    masks.destroy(); aperture.destroy()
    assert.ok(sourcesAlive(), 'view retirement must preserve borrowed stock textures')
    root.destroy({ children: true }); ground.destroy({ children: true })
    for (const texture of borrowed) texture.destroy(true)
  })
  return { root, ground, masks, aperture, calls, base, sourcesAlive }
}

function apertureSprite(root: Container, id: string): Sprite {
  const sprite = root.children.find(child => child.label === `boneyard-environment-light:${id}`)
  assert.ok(sprite instanceof Sprite)
  return sprite
}

function maskSprite(root: Container, x = 400, y = 300): Sprite {
  const sprite = root.children.find(child => child.label === 'native-compact-player-mask' && child.x === x && child.y === y)
  assert.ok(sprite instanceof Sprite)
  return sprite
}

test('the aperture updates current primary/Weld/Plane-Orb color on the same retained player sprite', t => {
  const f = fixture(t)
  f.aperture.update({ local: player() }, 1000)
  const retained = apertureSprite(f.root, 'local')
  assert.equal(retained.tint, FIRE)
  for (const [skillId, weldBuildId, expected] of [
    [8, null, ETHER], [52, 1008, HAIL], [80, null, ETHER], [52, 1008, HAIL], [32, null, WATER],
  ] as const) {
    f.aperture.update({ local: player(skillId, weldBuildId) }, 1000)
    assert.equal(apertureSprite(f.root, 'local'), retained)
    assert.equal(retained.tint, expected)
    assert.equal(retained.alpha, nativeDirectEnvironmentLightAlpha(1000, 0))
  }
})

test('the aperture preserves its user-directed 0.14 alpha and per-player flicker independently of RGB', t => {
  const f = fixture(t)
  assert.equal(WEB_DIRECT_ENVIRONMENT_LIGHT_SCALE, 0.14)
  for (const now of [0, 23, 1000, 4123]) {
    f.aperture.update({ fire: player(16), air: player(24, null, 420) }, now)
    assert.equal(apertureSprite(f.root, 'fire').alpha, nativeDirectEnvironmentLightAlpha(now, 0))
    assert.equal(apertureSprite(f.root, 'air').alpha, nativeDirectEnvironmentLightAlpha(now, 1))
    assert.equal(apertureSprite(f.root, 'fire').zIndex, 0)
    assert.equal(apertureSprite(f.root, 'air').zIndex, 2)
  }
})

test('aperture player IDs retain independent colors through reordering, removal and recreation', t => {
  const f = fixture(t)
  f.aperture.update({ fire: player(16), air: player(24, null, 420) }, 1000)
  const fire = apertureSprite(f.root, 'fire'), air = apertureSprite(f.root, 'air')
  assert.equal(fire.tint, FIRE); assert.equal(air.tint, AIR)
  f.aperture.update({ air: player(24, null, 420), fire: player(32) }, 1000)
  assert.equal(apertureSprite(f.root, 'fire'), fire); assert.equal(fire.tint, WATER)
  assert.equal(apertureSprite(f.root, 'air'), air); assert.equal(air.tint, AIR)
  assert.equal(air.zIndex, 0); assert.equal(fire.zIndex, 2)
  f.aperture.update({ air: player(24, null, 420) }, 1000)
  assert.equal(fire.destroyed, true)
  f.aperture.update({ fire: player(52, 1008) }, 1000)
  assert.equal(air.destroyed, true)
  assert.notEqual(apertureSprite(f.root, 'fire'), fire)
  assert.equal(apertureSprite(f.root, 'fire').tint, HAIL)
  assert.ok(f.sourcesAlive())
})

test('compact targets update RGB without reallocating when the same player changes primary or effective Plane Orb', t => {
  const f = fixture(t)
  f.masks.update({ local: player() }, [], BOUNDS, 1000)
  const retained = maskSprite(f.root), target = retained.texture
  assert.ok(target instanceof RenderTexture)
  assert.equal(retained.tint, FIRE)
  const alpha = retained.alpha
  assert.ok(alpha >= Math.fround(.95) && alpha <= 1)
  for (const [skillId, weldBuildId, expected] of [
    [8, null, ETHER], [52, 1008, HAIL], [80, null, ETHER], [52, 1008, HAIL], [32, null, WATER],
  ] as const) {
    f.masks.update({ local: player(skillId, weldBuildId) }, [], BOUNDS, 1000)
    assert.equal(maskSprite(f.root), retained)
    assert.equal(retained.texture, target)
    assert.equal(retained.tint, expected)
    assert.equal(retained.alpha, alpha, 'RGB changes must not consume or alter flicker')
  }
  f.masks.update({ local: player(24, null, 950, 750) }, [], BOUNDS, 1000)
  assert.equal(retained.visible, false)
  f.masks.update({ local: player(24) }, [], BOUNDS, 1000)
  assert.equal(maskSprite(f.root), retained)
  assert.equal(retained.visible, true)
  assert.equal(retained.tint, AIR, 'returning to a mask must not resurrect a stale color')
})

test('all authored compact 139–143 masks keep diffuse alpha and share only the final player tint', t => {
  const f = fixture(t, [25, 26, 27, 28, 29])
  f.masks.update({ local: player() }, [], BOUNDS, 1000)
  assert.equal(f.calls.length, 2)
  const [maskCall, radialCall] = f.calls
  assert.equal(maskCall!.diffuse, 1)
  assert.equal(radialCall!.diffuse, 0)
  assert.equal(maskCall!.options.target, radialCall!.options.target)
  assert.equal(maskCall!.options.clear, true)
  assert.deepEqual(maskCall!.options.clearColor, [1, 1, 1, 0])
  const stamps = maskCall!.options.container
  assert.ok(stamps instanceof Container)
  assert.equal(stamps.children.length, 5)
  for (const [index, child] of stamps.children.entries()) {
    assert.ok(child instanceof Sprite)
    assert.equal(child.texture, f.base[nativeEnemySpriteRecord('DeadHawg', 139 + index).source])
    assert.equal(child.tint, 0xffffff, 'the shared composite owns player RGB, not individual diffuse stamps')
    assert.equal(child.alpha, index === 4 ? 1 : .75)
    assert.equal(child.blendMode, 'add')
  }
  assert.equal(maskSprite(f.root).tint, FIRE)
  assert.equal(maskSprite(f.root).blendMode, 'add')
  assert.equal(NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor, 0)
})

test('independent player targets preserve their own RGB and retire owned surfaces without borrowed-source destruction', t => {
  const f = fixture(t)
  f.masks.update({ fire: player(16), air: player(24, null, 420) }, [], BOUNDS, 1000)
  const fire = maskSprite(f.root), air = maskSprite(f.root, 420), target = fire.texture, source = target.source
  let sourceDestroyEvents = 0
  source.on('destroy', () => { sourceDestroyEvents += 1 })
  assert.notEqual(fire.texture, air.texture)
  assert.equal(fire.tint, FIRE); assert.equal(air.tint, AIR)
  f.masks.update({ air: player(24, null, 420), fire: player(32) }, [], BOUNDS, 1000)
  assert.equal(maskSprite(f.root), fire); assert.equal(fire.tint, WATER)
  assert.equal(maskSprite(f.root, 420), air); assert.equal(air.tint, AIR)
  assert.equal(air.zIndex, 1); assert.equal(fire.zIndex, 3)
  f.masks.update({ air: player(24, null, 420) }, [], BOUNDS, 1000)
  assert.equal(fire.destroyed, true)
  assert.equal(target.destroyed, true)
  assert.equal(source.destroyed, true)
  assert.equal(sourceDestroyEvents, 1)
  f.masks.update({ fire: player(52, 1008) }, [], BOUNDS, 1000)
  assert.equal(air.destroyed, true)
  assert.notEqual(maskSprite(f.root), fire)
  assert.equal(maskSprite(f.root).tint, HAIL)
  assert.ok(f.sourcesAlive())
  f.masks.destroy()
  assert.equal(f.root.children.length, 0)
  assert.ok(f.sourcesAlive())
})

for (const entry of [140, 141, 142] as const) test(`Spider${entry} uses the same colored composite while its ground decal remains borrowed, independently visible and removable`, t => {
  const f = fixture(t, [])
  const state = createNativeDeadSpider({ x: 400, y: 300 }, 0)
  const remains: BoneyardSpiderRemainsSnapshot[] = [{ id: 7, spawnTick: 0, state: { ...state,
    decal: { entry, position: state.position, rotationDeg: 91, scale: .6, alpha: .2 },
  } }]
  f.masks.update({ local: player(32) }, remains, BOUNDS, 1000)
  const composite = maskSprite(f.root), decal = f.ground.children[0]
  assert.ok(decal instanceof Sprite)
  assert.equal(decal.texture, f.base[nativeEnemySpriteRecord('DeadHawg', entry).source])
  assert.equal(decal.alpha, .2)
  assert.equal(decal.tint, 0xffffff)
  assert.equal(composite.tint, WATER)
  f.masks.update({ local: player(24) }, [], BOUNDS, 1000)
  assert.equal(decal.destroyed, true)
  assert.equal(f.ground.children.length, 0)
  assert.equal(composite.visible, false)
  f.masks.update({ local: player(24) }, remains, BOUNDS, 1000)
  assert.equal(maskSprite(f.root), composite)
  assert.equal(composite.tint, AIR)
  assert.notEqual(f.ground.children[0], decal)
  assert.ok(f.sourcesAlive())
})
