import assert from 'node:assert/strict'
import test from 'node:test'
import { applyGameSimulationHubAction, createGameSimulation, getPlayerEconomy } from './core-server/game-simulation.ts'
import { replacePlayerEconomy } from './core-server/player-entity-store.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import type { HubInventoryItem } from './core-kernels/hub-economy.ts'
import type { ProtocolPlayerInventoryStats, ProtocolPlayerProgression } from './protocol/game-state.ts'
import { sameRuntimeProgression } from './runtime-progression.ts'

const baseline = createGameSnapshot(createGameSimulation(), 'local-player').players['local-player']!.progression

test('removing a mana-recovery ring invalidates the displayed stats at unchanged HP, MP, and revision', () => {
  const playerId = 'local-player'
  const initial = createGameSimulation()
  const economy = getPlayerEconomy(initial, playerId)
  const ring: HubInventoryItem = {
    equipmentType: 'ring', generatedLevel: 0, iconRecords: [52], id: 40_001,
    kind: 'equipment', name: 'Ring of Managrind',
    nativeEffects: [{ kind: 9, magnitude: 1, operator: 0, target: 0 }],
    nativeSelector: 0, nativeSubtype: null, nativeTypeId: 7002,
    quantity: 1, rarity: null, recipeIndex: null,
  }
  const equipped = {
    ...initial,
    playerEntities: replacePlayerEconomy(initial.playerEntities, playerId, {
      ...economy, equipment: { ...economy.equipment, rings: [ring, null, null] },
    }),
  }
  const removed = applyGameSimulationHubAction(equipped, playerId, { slot: 'ring-0', type: 'unequip' })
  assert.equal(removed.accepted, true)
  const before = createGameSnapshot(equipped, playerId).players[playerId]!.progression
  const after = createGameSnapshot(removed.state, playerId).players[playerId]!.progression
  assert.equal(before.currentHealth, after.currentHealth)
  assert.equal(before.currentMana, after.currentMana)
  assert.equal(before.revision, after.revision)
  assert.equal(before.inventoryStats.manaRecoveryPerSecond, 11)
  assert.equal(after.inventoryStats.manaRecoveryPerSecond, 10)
  assert.equal(sameRuntimeProgression(before, after), false)
  assert.equal(sameRuntimeProgression(after, before), false, 'equipping must also refresh stats')
})

test('every inventory stat change invalidates retained progression in both directions', () => {
  const changes: Record<keyof ProtocolPlayerInventoryStats, readonly Partial<ProtocolPlayerInventoryStats>[]> = {
    castSpeedPercent: [{ castSpeedPercent: 120 }],
    magicResistancePercent: [{ magicResistancePercent: 20 }],
    manaRecoveryPerSecond: [{ manaRecoveryPerSecond: 11 }],
    painResistancePercent: [{ painResistancePercent: 25 }],
    poisonResistancePercent: [{ poisonResistancePercent: 40 }],
    primarySpell: [
      { primarySpell: { ...baseline.inventoryStats.primarySpell, damageMinimum: 3 } },
      { primarySpell: { ...baseline.inventoryStats.primarySpell, damageMaximum: 5 } },
      { primarySpell: { ...baseline.inventoryStats.primarySpell, manaCost: 4 } },
    ],
    walkSpeedPercent: [{ walkSpeedPercent: 130 }],
  }
  for (const [field, variations] of Object.entries(changes)) {
    for (const change of variations) {
      const changed = { ...baseline, inventoryStats: { ...baseline.inventoryStats, ...change } }
      assert.equal(sameRuntimeProgression(baseline, changed), false, `${field} applied`)
      assert.equal(sameRuntimeProgression(changed, baseline), false, `${field} removed`)
    }
  }
})

test('unchanged projected values retain UI state despite newly allocated snapshots', () => {
  assert.equal(sameRuntimeProgression(baseline, structuredClone(baseline)), true)
  assert.equal(sameRuntimeProgression(null, null), true)
  assert.equal(sameRuntimeProgression(null, baseline), false)
  assert.equal(sameRuntimeProgression(baseline, null), false)
})

test('inventory refresh preserves the existing progression, health, mana, and selection update contract', () => {
  const changes: readonly Partial<ProtocolPlayerProgression>[] = [
    { revision: baseline.revision + 1 },
    { currentHealth: 40 },
    { currentMana: 90 },
    { deathEpoch: 1 },
    { deathTick: 100 },
    { lifeState: 'dying' },
    { maximumHealth: 100 },
    { maximumMana: 200 },
    { pendingOffer: { automaticChoiceIndex: 0, level: 2, options: [], sequence: 1 } },
    { poisonDamagePerTick: 0.1 },
    { poisonTicksRemaining: 100 },
    { selectedPrimarySkillId: 16 },
    { weldBuildId: 1000 },
    { advancedUnlocks: baseline.advancedUnlocks.map((value, index) => index === 0 || value) },
    { concentrationSkillIds: [8, null] },
    { concentrationSkillIds: [null, 11] },
  ]
  for (const change of changes) {
    const changed = { ...baseline, ...change }
    assert.equal(sameRuntimeProgression(baseline, changed), false, JSON.stringify(change))
    assert.equal(sameRuntimeProgression(changed, baseline), false, JSON.stringify(change))
  }
  const awaitingAutomaticChoice = {
    ...baseline, pendingOffer: { automaticChoiceIndex: 0, level: 2, options: [], sequence: 1 },
  }
  assert.equal(sameRuntimeProgression(awaitingAutomaticChoice, structuredClone(awaitingAutomaticChoice)), true)
})
