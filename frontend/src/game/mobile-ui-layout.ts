import type { CSSProperties } from 'react'

import { UI_SCALE_MAX_PERCENT, UI_SCALE_MIN_PERCENT } from './game-settings.ts'
import {
  MOBILE_JOYSTICK_BASE,
  mobileQuickbarBankLayout,
  mobileQuickbarSlotPlacement,
} from './mobile-quickbar-layout.ts'
import { fixedGameViewportLayout } from './renderer/game-viewport.ts'

export const MOBILE_UI_CANONICAL_WIDTH = 896
export const MOBILE_UI_CANONICAL_HEIGHT = 414
export const MOBILE_UI_GRID_SIZE = 16
export const MOBILE_UI_SCALE_MIN = 0.4
export const MOBILE_UI_SCALE_MAX = 3
export const MOBILE_UI_PAGE_ZOOM_MIN = 0.35
export const MOBILE_UI_PAGE_ZOOM_MAX = 4

export const MOBILE_UI_ELEMENT_IDS = Object.freeze([
  'pause',
  'diagnostics',
  'leftJoystick',
  'rightJoystick',
  'slot1',
  'slot2',
  'slot3',
  'slot4',
  'slot5',
  'slot6',
  'slot7',
  'slot8',
  'inventory',
  'skillbook',
  'xp',
  'healthPotion',
  'manaPotion',
] as const)

export type MobileUiElementId = typeof MOBILE_UI_ELEMENT_IDS[number]

export const MOBILE_UI_ELEMENT_LABELS: Readonly<Record<MobileUiElementId, string>> = Object.freeze({
  diagnostics: 'FPS / Ping',
  healthPotion: 'Health Potion',
  inventory: 'Inventory',
  leftJoystick: 'Left Joystick',
  manaPotion: 'Mana Potion',
  pause: 'Pause',
  rightJoystick: 'Right Joystick',
  skillbook: 'Skillbook',
  slot1: 'Slot 1',
  slot2: 'Slot 2',
  slot3: 'Slot 3',
  slot4: 'Slot 4',
  slot5: 'Slot 5',
  slot6: 'Slot 6',
  slot7: 'Slot 7',
  slot8: 'Slot 8',
  xp: 'XP Meter',
})

export interface MobileUiPoint {
  readonly x: number
  readonly y: number
}

export interface MobileUiSize {
  readonly height: number
  readonly width: number
}

export interface MobileUiElementTransform extends MobileUiPoint {
  readonly rotation: number
  readonly scale: number
}

export type MobileUiLayout = Readonly<Record<MobileUiElementId, MobileUiElementTransform>>
export type MobileUiElementSizes = Readonly<Record<MobileUiElementId, MobileUiSize>>

export interface MobileUiGeometry {
  readonly layout: MobileUiLayout
  readonly sizes: MobileUiElementSizes
}

export interface MobileUiLayoutState {
  readonly customized: boolean
  readonly layout: MobileUiLayout
}

