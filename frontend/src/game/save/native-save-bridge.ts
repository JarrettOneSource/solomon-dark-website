import {
  NATIVE_BOASTS,
  type NativeBoastId,
} from '../core-kernels/native-hub-npc.ts'
import {
  NativeSaveFormatError,
  decodeNativeDarkdata,
  encodeNativeDarkdata,
  encodeNativeSyncBuffer,
  parseNativeSyncBuffer,
  replaceNativeNodeChild,
  type NativeChunkNode,
  type NativeSyncBuffer,
} from './native-save-codec.ts'

export const RETAIL_SOLOMON_DARK_SHA256 =
  '03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3'
export const NATIVE_WIZARD_SKILL_ROW_COUNT = 83
export const NATIVE_HAGATHA_OWNERSHIP_COUNT = 50
export const NATIVE_FIRST_MIX_COUNT = 30
export const NATIVE_SOURCE_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024

const GAMESTATE_ROOT_CHILD_COUNT = 8
const NATIVE_BINDING_COUNT = 24
const NATIVE_BELT_SLOT_COUNT = 8
const NATIVE_BELT_EMPTY_TYPE = 7000
const NATIVE_BELT_SKILL_TYPE = 7015
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export interface NativeDarkdataProfile {
  readonly buffer: NativeSyncBuffer
  readonly dowsingFee: number
  readonly firstMixed: readonly boolean[]
  readonly gold: number
  readonly hagathaBundleSelectors: readonly number[]
  readonly helpPending: readonly boolean[]
  readonly librarianLaceRead: boolean
  readonly memorialMarker: readonly boolean[]
  readonly storageChildCount: number
  readonly storagePayloadLength: number
  readonly tutorialPending: boolean
}

export interface NativeProgressionRow {
  readonly cooldownCap: number
  readonly currentCooldown: number
  readonly effectiveRank: number
  readonly id: number
  readonly permanentRank: number
}

export interface NativeWizardProgression {
  readonly cheatDeathCharges: number
  readonly cheatDeathEnabled: boolean
  readonly currentHealth: number
  readonly currentMana: number
  readonly deferredSkillChoices: number
  readonly disciplineRoot: number
  readonly elementRoot: number
  readonly experience: number
  readonly experienceBonus: number
  readonly experienceEnabled: boolean
  readonly firewalkerActive: boolean
  readonly hagathaOwnership: readonly boolean[]
  readonly learnedOrder: readonly number[]
  readonly level: number
  readonly manaCostReduction: number
  readonly maximumHealth: number
  readonly maximumMana: number
  readonly meditationIdleDelay: number
  readonly name: string
  readonly nextConcentrationSlot: 0 | 1
  readonly offerSeed: number
  readonly offensiveDamageFlat: number
  readonly pendingSkillChoices: number
  readonly perkCapacity: number
  readonly perkSelectors: readonly number[]
  readonly poisonImmunityTicks: number
  readonly previousThreshold: number
  readonly nextThreshold: number
  readonly rows: readonly NativeProgressionRow[]
  readonly randomBoastActive: boolean
  readonly selectedPrimarySkillId: number
  readonly concentrationSkillIds: readonly [number | null, number | null]
  readonly skillQuickbar: readonly (number | null)[]
  readonly startingPrimary: number
  readonly startingSecondary: number
  readonly weldEffect: number
}

export interface NativeGameBoastState {
  readonly failed: boolean
  readonly selected: NativeBoastId | null
  readonly succeeded: boolean
}

export interface NativeProfilePatch {
  readonly dowsingFee: number
  readonly firstMixed: readonly boolean[]
  readonly gold: number
  readonly hagathaBundleSelectors: readonly number[]
  readonly helpPending: readonly boolean[]
  readonly librarianLaceRead: boolean
  readonly tutorialPending: boolean
}

export interface NativeWizardPatch {
  readonly cheatDeathCharges: number
  readonly cheatDeathEnabled: boolean
  readonly currentHealth: number
  readonly currentMana: number
  readonly deferredSkillChoices: number
  readonly disciplineRoot: number
  readonly elementRoot: number
  readonly experience: number
  readonly experienceBonus: number
  readonly firewalkerActive: boolean
  readonly hagathaOwnership: readonly boolean[]
  readonly learnedOrder: readonly number[]
  readonly level: number
  readonly manaCostReduction: number
  readonly maximumHealth: number
  readonly maximumMana: number
  readonly meditationIdleDelay: number
  readonly name: string
  readonly nextConcentrationSlot: 0 | 1
  readonly nextThreshold: number
  readonly offerSeed: number
  readonly offensiveDamageFlat: number
  readonly pendingSkillChoices: number
  readonly perkCapacity: number
  readonly perkSelectors: readonly number[]
  readonly permanentRanks: readonly number[]
  readonly poisonImmunityTicks: number
  readonly previousThreshold: number
  readonly selectedPrimarySkillId: number
  readonly concentrationSkillIds: readonly [number | null, number | null]
  readonly skillQuickbar: readonly (number | null)[]
  readonly startingPrimary: number
  readonly startingSecondary: number
  readonly weldEffect: number
}

export interface NativeHubTemplate {
  readonly darkdata: Uint8Array
  readonly gamestate: Uint8Array
  readonly runName: string
}

class PayloadReader {
  readonly bytes: Uint8Array
  readonly claim: string
  offset = 0

  constructor(bytes: Uint8Array, claim: string) {
    this.bytes = bytes
    this.claim = claim
  }

  take(size: number, field: string): Uint8Array {
    if (!Number.isSafeInteger(size) || size < 0 || this.offset + size > this.bytes.byteLength) {
      throw new NativeSaveFormatError(
        `truncated ${this.claim} ${field} at 0x${this.offset.toString(16)}`,
      )
    }
    const result = this.bytes.slice(this.offset, this.offset + size)
    this.offset += size
    return result
  }

