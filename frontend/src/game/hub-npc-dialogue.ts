import {
  NATIVE_BOASTS,
  NATIVE_HUB_NPC_CATALOG,
  NATIVE_TEACHER_SPELLS,
  nativeLibrarianBooks,
  nativeTeacherSpells,
  type NativeHubDialogueRecord,
  type NativeHubNpcSelector,
  type NativeHubNpcState,
} from './core-kernels/native-hub-npc.ts'
import {
  boastSelectionKey,
  createModBoastSelection,
  type BoastSelection,
  type BoastState,
  type ModBoastSelection,
} from './core-kernels/boast.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import type {
  ModBoastIconProjection,
  ModContentProjection,
} from './protocol/game-protocol.ts'
import { formatHallOfFameTime } from './core-kernels/hall-of-fame.ts'
import type { HubMemorialPortrait } from './core-kernels/hub-memorial.ts'
import { wizardClassDisplayTitle } from './core-kernels/native-wizard-class.ts'
import {
  hubInteractionDialogue,
  type HubInteractionId,
} from './hub-inventory-presentation.ts'

export type HubNpcChatNext = 'choices' | 'close' | 'dismissal'

export type HubNpcChatContent =
  | {
      readonly kind: 'choices'
    }
  | {
      readonly kind: 'selector'
      readonly selector: Exclude<NativeHubNpcSelector, 'fomentius' | 'hagatha' | 'luthacus' | 'shlorio'>
    }
  | {
      readonly key: string
      readonly kind: 'speech'
      readonly lines: readonly string[]
      readonly next: HubNpcChatNext
    }

export type HubNpcChatChoice =
  | {
      readonly key: string
      readonly kind: 'question'
      readonly label: string
    }
  | {
      readonly kind: 'command'
      readonly label: string
      readonly selector: NativeHubNpcSelector
    }

export interface HubNpcSelectorRow {
  readonly boastIcon?: ModBoastIconProjection
  readonly detail: string
  readonly id: number | ModBoastSelection
  readonly label: string
  readonly price: number | null
}

export function createHubNpcChatContent(
  interactionId: HubInteractionId,
  npc: NativeHubNpcState,
  randomIndex: number,
  eulogyIndexOverride: number | null = null,
  storyOffice = false,
  memorialPortrait: HubMemorialPortrait | null = null,
): HubNpcChatContent {
  const interaction = hubInteractionDialogue(interactionId, storyOffice)
  if (memorialPortrait !== null) {
    return speech(
      `INSPECT_MEMORIAL_${memorialPortrait.runId}_${memorialPortrait.playerId}`,
      hubMemorialInspectionLines(memorialPortrait),
      'close',
    )
  }
  const eulogyIndex = eulogyIndexOverride ?? interaction.eulogyIndex
  if (eulogyIndex !== null) {
    const eulogyLine = NATIVE_HUB_NPC_CATALOG.eulogies[`${eulogyIndex}`] ?? null
    const badEulogy = npc.boast.succeeded
      ? []
      : [pick(NATIVE_HUB_NPC_CATALOG.badEulogies, randomIndex)]
    return speech(
      `SAY_EULOGY_${eulogyIndex}`,
      [...(eulogyLine === null ? [] : [eulogyLine]), ...badEulogy],
      'close',
    )
  }
  if (interaction.introRecord === null) {
    return interaction.dismissals.length > 0
      ? hubNpcDismissal(interactionId, randomIndex, storyOffice) ?? { kind: 'choices' }
      : { kind: 'choices' }
  }
  return speech(
    interaction.introRecord.key,
    interaction.introRecord.lines,
    hasChoices(interactionId, storyOffice)
      ? 'choices'
      : interaction.dismissals.length > 0
        ? 'dismissal'
        : 'close',
  )
}

