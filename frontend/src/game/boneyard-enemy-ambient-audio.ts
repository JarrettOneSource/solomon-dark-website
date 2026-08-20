import type { GameAudioDirector } from './game-audio-director.ts'
import type { GameLoopCue } from './game-audio-native.ts'
import type {
  BoneyardEnemySnapshot,
  BoneyardMaggotSnapshot,
} from './protocol/game-state.ts'

export const BONEYARD_ENEMY_AMBIENT_CUES = [
  'flyblown-loop',
  'maggots-loop',
  'soul-loop',
] as const satisfies readonly GameLoopCue[]

export type BoneyardEnemyAmbientCue = typeof BONEYARD_ENEMY_AMBIENT_CUES[number]

export interface BoneyardEnemyAmbientRequest {
  cue: BoneyardEnemyAmbientCue
  gain: number
}

export interface BoneyardEnemyAmbientSnapshot {
  world: Readonly<{
    enemies: readonly Pick<
      BoneyardEnemySnapshot,
      'animation' | 'enemyToken' | 'flags' | 'id' | 'position'
    >[]
    maggots: readonly Pick<BoneyardMaggotSnapshot, 'ownerCoffinActorId' | 'state'>[]
  }>
}

type PointGain = (position: Readonly<{ x: number; y: number }>) => number

const OWNER_PREFIX = 'boneyard-enemy-ambient:'

export function nativeBoneyardEnemyAmbientRequests(
  snapshot: BoneyardEnemyAmbientSnapshot,
  pointGain: PointGain,
): readonly BoneyardEnemyAmbientRequest[] {
  const gains: Record<BoneyardEnemyAmbientCue, number> = {
    'flyblown-loop': 0,
    'maggots-loop': 0,
    'soul-loop': 0,
  }
  const liveMaggotsByCoffin = new Map<number, number>()
  for (const maggot of snapshot.world.maggots) {
    if (maggot.state === 'death') continue
    liveMaggotsByCoffin.set(
      maggot.ownerCoffinActorId,
      (liveMaggotsByCoffin.get(maggot.ownerCoffinActorId) ?? 0) + 1,
    )
  }
  for (const enemy of snapshot.world.enemies) {
    if (enemy.animation.state === 'death') continue
    const spatialGain = clampUnit(pointGain(enemy.position))
    if (enemy.enemyToken === 'ZOMBIE' && enemy.flags.includes('FLAG_ROTTEN')) {
      gains['flyblown-loop'] = Math.max(gains['flyblown-loop'], spatialGain)
    } else if (enemy.enemyToken === 'WRAITH') {
      gains['soul-loop'] = Math.max(gains['soul-loop'], spatialGain)
    } else if (enemy.enemyToken === 'COFFIN') {
      const liveMaggots = liveMaggotsByCoffin.get(enemy.id) ?? 0
      const weighted = spatialGain * Math.min(liveMaggots / 200, 1) * 0.5
      gains['maggots-loop'] = Math.max(gains['maggots-loop'], weighted)
    }
  }
  return BONEYARD_ENEMY_AMBIENT_CUES.map((cue) => ({ cue, gain: gains[cue] }))
}

export class BoneyardEnemyAmbientAudioSynchronizer {
  private readonly active = new Map<BoneyardEnemyAmbientCue, number>()
  private readonly audio: Pick<GameAudioDirector, 'startLoop' | 'stopLoop'>

  constructor(audio: Pick<GameAudioDirector, 'startLoop' | 'stopLoop'>) {
    this.audio = audio
  }

  update(
    snapshot: BoneyardEnemyAmbientSnapshot,
    pointGain: PointGain,
  ): readonly BoneyardEnemyAmbientRequest[] {
    const requests = nativeBoneyardEnemyAmbientRequests(snapshot, pointGain)
    for (const request of requests) {
      const owner = `${OWNER_PREFIX}${request.cue}`
      if (request.gain > 0) {
        this.audio.startLoop(request.cue, owner, { volume: request.gain })
        this.active.set(request.cue, request.gain)
      } else if (this.active.delete(request.cue)) {
        this.audio.stopLoop(request.cue, owner)
      }
    }
    return requests
  }

  activeRequests(): readonly BoneyardEnemyAmbientRequest[] {
    return BONEYARD_ENEMY_AMBIENT_CUES.flatMap((cue) => {
      const gain = this.active.get(cue)
      return gain === undefined ? [] : [{ cue, gain }]
    })
  }

  destroy(): void {
    for (const cue of this.active.keys()) {
      this.audio.stopLoop(cue, `${OWNER_PREFIX}${cue}`)
    }
    this.active.clear()
  }
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}
