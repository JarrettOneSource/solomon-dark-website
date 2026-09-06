import type {
  NativeWeldBoulderDebrisParticleState,
} from '../../core-kernels/native-weld-boulder-debris.ts'
import type { NativeWeldMeteorDebrisSeed } from '../../core-kernels/native-weld-meteor.ts'
import type { NativeWeldBuildId } from '../../core-kernels/native-weld-primary-profile.ts'
import {
  NATIVE_WELD_ETHEREAL_BOULDER_HELD_SCALE_CEILING,
  NATIVE_WELD_HAILSTONES_SCALE_CEILING,
  NATIVE_WELD_PERSISTENT_INITIAL_SCALE,
  type NativeWeldEtherealBoulderState,
  type NativeWeldHailstoneRockState,
  type NativeWeldHailstonesState,
} from '../../core-kernels/native-weld-primary-runtime.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import { nativeWorldManagerRegistration, vector } from './native-state.ts'
import { uniqueWeldTargetIds } from './primary-projectiles.ts'
import {
  GameProtocolError,
  boolean,
  finite,
  limitedArray,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
  unitInterval,
} from './values.ts'

export function primarySpellWeldEtherealBoulder(
  source: Record<string, unknown>,
  field: string,
  commonKeys: readonly string[],
  common: Readonly<{
    ageTicks: number
    birthTick: number
    buildId: NativeWeldBuildId
    direction: Vector2
    id: number
    origin: Vector2
    ownerId: string
    vector: readonly number[]
    worldKey: string
  }>,
  pulseSequence: number,
): NativeWeldEtherealBoulderState {
  onlyKeys(source, field, [
    ...commonKeys, 'assemblyScale', 'damage', 'flightTicks', 'hitTargetIds',
    'lifetimeTicksRemaining', 'maximumScale', 'orientation', 'phase',
    'pulseSequence', 'quantity', 'remainingDamage', 'scale', 'speedFactor',
    'shellScale', 'toughness', 'velocity',
  ])
  if (source.phase !== 'held' && source.phase !== 'flight') {
    throw new GameProtocolError(`${field}.phase is not an Ethereal Boulder phase`)
  }
  const maximumScale = positiveFinite(source.maximumScale, `${field}.maximumScale`)
  if (source.phase === 'held'
    && maximumScale !== NATIVE_WELD_ETHEREAL_BOULDER_HELD_SCALE_CEILING) {
    throw new GameProtocolError(`${field}.maximumScale is not the native cap`)
  }
  const scale = positiveFinite(source.scale, `${field}.scale`)
  if (scale > maximumScale) {
    throw new GameProtocolError(`${field}.scale is outside the native growth lane`)
  }
  const quantity = nonnegativeInteger(source.quantity, `${field}.quantity`)
  if ((source.phase === 'held' && (quantity < 1 || quantity > 4))
    || (source.phase === 'flight' && quantity !== 0)) {
    throw new GameProtocolError(`${field}.quantity does not match the boulder phase`)
  }
  const assemblyScale = positiveFinite(source.assemblyScale, `${field}.assemblyScale`)
  const shellScale = positiveFinite(source.shellScale, `${field}.shellScale`)
  if (assemblyScale < NATIVE_WELD_PERSISTENT_INITIAL_SCALE
    || assemblyScale > maximumScale
    || (source.phase === 'held' && (
      assemblyScale > scale
      || Math.floor(30 * assemblyScale) !== Math.floor(30 * scale)
      || shellScale !== assemblyScale
    ))) {
    throw new GameProtocolError(`${field}.assemblyScale is outside its native rebuild bucket`)
  }
  if (shellScale > maximumScale) {
    throw new GameProtocolError(`${field}.shellScale exceeds the released scale ceiling`)
  }
  const flightTicks = nonnegativeInteger(source.flightTicks, `${field}.flightTicks`)
  if ((source.phase === 'held' && flightTicks !== 0)
    || (source.phase === 'flight' && flightTicks > common.ageTicks)) {
    throw new GameProtocolError(`${field}.flightTicks does not match the boulder phase`)
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
  }) as unknown as NativeWeldEtherealBoulderState['orientation']
  return {
    ...common,
    assemblyScale,
    buildId: 1006,
    damage: nonnegativeFinite(source.damage, `${field}.damage`),
    flightTicks,
    hitTargetIds: uniqueWeldTargetIds(source.hitTargetIds, `${field}.hitTargetIds`),
    kind: 'weld-persistent',
    lightRegistration: nativeWorldManagerRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    lifetimeTicksRemaining: positiveInteger(
      source.lifetimeTicksRemaining,
      `${field}.lifetimeTicksRemaining`,
    ),
    maximumScale,
    orientation,
    phase: source.phase,
    pulseSequence,
    quantity,
    remainingDamage: positiveFinite(source.remainingDamage, `${field}.remainingDamage`),
    scale,
    shellScale,
    speedFactor: positiveFinite(source.speedFactor, `${field}.speedFactor`),
    toughness: nonnegativeFinite(source.toughness, `${field}.toughness`),
    velocity: vector(source.velocity, `${field}.velocity`),
  }
}

