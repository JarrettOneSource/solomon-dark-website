import nativeCatalogJson from '../native-hub-npc-catalog.json' with { type: 'json' }

import type { HubRegionId } from './hub-regions.ts'
import type { Vector2 } from './vector.ts'

export type NativeBoastId = 0 | 1 | 2 | 3 | 4
export type NativeBoastFailureProducer =
  | 'magical-equipment'
  | 'mana-underflow'
  | 'potion-use'
  | 'secondary-cast'
export type NativeHubInteractionId =
  | 'hagatha' | 'fomentius' | 'annalist' | 'luthacus' | 'skorcha' | 'teacher'
  | 'memorator' | 'painting-0' | 'painting-1' | 'painting-100' | 'painting-3'
  | 'painting-4' | 'painting-5' | 'painting-6' | 'painting-7' | 'painting-8'
  | 'painting-9' | 'librarian' | 'shlorio' | 'arch-chancellor'
export type NativeHubNpcSelector =
  | 'boast' | 'books' | 'fomentius' | 'hagatha' | 'luthacus' | 'shlorio'
  | 'teacher-spells'

export interface NativeHubDialogueRecord {
  readonly key: string
  readonly label: string
  readonly lines: readonly string[]
}
export interface NativeHubNpcCommand {
  readonly label: string
  readonly nativeCommand: string
  readonly selector: NativeHubNpcSelector
}
export interface NativeHubNpcGeometry {
  readonly position: Vector2
  readonly radius: number
  readonly rangeRadius?: number
  readonly region: HubRegionId
}
export interface NativeHubInteractionDefinition {
  readonly commands: readonly NativeHubNpcCommand[]
  readonly dismissals: readonly string[]
  readonly eulogyIndex?: number
  readonly geometry: NativeHubNpcGeometry
  readonly intro: string | null
  readonly name: string
  readonly questions: readonly string[]
  readonly serviceTitle: string | null
}
export interface NativeBoastDefinition {
  readonly failureProducer: NativeBoastFailureProducer | null
  readonly id: NativeBoastId
  readonly label: string
  readonly response: string
  readonly statement: string
}
export interface NativeLibrarianBookDefinition {
  readonly id: number
  readonly key: string
  readonly lines: readonly string[]
  readonly oneShot: boolean
  readonly title: string
}
export interface NativeTeacherSpellDefinition {
  readonly explanationLabel: string
  readonly explanationLines: readonly string[]
  readonly key: string
  readonly name: string
  readonly price: number
  readonly quickDescription: string
  readonly skillId: number
}
interface NativeHubNpcCatalog {
  readonly badEulogies: readonly string[]
  readonly boastInstruction: string
  readonly boastScoreMultiplier: number
  readonly boasts: readonly NativeBoastDefinition[]
  readonly books: readonly NativeLibrarianBookDefinition[]
  readonly dialogue: Readonly<Record<string, NativeHubDialogueRecord>>
  readonly eulogies: Readonly<Record<string, string | null>>
  readonly interactionOrder: readonly NativeHubInteractionId[]
  readonly interactions: Readonly<Record<NativeHubInteractionId, NativeHubInteractionDefinition>>
  readonly interruptEulogies: readonly string[]
  readonly schema: 'solomon-dark-native-hub-npc-interactions-v1'
  readonly skorcha: {
    readonly animationDelay: { readonly drawCount: number; readonly offsetTicks: number }
    readonly animationStateCount: number
    readonly artRecords: readonly number[]
    readonly placements: readonly { readonly variant: number; readonly x: number; readonly y: number }[]
    readonly presenceDrawCount: number
    readonly presenceDrawValue: number
  }
  readonly source: {
    readonly dialogueHashes: Readonly<Record<'books.txt' | 'narration.txt' | 'spellfacts.txt' | 'survival.txt', string>>
    readonly executableSha256: string
    readonly preferredImageBase: string
    readonly retailVersion: string
  }
  readonly teacherSpells: readonly NativeTeacherSpellDefinition[]
}
export interface NativeBoastState {
  readonly failed: boolean
  readonly failureSequence: number
  readonly selected: NativeBoastId | null
  readonly succeeded: boolean
}
export interface NativeHubNpcState {
  readonly boast: NativeBoastState
  readonly librarianLaceRead: boolean
}

