import type { BoneyardArenaTransitionState } from '../core-kernels/boneyard-arena-transition.ts'
import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import type { GameRunLifecycleState } from '../core-kernels/game-run.ts'
import { freezeNativeBelt } from '../core-kernels/native-belt.ts'
import { interpolateNativeHardenCoating } from '../core-kernels/native-harden.ts'
import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import type {
  BoneyardGoodieSnapshot,
  BoneyardLootEventSnapshot,
  BoneyardLootSnapshot,
  BoneyardSolomonSnapshot,
  BoneyardWaveSnapshot,
  BoneyardWorldSnapshot,
  GameClientSnapshot,
  GameSnapshot,
  ProtocolPlayerState,
} from '../protocol/game-state.ts'
import { createGameClientSnapshot } from '../protocol/primary-spell-hail-replication.ts'
import { copyBoneyardEnemySamples, interpolateBoneyardEnemySamples, copyLightRegistration } from './boneyard-enemy-samples.ts'
import { lerpCycle } from './hub-presentation-timeline.ts'
import {
  copyNativeSecondaryState,
  interpolateNativeSecondaryState,
} from './native-secondary-presentation.ts'
import { FULL_CIRCLE, clamp, lerp } from './presentation-math.ts'
import {
  type RetainedBoneyardPrimarySpellPresentation,
  createRetainedBoneyardPrimarySpellPresentation,
} from './primary-spell-retained-hail-presentation.ts'

type BoneyardClientGameSnapshot = Omit<GameClientSnapshot, 'world'> & {
  world: BoneyardWorldSnapshot
}

type BoneyardAuthoritySnapshot = Omit<GameSnapshot, 'world'> & {
  world: BoneyardWorldSnapshot
}

export type BoneyardGameSnapshot = BoneyardAuthoritySnapshot | BoneyardClientGameSnapshot

type BoneyardSnapshotSource = BoneyardGameSnapshot

export interface BoneyardPresentationFrame extends Omit<
  BoneyardClientGameSnapshot,
  'primarySpells' | 'tick'
> {
  primarySpells: PrimarySpellSimulationState
  tick: number
}

export interface BoneyardPresentationTimeline {
  latest(): BoneyardClientGameSnapshot
  push(snapshot: BoneyardSnapshotSource, receivedAtMs: number): void
  sample(nowMs: number): BoneyardPresentationFrame
}

export interface BoneyardPresentationTimelineOptions {
  initialReceivedAtMs: number
  initialSnapshot: BoneyardSnapshotSource
  serverTickRate: number
  snapshotRate: number
}

interface TimedSnapshot {
  presentationStartTick: number
  receivedAtMs: number
  snapshot: BoneyardClientGameSnapshot
}

const MAX_BUFFERED_SNAPSHOTS = 8

const WALK_FRAME_COUNT = 5

const SOLOMON_WALK_FRAME_COUNT = 6

const HEADING_COUNT = 24

export function createBoneyardPresentationTimeline(
  options: BoneyardPresentationTimelineOptions,
): BoneyardPresentationTimeline {
  requirePositiveFinite(options.serverTickRate, 'serverTickRate')
  requirePositiveFinite(options.snapshotRate, 'snapshotRate')
  requireFinite(options.initialReceivedAtMs, 'initialReceivedAtMs')
  const intervalTicks = Math.max(1, options.serverTickRate / options.snapshotRate)
  const history: TimedSnapshot[] = [{
    presentationStartTick: options.initialSnapshot.tick,
    receivedAtMs: options.initialReceivedAtMs,
    snapshot: clientBoneyardSnapshot(options.initialSnapshot),
  }]
  const primarySpellPresentation = createRetainedBoneyardPrimarySpellPresentation()

  return {
    latest: () => history.at(-1)!.snapshot,
    push(snapshot, receivedAtMs) {
      requireFinite(receivedAtMs, 'receivedAtMs')
      const clientSnapshot = clientBoneyardSnapshot(snapshot)
      const latest = history.at(-1)!
      if (clientSnapshot.tick < latest.snapshot.tick) return
      if (clientSnapshot.tick === latest.snapshot.tick) {
        history[history.length - 1] = {
          presentationStartTick: latest.presentationStartTick,
          receivedAtMs: latest.receivedAtMs,
          snapshot: clientSnapshot,
        }
        return
      }
      history.push({
        presentationStartTick: Math.max(
          clientSnapshot.tick - intervalTicks,
          presentationTargetTick(latest, receivedAtMs, options.serverTickRate),
        ),
        receivedAtMs,
        snapshot: clientSnapshot,
      })
      if (history.length > MAX_BUFFERED_SNAPSHOTS) history.shift()
    },
    sample(nowMs) {
      requireFinite(nowMs, 'nowMs')
      const newest = history.at(-1)!
      if (history.length === 1) {
        return presentationCopy(newest.snapshot, primarySpellPresentation)
      }
      const targetTick = presentationTargetTick(newest, nowMs, options.serverTickRate)
      const [older, newer] = bracketSnapshots(history, targetTick)
      const span = newer.snapshot.tick - older.snapshot.tick
      const blend = span <= 0 ? 1 : clamp(
        (targetTick - older.snapshot.tick) / span,
        0,
        1,
      )
      return interpolateSnapshot(
        older.snapshot,
        newer.snapshot,
        blend,
        targetTick,
        primarySpellPresentation,
      )
    },
  }
}

