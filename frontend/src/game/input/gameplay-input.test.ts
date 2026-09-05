import assert from 'node:assert/strict'
import test from 'node:test'

import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import { DEFAULT_GAME_CONTROL_BINDINGS, rebindGameControl } from '../game-settings.ts'
import { createBrowserGameplayInput } from './gameplay-input.ts'
import type { GamepadLike } from './movement-input.ts'

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

class FakeKeyboardEvent extends Event {
  readonly code: string
  readonly repeat: boolean

  constructor(type: string, code: string, repeat = false) {
    super(type, { cancelable: true })
    this.code = code
    this.repeat = repeat
  }
}

class FakeVisibilityTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'
}

function mutableStandardGamepad(index = 0, mapping = 'standard') {
  const axes = [0, 0, 0, 0]
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))
  const gamepad: GamepadLike = { axes, buttons, connected: true, index, mapping }
  return {
    axes,
    buttons,
    gamepad,
    releaseButton(button: number) {
      buttons[button] = { pressed: false, value: 0 }
    },
    pressButton(button: number, value = 1) {
      buttons[button] = { pressed: true, value }
    },
  }
}

function expectedInput(
  aim: { x: number; y: number } | null,
  primary: boolean,
  quickbar: number | null,
): PlayerCharacterInput {
  return {
    aim,
    cast: { primary, quickbar },
    movement: { x: 0, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
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
    projectDirection: ({ x, y }) => ({ x: x * 100, y: y * 100 }),
    projectPointer: ({ x, y }) => ({ x: x + 1_000, y: y + 2_000 }),
    target,
    visibilityTarget,
  })

  assert.equal(mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 20, 30)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_020, y: 2_030 }, true, null))

  assert.equal(mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 21, 31)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_021, y: 2_031 }, true, 0))

  assert.equal(target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 40, 50)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_040, y: 2_050 }, true, 0))

  assert.equal(target.dispatchEvent(new FakeMouseEvent('mouseup', 0, 41, 51)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_041, y: 2_051 }, false, 0))

  assert.equal(target.dispatchEvent(new FakeMouseEvent('mouseup', 2, 42, 52)), false)
  assert.deepEqual(published.at(-1), expectedInput({ x: 1_042, y: 2_052 }, false, null))
  input.destroy()
})

test('a local presentation owner can claim either mouse edge before casting', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const claimed: string[] = []
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    claimMouseCastStart: (lane) => {
      claimed.push(lane)
      return true
    },
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectDirection: ({ x, y }) => ({ x, y }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  assert.equal(mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 20, 30)), false)
  assert.equal(mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 40, 50)), false)
  target.dispatchEvent(new FakeMouseEvent('mouseup', 0, 20, 30))
  target.dispatchEvent(new FakeMouseEvent('mouseup', 2, 40, 50))

  assert.deepEqual(claimed, ['primary', 'secondary'])
  assert.deepEqual(published, [])
  assert.deepEqual(input.sample().input, expectedInput(null, false, null))
  input.destroy()
})

test('a noncombat scene suppresses primary mouse and touch without blocking movement or quickbar input', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    primaryCastingEnabled: false,
    projectDirection: ({ x, y }) => ({ x: x * 100, y: y * 100 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  assert.equal(mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 20, 30)), true)
  input.setTouchPrimary({ x: 1, y: 0 })
  assert.deepEqual(published, [])

  input.setTouch({ x: 1, y: 0 })
  input.setTouchQuickbar(3, true, { x: 0, y: -1 })
  assert.deepEqual(input.sample().input, {
    aim: { x: 0, y: -100 },
    cast: { primary: false, quickbar: 3 },
    movement: { x: 1, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  })
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
    projectDirection: ({ x, y }) => ({ x: x * 100, y: y * 100 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  target.dispatchEvent(new FakeMouseEvent('mousedown', 0, 5, 6))
  assert.equal(published.length, 0)

  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 7, 8))
  target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 70, 80))
  target.dispatchEvent(new FakeMouseEvent('mouseup', 0, 90, 100))
  assert.deepEqual(published.at(-1), expectedInput({ x: 90, y: 100 }, false, null))
  input.destroy()
})