export const NATIVE_HUB_NPC_CATALOG = nativeCatalogJson as unknown as NativeHubNpcCatalog
export const NATIVE_HUB_INTERACTION_IDS = NATIVE_HUB_NPC_CATALOG.interactionOrder
export const NATIVE_BOASTS = NATIVE_HUB_NPC_CATALOG.boasts
export const NATIVE_LIBRARIAN_BOOKS = NATIVE_HUB_NPC_CATALOG.books
export const NATIVE_TEACHER_SPELLS = NATIVE_HUB_NPC_CATALOG.teacherSpells
export const NATIVE_BOAST_SUCCESS_WAVE = 30
export const NATIVE_SELECTOR_ACCEPT_TICKS = 100

export function createNativeHubNpcState(): NativeHubNpcState {
  return Object.freeze({
    boast: Object.freeze({ failed: false, failureSequence: 0, selected: null, succeeded: false }),
    librarianLaceRead: false,
  })
}

export function nativeBoastDefinition(id: number): NativeBoastDefinition | null {
  return NATIVE_BOASTS.find((boast) => boast.id === id) ?? null
}

export function nativeTeacherSpellDefinition(skillId: number): NativeTeacherSpellDefinition | null {
  return NATIVE_TEACHER_SPELLS.find((spell) => spell.skillId === skillId) ?? null
}

export function selectNativeBoast(source: NativeHubNpcState, id: number): NativeHubNpcState | null {
  const boast = nativeBoastDefinition(id)
  if (!boast) return null
  return Object.freeze({
    ...source,
    boast: Object.freeze({ ...source.boast, selected: boast.id, succeeded: false }),
  })
}

export function failNativeBoast(
  source: NativeHubNpcState,
  producer: NativeBoastFailureProducer,
): NativeHubNpcState {
  const boast = source.boast.selected === null
    ? null
    : nativeBoastDefinition(source.boast.selected)
  if (!boast || boast.failureProducer !== producer || source.boast.failed) return source
  return Object.freeze({
    ...source,
    boast: Object.freeze({
      ...source.boast,
      failed: true,
      failureSequence: source.boast.failureSequence + 1,
      succeeded: false,
    }),
  })
}

export function succeedNativeBoast(source: NativeHubNpcState): NativeHubNpcState {
  if (source.boast.selected === null || source.boast.failed || source.boast.succeeded) return source
  return Object.freeze({
    ...source,
    boast: Object.freeze({ ...source.boast, succeeded: true }),
  })
}

export function readNativeLibrarianBook(
  source: NativeHubNpcState,
  bookId: number,
): NativeHubNpcState | null {
  const book = NATIVE_LIBRARIAN_BOOKS.find((candidate) => candidate.id === bookId)
  if (!book || (book.oneShot && source.librarianLaceRead)) return null
  return book.oneShot ? Object.freeze({ ...source, librarianLaceRead: true }) : source
}

export function resetNativeRunNpcState(source: NativeHubNpcState): NativeHubNpcState {
  return Object.freeze({ ...source, boast: createNativeHubNpcState().boast })
}

export function nativeBoastScore(score: number, state: NativeBoastState): number {
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new RangeError('native Boast score must be a non-negative safe integer')
  }
  return state.succeeded
    ? Math.trunc(Math.fround(score) * NATIVE_HUB_NPC_CATALOG.boastScoreMultiplier)
    : score
}

export function nativeBoastFailureText(state: NativeBoastState): string | null {
  const boast = state.selected === null ? null : nativeBoastDefinition(state.selected)
  return boast && state.failed ? `FAILED ${boast.statement}` : null
}

export function nativeLibrarianBooks(
  state: NativeHubNpcState,
): readonly NativeLibrarianBookDefinition[] {
  return state.librarianLaceRead
    ? NATIVE_LIBRARIAN_BOOKS.filter((book) => !book.oneShot)
    : NATIVE_LIBRARIAN_BOOKS
}

export function nativeTeacherSpells(
  advancedUnlocks: readonly boolean[],
): readonly NativeTeacherSpellDefinition[] {
  return NATIVE_TEACHER_SPELLS.filter((spell) => !advancedUnlocks[spell.skillId - 72])
}