function presentationTargetTick(
  newest: TimedSnapshot,
  nowMs: number,
  serverTickRate: number,
): number {
  const elapsedTicks = Math.max(0, nowMs - newest.receivedAtMs) * serverTickRate / 1_000
  return Math.min(newest.snapshot.tick, newest.presentationStartTick + elapsedTicks)
}

export function isBoneyardGameSnapshot(
  snapshot: GameClientSnapshot | GameSnapshot,
): snapshot is BoneyardSnapshotSource {
  return snapshot.world.kind === 'boneyard'
}

function clientBoneyardSnapshot(
  snapshot: BoneyardSnapshotSource,
): BoneyardClientGameSnapshot {
  if ('hail' in snapshot.primarySpells) return snapshot as BoneyardClientGameSnapshot
  return createGameClientSnapshot(snapshot) as BoneyardClientGameSnapshot
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
  older: BoneyardClientGameSnapshot,
  newer: BoneyardClientGameSnapshot,
  blend: number,
  targetTick: number,
  primarySpellPresentation: RetainedBoneyardPrimarySpellPresentation,
): BoneyardPresentationFrame {
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
    primarySpells: primarySpellPresentation.interpolateFrame(
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
    run: interpolateGameRunLifecycle(older.run, newer.run, blend),
    tick: clamp(targetTick, older.tick, newer.tick),
    world: {
      ...interpolateBoneyardEnemySamples(older.world, newer.world, blend, targetTick),
      arenaTransition: interpolateArenaTransition(
        older.world.arenaTransition,
        newer.world.arenaTransition,
        blend,
      ),
      encounter: interpolateSolomon(
        older.world.encounter,
        newer.world.encounter,
        blend,
      ),
      gateLeaves: interpolateGateLeaves(
        older.world.gateLeaves,
        newer.world.gateLeaves,
        blend,
      ),
      goodies: (blend < 1 ? older.world.goodies : newer.world.goodies)
        .map(copyGoodie),
      hallOfFameRuns: copyHallOfFameRuns(
        (blend < 1 ? older : newer).world.hallOfFameRuns,
      ),
      kind: 'boneyard',
      lanternLightRegistration: copyLightRegistration(
        (blend < 1 ? older : newer).world.lanternLightRegistration,
      ),
      lanternPosition: interpolateLanternPosition(
        older.world.lanternPosition, newer.world.lanternPosition, blend,
      ),
      loot: interpolateLoot(older.world.loot, newer.world.loot, blend),
      lootEvents: (blend < 1 ? older.world.lootEvents : newer.world.lootEvents)
        .map(copyLootEvent),
      runId: newer.world.runId,
      solomonPainterRegistration: copyLightRegistration(
        (blend < 1 ? older : newer).world.solomonPainterRegistration,
      ),
      tutorial: interpolateTutorial(
        older.world.tutorial,
        newer.world.tutorial,
        blend,
      ),
      waves: interpolateWaves(older.world.waves, newer.world.waves, blend),
    },
  }
}

function interpolateGameRunLifecycle(
  older: GameRunLifecycleState,
  newer: GameRunLifecycleState,
  blend: number,
): GameRunLifecycleState {
  const discrete = blend < 1 ? older : newer
  const sameGameOver = older.phase === 'game-over'
    && newer.phase === 'game-over'
    && older.runId === newer.runId
    && older.gameOverEventId === newer.gameOverEventId
  if (!sameGameOver) return discrete
  return {
    ...discrete,
    gameOverExitTicks: older.gameOverExitTicks !== null
      && newer.gameOverExitTicks !== null
      ? Math.floor(lerp(older.gameOverExitTicks, newer.gameOverExitTicks, blend))
      : discrete.gameOverExitTicks,
    gameOverTicks: Math.floor(lerp(older.gameOverTicks, newer.gameOverTicks, blend)),
  }
}

