import assert from 'node:assert/strict'
import test from 'node:test'

import { Container, Shader, Sprite, Texture } from 'pixi.js'

import type {
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
  PrimarySpellWaterTransientState,
} from '../core-kernels/primary-spells.ts'
import { waterFrostJetKind, waterFrostJetPlan } from '../core-kernels/primary-spell-water.ts'
import {
  NATIVE_AIR_WATER_ACTOR_KINDS,
  isNativeAirWaterActorState,
} from './primary-spell-air-water-actor-view.ts'
import {
  NATIVE_AIR_WATER_SPRITES,
  NATIVE_WATER_AURA_SAFE_ALPHA_TRIM,
  nativeHurricaneVisualPlan,
  nativeHailVisualPlan,
  nativeWaterAuraVisualPlan,
} from './primary-spell-air-water-native.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import { WaterPrimarySpellView } from './primary-spell-water-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const WORLD_KEY = 'boneyard:air-water-view'

test('Frost painter queries keep the geometry and lane of the drawn update', () => {
  for (const id of [normalWaterId(1), overWaterId(1)]) {
    for (const underpowered of [false, true]) {
      const view = new WaterPrimarySpellView(
        { ...water(id), underpowered },
        { core: Texture.EMPTY, glint: Texture.EMPTY },
      )
      for (const ageTicks of [0, 1, 7, 15, 30]) {
        const state = { ...water(id), ageTicks, underpowered }
        const plan = waterFrostJetPlan(state)
        view.update(state)
        const first = view.painterRoots()[0]!
        assert.equal(first.worldY, plan.worldY)
        assert.equal(view.worldY, plan.worldY)
        assert.equal(first.lane, plan.kind === 'normal' ? 'world-sorted' : 'post-world-queue')
        assert.equal(first.queueFamily, plan.kind === 'normal' ? 'zanim' : null)
        assert.deepEqual(
          { x: view.container.x, y: view.container.y },
          plan.position,
        )
        for (const [index, pass] of ['core', 'additive-core', 'glint'].entries()) {
          const sprite = view.container.children[index]!
          assert.ok(sprite instanceof Sprite)
          const draw = plan.draws.find(candidate => candidate.pass === pass)
          assert.equal(sprite.visible, draw !== undefined)
          if (draw) {
            assert.equal(sprite.rotation, draw.rotation)
            assert.equal(sprite.scale.x, draw.scale)
          }
        }
        assert.deepEqual(view.painterRoots()[0], first)
      }
      view.destroy()
      assert.equal(view.container.destroyed, true)
    }
  }
})

test('Air/Water world view routes all three primary-owned actors through stock textures', () => {
  const root = new Container()
  const view = new PrimarySpellWorldView(root, worldTextures())
  const spells = actorFixture()
  view.update(spells, WORLD_KEY, 100)
  assert.equal(root.children.length, 3)
  assert.deepEqual(root.children.map(({ label }) => label), NATIVE_AIR_WATER_ACTOR_KINDS)
  assert.deepEqual(root.children.map(({ children }) => children.length), [17, 1, 1])
  assert.equal(view.count, 3)
  assert.ok(root.children.every(({ children }) => children.some(({ visible }) => visible)))
  const hurricane = visibleSprites(root.children[0]!)
  assert.equal(hurricane.length, 17)
  assert.equal(hurricane[0]!.label, 'DeadHawg:15')
  assert.ok(hurricane.slice(1).every(({ label }) => label === 'BadGuys:84'))

  view.promoteOwnerOverlays((ownerId) => ownerId === 'wizard' ? 2_000 : undefined)
  assert.equal(root.children[0]!.zIndex, 2_000.5)
  const hail = visibleSprites(root.children[2]!).find(({ label }) => label === 'BadGuys:32')
  assert.ok(hail)
  assert.equal(hail.anchor.x, 9.5 / 19)
  assert.equal(hail.anchor.y, 11 / 20)

  view.update({ nextId: 4, projectiles: [], transients: [] }, WORLD_KEY)
  assert.equal(root.children.length, 0)
  view.destroy()
})

