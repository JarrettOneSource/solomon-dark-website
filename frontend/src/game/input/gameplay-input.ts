import {
  createIdlePlayerCharacterInput,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  createBrowserMovementInput,
  type GamepadLike,
  type MovementInputDevice,
} from './movement-input.ts'

interface BrowserInputTarget {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface BrowserVisibilityTarget extends BrowserInputTarget {
  readonly visibilityState: DocumentVisibilityState
}

export interface BrowserGameplayInputSample {
  device: MovementInputDevice
  input: PlayerCharacterInput
}

export type GameplayMouseCastLane = 'primary' | 'secondary'

export interface BrowserGameplayInput {
  destroy(): void
  sample(): BrowserGameplayInputSample
  setBlocked(blocked: boolean): void
  setTouch(movement: Vector2): void
  setTouchPrimary(direction: Vector2): void
}

interface BrowserGameplayInputOptions {
  claimMouseCastStart?: (lane: GameplayMouseCastLane) => boolean
  getGamepads?: () => readonly (GamepadLike | null)[]
  mouseTarget: BrowserInputTarget
  onInput: (input: PlayerCharacterInput) => void
  projectDirection: (direction: Vector2) => Vector2 | null
  projectPointer: (pointer: Vector2) => Vector2 | null
  target?: BrowserInputTarget
  visibilityTarget?: BrowserVisibilityTarget
}

export function createBrowserGameplayInput({
  claimMouseCastStart = () => false,
  getGamepads = () => navigator.getGamepads(),
  mouseTarget,
  onInput,
  projectDirection,
  projectPointer,
  target = window,
  visibilityTarget = document,
}: BrowserGameplayInputOptions): BrowserGameplayInput {
  let aim: Vector2 | null = null
  let mousePrimary = false
  let heldSecondarySlots: number[] = []
  let touchPrimaryDirection: Vector2 | null = null
  let capturedPointer: Vector2 | null = null
  let blocked = false
  let destroyed = false

  const movement = createBrowserMovementInput({
    getGamepads,
    onStop: () => {
      aim = null
      mousePrimary = false
      heldSecondarySlots = []
      touchPrimaryDirection = null
      capturedPointer = null
      onInput(createIdlePlayerCharacterInput())
    },
    target,
    visibilityTarget,
  })

  const sample = (): BrowserGameplayInputSample => {
    if (blocked) {
      return {
        device: 'none',
        input: createIdlePlayerCharacterInput(),
      }
    }
    if (touchPrimaryDirection) {
      aim = projectDirection(touchPrimaryDirection) ?? aim
    } else if (capturedPointer && (mousePrimary || heldSecondarySlots.length > 0)) {
      aim = projectPointer(capturedPointer) ?? aim
    }
    const movementSample = movement.sample()
    return {
      device: movementSample.device,
      input: {
        aim: aim ? { ...aim } : null,
        cast: {
          primary: mousePrimary || touchPrimaryDirection !== null,
          secondary: heldSecondarySlots.at(-1) ?? null,
        },
        movement: { ...movementSample.movement },
      },
    }
  }
  const publish = () => onInput(sample().input)
  const mouseDown: EventListener = (event) => {
    if (blocked) return
    const mouse = mouseEvent(event)
    const lane = mouse && castLane(mouse.button)
    if (!mouse || !lane) return
    if (claimMouseCastStart(lane)) {
      event.preventDefault()
      return
    }
    const nextAim = projectPointer(mouse)
    if (!nextAim) return
    capturedPointer = mouse
    aim = nextAim
    if (lane === 'primary') mousePrimary = true
    else holdSecondarySlot(0)
    event.preventDefault()
    publish()
  }
  const mouseMove: EventListener = (event) => {
    if (blocked) return
    if (!mousePrimary && heldSecondarySlots.length === 0) return
    const mouse = mouseEvent(event)
    if (!mouse) return
    capturedPointer = mouse
    aim = projectPointer(mouse) ?? aim
    event.preventDefault()
    publish()
  }
  const mouseUp: EventListener = (event) => {
    if (blocked) return
    const mouse = mouseEvent(event)
    const lane = mouse && castLane(mouse.button)
    if (!mouse || !lane) return
    if (lane === 'primary' ? !mousePrimary : !heldSecondarySlots.includes(0)) return
    capturedPointer = mouse
    aim = projectPointer(mouse) ?? aim
    if (lane === 'primary') mousePrimary = false
    else releaseSecondarySlot(0)
    event.preventDefault()
    publish()
  }
  const contextMenu: EventListener = (event) => event.preventDefault()
  const keyDown: EventListener = (event) => {
    if (blocked) return
    const keyboard = keyboardEvent(event)
    const slot = keyboard && secondaryKeyboardSlot(keyboard.code)
    if (slot === null || keyboard!.repeat || heldSecondarySlots.includes(slot)) return
    holdSecondarySlot(slot)
    event.preventDefault()
    publish()
  }
  const keyUp: EventListener = (event) => {
    if (blocked) return
    const keyboard = keyboardEvent(event)
    const slot = keyboard && secondaryKeyboardSlot(keyboard.code)
    if (slot === null || !heldSecondarySlots.includes(slot)) return
    releaseSecondarySlot(slot)
    event.preventDefault()
    publish()
  }

  function holdSecondarySlot(slot: number): void {
    heldSecondarySlots = [...heldSecondarySlots.filter((entry) => entry !== slot), slot]
  }

  function releaseSecondarySlot(slot: number): void {
    heldSecondarySlots = heldSecondarySlots.filter((entry) => entry !== slot)
  }

  mouseTarget.addEventListener('mousedown', mouseDown)
  mouseTarget.addEventListener('contextmenu', contextMenu)
  target.addEventListener('mousemove', mouseMove)
  target.addEventListener('mouseup', mouseUp)
  target.addEventListener('keydown', keyDown)
  target.addEventListener('keyup', keyUp)

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      mouseTarget.removeEventListener('mousedown', mouseDown)
      mouseTarget.removeEventListener('contextmenu', contextMenu)
      target.removeEventListener('mousemove', mouseMove)
      target.removeEventListener('mouseup', mouseUp)
      target.removeEventListener('keydown', keyDown)
      target.removeEventListener('keyup', keyUp)
      movement.destroy()
    },
    sample,
    setBlocked(nextBlocked) {
      if (blocked === nextBlocked) return
      blocked = nextBlocked
      movement.setBlocked(nextBlocked)
    },
    setTouch(nextMovement) {
      if (!blocked) movement.setTouch(nextMovement)
    },
    setTouchPrimary(direction) {
      if (blocked) return
      touchPrimaryDirection = primaryDirection(direction)
      publish()
    },
  }
}

function secondaryKeyboardSlot(code: string): number | null {
  const match = /^Digit([1-7])$/.exec(code)
  return match ? Number(match[1]) : null
}

function keyboardEvent(event: Event): { code: string; repeat: boolean } | null {
  const source = event as Partial<KeyboardEvent>
  return typeof source.code === 'string' && typeof source.repeat === 'boolean'
    ? { code: source.code, repeat: source.repeat }
    : null
}

function primaryDirection(direction: Vector2): Vector2 | null {
  if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y)) return null
  const magnitude = Math.hypot(direction.x, direction.y)
  return magnitude > 0.001
    ? { x: direction.x / magnitude, y: direction.y / magnitude }
    : null
}

function castLane(button: number): GameplayMouseCastLane | null {
  if (button === 0) return 'primary'
  if (button === 2) return 'secondary'
  return null
}

function mouseEvent(event: Event): (Vector2 & { button: number }) | null {
  const source = event as Partial<MouseEvent>
  if (
    !Number.isInteger(source.button)
    || !Number.isFinite(source.clientX)
    || !Number.isFinite(source.clientY)
  ) return null
  return {
    button: source.button as number,
    x: source.clientX as number,
    y: source.clientY as number,
  }
}
