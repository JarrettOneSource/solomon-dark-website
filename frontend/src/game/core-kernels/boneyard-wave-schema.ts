export const BONEYARD_WAVE_ENEMY_TYPES = {
  COFFIN: 1013,
  DEMON: 1009,
  IMP: 1004,
  SKELETON: 1001,
  SKELETONARCHER: 1002,
  SKELETONMAGE: 1003,
  WRAITH: 1007,
  ZOMBIE: 1006,
} as const

export type BoneyardWaveEnemyToken = keyof typeof BONEYARD_WAVE_ENEMY_TYPES

export const BONEYARD_WAVE_IGNORED_SOURCE_FLAGS = [
  'FLAG_IGNITE',
  'FLAG_IMMORTALIZE',
] as const

export interface WaveGroupEntry {
  enemy: string
  flags: string[]
}

export interface WaveGroup {
  entries: WaveGroupEntry[]
}

export interface WaveDef {
  /** Exact native spawn budget for the schedule row. */
  spawn: number
  /** Generator range sampled per consumed GROUP member, in fixed ticks. */
  spawnDelay: [number, number]
  /** Retained generator range; sampled but not used as a TimeLine lull. */
  waveDelay: [number, number]
  /** Parsed retail wave.txt field; the stock compiler does not consume it. */
  maxEnemies: number
  zombieWave?: boolean
  /** Candidate signed offsets relative to this schedule row. */
  next: number[]
  groups: WaveGroup[]
}
