import {
  NATIVE_FIRST_MIX_COUNT,
  NATIVE_HAGATHA_OWNERSHIP_COUNT,
  NATIVE_SOURCE_ATTACHMENT_MAX_BYTES,
  NATIVE_WIZARD_SKILL_ROW_COUNT,
  RETAIL_SOLOMON_DARK_SHA256,
  decodeNativeDarkdataProfile,
  decodeNativeGamestateBoast,
  decodeNativeGamestateWizard,
  type NativeGameBoastState,
} from './native-save-bridge.ts'
import { nativeSkillCategory } from '../core-kernels/player-progression.ts'
import { NativeSaveFormatError } from './native-save-codec.ts'

export const PORTABLE_GAME_PROFILE_FORMAT = 'solomon-dark-portable-profile'
export const PORTABLE_GAME_PROFILE_VERSION = 1
export const MAX_PORTABLE_GAME_PROFILE_BYTES = 16 * 1024 * 1024

export interface NativeGameSaveSource {
  readonly darkdataBase64: string
  readonly darkdataSha256: string
  readonly gamestateBase64: string
  readonly gamestateSha256: string
  readonly retainedFiles: readonly NativeRetainedSaveFileSource[]
  readonly runName: string
}

export interface NativeRetainedSaveFileSource {
  readonly base64: string
  readonly path: string
  readonly sha256: string
}

export interface PortableNativeStorageSummary {
  readonly childCount: number
  readonly materializedInWeb: false
  readonly payloadLength: number
}

export interface PortableGameProfileState {
  readonly boast: NativeGameBoastState
  readonly dowsingFee: number
  readonly firstMixed: readonly boolean[]
  readonly gold: number
  readonly hagathaBundleSelectors: readonly number[]
  readonly helpPending: readonly boolean[]
  readonly librarianLaceRead: boolean
  readonly nativeStorage: PortableNativeStorageSummary
  readonly tutorialPending: boolean
}

export interface PortableGameWizardState {
  readonly advancedUnlocks: readonly boolean[]
  readonly cheatDeathCharges: number
  readonly cheatDeathEnabled: boolean
  readonly currentHealth: number
  readonly currentMana: number
  readonly concentrationSkillIds: readonly [number | null, number | null]
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
  readonly skillQuickbar: readonly (number | null)[]
  readonly startingPrimary: number
  readonly startingSecondary: number
  readonly weldEffect: number
}

export interface PortableGameProfile {
  readonly format: typeof PORTABLE_GAME_PROFILE_FORMAT
  readonly nativeSource: NativeGameSaveSource
  readonly profile: PortableGameProfileState
  readonly retailExecutableSha256: typeof RETAIL_SOLOMON_DARK_SHA256
  readonly version: typeof PORTABLE_GAME_PROFILE_VERSION
  readonly warnings: readonly string[]
  readonly wizard: PortableGameWizardState
}

const encoder = new TextEncoder()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function portableBase64ToBytes(value: string, claim: string): Uint8Array {
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    throw new NativeSaveFormatError(`${claim} is not valid base64`)
  }
}

export async function portableSha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

export async function createNativeGameSaveSource(
  darkdata: Uint8Array,
  gamestate: Uint8Array,
  runName: string,
  retainedFiles: readonly Readonly<{ bytes: Uint8Array; path: string }>[] = [],
): Promise<NativeGameSaveSource> {
  const retainedPaths = new Set<string>()
  let totalBytes = darkdata.byteLength + gamestate.byteLength
  const retained = await Promise.all(retainedFiles.map(async (file) => {
    const canonical = file.path.toLowerCase()
    if (
      !nativeRetainedPathIsSafe(file.path)
      || retainedPaths.has(canonical)
    ) throw new NativeSaveFormatError('native retained save file is invalid')
    retainedPaths.add(canonical)
    totalBytes += file.bytes.byteLength
    return Object.freeze({
      base64: bytesToBase64(file.bytes),
      path: file.path,
      sha256: await portableSha256(file.bytes),
    })
  }))
  if (
    !/^[A-Za-z0-9._-]{1,64}$/.test(runName)
    || darkdata.byteLength === 0
    || gamestate.byteLength === 0
    || retained.length > 253
    || totalBytes > NATIVE_SOURCE_ATTACHMENT_MAX_BYTES
  ) throw new NativeSaveFormatError('native save source is invalid')
  return Object.freeze({
    darkdataBase64: bytesToBase64(darkdata),
    darkdataSha256: await portableSha256(darkdata),
    gamestateBase64: bytesToBase64(gamestate),
    gamestateSha256: await portableSha256(gamestate),
    retainedFiles: Object.freeze(retained),
    runName,
  })
}

