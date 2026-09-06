import type { AuthoredBoneyardEnemyRecipe } from './boneyard-enemy-config-model.ts'
import { BONEYARD_WAVE_DIRECTOR_PHASES, NATIVE_SLUMPGUT_PHASES } from './boneyard-wave-director.ts'
import type { BoneyardWaveEnemyToken, WaveDef } from './boneyard-wave-schema.ts'
import type { BoneyardCompiledSpawnBurst, BoneyardCompiledWaveSection, BoneyardSpawnLocationPolicy, BoneyardSpawnPositionPolicy } from './boneyard-wave-timeline.ts'
import type { BoneyardBounds, BoneyardPoint } from './boneyard.ts'
import type { NativeRngState } from './native-rng.ts'
import type { NativeSpiderWaveDefinition, NativeSpiderWaveState } from './native-spider-wave-program.ts'
import type { NativeBossEncounterState } from './native-survival-boss-encounter.ts'
import type { NativePortalProgramDefinition } from './native-survival-portal.ts'
import type { NativeSkeletonBossProgramState } from './native-survival-skeleton-bosses.ts'
export type BoneyardWaveDirectorPhase = typeof BONEYARD_WAVE_DIRECTOR_PHASES[number]

export type NativeSlumpgutPhase = typeof NATIVE_SLUMPGUT_PHASES[number]

export interface BoneyardEnemySpawnIntent {
  cocoonTargetPlayerId?: string
  greenImpSpitDamage?: number
  enableDiscorporealHealthGates?: boolean
  archerStrafing?: boolean
  authoredRecipe?: AuthoredBoneyardEnemyRecipe
  enemyToken: BoneyardWaveEnemyToken
  flags: readonly string[]
  /** Custom MonsterRecipe lane; defaults to the native enabled value. */
  flanking?: boolean
  id: number
  locationPolicy: BoneyardSpawnLocationPolicy
  /** Custom MonsterRecipe lane; omitted by the retail wave director. */
  mageCloak?: boolean
  /** Direct native Portal child construction payload. */
  portalEjection?: Readonly<{
    childHeadingDeg: number
    inheritedPrimaryDamage: number
    parentHeadingDeg: number
    parentPosition: Readonly<BoneyardPoint>
    verticalVelocity: number
  }>
  nativeTypeId: number
  /** Override for stationary or constructor-sized authored actors. */
  navigationClearance?: number
  /** Custom MonsterRecipe lane; defaults to native mode 1. */
  pathfindingMode?: 0 | 1 | 2 | 3
  /** One native UIDGroup call may reuse its first final placement. */
  placementGroupId?: number
  /** Constructor-sized placement body when it differs from the active body. */
  placementRadius?: number
  position: BoneyardPoint
  /** Non-TimeLine callers use direct placement when omitted. */
  positionPolicy?: BoneyardSpawnPositionPolicy
  /** Radius used to prove that the accepted component reaches a player. */
  reachabilityRadius?: number
  spawnTick: number
  waveOrdinal: number
  /** Custom MonsterSetup BODY TYPE lane; retail survival waves leave it zero. */
  zombieBodyType?: 0 | 1
}

export interface BoneyardWaveDirectorState {
  spiderState: NativeSpiderWaveState
  spiderWaves: readonly NativeSpiderWaveDefinition[]
  activeBurstIndex: number | null
  activeBursts: readonly BoneyardCompiledSpawnBurst[]
  activeGroupIndex: number | null
  activeGroupMemberIndex: number
  burstStarted: boolean
  burstSpawnRemaining: number
  burstSpreadTicksRemaining: number
  compiledSchedule: readonly BoneyardCompiledWaveSection[]
  bossEncounters: readonly NativeBossEncounterState[]
  interwaveDelayTicks: number
  lullThreshold: number
  lowPopulationTicks: number
  nextSpawnIntentId: number
  nextScheduleIndex: number | null
  openingBursts: readonly BoneyardCompiledSpawnBurst[]
  openingReleaseThreshold: number
  pendingSpawnBudget: number
  phase: BoneyardWaveDirectorPhase
  portalPhaseIndex: number
  portalProgram: NativePortalProgramDefinition | null
  portalScriptPhase: 'boss-wait' | 'idle' | 'intro' | 'retired' | 'spawning'
  portalSpawnRemaining: number
  portalTicksRemaining: number
  portalTimelinePaused: boolean
  populationThreshold: number
  rngState: NativeRngState
  schedule: readonly WaveDef[]
  scheduleIndex: number
  skeletonBosses: NativeSkeletonBossProgramState | null
  slumpgutPhase: NativeSlumpgutPhase
  slumpgutPollCursor: number
  slumpgutRecipeUid: number | null
  slumpgutTicksRemaining: number
  spawnCountdown: number
  spawnDelayTicks: number
  waveEventId: number
  waveOrdinal: number
}

export type BoneyardWavePlayers = Readonly<
  Record<string, { position: BoneyardPoint }>
>

export interface BoneyardWaveDirectorTickContext {
  bounds: BoneyardBounds
  liveBossCount?: number
  liveEnemyCount: number
  liveZombieCount: number
  players: BoneyardWavePlayers
  tick: number
}

export interface BoneyardWaveDirectorTickResult {
  director: BoneyardWaveDirectorState
  spawnIntents: readonly BoneyardEnemySpawnIntent[]
}