test('cancels the browser context menu only on the gameplay surface', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: () => {},
    projectDirection: ({ x, y }) => ({ x: x * 100, y: y * 100 }),
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
    projectDirection: ({ x, y }) => ({ x: x + cameraX, y }),
    projectPointer: ({ x, y }) => ({ x: x + cameraX, y }),
    target,
    visibilityTarget,
  })

  input.setTouch({ x: 1, y: 0 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 10, 20))
  input.setTouchPrimary({ x: 1, y: 0 })
  cameraX = 200
  assert.deepEqual(input.sample(), {
    device: 'touch',
    input: {
      aim: { x: 201, y: 0 },
      cast: { primary: true, quickbar: 0 },
      movement: { x: 1, y: 0 },
      viewportHeight: 900,
      viewportWidth: 1_600,
    },
  })

  visibilityTarget.visibilityState = 'hidden'
  visibilityTarget.dispatchEvent(new Event('visibilitychange'))
  assert.deepEqual(published.at(-1), expectedInput(null, false, null))
  assert.deepEqual(input.sample(), { device: 'none', input: expectedInput(null, false, null) })

  input.setTouch({ x: 0, y: -1 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 5, 6))
  target.dispatchEvent(new Event('blur'))
  assert.deepEqual(published.at(-1), expectedInput(null, false, null))

  input.setTouch({ x: 0, y: 1 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 1, 2))
  target.dispatchEvent(new Event('pagehide'))
  assert.deepEqual(published.at(-1), expectedInput(null, false, null))

  input.setTouch({ x: -1, y: 0 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 3, 4))
  input.destroy()
  assert.deepEqual(published.at(-1), expectedInput(null, false, null))
})

test('blocking owns input immediately and drops barrier-time state', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectDirection: ({ x, y }) => ({ x: x * 100, y: y * 100 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  input.setTouch({ x: 1, y: 0 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 20, 30))
  input.setTouchPrimary({ x: 1, y: 0 })
  input.setTouchQuickbar(7, true)
  assert.equal(input.sample().device, 'touch')
  assert.equal(input.sample().input.cast.primary, true)
  assert.equal(input.sample().input.cast.quickbar, 7)

  input.setBlocked(true)
  assert.deepEqual(published.at(-1), expectedInput(null, false, null))
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, null),
  })

  const publishedAtBarrier = published.length
  input.setTouch({ x: 0, y: -1 })
  input.setTouchPrimary({ x: 0, y: -1 })
  input.setTouchQuickbar(6, true)
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 40, 50))
  assert.equal(published.length, publishedAtBarrier)
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, null),
  })

  input.setBlocked(false)
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, null),
  })
  input.setTouch({ x: 0, y: 1 })
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 60, 70))
  assert.equal(input.sample().device, 'touch')
  assert.deepEqual(input.sample().input, {
    aim: { x: 60, y: 70 },
    cast: { primary: false, quickbar: 0 },
    movement: { x: 0, y: 1 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  })
  input.destroy()
})