  skip(size: number, field: string): void {
    this.take(size, field)
  }

  u8(field: string): number {
    return this.take(1, field)[0]!
  }

  boolean(field: string): boolean {
    const value = this.u8(field)
    if (value !== 0 && value !== 1) {
      throw new NativeSaveFormatError(`${this.claim} ${field} contains byte ${value}`)
    }
    return value === 1
  }

  u16(field: string): number {
    const value = this.take(2, field)
    return new DataView(value.buffer, value.byteOffset, 2).getUint16(0, true)
  }

  u32(field: string): number {
    const value = this.take(4, field)
    return new DataView(value.buffer, value.byteOffset, 4).getUint32(0, true)
  }

  i32(field: string): number {
    const value = this.take(4, field)
    return new DataView(value.buffer, value.byteOffset, 4).getInt32(0, true)
  }

  f32(field: string): number {
    const value = this.take(4, field)
    return new DataView(value.buffer, value.byteOffset, 4).getFloat32(0, true)
  }

  string(field: string): string {
    const length = this.u32(`${field} length`)
    if (length === 0) return ''
    const value = this.take(length, field)
    if (value[value.byteLength - 1] !== 0) {
      throw new NativeSaveFormatError(`${this.claim} ${field} is not NUL-terminated`)
    }
    try {
      return decoder.decode(value.subarray(0, -1))
    } catch {
      throw new NativeSaveFormatError(`${this.claim} ${field} is not UTF-8`)
    }
  }

  i32s(count: number, field: string): number[] {
    if (count > Math.floor((this.bytes.byteLength - this.offset) / 4)) {
      throw new NativeSaveFormatError(`${this.claim} ${field} count ${count} is impossible`)
    }
    return Array.from({ length: count }, (_, index) => this.i32(`${field}[${index}]`))
  }

  f32s(count: number, field: string): number[] {
    if (count > Math.floor((this.bytes.byteLength - this.offset) / 4)) {
      throw new NativeSaveFormatError(`${this.claim} ${field} count ${count} is impossible`)
    }
    return Array.from({ length: count }, (_, index) => this.f32(`${field}[${index}]`))
  }

  finish(): void {
    if (this.offset !== this.bytes.byteLength) {
      throw new NativeSaveFormatError(
        `${this.claim} ended at 0x${this.offset.toString(16)} with `
        + `${this.bytes.byteLength - this.offset} unclaimed bytes`,
      )
    }
  }
}

function requireNodeShape(
  node: NativeChunkNode,
  payloadLength: number | null,
  childCount: number | null,
  claim: string,
): void {
  if (payloadLength !== null && node.payload.byteLength !== payloadLength) {
    throw new NativeSaveFormatError(
      `${claim} payload is ${node.payload.byteLength} bytes; expected ${payloadLength}`,
    )
  }
  if (childCount !== null && node.children.length !== childCount) {
    throw new NativeSaveFormatError(
      `${claim} has ${node.children.length} children; expected ${childCount}`,
    )
  }
}

export function decodeNativeDarkdataProfile(bytes: Uint8Array): NativeDarkdataProfile {
  const buffer = decodeNativeDarkdata(bytes)
  if (buffer.namedBuffers.length !== 0) {
    throw new NativeSaveFormatError('darkdata unexpectedly has named buffers')
  }
  requireNodeShape(buffer.root, 0, 6, 'darkdata root')
  const [coreNode, storage, bulkNode, mixNode, feeNode, reserved] = buffer.root.children
  if (!coreNode || !storage || !bulkNode || !mixNode || !feeNode || !reserved) {
    throw new NativeSaveFormatError('darkdata child membership is incomplete')
  }
  requireNodeShape(coreNode, 118, null, 'darkdata core')
  requireNodeShape(mixNode, NATIVE_FIRST_MIX_COUNT, null, 'darkdata first-mix state')
  requireNodeShape(feeNode, 4, null, 'darkdata Dowsing fee')
  requireNodeShape(reserved, 0, 0, 'darkdata reserved child')

  const core = new PayloadReader(coreNode.payload, 'darkdata core')
  const gold = core.i32('profile gold')
  const memorialMarker = Array.from({ length: 10 }, (_, index) => (
    core.boolean(`memorial marker ${index}`)
  ))
  const tutorialPending = core.boolean('Tutorial pending')
  const helpPending = Array.from({ length: 10 }, (_, index) => (
    core.boolean(`Hub help pending ${index}`)
  ))
  core.skip(40, 'Memoratorium ages')
  core.skip(4, 'Memoratorium age counter')
  core.skip(40, 'Memoratorium portrait ids')
  core.skip(4, 'next portrait id')
  core.skip(4, 'latest portrait id')
  const librarianLaceRead = core.boolean('Lace read')
  core.finish()

  const bulk = new PayloadReader(bulkNode.payload, 'darkdata Hagatha bundle')
  const hagathaBundleSelectors = bulk.i32s(bulk.u32('count'), 'selectors')
  bulk.finish()
  const mix = new PayloadReader(mixNode.payload, 'darkdata first-mix state')
  const firstMixed = Array.from({ length: NATIVE_FIRST_MIX_COUNT }, (_, index) => (
    mix.boolean(`selector ${index}`)
  ))
  mix.finish()
  const fee = new PayloadReader(feeNode.payload, 'darkdata Dowsing fee')
  const dowsingFee = fee.i32('fee')
  fee.finish()
  return Object.freeze({
    buffer,
    dowsingFee,
    firstMixed: Object.freeze(firstMixed),
    gold,
    hagathaBundleSelectors: Object.freeze(hagathaBundleSelectors),
    helpPending: Object.freeze(helpPending),
    librarianLaceRead,
    memorialMarker: Object.freeze(memorialMarker),
    storageChildCount: storage.children.length,
    storagePayloadLength: storage.payload.byteLength,
    tutorialPending,
  })
}

