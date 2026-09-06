import type { AuthoredBoneyardEnemyRecipe } from './boneyard-enemy-config-model.ts'
import { NATIVE_SURVIVAL_BOSS_RECIPE_SOURCES, NATIVE_SURVIVAL_BOSS_SOURCES } from './native-survival-boss-catalog.ts'

export function nativeHeartmongerRecipe(sourceSha256: string): AuthoredBoneyardEnemyRecipe {
  const source = NATIVE_SURVIVAL_BOSS_SOURCES.find((row) => row.sourceSha256 === sourceSha256)
  if (!source) throw new Error(`default Boneyard ${sourceSha256} has no extracted Heartmonger`)
  const native = NATIVE_SURVIVAL_BOSS_RECIPE_SOURCES.Heartmonger
  return Object.freeze({
    archerAccuracyMode: 0,
    attackSpeed: native.attackSpeed,
    chaseSpeed: native.chaseSpeed,
    classification: 'boss',
    experienceBonus: native.xpBonus,
    extraDamage: native.extraDamage,
    family: Object.freeze({ kind: 'heartmonger', crowCount: native.behaviorCount,
      blindMode: native.behaviorMin, summonMode: native.behaviorMax }),
    lootPolicies: native.lootPolicies,
    maximumHealth: native.maxHp,
    movementScale: native.moveSpeedScale,
    name: 'Heartmonger',
    onDeathProgram: null,
    primaryDamage: native.primaryDamage,
    secondaryDamage: native.secondaryDamage,
    tertiaryDamage: native.tertiaryDamage,
    uid: source.recipeUids.Heartmonger,
  })
}
