import { boneyardMouthTargets, hitBoneyardPuppet } from './puppet-hits.ts'
import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import { clipLineToBounds } from '../../core-kernels/line-obstruction.ts'
import type { NativeBossSpell } from '../../core-kernels/native-boss-spell.ts'
import { nativeDemonSkullBob, nativeDemonSkullEyes, nativeDemonSkullFacing } from '../../core-kernels/native-demon-skull-attachments.ts'
import { NATIVE_FIRE_PATCH_FRAME_COUNT, spawnNativeFirePatch, stepNativeFirePatch } from '../../core-kernels/primary-spell-fire-effects.ts'
import { nativePrimaryPolygonTargets } from '../../core-kernels/primary-spell-targeting.ts'
import { createBossSpellOwner } from './boss-spell-construction.ts'
import { materializeSpawnIntents } from './construction.ts'
import { damageWorkingBoneyardEnemy } from './damage.ts'
import { spawnSimpleDeathEffect } from './death-effects.ts'
import {
  spawnDemonSkullBeamSegments,spawnUnholyEyeTrail,spawnUnholyImpactGround,
  spawnUnholySpitTrail,UNHOLY_GREEN
} from './demon-skull-effects.ts'
import { emitEnemyActionSound, emitEvent } from './events.ts'
import {
  type BoneyardDemonSkullActor,
  type BoneyardEnemyPlayerDamage,
  type BoneyardEnemyStoreStepContext,
  type WorkingStep
} from './model.ts'
import { drawEnemyFloat, drawEnemyInteger, drawEnemySign, radialVector, randomEnemyOffset } from './random.ts'
import { targetEligible } from './targeting.ts'

export type DemonSkullSpell = Extract<NativeBossSpell, { kind: 'eye-laser' | 'unholy-spit' | 'green-fire'
  | 'unholy-burst' | 'mouth-beam-segment' }>

export function fireDemonSkullEyes(work: WorkingStep, actor: BoneyardDemonSkullActor,
  context: BoneyardEnemyStoreStepContext): BoneyardDemonSkullActor {
  emitEnemyActionSound(work, context.tick, actor, 'lightning-start', 1)
  emitEvent(work, context.tick, 'enemy-screen-flash', actor.id, { sourcePosition: actor.position,
    screenFlash: { red: .5, green: 1, blue: .5, alpha: .75, decayPerTick: Math.fround(.1), pointAttenuated: true } })
  const selected = actor.targetPlayerId === null ? null : context.players[actor.targetPlayerId]
  const target = selected && !selected.summoned ? selected
    : Object.values(context.players).find(candidate => !candidate.summoned && targetEligible(candidate))
  const lead = target === undefined ? 0 : Math.hypot(target.position.x - actor.position.x, target.position.y - actor.position.y) * .25
  const aim = target === undefined ? advance(actor.position, direction(actor.headingDeg), 100)
    : { x: target.position.x + target.velocityPerTick.x * lead,
      y: target.position.y + target.velocityPerTick.y * lead + 15 }
  const headingDeg = actorHeadingFromVector(aim.x - actor.position.x, aim.y - actor.position.y)
  const velocity = direction(headingDeg, 4)
  for (const position of nativeDemonSkullEyes(actor.position, actor.brain, actor.config.scale, actor.brain.bodyHeadingDeg)) {
    const phaseDeg = drawEnemyFloat(work, 360)
    const spell: Extract<DemonSkullSpell, { kind: 'eye-laser' }> = {
      ...createBossSpellOwner(work, actor.id, context.tick, actor.config.secondaryDamage, 'eye-laser'),
      headingDeg, phaseDeg, position, velocity,
    }
    if (blockedLine(context, spell.id, actor.position, position, 0x380)) impactEye(work, spell, context)
    else work.bossSpells.push(spell)
  }
  return { ...actor, brain: { ...actor.brain, recoil: direction(actor.headingDeg + 180, 10) } }
}