test('touch primary reprojects held direction, retains released aim, and coexists with movement', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  let playerX = 100
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectDirection: ({ x, y }) => ({ x: playerX + x * 10, y: 200 + y * 10 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  input.setTouch({ x: -1, y: 0 })
  input.setTouchPrimary({ x: 2, y: 0 })
  assert.deepEqual(published.at(-1), {
    aim: { x: 110, y: 200 },
    cast: { primary: true, quickbar: null },
    movement: { x: -1, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  })
  assert.equal(input.sample().device, 'touch')

  playerX = 300
  assert.deepEqual(input.sample().input, {
    aim: { x: 310, y: 200 },
    cast: { primary: true, quickbar: null },
    movement: { x: -1, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  })

  input.setTouchPrimary({ x: 0, y: 0 })
  assert.deepEqual(published.at(-1), {
    aim: { x: 310, y: 200 },
    cast: { primary: false, quickbar: null },
    movement: { x: -1, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  })
  input.destroy()
})

test('touch and mouse primary levels compose without stealing each other release', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectDirection: ({ x, y }) => ({ x: x * 100, y: y * 100 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 0, 20, 30))
  input.setTouchPrimary({ x: 1, y: 0 })
  assert.deepEqual(published.at(-1), expectedInput({ x: 100, y: 0 }, true, null))

  input.setTouchPrimary({ x: 0, y: 0 })
  assert.deepEqual(published.at(-1), expectedInput({ x: 20, y: 30 }, true, null))

  target.dispatchEvent(new FakeMouseEvent('mouseup', 0, 20, 30))
  assert.deepEqual(published.at(-1), expectedInput({ x: 20, y: 30 }, false, null))
  input.destroy()
})

test('right mouse and digits one through seven address all native skill quickbar slots', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectDirection: ({ x, y }) => ({ x, y }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 20, 30))
  assert.equal(published.at(-1)?.cast.quickbar, 0)

  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit1'))
  assert.equal(published.at(-1)?.cast.quickbar, 1)
  const afterFirstEdge = published.length
  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit1', true))
  assert.equal(published.length, afterFirstEdge)

  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit7'))
  assert.equal(published.at(-1)?.cast.quickbar, 7)
  target.dispatchEvent(new FakeKeyboardEvent('keyup', 'Digit7'))
  assert.equal(published.at(-1)?.cast.quickbar, 1)
  target.dispatchEvent(new FakeKeyboardEvent('keyup', 'Digit1'))
  assert.equal(published.at(-1)?.cast.quickbar, 0)
  target.dispatchEvent(new FakeMouseEvent('mouseup', 2, 20, 30))
  assert.equal(published.at(-1)?.cast.quickbar, null)

  const afterRelease = published.length
  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit0'))
  assert.equal(published.length, afterRelease)
  input.destroy()
})

test('heterogeneous belt actions claim potion slots on their stock and rebound press edges', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const claimed: number[] = []
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    claimQuickbarPress: (slot) => {
      if (slot !== 3 && slot !== 4) return false
      claimed.push(slot)
      return true
    },
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectDirection: ({ x, y }) => ({ x, y }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit3'))
  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit3', true))
  target.dispatchEvent(new FakeKeyboardEvent('keyup', 'Digit3'))
  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit4'))
  assert.deepEqual(claimed, [3, 4])
  assert.deepEqual(published, [])

  input.setControls(rebindGameControl(DEFAULT_GAME_CONTROL_BINDINGS, 'belt4', 'KeyQ'))
  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'KeyQ'))
  assert.deepEqual(claimed, [3, 4, 3])

  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit1'))
  assert.equal(published.at(-1)?.cast.quickbar, 1)
  input.destroy()
})

test('live binding changes reroute quickbar input and pointer-off secondary uses actor heading', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  const controls = rebindGameControl(DEFAULT_GAME_CONTROL_BINDINGS, 'belt8', 'KeyQ')
  const input = createBrowserGameplayInput({
    controls,
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectDirection: ({ x, y }) => ({ x, y }),
    projectPointer: ({ x, y }) => ({ x: x + 1_000, y: y + 2_000 }),
    projectSecondaryAim: () => ({ x: 75, y: 25 }),
    secondaryAtPointer: () => false,
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'KeyQ'))
  assert.equal(published.at(-1)?.cast.quickbar, 7)
  target.dispatchEvent(new FakeKeyboardEvent('keyup', 'KeyQ'))
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 20, 30))
  assert.deepEqual(published.at(-1), expectedInput({ x: 75, y: 25 }, false, 0))
  target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 40, 50))
  assert.deepEqual(published.at(-1), expectedInput({ x: 75, y: 25 }, false, 0))

  const swapped = rebindGameControl(controls, 'belt1', 'KeyZ')
  input.setControls(swapped)
  const afterRebind = published.length
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 20, 30))
  assert.equal(published.length, afterRebind)
  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'KeyZ'))
  assert.equal(published.at(-1)?.cast.quickbar, 0)
  input.destroy()
})

