import type { BONEYARD_ENEMY_FLAGS } from './boneyard-enemy-config.ts'
import type { BoneyardWaveEnemyToken } from './boneyard-wave-schema.ts'
import type { NativeEnemyPathfindingMode } from './native-enemy-pathfinding.ts'
import type { NativeFacultyAppearance } from './native-faculty.ts'
import type { NativeLootPolicies } from './native-loot.ts'
import type { NativeSurvivalOnDeathProgram } from './native-survival-miniboss.ts'
import type { NativePortalFrequency } from './native-survival-portal.ts'
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
  authoredRecipe?: AuthoredBoneyardEnemyRecipe
  /** Custom-authoring lane; retail wave data leaves this at zero. */
  archerExtraArrows?: number
  /** Native MonsterRecipe +0x88; retail wave data leaves this at zero. */
  archerMultiArrowMode?: 0 | 1 | 2 | 3
  /** Internal script modifier 48; this has no wave.txt token. */
  archerStrafing?: boolean
  flags?: readonly string[]
  /** Native MonsterRecipe +0xB8; the constructor default is enabled. */
  flanking?: boolean
  /** Native MonsterRecipe selector; retail survival-wave data leaves it false. */
  mageCloak?: boolean
  /** Native MonsterRecipe +0xB9; the constructor default is mode 1. */
  pathfindingMode?: NativeEnemyPathfindingMode
  random?: Partial<BoneyardEnemyConfigRandom>
  waveOrdinal?: number
  /** Native MonsterSetup BODY TYPE; value one selects Zombie body/head bank three. */
  zombieBodyType?: 0 | 1
}

export interface AuthoredBoneyardEnemyRecipe {
  readonly archerAccuracyMode: 0 | 1 | 2 | 3
  readonly attackSpeed: number
  readonly chaseSpeed: number
  readonly classification: BoneyardEnemyClassification
  readonly experienceBonus: number
  readonly extraDamage: number
  readonly family: AuthoredBoneyardEnemyFamilyRecipe
  readonly lootPolicies: NativeLootPolicies
  readonly maximumHealth: number
  readonly movementScale: number
  readonly name: string
  readonly onDeathProgram: NativeSurvivalOnDeathProgram | null
  readonly primaryDamage: number
  readonly secondaryDamage: number
  readonly tertiaryDamage: number
  readonly uid: number
}

export const BONEYARD_ENEMY_CLASSIFICATIONS = ['normal', 'boss', 'miniboss', 'multiple-boss'] as const
export type BoneyardEnemyClassification = typeof BONEYARD_ENEMY_CLASSIFICATIONS[number]

export type AuthoredBoneyardEnemyFamilyRecipe =
  | Readonly<{ kind: 'default' }>
  | Readonly<{ kind: 'demon-skull'; capabilities: number }>
  | Readonly<BoneyardFacultyFamily & { kind: 'faculty' }>
  | Readonly<{ kind: 'heartmonger'; crowCount: number; blindMode: 0 | 1 | 2 | 3 | 4; summonMode: 0 | 1 | 2 | 3 | 4 }>
  | Readonly<{
      armor: boolean
      headgear: BoneyardSkeletonHeadgear
      kind: 'skeleton'
      weapon: BoneyardSkeletonWeapon
    }>
  | Readonly<{
      arrowType: BoneyardArrowType
      extraArrows: number
      headgear: BoneyardSkeletonHeadgear
      kind: 'archer'
      multiArrowMode: 0 | 1 | 2 | 3
      rangeMode: 0 | 1 | 2 | 3
      strafing: boolean
    }>
  | Readonly<{ frequency: NativePortalFrequency; kind: 'portal' }>
  | Readonly<{
      bodyType: 0 | 1
      flyblown: boolean
      kind: 'zombie'
      poisonDuration: number
      poisonPoolDamage: number
      poisonPunchDamage: number
    }>

export type BoneyardSkeletonHeadgear = 0 | 1 | 2 | 3 | 4 | 5
export const BONEYARD_SKELETON_WEAPONS = ['claw', 'sword', 'mace', 'flail', 'axe', 'pike'] as const
export type BoneyardSkeletonWeapon = typeof BONEYARD_SKELETON_WEAPONS[number]

export const BONEYARD_MAGE_ELEMENTS = ['fire', 'lightning', 'frost', 'poison'] as const
export type BoneyardMageElement = typeof BONEYARD_MAGE_ELEMENTS[number]

export const BONEYARD_ARROW_TYPES = ['normal', 'fire', 'poison'] as const
export type BoneyardArrowType = typeof BONEYARD_ARROW_TYPES[number]

