import type { Vector2 } from './vector.ts'

export type EarthBoulderOrientation = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
]

export interface EarthBoulderVector3 {
  x: number
  y: number
  z: number
}

export const EARTH_BOULDER_IDENTITY_ORIENTATION: EarthBoulderOrientation = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
]

const HELD_ROTATION_DEGREES = 0.75
const AXIS_YZ_NORMALIZER = Math.sqrt(1.64)

export function earthBoulderHeldOrientationStep(
  orientation: EarthBoulderOrientation,
  direction: Vector2,
): EarthBoulderOrientation {
  return rotateEarthBoulderOrientation(
    orientation,
    earthBoulderOrientationAxis(direction),
    HELD_ROTATION_DEGREES,
  )
}

export function earthBoulderFlightOrientationStep(
  orientation: EarthBoulderOrientation,
  direction: Vector2,
  storedDelta: Vector2,
  charge: number,
): EarthBoulderOrientation {
  const degrees = Math.fround(Math.hypot(storedDelta.x, storedDelta.y) / charge)
  return rotateEarthBoulderOrientation(
    orientation,
    earthBoulderOrientationAxis(direction),
    degrees,
  )
}

export function earthBoulderOrientationAxis(direction: Vector2): EarthBoulderVector3 {
  const raw = {
    x: -direction.y,
    y: direction.x / AXIS_YZ_NORMALIZER,
    z: 0.8 * direction.x / AXIS_YZ_NORMALIZER,
  }
  const length = Math.hypot(raw.x, raw.y, raw.z)
  return {
    x: Math.fround(raw.x / length),
    y: Math.fround(raw.y / length),
    z: Math.fround(raw.z / length),
  }
}

export function earthBoulderTransformPoint(
  point: EarthBoulderVector3,
  orientation: EarthBoulderOrientation,
): EarthBoulderVector3 {
  return {
    x: point.x * orientation[0]
      + point.y * orientation[3]
      + point.z * orientation[6],
    y: point.x * orientation[1]
      + point.y * orientation[4]
      + point.z * orientation[7],
    z: point.x * orientation[2]
      + point.y * orientation[5]
      + point.z * orientation[8],
  }
}

function rotateEarthBoulderOrientation(
  orientation: EarthBoulderOrientation,
  axis: EarthBoulderVector3,
  degrees: number,
): EarthBoulderOrientation {
  const radians = degrees * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const complement = 1 - cosine
  const { x, y, z } = axis
  const rotation: EarthBoulderOrientation = [
    Math.fround(cosine + x * x * complement),
    Math.fround(x * y * complement + z * sine),
    Math.fround(x * z * complement - y * sine),
    Math.fround(y * x * complement - z * sine),
    Math.fround(cosine + y * y * complement),
    Math.fround(y * z * complement + x * sine),
    Math.fround(z * x * complement + y * sine),
    Math.fround(z * y * complement - x * sine),
    Math.fround(cosine + z * z * complement),
  ]

  const result = new Array<number>(9)
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const offset = row * 3
      result[offset + column] = Math.fround(
        orientation[offset] * rotation[column]
        + orientation[offset + 1] * rotation[3 + column]
        + orientation[offset + 2] * rotation[6 + column],
      )
    }
  }
  return result as unknown as EarthBoulderOrientation
}
