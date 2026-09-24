import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation, getPlayerEconomy } from '../core-server/game-simulation.ts'
import { createNativeWaterAuraActor, createNativeWaterHailActor } from '../core-kernels/air-water-spell-actors.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { drawNativeInteger } from '../core-kernels/native-rng.ts'
import { buyHagathaPerk, hagathaOffers, removeHagathaPerk } from '../core-kernels/hub-economy.ts'
import { nativeLootModifiers } from '../core-kernels/native-loot.ts'
import { replacePlayerEconomy } from '../core-server/player-entity-store.ts'
import { readGameSaveFileSelection } from './game-save-files.ts'
import { parseGameSaveDocument } from './game-save-contract.ts'
import {
  createGameSaveDocument,
  restoreGameSaveDocument,
  restoreGameSaveProfile,
  retireGameSaveWizard,
} from './game-save-document.ts'

test('compatible future saves resume and retire without losing the profile', async () => {
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: createGameSimulation({
      owner: { discipline: 'arcane', displayName: 'Version test', element: 'fire' },
    }),
  })
  const future = JSON.stringify({ ...JSON.parse(document), schemaVersion: 999 })
  const imported = await readGameSaveFileSelection([new File([future], 'save.json')])
  const currentImport = await readGameSaveFileSelection([new File([document], 'save.json')])
  assert.equal(imported.displayName, 'Version test')
  assert.deepEqual(
    restoreGameSaveDocument(imported.document).state,
    restoreGameSaveDocument(currentImport.document).state,
  )
  assert.deepEqual(restoreGameSaveDocument(future), restoreGameSaveDocument(document))
  assert.deepEqual(
    parseGameSaveDocument(retireGameSaveWizard(future)),
    parseGameSaveDocument(retireGameSaveWizard(document)),
  )
  assert.throws(() => restoreGameSaveDocument(JSON.stringify({
    ...JSON.parse(future), continuation: { simulation: {} },
  })), /game save/)
})

test('schema 39 retires only obsolete Cold Aura actors without rewinding saved gameplay or RNG', () => {
  const source = createGameSimulation({
    owner: { discipline: 'arcane', displayName: 'Aura recovery', element: 'water' },
  })
  const order = createNativeWorldManagerOrder(source.worldManagerOrder)
  const id = source.primarySpells.nextId
  const aura = createNativeWaterAuraActor(
    id, 'owner', 'hub:courtyard', source.tick, { x: 10, y: 20 }, 1, source.gameRng,
  )
  const hail = createNativeWaterHailActor(
    id + 1, 'owner', 'hub:courtyard', source.tick, { x: 10, y: 20 }, { x: 1, y: 0 }, aura.rng,
  )
  const state = {
    ...source, gameRng: hail.rng,
    primarySpells: { ...source.primarySpells, nextId: id + 2, transients: [
      { ...aura.actor, painterRegistrations: [order.register('actor')] },
      { ...hail.actor, painterRegistrations: [order.register('actor')] },
    ] },
    worldManagerOrder: order.state(),
  }
  const document = createGameSaveDocument({
    integrity: 'global-clean', loadedBoneyard: null, mods: [], modState: {}, playerId: 'owner', state,
  })
  const current = restoreGameSaveDocument(document)
  assert.equal(current.state.primarySpells.transients.length, 2)
  const legacy = JSON.parse(document)
  legacy.schemaVersion = 39
  Object.assign(legacy.continuation.simulation.primarySpells.transients[0], {
    alphaDecay: Math.fround(0.15 / 840), durationTicks: 2_800, rotationStepDegrees: 0.4,
  })
  const migrated = restoreGameSaveDocument(JSON.stringify(legacy))
  assert.deepEqual(migrated.state, {
    ...current.state,
    primarySpells: { ...current.state.primarySpells,
      transients: current.state.primarySpells.transients.filter(actor => actor.kind !== 'water-aura') },
  })
  // Ordinary College recovery consumes one Hub seed in every save version.
  // Retiring Aura must neither replay its missing sign draw nor consume more.
  assert.deepEqual(migrated.state.gameRng, drawNativeInteger(state.gameRng, 0x40000000).state)
  assert.equal(migrated.state.primarySpells.transients[0]?.kind, 'water-hail')
  assert.deepEqual(restoreGameSaveDocument(JSON.stringify({
    ...JSON.parse(document), schemaVersion: 999,
  })).state, current.state)
})


test('purchased Item Charm survives continuation restoration and only explicit removal clears its modifier', () => {
  const source = createGameSimulation({
    owner: { discipline: 'arcane', displayName: 'Charm recovery', element: 'fire' },
  })
  const funded = { ...getPlayerEconomy(source, 'owner'), gold: 10000 }
  const price = hagathaOffers(funded).find(offer => offer.selector === 3)!.price
  const bought = buyHagathaPerk(funded, 3)
  assert.equal(bought.accepted, true)
  assert.equal(bought.state.gold, funded.gold - price)
  assert.deepEqual(bought.state.ownedPerkSelectors, [3])
  assert.equal(buyHagathaPerk(bought.state, 3).accepted, false)
  const state = { ...source, playerEntities: replacePlayerEconomy(source.playerEntities, 'owner', bought.state) }
  const document = createGameSaveDocument({
    integrity: 'global-clean', loadedBoneyard: null, mods: [], modState: {}, playerId: 'owner', state,
  })
  const restored = restoreGameSaveDocument(document)
  const economy = getPlayerEconomy(restored.state, restored.playerId)
  assert.deepEqual(economy.ownedPerkSelectors, [3])
  assert.equal(economy.gold, bought.state.gold)
  assert.deepEqual(economy.backpack, bought.state.backpack)
  assert.equal(nativeLootModifiers(economy.ownedPerkSelectors).itemChance, 0.75)
  const retiredProfile = restoreGameSaveProfile(retireGameSaveWizard(document))
  assert.equal(retiredProfile.continuation, null)
  assert.deepEqual(retiredProfile.economy.ownedPerkSelectors, [3])
  assert.equal(retiredProfile.economy.gold, bought.state.gold)
  const removed = removeHagathaPerk(economy, 3)
  assert.equal(removed.accepted, true)
  assert.deepEqual(removed.state.ownedPerkSelectors, [])
  assert.equal(removed.state.gold, economy.gold)
  assert.deepEqual(removed.state.backpack, economy.backpack)
  assert.equal(nativeLootModifiers(removed.state.ownedPerkSelectors).itemChance, 1)
  const updated = { ...restored.state,
    playerEntities: replacePlayerEconomy(restored.state.playerEntities, restored.playerId, removed.state) }
  const again = restoreGameSaveDocument(createGameSaveDocument({
    integrity: 'global-clean', loadedBoneyard: null, mods: [], modState: {}, playerId: restored.playerId, state: updated,
  }))
  assert.deepEqual(getPlayerEconomy(again.state, again.playerId).ownedPerkSelectors, [])
})
