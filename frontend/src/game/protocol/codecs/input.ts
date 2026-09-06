import {
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  isWizardDiscipline,
  isWizardElement,
} from '../../core-kernels/player-character.ts'
import {
  GAMEPLAY_RESUME_GRACE_DURATION_MS,
  GAMEPLAY_RESUME_GRACE_REASONS,
  type GameplayPauseSource,
  type GameplayPauseState,
  type GameplayResumeGraceState,
  type PlayerCharacterKernelParameters,
} from '../game-protocol-contract.ts'
import { unitVector, vector } from './native-state.ts'
import {
  GameProtocolError,
  boolean,
  finite,
  integer,
  limitedString,
  memberString,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
  validatedPlayerId,
} from './values.ts'

function skillQuickbarSlot(value: unknown, field: string): number | null {
  if (value === null) return null
  const slot = integer(value, field)
  if (slot < 0 || slot > 7) {
    throw new GameProtocolError(`${field} must be null or an integer from 0 through 7`)
  }
  return slot
}

export function decodePlayerCharacterInput(value: unknown, field: string): PlayerCharacterInput {
  const source = record(value, field)
  onlyKeys(source, field, ['aim', 'cast', 'movement', 'viewportHeight', 'viewportWidth'])
  const cast = record(source.cast, `${field}.cast`)
  onlyKeys(cast, `${field}.cast`, ['primary', 'quickbar'])
  const viewportHeight = finite(source.viewportHeight, `${field}.viewportHeight`)
  const viewportWidth = finite(source.viewportWidth, `${field}.viewportWidth`)
  if (
    viewportHeight < 1 || viewportHeight > 32_768
    || viewportWidth < 1 || viewportWidth > 32_768
  ) {
    throw new GameProtocolError(`${field}.viewportHeight/viewportWidth is outside range`)
  }
  return {
    aim: source.aim === null ? null : vector(source.aim, `${field}.aim`),
    cast: {
      primary: boolean(cast.primary, `${field}.cast.primary`),
      quickbar: skillQuickbarSlot(cast.quickbar, `${field}.cast.quickbar`),
    },
    movement: unitVector(source.movement, `${field}.movement`),
    viewportHeight,
    viewportWidth,
  }
}

export function playerCharacterConfig(value: unknown, field: string): PlayerCharacterConfig {
  const source = record(value, field)
  onlyKeys(source, field, ['discipline', 'displayName', 'element'])
  const discipline = limitedString(source.discipline, `${field}.discipline`, 32)
  if (!isWizardDiscipline(discipline)) {
    throw new GameProtocolError(`${field}.discipline is not supported`)
  }
  const element = limitedString(source.element, `${field}.element`, 32)
  if (!isWizardElement(element)) {
    throw new GameProtocolError(`${field}.element is not supported`)
  }
  return {
    discipline,
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    element,
  }
}

export function gameplayPauseState(value: unknown, field: string): GameplayPauseState {
  const source = record(value, field)
  onlyKeys(source, field, ['ownerDisplayName', 'ownerPlayerId', 'source'])
  return {
    ownerDisplayName: limitedString(source.ownerDisplayName, `${field}.ownerDisplayName`, 64),
    ownerPlayerId: validatedPlayerId(source.ownerPlayerId, `${field}.ownerPlayerId`),
    source: gameplayPauseSource(source.source),
  }
}

export function gameplayResumeGraceState(
  value: unknown,
  field: string,
): GameplayResumeGraceState {
  const source = record(value, field)
  onlyKeys(source, field, ['reason', 'remainingMs', 'sequence'])
  const reason = memberString(
    source.reason,
    `${field}.reason`,
    GAMEPLAY_RESUME_GRACE_REASONS,
  )
  const remainingMs = source.remainingMs === null
    ? null
    : positiveInteger(source.remainingMs, `${field}.remainingMs`)
  if (remainingMs !== null && remainingMs > GAMEPLAY_RESUME_GRACE_DURATION_MS) {
    throw new GameProtocolError(
      `${field}.remainingMs exceeds the resume grace duration`,
    )
  }
  if (reason === 'skill-picker-closed' && remainingMs !== null) {
    throw new GameProtocolError(
      `${field}.reason skill-picker-closed must remain pending`,
    )
  }
  return {
    reason,
    remainingMs,
    sequence: positiveInteger(source.sequence, `${field}.sequence`),
  }
}

export function gameplayPauseSource(value: unknown): GameplayPauseSource {
  if (
    value === 'inventory'
    || value === 'pause-menu'
    || value === 'skill-book'
    || value === 'skill-selector'
  ) return value
  throw new GameProtocolError('gameplay pause source is not supported')
}

export function playerCharacterKernelParameters(
  value: unknown,
): PlayerCharacterKernelParameters {
  const source = record(value, 'kernelParameters')
  onlyKeys(source, 'kernelParameters', [
    'fixedTickSeconds',
    'movementAcceleration',
    'movementLaneCap',
    'movementRetention',
    'movementThresholdSquared',
    'playerRadius',
  ])
  return {
    fixedTickSeconds: positiveFinite(
      source.fixedTickSeconds,
      'kernelParameters.fixedTickSeconds',
    ),
    movementAcceleration: positiveFinite(
      source.movementAcceleration,
      'kernelParameters.movementAcceleration',
    ),
    movementLaneCap: positiveFinite(
      source.movementLaneCap,
      'kernelParameters.movementLaneCap',
    ),
    movementRetention: positiveFinite(
      source.movementRetention,
      'kernelParameters.movementRetention',
    ),
    movementThresholdSquared: positiveFinite(
      source.movementThresholdSquared,
      'kernelParameters.movementThresholdSquared',
    ),
    playerRadius: positiveFinite(
      source.playerRadius,
      'kernelParameters.playerRadius',
    ),
  }
}
