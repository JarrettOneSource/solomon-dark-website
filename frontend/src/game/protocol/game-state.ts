import type {
  PlayerCharacterConfig,
  PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { Vector2 } from '../core-kernels/vector.ts'

export interface ProtocolFountainParticleState {
  id: number
  remaining: number
  scale: number
}

export interface ProtocolAmbientState {
  fountainParticles: readonly ProtocolFountainParticleState[]
  markerPhaseDegrees: number
  nextFountainParticleId: number
  rngState: number
  sealCorePhase: number
  sealGlyphPhase: number
  statuePhaseDegrees: number
}

export interface ProtocolPlayerState extends PlayerCharacterState {
  config: PlayerCharacterConfig
}

export interface ProtocolStudentProp {
  angle: number
  paletteIndex: number
  radius: number
}

export interface ProtocolStudentState {
  currentSpeed: number
  desiredSpeed: number
  framePhase: number
  gaitDegrees: number
  heading: number
  headingIndex: number
  id: number
  pathCursor: number
  pathId: number
  pathStep: 1 | -1
  position: Vector2
  profile: {
    pushResistance: number
    pushStrength: number
    radius: number
  }
  props: readonly ProtocolStudentProp[]
  reading: boolean
  retired: boolean
  rngState: number
  scale: number
  staticCollisionEnabled: boolean
  tick: number
  wander: Vector2
}

export interface HubWorldSnapshot {
  ambient: ProtocolAmbientState
  collisionRngState: number
  kind: 'hub'
  students: readonly ProtocolStudentState[]
}

export interface BoneyardWorldSnapshot {
  kind: 'boneyard'
  runId: string
}

export type GameWorldSnapshot = HubWorldSnapshot | BoneyardWorldSnapshot

export interface GameSnapshot {
  hostPlayerId: string | null
  players: Readonly<Record<string, ProtocolPlayerState>>
  tick: number
  world: GameWorldSnapshot
}
