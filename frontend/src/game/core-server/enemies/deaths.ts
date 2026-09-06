import type { EvaluatedBoneyardEnemyConfig } from '../../core-kernels/boneyard-enemy-config-model.ts'
import { spawnTerminalChildren } from './construction.ts'
import type { DeathEffectOwner } from './death-effects.ts'
import { spawnBouncer, spawnSimpleDeathEffect, spawnSpriteArray, spawnUnbind } from './death-effects.ts'
import { stepDyingDemonSkull } from './demon-skull-death.ts'
import { emitEnemyDeathSound, emitEnemyDeathSounds, emitEvent } from './events.ts'
import { spawnFacultyDyingEffects, spawnFacultyFinale } from './faculty-death.ts'
import { detachHeartmongerCrows, stepHeartmonger } from './heartmonger.ts'
import type { BoneyardEnemyActor, BoneyardEnemyBrain, BoneyardEnemyStoreStepContext, BoneyardEnemyTerminalOutput, WorkingStep } from './model.ts'
import { NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK, NATIVE_DEMON_RAW_FIRE_BURST_TICKS, NATIVE_IMP_CONSTRUCTION_MAXIMUM, NATIVE_IMP_SPLIT_CHILD_COUNT, NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM } from './programs.ts'
import { spawnProjectile } from './projectile-emission.ts'
import { drawInteger, drawUnit, radialVector, randomRadialDisplacement, signedUnit } from './random.ts'
import { SKELETON_BASE_FRAGMENT_ENTRIES, spawnHeartmongerShatter, spawnSkeletonShatter } from './skeleton-death.ts'
import { spawnSpiderRemains } from './spider-remains.ts'
export function stepDyingActor(
  work: WorkingStep,
  stored: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor | null {
  if (stored.config.enemyToken === 'COCOON') return null
  const tick = context.tick
  let source = stored
  if (source.config.enemyToken === 'DEMONSKULL' && source.brain.family === 'demon-skull' && source.brain.deathCountdown > 0) {
    return stepDyingDemonSkull(work, { ...source, config: source.config, brain: source.brain }, tick)
  }
  if (source.brain.family === 'heartmonger') source = stepHeartmonger(work, source, source.brain, context)
  if (source.config.enemyToken === 'DIREFACULTY') {
    const deathTick = Math.max(0, tick - (source.deathStartedTick ?? tick))
    if (source.deathTick === 0 && deathTick > 0) {
      emitEvent(work, tick, 'enemy-stream', source.id, { stream: 'faculty-die', sourcePosition: source.position })
      emitEvent(work, tick, 'enemy-screen-flash', source.id, { sourcePosition: source.position,
        screenFlash: { red: 0, green: 0, blue: 0, alpha: 1, decayPerTick: .01, pointAttenuated: true } })
    }
    if (source.deathTick < 101 && deathTick >= 101) {
      emitEvent(work, tick, 'enemy-stream', source.id, {
        stream: source.config.family.female ? 'faculty-no-female' : 'faculty-no', sourcePosition: source.position })
    }
    let headingDeg = source.headingDeg
    for (let step = source.deathTick + 1; step <= deathTick; step += 1) {
      spawnFacultyDyingEffects(work, source, tick - deathTick + step, step)
      headingDeg = Math.fround(headingDeg + Math.trunc(step / 20))
      if (headingDeg >= 360) headingDeg = Math.fround(headingDeg - 360)
    }
    source = { ...source, bodyPose: 3, deathTick, headingDeg,
      brain: source.brain.family === 'faculty' ? { ...source.brain, bodyPose: 3, bodyHeadingDeg: headingDeg } : source.brain }
    if (deathTick < 250) return source
  }
  if (source.config.enemyToken === 'DEMON') {
    const deathStartedTick = source.deathStartedTick ?? tick
    const deathTick = Math.max(0, tick - deathStartedTick)
    if (!source.deathPresentationStarted) {
      spawnDemonDeathFires(work, source, deathStartedTick)
      source = { ...source, deathPresentationStarted: true }
    }
    if (source.deathTick < 95 && deathTick >= 95) {
      emitEnemyDeathSound(work, tick, source, 'flash', 1)
      emitEnemyDeathSound(work, tick, source, 'demon-die', 1)
      spawnDemonDeathFireBurst(work, source, tick)
    }
    source = { ...source, deathTick }
    if (deathTick < 100) return source
  }
  detachHeartmongerCrows(work, source, context)
  emitEvent(work, tick, 'enemy-death', source.id)
  const captured = source.brain.family === 'spider' && source.brain.phase === 'captured'
  const output = terminalOutput(source.config.enemyToken)
  const outputCount = terminalOutputCount(work, source)
  emitEvent(work, tick, 'enemy-terminal-output', source.id, {
    count: outputCount,
    output,
  })
  context.retirementObserver?.onTerminalOutput(output, outputCount)
  if (!captured) emitEnemyDeathSounds(work, source, tick, outputCount)
  if (
    source.config.enemyToken === 'ZOMBIE'
    && source.config.family.rotten
    && source.config.family.poisonPoolDamage > 0
  ) {
    spawnProjectile(
      work,
      source,
      tick,
      'poison-pool',
      source.config.family.poisonPoolDamage,
    )
  }
  if (!captured) spawnEnemyDeathEffects(work, source, tick, outputCount)
  spawnTerminalChildren(work, source, context)
  const rewardEventId = emitEvent(work, tick, 'reward', source.id, {
    targetPlayerId: source.lastDamagedByPlayerId,
  })
  work.rewards.push(Object.freeze({
    actorId: source.id,
    eventId: rewardEventId,
    experience: source.config.experience,
    lootSource: Object.freeze({
      actorSeed: source.lootSeed,
      enemyToken: source.config.enemyToken,
      onDeathProgram: source.config.onDeathProgram,
      ...(source.config.recipeUid === null ? {} : {
        policies: source.config.lootPolicies,
        recipeUid: source.config.recipeUid,
      }),
      participantSlot: 0 as const,
      position: Object.freeze({ ...source.position }),
    }),
    playerId: source.lastDamagedByPlayerId,
  }))
  const eventId = emitEvent(work, tick, 'enemy-retired', source.id)
  work.retired.push(Object.freeze({ actorId: source.id, eventId }))
  return null
}

function spawnEnemyDeathEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  outputCount: number | undefined,
): void {
  switch (actor.config.enemyToken) {
    case 'SPIDER': spawnSpiderRemains(work, actor, tick); return
    case 'COCOON': return
    case 'DIREFACULTY': spawnFacultyFinale(work, actor, tick); return
    case 'HEARTMONGER': spawnHeartmongerShatter(work, actor, tick); return
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      spawnSkeletonShatter(work, actor, tick)
      return
    case 'IMP':
      spawnUnbind(work, actor, tick)
      {
        const scale = outputCount === NATIVE_IMP_SPLIT_CHILD_COUNT ? 0.25 : 1
        spawnSimpleDeathEffect(work, actor, tick, {
          alpha: 1,
          alphaLossPerTick: 0.02 / scale,
          atlas: 'BadGuys',
          blendMode: 'add',
          entry: 15,
          kind: 'banish',
          lifetimeTicks: Math.ceil(2 / (0.02 / scale)),
          opacityTimer: 2,
          role: 'imp-banish',
          scale,
        })
        spawnSpriteArray(work, actor, tick, 'imp-sprite-array', 401, 19, 1, {
          frameVelocity: 0.5 / scale,
          frameVelocityDamping: 0.98,
          presentationOwner: 'pre-world-queue',
          scale: 2 * scale,
        })
      }
      return
    case 'PORTAL':
      spawnPortalTerminalEffects(work, actor, tick)
      return
    case 'ZOMBIE':
      spawnZombieTerminalEffects(work, actor, tick)
      return
    case 'WRAITH':
      spawnWraithTerminalEffects(work, actor, tick)
      return
    case 'DEMON':
      spawnSimpleDeathEffect(work, actor, tick, {
        alpha: 1,
        alphaLossPerTick: 0.01,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 15,
        kind: 'banish',
        lifetimeTicks: 200,
        opacityTimer: 2,
        role: 'demon-banish',
        scale: 2,
      })
      spawnSpriteArray(work, actor, tick, 'demon-sprite-array', 401, 19, 1, {
        frameVelocity: 0.25,
        frameVelocityDamping: 0.995,
        presentationOwner: 'pre-world-queue',
        scale: 4,
      })
      return
    case 'COFFIN': {
      spawnCoffinTerminalEffects(work, actor, tick)
    }
  }
}

function spawnPortalTerminalEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  spawnSpriteArray(work, actor, tick, 'portal-terminal-array', 1823, 11, 1, {
    frameVelocity: 0.5,
    presentationOwner: 'pre-world-queue',
    scale: 2,
  })
  for (let index = 0; index < 12; index += 1) {
    spawnBouncer(work, actor, tick, 27, 'portal-black-smoke', {
      kind: 'smoky-bouncer',
      tint: 0,
      velocity: radialVector(index / 12 * 360, 1),
    })
  }
  for (const entry of [120, 144]) {
    spawnSimpleDeathEffect(work, actor, tick, {
      alpha: 0.75,
      alphaLossPerTick: 0.025,
      atlas: 'DeadHawg',
      blendMode: 'normal',
      entry,
      kind: 'fade-scale',
      lifetimeTicks: 30,
      role: 'portal-decal',
      scale: 1,
    })
  }
}

const ZOMBIE_BASE_FRAGMENT_ENTRIES = Object.freeze([
  2094, 2089, 2092, 2090, 2091,
] as const)

const ZOMBIE_ENHANCED_FRAGMENT_ENTRIES = Object.freeze([
  2090, 2091, 2090, 2091, 2094,
] as const)

const ZOMBIE_FLYBLOWN_FRAGMENT_ENTRIES = Object.freeze([
  2090, 2091, 2090, 2091, 2094,
  2090, 2091, 2090, 2091, 2094,
] as const)

function spawnZombieTerminalEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  if (actor.config.enemyToken !== 'ZOMBIE') {
    throw new Error('Zombie terminal effects require a Zombie actor')
  }
  if (actor.config.family.rotten) {
    const splatCount = 6 + drawInteger(work, 5)
    for (let index = 0; index < splatCount; index += 1) {
      spawnZombieLateSplat(work, actor, tick, index)
    }
  }

  const entries = [
    ...ZOMBIE_BASE_FRAGMENT_ENTRIES,
    ...ZOMBIE_ENHANCED_FRAGMENT_ENTRIES,
    ...(actor.config.family.rotten ? ZOMBIE_FLYBLOWN_FRAGMENT_ENTRIES : []),
    2093,
    2093,
  ]
  for (let index = 0; index < entries.length; index += 1) {
    const swap = drawInteger(work, entries.length)
    ;[entries[index], entries[swap]] = [entries[swap]!, entries[index]!]
  }
  let angleDeg = drawUnit(work) * 360
  const flyblownScale = actor.config.family.rotten ? 2 : 1
  for (const entry of entries) {
    spawnBouncer(work, actor, tick, entry, 'zombie-fragment', () => {
      const direction = radialVector(angleDeg, 1)
      const velocity = {
        x: direction.x * 1.5 * 0.75 * flyblownScale,
        y: direction.y * 0.75 * flyblownScale,
      }
      const distance = 5 + drawUnit(work) * 10
      return {
        position: {
          x: actor.position.x + velocity.x * (distance + 2),
          y: actor.position.y + velocity.y * distance,
        },
        velocity,
      }
    })
    angleDeg += 72 + (drawUnit(work) * 20 - 10)
  }

  spawnBouncer(
    work,
    actor,
    tick,
    () => 2365 + drawInteger(work, 144),
    'zombie-gait-fragment',
    {
      bounceRetention: 0.5,
      velocity: radialVector(angleDeg, 2),
    },
  )
  spawnUnbind(work, actor, tick)
  const opacityTimer = 10
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 0.6,
    alphaLossPerTick: 0.01,
    alphaMultiplier: 0.6,
    atlas: 'DeadHawg',
    blendMode: 'normal',
    entry: 30,
    kind: 'fade-perspective-clipped',
    lifetimeTicks: 1_000,
    opacityTimer,
    role: 'zombie-clipped-fade',
    rotationDeg: drawUnit(work) * 360,
    scale: (1 + drawUnit(work) * 0.25) * 1.5,
  })
}

