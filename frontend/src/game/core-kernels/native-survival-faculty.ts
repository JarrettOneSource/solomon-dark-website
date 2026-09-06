import type { AuthoredBoneyardEnemyRecipe } from './boneyard-enemy-config-model.ts'
import { NATIVE_SURVIVAL_BOSS_RECIPE_SOURCES, NATIVE_SURVIVAL_BOSS_SOURCES } from './native-survival-boss-catalog.ts'

export type NativeFacultyName = 'Dire Sirmin' | 'Dire Lucritius' | 'Dire Aliss'

export function nativeFacultyRecipe(sourceSha256: string, name: NativeFacultyName): AuthoredBoneyardEnemyRecipe {
  const source = NATIVE_SURVIVAL_BOSS_SOURCES.find((row) => row.sourceSha256 === sourceSha256)
  if (!source) throw new Error(`default Boneyard ${sourceSha256} has no extracted Faculty`)
  const native = NATIVE_SURVIVAL_BOSS_RECIPE_SOURCES[name]
  return {
    archerAccuracyMode: 0, attackSpeed: native.attackSpeed, chaseSpeed: native.chaseSpeed,
    classification: 'multiple-boss', experienceBonus: native.xpBonus,
    extraDamage: native.extraDamage,
    family: { kind: 'faculty', bodyColor: native.bodyTint, female: native.shield,
      headColor: native.headTint, headgear: native.behaviorMax,
      primary: native.behaviorCount, secondary: native.behaviorMin },
    lootPolicies: native.lootPolicies, maximumHealth: native.maxHp,
    movementScale: native.moveSpeedScale, name, onDeathProgram: null,
    primaryDamage: native.primaryDamage, secondaryDamage: native.secondaryDamage,
    tertiaryDamage: native.tertiaryDamage, uid: source.recipeUids[name],
  }
}
