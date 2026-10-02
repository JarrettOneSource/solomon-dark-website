import type { NativeSecondaryActorKind, NativeSecondaryActorState, NativeSecondaryGolemState } from '../../core-kernels/native-secondary-abilities.ts'
import { NATIVE_MINDBLAST_BURST_LIFETIME_TICKS, NATIVE_MINDBLAST_SHOCKWAVE_GROWTH, NATIVE_MINDBLAST_SHOCKWAVE_LIFETIME_TICKS, NATIVE_SECONDARY_ACTOR_KINDS, nativeSecondaryLightDisposition, nativeSecondaryPainterManagerLane } from '../../core-kernels/native-secondary-abilities.ts'
import type { NativeSecondaryAbilityId } from '../../core-kernels/native-secondary-ability-contract.ts'
import { nativeEtherDrainTargetKey, nativeEtherDrainWorldAnimationKey, type NativeEtherDrainAnimation, type NativeEtherDrainTargetRef, type NativeEtherDrainState, type NativeEtherDrainWorldAnimationRef } from '../../core-kernels/native-ether-drain.ts'
import { NATIVE_GOLEM_DEATH_FRAGMENT_COUNT, NATIVE_GOLEM_DEATH_MAX_AGE, NATIVE_GOLEM_DEATH_PAINTER_COUNT } from '../../core-kernels/native-death-animations.ts'
import { nativeGolemDeathAnimation } from './death-animations.ts'
import { NATIVE_SECONDARY_ABILITY_IDS } from '../../core-kernels/native-secondary-ability-contract.ts'
import { MAX_BONEYARD_ENEMIES, MAX_BONEYARD_ENEMY_DEATH_EFFECTS, MAX_BONEYARD_LOOT, MAX_BONEYARD_MAGGOTS, MAX_BONEYARD_OBJECTS, MAX_PLAYERS, MAX_PRIMARY_SPELL_HIT_TARGETS, MAX_PRIMARY_SPELL_TRANSIENTS, MAX_SECONDARY_ACTORS } from '../game-protocol-limits.ts'
import type { ProtocolPlayerSnapshotFrame } from '../game-state.ts'
import { absentNativeActorLight, nativeRngState, nativeWorldManagerRegistration, nativeWorldPainterRegistrations, vector } from './native-state.ts'
import { GameProtocolError, boolean, boundedInteger, finite, limitedArray, limitedString, memberString, nonnegativeFinite, nonnegativeInteger, onlyKeys, positiveFinite, positiveInteger, record, unitInterval, validatedPlayerId } from './values.ts'
export function nativeSecondaryActor(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
): NativeSecondaryActorState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks', 'alpha', 'damage', 'enhanced', 'endpoint', 'frame', 'freezeTicks',
    'golem', 'hitTargetIds', 'id', 'kind', 'lifetimeTicks', 'lightRegistration',
    'midpoint', 'miscLightAppendOrdinal', 'ownerId', 'phase', 'position', 'presentationRng',
    'painterRegistrations', 'quantity', 'radius', 'rank', 'rotationRadians', 'scale', 'skillId',
    'slowFactor', 'targetId', 'variant', 'velocity', 'worldKey',
    ...(source.kind === 'ether-drain' ? ['etherDrain'] : []),
    ...(source.kind === 'golem-death' ? ['golemDeath'] : []),
  ])
  const kind = memberString(
    source.kind,
    `${field}.kind`,
    NATIVE_SECONDARY_ACTOR_KINDS,
  ) as NativeSecondaryActorKind
  const ownerId = validatedPlayerId(source.ownerId, `${field}.ownerId`)
  if (!players[ownerId] && kind !== 'golem-death') throw new GameProtocolError(`${field}.ownerId has no player snapshot`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
  if (ageTicks >= lifetimeTicks) {
    throw new GameProtocolError(`${field}.ageTicks is outside the live lifetime`)
  }
  const hitTargetIds = limitedArray(
    source.hitTargetIds,
    `${field}.hitTargetIds`,
    MAX_PRIMARY_SPELL_HIT_TARGETS,
  ).map((targetId, index) => nonnegativeInteger(
    targetId,
    `${field}.hitTargetIds[${index}]`,
  ))
  const duplicateHitTargetIds = new Set(hitTargetIds).size !== hitTargetIds.length
  const unsortedHitTargetIds = hitTargetIds.some((id, index) => (
    index > 0 && id < hitTargetIds[index - 1]!
  ))
  if (duplicateHitTargetIds || (kind !== 'earthquake' && unsortedHitTargetIds)) {
    throw new GameProtocolError(
      `${field}.hitTargetIds must be unique; only Earthquake preserves pointer-list order`,
    )
  }
  const targetId = source.targetId === null
    ? null
    : nonnegativeInteger(source.targetId, `${field}.targetId`)
  const golem = source.golem === null
    ? null
    : nativeSecondaryGolemState(source.golem, `${field}.golem`)
  if ((kind === 'golem') !== (golem !== null)) {
    throw new GameProtocolError(`${field}.golem must exist exactly for Golem actors`)
  }
  const variant = nonnegativeInteger(source.variant, `${field}.variant`)
  const presentationRng = source.presentationRng === null
    ? null
    : nativeRngState(source.presentationRng, `${field}.presentationRng`)
  const skillId = source.skillId === null
    ? null
    : source.skillId === 14 && (
        kind === 'ether-burn' || kind === 'ether-burn-flare'
      )
      ? 14
    : source.skillId === 22 && (kind === 'fire-burn' || kind === 'fire-burn-flame')
      ? 22
      : source.skillId === 53 && (
          kind === 'flash-response-fade' || kind === 'flash-response-grow'
        )
        ? 53
      : nativeSecondarySkillId(source.skillId, `${field}.skillId`)
  const mindblast = kind === 'mindblast-burst' || kind === 'mindblast-shockwave'
  if (kind !== 'electric-burn-flare' && kind !== 'electric-burn-arc' && mindblast !== (skillId === null)) {
    throw new GameProtocolError(`${field}.skillId must be null exactly for Mindblast or primary-origin ElectricBurn flares`)
  }
  if (kind === 'electric-burn-flare' || kind === 'electric-burn-arc') {
    if (skillId !== null || source.damage !== 0 || source.freezeTicks !== 0 || source.golem !== null
      || source.velocity === null || source.hitTargetIds === null) {
      throw new GameProtocolError(`${field} must retain primary-origin ElectricBurn presentation ownership`)
    }
    if (kind === 'electric-burn-flare') {
      const decay = Math.fround(boolean(source.enhanced, `${field}.enhanced`) ? .2 : .4)
      const initial = finite(source.quantity, `${field}.quantity`)
      if ((initial !== .5 && initial !== .75) || source.phase !== decay
        || lifetimeTicks !== Math.ceil(initial / decay) || ageTicks >= lifetimeTicks) {
        throw new GameProtocolError(`${field} violates its born ElectricBurn fade contract`)
      }
      let expectedAlpha = initial
      for (let age = 0; age < ageTicks; age++) expectedAlpha = Math.fround(expectedAlpha - decay)
      if (source.alpha !== expectedAlpha || typeof source.scale !== 'number' || source.scale < 1 || source.scale > 1.5
        || typeof source.radius !== 'number' || source.radius < .75 || source.radius > 1.5) {
        throw new GameProtocolError(`${field} violates final ElectricBurn corona values`)
      }
    } else if (lifetimeTicks !== 2 || ageTicks >= 2 || !Number.isSafeInteger(source.phase) || (source.phase as number) < 0) {
      throw new GameProtocolError(`${field} violates its native ElectricBurn body lifetime`)
    }
  }
  if (kind === 'planewalker-mote' || kind === 'stoneskin-chip') {
    if (skillId !== (kind === 'planewalker-mote' ? 12 : 46) || source.damage !== 0
      || source.freezeTicks !== 0 || source.golem !== null || lifetimeTicks !== 1000) {
      throw new GameProtocolError(`${field} violates its native player presentation owner`)
    }
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    if (kind === 'stoneskin-chip') {
      if (source.frame !== 77 || source.scale !== 1 || (source.variant !== 0 && source.variant !== 1)
        || alpha > (source.variant === 1 && source.enhanced === true ? 10 : 2)) {
        throw new GameProtocolError(`${field} violates its native Stoneskin fragment`)
      }
    } else {
      const enhanced = boolean(source.enhanced, `${field}.enhanced`)
      const low = Math.fround(Math.fround(.1) * Math.fround(enhanced ? .15 : .25))
      const high = Math.fround(Math.fround(.1) * Math.fround(enhanced ? .3 : .45))
      const decay = positiveFinite(source.phase, `${field}.phase`)
      const scale = positiveFinite(source.scale, `${field}.scale`)
      if (source.frame !== 11 || alpha > 1 || decay < low || decay > high || scale < .5 || scale > 1) {
        throw new GameProtocolError(`${field} violates its born Planewalker fade`)
      }
    }
  }
  if (kind === 'golem-death' || kind === 'golem-assembly-debris') {
    const enhanced = boolean(source.enhanced, `${field}.enhanced`)
    const expectedLifetime = kind === 'golem-death' ? enhanced ? NATIVE_GOLEM_DEATH_MAX_AGE.on : NATIVE_GOLEM_DEATH_MAX_AGE.off : enhanced ? 400 : 80
    if (skillId !== 45 || source.damage !== 0 || lifetimeTicks !== expectedLifetime || ageTicks >= lifetimeTicks) {
      throw new GameProtocolError(`${field} violates the Golem born-quality lifetime`)
    }
    if (kind === 'golem-death' && presentationRng !== null) throw new GameProtocolError(`${field} retains an obsolete renderer replay seed`)
    if (kind === 'golem-assembly-debris' && (
      source.frame !== 2008 && source.frame !== 2009 && source.frame !== 2010
      || positiveFinite(source.alpha, `${field}.alpha`) > (enhanced ? 10 : 2)
      || positiveFinite(source.scale, `${field}.scale`) > .488
      || !Number.isInteger(source.quantity) || (source.quantity as number) < 0 || (source.quantity as number) > 23
    )) throw new GameProtocolError(`${field} violates the native Golem BoulderBit constructor`)
  }
  if (mindblast && variant > 4) {
    throw new GameProtocolError(`${field}.variant is not a native Wizard element`)
  }
  if (kind === 'mindblast-burst') {
    if (
      lifetimeTicks !== NATIVE_MINDBLAST_BURST_LIFETIME_TICKS
      || presentationRng === null
      || (
        source.scale !== 9
        && !(source.scale === 15 && source.rank === 10_000)
      )
    ) {
      throw new GameProtocolError(`${field} violates the native Mindblast burst contract`)
    }
  }
  if (kind === 'mindblast-shockwave') {
    if (
      lifetimeTicks !== NATIVE_MINDBLAST_SHOCKWAVE_LIFETIME_TICKS
      || presentationRng !== null
      || source.quantity !== NATIVE_MINDBLAST_SHOCKWAVE_GROWTH
    ) {
      throw new GameProtocolError(`${field} violates the native Mindblast Shockwave contract`)
    }
  }
  const lightDisposition = nativeSecondaryLightDisposition({ kind, variant })
  const lightRegistration = lightDisposition === 'none'
    ? absentNativeActorLight(source, field)
    : nativeWorldManagerRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        lightDisposition === 'transient-provider' ? 'transient' : 'actor',
      )
  const painterRegistrations = nativeWorldPainterRegistrations(
    source.painterRegistrations,
    `${field}.painterRegistrations`,
    nativeSecondaryPainterManagerLane(kind),
    kind === 'golem-death' ? NATIVE_GOLEM_DEATH_PAINTER_COUNT : 1,
  )
  let miscLightAppendOrdinal: number | null = null
  if (lightDisposition === 'misc') {
    miscLightAppendOrdinal = nonnegativeInteger(
      source.miscLightAppendOrdinal,
      `${field}.miscLightAppendOrdinal`,
    )
  } else if (source.miscLightAppendOrdinal !== null) {
    throw new GameProtocolError(`${field}.miscLightAppendOrdinal must be null`)
  }
  return {
    ...(kind === 'golem-death' ? { golemDeath: nativeGolemDeathAnimation(source.golemDeath, `${field}.golemDeath`, boolean(source.enhanced, `${field}.enhanced`)) } : {}),
    ...(kind === 'ether-drain' ? {
      etherDrain: source.etherDrain === null ? null
        : nativeEtherDrainState(source.etherDrain, `${field}.etherDrain`),
    } : {}),
    ageTicks,
    alpha: nonnegativeFinite(source.alpha, `${field}.alpha`),
    damage: nonnegativeFinite(source.damage, `${field}.damage`),
    enhanced: boolean(source.enhanced, `${field}.enhanced`),
    endpoint: vector(source.endpoint, `${field}.endpoint`),
    frame: nonnegativeFinite(source.frame, `${field}.frame`),
    freezeTicks: nonnegativeInteger(source.freezeTicks, `${field}.freezeTicks`),
    golem,
    hitTargetIds,
    id: positiveInteger(source.id, `${field}.id`),
    kind,
    lifetimeTicks,
    lightRegistration,
    midpoint: vector(source.midpoint, `${field}.midpoint`),
    miscLightAppendOrdinal,
    ownerId,
    painterRegistrations,
    phase: finite(source.phase, `${field}.phase`),
    position: vector(source.position, `${field}.position`),
    presentationRng,
    quantity: finite(source.quantity, `${field}.quantity`),
    radius: nonnegativeFinite(source.radius, `${field}.radius`),
    rank: positiveInteger(source.rank, `${field}.rank`),
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: nonnegativeFinite(source.scale, `${field}.scale`),
    skillId,
    slowFactor: finite(source.slowFactor, `${field}.slowFactor`),
    targetId,
    variant,
    velocity: vector(source.velocity, `${field}.velocity`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }

}

