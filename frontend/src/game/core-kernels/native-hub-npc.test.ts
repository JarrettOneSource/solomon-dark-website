import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buyTeacherSpell,
  createHubEconomy,
  readLibrarianBook,
  selectHubBoast,
} from './hub-economy.ts'
import {
  NATIVE_BOASTS,
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

test('the generated catalog owns every compiled survival Hub actor, painting, and source hash', () => {
  assert.equal(NATIVE_HUB_NPC_CATALOG.schema, 'solomon-dark-native-hub-npc-interactions-v2')
  assert.equal(NATIVE_HUB_NPC_CATALOG.source.retailVersion, '0.72.5')
  assert.equal(
    NATIVE_HUB_NPC_CATALOG.source.executableSha256,
    '03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3',
  )
  assert.deepEqual(NATIVE_HUB_NPC_CATALOG.source.dialogueHashes, {
    'books.txt': 'd7ca0a36c2fe6af90a4a950d5ff3dab7638f43640de97684eb6a7583a02b24a1',
    'narration.txt': '5a80f605f8fcac7fc634f8234d5b0a0173d3d4aa563dc076cc6d1b4dbc649174',
    'spellfacts.txt': '1d78d408664ea830465e7e5a8b56df2c6373cb4f6685dc025a1a6d0f90ab0e17',
    'survival.txt': '5e792f4dc692667d0ecaa4e7304202f11d2d1cdc664820b97be83145fa3b2d67',
  })
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
  assert.equal('ANNAL_Q' in NATIVE_HUB_NPC_CATALOG.dialogue, false)
  assert.equal(
    Object.values(NATIVE_HUB_NPC_CATALOG.interactions).flatMap(({ questions }) => questions).length,
    6,
  )
  assert.deepEqual(NATIVE_HUB_NPC_CATALOG.skorcha.artRecords, [510, 511, 512, 513, 514, 515, 516])
  assert.equal(NATIVE_HUB_NPC_CATALOG.eulogies['100'], null)
  assert.ok(NATIVE_HUB_INTERACTION_IDS.filter(id => id.startsWith('painting-')).every(id => {
    const geometry = NATIVE_HUB_NPC_CATALOG.interactions[id].geometry
    return geometry.radius === 15 && geometry.rangeRadius === 40
  }))
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
        assert.equal(nativeBoastFailureText(failed.boast), `FAILED ${boast.statement}`)
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
