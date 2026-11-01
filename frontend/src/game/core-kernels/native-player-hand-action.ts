import type { NativePrimarySkillProfile } from './native-primary-skill-profile.ts'
import { drawNativeInteger, type NativeRngState } from './native-rng.ts'
import { nativeActionMarkerCrossed } from './native-action-marker.ts'

export type NativePlayerHandPose = 0 | 1 | 2 | 3

/** Retail HandCast1: its random opening and construction rate belong to the action. */
export interface NativePlayerHandCast1 {
  readonly firstPose: 0 | 3
  readonly progress: number
  readonly rate: number
  readonly pose: NativePlayerHandPose
  readonly done: boolean
}

export function createNativePlayerHandCast1(
  profile: NativePrimarySkillProfile,
  castFactor: number,
  previousPose: NativePlayerHandPose,
  rng: NativeRngState,
): { readonly action: NativePlayerHandCast1; readonly rng: NativeRngState } {
  let rate = Math.fround(Math.fround(.095) * castFactor)
  if (profile.kind === 'fire') rate = Math.fround(rate * .75)
  else if (profile.kind === 'weld') {
    if (profile.buildId === 1000) rate = Math.fround(rate * .8700000047683716)
    else if (profile.buildId === 1002) rate = Math.fround(rate * 1.2999999523162842)
    else if (profile.buildId === 1009) rate = Math.fround(rate * profile.vector.values[5]!)
  }
  const draw = drawNativeInteger(rng, 4)
  return {
    action: { firstPose: draw.value === 1 ? 3 : 0, progress: 0, rate, pose: previousPose, done: false },
    rng: draw.state,
  }
}

export function nativePlayerHandCast1Pose(
  firstPose: 0 | 3,
  progress: number,
): NativePlayerHandPose {
  const index = Math.trunc(progress)
  return index === 0 ? firstPose : index === 1 ? 1 : index <= 4 ? 2 : 0
}

/** ActionManager removes a previously done action before its next step. */
export function stepNativePlayerHandCast1(
  action: NativePlayerHandCast1 | null,
  timeFactor = 1,
): { readonly action: NativePlayerHandCast1 | null; readonly emitted: boolean } {
  if (action === null || action.done) return { action: null, emitted: false }
  const progress = Math.fround(action.progress + timeFactor * action.rate)
  return {
    action: {
      ...action,
      progress,
      pose: nativePlayerHandCast1Pose(action.firstPose, progress),
      done: progress >= 4,
    },
    emitted: nativeActionMarkerCrossed(action.progress, progress, 1),
  }
}
