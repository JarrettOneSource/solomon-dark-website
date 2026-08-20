const repeatPose = (selector: number, count: number): number[] => (
  Array.from({ length: count }, () => selector)
)

export type NativeSkeletonHeadFacingOffset = -1 | 0 | 1

export const NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT = 300
export const NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER = 1
export const NATIVE_SKELETON_HEAD_FACING_OFFSETS = Object.freeze([
  -1,
  0,
  1,
] as const satisfies readonly NativeSkeletonHeadFacingOffset[])

export const NATIVE_SKELETON_CLAW_BODY_POSES = Object.freeze({
  armored: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9]),
  unarmored: Object.freeze([4, 5, 6, 7, 8, 9, 10, 11]),
})

export const NATIVE_SKELETON_WEAPON_BODY_POSES = Object.freeze([
  ...repeatPose(1, 8),
  2,
  ...repeatPose(3, 8),
  ...repeatPose(2, 4),
  ...repeatPose(1, 4),
])

export const NATIVE_SKELETON_PIKE_BODY_POSES = Object.freeze([
  1,
  ...repeatPose(2, 11),
  1,
])

export const NATIVE_ARCHER_SHOT_BODY_POSES = Object.freeze([
  3, 4, 5, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 8, 8, 8, 8,
])

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
})

export function nativeSkeletonFamilyBodyPose(
  poses: readonly number[],
  actionProgress: number,
): number {
  if (!Number.isFinite(actionProgress) || actionProgress < 0) {
    throw new RangeError('Skeleton-family action progress must be finite and non-negative')
  }
  return poses[Math.min(Math.floor(actionProgress), poses.length - 1)]!
}

export function nativeSkeletonHeadFacing(
  bodyFacing: number,
  offset: NativeSkeletonHeadFacingOffset,
): number {
  if (!Number.isSafeInteger(bodyFacing) || bodyFacing < 0 || bodyFacing >= 18) {
    throw new RangeError('Skeleton body facing must be an integer in [0,17]')
  }
  if (!NATIVE_SKELETON_HEAD_FACING_OFFSETS.includes(offset)) {
    throw new RangeError('Skeleton head-facing offset must be -1, 0, or 1')
  }
  return (bodyFacing + offset + 18) % 18
}
