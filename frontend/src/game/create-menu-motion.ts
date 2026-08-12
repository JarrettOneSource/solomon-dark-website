import {
  compileNativeNaturalSpline,
  evaluateNativeNaturalSpline,
} from './native-natural-spline.ts'

export type CreateHandPose = 'cupped' | 'fist' | 'raised'
export type CreateWizardElement = 'air' | 'earth' | 'ether' | 'fire' | 'water'

export interface CreateHandOffset {
  x: number
  y: number
}

export interface CreateMenuMotionFrame {
  disciplinesVisible: boolean
  elementsVisible: boolean
  leftImpulse: CreateHandOffset
  leftOffset: CreateHandOffset
  leftPose: CreateHandPose
  rightImpulse: CreateHandOffset
  rightOffset: CreateHandOffset
  rightPose: CreateHandPose
  settled: boolean
}

export interface CreateHandIdleOffset {
  x: number
  y: number
}

export interface CreateSelectedElementMotion {
  position: CreateHandOffset
  scale: number
}

export const CREATE_ENTRY_CUPPED_MS = 1_320
export const CREATE_ENTRY_RAISED_MS = 1_340
export const CREATE_ENTRY_SETTLED_MS = 1_400
export const CREATE_SELECTION_LEFT_START_MS = 600
export const CREATE_SELECTION_LEFT_CUPPED_MS = 910
export const CREATE_SELECTION_LEFT_SETTLED_MS = 980
export const CREATE_SELECTION_RIGHT_CUPPED_MS = 1_610
export const CREATE_SELECTION_RIGHT_RAISED_MS = 1_640
export const CREATE_SELECTION_SETTLED_MS = 1_680

const CREATE_FIXED_TICK_MS = 10
const CREATE_HAND_PHASE_DEGREES_PER_TICK = 0.5
const CREATE_HAND_X_AMPLITUDE = 5
const CREATE_HAND_Y_AMPLITUDE = 2.5

const ZERO_OFFSET: CreateHandOffset = { x: 0, y: 0 }
const LEFT_ENTRY_OFFSET: CreateHandOffset = { x: -50, y: 200 }
const LEFT_SELECTED_OFFSET: CreateHandOffset = { x: -125.90988, y: 200 }
const RIGHT_CLOSED_OFFSET: CreateHandOffset = { x: 50, y: 300 }
const SELECTED_ELEMENT_END: CreateHandOffset = { x: 450, y: 660 }
const SELECTED_ELEMENT_MIDDLE: CreateHandOffset = { x: 650, y: 685 }
const SELECTED_ELEMENT_START: Readonly<Record<CreateWizardElement, CreateHandOffset>> = {
  air: { x: 816.346, y: 654.189 },
  earth: { x: 656.798, y: 417.651 },
  ether: { x: 826.303, y: 369.046 },
  fire: { x: 924.909, y: 515.235 },
  water: { x: 650.644, y: 593.879 },
}
const SELECTED_ELEMENT_SPLINE = Object.fromEntries(
  Object.entries(SELECTED_ELEMENT_START).map(([element, start]) => [
    element,
    compileNativeNaturalSpline([start, SELECTED_ELEMENT_MIDDLE, SELECTED_ELEMENT_END]),
  ]),
) as Record<CreateWizardElement, ReturnType<typeof compileNativeNaturalSpline>>

interface NativeOpenState {
  impulse: CreateHandOffset
  offset: CreateHandOffset
  pose: CreateHandPose
}

const f32 = Math.fround

