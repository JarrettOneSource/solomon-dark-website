import {
  nativeWaterHailLifeAtAge,
} from '../core-kernels/air-water-spell-actors.ts'
import type {
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
  PrimarySpellWaterHailState,
} from '../core-kernels/primary-spells.ts'
import type {
  GameClientSnapshot,
  GameSnapshot,
  PrimarySpellNonHailTransientState,
  PrimarySpellSimulationFrameState,
} from './game-state.ts'
import {
  EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS,
  PrimarySpellWaterHailFrameRows,
} from './primary-spell-hail-frame.ts'

export function createGameClientSnapshot(snapshot: GameSnapshot): GameClientSnapshot {
  return {
    ...snapshot,
    primarySpells: createPrimarySpellSimulationFrame(snapshot.primarySpells),
  }
}

export function createPrimarySpellSimulationFrame(
  spells: PrimarySpellSimulationState,
): PrimarySpellSimulationFrameState {
  let hailCount = 0
  for (const actor of spells.transients) {
    if (actor.kind === 'water-hail') hailCount += 1
  }
  const ownerIds: string[] = []
  const ownerIndexes = new Map<string, number>()
  const rows = hailCount === 0
    ? EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS
    : PrimarySpellWaterHailFrameRows.create(hailCount)
  const transients: PrimarySpellNonHailTransientState[] = []
  const worldKeys: string[] = []
  const worldKeyIndexes = new Map<string, number>()
  let hailIndex = 0
  for (let position = 0; position < spells.transients.length; position += 1) {
    const actor = spells.transients[position]!
    if (actor.kind !== 'water-hail') {
      transients.push(actor)
      continue
    }
    writeHailFrameRow(
      rows,
      hailIndex,
      actor,
      position,
      intern(actor.ownerId, ownerIds, ownerIndexes),
      intern(actor.worldKey, worldKeys, worldKeyIndexes),
    )
    hailIndex += 1
  }
  return {
    hail: { ownerIds, rows, worldKeys },
    nextId: spells.nextId,
    projectiles: spells.projectiles,
    transients,
  }
}

export function materializePrimarySpellSimulationFrame(
  frame: PrimarySpellSimulationFrameState,
  tick: number,
): PrimarySpellSimulationState {
  const rows = frame.hail.rows
  const hail = new Array<PrimarySpellWaterHailState>(rows.length)
  for (let index = 0; index < rows.length; index += 1) {
    hail[index] = hailActor(frame, index, tick)
  }
  const transients: PrimarySpellTransientState[] = new Array(
    hail.length + frame.transients.length,
  )
  let hailIndex = 0
  let transientIndex = 0
  for (let position = 0; position < transients.length; position += 1) {
    if (rows.transientPositions[hailIndex] === position) {
      transients[position] = hail[hailIndex]!
      hailIndex += 1
    } else {
      transients[position] = frame.transients[transientIndex]!
      transientIndex += 1
    }
  }
  if (hailIndex !== hail.length || transientIndex !== frame.transients.length) {
    throw new Error('Hail frame positions do not partition the transient sequence')
  }
  return {
    nextId: frame.nextId,
    projectiles: frame.projectiles,
    transients,
  }
}

