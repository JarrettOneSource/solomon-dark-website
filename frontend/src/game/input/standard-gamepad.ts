import type { Vector2 } from '../core-kernels/vector.ts'
import {
  GAMEPAD_MOVEMENT_DEAD_ZONE,
  GAMEPAD_MOVEMENT_OUTER_DEAD_ZONE,
  radialDeadZone,
  type GamepadLike,
} from './movement-input.ts'

export type StandardGamepadAction = 'interact' | 'inventory' | 'pause' | 'skills'

export interface StandardGamepadGameplaySample {
  readonly actions: readonly StandardGamepadAction[]
  readonly aimActive: boolean
  readonly aimDirection: Vector2 | null
  readonly gamepad: GamepadLike | null
  readonly primary: boolean
  readonly quickbar: number | null
  readonly quickbarSelectionChanged: boolean
  readonly selectedQuickbarSlot: number
}

export interface StandardGamepadGameplayState {
  clear(requireNeutral?: boolean): void
  sample(gamepads: readonly (GamepadLike | null)[]): StandardGamepadGameplaySample
}

const BUTTON_SOUTH = 0
const BUTTON_WEST = 2
const BUTTON_NORTH = 3
const BUTTON_LEFT_BUMPER = 4
const BUTTON_RIGHT_BUMPER = 5
const BUTTON_RIGHT_TRIGGER = 7
const BUTTON_VIEW = 8
const BUTTON_MENU = 9
const RELEVANT_BUTTONS = Object.freeze([
  BUTTON_SOUTH,
  BUTTON_WEST,
  BUTTON_NORTH,
  BUTTON_LEFT_BUMPER,
  BUTTON_RIGHT_BUMPER,
  BUTTON_RIGHT_TRIGGER,
  BUTTON_VIEW,
  BUTTON_MENU,
  12,
  13,
  14,
  15,
])

export function createStandardGamepadGameplayState(): StandardGamepadGameplayState {
  let aimDirection: Vector2 | null = null
  let awaitingNeutral = false
  let heldQuickbarSlot: number | null = null
  let previousButtons = new Set<number>()
  let selectedGamepadIndex: number | null = null
  let selectedQuickbarSlot = 0

  const clearLevels = (requireNeutral: boolean) => {
    aimDirection = null
    awaitingNeutral = requireNeutral
    heldQuickbarSlot = null
    previousButtons = new Set()
  }

  return {
    clear(requireNeutral = true) {
      clearLevels(requireNeutral)
    },
    sample(gamepads) {
      const standard = gamepads.filter(isStandardGamepad)
      let selectedThisSample = false
      let gamepad = selectedGamepadIndex === null
        ? null
        : standard.find(({ index }) => index === selectedGamepadIndex) ?? null

      if (selectedGamepadIndex !== null && gamepad === null) {
        selectedGamepadIndex = null
        clearLevels(standard.length > 0)
      }

      if (awaitingNeutral) {
        const candidates = gamepad ? [gamepad] : standard
        if (candidates.some(standardGamepadHasActivity)) return idleSample(selectedQuickbarSlot)
        awaitingNeutral = false
        previousButtons = new Set()
        return idleSample(selectedQuickbarSlot)
      }

      if (gamepad === null) {
        gamepad = standard.find(standardGamepadHasActivity) ?? null
        if (gamepad === null) return idleSample(selectedQuickbarSlot)
        selectedGamepadIndex = gamepad.index
        selectedThisSample = true
      }

      const rightStick = radialDeadZone(
        gamepad.axes[2] ?? 0,
        gamepad.axes[3] ?? 0,
        GAMEPAD_MOVEMENT_DEAD_ZONE,
        GAMEPAD_MOVEMENT_OUTER_DEAD_ZONE,
      )
      const aimActive = Math.hypot(rightStick.x, rightStick.y) > 0
      if (aimActive) {
        const magnitude = Math.hypot(rightStick.x, rightStick.y)
        aimDirection = { x: rightStick.x / magnitude, y: rightStick.y / magnitude }
      }

      const pressed = new Set(RELEVANT_BUTTONS.filter((index) => buttonActive(gamepad!, index)))
      const quickbarPressed = pressed.has(BUTTON_WEST)
      let quickbarSelectionChanged = selectedThisSample
      if (!quickbarPressed && heldQuickbarSlot === null) {
        const previous = rising(pressed, previousButtons, BUTTON_LEFT_BUMPER)
        const next = rising(pressed, previousButtons, BUTTON_RIGHT_BUMPER)
        if (previous !== next) {
          selectedQuickbarSlot = (selectedQuickbarSlot + (next ? 1 : 7)) % 8
          quickbarSelectionChanged = true
        }
      }
      if (quickbarPressed && heldQuickbarSlot === null) heldQuickbarSlot = selectedQuickbarSlot
      if (!quickbarPressed) heldQuickbarSlot = null

      const actions: StandardGamepadAction[] = []
      if (rising(pressed, previousButtons, BUTTON_SOUTH)) actions.push('interact')
      if (rising(pressed, previousButtons, BUTTON_NORTH)) actions.push('skills')
      if (rising(pressed, previousButtons, BUTTON_VIEW)) actions.push('inventory')
      if (rising(pressed, previousButtons, BUTTON_MENU)) actions.push('pause')
      previousButtons = pressed

      return {
        actions,
        aimActive,
        aimDirection: aimDirection ? { ...aimDirection } : null,
        gamepad,
        primary: pressed.has(BUTTON_RIGHT_TRIGGER),
        quickbar: heldQuickbarSlot,
        quickbarSelectionChanged,
        selectedQuickbarSlot,
      }
    },
  }
}

function idleSample(selectedQuickbarSlot: number): StandardGamepadGameplaySample {
  return {
    actions: [],
    aimActive: false,
    aimDirection: null,
    gamepad: null,
    primary: false,
    quickbar: null,
    quickbarSelectionChanged: false,
    selectedQuickbarSlot,
  }
}

function isStandardGamepad(gamepad: GamepadLike | null): gamepad is GamepadLike {
  return Boolean(gamepad?.connected && gamepad.mapping === 'standard')
}

function standardGamepadHasActivity(gamepad: GamepadLike): boolean {
  const left = radialDeadZone(
    gamepad.axes[0] ?? 0,
    gamepad.axes[1] ?? 0,
    GAMEPAD_MOVEMENT_DEAD_ZONE,
    GAMEPAD_MOVEMENT_OUTER_DEAD_ZONE,
  )
  const right = radialDeadZone(
    gamepad.axes[2] ?? 0,
    gamepad.axes[3] ?? 0,
    GAMEPAD_MOVEMENT_DEAD_ZONE,
    GAMEPAD_MOVEMENT_OUTER_DEAD_ZONE,
  )
  return Math.hypot(left.x, left.y) > 0
    || Math.hypot(right.x, right.y) > 0
    || RELEVANT_BUTTONS.some((index) => buttonActive(gamepad, index))
}

function buttonActive(gamepad: GamepadLike, index: number): boolean {
  const button = gamepad.buttons?.[index]
  return Boolean(button?.pressed || (button?.value ?? 0) > 0.5)
}

function rising(current: ReadonlySet<number>, previous: ReadonlySet<number>, index: number): boolean {
  return current.has(index) && !previous.has(index)
}
