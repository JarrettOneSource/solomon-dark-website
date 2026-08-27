import {
  drawNativeFloat,
  type NativeRngState,
} from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_WELD_BLIZZARD_CORE_RECORD = 43
export const NATIVE_WELD_BLIZZARD_STRIP_RECORD = 44
export const NATIVE_WELD_BLIZZARD_SOURCE_GLOW_COUNT = 2
export const NATIVE_WELD_BLIZZARD_CONTACT_MINIMUM_HALF_WIDTH = 20
export const NATIVE_WELD_BLIZZARD_CONTACT_WIDTH_FACTOR = 25
export const NATIVE_WELD_BLIZZARD_CONTACT_FORWARD_EXTENSION = 50
export const NATIVE_WELD_BLIZZARD_CONTACT_ROOT_OFFSET_Y = 15
export const NATIVE_WELD_BLIZZARD_GLOW_OFFSET_Y = -20

const BLIZZARD_LONGITUDINAL_SCALE = 30
const BLIZZARD_PERPENDICULAR_SCALE = 25 * 0.908955
const BLIZZARD_JITTER_RADIUS = 5
const BLIZZARD_NORMAL_RED = Math.fround(0.5435550212860107)

export interface NativeWeldBlizzardGlowState {
  readonly ageTicks: number
  readonly birthTick: number
  readonly buildId: 1004
  readonly direction: Vector2
  readonly id: number
  readonly kind: 'weld-blizzard-glow'
  readonly lightRegistration: null
  readonly origin: Vector2
  readonly ownerId: string
  readonly rotationDegrees: number
  readonly scale: number
  readonly variant: 3 | 24
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

export interface NativeWeldBlizzardContactPolygon {
  readonly beamWidth: number
  readonly halfWidth: number
  readonly points: readonly [Vector2, Vector2, Vector2, Vector2]
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
      id: input.firstId + glowIndex,
      kind: 'weld-blizzard-glow',
      lightRegistration: null,
      origin: Object.freeze({ ...input.origin }),
      ownerId: input.ownerId,
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

export function createNativeWeldBlizzardContactGlow(input: Readonly<{
  direction: Vector2
  id: number
  ownerId: string
  position: Vector2
  rng: NativeRngState
  tick: number
  vector: readonly number[]
  worldKey: string
}>): Readonly<{
  actor: NativeWeldBlizzardGlowState
  rng: NativeRngState
}> {
  const scale = drawNativeFloat(input.rng, Math.fround(0.5))
  const rotation = drawNativeFloat(scale.state, 360)
  const position = Object.freeze({
    x: Math.fround(input.position.x),
    y: Math.fround(input.position.y + NATIVE_WELD_BLIZZARD_GLOW_OFFSET_Y),
  })
  return Object.freeze({
    actor: Object.freeze({
      ageTicks: 0,
      birthTick: input.tick,
      buildId: 1004,
      direction: Object.freeze({ ...input.direction }),
      id: input.id,
      kind: 'weld-blizzard-glow',
      lightRegistration: null,
      origin: position,
      ownerId: input.ownerId,
      rotationDegrees: rotation.value,
      scale: Math.fround(scale.value + 1),
      variant: 3,
      vector: Object.freeze([...input.vector]),
      worldKey: input.worldKey,
    }),
    rng: rotation.state,
  })
}

export function nativeWeldBlizzardContactPolygon(input: Readonly<{
  endpoint: Vector2
  source: Vector2
  underpowered: boolean
  widen: number
}>): NativeWeldBlizzardContactPolygon {
  const dx = Math.fround(input.endpoint.x - input.source.x)
  const dy = Math.fround(input.endpoint.y - input.source.y)
  const length = Math.hypot(dx, dy)
  const direction = length === 0
    ? { x: 0, y: -1 }
    : { x: Math.fround(dx / length), y: Math.fround(dy / length) }
  const beamWidth = nativeWeldBlizzardWidth(input.widen, input.underpowered)
  const halfWidth = Math.fround(Math.max(
    NATIVE_WELD_BLIZZARD_CONTACT_MINIMUM_HALF_WIDTH,
    Math.fround(beamWidth * NATIVE_WELD_BLIZZARD_CONTACT_WIDTH_FACTOR),
  ))
  const perpendicular = {
    x: Math.fround(direction.y * halfWidth),
    y: Math.fround(-direction.x * halfWidth),
  }
  const start = {
    x: Math.fround(input.source.x),
    y: Math.fround(input.source.y + NATIVE_WELD_BLIZZARD_CONTACT_ROOT_OFFSET_Y),
  }
  const end = {
    x: Math.fround(
      input.endpoint.x + Math.fround(direction.x * NATIVE_WELD_BLIZZARD_CONTACT_FORWARD_EXTENSION),
    ),
    y: Math.fround(
      input.endpoint.y
        + Math.fround(direction.y * NATIVE_WELD_BLIZZARD_CONTACT_FORWARD_EXTENSION)
        + NATIVE_WELD_BLIZZARD_CONTACT_ROOT_OFFSET_Y,
    ),
  }
  const point = (center: Vector2, sign: 1 | -1): Vector2 => Object.freeze({
    x: Math.fround(center.x + Math.fround(perpendicular.x * sign)),
    y: Math.fround(center.y + Math.fround(perpendicular.y * sign)),
  })
  return Object.freeze({
    beamWidth,
    halfWidth,
    points: Object.freeze([
      point(start, 1),
      point(end, 1),
      point(end, -1),
      point(start, -1),
    ] as const),
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
  const width = nativeWeldBlizzardWidth(input.widen, input.underpowered)
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

function nativeWeldBlizzardWidth(widen: number, underpowered: boolean): number {
  const nativeWidth = widen === 0
    ? Math.fround(0.75)
    : Math.fround(widen * 3 + 1)
  return underpowered
    ? Math.fround(nativeWidth * Math.fround(0.5))
    : nativeWidth
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
