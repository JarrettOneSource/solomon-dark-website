import {
  BOUNDED_ENEMY_COLD_MOVEMENT_SCALE,
  NATIVE_WRAITH_DAZZLE_TICKS,
  nativeDazzleMovementScale,
} from './boneyard-enemy-modifiers.ts'

export const PLAYER_INITIAL_HEALTH = 50
export const PLAYER_INITIAL_MANA = 100
export const PLAYER_HEALTH_RECOVERY_PER_TICK = 0.001
export const PLAYER_MANA_RECOVERY_PER_TICK = 0.1
export const PLAYER_LETHAL_HEALTH = -10
export const PLAYER_COMBAT_TICKS_PER_SECOND = 100
export const PLAYER_DEATH_EFFECT_TICK = 150
export const PLAYER_DEATH_FRAME_ONE_TICK = 153
export const PLAYER_DEATH_FRAME_TWO_TICK = 156
export const PLAYER_DEATH_FRAME_THREE_TICK = 159
export const PLAYER_HIT_LATCH_TICKS = 20

export const PLAYER_LIFE_STATES = [
  'alive',
  'lethal-pending',
  'dying',
  'spectating',
] as const

export type PlayerLifeState = typeof PLAYER_LIFE_STATES[number]

export interface PlayerCombatComponent {
  readonly coldSlowTicksRemaining: number
  readonly currentHealth: number
  readonly currentMana: number
  readonly dazzleTicksRemaining: number
  readonly deathEpoch: number
  readonly deathTick: number
  readonly lifeState: PlayerLifeState
  readonly lastDamageTick: number | null
  readonly maximumHealth: number
  readonly maximumMana: number
  readonly poisonDamagePerTick: number
  readonly poisonTicksRemaining: number
}

export interface PlayerCombatTickResult<T extends PlayerCombatComponent> {
  readonly beganDeathEpoch: boolean
  readonly combat: T
  readonly emittedDeathBurst: boolean
}

export interface PlayerCombatTickOptions {
  readonly healthRecoveryPerTick?: number
  readonly manaCeiling?: number
  readonly manaRecoveryPerTick?: number
  readonly poisonDamagePerTick?: number
}

export interface PlayerManaDebitResult<T extends PlayerCombatComponent> {
  readonly accepted: boolean
  readonly combat: T
}

export function createPlayerCombat(): PlayerCombatComponent {
  return {
    coldSlowTicksRemaining: 0,
    currentHealth: PLAYER_INITIAL_HEALTH,
    currentMana: PLAYER_INITIAL_MANA,
    dazzleTicksRemaining: 0,
    deathEpoch: 0,
    deathTick: 0,
    lifeState: 'alive',
    lastDamageTick: null,
    maximumHealth: PLAYER_INITIAL_HEALTH,
    maximumMana: PLAYER_INITIAL_MANA,
    poisonDamagePerTick: 0,
    poisonTicksRemaining: 0,
  }
}

export function coldSlowPlayer<T extends PlayerCombatComponent>(
  source: T,
  durationTicks: number,
): T {
  requireNonnegativeTicks(durationTicks, 'player cold-slow duration')
  if (source.lifeState !== 'alive' || durationTicks === 0) return source
  return {
    ...source,
    coldSlowTicksRemaining: Math.max(source.coldSlowTicksRemaining, durationTicks),
  }
}

export function dazzlePlayer<T extends PlayerCombatComponent>(
  source: T,
  durationTicks: number,
): T {
  requireNonnegativeTicks(durationTicks, 'player dazzle duration')
  if (durationTicks > NATIVE_WRAITH_DAZZLE_TICKS) {
    throw new RangeError(`player dazzle duration exceeds ${NATIVE_WRAITH_DAZZLE_TICKS} ticks`)
  }
  if (source.lifeState !== 'alive' || durationTicks === 0) return source
  return {
    ...source,
    dazzleTicksRemaining: Math.max(source.dazzleTicksRemaining, durationTicks),
  }
}

export function playerMovementScale(source: PlayerCombatComponent): number {
  const coldScale = source.coldSlowTicksRemaining > 0
    ? BOUNDED_ENEMY_COLD_MOVEMENT_SCALE
    : 1
  return coldScale * nativeDazzleMovementScale(source.dazzleTicksRemaining)
}

