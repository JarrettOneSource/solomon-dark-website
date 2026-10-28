import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buyTeacherSpell,
  createHubEconomy,
  readLibrarianBook,
  reconcileHubEconomyModPackages,
  selectHubBoast,
} from './hub-economy.ts'
import {
  NATIVE_BOASTS,
  NATIVE_BOAST_PRESENTATION,
  NATIVE_BOAST_SUCCESS_WAVE,
  NATIVE_HUB_INTERACTION_IDS,
  NATIVE_HUB_NPC_CATALOG,
  NATIVE_LIBRARIAN_BOOKS,
  NATIVE_SELECTOR_ACCEPT_TICKS,
  NATIVE_TEACHER_SPELLS,
  acknowledgeNativeHubNpcHint,
  createNativeHubNpcState,
  failNativeBoast,
  nativeBoastFailureText,
  nativeBoastScore,
  nativeHubNpcHintIndex,
  nativeLibrarianBooks,
  nativeTeacherSpells,
  readNativeLibrarianBook,
  resetNativeRunNpcState,
  selectNativeBoast,
  succeedNativeBoast,
  type NativeBoastFailureProducer,
} from './native-hub-npc.ts'
import {
  boastFailureText,
  boastUsesRandomSkillChoices,
  createBoastState,
  createModBoastSelection,
  failBoast,
  scoreBoast,
  selectBoast,
  succeedBoast,
  type BoastDefinition,
} from './boast.ts'

test('fresh profiles own all ten native help rows and only three named actors clear them', () => {
  const initial = createNativeHubNpcState()
  assert.deepEqual(initial.helpFlags, Array<boolean>(10).fill(true))
  assert.equal(nativeHubNpcHintIndex('annalist'), 0)
  assert.equal(nativeHubNpcHintIndex('fomentius'), 1)
  assert.equal(nativeHubNpcHintIndex('luthacus'), 2)
  assert.equal(nativeHubNpcHintIndex('hagatha'), null)
  assert.equal(nativeHubNpcHintIndex('teacher'), null)

  const annalist = acknowledgeNativeHubNpcHint(initial, 'annalist')
  assert.equal(annalist.helpFlags[0], false)
  assert.deepEqual(annalist.helpFlags.slice(1), initial.helpFlags.slice(1))
  const fomentius = acknowledgeNativeHubNpcHint(annalist, 'fomentius')
  const luthacus = acknowledgeNativeHubNpcHint(fomentius, 'luthacus')
  assert.deepEqual(luthacus.helpFlags, [
    false, false, false, true, true, true, true, true, true, true,
  ])
  assert.equal(acknowledgeNativeHubNpcHint(luthacus, 'luthacus'), luthacus)
  assert.equal(acknowledgeNativeHubNpcHint(luthacus, 'hagatha'), luthacus)
})

test('the generated catalog owns every compiled survival Hub actor and painting', () => {
  assert.equal(NATIVE_HUB_INTERACTION_IDS.length, 20)
  assert.deepEqual(NATIVE_HUB_INTERACTION_IDS, [
    'hagatha', 'fomentius', 'annalist', 'luthacus', 'skorcha', 'teacher',
    'memorator', 'painting-0', 'painting-1', 'painting-100', 'painting-3',
    'painting-4', 'painting-5', 'painting-6', 'painting-7', 'painting-8',
    'painting-9', 'librarian', 'shlorio', 'arch-chancellor',
  ])
  assert.deepEqual(
    Object.values(NATIVE_HUB_NPC_CATALOG.interactions).flatMap(({ commands }) => (
      commands.map(({ nativeCommand }) => nativeCommand)
    )),
    ['!BUYPERKS', '!BUYPOTIONS', '!BOAST', '!INVENTORY', '!SPELLS', '!BOOKS', '!DOWSE'],
  )
  assert.deepEqual(NATIVE_BOAST_PRESENTATION.iconRecords, [90, 91, 92, 93, 94, 95, 96, 97])
  assert.deepEqual(NATIVE_BOAST_PRESENTATION.outer, {
    centerYOffset: 70,
    height: 560,
    panelRecord: 11,
    width: 700,
  })
  assert.deepEqual(NATIVE_BOAST_PRESENTATION.row, {
    firstTop: 25,
    height: 85,
    left: 15,
    pitch: 90,
    record: 50,
    widthInset: 30,
  })
  assert.deepEqual(NATIVE_BOAST_PRESENTATION.selectedBaseTint, [0.5, 1, 0.5, 1])
  assert.equal(NATIVE_BOAST_PRESENTATION.selectedSaturation, 0.6)
  assert.equal('ANNAL_Q' in NATIVE_HUB_NPC_CATALOG.dialogue, false)
  assert.equal(
    Object.values(NATIVE_HUB_NPC_CATALOG.interactions).flatMap(({ questions }) => questions).length,
    6,
  )
  assert.equal(NATIVE_HUB_NPC_CATALOG.eulogies['100'], null)
  assert.ok(NATIVE_HUB_INTERACTION_IDS.filter(id => id.startsWith('painting-')).every(id => {
    const geometry = NATIVE_HUB_NPC_CATALOG.interactions[id].geometry
    return geometry.radius === 15 && geometry.rangeRadius === 40
  }))
  assert.deepEqual(
    Object.keys(NATIVE_HUB_NPC_CATALOG.storyOffice.dialogue),
    [
      'ARCH_DISMISS_0',
      'ARCH_INTRO_0',
      'ARCH_Q1_0',
      'ARCH_Q2_0',
      'ARCH_Q3_0',
      'POLISHER_DISMISS_0',
      'POLISHER_INTRO_0',
      'POLISHER_Q1_0',
      'POLISHER_Q2_0',
    ],
  )
  assert.deepEqual(
    NATIVE_HUB_NPC_CATALOG.storyOffice.interactions.polisher.geometry,
    { position: { x: 566, y: 735 }, radius: 15, region: 'office' },
  )
  assert.deepEqual(NATIVE_HUB_NPC_CATALOG.storyOffice.polisher, {
    loopFullDistance: 50,
    loopSilentDistance: 200,
  })
})

