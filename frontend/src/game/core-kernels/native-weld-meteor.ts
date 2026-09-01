import { actorHeadingFromVector } from './actor-heading.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_WELD_METEOR_MARKER_ALPHA_STEP = Math.fround(0.025)
export const NATIVE_WELD_METEOR_MARKER_SCALE = 3.5
export const NATIVE_WELD_METEOR_MARKER_REACH = 160
export const NATIVE_WELD_METEOR_IMPACT_DEBRIS_COUNT = 5
export const NATIVE_WELD_METEOR_IMPACT_DEBRIS_RECORDS = [2008, 2009, 2010] as const

const NATIVE_MARKER_GROWTH = Math.fround(1.015)
const NATIVE_MARKER_SHRINK = Math.fround(0.99)
const NATIVE_METEOR_TARGET_RADIUS = 150
const NATIVE_METEOR_VERTICAL_POINT_SCALE = Math.fround(0.8)
const NATIVE_METEOR_FALL_BASE_STEP = Math.fround(0.02)
const NATIVE_METEOR_IMPACT_BASE_TICKS = 200
const NATIVE_METEOR_IMPACT_TOUGHNESS_TICKS = 50
const NATIVE_METEOR_IMPACT_RADIUS_FACTOR = 45
const NATIVE_METEOR_DIRECT_RADIUS = 45

export interface NativeWeldMeteorMarkerState {
  readonly ageTicks: number
  readonly alpha: number
  readonly birthTick: number
  readonly buildId: 1007
  readonly colorGreen: number
  readonly direction: Vector2
  readonly growthFactor: number
  readonly id: number
  readonly kind: 'weld-meteor-marker'
  readonly lightRegistration: null
  readonly origin: Vector2
  readonly ownerId: string
  readonly rotationDegrees: number
  readonly scale: number
  readonly vector: readonly number[]
  readonly worldKey: string
}

export interface NativeWeldMeteorDebrisSeed {
  readonly alpha: 2
  readonly colorGreen: number
  readonly height: number
  readonly index: number
  readonly position: Vector2
  readonly record: typeof NATIVE_WELD_METEOR_IMPACT_DEBRIS_RECORDS[number]
  readonly rotationDegrees: number
  readonly rotationStepDegrees: number
  readonly scale: number
  readonly velocity: Vector2
  readonly verticalVelocity: number
}

export interface NativeWeldMeteorSpawnProgram {
  readonly bodyScale: number
  readonly fallHeadingDegrees: number
  readonly fallHeight: number
  readonly fallStep: number
  readonly impactTicks: number
  readonly position: Vector2
  readonly privateSeed: number
  readonly rng: NativeRngState
}

export interface NativeWeldMeteorImpactProgram {
  readonly cameraDisplacement: Vector2
  readonly debris: readonly NativeWeldMeteorDebrisSeed[]
  readonly impactRadiusScalar: number
  readonly impactRotationDegrees: number
  readonly impactSoundPitch: number
  readonly impactThrowFirePitch: number | null
  readonly rng: NativeRngState
}

export function spawnNativeWeldMeteorMarker(input: {
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly rng: NativeRngState
  readonly tick: number
  readonly vector: readonly number[]
  readonly worldKey: string
}): { readonly marker: NativeWeldMeteorMarkerState; readonly rng: NativeRngState } {
  const color = drawNativeFloat(input.rng, Math.fround(0.5))
  const rotation = drawNativeFloat(color.state, 360)
  const growth = drawNativeInteger(rotation.state, 2)
  const alpha = drawNativeFloat(growth.state, Math.fround(0.5))
  return {
    marker: Object.freeze({
      ageTicks: 0,
      alpha: Math.fround(Math.fround(alpha.value + 0.5) * 0.5),
      birthTick: input.tick,
      buildId: 1007,
      colorGreen: color.value,
      direction: Object.freeze({ ...input.direction }),
      growthFactor: growth.value === 1 ? NATIVE_MARKER_SHRINK : NATIVE_MARKER_GROWTH,
      id: input.id,
      kind: 'weld-meteor-marker',
      lightRegistration: null,
      origin: Object.freeze({ ...input.origin }),
      ownerId: input.ownerId,
      rotationDegrees: rotation.value,
      scale: NATIVE_WELD_METEOR_MARKER_SCALE,
      vector: Object.freeze([...input.vector]),
      worldKey: input.worldKey,
    }),
    rng: alpha.state,
  }
}

