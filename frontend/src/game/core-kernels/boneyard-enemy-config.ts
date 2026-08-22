import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardWaveEnemyToken,
} from './boneyard-wave-schema.ts'
import { BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS } from './boneyard-enemy-modifiers.ts'
import type { NativeEnemyPathfindingMode } from './native-enemy-pathfinding.ts'

export const BONEYARD_ENEMY_FLAGS = [
  'FLAG_HPUP',
  'FLAG_HPDOWN',
  'FLAG_STRONG',
  'FLAG_WEAK',
  'FLAG_FAST',
  'FLAG_SLOW',
  'FLAG_XPBONUS',
  'FLAG_BURNING',
  'FLAG_HELM',
  'FLAG_HORNED',
  'FLAG_HOODED',
  'FLAG_LEADING',
  'FLAG_SCATTERSHOT',
  'FLAG_RANGEUP',
  'FLAG_RANGEDOWN',
  'FLAG_RANGEEASY',
  'FLAG_SHIELD',
  'FLAG_SHIELDOTHERS',
  'FLAG_SHIELDSTRONG',
  'FLAG_SHIELDFAST',
  'FLAG_SPLIT',
  'FLAG_SPLITMANY',
  'FLAG_MANYMAGGOTS',
  'FLAG_STRONGMAGGOTS',
  'FLAG_POISONARROW',
  'FLAG_FIREARROW',
  'FLAG_ARMOR',
  'FLAG_SWORD',
  'FLAG_MACE',
  'FLAG_FLAIL',
  'FLAG_AXE',
  'FLAG_PIKE',
  'FLAG_CASTFIRE',
  'FLAG_CASTLIGHTNING',
  'FLAG_CASTFROST',
  'FLAG_CASTPOISON',
  'FLAG_ROTTEN',
  'FLAG_DEATHIMPS',
  'FLAG_DEATHIMPSMANY',
  'FLAG_ARMORMAYBE',
  'FLAG_NOSKELETONS',
  'FLAG_MORESKELETONS',
  'FLAG_RANDOMSHOT',
  'FLAG_IGNITE',
  'FLAG_IMMORTALIZE',
] as const

export type BoneyardEnemyFlag = typeof BONEYARD_ENEMY_FLAGS[number]

export interface BoneyardEnemyArenaScalars {
  attackSpeed: number
  chaseSpeed: number
  experience: number
  extraDamage: number
  health: number
  primaryDamage: number
  secondaryDamage: number
  tertiaryDamage: number
}

export interface BoneyardEnemyConfigRandom {
  /** Native constructor float in the inclusive 0..1 range. */
  baseSpeedUnit: number
  /** Native constructor float in the inclusive 0..1 range. */
  collisionRadiusUnit: number
  /** Native ARMORMAYBE byte selection. */
  randomArmor: boolean
  /** First native SPLITMANY inclusive three-way sample. */
  splitManyGateUnit: number
  /** Second native SPLITMANY inclusive three-way sample. */
  splitManyUnit: number
  /** Native SPLIT selection, represented as zero or one before adding one. */
  splitUnit: 0 | 1
}

export interface EvaluateBoneyardEnemyConfigOptions {
  arenaScalars?: Partial<BoneyardEnemyArenaScalars>
  /** Custom-authoring lane; retail wave data leaves this at zero. */
  archerExtraArrows?: number
  flags?: readonly string[]
  /** Native MonsterRecipe +0xB8; the constructor default is enabled. */
  flanking?: boolean
  /** Native MonsterRecipe selector; retail survival-wave data leaves it false. */
  mageCloak?: boolean
  /** Native MonsterRecipe +0xB9; the constructor default is mode 1. */
  pathfindingMode?: NativeEnemyPathfindingMode
  random?: Partial<BoneyardEnemyConfigRandom>
  waveOrdinal?: number
}

export type BoneyardSkeletonWeapon = 'axe' | 'claw' | 'flail' | 'mace' | 'pike' | 'sword'
export type BoneyardMageElement = 'fire' | 'frost' | 'lightning' | 'poison'
export type BoneyardArrowType = 'fire' | 'normal' | 'poison'

