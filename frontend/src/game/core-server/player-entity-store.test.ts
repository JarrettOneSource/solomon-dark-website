import assert from 'node:assert/strict'
import test from 'node:test'

import { createPlayerCharacter } from '../core-kernels/player-character.ts'
import {
  addPlayerEntity,
  createPlayerEntityStore,
  grantPlayerEntityExperience,
  playerCharacterAt,
  playerEntityId,
  playerProgressionAt,
  playerSkillBookAt,
  playerStatBookAt,
  removePlayerEntity,
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

  store = removePlayerEntity(store, 'first')
  assert.deepEqual(store.entityIds, [2])
  assert.equal(playerEntityId(store, 'second'), 2)
  assert.equal(playerCharacterAt(store, 'second')?.config.displayName, 'Second')
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
