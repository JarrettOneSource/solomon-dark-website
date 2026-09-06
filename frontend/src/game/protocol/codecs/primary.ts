import {
  NATIVE_HAIL_LIFETIME_TICKS,
  NATIVE_HAIL_MAXIMUM_BOUNCE_PITCH,
  NATIVE_HAIL_MAXIMUM_SCALE,
  NATIVE_HAIL_MINIMUM_BOUNCE_PITCH,
  NATIVE_HAIL_MINIMUM_HEIGHT,
  NATIVE_HAIL_MINIMUM_SCALE,
} from '../../core-kernels/air-water-spell-actors.ts'
import type { PrimarySpellSimulationState } from '../../core-kernels/primary-spells.ts'
import {
  MAX_PLAYERS,
  MAX_PRIMARY_SPELL_HAIL_BASE64_LENGTH,
  MAX_PRIMARY_SPELL_PROJECTILES,
  MAX_PRIMARY_SPELL_TRANSIENTS,
} from '../game-protocol-limits.ts'
import type {
  PrimarySpellNonHailTransientState,
  PrimarySpellSimulationFrameState,
  ProtocolPlayerSnapshotFrame,
} from '../game-state.ts'
import {
  PrimarySpellWaterHailFrameError,
  PrimarySpellWaterHailFrameRows,
} from '../primary-spell-hail-frame.ts'
import { primarySpellProjectile } from './primary-projectiles.ts'
import { primarySpellTransient } from './primary-transients.ts'
import {
  GameProtocolError,
  finite,
  finiteWithin,
  integerWithin,
  limitedArray,
  limitedString,
  nonnegativeInteger,
  onlyKeys,
  positiveInteger,
  record,
  validatedPlayerId,
} from './values.ts'

export function primarySpellState(value: unknown, field: string): PrimarySpellSimulationState {
  const source = record(value, field)
  onlyKeys(source, field, ['nextId', 'projectiles', 'transients'])
  const nextId = positiveInteger(source.nextId, `${field}.nextId`)
  const projectiles = limitedArray(
    source.projectiles,
    `${field}.projectiles`,
    MAX_PRIMARY_SPELL_PROJECTILES,
  ).map((spell, index) => primarySpellProjectile(
    spell,
    `${field}.projectiles[${index}]`,
  ))
  const transients = limitedArray(
    source.transients,
    `${field}.transients`,
    MAX_PRIMARY_SPELL_TRANSIENTS,
  ).map((effect, index) => primarySpellTransient(
    effect,
    `${field}.transients[${index}]`,
  ))
  const ids = new Set<number>()
  for (const spell of [...projectiles, ...transients]) {
    if (ids.has(spell.id)) throw new GameProtocolError(`${field} contains duplicate id ${spell.id}`)
    if (spell.id >= nextId) throw new GameProtocolError(`${field} id ${spell.id} is not allocated`)
    ids.add(spell.id)
  }
  return { nextId, projectiles, transients }
}