interface BoneyardEnemyConfigBase {
  attackSpeed: number
  baseSpeed: number
  burning: boolean
  chaseSpeed: number
  collisionRadius: number
  enemyToken: BoneyardWaveEnemyToken
  experience: number
  extraDamage: number
  flags: readonly BoneyardEnemyFlag[]
  flanking: boolean
  ignoredSourceFlags: readonly ('FLAG_IGNITE' | 'FLAG_IMMORTALIZE')[]
  maximumHealth: number
  nativeTypeId: number
  pathfindingMode: NativeEnemyPathfindingMode
  primaryDamage: number | null
  scale: number
  secondaryDamage: number
  skeletonPolicy: 'default' | 'more' | 'none'
  tertiaryDamage: number
}

export interface BoneyardSkeletonConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'SKELETON'
  family: Readonly<{
    armor: boolean
    headgear: 0 | 1 | 2 | 3
    weapon: BoneyardSkeletonWeapon
  }>
}

export interface BoneyardArcherConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'SKELETONARCHER'
  family: Readonly<{
    accuracyMode: 0 | 1 | 2 | 3
    arrowType: BoneyardArrowType
    extraArrows: number
    headgear: 0 | 1 | 2 | 3
    rangeMode: 0 | 1 | 2 | 3
  }>
}

export interface BoneyardMageConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'SKELETONMAGE'
  family: Readonly<{
    cloak: boolean
    element: BoneyardMageElement
    headgear: 0 | 1 | 2 | 3
    otherShield: boolean
    otherShieldHealth: number
    rangeMode: 0 | 1 | 2 | 3
    selfShield: boolean
    selfShieldHealth: number
    shieldInterval: number
  }>
}

export interface BoneyardImpConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'IMP'
  family: Readonly<{ splitDepth: number }>
}

export interface BoneyardZombieConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'ZOMBIE'
  family: Readonly<{
    bodyType: number
    poisonDuration: number
    poisonPoolDamage: number
    poisonPunchDamage: number
    rotten: boolean
  }>
}

export interface BoneyardWraithConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'WRAITH'
  family: Readonly<{ dazzle: true }>
}

export interface BoneyardDemonConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'DEMON'
  family: Readonly<{ splitCount: number }>
}

export interface BoneyardCoffinConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'COFFIN'
  family: Readonly<{
    maggotDamage: number
    maggotHealth: number
    maggotPoisonDamage: number
    maximumMaggots: number
  }>
}

export type EvaluatedBoneyardEnemyConfig =
  | BoneyardArcherConfig
  | BoneyardCoffinConfig
  | BoneyardDemonConfig
  | BoneyardImpConfig
  | BoneyardMageConfig
  | BoneyardSkeletonConfig
  | BoneyardWraithConfig
  | BoneyardZombieConfig

export const DEFAULT_BONEYARD_ENEMY_ARENA_SCALARS: Readonly<BoneyardEnemyArenaScalars> =
  Object.freeze({
    attackSpeed: 1,
    chaseSpeed: 1,
    experience: 1,
    extraDamage: 1,
    health: 1,
    primaryDamage: 1,
    secondaryDamage: 1,
    tertiaryDamage: 1,
  })

/** Wraith's inherited native radius remains open; this is the named web bound. */
export const BOUNDED_WRAITH_COLLISION_RADIUS = 20

const KNOWN_FLAGS = new Set<string>(BONEYARD_ENEMY_FLAGS)
const BASE_STATS: Readonly<Record<BoneyardWaveEnemyToken, Readonly<{
  chaseSpeed: number
  experience: number
  health: number
  primaryDamage: number | null
}>>> = Object.freeze({
  COFFIN: Object.freeze({ chaseSpeed: 1, experience: 200, health: 100, primaryDamage: null }),
  DEMON: Object.freeze({ chaseSpeed: 1, experience: 800, health: 400, primaryDamage: 20 }),
  IMP: Object.freeze({ chaseSpeed: 1, experience: 2, health: 1, primaryDamage: 3 }),
  SKELETON: Object.freeze({ chaseSpeed: 1, experience: 10, health: 5, primaryDamage: 3 }),
  SKELETONARCHER: Object.freeze({ chaseSpeed: 1, experience: 10, health: 5, primaryDamage: 4 }),
  SKELETONMAGE: Object.freeze({ chaseSpeed: 0.8, experience: 10, health: 5, primaryDamage: 3 }),
  WRAITH: Object.freeze({ chaseSpeed: 1, experience: 4, health: 2, primaryDamage: 4 }),
  ZOMBIE: Object.freeze({ chaseSpeed: 1, experience: 210, health: 105, primaryDamage: 35 }),
})

