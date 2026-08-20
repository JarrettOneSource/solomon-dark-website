import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createIdlePlayerPrimaryCast,
  createPlayerCharacter,
} from '../core-kernels/player-character.ts'
import { buyFomentiusItem } from '../core-kernels/hub-economy.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import {
  NATIVE_PLAYER_LIGHT_OVERLAY_DECAY,
  NATIVE_PLAYER_STAFF_CAST_ONE_OVERLAY,
  NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY,
  playerLightDriveActive,
} from '../core-kernels/player-lighting.ts'
import {
  addPlayerEntity,
  coldSlowPlayerEntity,
  createPlayerEntityStore,
  creditPlayerEntityLootGold,
  damagePlayerEntity,
  dazzlePlayerEntity,
  grantPlayerEntityExperience,
  grantPlayerEntityBonusSkillChoice,
  increaseRandomPlayerEntitySkill,
  insertPlayerEntityLootItem,
  playerEntityCanAcceptInput,
  playerEntityCanCast,
  playerEntityDisplayHealth,
  playerEntityMovementScale,
  playerCharacterAt,
  playerEconomyAt,
  playerEntityId,
  playerLightingAt,
  poisonPlayerEntity,
  playerProgressionAt,
  playerSkillBookAt,
  playerStatBookAt,
  removePlayerEntity,
  replacePlayerEconomy,
  replacePlayerCharacter,
  resetPlayerEntitiesForNewRun,
  setPlayerEntitySpectating,
  stepPlayerEntityCombatTick,
  stepPlayerEntityOverlayLightingTick,
  tryDebitPlayerEntityMana,
} from './player-entity-store.ts'

const FIRST = { discipline: 'arcane', displayName: 'First', element: 'ether' } as const
const SECOND = { discipline: 'mind', displayName: 'Second', element: 'water' } as const

test('players occupy aligned dense ECS columns with stable entity IDs', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 1, y: 2 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 3, y: 4 }), 20)
  assert.deepEqual(store.entityIds, [1, 2])
  assert.deepEqual(store.identities.map((identity) => identity.playerId), ['first', 'second'])
  assert.equal(store.configs.length, store.locomotions.length)
  assert.equal(store.economies.length, store.locomotions.length)
  assert.equal(store.lightings.length, store.locomotions.length)
  assert.equal('config' in store.locomotions[0]!, false)
  assert.equal('primaryCast' in store.locomotions[0]!, false)
  assert.equal(store.locomotions.length, store.progressions.length)
  assert.equal(store.primaryCasts.length, store.progressions.length)
  assert.equal(store.progressions.length, store.skillBooks.length)
  assert.equal(store.skillBooks.length, store.statBooks.length)
  assert.equal(playerEntityId(store, 'second'), 2)
  assert.equal(playerEconomyAt(store, 'first')?.gold, 10_000)
  assert.deepEqual(playerLightingAt(store, 'second'), {
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    overlayEffectPhase: 0,
  })

  store = damagePlayerEntity(store, 'second', 60, 0)
  assert.equal(playerProgressionAt(store, 'second')?.currentHealth, -10)
  assert.equal(playerEntityDisplayHealth(store, 'second'), 0)

  store = removePlayerEntity(store, 'first')
  assert.deepEqual(store.entityIds, [2])
  assert.equal(playerEntityId(store, 'second'), 2)
  assert.equal(playerCharacterAt(store, 'second')?.config.displayName, 'Second')
  assert.equal(playerProgressionAt(store, 'second')?.lifeState, 'lethal-pending')
  assert.equal(store.nextEntityId, 3)
})

test('each dense player row owns an isolated economy component that survives run resets', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const second = playerEconomyAt(store, 'second')!
  const first = playerEconomyAt(store, 'first')!
  const purchase = buyFomentiusItem(first, first.fomentiusStock[0]!.id)
  assert.equal(purchase.accepted, true)
  store = replacePlayerEconomy(store, 'first', purchase.state)

  assert.equal(playerEconomyAt(store, 'first')?.gold, purchase.state.gold)
  assert.strictEqual(playerEconomyAt(store, 'second'), second)
  const economyRows = store.economies
  store = resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 100, y: 200 }),
    second: createPlayerCharacter(SECOND, { x: 300, y: 400 }),
  })
  assert.strictEqual(store.economies, economyRows)
})

