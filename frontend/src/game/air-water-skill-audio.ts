import type { PrimarySpellTransientState } from './core-kernels/primary-spells.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import {
  hubAudioAttenuation,
  type GameSoundCue,
  type GameStreamCue,
} from './game-audio-native.ts'

export type NativeAirWaterAcceptedCastAudioRequest =
  | Readonly<{ cue: GameSoundCue; kind: 'sound'; playbackRate: number }>
  | Readonly<{ cue: GameStreamCue; kind: 'stream'; playbackRate: number }>

const NO_ACCEPTED_CAST_CUE = Object.freeze([]) as readonly NativeAirWaterAcceptedCastAudioRequest[]

export const NATIVE_AIR_WATER_ACCEPTED_CAST_AUDIO = Object.freeze({
  27: Object.freeze([{ cue: 'magic-storm', kind: 'sound', playbackRate: 1 }]),
  30: Object.freeze([
    { cue: 'prismatic-shock', kind: 'stream', playbackRate: 1 },
    { cue: 'lightning-start', kind: 'sound', playbackRate: 0.8 },
  ]),
  35: Object.freeze([{ cue: 'ring-of-ice', kind: 'sound', playbackRate: 1 }]),
  72: Object.freeze([{ cue: 'magic-storm', kind: 'sound', playbackRate: 1 }]),
  76: NO_ACCEPTED_CAST_CUE,
} as const satisfies Readonly<Record<
  27 | 30 | 35 | 72 | 76,
  readonly NativeAirWaterAcceptedCastAudioRequest[]
>>)

export function nativeAirWaterAcceptedCastAudioRequests(
  skillId: number,
): readonly NativeAirWaterAcceptedCastAudioRequest[] | null {
  if (!Object.hasOwn(NATIVE_AIR_WATER_ACCEPTED_CAST_AUDIO, skillId)) return null
  return NATIVE_AIR_WATER_ACCEPTED_CAST_AUDIO[
    skillId as keyof typeof NATIVE_AIR_WATER_ACCEPTED_CAST_AUDIO
  ]
}

export interface NativeAirWaterActorSoundRequest {
  readonly cue: GameSoundCue
  readonly playbackRate: number
  readonly sourcePosition: Readonly<Vector2>
  readonly volume: number
}

const HAIL_BOUNCE_CUES = Object.freeze([
  'hail-bounce-0',
  'hail-bounce-1',
  'hail-bounce-2',
  'hail-bounce-3',
] as const satisfies readonly GameSoundCue[])

/** Converts replicated Hail bounce counters into exactly-once spatial requests. */
export function newNativeAirWaterActorSoundRequests(
  previous: readonly PrimarySpellTransientState[],
  current: readonly PrimarySpellTransientState[],
  listenerPosition: Readonly<Vector2>,
  listenerWorldKey: string,
): readonly NativeAirWaterActorSoundRequest[] {
  const previousActors = new Map(previous.map((actor) => [actorAudioKey(actor), actor]))
  const requests: NativeAirWaterActorSoundRequest[] = []
  for (const actor of current) {
    if (actor.kind !== 'water-hail' || actor.worldKey !== listenerWorldKey) continue
    const earlier = previousActors.get(actorAudioKey(actor))
    if (!earlier || earlier.kind !== 'water-hail') continue
    if (actor.bounceSoundSequence <= earlier.bounceSoundSequence) continue
    const cue = actor.bounceSoundIndex === null
      ? undefined
      : HAIL_BOUNCE_CUES[actor.bounceSoundIndex]
    if (!cue || actor.bounceSoundPitch === null) {
      throw new Error('Hail bounce sequence advanced without its native sample and pitch')
    }
    const volume = hubAudioAttenuation(Math.hypot(
      actor.position.x - listenerPosition.x,
      actor.position.y - listenerPosition.y,
    ))
    for (
      let sequence = earlier.bounceSoundSequence;
      sequence < actor.bounceSoundSequence;
      sequence += 1
    ) {
      requests.push({
        cue,
        playbackRate: actor.bounceSoundPitch,
        sourcePosition: actor.position,
        volume,
      })
    }
  }
  return Object.freeze(requests)
}

function actorAudioKey(actor: PrimarySpellTransientState): string {
  return `${actor.kind}:${actor.id}`
}
