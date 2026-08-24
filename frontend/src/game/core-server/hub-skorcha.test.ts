import assert from 'node:assert/strict'
import test from 'node:test'

import { HUB_PRIVATE_ROOM_LAYOUTS } from '../core-kernels/hub-private-room-layout.ts'
import { NATIVE_HUB_NPC_CATALOG } from '../core-kernels/native-hub-npc.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createPlayerCharacter } from '../core-kernels/player-character.ts'
import {
  createHubSkorcha,
  createHubSkorchaAtVariant,
  createHubSkorchaPopulation,
  drawHubSkorchaPopulation,
  hubSkorchaHatFrame,
  stepHubSkorcha,
  type HubSkorchaState,
} from './hub-skorcha.ts'
import {
  HUB_FIXED_ACTOR_COLLISION_LAYOUT,
  addHubParticipant,
  createHubWorld,
  removeHubParticipant,
  stepHubWorldTick,
} from './hub-world.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

test('Semicus and Machinimbus are unconditional fixed survival-Hub actors', () => {
  assert.deepEqual(HUB_PRIVATE_ROOM_LAYOUTS.library.actors.librarian?.collider, {
    kind: 'circle',
    position: { x: 512, y: 595 },
    radius: 55,
  })
  assert.ok(HUB_FIXED_ACTOR_COLLISION_LAYOUT.some((actor) => (
    actor.id === 'teacher'
    && actor.region === 'courtyard'
    && actor.position.x === 576.5
    && actor.position.y === 710.5
    && actor.radius === 25
  )))
})

test('the authoritative population generator reaches absence and every exact Skorcha placement', () => {
  assert.deepEqual(NATIVE_HUB_NPC_CATALOG.skorcha.placements, [
    { variant: 0, x: 1437.5, y: 732.5 },
    { variant: 1, x: 1637, y: 403.5 },
    { variant: 2, x: 669, y: 705.5 },
  ])
  let absent = false
  const variants = new Map<number, HubSkorchaState>()
  for (let seed = 0; seed < 10_000 && (!absent || variants.size < 3); seed += 1) {
    const state = createHubSkorcha(seed)
    if (state === null) absent = true
    else variants.set(state.variant, state)
  }
  assert.equal(absent, true)
  assert.deepEqual([...variants.keys()].sort(), [0, 1, 2])
  for (const [variant, state] of variants) {
    const placement = NATIVE_HUB_NPC_CATALOG.skorcha.placements[variant]!
    assert.deepEqual(state.position, { x: placement.x, y: placement.y })
    assert.ok(state.gesture >= 0 && state.gesture < 3)
    assert.ok(state.gestureTicksRemaining >= 20 && state.gestureTicksRemaining <= 29)
    assert.ok(state.dismissalIndex >= 0 && state.dismissalIndex < 3)
  }
})

test('the authoritative population stream advances from absence to a fresh Courtyard roll', () => {
  const initial = createHubSkorchaPopulation(0)
  assert.equal(initial.skorcha, null)
  const reconstructed = drawHubSkorchaPopulation(initial.rng)
  assert.equal(reconstructed.skorcha?.variant, 0)
  assert.deepEqual(reconstructed.skorcha?.position, { x: 1437.5, y: 732.5 })
  assert.notDeepEqual(reconstructed.rng, initial.rng)
})

test('shared Courtyard occupancy retains one population and reconstructs after its last exit', () => {
  let world = createHubWorld(['first', 'second'], { traderAnimationSeed: 0 })
  assert.equal(world.courtyardPopulationActive, true)
  assert.equal(world.skorcha, null)

  world = removeHubParticipant(world, 'first')
  assert.equal(world.courtyardPopulationActive, true)
  assert.equal(world.skorcha, null)

  world = removeHubParticipant(world, 'second')
  assert.equal(world.courtyardPopulationActive, false)
  assert.equal(world.skorcha, null)

  world = addHubParticipant(world, 'first')
  assert.equal(world.courtyardPopulationActive, true)
  assert.equal(world.skorcha?.variant, 0)
  assert.deepEqual(world.skorcha?.position, { x: 1437.5, y: 732.5 })
})

