import {
  drawNativeFloat,
  type NativeRngState,
} from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_WELD_BLIZZARD_CORE_RECORD = 43
export const NATIVE_WELD_BLIZZARD_STRIP_RECORD = 44
export const NATIVE_WELD_BLIZZARD_SOURCE_GLOW_COUNT = 2

const BLIZZARD_LONGITUDINAL_SCALE = 30
const BLIZZARD_PERPENDICULAR_SCALE = 25 * 0.908955
const BLIZZARD_JITTER_RADIUS = 5
const BLIZZARD_NORMAL_RED = Math.fround(0.5435550212860107)

export interface NativeWeldBlizzardGlowState {
  readonly ageTicks: number
  readonly birthTick: number
  readonly buildId: 1004
  readonly direction: Vector2
  readonly glowIndex: 0 | 1
  readonly id: number
  readonly kind: 'weld-blizzard-glow'
  readonly lightRegistration: null
  readonly origin: Vector2
  readonly ownerId: string
  readonly position: Vector2
  readonly rotationDegrees: number
  readonly scale: number
  readonly variant: 24
  readonly vector: readonly number[]
  readonly worldKey: string
}

export interface NativeWeldBlizzardQuad {
  readonly record: 43 | 44
  readonly vertices: readonly number[]
}

export interface NativeWeldBlizzardBeamPlan {
  readonly jitter: Vector2
  readonly quads: readonly [NativeWeldBlizzardQuad, NativeWeldBlizzardQuad]
  readonly tint: number
  readonly width: number
}

