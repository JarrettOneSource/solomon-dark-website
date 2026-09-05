import {
  type NativePlayerStaffTransient,
} from '../core-kernels/native-player-staff-action.ts'
import type { PrimarySpellTransientState } from '../core-kernels/primary-spells.ts'
import type { NativeWeldWorldActor } from '../core-kernels/native-weld-primary-runtime.ts'
import {
  interpolateNullableNumber,
  lerp,
  lerpDegrees,
  lerpForwardCycle,
  lerpNullableVector,
  lerpVector,
} from './primary-spell-presentation-math.ts'
import {
  copyNativeRng,
  copyPrimarySpellTransient,
  copyWeldHailstone,
  copyWeldMeteorDebris,
} from './primary-spell-transient-copy.ts'

type TransientKind = PrimarySpellTransientState['kind']
type MatchingTransientPair = {
  [Kind in TransientKind]: readonly [
    Kind,
    Extract<PrimarySpellTransientState, { kind: Kind }>,
    Extract<PrimarySpellTransientState, { kind: Kind }>,
  ]
}[TransientKind]
type PersistentTransient = Extract<NativeWeldWorldActor, { kind: 'weld-persistent' }>
type PersistentBuildId = PersistentTransient['buildId']
type MatchingPersistentPair = {
  [BuildId in PersistentBuildId]: readonly [
    BuildId,
    Extract<PersistentTransient, { buildId: BuildId }>,
    Extract<PersistentTransient, { buildId: BuildId }>,
  ]
}[PersistentBuildId]

function matchingTransientPair(
  older: PrimarySpellTransientState,
  newer: PrimarySpellTransientState,
): MatchingTransientPair | null {
  if (older.kind !== newer.kind) return null
  return [older.kind, older, newer] as MatchingTransientPair
}

function matchingPersistentPair(
  older: PersistentTransient,
  newer: PersistentTransient,
): MatchingPersistentPair | null {
  if (older.buildId !== newer.buildId) return null
  return [older.buildId, older, newer] as MatchingPersistentPair
}

export function interpolatePrimarySpellTransient(
  older: PrimarySpellTransientState,
  newer: PrimarySpellTransientState,
  blend: number,
): PrimarySpellTransientState {
  const discrete = blend < 1 ? older : newer
  const pair = matchingTransientPair(older, newer)
  if (!pair) return copyPrimarySpellTransient(discrete)

  const staff = interpolateStaffActionTransient(pair, blend)
    ?? interpolateStaffImpactTransient(pair, blend)
    ?? interpolateStaffFadeTransient(pair, blend)
  if (staff) return staff
  const earth = interpolateEarthTransient(pair, blend)
  if (earth) return earth
  const ether = interpolateEtherTransient(pair, blend)
  if (ether) return ether
  const fire = interpolateFireEmberTransient(pair, blend)
    ?? interpolateFireGoodImpTransient(pair, blend)
  if (fire) return fire
  const air = interpolateAirTransient(pair, blend)
  if (air) return air
  const water = interpolateWaterTransient(pair, blend)
  if (water) return water
  const weld = interpolateWeldCoreEffectTransient(pair, blend)
    ?? interpolateWeldFadeEffectTransient(pair, blend)
    ?? interpolateWeldTerrainEffectTransient(pair, blend)
    ?? interpolateWeldActorTransient(pair, blend)
  return weld ?? copyPrimarySpellTransient(discrete)
}

