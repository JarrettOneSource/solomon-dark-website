import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  BoneyardEnemyDeathEffect,
  BoneyardEnemyProjectileEffect,
} from './boneyard-enemy-store.ts'
import { stepBoneyardTransientEffects } from './boneyard-transient-effects.ts'

const PROGRAMS = Object.freeze({ poisonPoolAlphaLossPerTick: 0.005 })

test('stationary transient rows reuse vectors without mutating their source branch', () => {
  const death = deathEffect()
  const projectile = projectileEffect({ kind: 'fire-burst-glow' })
  const result = stepBoneyardTransientEffects([death], [projectile], 11, () => 0.5, PROGRAMS)
  const steppedDeath = result.deathEffects[0]!
  const steppedProjectile = result.projectileEffects[0]!

  assert.notEqual(steppedDeath, death)
  assert.equal(steppedDeath.position, death.position)
  assert.equal(steppedDeath.velocity, death.velocity)
  assert.equal(steppedDeath.alpha, 0.9)
  assert.equal(death.alpha, 1)
  assert.notEqual(steppedProjectile, projectile)
  assert.equal(steppedProjectile.position, projectile.position)
  assert.equal(steppedProjectile.velocity, projectile.velocity)
  assert.equal(projectile.ageTicks, 0)
})

test('moving transient rows keep exact motion while sibling branches remain independent', () => {
  const source = deathEffect({ kind: 'move-fade', velocity: { x: 2, y: -3 } })
  const first = stepBoneyardTransientEffects([source], [], 11, () => 0.5, PROGRAMS)
  const second = stepBoneyardTransientEffects([source], [], 12, () => 0.5, PROGRAMS)

  assert.deepEqual(first.deathEffects[0]?.position, { x: 12, y: 17 })
  assert.deepEqual(second.deathEffects[0]?.position, { x: 14, y: 14 })
  assert.deepEqual(source.position, { x: 10, y: 20 })
})

test('Bouncer ground contacts retain exact RNG order, settling, and retirement', () => {
  const source = deathEffect({
    alphaLossPerTick: 0.25,
    bounceVelocity: -0.5,
    height: -0.1,
    kind: 'bouncer',
    lifetimeTicks: 100,
    verticalVelocity: 0.5,
    velocity: { x: 4, y: -2 },
  })
  const draws: number[] = []
  const bounced = stepBoneyardTransientEffects([source], [], 11, () => {
    draws.push(0.25)
    return 0.25
  }, PROGRAMS).deathEffects[0]!

  assert.deepEqual(draws, [0.25])
  assert.equal(bounced.height, 0)
  assert.equal(bounced.verticalVelocity, 0)
  assert.deepEqual(bounced.velocity, { x: 0, y: 0 })
  assert.equal(
    stepBoneyardTransientEffects([bounced], [], 14, () => 0.75, PROGRAMS)
      .deathEffects.length,
    0,
  )
})

test('Arrow tumble keeps float32 motion and retires on its strict lifetime edge', () => {
  const source = projectileEffect({
    alpha: Math.fround(0.2),
    alphaLossPerTick: Math.fround(0.1),
    angularVelocityDeg: Math.fround(1.25),
    kind: 'arrow-tumble',
    lifetimeTicks: 60,
    velocity: { x: Math.fround(1), y: Math.fround(-0.5) },
  })
  const first = stepBoneyardTransientEffects([], [source], 11, () => 0, PROGRAMS)
    .projectileEffects[0]!
  assert.equal(first.alpha, Math.fround(Math.fround(0.2) - Math.fround(0.1)))
  assert.deepEqual(first.position, { x: Math.fround(31), y: Math.fround(39.5) })
  assert.deepEqual(first.velocity, {
    x: Math.fround(Math.fround(1) * Math.fround(0.98)),
    y: Math.fround(Math.fround(-0.5) * Math.fround(0.98)),
  })
  assert.equal(
    stepBoneyardTransientEffects([], [first], 12, () => 0, PROGRAMS)
      .projectileEffects.length,
    0,
  )
})

