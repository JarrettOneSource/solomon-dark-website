import type { NativeWeldBuildId } from '../../core-kernels/native-weld-primary-profile.ts'
import type { NativeWeldProjectileState } from '../../core-kernels/native-weld-primary-runtime.ts'
import type { NativeFireSpentEmber } from '../../core-kernels/primary-spell-fire-effects.ts'
import { ETHER_PRIMARY_INITIAL_TURN } from '../../core-kernels/primary-spell-targeting.ts'
import {
  PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
  type PrimarySpellEarthProjectileState,
  type PrimarySpellProjectilePhase,
  type PrimarySpellProjectileState,
  nativePrimaryPainterRegistrationContract,
} from '../../core-kernels/primary-spells.ts'
import { MAX_PRIMARY_SPELL_HIT_TARGETS } from '../game-protocol-limits.ts'
import {
  nativeWorldManagerRegistration,
  nativeWorldPainterRegistrations,
  unitVector,
  vector,
} from './native-state.ts'
import {
  GameProtocolError,
  boolean,
  finite,
  integer,
  limitedArray,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
  validatedPlayerId,
} from './values.ts'

export type WithoutPainterRegistrations<T> = T extends unknown
  ? Omit<T, 'painterRegistrations'>
  : never

export function primarySpellProjectile(value: unknown, field: string): PrimarySpellProjectileState {
  const source = record(value, field)
  const {
    painterRegistrations: painterRegistrationValue,
    ...payload
  } = source
  const decoded = primarySpellProjectilePayload(payload, field)
  const contract = nativePrimaryPainterRegistrationContract(
    decoded as PrimarySpellProjectileState,
  )
  return {
    ...decoded,
    painterRegistrations: nativeWorldPainterRegistrations(
      painterRegistrationValue,
      `${field}.painterRegistrations`,
      contract.managerLane,
      contract.count,
    ),
  } as PrimarySpellProjectileState
}

