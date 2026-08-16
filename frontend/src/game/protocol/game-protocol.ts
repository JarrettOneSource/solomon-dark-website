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
  BONEYARD_ARENA_ENTRANCE_EXTENSION,
  BONEYARD_ARENA_NORTH_TARGET_INSET,
  BONEYARD_ARENA_SEAL_TICKS,
  BONEYARD_ARENA_TRANSITION_PHASES,
  type BoneyardArenaTransitionState,
} from '../core-kernels/boneyard-arena-transition.ts'
import {
  BONEYARD_WAVE_DIRECTOR_PHASES,
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardWaveDirectorPhase,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  isHubRegionId,
  isHubTransitionEdge,
  type HubParticipantState,
  type HubRegionId,
} from '../core-kernels/hub-regions.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  NATIVE_LIGHT_MANAGER_LANES,
  type NativeLightManagerLane,
  type NativeLightProviderRegistration,
} from '../core-kernels/native-light-provider-order.ts'
import { ETHER_PRIMARY_INITIAL_TURN } from '../core-kernels/primary-spell-targeting.ts'
import { earthImpactLifetimeTicks } from '../core-kernels/primary-spell-earth.ts'
import {
  waterFrostJetKind,
  waterFrostJetLifetimeTicks,
} from '../core-kernels/primary-spell-water.ts'
import {
  PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
  PRIMARY_SPELL_AIR_LIFETIME_TICKS,
  PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS,
  PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
  primaryCastActionEndTick,
  type PrimarySpellEarthProjectileState,
  type PrimarySpellProjectilePhase,
  type PrimarySpellProjectileState,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../core-kernels/primary-spell-fire-native.ts'
import {
  GAME_RUN_PHASES,
  type GameRunLifecycleState,
  type GameRunPhase,
} from '../core-kernels/game-run.ts'
import { PLAYER_LIFE_STATES, type PlayerLifeState } from '../core-kernels/player-combat.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  EQUIPMENT_SLOTS,
  EQUIPMENT_TYPES,
  HAGATHA_PERKS,
  HUB_ITEM_KINDS,
  type DowsingOffer,
  type EquipmentSlot,
  type EquipmentType,
  type HagathaOffer,
  type HubInventoryAction,
  type HubInventoryItem,
  type HubItemKind,
  type HubShopItem,
} from '../core-kernels/hub-economy.ts'
import {
  NATIVE_PLAYER_MAX_LIGHT_OVERLAY,
  playerLightDriveActive,
} from '../core-kernels/player-lighting.ts'
import { BONEYARD_ENEMY_FLAGS } from '../core-kernels/boneyard-enemy-config.ts'
import {
  BOUNDED_ENEMY_COLD_SLOW_TICKS,
  NATIVE_WRAITH_DAZZLE_TICKS,
} from '../core-kernels/boneyard-enemy-modifiers.ts'
import { NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES } from '../core-kernels/boneyard-mage-lightning.ts'
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
  BoneyardEnemyEventSnapshot,
  BoneyardEnemyDeathEffectSnapshot,
  GameSnapshot,
  GameSnapshotFrame,
  BoneyardEnemyAction,
  BoneyardEnemyAnimationSnapshot,
  BoneyardEnemyCoffinState,
  BoneyardEnemyEffectSnapshot,
  BoneyardEnemyProjectileKind,
  BoneyardEnemyProjectileEffectSnapshot,
  BoneyardEnemyProjectilePayload,
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemySnapshot,
  BoneyardMageLightningPulseFrame,
  BoneyardMageLightningPulseSnapshot,
  BoneyardMaggotSnapshot,
  BoneyardSolomonSnapshot,
  BoneyardWaveSnapshot,
  HubWorldSnapshot,
  ProtocolAmbientState,
  ProtocolPlayerProgression,
  ProtocolPlayerEconomy,
  ProtocolPlayerState,
  ProtocolPlayerSnapshotFrame,
  ProtocolStudentState,
} from './game-state.ts'
import {
  boneyardMageLightningPulseFrameIsValid,
  materializeBoneyardMageLightningPulse,
} from './boneyard-mage-lightning-replication.ts'
import {
  BONEYARD_ENEMY_EFFECT_ROLES,
  BONEYARD_ENEMY_DAMAGE_SOUNDS,
  BONEYARD_ENEMY_DEATH_EFFECT_KINDS,
  BONEYARD_ENEMY_DEATH_SOUNDS,
  BONEYARD_ENEMY_EVENT_TYPES,
  BONEYARD_ENEMY_PROJECTILE_PAYLOADS,
  BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS,
  BONEYARD_ENEMY_TERMINAL_OUTPUTS,
  BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES,
  BONEYARD_MAGGOT_STATES,
} from './game-state.ts'
import { REPLICATED_ENTITY_TYPE_REGISTRY } from './entity-replication.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntityFrame,
  ReplicatedEntityKey,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export type { BoneyardEnemyEventSnapshot, GameSnapshot } from './game-state.ts'
