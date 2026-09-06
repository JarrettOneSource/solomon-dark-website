import { nativeEighteenWayFacingBucket } from '../core-kernels/boneyard-mage-lightning.ts'
import type {
  NativeEnemyAtlas,
  NativeEnemyFamily,
  NativeEnemyFamilyPresentation,
  NativeEnemySpriteLayer,
  NativeEnemyVisualSnapshot,
} from './native-enemy-presentation-model.ts'

export const EMPTY_FAMILY_PRESENTATION: NativeEnemyFamilyPresentation = Object.freeze({
  after: Object.freeze([]),
  before: Object.freeze([]),
  body: Object.freeze([]),
  hitBody: Object.freeze([]),
  segments: Object.freeze([]),
})

export function nativeEnemyFacingBucket(
  family: NativeEnemyFamily,
  headingDeg: number,
): number {
  if (family === 'COFFIN' || family === 'PORTAL') return 0
  if (!Number.isFinite(headingDeg)) throw new Error('native facing value must be finite')
  if (family === 'IMP') {
    return positiveModulo(Math.trunc((headingDeg + 15) / 30), 12)
  }
  return nativeEighteenWayFacingBucket(headingDeg)
}

export function normalizeEnemyFlag(flag: string): string {
  return flag.toUpperCase().replace(/^FLAG_/, '')
}

export function hasEnemyFlag(flags: readonly string[], requested: string): boolean {
  for (const flag of flags) {
    if (normalizeEnemyFlag(flag) === requested) return true
  }
  return false
}

export function presentation(
  body: readonly NativeEnemySpriteLayer[],
  options: Partial<Pick<
    NativeEnemyFamilyPresentation,
    'after' | 'before' | 'hitBody' | 'segments'
  >> = {},
): NativeEnemyFamilyPresentation {
  return {
    after: options.after ?? [],
    before: options.before ?? [],
    body,
    hitBody: options.hitBody ?? body,
    segments: options.segments ?? [],
  }
}

export function rotatePoint(
  point: Readonly<{ x: number; y: number }>,
  rotationRadians: number,
): Readonly<{ x: number; y: number }> {
  const cosine = Math.cos(rotationRadians)
  const sine = Math.sin(rotationRadians)
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  }
}

export function layer(
  atlas: NativeEnemyAtlas,
  entry: number,
  role: string,
  options: Partial<Pick<
    NativeEnemySpriteLayer,
    | 'alpha'
    | 'applyVerticalOffset'
    | 'blendMode'
    | 'offset'
    | 'rotationRadians'
    | 'scale'
    | 'scaleX'
    | 'scaleY'
    | 'stretch'
    | 'tint'
  >> = {},
): NativeEnemySpriteLayer {
  const result: NativeEnemySpriteLayer = {
    alpha: options.alpha ?? 1,
    atlas,
    blendMode: options.blendMode ?? 'normal',
    entry,
    offset: options.offset ?? { x: 0, y: 0 },
    role,
    rotationRadians: options.rotationRadians ?? 0,
    scale: options.scale ?? 1,
    tint: options.tint ?? 0xffffff,
  }
  if (options.applyVerticalOffset !== undefined) {
    result.applyVerticalOffset = options.applyVerticalOffset
  }
  if (options.scaleX !== undefined) result.scaleX = options.scaleX
  if (options.scaleY !== undefined) result.scaleY = options.scaleY
  if (options.stretch !== undefined) result.stretch = options.stretch
  return result
}

export function normalizedFlags(flags: readonly string[]): Set<string> {
  return new Set(flags.map((flag) => flag.toUpperCase().replace(/^FLAG_/, '')))
}

export function selectedFlagValue<T extends number>(
  flags: readonly string[],
  values: ReadonlyMap<string, T>,
  fallback: T | 0,
): T | 0 {
  let selected: T | 0 = fallback
  for (const source of flags) {
    const value = values.get(source.toUpperCase().replace(/^FLAG_/, ''))
    if (value !== undefined) selected = value
  }
  return selected
}

export function visualChoice(
  enemy: NativeEnemyVisualSnapshot,
  channel: number,
  count: number,
): number {
  let value = (
    (enemy.id >>> 0)
    ^ Math.imul((Math.floor(enemy.spawnTick) + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul(channel + 1, 0x85ebca6b)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value = (value ^ (value >>> 16)) >>> 0
  return value % count
}

export function stableUnit(
  enemy: NativeEnemyVisualSnapshot,
  channel: number,
  epoch = 0,
): number {
  let value = (
    (enemy.id >>> 0)
    ^ Math.imul((Math.floor(enemy.spawnTick) + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul((channel + 1) >>> 0, 0x85ebca6b)
    ^ Math.imul((epoch + 1) >>> 0, 0xc2b2ae35)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value = (value ^ (value >>> 16)) >>> 0
  return value / 0x1_0000_0000
}

export function stableInclusiveUnit(
  enemy: NativeEnemyVisualSnapshot,
  channel: number,
  epoch = 0,
): number {
  let value = (
    (enemy.id >>> 0)
    ^ Math.imul((Math.floor(enemy.spawnTick) + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul((channel + 1) >>> 0, 0x85ebca6b)
    ^ Math.imul((epoch + 1) >>> 0, 0xc2b2ae35)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value = (value ^ (value >>> 16)) >>> 0
  return value / 0xffff_ffff
}

export function stableInteger(
  enemy: NativeEnemyVisualSnapshot,
  epoch: number,
  count: number,
  channel: number,
): number {
  return Math.floor(stableUnit(enemy, channel, epoch) * count)
}

export function boundedPose(value: number, maximum: number): number {
  return Math.min(maximum, Math.max(0, Math.floor(finiteOrZero(value))))
}

export function bankPose(value: number, count: number): number | null {
  const pose = Math.floor(finiteOrZero(value))
  return pose >= 0 && pose < count ? pose : null
}

export function boundedUnit(value: number): number {
  return Math.min(1, Math.max(0, finiteOrZero(value)))
}

export function packRgb(red: number, green: number, blue: number): number {
  const channel = (value: number) => Math.round(boundedUnit(value) * 255)
  return (channel(red) << 16) | (channel(green) << 8) | channel(blue)
}

export function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function requiredPoint(
  points: readonly Readonly<{ x: number; y: number }>[],
  index: number,
  owner: string,
): Readonly<{ x: number; y: number }> {
  const point = points[index]
  if (!point) throw new Error(`${owner} is missing authored point ${index}`)
  return point
}
