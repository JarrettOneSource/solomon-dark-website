import { actorHeadingFromVector } from './actor-heading.ts'
import type { BoneyardBounds, BoneyardPoint, SolomonDigState } from './boneyard.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'

export const BONEYARD_SOLOMON_PHASES = [
  'digging',
  'turning',
  'speaking',
  'retreat-hold',
  'retreat-accelerating',
  'escaping',
  'gone',
] as const

export type BoneyardSolomonPhase = typeof BONEYARD_SOLOMON_PHASES[number]

export const BONEYARD_SOLOMON_DIALOGUE_MODES = ['ordinary', 'tutorial'] as const
export type BoneyardSolomonDialogueMode = typeof BONEYARD_SOLOMON_DIALOGUE_MODES[number]

export const BONEYARD_SOLOMON_VOICE_CUES = [
  'solomon-hello-1',
  'solomon-hello-2',
  'solomon-hello-3',
  'solomon-hello-4',
  'solomon-laugh-1',
  'solomon-get-him-boys',
] as const

export type BoneyardSolomonVoiceCue = typeof BONEYARD_SOLOMON_VOICE_CUES[number]

export const BONEYARD_SOLOMON_DIG_CUES = [
  'shovel-1',
  'shovel-2',
  'throw-dirt-1',
  'throw-dirt-2',
] as const

export type BoneyardSolomonDigCue =
  typeof BONEYARD_SOLOMON_DIG_CUES[number]

/** Exact PCM durations rounded up to the authoritative 100 Hz tick. */
export const SOLOMON_VOICE_DURATION_TICKS: Readonly<
  Record<BoneyardSolomonVoiceCue, number>
> = {
  'solomon-hello-1': 783,
  'solomon-hello-2': 570,
  'solomon-hello-3': 554,
  'solomon-hello-4': 735,
  'solomon-laugh-1': 247,
  'solomon-get-him-boys': 245,
}

export interface BoneyardSolomonVoiceEvent {
  cue: BoneyardSolomonVoiceCue
  id: number
}

export interface BoneyardSolomonDigEvent {
  cue: BoneyardSolomonDigCue
  id: number
  tick: number
}

export interface BoneyardSolomonEncounterState {
  acceleration: number
  digBodyBobAmplitude: number
  digBodyOffsetY: number
  digEventId: number
  digEvents: readonly BoneyardSolomonDigEvent[]
  digFrame: number
  digFrameProgram: readonly number[]
  digPhase: number
  digShovelArmed: boolean
  digTicksPerFrame: number
  digThrowDirtArmed: boolean
  dialogueMode: BoneyardSolomonDialogueMode
  escapeCollisionSourceIds: readonly string[]
  escapeSpeed: number
  escapeTarget: BoneyardPoint | null
  headingDeg: number
  lifetimeTicksRemaining: number
  mouthPose: number
  mouthPoseTicksRemaining: number
  motion: number
  phase: BoneyardSolomonPhase
  phaseTicksRemaining: number
  position: BoneyardPoint
  queuedGetHimBoys: boolean
  rngState: NativeRngState
  runEventId: number
  targetPlayerId: string | null
  tutorialDialogueTicks: number
  transitionOffsetY: number
  turnRate: number
  voiceEvents: readonly BoneyardSolomonVoiceEvent[]
  voiceTicksRemaining: number
  walkCycle: number
}

export type SolomonContactPlayers = Readonly<
  Record<string, { position: BoneyardPoint }>
>

