import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { nativeEnemyProjectileVelocity } from '../../core-kernels/native-enemy-targeting.ts'
import {
  NATIVE_POISON_POOL_GROWTH,
  NATIVE_POISON_POOL_MAXIMUM_SCALE,
  nativePoisonPoolAlpha,
  nativePoisonPoolContact,
} from '../../core-kernels/native-poison-pool.ts'
import { nativeHeadingTurnDirection, nativePrimaryCellCoordinate } from '../../core-kernels/primary-spell-targeting.ts'
import { stepProjectileEffects } from '../boneyard-transient-effects.ts'
import { emitEvent } from './events.ts'
import type {
  BoneyardEnemyProjectile,
  BoneyardEnemyStoreStepContext,
  BoneyardEnemyTargets,
  WorkingStep,
} from './model.ts'
import { NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS as PROGRAM } from './programs.ts'
import { spawnProjectileImpactEffects, spawnProjectileTrails } from './projectile-effects.ts'
import {
  spawnDemonExplosion,
  spawnDemonFireHandoff,
  spawnPoisonPoolBubble,
  stepDemonFires,
  stepProjectileKnockbacks,
} from './projectile-hazards.ts'
import { targetEligible } from './targeting.ts'

export function stepProjectiles(work: WorkingStep, context: BoneyardEnemyStoreStepContext): void {
  let firstTick = context.tick
  for (const projectile of work.projectiles) {
    firstTick = Math.min(firstTick, projectile.lastStepTick + 1)
  }
  for (const effect of work.projectileEffects) {
    if (effect.kind === 'demon-fire') firstTick = Math.min(firstTick, effect.lastStepTick + 1)
  }
  for (const knockback of work.projectileKnockbacks) firstTick = Math.min(firstTick, knockback.lastStepTick + 1)
  for (let tick = firstTick; tick <= context.tick; tick += 1) {
    stepProjectileKnockbacks(work, context, tick)
    stepDemonFires(work, context, tick)
    const retained: BoneyardEnemyProjectile[] = []
    for (const source of work.projectiles) {
      const projectile = source.lastStepTick >= tick
        ? source
        : stepProjectile(work, source, context, tick)
      if (projectile) retained.push(projectile)
    }
    work.projectiles = retained
  }
  work.projectileEffects = stepProjectileEffects(work.projectileEffects, context.tick)
}

function stepProjectile(
  work: WorkingStep,
  source: BoneyardEnemyProjectile,
  context: BoneyardEnemyStoreStepContext,
  tick: number,
): BoneyardEnemyProjectile | null {
  switch (source.kind) {
    case 'arrow': return stepArrow(work, source, context, tick)
    case 'firebolt': return stepFirebolt(work, source, context, tick)
    case 'guided-missile': return stepGuidedMissile(work, source, context, tick)
    case 'demon-bomb': return stepDemonBomb(work, source, context, tick)
    case 'poison-pool': return stepPoisonPool(work, source, context, tick)
  }
}

function movedProjectile(source: BoneyardEnemyProjectile, tick: number): BoneyardEnemyProjectile {
  const velocity = nativeEnemyProjectileVelocity(source.headingDeg, source.speed)
  return {
    ...source,
    ageTicks: source.ageTicks + 1,
    lastStepTick: tick,
    position: {
      x: Math.fround(source.position.x + velocity.x),
      y: Math.fround(source.position.y + velocity.y),
    },
  }
}

function terrainBlocked(
  projectile: BoneyardEnemyProjectile,
  context: BoneyardEnemyStoreStepContext,
  ticksAhead: number,
  nativeExclusionMask: number,
): boolean {
  const velocity = projectile.kind === 'arrow' ? projectile.velocity
    : nativeEnemyProjectileVelocity(projectile.headingDeg, projectile.speed)
  return context.projectileWorldBlocked({
    kind: 'line',
    start: projectile.position,
    end: {
      x: Math.fround(projectile.position.x + velocity.x * ticksAhead),
      y: Math.fround(projectile.position.y + velocity.y * ticksAhead),
    },
    nativeExclusionMask,
    projectileId: projectile.id,
    radius: 0,
  })
}

