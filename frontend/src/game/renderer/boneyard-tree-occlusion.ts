import { NATIVE_TREE_OCCLUSION_BOUNDS, NATIVE_TREE_OCCLUSION_POLYGONS } from '../core-kernels/native-tree-geometry.ts'
export { NATIVE_TREE_OCCLUSION_BOUNDS, NATIVE_TREE_OCCLUSION_POLYGONS } from '../core-kernels/native-tree-geometry.ts'
import type { Vec2 } from '../../editor/model.ts'

const f32 = Math.fround
export const NATIVE_TREE_SCAN_TICKS = 25
export const NATIVE_TREE_ALPHA_STEP = f32(0.015)
export const NATIVE_TREE_FULL_ALPHA = 1
export const NATIVE_TREE_FADED_ALPHA = f32(0.4)

export interface NativeTreeOcclusionBounds {
  h: number
  w: number
  x: number
  y: number
}

export interface NativeTreeOcclusionInput {
  eid: string
  mainVariant: number
  position: Vec2
  secondaryVariant: number
  secondaryVisible: boolean
}

export interface NativeTreeOcclusionState {
  countdown: number
  currentAlpha: number
  targetAlpha: number
}

export interface NativeTreePresentation {
  alpha: number
  eid: string
  position: Vec2
}

export interface NativeTreeOcclusionFrame {
  actorPositions: readonly Readonly<Vec2>[]
  cameraBounds: Readonly<NativeTreeOcclusionBounds>
}

export interface NativeTreeOcclusionHistory {
  /** Earliest tick for which both actor poses and the camera epoch are known. */
  fromTick: number
  sample: (tick: number) => NativeTreeOcclusionFrame | null
}

interface RuntimeTree {
  input: NativeTreeOcclusionInput
  presentation: NativeTreePresentation
  state: NativeTreeOcclusionState
}

export function createNativeTreeOcclusionState(countdown: number): NativeTreeOcclusionState {
  return { countdown, currentAlpha: 1, targetAlpha: 1 }
}

/** null is an unobserved/off-camera scan: native keeps the previous target. */
export function advanceNativeTreeOcclusionTick(
  state: NativeTreeOcclusionState,
  actorInside: boolean | null,
): NativeTreeOcclusionState {
  let currentAlpha = state.currentAlpha
  if (currentAlpha < state.targetAlpha) {
    currentAlpha = Math.min(f32(currentAlpha + NATIVE_TREE_ALPHA_STEP), state.targetAlpha)
  } else if (currentAlpha > state.targetAlpha) {
    currentAlpha = Math.max(f32(currentAlpha - NATIVE_TREE_ALPHA_STEP), state.targetAlpha)
  }
  const countdown = state.countdown - 1
  return {
    countdown: countdown < 1 ? NATIVE_TREE_SCAN_TICKS : countdown,
    currentAlpha,
    targetAlpha: countdown < 1 && actorInside !== null
      ? actorInside ? NATIVE_TREE_FADED_ALPHA : NATIVE_TREE_FULL_ALPHA
      : state.targetAlpha,
  }
}

export function nativeTreeInitialCountdown(eid: string): number {
  // Retail consumes the shared RNG. This retained browser-only stable phase stays
  // within its 0..24 domain; it is not claimed to reproduce the retail RNG stream.
  let hash = 0x811c9dc5
  for (let index = 0; index < eid.length; index += 1) {
    hash ^= eid.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % NATIVE_TREE_SCAN_TICKS
}

function treeEnabled(tree: NativeTreeOcclusionInput): boolean {
  return tree.secondaryVisible && tree.mainVariant <= 5
}

export function nativeTreeContainsLocalPlayer(
  tree: NativeTreeOcclusionInput,
  actorPosition: Readonly<Vec2>,
): boolean {
  if (!treeEnabled(tree)) return false
  const bounds = NATIVE_TREE_OCCLUSION_BOUNDS[tree.secondaryVariant]
  const polygon = NATIVE_TREE_OCCLUSION_POLYGONS[tree.secondaryVariant]
  if (!bounds || !polygon) {
    throw new RangeError(`Unsupported native Tree secondary variant ${tree.secondaryVariant}.`)
  }
  const point = {
    x: f32(f32(actorPosition.x) - f32(tree.position.x)),
    y: f32(f32(actorPosition.y) - f32(tree.position.y)),
  }
  if (point.x < bounds.x || point.x >= f32(bounds.x + bounds.w)
    || point.y < bounds.y || point.y >= f32(bounds.y + bounds.h)) return false
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]!
    const last = polygon[previous]!
    if ((current.y > point.y) !== (last.y > point.y)
      && point.x < f32(current.x + f32(
        f32(f32(point.y - current.y) * f32(last.x - current.x))
          / f32(last.y - current.y),
      ))) inside = !inside
  }
  return inside
}

