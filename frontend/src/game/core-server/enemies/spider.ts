import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { lineBoundsExitObstruction } from '../../core-kernels/line-obstruction.ts'
import {
  nativeEnemyTargetRefreshTicks,
  resolveNativeEnemyPathGoal,
  stepNativeEnemyPathRecovery,
} from '../../core-kernels/native-enemy-pathfinding.ts'
import { stepNativeSilk } from '../../core-kernels/native-silk.ts'
import { moveNativeSpider, nativeSpiderMovementClock } from '../../core-kernels/native-spider.ts'
import { nativeCocoonPosition, stepNativeWebbed } from '../../core-kernels/native-webbed.ts'
import { directionFromHeading } from '../../core-kernels/primary-spell-targeting.ts'
import { attackMarker, directPlayerDamage } from './combat.ts'
import { spawnBouncer, spawnSimpleDeathEffect } from './death-effects.ts'
import { emitEvent } from './events.ts'
import { boneyardEnemyCollisionRadius } from './model.ts'
import type { BoneyardEnemyActor, BoneyardEnemyStoreStepContext, BoneyardSpiderBrain, WorkingStep } from './model.ts'
import { positiveModulo } from './movement.ts'
import { drawUnit } from './random.ts'
import { nativePrimaryCellChanged } from './registration.ts'

export function stepSpider(
  work: WorkingStep,
  source: BoneyardEnemyActor,
  sourceBrain: BoneyardSpiderBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (source.config.enemyToken !== 'SPIDER') throw new Error('Spider brain requires Spider config')
  if (!context.lightAt) throw new Error('Spider movement requires the native light sampler')
  const view = context.spiderMovementView
  const visible = view === undefined || view.cameras.some(camera => (
    source.position.x + 100 >= camera.x && source.position.x - 100 <= camera.x + camera.w
    && source.position.y + 100 >= camera.y && source.position.y - 100 <= camera.y + camera.h
  ))
  const clock = nativeSpiderMovementClock(source.id, context.tick, visible,
    view === undefined || context.lightAt(source.position) > 0, view?.enhancedEffects ?? true)
  if (!clock.due) return source
  if (!clock.full) return stepDegradedSpider(source, context, work.pathStatusFactors.get(source.id) ?? 1, clock.cadence)
  let brain = sourceBrain
  let actor = source
  const config = source.config
  const target = source.targetPlayerId === null ? undefined : context.players[source.targetPlayerId]
  const targetState = target === undefined ? null : {
    position: target.position,
    headingDeg: target.headingDeg ?? 0,
    radius: target.collisionRadius,
    isPlayer: target.summoned !== true,
    webSeverity: source.targetPlayerId === null ? 0 : work.webbedPlayers[source.targetPlayerId]?.severity ?? 0,
    velocityPerTick: target.velocityPerTick,
  }
  const speed = config.baseSpeed
  let dx = 0
  let dy = 0
  for (let call = 0; call < clock.cadence; call += 1) {
    const movementStart = actor.position
    const result = moveNativeSpider(brain, {
      headingDeg: actor.headingDeg, position: actor.position, speed,
      statusFactor: work.pathStatusFactors.get(actor.id) ?? 1,
      light: context.lightAt(actor.position), target: targetState,
      wanderHeadingDeg: actor.path.wanderHeadingDeg,
      routeGoal: goal => {
        const routed = routeGoal(actor, goal, target?.position ?? null, context, clock.cadence)
        actor = routed.actor
        return { goal: routed.goal, followingRoute: actor.path.routeTicksRemaining > 0, turnAround: routed.turnAround }
      },
      spitWebs: config.family.spitWebs, cocoonHealth: config.family.cocoonHealth,
      liveSilkCount: work.silks.length, sharedSpitTicksRemaining: work.spiderSpitTicksRemaining,
    }, work.steeringRngState)
    work.steeringRngState = result.rngState
    work.spiderSpitTicksRemaining = result.sharedSpitTicksRemaining
    brain = { ...result.state, family: 'spider', phase: 'active' }
    actor = { ...actor, position: result.position, headingDeg: positiveModulo(result.headingDeg, 360) }
    if (result.silk !== null) {
      const id = work.nextProjectileId++
      work.silks.push({
        id, ownerActorId: actor.id, spawnTick: context.tick, state: result.silk.state,
        nativeRegistrationOrder: work.nextNativeRegistrationOrder++,
        nativeCellBindingOrder: work.nextNativeCellBindingOrder++,
        painterRegistration: work.registerProjectileWorldPainter('actor'),
      })
      emitEvent(work, context.tick, 'enemy-action-sound', actor.id, {
        sound: (['shoot-web-1', 'shoot-web-2', 'shoot-web-3'] as const)[result.silk.soundIndex],
        pitch: result.silk.soundPitch, gainScale: 1, sourcePosition: result.silk.soundPosition,
      })
    }
    if (result.bite) {
      if (targetState?.isPlayer && targetState.webSeverity > 2) {
        spawnWebFragments(work, { id: actor.id, position: movementStart }, context.tick, 'spider-grab-fragment')
      }
      const eventId = attackMarker(work, actor, context.tick)
      directPlayerDamage(work, actor, actor.targetPlayerId, eventId)
      const sounds = result.biteSounds!
      emitEvent(work, context.tick, 'enemy-action-sound', actor.id, {
        sound: (['bite-1', 'bite-2'] as const)[sounds[0]], pitch: 1.5, gainScale: 1, sourcePosition: actor.position,
      })
      emitEvent(work, context.tick, 'enemy-action-sound', actor.id, {
        sound: (['maggot-squish-1', 'maggot-squish-2'] as const)[sounds[1]], pitch: 0.8, gainScale: 0.5, sourcePosition: actor.position,
      })
    }
    if (result.suck && actor.targetPlayerId !== null) {
      work.playerDamage.push({
        actorId: actor.id, playerId: actor.targetPlayerId, eventId: attackMarker(work, actor, context.tick),
        physicalDamage: config.family.suckDamagePerSecond * 0.25, magicDamage: 0,
        coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0,
      })
    }
    const vx = result.goal.x - actor.position.x
    const vy = result.goal.y - actor.position.y
    dx += vx
    dy += vy
  }
  const radius = brain.attached ? 5 : 15
  const position = context.resolveMovement({
    actorId: actor.id, delta: { x: dx, y: dy }, position: actor.position,
    purpose: 'movement', radius,
    requestedPosition: { x: actor.position.x + dx, y: actor.position.y + dy },
  })
  const recovery = stepNativeEnemyPathRecovery(actor.path, work.steeringRngState, {
    flankingEnabled: config.flanking, requestedDistance: Math.hypot(dx, dy),
    statusFactor: work.pathStatusFactors.get(actor.id) ?? 1, tick: context.tick,
    traveledDistance: Math.hypot(position.x - actor.position.x, position.y - actor.position.y),
  })
  work.steeringRngState = recovery.rngState
  return {
    ...actor, brain, bodyPose: brain.frame, position, path: recovery.state,
    nextMovementTick: context.tick + clock.cadence, lastMovementTick: context.tick,
  }
}

