import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findInventoryItem,
  normalizeInventorySackName,
  renameInventorySack,
  transferInventoryItem,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import { applyGameSimulationHubAction, createGameSimulation, getPlayerBelt, getPlayerEconomy } from './game-simulation.ts'
import { replacePlayerEconomy } from './player-entity-store.ts'
import { createGameProfileSaveDocument, createGameSaveDocument, restoreGameSaveDocument, restoreGameSaveProfile } from '../save/game-save-document.ts'
import { hubActionFeedback, hubInventoryAction } from '../protocol/codecs/economy.ts'

function sack(id: number, contents: readonly HubInventoryItem[] = []): HubInventoryItem {
  return {
    id, contents, name: `Wizard's Sack ${id}`, nativeTypeId: 7008, nativeSubtype: 0,
    kind: 'sack', equipmentType: null, iconRecords: [70], inventorySlot: 0,
    quantity: 1, rarity: null, recipeIndex: null,
  }
}

function fixture() {
  const initial = createGameSimulation({
    owner: { discipline: 'arcane', displayName: 'Sackwright', element: 'fire' },
    peer: { discipline: 'arcane', displayName: 'Peer', element: 'water' },
  })
  const economy = getPlayerEconomy(initial, 'owner')
  const contents = [{ ...economy.backpack[0]!, id: 104_001, inventorySlot: 0 }]
  const inner = sack(104_002, contents)
  const outer = sack(104_003, [inner])
  const stored = sack(104_005, [sack(104_004)])
  const state = {
    ...initial,
    playerEntities: replacePlayerEconomy(initial.playerEntities, 'owner', {
      ...economy, backpack: [outer], storage: [stored], nextItemId: 104_006,
    }),
  }
  return { state, outer, inner, stored, contents }
}

test('renames owned root and nested sacks without altering their identity, contents or generated neighbors', () => {
  const { state, inner, outer, contents } = fixture()
  const original = getPlayerEconomy(state, 'owner')
  const result = renameInventorySack(original, inner.id, '  Potions é 火  ')
  assert.equal(result.accepted, true)
  assert.deepEqual(findInventoryItem(result.state.backpack, inner.id), { ...inner, name: 'Potions é 火' })
  assert.deepEqual(findInventoryItem(result.state.backpack, inner.id)?.contents, contents)
  assert.equal(result.state.backpack[0]?.name, outer.name)
  assert.strictEqual(result.state.storage, original.storage)
  assert.strictEqual(result.state.rng, original.rng)
  assert.equal(result.state.nextItemId, original.nextItemId)
  const root = renameInventorySack(result.state, outer.id, 'Equipment')
  assert.equal(root.accepted, true)
  assert.equal(root.state.backpack[0]?.name, 'Equipment')
  assert.deepEqual(root.state.backpack[0]?.contents, result.state.backpack[0]?.contents)
})

test('owned storage sacks at every depth retain custom names and contents when withdrawn', () => {
  const { state, stored } = fixture()
  const original = getPlayerEconomy(state, 'owner')
  const nested = renameInventorySack(original, 104_004, 'Spare rings')
  const root = renameInventorySack(nested.state, stored.id, 'Keepsakes')
  assert.equal(nested.accepted, true)
  assert.equal(root.accepted, true)
  assert.strictEqual(root.state.backpack, original.backpack)
  const moved = transferInventoryItem(root.state, stored.id, 'to-backpack')
  assert.equal(moved.accepted, true)
  assert.equal(findInventoryItem(moved.state.backpack, stored.id)?.name, 'Keepsakes')
  assert.equal(findInventoryItem(moved.state.backpack, 104_004)?.name, 'Spare rings')
  assert.equal(moved.state.storage.length, 0)
})

test('name validation preserves Unicode and rejects empty, invisible, control and over-limit values atomically', () => {
  const { state, inner } = fixture()
  const economy = getPlayerEconomy(state, 'owner')
  for (const name of ['', ' \t\n ', '\u200b', 'bad\u0000name', 'bad\nname', 'x'.repeat(33)]) {
    assert.equal(normalizeInventorySackName(name), null, JSON.stringify(name))
    const result = renameInventorySack(economy, inner.id, name)
    assert.equal(result.accepted, false)
    assert.equal(result.reason, 'invalid-name')
    assert.strictEqual(result.state, economy)
  }
  for (const name of ['x'.repeat(32), 'équipements', '火の袋', 'Family 👨‍👩‍👧']) {
    assert.equal(normalizeInventorySackName(name), name)
    assert.equal(renameInventorySack(economy, inner.id, name).accepted, true)
  }
  assert.equal(renameInventorySack(economy, 104_001, 'Potion').reason, 'ineligible-item')
  assert.equal(renameInventorySack(economy, 999_999, 'Missing').reason, 'item-not-found')
})

