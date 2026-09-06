import { bindNativeQueryTarget } from './registration.ts'
import {
  actorHeadingFromVector,
} from '../../core-kernels/actor-heading.ts'
import type {
  BoneyardPoint,
} from '../../core-kernels/boneyard.ts'
import {
  clipLineToBounds,
} from '../../core-kernels/line-obstruction.ts'
import {
  createNativeDireFire,
  stepNativeDireFire,
  type NativeBossSpell,
} from '../../core-kernels/native-boss-spell.ts'
import type {
  NativeFacultyAction,
} from '../../core-kernels/native-faculty-actions.ts'
import {
  nativeFacultyLightningSource,
} from '../../core-kernels/native-faculty-attachments.ts'
import {
  createNativeDarkFireballs,
  createNativeRainOfBones,
  nativeBlightningContains,
  nativeTragicCircleContains,
  stepNativeDarkFireball,
  stepNativeRainOfBones,
} from '../../core-kernels/native-faculty-spells.ts'
import {
  createNativeGuidedMissile,
  stepNativeGuidedMissile,
} from '../../core-kernels/native-guided-missile.ts'
import {
  drawNativeFloat,
  drawNativeFloatRange,
  drawNativeSign,
} from '../../core-kernels/native-rng.ts'
import { createBossSpellOwner } from './boss-spell-construction.ts'
import {
  spawnBouncer,
  spawnSimpleDeathEffect,
} from './death-effects.ts'
import { stepDemonSkullSpell } from './demon-skull-spells.ts'
import {
  emitEnemyActionSound,
  emitEvent,
} from './events.ts'
import {
  spawnBlightningSmoke,
  spawnFacultyProjectileSmoke,
  spawnTragicCircleEffects,
} from './faculty-effects.ts'
import {
  type BoneyardEnemyActor,
  type BoneyardEnemyPlayerDamage,
  type BoneyardEnemyStoreStepContext,
  type WorkingStep,
} from './model.ts'
import { spawnFireBurst } from './projectile-effects.ts'
import { firstGuidedMissileContact } from './projectiles.ts'
import { drawEnemyFloat, drawUnit } from './random.ts'
import {
  targetEligible,
} from './targeting.ts'
import { stepUltraBanishSpell } from './ultra-banish.ts'

