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
export const MOBILE_UI_SNAP_THRESHOLD = 6
export const MOBILE_UI_SCALE_MIN = 0.4
export const MOBILE_UI_SCALE_MAX = 3
export const MOBILE_UI_PAGE_ZOOM_MIN = 0.35
export const MOBILE_UI_PAGE_ZOOM_MAX = 4
export const MOBILE_UI_LAYOUT_VERSION = 2

export const MOBILE_UI_ELEMENT_IDS = Object.freeze([
  'pause',
  'diagnostics',
  'meters',
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

export const MOBILE_UI_RESIZE_HANDLES = Object.freeze([
  'north-west',
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
] as const)

export type MobileUiElementId = typeof MOBILE_UI_ELEMENT_IDS[number]
export type MobileUiResizeHandle = typeof MOBILE_UI_RESIZE_HANDLES[number]

export const MOBILE_UI_ELEMENT_LABELS: Readonly<Record<MobileUiElementId, string>> = Object.freeze({
  diagnostics: 'FPS / Ping',
  meters: 'Health / Mana',
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

export interface MobileUiSnapRect {
  readonly bottom: number
  readonly centerX: number
  readonly centerY: number
  readonly left: number
  readonly right: number
  readonly top: number
}

export interface MobileUiSnapGuide {
  readonly axis: 'x' | 'y'
  readonly kind: 'element' | 'grid' | 'page'
  readonly position: number
}

export interface MobileUiSnapResult {
  readonly guides: readonly MobileUiSnapGuide[]
  readonly transform: MobileUiElementTransform
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

export interface MobileUiLayoutDocument {
  readonly elements: MobileUiLayout
  readonly version: typeof MOBILE_UI_LAYOUT_VERSION
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
  // Width varies slightly with the live FPS digits; this stable two-digit seed keeps the
  // complete saved profile centred on the shipped diagnostics lane.
  add('diagnostics', 126.865, 20.1, 69.73, 10.2)
  // Base-health and base-mana tracks are each 110 HUD pixels wide with the
  // native 100 px gap between their inner edges. The live values may widen
  // either track, but both remain one transform owner centred at the screen top.
  add(
    'meters',
    viewportWidth / 2,
    24.5 * rootScale,
    320 * rootScale,
    20 * rootScale,
  )
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
  return {
    height: viewportHeight,
    width: viewportWidth,
  }
}

export function readMobileUiLayoutState(
  storage: MobileUiLayoutStorage = browserStorage(),
): MobileUiLayoutState {
  const serialized = storage.getItem(MOBILE_UI_LAYOUT_STORAGE_KEY)
  if (serialized === null) return defaultLayoutState()
  try {
    const parsed: unknown = JSON.parse(serialized)
    const current = mobileUiLayoutFromDocument(parsed)
    if (current) return Object.freeze({ customized: true, layout: current })
    const migrated = legacyMobileUiLayout(parsed)
    return migrated
      ? Object.freeze({ customized: true, layout: migrated })
      : defaultLayoutState()
  } catch {
    return defaultLayoutState()
  }
}

export function mobileUiLayoutDocument(layout: MobileUiLayout): MobileUiLayoutDocument {
  return Object.freeze({
    elements: normalizeLayout(layout),
    version: MOBILE_UI_LAYOUT_VERSION,
  })
}

export function mobileUiLayoutFromDocument(value: unknown): MobileUiLayout | null {
  if (!record(value)
    || !sameKeys(Object.keys(value), ['elements', 'version'])
    || value.version !== MOBILE_UI_LAYOUT_VERSION
    || !record(value.elements)
    || !sameKeys(Object.keys(value.elements), MOBILE_UI_ELEMENT_IDS)) return null
  const transforms = transformsFromElements(value.elements, MOBILE_UI_ELEMENT_IDS)
  return transforms ? freezeLayout(transforms as Record<MobileUiElementId, MobileUiElementTransform>) : null
}

export function setMobileUiLayout(
  layout: MobileUiLayout,
  storage: MobileUiLayoutStorage = browserStorage(),
): MobileUiLayoutState {
  const normalized = normalizeLayout(layout)
  storage.setItem(MOBILE_UI_LAYOUT_STORAGE_KEY, JSON.stringify(mobileUiLayoutDocument(normalized)))
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

export function mobileUiElementSnapRect(
  transform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
): MobileUiSnapRect {
  assertPositiveFinite(naturalSize.width, 'naturalSize.width')
  assertPositiveFinite(naturalSize.height, 'naturalSize.height')
  assertPositiveFinite(page.width, 'page.width')
  assertPositiveFinite(page.height, 'page.height')
  const normalized = normalizeTransform(transform)
  const centerX = normalized.x / 100 * page.width
  const centerY = normalized.y / 100 * page.height
  const extent = rotatedHalfExtent(normalized, naturalSize)
  return Object.freeze({
    bottom: centerY + extent.y,
    centerX,
    centerY,
    left: centerX - extent.x,
    right: centerX + extent.x,
    top: centerY - extent.y,
  })
}

export function snapMobileUiMove(
  transform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  siblingRects: readonly MobileUiSnapRect[] = [],
  threshold: number = MOBILE_UI_SNAP_THRESHOLD,
): MobileUiSnapResult {
  assertSnapThreshold(threshold)
  const bounded = constrainMobileUiTransform(transform, naturalSize, page)
  const frame = mobileUiElementSnapRect(bounded, naturalSize, page)
  const horizontal = bestAxisSnap(
    [frame.left, frame.centerX, frame.right],
    frame.centerX,
    frame.centerX - frame.left,
    page.width - (frame.right - frame.centerX),
    snapTargets('x', page, siblingRects),
    threshold,
  )
  const vertical = bestAxisSnap(
    [frame.top, frame.centerY, frame.bottom],
    frame.centerY,
    frame.centerY - frame.top,
    page.height - (frame.bottom - frame.centerY),
    snapTargets('y', page, siblingRects),
    threshold,
  )
  const snapped = constrainMobileUiTransform({
    ...bounded,
    x: (frame.centerX + (horizontal?.delta ?? 0)) / page.width * 100,
    y: (frame.centerY + (vertical?.delta ?? 0)) / page.height * 100,
  }, naturalSize, page)
  const snappedFrame = mobileUiElementSnapRect(snapped, naturalSize, page)
  const guides = [
    validGuide(horizontal?.guide, snappedFrame),
    validGuide(vertical?.guide, snappedFrame),
  ].filter((guide): guide is MobileUiSnapGuide => guide !== null)
  return snapResult(snapped, guides)
}

export function mobileUiResizeTransform(
  initialTransform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  handle: MobileUiResizeHandle,
  initialPointer: MobileUiPoint,
  currentPointer: MobileUiPoint,
): MobileUiElementTransform {
  const resize = resizeProjection(
    initialTransform,
    naturalSize,
    page,
    handle,
    initialPointer,
    currentPointer,
  )
  return constrainMobileUiTransform(resizeAtScale(resize, resize.scale), naturalSize, page)
}

export function snapMobileUiResize(
  initialTransform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  handle: MobileUiResizeHandle,
  initialPointer: MobileUiPoint,
  currentPointer: MobileUiPoint,
  siblingRects: readonly MobileUiSnapRect[] = [],
  threshold: number = MOBILE_UI_SNAP_THRESHOLD,
): MobileUiSnapResult {
  assertSnapThreshold(threshold)
  const resize = resizeProjection(
    initialTransform,
    naturalSize,
    page,
    handle,
    initialPointer,
    currentPointer,
  )
  const spanLength = Math.hypot(resize.span.x, resize.span.y)
  let best: ScaleSnap | null = null
  for (const axis of ['x', 'y'] as const) {
    const span = resize.span[axis]
    if (Math.abs(span) <= SNAP_EPSILON) continue
    for (const target of snapTargets(axis, page, siblingRects)) {
      const scale = (target.position - resize.fixed[axis]) / span
      if (scale < MOBILE_UI_SCALE_MIN || scale > resize.maximumScale) continue
      const travel = Math.abs(scale - resize.scale) * spanLength
      if (travel > threshold + SNAP_EPSILON) continue
      const candidate = constrainMobileUiTransform(
        resizeAtScale(resize, scale),
        naturalSize,
        page,
      )
      if (!resizeGuideAligned(candidate, naturalSize, page, resize.direction, axis, target.position)) {
        continue
      }
      const next = { guide: target, scale, travel }
      if (betterScaleSnap(next, best)) best = next
    }
  }
  if (!best) {
    return snapResult(
      constrainMobileUiTransform(resizeAtScale(resize, resize.scale), naturalSize, page),
      [],
    )
  }
  const transform = constrainMobileUiTransform(
    resizeAtScale(resize, best.scale),
    naturalSize,
    page,
  )
  const guides = matchingResizeGuides(
    transform,
    naturalSize,
    page,
    resize.direction,
    siblingRects,
    best.guide,
  )
  return snapResult(transform, guides)
}

export function snapMobileUiScale(
  transform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  siblingRects: readonly MobileUiSnapRect[] = [],
  threshold: number = MOBILE_UI_SNAP_THRESHOLD,
): MobileUiSnapResult {
  assertSnapThreshold(threshold)
  const bounded = constrainMobileUiTransform(transform, naturalSize, page)
  const frame = mobileUiElementSnapRect(bounded, naturalSize, page)
  const unitExtent = rotatedHalfExtent({ ...bounded, scale: 1 }, naturalSize)
  let best: ScaleSnap | null = null
  for (const axis of ['x', 'y'] as const) {
    const center = axis === 'x' ? frame.centerX : frame.centerY
    const extent = unitExtent[axis]
    const anchors = axis === 'x'
      ? [{ position: frame.left, sign: -1 }, { position: frame.right, sign: 1 }]
      : [{ position: frame.top, sign: -1 }, { position: frame.bottom, sign: 1 }]
    for (const anchor of anchors) {
      for (const target of snapTargets(axis, page, siblingRects)) {
        const travel = Math.abs(target.position - anchor.position)
        if (travel > threshold + SNAP_EPSILON) continue
        const scale = (target.position - center) / (anchor.sign * extent)
        if (scale < MOBILE_UI_SCALE_MIN || scale > MOBILE_UI_SCALE_MAX) continue
        const candidate = constrainMobileUiTransform({ ...bounded, scale }, naturalSize, page)
        const candidateFrame = mobileUiElementSnapRect(candidate, naturalSize, page)
        const candidateAnchor = axis === 'x'
          ? (anchor.sign < 0 ? candidateFrame.left : candidateFrame.right)
          : (anchor.sign < 0 ? candidateFrame.top : candidateFrame.bottom)
        if (Math.abs(candidateAnchor - target.position) > SNAP_EPSILON) continue
        const next = { guide: target, scale, travel }
        if (betterScaleSnap(next, best)) best = next
      }
    }
  }
  if (!best) return snapResult(bounded, [])
  const snapped = constrainMobileUiTransform({ ...bounded, scale: best.scale }, naturalSize, page)
  return snapResult(
    snapped,
    matchingFrameGuides(
      mobileUiElementSnapRect(snapped, naturalSize, page),
      page,
      siblingRects,
      best.guide,
    ),
  )
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

type SnapTarget = MobileUiSnapGuide

interface AxisSnap {
  readonly delta: number
  readonly guide: SnapTarget
}

interface ScaleSnap {
  readonly guide: SnapTarget
  readonly scale: number
  readonly travel: number
}

interface ResizeProjection {
  readonly direction: MobileUiPoint
  readonly fixed: MobileUiPoint
  readonly initial: MobileUiElementTransform
  readonly maximumScale: number
  readonly page: MobileUiSize
  readonly scale: number
  readonly span: MobileUiPoint
}

const SNAP_EPSILON = 1e-6

const RESIZE_DIRECTIONS: Readonly<Record<MobileUiResizeHandle, MobileUiPoint>> = Object.freeze({
  'north-west': Object.freeze({ x: -1, y: -1 }),
  north: Object.freeze({ x: 0, y: -1 }),
  'north-east': Object.freeze({ x: 1, y: -1 }),
  east: Object.freeze({ x: 1, y: 0 }),
  'south-east': Object.freeze({ x: 1, y: 1 }),
  south: Object.freeze({ x: 0, y: 1 }),
  'south-west': Object.freeze({ x: -1, y: 1 }),
  west: Object.freeze({ x: -1, y: 0 }),
})

function rotatedHalfExtent(
  transform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
): MobileUiPoint {
  const radians = transform.rotation * Math.PI / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))
  return {
    x: (naturalSize.width * cosine + naturalSize.height * sine) * transform.scale / 2,
    y: (naturalSize.width * sine + naturalSize.height * cosine) * transform.scale / 2,
  }
}

function snapTargets(
  axis: MobileUiSnapGuide['axis'],
  page: MobileUiSize,
  siblingRects: readonly MobileUiSnapRect[],
): readonly SnapTarget[] {
  const dimension = axis === 'x' ? page.width : page.height
  const targets: SnapTarget[] = []
  for (let position = 0; position <= dimension + SNAP_EPSILON; position += MOBILE_UI_GRID_SIZE) {
    targets.push({ axis, kind: 'grid', position })
  }
  targets.push(
    { axis, kind: 'page', position: 0 },
    { axis, kind: 'page', position: dimension / 2 },
    { axis, kind: 'page', position: dimension },
  )
  for (const rect of siblingRects) {
    const positions = axis === 'x'
      ? [rect.left, rect.centerX, rect.right]
      : [rect.top, rect.centerY, rect.bottom]
    for (const position of positions) {
      if (Number.isFinite(position)) targets.push({ axis, kind: 'element', position })
    }
  }
  return targets
}

function bestAxisSnap(
  anchors: readonly number[],
  center: number,
  minimumCenter: number,
  maximumCenter: number,
  targets: readonly SnapTarget[],
  threshold: number,
): AxisSnap | null {
  let best: AxisSnap | null = null
  for (const target of targets) {
    for (const anchor of anchors) {
      const delta = target.position - anchor
      if (Math.abs(delta) > threshold + SNAP_EPSILON) continue
      const nextCenter = center + delta
      if (
        nextCenter < minimumCenter - SNAP_EPSILON
        || nextCenter > maximumCenter + SNAP_EPSILON
      ) continue
      const next = { delta, guide: target }
      if (betterAxisSnap(next, best)) best = next
    }
  }
  return best
}

function betterAxisSnap(candidate: AxisSnap, current: AxisSnap | null): boolean {
  if (!current) return true
  const candidateDistance = Math.abs(candidate.delta)
  const currentDistance = Math.abs(current.delta)
  if (Math.abs(candidateDistance - currentDistance) > SNAP_EPSILON) {
    return candidateDistance < currentDistance
  }
  const candidatePriority = snapKindPriority(candidate.guide.kind)
  const currentPriority = snapKindPriority(current.guide.kind)
  if (candidatePriority !== currentPriority) return candidatePriority < currentPriority
  return candidate.guide.position < current.guide.position
}

function betterScaleSnap(candidate: ScaleSnap, current: ScaleSnap | null): boolean {
  if (!current) return true
  if (Math.abs(candidate.travel - current.travel) > SNAP_EPSILON) {
    return candidate.travel < current.travel
  }
  const candidatePriority = snapKindPriority(candidate.guide.kind)
  const currentPriority = snapKindPriority(current.guide.kind)
  if (candidatePriority !== currentPriority) return candidatePriority < currentPriority
  if (candidate.guide.axis !== current.guide.axis) return candidate.guide.axis === 'x'
  return candidate.guide.position < current.guide.position
}

function snapKindPriority(kind: MobileUiSnapGuide['kind']): number {
  if (kind === 'element') return 0
  if (kind === 'page') return 1
  return 2
}

function resizeProjection(
  initialTransform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  handle: MobileUiResizeHandle,
  initialPointer: MobileUiPoint,
  currentPointer: MobileUiPoint,
): ResizeProjection {
  assertFinitePoint(initialPointer, 'initialPointer')
  assertFinitePoint(currentPointer, 'currentPointer')
  const initial = constrainMobileUiTransform(initialTransform, naturalSize, page)
  const direction = RESIZE_DIRECTIONS[handle]
  const radians = initial.rotation * Math.PI / 180
  const activeUnit = rotatePoint({
    x: direction.x * naturalSize.width / 2,
    y: direction.y * naturalSize.height / 2,
  }, radians)
  const span = { x: activeUnit.x * 2, y: activeUnit.y * 2 }
  const center = {
    x: initial.x / 100 * page.width,
    y: initial.y / 100 * page.height,
  }
  const fixed = {
    x: center.x - activeUnit.x * initial.scale,
    y: center.y - activeUnit.y * initial.scale,
  }
  const pointerDelta = {
    x: currentPointer.x - initialPointer.x,
    y: currentPointer.y - initialPointer.y,
  }
  const spanSquared = span.x * span.x + span.y * span.y
  const rawScale = normalizeScale(
    initial.scale + (pointerDelta.x * span.x + pointerDelta.y * span.y) / spanSquared,
  )
  const maximumScale = resizeMaximumScale(initial, naturalSize, page, fixed, span)
  const scale = clamp(rawScale, MOBILE_UI_SCALE_MIN, maximumScale)
  return { direction, fixed, initial, maximumScale, page, scale, span }
}

function resizeMaximumScale(
  initial: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  fixed: MobileUiPoint,
  span: MobileUiPoint,
): number {
  const extent = rotatedHalfExtent({ ...initial, scale: 1 }, naturalSize)
  let maximum = MOBILE_UI_SCALE_MAX
  maximum = upperScaleForMinimum(maximum, fixed.x, span.x / 2 - extent.x, 0)
  maximum = upperScaleForMaximum(maximum, fixed.x, span.x / 2 + extent.x, page.width)
  maximum = upperScaleForMinimum(maximum, fixed.y, span.y / 2 - extent.y, 0)
  maximum = upperScaleForMaximum(maximum, fixed.y, span.y / 2 + extent.y, page.height)
  return clamp(Math.max(initial.scale, maximum), MOBILE_UI_SCALE_MIN, MOBILE_UI_SCALE_MAX)
}

function upperScaleForMinimum(
  current: number,
  constant: number,
  slope: number,
  minimum: number,
): number {
  return slope < -SNAP_EPSILON
    ? Math.min(current, (constant - minimum) / -slope)
    : current
}

function upperScaleForMaximum(
  current: number,
  constant: number,
  slope: number,
  maximum: number,
): number {
  return slope > SNAP_EPSILON
    ? Math.min(current, (maximum - constant) / slope)
    : current
}

function resizeAtScale(
  projection: ResizeProjection,
  scale: number,
): MobileUiElementTransform {
  return {
    rotation: projection.initial.rotation,
    scale,
    x: (projection.fixed.x + projection.span.x * scale / 2) / projection.page.width * 100,
    y: (projection.fixed.y + projection.span.y * scale / 2) / projection.page.height * 100,
  }
}

function resizeGuideAligned(
  transform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  direction: MobileUiPoint,
  axis: MobileUiSnapGuide['axis'],
  position: number,
): boolean {
  return Math.abs(resizeHandlePoint(transform, naturalSize, page, direction)[axis] - position)
    <= SNAP_EPSILON
}

function resizeHandlePoint(
  transform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  direction: MobileUiPoint,
): MobileUiPoint {
  const radians = transform.rotation * Math.PI / 180
  const offset = rotatePoint({
    x: direction.x * naturalSize.width * transform.scale / 2,
    y: direction.y * naturalSize.height * transform.scale / 2,
  }, radians)
  return {
    x: transform.x / 100 * page.width + offset.x,
    y: transform.y / 100 * page.height + offset.y,
  }
}

function matchingResizeGuides(
  transform: MobileUiElementTransform,
  naturalSize: MobileUiSize,
  page: MobileUiSize,
  direction: MobileUiPoint,
  siblingRects: readonly MobileUiSnapRect[],
  primary: SnapTarget,
): readonly MobileUiSnapGuide[] {
  const point = resizeHandlePoint(transform, naturalSize, page, direction)
  const guides: MobileUiSnapGuide[] = [primary]
  const otherAxis = primary.axis === 'x' ? 'y' : 'x'
  const other = preferredTargetAt(point[otherAxis], snapTargets(otherAxis, page, siblingRects))
  if (other) guides.push(other)
  return freezeGuides(guides)
}

function matchingFrameGuides(
  frame: MobileUiSnapRect,
  page: MobileUiSize,
  siblingRects: readonly MobileUiSnapRect[],
  primary: SnapTarget,
): readonly MobileUiSnapGuide[] {
  const guides: MobileUiSnapGuide[] = [primary]
  const otherAxis = primary.axis === 'x' ? 'y' : 'x'
  const anchors = otherAxis === 'x' ? [frame.left, frame.right] : [frame.top, frame.bottom]
  let other: SnapTarget | null = null
  for (const anchor of anchors) {
    const aligned = preferredTargetAt(anchor, snapTargets(otherAxis, page, siblingRects))
    if (aligned && (!other || snapKindPriority(aligned.kind) < snapKindPriority(other.kind))) {
      other = aligned
    }
  }
  if (other) guides.push(other)
  return freezeGuides(guides)
}

function preferredTargetAt(
  position: number,
  targets: readonly SnapTarget[],
): SnapTarget | null {
  let preferred: SnapTarget | null = null
  for (const target of targets) {
    if (Math.abs(target.position - position) > SNAP_EPSILON) continue
    if (!preferred || snapKindPriority(target.kind) < snapKindPriority(preferred.kind)) {
      preferred = target
    }
  }
  return preferred
}

function validGuide(
  guide: SnapTarget | undefined,
  frame: MobileUiSnapRect,
): MobileUiSnapGuide | null {
  return guide && frameGuideAligned(frame, guide) ? guide : null
}

function frameGuideAligned(frame: MobileUiSnapRect, guide: MobileUiSnapGuide): boolean {
  const anchors = guide.axis === 'x'
    ? [frame.left, frame.centerX, frame.right]
    : [frame.top, frame.centerY, frame.bottom]
  return anchors.some((position) => Math.abs(position - guide.position) <= SNAP_EPSILON)
}

function snapResult(
  transform: MobileUiElementTransform,
  guides: readonly MobileUiSnapGuide[],
): MobileUiSnapResult {
  return Object.freeze({
    guides: freezeGuides(guides),
    transform: frozenTransform(transform),
  })
}

function freezeGuides(guides: readonly MobileUiSnapGuide[]): readonly MobileUiSnapGuide[] {
  const unique = new Map<string, MobileUiSnapGuide>()
  for (const guide of guides) {
    const key = `${guide.axis}:${guide.kind}:${guide.position}`
    unique.set(key, Object.freeze({ ...guide }))
  }
  return Object.freeze([...unique.values()].sort((left, right) => (
    left.axis.localeCompare(right.axis)
    || left.position - right.position
    || snapKindPriority(left.kind) - snapKindPriority(right.kind)
  )))
}

function rotatePoint(point: MobileUiPoint, radians: number): MobileUiPoint {
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  }
}

function assertSnapThreshold(threshold: number): void {
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError(`threshold must be a non-negative finite number, received ${threshold}`)
  }
}

function assertFinitePoint(point: MobileUiPoint, name: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${name} must contain finite coordinates`)
  }
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

const LEGACY_MOBILE_UI_ELEMENT_IDS = Object.freeze(
  MOBILE_UI_ELEMENT_IDS.filter((id) => id !== 'meters'),
)

function legacyMobileUiLayout(value: unknown): MobileUiLayout | null {
  if (!record(value)
    || !sameKeys(Object.keys(value), ['elements', 'version'])
    || value.version !== 1
    || !record(value.elements)
    || !sameKeys(Object.keys(value.elements), LEGACY_MOBILE_UI_ELEMENT_IDS)) return null
  const legacy = transformsFromElements(value.elements, LEGACY_MOBILE_UI_ELEMENT_IDS)
  if (!legacy) return null
  return freezeLayout({
    ...legacy,
    meters: DEFAULT_MOBILE_UI_LAYOUT.meters,
  } as Record<MobileUiElementId, MobileUiElementTransform>)
}

function transformsFromElements(
  elements: Record<string, unknown>,
  ids: readonly MobileUiElementId[],
): Partial<Record<MobileUiElementId, MobileUiElementTransform>> | null {
  const layout: Partial<Record<MobileUiElementId, MobileUiElementTransform>> = {}
  for (const id of ids) {
    const transform = elements[id]
    if (!validTransform(transform)) return null
    layout[id] = frozenTransform(transform)
  }
  return layout
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
