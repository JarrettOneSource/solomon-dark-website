import { actorHeadingIndex } from './actor-heading.ts'
import type { EvaluatedBoneyardEnemyConfig } from './boneyard-enemy-config.ts'

export const NATIVE_HALL_OF_FAME_SCORE = Object.freeze({
  archiveDeathTick: 300,
  awesomestKillBase: 71,
  awesomestKillRandomCount: 5,
  healthRatioThreshold: 0.10000000149011612,
  portraitHeadingCenterDegrees: 180,
  portraitHeadingJitterDegrees: 65,
  portraitScaleBase: 0.8500000238418579,
  portraitScaleJitter: 0.15000000596046448,
  maximumStreakMultiplier: 5,
  streakKillsPerLevel: 100,
})

export interface NativeHallOfFameRunState {
  readonly awesomeness: number
  readonly awesomestKill: string | null
  readonly awesomestKillMaximumHealth: number
  readonly elapsedTicks: number | null
  readonly killStreak: number
  readonly monstersKilled: number
  readonly portraitHeadingIndex: number | null
  readonly portraitScale: number | null
  readonly startedAtTick: number
}

export interface NativeHallOfFamePlayerScoreState {
  readonly currentHealth: number
  readonly level: number
  readonly maximumHealth: number
  readonly scoreHealthMultiplierEnabled: boolean
}

export interface NativeHallOfFameEnemyKill {
  readonly enemy: EvaluatedBoneyardEnemyConfig
  readonly player: NativeHallOfFamePlayerScoreState
  readonly regionPulseAccumulator: number
}

export type NativeHallOfFameIntegerDraw = (count: number) => number

export function createNativeHallOfFameRun(
  startedAtTick: number,
): NativeHallOfFameRunState {
  if (!Number.isSafeInteger(startedAtTick) || startedAtTick < 0) {
    throw new RangeError('Hall run start tick must be a non-negative safe integer')
  }
  return Object.freeze({
    awesomeness: 0,
    awesomestKill: null,
    awesomestKillMaximumHealth: 0,
    elapsedTicks: null,
    killStreak: 0,
    monstersKilled: 0,
    portraitHeadingIndex: null,
    portraitScale: null,
    startedAtTick,
  })
}

export function archiveNativeHallOfFameRun(
  source: NativeHallOfFameRunState,
  archiveTick: number,
  portraitHeadingDegrees: number,
  portraitScale: number,
): NativeHallOfFameRunState {
  if (!Number.isSafeInteger(archiveTick) || archiveTick < source.startedAtTick) {
    throw new RangeError('Hall archive tick must not precede its Game clock')
  }
  if (!Number.isFinite(portraitHeadingDegrees) || !Number.isFinite(portraitScale)) {
    throw new RangeError('Hall archive portrait must be finite')
  }
  return source.elapsedTicks === null
    ? Object.freeze({
        ...source,
        elapsedTicks: archiveTick - source.startedAtTick,
        portraitHeadingIndex: actorHeadingIndex(portraitHeadingDegrees),
        portraitScale: Math.fround(portraitScale),
      })
    : source
}

export function resetNativeHallOfFameKillStreak(
  source: NativeHallOfFameRunState,
): NativeHallOfFameRunState {
  return source.killStreak === 0
    ? source
    : Object.freeze({ ...source, killStreak: 0 })
}

export function recordNativeHallOfFameEnemyKill(
  source: NativeHallOfFameRunState,
  kill: NativeHallOfFameEnemyKill,
  drawInteger: NativeHallOfFameIntegerDraw,
): NativeHallOfFameRunState {
  return recordNativeHallOfFameOrdinaryKill(
    recordNativeHallOfFameAwesomestKill(source, kill, drawInteger),
    kill.player,
    kill.regionPulseAccumulator,
  )
}

export function recordNativeHallOfFameAwesomestKill(
  source: NativeHallOfFameRunState,
  kill: NativeHallOfFameEnemyKill,
  drawInteger: NativeHallOfFameIntegerDraw,
): NativeHallOfFameRunState {
  const killStreak = source.killStreak
    + (source.awesomestKillMaximumHealth > 0 ? 1 : 0)
  let awesomeness = source.awesomeness
  let awesomestKill = source.awesomestKill
  let awesomestKillMaximumHealth = source.awesomestKillMaximumHealth

  if (kill.enemy.maximumHealth > awesomestKillMaximumHealth) {
    const roll = drawInteger(NATIVE_HALL_OF_FAME_SCORE.awesomestKillRandomCount)
    if (!Number.isSafeInteger(roll) || roll < 0
      || roll >= NATIVE_HALL_OF_FAME_SCORE.awesomestKillRandomCount) {
      throw new RangeError('Hall awesomest-kill draw is outside its native bound')
    }
    awesomeness += nativeHallOfFameAward(
      NATIVE_HALL_OF_FAME_SCORE.awesomestKillBase + roll * kill.player.level,
      kill.regionPulseAccumulator,
      kill.player,
      killStreak,
    )
    awesomestKill = nativeHallOfFameEnemyName(kill.enemy)
    awesomestKillMaximumHealth = kill.enemy.maximumHealth
  }

  return Object.freeze({
    awesomeness,
    awesomestKill,
    awesomestKillMaximumHealth,
    elapsedTicks: source.elapsedTicks,
    killStreak,
    monstersKilled: source.monstersKilled,
    portraitHeadingIndex: source.portraitHeadingIndex,
    portraitScale: source.portraitScale,
    startedAtTick: source.startedAtTick,
  })
}