export function spawnFacultySpell(work: WorkingStep, actor: BoneyardEnemyActor,
  action: NativeFacultyAction['kind'], context: BoneyardEnemyStoreStepContext): void {
  if (actor.config.enemyToken !== 'DIREFACULTY') throw new Error('Faculty cast requires Faculty config')
  const primaryDamage = actor.config.primaryDamage ?? 0
  const secondaryDamage = actor.config.secondaryDamage
  const family = actor.config.family
  const target = actor.targetPlayerId === null ? null : context.players[actor.targetPlayerId] ?? null
  const heading = target === null ? actor.headingDeg : actorHeadingFromVector(
    target.position.x - actor.position.x, target.position.y - actor.position.y)
  if (action === 'lightning') {
    spawnBlightning(work, actor, context)
    for (const [playerId, player] of Object.entries(context.players)) {
      if (player.summoned || !targetEligible(player) || !nativeBlightningContains(actor.position, actor.headingDeg, player.position)
        || !lineClear(context, actor.position, player.position)) continue
      contact(work, context, actor.id, playerId, 0, primaryDamage / 100,
        { manaDamageMaximumFraction: .005, suppressHitResponse: true })
    }
    return
  }
  if (action === 'throw' && family.primary === 0) {
    const direction = vector(heading)
    const created = createNativeGuidedMissile(work.steeringRngState,
      { x: Math.fround(actor.position.x + direction.x * 40),
        y: Math.fround(actor.position.y + direction.y * 40 - 30) }, heading, 1.5)
    work.steeringRngState = created.rng
    const spell: NativeBossSpell = { ...createBossSpellOwner(work, actor.id, context.tick, primaryDamage, 'skull-missile'), ...created.state,
       targetPlayerId: actor.targetPlayerId }
    if (projectileLineClear(context, spell, actor.position, spell.position, 0x380)) {
      bindNativeQueryTarget(work, `boss-spell:${spell.id}`, spell.position)
      work.bossSpells.push(spell)
    }
    else { spellImpact(work, spell, context); retireProjectile(work, spell, context) }
    emitFacultyThrow(work, actor, context.tick)
    return
  }
  if (action === 'throw' && family.primary === 2 || action === 'two-hand' && family.secondary === 2) {
    const ring = action === 'two-hand'
    const created = createNativeDarkFireballs(actor.position, heading, ring,
      target === null ? null : Math.hypot(target.position.x - actor.position.x, target.position.y - actor.position.y),
      work.steeringRngState)
    work.steeringRngState = created.rng
    for (const state of created.spells) {
      const spell: NativeBossSpell = { ...createBossSpellOwner(work, actor.id, context.tick, primaryDamage, 'dark-fireball'),
        ...state,  groundFireDamage: secondaryDamage }
      if (projectileLineClear(context, spell, actor.position, spell.position, 0x380)) {
      bindNativeQueryTarget(work, `boss-spell:${spell.id}`, spell.position)
      work.bossSpells.push(spell)
    }
      else { impactDark(work, spell, context); retireProjectile(work, spell, context) }
    }
    if (ring) {
      emitEnemyActionSound(work, context.tick, actor, 'banshee-die', 1)
      emitEnemyActionSound(work, context.tick, actor, 'big-fire', 1)
    } else emitFacultyThrow(work, actor, context.tick)
    return
  }
  if (action !== 'two-hand') return
  if (family.secondary === 0) {
    const point = target === null ? advance(actor.position, vector(actor.headingDeg), 300)
      : advance(target.position, target.velocityPerTick, 250)
    const created = createNativeRainOfBones(point, work.steeringRngState)
    work.steeringRngState = created.rng
    work.bossSpells.push({ ...createBossSpellOwner(work, actor.id, context.tick, secondaryDamage, 'rain-of-bones'), ...created.state,
       position: randomPoint(work, point, 50) })
    emitEnemyActionSound(work, context.tick, actor, 'magic-storm', .8)
    emitEnemyActionSound(work, context.tick, actor, 'banshee-die', 1)
    return
  }
  if (family.secondary !== 1 || target === null) return
  const lead = drawNativeFloatRange(work.steeringRngState, 130, 250)
  const ahead = drawNativeFloat(lead.state, 75)
  work.steeringRngState = ahead.state
  const point = advance(advance(target.position, target.velocityPerTick, lead.value),
    vector(target.headingDeg ?? 0), ahead.value)
  work.bossSpells.push({ ...createBossSpellOwner(work, actor.id, context.tick, 0, 'tragic-circle'),
    position: point, remainingTicks: 750 })
  emitEnemyActionSound(work, context.tick, actor, 'magic-circle', .8)
  emitEnemyActionSound(work, context.tick, actor, 'banshee-die', 1)
}

function emitFacultyThrow(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  emitEnemyActionSound(work, tick, actor, 'spin-attack', 1.5 - drawUnit(work) * .25)
  emitEnemyActionSound(work, tick, actor, 'throw-dark', 1 + drawUnit(work) * .25)
}

export function stepBossSpells(work: WorkingStep, context: BoneyardEnemyStoreStepContext): void {
  const source = work.bossSpells
  work.bossSpells = []
  for (const spell of source) {
    if (spell.spawnTick >= context.tick) {
      work.bossSpells.push(spell)
      continue
    }
    switch (spell.kind) {
      case 'ultra-banish':
      case 'unholy-soul': {
        const stepped = stepUltraBanishSpell(work, spell, context, source)
        if (stepped !== null) work.bossSpells.push(stepped)
        break
      }
      case 'eye-laser':
      case 'unholy-spit':
      case 'green-fire':
      case 'unholy-burst':
      case 'mouth-beam-segment': {
        const stepped = stepDemonSkullSpell(work, spell, context)
        if (stepped !== null) work.bossSpells.push(stepped)
        break
      }
      case 'heartmonger-flicker': {
        const phaseDeg = Math.fround(spell.phaseDeg + .3333333432674408)
        if (phaseDeg < 180) work.bossSpells.push({ ...spell, phaseDeg, ageTicks: spell.ageTicks + 1 })
        break
      }
      case 'heartmonger-soul': {
        const lifePhaseDeg = Math.fround(spell.lifePhaseDeg + .36666667461395264)
        if (lifePhaseDeg < 180) work.bossSpells.push({ ...spell, lifePhaseDeg,
          bobPhaseDeg: Math.fround(spell.bobPhaseDeg + 2), ageTicks: spell.ageTicks + 1 })
        break
      }
      case 'death-magic': {
        const alpha = Math.fround(spell.alpha - spell.alphaLossPerTick)
        if (alpha > 0) work.bossSpells.push({ ...spell, alpha, ageTicks: spell.ageTicks + 1,
          light: spell.light === null ? null : { ...spell.light, intensity: Math.max(0,
            Math.fround(spell.light.intensity - spell.light.lossPerTick)) } })
        break
      }
      case 'blightning':
        if (spell.ageTicks + 1 < 2) work.bossSpells.push({ ...spell, ageTicks: spell.ageTicks + 1 })
        break
      case 'falling-bone': stepFallingBone(work, spell, context); break
      case 'skull-missile': stepSkull(work, spell, context); break
      case 'dark-fireball': stepDark(work, spell, context); break
      case 'rain-of-bones': stepRain(work, spell, context); break
      case 'tragic-circle': stepCircle(work, spell, context); break
      case 'dire-fire': stepFire(work, spell, context); break
    }
  }
}