export function stepNativeWeldMeteorMarker(
  marker: NativeWeldMeteorMarkerState,
): NativeWeldMeteorMarkerState | null {
  const alpha = Math.fround(marker.alpha - NATIVE_WELD_METEOR_MARKER_ALPHA_STEP)
  if (alpha <= 0) return null
  return Object.freeze({
    ...marker,
    ageTicks: marker.ageTicks + 1,
    alpha,
    scale: Math.fround(marker.scale * marker.growthFactor),
  })
}

export function nativeWeldMeteorTargetPoint(
  playerPosition: Vector2,
  aimDirection: Vector2,
): Vector2 {
  return Object.freeze({
    x: Math.fround(playerPosition.x + aimDirection.x * NATIVE_WELD_METEOR_MARKER_REACH),
    y: Math.fround(playerPosition.y + aimDirection.y * NATIVE_WELD_METEOR_MARKER_REACH),
  })
}

export function nativeWeldMeteorCadenceTicks(
  castProgressFactor: number,
  underpowered: boolean,
): number {
  const rounded = Math.round(castProgressFactor)
  if (rounded < 1) throw new RangeError('Meteor cast progress factor must round above zero')
  return Math.max(5, Math.trunc((underpowered ? 35 : 25) / rounded))
}

export function createNativeWeldMeteorSpawnProgram(input: {
  readonly aimDirection: Vector2
  readonly center: Vector2
  readonly resolvePosition: (candidate: Vector2) => Vector2
  readonly rng: NativeRngState
  readonly underpowered: boolean
  readonly vector: readonly number[]
}): NativeWeldMeteorSpawnProgram {
  let rng = input.rng
  const bodyScale = drawNativeFloat(rng, Math.fround(0.25)); rng = bodyScale.state
  const radius = drawNativeFloat(rng, NATIVE_METEOR_TARGET_RADIUS); rng = radius.state
  const radialDirection = drawNativeUnitVector(rng); rng = radialDirection.rng
  const candidate = Object.freeze({
    x: Math.fround(input.center.x + radialDirection.value.x * radius.value),
    y: Math.fround(
      input.center.y
        + radialDirection.value.y * radius.value * NATIVE_METEOR_VERTICAL_POINT_SCALE,
    ),
  })
  // Retail adds this draw to constructor +0x13C, then the initializer
  // overwrites +0x13C with size. It is still part of the authoritative stream.
  const overwrittenSize = drawNativeFloat(rng, Math.fround(0.25)); rng = overwrittenSize.state
  const fallHeading = drawNativeFloat(rng, 40); rng = fallHeading.state
  const size = drawNativeFloat(rng, Math.fround(0.25)); rng = size.state
  let privateSeed = 0
  if (!input.underpowered) {
    const seed = drawNativeInteger(rng, 10_000_000)
    rng = seed.state
    privateSeed = seed.value
  }
  const aimHeading = actorHeadingFromVector(input.aimDirection.x, input.aimDirection.y)
  const fallHeadingDegrees = Math.fround(
    (aimHeading > 180 ? -1 : 1) * Math.fround(10 + fallHeading.value),
  )
  const growth = input.underpowered ? 2 : Math.fround(input.vector[3]! * 2)
  const toughnessTicks = input.underpowered
    ? 0
    : Math.fround(input.vector[4]! * NATIVE_METEOR_IMPACT_TOUGHNESS_TICKS)
  return Object.freeze({
    bodyScale: Math.fround(1 - bodyScale.value),
    fallHeadingDegrees,
    fallHeight: Math.fround(Math.fround(size.value + 1) * 2.5 * 2),
    fallStep: Math.fround(NATIVE_METEOR_FALL_BASE_STEP * growth),
    impactTicks: Math.round(NATIVE_METEOR_IMPACT_BASE_TICKS + toughnessTicks),
    position: Object.freeze({ ...input.resolvePosition(candidate) }),
    privateSeed,
    rng,
  })
}

