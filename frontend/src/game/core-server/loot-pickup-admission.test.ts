import assert from 'node:assert/strict'
import test from 'node:test'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { DOWSING_EQUIPMENT_RECIPES, MOD_ITEM_NATIVE_TYPE_ID, NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT, insertLootInventoryItem, type HubEconomyState } from '../core-kernels/hub-economy.ts'
import { createNativeLootItemIds, miscItem, potionItem, equipmentRecipeItem, type NativeLootItem } from '../core-kernels/native-loot-items.ts'
import { spawnBoneyardLootSpecs, stepBoneyardLootStore, type BoneyardLootParticipant } from './boneyard-loot-store.ts'
import { createGameSimulation, enterBoneyardWorld, getPlayerCharacter, getPlayerEconomy, stepGameSimulationTick, type GameSimulationState } from './game-simulation.ts'
import { NATIVE_LOOT_OPEN_PLACEMENT, nativeLootModifiers } from '../core-kernels/native-loot.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { replacePlayerEconomy } from './player-entity-store.ts'

const arena: LoadedBoneyard = {
  choice: { id: 'pickup-admission', name: 'Pickup admission', source: 'default' },
  geometrySha256: 'b'.repeat(64), runId: 'pickup-admission-run',
  scene: { bounds: { x: 0, y: 0, w: 500, h: 500 }, environmentMode: 2,
    fences: [], name: 'Pickup admission', objects: [], roads: [], solomonDig: null,
    spawn: { facingDeg: 180, x: 250, y: 250 }, sprites: [], terrain: [] },
  seed: 'pickup-admission-seed',
  sourceSha256: '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f',
}

test('a rejected full-backpack pickup retains its ground item and emits no pickup', () => {
  let state = enterBoneyardWorld(createGameSimulation(), arena)
  const ids = createNativeLootItemIds(100)
  const economy = { ...getPlayerEconomy(state),
    backpack: Array.from({ length: NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT }, () => miscItem(ids, 1)),
    nextItemId: 50_000 }
  const item = { ...miscItem(createNativeLootItemIds(90_000), 1), name: 'Retained Key' }
  assert.equal(insertLootInventoryItem(economy, item).accepted, false)
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'local-player', economy) }
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const spawned = spawnBoneyardLootSpecs(state.world.loot, [{ activationDelayTicks: 0,
    id: 1, item, kind: 'sack', nativeTypeId: 2013, phase: 0,
    position: getPlayerCharacter(state).position, source: 'script' }], state.tick)
  state = stepGameSimulationTick({ ...state, world: { ...state.world, loot: spawned.store } }, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(getPlayerEconomy(state).backpack, economy.backpack)
  assert.equal(state.world.loot.actors.length, 1, 'rejected transfer must keep the ground carrier')
  assert.deepEqual(state.world.loot.actors[0]?.item, item)
  assert.equal(state.world.lootEvents.some(event => event.type === 'loot-pickup'), false)
})

function filledEconomy(state: GameSimulationState, count: number, playerId = 'local-player'): HubEconomyState {
  const ids = createNativeLootItemIds(100)
  return { ...getPlayerEconomy(state, playerId), nextItemId: 50_000,
    backpack: Array.from({ length: count }, (_, inventorySlot) => ({ ...miscItem(ids, 1), inventorySlot })) }
}

function withEconomy(state: GameSimulationState, economy: HubEconomyState, playerId = 'local-player') {
  return { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, playerId, economy) }
}

function withGroundItems(state: GameSimulationState, items: readonly NativeLootItem[]) {
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const spawned = spawnBoneyardLootSpecs(state.world.loot, items.map((item, index) => ({
    activationDelayTicks: 0, id: index + 1, item, kind: 'sack' as const,
    nativeTypeId: 2013 as const, phase: 0,
    position: getPlayerCharacter(state, state.playerEntities.identities[0]!.playerId).position,
    source: 'script' as const,
  })), state.tick)
  assert.equal(spawned.rejectedCount, 0)
  return { ...state, world: { ...state.world, loot: { ...spawned.store,
    actors: spawned.store.actors.map(actor => ({ ...actor, bounceVelocity: 0, settledSoundEmitted: true })) } } }
}