interface DecodedProgression {
  readonly node: NativeChunkNode
  readonly progression: Omit<NativeWizardProgression,
    | 'concentrationSkillIds'
    | 'firewalkerActive'
    | 'meditationIdleDelay'
    | 'name'
    | 'nextConcentrationSlot'
    | 'selectedPrimarySkillId'
    | 'skillQuickbar'
    | 'weldEffect'
  >
}

function decodeProgressionCollections(node: NativeChunkNode) {
  const reader = new PayloadReader(node.payload, 'native progression collections')
  const perkSelectors = reader.i32s(reader.u32('perk count'), 'perk selectors')
  const hagathaOwnership = Array.from({ length: NATIVE_HAGATHA_OWNERSHIP_COUNT }, (_, index) => (
    reader.boolean(`Hagatha ownership ${index}`)
  ))
  const learnedOrder = reader.i32s(reader.u32('learned count'), 'learned order')
  reader.finish()
  return { hagathaOwnership, learnedOrder, perkSelectors }
}

function decodeProgressionNode(node: NativeChunkNode): DecodedProgression {
  requireNodeShape(node, null, 2, 'native progression')
  const reader = new PayloadReader(node.payload, 'native progression')
  const rowCount = reader.u32('row count')
  if (rowCount !== NATIVE_WIZARD_SKILL_ROW_COUNT) {
    throw new NativeSaveFormatError(
      `native progression has ${rowCount} rows; expected ${NATIVE_WIZARD_SKILL_ROW_COUNT}`,
    )
  }
  const descendingRows: NativeProgressionRow[] = []
  for (let id = rowCount - 1; id >= 0; id -= 1) {
    const permanentRank = reader.u16(`row ${id} permanent rank`)
    const effectiveRank = reader.u16(`row ${id} effective rank`)
    const currentCooldown = reader.f32(`row ${id} current cooldown`)
    const cooldownCap = reader.f32(`row ${id} cooldown cap`)
    descendingRows.push(Object.freeze({
      cooldownCap,
      currentCooldown,
      effectiveRank,
      id,
      permanentRank,
    }))
  }
  const rows = Object.freeze(descendingRows.reverse())
  const pendingSkillChoices = reader.i32('pending choices')
  const level = reader.i32('level')
  const experience = reader.f32('experience')
  const previousThreshold = reader.f32('previous threshold')
  const nextThreshold = reader.f32('next threshold')
  reader.skip(8, 'global cooldown and unknown scalar')
  const currentHealth = reader.f32('current health')
  const maximumHealth = reader.f32('maximum health')
  const currentMana = reader.f32('current mana')
  const maximumMana = reader.f32('maximum mana')
  reader.skip(52, 'common scalar prefix remainder')
  reader.i32s(reader.u32('integer vector count'), 'integer vector')
  reader.skip(36, 'inline scalar/vector prefix')
  reader.skip(24, 'unknown/offensive scalar block')
  const elementRoot = reader.i32('element root')
  const disciplineRoot = reader.i32('discipline root')
  const offerSeed = reader.i32('offer seed')
  reader.skip(9, 'offer marker state')
  const deferredSkillChoices = reader.i32('deferred choices')
  reader.boolean('Sorceror action flag')
  const startingSecondary = reader.i32('starting secondary')
  reader.i32s(reader.u32('forced-offer count'), 'forced offers')
  const offensiveDamageFlat = reader.f32('offensive damage flat')
  const manaCostReduction = reader.f32('mana cost reduction')
  const experienceBonus = reader.f32('experience bonus')
  reader.skip(20, 'late scalar block')
  reader.boolean('flag +0x814')
  const startingPrimary = reader.i32('starting primary')
  const cheatDeathEnabled = reader.boolean('cheat-death enabled')
  const cheatDeathCharges = reader.i32('cheat-death charges')
  reader.skip(4, 'hoarded mana')
  const experienceEnabled = reader.boolean('local experience admission')
  const randomBoastActive = reader.boolean('random-choice Boast')
  const perkCapacity = reader.i32('perk capacity')
  const poisonImmunityTicks = reader.i32('poison immunity ticks')
  reader.finish()

  const primaryStats = new PayloadReader(node.children[0]!.payload, 'primary-stat vector')
  primaryStats.f32s(primaryStats.u32('count'), 'values')
  primaryStats.finish()
  const collections = decodeProgressionCollections(node.children[1]!)
  return {
    node,
    progression: Object.freeze({
      cheatDeathCharges,
      cheatDeathEnabled,
      currentHealth,
      currentMana,
      deferredSkillChoices,
      disciplineRoot,
      elementRoot,
      experience,
      experienceBonus,
      experienceEnabled,
      hagathaOwnership: Object.freeze(collections.hagathaOwnership),
      learnedOrder: Object.freeze(collections.learnedOrder),
      level,
      manaCostReduction,
      maximumHealth,
      maximumMana,
      nextThreshold,
      offerSeed,
      offensiveDamageFlat,
      pendingSkillChoices,
      perkCapacity,
      perkSelectors: Object.freeze(collections.perkSelectors),
      poisonImmunityTicks,
      previousThreshold,
      randomBoastActive,
      rows,
      startingPrimary,
      startingSecondary,
    }),
  }
}

function decodeWizardExtension(node: NativeChunkNode) {
  requireNodeShape(node, 9, 0, 'native wizard disk extension')
  const reader = new PayloadReader(node.payload, 'native wizard disk extension')
  const result = {
    meditationIdleDelay: reader.i32('Meditation idle delay'),
    firewalkerActive: reader.boolean('Firewalker active'),
    weldEffect: reader.f32('weld effect'),
  }
  reader.finish()
  return result
}