export function primarySpellFrameState(
  value: unknown,
  field: string,
  tick: number,
): PrimarySpellSimulationFrameState {
  const source = record(value, field)
  onlyKeys(source, field, ['hail', 'nextId', 'projectiles', 'transients'])
  const nextId = positiveInteger(source.nextId, `${field}.nextId`)
  const projectiles = limitedArray(
    source.projectiles,
    `${field}.projectiles`,
    MAX_PRIMARY_SPELL_PROJECTILES,
  ).map((spell, index) => primarySpellProjectile(
    spell,
    `${field}.projectiles[${index}]`,
  ))
  const transients = limitedArray(
    source.transients,
    `${field}.transients`,
    MAX_PRIMARY_SPELL_TRANSIENTS,
  ).map((effect, index) => {
    const decoded = primarySpellTransient(
      effect,
      `${field}.transients[${index}]`,
    )
    if (decoded.kind === 'water-hail') {
      throw new GameProtocolError(`${field}.transients must use the compact Hail table`)
    }
    return decoded
  }) satisfies PrimarySpellNonHailTransientState[]
  const hailSource = record(source.hail, `${field}.hail`)
  onlyKeys(hailSource, `${field}.hail`, ['ownerIds', 'rows', 'worldKeys'])
  const ownerIds = uniqueStrings(
    limitedArray(hailSource.ownerIds, `${field}.hail.ownerIds`, MAX_PLAYERS)
      .map((ownerId, index) => validatedPlayerId(
        ownerId,
        `${field}.hail.ownerIds[${index}]`,
      )),
    `${field}.hail.ownerIds`,
  )
  const worldKeys = uniqueStrings(
    limitedArray(hailSource.worldKeys, `${field}.hail.worldKeys`, MAX_PLAYERS)
      .map((worldKey, index) => limitedString(
        worldKey,
        `${field}.hail.worldKeys[${index}]`,
        256,
    )),
    `${field}.hail.worldKeys`,
  )
  const rowsSource = record(hailSource.rows, `${field}.hail.rows`)
  onlyKeys(rowsSource, `${field}.hail.rows`, ['data'])
  const encodedRows = limitedString(
    rowsSource.data,
    `${field}.hail.rows.data`,
    MAX_PRIMARY_SPELL_HAIL_BASE64_LENGTH,
  )
  let rows: PrimarySpellWaterHailFrameRows
  try {
    rows = PrimarySpellWaterHailFrameRows.fromBase64(
      encodedRows,
      MAX_PRIMARY_SPELL_TRANSIENTS,
    )
  } catch (error) {
    if (error instanceof PrimarySpellWaterHailFrameError) {
      throw new GameProtocolError(`${field}.hail.rows ${error.message}`)
    }
    throw error
  }
  if (rows.length + transients.length > MAX_PRIMARY_SPELL_TRANSIENTS) {
    throw new GameProtocolError(
      `${field} may contain at most ${MAX_PRIMARY_SPELL_TRANSIENTS} transients`,
    )
  }
  const transientCount = rows.length + transients.length
  let previousPosition = -1
  for (let index = 0; index < rows.length; index += 1) {
    const position = rows.transientPositions[index]!
    if (position <= previousPosition || position >= transientCount) {
      throw new GameProtocolError(
        `${field}.hail.rows transient positions must be unique, ascending, and within the sequence`,
      )
    }
    previousPosition = position
  }
  const ids = new Set<number>()
  const registerId = (id: number) => {
    if (ids.has(id)) throw new GameProtocolError(`${field} contains duplicate id ${id}`)
    if (id >= nextId) throw new GameProtocolError(`${field} id ${id} is not allocated`)
    ids.add(id)
  }
  for (const projectile of projectiles) registerId(projectile.id)
  for (const transient of transients) registerId(transient.id)
  for (let index = 0; index < rows.length; index += 1) {
    validatePrimarySpellHailFrameRow(
      rows,
      index,
      `${field}.hail.rows[${index}]`,
      tick,
      ownerIds.length,
      worldKeys.length,
    )
    registerId(rows.ids[index]!)
  }
  return {
    hail: { ownerIds, rows, worldKeys },
    nextId,
    projectiles,
    transients,
  }
}

