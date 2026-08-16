import { nativeFireParticleLifetimeTicks } from '../core-kernels/primary-spell-fire-native.ts'
import type { NativeRngState } from '../core-kernels/native-rng.ts'
import { waterFrostJetLifetimeTicks } from '../core-kernels/primary-spell-water.ts'
import {
  PRIMARY_SPELL_AIR_LIFETIME_TICKS,
  PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS,
  PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
  PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
  type PrimarySpellProjectileState,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import { isNativePlayerStaffTransient } from '../core-kernels/native-player-staff-action.ts'

export interface PrimarySpellPresentationTime {
  newerTick: number
  olderTick: number
  targetTick: number
}

export function copyPrimarySpellState(
  spells: PrimarySpellSimulationState,
): PrimarySpellSimulationState {
  return {
    nextId: spells.nextId,
    projectiles: spells.projectiles.map(copyProjectile),
    transients: spells.transients.map(copyTransient),
  }
}

export function interpolatePrimarySpellState(
  older: PrimarySpellSimulationState,
  newer: PrimarySpellSimulationState,
  blend: number,
  time: PrimarySpellPresentationTime,
): PrimarySpellSimulationState {
  const newerProjectiles = new Map(newer.projectiles.map((spell) => [spell.id, spell]))
  const projectiles = older.projectiles.map((spell) => {
    const next = newerProjectiles.get(spell.id)
    return next ? interpolateProjectile(spell, next, blend) : copyProjectile(spell)
  })
  const transients = interpolatePrimarySpellTransients(older, newer, blend, time)
  if (blend >= 1) {
    const projectileIds = new Set(projectiles.map((spell) => spell.id))
    for (const spell of newer.projectiles) {
      if (!projectileIds.has(spell.id)) projectiles.push(copyProjectile(spell))
    }
  }
  return {
    nextId: blend < 1 ? older.nextId : newer.nextId,
    projectiles: blend < 1
      ? projectiles
      : projectiles.filter((spell) => newerProjectiles.has(spell.id)),
    transients,
  }
}

function interpolateProjectile(
  older: PrimarySpellProjectileState,
  newer: PrimarySpellProjectileState,
  blend: number,
): PrimarySpellProjectileState {
  const discrete = blend < 1 ? older : newer
  if (older.kind !== newer.kind) return copyProjectile(discrete)
  if (discrete.kind === 'weld') {
    return {
      ...discrete,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: lerpVector(older.direction, newer.direction, blend),
      hitTargetIds: [...discrete.hitTargetIds],
      lightRegistration: { ...discrete.lightRegistration },
      position: lerpVector(older.position, newer.position, blend),
      vector: [...discrete.vector],
      velocity: lerpVector(older.velocity, newer.velocity, blend),
    }
  }
  return {
    ...discrete,
    ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
    charge: lerp(older.charge, newer.charge, blend),
    direction: {
      x: lerp(older.direction.x, newer.direction.x, blend),
      y: lerp(older.direction.y, newer.direction.y, blend),
    },
    lightRegistration: { ...discrete.lightRegistration },
    position: {
      x: lerp(older.position.x, newer.position.x, blend),
      y: lerp(older.position.y, newer.position.y, blend),
    },
    velocity: {
      x: lerp(older.velocity.x, newer.velocity.x, blend),
      y: lerp(older.velocity.y, newer.velocity.y, blend),
    },
    ...(discrete.kind === 'earth' ? {
      hitTargetIds: [...discrete.hitTargetIds],
      orientation: [...discrete.orientation],
    } : {}),
  }
}

interface FixedTransientTiming {
  ageZeroTick: number
  firstVisibleAge: 0 | 1
  lifetimeTicks: number
}

interface BracketedFixedTransient {
  newer?: PrimarySpellTransientState
  older?: PrimarySpellTransientState
  timing: FixedTransientTiming
}

function interpolatePrimarySpellTransients(
  older: PrimarySpellSimulationState,
  newer: PrimarySpellSimulationState,
  blend: number,
  time: PrimarySpellPresentationTime,
): PrimarySpellTransientState[] {
  const result = interpolateStateDrivenTransients(older, newer, blend)
  const fixed = new Map<number, BracketedFixedTransient>()

  for (const effect of older.transients) {
    const timing = fixedTransientTiming(effect, time.olderTick)
    if (timing) fixed.set(effect.id, { older: effect, timing })
  }
  for (const effect of newer.transients) {
    const timing = fixedTransientTiming(effect, time.newerTick)
    if (!timing) continue
    const bracket = fixed.get(effect.id)
    if (bracket) bracket.newer = effect
    else fixed.set(effect.id, { newer: effect, timing })
  }

  for (const bracket of fixed.values()) {
    const displayAge = time.targetTick - bracket.timing.ageZeroTick
    if (
      displayAge < bracket.timing.firstVisibleAge
      || displayAge >= bracket.timing.lifetimeTicks
    ) continue
    const source = bracket.older && bracket.newer
      ? interpolateTransient(bracket.older, bracket.newer, blend)
      : copyTransient(bracket.older ?? bracket.newer!)
    result.push({
      ...source,
      ageTicks: source.kind === 'air' ? Math.floor(displayAge) : displayAge,
    })
  }

  // Primary-spell ids come from one monotonic authority allocator, so id order
  // is the native birth-tick/factory-call order across every spell family.
  return result.sort((first, second) => first.id - second.id)
}

function interpolateStateDrivenTransients(
  older: PrimarySpellSimulationState,
  newer: PrimarySpellSimulationState,
  blend: number,
): PrimarySpellTransientState[] {
  const newerById = new Map(newer.transients
    .filter((effect) => (
      effect.kind === 'earth-called-rock' || isNativePlayerStaffTransient(effect)
    ))
    .map((effect) => [effect.id, effect]))
  const result = older.transients
    .filter((effect) => (
      effect.kind === 'earth-called-rock' || isNativePlayerStaffTransient(effect)
    ))
    .map((effect) => {
      const next = newerById.get(effect.id)
      return next ? interpolateTransient(effect, next, blend) : copyTransient(effect)
    })
  if (blend < 1) return result

  const knownIds = new Set(result.map((effect) => effect.id))
  for (const effect of newerById.values()) {
    if (!knownIds.has(effect.id)) result.push(copyTransient(effect))
  }
  return result.filter((effect) => newerById.has(effect.id))
}

function fixedTransientTiming(
  effect: PrimarySpellTransientState,
  snapshotTick: number,
): FixedTransientTiming | null {
  switch (effect.kind) {
    case 'air': return {
      ageZeroTick: effect.birthTick,
      firstVisibleAge: 0,
      lifetimeTicks: effect.underpowered
        ? PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS
        : PRIMARY_SPELL_AIR_LIFETIME_TICKS,
    }
    case 'air-hurricane': return null
    case 'earth-called-rock': return null
    case 'player-staff-contact':
    case 'player-staff-contact-knockback':
    case 'player-staff-knockback':
    case 'player-staff-melee':
    case 'player-staff-move-fade':
    case 'player-staff-perspective-fade':
    case 'player-staff-smoke':
    case 'player-staff-spin':
    case 'player-staff-pike-break': return null
    case 'earth-impact': return {
      ageZeroTick: effect.birthTick,
      firstVisibleAge: 0,
      lifetimeTicks: effect.lifetimeTicks,
    }
    case 'ether-impact': return {
      ageZeroTick: effect.birthTick,
      firstVisibleAge: 0,
      lifetimeTicks: PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
    }
    case 'ether-pierce-streak': return {
      ageZeroTick: snapshotTick - effect.ageTicks,
      firstVisibleAge: 0,
      lifetimeTicks: 10,
    }
    case 'fire': return {
      ageZeroTick: snapshotTick - effect.ageTicks,
      firstVisibleAge: 0,
      lifetimeTicks: nativeFireParticleLifetimeTicks(effect.id),
    }
    case 'fire-ember':
    case 'fire-good-imp':
    case 'fire-patch': return null
    case 'fire-explosion': return {
      ageZeroTick: snapshotTick - effect.ageTicks,
      firstVisibleAge: 0,
      lifetimeTicks: PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
    }
    case 'fire-impact': return {
      ageZeroTick: snapshotTick - effect.ageTicks,
      firstVisibleAge: 0,
      lifetimeTicks: PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
    }
    case 'water': return {
      ageZeroTick: snapshotTick - effect.ageTicks,
      firstVisibleAge: 1,
      lifetimeTicks: waterFrostJetLifetimeTicks(effect.id),
    }
    case 'water-aura': return {
      ageZeroTick: effect.birthTick,
      firstVisibleAge: 0,
      lifetimeTicks: effect.durationTicks,
    }
    case 'water-hail': return null
    case 'weld-channel':
    case 'weld-impact':
    case 'weld-meteor':
    case 'weld-persistent': return null
  }
}

function interpolateTransient(
  older: PrimarySpellTransientState,
  newer: PrimarySpellTransientState,
  blend: number,
): PrimarySpellTransientState {
  const discrete = blend < 1 ? older : newer
  if (older.kind === 'player-staff-melee' && newer.kind === 'player-staff-melee') {
    const action = blend < 1 ? older : newer
    return {
      ...action,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      headingDegrees: lerpDegrees(older.headingDegrees, newer.headingDegrees, blend),
      origin: lerpVector(older.origin, newer.origin, blend),
      progress: lerp(older.progress, newer.progress, blend),
    }
  }
  if (older.kind === 'player-staff-spin' && newer.kind === 'player-staff-spin') {
    const action = blend < 1 ? older : newer
    return {
      ...action,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      countdown: lerp(older.countdown, newer.countdown, blend),
      headingDegrees: lerpDegrees(older.headingDegrees, newer.headingDegrees, blend),
      origin: lerpVector(older.origin, newer.origin, blend),
    }
  }
  if (older.kind === 'player-staff-contact' && newer.kind === 'player-staff-contact') {
    const event = blend < 1 ? older : newer
    return {
      ...event,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      impactSoundPitches: [...event.impactSoundPitches],
      origin: lerpVector(older.origin, newer.origin, blend),
      pikeBreakSoundIndexes: [...event.pikeBreakSoundIndexes],
      procSoundPitches: [...event.procSoundPitches],
      targetIds: [...event.targetIds],
    }
  }
  if (
    older.kind === 'player-staff-pike-break'
    && newer.kind === 'player-staff-pike-break'
  ) {
    const effect = blend < 1 ? older : newer
    return {
      ...effect,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      position: { ...effect.position },
      presentationRng: copyNativeRng(effect.presentationRng),
    }
  }
  if (older.kind === 'player-staff-knockback' && newer.kind === 'player-staff-knockback') {
    const knockback = blend < 1 ? older : newer
    return {
      ...knockback,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      origin: { ...knockback.origin },
      remainingDistance: lerp(
        older.remainingDistance,
        newer.remainingDistance,
        blend,
      ),
      targetIds: [...knockback.targetIds],
    }
  }
  if (older.kind === 'player-staff-smoke' && newer.kind === 'player-staff-smoke') {
    const smoke = blend < 1 ? older : newer
    return {
      ...smoke,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      alpha: lerp(older.alpha, newer.alpha, blend),
      position: lerpVector(older.position, newer.position, blend),
      rotationDegrees: lerpDegrees(
        older.rotationDegrees,
        newer.rotationDegrees,
        blend,
      ),
    }
  }
  if (
    older.kind === 'player-staff-move-fade'
    && newer.kind === 'player-staff-move-fade'
  ) {
    const effect = blend < 1 ? older : newer
    return {
      ...effect,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      alpha: lerp(older.alpha, newer.alpha, blend),
      position: lerpVector(older.position, newer.position, blend),
      velocity: lerpVector(older.velocity, newer.velocity, blend),
    }
  }
  if (
    older.kind === 'player-staff-perspective-fade'
    && newer.kind === 'player-staff-perspective-fade'
  ) {
    const effect = blend < 1 ? older : newer
    return {
      ...effect,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      alpha: lerp(older.alpha, newer.alpha, blend),
      position: { ...effect.position },
    }
  }
  if (isNativePlayerStaffTransient(older) || isNativePlayerStaffTransient(newer)) {
    return copyTransient(discrete)
  }
  if (older.kind === 'earth-impact' && newer.kind === 'earth-impact') {
    const impact = blend < 1 ? older : newer
    return {
      ...impact,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      lightRegistration: null,
      origin: {
        x: lerp(older.origin.x, newer.origin.x, blend),
        y: lerp(older.origin.y, newer.origin.y, blend),
      },
    }
  }
  if (older.kind === 'earth-impact' || newer.kind === 'earth-impact') {
    return copyTransient(discrete)
  }
  if (older.kind === 'earth-called-rock' && newer.kind === 'earth-called-rock') {
    const rock = blend < 1 ? older : newer
    return {
      ...rock,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      fallVelocity: lerp(older.fallVelocity, newer.fallVelocity, blend),
      height: lerp(older.height, newer.height, blend),
      lightRegistration: null,
      position: {
        x: lerp(older.position.x, newer.position.x, blend),
        y: lerp(older.position.y, newer.position.y, blend),
      },
      rotation: lerp(older.rotation, newer.rotation, blend),
      speed: lerp(older.speed, newer.speed, blend),
    }
  }
  if (older.kind === 'earth-called-rock' || newer.kind === 'earth-called-rock') {
    return copyTransient(discrete)
  }
  if (older.kind === 'fire-impact' && newer.kind === 'fire-impact') {
    const impact = blend < 1 ? older : newer
    return {
      ...impact,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      lightRegistration: { ...impact.lightRegistration },
      origin: { ...impact.origin },
    }
  }
  if (older.kind === 'fire-impact' || newer.kind === 'fire-impact') {
    return copyTransient(discrete)
  }
  if (older.kind === 'fire-ember' && newer.kind === 'fire-ember') {
    const ember = blend < 1 ? older : newer
    return {
      ...ember,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      height: lerp(older.height, newer.height, blend),
      horizontalVelocity: {
        x: lerp(older.horizontalVelocity.x, newer.horizontalVelocity.x, blend),
        y: lerp(older.horizontalVelocity.y, newer.horizontalVelocity.y, blend),
      },
      life: lerp(older.life, newer.life, blend),
      phase: lerp(older.phase, newer.phase, blend),
      position: {
        x: lerp(older.position.x, newer.position.x, blend),
        y: lerp(older.position.y, newer.position.y, blend),
      },
      verticalVelocity: lerp(
        older.verticalVelocity,
        newer.verticalVelocity,
        blend,
      ),
    }
  }
  if (older.kind === 'fire-ember' || newer.kind === 'fire-ember') {
    return copyTransient(discrete)
  }
  if (older.kind === 'fire-explosion' && newer.kind === 'fire-explosion') {
    const explosion = blend < 1 ? older : newer
    return {
      ...explosion,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      origin: { ...explosion.origin },
    }
  }
  if (older.kind === 'fire-explosion' || newer.kind === 'fire-explosion') {
    return copyTransient(discrete)
  }
  if (older.kind === 'fire-good-imp' && newer.kind === 'fire-good-imp') {
    const imp = blend < 1 ? older : newer
    return {
      ...imp,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      bodyRotationDeg: lerp(older.bodyRotationDeg, newer.bodyRotationDeg, blend),
      bodyScale: lerp(older.bodyScale, newer.bodyScale, blend),
      contactAgeTicks: older.contactAgeTicks !== null && newer.contactAgeTicks !== null
        ? lerp(older.contactAgeTicks, newer.contactAgeTicks, blend)
        : imp.contactAgeTicks,
      contactOrigin: imp.contactOrigin === null ? null : { ...imp.contactOrigin },
      contactScale: lerp(older.contactScale, newer.contactScale, blend),
      effectAlpha: lerp(older.effectAlpha, newer.effectAlpha, blend),
      effectPhase: lerp(older.effectPhase, newer.effectPhase, blend),
      flightSpeed: lerp(older.flightSpeed, newer.flightSpeed, blend),
      headingDegrees: lerp(older.headingDegrees, newer.headingDegrees, blend),
      lightGlow: lerp(older.lightGlow, newer.lightGlow, blend),
      lightRegistration: { ...imp.lightRegistration },
      position: {
        x: lerp(older.position.x, newer.position.x, blend),
        y: lerp(older.position.y, newer.position.y, blend),
      },
      remainingTicks: lerp(older.remainingTicks, newer.remainingTicks, blend),
      verticalOffset: lerp(older.verticalOffset, newer.verticalOffset, blend),
      verticalVelocity: lerp(older.verticalVelocity, newer.verticalVelocity, blend),
    }
  }
  if (older.kind === 'fire-good-imp' || newer.kind === 'fire-good-imp') {
    return copyTransient(discrete)
  }
  if (older.kind === 'ether-impact' && newer.kind === 'ether-impact') {
    const impact = blend < 1 ? older : newer
    return {
      ...impact,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      lightRegistration: { ...impact.lightRegistration },
      origin: { ...impact.origin },
    }
  }
  if (older.kind === 'ether-impact' || newer.kind === 'ether-impact') {
    return copyTransient(discrete)
  }
  if (
    older.kind === 'ether-pierce-streak'
    && newer.kind === 'ether-pierce-streak'
  ) {
    const streak = blend < 1 ? older : newer
    return {
      ...streak,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      origin: { ...streak.origin },
    }
  }
  if (
    older.kind === 'ether-pierce-streak'
    || newer.kind === 'ether-pierce-streak'
  ) {
    return copyTransient(discrete)
  }
  if (older.kind === 'fire' && newer.kind === 'fire') {
    const fire = blend < 1 ? older : newer
    return {
      ...fire,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      lightRegistration: null,
      direction: { ...fire.direction },
      origin: { ...fire.origin },
    }
  }
  if (older.kind === 'fire' || newer.kind === 'fire') return copyTransient(discrete)
  if (older.kind === 'water' && newer.kind === 'water') {
    const water = blend < 1 ? older : newer
    return {
      ...water,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: {
        x: lerp(older.direction.x, newer.direction.x, blend),
        y: lerp(older.direction.y, newer.direction.y, blend),
      },
      lightRegistration: null,
      obstructionPoint: water.obstructionPoint === null
        ? null
        : { ...water.obstructionPoint },
      origin: {
        x: lerp(older.origin.x, newer.origin.x, blend),
        y: lerp(older.origin.y, newer.origin.y, blend),
      },
    }
  }
  if (older.kind === 'water' || newer.kind === 'water') return copyTransient(discrete)
  if (older.kind === 'air' && newer.kind === 'air') {
    const air = blend < 1 ? older : newer
    return {
      ...air,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: { ...air.direction },
      endpoint: { ...air.endpoint },
      lightRegistration: { ...air.lightRegistration! },
      midpoint: { ...air.midpoint },
      origin: { ...air.origin },
    }
  }
  if (older.kind === 'air' || newer.kind === 'air') return copyTransient(discrete)
  if (older.kind === 'air-hurricane' && newer.kind === 'air-hurricane') {
    return {
      ...(blend < 1 ? older : newer),
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      charge: lerp(older.charge, newer.charge, blend),
      position: {
        x: lerp(older.position.x, newer.position.x, blend),
        y: lerp(older.position.y, newer.position.y, blend),
      },
    }
  }
  if (older.kind === 'water-hail' && newer.kind === 'water-hail') {
    const hail = blend < 1 ? older : newer
    return {
      ...hail,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      height: lerp(older.height, newer.height, blend),
      horizontalVelocity: {
        x: lerp(older.horizontalVelocity.x, newer.horizontalVelocity.x, blend),
        y: lerp(older.horizontalVelocity.y, newer.horizontalVelocity.y, blend),
      },
      life: lerp(older.life, newer.life, blend),
      position: {
        x: lerp(older.position.x, newer.position.x, blend),
        y: lerp(older.position.y, newer.position.y, blend),
      },
      rotationDegrees: lerp(older.rotationDegrees, newer.rotationDegrees, blend),
      verticalVelocity: lerp(older.verticalVelocity, newer.verticalVelocity, blend),
    }
  }
  if (older.kind === 'water-aura' && newer.kind === 'water-aura') {
    return interpolateOriginTransient(older, newer, blend)
  }
  if (older.kind === 'weld-channel' && newer.kind === 'weld-channel') {
    const actor = blend < 1 ? older : newer
    return {
      ...actor,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: lerpVector(older.direction, newer.direction, blend),
      lightRegistration: null,
      origin: lerpVector(older.origin, newer.origin, blend),
      vector: [...actor.vector],
    }
  }
  if (older.kind === 'weld-impact' && newer.kind === 'weld-impact') {
    const actor = blend < 1 ? older : newer
    return {
      ...actor,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: lerpVector(older.direction, newer.direction, blend),
      lightRegistration: null,
      origin: lerpVector(older.origin, newer.origin, blend),
      position: lerpVector(older.position, newer.position, blend),
      vector: [...actor.vector],
    }
  }
  if (older.kind === 'weld-meteor' && newer.kind === 'weld-meteor') {
    const actor = blend < 1 ? older : newer
    return {
      ...actor,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: lerpVector(older.direction, newer.direction, blend),
      fallScalar: lerp(older.fallScalar, newer.fallScalar, blend),
      lightRegistration: null,
      origin: lerpVector(older.origin, newer.origin, blend),
      position: lerpVector(older.position, newer.position, blend),
      vector: [...actor.vector],
    }
  }
  if (older.kind === 'weld-persistent' && newer.kind === 'weld-persistent') {
    const actor = blend < 1 ? older : newer
    return {
      ...actor,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: lerpVector(older.direction, newer.direction, blend),
      lightRegistration: null,
      origin: lerpVector(older.origin, newer.origin, blend),
      vector: [...actor.vector],
    }
  }
  if (isWeldTransient(older) || isWeldTransient(newer)) return copyTransient(discrete)
  throw new Error('Unsupported primary spell transient pair')
}

function interpolateOriginTransient<
  Transient extends Extract<PrimarySpellTransientState, { origin: unknown }>,
>(
  older: Transient,
  newer: Transient,
  blend: number,
): Transient {
  return {
    ...(blend < 1 ? older : newer),
    ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
    origin: {
      x: lerp(older.origin.x, newer.origin.x, blend),
      y: lerp(older.origin.y, newer.origin.y, blend),
    },
  }
}

function copyProjectile(spell: PrimarySpellProjectileState): PrimarySpellProjectileState {
  if (spell.kind === 'weld') {
    return {
      ...spell,
      direction: { ...spell.direction },
      hitTargetIds: [...spell.hitTargetIds],
      lightRegistration: { ...spell.lightRegistration },
      position: { ...spell.position },
      vector: [...spell.vector],
      velocity: { ...spell.velocity },
    }
  }
  return {
    ...spell,
    direction: { ...spell.direction },
    lightRegistration: { ...spell.lightRegistration },
    ...(spell.kind === 'earth' ? {
      hitTargetIds: [...spell.hitTargetIds],
      orientation: [...spell.orientation],
    } : {}),
    position: { ...spell.position },
    velocity: { ...spell.velocity },
  }
}

function isWeldTransient(effect: PrimarySpellTransientState): boolean {
  return effect.kind === 'weld-channel'
    || effect.kind === 'weld-impact'
    || effect.kind === 'weld-meteor'
    || effect.kind === 'weld-persistent'
}

function copyTransient(effect: PrimarySpellTransientState): PrimarySpellTransientState {
  if (effect.kind === 'player-staff-melee' || effect.kind === 'player-staff-spin') {
    return { ...effect, origin: { ...effect.origin } }
  }
  if (effect.kind === 'ether-pierce-streak' || effect.kind === 'fire-explosion') {
    return { ...effect, origin: { ...effect.origin } }
  }
  if (effect.kind === 'player-staff-contact') {
    return {
      ...effect,
      impactSoundPitches: [...effect.impactSoundPitches],
      origin: { ...effect.origin },
      pikeBreakSoundIndexes: [...effect.pikeBreakSoundIndexes],
      procSoundPitches: [...effect.procSoundPitches],
      targetIds: [...effect.targetIds],
    }
  }
  if (effect.kind === 'player-staff-contact-knockback') {
    return { ...effect, delta: { ...effect.delta } }
  }
  if (effect.kind === 'player-staff-pike-break') {
    return {
      ...effect,
      position: { ...effect.position },
      presentationRng: copyNativeRng(effect.presentationRng),
    }
  }
  if (effect.kind === 'player-staff-knockback') {
    return { ...effect, origin: { ...effect.origin }, targetIds: [...effect.targetIds] }
  }
  if (effect.kind === 'player-staff-smoke' || effect.kind === 'player-staff-perspective-fade') {
    return { ...effect, position: { ...effect.position } }
  }
  if (effect.kind === 'player-staff-move-fade') {
    return {
      ...effect,
      position: { ...effect.position },
      velocity: { ...effect.velocity },
    }
  }
  if (effect.kind === 'earth-impact') {
    return {
      ...effect,
      lightRegistration: null,
      origin: { ...effect.origin },
    }
  }
  if (effect.kind === 'ether-impact' || effect.kind === 'fire-impact') {
    return {
      ...effect,
      lightRegistration: { ...effect.lightRegistration },
      origin: { ...effect.origin },
    }
  }
  if (effect.kind === 'earth-called-rock') {
    return { ...effect, lightRegistration: null, position: { ...effect.position } }
  }
  if (effect.kind === 'fire-ember') {
    return {
      ...effect,
      horizontalVelocity: { ...effect.horizontalVelocity },
      position: { ...effect.position },
    }
  }
  if (effect.kind === 'fire-good-imp') {
    return {
      ...effect,
      contactOrigin: effect.contactOrigin === null ? null : { ...effect.contactOrigin },
      lightRegistration: { ...effect.lightRegistration },
      position: { ...effect.position },
    }
  }
  if (effect.kind === 'fire-patch') {
    return {
      ...effect,
      position: { ...effect.position },
      velocity: { ...effect.velocity },
      velocityMultiplier: { ...effect.velocityMultiplier },
    }
  }
  if (effect.kind === 'water') {
    return {
      ...effect,
      direction: { ...effect.direction },
      lightRegistration: null,
      obstructionPoint: effect.obstructionPoint === null
        ? null
        : { ...effect.obstructionPoint },
      origin: { ...effect.origin },
    }
  }
  if (effect.kind === 'air') {
    return {
      ...effect,
      direction: { ...effect.direction },
      endpoint: { ...effect.endpoint },
      lightRegistration: { ...effect.lightRegistration },
      midpoint: { ...effect.midpoint },
      origin: { ...effect.origin },
    }
  }
  if (effect.kind === 'air-hurricane') {
    return { ...effect, position: { ...effect.position } }
  }
  if (effect.kind === 'water-hail') {
    return {
      ...effect,
      horizontalVelocity: { ...effect.horizontalVelocity },
      position: { ...effect.position },
    }
  }
  if (effect.kind === 'water-aura') {
    return { ...effect, origin: { ...effect.origin } }
  }
  return {
    ...effect,
    direction: { ...effect.direction },
    lightRegistration: null,
    origin: { ...effect.origin },
  }
}

function copyNativeRng(source: NativeRngState) {
  return { ...source, words: [...source.words] }
}

function lerp(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
}

function lerpVector(
  first: Readonly<{ x: number; y: number }>,
  second: Readonly<{ x: number; y: number }>,
  blend: number,
): { x: number; y: number } {
  return {
    x: lerp(first.x, second.x, blend),
    y: lerp(first.y, second.y, blend),
  }
}

function lerpDegrees(first: number, second: number, blend: number): number {
  const delta = ((second - first + 540) % 360) - 180
  return first + delta * blend
}
