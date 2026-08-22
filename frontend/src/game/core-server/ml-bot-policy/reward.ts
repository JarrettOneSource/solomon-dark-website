import type { BoneyardEnemyAttributionObserver } from '../boneyard-enemy-store.ts'
import { getPlayerProgression, type GameSimulationState } from '../game-simulation.ts'

export interface MlBotPolicyRewardTerms {
  readonly death: number
  readonly ownDamage: number
  readonly selfHp: number
  readonly wave: number
  readonly xp: number
}

export interface MlBotPolicyRewardResult {
  readonly clamped: boolean
  readonly raw: number
  readonly reward: number
  readonly terms: MlBotPolicyRewardTerms
}

interface RewardBaseline {
  readonly hpRatio: number
  readonly wave: number
}

export class MlBotPolicyRewardAccumulator {
  private baseline: RewardBaseline | null = null
  private ownDamageRatio = 0
  private ownKillExperience = 0
  private readonly playerId: string
  private readonly observer: BoneyardEnemyAttributionObserver

  constructor(playerId: string) {
    if (playerId.length === 0) throw new Error('ML bot policy reward player id must not be empty')
    this.playerId = playerId
    this.observer = Object.freeze({
      onEnemyHealthDamage: ({ amount, maximumHealth, playerId: sourcePlayerId }) => {
        if (sourcePlayerId !== this.playerId || maximumHealth <= 0) return
        this.ownDamageRatio += Math.max(0, amount) / maximumHealth
      },
      onEnemyKillExperience: ({ amount, playerId: sourcePlayerId }) => {
        if (sourcePlayerId !== this.playerId) return
        this.ownKillExperience += Math.max(0, amount)
      },
    })
  }

  begin(state: GameSimulationState): void {
    if (this.baseline !== null) throw new Error('ML bot policy reward interval is already open')
    const progression = getPlayerProgression(state, this.playerId)
    this.baseline = {
      hpRatio: ratio(progression.currentHealth, progression.maximumHealth),
      wave: waveOrdinal(state),
    }
    this.ownDamageRatio = 0
    this.ownKillExperience = 0
  }

  attributionObserver(): BoneyardEnemyAttributionObserver {
    if (this.baseline === null) throw new Error('ML bot policy reward interval is not open')
    return this.observer
  }

  finish(state: GameSimulationState, done: boolean): MlBotPolicyRewardResult {
    const baseline = this.baseline
    if (baseline === null) throw new Error('ML bot policy reward interval is not open')
    const progression = getPlayerProgression(state, this.playerId)
    const terms = Object.freeze({
      death: done && progression.lifeState !== 'alive' ? -2 : 0,
      ownDamage: 0.65 * this.ownDamageRatio,
      selfHp: 1.25 * (
        ratio(progression.currentHealth, progression.maximumHealth) - baseline.hpRatio
      ),
      wave: 1.5 * Math.min(Math.max(waveOrdinal(state) - baseline.wave, 0), 1),
      xp: this.ownKillExperience / 25,
    })
    const raw = terms.selfHp + terms.ownDamage + terms.xp + terms.wave + terms.death
    const reward = Math.max(-4, Math.min(4, raw))
    this.baseline = null
    this.ownDamageRatio = 0
    this.ownKillExperience = 0
    return Object.freeze({
      clamped: reward !== raw,
      raw,
      reward,
      terms,
    })
  }
}

export function mlBotPolicyTerminal(state: GameSimulationState, playerId: string): boolean {
  return state.run.phase !== 'active' || getPlayerProgression(state, playerId).lifeState !== 'alive'
}

function waveOrdinal(state: GameSimulationState): number {
  return state.world.kind === 'boneyard' && state.world.waves !== null
    ? state.world.waves.waveOrdinal
    : 0
}

function ratio(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0
}
