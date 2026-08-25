import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  NATIVE_APPLICATION_TICK_MS,
  NATIVE_APPLICATION_TICK_RATE,
  nativeApplicationTick,
} from './native-application-tick.ts'
import { tutorialPointerVisible } from './tutorial-modal-callouts.ts'

test('the application tick is the 100 Hz base tick 0x00427800', () => {
  assert.equal(NATIVE_APPLICATION_TICK_RATE, 100)
  assert.equal(NATIVE_APPLICATION_TICK_MS, 10)
  assert.equal(nativeApplicationTick(0), 0)
  assert.equal(nativeApplicationTick(9.999), 0)
  assert.equal(nativeApplicationTick(10), 1)
  assert.equal(nativeApplicationTick(1_234.5), 123)
})

test('0x005C9BB0 blink: hidden for ticks 0..19, drawn for ticks 20..49, every 50 ticks', () => {
  for (let tick = 0; tick < 200; tick += 1) {
    assert.equal(tutorialPointerVisible(true, tick), tick % 50 > 19, `tick ${tick}`)
    assert.equal(tutorialPointerVisible(false, tick), true, `steady tick ${tick}`)
  }
})

test('the blink period is 500 ms of wall clock: 200 ms hidden, 300 ms visible', () => {
  const visibleMs = []
  for (let ms = 0; ms < 500; ms += 1) {
    if (tutorialPointerVisible(true, nativeApplicationTick(ms))) visibleMs.push(ms)
  }
  assert.equal(visibleMs.length, 300)
  assert.equal(visibleMs[0], 200)
  assert.equal(visibleMs.at(-1), 499)
  assert.equal(tutorialPointerVisible(true, nativeApplicationTick(500)), false)
  assert.equal(tutorialPointerVisible(true, nativeApplicationTick(700)), true)
})
