import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_HUB_INTERACTION_IDS,
  NATIVE_HUB_NPC_CATALOG,
  createNativeHubNpcState,
  selectNativeBoast,
  succeedNativeBoast,
} from './core-kernels/native-hub-npc.ts'
import {
  createHubNpcChatContent,
  hubNpcChatChoices,
  hubNpcDismissal,
  hubNpcQuestion,
  hubNpcSelectorAction,
  hubNpcSelectorContent,
  hubNpcSelectorResponse,
  hubNpcSelectorRows,
  hubNpcSelectorTitle,
} from './hub-npc-dialogue.ts'

const PROGRESSION = { advancedUnlocks: Array<boolean>(8).fill(false) }

test('every compiled actor opens its exact aggregate intro and every painting owns its exact index', () => {
  const npc = createNativeHubNpcState()
  for (const interactionId of NATIVE_HUB_INTERACTION_IDS) {
    const interaction = NATIVE_HUB_NPC_CATALOG.interactions[interactionId]
    const initial = createHubNpcChatContent(interactionId, npc, 0)
    assert.equal(initial.kind, 'speech', `${interactionId} did not open speech`)
    if (initial.kind !== 'speech') continue
    if (interaction.intro !== null) {
      assert.equal(initial.key, interaction.intro)
      assert.deepEqual(initial.lines, NATIVE_HUB_NPC_CATALOG.dialogue[interaction.intro]?.lines)
    } else {
      assert.equal(initial.key, `SAY_EULOGY_${interaction.eulogyIndex}`)
      const principal = NATIVE_HUB_NPC_CATALOG.eulogies[`${interaction.eulogyIndex}`]
      assert.deepEqual(
        initial.lines,
        [...(principal === null ? [] : [principal]), NATIVE_HUB_NPC_CATALOG.badEulogies[0]],
      )
      assert.equal(initial.next, 'close')
    }
  }
})

test('the complete Chat graph exposes only compiled questions and command replacements', () => {
  assert.deepEqual(hubNpcChatChoices('annalist'), [{
    kind: 'command',
    label: 'Boast',
    selector: 'boast',
  }])
  assert.deepEqual(hubNpcChatChoices('teacher'), [{
    kind: 'command',
    label: 'Per$uade',
    selector: 'teacher-spells',
  }, {
    key: 'TEACHER_Q',
    kind: 'question',
    label: 'Spell Testing?',
  }])
  assert.deepEqual(hubNpcChatChoices('memorator').map(({ label }) => label), [
    'This memorial?',
    'These mages?',
  ])
  assert.deepEqual(hubNpcChatChoices('arch-chancellor').map(({ label }) => label), [
    'Equipment?',
  ])
  assert.equal(hubNpcQuestion('annalist', 'ANNAL_Q'), null)
  const teacher = hubNpcQuestion('teacher', 'TEACHER_Q')
  assert.equal(teacher?.kind, 'speech')
  if (teacher?.kind === 'speech') {
    assert.deepEqual(teacher.lines, NATIVE_HUB_NPC_CATALOG.dialogue.TEACHER_Q?.lines)
    assert.equal(teacher.next, 'choices')
  }

  assert.equal(hubNpcSelectorContent('hagatha'), null)
  assert.deepEqual(hubNpcSelectorContent('boast'), { kind: 'selector', selector: 'boast' })
  assert.deepEqual(hubNpcSelectorContent('books'), { kind: 'selector', selector: 'books' })
  assert.deepEqual(hubNpcSelectorContent('teacher-spells'), {
    kind: 'selector',
    selector: 'teacher-spells',
  })
})

test('the first story Office selects every Archchancellor and Polisher row before Create', () => {
  const npc = createNativeHubNpcState()
  const arch = createHubNpcChatContent('arch-chancellor', npc, 0, null, true)
  assert.equal(arch.kind, 'speech')
  if (arch.kind === 'speech') {
    assert.equal(arch.key, 'ARCH_INTRO_0')
    assert.deepEqual(
      arch.lines,
      NATIVE_HUB_NPC_CATALOG.storyOffice.dialogue.ARCH_INTRO_0?.lines,
    )
  }
  assert.deepEqual(
    hubNpcChatChoices('arch-chancellor', true).map(({ label }) => label),
    ['Solomon Dark?', 'Collateral Damage?', 'Assistance?'],
  )
  assert.equal(
    hubNpcQuestion('arch-chancellor', 'ARCH_Q3_0', true)?.kind,
    'speech',
  )
  assert.equal(
    hubNpcDismissal('arch-chancellor', 0, true)?.kind === 'speech'
      ? hubNpcDismissal('arch-chancellor', 0, true)?.key
      : null,
    'ARCH_DISMISS_0',
  )

  const polisher = createHubNpcChatContent('polisher', npc, 0, null, true)
  assert.equal(polisher.kind, 'speech')
  if (polisher.kind === 'speech') assert.equal(polisher.key, 'POLISHER_INTRO_0')
  assert.deepEqual(
    hubNpcChatChoices('polisher', true).map(({ label }) => label),
    ['Your task?', 'The Plaque'],
  )
  assert.equal(
    hubNpcDismissal('polisher', 0, true)?.kind === 'speech'
      ? hubNpcDismissal('polisher', 0, true)?.key
      : null,
    'POLISHER_DISMISS_0',
  )
})

