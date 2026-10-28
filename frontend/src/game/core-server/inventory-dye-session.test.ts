import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DOWSING_EQUIPMENT_RECIPES,
  FOMENTIUS_STOCK_DEFINITIONS,
  createEquipmentInventoryItem,
  createFomentiusInventoryItem,
  findInventoryItem,
  type NativeDyeLayer,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import {
  applyGameSimulationHubAction,
  closeGameSimulationInventoryDyeSession,
  createGameSimulation,
  getPlayerEconomy,
  removePlayerCharacter,
  stepGameSimulationTick,
  type GameSimulationState,
} from './game-simulation.ts'
import { replacePlayerEconomy } from './player-entity-store.ts'
import { createIdlePlayerCharacterInput } from '../core-kernels/player-character.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createGameSaveDocument, restoreGameSaveDocument, restoreGameSaveProfile } from '../save/game-save-document.ts'

function fixture(nested = false) {
  const state = createGameSimulation({
    owner: { discipline: 'arcane', displayName: 'Painter', element: 'fire' },
    peer: { discipline: 'arcane', displayName: 'Peer', element: 'water' },
  })
  const robe = createEquipmentInventoryItem(
    DOWSING_EQUIPMENT_RECIPES.find(row => row.type === 'robe')!, 69_001,
  )
  const hat = createEquipmentInventoryItem(
    DOWSING_EQUIPMENT_RECIPES.find(row => row.type === 'hat')!, 69_002,
  )
  const definition = FOMENTIUS_STOCK_DEFINITIONS.find(row => row.kind === 'dye')!
  const kit = createFomentiusInventoryItem(definition, 69_003)
  const secondKit = createFomentiusInventoryItem(definition, 69_004)
  const items = [robe, hat, kit, secondKit]
  const sack: HubInventoryItem = {
    contents: items, equipmentType: null, iconRecords: [70], id: 69_005,
    kind: 'sack', name: 'Painting Sack', nativeTypeId: 7008, nativeSubtype: 0,
    quantity: 1, rarity: null, recipeIndex: null,
  }
  const economy = getPlayerEconomy(state, 'owner')
  return {
    state: { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
      ...economy, backpack: nested ? [sack] : items, nextItemId: 69_006,
    }) },
    robe, hat, kit, secondKit,
  }
}

function paint(
  state: GameSimulationState, sessionId: string, targetItemId: number,
  layer: NativeDyeLayer = 'cloth', swatchRows: readonly number[] = [1], playerId = 'owner',
) {
  return applyGameSimulationHubAction(state, playerId, {
    type: 'dye', sessionId, targetItemId, layer, swatchRows,
  })
}

test('authority admits one kit for repeated layers, colors and garments and isolates the peer', () => {
  const { state, kit, secondKit, robe, hat } = fixture(true)
  const peerEconomy = getPlayerEconomy(state, 'peer')
  const opened = applyGameSimulationHubAction(state, 'owner', {
    type: 'open-dye', dyeItemId: kit.id, sessionId: 'painting-a',
  })
  assert.equal(opened.accepted, true)
  assert.equal(findInventoryItem(getPlayerEconomy(opened.state, 'owner').backpack, kit.id)?.quantity, 1)
  const invalid = paint(opened.state, 'painting-a', robe.id, 'cloth', [])
  assert.equal(invalid.accepted, false)
  assert.strictEqual(getPlayerEconomy(invalid.state, 'owner').backpack, getPlayerEconomy(opened.state, 'owner').backpack)
  const cloth = paint(invalid.state, 'painting-a', robe.id)
  assert.equal(cloth.accepted, true)
  assert.equal(findInventoryItem(getPlayerEconomy(cloth.state, 'owner').backpack, kit.id), null)
  const trim = paint(cloth.state, 'painting-a', robe.id, 'trim', [9])
  assert.equal(trim.accepted, true)
  const other = paint(trim.state, 'painting-a', hat.id, 'cloth', [5])
  assert.equal(other.accepted, true)
  const economy = getPlayerEconomy(other.state, 'owner')
  assert.deepEqual(findInventoryItem(economy.backpack, robe.id)?.iconTints, [0x7b3b3b, 0x10104f])
  assert.equal(findInventoryItem(economy.backpack, hat.id)?.iconTints?.[0], 0x75b475)
  assert.equal(findInventoryItem(economy.backpack, secondKit.id)?.quantity, 1)
  const foreign = paint(other.state, 'painting-a', robe.id, 'cloth', [1], 'peer')
  assert.equal(foreign.accepted, false)
  assert.strictEqual(getPlayerEconomy(foreign.state, 'owner'), economy)
  assert.strictEqual(getPlayerEconomy(other.state, 'peer'), peerEconomy)
})