test('touch addresses all eight quickbar slots without stealing mouse or older touch holds', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const published: PlayerCharacterInput[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [],
    mouseTarget,
    onInput: (state) => published.push(state),
    projectDirection: ({ x, y }) => ({ x: x * 100, y: y * 100 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  input.setTouchQuickbar(0, true, { x: 1, y: 0 })
  assert.deepEqual(published.at(-1), expectedInput({ x: 100, y: 0 }, false, 0))
  mouseTarget.dispatchEvent(new FakeMouseEvent('mousedown', 2, 20, 30))
  input.setTouchQuickbar(0, false)
  assert.equal(published.at(-1)?.cast.quickbar, 0)
  target.dispatchEvent(new FakeMouseEvent('mouseup', 2, 20, 30))
  assert.equal(published.at(-1)?.cast.quickbar, null)

  for (let slot = 0; slot < 8; slot += 1) {
    input.setTouchQuickbar(slot, true)
    assert.equal(published.at(-1)?.cast.quickbar, slot)
    input.setTouchQuickbar(slot, false)
    assert.equal(published.at(-1)?.cast.quickbar, null)
  }

  input.setTouchQuickbar(2, true)
  input.setTouchQuickbar(7, true)
  assert.equal(published.at(-1)?.cast.quickbar, 7)
  input.setTouchQuickbar(7, false)
  assert.equal(published.at(-1)?.cast.quickbar, 2)
  input.setTouchQuickbar(2, false)
  assert.equal(published.at(-1)?.cast.quickbar, null)
  input.destroy()
})

test('standard gamepad supplies retained twin-stick aim and authoritative held cast levels', () => {
  const mouseTarget = new EventTarget()
  const target = new EventTarget()
  const pad = mutableStandardGamepad()
  let playerX = 100
  const input = createBrowserGameplayInput({
    getGamepads: () => [pad.gamepad],
    mouseTarget,
    onInput: () => {},
    projectDirection: ({ x, y }) => ({ x: playerX + x * 100, y: 200 + y * 100 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  pad.axes[2] = 1
  pad.pressButton(7, 0.75)
  assert.deepEqual(input.sample().input, {
    aim: { x: 200, y: 200 },
    cast: { primary: true, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  })

  pad.axes[2] = -1
  assert.deepEqual(input.sample().input, {
    aim: { x: 0, y: 200 },
    cast: { primary: true, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  })

  pad.axes[2] = 0
  pad.releaseButton(7)
  playerX = 300
  assert.deepEqual(input.sample().input, {
    aim: { x: 200, y: 200 },
    cast: { primary: false, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  })
  input.destroy()
})

test('gamepad bumpers select every quickbar slot and X holds the stable selected slot', () => {
  const pad = mutableStandardGamepad()
  const selected: number[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [pad.gamepad],
    mouseTarget: new EventTarget(),
    onGamepadQuickbarSelection: (slot) => selected.push(slot),
    onInput: () => {},
    projectDirection: ({ x, y }) => ({ x, y }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target: new EventTarget(),
    visibilityTarget: new FakeVisibilityTarget(),
  })

  const pulse = (button: number) => {
    pad.pressButton(button)
    input.sample()
    pad.releaseButton(button)
    input.sample()
  }
  pulse(5)
  assert.deepEqual(selected, [1])

  pad.pressButton(2)
  assert.equal(input.sample().input.cast.quickbar, 1)
  pad.pressButton(5)
  assert.equal(input.sample().input.cast.quickbar, 1)
  assert.deepEqual(selected, [1], 'a held cast owns its slot until release')
  pad.releaseButton(2)
  pad.releaseButton(5)
  assert.equal(input.sample().input.cast.quickbar, null)

  for (let slot = 2; slot <= 7; slot += 1) pulse(5)
  assert.deepEqual(selected, [1, 2, 3, 4, 5, 6, 7])
  pulse(5)
  assert.equal(selected.at(-1), 0)
  pulse(4)
  assert.equal(selected.at(-1), 7)
  pad.pressButton(2)
  assert.equal(input.sample().input.cast.quickbar, 7)
  input.destroy()
})

test('gamepad scene actions are rising edges and an idle earlier pad cannot mask the active pad', () => {
  const idle = mutableStandardGamepad(0)
  const active = mutableStandardGamepad(1)
  const actions: string[] = []
  const input = createBrowserGameplayInput({
    getGamepads: () => [idle.gamepad, active.gamepad],
    mouseTarget: new EventTarget(),
    onGamepadAction: (action) => actions.push(action),
    onInput: () => {},
    projectDirection: ({ x, y }) => ({ x: x * 10, y: y * 10 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target: new EventTarget(),
    visibilityTarget: new FakeVisibilityTarget(),
  })

  for (const [button, action] of [
    [0, 'interact'],
    [3, 'skills'],
    [8, 'inventory'],
    [9, 'pause'],
  ] as const) {
    active.pressButton(button)
    input.sample()
    input.sample()
    active.releaseButton(button)
    input.sample()
    assert.equal(actions.at(-1), action)
  }
  assert.deepEqual(actions, ['interact', 'skills', 'inventory', 'pause'])

  active.axes[0] = 1
  assert.equal(input.sample().device, 'gamepad')
  assert.deepEqual(input.sample().input.movement, { x: 1, y: 0 })
  input.destroy()
})

test('blocking, interruption, and disconnect require neutral before controller input rearms', () => {
  const pad = mutableStandardGamepad()
  const pads: Array<GamepadLike | null> = [pad.gamepad]
  const target = new EventTarget()
  const input = createBrowserGameplayInput({
    getGamepads: () => pads,
    mouseTarget: new EventTarget(),
    onInput: () => {},
    projectDirection: ({ x, y }) => ({ x: x * 100, y: y * 100 }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target,
    visibilityTarget: new FakeVisibilityTarget(),
  })

  pad.axes[0] = 1
  pad.axes[2] = 1
  pad.pressButton(7)
  assert.equal(input.sample().device, 'gamepad')
  assert.equal(input.sample().input.cast.primary, true)

  input.setBlocked(true)
  input.setBlocked(false)
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, null),
  })
  pad.axes.fill(0)
  pad.releaseButton(7)
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, null),
  })
  pad.axes[0] = 1
  pad.pressButton(7)
  assert.equal(input.sample().device, 'gamepad')
  assert.equal(input.sample().input.cast.primary, true)

  target.dispatchEvent(new Event('blur'))
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, null),
  })
  pad.axes.fill(0)
  pad.releaseButton(7)
  input.sample()
  pad.axes[0] = -1
  assert.deepEqual(input.sample().input.movement, { x: -1, y: 0 })

  pads[0] = null
  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, null),
  })
  input.destroy()
})

