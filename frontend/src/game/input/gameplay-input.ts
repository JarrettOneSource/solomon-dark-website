import {
  createIdlePlayerCharacterInput,
  NATIVE_GAMEPLAY_VIEWPORT_WIDTH,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  DEFAULT_GAME_CONTROL_BINDINGS,
  quickbarSlotForBinding,
  type GameControlBindings,
} from '../game-settings.ts'
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
  setControls(controls: GameControlBindings): void
  setTouch(movement: Vector2): void
  setTouchPrimary(direction: Vector2): void
  setTouchQuickbar(slot: number, pressed: boolean, fallbackDirection?: Vector2): void
}

type QuickbarInputSource = `mouse:${number}` | `keyboard:${number}` | `touch:${number}`

interface HeldQuickbarInput {
  source: QuickbarInputSource
  slot: number
}

interface BrowserGameplayInputOptions {
  claimMouseCastStart?: (lane: GameplayMouseCastLane) => boolean
  controls?: GameControlBindings
  getGamepads?: () => readonly (GamepadLike | null)[]
  mouseTarget: BrowserInputTarget
  onInput: (input: PlayerCharacterInput) => void
  primaryCastingEnabled?: boolean
  projectDirection: (direction: Vector2) => Vector2 | null
  projectPointer: (pointer: Vector2) => Vector2 | null
  projectSecondaryAim?: () => Vector2 | null
  secondaryAtPointer?: () => boolean
  target?: BrowserInputTarget
  viewportWidth?: () => number
  visibilityTarget?: BrowserVisibilityTarget
}

