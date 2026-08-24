import assert from 'node:assert/strict'
import test from 'node:test'

import { HUB_PRIVATE_ROOM_LAYOUTS } from '../core-kernels/hub-private-room-layout.ts'
import { NATIVE_HUB_NPC_CATALOG } from '../core-kernels/native-hub-npc.ts'
import { createNativeRng, type NativeRngState } from '../core-kernels/native-rng.ts'
import {
  HUB_SKORCHA_WINDOW_MAX_TICKS,
  HUB_SKORCHA_WINDOW_MIN_TICKS,
  createHubSkorcha,
  createHubSkorchaAtVariant,
  createHubSkorchaSchedule,
  hubSkorchaHatFrame,
  scheduleHubSkorchaPopulation,
  stepHubSkorcha,
  stepHubSkorchaSchedule,
  type HubSkorchaState,
} from './hub-skorcha.ts'
import {
  HUB_FIXED_ACTOR_COLLISION_LAYOUT,
  addHubParticipant,
  createHubWorld,
  removeHubParticipant,
  stepHubWorldTick,
} from './hub-world.ts'

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

test('shared-Hub windows independently draw inclusive 20-to-40-minute durations', () => {
  assert.equal(HUB_SKORCHA_WINDOW_MIN_TICKS, 20 * 60 * 100)
  assert.equal(HUB_SKORCHA_WINDOW_MAX_TICKS, 40 * 60 * 100)
  const durations = new Set<number>()
  for (let seed = 0; seed < 100; seed += 1) {
    const schedule = createHubSkorchaSchedule(seed)
    assert.ok(schedule.transitionTicksRemaining >= HUB_SKORCHA_WINDOW_MIN_TICKS)
    assert.ok(schedule.transitionTicksRemaining <= HUB_SKORCHA_WINDOW_MAX_TICKS)
    durations.add(schedule.transitionTicksRemaining)
  }
  assert.ok(durations.size > 1)

  const durationRng = (durationOffset: number): NativeRngState => {
    const words = new Array<number>(55).fill(0)
    words[0] = durationOffset << 6
    return { indexA: 0, indexB: 31, words }
  }
  assert.equal(scheduleHubSkorchaPopulation({
    rng: durationRng(0),
    skorcha: null,
  }, {}).transitionTicksRemaining, HUB_SKORCHA_WINDOW_MIN_TICKS)
  assert.equal(scheduleHubSkorchaPopulation({
    rng: durationRng(
      HUB_SKORCHA_WINDOW_MAX_TICKS - HUB_SKORCHA_WINDOW_MIN_TICKS,
    ),
    skorcha: null,
  }, {}).transitionTicksRemaining, HUB_SKORCHA_WINDOW_MAX_TICKS)

  const initial = createHubSkorchaSchedule(2)
  const next = stepHubSkorchaSchedule({
    ...initial,
    transitionTicksRemaining: 1,
  })
  assert.ok(next.transitionTicksRemaining >= HUB_SKORCHA_WINDOW_MIN_TICKS)
  assert.ok(next.transitionTicksRemaining <= HUB_SKORCHA_WINDOW_MAX_TICKS)
  assert.notDeepEqual(next.rng, initial.rng)
})

test('timer overrides reject zero, negative, fractional, and unsafe windows', () => {
  for (const hiddenTicks of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => createHubSkorchaSchedule(0, { hiddenTicks }),
      /positive safe integer/,
    )
  }
})

test('shared-Hub timer alternates instantly between absent and visible windows', () => {
  let schedule = createHubSkorchaSchedule(0, { hiddenTicks: 2, visibleTicks: 3 })
  assert.equal(schedule.skorcha, null)
  assert.equal(schedule.transitionTicksRemaining, 2)

  schedule = stepHubSkorchaSchedule(schedule, { hiddenTicks: 2, visibleTicks: 3 })
  assert.equal(schedule.skorcha, null)
  assert.equal(schedule.transitionTicksRemaining, 1)

  schedule = stepHubSkorchaSchedule(schedule, { hiddenTicks: 2, visibleTicks: 3 })
  assert.equal(schedule.skorcha?.variant, 1)
  assert.equal(schedule.transitionTicksRemaining, 3)

  schedule = stepHubSkorchaSchedule(schedule, { hiddenTicks: 2, visibleTicks: 3 })
  schedule = stepHubSkorchaSchedule(schedule, { hiddenTicks: 2, visibleTicks: 3 })
  schedule = stepHubSkorchaSchedule(schedule, { hiddenTicks: 2, visibleTicks: 3 })
  assert.equal(schedule.skorcha, null)
  assert.equal(schedule.transitionTicksRemaining, 2)
})

test('timed appearances reach every placement and do not depend on Courtyard occupancy', () => {
  const appearances = new Map<number, number>()
  for (const seed of [4, 0, 1]) {
    let schedule = createHubSkorchaSchedule(seed, { hiddenTicks: 1, visibleTicks: 10 })
    assert.equal(schedule.skorcha, null)
    schedule = stepHubSkorchaSchedule(schedule, { hiddenTicks: 1, visibleTicks: 10 })
    appearances.set(seed, schedule.skorcha!.variant)
  }
  assert.deepEqual([...appearances.values()].sort(), [0, 1, 2])

  let world = createHubWorld(['first', 'second'], {
    skorchaHiddenTicks: 5,
    skorchaVisibleTicks: 10,
    traderAnimationSeed: 0,
  })
  const remaining = world.skorchaTransitionTicksRemaining
  world = removeHubParticipant(removeHubParticipant(world, 'first'), 'second')
  world = addHubParticipant(world, 'first', { region: 'library', transition: null })
  assert.equal(world.skorchaTransitionTicksRemaining, remaining)
  assert.equal(world.skorcha, null)
  world = stepHubWorldTick(world, {}, {}, {}).world
  assert.equal(world.skorchaTransitionTicksRemaining, remaining - 1)
})

test('phase edges add and remove Skorcha collision on the same authoritative tick', () => {
  let world = createHubWorld([], {
    skorchaHiddenTicks: 1,
    skorchaVisibleTicks: 1,
    traderAnimationSeed: 0,
  })
  assert.equal(world.skorcha, null)

  world = stepHubWorldTick(world, {}, {}, {}).world
  assert.ok(world.skorcha)
  assert.equal(world.runtime.bodies.some(({ id }) => id === 'skorcha'), true)

  world = stepHubWorldTick(world, {}, {}, {}).world
  assert.equal(world.skorcha, null)
  assert.equal(world.runtime.bodies.some(({ id }) => id === 'skorcha'), false)
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
  const absent = createHubWorld([], {
    skorcha: null,
    skorchaHiddenTicks: 10,
  })
  assert.equal(absent.skorcha, null)

  const skorcha = createHubSkorchaAtVariant(createNativeRng(73), 2)
  const present = createHubWorld([], { skorcha, skorchaVisibleTicks: 10 })
  const stepped = stepHubWorldTick(present, {}, {}, {})
  assert.equal(stepped.world.skorcha?.variant, 2)
  assert.deepEqual(stepped.world.skorcha?.position, { x: 669, y: 705.5 })
  assert.equal(
    stepped.world.skorcha?.gestureTicksRemaining,
    skorcha.gestureTicksRemaining - 1,
  )
})
