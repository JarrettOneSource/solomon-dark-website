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
  readonly gameplay: MlBotPolicyGameplayCounters
  readonly raw: number
  readonly reward: number
  readonly terms: MlBotPolicyRewardTerms
}

export interface MlBotPolicyGameplayCounters {
  readonly enemyKills: number
  readonly enemyKillsByKind: Readonly<Record<string, number>>
  readonly goldCollected: number
  readonly healthOrbsCollected: number
  readonly itemKinds: Readonly<Record<string, number>>
  readonly itemsCollected: number
  readonly manaOrbsCollected: number
  readonly potionsUsed: number
  readonly powerupsCollected: number
  readonly skillPicks: number
  readonly wavesCompleted: number
}

interface RewardBaseline {
  readonly hpRatio: number
  readonly wave: number
}

export class MlBotPolicyRewardAccumulator {
  private baseline: RewardBaseline | null = null
  private ownDamageRatio = 0
  private ownKillExperience = 0
  private enemyKills = 0
  private readonly enemyKillsByKind: Record<string, number> = {}
  private goldCollected = 0
  private healthOrbsCollected = 0
  private readonly itemKinds: Record<string, number> = {}
  private itemsCollected = 0
  private manaOrbsCollected = 0
  private powerupsCollected = 0
  private readonly playerId: string
  private readonly observer: BoneyardEnemyAttributionObserver

  constructor(playerId: string) {
    if (playerId.length === 0) throw new Error('ML bot policy reward player id must not be empty')
    this.playerId = playerId
    const observer: BoneyardEnemyAttributionObserver = {
      onEnemyHealthDamage: ({ amount, maximumHealth, playerId: sourcePlayerId }) => {
        if (sourcePlayerId !== this.playerId || maximumHealth <= 0) return
        this.ownDamageRatio += Math.max(0, amount) / maximumHealth
      },
      onEnemyKillExperience: ({ amount, enemyToken, playerId: sourcePlayerId }) => {
        if (sourcePlayerId !== this.playerId) return
        this.ownKillExperience += Math.max(0, amount)
        this.enemyKills += 1
        this.enemyKillsByKind[enemyToken] = (this.enemyKillsByKind[enemyToken] ?? 0) + 1
      },
      onLootPickup: (event) => {
        if (event.playerId !== this.playerId) return
        if (event.kind === 'gold') this.goldCollected += Math.max(0, event.amount)
        if (event.kind === 'sack' && event.itemKind !== null) {
          const count = Math.max(1, Math.floor(event.itemQuantity ?? 1))
          this.itemsCollected += count
          this.itemKinds[event.itemKind] = (this.itemKinds[event.itemKind] ?? 0) + count
        }
        if (event.kind === 'orb' && event.orbKind === 'health') this.healthOrbsCollected += 1
        if (event.kind === 'orb' && event.orbKind === 'mana') this.manaOrbsCollected += 1
        if (event.kind === 'bonus') this.powerupsCollected += 1
      },
    }
    this.observer = Object.freeze(observer)
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
    this.resetGameplayCounters()
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
    const gameplay = Object.freeze({
      enemyKills: this.enemyKills,
      enemyKillsByKind: Object.freeze({ ...this.enemyKillsByKind }),
      goldCollected: this.goldCollected,
      healthOrbsCollected: this.healthOrbsCollected,
      itemKinds: Object.freeze({ ...this.itemKinds }),
      itemsCollected: this.itemsCollected,
      manaOrbsCollected: this.manaOrbsCollected,
      potionsUsed: 0,
      powerupsCollected: this.powerupsCollected,
      skillPicks: 0,
      wavesCompleted: Math.max(0, waveOrdinal(state) - Math.max(1, baseline.wave)),
    })
    this.baseline = null
    this.ownDamageRatio = 0
    this.ownKillExperience = 0
    this.resetGameplayCounters()
    return Object.freeze({
      clamped: reward !== raw,
      gameplay,
      raw,
      reward,
      terms,
    })
  }

  private resetGameplayCounters(): void {
    this.enemyKills = 0
    for (const key of Object.keys(this.enemyKillsByKind)) delete this.enemyKillsByKind[key]
    this.goldCollected = 0
    this.healthOrbsCollected = 0
    for (const key of Object.keys(this.itemKinds)) delete this.itemKinds[key]
    this.itemsCollected = 0
    this.manaOrbsCollected = 0
    this.powerupsCollected = 0
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
