import staffProgramJson from '../assets/game/player-staff-attachment-program.json' with { type: 'json' }

type NativeStaffPoint = readonly [x: number, y: number]

interface NativeStaffAttachmentFrame {
  readonly end: NativeStaffPoint
  readonly front: boolean
  readonly start: NativeStaffPoint
}

interface NativeStaffAttachmentProgram {
  readonly auraRecords: readonly (number | null)[]
  readonly bodyLogicalWidths: readonly number[]
  readonly bodyRecords: readonly number[]
  readonly frames: readonly (readonly NativeStaffAttachmentFrame[])[]
}

const STAFF_PROGRAM = staffProgramJson as unknown as NativeStaffAttachmentProgram

export const NATIVE_ENCHANT_STAFF_BODY_RECORDS = Object.freeze([
  ...STAFF_PROGRAM.bodyRecords,
])
export const NATIVE_ENCHANT_STAFF_AURA_RECORDS = Object.freeze([
  ...STAFF_PROGRAM.auraRecords,
])
export const NATIVE_ENCHANT_STAFF_FAR_ALPHA_FACTOR = 0.35

const NATIVE_ENCHANT_STAFF_SKILL_ID = 65
const NATIVE_ENCHANT_STAFF_AURA_EXTENSION = 5
const NATIVE_ENCHANT_STAFF_WIDTH_BASE = 2
const NATIVE_ENCHANT_STAFF_WIDTH_JITTER_MAXIMUM = 1.5
const NATIVE_ENCHANT_STAFF_ALPHA_BASE = 0.5
const NATIVE_ENCHANT_STAFF_ALPHA_AMPLITUDE = 0.2
const NATIVE_ENCHANT_STAFF_ALPHA_DEGREES_PER_TICK = 5
const NATIVE_COLOR_LUMINANCE_FACTOR = 0.85
const NATIVE_COLOR_CHANNEL_FACTOR = 0.15
const NATIVE_COLOR_LUMINANCE_WEIGHTS = [
  0.30860000848770142,
  0.6093999743461609,
  0.0820000022649765,
] as const

const PURE_PRIMARY_BASE_COLORS: Readonly<Record<number, NativeStaffRgb>> = Object.freeze({
  8: [1, 0.1, 1],
  16: [1, 0.35, 0.1],
  24: [0.1, 1, 1],
  32: [0.1, 0.5, 1],
  40: [0.1, 1, 0.1],
  80: [1, 0.1, 1],
})

const WELD_BASE_COLORS: readonly NativeStaffRgb[] = Object.freeze([
  [1, 0.1, 0.5],
  [1, 0.5, 1],
  [1, 0.75, 1],
  [1, 0.75, 0.5],
  [1, 0.75, 1],
  [0.75, 0.75, 0.75],
  [1, 0.75, 1],
  [1, 0.75, 0.5],
  [0.8, 1, 1],
  [0.9, 1, 1],
  [1, 0.1, 0.5],
  [1, 0.35, 0.1],
  [0.1, 0.5, 1],
  [0.1, 1, 1],
  [0.1, 1, 0.1],
])

type NativeStaffRgb = readonly [red: number, green: number, blue: number]

export interface NativeEnchantStaffDrawPlan {
  readonly auraRecord: number | null
  readonly bodyRecord: number
  readonly end: NativeStaffPoint
  readonly farAlpha: number
  readonly front: boolean
  readonly nearAlpha: number
  readonly start: NativeStaffPoint
  readonly tint: number
  readonly vertices: readonly number[]
  readonly widthFactor: number
}

export interface NativeEnchantStaffDrawInput {
  readonly headingIndex: number
  readonly learnedSkills: readonly (readonly [number, number, number])[]
  readonly living: boolean
  readonly nativeStaff: boolean
  readonly pose: number
  readonly selectedPrimarySkillId: number
  readonly selector: number
  readonly tick: number
  readonly weldBuildId: number | null
  readonly widthSample?: number
}

export function nativeEnchantStaffEffectiveRank(
  learnedSkills: readonly (readonly [number, number, number])[],
): number {
  return learnedSkills.find(([skillId]) => skillId === NATIVE_ENCHANT_STAFF_SKILL_ID)?.[2]
    ?? 0
}

export function nativeEnchantStaffGlowAlpha(tick: number): number {
  if (!Number.isFinite(tick)) throw new RangeError('Enchant Staff tick must be finite')
  return Math.fround(
    Math.sin(tick * NATIVE_ENCHANT_STAFF_ALPHA_DEGREES_PER_TICK * Math.PI / 180)
      * NATIVE_ENCHANT_STAFF_ALPHA_AMPLITUDE
      + NATIVE_ENCHANT_STAFF_ALPHA_BASE,
  )
}

export function nativeEnchantStaffGlowTint(
  selectedPrimarySkillId: number,
  weldBuildId: number | null,
): number | null {
  if (selectedPrimarySkillId < 0) return null
  if (selectedPrimarySkillId === 52) {
    if (weldBuildId === null) throw new RangeError('Enchant Staff Weld color requires a build')
    return nativeEnchantStaffWeldGlowTint(weldBuildId)
  }
  const base = PURE_PRIMARY_BASE_COLORS[selectedPrimarySkillId]
  if (base === undefined) {
    throw new RangeError(`unsupported Enchant Staff selected primary ${selectedPrimarySkillId}`)
  }
  return saturatedTint(base)
}