export interface MobileUiLayoutStorage {
  getItem(key: string): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

export const MOBILE_UI_LAYOUT_STORAGE_KEY = 'solomon-dark-mobile-ui-layout-v1'

const listeners = new Set<(state: MobileUiLayoutState) => void>()

export function defaultMobileUiGeometry(
  viewportWidth: number,
  viewportHeight: number,
  uiScale: number,
): MobileUiGeometry {
  assertPositiveFinite(viewportWidth, 'viewportWidth')
  assertPositiveFinite(viewportHeight, 'viewportHeight')
  const boundedUiScale = clamp(
    finiteOr(uiScale, 1),
    UI_SCALE_MIN_PERCENT / 100,
    UI_SCALE_MAX_PERCENT / 100,
  )
  const viewport = fixedGameViewportLayout(viewportWidth, viewportHeight)
  const rootScale = viewport.displayScale * boundedUiScale
  const joystickSize = MOBILE_JOYSTICK_BASE * rootScale
  const bank = mobileQuickbarBankLayout(viewport.width, boundedUiScale)
  const layout = {} as Record<MobileUiElementId, MobileUiElementTransform>
  const sizes = {} as Record<MobileUiElementId, MobileUiSize>
  const add = (
    id: MobileUiElementId,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ) => {
    layout[id] = frozenTransform({
      rotation: 0,
      scale: 1,
      x: centerX / viewportWidth * 100,
      y: centerY / viewportHeight * 100,
    })
    sizes[id] = Object.freeze({ height, width })
  }

  add('pause', 26, 26, 44, 44)
  // Accepted 896 x 414 coarse-pointer receipt: left 92, top 15, 69.73 x 10.2.
  // Width varies slightly with the live FPS digits; this stable two-digit seed keeps the
  // complete saved profile centred on the shipped diagnostics lane.
  add('diagnostics', 126.865, 20.1, 69.73, 10.2)
  add(
    'leftJoystick',
    (48 + MOBILE_JOYSTICK_BASE / 2) * rootScale,
    viewportHeight - (56 + MOBILE_JOYSTICK_BASE / 2) * rootScale,
    joystickSize,
    joystickSize,
  )
  add(
    'rightJoystick',
    viewportWidth - (48 + MOBILE_JOYSTICK_BASE / 2) * rootScale,
    viewportHeight - (56 + MOBILE_JOYSTICK_BASE / 2) * rootScale,
    joystickSize,
    joystickSize,
  )

  for (let slot = 0; slot < 8; slot += 1) {
    const placement = mobileQuickbarSlotPlacement(slot, bank)
    const size = placement.size * rootScale
    const centerX = placement.bank === 'left'
      ? placement.inset * rootScale + size / 2
      : viewportWidth - placement.inset * rootScale - size / 2
    const centerY = viewportHeight - placement.bottom * rootScale - size / 2
    add(`slot${slot + 1}` as MobileUiElementId, centerX, centerY, size, size)
  }

  add(
    'healthPotion',
    viewportWidth / 2 - 180 * rootScale,
    viewportHeight - 58 * rootScale,
    100 * rootScale,
    100 * rootScale,
  )
  add(
    'inventory',
    viewportWidth / 2 - 65 * rootScale,
    viewportHeight - 65 * rootScale,
    130 * rootScale,
    130 * rootScale,
  )
  add(
    'skillbook',
    viewportWidth / 2 + 65 * rootScale,
    viewportHeight - 65 * rootScale,
    130 * rootScale,
    130 * rootScale,
  )
  add(
    'xp',
    viewportWidth / 2 + 4 * rootScale,
    viewportHeight - 44 * rootScale,
    12 * rootScale,
    56 * rootScale,
  )
  add(
    'manaPotion',
    viewportWidth / 2 + 180 * rootScale,
    viewportHeight - 58 * rootScale,
    100 * rootScale,
    100 * rootScale,
  )

  return {
    layout: freezeLayout(layout),
    sizes: Object.freeze(sizes),
  }
}

export const DEFAULT_MOBILE_UI_LAYOUT = defaultMobileUiGeometry(
  MOBILE_UI_CANONICAL_WIDTH,
  MOBILE_UI_CANONICAL_HEIGHT,
  1,
).layout

export function mobileUiEditorPageSize(
  viewportWidth: number,
  viewportHeight: number,
  coarsePointer: boolean,
): MobileUiSize {
  if (
    !coarsePointer
    || !Number.isFinite(viewportWidth)
    || !Number.isFinite(viewportHeight)
    || viewportWidth <= 0
    || viewportHeight <= 0
  ) {
    return { height: MOBILE_UI_CANONICAL_HEIGHT, width: MOBILE_UI_CANONICAL_WIDTH }
  }
  const aspect = Math.max(viewportWidth, viewportHeight) / Math.min(viewportWidth, viewportHeight)
  return {
    height: Math.round(MOBILE_UI_CANONICAL_WIDTH / aspect),
    width: MOBILE_UI_CANONICAL_WIDTH,
  }
}

export function readMobileUiLayoutState(
  storage: MobileUiLayoutStorage = browserStorage(),
): MobileUiLayoutState {
  const serialized = storage.getItem(MOBILE_UI_LAYOUT_STORAGE_KEY)
  if (serialized === null) return defaultLayoutState()
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!record(parsed) || !sameKeys(Object.keys(parsed), ['elements', 'version'])) {
      return defaultLayoutState()
    }
    if (parsed.version !== 1 || !record(parsed.elements)) return defaultLayoutState()
    if (!sameKeys(Object.keys(parsed.elements), MOBILE_UI_ELEMENT_IDS)) return defaultLayoutState()
    const layout = {} as Record<MobileUiElementId, MobileUiElementTransform>
    for (const id of MOBILE_UI_ELEMENT_IDS) {
      const transform = parsed.elements[id]
      if (!validTransform(transform)) return defaultLayoutState()
      layout[id] = frozenTransform(transform)
    }
    return Object.freeze({ customized: true, layout: freezeLayout(layout) })
  } catch {
    return defaultLayoutState()
  }
}

