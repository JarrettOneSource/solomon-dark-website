import type { HubPoint } from '../core-kernels/hub-math.ts'

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

export interface ProtocolPlayerState {
  gaitDegrees: number
  headingIndex: number
  position: HubPoint
  velocity: HubPoint
  walkCyclePrimary: number
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
  position: HubPoint
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
  wander: HubPoint
}

export interface HubSnapshot {
  ambient: ProtocolAmbientState
  collisionRngState: number
  players: Readonly<Record<string, ProtocolPlayerState>>
  students: readonly ProtocolStudentState[]
  tick: number
}