export function nativeEtherDrainState(value: unknown, field: string): NativeEtherDrainState {
  const source = record(value, field)
  onlyKeys(source, field, ['animations', 'targetsInitialized', 'lastLootRegistrationOrdinal', 'loose', 'queried', 'scenery', 'worldAnimationRefs', 'lastWorldAnimationIds'])
  const readRefs = (value: unknown, name: 'loose' | 'queried', maximum: number) => {
    const refs = limitedArray(value, `${field}.${name}`, maximum).map((value, index): NativeEtherDrainTargetRef => {
      const path = `${field}.${name}[${index}]`
      const ref = record(value, path)
      const kind = memberString(ref.kind, `${path}.kind`, ['enemy', 'golem', 'loot', 'player'] as const)
      if ((name === 'loose') !== (kind === 'loot')) throw new GameProtocolError(`${path} is in the wrong field target lane`)
      onlyKeys(ref, path, kind === 'enemy' || kind === 'loot' ? ['kind', 'id', 'registrationOrdinal'] : ['kind', 'id'])
      if (kind === 'player') return { kind, id: validatedPlayerId(ref.id, `${path}.id`) }
      const id = positiveInteger(ref.id, `${path}.id`)
      if (kind === 'golem') return { kind, id }
      return { kind, id, registrationOrdinal: nonnegativeInteger(ref.registrationOrdinal, `${path}.registrationOrdinal`) }
    })
    if (new Set(refs.map(nativeEtherDrainTargetKey)).size !== refs.length) {
      throw new GameProtocolError(`${field}.${name} contains duplicate target references`)
    }
    return Object.freeze(refs)
  }
  const loose = readRefs(source.loose, 'loose', MAX_BONEYARD_LOOT)
  const queried = readRefs(source.queried, 'queried', MAX_BONEYARD_ENEMIES + MAX_BONEYARD_MAGGOTS + MAX_PLAYERS + MAX_SECONDARY_ACTORS)
  const lastLootRegistrationOrdinal = boundedInteger(source.lastLootRegistrationOrdinal,
    `${field}.lastLootRegistrationOrdinal`, -1, Number.MAX_SAFE_INTEGER)
  if (loose.some(ref => ref.kind === 'loot' && ref.registrationOrdinal > lastLootRegistrationOrdinal)) {
    throw new GameProtocolError(`${field} has a loose target beyond its registration cursor`)
  }
  // At most one leaf per retained scenery object and one free child per field
  // tick; the constructor bounds the complete field lifetime to 1061 ticks.
  const animations = limitedArray(source.animations, `${field}.animations`, (MAX_BONEYARD_OBJECTS + 1) * 1061 + 1)
    .map((value, index): NativeEtherDrainAnimation => {
      const path = `${field}.animations[${index}]`
      const animation = record(value, path)
      if (animation.kind === 'debris') {
        onlyKeys(animation, path, ['kind', 'position', 'direction', 'remainingDistance', 'speed', 'oscillationDegrees', 'rotationDegrees', 'variant'])
        return { kind: 'debris', position: vector(animation.position, `${path}.position`),
          direction: vector(animation.direction, `${path}.direction`),
          remainingDistance: positiveFinite(animation.remainingDistance, `${path}.remainingDistance`),
          speed: positiveFinite(animation.speed, `${path}.speed`),
          oscillationDegrees: finite(animation.oscillationDegrees, `${path}.oscillationDegrees`),
          rotationDegrees: finite(animation.rotationDegrees, `${path}.rotationDegrees`),
          variant: boundedInteger(animation.variant, `${path}.variant`, 0, 2) as 0 | 1 | 2,
        }
      }
      if (animation.kind !== 'captured') throw new GameProtocolError(`${path}.kind is not a field animation`)
      onlyKeys(animation, path, ['kind', 'alpha', 'atlas', 'entry', 'tint', 'bodyYOffset'])
      const atlas = memberString(animation.atlas, `${path}.atlas`, ['BadGuys', 'Demon'] as const)
      const entry = positiveInteger(animation.entry, `${path}.entry`)
      if (atlas === 'BadGuys' ? !((entry >= 1477 && entry <= 1584) || (entry >= 2293 && entry <= 2346))
        : entry < 80 || entry > 97) throw new GameProtocolError(`${path}.entry is outside native capture art`)
      const alpha = positiveFinite(animation.alpha, `${path}.alpha`)
      if (alpha > 1.25) throw new GameProtocolError(`${path}.alpha exceeds its capture birth`)
      const bodyYOffset = atlas === 'BadGuys' && entry <= 1584 ? 23 : 0
      if (animation.bodyYOffset !== bodyYOffset) throw new GameProtocolError(`${path}.bodyYOffset does not match its native capture art`)
      return { kind: 'captured', alpha, atlas, entry, bodyYOffset,
        tint: boundedInteger(animation.tint, `${path}.tint`, 0, 0xffffff) }
    })
  if (animations.filter(animation => animation.kind === 'captured').length > 1) {
    throw new GameProtocolError(`${field}.animations has multiple captured images after a replacement`)
  }
  const scenery = limitedArray(source.scenery, `${field}.scenery`, MAX_BONEYARD_OBJECTS)
    .map((id, index) => nonnegativeInteger(id, `${field}.scenery[${index}]`))
  if (new Set(scenery).size !== scenery.length) throw new GameProtocolError(`${field}.scenery contains duplicate references`)
  const animationKinds = ['enemy-death-effect', 'primary-transient', 'secondary-actor', 'death-weapon', 'golem-fragment'] as const
  const savedIds = record(source.lastWorldAnimationIds, `${field}.lastWorldAnimationIds`)
  onlyKeys(savedIds, `${field}.lastWorldAnimationIds`, animationKinds)
  const lastWorldAnimationIds = {
    'enemy-death-effect': nonnegativeInteger(savedIds['enemy-death-effect'], `${field}.lastWorldAnimationIds.enemy-death-effect`),
    'primary-transient': nonnegativeInteger(savedIds['primary-transient'], `${field}.lastWorldAnimationIds.primary-transient`),
    'secondary-actor': nonnegativeInteger(savedIds['secondary-actor'], `${field}.lastWorldAnimationIds.secondary-actor`),
    'death-weapon': nonnegativeInteger(savedIds['death-weapon'], `${field}.lastWorldAnimationIds.death-weapon`),
    'golem-fragment': nonnegativeInteger(savedIds['golem-fragment'], `${field}.lastWorldAnimationIds.golem-fragment`),
  }
  const worldAnimationRefs = limitedArray(source.worldAnimationRefs, `${field}.worldAnimationRefs`,
    MAX_BONEYARD_ENEMY_DEATH_EFFECTS * 2 + MAX_PRIMARY_SPELL_TRANSIENTS + MAX_SECONDARY_ACTORS * NATIVE_GOLEM_DEATH_PAINTER_COUNT).map((value, index): NativeEtherDrainWorldAnimationRef => {
      const path = `${field}.worldAnimationRefs[${index}]`
      const ref = record(value, path)
      const kind = memberString(ref.kind, `${path}.kind`, animationKinds)
      onlyKeys(ref, path, kind === 'golem-fragment' ? ['kind', 'id', 'index'] : ['kind', 'id'])
      const id = positiveInteger(ref.id, `${path}.id`)
      if (id > lastWorldAnimationIds[kind]) throw new GameProtocolError(`${path} is beyond its animation registration cursor`)
      return kind === 'golem-fragment' ? { kind, id, index: boundedInteger(ref.index, `${path}.index`, 0, NATIVE_GOLEM_DEATH_FRAGMENT_COUNT - 1) } : { kind, id }
    })
  if (new Set(worldAnimationRefs.map(nativeEtherDrainWorldAnimationKey)).size !== worldAnimationRefs.length) {
    throw new GameProtocolError(`${field}.worldAnimationRefs contains duplicate references`)
  }
  return { animations: Object.freeze(animations), targetsInitialized: boolean(source.targetsInitialized, `${field}.targetsInitialized`),
    lastLootRegistrationOrdinal, loose, queried, scenery: Object.freeze(scenery),
    worldAnimationRefs: Object.freeze(worldAnimationRefs), lastWorldAnimationIds }
}

