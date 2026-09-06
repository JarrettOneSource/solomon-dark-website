import {
  BONEYARD_ARENA_ENTRANCE_EXTENSION,
  BONEYARD_ARENA_NORTH_TARGET_INSET,
  BONEYARD_ARENA_SEAL_TICKS,
  BONEYARD_ARENA_TRANSITION_PHASES,
  type BoneyardArenaTransitionState,
} from '../../core-kernels/boneyard-arena-transition.ts'
import type {
  BoneyardBounds,
  BoneyardChoice,
  BoneyardFence,
  BoneyardObject,
  BoneyardRoad,
  BoneyardScene,
  BoneyardSprite,
  BoneyardTerrain,
  LoadedBoneyard,
} from '../../core-kernels/boneyard.ts'
import {
  MAX_BONEYARD_CHOICES,
  MAX_BONEYARD_OBJECTS,
  MAX_BONEYARD_SPRITES,
  MAX_BONEYARD_STRUCTURES,
} from '../game-protocol-limits.ts'
import { boneyardBounds, boneyardPoint } from './native-state.ts'
import {
  GameProtocolError,
  boolean,
  byte,
  finite,
  integer,
  integerWithin,
  limitedArray,
  limitedString,
  nonnegativeInteger,
  onlyKeys,
  optionalFinite,
  optionalInteger,
  optionalNumberField,
  positiveFinite,
  positiveInteger,
  record,
  sha256,
} from './values.ts'

