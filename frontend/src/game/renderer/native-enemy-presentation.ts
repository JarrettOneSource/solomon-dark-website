import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'

export const NATIVE_ENEMY_FAMILIES = [
  'SKELETON',
  'SKELETONARCHER',
  'SKELETONMAGE',
  'IMP',
  'ZOMBIE',
  'WRAITH',
  'DEMON',
  'COFFIN',
] as const

export type NativeEnemyFamily = typeof NATIVE_ENEMY_FAMILIES[number]
export type NativeEnemyAtlas = 'BadGuys' | 'Demon'

export interface NativeEnemyVisualSnapshot {
  enemyToken: NativeEnemyFamily
  flags: readonly string[]
  headingDeg: number
  id: number
  nativeTypeId: number
  position: Readonly<{ x: number; y: number }>
  spawnTick: number
}

export interface NativeEnemySpriteLayer {
  alpha: number
  atlas: NativeEnemyAtlas
  entry: number
  offset: Readonly<{ x: number; y: number }>
  role: string
  rotationRadians: number
  scale: number
}

export interface NativeEnemyPresentationPlan {
  facing: number
  family: NativeEnemyFamily
  layers: readonly NativeEnemySpriteLayer[]
  spawnAgeTicks: number
}

const HEADGEAR_BASES = [1477, 1531, 1549, 1495] as const
const WEAPON_BY_FLAG = new Map([
  ['SWORD', 1],
  ['MACE', 2],
  ['FLAIL', 3],
  ['AXE', 4],
  ['PIKE', 5],
] as const)
const HEADGEAR_BY_FLAG = new Map([
  ['HELM', 1],
  ['HORNED', 2],
  ['HOODED', 3],
] as const)

export function roundHalfToEven(value: number): number {
  if (!Number.isFinite(value)) throw new Error('native facing value must be finite')
  const integer = Math.trunc(value)
  const fraction = value - integer
  const distance = Math.abs(fraction)
  if (distance < 0.5) return integer
  const direction = Math.sign(fraction)
  if (distance > 0.5) return integer + direction
  return Math.abs(integer % 2) === 0 ? integer : integer + direction
}

export function nativeEnemyFacingBucket(
  family: NativeEnemyFamily,
  headingDeg: number,
): number {
  if (family === 'COFFIN') return 0
  if (family === 'IMP') {
    return positiveModulo(roundHalfToEven((headingDeg + 15) / 30), 12)
  }
  if (isNativeEnemyFamily(family)) {
    return positiveModulo(roundHalfToEven((headingDeg + 10) / 20), 18)
  }
  throw new Error(`unsupported native enemy family ${String(family)}`)
}

export function nativeEnemyPresentationPlan(
  enemy: NativeEnemyVisualSnapshot,
  tick: number,
): NativeEnemyPresentationPlan {
  const family = enemy.enemyToken
  if (!isNativeEnemyFamily(family)) {
    throw new Error(`unsupported native enemy family ${String(family)}`)
  }
  const facing = nativeEnemyFacingBucket(family, enemy.headingDeg)
  const flags = normalizedFlags(enemy.flags)
  const spawnAgeTicks = Math.max(0, tick - enemy.spawnTick)
  const layers = familyLayers(enemy, facing, flags, spawnAgeTicks)
  return {
    facing,
    family,
    layers,
    spawnAgeTicks,
  }
}

export function nativeEnemyPainterLayer(
  enemy: NativeEnemyVisualSnapshot,
  sourceOrder: number,
): DynamicPainterLayer {
  return {
    id: `enemy:${enemy.id}`,
    sortBias: 0,
    sourceOrder,
    worldY: enemy.position.y,
  }
}

function familyLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
  spawnAgeTicks: number,
): NativeEnemySpriteLayer[] {
  switch (enemy.enemyToken) {
    case 'SKELETON': return skeletonLayers(enemy, facing, flags)
    case 'SKELETONARCHER': return skeletonArcherLayers(facing, flags)
    case 'SKELETONMAGE': return skeletonMageLayers(facing, flags)
    case 'IMP': return impLayers(enemy, facing)
    case 'ZOMBIE': return zombieLayers(enemy, facing, flags)
    case 'WRAITH': return [layer('BadGuys', 2070 + facing, 'wraith-body', {
      offset: { x: 0, y: 15 },
      scale: 2,
    })]
    case 'DEMON': return demonLayers(facing)
    case 'COFFIN': return coffinSpawnLayers(enemy, spawnAgeTicks)
  }
}

function skeletonLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
): NativeEnemySpriteLayer[] {
  const weapon = selectedFlagValue(enemy.flags, WEAPON_BY_FLAG, 0)
  const headgear = selectedFlagValue(enemy.flags, HEADGEAR_BY_FLAG, 0)
  const armored = flags.has('ARMOR') || (
    flags.has('ARMORMAYBE') && visualChoice(enemy, 0, 2) === 1
  )
  const bodyBase = armored
    ? weapon === 0 ? 613 : weapon === 5 ? 991 : 919
    : weapon === 0 ? 1117 : weapon === 5 ? 1405 : 1333
  const result = [
    layer('BadGuys', 1585 + facing, 'skeleton-limbs'),
    layer('BadGuys', bodyBase + facing, 'skeleton-body'),
  ]
  const weaponBase = weapon === 1
    ? 1045
    : weapon === 2 || weapon === 3
      ? 847
      : weapon === 4
        ? 775
        : null
  if (weaponBase !== null) {
    result.push(layer('BadGuys', weaponBase + facing, 'skeleton-weapon'))
  }
  result.push(layer(
    'BadGuys',
    HEADGEAR_BASES[headgear] + facing,
    'skeleton-headgear',
    { offset: { x: 0, y: -4 } },
  ))
  return result
}