const SOLOMON_CONTACT_X_SCALE = 1.5
const SOLOMON_CONTACT_Y_SCALE = 1.25
const SOLOMON_CONTACT_CENTER_Y_OFFSET = -10
const SOLOMON_CONTACT_RADIUS_SQUARED = 10000
const SOLOMON_RETREAT_HOLD_TICKS = 25
const SOLOMON_RETREAT_ACCELERATION = -7
const SOLOMON_RETREAT_ACCELERATION_STEP = 0.5
const SOLOMON_RETREAT_DISTANCE_PER_TICK = 3
const SOLOMON_ESCAPE_INITIAL_SPEED = 2
const SOLOMON_ESCAPE_SPEED_STEP = 0.05
const SOLOMON_ESCAPE_HEADING_DEFLECTION_DEGREES = 15
const SOLOMON_ESCAPE_INITIAL_ACCELERATION = -3
const SOLOMON_ESCAPE_ACCELERATION_STEP = 0.25
const SOLOMON_ESCAPE_LANDING_ACCELERATION = -2
const SOLOMON_ESCAPE_LIFETIME_TICKS = 515
export const NATIVE_SOLOMON_COLLISION_RADIUS = 30
export const NATIVE_SOLOMON_ESCAPE_ROUTE_ARRIVAL_DISTANCE_SQUARED = 100
export const NATIVE_SOLOMON_ESCAPE_TARGET_DISTANCE = 4_096
export const NATIVE_SOLOMON_NAVIGATION_CLEARANCE = 25
export const NATIVE_SOLOMON_ESCAPE_PATH_MARGIN = 50
export const NATIVE_SOLOMON_ESCAPE_TARGET_MARGIN = 100
const SOLOMON_MAX_TURN_RATE = 10
const SOLOMON_MOUTH_POSE_COUNT = 3
const SOLOMON_MOUTH_INITIAL_TICKS = 25
const SOLOMON_WALK_POSE_COUNT = 6
const SOLOMON_DIG_SHOVEL_CURSOR = 4
const SOLOMON_DIG_THROW_DIRT_CURSOR = 15
const SOLOMON_DIG_CURSOR_JITTER_END = 10
const SOLOMON_DIG_CURSOR_JITTER_MAXIMUM = Math.fround(0.09)
const SOLOMON_DIG_TAIL_PROGRAM_SLOTS = 5
const SOLOMON_DIG_TAIL_SLOWDOWN = Math.fround(0.05)
const SOLOMON_DIG_BODY_BOB_AMPLITUDE_MINIMUM = 5
const SOLOMON_DIG_BODY_BOB_AMPLITUDE_RANGE = 5
const SOLOMON_DIG_EVENT_HISTORY_LIMIT = 8

export function createSolomonEncounter(
  dig: SolomonDigState,
  seed: string,
  options: Readonly<{
    dialogueMode?: BoneyardSolomonDialogueMode
    tutorialDialogueTicks?: number
  }> = {},
): BoneyardSolomonEncounterState {
  if (dig.frameProgram.length === 0 || dig.ticksPerFrame <= 0) {
    throw new Error('Solomon Dig requires a non-empty animation program and positive frame timing')
  }
  const bodyBobAmplitude = drawNativeFloat(
    createNativeRng(seedState(`${seed}:solomon-dig`)),
    SOLOMON_DIG_BODY_BOB_AMPLITUDE_RANGE,
  )
  const dialogueMode = options.dialogueMode ?? 'ordinary'
  const tutorialDialogueTicks = options.tutorialDialogueTicks ?? 0
  if (
    dialogueMode === 'tutorial'
    && (!Number.isSafeInteger(tutorialDialogueTicks) || tutorialDialogueTicks < 1)
  ) throw new RangeError('Tutorial Solomon dialogue duration must be a positive tick count')
  return {
    acceleration: 0,
    digBodyBobAmplitude: Math.fround(
      bodyBobAmplitude.value + SOLOMON_DIG_BODY_BOB_AMPLITUDE_MINIMUM,
    ),
    digBodyOffsetY: 0,
    digEventId: 0,
    digEvents: [],
    digFrame: dig.frameProgram[0],
    digFrameProgram: [...dig.frameProgram],
    digPhase: 0,
    digShovelArmed: true,
    digTicksPerFrame: dig.ticksPerFrame,
    digThrowDirtArmed: true,
    dialogueMode,
    escapeCollisionSourceIds: [],
    escapeSpeed: 0,
    escapeTarget: null,
    headingDeg: 180,
    lifetimeTicksRemaining: 0,
    mouthPose: 0,
    mouthPoseTicksRemaining: SOLOMON_MOUTH_INITIAL_TICKS,
    motion: 0,
    phase: 'digging',
    phaseTicksRemaining: 0,
    position: { ...dig.position },
    queuedGetHimBoys: false,
    rngState: bodyBobAmplitude.state,
    runEventId: 0,
    targetPlayerId: null,
    tutorialDialogueTicks,
    transitionOffsetY: 0,
    turnRate: 0,
    voiceEvents: [],
    voiceTicksRemaining: 0,
    walkCycle: 0,
  }
}

