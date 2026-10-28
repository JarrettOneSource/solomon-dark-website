import type {
  BoneyardFence,
  BoneyardGateLeafSnapshot,
  BoneyardPoint,
} from './boneyard.ts'

export interface BoneyardGateLeafState extends BoneyardGateLeafSnapshot {
  damping: number
  length: number
  restAngleDegrees: number
  velocity: BoneyardPoint
}

export interface BoneyardGateRoot {
  hinge: BoneyardPoint
  side: 0 | 1
  tip: BoneyardPoint
}

export const BONEYARD_GATE_HINGE_TRIM = 13.5
export const BONEYARD_GATE_CENTER_GAP = 1
export const BONEYARD_GATE_INITIAL_SWAY = 20
export const BONEYARD_GATE_CONTACT_SPEED = 2
export const BONEYARD_GATE_CONTACT_DAMPING = 0.96
export const BONEYARD_GATE_BOUNDARY_DAMPING = 0.98
export const BONEYARD_GATE_IDLE_DAMPING = 0.999
export const BONEYARD_GATE_BOUNDARY_BOUNCE = -0.5
export const BONEYARD_GATE_MAX_TRAVEL_DEGREES = 60
export const BONEYARD_GATE_STOP_SPEED_SQUARED = 0.001

export function nativeClosedGateRoots(
  points: readonly BoneyardPoint[],
): readonly BoneyardGateRoot[] {
  const start = points[0]
  const end = points[1]
  if (!start || !end) return []
  const dx = end.x - start.x
  const dy = end.y - start.y
  const segmentLength = Math.hypot(dx, dy)
  if (segmentLength <= (BONEYARD_GATE_HINGE_TRIM + BONEYARD_GATE_CENTER_GAP) * 2) {
    return []
  }
  const ux = dx / segmentLength
  const uy = dy / segmentLength
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
  const startHinge = {
    x: start.x + ux * BONEYARD_GATE_HINGE_TRIM,
    y: start.y + uy * BONEYARD_GATE_HINGE_TRIM,
  }
  const endHinge = {
    x: end.x - ux * BONEYARD_GATE_HINGE_TRIM,
    y: end.y - uy * BONEYARD_GATE_HINGE_TRIM,
  }
  return [
    {
      hinge: endHinge,
      side: 0,
      tip: {
        x: midpoint.x + ux * BONEYARD_GATE_CENTER_GAP,
        y: midpoint.y + uy * BONEYARD_GATE_CENTER_GAP,
      },
    },
    {
      hinge: startHinge,
      side: 1,
      tip: {
        x: midpoint.x - ux * BONEYARD_GATE_CENTER_GAP,
        y: midpoint.y - uy * BONEYARD_GATE_CENTER_GAP,
      },
    },
  ]
}

export function createBoneyardGateLeaves(
  fences: readonly BoneyardFence[],
  seed: string,
): readonly BoneyardGateLeafState[] {
  let rngState = seedState(seed)
  const leaves: BoneyardGateLeafState[] = []
  for (const fence of fences) {
    if ((fence.segmentCode ?? fence.style ?? 0) !== 2) continue
    for (const root of nativeClosedGateRoots(fence.points)) {
      const magnitude = nextRandom(rngState)
      const sign = nextRandom(magnitude.state)
      rngState = sign.state
      const yDisplacement = magnitude.value
        * BONEYARD_GATE_INITIAL_SWAY
        * (sign.value < 0.5 ? -1 : 1)
      const length = distance(root.hinge, root.tip)
      const tip = pointAtLength(
        root.hinge,
        { x: root.tip.x, y: root.tip.y + yDisplacement },
        length,
      )
      leaves.push({
        damping: BONEYARD_GATE_IDLE_DAMPING,
        fenceEid: fence.eid,
        hinge: { ...root.hinge },
        id: `${fence.eid}:gate:${root.side}`,
        length,
        restAngleDegrees: angleDegrees(root.hinge, root.tip),
        side: root.side,
        tip,
        velocity: { x: 0, y: 0 },
      })
    }
  }
  return leaves
}

