import {
  isHubTraversable as isHubCollisionTraversable,
  moveWithHubCollision as moveAgainstHubSegments,
  type HubPoint,
} from './hub-collision.ts'

export type { HubPoint } from './hub-collision.ts'

export const HUB_WORLD_WIDTH = 2000
export const HUB_WORLD_HEIGHT = 1024
export const HUB_CAMERA_SCALE = 1.2
export const HUB_VIEW_WIDTH = 1600 / HUB_CAMERA_SCALE
export const HUB_VIEW_HEIGHT = 900 / HUB_CAMERA_SCALE
export const HUB_PLAYER_RADIUS = 25
export const HUB_SPAWN = { x: 950.64, y: 164.04 }

// A clean steady-state stock trace advances 10 world units per 100 ms.
export const HUB_MAX_SPEED = 100
export const HUB_GAIT_DEGREES_PER_UNIT = 5
export const HUB_WALK_CYCLE_DISTANCE_PER_FRAME = 10
export const HUB_WALK_CYCLE_WRAP = 5
export const HUB_MOVEMENT_TICK_SECONDS = 0.01
export const HUB_INPUT_ACCELERATION = 10
export const HUB_MOVEMENT_LANE_CAP = 118.75
export const HUB_MOVEMENT_RETENTION = 0.9

