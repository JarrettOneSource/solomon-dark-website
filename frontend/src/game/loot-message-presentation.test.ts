import assert from 'node:assert/strict'
import test from 'node:test'

import { NativeLootMessagePresentation, nativeWorldNotificationsVisible } from './loot-message-presentation.ts'
import type { BoneyardLootEventSnapshot } from './protocol/game-state.ts'

test('empty loot-message samples retain identity across ordinary fixed ticks', () => {
  const presentation = new NativeLootMessagePresentation(0)
  const initial = presentation.sample(0)
  assert.equal(initial.length, 0)
  assert.strictEqual(presentation.sample(1_000), initial)
})

test('notification visibility follows death drive and the combat HUD, not lethal pending', () => {
  assert.equal(nativeWorldNotificationsVisible('alive'), true)
  assert.equal(nativeWorldNotificationsVisible('lethal-pending'), true)
  assert.equal(nativeWorldNotificationsVisible('dying'), false)
  assert.equal(nativeWorldNotificationsVisible('spectating'), false)
  assert.equal(nativeWorldNotificationsVisible(null), false)
  assert.equal(nativeWorldNotificationsVisible('alive', false), false)
})

test('native loot messages merge active Gold, rise eighteen ticks, and expire after float32 decay', () => {
  const presentation = new NativeLootMessagePresentation(0)
  presentation.consume(event(1, 1, '4 GOLD', 'pickup-coin'))
  presentation.consume(event(2, 2, '7 GOLD', 'pickup-coin'))
  assert.deepEqual(presentation.sample(2).map(({ text, tint }) => ({ text, tint })), [
    { text: '11 GOLD', tint: 0xd9ba70 },
  ])
  assert.equal(presentation.sample(18)[0]?.offset, 0)
  assert.equal(presentation.sample(20)[0]?.offset, 0)
  assert.equal(presentation.sample(299).length, 1)
  assert.equal(presentation.sample(303).length, 0)
})

test('a distinct message performs the native immediate four-unit insertion shift', () => {
  const presentation = new NativeLootMessagePresentation(0)
  presentation.consume(event(1, 1, 'Health Potion', 'pickup-bag'))
  presentation.consume(event(2, 2, 'DAMAGE x4'))
  const messages = presentation.sample(2)
  assert.equal(messages.length, 2)
  assert.equal(messages[0]?.offset, 4)
  assert.equal(messages[1]?.offset, -17)
  assert.equal(messages[0]?.tint, 0xffffff)
})

test('shared notices use the native two-decimal scale after insertion pressure', () => {
  const presentation = new NativeLootMessagePresentation(0)
  presentation.consume(event(1, 1, 'Health Potion', 'pickup-bag'))
  presentation.consume(event(2, 2, 'DAMAGE x4'))
  assert.equal(presentation.sample(2)[0]?.scale, 0.9800000190734863)
})

test('equal IDs from loot, rescue and overload keep the newest notice active', () => {
  const presentation = new NativeLootMessagePresentation(0)
  presentation.consume(event(1, 1, 'Health Potion', 'pickup-bag'))
  const rescue: { eventId: number; tick: number; text: string; tint: number; source: 'combat' } = {
    eventId: 1, tick: 2, text: 'CHEAT DEATH!', tint: 0xffffff, source: 'combat',
  }
  presentation.consumeText(rescue)
  assert.deepEqual(presentation.sample(2).map(({ offset }) => offset), [4, -17])
  const overload: { eventId: number; tick: number; text: string; tint: number; source: 'secondary' } = {
    eventId: 1, tick: 3, text: 'Overloaded Mana!', tint: 0xffffff, source: 'secondary',
  }
  presentation.consumeText(overload)
  assert.equal(presentation.sample(3).at(-1)?.offset, -17)
  assert.deepEqual(presentation.sample(3).map(({ text }) => text), [
    'Health Potion', 'CHEAT DEATH!', 'Overloaded Mana!',
  ])
})

function event(
  eventId: number,
  tick: number,
  text: string,
  sound?: BoneyardLootEventSnapshot['sound'],
): BoneyardLootEventSnapshot {
  return {
    actorId: eventId,
    eventId,
    playerId: 'player',
    position: { x: 0, y: 0 },
    runId: 'run',
    ...(sound === undefined ? {} : { playbackRate: 1, sound }),
    text,
    tick,
    type: 'loot-pickup',
  }
}

import './skill-book-feedback.test.ts'