function spawnZombieLateSplat(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  index: number,
): void {
  const delayTicks = 25 + drawInteger(work, 76)
  const opacityTimer = 3 + drawUnit(work) * 3
  const rotationDeg = drawUnit(work) * 360
  const scale = 0.75 + drawUnit(work) * 0.75
  const distance = 75 + drawUnit(work) * 75
  const offset = radialVector(drawUnit(work) * 360, distance)
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: Math.min(1, opacityTimer * 0.25),
    alphaLossPerTick: 0.01,
    atlas: 'DeadHawg',
    blendMode: 'normal',
    entry: 31,
    kind: 'late-splat',
    lifetimeTicks: Math.ceil(opacityTimer / 0.01),
    opacityTimer,
    position: {
      x: actor.position.x + offset.x,
      y: actor.position.y + offset.y,
    },
    presentationOwner: 'pre-world-queue',
    role: `zombie-late-splat:${index}`,
    rotationDeg,
    scale,
    spawnDelayTicks: delayTicks,
  })
}

function spawnWraithTerminalEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  spawnWraithDissolve(work, actor, tick)

  const entries = [...SKELETON_BASE_FRAGMENT_ENTRIES]
  for (let index = 0; index < entries.length; index += 1) {
    const swap = drawInteger(work, entries.length)
    ;[entries[index], entries[swap]] = [entries[swap]!, entries[index]!]
  }
  let angleDeg = actor.headingDeg
  for (const entry of entries) {
    spawnBouncer(work, actor, tick, entry, 'wraith-smoky-fragment', () => {
      const direction = radialVector(angleDeg + signedUnit(drawUnit(work)) * 45, 1)
      const velocity = { x: direction.x * 1.5, y: direction.y }
      const distance = 15 + drawUnit(work) * 30
      return {
        kind: 'smoky-bouncer',
        position: {
          x: actor.position.x + velocity.x * (distance + 2),
          y: actor.position.y + velocity.y * distance,
        },
        velocity,
      }
    })
    angleDeg += 72 + signedUnit(drawUnit(work)) * 10
  }

  spawnBouncer(
    work,
    actor,
    tick,
    () => 1819 + drawInteger(work, 4),
    'wraith-skull',
    () => ({
      bounceRetention: 0.7,
      height: -(10 + drawUnit(work) * 10),
      kind: 'smoky-bouncer',
      velocity: radialVector(
        actor.headingDeg + signedUnit(drawUnit(work)) * 10,
        5,
      ),
    }),
  )
  spawnUnbind(work, actor, tick)
}

function spawnWraithDissolve(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
): void {
  let angleDeg = drawUnit(work) * 360
  for (let index = 0; index < 12; index += 1) {
    const entry = drawInteger(work, 2) === 0 ? 11 : 10
    const speed = 2 + drawUnit(work) * 2
    const velocity = radialVector(
      angleDeg + signedUnit(drawUnit(work)) * 10,
      speed,
    )
    spawnSimpleDeathEffect(work, actor, tick, {
      alpha: 1,
      alphaLossPerTick: 0.025,
      atlas: 'BadGuys',
      blendMode: 'normal',
      entry,
      kind: 'move-fade',
      lifetimeTicks: 40,
      position: {
        x: actor.position.x + velocity.x * 10,
        y: actor.position.y + velocity.y * 10,
      },
      role: `wraith-dissolve-ray:${index}`,
      rotationDeg: angleDeg,
      scale: 1.5 + drawUnit(work) * 0.5,
      velocity,
      velocityDamping: 0.8,
    })
    angleDeg += 30
  }
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1,
    alphaLossPerTick: 0.1,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 20,
    kind: 'fade-scale',
    lifetimeTicks: 20,
    opacityTimer: 2,
    position: { x: actor.position.x + 1, y: actor.position.y - 15 },
    role: 'wraith-dissolve-core',
    scale: 1,
    scaleMultiplier: 1.02,
  })
  for (let index = 0; index < 12; index += 1) {
    spawnBouncer(work, actor, tick, 27, `wraith-dissolve-bouncer:${index}`, () => {
      const direction = radialVector(angleDeg, 1)
      const velocity = { x: direction.x * 1.5, y: direction.y }
      const distance = 15 + drawUnit(work) * 10
      return {
        opacityTimer: 1.5,
        position: {
          x: actor.position.x + velocity.x * (distance + 2),
          y: actor.position.y + velocity.y * distance,
        },
        velocity,
      }
    })
    angleDeg += 30 + signedUnit(drawUnit(work)) * 10
  }
}

function spawnCoffinTerminalEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  const entries = [...SKELETON_BASE_FRAGMENT_ENTRIES]
  for (let index = 0; index < entries.length; index += 1) {
    const swap = drawInteger(work, entries.length)
    ;[entries[index], entries[swap]] = [entries[swap]!, entries[index]!]
  }
  let angleDeg = drawUnit(work) * 360
  for (const entry of entries) {
    spawnBouncer(work, actor, tick, entry, 'coffin-bone', () => {
      const direction = radialVector(angleDeg, 1)
      const velocity = { x: direction.x * 1.5, y: direction.y }
      const distance = 15 + drawUnit(work) * 10
      return {
        position: {
          x: actor.position.x + velocity.x * (distance + 2),
          y: actor.position.y + velocity.y * distance,
        },
        velocity,
      }
    })
    angleDeg += 72 + signedUnit(drawUnit(work)) * 10
  }

  const mainCount = 40 + drawInteger(work, 11)
  for (let index = 0; index < mainCount; index += 1) {
    spawnBouncer(
      work,
      actor,
      tick,
      () => 2013 + drawInteger(work, 50),
      `coffin-main-fragment:${index}`,
      () => {
        const speed = 0.5 + drawUnit(work) * 0.5
        const direction = radialVector(angleDeg, speed)
        const velocity = { x: direction.x * 1.5, y: direction.y }
        const distance = 15 + drawUnit(work) * 10
        return {
          bounceVelocityScale: 2,
          position: {
            x: actor.position.x + velocity.x * (distance + 2),
            y: actor.position.y + velocity.y * distance,
          },
          velocity,
        }
      },
    )
    angleDeg += 72 + signedUnit(drawUnit(work)) * 10
  }

  const extraCount = 12 + drawInteger(work, 4)
  for (let index = 0; index < extraCount; index += 1) {
    spawnBouncer(
      work,
      actor,
      tick,
      // Coffin::Die selects BadGuys +0x4ABC, not the separate ground-decoration array.
      () => 2067 + drawInteger(work, 3),
      `coffin-extra-fragment:${index}`,
      () => {
        const speed = 1 + drawUnit(work)
        const direction = radialVector(angleDeg, speed)
        const velocity = { x: direction.x * 1.5, y: direction.y }
        const distance = 15 + drawUnit(work) * 10
        return {
          bounceVelocityScale: 2,
          position: {
            x: actor.position.x + velocity.x * (distance + 2),
            y: actor.position.y + velocity.y * distance,
          },
          velocity,
        }
      },
    )
    angleDeg += 72 + signedUnit(drawUnit(work)) * 10
  }

  spawnBouncer(
    work,
    actor,
    tick,
    () => 1819 + drawInteger(work, 4),
    'coffin-skull',
    { velocity: radialVector(angleDeg, 2) },
  )
  spawnUnbind(work, actor, tick)
}

