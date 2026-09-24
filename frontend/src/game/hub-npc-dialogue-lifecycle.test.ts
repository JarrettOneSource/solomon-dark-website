import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeHubNpcState,
  NATIVE_HUB_INTERACTION_IDS,
  NATIVE_HUB_NPC_CATALOG,
} from './core-kernels/native-hub-npc.ts'
import {
  consumeHubNpcSpeech,
  createHubNpcChatContent,
  hubNpcChatChoiceContent,
  hubNpcChatChoices,
  hubNpcQuestion,
  type HubNpcChatContent,
} from './hub-npc-dialogue.ts'
import type { HubInteractionId } from './hub-inventory-presentation.ts'

const npc = createNativeHubNpcState()

function open(id: HubInteractionId, consumed: ReadonlySet<string>, story = false) {
  return createHubNpcChatContent(id, npc, 0, null, story, null, consumed)
}

function speak(id: HubInteractionId, content: HubNpcChatContent | null, consumed: Set<string>, story = false) {
  assert.equal(content?.kind, 'speech')
  if (content?.kind !== 'speech') throw new Error('expected native speech')
  consumeHubNpcSpeech(consumed, id, content.key, story)
  return content
}

test('all ten survival intros are consumed on speech start, including interrupted speech', () => {
  const consumed = new Set<string>()
  let count = 0
  for (const id of NATIVE_HUB_INTERACTION_IDS) {
    const row = NATIVE_HUB_NPC_CATALOG.interactions[id]
    if (row.intro === null) continue
    count += 1
    const first = speak(id, open(id, consumed), consumed)
    assert.equal(first.key, row.intro)
    assert.equal(consumed.has(row.intro), true)
    const reopened = open(id, consumed)
    assert.notEqual(reopened.kind === 'speech' ? reopened.key : null, row.intro)
    if (row.questions.length + row.commands.length > 0) assert.equal(reopened.kind, 'choices')
  }
  assert.equal(count, 10)
})

test('partial first Office conversations retain only unanswered choices across close/reopen', () => {
  for (const id of ['arch-chancellor', 'polisher'] as const) {
    const consumed = new Set<string>()
    const graph = NATIVE_HUB_NPC_CATALOG.storyOffice.interactions[id]
    speak(id, open(id, consumed, true), consumed, true)
    assert.equal(open(id, consumed, true).kind, 'choices')
    for (const [index, key] of graph.questions.entries()) {
      const speech = speak(id, hubNpcQuestion(id, key, true, consumed), consumed, true)
      assert.equal(speech.next, index === graph.questions.length - 1 ? 'close' : 'choices')
      assert.equal(hubNpcQuestion(id, key, true, consumed), null)
      const expected = graph.questions.slice(index + 1)
      assert.deepEqual(hubNpcChatChoices(id, true, consumed).map(row => row.kind === 'question' ? row.key : ''), expected)
      if (expected.length > 0) assert.equal(open(id, consumed, true).kind, 'choices')
    }
    const fallback = open(id, consumed, true)
    assert.equal(fallback.kind, 'speech')
    if (fallback.kind === 'speech') {
      assert.equal(fallback.key, graph.dismissals[0])
      assert.equal(fallback.next, 'close')
      assert.deepEqual(open(id, consumed, true), fallback)
    }
  }
})

test('normal Archchancellor and Declarius questions retire, unlike repeatable price explanations', () => {
  for (const [id, keys, oneShot] of [
    ['arch-chancellor', ['ARCH_Q'], true],
    ['memorator', ['MEMORATOR_Q1', 'MEMORATOR_Q2'], true],
    ['hagatha', ['WITCH_Q'], false],
    ['teacher', ['TEACHER_Q'], false],
    ['shlorio', ['DOWSER_Q'], false],
  ] as const) {
    const consumed = new Set<string>()
    speak(id, open(id, consumed), consumed)
    for (const key of keys) {
      speak(id, hubNpcQuestion(id, key, false, consumed), consumed)
      assert.equal(consumed.has(key), oneShot)
      assert.equal(hubNpcQuestion(id, key, false, consumed) === null, oneShot)
    }
  }
})

test('Skorcha finishes his first intro without appending a fallback, but greets exhausted re-entry', () => {
  const consumed = new Set<string>()
  const first = speak('skorcha', open('skorcha', consumed), consumed)
  assert.equal(first.next, 'close')
  const repeat = open('skorcha', consumed)
  assert.equal(repeat.kind === 'speech' ? repeat.key : null, 'ENFORCER_DISMISS1')
})

test('all three native Skorcha fallback indices pass through unchanged on exhausted re-entry', () => {
  const consumed = new Set(['ENFORCER_INTRO'])
  for (let index = 0; index < 3; index += 1) {
    const content = createHubNpcChatContent('skorcha', npc, index, null, false, null, consumed)
    assert.equal(content.kind === 'speech' ? content.key : null, `ENFORCER_DISMISS${index + 1}`)
  }
})

test('rendered and semantic choices receive one identical filtered projection', () => {
  const consumed = new Set(['ARCH_INTRO_0', 'ARCH_Q2_0'])
  const content = hubNpcChatChoiceContent('arch-chancellor', true, consumed)
  assert.equal(content.kind, 'choices')
  if (content.kind === 'choices') {
    assert.deepEqual(content.choices, hubNpcChatChoices('arch-chancellor', true, consumed))
    assert.deepEqual(content.choices?.map(row => row.label), ['Solomon Dark?', 'Assistance?'])
  }
})

test('initial render is pure; a fresh Game and story/survival variants own independent rows', () => {
  const consumed = new Set<string>()
  const first = open('arch-chancellor', consumed, true)
  assert.deepEqual(open('arch-chancellor', consumed, true), first)
  assert.equal(consumed.size, 0)
  speak('arch-chancellor', first, consumed, true)
  assert.equal(open('arch-chancellor', consumed, true).kind, 'choices')
  const survival = open('arch-chancellor', consumed)
  assert.equal(survival.kind === 'speech' ? survival.key : null, 'ARCH_INTRO')
  assert.deepEqual(open('arch-chancellor', new Set(), true), first)
  consumeHubNpcSpeech(consumed, 'polisher', 'ARCH_Q1_0', true)
  assert.equal(consumed.has('ARCH_Q1_0'), false)
})

test('paintings remain repeatable and service commands survive all native intro consumption', () => {
  const consumed = new Set<string>()
  for (const id of NATIVE_HUB_INTERACTION_IDS) {
    const graph = NATIVE_HUB_NPC_CATALOG.interactions[id]
    const first = speak(id, open(id, consumed), consumed)
    if (graph.intro === null) assert.deepEqual(open(id, consumed), first)
    assert.deepEqual(
      hubNpcChatChoices(id, false, consumed).filter(row => row.kind === 'command').map(row => row.selector),
      graph.commands.map(row => row.selector),
    )
  }
})