function nativeRetainedPathIsSafe(path: string): boolean {
  return path.length > 0
    && path.length <= 512
    && path.toLowerCase().startsWith('solomondark/')
    && path.toLowerCase() !== 'solomondark/darkdata.cfg'
    && path.toLowerCase() !== 'solomondark/settings.txt'
    && !/^solomondark\/savegames\/.+\/gamestate\.sav$/i.test(path)
    && !path.includes('\\')
    && !path.includes(':')
    && !path.startsWith('/')
    && !path.endsWith('/')
    && path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..')
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(path)
}

export async function createPortableGameProfileFromNative(
  darkdataBytes: Uint8Array,
  gamestateBytes: Uint8Array,
  runName: string,
  retainedFiles: readonly Readonly<{ bytes: Uint8Array; path: string }>[] = [],
): Promise<PortableGameProfile> {
  const profile = decodeNativeDarkdataProfile(darkdataBytes)
  const wizard = decodeNativeGamestateWizard(gamestateBytes)
  const boast = decodeNativeGamestateBoast(gamestateBytes)
  if (!wizard.experienceEnabled || wizard.randomBoastActive !== (boast.selected === 3)) {
    throw new NativeSaveFormatError('native local wizard and Boast progression flags disagree')
  }
  const ranks = wizard.rows.map(row => row.permanentRank)
  const candidate: PortableGameProfile = Object.freeze({
    format: PORTABLE_GAME_PROFILE_FORMAT,
    nativeSource: await createNativeGameSaveSource(
      darkdataBytes,
      gamestateBytes,
      runName,
      retainedFiles,
    ),
    profile: Object.freeze({
      boast,
      dowsingFee: profile.dowsingFee,
      firstMixed: profile.firstMixed,
      gold: profile.gold,
      hagathaBundleSelectors: profile.hagathaBundleSelectors,
      helpPending: profile.helpPending,
      librarianLaceRead: profile.librarianLaceRead,
      nativeStorage: Object.freeze({
        childCount: profile.storageChildCount,
        materializedInWeb: false,
        payloadLength: profile.storagePayloadLength,
      }),
      tutorialPending: profile.tutorialPending,
    }),
    retailExecutableSha256: RETAIL_SOLOMON_DARK_SHA256,
    version: PORTABLE_GAME_PROFILE_VERSION,
    warnings: Object.freeze([
      'Native Luthacus storage is retained byte-for-byte but is not materialized in the web inventory bridge.',
      'Machinimbus purchase-only unlocks are not stored by retail; only already learned advanced rows can cross.',
      'Serendipity and Reverie active-until-hurt flags are not retail disk members and start inactive after import.',
      'Retail omits Unforge base HP/MP bonuses; import rebuilds maximum vitals and preserves only the saved current/max ratios.',
      ...(wizard.selectedPrimarySkillId === 52 || wizard.skillQuickbar.includes(52)
        ? ['Retail omits the active synthetic Weld build; selected or belted Spell Welding cannot be reconstructed after disk load.']
        : []),
      ...(wizard.selectedPrimarySkillId === 80
        ? ['Plane Orb is a live Planewalker override and resets in the settled portable Hub.']
        : []),
      'The portable wizard starts in a settled Hub; in-flight native Arena and Region objects remain in the native attachment.',
      ...(retainedFiles.length > 0
        ? [`${retainedFiles.length} opaque native slot file(s) will be retained for stock export but are not web authority.`]
        : []),
      ...(wizard.hagathaOwnership[8] || wizard.hagathaOwnership.slice(28).some(Boolean)
        ? ['Unavailable native Hagatha ownership rows 8 and 28..49 remain byte-preserved but are not materialized in web play.']
        : []),
    ]),
    wizard: Object.freeze({
      advancedUnlocks: Object.freeze(ranks.slice(72, 80).map(rank => rank > 0)),
      cheatDeathCharges: wizard.cheatDeathCharges,
      cheatDeathEnabled: wizard.cheatDeathEnabled,
      currentHealth: wizard.currentHealth,
      currentMana: wizard.currentMana,
      concentrationSkillIds: wizard.concentrationSkillIds,
      deferredSkillChoices: wizard.deferredSkillChoices,
      disciplineRoot: wizard.disciplineRoot,
      elementRoot: wizard.elementRoot,
      experience: wizard.experience,
      experienceBonus: wizard.experienceBonus,
      firewalkerActive: wizard.firewalkerActive,
      hagathaOwnership: wizard.hagathaOwnership,
      learnedOrder: wizard.learnedOrder,
      level: wizard.level,
      manaCostReduction: wizard.manaCostReduction,
      maximumHealth: wizard.maximumHealth,
      maximumMana: wizard.maximumMana,
      meditationIdleDelay: wizard.meditationIdleDelay,
      name: wizard.name,
      nextConcentrationSlot: wizard.nextConcentrationSlot,
      nextThreshold: wizard.nextThreshold,
      offerSeed: wizard.offerSeed,
      offensiveDamageFlat: wizard.offensiveDamageFlat,
      pendingSkillChoices: wizard.pendingSkillChoices,
      perkCapacity: wizard.perkCapacity,
      perkSelectors: wizard.perkSelectors,
      permanentRanks: Object.freeze(ranks),
      poisonImmunityTicks: wizard.poisonImmunityTicks,
      previousThreshold: wizard.previousThreshold,
      selectedPrimarySkillId: wizard.selectedPrimarySkillId,
      skillQuickbar: wizard.skillQuickbar,
      startingPrimary: wizard.startingPrimary,
      startingSecondary: wizard.startingSecondary,
      weldEffect: wizard.weldEffect,
    }),
  })
  return parsePortableGameProfile(encodePortableGameProfile(candidate))
}

