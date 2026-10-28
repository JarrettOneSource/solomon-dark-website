import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceMenuDirectionRepeat,
  chooseInitialMenuTarget,
  chooseSpatialTarget,
  createGamepadMenuNavigation,
  readMenuGamepad,
  requiresNeutralAfterMenuScopeChange,
  type SpatialCandidate,
} from './gamepad-menu-navigation.ts'
import { createGamepadSampling } from './gamepad-sampling.ts'

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

function frameHarness() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextFrame = 1
  return {
    cancelFrame(frame: number) {
      callbacks.delete(frame)
    },
    requestFrame(callback: FrameRequestCallback) {
      const frame = nextFrame
      nextFrame += 1
      callbacks.set(frame, callback)
      return frame
    },
    run(now = 0) {
      const pending = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      assert.ok(pending, 'expected a scheduled animation frame')
      callbacks.delete(pending[0])
      pending[1](now)
    },
    get size() {
      return callbacks.size
    },
  }
}

function emptyNavigationRoot(): ParentNode {
  return {
    querySelectorAll: () => [],
  } as unknown as ParentNode
}

test('reads standard confirm, back, d-pad, and stick navigation', () => {
  assert.deepEqual(readMenuGamepad([gamepad([0, 0], [0, 14])]), {
    back: false,
    confirm: true,
    direction: 'left',
    next: false,
    previous: false,
  })
  assert.deepEqual(readMenuGamepad([gamepad([0.8, 0], [1])]), {
    back: true,
    confirm: false,
    direction: 'right',
    next: false,
    previous: false,
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
    next: false,
    previous: false,
  })
})

test('accepts activity from a later controller when the first connected pad is idle', () => {
  assert.equal(readMenuGamepad([gamepad(), gamepad([-0.8, 0])]).direction, 'left')
})

test('maps bumpers to previous and next and ignores raw unmapped layouts', () => {
  assert.deepEqual(readMenuGamepad([gamepad([0, 0], [4])]), {
    back: false,
    confirm: false,
    direction: null,
    next: false,
    previous: true,
  })
  assert.deepEqual(readMenuGamepad([gamepad([0, 0], [5])]), {
    back: false,
    confirm: false,
    direction: null,
    next: true,
    previous: false,
  })
  assert.deepEqual(readMenuGamepad([{ ...gamepad([1, 0], [0]), mapping: '' }]), {
    back: false,
    confirm: false,
    direction: null,
    next: false,
    previous: false,
  })
})

test('opening, closing, and replacing scopes neutralize held but not fresh actions', () => {
  const neutral = readMenuGamepad([gamepad()])
  const confirm = readMenuGamepad([gamepad([0, 0], [0])])
  const back = readMenuGamepad([gamepad([0, 0], [1])])

  assert.equal(requiresNeutralAfterMenuScopeChange(neutral, back), false)
  assert.equal(requiresNeutralAfterMenuScopeChange(confirm, back), true)
  assert.equal(requiresNeutralAfterMenuScopeChange(confirm, neutral), false)
})