export function hubMemorialInspectionLines(
  portrait: HubMemorialPortrait,
): readonly string[] {
  const identity = portrait.accountUsername === null
    ? `${portrait.config.displayName} (Guest Wizard)`
    : `${portrait.config.displayName} (@${portrait.accountUsername})`
  const monsterLabel = portrait.monstersKilled === 1 ? 'monster' : 'monsters'
  return [
    `${identity}, Level ${portrait.level} ${wizardClassDisplayTitle(
      portrait.config.element,
      portrait.config.discipline,
    )}.`,
    `Wave ${portrait.wave} in ${formatHallOfFameTime(portrait.elapsedTicks)}. `
      + `${portrait.monstersKilled.toLocaleString('en-US')} ${monsterLabel} slain. `
      + `${portrait.awesomeness.toLocaleString('en-US')} awesomeness.`,
    ...(portrait.awesomestKill === null
      ? []
      : [`Awesomest kill: ${portrait.awesomestKill}.`]),
  ]
}

export function hubNpcChatChoices(
  interactionId: HubInteractionId,
  storyOffice = false,
): readonly HubNpcChatChoice[] {
  const interaction = hubInteractionDialogue(interactionId, storyOffice)
  return [
    ...interaction.commands.map(({ label, selector }) => ({
      kind: 'command' as const,
      label,
      selector,
    })),
    ...interaction.questions.map(({ key, label }) => ({
      key,
      kind: 'question' as const,
      label,
    })),
  ]
}

export function hubNpcQuestion(
  interactionId: HubInteractionId,
  questionKey: string,
  storyOffice = false,
): HubNpcChatContent | null {
  const question = hubInteractionDialogue(interactionId, storyOffice).questions.find(
    ({ key }) => key === questionKey,
  )
  return question ? recordSpeech(question, 'choices') : null
}

export function hubNpcDismissal(
  interactionId: HubInteractionId,
  randomIndex: number,
  storyOffice = false,
): HubNpcChatContent | null {
  const dismissals = hubInteractionDialogue(interactionId, storyOffice).dismissals
  if (dismissals.length === 0) return null
  return recordSpeech(pick(dismissals, randomIndex), 'close')
}

export function hubNpcSelectorContent(
  selector: NativeHubNpcSelector,
): HubNpcChatContent | null {
  switch (selector) {
    case 'boast':
    case 'books':
    case 'teacher-spells':
      return { kind: 'selector', selector }
    case 'fomentius':
    case 'hagatha':
    case 'luthacus':
    case 'shlorio':
      return null
  }
}

export function hubNpcSelectorRows(
  selector: Extract<HubNpcChatContent, { kind: 'selector' }>['selector'],
  npc: NativeHubNpcState,
  progression: Pick<ProtocolPlayerProgression, 'advancedUnlocks'>,
  mods: ModContentProjection | null = null,
): readonly HubNpcSelectorRow[] {
  switch (selector) {
    case 'boast': return [
      ...NATIVE_BOASTS.map(boast => ({
        boastIcon: { kind: 'stock' as const, record: boast.iconRecord, style: boast.iconRecord - 90 },
        detail: boast.statement,
        id: boast.id,
        label: boast.label,
        price: null,
      })),
      ...(mods?.boasts ?? []).map(boast => ({
        boastIcon: boast.icon,
        detail: boast.statement,
        id: createModBoastSelection(boast.contentId, boast.modId),
        label: boast.name,
        price: null,
      })),
    ]
    case 'books': return nativeLibrarianBooks(npc).map(book => ({
      detail: book.lines.join(' '),
      id: book.id,
      label: book.title,
      price: null,
    }))
    case 'teacher-spells': return nativeTeacherSpells(progression.advancedUnlocks).map(spell => ({
      detail: spell.quickDescription,
      id: spell.skillId,
      label: spell.name,
      price: spell.price,
    }))
  }
}

export function hubNpcSelectorTitle(
  selector: Extract<HubNpcChatContent, { kind: 'selector' }>['selector'],
): string {
  switch (selector) {
    case 'boast': return 'SELECT A BOAST'
    case 'books': return 'SELECT A BOOK'
    case 'teacher-spells': return 'SELECT A SPELL'
  }
}

