export const NATIVE_SECONDARY_ABILITY_IDS = Object.freeze([
  11, 12, 15, 21, 23, 27, 30, 35, 41, 45, 46, 48,
  49, 50, 51, 54, 72, 73, 74, 76, 77, 78, 79,
] as const)

export type NativeSecondaryAbilityId = typeof NATIVE_SECONDARY_ABILITY_IDS[number]
