import type { AuthoredBoneyardEnemyRecipe } from './boneyard-enemy-config-model.ts'
import { NATIVE_SURVIVAL_BOSS_RECIPE_SOURCES, NATIVE_SURVIVAL_BOSS_SOURCES } from './native-survival-boss-catalog.ts'

export function nativeDiscorporealRecipe(sourceSha256: string): AuthoredBoneyardEnemyRecipe {
  const source = NATIVE_SURVIVAL_BOSS_SOURCES.find(row => row.sourceSha256 === sourceSha256)
  if (!source) throw new Error(`default Boneyard ${sourceSha256} has no extracted Discorporeal`)
  const native = NATIVE_SURVIVAL_BOSS_RECIPE_SOURCES['The Discorporeal']
  return {
    archerAccuracyMode: 0, attackSpeed: native.attackSpeed, chaseSpeed: native.chaseSpeed,
    classification: 'boss', experienceBonus: native.xpBonus,
    extraDamage: native.extraDamage,
    family: { kind: 'demon-skull', capabilities: Number(native.shield) | Number(native.shieldOthers) << 1
      | Number(native.unknown96) << 2 | Number(native.burning) << 3 },
    lootPolicies: native.lootPolicies, maximumHealth: native.maxHp,
    movementScale: native.moveSpeedScale, name: 'The Discorporeal', onDeathProgram: null,
    primaryDamage: native.primaryDamage, secondaryDamage: native.secondaryDamage,
    tertiaryDamage: native.tertiaryDamage, uid: source.recipeUids['The Discorporeal'],
  }
}