function spawnBlightning(work: WorkingStep, actor: BoneyardEnemyActor, context: BoneyardEnemyStoreStepContext): void {
  if (actor.brain.family !== 'faculty') throw new Error('Blightning requires a Faculty caster')
  const start = nativeFacultyLightningSource(actor.position, actor.bodyPose, actor.brain.bodyHeadingDeg, actor.brain.handMask)
  const heading = vector(actor.headingDeg)
  const far = advance(start, heading, 5000)
  const line = context.nativeViewBounds === undefined ? { start, end: far }
    : clipLineToBounds(start, far, context.nativeViewBounds)
  if (line === null) return
  const terrainEnd = context.clipSpellSegment?.(line) ?? line.end
  const obstructed = distanceSquared(terrainEnd, line.end) > 1e-8
  const endpoint = obstructed ? { x: terrainEnd.x, y: terrainEnd.y - 20 } : terrainEnd
  const fade = (position: Readonly<BoneyardPoint>) => {
    const scale = drawNativeFloatRange(work.steeringRngState, 1.5, 2)
    work.steeringRngState = scale.state
    work.bossSpells.push({ ...createBossSpellOwner(work, actor.id, context.tick, 0, 'death-magic'), position, scale: scale.value,
      alpha: 2, alphaLossPerTick: 1, light: null, painterSortBias: 25 })
  }
  if (obstructed) fade(endpoint)
  const halfDistance = Math.hypot(endpoint.x - line.start.x, endpoint.y - line.start.y) * .5
  work.bossSpells.push({ ...createBossSpellOwner(work, actor.id, context.tick, 0, 'blightning'), position: line.start,
    midpoint: advance(line.start, heading, halfDistance), endpoint })
  fade(line.start)
  spawnBlightningSmoke(work, actor, context.tick, line.start, endpoint)
}

function stepSkull(work: WorkingStep, source: Extract<NativeBossSpell, { kind: 'skull-missile' }>,
  context: BoneyardEnemyStoreStepContext): void {
  const target = source.targetPlayerId === null ? null : context.players[source.targetPlayerId]
  const targetPosition = target && targetEligible(target) ? target.position : null
  const motion = stepNativeGuidedMissile(source, targetPosition, 1)
  const spell = { ...source, ...motion.state, ageTicks: source.ageTicks + 1,
    targetPlayerId: targetPosition === null ? null : source.targetPlayerId }
  bindNativeQueryTarget(work, `boss-spell:${spell.id}`, spell.position)
  const outside = context.projectileWorldBlocked({ kind: 'bounds', position: spell.position,
    margin: 500, projectileId: spell.id })
  let impacted = false
  if (!outside) {
    const hit = firstGuidedMissileContact(work, spell, context.players)
    if (hit !== null) {
      spellImpact(work, spell, context, hit)
      contact(work, context, spell.ownerActorId, hit, 0, spell.damage,
        { manaDamageMaximumFraction: .15, source: spellContactSource(spell, 0) })
      emitEvent(work, context.tick, 'player-status-sound', spell.ownerActorId, {
        targetPlayerId: hit, sourcePosition: spell.position, sound: 'magic-missile-hit', pitch: .85, gainScale: 1 })
      impacted = true
    }
    if (spell.ageTicks % 5 === 0 && !projectileLineClear(context, spell, spell.position, motion.terrainProbe)) {
      spellImpact(work, spell, context)
      impacted = true
    }
  }
  spawnFacultyProjectileSmoke(work, { id: spell.ownerActorId, position: spell.position }, context.tick, 'skull-trail')
  if (outside || impacted || spell.remainingTicks <= 0) retireProjectile(work, spell, context)
  else work.bossSpells.push(spell)
}