test('Provokatus owns all five Boasts and each producer fails exactly its own challenge once', () => {
  assert.equal(NATIVE_BOAST_SUCCESS_WAVE, 30)
  assert.equal(NATIVE_SELECTOR_ACCEPT_TICKS, 100)
  assert.deepEqual(NATIVE_BOASTS.map(({ id, label, failureProducer }) => ({
    failureProducer,
    id,
    label,
  })), [
    { failureProducer: 'potion-use', id: 0, label: 'POTIONS ARE FOR PEASANTS!' },
    { failureProducer: 'magical-equipment', id: 1, label: "I'M TOO MACHO FOR MAGIC!" },
    { failureProducer: 'secondary-cast', id: 2, label: 'SECONDARIES ARE SISSY!' },
    { failureProducer: null, id: 3, label: 'I AM ONE WITH THE MAGIC!' },
    { failureProducer: 'mana-underflow', id: 4, label: 'I NEVER RUN OUT OF MANA!' },
  ])

  const producers: readonly NativeBoastFailureProducer[] = [
    'potion-use',
    'magical-equipment',
    'secondary-cast',
    'mana-underflow',
  ]
  for (const boast of NATIVE_BOASTS) {
    const selected = selectNativeBoast(createNativeHubNpcState(), boast.id)!
    for (const producer of producers) {
      const failed = failNativeBoast(selected, producer)
      if (producer === boast.failureProducer) {
        assert.equal(failed.boast.failed, true, `Boast ${boast.id} ignored ${producer}`)
        assert.equal(failed.boast.failureSequence, 1)
        assert.equal(nativeBoastFailureText(failed.boast), `FAILED "${boast.label}"`)
        assert.equal(failNativeBoast(failed, producer), failed)
      } else {
        assert.equal(failed, selected, `Boast ${boast.id} consumed unrelated ${producer}`)
      }
    }
  }
})

test('Boast success and score use the stock one-shot state and float truncation', () => {
  const selected = selectNativeBoast(createNativeHubNpcState(), 0)!
  const succeeded = succeedNativeBoast(selected)
  assert.equal(succeeded.boast.succeeded, true)
  assert.equal(nativeBoastScore(101, succeeded.boast), 111)
  assert.equal(nativeBoastScore(101, selected.boast), 101)
  assert.equal(succeedNativeBoast(failNativeBoast(selected, 'potion-use')).boast.succeeded, false)
  assert.throws(() => nativeBoastScore(-1, succeeded.boast), /non-negative safe integer/)

  const durable = readNativeLibrarianBook(succeeded, 25)!
  const reset = resetNativeRunNpcState(durable)
  assert.equal(reset.boast.selected, null)
  assert.equal(reset.boast.failed, false)
  assert.equal(reset.boast.succeeded, false)
  assert.equal(reset.librarianLaceRead, true)
})

test('namespaced mod Boasts reuse the authoritative lifecycle without occupying stock IDs', () => {
  const selection = createModBoastSelection('5000000000000000016', 'example.boasts')
  const definition: BoastDefinition = Object.freeze({
    failureProducers: Object.freeze(['potion-use', 'magical-equipment']),
    instruction: 'Survive through Wave 25.',
    label: 'EMPTY HANDS, FULL GLORY!',
    randomSkillChoices: true,
    scoreMultiplier: 1.25,
    selection,
    statement: '"I need neither potion nor enchanted equipment!"',
    successWave: 25,
  })
  const resolve = (candidate: typeof selection | number) => (
    typeof candidate !== 'number' && candidate.contentId === selection.contentId
      ? definition
      : null
  )
  const selected = selectBoast(createBoastState(), definition)
  assert.deepEqual(selected.selected, selection)
  assert.equal(boastUsesRandomSkillChoices(selected, resolve), true)
  assert.equal(succeedBoast(selected, 24, resolve), selected)
  const succeeded = succeedBoast(selected, 25, resolve)
  assert.equal(succeeded.succeeded, true)
  assert.equal(scoreBoast(101, succeeded, resolve), 126)
  const failed = failBoast(selected, 'potion-use', resolve)
  assert.equal(failed.failed, true)
  assert.equal(boastFailureText(failed, resolve), 'FAILED "EMPTY HANDS, FULL GLORY!"')
  assert.equal(succeedBoast(failed, 25, resolve), failed)
  assert.equal(failBoast(selected, 'mana-underflow', resolve), selected)
})