export function setMobileUiLayout(
  layout: MobileUiLayout,
  storage: MobileUiLayoutStorage = browserStorage(),
): MobileUiLayoutState {
  const normalized = normalizeLayout(layout)
  storage.setItem(MOBILE_UI_LAYOUT_STORAGE_KEY, JSON.stringify({
    elements: normalized,
    version: 1,
  }))
  const state = Object.freeze({ customized: true, layout: normalized })
  emit(state)
  return state
}

export function resetMobileUiLayout(
  storage: MobileUiLayoutStorage = browserStorage(),
): MobileUiLayoutState {
  storage.removeItem(MOBILE_UI_LAYOUT_STORAGE_KEY)
  const state = defaultLayoutState()
  emit(state)
  return state
}

export function subscribeMobileUiLayout(
  listener: (state: MobileUiLayoutState) => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetMobileUiLayoutListenersForTests(): void {
  listeners.clear()
}

export function mobileUiLayoutWith(
  layout: MobileUiLayout,
  id: MobileUiElementId,
  transform: MobileUiElementTransform,
): MobileUiLayout {
  return freezeLayout({ ...layout, [id]: normalizeTransform(transform) })
}

export function mobileUiElementStyle(
  state: MobileUiLayoutState,
  id: MobileUiElementId,
): CSSProperties | undefined {
  if (!state.customized) return undefined
  const transform = state.layout[id]
  return {
    '--mobile-ui-rotation': `${transform.rotation}deg`,
    '--mobile-ui-scale': transform.scale,
    '--mobile-ui-x': `${transform.x}%`,
    '--mobile-ui-y': `${transform.y}%`,
  } as CSSProperties
}

export function snapMobileUiPoint(point: MobileUiPoint, page: MobileUiSize): MobileUiPoint {
  assertPositiveFinite(page.width, 'page.width')
  assertPositiveFinite(page.height, 'page.height')
  return {
    x: Math.round(point.x / 100 * page.width / MOBILE_UI_GRID_SIZE)
      * MOBILE_UI_GRID_SIZE / page.width * 100,
    y: Math.round(point.y / 100 * page.height / MOBILE_UI_GRID_SIZE)
      * MOBILE_UI_GRID_SIZE / page.height * 100,
  }
}

export function constrainMobileUiTransform(
  transform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
): MobileUiElementTransform {
  assertPositiveFinite(naturalSize.width, 'naturalSize.width')
  assertPositiveFinite(naturalSize.height, 'naturalSize.height')
  assertPositiveFinite(page.width, 'page.width')
  assertPositiveFinite(page.height, 'page.height')
  const normalized = normalizeTransform(transform)
  const radians = normalized.rotation * Math.PI / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))
  const width = (naturalSize.width * cosine + naturalSize.height * sine) * normalized.scale
  const height = (naturalSize.width * sine + naturalSize.height * cosine) * normalized.scale
  return frozenTransform({
    ...normalized,
    x: boundedCenter(normalized.x, width / page.width * 50),
    y: boundedCenter(normalized.y, height / page.height * 50),
  })
}

