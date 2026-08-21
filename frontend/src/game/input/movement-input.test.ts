import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAMEPAD_MOVEMENT_DEAD_ZONE,
  createBrowserMovementInput,
  createMovementInputState,
  movementFromGamepads,
  normalizeMovement,
  joystickVector,
  radialDeadZone,
  type GamepadLike,
} from './movement-input.ts'
import { DEFAULT_GAME_CONTROL_BINDINGS, rebindGameControl } from '../game-settings.ts'

function gamepad(x: number, y: number, index = 0): GamepadLike {
  return { axes: [x, y], connected: true, index, mapping: 'standard' }
}

function dpad(...pressed: number[]): GamepadLike {
  return {
    axes: [],
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: pressed.includes(index),
      value: pressed.includes(index) ? 1 : 0,
    })),
    connected: true,
    index: 0,
    mapping: 'standard',
  }
}

function closeTo(actual: number, expected: number, epsilon = 0.000_001): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`)
}

class FakeVisibilityTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'
}

test('keyboard input uses the configured physical bindings with normalized diagonals', () => {
  const input = createMovementInputState()
  assert.equal(input.press('KeyD'), true)
  assert.deepEqual(input.sample(), { device: 'keyboard', movement: { x: 1, y: 0 } })
  input.press('KeyW')
  const diagonal = input.sample()
  assert.equal(diagonal.device, 'keyboard')
  closeTo(diagonal.movement.x, Math.SQRT1_2)
  closeTo(diagonal.movement.y, -Math.SQRT1_2)

  assert.equal(input.press('ArrowLeft'), false)
  input.setControls(rebindGameControl(DEFAULT_GAME_CONTROL_BINDINGS, 'moveLeft', 'ArrowLeft'))
  input.press('ArrowLeft')
  assert.deepEqual(input.sample().movement, { x: -1, y: 0 })
  assert.equal(input.press('Space'), false)
  assert.equal(input.release('Space'), false)
})

test('key release and cancellation clear every retained input lane', () => {
  const input = createMovementInputState()
  input.press('KeyA')
  input.press('KeyS')
  input.setTouch({ x: 0.25, y: -0.5 })
  assert.equal(input.sample().device, 'touch')
  input.clear()
  assert.deepEqual(input.sample(), { device: 'none', movement: { x: 0, y: 0 } })
  assert.equal(input.release('KeyA'), true)
})

test('browser lifecycle interruption clears local input and publishes an immediate stop', () => {
  const target = new EventTarget()
  const visibilityTarget = new FakeVisibilityTarget()
  let stops = 0
  const input = createBrowserMovementInput({
    getGamepads: () => [],
    onStop: () => { stops += 1 },
    target,
    visibilityTarget,
  })

  input.setTouch({ x: 1, y: 0 })
  target.dispatchEvent(new Event('blur'))
  assert.deepEqual(input.sample(), { device: 'none', movement: { x: 0, y: 0 } })
  assert.equal(stops, 1)

  input.setTouch({ x: 0, y: 1 })
  visibilityTarget.visibilityState = 'visible'
  visibilityTarget.dispatchEvent(new Event('visibilitychange'))
  assert.equal(input.sample().device, 'touch')
  assert.equal(stops, 1)

  visibilityTarget.visibilityState = 'hidden'
  visibilityTarget.dispatchEvent(new Event('visibilitychange'))
  assert.deepEqual(input.sample(), { device: 'none', movement: { x: 0, y: 0 } })
  assert.equal(stops, 2)

  input.setTouch({ x: -1, y: 0 })
  target.dispatchEvent(new Event('pagehide'))
  assert.deepEqual(input.sample(), { device: 'none', movement: { x: 0, y: 0 } })
  assert.equal(stops, 3)

  input.setTouch({ x: 0, y: -1 })
  input.destroy()
  assert.equal(stops, 4)
  target.dispatchEvent(new Event('blur'))
  visibilityTarget.dispatchEvent(new Event('visibilitychange'))
  assert.equal(stops, 4)
})

test('browser movement blocking clears retained state and ignores barrier-time touch', () => {
  const target = new EventTarget()
  let stops = 0
  const input = createBrowserMovementInput({
    getGamepads: () => [],
    onStop: () => { stops += 1 },
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  input.setTouch({ x: 1, y: 0 })
  assert.equal(input.sample().device, 'touch')
  input.setBlocked(true)
  assert.equal(stops, 1)
  assert.deepEqual(input.sample(), { device: 'none', movement: { x: 0, y: 0 } })

  input.setTouch({ x: 0, y: -1 })
  input.setBlocked(true)
  assert.equal(stops, 1)
  assert.deepEqual(input.sample(), { device: 'none', movement: { x: 0, y: 0 } })

  input.setBlocked(false)
  assert.deepEqual(input.sample(), { device: 'none', movement: { x: 0, y: 0 } })
  input.setTouch({ x: 0, y: 1 })
  assert.deepEqual(input.sample(), { device: 'touch', movement: { x: 0, y: 1 } })
  input.destroy()
})

test('radial gamepad dead zone removes drift and rescales useful travel continuously', () => {
  assert.deepEqual(radialDeadZone(0.1, 0, GAMEPAD_MOVEMENT_DEAD_ZONE), { x: 0, y: 0 })
  const justOutside = radialDeadZone(0.3, 0, GAMEPAD_MOVEMENT_DEAD_ZONE)
  closeTo(justOutside.x, 0.125)
  assert.equal(justOutside.y, 0)
  const diagonal = radialDeadZone(1, 1, GAMEPAD_MOVEMENT_DEAD_ZONE)
  closeTo(Math.hypot(diagonal.x, diagonal.y), 1)
  assert.deepEqual(radialDeadZone(Number.NaN, 1, GAMEPAD_MOVEMENT_DEAD_ZONE), { x: 0, y: 0 })
})

test('selects the first active connected gamepad and ignores disconnected reports', () => {
  const disconnected = { ...gamepad(1, 0), connected: false }
  const movement = movementFromGamepads([disconnected, gamepad(0, -1, 2)])
  assert.deepEqual(movement, { x: 0, y: -1 })
  assert.deepEqual(movementFromGamepads([gamepad(0.1, 0.1)]), { x: 0, y: 0 })
})

test('standard D-pad buttons provide cardinal and normalized diagonal movement', () => {
  assert.deepEqual(movementFromGamepads([dpad(15)]), { x: 1, y: 0 })
  const diagonal = movementFromGamepads([dpad(12, 14)])
  closeTo(diagonal.x, -Math.SQRT1_2)
  closeTo(diagonal.y, -Math.SQRT1_2)
})

test('touch, gamepad, and keyboard precedence is deterministic', () => {
  const input = createMovementInputState()
  input.press('KeyA')
  assert.equal(input.sample([gamepad(1, 0)]).device, 'gamepad')
  input.setTouch({ x: 0, y: 0.5 })
  assert.deepEqual(input.sample([gamepad(1, 0)]), {
    device: 'touch',
    movement: { x: 0, y: 0.5 },
  })
  input.setTouch({ x: 0, y: 0 })
  assert.equal(input.sample([gamepad(0, 0)]).device, 'keyboard')
})

test('normalization rejects invalid vectors and caps excess magnitude', () => {
  assert.deepEqual(normalizeMovement({ x: Number.POSITIVE_INFINITY, y: 0 }), { x: 0, y: 0 })
  assert.deepEqual(normalizeMovement({ x: 0.25, y: 0.5 }), { x: 0.25, y: 0.5 })
  const normalized = normalizeMovement({ x: 3, y: 4 })
  assert.deepEqual(normalized, { x: 0.6, y: 0.8 })
})

test('touch joystick maps its visual radius to a normalized movement vector', () => {
  assert.deepEqual(joystickVector({ x: 50, y: 50 }, { x: 50, y: 50 }, 40), { x: 0, y: 0 })
  assert.deepEqual(joystickVector({ x: 90, y: 50 }, { x: 50, y: 50 }, 40), { x: 1, y: 0 })
  const diagonal = joystickVector({ x: 90, y: 90 }, { x: 50, y: 50 }, 40)
  closeTo(diagonal.x, Math.SQRT1_2)
  closeTo(diagonal.y, Math.SQRT1_2)
  assert.deepEqual(joystickVector({ x: 90, y: 50 }, { x: 50, y: 50 }, 0), { x: 0, y: 0 })
})
