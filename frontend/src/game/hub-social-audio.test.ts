import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { LoadedBoneyard } from './core-kernels/boneyard.ts'
import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
} from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import {
  HUB_SOCIAL_SOUND_REQUESTS,
  advanceHubMembershipAudioCursor,
  createHubMembershipAudioCursor,
} from './hub-social-audio.ts'

const CHARACTER: PlayerCharacterConfig = {
  discipline: 'arcane',
  displayName: 'Aurelia',
  element: 'fire',
}
const mainMenuSource = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')

test('social cues use one quiet native click with distinct chat, join, and leave pitches', () => {
  assert.deepEqual(HUB_SOCIAL_SOUND_REQUESTS, {
    chat: { cue: 'click', playbackRate: 1.1, volume: 0.65 },
    join: { cue: 'click', playbackRate: 1.25, volume: 0.65 },
    leave: { cue: 'click', playbackRate: 0.85, volume: 0.65 },
  })
})

test('Hub membership audio is edge-owned, excludes self, and treats world re-entry as baseline', () => {
  const initial = hubSnapshot(['local', 'first'])
  let cursor = createHubMembershipAudioCursor(initial, 'local')
  assert.deepEqual(cursor.participantIds, ['first'])

  let delta = advanceHubMembershipAudioCursor(cursor, hubSnapshot(['local', 'first']), 'local')
  assert.deepEqual(delta.joinedPlayerIds, [])
  assert.deepEqual(delta.leftPlayerIds, [])
  cursor = delta.cursor

  delta = advanceHubMembershipAudioCursor(
    cursor,
    hubSnapshot(['local', 'first', 'second', 'third']),
    'local',
  )
  assert.deepEqual(delta.joinedPlayerIds, ['second', 'third'])
  assert.deepEqual(delta.leftPlayerIds, [])
  cursor = delta.cursor

  delta = advanceHubMembershipAudioCursor(
    cursor,
    hubSnapshot(['local', 'second']),
    'local',
  )
  assert.deepEqual(delta.joinedPlayerIds, [])
  assert.deepEqual(delta.leftPlayerIds, ['first', 'third'])
  cursor = delta.cursor

  const outside = createGameSnapshot(
    enterBoneyardWorld(
      createGameSimulation({ local: CHARACTER }),
      loadedBoneyardFixture('social-audio'),
    ),
    'local',
  )
  delta = advanceHubMembershipAudioCursor(cursor, outside, 'local')
  assert.equal(delta.cursor.participantIds, null)
  assert.deepEqual(delta.joinedPlayerIds, [])
  assert.deepEqual(delta.leftPlayerIds, [])

  delta = advanceHubMembershipAudioCursor(
    delta.cursor,
    hubSnapshot(['local', 'first', 'fourth']),
    'local',
  )
  assert.deepEqual(delta.cursor.participantIds, ['first', 'fourth'])
  assert.deepEqual(delta.joinedPlayerIds, [])
  assert.deepEqual(delta.leftPlayerIds, [])
})

test('session snapshot ownership wires join and leave deltas once and clears its cursor', () => {
  assert.match(
    mainMenuSource,
    /createHubMembershipAudioCursor\(\s*initialSnapshot,\s*session\.playerId/,
  )
  assert.match(
    mainMenuSource,
    /advanceHubMembershipAudioCursor\([\s\S]*delta\.joinedPlayerIds\.length[\s\S]*HUB_SOCIAL_SOUND_REQUESTS\.join[\s\S]*delta\.leftPlayerIds\.length[\s\S]*HUB_SOCIAL_SOUND_REQUESTS\.leave/,
  )
  assert.match(mainMenuSource, /hubMembershipAudioCursorRef\.current = null/)
})

function hubSnapshot(playerIds: readonly string[]) {
  return createGameSnapshot(createGameSimulation(Object.fromEntries(
    playerIds.map((playerId) => [playerId, {
      ...CHARACTER,
      displayName: playerId,
    }]),
  )), playerIds[0] ?? null)
}

function loadedBoneyardFixture(runId: string): LoadedBoneyard {
  return {
    choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
    geometrySha256: '2'.repeat(64),
    runId,
    scene: {
      bounds: { h: 1_200, w: 1_600, x: 0, y: 0 },
      environmentMode: 2,
      fences: [],
      name: 'Social Audio Arena',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 200, y: 150 },
      sprites: [],
      terrain: [],
    },
    seed: '0123456789abcdef',
    sourceSha256: '1'.repeat(64),
  }
}
