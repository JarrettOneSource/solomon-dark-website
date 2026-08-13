import {
  isWizardDiscipline,
  isWizardElement,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type {
  BoneyardBounds,
  BoneyardChoice,
  BoneyardFence,
  BoneyardGateLeafSnapshot,
  BoneyardObject,
  BoneyardPoint,
  BoneyardRoad,
  BoneyardScene,
  BoneyardSprite,
  BoneyardTerrain,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'
import type {
  GameSnapshot,
  HubWorldSnapshot,
  ProtocolAmbientState,
  ProtocolPlayerState,
  ProtocolStudentState,
} from './game-state.ts'

export type { GameSnapshot } from './game-state.ts'
export type {
  BoneyardChoice,
  BoneyardScene,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'

export const GAME_PROTOCOL_VERSION = 6
export const GAME_PROTOCOL_NAME = `solomon-dark/${GAME_PROTOCOL_VERSION}`
export const PLAYER_CHARACTER_KERNEL_VERSION = 'player-character-kernel-2'
export const EMPTY_CONTENT_MANIFEST_SHA256 = '0'.repeat(64)

const MAX_CONTENT_MODS = 256
const MAX_BONEYARD_CHOICES = 256
const MAX_BONEYARD_OBJECTS = 8192
const MAX_BONEYARD_SPRITES = 16384
const MAX_BONEYARD_STRUCTURES = 8192
const MAX_FOUNTAIN_PARTICLES = 512
const MAX_PLAYERS = 64
const MAX_STUDENT_PROPS = 8
const MAX_STUDENTS = 256

export interface GameContentIdentity {
  id: string
  version: string
  contentSha256: string
}

export interface GameContentManifest {
  manifestSha256: string
  mods: readonly GameContentIdentity[]
}

export interface PlayerCharacterKernelParameters {
  fixedTickSeconds: number
  movementAcceleration: number
  movementLaneCap: number
  movementRetention: number
  movementThresholdSquared: number
  playerRadius: number
}

export interface ClientHelloMessage {
  type: 'client-hello'
  protocolVersion: number
  credential: string
  character: PlayerCharacterConfig
  resumeToken?: string
}

export interface ClientInputMessage {
  type: 'client-input'
  input: PlayerCharacterInput
  sequence: number
  targetTick: number
}

export interface ClientDisconnectMessage {
  type: 'client-disconnect'
}

export interface ClientStartMatchMessage {
  type: 'client-start-match'
  boneyardId: string
}

export type ClientGameMessage =
  | ClientHelloMessage
  | ClientInputMessage
  | ClientStartMatchMessage
  | ClientDisconnectMessage

export interface ServerWelcomeMessage {
  type: 'server-welcome'
  protocolVersion: number
  playerId: string
  resumeToken: string
  serverTickRate: number
  snapshotRate: number
  kernelVersion: string
  kernelParameters: PlayerCharacterKernelParameters
  content: GameContentManifest
  boneyards: readonly BoneyardChoice[]
  snapshot: GameSnapshot
}

export interface ServerSnapshotMessage {
  type: 'server-snapshot'
  acknowledgedInputSequence: number
  snapshot: GameSnapshot
}

export interface ServerBoneyardLoadedMessage {
  type: 'server-boneyard-loaded'
  boneyard: LoadedBoneyard
}

export type GameDisconnectCode =
  | 'authentication-failed'
  | 'invalid-message'
  | 'protocol-mismatch'
  | 'server-full'

export interface ServerDisconnectMessage {
  type: 'server-disconnect'
  code: GameDisconnectCode
  reason: string
}

export type ServerGameMessage =
  | ServerWelcomeMessage
  | ServerSnapshotMessage
  | ServerBoneyardLoadedMessage
  | ServerDisconnectMessage

export function encodeGameMessage(message: ClientGameMessage | ServerGameMessage): string {
  return JSON.stringify(message)
}

export function decodeClientGameMessage(payload: string): ClientGameMessage {
  const value = parseObject(payload)
  if (value.type === 'client-hello') {
    onlyKeys(value, 'message', [
      'type',
      'protocolVersion',
      'credential',
      'character',
      'resumeToken',
    ])
    return {
      type: 'client-hello',
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
      credential: limitedString(value.credential, 'credential', 512),
      character: playerCharacterConfig(value.character, 'character'),
      ...(value.resumeToken === undefined
        ? {}
        : { resumeToken: limitedString(value.resumeToken, 'resumeToken', 512) }),
    }
  }
  if (value.type === 'client-input') {
    onlyKeys(value, 'message', ['type', 'input', 'sequence', 'targetTick'])
    return {
      type: 'client-input',
      input: playerCharacterInput(value.input, 'input'),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
      targetTick: nonnegativeInteger(value.targetTick, 'targetTick'),
    }
  }
  if (value.type === 'client-start-match') {
    onlyKeys(value, 'message', ['type', 'boneyardId'])
    return {
      type: 'client-start-match',
      boneyardId: limitedString(value.boneyardId, 'boneyardId', 256),
    }
  }
  if (value.type === 'client-disconnect') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-disconnect' }
  }
  throw new GameProtocolError('unknown client message type')
}

export function decodeServerGameMessage(payload: string): ServerGameMessage {
  const value = parseObject(payload)
  if (value.type === 'server-welcome') {
    onlyKeys(value, 'message', [
      'type',
      'protocolVersion',
      'playerId',
      'resumeToken',
      'serverTickRate',
      'snapshotRate',
      'kernelVersion',
      'kernelParameters',
      'content',
      'boneyards',
      'snapshot',
    ])
    return {
      type: 'server-welcome',
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
      playerId: validatedPlayerId(value.playerId, 'playerId'),
      resumeToken: limitedString(value.resumeToken, 'resumeToken', 512),
      serverTickRate: positiveFinite(value.serverTickRate, 'serverTickRate'),
      snapshotRate: positiveFinite(value.snapshotRate, 'snapshotRate'),
      kernelVersion: limitedString(value.kernelVersion, 'kernelVersion', 128),
      kernelParameters: playerCharacterKernelParameters(value.kernelParameters),
      content: contentManifest(value.content),
      boneyards: boneyardChoices(value.boneyards),
      snapshot: gameSnapshot(value.snapshot),
    }
  }
  if (value.type === 'server-snapshot') {
    onlyKeys(value, 'message', [
      'type',
      'acknowledgedInputSequence',
      'snapshot',
    ])
    return {
      type: 'server-snapshot',
      acknowledgedInputSequence: nonnegativeInteger(
        value.acknowledgedInputSequence,
        'acknowledgedInputSequence',
      ),
      snapshot: gameSnapshot(value.snapshot),
    }
  }
  if (value.type === 'server-boneyard-loaded') {
    onlyKeys(value, 'message', ['type', 'boneyard'])
    return {
      type: 'server-boneyard-loaded',
      boneyard: loadedBoneyard(value.boneyard),
    }
  }
  if (value.type === 'server-disconnect') {
    onlyKeys(value, 'message', ['type', 'code', 'reason'])
    const code = limitedString(value.code, 'code', 64)
    if (![
      'authentication-failed',
      'invalid-message',
      'protocol-mismatch',
      'server-full',
    ].includes(code)) throw new GameProtocolError('invalid disconnect code')
    return {
      type: 'server-disconnect',
      code: code as GameDisconnectCode,
      reason: limitedString(value.reason, 'reason', 512),
    }
  }
  throw new GameProtocolError('unknown server message type')
}

export class GameProtocolError extends Error {
  override name = 'GameProtocolError'
}

function parseObject(payload: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(payload)
  } catch {
    throw new GameProtocolError('message is not valid JSON')
  }
  return record(value, 'message')
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GameProtocolError(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function onlyKeys(
  value: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key))
  if (unexpected) throw new GameProtocolError(`${field}.${unexpected} is not allowed`)
}

function array(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new GameProtocolError(`${field} must be an array`)
  return value
}

function limitedArray(value: unknown, field: string, maximum: number): readonly unknown[] {
  const result = array(value, field)
  if (result.length > maximum) {
    throw new GameProtocolError(`${field} may contain at most ${maximum} entries`)
  }
  return result
}

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GameProtocolError(`${field} must be finite`)
  }
  return value
}