// Clothes.bundle records 3244..3267, attachment point 1. A live
// Staff_RenderAttachment trace proves its selector is the 24-way heading
// (down=12, right=6), independent of the robe's walking-frame animation.
const HUB_STAFF_ORB_OFFSETS: readonly HubPoint[] = [
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

// Clothes.bundle records 3244..3267, attachment point 0. Wizard_Render uses
// the same > 0.5 comparison to dispatch the whole staff-and-hands item either
// before or after the robe painter.
const HUB_STAFF_FRONT: readonly boolean[] = [
  false, false, false, false, false, true,
  true, true, true, true, true, true,
  true, true, true, true, true, false,
  false, false, false, false, false, false,
]

export interface HubMotion {
  position: HubPoint
  /** Native post-move lane, represented in world units per second. */
  velocity: HubPoint
}

export interface HubMovementTick {
  delta: HubPoint
  requestedVelocity: HubPoint
  retainedVelocity: HubPoint
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function hubHeadingFromVector(x: number, y: number): number {
  const degrees = Math.atan2(x, -y) * 180 / Math.PI
  return (degrees + 360) % 360
}

export function hubHeadingIndex(heading: number): number {
  const normalized = ((heading % 360) + 360) % 360
  return Math.floor((normalized + 7.5) / 15) % 24
}

export function hubStaffOrbOffset(headingIndex: number): HubPoint {
  return HUB_STAFF_ORB_OFFSETS[
    ((Math.round(headingIndex) % HUB_STAFF_ORB_OFFSETS.length)
      + HUB_STAFF_ORB_OFFSETS.length) % HUB_STAFF_ORB_OFFSETS.length
  ]
}

export function hubStaffIsFront(headingIndex: number): boolean {
  return HUB_STAFF_FRONT[
    ((Math.round(headingIndex) % HUB_STAFF_FRONT.length)
      + HUB_STAFF_FRONT.length) % HUB_STAFF_FRONT.length
  ]
}

/** Advance the stock actor +0x220 fixed-robe selector from requested travel. */
export function advanceHubPlayerWalkCycle(
  walkCyclePrimary: number,
  requestedDistance: number,
): number {
  const advanced = Math.fround(
    walkCyclePrimary + requestedDistance / HUB_WALK_CYCLE_DISTANCE_PER_FRAME,
  )
  return advanced > HUB_WALK_CYCLE_WRAP
    ? Math.fround(advanced - HUB_WALK_CYCLE_WRAP)
    : advanced
}

/** Select the fixed robe bank exactly as trunc(actor + 0x220). */
export function hubPlayerFixedRobePose(walkCyclePrimary: number): number {
  return Math.trunc(walkCyclePrimary)
}

/** X shift owned by Robe_RenderAttachment's four fixed-color banks. */
export function hubPlayerFixedRobeOffset(gaitDegrees: number, scale = 1): HubPoint {
  const halfGaitRadians = gaitDegrees * 0.5 * Math.PI / 180
  return {
    x: Math.abs(Math.sin(halfGaitRadians)) * scale * scale,
    y: 0,
  }
}

/** Registration applied to the ordinary front staff-and-hands depth pass. */
export function hubPlayerFrontAttachmentOffset(
  gaitDegrees: number,
  scale = 1,
): HubPoint {
  return {
    x: hubPlayerFixedRobeOffset(gaitDegrees, scale).x,
    y: scale,
  }
}

/**
 * Render-only locomotion offset owned by the final head/hat equipment pass.
 * The robe and staff have separate transforms; collision and shadow stay put.
 */
export function hubPlayerHeadOffset(
  headingIndex: number,
  gaitDegrees: number,
  scale = 1,
): HubPoint {
  const gaitRadians = gaitDegrees * Math.PI / 180
  const perpendicularRadians = (headingIndex * 15 + 90) * Math.PI / 180
  const lateral = -Math.cos(gaitRadians) * 0.5 * scale
  return {
    x: Math.sin(perpendicularRadians) * lateral,
    y: -Math.cos(perpendicularRadians) * lateral
      - Math.abs(Math.sin(gaitRadians)) * 1.5 * scale,
  }
}

export function hubCameraOrigin(position: HubPoint): HubPoint {
  const halfWidth = HUB_VIEW_WIDTH / 2
  const halfHeight = HUB_VIEW_HEIGHT / 2
  return {
    x: clamp(position.x, halfWidth, HUB_WORLD_WIDTH - halfWidth) - halfWidth,
    y: clamp(position.y, halfHeight, HUB_WORLD_HEIGHT - halfHeight) - halfHeight,
  }
}

export function isHubTraversable(
  point: HubPoint,
  radius = HUB_PLAYER_RADIUS,
): boolean {
  return isHubCollisionTraversable(point, radius)
}

export function moveWithHubCollision(
  position: HubPoint,
  delta: HubPoint,
  radius = HUB_PLAYER_RADIUS,
): HubPoint {
  return moveAgainstHubSegments(position, delta, radius)
}

export function hubMovementTick(
  retainedVelocity: HubPoint,
  input: HubPoint,
): HubMovementTick {
  const inputLength = Math.hypot(input.x, input.y)
  const direction = inputLength > 0
    ? { x: input.x / inputLength, y: input.y / inputLength }
    : { x: 0, y: 0 }
  const accumulated = {
    x: Math.fround(retainedVelocity.x + direction.x * HUB_INPUT_ACCELERATION),
    y: Math.fround(retainedVelocity.y + direction.y * HUB_INPUT_ACCELERATION),
  }
  const accumulatedLength = Math.hypot(accumulated.x, accumulated.y)
  const capScale = accumulatedLength > HUB_MOVEMENT_LANE_CAP
    ? HUB_MOVEMENT_LANE_CAP / accumulatedLength
    : 1
  const requestedVelocity = {
    x: Math.fround(accumulated.x * capScale),
    y: Math.fround(accumulated.y * capScale),
  }
  return {
    delta: {
      x: Math.fround(requestedVelocity.x * HUB_MOVEMENT_TICK_SECONDS),
      y: Math.fround(requestedVelocity.y * HUB_MOVEMENT_TICK_SECONDS),
    },
    requestedVelocity,
    retainedVelocity: {
      x: Math.fround(requestedVelocity.x * HUB_MOVEMENT_RETENTION),
      y: Math.fround(requestedVelocity.y * HUB_MOVEMENT_RETENTION),
    },
  }
}

export function stepHubMotionTick(
  motion: HubMotion,
  input: HubPoint,
): HubMotion {
  const movement = hubMovementTick(motion.velocity, input)
  return {
    position: moveWithHubCollision(motion.position, movement.delta),
    velocity: movement.retainedVelocity,
  }
}
