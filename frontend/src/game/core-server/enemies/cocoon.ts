import { drawNativeFloat } from '../../core-kernels/native-rng.ts'
import { damageNativeCocoon } from '../../core-kernels/native-webbed.ts'
import { spawnBouncer, spawnSimpleDeathEffect } from './death-effects.ts'
import { emitEvent } from './events.ts'
import type {
  BoneyardEnemyActor,
  BoneyardEnemyStore,
  DamageBoneyardEnemyRequest,
  DamageBoneyardEnemyResult,
  WorkingStep,
} from './model.ts'
import { drawInteger, drawUnit, radialVector } from './random.ts'
import { createEnemyWork, finishEnemyStore } from './work.ts'

export function removeCocoonOwner(source: BoneyardEnemyStore, ownerId: string): BoneyardEnemyStore {
  const webbedPlayers = { ...source.webbedPlayers }
  delete webbedPlayers[ownerId]
  const actors = source.actors.filter(actor => actor.brain.family !== 'cocoon'
    || actor.brain.ownerPlayerId !== ownerId)
  return actors.length === source.actors.length && source.webbedPlayers[ownerId] === undefined
    ? source : { ...source, actors, webbedPlayers }
}

export function damageCocoon(
  source: BoneyardEnemyStore,
  actor: BoneyardEnemyActor,
  request: DamageBoneyardEnemyRequest,
): DamageBoneyardEnemyResult {
  if (actor.brain.family !== 'cocoon') throw new Error('Cocoon damage requires a target-owned restraint')
  const ownerId = actor.brain.ownerPlayerId
  const prior = ownerId === null ? undefined : source.webbedPlayers[ownerId]
  const work = createEnemyWork(source, request, true)
  let hitPulse = 1
  if (request.magic) {
    const flash = drawNativeFloat(work.steeringRngState, 0.5)
    work.steeringRngState = flash.state
    hitPulse = flash.value
  }
  const next = prior === undefined ? null : damageNativeCocoon(prior, request.amount, hitPulse)
  if (ownerId !== null) {
    if (next) work.webbedPlayers[ownerId] = next
    else delete work.webbedPlayers[ownerId]
  }
  if (next === null) {
    work.actors = work.actors.map((candidate) => (
      candidate.brain.family === 'cocoon' && candidate.brain.ownerPlayerId === ownerId
        ? { ...candidate, lifeState: 'dying', brain: { ...candidate.brain, phase: 'death' } }
        : candidate
    ))
    if (prior) releaseCocoon(work, { ...actor, position: actor.brain.ownerPosition }, request.tick)
  }
  return {
    accepted: true, events: work.events, healthDamage: 0, killed: next === null,
    store: finishEnemyStore(work, source.lastStepTick),
  }
}

function releaseCocoon(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1, opacityTimer: 4, alphaLossPerTick: Math.fround(Math.fround(0.1) * Math.fround(0.15)),
    atlas: 'DeadHawg', blendMode: 'add', entry: 14, kind: 'fade-perspective',
    lifetimeTicks: 267, role: 'cocoon-flash', rotationDeg: drawUnit(work) * 360, scale: 1,
  })
  emitEvent(work, tick, 'enemy-action-sound', actor.id, {
    sound: 'disintegrate', pitch: 1 + (drawUnit(work) * 2 - 1) * 0.05,
    gainScale: 1, sourcePosition: actor.position,
  })
  const webbedPitch = 0.8 + drawUnit(work) * 0.1
  const sound = (['webbed-1', 'webbed-2'] as const)[drawInteger(work, 2)]
  emitEvent(work, tick, 'enemy-action-sound', actor.id, {
    sound, pitch: webbedPitch, gainScale: 1, sourcePosition: actor.position,
  })
  let heading = drawUnit(work) * 360
  for (let index = 0; index < 12; index += 1) {
    const entry = drawInteger(work, 2) === 0 ? 11 : 10
    const y = actor.position.y - drawUnit(work) * 25
    const speed = 2 + drawUnit(work) * 5
    const velocity = radialVector(heading + (drawUnit(work) * 2 - 1) * 20, speed)
    const scale = 1.5 + drawUnit(work) * 0.5
    let loss = 0.025
    if (drawInteger(work, 5) === 1) loss *= 0.5
    if (drawInteger(work, 5) === 1) loss *= 0.5
    spawnSimpleDeathEffect(work, actor, tick, {
      alpha: 1, alphaLossPerTick: loss, atlas: 'BadGuys', blendMode: 'normal', entry,
      kind: 'move-fade', lifetimeTicks: Math.ceil(1 / loss), role: 'cocoon-fragment',
      rotationDeg: heading, scale, velocity, velocityDamping: 0.8,
      position: { x: actor.position.x + velocity.x * 10, y: y + velocity.y * 10 },
    })
    heading += 30
  }
  for (let index = 0; index < 7; index += 1) {
    spawnBouncer(work, actor, tick, 27, 'cocoon-bouncer', () => {
      const vector = radialVector(heading, 1)
      const velocity = { x: vector.x * 1.5, y: vector.y }
      const radius = 15 + drawUnit(work) * 10
      heading += 72 + (drawUnit(work) * 2 - 1) * 10
      return {
        scaleY: 0.75,
        velocity,
        position: { x: actor.position.x + velocity.x * (radius + 2), y: actor.position.y + velocity.y * radius },
      }
    })
  }
  emitEvent(work, tick, 'cocoon-released', actor.id)
}