function groundItems(state: GameSimulationState) {
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  return state.world.loot.actors.map(actor => actor.item)
}

function pickupEvents(state: GameSimulationState) {
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  return state.world.lootEvents.filter(event => event.type === 'loot-pickup')
}

const key = () => ({ ...miscItem(createNativeLootItemIds(90_000), 1), name: 'Retained Key' })
const potion = () => potionItem(createNativeLootItemIds(90_100), 0)
const sack = (): NativeLootItem => ({ ...key(), id: 90_200, nativeTypeId: 7008,
  nativeSubtype: 0, kind: 'sack', name: 'Nested Sack', iconRecords: [70],
  contents: [{ ...potion(), quantity: 7 }, { ...key(), id: 90_201 }] })

test('rejected carrier survives repeated ticks without feedback or RNG then transfers exactly once after a slot opens', () => {
  let state = enterBoneyardWorld(createGameSimulation(), arena)
  const economy = filledEconomy(state, NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT)
  state = withGroundItems(withEconomy(state, economy), [key()])
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const rng = state.world.loot.sharedRng
  const actorId = state.world.loot.actors[0]!.id
  const attributed: unknown[] = []
  const options = { attributionObserver: {
    onEnemyHealthDamage: () => {},
    onEnemyKillExperience: () => {},
    onLootPickup: (event: unknown) => { attributed.push(event) },
  } }
  for (let index = 0; index < 3; index += 1) {
    state = stepGameSimulationTick(state, {}, options)
    assert.deepEqual(groundItems(state), [key()])
    assert.deepEqual(getPlayerEconomy(state), economy)
    assert.deepEqual(pickupEvents(state), [])
    assert.deepEqual(attributed, [])
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.equal(state.world.loot.actors[0]!.id, actorId)
    assert.deepEqual(state.world.loot.sharedRng, rng)
    assert.deepEqual(state.world.loot.effects, [])
  }
  state = withEconomy(state, { ...economy, backpack: economy.backpack.filter(item => item.inventorySlot !== 17) })
  state = stepGameSimulationTick(state, {}, options)
  assert.deepEqual(groundItems(state), [])
  const inserted = getPlayerEconomy(state).backpack.find(item => item.name === 'Retained Key')!
  assert.equal(inserted.id, economy.nextItemId)
  assert.equal(inserted.inventorySlot, 17)
  assert.equal(getPlayerEconomy(state).nextItemId, economy.nextItemId + 1)
  assert.equal(pickupEvents(state).length, 1)
  assert.equal(pickupEvents(state)[0]!.sound, 'pickup-bag')
  assert.equal(attributed.length, 1)
  const after = getPlayerEconomy(state)
  state = stepGameSimulationTick(state, {}, options)
  assert.deepEqual(getPlayerEconomy(state), after)
  assert.equal(attributed.length, 1)
})

for (const count of [88, 2047, 2048]) {
  test(`nested Sack admission uses ${count} root entries without flattening or changing rejected contents`, () => {
    let state = enterBoneyardWorld(createGameSimulation(), arena)
    const economy = filledEconomy(state, count)
    const item = sack()
    state = stepGameSimulationTick(withGroundItems(withEconomy(state, economy), [item]), {})
    if (count === 2048) {
      assert.deepEqual(groundItems(state), [item])
      assert.deepEqual(getPlayerEconomy(state), economy)
      assert.deepEqual(pickupEvents(state), [])
    } else {
      assert.deepEqual(groundItems(state), [])
      const next = getPlayerEconomy(state)
      assert.equal(next.backpack.length, count + 1)
      const inserted = next.backpack.at(-1)!
      assert.equal(inserted.kind, 'sack')
      assert.equal(inserted.inventorySlot, count)
      assert.deepEqual(inserted.contents?.map(child => [child.kind, child.quantity, child.id]),
        [['health-potion', 7, 50_001], ['key', 1, 50_002]])
      assert.equal(next.nextItemId, 50_003)
    }
  })
}