export function createBrowserGameplayInput({
  claimMouseCastStart = () => false,
  controls: initialControls = DEFAULT_GAME_CONTROL_BINDINGS,
  getGamepads = () => navigator.getGamepads(),
  mouseTarget,
  onInput,
  primaryCastingEnabled = true,
  projectDirection,
  projectPointer,
  projectSecondaryAim = () => null,
  secondaryAtPointer = () => true,
  target = window,
  viewportWidth = () => NATIVE_GAMEPLAY_VIEWPORT_WIDTH,
  visibilityTarget = document,
}: BrowserGameplayInputOptions): BrowserGameplayInput {
  let aim: Vector2 | null = null
  let mousePrimary = false
  let heldQuickbarInputs: HeldQuickbarInput[] = []
  let touchPrimaryDirection: Vector2 | null = null
  let capturedPointer: Vector2 | null = null
  let blocked = false
  let controls = initialControls
  let destroyed = false

  const movement = createBrowserMovementInput({
    controls,
    getGamepads,
    onStop: () => {
      aim = null
      mousePrimary = false
      heldQuickbarInputs = []
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
    } else if (capturedPointer && (
      mousePrimary
      || (mouseQuickbarHeld() && secondaryAtPointer())
    )) {
      aim = projectPointer(capturedPointer) ?? aim
    } else if (mouseQuickbarHeld()) {
      aim = projectSecondaryAim() ?? aim
    }
    const movementSample = movement.sample()
    const currentViewportWidth = viewportWidth()
    if (!Number.isFinite(currentViewportWidth) || currentViewportWidth < 1) {
      throw new RangeError('gameplay viewport width must be positive and finite')
    }
    return {
      device: movementSample.device,
      input: {
        aim: aim ? { ...aim } : null,
        cast: {
          primary: mousePrimary || touchPrimaryDirection !== null,
          quickbar: heldQuickbarInputs.at(-1)?.slot ?? null,
        },
        movement: { ...movementSample.movement },
        viewportWidth: currentViewportWidth,
      },
    }
  }
  const publish = () => onInput(sample().input)
  const mouseDown: EventListener = (event) => {
    if (blocked) return
    const mouse = mouseEvent(event)
    const lane = mouse && castLane(mouse.button, controls)
    if (!mouse || !lane) return
    if (lane === 'primary' && !primaryCastingEnabled) return
    if (claimMouseCastStart(lane)) {
      event.preventDefault()
      return
    }
    const nextAim = lane === 'secondary' && !secondaryAtPointer()
      ? projectSecondaryAim()
      : projectPointer(mouse)
    if (!nextAim) return
    capturedPointer = mouse
    aim = nextAim
    if (lane === 'primary') mousePrimary = true
    else {
      const slot = quickbarSlotForBinding(controls, `Mouse${mouse.button}`)
      if (slot === null) return
      holdQuickbarInput(`mouse:${slot}`, slot)
    }
    event.preventDefault()
    publish()
  }
  const mouseMove: EventListener = (event) => {
    if (blocked) return
    if (!mousePrimary && heldQuickbarInputs.length === 0) return
    const mouse = mouseEvent(event)
    if (!mouse) return
    capturedPointer = mouse
    aim = mousePrimary || secondaryAtPointer()
      ? projectPointer(mouse) ?? aim
      : projectSecondaryAim() ?? aim
    event.preventDefault()
    publish()
  }
  const mouseUp: EventListener = (event) => {
    if (blocked) return
    const mouse = mouseEvent(event)
    const lane = mouse && castLane(mouse.button, controls)
    if (!mouse || !lane) return
    const slot = lane === 'secondary'
      ? quickbarSlotForBinding(controls, `Mouse${mouse.button}`)
      : null
    if (lane === 'primary' ? !mousePrimary : slot === null || !quickbarInputHeld(`mouse:${slot}`, slot)) return
    capturedPointer = mouse
    aim = lane === 'secondary' && !secondaryAtPointer()
      ? projectSecondaryAim() ?? aim
      : projectPointer(mouse) ?? aim
    if (lane === 'primary') mousePrimary = false
    else releaseQuickbarInput(`mouse:${slot!}`, slot!)
    event.preventDefault()
    publish()
  }
  const contextMenu: EventListener = (event) => event.preventDefault()
  const keyDown: EventListener = (event) => {
    if (blocked) return
    const keyboard = keyboardEvent(event)
    const slot = keyboard && quickbarSlotForBinding(controls, keyboard.code)
    if (slot === null || keyboard!.repeat || quickbarInputHeld(`keyboard:${slot}`, slot)) return
    holdQuickbarInput(`keyboard:${slot}`, slot)
    event.preventDefault()
    publish()
  }
  const keyUp: EventListener = (event) => {
    if (blocked) return
    const keyboard = keyboardEvent(event)
    const slot = keyboard && quickbarSlotForBinding(controls, keyboard.code)
    if (slot === null || !quickbarInputHeld(`keyboard:${slot}`, slot)) return
    releaseQuickbarInput(`keyboard:${slot}`, slot)
    event.preventDefault()
    publish()
  }

  function quickbarInputHeld(source: QuickbarInputSource, slot: number): boolean {
    return heldQuickbarInputs.some((entry) => entry.source === source && entry.slot === slot)
  }

  function holdQuickbarInput(source: QuickbarInputSource, slot: number): void {
    heldQuickbarInputs = [
      ...heldQuickbarInputs.filter((entry) => entry.source !== source),
      { source, slot },
    ]
  }

  function releaseQuickbarInput(source: QuickbarInputSource, slot: number): void {
    heldQuickbarInputs = heldQuickbarInputs.filter((entry) => (
      entry.source !== source || entry.slot !== slot
    ))
  }

  function mouseQuickbarHeld(): boolean {
    return heldQuickbarInputs.some(({ source }) => source.startsWith('mouse:'))
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
    setControls(nextControls) {
      controls = nextControls
      movement.setControls(nextControls)
    },
    setTouch(nextMovement) {
      if (!blocked) movement.setTouch(nextMovement)
    },
    setTouchPrimary(direction) {
      if (blocked || !primaryCastingEnabled) return
      touchPrimaryDirection = primaryDirection(direction)
      publish()
    },
    setTouchQuickbar(slot, pressed, fallbackDirection) {
      if (blocked || !Number.isInteger(slot) || slot < 0 || slot > 7) return
      const source = `touch:${slot}` as const
      if (pressed) {
        if (quickbarInputHeld(source, slot)) return
        if (aim === null && fallbackDirection) {
          const direction = primaryDirection(fallbackDirection)
          if (direction) aim = projectDirection(direction)
        }
        holdQuickbarInput(source, slot)
      } else {
        if (!quickbarInputHeld(source, slot)) return
        releaseQuickbarInput(source, slot)
      }
      publish()
    },
  }
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

function castLane(
  button: number,
  controls: GameControlBindings,
): GameplayMouseCastLane | null {
  if (button === 0) return 'primary'
  if (quickbarSlotForBinding(controls, `Mouse${button}`) !== null) return 'secondary'
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