function stepArrow(
  work: WorkingStep,
  source: Extract<BoneyardEnemyProjectile, { kind: 'arrow' }>,
  context: BoneyardEnemyStoreStepContext,
  tick: number,
): BoneyardEnemyProjectile | null {
  const moved = {
    ...source, ageTicks: source.ageTicks + 1, lastStepTick: tick,
    position: { x: Math.fround(source.position.x + source.velocity.x), y: Math.fround(source.position.y + source.velocity.y) },
  }
  if (context.projectileWorldBlocked({
    kind: 'bounds', margin: 0, position: moved.position, projectileId: source.id,
  })) return retireProjectile(work, moved, tick)
  const playerId = source.verticalOffset === 0
    ? null
    : firstPlayerCenterContact(moved.position, context.players, 20)
  if (playerId !== null) emitProjectileImpact(work, moved, tick, playerId)
  const blocked = moved.ageTicks % 5 === 0 && terrainBlocked(moved, context, 5, 0x380)
  if (blocked) emitProjectileImpact(work, moved, tick, null)
  if (playerId !== null || blocked) return retireProjectile(work, moved, tick, playerId)

  const settledTicksRemaining = Math.max(0, source.settledTicksRemaining - 1)
  if (settledTicksRemaining > 0) {
    return { ...moved, settledTicksRemaining, visualPhaseDeg: source.headingDeg }
  }
  if (source.verticalOffset >= PROGRAM.arrowAirborneHeightBoundary) {
    const visualScale = Math.fround(source.visualScale - PROGRAM.arrowOpacityLossPerTick)
    if (visualScale <= 0) return retireProjectile(work, moved, tick)
    return { ...moved, settledTicksRemaining, speed: 0, velocity: { x: 0, y: 0 }, verticalOffset: 0, visualScale }
  }
  const verticalOffset = Math.fround(source.verticalOffset + PROGRAM.arrowHeightPerTick)
  const launchVelocity = nativeEnemyProjectileVelocity(source.headingDeg, source.minimumSpeed)
  const launchSpeed = Math.fround(Math.sqrt(Math.fround(launchVelocity.x * launchVelocity.x + launchVelocity.y * launchVelocity.y)))
  const verticalTerm = Math.fround((PROGRAM.arrowInitialHeight / verticalOffset)
    * launchSpeed * PROGRAM.arrowPitchFactor)
  const velocity = {
    x: Math.fround(source.velocity.x * PROGRAM.arrowPlanarDampingPerTick),
    y: Math.fround(source.velocity.y * PROGRAM.arrowPlanarDampingPerTick),
  }
  return {
    ...moved,
    settledTicksRemaining,
    speed: Math.fround(Math.hypot(velocity.x, velocity.y)),
    velocity,
    verticalOffset,
    visualPhaseDeg: Math.fround(actorHeadingFromVector(
      launchVelocity.x,
      Math.fround(launchVelocity.y + verticalTerm),
    )),
  }
}

function stepFirebolt(
  work: WorkingStep,
  source: BoneyardEnemyProjectile,
  context: BoneyardEnemyStoreStepContext,
  tick: number,
): BoneyardEnemyProjectile | null {
  if ((source.ageTicks + 1) % 10 === 0 && terrainBlocked(source, context, 10, 0x700)) {
    emitProjectileImpact(work, source, tick, null)
    return retireProjectile(work, source, tick, null)
  }
  const moved = movedProjectile(source, tick)
  const outsideView = context.projectileWorldBlocked({
    kind: 'view', margin: 50, position: moved.position, projectileId: source.id,
  })
  spawnProjectileTrails(work, source, moved.position, 1, 1)
  const playerId = firstPlayerCenterContact(moved.position, context.players, 30)
  if (playerId !== null) emitProjectileImpact(work, moved, tick, playerId)
  if (playerId !== null || outsideView || moved.ageTicks >= source.lifetimeTicks) {
    return retireProjectile(work, moved, tick, playerId)
  }
  return moved
}

function stepGuidedMissile(
  work: WorkingStep,
  source: BoneyardEnemyProjectile,
  context: BoneyardEnemyStoreStepContext,
  tick: number,
): BoneyardEnemyProjectile | null {
  const moved = movedProjectile(source, tick)
  if (context.projectileWorldBlocked({
    kind: 'bounds', margin: 500, position: moved.position, projectileId: source.id,
  })) return retireProjectile(work, moved, tick)
  const target = source.targetPlayerId === null ? undefined : context.players[source.targetPlayerId]
  const targetPlayerId = target && targetEligible(target) ? source.targetPlayerId : null
  const desiredHeading = targetPlayerId === null || !target
    ? source.headingDeg
    : actorHeadingFromVector(target.position.x - moved.position.x, target.position.y - moved.position.y)
  const stepped = {
    ...moved,
    headingDeg: Math.fround((source.headingDeg + source.turnSpeed
      * nativeHeadingTurnDirection(source.headingDeg, desiredHeading) + 360) % 360),
    targetPlayerId,
    visualPhaseDeg: Math.fround(source.visualPhaseDeg + source.speed * 6),
  }
  const playerId = firstGuidedMissileContact(work, stepped, context.players)
  if (playerId !== null) emitProjectileImpact(work, stepped, tick, playerId)
  // Native lookahead still consumes the vector made before this tick's turn.
  const blocked = moved.ageTicks % 5 === 0 && terrainBlocked(moved, context, 5, 0x700)
  if (blocked) emitProjectileImpact(work, stepped, tick, null)
  if (playerId !== null || blocked) return retireProjectile(work, stepped, tick, playerId)
  if (moved.ageTicks >= source.lifetimeTicks) return retireProjectile(work, stepped, tick)
  return {
    ...stepped,
    speed: Math.fround(Math.max(source.minimumSpeed, source.speed - PROGRAM.guidedSpeedLossPerTick)),
  }
}

