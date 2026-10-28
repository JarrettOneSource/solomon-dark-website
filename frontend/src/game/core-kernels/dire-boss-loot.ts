import type { BoneyardWaveEnemyToken } from './boneyard-wave-schema.ts'
import { nativeEquipmentTooltipSetForRecipe } from './native-equipment-effects.ts'
import { NATIVE_SURVIVAL_BOSS_SOURCES } from './native-survival-boss-catalog.ts'
import type { NativeFacultyName } from './native-survival-faculty.ts'

// Approved Website extension; the items and set memberships remain stock.
const ITEM_POOLS: Readonly<Record<NativeFacultyName, readonly number[]>> = {
  'Dire Sirmin': nativeEquipmentTooltipSetForRecipe(11)!.memberRecipeIndices,
  'Dire Lucritius': [...nativeEquipmentTooltipSetForRecipe(20)!.memberRecipeIndices, 3],
  'Dire Aliss': nativeEquipmentTooltipSetForRecipe(16)!.memberRecipeIndices,
}

export function direBossItemRecipePool(
  sourceSha256: string | undefined,
  enemyToken: BoneyardWaveEnemyToken,
  recipeUid: number | undefined,
): readonly number[] | undefined {
  if (enemyToken !== 'DIREFACULTY' || recipeUid === undefined) return undefined
  const source = NATIVE_SURVIVAL_BOSS_SOURCES.find(row => row.sourceSha256 === sourceSha256)
  if (!source) return undefined
  for (const name of source.faculty.spawnOrder) {
    if (source.recipeUids[name] === recipeUid) return ITEM_POOLS[name]
  }
  return undefined
}
