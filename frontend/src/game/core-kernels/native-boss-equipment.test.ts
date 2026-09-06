import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateBoneyardEnemyConfig } from './boneyard-enemy-config.ts'
import { nativeSlumpgutRecipe } from './native-survival-slumpgut.ts'

const recipeBase = nativeSlumpgutRecipe(
  'bd3c38468481b7337b1e7382e5503cc214356906571763a68188b23e821e73fb',
)

for (const weapon of ['claw', 'sword', 'mace', 'flail'] as const) {
  test(`Ironmaw retains the authored ${weapon}, helm, armor, and combat stats`, () => {
    const config = evaluateBoneyardEnemyConfig('SKELETON', {
      authoredRecipe: {
        ...recipeBase,
        experienceBonus: 0,
        extraDamage: 0,
        family: { armor: true, headgear: 4, kind: 'skeleton', weapon },
        maximumHealth: 320,
        name: 'Ironmaw',
        primaryDamage: 6,
        secondaryDamage: 0,
        tertiaryDamage: 0,
      },
    })
    assert.equal(config.enemyToken, 'SKELETON')
    assert.deepEqual(config.family, { armor: true, headgear: 4, weapon })
    assert.equal(config.maximumHealth, 320)
    assert.equal(config.primaryDamage, 6)
    assert.equal(config.experience, 272)
    assert.equal(config.onDeathProgram, 'miniboss-die')
  })
}

test('Foulshaft keeps native fire multishot, range-easy, and strafing independently', () => {
  const config = evaluateBoneyardEnemyConfig('SKELETONARCHER', {
    authoredRecipe: {
      ...recipeBase,
      archerAccuracyMode: 3,
      attackSpeed: 3,
      chaseSpeed: 1.5,
      experienceBonus: 0,
      extraDamage: 0,
      family: {
        arrowType: 'fire',
        extraArrows: 2,
        headgear: 5,
        kind: 'archer',
        multiArrowMode: 1,
        rangeMode: 3,
        strafing: true,
      },
      maximumHealth: 640,
      name: 'Foulshaft',
      primaryDamage: 3,
      secondaryDamage: 3,
      tertiaryDamage: 0,
    },
  })
  assert.equal(config.enemyToken, 'SKELETONARCHER')
  assert.deepEqual(config.family, {
    accuracyMode: 3,
    arrowType: 'fire',
    extraArrows: 2,
    headgear: 5,
    multiArrowMode: 1,
    rangeMode: 3,
    strafing: true,
  })
  assert.equal(config.attackSpeed, 3)
  assert.equal(config.maximumHealth, 640)
  assert.equal(config.primaryDamage, 3)
  assert.equal(config.secondaryDamage, 3)
})
