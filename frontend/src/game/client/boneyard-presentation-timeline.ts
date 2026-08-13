import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import type {
  BoneyardWorldSnapshot,
  GameSnapshot,
  ProtocolPlayerState,
} from '../protocol/game-state.ts'
import { lerpCycle } from './hub-presentation-timeline.ts'

export type BoneyardGameSnapshot = Omit<GameSnapshot, 'world'> & {
  world: BoneyardWorldSnapshot
}

export interface BoneyardPresentationFrame extends Omit<BoneyardGameSnapshot, 'tick'> {
  tick: number
}

export interface BoneyardPresentationTimeline {
  latest(): BoneyardGameSnapshot
  push(snapshot: BoneyardGameSnapshot, receivedAtMs: number): void
  sample(nowMs: number): BoneyardPresentationFrame
}

export interface BoneyardPresentationTimelineOptions {
  initialReceivedAtMs: number
  initialSnapshot: BoneyardGameSnapshot
  serverTickRate: number
  snapshotRate: number
}

interface TimedSnapshot {
  receivedAtMs: number
  snapshot: BoneyardGameSnapshot
}

const MAX_BUFFERED_SNAPSHOTS = 8
const WALK_FRAME_COUNT = 5
const HEADING_COUNT = 24
const FULL_CIRCLE = 360

export function createBoneyardPresentationTimeline(
  options: BoneyardPresentationTimelineOptions,
): BoneyardPresentationTimeline {
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
        history[history.length - 1] = { receivedAtMs, snapshot }
        return
      }
      history.push({ receivedAtMs, snapshot })
      if (history.length > MAX_BUFFERED_SNAPSHOTS) history.shift()
    },
    sample(nowMs) {
      requireFinite(nowMs, 'nowMs')
      const newest = history.at(-1)!
      if (history.length === 1) return presentationCopy(newest.snapshot)
      const elapsedTicks = clamp(
        (nowMs - newest.receivedAtMs) * options.serverTickRate / 1000,
        0,
        intervalTicks,
      )
      const targetTick = newest.snapshot.tick - intervalTicks + elapsedTicks
      const [older, newer] = bracketSnapshots(history, targetTick)
      const span = newer.snapshot.tick - older.snapshot.tick
      const blend = span <= 0 ? 1 : clamp(
        (targetTick - older.snapshot.tick) / span,
        0,
        1,
      )
      return interpolateSnapshot(older.snapshot, newer.snapshot, blend, targetTick)
    },
  }
}

export function isBoneyardGameSnapshot(
  snapshot: GameSnapshot,
): snapshot is BoneyardGameSnapshot {
  return snapshot.world.kind === 'boneyard'
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
  older: BoneyardGameSnapshot,
  newer: BoneyardGameSnapshot,
  blend: number,
  targetTick: number,
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
    players,
    tick: clamp(targetTick, older.tick, newer.tick),
    world: {
      gateLeaves: interpolateGateLeaves(
        older.world.gateLeaves,
        newer.world.gateLeaves,
        blend,
      ),
      kind: 'boneyard',
      runId: newer.world.runId,
    },
  }
}

function interpolatePlayer(
  older: ProtocolPlayerState,
  newer: ProtocolPlayerState,
  blend: number,
): ProtocolPlayerState {
  const discrete = blend < 1 ? older : newer
  return {
    config: { ...discrete.config },
    footstepTick: discrete.footstepTick,
    gaitDegrees: lerpCycle(older.gaitDegrees, newer.gaitDegrees, blend, FULL_CIRCLE),
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

function presentationCopy(snapshot: BoneyardGameSnapshot): BoneyardPresentationFrame {
  return {
    hostPlayerId: snapshot.hostPlayerId,
    players: Object.fromEntries(Object.entries(snapshot.players).map(([id, player]) => [
      id,
      copyPlayer(player),
    ])),
    tick: snapshot.tick,
    world: {
      gateLeaves: snapshot.world.gateLeaves.map(copyGateLeaf),
      kind: 'boneyard',
      runId: snapshot.world.runId,
    },
  }
}

function copyPlayer(player: ProtocolPlayerState): ProtocolPlayerState {
  return {
    ...player,
    config: { ...player.config },
    position: { ...player.position },
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

function lerp(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
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
