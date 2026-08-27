import { boneyard, primarySpells } from '../../lib/assets.ts'
import { boneyardCombatAtlasSource } from '../../lib/boneyard-combat-atlas-key.ts'

const COMBAT_ATLAS_ALIASES = new Map<string, string>([
  [primarySpells.earth.aura, boneyardCombatAtlasSource('BadGuys', 15)],
  [primarySpells.air.ribbon, boneyardCombatAtlasSource('BadGuys', 44)],
  [primarySpells.air.branches[0]!, boneyardCombatAtlasSource('BadGuys', 375)],
  [primarySpells.air.branches[1]!, boneyardCombatAtlasSource('BadGuys', 376)],
  [primarySpells.air.circle, boneyardCombatAtlasSource('BadGuys', 110)],
  [primarySpells.air.forks[0]!, boneyardCombatAtlasSource('BadGuys', 1836)],
  [primarySpells.air.forks[1]!, boneyardCombatAtlasSource('BadGuys', 1837)],
  [primarySpells.air.forks[2]!, boneyardCombatAtlasSource('BadGuys', 1838)],
  [primarySpells.air.forks[3]!, boneyardCombatAtlasSource('BadGuys', 1839)],
  [primarySpells.airWaterActors.hail, boneyardCombatAtlasSource('BadGuys', 32)],
  [boneyard.levelUpSparkle, boneyardCombatAtlasSource('BadGuys', 73)],
])

export function boneyardCombatAssetSource(source: string): string {
  return COMBAT_ATLAS_ALIASES.get(source) ?? source
}