export function solomonContactContains(
  solomon: BoneyardPoint,
  player: BoneyardPoint,
): boolean {
  const dx = (solomon.x - player.x) / SOLOMON_CONTACT_X_SCALE
  const dy = (
    solomon.y + SOLOMON_CONTACT_CENTER_Y_OFFSET - player.y
  ) / SOLOMON_CONTACT_Y_SCALE
  return dx * dx + dy * dy < SOLOMON_CONTACT_RADIUS_SQUARED
}

export function isSolomonPlayerLocked(
  encounter: BoneyardSolomonEncounterState,
  playerId: string,
): boolean {
  return encounter.targetPlayerId === playerId
    && (encounter.phase === 'turning' || encounter.phase === 'speaking')
}

export function isBoneyardPlayerCombatEnabled(
  encounter: Pick<BoneyardSolomonEncounterState, 'runEventId'> | null,
): boolean {
  return encounter === null || encounter.runEventId > 0
}

export function nativeSolomonEscapeTarget(
  position: Readonly<BoneyardPoint>,
  headingDeg: number,
  bounds: Readonly<BoneyardBounds>,
): BoneyardPoint {
  const radians = headingDeg * Math.PI / 180
  const direction = {
    x: Math.sin(radians),
    y: -Math.cos(radians),
  }
  return clipSolomonEscapeSegment(position, {
    x: Math.fround(position.x + direction.x * NATIVE_SOLOMON_ESCAPE_TARGET_DISTANCE),
    y: Math.fround(position.y + direction.y * NATIVE_SOLOMON_ESCAPE_TARGET_DISTANCE),
  }, bounds, NATIVE_SOLOMON_ESCAPE_TARGET_MARGIN)
}

export function nativeSolomonEscapePathTarget(
  position: Readonly<BoneyardPoint>,
  escapeTarget: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
): BoneyardPoint {
  return clipSolomonEscapeSegment(
    position,
    escapeTarget,
    bounds,
    NATIVE_SOLOMON_ESCAPE_PATH_MARGIN,
  )
}

export function stepSolomonEncounter(
  source: BoneyardSolomonEncounterState,
  players: SolomonContactPlayers,
  tick: number,
): BoneyardSolomonEncounterState {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('Solomon encounter tick must be a nonnegative safe integer')
  }
  switch (source.phase) {
    case 'digging': return stepSolomonDigging(source, players, tick)
    case 'turning': return faceSolomonTarget(source, players)
    case 'speaking': return stepSolomonHello(source, players)
    case 'retreat-hold': return stepSolomonRetreatHold(source)
    case 'retreat-accelerating': return stepSolomonRetreatAcceleration(source)
    case 'escaping': return stepSolomonEscape(source)
    case 'gone': return stepSolomonVoiceQueue(source)
  }
}

