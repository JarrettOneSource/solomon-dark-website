import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerPrimaryCast } from '../core-kernels/player-character.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import {
  deriveNativeWorldNameplateItems,
  nativeWorldNameplateHealthRatio,
  nativeWorldNameplateWidth,
  projectNativeWorldPoint,
  type NativeWorldScreenTransform,
} from './native-world-nameplate.ts'

const DEFAULT_PLAYER = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!

function player(displayName: string, x = 100, y = 200): ProtocolPlayerState {
  return {
    config: {
      discipline: 'arcane',
      displayName,
      element: 'ether',
    },
    economy: DEFAULT_PLAYER.economy,
    footstepTick: 0,
    gaitDegrees: 0,
    headingIndex: 0,
    lighting: DEFAULT_PLAYER.lighting,
    position: { x, y },
    primaryCast: createIdlePlayerPrimaryCast(),
    progression: DEFAULT_PLAYER.progression,
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  }
}

test('world nameplates exclude self, invalid entries, and off-scene players', () => {
  const remote = player('Remote', 110, 210)
  const zeroHealth = player('Zero', 120, 220)
  zeroHealth.progression = {
    ...zeroHealth.progression,
    currentHealth: 0,
  }
  const invalidHealth = player('Invalid', 130, 230)
  invalidHealth.progression = {
    ...invalidHealth.progression,
    maximumHealth: 0,
  }

  assert.deepEqual(
    deriveNativeWorldNameplateItems({
      local: player('Local'),
      remote,
      zeroHealth,
      invalidHealth,
      blank: player(''),
    }, 'local', (playerId) => playerId !== 'zeroHealth'),
    [{
      healthRatio: 1,
      id: 'remote',
      name: 'Remote',
      position: { x: 110, y: 210 },
    }],
  )
})

test('world nameplates preserve a valid zero-health actor with an empty bar', () => {
  const zeroHealth = player('Zero')
  zeroHealth.progression = {
    ...zeroHealth.progression,
    currentHealth: 0,
    maximumHealth: 50,
  }

  assert.deepEqual(
    deriveNativeWorldNameplateItems({ local: player('Local'), zero: zeroHealth }, 'local'),
    [{
      healthRatio: 0,
      id: 'zero',
      name: 'Zero',
      position: { x: 100, y: 200 },
    }],
  )
})

test('world nameplate health and width use native clamping and minimums', () => {
  assert.equal(nativeWorldNameplateHealthRatio(12.5, 50), 0.25)
  assert.equal(nativeWorldNameplateHealthRatio(-1, 50), 0)
  assert.equal(nativeWorldNameplateHealthRatio(100, 50), 1)
  assert.equal(nativeWorldNameplateHealthRatio(1, 0), null)
  assert.equal(nativeWorldNameplateWidth('Host'), 64)
  assert.equal(nativeWorldNameplateWidth('123456789'), 72)
  assert.equal(nativeWorldNameplateWidth('A B'), 64)
})

test('world nameplate projection uses the post-world screen transform', () => {
  const transform: NativeWorldScreenTransform = {
    position: { x: 100, y: 50 },
    scale: 1.2,
  }

  assert.deepEqual(
    projectNativeWorldPoint(
      { x: 10, y: 20 },
      transform,
      { width: 1600, height: 900 },
    ),
    { x: 112, y: 74 },
  )
  assert.equal(
    projectNativeWorldPoint(
      { x: -100, y: 20 },
      transform,
      { width: 1600, height: 900 },
    ),
    null,
  )
})