export function nativeEnchantStaffWeldGlowTint(buildId: number): number {
  const base = WELD_BASE_COLORS[buildId - 1000]
  if (base === undefined) throw new RangeError(`unsupported Enchant Staff Weld build ${buildId}`)
  return saturatedTint(base)
}

export function nativeEnchantStaffDrawPlan(
  input: NativeEnchantStaffDrawInput,
): NativeEnchantStaffDrawPlan | null {
  if (!Number.isInteger(input.selector) || input.selector < 0 || input.selector >= 6) {
    throw new RangeError('Enchant Staff selector must be within [0,5]')
  }
  if (!Number.isInteger(input.pose) || input.pose < 0 || input.pose >= 10) {
    throw new RangeError('Enchant Staff attachment pose must be within [0,9]')
  }
  if (
    !input.living
    || !input.nativeStaff
    || input.selectedPrimarySkillId < 0
    || nativeEnchantStaffEffectiveRank(input.learnedSkills) <= 0
  ) return null

  const headingIndex = normalizedIndex(input.headingIndex, 24)
  const frame = STAFF_PROGRAM.frames[input.pose]?.[headingIndex]
  if (frame === undefined) throw new RangeError('missing extracted Enchant Staff attachment frame')
  const tint = nativeEnchantStaffGlowTint(
    input.selectedPrimarySkillId,
    input.weldBuildId,
  )
  if (tint === null) return null
  const widthSample = input.widthSample ?? visualWidthSample(
    input.tick,
    headingIndex,
    input.pose,
    input.selector,
  )
  if (!Number.isFinite(widthSample) || widthSample < 0 || widthSample > 1.5) {
    throw new RangeError('Enchant Staff width sample must be within [0,1.5]')
  }

  const start: NativeStaffPoint = [frame.start[0], frame.start[1]]
  const end: NativeStaffPoint = [frame.end[0], frame.end[1]]
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  const length = Math.hypot(deltaX, deltaY)
  if (length <= 0) throw new RangeError('Enchant Staff attachment endpoints must be distinct')
  const alongX = deltaX / length
  const alongY = deltaY / length
  const perpendicularX = -alongY
  const perpendicularY = alongX
  const widthFactor = Math.fround(NATIVE_ENCHANT_STAFF_WIDTH_BASE + widthSample)
  const logicalWidth = STAFF_PROGRAM.bodyLogicalWidths[input.selector]
  if (logicalWidth === undefined) throw new RangeError('missing Enchant Staff body width')
  const halfWidth = logicalWidth * 0.5 * widthFactor
  const extendedEndX = end[0] + alongX * NATIVE_ENCHANT_STAFF_AURA_EXTENSION
  const extendedEndY = end[1] + alongY * NATIVE_ENCHANT_STAFF_AURA_EXTENSION
  const nearAlpha = nativeEnchantStaffGlowAlpha(input.tick)

  return Object.freeze({
    auraRecord: NATIVE_ENCHANT_STAFF_AURA_RECORDS[input.selector] ?? null,
    bodyRecord: NATIVE_ENCHANT_STAFF_BODY_RECORDS[input.selector]!,
    end,
    farAlpha: Math.fround(nearAlpha * NATIVE_ENCHANT_STAFF_FAR_ALPHA_FACTOR),
    front: frame.front,
    nearAlpha,
    start,
    tint,
    vertices: Object.freeze([
      start[0] - perpendicularX * halfWidth,
      start[1] - perpendicularY * halfWidth,
      start[0] + perpendicularX * halfWidth,
      start[1] + perpendicularY * halfWidth,
      extendedEndX - perpendicularX * halfWidth,
      extendedEndY - perpendicularY * halfWidth,
      extendedEndX + perpendicularX * halfWidth,
      extendedEndY + perpendicularY * halfWidth,
    ]),
    widthFactor,
  })
}

function saturatedTint(base: NativeStaffRgb): number {
  const luminance = base[0] * NATIVE_COLOR_LUMINANCE_WEIGHTS[0]
    + base[1] * NATIVE_COLOR_LUMINANCE_WEIGHTS[1]
    + base[2] * NATIVE_COLOR_LUMINANCE_WEIGHTS[2]
  const channel = (value: number): number => Math.round(
    (luminance * NATIVE_COLOR_LUMINANCE_FACTOR + value * NATIVE_COLOR_CHANNEL_FACTOR) * 255,
  )
  return channel(base[0]) << 16 | channel(base[1]) << 8 | channel(base[2])
}

function visualWidthSample(
  tick: number,
  headingIndex: number,
  pose: number,
  selector: number,
): number {
  let mixed = Math.trunc(tick) | 0
  mixed ^= Math.imul(headingIndex + 1, 0x45d9f3b)
  mixed ^= Math.imul(pose + 1, 0x119de1f3)
  mixed ^= Math.imul(selector + 1, 0x3449f)
  mixed = (mixed << 21) ^ mixed
  mixed ^= mixed >>> 11
  mixed = Math.imul((mixed << 4) ^ mixed, 0x0a67cfcf)
  const nativeWord = Math.abs(mixed | 0) % 100_001
  return Math.fround(nativeWord / 100_000 * NATIVE_ENCHANT_STAFF_WIDTH_JITTER_MAXIMUM)
}

function normalizedIndex(value: number, length: number): number {
  return ((Math.round(value) % length) + length) % length
}