function interpolatePlayer(
  older: ProtocolPlayerState,
  newer: ProtocolPlayerState,
  blend: number,
): ProtocolPlayerState {
  const discrete = blend < 1 ? older : newer
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
      deathWeaponPainterRegistration:
        discrete.lighting.deathWeaponPainterRegistration === null
          ? null
          : { ...discrete.lighting.deathWeaponPainterRegistration },
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
    progression: interpolatePlayerProgression(older, newer, blend),
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

function interpolatePlayerProgression(
  older: ProtocolPlayerState,
  newer: ProtocolPlayerState,
  blend: number,
): ProtocolPlayerState['progression'] {
  const first = older.progression
  const second = newer.progression
  const discrete = blend < 1 ? first : second
  const sameDeathEpoch = first.deathEpoch === second.deathEpoch
    && (first.lifeState === 'dying' || first.lifeState === 'spectating')
    && (second.lifeState === 'dying' || second.lifeState === 'spectating')
  const damageX4Delta = first.damageX4TicksRemaining - second.damageX4TicksRemaining
  const damageX4TicksRemaining = first.damageX4TicksRemaining > 0
    && second.damageX4TicksRemaining > 0
    && damageX4Delta >= 0
    && damageX4Delta <= 10
    ? lerp(first.damageX4TicksRemaining, second.damageX4TicksRemaining, blend)
    : discrete.damageX4TicksRemaining
  return {
    ...discrete,
    damageX4TicksRemaining,
    hardenCoating: interpolateNativeHardenCoating(
      first.hardenCoating, second.hardenCoating,
      older.primaryCast.castSequence === newer.primaryCast.castSequence, blend,
    ),
    ...(sameDeathEpoch
      ? { deathTick: Math.floor(lerp(first.deathTick, second.deathTick, blend)) }
      : {}),
  }
}

function interpolateGateLeaves(
  older: readonly BoneyardGateLeafSnapshot[],
  newer: readonly BoneyardGateLeafSnapshot[],
  blend: number,
): BoneyardGateLeafSnapshot[] {
  const newerById = new Map(newer.map((leaf) => [leaf.id, leaf]))
  const leaves = older.map((olderLeaf) => {
    const newerLeaf = newerById.get(olderLeaf.id)
    if (!newerLeaf) return copyGateLeaf(olderLeaf)
    return {
      fenceEid: blend < 1 ? olderLeaf.fenceEid : newerLeaf.fenceEid,
      hinge: {
        x: lerp(olderLeaf.hinge.x, newerLeaf.hinge.x, blend),
        y: lerp(olderLeaf.hinge.y, newerLeaf.hinge.y, blend),
      },
      id: olderLeaf.id,
      side: blend < 1 ? olderLeaf.side : newerLeaf.side,
      tip: {
        x: lerp(olderLeaf.tip.x, newerLeaf.tip.x, blend),
        y: lerp(olderLeaf.tip.y, newerLeaf.tip.y, blend),
      },
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(leaves.map((leaf) => leaf.id))
    for (const newerLeaf of newer) {
      if (!knownIds.has(newerLeaf.id)) leaves.push(copyGateLeaf(newerLeaf))
    }
    return leaves.filter((leaf) => newerById.has(leaf.id))
  }
  return leaves
}

function presentationCopy(
  snapshot: BoneyardClientGameSnapshot,
  primarySpellPresentation: RetainedBoneyardPrimarySpellPresentation,
): BoneyardPresentationFrame {
  return {
    hostPlayerId: snapshot.hostPlayerId,
    levelUpBarrier: snapshot.levelUpBarrier,
    materializingPlayerIds: snapshot.materializingPlayerIds,
    modEffects: snapshot.modEffects,
    players: Object.fromEntries(Object.entries(snapshot.players).map(([id, player]) => [
      id,
      copyPlayer(player),
    ])),
    primarySpells: primarySpellPresentation.copyFrame(
      snapshot.primarySpells,
      snapshot.tick,
    ),
    secondaryAbilities: copyNativeSecondaryState(snapshot.secondaryAbilities),
    run: snapshot.run,
    tick: snapshot.tick,
    world: {
      ...copyBoneyardEnemySamples(snapshot.world, snapshot.tick),
      arenaTransition: copyArenaTransition(snapshot.world.arenaTransition),
      encounter: copySolomon(snapshot.world.encounter),
      gateLeaves: snapshot.world.gateLeaves.map(copyGateLeaf),
      goodies: snapshot.world.goodies.map(copyGoodie),
      hallOfFameRuns: copyHallOfFameRuns(snapshot.world.hallOfFameRuns),
      kind: 'boneyard',
      lanternLightRegistration: copyLightRegistration(
        snapshot.world.lanternLightRegistration,
      ),
      lanternPosition: copyLanternPosition(snapshot.world.lanternPosition),
      loot: snapshot.world.loot.map(copyLoot),
      lootEvents: snapshot.world.lootEvents.map(copyLootEvent),
      runId: snapshot.world.runId,
      solomonPainterRegistration: copyLightRegistration(
        snapshot.world.solomonPainterRegistration,
      ),
      tutorial: copyTutorial(snapshot.world.tutorial),
      waves: copyWaves(snapshot.world.waves),
    },
  }
}

function copyLanternPosition(
  position: BoneyardWorldSnapshot['lanternPosition'],
): BoneyardWorldSnapshot['lanternPosition'] {
  return position === null ? null : { ...position }
}

function interpolateLanternPosition(
  older: BoneyardWorldSnapshot['lanternPosition'],
  newer: BoneyardWorldSnapshot['lanternPosition'],
  blend: number,
): BoneyardWorldSnapshot['lanternPosition'] {
  if (older === null || newer === null) return copyLanternPosition(blend < 1 ? older : newer)
  return { x: lerp(older.x, newer.x, blend), y: lerp(older.y, newer.y, blend) }
}

function copyTutorial(
  source: BoneyardGameSnapshot['world']['tutorial'],
): BoneyardGameSnapshot['world']['tutorial'] {
  if (source === null) return null
  return {
    ...source,
    movementAnchor: { ...source.movementAnchor },
    narration: {
      ...source.narration,
      current: source.narration.current === null
        ? null
        : { ...source.narration.current },
      pending: [...source.narration.pending],
    },
    survivalLastCheckedTicks: [...source.survivalLastCheckedTicks],
  }
}

function interpolateTutorial(
  older: BoneyardGameSnapshot['world']['tutorial'],
  newer: BoneyardGameSnapshot['world']['tutorial'],
  blend: number,
): BoneyardGameSnapshot['world']['tutorial'] {
  if (older === null || newer === null) {
    return copyTutorial(blend < 1 ? older : newer)
  }
  const discrete = copyTutorial(blend < 1 ? older : newer)!
  if (!older.cameraLockTriggered || !newer.cameraLockTriggered) return discrete
  return {
    ...discrete,
    cameraLockAgeTicks: lerp(
      older.cameraLockAgeTicks,
      newer.cameraLockAgeTicks,
      blend,
    ),
  }
}

function copyHallOfFameRuns(
  source: BoneyardGameSnapshot['world']['hallOfFameRuns'],
): BoneyardGameSnapshot['world']['hallOfFameRuns'] {
  return Object.fromEntries(Object.entries(source).map(([playerId, run]) => [
    playerId,
    { ...run },
  ]))
}

function interpolateLoot(
  older: readonly BoneyardLootSnapshot[],
  newer: readonly BoneyardLootSnapshot[],
  blend: number,
): readonly BoneyardLootSnapshot[] {
  const newerById = new Map(newer.map((actor) => [actor.id, actor]))
  const actors = older.map((source) => {
    const target = newerById.get(source.id)
    if (target === undefined || source.kind !== target.kind) return copyLoot(source)
    const discrete = blend < 1 ? source : target
    return {
      ...discrete,
      alpha: lerp(source.alpha, target.alpha, blend),
      animationPhase: lerpCycle(source.animationPhase, target.animationPhase, blend, 360),
      bounceHeight: lerp(source.bounceHeight, target.bounceHeight, blend),
      framePhase: lerpCycle(source.framePhase, target.framePhase, blend, 18),
      position: {
        x: lerp(source.position.x, target.position.x, blend),
        y: lerp(source.position.y, target.position.y, blend),
      },
      rotationDeg: lerpCycle(source.rotationDeg, target.rotationDeg, blend, 360),
      scatterProgress: lerp(source.scatterProgress, target.scatterProgress, blend),
    }
  })
  if (blend >= 1) {
    const knownIds = new Set(actors.map(({ id }) => id))
    for (const actor of newer) {
      if (!knownIds.has(actor.id)) actors.push(copyLoot(actor))
    }
    return actors.filter(({ id }) => newerById.has(id))
  }
  return actors
}

function copyLoot(source: BoneyardLootSnapshot): BoneyardLootSnapshot {
  return {
    ...source,
    painterRegistration: { ...source.painterRegistration },
    position: { ...source.position },
  }
}

function copyGoodie(source: BoneyardGoodieSnapshot): BoneyardGoodieSnapshot {
  return { ...source, position: { ...source.position } }
}

function copyLootEvent(source: BoneyardLootEventSnapshot): BoneyardLootEventSnapshot {
  return { ...source, position: { ...source.position } }
}

function interpolateArenaTransition(
  older: BoneyardArenaTransitionState | null,
  newer: BoneyardArenaTransitionState | null,
  blend: number,
): BoneyardArenaTransitionState | null {
  if (older === null || newer === null) {
    return copyArenaTransition(blend < 1 ? older : newer)
  }
  const discrete = blend < 1 ? older : newer
  return {
    ...discrete,
    blendFactor: lerp(older.blendFactor, newer.blendFactor, blend),
    cameraBounds: {
      h: lerp(older.cameraBounds.h, newer.cameraBounds.h, blend),
      w: lerp(older.cameraBounds.w, newer.cameraBounds.w, blend),
      x: lerp(older.cameraBounds.x, newer.cameraBounds.x, blend),
      y: lerp(older.cameraBounds.y, newer.cameraBounds.y, blend),
    },
    combatBounds: { ...discrete.combatBounds },
    fullBounds: { ...discrete.fullBounds },
  }
}

function copyArenaTransition(
  source: BoneyardArenaTransitionState | null,
): BoneyardArenaTransitionState | null {
  return source === null
    ? null
    : {
        ...source,
        cameraBounds: { ...source.cameraBounds },
        combatBounds: { ...source.combatBounds },
        fullBounds: { ...source.fullBounds },
      }
}

function copyPlayer(player: ProtocolPlayerState): ProtocolPlayerState {
  return {
    ...player,
    belt: freezeNativeBelt(player.belt.map((entry) => entry && { ...entry })),
    config: { ...player.config },
    lighting: {
      ...player.lighting,
      deathWeaponPainterRegistration:
        player.lighting.deathWeaponPainterRegistration === null
          ? null
          : { ...player.lighting.deathWeaponPainterRegistration },
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

function copyGateLeaf(leaf: BoneyardGateLeafSnapshot): BoneyardGateLeafSnapshot {
  return {
    ...leaf,
    hinge: { ...leaf.hinge },
    tip: { ...leaf.tip },
  }
}

function interpolateSolomon(
  older: BoneyardSolomonSnapshot | null,
  newer: BoneyardSolomonSnapshot | null,
  blend: number,
): BoneyardSolomonSnapshot | null {
  if (older === null || newer === null) {
    return copySolomon(blend < 1 ? older : newer)
  }
  const discrete = blend < 1 ? older : newer
  return {
    ...copySolomon(discrete)!,
    acceleration: lerp(older.acceleration, newer.acceleration, blend),
    headingDeg: lerpCycle(older.headingDeg, newer.headingDeg, blend, FULL_CIRCLE),
    motion: lerp(older.motion, newer.motion, blend),
    position: {
      x: lerp(older.position.x, newer.position.x, blend),
      y: lerp(older.position.y, newer.position.y, blend),
    },
    transitionOffsetY: lerp(
      older.transitionOffsetY,
      newer.transitionOffsetY,
      blend,
    ),
    walkCycle: lerpCycle(
      older.walkCycle,
      newer.walkCycle,
      blend,
      SOLOMON_WALK_FRAME_COUNT,
    ),
  }
}

function interpolateWaves(
  older: BoneyardWaveSnapshot | null,
  newer: BoneyardWaveSnapshot | null,
  blend: number,
): BoneyardWaveSnapshot | null {
  if (older === null || newer === null) {
    return copyWaves(blend < 1 ? older : newer)
  }
  const discrete = blend < 1 ? older : newer
  return copyWaves(discrete)
}

function copySolomon(
  encounter: BoneyardSolomonSnapshot | null,
): BoneyardSolomonSnapshot | null {
  return encounter === null ? null : {
    ...encounter,
    digEvents: encounter.digEvents.map((event) => ({ ...event })),
    position: { ...encounter.position },
    voiceEvents: encounter.voiceEvents.map((event) => ({ ...event })),
  }
}

function copyWaves(waves: BoneyardWaveSnapshot | null): BoneyardWaveSnapshot | null {
  return waves === null ? null : { ...waves }
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`)
}

function requirePositiveFinite(value: number, name: string): void {
  requireFinite(value, name)
  if (value <= 0) throw new Error(`${name} must be positive`)
}