export function poisonPlayer<T extends PlayerCombatComponent>(
  source: T,
  damagePerSecond: number,
  durationSeconds: number,
): T {
  requireNonnegativeFinite(damagePerSecond, 'player poison damage')
  requireNonnegativeFinite(durationSeconds, 'player poison duration')
  if (
    source.lifeState !== 'alive'
    || damagePerSecond === 0
    || durationSeconds === 0
  ) return source
  const poisonDamagePerTick = damagePerSecond / PLAYER_COMBAT_TICKS_PER_SECOND
  const poisonTicksRemaining = Math.ceil(durationSeconds * PLAYER_COMBAT_TICKS_PER_SECOND)
  return {
    ...source,
    poisonDamagePerTick: Math.max(source.poisonDamagePerTick, poisonDamagePerTick),
    poisonTicksRemaining: Math.max(source.poisonTicksRemaining, poisonTicksRemaining),
  }
}

export function damagePlayer<T extends PlayerCombatComponent>(
  source: T,
  damage: number,
  tick: number,
): T {
  requireNonnegativeFinite(damage, 'player damage')
  requireNonnegativeTicks(tick, 'player damage tick')
  if (damage === 0 || source.lifeState === 'dying' || source.lifeState === 'spectating') {
    return source
  }
  const currentHealth = source.currentHealth - damage
  return {
    ...source,
    currentHealth,
    lastDamageTick: tick,
    lifeState: source.lifeState === 'lethal-pending' || currentHealth <= PLAYER_LETHAL_HEALTH
      ? 'lethal-pending'
      : 'alive',
  }
}

export function playerHitOverlayAlpha(
  source: PlayerCombatComponent,
  tick: number,
): number {
  requireNonnegativeFinite(tick, 'player presentation tick')
  if (source.lastDamageTick === null || source.lifeState !== 'alive') return 0
  return Math.min(
    1,
    Math.max(0, 1 - (tick - source.lastDamageTick) / PLAYER_HIT_LATCH_TICKS),
  )
}

export function restorePlayerHealth<T extends PlayerCombatComponent>(
  source: T,
  amount: number,
): T {
  requireNonnegativeFinite(amount, 'player health recovery')
  if (amount === 0 || source.lifeState !== 'alive') return source
  const currentHealth = Math.min(source.maximumHealth, source.currentHealth + amount)
  return currentHealth === source.currentHealth ? source : { ...source, currentHealth }
}

export function restorePlayerMana<T extends PlayerCombatComponent>(
  source: T,
  amount: number,
): T {
  requireNonnegativeFinite(amount, 'player mana recovery')
  if (amount === 0 || source.lifeState !== 'alive') return source
  const currentMana = Math.min(source.maximumMana, source.currentMana + amount)
  return currentMana === source.currentMana ? source : { ...source, currentMana }
}

export function setPlayerMana<T extends PlayerCombatComponent>(
  source: T,
  currentMana: number,
): T {
  requireNonnegativeFinite(currentMana, 'player current mana')
  if (currentMana > source.maximumMana) {
    throw new RangeError('player current mana must not exceed maximum mana')
  }
  return currentMana === source.currentMana ? source : { ...source, currentMana }
}

export function playerDisplayHealth(source: PlayerCombatComponent): number {
  return Math.min(source.maximumHealth, Math.max(0, source.currentHealth))
}

export function tryDebitPlayerMana<T extends PlayerCombatComponent>(
  source: T,
  cost: number,
): PlayerManaDebitResult<T> {
  requireNonnegativeFinite(cost, 'player mana cost')
  if (source.lifeState !== 'alive' || cost > source.currentMana) {
    return { accepted: false, combat: source }
  }
  if (cost === 0) return { accepted: true, combat: source }
  return {
    accepted: true,
    combat: { ...source, currentMana: source.currentMana - cost },
  }
}

