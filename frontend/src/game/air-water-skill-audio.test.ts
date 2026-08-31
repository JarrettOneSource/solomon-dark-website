import assert from 'node:assert/strict'
import test from 'node:test'

import type { PrimarySpellWaterHailState } from './core-kernels/primary-spells.ts'
import {
  NativeAirWaterFrameSoundCursor,
  nativeAirWaterAcceptedCastAudioRequests,
  newNativeAirWaterActorSoundRequests,
} from './air-water-skill-audio.ts'
import { createPrimarySpellSimulationFrame } from './protocol/primary-spell-hail-replication.ts'

const WORLD_KEY = 'boneyard:audio'

test('Air/Water accepted cue map keeps the exact family-owned rows', () => {
  assert.equal(nativeAirWaterAcceptedCastAudioRequests(24), null)
  assert.deepEqual(nativeAirWaterAcceptedCastAudioRequests(27), [
    { cue: 'magic-storm', kind: 'sound', playbackRate: 1 },
  ])
  assert.deepEqual(nativeAirWaterAcceptedCastAudioRequests(30), [
    { cue: 'prismatic-shock', kind: 'stream', playbackRate: 1 },
    { cue: 'lightning-start', kind: 'sound', playbackRate: 0.8 },
  ])
  assert.deepEqual(nativeAirWaterAcceptedCastAudioRequests(35), [
    { cue: 'ring-of-ice', kind: 'sound', playbackRate: 1 },
  ])
  assert.deepEqual(nativeAirWaterAcceptedCastAudioRequests(76), [])
})

test('Hail bounce counters emit once per unseen replicated edge and never on hydration', () => {
  const previous = hail({ bounceSoundSequence: 1 })
  const current = hail({
    bounceSoundIndex: 2,
    bounceSoundPitch: Math.fround(1.1),
    bounceSoundSequence: 3,
  })
  assert.deepEqual(newNativeAirWaterActorSoundRequests(
    [previous],
    [current],
    { x: 10, y: 20 },
    WORLD_KEY,
  ), [
    {
      cue: 'hail-bounce-2',
      playbackRate: Math.fround(1.1),
      sourcePosition: current.position,
      volume: 1,
    },
    {
      cue: 'hail-bounce-2',
      playbackRate: Math.fround(1.1),
      sourcePosition: current.position,
      volume: 1,
    },
  ])
  assert.deepEqual(newNativeAirWaterActorSoundRequests(
    [],
    [current],
    { x: 10, y: 20 },
    WORLD_KEY,
  ), [])
  assert.throws(() => newNativeAirWaterActorSoundRequests(
    [previous],
    [{ ...current, bounceSoundIndex: null }],
    { x: 10, y: 20 },
    WORLD_KEY,
  ), /without its native sample/)

  const cursor = new NativeAirWaterFrameSoundCursor()
  cursor.reset(
    createPrimarySpellSimulationFrame({ nextId: 2, projectiles: [], transients: [previous] }),
    WORLD_KEY,
  )
  assert.deepEqual(cursor.advance(
    createPrimarySpellSimulationFrame({ nextId: 2, projectiles: [], transients: [current] }),
    { x: 10, y: 20 },
    WORLD_KEY,
  ), [
    {
      cue: 'hail-bounce-2',
      playbackRate: Math.fround(1.1),
      sourcePosition: current.position,
      volume: 1,
    },
    {
      cue: 'hail-bounce-2',
      playbackRate: Math.fround(1.1),
      sourcePosition: current.position,
      volume: 1,
    },
  ])
})

test('retained Hail audio follows arbitrary legal row order and immediate snapshot history', () => {
  const cursor = new NativeAirWaterFrameSoundCursor()
  const previousThree = hail({ bounceSoundSequence: 1, id: 3, position: { x: 30, y: 20 } })
  const previousOne = hail({ bounceSoundSequence: 2, id: 1, position: { x: 10, y: 20 } })
  cursor.reset(createPrimarySpellSimulationFrame({
    nextId: 4,
    projectiles: [],
    transients: [previousThree, previousOne],
  }), WORLD_KEY)

  const currentOne = hail({
    bounceSoundIndex: 1,
    bounceSoundPitch: Math.fround(1.1),
    bounceSoundSequence: 4,
    id: 1,
    position: { x: 10, y: 20 },
  })
  const bornFour = hail({ bounceSoundSequence: 7, id: 4, position: { x: 40, y: 20 } })
  const currentThree = hail({
    bounceSoundIndex: 2,
    bounceSoundPitch: Math.fround(1.2),
    bounceSoundSequence: 2,
    id: 3,
    position: { x: 30, y: 20 },
  })
  assert.deepEqual(cursor.advance(createPrimarySpellSimulationFrame({
    nextId: 5,
    projectiles: [],
    transients: [currentOne, bornFour, currentThree],
  }), { x: 20, y: 20 }, WORLD_KEY), [
    {
      cue: 'hail-bounce-1',
      playbackRate: Math.fround(1.1),
      sourcePosition: currentOne.position,
      volume: 1,
    },
    {
      cue: 'hail-bounce-1',
      playbackRate: Math.fround(1.1),
      sourcePosition: currentOne.position,
      volume: 1,
    },
    {
      cue: 'hail-bounce-2',
      playbackRate: Math.fround(1.2),
      sourcePosition: currentThree.position,
      volume: 1,
    },
  ])

  cursor.advance(createPrimarySpellSimulationFrame({
    nextId: 5,
    projectiles: [],
    transients: [],
  }), { x: 20, y: 20 }, WORLD_KEY)
  assert.deepEqual(cursor.advance(createPrimarySpellSimulationFrame({
    nextId: 5,
    projectiles: [],
    transients: [{ ...currentOne, bounceSoundSequence: 6 }],
  }), { x: 20, y: 20 }, WORLD_KEY), [])

  const otherWorld = 'boneyard:other-audio'
  assert.deepEqual(cursor.advance(createPrimarySpellSimulationFrame({
    nextId: 5,
    projectiles: [],
    transients: [{
      ...currentOne,
      bounceSoundSequence: 8,
      worldKey: otherWorld,
    }],
  }), { x: 20, y: 20 }, otherWorld), [])
})

function hail(overrides: Partial<PrimarySpellWaterHailState>): PrimarySpellWaterHailState {
  return {
    ageTicks: 20,
    birthTick: 0,
    bounceProgress: Math.fround(0.4),
    bounceSoundIndex: 0,
    bounceSoundPitch: 1,
    bounceSoundSequence: 0,
    height: -4,
    horizontalVelocity: { x: 1, y: 0 },
    id: 1,
    kind: 'water-hail',
    life: 1.7,
    ownerId: 'water',
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 100 }],
    position: { x: 10, y: 20 },
    rotationDegrees: 90,
    rotationStepDegrees: 4,
    savedBounceVelocity: -2,
    scale: 1.5,
    verticalVelocity: 1,
    worldKey: WORLD_KEY,
    ...overrides,
  }
}