function record(value: unknown, claim: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeSaveFormatError(`${claim} must be an object`)
  }
  return value as Record<string, unknown>
}

function onlyKeys(source: Record<string, unknown>, keys: readonly string[], claim: string): void {
  const expected = new Set(keys)
  if (
    Object.keys(source).some(key => !expected.has(key))
    || keys.some(key => !(key in source))
  ) throw new NativeSaveFormatError(`${claim} fields are invalid`)
}

function integer(value: unknown, minimum: number, maximum: number, claim: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new NativeSaveFormatError(`${claim} is invalid`)
  }
  return Number(value)
}

function finite(value: unknown, minimum: number, maximum: number, claim: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new NativeSaveFormatError(`${claim} is invalid`)
  }
  return value
}

function boolean(value: unknown, claim: string): boolean {
  if (typeof value !== 'boolean') throw new NativeSaveFormatError(`${claim} is invalid`)
  return value
}

function booleans(value: unknown, count: number, claim: string): readonly boolean[] {
  if (!Array.isArray(value) || value.length !== count) {
    throw new NativeSaveFormatError(`${claim} must contain ${count} flags`)
  }
  return Object.freeze(value.map((entry, index) => boolean(entry, `${claim}[${index}]`)))
}

function integers(
  value: unknown,
  count: number | null,
  minimum: number,
  maximum: number,
  claim: string,
  unique = false,
): readonly number[] {
  if (!Array.isArray(value) || (count !== null && value.length !== count)) {
    throw new NativeSaveFormatError(`${claim} is invalid`)
  }
  const result = value.map((entry, index) => integer(entry, minimum, maximum, `${claim}[${index}]`))
  if (unique && new Set(result).size !== result.length) {
    throw new NativeSaveFormatError(`${claim} contains duplicates`)
  }
  return Object.freeze(result)
}

function nullableIntegers(
  value: unknown,
  count: number,
  minimum: number,
  maximum: number,
  claim: string,
): readonly (number | null)[] {
  if (!Array.isArray(value) || value.length !== count) {
    throw new NativeSaveFormatError(`${claim} must contain ${count} entries`)
  }
  return Object.freeze(value.map((entry, index) => entry === null
    ? null
    : integer(entry, minimum, maximum, `${claim}[${index}]`)))
}

