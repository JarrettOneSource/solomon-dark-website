import type { NativeWeldBlizzardGlowState } from '../../core-kernels/native-weld-blizzard.ts'
import {
  NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS,
} from '../../core-kernels/native-weld-boulder-debris.ts'
import {
  NATIVE_WELD_FLAME_LASH_FADE_ALPHA_STEP,
  type NativeWeldFlameLashFadeState,
} from '../../core-kernels/native-weld-flame-lash.ts'
import {
  NATIVE_WELD_HAIL_FLASH_ALPHA_STEP,
  NATIVE_WELD_HAIL_LINE_ALPHA_STEP,
  type NativeWeldHailFlashState,
  type NativeWeldHailKnockbackState,
  type NativeWeldHailLineState,
  type NativeWeldHailTerrainBouncerState,
  type NativeWeldHailTerrainParticleState,
} from '../../core-kernels/native-weld-hail-contact.ts'
import type { NativeWeldMeteorMarkerState } from '../../core-kernels/native-weld-meteor.ts'
import {
  NATIVE_WELD_CHANNEL_VISIBLE_TICKS,
  NATIVE_WELD_HAIL_RELEASE_FADE_LIFETIME_TICKS,
  NATIVE_WELD_HAIL_ROCK_FADE_LIFETIME_TICKS,
  NATIVE_WELD_IMPACT_VISIBLE_TICKS,
  NATIVE_WELD_METEOR_IMPACT_TICKS,
  NATIVE_WELD_METEOR_PULSE_TICKS,
  type NativeWeldBlizzardChainFrostState,
  type NativeWeldBoulderDebrisActorState,
  type NativeWeldChannelActorState,
  type NativeWeldFrostFadeActorState,
  type NativeWeldGroundSparkFadeActorState,
  type NativeWeldHailRockFadeActorState,
  type NativeWeldImpactActorState,
  type NativeWeldMeteorActorState,
  type NativeWeldMeteorFieldState,
  type NativeWeldMeteorFlashActorState,
  type NativeWeldWorldActor,
} from '../../core-kernels/native-weld-primary-runtime.ts'
import type { NativeWeldSteamActorState } from '../../core-kernels/native-weld-steam.ts'
import {
  absentNativeActorLight,
  nativeWorldManagerRegistration,
  unitVector,
  vector,
} from './native-state.ts'
import { requireWeldHailBuild, weldBuildId, weldVector } from './primary-projectiles.ts'
import {
  GameProtocolError,
  boolean,
  finite,
  limitedArray,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  unitInterval,
  validatedPlayerId,
} from './values.ts'
import {
  nativeWeldBoulderDebris,
  nativeWeldMeteorDebris,
  primarySpellWeldEtherealBoulder,
  primarySpellWeldHailstones,
} from './weld-children.ts'

