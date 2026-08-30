import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { nativeBeltSkillProjection } from '../core-kernels/native-belt.ts'
import { deflateRawSync } from 'node:zlib'

import { createPlayerSkillBook } from '../core-kernels/player-progression.ts'
import { createNativeSecondaryPlayerState } from '../core-kernels/native-secondary-abilities.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import {
  decodeNativeDarkdata,
  encodeNativeDarkdata,
  encodeNativeSyncBuffer,
  nativeBytesEqual,
  parseNativeSyncBuffer,
  replaceNativeNodeChild,
} from './native-save-codec.ts'
import {
  decodeNativeDarkdataProfile,
  decodeNativeGamestateBoast,
  decodeNativeGamestateWizard,
  patchNativeDarkdata,
  patchNativeGamestate,
} from './native-save-bridge.ts'
import {
  createNativeSaveArchive,
  createStoredZip,
  nativeArchiveCrc32,
  readNativeSaveArchive,
  readZip,
} from './native-save-archive.ts'
import { readNativeSaveFileSelection } from './native-save-files.ts'
import {
  createPortableGameProfileFromNative,
  encodePortableGameProfile,
  parsePortableGameProfile,
  portableSha256,
  type PortableGameProfile,
} from './portable-game-profile.ts'
import {
  createPortableGameProfileFromWebSave,
  createWebGameSaveFromPortableProfile,
  exportWebGameSaveToNativeArchive,
} from './game-save-portability.ts'
import {
  createGameSaveDocument,
  restoreGameSaveDocument,
} from './game-save-document.ts'

interface TemplateFixture {
  expected: {
    disciplineRoot: number
    elementRoot: number
    experience: number
    level: number
    progressionRows: number
    runName: string
    startingPrimary: number
    startingSecondary: number
    wizardName: string
  }
  files: {
    darkdata: { base64: string; bytes: number; sha256: string }
    gamestate: { base64: string; bytes: number; sha256: string }
  }
  schema: string
}

const fixture = JSON.parse(readFileSync(
  new URL('../../../public/game/native/portable-profile-template.json', import.meta.url),
  'utf8',
)) as TemplateFixture

function bytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0))
}

function selectedFile(
  name: string,
  contents: Uint8Array,
  webkitRelativePath = '',
): File {
  const copy = contents.slice()
  return {
    arrayBuffer: async () => copy.slice().buffer as ArrayBuffer,
    name,
    webkitRelativePath,
  } as unknown as File
}

function nativeBindingLayout(source: Uint8Array) {
  const buffer = parseNativeSyncBuffer(source)
  const owner = buffer.root.children[1]!
  const node = owner.children[0]!
  const view = new DataView(node.payload.buffer, node.payload.byteOffset, node.payload.byteLength)
  const booleanCount = view.getUint32(0, true)
  const countOffset = 4 + booleanCount
  const integerCount = view.getUint32(countOffset, true)
  const valuesOffset = countOffset + 4
  assert.ok(valuesOffset + integerCount * 4 <= node.payload.byteLength)
  return { buffer, countOffset, integerCount, node, owner, valuesOffset }
}

function withNativeBindingIntegerCount(source: Uint8Array, integerCount: number): Uint8Array {
  const layout = nativeBindingLayout(source)
  assert.ok(integerCount >= 0)
  const originalEnd = layout.valuesOffset + layout.integerCount * 4
  const payload = new Uint8Array(
    layout.node.payload.byteLength + (integerCount - layout.integerCount) * 4,
  )
  payload.set(layout.node.payload.subarray(0, layout.countOffset))
  const view = new DataView(payload.buffer)
  view.setUint32(layout.countOffset, integerCount, true)
  const retainedCount = Math.min(integerCount, layout.integerCount)
  payload.set(
    layout.node.payload.subarray(
      layout.valuesOffset,
      layout.valuesOffset + retainedCount * 4,
    ),
    layout.valuesOffset,
  )
  for (let index = layout.integerCount; index < integerCount; index += 1) {
    view.setInt32(layout.valuesOffset + index * 4, 0x1000_0000 + index, true)
  }
  payload.set(
    layout.node.payload.subarray(originalEnd),
    layout.valuesOffset + integerCount * 4,
  )
  const owner = replaceNativeNodeChild(layout.owner, 0, { ...layout.node, payload })
  return encodeNativeSyncBuffer({
    ...layout.buffer,
    root: replaceNativeNodeChild(layout.buffer.root, 1, owner),
  })
}

function nativeBindingIntegers(source: Uint8Array): number[] {
  const layout = nativeBindingLayout(source)
  const view = new DataView(
    layout.node.payload.buffer,
    layout.node.payload.byteOffset,
    layout.node.payload.byteLength,
  )
  return Array.from(
    { length: layout.integerCount },
    (_, index) => view.getInt32(layout.valuesOffset + index * 4, true),
  )
}

