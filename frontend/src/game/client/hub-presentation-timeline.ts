import type {
  GameSnapshot,
  HubWorldSnapshot,
  ProtocolAmbientState,
  ProtocolFountainParticleState,
  ProtocolHubParticipantState,
  ProtocolPlayerState,
  ProtocolStudentState,
} from '../protocol/game-state.ts'
import {
  copyPrimarySpellState,
  interpolatePrimarySpellState,
} from './primary-spell-presentation.ts'
import {
  copyNativeSecondaryState,
  interpolateNativeSecondaryState,
} from './native-secondary-presentation.ts'
import {
  HUB_COLLEGE_INTRO_FADE_RATE,
  HUB_INCOMING_FADE_RATES,
  HUB_OUTGOING_FADE_RATE,
} from '../core-kernels/hub-regions.ts'
import {
  NATIVE_COLLEGE_COVER_FADE_RATE,
  NATIVE_COLLEGE_TITLE_CURSOR_STEP,
} from '../core-kernels/native-college-intro.ts'
import { copyHubMemorialState } from '../core-kernels/hub-memorial.ts'
import { freezeNativeBelt } from '../core-kernels/native-belt.ts'

export type HubGameSnapshot = Omit<GameSnapshot, 'world'> & {
  world: HubWorldSnapshot
}

export interface HubPresentationFrame extends Omit<HubGameSnapshot, 'tick'> {
  /** Fractional authoritative tick represented by this display frame. */
  tick: number
}

export interface HubPresentationTimeline {
  latest(): HubGameSnapshot
  push(snapshot: HubGameSnapshot, receivedAtMs: number): void
  sample(nowMs: number): HubPresentationFrame
}

export interface HubPresentationTimelineOptions {
  initialReceivedAtMs: number
  initialSnapshot: HubGameSnapshot
  localPlayerId: string
  serverTickRate: number
  snapshotRate: number
}

interface TimedSnapshot {
  receivedAtMs: number
  snapshot: HubGameSnapshot
}

const MAX_BUFFERED_SNAPSHOTS = 8
const WALK_FRAME_COUNT = 5
const HEADING_COUNT = 24
const FULL_CIRCLE = 360
const SEAL_TRACK_LENGTH = 3

/**
 * Owns the display-time interpretation of authoritative Hub snapshots.
 * Remote/world state is intentionally one network interval behind so every
 * display frame has two server states to interpolate between. The local
 * player stays on the newest reconciled state and receives bounded prediction
 * in GameClientSession.
 */
export function createHubPresentationTimeline(
  options: HubPresentationTimelineOptions,
): HubPresentationTimeline {
  requirePositiveFinite(options.serverTickRate, 'serverTickRate')
  requirePositiveFinite(options.snapshotRate, 'snapshotRate')
  requireFinite(options.initialReceivedAtMs, 'initialReceivedAtMs')

  const intervalTicks = Math.max(1, options.serverTickRate / options.snapshotRate)
  const history: TimedSnapshot[] = [{
    receivedAtMs: options.initialReceivedAtMs,
    snapshot: options.initialSnapshot,
  }]

  return {
    latest: () => history.at(-1)!.snapshot,
    push(snapshot, receivedAtMs) {
      requireFinite(receivedAtMs, 'receivedAtMs')
      const latest = history.at(-1)!
      if (snapshot.tick < latest.snapshot.tick) return
      if (snapshot.tick === latest.snapshot.tick) {
        history[history.length - 1] = {
          receivedAtMs: latest.receivedAtMs,
          snapshot,
        }
        return
      }
      history.push({ receivedAtMs, snapshot })
      if (history.length > MAX_BUFFERED_SNAPSHOTS) history.shift()
    },
    sample(nowMs) {
      requireFinite(nowMs, 'nowMs')
      const newest = history.at(-1)!
      const elapsedTicks = clamp(
        (nowMs - newest.receivedAtMs) * options.serverTickRate / 1000,
        0,
        intervalTicks,
      )
      const frame = history.length === 1
        ? presentationCopy(newest.snapshot)
        : interpolatedFrame(history, newest, intervalTicks, elapsedTicks)

      const localPlayer = newest.snapshot.players[options.localPlayerId]
      if (localPlayer) {
        frame.players = {
          ...frame.players,
          [options.localPlayerId]: copyPlayer(localPlayer),
        }
      }
      const localParticipant = newest.snapshot.world.participants[options.localPlayerId]
      if (localParticipant) {
        frame.world = {
          ...frame.world,
          participants: {
            ...frame.world.participants,
            [options.localPlayerId]: projectLocalParticipant(
              localParticipant,
              elapsedTicks,
            ),
          },
        }
      }
      return frame
    },
  }
}

