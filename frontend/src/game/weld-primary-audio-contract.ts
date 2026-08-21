import {
  nativeWeldAudioPlan,
} from './core-kernels/native-weld-primary-runtime.ts'
import type { NativeWeldBuildId } from './core-kernels/native-weld-primary-profile.ts'
import type { GameLoopCue, GameSoundCue } from './game-audio-native.ts'

const NATIVE_WELD_SOUND_CUE = {
  33: 'flame-lash-start',
  38: 'frost-missile',
  44: 'ice-start',
  57: 'magic-missile',
  87: 'start-boulder',
  97: 'throw-fire',
  203: 'shock-1',
  204: 'shock-2',
  205: 'shock-3',
  224: 'throw-lightning-1',
  225: 'throw-lightning-2',
} as const satisfies Readonly<Record<number, GameSoundCue>>

const NATIVE_WELD_LOOP_CUE = {
  157: 'fire-loop',
  159: 'gather-rocks-loop',
  160: 'ice-beam-loop',
  165: 'meteor-loop',
  172: 'steam-loop',
} as const satisfies Readonly<Record<number, GameLoopCue>>

export function nativeWeldCastSoundCues(
  buildId: NativeWeldBuildId,
  soundVariant: number | null,
): readonly GameSoundCue[] {
  const plan = nativeWeldAudioPlan(buildId)
  const nativeIds = [...plan.nativeSoundIds]
  if (plan.nativeSoundVariantIds.length > 0) {
    if (soundVariant === null
      || !Number.isInteger(soundVariant)
      || soundVariant < 0
      || soundVariant >= plan.nativeSoundVariantIds.length) {
      throw new RangeError(`weld build ${buildId} requires a native sound variant`)
    }
    nativeIds.push(plan.nativeSoundVariantIds[soundVariant]!)
  } else if (soundVariant !== null) {
    throw new RangeError(`weld build ${buildId} has no native sound variant`)
  }
  return Object.freeze(nativeIds.map(nativeWeldSoundCue))
}

export function nativeWeldLoopCues(buildId: NativeWeldBuildId): readonly GameLoopCue[] {
  return Object.freeze(nativeWeldAudioPlan(buildId).nativeLoopIds.map((nativeId) => {
    const cue = NATIVE_WELD_LOOP_CUE[nativeId as keyof typeof NATIVE_WELD_LOOP_CUE]
    if (!cue) throw new RangeError(`native weld loop ${nativeId} has no browser asset`)
    return cue
  }))
}

function nativeWeldSoundCue(nativeId: number): GameSoundCue {
  const cue = NATIVE_WELD_SOUND_CUE[nativeId as keyof typeof NATIVE_WELD_SOUND_CUE]
  if (!cue) throw new RangeError(`native weld sound ${nativeId} has no browser asset`)
  return cue
}