test('unmapped raw pads do not guess the standard button and axis layout', () => {
  const pad = mutableStandardGamepad(0, '')
  pad.axes[0] = 1
  pad.axes[2] = 1
  pad.pressButton(7)
  const input = createBrowserGameplayInput({
    getGamepads: () => [pad.gamepad],
    mouseTarget: new EventTarget(),
    onInput: () => {},
    projectDirection: ({ x, y }) => ({ x, y }),
    projectPointer: ({ x, y }) => ({ x, y }),
    target: new EventTarget(),
    visibilityTarget: new FakeVisibilityTarget(),
  })

  assert.deepEqual(input.sample(), {
    device: 'none',
    input: expectedInput(null, false, null),
  })
  input.destroy()
})

for (const key of ['Digit1', 'Digit4', 'Digit7']) {
  test(`idle cursor is sampled by ${key} without an earlier mouse cast`, () => {
    const mouseTarget = new EventTarget()
    const target = new EventTarget()
    const published: PlayerCharacterInput[] = []
    let cameraX = 1000
    const input = createBrowserGameplayInput({
      getGamepads: () => [], mouseTarget, target,
      visibilityTarget: new FakeVisibilityTarget(),
      onInput: (state) => published.push(state),
      projectDirection: (direction) => direction,
      projectPointer: ({ x, y }) => ({ x: cameraX + x, y: 2000 + y }),
    })
    target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 50, 80))
    assert.equal(published.length, 0, 'hover must not issue gameplay input')
    assert.equal(input.sample().input.aim, null, 'hover must not turn the wizard')
    target.dispatchEvent(new FakeKeyboardEvent('keydown', key))
    assert.deepEqual(published.at(-1)?.aim, { x: 1050, y: 2080 })
    cameraX = 1200
    assert.deepEqual(input.sample().input.aim, { x: 1250, y: 2080 },
      'a held keyboard cast must reproject a stationary screen cursor as the camera moves')
    target.dispatchEvent(new FakeKeyboardEvent('keyup', key))
    target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 300, 120))
    target.dispatchEvent(new FakeKeyboardEvent('keydown', key))
    assert.deepEqual(published.at(-1)?.aim, { x: 1500, y: 2120 })
    input.destroy()
  })
}