interface MutableConfig {
  armor: boolean
  attackSpeed: number
  burning: boolean
  chaseSpeed: number
  cloak: boolean
  experience: number
  extraDamage: number
  headgear: 0 | 1 | 2 | 3
  maximumHealth: number
  primaryDamage: number
  secondaryDamage: number
  skeletonPolicy: 'default' | 'more' | 'none'
  tertiaryDamage: number
  weapon: BoneyardSkeletonWeapon
  accuracyMode: 0 | 1 | 2 | 3
  arrowType: BoneyardArrowType
  extraArrows: number
  rangeMode: 0 | 1 | 2 | 3
  mageElement: BoneyardMageElement
  otherShield: boolean
  otherShieldHealth: number
  selfShield: boolean
  selfShieldHealth: number
  shieldInterval: number
  splitCount: number
  bodyType: number
  poisonDuration: number
  poisonPoolDamage: number
  poisonPunchDamage: number
  rotten: boolean
  maggotDamage: number
  maggotHealth: number
  maggotPoisonDamage: number
  maximumMaggots: number
}

export function evaluateBoneyardEnemyConfig(
  enemyToken: BoneyardWaveEnemyToken,
  options: EvaluateBoneyardEnemyConfigOptions = {},
): EvaluatedBoneyardEnemyConfig {
  const base = BASE_STATS[enemyToken]
  if (!base) throw new Error(`unknown Boneyard enemy token ${enemyToken}`)
  const flags = validateFlags(options.flags ?? [])
  const random = validatedRandom(options.random)
  const waveOrdinal = options.waveOrdinal ?? 0
  if (!Number.isSafeInteger(waveOrdinal) || waveOrdinal < 0) {
    throw new RangeError('enemy wave ordinal must be a non-negative safe integer')
  }
  const config: MutableConfig = {
    accuracyMode: 0,
    armor: false,
    arrowType: 'normal',
    attackSpeed: 1,
    bodyType: 0,
    burning: false,
    chaseSpeed: base.chaseSpeed,
    cloak: validatedMageCloak(enemyToken, options.mageCloak),
    experience: base.experience,
    extraArrows: validatedExtraArrows(enemyToken, options.archerExtraArrows),
    extraDamage: 0,
    headgear: 0,
    mageElement: 'fire',
    maggotDamage: 2,
    maggotHealth: 2,
    maggotPoisonDamage: 0,
    maximumHealth: base.health,
    maximumMaggots: 20,
    otherShield: false,
    otherShieldHealth: 0,
    poisonDuration: 0,
    poisonPoolDamage: 0,
    poisonPunchDamage: 0,
    primaryDamage: base.primaryDamage ?? 0,
    rangeMode: 0,
    rotten: false,
    secondaryDamage: 0,
    selfShield: false,
    selfShieldHealth: 0,
    shieldInterval: 0,
    skeletonPolicy: 'default',
    splitCount: 0,
    tertiaryDamage: 0,
    weapon: 'claw',
  }
  for (const flag of flags) applyFlag(config, flag, random, waveOrdinal)
  applyArenaScalars(config, validatedArenaScalars(options.arenaScalars))
  assertImplementedPayloads(config)

  const common = {
    attackSpeed: config.attackSpeed,
    baseSpeed: constructorBaseSpeed(enemyToken, random.baseSpeedUnit),
    burning: config.burning,
    chaseSpeed: config.chaseSpeed,
    collisionRadius: constructorCollisionRadius(enemyToken, random.collisionRadiusUnit),
    enemyToken,
    experience: config.experience,
    extraDamage: config.extraDamage,
    flags: Object.freeze([...flags]),
    flanking: options.flanking ?? true,
    ignoredSourceFlags: Object.freeze(flags.filter((flag): flag is 'FLAG_IGNITE' | 'FLAG_IMMORTALIZE' => (
      flag === 'FLAG_IGNITE' || flag === 'FLAG_IMMORTALIZE'
    ))),
    maximumHealth: config.maximumHealth,
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken],
    pathfindingMode: validatedPathfindingMode(options.pathfindingMode),
    primaryDamage: base.primaryDamage === null ? null : config.primaryDamage,
    scale: 1,
    secondaryDamage: config.secondaryDamage,
    skeletonPolicy: config.skeletonPolicy,
    tertiaryDamage: config.tertiaryDamage,
  }

  switch (enemyToken) {
    case 'SKELETON': return frozen({
      ...common,
      enemyToken,
      family: { armor: config.armor, headgear: config.headgear, weapon: config.weapon },
    })
    case 'SKELETONARCHER': return frozen({
      ...common,
      enemyToken,
      family: {
        accuracyMode: config.accuracyMode,
        arrowType: config.arrowType,
        extraArrows: config.extraArrows,
        headgear: config.headgear,
        rangeMode: config.rangeMode,
      },
    })
    case 'SKELETONMAGE': return frozen({
      ...common,
      enemyToken,
      family: {
        cloak: config.cloak,
        element: config.mageElement,
        headgear: config.headgear,
        otherShield: config.otherShield,
        otherShieldHealth: config.otherShieldHealth,
        rangeMode: config.rangeMode,
        selfShield: config.selfShield,
        selfShieldHealth: config.selfShieldHealth,
        shieldInterval: config.shieldInterval,
      },
    })
    case 'IMP': return frozen({ ...common, enemyToken, family: { splitDepth: config.splitCount } })
    case 'ZOMBIE': return frozen({
      ...common,
      enemyToken,
      family: {
        bodyType: config.bodyType,
        poisonDuration: config.poisonDuration,
        poisonPoolDamage: config.poisonPoolDamage,
        poisonPunchDamage: config.poisonPunchDamage,
        rotten: config.rotten,
      },
    })
    case 'WRAITH': return frozen({ ...common, enemyToken, family: { dazzle: true } })
    case 'DEMON': return frozen({ ...common, enemyToken, family: { splitCount: config.splitCount } })
    case 'COFFIN': return frozen({
      ...common,
      enemyToken,
      family: {
        maggotDamage: config.maggotDamage,
        maggotHealth: config.maggotHealth,
        maggotPoisonDamage: config.maggotPoisonDamage,
        maximumMaggots: config.maximumMaggots,
      },
    })
  }
}