function stepDark(work: WorkingStep, source: Extract<NativeBossSpell, { kind: 'dark-fireball' }>,
  context: BoneyardEnemyStoreStepContext): void {
  const step = stepNativeDarkFireball(source, 1)
  const obstruction = step.spell.ageTicks % 10 === 0 && !projectileLineClear(context, source,
    source.position, advance(source.position, source.velocity, 10))
  const spell = { ...source, ...step.spell, position: obstruction ? source.position : step.spell.position }
  let impacted = false
  let outside = false
  if (obstruction) {
    impactDark(work, spell, context)
    impacted = true
  } else {
    outside = context.projectileWorldBlocked({ kind: 'view', position: spell.position, margin: 50, projectileId: spell.id })
    if (context.tick % 2 === 0) spawnFacultyProjectileSmoke(work,
      { id: spell.ownerActorId, position: spell.position }, context.tick, 'dark-trail', source.arcPhase)
    const hit = Object.values(context.players).some(player => !player.summoned && targetEligible(player)
      && distanceSquared(spell.position, player.position) < 900)
    if (hit) { impactDark(work, spell, context); impacted = true }
  }
  // The subclass callback still runs after an inherited impact callback.
  if (step.impact) { impactDark(work, spell, context); impacted = true }
  if (impacted || outside || spell.remainingTicks <= 0) retireProjectile(work, spell, context)
  else work.bossSpells.push(spell)
}

function impactDark(work: WorkingStep, spell: Extract<NativeBossSpell, { kind: 'dark-fireball' }>,
  context: BoneyardEnemyStoreStepContext): void {
  if (spell.arcPhaseStep > 0) {
    spawnFacultyProjectileSmoke(work, { id: spell.ownerActorId, position: spell.position }, context.tick, 'dark-ring-impact')
    spawnDireFires(work, spell, context.tick)
  }
  for (const [id, player] of Object.entries(context.players)) {
    if (targetEligible(player) && distanceSquared(spell.position, player.position) < 150 ** 2 + player.collisionRadius ** 2) {
      contact(work, context, spell.ownerActorId, id, spell.damage * .5, spell.damage * .5, { source: spellContactSource(spell) })
    }
  }
  if (spell.arcPhaseStep === 0) spawnFireBurst(work, spell, context.tick, spell.position, 1.75, .25)
  else emitEnemyActionSound(work, context.tick, { id: spell.ownerActorId, position: spell.position }, 'fireball-hit', 2)
  spellImpact(work, spell, context)
}

function retireProjectile(work: WorkingStep, spell: NativeBossSpell, context: BoneyardEnemyStoreStepContext): void {
  emitEvent(work, context.tick, 'projectile-retired', spell.ownerActorId, {
    projectileId: spell.id, targetPlayerId: spell.kind === 'skull-missile' ? spell.targetPlayerId : null,
  })
}

function stepRain(work: WorkingStep, source: Extract<NativeBossSpell, { kind: 'rain-of-bones' }>,
  context: BoneyardEnemyStoreStepContext): void {
  const stepped = stepNativeRainOfBones(source, work.steeringRngState)
  work.steeringRngState = stepped.rng
  if (stepped.bone !== null) {
    work.bossSpells.push({ ...createBossSpellOwner(work, source.ownerActorId, context.tick, 0, 'falling-bone'), ...stepped.bone,
       height: -175, colorRamp: 0 })
    for (const [id, player] of Object.entries(context.players)) {
      if (!player.summoned && targetEligible(player) && distanceSquared(stepped.bone.position, player.position) < 3600) {
        contact(work, context, source.ownerActorId, id, source.damage, 0, { manaDamageMaximumFraction: .15, source: spellContactSource(source) })
      }
    }
  }
  if (stepped.state.alpha > 0) work.bossSpells.push({ ...source, ...stepped.state, ageTicks: source.ageTicks + 1 })
}

