import assert from 'node:assert/strict'
import test from 'node:test'

import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import { createBrowserGameplayInput } from './gameplay-input.ts'

class FakeMouseEvent extends Event {
  readonly button: number
  readonly clientX: number
  readonly clientY: number

  constructor(
    type: string,
    button: number,
    clientX: number,
    clientY: number,
  ) {
    super(type, { cancelable: true })
    this.button = button
    this.clientX = clientX
    this.clientY = clientY
  }
}

class FakeVisibilityTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'
}

function expectedInput(
  aim: { x: number; y: number } | null,
  primary: boolean,
  secondary: boolean,
): PlayerCharacterInput {
  return {
    aim,
    cast: { primary, secondary },
    movement: { x: 0, y: 0 },
  }
}

test('captures independent left and right levels from the world surface', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const visibilityTarget = new FakeVisibilityTarget()
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectPointer: ({ x, y }) => ({ x: x + 1_000, y: y + 2_000 }),
    target,
    visibilityTarget,
  })

  assert.equal(mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 20, 30)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_020, y: 2_030 }, true, false))

  assert.equal(mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 21, 31)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_021, y: 2_031 }, true, true))

  assert.equal(target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 40, 50)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_040, y: 2_050 }, true, true))

  assert.equal(target.dispatchEvent(new FakeMouseEvent('mouseup', 0, 41, 51)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_041, y: 2_051 }, false, true))

  assert.equal(target.dispatchEvent(new FakeMouseEvent('mouseup', 2, 42, 52)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_042, y: 2_052 }, false, false))
  input.destroy()
})

test('ignores non-world downs but keeps move and release capture outside the surface', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  target.dispatchEvent(new FakeMouseEvent('mousedown', 0, 5, 6))
  assert.equal(published.length, 0)

  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 7, 8))
  target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 70, 80))
  target.dispatchEvent(new FakeMouseEvent('mouseup', 0, 90, 100))
  assert.deepEqual(published.at(-1), expectedInput({ x: 90, y: 100 }, false, false))
  input.destroy()
})

test('cancels the browser context menu only on the gameplay surface', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: () => {},
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  assert.equal(mouseTarget.dispatchEvent(new Event('contextmenu', { cancelable: true })), false)
  assert.equal(target.dispatchEvent(new Event('contextmenu', { cancelable: true })), true)
  input.destroy()
})

test('reprojects held aim while sampling and synchronously clears every lane on interruption', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const visibilityTarget = new FakeVisibilityTarget()
  const published: PlayerCharacterInput[] = []
  let cameraX = 100
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectPointer: ({ x, y }) => ({ x: x + cameraX, y }),
    target,
    visibilityTarget,
  })

  input.setTouch({ x: 1, y: 0 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 10, 20))
  cameraX = 200
  assert.deepEqual(input.sample(), {
    device: 'touch',
    input: {
      aim: { x: 210, y: 20 },
      cast: { primary: false, secondary: true },
      movement: { x: 1, y: 0 },
    },
  })

  visibilityTarget.visibilityState = 'hidden'
  visibilityTarget.dispatchEvent(new Event('visibilitychange'))
  assert.deepEqual(published.at(-1), expectedInput(null, false, false))
  assert.deepEqual(input.sample(), { device: 'none', input: expectedInput(null, false, false) })

  input.setTouch({ x: 0, y: -1 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 5, 6))
  target.dispatchEvent(new Event('blur'))
  assert.deepEqual(published.at(-1), expectedInput(null, false, false))

  input.setTouch({ x: 0, y: 1 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 1, 2))
  target.dispatchEvent(new Event('pagehide'))
  assert.deepEqual(published.at(-1), expectedInput(null, false, false))

  input.setTouch({ x: -1, y: 0 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 3, 4))
  input.destroy()
  assert.deepEqual(published.at(-1), expectedInput(null, false, false))
})

test('blocking owns input immediately and drops barrier-time state', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  input.setTouch({ x: 1, y: 0 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 20, 30))
  assert.equal(input.sample().device, 'touch')
  assert.equal(input.sample().input.cast.primary, true)

  input.setBlocked(true)
  assert.deepEqual(published.at(-1), expectedInput(null, false, false))
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, false),
  })

  const publishedAtBarrier = published.length
  input.setTouch({ x: 0, y: -1 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 40, 50))
  assert.equal(published.length, publishedAtBarrier)
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, false),
  })

  input.setBlocked(false)
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, false),
  })
  input.setTouch({ x: 0, y: 1 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 60, 70))
  assert.equal(input.sample().device, 'touch')
  assert.deepEqual(input.sample().input, {
    aim: { x: 60, y: 70 },
    cast: { primary: false, secondary: true },
    movement: { x: 0, y: 1 },
  })
  input.destroy()
})
