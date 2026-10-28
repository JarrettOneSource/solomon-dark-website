import type { AuthoredBoneyardEnemyRecipe, BoneyardEnemyArenaScalars, BoneyardEnemyConfigRandom, BoneyardEnemyFlag, EvaluateBoneyardEnemyConfigOptions, EvaluatedBoneyardEnemyConfig, MutableConfig } from './boneyard-enemy-config-model.ts'
import { applyFlag } from './boneyard-enemy-flags.ts'
import { BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS } from './boneyard-enemy-modifiers.ts'
import { applyAuthoredFamily, validatedAuthoredRecipe } from './boneyard-enemy-recipes.ts'
import type { BoneyardWaveEnemyToken } from './boneyard-wave-schema.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from './boneyard-wave-schema.ts'
import type { NativeEnemyPathfindingMode } from './native-enemy-pathfinding.ts'
import { nativeDesaturateColor } from './native-color.ts'
import type { NativeLootPolicies } from './native-loot.ts'
import { NATIVE_WRAITH_COLLISION_RADIUS } from './native-wraith-flight.ts'
export type {
  AuthoredBoneyardEnemyFamilyRecipe,AuthoredBoneyardEnemyRecipe,BoneyardArcherConfig,BoneyardArrowType,BoneyardCoffinConfig,BoneyardDemonConfig,BoneyardEnemyArenaScalars,BoneyardEnemyClassification,BoneyardEnemyConfigRandom,BoneyardEnemyFlag,BoneyardFacultyConfig,BoneyardFacultyFamily,BoneyardHeartmongerConfig,BoneyardImpConfig,BoneyardMageConfig,BoneyardMageElement,BoneyardPortalConfig,BoneyardSkeletonConfig,BoneyardSkeletonHeadgear,
  BoneyardSkeletonWeapon,BoneyardWraithConfig,BoneyardZombieConfig,EvaluateBoneyardEnemyConfigOptions,EvaluatedBoneyardEnemyConfig,
  MutableConfig
} from './boneyard-enemy-config-model.ts'










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
  'FLAG_COCOON',
  'FLAG_NOSPIT',
] as const

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

const KNOWN_FLAGS = new Set<string>(BONEYARD_ENEMY_FLAGS)

