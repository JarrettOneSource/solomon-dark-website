export const NATIVE_SECONDARY_ABILITY_IDS = Object.freeze([
  11, 12, 15, 21, 23, 27, 30, 35, 41, 45, 46, 48,
  49, 50, 51, 54, 72, 73, 74, 76, 77, 78, 79,
] as const)

export type NativeSecondaryAbilityId = typeof NATIVE_SECONDARY_ABILITY_IDS[number]

export const NATIVE_SECONDARY_BELT_SLOT_COUNT = 8
export const NATIVE_SECONDARY_RIGHT_MOUSE_SLOT = 0
export const NATIVE_SECONDARY_KEYBOARD_SLOTS = Object.freeze([1, 2, 3, 4, 5, 6, 7] as const)