function stepSolomonDigging(
  source: BoneyardSolomonEncounterState,
  players: SolomonContactPlayers,
  tick: number,
): BoneyardSolomonEncounterState {
  let rngState = source.rngState
  let digPhase = Math.fround(
    source.digPhase + Math.fround(1 / source.digTicksPerFrame),
  )
  let next = source
  if (digPhase > SOLOMON_DIG_SHOVEL_CURSOR && next.digShovelArmed) {
    const variant = drawNativeInteger(rngState, 2)
    rngState = variant.state
    next = appendDigEvent({
      ...next,
      digShovelArmed: false,
    }, variant.value === 0 ? 'shovel-1' : 'shovel-2', tick)
  }
  if (digPhase > SOLOMON_DIG_THROW_DIRT_CURSOR && next.digThrowDirtArmed) {
    const variant = drawNativeInteger(rngState, 2)
    rngState = variant.state
    next = appendDigEvent({
      ...next,
      digThrowDirtArmed: false,
    }, variant.value === 0 ? 'throw-dirt-1' : 'throw-dirt-2', tick)
  }
  if (
    digPhase > SOLOMON_DIG_THROW_DIRT_CURSOR
    || (
      digPhase > SOLOMON_DIG_SHOVEL_CURSOR
      && digPhase < SOLOMON_DIG_CURSOR_JITTER_END
    )
  ) {
    const jitter = drawNativeFloat(rngState, SOLOMON_DIG_CURSOR_JITTER_MAXIMUM)
    rngState = jitter.state
    digPhase = Math.fround(digPhase - jitter.value)
  }
  if (digPhase > source.digFrameProgram.length - SOLOMON_DIG_TAIL_PROGRAM_SLOTS) {
    digPhase = Math.fround(digPhase - SOLOMON_DIG_TAIL_SLOWDOWN)
  }
  const digBodyOffsetY = nativeSolomonDigBodyOffsetY(
    digPhase,
    source.digBodyBobAmplitude,
  )
  next = acquireSolomonTarget({
    ...next,
    digBodyOffsetY,
    digFrame: source.digFrameProgram[Math.floor(digPhase)] ?? 0,
    digPhase,
    rngState,
  }, players)
  if (next.phase !== 'digging') return next
  if (digPhase >= source.digFrameProgram.length) {
    digPhase = Math.fround(digPhase - source.digFrameProgram.length)
    const resume = drawNativeInteger(rngState, 2)
    rngState = resume.state
    if (resume.value === 1) digPhase = SOLOMON_DIG_SHOVEL_CURSOR
    const bodyBobAmplitude = drawNativeFloat(
      rngState,
      SOLOMON_DIG_BODY_BOB_AMPLITUDE_RANGE,
    )
    rngState = bodyBobAmplitude.state
    next = {
      ...next,
      digBodyBobAmplitude: Math.fround(
        bodyBobAmplitude.value + SOLOMON_DIG_BODY_BOB_AMPLITUDE_MINIMUM,
      ),
      digShovelArmed: true,
      digThrowDirtArmed: true,
    }
  }
  return {
    ...next,
    digBodyOffsetY,
    digFrame: source.digFrameProgram[Math.floor(digPhase)] ?? 0,
    digPhase,
    rngState,
  }
}

export function nativeSolomonDigBodyOffsetY(
  cursor: number,
  amplitude: number,
): number {
  if (!Number.isFinite(cursor) || !Number.isFinite(amplitude)) {
    throw new RangeError('Solomon dig body bob requires finite cursor and amplitude')
  }
  if (cursor <= SOLOMON_DIG_SHOVEL_CURSOR - 1 || cursor > SOLOMON_DIG_THROW_DIRT_CURSOR) {
    return 0
  }
  const degrees = Math.fround(
    Math.fround(cursor - (SOLOMON_DIG_SHOVEL_CURSOR - 1))
    / (SOLOMON_DIG_THROW_DIRT_CURSOR - SOLOMON_DIG_SHOVEL_CURSOR + 1)
    * 180,
  )
  const radians = Math.fround(degrees * Math.fround(Math.PI) / 180)
  return Math.fround(Math.fround(Math.sin(radians)) * amplitude)
}

function acquireSolomonTarget(
  source: BoneyardSolomonEncounterState,
  players: SolomonContactPlayers,
): BoneyardSolomonEncounterState {
  if (source.digPhase <= source.digFrameProgram.length - 10) return source
  let targetPlayerId: string | null = null
  let targetDistanceSquared = Number.POSITIVE_INFINITY
  for (const [playerId, player] of Object.entries(players)) {
    if (!solomonContactContains(source.position, player.position)) continue
    const dx = player.position.x - source.position.x
    const dy = player.position.y - source.position.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared >= targetDistanceSquared) continue
    targetDistanceSquared = distanceSquared
    targetPlayerId = playerId
  }
  if (targetPlayerId === null) return source
  if (source.digFrame < 6) {
    return {
      ...source,
      digPhase: 0,
      headingDeg: 180,
      phase: 'turning',
      targetPlayerId,
      transitionOffsetY: 15,
    }
  }
  if (source.digFrame < 16) {
    return {
      ...source,
      digPhase: 0,
      headingDeg: 225,
      phase: 'turning',
      targetPlayerId,
      transitionOffsetY: 6,
    }
  }
  return {
    ...source,
    digPhase: 0,
    headingDeg: 270,
    phase: 'turning',
    targetPlayerId,
    transitionOffsetY: 0,
  }
}