export function recordNativeHallOfFameOrdinaryKill(
  source: NativeHallOfFameRunState,
  player: NativeHallOfFamePlayerScoreState,
  regionPulseAccumulator: number,
): NativeHallOfFameRunState {
  return Object.freeze({
    ...source,
    awesomeness: source.awesomeness + nativeHallOfFameAward(
      1,
      regionPulseAccumulator,
      player,
      source.killStreak,
    ),
    monstersKilled: source.monstersKilled + 1,
  })
}

export function nativeHallOfFameAward(
  basePoints: number,
  regionPulseAccumulator: number,
  player: NativeHallOfFamePlayerScoreState,
  killStreak: number,
): number {
  if (!Number.isSafeInteger(basePoints) || basePoints < 0) {
    throw new RangeError('Hall base points must be a non-negative safe integer')
  }
  const pulseGate = Math.trunc(Math.min(regionPulseAccumulator + 0.5, 1))
  let points = basePoints * pulseGate
  if (player.scoreHealthMultiplierEnabled) {
    if (player.currentHealth < 0) {
      points *= 3
    } else if (player.currentHealth / player.maximumHealth
      < NATIVE_HALL_OF_FAME_SCORE.healthRatioThreshold) {
      points *= 2
    }
  }
  const levelWindow = player.level * NATIVE_HALL_OF_FAME_SCORE.streakKillsPerLevel
  const multiplier = Math.min(
    NATIVE_HALL_OF_FAME_SCORE.maximumStreakMultiplier,
    Math.max(1, Math.floor((levelWindow + killStreak) / levelWindow)),
  )
  return points * multiplier
}

export function nativeHallOfFameEnemyName(
  enemy: EvaluatedBoneyardEnemyConfig,
): string {
  switch (enemy.enemyToken) {
    case 'SKELETON': return skeletonName(enemy)
    case 'SKELETONARCHER': {
      const skeleton = ['Skeleton', 'Armored Skeleton', 'Horned Skeleton', 'Hooded Skeleton'][
        enemy.family.headgear
      ]!
      const element = enemy.family.arrowType === 'normal'
        ? ''
        : ` ${enemy.family.arrowType === 'fire' ? 'Fire' : 'Poison'}`
      return `${skeleton}${element} Archer`
    }
    case 'SKELETONMAGE': return {
      fire: 'Skeleton Firemage',
      frost: 'Skeleton Frostmage',
      lightning: 'Skeleton Stormcaller',
      poison: 'Skeleton Poisoncaster',
    }[enemy.family.element]
    case 'IMP': return 'Imp'
    case 'ZOMBIE': return enemy.family.rotten ? 'Rotten Zombie' : 'Zombie'
    case 'WRAITH': return 'Wraith'
    case 'DEMON': return enemy.family.splitCount < 1
      ? 'Lesser Demon'
      : 'Lesser Demon Legion'
    case 'COFFIN': return enemy.family.maggotPoisonDamage <= 0
      ? 'Putrid Coffin'
      : 'Tainted Coffin'
  }
}

function skeletonName(
  enemy: Extract<EvaluatedBoneyardEnemyConfig, { enemyToken: 'SKELETON' }>,
): string {
  if (enemy.family.armor && enemy.family.weapon !== 'claw') {
    return {
      axe: 'Skeletal Raider',
      flail: 'Skeletal Crusher',
      mace: 'Skeletal Brute',
      pike: 'Skeletal Lancer',
      sword: 'Skeletal Knight',
    }[enemy.family.weapon]
  }
  const prefix = ['', 'Armored ', 'Horned ', 'Hooded '][enemy.family.headgear]!
  const burning = enemy.burning ? 'Burning ' : ''
  const weapon = {
    axe: ' Axeman',
    claw: '',
    flail: ' Flailman',
    mace: ' Maceman',
    pike: ' Pikeman',
    sword: ' Swordsman',
  }[enemy.family.weapon]
  return `${prefix}${burning}Skeleton${weapon}`
}
