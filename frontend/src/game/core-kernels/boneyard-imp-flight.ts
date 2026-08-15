/** Native Imp bodies are four complete 12-facing pose banks. */
export const NATIVE_IMP_BODY_POSE_COUNT = 4
/** BadGuys 333..342 are the ten recovered Imp upper-effect records. */
export const NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT = 10

/**
 * Native ownership is fixed-tick actor state. The exact flight cadence, bob
 * curve, and alpha range remain open, so the web program names and bounds them.
 */
export const BOUNDED_IMP_FLIGHT_PROGRAM = Object.freeze({
  bodyPoseTicks: 10,
  cycleTicks: 40,
  minimumAlpha: 0.82,
  maximumLift: 4,
  spawnEffectTicks: 10,
})

export interface BoundedImpFlightAnimationSample {
  readonly alpha: number
  readonly bodyPose: number
  readonly impEffectFrame: number
  readonly verticalOffset: number
}

export function boundedImpFlightAnimationSample(
  ageTicks: number,
): BoundedImpFlightAnimationSample {
  if (!Number.isSafeInteger(ageTicks) || ageTicks < 0) {
    throw new RangeError('Imp flight age must be a non-negative safe integer')
  }
  const cycleAge = ageTicks % BOUNDED_IMP_FLIGHT_PROGRAM.cycleTicks
  const phaseRadians = cycleAge / BOUNDED_IMP_FLIGHT_PROGRAM.cycleTicks
    * Math.PI * 2
  const lift = (1 - Math.cos(phaseRadians)) / 2
  return {
    alpha: 1 - (1 - BOUNDED_IMP_FLIGHT_PROGRAM.minimumAlpha) * lift,
    bodyPose: Math.floor(cycleAge / BOUNDED_IMP_FLIGHT_PROGRAM.bodyPoseTicks),
    impEffectFrame: ageTicks < BOUNDED_IMP_FLIGHT_PROGRAM.spawnEffectTicks
      ? Math.min(NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT - 1, ageTicks)
      : -1,
    verticalOffset: lift === 0
      ? 0
      : -BOUNDED_IMP_FLIGHT_PROGRAM.maximumLift * lift,
  }
}
