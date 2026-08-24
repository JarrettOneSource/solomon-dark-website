import type { NativeTutorialStage } from './core-kernels/native-tutorial.ts'

export interface TutorialPoint {
  readonly x: number
  readonly y: number
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
  readonly healthMeter: TutorialPoint | null
  readonly healthPotion: TutorialPoint | null
  readonly inventory: TutorialPoint | null
  readonly secondarySlot: TutorialPoint | null
  readonly skills: TutorialPoint | null
}

export type TutorialHudAnchorAttribute =
  | 'health-meter'
  | 'health-potion'
  | 'inventory'
  | 'secondary-slot'
  | 'skills'

export type TutorialPointerAnchor = TutorialHudAnchorAttribute

export interface TutorialPointerPlan {
  readonly anchor: TutorialPointerAnchor
  readonly target: TutorialPoint
  readonly x: number
  readonly y: number
}

export const TUTORIAL_HUD_ANCHOR_MEMBERS = Object.freeze([
  ['healthMeter', 'health-meter'],
  ['healthPotion', 'health-potion'],
  ['inventory', 'inventory'],
  ['secondarySlot', 'secondary-slot'],
  ['skills', 'skills'],
] as const satisfies readonly (readonly [keyof TutorialHudAnchors, TutorialHudAnchorAttribute])[])

export function nativeTutorialHudAnchorAttributes(
  stage: NativeTutorialStage,
): readonly TutorialHudAnchorAttribute[] {
  switch (stage) {
    case 5: return Object.freeze(['secondary-slot'])
    case 9: return Object.freeze(['inventory'])
    case 12: return Object.freeze(['skills'])
    case 18: return Object.freeze(['health-potion', 'health-meter'])
    default: return Object.freeze([])
  }
}

export function emptyTutorialHudAnchors(): TutorialHudAnchors {
  return Object.freeze({
    healthMeter: null,
    healthPotion: null,
    inventory: null,
    secondarySlot: null,
    skills: null,
  })
}

export function tutorialClientRectAnchor(
  overlay: TutorialRect,
  target: TutorialRect,
  logical: TutorialViewportSize,
): TutorialPoint | null {
  if (
    !positiveFinite(overlay.width)
    || !positiveFinite(overlay.height)
    || !positiveFinite(target.width)
    || !positiveFinite(target.height)
    || !positiveFinite(logical.width)
    || !positiveFinite(logical.height)
  ) return null
  return Object.freeze({
    x: (target.left + target.width / 2 - overlay.left) * logical.width / overlay.width,
    y: (target.top + target.height / 2 - overlay.top) * logical.height / overlay.height,
  })
}

export function nativeTutorialHudPointerPlans(
  stage: NativeTutorialStage,
  anchors: TutorialHudAnchors,
): readonly TutorialPointerPlan[] {
  switch (stage) {
    case 5:
      return anchors.secondarySlot
        ? Object.freeze([pointer('secondary-slot', anchors.secondarySlot, -70, -50)])
        : Object.freeze([])
    case 9:
      return anchors.inventory
        ? Object.freeze([pointer('inventory', anchors.inventory, -40, -40)])
        : Object.freeze([])
    case 12:
      return anchors.skills
        ? Object.freeze([pointer('skills', anchors.skills, 40, -40)])
        : Object.freeze([])
    case 18: {
      const plans: TutorialPointerPlan[] = []
      if (anchors.healthPotion) {
        plans.push(pointer('health-potion', anchors.healthPotion, -50, -30))
      }
      if (anchors.healthMeter) {
        plans.push(pointer('health-meter', anchors.healthMeter, -100, 70))
      }
      return Object.freeze(plans)
    }
    default:
      return Object.freeze([])
  }
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
  target: TutorialPoint,
  offsetX: number,
  offsetY: number,
): TutorialPointerPlan {
  return Object.freeze({
    anchor,
    target,
    x: target.x + offsetX,
    y: target.y + offsetY,
  })
}

function pointsEqual(left: TutorialPoint | null, right: TutorialPoint | null): boolean {
  return left === null || right === null
    ? left === right
    : left.x === right.x && left.y === right.y
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}
