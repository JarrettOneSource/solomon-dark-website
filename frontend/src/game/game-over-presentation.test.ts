import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  BONEYARD_GAME_OVER_ENTRY_FADE_TICKS,
  BONEYARD_GAME_OVER_EXIT_FADE_TICKS,
} from './core-kernels/game-run.ts'
import { boneyardGameOverPresentation } from './game-over-presentation.ts'

test('Boneyard Game Over fades from black, holds clear, then fades back to black', () => {
  assert.deepEqual(boneyardGameOverPresentation(-1, null), {
    fadeAlpha: 1,
  })
  assert.equal(boneyardGameOverPresentation(1, null).fadeAlpha, 0.975)
  assert.equal(boneyardGameOverPresentation(39, null).fadeAlpha, 0.025)
  assert.equal(
    boneyardGameOverPresentation(BONEYARD_GAME_OVER_ENTRY_FADE_TICKS, null).fadeAlpha,
    0,
  )
  assert.equal(
    boneyardGameOverPresentation(BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK - 1, null)
      .fadeAlpha,
    0,
  )
  assert.equal(
    boneyardGameOverPresentation(BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK, 1).fadeAlpha,
    0.0025,
  )
  assert.equal(
    boneyardGameOverPresentation(10_000, BONEYARD_GAME_OVER_EXIT_FADE_TICKS - 1).fadeAlpha,
    0.9975,
  )
  assert.equal(
    boneyardGameOverPresentation(10_000, BONEYARD_GAME_OVER_EXIT_FADE_TICKS).fadeAlpha,
    1,
  )
})