export function mobileUiElementPinchScale(
  initialScale: number,
  initialDistance: number,
  currentDistance: number,
): number {
  if (!Number.isFinite(initialDistance) || initialDistance <= 0) return normalizeScale(initialScale)
  if (!Number.isFinite(currentDistance) || currentDistance < 0) return normalizeScale(initialScale)
  return normalizeScale(initialScale * currentDistance / initialDistance)
}

export function mobileUiElementRotation(
  initialRotation: number,
  initialAngle: number,
  currentAngle: number,
  snap: boolean,
): number {
  const rotation = normalizeRotation(
    initialRotation + (currentAngle - initialAngle) * 180 / Math.PI,
  )
  return snap ? normalizeRotation(Math.round(rotation / 5) * 5) : rotation
}

export function mobileUiPagePinchZoom(
  initialZoom: number,
  initialDistance: number,
  currentDistance: number,
): number {
  if (!Number.isFinite(initialDistance) || initialDistance <= 0) return normalizeZoom(initialZoom)
  if (!Number.isFinite(currentDistance) || currentDistance < 0) return normalizeZoom(initialZoom)
  return normalizeZoom(initialZoom * currentDistance / initialDistance)
}

function normalizeLayout(layout: MobileUiLayout): MobileUiLayout {
  const normalized = {} as Record<MobileUiElementId, MobileUiElementTransform>
  for (const id of MOBILE_UI_ELEMENT_IDS) normalized[id] = normalizeTransform(layout[id])
  return freezeLayout(normalized)
}

function normalizeTransform(transform: MobileUiElementTransform): MobileUiElementTransform {
  return frozenTransform({
    rotation: normalizeRotation(transform.rotation),
    scale: normalizeScale(transform.scale),
    x: clamp(finiteOr(transform.x, 50), 0, 100),
    y: clamp(finiteOr(transform.y, 50), 0, 100),
  })
}

function normalizeScale(scale: number): number {
  return clamp(finiteOr(scale, 1), MOBILE_UI_SCALE_MIN, MOBILE_UI_SCALE_MAX)
}

function normalizeZoom(zoom: number): number {
  return clamp(finiteOr(zoom, 1), MOBILE_UI_PAGE_ZOOM_MIN, MOBILE_UI_PAGE_ZOOM_MAX)
}

function normalizeRotation(rotation: number): number {
  const finite = finiteOr(rotation, 0)
  return ((finite + 180) % 360 + 360) % 360 - 180
}

function validTransform(value: unknown): value is MobileUiElementTransform {
  if (!record(value) || !sameKeys(Object.keys(value), ['rotation', 'scale', 'x', 'y'])) return false
  return finiteInRange(value.x, 0, 100)
    && finiteInRange(value.y, 0, 100)
    && finiteInRange(value.scale, MOBILE_UI_SCALE_MIN, MOBILE_UI_SCALE_MAX)
    && finiteInRange(value.rotation, -180, 180)
}

function boundedCenter(center: number, halfExtentPercent: number): number {
  if (halfExtentPercent >= 50) return 50
  return clamp(center, halfExtentPercent, 100 - halfExtentPercent)
}

function defaultLayoutState(): MobileUiLayoutState {
  return Object.freeze({ customized: false, layout: DEFAULT_MOBILE_UI_LAYOUT })
}

function browserStorage(): MobileUiLayoutStorage {
  return window.localStorage
}

function emit(state: MobileUiLayoutState): void {
  for (const listener of listeners) listener(state)
}

function freezeLayout(layout: Record<MobileUiElementId, MobileUiElementTransform>): MobileUiLayout {
  const ordered = {} as Record<MobileUiElementId, MobileUiElementTransform>
  for (const id of MOBILE_UI_ELEMENT_IDS) ordered[id] = frozenTransform(layout[id])
  return Object.freeze(ordered)
}

function frozenTransform(transform: MobileUiElementTransform): MobileUiElementTransform {
  return Object.freeze({
    rotation: transform.rotation,
    scale: transform.scale,
    x: transform.x,
    y: transform.y,
  })
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number, received ${value}`)
  }
}

function finiteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sameKeys(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false
  const sortedActual = [...actual].sort()
  const sortedExpected = [...expected].sort()
  return sortedActual.every((key, index) => key === sortedExpected[index])
}
