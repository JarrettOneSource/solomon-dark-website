import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BONEYARD_ENEMY_FLAGS,
  evaluateBoneyardEnemyConfig,
  type BoneyardEnemyFlag,
} from './boneyard-enemy-config.ts'
import type { BoneyardWaveEnemyToken } from './boneyard-wave-schema.ts'

test('all eight wave families materialize immutable recovered defaults', () => {
  const expected = {
    COFFIN: [100, null, 1, 1, 200, 45, 0.75],
    DEMON: [400, 20, 1, 1, 800, 35, 0.75],
    IMP: [1, 3, 1, 1, 2, 8.75, 4.5],
    SKELETON: [5, 3, 1, 1, 10, 16, (1.25 + 0.5) * 1.25 ** 2],
    SKELETONARCHER: [5, 4, 1, 1, 10, 20, (1.25 + 0.5) * 1.25 ** 2 * 0.75],
    SKELETONMAGE: [5, 3, 0.8, 1, 10, 25, (1.25 + 0.5) * 1.25 ** 2 * 0.75 * 0.65],
    WRAITH: [2, 4, 1, 1, 4, 20, 1],
    ZOMBIE: [105, 35, 1, 1, 210, 21, 0.85],
  } satisfies Record<BoneyardWaveEnemyToken, readonly (number | null)[]>

  for (const enemyToken of Object.keys(expected) as BoneyardWaveEnemyToken[]) {
    const config = evaluateBoneyardEnemyConfig(enemyToken, {
      random: { baseSpeedUnit: 0.5, collisionRadiusUnit: 0.5 },
    })
    assert.deepEqual([
      config.maximumHealth,
      config.primaryDamage,
      config.chaseSpeed,
      config.attackSpeed,
      config.experience,
      config.collisionRadius,
      config.baseSpeed,
    ], expected[enemyToken])
    assert.equal(config.nativeTypeId, {
      COFFIN: 1013,
      DEMON: 1009,
      IMP: 1004,
      SKELETON: 1001,
      SKELETONARCHER: 1002,
      SKELETONMAGE: 1003,
      WRAITH: 1007,
      ZOMBIE: 1006,
    }[enemyToken])
    assert.equal(Object.isFrozen(config), true)
    assert.equal(Object.isFrozen(config.family), true)
    assert.equal(Object.isFrozen(config.flags), true)
  }
})

test('common scalar flags apply in source order before Arena scalars', () => {
  const config = evaluateBoneyardEnemyConfig('SKELETON', {
    arenaScalars: {
      attackSpeed: 2,
      chaseSpeed: 3,
      experience: 0.5,
      health: 4,
      primaryDamage: 5,
    },
    flags: [
      'FLAG_WEAK',
      'FLAG_HPDOWN',
      'FLAG_XPBONUS',
      'FLAG_FAST',
      'FLAG_SLOW',
      'FLAG_BURNING',
    ],
  })
  assert.equal(config.maximumHealth, 10)
  assert.equal(config.primaryDamage, 7.5)
  assert.equal(config.experience, 10)
  assert.equal(config.chaseSpeed, 2.8125)
  assert.equal(config.attackSpeed, 1.5)
  assert.equal(config.burning, true)
})

test('Skeleton equipment flags preserve exact ordered HP and damage transforms', () => {
  const config = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_HELM', 'FLAG_SWORD', 'FLAG_ARMOR'],
  })
  assert.deepEqual(config.family, { armor: true, headgear: 1, weapon: 'sword' })
  assert.equal(config.maximumHealth, 104)
  assert.equal(config.primaryDamage, 18)

  const pike = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_HORNED', 'FLAG_PIKE'],
  })
  assert.deepEqual(pike.family, { armor: false, headgear: 2, weapon: 'pike' })
  assert.equal(pike.maximumHealth, 100)
  assert.equal(pike.primaryDamage, 28)
})

test('ARMORMAYBE applies recovered armor durability only when selected', () => {
  const armored = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_ARMORMAYBE'],
    random: { randomArmor: true },
  })
  if (armored.enemyToken !== 'SKELETON') throw new Error('expected Skeleton config')
  assert.equal(armored.family.armor, true)
  assert.equal(armored.maximumHealth, 30)

  const unarmored = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_ARMORMAYBE'],
    random: { randomArmor: false },
  })
  if (unarmored.enemyToken !== 'SKELETON') throw new Error('expected Skeleton config')
  assert.equal(unarmored.family.armor, false)
  assert.equal(unarmored.maximumHealth, 5)
})

test('Archer and Mage flags remain family-specific evaluated lanes', () => {
  const archer = evaluateBoneyardEnemyConfig('SKELETONARCHER', {
    archerExtraArrows: 3,
    flags: ['FLAG_RANDOMSHOT', 'FLAG_RANGEEASY', 'FLAG_POISONARROW'],
  })
  assert.deepEqual(archer.family, {
    accuracyMode: 3,
    arrowType: 'poison',
    extraArrows: 3,
    headgear: 0,
    rangeMode: 3,
  })
  assert.equal(archer.secondaryDamage, 12)

  const mage = evaluateBoneyardEnemyConfig('SKELETONMAGE', {
    flags: [
      'FLAG_SHIELD',
      'FLAG_SHIELDOTHERS',
      'FLAG_SHIELDSTRONG',
      'FLAG_SHIELDFAST',
      'FLAG_CASTPOISON',
    ],
  })
  assert.deepEqual(mage.family, {
    element: 'poison',
    headgear: 0,
    otherShield: true,
    otherShieldHealth: 450,
    rangeMode: 0,
    selfShield: true,
    selfShieldHealth: 450,
    shieldInterval: 5,
  })
  assert.equal(mage.primaryDamage, 24)
})

