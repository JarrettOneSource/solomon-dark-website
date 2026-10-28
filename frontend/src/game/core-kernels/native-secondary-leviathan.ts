import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { Vector2 } from './vector.ts'

const LEVIATHAN_SCALE_IN_STEP = Math.fround(0.02500000037252903)
const LEVIATHAN_SCALE_OUT_STEP = Math.fround(0.03999999910593033)

export const NATIVE_LEVIATHAN_ACTIVE_FIRST_AGE = 41
export const NATIVE_LEVIATHAN_ACTIVE_LAST_AGE = 1_640
export const NATIVE_LEVIATHAN_LIFETIME_TICKS = 1_664
export const NATIVE_LEVIATHAN_TARGET_RANGE = 300
export const NATIVE_LEVIATHAN_TARGET_HALF_ANGLE_DEGREES = 25
export const NATIVE_ETHER_BOLT_LIFETIME_TICKS = 200

interface NativeLeviathanLayoutSeed {
  readonly baseX: number
  readonly baseYMaximum: number
  readonly baseYMinimum: number
  readonly headingDegrees: number
  readonly spriteScale: number
}

export interface NativeLeviathanAppendageBirth {
  readonly bank: 0 | 1
  readonly baseOffset: Vector2
  readonly countdown: number
  readonly headingDegrees: number
  readonly spinDegrees: number
  readonly spinStepDegrees: number
  readonly spriteScale: number
}

export interface NativeLeviathanBirth {
  readonly appendages: readonly NativeLeviathanAppendageBirth[]
  readonly maximumScale: number
  readonly quantity: number
  readonly rng: NativeRngState
  readonly rotationRadians: number
}

const NATIVE_LEVIATHAN_LAYOUTS: Readonly<Record<number, readonly NativeLeviathanLayoutSeed[]>> = Object.freeze({
  1: Object.freeze([
    { baseX: 0, baseYMinimum: 20, baseYMaximum: 40, headingDegrees: 10, spriteScale: 2.1 },
  ]),
  2: Object.freeze([
    { baseX: -10, baseYMinimum: 20, baseYMaximum: 40, headingDegrees: 10, spriteScale: 2.1 },
    { baseX: 10, baseYMinimum: 10, baseYMaximum: 20, headingDegrees: 135, spriteScale: 2 },
  ]),
  3: Object.freeze([
    { baseX: 0, baseYMinimum: 20, baseYMaximum: 40, headingDegrees: 10, spriteScale: 2.1 },
    { baseX: 15, baseYMinimum: 10, baseYMaximum: 20, headingDegrees: 135, spriteScale: 2 },
    { baseX: -15, baseYMinimum: 10, baseYMaximum: 20, headingDegrees: 225, spriteScale: 2 },
  ]),
  4: Object.freeze([
    { baseX: -10, baseYMinimum: 20, baseYMaximum: 40, headingDegrees: 10, spriteScale: 2.1 },
    { baseX: 10, baseYMinimum: 20, baseYMaximum: 50, headingDegrees: 10, spriteScale: 2 },
    { baseX: 18, baseYMinimum: 10, baseYMaximum: 20, headingDegrees: 135, spriteScale: 2 },
    { baseX: -18, baseYMinimum: 10, baseYMaximum: 20, headingDegrees: 225, spriteScale: 2 },
  ]),
  5: Object.freeze([
    { baseX: 0, baseYMinimum: 40, baseYMaximum: 50, headingDegrees: 10, spriteScale: 2.25 },
    { baseX: -18, baseYMinimum: 20, baseYMaximum: 40, headingDegrees: 10, spriteScale: 2.1 },
    { baseX: 18, baseYMinimum: 20, baseYMaximum: 50, headingDegrees: 10, spriteScale: 2 },
    { baseX: 18, baseYMinimum: 10, baseYMaximum: 20, headingDegrees: 135, spriteScale: 2 },
    { baseX: -18, baseYMinimum: 10, baseYMaximum: 20, headingDegrees: 225, spriteScale: 2 },
  ]),
})