function faceSolomonTarget(
  source: BoneyardSolomonEncounterState,
  players: SolomonContactPlayers,
): BoneyardSolomonEncounterState {
  let targetPlayerId = source.targetPlayerId
  let target = targetPlayerId === null
    ? undefined
    : players[targetPlayerId]
  if (!target) {
    targetPlayerId = nearestSolomonPlayerId(source.position, players)
    target = targetPlayerId === null ? undefined : players[targetPlayerId]
  }
  if (!target) {
    return {
      ...source,
      targetPlayerId: null,
      transitionOffsetY: source.transitionOffsetY * 0.9,
    }
  }
  const desiredHeading = actorHeadingFromVector(
    target.position.x - source.position.x,
    target.position.y - source.position.y,
  )
  let headingDeg = source.headingDeg
  const turns = Math.trunc(source.turnRate) + 1
  for (let turn = 0; turn < turns; turn += 1) {
    headingDeg += nativeTurnDirection(headingDeg, desiredHeading)
  }
  headingDeg = normalizeNativeTurnHeading(headingDeg)
  const faced = {
    ...source,
    headingDeg,
    targetPlayerId,
    transitionOffsetY: source.transitionOffsetY * 0.9,
    turnRate: Math.min(SOLOMON_MAX_TURN_RATE, source.turnRate + 0.5),
  }
  if (source.phase !== 'turning' || Math.abs(headingDeg - desiredHeading) > 1) {
    return faced
  }
  if (source.dialogueMode === 'tutorial') {
    return {
      ...faced,
      phase: 'speaking',
      voiceTicksRemaining: source.tutorialDialogueTicks,
    }
  }
  const sample = drawNativeInteger(faced.rngState, 4)
  const cue = `solomon-hello-${sample.value + 1}` as BoneyardSolomonVoiceCue
  return appendVoiceEvent({
    ...faced,
    phase: 'speaking',
    rngState: sample.state,
  }, cue)
}

function nearestSolomonPlayerId(
  position: BoneyardPoint,
  players: SolomonContactPlayers,
): string | null {
  let nearestId: string | null = null
  let nearestDistanceSquared = Number.POSITIVE_INFINITY
  for (const playerId of Object.keys(players).sort()) {
    const player = players[playerId]!
    const dx = player.position.x - position.x
    const dy = player.position.y - position.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared >= nearestDistanceSquared) continue
    nearestDistanceSquared = distanceSquared
    nearestId = playerId
  }
  return nearestId
}

function stepSolomonHello(
  source: BoneyardSolomonEncounterState,
  players: SolomonContactPlayers,
): BoneyardSolomonEncounterState {
  const faced = faceSolomonTarget(source, players)
  if (faced.voiceTicksRemaining > 1) {
    return stepSolomonMouth({
      ...faced,
      voiceTicksRemaining: faced.voiceTicksRemaining - 1,
    })
  }
  return {
    ...faced,
    motion: faced.motion + 10,
    phase: 'retreat-hold',
    phaseTicksRemaining: SOLOMON_RETREAT_HOLD_TICKS,
    voiceTicksRemaining: 0,
  }
}

function stepSolomonMouth(
  source: BoneyardSolomonEncounterState,
): BoneyardSolomonEncounterState {
  if (source.mouthPoseTicksRemaining > 1) {
    return {
      ...source,
      mouthPoseTicksRemaining: source.mouthPoseTicksRemaining - 1,
    }
  }
  let rngState = source.rngState
  let mouthPose = source.mouthPose
  while (mouthPose === source.mouthPose) {
    const poseSample = drawNativeInteger(rngState, SOLOMON_MOUTH_POSE_COUNT)
    rngState = poseSample.state
    mouthPose = poseSample.value
  }
  const durationSample = drawNativeInteger(rngState, 25)
  return {
    ...source,
    mouthPose,
    mouthPoseTicksRemaining: 40 + 2 * durationSample.value,
    rngState: durationSample.state,
  }
}