function nativeSecondaryGolemState(
  value: unknown,
  field: string,
): NativeSecondaryGolemState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionDurationTicks', 'actionHeadingOffsetDegrees', 'actionTick',
    'circleSlowTicks', 'currentHealth', 'damageMaximum', 'gaitTick', 'iron',
    'leftConnectorOffset', 'leftFoot', 'leftFootBob', 'leftFootNext',
    'leftFootPrevious', 'leftFootProgress', 'leftFootRotationDegrees',
    'leftLimbMode', 'maximumHealth', 'orbitDirection', 'orbitHeadingRadians',
    'phase', 'poseVariant', 'provokeRollBound', 'reflectFactor',
    'rightConnectorOffset', 'rightFoot', 'rightFootBob', 'rightFootNext',
    'rightFootPrevious', 'rightFootProgress', 'rightFootRotationDegrees',
    'rightLimbMode', 'targetPollTicksRemaining',
  ])
  const phase = memberString(
    source.phase,
    `${field}.phase`,
    ['active', 'assembly', 'attack', 'provoke'] as const,
  )
  const actionDurationTicks = boundedInteger(
    source.actionDurationTicks,
    `${field}.actionDurationTicks`,
    0,
    151,
  )
  const actionTick = nonnegativeInteger(source.actionTick, `${field}.actionTick`)
  if (actionTick > actionDurationTicks) {
    throw new GameProtocolError(`${field}.actionTick exceeds its duration`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const currentHealth = positiveFinite(source.currentHealth, `${field}.currentHealth`)
  if (currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth exceeds maximumHealth`)
  }
  const orbitDirection = finite(source.orbitDirection, `${field}.orbitDirection`)
  if (orbitDirection < -1 || orbitDirection > 1) {
    throw new GameProtocolError(`${field}.orbitDirection must be within [-1,1]`)
  }
  const orbitHeadingRadians = source.orbitHeadingRadians === null
    ? null
    : finite(source.orbitHeadingRadians, `${field}.orbitHeadingRadians`)
  return {
    actionHeadingOffsetDegrees: finite(
      source.actionHeadingOffsetDegrees,
      `${field}.actionHeadingOffsetDegrees`,
    ),
    actionDurationTicks,
    actionTick,
    circleSlowTicks: boundedInteger(source.circleSlowTicks, `${field}.circleSlowTicks`, 0, 20),
    currentHealth,
    damageMaximum: nonnegativeFinite(source.damageMaximum, `${field}.damageMaximum`),
    gaitTick: nonnegativeInteger(source.gaitTick, `${field}.gaitTick`),
    iron: boolean(source.iron, `${field}.iron`),
    leftConnectorOffset: vector(source.leftConnectorOffset, `${field}.leftConnectorOffset`),
    leftFoot: vector(source.leftFoot, `${field}.leftFoot`),
    leftFootBob: vector(source.leftFootBob, `${field}.leftFootBob`),
    leftFootNext: vector(source.leftFootNext, `${field}.leftFootNext`),
    leftFootPrevious: vector(source.leftFootPrevious, `${field}.leftFootPrevious`),
    leftFootProgress: unitInterval(source.leftFootProgress, `${field}.leftFootProgress`),
    leftFootRotationDegrees: finite(
      source.leftFootRotationDegrees,
      `${field}.leftFootRotationDegrees`,
    ),
    leftLimbMode: boundedInteger(source.leftLimbMode, `${field}.leftLimbMode`, 0, 3),
    maximumHealth,
    orbitDirection,
    orbitHeadingRadians,
    phase,
    poseVariant: boundedInteger(source.poseVariant, `${field}.poseVariant`, 0, 1) as 0 | 1,
    provokeRollBound: boundedInteger(source.provokeRollBound, `${field}.provokeRollBound`, 0, 1_200),
    reflectFactor: unitInterval(source.reflectFactor, `${field}.reflectFactor`),
    rightConnectorOffset: vector(source.rightConnectorOffset, `${field}.rightConnectorOffset`),
    rightFoot: vector(source.rightFoot, `${field}.rightFoot`),
    rightFootBob: vector(source.rightFootBob, `${field}.rightFootBob`),
    rightFootNext: vector(source.rightFootNext, `${field}.rightFootNext`),
    rightFootPrevious: vector(source.rightFootPrevious, `${field}.rightFootPrevious`),
    rightFootProgress: unitInterval(source.rightFootProgress, `${field}.rightFootProgress`),
    rightFootRotationDegrees: finite(
      source.rightFootRotationDegrees,
      `${field}.rightFootRotationDegrees`,
    ),
    rightLimbMode: boundedInteger(source.rightLimbMode, `${field}.rightLimbMode`, 0, 3),
    targetPollTicksRemaining: boundedInteger(
      source.targetPollTicksRemaining,
      `${field}.targetPollTicksRemaining`,
      0,
      50,
    ),
  }
}

export function nativeSecondarySkillId(value: unknown, field: string): NativeSecondaryAbilityId {
  const skillId = nonnegativeInteger(value, field)
  if (!(NATIVE_SECONDARY_ABILITY_IDS as readonly number[]).includes(skillId)) {
    throw new GameProtocolError(`${field} is not a native secondary ability`)
  }
  return skillId as NativeSecondaryAbilityId
}
