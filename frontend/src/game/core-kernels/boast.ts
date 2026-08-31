export type NativeBoastId = 0 | 1 | 2 | 3 | 4

export type BoastFailureProducer =
  | 'magical-equipment'
  | 'mana-underflow'
  | 'potion-use'
  | 'secondary-cast'

export interface ModBoastSelection {
  readonly contentId: string
  readonly kind: 'mod'
  readonly modId: string
}

/** Retail selections remain numeric; Website additions retain their owning package identity. */
export type BoastSelection = NativeBoastId | ModBoastSelection

export interface BoastDefinition {
  readonly failureProducers: readonly BoastFailureProducer[]
  readonly instruction: string
  readonly label: string
  readonly randomSkillChoices: boolean
  readonly scoreMultiplier: number
  readonly selection: BoastSelection
  readonly statement: string
  readonly successWave: number
}

export interface BoastState {
  readonly failed: boolean
  readonly failureSequence: number
  readonly selected: BoastSelection | null
  readonly succeeded: boolean
}

export type BoastResolver = (selection: BoastSelection) => BoastDefinition | null

export function createBoastState(): BoastState {
  return Object.freeze({ failed: false, failureSequence: 0, selected: null, succeeded: false })
}

export function createModBoastSelection(contentId: string, modId: string): ModBoastSelection {
  if (!/^[1-9][0-9]{0,18}$/.test(contentId)) {
    throw new RangeError('mod Boast content ID must be a positive decimal string of at most 19 digits')
  }
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(modId)) {
    throw new RangeError('mod Boast owner ID is invalid')
  }
  return Object.freeze({ contentId, kind: 'mod' as const, modId })
}

export function isModBoastSelection(value: BoastSelection): value is ModBoastSelection {
  return typeof value !== 'number'
}

export function boastSelectionKey(selection: BoastSelection): string {
  return typeof selection === 'number'
    ? `native:${selection}`
    : `mod:${selection.modId}:${selection.contentId}`
}

export function boastSelectionsEqual(
  left: BoastSelection | null,
  right: BoastSelection | null,
): boolean {
  if (left === right) return true
  if (left === null || right === null || typeof left === 'number' || typeof right === 'number') {
    return false
  }
  return left.contentId === right.contentId && left.modId === right.modId
}

export function selectBoast(
  source: BoastState,
  definition: BoastDefinition,
): BoastState {
  return Object.freeze({
    ...source,
    selected: freezeSelection(definition.selection),
    succeeded: false,
  })
}

export function failBoast(
  source: BoastState,
  producer: BoastFailureProducer,
  resolve: BoastResolver,
): BoastState {
  const definition = source.selected === null ? null : resolve(source.selected)
  if (!definition || !definition.failureProducers.includes(producer) || source.failed) return source
  return Object.freeze({
    ...source,
    failed: true,
    failureSequence: source.failureSequence + 1,
    succeeded: false,
  })
}

export function succeedBoast(
  source: BoastState,
  completedWave: number,
  resolve: BoastResolver,
): BoastState {
  const definition = source.selected === null ? null : resolve(source.selected)
  if (
    !definition
    || !Number.isSafeInteger(completedWave)
    || completedWave < definition.successWave
    || source.failed
    || source.succeeded
  ) return source
  return Object.freeze({ ...source, succeeded: true })
}

export function scoreBoast(
  score: number,
  state: BoastState,
  resolve: BoastResolver,
): number {
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new RangeError('Boast score must be a non-negative safe integer')
  }
  const definition = state.selected === null ? null : resolve(state.selected)
  return state.succeeded && definition
    ? Math.trunc(Math.fround(score) * definition.scoreMultiplier)
    : score
}

export function boastFailureText(
  state: BoastState,
  resolve: BoastResolver,
): string | null {
  const definition = state.selected === null ? null : resolve(state.selected)
  return definition && state.failed ? `FAILED "${definition.label}"` : null
}

export function boastUsesRandomSkillChoices(
  state: BoastState,
  resolve: BoastResolver,
): boolean {
  if (state.selected === null || state.failed) return false
  return resolve(state.selected)?.randomSkillChoices === true
}

export function boastStateIsConsistent(
  state: BoastState,
  resolve: BoastResolver,
): boolean {
  if (
    !Number.isSafeInteger(state.failureSequence)
    || state.failureSequence < 0
    || state.failureSequence > 1
    || state.failed !== (state.failureSequence === 1)
    || state.failed && state.succeeded
    || state.selected === null && (state.failed || state.succeeded)
  ) return false
  const definition = state.selected === null ? null : resolve(state.selected)
  return state.selected === null || definition !== null
}

function freezeSelection(selection: BoastSelection): BoastSelection {
  return typeof selection === 'number'
    ? selection
    : createModBoastSelection(selection.contentId, selection.modId)
}
