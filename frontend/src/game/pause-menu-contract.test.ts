import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_PAUSE_CLOSE_MS,
  NATIVE_PAUSE_DIM_ALPHA,
  NATIVE_PAUSE_ART_MEMBERS,
  NATIVE_PAUSE_ATLAS_FRAMES,
  NATIVE_PAUSE_REVEAL_MS,
  PAUSE_MENU_ACTION_BOUNDS,
  gameplayPausePresentation,
} from './pause-menu-contract.ts'

const PAUSE = {
  ownerDisplayName: 'Helvidius',
  ownerPlayerId: 'player-1',
} as const

test('pause menu keeps the recovered native timing and action geometry', () => {
  assert.equal(NATIVE_PAUSE_REVEAL_MS, 290)
  assert.equal(NATIVE_PAUSE_CLOSE_MS, 200)
  assert.equal(NATIVE_PAUSE_DIM_ALPHA, 0.85)
  assert.deepEqual(PAUSE_MENU_ACTION_BOUNDS, {
    resume: { height: 69, left: 623.5, top: 339.5, width: 353 },
    settings: { height: 69, left: 623.5, top: 415.5, width: 353 },
    leave: { height: 69, left: 623.5, top: 491.5, width: 353 },
  })
})

test('pause menu drains the complete native overlay art membership', () => {
  assert.deepEqual(NATIVE_PAUSE_ATLAS_FRAMES, {
    8: [824, 587, 49, 112],
    17: [743, 588, 80, 83],
    18: [543, 205, 67, 262],
    54: [679, 394, 70, 85],
    101: [266, 482, 353, 69],
  })
  assert.equal(NATIVE_PAUSE_ART_MEMBERS.length, 17)
  assert.deepEqual(
    Object.fromEntries([8, 17, 18, 54, 101].map((record) => [
      record,
      NATIVE_PAUSE_ART_MEMBERS.filter((member) => member.record === record).length,
    ])),
    { 8: 3, 17: 4, 18: 1, 54: 6, 101: 3 },
  )
  assert.deepEqual(
    NATIVE_PAUSE_ART_MEMBERS.filter((member) => member.record === 8)
      .map(({ left, scale, top }) => ({ left, scale: scale ?? 1, top })),
    [
      { left: 775.5, scale: 1, top: 599.5 },
      { left: 706.625, scale: 0.75, top: 600.5 },
      { left: 856.625, scale: 0.75, top: 600.5 },
    ],
  )
})

test('pause presentation gives actions only to the authoritative owner', () => {
  assert.deepEqual(gameplayPausePresentation(PAUSE, 'player-1'), {
    kind: 'owner',
    label: 'Game paused',
  })
  assert.deepEqual(gameplayPausePresentation(PAUSE, 'player-2'), {
    detail: 'Waiting for Helvidius to resume.',
    kind: 'waiting',
    label: 'Helvidius has paused the game.',
  })
})
