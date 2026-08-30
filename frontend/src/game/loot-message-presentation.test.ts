import assert from 'node:assert/strict'
import test from 'node:test'

import { NativeLootMessagePresentation } from './loot-message-presentation.ts'
import type { BoneyardLootEventSnapshot } from './protocol/game-state.ts'

test('empty loot-message samples retain identity across ordinary fixed ticks', () => {
  const presentation = new NativeLootMessagePresentation(0)
  const initial = presentation.sample(0)
  assert.equal(initial.length, 0)
  assert.strictEqual(presentation.sample(1_000), initial)
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
