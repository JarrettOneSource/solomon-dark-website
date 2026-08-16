import { PLAYER_DEATH_FRAME_THREE_TICK } from '../core-kernels/player-combat.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'

export const BOUNDED_PLAYER_DEATH_BURST_PROGRAM = Object.freeze({
  baseRadius: 15,
  baseSpeed: 3,
  damping: 0.9,
  durationTicks: 10,
  entry: 10,
  jitterDegrees: 8,
  particleCount: 18,
  radiusRange: 5,
  scaleX: 0.5,
  scaleY: 0.2,
  speedRange: 1,
  stepDegrees: 20,
  tint: 0x808080,
})

export interface PlayerDeathBurstTrigger {
  readonly deathEpoch: number
  readonly key: string
  readonly playerId: string
  readonly position: Readonly<Vector2>
  readonly runId: string
}

export interface PlayerDeathBurstLayer {
  readonly alpha: number
  readonly entry: 10
  readonly offset: Readonly<Vector2>
  readonly scaleX: number
  readonly scaleY: number
  readonly tint: number
}

interface DeathObservation {
  readonly deathEpoch: number
  readonly deathTick: number
}

export class PlayerDeathBurstCrossingTracker {
  private readonly consumedKeys = new Set<string>()
  private readonly observations = new Map<string, DeathObservation>()
  private destroyed = false
  private runId = ''

  constructor(initialSnapshot: GameSnapshot) {
    this.seed(initialSnapshot)
  }

  update(snapshot: GameSnapshot): readonly PlayerDeathBurstTrigger[] {
    if (this.destroyed) return []
    const runId = boneyardRunId(snapshot)
    if (runId !== this.runId) {
      this.seed(snapshot)
      return []
    }
    const triggers: PlayerDeathBurstTrigger[] = []
    const livePlayerIds = new Set<string>()
    for (const [playerId, player] of Object.entries(snapshot.players)) {
      livePlayerIds.add(playerId)
      const current = {
        deathEpoch: player.progression.deathEpoch,
        deathTick: player.progression.deathTick,
      }
      const previous = this.observations.get(playerId)
      if (!previous) {
        this.seedPlayer(runId, playerId, current)
        continue
      }
      const key = playerDeathBurstKey(runId, playerId, current.deathEpoch)
      const crossed = current.deathEpoch > 0
        && current.deathTick >= PLAYER_DEATH_FRAME_THREE_TICK
        && (
          current.deathEpoch > previous.deathEpoch
          || (
            current.deathEpoch === previous.deathEpoch
            && previous.deathTick < PLAYER_DEATH_FRAME_THREE_TICK
          )
        )
      if (crossed && !this.consumedKeys.has(key)) {
        this.consumedKeys.add(key)
        triggers.push({
          deathEpoch: current.deathEpoch,
          key,
          playerId,
          position: { ...player.position },
          runId,
        })
      }
      this.observations.set(playerId, current.deathEpoch === previous.deathEpoch
        ? {
            deathEpoch: current.deathEpoch,
            deathTick: Math.max(previous.deathTick, current.deathTick),
          }
        : current)
    }
    for (const playerId of this.observations.keys()) {
      if (!livePlayerIds.has(playerId)) this.observations.delete(playerId)
    }
    return triggers
  }

  destroy(): void {
    this.destroyed = true
    this.consumedKeys.clear()
    this.observations.clear()
    this.runId = ''
  }

  private seed(snapshot: GameSnapshot): void {
    const runId = boneyardRunId(snapshot)
    this.consumedKeys.clear()
    this.observations.clear()
    this.runId = runId
    for (const [playerId, player] of Object.entries(snapshot.players)) {
      this.seedPlayer(runId, playerId, {
        deathEpoch: player.progression.deathEpoch,
        deathTick: player.progression.deathTick,
      })
    }
  }

  private seedPlayer(
    runId: string,
    playerId: string,
    observation: DeathObservation,
  ): void {
    this.observations.set(playerId, observation)
    if (
      observation.deathEpoch > 0
      && observation.deathTick >= PLAYER_DEATH_FRAME_THREE_TICK
    ) {
      this.consumedKeys.add(playerDeathBurstKey(
        runId,
        playerId,
        observation.deathEpoch,
      ))
    }
  }
}

export function playerDeathBurstLayers(
  trigger: PlayerDeathBurstTrigger,
  ageTicks: number,
): readonly PlayerDeathBurstLayer[] {
  if (!Number.isFinite(ageTicks)) throw new RangeError('Player death-burst age must be finite')
  const age = Math.max(0, Math.trunc(ageTicks))
  if (age >= BOUNDED_PLAYER_DEATH_BURST_PROGRAM.durationTicks) return []
  const alpha = 1 - age / BOUNDED_PLAYER_DEATH_BURST_PROGRAM.durationTicks
  const seed = stableHash(`${trigger.runId}:${trigger.playerId}:${trigger.deathEpoch}`)
  const travelFactor = age === 0
    ? 0
    : (1 - BOUNDED_PLAYER_DEATH_BURST_PROGRAM.damping ** age)
      / (1 - BOUNDED_PLAYER_DEATH_BURST_PROGRAM.damping)
  return Array.from(
    { length: BOUNDED_PLAYER_DEATH_BURST_PROGRAM.particleCount },
    (_, index) => {
      const jitter = (unit(mix(seed, index * 3 + 1)) * 2 - 1)
        * BOUNDED_PLAYER_DEATH_BURST_PROGRAM.jitterDegrees
      const angle = (index * BOUNDED_PLAYER_DEATH_BURST_PROGRAM.stepDegrees + jitter)
        * Math.PI / 180
      const radius = BOUNDED_PLAYER_DEATH_BURST_PROGRAM.baseRadius
        + unit(mix(seed, index * 3 + 2))
          * BOUNDED_PLAYER_DEATH_BURST_PROGRAM.radiusRange
      const speed = BOUNDED_PLAYER_DEATH_BURST_PROGRAM.baseSpeed
        + unit(mix(seed, index * 3 + 3))
          * BOUNDED_PLAYER_DEATH_BURST_PROGRAM.speedRange
      const distance = radius + speed * travelFactor
      return {
        alpha,
        entry: 10,
        offset: {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
        },
        scaleX: BOUNDED_PLAYER_DEATH_BURST_PROGRAM.scaleX,
        scaleY: BOUNDED_PLAYER_DEATH_BURST_PROGRAM.scaleY,
        tint: BOUNDED_PLAYER_DEATH_BURST_PROGRAM.tint,
      }
    },
  )
}

function boneyardRunId(snapshot: GameSnapshot): string {
  if (snapshot.world.kind !== 'boneyard') {
    throw new Error('Player death-burst presentation requires a Boneyard snapshot')
  }
  return snapshot.world.runId
}

function playerDeathBurstKey(runId: string, playerId: string, deathEpoch: number): string {
  return `${runId}:${playerId}:${deathEpoch}`
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mix(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

function unit(value: number): number {
  return value / 0x1_0000_0000
}