function stepSolomonRetreatHold(
  source: BoneyardSolomonEncounterState,
): BoneyardSolomonEncounterState {
  const voiced = stepSolomonVoiceQueue(source)
  if (voiced.phaseTicksRemaining > 1) {
    return { ...voiced, phaseTicksRemaining: voiced.phaseTicksRemaining - 1 }
  }
  const headingDeg = nativeRetreatHeading(voiced.headingDeg)
  if (source.dialogueMode === 'tutorial') {
    return applySolomonRetreatAcceleration({
      ...voiced,
      acceleration: SOLOMON_RETREAT_ACCELERATION,
      headingDeg,
      motion: 0,
      phase: 'retreat-accelerating',
      phaseTicksRemaining: 0,
      queuedGetHimBoys: false,
    })
  }
  const started = appendVoiceEvent({
    ...voiced,
    acceleration: SOLOMON_RETREAT_ACCELERATION,
    headingDeg,
    motion: 0,
    phase: 'retreat-accelerating',
    phaseTicksRemaining: 0,
    queuedGetHimBoys: true,
  }, 'solomon-laugh-1')
  return applySolomonRetreatAcceleration(started)
}

function stepSolomonRetreatAcceleration(
  source: BoneyardSolomonEncounterState,
): BoneyardSolomonEncounterState {
  return applySolomonRetreatAcceleration(stepSolomonVoiceQueue(source))
}

function applySolomonRetreatAcceleration(
  source: BoneyardSolomonEncounterState,
): BoneyardSolomonEncounterState {
  const motion = source.motion + source.acceleration
  const next = {
    ...source,
    acceleration: source.acceleration + SOLOMON_RETREAT_ACCELERATION_STEP,
    motion,
    position: moveAlongHeading(
      source.position,
      source.headingDeg,
      SOLOMON_RETREAT_DISTANCE_PER_TICK,
    ),
  }
  if (motion <= 0) return next
  const headingSample = drawNativeInteger(next.rngState, 2)
  return {
    ...next,
    acceleration: SOLOMON_ESCAPE_INITIAL_ACCELERATION,
    escapeCollisionSourceIds: [],
    escapeSpeed: SOLOMON_ESCAPE_INITIAL_SPEED,
    escapeTarget: null,
    headingDeg: normalizeDegrees(
      next.headingDeg
      + (headingSample.value === 0 ? -1 : 1)
        * SOLOMON_ESCAPE_HEADING_DEFLECTION_DEGREES,
    ),
    lifetimeTicksRemaining: SOLOMON_ESCAPE_LIFETIME_TICKS,
    motion: 0,
    phase: 'escaping',
    rngState: headingSample.state,
    runEventId: source.runEventId + 1,
    walkCycle: 0,
  }
}

function stepSolomonEscape(
  source: BoneyardSolomonEncounterState,
): BoneyardSolomonEncounterState {
  const voiced = stepSolomonVoiceQueue(source)
  if (voiced.lifetimeTicksRemaining <= 0) {
    return {
      ...voiced,
      escapeCollisionSourceIds: [],
      escapeTarget: null,
      lifetimeTicksRemaining: 0,
      phase: 'gone',
    }
  }
  const escapeSpeed = voiced.escapeSpeed + SOLOMON_ESCAPE_SPEED_STEP
  const lifetimeTicksRemaining = voiced.lifetimeTicksRemaining - 1
  let motion = voiced.motion + voiced.acceleration
  let acceleration = voiced.acceleration + SOLOMON_ESCAPE_ACCELERATION_STEP
  if (motion > 0) {
    motion = 0
    acceleration = SOLOMON_ESCAPE_LANDING_ACCELERATION
  }
  return {
    ...voiced,
    acceleration,
    ...(lifetimeTicksRemaining === 0
      ? {
          escapeCollisionSourceIds: [],
          escapeTarget: null,
        }
      : {}),
    escapeSpeed,
    lifetimeTicksRemaining,
    motion,
    phase: lifetimeTicksRemaining === 0 ? 'gone' : 'escaping',
    position: moveAlongHeading(
      voiced.position,
      voiced.headingDeg,
      voiced.escapeSpeed,
    ),
    walkCycle: wrapCycle(
      voiced.walkCycle + escapeSpeed / 30,
      SOLOMON_WALK_POSE_COUNT,
    ),
  }
}