function stepFallingBone(work: WorkingStep, source: Extract<NativeBossSpell, { kind: 'falling-bone' }>,
  context: BoneyardEnemyStoreStepContext): void {
  const fall = drawNativeFloat(work.steeringRngState, 2)
  work.steeringRngState = fall.state
  const height = Math.fround(Math.fround(fall.value + 5) + source.height)
  if (height < 0) {
    work.bossSpells.push({ ...source, height, ageTicks: source.ageTicks + 1,
      colorRamp: Math.min(1, Math.fround(source.colorRamp + .10000000149011612)) })
    return
  }
  emitEnemyActionSound(work, context.tick, { id: source.ownerActorId, position: source.position },
    'knock', .8 + drawUnit(work) * .3, drawUnit(work))
  const angle = drawNativeFloat(work.steeringRngState, 360)
  const distance = drawNativeFloat(angle.state, 10)
  work.steeringRngState = distance.state
  const direction = vector(angle.value)
  const velocity = { x: Math.fround(direction.x * 1.5), y: direction.y }
  spawnBouncer(work, { id: source.ownerActorId, position: source.position }, context.tick, source.entry,
    'acid-pain-bone-landed', { scale: 1.2000000476837158, velocity,
      position: { x: Math.fround(source.position.x + (15 + distance.value) * velocity.x + velocity.x * 2),
        y: Math.fround(source.position.y + (15 + distance.value) * velocity.y) } })
}

function stepCircle(work: WorkingStep, source: Extract<NativeBossSpell, { kind: 'tragic-circle' }>,
  context: BoneyardEnemyStoreStepContext): void {
  const spell = { ...source, ageTicks: source.ageTicks + 1, remainingTicks: source.remainingTicks - 1 }
  spawnTragicCircleEffects(work, { id: source.ownerActorId, position: source.position }, context.tick, spell.remainingTicks)
  if (source.ageTicks % 10 === 0) {
    for (const [id, player] of Object.entries(context.players)) {
      if (targetEligible(player) && nativeTragicCircleContains(spell.position, player.position)) {
        const rotationDeg = drawEnemyFloat(work, 360)
        const scale = Math.fround(1 + drawEnemyFloat(work, 1, true) * Math.fround(.65))
        const alpha = Math.fround(.5 + drawEnemyFloat(work, .25))
        spawnSimpleDeathEffect(work, { id: spell.ownerActorId, position: player.position }, context.tick, {
          alpha, alphaLossPerTick: Math.fround(.01), atlas: 'BadGuys', entry: 7, blendMode: 'normal', kind: 'fade-scale',
          lifetimeTicks: 1000, painterSortBias: 50, position: { x: player.position.x, y: player.position.y - 15 },
          role: 'tragic-circle-contact', rotationDeg, scale, scaleMultiplier: Math.fround(1.1), tint: 0x800000,
        })
        contact(work, context, spell.ownerActorId, id, 0, 0, { tragicCircle: true })
      }
    }
  }
  if (spell.remainingTicks > 0) work.bossSpells.push(spell)
}

function stepFire(work: WorkingStep, source: Extract<NativeBossSpell, { kind: 'dire-fire' }>,
  context: BoneyardEnemyStoreStepContext): void {
  const stepped = stepNativeDireFire(source, work.steeringRngState)
  work.steeringRngState = stepped.rng
  if (context.tick % 3 === 0) {
    for (const [id, player] of Object.entries(context.players)) {
      if (!targetEligible(player) || distanceSquared(source.position, player.position) >= (32 * source.scale) ** 2) continue
      contact(work, context, source.ownerActorId, id, source.damage * .015, source.damage * .015,
        { suppressHitResponse: true, source: spellContactSource(source) })
    }
  }
  if (stepped.state.alpha > 0) work.bossSpells.push({ ...source, ...stepped.state, ageTicks: source.ageTicks + 1 })
}

function spawnDireFires(work: WorkingStep, source: Extract<NativeBossSpell, { kind: 'dark-fireball' }>, tick: number): void {
  const first = createNativeDireFire(work.steeringRngState)
  const scale = drawNativeFloat(first.rng, .75)
  const alpha = drawNativeFloat(scale.state, 5)
  work.bossSpells.push({ ...createBossSpellOwner(work, source.ownerActorId, tick, source.groundFireDamage, 'dire-fire'), ...first.state,
    alpha: Math.fround(5 + alpha.value),  position: source.position,
    scale: Math.fround(.75 + scale.value) })
  const second = createNativeDireFire(alpha.state)
  const offset = drawNativeFloat(second.rng, 10)
  const sign = drawNativeSign(offset.state, Math.fround(10 + offset.value))
  const size = drawNativeFloat(sign.state, .20000000298023224)
  work.steeringRngState = size.state
  work.bossSpells.push({ ...createBossSpellOwner(work, source.ownerActorId, tick, source.damage, 'dire-fire'), ...second.state,
    alpha: 5, glow: false,
    position: { x: Math.fround(source.position.x + sign.value), y: Math.fround(source.position.y + 5) },
    scale: Math.fround(.6000000238418579 + size.value) })
}

