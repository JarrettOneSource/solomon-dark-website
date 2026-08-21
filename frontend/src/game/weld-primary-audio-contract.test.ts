import assert from 'node:assert/strict'
import test from 'node:test'

import type { NativeWeldBuildId } from './core-kernels/native-weld-primary-profile.ts'
import {
  nativeWeldCastSoundCues,
  nativeWeldLoopCues,
} from './weld-primary-audio-contract.ts'

test('maps all ten welded builds to their exact native browser cues', () => {
  const expected = {
    1000: { loops: [], sounds: ['magic-missile', 'throw-fire'] },
    1001: { loops: [], sounds: ['frost-missile'] },
    1002: { loops: [], sounds: ['throw-lightning-2'] },
    1003: { loops: ['fire-loop'], sounds: ['flame-lash-start'] },
    1004: { loops: ['ice-beam-loop'], sounds: ['ice-start'] },
    1005: { loops: ['steam-loop', 'fire-loop'], sounds: [] },
    1006: { loops: ['gather-rocks-loop'], sounds: ['start-boulder'] },
    1007: { loops: ['meteor-loop'], sounds: [] },
    1008: {
      loops: ['ice-beam-loop', 'gather-rocks-loop'],
      sounds: ['start-boulder'],
    },
    1009: { loops: [], sounds: ['shock-2'] },
  } as const
  for (const rawBuildId of Object.keys(expected)) {
    const buildId = Number(rawBuildId) as NativeWeldBuildId
    const variant = buildId === 1002 || buildId === 1009 ? 1 : null
    assert.deepEqual(nativeWeldCastSoundCues(buildId, variant), expected[buildId].sounds)
    assert.deepEqual(nativeWeldLoopCues(buildId), expected[buildId].loops)
  }
})

test('requires the authoritative sound selector only on randomized casts', () => {
  assert.throws(() => nativeWeldCastSoundCues(1002, null), /requires/)
  assert.throws(() => nativeWeldCastSoundCues(1009, 3), /requires/)
  assert.throws(() => nativeWeldCastSoundCues(1000, 0), /no native sound variant/)
})