test('unused close preserves the kit; paid close ends continuation and stale close cannot end reopening', () => {
  const { state, kit, secondKit, robe } = fixture()
  const opened = applyGameSimulationHubAction(state, 'owner', {
    type: 'open-dye', dyeItemId: kit.id, sessionId: 'unused',
  })
  const cancelled = applyGameSimulationHubAction(opened.state, 'owner', { type: 'close-dye', sessionId: 'unused' })
  assert.equal(findInventoryItem(getPlayerEconomy(cancelled.state, 'owner').backpack, kit.id)?.quantity, 1)
  assert.equal(paint(cancelled.state, 'unused', robe.id).accepted, false)
  const reopened = applyGameSimulationHubAction(cancelled.state, 'owner', {
    type: 'open-dye', dyeItemId: kit.id, sessionId: 'paid',
  })
  const painted = paint(reopened.state, 'paid', robe.id)
  const closed = applyGameSimulationHubAction(painted.state, 'owner', { type: 'close-dye', sessionId: 'paid' })
  assert.equal(paint(closed.state, 'paid', robe.id).accepted, false)
  assert.equal(applyGameSimulationHubAction(closed.state, 'owner', {
    type: 'open-dye', dyeItemId: kit.id, sessionId: 'missing-kit',
  }).accepted, false)
  const next = applyGameSimulationHubAction(closed.state, 'owner', {
    type: 'open-dye', dyeItemId: secondKit.id, sessionId: 'new',
  })
  const staleClose = applyGameSimulationHubAction(next.state, 'owner', { type: 'close-dye', sessionId: 'paid' })
  assert.equal(paint(staleClose.state, 'new', robe.id).accepted, true)
})

test('inventory mutation, server lifetime loss and actor removal retire painting authorization', () => {
  const { state, kit, robe } = fixture()
  const opened = applyGameSimulationHubAction(state, 'owner', {
    type: 'open-dye', dyeItemId: kit.id, sessionId: 'transient',
  })
  const changed = applyGameSimulationHubAction(opened.state, 'owner', { type: 'close-dowsing' })
  assert.equal(paint(changed.state, 'transient', robe.id).accepted, false)
  const ended = closeGameSimulationInventoryDyeSession(opened.state, 'owner')
  assert.equal(createGameSnapshot(ended, 'owner').players.owner?.economy?.dyeSessionId, null)
  const removed = removePlayerCharacter(opened.state, 'owner')
  assert.equal(paint(removed, 'transient', robe.id).accepted, false)
  const idle = createIdlePlayerCharacterInput()
  const idleTick = stepGameSimulationTick(opened.state, { owner: idle })
  assert.equal(createGameSnapshot(idleTick, 'owner').players.owner?.economy?.dyeSessionId, 'transient')
  const moving = stepGameSimulationTick(opened.state, { owner: { ...idle, movement: { x: 1, y: 0 } } })
  assert.equal(paint(moving, 'transient', robe.id).accepted, false)
})

test('checkpoint and profile keep paid colors and consumption but omit painting lifetime', () => {
  const { state, kit, robe } = fixture()
  const opened = applyGameSimulationHubAction(state, 'owner', {
    type: 'open-dye', dyeItemId: kit.id, sessionId: 'never-saved-session',
  })
  const paid = paint(opened.state, 'never-saved-session', robe.id)
  const document = createGameSaveDocument({
    integrity: 'global-clean', loadedBoneyard: null, modState: {}, mods: [],
    playerId: 'owner', state: paid.state,
  })
  assert.equal(document.includes('never-saved-session'), false)
  assert.equal(document.includes('inventoryDyeSessions'), false)
  const restored = restoreGameSaveDocument(document)
  assert.equal(findInventoryItem(getPlayerEconomy(restored.state, 'owner').backpack, kit.id), null)
  assert.equal(findInventoryItem(getPlayerEconomy(restored.state, 'owner').backpack, robe.id)?.iconTints?.[0], 0x7b3b3b)
  assert.equal(paint(restored.state, 'never-saved-session', robe.id).accepted, false)
  const historical = JSON.parse(document)
  const oneShotFeedback = {
    accepted: true, action: 'dye', dowsingPitch: null, reason: null, sequence: 1,
    transferDirection: null, transferGesture: null, unforgeOutcome: null, skillBookOutcome: null,
  }
  historical.profile.economy.actionFeedback = oneShotFeedback
  historical.continuation.simulation.playerEntities.economies[0].actionFeedback = oneShotFeedback
  const oldResult = restoreGameSaveDocument(JSON.stringify(historical))
  const oldProfile = restoreGameSaveProfile(JSON.stringify(historical))
  assert.equal(oldProfile.economy.actionFeedback, null)
  assert.equal(getPlayerEconomy(oldResult.state, 'owner').actionFeedback, null)
  assert.equal(paint(oldResult.state, 'never-saved-session', robe.id).accepted, false)
  historical.profile.economy.actionFeedback = { ...oneShotFeedback, kitConsumed: true }
  assert.throws(() => restoreGameSaveProfile(JSON.stringify(historical)))
  historical.profile.economy.actionFeedback = null
  historical.continuation.simulation.playerEntities.economies[0].actionFeedback = {
    ...oneShotFeedback, kitConsumed: true,
  }
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(historical)))
  historical.continuation.simulation.playerEntities.economies[0].actionFeedback = null
  historical.continuation.simulation.inventoryDyeSessions = {
    owner: { id: 'never-saved-session', dyeItemId: kit.id, kitConsumed: true },
  }
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(historical)))
})
