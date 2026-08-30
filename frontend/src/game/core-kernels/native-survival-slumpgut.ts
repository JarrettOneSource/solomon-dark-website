import type { AuthoredBoneyardEnemyRecipe } from './boneyard-enemy-config.ts'
import type {
  BoneyardSpawnLocationPolicy,
  BoneyardSpawnPositionPolicy,
} from './boneyard-wave-timeline.ts'

export const NATIVE_SLUMPGUT_TRIGGER: Readonly<{
  intervalTicks: number
  pollPeriodTicks: number
  scriptSleepTicks: number
  spawnLocationPolicy: BoneyardSpawnLocationPolicy
  spawnPositionPolicy: BoneyardSpawnPositionPolicy
  zombieCountThreshold: number
}> = Object.freeze({
  intervalTicks: 1_000,
  pollPeriodTicks: 4,
  scriptSleepTicks: 1_500,
  spawnLocationPolicy: 'anywhere',
  spawnPositionPolicy: 'light',
  zombieCountThreshold: 75,
})

export const NATIVE_SLUMPGUT_RECIPE_SOURCE = Object.freeze({
  archetype: 'Slumpgut',
  attackSpeed: 1,
  auraMode: 0,
  behaviorCount: 1,
  behaviorMax: 0,
  behaviorMin: 0,
  behaviorTimer: 0,
  burning: false,
  castMode: 0,
  chaseSpeed: 1,
  dropGold: 4,
  dropItems: 4,
  dropOrbs: 4,
  dropPotions: 4,
  dropPowerups: 4,
  dropSpecificItems: 0,
  enemyType: 1006,
  extraDamage: 10,
  flanking: false,
  headgearMode: 0,
  hasLinkedUid: true,
  maxHp: 1_575,
  moveSpeedScale: 1,
  name: 'Slumpgut',
  pathfindingMode: 2,
  primaryDamage: 35,
  projectileMode: 0,
  randomVariant: 0,
  rect98: Object.freeze([1, 1, 1, 1] as const),
  rectA8: Object.freeze([1, 1, 1, 1] as const),
  secondaryDamage: 10,
  shield: true,
  shieldOthers: false,
  specialSpawnMode: 1,
  tertiaryDamage: 15,
  unknown81: 0,
  unknown82: 0,
  unknown96: false,
  variantMode: 0,
  xpBonus: -196.875,
})

const RECIPE_UID_BY_SOURCE_SHA256: Readonly<Record<string, number>> = Object.freeze({
  '1be4c308ccd442d70060cc66e3daa7b073faf035fd92d6b49fad4c33a91ef0c1': 37_391,
  '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f': 36_805,
  '506200e6f89dd26150c7fcc76f5cddfdb321412657ac979ea5924b567b4a2933': 37_465,
  '624b79ae325daa714b24017e0a308c64519f7481eb206e4489968217b1a2e123': 37_386,
  '8c2f97d2ed54431987e3cb54b7ae3c1098bf1c4517f59ade6aea57759187adb0': 37_317,
  '9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9': 36_808,
  'bd3c38468481b7337b1e7382e5503cc214356906571763a68188b23e821e73fb': 35_004,
  'bec9377cf539bb193e8af6ad72fa78a5e47e44206a1fef4d6bf3bfbda3f04a08': 36_822,
  'cd4d1ba948ca6624fffb967b02b7c93a6d00cbf9b5ec2c4541330b0616a1c239': 37_355,
  'e62e5e847562d822382fba14709d5367c9cd7de40f8b4fa52ecea3bfc8d9a430': 37_377,
  'ec2b27a1415c944c233158da8c21324760cd896e1228143aa18d262f65fa2a45': 37_377,
  'efa240ce741df0f781228206d024bb1903c7210d1163eccf80c87e835365422f': 37_329,
})

export function nativeSlumpgutRecipe(sourceSha256: string): AuthoredBoneyardEnemyRecipe {
  const uid = RECIPE_UID_BY_SOURCE_SHA256[sourceSha256]
  if (uid === undefined || uid <= 0) {
    throw new Error(`default Boneyard ${sourceSha256} has no extracted Slumpgut recipe`)
  }
  return nativeSlumpgutRecipeForUid(uid)
}

export function nativeSlumpgutRecipeForUid(uid: number): AuthoredBoneyardEnemyRecipe {
  if (!Number.isSafeInteger(uid) || uid <= 0) {
    throw new RangeError('Slumpgut recipe uid must be a positive safe integer')
  }
  return Object.freeze({
    archerAccuracyMode: 0,
    attackSpeed: NATIVE_SLUMPGUT_RECIPE_SOURCE.attackSpeed,
    chaseSpeed: NATIVE_SLUMPGUT_RECIPE_SOURCE.chaseSpeed,
    classification: 'boss',
    experience: (
      NATIVE_SLUMPGUT_RECIPE_SOURCE.xpBonus
      + NATIVE_SLUMPGUT_RECIPE_SOURCE.maxHp
    ) * 2,
    extraDamage: NATIVE_SLUMPGUT_RECIPE_SOURCE.extraDamage,
    family: Object.freeze({
      bodyType: 1,
      flyblown: NATIVE_SLUMPGUT_RECIPE_SOURCE.shield,
      kind: 'zombie' as const,
      poisonDuration: NATIVE_SLUMPGUT_RECIPE_SOURCE.extraDamage,
      poisonPoolDamage: NATIVE_SLUMPGUT_RECIPE_SOURCE.tertiaryDamage,
      poisonPunchDamage: NATIVE_SLUMPGUT_RECIPE_SOURCE.secondaryDamage,
    }),
    lootPolicies: Object.freeze({
      gold: NATIVE_SLUMPGUT_RECIPE_SOURCE.dropGold,
      item: NATIVE_SLUMPGUT_RECIPE_SOURCE.dropItems,
      orb: NATIVE_SLUMPGUT_RECIPE_SOURCE.dropOrbs,
      potion: NATIVE_SLUMPGUT_RECIPE_SOURCE.dropPotions,
      powerup: NATIVE_SLUMPGUT_RECIPE_SOURCE.dropPowerups,
      specificItem: NATIVE_SLUMPGUT_RECIPE_SOURCE.dropSpecificItems,
    }),
    maximumHealth: NATIVE_SLUMPGUT_RECIPE_SOURCE.maxHp,
    movementScale: NATIVE_SLUMPGUT_RECIPE_SOURCE.moveSpeedScale,
    name: NATIVE_SLUMPGUT_RECIPE_SOURCE.name,
    onDeathProgram: 'miniboss-die',
    primaryDamage: NATIVE_SLUMPGUT_RECIPE_SOURCE.primaryDamage,
    secondaryDamage: NATIVE_SLUMPGUT_RECIPE_SOURCE.secondaryDamage,
    tertiaryDamage: NATIVE_SLUMPGUT_RECIPE_SOURCE.tertiaryDamage,
    uid,
  })
}