const NATIVE_LEVIATHAN_MAXIMUM_SCALE = Object.freeze({
  1: Math.fround(0.75),
  2: Math.fround(0.85),
  3: Math.fround(0.95),
  4: 1,
  5: 1,
} as const)

const NATIVE_LEVIATHAN_MUZZLE_SOCKETS: readonly Vector2[] = Object.freeze([
  { x: 0, y: -44.5 }, { x: 7.5, y: -43.5 }, { x: 13, y: -40 },
  { x: 16.5, y: -34.5 }, { x: 17.5, y: -28.5 }, { x: 15.5, y: -22.5 },
  { x: 10.5, y: -17.5 }, { x: 3.5, y: -15.5 }, { x: -3.5, y: -15.5 },
  { x: -10.5, y: -17.5 }, { x: -15.5, y: -22.5 }, { x: -17.5, y: -28.5 },
  { x: -16.5, y: -34.5 }, { x: -13, y: -40 }, { x: -7.5, y: -43.5 },
  { x: 0, y: -44.5 }, { x: 7.5, y: -43.5 }, { x: 13, y: -40 },
  { x: 16.5, y: -34.5 }, { x: 17.5, y: -28.5 }, { x: 15.5, y: -22.5 },
  { x: 10.5, y: -17.5 }, { x: 3.5, y: -15.5 }, { x: -3.5, y: -15.5 },
  { x: -10.5, y: -17.5 }, { x: -15.5, y: -22.5 }, { x: -17.5, y: -28.5 },
  { x: -16.5, y: -34.5 }, { x: -13, y: -40 }, { x: -7.5, y: -43.5 },
])

export function createNativeLeviathanBirth(
  source: NativeRngState,
  configuredMaximum: number,
  forceMaximum: boolean,
): NativeLeviathanBirth {
  const rotation = drawNativeFloat(source, 360)
  const maximum = Math.max(1, Math.min(5, Math.round(configuredMaximum)))
  const selector = forceMaximum
    ? { state: rotation.state, value: maximum - 1 }
    : drawNativeInteger(rotation.state, maximum)
  const quantity = selector.value + 1
  const layout = NATIVE_LEVIATHAN_LAYOUTS[quantity]
  if (!layout) throw new RangeError(`unsupported native Leviathan quantity ${quantity}`)

  let rng = selector.state
  const appendages: NativeLeviathanAppendageBirth[] = []
  for (const authored of layout) {
    const baseY = drawNativeFloat(rng, authored.baseYMaximum - authored.baseYMinimum)
    const spin = drawNativeFloat(baseY.state, 360)
    const spinStep = drawNativeFloat(spin.state, 1)
    const bank = drawNativeInteger(spinStep.state, 2)
    const countdown = drawNativeInteger(bank.state, 100)
    rng = countdown.state
    appendages.push(Object.freeze({
      bank: bank.value as 0 | 1,
      baseOffset: Object.freeze({
        x: authored.baseX,
        y: Math.fround(-(authored.baseYMinimum + baseY.value)),
      }),
      countdown: countdown.value,
      headingDegrees: authored.headingDegrees,
      spinDegrees: spin.value,
      spinStepDegrees: Math.fround(2 + spinStep.value),
      spriteScale: authored.spriteScale,
    }))
  }

  return Object.freeze({
    appendages: Object.freeze(appendages),
    maximumScale: NATIVE_LEVIATHAN_MAXIMUM_SCALE[quantity as keyof typeof NATIVE_LEVIATHAN_MAXIMUM_SCALE],
    quantity,
    rng,
    rotationRadians: rotation.value * Math.PI / 180,
  })
}

export function nativeLeviathanCurrentScale(ageTicks: number): number {
  const age = Math.max(0, Math.trunc(ageTicks))
  if (age <= 40) {
    let scale = Math.fround(0)
    for (let tick = 0; tick < age; tick += 1) {
      scale = Math.fround(scale + LEVIATHAN_SCALE_IN_STEP)
    }
    return scale
  }
  if (age < NATIVE_LEVIATHAN_ACTIVE_LAST_AGE) return 1
  let scale = Math.fround(1)
  const fadeUpdates = Math.min(25, age - NATIVE_LEVIATHAN_ACTIVE_LAST_AGE + 1)
  for (let tick = 0; tick < fadeUpdates; tick += 1) {
    scale = Math.fround(scale - LEVIATHAN_SCALE_OUT_STEP)
  }
  return Math.max(0, scale)
}