function routeGoal(
  actor: BoneyardEnemyActor,
  rawGoal: Readonly<BoneyardPoint>,
  targetPosition: Readonly<BoneyardPoint> | null,
  context: BoneyardEnemyStoreStepContext,
  cadence: number,
): Readonly<{ turnAround: boolean; actor: BoneyardEnemyActor; goal: Readonly<BoneyardPoint> }> {
  const navigation = context.navigation
  const bounds = context.spiderMovementView?.arenaBounds
  const goal = targetPosition === null && bounds !== undefined
    ? lineBoundsExitObstruction(actor.position, rawGoal, bounds)?.point ?? rawGoal : rawGoal
  if (!navigation) return { actor, goal, turnAround: false }
  const radius = boneyardEnemyCollisionRadius(actor)
  const routed = resolveNativeEnemyPathGoal(actor.path, {
    actorPosition: actor.position, bodyRadius: radius, cadenceTicks: cadence,
    navigationClearance: 25, rawGoal: goal, targetPosition,
    targetRefreshTicks: nativeEnemyTargetRefreshTicks(actor.config.pathfindingMode),
    directPathClear: (start, end) => navigation.isPathClear({
      actorId: actor.id, bodyRadius: radius, start, end, navigationClearance: 25, radius: 0,
    }),
    findRoute: (start, end, clearance, bodyRadius) => navigation.findRoute({
      actorId: actor.id, bodyRadius, start, end, navigationClearance: clearance, radius: clearance,
    }),
  })
  return { actor: { ...actor, path: routed.state }, goal: routed.goal, turnAround: routed.turnAround }
}

export function stepSpiderWebs(work: WorkingStep, context: BoneyardEnemyStoreStepContext): void {
  work.spiderSpitTicksRemaining = Math.max(0, work.spiderSpitTicksRemaining - 1)
  for (const [playerId, web] of Object.entries(work.webbedPlayers)) {
    const player = context.players[playerId]
    const next = player?.alive && player.connected ? stepNativeWebbed(web, player.velocityPerTick) : null
    if (next) work.webbedPlayers[playerId] = next
    else delete work.webbedPlayers[playerId]
  }
}