function interpolateStaffActionTransient(
  pair: MatchingTransientPair,
  blend: number,
): NativePlayerStaffTransient | null {
  const [kind, older, newer] = pair
  if (kind === 'player-staff-melee') {
    const action = blend < 1 ? older : newer
    return {
      ...action,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      headingDegrees: lerpDegrees(older.headingDegrees, newer.headingDegrees, blend),
      origin: lerpVector(older.origin, newer.origin, blend),
      progress: lerp(older.progress, newer.progress, blend),
    }
  }
  if (kind === 'player-staff-spin') {
    const action = blend < 1 ? older : newer
    return {
      ...action,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      countdown: lerp(older.countdown, newer.countdown, blend),
      headingDegrees: lerpDegrees(older.headingDegrees, newer.headingDegrees, blend),
      origin: lerpVector(older.origin, newer.origin, blend),
    }
  }
  if (kind === 'player-staff-contact') {
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
  return null
}

function interpolateStaffImpactTransient(
  pair: MatchingTransientPair,
  blend: number,
): NativePlayerStaffTransient | null {
  const [kind, older, newer] = pair
  if (kind === 'player-staff-pike-break') {
    const effect = blend < 1 ? older : newer
    return {
      ...effect,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      position: { ...effect.position },
      presentationRng: copyNativeRng(effect.presentationRng),
    }
  }
  if (kind === 'player-staff-knockback') {
    const knockback = blend < 1 ? older : newer
    return {
      ...knockback,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      origin: { ...knockback.origin },
      remainingDistance: lerp(older.remainingDistance, newer.remainingDistance, blend),
      targetIds: [...knockback.targetIds],
    }
  }
  if (kind === 'player-staff-smoke') {
    const smoke = interpolateStaffFadeBase(older, newer, blend)
    return {
      ...smoke,
      position: lerpVector(older.position, newer.position, blend),
      rotationDegrees: lerpDegrees(older.rotationDegrees, newer.rotationDegrees, blend),
    }
  }
  return null
}

function interpolateStaffFadeTransient(
  pair: MatchingTransientPair,
  blend: number,
): NativePlayerStaffTransient | null {
  const [kind, older, newer] = pair
  if (kind === 'player-staff-move-fade') {
    const effect = interpolateStaffFadeBase(older, newer, blend)
    return {
      ...effect,
      position: lerpVector(older.position, newer.position, blend),
      velocity: lerpVector(older.velocity, newer.velocity, blend),
    }
  }
  if (kind === 'player-staff-perspective-fade') {
    const effect = interpolateStaffFadeBase(older, newer, blend)
    return {
      ...effect,
      position: { ...effect.position },
    }
  }
  return null
}

function interpolateStaffFadeBase<
  Transient extends Extract<NativePlayerStaffTransient, { alpha: number }>,
>(older: Transient, newer: Transient, blend: number): Transient {
  return {
    ...(blend < 1 ? older : newer),
    ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
    alpha: lerp(older.alpha, newer.alpha, blend),
  }
}

function interpolateEarthTransient(
  pair: MatchingTransientPair,
  blend: number,
): PrimarySpellTransientState | null {
  const [kind, older, newer] = pair
  if (kind === 'earth-boulder-bit') {
    const actor = blend < 1 ? older : newer
    return {
      ...actor,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      debris: copyWeldMeteorDebris(actor.debris),
      lightRegistration: null,
      origin: lerpVector(older.origin, newer.origin, blend),
      position: lerpVector(older.position, newer.position, blend),
    }
  }
  if (kind === 'earth-impact') {
    const impact = blend < 1 ? older : newer
    return {
      ...impact,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      lightRegistration: null,
      origin: lerpVector(older.origin, newer.origin, blend),
    }
  }
  if (kind === 'earth-called-rock') {
    const rock = blend < 1 ? older : newer
    return {
      ...rock,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      fallVelocity: lerp(older.fallVelocity, newer.fallVelocity, blend),
      height: lerp(older.height, newer.height, blend),
      lightRegistration: null,
      position: lerpVector(older.position, newer.position, blend),
      rotation: lerp(older.rotation, newer.rotation, blend),
      speed: lerp(older.speed, newer.speed, blend),
    }
  }
  return null
}

function interpolateEtherTransient(
  pair: MatchingTransientPair,
  blend: number,
): PrimarySpellTransientState | null {
  const [kind, older, newer] = pair
  if (kind === 'ether-blast') {
    const blast = blend < 1 ? older : newer
    return {
      ...blast,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      origin: lerpVector(older.origin, newer.origin, blend),
      presentationRng: copyNativeRng(blast.presentationRng),
    }
  }
  return null
}

function interpolateFireEmberTransient(
  pair: MatchingTransientPair,
  blend: number,
): PrimarySpellTransientState | null {
  const [kind, older, newer] = pair
  if (kind === 'fire-ember') {
    const ember = blend < 1 ? older : newer
    return {
      ...ember,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      height: lerp(older.height, newer.height, blend),
      horizontalVelocity: lerpVector(older.horizontalVelocity, newer.horizontalVelocity, blend),
      life: lerp(older.life, newer.life, blend),
      lightRegistration: { ...ember.lightRegistration },
      phase: lerpForwardCycle(older.phase, newer.phase, blend, 4),
      position: lerpVector(older.position, newer.position, blend),
      verticalVelocity: lerp(older.verticalVelocity, newer.verticalVelocity, blend),
    }
  }
  return null
}

function interpolateFireGoodImpTransient(
  pair: MatchingTransientPair,
  blend: number,
): PrimarySpellTransientState | null {
  const [kind, older, newer] = pair
  if (kind !== 'fire-good-imp') return null
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
    position: lerpVector(older.position, newer.position, blend),
    remainingTicks: lerp(older.remainingTicks, newer.remainingTicks, blend),
    verticalOffset: lerp(older.verticalOffset, newer.verticalOffset, blend),
    verticalVelocity: lerp(older.verticalVelocity, newer.verticalVelocity, blend),
  }
}

