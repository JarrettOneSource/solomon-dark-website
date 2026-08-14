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

const f32 = Math.fround

export const NATIVE_TREE_OCCLUSION_POLYGONS: readonly (readonly Vec2[])[] = [
  [
    { x: -144.99169921875, y: -29.943328857421875 },
    { x: -0.612213134765625, y: 27.99749755859375 },
    { x: 56.565765380859375, y: 24.125244140625 },
    { x: 168.14276123046875, y: -46.191009521484375 },
    { x: 206.2191162109375, y: -216.246826171875 },
    { x: 69.4283447265625, y: -360.5577697753906 },
    { x: -100.83868408203125, y: -351.3292541503906 },
    { x: -206.94308471679688, y: -220.44439697265625 },
  ],
  [
    { x: 34.5390625, y: 24.94439697265625 },
    { x: 170.04339599609375, y: -84.96868896484375 },
    { x: 193.65924072265625, y: -250.1349639892578 },
    { x: f32(69.60733), y: -386.4930114746094 },
    { x: -154.26708984375, y: -340.7978820800781 },
    { x: f32(-199.1636), y: -106.99313354492188 },
  ],
  [
    { x: 16.047149658203125, y: 19.9720458984375 },
    { x: 179.94097900390625, y: -53.37811279296875 },
    { x: f32(215.76721), y: f32(-244.1641) },
    { x: 105.19406127929688, y: -385.25439453125 },
    { x: f32(-90.86746), y: -385.4022521972656 },
    { x: -201.05145263671875, y: -241.98484802246094 },
    { x: -141.13465881347656, y: -42.06884765625 },
  ],
  [
    { x: -201.69390869140625, y: 14.09991455078125 },
    { x: -218.04148864746094, y: -236.62200927734375 },
    { x: -170.2315673828125, y: -346.2864990234375 },
    { x: -55.71734619140625, y: -407.4916687011719 },
    { x: f32(64.987335), y: -381.35382080078125 },
    { x: 80.0916748046875, y: -329.744873046875 },
    { x: 168.09814453125, y: -276.497314453125 },
    { x: 137.14453125, y: 60.330047607421875 },
    { x: 12.385467529296875, y: 123.2774658203125 },
    { x: f32(-77.64615), y: 110.34982299804688 },
  ],
  [
    { x: -40.584381103515625, y: 81.09994506835938 },
    { x: 196.1593017578125, y: -17.644989013671875 },
    { x: 210.24615478515625, y: -236.1368408203125 },
    { x: f32(126.72989), y: -403.3904724121094 },
    { x: -50.68603515625, y: -449.74072265625 },
    { x: -199.76913452148438, y: -272.130126953125 },
    { x: -191.6749725341797, y: 2.33856201171875 },
  ],
  [
    { x: f32(83.820404), y: f32(77.241486) },
    { x: 174.1181640625, y: 27.862396240234375 },
    { x: 189.88946533203125, y: -185.66705322265625 },
    { x: 125.4027099609375, y: -358.42230224609375 },
    { x: -55.57757568359375, y: -372.36444091796875 },
    { x: -219.3686981201172, y: -216.94699096679688 },
    { x: f32(-150.752), y: f32(70.62198) },
  ],
  [
    { x: 59.9710693359375, y: 43.70965576171875 },
    { x: 145.29193115234375, y: -38.3265380859375 },
    { x: 17.297210693359375, y: -482.73516845703125 },
    { x: -21.1787109375, y: -482.9326171875 },
    { x: -166.0126953125, y: -44.270599365234375 },
    { x: f32(-92.60953), y: 43.120849609375 },
  ],
  [
    { x: -143.9478759765625, y: 6.6715087890625 },
    { x: 106.4464111328125, y: 19.662567138671875 },
    { x: 195.913330078125, y: -154.60531616210938 },
    { x: 123.69085693359375, y: -299.2760314941406 },
    { x: -151.91461181640625, y: -293.9779357910156 },
    { x: -243.75140380859375, y: -125.89852905273438 },
  ],
]

export const NATIVE_TREE_OCCLUSION_BOUNDS: readonly NativeTreeOcclusionBounds[] = [
  { x: -206.94308471679688, y: -360.5577697753906, w: 413.1622009277344, h: 388.5552673339844 },
  { x: f32(-199.1636), y: -386.4930114746094, w: 392.8228454589844, h: 411.4374084472656 },
  { x: -201.05145263671875, y: -385.4022521972656, w: 416.81866455078125, h: 405.3742980957031 },
  { x: -218.04148864746094, y: -407.4916687011719, w: 386.1396484375, h: 530.7691650390625 },
  { x: -199.76913452148438, y: -449.74072265625, w: 410.0152893066406, h: 530.8406982421875 },
  { x: -219.3686981201172, y: -372.36444091796875, w: 409.2581787109375, h: 449.6059265136719 },
  { x: -166.0126953125, y: -482.9326171875, w: 311.30462646484375, h: 526.6422729492188 },
  { x: -243.75140380859375, y: -299.2760314941406, w: 439.66473388671875, h: 318.9385986328125 },
]

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