export function biteDemonSkull(work: WorkingStep, source: BoneyardDemonSkullActor,
  context: BoneyardEnemyStoreStepContext): BoneyardDemonSkullActor {
  const target = source.targetPlayerId === null ? null : context.players[source.targetPlayerId]
  if (!target || !targetEligible(target)) return source
  let actor = source
  const dx = target.position.x - actor.position.x
  const dy = target.position.y - actor.position.y
  const distance = Math.hypot(dx, dy)
  const gap = Math.max(0, distance - target.collisionRadius - actor.config.collisionRadius)
  if (gap > 0) {
    const delta = { x: dx / distance * gap / 10, y: dy / distance * gap / 10 }
    const entry = 99 + actor.brain.bodyPose * 24 + nativeDemonSkullFacing(actor.headingDeg)
    for (let index = 0; index < 10; index += 1) {
      const alpha = Math.fround(.1 + index * .1)
      spawnSimpleDeathEffect(work, actor, context.tick, { alpha, alphaLossPerTick: Math.fround(.02) * Math.fround(.35),
        atlas: 'Unholy', entry, blendMode: 'normal', kind: 'fade', lifetimeTicks: 1000,
        position: { x: actor.position.x + actor.brain.bodyOffset.x,
          y: actor.position.y + actor.brain.bodyOffset.y + nativeDemonSkullBob(actor.brain.bodyPhaseDeg) },
        role: 'discorporeal-bite-trail', scale: actor.config.scale * 2 })
      const position = context.resolveMovement({ actorId: actor.id, position: actor.position, delta,
        purpose: 'movement', radius: actor.config.collisionRadius, requestedPosition: advance(actor.position, delta, 1) })
      actor = { ...actor, position }
    }
  }
  if (Math.hypot(target.position.x - actor.position.x, target.position.y - actor.position.y) <= actor.config.collisionRadius * 2) {
    contact(work, actor.id, actor.targetPlayerId!, actor.position, actor.config.collisionRadius,
      actor.config.primaryDamage ?? 0, 0, context.tick, actor.id)
  }
  return actor
}

export function spitDemonSkullFire(work: WorkingStep, actor: BoneyardDemonSkullActor,
  context: BoneyardEnemyStoreStepContext): BoneyardDemonSkullActor {
  emitEnemyActionSound(work, context.tick, actor, 'unholy-spits', Math.fround(1 + drawEnemyFloat(work, .1, true)))
  emitEnemyActionSound(work, context.tick, actor, 'throw-fire', Math.fround(1 + drawEnemyFloat(work, .1, true)))
  const target = actor.targetPlayerId === null ? null : context.players[actor.targetPlayerId]
  let travel = direction(actor.headingDeg, 200)
  let spreadDirection = { x: 0, y: 0 }
  let headingDeg = actor.headingDeg
  if (target && !target.summoned) {
    let distance = (actor.brain.capabilities & 8) !== 0 ? 300 : 150
    if (drawEnemyInteger(work, 4) === 1) distance *= -.25
    const velocityHeading = actorHeadingFromVector(target.velocityPerTick.x, target.velocityPerTick.y)
    const offset = direction(velocityHeading + drawEnemyFloat(work, 10, true), distance)
    const landing = advance(target.position, offset, 1)
    travel = { x: Math.fround(landing.x - actor.position.x), y: Math.fround(landing.y - actor.position.y) }
    const spread = direction(actorHeadingFromVector(offset.x, offset.y) + drawEnemyFloat(work, 20, true))
    spreadDirection = { x: spread.y, y: -spread.x }
    headingDeg = actorHeadingFromVector(travel.x, travel.y)
  }
  const distance = Math.hypot(travel.x, travel.y)
  work.bossSpells.push({ ...createBossSpellOwner(work, actor.id, context.tick, actor.config.extraDamage, 'unholy-spit'),
    position: actor.position, origin: actor.position, travel, spreadDirection, progress: 0,
    progressPerTick: Math.fround(200 / distance * .035), height: Math.fround(distance / 5),
    spawnFire: true, spawnImps: (actor.brain.capabilities & 8) !== 0 })
  return { ...actor, headingDeg }
}