export function primarySpellWeldActor(
  source: Record<string, unknown>,
  field: string,
): NativeWeldWorldActor {
  const buildId = weldBuildId(source.buildId, `${field}.buildId`)
  const commonKeys = [
    'ageTicks', 'birthTick', 'buildId', 'direction', 'id', 'kind',
    'lightRegistration', 'origin', 'ownerId', 'vector', 'worldKey',
  ]
  const common = {
    ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
    birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
    buildId,
    direction: unitVector(source.direction, `${field}.direction`),
    id: positiveInteger(source.id, `${field}.id`),
    origin: vector(source.origin, `${field}.origin`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    vector: weldVector(source.vector, buildId, `${field}.vector`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }

  if (source.kind === 'weld-meteor-marker') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'colorGreen', 'growthFactor', 'rotationDegrees', 'scale',
    ])
    if (buildId !== 1007) throw new GameProtocolError(`${field}.buildId is not Meteor Swarm`)
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    if (alpha > 0.5) throw new GameProtocolError(`${field}.alpha exceeds native marker range`)
    const colorGreen = unitInterval(source.colorGreen, `${field}.colorGreen`)
    if (colorGreen > 0.5) {
      throw new GameProtocolError(`${field}.colorGreen exceeds native marker range`)
    }
    const growthFactor = finite(source.growthFactor, `${field}.growthFactor`)
    if (growthFactor !== Math.fround(0.99) && growthFactor !== Math.fround(1.015)) {
      throw new GameProtocolError(`${field}.growthFactor is not a native marker branch`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees > 360) {
      throw new GameProtocolError(`${field}.rotationDegrees is outside [0,360]`)
    }
    return {
      ...common,
      alpha,
      buildId: 1007,
      colorGreen,
      growthFactor,
      kind: 'weld-meteor-marker',
      lightRegistration: absentNativeActorLight(source, field),
      rotationDegrees,
      scale: positiveFinite(source.scale, `${field}.scale`),
    } satisfies NativeWeldMeteorMarkerState
  }

  if (source.kind === 'weld-channel') {
    onlyKeys(source, field, [
      ...commonKeys, 'endpoint', 'midpoint', 'targetId', 'underpowered', 'variant',
    ])
    if (buildId !== 1003 && buildId !== 1004) {
      throw new GameProtocolError(`${field}.buildId is not a welded channel build`)
    }
    if (common.ageTicks >= NATIVE_WELD_CHANNEL_VISIBLE_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the welded channel lifetime`)
    }
    const variant = nonnegativeInteger(source.variant, `${field}.variant`)
    if (variant > 3) throw new GameProtocolError(`${field}.variant exceeds the native family`)
    const endpoint = source.endpoint === null
      ? null
      : vector(source.endpoint, `${field}.endpoint`)
    const midpoint = source.midpoint === null
      ? null
      : vector(source.midpoint, `${field}.midpoint`)
    if ((endpoint === null) !== (midpoint === null)) {
      throw new GameProtocolError(`${field}.endpoint and midpoint must be present together`)
    }
    return {
      ...common,
      buildId,
      endpoint,
      kind: 'weld-channel',
      lightRegistration: absentNativeActorLight(source, field),
      midpoint,
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      underpowered: boolean(source.underpowered, `${field}.underpowered`),
      variant,
    } satisfies NativeWeldChannelActorState
  }

  if (source.kind === 'weld-impact') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'boulderTerminalCharge', 'impactSoundPitch',
      'impactSoundVariant', 'position', 'presentationRotationDegrees',
      'presentationScale',
    ])
    if (buildId === 1003 || buildId === 1004 || buildId === 1005) {
      throw new GameProtocolError(`${field}.buildId cannot create a welded impact actor`)
    }
    if (common.ageTicks >= NATIVE_WELD_IMPACT_VISIBLE_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the welded impact lifetime`)
    }
    const alpha = nonnegativeFinite(source.alpha, `${field}.alpha`)
    const boulderTerminalCharge = source.boulderTerminalCharge === null
      ? null
      : positiveFinite(source.boulderTerminalCharge, `${field}.boulderTerminalCharge`)
    const impactSoundPitch = source.impactSoundPitch === null
      ? null
      : positiveFinite(source.impactSoundPitch, `${field}.impactSoundPitch`)
    const impactSoundVariant = source.impactSoundVariant === null
      ? null
      : nonnegativeInteger(source.impactSoundVariant, `${field}.impactSoundVariant`)
    const presentationRotationDegrees = source.presentationRotationDegrees === null
      ? null
      : finite(source.presentationRotationDegrees, `${field}.presentationRotationDegrees`)
    const presentationScale = nonnegativeFinite(
      source.presentationScale,
      `${field}.presentationScale`,
    )
    const ownsStandardFade = buildId === 1001 || buildId === 1002 || buildId === 1009
    if ((buildId === 1006 && (alpha > 2 || presentationScale !== 2))
      || (ownsStandardFade && (alpha > 2 || presentationScale !== Math.fround(1.5)))
      || (!ownsStandardFade && buildId !== 1006 && (alpha !== 0 || presentationScale !== 0))) {
      throw new GameProtocolError(`${field} fade state does not match its build`)
    }
    if ((buildId === 1006) !== (boulderTerminalCharge !== null)) {
      throw new GameProtocolError(`${field}.boulderTerminalCharge does not match its build`)
    }
    if ((buildId === 1001 && (impactSoundPitch !== Math.fround(1.5)
      || impactSoundVariant !== null || presentationRotationDegrees !== null))
      || (buildId === 1002 && (impactSoundPitch !== Math.fround(1.5)
        || impactSoundVariant !== 0 || presentationRotationDegrees === null))
      || (buildId === 1009 && (impactSoundPitch === null
        || impactSoundPitch < 1 || impactSoundPitch > Math.fround(1.1)
        || impactSoundVariant === null || impactSoundVariant > 2
        || presentationRotationDegrees === null))
      || ((buildId !== 1001 && buildId !== 1002 && buildId !== 1009)
        && (impactSoundPitch !== null || impactSoundVariant !== null
          || presentationRotationDegrees !== null))) {
      throw new GameProtocolError(`${field} impact presentation does not match its build`)
    }
    if (presentationRotationDegrees !== null
      && (presentationRotationDegrees < 0 || presentationRotationDegrees > 360)) {
      throw new GameProtocolError(`${field}.presentationRotationDegrees is outside [0,360]`)
    }
    return {
      ...common,
      alpha,
      boulderTerminalCharge,
      buildId,
      impactSoundPitch,
      impactSoundVariant,
      kind: 'weld-impact',
      lightRegistration: buildId === 1006
        ? nativeWorldManagerRegistration(
            source.lightRegistration,
            `${field}.lightRegistration`,
            'transient',
          )
        : absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      presentationRotationDegrees,
      presentationScale,
    } satisfies NativeWeldImpactActorState
  }

  if (source.kind === 'weld-boulder-debris') {
    onlyKeys(source, field, [...commonKeys, 'debris', 'position'])
    if (buildId !== 1006 && buildId !== 1007) {
      throw new GameProtocolError(`${field}.buildId is not a Boulder carrier`)
    }
    if (common.ageTicks >= NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the BoulderBit lifetime`)
    }
    const debris = nativeWeldBoulderDebris(source.debris, `${field}.debris`)
    return {
      ...common,
      buildId,
      debris,
      kind: 'weld-boulder-debris',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
    } satisfies NativeWeldBoulderDebrisActorState
  }

  if (source.kind === 'weld-blizzard-glow') {
    onlyKeys(source, field, [
      ...commonKeys, 'rotationDegrees', 'scale', 'variant',
    ])
    const variant = source.variant
    if (
      buildId !== 1004
      || common.ageTicks !== 0
      || (variant !== 3 && variant !== 24)
    ) {
      throw new GameProtocolError(`${field}.BlizzardGlow`)
    }
    const scale = positiveFinite(source.scale, `${field}.scale`)
    if (scale < 1 || scale > 1.5) {
      throw new GameProtocolError(`${field}.scale`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees > 360) {
      throw new GameProtocolError(`${field}.rotationDegrees`)
    }
    return {
      ...common,
      buildId: 1004,
      kind: 'weld-blizzard-glow',
      lightRegistration: absentNativeActorLight(source, field),
      rotationDegrees,
      scale,
      variant: variant as 3 | 24,
    } satisfies NativeWeldBlizzardGlowState
  }

  if (source.kind === 'weld-blizzard-chain-frost') {
    onlyKeys(source, field, commonKeys)
    if (buildId !== 1004 || common.ageTicks >= 33) {
      throw new GameProtocolError(`${field}.chainFrost`)
    }
    return {
      ...common,
      buildId: 1004,
      kind: 'weld-blizzard-chain-frost',
      lightRegistration: absentNativeActorLight(source, field),
    } satisfies NativeWeldBlizzardChainFrostState
  }

  if (source.kind === 'weld-flame-lash-fade') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'baseScale', 'colorGreen', 'position',
      'record', 'rotationDegrees', 'variant', 'wrapperScalar',
    ])
    if (buildId !== 1003) throw new GameProtocolError(`${field}.buildId is not Flame Lash`)
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alpha > 1 || alphaStep !== NATIVE_WELD_FLAME_LASH_FADE_ALPHA_STEP
      || common.ageTicks >= 6) {
      throw new GameProtocolError(`${field} exceeds the Flame Lash fade clock`)
    }
    const variant = source.variant
    if (variant !== 'endpoint' && variant !== 'chain') {
      throw new GameProtocolError(`${field}.variant is not a Flame Lash fade branch`)
    }
    const baseScale = positiveFinite(source.baseScale, `${field}.baseScale`)
    if ((variant === 'endpoint' && (baseScale < 0.5 || baseScale > 1))
      || (variant === 'chain' && (
        baseScale < Math.fround(0.05)
        || baseScale > Math.fround(0.1)
      ))) {
      throw new GameProtocolError(`${field}.baseScale exceeds its Flame Lash branch`)
    }
    const colorGreen = unitInterval(source.colorGreen, `${field}.colorGreen`)
    if ((variant === 'chain' && colorGreen !== Math.fround(0.75))
      || (variant === 'endpoint' && (colorGreen < 0.5 || colorGreen > 1))) {
      throw new GameProtocolError(`${field}.colorGreen exceeds its Flame Lash branch`)
    }
    const wrapperScalar = positiveFinite(source.wrapperScalar, `${field}.wrapperScalar`)
    if (wrapperScalar < 0.75 || wrapperScalar > 1.5) {
      throw new GameProtocolError(`${field}.wrapperScalar exceeds the native range`)
    }
    if (source.record !== 35) throw new GameProtocolError(`${field}.record is not BadGuys 35`)
    return {
      ...common,
      alpha,
      alphaStep,
      baseScale,
      buildId: 1003,
      colorGreen,
      kind: 'weld-flame-lash-fade',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 35,
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      variant,
      wrapperScalar,
    } satisfies NativeWeldFlameLashFadeState
  }

  if (source.kind === 'weld-hail-line') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'end', 'endAlpha', 'start', 'width',
    ])
    requireWeldHailBuild(buildId, field)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alphaStep !== NATIVE_WELD_HAIL_LINE_ALPHA_STEP || common.ageTicks >= 14) {
      throw new GameProtocolError(`${field} does not match the native Hail line lifetime`)
    }
    const endAlpha = positiveFinite(source.endAlpha, `${field}.endAlpha`)
    if (endAlpha < 0.25 || endAlpha > 0.5) {
      throw new GameProtocolError(`${field}.endAlpha exceeds the native line range`)
    }
    const width = positiveFinite(source.width, `${field}.width`)
    if (width !== 6) throw new GameProtocolError(`${field}.width is not native`)
    return {
      ...common,
      alpha: positiveFinite(source.alpha, `${field}.alpha`),
      alphaStep,
      buildId: 1008,
      end: vector(source.end, `${field}.end`),
      endAlpha,
      kind: 'weld-hail-line',
      lightRegistration: absentNativeActorLight(source, field),
      start: vector(source.start, `${field}.start`),
      width,
    } satisfies NativeWeldHailLineState
  }

  if (source.kind === 'weld-hail-flash') {
    onlyKeys(source, field, [...commonKeys, 'alpha', 'alphaStep', 'position', 'record'])
    requireWeldHailBuild(buildId, field)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alphaStep !== NATIVE_WELD_HAIL_FLASH_ALPHA_STEP || common.ageTicks >= 10) {
      throw new GameProtocolError(`${field} does not match the native Hail flash lifetime`)
    }
    if (source.record !== 15) throw new GameProtocolError(`${field}.record is not BadGuys 15`)
    return {
      ...common,
      alpha: positiveFinite(source.alpha, `${field}.alpha`),
      alphaStep,
      buildId: 1008,
      kind: 'weld-hail-flash',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 15,
    } satisfies NativeWeldHailFlashState
  }

  if (source.kind === 'weld-hail-knockback') {
    onlyKeys(source, field, [...commonKeys, 'delta', 'remainingTicks', 'targetId'])
    requireWeldHailBuild(buildId, field)
    const remainingTicks = positiveInteger(source.remainingTicks, `${field}.remainingTicks`)
    if (remainingTicks > 20) {
      throw new GameProtocolError(`${field}.remainingTicks exceeds native Hail push`)
    }
    return {
      ...common,
      buildId: 1008,
      delta: unitVector(source.delta, `${field}.delta`),
      kind: 'weld-hail-knockback',
      lightRegistration: absentNativeActorLight(source, field),
      remainingTicks,
      targetId: limitedString(source.targetId, `${field}.targetId`, 256),
    } satisfies NativeWeldHailKnockbackState
  }

  if (source.kind === 'weld-hail-terrain-particle') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'position', 'record', 'rotationDegrees',
      'scale', 'tint', 'velocity', 'velocityFactor',
    ])
    requireWeldHailBuild(buildId, field)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    const velocityFactor = positiveFinite(source.velocityFactor, `${field}.velocityFactor`)
    if (alphaStep !== Math.fround(0.125) || velocityFactor !== Math.fround(0.92)
      || common.ageTicks >= 8) {
      throw new GameProtocolError(`${field} does not match native Hail terrain motion`)
    }
    if (source.record !== 45) throw new GameProtocolError(`${field}.record is not BadGuys 45`)
    return {
      ...common,
      alpha: positiveFinite(source.alpha, `${field}.alpha`),
      alphaStep,
      buildId: 1008,
      kind: 'weld-hail-terrain-particle',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 45,
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      scale: positiveFinite(source.scale, `${field}.scale`),
      tint: nonnegativeInteger(source.tint, `${field}.tint`),
      velocity: vector(source.velocity, `${field}.velocity`),
      velocityFactor,
    } satisfies NativeWeldHailTerrainParticleState
  }

  if (source.kind === 'weld-hail-terrain-bouncer') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'bounceVelocity', 'enhancedShadow', 'height',
      'position', 'record', 'rotationDegrees', 'rotationStepDegrees', 'scale',
      'velocity', 'verticalVelocity',
    ])
    requireWeldHailBuild(buildId, field)
    if (common.ageTicks >= 500 || source.record !== 32) {
      throw new GameProtocolError(`${field} exceeds the native Hail bouncer contract`)
    }
    return {
      ...common,
      alpha: positiveFinite(source.alpha, `${field}.alpha`),
      bounceVelocity: finite(source.bounceVelocity, `${field}.bounceVelocity`),
      buildId: 1008,
      enhancedShadow: boolean(source.enhancedShadow, `${field}.enhancedShadow`),
      height: finite(source.height, `${field}.height`),
      kind: 'weld-hail-terrain-bouncer',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 32,
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      rotationStepDegrees: finite(
        source.rotationStepDegrees,
        `${field}.rotationStepDegrees`,
      ),
      scale: positiveFinite(source.scale, `${field}.scale`),
      velocity: vector(source.velocity, `${field}.velocity`),
      verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
    } satisfies NativeWeldHailTerrainBouncerState
  }

  if (source.kind === 'weld-hail-rock-fade') {
    onlyKeys(source, field, [...commonKeys, 'position', 'rotationDegrees'])
    if (buildId !== 1008) throw new GameProtocolError(`${field}.buildId is not Hailstones`)
    if (common.ageTicks >= NATIVE_WELD_HAIL_ROCK_FADE_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Hail rock-fade lifetime`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees > 20) {
      throw new GameProtocolError(`${field}.rotationDegrees exceeds the native range`)
    }
    return {
      ...common,
      buildId: 1008,
      kind: 'weld-hail-rock-fade',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      rotationDegrees,
    } satisfies NativeWeldHailRockFadeActorState
  }

  if (source.kind === 'weld-frost-fade') {
    onlyKeys(source, field, [...commonKeys, 'scale'])
    const blizzard = buildId === 1004
    if (!blizzard && buildId !== 1008) throw new GameProtocolError(`${field}.buildId`)
    const scale = positiveFinite(source.scale, `${field}.scale`)
    if (
      common.ageTicks >= (blizzard ? 3 : NATIVE_WELD_HAIL_RELEASE_FADE_LIFETIME_TICKS)
      || scale < (blizzard ? 1 : 3.75)
      || scale > (blizzard ? 1.5 : 7.5)
    ) {
      throw new GameProtocolError(`${field} Frost-fade range`)
    }
    return {
      ...common,
      buildId,
      kind: 'weld-frost-fade',
      lightRegistration: absentNativeActorLight(source, field),
      scale,
    } satisfies NativeWeldFrostFadeActorState
  }

  if (source.kind === 'weld-ground-spark-fade') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'position', 'record',
      'rotationDegrees', 'scale',
    ])
    if (buildId !== 1009) {
      throw new GameProtocolError(`${field}.buildId is not Crawling Shock`)
    }
    if (common.ageTicks >= 20) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the GroundSpark fade lifetime`)
    }
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    if (alpha > 1.75) throw new GameProtocolError(`${field}.alpha exceeds the native range`)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alphaStep !== Math.fround(0.05) && alphaStep !== Math.fround(0.1)) {
      throw new GameProtocolError(`${field}.alphaStep is not a native GroundSpark branch`)
    }
    const nativeRecord = positiveInteger(source.record, `${field}.record`)
    if (nativeRecord !== 71 && (
      nativeRecord < 1836 || nativeRecord > 1839
    )) throw new GameProtocolError(`${field}.record is not GroundSpark art`)
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees > 360) {
      throw new GameProtocolError(`${field}.rotationDegrees is outside [0,360]`)
    }
    const scale = positiveFinite(source.scale, `${field}.scale`)
    if (scale < Math.fround(0.25) || scale > 1) {
      throw new GameProtocolError(`${field}.scale exceeds the native GroundSpark range`)
    }
    return {
      ...common,
      alpha,
      alphaStep,
      buildId: 1009,
      kind: 'weld-ground-spark-fade',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: nativeRecord as NativeWeldGroundSparkFadeActorState['record'],
      rotationDegrees,
      scale,
    } satisfies NativeWeldGroundSparkFadeActorState
  }

  if (source.kind === 'weld-steam') {
    onlyKeys(source, field, [
      ...commonKeys, 'alphaMultiplier', 'blue', 'colorRise', 'life', 'lifeLoss',
      'contactDamage', 'contactDue', 'contactEnabled', 'contactTicksRemaining',
      'phase', 'position', 'remainingDistance', 'rotationDegrees', 'scale', 'stretch',
      'terminalPosition', 'tintFade', 'variant', 'velocity',
    ])
    if (buildId !== 1005) throw new GameProtocolError(`${field}.buildId is not Steam Jet`)
    if (common.ageTicks >= 512) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Steam particle lifetime`)
    }
    const variant = source.variant
    if (variant !== 'normal' && variant !== 'over') {
      throw new GameProtocolError(`${field}.variant is not a Steam particle branch`)
    }
    const colorRise = positiveFinite(source.colorRise, `${field}.colorRise`)
    if ((variant === 'normal' && colorRise !== Math.fround(0.15))
      || (variant === 'over' && colorRise !== Math.fround(0.075))) {
      throw new GameProtocolError(`${field}.colorRise does not match its Steam branch`)
    }
    const life = positiveFinite(source.life, `${field}.life`)
    const lifeLoss = positiveFinite(source.lifeLoss, `${field}.lifeLoss`)
    if (life > 1.15 || lifeLoss < 0.005 || lifeLoss > 0.055) {
      throw new GameProtocolError(`${field} Steam life state exceeds the native range`)
    }
    const blue = finite(source.blue, `${field}.blue`)
    if (blue > 0.75 || blue < -64) {
      throw new GameProtocolError(`${field}.blue exceeds the native secondary-color lane`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees >= 360) {
      throw new GameProtocolError(`${field}.rotationDegrees is outside [0,360)`)
    }
    const contactEnabled = boolean(source.contactEnabled, `${field}.contactEnabled`)
    const contactDue = boolean(source.contactDue, `${field}.contactDue`)
    const contactTicksRemaining = nonnegativeInteger(
      source.contactTicksRemaining,
      `${field}.contactTicksRemaining`,
    )
    if (contactTicksRemaining > 10 || (!contactEnabled && contactDue)) {
      throw new GameProtocolError(`${field} Steam contact clock is malformed`)
    }
    const alphaMultiplier = positiveFinite(
      source.alphaMultiplier,
      `${field}.alphaMultiplier`,
    )
    if (alphaMultiplier !== 1 && alphaMultiplier !== Math.fround(0.25)) {
      throw new GameProtocolError(`${field}.alphaMultiplier is not a native power branch`)
    }
    return {
      ...common,
      alphaMultiplier,
      blue,
      buildId: 1005,
      colorRise,
      contactDamage: positiveFinite(source.contactDamage, `${field}.contactDamage`),
      contactDue,
      contactEnabled,
      contactTicksRemaining,
      kind: 'weld-steam',
      life,
      lifeLoss,
      lightRegistration: absentNativeActorLight(source, field),
      phase: nonnegativeFinite(source.phase, `${field}.phase`),
      position: vector(source.position, `${field}.position`),
      remainingDistance: nonnegativeFinite(
        source.remainingDistance,
        `${field}.remainingDistance`,
      ),
      rotationDegrees,
      scale: positiveFinite(source.scale, `${field}.scale`),
      stretch: positiveFinite(source.stretch, `${field}.stretch`),
      terminalPosition: vector(source.terminalPosition, `${field}.terminalPosition`),
      tintFade: nonnegativeFinite(source.tintFade, `${field}.tintFade`),
      variant,
      velocity: vector(source.velocity, `${field}.velocity`),
    } satisfies NativeWeldSteamActorState
  }

  if (source.kind === 'weld-meteor-flash') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'position', 'record', 'scale',
    ])
    if (buildId !== 1007) throw new GameProtocolError(`${field}.buildId is not Meteor Swarm`)
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alpha > 2 || alphaStep !== Math.fround(0.1) || common.ageTicks >= 20) {
      throw new GameProtocolError(`${field} does not match the native Meteor flash lifetime`)
    }
    if (source.record !== 15 || source.scale !== 6) {
      throw new GameProtocolError(`${field} does not use the native Meteor flash art`)
    }
    return {
      ...common,
      alpha,
      alphaStep,
      buildId: 1007,
      kind: 'weld-meteor-flash',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 15,
      scale: 6,
    } satisfies NativeWeldMeteorFlashActorState
  }

  if (source.kind === 'weld-meteor') {
    onlyKeys(source, field, [
      ...commonKeys, 'bodyScale', 'cameraDisplacement', 'damage', 'debris',
      'fallHeadingDegrees', 'fallHeight', 'fallStep', 'impactAgeTicks', 'impactDue',
      'impactRadiusScalar', 'landingPosition',
      'impactRotationDegrees', 'impactSoundPitch', 'impactThrowFirePitch',
      'impactTicksRemaining',
      'phase', 'position', 'privateSeed', 'pulseDue', 'pulseSequence',
      'pulseTicksRemaining', 'underpowered',
    ])
    if (buildId !== 1007) throw new GameProtocolError(`${field}.buildId is not Meteor Swarm`)
    if (source.phase !== 'fall' && source.phase !== 'impact') {
      throw new GameProtocolError(`${field}.phase is not a welded Meteor phase`)
    }
    const bodyScale = positiveFinite(source.bodyScale, `${field}.bodyScale`)
    if (bodyScale < 0.75 || bodyScale > 1) {
      throw new GameProtocolError(`${field}.bodyScale is outside the native constructor lane`)
    }
    const fallStep = positiveFinite(source.fallStep, `${field}.fallStep`)
    const fallHeight = finite(source.fallHeight, `${field}.fallHeight`)
    if ((source.phase === 'fall' && (fallHeight <= 0 || fallHeight > 6.25))
      || (source.phase === 'impact' && (fallHeight > 0 || fallHeight <= -fallStep))) {
      throw new GameProtocolError(`${field}.fallHeight does not match the Meteor phase`)
    }
    const underpowered = boolean(source.underpowered, `${field}.underpowered`)
    const privateSeed = nonnegativeInteger(source.privateSeed, `${field}.privateSeed`)
    if ((underpowered && privateSeed !== 0)
      || (!underpowered && privateSeed >= 10_000_000)) {
      throw new GameProtocolError(`${field}.privateSeed exceeds the native draw bound`)
    }
    const impactTicksRemaining = positiveInteger(
      source.impactTicksRemaining,
      `${field}.impactTicksRemaining`,
    )
    const maximumImpactTicks = underpowered
      ? NATIVE_WELD_METEOR_IMPACT_TICKS
      : Math.round(NATIVE_WELD_METEOR_IMPACT_TICKS + common.vector[4]! * 50)
    if (impactTicksRemaining > maximumImpactTicks) {
      throw new GameProtocolError(`${field}.impactTicksRemaining exceeds its native clock`)
    }
    const pulseTicksRemaining = positiveInteger(
      source.pulseTicksRemaining,
      `${field}.pulseTicksRemaining`,
    )
    if (pulseTicksRemaining > NATIVE_WELD_METEOR_PULSE_TICKS) {
      throw new GameProtocolError(`${field}.pulseTicksRemaining exceeds its native clock`)
    }
    const cameraDisplacement = source.cameraDisplacement === null
      ? null
      : vector(source.cameraDisplacement, `${field}.cameraDisplacement`)
    const impactAgeTicks = nonnegativeInteger(source.impactAgeTicks, `${field}.impactAgeTicks`)
    const impactRadiusScalar = finite(
      source.impactRadiusScalar,
      `${field}.impactRadiusScalar`,
    )
    if (impactRadiusScalar <= 0 || impactRadiusScalar > 1.5
      || (source.phase === 'fall' && impactRadiusScalar !== 1)
      || (source.phase === 'impact' && (
        impactRadiusScalar < bodyScale
        || impactRadiusScalar > Math.fround(bodyScale + 0.5)
      ))) {
      throw new GameProtocolError(`${field}.impactRadiusScalar is outside the native lane`)
    }
    const impactRotationDegrees = finite(
      source.impactRotationDegrees,
      `${field}.impactRotationDegrees`,
    )
    if (impactRotationDegrees < 0 || impactRotationDegrees > 360) {
      throw new GameProtocolError(`${field}.impactRotationDegrees is outside [0,360]`)
    }
    const impactSoundPitch = source.impactSoundPitch === null
      ? null
      : positiveFinite(source.impactSoundPitch, `${field}.impactSoundPitch`)
    if (
      impactSoundPitch !== null
      && (impactSoundPitch < 0.8 || impactSoundPitch > Math.fround(1.2))
    ) {
      throw new GameProtocolError(`${field}.impactSoundPitch is outside the native lane`)
    }
    const impactThrowFirePitch = source.impactThrowFirePitch === null
      ? null
      : positiveFinite(source.impactThrowFirePitch, `${field}.impactThrowFirePitch`)
    if (impactThrowFirePitch !== null && impactThrowFirePitch !== Math.fround(0.8)) {
      throw new GameProtocolError(`${field}.impactThrowFirePitch is not native`)
    }
    const debris = limitedArray(source.debris, `${field}.debris`, 5).map((value, index) => (
      nativeWeldMeteorDebris(value, `${field}.debris[${index}]`, index)
    ))
    if ((source.phase === 'fall' && (debris.length !== 0
      || cameraDisplacement !== null || impactAgeTicks !== 0
      || impactRadiusScalar !== 1 || impactRotationDegrees !== 0
      || impactSoundPitch !== null || impactThrowFirePitch !== null))
      || (source.phase === 'impact' && (debris.length !== 0
        || cameraDisplacement === null))
      || ((impactSoundPitch !== null) !== (source.phase === 'impact'))
      || ((impactThrowFirePitch !== null) !== (
        source.phase === 'impact'
        && !underpowered
      ))) {
      throw new GameProtocolError(`${field} Meteor phase-owned presentation state is malformed`)
    }
    const fallHeadingDegrees = finite(
      source.fallHeadingDegrees,
      `${field}.fallHeadingDegrees`,
    )
    if (fallHeadingDegrees < -50 || fallHeadingDegrees > 50) {
      throw new GameProtocolError(`${field}.fallHeadingDegrees is outside the native lane`)
    }
    return {
      ...common,
      bodyScale,
      buildId: 1007,
      cameraDisplacement,
      damage: positiveFinite(source.damage, `${field}.damage`),
      debris,
      fallHeadingDegrees,
      fallHeight,
      fallStep,
      impactAgeTicks,
      impactDue: boolean(source.impactDue, `${field}.impactDue`),
      impactRadiusScalar,
      impactRotationDegrees,
      impactSoundPitch,
      impactThrowFirePitch,
      impactTicksRemaining,
      kind: 'weld-meteor',
      landingPosition: vector(source.landingPosition, `${field}.landingPosition`),
      lightRegistration: nativeWorldManagerRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'actor',
      ),
      phase: source.phase,
      position: vector(source.position, `${field}.position`),
      privateSeed,
      pulseDue: boolean(source.pulseDue, `${field}.pulseDue`),
      pulseSequence: nonnegativeInteger(source.pulseSequence, `${field}.pulseSequence`),
      pulseTicksRemaining,
      underpowered,
    } satisfies NativeWeldMeteorActorState
  }

  if (source.kind !== 'weld-persistent') {
    throw new GameProtocolError(`${field}.kind is not a welded actor`)
  }
  if (buildId !== 1006 && buildId !== 1007 && buildId !== 1008) {
    throw new GameProtocolError(`${field}.buildId is not a welded persistent build`)
  }
  const pulseSequence = nonnegativeInteger(source.pulseSequence, `${field}.pulseSequence`)
  if (buildId === 1007) {
    onlyKeys(source, field, [...commonKeys, 'phase', 'pulseSequence'])
    if (source.phase !== 'held') {
      throw new GameProtocolError(`${field}.phase is not the Meteor Swarm channel phase`)
    }
    return {
      ...common,
      buildId: 1007,
      kind: 'weld-persistent',
      lightRegistration: absentNativeActorLight(source, field),
      phase: 'held',
      pulseSequence,
    } satisfies NativeWeldMeteorFieldState
  }
  if (buildId === 1006) {
    return primarySpellWeldEtherealBoulder(source, field, commonKeys, common, pulseSequence)
  }
  return primarySpellWeldHailstones(source, field, commonKeys, common, pulseSequence)
}
