import assert from 'node:assert/strict'
import test from 'node:test'
import { stepBoneyardTransientEffects } from './boneyard-transient-effects.ts'
import type { BoneyardEnemyDeathEffect, BoneyardEnemyProjectileEffect } from './enemies/model.ts'
const registerTestWorldPainter = (managerLane: 'actor' | 'transient') => ({
  managerLane,
  registrationOrdinal: 99,
})

test('stationary transient rows reuse vectors without mutating their source branch', () => {
  const death = deathEffect()
  const projectile = projectileEffect({ kind: 'fire-burst' })
  const result = stepBoneyardTransientEffects(
    [death], [projectile], 11, () => 0.5, 100, registerTestWorldPainter,
  )
  const steppedDeath = result.deathEffects[0]!
  const steppedProjectile = result.projectileEffects[0]!

  assert.notEqual(steppedDeath, death)
  assert.equal(steppedDeath.position, death.position)
  assert.equal(steppedDeath.velocity, death.velocity)
  assert.equal(steppedDeath.alpha, 0.8999999761581421)
  assert.equal(death.alpha, 1)
  assert.notEqual(steppedProjectile, projectile)
  assert.equal(steppedProjectile.position, projectile.position)
  assert.equal(steppedProjectile.velocity, projectile.velocity)
  assert.equal(projectile.ageTicks, 0)
})

test('moving transient rows keep exact motion while sibling branches remain independent', () => {
  const source = deathEffect({ kind: 'move-fade', velocity: { x: 2, y: -3 } })
  const first = stepBoneyardTransientEffects(
    [source], [], 11, () => 0.5, 100, registerTestWorldPainter,
  )
  const second = stepBoneyardTransientEffects(
    [source], [], 12, () => 0.5, 100, registerTestWorldPainter,
  )

  assert.deepEqual(first.deathEffects[0]?.position, { x: 12, y: 17 })
  assert.deepEqual(second.deathEffects[0]?.position, { x: 14, y: 14 })
  assert.deepEqual(source.position, { x: 10, y: 20 })
})

test('moving sine fades keep world motion and their half-sine envelope through restoration and retirement', () => {
  const source = deathEffect({ kind: 'move-fade-sin', frameVelocity: 2, alphaMultiplier: .5,
    alphaLossPerTick: 0, lifetimeTicks: 181, velocity: { x: .25, y: -.125 } })
  const halfway = stepBoneyardTransientEffects([source], [], 55, () => .5, 100, registerTestWorldPainter)
  const effect = halfway.deathEffects[0]!
  assert.equal(effect.framePhase, 90)
  assert.equal(effect.alpha, .5)
  assert.deepEqual(effect.position, { x: 21.25, y: 14.375 })
  const saved = JSON.parse(JSON.stringify(halfway.deathEffects))
  assert.deepEqual(stepBoneyardTransientEffects(saved, [], 99, () => .5, 100, registerTestWorldPainter),
    stepBoneyardTransientEffects(halfway.deathEffects, [], 99, () => .5, 100, registerTestWorldPainter))
  assert.equal(stepBoneyardTransientEffects(saved, [], 100, () => .5, 100, registerTestWorldPainter).deathEffects.length, 0)
})