function stepSolomonVoiceQueue(
  source: BoneyardSolomonEncounterState,
): BoneyardSolomonEncounterState {
  if (source.voiceTicksRemaining > 1) {
    return { ...source, voiceTicksRemaining: source.voiceTicksRemaining - 1 }
  }
  if (source.voiceTicksRemaining === 1 && source.queuedGetHimBoys) {
    return appendVoiceEvent({
      ...source,
      queuedGetHimBoys: false,
      voiceTicksRemaining: 0,
    }, 'solomon-get-him-boys')
  }
  return source.voiceTicksRemaining === 0
    ? source
    : { ...source, voiceTicksRemaining: 0 }
}

function clipSolomonEscapeSegment(
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
  margin: number,
): BoneyardPoint {
  const dx = end.x - start.x
  const dy = end.y - start.y
  let progress = 1
  if (dx > 0) {
    progress = Math.min(progress, (bounds.x + bounds.w + margin - start.x) / dx)
  } else if (dx < 0) {
    progress = Math.min(progress, (bounds.x - margin - start.x) / dx)
  }
  if (dy > 0) {
    progress = Math.min(progress, (bounds.y + bounds.h + margin - start.y) / dy)
  } else if (dy < 0) {
    progress = Math.min(progress, (bounds.y - margin - start.y) / dy)
  }
  return {
    x: Math.fround(start.x + dx * progress),
    y: Math.fround(start.y + dy * progress),
  }
}

function appendVoiceEvent(
  source: BoneyardSolomonEncounterState,
  cue: BoneyardSolomonVoiceCue,
): BoneyardSolomonEncounterState {
  return {
    ...source,
    voiceEvents: [
      ...source.voiceEvents,
      { cue, id: source.voiceEvents.length + 1 },
    ],
    voiceTicksRemaining: SOLOMON_VOICE_DURATION_TICKS[cue],
  }
}

function appendDigEvent(
  source: BoneyardSolomonEncounterState,
  cue: BoneyardSolomonDigCue,
  tick: number,
): BoneyardSolomonEncounterState {
  const id = source.digEventId + 1
  return {
    ...source,
    digEventId: id,
    digEvents: [
      ...source.digEvents,
      { cue, id, tick },
    ].slice(-SOLOMON_DIG_EVENT_HISTORY_LIMIT),
  }
}

function clampRetreatHeading(headingDeg: number): number {
  if (headingDeg < 45) return 45
  if (headingDeg > 315) return 315
  return headingDeg
}

function nativeRetreatHeading(headingDeg: number): number {
  let reversed = headingDeg + 180
  if (reversed > 360) reversed -= 360
  if (reversed < 0) reversed += 360
  return clampRetreatHeading(reversed)
}

function moveAlongHeading(
  position: BoneyardPoint,
  headingDeg: number,
  distance: number,
): BoneyardPoint {
  const radians = headingDeg * Math.PI / 180
  return {
    x: position.x + Math.sin(radians) * distance,
    y: position.y - Math.cos(radians) * distance,
  }
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function normalizeNativeTurnHeading(value: number): number {
  if (value < 0) return value + 360
  if (value > 360) return value - 360
  return value
}

function nativeTurnDirection(current: number, target: number): -1 | 0 | 1 {
  const normalizedCurrent = normalizeDegrees(current)
  const normalizedTarget = normalizeDegrees(target)
  const difference = Math.abs(normalizedCurrent - normalizedTarget)
  if (difference < 1 || difference >= 359) return 0
  if (normalizedTarget <= normalizedCurrent) {
    return normalizedCurrent - normalizedTarget <= 180 ? -1 : 1
  }
  return normalizedTarget - normalizedCurrent > 180 ? -1 : 1
}

function wrapCycle(value: number, length: number): number {
  return value > length ? value - length : value
}

function seedState(seed: string): number {
  let state = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 0x01000193)
  }
  return state >>> 0 || 0x6d2b79f5
}