export function applyBoneyardGateContact(
  leaf: BoneyardGateLeafState,
  direction: BoneyardPoint,
): BoneyardGateLeafState {
  const length = Math.hypot(direction.x, direction.y)
  if (length <= 0.000001) return leaf
  return {
    ...leaf,
    damping: BONEYARD_GATE_CONTACT_DAMPING,
    velocity: {
      x: (direction.x / length) * BONEYARD_GATE_CONTACT_SPEED,
      y: (direction.y / length) * BONEYARD_GATE_CONTACT_SPEED,
    },
  }
}

export function stepBoneyardGateLeaf(
  leaf: BoneyardGateLeafState,
): BoneyardGateLeafState {
  const speedSquared = leaf.velocity.x * leaf.velocity.x
    + leaf.velocity.y * leaf.velocity.y
  if (speedSquared <= BONEYARD_GATE_STOP_SPEED_SQUARED) {
    if (
      leaf.velocity.x === 0
      && leaf.velocity.y === 0
      && leaf.damping === BONEYARD_GATE_IDLE_DAMPING
    ) return leaf
    return {
      ...leaf,
      damping: BONEYARD_GATE_IDLE_DAMPING,
      velocity: { x: 0, y: 0 },
    }
  }

  const candidate = pointAtLength(
    leaf.hinge,
    {
      x: leaf.tip.x + leaf.velocity.x,
      y: leaf.tip.y + leaf.velocity.y,
    },
    leaf.length,
  )
  const outsideTravel = Math.abs(signedAngleDelta(
    leaf.restAngleDegrees,
    angleDegrees(leaf.hinge, candidate),
  )) > BONEYARD_GATE_MAX_TRAVEL_DEGREES
  const damping = outsideTravel
    ? BONEYARD_GATE_BOUNDARY_DAMPING
    : leaf.damping
  const velocity = outsideTravel
    ? {
        x: leaf.velocity.x * BONEYARD_GATE_BOUNDARY_BOUNCE,
        y: leaf.velocity.y * BONEYARD_GATE_BOUNDARY_BOUNCE,
      }
    : leaf.velocity
  return {
    ...leaf,
    damping,
    tip: outsideTravel ? leaf.tip : candidate,
    velocity: {
      x: velocity.x * damping,
      y: velocity.y * damping,
    },
  }
}

export function boneyardGateSnapshot(
  leaf: BoneyardGateLeafState,
): BoneyardGateLeafSnapshot {
  return {
    fenceEid: leaf.fenceEid,
    hinge: { ...leaf.hinge },
    id: leaf.id,
    side: leaf.side,
    tip: { ...leaf.tip },
  }
}

function pointAtLength(
  origin: BoneyardPoint,
  target: BoneyardPoint,
  length: number,
): BoneyardPoint {
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const sourceLength = Math.hypot(dx, dy)
  if (sourceLength <= 0.000001) return { x: origin.x + length, y: origin.y }
  return {
    x: origin.x + (dx / sourceLength) * length,
    y: origin.y + (dy / sourceLength) * length,
  }
}

function distance(left: BoneyardPoint, right: BoneyardPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

function angleDegrees(origin: BoneyardPoint, target: BoneyardPoint): number {
  return Math.atan2(target.y - origin.y, target.x - origin.x) * 180 / Math.PI
}

function signedAngleDelta(source: number, target: number): number {
  return ((target - source + 540) % 360) - 180
}

function seedState(seed: string): number {
  let state = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 0x01000193)
  }
  return state >>> 0 || 0x6d2b79f5
}

function nextRandom(state: number): { state: number; value: number } {
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  value >>>= 0
  const nextState = value || 0x6d2b79f5
  return { state: nextState, value: nextState / 0x100000000 }
}