function withEffectiveOnlyLearnedRow(
  source: Uint8Array,
  wizard: PortableGameProfile['wizard'],
  skillId: number,
  effectiveRank: number,
): Uint8Array {
  assert.equal(wizard.permanentRanks[skillId], 0)
  assert.equal(wizard.learnedOrder.includes(skillId), false)
  const ordered = patchNativeGamestate(source, {
    ...wizard,
    learnedOrder: [...wizard.learnedOrder, skillId],
  })
  const buffer = parseNativeSyncBuffer(ordered)
  const wizardNode = buffer.root.children[0]!
  const progressionNode = wizardNode.children[0]!
  const payload = progressionNode.payload.slice()
  const rowOffset = 4 + (82 - skillId) * 12
  new DataView(payload.buffer).setUint16(rowOffset + 2, effectiveRank, true)
  const nextWizard = replaceNativeNodeChild(wizardNode, 0, { ...progressionNode, payload })
  return encodeNativeSyncBuffer({
    ...buffer,
    root: replaceNativeNodeChild(buffer.root, 0, nextWizard),
  })
}

function withRetailNullBoastSentinel(source: Uint8Array): Uint8Array {
  const buffer = parseNativeSyncBuffer(source)
  const game = buffer.root.children[5]!
  const canonicalVariants = [
    Uint8Array.of(0xff, 0, 0, 0, 0, 1, 0, 0, 0, 0),
    Uint8Array.of(0xff, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0),
  ] as const
  const replacement = Uint8Array.of(0xff, 2, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0)
  const matches: Array<{ bytes: Uint8Array; offset: number }> = []
  for (const bytes of canonicalVariants) {
    for (let offset = 0; offset <= game.payload.byteLength - bytes.byteLength; offset += 1) {
      if (bytes.every((value, index) => game.payload[offset + index] === value)) {
        matches.push({ bytes, offset })
      }
    }
  }
  assert.equal(matches.length, 1)
  const match = matches[0]!
  const payload = new Uint8Array(
    game.payload.byteLength + replacement.byteLength - match.bytes.byteLength,
  )
  const selectedOffset = match.offset
  payload.set(game.payload.subarray(0, selectedOffset), 0)
  payload.set(replacement, selectedOffset)
  payload.set(
    game.payload.subarray(selectedOffset + match.bytes.byteLength),
    selectedOffset + replacement.byteLength,
  )
  return encodeNativeSyncBuffer({
    ...buffer,
    root: replaceNativeNodeChild(buffer.root, 5, { ...game, payload }),
  })
}

function deflatedZipWithDeclaredSize(
  path: string,
  contents: Uint8Array,
  declaredSize: number,
): Uint8Array {
  const name = new TextEncoder().encode(path)
  const compressed = new Uint8Array(deflateRawSync(contents))
  const write16 = (target: Uint8Array, offset: number, value: number) => {
    new DataView(target.buffer).setUint16(offset, value, true)
  }
  const write32 = (target: Uint8Array, offset: number, value: number) => {
    new DataView(target.buffer).setUint32(offset, value, true)
  }
  const local = new Uint8Array(30 + name.byteLength)
  write32(local, 0, 0x04034b50)
  write16(local, 4, 20)
  write16(local, 6, 0x0800)
  write16(local, 8, 8)
  write32(local, 14, nativeArchiveCrc32(contents))
  write32(local, 18, compressed.byteLength)
  write32(local, 22, declaredSize)
  write16(local, 26, name.byteLength)
  local.set(name, 30)
  const central = new Uint8Array(46 + name.byteLength)
  write32(central, 0, 0x02014b50)
  write16(central, 4, 20)
  write16(central, 6, 20)
  write16(central, 8, 0x0800)
  write16(central, 10, 8)
  write32(central, 16, nativeArchiveCrc32(contents))
  write32(central, 20, compressed.byteLength)
  write32(central, 24, declaredSize)
  write16(central, 28, name.byteLength)
  central.set(name, 46)
  const end = new Uint8Array(22)
  write32(end, 0, 0x06054b50)
  write16(end, 8, 1)
  write16(end, 10, 1)
  write32(end, 12, central.byteLength)
  write32(end, 16, local.byteLength + compressed.byteLength)
  const result = new Uint8Array(local.byteLength + compressed.byteLength + central.byteLength + end.byteLength)
  result.set(local, 0)
  result.set(compressed, local.byteLength)
  result.set(central, local.byteLength + compressed.byteLength)
  result.set(end, result.byteLength - end.byteLength)
  return result
}

const darkdata = bytes(fixture.files.darkdata.base64)
const gamestate = bytes(fixture.files.gamestate.base64)

