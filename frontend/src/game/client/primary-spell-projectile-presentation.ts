import type { PrimarySpellProjectileState } from '../core-kernels/primary-spells.ts'
import type { NativeWeldProjectileState } from '../core-kernels/native-weld-primary-runtime.ts'
import {
  interpolateNullableNumber,
  lerp,
  lerpVector,
} from './primary-spell-presentation-math.ts'

type ProjectileKind = PrimarySpellProjectileState['kind']
type MatchingProjectilePair = {
  [Kind in ProjectileKind]: readonly [
    Kind,
    Extract<PrimarySpellProjectileState, { kind: Kind }>,
    Extract<PrimarySpellProjectileState, { kind: Kind }>,
  ]
}[ProjectileKind]

function matchingProjectilePair(
  older: PrimarySpellProjectileState,
  newer: PrimarySpellProjectileState,
): MatchingProjectilePair | null {
  if (older.kind !== newer.kind) return null
  return [older.kind, older, newer] as MatchingProjectilePair
}

function copyFrostPresentationLanes(
  lanes: NativeWeldProjectileState['frostPresentationLanes'],
): NativeWeldProjectileState['frostPresentationLanes'] {
  return lanes === null ? null : [{ ...lanes[0] }, { ...lanes[1] }]
}

export function copyPrimarySpellProjectile(
  spell: PrimarySpellProjectileState,
): PrimarySpellProjectileState {
  if (spell.kind === 'weld') {
    return {
      ...spell,
      direction: { ...spell.direction },
      frostPresentationLanes: copyFrostPresentationLanes(spell.frostPresentationLanes),
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

export function interpolatePrimarySpellProjectile(
  older: PrimarySpellProjectileState,
  newer: PrimarySpellProjectileState,
  blend: number,
): PrimarySpellProjectileState {
  const discrete = blend < 1 ? older : newer
  const pair = matchingProjectilePair(older, newer)
  if (!pair) return copyPrimarySpellProjectile(discrete)
  const [kind, previous, next] = pair
  if (kind === 'weld') {
    const spell = blend < 1 ? previous : next
    return {
      ...spell,
      ageTicks: lerp(previous.ageTicks, next.ageTicks, blend),
      ballLightningAcceleration: interpolateNullableNumber(
        previous.ballLightningAcceleration,
        next.ballLightningAcceleration,
        blend,
      ),
      basePresentationPhaseDegrees: interpolateNullableNumber(
        previous.basePresentationPhaseDegrees,
        next.basePresentationPhaseDegrees,
        blend,
      ),
      direction: lerpVector(previous.direction, next.direction, blend),
      frostTurnDegrees: interpolateNullableNumber(
        previous.frostTurnDegrees,
        next.frostTurnDegrees,
        blend,
      ),
      frostPresentationLanes: copyFrostPresentationLanes(spell.frostPresentationLanes),
      groundSparkNativeAgeTicks: interpolateNullableNumber(
        previous.groundSparkNativeAgeTicks,
        next.groundSparkNativeAgeTicks,
        blend,
      ),
      hitTargetIds: [...spell.hitTargetIds],
      lightRegistration: { ...spell.lightRegistration },
      position: lerpVector(previous.position, next.position, blend),
      vector: [...spell.vector],
      velocity: lerpVector(previous.velocity, next.velocity, blend),
    }
  }
  if (kind === 'earth') {
    const spell = blend < 1 ? previous : next
    return {
      ...spell,
      ageTicks: lerp(previous.ageTicks, next.ageTicks, blend),
      charge: lerp(previous.charge, next.charge, blend),
      direction: lerpVector(previous.direction, next.direction, blend),
      hitTargetIds: [...spell.hitTargetIds],
      lightRegistration: { ...spell.lightRegistration },
      orientation: [...spell.orientation],
      position: lerpVector(previous.position, next.position, blend),
      shellCharge: lerp(previous.shellCharge, next.shellCharge, blend),
      velocity: lerpVector(previous.velocity, next.velocity, blend),
    }
  }
  const spell = blend < 1 ? previous : next
  return {
    ...spell,
    ageTicks: lerp(previous.ageTicks, next.ageTicks, blend),
    charge: lerp(previous.charge, next.charge, blend),
    direction: lerpVector(previous.direction, next.direction, blend),
    lightRegistration: { ...spell.lightRegistration },
    position: lerpVector(previous.position, next.position, blend),
    velocity: lerpVector(previous.velocity, next.velocity, blend),
  }
}
