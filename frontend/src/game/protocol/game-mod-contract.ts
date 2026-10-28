import type { ModSpriteFrame } from '../core-kernels/hub-economy.ts'

export interface GameModAsset {
  byteLength: number
  contentType: string
  kind: string
  modId: string
  path: string
  sha256: string
}

export const MOD_CONTENT_KINDS = [
  'affix',
  'affix-pool',
  'boneyard',
  'boast',
  'enemy',
  'item',
  'potion',
  'powerup',
  'room',
  'scene',
  'scene-extension',
  'shop',
  'skill',
  'spell',
  'status',
  'ui',
] as const

export type ModContentKind = typeof MOD_CONTENT_KINDS[number]

export interface ModContentProjectionEntry {
  readonly art: readonly Readonly<{
    path: string
    slot: string
  }>[]
  readonly contentId: string
  readonly contentKind: ModContentKind
  readonly description: string
  readonly key: string
  readonly modId: string
  readonly name: string
  readonly presentation: string | null
}

export interface ModStatusProjectionEntry {
  readonly contentId: string
  readonly expiresTick: number
  readonly instanceId: number
  readonly startedTick: number
  readonly targetId: string
}

export interface ModPowerupProjectionEntry {
  readonly contentId: string
  readonly id: number
  readonly spawnedTick: number
  readonly x: number
  readonly y: number
}

export type ModBoastIconProjection =
  | Readonly<{
      frame: ModSpriteFrame
      imageHeight: number
      imagePath: string
      imageWidth: number
      kind: 'mod'
    }>
  | Readonly<{
      kind: 'stock'
      record: number
      style: number
    }>

export interface ModBoastProjectionEntry {
  readonly contentId: string
  readonly failureProducers: readonly string[]
  readonly icon: ModBoastIconProjection
  readonly instruction: string
  readonly modId: string
  readonly name: string
  readonly randomSkillChoices: boolean
  readonly response: string
  readonly scoreMultiplier: number
  readonly statement: string
  readonly successWave: number
}

export interface ModContentProjection {
  readonly boasts: readonly ModBoastProjectionEntry[]
  readonly content: readonly ModContentProjectionEntry[]
  readonly manifestSha256: string
  readonly powerups: readonly ModPowerupProjectionEntry[]
  readonly revision: number
  readonly statuses: readonly ModStatusProjectionEntry[]
}
