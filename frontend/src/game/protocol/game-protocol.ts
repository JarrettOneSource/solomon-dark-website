import {
  isWizardDiscipline,
  isWizardElement,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  BONEYARD_SOLOMON_PHASES,
  BONEYARD_SOLOMON_VOICE_CUES,
  type BoneyardSolomonPhase,
  type BoneyardSolomonVoiceCue,
} from '../core-kernels/boneyard-encounter.ts'
import {
  BONEYARD_WAVE_DIRECTOR_PHASES,
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemyState,
  type BoneyardWaveDirectorPhase,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  isHubRegionId,
  isHubTransitionEdge,
  type HubParticipantState,
  type HubRegionId,
} from '../core-kernels/hub-regions.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type {
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../core-kernels/primary-spell-fire-native.ts'
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
  GameSnapshotFrame,
  BoneyardSolomonSnapshot,
  BoneyardWaveSnapshot,
  HubWorldSnapshot,
  ProtocolAmbientState,
  ProtocolPlayerState,
  ProtocolStudentState,
} from './game-state.ts'
import { REPLICATED_ENTITY_TYPE_REGISTRY } from './entity-replication.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntityFrame,
  ReplicatedEntityKey,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export type { GameSnapshot } from './game-state.ts'
export type {
  BoneyardChoice,
  BoneyardScene,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'

export const GAME_PROTOCOL_VERSION = 11
export const GAME_PROTOCOL_NAME = `solomon-dark/${GAME_PROTOCOL_VERSION}`
export const PLAYER_CHARACTER_KERNEL_VERSION = 'player-character-kernel-3'
export const EMPTY_CONTENT_MANIFEST_SHA256 = '0'.repeat(64)

const MAX_CONTENT_MODS = 256
const MAX_BONEYARD_CHOICES = 256
const MAX_BONEYARD_OBJECTS = 8192
const MAX_BONEYARD_SPRITES = 16384
const MAX_BONEYARD_STRUCTURES = 8192
const MAX_BONEYARD_ENEMIES = 512
const MAX_BONEYARD_ENEMY_FLAGS = 64
const MAX_BONEYARD_VOICE_EVENTS = 8
const MAX_FOUNTAIN_PARTICLES = 512
const MAX_PLAYERS = 64
const MAX_STUDENT_PROPS = 8
const MAX_STUDENTS = 256
const MAX_REPLICATED_ENTITIES = 8192
const MAX_REPLICATED_COMPONENTS = 64
const MAX_PRIMARY_SPELL_PROJECTILES = 4096
const MAX_PRIMARY_SPELL_TRANSIENTS = 16384

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

export interface ClientPingMessage {
  type: 'client-ping'
  nonce: number
}

export interface ClientSnapshotAckMessage {
  type: 'client-snapshot-ack'
  requireKeyframe: boolean
  sequence: number
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
  | ClientPingMessage
  | ClientSnapshotAckMessage
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
  snapshotSequence: number
}

export interface ServerSnapshotMessage {
  type: 'server-snapshot'
  acknowledgedInputSequence: number
  frame: GameSnapshotFrame
  sequence: number
}

export interface ServerBoneyardLoadedMessage {
  type: 'server-boneyard-loaded'
  boneyard: LoadedBoneyard
}

export interface ServerPongMessage {
  type: 'server-pong'
  nonce: number
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
  | ServerPongMessage
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
  if (value.type === 'client-ping') {
    onlyKeys(value, 'message', ['type', 'nonce'])
    return { type: 'client-ping', nonce: pingNonce(value.nonce) }
  }
  if (value.type === 'client-snapshot-ack') {
    onlyKeys(value, 'message', ['type', 'requireKeyframe', 'sequence'])
    return {
      type: 'client-snapshot-ack',
      requireKeyframe: boolean(value.requireKeyframe, 'requireKeyframe'),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
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
      'snapshotSequence',
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
      snapshotSequence: nonnegativeInteger(value.snapshotSequence, 'snapshotSequence'),
    }
  }
  if (value.type === 'server-snapshot') {
    onlyKeys(value, 'message', [
      'type',
      'acknowledgedInputSequence',
      'frame',
      'sequence',
    ])
    return {
      type: 'server-snapshot',
      acknowledgedInputSequence: nonnegativeInteger(
        value.acknowledgedInputSequence,
        'acknowledgedInputSequence',
      ),
      frame: gameSnapshotFrame(value.frame),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'server-boneyard-loaded') {
    onlyKeys(value, 'message', ['type', 'boneyard'])
    return {
      type: 'server-boneyard-loaded',
      boneyard: loadedBoneyard(value.boneyard),
    }
  }
  if (value.type === 'server-pong') {
    onlyKeys(value, 'message', ['type', 'nonce'])
    return { type: 'server-pong', nonce: pingNonce(value.nonce) }
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

function nonnegativeFinite(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result < 0) throw new GameProtocolError(`${field} must be nonnegative`)
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

function pingNonce(value: unknown): number {
  const result = positiveInteger(value, 'nonce')
  if (result > 0x7fffffff) throw new GameProtocolError('nonce is out of range')
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
  onlyKeys(source, field, ['aim', 'cast', 'movement'])
  const cast = record(source.cast, `${field}.cast`)
  onlyKeys(cast, `${field}.cast`, ['primary', 'secondary'])
  return {
    aim: source.aim === null ? null : vector(source.aim, `${field}.aim`),
    cast: {
      primary: boolean(cast.primary, `${field}.cast.primary`),
      secondary: boolean(cast.secondary, `${field}.cast.secondary`),
    },
    movement: unitVector(source.movement, `${field}.movement`),
  }
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
    'primaryCast',
    'velocity',
    'walkCyclePrimary',
  ])
  return {
    config: playerCharacterConfig(source.config, `${field}.config`),
    footstepTick: nonnegativeInteger(source.footstepTick, `${field}.footstepTick`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    position: vector(source.position, `${field}.position`),
    primaryCast: playerPrimaryCastState(source.primaryCast, `${field}.primaryCast`),
    velocity: vector(source.velocity, `${field}.velocity`),
    walkCyclePrimary: finite(source.walkCyclePrimary, `${field}.walkCyclePrimary`),
  }
}

function playerPrimaryCastState(
  value: unknown,
  field: string,
): ProtocolPlayerState['primaryCast'] {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionTick',
    'aimDirection',
    'castSequence',
    'channelActive',
    'emissionSequence',
    'held',
  ])
  const actionTick = integer(source.actionTick, `${field}.actionTick`)
  const channelActive = boolean(source.channelActive, `${field}.channelActive`)
  if (channelActive && (actionTick < 0 || actionTick > 1)) {
    throw new GameProtocolError(`${field}.actionTick is outside the Staff Constant program`)
  }
  if (!channelActive && (actionTick < -1 || actionTick >= 74)) {
    throw new GameProtocolError(`${field}.actionTick is outside the Staff Cast 1 program`)
  }
  return {
    actionTick,
    aimDirection: unitVector(source.aimDirection, `${field}.aimDirection`),
    castSequence: nonnegativeInteger(source.castSequence, `${field}.castSequence`),
    channelActive,
    emissionSequence: nonnegativeInteger(
      source.emissionSequence,
      `${field}.emissionSequence`,
    ),
    held: boolean(source.held, `${field}.held`),
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
    ? [
        'eid', 'typeId', 'points', 'style', 'segmentCode',
        'startPostVariant', 'endPostVariant',
      ]
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
      ...optionalNumberField(source, field, 'startPostVariant', optionalInteger),
      ...optionalNumberField(source, field, 'endPostVariant', optionalInteger),
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
  onlyKeys(source, field, [
    'framePhase',
    'gaitDegrees',
    'heading',
    'headingIndex',
    'id',
    'position',
    'props',
    'reading',
    'scale',
  ])
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
  return {
    framePhase: finite(source.framePhase, `${field}.framePhase`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    heading: finite(source.heading, `${field}.heading`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    id: nonnegativeInteger(source.id, `${field}.id`),
    position: vector(source.position, `${field}.position`),
    props,
    reading: boolean(source.reading, `${field}.reading`),
    scale: positiveFinite(source.scale, `${field}.scale`),
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
  onlyKeys(source, field, [
    'ambient',
    'collisionRngState',
    'kind',
    'participants',
    'students',
  ])
  if (source.kind !== 'hub') throw new GameProtocolError(`${field}.kind is not supported`)
  const rawParticipants = record(source.participants, `${field}.participants`)
  if (Object.keys(rawParticipants).length > MAX_PLAYERS) {
    throw new GameProtocolError(
      `${field}.participants may contain at most ${MAX_PLAYERS} entries`,
    )
  }
  const participants: Record<string, HubParticipantState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawParticipants)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} participant id`)
    participants[playerId] = hubParticipantState(
      state,
      `${field}.participants.${playerId}`,
    )
  }
  return {
    ambient: ambientState(source.ambient, `${field}.ambient`),
    collisionRngState: nonnegativeInteger(
      source.collisionRngState,
      `${field}.collisionRngState`,
    ),
    kind: 'hub',
    participants,
    students: limitedArray(source.students, `${field}.students`, MAX_STUDENTS).map(
      (student, index) => studentState(student, `${field}.students[${index}]`),
    ),
  }
}

function gameSnapshot(value: unknown): GameSnapshot {
  const source = record(value, 'snapshot')
  onlyKeys(source, 'snapshot', [
    'hostPlayerId', 'players', 'primarySpells', 'tick', 'world',
  ])
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
  const world = gameWorldSnapshot(source.world, 'snapshot.world')
  const primarySpells = primarySpellState(source.primarySpells, 'snapshot.primarySpells')
  validatePrimarySpellOwners(primarySpells, players, 'snapshot.primarySpells')
  if (world.kind === 'hub') {
    const participantIds = Object.keys(world.participants).sort()
    const playerIds = Object.keys(players).sort()
    if (
      participantIds.length !== playerIds.length
      || participantIds.some((id, index) => id !== playerIds[index])
    ) {
      throw new GameProtocolError(
        'snapshot.world.participants must match snapshot.players exactly',
      )
    }
  }
  return {
    hostPlayerId,
    players,
    primarySpells,
    tick: nonnegativeInteger(source.tick, 'snapshot.tick'),
    world,
  }
}

function gameSnapshotFrame(value: unknown): GameSnapshotFrame {
  const source = record(value, 'frame')
  onlyKeys(source, 'frame', [
    'hostPlayerId', 'players', 'primarySpells', 'tick', 'world',
  ])
  const rawPlayers = record(source.players, 'frame.players')
  if (Object.keys(rawPlayers).length > MAX_PLAYERS) {
    throw new GameProtocolError(`frame.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const players: Record<string, ProtocolPlayerState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayers)) {
    const playerId = validatedPlayerId(rawPlayerId, 'frame player id')
    players[playerId] = playerState(state, `frame.players.${playerId}`)
  }
  const hostPlayerId = source.hostPlayerId === null
    ? null
    : validatedPlayerId(source.hostPlayerId, 'frame.hostPlayerId')
  if (hostPlayerId !== null && !players[hostPlayerId]) {
    throw new GameProtocolError('frame.hostPlayerId is not present in frame.players')
  }
  const world = gameWorldSnapshotFrame(source.world, 'frame.world')
  const primarySpells = primarySpellState(source.primarySpells, 'frame.primarySpells')
  validatePrimarySpellOwners(primarySpells, players, 'frame.primarySpells')
  if (world.kind === 'hub') validateParticipantOwnership(world.participants, players, 'frame')
  return {
    hostPlayerId,
    players,
    primarySpells,
    tick: nonnegativeInteger(source.tick, 'frame.tick'),
    world,
  }
}

function primarySpellState(value: unknown, field: string): PrimarySpellSimulationState {
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

function primarySpellProjectile(value: unknown, field: string): PrimarySpellProjectileState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks', 'charge', 'direction', 'flightTicks', 'id', 'kind', 'ownerId',
    'phase', 'position', 'velocity', 'worldKey',
  ])
  if (source.kind !== 'earth' && source.kind !== 'ether' && source.kind !== 'fire') {
    throw new GameProtocolError(`${field}.kind is not a projectile primary`)
  }
  if (source.phase !== 'flight' && source.phase !== 'held') {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  if (source.phase === 'held' && source.kind !== 'earth') {
    throw new GameProtocolError(`${field} only permits held Earth actors`)
  }
  const charge = finite(source.charge, `${field}.charge`)
  if (charge < 0 || charge > 1) {
    throw new GameProtocolError(`${field}.charge must be within [0,1]`)
  }
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const flightTicks = nonnegativeInteger(source.flightTicks, `${field}.flightTicks`)
  if (source.phase === 'held' && flightTicks !== 0) {
    throw new GameProtocolError(`${field}.flightTicks must be zero while held`)
  }
  if (source.phase === 'flight' && (flightTicks < 1 || flightTicks > ageTicks)) {
    throw new GameProtocolError(`${field}.flightTicks is outside the actor age`)
  }
  return {
    ageTicks,
    charge,
    direction: unitVector(source.direction, `${field}.direction`),
    flightTicks,
    id: positiveInteger(source.id, `${field}.id`),
    kind: source.kind,
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    phase: source.phase,
    position: vector(source.position, `${field}.position`),
    velocity: vector(source.velocity, `${field}.velocity`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
}

function primarySpellTransient(value: unknown, field: string): PrimarySpellTransientState {
  const source = record(value, field)
  if (source.kind === 'earth-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'charge', 'id', 'kind', 'origin', 'ownerId', 'worldKey',
    ])
    const charge = finite(source.charge, `${field}.charge`)
    if (charge < 0 || charge > 1) {
      throw new GameProtocolError(`${field}.charge must be within [0,1]`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      charge,
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'earth-impact',
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  onlyKeys(source, field, [
    'ageTicks', 'direction', 'id', 'kind', 'origin', 'ownerId', 'variant',
    'worldKey',
  ])
  if (source.kind !== 'air' && source.kind !== 'fire' && source.kind !== 'water') {
    throw new GameProtocolError(`${field}.kind is not a transient primary`)
  }
  const id = positiveInteger(source.id, `${field}.id`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const variant = nonnegativeInteger(source.variant, `${field}.variant`)
  if (variant > 3) throw new GameProtocolError(`${field}.variant exceeds the native family`)
  if (source.kind === 'fire') {
    if (variant !== nativeFireParticleVariant(id)) {
      throw new GameProtocolError(`${field}.variant does not match its Fire particle id`)
    }
    if (ageTicks >= nativeFireParticleLifetimeTicks(id)) {
      throw new GameProtocolError(`${field}.ageTicks exceeds its Fire particle lifetime`)
    }
  }
  return {
    ageTicks,
    direction: unitVector(source.direction, `${field}.direction`),
    id,
    kind: source.kind,
    origin: vector(source.origin, `${field}.origin`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    variant,
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
}

function validatePrimarySpellOwners(
  spells: PrimarySpellSimulationState,
  players: Readonly<Record<string, ProtocolPlayerState>>,
  field: string,
): void {
  for (const spell of [...spells.projectiles, ...spells.transients]) {
    if (!players[spell.ownerId]) {
      throw new GameProtocolError(`${field} owner ${spell.ownerId} is not present`)
    }
  }
}

function hubParticipantState(value: unknown, field: string): HubParticipantState {
  const source = record(value, field)
  onlyKeys(source, field, ['region', 'transition'])
  const region = hubRegionId(source.region, `${field}.region`)
  if (source.transition === null) return { region, transition: null }
  const transition = record(source.transition, `${field}.transition`)
  onlyKeys(transition, `${field}.transition`, [
    'alpha',
    'destination',
    'phase',
    'scriptedSpeed',
    'scriptedTarget',
    'sourceRegion',
  ])
  const alpha = finite(transition.alpha, `${field}.transition.alpha`)
  if (alpha < 0 || alpha > 1) {
    throw new GameProtocolError(`${field}.transition.alpha must be within [0,1]`)
  }
  if (transition.phase !== 'outgoing' && transition.phase !== 'incoming') {
    throw new GameProtocolError(`${field}.transition.phase is not supported`)
  }
  const destination = hubRegionId(
    transition.destination,
    `${field}.transition.destination`,
  )
  const sourceRegion = hubRegionId(
    transition.sourceRegion,
    `${field}.transition.sourceRegion`,
  )
  if (
    (transition.phase === 'outgoing' && region !== sourceRegion)
    || (transition.phase === 'incoming' && region !== destination)
    || !isHubTransitionEdge(sourceRegion, destination)
  ) {
    throw new GameProtocolError(`${field}.transition is inconsistent with its region`)
  }
  return {
    region,
    transition: {
      alpha,
      destination,
      phase: transition.phase,
      scriptedSpeed: positiveFinite(
        transition.scriptedSpeed,
        `${field}.transition.scriptedSpeed`,
      ),
      scriptedTarget: vector(
        transition.scriptedTarget,
        `${field}.transition.scriptedTarget`,
      ),
      sourceRegion,
    },
  }
}

function hubRegionId(value: unknown, field: string): HubRegionId {
  const result = limitedString(value, field, 32)
  if (!isHubRegionId(result)) {
    throw new GameProtocolError(`${field} is not supported`)
  }
  return result
}

function gameWorldSnapshot(value: unknown, field: string): GameSnapshot['world'] {
  const source = record(value, field)
  if (source.kind === 'hub') return hubWorldSnapshot(source, field)
  if (source.kind === 'boneyard') {
    onlyKeys(source, field, ['encounter', 'gateLeaves', 'kind', 'runId', 'waves'])
    const encounter = boneyardSolomonSnapshot(source.encounter, `${field}.encounter`)
    const waves = boneyardWaveSnapshot(source.waves, `${field}.waves`)
    if ((encounter === null) !== (waves === null)) {
      throw new GameProtocolError(`${field}.encounter and ${field}.waves must share ownership`)
    }
    return {
      encounter,
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
      waves,
    }
  }
  throw new GameProtocolError(`${field}.kind is not supported`)
}

function boneyardSolomonSnapshot(
  value: unknown,
  field: string,
): BoneyardSolomonSnapshot | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'acceleration',
    'digFrame',
    'escapeSpeed',
    'headingDeg',
    'lifetimeTicksRemaining',
    'mouthPose',
    'mouthPoseTicksRemaining',
    'motion',
    'phase',
    'phaseTicksRemaining',
    'position',
    'runEventId',
    'targetPlayerId',
    'transitionOffsetY',
    'turnRate',
    'voiceEvents',
    'voiceTicksRemaining',
    'walkCycle',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(BONEYARD_SOLOMON_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg > 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360]`)
  }
  const mouthPose = nonnegativeInteger(source.mouthPose, `${field}.mouthPose`)
  if (mouthPose >= 3) {
    throw new GameProtocolError(`${field}.mouthPose must be within [0,3)`)
  }
  const digFrame = nonnegativeInteger(source.digFrame, `${field}.digFrame`)
  if (digFrame >= 18) {
    throw new GameProtocolError(`${field}.digFrame must be within [0,18)`)
  }
  const transitionOffsetY = nonnegativeFinite(
    source.transitionOffsetY,
    `${field}.transitionOffsetY`,
  )
  if (transitionOffsetY > 15) {
    throw new GameProtocolError(`${field}.transitionOffsetY must be within [0,15]`)
  }
  const turnRate = nonnegativeFinite(source.turnRate, `${field}.turnRate`)
  if (turnRate > 10) {
    throw new GameProtocolError(`${field}.turnRate must be within [0,10]`)
  }
  const walkCycle = nonnegativeFinite(source.walkCycle, `${field}.walkCycle`)
  if (walkCycle > 6) {
    throw new GameProtocolError(`${field}.walkCycle must be within [0,6]`)
  }
  let previousVoiceEventId = 0
  const voiceEvents = limitedArray(
    source.voiceEvents,
    `${field}.voiceEvents`,
    MAX_BONEYARD_VOICE_EVENTS,
  ).map((event, index) => {
    const eventField = `${field}.voiceEvents[${index}]`
    const item = record(event, eventField)
    onlyKeys(item, eventField, ['cue', 'id'])
    const cue = limitedString(item.cue, `${eventField}.cue`, 64)
    if (!(BONEYARD_SOLOMON_VOICE_CUES as readonly string[]).includes(cue)) {
      throw new GameProtocolError(`${eventField}.cue is not supported`)
    }
    const id = positiveInteger(item.id, `${eventField}.id`)
    if (id <= previousVoiceEventId) {
      throw new GameProtocolError(`${field}.voiceEvents ids must increase`)
    }
    previousVoiceEventId = id
    return { cue: cue as BoneyardSolomonVoiceCue, id }
  })
  return {
    acceleration: finite(source.acceleration, `${field}.acceleration`),
    digFrame,
    escapeSpeed: nonnegativeFinite(source.escapeSpeed, `${field}.escapeSpeed`),
    headingDeg,
    lifetimeTicksRemaining: nonnegativeInteger(
      source.lifetimeTicksRemaining,
      `${field}.lifetimeTicksRemaining`,
    ),
    mouthPose,
    mouthPoseTicksRemaining: nonnegativeInteger(
      source.mouthPoseTicksRemaining,
      `${field}.mouthPoseTicksRemaining`,
    ),
    motion: finite(source.motion, `${field}.motion`),
    phase: phase as BoneyardSolomonPhase,
    phaseTicksRemaining: nonnegativeInteger(
      source.phaseTicksRemaining,
      `${field}.phaseTicksRemaining`,
    ),
    position: boneyardPoint(source.position, `${field}.position`),
    runEventId: nonnegativeInteger(source.runEventId, `${field}.runEventId`),
    targetPlayerId: source.targetPlayerId === null
      ? null
      : validatedPlayerId(source.targetPlayerId, `${field}.targetPlayerId`),
    transitionOffsetY,
    turnRate,
    voiceEvents,
    voiceTicksRemaining: nonnegativeInteger(
      source.voiceTicksRemaining,
      `${field}.voiceTicksRemaining`,
    ),
    walkCycle,
  }
}

function boneyardWaveSnapshot(
  value: unknown,
  field: string,
): BoneyardWaveSnapshot | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'enemies',
    'interwaveDelayTicks',
    'pendingSpawnBudget',
    'phase',
    'scheduleIndex',
    'spawnDelayTicks',
    'waveEventId',
    'waveOrdinal',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(BONEYARD_WAVE_DIRECTOR_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const ids = new Set<number>()
  const enemies = limitedArray(
    source.enemies,
    `${field}.enemies`,
    MAX_BONEYARD_ENEMIES,
  ).map((enemy, index) => {
    const enemyField = `${field}.enemies[${index}]`
    const item = record(enemy, enemyField)
    onlyKeys(item, enemyField, [
      'enemyToken',
      'flags',
      'headingDeg',
      'id',
      'locationPolicy',
      'nativeTypeId',
      'position',
      'spawnTick',
      'targetPlayerId',
    ])
    const enemyToken = limitedString(item.enemyToken, `${enemyField}.enemyToken`, 32)
    const expectedTypeId = BONEYARD_WAVE_ENEMY_TYPES[
      enemyToken as keyof typeof BONEYARD_WAVE_ENEMY_TYPES
    ]
    if (expectedTypeId === undefined) {
      throw new GameProtocolError(`${enemyField}.enemyToken is not supported`)
    }
    const nativeTypeId = positiveInteger(item.nativeTypeId, `${enemyField}.nativeTypeId`)
    if (nativeTypeId !== expectedTypeId) {
      throw new GameProtocolError(`${enemyField}.nativeTypeId does not match enemyToken`)
    }
    const id = positiveInteger(item.id, `${enemyField}.id`)
    if (ids.has(id)) throw new GameProtocolError(`${field}.enemies duplicates id ${id}`)
    ids.add(id)
    const headingDeg = finite(item.headingDeg, `${enemyField}.headingDeg`)
    if (headingDeg < 0 || headingDeg >= 360) {
      throw new GameProtocolError(`${enemyField}.headingDeg must be within [0,360)`)
    }
    if (item.locationPolicy !== 'near-player' && item.locationPolicy !== 'anywhere') {
      throw new GameProtocolError(`${enemyField}.locationPolicy is not supported`)
    }
    const locationPolicy = item.locationPolicy as BoneyardEnemyState['locationPolicy']
    return {
      enemyToken: enemyToken as keyof typeof BONEYARD_WAVE_ENEMY_TYPES,
      flags: limitedArray(
        item.flags,
        `${enemyField}.flags`,
        MAX_BONEYARD_ENEMY_FLAGS,
      ).map((flag, flagIndex) => limitedString(
        flag,
        `${enemyField}.flags[${flagIndex}]`,
        64,
      )),
      headingDeg,
      id,
      locationPolicy,
      nativeTypeId,
      position: boneyardPoint(item.position, `${enemyField}.position`),
      spawnTick: nonnegativeInteger(item.spawnTick, `${enemyField}.spawnTick`),
      targetPlayerId: validatedPlayerId(
        item.targetPlayerId,
        `${enemyField}.targetPlayerId`,
      ),
    }
  })
  return {
    enemies,
    interwaveDelayTicks: nonnegativeInteger(
      source.interwaveDelayTicks,
      `${field}.interwaveDelayTicks`,
    ),
    pendingSpawnBudget: nonnegativeInteger(
      source.pendingSpawnBudget,
      `${field}.pendingSpawnBudget`,
    ),
    phase: phase as BoneyardWaveDirectorPhase,
    scheduleIndex: nonnegativeInteger(source.scheduleIndex, `${field}.scheduleIndex`),
    spawnDelayTicks: nonnegativeInteger(
      source.spawnDelayTicks,
      `${field}.spawnDelayTicks`,
    ),
    waveEventId: nonnegativeInteger(source.waveEventId, `${field}.waveEventId`),
    waveOrdinal: nonnegativeInteger(source.waveOrdinal, `${field}.waveOrdinal`),
  }
}

function gameWorldSnapshotFrame(
  value: unknown,
  field: string,
): GameSnapshotFrame['world'] {
  const source = record(value, field)
  if (source.kind !== 'hub') {
    const world = gameWorldSnapshot(source, field)
    if (world.kind === 'hub') throw new GameProtocolError(`${field}.kind is invalid`)
    return world
  }
  onlyKeys(source, field, [
    'ambient',
    'collisionRngState',
    'entities',
    'kind',
    'participants',
  ])
  const rawParticipants = record(source.participants, `${field}.participants`)
  if (Object.keys(rawParticipants).length > MAX_PLAYERS) {
    throw new GameProtocolError(
      `${field}.participants may contain at most ${MAX_PLAYERS} entries`,
    )
  }
  const participants: Record<string, HubParticipantState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawParticipants)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} participant id`)
    participants[playerId] = hubParticipantState(
      state,
      `${field}.participants.${playerId}`,
    )
  }
  return {
    ambient: ambientState(source.ambient, `${field}.ambient`),
    collisionRngState: nonnegativeInteger(
      source.collisionRngState,
      `${field}.collisionRngState`,
    ),
    entities: replicatedEntityFrame(source.entities, `${field}.entities`),
    kind: 'hub',
    participants,
  }
}

function replicatedEntityFrame(value: unknown, field: string): ReplicatedEntityFrame {
  const source = record(value, field)
  onlyKeys(source, field, [
    'baselineSequence',
    'keyframe',
    'retired',
    'samples',
    'spawned',
  ])
  const keyframe = boolean(source.keyframe, `${field}.keyframe`)
  const baselineSequence = nonnegativeInteger(
    source.baselineSequence,
    `${field}.baselineSequence`,
  )
  if (keyframe && baselineSequence !== 0) {
    throw new GameProtocolError(`${field}.baselineSequence must be zero for a keyframe`)
  }
  return {
    baselineSequence,
    keyframe,
    retired: uniqueEntityEntries(
      source.retired,
      `${field}.retired`,
      'key',
    ) as unknown as readonly ReplicatedEntityKey[],
    samples: uniqueEntityEntries(
      source.samples,
      `${field}.samples`,
      'sample',
    ) as unknown as readonly ReplicatedEntitySample[],
    spawned: uniqueEntityEntries(
      source.spawned,
      `${field}.spawned`,
      'descriptor',
    ) as unknown as readonly ReplicatedEntityDescriptor[],
  }
}

function uniqueEntityEntries(
  value: unknown,
  field: string,
  kind: 'descriptor' | 'key' | 'sample',
): readonly number[][] {
  const entries = limitedArray(value, field, MAX_REPLICATED_ENTITIES)
  const result: number[][] = []
  const keys = new Set<string>()
  for (let index = 0; index < entries.length; index += 1) {
    const entryField = `${field}[${index}]`
    const raw = limitedArray(entries[index], entryField, MAX_REPLICATED_COMPONENTS)
    if (raw.length < 2 || (kind === 'key' && raw.length !== 2)) {
      throw new GameProtocolError(`${entryField} has an invalid component count`)
    }
    const typeId = nonnegativeInteger(raw[0], `${entryField}[0]`)
    const entityId = nonnegativeInteger(raw[1], `${entryField}[1]`)
    const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(typeId)
    if (!registration) {
      throw new GameProtocolError(`${entryField} uses an unknown entity type`)
    }
    const key = `${typeId}:${entityId}`
    if (keys.has(key)) throw new GameProtocolError(`${entryField} duplicates ${key}`)
    keys.add(key)
    const decoded: [number, number, ...number[]] = [
      typeId,
      entityId,
      ...raw.slice(2).map((component, componentIndex) => finite(
        component,
        `${entryField}[${componentIndex + 2}]`,
      )),
    ]
    if (
      (kind === 'descriptor' && !registration.descriptorIsValid(decoded))
      || (kind === 'sample' && !registration.sampleIsValid(decoded))
    ) throw new GameProtocolError(`${entryField} has an invalid registered ${kind} shape`)
    result.push(decoded)
  }
  return result
}

function validateParticipantOwnership(
  participants: Readonly<Record<string, HubParticipantState>>,
  players: Readonly<Record<string, ProtocolPlayerState>>,
  field: string,
): void {
  const participantIds = Object.keys(participants).sort()
  const playerIds = Object.keys(players).sort()
  if (
    participantIds.length !== playerIds.length
    || participantIds.some((id, index) => id !== playerIds[index])
  ) {
    throw new GameProtocolError(
      `${field}.world.participants must match ${field}.players exactly`,
    )
  }
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
