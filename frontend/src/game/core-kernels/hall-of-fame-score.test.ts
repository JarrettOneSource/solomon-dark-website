import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateBoneyardEnemyConfig,
  type EvaluatedBoneyardEnemyConfig,
} from './boneyard-enemy-config.ts'
import {
  archiveNativeHallOfFameRun,
  createNativeHallOfFameRun,
  nativeHallOfFameAward,
  nativeHallOfFameEnemyName,
  recordNativeHallOfFameAwesomestKill,
  recordNativeHallOfFameEnemyKill,
  recordNativeHallOfFameOrdinaryKill,
  resetNativeHallOfFameKillStreak,
  type NativeHallOfFameRunState,
} from './hall-of-fame-score.ts'

const HEALTHY_PLAYER = Object.freeze({
  currentHealth: 100,
  level: 2,
  maximumHealth: 100,
  scoreHealthMultiplierEnabled: true,
})

test('applies pulse, health, and capped level-scaled streak gates exactly', () => {
  assert.equal(nativeHallOfFameAward(50, 0.499, HEALTHY_PLAYER, 0), 0)
  assert.equal(nativeHallOfFameAward(50, 0.5, HEALTHY_PLAYER, 199), 50)
  assert.equal(nativeHallOfFameAward(50, 0.5, HEALTHY_PLAYER, 200), 100)
  assert.equal(nativeHallOfFameAward(50, 0.5, HEALTHY_PLAYER, 800), 250)
  assert.equal(nativeHallOfFameAward(50, 0.5, {
    ...HEALTHY_PLAYER,
    currentHealth: 9.99,
  }, 0), 100)
  assert.equal(nativeHallOfFameAward(50, 0.5, {
    ...HEALTHY_PLAYER,
    currentHealth: -1,
  }, 0), 150)
  assert.equal(nativeHallOfFameAward(50, 0.5, {
    ...HEALTHY_PLAYER,
    currentHealth: -1,
    scoreHealthMultiplierEnabled: false,
  }, 0), 50)
})

test('awards a new maximum bonus before the ordinary kill and draws only for maxima', () => {
  const draws: number[] = []
  const skeleton = evaluateBoneyardEnemyConfig('SKELETON')
  const first = recordNativeHallOfFameEnemyKill(
    createNativeHallOfFameRun(100),
    { enemy: skeleton, player: HEALTHY_PLAYER, regionPulseAccumulator: 0.5 },
    (count) => {
      draws.push(count)
      return 4
    },
  )
  assert.deepEqual(first, {
    awesomeness: 80,
    awesomestKill: 'Skeleton',
    awesomestKillMaximumHealth: 5,
    elapsedTicks: null,
    killStreak: 0,
    monstersKilled: 1,
    portraitHeadingIndex: null,
    portraitScale: null,
    startedAtTick: 100,
  })
  const second = recordNativeHallOfFameEnemyKill(
    first,
    { enemy: skeleton, player: HEALTHY_PLAYER, regionPulseAccumulator: 0.5 },
    () => {
      throw new Error('equal maximum must not consume a Hall RNG draw')
    },
  )
  assert.equal(second.awesomeness, 81)
  assert.equal(second.killStreak, 1)
  assert.equal(second.monstersKilled, 2)
  assert.deepEqual(draws, [5])
})

test('accepted potion reset clears only the native Hall kill streak', () => {
  const source: NativeHallOfFameRunState = {
    awesomeness: 91,
    awesomestKill: 'Skeleton',
    awesomestKillMaximumHealth: 5,
    elapsedTicks: null,
    killStreak: 203,
    monstersKilled: 17,
    portraitHeadingIndex: null,
    portraitScale: null,
    startedAtTick: 100,
  }
  assert.deepEqual(resetNativeHallOfFameKillStreak(source), {
    ...source,
    killStreak: 0,
  })
})

