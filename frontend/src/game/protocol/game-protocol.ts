import type { HubPoint } from '../core-kernels/hub-math.ts'
import type {
  HubSnapshot,
  ProtocolAmbientState,
  ProtocolPlayerState,
  ProtocolStudentState,
} from './game-state.ts'

export type { HubSnapshot } from './game-state.ts'

export const GAME_PROTOCOL_VERSION = 1
export const GAME_PROTOCOL_NAME = `solomon-dark/${GAME_PROTOCOL_VERSION}`
export const HUB_KERNEL_VERSION = 'hub-kernel-1'
export const EMPTY_CONTENT_MANIFEST_SHA256 = '0'.repeat(64)

const MAX_CONTENT_MODS = 256
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

export interface HubKernelParameters {
  fixedTickSeconds: number
  movementAcceleration: number
  movementLaneCap: number
  movementRetention: number
  playerRadius: number
}

export interface ClientHelloMessage {
  type: 'client-hello'
  protocolVersion: number
  credential: string
  displayName?: string
  resumeToken?: string
}

export interface ClientInputMessage {
  type: 'client-input'
  input: HubPoint
  sequence: number
  targetTick: number
}

export interface ClientDisconnectMessage {
  type: 'client-disconnect'
}

export type ClientGameMessage =
  | ClientHelloMessage
  | ClientInputMessage
  | ClientDisconnectMessage

export interface ServerWelcomeMessage {
  type: 'server-welcome'
  protocolVersion: number
  playerId: string
  resumeToken: string
  serverTickRate: number
  snapshotRate: number
  kernelVersion: string
  kernelParameters: HubKernelParameters
  content: GameContentManifest
  snapshot: HubSnapshot
}

export interface ServerSnapshotMessage {
  type: 'server-snapshot'
  acknowledgedInputSequence: number
  snapshot: HubSnapshot
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
  | ServerDisconnectMessage

export function encodeGameMessage(message: ClientGameMessage | ServerGameMessage): string {
  return JSON.stringify(message)
}

export function decodeClientGameMessage(payload: string): ClientGameMessage {
  const value = parseObject(payload)
  if (value.type === 'client-hello') {
    return {
      type: 'client-hello',
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
      credential: limitedString(value.credential, 'credential', 512),
      ...(value.displayName === undefined
        ? {}
        : { displayName: limitedString(value.displayName, 'displayName', 64) }),
      ...(value.resumeToken === undefined
        ? {}
        : { resumeToken: limitedString(value.resumeToken, 'resumeToken', 512) }),
    }
  }
  if (value.type === 'client-input') {
    return {
      type: 'client-input',
      input: point(value.input, 'input'),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
      targetTick: nonnegativeInteger(value.targetTick, 'targetTick'),
    }
  }
  if (value.type === 'client-disconnect') return { type: 'client-disconnect' }
  throw new GameProtocolError('unknown client message type')
}

export function decodeServerGameMessage(payload: string): ServerGameMessage {
  const value = parseObject(payload)
  if (value.type === 'server-welcome') {
    return {
      type: 'server-welcome',
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
      playerId: limitedString(value.playerId, 'playerId', 128),
      resumeToken: limitedString(value.resumeToken, 'resumeToken', 512),
      serverTickRate: positiveFinite(value.serverTickRate, 'serverTickRate'),
      snapshotRate: positiveFinite(value.snapshotRate, 'snapshotRate'),
      kernelVersion: limitedString(value.kernelVersion, 'kernelVersion', 128),
      kernelParameters: hubKernelParameters(value.kernelParameters),
      content: contentManifest(value.content),
      snapshot: hubSnapshot(value.snapshot),
    }
  }
  if (value.type === 'server-snapshot') {
    return {
      type: 'server-snapshot',
      acknowledgedInputSequence: nonnegativeInteger(
        value.acknowledgedInputSequence,
        'acknowledgedInputSequence',
      ),
      snapshot: hubSnapshot(value.snapshot),
    }
  }
  if (value.type === 'server-disconnect') {
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

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new GameProtocolError(`${field} must be boolean`)
  return value
}

function limitedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new GameProtocolError(`${field} must be a nonempty string of at most ${maximum} characters`)
  }
  return value
}

function sha256(value: unknown, field: string): string {
  const result = limitedString(value, field, 64).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(result)) throw new GameProtocolError(`${field} must be SHA-256 hex`)
  return result
}

function point(value: unknown, field: string): HubPoint {
  const source = record(value, field)
  const x = finite(source.x, `${field}.x`)
  const y = finite(source.y, `${field}.y`)
  if (Math.hypot(x, y) > 1.001) throw new GameProtocolError(`${field} magnitude exceeds one`)
  return { x, y }
}

function playerState(value: unknown, field: string): ProtocolPlayerState {
  const source = record(value, field)
  return {
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    position: pointUnbounded(source.position, `${field}.position`),
    velocity: pointUnbounded(source.velocity, `${field}.velocity`),
    walkCyclePrimary: finite(source.walkCyclePrimary, `${field}.walkCyclePrimary`),
  }
}