function interpolatedFrame(
  history: readonly TimedSnapshot[],
  newest: TimedSnapshot,
  intervalTicks: number,
  elapsedTicks: number,
): HubPresentationFrame {
  const targetTick = newest.snapshot.tick - intervalTicks + elapsedTicks
  const [older, newer] = bracketSnapshots(history, targetTick)
  const span = newer.snapshot.tick - older.snapshot.tick
  const blend = span <= 0 ? 1 : clamp((targetTick - older.snapshot.tick) / span, 0, 1)
  return interpolateSnapshot(older.snapshot, newer.snapshot, blend, targetTick)
}

function projectLocalParticipant(
  participant: ProtocolHubParticipantState,
  elapsedTicks: number,
): ProtocolHubParticipantState {
  const result = copyParticipant(participant)
  if (result.collegeIntro?.phase === 'courtyard-walk') {
    result.collegeIntro = {
      ...result.collegeIntro,
      coverAlpha: clamp(
        result.collegeIntro.coverAlpha - NATIVE_COLLEGE_COVER_FADE_RATE * elapsedTicks,
        0,
        1,
      ),
      titleCursor: clamp(
        result.collegeIntro.titleCursor + NATIVE_COLLEGE_TITLE_CURSOR_STEP * elapsedTicks,
        0,
        5,
      ),
    }
  }
  if (!result.transition) return result
  const delta = result.transition.phase === 'college-loadout'
    ? 0
    : result.transition.phase === 'college-intro'
      ? -HUB_COLLEGE_INTRO_FADE_RATE * elapsedTicks
      : result.transition.phase === 'outgoing'
        ? HUB_OUTGOING_FADE_RATE * elapsedTicks
        : -HUB_INCOMING_FADE_RATES[result.region] * elapsedTicks
  result.transition.alpha = clamp(result.transition.alpha + delta, 0, 1)
  return result
}

export function isHubGameSnapshot(snapshot: GameSnapshot): snapshot is HubGameSnapshot {
  return snapshot.world.kind === 'hub'
}

function bracketSnapshots(
  history: readonly TimedSnapshot[],
  targetTick: number,
): readonly [TimedSnapshot, TimedSnapshot] {
  if (targetTick <= history[0].snapshot.tick) return [history[0], history[0]]
  for (let index = 1; index < history.length; index += 1) {
    if (targetTick <= history[index].snapshot.tick) return [history[index - 1], history[index]]
  }
  const latest = history.at(-1)!
  return [latest, latest]
}

function interpolateSnapshot(
  older: HubGameSnapshot,
  newer: HubGameSnapshot,
  blend: number,
  targetTick: number,
): HubPresentationFrame {
  const players: Record<string, ProtocolPlayerState> = {}
  for (const [playerId, olderPlayer] of Object.entries(older.players)) {
    const newerPlayer = newer.players[playerId]
    players[playerId] = newerPlayer
      ? interpolatePlayer(olderPlayer, newerPlayer, blend)
      : copyPlayer(olderPlayer)
  }
  if (blend >= 1) {
    for (const [playerId, newerPlayer] of Object.entries(newer.players)) {
      if (!players[playerId]) players[playerId] = copyPlayer(newerPlayer)
    }
  }

  return {
    hostPlayerId: blend < 1 ? older.hostPlayerId : newer.hostPlayerId,
    levelUpBarrier: blend < 1 ? older.levelUpBarrier : newer.levelUpBarrier,
    materializingPlayerIds: blend < 1
      ? older.materializingPlayerIds
      : newer.materializingPlayerIds,
    modEffects: blend < 1 ? older.modEffects : newer.modEffects,
    players,
    primarySpells: interpolatePrimarySpellState(
      older.primarySpells,
      newer.primarySpells,
      blend,
      { newerTick: newer.tick, olderTick: older.tick, targetTick },
    ),
    secondaryAbilities: interpolateNativeSecondaryState(
      older.secondaryAbilities,
      newer.secondaryAbilities,
      blend,
    ),
    run: blend < 1 ? older.run : newer.run,
    tick: clamp(targetTick, older.tick, newer.tick),
    world: {
      ambient: interpolateAmbient(older.world.ambient, newer.world.ambient, blend),
      collisionRngState: blend < 1
        ? older.world.collisionRngState
        : newer.world.collisionRngState,
      kind: 'hub',
      memorial: copyHubMemorialState(
        blend < 1 ? older.world.memorial : newer.world.memorial,
      ),
      participants: interpolateParticipants(
        older.world.participants,
        newer.world.participants,
        blend,
      ),
      skorcha: (blend < 1 ? older.world.skorcha : newer.world.skorcha) === null
        ? null
        : {
            ...(blend < 1 ? older.world.skorcha! : newer.world.skorcha!),
            position: {
              ...(blend < 1 ? older.world.skorcha! : newer.world.skorcha!).position,
            },
          },
      students: interpolateStudents(older.world.students, newer.world.students, blend),
      traderAnimationSeed: blend < 1
        ? older.world.traderAnimationSeed
        : newer.world.traderAnimationSeed,
    },
  }
}

