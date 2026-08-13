import type { PlayerCharacterState } from './core-kernels/player-character.ts'
import type { Vector2 } from './core-kernels/vector.ts'

const STAFF_ORB_OFFSETS: readonly Vector2[] = [
  { x: -32.5, y: -66.5 },
  { x: -21.5, y: -72.5 },
  { x: -9, y: -76.5 },
  { x: 4.5, y: -76.5 },
  { x: 17, y: -74.5 },
  { x: 28.5, y: -69.5 },
  { x: 38.5, y: -61.5 },
  { x: 45.5, y: -52.5 },
  { x: 49.5, y: -41.5 },
  { x: 50.5, y: -30.5 },
  { x: 47.5, y: -19.5 },
  { x: 41.5, y: -9.5 },
  { x: 32.5, y: -1.5 },
  { x: 21.5, y: 4.5 },
  { x: 9, y: 8.5 },
  { x: -4.5, y: 8.5 },
  { x: -17, y: 6.5 },
  { x: -28.5, y: 1.5 },
  { x: -38.5, y: -6.5 },
  { x: -45.5, y: -15.5 },
  { x: -49.5, y: -26.5 },
  { x: -50.5, y: -37.5 },
  { x: -47.5, y: -48.5 },
  { x: -41.5, y: -58.5 },
]

const STAFF_FRONT: readonly boolean[] = [
  false, false, false, false, false, true,
  true, true, true, true, true, true,
  true, true, true, true, true, false,
  false, false, false, false, false, false,
]

export interface PlayerCharacterDrawPlan {
  fixedRobeOffset: Vector2
  frontAttachmentOffset: Vector2
  headOffset: Vector2
  headingSheetOffsetY: number
  moving: boolean
  orbOffset: Vector2
  orbZIndex: number
  robePose: number
  staffFront: boolean
}

export function createPlayerCharacterDrawPlan(
  state: Pick<
    PlayerCharacterState,
    'gaitDegrees' | 'headingIndex' | 'velocity' | 'walkCyclePrimary'
  >,
  scale = 1,
): PlayerCharacterDrawPlan {
  const staffFront = playerCharacterStaffIsFront(state.headingIndex)
  return {
    fixedRobeOffset: playerCharacterFixedRobeOffset(state.gaitDegrees, scale),
    frontAttachmentOffset: playerCharacterFrontAttachmentOffset(
      state.gaitDegrees,
      scale,
    ),
    headOffset: playerCharacterHeadOffset(
      state.headingIndex,
      state.gaitDegrees,
      scale,
    ),
    headingSheetOffsetY: -state.headingIndex * 170,
    moving: Math.hypot(state.velocity.x, state.velocity.y) > 0.01,
    orbOffset: playerCharacterStaffOrbOffset(state.headingIndex),
    orbZIndex: staffFront ? 6 : 2,
    robePose: playerCharacterRobePose(state.walkCyclePrimary),
    staffFront,
  }
}

export function playerCharacterStaffOrbOffset(headingIndex: number): Vector2 {
  return STAFF_ORB_OFFSETS[normalizedIndex(headingIndex, STAFF_ORB_OFFSETS.length)]
}

export function playerCharacterStaffIsFront(headingIndex: number): boolean {
  return STAFF_FRONT[normalizedIndex(headingIndex, STAFF_FRONT.length)]
}

export function playerCharacterRobePose(walkCyclePrimary: number): number {
  return Math.trunc(walkCyclePrimary)
}

export function playerCharacterFixedRobeOffset(
  gaitDegrees: number,
  scale = 1,
): Vector2 {
  const halfGaitRadians = gaitDegrees * 0.5 * Math.PI / 180
  return {
    x: Math.abs(Math.sin(halfGaitRadians)) * scale * scale,
    y: 0,
  }
}

export function playerCharacterFrontAttachmentOffset(
  gaitDegrees: number,
  scale = 1,
): Vector2 {
  return {
    x: playerCharacterFixedRobeOffset(gaitDegrees, scale).x,
    y: scale,
  }
}

export function playerCharacterHeadOffset(
  headingIndex: number,
  gaitDegrees: number,
  scale = 1,
): Vector2 {
  const gaitRadians = gaitDegrees * Math.PI / 180
  const perpendicularRadians = (headingIndex * 15 + 90) * Math.PI / 180
  const lateral = -Math.cos(gaitRadians) * 0.5 * scale
  return {
    x: Math.sin(perpendicularRadians) * lateral,
    y: -Math.cos(perpendicularRadians) * lateral
      - Math.abs(Math.sin(gaitRadians)) * 1.5 * scale,
  }
}

function normalizedIndex(value: number, length: number): number {
  return ((Math.round(value) % length) + length) % length
}
