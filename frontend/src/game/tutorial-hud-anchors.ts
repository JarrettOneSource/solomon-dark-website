import type {
  NativeTutorialInstructionBaselines,
  NativeTutorialStage,
} from './core-kernels/native-tutorial.ts'

export interface TutorialPoint {
  readonly x: number
  readonly y: number
}

export interface TutorialHudAnchor extends TutorialPoint {
  /** Uniform browser HUD transform relative to the native target control. */
  readonly scale: number
}

export interface TutorialRect {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

export interface TutorialViewportSize {
  readonly height: number
  readonly width: number
}

export interface TutorialHudAnchors {
  readonly concentrationA: TutorialHudAnchor | null
  readonly healthMeter: TutorialHudAnchor | null
  readonly healthPotion: TutorialHudAnchor | null
  readonly inventory: TutorialHudAnchor | null
  readonly primarySkill: TutorialHudAnchor | null
  readonly secondarySlot: TutorialHudAnchor | null
  readonly skills: TutorialHudAnchor | null
}

export type TutorialHudAnchorAttribute =
  | 'concentration-a'
  | 'health-meter'
  | 'health-potion'
  | 'inventory'
  | 'primary-skill'
  | 'secondary-slot'
  | 'skills'

export type TutorialPointerAnchor = TutorialHudAnchorAttribute

export interface TutorialPointerPlan {
  readonly anchor: TutorialPointerAnchor
  /** `0x005C9BB0` blink argument; every stock HUD pointer pushes 1. */
  readonly blink: boolean
  readonly scale: number
  readonly target: TutorialHudAnchor
  readonly x: number
  readonly y: number
}

export const TUTORIAL_HUD_ANCHOR_MEMBERS = Object.freeze([
  ['concentrationA', 'concentration-a'],
  ['healthMeter', 'health-meter'],
  ['healthPotion', 'health-potion'],
  ['inventory', 'inventory'],
  ['primarySkill', 'primary-skill'],
  ['secondarySlot', 'secondary-slot'],
  ['skills', 'skills'],
] as const satisfies readonly (readonly [keyof TutorialHudAnchors, TutorialHudAnchorAttribute])[])

const NATIVE_TUTORIAL_HUD_TARGET_HEIGHTS = Object.freeze({
  'concentration-a': 65,
  'health-meter': 20,
  'health-potion': 50,
  inventory: 62,
  'primary-skill': 65,
  'secondary-slot': 53,
  skills: 62,
} satisfies Readonly<Record<TutorialHudAnchorAttribute, number>>)

export function nativeTutorialHudTargetHeight(anchor: TutorialHudAnchorAttribute): number {
  return NATIVE_TUTORIAL_HUD_TARGET_HEIGHTS[anchor]
}

export function nativeTutorialHudAnchorAttributes(
  stage: NativeTutorialStage,
): readonly TutorialHudAnchorAttribute[] {
  switch (stage) {
    case 5: return Object.freeze(['secondary-slot'])
    case 9: return Object.freeze(['inventory'])
    case 12: return Object.freeze(['skills'])
    case 14: return Object.freeze(['primary-skill', 'concentration-a'])
    case 18: return Object.freeze(['health-potion', 'health-meter'])
    default: return Object.freeze([])
  }
}

export function emptyTutorialHudAnchors(): TutorialHudAnchors {
  return Object.freeze({
    concentrationA: null,
    healthMeter: null,
    healthPotion: null,
    inventory: null,
    primarySkill: null,
    secondarySlot: null,
    skills: null,
  })
}

export function tutorialClientRectAnchor(
  overlay: TutorialRect,
  target: TutorialRect,
  logical: TutorialViewportSize,
  nativeTargetHeight: number,
): TutorialHudAnchor | null {
  if (
    !positiveFinite(overlay.width)
    || !positiveFinite(overlay.height)
    || !positiveFinite(target.width)
    || !positiveFinite(target.height)
    || !positiveFinite(logical.width)
    || !positiveFinite(logical.height)
    || !positiveFinite(nativeTargetHeight)
  ) return null
  const logicalTargetHeight = target.height * logical.height / overlay.height
  return Object.freeze({
    scale: logicalTargetHeight / nativeTargetHeight,
    x: (target.left + target.width / 2 - overlay.left) * logical.width / overlay.width,
    y: (target.top + target.height / 2 - overlay.top) * logical.height / overlay.height,
  })
}

/**
 * `Tutorial::Render 0x005D08C0` HUD pointers. Every call site pushes
 * `blink = 1`: stage 5 `0x005D0EFA`, stage 9 `0x005D11F8` (shared by stage 12
 * through the `0x005D188D` push and `jmp 0x005D11E2`), stage 18 `0x005D21BE`
 * and `0x005D2274`.
 */
export function nativeTutorialHudPointerPlans(
  stage: NativeTutorialStage,
  anchors: TutorialHudAnchors,
): readonly TutorialPointerPlan[] {
  switch (stage) {
    case 5:
      return anchors.secondarySlot
        ? Object.freeze([pointer('secondary-slot', anchors.secondarySlot, -70, -50, true)])
        : Object.freeze([])
    case 9:
      return anchors.inventory
        ? Object.freeze([pointer('inventory', anchors.inventory, -40, -40, true)])
        : Object.freeze([])
    case 12:
      return anchors.skills
        ? Object.freeze([pointer('skills', anchors.skills, 40, -40, true)])
        : Object.freeze([])
    case 18: {
      const plans: TutorialPointerPlan[] = []
      if (anchors.healthPotion) {
        plans.push(pointer('health-potion', anchors.healthPotion, -50, -30, true))
      }
      if (anchors.healthMeter) {
        plans.push(pointer('health-meter', anchors.healthMeter, -100, 70, true))
      }
      return Object.freeze(plans)
    }
    default:
      return Object.freeze([])
  }
}

/**
 * Stages 9/12 share target y 855, subheading 760, and heading 730 at native
 * scale 1. Preserve those 95/125 target clearances as the centred control is
 * enlarged by the browser's responsive HUD transform.
 */
export function tutorialHudInstructionBaselines(
  stage: NativeTutorialStage,
  native: NativeTutorialInstructionBaselines | null,
  anchors: TutorialHudAnchors,
): NativeTutorialInstructionBaselines | null {
  if (!native) return null
  const target = stage === 9 ? anchors.inventory : stage === 12 ? anchors.skills : null
  if (!target) return native
  const subheading = target.y - 95 * target.scale
  return Object.freeze({ heading: subheading - 30, subheading })
}

export function tutorialHudAnchorsEqual(
  left: TutorialHudAnchors,
  right: TutorialHudAnchors,
): boolean {
  return TUTORIAL_HUD_ANCHOR_MEMBERS.every(([member]) => (
    pointsEqual(left[member], right[member])
  ))
}

function pointer(
  anchor: TutorialHudAnchorAttribute,
  target: TutorialHudAnchor,
  offsetX: number,
  offsetY: number,
  blink: boolean,
): TutorialPointerPlan {
  return Object.freeze({
    anchor,
    blink,
    scale: target.scale,
    target,
    x: target.x + offsetX * target.scale,
    y: target.y + offsetY * target.scale,
  })
}

function pointsEqual(left: TutorialHudAnchor | null, right: TutorialHudAnchor | null): boolean {
  return left === null || right === null
    ? left === right
    : left.scale === right.scale && left.x === right.x && left.y === right.y
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}
