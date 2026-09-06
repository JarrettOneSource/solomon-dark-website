import { finiteWithin } from './values.ts'
import type { BoneyardEnemyProjectileEffectSnapshotBase } from '../game-state.ts'
import type { NativeWorldManagerRegistration } from '../../core-kernels/native-world-manager-order.ts'
import { boneyardEnemyProjectileVisualScaleIsValid } from '../boneyard-enemy-projectile-replication.ts'
import {
  BONEYARD_ENEMY_PROJECTILE_EFFECT_ALPHA_MAXIMUMS,
  BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS,
  BONEYARD_ENEMY_PROJECTILE_PAYLOADS,
  BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES,
  BONEYARD_MAGGOT_STATES,
  type BoneyardEnemyProjectileEffectSnapshot,
  type BoneyardEnemyProjectileKind,
  type BoneyardEnemyProjectilePayload,
  type BoneyardEnemyProjectileSnapshot,
  type BoneyardMaggotSnapshot,
} from '../game-state.ts'
import {
  absentNativeActorLight,
  absentNativeWorldManagerRegistration,
  boneyardPoint,
  nativeWorldManagerRegistration,
} from './native-state.ts'
import {
  GameProtocolError,
  boolean,
  finite,
  integerWithin,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
} from './values.ts'

const BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES = {
  arrow: 0x7da,
  'demon-bomb': 0x7f7,
  firebolt: 0x7eb,
  'guided-missile': 0x7ec,
  'poison-pool': 0x806,
} as const satisfies Readonly<Record<BoneyardEnemyProjectileKind, number>>

export function boneyardEnemyProjectileSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyProjectileSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'contactRadius',
    'headingDeg',
    'homing',
    'id',
    'kind',
    'lightRegistration',
    'lifetimeTicks',
    'nativeTypeId',
    'ownerActorId',
    'painterRegistration',
    'payload',
    'position',
    'speed',
    'spawnTick',
    'verticalOffset',
    'visualPhaseDeg',
    'visualScale',
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(kind in BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const nativeTypeId = positiveInteger(source.nativeTypeId, `${field}.nativeTypeId`)
  if (
    nativeTypeId
    !== BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES[kind as BoneyardEnemyProjectileKind]
  ) {
    throw new GameProtocolError(`${field}.nativeTypeId does not match kind`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  if (kind !== 'demon-bomb' && kind !== 'arrow' && ageTicks > lifetimeTicks) {
    throw new GameProtocolError(`${field}.ageTicks exceeds lifetimeTicks`)
  }
  const speed = finite(source.speed, `${field}.speed`)
  if (speed < 0 || speed > 10) {
    throw new GameProtocolError(`${field}.speed is outside [0,10]`)
  }
  const verticalOffset = finite(source.verticalOffset, `${field}.verticalOffset`)
  if (verticalOffset > 0) {
    throw new GameProtocolError(`${field}.verticalOffset must be non-positive`)
  }
  const visualScale = finite(source.visualScale, `${field}.visualScale`)
  if (!boneyardEnemyProjectileVisualScaleIsValid(
    kind as BoneyardEnemyProjectileKind,
    visualScale,
  )) {
    throw new GameProtocolError(`${field}.visualScale is outside its native kind range`)
  }
  const visualPhaseDeg = finite(source.visualPhaseDeg, `${field}.visualPhaseDeg`)
  if (visualPhaseDeg < 0 || visualPhaseDeg >= 720) {
    throw new GameProtocolError(`${field}.visualPhaseDeg must be within [0,720)`)
  }
  const payload = limitedString(source.payload, `${field}.payload`, 16)
  if (!(BONEYARD_ENEMY_PROJECTILE_PAYLOADS as readonly string[]).includes(payload)) {
    throw new GameProtocolError(`${field}.payload is not supported`)
  }
  if (!projectilePayloadMatchesKind(
    kind as BoneyardEnemyProjectileKind,
    payload as BoneyardEnemyProjectilePayload,
  )) {
    throw new GameProtocolError(`${field}.payload does not match kind`)
  }
  return {
    ageTicks,
    contactRadius: positiveFinite(source.contactRadius, `${field}.contactRadius`),
    headingDeg,
    homing: boolean(source.homing, `${field}.homing`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as BoneyardEnemyProjectileKind,
    lightRegistration: boneyardEnemyProjectileLightRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      kind as BoneyardEnemyProjectileKind,
      payload as BoneyardEnemyProjectilePayload,
    ),
    lifetimeTicks,
    nativeTypeId: nativeTypeId as BoneyardEnemyProjectileSnapshot['nativeTypeId'],
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    painterRegistration: nativeWorldManagerRegistration(
      source.painterRegistration,
      `${field}.painterRegistration`,
      kind === 'arrow' || kind === 'firebolt' ? 'transient' : 'actor',
    ),
    payload: payload as BoneyardEnemyProjectilePayload,
    position: boneyardPoint(source.position, `${field}.position`),
    speed,
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    verticalOffset,
    visualPhaseDeg,
    visualScale,
  }
}

export function boneyardEnemyProjectileEffectSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyProjectileEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'id',
    'kind',
    'lightRegistration',
    'lifetimeTicks',
    'ownerActorId',
    'ownerProjectileId',
    'painterRegistration',
    'phaseOriginTicks',
    'position',
    'rotationRadians',
    'scale',
    'spawnTick',
    'tint',
    ...(source.kind === 'demon-fire' ? ['fireFadeAlpha', 'fireHorizontalSign'] : []),
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const atlas = limitedString(source.atlas, `${field}.atlas`, 16)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  if (ageTicks >= lifetimeTicks) {
    throw new GameProtocolError(`${field}.ageTicks must precede lifetimeTicks`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  const maximumAlpha = BONEYARD_ENEMY_PROJECTILE_EFFECT_ALPHA_MAXIMUMS[
    kind as BoneyardEnemyProjectileEffectSnapshot['kind']
  ]
  if (alpha < 0 || alpha > maximumAlpha) {
    throw new GameProtocolError(`${field}.alpha must be within [0,${maximumAlpha}]`)
  }
  const effectKind = kind as BoneyardEnemyProjectileEffectSnapshot['kind']
  const base: BoneyardEnemyProjectileEffectSnapshotBase = {
    ageTicks,
    alpha,
    atlas,
    blendMode,
    entry: nonnegativeInteger(source.entry, `${field}.entry`),
    id: positiveInteger(source.id, `${field}.id`),
    lightRegistration: kind === 'fire-burst' || kind === 'guided-impact' || kind === 'demon-fire' || kind === 'demon-explosion-lit-array'
      ? nativeWorldManagerRegistration(
          source.lightRegistration,
          `${field}.lightRegistration`,
          kind === 'demon-fire' ? 'actor' : 'transient',
        )
      : absentNativeActorLight(source, field),
    lifetimeTicks,
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    ownerProjectileId: positiveInteger(
      source.ownerProjectileId,
      `${field}.ownerProjectileId`,
    ),
    painterRegistration: nativeWorldManagerRegistration(
      source.painterRegistration,
      `${field}.painterRegistration`,
      (kind === 'fire-burst' || kind === 'guided-impact') || kind === 'demon-explosion-lit-array' ? 'transient' : 'actor',
    ),
    phaseOriginTicks: nonnegativeInteger(
      source.phaseOriginTicks,
      `${field}.phaseOriginTicks`,
    ),
    position: boneyardPoint(source.position, `${field}.position`),
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: nonnegativeFinite(source.scale, `${field}.scale`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    tint: integerWithin(source.tint, `${field}.tint`, 0, 0xffffff),
  }
  if (effectKind !== 'demon-fire') return { ...base, kind: effectKind }
  const fireHorizontalSign = finite(source.fireHorizontalSign, `${field}.fireHorizontalSign`)
  if (fireHorizontalSign !== -1 && fireHorizontalSign !== 1) throw new GameProtocolError('Fire horizontal sign must be -1 or 1')
  return { ...base, kind: effectKind,
    fireFadeAlpha: finiteWithin(source.fireFadeAlpha, `${field}.fireFadeAlpha`, 0, 1), fireHorizontalSign }
}

function projectilePayloadMatchesKind(
  kind: BoneyardEnemyProjectileKind,
  payload: BoneyardEnemyProjectilePayload,
): boolean {
  switch (kind) {
    case 'arrow': return payload === 'normal' || payload === 'fire' || payload === 'poison'
    case 'firebolt': return payload === 'fire'
    case 'guided-missile': return payload === 'cold' || payload === 'poison'
    case 'demon-bomb': return payload === 'none'
    case 'poison-pool': return payload === 'poison'
  }
}

function boneyardEnemyProjectileLightRegistration(
  value: unknown,
  field: string,
  kind: BoneyardEnemyProjectileKind,
  payload: BoneyardEnemyProjectilePayload,
): NativeWorldManagerRegistration | null {
  if (kind === 'guided-missile' || kind === 'demon-bomb') {
    return nativeWorldManagerRegistration(value, field, 'actor')
  }
  if (kind === 'firebolt' || (kind === 'arrow' && payload === 'fire')) {
    return nativeWorldManagerRegistration(value, field, 'transient')
  }
  return absentNativeWorldManagerRegistration(value, field)
}

export function boneyardMaggotSnapshot(value: unknown, field: string): BoneyardMaggotSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha',
    'currentHealth',
    'deathEpoch',
    'deathTick',
    'emergencePhase',
    'emergenceTick',
    'emergenceOrientation',
    'headingDeg',
    'hitFlash',
    'id',
    'launchTrajectory',
    'lightRegistration',
    'maximumHealth',
    'ownerCoffinActorId',
    'pose',
    'position',
    'spawnTick',
    'state',
    'verticalOffset',
    'visualScale',
  ])
  const state = limitedString(source.state, `${field}.state`, 16)
  if (!(BONEYARD_MAGGOT_STATES as readonly string[]).includes(state)) {
    throw new GameProtocolError(`${field}.state is not supported`)
  }
  const launchTrajectory = limitedString(
    source.launchTrajectory,
    `${field}.launchTrajectory`,
    16,
  )
  if (!(BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES as readonly string[]).includes(launchTrajectory)) {
    throw new GameProtocolError(`${field}.launchTrajectory is not supported`)
  }
  const emergenceTick = nonnegativeInteger(source.emergenceTick, `${field}.emergenceTick`)
  const emergencePhase = nonnegativeFinite(source.emergencePhase, `${field}.emergencePhase`)
  if (emergencePhase >= 5) {
    throw new GameProtocolError(`${field}.emergencePhase is out of range`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  if (alpha < 0 || alpha > 1) {
    throw new GameProtocolError(`${field}.alpha must be within [0,1]`)
  }
  const hitFlash = finite(source.hitFlash, `${field}.hitFlash`)
  if (hitFlash < 0 || hitFlash > 1) {
    throw new GameProtocolError(`${field}.hitFlash must be within [0,1]`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  if (currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth exceeds maximumHealth`)
  }
  const verticalOffset = finite(source.verticalOffset, `${field}.verticalOffset`)
  if (verticalOffset > 0) {
    throw new GameProtocolError(`${field}.verticalOffset must be non-positive`)
  }
  const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
  if (visualScale > 1.25) {
    throw new GameProtocolError(`${field}.visualScale exceeds its constructor range`)
  }
  return {
    alpha,
    currentHealth,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    emergencePhase,
    emergenceTick,
    emergenceOrientation: integerWithin(
      source.emergenceOrientation,
      `${field}.emergenceOrientation`,
      0,
      9,
    ),
    headingDeg,
    hitFlash,
    id: positiveInteger(source.id, `${field}.id`),
    launchTrajectory: launchTrajectory as BoneyardMaggotSnapshot['launchTrajectory'],
    lightRegistration: nativeWorldManagerRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    maximumHealth,
    ownerCoffinActorId: positiveInteger(
      source.ownerCoffinActorId,
      `${field}.ownerCoffinActorId`,
    ),
    pose: nonnegativeFinite(source.pose, `${field}.pose`),
    position: boneyardPoint(source.position, `${field}.position`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    state: state as BoneyardMaggotSnapshot['state'],
    verticalOffset,
    visualScale,
  }
}