function interpolateAirTransient(
  pair: MatchingTransientPair,
  blend: number,
): PrimarySpellTransientState | null {
  const [kind, older, newer] = pair
  if (kind === 'air-hurricane') {
    const hurricane = blend < 1 ? older : newer
    return {
      ...hurricane,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      charge: lerp(older.charge, newer.charge, blend),
      contactCharge: lerp(older.contactCharge, newer.contactCharge, blend),
      lanes: hurricane.lanes.map((lane, index) => ({
        ...lane,
        angleDegrees: lerp(
          older.lanes[index]!.angleDegrees,
          newer.lanes[index]!.angleDegrees,
          blend,
        ),
      })),
      phaseDegrees: lerp(older.phaseDegrees, newer.phaseDegrees, blend),
      position: lerpVector(older.position, newer.position, blend),
    }
  }
  return null
}

function interpolateWaterTransient(
  pair: MatchingTransientPair,
  blend: number,
): PrimarySpellTransientState | null {
  const [kind, older, newer] = pair
  if (kind === 'harden-burst') return {
    ...(blend < 1 ? older : newer),
    ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
    alpha: lerp(older.alpha, newer.alpha, blend),
    position: lerpVector(older.position, newer.position, blend),
  }
  if (kind === 'harden-shard') return {
    ...(blend < 1 ? older : newer),
    ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
    height: lerp(older.height, newer.height, blend),
    life: lerp(older.life, newer.life, blend),
    position: lerpVector(older.position, newer.position, blend),
    rotationDegrees: lerp(older.rotationDegrees, newer.rotationDegrees, blend),
    velocity: lerpVector(older.velocity, newer.velocity, blend),
    verticalVelocity: lerp(older.verticalVelocity, newer.verticalVelocity, blend),
  }
  if (kind === 'water') {
    const water = blend < 1 ? older : newer
    return {
      ...water,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: lerpVector(older.direction, newer.direction, blend),
      lightRegistration: null,
      obstructionPoint: water.obstructionPoint === null
        ? null
        : { ...water.obstructionPoint },
      origin: lerpVector(older.origin, newer.origin, blend),
    }
  }
  if (kind === 'water-hail') {
    const hail = blend < 1 ? older : newer
    return {
      ...hail,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      height: lerp(older.height, newer.height, blend),
      horizontalVelocity: lerpVector(older.horizontalVelocity, newer.horizontalVelocity, blend),
      life: lerp(older.life, newer.life, blend),
      position: lerpVector(older.position, newer.position, blend),
      rotationDegrees: lerp(older.rotationDegrees, newer.rotationDegrees, blend),
      verticalVelocity: lerp(older.verticalVelocity, newer.verticalVelocity, blend),
    }
  }
  if (kind === 'water-aura') {
    const aura = blend < 1 ? older : newer
    return {
      ...aura,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      origin: lerpVector(older.origin, newer.origin, blend),
    }
  }
  return null
}

