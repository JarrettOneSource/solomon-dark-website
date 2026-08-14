export type NativeEnemyAnimationState = 'idle' | 'locomotion' | 'action' | 'death'

export type NativeEnemyActionProgramName =
  | 'skeleton-claw-a'
  | 'skeleton-claw-b'
  | 'skeleton-weapon'
  | 'skeleton-pike'
  | 'archer-shot'
  | 'mage-cast-short'
  | 'mage-cast-long'
  | 'imp-contact'
  | 'zombie-swipe'
  | 'wraith-drain'
  | 'demon-claw'
  | 'demon-bomb'
  | 'coffin-open'
  | 'maggot-bite'

export type NativeEnemyAnimationProvenance = 'native-exact' | 'bounded-web'

export type NativeEnemyDeathProgramName =
  | 'skeleton-shatter'
  | 'archer-shatter'
  | 'mage-shatter'
  | 'imp-split'
  | 'zombie-collapse'
  | 'wraith-dissolve'
  | 'demon-split'
  | 'coffin-break'

export interface NativeEnemyDeathProgram {
  readonly bodyRemovedAtTick: number | null
  readonly durationTicks: number
  readonly name: NativeEnemyDeathProgramName
  readonly provenance: 'bounded-web'
}

export interface NativeEnemyActionProgram {
  readonly eventMarkers: readonly number[]
  readonly frames: readonly number[]
  readonly name: NativeEnemyActionProgramName
  /** Multiplied by the listed authoritative simulation factors each fixed tick. */
  readonly progressPerTick: number
  readonly provenance: NativeEnemyAnimationProvenance
  readonly rateFactors: readonly (
    'attack-speed' | 'marker-multiplier' | 'one-plus-cast-roll'
  )[]
  /** The native completion comparison is strict: progress > strictEnd. */
  readonly strictEnd: number
}

export interface NativeEnemyActionFrame {
  complete: boolean
  eventMarkersReached: readonly number[]
  frameIndex: number
  program: NativeEnemyActionProgram
  selector: number
}

export type NativeEnemyCoffinState =
  | 'hidden'
  | 'closed'
  | 'opening'
  | 'transition-delay'
  | 'open'

export interface NativeEnemyMaggotSample {
  alpha: number
  headingDeg: number
  id: number
  offset: Readonly<{ x: number; y: number }>
  pose: number
  rotationRadians: number
  state: 'crawl' | 'bite' | 'death'
}

export type NativeEnemySampleAtlas = 'BadGuys' | 'DeadHawg' | 'Demon'

export interface NativeEnemyEffectSample {
  alpha: number
  atlas: NativeEnemySampleAtlas
  blendMode: 'add' | 'normal'
  entry: number
  id: number
  offset: Readonly<{ x: number; y: number }>
  role: string
  rotationRadians: number
  scale: number
}

/**
 * Renderer-owned input sampled from the authoritative simulation clock.
 *
 * The renderer may map selectors to stock records, but it must not advance this
 * state, reconstruct action time from render frames, or infer death from actor
 * disappearance.
 */
export interface NativeEnemyAnimationSample {
  action: NativeEnemyActionProgramName | null
  actionProgress: number
  alpha: number
  bodyPose: number
  coffinPose: number
  coffinSecondaryPose: number | null
  coffinState: NativeEnemyCoffinState
  deathEpoch: number
  deathTick: number
  demonFrontJointRotationRadians: number
  demonFrontLimbRotationRadians: number
  demonRearJointRotationRadians: number
  demonRearLimbRotationRadians: number
  effects: readonly NativeEnemyEffectSample[]
  gaitPose: number
  hitFlash: number
  impEffectFrame: number
  maggots: readonly NativeEnemyMaggotSample[]
  state: NativeEnemyAnimationState
  verticalOffset: number
  zombieAngularOffsetDeg: number
  zombieFrontArmPose: number
  zombieFrontArmRotationRadians: number
  zombieRearArmPose: number
  zombieRearArmRotationRadians: number
}

const repeated = (selector: number, count: number): number[] => (
  Array.from({ length: count }, () => selector)
)

export const NATIVE_ENEMY_ACTION_PROGRAMS: Readonly<
  Record<NativeEnemyActionProgramName, NativeEnemyActionProgram>