function writeHailFrameRow(
  rows: PrimarySpellWaterHailFrameRows,
  index: number,
  actor: PrimarySpellWaterHailState,
  transientPosition: number,
  ownerIndex: number,
  worldKeyIndex: number,
): void {
  const painterRegistrations = actor.painterRegistrations
  const painterRegistration = painterRegistrations?.[0]
  if (
    painterRegistrations?.length !== 1
    || painterRegistration?.managerLane !== 'actor'
  ) {
    throw new RangeError('Hail painterRegistrations must contain one actor-manager root')
  }
  rows.ids[index] = positiveSafeInteger(actor.id, 'id')
  rows.birthTicks[index] = safeInteger(actor.birthTick, 'birthTick')
  rows.bounceSoundSequences[index] = safeInteger(
    actor.bounceSoundSequence,
    'bounceSoundSequence',
  )
  rows.painterRegistrationOrdinals[index] = safeInteger(
    painterRegistration.registrationOrdinal,
    'painterRegistrationOrdinal',
  )
  rows.bounceProgresses[index] = nativeFloat(actor.bounceProgress, 'bounceProgress')
  rows.bounceSoundIndexes[index] = actor.bounceSoundIndex === null
    ? 0xff
    : integerWithin(actor.bounceSoundIndex, 'bounceSoundIndex', 0, 3)
  rows.bounceSoundPitches[index] = actor.bounceSoundPitch === null
    ? Number.NaN
    : nativeFloat(actor.bounceSoundPitch, 'bounceSoundPitch')
  rows.heights[index] = nativeFloat(actor.height, 'height')
  rows.horizontalVelocityXs[index] = nativeFloat(
    actor.horizontalVelocity.x,
    'horizontalVelocity.x',
  )
  rows.horizontalVelocityYs[index] = nativeFloat(
    actor.horizontalVelocity.y,
    'horizontalVelocity.y',
  )
  rows.positionXs[index] = nativeFloat(actor.position.x, 'position.x')
  rows.positionYs[index] = nativeFloat(actor.position.y, 'position.y')
  rows.rotationDegrees[index] = nativeFloat(actor.rotationDegrees, 'rotationDegrees')
  rows.rotationStepDegrees[index] = nativeFloat(
    actor.rotationStepDegrees,
    'rotationStepDegrees',
  )
  rows.savedBounceVelocities[index] = nativeFloat(
    actor.savedBounceVelocity,
    'savedBounceVelocity',
  )
  rows.scales[index] = nativeFloat(actor.scale, 'scale')
  rows.verticalVelocities[index] = nativeFloat(
    actor.verticalVelocity,
    'verticalVelocity',
  )
  rows.transientPositions[index] = uint16(transientPosition, 'transientPosition')
  rows.ownerIndexes[index] = uint8(ownerIndex, 'ownerIndex')
  rows.worldKeyIndexes[index] = uint8(worldKeyIndex, 'worldKeyIndex')
}

function hailActor(
  frame: PrimarySpellSimulationFrameState,
  index: number,
  tick: number,
): PrimarySpellWaterHailState {
  const rows = frame.hail.rows
  const ageTicks = tick - rows.birthTicks[index]!
  const ownerId = frame.hail.ownerIds[rows.ownerIndexes[index]!]
  const worldKey = frame.hail.worldKeys[rows.worldKeyIndexes[index]!]
  if (ownerId === undefined || worldKey === undefined) {
    throw new Error('Hail frame row references an unavailable dictionary entry')
  }
  const bounceSoundIndex = rows.bounceSoundIndexes[index]!
  const bounceSoundPitch = rows.bounceSoundPitches[index]!
  return {
    ageTicks,
    birthTick: rows.birthTicks[index]!,
    bounceProgress: rows.bounceProgresses[index]!,
    bounceSoundIndex: bounceSoundIndex === 0xff ? null : bounceSoundIndex,
    bounceSoundPitch: Number.isNaN(bounceSoundPitch) ? null : bounceSoundPitch,
    bounceSoundSequence: rows.bounceSoundSequences[index]!,
    height: rows.heights[index]!,
    horizontalVelocity: {
      x: rows.horizontalVelocityXs[index]!,
      y: rows.horizontalVelocityYs[index]!,
    },
    id: rows.ids[index]!,
    kind: 'water-hail',
    life: nativeWaterHailLifeAtAge(ageTicks),
    ownerId,
    painterRegistrations: Object.freeze([Object.freeze({
      managerLane: 'actor' as const,
      registrationOrdinal: rows.painterRegistrationOrdinals[index]!,
    })]),
    position: { x: rows.positionXs[index]!, y: rows.positionYs[index]! },
    rotationDegrees: rows.rotationDegrees[index]!,
    rotationStepDegrees: rows.rotationStepDegrees[index]!,
    savedBounceVelocity: rows.savedBounceVelocities[index]!,
    scale: rows.scales[index]!,
    verticalVelocity: rows.verticalVelocities[index]!,
    worldKey,
  }
}

function nativeFloat(value: number, field: string): number {
  const rounded = Math.fround(value)
  if (!Number.isFinite(value) || !Object.is(value, rounded)) {
    throw new RangeError(`Hail ${field} must already be a native float32`)
  }
  return rounded
}

function safeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Hail ${field} must be a nonnegative safe integer`)
  }
  return value
}

function positiveSafeInteger(value: number, field: string): number {
  const integer = safeInteger(value, field)
  if (integer === 0) throw new RangeError(`Hail ${field} must be positive`)
  return integer
}

function integerWithin(
  value: number,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`Hail ${field} must be within [${minimum},${maximum}]`)
  }
  return value
}

function uint16(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`Hail ${field} must fit uint16`)
  }
  return value
}

function uint8(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`Hail ${field} must fit uint8`)
  }
  return value
}

function intern(
  value: string,
  values: string[],
  indexes: Map<string, number>,
): number {
  const existing = indexes.get(value)
  if (existing !== undefined) return existing
  const index = values.length
  values.push(value)
  indexes.set(value, index)
  return index
}
