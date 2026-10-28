import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { nativePoisonPoolAlpha } from '../../core-kernels/native-poison-pool.ts'
import { createNativeFirePatch, stepNativeFirePatch } from '../../core-kernels/primary-spell-fire-effects.ts'
import { emitEvent } from './events.ts'
import type {
  BoneyardEnemyProjectile,
  BoneyardEnemyProjectileEffect,
  BoneyardEnemyStoreStepContext,
  WorkingStep,
} from './model.ts'
import { createProjectileEffect } from './projectile-effects.ts'
import { drawEnemyFloat, drawEnemyInteger, drawEnemySign, radialVector } from './random.ts'
import { targetEligible } from './targeting.ts'

export function spawnDemonFireHandoff(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
  position: Readonly<BoneyardPoint>,
): void {
  for (const index of [0, 1]) {
    const atlasPhase = drawEnemyFloat(work, 32)
    const horizontalSign = drawEnemyInteger(work, 2) === 0 ? -1 : 1
    const offset = index === 0 ? 0 : drawEnemySign(work, Math.fround(10 + drawEnemyFloat(work, 10)))
    const scale = Math.fround((index === 0 ? 1 : Math.fround(0.6))
      + drawEnemyFloat(work, 0.2))
    const root = {
      x: Math.fround(position.x + offset),
      y: Math.fround(position.y + (index === 0 ? -10 : 5)),
    }
    const base = createProjectileEffect(work, projectile, tick, root, 'demon-fire', {
      atlas: 'DeadHawg', blendMode: 'add', entry: 46, lifetimeTicks: 501, scale,
    })
    const fire = createNativeFirePatch({
      burnDamage: 0, damage: projectile.damage, id: base.id, life: 5,
      nativeType: 'fire', ownerId: `enemy:${projectile.ownerActorId}`,
      painterRegistration: base.painterRegistration,
      position: root, scale, worldKey: 'enemy-store',
    }, atlasPhase, horizontalSign)
    work.projectileEffects.push({ ...base, fire, lightRegistration: base.painterRegistration })
  }
}

export function stepDemonFires(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
  tick: number,
): void {
  const retained: BoneyardEnemyProjectileEffect[] = []
  for (const effect of work.projectileEffects) {
    if (effect.kind !== 'demon-fire' || effect.lastStepTick >= tick) {
      retained.push(effect)
      continue
    }
    const { patch, contact } = stepNativeFirePatch(effect.fire, tick)
    if (contact) {
      for (const [playerId, player] of Object.entries(context.players)) {
        if (!targetEligible(player)) continue
        const x = Math.fround(player.position.x - contact.position.x)
        const y = Math.fround(player.position.y - contact.position.y)
        if (Math.fround(x * x + y * y) >= Math.fround(contact.radius * contact.radius)) continue
        // The native receiver samples its contact response after both damage lanes.
        drawEnemyFloat(work, 0.5)
        work.playerDamage.push({
          actorId: effect.ownerActorId,
          physicalDamage: Math.fround(contact.amount * 0.5), magicDamage: Math.fround(contact.amount * 0.5),
          coldSlowTicks: 0, dazzleTicks: 0, eventId: work.nextEventId++, playerId,
          poisonDamage: 0, poisonDuration: 0, suppressHitResponse: true,
        })
      }
    }
    if (patch) retained.push({
      ...effect, ageTicks: patch.ageTicks, alpha: Math.min(patch.life, 1),
      fire: patch, lastStepTick: tick,
    })
  }
  work.projectileEffects = retained
}

export function spawnPoisonPoolBubble(
  work: WorkingStep,
  pool: BoneyardEnemyProjectile,
  tick: number,
): void {
  if (nativePoisonPoolAlpha(pool.ageTicks) <= 0.75 || drawEnemyInteger(work, 20) !== 3) return
  const growthPerTick = Math.fround(Math.fround(0.05) + drawEnemyFloat(work, 0.05))
  const maximumScale = Math.fround(0.5 + drawEnemyFloat(work, 0.75))
  const holdTicks = 25 + drawEnemyInteger(work, 76)
  const radius = drawEnemyFloat(work, 50)
  const offset = radialVector(drawEnemyFloat(work, 360), radius)
  let growthTicks = 0
  for (let scale = 0; scale < maximumScale; growthTicks += 1) {
    scale = Math.min(maximumScale, Math.fround(scale + growthPerTick))
  }
  const effect = createProjectileEffect(work, pool, tick, {
    x: Math.fround(pool.position.x + offset.x),
    y: Math.fround(pool.position.y + Math.fround(offset.y * Math.fround(0.8))),
  }, 'poison-bubble', {
    alpha: 0.75, entry: 57, lifetimeTicks: growthTicks + holdTicks - 1, scale: 0,
  })
  work.projectileEffects.push({ ...effect, growthPerTick, maximumScale })
}

export function spawnDemonExplosion(work: WorkingStep, projectile: BoneyardEnemyProjectile, tick: number): void {
  const pitch = Math.fround(1 + drawEnemyFloat(work, 0.1))
  for (const [sound, playbackRate] of [['fireball-hit', pitch], ['throw-fire', Math.fround(0.8)]] as const) {
    emitEvent(work, tick, 'enemy-action-sound', projectile.ownerActorId, {
      gainScale: 2, pitch: playbackRate, sound, sourcePosition: projectile.position,
    })
  }
  for (const [kind, lifetimeTicks, entry] of [
    ['demon-explosion-core', 10, 15],
    ['demon-explosion-array', 35, 401],
    ['demon-explosion-lit-array', 37, 420],
  ] as const) {
    const lightRegistration = kind === 'demon-explosion-lit-array'
      ? work.registerProjectileWorldPainter('transient') : undefined
    const effect = createProjectileEffect(work, projectile, tick, projectile.position, kind, {
      lightRegistration,
      blendMode: kind === 'demon-explosion-core' ? 'normal' : 'add', entry, lifetimeTicks, scale: 1.5,
    })
    work.projectileEffects.push({
      ...effect,
      lightRegistration: kind === 'demon-explosion-lit-array' ? effect.painterRegistration : null,
    })
  }
}

export function stepProjectileKnockbacks(work: WorkingStep, context: BoneyardEnemyStoreStepContext, tick: number): void {
  work.projectileKnockbacks = work.projectileKnockbacks.flatMap(source => {
    if (source.lastStepTick >= tick) return [source]
    const player = context.players[source.playerId]
    if (!player || !targetEligible(player)) return []
    work.playerKnockbacks.push(source)
    return source.remainingTicks === 1 ? [] : [{
      ...source, lastStepTick: tick, remainingTicks: source.remainingTicks - 1,
    }]
  })
}