test('native SyncBuffer and darkdata codecs reproduce the controlled stock-writer bytes', () => {
  assert.equal(darkdata.byteLength, fixture.files.darkdata.bytes)
  assert.equal(gamestate.byteLength, fixture.files.gamestate.bytes)
  assert.equal(nativeBytesEqual(
    encodeNativeDarkdata(decodeNativeDarkdata(darkdata)),
    darkdata,
  ), true)
  assert.equal(nativeBytesEqual(
    encodeNativeSyncBuffer(parseNativeSyncBuffer(gamestate)),
    gamestate,
  ), true)
  assert.throws(
    () => parseNativeSyncBuffer(new Uint8Array([...gamestate, 1])),
    /unclaimed bytes/,
  )
  assert.throws(
    () => createStoredZip([{ bytes: new Uint8Array(), path: '../escape' }]),
    /unsafe/,
  )
})

test('native local-wizard decoder closes all 83 rows and the exact disk toggle member', () => {
  const profile = decodeNativeDarkdataProfile(darkdata)
  const wizard = decodeNativeGamestateWizard(gamestate)
  assert.equal(profile.gold, 500)
  assert.equal(profile.helpPending.length, 10)
  assert.equal(profile.firstMixed.length, 30)
  assert.equal(wizard.name, fixture.expected.wizardName)
  assert.equal(wizard.rows.length, fixture.expected.progressionRows)
  assert.equal(wizard.elementRoot, fixture.expected.elementRoot)
  assert.equal(wizard.disciplineRoot, fixture.expected.disciplineRoot)
  assert.equal(wizard.startingPrimary, fixture.expected.startingPrimary)
  assert.equal(wizard.startingSecondary, fixture.expected.startingSecondary)
  assert.equal(wizard.firewalkerActive, false)
})

test('stock null-Boast sentinel survives strict stock-to-web decoding', async () => {
  const retailRewrite = withRetailNullBoastSentinel(gamestate)
  assert.deepEqual(decodeNativeGamestateBoast(retailRewrite), {
    failed: false,
    selected: null,
    succeeded: false,
  })
  assert.equal(
    nativeBytesEqual(encodeNativeSyncBuffer(parseNativeSyncBuffer(retailRewrite)), retailRewrite),
    true,
  )
  const portable = await createPortableGameProfileFromNative(
    darkdata,
    retailRewrite,
    fixture.expected.runName,
  )
  assert.equal(portable.wizard.name, fixture.expected.wizardName)
  assert.equal(portable.profile.boast.selected, null)
})

test('stock-rewritten zero root ranks reconstruct the complete class root book', async () => {
  const base = await createPortableGameProfileFromNative(
    darkdata,
    withRetailNullBoastSentinel(gamestate),
    fixture.expected.runName,
  )
  const permanentRanks = [...base.wizard.permanentRanks]
  permanentRanks.fill(0, 0, 8)
  const stockRewrite = patchNativeGamestate(
    withRetailNullBoastSentinel(gamestate),
    { ...base.wizard, permanentRanks },
  )
  assert.deepEqual(
    decodeNativeGamestateWizard(stockRewrite).rows.slice(0, 8)
      .map(row => row.permanentRank),
    Array(8).fill(0),
  )
  const portable = await createPortableGameProfileFromNative(
    darkdata,
    stockRewrite,
    fixture.expected.runName,
  )
  const restored = restoreGameSaveDocument(
    createWebGameSaveFromPortableProfile(portable).document,
  )
  assert.deepEqual(
    restored.state.playerEntities.skillBooks[0]?.permanentRanks.slice(0, 8),
    Array(8).fill(1),
  )
})

test('portable stock import builds one local-only authoritative Hub wizard and retains native bytes', async () => {
  const portable = await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    fixture.expected.runName,
  )
  const parsed = await parsePortableGameProfile(encodePortableGameProfile(portable))
  const imported = createWebGameSaveFromPortableProfile(parsed)
  const restored = restoreGameSaveDocument(imported.document)
  const skillBook = restored.state.playerEntities.skillBooks[0]!
  assert.equal(restored.integrity, 'local-only')
  assert.equal(restored.state.world.kind, 'hub')
  assert.equal(restored.nativeSource?.darkdataSha256, fixture.files.darkdata.sha256)
  assert.equal(restored.nativeSource?.gamestateSha256, fixture.files.gamestate.sha256)
  assert.deepEqual(skillBook.permanentRanks.slice(0, 8), Array(8).fill(1))
  assert.equal(restored.state.playerEntities.configs[0]?.displayName, fixture.expected.wizardName)
  assert.equal(restored.state.playerEntities.economies[0]?.gold, 500)
  assert.equal(restored.state.secondaryAbilities.players[restored.playerId]?.mindstar, false)
  assert.equal(restored.state.secondaryAbilities.players[restored.playerId]?.regenerate, false)
})

