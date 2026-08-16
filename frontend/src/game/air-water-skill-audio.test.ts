import assert from 'node:assert/strict'
import test from 'node:test'

import type { PrimarySpellWaterHailState } from './core-kernels/primary-spells.ts'
import {
  nativeAirWaterAcceptedCastAudioRequests,
  newNativeAirWaterActorSoundRequests,
} from './air-water-skill-audio.ts'

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
    bounceSoundPitch: 1.1,
    bounceSoundSequence: 3,
  })
  assert.deepEqual(newNativeAirWaterActorSoundRequests(
    [previous],
    [current],
    { x: 10, y: 20 },
    WORLD_KEY,
  ), [
    { cue: 'hail-bounce-2', playbackRate: 1.1, sourcePosition: current.position, volume: 1 },
    { cue: 'hail-bounce-2', playbackRate: 1.1, sourcePosition: current.position, volume: 1 },
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
})

function hail(overrides: Partial<PrimarySpellWaterHailState>): PrimarySpellWaterHailState {
  return {
    ageTicks: 20,
    birthTick: 0,
    bounceProgress: 0.4,
    bounceSoundIndex: 0,
    bounceSoundPitch: 1,
    bounceSoundSequence: 0,
    height: -4,
    horizontalVelocity: { x: 1, y: 0 },
    id: 1,
    kind: 'water-hail',
    life: 1.7,
    ownerId: 'water',
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
