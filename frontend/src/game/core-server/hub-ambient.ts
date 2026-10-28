import type {
  NativeWorldManagerRegistration,
  RegisterNativeWorldPainter,
} from '../core-kernels/native-world-manager-order.ts'
import { HUB_TEACHER_TICKS_PER_SECOND, hubTeacherBurstAt } from '../hub-teacher.ts'

export interface HubFountainParticleState {
  id: number
  remaining: number
  scale: number
}

export interface HubTeacherWorldReleaseState {
  painterRegistrations: readonly NativeWorldManagerRegistration[]
  releaseIndex: number
}

export interface HubAmbientState {
  fountainParticles: readonly HubFountainParticleState[]
  nextFountainParticleId: number
  rngState: number
  sealCorePhase: number
  sealGlyphPhase: number
  statuePhaseDegrees: number
  teacherTick: number
  teacherWorldRelease: HubTeacherWorldReleaseState | null
}

const FOUNTAIN_INITIAL_SCALE = 0.02
const FOUNTAIN_LIFETIME_DECREMENT = 0.00625
const FOUNTAIN_SCALE_MULTIPLIER = 1.002500057220459
const SEAL_TRACK_LENGTH = 3

function nextRandom(state: number): { state: number; value: number } {
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  value >>>= 0
  return { state: value || 0x6d2b79f5, value: value / 0x100000000 }
}

function randomUnsigned(
  state: number,
  maximum: number,
): { state: number; value: number } {
  const sample = nextRandom(state)
  return { state: sample.state, value: sample.value * maximum }
}

function randomInteger(
  state: number,
  maximumExclusive: number,
): { state: number; value: number } {
  const sample = nextRandom(state)
  return {
    state: sample.state,
    value: Math.min(maximumExclusive - 1, Math.floor(sample.value * maximumExclusive)),
  }
}

export function createHubAmbientState(): HubAmbientState {
  return {
    fountainParticles: [],
    nextFountainParticleId: 0,
    rngState: 0x2f6e2b1d,
    sealCorePhase: 0,
    sealGlyphPhase: 0,
    statuePhaseDegrees: 0,
    teacherTick: 0,
    teacherWorldRelease: null,
  }
}

export function stepHubAmbient(
  source: HubAmbientState,
  registerWorldPainter?: RegisterNativeWorldPainter,
): HubAmbientState {
  let rngState = source.rngState
  const fountainRoll = randomInteger(rngState, 80)
  rngState = fountainRoll.state

  let nextFountainParticleId = source.nextFountainParticleId
  let fountainParticles = source.fountainParticles
    .map((particle) => ({
      ...particle,
      remaining: particle.remaining - FOUNTAIN_LIFETIME_DECREMENT,
      scale: particle.scale * FOUNTAIN_SCALE_MULTIPLIER,
    }))
    .filter((particle) => particle.remaining > 0)

  if (fountainRoll.value === 3) {
    const lifetime = randomUnsigned(rngState, 3)
    rngState = lifetime.state
    fountainParticles = [
      ...fountainParticles,
      {
        id: nextFountainParticleId,
        remaining: (lifetime.value + 6) * 0.25,
        scale: FOUNTAIN_INITIAL_SCALE,
      },
    ]
    nextFountainParticleId += 1
  }

  const coreIncrement = randomUnsigned(rngState, 0.15)
  rngState = coreIncrement.state
  const glyphIncrement = randomUnsigned(rngState, 0.019)
  rngState = glyphIncrement.state

  const teacherTick = source.teacherTick + 1
  const teacherBurst = hubTeacherBurstAt(
    teacherTick / HUB_TEACHER_TICKS_PER_SECOND,
  )
  const teacherWorldRelease = teacherBurst.column.visible || teacherBurst.frames.visible
    ? source.teacherWorldRelease?.releaseIndex === teacherBurst.releaseIndex
      ? source.teacherWorldRelease
      : {
          painterRegistrations: Object.freeze([0, 1].map((index) => (
            registerWorldPainter?.('transient') ?? Object.freeze({
              managerLane: 'transient' as const,
              registrationOrdinal: teacherBurst.releaseIndex * 2 + index,
            })
          ))),
          releaseIndex: teacherBurst.releaseIndex,
        }
    : null

  return {
    fountainParticles,
    nextFountainParticleId,
    rngState,
    sealCorePhase: (source.sealCorePhase + (coreIncrement.value + 0.01) * 0.5)
      % SEAL_TRACK_LENGTH,
    sealGlyphPhase: (source.sealGlyphPhase + (glyphIncrement.value + 0.001) * 0.5)
      % SEAL_TRACK_LENGTH,
    statuePhaseDegrees: (source.statuePhaseDegrees + 0.5) % 360,
    teacherTick,
    teacherWorldRelease,
  }
}
