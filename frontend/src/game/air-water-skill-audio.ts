import type { PrimarySpellTransientState } from './core-kernels/primary-spells.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import type { PrimarySpellSimulationFrameState } from './protocol/game-state.ts'
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

const NO_ACTOR_SOUND_REQUESTS = Object.freeze(
  [],
) as readonly NativeAirWaterActorSoundRequest[]

interface RetainedHailSoundState {
  bounceSoundSequence: number
  seenGeneration: number
}

export class NativeAirWaterFrameSoundCursor {
  private generation = 0
  private readonly hailById = new Map<number, RetainedHailSoundState>()
  private listenerWorldKey: string | null = null

  advance(
    current: PrimarySpellSimulationFrameState,
    listenerPosition: Readonly<Vector2>,
    listenerWorldKey: string,
  ): readonly NativeAirWaterActorSoundRequest[] {
    if (this.listenerWorldKey !== listenerWorldKey) {
      this.reset(current, listenerWorldKey)
      return NO_ACTOR_SOUND_REQUESTS
    }
    const previousGeneration = this.generation
    const generation = previousGeneration + 1
    let liveActorCount = 0
    let requests: NativeAirWaterActorSoundRequest[] | undefined
    const rows = current.hail.rows
    for (let index = 0; index < rows.length; index += 1) {
      if (current.hail.worldKeys[rows.worldKeyIndexes[index]!] !== listenerWorldKey) continue
      liveActorCount += 1
      const id = rows.ids[index]!
      const bounceSoundSequence = rows.bounceSoundSequences[index]!
      const retained = this.hailById.get(id)
      const earlierSequence = retained?.seenGeneration === previousGeneration
        ? retained.bounceSoundSequence
        : null
      if (earlierSequence !== null && bounceSoundSequence > earlierSequence) {
        const bounceSoundIndex = rows.bounceSoundIndexes[index]!
        const bounceSoundPitch = rows.bounceSoundPitches[index]!
        const cue = bounceSoundIndex === 0xff
          ? undefined
          : HAIL_BOUNCE_CUES[bounceSoundIndex]
        if (!cue || Number.isNaN(bounceSoundPitch)) {
          throw new Error('Hail bounce sequence advanced without its native sample and pitch')
        }
        const sourcePosition = {
          x: rows.positionXs[index]!,
          y: rows.positionYs[index]!,
        }
        const volume = hubAudioAttenuation(Math.hypot(
          sourcePosition.x - listenerPosition.x,
          sourcePosition.y - listenerPosition.y,
        ))
        requests ??= []
        for (
          let sequence = earlierSequence;
          sequence < bounceSoundSequence;
          sequence += 1
        ) {
          requests.push({
            cue,
            playbackRate: bounceSoundPitch,
            sourcePosition,
            volume,
          })
        }
      }
      if (retained) {
        retained.bounceSoundSequence = bounceSoundSequence
        retained.seenGeneration = generation
      } else {
        this.hailById.set(id, {
          bounceSoundSequence,
          seenGeneration: generation,
        })
      }
    }
    this.generation = generation
    this.pruneRetired(liveActorCount)
    return requests === undefined ? NO_ACTOR_SOUND_REQUESTS : Object.freeze(requests)
  }

  clear(): void {
    this.generation = 0
    this.hailById.clear()
    this.listenerWorldKey = null
  }

  reset(
    current: PrimarySpellSimulationFrameState,
    listenerWorldKey: string,
  ): void {
    this.clear()
    this.generation = 1
    this.listenerWorldKey = listenerWorldKey
    const rows = current.hail.rows
    for (let index = 0; index < rows.length; index += 1) {
      if (current.hail.worldKeys[rows.worldKeyIndexes[index]!] !== listenerWorldKey) continue
      this.hailById.set(rows.ids[index]!, {
        bounceSoundSequence: rows.bounceSoundSequences[index]!,
        seenGeneration: this.generation,
      })
    }
  }

  private pruneRetired(liveActorCount: number): void {
    if (liveActorCount === 0) {
      this.hailById.clear()
      return
    }
    if (this.hailById.size <= Math.max(64, liveActorCount * 2)) return
    for (const [id, retained] of this.hailById) {
      if (retained.seenGeneration !== this.generation) this.hailById.delete(id)
    }
  }
}

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
