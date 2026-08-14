import assert from 'node:assert/strict'
import test from 'node:test'

import { createPlayerCharacter } from '../core-kernels/player-character.ts'
import {
  addPlayerEntity,
  createPlayerEntityStore,
  damagePlayerEntity,
  grantPlayerEntityExperience,
  playerEntityCanAcceptInput,
  playerEntityCanCast,
  playerEntityDisplayHealth,
  playerCharacterAt,
  playerEntityId,
  poisonPlayerEntity,
  playerProgressionAt,
  playerSkillBookAt,
  playerStatBookAt,
  removePlayerEntity,
  resetPlayerEntitiesForNewRun,
  setPlayerEntitySpectating,
  stepPlayerEntityCombatTick,
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
  assert.equal('config' in store.locomotions[0]!, false)
  assert.equal('primaryCast' in store.locomotions[0]!, false)
  assert.equal(store.locomotions.length, store.progressions.length)
  assert.equal(store.primaryCasts.length, store.progressions.length)
  assert.equal(store.progressions.length, store.skillBooks.length)
  assert.equal(store.skillBooks.length, store.statBooks.length)
  assert.equal(playerEntityId(store, 'second'), 2)

  store = damagePlayerEntity(store, 'second', 60)
  assert.equal(playerProgressionAt(store, 'second')?.currentHealth, -10)
  assert.equal(playerEntityDisplayHealth(store, 'second'), 0)

  store = removePlayerEntity(store, 'first')
  assert.deepEqual(store.entityIds, [2])
  assert.equal(playerEntityId(store, 'second'), 2)
  assert.equal(playerCharacterAt(store, 'second')?.config.displayName, 'Second')
  assert.equal(playerProgressionAt(store, 'second')?.lifeState, 'lethal-pending')
  assert.equal(store.nextEntityId, 3)
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

  store = damagePlayerEntity(store, 'first', 60)
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
  store = damagePlayerEntity(store, 'first', 75)
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
  assert.equal(playerProgressionAt(store, 'first')?.currentMana, 100)
  assert.throws(() => resetPlayerEntitiesForNewRun(store, {
    first: createPlayerCharacter(FIRST, { x: 0, y: 0 }),
  }), /exactly one placement/)
})