test('each player owns private progression and ranks while sharing immutable stat definitions', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const secondProgression = playerProgressionAt(store, 'second')
  store = grantPlayerEntityExperience(store, 'first', 100)
  assert.equal(playerProgressionAt(store, 'first')?.level, 2)
  assert.equal(playerProgressionAt(store, 'second'), secondProgression)
  assert.notEqual(
    playerSkillBookAt(store, 'first')?.permanentRanks,
    playerSkillBookAt(store, 'second')?.permanentRanks,
  )
  assert.equal(playerStatBookAt(store, 'first'), playerStatBookAt(store, 'second'))
})

test('entity combat APIs update only the indexed progression and publish one-shot death edges', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const untouched = playerProgressionAt(store, 'second')

  const debit = tryDebitPlayerEntityMana(store, 'first', 6)
  assert.equal(debit.accepted, true)
  store = debit.store
  assert.equal(playerProgressionAt(store, 'first')?.currentMana, 94)
  assert.equal(playerProgressionAt(store, 'second'), untouched)

  store = damagePlayerEntity(store, 'first', 60, 0)
  assert.equal(playerEntityCanAcceptInput(store, 'first'), false)
  assert.equal(playerEntityCanCast(store, 'first'), false)
  assert.equal(playerEntityCanAcceptInput(store, 'second'), true)

  const tick = stepPlayerEntityCombatTick(store)
  store = tick.store
  assert.deepEqual(tick.beganDeathEpochPlayerIds, ['first'])
  assert.deepEqual(tick.deathBurstPlayerIds, [])
  assert.equal(playerProgressionAt(store, 'first')?.deathEpoch, 1)
  assert.equal(playerProgressionAt(store, 'second')?.currentHealth, 50)

  store = poisonPlayerEntity(store, 'second', 5, 10)
  assert.equal(playerProgressionAt(store, 'second')?.poisonDamagePerTick, 0.05)
  assert.equal(playerProgressionAt(store, 'second')?.poisonTicksRemaining, 1_000)
})

test('new-run placement resets transient combat while retaining dense identity and progression books', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  store = grantPlayerEntityExperience(store, 'first', 100)
  store = poisonPlayerEntity(store, 'first', 5, 10)
  store = coldSlowPlayerEntity(store, 'first', 200)
  store = dazzlePlayerEntity(store, 'first', 50)
  store = damagePlayerEntity(store, 'first', 75, 0)
  store = stepPlayerEntityCombatTick(store).store
  store = setPlayerEntitySpectating(store, 'first')

  const entityIds = store.entityIds
  const identities = store.identities
  const configs = store.configs
  const skillBooks = store.skillBooks
  const statBooks = store.statBooks
  const firstProgression = playerProgressionAt(store, 'first')!
  store = resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 100, y: 200 }),
    second: createPlayerCharacter(SECOND, { x: 300, y: 400 }),
  })

  assert.equal(store.entityIds, entityIds)
  assert.equal(store.identities, identities)
  assert.equal(store.configs, configs)
  assert.equal(store.skillBooks, skillBooks)
  assert.equal(store.statBooks, statBooks)
  assert.deepEqual(playerCharacterAt(store, 'first')?.position, { x: 100, y: 200 })
  assert.deepEqual(playerCharacterAt(store, 'second')?.position, { x: 300, y: 400 })
  assert.equal(playerProgressionAt(store, 'first')?.level, firstProgression.level)
  assert.equal(playerProgressionAt(store, 'first')?.pendingOffer, firstProgression.pendingOffer)
  assert.equal(playerProgressionAt(store, 'first')?.lifeState, 'alive')
  assert.equal(playerProgressionAt(store, 'first')?.currentHealth, 50)
  assert.equal(playerProgressionAt(store, 'first')?.poisonDamagePerTick, 0)
  assert.equal(playerProgressionAt(store, 'first')?.poisonTicksRemaining, 0)
  assert.equal(playerProgressionAt(store, 'first')?.coldSlowTicksRemaining, 0)
  assert.equal(playerProgressionAt(store, 'first')?.dazzleTicksRemaining, 0)
  assert.equal(playerEntityMovementScale(store, 'first'), 1)
  assert.equal(playerProgressionAt(store, 'first')?.currentMana, 100)
  assert.deepEqual(playerLightingAt(store, 'first'), {
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
    overlayEffectPhase: 0,
  })
  assert.throws(() => resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 0, y: 0 }),
  }), /exactly one placement/)
  assert.throws(() => resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 0, y: 0 }),
    second: createPlayerCharacter(SECOND, { x: 0, y: 0 }),
  }, {
    first: { managerLane: 'actor', registrationOrdinal: 2 },
  }), /exactly one light registration/)
})