function interpolateParticipants(
  older: Readonly<Record<string, ProtocolHubParticipantState>>,
  newer: Readonly<Record<string, ProtocolHubParticipantState>>,
  blend: number,
): Record<string, ProtocolHubParticipantState> {
  const result: Record<string, ProtocolHubParticipantState> = {}
  for (const [playerId, olderParticipant] of Object.entries(older)) {
    const newerParticipant = newer[playerId]
    result[playerId] = newerParticipant
      ? interpolateParticipant(olderParticipant, newerParticipant, blend)
      : copyParticipant(olderParticipant)
  }
  if (blend >= 1) {
    for (const [playerId, participant] of Object.entries(newer)) {
      if (!result[playerId]) result[playerId] = copyParticipant(participant)
    }
    for (const playerId of Object.keys(result)) {
      if (!newer[playerId]) delete result[playerId]
    }
  }
  return result
}

function interpolateParticipant(
  older: ProtocolHubParticipantState,
  newer: ProtocolHubParticipantState,
  blend: number,
): ProtocolHubParticipantState {
  const first = older.transition
  const second = newer.transition
  if (
    first
    && second
    && first.phase === second.phase
    && first.destination === second.destination
    && first.sourceRegion === second.sourceRegion
  ) {
    return {
      activity: blend < 1 ? older.activity : newer.activity,
      collegeIntro: interpolateCollegeIntro(older, newer, blend),
      region: blend < 1 ? older.region : newer.region,
      transition: {
        ...second,
        alpha: lerp(first.alpha, second.alpha, blend),
        scriptedSpeed: lerp(first.scriptedSpeed, second.scriptedSpeed, blend),
        scriptedTarget: {
          x: lerp(first.scriptedTarget.x, second.scriptedTarget.x, blend),
          y: lerp(first.scriptedTarget.y, second.scriptedTarget.y, blend),
        },
      },
    }
  }
  return copyParticipant(blend < 1 ? older : newer)
}

function interpolateCollegeIntro(
  older: ProtocolHubParticipantState,
  newer: ProtocolHubParticipantState,
  blend: number,
): ProtocolHubParticipantState['collegeIntro'] {
  const first = older.collegeIntro
  const second = newer.collegeIntro
  if (!first || !second || first.phase !== second.phase) {
    return copyParticipant(blend < 1 ? older : newer).collegeIntro
  }
  return {
    ...second,
    contactCounter: blend < 1 ? first.contactCounter : second.contactCounter,
    coverAlpha: lerp(first.coverAlpha, second.coverAlpha, blend),
    dialogueSequence: blend < 1 ? first.dialogueSequence : second.dialogueSequence,
    officeSpeed: lerp(first.officeSpeed, second.officeSpeed, blend),
    pathCursor: lerp(first.pathCursor, second.pathCursor, blend),
    titleCursor: lerp(first.titleCursor, second.titleCursor, blend),
  }
}