interface LocalWizardNode {
  readonly buffer: NativeSyncBuffer
  readonly headerA: number
  readonly headerB: number
  readonly progressionNode: NativeChunkNode
  readonly selectedPrimarySkillId: number
  readonly wizardNode: NativeChunkNode
}

function localWizardNode(buffer: NativeSyncBuffer): LocalWizardNode & { readonly name: string } {
  if (buffer.namedBuffers.length !== 0) {
    throw new NativeSaveFormatError('native gamestate unexpectedly has named buffers')
  }
  requireNodeShape(buffer.root, null, GAMESTATE_ROOT_CHILD_COUNT, 'native gamestate root')
  const wizardNode = buffer.root.children[0]!
  if (wizardNode.children.length < 2) {
    throw new NativeSaveFormatError('native local wizard is missing progression children')
  }
  const header = new PayloadReader(wizardNode.payload, 'native local-wizard header')
  const headerA = header.i32('header A')
  const headerB = header.i32('header B')
  const nameLength = header.u32('name length')
  if (nameLength < 2 || nameLength > 256) {
    throw new NativeSaveFormatError(`native wizard name length ${nameLength} is invalid`)
  }
  const nameBytes = header.take(nameLength, 'name')
  if (nameBytes[nameBytes.byteLength - 1] !== 0) {
    throw new NativeSaveFormatError('native wizard name is not NUL-terminated')
  }
  let name: string
  try {
    name = decoder.decode(nameBytes.subarray(0, -1))
  } catch {
    throw new NativeSaveFormatError('native wizard name is not UTF-8')
  }
  if (!name) throw new NativeSaveFormatError('native wizard name is empty')
  const selectedPrimarySkillId = header.i32('selected primary skill')
  header.finish()
  return {
    buffer,
    headerA,
    headerB,
    name,
    progressionNode: wizardNode.children[0]!,
    selectedPrimarySkillId,
    wizardNode,
  }
}

interface NativeBindingState {
  readonly integerOffset: number
  readonly node: NativeChunkNode
  readonly values: readonly number[]
}

function decodeNativeBindingState(root: NativeChunkNode): NativeBindingState {
  const owner = root.children[1]
  const node = owner?.children[0]
  if (!owner || !node) throw new NativeSaveFormatError('native binding state is absent')
  const reader = new PayloadReader(node.payload, 'native binding state')
  const booleanCount = reader.u32('boolean count')
  if (booleanCount > node.payload.byteLength - reader.offset) {
    throw new NativeSaveFormatError('native binding boolean count is impossible')
  }
  for (let index = 0; index < booleanCount; index += 1) {
    reader.boolean(`boolean ${index}`)
  }
  const integerCount = reader.u32('integer count')
  if (integerCount !== NATIVE_BINDING_COUNT) {
    throw new NativeSaveFormatError(
      `native binding state has ${integerCount} integers; expected ${NATIVE_BINDING_COUNT}`,
    )
  }
  const integerOffset = reader.offset
  const values = reader.i32s(integerCount, 'integer')
  const floatCount = reader.u32('float count')
  reader.f32s(floatCount, 'float')
  const stringCount = reader.u32('String count')
  if (stringCount > Math.floor((node.payload.byteLength - reader.offset) / 4)) {
    throw new NativeSaveFormatError('native binding String count is impossible')
  }
  for (let index = 0; index < stringCount; index += 1) reader.string(`String ${index}`)
  for (const kind of ['vector2', 'range'] as const) {
    const count = reader.u32(`${kind} count`)
    if (count > Math.floor((node.payload.byteLength - reader.offset) / 8)) {
      throw new NativeSaveFormatError(`native binding ${kind} count is impossible`)
    }
    reader.skip(count * 8, kind)
  }
  reader.finish()
  return Object.freeze({ integerOffset, node, values: Object.freeze(values) })
}

interface NativeBeltEntry {
  readonly end: number
  readonly id: number
  readonly start: number
  readonly type: number
}

function decodeNativeBelt(root: NativeChunkNode): {
  readonly entries: readonly NativeBeltEntry[]
  readonly skillQuickbar: readonly (number | null)[]
} {
  const reader = new PayloadReader(root.payload, 'native BeltButton state')
  const entries: NativeBeltEntry[] = []
  const skillQuickbar: Array<number | null> = []
  for (let slot = 0; slot < NATIVE_BELT_SLOT_COUNT; slot += 1) {
    const start = reader.offset
    const type = reader.i32(`slot ${slot} type`)
    const id = reader.i32(`slot ${slot} id`)
    reader.boolean(`slot ${slot} flag`)
    reader.string(`slot ${slot} label`)
    reader.i32(`slot ${slot} trailing value`)
    const end = reader.offset
    if (type === NATIVE_BELT_SKILL_TYPE && (id < 8 || id > 79)) {
      throw new NativeSaveFormatError(`native BeltButton slot ${slot} has invalid skill ${id}`)
    }
    entries.push(Object.freeze({ end, id, start, type }))
    skillQuickbar.push(type === NATIVE_BELT_SKILL_TYPE ? id : null)
  }
  reader.finish()
  return Object.freeze({
    entries: Object.freeze(entries),
    skillQuickbar: Object.freeze(skillQuickbar),
  })
}

function nullableNativeBinding(value: number, claim: string): number | null {
  if (value === -1) return null
  if (!Number.isSafeInteger(value) || value < 8 || value > 80) {
    throw new NativeSaveFormatError(`${claim} ${value} is invalid`)
  }
  return value
}

interface NativeGameFooterState {
  readonly concentrationCursorOffset: number
  readonly nextConcentrationSlot: 0 | 1
  readonly node: NativeChunkNode
}