function validatedPathfindingMode(
  mode: NativeEnemyPathfindingMode | undefined,
): NativeEnemyPathfindingMode {
  const value = mode ?? 1
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3) {
    throw new RangeError('enemy pathfinding mode must be 0, 1, 2, or 3')
  }
  return value
}

function validatedMageCloak(
  enemyToken: BoneyardWaveEnemyToken,
  value: boolean | undefined,
): boolean {
  if (value === undefined) return false
  if (enemyToken !== 'SKELETONMAGE') {
    throw new Error('mageCloak is only valid for SKELETONMAGE')
  }
  if (typeof value !== 'boolean') throw new TypeError('mageCloak must be boolean')
  return value
}

function validatedExtraArrows(
  enemyToken: BoneyardWaveEnemyToken,
  value: number | undefined,
): number {
  if (value === undefined) return 0
  if (enemyToken !== 'SKELETONARCHER') {
    throw new Error('extraArrows is only valid for SKELETONARCHER')
  }
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS
  ) {
    throw new RangeError(
      `extraArrows must be a safe integer within 0..${BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS}`,
    )
  }
  return value
}

function assertImplementedPayloads(config: MutableConfig): void {
  if (config.skeletonPolicy !== 'default') {
    throw new Error(`unsupported dormant skeleton policy ${config.skeletonPolicy}`)
  }
  if (config.tertiaryDamage !== 0 || config.extraDamage !== 0) {
    throw new Error('unsupported dormant tertiary/extra enemy damage payload')
  }
}

