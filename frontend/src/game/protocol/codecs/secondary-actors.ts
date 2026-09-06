import {
  NATIVE_MINDBLAST_BURST_LIFETIME_TICKS,
  NATIVE_MINDBLAST_SHOCKWAVE_GROWTH,
  NATIVE_MINDBLAST_SHOCKWAVE_LIFETIME_TICKS,
  NATIVE_SECONDARY_ACTOR_KINDS,
  type NativeSecondaryActorKind,
  type NativeSecondaryActorState,
  type NativeSecondaryGolemState,
  nativeSecondaryLightDisposition,
  nativeSecondaryPainterManagerLane,
} from '../../core-kernels/native-secondary-abilities.ts'
import {
  NATIVE_SECONDARY_ABILITY_IDS,
  type NativeSecondaryAbilityId,
} from '../../core-kernels/native-secondary-ability-contract.ts'
import { MAX_PRIMARY_SPELL_HIT_TARGETS } from '../game-protocol-limits.ts'
import type { ProtocolPlayerSnapshotFrame } from '../game-state.ts'
import {
  absentNativeActorLight,
  nativeRngState,
  nativeWorldManagerRegistration,
  nativeWorldPainterRegistrations,
  vector,
} from './native-state.ts'
import {
  GameProtocolError,
  boolean,
  boundedInteger,
  finite,
  limitedArray,
  limitedString,
  memberString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
  unitInterval,
  validatedPlayerId,
} from './values.ts'

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
  ])
  const kind = memberString(
    source.kind,
    `${field}.kind`,
    NATIVE_SECONDARY_ACTOR_KINDS,
  ) as NativeSecondaryActorKind
  const ownerId = validatedPlayerId(source.ownerId, `${field}.ownerId`)
  if (!players[ownerId]) throw new GameProtocolError(`${field}.ownerId has no player snapshot`)
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
  if (mindblast !== (skillId === null)) {
    throw new GameProtocolError(`${field}.skillId must be null exactly for Mindblast actors`)
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
    1,
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

function nativeSecondaryGolemState(
  value: unknown,
  field: string,
): NativeSecondaryGolemState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionDurationTicks', 'actionHeadingOffsetDegrees', 'actionTick',
    'currentHealth', 'damageMaximum', 'gaitTick', 'iron',
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
