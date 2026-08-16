import assert from 'node:assert/strict'
import test from 'node:test'

import { Container, Sprite, Texture } from 'pixi.js'

import type {
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  NATIVE_AIR_WATER_ACTOR_KINDS,
  isNativeAirWaterActorState,
} from './primary-spell-air-water-actor-view.ts'
import {
  NATIVE_AIR_WATER_SPRITES,
  nativeHailVisualPlan,
  nativeWaterAuraVisualPlan,
} from './primary-spell-air-water-native.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const WORLD_KEY = 'boneyard:air-water-view'

test('Air/Water world view routes all three primary-owned actors through stock textures', () => {
  const root = new Container()
  const view = new PrimarySpellWorldView(root, worldTextures())
  const spells = actorFixture()
  view.update(spells, WORLD_KEY, 100)
  assert.equal(root.children.length, 3)
  assert.deepEqual(root.children.map(({ label }) => label), NATIVE_AIR_WATER_ACTOR_KINDS)
  assert.equal(view.count, 3)
  assert.ok(root.children.every(({ children }) => children.some(({ visible }) => visible)))

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
})

function actorFixture(): PrimarySpellSimulationState {
  const common = { ageTicks: 1, birthTick: 0, ownerId: 'wizard', worldKey: WORLD_KEY }
  const transients: PrimarySpellTransientState[] = [{
    ...common,
    charge: 0.5,
    id: 1,
    kind: 'air-hurricane',
    position: { x: 10, y: 20 },
  }, {
    ...common,
    alphaDecay: Math.fround(0.15 / 720),
    durationTicks: 2_400,
    id: 2,
    initialRotationDegrees: 90,
    kind: 'water-aura',
    origin: { x: 70, y: 80 },
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
      },
    },
  } as unknown as PlayerWorldTextures
}

function visibleSprites(container: Container): Sprite[] {
  return container.children.filter((child): child is Sprite => (
    child instanceof Sprite && child.visible
  ))
}