function validatePrimarySpellHailFrameRow(
  rows: PrimarySpellWaterHailFrameRows,
  index: number,
  field: string,
  tick: number,
  ownerCount: number,
  worldKeyCount: number,
): void {
  positiveInteger(rows.ids[index], `${field}.id`)
  const birthTick = nonnegativeInteger(rows.birthTicks[index], `${field}.birthTick`)
  const ageTicks = tick - birthTick
  if (ageTicks < 0 || ageTicks >= NATIVE_HAIL_LIFETIME_TICKS) {
    throw new GameProtocolError(`${field}.birthTick is outside the native Hail lifecycle`)
  }
  const bounceProgress = finite(rows.bounceProgresses[index], `${field}.bounceProgress`)
  if (bounceProgress < 0 || bounceProgress > 1) {
    throw new GameProtocolError(`${field}.bounceProgress must be within [0,1]`)
  }
  const encodedBounceSoundIndex = rows.bounceSoundIndexes[index]!
  const bounceSoundIndex = encodedBounceSoundIndex === 0xff
    ? null
    : integerWithin(encodedBounceSoundIndex, `${field}.bounceSoundIndex`, 0, 3)
  const encodedBounceSoundPitch = rows.bounceSoundPitches[index]!
  const bounceSoundPitch = Number.isNaN(encodedBounceSoundPitch)
    ? null
    : finiteWithin(
      encodedBounceSoundPitch,
      `${field}.bounceSoundPitch`,
      NATIVE_HAIL_MINIMUM_BOUNCE_PITCH,
      NATIVE_HAIL_MAXIMUM_BOUNCE_PITCH,
    )
  const bounceSoundSequence = nonnegativeInteger(
    rows.bounceSoundSequences[index],
    `${field}.bounceSoundSequence`,
  )
  const painterRegistrationOrdinal = nonnegativeInteger(
    rows.painterRegistrationOrdinals[index],
    `${field}.painterRegistrationOrdinal`,
  )
  if (!Number.isSafeInteger(painterRegistrationOrdinal)) {
    throw new GameProtocolError(`${field}.painterRegistrationOrdinal must be a safe integer`)
  }
  if ((bounceSoundSequence === 0) !== (bounceSoundIndex === null)) {
    throw new GameProtocolError(`${field} has an inconsistent bounce sound payload`)
  }
  if ((bounceSoundIndex === null) !== (bounceSoundPitch === null)) {
    throw new GameProtocolError(`${field} must carry both bounce sound fields or neither`)
  }
  const height = finite(rows.heights[index], `${field}.height`)
  if (height < NATIVE_HAIL_MINIMUM_HEIGHT || height > 0) {
    throw new GameProtocolError(`${field}.height is outside the native Bouncer range`)
  }
  finite(rows.horizontalVelocityXs[index], `${field}.horizontalVelocityX`)
  finite(rows.horizontalVelocityYs[index], `${field}.horizontalVelocityY`)
  finite(rows.positionXs[index], `${field}.positionX`)
  finite(rows.positionYs[index], `${field}.positionY`)
  finite(rows.rotationDegrees[index], `${field}.rotationDegrees`)
  const rotationStepDegrees = finite(
    rows.rotationStepDegrees[index],
    `${field}.rotationStepDegrees`,
  )
  if (rotationStepDegrees < 0 || rotationStepDegrees > 11) {
    throw new GameProtocolError(`${field}.rotationStepDegrees is outside [0,11]`)
  }
  const savedBounceVelocity = finite(
    rows.savedBounceVelocities[index],
    `${field}.savedBounceVelocity`,
  )
  if (savedBounceVelocity < -5 || savedBounceVelocity > 0) {
    throw new GameProtocolError(`${field}.savedBounceVelocity is outside [-5,0]`)
  }
  finiteWithin(
    rows.scales[index], `${field}.scale`, NATIVE_HAIL_MINIMUM_SCALE, NATIVE_HAIL_MAXIMUM_SCALE,
  )
  const verticalVelocity = finite(rows.verticalVelocities[index], `${field}.verticalVelocity`)
  if (verticalVelocity < -5 || verticalVelocity > 20) {
    throw new GameProtocolError(`${field}.verticalVelocity is outside the Bouncer range`)
  }
  integerWithin(rows.ownerIndexes[index], `${field}.ownerIndex`, 0, ownerCount - 1)
  integerWithin(rows.worldKeyIndexes[index], `${field}.worldKeyIndex`, 0, worldKeyCount - 1)
}

function uniqueStrings(values: readonly string[], field: string): readonly string[] {
  if (new Set(values).size !== values.length) {
    throw new GameProtocolError(`${field} must be unique`)
  }
  return values
}

export function validatePrimarySpellOwners(
  spells: PrimarySpellSimulationState,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  field: string,
): void {
  for (const spell of [...spells.projectiles, ...spells.transients]) {
    if (!players[spell.ownerId]) {
      throw new GameProtocolError(`${field} owner ${spell.ownerId} is not present`)
    }
  }
}

export function validatePrimarySpellFrameOwners(
  spells: PrimarySpellSimulationFrameState,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  field: string,
): void {
  for (const spell of [...spells.projectiles, ...spells.transients]) {
    if (!players[spell.ownerId]) {
      throw new GameProtocolError(`${field} owner ${spell.ownerId} is not present`)
    }
  }
  for (const ownerId of spells.hail.ownerIds) {
    if (!players[ownerId]) {
      throw new GameProtocolError(`${field} owner ${ownerId} is not present`)
    }
  }
}