test('Skorcha, Declarius, and the Archchancellor expose every compiled dismissal', () => {
  for (const [interactionId, keys] of [
    ['skorcha', ['ENFORCER_DISMISS1', 'ENFORCER_DISMISS2', 'ENFORCER_DISMISS3']],
    ['memorator', ['MEMORATOR_DISMISS']],
    ['arch-chancellor', ['ARCH_DISMISS']],
  ] as const) {
    assert.deepEqual(keys.map((_, index) => {
      const dismissal = hubNpcDismissal(interactionId, index)
      assert.equal(dismissal?.kind, 'speech')
      return dismissal?.kind === 'speech' ? dismissal.key : null
    }), keys)
  }
  assert.equal(hubNpcDismissal('annalist', 0), null)
})

test('successful Boast suppresses the bad-eulogy tail without inventing Painting 100 copy', () => {
  const success = succeedNativeBoast(selectNativeBoast(createNativeHubNpcState(), 0)!)
  const ordinary = createHubNpcChatContent('painting-0', success, 7)
  assert.equal(ordinary.kind, 'speech')
  if (ordinary.kind === 'speech') {
    assert.deepEqual(ordinary.lines, [NATIVE_HUB_NPC_CATALOG.eulogies['0']])
  }
  const empty = createHubNpcChatContent('painting-100', success, 7)
  assert.equal(empty.kind, 'speech')
  if (empty.kind === 'speech') assert.deepEqual(empty.lines, [])
})

test('a replaced Painting formats its live external portrait id', () => {
  const npc = createNativeHubNpcState()
  const external = createHubNpcChatContent('painting-1', npc, 0, 101)
  assert.equal(external.kind, 'speech')
  if (external.kind !== 'speech') return
  assert.equal(external.key, 'SAY_EULOGY_101')
  assert.deepEqual(external.lines, [NATIVE_HUB_NPC_CATALOG.badEulogies[0]])
})

test('all three selector families expose exact rows, actions, titles, and response ownership', () => {
  const npc = createNativeHubNpcState()
  const boasts = hubNpcSelectorRows('boast', npc, PROGRESSION)
  assert.deepEqual(boasts.map(({ id, label }) => [id, label]),
    NATIVE_HUB_NPC_CATALOG.boasts.map(({ id, label }) => [id, label]))
  assert.equal(hubNpcSelectorTitle('boast'), 'SELECT A BOAST')
  assert.deepEqual(hubNpcSelectorAction('boast', 2), { boastId: 2, type: 'select-boast' })
  const boastResponse = hubNpcSelectorResponse('boast', 2)
  assert.equal(boastResponse?.kind, 'speech')
  if (boastResponse?.kind === 'speech') {
    assert.equal(boastResponse.key, 'ANNAL_SECONDARIESBOAST')
    assert.equal(boastResponse.next, 'close')
  }

  const books = hubNpcSelectorRows('books', npc, PROGRESSION)
  assert.equal(books.length, 26)
  assert.equal(hubNpcSelectorTitle('books'), 'SELECT A BOOK')
  assert.deepEqual(hubNpcSelectorAction('books', 25), {
    bookId: 25,
    type: 'read-librarian-book',
  })
  const bookResponse = hubNpcSelectorResponse('books', 25)
  assert.equal(bookResponse?.kind, 'speech')
  if (bookResponse?.kind === 'speech') {
    assert.equal(bookResponse.key, 'BOOK25_LACE')
    assert.equal(bookResponse.next, 'choices')
  }

  const spells = hubNpcSelectorRows('teacher-spells', npc, PROGRESSION)
  assert.equal(spells.length, 8)
  assert.deepEqual(spells.map(({ id, price }) => [id, price]), [
    [72, 3000], [73, 3500], [74, 4200], [75, 5000],
    [79, 5100], [78, 5300], [77, 6100], [76, 10000],
  ])
  assert.equal(hubNpcSelectorTitle('teacher-spells'), 'SELECT A SPELL')
  assert.deepEqual(hubNpcSelectorRows('teacher-spells', npc, {
    advancedUnlocks: Array<boolean>(8).fill(true),
  }), [])
  assert.deepEqual(hubNpcSelectorAction('teacher-spells', 76), {
    skillId: 76,
    type: 'buy-teacher-spell',
  })
  const spellResponse = hubNpcSelectorResponse('teacher-spells', 76)
  assert.equal(spellResponse?.kind, 'speech')
  if (spellResponse?.kind === 'speech') {
    assert.equal(spellResponse.key, 'CALL_COMET')
    assert.equal(spellResponse.next, 'choices')
  }
  assert.equal(hubNpcSelectorResponse('books', 99), null)
})
