import { boneyard, primarySpells } from '../../lib/assets.ts'
import { boneyardCombatAtlasSource } from '../../lib/boneyard-combat-atlas-key.ts'

const COMBAT_ATLAS_ALIASES = new Map<string, string>([
  [primarySpells.airWaterActors.coldAura, boneyardCombatAtlasSource('BadGuys', 14)],
  [primarySpells.airWaterActors.hurricaneCore, boneyardCombatAtlasSource('DeadHawg', 15)],
  [primarySpells.airWaterActors.hurricaneLane, boneyardCombatAtlasSource('BadGuys', 84)],
  [primarySpells.earth.aura, boneyardCombatAtlasSource('BadGuys', 15)],
  [primarySpells.earth.openingFlash, boneyardCombatAtlasSource('BadGuys', 86)],
  ...primarySpells.earth.rocks.map((source, index) => [
    source,
    boneyardCombatAtlasSource('BadGuys', 168 + index),
  ] as const),
  ...primarySpells.earth.litRocks.map((source, index) => [
    source,
    boneyardCombatAtlasSource('BadGuys', 2008 + index),
  ] as const),
  [primarySpells.air.ribbon, boneyardCombatAtlasSource('BadGuys', 44)],
  [primarySpells.air.branches[0]!, boneyardCombatAtlasSource('BadGuys', 375)],
  [primarySpells.air.branches[1]!, boneyardCombatAtlasSource('BadGuys', 376)],
  [primarySpells.air.circle, boneyardCombatAtlasSource('BadGuys', 110)],
  [primarySpells.air.forks[0]!, boneyardCombatAtlasSource('BadGuys', 1836)],
  [primarySpells.air.forks[1]!, boneyardCombatAtlasSource('BadGuys', 1837)],
  [primarySpells.air.forks[2]!, boneyardCombatAtlasSource('BadGuys', 1838)],
  [primarySpells.air.forks[3]!, boneyardCombatAtlasSource('BadGuys', 1839)],
  [primarySpells.airWaterActors.hail, boneyardCombatAtlasSource('BadGuys', 32)],
  [primarySpells.frost.core, boneyardCombatAtlasSource('BadGuys', 30)],
  [primarySpells.frost.extra, boneyardCombatAtlasSource('BadGuys', 32)],
  [primarySpells.frost.over, boneyardCombatAtlasSource('BadGuys', 28)],
  [primarySpells.frost.spark, boneyardCombatAtlasSource('BadGuys', 14)],
  [primarySpells.etherPierceStreak, boneyardCombatAtlasSource('BadGuys', 53)],
  [boneyard.levelUpSparkle, boneyardCombatAtlasSource('BadGuys', 73)],
  [boneyard.lantern, boneyardCombatAtlasSource('BadGuys', 34)],
])

export function boneyardCombatAssetSource(source: string): string {
  return COMBAT_ATLAS_ALIASES.get(source) ?? source
}
