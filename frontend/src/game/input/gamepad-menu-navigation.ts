import type { GamepadLike } from './movement-input.ts'

export type MenuDirection = 'down' | 'left' | 'right' | 'up'

export interface MenuGamepadState {
  back: boolean
  confirm: boolean
  direction: MenuDirection | null
}

export interface SpatialCandidate<T> {
  bounds: Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'>
  value: T
}

export interface GamepadMenuNavigation {
  destroy(): void
}

interface NavigationOptions {
  cancelFrame?: (frame: number) => void
  document?: Document
  getGamepads?: () => readonly (GamepadLike & { buttons: readonly GamepadButton[] } | null)[]
  now?: () => number
  requestFrame?: (callback: FrameRequestCallback) => number
  root?: ParentNode
}

const INITIAL_REPEAT_DELAY_MS = 320
const REPEAT_INTERVAL_MS = 110
const AXIS_THRESHOLD = 0.62
const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')
const DEFAULT_FOCUS_SELECTOR = '[data-game-default-focus="true"]'

export function createGamepadMenuNavigation(
  options: NavigationOptions = {},
): GamepadMenuNavigation {
  const ownerDocument = options.document ?? document
  const root = options.root ?? ownerDocument
  const getGamepads = options.getGamepads ?? (() => navigator.getGamepads())
  const requestFrame = options.requestFrame ?? requestAnimationFrame
  const cancelFrame = options.cancelFrame ?? cancelAnimationFrame
  const now = options.now ?? (() => performance.now())
  let frame = 0
  let previous = emptyGamepadState()
  let nextRepeatAt = 0

  const update = () => {
    const currentTime = now()
    const current = readMenuGamepad(getGamepads())
    if (current.confirm && !previous.confirm) confirm(root, ownerDocument)
    if (current.back && !previous.back) activateBack(root)
    if (current.direction) {
      const changed = current.direction !== previous.direction
      if (changed || currentTime >= nextRepeatAt) {
        moveFocus(root, ownerDocument, current.direction)
        nextRepeatAt = currentTime + (changed ? INITIAL_REPEAT_DELAY_MS : REPEAT_INTERVAL_MS)
      }
    } else {
      nextRepeatAt = 0
    }
    previous = current
    frame = requestFrame(update)
  }
  frame = requestFrame(update)

  return {
    destroy() {
      cancelFrame(frame)
      previous = emptyGamepadState()
    },
  }
}

export function readMenuGamepad(
  gamepads: readonly (GamepadLike & { buttons: readonly GamepadButton[] } | null)[],
): MenuGamepadState {
  for (const gamepad of gamepads) {
    if (!gamepad?.connected) continue
    const state = readConnectedGamepad(gamepad)
    if (state.back || state.confirm || state.direction) return state
  }
  return emptyGamepadState()
}

function readConnectedGamepad(
  gamepad: GamepadLike & { buttons: readonly GamepadButton[] },
): MenuGamepadState {
  const horizontal = gamepad.axes[0] ?? 0
  const vertical = gamepad.axes[1] ?? 0
  const pressed = (index: number) => Boolean(gamepad.buttons[index]?.pressed)
  let direction: MenuDirection | null = null
  if (pressed(12) || vertical <= -AXIS_THRESHOLD) direction = 'up'
  else if (pressed(13) || vertical >= AXIS_THRESHOLD) direction = 'down'
  else if (pressed(14) || horizontal <= -AXIS_THRESHOLD) direction = 'left'
  else if (pressed(15) || horizontal >= AXIS_THRESHOLD) direction = 'right'
  return {
    back: pressed(1),
    confirm: pressed(0),
    direction,
  }
}

export function chooseSpatialTarget<T>(
  current: SpatialCandidate<T>,
  candidates: readonly SpatialCandidate<T>[],
  direction: MenuDirection,
): T | null {
  const currentCenter = center(current.bounds)
  let selected: { score: number; value: T } | null = null
  for (const candidate of candidates) {
    if (candidate.value === current.value) continue
    const candidateCenter = center(candidate.bounds)
    const dx = candidateCenter.x - currentCenter.x
    const dy = candidateCenter.y - currentCenter.y
    const primary = direction === 'left' ? -dx
      : direction === 'right' ? dx
        : direction === 'up' ? -dy
          : dy
    if (primary <= 0) continue
    const perpendicular = direction === 'left' || direction === 'right'
      ? Math.abs(dy)
      : Math.abs(dx)
    const score = primary + perpendicular * 2.5
    if (!selected || score < selected.score) selected = { score, value: candidate.value }
  }
  return selected?.value ?? null
}

export function chooseInitialMenuTarget<T>(
  focusable: readonly T[],
  preferred: readonly T[],
  fromEnd = false,
): T | null {
  const visiblePreferred = preferred.find((candidate) => focusable.includes(candidate))
  if (visiblePreferred) return visiblePreferred
  if (preferred.length > 0) return null
  return focusable[fromEnd ? focusable.length - 1 : 0] ?? null
}

function moveFocus(root: ParentNode, ownerDocument: Document, direction: MenuDirection): void {
  const elements = focusableElements(root)
  if (elements.length === 0) return
  const active = ownerDocument.activeElement instanceof HTMLElement
    && elements.includes(ownerDocument.activeElement)
    ? ownerDocument.activeElement
    : null
  if (!active) {
    const preferred = Array.from(root.querySelectorAll<HTMLElement>(DEFAULT_FOCUS_SELECTOR))
    chooseInitialMenuTarget(
      elements,
      preferred,
      direction === 'up' || direction === 'left',
    )?.focus()
    return
  }
  const current = { bounds: active.getBoundingClientRect(), value: active }
  const candidates = elements.map((element) => ({
    bounds: element.getBoundingClientRect(),
    value: element,
  }))
  const selected = chooseSpatialTarget(current, candidates, direction)
  if (selected) {
    selected.focus()
    return
  }
  const index = elements.indexOf(active)
  const delta = direction === 'up' || direction === 'left' ? -1 : 1
  elements[(index + delta + elements.length) % elements.length].focus()
}

function confirm(root: ParentNode, ownerDocument: Document): void {
  const active = ownerDocument.activeElement
  if (active instanceof HTMLElement && contains(root, active) && isFocusable(active)) {
    active.click()
    return
  }
  const elements = focusableElements(root)
  const preferred = Array.from(root.querySelectorAll<HTMLElement>(DEFAULT_FOCUS_SELECTOR))
  chooseInitialMenuTarget(elements, preferred)?.focus()
}

function activateBack(root: ParentNode): void {
  const back = Array.from(root.querySelectorAll<HTMLElement>('[data-game-back="true"]'))
    .find(isVisible)
  back?.click()
}

function focusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => isFocusable(element) && isVisible(element))
}

function isFocusable(element: HTMLElement): boolean {
  return !element.matches(':disabled') && element.getAttribute('aria-hidden') !== 'true'
}

function isVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
}

function center(bounds: SpatialCandidate<unknown>['bounds']): { x: number; y: number } {
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  }
}

function emptyGamepadState(): MenuGamepadState {
  return { back: false, confirm: false, direction: null }
}

function contains(root: ParentNode, element: Element): boolean {
  return root === element || Array.from(root.querySelectorAll('*')).includes(element)
}