test('Boneyard Air/Water mesh retains every actor row and exact painter partition', () => {
  const root = new Container()
  const view = PrimarySpellWorldView.forBoneyard(root, worldTextures(), testShader())
  view.update(actorFixture(), WORLD_KEY, 100)
  assert.deepEqual(view.painterLayers().map(({ id }) => id), [
    'primary-spell:1',
    'primary-spell:2',
    'primary-spell:3',
  ])
  view.applyBoneyardPainterDepths([
    { id: 'primary-spell:1', row: 1, zIndex: 1 },
    { id: 'primary-spell:2', row: 2, zIndex: 2 },
    { id: 'primary-spell:3', row: 30, zIndex: 30 },
  ], 40)
  assert.equal(view.count, 3)
  assert.equal(view.hailMeshCount, 1)
  assert.equal(view.hailMeshRunCount, 2)
  assert.equal(view.waterMeshActorCount, 2)
  assert.equal(view.waterAuraMeshCount, 1)
  assert.equal(view.waterMeshNormalFrostCount, 0)
  assert.equal(view.waterMeshRunCount, 2)
  assert.equal(root.children.filter(({ label }) => label === 'water-hail').length, 0)
  assert.equal(root.children.filter(({ label }) => label.startsWith('primary-water-mesh-run')).length, 2)

  view.update({ nextId: 4, projectiles: [], transients: [] }, WORLD_KEY)
  view.applyBoneyardPainterDepths([], 1)
  assert.equal(view.count, 0)
  assert.equal(view.hailMeshCount, 0)
  assert.equal(view.hailMeshRunCount, 0)
  assert.equal(view.waterAuraMeshCount, 0)
  view.destroy()
  assert.equal(root.children.length, 0)
})

test('Boneyard Water mesh owns normal Frost while Frost-over retains its post-world view', () => {
  const root = new Container()
  const view = PrimarySpellWorldView.forBoneyard(root, worldTextures(), testShader())
  const normal = water(normalWaterId(10))
  const over = water(overWaterId(10))
  view.update({ nextId: 100, projectiles: [], transients: [normal, over] }, WORLD_KEY, 100)
  const layers = view.painterLayers()
  assert.deepEqual(layers.map(({ id }) => id), [
    `primary-spell:${normal.id}`,
    `primary-spell:${over.id}`,
  ])
  assert.equal(layers[0]!.meshActorId, normal.id)
  assert.equal(layers[0]!.queueFamily, 'zanim')
  assert.equal(layers[1]!.meshActorId, undefined)
  assert.equal(layers[1]!.lane, 'post-world-queue')
  view.applyBoneyardPainterDepths([
    { id: `primary-spell:${normal.id}`, row: 1, zIndex: 1 },
  ], 30)
  assert.equal(view.waterMeshActorCount, 1)
  assert.equal(view.waterMeshNormalFrostCount, 1)
  assert.equal(view.waterMeshRunCount, 1)
  assert.equal(root.children.filter(({ label }) => label === 'water').length, 1)
  assert.equal(root.children.filter(({ label }) => label.startsWith('primary-water-mesh-run')).length, 1)
  view.destroy()
  assert.equal(root.children.length, 0)
})

test('Air/Water type guard rejects unrelated primary transients', () => {
  for (const actor of actorFixture().transients) {
    assert.equal(isNativeAirWaterActorState(actor), true)
  }
  assert.equal(isNativeAirWaterActorState({
    ageTicks: 0,
    id: 99,
    kind: 'fire-impact',
    lightRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    worldKey: WORLD_KEY,
  }), false)
})

test('Hail and Cold Aura plans retain their authoritative motion fields', () => {
  assert.deepEqual(nativeHailVisualPlan({
    height: -5,
    life: 1.5,
    rotationDegrees: 90,
    scale: 2,
  }), {
    alpha: 1,
    offsetY: -5,
    rotationRadians: Math.PI / 2,
    scale: 2,
  })
  assert.deepEqual(nativeWaterAuraVisualPlan({
    ageTicks: 25,
    alphaDecay: Math.fround(0.15 / 720),
    initialRotationDegrees: 90,
    rotationStepDegrees: 0.5,
  }), {
    alpha: Math.max(0, Math.fround(0.5 - 25 * Math.fround(0.15 / 720))),
    rotationRadians: 102.5 * Math.PI / 180,
    scale: repeatedFloatScale(1.0149999856948853, 25),
    tint: 0x80ffff,
  })
  assert.equal(NATIVE_AIR_WATER_SPRITES.hail.entry, 32)
  assert.equal(NATIVE_AIR_WATER_SPRITES.coldAura.entry, 14)
  assert.equal(NATIVE_AIR_WATER_SPRITES.hurricaneCore.entry, 15)
  assert.equal(NATIVE_AIR_WATER_SPRITES.hurricaneCore.atlas, 'DeadHawg')
  assert.equal(NATIVE_AIR_WATER_SPRITES.hurricaneLane.entry, 84)
  assert.deepEqual(NATIVE_WATER_AURA_SAFE_ALPHA_TRIM, {
    height: 60,
    width: 63,
    x: 0,
    y: 2,
  })
  for (const ageTicks of [200, 0, 100, 200]) {
    assert.equal(nativeWaterAuraVisualPlan({
      ageTicks,
      alphaDecay: Math.fround(0.15 / 720),
      initialRotationDegrees: 90,
      rotationStepDegrees: 0.5,
    }).scale, repeatedFloatScale(1.0149999856948853, ageTicks))
  }
})