function spawnDemonDeathFires(
  work: WorkingStep,
  actor: DeathEffectOwner,
  deathStartedTick: number,
): void {
  for (const delay of [0, 20, 40, 60, 80]) {
    const phase = drawInteger(work, 32)
    const displacement = randomRadialDisplacement(work, (100 - delay) / 20)
    spawnSpriteArray(
      work,
      actor,
      deathStartedTick,
      `demon-death-fire:${delay}`,
      46 + phase,
      32,
      4,
      {
        atlas: 'DeadHawg',
        blendMode: 'add',
        kind: 'fire-array',
        presentationOwner: 'pre-world-queue',
        position: {
          x: actor.position.x + displacement.x,
          y: actor.position.y + displacement.y - 20,
        },
        spawnDelayTicks: delay,
      },
    )
  }
}

function spawnDemonDeathFireBurst(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
): void {
  const rotationDeg = drawUnit(work) * 360
  const angularMagnitude = 0.5 + drawUnit(work)
  const angularVelocityDeg = (drawInteger(work, 2) === 0 ? -1 : 1)
    * angularMagnitude
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 0.5,
    alphaLossPerTick: 0.5 * NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK / 4,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 110,
    kind: 'fade',
    lifetimeTicks: NATIVE_DEMON_RAW_FIRE_BURST_TICKS,
    position: { x: actor.position.x, y: actor.position.y - 20 },
    presentationOwner: 'direct-post-world',
    role: 'demon-death-fire-burst-glow',
    scale: 10,
    tint: 0xff8000,
    velocity: { x: 0, y: -1 },
  })
  spawnSpriteArray(
    work,
    actor,
    tick,
    'demon-death-fire-burst-frame',
    251,
    4,
    1 / NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK,
    {
      angularVelocityDeg,
      blendMode: 'add',
      lifetimeTicks: NATIVE_DEMON_RAW_FIRE_BURST_TICKS,
      position: { x: actor.position.x, y: actor.position.y - 20 },
      presentationOwner: 'direct-post-world',
      rotationDeg,
      scale: 2,
      tint: 0xffffbf,
      velocity: { x: 0, y: -1 },
    },
  )
}

function terminalOutput(token: EvaluatedBoneyardEnemyConfig['enemyToken']): BoneyardEnemyTerminalOutput {
  switch (token) {
    case 'DEMONSKULL': return 'discorporeal-banish'
    case 'DIREFACULTY': return 'faculty-break'
    case 'HEARTMONGER': return 'heartmonger-shatter'
    case 'SKELETON': return 'skeleton-shatter'
    case 'SKELETONARCHER': return 'archer-shatter'
    case 'SKELETONMAGE': return 'mage-shatter'
    case 'IMP': return 'imp-split'
    case 'PORTAL': return 'portal-break'
    case 'ZOMBIE': return 'zombie-collapse'
    case 'WRAITH': return 'wraith-fragments'
    case 'DEMON': return 'demon-split'
    case 'COFFIN': return 'coffin-break'
    case 'SPIDER': return 'spider-collapse'
    case 'COCOON': throw new Error('Cocoons retire through their player owner')
  }
}

function terminalOutputCount(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
): number | undefined {
  if (actor.config.enemyToken === 'IMP') {
    return actor.config.family.splitDepth > 0
      && work.impActorCount <= NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM
      ? NATIVE_IMP_SPLIT_CHILD_COUNT
      : 0
  }
  if (actor.config.enemyToken === 'DEMON') {
    return Math.min(
      actor.config.family.splitCount,
      Math.max(0, NATIVE_IMP_CONSTRUCTION_MAXIMUM - work.impActorCount),
    )
  }
  return undefined
}

export function deathBrain(brain: BoneyardEnemyBrain): BoneyardEnemyBrain {
  if (brain.family === 'demon-skull') return { ...brain, actions: [], phase: 'death' }
  if (brain.family === 'faculty') return { ...brain, action: null, bodyPose: 0,
    handMask: 0, headingLocked: false, lightningActive: false, phase: 'death' }
  return brain.family === 'mage'
    ? {
        ...brain,
        lightningTargetPlayerId: null,
        lightningTargetPosition: null,
        lightningTicksRemaining: 0,
        phase: 'death',
      }
    : { ...brain, phase: 'death' } as BoneyardEnemyBrain
}