test('player lighting owns exact cast overlay recurrence', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const first = playerCharacterAt(store, 'first')!
  store = replacePlayerCharacter(store, 'first', {
    ...first,
    primaryCast: { ...first.primaryCast, actionTick: 0 },
  })
  const second = playerCharacterAt(store, 'second')!
  store = replacePlayerCharacter(store, 'second', {
    ...second,
    primaryCast: { ...second.primaryCast, actionTick: 1, channelActive: true },
  })
  store = stepPlayerEntityOverlayLightingTick(store)
  assert.equal(
    playerLightingAt(store, 'first')?.overlayEffectPhase,
    Math.fround(NATIVE_PLAYER_STAFF_CAST_ONE_OVERLAY * NATIVE_PLAYER_LIGHT_OVERLAY_DECAY),
  )
  assert.equal(
    playerLightingAt(store, 'second')?.overlayEffectPhase,
    Math.fround(NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY * NATIVE_PLAYER_LIGHT_OVERLAY_DECAY),
  )

  const idle = createIdlePlayerPrimaryCast()
  assert.equal(playerLightDriveActive(idle, 'alive'), false)
  assert.equal(playerLightDriveActive(idle, 'lethal-pending'), false)
  assert.equal(playerLightDriveActive({ ...idle, actionTick: 0 }, 'alive'), true)
  assert.equal(playerLightDriveActive(idle, 'dying'), true)
  assert.equal(playerLightDriveActive(idle, 'spectating'), true)
})

test('loot credits exactly one dense participant economy or skill row', () => {
  let store = createPlayerEntityStore()
  store = addPlayerEntity(store, 'first', FIRST, createPlayerCharacter(FIRST, { x: 0, y: 0 }), 10)
  store = addPlayerEntity(store, 'second', SECOND, createPlayerCharacter(SECOND, { x: 0, y: 0 }), 20)
  const untouchedEconomy = playerEconomyAt(store, 'second')
  const untouchedSkills = playerSkillBookAt(store, 'second')

  store = creditPlayerEntityLootGold(store, 'first', 11)
  assert.equal(playerEconomyAt(store, 'first')?.gold, 10_011)
  assert.strictEqual(playerEconomyAt(store, 'second'), untouchedEconomy)

  const potion = { ...playerEconomyAt(store, 'first')!.backpack[0]!, id: 99_000 }
  const inserted = insertPlayerEntityLootItem(store, 'first', potion)
  assert.equal(inserted.accepted, true)
  store = inserted.store
  assert.equal(playerEconomyAt(store, 'first')?.backpack[0]?.quantity, 2)

  store = grantPlayerEntityBonusSkillChoice(store, 'first')
  assert.ok(playerProgressionAt(store, 'first')?.pendingOffer)
  const increased = increaseRandomPlayerEntitySkill(store, 'first', createNativeRng(123))
  assert.notEqual(increased.skillId, null)
  store = increased.store
  assert.strictEqual(playerSkillBookAt(store, 'second'), untouchedSkills)
})