export function createNativeWeldBlizzardSourceGlows(input: {
  readonly direction: Vector2
  readonly firstId: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly rng: NativeRngState
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): Readonly<{
  actors: readonly [NativeWeldBlizzardGlowState, NativeWeldBlizzardGlowState]
  nextId: number
  rng: NativeRngState
}> {
  let rng = input.rng
  const actors: NativeWeldBlizzardGlowState[] = []
  for (let glowIndex = 0; glowIndex < NATIVE_WELD_BLIZZARD_SOURCE_GLOW_COUNT; glowIndex += 1) {
    const scale = drawNativeFloat(rng, Math.fround(0.5)); rng = scale.state
    const rotation = drawNativeFloat(rng, 360); rng = rotation.state
    actors.push(Object.freeze({
      ageTicks: 0,
      birthTick: input.tick,
      buildId: 1004,
      direction: Object.freeze({ ...input.direction }),
      glowIndex: glowIndex as 0 | 1,
      id: input.firstId + glowIndex,
      kind: 'weld-blizzard-glow',
      lightRegistration: null,
      origin: Object.freeze({ ...input.origin }),
      ownerId: input.ownerId,
      position: Object.freeze({ ...input.origin }),
      rotationDegrees: rotation.value,
      scale: Math.fround(scale.value + 1),
      variant: 24,
      vector: Object.freeze([...input.vector]),
      worldKey: input.worldKey,
    }))
  }
  const pair = Object.freeze([actors[0]!, actors[1]!] as const)
  return Object.freeze({
    actors: pair,
    nextId: input.firstId + NATIVE_WELD_BLIZZARD_SOURCE_GLOW_COUNT,
    rng,
  })
}

export function nativeWeldBlizzardBeamPlan(input: {
  readonly birthTick: number
  readonly endpoint: Vector2
  readonly source: Vector2
  readonly underpowered: boolean
  readonly widen: number
}): NativeWeldBlizzardBeamPlan {
  const dx = Math.fround(input.endpoint.x - input.source.x)
  const dy = Math.fround(input.endpoint.y - input.source.y)
  const length = Math.hypot(dx, dy) || 1
  const direction = {
    x: Math.fround(dx / length),
    y: Math.fround(dy / length),
  }
  const nativeWidth = input.widen === 0
    ? Math.fround(0.75)
    : Math.fround(input.widen * 3 + 1)
  const width = input.underpowered
    ? Math.fround(nativeWidth * Math.fround(0.5))
    : nativeWidth
  const longitudinal = {
    x: Math.fround(direction.x * width * BLIZZARD_LONGITUDINAL_SCALE),
    y: Math.fround(direction.y * width * BLIZZARD_LONGITUDINAL_SCALE),
  }
  const perpendicularMagnitude = Math.fround(width * BLIZZARD_PERPENDICULAR_SCALE)
  const perpendicular = {
    x: Math.fround(direction.y * perpendicularMagnitude),
    y: Math.fround(-direction.x * perpendicularMagnitude),
  }
  const jitterUnit = blizzardJitter(-3 * input.birthTick)
  const jitter = Object.freeze({
    x: Math.fround(jitterUnit.x),
    y: Math.fround(jitterUnit.y),
  })
  const point = (x: number, y: number): readonly [number, number] => Object.freeze([
    Math.fround(x + jitter.x),
    Math.fround(y + jitter.y),
  ])
  const sourceMinus = {
    x: Math.fround(input.source.x - longitudinal.x),
    y: Math.fround(input.source.y - longitudinal.y),
  }
  const sourcePlus = {
    x: Math.fround(input.source.x + longitudinal.x),
    y: Math.fround(input.source.y + longitudinal.y),
  }
  const cap = [
    point(sourceMinus.x + perpendicular.x, sourceMinus.y + perpendicular.y),
    point(sourceMinus.x - perpendicular.x, sourceMinus.y - perpendicular.y),
    point(sourcePlus.x + perpendicular.x, sourcePlus.y + perpendicular.y),
    point(sourcePlus.x - perpendicular.x, sourcePlus.y - perpendicular.y),
  ].flat()
  const strip = [
    point(sourcePlus.x + perpendicular.x, sourcePlus.y + perpendicular.y),
    point(sourcePlus.x - perpendicular.x, sourcePlus.y - perpendicular.y),
    point(input.endpoint.x + perpendicular.x, input.endpoint.y + perpendicular.y),
    point(input.endpoint.x - perpendicular.x, input.endpoint.y - perpendicular.y),
  ].flat()
  const capQuad: NativeWeldBlizzardQuad = Object.freeze({
    record: NATIVE_WELD_BLIZZARD_CORE_RECORD,
    vertices: Object.freeze(cap),
  })
  const stripQuad: NativeWeldBlizzardQuad = Object.freeze({
    record: NATIVE_WELD_BLIZZARD_STRIP_RECORD,
    vertices: Object.freeze(strip),
  })
  return Object.freeze({
    jitter,
    quads: Object.freeze([capQuad, stripQuad] as const),
    tint: input.underpowered ? 0x80bfff : packRgb(BLIZZARD_NORMAL_RED, 1, 1),
    width,
  })
}

function blizzardJitter(seed: number): Vector2 {
  const mixed = nativePrivateWord(nativePrivateStage(seed >>> 0))
  const unit = mixed % 100_000 / 100_000
  const radius = unit * BLIZZARD_JITTER_RADIUS
  const radians = unit * Math.PI * 2
  return Object.freeze({
    x: Math.fround(Math.sin(radians) * radius),
    y: Math.fround(-Math.cos(radians) * radius),
  })
}

function nativePrivateStage(source: number): number {
  let value = (source ^ (source << 21)) >>> 0
  value = (value ^ (value >>> 11)) >>> 0
  return Math.imul((value ^ (value << 4)) >>> 0, 0x0a67cfcf) >>> 0
}

function nativePrivateWord(source: number): number {
  return Math.abs(nativePrivateStage(Math.abs(source | 0) >>> 0) | 0) >>> 0
}

function packRgb(red: number, green: number, blue: number): number {
  const byte = (value: number) => Math.trunc(Math.max(0, Math.min(1, value)) * 255)
  return byte(red) << 16 | byte(green) << 8 | byte(blue)
}
