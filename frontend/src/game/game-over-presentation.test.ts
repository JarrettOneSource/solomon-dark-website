import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
  GAME_OVER_ENTRY_FADE_TICKS,
  GAME_OVER_INPUT_ACCEPT_TICK,
  GAME_OVER_INPUT_EXIT_FADE_TICKS,
  createGameRunLifecycle,
  startGameRun,
  stepGameRunLifecycle,
} from './core-kernels/game-run.ts'
import {
  gameOverPresentation,
  solomonRiffPresentation,
} from './game-over-presentation.ts'
import { gameOverAudioEvents } from './game-over-audio.ts'

const overlaySource = readFileSync(new URL('./GameOverOverlay.tsx', import.meta.url), 'utf8')
const promptSource = readFileSync(new URL('./NativeGameOverPrompt.tsx', import.meta.url), 'utf8')
const boneyardCss = readFileSync(new URL('./boneyard.css', import.meta.url), 'utf8')

test('normal Game Over owns separate entry, title, prompt, and exit alphas', () => {
  assert.deepEqual(gameOverPresentation(-1, null, null), {
    acceptsInput: false,
    entryFadeAlpha: 1,
    exitFadeAlpha: 0,
    promptAlpha: 0,
    titleAlpha: 0,
  })
  assert.equal(gameOverPresentation(1, null, null).entryFadeAlpha, 0.975)
  assert.equal(gameOverPresentation(39, null, null).entryFadeAlpha, 0.025)
  assert.equal(
    gameOverPresentation(GAME_OVER_ENTRY_FADE_TICKS, null, null).entryFadeAlpha,
    0,
  )
  assert.equal(gameOverPresentation(300, null, null).titleAlpha, 0)
  assert.equal(gameOverPresentation(301, null, null).titleAlpha, 0.005)
  assert.equal(gameOverPresentation(400, null, null).promptAlpha, 0)
  assert.equal(gameOverPresentation(401, null, null).promptAlpha, 0.005)
  assert.equal(
    gameOverPresentation(GAME_OVER_INPUT_ACCEPT_TICK - 1, null, null).acceptsInput,
    false,
  )
  assert.equal(
    gameOverPresentation(GAME_OVER_INPUT_ACCEPT_TICK, null, null).acceptsInput,
    true,
  )
  assert.equal(gameOverPresentation(600, null, null).promptAlpha, 1)

  assert.equal(gameOverPresentation(700, 1, 'input').exitFadeAlpha, 0.05)
  assert.equal(
    gameOverPresentation(700, GAME_OVER_INPUT_EXIT_FADE_TICKS, 'input').exitFadeAlpha,
    1,
  )
  assert.equal(
    gameOverPresentation(
      GAME_OVER_AUTOMATIC_ACCEPT_TICK,
      1,
      'automatic',
    ).exitFadeAlpha,
    0.004,
  )
  assert.equal(
    gameOverPresentation(
      10_000,
      GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
      'automatic',
    ).exitFadeAlpha,
    1,
  )
})

test('Solomon Riff extracts all twelve rows and renders the eleven selected by its tick program', () => {
  assert.deepEqual(solomonRiffPresentation(200), {
    frameRecord: null,
    visible: false,
    xOffset: -375,
    yOffset: -5,
  })
  assert.deepEqual(solomonRiffPresentation(201), {
    frameRecord: 1,
    visible: true,
    xOffset: -375,
    yOffset: -5,
  })
  assert.deepEqual(solomonRiffPresentation(202), {
    frameRecord: 1,
    visible: true,
    xOffset: -370.6000061035156,
    yOffset: -9,
  })
  assert.deepEqual(solomonRiffPresentation(268), {
    frameRecord: 1,
    visible: true,
    xOffset: -80.20032501220703,
    yOffset: 0,
  })
  assert.equal(solomonRiffPresentation(821).frameRecord, 5)
  assert.equal(solomonRiffPresentation(822).frameRecord, 1)
  assert.equal(solomonRiffPresentation(921).frameRecord, 7)
  assert.equal(solomonRiffPresentation(951).frameRecord, 12)

  const records = new Set<number>()
  for (let tick = 201; tick <= GAME_OVER_AUTOMATIC_ACCEPT_TICK; tick += 1) {
    const record = solomonRiffPresentation(tick).frameRecord
    if (record !== null) records.add(record)
  }
  assert.deepEqual([...records].sort((left, right) => left - right), [
    1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12,
  ])
})

test('Game Over owns the huge laugh once and Riff owns Death Guitar at tick 550', () => {
  const active = startGameRun(createGameRunLifecycle(), 'run-a', ['a'])
  const entered = stepGameRunLifecycle(active, new Set())
  assert.deepEqual(gameOverAudioEvents(active, entered), ['solomon-laugh-big'])
  assert.deepEqual(gameOverAudioEvents(entered, { ...entered, gameOverTicks: 1 }), [])
  assert.deepEqual(gameOverAudioEvents(
    { ...entered, gameOverTicks: 549 },
    { ...entered, gameOverTicks: 550 },
  ), ['death-guitar'])
  assert.deepEqual(gameOverAudioEvents(
    { ...entered, gameOverTicks: 550 },
    { ...entered, gameOverTicks: 551 },
  ), [])
})

test('an individual death without the terminal run edge owns neither Game Over stream', () => {
  const active = startGameRun(createGameRunLifecycle(), 'run-a', ['a', 'b'])
  assert.deepEqual(gameOverAudioEvents(active, active), [])
})

test('the overlay paints Riff, entry black, separate title rows, prompt, then exit black', () => {
  assert.match(overlaySource, /game-over-solomon-riff/)
  assert.match(overlaySource, /game-over-entry-black/)
  assert.match(overlaySource, /nativeGameOver\.game/)
  assert.match(overlaySource, /nativeGameOver\.over/)
  assert.match(overlaySource, /<NativeGameOverPrompt/)
  assert.match(overlaySource, /game-over-exit-black/)
  assert.match(promptSource, /NativeBitmapText/)
  assert.match(promptSource, /font="menu"/)
  assert.match(promptSource, /CLICK TO CONTINUE\.\.\./)
  assert.match(boneyardCss, /\.game-over-word-game[\s\S]*?width: 307px;[\s\S]*?height: 119px;/)
  assert.match(boneyardCss, /\.game-over-word-over[\s\S]*?width: 306px;[\s\S]*?height: 120px;/)
})