function positiveFinite(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result <= 0) throw new GameProtocolError(`${field} must be positive`)
  return result
}

function integer(value: unknown, field: string): number {
  const result = finite(value, field)
  if (!Number.isInteger(result)) throw new GameProtocolError(`${field} must be an integer`)
  return result
}

function nonnegativeInteger(value: unknown, field: string): number {
  const result = integer(value, field)
  if (result < 0) throw new GameProtocolError(`${field} must be nonnegative`)
  return result
}

function positiveInteger(value: unknown, field: string): number {
  const result = integer(value, field)
  if (result < 1) throw new GameProtocolError(`${field} must be positive`)
  return result
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new GameProtocolError(`${field} must be boolean`)
  return value
}

function limitedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new GameProtocolError(
      `${field} must be a nonempty string of at most ${maximum} characters`,
    )
  }
  return value
}

function validatedPlayerId(value: unknown, field: string): string {
  const result = limitedString(value, field, 128)
  if (Object.hasOwn(Object.prototype, result)) {
    throw new GameProtocolError(`${field} is reserved`)
  }
  return result
}

function sha256(value: unknown, field: string): string {
  const result = limitedString(value, field, 64).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(result)) {
    throw new GameProtocolError(`${field} must be SHA-256 hex`)
  }
  return result
}