function interpolateWeldCoreEffectTransient(
  pair: MatchingTransientPair,
  blend: number,
): NativeWeldWorldActor | null {
  const [kind, older, newer] = pair
  if (kind === 'weld-meteor-marker') {
    const actor = interpolateWeldOriginTransient(older, newer, blend)
    return {
      ...actor,
      alpha: lerp(older.alpha, newer.alpha, blend),
      lightRegistration: null,
      rotationDegrees: lerp(older.rotationDegrees, newer.rotationDegrees, blend),
      scale: lerp(older.scale, newer.scale, blend),
    }
  }
  if (kind === 'weld-channel') {
    const actor = interpolateWeldOriginTransient(older, newer, blend)
    return {
      ...actor,
      endpoint: lerpNullableVector(older.endpoint, newer.endpoint, blend),
      lightRegistration: null,
      midpoint: lerpNullableVector(older.midpoint, newer.midpoint, blend),
    }
  }
  if (kind === 'weld-impact') {
    const actor = interpolateWeldFadingPositionTransient(older, newer, blend)
    return {
      ...actor,
      lightRegistration: actor.lightRegistration === null
        ? null
        : { ...actor.lightRegistration },
    }
  }
  if (kind === 'weld-boulder-debris') {
    const actor = interpolateWeldPositionTransient(older, newer, blend)
    return {
      ...actor,
      debris: copyWeldMeteorDebris(actor.debris),
      lightRegistration: null,
    }
  }
  return null
}

function interpolateWeldFadeEffectTransient(
  pair: MatchingTransientPair,
  blend: number,
): NativeWeldWorldActor | null {
  const [kind, older, newer] = pair
  if (kind === 'weld-flame-lash-fade') {
    return interpolateWeldFadingPositionTransient(older, newer, blend)
  }
  if (kind === 'weld-ground-spark-fade') {
    const actor = interpolateWeldFadingPositionTransient(older, newer, blend)
    return { ...actor, lightRegistration: null }
  }
  if (kind === 'weld-hail-flash') {
    return interpolateWeldFadingPositionTransient(older, newer, blend)
  }
  if (kind === 'weld-meteor-flash') {
    return interpolateWeldFadingPositionTransient(older, newer, blend)
  }
  return null
}

function interpolateWeldTerrainEffectTransient(
  pair: MatchingTransientPair,
  blend: number,
): NativeWeldWorldActor | null {
  const [kind, older, newer] = pair
  if (kind === 'weld-hail-line') {
    const actor = interpolateWeldOriginTransient(older, newer, blend)
    return {
      ...actor,
      alpha: lerp(older.alpha, newer.alpha, blend),
      end: lerpVector(older.end, newer.end, blend),
      start: lerpVector(older.start, newer.start, blend),
    }
  }
  if (kind === 'weld-hail-terrain-particle') {
    const actor = interpolateWeldFadingPositionTransient(older, newer, blend)
    return { ...actor, velocity: lerpVector(older.velocity, newer.velocity, blend) }
  }
  if (kind === 'weld-hail-terrain-bouncer') {
    const actor = interpolateWeldFadingPositionTransient(older, newer, blend)
    return {
      ...actor,
      height: lerp(older.height, newer.height, blend),
      rotationDegrees: lerpDegrees(older.rotationDegrees, newer.rotationDegrees, blend),
      velocity: lerpVector(older.velocity, newer.velocity, blend),
    }
  }
  return null
}

