import assert from 'node:assert/strict'
import test from 'node:test'

import { Container, Texture } from 'pixi.js'

import { buildBoneyardPainterOrder } from '../boneyard-painter-order.ts'
import {
  EARTH_BOULDER_AURA_RECORD,
  EARTH_BOULDER_AURA_SCALE,
  EARTH_BOULDER_DEPTH_PLANE,
  EARTH_BOULDER_DRAW_SCALE_MINIMUM,
  EARTH_BOULDER_MAIN_RECORDS,
  EARTH_BOULDER_OPENING_FLASH_RECORD,
  EARTH_BOULDER_OPENING_FLASH_SCALE,
  EARTH_BOULDER_OPENING_FADE_PER_TICK,
  EARTH_BOULDER_LIT_RECORDS,
  earthBoulderImpactPlan,
  earthBoulderPresentationPlan,
} from './earth-boulder-presentation.ts'
import {
  earthImpactFragmentsAtAge,
  earthImpactLifetimeTicks,
} from '../core-kernels/primary-spell-earth.ts'
import {
  EARTH_BOULDER_IDENTITY_ORIENTATION,
  earthBoulderFlightOrientationStep,
  earthBoulderHeldOrientationStep,
  type EarthBoulderOrientation,
} from '../core-kernels/primary-spell-earth-orientation.ts'
import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const WORLD_KEY = 'boneyard:test'

function held(
  ageTicks: number,
  charge: number,
  id = 17,
  assemblyCharge = charge,
  orientation: EarthBoulderOrientation = EARTH_BOULDER_IDENTITY_ORIENTATION,
) {
  return earthBoulderPresentationPlan({
    ageTicks,
    assemblyCharge,
    charge,
    flightTicks: 0,
    id,
    orientation,
    phase: 'held' as const,
  })
}

test('Earth constructs the native center rock and Fibonacci shell counts', () => {
  const initial = held(1, Math.fround(0.18))
  const release = held(97, Math.fround(0.3012498915195465))
  const full = held(656, 1)

  assert.equal(initial.rocks.length, 7)
  assert.equal(release.rocks.length, 11)
  assert.equal(full.rocks.length, 31)
  const center = initial.rocks.find((rock) => rock.shellIndex === null)
  assert.ok(center)
  assert.deepEqual(center.local, { x: 0, y: 0, z: 0 })
  assert.equal(center.record, 171)
  assert.equal(center.scale, 4 * Math.fround(0.18))
  assert.equal(center.storedScale, center.scale)

  const n = 30 * Math.fround(0.18)
  const expectedY = (-1 + 1 / n) * n
  const firstShell = initial.rocks.find((rock) => rock.shellIndex === 0)
  assert.ok(firstShell)
  assert.ok(Math.abs(firstShell.local.y - expectedY) < 1e-9)
  assert.ok(initial.rocks.every((rock) => EARTH_BOULDER_MAIN_RECORDS.includes(rock.record)))
  assert.deepEqual(held(1, Math.fround(0.18)), initial)
})

test('Earth renders the authoritative matrix and keeps spinning through released flight', () => {
  const charge = Math.fround(0.3012498915195465)
  let heldMatrix: EarthBoulderOrientation = EARTH_BOULDER_IDENTITY_ORIENTATION
  for (let tick = 0; tick < 97; tick += 1) {
    heldMatrix = earthBoulderHeldOrientationStep(heldMatrix, { x: 0, y: -1 })
  }
  const heldPlan = held(97, charge, 17, charge, heldMatrix)
  const flightMatrix = earthBoulderFlightOrientationStep(
    heldMatrix,
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    charge,
  )
  const released = earthBoulderPresentationPlan({
    ageTicks: 98,
    assemblyCharge: charge,
    charge,
    flightTicks: 1,
    id: 17,
    orientation: flightMatrix,
    phase: 'flight',
  })

  assert.deepEqual(released.orientation, flightMatrix)
  assert.notDeepEqual(released.rocks, heldPlan.rocks)
  for (let index = 1; index < released.rocks.length; index += 1) {
    assert.ok(released.rocks[index - 1].transformed.z <= released.rocks[index].transformed.z)
  }
})

test('rank-1 shell stays in front of the native depth plane and projects X/Y orthographically', () => {
  for (let ageTicks = 0; ageTicks <= 480; ageTicks += 1) {
    const plan = held(ageTicks, 1)
    assert.equal(plan.rocks.length, 31)
    for (const rock of plan.rocks) {
      assert.ok(rock.transformed.z > EARTH_BOULDER_DEPTH_PLANE)
      assert.deepEqual(rock.position, {
        x: rock.transformed.x,
        y: rock.transformed.y,
      })
    }
  }
})