function interpolatePlayer(
  older: ProtocolPlayerState,
  newer: ProtocolPlayerState,
  blend: number,
): ProtocolPlayerState {
  const discrete = blend < 1 ? older : newer
  const damageX4Delta = older.progression.damageX4TicksRemaining
    - newer.progression.damageX4TicksRemaining
  const damageX4TicksRemaining = older.progression.damageX4TicksRemaining > 0
    && newer.progression.damageX4TicksRemaining > 0
    && damageX4Delta >= 0
    && damageX4Delta <= 10
    ? lerp(
        older.progression.damageX4TicksRemaining,
        newer.progression.damageX4TicksRemaining,
        blend,
      )
    : discrete.progression.damageX4TicksRemaining
  return {
    belt: discrete.belt,
    config: { ...discrete.config },
    economy: discrete.economy,
    footstepTick: discrete.footstepTick,
    gaitDegrees: lerpCycle(older.gaitDegrees, newer.gaitDegrees, blend, FULL_CIRCLE),
    headingIndex: Math.round(lerpCycle(
      older.headingIndex,
      newer.headingIndex,
      blend,
      HEADING_COUNT,
    )) % HEADING_COUNT,
    lighting: {
      ...discrete.lighting,
      lightRegistration: { ...discrete.lighting.lightRegistration },
      overlayEffectPhase: lerp(
        older.lighting.overlayEffectPhase,
        newer.lighting.overlayEffectPhase,
        blend,
      ),
    },
    movementScale: discrete.movementScale,
    position: {
      x: lerp(older.position.x, newer.position.x, blend),
      y: lerp(older.position.y, newer.position.y, blend),
    },
    primaryCast: {
      ...discrete.primaryCast,
      aimDirection: { ...discrete.primaryCast.aimDirection },
      etherBlastCharge: lerp(
        older.primaryCast.etherBlastCharge,
        newer.primaryCast.etherBlastCharge,
        blend,
      ),
      weaponPulse: lerp(
        older.primaryCast.weaponPulse,
        newer.primaryCast.weaponPulse,
        blend,
      ),
    },
    progression: {
      ...discrete.progression,
      damageX4TicksRemaining,
    },
    velocity: {
      x: lerp(older.velocity.x, newer.velocity.x, blend),
      y: lerp(older.velocity.y, newer.velocity.y, blend),
    },
    walkCyclePrimary: lerpCycle(
      older.walkCyclePrimary,
      newer.walkCyclePrimary,
      blend,
      WALK_FRAME_COUNT,
    ),
  }
}

function interpolateStudents(
  older: readonly ProtocolStudentState[],
  newer: readonly ProtocolStudentState[],
  blend: number,
): ProtocolStudentState[] {
  const newerById = new Map(newer.map((student) => [student.id, student]))
  const students = older.map((olderStudent) => {
    const newerStudent = newerById.get(olderStudent.id)
    return newerStudent
      ? interpolateStudent(olderStudent, newerStudent, blend)
      : copyStudent(olderStudent)
  })
  if (blend >= 1) {
    const knownIds = new Set(students.map((student) => student.id))
    for (const newerStudent of newer) {
      if (!knownIds.has(newerStudent.id)) students.push(copyStudent(newerStudent))
    }
    return students.filter((student) => newerById.has(student.id))
  }
  return students
}

function interpolateStudent(
  older: ProtocolStudentState,
  newer: ProtocolStudentState,
  blend: number,
): ProtocolStudentState {
  const discrete = blend < 1 ? older : newer
  return {
    ...discrete,
    framePhase: lerpCycle(older.framePhase, newer.framePhase, blend, WALK_FRAME_COUNT),
    gaitDegrees: lerpCycle(older.gaitDegrees, newer.gaitDegrees, blend, FULL_CIRCLE),
    heading: lerpCycle(older.heading, newer.heading, blend, FULL_CIRCLE),
    headingIndex: Math.round(lerpCycle(
      older.headingIndex,
      newer.headingIndex,
      blend,
      HEADING_COUNT,
    )) % HEADING_COUNT,
    position: {
      x: lerp(older.position.x, newer.position.x, blend),
      y: lerp(older.position.y, newer.position.y, blend),
    },
  }
}

function interpolateAmbient(
  older: ProtocolAmbientState,
  newer: ProtocolAmbientState,
  blend: number,
): ProtocolAmbientState {
  return {
    fountainParticles: interpolateFountainParticles(
      older.fountainParticles,
      newer.fountainParticles,
      blend,
    ),
    nextFountainParticleId: blend < 1
      ? older.nextFountainParticleId
      : newer.nextFountainParticleId,
    rngState: blend < 1 ? older.rngState : newer.rngState,
    sealCorePhase: lerpCycle(
      older.sealCorePhase,
      newer.sealCorePhase,
      blend,
      SEAL_TRACK_LENGTH,
    ),
    sealGlyphPhase: lerpCycle(
      older.sealGlyphPhase,
      newer.sealGlyphPhase,
      blend,
      SEAL_TRACK_LENGTH,
    ),
    statuePhaseDegrees: lerpCycle(
      older.statuePhaseDegrees,
      newer.statuePhaseDegrees,
      blend,
      FULL_CIRCLE,
    ),
  }
}