function interpolateWeldActorTransient(
  pair: MatchingTransientPair,
  blend: number,
): NativeWeldWorldActor | null {
  const [kind, older, newer] = pair
  if (kind === 'weld-steam') {
    const actor = interpolateWeldPositionTransient(older, newer, blend)
    return {
      ...actor,
      blue: lerp(older.blue, newer.blue, blend),
      life: lerp(older.life, newer.life, blend),
      lightRegistration: null,
      phase: lerp(older.phase, newer.phase, blend),
      remainingDistance: lerp(older.remainingDistance, newer.remainingDistance, blend),
      scale: lerp(older.scale, newer.scale, blend),
      stretch: lerp(older.stretch, newer.stretch, blend),
      terminalPosition: { ...actor.terminalPosition },
      tintFade: lerp(older.tintFade, newer.tintFade, blend),
      velocity: lerpVector(older.velocity, newer.velocity, blend),
    }
  }
  if (kind === 'weld-hail-rock-fade') {
    const actor = interpolateWeldPositionTransient(older, newer, blend)
    return {
      ...actor,
      lightRegistration: null,
    }
  }
  if (kind === 'weld-meteor') {
    const actor = interpolateWeldPositionTransient(older, newer, blend)
    return {
      ...actor,
      cameraDisplacement: actor.cameraDisplacement === null
        ? null
        : { ...actor.cameraDisplacement },
      debris: actor.debris.map(copyWeldMeteorDebris),
      bodyScale: lerp(older.bodyScale, newer.bodyScale, blend),
      fallHeight: lerp(older.fallHeight, newer.fallHeight, blend),
      lightRegistration: { ...actor.lightRegistration },
    }
  }
  if (kind === 'weld-persistent') {
    return interpolateWeldPersistentTransient(older, newer, blend)
  }
  return null
}

function interpolateWeldPersistentTransient(
  older: PersistentTransient,
  newer: PersistentTransient,
  blend: number,
): PersistentTransient {
  const pair = matchingPersistentPair(older, newer)
  if (!pair) return copyPrimarySpellTransient(blend < 1 ? older : newer)
  const [buildId, previous, next] = pair
  if (buildId === 1006) {
    const actor = interpolateWeldOriginTransient(previous, next, blend)
    return {
      ...actor,
      hitTargetIds: [...actor.hitTargetIds],
      lightRegistration: { ...actor.lightRegistration },
      scale: lerp(previous.scale, next.scale, blend),
      shellScale: lerp(previous.shellScale, next.shellScale, blend),
      velocity: lerpVector(previous.velocity, next.velocity, blend),
    }
  }
  if (buildId === 1008) {
    const actor = interpolateWeldOriginTransient(previous, next, blend)
    return {
      ...actor,
      lightRegistration: { ...actor.lightRegistration },
      releaseAgeTicks: interpolateNullableNumber(
        previous.releaseAgeTicks,
        next.releaseAgeTicks,
        blend,
      ),
      releaseFadeScale: interpolateNullableNumber(
        previous.releaseFadeScale,
        next.releaseFadeScale,
        blend,
      ),
      rocks: actor.rocks.map(copyWeldHailstone),
      scale: lerp(previous.scale, next.scale, blend),
    }
  }
  const actor = interpolateWeldOriginTransient(previous, next, blend)
  return {
    ...actor,
    lightRegistration: null,
  }
}

function interpolateWeldOriginTransient<Transient extends NativeWeldWorldActor>(
  older: Transient,
  newer: Transient,
  blend: number,
): Transient {
  const actor = blend < 1 ? older : newer
  return {
    ...actor,
    ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
    direction: lerpVector(older.direction, newer.direction, blend),
    origin: lerpVector(older.origin, newer.origin, blend),
    vector: [...actor.vector],
  }
}

function interpolateWeldPositionTransient<
  Transient extends Extract<NativeWeldWorldActor, {
    position: Readonly<{ x: number; y: number }>
  }>,
>(older: Transient, newer: Transient, blend: number): Transient {
  return {
    ...interpolateWeldOriginTransient(older, newer, blend),
    position: lerpVector(older.position, newer.position, blend),
  }
}

function interpolateWeldFadingPositionTransient<
  Transient extends Extract<NativeWeldWorldActor, {
    alpha: number
    position: Readonly<{ x: number; y: number }>
  }>,
>(older: Transient, newer: Transient, blend: number): Transient {
  return {
    ...interpolateWeldPositionTransient(older, newer, blend),
    alpha: lerp(older.alpha, newer.alpha, blend),
  }
}