export function createNativeWeldMeteorImpactProgram(input: {
  readonly bodyScale: number
  readonly rng: NativeRngState
  readonly underpowered: boolean
}): NativeWeldMeteorImpactProgram {
  let rng = input.rng
  const cameraDirection = drawNativeUnitVector(rng); rng = cameraDirection.rng
  const rotation = drawNativeFloat(rng, 360); rng = rotation.state
  const radius = drawNativeFloat(rng, Math.fround(0.5)); rng = radius.state
  const angleSeed = drawNativeFloat(rng, 360); rng = angleSeed.state
  let angle = angleSeed.value
  const debris: NativeWeldMeteorDebrisSeed[] = []
  const scaleInput = Math.min(input.bodyScale, 1)
  for (let index = 0; index < NATIVE_WELD_METEOR_IMPACT_DEBRIS_COUNT; index += 1) {
    const bounce = drawNativeFloat(rng, 3); rng = bounce.state
    const overwrittenHeight = drawNativeFloat(rng, 20); rng = overwrittenHeight.state
    const rotationDraw = drawNativeFloat(rng, 360); rng = rotationDraw.state
    const rotationStep = drawNativeFloat(rng, 10); rng = rotationStep.state
    const color = drawNativeFloat(rng, Math.fround(0.5)); rng = color.state
    const record = drawNativeInteger(rng, 3); rng = record.state
    const verticalScale = drawNativeFloat(rng, Math.fround(1.5)); rng = verticalScale.state
    const height = drawNativeFloat(rng, Math.fround(scaleInput * 50)); rng = height.state
    const spawnDistance = drawNativeFloat(rng, 15); rng = spawnDistance.state
    const scaleProbe = drawNativeFloat(rng, Math.fround(0.75)); rng = scaleProbe.state
    const motionScale = drawNativeFloat(
      rng,
      Math.fround(scaleInput * 1.5),
      true,
    ); rng = motionScale.state
    const angleStep = drawNativeFloat(rng, 24); rng = angleStep.state
    const direction = headingVector(angle)
    const movement = Math.fround(Math.fround(motionScale.value + 1.5) * 0.5)
    const nativeScaleProbe = Math.fround(
      Math.fround(scaleProbe.value + 0.5) * scaleInput * 0.25,
    )
    debris.push(Object.freeze({
      alpha: 2,
      colorGreen: color.value,
      height: Math.fround(-height.value),
      index,
      position: Object.freeze({
        x: Math.fround(direction.x * spawnDistance.value),
        y: Math.fround(direction.y * NATIVE_METEOR_VERTICAL_POINT_SCALE * spawnDistance.value),
      }),
      record: NATIVE_WELD_METEOR_IMPACT_DEBRIS_RECORDS[record.value]!,
      rotationDegrees: rotationDraw.value,
      rotationStepDegrees: Math.fround(rotationStep.value + 1),
      scale: Math.min(0.75, Math.max(Math.fround(0.45), nativeScaleProbe)),
      velocity: Object.freeze({
        x: Math.fround(direction.x * movement),
        y: Math.fround(direction.y * NATIVE_METEOR_VERTICAL_POINT_SCALE * movement),
      }),
      verticalVelocity: Math.fround(
        Math.fround(-(bounce.value + 2))
          * Math.fround(Math.fround(verticalScale.value * scaleInput) + 0.75),
      ),
    }))
    angle = Math.fround(angle + 72 + angleStep.value)
    void overwrittenHeight
  }
  const pitch = drawNativeFloat(
    rng,
    input.underpowered ? Math.fround(0.2) : Math.fround(0.1),
    true,
  )
  rng = pitch.state
  return Object.freeze({
    cameraDisplacement: Object.freeze({
      x: Math.fround(cameraDirection.value.x * 10),
      y: Math.fround(cameraDirection.value.y * 10),
    }),
    debris: Object.freeze(debris),
    impactRadiusScalar: Math.fround(input.bodyScale + radius.value),
    impactRotationDegrees: rotation.value,
    impactSoundPitch: Math.fround(1 + pitch.value),
    impactThrowFirePitch: input.underpowered ? null : Math.fround(0.8),
    rng,
  })
}

export function nativeWeldMeteorDirectRadius(): number {
  return NATIVE_METEOR_DIRECT_RADIUS
}

export function nativeWeldMeteorPulseRadius(impactRadiusScalar: number): number {
  return Math.fround(impactRadiusScalar * NATIVE_METEOR_IMPACT_RADIUS_FACTOR)
}

function drawNativeUnitVector(
  source: NativeRngState,
): { readonly rng: NativeRngState; readonly value: Vector2 } {
  const heading = drawNativeInteger(source, 100_001)
  const degrees = Math.fround(Math.fround(heading.value / 100_000) * 360)
  return { rng: heading.state, value: headingVector(degrees) }
}

function headingVector(degrees: number): Vector2 {
  const radians = degrees * Math.PI / 180
  return Object.freeze({
    x: Math.fround(Math.sin(radians)),
    y: Math.fround(-Math.cos(radians)),
  })
}