export function stepPlayerCombatTick<T extends PlayerCombatComponent>(
  source: T,
  options: PlayerCombatTickOptions = {},
): PlayerCombatTickResult<T> {
  const healthRecoveryPerTick = options.healthRecoveryPerTick
    ?? PLAYER_HEALTH_RECOVERY_PER_TICK
  const manaRecoveryPerTick = options.manaRecoveryPerTick
    ?? PLAYER_MANA_RECOVERY_PER_TICK
  const manaCeiling = options.manaCeiling ?? source.maximumMana
  const appliedPoisonDamagePerTick = options.poisonDamagePerTick ?? source.poisonDamagePerTick
  if (
    !Number.isFinite(healthRecoveryPerTick)
    || healthRecoveryPerTick < 0
    || !Number.isFinite(manaRecoveryPerTick)
    || Math.abs(manaRecoveryPerTick) > 1_000_000
    || !Number.isFinite(manaCeiling)
    || manaCeiling < 0
    || manaCeiling > source.maximumMana
    || !Number.isFinite(appliedPoisonDamagePerTick)
    || appliedPoisonDamagePerTick < 0
  ) throw new RangeError('player combat recovery options are invalid')
  if (source.lifeState === 'lethal-pending') {
    return {
      beganDeathEpoch: true,
      combat: {
        ...source,
        deathEpoch: source.deathEpoch + 1,
        deathTick: 0,
        coldSlowTicksRemaining: 0,
        dazzleTicksRemaining: 0,
        lastDamageTick: null,
        lifeState: 'dying',
        poisonDamagePerTick: 0,
        poisonTicksRemaining: 0,
      },
      emittedDeathBurst: false,
    }
  }

  if (source.lifeState === 'dying' || source.lifeState === 'spectating') {
    const deathTick = Math.min(Number.MAX_SAFE_INTEGER, source.deathTick + 1)
    return {
      beganDeathEpoch: false,
      combat: { ...source, deathTick },
      emittedDeathBurst: deathTick === PLAYER_DEATH_FRAME_THREE_TICK,
    }
  }

  const poisoned = source.poisonTicksRemaining > 0 && source.poisonDamagePerTick > 0
  const coldSlowTicksRemaining = Math.max(0, source.coldSlowTicksRemaining - 1)
  const dazzleTicksRemaining = Math.max(0, source.dazzleTicksRemaining - 1)
  const poisonTicksRemaining = poisoned ? source.poisonTicksRemaining - 1 : 0
  const currentHealth = Math.min(
    source.maximumHealth,
    source.currentHealth
      - (poisoned ? appliedPoisonDamagePerTick : 0)
      + healthRecoveryPerTick,
  )
  const currentMana = Math.max(0, Math.min(
    manaCeiling,
    source.currentMana + manaRecoveryPerTick,
  ))
  const poisonDamagePerTick = poisonTicksRemaining === 0 ? 0 : source.poisonDamagePerTick
  const lifeState = currentHealth <= PLAYER_LETHAL_HEALTH
    ? 'lethal-pending' as const
    : 'alive' as const
  const combat = currentHealth === source.currentHealth
      && currentMana === source.currentMana
      && lifeState === source.lifeState
      && poisonDamagePerTick === source.poisonDamagePerTick
      && poisonTicksRemaining === source.poisonTicksRemaining
      && coldSlowTicksRemaining === source.coldSlowTicksRemaining
      && dazzleTicksRemaining === source.dazzleTicksRemaining
    ? source
    : {
        ...source,
        currentHealth,
        currentMana,
        coldSlowTicksRemaining,
        dazzleTicksRemaining,
        lifeState,
        poisonDamagePerTick,
        poisonTicksRemaining,
      }
  return {
    beganDeathEpoch: false,
    combat,
    emittedDeathBurst: false,
  }
}

export function setPlayerSpectating<T extends PlayerCombatComponent>(source: T): T {
  if (source.lifeState !== 'dying') return source
  return { ...source, lifeState: 'spectating' }
}

export function playerCanAcceptInput(source: PlayerCombatComponent): boolean {
  return source.lifeState === 'alive'
}

export function playerCanCast(source: PlayerCombatComponent): boolean {
  return source.lifeState === 'alive'
}

export function playerCollisionEnabled(source: PlayerCombatComponent): boolean {
  return source.lifeState !== 'spectating'
    && !(source.lifeState === 'dying' && source.deathTick >= PLAYER_DEATH_FRAME_THREE_TICK)
}

export function playerCollisionEnabledAfterCombatTick(
  source: PlayerCombatComponent,
): boolean {
  return playerCollisionEnabled(stepPlayerCombatTick(source).combat)
}

export function playerDeathFrame(source: PlayerCombatComponent): 0 | 1 | 2 | 3 | null {
  if (source.lifeState === 'alive' || source.lifeState === 'lethal-pending') return null
  return playerDeathFrameAtTick(source.deathTick)
}

export function playerDeathFrameAtTick(deathTick: number): 0 | 1 | 2 | 3 {
  if (!Number.isSafeInteger(deathTick) || deathTick < 0) {
    throw new RangeError('player death tick must be a non-negative safe integer')
  }
  if (deathTick < PLAYER_DEATH_FRAME_ONE_TICK) return 0
  if (deathTick < PLAYER_DEATH_FRAME_TWO_TICK) return 1
  if (deathTick < PLAYER_DEATH_FRAME_THREE_TICK) return 2
  return 3
}

export function resetPlayerCombatForNewRun<T extends PlayerCombatComponent>(source: T): T {
  return {
    ...source,
    coldSlowTicksRemaining: 0,
    currentHealth: source.maximumHealth,
    currentMana: source.maximumMana,
    deathEpoch: 0,
    deathTick: 0,
    dazzleTicksRemaining: 0,
    lastDamageTick: null,
    lifeState: 'alive',
    poisonDamagePerTick: 0,
    poisonTicksRemaining: 0,
  }
}

function requireNonnegativeTicks(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }
}

function requireNonnegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`)
  }
}
