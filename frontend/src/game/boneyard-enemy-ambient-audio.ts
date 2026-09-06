import type { NativeBossSpell } from './core-kernels/native-boss-spell.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import type { GameLoopCue } from './game-audio-native.ts'
import type {
  BoneyardEnemySnapshot,
  BoneyardMaggotSnapshot,
} from './protocol/game-state.ts'

export const BONEYARD_ENEMY_AMBIENT_CUES = [
  'earthquake-loop',
  'rolling-stone-loop',
  'flyblown-loop',
  'maggots-loop',
  'soul-loop',
  'steady-wind-loop',
  'ice-beam-loop',
  'electric-loop',
  'eerie-loop',
  'low-fire-loop',
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
      'animation' | 'enemyToken' | 'flags' | 'id' | 'position' | 'faculty'
    >[]
    bossSpells?: readonly NativeBossSpell[]
    maggots: readonly Pick<BoneyardMaggotSnapshot, 'ownerCoffinActorId' | 'state'>[]
  }>
}

type PointGain = (position: Readonly<{ x: number; y: number }>) => number
interface EnemyAmbientPointGains { readonly point: PointGain; readonly hit: PointGain }

const OWNER_PREFIX = 'boneyard-enemy-ambient:'

export function nativeBoneyardEnemyAmbientRequests(
  snapshot: BoneyardEnemyAmbientSnapshot,
  pointGains: EnemyAmbientPointGains,
): readonly BoneyardEnemyAmbientRequest[] {
  const gains: Record<BoneyardEnemyAmbientCue, number> = {
    'earthquake-loop': 0,
    'rolling-stone-loop': 0,
    'flyblown-loop': 0,
    'maggots-loop': 0,
    'soul-loop': 0,
    'steady-wind-loop': 0,
    'ice-beam-loop': 0,
    'electric-loop': 0,
    'eerie-loop': 0,
    'low-fire-loop': 0,
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
    if (enemy.animation.state === 'death') {
      if (enemy.enemyToken === 'DEMONSKULL') gains['earthquake-loop'] = 1
      continue
    }
    const spatialGain = clampUnit(pointGains.point(enemy.position))
    if (enemy.enemyToken === 'ZOMBIE' && enemy.flags.includes('FLAG_ROTTEN')) {
      gains['flyblown-loop'] = Math.max(gains['flyblown-loop'], spatialGain)
    } else if (enemy.enemyToken === 'DIREFACULTY') {
      const hitGain = clampUnit(pointGains.hit(enemy.position))
      gains['soul-loop'] = Math.max(gains['soul-loop'], hitGain ** 2)
      gains['steady-wind-loop'] = Math.max(gains['steady-wind-loop'], hitGain ** 2)
      if ((enemy.faculty?.handMask ?? 0) !== 0) gains['ice-beam-loop'] = Math.max(gains['ice-beam-loop'], hitGain)
      if (enemy.faculty?.lightningActive) gains['electric-loop'] = Math.max(gains['electric-loop'], spatialGain)
    } else if (enemy.enemyToken === 'WRAITH') {
      gains['soul-loop'] = Math.max(gains['soul-loop'], spatialGain)
    } else if (enemy.enemyToken === 'COFFIN') {
      const liveMaggots = liveMaggotsByCoffin.get(enemy.id) ?? 0
      const weighted = spatialGain * Math.min(liveMaggots / 200, 1) * 0.5
      gains['maggots-loop'] = Math.max(gains['maggots-loop'], weighted)
    }
  }
  for (const spell of snapshot.world.bossSpells ?? []) {
    if (spell.kind === 'green-fire') gains['low-fire-loop'] = Math.max(gains['low-fire-loop'], pointGains.point(spell.position) / 3)
    if (spell.kind === 'mouth-beam-segment') {
      const owner = snapshot.world.enemies.find(enemy => enemy.id === spell.ownerActorId)
      if (owner) gains['ice-beam-loop'] = Math.max(gains['ice-beam-loop'], pointGains.point(owner.position))
    }
    if (spell.kind === 'ultra-banish') {
      for (const cue of ['earthquake-loop', 'rolling-stone-loop', 'soul-loop', 'steady-wind-loop', 'low-fire-loop', 'ice-beam-loop'] as const) {
        gains[cue] = Math.max(gains[cue], spell.alpha)
      }
    }

    if (spell.kind !== 'rain-of-bones' && spell.kind !== 'tragic-circle' && spell.kind !== 'skull-missile' && spell.kind !== 'dark-fireball') continue
    const spatialGain = clampUnit((spell.kind === 'rain-of-bones' || spell.kind === 'tragic-circle' ? pointGains.hit : pointGains.point)(spell.position))
    const gain = spell.kind === 'rain-of-bones' ? spatialGain * spell.alpha * .5
      : spell.kind === 'skull-missile' || spell.kind === 'tragic-circle' ? spatialGain * .5 : spatialGain
    gains['eerie-loop'] = Math.max(gains['eerie-loop'], gain)
    if (spell.kind === 'dark-fireball') gains['low-fire-loop'] = Math.max(gains['low-fire-loop'], spatialGain)
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
    pointGains: EnemyAmbientPointGains,
  ): readonly BoneyardEnemyAmbientRequest[] {
    const requests = nativeBoneyardEnemyAmbientRequests(snapshot, pointGains)
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
