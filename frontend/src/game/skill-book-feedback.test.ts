import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import type { HubActionFeedback, NativeSkillBookOutcome } from './core-kernels/hub-economy.ts'
import { NativeLootMessagePresentation } from './loot-message-presentation.ts'
import { NativeSkillBookFeedbackCursor, nativeSkillBookResultLayout, nativeSkillBookResultText, nativeSkillBookWorldMessage } from './skill-book-feedback.ts'

function receipt(sequence: number, outcome: NativeSkillBookOutcome | null): HubActionFeedback {
  return { accepted: true, action: 'read-skill-book', skillBookOutcome: outcome,
    sequence, reason: null, dowsingPitch: null, transferDirection: null,
    transferGesture: null, unforgeOutcome: null }
}

test('book feedback is owner-cursor scoped and never replays restored, duplicate, stale or rejected results', () => {
  const retained = receipt(7, { kind: 'rank', skillId: 32 })
  const cursor = new NativeSkillBookFeedbackCursor(retained)
  assert.equal(cursor.consume(retained), null)
  assert.equal(cursor.consume(receipt(6, { kind: 'rank', skillId: 16 })), null)
  const next = receipt(8, { kind: 'rank', skillId: 35 })
  assert.deepEqual(cursor.consume(next), { sequence: 8, outcome: next.skillBookOutcome })
  assert.equal(cursor.consume(next), null)
  assert.equal(cursor.consume({ ...receipt(9, null), accepted: false, reason: 'item-not-found' }), null)
  assert.equal(cursor.consume({ ...receipt(10, null), action: 'consume' }), null)
  assert.deepEqual(cursor.consume(receipt(11, { kind: 'choice' })), { sequence: 11, outcome: { kind: 'choice' } })
  assert.deepEqual(cursor.consume(receipt(12, { kind: 'rank', skillId: null })), { sequence: 12, outcome: { kind: 'rank', skillId: null } })
  assert.equal(new NativeSkillBookFeedbackCursor(next).consume(next), null)
})

test('all native book-result rows use the recovered two-line centered confirmation and OKAY layout', () => {
  for (let id = 8; id <= 81; id += 1) {
    const layout = nativeSkillBookResultLayout(id)
    assert.equal(layout.lines[0]!.text, 'Skill improved')
    assert.equal(layout.lines[0]!.font, 'menu')
    assert.equal(layout.lines[0]!.gapAfter, 10)
    assert.equal(layout.lines[1]!.font, 'medium')
    assert.equal(layout.lines[1]!.tint, 0xb2b2ff)
    assert.equal(layout.lines[1]!.text.replaceAll('\n', ' '), nativeSkillBookResultText(id))
    assert.equal(layout.panelBounds.left + layout.panelBounds.width / 2, 800)
    assert.equal(layout.panelBounds.top + layout.panelBounds.height / 2, 450)
    assert.equal(layout.actionBounds.width, 196)
    assert.equal(layout.actionBounds.height, 69)
  }
  for (const id of [-1, 0, 7, 82, NaN, 32.5]) assert.throws(() => nativeSkillBookResultText(id), RangeError)
})

test('book HUD results share native message lifetime and cannot collide with loot event identities', () => {
  const message = nativeSkillBookWorldMessage(5, 32, 100)
  assert.equal(message.text, 'Frost Jet +1')
  assert.equal(message.eventId, -5)
  assert.equal(message.tint, 0x8080ff)
  const presentation = new NativeLootMessagePresentation(100)
  assert.equal(presentation.consumeText(message), true)
  assert.equal(presentation.sample(100)[0]!.alpha, 1)
  assert.equal(presentation.sample(100)[0]!.text, message.text)
  assert.equal(presentation.sample(399).length, 1)
  assert.equal(presentation.sample(401).length, 0)
})

test('book acquisition uses the unchanged registry129 stream bytes', () => {
  const bytes = readFileSync(new URL('../assets/game/audio/sfx/magic-book-get.wav', import.meta.url))
  assert.equal(bytes.length, 185716)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'ab0ac9b19633d93575673f61893c5e7ba509ec315263a9b39378a494ed575999')
})