export function stepCocoonActor(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.brain.family !== 'cocoon') throw new Error('Cocoon requires its target owner')
  const ownerId = actor.brain.ownerPlayerId
  const owner = ownerId === null ? undefined : context.players[ownerId]
  const web = ownerId === null ? undefined : work.webbedPlayers[ownerId]
  if (!owner?.alive || !owner.connected || !web || web.severity < 3) {
    return { ...actor, lifeState: 'dying', brain: { ...actor.brain, phase: 'death' } }
  }
  return {
    ...actor, position: nativeCocoonPosition(owner.position, owner.headingDeg ?? 0),
    brain: { ...actor.brain, ownerPosition: owner.position },
  }
}

export function stepSilks(work: WorkingStep, context: BoneyardEnemyStoreStepContext): void {
  const survivors = []
  for (const actor of work.silks) {
    if (actor.spawnTick === context.tick) { survivors.push(actor); continue }
    const state = stepNativeSilk(actor.state)
    if (state === null) continue
    let hit = false
    if (!actor.state.ended && state.ageTicks % 4 !== 0) {
      for (const [playerId, player] of Object.entries(context.players)) {
        if (!player.alive || !player.connected || player.summoned) continue
        if ((state.position.x - player.position.x) ** 2 + (state.position.y - player.position.y) ** 2 >= player.collisionRadius ** 2) continue
        hit = true
        const eventId = emitEvent(work, context.tick, 'projectile-impact', actor.ownerActorId, {
          projectileId: actor.id, targetPlayerId: playerId,
        })
        work.playerDamage.push({
          actorId: actor.ownerActorId, playerId, eventId,
          physicalDamage: 1, magicDamage: 0, webbedStrength: state.cocoonHealth,
          coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0,
        })
        spawnSilkImpact(work, actor.ownerActorId, state.position, context.tick)
      }
    }
    if (!hit) survivors.push({
      ...actor, state,
      nativeCellBindingOrder: nativePrimaryCellChanged(actor.state.position, state.position)
        ? work.nextNativeCellBindingOrder++ : actor.nativeCellBindingOrder,
    })
  }
  work.silks = survivors
}

function spawnSilkImpact(work: WorkingStep, id: number, position: Readonly<BoneyardPoint>, tick: number): void {
  const owner = { id, position }
  spawnSimpleDeathEffect(work, owner, tick, {
    alpha: 1, opacityTimer: 4, alphaLossPerTick: Math.fround(Math.fround(0.1) * Math.fround(0.15)),
    atlas: 'DeadHawg', entry: 14, kind: 'fade-perspective', lifetimeTicks: 267, blendMode: 'add',
    position, role: 'silk-contact', scale: 1, rotationDeg: drawUnit(work) * 360,
  })
  spawnWebFragments(work, owner, tick, 'silk-fragment')
}

function spawnWebFragments(
  work: WorkingStep,
  owner: Readonly<{ id: number; position: Readonly<BoneyardPoint> }>,
  tick: number,
  role: string,
): void {
  const position = owner.position
  let heading = drawUnit(work) * 360
  for (let index = 0; index < 5; index += 1) {
    spawnBouncer(work, owner, tick, 27, role, () => {
      const radians = heading * Math.PI / 180
      const velocity = { x: Math.sin(radians) * 1.5, y: -Math.cos(radians) }
      const radius = 15 + drawUnit(work) * 10
      heading += 72 + (drawUnit(work) * 2 - 1) * 10
      return {
        scaleY: 0.75,
        position: { x: position.x + velocity.x * (radius + 2), y: position.y + velocity.y * radius },
        velocity,
      }
    })
  }
}

function stepDegradedSpider(
  actor: BoneyardEnemyActor, context: BoneyardEnemyStoreStepContext, status: number, cadence: number,
): BoneyardEnemyActor {
  const target = actor.targetPlayerId === null ? undefined : context.players[actor.targetPlayerId]
  const speed = actor.config.baseSpeed * actor.config.chaseSpeed * status * cadence * 0.25
  const direction = directionFromHeading(actor.id * 225)
  const rawGoal = target?.position ?? {
    x: actor.position.x + direction.x * speed, y: actor.position.y + direction.y * speed,
  }
  const routed = routeGoal(actor, rawGoal, target?.position ?? null, context, cadence)
  const heading = actorHeadingFromVector(routed.goal.x - actor.position.x, routed.goal.y - actor.position.y)
  const facing = directionFromHeading(heading)
  const delta = { x: Math.fround(facing.x * speed), y: Math.fround(facing.y * speed) }
  const position = context.resolveMovement({
    actorId: actor.id, position: actor.position, delta, purpose: 'movement',
    radius: boneyardEnemyCollisionRadius(actor),
    requestedPosition: { x: actor.position.x + delta.x, y: actor.position.y + delta.y },
  })
  return { ...routed.actor, position, headingDeg: heading, nextMovementTick: context.tick + cadence, lastMovementTick: context.tick }
}