export function stepDemonSkullSpell(work: WorkingStep, source: DemonSkullSpell,
  context: BoneyardEnemyStoreStepContext): DemonSkullSpell | null {
  const ageTicks = source.ageTicks + 1
  switch (source.kind) {
    case 'mouth-beam-segment': return ageTicks > 1 ? null : { ...source, ageTicks }
    case 'unholy-burst': {
      const framePhase = Math.fround(source.framePhase + source.frameVelocity)
      return framePhase > 14 ? null : { ...source, ageTicks, framePhase,
        frameVelocity: Math.fround(source.frameVelocity * Math.fround(.97)),
        offsetY: Math.fround(source.offsetY + source.offsetStepY),
        lightIntensity: Math.max(0, Math.fround(source.lightIntensity - Math.fround(.02))) }
    }
    case 'green-fire': {
      const step = stepNativeFirePatch(source.fire, context.tick)
      if (step.contact !== null) {
        for (const [playerId, player] of Object.entries(context.players)) {
          if (!targetEligible(player) || squared(source.position, player.position) >= step.contact.radius ** 2) continue
          contact(work, source.ownerActorId, playerId, source.position, 20, step.contact.amount, step.contact.amount, context.tick)
        }
      }
      return step.patch === null ? null : { ...source, ageTicks, position: step.patch.position, fire: step.patch }
    }
    case 'unholy-spit': {
      const progress = Math.fround(source.progress + source.progressPerTick)
      const position = advance(source.origin, source.travel, progress)
      const spell = { ...source, ageTicks, progress, position }
      spawnUnholySpitTrail(work, { id: source.ownerActorId, position }, context.tick, progress, source.height)
      if (progress < 1) return spell
      impactSpit(work, spell, context)
      return null
    }
    case 'eye-laser': {
      if (ageTicks % 5 === 0 && blockedLine(context, source.id, source.position, advance(source.position, source.velocity, 5), 0)) {
        impactEye(work, source, context)
        return null
      }
      const position = advance(source.position, source.velocity, 1)
      const phaseDeg = Math.fround(source.phaseDeg + 5 + drawEnemyFloat(work, 5))
      const spell = { ...source, ageTicks, phaseDeg, position }
      let retired = context.projectileWorldBlocked({ kind: 'bounds', projectileId: spell.id, position, margin: 0 })
      // The registered-player traversal continues after impact, including another impact in the same tick.
      for (const player of Object.values(context.players)) {
        if (player.summoned || !targetEligible(player) || squared(position, player.position) > 25 ** 2) continue
        impactEye(work, spell, context)
        retired = true
      }
      spawnUnholyEyeTrail(work, { id: spell.ownerActorId, position }, context.tick, spell.headingDeg)
      return retired ? null : spell
    }
  }
}

function impactEye(work: WorkingStep, spell: Extract<DemonSkullSpell, { kind: 'eye-laser' }>,
  context: BoneyardEnemyStoreStepContext): void {
  const owner = { id: spell.ownerActorId, position: spell.position }
  emitEnemyActionSound(work, context.tick, owner, 'fireball-hit', Math.fround(.8 + drawEnemyFloat(work, .1, true)), 2)
  emitEnemyActionSound(work, context.tick, owner, 'throw-fire', Math.fround(.6), 2)
  spawnUnholyImpactGround(work, owner, context.tick, 'eye')
  spawnRisingBurst(work, spell, context.tick, 'eye')
  for (const [playerId, player] of Object.entries(context.players)) {
    if (player.summoned || !targetEligible(player) || squared(spell.position, player.position) > 82.5 ** 2) continue
    const eventId = contact(work, spell.ownerActorId, playerId, spell.position, 0, spell.damage * .5, spell.damage * .5, context.tick)
    work.projectileKnockbacks.push({ actorId: spell.ownerActorId, delta: spell.velocity, eventId,
      lastStepTick: context.tick, playerId, remainingTicks: 3 + drawEnemyInteger(work, 8) })
  }
}