test('split, rotten, and Coffin child flags build their recovered payloads', () => {
  const imp = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLIT'],
    random: { splitUnit: 1 },
  })
  if (!('splitDepth' in imp.family)) throw new Error('expected Imp family config')
  assert.equal(imp.family.splitDepth, 2)

  const wave35Minimum = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLITMANY'],
    random: { splitManyGateUnit: 0, splitManyUnit: 0 },
    waveOrdinal: 35,
  })
  const wave35Maximum = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLITMANY'],
    random: { splitManyGateUnit: 1, splitManyUnit: 1 },
    waveOrdinal: 35,
  })
  const wave42Minimum = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLITMANY'],
    random: { splitManyGateUnit: 0, splitManyUnit: 0 },
    waveOrdinal: 42,
  })
  const wave42Maximum = evaluateBoneyardEnemyConfig('IMP', {
    flags: ['FLAG_SPLITMANY'],
    random: { splitManyGateUnit: 1, splitManyUnit: 1 },
    waveOrdinal: 42,
  })
  if (!('splitDepth' in wave35Minimum.family)) throw new Error('expected Imp family config')
  if (!('splitDepth' in wave35Maximum.family)) throw new Error('expected Imp family config')
  if (!('splitDepth' in wave42Minimum.family)) throw new Error('expected Imp family config')
  if (!('splitDepth' in wave42Maximum.family)) throw new Error('expected Imp family config')
  assert.equal(wave35Minimum.family.splitDepth, 3)
  assert.equal(wave35Maximum.family.splitDepth, 5)
  assert.equal(wave42Minimum.family.splitDepth, 4)
  assert.equal(wave42Maximum.family.splitDepth, 6)

  const zombie = evaluateBoneyardEnemyConfig('ZOMBIE', {
    flags: ['FLAG_ROTTEN'],
  })
  assert.deepEqual(zombie.family, {
    bodyType: 0,
    poisonDuration: 10,
    poisonPoolDamage: 7,
    poisonPunchDamage: 35 / 6,
    rotten: true,
  })

  const coffin = evaluateBoneyardEnemyConfig('COFFIN', {
    flags: ['FLAG_MANYMAGGOTS', 'FLAG_STRONGMAGGOTS'],
  })
  assert.deepEqual(coffin.family, {
    maggotDamage: 5,
    maggotHealth: 5,
    maggotPoisonDamage: 0,
    maximumMaggots: 50,
  })
})

test('source-only flags remain inert and every active recovered flag is accepted', () => {
  const ignored = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_IGNITE', 'FLAG_IMMORTALIZE'],
  })
  assert.deepEqual(ignored.ignoredSourceFlags, ['FLAG_IGNITE', 'FLAG_IMMORTALIZE'])
  assert.equal(ignored.burning, false)

  for (const flag of BONEYARD_ENEMY_FLAGS) {
    if (flag === 'FLAG_NOSKELETONS' || flag === 'FLAG_MORESKELETONS') continue
    assert.doesNotThrow(() => evaluateBoneyardEnemyConfig(tokenForFlag(flag), {
      flags: [flag],
      random: { randomArmor: true, splitUnit: 1 },
      waveOrdinal: 12,
    }))
  }
  assert.throws(
    () => evaluateBoneyardEnemyConfig('SKELETON', { flags: ['FLAG_NOT_NATIVE'] }),
    /unknown Boneyard enemy flag/,
  )
})

test('dormant policy/payload lanes fail closed while custom multi-arrow count is bounded', () => {
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_NOSKELETONS'],
  }), /unsupported dormant skeleton policy none/)
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_MORESKELETONS'],
  }), /unsupported dormant skeleton policy more/)
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETONARCHER', {
    archerExtraArrows: 9,
  }), /extraArrows must be/)
  assert.throws(() => evaluateBoneyardEnemyConfig('SKELETON', {
    archerExtraArrows: 1,
  }), /only valid for SKELETONARCHER/)
})

function tokenForFlag(flag: BoneyardEnemyFlag): BoneyardWaveEnemyToken {
  if (flag.includes('MAGGOT')) return 'COFFIN'
  if (flag.includes('CAST') || flag.includes('SHIELD')) return 'SKELETONMAGE'
  if (flag.includes('ARROW') || flag.includes('RANGE') || (
    flag === 'FLAG_LEADING'
    || flag === 'FLAG_SCATTERSHOT'
    || flag === 'FLAG_RANDOMSHOT'
  )) return 'SKELETONARCHER'
  if (flag === 'FLAG_ROTTEN') return 'ZOMBIE'
  if (flag.includes('SPLIT') || flag.includes('DEATHIMP')) return 'IMP'
  return 'SKELETON'
}
