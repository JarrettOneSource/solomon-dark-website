import type { Vec2 } from './model.ts'
import { nativeClosedGateRoots } from '../game/core-kernels/boneyard-gate.ts'
import { createNativeRng, drawNativeFloat } from '../game/core-kernels/native-rng.ts'

export interface NativeTexturedQuad {
  p0: Vec2
  p1: Vec2
  p2: Vec2
  p3: Vec2
}

export interface NativeGateLeaf extends NativeTexturedQuad {
  hinge: Vec2
  tip: Vec2
}

export interface NativeBrokenFenceHalf extends NativeTexturedQuad {
  root: Vec2
  seed: number
  shadowStart: Vec2
  shadowEnd: Vec2
  shadowStep: Vec2
  shadowCount: number
}

export interface NativeGateLeafOverride {
  fenceEid: string
  hinge: Vec2
  side: 0 | 1
  tip: Vec2
}

export interface NativeGateRule {
  end: Vec2
  start: Vec2
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

/** 0x005EC6E0, factory order end half then start half. No shared RNG words. */
export function nativeBrokenFenceHalves(
  points: readonly Vec2[], startPostVariant = 0, endPostVariant = 0,
): readonly NativeBrokenFenceHalf[] {
  if (points.length < 2) return []
  const f = Math.fround
  const start = { x: f(points[0]!.x), y: f(points[0]!.y) }
  const end = { x: f(points[1]!.x), y: f(points[1]!.y) }
  const inward = nativeFenceStoredUnit({ x: f(end.x - start.x), y: f(f(end.y + 5) - f(start.y + 5)) })
  return [false, true].map(isStart => {
    const anchor = isStart ? start : end
    const direction = isStart ? inward : { x: f(-inward.x), y: f(-inward.y) }
    const selector = isStart ? startPostVariant : endPostVariant
    // D3D leaves x87 PC24/nearest (live CW007F): every arithmetic instruction
    // rounds even without a memory store. FISTP int64 then hashes the low word.
    const seedInput = Math.trunc(f(f(f(selector + 1 + anchor.x) + anchor.y) * f(anchor.x * anchor.y))) | 0
    let word = seedInput ^ (seedInput << 21)
    word ^= word >>> 11
    const seed = Math.abs(Math.imul(word ^ (word << 4), 0x0a67cfcf))
    const first = drawNativeFloat(createNativeRng(seed), 20, true)
    const second = drawNativeFloat(first.state, 20, true)
    const third = drawNativeFloat(second.state, 18)
    const tip = {
      x: f(f(anchor.x + f(52 * direction.x)) + f(first.value * direction.y)),
      y: f(f(anchor.y + f(52 * direction.y)) + f(-direction.x * first.value)),
    }
    const [p2, p3] = nativeFenceStoredInset(tip, anchor, 12)
    const height = f(third.value + 32)
    const p0 = {
      x: f(p2.x + f(second.value * direction.x)),
      y: f(f(f(p2.y - height) + f(second.value * direction.y)) - 20),
    }
    const p1 = { x: p3.x, y: f(f(p3.y - 32) - 20) }
    const [shadowStart, shadowEnd] = nativeFenceStoredInset(p2, p3, 6)
    const delta = { x: f(shadowEnd.x - shadowStart.x), y: f(shadowEnd.y - shadowStart.y) }
    const unit = nativeFenceStoredUnit(delta)
    const shadowStep = { x: f(8 * unit.x), y: f(8 * unit.y) }
    const stepLength = nativeFenceStoredLength(shadowStep)
    const shadowCount = stepLength > 0 ? Math.trunc(f(nativeFenceStoredLength(delta) / stepLength)) + 1 : 0
    return { p0, p1, p2, p3, seed, shadowStart, shadowEnd, shadowStep, shadowCount,
      root: shadowEnd.y > shadowStart.y ? shadowEnd : shadowStart }
  })
}

export function nativeFenceStoredLength(v: Vec2): number {
  return Math.fround(Math.sqrt(Math.fround(Math.fround(v.x * v.x) + Math.fround(v.y * v.y))))
}

export function nativeFenceStoredUnit(v: Vec2): Vec2 {
  const length = nativeFenceStoredLength(v)
  const inverse = length > 0 ? Math.fround(1 / length) : 0
  return { x: Math.fround(v.x * inverse), y: Math.fround(v.y * inverse) }
}

export function nativeFenceStoredInset(a: Vec2, b: Vec2, inset: number): readonly [Vec2, Vec2] {
  const f = Math.fround
  const unit = nativeFenceStoredUnit({ x: f(b.x - a.x), y: f(b.y - a.y) })
  const offset = { x: f(inset * unit.x), y: f(inset * unit.y) }
  return [{ x: f(a.x + offset.x), y: f(a.y + offset.y) }, { x: f(b.x - offset.x), y: f(b.y - offset.y) }]
}

/** 0x0041C540 uses 0,1,2 / 2,1,3. A Broken quad is not an affine rectangle. */
export function nativeQuadCanvasTriangles(quad: NativeTexturedQuad, width: number, height: number): readonly {
  points: readonly [Vec2, Vec2, Vec2]
  transform: NativeGateArtCanvasTransform
}[] {
  const { p0, p1, p2, p3 } = quad
  return [
    { points: [p0, p1, p2], transform: {
      a: (p1.x - p0.x) / width, b: (p1.y - p0.y) / width,
      c: (p2.x - p0.x) / height, d: (p2.y - p0.y) / height, e: p0.x, f: p0.y,
    } },
    { points: [p2, p1, p3], transform: {
      a: (p3.x - p2.x) / width, b: (p3.y - p2.y) / width,
      c: (p3.x - p1.x) / height, d: (p3.y - p1.y) / height,
      e: p1.x + p2.x - p3.x, f: p1.y + p2.y - p3.y,
    } },
  ]
}

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

export function nativeGateRules(
  leaf: NativeGateLeaf,
): readonly [NativeGateRule, NativeGateRule] {
  return [
    {
      end: leaf.p3,
      start: { x: leaf.p1.x, y: leaf.p1.y + 32 },
    },
    {
      end: {
        x: (leaf.p2.x + leaf.p3.x) / 2,
        y: (leaf.p2.y + leaf.p3.y) / 2,
      },
      start: {
        x: (leaf.p0.x + leaf.p1.x) / 2,
        y: (leaf.p0.y + leaf.p1.y) / 2,
      },
    },
  ]
}