export type {
  BoneyardChoice,
  BoneyardScene,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'

export const GAME_PROTOCOL_VERSION = 25
export const GAME_PROTOCOL_NAME = `solomon-dark/${GAME_PROTOCOL_VERSION}`
export const GAME_CONNECTION_TIMEOUT_CLOSE_CODE = 4000
export const GAME_HOST_ENDED_SESSION_CLOSE_CODE = 4001
export const PLAYER_CHARACTER_KERNEL_VERSION = 'player-character-kernel-4'
export const EMPTY_CONTENT_MANIFEST_SHA256 = '0'.repeat(64)

const MAX_CONTENT_MODS = 256
const MAX_BONEYARD_CHOICES = 256
const MAX_BONEYARD_OBJECTS = 8192
const MAX_BONEYARD_SPRITES = 16384
const MAX_BONEYARD_STRUCTURES = 8192
const MAX_BONEYARD_ENEMIES = 512
const MAX_BONEYARD_ENEMY_EVENTS = 512
const MAX_BONEYARD_ENEMY_DEATH_EFFECTS = 8_192
const MAX_BONEYARD_ENEMY_PROJECTILES = 2_048
const MAX_BONEYARD_ENEMY_PROJECTILE_EFFECTS = 8_192
const MAX_BONEYARD_MAGE_LIGHTNING_PULSES = MAX_BONEYARD_ENEMIES
  * NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES
const MAX_BONEYARD_MAGGOTS = 2_048
const MAX_BONEYARD_ENEMY_FLAGS = 64
const MAX_BONEYARD_ENEMY_EFFECTS = 2
const MAX_BONEYARD_VOICE_EVENTS = 8
const MAX_FOUNTAIN_PARTICLES = 512
const MAX_PLAYERS = 64
const MAX_STUDENT_PROPS = 8
const MAX_STUDENTS = 256
const MAX_REPLICATED_ENTITIES = 8192
const MAX_REPLICATED_COMPONENTS = 72
const MAX_PRIMARY_SPELL_PROJECTILES = 4096
const MAX_PRIMARY_SPELL_TRANSIENTS = 16384
const MAX_PRIMARY_SPELL_HIT_TARGETS = 1024

const BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES = {
  arrow: 0x7da,
  'demon-bomb': 0x7f7,
  firebolt: 0x7eb,
  'guided-missile': 0x7ec,
  'poison-pool': 0x806,
} as const satisfies Readonly<Record<BoneyardEnemyProjectileKind, number>>

const BONEYARD_ENEMY_ANIMATION_STATES = ['idle', 'locomotion', 'action', 'death'] as const
const BONEYARD_ENEMY_ACTIONS = [
  'skeleton-claw-a',
  'skeleton-claw-b',
  'skeleton-weapon',
  'skeleton-pike',
  'archer-shot',
  'mage-cast-short',
  'mage-cast-long',
  'imp-contact',
  'zombie-beat',
  'wraith-drain',
  'demon-bomb',
] as const satisfies readonly BoneyardEnemyAction[]
const BONEYARD_ENEMY_COFFIN_STATES = [
  'hidden',
  'closed',
  'opening',
  'transition-delay',
  'open',
] as const satisfies readonly BoneyardEnemyCoffinState[]

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

export interface ClientSelectSkillMessage {
  type: 'client-select-skill'
  choiceIndex: number
  offerSequence: number
  skillId: number
}

export interface ClientLevelUpActionMessage {
  type: 'client-level-up-action'
  action: 'reroll' | 'save'
  offerSequence: number
}

export interface ClientHubActionMessage {
  type: 'client-hub-action'
  action: HubInventoryAction
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

export interface ClientAcknowledgeGameOverMessage {
  type: 'client-acknowledge-game-over'
  eventId: number
  runId: string
}

export interface ClientConfirmLoadoutMessage {
  type: 'client-confirm-loadout'
}

export type ClientGameMessage =
  | ClientAcknowledgeGameOverMessage
  | ClientConfirmLoadoutMessage
  | ClientHelloMessage
  | ClientHubActionMessage
  | ClientInputMessage
  | ClientLevelUpActionMessage
  | ClientSelectSkillMessage
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
  if (value.type === 'client-hub-action') {
    onlyKeys(value, 'message', ['type', 'action'])
    return { type: 'client-hub-action', action: hubInventoryAction(value.action) }
  }
  if (value.type === 'client-select-skill') {
    onlyKeys(value, 'message', ['type', 'choiceIndex', 'offerSequence', 'skillId'])
    const choiceIndex = nonnegativeInteger(value.choiceIndex, 'choiceIndex')
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    if (choiceIndex > 3) throw new GameProtocolError('choiceIndex is out of range')
    if (skillId < 8 || skillId > 79) throw new GameProtocolError('skillId is out of range')
    return {
      type: 'client-select-skill',
      choiceIndex,
      offerSequence: nonnegativeInteger(value.offerSequence, 'offerSequence'),
      skillId,
    }
  }
  if (value.type === 'client-level-up-action') {
    onlyKeys(value, 'message', ['type', 'action', 'offerSequence'])
    const action = limitedString(value.action, 'action', 16)
    if (action !== 'reroll' && action !== 'save') {
      throw new GameProtocolError('level-up action is not supported')
    }
    return {
      type: 'client-level-up-action',
      action,
      offerSequence: nonnegativeInteger(value.offerSequence, 'offerSequence'),
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
  if (value.type === 'client-acknowledge-game-over') {
    onlyKeys(value, 'message', ['type', 'eventId', 'runId'])
    return {
      type: 'client-acknowledge-game-over',
      eventId: positiveInteger(value.eventId, 'eventId'),
      runId: limitedString(value.runId, 'runId', 128),
    }
  }
  if (value.type === 'client-confirm-loadout') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-confirm-loadout' }
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

function integerWithin(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const result = integer(value, field)
  if (result < minimum || result > maximum) {
    throw new GameProtocolError(`${field} must be within [${minimum},${maximum}]`)
  }
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

function boundedInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const result = integer(value, field)
  if (result < minimum || result > maximum) {
    throw new GameProtocolError(`${field} is outside [${minimum},${maximum}]`)
  }
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

function nativeLightProviderRegistration(
  value: unknown,
  field: string,
  expectedLane: NativeLightManagerLane,
): NativeLightProviderRegistration {
  const source = record(value, field)
  onlyKeys(source, field, ['managerLane', 'registrationOrdinal'])
  const managerLane = limitedString(source.managerLane, `${field}.managerLane`, 16)
  if (!(NATIVE_LIGHT_MANAGER_LANES as readonly string[]).includes(managerLane)) {
    throw new GameProtocolError(`${field}.managerLane is not supported`)
  }
  if (managerLane !== expectedLane) {
    throw new GameProtocolError(`${field}.managerLane must be ${expectedLane}`)
  }
  return {
    managerLane: managerLane as NativeLightManagerLane,
    registrationOrdinal: nonnegativeInteger(
      source.registrationOrdinal,
      `${field}.registrationOrdinal`,
    ),
  }
}

function absentNativeLightProviderRegistration(value: unknown, field: string): null {
  if (value !== null) throw new GameProtocolError(`${field} must be null`)
  return null
}

function nullableNativeLightProviderRegistration(
  value: unknown,
  field: string,
  expectedLane: NativeLightManagerLane,
): NativeLightProviderRegistration | null {
  return value === null
    ? null
    : nativeLightProviderRegistration(value, field, expectedLane)
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

function hubInventoryAction(value: unknown): HubInventoryAction {
  const source = record(value, 'action')
  const type = limitedString(source.type, 'action.type', 32)
  if (type === 'buy-dowsing') {
    onlyKeys(source, 'action', ['type', 'offerId'])
    return { type, offerId: positiveInteger(source.offerId, 'action.offerId') }
  }
  if (type === 'buy-fomentius') {
    onlyKeys(source, 'action', ['type', 'itemId'])
    return { type, itemId: positiveInteger(source.itemId, 'action.itemId') }
  }
  if (type === 'buy-hagatha') {
    onlyKeys(source, 'action', ['type', 'selector'])
    const selector = integer(source.selector, 'action.selector')
    if (selector < -1 || selector > 27 || selector === 8) {
      throw new GameProtocolError('action.selector is unavailable')
    }
    return { type, selector }
  }
  if (type === 'close-dowsing' || type === 'dowse') {
    onlyKeys(source, 'action', ['type'])
    return { type }
  }
  if (type === 'equip') {
    onlyKeys(source, 'action', ['type', 'itemId', 'slot'])
    return {
      type,
      itemId: positiveInteger(source.itemId, 'action.itemId'),
      slot: equipmentSlot(source.slot, 'action.slot'),
    }
  }
  if (type === 'transfer') {
    onlyKeys(source, 'action', ['type', 'direction', 'itemId'])
    const direction = limitedString(source.direction, 'action.direction', 32)
    if (direction !== 'to-backpack' && direction !== 'to-storage') {
      throw new GameProtocolError('action.direction is not supported')
    }
    return {
      type,
      direction,
      itemId: positiveInteger(source.itemId, 'action.itemId'),
    }
  }
  if (type === 'unequip') {
    onlyKeys(source, 'action', ['type', 'slot'])
    return { type, slot: equipmentSlot(source.slot, 'action.slot') }
  }
  throw new GameProtocolError('unknown hub inventory action')
}

function equipmentSlot(value: unknown, field: string): EquipmentSlot {
  const slot = limitedString(value, field, 16)
  if (!(EQUIPMENT_SLOTS as readonly string[]).includes(slot)) {
    throw new GameProtocolError(`${field} is not supported`)
  }
  return slot as EquipmentSlot
}

function playerState(value: unknown, field: string): ProtocolPlayerState {
  const player = playerSnapshotFrame(value, field)
  if (!player.economy) throw new GameProtocolError(`${field}.economy is required`)
  return { ...player, economy: player.economy }
}

function playerSnapshotFrame(value: unknown, field: string): ProtocolPlayerSnapshotFrame {
  const source = record(value, field)
  onlyKeys(source, field, [
    'config',
    'economy',
    'footstepTick',
    'gaitDegrees',
    'headingIndex',
    'lighting',
    'position',
    'primaryCast',
    'progression',
    'velocity',
    'walkCyclePrimary',
  ])
  const config = playerCharacterConfig(source.config, `${field}.config`)
  const economy = source.economy === undefined
    ? undefined
    : playerEconomy(source.economy, `${field}.economy`)
  const primaryCast = playerPrimaryCastState(
    source.primaryCast,
    `${field}.primaryCast`,
    config.element,
  )
  const progression = playerProgression(source.progression, `${field}.progression`)
  const lighting = playerLighting(source.lighting, `${field}.lighting`)
  if (lighting.driveActive !== playerLightDriveActive(primaryCast, progression.lifeState)) {
    throw new GameProtocolError(`${field}.lighting.driveActive is inconsistent with player state`)
  }
  return {
    config,
    ...(economy ? { economy } : {}),
    footstepTick: nonnegativeInteger(source.footstepTick, `${field}.footstepTick`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    lighting,
    position: vector(source.position, `${field}.position`),
    primaryCast,
    progression,
    velocity: vector(source.velocity, `${field}.velocity`),
    walkCyclePrimary: finite(source.walkCyclePrimary, `${field}.walkCyclePrimary`),
  }
}

function playerEconomy(value: unknown, field: string): ProtocolPlayerEconomy {
  const source = record(value, field)
  onlyKeys(source, field, [
    'backpack',
    'charmCapacity',
    'dowsingFee',
    'dowsingOffers',
    'equipment',
    'fomentiusStock',
    'gold',
    'hagathaOffers',
    'ownedPerkSelectors',
    'revision',
    'storage',
    'tonicPurchases',
  ])
  const backpack = inventoryItems(source.backpack, `${field}.backpack`, 28)
  const storage = inventoryItems(source.storage, `${field}.storage`, 28)
  const equipment = playerEquipment(source.equipment, `${field}.equipment`)
  const fomentiusStock = limitedArray(
    source.fomentiusStock,
    `${field}.fomentiusStock`,
    24,
  ).map((item, index) => shopItem(item, `${field}.fomentiusStock[${index}]`))
  const allItemIds = [
    ...backpack,
    ...storage,
    ...fomentiusStock,
    ...equippedItems(equipment),
  ].map(({ id }) => id)
  if (new Set(allItemIds).size !== allItemIds.length) {
    throw new GameProtocolError(`${field} contains a duplicate item id`)
  }
  const dowsingOffers = limitedArray(
    source.dowsingOffers,
    `${field}.dowsingOffers`,
    4,
  ).map((offer, index) => dowsingOffer(offer, `${field}.dowsingOffers[${index}]`))
  if (
    new Set(dowsingOffers.map(({ id }) => id)).size !== dowsingOffers.length
    || new Set(dowsingOffers.map(({ recipeIndex }) => recipeIndex)).size
      !== dowsingOffers.length
  ) throw new GameProtocolError(`${field}.dowsingOffers contains a duplicate`)
  const hagathaOffers = limitedArray(
    source.hagathaOffers,
    `${field}.hagathaOffers`,
    29,
  ).map((offer, index) => hagathaOffer(offer, `${field}.hagathaOffers[${index}]`))
  if (new Set(hagathaOffers.map(({ selector }) => selector)).size !== hagathaOffers.length) {
    throw new GameProtocolError(`${field}.hagathaOffers contains a duplicate selector`)
  }
  const ownedPerkSelectors = selectorArray(
    source.ownedPerkSelectors,
    `${field}.ownedPerkSelectors`,
  )
  const charmCapacity = integer(source.charmCapacity, `${field}.charmCapacity`)
  if (charmCapacity !== 3 && charmCapacity !== 6 && charmCapacity !== 9) {
    throw new GameProtocolError(`${field}.charmCapacity is invalid`)
  }
  const tonicPurchases = nonnegativeInteger(
    source.tonicPurchases,
    `${field}.tonicPurchases`,
  )
  if (tonicPurchases > 2 || charmCapacity !== 3 + tonicPurchases * 3) {
    throw new GameProtocolError(`${field}.tonicPurchases does not match charmCapacity`)
  }
  return {
    backpack,
    charmCapacity,
    dowsingFee: boundedInteger(source.dowsingFee, `${field}.dowsingFee`, 500, 950),
    dowsingOffers,
    equipment,
    fomentiusStock,
    gold: boundedInteger(source.gold, `${field}.gold`, 0, 10_000_000),
    hagathaOffers,
    ownedPerkSelectors,
    revision: nonnegativeInteger(source.revision, `${field}.revision`),
    storage,
    tonicPurchases,
  }
}

function inventoryItems(
  value: unknown,
  field: string,
  maximum: number,
): readonly HubInventoryItem[] {
  return limitedArray(value, field, maximum).map((item, index) => (
    inventoryItem(item, `${field}[${index}]`)
  ))
}

function inventoryItem(
  value: unknown,
  field: string,
  extraKeys: readonly string[] = [],
): HubInventoryItem {
  const source = record(value, field)
  onlyKeys(source, field, [
    'equipmentType',
    'iconRecords',
    'id',
    'kind',
    'name',
    'nativeSubtype',
    'nativeTypeId',
    'quantity',
    'rarity',
    'recipeIndex',
    ...extraKeys,
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(HUB_ITEM_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const equipmentType = source.equipmentType === null
    ? null
    : limitedString(source.equipmentType, `${field}.equipmentType`, 16)
  if (
    equipmentType !== null
    && !(EQUIPMENT_TYPES as readonly string[]).includes(equipmentType)
  ) throw new GameProtocolError(`${field}.equipmentType is not supported`)
  const recipeIndex = source.recipeIndex === null
    ? null
    : boundedInteger(
        source.recipeIndex,
        `${field}.recipeIndex`,
        0,
        DOWSING_EQUIPMENT_RECIPES.length - 1,
      )
  if ((kind === 'equipment') !== (equipmentType !== null && recipeIndex !== null)) {
    throw new GameProtocolError(`${field} equipment identity is inconsistent`)
  }
  const rarity = source.rarity === null
    ? null
    : limitedString(source.rarity, `${field}.rarity`, 8)
  if (rarity !== null && rarity !== 'Epic' && rarity !== 'Rare') {
    throw new GameProtocolError(`${field}.rarity is not supported`)
  }
  if ((kind === 'equipment') !== (rarity !== null)) {
    throw new GameProtocolError(`${field} rarity is inconsistent`)
  }
  const nativeSubtype = source.nativeSubtype === null
    ? null
    : boundedInteger(source.nativeSubtype, `${field}.nativeSubtype`, 0, 32)
  const iconRecords = limitedArray(source.iconRecords, `${field}.iconRecords`, 2)
    .map((recordIndex, index) => boundedInteger(
      recordIndex,
      `${field}.iconRecords[${index}]`,
      0,
      83,
    ))
  if (iconRecords.length < 1) throw new GameProtocolError(`${field}.iconRecords is empty`)
  return {
    equipmentType: equipmentType as EquipmentType | null,
    iconRecords,
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as HubItemKind,
    name: limitedString(source.name, `${field}.name`, 128),
    nativeSubtype,
    nativeTypeId: boundedInteger(source.nativeTypeId, `${field}.nativeTypeId`, 7001, 7012),
    quantity: boundedInteger(source.quantity, `${field}.quantity`, 1, 9_999),
    rarity,
    recipeIndex,
  }
}

function shopItem(value: unknown, field: string): HubShopItem {
  const source = record(value, field)
  return {
    ...inventoryItem(source, field, ['price']),
    price: boundedInteger(source.price, `${field}.price`, 1, 100_000),
  }
}

function playerEquipment(value: unknown, field: string): ProtocolPlayerEconomy['equipment'] {
  const source = record(value, field)
  onlyKeys(source, field, ['amulet', 'hat', 'rings', 'robe', 'weapon'])
  const nullableItem = (item: unknown, itemField: string) => item === null
    ? null
    : inventoryItem(item, itemField)
  const rings = array(source.rings, `${field}.rings`)
  if (rings.length !== 3) throw new GameProtocolError(`${field}.rings must contain three slots`)
  const equipment = {
    amulet: nullableItem(source.amulet, `${field}.amulet`),
    hat: nullableItem(source.hat, `${field}.hat`),
    rings: rings.map((item, index) => nullableItem(item, `${field}.rings[${index}]`)) as [
      HubInventoryItem | null,
      HubInventoryItem | null,
      HubInventoryItem | null,
    ],
    robe: nullableItem(source.robe, `${field}.robe`),
    weapon: nullableItem(source.weapon, `${field}.weapon`),
  }
  for (const [slot, item] of [
    ['amulet', equipment.amulet],
    ['hat', equipment.hat],
    ['ring-0', equipment.rings[0]],
    ['ring-1', equipment.rings[1]],
    ['ring-2', equipment.rings[2]],
    ['robe', equipment.robe],
    ['weapon', equipment.weapon],
  ] as const) {
    if (item && !equipmentSlotAccepts(slot, item.equipmentType)) {
      throw new GameProtocolError(`${field}.${slot} contains the wrong equipment type`)
    }
  }
  return equipment
}

function equipmentSlotAccepts(slot: EquipmentSlot, type: EquipmentType | null): boolean {
  if (slot === 'weapon') return type === 'staff' || type === 'wand'
  if (slot.startsWith('ring-')) return type === 'ring'
  return slot === type
}

function equippedItems(
  equipment: ProtocolPlayerEconomy['equipment'],
): readonly HubInventoryItem[] {
  return [
    equipment.amulet,
    equipment.hat,
    ...equipment.rings,
    equipment.robe,
    equipment.weapon,
  ].filter((item): item is HubInventoryItem => item !== null)
}

function dowsingOffer(value: unknown, field: string): DowsingOffer {
  const source = record(value, field)
  onlyKeys(source, field, ['id', 'price', 'recipeIndex'])
  const price = boundedInteger(source.price, `${field}.price`, 5_000, 5_700)
  if (price % 50 !== 0) throw new GameProtocolError(`${field}.price is not a 50-gold step`)
  return {
    id: positiveInteger(source.id, `${field}.id`),
    price,
    recipeIndex: boundedInteger(
      source.recipeIndex,
      `${field}.recipeIndex`,
      0,
      DOWSING_EQUIPMENT_RECIPES.length - 1,
    ),
  }
}

function hagathaOffer(value: unknown, field: string): HagathaOffer {
  const source = record(value, field)
  onlyKeys(source, field, [
    'basePrice',
    'behaviorFamily',
    'description',
    'members',
    'name',
    'price',
    'selector',
  ])
  const selector = integer(source.selector, `${field}.selector`)
  if (selector < -1 || selector >= HAGATHA_PERKS.length || selector === 8) {
    throw new GameProtocolError(`${field}.selector is unavailable`)
  }
  const members = selectorArray(source.members, `${field}.members`)
  if (members.length < 1 || (selector >= 0 && (members.length !== 1 || members[0] !== selector))) {
    throw new GameProtocolError(`${field}.members does not match selector`)
  }
  return {
    basePrice: positiveInteger(source.basePrice, `${field}.basePrice`),
    behaviorFamily: limitedString(source.behaviorFamily, `${field}.behaviorFamily`, 64),
    description: limitedString(source.description, `${field}.description`, 512),
    members,
    name: limitedString(source.name, `${field}.name`, 64),
    price: positiveInteger(source.price, `${field}.price`),
    selector,
  }
}

function selectorArray(value: unknown, field: string): readonly number[] {
  const selectors = limitedArray(value, field, 28).map((selector, index) => (
    boundedInteger(selector, `${field}[${index}]`, 0, 27)
  ))
  if (selectors.some((selector, index) => (
    selector === 8 || (index > 0 && selector <= selectors[index - 1]!)
  ))) throw new GameProtocolError(`${field} must be sorted, unique, and available`)
  return selectors
}

function playerLighting(
  value: unknown,
  field: string,
): ProtocolPlayerState['lighting'] {
  const source = record(value, field)
  onlyKeys(source, field, [
    'driveActive',
    'lightRegistration',
    'overlayEffectPhase',
  ])
  const overlayEffectPhase = finite(source.overlayEffectPhase, `${field}.overlayEffectPhase`)
  if (overlayEffectPhase < 0 || overlayEffectPhase > NATIVE_PLAYER_MAX_LIGHT_OVERLAY) {
    throw new GameProtocolError(`${field}.overlayEffectPhase is outside the native domain`)
  }
  return {
    driveActive: boolean(source.driveActive, `${field}.driveActive`),
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    overlayEffectPhase,
  }
}

function playerPrimaryCastState(
  value: unknown,
  field: string,
  element: PlayerCharacterConfig['element'],
): ProtocolPlayerState['primaryCast'] {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionTick',
    'aimDirection',
    'castSequence',
    'channelActive',
    'emissionSequence',
    'fizzleSequence',
    'held',
    'targetId',
    'underpowered',
  ])
  const actionTick = integer(source.actionTick, `${field}.actionTick`)
  const channelActive = boolean(source.channelActive, `${field}.channelActive`)
  if (channelActive && (actionTick < 0 || actionTick > 1)) {
    throw new GameProtocolError(`${field}.actionTick is outside the Staff Constant program`)
  }
  if (!channelActive && (actionTick < -1 || actionTick >= primaryCastActionEndTick(element))) {
    throw new GameProtocolError(`${field}.actionTick is outside the Staff Cast 1 program`)
  }
  const targetId = source.targetId === null
    ? null
    : limitedString(source.targetId, `${field}.targetId`, 256)
  if (element !== 'air' && targetId !== null) {
    throw new GameProtocolError(`${field}.targetId is only valid for Air`)
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
    fizzleSequence: nonnegativeInteger(
      source.fizzleSequence,
      `${field}.fizzleSequence`,
    ),
    held: boolean(source.held, `${field}.held`),
    targetId,
    underpowered: boolean(source.underpowered, `${field}.underpowered`),
  }
}

function playerProgression(value: unknown, field: string): ProtocolPlayerProgression {
  const source = record(value, field)
  onlyKeys(source, field, [
    'activeWeldBuildId',
    'coldSlowTicksRemaining',
    'currentHealth',
    'currentMana',
    'deferredSkillChoices',
    'dazzleTicksRemaining',
    'deathEpoch',
    'deathTick',
    'experience',
    'learnedSkills',
    'level',
    'lifeState',
    'maximumHealth',
    'maximumMana',
    'nextThreshold',
    'pendingOffer',
    'poisonDamagePerTick',
    'poisonTicksRemaining',
    'previousThreshold',
    'revision',
    'sorcerorsCharmAvailable',
  ])
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const maximumMana = positiveFinite(source.maximumMana, `${field}.maximumMana`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  const currentMana = finite(source.currentMana, `${field}.currentMana`)
  const poisonDamagePerTick = finite(
    source.poisonDamagePerTick,
    `${field}.poisonDamagePerTick`,
  )
  if (currentHealth < 0 || currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth is out of range`)
  }
  if (currentMana < 0 || currentMana > maximumMana) {
    throw new GameProtocolError(`${field}.currentMana is out of range`)
  }
  if (poisonDamagePerTick < 0) {
    throw new GameProtocolError(`${field}.poisonDamagePerTick is out of range`)
  }
  const coldSlowTicksRemaining = nonnegativeInteger(
    source.coldSlowTicksRemaining,
    `${field}.coldSlowTicksRemaining`,
  )
  if (coldSlowTicksRemaining > BOUNDED_ENEMY_COLD_SLOW_TICKS) {
    throw new GameProtocolError(`${field}.coldSlowTicksRemaining is out of range`)
  }
  const dazzleTicksRemaining = nonnegativeInteger(
    source.dazzleTicksRemaining,
    `${field}.dazzleTicksRemaining`,
  )
  if (dazzleTicksRemaining > NATIVE_WRAITH_DAZZLE_TICKS) {
    throw new GameProtocolError(`${field}.dazzleTicksRemaining is out of range`)
  }
  const level = positiveInteger(source.level, `${field}.level`)
  if (level > 75) throw new GameProtocolError(`${field}.level is out of range`)
  const experience = nonnegativeFinite(source.experience, `${field}.experience`)
  if (experience > 10_000_000) {
    throw new GameProtocolError(`${field}.experience is out of range`)
  }
  const learnedSkills = limitedArray(
    source.learnedSkills,
    `${field}.learnedSkills`,
    83,
  ).map((entry, index) => {
    const raw = array(entry, `${field}.learnedSkills[${index}]`)
    if (raw.length !== 3) {
      throw new GameProtocolError(`${field}.learnedSkills[${index}] must have three fields`)
    }
    const skillId = nonnegativeInteger(raw[0], `${field}.learnedSkills[${index}][0]`)
    const permanentRank = nonnegativeInteger(raw[1], `${field}.learnedSkills[${index}][1]`)
    const effectiveRank = nonnegativeInteger(raw[2], `${field}.learnedSkills[${index}][2]`)
    if (skillId > 82 || permanentRank > 255 || effectiveRank > 255) {
      throw new GameProtocolError(`${field}.learnedSkills[${index}] is out of range`)
    }
    return [skillId, permanentRank, effectiveRank] as const
  })
  if (learnedSkills.some((entry, index) => index > 0 && entry[0] <= learnedSkills[index - 1]![0])) {
    throw new GameProtocolError(`${field}.learnedSkills must be unique and sorted`)
  }
  const activeWeldBuildId = source.activeWeldBuildId === null
    ? null
    : integer(source.activeWeldBuildId, `${field}.activeWeldBuildId`)
  if (activeWeldBuildId !== null && (activeWeldBuildId < 1000 || activeWeldBuildId > 1009)) {
    throw new GameProtocolError(`${field}.activeWeldBuildId is out of range`)
  }
  const spellWeldingRank = learnedSkills.find(([skillId]) => skillId === 52)?.[1] ?? 0
  if ((activeWeldBuildId === null) !== (spellWeldingRank === 0)) {
    throw new GameProtocolError(`${field}.activeWeldBuildId does not match Spell Welding`)
  }
  const lifeState = limitedString(source.lifeState, `${field}.lifeState`, 32)
  if (!(PLAYER_LIFE_STATES as readonly string[]).includes(lifeState)) {
    throw new GameProtocolError(`${field}.lifeState is not supported`)
  }
  return {
    activeWeldBuildId,
    coldSlowTicksRemaining,
    currentHealth,
    currentMana,
    deferredSkillChoices: nonnegativeInteger(
      source.deferredSkillChoices,
      `${field}.deferredSkillChoices`,
    ),
    dazzleTicksRemaining,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    experience,
    learnedSkills,
    level,
    lifeState: lifeState as PlayerLifeState,
    maximumHealth,
    maximumMana,
    nextThreshold: nonnegativeInteger(source.nextThreshold, `${field}.nextThreshold`),
    pendingOffer: source.pendingOffer === null
      ? null
      : playerSkillOffer(source.pendingOffer, `${field}.pendingOffer`, level),
    poisonDamagePerTick,
    poisonTicksRemaining: nonnegativeInteger(
      source.poisonTicksRemaining,
      `${field}.poisonTicksRemaining`,
    ),
    previousThreshold: nonnegativeInteger(
      source.previousThreshold,
      `${field}.previousThreshold`,
    ),
    revision: nonnegativeInteger(source.revision, `${field}.revision`),
    sorcerorsCharmAvailable: boolean(
      source.sorcerorsCharmAvailable,
      `${field}.sorcerorsCharmAvailable`,
    ),
  }
}

function playerSkillOffer(value: unknown, field: string, playerLevel: number) {
  const source = record(value, field)
  onlyKeys(source, field, ['level', 'options', 'sequence'])
  const level = positiveInteger(source.level, `${field}.level`)
  if (level > playerLevel) throw new GameProtocolError(`${field}.level is ahead of the player`)
  const options = limitedArray(source.options, `${field}.options`, 4)
  if (options.length !== 3 && options.length !== 4) {
    throw new GameProtocolError(`${field}.options must contain three or four choices`)
  }
  return {
    level,
    options: options.map((option, index) => {
      const optionField = `${field}.options[${index}]`
      const row = record(option, optionField)
      onlyKeys(row, optionField, ['skillId', 'targetRank', 'weldBuildId'])
      const skillId = nonnegativeInteger(row.skillId, `${optionField}.skillId`)
      if (skillId < 8 || skillId > 79) {
        throw new GameProtocolError(`${optionField}.skillId is out of range`)
      }
      const targetRank = positiveInteger(row.targetRank, `${optionField}.targetRank`)
      if (targetRank > 255) {
        throw new GameProtocolError(`${optionField}.targetRank is out of range`)
      }
      const weldBuildId = row.weldBuildId === undefined
        ? undefined
        : integer(row.weldBuildId, `${optionField}.weldBuildId`)
      if (skillId === 52) {
        if (targetRank !== 1 || weldBuildId === undefined) {
          throw new GameProtocolError(`${optionField} is not a valid Spell Welding choice`)
        }
        if (weldBuildId < 1000 || weldBuildId > 1009) {
          throw new GameProtocolError(`${optionField}.weldBuildId is out of range`)
        }
      } else if (weldBuildId !== undefined) {
        throw new GameProtocolError(`${optionField}.weldBuildId requires Spell Welding`)
      }
      return {
        skillId,
        targetRank,
        ...(weldBuildId === undefined ? {} : { weldBuildId }),
      }
    }),
    sequence: nonnegativeInteger(source.sequence, `${field}.sequence`),
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

function boneyardBounds(value: unknown, field: string): BoneyardBounds {
  const source = record(value, field)
  onlyKeys(source, field, ['h', 'w', 'x', 'y'])
  return {
    h: positiveFinite(source.h, `${field}.h`),
    w: positiveFinite(source.w, `${field}.w`),
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
}

function boneyardArenaTransition(
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
    'traderAnimationSeed',
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
    traderAnimationSeed: nonnegativeInteger(
      source.traderAnimationSeed,
      `${field}.traderAnimationSeed`,
    ),
  }
}

function playerLevelUpBarrier(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  run: GameRunLifecycleState,
): NonNullable<GameSnapshot['levelUpBarrier']> {
  const source = record(value, field)
  onlyKeys(source, field, [
    'barrierId',
    'milestoneExperience',
    'milestoneLevel',
    'participantIds',
    'pendingPlayerIds',
    'runId',
    'sourcePlayerId',
  ])
  const participantIds = validatedBarrierPlayerIds(
    source.participantIds,
    `${field}.participantIds`,
    players,
  )
  if (participantIds.length === 0) {
    throw new GameProtocolError(`${field}.participantIds must not be empty`)
  }
  const pendingPlayerIds = validatedBarrierPlayerIds(
    source.pendingPlayerIds,
    `${field}.pendingPlayerIds`,
    players,
  )
  if (pendingPlayerIds.length === 0) {
    throw new GameProtocolError(`${field}.pendingPlayerIds must not be empty`)
  }
  if (pendingPlayerIds.some((playerId) => !participantIds.includes(playerId))) {
    throw new GameProtocolError(`${field}.pendingPlayerIds must belong to the cohort`)
  }
  for (const playerId of pendingPlayerIds) {
    if (players[playerId]?.progression.pendingOffer === null) {
      throw new GameProtocolError(`${field} pending player has no skill offer`)
    }
  }
  const sourcePlayerId = validatedPlayerId(source.sourcePlayerId, `${field}.sourcePlayerId`)
  if (!participantIds.includes(sourcePlayerId)) {
    throw new GameProtocolError(`${field}.sourcePlayerId must belong to the cohort`)
  }
  const runId = source.runId === null
    ? null
    : limitedString(source.runId, `${field}.runId`, 256)
  const expectedRunId = run.phase === 'active' ? run.runId : null
  if (runId !== expectedRunId) {
    throw new GameProtocolError(`${field}.runId does not match the active run`)
  }
  const milestoneExperience = nonnegativeFinite(
    source.milestoneExperience,
    `${field}.milestoneExperience`,
  )
  if (milestoneExperience > 10_000_000) {
    throw new GameProtocolError(`${field}.milestoneExperience is out of range`)
  }
  const milestoneLevel = positiveInteger(source.milestoneLevel, `${field}.milestoneLevel`)
  if (milestoneLevel > 75) {
    throw new GameProtocolError(`${field}.milestoneLevel is out of range`)
  }
  return {
    barrierId: positiveInteger(source.barrierId, `${field}.barrierId`),
    milestoneExperience,
    milestoneLevel,
    participantIds,
    pendingPlayerIds,
    runId,
    sourcePlayerId,
  }
}

function validatedBarrierPlayerIds(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
): readonly string[] {
  const playerIds = limitedArray(value, field, MAX_PLAYERS).map((entry, index) => (
    validatedPlayerId(entry, `${field}[${index}]`)
  ))
  if (playerIds.some((playerId, index) => (
    !players[playerId] || (index > 0 && playerId <= playerIds[index - 1]!)
  ))) {
    throw new GameProtocolError(`${field} must be sorted, unique, and present in players`)
  }
  return playerIds
}

function gameSnapshot(value: unknown): GameSnapshot {
  const source = record(value, 'snapshot')
  onlyKeys(source, 'snapshot', [
    'hostPlayerId', 'levelUpBarrier', 'players', 'primarySpells', 'run', 'tick', 'world',
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
  const tick = nonnegativeInteger(source.tick, 'snapshot.tick')
  const world = gameWorldSnapshot(source.world, 'snapshot.world', tick)
  const run = gameRunLifecycle(source.run, 'snapshot.run')
  const levelUpBarrier = source.levelUpBarrier === null
    ? null
    : playerLevelUpBarrier(source.levelUpBarrier, 'snapshot.levelUpBarrier', players, run)
  validateGameRunWorld(run, world, 'snapshot')
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
    levelUpBarrier,
    players,
    primarySpells,
    run,
    tick,
    world,
  }
}

function gameSnapshotFrame(value: unknown): GameSnapshotFrame {
  const source = record(value, 'frame')
  onlyKeys(source, 'frame', [
    'hostPlayerId', 'levelUpBarrier', 'players', 'primarySpells', 'run', 'tick', 'world',
  ])
  const rawPlayers = record(source.players, 'frame.players')
  if (Object.keys(rawPlayers).length > MAX_PLAYERS) {
    throw new GameProtocolError(`frame.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const players: Record<string, ProtocolPlayerSnapshotFrame> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayers)) {
    const playerId = validatedPlayerId(rawPlayerId, 'frame player id')
    players[playerId] = playerSnapshotFrame(state, `frame.players.${playerId}`)
  }
  const hostPlayerId = source.hostPlayerId === null
    ? null
    : validatedPlayerId(source.hostPlayerId, 'frame.hostPlayerId')
  if (hostPlayerId !== null && !players[hostPlayerId]) {
    throw new GameProtocolError('frame.hostPlayerId is not present in frame.players')
  }
  const tick = nonnegativeInteger(source.tick, 'frame.tick')
  const world = gameWorldSnapshotFrame(source.world, 'frame.world', tick)
  const run = gameRunLifecycle(source.run, 'frame.run')
  const levelUpBarrier = source.levelUpBarrier === null
    ? null
    : playerLevelUpBarrier(source.levelUpBarrier, 'frame.levelUpBarrier', players, run)
  validateGameRunWorld(run, world, 'frame')
  const primarySpells = primarySpellState(source.primarySpells, 'frame.primarySpells')
  validatePrimarySpellOwners(primarySpells, players, 'frame.primarySpells')
  if (world.kind === 'hub') validateParticipantOwnership(world.participants, players, 'frame')
  return {
    hostPlayerId,
    levelUpBarrier,
    players,
    primarySpells,
    run,
    tick,
    world,
  }
}

function gameRunLifecycle(value: unknown, field: string): GameRunLifecycleState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'eligiblePlayerIds',
    'gameOverEventId',
    'gameOverTicks',
    'lastCompletedRunId',
    'nextGameOverEventId',
    'phase',
    'runId',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(GAME_RUN_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const eligiblePlayerIds = limitedArray(
    source.eligiblePlayerIds,
    `${field}.eligiblePlayerIds`,
    MAX_PLAYERS,
  ).map((playerId, index) => validatedPlayerId(
    playerId,
    `${field}.eligiblePlayerIds[${index}]`,
  ))
  if (eligiblePlayerIds.some((playerId, index) => (
    index > 0 && playerId <= eligiblePlayerIds[index - 1]!
  ))) throw new GameProtocolError(`${field}.eligiblePlayerIds must be unique and sorted`)
  const runId = source.runId === null
    ? null
    : limitedString(source.runId, `${field}.runId`, 128)
  const lastCompletedRunId = source.lastCompletedRunId === null
    ? null
    : limitedString(source.lastCompletedRunId, `${field}.lastCompletedRunId`, 128)
  const gameOverEventId = nonnegativeInteger(
    source.gameOverEventId,
    `${field}.gameOverEventId`,
  )
  const nextGameOverEventId = positiveInteger(
    source.nextGameOverEventId,
    `${field}.nextGameOverEventId`,
  )
  if (gameOverEventId >= nextGameOverEventId) {
    throw new GameProtocolError(`${field}.gameOverEventId is not allocated`)
  }
  if ((phase === 'active' || phase === 'game-over') !== (runId !== null)) {
    throw new GameProtocolError(`${field}.runId does not match phase`)
  }
  if ((phase === 'hub' || phase === 'active') && gameOverEventId !== 0) {
    throw new GameProtocolError(`${field}.gameOverEventId requires a completed run`)
  }
  return {
    eligiblePlayerIds,
    gameOverEventId,
    gameOverTicks: nonnegativeInteger(source.gameOverTicks, `${field}.gameOverTicks`),
    lastCompletedRunId,
    nextGameOverEventId,
    phase: phase as GameRunPhase,
    runId,
  }
}

function validateGameRunWorld(
  run: GameRunLifecycleState,
  world: GameSnapshot['world'] | GameSnapshotFrame['world'],
  field: string,
): void {
  if (run.phase === 'active' || run.phase === 'game-over') {
    if (world.kind !== 'boneyard' || world.runId !== run.runId) {
      throw new GameProtocolError(`${field}.run does not match its Boneyard world`)
    }
  } else if (world.kind !== 'hub') {
    throw new GameProtocolError(`${field}.run requires a Hub world outside a run`)
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
  if (source.kind !== 'earth' && source.kind !== 'ether' && source.kind !== 'fire') {
    throw new GameProtocolError(`${field}.kind is not a projectile primary`)
  }
  onlyKeys(source, field, [
    'ageTicks', 'charge', 'damage', 'direction', 'flightTicks', 'id', 'kind',
    'lightRegistration', 'ownerId', 'phase', 'position', 'velocity', 'worldKey',
    ...(source.kind === 'earth' ? ['assemblyCharge', 'hitTargetIds', 'orientation'] : []),
    ...(source.kind === 'ether'
      ? ['headingDegrees', 'targetId', 'turnAccumulator', 'underpowered']
      : []),
    ...(source.kind === 'fire' ? ['underpowered'] : []),
  ])
  if (source.phase !== 'flight' && source.phase !== 'held') {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const phase: PrimarySpellProjectilePhase = source.phase
  if (phase === 'held' && source.kind !== 'earth') {
    throw new GameProtocolError(`${field} only permits held Earth actors`)
  }
  const charge = finite(source.charge, `${field}.charge`)
  if (charge < 0 || charge > 1) {
    throw new GameProtocolError(`${field}.charge must be within [0,1]`)
  }
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const flightTicks = nonnegativeInteger(source.flightTicks, `${field}.flightTicks`)
  if (phase === 'held' && flightTicks !== 0) {
    throw new GameProtocolError(`${field}.flightTicks must be zero while held`)
  }
  if (phase === 'flight' && (flightTicks < 1 || flightTicks > ageTicks)) {
    throw new GameProtocolError(`${field}.flightTicks is outside the actor age`)
  }
  const damage = nonnegativeFinite(source.damage, `${field}.damage`)
  if ((source.kind !== 'earth' || phase === 'flight') && damage <= 0) {
    throw new GameProtocolError(`${field}.damage must be positive in flight`)
  }
  const projectile = {
    ageTicks,
    charge,
    damage,
    direction: unitVector(source.direction, `${field}.direction`),
    flightTicks,
    id: positiveInteger(source.id, `${field}.id`),
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    phase,
    position: vector(source.position, `${field}.position`),
    velocity: vector(source.velocity, `${field}.velocity`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
  if (source.kind === 'earth') {
    const assemblyCharge = finite(source.assemblyCharge, `${field}.assemblyCharge`)
    if (
      assemblyCharge < PRIMARY_SPELL_EARTH_INITIAL_CHARGE
      || assemblyCharge > charge
      || Math.floor(30 * assemblyCharge) !== Math.floor(30 * charge)
    ) {
      throw new GameProtocolError(
        `${field}.assemblyCharge is outside the current native rebuild bucket`,
      )
    }
    if (!Array.isArray(source.orientation) || source.orientation.length !== 9) {
      throw new GameProtocolError(`${field}.orientation must contain nine float32 values`)
    }
    const orientation = source.orientation.map((value, index) => {
      const component = finite(value, `${field}.orientation[${index}]`)
      if (component !== Math.fround(component)) {
        throw new GameProtocolError(`${field}.orientation[${index}] must be float32`)
      }
      return component
    }) as unknown as PrimarySpellEarthProjectileState['orientation']
    const hitTargetIds = limitedArray(
      source.hitTargetIds,
      `${field}.hitTargetIds`,
      MAX_PRIMARY_SPELL_HIT_TARGETS,
    ).map((targetId, index) => limitedString(
      targetId,
      `${field}.hitTargetIds[${index}]`,
      256,
    ))
    if (new Set(hitTargetIds).size !== hitTargetIds.length) {
      throw new GameProtocolError(`${field}.hitTargetIds contains a duplicate target`)
    }
    return {
      ...projectile,
      assemblyCharge,
      hitTargetIds,
      kind: 'earth',
      orientation,
    } satisfies PrimarySpellEarthProjectileState
  }
  if (source.kind === 'ether') {
    const headingDegrees = finite(source.headingDegrees, `${field}.headingDegrees`)
    if (headingDegrees < 0 || headingDegrees >= 360) {
      throw new GameProtocolError(`${field}.headingDegrees is outside [0,360)`)
    }
    const turnAccumulator = finite(source.turnAccumulator, `${field}.turnAccumulator`)
    if (turnAccumulator < ETHER_PRIMARY_INITIAL_TURN || turnAccumulator > 10) {
      throw new GameProtocolError(
        `${field}.turnAccumulator is outside [${ETHER_PRIMARY_INITIAL_TURN},10]`,
      )
    }
    return {
      ...projectile,
      headingDegrees,
      kind: 'ether',
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      turnAccumulator,
      underpowered: boolean(source.underpowered, `${field}.underpowered`),
    }
  }
  return {
    ...projectile,
    kind: 'fire',
    underpowered: boolean(source.underpowered, `${field}.underpowered`),
  }
}

function primarySpellTransient(value: unknown, field: string): PrimarySpellTransientState {
  const source = record(value, field)
  if (source.kind === 'earth-called-rock') {
    onlyKeys(source, field, [
      'ageTicks', 'fallVelocity', 'falling', 'height', 'id', 'kind',
      'lateralMagnitude', 'lightRegistration', 'ownerId', 'parentId', 'position', 'rotation',
      'rotationStep', 'scale', 'speed', 'targetHeight', 'variant', 'worldKey',
    ])
    const fallVelocity = finite(source.fallVelocity, `${field}.fallVelocity`)
    if (fallVelocity < 0) throw new GameProtocolError(`${field}.fallVelocity is negative`)
    const lateralMagnitude = finite(source.lateralMagnitude, `${field}.lateralMagnitude`)
    if (lateralMagnitude < 0 || lateralMagnitude > 4) {
      throw new GameProtocolError(`${field}.lateralMagnitude is outside [0,4]`)
    }
    const rotationStep = finite(source.rotationStep, `${field}.rotationStep`)
    if (rotationStep < -30 || rotationStep > 30) {
      throw new GameProtocolError(`${field}.rotationStep is outside [-30,30]`)
    }
    const scale = finite(source.scale, `${field}.scale`)
    if (scale < 0 || scale > 0.75 * 0.75) {
      throw new GameProtocolError(`${field}.scale exceeds the native called-rock range`)
    }
    const speed = finite(source.speed, `${field}.speed`)
    if (speed < 0 || speed > 5) {
      throw new GameProtocolError(`${field}.speed is outside [0,5]`)
    }
    const variant = nonnegativeInteger(source.variant, `${field}.variant`)
    if (variant > 2) throw new GameProtocolError(`${field}.variant exceeds the lit-rock bank`)
    const falling = boolean(source.falling, `${field}.falling`)
    if (!falling && fallVelocity !== 0) {
      throw new GameProtocolError(`${field}.fallVelocity must be zero before release`)
    }
    const id = positiveInteger(source.id, `${field}.id`)
    const parentId = positiveInteger(source.parentId, `${field}.parentId`)
    if (parentId >= id) {
      throw new GameProtocolError(`${field}.parentId must precede the called-rock identity`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      fallVelocity,
      falling,
      height: finite(source.height, `${field}.height`),
      id,
      kind: 'earth-called-rock',
      lateralMagnitude,
      lightRegistration: absentNativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
      ),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      parentId,
      position: vector(source.position, `${field}.position`),
      rotation: finite(source.rotation, `${field}.rotation`),
      rotationStep,
      scale,
      speed,
      targetHeight: finite(source.targetHeight, `${field}.targetHeight`),
      variant,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'earth-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'charge', 'id', 'kind', 'origin', 'ownerId',
      'lightRegistration', 'lifetimeTicks', 'worldKey',
    ])
    const charge = finite(source.charge, `${field}.charge`)
    if (charge < 0 || charge > 1) {
      throw new GameProtocolError(`${field}.charge must be within [0,1]`)
    }
    const birthTick = nonnegativeInteger(source.birthTick, `${field}.birthTick`)
    const id = positiveInteger(source.id, `${field}.id`)
    const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
    const expectedLifetime = earthImpactLifetimeTicks({ birthTick, charge, id })
    if (lifetimeTicks !== expectedLifetime) {
      throw new GameProtocolError(`${field}.lifetimeTicks does not match the native recurrence`)
    }
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= lifetimeTicks) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the impact lifetime`)
    }
    return {
      ageTicks,
      birthTick,
      charge,
      id,
      kind: 'earth-impact',
      lightRegistration: absentNativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
      ),
      lifetimeTicks,
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'ether-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'id', 'kind', 'lightRegistration', 'origin', 'ownerId',
      'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Ether impact lifetime`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'ether-impact',
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'id', 'kind', 'lightRegistration', 'origin', 'ownerId', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_FIRE_IMPACT_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Fire impact lifetime`)
    }
    return {
      ageTicks,
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-impact',
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  const transientKeys = [
    'ageTicks', 'direction', 'id', 'kind', 'lightRegistration', 'origin', 'ownerId', 'variant',
    'worldKey',
  ]
  onlyKeys(
    source,
    field,
    source.kind === 'water'
      ? [...transientKeys, 'obstructionDistance', 'obstructionPoint', 'underpowered']
      : source.kind === 'air'
        ? [...transientKeys, 'birthTick', 'endpoint', 'midpoint', 'targetId', 'underpowered']
      : transientKeys,
  )
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
  const common = {
    ageTicks,
    direction: unitVector(source.direction, `${field}.direction`),
    id,
    origin: vector(source.origin, `${field}.origin`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    variant,
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
  if (source.kind === 'water') {
    const underpowered = boolean(source.underpowered, `${field}.underpowered`)
    if (variant > 1) {
      throw new GameProtocolError(`${field}.variant exceeds the two-per-tick ordinal`)
    }
    if (ageTicks < 1 || ageTicks >= waterFrostJetLifetimeTicks(id)) {
      throw new GameProtocolError(`${field}.ageTicks is outside its visible Frost lifetime`)
    }
    const obstructionPoint = source.obstructionPoint === null
      ? null
      : vector(source.obstructionPoint, `${field}.obstructionPoint`)
    const obstructionDistance = source.obstructionDistance === null
      ? null
      : nonnegativeFinite(source.obstructionDistance, `${field}.obstructionDistance`)
    if ((obstructionPoint === null) !== (obstructionDistance === null)) {
      throw new GameProtocolError(
        `${field}.obstructionPoint and obstructionDistance must be present together`,
      )
    }
    if (waterFrostJetKind(id, underpowered) === 'over' && obstructionPoint !== null) {
      throw new GameProtocolError(`${field} Over particles cannot own obstruction state`)
    }
    return {
      ...common,
      kind: 'water',
      lightRegistration: absentNativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
      ),
      obstructionDistance,
      obstructionPoint,
      underpowered,
    }
  }
  if (source.kind === 'air') {
    const underpowered = boolean(source.underpowered, `${field}.underpowered`)
    const lifetimeTicks = underpowered
      ? PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS
      : PRIMARY_SPELL_AIR_LIFETIME_TICKS
    if (ageTicks >= lifetimeTicks) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Air contact lifetime`)
    }
    return {
      ...common,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      endpoint: vector(source.endpoint, `${field}.endpoint`),
      kind: 'air',
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      midpoint: vector(source.midpoint, `${field}.midpoint`),
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      underpowered,
    }
  }
  return {
    ...common,
    kind: source.kind,
    lightRegistration: absentNativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
    ),
  }
}

function validatePrimarySpellOwners(
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

function gameWorldSnapshot(
  value: unknown,
  field: string,
  snapshotTick: number,
): GameSnapshot['world'] {
  const source = record(value, field)
  if (source.kind === 'hub') return hubWorldSnapshot(source, field)
  if (source.kind === 'boneyard') {
    onlyKeys(source, field, [
      'arenaTransition',
      'deathEffects',
      'encounter',
      'enemies',
      'enemyEvents',
      'enemyProjectileEffects',
      'enemyProjectiles',
      'gateLeaves',
      'kind',
      'lanternLightRegistration',
      'mageLightningPulses',
      'maggots',
      'runId',
      'waves',
    ])
    const encounter = boneyardSolomonSnapshot(source.encounter, `${field}.encounter`)
    const waves = boneyardWaveSnapshot(source.waves, `${field}.waves`)
    const arenaTransition = boneyardArenaTransition(
      source.arenaTransition,
      `${field}.arenaTransition`,
    )
    if (
      (encounter === null) !== (waves === null)
      || (encounter === null) !== (arenaTransition === null)
    ) {
      throw new GameProtocolError(
        `${field}.arenaTransition, ${field}.encounter, and ${field}.waves must share ownership`,
      )
    }
    const runId = limitedString(source.runId, `${field}.runId`, 128)
    const enemyEvents = boneyardEnemyEvents(
      source.enemyEvents,
      `${field}.enemyEvents`,
      runId,
      snapshotTick,
    )
    const mageLightningPulses = boneyardMageLightningPulses(
      source.mageLightningPulses,
      `${field}.mageLightningPulses`,
      snapshotTick,
    )
    const enemyIds = new Set<number>()
    const enemies = limitedArray(
      source.enemies,
      `${field}.enemies`,
      MAX_BONEYARD_ENEMIES,
    ).map((enemy, index) => {
      const decoded = boneyardEnemySnapshot(enemy, `${field}.enemies[${index}]`)
      if (enemyIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.enemies duplicates id ${decoded.id}`)
      }
      enemyIds.add(decoded.id)
      return decoded
    })
    const deathEffectIds = new Set<number>()
    const deathEffects = limitedArray(
      source.deathEffects,
      `${field}.deathEffects`,
      MAX_BONEYARD_ENEMY_DEATH_EFFECTS,
    ).map((effect, index) => {
      const decoded = boneyardEnemyDeathEffectSnapshot(
        effect,
        `${field}.deathEffects[${index}]`,
      )
      if (deathEffectIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.deathEffects duplicates id ${decoded.id}`)
      }
      deathEffectIds.add(decoded.id)
      return decoded
    })
    const projectileIds = new Set<number>()
    const enemyProjectiles = limitedArray(
      source.enemyProjectiles,
      `${field}.enemyProjectiles`,
      MAX_BONEYARD_ENEMY_PROJECTILES,
    ).map((projectile, index) => {
      const decoded = boneyardEnemyProjectileSnapshot(
        projectile,
        `${field}.enemyProjectiles[${index}]`,
      )
      if (projectileIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.enemyProjectiles duplicates id ${decoded.id}`)
      }
      projectileIds.add(decoded.id)
      return decoded
    })
    const projectileEffectIds = new Set<number>()
    const enemyProjectileEffects = limitedArray(
      source.enemyProjectileEffects,
      `${field}.enemyProjectileEffects`,
      MAX_BONEYARD_ENEMY_PROJECTILE_EFFECTS,
    ).map((effect, index) => {
      const decoded = boneyardEnemyProjectileEffectSnapshot(
        effect,
        `${field}.enemyProjectileEffects[${index}]`,
      )
      if (projectileEffectIds.has(decoded.id)) {
        throw new GameProtocolError(
          `${field}.enemyProjectileEffects duplicates id ${decoded.id}`,
        )
      }
      projectileEffectIds.add(decoded.id)
      return decoded
    })
    const maggotIds = new Set<number>()
    const maggots = limitedArray(
      source.maggots,
      `${field}.maggots`,
      MAX_BONEYARD_MAGGOTS,
    ).map((maggot, index) => {
      const decoded = boneyardMaggotSnapshot(maggot, `${field}.maggots[${index}]`)
      if (maggotIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.maggots duplicates id ${decoded.id}`)
      }
      maggotIds.add(decoded.id)
      return decoded
    })
    return {
      arenaTransition,
      deathEffects,
      encounter,
      enemies,
      enemyEvents,
      enemyProjectileEffects,
      enemyProjectiles,
      gateLeaves: limitedArray(
        source.gateLeaves,
        `${field}.gateLeaves`,
        MAX_BONEYARD_STRUCTURES * 2,
      ).map((leaf, index) => boneyardGateLeafSnapshot(
        leaf,
        `${field}.gateLeaves[${index}]`,
      )),
      kind: 'boneyard',
      lanternLightRegistration: nullableNativeLightProviderRegistration(
        source.lanternLightRegistration,
        `${field}.lanternLightRegistration`,
        'actor',
      ),
      mageLightningPulses,
      maggots,
      runId,
      waves,
    }
  }
  throw new GameProtocolError(`${field}.kind is not supported`)
}

function boneyardEnemyDeathEffectSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyDeathEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'height',
    'id',
    'kind',
    'ownerActorId',
    'position',
    'rotationRadians',
    'scale',
    'shadow',
    'spawnTick',
    'tint',
  ])
  const alpha = finite(source.alpha, `${field}.alpha`)
  const atlas = limitedString(source.atlas, `${field}.atlas`, 32)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg' && atlas !== 'Demon') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(BONEYARD_ENEMY_DEATH_EFFECT_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const entry = nonnegativeInteger(source.entry, `${field}.entry`)
  const maximumAlpha = atlas === 'BadGuys'
    && blendMode === 'add'
    && entry === 69
    && kind === 'fade'
    ? 1.25
    : 1
  if (alpha < 0 || alpha > maximumAlpha) {
    throw new GameProtocolError(`${field}.alpha must be within [0,${maximumAlpha}]`)
  }
  const tint = nonnegativeInteger(source.tint, `${field}.tint`)
  if (tint > 0xffffff) {
    throw new GameProtocolError(`${field}.tint must be a 24-bit RGB value`)
  }
  return {
    ageTicks: nonnegativeFinite(source.ageTicks, `${field}.ageTicks`),
    alpha,
    atlas,
    blendMode,
    entry,
    height: finite(source.height, `${field}.height`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as BoneyardEnemyDeathEffectSnapshot['kind'],
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    position: boneyardPoint(source.position, `${field}.position`),
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: positiveFinite(source.scale, `${field}.scale`),
    shadow: boolean(source.shadow, `${field}.shadow`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    tint,
  }
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
  return {
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

function boneyardEnemyEvents(
  value: unknown,
  field: string,
  runId: string,
  snapshotTick: number,
): BoneyardEnemyEventSnapshot[] {
  let previousEventId = 0
  let previousTick = -1
  return limitedArray(value, field, MAX_BONEYARD_ENEMY_EVENTS).map((event, index) => {
    const eventField = `${field}[${index}]`
    const source = record(event, eventField)
    const rawType = limitedString(source.type, `${eventField}.type`, 64)
    if (!(BONEYARD_ENEMY_EVENT_TYPES as readonly string[]).includes(rawType)) {
      throw new GameProtocolError(`${eventField}.type is not supported`)
    }
    const type = rawType as BoneyardEnemyEventSnapshot['type']
    const payloadKeys = (() => {
      switch (type) {
        case 'attack-marker':
        case 'enemy-spawned':
        case 'reward': return ['targetPlayerId']
        case 'coffin-maggot-release': return ['count']
        case 'enemy-death':
        case 'enemy-retired': return []
        case 'enemy-damage-sound':
        case 'enemy-death-sound': return [
          'gainScale',
          'pitch',
          'sound',
          'sourcePosition',
        ]
        case 'enemy-terminal-output': return ['count', 'output']
        case 'projectile-impact':
        case 'projectile-retired':
        case 'projectile-spawned': return ['projectileId', 'targetPlayerId']
      }
    })()
    onlyKeys(source, eventField, [
      'actorId',
      'eventId',
      'runId',
      'tick',
      'type',
      ...payloadKeys,
    ])
    const eventRunId = limitedString(source.runId, `${eventField}.runId`, 128)
    if (eventRunId !== runId) {
      throw new GameProtocolError(`${eventField}.runId does not match its Boneyard world`)
    }
    const eventId = positiveInteger(source.eventId, `${eventField}.eventId`)
    if (eventId <= previousEventId) {
      throw new GameProtocolError(`${field} eventIds must increase`)
    }
    const tick = nonnegativeInteger(source.tick, `${eventField}.tick`)
    if (tick < previousTick) {
      throw new GameProtocolError(`${field} ticks must not decrease`)
    }
    if (tick > snapshotTick) {
      throw new GameProtocolError(`${eventField}.tick exceeds its snapshot tick`)
    }
    previousEventId = eventId
    previousTick = tick
    const base = {
      actorId: positiveInteger(source.actorId, `${eventField}.actorId`),
      eventId,
      runId,
      tick,
      type,
    }
    switch (type) {
      case 'attack-marker':
      case 'enemy-spawned':
      case 'reward': return {
        ...base,
        targetPlayerId: nullablePlayerId(source.targetPlayerId, `${eventField}.targetPlayerId`),
      }
      case 'coffin-maggot-release': return {
        ...base,
        count: nonnegativeInteger(source.count, `${eventField}.count`),
      }
      case 'enemy-death':
      case 'enemy-retired': return base
      case 'enemy-damage-sound':
      case 'enemy-death-sound': {
        const sound = limitedString(source.sound, `${eventField}.sound`, 64)
        const supportedSounds = type === 'enemy-damage-sound'
          ? BONEYARD_ENEMY_DAMAGE_SOUNDS
          : BONEYARD_ENEMY_DEATH_SOUNDS
        if (!(supportedSounds as readonly string[]).includes(sound)) {
          throw new GameProtocolError(`${eventField}.sound is not supported`)
        }
        const pitch = positiveFinite(source.pitch, `${eventField}.pitch`)
        if (pitch > 2) {
          throw new GameProtocolError(`${eventField}.pitch must be within (0,2]`)
        }
        const gainScale = nonnegativeFinite(
          source.gainScale,
          `${eventField}.gainScale`,
        )
        if (gainScale > 1) {
          throw new GameProtocolError(`${eventField}.gainScale must be within [0,1]`)
        }
        return {
          ...base,
          gainScale,
          pitch,
          sound: sound as BoneyardEnemyEventSnapshot['sound'],
          sourcePosition: vector(source.sourcePosition, `${eventField}.sourcePosition`),
        }
      }
      case 'enemy-terminal-output': {
        const output = limitedString(source.output, `${eventField}.output`, 64)
        if (!(BONEYARD_ENEMY_TERMINAL_OUTPUTS as readonly string[]).includes(output)) {
          throw new GameProtocolError(`${eventField}.output is not supported`)
        }
        return {
          ...base,
          output: output as BoneyardEnemyEventSnapshot['output'],
          ...(source.count === undefined
            ? {}
            : { count: nonnegativeInteger(source.count, `${eventField}.count`) }),
        }
      }
      case 'projectile-impact':
      case 'projectile-retired':
      case 'projectile-spawned': return {
        ...base,
        projectileId: positiveInteger(source.projectileId, `${eventField}.projectileId`),
        targetPlayerId: nullablePlayerId(source.targetPlayerId, `${eventField}.targetPlayerId`),
      }
    }
  })
}

function boneyardMageLightningPulses(
  value: unknown,
  field: string,
  snapshotTick: number,
): BoneyardMageLightningPulseSnapshot[] {
  const pulses = limitedArray(
    value,
    field,
    MAX_BONEYARD_MAGE_LIGHTNING_PULSES,
  ).map((pulse, index): BoneyardMageLightningPulseSnapshot => {
    const pulseField = `${field}[${index}]`
    const source = record(pulse, pulseField)
    onlyKeys(source, pulseField, [
      'contact',
      'endpoint',
      'id',
      'midpoint',
      'ownerActorId',
      'seed',
      'source',
      'tick',
    ])
    const contactField = `${pulseField}.contact`
    const contactSource = record(source.contact, contactField)
    const kind = limitedString(contactSource.kind, `${contactField}.kind`, 32)
    const contact = (() => {
      if (kind === 'world') {
        onlyKeys(contactSource, contactField, ['kind', 'position'])
        return {
          kind: 'world' as const,
          position: vector(contactSource.position, `${contactField}.position`),
        }
      }
      if (kind === 'target-attached') {
        onlyKeys(contactSource, contactField, ['kind', 'localOffset', 'targetPlayerId'])
        return {
          kind: 'target-attached' as const,
          localOffset: vector(contactSource.localOffset, `${contactField}.localOffset`),
          targetPlayerId: validatedPlayerId(
            contactSource.targetPlayerId,
            `${contactField}.targetPlayerId`,
          ),
        }
      }
      throw new GameProtocolError(`${contactField}.kind is not supported`)
    })()
    const seed = nonnegativeInteger(source.seed, `${pulseField}.seed`)
    if (seed > 0xffff_ffff) {
      throw new GameProtocolError(`${pulseField}.seed must be an unsigned 32-bit integer`)
    }
    return {
      contact,
      endpoint: vector(source.endpoint, `${pulseField}.endpoint`),
      id: positiveInteger(source.id, `${pulseField}.id`),
      midpoint: vector(source.midpoint, `${pulseField}.midpoint`),
      ownerActorId: positiveInteger(source.ownerActorId, `${pulseField}.ownerActorId`),
      seed,
      source: vector(source.source, `${pulseField}.source`),
      tick: nonnegativeInteger(source.tick, `${pulseField}.tick`),
    }
  })
  validateBoneyardMageLightningPulseSequence(pulses, field, snapshotTick)
  return pulses
}

function validateBoneyardMageLightningPulseSequence(
  pulses: readonly BoneyardMageLightningPulseSnapshot[],
  field: string,
  snapshotTick: number,
): void {
  let previousId = 0
  let previousTick = -1
  pulses.forEach((pulse, index) => {
    const pulseField = `${field}[${index}]`
    if (pulse.id <= previousId) {
      throw new GameProtocolError(`${field} ids must increase`)
    }
    if (pulse.tick < previousTick) {
      throw new GameProtocolError(`${field} ticks must not decrease`)
    }
    if (pulse.tick > snapshotTick) {
      throw new GameProtocolError(`${pulseField}.tick exceeds its snapshot tick`)
    }
    if (snapshotTick - pulse.tick >= NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES) {
      throw new GameProtocolError(`${pulseField} exceeds the live pulse age limit`)
    }
    previousId = pulse.id
    previousTick = pulse.tick
  })
}

function boneyardMageLightningPulseFrames(
  value: unknown,
  field: string,
  snapshotTick: number,
): BoneyardMageLightningPulseFrame[] {
  const frames = limitedArray(
    value,
    field,
    MAX_BONEYARD_MAGE_LIGHTNING_PULSES,
  ).map((frame, index) => {
    if (!boneyardMageLightningPulseFrameIsValid(frame)) {
      throw new GameProtocolError(`${field}[${index}] is not a valid compact pulse`)
    }
    return [...frame] as BoneyardMageLightningPulseFrame
  })
  validateBoneyardMageLightningPulseSequence(
    frames.map(materializeBoneyardMageLightningPulse),
    field,
    snapshotTick,
  )
  return frames
}

function nullablePlayerId(value: unknown, field: string): string | null {
  return value === null ? null : validatedPlayerId(value, field)
}

function boneyardEnemySnapshot(value: unknown, field: string): BoneyardEnemySnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'animation',
    'armored',
    'currentHealth',
    'enemyToken',
    'flags',
    'headingDeg',
    'id',
    'lightRegistration',
    'lighting',
    'maximumHealth',
    'nativeTypeId',
    'position',
    'shieldHealth',
    'shieldMaximumHealth',
    'spawnTick',
  ])
  const enemyToken = limitedString(source.enemyToken, `${field}.enemyToken`, 32)
  const expectedTypeId = BONEYARD_WAVE_ENEMY_TYPES[
    enemyToken as keyof typeof BONEYARD_WAVE_ENEMY_TYPES
  ]
  if (expectedTypeId === undefined) {
    throw new GameProtocolError(`${field}.enemyToken is not supported`)
  }
  const nativeTypeId = positiveInteger(source.nativeTypeId, `${field}.nativeTypeId`)
  if (nativeTypeId !== expectedTypeId) {
    throw new GameProtocolError(`${field}.nativeTypeId does not match enemyToken`)
  }
  const flags = limitedArray(
    source.flags,
    `${field}.flags`,
    MAX_BONEYARD_ENEMY_FLAGS,
  ).map((flag, index) => {
    const decoded = limitedString(flag, `${field}.flags[${index}]`, 64)
    if (!(BONEYARD_ENEMY_FLAGS as readonly string[]).includes(decoded)) {
      throw new GameProtocolError(`${field}.flags[${index}] is not supported`)
    }
    return decoded
  })
  if (new Set(flags).size !== flags.length) {
    throw new GameProtocolError(`${field}.flags must be unique`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  if (currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth exceeds maximumHealth`)
  }
  const shieldHealth = nonnegativeFinite(source.shieldHealth, `${field}.shieldHealth`)
  const shieldMaximumHealth = nonnegativeFinite(
    source.shieldMaximumHealth,
    `${field}.shieldMaximumHealth`,
  )
  if (shieldHealth > shieldMaximumHealth) {
    throw new GameProtocolError(`${field}.shieldHealth exceeds shieldMaximumHealth`)
  }
  const armored = boolean(source.armored, `${field}.armored`)
  if (armored && enemyToken !== 'SKELETON') {
    throw new GameProtocolError(`${field}.armored is only valid for SKELETON`)
  }
  return {
    animation: boneyardEnemyAnimation(source.animation, `${field}.animation`),
    armored,
    currentHealth,
    enemyToken: enemyToken as BoneyardEnemySnapshot['enemyToken'],
    flags,
    headingDeg,
    id: positiveInteger(source.id, `${field}.id`),
    lightRegistration: enemyToken === 'ZOMBIE'
      ? absentNativeLightProviderRegistration(
          source.lightRegistration,
          `${field}.lightRegistration`,
        )
      : nativeLightProviderRegistration(
          source.lightRegistration,
          `${field}.lightRegistration`,
          'actor',
        ),
    lighting: boneyardEnemyLighting(source.lighting, `${field}.lighting`),
    maximumHealth,
    nativeTypeId,
    position: boneyardPoint(source.position, `${field}.position`),
    shieldHealth,
    shieldMaximumHealth,
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
  }
}

function boneyardEnemyLighting(
  value: unknown,
  field: string,
): BoneyardEnemySnapshot['lighting'] {
  const source = record(value, field)
  onlyKeys(source, field, ['charge', 'glow', 'providerCopies'])
  const charge = finite(source.charge, `${field}.charge`)
  const glow = finite(source.glow, `${field}.glow`)
  if (charge < 0 || charge > 1) {
    throw new GameProtocolError(`${field}.charge must be within [0,1]`)
  }
  if (glow < 0 || glow > 1) {
    throw new GameProtocolError(`${field}.glow must be within [0,1]`)
  }
  const providerCopies = nonnegativeInteger(
    source.providerCopies,
    `${field}.providerCopies`,
  )
  if (providerCopies > 2) {
    throw new GameProtocolError(`${field}.providerCopies must be within [0,2]`)
  }
  return { charge, glow, providerCopies: providerCopies as 0 | 1 | 2 }
}

function boneyardEnemyProjectileSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyProjectileSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'contactRadius',
    'headingDeg',
    'homing',
    'id',
    'kind',
    'lightRegistration',
    'lifetimeTicks',
    'nativeTypeId',
    'ownerActorId',
    'payload',
    'position',
    'speed',
    'spawnTick',
    'verticalOffset',
    'visualPhaseDeg',
    'visualScale',
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(kind in BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const nativeTypeId = positiveInteger(source.nativeTypeId, `${field}.nativeTypeId`)
  if (
    nativeTypeId
    !== BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES[kind as BoneyardEnemyProjectileKind]
  ) {
    throw new GameProtocolError(`${field}.nativeTypeId does not match kind`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  if (kind !== 'demon-bomb' && ageTicks > lifetimeTicks) {
    throw new GameProtocolError(`${field}.ageTicks exceeds lifetimeTicks`)
  }
  const speed = finite(source.speed, `${field}.speed`)
  if (speed < 0 || speed > 10) {
    throw new GameProtocolError(`${field}.speed is outside [0,10]`)
  }
  const verticalOffset = finite(source.verticalOffset, `${field}.verticalOffset`)
  if (verticalOffset > 0) {
    throw new GameProtocolError(`${field}.verticalOffset must be non-positive`)
  }
  const visualPhaseDeg = finite(source.visualPhaseDeg, `${field}.visualPhaseDeg`)
  if (visualPhaseDeg < 0 || visualPhaseDeg >= 720) {
    throw new GameProtocolError(`${field}.visualPhaseDeg must be within [0,720)`)
  }
  const payload = limitedString(source.payload, `${field}.payload`, 16)
  if (!(BONEYARD_ENEMY_PROJECTILE_PAYLOADS as readonly string[]).includes(payload)) {
    throw new GameProtocolError(`${field}.payload is not supported`)
  }
  if (!projectilePayloadMatchesKind(
    kind as BoneyardEnemyProjectileKind,
    payload as BoneyardEnemyProjectilePayload,
  )) {
    throw new GameProtocolError(`${field}.payload does not match kind`)
  }
  return {
    ageTicks,
    contactRadius: positiveFinite(source.contactRadius, `${field}.contactRadius`),
    headingDeg,
    homing: boolean(source.homing, `${field}.homing`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as BoneyardEnemyProjectileKind,
    lightRegistration: boneyardEnemyProjectileLightRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      kind as BoneyardEnemyProjectileKind,
      payload as BoneyardEnemyProjectilePayload,
    ),
    lifetimeTicks,
    nativeTypeId: nativeTypeId as BoneyardEnemyProjectileSnapshot['nativeTypeId'],
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    payload: payload as BoneyardEnemyProjectilePayload,
    position: boneyardPoint(source.position, `${field}.position`),
    speed,
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    verticalOffset,
    visualPhaseDeg,
    visualScale: positiveFinite(source.visualScale, `${field}.visualScale`),
  }
}

function boneyardEnemyProjectileEffectSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyProjectileEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'id',
    'kind',
    'lifetimeTicks',
    'ownerActorId',
    'ownerProjectileId',
    'phaseOriginTicks',
    'position',
    'rotationRadians',
    'scale',
    'spawnTick',
    'tint',
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const atlas = limitedString(source.atlas, `${field}.atlas`, 16)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  if (ageTicks >= lifetimeTicks) {
    throw new GameProtocolError(`${field}.ageTicks must precede lifetimeTicks`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  if (alpha < 0 || alpha > 2) {
    throw new GameProtocolError(`${field}.alpha must be within [0,2]`)
  }
  return {
    ageTicks,
    alpha,
    atlas,
    blendMode,
    entry: nonnegativeInteger(source.entry, `${field}.entry`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as BoneyardEnemyProjectileEffectSnapshot['kind'],
    lifetimeTicks,
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    ownerProjectileId: positiveInteger(
      source.ownerProjectileId,
      `${field}.ownerProjectileId`,
    ),
    phaseOriginTicks: nonnegativeInteger(
      source.phaseOriginTicks,
      `${field}.phaseOriginTicks`,
    ),
    position: boneyardPoint(source.position, `${field}.position`),
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: nonnegativeFinite(source.scale, `${field}.scale`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    tint: integerWithin(source.tint, `${field}.tint`, 0, 0xffffff),
  }
}

function projectilePayloadMatchesKind(
  kind: BoneyardEnemyProjectileKind,
  payload: BoneyardEnemyProjectilePayload,
): boolean {
  switch (kind) {
    case 'arrow': return payload === 'normal' || payload === 'fire' || payload === 'poison'
    case 'firebolt': return payload === 'fire'
    case 'guided-missile': return payload === 'cold' || payload === 'poison'
    case 'demon-bomb': return payload === 'none'
    case 'poison-pool': return payload === 'poison'
  }
}

function boneyardEnemyProjectileLightRegistration(
  value: unknown,
  field: string,
  kind: BoneyardEnemyProjectileKind,
  payload: BoneyardEnemyProjectilePayload,
): NativeLightProviderRegistration | null {
  if (kind === 'guided-missile' || kind === 'demon-bomb') {
    return nativeLightProviderRegistration(value, field, 'actor')
  }
  if (kind === 'firebolt' || (kind === 'arrow' && payload === 'fire')) {
    return nativeLightProviderRegistration(value, field, 'transient')
  }
  return absentNativeLightProviderRegistration(value, field)
}

function boneyardMaggotSnapshot(value: unknown, field: string): BoneyardMaggotSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha',
    'currentHealth',
    'deathEpoch',
    'deathTick',
    'emergenceTick',
    'emergenceOrientation',
    'headingDeg',
    'hitFlash',
    'id',
    'launchTrajectory',
    'maximumHealth',
    'ownerCoffinActorId',
    'pose',
    'position',
    'spawnTick',
    'state',
    'verticalOffset',
  ])
  const state = limitedString(source.state, `${field}.state`, 16)
  if (!(BONEYARD_MAGGOT_STATES as readonly string[]).includes(state)) {
    throw new GameProtocolError(`${field}.state is not supported`)
  }
  const launchTrajectory = limitedString(
    source.launchTrajectory,
    `${field}.launchTrajectory`,
    16,
  )
  if (!(BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES as readonly string[]).includes(launchTrajectory)) {
    throw new GameProtocolError(`${field}.launchTrajectory is not supported`)
  }
  const emergenceTick = nonnegativeInteger(source.emergenceTick, `${field}.emergenceTick`)
  if (emergenceTick > 24) {
    throw new GameProtocolError(`${field}.emergenceTick is out of range`)
  }
  if ((state === 'emerging') !== (emergenceTick < 24) && state !== 'death') {
    throw new GameProtocolError(`${field}.emergenceTick does not match state`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  if (alpha < 0 || alpha > 1) {
    throw new GameProtocolError(`${field}.alpha must be within [0,1]`)
  }
  const hitFlash = finite(source.hitFlash, `${field}.hitFlash`)
  if (hitFlash < 0 || hitFlash > 1) {
    throw new GameProtocolError(`${field}.hitFlash must be within [0,1]`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  if (currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth exceeds maximumHealth`)
  }
  const verticalOffset = finite(source.verticalOffset, `${field}.verticalOffset`)
  if (verticalOffset > 0) {
    throw new GameProtocolError(`${field}.verticalOffset must be non-positive`)
  }
  return {
    alpha,
    currentHealth,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    emergenceTick,
    emergenceOrientation: integerWithin(
      source.emergenceOrientation,
      `${field}.emergenceOrientation`,
      0,
      9,
    ),
    headingDeg,
    hitFlash,
    id: positiveInteger(source.id, `${field}.id`),
    launchTrajectory: launchTrajectory as BoneyardMaggotSnapshot['launchTrajectory'],
    maximumHealth,
    ownerCoffinActorId: positiveInteger(
      source.ownerCoffinActorId,
      `${field}.ownerCoffinActorId`,
    ),
    pose: nonnegativeFinite(source.pose, `${field}.pose`),
    position: boneyardPoint(source.position, `${field}.position`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    state: state as BoneyardMaggotSnapshot['state'],
    verticalOffset,
  }
}

function boneyardEnemyAnimation(
  value: unknown,
  field: string,
): BoneyardEnemyAnimationSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'action',
    'actionProgress',
    'alpha',
    'bodyPose',
    'coffinPose',
    'coffinSecondaryPose',
    'coffinState',
    'deathEpoch',
    'deathTick',
    'demonFrontJointRotationRadians',
    'demonFrontLimbRotationRadians',
    'demonRearJointRotationRadians',
    'demonRearLimbRotationRadians',
    'effects',
    'gaitPose',
    'hitFlash',
    'impBodyRotationRadians',
    'impEffectAlpha',
    'impEffectFrame',
    'maggots',
    'state',
    'verticalOffset',
    'zombieAngularOffsetDeg',
    'zombieAttackSide',
    'zombieBodyRotationRadians',
    'zombieBodyType',
    'zombieFlyblownSide',
    'zombieFrontArmPose',
    'zombieFrontArmRotationRadians',
    'zombieHeadType',
    'zombieHeadRotationRadians',
    'zombieRearArmPose',
    'zombieRearArmRotationRadians',
  ])
  const state = limitedString(source.state, `${field}.state`, 32)
  if (!(BONEYARD_ENEMY_ANIMATION_STATES as readonly string[]).includes(state)) {
    throw new GameProtocolError(`${field}.state is not supported`)
  }
  const action = source.action === null
    ? null
    : limitedString(source.action, `${field}.action`, 64)
  if (action !== null && !(BONEYARD_ENEMY_ACTIONS as readonly string[]).includes(action)) {
    throw new GameProtocolError(`${field}.action is not supported`)
  }
  if ((state === 'action') !== (action !== null)) {
    throw new GameProtocolError(`${field}.action does not match animation state`)
  }
  const coffinState = limitedString(source.coffinState, `${field}.coffinState`, 32)
  if (!(BONEYARD_ENEMY_COFFIN_STATES as readonly string[]).includes(coffinState)) {
    throw new GameProtocolError(`${field}.coffinState is not supported`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  const hitFlash = finite(source.hitFlash, `${field}.hitFlash`)
  const impEffectAlpha = finite(source.impEffectAlpha, `${field}.impEffectAlpha`)
  if (
    alpha < 0 || alpha > 1
    || hitFlash < 0 || hitFlash > 1
    || impEffectAlpha < 0 || impEffectAlpha > 1
  ) {
    throw new GameProtocolError(`${field} alpha channels must be within [0,1]`)
  }
  const effects = limitedArray(
    source.effects,
    `${field}.effects`,
    MAX_BONEYARD_ENEMY_EFFECTS,
  ).map((effect, index) => boneyardEnemyEffect(
    effect,
    `${field}.effects[${index}]`,
  ))
  if (new Set(effects.map((effect) => effect.id)).size !== effects.length) {
    throw new GameProtocolError(`${field}.effects must have unique ids`)
  }
  if (new Set(effects.map((effect) => effect.role)).size !== effects.length) {
    throw new GameProtocolError(`${field}.effects must have unique roles`)
  }
  if (limitedArray(source.maggots, `${field}.maggots`, 0).length !== 0) {
    throw new GameProtocolError(
      `${field}.maggots must be empty in protocol ${GAME_PROTOCOL_VERSION}`,
    )
  }
  return {
    action: action as BoneyardEnemyAction | null,
    actionProgress: nonnegativeFinite(source.actionProgress, `${field}.actionProgress`),
    alpha,
    bodyPose: nonnegativeFinite(source.bodyPose, `${field}.bodyPose`),
    coffinPose: nonnegativeFinite(source.coffinPose, `${field}.coffinPose`),
    coffinSecondaryPose: source.coffinSecondaryPose === null
      ? null
      : nonnegativeFinite(source.coffinSecondaryPose, `${field}.coffinSecondaryPose`),
    coffinState: coffinState as BoneyardEnemyCoffinState,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    demonFrontJointRotationRadians: finite(
      source.demonFrontJointRotationRadians,
      `${field}.demonFrontJointRotationRadians`,
    ),
    demonFrontLimbRotationRadians: finite(
      source.demonFrontLimbRotationRadians,
      `${field}.demonFrontLimbRotationRadians`,
    ),
    demonRearJointRotationRadians: finite(
      source.demonRearJointRotationRadians,
      `${field}.demonRearJointRotationRadians`,
    ),
    demonRearLimbRotationRadians: finite(
      source.demonRearLimbRotationRadians,
      `${field}.demonRearLimbRotationRadians`,
    ),
    effects,
    gaitPose: nonnegativeFinite(source.gaitPose, `${field}.gaitPose`),
    hitFlash,
    impBodyRotationRadians: finite(
      source.impBodyRotationRadians,
      `${field}.impBodyRotationRadians`,
    ),
    impEffectAlpha,
    impEffectFrame: integer(source.impEffectFrame, `${field}.impEffectFrame`),
    maggots: [],
    state: state as BoneyardEnemyAnimationSnapshot['state'],
    verticalOffset: finite(source.verticalOffset, `${field}.verticalOffset`),
    zombieAngularOffsetDeg: finite(
      source.zombieAngularOffsetDeg,
      `${field}.zombieAngularOffsetDeg`,
    ),
    zombieAttackSide: integerWithin(
      source.zombieAttackSide,
      `${field}.zombieAttackSide`,
      0,
      1,
    ) as 0 | 1,
    zombieBodyRotationRadians: finite(
      source.zombieBodyRotationRadians,
      `${field}.zombieBodyRotationRadians`,
    ),
    zombieBodyType: integerWithin(
      source.zombieBodyType,
      `${field}.zombieBodyType`,
      -1,
      2,
    ),
    zombieFlyblownSide: integerWithin(
      source.zombieFlyblownSide,
      `${field}.zombieFlyblownSide`,
      -1,
      1,
    ),
    zombieFrontArmPose: nonnegativeFinite(
      source.zombieFrontArmPose,
      `${field}.zombieFrontArmPose`,
    ),
    zombieFrontArmRotationRadians: finite(
      source.zombieFrontArmRotationRadians,
      `${field}.zombieFrontArmRotationRadians`,
    ),
    zombieHeadType: integerWithin(
      source.zombieHeadType,
      `${field}.zombieHeadType`,
      -1,
      2,
    ),
    zombieHeadRotationRadians: finite(
      source.zombieHeadRotationRadians,
      `${field}.zombieHeadRotationRadians`,
    ),
    zombieRearArmPose: nonnegativeFinite(
      source.zombieRearArmPose,
      `${field}.zombieRearArmPose`,
    ),
    zombieRearArmRotationRadians: finite(
      source.zombieRearArmRotationRadians,
      `${field}.zombieRearArmRotationRadians`,
    ),
  }
}

function boneyardEnemyEffect(
  value: unknown,
  field: string,
): BoneyardEnemyEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'id',
    'offset',
    'role',
    'rotationRadians',
    'scale',
  ])
  const role = limitedString(source.role, `${field}.role`, 32)
  if (!(BONEYARD_ENEMY_EFFECT_ROLES as readonly string[]).includes(role)) {
    throw new GameProtocolError(`${field}.role is not supported`)
  }
  const atlas = limitedString(source.atlas, `${field}.atlas`, 16)
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const entry = nonnegativeInteger(source.entry, `${field}.entry`)
  if (
    (role === 'burning-fire'
      && (atlas !== 'DeadHawg' || blendMode !== 'normal' || entry < 46 || entry > 77))
    || (role === 'magic-shield'
      && (atlas !== 'BadGuys' || blendMode !== 'add' || entry !== 49))
  ) {
    throw new GameProtocolError(`${field} fields do not match role`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  const maximumAlpha = role === 'magic-shield' ? 1.25 : 1
  if (alpha < 0 || alpha > maximumAlpha) {
    throw new GameProtocolError(`${field}.alpha must be within [0,${maximumAlpha}]`)
  }
  return {
    alpha,
    atlas,
    blendMode,
    entry,
    id: positiveInteger(source.id, `${field}.id`),
    offset: boneyardPoint(source.offset, `${field}.offset`),
    role: role as BoneyardEnemyEffectSnapshot['role'],
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: positiveFinite(source.scale, `${field}.scale`),
  }
}

function gameWorldSnapshotFrame(
  value: unknown,
  field: string,
  snapshotTick: number,
): GameSnapshotFrame['world'] {
  const source = record(value, field)
  if (source.kind === 'boneyard') {
    onlyKeys(source, field, [
      'arenaTransition',
      'encounter',
      'entities',
      'enemyEvents',
      'gateLeaves',
      'kind',
      'lanternLightRegistration',
      'mageLightningPulses',
      'runId',
      'waves',
    ])
    const encounter = boneyardSolomonSnapshot(source.encounter, `${field}.encounter`)
    const waves = boneyardWaveSnapshot(source.waves, `${field}.waves`)
    const arenaTransition = boneyardArenaTransition(
      source.arenaTransition,
      `${field}.arenaTransition`,
    )
    if (
      (encounter === null) !== (waves === null)
      || (encounter === null) !== (arenaTransition === null)
    ) {
      throw new GameProtocolError(
        `${field}.arenaTransition, ${field}.encounter, and ${field}.waves must share ownership`,
      )
    }
    const runId = limitedString(source.runId, `${field}.runId`, 128)
    return {
      arenaTransition,
      encounter,
      entities: replicatedEntityFrame(source.entities, `${field}.entities`),
      enemyEvents: boneyardEnemyEvents(
        source.enemyEvents,
        `${field}.enemyEvents`,
        runId,
        snapshotTick,
      ),
      gateLeaves: limitedArray(
        source.gateLeaves,
        `${field}.gateLeaves`,
        MAX_BONEYARD_STRUCTURES * 2,
      ).map((leaf, index) => boneyardGateLeafSnapshot(
        leaf,
        `${field}.gateLeaves[${index}]`,
      )),
      kind: 'boneyard',
      lanternLightRegistration: nullableNativeLightProviderRegistration(
        source.lanternLightRegistration,
        `${field}.lanternLightRegistration`,
        'actor',
      ),
      mageLightningPulses: boneyardMageLightningPulseFrames(
        source.mageLightningPulses,
        `${field}.mageLightningPulses`,
        snapshotTick,
      ),
      runId,
      waves,
    }
  }
  if (source.kind !== 'hub') throw new GameProtocolError(`${field}.kind is not supported`)
  onlyKeys(source, field, [
    'ambient',
    'collisionRngState',
    'entities',
    'kind',
    'participants',
    'traderAnimationSeed',
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
    traderAnimationSeed: nonnegativeInteger(
      source.traderAnimationSeed,
      `${field}.traderAnimationSeed`,
    ),
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
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
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
