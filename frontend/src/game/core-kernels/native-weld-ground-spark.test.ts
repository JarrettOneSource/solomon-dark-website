import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeRng, drawNativeFloat, drawNativeInteger } from './native-rng.ts'
import { spawnNativeWeldOneShot, stepNativeWeldProjectile } from './native-weld-primary-runtime.ts'
import type { NativeWeldPrimarySkillProfile } from './native-primary-skill-profile.ts'
import { createNativeWeldGroundSparkFadeProgram } from './native-weld-ground-spark.ts'

test('GroundSpark always emits record 71 and follows the native six-way fork gate', () => {
  const born = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 },
    firstId: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    primarySkill: profile(),
    rng: createNativeRng(9),
    targets: [],
    underpowered: false,
    worldKey: 'boneyard:1',
  }).projectiles[0]!
  const projectile = stepNativeWeldProjectile(born, [])
  const source = createNativeRng(77)
  const program = createNativeWeldGroundSparkFadeProgram({ projectile, rng: source })
  assert.equal(program.fades[0]!.record, 71)
  assert.ok(program.fades.length === 1 || program.fades.length === 2)

  let expected = drawNativeFloat(source, 360).state
  expected = drawNativeFloat(expected, Math.fround(0.1), true).state
  const phase = Math.abs(Math.sin(projectile.groundSparkNativeAgeTicks! * 12 * Math.PI / 180))
  let forkDue = phase < Math.fround(0.1)
  if (!forkDue) {
    const gate = drawNativeInteger(expected, 6)
    expected = gate.state
    forkDue = gate.value === 1
  }
  if (forkDue) {
    expected = drawNativeInteger(expected, 4).state
    expected = drawNativeFloat(expected, 360).state
    expected = drawNativeFloat(expected, Math.fround(0.25)).state
  }
  assert.deepEqual(program.rng, expected)
})

test('weak GroundSpark halves record 71 alpha and loss plus only fork alpha', () => {
  const normal = projectile(false)
  const weak = { ...normal, underpowered: true }
  const source = createNativeRng(3)
  const normalProgram = createNativeWeldGroundSparkFadeProgram({ projectile: normal, rng: source })
  const weakProgram = createNativeWeldGroundSparkFadeProgram({ projectile: weak, rng: source })
  assert.equal(weakProgram.fades[0]!.alpha, Math.fround(normalProgram.fades[0]!.alpha * 0.5))
  assert.equal(
    weakProgram.fades[0]!.alphaStep,
    Math.fround(normalProgram.fades[0]!.alphaStep * 0.5),
  )
  if (normalProgram.fades[1] && weakProgram.fades[1]) {
    assert.equal(
      weakProgram.fades[1].alpha,
      Math.fround(normalProgram.fades[1].alpha * 0.5),
    )
    assert.equal(weakProgram.fades[1].alphaStep, normalProgram.fades[1].alphaStep)
  }
})

function projectile(underpowered: boolean) {
  const born = spawnNativeWeldOneShot({
    aimDirection: { x: 1, y: 0 }, firstId: 1, origin: { x: 0, y: 0 },
    ownerId: 'wizard', primarySkill: profile(), rng: createNativeRng(11), targets: [],
    underpowered, worldKey: 'boneyard:1',
  }).projectiles[0]!
  return {
    ...stepNativeWeldProjectile(born, []),
    groundSparkNativeAgeTicks: 0,
  }
}

function profile(): NativeWeldPrimarySkillProfile {
  return {
    buildId: 1009,
    castKind: 'one-shot',
    damageFactor: 1,
    damageMaximum: 8,
    damageMinimum: 8,
    kind: 'weld',
    manaCost: 5,
    skillId: 1009,
    vector: { values: [8, 5, 1, 1, 1, 0], weldEffectFactor: 1 },
  }
}