test('keyboard secondary uses the same non-pointer fallback as a mouse secondary', () => {
  const target = new EventTarget()
  let forward = { x: 30, y: 60 }
  const input = createBrowserGameplayInput({
    getGamepads: () => [], mouseTarget: new EventTarget(), target,
    visibilityTarget: new FakeVisibilityTarget(), onInput: () => {},
    projectDirection: (direction) => direction,
    projectPointer: () => ({ x: 999, y: 999 }),
    projectSecondaryAim: () => forward,
    secondaryAtPointer: () => false,
  })
  target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 40, 50))
  target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit1'))
  assert.deepEqual(input.sample().input.aim, forward)
  forward = { x: 70, y: 80 }
  assert.deepEqual(input.sample().input.aim, forward)
  input.destroy()
})

for (const interruption of ['blur', 'blocked'] as const) {
  test(`a fresh keyboard cast samples the retained cursor after ${interruption} without retaining held input`, () => {
    const target = new EventTarget()
    const published: PlayerCharacterInput[] = []
    let cameraX = 100
    const input = createBrowserGameplayInput({
      getGamepads: () => [], mouseTarget: new EventTarget(), target,
      visibilityTarget: new FakeVisibilityTarget(),
      onInput: (state) => published.push(state),
      projectDirection: (direction) => direction,
      projectPointer: ({ x, y }) => ({ x: cameraX + x, y }),
    })
    target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 50, 80))
    target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit1'))
    if (interruption === 'blur') target.dispatchEvent(new Event('blur'))
    else input.setBlocked(true)
    assert.deepEqual(published.at(-1), expectedInput(null, false, null))
    if (interruption === 'blocked') {
      const before = published.length
      target.dispatchEvent(new FakeMouseEvent('mousemove', 0, 70, 90))
      assert.equal(published.length, before)
      input.setBlocked(false)
    }
    assert.deepEqual(input.sample().input, expectedInput(null, false, null))
    cameraX = 300
    target.dispatchEvent(new FakeKeyboardEvent('keydown', 'Digit1'))
    assert.deepEqual(input.sample().input.aim,
      interruption === 'blur' ? { x: 350, y: 80 } : { x: 370, y: 90 })
    input.destroy()
  })
}
