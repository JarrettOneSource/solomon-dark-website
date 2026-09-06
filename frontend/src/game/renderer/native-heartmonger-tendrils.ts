import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import { drawNativeFloat, type NativeRngState } from '../core-kernels/native-rng.ts'
import { layer } from './native-enemy-layers.ts'
import type { NativeEnemySpriteLayer } from './native-enemy-presentation-model.ts'

interface Tendril {
  readonly lengths: readonly number[]
  readonly points: readonly Readonly<BoneyardPoint>[]
}

export interface HeartmongerTendrils {
  readonly chains: readonly Tendril[]
  readonly legPose: number
}

/** Heartmonger +0x28 renderer; the second chain continues the first construction walk. */
export function createHeartmongerTendrils(
  position: Readonly<BoneyardPoint>,
  headingDeg: number,
  rng: NativeRngState,
): { rng: NativeRngState; state: HeartmongerTendrils } {
  const radians = Math.fround(Math.fround(Math.PI) * Math.fround(headingDeg + 180) / 180)
  const direction = { x: Math.fround(Math.sin(radians)), y: Math.fround(-Math.cos(radians)) }
  const chains: Tendril[] = []
  let current = position
  for (const count of [7, 4]) {
    const points: BoneyardPoint[] = []
    for (let index = 0; index < count; index += 1) {
      points.push({ ...current })
      const draw = drawNativeFloat(rng, 4, true)
      rng = draw.state
      const distance = Math.fround(25 + draw.value)
      current = { x: Math.fround(current.x + direction.x * distance),
        y: Math.fround(current.y + direction.y * distance) }
    }
    chains.push({ points, lengths: points.slice(1).map((point, index) => Math.fround(
      Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y),
    )) })
  }
  return { rng, state: { chains, legPose: -1 } }
}

/** Fixed segment lengths, no frame-time spring integration (0x004F4F40, flags 3). */
export function moveHeartmongerTendrils(
  source: HeartmongerTendrils,
  legPhase: number,
  position: Readonly<BoneyardPoint>,
  anchors: readonly Readonly<BoneyardPoint>[],
): HeartmongerTendrils {
  const legPose = Math.trunc(legPhase)
  if (legPose === source.legPose) return source
  const chains = source.chains.map((chain, index) => {
    const anchor = anchors[index]
    if (!anchor) throw new Error(`Heartmonger legs lack tendril anchor ${index}`)
    const points: BoneyardPoint[] = [{ x: Math.fround(position.x + anchor.x),
      y: Math.fround(position.y + anchor.y) }]
    for (let point = 1; point < chain.points.length; point += 1) {
      const previous = points[point - 1]!
      const original = chain.points[point]!
      const dx = Math.fround(original.x - previous.x)
      const dy = Math.fround(original.y - previous.y)
      const distance = Math.fround(Math.sqrt(Math.fround(dx * dx + dy * dy)))
      const scale = distance > 0 ? Math.fround(chain.lengths[point - 1]! / distance) : 0
      points.push({ x: Math.fround(previous.x + Math.fround(dx * scale)),
        y: Math.fround(previous.y + Math.fround(dy * scale)) })
    }
    return { lengths: chain.lengths, points }
  })
  return { chains, legPose }
}

export function heartmongerTendrilLayers(
  state: HeartmongerTendrils,
  root: Readonly<BoneyardPoint>,
  shadowDirection: Readonly<BoneyardPoint>,
): NativeEnemySpriteLayer[] {
  const layers: NativeEnemySpriteLayer[] = []
  for (const shadow of [true, false]) {
    for (const chain of state.chains) {
      for (let index = 0; index < chain.points.length - 1; index += 1) {
        const start = chain.points[index]!
        const end = chain.points[index + 1]!
        layers.push(layer('BadGuys', 19, shadow ? 'heartmonger-tendril-shadow' : 'heartmonger-tendril', {
          offset: { x: start.x - root.x + (shadow ? 3 * shadowDirection.x : 0),
            y: start.y - root.y + (shadow ? 3 * shadowDirection.y : 0) },
          rotationRadians: Math.atan2(end.x - start.x, start.y - end.y),
          tint: shadow ? 0 : 0xffffff,
        }))
      }
    }
  }
  return layers
}