function impactSpit(work: WorkingStep, spell: Extract<DemonSkullSpell, { kind: 'unholy-spit' }>,
  context: BoneyardEnemyStoreStepContext): void {
  const owner = { id: spell.ownerActorId, position: spell.position }
  spawnUnholyImpactGround(work, owner, context.tick, 'spit')
  spawnRisingBurst(work, spell, context.tick, 'spit')
  emitEnemyActionSound(work, context.tick, owner, 'fireball-hit', Math.fround(.8 + drawEnemyFloat(work, .1, true)))
  emitEnemyActionSound(work, context.tick, owner, 'fireball-hit', Math.fround(1 + drawEnemyFloat(work, .1, true)))
  emitEnemyActionSound(work, context.tick, owner, 'fireball-hit', Math.fround(1 + drawEnemyFloat(work, .25, true)))
  emitEvent(work, context.tick, 'enemy-stream', spell.ownerActorId, { stream: 'trap', sourcePosition: spell.position })
  if (!spell.spawnFire) return
  if (spell.spreadDirection.x === 0 && spell.spreadDirection.y === 0) {
    spawnGreenFire(work, spell, context.tick, { x: spell.position.x, y: spell.position.y - 10 },
      Math.fround(2 + drawEnemyFloat(work, .2)), 20, true)
    const offset = drawEnemySign(work, Math.fround(10 + drawEnemyFloat(work, 10)))
    spawnGreenFire(work, spell, context.tick, { x: spell.position.x + offset, y: spell.position.y + 5 },
      Math.fround(1.2 + drawEnemyFloat(work, .2)), 20, false)
    return
  }
  const length = 150 + drawEnemyInteger(work, 101)
  const root = advance(spell.position, spell.spreadDirection, -length * .5)
  const count = length / 20
  for (let index = 0; index <= count; index += 1) {
    const along = advance(root, spell.spreadDirection, index * 20)
    const offset = randomEnemyOffset(work, 10)
    const position = { x: along.x + offset.x, y: along.y - 10 + offset.y }
    const scale = Math.fround((1 + drawEnemyFloat(work, .2)) * (1 + Math.sin(index / count * Math.PI) * .5))
    spawnGreenFire(work, spell, context.tick, position, scale, 20, squared(position, spell.position) < 400)
  }
  if (!spell.spawnImps) return
  for (let index = 0; index <= length / 40; index += 1) {
    const position = advance(root, spell.spreadDirection, index * 40)
    if (context.projectileWorldBlocked({ kind: 'point', projectileId: spell.id, position, radius: 10 })) continue
    work.actors.push(...materializeSpawnIntents(work, context, [{ enemyToken: 'IMP', nativeTypeId: 2044,
      greenImpSpitDamage: spell.damage, flags: [], id: work.nextSyntheticSpawnIntentId++,
      position, positionPolicy: 'direct', locationPolicy: 'anywhere', spawnTick: context.tick, waveOrdinal: 0 }]))
  }
}

function spawnGreenFire(work: WorkingStep, source: Pick<NativeBossSpell, 'ownerActorId' | 'damage'>,
  tick: number, position: Readonly<BoneyardPoint>, scale: number, life: number, glow: boolean): void {
  const owner = createBossSpellOwner(work, source.ownerActorId, tick, source.damage, 'green-fire')
  const born = spawnNativeFirePatch({ id: owner.id, burnDamage: 0, damage: source.damage, nativeType: 'fire',
    ownerId: `enemy:${source.ownerActorId}`, worldKey: 'boneyard', position, scale, life,
    painterRegistration: owner.painterRegistration }, work.steeringRngState)
  work.steeringRngState = born.rng
  const atlasPhase = drawEnemyFloat(work, NATIVE_FIRE_PATCH_FRAME_COUNT)
  const horizontalSign = drawEnemySign(work, 1) < 0 ? -1 : 1
  work.bossSpells.push({ ...owner, position: born.patch.position, fire: { ...born.patch, atlasPhase, horizontalSign }, glow })
}

function spawnRisingBurst(work: WorkingStep, source: Pick<NativeBossSpell, 'ownerActorId' | 'position'>,
  tick: number, kind: 'eye' | 'spit'): void {
  work.bossSpells.push({ ...createBossSpellOwner(work, source.ownerActorId, tick, 0, 'unholy-burst'),
    position: source.position, framePhase: 0, frameVelocity: .625,
    offsetY: kind === 'eye' ? -22.5 : -15, offsetStepY: kind === 'eye' ? Math.fround(-1.725) : Math.fround(-1.15),
    lightIntensity: 2 })
}