export function boneyardArenaTransition(
  value: unknown,
  field: string,
): BoneyardArenaTransitionState | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'blendFactor',
    'cameraBounds',
    'combatBounds',
    'entrySide',
    'fullBounds',
    'phase',
    'sealTicksRemaining',
  ])
  const blendFactor = finite(source.blendFactor, `${field}.blendFactor`)
  if (blendFactor < 0 || blendFactor > 1) {
    throw new GameProtocolError(`${field}.blendFactor must be within [0,1]`)
  }
  const phase = limitedString(source.phase, `${field}.phase`, 16)
  if (!(BONEYARD_ARENA_TRANSITION_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const entrySide = limitedString(source.entrySide, `${field}.entrySide`, 8)
  if (entrySide !== 'north' && entrySide !== 'south') {
    throw new GameProtocolError(`${field}.entrySide is not supported`)
  }
  const sealTicksRemaining = nonnegativeInteger(
    source.sealTicksRemaining,
    `${field}.sealTicksRemaining`,
  )
  if (sealTicksRemaining > BONEYARD_ARENA_SEAL_TICKS) {
    throw new GameProtocolError(
      `${field}.sealTicksRemaining may not exceed ${BONEYARD_ARENA_SEAL_TICKS}`,
    )
  }
  const cameraBounds = boneyardBounds(source.cameraBounds, `${field}.cameraBounds`)
  const combatBounds = boneyardBounds(source.combatBounds, `${field}.combatBounds`)
  const fullBounds = boneyardBounds(source.fullBounds, `${field}.fullBounds`)
  const expectedCombatY = Math.fround(fullBounds.y + (
    entrySide === 'north' ? BONEYARD_ARENA_NORTH_TARGET_INSET : 0
  ))
  if (
    combatBounds.x !== fullBounds.x
    || combatBounds.y !== expectedCombatY
    || combatBounds.w !== fullBounds.w
    || combatBounds.h !== Math.fround(
      fullBounds.h - BONEYARD_ARENA_ENTRANCE_EXTENSION,
    )
  ) {
    throw new GameProtocolError(`${field}.combatBounds do not match the entry side`)
  }
  if (
    phase === 'open'
      ? sealTicksRemaining !== 0 || blendFactor !== 0
      : phase === 'locking'
        ? sealTicksRemaining === 0 || blendFactor === 0
        : sealTicksRemaining !== 0 || blendFactor === 0
  ) {
    throw new GameProtocolError(`${field} phase fields are inconsistent`)
  }
  if (
    cameraBounds.x < fullBounds.x
    || cameraBounds.y < fullBounds.y
    || cameraBounds.x + cameraBounds.w > fullBounds.x + fullBounds.w
    || cameraBounds.y + cameraBounds.h > fullBounds.y + fullBounds.h
  ) {
    throw new GameProtocolError(`${field}.cameraBounds must remain within fullBounds`)
  }
  return {
    blendFactor,
    cameraBounds,
    combatBounds,
    entrySide,
    fullBounds,
    phase: phase as BoneyardArenaTransitionState['phase'],
    sealTicksRemaining,
  }
}

function boneyardChoice(value: unknown, field: string): BoneyardChoice {
  const source = record(value, field)
  onlyKeys(source, field, ['id', 'name', 'source', 'modId', 'modName'])
  const kind = limitedString(source.source, `${field}.source`, 16)
  if (kind !== 'default' && kind !== 'mod') {
    throw new GameProtocolError(`${field}.source must be default or mod`)
  }
  return {
    id: limitedString(source.id, `${field}.id`, 256),
    name: limitedString(source.name, `${field}.name`, 256),
    source: kind,
    ...(source.modId === undefined
      ? {}
      : { modId: limitedString(source.modId, `${field}.modId`, 128) }),
    ...(source.modName === undefined
      ? {}
      : { modName: limitedString(source.modName, `${field}.modName`, 256) }),
  }
}

export function boneyardChoices(value: unknown): readonly BoneyardChoice[] {
  const choices = limitedArray(value, 'boneyards', MAX_BONEYARD_CHOICES).map((choice, index) => (
    boneyardChoice(choice, `boneyards[${index}]`)
  ))
  if (choices.length === 0) throw new GameProtocolError('boneyards must not be empty')
  return choices
}

function boneyardObject(value: unknown, field: string): BoneyardObject {
  const source = record(value, field)
  onlyKeys(source, field, [
    'eid',
    'typeId',
    'pos',
    'variant',
    'rot',
    'scale',
    'sortBias',
    'atlasEntry',
    'secondaryAtlasEntry',
    'secondaryVariant',
    'secondaryVisible',
    'overlayAtlasEntry',
    'overlayVariant',
    'atlasEntries',
  ])
  return {
    eid: limitedString(source.eid, `${field}.eid`, 128),
    typeId: integer(source.typeId, `${field}.typeId`),
    pos: boneyardPoint(source.pos, `${field}.pos`),
    ...optionalNumberField(source, field, 'variant', optionalInteger),
    ...optionalNumberField(source, field, 'rot', optionalFinite),
    ...optionalNumberField(source, field, 'scale', optionalFinite),
    ...optionalNumberField(source, field, 'sortBias', optionalFinite),
    ...optionalNumberField(source, field, 'atlasEntry', optionalInteger),
    ...optionalNumberField(source, field, 'secondaryAtlasEntry', optionalInteger),
    ...optionalNumberField(source, field, 'secondaryVariant', optionalInteger),
    ...(source.secondaryVisible === undefined
      ? {}
      : { secondaryVisible: boolean(source.secondaryVisible, `${field}.secondaryVisible`) }),
    ...optionalNumberField(source, field, 'overlayAtlasEntry', optionalInteger),
    ...optionalNumberField(source, field, 'overlayVariant', optionalInteger),
    ...(source.atlasEntries === undefined
      ? {}
      : {
          atlasEntries: limitedArray(source.atlasEntries, `${field}.atlasEntries`, 32)
            .map((entry, index) => integer(entry, `${field}.atlasEntries[${index}]`)),
        }),
  }
}

function boneyardSprite(value: unknown, field: string): BoneyardSprite {
  const source = record(value, field)
  onlyKeys(source, field, [
    'eid', 'atlasEntry', 'deadHawgEntry', 'pos', 's0', 's1', 's2', 'flags',
  ])
  return {
    eid: limitedString(source.eid, `${field}.eid`, 128),
    atlasEntry: integer(source.atlasEntry, `${field}.atlasEntry`),
    ...optionalNumberField(source, field, 'deadHawgEntry', optionalInteger),
    pos: boneyardPoint(source.pos, `${field}.pos`),
    s0: finite(source.s0, `${field}.s0`),
    s1: finite(source.s1, `${field}.s1`),
    s2: finite(source.s2, `${field}.s2`),
    flags: integer(source.flags, `${field}.flags`),
  }
}

function boneyardLine(
  value: unknown,
  field: string,
  kind: 'road' | 'fence',
): BoneyardRoad | BoneyardFence {
  const source = record(value, field)
  onlyKeys(source, field, kind === 'fence'
    ? [
        'eid', 'typeId', 'points', 'style', 'segmentCode',
        'startPostVariant', 'endPostVariant',
      ]
    : [
        'eid', 'typeId', 'points', 'style', 'startWidthScale', 'endWidthScale',
        'quad', 'linkMask',
      ])
  const common = {
    eid: limitedString(source.eid, `${field}.eid`, 128),
    typeId: integer(source.typeId, `${field}.typeId`),
    points: limitedArray(source.points, `${field}.points`, 256)
      .map((entry, index) => boneyardPoint(entry, `${field}.points[${index}]`)),
    ...optionalNumberField(source, field, 'style', optionalInteger),
  }
  if (common.points.length < 2) throw new GameProtocolError(`${field}.points needs two points`)
  if (kind === 'fence') {
    return {
      ...common,
      ...optionalNumberField(source, field, 'segmentCode', optionalInteger),
      ...optionalNumberField(source, field, 'startPostVariant', optionalInteger),
      ...optionalNumberField(source, field, 'endPostVariant', optionalInteger),
    }
  }
  return {
    ...common,
    linkMask: integerWithin(source.linkMask, `${field}.linkMask`, 0, 3) as BoneyardRoad['linkMask'],
    ...optionalNumberField(source, field, 'startWidthScale', optionalFinite),
    ...optionalNumberField(source, field, 'endWidthScale', optionalFinite),
    ...(source.quad === undefined
      ? {}
      : {
          quad: limitedArray(source.quad, `${field}.quad`, 4)
            .map((entry, index) => boneyardPoint(entry, `${field}.quad[${index}]`)),
        }),
  }
}

function boneyardTerrain(value: unknown, field: string): BoneyardTerrain {
  const source = record(value, field)
  onlyKeys(source, field, ['eid', 'pos', 'points', 'style', 'entry'])
  return {
    eid: limitedString(source.eid, `${field}.eid`, 128),
    pos: boneyardPoint(source.pos, `${field}.pos`),
    ...(source.points === undefined
      ? {}
      : {
          points: limitedArray(source.points, `${field}.points`, 256)
            .map((entry, index) => boneyardPoint(entry, `${field}.points[${index}]`)),
        }),
    ...optionalNumberField(source, field, 'style', optionalInteger),
    ...optionalNumberField(source, field, 'entry', optionalInteger),
  }
}

function boneyardScene(value: unknown): BoneyardScene {
  const source = record(value, 'boneyard.scene')
  onlyKeys(source, 'boneyard.scene', [
    'name', 'environmentMode', 'bounds', 'spawn', 'objects', 'sprites', 'roads',
    'fences', 'terrain', 'solomonDig',
  ])
  const boundsSource = record(source.bounds, 'boneyard.scene.bounds')
  const spawnSource = record(source.spawn, 'boneyard.scene.spawn')
  onlyKeys(boundsSource, 'boneyard.scene.bounds', ['x', 'y', 'w', 'h'])
  onlyKeys(spawnSource, 'boneyard.scene.spawn', ['x', 'y', 'facingDeg'])
  const bounds: BoneyardBounds = {
    x: finite(boundsSource.x, 'boneyard.scene.bounds.x'),
    y: finite(boundsSource.y, 'boneyard.scene.bounds.y'),
    w: positiveFinite(boundsSource.w, 'boneyard.scene.bounds.w'),
    h: positiveFinite(boundsSource.h, 'boneyard.scene.bounds.h'),
  }
  return {
    name: limitedString(source.name, 'boneyard.scene.name', 256),
    environmentMode: byte(source.environmentMode, 'boneyard.scene.environmentMode'),
    bounds,
    spawn: {
      x: finite(spawnSource.x, 'boneyard.scene.spawn.x'),
      y: finite(spawnSource.y, 'boneyard.scene.spawn.y'),
      facingDeg: finite(spawnSource.facingDeg, 'boneyard.scene.spawn.facingDeg'),
    },
    objects: limitedArray(source.objects, 'boneyard.scene.objects', MAX_BONEYARD_OBJECTS)
      .map((entry, index) => boneyardObject(entry, `boneyard.scene.objects[${index}]`)),
    sprites: limitedArray(source.sprites, 'boneyard.scene.sprites', MAX_BONEYARD_SPRITES)
      .map((entry, index) => boneyardSprite(entry, `boneyard.scene.sprites[${index}]`)),
    roads: limitedArray(source.roads, 'boneyard.scene.roads', MAX_BONEYARD_STRUCTURES)
      .map((entry, index) => boneyardLine(entry, `boneyard.scene.roads[${index}]`, 'road') as BoneyardRoad),
    fences: limitedArray(source.fences, 'boneyard.scene.fences', MAX_BONEYARD_STRUCTURES)
      .map((entry, index) => boneyardLine(entry, `boneyard.scene.fences[${index}]`, 'fence') as BoneyardFence),
    terrain: limitedArray(source.terrain, 'boneyard.scene.terrain', MAX_BONEYARD_STRUCTURES)
      .map((entry, index) => boneyardTerrain(entry, `boneyard.scene.terrain[${index}]`)),
    solomonDig: source.solomonDig === null
      ? null
      : solomonDigState(source.solomonDig),
  }
}

function solomonDigState(value: unknown): NonNullable<BoneyardScene['solomonDig']> {
  const field = 'boneyard.scene.solomonDig'
  const source = record(value, field)
  onlyKeys(source, field, [
    'gravePosition', 'lanternPosition', 'position', 'frameProgram', 'ticksPerFrame',
  ])
  const frameProgram = limitedArray(
    source.frameProgram,
    `${field}.frameProgram`,
    256,
  ).map((frame, index) => {
    const decoded = nonnegativeInteger(frame, `${field}.frameProgram[${index}]`)
    if (decoded > 17) throw new GameProtocolError('Solomon Dig frame exceeds record bank')
    return decoded
  })
  if (frameProgram.length === 0) throw new GameProtocolError('Solomon Dig frame program is empty')
  return {
    gravePosition: boneyardPoint(source.gravePosition, `${field}.gravePosition`),
    lanternPosition: boneyardPoint(source.lanternPosition, `${field}.lanternPosition`),
    position: boneyardPoint(source.position, `${field}.position`),
    frameProgram,
    ticksPerFrame: positiveInteger(source.ticksPerFrame, `${field}.ticksPerFrame`),
  }
}

export function loadedBoneyard(value: unknown): LoadedBoneyard {
  const source = record(value, 'boneyard')
  onlyKeys(source, 'boneyard', [
    'choice', 'runId', 'seed', 'sourceSha256', 'geometrySha256', 'scene',
  ])
  return {
    choice: boneyardChoice(source.choice, 'boneyard.choice'),
    runId: limitedString(source.runId, 'boneyard.runId', 128),
    seed: limitedString(source.seed, 'boneyard.seed', 128),
    sourceSha256: sha256(source.sourceSha256, 'boneyard.sourceSha256'),
    geometrySha256: sha256(source.geometrySha256, 'boneyard.geometrySha256'),
    scene: boneyardScene(source.scene),
  }
}