test('Faculty scraps delay fading until they slow down, then drift, oscillate and retire', () => {
  const source = deathEffect({ kind: 'scrap', entry: 66, opacityTimer: .02,
    lifetimeTicks: 1000, velocity: { x: 1, y: 0 }, painterSortBias: -25,
    scrapOscillation: { amplitudeDeg: 20, phaseDeg: 0, stepDeg: 5 } })
  let draws = 0
  const draw = () => { draws += 1; return 1 }
  let result = stepBoneyardTransientEffects([source], [], 11, draw, 100, registerTestWorldPainter)
  assert.equal(result.deathEffects[0]!.opacityTimer, .02)
  assert.equal(result.deathEffects[0]!.velocity.x, Math.fround(.9200000166893005))
  assert.equal(result.deathEffects[0]!.rotationDeg, Math.fround(Math.sin(5 * Math.PI / 180) * 20))
  assert.equal(result.deathEffects[0]!.painterSortBias, -25)
  assert.equal(draws, 0, 'fast scraps do not consume the slow sideways drift draw')
  result = stepBoneyardTransientEffects(result.deathEffects, [], 18, draw, 100, registerTestWorldPainter)
  assert.equal(result.deathEffects[0]!.opacityTimer, .02)
  result = stepBoneyardTransientEffects(result.deathEffects, [], 19, draw, 100, registerTestWorldPainter)
  assert.equal(draws, 1)
  assert.equal(result.deathEffects[0]!.opacityTimer, Math.fround(.02 - .009999999776482582))
  result = stepBoneyardTransientEffects(result.deathEffects, [], 22, draw, 100, registerTestWorldPainter)
  assert.deepEqual(result.deathEffects, [])
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
  }, 100, registerTestWorldPainter).deathEffects[0]!

  assert.deepEqual(draws, [0.25, 0.25])
  assert.equal(bounced.height, 0)
  assert.equal(bounced.verticalVelocity, 0)
  assert.deepEqual(bounced.velocity, { x: 0, y: 0 })
  assert.equal(
    stepBoneyardTransientEffects(
      [bounced], [], 14, () => 0.75, 100, registerTestWorldPainter,
    )
      .deathEffects.length,
    0,
  )
})