export function stepDemonSkullMouthBeam(work: WorkingStep, actor: BoneyardDemonSkullActor,
  context: BoneyardEnemyStoreStepContext, power: number): void {
  const unit = direction(actor.headingDeg)
  let endpoint = advance(actor.position, unit, 1500)
  if (context.nativeViewBounds) endpoint = clipLineToBounds(actor.position, endpoint, context.nativeViewBounds)?.end ?? actor.position
  const terrainEnd = context.clipSpellSegment?.({ start: actor.position, end: endpoint, nativeExclusionMask: 0x380 }) ?? endpoint
  const obstructed = squared(terrainEnd, endpoint) > 1e-8
  const end = obstructed ? { x: terrainEnd.x, y: terrainEnd.y - 20 } : terrainEnd
  if (obstructed) {
    const scale = Math.fround(1.5 + drawEnemyFloat(work, 1.5))
    const offset = randomEnemyOffset(work, 50)
    spawnSimpleDeathEffect(work, actor, context.tick, { alpha: 1, alphaLossPerTick: Math.fround(.01),
      atlas: 'BadGuys', entry: 15, blendMode: 'add', kind: 'fade-additive', lifetimeTicks: 1000,
      position: { x: end.x + offset.x, y: end.y + offset.y }, presentationOwner: 'late-world-overlay',
      role: 'mouth-beam-wall-contact', scale, tint: UNHOLY_GREEN, rotationDeg: drawEnemyFloat(work, 360) })
  }
  const distance = Math.hypot(end.x - actor.position.x, end.y - actor.position.y)
  const side = { x: -unit.y * 48, y: unit.x * 48 }
  const polygon = [advance(actor.position, side, 1), advance(actor.position, side, -1),
    advance(end, side, -1), advance(end, side, 1)]
  if (context.tick % 5 === 0) {
    const targets = boneyardMouthTargets(work, context, actor.id)
    for (const target of nativePrimaryPolygonTargets({ actorMask: 0xffffffff, polygon, targets })) {
      const offset = randomEnemyOffset(work, 10)
      spawnSimpleDeathEffect(work, actor, context.tick, { alpha: 1, opacityTimer: Math.min(power, 1) * 2,
        alphaLossPerTick: Math.fround(.2), atlas: 'Unholy', entry: 2, blendMode: 'add', kind: 'fade-additive',
        lifetimeTicks: 1000, painterSortBias: 10, position: { x: target.position.x + offset.x, y: target.position.y - 10 + offset.y },
        role: 'mouth-beam-contact', scale: (1 + drawEnemyFloat(work, .5)) * 2, tint: UNHOLY_GREEN })
      const hitStrength = drawEnemyFloat(work, 1)
      const amount = actor.config.tertiaryDamage / 5
      if (target.id.startsWith('enemy:')) damageWorkingBoneyardEnemy(work, {
        actorId: Number(target.id.slice(6)), amount, hasMagicDamage: true, magic: true, hitStrength,
        sourcePlayerId: null, tick: context.tick })
      else if (target.id.startsWith('target:')) contact(work, actor.id, target.id.slice(7), actor.position,
        actor.config.collisionRadius, 0, amount, context.tick, actor.id, hitStrength)
      else hitBoneyardPuppet(work, target, context.tick, hitStrength)
      if (context.tick % 25 === 0) spawnGreenFire(work, { ownerActorId: actor.id, damage: amount * .25 },
        context.tick, target.position, 1 + drawEnemyFloat(work, .5), 1, true)
    }
  }
  spawnDemonSkullBeamSegments(work, actor, context.tick, distance, power)
}

function contact(work: WorkingStep, actorId: number, playerId: string, position: Readonly<BoneyardPoint>,
  radius: number, physicalDamage: number, magicDamage: number, tick: number,
  reflectableActorId: number | null = null, hitStrength = 1): number {
  const eventId = emitEvent(work, tick, 'attack-marker', actorId, { targetPlayerId: playerId })
  const damage: BoneyardEnemyPlayerDamage = { actorId, playerId, eventId, physicalDamage, magicDamage, hitStrength,
    coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0,
    source: { position, collisionRadius: radius, reflectableActorId } }
  work.playerDamage.push(damage)
  return eventId
}
function direction(headingDeg: number, length = 1): BoneyardPoint {
  const vector = radialVector(headingDeg, length)
  return { x: Math.fround(vector.x), y: Math.fround(vector.y) }
}
function advance(point: Readonly<BoneyardPoint>, delta: Readonly<BoneyardPoint>, distance: number): BoneyardPoint {
  return { x: Math.fround(point.x + delta.x * distance), y: Math.fround(point.y + delta.y * distance) }
}
function squared(a: Readonly<BoneyardPoint>, b: Readonly<BoneyardPoint>): number { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }
function blockedLine(context: BoneyardEnemyStoreStepContext, projectileId: number, start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>, nativeExclusionMask: number): boolean {
  return context.projectileWorldBlocked({ kind: 'line', projectileId, start, end, radius: 0, nativeExclusionMask })
}