test('all native Boast IDs and terminal states round-trip through the Game payload', async () => {
  const base = await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    fixture.expected.runName,
  )
  const states = [
    { failed: false, selected: null, succeeded: false },
    ...([0, 1, 2, 3, 4] as const).flatMap(selected => [
      { failed: false, selected, succeeded: false },
      ...(selected === 3 ? [] : [{ failed: true, selected, succeeded: false }]),
      { failed: false, selected, succeeded: true },
    ]),
  ] as const
  for (const boast of states) {
    const patched = patchNativeGamestate(gamestate, base.wizard, boast)
    assert.deepEqual(decodeNativeGamestateBoast(patched), boast)
    assert.equal(decodeNativeGamestateWizard(patched).experienceEnabled, true)
    assert.equal(
      decodeNativeGamestateWizard(patched).randomBoastActive,
      boast.selected === 3,
    )
    const portable = await createPortableGameProfileFromNative(
      darkdata,
      patched,
      fixture.expected.runName,
    )
    const imported = createWebGameSaveFromPortableProfile(portable)
    const exported = await exportWebGameSaveToNativeArchive(imported.document)
    assert.deepEqual(
      decodeNativeGamestateBoast((await readNativeSaveArchive(exported.archive)).gamestate),
      boast,
    )
  }

  const randomBoast = { failed: false, selected: 3 as const, succeeded: false }
  const nativeWithBoast = patchNativeGamestate(gamestate, base.wizard, randomBoast)
  const portable = await createPortableGameProfileFromNative(
    darkdata,
    nativeWithBoast,
    fixture.expected.runName,
  )
  const imported = createWebGameSaveFromPortableProfile(portable)
  assert.deepEqual(
    restoreGameSaveDocument(imported.document).state.playerEntities.economies[0]?.npc.boast,
    { failed: false, failureSequence: 0, selected: 3, succeeded: false },
  )
  const malformedBoast = JSON.parse(encodePortableGameProfile(portable))
  malformedBoast.profile.boast = { failed: true, selected: null, succeeded: false }
  await assert.rejects(
    () => parsePortableGameProfile(JSON.stringify(malformedBoast)),
    /Boast lifecycle/,
  )
})

test('ordered Hagatha outcomes and repeated Tonic membership survive stock-web-stock', async () => {
  const base = await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    fixture.expected.runName,
  )
  const orderedBundle = [27, 5, 0, 27, 24]
  const nativeWithBundle = patchNativeDarkdata(darkdata, {
    ...base.profile,
    hagathaBundleSelectors: orderedBundle,
  })
  const ownership = [...base.wizard.hagathaOwnership]
  for (const selector of [0, 1, 2, 3, 5, 24, 25]) ownership[selector] = true
  ownership[27] = true
  const nativeWithTonics = patchNativeGamestate(gamestate, {
    ...base.wizard,
    hagathaOwnership: ownership,
    perkCapacity: 9,
    perkSelectors: [27, 5, 0, 27, 24, 25, 1, 2, 3],
  })
  const portable = await createPortableGameProfileFromNative(
    nativeWithBundle,
    nativeWithTonics,
    fixture.expected.runName,
  )
  assert.deepEqual(portable.profile.hagathaBundleSelectors, orderedBundle)
  const imported = createWebGameSaveFromPortableProfile(portable)
  const restored = restoreGameSaveDocument(imported.document)
  const economy = restored.state.playerEntities.economies[0]!
  assert.deepEqual(economy.hagathaBundleSelectors, orderedBundle)
  assert.deepEqual(economy.ownedPerkSelectors, [27, 5, 0, 27, 24, 25, 1, 2, 3])
  assert.equal(economy.tonicPurchases, 2)
  assert.equal(economy.charmCapacity, 9)
  assert.equal(restored.state.playerEntities.progressions[0]?.hagathaRuntime.serendipityActive, false)
  assert.equal(restored.state.playerEntities.progressions[0]?.hagathaRuntime.reverieActive, false)

  const exported = await createPortableGameProfileFromWebSave(imported.document)
  assert.deepEqual(exported.profile.hagathaBundleSelectors, orderedBundle)
  assert.deepEqual(exported.wizard.perkSelectors, [27, 5, 0, 27, 24, 25, 1, 2, 3])
  assert.deepEqual(
    exported.wizard.hagathaOwnership.flatMap((owned, selector) => owned ? [selector] : []),
    [0, 1, 2, 3, 5, 24, 25, 27],
  )
  const archive = await exportWebGameSaveToNativeArchive(imported.document)
  const decodedArchive = await readNativeSaveArchive(archive.archive)
  assert.deepEqual(
    decodeNativeDarkdataProfile(decodedArchive.darkdata).hagathaBundleSelectors,
    orderedBundle,
  )
  assert.deepEqual(
    decodeNativeGamestateWizard(decodedArchive.gamestate).perkSelectors,
    [27, 5, 0, 27, 24, 25, 1, 2, 3],
  )

  const thirdTonic = JSON.parse(encodePortableGameProfile(portable))
  thirdTonic.wizard.perkSelectors.push(27)
  await assert.rejects(
    () => parsePortableGameProfile(JSON.stringify(thirdTonic)),
    /native outcome list/,
  )
  const tenthOrdinary = JSON.parse(encodePortableGameProfile(portable))
  tenthOrdinary.wizard.perkSelectors.push(4)
  tenthOrdinary.wizard.hagathaOwnership[4] = true
  await assert.rejects(
    () => parsePortableGameProfile(JSON.stringify(tenthOrdinary)),
    /native outcome list|Hagatha outcomes/,
  )
})

