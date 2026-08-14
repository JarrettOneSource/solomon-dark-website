import type {
  BoneyardGateLeafSnapshot,
} from '../core-kernels/boneyard.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type {
  HubParticipantState,
} from '../core-kernels/hub-regions.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { ReplicatedEntityFrame } from './replicated-entity-types.ts'

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
  framePhase: number
  gaitDegrees: number
  heading: number
  headingIndex: number
  id: number
  position: Vector2
  props: readonly ProtocolStudentProp[]
  reading: boolean
  scale: number
}

export interface HubWorldSnapshot {
  ambient: ProtocolAmbientState
  collisionRngState: number
  kind: 'hub'
  participants: Readonly<Record<string, HubParticipantState>>
  students: readonly ProtocolStudentState[]
}

export interface BoneyardWorldSnapshot {
  gateLeaves: readonly BoneyardGateLeafSnapshot[]
  kind: 'boneyard'
  runId: string
}

export type GameWorldSnapshot = HubWorldSnapshot | BoneyardWorldSnapshot

export interface HubWorldSnapshotFrame {
  ambient: ProtocolAmbientState
  collisionRngState: number
  entities: ReplicatedEntityFrame
  kind: 'hub'
  participants: Readonly<Record<string, HubParticipantState>>
}

export type GameWorldSnapshotFrame = HubWorldSnapshotFrame | BoneyardWorldSnapshot

export interface GameSnapshot {
  hostPlayerId: string | null
  players: Readonly<Record<string, ProtocolPlayerState>>
  tick: number
  world: GameWorldSnapshot
}

export interface GameSnapshotFrame {
  hostPlayerId: string | null
  players: Readonly<Record<string, ProtocolPlayerState>>
  tick: number
  world: GameWorldSnapshotFrame
}
