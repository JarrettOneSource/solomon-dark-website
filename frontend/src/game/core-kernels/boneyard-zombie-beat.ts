export const NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM = Object.freeze({
  completionProgress: 125,
  impactStateTicks: 50,
  locomotionEndProgress: 80,
  markerProgress: 100,
  minimumRate: 0.9,
  randomRateRange: 0.25,
})

export interface NativeZombieBeatPose {
  readonly complete: boolean
  readonly frontArmPose: number
  readonly locomotionActive: boolean
  readonly markerReached: boolean
  readonly rearArmPose: number
}

export interface NativeZombieArticulationInput {
  readonly actionActive: boolean
  readonly actionSwing: number
  readonly attackSide: 0 | 1
  readonly bodyPhaseDeg: number
  readonly frontArmBaseRotationDeg: number
  readonly headBaseRotationDeg: number
  readonly headPhaseDeg: number
  readonly rearArmBaseRotationDeg: number
}

export interface NativeZombieArticulationPose {
  readonly bodyRotationRadians: number
  readonly frontArmRotationRadians: number
  readonly headRotationRadians: number
  readonly rearArmRotationRadians: number
}

export function nativeZombieBeatPose(
  progress: number,
  attackSide: 0 | 1,
): NativeZombieBeatPose {
  if (!Number.isFinite(progress) || progress < 0) {
    throw new Error('native Zombie beat progress must be finite and non-negative')
  }
  const selectedPose = progress < 50 ? 1 : progress < 100 ? 2 : 0
  return {
    complete: progress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.completionProgress,
    frontArmPose: attackSide === 1 ? selectedPose : 0,
    locomotionActive: progress < NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.locomotionEndProgress,
    markerReached: progress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress,
    rearArmPose: attackSide === 0 ? selectedPose : 0,
  }
}

/** Actor fields consumed by renderer 0x00493390, including beat-side articulation. */
export function nativeZombieArticulationPose(
  input: NativeZombieArticulationInput,
): NativeZombieArticulationPose {
  for (const [label, value] of Object.entries(input)) {
    if (label === 'actionActive' || label === 'attackSide') continue
    if (!Number.isFinite(value)) throw new RangeError(`Zombie ${label} must be finite`)
  }
  const idleBodyRotationDeg = truncatedDegrees(
    sinDegrees(input.bodyPhaseDeg) * 45,
    10,
  )
  const headRotationDeg = truncatedDegrees(
    sinDegrees(input.headPhaseDeg * 0.5) * 20,
    5,
  ) + input.headBaseRotationDeg
  const selectedArmSwingDeg = input.actionActive
    ? truncatedDegrees(input.actionSwing, 10)
    : 0
  const bodyLeanDeg = input.actionActive ? input.actionSwing / 3 : 0
  const bodyRotationDeg = idleBodyRotationDeg + (
    input.attackSide === 0 ? -bodyLeanDeg : bodyLeanDeg
  )
  return {
    bodyRotationRadians: degreesToRadians(bodyRotationDeg * 0.5),
    frontArmRotationRadians: degreesToRadians(
      input.frontArmBaseRotationDeg
        + (input.attackSide === 1 ? selectedArmSwingDeg : 0),
    ),
    headRotationRadians: degreesToRadians(headRotationDeg),
    rearArmRotationRadians: degreesToRadians(
      -input.rearArmBaseRotationDeg
        - (input.attackSide === 0 ? selectedArmSwingDeg : 0),
    ),
  }
}

function truncatedDegrees(value: number, increment: number): number {
  return Math.trunc(value / increment) * increment
}

function sinDegrees(value: number): number {
  return Math.sin(degreesToRadians(value))
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180
}
