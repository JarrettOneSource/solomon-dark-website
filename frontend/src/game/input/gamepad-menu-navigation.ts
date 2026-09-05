import type { GamepadLike } from './movement-input.ts'

export type MenuDirection = 'down' | 'left' | 'right' | 'up'

export interface MenuGamepadState {
  back: boolean
  confirm: boolean
  direction: MenuDirection | null
  next: boolean
  previous: boolean
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
  enabled?: () => boolean
  getGamepads?: () => readonly (GamepadLike & { buttons: readonly GamepadButton[] } | null)[]
  now?: () => number
  requestFrame?: (callback: FrameRequestCallback) => number
  requireModal?: () => boolean
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
  const getGamepads = options.getGamepads ?? (() => (
    typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
  ))
  const requestFrame = options.requestFrame ?? requestAnimationFrame
  const cancelFrame = options.cancelFrame ?? cancelAnimationFrame
  const now = options.now ?? (() => performance.now())
  let frame = 0
  let initialized = false
  let lastScope: ParentNode | null = null
  let previous = emptyGamepadState()
  let nextRepeatAt = 0
  let requiresNeutral = false

  const update = () => {
    const currentTime = now()
    const current = readMenuGamepad(getGamepads())
    const scope = options.enabled?.() === false
      ? null
      : activeNavigationRoot(root, options.requireModal?.() === true)
    if (!initialized) {
      initialized = true
      lastScope = scope
    } else if (scope !== lastScope) {
      lastScope = scope
      nextRepeatAt = 0
      requiresNeutral = requiresNeutralAfterMenuScopeChange(previous, current)
      if (requiresNeutral) previous = emptyGamepadState()
    }
    if (scope === null) {
      if (!gamepadStateActive(current)) requiresNeutral = false
      previous = current
      frame = requestFrame(update)
      return
    }
    if (requiresNeutral) {
      if (!gamepadStateActive(current)) {
        requiresNeutral = false
        previous = current
      }
      frame = requestFrame(update)
      return
    }
    applyMenuButtons(scope, ownerDocument, previous, current)
    if (current.direction) {
      const changed = current.direction !== previous.direction
      if (changed || currentTime >= nextRepeatAt) {
        moveFocus(scope, ownerDocument, current.direction)
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

function applyMenuButtons(root: ParentNode, ownerDocument: Document, previous: MenuGamepadState, current: MenuGamepadState): void {
  if (current.confirm && !previous.confirm) confirm(root, ownerDocument)
  if (current.back && !previous.back) requestMenuBack(root)
  if (current.previous && !previous.previous) moveLinearFocus(root, ownerDocument, -1)
  if (current.next && !previous.next) moveLinearFocus(root, ownerDocument, 1)
}

export function readMenuGamepad(
  gamepads: readonly (GamepadLike & { buttons: readonly GamepadButton[] } | null)[],
): MenuGamepadState {
  for (const gamepad of gamepads) {
    if (!gamepad?.connected || gamepad.mapping !== 'standard') continue
    const state = readConnectedGamepad(gamepad)
    if (state.back || state.confirm || state.direction || state.next || state.previous) return state
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
    next: pressed(5),
    previous: pressed(4),
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
  const focus = activeMenuFocus(root, ownerDocument, direction === 'up' || direction === 'left')
  if (!focus) return
  const { active, elements } = focus
  if (adjustRange(active, direction)) return
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

function moveLinearFocus(root: ParentNode, ownerDocument: Document, delta: -1 | 1): void {
  const focus = activeMenuFocus(root, ownerDocument, delta < 0)
  if (!focus) return
  const { active, elements } = focus
  const index = elements.indexOf(active)
  elements[(index + delta + elements.length) % elements.length].focus()
}

/** Resolve the current target or establish initial focus for either navigation mode. */
function activeMenuFocus(root: ParentNode, ownerDocument: Document, fromEnd: boolean): { active: HTMLElement; elements: HTMLElement[] } | null {
  const elements = focusableElements(root)
  if (elements.length === 0) return null
  const active = ownerDocument.activeElement
  if (active instanceof HTMLElement && elements.includes(active)) return { active, elements }
  chooseInitialMenuTarget(elements, matchingElements(root, DEFAULT_FOCUS_SELECTOR), fromEnd)?.focus()
  return null
}

function adjustRange(element: HTMLElement, direction: MenuDirection): boolean {
  if (!(element instanceof HTMLInputElement) || element.type !== 'range') return false
  if (direction !== 'left' && direction !== 'right') return false
  if (direction === 'left') element.stepDown()
  else element.stepUp()
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function confirm(root: ParentNode, ownerDocument: Document): void {
  const elements = focusableElements(root)
  const active = ownerDocument.activeElement
  if (active instanceof HTMLElement && root.contains(active) && elements.includes(active)) {
    active.click()
    return
  }
  const preferred = matchingElements(root, DEFAULT_FOCUS_SELECTOR)
  const target = chooseInitialMenuTarget(elements, preferred)
  target?.focus()
  target?.click()
}

export type MenuBackResult = 'activated' | 'modal-without-back' | 'no-modal'

/**
 * The menu skull's back rule, shared with gamepad B: with a modal open in `root`, press
 * that modal's declared back owner, or request native dialog cancellation. With no
 * modal open, report `no-modal` so the caller may open its scene menu.
 */
export function activateMenuBack(root: ParentNode): MenuBackResult {
  const scope = activeNavigationRoot(root, true)
  if (!scope) return 'no-modal'
  return requestMenuBack(scope) ? 'activated' : 'modal-without-back'
}

function requestMenuBack(root: ParentNode): boolean {
  const back = backOwner(root)
  if (back) {
    back.click()
    return true
  }
  if (root instanceof HTMLDialogElement) {
    root.requestClose()
    return true
  }
  return false
}

function backOwner(root: ParentNode): HTMLElement | null {
  return matchingElements(root, '[data-game-back="true"]').find(isVisible) ?? null
}

function focusableElements(root: ParentNode): HTMLElement[] {
  return matchingElements(root, FOCUSABLE_SELECTOR)
    .filter((element) => isFocusable(element) && isVisible(element))
}

function matchingElements(root: ParentNode, selector: string): HTMLElement[] {
  const descendants = Array.from(root.querySelectorAll<HTMLElement>(selector))
  return root instanceof HTMLElement && root.matches(selector)
    ? [root, ...descendants]
    : descendants
}

function isFocusable(element: HTMLElement): boolean {
  return !element.matches(':disabled') && element.getAttribute('aria-hidden') !== 'true'
}

function isVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
}

function center(bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): { x: number; y: number } {
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  }
}

function emptyGamepadState(): MenuGamepadState {
  return {
    back: false,
    confirm: false,
    direction: null,
    next: false,
    previous: false,
  }
}

function activeNavigationRoot(root: ParentNode, requireModal: boolean): ParentNode | null {
  const modals = Array.from(root.querySelectorAll<HTMLElement>(
    '[role="dialog"][aria-modal="true"], [data-game-controller-navigation-root="true"]',
  )).filter(isVisible)
  return modals.at(-1) ?? (requireModal ? null : root)
}

export function requiresNeutralAfterMenuScopeChange(
  previous: MenuGamepadState,
  current: MenuGamepadState,
): boolean {
  return gamepadStateActive(previous) && gamepadStateActive(current)
}

function gamepadStateActive(state: MenuGamepadState): boolean {
  return state.back || state.confirm || state.direction !== null || state.next || state.previous
}
