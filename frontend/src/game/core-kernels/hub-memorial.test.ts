import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HUB_MEMORIAL_INITIAL_SLOT_AGES,
  HUB_MEMORIAL_SLOT_COUNT,
  archiveHubMemorialPortrait,
  createHubMemorialState,
} from './hub-memorial.ts'

const EQUIPMENT = {
  hat: null,
  robe: null,
  weapon: null,
} as const

function portrait(index: number) {
  return {
    capturedAtTick: 30_000 + index,
    config: {
      discipline: 'arcane' as const,
      displayName: `Wizard ${index}`,
      element: 'ether' as const,
    },
    equipment: EQUIPMENT,
    headingIndex: index % 24,
    playerId: `player-${index}`,
    portraitScale: 0.85 + index % 10 / 100,
    runId: `run-${index}`,
  }
}

test('starts with the ten stock slots and replaces them in persisted FIFO-age order', () => {
  let memorial = createHubMemorialState()
  assert.equal(memorial.slots.length, HUB_MEMORIAL_SLOT_COUNT)
  assert.deepEqual(memorial.slots.map(({ age }) => age), HUB_MEMORIAL_INITIAL_SLOT_AGES)
  assert.deepEqual(memorial.slots.map(({ portraitId }) => portraitId), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

  const replacementSlots: number[] = []
  for (let index = 0; index < 10; index += 1) {
    memorial = archiveHubMemorialPortrait(memorial, portrait(index), index % 5)
    replacementSlots.push(memorial.slots.findIndex(
      ({ portrait: current }) => current?.playerId === `player-${index}`,
    ))
  }

  assert.deepEqual(replacementSlots, [2, 1, 3, 6, 5, 9, 4, 7, 0, 8])
  assert.deepEqual(
    memorial.slots
      .filter(({ portrait }) => portrait !== null)
      .toSorted((left, right) => left.age - right.age)
      .map(({ portraitId }) => portraitId),
    [100, 101, 102, 103, 104, 105, 106, 107, 108, 109],
  )
  assert.equal(memorial.nextPortraitId, 100)
  assert.deepEqual(
    memorial.slots
      .filter(({ portrait }) => portrait !== null)
      .toSorted((left, right) => left.age - right.age)
      .map(({ marker }) => marker),
    [true, true, true, false, true, true, true, true, false, true],
  )
})

test('the eleventh completion reuses portrait 100 and evicts the oldest completed portrait', () => {
  let memorial = createHubMemorialState()
  for (let index = 0; index < 11; index += 1) {
    memorial = archiveHubMemorialPortrait(memorial, portrait(index), 0)
  }

  assert.equal(memorial.slots[2]?.portraitId, 100)
  assert.equal(memorial.slots[2]?.portrait?.playerId, 'player-10')
  assert.equal(memorial.slots.some(({ portrait: current }) => current?.playerId === 'player-0'), false)
  assert.equal(
    memorial.slots.toSorted((left, right) => right.age - left.age)[0]?.portrait?.playerId,
    'player-10',
  )
})

test('strict minimum-age comparisons keep the lower physical slot on a tie', () => {
  const initial = createHubMemorialState()
  const tied = {
    ...initial,
    slots: initial.slots.map((slot, index) => ({
      ...slot,
      age: index < 2 ? 0 : slot.age + 10,
    })),
  }
  const archived = archiveHubMemorialPortrait(tied, portrait(20), 3)

  assert.equal(archived.slots[0]?.portrait?.playerId, 'player-20')
  assert.equal(archived.slots[0]?.marker, false)
  assert.equal(archived.slots[1]?.portrait, null)
})

test('the same authoritative run-player completion is admitted only once while retained', () => {
  const first = archiveHubMemorialPortrait(createHubMemorialState(), portrait(30), 0)
  assert.equal(archiveHubMemorialPortrait(first, portrait(30), 1), first)
})