export function nativeWeldMeteorDebris(
  value: unknown,
  field: string,
  expectedIndex: number,
  minimumScale = Math.fround(0.45),
  maximumScale = Math.fround(0.75),
): NativeWeldMeteorDebrisSeed {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha', 'colorGreen', 'height', 'index', 'position', 'record',
    'rotationDegrees', 'rotationStepDegrees', 'scale', 'velocity',
    'verticalVelocity',
  ])
  if (source.alpha !== 2 || source.index !== expectedIndex) {
    throw new GameProtocolError(`${field} does not match its native debris slot`)
  }
  const colorGreen = unitInterval(source.colorGreen, `${field}.colorGreen`)
  if (colorGreen > 0.5) {
    throw new GameProtocolError(`${field}.colorGreen exceeds the native range`)
  }
  const nativeRecord = positiveInteger(source.record, `${field}.record`)
  if (nativeRecord !== 2008 && nativeRecord !== 2009 && nativeRecord !== 2010) {
    throw new GameProtocolError(`${field}.record is not native Meteor debris`)
  }
  const scale = positiveFinite(source.scale, `${field}.scale`)
  if (scale < minimumScale || scale > maximumScale) {
    throw new GameProtocolError(`${field}.scale is outside the native range`)
  }
  return {
    alpha: 2,
    colorGreen,
    height: finite(source.height, `${field}.height`),
    index: expectedIndex,
    position: vector(source.position, `${field}.position`),
    record: nativeRecord,
    rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
    rotationStepDegrees: positiveFinite(
      source.rotationStepDegrees,
      `${field}.rotationStepDegrees`,
    ),
    scale,
    velocity: vector(source.velocity, `${field}.velocity`),
    verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
  }
}

export function nativeWeldBoulderDebris(
  value: unknown,
  field: string,
): NativeWeldBoulderDebrisParticleState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha', 'bounceVelocity', 'colorGreen', 'enhancedShadow', 'height', 'index',
    'position', 'record', 'rotationDegrees', 'rotationStepDegrees', 'scale',
    'velocity', 'verticalVelocity',
  ])
  const alpha = positiveFinite(source.alpha, `${field}.alpha`)
  const enhancedShadow = boolean(source.enhancedShadow, `${field}.enhancedShadow`)
  if (alpha > (enhancedShadow ? 10 : 2)) {
    throw new GameProtocolError(`${field}.alpha exceeds native debris life`)
  }
  const nativeRecord = positiveInteger(source.record, `${field}.record`)
  if (nativeRecord !== 2008 && nativeRecord !== 2009 && nativeRecord !== 2010) {
    throw new GameProtocolError(`${field}.record is not native BoulderBit art`)
  }
  const scale = positiveFinite(source.scale, `${field}.scale`)
  if (scale > 0.75) throw new GameProtocolError(`${field}.scale exceeds native debris size`)
  return {
    alpha,
    bounceVelocity: finite(source.bounceVelocity, `${field}.bounceVelocity`),
    colorGreen: unitInterval(source.colorGreen, `${field}.colorGreen`),
    enhancedShadow,
    height: finite(source.height, `${field}.height`),
    index: nonnegativeInteger(source.index, `${field}.index`),
    position: vector(source.position, `${field}.position`),
    record: nativeRecord,
    rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
    rotationStepDegrees: nonnegativeFinite(
      source.rotationStepDegrees,
      `${field}.rotationStepDegrees`,
    ),
    scale,
    velocity: vector(source.velocity, `${field}.velocity`),
    verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
  }
}