function spellImpact(work: WorkingStep, spell: NativeBossSpell, context: BoneyardEnemyStoreStepContext, targetPlayerId: string | null = null): void {
  emitEvent(work, context.tick, 'projectile-impact', spell.ownerActorId, { projectileId: spell.id, targetPlayerId })
  const source = { id: spell.ownerActorId, position: spell.position }
  if (spell.kind === 'skull-missile') {
    emitEnemyActionSound(work, context.tick, source, 'magic-missile-hit', Math.fround(1 + drawEnemyFloat(work, .1)))
    work.bossSpells.push({ ...createBossSpellOwner(work, spell.ownerActorId, context.tick, 0, 'death-magic'),
      position: spell.position, scale: 2, alpha: 2, alphaLossPerTick: Math.fround(.02), painterSortBias: 100,
      light: { radius: .75, intensity: 1, lossPerTick: Math.fround(.05) } })
  }
  emitEnemyActionSound(work, context.tick, source, 'throw-dark', 1)
  spawnFacultyProjectileSmoke(work, source, context.tick, spell.kind === 'skull-missile' ? 'skull-impact' : 'dark-impact')
  emitEvent(work, context.tick, 'enemy-screen-flash', spell.ownerActorId, { sourcePosition: spell.position,
    screenFlash: { alpha: 1, red: 0, green: 0, blue: 0, decayPerTick: Math.fround(.05), pointAttenuated: true } })
}

function contact(work: WorkingStep, context: BoneyardEnemyStoreStepContext, actorId: number, playerId: string,
  physicalDamage: number, magicDamage: number,
  modifiers: Pick<BoneyardEnemyPlayerDamage, 'manaDamageMaximumFraction' | 'suppressHitResponse' | 'tragicCircle' | 'source'> = {}): void {
  const eventId = emitEvent(work, context.tick, 'attack-marker', actorId, { targetPlayerId: playerId })
  work.playerDamage.push({ actorId, playerId, eventId, physicalDamage: Math.fround(physicalDamage),
    magicDamage: Math.fround(magicDamage), coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0,
    poisonDuration: 0, ...modifiers })
}

function spellContactSource(spell: NativeBossSpell, collisionRadius = 20): NonNullable<BoneyardEnemyPlayerDamage['source']> {
  return { position: { ...spell.position }, collisionRadius, reflectableActorId: null }
}


function randomPoint(work: WorkingStep, point: Readonly<BoneyardPoint>, radius: number): BoneyardPoint {
  const distance = drawNativeFloat(work.steeringRngState, radius)
  const angle = drawNativeFloat(distance.state, 360)
  work.steeringRngState = angle.state
  return advance(point, vector(angle.value), distance.value)
}

function vector(heading: number): BoneyardPoint {
  const angle = heading * Math.PI / 180
  return { x: Math.fround(Math.sin(angle)), y: Math.fround(-Math.cos(angle)) }
}

function advance(point: Readonly<BoneyardPoint>, direction: Readonly<BoneyardPoint>, distance: number): BoneyardPoint {
  return { x: Math.fround(point.x + direction.x * distance), y: Math.fround(point.y + direction.y * distance) }
}

function distanceSquared(first: Readonly<BoneyardPoint>, second: Readonly<BoneyardPoint>): number {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2
}

function lineClear(context: BoneyardEnemyStoreStepContext, start: Readonly<BoneyardPoint>, end: Readonly<BoneyardPoint>): boolean {
  const clipped = context.clipSpellSegment?.({ start, end }) ?? end
  return distanceSquared(clipped, end) < 1e-8
}

function projectileLineClear(context: BoneyardEnemyStoreStepContext, spell: NativeBossSpell,
  start: Readonly<BoneyardPoint>, end: Readonly<BoneyardPoint>, nativeExclusionMask = 0x700): boolean {
  return !context.projectileWorldBlocked({ kind: 'line', nativeExclusionMask, end, projectileId: spell.id, radius: 0, start })
}
