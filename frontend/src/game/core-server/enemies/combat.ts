import { NATIVE_WRAITH_DAZZLE_TICKS } from '../../core-kernels/boneyard-enemy-modifiers.ts'
import { emitEvent } from './events.ts'
import type { BoneyardEnemyActor, BoneyardEnemyTargets, WorkingStep } from './model.ts'
import { BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE } from './programs.ts'
import { targetPlayerWithinAttackReach } from './targeting.ts'

export function attackMarker(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  targetPlayerId: string | null = actor.targetPlayerId,
): number {
  return emitEvent(work, tick, 'attack-marker', actor.id, {
    ...(actor.config.enemyToken === 'IMP'
      ? { painterRegistration: work.registerWorldPainter('transient') }
      : {}),
    targetPlayerId,
  })
}

export function directPlayerDamage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  eventId: number,
): void {
  if (targetPlayerId === null || actor.config.primaryDamage === null) return
  const zombie = actor.config.enemyToken === 'ZOMBIE' ? actor.config.family : null
  work.playerDamage.push(Object.freeze({
    actorId: actor.id,
    physicalDamage: actor.config.enemyToken === 'WRAITH' ? 0 : actor.config.primaryDamage,
    magicDamage: actor.config.enemyToken === 'WRAITH' ? actor.config.primaryDamage : 0,
    coldSlowTicks: 0,
    dazzleTicks: actor.config.enemyToken === 'WRAITH'
      ? NATIVE_WRAITH_DAZZLE_TICKS
      : 0,
    eventId,
    playerId: targetPlayerId,
    poisonDamage: zombie?.poisonPunchDamage ?? 0,
    poisonDuration: zombie?.poisonDuration ?? 0,
  }))
}

export function directContactPlayerDamage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
  centerReach: number,
  eventId: number,
): void {
  if (!targetPlayerWithinAttackReach(actor, targetPlayerId, players, centerReach)) return
  directPlayerDamage(work, actor, targetPlayerId, eventId)
  if (actor.config.enemyToken === 'ZOMBIE' && targetPlayerId !== null) {
    const target = players[targetPlayerId]
    if (!target) return
    const dx = target.position.x - actor.position.x
    const dy = target.position.y - actor.position.y
    const distance = Math.hypot(dx, dy)
    const headingRadians = actor.headingDeg * Math.PI / 180
    const unitX = distance === 0 ? Math.sin(headingRadians) : dx / distance
    const unitY = distance === 0 ? -Math.cos(headingRadians) : dy / distance
    work.playerKnockbacks.push(Object.freeze({
      actorId: actor.id,
      delta: Object.freeze({
        x: unitX * BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE,
        y: unitY * BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE,
      }),
      eventId,
      playerId: targetPlayerId,
    }))
  }
}