export function hubNpcSelectorResponse(
  selector: Extract<HubNpcChatContent, { kind: 'selector' }>['selector'],
  id: number | ModBoastSelection,
  mods: ModContentProjection | null = null,
): HubNpcChatContent | null {
  if (selector === 'boast') {
    if (typeof id === 'number') {
      const boast = NATIVE_BOASTS.find(candidate => candidate.id === id)
      if (!boast) return null
      return recordSpeech(NATIVE_HUB_NPC_CATALOG.dialogue[boast.response]!, 'close')
    }
    const boast = mods?.boasts.find(candidate => (
      candidate.contentId === id.contentId && candidate.modId === id.modId
    ))
    return boast ? speech(`MOD_BOAST_${boast.contentId}`, [boast.response], 'close') : null
  }
  if (typeof id !== 'number') return null
  if (selector === 'books') {
    const book = NATIVE_HUB_NPC_CATALOG.books.find(candidate => candidate.id === id)
    return book ? speech(book.key, book.lines, 'choices') : null
  }
  const spell = NATIVE_TEACHER_SPELLS.find(candidate => candidate.skillId === id)
  return spell ? speech(spell.key, spell.explanationLines, 'choices') : null
}

export function hubNpcSelectorAction(
  selector: Extract<HubNpcChatContent, { kind: 'selector' }>['selector'],
  id: number | ModBoastSelection,
) {
  switch (selector) {
    case 'boast': {
      if (typeof id === 'number' && ![0, 1, 2, 3, 4].includes(id)) {
        throw new RangeError('Boast selector ID must be stock 0..4 or namespaced mod content')
      }
      return {
        boastId: id as BoastSelection,
        type: 'select-boast' as const,
      }
    }
    case 'books': {
      if (typeof id !== 'number') throw new RangeError('Book selector ID must be numeric')
      return { bookId: id, type: 'read-librarian-book' as const }
    }
    case 'teacher-spells': {
      if (typeof id !== 'number') throw new RangeError('Teacher selector ID must be numeric')
      return { skillId: id, type: 'buy-teacher-spell' as const }
    }
  }
}

export function hubNpcSelectorRowKey(row: HubNpcSelectorRow): string {
  return typeof row.id === 'number' ? `row:${row.id}` : boastSelectionKey(row.id)
}

export function hubBoastInstruction(
  selection: BoastSelection | null,
  mods: ModContentProjection | null,
): string | null {
  if (selection === null) return null
  if (typeof selection === 'number') return NATIVE_HUB_NPC_CATALOG.boastInstruction
  return mods?.boasts.find(boast => (
    boast.contentId === selection.contentId && boast.modId === selection.modId
  ))?.instruction ?? null
}

export function hubBoastFailureText(
  state: BoastState,
  mods: ModContentProjection | null,
): string | null {
  if (!state.failed || state.selected === null) return null
  const label = typeof state.selected === 'number'
    ? NATIVE_BOASTS.find(boast => boast.id === state.selected)?.label
    : mods?.boasts.find(boast => (
        boast.contentId === (state.selected as ModBoastSelection).contentId
        && boast.modId === (state.selected as ModBoastSelection).modId
      ))?.name
  return label ? `FAILED "${label}"` : null
}

function hasChoices(interactionId: HubInteractionId, storyOffice: boolean): boolean {
  const interaction = hubInteractionDialogue(interactionId, storyOffice)
  return interaction.commands.length > 0 || interaction.questions.length > 0
}

function recordSpeech(record: NativeHubDialogueRecord, next: HubNpcChatNext): HubNpcChatContent {
  return speech(record.key, record.lines, next)
}

function speech(
  key: string,
  lines: readonly string[],
  next: HubNpcChatNext,
): HubNpcChatContent {
  return { key, kind: 'speech', lines, next }
}

function pick<T>(values: readonly T[], randomIndex: number): T {
  if (values.length === 0) throw new RangeError('cannot select from an empty native row set')
  const index = Number.isSafeInteger(randomIndex) ? Math.abs(randomIndex) % values.length : 0
  return values[index]!
}
