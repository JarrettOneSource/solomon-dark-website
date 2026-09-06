import {
  BONEYARD_ENEMY_FLAGS,
} from './boneyard-enemy-config.ts'
import type { BoneyardWaveEnemyToken } from './boneyard-wave-schema.ts'
import type { NativeEnemyPathfindingMode } from './native-enemy-pathfinding.ts'
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

export type BoneyardEnemyClassification = 'boss' | 'miniboss' | 'multiple-boss' | 'normal'

export type AuthoredBoneyardEnemyFamilyRecipe =
  | Readonly<{ kind: 'default' }>
  | Readonly<{ frequency: NativePortalFrequency; kind: 'portal' }>
  | Readonly<{
      bodyType: 0 | 1
      flyblown: boolean
      kind: 'zombie'
      poisonDuration: number
      poisonPoolDamage: number
      poisonPunchDamage: number
    }>

export type BoneyardSkeletonWeapon = 'axe' | 'claw' | 'flail' | 'mace' | 'pike' | 'sword'

export type BoneyardMageElement = 'fire' | 'frost' | 'lightning' | 'poison'

export type BoneyardArrowType = 'fire' | 'normal' | 'poison'

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
    multiArrowMode: 0 | 1 | 2 | 3
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

export interface BoneyardSpiderConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'SPIDER'
  family: Readonly<{ cocoonHealth: number; spitWebs: boolean; suckDamagePerSecond: number }>
}

export interface BoneyardCocoonConfig extends BoneyardEnemyConfigBase {
  enemyToken: 'COCOON'
  family: Readonly<{ kind: 'cocoon' }>
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

export type EvaluatedBoneyardEnemyConfig =
  | BoneyardCocoonConfig
  | BoneyardSpiderConfig
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
  armor: boolean
  attackSpeed: number
  burning: boolean
  chaseSpeed: number
  cloak: boolean
  experienceBonus: number
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
  multiArrowMode: 0 | 1 | 2 | 3
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
  portalFrequency: NativePortalFrequency
  rotten: boolean
  maggotDamage: number
  maggotHealth: number
  maggotPoisonDamage: number
  maximumMaggots: number
}