function decodeNativeGameFooter(root: NativeChunkNode): NativeGameFooterState {
  const node = root.children[7]
  if (!node) throw new NativeSaveFormatError('native Game footer is absent')
  const reader = new PayloadReader(node.payload, 'native Game footer')
  reader.u8('global selector byte')
  const concentrationCursorOffset = reader.offset
  const cursor = reader.i32('concentration replacement cursor')
  if (cursor !== 0 && cursor !== 1) {
    throw new NativeSaveFormatError(`native concentration replacement cursor ${cursor} is invalid`)
  }
  reader.string('profile label A')
  reader.string('profile label B')
  reader.f32('presentation scalar')
  reader.finish()
  return Object.freeze({
    concentrationCursorOffset,
    nextConcentrationSlot: cursor,
    node,
  })
}

function canonicalNativeBeltEntry(type: number, id: number): Uint8Array {
  return concat([
    i32Bytes(type),
    i32Bytes(id),
    Uint8Array.of(0),
    nativeStringBytes(''),
    i32Bytes(0),
  ])
}

function patchNativeSelections(
  root: NativeChunkNode,
  patch: NativeWizardPatch,
): NativeChunkNode {
  if (
    !Number.isSafeInteger(patch.selectedPrimarySkillId)
    || patch.selectedPrimarySkillId < 8
    || patch.selectedPrimarySkillId > 79
    || patch.concentrationSkillIds.length !== 2
    || patch.concentrationSkillIds.some(value => (
      value !== null && (!Number.isSafeInteger(value) || value < 8 || value > 79)
    ))
    || patch.skillQuickbar.length !== NATIVE_BELT_SLOT_COUNT
    || (patch.nextConcentrationSlot !== 0 && patch.nextConcentrationSlot !== 1)
    || patch.skillQuickbar.some(value => (
      value !== null && (!Number.isSafeInteger(value) || value < 8 || value > 79)
    ))
  ) throw new NativeSaveFormatError('native selection patch is invalid')

  const bindings = decodeNativeBindingState(root)
  const bindingPayload = bindings.node.payload.slice()
  setI32(bindingPayload, bindings.integerOffset + 12 * 4, patch.selectedPrimarySkillId)
  setI32(bindingPayload, bindings.integerOffset + 16 * 4, patch.concentrationSkillIds[0] ?? -1)
  setI32(bindingPayload, bindings.integerOffset + 20 * 4, patch.concentrationSkillIds[1] ?? -1)
  const bindingOwner = root.children[1]!
  const nextBindingOwner = replaceNativeNodeChild(bindingOwner, 0, Object.freeze({
    ...bindings.node,
    payload: bindingPayload,
  }))
  let nextRoot = replaceNativeNodeChild(root, 1, nextBindingOwner)

  const belt = decodeNativeBelt(nextRoot)
  const beltParts: Uint8Array[] = []
  for (let slot = 0; slot < NATIVE_BELT_SLOT_COUNT; slot += 1) {
    const value = patch.skillQuickbar[slot]
    const base = belt.entries[slot]!
    if (value !== null) {
      beltParts.push(canonicalNativeBeltEntry(NATIVE_BELT_SKILL_TYPE, value))
    } else if (base.type === NATIVE_BELT_SKILL_TYPE) {
      beltParts.push(canonicalNativeBeltEntry(NATIVE_BELT_EMPTY_TYPE, 0))
    } else {
      beltParts.push(nextRoot.payload.slice(base.start, base.end))
    }
  }
  nextRoot = Object.freeze({ ...nextRoot, payload: concat(beltParts) })
  const footer = decodeNativeGameFooter(nextRoot)
  const footerPayload = footer.node.payload.slice()
  setI32(footerPayload, footer.concentrationCursorOffset, patch.nextConcentrationSlot)
  nextRoot = replaceNativeNodeChild(nextRoot, 7, Object.freeze({
    ...footer.node,
    payload: footerPayload,
  }))
  return nextRoot
}

export function decodeNativeGamestateWizard(bytes: Uint8Array): NativeWizardProgression {
  const local = localWizardNode(parseNativeSyncBuffer(bytes))
  const decoded = decodeProgressionNode(local.progressionNode)
  const extension = decodeWizardExtension(local.wizardNode.children[1]!)
  const bindings = decodeNativeBindingState(local.buffer.root)
  const selectedPrimarySkillId = nullableNativeBinding(
    bindings.values[12]!,
    'native selected primary',
  )
  if (selectedPrimarySkillId === null || selectedPrimarySkillId !== local.selectedPrimarySkillId) {
    throw new NativeSaveFormatError('native local-wizard selected primary bindings disagree')
  }
  const concentrationSkillIds = Object.freeze([
    nullableNativeBinding(bindings.values[16]!, 'native concentration A'),
    nullableNativeBinding(bindings.values[20]!, 'native concentration B'),
  ]) as readonly [number | null, number | null]
  const belt = decodeNativeBelt(local.buffer.root)
  const footer = decodeNativeGameFooter(local.buffer.root)
  return Object.freeze({
    ...decoded.progression,
    concentrationSkillIds,
    firewalkerActive: extension.firewalkerActive,
    meditationIdleDelay: extension.meditationIdleDelay,
    name: local.name,
    nextConcentrationSlot: footer.nextConcentrationSlot,
    selectedPrimarySkillId,
    skillQuickbar: belt.skillQuickbar,
    weldEffect: extension.weldEffect,
  })
}

function setI32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setInt32(offset, value, true)
}

function setU16(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(offset, value, true)
}

function setF32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat32(offset, value, true)
}

function i32Bytes(value: number): Uint8Array {
  const result = new Uint8Array(4)
  setI32(result, 0, value)
  return result
}

function u32Bytes(value: number): Uint8Array {
  const result = new Uint8Array(4)
  new DataView(result.buffer).setUint32(0, value, true)
  return result
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }
  return result
}

interface NativeStringSpan {
  readonly end: number
  readonly lengthOffset: number
  readonly value: string
}