> = {
  'skeleton-claw-a': exactProgram(
    'skeleton-claw-a',
    [4, 5, 6, 7, 8, 9, 10, 11],
    [4, 8],
    7,
    0.125,
    ['attack-speed', 'marker-multiplier'],
  ),
  'skeleton-claw-b': exactProgram(
    'skeleton-claw-b',
    [2, 3, 4, 5, 6, 7, 8, 9],
    [4, 8],
    7,
    0.125,
    ['attack-speed', 'marker-multiplier'],
  ),
  'skeleton-weapon': exactProgram(
    'skeleton-weapon',
    [
      ...repeated(1, 8),
      2,
      ...repeated(3, 8),
      ...repeated(2, 4),
      ...repeated(1, 4),
    ],
    [9, 20],
    24,
    0.25,
    ['attack-speed', 'marker-multiplier'],
  ),
  'skeleton-pike': exactProgram(
    'skeleton-pike',
    [1, ...repeated(2, 11), 1],
    [2],
    12,
    0.125,
    ['attack-speed', 'marker-multiplier'],
  ),
  'archer-shot': exactProgram(
    'archer-shot',
    [3, 4, 5, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 8, 8, 8, 8],
    [13],
    16,
    0.0843750015,
    ['attack-speed'],
  ),
  'mage-cast-short': exactProgram(
    'mage-cast-short',
    [...repeated(2, 24), 3, ...repeated(4, 13), 3, ...repeated(0, 3)],
    [25],
    41,
    0.253125012,
    ['one-plus-cast-roll', 'attack-speed'],
  ),
  'mage-cast-long': exactProgram(
    'mage-cast-long',
    [...repeated(2, 30), 3, ...repeated(4, 13), 3, ...repeated(0, 3)],
    [31],
    47,
    0.253125012,
    ['one-plus-cast-roll', 'attack-speed'],
  ),
  'imp-contact': boundedProgram(
    'imp-contact',
    [0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 1, 0],
    [6],
  ),
  'zombie-swipe': boundedProgram(
    'zombie-swipe',
    [0, 0, 1, 1, 2, 2, 2, 1, 1, 0],
    [5],
  ),
  'wraith-drain': boundedProgram(
    'wraith-drain',
    [0, 0, 1, 1, 2, 2, 1, 1, 0, 0],
    [4],
  ),
  'demon-claw': boundedProgram(
    'demon-claw',
    [0, 0, 1, 1, 2, 2, 3, 3, 2, 1, 0],
    [6],
  ),
  'demon-bomb': boundedProgram(
    'demon-bomb',
    [0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0],
    [6],
  ),
  'coffin-open': boundedProgram(
    'coffin-open',
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    [10],
  ),
  'maggot-bite': boundedProgram(
    'maggot-bite',
    [0, 0, 1, 1, 1, 0],
    [3],
  ),
}

/**
 * Named renderer bounds for native death cadences whose exact clocks remain
 * unresolved. Skeleton-family body removal at tick zero is native-confirmed;
 * the replacement-effect durations are still deliberately marked bounded.
 */
export const NATIVE_ENEMY_DEATH_PROGRAMS = {
  SKELETON: deathProgram('skeleton-shatter', 24, 0),
  SKELETONARCHER: deathProgram('archer-shatter', 24, 0),
  SKELETONMAGE: deathProgram('mage-shatter', 24, 0),
  IMP: deathProgram('imp-split', 19, null),
  ZOMBIE: deathProgram('zombie-collapse', 36, null),
  WRAITH: deathProgram('wraith-dissolve', 36, null),
  DEMON: deathProgram('demon-split', 49, null),
  COFFIN: deathProgram('coffin-break', 31, null),
} as const satisfies Readonly<Record<string, NativeEnemyDeathProgram>>

export function nativeEnemyActionFrame(
  name: NativeEnemyActionProgramName,
  progress: number,
): NativeEnemyActionFrame {
  if (!Number.isFinite(progress) || progress < 0) {
    throw new Error('native enemy action progress must be finite and non-negative')
  }
  const program = NATIVE_ENEMY_ACTION_PROGRAMS[name]
  const frameIndex = Math.min(Math.floor(progress), program.frames.length - 1)
  return {
    complete: progress > program.strictEnd,
    eventMarkersReached: program.eventMarkers.filter((marker) => progress >= marker),
    frameIndex,
    program,
    selector: program.frames[frameIndex],
  }
}

export function nativeEnemyIdleAnimationSample(
  overrides: Partial<NativeEnemyAnimationSample> = {},
): NativeEnemyAnimationSample {
  return {
    action: null,
    actionProgress: 0,
    alpha: 1,
    bodyPose: 0,
    coffinPose: 0,
    coffinSecondaryPose: null,
    coffinState: 'closed',
    deathEpoch: 0,
    deathTick: 0,
    demonFrontJointRotationRadians: 0,
    demonFrontLimbRotationRadians: 0,
    demonRearJointRotationRadians: 0,
    demonRearLimbRotationRadians: 0,
    effects: [],
    gaitPose: 0,
    hitFlash: 0,
    impEffectFrame: -1,
    maggots: [],
    state: 'idle',
    verticalOffset: 0,
    zombieAngularOffsetDeg: 0,
    zombieFrontArmPose: 0,
    zombieFrontArmRotationRadians: 0,
    zombieRearArmPose: 0,
    zombieRearArmRotationRadians: 0,
    ...overrides,
  }
}

function exactProgram(
  name: NativeEnemyActionProgramName,
  frames: readonly number[],
  eventMarkers: readonly number[],
  strictEnd: number,
  progressPerTick: number,
  rateFactors: NativeEnemyActionProgram['rateFactors'],
): NativeEnemyActionProgram {
  return {
    eventMarkers,
    frames,
    name,
    progressPerTick,
    provenance: 'native-exact',
    rateFactors,
    strictEnd,
  }
}

function boundedProgram(
  name: NativeEnemyActionProgramName,
  frames: readonly number[],
  eventMarkers: readonly number[],
): NativeEnemyActionProgram {
  return {
    eventMarkers,
    frames,
    name,
    progressPerTick: 1,
    provenance: 'bounded-web',
    rateFactors: [],
    strictEnd: frames.length - 1,
  }
}

function deathProgram(
  name: NativeEnemyDeathProgramName,
  durationTicks: number,
  bodyRemovedAtTick: number | null,
): NativeEnemyDeathProgram {
  return {
    bodyRemovedAtTick,
    durationTicks,
    name,
    provenance: 'bounded-web',
  }
}