test('main rocks use the native float32 draw-scale floor', () => {
  const opening = held(1, Math.fround(0.18))
  const clamped = opening.rocks.filter((rock) => rock.storedScale < EARTH_BOULDER_DRAW_SCALE_MINIMUM)

  assert.ok(clamped.length > 0)
  assert.ok(clamped.every((rock) => rock.scale === EARTH_BOULDER_DRAW_SCALE_MINIMUM))
  assert.ok(opening.rocks.every((rock) => (
    rock.scale === Math.max(EARTH_BOULDER_DRAW_SCALE_MINIMUM, rock.storedScale)
  )))
})

test('Earth holds its Rock collection stable between native rebuild buckets', () => {
  const rebuilt = held(12, Math.fround(0.2001), 17, Math.fround(0.18))
  const interpolated = held(12.5, Math.fround(0.215), 17, Math.fround(0.18))
  const nextBucket = held(13, Math.fround(0.22), 17, Math.fround(0.22))

  const storedAssembly = (plan: ReturnType<typeof held>) => plan.rocks.map((rock) => ({
    local: rock.local,
    record: rock.record,
    shellIndex: rock.shellIndex,
    storedScale: rock.storedScale,
  }))
  assert.deepEqual(storedAssembly(interpolated), storedAssembly(rebuilt))
  assert.equal(rebuilt.rocks.length, 7)
  assert.equal(nextBucket.rocks.length, 8)
  assert.equal(
    rebuilt.rocks.find(({ shellIndex }) => shellIndex === null)?.storedScale,
    4 * Math.fround(0.18),
  )
})

test('record 15 persists while additive record 86 opens and body crossfades in', () => {
  const opening = held(0, Math.fround(0.18))
  const middle = held(10, Math.fround(0.18))
  const mature = held(29, Math.fround(0.18))

  assert.equal(opening.aura.record, EARTH_BOULDER_AURA_RECORD)
  assert.equal(opening.aura.scale, EARTH_BOULDER_AURA_SCALE * Math.fround(0.18))
  assert.ok(opening.aura.alpha >= 0.35 && opening.aura.alpha < 0.6)
  assert.equal(mature.aura.record, EARTH_BOULDER_AURA_RECORD)
  assert.ok(mature.aura.alpha >= 0.35 && mature.aura.alpha < 0.6)
  assert.equal(opening.openingFlash.record, EARTH_BOULDER_OPENING_FLASH_RECORD)
  assert.equal(opening.openingFlash.alpha, 1)
  assert.equal(opening.openingFlash.scale, EARTH_BOULDER_OPENING_FLASH_SCALE)
  assert.equal(opening.openingFlash.rotation, 0)
  assert.equal(opening.bodyAlpha, 0)
  assert.equal(
    middle.openingFlash.alpha,
    1 - 10 * EARTH_BOULDER_OPENING_FADE_PER_TICK,
  )
  assert.equal(
    middle.openingFlash.scale,
    EARTH_BOULDER_OPENING_FLASH_SCALE * middle.openingFlash.alpha,
  )
  assert.equal(middle.openingFlash.rotation, 10 * 6 * Math.PI / 180)
  assert.equal(middle.bodyAlpha, 10 * EARTH_BOULDER_OPENING_FADE_PER_TICK)
  assert.equal(mature.openingFlash.alpha, 0)
  assert.equal(mature.bodyAlpha, 1)
})

test('Earth applies the native charge lift, jitter domain, and dynamic painter bias', () => {
  const plan = held(97, Math.fround(0.3012498915195465))

  assert.ok(Math.hypot(plan.jitter.x, plan.jitter.y) < 3)
  assert.equal(
    plan.visualOffset.y,
    -20 - 32.5 * Math.fround(0.3012498915195465) + plan.jitter.y,
  )
  assert.equal(plan.visualOffset.x, plan.jitter.x)
  assert.equal(
    plan.sortBias,
    (20 + 10 * Math.fround(0.3012498915195465))
      * Math.fround(0.3012498915195465) * 1.5,
  )
})

test('Earth draw-time jitter changes without mutating an authoritative shell matrix', () => {
  const state = {
    ageTicks: 12,
    assemblyCharge: Math.fround(0.18),
    charge: Math.fround(0.2),
    flightTicks: 0,
    id: 17,
    orientation: EARTH_BOULDER_IDENTITY_ORIENTATION,
    phase: 'held' as const,
  }
  const first = earthBoulderPresentationPlan(state, 100)
  const second = earthBoulderPresentationPlan(state, 101)

  assert.deepEqual(second.rocks, first.rocks)
  assert.notDeepEqual(second.jitter, first.jitter)
  assert.ok(Math.abs(
    second.openingFlash.rotation - first.openingFlash.rotation - 6 * Math.PI / 180,
  ) < 1e-12)
})