test('direction repeat retains its initial delay, interval, and release reset', () => {
  const pressed = advanceMenuDirectionRepeat(null, 'right', 100, 0)
  assert.deepEqual(pressed, { move: true, nextRepeatAt: 420 })
  assert.deepEqual(
    advanceMenuDirectionRepeat('right', 'right', 419, pressed.nextRepeatAt),
    { move: false, nextRepeatAt: 420 },
  )
  const repeated = advanceMenuDirectionRepeat('right', 'right', 420, pressed.nextRepeatAt)
  assert.deepEqual(repeated, { move: true, nextRepeatAt: 530 })
  assert.deepEqual(
    advanceMenuDirectionRepeat('right', null, 421, repeated.nextRepeatAt),
    { move: false, nextRepeatAt: 0 },
  )
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

test('shared sampling transfers native reads between gameplay and menu owners', () => {
  let reads = 0
  let pads: ReturnType<typeof gamepad>[] = []
  const observations: number[] = []
  const sampling = createGamepadSampling(() => {
    reads += 1
    return pads
  })
  const stopObserving = sampling.subscribe(gamepads => observations.push(gamepads.length))
  const menu = sampling.createMenuSampler()

  assert.deepEqual(sampling.sampleGameplay(), [])
  assert.equal(reads, 1)
  pads = [gamepad()]
  menu.setActive(true)
  assert.equal(menu.sample().length, 1)
  assert.equal(reads, 2)
  assert.strictEqual(sampling.sampleBlockedGameplay(), pads)
  assert.equal(reads, 2, 'gameplay reuses the active menu owner sample')

  pads = []
  menu.setActive(false)
  assert.deepEqual(sampling.sampleGameplay(), [])
  assert.equal(reads, 3)
  assert.deepEqual(observations, [0, 0, 1, 0])

  menu.setActive(true)
  menu.destroy()
  sampling.sampleBlockedGameplay()
  assert.equal(reads, 4, 'destroying an active menu releases gameplay sampling')
  stopObserving()
})

test('inactive menu navigation observes gameplay without redundant native polling', () => {
  const frames = frameHarness()
  const root = emptyNavigationRoot()
  let requireModal = true
  let reads = 0
  const sampling = createGamepadSampling(() => {
    reads += 1
    return []
  })
  const navigation = createGamepadMenuNavigation({
    cancelFrame: frames.cancelFrame,
    document: { activeElement: null } as unknown as Document,
    gamepadSampling: sampling,
    now: () => 0,
    requestFrame: frames.requestFrame,
    requireModal: () => requireModal,
    root,
  })

  sampling.sampleGameplay()
  frames.run()
  assert.equal(reads, 1, 'the inactive menu consumes the published gameplay sample')
  sampling.sampleGameplay()
  frames.run()
  assert.equal(reads, 2, 'steady gameplay continues to be the only native reader')

  requireModal = false
  frames.run()
  assert.equal(reads, 3, 'an active menu scope takes sampling ownership')
  sampling.sampleBlockedGameplay()
  assert.equal(reads, 3, 'blocked gameplay reuses the menu-owned sample')

  requireModal = true
  sampling.sampleGameplay()
  frames.run()
  sampling.sampleGameplay()
  assert.equal(reads, 5, 'closing the scope returns ownership to gameplay')

  navigation.destroy()
  assert.equal(frames.size, 0)
})

test('inactive navigation samples when gameplay has not published since its prior frame', () => {
  const frames = frameHarness()
  let enabled = true
  let reads = 0
  const sampling = createGamepadSampling(() => {
    reads += 1
    return []
  })
  const navigation = createGamepadMenuNavigation({
    cancelFrame: frames.cancelFrame,
    document: { activeElement: null } as unknown as Document,
    enabled: () => enabled,
    gamepadSampling: sampling,
    now: () => 0,
    requestFrame: frames.requestFrame,
    requireModal: () => true,
    root: emptyNavigationRoot(),
  })

  frames.run()
  frames.run()
  assert.equal(reads, 2, 'the fallback preserves one state sample per navigation frame')
  sampling.sampleGameplay()
  enabled = false
  frames.run()
  assert.equal(reads, 4, 'a disabled barrier owns a current sample even after gameplay published')
  sampling.sampleBlockedGameplay()
  assert.equal(reads, 4)
  navigation.destroy()
  sampling.sampleBlockedGameplay()
  assert.equal(reads, 5, 'destroy releases fallback sampling ownership')
})

test('an injected gamepad source retains one deterministic read per menu frame', () => {
  const frames = frameHarness()
  let reads = 0
  const navigation = createGamepadMenuNavigation({
    cancelFrame: frames.cancelFrame,
    document: { activeElement: null } as unknown as Document,
    getGamepads: () => {
      reads += 1
      return []
    },
    now: () => 0,
    requestFrame: frames.requestFrame,
    requireModal: () => true,
    root: emptyNavigationRoot(),
  })

  frames.run()
  frames.run()
  assert.equal(reads, 2)
  navigation.destroy()
})
