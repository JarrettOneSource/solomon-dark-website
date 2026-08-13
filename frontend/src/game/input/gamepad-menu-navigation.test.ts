import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chooseInitialMenuTarget,
  chooseSpatialTarget,
  readMenuGamepad,
  type SpatialCandidate,
} from './gamepad-menu-navigation.ts'

function button(pressed = false): GamepadButton {
  return { pressed, touched: pressed, value: pressed ? 1 : 0 }
}

function gamepad(
  axes: readonly number[] = [0, 0],
  pressed: readonly number[] = [],
) {
  const buttons = Array.from({ length: 16 }, (_, index) => button(pressed.includes(index)))
  return { axes, buttons, connected: true, index: 0, mapping: 'standard' }
}

test('reads standard confirm, back, d-pad, and stick navigation', () => {
  assert.deepEqual(readMenuGamepad([gamepad([0, 0], [0, 14])]), {
    back: false,
    confirm: true,
    direction: 'left',
  })
  assert.deepEqual(readMenuGamepad([gamepad([0.8, 0], [1])]), {
    back: true,
    confirm: false,
    direction: 'right',
  })
  assert.equal(readMenuGamepad([gamepad([0, -0.61])]).direction, null)
  assert.equal(readMenuGamepad([gamepad([0, -0.62])]).direction, 'up')
})

test('ignores disconnected pads and uses the first connected pad', () => {
  const disconnected = { ...gamepad([1, 0]), connected: false }
  assert.equal(readMenuGamepad([disconnected, gamepad([0, 1])]).direction, 'down')
  assert.deepEqual(readMenuGamepad([disconnected]), {
    back: false,
    confirm: false,
    direction: null,
  })
})

test('accepts activity from a later controller when the first connected pad is idle', () => {
  assert.equal(readMenuGamepad([gamepad(), gamepad([-0.8, 0])]).direction, 'left')
})

test('spatial navigation favours the nearest candidate in the requested half-plane', () => {
  const candidate = (value: string, left: number, top: number): SpatialCandidate<string> => ({
    value,
    bounds: { left, right: left + 80, top, bottom: top + 40, width: 80, height: 40 },
  })
  const current = candidate('current', 100, 100)
  const candidates = [
    current,
    candidate('right-aligned', 210, 100),
    candidate('right-diagonal', 160, 220),
    candidate('left', 0, 100),
    candidate('above', 100, 20),
  ]
  assert.equal(chooseSpatialTarget(current, candidates, 'right'), 'right-aligned')
  assert.equal(chooseSpatialTarget(current, candidates, 'left'), 'left')
  assert.equal(chooseSpatialTarget(current, candidates, 'up'), 'above')
})

test('initial navigation waits for a declared default instead of falling into another action', () => {
  const back = { id: 'back' }
  const preferred = { id: 'preferred' }
  assert.equal(chooseInitialMenuTarget([back], [preferred]), null)
  assert.equal(chooseInitialMenuTarget([back, preferred], [preferred]), preferred)
  assert.equal(chooseInitialMenuTarget([back], []), back)
})