test('selected primary, concentrations, replacement cursor, and skill Belt survive stock-web-stock', async () => {
  const base = await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    fixture.expected.runName,
  )
  const ranks = [...base.wizard.permanentRanks]
  ranks[8] = 1
  ranks[57] = 1
  const nativeSelections = patchNativeGamestate(gamestate, {
    ...base.wizard,
    concentrationSkillIds: [57, null],
    learnedOrder: [...base.wizard.learnedOrder, 8, 57],
    nextConcentrationSlot: 1,
    permanentRanks: ranks,
    selectedPrimarySkillId: 8,
    skillQuickbar: [21, 8, null, null, null, null, null, null],
  })
  const decodedNative = decodeNativeGamestateWizard(nativeSelections)
  assert.equal(decodedNative.selectedPrimarySkillId, 8)
  assert.deepEqual(decodedNative.concentrationSkillIds, [57, null])
  assert.equal(decodedNative.nextConcentrationSlot, 1)
  assert.deepEqual(decodedNative.skillQuickbar, [21, 8, null, null, null, null, null, null])

  const portable = await createPortableGameProfileFromNative(
    darkdata,
    nativeSelections,
    fixture.expected.runName,
  )
  const imported = createWebGameSaveFromPortableProfile(portable)
  const restored = restoreGameSaveDocument(imported.document)
  const book = restored.state.playerEntities.skillBooks[0]!
  const belt = restored.state.playerEntities.belts[0]!
  const runtime = restored.state.playerEntities.skillRuntimes[0]!
  assert.equal(book.primarySkillId, 8)
  assert.deepEqual(nativeBeltSkillProjection(belt), [21, 8, null, null, null, null, null, null])
  assert.equal(runtime.concentrationSkillIdA, 57)
  assert.equal(runtime.nextConcentrationReplacementSlot, 'b')

  const exported = await exportWebGameSaveToNativeArchive(imported.document)
  const roundTrip = decodeNativeGamestateWizard(
    (await readNativeSaveArchive(exported.archive)).gamestate,
  )
  assert.equal(roundTrip.selectedPrimarySkillId, 8)
  assert.deepEqual(roundTrip.concentrationSkillIds, [57, null])
  assert.equal(roundTrip.nextConcentrationSlot, 1)
  assert.deepEqual(roundTrip.skillQuickbar, [21, 8, null, null, null, null, null, null])
})

test('native patching changes mapped state and leaves structural siblings round-trippable', async () => {
  const portable = await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    fixture.expected.runName,
  )
  const profilePatch = {
    ...portable.profile,
    firstMixed: portable.profile.firstMixed.map((value, index) => value || index === 2),
    gold: 12_345,
    librarianLaceRead: true,
  }
  const ranks = [...portable.wizard.permanentRanks]
  ranks[9] = 2
  const wizardPatch = {
    ...portable.wizard,
    firewalkerActive: true,
    learnedOrder: [...portable.wizard.learnedOrder, 9],
    level: 2,
    name: 'PORTABILIS',
    nextThreshold: 160,
    permanentRanks: ranks,
    previousThreshold: 90,
  }
  const nextDarkdata = patchNativeDarkdata(darkdata, profilePatch)
  const nextGamestate = patchNativeGamestate(gamestate, wizardPatch)
  const decodedProfile = decodeNativeDarkdataProfile(nextDarkdata)
  const decodedWizard = decodeNativeGamestateWizard(nextGamestate)
  assert.equal(decodedProfile.gold, 12_345)
  assert.equal(decodedProfile.librarianLaceRead, true)
  assert.equal(decodedWizard.name, 'PORTABILIS')
  assert.equal(decodedWizard.rows[9]?.permanentRank, 2)
  assert.equal(decodedWizard.learnedOrder.at(-1), 9)
  assert.equal(decodedWizard.firewalkerActive, true)
  assert.equal(nativeBytesEqual(
    encodeNativeDarkdata(decodeNativeDarkdata(nextDarkdata)),
    nextDarkdata,
  ), true)
  assert.equal(nativeBytesEqual(
    encodeNativeSyncBuffer(parseNativeSyncBuffer(nextGamestate)),
    nextGamestate,
  ), true)
})