export function firstGuidedMissileContact(work: WorkingStep, projectile: Pick<BoneyardEnemyProjectile, 'position' | 'targetPlayerId'>, players: BoneyardEnemyTargets): string | null {
  const target = projectile.targetPlayerId === null ? undefined : players[projectile.targetPlayerId]
  if (target && targetEligible(target) && squaredDistance(projectile.position, target.position) < 100) {
    return projectile.targetPlayerId
  }
  const cellX = nativePrimaryCellCoordinate(projectile.position.x)
  const cellY = nativePrimaryCellCoordinate(projectile.position.y)
  let selected: string | null = null
  let firstOrder = Infinity
  for (const [playerId, player] of Object.entries(players)) {
    if (!targetEligible(player)) continue
    if (nativePrimaryCellCoordinate(player.position.x) !== cellX
      || nativePrimaryCellCoordinate(player.position.y) !== cellY) continue
    const radius = player.collisionRadius + 2
    const order = work.targetCellBindings[playerId]!.order
    if (order < firstOrder && squaredDistance(projectile.position, player.position) < radius * radius) {
      selected = playerId
      firstOrder = order
    }
  }
  return selected
}

function stepDemonBomb(
  work: WorkingStep,
  source: BoneyardEnemyProjectile,
  context: BoneyardEnemyStoreStepContext,
  tick: number,
): BoneyardEnemyProjectile | null {
  const blocked = context.projectileWorldBlocked({
    kind: 'point', position: source.position, projectileId: source.id, radius: 1,
  })
  const moved = movedProjectile(blocked ? { ...source, speed: 0 } : source, tick)
  const playerId = firstPlayerCenterContact(moved.position, context.players, 35)
  let speed = Math.fround(moved.speed * PROGRAM.demonBombDampingPerTick)
  let verticalOffset = Math.fround(source.verticalOffset + source.verticalVelocity)
  let verticalVelocity = Math.fround(source.verticalVelocity + PROGRAM.demonBombGravityPerTick)
  let bounceVelocity = source.bounceVelocity
  if (verticalOffset > 0) {
    verticalOffset = 0
    bounceVelocity = Math.fround(bounceVelocity * PROGRAM.demonBombBounceMultiplier)
    verticalVelocity = bounceVelocity > -0.10000000149011612 ? 0 : bounceVelocity
  }
  let settledTicksRemaining = source.settledTicksRemaining
  if (blocked || playerId !== null) {
    speed = 0
    settledTicksRemaining = 0
  }
  if (bounceVelocity > -1) speed = Math.fround(speed * PROGRAM.demonBombSettledDampingPerTick)
  if (speed < 1) {
    settledTicksRemaining -= 1
    bounceVelocity = 0
  }
  const stepped = {
    ...moved, speed, verticalOffset, verticalVelocity, bounceVelocity, settledTicksRemaining,
  }
  if (settledTicksRemaining > 0) return stepped
  context.onProjectileExplosion?.(stepped.position)
  spawnDemonExplosion(work, stepped, tick)
  spawnDemonFireHandoff(work, stepped, tick, stepped.position)
  const eventId = emitEvent(work, tick, 'projectile-impact', source.ownerActorId, {
    projectileId: source.id, targetPlayerId: null,
  })
  for (const [id, player] of Object.entries(context.players)) {
    if (!targetEligible(player)) continue
    if (squaredDistance(stepped.position, player.position) >= 82.5 * 82.5) continue
    const x = Math.fround(player.position.x - stepped.position.x)
    const y = Math.fround(player.position.y - stepped.position.y)
    const distance = Math.fround(Math.hypot(x, y))
    if (!player.summoned && distance > 0) work.projectileKnockbacks.push({
      actorId: source.ownerActorId, eventId, playerId: id, lastStepTick: tick, remainingTicks: 10,
      delta: { x: Math.fround(x / distance * 4.5), y: Math.fround(y / distance * 4.5) },
    })
    work.playerDamage.push({
      actorId: source.ownerActorId,
      physicalDamage: Math.fround(source.damage * 0.5),
      magicDamage: Math.fround(source.damage * 0.5),
      coldSlowTicks: 0, dazzleTicks: 0, eventId, playerId: id, poisonDamage: 0, poisonDuration: 0,
    })
  }
  return retireProjectile(work, stepped, tick, null)
}