test('all death-effect kinds keep exact catch-up clocks and ordered projection', () => {
  const source = [
    deathEffect({ id: 1, kind: 'fade' }),
    deathEffect({ id: 2, kind: 'unbind' }),
    deathEffect({ id: 3, kind: 'move-fade', velocity: { x: 2, y: -3 } }),
    deathEffect({ id: 4, kind: 'banish' }),
    deathEffect({
      firstEntry: 40,
      frameCount: 4,
      id: 5,
      kind: 'sprite-array',
      velocity: { x: 1, y: 0 },
    }),
    deathEffect({ firstEntry: 47, frameCount: 5, id: 6, kind: 'fire-array' }),
    deathEffect({
      bounceVelocity: -2,
      height: -2,
      id: 7,
      kind: 'bouncer',
      verticalVelocity: 0,
      velocity: { x: 1, y: 2 },
    }),
  ]
  const before = JSON.stringify(source)
  const draws: number[] = []
  const result = stepBoneyardTransientEffects(source, [], 13, () => {
    draws.push(0.75)
    return 0.75
  }, PROGRAMS)
  let banishScale = 1
  for (let tick = 11; tick <= 13; tick += 1) banishScale *= 1.025

  assert.equal(JSON.stringify(source), before)
  assert.deepEqual(result.deathEffects.map(({ id, kind }) => ({ id, kind })), [
    { id: 1, kind: 'fade' },
    { id: 2, kind: 'unbind' },
    { id: 3, kind: 'move-fade' },
    { id: 4, kind: 'banish' },
    { id: 5, kind: 'sprite-array' },
    { id: 6, kind: 'fire-array' },
    { id: 7, kind: 'bouncer' },
  ])
  assert.deepEqual(result.deathEffects.slice(0, 6).map((effect) => ({
    ageTicks: effect.ageTicks,
    alpha: effect.alpha,
    entry: effect.entry,
    lastStepTick: effect.lastStepTick,
    position: effect.position,
    rotationDeg: effect.rotationDeg,
    scale: effect.scale,
  })), [
    { ageTicks: 3, alpha: 0.7000000000000001, entry: 113, lastStepTick: 13,
      position: { x: 10, y: 20 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.7000000000000001, entry: 113, lastStepTick: 13,
      position: { x: 10, y: 20 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.7000000000000001, entry: 113, lastStepTick: 13,
      position: { x: 16, y: 11 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.7000000000000001, entry: 113, lastStepTick: 13,
      position: { x: 10, y: 20 }, rotationDeg: 11, scale: banishScale },
    { ageTicks: 3, alpha: 0.7000000000000001, entry: 43, lastStepTick: 13,
      position: { x: 13, y: 20 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.7000000000000001, entry: 50, lastStepTick: 13,
      position: { x: 10, y: 20 }, rotationDeg: 11, scale: 1 },
  ])
  assert.deepEqual(draws, [])
  assert.deepEqual(result.deathEffects[6], {
    ...source[6]!,
    ageTicks: 3,
    alpha: 0.8,
    height: -1.6,
    lastStepTick: 13,
    opacityTimer: 0.8,
    position: { x: 12, y: 24 },
    rotationDeg: 9,
    verticalVelocity: 0.8,
    velocity: { x: 1, y: 2 },
  })
})

test('all projectile-effect kinds keep exact catch-up clocks and ordered projection', () => {
  const kinds = [
    'arrow-tumble',
    'demon-fire',
    'fire-burst-frame',
    'fire-burst-glow',
    'firebolt-trail',
    'guided-impact-aura-one',
    'guided-impact-aura-two',
    'guided-impact-main',
    'poison-pool-fade-inner',
    'poison-pool-fade-outer',
  ] as const
  const source = kinds.map((kind, index) => projectileEffect({
    id: index + 1,
    kind,
    velocity: kind === 'arrow-tumble' ? { x: 1, y: -0.5 } : { x: 0, y: 0 },
  }))
  const before = JSON.stringify(source)
  const result = stepBoneyardTransientEffects([], source, 14, () => 0, PROGRAMS)

  assert.equal(JSON.stringify(source), before)
  assert.deepEqual(result.projectileEffects.map(({ id, kind }) => ({ id, kind })),
    kinds.map((kind, index) => ({ id: index + 1, kind })))
  assert.ok(result.projectileEffects.every(({ ageTicks, lastStepTick }) => (
    ageTicks === 4 && lastStepTick === 14
  )))
  assert.deepEqual(result.projectileEffects.slice(1, 8).map(({ alpha, entry }) => ({
    alpha,
    entry,
  })), [
    { alpha: 0.6, entry: 47 },
    { alpha: 0.6, entry: 252 },
    { alpha: 0.6, entry: 251 },
    { alpha: 0.6, entry: 251 },
    { alpha: 0.6, entry: 251 },
    { alpha: 0.6, entry: 251 },
    { alpha: 0.6, entry: 251 },
  ])
  const inner = result.projectileEffects[8]!
  const outer = result.projectileEffects[9]!
  assert.equal(inner.alpha, (Math.sin(4 * Math.PI / 180) * 0.25 + 0.75) * 0.98)
  assert.equal(outer.alpha, 0.49)
  let arrowAlpha = 1
  for (let step = 0; step < 4; step += 1) {
    arrowAlpha = Math.fround(arrowAlpha - Math.fround(0.1))
  }
  assert.equal(result.projectileEffects[0]!.alpha, arrowAlpha)
})

test('delayed births and strict lifetime edges apply across complete transient populations', () => {
  const delayed = deathEffect({ lastStepTick: 10, spawnTick: 12 })
  const beforeBirth = stepBoneyardTransientEffects([delayed], [], 11, () => 0, PROGRAMS)
    .deathEffects[0]!
  assert.equal(beforeBirth.ageTicks, 0)
  assert.equal(beforeBirth.lastStepTick, 11)
  assert.equal(beforeBirth.opacityTimer, delayed.opacityTimer)

  const deathKinds = [
    'banish', 'bouncer', 'fade', 'fire-array', 'move-fade', 'sprite-array', 'unbind',
  ] as const
  const projectileKinds = [
    'arrow-tumble', 'demon-fire', 'fire-burst-frame', 'fire-burst-glow',
    'firebolt-trail', 'guided-impact-aura-one', 'guided-impact-aura-two',
    'guided-impact-main', 'poison-pool-fade-inner', 'poison-pool-fade-outer',
  ] as const
  const result = stepBoneyardTransientEffects(
    deathKinds.map((kind, index) => deathEffect({
      alphaLossPerTick: 0,
      id: index + 1,
      kind,
      lifetimeTicks: 20,
    })),
    projectileKinds.map((kind, index) => projectileEffect({
      alphaLossPerTick: 0,
      id: index + 1,
      kind,
      lifetimeTicks: 20,
    })),
    30,
    () => 0,
    PROGRAMS,
  )
  assert.deepEqual(result, { deathEffects: [], projectileEffects: [] })
})

function deathEffect(
  patch: Partial<BoneyardEnemyDeathEffect> = {},
): BoneyardEnemyDeathEffect {
  return Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaLossPerTick: 0.1,
    angularVelocityDeg: 2,
    atlas: 'BadGuys',
    blendMode: 'normal',
    bounceVelocity: 0,
    entry: 113,
    firstEntry: 113,
    frameCount: 1,
    frameTicks: 1,
    height: 0,
    id: 1,
    kind: 'fade',
    lastStepTick: 10,
    lifetimeTicks: 20,
    opacityTimer: 1,
    ownerActorId: 3,
    position: Object.freeze({ x: 10, y: 20 }),
    role: 'transient-test',
    rotationDeg: 5,
    scale: 1,
    shadow: false,
    spawnTick: 10,
    tint: 0xffffff,
    verticalVelocity: 0,
    velocity: Object.freeze({ x: 0, y: 0 }),
    ...patch,
  })
}

function projectileEffect(
  patch: Partial<BoneyardEnemyProjectileEffect> = {},
): BoneyardEnemyProjectileEffect {
  return Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaLossPerTick: 0.1,
    angularVelocityDeg: 3,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 251,
    id: 1,
    kind: 'fire-burst-frame',
    lastStepTick: 10,
    lightRegistration: null,
    lifetimeTicks: 16,
    ownerActorId: 3,
    ownerProjectileId: 4,
    phaseOriginTicks: 0,
    position: Object.freeze({ x: 30, y: 40 }),
    rotationDeg: 0,
    scale: 1,
    spawnTick: 10,
    tint: 0xffffff,
    velocity: Object.freeze({ x: 0, y: 0 }),
    ...patch,
  })
}