function playerCharacterInput(value: unknown, field: string): PlayerCharacterInput {
  const source = record(value, field)
  onlyKeys(source, field, ['movement'])
  return { movement: unitVector(source.movement, `${field}.movement`) }
}

function unitVector(value: unknown, field: string): Vector2 {
  const result = vector(value, field)
  if (Math.hypot(result.x, result.y) > 1.001) {
    throw new GameProtocolError(`${field} magnitude exceeds one`)
  }
  return result
}

function vector(value: unknown, field: string): Vector2 {
  const source = record(value, field)
  onlyKeys(source, field, ['x', 'y'])
  return {
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
}

function playerCharacterConfig(value: unknown, field: string): PlayerCharacterConfig {
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

function playerState(value: unknown, field: string): ProtocolPlayerState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'config',
    'footstepTick',
    'gaitDegrees',
    'headingIndex',
    'position',
    'velocity',
    'walkCyclePrimary',
  ])
  return {
    config: playerCharacterConfig(source.config, `${field}.config`),
    footstepTick: nonnegativeInteger(source.footstepTick, `${field}.footstepTick`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    position: vector(source.position, `${field}.position`),
    velocity: vector(source.velocity, `${field}.velocity`),
    walkCyclePrimary: finite(source.walkCyclePrimary, `${field}.walkCyclePrimary`),
  }
}

function optionalFinite(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : finite(value, field)
}

function optionalInteger(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : integer(value, field)
}