test('Hurricane painter owns the stock core and both enhanced/low lane branches', () => {
  const enhanced = nativeHurricaneVisualPlan({
    charge: 0.5,
    enhancedEffects: true,
    lanes: hurricaneLanes(),
    phaseDegrees: 10,
  })
  assert.equal(enhanced.length, 17)
  assert.deepEqual(enhanced[0], {
    alpha: Math.fround(0.5 * 0.75),
    blend: 'normal',
    position: { x: 0, y: -15 },
    role: 'core',
    rotationRadians: 15 * Math.PI / 180,
    scale: { x: 5, y: 4 },
    tint: 0xf2ffff,
  })
  assert.equal(enhanced.filter(({ role }) => role === 'lane').length, 8)
  assert.equal(enhanced.filter(({ role }) => role === 'lane-copy').length, 8)
  const low = nativeHurricaneVisualPlan({
    charge: 0.5,
    enhancedEffects: false,
    lanes: hurricaneLanes(),
    phaseDegrees: 10,
  })
  assert.equal(low.length, 5)
  assert.deepEqual(low.slice(1).map(({ rotationRadians }) => rotationRadians), [
    0, 20, 40, 60,
  ].map((angle) => angle * Math.PI / 180))
})

function actorFixture(): PrimarySpellSimulationState {
  const common = { ageTicks: 1, birthTick: 0, ownerId: 'wizard', worldKey: WORLD_KEY }
  const transients: PrimarySpellTransientState[] = [{
    ...common,
    charge: 0.5,
    contactCharge: 0.4,
    damageMaximum: 20,
    damageMinimum: 10,
    enhancedEffects: true,
    id: 1,
    kind: 'air-hurricane',
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 1 }],
    lanes: hurricaneLanes(),
    phaseDegrees: 10,
    position: { x: 10, y: 20 },
  }, {
    ...common,
    alphaDecay: Math.fround(0.15 / 720),
    durationTicks: 2_400,
    id: 2,
    initialRotationDegrees: 90,
    kind: 'water-aura',
    origin: { x: 70, y: 80 },
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 2 }],
    rotationStepDegrees: 0.5,
  }, {
    ...common,
    bounceProgress: 0.2,
    bounceSoundIndex: null,
    bounceSoundPitch: null,
    bounceSoundSequence: 0,
    height: -5,
    horizontalVelocity: { x: 1, y: 0 },
    id: 3,
    kind: 'water-hail',
    life: 1.5,
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 3 }],
    position: { x: 80, y: 90 },
    rotationDegrees: 45,
    rotationStepDegrees: 2,
    savedBounceVelocity: -2,
    scale: 1.5,
    verticalVelocity: 0,
  }]
  return { nextId: 4, projectiles: [], transients }
}

function repeatedFloatScale(factor: number, count: number): number {
  let value = Math.fround(1)
  for (let index = 0; index < count; index += 1) value = Math.fround(value * factor)
  return value
}

function worldTextures(): PlayerWorldTextures {
  return {
    primarySpells: {
      air: {
        branches: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
        circle: Texture.EMPTY,
        forks: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
        ribbon: Texture.EMPTY,
      },
      airWaterActors: {
        coldAura: Texture.EMPTY,
        hail: Texture.EMPTY,
        hurricaneCore: Texture.EMPTY,
        hurricaneLane: Texture.EMPTY,
      },
      frost: {
        core: Texture.EMPTY,
        over: Texture.EMPTY,
      },
    },
  } as unknown as PlayerWorldTextures
}

function water(id: number): PrimarySpellWaterTransientState {
  return {
    ageTicks: 1,
    direction: { x: 1, y: 0 },
    id,
    kind: 'water',
    lightRegistration: null,
    obstructionDistance: null,
    obstructionPoint: null,
    origin: { x: 10, y: 20 },
    ownerId: 'wizard',
    painterRegistrations: [{ managerLane: 'transient', registrationOrdinal: id + 100 }],
    speed: 4,
    underpowered: false,
    variant: 0,
    worldKey: WORLD_KEY,
  }
}

function normalWaterId(first: number): number {
  let id = first
  while (waterFrostJetKind(id) !== 'normal') id += 1
  return id
}

function overWaterId(first: number): number {
  let id = first
  while (waterFrostJetKind(id) !== 'over') id += 1
  return id
}

function hurricaneLanes() {
  return Array.from({ length: 8 }, (_, index) => Object.freeze({
    angleDegrees: index * 10,
    angularVelocityDegrees: 10 * 0.75 ** index,
    radius: 1.5 * 1.2 ** index,
    verticalOffset: index,
  }))
}

function visibleSprites(container: Container): Sprite[] {
  return container.children.filter((child): child is Sprite => (
    child instanceof Sprite && child.visible
  ))
}

function testShader(): Shader {
  return new Shader({ resources: {} } as unknown as ConstructorParameters<typeof Shader>[0])
}
