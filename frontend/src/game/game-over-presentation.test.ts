import assert from 'node:assert/strict'
import test from 'node:test'

import { BONEYARD_GAME_OVER_INPUT_GATE_TICKS } from './core-kernels/game-run.ts'
import {
  BONEYARD_GAME_OVER_WEB_FADE_TICKS,
  boneyardGameOverPresentation,
} from './game-over-presentation.ts'

test('Boneyard Game Over is a fade-only surface with the exact input gate', () => {
  assert.deepEqual(boneyardGameOverPresentation(-1), {
    acceptsInput: false,
    fadeAlpha: 0,
  })
  assert.equal(
    boneyardGameOverPresentation(BONEYARD_GAME_OVER_WEB_FADE_TICKS / 2).fadeAlpha,
    0.5,
  )
  assert.equal(boneyardGameOverPresentation(999).acceptsInput, false)
  assert.equal(
    boneyardGameOverPresentation(BONEYARD_GAME_OVER_INPUT_GATE_TICKS).acceptsInput,
    true,
  )
  assert.equal(boneyardGameOverPresentation(10_000).fadeAlpha, 1)
})