interface NativeGameStateLayout {
  readonly boastText: NativeStringSpan
  readonly bridgeText: NativeStringSpan
  readonly failureOffset: number
  readonly path: NativeStringSpan
  readonly selectedOffset: number
  readonly successOffset: number
}

function nativeStringSpan(payload: Uint8Array, lengthOffset: number): NativeStringSpan | null {
  if (lengthOffset < 0 || lengthOffset + 4 > payload.byteLength) return null
  const length = new DataView(
    payload.buffer,
    payload.byteOffset + lengthOffset,
    4,
  ).getUint32(0, true)
  const start = lengthOffset + 4
  const end = start + length
  if (end > payload.byteLength) return null
  if (length === 0) return { end, lengthOffset, value: '' }
  if (payload[end - 1] !== 0) return null
  try {
    return {
      end,
      lengthOffset,
      value: decoder.decode(payload.subarray(start, end - 1)),
    }
  } catch {
    return null
  }
}

function nativeBoneyardPath(node: NativeChunkNode): NativeStringSpan {
  const candidates: NativeStringSpan[] = []
  for (let lengthOffset = 0; lengthOffset + 5 <= node.payload.byteLength; lengthOffset += 1) {
    const candidate = nativeStringSpan(node.payload, lengthOffset)
    if (candidate?.value.toLowerCase().endsWith('.boneyard')) candidates.push(candidate)
  }
  if (candidates.length !== 1) {
    throw new NativeSaveFormatError(
      `native gamestate has ${candidates.length} selected Boneyard path candidates`,
    )
  }
  return candidates[0]!
}

function nativeBoastStatement(selected: NativeBoastId | null): string {
  if (selected === null) return ''
  const statement = NATIVE_BOASTS.find(boast => boast.id === selected)?.statement
  if (!statement) throw new NativeSaveFormatError(`native Boast ${selected} is invalid`)
  return statement
}

function nativeBoastStatementMatches(selected: NativeBoastId | null, value: string): boolean {
  return selected === null ? value === '' || value === '\u0001' : value === nativeBoastStatement(selected)
}

function nativeGameStateLayout(node: NativeChunkNode): NativeGameStateLayout {
  const path = nativeBoneyardPath(node)
  const candidates: Array<Pick<
    NativeGameStateLayout,
    'boastText' | 'bridgeText' | 'selectedOffset'
  >> = []
  const start = Math.max(0, path.lengthOffset - 1_024)
  for (let selectedOffset = start; selectedOffset < path.lengthOffset; selectedOffset += 1) {
    const rawSelected = node.payload[selectedOffset]!
    if (rawSelected !== 0xff && rawSelected > 4) continue
    const selected = rawSelected === 0xff ? null : rawSelected as NativeBoastId
    const boastText = nativeStringSpan(node.payload, selectedOffset + 1)
    if (!boastText || !nativeBoastStatementMatches(selected, boastText.value)) continue
    const bridgeText = nativeStringSpan(node.payload, boastText.end)
    if (!bridgeText || bridgeText.end !== path.lengthOffset) continue
    candidates.push({ boastText, bridgeText, selectedOffset })
  }
  if (candidates.length !== 1) {
    throw new NativeSaveFormatError(
      `native gamestate has ${candidates.length} Boast layout candidates`,
    )
  }
  const prefix = candidates[0]!
  const afterPathScalarOffset = path.end + 8
  const postPathText = nativeStringSpan(node.payload, afterPathScalarOffset)
  if (!postPathText || postPathText.end + 6 > node.payload.byteLength) {
    throw new NativeSaveFormatError('native gamestate Boast tail is truncated')
  }
  const failureOffset = postPathText.end + 4
  const successOffset = failureOffset + 1
  const failed = node.payload[failureOffset]
  const succeeded = node.payload[successOffset]
  if ((failed !== 0 && failed !== 1) || (succeeded !== 0 && succeeded !== 1)) {
    throw new NativeSaveFormatError('native gamestate Boast state is not boolean')
  }
  return { ...prefix, failureOffset, path, successOffset }
}

function nativeStringBytes(value: string): Uint8Array {
  if (value.length === 0) return u32Bytes(0)
  const bytes = concat([encoder.encode(value), Uint8Array.of(0)])
  return concat([u32Bytes(bytes.byteLength), bytes])
}

function nativeGameBoast(node: NativeChunkNode): NativeGameBoastState {
  const layout = nativeGameStateLayout(node)
  const rawSelected = node.payload[layout.selectedOffset]!
  const selected = rawSelected === 0xff ? null : rawSelected as NativeBoastId
  const failed = node.payload[layout.failureOffset] === 1
  const succeeded = node.payload[layout.successOffset] === 1
  if (
    (selected === null && (failed || succeeded))
    || (selected === 3 && failed)
    || (failed && succeeded)
  ) {
    throw new NativeSaveFormatError('native gamestate Boast lifecycle is inconsistent')
  }
  return Object.freeze({ failed, selected, succeeded })
}

export function decodeNativeGamestateBoast(bytes: Uint8Array): NativeGameBoastState {
  const buffer = parseNativeSyncBuffer(bytes)
  requireNodeShape(buffer.root, null, GAMESTATE_ROOT_CHILD_COUNT, 'native gamestate root')
  return nativeGameBoast(buffer.root.children[5]!)
}

function portableGameState(
  node: NativeChunkNode,
  boast: NativeGameBoastState,
): NativeChunkNode {
  if (
    (boast.selected !== null && !Number.isInteger(boast.selected))
    || (boast.selected === null && (boast.failed || boast.succeeded))
    || (boast.selected === 3 && boast.failed)
    || (boast.failed && boast.succeeded)
  ) throw new NativeSaveFormatError('native Boast patch is inconsistent')
  const layout = nativeGameStateLayout(node)
  const tail = node.payload.slice(layout.path.end)
  tail[layout.failureOffset - layout.path.end] = Number(boast.failed)
  tail[layout.successOffset - layout.path.end] = Number(boast.succeeded)
  const bridgeTextBytes = node.payload.slice(layout.boastText.end, layout.bridgeText.end)
  const pathBytes = nativeStringBytes('data\\levels\\survival.boneyard')
  return Object.freeze({
    ...node,
    payload: concat([
      node.payload.subarray(0, layout.selectedOffset),
      Uint8Array.of(boast.selected ?? 0xff),
      nativeStringBytes(nativeBoastStatement(boast.selected)),
      bridgeTextBytes,
      pathBytes,
      tail,
    ]),
  })
}

