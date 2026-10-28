import { NATIVE_SURVIVAL_BOSS_SOURCES } from './native-survival-boss-catalog.ts'

export type NativeBossEncounterKind = 'heartmonger' | 'faculty' | 'discorporeal'

export interface NativeBossEncounterState {
  readonly kind: NativeBossEncounterKind
  readonly phase: 'eligible' | 'boss-wait' | 'completion-delay' | 'completion' | 'retired'
  readonly skeletonsRemaining: number
  readonly sourceSha256: string
  readonly ticksRemaining: number
}

export function createNativeBossEncounter(sourceSha256: string, kind: NativeBossEncounterKind): NativeBossEncounterState {
  if (!NATIVE_SURVIVAL_BOSS_SOURCES.some((row) => row.sourceSha256 === sourceSha256)) {
    throw new Error(`default Boneyard ${sourceSha256} has no extracted bosses`)
  }
  return { kind, phase: 'eligible', skeletonsRemaining: 0, sourceSha256, ticksRemaining: 0 }
}

export function nativeBossEncounterTimelinePaused(state: NativeBossEncounterState | null): boolean {
  return state !== null && state.phase !== 'eligible' && state.phase !== 'retired'
}

export function stepNativeBossEncounter(
  source: NativeBossEncounterState,
  waveOrdinal: number,
  liveBossCount: number,
): {
  birth: 'boss' | 'skeleton' | null
  releaseWave: boolean
  state: NativeBossEncounterState
} {
  const program = NATIVE_SURVIVAL_BOSS_SOURCES.find((row) => row.sourceSha256 === source.sourceSha256)![source.kind]
  if (source.phase === 'eligible') {
    return waveOrdinal !== program.waveOrdinal
      ? { birth: null, releaseWave: false, state: source }
      : { birth: 'boss', releaseWave: false, state: {
          ...source, phase: 'boss-wait', skeletonsRemaining: program.completionSkeletons, ticksRemaining: 100,
        } }
  }
  if (source.phase === 'retired') return { birth: null, releaseWave: false, state: source }
  if (source.ticksRemaining > 1) {
    return { birth: null, releaseWave: false, state: { ...source, ticksRemaining: source.ticksRemaining - 1 } }
  }
  if (source.phase === 'boss-wait') {
    return { birth: null, releaseWave: false, state: {
      ...source,
      phase: liveBossCount > 0 ? 'boss-wait' : 'completion-delay',
      ticksRemaining: liveBossCount > 0 ? 200 : 500,
    } }
  }
  if (source.phase === 'completion-delay') {
    return { birth: null, releaseWave: false, state: { ...source, phase: 'completion', ticksRemaining: 75 } }
  }
  const skeletonsRemaining = source.skeletonsRemaining - 1
  return { birth: 'skeleton', releaseWave: skeletonsRemaining === 0, state: {
    ...source, phase: skeletonsRemaining === 0 ? 'retired' : 'completion',
    skeletonsRemaining, ticksRemaining: skeletonsRemaining === 0 ? 0 : 75,
  } }
}
