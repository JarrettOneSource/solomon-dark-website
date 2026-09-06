import type { BoneyardPoint } from './boneyard.ts'
import { directionFromHeading } from './primary-spell-targeting.ts'
import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'

export interface NativeSpiderDecal {
  readonly entry: 140 | 141 | 142
  readonly position: Readonly<BoneyardPoint>
  readonly rotationDeg: number
  readonly scale: number
  readonly alpha: number
}

export interface NativeDeadSpiderState {
  readonly position: Readonly<BoneyardPoint>
  readonly headingDeg: number
  readonly slideSpeed: Readonly<BoneyardPoint>
  readonly frame: number
  readonly life: number
  readonly decalGrowth: number
  readonly decal: NativeSpiderDecal | null
}

export function createNativeDeadSpider(position: Readonly<BoneyardPoint>, headingDeg: number): NativeDeadSpiderState {
  return {
    position: { ...position }, headingDeg,
    slideSpeed: { x: 2, y: 2 },
    frame: 0, life: 20, decalGrowth: 0, decal: null,
  }
}

/** Anim_DeadSpider::Tick 0x00461740; the compact and mask grids share this decal lifetime. */
export function stepNativeDeadSpider(
  source: NativeDeadSpiderState,
  rngState: NativeRngState,
): Readonly<{ state: NativeDeadSpiderState | null; rngState: NativeRngState }> {
  const direction = directionFromHeading(source.headingDeg)
  const position = {
    x: Math.fround(source.position.x - direction.x * source.slideSpeed.x),
    y: Math.fround(source.position.y - direction.y * source.slideSpeed.y),
  }
  let frame = source.frame
  let decal = source.decal
  let decalGrowth = source.decalGrowth
  if (source.life <= Math.fround(19.2)) {
    if (decal === null) {
      const entry = drawNativeInteger(rngState, 3)
      const rotation = drawNativeFloat(entry.state, 360)
      const radius = drawNativeFloat(rotation.state, 15)
      const angle = drawNativeFloat(radius.state, 360)
      rngState = angle.state
      const direction = directionFromHeading(angle.value)
      decal = {
        entry: ([140, 141, 142] as const)[entry.value], rotationDeg: rotation.value,
        position: {
          x: Math.fround(position.x + direction.x * radius.value),
          y: Math.fround(position.y + direction.y * radius.value),
        },
        scale: 0, alpha: 1,
      }
      decalGrowth = Math.fround(0.35)
    }
    decalGrowth = Math.min(1, Math.fround(decalGrowth + Math.fround(0.01)))
    decal = { ...decal, scale: Math.fround(decalGrowth * Math.fround(0.9)), alpha: Math.min(source.life, 1) }
    frame = 1
  } else {
    frame = Math.fround(frame + Math.fround(0.2))
    if (frame > 2) frame = Math.fround(frame - 2)
  }
  const life = Math.fround(source.life - Math.fround(0.01))
  return {
    state: life <= 0 ? null : {
      position, headingDeg: source.headingDeg,
      slideSpeed: {
        x: Math.fround(source.slideSpeed.x * Math.fround(0.95)),
        y: Math.fround(source.slideSpeed.y * Math.fround(0.95)),
      },
      frame, life, decal, decalGrowth,
    },
    rngState,
  }
}

export function nativeDeadSpiderEntry(source: Pick<NativeDeadSpiderState, 'headingDeg' | 'frame'>): number | null {
  let facing = source.headingDeg / 18
  while (facing < 0) facing += 10
  while (facing > 10) facing -= 10
  const index = Math.trunc(facing) + Math.trunc(source.frame) * 10
  return index < 20 ? 208 + index : null
}