function requireBooleanArray(value: readonly boolean[], count: number, claim: string): void {
  if (value.length !== count || value.some(entry => typeof entry !== 'boolean')) {
    throw new NativeSaveFormatError(`${claim} must contain ${count} booleans`)
  }
}

function requireIntegerArray(
  value: readonly number[],
  count: number | null,
  minimum: number,
  maximum: number,
  claim: string,
): void {
  if (
    (count !== null && value.length !== count)
    || value.some(entry => !Number.isSafeInteger(entry) || entry < minimum || entry > maximum)
  ) throw new NativeSaveFormatError(`${claim} is invalid`)
}

export function patchNativeDarkdata(
  source: Uint8Array,
  patch: NativeProfilePatch,
): Uint8Array {
  const decoded = decodeNativeDarkdataProfile(source)
  requireBooleanArray(patch.helpPending, 10, 'native help state')
  requireBooleanArray(patch.firstMixed, NATIVE_FIRST_MIX_COUNT, 'native first-mix state')
  requireIntegerArray(patch.hagathaBundleSelectors, null, -1, 49, 'native Hagatha bundle')
  const root = decoded.buffer.root
  const coreNode = root.children[0]!
  const core = coreNode.payload.slice()
  setI32(core, 0, patch.gold)
  core[14] = Number(patch.tutorialPending)
  core.set(Uint8Array.from(patch.helpPending, Number), 15)
  core[117] = Number(patch.librarianLaceRead)
  const selectors = concat([
    u32Bytes(patch.hagathaBundleSelectors.length),
    ...patch.hagathaBundleSelectors.map(i32Bytes),
  ])
  let nextRoot = replaceNativeNodeChild(root, 0, Object.freeze({ ...coreNode, payload: core }))
  nextRoot = replaceNativeNodeChild(nextRoot, 2, Object.freeze({
    ...root.children[2]!,
    payload: selectors,
  }))
  nextRoot = replaceNativeNodeChild(nextRoot, 3, Object.freeze({
    ...root.children[3]!,
    payload: Uint8Array.from(patch.firstMixed, Number),
  }))
  nextRoot = replaceNativeNodeChild(nextRoot, 4, Object.freeze({
    ...root.children[4]!,
    payload: i32Bytes(patch.dowsingFee),
  }))
  const result = encodeNativeDarkdata(Object.freeze({ ...decoded.buffer, root: nextRoot }))
  decodeNativeDarkdataProfile(result)
  return result
}

function progressionOffsets(payload: Uint8Array): Readonly<Record<string, number>> {
  const reader = new PayloadReader(payload, 'native progression offset walk')
  const offsets: Record<string, number> = {}
  const markI32 = (name: string) => { offsets[name] = reader.offset; reader.i32(name) }
  const markF32 = (name: string) => { offsets[name] = reader.offset; reader.f32(name) }
  const markBool = (name: string) => { offsets[name] = reader.offset; reader.boolean(name) }
  if (reader.u32('row count') !== NATIVE_WIZARD_SKILL_ROW_COUNT) {
    throw new NativeSaveFormatError('native progression row count drifted')
  }
  reader.skip(NATIVE_WIZARD_SKILL_ROW_COUNT * 12, 'rows')
  markI32('pendingSkillChoices')
  markI32('level')
  markF32('experience')
  markF32('previousThreshold')
  markF32('nextThreshold')
  reader.skip(8, 'global cooldown and unknown scalar')
  markF32('currentHealth')
  markF32('maximumHealth')
  markF32('currentMana')
  markF32('maximumMana')
  reader.skip(52, 'common scalar prefix remainder')
  reader.skip(reader.u32('integer vector count') * 4, 'integer vector')
  reader.skip(36, 'inline scalar/vector prefix')
  reader.skip(24, 'unknown/offensive block')
  markI32('elementRoot')
  markI32('disciplineRoot')
  markI32('offerSeed')
  reader.skip(9, 'offer marker fields')
  markI32('deferredSkillChoices')
  reader.skip(1, 'Sorceror action flag')
  markI32('startingSecondary')
  reader.skip(reader.u32('forced-offer count') * 4, 'forced offers')
  markF32('offensiveDamageFlat')
  markF32('manaCostReduction')
  markF32('experienceBonus')
  reader.skip(20, 'late scalar block')
  reader.skip(1, 'flag +0x814')
  markI32('startingPrimary')
  markBool('cheatDeathEnabled')
  markI32('cheatDeathCharges')
  reader.skip(4, 'hoarded mana')
  markBool('experienceEnabled')
  markBool('randomBoastActive')
  markI32('perkCapacity')
  markI32('poisonImmunityTicks')
  reader.finish()
  return Object.freeze(offsets)
}