const BASE_STATS: Readonly<Record<BoneyardWaveEnemyToken, Readonly<{
  chaseSpeed: number
  health: number
  primaryDamage: number | null
}>>> = Object.freeze({
  COFFIN: Object.freeze({ chaseSpeed: 1, health: 100, primaryDamage: null }),
  COCOON: Object.freeze({ chaseSpeed: 1, health: 999_999, primaryDamage: null }),
  DEMON: Object.freeze({ chaseSpeed: 1, health: 400, primaryDamage: 20 }),
  IMP: Object.freeze({ chaseSpeed: 1, health: 1, primaryDamage: 3 }),
  PORTAL: Object.freeze({ chaseSpeed: 1, health: 1, primaryDamage: 2 }),
  SKELETON: Object.freeze({ chaseSpeed: 1, health: 5, primaryDamage: 3 }),
  SKELETONARCHER: Object.freeze({ chaseSpeed: 1, health: 5, primaryDamage: 4 }),
  SKELETONMAGE: Object.freeze({ chaseSpeed: 0.8, health: 5, primaryDamage: 3 }),
  SPIDER: Object.freeze({ chaseSpeed: 1, health: 15, primaryDamage: 8 }),
  WRAITH: Object.freeze({ chaseSpeed: 1, health: 2, primaryDamage: 4 }),
  ZOMBIE: Object.freeze({ chaseSpeed: 1, health: 105, primaryDamage: 35 }),
  DIREFACULTY: Object.freeze({ chaseSpeed: 1, health: 8, primaryDamage: 25 }),
  HEARTMONGER: Object.freeze({ chaseSpeed: 1, health: 8, primaryDamage: 25 }),
  DEMONSKULL: Object.freeze({ chaseSpeed: .5, health: 50, primaryDamage: 25 }),
})

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
    spitWebs: true,
    demonSkullCapabilities: 0,
    faculty: { bodyColor: nativeDesaturateColor([1, .5, 0, 1], Math.fround(.6)),
      female: false, headColor: [1, 1, 1, 1], headgear: 0, primary: 0, secondary: 0 },
    blindMode: 2,
    crowCount: 1,
    summonMode: 0,
    accuracyMode: 0,
    armor: false,
    arrowType: 'normal',
    attackSpeed: 1,
    bodyType: validatedZombieBodyType(enemyToken, options.zombieBodyType),
    burning: false,
    chaseSpeed: base.chaseSpeed,
    cloak: validatedMageCloak(enemyToken, options.mageCloak),
    experienceBonus: 0,
    extraArrows: validatedExtraArrows(enemyToken, options.archerExtraArrows),
    extraDamage: enemyToken === 'DEMONSKULL' ? 2 : 0,
    headgear: 0,
    mageElement: 'fire',
    maggotDamage: 2,
    maggotHealth: 2,
    maggotPoisonDamage: 0,
    maximumHealth: base.health,
    maximumMaggots: 20,
    multiArrowMode: validatedArcherMultiArrowMode(
      enemyToken,
      options.archerMultiArrowMode,
    ),
    otherShield: false,
    otherShieldHealth: 0,
    poisonDuration: 0,
    poisonPoolDamage: 0,
    poisonPunchDamage: 0,
    portalFrequency: 0,
    primaryDamage: base.primaryDamage ?? 0,
    rangeMode: 0,
    rotten: false,
    secondaryDamage: enemyToken === 'SPIDER' || enemyToken === 'DEMONSKULL' ? 10 : 0,
    selfShield: false,
    selfShieldHealth: 0,
    shieldInterval: 0,
    skeletonPolicy: 'default',
    splitCount: 0,
    strafing: validatedArcherStrafing(enemyToken, options.archerStrafing),
    tertiaryDamage: enemyToken === 'SPIDER' ? 2 : enemyToken === 'DEMONSKULL' ? 6 : 0,
    weapon: 'claw',
  }
  const authoredRecipe = validatedAuthoredRecipe(enemyToken, options.authoredRecipe)
  if (authoredRecipe) {
    config.accuracyMode = authoredRecipe.archerAccuracyMode
    config.attackSpeed = authoredRecipe.attackSpeed
    config.chaseSpeed = authoredRecipe.chaseSpeed
    config.experienceBonus = authoredRecipe.experienceBonus
    config.extraDamage = authoredRecipe.extraDamage
    config.maximumHealth = authoredRecipe.maximumHealth
    config.primaryDamage = authoredRecipe.primaryDamage
    config.secondaryDamage = authoredRecipe.secondaryDamage
    config.tertiaryDamage = authoredRecipe.tertiaryDamage
    applyAuthoredFamily(config, authoredRecipe.family)
  }
  for (const flag of flags) applyFlag(config, flag, random, waveOrdinal)
  applyArenaScalars(config, validatedArenaScalars(options.arenaScalars))
  assertImplementedPayloads(config, enemyToken, authoredRecipe)

  const common = {
    attackSpeed: config.attackSpeed,
    baseSpeed: constructorBaseSpeed(enemyToken, random.baseSpeedUnit),
    burning: config.burning,
    chaseSpeed: config.chaseSpeed,
    classification: authoredRecipe?.classification ?? 'normal',
    collisionRadius: constructorCollisionRadius(enemyToken, random.collisionRadiusUnit),
    enemyToken,
    experience: enemyToken === 'COCOON' ? 0 : Math.fround(
      (config.maximumHealth + config.experienceBonus) * 0.8500000238418579,
    ),
    extraDamage: config.extraDamage,
    flags: Object.freeze([...flags]),
    flanking: options.flanking ?? true,
    ignoredSourceFlags: Object.freeze(flags.filter((flag): flag is 'FLAG_IGNITE' | 'FLAG_IMMORTALIZE' => (
      flag === 'FLAG_IGNITE' || flag === 'FLAG_IMMORTALIZE'
    ))),
    maximumHealth: config.maximumHealth,
    nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken],
    onDeathProgram: authoredRecipe?.onDeathProgram ?? null,
    pathfindingMode: validatedPathfindingMode(options.pathfindingMode),
    primaryDamage: base.primaryDamage === null ? null : config.primaryDamage,
    recipeName: authoredRecipe?.name ?? null,
    recipeUid: authoredRecipe?.uid ?? null,
    lootPolicies: authoredRecipe?.lootPolicies ?? DEFAULT_BONEYARD_ENEMY_LOOT_POLICIES,
    scale: authoredRecipe?.movementScale ?? 1,
    secondaryDamage: config.secondaryDamage,
    skeletonPolicy: config.skeletonPolicy,
    tertiaryDamage: config.tertiaryDamage,
  }

  switch (enemyToken) {
    case 'COCOON': return frozen({ ...common, enemyToken, family: { kind: 'cocoon' } })
    case 'SPIDER': return frozen({
      ...common,
      enemyToken,
      family: {
        cocoonHealth: config.secondaryDamage,
        spitWebs: config.spitWebs,
        suckDamagePerSecond: config.tertiaryDamage,
      },
    })
    case 'DEMONSKULL': return frozen({ ...common, enemyToken, family: { capabilities: config.demonSkullCapabilities } })
    case 'DIREFACULTY': return frozen({ ...common, enemyToken, family: config.faculty })
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
        multiArrowMode: config.multiArrowMode,
        rangeMode: config.rangeMode,
        strafing: config.strafing,
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
    case 'HEARTMONGER': return frozen({
      ...common, enemyToken,
      family: { crowCount: config.crowCount, blindMode: config.blindMode, summonMode: config.summonMode },
    })
    case 'IMP': return frozen({ ...common, enemyToken, family: { splitDepth: config.splitCount } })
    case 'PORTAL': return frozen({
      ...common,
      enemyToken,
      family: { frequency: config.portalFrequency },
    })
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

export const DEFAULT_BONEYARD_ENEMY_LOOT_POLICIES: NativeLootPolicies = Object.freeze({
  gold: 0,
  item: 0,
  orb: 0,
  potion: 0,
  powerup: 0,
  specificItem: 0,
})

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

function validatedArcherMultiArrowMode(
  enemyToken: BoneyardWaveEnemyToken,
  value: 0 | 1 | 2 | 3 | undefined,
): 0 | 1 | 2 | 3 {
  if (value === undefined) return 0
  if (enemyToken !== 'SKELETONARCHER') {
    throw new Error('multiArrowMode is only valid for SKELETONARCHER')
  }
  return value
}

function validatedArcherStrafing(
  enemyToken: BoneyardWaveEnemyToken,
  value: boolean | undefined,
): boolean {
  if (value === undefined) return false
  if (enemyToken !== 'SKELETONARCHER') throw new Error('strafing requires SKELETONARCHER')
  if (typeof value !== 'boolean') throw new TypeError('Archer strafing must be boolean')
  return value
}

function validatedZombieBodyType(
  enemyToken: BoneyardWaveEnemyToken,
  value: 0 | 1 | undefined,
): 0 | 3 {
  if (value === undefined || value === 0) return 0
  if (enemyToken !== 'ZOMBIE') {
    throw new Error('zombieBodyType is only valid for ZOMBIE')
  }
  if (value !== 1) throw new RangeError('zombieBodyType must be zero or one')
  return 3
}

function assertImplementedPayloads(
  config: MutableConfig,
  enemyToken: BoneyardWaveEnemyToken,
  authoredRecipe: AuthoredBoneyardEnemyRecipe | null,
): void {
  if (config.skeletonPolicy !== 'default') {
    throw new Error(`unsupported dormant skeleton policy ${config.skeletonPolicy}`)
  }
  const authoredZombie = enemyToken === 'ZOMBIE'
    && authoredRecipe?.family.kind === 'zombie'
  if (enemyToken === 'PORTAL' && authoredRecipe?.family.kind !== 'portal') {
    throw new Error('Portal requires an authored Portal recipe')
  }
  if (!authoredZombie && enemyToken !== 'SPIDER' && enemyToken !== 'DEMONSKULL' && (config.tertiaryDamage !== 0 || config.extraDamage !== 0)) {
    throw new Error('unsupported dormant tertiary/extra enemy damage payload')
  }
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
  config.experienceBonus *= scalars.experience
}

function constructorBaseSpeed(token: BoneyardWaveEnemyToken, unit: number): number {
  const skeleton = (1.25 + unit) * 1.25 ** 2
  switch (token) {
    case 'COCOON': return 1
    case 'SPIDER': return 3 + unit * 2
    case 'DEMONSKULL': return 4
    case 'DIREFACULTY': return 2.75
    case 'SKELETON': return skeleton
    case 'SKELETONARCHER': return skeleton * 0.75
    case 'SKELETONMAGE': return skeleton * 0.75 * 0.65
    case 'HEARTMONGER': return Math.fround(Math.fround(skeleton * .6499999761581421) * .75)
    case 'IMP': return 4.5
    case 'PORTAL': return 1
    case 'ZOMBIE': return 0.85
    case 'WRAITH': return 1
    case 'DEMON':
    case 'COFFIN': return 0.75
  }
}

function constructorCollisionRadius(token: BoneyardWaveEnemyToken, unit: number): number {
  switch (token) {
    case 'COCOON': return 40
    case 'SPIDER': return 15
    case 'DEMONSKULL': return 40
    case 'DIREFACULTY': return 25
    case 'SKELETON': return 20 - unit * 8
    case 'SKELETONARCHER': return 20
    case 'HEARTMONGER':
    case 'SKELETONMAGE': return 25
    case 'IMP': return 10 - unit * 2.5
    case 'PORTAL': return 5
    case 'ZOMBIE': return 25 - unit * 8
    case 'WRAITH': return NATIVE_WRAITH_COLLISION_RADIUS
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

export function inclusiveThreeWayIndex(unit: number): 0 | 1 | 2 {
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