function applyFlag(
  config: MutableConfig,
  flag: BoneyardEnemyFlag,
  random: BoneyardEnemyConfigRandom,
  waveOrdinal: number,
): void {
  switch (flag) {
    case 'FLAG_HPUP': config.maximumHealth *= 1.5; break
    case 'FLAG_HPDOWN': config.maximumHealth *= 0.5; break
    case 'FLAG_STRONG': multiplyDamage(config, 1.5); break
    case 'FLAG_WEAK': multiplyDamage(config, 0.5); break
    case 'FLAG_FAST': config.chaseSpeed *= 1.25; break
    case 'FLAG_SLOW':
      config.chaseSpeed *= 0.5
      config.attackSpeed *= 0.5
      break
    case 'FLAG_XPBONUS': config.experience *= 2; break
    case 'FLAG_BURNING':
      config.burning = true
      config.chaseSpeed *= 1.5
      config.attackSpeed *= 1.5
      break
    case 'FLAG_HELM':
      config.headgear = 1
      config.maximumHealth += 6
      break
    case 'FLAG_HORNED':
      config.headgear = 2
      config.maximumHealth += 10
      break
    case 'FLAG_HOODED':
      config.headgear = 3
      config.maximumHealth += 3
      break
    case 'FLAG_LEADING': config.accuracyMode = 1; break
    case 'FLAG_SCATTERSHOT': config.accuracyMode = 2; break
    case 'FLAG_RANDOMSHOT': config.accuracyMode = 3; break
    case 'FLAG_RANGEUP': config.rangeMode = 2; break
    case 'FLAG_RANGEDOWN': config.rangeMode = 1; break
    case 'FLAG_RANGEEASY': config.rangeMode = 3; break
    case 'FLAG_SHIELD':
      config.selfShield = true
      config.selfShieldHealth = 50
      config.shieldInterval = 10
      break
    case 'FLAG_SHIELDOTHERS':
      config.otherShield = true
      config.otherShieldHealth = 50
      config.shieldInterval = 10
      break
    case 'FLAG_SHIELDSTRONG':
      config.selfShieldHealth *= 9
      config.otherShieldHealth *= 9
      break
    case 'FLAG_SHIELDFAST': config.shieldInterval *= 0.5; break
    case 'FLAG_SPLIT': config.splitCount = random.splitUnit + 1; break
    case 'FLAG_SPLITMANY':
      config.splitCount = nativeSplitManyDepth(waveOrdinal, random)
      break
    case 'FLAG_MANYMAGGOTS': config.maximumMaggots = 50; break
    case 'FLAG_STRONGMAGGOTS':
      config.maggotHealth = 5
      config.maggotDamage = 5
      break
    case 'FLAG_POISONARROW':
      config.arrowType = 'poison'
      config.secondaryDamage = config.primaryDamage * 3
      break
    case 'FLAG_FIREARROW':
      config.arrowType = 'fire'
      config.secondaryDamage = config.primaryDamage
      break
    case 'FLAG_ARMOR': applyArmor(config); break
    case 'FLAG_SWORD': applyWeapon(config, 'sword', 15, 10); break
    case 'FLAG_MACE': applyWeapon(config, 'mace', 25, 10); break
    case 'FLAG_FLAIL': applyWeapon(config, 'flail', 35, 10); break
    case 'FLAG_AXE': applyWeapon(config, 'axe', 18, 10); break
    case 'FLAG_PIKE': applyWeapon(config, 'pike', 25, 35); break
    case 'FLAG_CASTFIRE':
      config.mageElement = 'fire'
      config.primaryDamage *= 8
      break
    case 'FLAG_CASTLIGHTNING':
      config.mageElement = 'lightning'
      config.primaryDamage *= 4
      break
    case 'FLAG_CASTFROST':
      config.mageElement = 'frost'
      config.primaryDamage *= 2
      break
    case 'FLAG_CASTPOISON':
      config.mageElement = 'poison'
      config.primaryDamage *= 8
      break
    case 'FLAG_ROTTEN':
      config.rotten = true
      config.poisonPunchDamage = config.primaryDamage / 6
      config.poisonPoolDamage = config.primaryDamage / 5
      config.poisonDuration = 10
      break
    case 'FLAG_DEATHIMPS': config.splitCount = 5; break
    case 'FLAG_DEATHIMPSMANY': config.splitCount = 15; break
    case 'FLAG_ARMORMAYBE':
      if (random.randomArmor) applyArmor(config)
      break
    case 'FLAG_NOSKELETONS': config.skeletonPolicy = 'none'; break
    case 'FLAG_MORESKELETONS':
      config.skeletonPolicy = 'more'
      config.selfShield = false
      config.rotten = false
      break
    case 'FLAG_IGNITE':
    case 'FLAG_IMMORTALIZE':
      break
  }
}

function multiplyDamage(config: MutableConfig, multiplier: number): void {
  config.primaryDamage *= multiplier
  config.secondaryDamage *= multiplier
  config.tertiaryDamage *= multiplier
  config.extraDamage *= multiplier
}

function applyArmor(config: MutableConfig): void {
  config.armor = true
  config.maximumHealth = (config.maximumHealth + 10) * 2
}