test('near-full multiple carriers reserve the last root slot in carrier order', () => {
  let state = enterBoneyardWorld(createGameSimulation(), arena)
  const economy = filledEconomy(state, 2047)
  const first = key(), second = { ...key(), id: 90_001, name: 'Second Key' }
  state = stepGameSimulationTick(withGroundItems(withEconomy(state, economy), [first, second]), {})
  assert.deepEqual(groundItems(state), [second])
  assert.equal(getPlayerEconomy(state).backpack.at(-1)!.name, first.name)
  assert.equal(getPlayerEconomy(state).nextItemId, 50_001)
  assert.equal(pickupEvents(state).length, 1)
})

function modStack(): NativeLootItem {
  return { ...key(), kind: 'mod-item', nativeTypeId: MOD_ITEM_NATIVE_TYPE_ID, nativeSubtype: null,
    modItemContent: { contentId: '5000000000000000090', description: 'Pickup stack control',
      key: 'token', modId: 'example.pickup', stackMaximum: 5,
      icon: { atlasId: 'example.pickup:icon', frameIndex: 0, imagePath: 'art/icon.png',
        frame: { centerOffsetX: 0, centerOffsetY: 0, contentHeight: 1, contentWidth: 1,
          height: 1, logicalHeight: 1, logicalWidth: 1, width: 1, x: 0, y: 0 } } } }
}

for (const [name, factory, maximum] of [['Potion', potion, 9999], ['mod item', modStack, 5]] as const) {
  test(`${name} stacks at root capacity and rejects only the excess sequential pickup`, () => {
    let state = enterBoneyardWorld(createGameSimulation(), arena)
    const filled = filledEconomy(state, 2048)
    const resident = { ...factory(), id: 100, inventorySlot: 0, quantity: maximum - 1 }
    const economy = { ...filled, backpack: [resident, ...filled.backpack.slice(1)] }
    const first = factory(), second = { ...factory(), id: 90_500 }
    state = stepGameSimulationTick(withGroundItems(withEconomy(state, economy), [first, second]), {})
    assert.equal(getPlayerEconomy(state).backpack[0]!.quantity, maximum)
    assert.equal(getPlayerEconomy(state).backpack.length, 2048)
    assert.equal(getPlayerEconomy(state).nextItemId, 50_000)
    assert.deepEqual(groundItems(state), [second])
    assert.equal(pickupEvents(state).length, 1)
  })
  test(`${name} stack rejection leaves a free root slot available to the next carrier`, () => {
    let state = enterBoneyardWorld(createGameSimulation(), arena)
    const filled = filledEconomy(state, 2047)
    const resident = { ...factory(), id: 100, inventorySlot: 0, quantity: maximum }
    const economy = { ...filled, backpack: [resident, ...filled.backpack.slice(1)] }
    const rejected = factory()
    state = stepGameSimulationTick(withGroundItems(withEconomy(state, economy), [rejected, key()]), {})
    assert.deepEqual(groundItems(state), [rejected])
    assert.equal(getPlayerEconomy(state).backpack.at(-1)!.name, 'Retained Key')
    assert.equal(getPlayerEconomy(state).backpack.length, 2048)
    assert.equal(getPlayerEconomy(state).nextItemId, 50_001)
  })
}

for (const [firstCount, secondCount, expected] of [[2048, 2047, 'second'], [2047, 2047, 'first'], [2048, 2048, null]] as const) {
  test(`participant pickup order with ${firstCount}/${secondCount} root entries credits ${expected ?? 'neither'}`, () => {
    const config = { discipline: 'arcane', displayName: 'Wizard', element: 'ether' } as const
    let state = enterBoneyardWorld(createGameSimulation({ first: config, second: config }), arena)
    for (const [id, count] of [['first', firstCount], ['second', secondCount]] as const) {
      state = withEconomy(state, filledEconomy(state, count, id), id)
    }
    state = stepGameSimulationTick(withGroundItems(state, [key()]), {})
    assert.equal(pickupEvents(state)[0]?.playerId ?? null, expected)
    assert.equal(groundItems(state).length, expected === null ? 1 : 0)
    for (const id of ['first', 'second']) {
      assert.equal(getPlayerEconomy(state, id).backpack.some(item => item.name === 'Retained Key'), id === expected)
    }
  })
}

