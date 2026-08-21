import type { Vector2 } from '../core-kernels/vector.ts'
import {
  DEFAULT_GAME_CONTROL_BINDINGS,
  type GameControlBindings,
} from '../game-settings.ts'

export type MovementInputDevice = 'gamepad' | 'keyboard' | 'none' | 'touch'

export interface MovementInputSample {
  device: MovementInputDevice
  movement: Vector2
}

export interface MovementInputState {
  clear(): void
  press(code: string): boolean
  release(code: string): boolean
  sample(gamepads?: readonly (GamepadLike | null)[]): MovementInputSample
  setControls(controls: GameControlBindings): void
  setTouch(movement: Vector2): void
}

export interface BrowserMovementInput {
  destroy(): void
  sample(): MovementInputSample
  setBlocked(blocked: boolean): void
  setControls(controls: GameControlBindings): void
  setTouch(movement: Vector2): void
}

export interface GamepadLike {
  axes: readonly number[]
  buttons?: readonly { pressed: boolean; value: number }[]
  connected: boolean
  index: number
  mapping: string
}

interface InputPoint {
  x: number
  y: number
}

interface BrowserInputTarget {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface BrowserVisibilityTarget extends BrowserInputTarget {
  readonly visibilityState: DocumentVisibilityState
}

interface BrowserMovementInputOptions {
  controls?: GameControlBindings
  getGamepads?: () => readonly (GamepadLike | null)[]
  onStop: () => void
  target?: BrowserInputTarget
  visibilityTarget?: BrowserVisibilityTarget
}

export const GAMEPAD_MOVEMENT_DEAD_ZONE = 0.2

export function createMovementInputState(
  initialControls = DEFAULT_GAME_CONTROL_BINDINGS,
): MovementInputState {
  const pressed = new Set<string>()
  let controls = initialControls
  let touch: Vector2 = { x: 0, y: 0 }

  return {
    clear() {
      pressed.clear()
      touch = { x: 0, y: 0 }
    },
    press(code) {
      if (!movementCodes(controls).has(code)) return false
      pressed.add(code)
      return true
    },
    release(code) {
      if (!movementCodes(controls).has(code)) return false
      pressed.delete(code)
      return true
    },
    sample(gamepads = []) {
      if (Math.hypot(touch.x, touch.y) > 0.001) {
        return { device: 'touch', movement: { ...touch } }
      }
      const gamepadMovement = movementFromGamepads(gamepads)
      if (Math.hypot(gamepadMovement.x, gamepadMovement.y) > 0.001) {
        return { device: 'gamepad', movement: gamepadMovement }
      }
      const keyboard = normalizeMovement({
        x: Number(pressed.has(controls.moveRight)) - Number(pressed.has(controls.moveLeft)),
        y: Number(pressed.has(controls.moveDown)) - Number(pressed.has(controls.moveUp)),
      })
      return Math.hypot(keyboard.x, keyboard.y) > 0
        ? { device: 'keyboard', movement: keyboard }
        : { device: 'none', movement: keyboard }
    },
    setControls(nextControls) {
      controls = nextControls
      pressed.clear()
    },
    setTouch(movement) {
      touch = normalizeMovement(movement)
    },
  }
}

export function createBrowserMovementInput({
  controls = DEFAULT_GAME_CONTROL_BINDINGS,
  getGamepads = () => navigator.getGamepads(),
  onStop,
  target = window,
  visibilityTarget = document,
}: BrowserMovementInputOptions): BrowserMovementInput {
  const state = createMovementInputState(controls)
  let blocked = false
  const keyDown: EventListener = (event) => {
    const code = keyboardCode(event)
    if (blocked || code === null || !state.press(code)) return
    event.preventDefault()
  }
  const keyUp: EventListener = (event) => {
    const code = keyboardCode(event)
    if (blocked || code === null || !state.release(code)) return
    event.preventDefault()
  }
  const stop = () => {
    state.clear()
    onStop()
  }
  const visibilityChange: EventListener = () => {
    if (visibilityTarget.visibilityState === 'hidden') stop()
  }
  target.addEventListener('keydown', keyDown)
  target.addEventListener('keyup', keyUp)
  target.addEventListener('blur', stop)
  target.addEventListener('pagehide', stop)
  visibilityTarget.addEventListener('visibilitychange', visibilityChange)

  return {
    destroy() {
      target.removeEventListener('keydown', keyDown)
      target.removeEventListener('keyup', keyUp)
      target.removeEventListener('blur', stop)
      target.removeEventListener('pagehide', stop)
      visibilityTarget.removeEventListener('visibilitychange', visibilityChange)
      stop()
    },
    sample: () => blocked
      ? { device: 'none', movement: { x: 0, y: 0 } }
      : state.sample(getGamepads()),
    setBlocked(nextBlocked) {
      if (blocked === nextBlocked) return
      blocked = nextBlocked
      if (blocked) stop()
    },
    setControls(nextControls) {
      state.setControls(nextControls)
      onStop()
    },
    setTouch(movement) {
      if (!blocked) state.setTouch(movement)
    },
  }
}

function movementCodes(controls: GameControlBindings): ReadonlySet<string> {
  return new Set([
    controls.moveDown,
    controls.moveLeft,
    controls.moveRight,
    controls.moveUp,
  ])
}

function keyboardCode(event: Event): string | null {
  const code = (event as Partial<KeyboardEvent>).code
  return typeof code === 'string' ? code : null
}

export function movementFromGamepads(
  gamepads: readonly (GamepadLike | null)[],
  deadZone = GAMEPAD_MOVEMENT_DEAD_ZONE,
): Vector2 {
  for (const gamepad of gamepads) {
    if (!gamepad?.connected) continue
    const dpad = normalizeMovement({
      x: Number(Boolean(gamepad.buttons?.[15]?.pressed))
        - Number(Boolean(gamepad.buttons?.[14]?.pressed)),
      y: Number(Boolean(gamepad.buttons?.[13]?.pressed))
        - Number(Boolean(gamepad.buttons?.[12]?.pressed)),
    })
    const movement = Math.hypot(dpad.x, dpad.y) > 0
      ? dpad
      : radialDeadZone(gamepad.axes[0] ?? 0, gamepad.axes[1] ?? 0, deadZone)
    if (Math.hypot(movement.x, movement.y) > 0) return movement
  }
  return { x: 0, y: 0 }
}

export function radialDeadZone(x: number, y: number, deadZone: number): Vector2 {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 }
  const clampedDeadZone = Math.min(0.95, Math.max(0, deadZone))
  const magnitude = Math.hypot(x, y)
  if (magnitude <= clampedDeadZone) return { x: 0, y: 0 }
  const normalizedMagnitude = Math.min(1, (magnitude - clampedDeadZone) / (1 - clampedDeadZone))
  return {
    x: x / magnitude * normalizedMagnitude,
    y: y / magnitude * normalizedMagnitude,
  }
}

export function normalizeMovement(movement: Vector2): Vector2 {
  if (!Number.isFinite(movement.x) || !Number.isFinite(movement.y)) return { x: 0, y: 0 }
  const magnitude = Math.hypot(movement.x, movement.y)
  if (magnitude <= 1) return { ...movement }
  return { x: movement.x / magnitude, y: movement.y / magnitude }
}

export function joystickVector(
  pointer: InputPoint,
  center: InputPoint,
  radius: number,
): Vector2 {
  if (!(radius > 0) || !Number.isFinite(radius)) return { x: 0, y: 0 }
  return normalizeMovement({
    x: (pointer.x - center.x) / radius,
    y: (pointer.y - center.y) / radius,
  })
}