export function nativeTreeOverlapsCamera(
  tree: NativeTreeOcclusionInput,
  camera: Readonly<NativeTreeOcclusionBounds>,
): boolean {
  const bounds = NATIVE_TREE_OCCLUSION_BOUNDS[tree.secondaryVariant]
  if (!bounds) throw new RangeError(`Unsupported native Tree secondary variant ${tree.secondaryVariant}.`)
  const x = f32(bounds.x + f32(tree.position.x))
  const y = f32(bounds.y + f32(tree.position.y))
  return x < f32(f32(camera.x) + f32(camera.w))
    && f32(x + bounds.w) > f32(camera.x)
    && y < f32(f32(camera.y) + f32(camera.h))
    && f32(y + bounds.h) > f32(camera.y)
}

export function nativeTreeSecondaryPosition(
  root: Readonly<Vec2>,
  camera: Readonly<NativeTreeOcclusionBounds>,
): Vec2 {
  const x = f32(f32(camera.x) + f32(f32(camera.w) * 0.5))
  const y = f32(f32(camera.y) + f32(f32(camera.h) * 0.5))
  const scale = f32(1.025)
  return {
    x: f32(x + f32(f32(f32(root.x) - x) * scale)),
    y: f32(y + f32(f32(f32(root.y) - y) * scale)),
  }
}

function advanceUnobservedTicks(state: NativeTreeOcclusionState, ticks: number): NativeTreeOcclusionState {
  if (ticks <= 0) return state
  // Missing history cannot invent past occupants. Approach the retained target
  // exactly (at most41 steps), and skip unchanged scan targets arithmetically.
  let currentAlpha = state.currentAlpha
  for (let tick = 0; tick < ticks && currentAlpha !== state.targetAlpha; tick += 1) {
    currentAlpha = advanceNativeTreeOcclusionTick({ ...state, currentAlpha }, null).currentAlpha
  }
  const firstScan = Math.max(1, state.countdown)
  return {
    countdown: ticks < firstScan ? state.countdown - ticks
      : NATIVE_TREE_SCAN_TICKS - ((ticks - firstScan) % NATIVE_TREE_SCAN_TICKS),
    currentAlpha,
    targetAlpha: state.targetAlpha,
  }
}

export class BoneyardTreeOcclusionPresentation {
  private lastTick: number
  private readonly presentations: NativeTreePresentation[]
  private readonly trees: RuntimeTree[]
  historyGapTicks = 0

  constructor(trees: readonly NativeTreeOcclusionInput[], startTick: number) {
    this.lastTick = Math.floor(startTick)
    this.trees = trees.map(input => {
      if (treeEnabled(input) && !NATIVE_TREE_OCCLUSION_POLYGONS[input.secondaryVariant]) {
        throw new RangeError(`Unsupported native Tree secondary variant ${input.secondaryVariant}.`)
      }
      return {
        input,
        presentation: { alpha: 1, eid: input.eid, position: { ...input.position } },
        state: createNativeTreeOcclusionState(nativeTreeInitialCountdown(input.eid)),
      }
    })
    this.presentations = this.trees.map(tree => tree.presentation)
  }

  update(
    tick: number,
    currentFrame: NativeTreeOcclusionFrame,
    history?: NativeTreeOcclusionHistory,
  ): readonly NativeTreePresentation[] {
    const targetTick = Math.floor(tick)
    if (!Number.isFinite(targetTick) || targetTick <= this.lastTick) return this.presentations
    const retainedFrom = history && Number.isFinite(history.fromTick)
      ? Math.ceil(history.fromTick) : targetTick
    const fromTick = Math.max(this.lastTick + 1, Math.min(targetTick, retainedFrom))
    const unknownTicks = fromTick - this.lastTick - 1
    this.historyGapTicks += unknownTicks
    const frames = new Map<number, NativeTreeOcclusionFrame | null>()
    for (const tree of this.trees) {
      if (!treeEnabled(tree.input)) continue
      tree.state = advanceUnobservedTicks(tree.state, unknownTicks)
      for (let at = fromTick; at <= targetTick; at += 1) {
        let inside: boolean | null = null
        if (tree.state.countdown <= 1) {
          if (!frames.has(at)) frames.set(at,
            at === targetTick ? currentFrame : history?.sample(at) ?? null)
          const frame = frames.get(at)!
          if (frame && nativeTreeOverlapsCamera(tree.input, frame.cameraBounds)) {
            inside = frame.actorPositions.some(position => nativeTreeContainsLocalPlayer(tree.input, position))
          }
        }
        tree.state = advanceNativeTreeOcclusionTick(tree.state, inside)
      }
      tree.presentation.alpha = tree.state.currentAlpha
    }
    this.lastTick = targetTick
    return this.presentations
  }
}