interface BoneyardEnemyConfigBase {
  attackSpeed: number
  baseSpeed: number
  burning: boolean
  chaseSpeed: number
  classification: BoneyardEnemyClassification
  collisionRadius: number
  enemyToken: BoneyardWaveEnemyToken
  experience: number
  extraDamage: number
  flags: readonly BoneyardEnemyFlag[]
  flanking: boolean
  ignoredSourceFlags: readonly ('FLAG_IGNITE' | 'FLAG_IMMORTALIZE')[]
  maximumHealth: number
  nativeTypeId: number
  onDeathProgram: NativeSurvivalOnDeathProgram | null
  pathfindingMode: NativeEnemyPathfindingMode
  primaryDamage: number | null
  recipeName: string | null
  recipeUid: number | null
  lootPolicies: NativeLootPolicies
  scale: number
  secondaryDamage: number
  skeletonPolicy: 'default' | 'more' | 'none'
  tertiaryDamage: number
}

export interface BoneyardSkeletonConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'SKELETON'
  family: Readonly<{
    armor: boolean
    headgear: BoneyardSkeletonHeadgear
    weapon: BoneyardSkeletonWeapon
  }>
}

export interface BoneyardArcherConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'SKELETONARCHER'
  family: Readonly<{
    accuracyMode: 0 | 1 | 2 | 3
    arrowType: BoneyardArrowType
    extraArrows: number
    headgear: BoneyardSkeletonHeadgear
    multiArrowMode: 0 | 1 | 2 | 3
    rangeMode: 0 | 1 | 2 | 3
    strafing: boolean
  }>
}

export interface BoneyardMageConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'SKELETONMAGE'
  family: Readonly<{
    cloak: boolean
    element: BoneyardMageElement
    headgear: BoneyardSkeletonHeadgear
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

export interface BoneyardPortalConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'PORTAL'
  family: Readonly<{ frequency: NativePortalFrequency }>
}

export interface BoneyardHeartmongerConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'HEARTMONGER'
  family: Readonly<{ crowCount: number; blindMode: 0 | 1 | 2 | 3 | 4; summonMode: 0 | 1 | 2 | 3 | 4 }>
}

export interface BoneyardFacultyFamily extends NativeFacultyAppearance {
  readonly headgear: BoneyardSkeletonHeadgear
  readonly primary: 0 | 1 | 2 | 3
  readonly secondary: 0 | 1 | 2 | 3
}

export interface BoneyardFacultyConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'DIREFACULTY'
  family: BoneyardFacultyFamily
}

export interface BoneyardDemonSkullConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'DEMONSKULL'
  family: Readonly<{ capabilities: number }>
}

export type EvaluatedBoneyardEnemyConfig =
  | BoneyardSpiderConfig
  | BoneyardCocoonConfig
  | BoneyardDemonSkullConfig
  | BoneyardFacultyConfig
  | BoneyardHeartmongerConfig
  | BoneyardArcherConfig
  | BoneyardCoffinConfig
  | BoneyardDemonConfig
  | BoneyardImpConfig
  | BoneyardMageConfig
  | BoneyardPortalConfig
  | BoneyardSkeletonConfig
  | BoneyardWraithConfig
  | BoneyardZombieConfig

export interface MutableConfig {
  spitWebs: boolean
  demonSkullCapabilities: number
  faculty: BoneyardFacultyFamily
  crowCount: number
  blindMode: 0 | 1 | 2 | 3 | 4
  summonMode: 0 | 1 | 2 | 3 | 4
  armor: boolean
  attackSpeed: number
  burning: boolean
  chaseSpeed: number
  cloak: boolean
  experienceBonus: number
  extraDamage: number
  headgear: BoneyardSkeletonHeadgear
  maximumHealth: number
  primaryDamage: number
  secondaryDamage: number
  skeletonPolicy: 'default' | 'more' | 'none'
  tertiaryDamage: number
  weapon: BoneyardSkeletonWeapon
  accuracyMode: 0 | 1 | 2 | 3
  arrowType: BoneyardArrowType
  extraArrows: number
  multiArrowMode: 0 | 1 | 2 | 3
  rangeMode: 0 | 1 | 2 | 3
  strafing: boolean
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
  portalFrequency: NativePortalFrequency
  rotten: boolean
  maggotDamage: number
  maggotHealth: number
  maggotPoisonDamage: number
  maximumMaggots: number
}

export interface BoneyardSpiderConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'SPIDER'
  family: Readonly<{ cocoonHealth: number; spitWebs: boolean; suckDamagePerSecond: number }>
}

export interface BoneyardCocoonConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'COCOON'
  family: Readonly<{ kind: 'cocoon' }>
}