export function nativeLeviathanPhase(ageTicks: number): 0 | 1 | 2 {
  if (ageTicks <= 40) return 0
  if (ageTicks < NATIVE_LEVIATHAN_ACTIVE_LAST_AGE) return 1
  return 2
}

export function nativeLeviathanActive(ageTicks: number): boolean {
  return ageTicks >= NATIVE_LEVIATHAN_ACTIVE_FIRST_AGE
    && ageTicks <= NATIVE_LEVIATHAN_ACTIVE_LAST_AGE
}

export function nativeLeviathanHeadingVector(headingDegrees: number): Vector2 {
  const radians = headingDegrees * Math.PI / 180
  return {
    x: Math.fround(Math.sin(radians)),
    y: Math.fround(-Math.cos(radians)),
  }
}

export function nativeLeviathanHeadingDegrees(from: Vector2, to: Vector2): number {
  const degrees = Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI
  return degrees < 0 ? degrees + 360 : degrees
}

export function nativeLeviathanDirectionFrame(headingDegrees: number): number {
  const frame = Math.floor((Math.round(headingDegrees) + 12) / 24)
  return frame > 14 ? frame - 15 : frame
}

export function nativeLeviathanAppendageRecord(bank: number, headingDegrees: number): number {
  return 343 + Math.round(bank) * 15 + nativeLeviathanDirectionFrame(headingDegrees)
}

export function nativeLeviathanAppendageLocalRoot(
  baseOffset: Vector2,
  recoil: Vector2,
  spinDegrees: number,
  deployment: number,
): Vector2 {
  const spin = nativeLeviathanHeadingVector(spinDegrees)
  return {
    x: Math.fround(baseOffset.x + recoil.x + 2 * spin.x),
    y: Math.fround(baseOffset.y + recoil.y + 4 * spin.y + 35 + deployment * 100),
  }
}

export function nativeLeviathanAppendagePresentationRoot(
  parentPosition: Vector2,
  parentCompositeScale: number,
  localRoot: Vector2,
): Vector2 {
  return {
    x: Math.fround(parentPosition.x + parentCompositeScale * localRoot.x),
    y: Math.fround(parentPosition.y + parentCompositeScale * localRoot.y),
  }
}

export function nativeLeviathanMuzzlePosition(
  parentPosition: Vector2,
  localRoot: Vector2,
  bank: number,
  headingDegrees: number,
  spriteScale: number,
): Vector2 {
  const frame = nativeLeviathanDirectionFrame(headingDegrees)
  const socket = NATIVE_LEVIATHAN_MUZZLE_SOCKETS[Math.round(bank) * 15 + frame]!
  const wobble = Math.sin(headingDegrees * Math.PI / 180) * 5 * Math.PI / 180
  const cos = Math.cos(wobble)
  const sin = Math.sin(wobble)
  return {
    x: Math.fround(parentPosition.x + localRoot.x + spriteScale * (socket.x * cos - socket.y * sin)),
    y: Math.fround(parentPosition.y + localRoot.y + spriteScale * (socket.x * sin + socket.y * cos)),
  }
}

export function nativeLeviathanInsideTargetLane(
  origin: Vector2,
  headingDegrees: number,
  target: Vector2,
): boolean {
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const distanceSquared = dx * dx + dy * dy
  if (!(distanceSquared < NATIVE_LEVIATHAN_TARGET_RANGE ** 2)) return false
  if (distanceSquared === 0) return true
  const targetHeading = nativeLeviathanHeadingDegrees(origin, target)
  const delta = Math.abs(((targetHeading - headingDegrees + 540) % 360) - 180)
  return delta <= NATIVE_LEVIATHAN_TARGET_HALF_ANGLE_DEGREES
}