function pointUnbounded(value: unknown, field: string): HubPoint {
  const source = record(value, field)
  return {
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
}

function studentState(value: unknown, field: string): ProtocolStudentState {
  const source = record(value, field)
  const profile = record(source.profile, `${field}.profile`)
  const props = limitedArray(source.props, `${field}.props`, MAX_STUDENT_PROPS).map((entry, index) => {
    const prop = record(entry, `${field}.props[${index}]`)
    return {
      angle: finite(prop.angle, `${field}.props[${index}].angle`),
      paletteIndex: nonnegativeInteger(prop.paletteIndex, `${field}.props[${index}].paletteIndex`),
      radius: finite(prop.radius, `${field}.props[${index}].radius`),
    }
  })
  const pathStep = integer(source.pathStep, `${field}.pathStep`)
  if (pathStep !== -1 && pathStep !== 1) throw new GameProtocolError(`${field}.pathStep must be -1 or 1`)
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
    position: pointUnbounded(source.position, `${field}.position`),
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
    wander: pointUnbounded(source.wander, `${field}.wander`),
  }
}

function ambientState(value: unknown): ProtocolAmbientState {
  const source = record(value, 'snapshot.ambient')
  return {
    fountainParticles: limitedArray(
      source.fountainParticles,
      'snapshot.ambient.fountainParticles',
      MAX_FOUNTAIN_PARTICLES,
    )
      .map((entry, index) => {
        const particle = record(entry, `snapshot.ambient.fountainParticles[${index}]`)
        return {
          id: nonnegativeInteger(particle.id, `snapshot.ambient.fountainParticles[${index}].id`),
          remaining: finite(particle.remaining, `snapshot.ambient.fountainParticles[${index}].remaining`),
          scale: positiveFinite(particle.scale, `snapshot.ambient.fountainParticles[${index}].scale`),
        }
      }),
    markerPhaseDegrees: finite(source.markerPhaseDegrees, 'snapshot.ambient.markerPhaseDegrees'),
    nextFountainParticleId: nonnegativeInteger(source.nextFountainParticleId, 'snapshot.ambient.nextFountainParticleId'),
    rngState: nonnegativeInteger(source.rngState, 'snapshot.ambient.rngState'),
    sealCorePhase: finite(source.sealCorePhase, 'snapshot.ambient.sealCorePhase'),
    sealGlyphPhase: finite(source.sealGlyphPhase, 'snapshot.ambient.sealGlyphPhase'),
    statuePhaseDegrees: finite(source.statuePhaseDegrees, 'snapshot.ambient.statuePhaseDegrees'),
  }
}

function hubSnapshot(value: unknown): HubSnapshot {
  const source = record(value, 'snapshot')
  const rawPlayers = record(source.players, 'snapshot.players')
  if (Object.keys(rawPlayers).length > MAX_PLAYERS) {
    throw new GameProtocolError(`snapshot.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const players: Record<string, ProtocolPlayerState> = {}
  for (const [playerId, state] of Object.entries(rawPlayers)) {
    if (!playerId || playerId.length > 128) throw new GameProtocolError('invalid snapshot player id')
    players[playerId] = playerState(state, `snapshot.players.${playerId}`)
  }
  return {
    ambient: ambientState(source.ambient),
    collisionRngState: nonnegativeInteger(source.collisionRngState, 'snapshot.collisionRngState'),
    players,
    students: limitedArray(source.students, 'snapshot.students', MAX_STUDENTS).map((student, index) => (
      studentState(student, `snapshot.students[${index}]`)
    )),
    tick: nonnegativeInteger(source.tick, 'snapshot.tick'),
  }
}

function hubKernelParameters(value: unknown): HubKernelParameters {
  const source = record(value, 'kernelParameters')
  return {
    fixedTickSeconds: positiveFinite(source.fixedTickSeconds, 'kernelParameters.fixedTickSeconds'),
    movementAcceleration: positiveFinite(source.movementAcceleration, 'kernelParameters.movementAcceleration'),
    movementLaneCap: positiveFinite(source.movementLaneCap, 'kernelParameters.movementLaneCap'),
    movementRetention: positiveFinite(source.movementRetention, 'kernelParameters.movementRetention'),
    playerRadius: positiveFinite(source.playerRadius, 'kernelParameters.playerRadius'),
  }
}

function contentManifest(value: unknown): GameContentManifest {
  const source = record(value, 'content')
  return {
    manifestSha256: sha256(source.manifestSha256, 'content.manifestSha256'),
    mods: limitedArray(source.mods, 'content.mods', MAX_CONTENT_MODS).map((entry, index) => {
      const mod = record(entry, `content.mods[${index}]`)
      return {
        id: limitedString(mod.id, `content.mods[${index}].id`, 128),
        version: limitedString(mod.version, `content.mods[${index}].version`, 64),
        contentSha256: sha256(mod.contentSha256, `content.mods[${index}].contentSha256`),
      }
    }),
  }
}