test('SmokyBouncer births receive a fresh world-painter registration', () => {
  const registrations: Array<{
    managerLane: 'actor' | 'transient'
    registrationOrdinal: number
  }> = []
  const draws = [0.4, 0.5, 0.25, 0.75, 0.5, 0.25]
  const result = stepBoneyardTransientEffects(
    [deathEffect({
      height: -10,
      kind: 'smoky-bouncer',
      verticalVelocity: 0,
    })],
    [],
    11,
    () => draws.shift() ?? 0,
    100,
    (managerLane) => {
      const registration = {
        managerLane,
        registrationOrdinal: 200 + registrations.length,
      }
      registrations.push(registration)
      return registration
    },
  )

  assert.equal(result.deathEffects.length, 2)
  assert.equal(result.nextDeathEffectId, 101)
  assert.deepEqual(registrations, [{ managerLane: 'transient', registrationOrdinal: 200 }])
  assert.deepEqual(result.deathEffects[1]?.painterRegistration, registrations[0])
  assert.equal(result.deathEffects[1]?.presentationOwner, 'world-sorted')
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
  const first = stepBoneyardTransientEffects(
    [], [source], 11, () => 0, 100, registerTestWorldPainter,
  )
    .projectileEffects[0]!
  assert.equal(first.alpha, Math.fround(Math.fround(0.2) - Math.fround(0.1)))
  assert.deepEqual(first.position, { x: Math.fround(31), y: Math.fround(39.5) })
  assert.deepEqual(first.velocity, {
    x: Math.fround(Math.fround(1) * Math.fround(0.98)),
    y: Math.fround(Math.fround(-0.5) * Math.fround(0.98)),
  })
  assert.equal(
    stepBoneyardTransientEffects(
      [], [first], 12, () => 0, 100, registerTestWorldPainter,
    )
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
      frameVelocity: 1,
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
  }, 100, registerTestWorldPainter)
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
    { ageTicks: 3, alpha: 0.6999999284744263, entry: 113, lastStepTick: 13,
      position: { x: 10, y: 20 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.6999999284744263, entry: 113, lastStepTick: 13,
      position: { x: 10, y: 20 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.6999999284744263, entry: 113, lastStepTick: 13,
      position: { x: 16, y: 11 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.6999999284744263, entry: 113, lastStepTick: 13,
      position: { x: 10, y: 20 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.6999999284744263, entry: 43, lastStepTick: 13,
      position: { x: 13, y: 20 }, rotationDeg: 11, scale: 1 },
    { ageTicks: 3, alpha: 0.6999999284744263, entry: 50, lastStepTick: 13,
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

test('visual projectile effects retain native catch-up clocks and source ownership', () => {
  const kinds = ['arrow-tumble', 'fire-burst', 'firebolt-trail', 'guided-impact',
    'demon-explosion-core', 'demon-explosion-array', 'demon-explosion-lit-array'] as const
  const source = kinds.map((kind, index) => projectileEffect({
    id: index + 1, kind, lifetimeTicks: 30,
    velocity: kind === 'arrow-tumble' ? { x: 1, y: -0.5 } : { x: 0, y: 0 },
  }))
  const before = structuredClone(source)
  const result = stepBoneyardTransientEffects([], source, 14, () => 0, 100, registerTestWorldPainter)
  assert.deepEqual(source, before)
  assert.deepEqual(result.projectileEffects.map(effect => effect.kind), kinds)
  assert.ok(result.projectileEffects.every(effect => effect.ageTicks === 4 && effect.lastStepTick === 14))
  assert.equal(result.projectileEffects.find(effect => effect.kind === 'fire-burst')?.entry, 252)
  assert.ok(result.projectileEffects.every(effect => effect.alpha > 0.59 && effect.alpha < 0.61))
  assert.ok(result.projectileEffects[0]!.position.x > source[0]!.position.x)
})

test('delayed births and strict lifetime edges apply across complete transient populations', () => {
  const delayed = deathEffect({ lastStepTick: 10, spawnTick: 12 })
  const beforeBirth = stepBoneyardTransientEffects(
    [delayed], [], 11, () => 0, 100, registerTestWorldPainter,
  )
    .deathEffects[0]!
  assert.equal(beforeBirth.ageTicks, 0)
  assert.equal(beforeBirth.lastStepTick, 11)
  assert.equal(beforeBirth.opacityTimer, delayed.opacityTimer)

  const deathKinds = [
    'banish', 'bouncer', 'smoky-bouncer', 'fade', 'fade-additive',
    'fade-perspective', 'fade-perspective-clipped', 'fade-scale', 'fire-array',
    'late-splat', 'move-fade', 'sprite-array', 'unbind',
  ] as const
  const projectileKinds = ['arrow-tumble', 'fire-burst', 'firebolt-trail', 'guided-impact'] as const
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
    100,
    registerTestWorldPainter,
  )
  assert.deepEqual(result, {
    deathEffects: [],
    nextDeathEffectId: 100,
    projectileEffects: [],
  })
})

function deathEffect(
  patch: Partial<BoneyardEnemyDeathEffect> = {},
): BoneyardEnemyDeathEffect {
  return Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaMultiplier: 1,
    alphaLossPerTick: 0.1,
    angularVelocityDeg: 2,
    atlas: 'BadGuys',
    blendMode: 'normal',
    bounceRetention: 0.65,
    bounceVelocity: 0,
    entry: 113,
    firstEntry: 113,
    frameCount: 1,
    framePhase: 0,
    frameVelocity: 0,
    frameVelocityDamping: 1,
    frameTicks: 1,
    height: 0,
    id: 1,
    kind: 'fade',
    lastStepTick: 10,
    lifetimeTicks: 20,
    opacityTimer: 1,
    ownerActorId: 3,
    painterRegistration: { managerLane: 'transient', registrationOrdinal: 3 },
    presentationOwner: 'world-sorted',
    position: Object.freeze({ x: 10, y: 20 }),
    role: 'transient-test',
    rotationDeg: 5,
    scale: 1,
    scaleMultiplier: 1,
    scaleY: 1,
    shadow: false,
    spawnTick: 10,
    tint: 0xffffff,
    verticalVelocity: 0,
    velocity: Object.freeze({ x: 0, y: 0 }),
    velocityDamping: 1,
    ...patch,
  })
}

function projectileEffect(
  patch: Partial<Exclude<BoneyardEnemyProjectileEffect, { kind: 'demon-fire' | 'poison-bubble' }>> = {},
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
    kind: 'fire-burst',
    lastStepTick: 10,
    lightRegistration: null,
    lifetimeTicks: 16,
    ownerActorId: 3,
    ownerProjectileId: 4,
    painterRegistration: { managerLane: 'transient', registrationOrdinal: 4 },
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