test('a private-room round trip destroys and reconstructs the Courtyard population', () => {
  const position = { x: 512, y: 900 }
  const player = createPlayerCharacter(CHARACTER, position)
  let world = createHubWorld(['owner'], { traderAnimationSeed: 0 })
  world = {
    ...world,
    participants: {
      owner: {
        region: 'courtyard',
        transition: {
          alpha: 1,
          destination: 'library',
          phase: 'outgoing',
          scriptedSpeed: 1,
          scriptedTarget: position,
          sourceRegion: 'courtyard',
        },
      },
    },
  }
  const left = stepHubWorldTick(world, { owner: player }, {}, { owner: 1 })
  assert.equal(left.world.participants.owner?.region, 'library')
  assert.equal(left.world.courtyardPopulationActive, false)
  assert.equal(left.world.skorcha, null)

  world = {
    ...left.world,
    participants: {
      owner: {
        region: 'library',
        transition: {
          alpha: 1,
          destination: 'courtyard',
          phase: 'outgoing',
          scriptedSpeed: 1,
          scriptedTarget: left.players.owner!.position,
          sourceRegion: 'library',
        },
      },
    },
  }
  const returned = stepHubWorldTick(
    world,
    { owner: left.players.owner! },
    {},
    { owner: 1 },
  )
  assert.equal(returned.world.participants.owner?.region, 'courtyard')
  assert.equal(returned.world.courtyardPopulationActive, true)
  assert.equal(returned.world.skorcha?.variant, 0)
})

test('Skorcha changes to a distinct gesture after an exact Integer(10)+20 interval', () => {
  for (const variant of [0, 1, 2] as const) {
    let state = createHubSkorchaAtVariant(createNativeRng(100 + variant), variant)
    const initialGesture = state.gesture
    const interval = state.gestureTicksRemaining
    for (let tick = 1; tick < interval; tick += 1) {
      state = stepHubSkorcha(state)
      assert.equal(state.gesture, initialGesture)
      assert.equal(state.gestureTicksRemaining, interval - tick)
    }
    state = stepHubSkorcha(state)
    assert.notEqual(state.gesture, initialGesture)
    assert.ok(state.gestureTicksRemaining >= 20 && state.gestureTicksRemaining <= 29)
  }
})

test('Skorcha common animator reaches the four hat records and native blank apex', () => {
  let state = createHubSkorchaAtVariant(createNativeRng(317), 2)
  const frames = new Set<number>()
  let activationObserved = false
  for (let tick = 0; tick < 20_000 && frames.size < 5; tick += 1) {
    state = stepHubSkorcha(state)
    activationObserved ||= state.hatActive
    frames.add(hubSkorchaHatFrame(state))
  }
  assert.equal(activationObserved, true)
  assert.deepEqual([...frames].sort(), [0, 1, 2, 3, 4])
  assert.ok(state.hatPhaseDegrees >= 0 && state.hatPhaseDegrees < 180)
  assert.ok(state.hatRateDegreesPerTick >= 0 && state.hatRateDegreesPerTick <= 1.8)
})

test('Hub world preserves forced absence/presence and advances Skorcha on the host tick', () => {
  const absent = createHubWorld([], { skorcha: null })
  assert.equal(absent.skorcha, null)

  const skorcha = createHubSkorchaAtVariant(createNativeRng(73), 2)
  const present = createHubWorld([], { skorcha })
  const stepped = stepHubWorldTick(present, {}, {}, {})
  assert.equal(stepped.world.skorcha?.variant, 2)
  assert.deepEqual(stepped.world.skorcha?.position, { x: 669, y: 705.5 })
  assert.equal(
    stepped.world.skorcha?.gestureTicksRemaining,
    skorcha.gestureTicksRemaining - 1,
  )
})
