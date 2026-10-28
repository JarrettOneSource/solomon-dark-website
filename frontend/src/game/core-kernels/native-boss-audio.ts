// Stock SoundStream registry and WAV frame counts; RE ledger 301.
export const NATIVE_BOSS_STREAM_TICKS = {
  trap: 136,
  'unholy-die': 600,
  'unholy-scream': 275,
  'faculty-die': 533,
  'faculty-no': 175,
  'faculty-no-female': 345,
  'heart-break': 894,
  'faculty-join-us-1': 362,
  'faculty-join-us-1-female': 416,
  'faculty-join-us-2': 374,
  'faculty-join-us-2-female': 347,
  'faculty-dead-is-better-1': 468,
  'faculty-dead-is-better-1-female': 393,
  'faculty-dead-is-better-2': 390,
  'faculty-dead-is-better-2-female': 505,
} as const

export type NativeBossStreamCue = keyof typeof NATIVE_BOSS_STREAM_TICKS
export const NATIVE_BOSS_STREAM_CUES = Object.keys(NATIVE_BOSS_STREAM_TICKS) as NativeBossStreamCue[]

export const NATIVE_FACULTY_VOICE_CUES = [
  'faculty-join-us-1', 'faculty-join-us-1-female', 'faculty-join-us-2', 'faculty-join-us-2-female',
  'faculty-dead-is-better-1', 'faculty-dead-is-better-1-female',
  'faculty-dead-is-better-2', 'faculty-dead-is-better-2-female',
] as const satisfies readonly NativeBossStreamCue[]
export type NativeFacultyVoiceCue = typeof NATIVE_FACULTY_VOICE_CUES[number]

export interface NativeBossNarration {
  readonly current: Readonly<{ cue: NativeFacultyVoiceCue; eventId: number; startedTick: number }> | null
  readonly idleTicks: number
  readonly mix: number
  readonly nextEventId: number
  readonly pending: readonly NativeFacultyVoiceCue[]
  readonly ticksRemaining: number
}

export function createNativeBossNarration(): NativeBossNarration {
  return { current: null, idleTicks: 25, mix: 1, nextEventId: 1, pending: [], ticksRemaining: 0 }
}

export function stepNativeBossNarration(source: NativeBossNarration, tick: number, externalBusy: boolean): NativeBossNarration {
  let state = source
  if (state.current !== null) {
    state = { ...state, ticksRemaining: state.ticksRemaining - 1 }
    if (state.ticksRemaining <= 0) state = { ...state, current: null, ticksRemaining: 0 }
  } else if (state.idleTicks < 25) state = { ...state, idleTicks: state.idleTicks + 1 }
  state = enqueueNativeBossNarration(state, [], tick, externalBusy)
  const target = state.current !== null || state.idleTicks < 25 ? .5 : 1
  const mix = state.mix > target ? Math.max(target, Math.fround(state.mix - .02500000037252903))
    : Math.min(target, Math.fround(state.mix + .02500000037252903))
  return mix === state.mix ? state : { ...state, mix }
}

export function enqueueNativeBossNarration(source: NativeBossNarration, cues: readonly NativeFacultyVoiceCue[],
  tick: number, externalBusy: boolean): NativeBossNarration {
  const pending = [...source.pending, ...cues]
  if (source.current !== null || externalBusy || pending.length === 0) {
    return cues.length === 0 ? source : { ...source, pending }
  }
  const cue = pending[0]!
  return { ...source, current: { cue, eventId: source.nextEventId, startedTick: tick },
    idleTicks: 0, nextEventId: source.nextEventId + 1, pending: pending.slice(1),
    ticksRemaining: NATIVE_BOSS_STREAM_TICKS[cue] }
}

export function cancelNativeBossNarration(source: NativeBossNarration): NativeBossNarration {
  return { ...source, current: null, pending: [], ticksRemaining: 0 }
}