export function primarySpellWeldHailstones(
  source: Record<string, unknown>,
  field: string,
  commonKeys: readonly string[],
  common: Readonly<{
    ageTicks: number
    birthTick: number
    buildId: NativeWeldBuildId
    direction: Vector2
    id: number
    origin: Vector2
    ownerId: string
    vector: readonly number[]
    worldKey: string
  }>,
  pulseSequence: number,
): NativeWeldHailstonesState {
  onlyKeys(source, field, [
    ...commonKeys, 'collisionRadius', 'damage', 'maximumScale', 'phase', 'pulseSequence',
    'pushback', 'releaseAgeTicks', 'releaseFadeScale', 'rocks', 'scale',
    'toughness', 'widen',
  ])
  if (source.phase !== 'held' && source.phase !== 'flight') {
    throw new GameProtocolError(`${field}.phase is not a Hailstones phase`)
  }
  const phase = source.phase
  const maximumScale = positiveFinite(source.maximumScale, `${field}.maximumScale`)
  if (maximumScale !== NATIVE_WELD_HAILSTONES_SCALE_CEILING) {
    throw new GameProtocolError(`${field}.maximumScale is not the native cap`)
  }
  const scale = positiveFinite(source.scale, `${field}.scale`)
  if (scale < NATIVE_WELD_PERSISTENT_INITIAL_SCALE || scale > maximumScale) {
    throw new GameProtocolError(`${field}.scale is outside the native growth lane`)
  }
  const releaseFadeScale = source.releaseFadeScale === null
    ? null
    : positiveFinite(source.releaseFadeScale, `${field}.releaseFadeScale`)
  if ((phase === 'held' && releaseFadeScale !== null)
    || (phase === 'flight' && (releaseFadeScale === null
      || releaseFadeScale < 0.75 || releaseFadeScale >= 1.5))) {
    throw new GameProtocolError(`${field}.releaseFadeScale does not match the hail phase`)
  }
  const releaseAgeTicks = source.releaseAgeTicks === null
    ? null
    : nonnegativeInteger(source.releaseAgeTicks, `${field}.releaseAgeTicks`)
  if ((phase === 'held') !== (releaseAgeTicks === null)) {
    throw new GameProtocolError(`${field}.releaseAgeTicks does not match the hail phase`)
  }
  const rocks = limitedArray(source.rocks, `${field}.rocks`, 4096).map((rock, index) => (
    primarySpellWeldHailstone(rock, `${field}.rocks[${index}]`, phase)
  ))
  if (new Set(rocks.map(({ rockId }) => rockId)).size !== rocks.length) {
    throw new GameProtocolError(`${field}.rocks contains a duplicate native identity`)
  }
  const collisionRadius = positiveFinite(source.collisionRadius, `${field}.collisionRadius`)
  if (collisionRadius < 40 || (phase === 'held' && collisionRadius !== 40)) {
    throw new GameProtocolError(`${field}.collisionRadius does not match the Hail phase`)
  }
  return {
    ...common,
    buildId: 1008,
    collisionRadius,
    damage: positiveFinite(source.damage, `${field}.damage`),
    kind: 'weld-persistent',
    lightRegistration: nativeWorldManagerRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    maximumScale,
    phase,
    pulseSequence,
    pushback: nonnegativeFinite(source.pushback, `${field}.pushback`),
    releaseAgeTicks,
    releaseFadeScale,
    rocks,
    scale,
    toughness: nonnegativeFinite(source.toughness, `${field}.toughness`),
    widen: nonnegativeFinite(source.widen, `${field}.widen`),
  }
}

function primarySpellWeldHailstone(
  value: unknown,
  field: string,
  actorPhase: 'flight' | 'held',
): NativeWeldHailstoneRockState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'damageRemaining', 'decay', 'localPosition', 'phase', 'releaseOffset',
    'rockId', 'spriteRecord', 'visualScale',
  ])
  const decay = positiveFinite(source.decay, `${field}.decay`)
  const phase = unitInterval(source.phase, `${field}.phase`)
  if (decay > 1) throw new GameProtocolError(`${field}.decay exceeds one`)
  const local = record(source.localPosition, `${field}.localPosition`)
  onlyKeys(local, `${field}.localPosition`, ['x', 'y', 'z'])
  const releaseOffset = source.releaseOffset === null
    ? null
    : vector(source.releaseOffset, `${field}.releaseOffset`)
  if ((actorPhase === 'held') !== (releaseOffset === null)) {
    throw new GameProtocolError(`${field}.releaseOffset does not match the hail phase`)
  }
  const spriteRecord = positiveInteger(source.spriteRecord, `${field}.spriteRecord`)
  if (spriteRecord !== 168 && spriteRecord !== 169 && spriteRecord !== 170) {
    throw new GameProtocolError(`${field}.spriteRecord is not a native hail rock`)
  }
  const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
  if (visualScale >= 0.25) {
    throw new GameProtocolError(`${field}.visualScale exceeds the native draw range`)
  }
  return {
    damageRemaining: nonnegativeFinite(source.damageRemaining, `${field}.damageRemaining`),
    decay,
    localPosition: {
      x: finite(local.x, `${field}.localPosition.x`),
      y: finite(local.y, `${field}.localPosition.y`),
      z: finite(local.z, `${field}.localPosition.z`),
    },
    phase,
    rockId: nonnegativeInteger(source.rockId, `${field}.rockId`),
    releaseOffset,
    spriteRecord,
    visualScale,
  }
}