export function patchNativeGamestate(
  source: Uint8Array,
  patch: NativeWizardPatch,
  boast?: NativeGameBoastState,
): Uint8Array {
  requireIntegerArray(
    patch.permanentRanks,
    NATIVE_WIZARD_SKILL_ROW_COUNT,
    0,
    0xffff,
    'native permanent ranks',
  )
  requireIntegerArray(patch.learnedOrder, null, 8, 79, 'native learned order')
  requireIntegerArray(patch.perkSelectors, null, 0, 49, 'native perk selectors')
  requireBooleanArray(
    patch.hagathaOwnership,
    NATIVE_HAGATHA_OWNERSHIP_COUNT,
    'native Hagatha ownership',
  )
  const name = concat([encoder.encode(patch.name), Uint8Array.of(0)])
  if (name.byteLength < 2 || name.byteLength > 256) {
    throw new NativeSaveFormatError('native wizard name is invalid')
  }

  const local = localWizardNode(parseNativeSyncBuffer(source))
  const gameNode = local.buffer.root.children[5]!
  const patchedBoast = boast ?? nativeGameBoast(gameNode)
  decodeProgressionNode(local.progressionNode)
  const payload = local.progressionNode.payload.slice()
  const offsets = progressionOffsets(payload)
  for (let id = 0; id < patch.permanentRanks.length; id += 1) {
    const offset = 4 + (NATIVE_WIZARD_SKILL_ROW_COUNT - 1 - id) * 12
    setU16(payload, offset, patch.permanentRanks[id]!)
    setU16(payload, offset + 2, patch.permanentRanks[id]!)
  }
  for (const key of [
    'pendingSkillChoices', 'level', 'elementRoot', 'disciplineRoot', 'offerSeed',
    'deferredSkillChoices', 'startingSecondary', 'startingPrimary',
    'cheatDeathCharges', 'perkCapacity', 'poisonImmunityTicks',
  ] as const) setI32(payload, offsets[key]!, patch[key])
  for (const key of [
    'experience', 'previousThreshold', 'nextThreshold', 'currentHealth',
    'maximumHealth', 'currentMana', 'maximumMana', 'offensiveDamageFlat',
    'manaCostReduction', 'experienceBonus',
  ] as const) setF32(payload, offsets[key]!, patch[key])
  payload[offsets.cheatDeathEnabled!] = Number(patch.cheatDeathEnabled)
  payload[offsets.experienceEnabled!] = 1
  payload[offsets.randomBoastActive!] = Number(patchedBoast.selected === 3)

  const collectionNode = local.progressionNode.children[1]!
  const collections = concat([
    u32Bytes(patch.perkSelectors.length),
    ...patch.perkSelectors.map(i32Bytes),
    Uint8Array.from(patch.hagathaOwnership, Number),
    u32Bytes(patch.learnedOrder.length),
    ...patch.learnedOrder.map(i32Bytes),
  ])
  const progressionNode = Object.freeze({
    ...local.progressionNode,
    children: Object.freeze([
      local.progressionNode.children[0]!,
      Object.freeze({ ...collectionNode, payload: collections }),
    ]),
    payload,
  })

  const extensionNode = local.wizardNode.children[1]!
  decodeWizardExtension(extensionNode)
  const extension = extensionNode.payload.slice()
  setI32(extension, 0, patch.meditationIdleDelay)
  extension[4] = Number(patch.firewalkerActive)
  setF32(extension, 5, patch.weldEffect)
  const header = concat([
    i32Bytes(local.headerA),
    i32Bytes(local.headerB),
    u32Bytes(name.byteLength),
    name,
    i32Bytes(patch.selectedPrimarySkillId),
  ])
  const wizardChildren = [...local.wizardNode.children]
  wizardChildren[0] = progressionNode
  wizardChildren[1] = Object.freeze({ ...extensionNode, payload: extension })
  const wizardNode = Object.freeze({
    ...local.wizardNode,
    children: Object.freeze(wizardChildren),
    payload: header,
  })
  let root = replaceNativeNodeChild(local.buffer.root, 0, wizardNode)
  root = patchNativeSelections(root, patch)
  root = replaceNativeNodeChild(root, 5, portableGameState(
    gameNode,
    patchedBoast,
  ))
  const result = encodeNativeSyncBuffer(Object.freeze({ ...local.buffer, root }))
  decodeNativeGamestateWizard(result)
  decodeNativeGamestateBoast(result)
  return result
}

function base64Bytes(value: unknown, claim: string): Uint8Array {
  if (typeof value !== 'string' || value.length === 0) {
    throw new NativeSaveFormatError(`${claim} is missing`)
  }
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    throw new NativeSaveFormatError(`${claim} is not valid base64`)
  }
}

interface NativeTemplateJson {
  readonly expected?: { readonly runName?: unknown }
  readonly files?: {
    readonly darkdata?: { readonly base64?: unknown; readonly bytes?: unknown }
    readonly gamestate?: { readonly base64?: unknown; readonly bytes?: unknown }
  }
  readonly schema?: unknown
}

export async function loadNativeHubTemplate(
  fetcher: typeof fetch = fetch,
): Promise<NativeHubTemplate> {
  const response = await fetcher('/game/native/portable-profile-template.json')
  if (!response.ok) throw new NativeSaveFormatError('native Hub template could not be loaded')
  const value = await response.json() as NativeTemplateJson
  if (value.schema !== 'native-portable-profile-template-v1') {
    throw new NativeSaveFormatError('native Hub template schema is invalid')
  }
  const darkdata = base64Bytes(value.files?.darkdata?.base64, 'native darkdata template')
  const gamestate = base64Bytes(value.files?.gamestate?.base64, 'native gamestate template')
  if (
    value.files?.darkdata?.bytes !== darkdata.byteLength
    || value.files?.gamestate?.bytes !== gamestate.byteLength
    || darkdata.byteLength + gamestate.byteLength > NATIVE_SOURCE_ATTACHMENT_MAX_BYTES
  ) throw new NativeSaveFormatError('native Hub template byte contract is invalid')
  const runName = value.expected?.runName
  if (typeof runName !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(runName)) {
    throw new NativeSaveFormatError('native Hub template run name is invalid')
  }
  decodeNativeDarkdataProfile(darkdata)
  decodeNativeGamestateWizard(gamestate)
  decodeNativeGamestateBoast(gamestate)
  return Object.freeze({ darkdata, gamestate, runName })
}