function applyWeapon(
  config: MutableConfig,
  weapon: Exclude<BoneyardSkeletonWeapon, 'claw'>,
  damageAddition: number,
  healthAddition: number,
): void {
  config.weapon = weapon
  config.maximumHealth = (config.maximumHealth + healthAddition) * 2
  config.primaryDamage += damageAddition
}

function applyArenaScalars(
  config: MutableConfig,
  scalars: BoneyardEnemyArenaScalars,
): void {
  config.maximumHealth *= scalars.health
  config.primaryDamage *= scalars.primaryDamage
  config.secondaryDamage *= scalars.secondaryDamage
  config.tertiaryDamage *= scalars.tertiaryDamage
  config.extraDamage *= scalars.extraDamage
  config.chaseSpeed *= scalars.chaseSpeed
  config.attackSpeed *= scalars.attackSpeed
  config.experience *= scalars.experience
}

function constructorBaseSpeed(token: BoneyardWaveEnemyToken, unit: number): number {
  const skeleton = (1.25 + unit) * 1.25 ** 2
  switch (token) {
    case 'SKELETON': return skeleton
    case 'SKELETONARCHER': return skeleton * 0.75
    case 'SKELETONMAGE': return skeleton * 0.75 * 0.65
    case 'IMP': return 4.5
    case 'ZOMBIE': return 0.85
    case 'WRAITH': return 1
    case 'DEMON':
    case 'COFFIN': return 0.75
  }
}

function constructorCollisionRadius(token: BoneyardWaveEnemyToken, unit: number): number {
  switch (token) {
    case 'SKELETON': return 20 - unit * 8
    case 'SKELETONARCHER': return 20
    case 'SKELETONMAGE': return 25
    case 'IMP': return 10 - unit * 2.5
    case 'ZOMBIE': return 25 - unit * 8
    case 'WRAITH': return BOUNDED_WRAITH_COLLISION_RADIUS
    case 'DEMON': return 35
    case 'COFFIN': return 45
  }
}

function validateFlags(flags: readonly string[]): readonly BoneyardEnemyFlag[] {
  for (const flag of flags) {
    if (!KNOWN_FLAGS.has(flag)) throw new Error(`unknown Boneyard enemy flag ${flag}`)
  }
  return flags as readonly BoneyardEnemyFlag[]
}

function validatedRandom(
  source: Partial<BoneyardEnemyConfigRandom> | undefined,
): BoneyardEnemyConfigRandom {
  const random: BoneyardEnemyConfigRandom = {
    baseSpeedUnit: source?.baseSpeedUnit ?? 0,
    collisionRadiusUnit: source?.collisionRadiusUnit ?? 0,
    randomArmor: source?.randomArmor ?? false,
    splitManyGateUnit: source?.splitManyGateUnit ?? 0,
    splitManyUnit: source?.splitManyUnit ?? 0,
    splitUnit: source?.splitUnit ?? 0,
  }
  for (const [field, value] of [
    ['baseSpeedUnit', random.baseSpeedUnit],
    ['collisionRadiusUnit', random.collisionRadiusUnit],
    ['splitManyGateUnit', random.splitManyGateUnit],
    ['splitManyUnit', random.splitManyUnit],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${field} must be within 0..1`)
    }
  }
  return random
}

function nativeSplitManyDepth(
  waveOrdinal: number,
  random: BoneyardEnemyConfigRandom,
): number {
  const lower = Math.trunc((waveOrdinal - 25) / 5) + 1
  const gate = lower + inclusiveThreeWayIndex(random.splitManyGateUnit)
  return gate < 2
    ? 2
    : lower + inclusiveThreeWayIndex(random.splitManyUnit)
}

function inclusiveThreeWayIndex(unit: number): 0 | 1 | 2 {
  return Math.min(2, Math.floor(unit * 3)) as 0 | 1 | 2
}

function validatedArenaScalars(
  source: Partial<BoneyardEnemyArenaScalars> | undefined,
): BoneyardEnemyArenaScalars {
  const scalars = { ...DEFAULT_BONEYARD_ENEMY_ARENA_SCALARS, ...source }
  for (const [field, value] of Object.entries(scalars)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`enemy Arena scalar ${field} must be finite and non-negative`)
    }
  }
  return scalars
}

function frozen<T extends EvaluatedBoneyardEnemyConfig>(source: T): T {
  Object.freeze(source.family)
  return Object.freeze(source)
}