function boneyardPoint(value: unknown, field: string): BoneyardPoint {
  return vector(value, field)
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

function boneyardChoices(value: unknown): readonly BoneyardChoice[] {
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
    ? ['eid', 'typeId', 'points', 'style', 'segmentCode']
    : ['eid', 'typeId', 'points', 'style', 'startWidthScale', 'endWidthScale', 'quad'])
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
    }
  }
  return {
    ...common,
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

function optionalNumberField(
  source: Record<string, unknown>,
  field: string,
  key: string,
  decode: (value: unknown, field: string) => number | undefined,
): Record<string, number> {
  const value = decode(source[key], `${field}.${key}`)
  return value === undefined ? {} : { [key]: value }
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

function byte(value: unknown, field: string): number {
  const result = nonnegativeInteger(value, field)
  if (result > 255) throw new GameProtocolError(`${field} must be a byte`)
  return result
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

function loadedBoneyard(value: unknown): LoadedBoneyard {
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

function studentState(value: unknown, field: string): ProtocolStudentState {
  const source = record(value, field)
  const profile = record(source.profile, `${field}.profile`)
  const props = limitedArray(
    source.props,
    `${field}.props`,
    MAX_STUDENT_PROPS,
  ).map((entry, index) => {
    const prop = record(entry, `${field}.props[${index}]`)
    return {
      angle: finite(prop.angle, `${field}.props[${index}].angle`),
      paletteIndex: nonnegativeInteger(
        prop.paletteIndex,
        `${field}.props[${index}].paletteIndex`,
      ),
      radius: finite(prop.radius, `${field}.props[${index}].radius`),
    }
  })
  const pathStep = integer(source.pathStep, `${field}.pathStep`)
  if (pathStep !== -1 && pathStep !== 1) {
    throw new GameProtocolError(`${field}.pathStep must be -1 or 1`)
  }
  return {
    currentSpeed: finite(source.currentSpeed, `${field}.currentSpeed`),
    desiredSpeed: finite(source.desiredSpeed, `${field}.desiredSpeed`),
    framePhase: finite(source.framePhase, `${field}.framePhase`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    heading: finite(source.heading, `${field}.heading`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    id: nonnegativeInteger(source.id, `${field}.id`),
    pathCursor: finite(source.pathCursor, `${field}.pathCursor`),
    pathId: nonnegativeInteger(source.pathId, `${field}.pathId`),
    pathStep,
    position: vector(source.position, `${field}.position`),
    profile: {
      pushResistance: finite(profile.pushResistance, `${field}.profile.pushResistance`),
      pushStrength: finite(profile.pushStrength, `${field}.profile.pushStrength`),
      radius: positiveFinite(profile.radius, `${field}.profile.radius`),
    },
    props,
    reading: boolean(source.reading, `${field}.reading`),
    retired: boolean(source.retired, `${field}.retired`),
    rngState: nonnegativeInteger(source.rngState, `${field}.rngState`),
    scale: positiveFinite(source.scale, `${field}.scale`),
    staticCollisionEnabled: boolean(
      source.staticCollisionEnabled,
      `${field}.staticCollisionEnabled`,
    ),
    tick: nonnegativeInteger(source.tick, `${field}.tick`),
    wander: vector(source.wander, `${field}.wander`),
  }
}

function ambientState(value: unknown, field: string): ProtocolAmbientState {
  const source = record(value, field)
  return {
    fountainParticles: limitedArray(
      source.fountainParticles,
      `${field}.fountainParticles`,
      MAX_FOUNTAIN_PARTICLES,
    ).map((entry, index) => {
      const particle = record(entry, `${field}.fountainParticles[${index}]`)
      return {
        id: nonnegativeInteger(particle.id, `${field}.fountainParticles[${index}].id`),
        remaining: finite(
          particle.remaining,
          `${field}.fountainParticles[${index}].remaining`,
        ),
        scale: positiveFinite(
          particle.scale,
          `${field}.fountainParticles[${index}].scale`,
        ),
      }
    }),
    markerPhaseDegrees: finite(source.markerPhaseDegrees, `${field}.markerPhaseDegrees`),
    nextFountainParticleId: nonnegativeInteger(
      source.nextFountainParticleId,
      `${field}.nextFountainParticleId`,
    ),
    rngState: nonnegativeInteger(source.rngState, `${field}.rngState`),
    sealCorePhase: finite(source.sealCorePhase, `${field}.sealCorePhase`),
    sealGlyphPhase: finite(source.sealGlyphPhase, `${field}.sealGlyphPhase`),
    statuePhaseDegrees: finite(source.statuePhaseDegrees, `${field}.statuePhaseDegrees`),
  }
}

function hubWorldSnapshot(value: unknown, field: string): HubWorldSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, ['ambient', 'collisionRngState', 'kind', 'students'])
  if (source.kind !== 'hub') throw new GameProtocolError(`${field}.kind is not supported`)
  return {
    ambient: ambientState(source.ambient, `${field}.ambient`),
    collisionRngState: nonnegativeInteger(
      source.collisionRngState,
      `${field}.collisionRngState`,
    ),
    kind: 'hub',
    students: limitedArray(source.students, `${field}.students`, MAX_STUDENTS).map(
      (student, index) => studentState(student, `${field}.students[${index}]`),
    ),
  }
}

function gameSnapshot(value: unknown): GameSnapshot {
  const source = record(value, 'snapshot')
  onlyKeys(source, 'snapshot', ['hostPlayerId', 'players', 'tick', 'world'])
  const rawPlayers = record(source.players, 'snapshot.players')
  if (Object.keys(rawPlayers).length > MAX_PLAYERS) {
    throw new GameProtocolError(`snapshot.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const players: Record<string, ProtocolPlayerState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayers)) {
    const playerId = validatedPlayerId(rawPlayerId, 'snapshot player id')
    players[playerId] = playerState(
      state,
      `snapshot.players.${playerId}`,
    )
  }
  const hostPlayerId = source.hostPlayerId === null
    ? null
    : validatedPlayerId(source.hostPlayerId, 'snapshot.hostPlayerId')
  if (hostPlayerId !== null && !players[hostPlayerId]) {
    throw new GameProtocolError('snapshot.hostPlayerId is not present in snapshot.players')
  }
  return {
    hostPlayerId,
    players,
    tick: nonnegativeInteger(source.tick, 'snapshot.tick'),
    world: gameWorldSnapshot(source.world, 'snapshot.world'),
  }
}

function gameWorldSnapshot(value: unknown, field: string): GameSnapshot['world'] {
  const source = record(value, field)
  if (source.kind === 'hub') return hubWorldSnapshot(source, field)
  if (source.kind === 'boneyard') {
    onlyKeys(source, field, ['gateLeaves', 'kind', 'runId'])
    return {
      gateLeaves: limitedArray(
        source.gateLeaves,
        `${field}.gateLeaves`,
        MAX_BONEYARD_STRUCTURES * 2,
      ).map((leaf, index) => boneyardGateLeafSnapshot(
        leaf,
        `${field}.gateLeaves[${index}]`,
      )),
      kind: 'boneyard',
      runId: limitedString(source.runId, `${field}.runId`, 128),
    }
  }
  throw new GameProtocolError(`${field}.kind is not supported`)
}

function boneyardGateLeafSnapshot(
  value: unknown,
  field: string,
): BoneyardGateLeafSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, ['fenceEid', 'hinge', 'id', 'side', 'tip'])
  const side = nonnegativeInteger(source.side, `${field}.side`)
  if (side !== 0 && side !== 1) {
    throw new GameProtocolError(`${field}.side must be 0 or 1`)
  }
  return {
    fenceEid: limitedString(source.fenceEid, `${field}.fenceEid`, 128),
    hinge: boneyardPoint(source.hinge, `${field}.hinge`),
    id: limitedString(source.id, `${field}.id`, 256),
    side,
    tip: boneyardPoint(source.tip, `${field}.tip`),
  }
}

function playerCharacterKernelParameters(
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

function contentManifest(value: unknown): GameContentManifest {
  const source = record(value, 'content')
  return {
    manifestSha256: sha256(source.manifestSha256, 'content.manifestSha256'),
    mods: limitedArray(source.mods, 'content.mods', MAX_CONTENT_MODS).map(
      (entry, index) => {
        const mod = record(entry, `content.mods[${index}]`)
        return {
          id: limitedString(mod.id, `content.mods[${index}].id`, 128),
          version: limitedString(mod.version, `content.mods[${index}].version`, 64),
          contentSha256: sha256(
            mod.contentSha256,
            `content.mods[${index}].contentSha256`,
          ),
        }
      },
    ),
  }
}
