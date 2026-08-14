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

export interface BrowserGameplayInput {
  destroy(): void
  sample(): BrowserGameplayInputSample
  setBlocked(blocked: boolean): void
  setTouch(movement: Vector2): void
}

interface BrowserGameplayInputOptions {
  getGamepads?: () => readonly (GamepadLike | null)[]
  mouseTarget: BrowserInputTarget
  onInput: (input: PlayerCharacterInput) => void
  projectPointer: (pointer: Vector2) => Vector2 | null
  target?: BrowserInputTarget
  visibilityTarget?: BrowserVisibilityTarget
}

export function createBrowserGameplayInput({
  getGamepads = () => navigator.getGamepads(),
  mouseTarget,
  onInput,
  projectPointer,
  target = window,
  visibilityTarget = document,
}: BrowserGameplayInputOptions): BrowserGameplayInput {
  let aim: Vector2 | null = null
  let cast = { primary: false, secondary: false }
  let capturedPointer: Vector2 | null = null
  let blocked = false
  let destroyed = false

  const movement = createBrowserMovementInput({
    getGamepads,
    onStop: () => {
      aim = null
      cast = { primary: false, secondary: false }
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
    if (capturedPointer && (cast.primary || cast.secondary)) {
      aim = projectPointer(capturedPointer) ?? aim
    }
    const movementSample = movement.sample()
    return {
      device: movementSample.device,
      input: {
        aim: aim ? { ...aim } : null,
        cast: { ...cast },
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
    const nextAim = projectPointer(mouse)
    if (!nextAim) return
    capturedPointer = mouse
    aim = nextAim
    cast = { ...cast, [lane]: true }
    event.preventDefault()
    publish()
  }
  const mouseMove: EventListener = (event) => {
    if (blocked) return
    if (!cast.primary && !cast.secondary) return
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
    if (!mouse || !lane || !cast[lane]) return
    capturedPointer = mouse
    aim = projectPointer(mouse) ?? aim
    cast = { ...cast, [lane]: false }
    event.preventDefault()
    publish()
  }
  const contextMenu: EventListener = (event) => event.preventDefault()

  mouseTarget.addEventListener('mousedown', mouseDown)
  mouseTarget.addEventListener('contextmenu', contextMenu)
  target.addEventListener('mousemove', mouseMove)
  target.addEventListener('mouseup', mouseUp)

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      mouseTarget.removeEventListener('mousedown', mouseDown)
      mouseTarget.removeEventListener('contextmenu', contextMenu)
      target.removeEventListener('mousemove', mouseMove)
      target.removeEventListener('mouseup', mouseUp)
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
  }
}

function castLane(button: number): 'primary' | 'secondary' | null {
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