test('stock import models the Unforge HP/MP disk defect and preserves vital ratios only', async () => {
  const base = await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    fixture.expected.runName,
  )
  const withUnserializedBases = patchNativeGamestate(gamestate, {
    ...base.wizard,
    currentHealth: 37.5,
    currentMana: 75,
    maximumHealth: 75,
    maximumMana: 150,
  })
  const portable = await createPortableGameProfileFromNative(
    darkdata,
    withUnserializedBases,
    fixture.expected.runName,
  )
  const restored = restoreGameSaveDocument(
    createWebGameSaveFromPortableProfile(portable).document,
  )
  const progression = restored.state.playerEntities.progressions[0]!
  assert.equal(progression.maximumHealth, 50)
  assert.equal(progression.maximumMana, 100)
  assert.equal(progression.currentHealth, 25)
  assert.equal(progression.currentMana, 50)
  assert.match(portable.warnings.join('\n'), /omits Unforge base HP\/MP/)
})

test('launcher archive write/read preserves hashes and rejects manifest drift', async () => {
  const portrait = Uint8Array.of(1, 2, 3, 4)
  const archive = await createNativeSaveArchive({
    darkdata,
    gamestate,
    retainedFiles: [{ bytes: portrait, path: 'solomondark/Portraits/portrait100.raw' }],
    runName: fixture.expected.runName,
  })
  const restored = await readNativeSaveArchive(archive)
  assert.equal(restored.runName, fixture.expected.runName)
  assert.equal(nativeBytesEqual(restored.darkdata, darkdata), true)
  assert.equal(nativeBytesEqual(restored.gamestate, gamestate), true)
  assert.equal(restored.retainedFiles?.length, 1)
  assert.equal(nativeBytesEqual(restored.retainedFiles![0]!.bytes, portrait), true)
  const corrupt = archive.slice()
  corrupt[40] = corrupt[40]! ^ 1
  await assert.rejects(() => readNativeSaveArchive(corrupt), /integrity|metadata|manifest|sizes/)

  const upperDark = 'SolomonDark/darkdata.cfg'
  const upperGame = 'SolomonDark/savegames/CaseRun/gamestate.sav'
  const upperPortrait = 'SolomonDark/Portraits/portrait100.raw'
  const manifest = {
    files: [
      { path: upperDark, sha256: await portableSha256(darkdata), size: darkdata.byteLength },
      { path: upperGame, sha256: await portableSha256(gamestate), size: gamestate.byteLength },
      { path: upperPortrait, sha256: await portableSha256(portrait), size: portrait.byteLength },
    ],
    name: 'Case Test',
    schemaVersion: 1,
    slot: 0,
  }
  const caseArchive = createStoredZip([
    { bytes: new TextEncoder().encode(JSON.stringify(manifest)), path: 'MANIFEST.JSON' },
    { bytes: darkdata, path: `savegames/${upperDark}` },
    { bytes: gamestate, path: `savegames/${upperGame}` },
    { bytes: portrait, path: `savegames/${upperPortrait}` },
  ])
  const caseRestored = await readNativeSaveArchive(caseArchive)
  assert.equal(caseRestored.runName, 'CaseRun')
  assert.equal(caseRestored.retainedFiles?.[0]?.path, upperPortrait)

  const duplicateManifest = {
    ...manifest,
    files: [manifest.files[0], manifest.files[0], manifest.files[1]],
  }
  const unlistedArchive = createStoredZip([
    { bytes: new TextEncoder().encode(JSON.stringify(duplicateManifest)), path: 'manifest.json' },
    { bytes: darkdata, path: `savegames/${upperDark}` },
    { bytes: gamestate, path: `savegames/${upperGame}` },
    { bytes: portrait, path: `savegames/${upperPortrait}` },
  ])
  await assert.rejects(() => readNativeSaveArchive(unlistedArchive), /duplicate paths/)

  const overexpanding = deflatedZipWithDeclaredSize(
    'savegames/solomondark/portrait.raw',
    new Uint8Array(64 * 1024).fill(65),
    1,
  )
  await assert.rejects(() => readZip(overexpanding), /declared size/)
})

