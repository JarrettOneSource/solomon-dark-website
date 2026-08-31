import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  NATIVE_NOTEBOX,
  nativeNoteboxDurationMs,
  nativeNoteboxLayout,
  nativeNoteboxOpacity,
} from './native-ui-notebox.ts'

const gameRoot = new URL('../', import.meta.url)


test('native Notebox keeps the exact geometry and fixed-tick envelope', () => {
  const layout = nativeNoteboxLayout('To succeed at your boast, you must\nsurvive until at least Wave 30')
  assert.equal(layout.panelLeft + layout.panelWidth / 2, NATIVE_NOTEBOX.centerX)
  assert.equal(layout.panelTop + layout.panelHeight / 2, NATIVE_NOTEBOX.centerY)
  assert.equal(layout.panelWidth, layout.textWidth + 70)
  assert.equal(layout.panelHeight, layout.textHeight + 70)
  assert.equal(NATIVE_NOTEBOX.frameRecord, 64)
  assert.equal(NATIVE_NOTEBOX.instructionTint, 0xd9ba70)
  assert.equal(NATIVE_NOTEBOX.failureTint, 0xff4040)

  assert.equal(nativeNoteboxDurationMs('instruction'), 10_200)
  assert.equal(nativeNoteboxOpacity('instruction', 0), 0)
  assert.equal(nativeNoteboxOpacity('instruction', 50), 0.5)
  assert.equal(nativeNoteboxOpacity('instruction', 100), 1)
  assert.equal(nativeNoteboxOpacity('instruction', 10_000), 1)
  assert.equal(nativeNoteboxOpacity('instruction', 10_100), 0.5)
  assert.equal(nativeNoteboxOpacity('instruction', 10_200), 0)

  assert.equal(nativeNoteboxDurationMs('failure'), 5_200)
  assert.equal(nativeNoteboxOpacity('failure', 5_000), 1)
  assert.equal(nativeNoteboxOpacity('failure', 5_100), 0.5)
  assert.equal(nativeNoteboxOpacity('failure', 5_200), 0)
  assert.equal(nativeNoteboxOpacity('failure', 1_100, 1_000), 0.5)
  assert.equal(nativeNoteboxOpacity('failure', 1_200, 1_000), 0)
})

test('Boast failure owns the exact native buzzer stream', () => {
  const buzzer = readFileSync(new URL('../assets/game/audio/sfx/buzzer.wav', gameRoot))
  assert.equal(
    createHash('sha256').update(buzzer).digest('hex'),
    '19c010bb56690b3f7808a0f71ae639ab8d033e0ea1e31637ac688da957f3e844',
  )
})
