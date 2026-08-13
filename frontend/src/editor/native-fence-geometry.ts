import type { Vec2 } from './model.ts'
import { nativeClosedGateRoots } from '../game/core-kernels/boneyard-gate.ts'

export interface NativeGateLeaf {
  hinge: Vec2
  tip: Vec2
  p0: Vec2
  p1: Vec2
  p2: Vec2
  p3: Vec2
}

export interface NativeGateLeafOverride {
  fenceEid: string
  hinge: Vec2
  side: 0 | 1
  tip: Vec2
}

const GATE_ART_LIFT = 87

export function nativeGateLeaves(points: readonly Vec2[]): readonly NativeGateLeaf[] {
  return nativeClosedGateRoots(points).map(({ hinge, tip }) => nativeGateLeaf(hinge, tip))
}

export function nativeGateLeaf(hinge: Vec2, tip: Vec2): NativeGateLeaf {
  return {
    hinge,
    tip,
    p0: { x: hinge.x, y: hinge.y - GATE_ART_LIFT },
    p1: { x: tip.x, y: tip.y - GATE_ART_LIFT },
    p2: { ...hinge },
    p3: { ...tip },
  }
}