test('active-run binding tables follow their live count and preserve opaque members', async () => {
  const activeGamestate = withNativeBindingIntegerCount(gamestate, 113)
  const activeBindings = nativeBindingIntegers(activeGamestate)
  assert.equal(activeBindings.length, 113)
  assert.equal(activeBindings[12], fixture.expected.startingPrimary)

  const decoded = decodeNativeGamestateWizard(activeGamestate)
  assert.equal(decoded.name, fixture.expected.wizardName)
  assert.equal(decoded.rows.length, 83)
  const portable = await createPortableGameProfileFromNative(
    darkdata,
    activeGamestate,
    fixture.expected.runName,
  )
  const patched = patchNativeGamestate(activeGamestate, {
    ...portable.wizard,
    name: 'ACTIVUS',
  })
  const patchedBindings = nativeBindingIntegers(patched)
  assert.equal(decodeNativeGamestateWizard(patched).name, 'ACTIVUS')
  assert.equal(patchedBindings.length, 113)
  assert.deepEqual(patchedBindings.slice(24), activeBindings.slice(24))

  const missingPortableSlots = withNativeBindingIntegerCount(gamestate, 20)
  assert.throws(
    () => decodeNativeGamestateWizard(missingPortableSlots),
    /portable fields require at least 21/,
  )
})

test('standalone gamestate selections use explicit stock profile defaults and remain exportable', async () => {
  const base = await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    fixture.expected.runName,
  )
  const equipmentGamestate = withEffectiveOnlyLearnedRow(gamestate, base.wizard, 54, 2)
  const activeGamestate = withNativeBindingIntegerCount(equipmentGamestate, 113)
  const singleSaveZip = createStoredZip([
    { bytes: activeGamestate, path: 'gamestate.sav' },
  ])
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    assert.equal(String(input), '/game/native/portable-profile-template.json')
    return new Response(JSON.stringify(fixture), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    })
  }
  try {
    const direct = await readNativeSaveFileSelection([
      selectedFile('gamestate.sav', activeGamestate),
    ])
    const zipped = await readNativeSaveFileSelection([
      selectedFile('SolomonDarkStockSaveWaterMage.zip', singleSaveZip),
    ])
    const expectedGamestateSha256 = await portableSha256(activeGamestate)
    for (const portable of [direct, zipped]) {
      assert.equal(portable.profile.gold, 500)
      assert.equal(portable.wizard.name, fixture.expected.wizardName)
      assert.equal(portable.nativeSource.runName, '_survival')
      assert.equal(portable.nativeSource.darkdataSha256, fixture.files.darkdata.sha256)
      assert.equal(portable.nativeSource.gamestateSha256, expectedGamestateSha256)
      assert.equal(portable.wizard.permanentRanks[54], 0)
      assert.equal(portable.wizard.learnedOrder.includes(54), false)
      assert.match(
        portable.warnings.join('\n'),
        /Only gamestate\.sav was supplied.*missing darkdata\.cfg profile fields start from stock defaults/s,
      )
      assert.match(portable.warnings.join('\n'), /row\(s\) 54 depend only on effective equipment ranks/)
    }

    const imported = createWebGameSaveFromPortableProfile(zipped)
    const restored = restoreGameSaveDocument(imported.document)
    assert.equal(restored.state.playerEntities.skillBooks[0]?.learnedSkillOrder.includes(54), false)
    assert.equal(restored.state.playerEntities.belts[0]?.[3]?.kind, 'health-potion')
    const exported = await exportWebGameSaveToNativeArchive(imported.document)
    const archive = await readNativeSaveArchive(exported.archive)
    assert.equal(decodeNativeDarkdataProfile(archive.darkdata).gold, 500)
    const exportedWizard = decodeNativeGamestateWizard(archive.gamestate)
    assert.equal(exportedWizard.name, fixture.expected.wizardName)
    assert.equal(exportedWizard.learnedOrder.includes(54), false)
    assert.equal(exportedWizard.rows[54]?.permanentRank, 0)
    assert.equal(exportedWizard.rows[54]?.effectiveRank, 0)
    assert.deepEqual(
      nativeBindingIntegers(archive.gamestate).slice(24),
      nativeBindingIntegers(activeGamestate).slice(24),
    )

    const ambiguous = createStoredZip([
      { bytes: activeGamestate, path: 'gamestate.sav' },
      { bytes: Uint8Array.of(1), path: 'notes.txt' },
    ])
    await assert.rejects(
      () => readNativeSaveFileSelection([selectedFile('ambiguous.zip', ambiguous)]),
      /must contain only one gamestate\.sav/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('web export preserves the native source through schema 17 and returns stock-decodable rows', async () => {
  const hall = Uint8Array.of(9, 8, 7)
  const portable = await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    fixture.expected.runName,
    [{ bytes: hall, path: 'solomondark/halloffame.dat' }],
  )
  const imported = createWebGameSaveFromPortableProfile(portable)
  const exportedPortable = await createPortableGameProfileFromWebSave(imported.document)
  const exported = await exportWebGameSaveToNativeArchive(imported.document)
  const archive = await readNativeSaveArchive(exported.archive)
  const wizard = decodeNativeGamestateWizard(archive.gamestate)
  assert.equal(exportedPortable.version, 1)
  assert.equal(wizard.name, fixture.expected.wizardName)
  assert.equal(wizard.level, fixture.expected.level)
  assert.equal(wizard.rows.length, 83)
  assert.equal(nativeBytesEqual(archive.retainedFiles![0]!.bytes, hall), true)
  const gamestateText = new TextDecoder().decode(archive.gamestate)
  assert.match(gamestateText, /data\\levels\\survival\.boneyard/)
  assert.doesNotMatch(gamestateText, /native-save-progression-20260826/)

  const corruptRetained = JSON.parse(encodePortableGameProfile(portable))
  corruptRetained.nativeSource.retainedFiles[0].sha256 = '0'.repeat(64)
  await assert.rejects(
    () => parsePortableGameProfile(JSON.stringify(corruptRetained)),
    /retained file 0 integrity/,
  )
  const settingsLeak = JSON.parse(encodePortableGameProfile(portable))
  settingsLeak.nativeSource.retainedFiles[0].path = 'solomondark/settings.txt'
  await assert.rejects(
    () => parsePortableGameProfile(JSON.stringify(settingsLeak)),
    /retained file 0 is invalid/,
  )
})

test('a fresh web wizard exports through the controlled native Hub template', async () => {
  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state: createGameSimulation({
      owner: { discipline: 'mind', displayName: 'WEBNATUS', element: 'fire' },
    }),
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    assert.equal(String(input), '/game/native/portable-profile-template.json')
    return new Response(JSON.stringify(fixture), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    })
  }
  try {
    const exported = await exportWebGameSaveToNativeArchive(document)
    const archive = await readNativeSaveArchive(exported.archive)
    const wizard = decodeNativeGamestateWizard(archive.gamestate)
    assert.equal(wizard.name, 'WEBNATUS')
    assert.equal(wizard.elementRoot, 1)
    assert.equal(wizard.disciplineRoot, 6)
    assert.equal(wizard.selectedPrimarySkillId, 16)
    assert.deepEqual(wizard.skillQuickbar, [21, null, null, null, null, null, null, null])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fresh web class books grant all eight stock root rows without changing class identity', () => {
  const book = createPlayerSkillBook({
    discipline: 'mind',
    displayName: 'Roots',
    element: 'fire',
  })
  assert.deepEqual(book.permanentRanks.slice(0, 8), Array(8).fill(1))
  assert.equal(book.elementRoot, 1)
  assert.equal(book.disciplineRoot, 6)
})