test('archives the Game-wide clock and temporary stock portrait pose once', () => {
  const archived = archiveNativeHallOfFameRun(
    createNativeHallOfFameRun(40),
    340,
    180,
    0.925,
  )
  assert.equal(archived.elapsedTicks, 300)
  assert.equal(archived.portraitHeadingIndex, 12)
  assert.equal(archived.portraitScale, Math.fround(0.925))
  assert.strictEqual(
    archiveNativeHallOfFameRun(archived, 400, 120, 0.85),
    archived,
  )
})

test('uses the pre-XP level for the maximum bonus and post-XP level for the base point', () => {
  const source: NativeHallOfFameRunState = {
    awesomeness: 0,
    awesomestKill: 'Skeleton',
    awesomestKillMaximumHealth: 5,
    elapsedTicks: null,
    killStreak: 100,
    monstersKilled: 1,
    portraitHeadingIndex: null,
    portraitScale: null,
    startedAtTick: 0,
  }
  const bonus = recordNativeHallOfFameAwesomestKill(source, {
    enemy: evaluateBoneyardEnemyConfig('ZOMBIE'),
    player: { ...HEALTHY_PLAYER, level: 1 },
    regionPulseAccumulator: 0.5,
  }, () => 0)
  assert.equal(bonus.awesomeness, 142)
  assert.equal(bonus.killStreak, 101)

  const completed = recordNativeHallOfFameOrdinaryKill(
    bonus,
    { ...HEALTHY_PLAYER, level: 2 },
    0.5,
  )
  assert.equal(completed.awesomeness, 143)
  assert.equal(completed.monstersKilled, 2)
})

test('formats every Website enemy family through the native variant branches', () => {
  const cases: Array<readonly [EvaluatedBoneyardEnemyConfig, string]> = [
    [evaluateBoneyardEnemyConfig('SKELETON'), 'Skeleton'],
    [evaluateBoneyardEnemyConfig('SKELETON', {
      flags: ['FLAG_HELM', 'FLAG_BURNING', 'FLAG_SWORD'],
    }), 'Armored Burning Skeleton Swordsman'],
    [evaluateBoneyardEnemyConfig('SKELETON', {
      flags: ['FLAG_ARMOR', 'FLAG_MACE'],
    }), 'Skeletal Brute'],
    [evaluateBoneyardEnemyConfig('SKELETONARCHER', {
      flags: ['FLAG_HORNED', 'FLAG_FIREARROW'],
    }), 'Horned Skeleton Fire Archer'],
    [evaluateBoneyardEnemyConfig('SKELETONARCHER', {
      flags: ['FLAG_HOODED', 'FLAG_POISONARROW'],
    }), 'Hooded Skeleton Poison Archer'],
    [evaluateBoneyardEnemyConfig('SKELETONMAGE', {
      flags: ['FLAG_CASTLIGHTNING'],
    }), 'Skeleton Stormcaller'],
    [evaluateBoneyardEnemyConfig('IMP'), 'Imp'],
    [evaluateBoneyardEnemyConfig('ZOMBIE', { flags: ['FLAG_ROTTEN'] }), 'Rotten Zombie'],
    [evaluateBoneyardEnemyConfig('WRAITH'), 'Wraith'],
    [evaluateBoneyardEnemyConfig('DEMON'), 'Lesser Demon'],
    [evaluateBoneyardEnemyConfig('DEMON', { flags: ['FLAG_DEATHIMPS'] }), 'Lesser Demon Legion'],
    [evaluateBoneyardEnemyConfig('COFFIN'), 'Putrid Coffin'],
  ]
  for (const [enemy, name] of cases) assert.equal(nativeHallOfFameEnemyName(enemy), name)

  const coffin = evaluateBoneyardEnemyConfig('COFFIN')
  const tainted = {
    ...coffin,
    family: { ...coffin.family, maggotPoisonDamage: 1 },
  } as EvaluatedBoneyardEnemyConfig
  assert.equal(nativeHallOfFameEnemyName(tainted), 'Tainted Coffin')
})