function skeletonArcherLayers(
  facing: number,
  sourceFlags: ReadonlySet<string>,
): NativeEnemySpriteLayer[] {
  const flags = [...sourceFlags]
  const headgear = selectedFlagValue(flags, HEADGEAR_BY_FLAG, 0)
  return [
    layer('BadGuys', 1585 + facing, 'archer-limbs'),
    layer('BadGuys', 451 + facing, 'archer-body'),
    layer('BadGuys', HEADGEAR_BASES[headgear] + facing, 'archer-headgear', {
      offset: { x: 0, y: -4 },
    }),
  ]
}

function skeletonMageLayers(
  facing: number,
  sourceFlags: ReadonlySet<string>,
): NativeEnemySpriteLayer[] {
  const flags = [...sourceFlags]
  const headgear = selectedFlagValue(flags, HEADGEAR_BY_FLAG, 0)
  return [
    layer('BadGuys', 1585 + facing, 'mage-limbs'),
    layer('BadGuys', 1729 + facing, 'mage-body'),
    layer('BadGuys', HEADGEAR_BASES[headgear] + facing, 'mage-headgear', {
      offset: { x: 0, y: -4 },
    }),
  ]
}

function impLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
): NativeEnemySpriteLayer[] {
  const variant = visualChoice(enemy, 1, 4)
  const upperFrame = visualChoice(enemy, 2, 10)
  return [
    layer('BadGuys', 285 + variant * 12 + facing, 'imp-body'),
    layer('BadGuys', 333 + upperFrame, 'imp-upper-effect', {
      alpha: 0,
      offset: { x: 0, y: -10 },
    }),
  ]
}

function zombieLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
): NativeEnemySpriteLayer[] {
  const bodyType = visualChoice(enemy, 3, 3)
  const headRoll = visualChoice(enemy, 4, 8)
  const headType = headRoll < 6 ? 0 : headRoll - 5
  const flyblownSide = flags.has('ROTTEN') ? visualChoice(enemy, 5, 2) : -1
  return [
    layer('BadGuys', 2365 + facing, 'zombie-base'),
    layer('BadGuys', 2203 + bodyType * 18 + facing, 'zombie-body'),
    layer('BadGuys', 2095 + (flyblownSide === 0 ? 18 : 0) + facing, 'zombie-arm-rear'),
    layer('BadGuys', 2149 + (flyblownSide === 1 ? 18 : 0) + facing, 'zombie-arm-front'),
    layer('BadGuys', 2293 + headType * 18 + facing, 'zombie-head'),
  ]
}

function demonLayers(facing: number): NativeEnemySpriteLayer[] {
  return [
    layer('Demon', 62 + facing, 'demon-rear-limb'),
    layer('Demon', 98 + facing, 'demon-rear-joint'),
    layer('Demon', 19 + facing, 'demon-controller-body'),
    layer('Demon', 1 + facing, 'demon-front-limb'),
    layer('Demon', 80 + facing, 'demon-front-joint'),
  ]
}

function coffinSpawnLayers(
  enemy: NativeEnemyVisualSnapshot,
  spawnAgeTicks: number,
): NativeEnemySpriteLayer[] {
  const waitTicks = visualChoice(enemy, 4, 2) === 0 ? 180 : 360
  if (spawnAgeTicks < waitTicks) return []
  const materializeAge = spawnAgeTicks - waitTicks
  const firstRiseTicks = 10
  const holdTicks = 150 + visualChoice(enemy, 5, 150)
  let stateFrame: number
  if (materializeAge <= firstRiseTicks) {
    stateFrame = roundHalfToEven(Math.min(3, materializeAge * 0.3))
  } else if (materializeAge <= firstRiseTicks + holdTicks) {
    stateFrame = 3
  } else {
    const finalRiseAge = materializeAge - firstRiseTicks - holdTicks
    stateFrame = roundHalfToEven(Math.min(12, 3 + finalRiseAge * 0.2))
  }
  return [layer('BadGuys', 175 + stateFrame, 'coffin-materializing')]
}

function layer(
  atlas: NativeEnemyAtlas,
  entry: number,
  role: string,
  options: Partial<Pick<
    NativeEnemySpriteLayer,
    'alpha' | 'offset' | 'rotationRadians' | 'scale'
  >> = {},
): NativeEnemySpriteLayer {
  return {
    alpha: options.alpha ?? 1,
    atlas,
    entry,
    offset: options.offset ?? { x: 0, y: 0 },
    role,
    rotationRadians: options.rotationRadians ?? 0,
    scale: options.scale ?? 1,
  }
}

function normalizedFlags(flags: readonly string[]): Set<string> {
  return new Set(flags.map((flag) => flag.toUpperCase().replace(/^FLAG_/, '')))
}

function selectedFlagValue<T extends number>(
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

function visualChoice(
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

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function isNativeEnemyFamily(value: string): value is NativeEnemyFamily {
  return (NATIVE_ENEMY_FAMILIES as readonly string[]).includes(value)
}
