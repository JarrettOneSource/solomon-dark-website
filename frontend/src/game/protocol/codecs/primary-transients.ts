import {
  NATIVE_HAIL_INITIAL_LIFE,
  NATIVE_HAIL_MAXIMUM_BOUNCE_PITCH,
  NATIVE_HAIL_MAXIMUM_SCALE,
  NATIVE_HAIL_MINIMUM_BOUNCE_PITCH,
  NATIVE_HAIL_MINIMUM_HEIGHT,
  NATIVE_HAIL_MINIMUM_SCALE,
} from '../../core-kernels/air-water-spell-actors.ts'
import { NATIVE_EARTH_BOULDER_MAXIMUM_CHARGE } from '../../core-kernels/native-earth-boulder.ts'
import { NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS } from '../../core-kernels/native-ether-blast.ts'
import { isNativePlayerStaffTransient } from '../../core-kernels/native-player-staff-action.ts'
import {
  NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS,
} from '../../core-kernels/native-weld-boulder-debris.ts'
import { earthImpactLifetimeTicks } from '../../core-kernels/primary-spell-earth.ts'
import {
  NATIVE_GOOD_IMP_CONTACT_VISIBLE_TICKS,
} from '../../core-kernels/primary-spell-fire-effects.ts'
import {
  NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS,
  NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../../core-kernels/primary-spell-fire-native.ts'
import {
  WATER_FROST_MAXIMUM_SPEED,
  WATER_FROST_MAX_PARTICLES_PER_TICK,
  WATER_FROST_MINIMUM_SPEED,
  waterFrostJetKind,
  waterFrostJetLifetimeTicks,
} from '../../core-kernels/primary-spell-water.ts'
import {
  PRIMARY_SPELL_AIR_LIFETIME_TICKS,
  PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS,
  PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
  type PrimarySpellEarthBoulderBitState,
  type PrimarySpellTransientState,
  nativePrimaryPainterRegistrationContract,
} from '../../core-kernels/primary-spells.ts'
import {
  absentNativeActorLight,
  nativeEnemyPathState,
  nativeRngState,
  nativeWorldManagerRegistration,
  nativeWorldPainterRegistrations,
  unitVector,
  vector,
} from './native-state.ts'
import { type WithoutPainterRegistrations, primarySpellFireSpentEmber } from './primary-projectiles.ts'
import { nativePlayerStaffTransient } from './staff.ts'
import {
  GameProtocolError,
  array,
  boolean,
  boundedInteger,
  finite,
  finiteWithin,
  integer,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
  unitInterval,
  validatedPlayerId,
} from './values.ts'
import { nativeWeldBoulderDebris } from './weld-children.ts'
import { primarySpellWeldActor } from './weld.ts'

export function primarySpellTransient(value: unknown, field: string): PrimarySpellTransientState {
  const source = record(value, field)
  const {
    painterRegistrations: painterRegistrationValue,
    ...payload
  } = source
  const decoded = primarySpellTransientPayload(payload, field)
  const contract = nativePrimaryPainterRegistrationContract(
    decoded as PrimarySpellTransientState,
  )
  return {
    ...decoded,
    painterRegistrations: nativeWorldPainterRegistrations(
      painterRegistrationValue,
      `${field}.painterRegistrations`,
      contract.managerLane,
      contract.count,
    ),
  } as PrimarySpellTransientState
}

function primarySpellTransientPayload(
  value: unknown,
  field: string,
): WithoutPainterRegistrations<PrimarySpellTransientState> {
  const source = record(value, field)
  if (source.kind === 'harden-burst') {
    onlyKeys(source, field, ['ageTicks', 'alpha', 'birthTick', 'id', 'kind', 'ownerId', 'position', 'worldKey'])
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      alpha: unitInterval(source.alpha, `${field}.alpha`),
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'harden-burst',
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      position: vector(source.position, `${field}.position`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'harden-shard') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'bounceVelocity', 'height', 'id', 'kind', 'life',
      'ownerId', 'position', 'record', 'rotationDegrees', 'rotationStepDegrees',
      'velocity', 'verticalVelocity', 'worldKey',
    ])
    const shardRecord = integer(source.record, `${field}.record`)
    if (shardRecord < 446 || shardRecord > 450) throw new GameProtocolError(`${field}.record is not Harden art`)
    const life = positiveFinite(source.life, `${field}.life`)
    if (life > 10) throw new GameProtocolError(`${field}.life exceeds the native Harden fragment timer`)
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      bounceVelocity: finite(source.bounceVelocity, `${field}.bounceVelocity`),
      height: finite(source.height, `${field}.height`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'harden-shard',
      life,
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      position: vector(source.position, `${field}.position`),
      record: shardRecord,
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      rotationStepDegrees: nonnegativeFinite(source.rotationStepDegrees, `${field}.rotationStepDegrees`),
      velocity: vector(source.velocity, `${field}.velocity`),
      verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'earth-boulder-bit') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'debris', 'id', 'kind', 'lightRegistration',
      'origin', 'ownerId', 'position', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the BoulderBit lifetime`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      debris: nativeWeldBoulderDebris(source.debris, `${field}.debris`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'earth-boulder-bit',
      lightRegistration: absentNativeActorLight(source, field),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      position: vector(source.position, `${field}.position`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    } satisfies PrimarySpellEarthBoulderBitState
  }
  if (source.kind === 'weld-boulder-debris'
    || source.kind === 'weld-blizzard-chain-frost'
    || source.kind === 'weld-blizzard-glow'
    || source.kind === 'weld-channel'
    || source.kind === 'weld-frost-fade'
    || source.kind === 'weld-flame-lash-fade'
    || source.kind === 'weld-ground-spark-fade'
    || source.kind === 'weld-hail-flash'
    || source.kind === 'weld-hail-knockback'
    || source.kind === 'weld-hail-line'
    || source.kind === 'weld-hail-rock-fade'
    || source.kind === 'weld-hail-terrain-bouncer'
    || source.kind === 'weld-hail-terrain-particle'
    || source.kind === 'weld-impact'
    || source.kind === 'weld-meteor'
    || source.kind === 'weld-meteor-flash'
    || source.kind === 'weld-meteor-marker'
    || source.kind === 'weld-persistent'
    || source.kind === 'weld-steam') {
    return primarySpellWeldActor(source, field)
  }
  if (isNativePlayerStaffTransient(source as { kind: string })) {
    return nativePlayerStaffTransient(source, field)
  }
  if (source.kind === 'air-hurricane') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'charge', 'contactCharge', 'damageMaximum',
      'damageMinimum', 'enhancedEffects', 'id', 'kind', 'lanes', 'ownerId',
      'phaseDegrees', 'position', 'worldKey',
    ])
    const charge = finite(source.charge, `${field}.charge`)
    if (charge <= 0 || charge > 1) {
      throw new GameProtocolError(`${field}.charge must be within (0,1]`)
    }
    const contactCharge = finite(source.contactCharge, `${field}.contactCharge`)
    if (contactCharge < 0 || contactCharge > charge) {
      throw new GameProtocolError(`${field}.contactCharge must be within [0,charge]`)
    }
    const damageMinimum = finite(source.damageMinimum, `${field}.damageMinimum`)
    const damageMaximum = finite(source.damageMaximum, `${field}.damageMaximum`)
    if (damageMinimum < 0 || damageMaximum < damageMinimum) {
      throw new GameProtocolError(`${field} has an invalid Hurricane damage range`)
    }
    const lanes = array(source.lanes, `${field}.lanes`)
    if (lanes.length !== 8) {
      throw new GameProtocolError(`${field}.lanes must contain eight native lanes`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      charge,
      contactCharge,
      damageMaximum,
      damageMinimum,
      enhancedEffects: boolean(source.enhancedEffects, `${field}.enhancedEffects`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'air-hurricane',
      lanes: lanes.map((value, index) => {
        const laneField = `${field}.lanes[${index}]`
        const lane = record(value, laneField)
        onlyKeys(lane, laneField, [
          'angleDegrees', 'angularVelocityDegrees', 'radius', 'verticalOffset',
        ])
        const radius = positiveFinite(lane.radius, `${laneField}.radius`)
        return {
          angleDegrees: finite(lane.angleDegrees, `${laneField}.angleDegrees`),
          angularVelocityDegrees: positiveFinite(
            lane.angularVelocityDegrees,
            `${laneField}.angularVelocityDegrees`,
          ),
          radius,
          verticalOffset: finite(lane.verticalOffset, `${laneField}.verticalOffset`),
        }
      }),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      phaseDegrees: finite(source.phaseDegrees, `${field}.phaseDegrees`),
      position: vector(source.position, `${field}.position`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'water-aura') {
    onlyKeys(source, field, [
      'ageTicks', 'alphaDecay', 'birthTick', 'durationTicks', 'id',
      'initialRotationDegrees', 'kind', 'origin', 'ownerId',
      'rotationStepDegrees', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    const alphaDecay = positiveFinite(source.alphaDecay, `${field}.alphaDecay`)
    const durationTicks = positiveInteger(source.durationTicks, `${field}.durationTicks`)
    if (ageTicks >= durationTicks) {
      throw new GameProtocolError(`${field}.ageTicks exceeds its native lifetime`)
    }
    return {
      ageTicks,
      alphaDecay,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      durationTicks,
      id: positiveInteger(source.id, `${field}.id`),
      initialRotationDegrees: finite(
        source.initialRotationDegrees,
        `${field}.initialRotationDegrees`,
      ),
      kind: 'water-aura',
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      rotationStepDegrees: finite(
        source.rotationStepDegrees,
        `${field}.rotationStepDegrees`,
      ),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'water-hail') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'bounceProgress', 'bounceSoundIndex',
      'bounceSoundPitch', 'bounceSoundSequence', 'height', 'horizontalVelocity',
      'id', 'kind', 'life', 'ownerId', 'position', 'rotationDegrees',
      'rotationStepDegrees', 'savedBounceVelocity', 'scale', 'verticalVelocity',
      'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= 134) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the native Hail lifecycle`)
    }
    const bounceProgress = finite(source.bounceProgress, `${field}.bounceProgress`)
    if (bounceProgress < 0 || bounceProgress > 1) {
      throw new GameProtocolError(`${field}.bounceProgress must be within [0,1]`)
    }
    const bounceSoundSequence = nonnegativeInteger(
      source.bounceSoundSequence,
      `${field}.bounceSoundSequence`,
    )
    const bounceSoundIndex = source.bounceSoundIndex === null
      ? null
      : nonnegativeInteger(source.bounceSoundIndex, `${field}.bounceSoundIndex`)
    if (bounceSoundIndex !== null && bounceSoundIndex > 3) {
      throw new GameProtocolError(`${field}.bounceSoundIndex must be within [0,3]`)
    }
    const bounceSoundPitch = source.bounceSoundPitch === null
      ? null
      : finiteWithin(
        source.bounceSoundPitch,
        `${field}.bounceSoundPitch`,
        NATIVE_HAIL_MINIMUM_BOUNCE_PITCH,
        NATIVE_HAIL_MAXIMUM_BOUNCE_PITCH,
      )
    if ((bounceSoundSequence === 0) !== (bounceSoundIndex === null)) {
      throw new GameProtocolError(`${field}.bounce sound payload is inconsistent`)
    }
    if ((bounceSoundIndex === null) !== (bounceSoundPitch === null)) {
      throw new GameProtocolError(`${field}.bounce sound fields must both be null or present`)
    }
    const height = finite(source.height, `${field}.height`)
    if (height < NATIVE_HAIL_MINIMUM_HEIGHT || height > 0) {
      throw new GameProtocolError(`${field}.height is outside the native Bouncer range`)
    }
    const life = finite(source.life, `${field}.life`)
    if (life <= 0 || life > NATIVE_HAIL_INITIAL_LIFE) {
      throw new GameProtocolError(`${field}.life is outside the native Hail lifecycle`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    const rotationStepDegrees = finite(
      source.rotationStepDegrees,
      `${field}.rotationStepDegrees`,
    )
    if (rotationStepDegrees < 0 || rotationStepDegrees > 11) {
      throw new GameProtocolError(`${field}.rotationStepDegrees is outside [0,11]`)
    }
    const savedBounceVelocity = finite(
      source.savedBounceVelocity,
      `${field}.savedBounceVelocity`,
    )
    if (savedBounceVelocity < -5 || savedBounceVelocity > 0) {
      throw new GameProtocolError(`${field}.savedBounceVelocity is outside [-5,0]`)
    }
    const scale = finiteWithin(
      source.scale, `${field}.scale`, NATIVE_HAIL_MINIMUM_SCALE, NATIVE_HAIL_MAXIMUM_SCALE,
    )
    const verticalVelocity = finite(source.verticalVelocity, `${field}.verticalVelocity`)
    if (verticalVelocity < -5 || verticalVelocity > 20) {
      throw new GameProtocolError(`${field}.verticalVelocity is outside the Bouncer range`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      bounceProgress,
      bounceSoundIndex,
      bounceSoundPitch,
      bounceSoundSequence,
      height,
      horizontalVelocity: vector(source.horizontalVelocity, `${field}.horizontalVelocity`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'water-hail',
      life,
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      position: vector(source.position, `${field}.position`),
      rotationDegrees,
      rotationStepDegrees,
      savedBounceVelocity,
      scale,
      verticalVelocity,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'earth-called-rock') {
    onlyKeys(source, field, [
      'ageTicks', 'fallVelocity', 'falling', 'height', 'id', 'kind',
      'lateralMagnitude', 'lightRegistration', 'ownerId', 'parentId', 'position', 'rotation',
      'rotationStep', 'scale', 'speed', 'targetHeight', 'variant', 'worldKey',
    ])
    const fallVelocity = finite(source.fallVelocity, `${field}.fallVelocity`)
    if (fallVelocity < 0) throw new GameProtocolError(`${field}.fallVelocity is negative`)
    const lateralMagnitude = finite(source.lateralMagnitude, `${field}.lateralMagnitude`)
    if (lateralMagnitude < 0 || lateralMagnitude > 4) {
      throw new GameProtocolError(`${field}.lateralMagnitude is outside [0,4]`)
    }
    const rotationStep = finite(source.rotationStep, `${field}.rotationStep`)
    if (rotationStep < -30 || rotationStep > 30) {
      throw new GameProtocolError(`${field}.rotationStep is outside [-30,30]`)
    }
    const scale = finite(source.scale, `${field}.scale`)
    if (scale < 0 || scale > 0.75 * 0.75) {
      throw new GameProtocolError(`${field}.scale exceeds the native called-rock range`)
    }
    const speed = finite(source.speed, `${field}.speed`)
    if (speed < 0 || speed > 5) {
      throw new GameProtocolError(`${field}.speed is outside [0,5]`)
    }
    const variant = nonnegativeInteger(source.variant, `${field}.variant`)
    if (variant > 2) throw new GameProtocolError(`${field}.variant exceeds the lit-rock bank`)
    const falling = boolean(source.falling, `${field}.falling`)
    if (!falling && fallVelocity !== 0) {
      throw new GameProtocolError(`${field}.fallVelocity must be zero before release`)
    }
    const id = positiveInteger(source.id, `${field}.id`)
    const parentId = positiveInteger(source.parentId, `${field}.parentId`)
    if (parentId >= id) {
      throw new GameProtocolError(`${field}.parentId must precede the called-rock identity`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      fallVelocity,
      falling,
      height: finite(source.height, `${field}.height`),
      id,
      kind: 'earth-called-rock',
      lateralMagnitude,
      lightRegistration: absentNativeActorLight(source, field),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      parentId,
      position: vector(source.position, `${field}.position`),
      rotation: finite(source.rotation, `${field}.rotation`),
      rotationStep,
      scale,
      speed,
      targetHeight: finite(source.targetHeight, `${field}.targetHeight`),
      variant,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'earth-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'charge', 'id', 'kind', 'origin', 'ownerId',
      'lightRegistration', 'lifetimeTicks', 'worldKey',
    ])
    const charge = finite(source.charge, `${field}.charge`)
    if (charge < 0 || charge > NATIVE_EARTH_BOULDER_MAXIMUM_CHARGE) {
      throw new GameProtocolError(
        `${field}.charge must be within [0,${NATIVE_EARTH_BOULDER_MAXIMUM_CHARGE}]`,
      )
    }
    const birthTick = nonnegativeInteger(source.birthTick, `${field}.birthTick`)
    const id = positiveInteger(source.id, `${field}.id`)
    const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
    const expectedLifetime = earthImpactLifetimeTicks({ birthTick, charge, id })
    if (lifetimeTicks !== expectedLifetime) {
      throw new GameProtocolError(`${field}.lifetimeTicks does not match the native recurrence`)
    }
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= lifetimeTicks) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the impact lifetime`)
    }
    return {
      ageTicks,
      birthTick,
      charge,
      id,
      kind: 'earth-impact',
      lightRegistration: absentNativeActorLight(source, field),
      lifetimeTicks,
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'ether-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'id', 'kind', 'lightRegistration', 'origin',
      'ownerId', 'visualScale',
      'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Ether impact lifetime`)
    }
    const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
    if (visualScale > 1) {
      throw new GameProtocolError(`${field}.visualScale exceeds one`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'ether-impact',
      lightRegistration: nativeWorldManagerRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      visualScale,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'ether-blast') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'charges', 'id', 'kind', 'origin', 'ownerId',
      'presentationRng', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Ether Blast lifetime`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      charges: boundedInteger(source.charges, `${field}.charges`, 1, 6),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'ether-blast',
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      presentationRng: nativeRngState(
        source.presentationRng,
        `${field}.presentationRng`,
      ),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-ember') {
    onlyKeys(source, field, [
      'ageTicks', 'burnDamage', 'contactCadence', 'contactDue', 'damage', 'height',
      'horizontalVelocity', 'id', 'kind', 'life', 'lightRegistration', 'ownerId',
      'phase', 'position',
      'spentEmber', 'verticalVelocity', 'worldKey',
    ])
    const phase = finite(source.phase, `${field}.phase`)
    if (phase < 0 || phase >= 4) {
      throw new GameProtocolError(`${field}.phase is outside [0,4)`)
    }
    const contactCadence = nonnegativeInteger(
      source.contactCadence,
      `${field}.contactCadence`,
    )
    if (contactCadence > 3) {
      throw new GameProtocolError(`${field}.contactCadence exceeds the native range`)
    }
    const life = positiveFinite(source.life, `${field}.life`)
    if (life > 3) {
      throw new GameProtocolError(`${field}.life is outside the live Ember interval`)
    }
    const height = finite(source.height, `${field}.height`)
    if (height > 0) throw new GameProtocolError(`${field}.height must not exceed the ground`)
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
      contactCadence,
      contactDue: boolean(source.contactDue, `${field}.contactDue`),
      damage: nonnegativeFinite(source.damage, `${field}.damage`),
      height,
      horizontalVelocity: vector(source.horizontalVelocity, `${field}.horizontalVelocity`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-ember',
      life,
      lightRegistration: nativeWorldManagerRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'actor',
      ),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      phase,
      position: vector(source.position, `${field}.position`),
      spentEmber: primarySpellFireSpentEmber(source.spentEmber, `${field}.spentEmber`),
      verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-explosion') {
    onlyKeys(source, field, [
      'ageTicks', 'burnDamage', 'damage', 'footprintDimension', 'id', 'kind',
      'lightRegistration', 'origin', 'ownerId', 'presentation', 'soundPitch',
      'visualScale', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Fire explosion lifetime`)
    }
    const soundPitch = positiveFinite(source.soundPitch, `${field}.soundPitch`)
    if (soundPitch < Math.fround(0.9) || soundPitch > Math.fround(1.1)) {
      throw new GameProtocolError(`${field}.soundPitch is outside the native range`)
    }
    const presentation = source.presentation
    if (presentation !== 'fire' && presentation !== 'steam') {
      throw new GameProtocolError(`${field}.presentation is not a native explosion family`)
    }
    return {
      ageTicks,
      burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
      damage: presentation === 'steam'
        ? nonnegativeFinite(source.damage, `${field}.damage`)
        : positiveFinite(source.damage, `${field}.damage`),
      footprintDimension: positiveFinite(
        source.footprintDimension,
        `${field}.footprintDimension`,
      ),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-explosion',
      lightRegistration: nativeWorldManagerRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      presentation,
      soundPitch,
      visualScale: positiveFinite(source.visualScale, `${field}.visualScale`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-good-imp') {
    onlyKeys(source, field, [
      'ageTicks', 'bodyRotationDeg', 'bodyScale', 'bodyVariant',
      'bounceSoundIndex', 'bounceSoundPitch', 'bounceSoundSequence', 'burnDamage',
      'collisionRadius', 'contactAgeTicks', 'contactOrigin', 'contactScale',
      'contactSoundIndex', 'contactSoundPitch', 'contactSoundSequence', 'damage',
      'effectAlpha', 'effectPhase', 'flightSpeed', 'headingDegrees',
      'id', 'kind', 'lightGlow', 'lightRegistration', 'nextTargetRefreshTick',
      'ownerId', 'path', 'position', 'remainingTicks', 'targetId',
      'verticalOffset', 'verticalVelocity', 'worldKey',
    ])
    const bodyVariant = nonnegativeInteger(source.bodyVariant, `${field}.bodyVariant`)
    if (bodyVariant >= 4) {
      throw new GameProtocolError(`${field}.bodyVariant is outside the native pose banks`)
    }
    const bounceSoundIndex = nonnegativeInteger(
      source.bounceSoundIndex,
      `${field}.bounceSoundIndex`,
    )
    if (bounceSoundIndex >= 8) {
      throw new GameProtocolError(`${field}.bounceSoundIndex exceeds the Imp sound bank`)
    }
    const bounceSoundPitch = positiveFinite(
      source.bounceSoundPitch,
      `${field}.bounceSoundPitch`,
    )
    if (bounceSoundPitch < 1 || bounceSoundPitch > Math.fround(1.1)) {
      throw new GameProtocolError(`${field}.bounceSoundPitch is outside the native range`)
    }
    const contactSoundIndex = nonnegativeInteger(
      source.contactSoundIndex,
      `${field}.contactSoundIndex`,
    )
    if (contactSoundIndex >= 3) {
      throw new GameProtocolError(`${field}.contactSoundIndex exceeds the Bite sound bank`)
    }
    const contactSoundPitch = positiveFinite(
      source.contactSoundPitch,
      `${field}.contactSoundPitch`,
    )
    if (contactSoundPitch < 1 || contactSoundPitch > 1.25) {
      throw new GameProtocolError(`${field}.contactSoundPitch is outside the native range`)
    }
    const effectAlpha = nonnegativeFinite(source.effectAlpha, `${field}.effectAlpha`)
    if (effectAlpha > 1) {
      throw new GameProtocolError(`${field}.effectAlpha exceeds one`)
    }
    const effectPhase = nonnegativeFinite(source.effectPhase, `${field}.effectPhase`)
    if (effectPhase >= 10) {
      throw new GameProtocolError(`${field}.effectPhase exceeds the native frame bank`)
    }
    const lightGlow = nonnegativeFinite(source.lightGlow, `${field}.lightGlow`)
    if (lightGlow > 1) {
      throw new GameProtocolError(`${field}.lightGlow exceeds one`)
    }
    const contactAgeTicks = source.contactAgeTicks === null
      ? null
      : nonnegativeInteger(source.contactAgeTicks, `${field}.contactAgeTicks`)
    if (contactAgeTicks !== null && contactAgeTicks >= NATIVE_GOOD_IMP_CONTACT_VISIBLE_TICKS) {
      throw new GameProtocolError(`${field}.contactAgeTicks exceeds the native contact lifetime`)
    }
    const contactOrigin = source.contactOrigin === null
      ? null
      : vector(source.contactOrigin, `${field}.contactOrigin`)
    if ((contactAgeTicks === null) !== (contactOrigin === null)) {
      throw new GameProtocolError(`${field} contact age and origin must be present together`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      bodyRotationDeg: finite(source.bodyRotationDeg, `${field}.bodyRotationDeg`),
      bodyScale: positiveFinite(source.bodyScale, `${field}.bodyScale`),
      bodyVariant,
      bounceSoundIndex,
      bounceSoundPitch,
      bounceSoundSequence: nonnegativeInteger(
        source.bounceSoundSequence,
        `${field}.bounceSoundSequence`,
      ),
      burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
      collisionRadius: nonnegativeFinite(source.collisionRadius, `${field}.collisionRadius`),
      contactAgeTicks,
      contactOrigin,
      contactScale: positiveFinite(source.contactScale, `${field}.contactScale`),
      contactSoundIndex,
      contactSoundPitch,
      contactSoundSequence: nonnegativeInteger(
        source.contactSoundSequence,
        `${field}.contactSoundSequence`,
      ),
      damage: positiveFinite(source.damage, `${field}.damage`),
      effectAlpha,
      effectPhase,
      flightSpeed: positiveFinite(source.flightSpeed, `${field}.flightSpeed`),
      headingDegrees: finite(source.headingDegrees, `${field}.headingDegrees`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-good-imp',
      lightGlow,
      lightRegistration: nativeWorldManagerRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'actor',
      ),
      nextTargetRefreshTick: nonnegativeInteger(
        source.nextTargetRefreshTick,
        `${field}.nextTargetRefreshTick`,
      ),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      path: nativeEnemyPathState(source.path, `${field}.path`),
      position: vector(source.position, `${field}.position`),
      remainingTicks: positiveInteger(source.remainingTicks, `${field}.remainingTicks`),
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      verticalOffset: finite(source.verticalOffset, `${field}.verticalOffset`),
      verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-patch') {
    onlyKeys(source, field, [
      'ageTicks', 'atlasPhase', 'atlasPhaseStep', 'burnDamage', 'damage',
      'drawAlpha', 'fadeAlpha', 'id', 'kind', 'life', 'nativeType', 'ownerId',
      'position', 'scale', 'horizontalSign',
      'supplementalContact', 'velocity', 'velocityMultiplier', 'worldKey',
    ])
    if (
      source.nativeType !== 'fire'
      && source.nativeType !== 'goodguy'
      && source.nativeType !== 'moving'
    ) {
      throw new GameProtocolError(`${field}.nativeType is not a Fire patch type`)
    }
    const fadeAlpha = finite(source.fadeAlpha, `${field}.fadeAlpha`)
    if (fadeAlpha < 0 || fadeAlpha > 1) {
      throw new GameProtocolError(`${field}.fadeAlpha is outside [0,1]`)
    }
    const atlasPhase = finite(source.atlasPhase, `${field}.atlasPhase`)
    if (atlasPhase < 0 || atlasPhase >= 32) {
      throw new GameProtocolError(`${field}.atlasPhase is outside [0,32)`)
    }
    const horizontalSign = finite(source.horizontalSign, `${field}.horizontalSign`)
    if (horizontalSign !== -1 && horizontalSign !== 1) {
      throw new GameProtocolError(`${field}.horizontalSign must be -1 or 1`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      atlasPhase,
      atlasPhaseStep: nonnegativeFinite(
        source.atlasPhaseStep,
        `${field}.atlasPhaseStep`,
      ),
      burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
      damage: nonnegativeFinite(source.damage, `${field}.damage`),
      drawAlpha: nonnegativeFinite(source.drawAlpha, `${field}.drawAlpha`),
      fadeAlpha,
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-patch',
      life: positiveFinite(source.life, `${field}.life`),
      nativeType: source.nativeType,
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      position: vector(source.position, `${field}.position`),
      scale: positiveFinite(source.scale, `${field}.scale`),
      horizontalSign,
      supplementalContact: boolean(
        source.supplementalContact,
        `${field}.supplementalContact`,
      ),
      velocity: vector(source.velocity, `${field}.velocity`),
      velocityMultiplier: vector(
        source.velocityMultiplier,
        `${field}.velocityMultiplier`,
      ),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'id', 'kind', 'lightRegistration', 'origin', 'ownerId', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_FIRE_IMPACT_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Fire impact lifetime`)
    }
    return {
      ageTicks,
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-impact',
      lightRegistration: nativeWorldManagerRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'ether-pierce-streak') {
    onlyKeys(source, field, [
      'ageTicks', 'headingDegrees', 'id', 'kind', 'origin', 'ownerId',
      'visualScale', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= 10) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Ether streak lifetime`)
    }
    const headingDegrees = finite(source.headingDegrees, `${field}.headingDegrees`)
    if (headingDegrees < 0 || headingDegrees >= 360) {
      throw new GameProtocolError(`${field}.headingDegrees is outside [0,360)`)
    }
    const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
    if (visualScale > 1) {
      throw new GameProtocolError(`${field}.visualScale exceeds one`)
    }
    return {
      ageTicks,
      headingDegrees,
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'ether-pierce-streak',
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      visualScale,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  const transientKeys = [
    'ageTicks', 'direction', 'id', 'kind', 'lightRegistration', 'origin', 'ownerId', 'variant',
    'worldKey',
  ]
  onlyKeys(
    source,
    field,
    source.kind === 'water'
      ? [...transientKeys, 'obstructionDistance', 'obstructionPoint', 'speed', 'underpowered']
      : source.kind === 'air'
        ? [
            ...transientKeys,
            'birthTick',
            'endpoint',
            'hurricaneCharge',
            'midpoint',
            'targetId',
            'underpowered',
          ]
      : transientKeys,
  )
  if (source.kind !== 'air' && source.kind !== 'fire' && source.kind !== 'water') {
    throw new GameProtocolError(`${field}.kind is not a transient primary`)
  }
  const id = positiveInteger(source.id, `${field}.id`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const variant = nonnegativeInteger(source.variant, `${field}.variant`)
  if (source.kind !== 'water' && variant > 3) {
    throw new GameProtocolError(`${field}.variant exceeds the native family`)
  }
  if (source.kind === 'fire') {
    if (variant !== nativeFireParticleVariant(id)) {
      throw new GameProtocolError(`${field}.variant does not match its Fire particle id`)
    }
    if (ageTicks >= nativeFireParticleLifetimeTicks(id)) {
      throw new GameProtocolError(`${field}.ageTicks exceeds its Fire particle lifetime`)
    }
  }
  const common = {
    ageTicks,
    direction: unitVector(source.direction, `${field}.direction`),
    id,
    origin: vector(source.origin, `${field}.origin`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    variant,
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
  if (source.kind === 'water') {
    const underpowered = boolean(source.underpowered, `${field}.underpowered`)
    if (variant >= WATER_FROST_MAX_PARTICLES_PER_TICK) {
      throw new GameProtocolError(`${field}.variant exceeds the Frost emission ordinal`)
    }
    if (underpowered && variant !== 0) {
      throw new GameProtocolError(`${field}.variant exceeds the weak Frost emission ordinal`)
    }
    if (ageTicks < 1 || ageTicks >= waterFrostJetLifetimeTicks(id)) {
      throw new GameProtocolError(`${field}.ageTicks is outside its visible Frost lifetime`)
    }
    const obstructionPoint = source.obstructionPoint === null
      ? null
      : vector(source.obstructionPoint, `${field}.obstructionPoint`)
    const obstructionDistance = source.obstructionDistance === null
      ? null
      : nonnegativeFinite(source.obstructionDistance, `${field}.obstructionDistance`)
    if ((obstructionPoint === null) !== (obstructionDistance === null)) {
      throw new GameProtocolError(
        `${field}.obstructionPoint and obstructionDistance must be present together`,
      )
    }
    if (waterFrostJetKind(id, underpowered) === 'over' && obstructionPoint !== null) {
      throw new GameProtocolError(`${field} Over particles cannot own obstruction state`)
    }
    const speed = positiveFinite(source.speed, `${field}.speed`)
    if (speed < WATER_FROST_MINIMUM_SPEED || speed > WATER_FROST_MAXIMUM_SPEED) {
      throw new GameProtocolError(`${field}.speed is outside the authored Frost range`)
    }
    return {
      ...common,
      kind: 'water',
      lightRegistration: absentNativeActorLight(source, field),
      obstructionDistance,
      obstructionPoint,
      speed,
      underpowered,
    }
  }
  if (source.kind === 'air') {
    const underpowered = boolean(source.underpowered, `${field}.underpowered`)
    const lifetimeTicks = underpowered
      ? PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS
      : PRIMARY_SPELL_AIR_LIFETIME_TICKS
    if (ageTicks >= lifetimeTicks) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Air contact lifetime`)
    }
    const hurricaneCharge = finite(source.hurricaneCharge, `${field}.hurricaneCharge`)
    if (hurricaneCharge < 0 || hurricaneCharge > 1) {
      throw new GameProtocolError(`${field}.hurricaneCharge must be within [0,1]`)
    }
    return {
      ...common,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      endpoint: vector(source.endpoint, `${field}.endpoint`),
      hurricaneCharge,
      kind: 'air',
      lightRegistration: nativeWorldManagerRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      midpoint: vector(source.midpoint, `${field}.midpoint`),
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      underpowered,
    }
  }
  return {
    ...common,
    kind: source.kind,
    lightRegistration: absentNativeActorLight(source, field),
  }
}