test('Earth impact uses the exact fragment domains and recurrent angle distribution', () => {
  const minimumState = { ageTicks: 0, birthTick: 40, charge: Math.fround(0.18), id: 17 }
  const fullState = { ageTicks: 0, birthTick: 40, charge: 1, id: 17 }
  const minimum = earthBoulderImpactPlan(minimumState)
  const full = earthBoulderImpactPlan(fullState)

  assert.equal(minimum.fragments.length, 8)
  assert.equal(full.fragments.length, 30)
  assert.ok(full.fragments.every((fragment) => EARTH_BOULDER_LIT_RECORDS.includes(fragment.record)))
  assert.deepEqual(earthBoulderImpactPlan(fullState), full)
  assert.ok(full.fragments.every(({ alpha, height, position, scale }) => (
    alpha === 1
    && height <= 0
    && height >= -50
    && Math.hypot(position.x, position.y / 0.8) <= 45
    && scale <= 0.75
  )))

  const directions = full.fragments.map(({ position }) => (
    Math.atan2(position.y / 0.8, position.x) * 180 / Math.PI + 360
  ) % 360)
  for (let index = 1; index < directions.length; index += 1) {
    const delta = (directions[index] - directions[index - 1] + 360) % 360
    assert.ok(delta >= 8 && delta <= 16)
  }
})

test('Earth fragments obey the global modulo-three motion and two-stage fade', () => {
  const seed = { birthTick: 2, charge: 1, id: 17 }
  const born = earthImpactFragmentsAtAge(seed, 0)
  const skipped = earthImpactFragmentsAtAge(seed, 1)
  const moved = earthImpactFragmentsAtAge(seed, 2)
  assert.deepEqual(skipped.map(({ position }) => position), born.map(({ position }) => position))
  assert.equal(skipped[0].alpha, Math.fround(10 - Math.fround(0.025)))
  assert.notDeepEqual(moved.map(({ position }) => position), skipped.map(({ position }) => position))
  assert.equal(
    moved[0].alpha,
    Math.fround(Math.fround(skipped[0].alpha - Math.fround(0.015)) - Math.fround(0.025)),
  )

  let settledAge = 1
  while (!earthImpactFragmentsAtAge(seed, settledAge).some(({ height }) => height === 0)) {
    settledAge += 1
  }
  while ((seed.birthTick + settledAge + 1) % 3 !== 0) settledAge += 1
  const settled = earthImpactFragmentsAtAge(seed, settledAge)
  const next = earthImpactFragmentsAtAge(seed, settledAge + 1)
  const stopped = settled.find(({ height }) => height === 0)
  assert.ok(stopped)
  const stoppedNext = next.find(({ index }) => index === stopped.index)
  assert.ok(stoppedNext)
  assert.equal(stoppedNext.height, 0)
  assert.equal(
    stoppedNext.alpha,
    Math.fround(Math.fround(stopped.alpha - Math.fround(0.015)) - Math.fround(0.025)),
  )

  const lifetimeTicks = earthImpactLifetimeTicks(seed)
  assert.ok(earthImpactFragmentsAtAge(seed, lifetimeTicks - 1).length > 0)
  assert.equal(earthImpactFragmentsAtAge(seed, lifetimeTicks).length, 0)
})

