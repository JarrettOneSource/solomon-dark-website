import badguys from '../../editor/manifest/badguys.json' with { type: 'json' }

import type { BoneyardPoint } from './boneyard.ts'

export const NATIVE_MAGE_LIGHTNING_BASE_TICKS = 100 * 0.5
export const NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES = 5
export const NATIVE_MAGE_BODY_POSE_COUNT = 5
export const NATIVE_MAGE_FACING_COUNT = 18

const NATIVE_MAGE_BODY_BASE_RECORD = 1729
const NATIVE_MAGE_SOURCE_Y_OFFSET = -5

type NativeMageCastProgram = 'long' | 'short'

export const NATIVE_MAGE_CAST_BODY_POSES = Object.freeze({
  long: Object.freeze([
    ...repeatPose(2, 30),
    3,
    ...repeatPose(4, 13),
    3,
    ...repeatPose(0, 3),
  ]),
  short: Object.freeze([
    ...repeatPose(2, 24),
    3,
    ...repeatPose(4, 13),
    3,
    ...repeatPose(0, 3),
  ]),
} satisfies Readonly<Record<NativeMageCastProgram, readonly number[]>>)

interface NativeMagePoseState {
  readonly actionProgress: number
  readonly castProgram: NativeMageCastProgram
  readonly gaitPose: number
  readonly phase: 'cast' | 'death' | 'range-control'
}

const MAGE_BODY_ATTACHMENTS = Object.freeze(Array.from(
  { length: NATIVE_MAGE_BODY_POSE_COUNT },
  (_, pose) => Object.freeze(Array.from({ length: NATIVE_MAGE_FACING_COUNT }, (_, facing) => {
    const entry = NATIVE_MAGE_BODY_BASE_RECORD + pose * NATIVE_MAGE_FACING_COUNT + facing
    const attachment = badguys.entries[entry]?.extras?.[0]
    if (
      attachment === undefined
      || !Number.isFinite(attachment.x)
      || !Number.isFinite(attachment.y)
    ) {
      throw new Error(`BadGuys:${entry} is missing Mage body attachment slot 0`)
    }
    return Object.freeze({ x: attachment.x, y: attachment.y })
  })),
))

export function nativeMageLightningDurationTicks(attackSpeed: number): number {
  if (!Number.isFinite(attackSpeed) || attackSpeed <= 0) {
    throw new RangeError('Mage lightning attack speed must be finite and positive')
  }
  const ticks = Math.trunc(NATIVE_MAGE_LIGHTNING_BASE_TICKS / attackSpeed)
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError('Mage lightning duration must be a non-negative safe integer')
  }
  return ticks
}

export function nativeMageBodyPose(state: NativeMagePoseState): number {
  if (state.phase !== 'cast') return boundedPose(state.gaitPose)
  if (!Number.isFinite(state.actionProgress) || state.actionProgress < 0) {
    throw new RangeError('Mage action progress must be finite and non-negative')
  }
  const poses = NATIVE_MAGE_CAST_BODY_POSES[state.castProgram]
  return poses[Math.min(Math.floor(state.actionProgress), poses.length - 1)]!
}

export function nativeMageFacingBucket(headingDeg: number): number {
  return nativeEighteenWayFacingBucket(headingDeg)
}

export function nativeEighteenWayFacingBucket(headingDeg: number): number {
  if (!Number.isFinite(headingDeg)) {
    throw new RangeError('Native 18-way heading must be finite')
  }
  return positiveModulo(Math.trunc((headingDeg + 10) / 20), NATIVE_MAGE_FACING_COUNT)
}

export function nativeMageBodyAttachment(
  pose: number,
  headingDeg: number,
): Readonly<BoneyardPoint> {
  const attachment = MAGE_BODY_ATTACHMENTS[boundedPose(pose)]![
    nativeMageFacingBucket(headingDeg)
  ]!
  return { ...attachment }
}

export function nativeMageLightningSource(
  root: Readonly<BoneyardPoint>,
  pose: number,
  headingDeg: number,
): Readonly<BoneyardPoint> {
  const attachment = nativeMageBodyAttachment(pose, headingDeg)
  return {
    x: root.x + attachment.x,
    y: root.y + attachment.y + NATIVE_MAGE_SOURCE_Y_OFFSET,
  }
}

function boundedPose(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(NATIVE_MAGE_BODY_POSE_COUNT - 1, Math.max(0, Math.floor(value)))
}

function repeatPose(pose: number, count: number): number[] {
  return Array.from({ length: count }, () => pose)
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