test('web disk projection preserves Firewalker and Game-persisted concentration while clearing live-only toggles', () => {
  const base = createGameSimulation({
    owner: { discipline: 'mind', displayName: 'Disk', element: 'fire' },
  })
  const runtime = base.playerEntities.skillRuntimes[0]!
  const book = base.playerEntities.skillBooks[0]!
  const permanentRanks = [...book.permanentRanks]
  const effectiveRanks = [...book.effectiveRanks]
  permanentRanks[57] = 1
  effectiveRanks[57] = 1
  const state = {
    ...base,
    playerEntities: {
      ...base.playerEntities,
      skillBooks: [{
        ...book,
        effectiveRanks,
        learnedSkillOrder: [...book.learnedSkillOrder, 57],
        permanentRanks,
      }],
      skillRuntimes: [{
        ...runtime,
        concentrationSkillIdA: 57,
        concentrationSkillIdB: null,
        mindstarActive: true,
        nextConcentrationReplacementSlot: 'b' as const,
      }],
    },
    secondaryAbilities: {
      ...base.secondaryAbilities,
      players: {
        owner: {
          ...createNativeSecondaryPlayerState(),
          firewalker: true,
          mindstar: true,
          regenerate: true,
          reservedMana: 90,
        },
      },
    },
  }
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })
  const encoded = JSON.parse(document)
  const savedRuntime = encoded.continuation.simulation.playerEntities.skillRuntimes[0]
  const savedSecondary = encoded.continuation.simulation.secondaryAbilities.players.owner
  assert.equal(savedRuntime.concentrationSkillIdA, 57)
  assert.equal(savedRuntime.concentrationSkillIdB, null)
  assert.equal(savedRuntime.nextConcentrationReplacementSlot, 'b')
  assert.equal(savedRuntime.mindstarActive, false)
  assert.equal(savedSecondary.firewalker, true)
  assert.equal(savedSecondary.mindstar, false)
  assert.equal(savedSecondary.regenerate, false)
  assert.equal(savedSecondary.reservedMana, 50)
  const restored = restoreGameSaveDocument(document)
  assert.equal(restored.state.playerEntities.skillRuntimes[0]?.concentrationSkillIdA, 57)
  assert.equal(restored.state.playerEntities.skillRuntimes[0]?.nextConcentrationReplacementSlot, 'b')
  assert.equal(restored.state.secondaryAbilities.players.owner?.firewalker, true)
  assert.equal(restored.state.secondaryAbilities.players.owner?.mindstar, false)
  assert.equal(restored.state.secondaryAbilities.players.owner?.regenerate, false)
})