function primarySpellProjectilePayload(
  value: unknown,
  field: string,
): WithoutPainterRegistrations<PrimarySpellProjectileState> {
  const source = record(value, field)
  if (source.kind === 'weld') return primarySpellWeldProjectile(source, field)
  if (source.kind !== 'earth' && source.kind !== 'ether' && source.kind !== 'fire') {
    throw new GameProtocolError(`${field}.kind is not a projectile primary`)
  }
  onlyKeys(source, field, [
    'ageTicks', 'charge', 'damage', 'direction', 'flightTicks', 'id', 'kind',
    'lightRegistration', 'ownerId', 'phase', 'position', 'velocity', 'worldKey',
    ...(source.kind === 'earth' ? [
      'assemblyCharge', 'hitTargetIds', 'maximumCharge', 'orientation',
      'remainingDamage', 'shellCharge', 'toughness',
    ] : []),
    ...(source.kind === 'ether' ? [
      'damageRetention', 'headingDegrees', 'piercesRemaining', 'reacquiresTarget',
      'speed', 'targetId', 'turnAccumulator', 'turnInput', 'underpowered',
      'visualScale',
    ] : []),
    ...(source.kind === 'fire' ? [
      'burnDamage', 'emberDamage', 'emberFragments', 'explodeDamage',
      'explodeRadius', 'privateSeed', 'spentEmber', 'underpowered',
    ] : []),
  ])
  if (source.phase !== 'flight' && source.phase !== 'held') {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const phase: PrimarySpellProjectilePhase = source.phase
  if (phase === 'held' && source.kind !== 'earth') {
    throw new GameProtocolError(`${field} only permits held Earth actors`)
  }
  const charge = finite(source.charge, `${field}.charge`)
  if (charge < 0 || (source.kind !== 'earth' && charge > 1)) {
    throw new GameProtocolError(
      `${field}.charge must be non-negative${source.kind === 'earth' ? '' : ' and at most one'}`,
    )
  }
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const flightTicks = nonnegativeInteger(source.flightTicks, `${field}.flightTicks`)
  if (phase === 'held' && flightTicks !== 0) {
    throw new GameProtocolError(`${field}.flightTicks must be zero while held`)
  }
  if (phase === 'flight' && (flightTicks < 1 || flightTicks > ageTicks)) {
    throw new GameProtocolError(`${field}.flightTicks is outside the actor age`)
  }
  const damage = nonnegativeFinite(source.damage, `${field}.damage`)
  if (source.kind !== 'earth' && damage <= 0) {
    throw new GameProtocolError(`${field}.damage must be positive in flight`)
  }
  const projectile = {
    ageTicks,
    charge,
    damage,
    direction: unitVector(source.direction, `${field}.direction`),
    flightTicks,
    id: positiveInteger(source.id, `${field}.id`),
    lightRegistration: nativeWorldManagerRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    phase,
    position: vector(source.position, `${field}.position`),
    velocity: vector(source.velocity, `${field}.velocity`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
  if (source.kind === 'earth') {
    const maximumCharge = positiveFinite(source.maximumCharge, `${field}.maximumCharge`)
    if ((phase === 'held' && maximumCharge < 1) || charge > maximumCharge) {
      throw new GameProtocolError(`${field}.charge exceeds its native Earth maximum`)
    }
    const remainingDamage = nonnegativeFinite(
      source.remainingDamage,
      `${field}.remainingDamage`,
    )
    const toughness = positiveFinite(source.toughness, `${field}.toughness`)
    const assemblyCharge = finite(source.assemblyCharge, `${field}.assemblyCharge`)
    const shellCharge = positiveFinite(source.shellCharge, `${field}.shellCharge`)
    if (
      assemblyCharge < PRIMARY_SPELL_EARTH_INITIAL_CHARGE
      || assemblyCharge > maximumCharge
      || (phase === 'held' && (
        assemblyCharge > charge
        || Math.floor(30 * assemblyCharge) !== Math.floor(30 * charge)
        || shellCharge !== assemblyCharge
      ))
    ) {
      throw new GameProtocolError(
        `${field}.assemblyCharge is outside the current native rebuild bucket`,
      )
    }
    if (shellCharge > maximumCharge) {
      throw new GameProtocolError(`${field}.shellCharge exceeds the released charge ceiling`)
    }
    if (!Array.isArray(source.orientation) || source.orientation.length !== 9) {
      throw new GameProtocolError(`${field}.orientation must contain nine float32 values`)
    }
    const orientation = source.orientation.map((value, index) => {
      const component = finite(value, `${field}.orientation[${index}]`)
      if (component !== Math.fround(component)) {
        throw new GameProtocolError(`${field}.orientation[${index}] must be float32`)
      }
      return component
    }) as unknown as PrimarySpellEarthProjectileState['orientation']
    const hitTargetIds = limitedArray(
      source.hitTargetIds,
      `${field}.hitTargetIds`,
      MAX_PRIMARY_SPELL_HIT_TARGETS,
    ).map((targetId, index) => limitedString(
      targetId,
      `${field}.hitTargetIds[${index}]`,
      256,
    ))
    if (new Set(hitTargetIds).size !== hitTargetIds.length) {
      throw new GameProtocolError(`${field}.hitTargetIds contains a duplicate target`)
    }
    return {
      ...projectile,
      assemblyCharge,
      hitTargetIds,
      kind: 'earth',
      maximumCharge,
      orientation,
      remainingDamage,
      shellCharge,
      toughness,
    } satisfies PrimarySpellEarthProjectileState
  }
  if (source.kind === 'ether') {
    const damageRetention = finite(source.damageRetention, `${field}.damageRetention`)
    if (damageRetention < 0 || damageRetention > 1) {
      throw new GameProtocolError(`${field}.damageRetention is outside [0,1]`)
    }
    const headingDegrees = finite(source.headingDegrees, `${field}.headingDegrees`)
    if (headingDegrees < 0 || headingDegrees >= 360) {
      throw new GameProtocolError(`${field}.headingDegrees is outside [0,360)`)
    }
    const turnAccumulator = finite(source.turnAccumulator, `${field}.turnAccumulator`)
    if (turnAccumulator < ETHER_PRIMARY_INITIAL_TURN || turnAccumulator > 10) {
      throw new GameProtocolError(
        `${field}.turnAccumulator is outside [${ETHER_PRIMARY_INITIAL_TURN},10]`,
      )
    }
    const speed = positiveFinite(source.speed, `${field}.speed`)
    const turnInput = positiveFinite(source.turnInput, `${field}.turnInput`)
    const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
    if (speed > 100 || turnInput > 100 || visualScale > 1) {
      throw new GameProtocolError(`${field} exceeds the native Ether payload range`)
    }
    return {
      ...projectile,
      damageRetention,
      headingDegrees,
      kind: 'ether',
      piercesRemaining: nonnegativeInteger(
        source.piercesRemaining,
        `${field}.piercesRemaining`,
      ),
      reacquiresTarget: boolean(source.reacquiresTarget, `${field}.reacquiresTarget`),
      speed,
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      turnInput,
      turnAccumulator,
      underpowered: boolean(source.underpowered, `${field}.underpowered`),
      visualScale,
    }
  }
  const emberFragments = nonnegativeInteger(
    source.emberFragments,
    `${field}.emberFragments`,
  )
  if (emberFragments > 100) {
    throw new GameProtocolError(`${field}.emberFragments exceeds the native payload range`)
  }
  const privateSeed = nonnegativeInteger(source.privateSeed, `${field}.privateSeed`)
  if (privateSeed > 1_000_000) {
    throw new GameProtocolError(`${field}.privateSeed exceeds the native seed range`)
  }
  return {
    ...projectile,
    burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
    emberDamage: nonnegativeFinite(source.emberDamage, `${field}.emberDamage`),
    emberFragments,
    explodeDamage: nonnegativeFinite(source.explodeDamage, `${field}.explodeDamage`),
    explodeRadius: nonnegativeFinite(source.explodeRadius, `${field}.explodeRadius`),
    kind: 'fire',
    privateSeed,
    spentEmber: primarySpellFireSpentEmber(source.spentEmber, `${field}.spentEmber`),
    underpowered: boolean(source.underpowered, `${field}.underpowered`),
  }
}

const NATIVE_WELD_VECTOR_LENGTHS: Readonly<Record<NativeWeldBuildId, number>> = {
  1000: 9,
  1001: 7,
  1002: 7,
  1003: 8,
  1004: 7,
  1005: 8,
  1006: 6,
  1007: 9,
  1008: 6,
  1009: 6,
}

function primarySpellWeldProjectile(
  source: Record<string, unknown>,
  field: string,
): NativeWeldProjectileState {
  onlyKeys(source, field, [
    'ageTicks', 'ballLightningAcceleration', 'basePresentationPhaseDegrees',
    'buildId', 'castPlaybackRate', 'castSoundVariant', 'charge',
    'contactsRemaining', 'damage', 'direction', 'flightTicks', 'frostPulseAspect',
    'frostPresentationLanes', 'frostTurnDegrees', 'groundSparkNativeAgeTicks',
    'groundSparkTurnTicksRemaining', 'headingDegrees', 'hitTargetIds', 'id', 'kind',
    'lightRegistration', 'ownerId', 'phase', 'position', 'presentationSeed',
    'projectileIndex', 'reacquiresTarget', 'secondaryPresentationPhaseDegrees', 'speed', 'targetId',
    'turnAccumulator', 'turnInput', 'underpowered', 'vector', 'velocity', 'worldKey',
  ])
  const buildId = weldBuildId(source.buildId, `${field}.buildId`)
  if (buildId !== 1000 && buildId !== 1001 && buildId !== 1002 && buildId !== 1009) {
    throw new GameProtocolError(`${field}.buildId is not a welded one-shot build`)
  }
  if (source.charge !== 1 || source.phase !== 'flight') {
    throw new GameProtocolError(`${field} is not a released welded projectile`)
  }
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const flightTicks = nonnegativeInteger(source.flightTicks, `${field}.flightTicks`)
  if (flightTicks > ageTicks) {
    throw new GameProtocolError(`${field}.flightTicks exceeds the actor age`)
  }
  const headingDegrees = finite(source.headingDegrees, `${field}.headingDegrees`)
  if (headingDegrees < 0 || headingDegrees >= 360) {
    throw new GameProtocolError(`${field}.headingDegrees is outside [0,360)`)
  }
  const presentationSeed = source.presentationSeed === null
    ? null
    : nonnegativeInteger(source.presentationSeed, `${field}.presentationSeed`)
  if ((buildId !== 1000 && buildId !== 1009 && presentationSeed !== null)
    || ((buildId === 1000 || buildId === 1009) && presentationSeed === null)
    || (buildId === 1000 && presentationSeed !== null && presentationSeed >= 100_000)
    || (buildId === 1009 && presentationSeed !== null && presentationSeed > 0xffff_ffff)) {
    throw new GameProtocolError(`${field}.presentationSeed does not match its welded build`)
  }
  const basePresentationPhaseDegrees = source.basePresentationPhaseDegrees === null
    ? null
    : finite(source.basePresentationPhaseDegrees, `${field}.basePresentationPhaseDegrees`)
  if ((buildId === 1009 && basePresentationPhaseDegrees !== null)
    || (buildId !== 1009 && (basePresentationPhaseDegrees === null
      || basePresentationPhaseDegrees < 0))) {
    throw new GameProtocolError(
      `${field}.basePresentationPhaseDegrees does not match its welded build`,
    )
  }
  const secondaryPresentationPhaseDegrees = source.secondaryPresentationPhaseDegrees === null
    ? null
    : finite(
        source.secondaryPresentationPhaseDegrees,
        `${field}.secondaryPresentationPhaseDegrees`,
      )
  if ((buildId !== 1001 && secondaryPresentationPhaseDegrees !== null)
    || (buildId === 1001 && (secondaryPresentationPhaseDegrees === null
      || secondaryPresentationPhaseDegrees < 0
      || secondaryPresentationPhaseDegrees > 360))) {
    throw new GameProtocolError(
      `${field}.secondaryPresentationPhaseDegrees does not match its welded build`,
    )
  }
  const castSoundVariant = source.castSoundVariant === null
    ? null
    : nonnegativeInteger(source.castSoundVariant, `${field}.castSoundVariant`)
  const soundVariantCount = buildId === 1002 ? 2 : buildId === 1009 ? 3 : 0
  if ((soundVariantCount === 0 && castSoundVariant !== null)
    || (soundVariantCount > 0
      && (castSoundVariant === null || castSoundVariant >= soundVariantCount))) {
    throw new GameProtocolError(`${field}.castSoundVariant does not match its welded build`)
  }
  const castPlaybackRate = positiveFinite(
    source.castPlaybackRate,
    `${field}.castPlaybackRate`,
  )
  if (castPlaybackRate < 0.5 || castPlaybackRate > 1.5) {
    throw new GameProtocolError(`${field}.castPlaybackRate is outside the native lane`)
  }
  const ballLightningAcceleration = source.ballLightningAcceleration === null
    ? null
    : nonnegativeFinite(
        source.ballLightningAcceleration,
        `${field}.ballLightningAcceleration`,
      )
  if ((buildId !== 1002 && ballLightningAcceleration !== null)
    || (buildId === 1002 && (ballLightningAcceleration === null
      || ballLightningAcceleration > 2))) {
    throw new GameProtocolError(`${field}.ballLightningAcceleration does not match its build`)
  }
  const frostPulseAspect = source.frostPulseAspect === null
    ? null
    : finite(source.frostPulseAspect, `${field}.frostPulseAspect`)
  if ((buildId !== 1001 && frostPulseAspect !== null)
    || (buildId === 1001 && (frostPulseAspect === null
      || frostPulseAspect < 0.5 || frostPulseAspect > 0.75))) {
    throw new GameProtocolError(`${field}.frostPulseAspect does not match its build`)
  }
  const frostPresentationLanes = source.frostPresentationLanes === null
    ? null
    : limitedArray(source.frostPresentationLanes, `${field}.frostPresentationLanes`, 2)
      .map((value, index) => {
        const lane = record(value, `${field}.frostPresentationLanes[${index}]`)
        onlyKeys(lane, `${field}.frostPresentationLanes[${index}]`, [
          'aspect', 'rotationDegrees', 'scale',
        ])
        const aspect = nonnegativeFinite(
          lane.aspect,
          `${field}.frostPresentationLanes[${index}].aspect`,
        )
        const rotationDegrees = nonnegativeFinite(
          lane.rotationDegrees,
          `${field}.frostPresentationLanes[${index}].rotationDegrees`,
        )
        const scale = nonnegativeFinite(
          lane.scale,
          `${field}.frostPresentationLanes[${index}].scale`,
        )
        if (aspect > 0.75 || rotationDegrees > 45 || scale > 1.25) {
          throw new GameProtocolError(
            `${field}.frostPresentationLanes[${index}] exceeds the native lane`,
          )
        }
        return { aspect, rotationDegrees, scale }
      })
  if ((buildId === 1001) !== (frostPresentationLanes?.length === 2)) {
    throw new GameProtocolError(`${field}.frostPresentationLanes does not match its build`)
  }
  const frostTurnDegrees = source.frostTurnDegrees === null
    ? null
    : finite(source.frostTurnDegrees, `${field}.frostTurnDegrees`)
  if ((buildId !== 1001 && frostTurnDegrees !== null)
    || (buildId === 1001 && (frostTurnDegrees === null
      || frostTurnDegrees < -35 || frostTurnDegrees > 35))) {
    throw new GameProtocolError(`${field}.frostTurnDegrees does not match its build`)
  }
  const groundSparkNativeAgeTicks = source.groundSparkNativeAgeTicks === null
    ? null
    : nonnegativeInteger(
        source.groundSparkNativeAgeTicks,
        `${field}.groundSparkNativeAgeTicks`,
      )
  const groundSparkTurnTicksRemaining = source.groundSparkTurnTicksRemaining === null
    ? null
    : nonnegativeInteger(
        source.groundSparkTurnTicksRemaining,
        `${field}.groundSparkTurnTicksRemaining`,
      )
  if ((buildId !== 1009
    && (groundSparkNativeAgeTicks !== null || groundSparkTurnTicksRemaining !== null))
    || (buildId === 1009 && (groundSparkNativeAgeTicks === null
      || groundSparkTurnTicksRemaining === null || groundSparkTurnTicksRemaining > 20))) {
    throw new GameProtocolError(`${field} GroundSpark private motion state is malformed`)
  }
  const targetId = source.targetId === null
    ? null
    : limitedString(source.targetId, `${field}.targetId`, 256)
  if (buildId === 1009 && targetId !== null) {
    throw new GameProtocolError(`${field}.targetId is invalid for Crawling Shock`)
  }
  const turnAccumulator = finite(source.turnAccumulator, `${field}.turnAccumulator`)
  if (turnAccumulator < ETHER_PRIMARY_INITIAL_TURN || turnAccumulator > 10) {
    throw new GameProtocolError(`${field}.turnAccumulator is outside the native homing lane`)
  }
  const turnInput = nonnegativeFinite(source.turnInput, `${field}.turnInput`)
  if ((buildId === 1009) !== (turnInput === 0)) {
    throw new GameProtocolError(`${field}.turnInput does not match its welded build`)
  }
  return {
    ageTicks,
    ballLightningAcceleration,
    basePresentationPhaseDegrees,
    buildId,
    castPlaybackRate,
    castSoundVariant,
    charge: 1,
    contactsRemaining: positiveInteger(
      source.contactsRemaining,
      `${field}.contactsRemaining`,
    ),
    damage: positiveFinite(source.damage, `${field}.damage`),
    direction: unitVector(source.direction, `${field}.direction`),
    flightTicks,
    frostPulseAspect,
    frostPresentationLanes: frostPresentationLanes as
      NativeWeldProjectileState['frostPresentationLanes'],
    frostTurnDegrees,
    groundSparkNativeAgeTicks,
    groundSparkTurnTicksRemaining,
    headingDegrees,
    hitTargetIds: uniqueWeldTargetIds(source.hitTargetIds, `${field}.hitTargetIds`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: 'weld',
    lightRegistration: nativeWorldManagerRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    phase: 'flight',
    position: vector(source.position, `${field}.position`),
    presentationSeed,
    projectileIndex: nonnegativeInteger(source.projectileIndex, `${field}.projectileIndex`),
    reacquiresTarget: boolean(source.reacquiresTarget, `${field}.reacquiresTarget`),
    secondaryPresentationPhaseDegrees,
    speed: positiveFinite(source.speed, `${field}.speed`),
    targetId,
    turnAccumulator,
    turnInput,
    underpowered: boolean(source.underpowered, `${field}.underpowered`),
    vector: weldVector(source.vector, buildId, `${field}.vector`),
    velocity: vector(source.velocity, `${field}.velocity`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
}

export function weldBuildId(value: unknown, field: string): NativeWeldBuildId {
  const buildId = integer(value, field)
  if (buildId < 1000 || buildId > 1009) {
    throw new GameProtocolError(`${field} is not a native welded build`)
  }
  return buildId as NativeWeldBuildId
}

export function weldVector(
  value: unknown,
  buildId: NativeWeldBuildId,
  field: string,
): readonly number[] {
  const expected = NATIVE_WELD_VECTOR_LENGTHS[buildId]
  const source = limitedArray(value, field, 9)
  if (source.length !== expected) {
    throw new GameProtocolError(`${field} must contain ${expected} native values`)
  }
  return source.map((component, index) => finite(component, `${field}[${index}]`))
}

export function uniqueWeldTargetIds(value: unknown, field: string): readonly string[] {
  const ids = limitedArray(value, field, MAX_PRIMARY_SPELL_HIT_TARGETS).map(
    (targetId, index) => limitedString(targetId, `${field}[${index}]`, 256),
  )
  if (new Set(ids).size !== ids.length) {
    throw new GameProtocolError(`${field} contains a duplicate target`)
  }
  return ids
}

export function requireWeldHailBuild(buildId: NativeWeldBuildId, field: string): void {
  if (buildId !== 1008) throw new GameProtocolError(`${field}.buildId is not Hailstones`)
}

export function primarySpellFireSpentEmber(
  value: unknown,
  field: string,
): NativeFireSpentEmber {
  const source = record(value, field)
  if (source.kind === 'none') {
    onlyKeys(source, field, ['kind'])
    return { kind: 'none' }
  }
  if (source.kind === 'immolate') {
    onlyKeys(source, field, ['damage', 'kind'])
    return {
      damage: positiveFinite(source.damage, `${field}.damage`),
      kind: 'immolate',
    }
  }
  if (source.kind === 'imp') {
    onlyKeys(source, field, ['damage', 'kind', 'lifetimeTicks'])
    return {
      damage: positiveFinite(source.damage, `${field}.damage`),
      kind: 'imp',
      lifetimeTicks: positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`),
    }
  }
  throw new GameProtocolError(`${field}.kind is not a spent-Ember effect`)
}
