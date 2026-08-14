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

export interface NativeGateArtCanvasTransform {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export interface NativeFenceGrate {
  bottomEnd: Vec2
  bottomStart: Vec2
  length: number
  topEnd: Vec2
  topStart: Vec2
  uSpan: number
}

const GATE_ART_LIFT = 87
export const NATIVE_GATE_ART_UVS = [0, 0, 1, 0, 0, 1, 1, 1] as const
export const NATIVE_GATE_ART_INDICES = [0, 1, 2, 2, 1, 3] as const
export const NATIVE_FENCE_END_INSET = 12
export const NATIVE_FENCE_GRATE_HEIGHT = 52
export const NATIVE_FENCE_TEXTURE_REPEAT = 53.33333121405716

export function nativeFenceGrate(points: readonly Vec2[]): NativeFenceGrate | null {
  const start = points[0]
  const end = points[1]
  if (!start || !end) return null
  const dx = end.x - start.x
  const dy = end.y - start.y
  const authoredLength = Math.hypot(dx, dy)
  if (authoredLength === 0) return null
  const unitX = dx / authoredLength
  const unitY = dy / authoredLength
  const bottomStart = {
    x: start.x + unitX * NATIVE_FENCE_END_INSET,
    y: start.y + unitY * NATIVE_FENCE_END_INSET,
  }
  const bottomEnd = {
    x: end.x - unitX * NATIVE_FENCE_END_INSET,
    y: end.y - unitY * NATIVE_FENCE_END_INSET,
  }
  const length = Math.hypot(
    bottomEnd.x - bottomStart.x,
    bottomEnd.y - bottomStart.y,
  )
  return {
    bottomEnd,
    bottomStart,
    length,
    topEnd: { x: bottomEnd.x, y: bottomEnd.y - NATIVE_FENCE_GRATE_HEIGHT },
    topStart: { x: bottomStart.x, y: bottomStart.y - NATIVE_FENCE_GRATE_HEIGHT },
    uSpan: length / NATIVE_FENCE_TEXTURE_REPEAT,
  }
}

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

export function nativeGateArtVertices(
  leaf: NativeGateLeaf,
  vertices = new Float32Array(8),
): Float32Array {
  vertices[0] = leaf.p0.x
  vertices[1] = leaf.p0.y
  vertices[2] = leaf.p1.x
  vertices[3] = leaf.p1.y
  vertices[4] = leaf.p2.x
  vertices[5] = leaf.p2.y
  vertices[6] = leaf.p3.x
  vertices[7] = leaf.p3.y
  return vertices
}

export function nativeGateArtCanvasTransform(
  leaf: NativeGateLeaf,
  sourceWidth: number,
  sourceHeight: number,
): NativeGateArtCanvasTransform {
  return {
    a: ((leaf.p1.x - leaf.p0.x) + (leaf.p3.x - leaf.p2.x)) / (2 * sourceWidth),
    b: ((leaf.p1.y - leaf.p0.y) + (leaf.p3.y - leaf.p2.y)) / (2 * sourceWidth),
    c: ((leaf.p2.x - leaf.p0.x) + (leaf.p3.x - leaf.p1.x)) / (2 * sourceHeight),
    d: ((leaf.p2.y - leaf.p0.y) + (leaf.p3.y - leaf.p1.y)) / (2 * sourceHeight),
    e: leaf.p0.x,
    f: leaf.p0.y,
  }
}

export function nativeGatePainterRoot(hinge: Vec2, tip: Vec2): Vec2 {
  const midpoint = {
    x: (hinge.x + tip.x) / 2,
    y: (hinge.y + tip.y) / 2,
  }
  return tip.y < midpoint.y ? midpoint : { ...tip }
}

export function nativeGateHingeArtPosition(leaf: NativeGateLeaf): Vec2 {
  return {
    x: (leaf.p0.x + leaf.p1.x) / 2,
    y: (leaf.p0.y + leaf.p1.y) / 2 + 7,
  }
}
