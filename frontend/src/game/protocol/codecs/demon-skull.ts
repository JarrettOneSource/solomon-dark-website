import type { NativeDemonSkullVisualState } from '../../core-kernels/native-demon-skull.ts'
import { boneyardPoint } from './native-state.ts'
import { boundedInteger, finite, onlyKeys, record, unitInterval } from './values.ts'

export function nativeDemonSkullVisual(value: unknown, field: string): NativeDemonSkullVisualState {
  const source = record(value, field)
  onlyKeys(source, field, ['bodyHeadingDeg', 'bodyOffset', 'bodyPhaseDeg', 'bodyPose', 'chargeGlow',
    'eyeCharge', 'flairGlow', 'flickerPhaseDeg', 'jitter', 'lightIntensity', 'spin'])
  return { bodyHeadingDeg: finite(source.bodyHeadingDeg, `${field}.bodyHeadingDeg`),
    bodyOffset: boneyardPoint(source.bodyOffset, `${field}.bodyOffset`),
    bodyPhaseDeg: finite(source.bodyPhaseDeg, `${field}.bodyPhaseDeg`),
    bodyPose: boundedInteger(source.bodyPose, `${field}.bodyPose`, 0, 2),
    chargeGlow: unitInterval(source.chargeGlow, `${field}.chargeGlow`),
    eyeCharge: unitInterval(source.eyeCharge, `${field}.eyeCharge`),
    flairGlow: unitInterval(source.flairGlow, `${field}.flairGlow`),
    flickerPhaseDeg: finite(source.flickerPhaseDeg, `${field}.flickerPhaseDeg`),
    jitter: boneyardPoint(source.jitter, `${field}.jitter`),
    lightIntensity: unitInterval(source.lightIntensity, `${field}.lightIntensity`),
    spin: finite(source.spin, `${field}.spin`) }
}