test('authority isolates the owner, preserves belt references, and persists names in continuation and profile saves', () => {
  const { state, outer, inner } = fixture()
  const bound = applyGameSimulationHubAction(state, 'owner', {
    type: 'bind-belt-item', itemId: outer.id, slot: 0,
  })
  assert.equal(bound.accepted, true)
  const belt = getPlayerBelt(bound.state, 'owner')
  const renamed = applyGameSimulationHubAction(bound.state, 'owner', {
    type: 'rename-sack', itemId: inner.id, name: 'Emergency potions',
  })
  assert.equal(renamed.accepted, true)
  assert.deepEqual(getPlayerBelt(renamed.state, 'owner'), belt)
  const ownerEconomy = getPlayerEconomy(renamed.state, 'owner')
  const liveFeedback = ownerEconomy.actionFeedback
  const expectedFeedback = { ...liveFeedback }
  assert.equal(liveFeedback?.accepted, true)
  assert.equal(liveFeedback?.action, 'rename-sack')
  const foreign = applyGameSimulationHubAction(renamed.state, 'peer', {
    type: 'rename-sack', itemId: inner.id, name: 'Foreign rename',
  })
  assert.equal(foreign.accepted, false)
  assert.strictEqual(getPlayerEconomy(foreign.state, 'owner'), ownerEconomy)
  const document = createGameSaveDocument({
    integrity: 'global-clean', loadedBoneyard: null, modState: {}, mods: [],
    playerId: 'owner', state: renamed.state,
  })
  const raw = JSON.parse(document)
  assert.equal(raw.continuation.simulation.playerEntities.economies[0].actionFeedback, null)
  assert.equal(raw.profile.economy.actionFeedback, null)
  const restored = restoreGameSaveDocument(document)
  assert.deepEqual(getPlayerEconomy(restored.state, 'owner').backpack, ownerEconomy.backpack)
  const profile = restoreGameSaveProfile(document)
  // The profile archives the run's carried tree inside a retained Sack.
  const retained = findInventoryItem(profile.economy.storage, outer.id)!
  assert.ok(retained)
  assert.deepEqual({ ...retained, inventorySlot: outer.inventorySlot }, ownerEconomy.backpack[0])
  assert.equal(findInventoryItem(profile.economy.storage, inner.id)?.name, 'Emergency potions')
  assert.equal(profile.economy.actionFeedback, null)
  assert.deepEqual(getPlayerBelt(restored.state, 'owner'), belt)
  assert.equal(getPlayerEconomy(restored.state, 'owner').actionFeedback, null)
  const profileDocument = createGameProfileSaveDocument({
    integrity: 'global-clean', modState: {}, mods: [], playerId: 'owner', state: renamed.state,
  })
  assert.equal(JSON.parse(profileDocument).profile.economy.actionFeedback, null)
  assert.equal(restoreGameSaveProfile(profileDocument).economy.actionFeedback, null)
  assert.strictEqual(getPlayerEconomy(renamed.state, 'owner').actionFeedback, liveFeedback)
  assert.deepEqual(liveFeedback, expectedFeedback, 'Serialization changed the live accepted receipt')
})

test('rejected rename feedback stays live but never enters continuation or profile saves', () => {
  const { state, inner } = fixture()
  const rejected = applyGameSimulationHubAction(state, 'owner', {
    type: 'rename-sack', itemId: inner.id, name: '   ',
  })
  assert.equal(rejected.accepted, false)
  const economy = getPlayerEconomy(rejected.state, 'owner')
  const liveFeedback = economy.actionFeedback
  const expectedFeedback = { ...liveFeedback }
  assert.equal(liveFeedback?.action, 'rename-sack')
  assert.equal(liveFeedback?.reason, 'invalid-name')
  const options = { integrity: 'global-clean' as const, modState: {}, mods: [],
    playerId: 'owner', state: rejected.state }
  const document = createGameSaveDocument({ ...options, loadedBoneyard: null })
  const raw = JSON.parse(document)
  assert.equal(raw.continuation.simulation.playerEntities.economies[0].actionFeedback, null)
  assert.equal(raw.profile.economy.actionFeedback, null)
  assert.equal(getPlayerEconomy(restoreGameSaveDocument(document).state, 'owner').actionFeedback, null)
  assert.equal(restoreGameSaveProfile(document).economy.actionFeedback, null)
  const profileDocument = createGameProfileSaveDocument(options)
  assert.equal(JSON.parse(profileDocument).profile.economy.actionFeedback, null)
  assert.equal(restoreGameSaveProfile(profileDocument).economy.actionFeedback, null)
  assert.deepEqual(findInventoryItem(economy.backpack, inner.id), inner)
  assert.strictEqual(getPlayerEconomy(rejected.state, 'owner').actionFeedback, liveFeedback)
  assert.deepEqual(liveFeedback, expectedFeedback, 'Serialization changed the live rejected receipt')
})

test('wire admits bounded rename requests and receipts, rejecting malformed fields before authority', () => {
  assert.deepEqual(hubInventoryAction({ type: 'rename-sack', itemId: 5, name: '  Supplies  ' }), {
    type: 'rename-sack', itemId: 5, name: 'Supplies',
  })
  for (const action of [
    { type: 'rename-sack', itemId: 0, name: 'Supplies' },
    { type: 'rename-sack', itemId: 5, name: ' ' },
    { type: 'rename-sack', itemId: 5, name: 'x'.repeat(33) },
    { type: 'rename-sack', itemId: 5, name: 'bad\nname' },
    { type: 'rename-sack', itemId: 5, name: null },
    { type: 'rename-sack', itemId: 5, name: 'Supplies', playerId: 'peer' },
  ]) assert.throws(() => hubInventoryAction(action))
  const feedback = {
    accepted: false, action: 'rename-sack', dowsingPitch: null, reason: 'invalid-name',
    sequence: 2, skillBookOutcome: null, transferDirection: null, transferGesture: null, unforgeOutcome: null,
  }
  assert.deepEqual(hubActionFeedback(feedback, 'feedback'), feedback)
})
