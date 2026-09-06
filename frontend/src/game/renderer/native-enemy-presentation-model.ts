import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import type {
  NativeEnemyActionFrame,
  NativeEnemyAnimationSample,
  NativeEnemySampleAtlas,
} from './native-enemy-animation.ts'

export const NATIVE_ENEMY_FAMILIES = [
  'SKELETON',
  'SKELETONARCHER',
  'SKELETONMAGE',
  'IMP',
  'PORTAL',
  'ZOMBIE',
  'WRAITH',
  'DEMON',
  'COFFIN',
  'SPIDER',
  'COCOON',
] as const

export type NativeEnemyFamily = typeof NATIVE_ENEMY_FAMILIES[number]

export type NativeEnemyAtlas = NativeEnemySampleAtlas

export interface NativeEnemyVisualSnapshot {
  animation?: NativeEnemyAnimationSample
  armored: boolean
  enemyToken: NativeEnemyFamily
  flags: readonly string[]
  headingDeg: number
  id: number
  lighting: Readonly<{ charge: number; glow: number; providerCopies: 0 | 1 | 2 }>
  mageCloak: boolean
  nativeTypeId: number
  lightRegistration: NativeWorldManagerRegistration
  position: Readonly<{ x: number; y: number }>
  scale: number
  shieldHealth: number
  shieldMaximumHealth: number
  spawnTick: number
}

export interface NativeEnemySpriteLayer {
  applyVerticalOffset?: boolean
  alpha: number
  atlas: NativeEnemyAtlas
  blendMode: 'add' | 'normal'
  entry: number
  offset: Readonly<{ x: number; y: number }>
  role: string
  rotationRadians: number
  scale: number
  scaleX?: number
  scaleY?: number
  stretch?: Readonly<{
    end: Readonly<{ x: number; y: number }>
    start: Readonly<{ x: number; y: number }>
  }>
  tint: number
}

export interface NativeEnemySegmentLayer {
  alpha: number
  end: Readonly<{ x: number; y: number }>
  role: string
  start: Readonly<{ x: number; y: number }>
  tint: number
  width: number
}

export interface NativeEnemyPresentationPlan {
  actionFrame: NativeEnemyActionFrame | null
  facing: number
  family: NativeEnemyFamily
  layers: readonly NativeEnemySpriteLayer[]
  segments: readonly NativeEnemySegmentLayer[]
  spawnAgeTicks: number
}

export type NativeEnemyAuthoredPointResolver = (
  atlas: NativeEnemyAtlas,
  entry: number,
) => readonly Readonly<{ x: number; y: number }>[]

export interface NativeEnemyFamilyPresentation {
  after: readonly NativeEnemySpriteLayer[]
  before: readonly NativeEnemySpriteLayer[]
  body: readonly NativeEnemySpriteLayer[]
  hitBody: readonly NativeEnemySpriteLayer[]
  segments: readonly NativeEnemySegmentLayer[]
}