function stepPoisonPool(
  work: WorkingStep,
  source: BoneyardEnemyProjectile,
  context: BoneyardEnemyStoreStepContext,
  tick: number,
): BoneyardEnemyProjectile | null {
  const stepped = {
    ...source,
    ageTicks: source.ageTicks + 1,
    lastStepTick: tick,
    visualScale: Math.min(NATIVE_POISON_POOL_MAXIMUM_SCALE,
      Math.fround(source.visualScale + NATIVE_POISON_POOL_GROWTH)),
  }
  spawnPoisonPoolBubble(work, stepped, tick)
  for (const [playerId, player] of Object.entries(context.players)) {
    if (!player.summoned && targetEligible(player) && nativePoisonPoolContact(stepped.position, player.position)) {
      applyProjectileContact(work, stepped, playerId, work.nextEventId++)
    }
  }
  if (nativePoisonPoolAlpha(stepped.ageTicks) === 0) return retireProjectile(work, stepped, tick)
  return stepped
}

function firstPlayerCenterContact(position: Readonly<BoneyardPoint>, players: BoneyardEnemyTargets, radius: number): string | null {
  for (const [playerId, player] of Object.entries(players)) {
    if (!player.summoned && targetEligible(player) && squaredDistance(position, player.position) < radius * radius) return playerId
  }
  return null
}

function squaredDistance(left: Readonly<BoneyardPoint>, right: Readonly<BoneyardPoint>): number {
  const x = Math.fround(left.x - right.x)
  const y = Math.fround(left.y - right.y)
  return Math.fround(x * x + y * y)
}

function emitProjectileImpact(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
  playerId: string | null,
): void {
  spawnProjectileImpactEffects(work, projectile, tick, projectile.position)
  const eventId = emitEvent(work, tick, 'projectile-impact', projectile.ownerActorId, {
    projectileId: projectile.id, targetPlayerId: playerId,
  })
  if (playerId === null) return
  if (projectile.kind === 'guided-missile') {
    emitEvent(work, tick, 'player-status-sound', projectile.ownerActorId, {
      gainScale: 1, pitch: Math.fround(0.85), sound: 'magic-missile-hit',
      sourcePosition: projectile.position, targetPlayerId: playerId,
    })
  }
  applyProjectileContact(work, projectile, playerId, eventId)
}

function applyProjectileContact(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  playerId: string,
  eventId: number,
): void {
  const fireDamage = projectile.kind === 'firebolt'
    ? Math.fround(projectile.damage * 0.5)
    : Math.fround(projectile.secondaryDamage * 0.5)
  work.playerDamage.push({
    actorId: projectile.ownerActorId,
    physicalDamage: projectile.kind === 'arrow'
      ? Math.fround(projectile.damage + fireDamage) : fireDamage,
    magicDamage: projectile.kind === 'arrow' ? fireDamage
      : projectile.kind === 'firebolt' ? fireDamage : projectile.damage,
    coldSlowTicks: projectile.coldSlowTicks,
    dazzleTicks: 0, eventId, playerId,
    poisonDamage: projectile.poisonDamage,
    poisonDuration: projectile.poisonDuration,
    ...(projectile.kind === 'guided-missile' ? {
      poisonContactDamage: projectile.payload === 'poison' ? 1 : 0,
      suppressHitResponse: true,
    } : {}),
    ...(projectile.kind === 'poison-pool' ? { suppressFlash: true } : {}),
  })
}

function retireProjectile(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
  targetPlayerId = projectile.targetPlayerId,
): null {
  if (projectile.kind === 'firebolt') work.projectileEffects = work.projectileEffects.filter(effect => (
    effect.kind !== 'firebolt-trail' || effect.ownerProjectileId !== projectile.id
  ))
  emitEvent(work, tick, 'projectile-retired', projectile.ownerActorId, {
    projectileId: projectile.id, targetPlayerId,
  })
  return null
}