function nativeImpulse(tick: number, salt: number): CreateHandOffset {
  let value = Math.imul(tick ^ salt, 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value ^= value >>> 16
  const angle = (value >>> 0) / 0x1_0000_0000 * Math.PI * 2
  const next = Math.imul(value ^ 0x9e3779b9, 0x27d4eb2d)
  const magnitude = ((next ^ (next >>> 15)) >>> 0) / 0x1_0000_0000 * 5
  return {
    x: f32(Math.cos(angle) * magnitude),
    y: f32(-Math.sin(angle) * magnitude),
  }
}

function shortenAndDamp(offset: CreateHandOffset): CreateHandOffset {
  const length = Math.hypot(offset.x, offset.y)
  if (length <= 3.5) return ZERO_OFFSET
  const shortened = f32((length - 3.5) / length)
  return {
    x: f32(f32(offset.x * shortened) * f32(0.7)),
    y: f32(f32(offset.y * shortened) * f32(0.8)),
  }
}

/**
 * Replays the stock fist -> cupped -> raised state at its 100 Hz update rate.
 * The native RNG only chooses the small impulse vector, so a deterministic
 * hash preserves that bounded shake without coupling layout to browser RNG.
 */
function nativeOpenStateAt(
  elapsedMs: number,
  initialOffset: CreateHandOffset,
  initialTimer: number,
  salt: number,
): NativeOpenState {
  const ticks = Math.floor(Math.max(0, elapsedMs) / CREATE_FIXED_TICK_MS)
  let offset = { ...initialOffset }
  let impulse = { ...ZERO_OFFSET }
  let pose: CreateHandPose = 'fist'
  let recoilPhase = 0
  let timer = initialTimer

  for (let tick = 1; tick <= ticks; tick += 1) {
    timer -= 1
    let recoilY = 0
    if (timer < 1) {
      if (timer === 0) recoilPhase = 0.5
      recoilY = f32(Math.sin(recoilPhase * Math.PI / 180) * 150)
      recoilPhase = Math.max(0, f32(recoilPhase - 0.025))
      offset = shortenAndDamp(offset)
      const speed = Math.hypot(offset.x, offset.y)
      if (speed < 10) pose = 'cupped'
      if (speed < 1) pose = 'raised'
    }

    if (timer < 100 && pose === 'fist') {
      impulse = nativeImpulse(tick, salt)
      offset = {
        x: f32(f32(offset.x - 0.01) * f32(1.01)),
        y: f32(offset.y + 1),
      }
    }
    impulse = { x: impulse.x, y: f32(impulse.y + recoilY) }
  }

  return { impulse, offset, pose }
}

function leftSelectionOffsetAt(elapsed: number): CreateHandOffset {
  const ticks = Math.min(
    38,
    Math.floor(Math.max(0, elapsed - CREATE_SELECTION_LEFT_START_MS) / CREATE_FIXED_TICK_MS),
  )
  let x = f32(0)
  let y = f32(0)
  for (let tick = 0; tick < ticks; tick += 1) {
    for (let substep = 0; substep < 2; substep += 1) {
      x = f32(x - f32(y / 30))
      y = Math.min(200, f32(f32(y + 0.25) * f32(1.05)))
    }
  }
  return { x, y }
}

/** Stock selected-element path, driven by the same recurrence as the left hand. */
export function createSelectedElementMotionAt(
  element: CreateWizardElement,
  elapsedMs: number,
): CreateSelectedElementMotion {
  const elapsed = Math.max(0, elapsedMs)
  if (elapsed >= CREATE_SELECTION_LEFT_SETTLED_MS) {
    return { position: SELECTED_ELEMENT_END, scale: 3 }
  }

  const ticks = Math.floor(
    Math.max(0, elapsed - CREATE_SELECTION_LEFT_START_MS) / CREATE_FIXED_TICK_MS,
  )
  const spline = SELECTED_ELEMENT_SPLINE[element]
  let cursor = 0
  let position = SELECTED_ELEMENT_START[element]
  let scale = 1
  let x = f32(0)
  let y = f32(0)
  for (let tick = 0; tick < ticks; tick += 1) {
    for (let substep = 0; substep < 2; substep += 1) {
      x = f32(x - f32(y / 30))
      y = Math.min(200, f32(f32(y + 0.25) * f32(1.05)))
      position = evaluateNativeNaturalSpline(spline, cursor)
      cursor = y / 200 * spline.extent
      scale = y / 200 * 2 + 1
    }
  }
  return { position, scale }
}

function rightSelectionStateAt(elapsed: number): NativeOpenState {
  return nativeOpenStateAt(
    elapsed - CREATE_SELECTION_LEFT_SETTLED_MS,
    RIGHT_CLOSED_OFFSET,
    51,
    0x51ec7,
  )
}

/** Native Create-state hand drift, sampled on the original 100 Hz update. */
export function createHandIdleOffsetAt(elapsedMs: number): CreateHandIdleOffset {
  const ticks = Math.floor(Math.max(0, elapsedMs) / CREATE_FIXED_TICK_MS)
  const phaseRadians = ticks * CREATE_HAND_PHASE_DEGREES_PER_TICK * Math.PI / 180

  return {
    x: Math.sin(phaseRadians) * CREATE_HAND_X_AMPLITUDE,
    y: Math.sin(phaseRadians * 0.5) * CREATE_HAND_Y_AMPLITUDE,
  }
}

export function createEntryMotionAt(elapsedMs: number): CreateMenuMotionFrame {
  const elapsed = Math.max(0, elapsedMs)
  const left = nativeOpenStateAt(elapsed, LEFT_ENTRY_OFFSET, 120, 0x120e17)

  return {
    disciplinesVisible: false,
    elementsVisible: elapsed >= CREATE_ENTRY_RAISED_MS,
    leftImpulse: left.impulse,
    leftOffset: left.offset,
    leftPose: left.pose,
    rightImpulse: ZERO_OFFSET,
    rightOffset: RIGHT_CLOSED_OFFSET,
    rightPose: 'fist',
    settled: elapsed >= CREATE_ENTRY_SETTLED_MS,
  }
}

export function createSelectionMotionAt(elapsedMs: number): CreateMenuMotionFrame {
  const elapsed = Math.max(0, elapsedMs)
  const right = rightSelectionStateAt(elapsed)

  return {
    disciplinesVisible: elapsed >= CREATE_SELECTION_RIGHT_RAISED_MS,
    elementsVisible: false,
    leftImpulse: ZERO_OFFSET,
    leftOffset: elapsed >= CREATE_SELECTION_LEFT_SETTLED_MS
      ? LEFT_SELECTED_OFFSET
      : leftSelectionOffsetAt(elapsed),
    leftPose: elapsed < CREATE_SELECTION_LEFT_CUPPED_MS ? 'raised' : 'cupped',
    rightImpulse: right.impulse,
    rightOffset: right.offset,
    rightPose: right.pose,
    settled: elapsed >= CREATE_SELECTION_SETTLED_MS,
  }
}