for (const gate of ['dead', 'disconnected', 'outside-radius', 'activation-delay', 'null-item'] as const) {
  test(`Sack ${gate} gate preserves inventory before reservation`, () => {
    const state = withGroundItems(enterBoneyardWorld(createGameSimulation(), arena), [key()])
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    const economy = getPlayerEconomy(state)
    let projected = economy
    const participant: BoneyardLootParticipant = {
      advancedUnlocks: new Array<boolean>(8).fill(false), alive: gate !== 'dead',
      connected: gate !== 'disconnected', headingIndex: 0, level: 1,
      modifiers: nativeLootModifiers([]), ownedRecipeIndexes: [], playerId: 'local-player',
      position: gate === 'outside-radius' ? { x: 400, y: 400 } : getPlayerCharacter(state).position,
      reserveLootItem: item => { const inserted = insertLootInventoryItem(projected, item)
        projected = inserted.state; return inserted.accepted },
    }
    const source = { ...state.world.loot, actors: state.world.loot.actors.map(actor => ({ ...actor,
      activationDelayTicks: gate === 'activation-delay' ? 2 : 0,
      item: gate === 'null-item' ? null : actor.item })) }
    const result = stepBoneyardLootStore(source, { participants: [participant], tick: state.tick + 1,
      placement: NATIVE_LOOT_OPEN_PLACEMENT })
    assert.strictEqual(projected, economy)
    assert.equal(result.store.actors.length, gate === 'null-item' ? 0 : 1)
    assert.equal(result.pickups.length, gate === 'null-item' ? 1 : 0)
  })
}

test('a full backpack leaves Gold Orb and Bonus pickup families unchanged', () => {
  let state = enterBoneyardWorld(createGameSimulation(), arena)
  const economy = filledEconomy(state, 2048)
  state = withEconomy(state, economy)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const common = { activationDelayTicks: 0, phase: 0,
    position: getPlayerCharacter(state).position, source: 'script' as const }
  const spawned = spawnBoneyardLootSpecs(state.world.loot, [
    { ...common, id: 1, amount: 3, kind: 'gold', nativeTypeId: 2012, tier: 0 },
    { ...common, id: 2, kind: 'orb', nativeTypeId: 2011, orbKind: 'mana', value: 1 },
    { ...common, id: 3, kind: 'bonus', nativeTypeId: 2038, bonusKind: 2 },
  ], state.tick)
  state = stepGameSimulationTick({ ...state, world: { ...state.world, loot: spawned.store } }, {})
  assert.deepEqual(groundItems(state), [])
  assert.deepEqual(pickupEvents(state).map(event => event.actorId), [1, 2, 3])
  assert.equal(getPlayerEconomy(state).gold, economy.gold + 3)
  assert.deepEqual(getPlayerEconomy(state).backpack, economy.backpack)
})

const itemFamilies = [
  ...['hat', 'robe', 'staff', 'wand', 'ring', 'amulet'].map(type =>
    equipmentRecipeItem(DOWSING_EQUIPMENT_RECIPES.find(recipe => recipe.type === type)!,
      createNativeLootItemIds(90_000), createNativeRng(42)).item),
  ...Array.from({ length: 6 }, (_, subtype) => potionItem(createNativeLootItemIds(90_000), subtype)),
  ...Array.from({ length: 4 }, (_, subtype) => miscItem(createNativeLootItemIds(90_000), subtype)),
  { ...sack(), name: 'Empty Sack', contents: [] },
]

for (const item of itemFamilies) {
  test(`full inventory preserves ground ${item.name} with its exact authored identity`, () => {
    let state = enterBoneyardWorld(createGameSimulation(), arena)
    const economy = filledEconomy(state, 2048)
    state = stepGameSimulationTick(withGroundItems(withEconomy(state, economy), [item]), {})
    assert.deepEqual(groundItems(state), [item])
    assert.deepEqual(getPlayerEconomy(state), economy)
    assert.deepEqual(pickupEvents(state), [])
  })
}
