import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_SOLOMON_DIRT_DRAW_PASSES,
  nativeSolomonDirtDrawOperations,
  nativeSolomonDirtEventDelta,
  nativeSolomonDirtStateAt,
} from './boneyard-solomon-dirt-presentation.ts'

const SOLOMON = { x: 1_000, y: 1_000 }

test('reconstructs the fixed native Flydirt flight and retirement', () => {
  assert.deepEqual(nativeSolomonDirtStateAt(SOLOMON, 0), {
    ageTicks: 0,
    alpha: 1,
    headingDegrees: 35,
    position: { x: 978, y: 938 },
    speed: 2,
  })
  assert.deepEqual(nativeSolomonDirtStateAt(SOLOMON, 1), {
    ageTicks: 1,
    alpha: 0.9649999737739563,
    headingDegrees: 37,
    position: { x: 979.1471557617188, y: 936.3616943359375 },
    speed: 1.9500000476837158,
  })
  assert.deepEqual(nativeSolomonDirtStateAt(SOLOMON, 28), {
    ageTicks: 28,
    alpha: 0.019999675452709198,
    headingDegrees: 91,
    position: { x: 1011.3726806640625, y: Math.fround(917.68634) },
    speed: 0.9843727350234985,
  })
  assert.equal(nativeSolomonDirtStateAt(SOLOMON, 29), null)
})

test('submits the registered dirt glyph twice at one source-over transform', () => {
  const state = nativeSolomonDirtStateAt(SOLOMON, 10)
  assert.ok(state)
  const operations = nativeSolomonDirtDrawOperations(state)

  assert.equal(NATIVE_SOLOMON_DIRT_DRAW_PASSES, 2)
  assert.equal(operations.length, 2)
  assert.notEqual(operations[0], operations[1])
  assert.deepEqual(operations[0], operations[1])
  assert.deepEqual(operations[0], {
    alpha: 0.649999737739563,
    blendMode: 'normal',
    headingDegrees: 55,
    position: { x: 990.2738647460938, y: 925.1029052734375 },
  })
})

test('rejects fractional, negative, and non-finite fixed-tick ages', () => {
  for (const age of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => nativeSolomonDirtStateAt(SOLOMON, age), /age/i)
  }
})

test('does not replay dirt history on hydration and consumes future births once', () => {
  const history = [
    { cue: 'shovel-1' as const, id: 4, tick: 40 },
    { cue: 'throw-dirt-1' as const, id: 5, tick: 80 },
  ]
  assert.deepEqual(nativeSolomonDirtEventDelta(null, history), {
    eventId: 5,
    events: [],
  })

  const current = [
    ...history,
    { cue: 'shovel-2' as const, id: 6, tick: 180 },
    { cue: 'throw-dirt-2' as const, id: 7, tick: 240 },
  ]
  assert.deepEqual(nativeSolomonDirtEventDelta(5, current), {
    eventId: 7,
    events: [current[3]],
  })
  assert.deepEqual(nativeSolomonDirtEventDelta(7, current), {
    eventId: 7,
    events: [],
  })
})