function interpolateFountainParticles(
  older: readonly ProtocolFountainParticleState[],
  newer: readonly ProtocolFountainParticleState[],
  blend: number,
): ProtocolFountainParticleState[] {
  const newerById = new Map(newer.map((particle) => [particle.id, particle]))
  const particles = older.map((olderParticle) => {
    const newerParticle = newerById.get(olderParticle.id)
    return newerParticle
      ? {
          id: olderParticle.id,
          remaining: lerp(olderParticle.remaining, newerParticle.remaining, blend),
          scale: lerp(olderParticle.scale, newerParticle.scale, blend),
        }
      : { ...olderParticle }
  })
  if (blend >= 1) {
    const knownIds = new Set(particles.map((particle) => particle.id))
    for (const newerParticle of newer) {
      if (!knownIds.has(newerParticle.id)) particles.push({ ...newerParticle })
    }
    return particles.filter((particle) => newerById.has(particle.id))
  }
  return particles
}

function presentationCopy(snapshot: HubGameSnapshot): HubPresentationFrame {
  return {
    hostPlayerId: snapshot.hostPlayerId,
    levelUpBarrier: snapshot.levelUpBarrier,
    materializingPlayerIds: snapshot.materializingPlayerIds,
    modEffects: snapshot.modEffects,
    players: Object.fromEntries(
      Object.entries(snapshot.players).map(([id, player]) => [id, copyPlayer(player)]),
    ),
    primarySpells: copyPrimarySpellState(snapshot.primarySpells),
    secondaryAbilities: copyNativeSecondaryState(snapshot.secondaryAbilities),
    run: snapshot.run,
    tick: snapshot.tick,
    world: {
      ambient: interpolateAmbient(snapshot.world.ambient, snapshot.world.ambient, 0),
      collisionRngState: snapshot.world.collisionRngState,
      kind: 'hub',
      memorial: copyHubMemorialState(snapshot.world.memorial),
      participants: Object.fromEntries(
        Object.entries(snapshot.world.participants).map(([id, participant]) => [
          id,
          copyParticipant(participant),
        ]),
      ),
      skorcha: snapshot.world.skorcha === null ? null : {
        ...snapshot.world.skorcha,
        position: { ...snapshot.world.skorcha.position },
      },
      students: snapshot.world.students.map(copyStudent),
      traderAnimationSeed: snapshot.world.traderAnimationSeed,
    },
  }
}

function copyParticipant(
  participant: ProtocolHubParticipantState,
): ProtocolHubParticipantState {
  return {
    activity: participant.activity,
    collegeIntro: participant.collegeIntro ? { ...participant.collegeIntro } : null,
    region: participant.region,
    transition: participant.transition
      ? {
          ...participant.transition,
          scriptedTarget: { ...participant.transition.scriptedTarget },
        }
      : null,
  }
}

function copyPlayer(player: ProtocolPlayerState): ProtocolPlayerState {
  return {
    ...player,
    belt: freezeNativeBelt(player.belt.map((entry) => entry && { ...entry })),
    config: { ...player.config },
    lighting: {
      ...player.lighting,
      lightRegistration: { ...player.lighting.lightRegistration },
    },
    position: { ...player.position },
    primaryCast: {
      ...player.primaryCast,
      aimDirection: { ...player.primaryCast.aimDirection },
    },
    progression: {
      ...player.progression,
      hagathaRuntime: { ...player.progression.hagathaRuntime },
      learnedSkills: player.progression.learnedSkills.map((entry) => [...entry]),
      secondaryManaCosts: player.progression.secondaryManaCosts.map((entry) => [...entry]),
      weldComponentRanks: player.progression.weldComponentRanks === null
        ? null
        : [...player.progression.weldComponentRanks],
    },
    velocity: { ...player.velocity },
  }
}

function copyStudent(student: ProtocolStudentState): ProtocolStudentState {
  return {
    ...student,
    position: { ...student.position },
    props: student.props.map((prop) => ({ ...prop })),
  }
}

function lerp(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
}

export function lerpCycle(
  first: number,
  second: number,
  blend: number,
  period: number,
): number {
  const normalizedFirst = modulo(first, period)
  const normalizedSecond = modulo(second, period)
  let delta = normalizedSecond - normalizedFirst
  if (delta > period / 2) delta -= period
  else if (delta < -period / 2) delta += period
  return modulo(normalizedFirst + delta * blend, period)
}

function modulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`)
}

function requirePositiveFinite(value: number, name: string): void {
  requireFinite(value, name)
  if (value <= 0) throw new Error(`${name} must be positive`)
}
