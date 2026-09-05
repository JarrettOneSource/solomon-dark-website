import type { ProtocolPlayerInventoryStats, ProtocolPlayerProgression } from './protocol/game-state.ts'

export function sameRuntimeProgression(
  current: ProtocolPlayerProgression | null,
  next: ProtocolPlayerProgression | null,
): boolean {
  if (!current || !next) return current === next
  return current.revision === next.revision
    && current.currentHealth === next.currentHealth
    && current.currentMana === next.currentMana
    && current.deathEpoch === next.deathEpoch
    && current.deathTick === next.deathTick
    && current.lifeState === next.lifeState
    && current.maximumHealth === next.maximumHealth
    && current.maximumMana === next.maximumMana
    && sameInventoryStats(current.inventoryStats, next.inventoryStats)
    && current.pendingOffer?.automaticChoiceIndex === next.pendingOffer?.automaticChoiceIndex
    && current.poisonDamagePerTick === next.poisonDamagePerTick
    && current.poisonTicksRemaining === next.poisonTicksRemaining
    && current.selectedPrimarySkillId === next.selectedPrimarySkillId
    && current.weldBuildId === next.weldBuildId
    && current.advancedUnlocks.every((unlocked, index) => (
      unlocked === next.advancedUnlocks[index]
    ))
    && current.concentrationSkillIds.every((skillId, index) => (
      skillId === next.concentrationSkillIds[index]
    ))
}

function sameInventoryStats(
  current: ProtocolPlayerInventoryStats,
  next: ProtocolPlayerInventoryStats,
): boolean {
  return current.castSpeedPercent === next.castSpeedPercent
    && current.walkSpeedPercent === next.walkSpeedPercent
    && current.magicResistancePercent === next.magicResistancePercent
    && current.painResistancePercent === next.painResistancePercent
    && current.poisonResistancePercent === next.poisonResistancePercent
    && current.manaRecoveryPerSecond === next.manaRecoveryPerSecond
    && current.primarySpell.damageMinimum === next.primarySpell.damageMinimum
    && current.primarySpell.damageMaximum === next.primarySpell.damageMaximum
    && current.primarySpell.manaCost === next.primarySpell.manaCost
}