test('Semicus exposes all 26 exact books and removes only one-shot Lace after reading it', () => {
  assert.equal(NATIVE_LIBRARIAN_BOOKS.length, 26)
  assert.deepEqual(NATIVE_LIBRARIAN_BOOKS.map(({ id }) => id), [...Array(26).keys()])
  assert.equal(NATIVE_LIBRARIAN_BOOKS[25]?.key, 'BOOK25_LACE')
  assert.equal(NATIVE_LIBRARIAN_BOOKS[25]?.oneShot, true)
  assert.ok(NATIVE_LIBRARIAN_BOOKS.every(({ lines }) => lines.length > 0))

  const initial = createNativeHubNpcState()
  assert.equal(nativeLibrarianBooks(initial).length, 26)
  const read = readNativeLibrarianBook(initial, 25)!
  assert.equal(read.librarianLaceRead, true)
  assert.deepEqual(nativeLibrarianBooks(read).map(({ id }) => id), [...Array(25).keys()])
  assert.equal(readNativeLibrarianBook(read, 25), null)
  assert.equal(readNativeLibrarianBook(read, 0), read)
})

test('Machinimbus offers the exact eight prices and purchases only unlock future acquisition', () => {
  assert.deepEqual(NATIVE_TEACHER_SPELLS.map(({ skillId, name, price }) => ({
    name,
    price,
    skillId,
  })), [
    { name: 'ACID RAIN', price: 3000, skillId: 72 },
    { name: 'FIRE WALL', price: 3500, skillId: 73 },
    { name: 'ETHER DRAIN', price: 4200, skillId: 74 },
    { name: 'IRON GOLEM', price: 5000, skillId: 75 },
    { name: 'REGENERATE', price: 5100, skillId: 79 },
    { name: 'MINDSTAR', price: 5300, skillId: 78 },
    { name: 'TURN UNDEAD', price: 6100, skillId: 77 },
    { name: 'CALL COMET', price: 10000, skillId: 76 },
  ])
  const unlocked = [true, false, false, false, false, false, false, true]
  assert.deepEqual(nativeTeacherSpells(unlocked).map(({ skillId }) => skillId), [73, 74, 75, 78, 77, 76])

  const poor = buyTeacherSpell(createHubEconomy(1), 72, Array(8).fill(false))
  assert.equal(poor.accepted, false)
  assert.equal(poor.reason, 'insufficient-gold')
  const rich = { ...createHubEconomy(1), gold: 20_000 }
  const bought = buyTeacherSpell(rich, 72, Array(8).fill(false))
  assert.equal(bought.accepted, true)
  assert.equal(bought.state.gold, 17_000)
  assert.equal(buyTeacherSpell(rich, 72, [true, ...Array(7).fill(false)]).reason, 'invalid-offer')
})

test('Hub economy actions persist Boast and Lace mutations under authoritative revision feedback', () => {
  const economy = createHubEconomy(9)
  const selected = selectHubBoast(economy, 4)
  assert.equal(selected.accepted, true)
  assert.equal(selected.state.npc.boast.selected, 4)
  assert.equal(selected.state.revision, economy.revision + 1)

  const ordinary = readLibrarianBook(selected.state, 3)
  assert.equal(ordinary.accepted, true)
  assert.equal(ordinary.state.npc.librarianLaceRead, false)
  const lace = readLibrarianBook(ordinary.state, 25)
  assert.equal(lace.accepted, true)
  assert.equal(lace.state.npc.librarianLaceRead, true)
  assert.equal(readLibrarianBook(lace.state, 25).reason, 'invalid-offer')
})

test('Hub economy retains admitted mod Boasts and clears them with their removed package', () => {
  const selection = createModBoastSelection('5000000000000000016', 'example.boasts')
  const definition: BoastDefinition = {
    failureProducers: [],
    instruction: 'Survive.',
    label: 'MOD BOAST',
    randomSkillChoices: false,
    scoreMultiplier: 1.1,
    selection,
    statement: '"Statement."',
    successWave: 30,
  }
  const selected = selectHubBoast(createHubEconomy(11), selection, () => definition)
  assert.equal(selected.accepted, true)
  assert.deepEqual(selected.state.npc.boast.selected, selection)
  assert.equal(
    reconcileHubEconomyModPackages(selected.state, ['example.boasts']),
    selected.state,
  )
  assert.deepEqual(reconcileHubEconomyModPackages(selected.state, []).npc.boast, createBoastState())
})
