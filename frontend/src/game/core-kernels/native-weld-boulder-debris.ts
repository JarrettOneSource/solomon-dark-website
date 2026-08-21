import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { NativeWeldMeteorDebrisSeed } from './native-weld-meteor.ts'

export const NATIVE_WELD_BOULDER_DEBRIS_ALPHA_STEP = Math.fround(0.025)
export const NATIVE_WELD_BOULDER_DEBRIS_INITIAL_ALPHA = 2
export const NATIVE_WELD_BOULDER_DEBRIS_LIFETIME_TICKS = 80

const NATIVE_BOULDER_BIT_RECORDS = [2008, 2009, 2010] as const
const NATIVE_BOULDER_BIT_VERTICAL_ASPECT = Math.fround(0.8)

export interface NativeWeldBoulderDebrisProgram {
  readonly debris: readonly NativeWeldMeteorDebrisSeed[]
  readonly rng: NativeRngState
}

/**
 * Exact weak EBoulder handler program at 0x0054572C..0x00545B0C.
 * The duplicated scale draw is intentional: retail's MAX macro evaluates its
 * randomized second argument once for the comparison and again when selected.
 */
export function createNativeWeldEtherealBoulderWeakDebrisProgram(input: {
  readonly direction: Readonly<{ x: number; y: number }>
  readonly rng: NativeRngState
  readonly scale: number
}): NativeWeldBoulderDebrisProgram {
  const scale = Math.min(input.scale, 1)
  const countScalar = Math.max(Math.fround(input.scale * 30), 8)
  const count = roundHalfToEven(countScalar)
  const angularStep = Math.fround(360 / countScalar)
  const angleSeed = drawNativeFloat(input.rng, 360)
  let rng = angleSeed.state
  let angle = angleSeed.value
  const debris: NativeWeldMeteorDebrisSeed[] = []

  for (let index = 0; index < count; index += 1) {
    const bounce = drawNativeFloat(rng, 3); rng = bounce.state
    const overwrittenHeight = drawNativeFloat(rng, 20); rng = overwrittenHeight.state
    const rotation = drawNativeFloat(rng, 360); rng = rotation.state
    const rotationStep = drawNativeFloat(rng, 10); rng = rotationStep.state
    const color = drawNativeFloat(rng, Math.fround(0.5)); rng = color.state
    const record = drawNativeInteger(rng, 3); rng = record.state
    const verticalScale = drawNativeFloat(rng, Math.fround(scale * 1.5))
    rng = verticalScale.state
    const height = drawNativeFloat(rng, Math.fround(scale * 50)); rng = height.state
    const spawnDistance = drawNativeFloat(rng, 40); rng = spawnDistance.state
    const firstScaleProbe = drawNativeFloat(rng, Math.fround(0.75))
    rng = firstScaleProbe.state
    const firstScaleCandidate = Math.fround(
      Math.fround(firstScaleProbe.value + 0.5) * input.scale,
    )
    let nativeScale = Math.fround(0.45)
    if (firstScaleCandidate >= nativeScale) {
      const selectedScaleProbe = drawNativeFloat(rng, Math.fround(0.75))
      rng = selectedScaleProbe.state
      nativeScale = Math.fround(
        Math.fround(selectedScaleProbe.value + 0.5) * input.scale,
      )
    }
    nativeScale = Math.min(Math.fround(0.75), nativeScale)
    const motionScale = drawNativeFloat(rng, Math.fround(input.scale * 1.5))
    rng = motionScale.state
    const angleJitter = drawNativeFloat(
      rng,
      Math.fround(angularStep / 3),
      true,
    )
    rng = angleJitter.state

    const radial = headingVector(angle)
    const movement = Math.fround(motionScale.value + 1.5)
    debris.push(Object.freeze({
      alpha: NATIVE_WELD_BOULDER_DEBRIS_INITIAL_ALPHA,
      colorGreen: color.value,
      height: Math.fround(-height.value),
      index,
      position: Object.freeze({
        x: Math.fround(
          input.direction.x * 20 + radial.x * spawnDistance.value,
        ),
        y: Math.fround(
          input.direction.y * 20
            + radial.y * NATIVE_BOULDER_BIT_VERTICAL_ASPECT * spawnDistance.value,
        ),
      }),
      record: NATIVE_BOULDER_BIT_RECORDS[record.value]!,
      rotationDegrees: rotation.value,
      rotationStepDegrees: Math.fround(rotationStep.value + 1),
      scale: Math.fround(nativeScale * 0.75),
      velocity: Object.freeze({
        x: Math.fround(radial.x * movement),
        y: Math.fround(radial.y * NATIVE_BOULDER_BIT_VERTICAL_ASPECT * movement),
      }),
      verticalVelocity: Math.fround(
        Math.fround(-(bounce.value + 2))
          * Math.fround(verticalScale.value + 0.75),
      ),
    }))
    angle = Math.fround(angle + angularStep + angleJitter.value)
    void overwrittenHeight
  }

  return Object.freeze({ debris: Object.freeze(debris), rng })
}

function headingVector(degrees: number): Readonly<{ x: number; y: number }> {
  const radians = degrees * Math.PI / 180
  return Object.freeze({
    x: Math.fround(Math.sin(radians)),
    y: Math.fround(-Math.cos(radians)),
  })
}

function roundHalfToEven(value: number): number {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}
