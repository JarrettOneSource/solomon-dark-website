export type BoneyardCombatAtlasName = 'BadGuys' | 'DeadHawg' | 'Demon' | 'Golem'

export function boneyardCombatAtlasSource(
  atlas: BoneyardCombatAtlasName,
  entry: number,
): string {
  if (!Number.isSafeInteger(entry) || entry < 0) {
    throw new RangeError(`Invalid Boneyard combat atlas entry ${entry}`)
  }
  return `boneyard-combat:${atlas}:${entry}`
}
