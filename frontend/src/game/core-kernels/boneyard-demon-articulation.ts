export interface NativeDemonArticulationSample {
  readonly frontRotationRadians: number
  readonly rearRotationRadians: number
  readonly verticalOffset: number
}

export const NATIVE_DEMON_BOMB_CONTROLLER_POSES = Object.freeze([
  0, 0, 0, 1, 1, 1, 1, 1, 0,
] as const)

/** Renderer 0x00498BA0 consumes the global fixed tick and actor-local age. */
export function nativeDemonArticulationSample(
  tick: number,
  spawnTick: number,
  controllerPose: number,
): NativeDemonArticulationSample {
  requireTick(tick, 'Demon sample tick')
  requireTick(spawnTick, 'Demon spawn tick')
  if (tick < spawnTick) throw new RangeError('Demon sample tick must not precede spawn')
  if (!Number.isSafeInteger(controllerPose) || controllerPose < 0 || controllerPose > 1) {
    throw new RangeError('Demon controller pose must be 0 or 1')
  }
  const ageTicks = tick - spawnTick
  const frontRotationDeg = controllerPose === 1
    ? 40
    : 2 * sinDegrees(tick)
  const rearRotationDeg = controllerPose === 1
    ? -40
    : 2 * sinDegrees(tick) + 1
  return {
    frontRotationRadians: degreesToRadians(frontRotationDeg),
    rearRotationRadians: degreesToRadians(rearRotationDeg),
    verticalOffset: -Math.abs(sinDegrees(ageTicks * 0.25)) * 3,
  }
}

function sinDegrees(value: number): number {
  return Math.sin(degreesToRadians(value))
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180
}

function requireTick(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }
}
