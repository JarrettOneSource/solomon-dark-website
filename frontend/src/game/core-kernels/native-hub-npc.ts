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
export type NativeHubNpcMarkerSide = 'left' | 'right'
export type NativeHubNpcMarkerStyle = 'help' | 'talk'
export interface NativeHubNpcMarkerActorDefinition {
  readonly interactionId: NativeHubInteractionId
  readonly phaseAdvances: boolean
  readonly profileHintIndex: number | null
  readonly record: number
  readonly region: HubRegionId
  readonly side: NativeHubNpcMarkerSide
  readonly style: NativeHubNpcMarkerStyle
  readonly typeId: number
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
  readonly markers: {
    readonly actors: readonly NativeHubNpcMarkerActorDefinition[]
    readonly common: {
      readonly alphaAmplitude: number
      readonly alphaBase: number
      readonly phaseDrawCount: number
      readonly rootOffsetX: number
      readonly rootOffsetY: number
    }
    readonly directionalHints: {
      readonly blinkPeriodTicks: number
      readonly record: number
      readonly targets: readonly {
        readonly interactionId: NativeHubInteractionId
        readonly offset: Vector2
        readonly profileHintIndex: number
      }[]
      readonly visibleAfterTick: number
    }
    readonly profileHelpRowCount: number
    readonly regionBanks: readonly {
      readonly atlas: string
      readonly records: readonly number[]
      readonly region: HubRegionId
    }[]
    readonly walkToTalk: {
      readonly arrowOffset: Vector2
      readonly arrowRecord: number
      readonly arrowRotationDegrees: number
      readonly fontGroup: number
      readonly fontRecords: readonly [number, number]
      readonly outlineRadii: readonly number[]
      readonly outlineStepDegrees: number
      readonly profileHintIndex: number
      readonly target: NativeHubInteractionId
      readonly text: string
      readonly textColor: readonly [number, number, number, number]
      readonly textOffset: Vector2
    }
  }
  readonly schema: 'solomon-dark-native-hub-npc-interactions-v3'
  readonly skorcha: {
    readonly animationDelay: { readonly drawCount: number; readonly offsetTicks: number }
    readonly animationStateCount: number
    readonly artRecords: readonly number[]
    readonly placements: readonly { readonly variant: number; readonly x: number; readonly y: number }[]
    readonly presenceDrawCount: number
    readonly presenceDrawValue: number
  }
  readonly source: {
    readonly dialogueHashes: Readonly<Record<
      'books.txt' | 'narration.txt' | 'spellfacts.txt' | 'story.txt' | 'survival.txt',
      string
    >>
    readonly executableSha256: string
    readonly preferredImageBase: string
    readonly retailVersion: string
  }
  readonly storyOffice: {
    readonly archIntroVoice: {
      readonly bytes: number
      readonly sha256: string
    }
    readonly dialogue: Readonly<Record<string, NativeHubDialogueRecord>>
    readonly interactions: Readonly<Record<
      'arch-chancellor' | 'polisher',
      NativeHubInteractionDefinition
    >>
    readonly polisher: {
      readonly artRecords: readonly number[]
      readonly loopFullDistance: number
      readonly loopSha256: string
      readonly loopSilentDistance: number
      readonly phaseFloatRange: number
      readonly phaseSpeed: number
      readonly reverseDrawCount: number
      readonly reverseDrawValue: number
    }
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
  readonly helpFlags: readonly boolean[]
  readonly librarianLaceRead: boolean
}

export const NATIVE_HUB_NPC_CATALOG = nativeCatalogJson as unknown as NativeHubNpcCatalog
export const NATIVE_HUB_INTERACTION_IDS = NATIVE_HUB_NPC_CATALOG.interactionOrder
export const NATIVE_BOASTS = NATIVE_HUB_NPC_CATALOG.boasts
export const NATIVE_LIBRARIAN_BOOKS = NATIVE_HUB_NPC_CATALOG.books
export const NATIVE_TEACHER_SPELLS = NATIVE_HUB_NPC_CATALOG.teacherSpells
export const NATIVE_BOAST_SUCCESS_WAVE = 30
export const NATIVE_SELECTOR_ACCEPT_TICKS = 100
export const NATIVE_HUB_HELP_ROW_COUNT = NATIVE_HUB_NPC_CATALOG.markers.profileHelpRowCount

export function createNativeHubNpcState(): NativeHubNpcState {
  return Object.freeze({
    boast: Object.freeze({ failed: false, failureSequence: 0, selected: null, succeeded: false }),
    helpFlags: Object.freeze(Array<boolean>(NATIVE_HUB_HELP_ROW_COUNT).fill(true)),
    librarianLaceRead: false,
  })
}

export function nativeHubNpcHintIndex(
  interactionId: NativeHubInteractionId,
): 0 | 1 | 2 | null {
  const index = NATIVE_HUB_NPC_CATALOG.markers.actors.find(
    actor => actor.interactionId === interactionId,
  )?.profileHintIndex
  return index === 0 || index === 1 || index === 2 ? index : null
}

export function acknowledgeNativeHubNpcHint(
  source: NativeHubNpcState,
  interactionId: NativeHubInteractionId,
): NativeHubNpcState {
  const index = nativeHubNpcHintIndex(interactionId)
  if (index === null || source.helpFlags[index] === false) return source
  const helpFlags = [...source.helpFlags]
  helpFlags[index] = false
  return Object.freeze({ ...source, helpFlags: Object.freeze(helpFlags) })
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
  return boast && state.failed ? `FAILED "${boast.label}"` : null
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
