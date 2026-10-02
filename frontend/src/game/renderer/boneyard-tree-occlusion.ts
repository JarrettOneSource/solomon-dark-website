import { NATIVE_TREE_OCCLUSION_BOUNDS, NATIVE_TREE_OCCLUSION_POLYGONS } from '../core-kernels/native-tree-geometry.ts'
export { NATIVE_TREE_OCCLUSION_BOUNDS, NATIVE_TREE_OCCLUSION_POLYGONS } from '../core-kernels/native-tree-geometry.ts'
import type { Vec2 } from '../../editor/model.ts'

export const NATIVE_TREE_SCAN_TICKS = 25
export const NATIVE_TREE_ALPHA_STEP = 0.015
export const NATIVE_TREE_FULL_ALPHA = 1
export const NATIVE_TREE_FADED_ALPHA = 0.4

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


interface MutableTreePresentation extends NativeTreePresentation {
  alpha: number
}

interface RuntimeTree {
  input: NativeTreeOcclusionInput
  presentation: MutableTreePresentation
  state: NativeTreeOcclusionState
}

export function createNativeTreeOcclusionState(
  countdown: number,
): NativeTreeOcclusionState {
  return {
    countdown,
    currentAlpha: NATIVE_TREE_FULL_ALPHA,
    targetAlpha: NATIVE_TREE_FULL_ALPHA,
  }
}

export function advanceNativeTreeOcclusionTick(
  state: NativeTreeOcclusionState,
  localPlayerInside: boolean,
): NativeTreeOcclusionState {
  let currentAlpha = state.currentAlpha
  if (currentAlpha < state.targetAlpha) {
    currentAlpha = Math.min(currentAlpha + NATIVE_TREE_ALPHA_STEP, state.targetAlpha)
  } else if (currentAlpha > state.targetAlpha) {
    currentAlpha = Math.max(currentAlpha - NATIVE_TREE_ALPHA_STEP, state.targetAlpha)
  }

  const decremented = state.countdown - 1
  if (decremented < 1) {
    return {
      countdown: NATIVE_TREE_SCAN_TICKS,
      currentAlpha,
      targetAlpha: localPlayerInside
        ? NATIVE_TREE_FADED_ALPHA
        : NATIVE_TREE_FULL_ALPHA,
    }
  }
  return {
    countdown: decremented,
    currentAlpha,
    targetAlpha: state.targetAlpha,
  }
}

export function nativeTreeInitialCountdown(eid: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < eid.length; index += 1) {
    hash ^= eid.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % NATIVE_TREE_SCAN_TICKS
}

export function nativeTreeContainsLocalPlayer(
  tree: NativeTreeOcclusionInput,
  localPlayerPosition: Vec2,
): boolean {
  if (!tree.secondaryVisible || tree.mainVariant > 5) return false
  const bounds = NATIVE_TREE_OCCLUSION_BOUNDS[tree.secondaryVariant]
  const polygon = NATIVE_TREE_OCCLUSION_POLYGONS[tree.secondaryVariant]
  if (!bounds || !polygon) {
    throw new RangeError(`Unsupported native Tree secondary variant ${tree.secondaryVariant}.`)
  }
  const point = {
    x: localPlayerPosition.x - tree.position.x,
    y: localPlayerPosition.y - tree.position.y,
  }
  if (
    point.x <= bounds.x
    || point.x >= bounds.x + bounds.w
    || point.y <= bounds.y
    || point.y >= bounds.y + bounds.h
  ) return false
  return strictPointInPolygon(point, polygon)
}

export class BoneyardTreeOcclusionPresentation {
  private lastTick: number
  private readonly presentations: MutableTreePresentation[]
  private readonly trees: RuntimeTree[]

  constructor(
    trees: readonly NativeTreeOcclusionInput[],
    startTick: number,
  ) {
    this.lastTick = Math.floor(startTick)
    this.trees = trees
      .filter((tree) => tree.secondaryVisible && tree.mainVariant <= 5)
      .map((input) => {
        if (!NATIVE_TREE_OCCLUSION_POLYGONS[input.secondaryVariant]) {
          throw new RangeError(
            `Unsupported native Tree secondary variant ${input.secondaryVariant}.`,
          )
        }
        return {
          input,
          presentation: {
            alpha: NATIVE_TREE_FULL_ALPHA,
            eid: input.eid,
            position: { ...input.position },
          },
          state: createNativeTreeOcclusionState(nativeTreeInitialCountdown(input.eid)),
        }
      })
    this.presentations = this.trees.map((tree) => tree.presentation)
  }

  update(
    tick: number,
    localPlayerPosition: Vec2,
  ): readonly NativeTreePresentation[] {
    const targetTick = Math.floor(tick)
    while (this.lastTick < targetTick) {
      this.lastTick += 1
      for (const tree of this.trees) {
        const scansThisTick = tree.state.countdown - 1 < 1
        tree.state = advanceNativeTreeOcclusionTick(
          tree.state,
          scansThisTick
            && nativeTreeContainsLocalPlayer(tree.input, localPlayerPosition),
        )
        tree.presentation.alpha = tree.state.currentAlpha
      }
    }
    return this.presentations
  }
}

function strictPointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const first = polygon[previous]
    const second = polygon[index]
    if (pointOnSegment(point, first, second)) return false
    if (
      (first.y > point.y) !== (second.y > point.y)
      && point.x < (second.x - first.x) * (point.y - first.y)
        / (second.y - first.y) + first.x
    ) inside = !inside
  }
  return inside
}

function pointOnSegment(point: Vec2, first: Vec2, second: Vec2): boolean {
  const cross = (point.y - first.y) * (second.x - first.x)
    - (point.x - first.x) * (second.y - first.y)
  return cross === 0
    && point.x >= Math.min(first.x, second.x)
    && point.x <= Math.max(first.x, second.x)
    && point.y >= Math.min(first.y, second.y)
    && point.y <= Math.max(first.y, second.y)
}