test('Earth actors publish independent full-suffix painter and light roots', () => {
  const root = new Container()
  const view = new PrimarySpellWorldView(root, worldTextures())
  view.update(worldFixture(), WORLD_KEY)
  const layers = view.painterLayers()
  const body = layers.find(({ id }) => id === 'primary-spell:1')
  const called = layers.find(({ id }) => id === 'primary-spell:3')
  const fragments = layers.filter(({ id }) => id.startsWith('primary-spell:2:fragment-'))

  assert.deepEqual(body?.regionLightPoint, { x: 100, y: 200 })
  assert.equal(body?.sortBias, 45)
  assert.equal(called?.regionLightPoint, null)
  assert.equal(fragments.length, 30)
  assert.deepEqual(
    fragments.map(({ id }) => id),
    Array.from({ length: 30 }, (_, index) => `primary-spell:2:fragment-${index}`),
  )
  assert.ok(fragments.every(({ regionLightPoint, sortBias }) => (
    regionLightPoint !== null && sortBias === -15
  )))
  assert.equal(root.children.length, 32)

  const firstRoot = root.children.find(({ label }) => label === 'earth-impact-fragment-0')
  const secondRoot = root.children.find(({ label }) => label === 'earth-impact-fragment-1')
  const calledRoot = root.children.find(({ label }) => label === 'earth-called-rock')
  const boulderRoot = root.children.find(({ label }) => label === 'earth')
  assert.ok(firstRoot && secondRoot && calledRoot && boulderRoot)
  assert.equal(calledRoot.children.length, 2)
  const calledBase = calledRoot.children[0]
  const calledMain = calledRoot.children[1]
  assert.equal(calledBase.renderable, true)
  assert.equal(calledBase.position.y, 0)
  assert.equal(calledBase.scale.x, 0.2 * 0.75)
  assert.equal(calledMain.position.y, -8)
  assert.equal(calledMain.scale.x, 0.2)
  const calledDepth = calledRoot.zIndex
  view.promoteOwnerOverlays((ownerId) => ownerId === 'wizard' ? 500 : undefined)
  assert.equal(boulderRoot.zIndex, 1245)
  assert.ok(boulderRoot.zIndex > 500)
  assert.equal(calledRoot.zIndex, calledDepth)
  view.setTint('primary-spell:2:fragment-0', 0x123456)
  assert.equal(firstRoot.children[0].tint, 0x123456)
  assert.equal(secondRoot.children[0].tint, 0xffffff)
  view.setTint('primary-spell:3', 0x123456)
  assert.equal(calledRoot.children[0].tint, 0xffffff)
  view.setDepth('primary-spell:2:fragment-1', 999)
  assert.equal(secondRoot.zIndex, 999)
  assert.notEqual(firstRoot.zIndex, 999)

  const landed = worldFixture()
  landed.transients = landed.transients.map((effect) => (
    effect.kind === 'earth-called-rock' ? { ...effect, height: 0 } : effect
  ))
  view.update(landed, WORLD_KEY)
  assert.equal(calledBase.renderable, false)

  view.update({ nextId: 4, projectiles: [], transients: [] }, WORLD_KEY)
  assert.equal(root.children.length, 0)
  assert.equal(view.count, 0)
  view.destroy()
})

test('independent fragment roots interleave with unrelated global painter actors', () => {
  const root = new Container()
  const view = new PrimarySpellWorldView(root, worldTextures())
  view.update(worldFixture(), WORLD_KEY)
  const fragments = view.painterLayers()
    .filter(({ id }) => id.startsWith('primary-spell:2:fragment-'))
    .sort((left, right) => (
      left.worldY + left.sortBias - right.worldY - right.sortBias
    ))
  const low = fragments[0]
  const high = fragments.at(-1)!
  assert.ok(high.worldY + high.sortBias - low.worldY - low.sortBias > 4)
  const enemyY = (
    low.worldY + low.sortBias + high.worldY + high.sortBias
  ) / 2
  const order = buildBoneyardPainterOrder({
    referenceY: 0,
    staticLayers: [],
    dynamicLayers: [
      ...fragments,
      { id: 'enemy:test', sortBias: 0, sourceOrder: fragments.length, worldY: enemyY },
    ],
  }).dynamicLayers.map(({ id }) => id)
  assert.ok(order.indexOf(low.id) < order.indexOf('enemy:test'))
  assert.ok(order.indexOf('enemy:test') < order.indexOf(high.id))
  view.destroy()
})

function worldFixture(): PrimarySpellSimulationState {
  const impactSeed = { birthTick: 40, charge: 1, id: 2 }
  return {
    nextId: 4,
    projectiles: [{
      ageTicks: 30,
      assemblyCharge: 1,
      charge: 1,
      damage: 10,
      direction: { x: 0, y: -1 },
      flightTicks: 0,
      hitTargetIds: [],
      id: 1,
      kind: 'earth',
      maximumCharge: 1,
      orientation: [...EARTH_BOULDER_IDENTITY_ORIENTATION],
      ownerId: 'wizard',
      phase: 'held',
      position: { x: 100, y: 200 },
      remainingDamage: 10,
      toughness: 1,
      velocity: { x: 0, y: 0 },
      worldKey: WORLD_KEY,
    }],
    transients: [{
      ageTicks: 0,
      ...impactSeed,
      kind: 'earth-impact',
      lifetimeTicks: earthImpactLifetimeTicks(impactSeed),
      origin: { x: 300, y: 400 },
      ownerId: 'wizard',
      worldKey: WORLD_KEY,
    }, {
      ageTicks: 4,
      falling: false,
      fallVelocity: 0,
      height: -8,
      id: 3,
      kind: 'earth-called-rock',
      lateralMagnitude: 2,
      ownerId: 'wizard',
      parentId: 1,
      position: { x: 150, y: 250 },
      rotation: 45,
      rotationStep: 8,
      scale: 0.2,
      speed: 0.3,
      targetHeight: -50,
      variant: 1,
      worldKey: WORLD_KEY,
    }],
  }
}

function worldTextures(): PlayerWorldTextures {
  return {
    primarySpells: {
      earth: {
        aura: Texture.EMPTY,
        litRocks: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
        openingFlash: Texture.EMPTY,
        rocks: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
      },
    },
  } as PlayerWorldTextures
}
