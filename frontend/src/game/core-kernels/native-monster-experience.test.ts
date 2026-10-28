import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateBoneyardEnemyConfig } from './boneyard-enemy-config.ts'
import { nativeSlumpgutRecipeForUid } from './native-survival-slumpgut.ts'

test('monster construction uses the native double XP coefficient after health flags', () => {
  for (const [token, health] of [
    ['SKELETON', 5], ['SKELETONARCHER', 5], ['SKELETONMAGE', 5],
    ['IMP', 1], ['WRAITH', 2], ['ZOMBIE', 105], ['DEMON', 400], ['COFFIN', 100], ['SPIDER', 15],
  ] as const) {
    const ordinary = evaluateBoneyardEnemyConfig(token)
    const stronger = evaluateBoneyardEnemyConfig(token, { flags: ['FLAG_HPUP', 'FLAG_HPUP'] })
    assert.equal(ordinary.experience, Math.fround(health * 0.8500000238418579), token)
    assert.equal(stronger.experience, Math.fround(health * 2.25 * 0.8500000238418579), `${token} health flags`)
  }
})

test('XPBONUS assigns the native bonus once; Arena scales the bonus separately from health', () => {
  const opening = evaluateBoneyardEnemyConfig('SKELETON', {
    flags: ['FLAG_WEAK', 'FLAG_HPDOWN', 'FLAG_XPBONUS', 'FLAG_XPBONUS'],
  })
  assert.equal(opening.maximumHealth, 2.5)
  assert.equal(opening.experience, Math.fround(4.5 * 0.8500000238418579))
  const scaled = evaluateBoneyardEnemyConfig('SPIDER', {
    flags: ['FLAG_XPBONUS'], arenaScalars: { health: 2, experience: 0.5 },
  })
  assert.equal(scaled.experience, Math.fround(31 * 0.8500000238418579))
})

test('authored recipes retain their additive XP bonus through later health modifiers', () => {
  const recipe = nativeSlumpgutRecipeForUid(200)
  const plain = evaluateBoneyardEnemyConfig('ZOMBIE', { authoredRecipe: recipe })
  const tougher = evaluateBoneyardEnemyConfig('ZOMBIE', { authoredRecipe: recipe, flags: ['FLAG_HPUP'] })
  assert.ok(tougher.experience > plain.experience)
  assert.ok(Math.abs((tougher.experience - plain.experience)
    - recipe.maximumHealth * 0.5 * 0.8500000238418579) < 0.0005)
})
