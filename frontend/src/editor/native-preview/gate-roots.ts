import type { Vec2 } from '../model.ts'

interface BoneyardGateRoot {
  hinge: Vec2
  side: 0 | 1
  tip: Vec2
}

const BONEYARD_GATE_HINGE_TRIM = 13.5
const BONEYARD_GATE_CENTER_GAP = 1

export function nativeClosedGateRoots(
  points: readonly Vec2[],
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