function hagathaOutcomes(value: unknown): readonly number[] {
  const outcomes = integers(value, null, 0, 27, 'portable perk selectors')
  const ordinary = outcomes.filter(selector => selector !== 27)
  if (
    outcomes.length > 11
    || outcomes.includes(8)
    || new Set(ordinary).size !== ordinary.length
    || outcomes.filter(selector => selector === 27).length > 2
  ) throw new NativeSaveFormatError('portable perk selectors are not a native outcome list')
  return outcomes
}

async function parseNativeSource(value: unknown): Promise<NativeGameSaveSource> {
  const source = record(value, 'portable native source')
  onlyKeys(source, [
    'darkdataBase64', 'darkdataSha256', 'gamestateBase64', 'gamestateSha256',
    'retainedFiles', 'runName',
  ], 'portable native source')
  const retainedValues = source.retainedFiles
  if (
    typeof source.darkdataBase64 !== 'string'
    || typeof source.gamestateBase64 !== 'string'
    || typeof source.darkdataSha256 !== 'string'
    || typeof source.gamestateSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(source.darkdataSha256)
    || !/^[a-f0-9]{64}$/.test(source.gamestateSha256)
    || typeof source.runName !== 'string'
    || !/^[A-Za-z0-9._-]{1,64}$/.test(source.runName)
    || !Array.isArray(retainedValues)
    || retainedValues.length > 253
  ) throw new NativeSaveFormatError('portable native source is invalid')
  const darkdata = portableBase64ToBytes(source.darkdataBase64, 'portable darkdata')
  const gamestate = portableBase64ToBytes(source.gamestateBase64, 'portable gamestate')
  const retainedPaths = new Set<string>()
  let totalBytes = darkdata.byteLength + gamestate.byteLength
  const retainedFiles: NativeRetainedSaveFileSource[] = []
  for (const [index, value] of retainedValues.entries()) {
    const file = record(value, `portable retained file ${index}`)
    onlyKeys(file, ['base64', 'path', 'sha256'], `portable retained file ${index}`)
    if (
      typeof file.base64 !== 'string'
      || typeof file.path !== 'string'
      || !nativeRetainedPathIsSafe(file.path)
      || typeof file.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(file.sha256)
      || retainedPaths.has(file.path.toLowerCase())
    ) throw new NativeSaveFormatError(`portable retained file ${index} is invalid`)
    const bytes = portableBase64ToBytes(file.base64, `portable retained file ${index}`)
    if (
      bytesToBase64(bytes) !== file.base64
      || await portableSha256(bytes) !== file.sha256
    ) {
      throw new NativeSaveFormatError(`portable retained file ${index} integrity is invalid`)
    }
    totalBytes += bytes.byteLength
    retainedPaths.add(file.path.toLowerCase())
    retainedFiles.push(Object.freeze({
      base64: file.base64,
      path: file.path,
      sha256: file.sha256,
    }))
  }
  if (
    darkdata.byteLength === 0
    || gamestate.byteLength === 0
    || bytesToBase64(darkdata) !== source.darkdataBase64
    || bytesToBase64(gamestate) !== source.gamestateBase64
    || totalBytes > NATIVE_SOURCE_ATTACHMENT_MAX_BYTES
    || await portableSha256(darkdata) !== source.darkdataSha256
    || await portableSha256(gamestate) !== source.gamestateSha256
  ) throw new NativeSaveFormatError('portable native source integrity is invalid')
  decodeNativeDarkdataProfile(darkdata)
  decodeNativeGamestateWizard(gamestate)
  decodeNativeGamestateBoast(gamestate)
  return Object.freeze({
    darkdataBase64: source.darkdataBase64,
    darkdataSha256: source.darkdataSha256,
    gamestateBase64: source.gamestateBase64,
    gamestateSha256: source.gamestateSha256,
    retainedFiles: Object.freeze(retainedFiles),
    runName: source.runName,
  })
}

export async function validateNativeGameSaveSource(
  value: unknown,
): Promise<NativeGameSaveSource> {
  return parseNativeSource(value)
}

export async function parsePortableGameProfile(document: string): Promise<PortableGameProfile> {
  if (
    typeof document !== 'string'
    || document.length === 0
    || encoder.encode(document).byteLength > MAX_PORTABLE_GAME_PROFILE_BYTES
  ) throw new NativeSaveFormatError('portable profile exceeds its size limit')
  let value: unknown
  try {
    value = JSON.parse(document)
  } catch {
    throw new NativeSaveFormatError('portable profile is not valid JSON')
  }
  const root = record(value, 'portable profile')
  onlyKeys(root, [
    'format', 'nativeSource', 'profile', 'retailExecutableSha256', 'version', 'warnings', 'wizard',
  ], 'portable profile')
  if (
    root.format !== PORTABLE_GAME_PROFILE_FORMAT
    || root.version !== PORTABLE_GAME_PROFILE_VERSION
    || root.retailExecutableSha256 !== RETAIL_SOLOMON_DARK_SHA256
  ) throw new NativeSaveFormatError('portable profile version or retail identity is unsupported')

  const profile = record(root.profile, 'portable profile state')
  onlyKeys(profile, [
    'boast', 'dowsingFee', 'firstMixed', 'gold', 'hagathaBundleSelectors', 'helpPending',
    'librarianLaceRead', 'nativeStorage', 'tutorialPending',
  ], 'portable profile state')
  const storage = record(profile.nativeStorage, 'portable native storage')
  const boast = record(profile.boast, 'portable Boast state')
  onlyKeys(boast, ['failed', 'selected', 'succeeded'], 'portable Boast state')
  onlyKeys(storage, ['childCount', 'materializedInWeb', 'payloadLength'], 'portable native storage')
  if (storage.materializedInWeb !== false) {
    throw new NativeSaveFormatError('portable native storage materialization claim is invalid')
  }

  const wizard = record(root.wizard, 'portable wizard')
  onlyKeys(wizard, [
    'advancedUnlocks', 'cheatDeathCharges', 'cheatDeathEnabled', 'concentrationSkillIds',
    'currentHealth', 'currentMana', 'deferredSkillChoices', 'disciplineRoot', 'elementRoot', 'experience',
    'experienceBonus', 'firewalkerActive', 'hagathaOwnership', 'learnedOrder', 'level',
    'manaCostReduction', 'maximumHealth', 'maximumMana', 'meditationIdleDelay', 'name',
    'nextConcentrationSlot',
    'nextThreshold', 'offerSeed', 'offensiveDamageFlat', 'pendingSkillChoices',
    'perkCapacity', 'perkSelectors', 'permanentRanks', 'poisonImmunityTicks',
    'previousThreshold', 'selectedPrimarySkillId', 'skillQuickbar', 'startingPrimary',
    'startingSecondary', 'weldEffect',
  ], 'portable wizard')
  if (
    typeof wizard.name !== 'string'
    || wizard.name.length === 0
    || wizard.name.length > 64
    || encoder.encode(wizard.name).byteLength > 255
    || [...wizard.name].some(character => character.charCodeAt(0) < 0x20)
  ) throw new NativeSaveFormatError('portable wizard name is invalid')
  if (!Array.isArray(root.warnings) || root.warnings.some(entry => typeof entry !== 'string')) {
    throw new NativeSaveFormatError('portable profile warnings are invalid')
  }

  const result: PortableGameProfile = {
    format: PORTABLE_GAME_PROFILE_FORMAT,
    nativeSource: await parseNativeSource(root.nativeSource),
    profile: {
      boast: Object.freeze({
        failed: boolean(boast.failed, 'portable Boast failure'),
        selected: boast.selected === null
          ? null
          : integer(boast.selected, 0, 4, 'portable selected Boast') as 0 | 1 | 2 | 3 | 4,
        succeeded: boolean(boast.succeeded, 'portable Boast success'),
      }),
      dowsingFee: integer(profile.dowsingFee, 0, 2_147_483_647, 'portable Dowsing fee'),
      firstMixed: booleans(profile.firstMixed, NATIVE_FIRST_MIX_COUNT, 'portable first-mix state'),
      gold: integer(profile.gold, 0, 2_147_483_647, 'portable gold'),
      hagathaBundleSelectors: integers(
        profile.hagathaBundleSelectors, null, -1, 49, 'portable Hagatha bundle', true,
      ),
      helpPending: booleans(profile.helpPending, 10, 'portable help state'),
      librarianLaceRead: boolean(profile.librarianLaceRead, 'portable Lace state'),
      nativeStorage: {
        childCount: integer(storage.childCount, 0, 1_000_000, 'portable storage child count'),
        materializedInWeb: false,
        payloadLength: integer(storage.payloadLength, 0, 64 * 1024 * 1024, 'portable storage bytes'),
      },
      tutorialPending: boolean(profile.tutorialPending, 'portable Tutorial state'),
    },
    retailExecutableSha256: RETAIL_SOLOMON_DARK_SHA256,
    version: PORTABLE_GAME_PROFILE_VERSION,
    warnings: Object.freeze([...(root.warnings as string[])]),
    wizard: {
      advancedUnlocks: booleans(wizard.advancedUnlocks, 8, 'portable advanced unlocks'),
      cheatDeathCharges: integer(wizard.cheatDeathCharges, 0, 1_000, 'portable cheat-death charges'),
      cheatDeathEnabled: boolean(wizard.cheatDeathEnabled, 'portable cheat-death state'),
      concentrationSkillIds: nullableIntegers(
        wizard.concentrationSkillIds, 2, 8, 79, 'portable concentrations',
      ) as readonly [number | null, number | null],
      currentHealth: finite(wizard.currentHealth, 0, 1_000_000, 'portable current health'),
      currentMana: finite(wizard.currentMana, 0, 1_000_000, 'portable current mana'),
      deferredSkillChoices: integer(wizard.deferredSkillChoices, 0, 1_000, 'portable deferred choices'),
      disciplineRoot: integer(wizard.disciplineRoot, 5, 7, 'portable discipline root'),
      elementRoot: integer(wizard.elementRoot, 0, 4, 'portable element root'),
      experience: finite(wizard.experience, 0, 10_000_000, 'portable experience'),
      experienceBonus: finite(wizard.experienceBonus, -1_000, 1_000, 'portable experience bonus'),
      firewalkerActive: boolean(wizard.firewalkerActive, 'portable Firewalker state'),
      hagathaOwnership: booleans(
        wizard.hagathaOwnership, NATIVE_HAGATHA_OWNERSHIP_COUNT, 'portable Hagatha ownership',
      ),
      learnedOrder: integers(wizard.learnedOrder, null, 8, 79, 'portable learned order', true),
      level: integer(wizard.level, 1, 75, 'portable level'),
      manaCostReduction: finite(wizard.manaCostReduction, -1_000_000, 1_000_000, 'portable mana reduction'),
      maximumHealth: finite(wizard.maximumHealth, 1, 1_000_000, 'portable maximum health'),
      maximumMana: finite(wizard.maximumMana, 1, 1_000_000, 'portable maximum mana'),
      meditationIdleDelay: integer(wizard.meditationIdleDelay, -1, 10_000_000, 'portable Meditation delay'),
      name: wizard.name,
      nextConcentrationSlot: integer(
        wizard.nextConcentrationSlot, 0, 1, 'portable concentration cursor',
      ) as 0 | 1,
      nextThreshold: finite(wizard.nextThreshold, 0, 10_000_000, 'portable next threshold'),
      offerSeed: integer(wizard.offerSeed, 0, 999_999, 'portable offer seed'),
      offensiveDamageFlat: finite(wizard.offensiveDamageFlat, -1_000_000, 1_000_000, 'portable damage flat'),
      pendingSkillChoices: integer(wizard.pendingSkillChoices, 0, 1_000, 'portable pending choices'),
      perkCapacity: integer(wizard.perkCapacity, 0, 64, 'portable perk capacity'),
      perkSelectors: hagathaOutcomes(wizard.perkSelectors),
      permanentRanks: integers(
        wizard.permanentRanks,
        NATIVE_WIZARD_SKILL_ROW_COUNT,
        0,
        0xffff,
        'portable permanent ranks',
      ),
      poisonImmunityTicks: integer(wizard.poisonImmunityTicks, 0, 10_000_000, 'portable poison immunity'),
      previousThreshold: finite(wizard.previousThreshold, 0, 10_000_000, 'portable previous threshold'),
      selectedPrimarySkillId: integer(
        wizard.selectedPrimarySkillId, 8, 80, 'portable selected primary',
      ),
      skillQuickbar: nullableIntegers(wizard.skillQuickbar, 8, 8, 79, 'portable quickbar'),
      startingPrimary: integer(wizard.startingPrimary, 8, 79, 'portable starting primary'),
      startingSecondary: integer(wizard.startingSecondary, 8, 79, 'portable starting secondary'),
      weldEffect: finite(wizard.weldEffect, 0, 1_000_000, 'portable weld effect'),
    },
  }
  if (
    result.wizard.currentHealth > result.wizard.maximumHealth
    || result.wizard.currentMana > result.wizard.maximumMana
    || result.wizard.learnedOrder.some(id => result.wizard.permanentRanks[id] === 0)
  ) throw new NativeSaveFormatError('portable wizard progression is internally inconsistent')
  if (
    (result.wizard.selectedPrimarySkillId !== 80
      && nativeSkillCategory(result.wizard.selectedPrimarySkillId) !== 1)
    || result.wizard.concentrationSkillIds.some(skillId => (
      skillId !== null && nativeSkillCategory(skillId) !== 3
    ))
    || (
      result.wizard.concentrationSkillIds[0] !== null
      && result.wizard.concentrationSkillIds[0] === result.wizard.concentrationSkillIds[1]
    )
    || (result.wizard.concentrationSkillIds[1] !== null
      && !result.wizard.perkSelectors.includes(21))
    || result.wizard.skillQuickbar.some(skillId => (
      skillId !== null
      && nativeSkillCategory(skillId) !== 1
      && nativeSkillCategory(skillId) !== 2
    ))
  ) throw new NativeSaveFormatError('portable selected-skill state is invalid')
  const tonicPurchases = result.wizard.perkSelectors.filter(selector => selector === 27).length
  const ordinaryPerks = new Set(result.wizard.perkSelectors.filter(selector => selector !== 27))
  if (
    result.wizard.perkCapacity !== 3 + tonicPurchases * 3
    || ordinaryPerks.size > result.wizard.perkCapacity
    || result.wizard.hagathaOwnership.slice(0, 27).some((owned, selector) => (
      selector !== 8 && owned !== ordinaryPerks.has(selector)
    ))
    || result.wizard.hagathaOwnership[27] !== (tonicPurchases > 0)
  ) throw new NativeSaveFormatError('portable Hagatha outcomes and ownership are inconsistent')
  if (
    (result.profile.boast.selected === null
      && (result.profile.boast.failed || result.profile.boast.succeeded))
    || (result.profile.boast.selected === 3 && result.profile.boast.failed)
    || (result.profile.boast.failed && result.profile.boast.succeeded)
  ) throw new NativeSaveFormatError('portable Boast lifecycle is inconsistent')
  return Object.freeze({
    ...result,
    profile: Object.freeze(result.profile),
    wizard: Object.freeze(result.wizard),
  })
}

export function encodePortableGameProfile(profile: PortableGameProfile): string {
  const document = JSON.stringify(profile)
  if (encoder.encode(document).byteLength > MAX_PORTABLE_GAME_PROFILE_BYTES) {
    throw new NativeSaveFormatError('portable profile exceeds its size limit')
  }
  return document
}

export function nativeSourceBytes(source: NativeGameSaveSource): NativeHubBytes {
  const darkdata = portableBase64ToBytes(source.darkdataBase64, 'portable darkdata')
  const gamestate = portableBase64ToBytes(source.gamestateBase64, 'portable gamestate')
  const retainedFiles = source.retainedFiles.map(file => Object.freeze({
    bytes: portableBase64ToBytes(file.base64, `portable retained file ${file.path}`),
    path: file.path,
  }))
  return Object.freeze({ darkdata, gamestate, retainedFiles: Object.freeze(retainedFiles) })
}

export interface NativeHubBytes {
  readonly darkdata: Uint8Array
  readonly gamestate: Uint8Array
  readonly retainedFiles: readonly Readonly<{ bytes: Uint8Array; path: string }>[]
}
