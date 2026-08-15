import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import { actorHeadingFromVector } from './actor-heading.ts'
import type { PrimarySpellTarget } from './primary-spell-targeting.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_FIRE_BURN_TICKS = 200
export const NATIVE_FIRE_EMBER_INITIAL_HEIGHT = -6
export const NATIVE_FIRE_EMBER_INITIAL_LIFE = 3
export const NATIVE_FIRE_EMBER_GRAVITY = Math.fround(0.15)
export const NATIVE_FIRE_EMBER_GROUNDED_LIFE_STEP = Math.fround(0.015)
export const NATIVE_FIRE_EMBER_IMMOLATE_FOOTPRINT = 110
export const NATIVE_FIRE_EMBER_PHASE_MAGNITUDE = 4
export const NATIVE_FIRE_PATCH_CONTACT_DAMAGE_FACTOR = 3 * 0.5 / 100
export const NATIVE_FIRE_PATCH_CONTACT_FOOTPRINT = 32
export const NATIVE_FIRE_PATCH_INITIAL_LIFE = 2
export const NATIVE_FIRE_PATCH_LIFE_STEP = 0.01
export const NATIVE_FIRE_PATCH_ALPHA_STEP = Math.fround(0.05)
export const NATIVE_FIRE_PATCH_PHASE_STEP = Math.fround(0.25)
export const NATIVE_GOOD_IMP_ATTACK_RADIUS = 45
export const NATIVE_GOOD_IMP_ATTACK_REACH_FACTOR = 1.25
export const NATIVE_GOOD_IMP_BODY_SCALE_BASE = 0.9800000190734863
export const NATIVE_GOOD_IMP_BODY_SCALE_JITTER = Math.fround(0.05)
export const NATIVE_GOOD_IMP_CONTACT_VISIBLE_TICKS = 16
export const NATIVE_GOOD_IMP_FLIGHT_SPEED = Math.fround(4.5)
export const NATIVE_GOOD_IMP_MOVEMENT_CADENCE_TICKS = 10
export const NATIVE_GOOD_IMP_MOVEMENT_FACTOR = 0.25

export type NativeFirePatchType = 'fire' | 'goodguy' | 'moving'

export interface NativeFirePatchState {
  readonly ageTicks: number
  readonly alpha: number
  readonly burnDamage: number
  readonly damage: number
  readonly drawAlpha: number
  readonly id: number
  readonly kind: 'fire-patch'
  readonly life: number
  readonly nativeType: NativeFirePatchType
  readonly ownerId: string
  readonly phase: number
  readonly position: Vector2
  readonly scale: number
  readonly supplementalContact: boolean
  readonly velocity: Vector2
  readonly velocityMultiplier: Vector2
  readonly worldKey: string
}

export interface NativeFirePatchContact {
  readonly amount: number
  readonly burnDamage: number
  readonly footprintDimension: number
  readonly kind: 'fire-patch'
  readonly ownerId: string
  readonly position: Vector2
  readonly spellId: number
  readonly worldKey: string
}

export interface NativeFireGoodImpState {
  readonly ageTicks: number
  readonly bodyRotationDeg: number
  readonly bodyScale: number
  readonly bodyVariant: number
  readonly bounceSoundIndex: number
  readonly bounceSoundPitch: number
  readonly bounceSoundSequence: number
  readonly burnDamage: number
  readonly collisionRadius: number
  readonly contactAgeTicks: number | null
  readonly contactOrigin: Vector2 | null
  readonly contactScale: number
  readonly contactSoundIndex: number
  readonly contactSoundPitch: number
  readonly contactSoundSequence: number
  readonly damage: number
  readonly effectAlpha: number
  readonly effectPhase: number
  readonly flightSpeed: number
  readonly headingDegrees: number
  readonly id: number
  readonly lightGlow: number
  readonly ownerId: string
  readonly position: Vector2
  readonly remainingTicks: number
  readonly targetId: string | null
  readonly verticalOffset: number
  readonly verticalVelocity: number
  readonly worldKey: string
}

export interface NativeFireGoodImpContact {
  readonly amount: number
  readonly kind: 'fire-good-imp'
  readonly ownerId: string
  readonly spellId: number
  readonly targetId: string
  readonly worldKey: string
}

export type NativeFireActorContact = NativeFireGoodImpContact | NativeFirePatchContact

export type NativeFireSpentEmber =
  | Readonly<{ damage: number; kind: 'immolate' }>
  | Readonly<{ damage: number; kind: 'imp'; lifetimeTicks: number }>
  | Readonly<{ kind: 'none' }>

export interface NativeFireProjectilePayload {
  readonly burnDamage: number
  readonly emberDamage: number
  readonly emberFragments: number
  readonly explodeDamage: number
  readonly explodeRadius: number
  readonly privateSeed: number
  readonly spentEmber: NativeFireSpentEmber
}

export interface NativeFireEmberState {
  readonly ageTicks: number
  readonly burnDamage: number
  readonly damage: number
  readonly height: number
  readonly horizontalVelocity: Vector2
  readonly id: number
  readonly life: number
  readonly ownerId: string
  readonly phase: number
  readonly position: Vector2
  readonly presentationVariant: number
  readonly spentEmber: NativeFireSpentEmber
  readonly verticalVelocity: number
  readonly worldKey: string
}

export interface NativeFireExplosionState {
  readonly burnDamage: number
  readonly damage: number
  readonly footprintDimension: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly visualScale: number
  readonly worldKey: string
}

export interface NativeFireDetonation {
  readonly embers: readonly NativeFireEmberState[]
  readonly explosion: NativeFireExplosionState | null
  readonly nextId: number
  readonly rng: NativeRngState
}

export type NativeFireEmberRetirement =
  | Readonly<{ explosion: NativeFireExplosionState; kind: 'immolate' }>
  | Readonly<{
      burnDamage: number
      damage: number
      kind: 'imp'
      lifetimeTicks: number
      ownerId: string
      position: Vector2
      worldKey: string
    }>
  | Readonly<{ kind: 'none' }>

export interface NativeFireEmberStep {
  readonly ember: NativeFireEmberState | null
  readonly retirement: NativeFireEmberRetirement
}

export interface CreateNativeFirePatchOptions {
  readonly alpha?: number
  readonly burnDamage: number
  readonly damage: number
  readonly drawAlpha?: number
  readonly id: number
  readonly life?: number
  readonly nativeType: NativeFirePatchType
  readonly ownerId: string
  readonly phase?: number
  readonly position: Readonly<Vector2>
  readonly scale?: number
  readonly supplementalContact?: boolean
  readonly velocity?: Readonly<Vector2>
  readonly velocityMultiplier?: Readonly<Vector2>
  readonly worldKey: string
}

export interface NativeFireGoodImpStepContext {
  readonly canOccupy: (position: Vector2) => boolean
  readonly rng: NativeRngState
  readonly targets: readonly PrimarySpellTarget[]
}

export interface NativeFireGoodImpStep {
  readonly contact: NativeFireGoodImpContact | null
  readonly goodImp: NativeFireGoodImpState | null
  readonly releaseFire: boolean
  readonly releasePosition: Vector2
  readonly rng: NativeRngState
}

export interface SpawnNativeFireGoodImpOptions {
  readonly burnDamage: number
  readonly damage: number
  readonly id: number
  readonly lifetimeTicks: number
  readonly ownerId: string
  readonly position: Readonly<Vector2>
  readonly worldKey: string
}

export interface NativeFireGoodImpSpawn {
  readonly goodImp: NativeFireGoodImpState
  readonly rng: NativeRngState
}

export function createNativeFirePatch(
  options: CreateNativeFirePatchOptions,
): NativeFirePatchState {
  validateNonnegative(options.burnDamage, 'Fire patch Burn damage')
  validateNonnegative(options.damage, 'Fire patch damage')
  if (!Number.isSafeInteger(options.id) || options.id <= 0) {
    throw new RangeError('Fire patch id must be a positive safe integer')
  }
  const life = options.life ?? NATIVE_FIRE_PATCH_INITIAL_LIFE
  const scale = options.scale ?? 1
  const drawAlpha = options.drawAlpha ?? 1
  if (!Number.isFinite(life) || life <= 0) {
    throw new RangeError('Fire patch life must be finite and positive')
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('Fire patch scale must be finite and positive')
  }
  if (!Number.isFinite(drawAlpha) || drawAlpha < 0) {
    throw new RangeError('Fire patch draw alpha must be finite and non-negative')
  }
  return Object.freeze({
    ageTicks: 0,
    alpha: Math.fround(options.alpha ?? 0),
    burnDamage: options.burnDamage,
    damage: options.damage,
    drawAlpha,
    id: options.id,
    kind: 'fire-patch',
    life: Math.fround(life),
    nativeType: options.nativeType,
    ownerId: options.ownerId,
    phase: Math.fround(options.phase ?? 0),
    position: Object.freeze({ ...options.position }),
    scale: Math.fround(scale),
    supplementalContact: options.supplementalContact ?? false,
    velocity: Object.freeze({ ...(options.velocity ?? { x: 0, y: 0 }) }),
    velocityMultiplier: Object.freeze({
      ...(options.velocityMultiplier ?? { x: 1, y: 1 }),
    }),
    worldKey: options.worldKey,
  })
}

export function stepNativeFirePatch(
  source: NativeFirePatchState,
  globalTick: number,
): Readonly<{ contact: NativeFirePatchContact | null; patch: NativeFirePatchState | null }> {
  if (!Number.isSafeInteger(globalTick) || globalTick < 0) {
    throw new RangeError('Fire patch global tick must be a non-negative safe integer')
  }
  const phase = positiveModulo(
    Math.fround(source.phase + NATIVE_FIRE_PATCH_PHASE_STEP),
    32,
  )
  const life = Math.fround(source.life - NATIVE_FIRE_PATCH_LIFE_STEP)
  const alpha = Math.min(1, Math.fround(source.alpha + NATIVE_FIRE_PATCH_ALPHA_STEP))
  const contact = source.damage > 0 && globalTick % 3 === 0
    ? Object.freeze({
        amount: source.damage * NATIVE_FIRE_PATCH_CONTACT_DAMAGE_FACTOR,
        burnDamage: source.burnDamage,
        footprintDimension: NATIVE_FIRE_PATCH_CONTACT_FOOTPRINT * source.scale,
        kind: 'fire-patch' as const,
        ownerId: source.ownerId,
        position: Object.freeze({ ...source.position }),
        spellId: source.id,
        worldKey: source.worldKey,
      })
    : null
  if (life <= 0) return Object.freeze({ contact, patch: null })
  const position = Object.freeze({
    x: Math.fround(source.position.x + source.velocity.x),
    y: Math.fround(source.position.y + source.velocity.y),
  })
  const velocity = Object.freeze({
    x: Math.fround(source.velocity.x * source.velocityMultiplier.x),
    y: Math.fround(source.velocity.y * source.velocityMultiplier.y),
  })
  return Object.freeze({
    contact,
    patch: Object.freeze({
      ...source,
      ageTicks: source.ageTicks + 1,
      alpha,
      life,
      phase,
      position,
      velocity,
    }),
  })
}

/**
 * `Badguy` + `Imp` + `GoodImp` constructor chain
 * `0x006287D0 -> 0x00473390 -> 0x00473E30 -> 0x00529FE0`.
 *
 * The generic Badguy constructor consumes fourteen global RNG words before
 * the four Imp-owned visual/flight fields. Only body scale survives into the
 * Imp draw, but the discarded words still precede every later gameplay draw.
 */
export function spawnNativeFireGoodImp(
  options: SpawnNativeFireGoodImpOptions,
  sourceRng: NativeRngState,
): NativeFireGoodImpSpawn {
  validateNonnegative(options.burnDamage, 'GoodImp Burn damage')
  validateNonnegative(options.damage, 'GoodImp damage')
  if (!Number.isSafeInteger(options.id) || options.id <= 0) {
    throw new RangeError('GoodImp id must be a positive safe integer')
  }
  if (!Number.isSafeInteger(options.lifetimeTicks) || options.lifetimeTicks <= 0) {
    throw new RangeError('GoodImp lifetime must be a positive safe integer')
  }

  let rng = advanceNativeRngWords(sourceRng, 6)
  const bodyScaleDraw = drawNativeFloat(rng, NATIVE_GOOD_IMP_BODY_SCALE_JITTER, true)
  const bodyScale = Math.fround(NATIVE_GOOD_IMP_BODY_SCALE_BASE + bodyScaleDraw.value)
  rng = advanceNativeRngWords(bodyScaleDraw.state, 6)
  const collisionRadiusDraw = drawNativeFloat(rng, Math.fround(2.5))
  const effectPhaseDraw = drawNativeFloat(collisionRadiusDraw.state, 10)
  const bodyVariantDraw = drawNativeInteger(effectPhaseDraw.state, 4)
  const bodyRotationDraw = drawNativeFloat(bodyVariantDraw.state, 45, true)

  return Object.freeze({
    goodImp: Object.freeze({
      ageTicks: 0,
      bodyRotationDeg: bodyRotationDraw.value,
      bodyScale,
      bodyVariant: bodyVariantDraw.value,
      bounceSoundIndex: 0,
      bounceSoundPitch: 1,
      bounceSoundSequence: 0,
      burnDamage: options.burnDamage,
      collisionRadius: Math.fround(2.5 - collisionRadiusDraw.value),
      contactAgeTicks: null,
      contactOrigin: null,
      contactScale: 1,
      contactSoundIndex: 0,
      contactSoundPitch: 1,
      contactSoundSequence: 0,
      damage: options.damage,
      effectAlpha: 0,
      effectPhase: effectPhaseDraw.value,
      flightSpeed: NATIVE_GOOD_IMP_FLIGHT_SPEED,
      headingDegrees: 0,
      id: options.id,
      lightGlow: 0,
      ownerId: options.ownerId,
      position: Object.freeze({ ...options.position }),
      remainingTicks: options.lifetimeTicks,
      targetId: null,
      verticalOffset: 0,
      verticalVelocity: 0,
      worldKey: options.worldKey,
    }),
    rng: bodyRotationDraw.state,
  })
}

/** `GoodImp::Tick 0x0052C1A0` around exact shared `Imp::Tick 0x00485DC0`. */
export function stepNativeFireGoodImp(
  source: NativeFireGoodImpState,
  context: NativeFireGoodImpStepContext,
): NativeFireGoodImpStep {
  const target = goodImpTarget(source, context.targets)
  let headingDegrees = source.headingDegrees
  let position = source.position
  if (target !== null) {
    const dx = target.position.x - source.position.x
    const dy = target.position.y - source.position.y
    const distance = Math.hypot(dx, dy)
    headingDegrees = distance === 0 ? source.headingDegrees : actorHeadingFromVector(dx, dy)
    if (
      distance > 0
      && source.ageTicks % NATIVE_GOOD_IMP_MOVEMENT_CADENCE_TICKS === 0
    ) {
      const movement = Math.fround(
        source.flightSpeed
        * NATIVE_GOOD_IMP_MOVEMENT_FACTOR
        * NATIVE_GOOD_IMP_MOVEMENT_CADENCE_TICKS,
      )
      const requested = Object.freeze({
        x: Math.fround(source.position.x + dx / distance * movement),
        y: Math.fround(source.position.y + dy / distance * movement),
      })
      if (context.canOccupy(requested)) position = requested
    }
  }

  let rng = context.rng
  let effectPhase = positiveModulo(
    Math.fround(source.effectPhase + Math.abs(source.flightSpeed) * 0.25),
    10,
  )
  let verticalOffset = Math.fround(source.verticalOffset + source.verticalVelocity)
  let verticalVelocity = Math.fround(source.verticalVelocity + 0.4)
  let effectAlpha = Math.max(0, Math.fround(source.effectAlpha - 0.05))
  let bodyRotationDeg = source.bodyRotationDeg
  let bodyVariant = source.bodyVariant
  let bounceSoundIndex = source.bounceSoundIndex
  let bounceSoundPitch = source.bounceSoundPitch
  let bounceSoundSequence = source.bounceSoundSequence
  let flightSpeed = source.flightSpeed
  let contact: NativeFireGoodImpContact | null = null
  let contactAgeTicks = source.contactAgeTicks === null
    ? null
    : source.contactAgeTicks + 1 < NATIVE_GOOD_IMP_CONTACT_VISIBLE_TICKS
      ? source.contactAgeTicks + 1
      : null
  let contactOrigin = contactAgeTicks === null ? null : source.contactOrigin
  let contactScale = source.contactScale
  let contactSoundIndex = source.contactSoundIndex
  let contactSoundPitch = source.contactSoundPitch
  let contactSoundSequence = source.contactSoundSequence

  if (verticalOffset > 0) {
    verticalOffset = 0
    const speedDraw = drawNativeFloat(rng, Math.fround(1.5))
    flightSpeed = Math.fround((1 + speedDraw.value) * NATIVE_GOOD_IMP_FLIGHT_SPEED)
    const bouncePitch = drawNativeFloat(speedDraw.state, Math.fround(0.1))
    const bounceSound = drawNativeInteger(bouncePitch.state, 8)
    bounceSoundIndex = bounceSound.value
    bounceSoundPitch = Math.fround(1 + bouncePitch.value)
    bounceSoundSequence += 1
    const liftDraw = drawNativeFloat(bounceSound.state, 3)
    verticalVelocity = Math.fround(-(3 + liftDraw.value))
    const variantDraw = drawNativeInteger(liftDraw.state, 4)
    bodyVariant = variantDraw.value
    const rotationDraw = drawNativeFloat(variantDraw.state, 60, true)
    bodyRotationDeg = rotationDraw.value
    const highBounce = drawNativeInteger(rotationDraw.state, 20)
    rng = highBounce.state
    if (highBounce.value === 3) verticalVelocity = Math.fround(verticalVelocity * 1.5)
    effectAlpha = 1

    if (target !== null && goodImpTargetDistance(position, target) <= goodImpAttackReach(target)) {
      const contactPitch = drawNativeFloat(rng, Math.fround(0.25))
      const contactSound = drawNativeInteger(contactPitch.state, 3)
      contactSoundIndex = contactSound.value
      contactSoundPitch = Math.fround(1 + contactPitch.value)
      contactSoundSequence += 1
      const contactScaleDraw = drawNativeFloat(contactSound.state, Math.fround(0.1))
      contactScale = Math.fround(0.5 + contactScaleDraw.value)
      const turnDraw = drawNativeFloat(contactScaleDraw.state, 45)
      headingDegrees = positiveModulo(headingDegrees + 180 + turnDraw.value, 360)
      const fadeScale = drawNativeFloat(turnDraw.state, Math.fround(0.6))
      const fadeColor = drawNativeFloat(fadeScale.state, Math.fround(0.5))
      rng = fadeColor.state
      const headingRadians = headingDegrees * Math.PI / 180
      contactOrigin = Object.freeze({
        x: Math.fround(position.x + Math.sin(headingRadians) * 15),
        y: Math.fround(position.y - Math.cos(headingRadians) * 15 - 15),
      })
      contactAgeTicks = 0
      contact = Object.freeze({
        amount: source.damage,
        kind: 'fire-good-imp',
        ownerId: source.ownerId,
        spellId: source.id,
        targetId: target.id,
        worldKey: source.worldKey,
      })
    }
  }

  const remainingTicks = source.remainingTicks - 1 - (target === null ? 1 : 0)
  const releasePosition = Object.freeze({ ...position })
  if (remainingTicks <= 0) {
    return Object.freeze({
      contact,
      goodImp: null,
      releaseFire: true,
      releasePosition,
      rng,
    })
  }

  return Object.freeze({
    contact,
    goodImp: Object.freeze({
      ...source,
      ageTicks: source.ageTicks + 1,
      bodyRotationDeg,
      bodyVariant,
      bounceSoundIndex,
      bounceSoundPitch,
      bounceSoundSequence,
      contactAgeTicks,
      contactOrigin,
      contactScale,
      contactSoundIndex,
      contactSoundPitch,
      contactSoundSequence,
      effectAlpha,
      effectPhase,
      flightSpeed,
      headingDegrees,
      lightGlow: Math.min(1, Math.fround(source.lightGlow + 0.01)),
      position: releasePosition,
      remainingTicks,
      targetId: target?.id ?? null,
      verticalOffset,
      verticalVelocity,
    }),
    releaseFire: false,
    releasePosition,
    rng,
  })
}

export function drawNativeFirePrivateSeed(
  source: NativeRngState,
): Readonly<{ rng: NativeRngState; seed: number }> {
  const draw = drawNativeInteger(source, 1_000_001)
  return Object.freeze({ rng: draw.state, seed: draw.value })
}

export function nativeFireDirectDamage(
  baseDamage: number,
  explodeDamage: number,
): number {
  validateNonnegative(baseDamage, 'Fireball base damage')
  validateNonnegative(explodeDamage, 'Fireball explosion damage')
  const damage = explodeDamage > 0 ? baseDamage - explodeDamage : baseDamage
  if (damage < 0) throw new RangeError('Fireball explosion damage exceeds base damage')
  return damage
}

export function nativeFireExplosion(
  payload: Pick<NativeFireProjectilePayload, 'burnDamage' | 'explodeDamage' | 'explodeRadius'>,
  origin: Readonly<Vector2>,
  ownerId: string,
  worldKey: string,
): NativeFireExplosionState | null {
  if (payload.explodeRadius <= 0 || payload.explodeDamage <= 0) return null
  const visualScale = Math.fround((payload.explodeRadius - 10) * 0.18 + 1)
  return Object.freeze({
    burnDamage: payload.burnDamage,
    damage: payload.explodeDamage * 0.5,
    footprintDimension: visualScale * 110,
    origin: Object.freeze({ ...origin }),
    ownerId,
    visualScale,
    worldKey,
  })
}

export function createNativeFireDetonation(
  firstId: number,
  payload: NativeFireProjectilePayload,
  origin: Readonly<Vector2>,
  ownerId: string,
  worldKey: string,
  sourceRng: NativeRngState,
): NativeFireDetonation {
  if (!Number.isSafeInteger(firstId) || firstId <= 0) {
    throw new RangeError('Fire detonation first id must be a positive safe integer')
  }
  if (!Number.isSafeInteger(payload.emberFragments) || payload.emberFragments < 0) {
    throw new RangeError('Fire detonation fragment count must be a non-negative safe integer')
  }
  let privateRng = createNativeRng(payload.privateSeed)
  let sharedRng = sourceRng
  const startDraw = drawNativeFloat(privateRng, 360)
  privateRng = startDraw.state
  const step = payload.emberFragments === 0 ? 0 : 360 / payload.emberFragments
  const embers: NativeFireEmberState[] = []
  for (let index = 0; index < payload.emberFragments; index += 1) {
    // The Ember factory constructor consumes the active gameplay RNG before
    // the Fireball helper resumes its projectile-private fan stream. The
    // constructor's first vertical draw is overwritten below but still owns a
    // word in the authoritative stream.
    const phaseDraw = drawNativeFloat(sharedRng, NATIVE_FIRE_EMBER_PHASE_MAGNITUDE)
    const discardedVerticalDraw = drawNativeFloat(phaseDraw.state, 3)
    const presentationDraw = drawNativeInteger(discardedVerticalDraw.state, 10)
    sharedRng = presentationDraw.state

    const jitterDraw = drawNativeFloat(privateRng, step / 3, true)
    const speedDraw = drawNativeFloat(jitterDraw.state, 0.5)
    const verticalDraw = drawNativeFloat(speedDraw.state, 3)
    privateRng = verticalDraw.state
    const heading = (startDraw.value + index * step + jitterDraw.value) * Math.PI / 180
    const speed = Math.fround((1.5 + speedDraw.value) * 0.75)
    const horizontalVelocity = Object.freeze({
      x: Math.fround(Math.cos(heading) * speed),
      y: Math.fround(Math.sin(heading) * speed),
    })
    let ember: NativeFireEmberState = Object.freeze({
      ageTicks: 0,
      burnDamage: payload.burnDamage,
      damage: payload.emberDamage,
      height: NATIVE_FIRE_EMBER_INITIAL_HEIGHT,
      horizontalVelocity,
      id: firstId + index,
      life: NATIVE_FIRE_EMBER_INITIAL_LIFE,
      ownerId,
      phase: phaseDraw.value,
      position: Object.freeze({
        x: Math.fround(origin.x + horizontalVelocity.x * 10),
        y: Math.fround(origin.y + horizontalVelocity.y * 10),
      }),
      presentationVariant: presentationDraw.value,
      spentEmber: payload.spentEmber,
      verticalVelocity: Math.fround(-(2 + verticalDraw.value)),
      worldKey,
    })
    for (let tick = 0; tick < 10; tick += 1) {
      const stepped = stepNativeFireEmber(ember)
      if (!stepped.ember) throw new Error('newborn Ember retired during native pre-ticks')
      ember = stepped.ember
    }
    embers.push(ember)
  }
  return Object.freeze({
    embers: Object.freeze(embers),
    explosion: nativeFireExplosion(payload, origin, ownerId, worldKey),
    nextId: firstId + embers.length,
    rng: sharedRng,
  })
}

export function stepNativeFireEmber(
  source: NativeFireEmberState,
): NativeFireEmberStep {
  let position = source.position
  let height = source.height
  let horizontalVelocity = source.horizontalVelocity
  let verticalVelocity = source.verticalVelocity
  let life = source.life

  if (verticalVelocity !== 0) {
    const movementFactor = Math.min(Math.abs(verticalVelocity), 1)
    position = Object.freeze({
      x: Math.fround(position.x + horizontalVelocity.x * movementFactor),
      y: Math.fround(position.y + horizontalVelocity.y * movementFactor),
    })
    height = Math.fround(height + verticalVelocity)
    verticalVelocity = Math.fround(verticalVelocity + NATIVE_FIRE_EMBER_GRAVITY)
    if (height > 0) {
      height = 0
      verticalVelocity = Math.fround(verticalVelocity * -0.5)
      horizontalVelocity = Object.freeze({
        x: Math.fround(horizontalVelocity.x * 0.5),
        y: Math.fround(horizontalVelocity.y * 0.5),
      })
      if (verticalVelocity >= -0.5) verticalVelocity = 0
    }
  } else {
    life = Math.fround(life - NATIVE_FIRE_EMBER_GROUNDED_LIFE_STEP)
  }

  const phase = life > 1
    ? positiveModulo(Math.fround(source.phase + 0.25), 4)
    : source.phase
  const ember = Object.freeze({
    ...source,
    ageTicks: source.ageTicks + 1,
    height,
    horizontalVelocity,
    life,
    phase,
    position,
    verticalVelocity,
  })
  if (verticalVelocity !== 0 || life >= 1) {
    return Object.freeze({ ember, retirement: Object.freeze({ kind: 'none' }) })
  }
  if (source.spentEmber.kind === 'immolate') {
    return Object.freeze({
      ember: null,
      retirement: Object.freeze({
        explosion: Object.freeze({
          burnDamage: source.burnDamage,
          damage: source.spentEmber.damage * 0.5,
          footprintDimension: NATIVE_FIRE_EMBER_IMMOLATE_FOOTPRINT,
          origin: Object.freeze({ ...position }),
          ownerId: source.ownerId,
          visualScale: 1,
          worldKey: source.worldKey,
        }),
        kind: 'immolate',
      }),
    })
  }
  if (source.spentEmber.kind === 'imp') {
    return Object.freeze({
      ember: null,
      retirement: Object.freeze({
        burnDamage: source.burnDamage,
        damage: source.spentEmber.damage * 0.5,
        kind: 'imp',
        lifetimeTicks: source.spentEmber.lifetimeTicks,
        ownerId: source.ownerId,
        position: Object.freeze({ ...position }),
        worldKey: source.worldKey,
      }),
    })
  }
  return life <= 0
    ? Object.freeze({ ember: null, retirement: Object.freeze({ kind: 'none' }) })
    : Object.freeze({ ember, retirement: Object.freeze({ kind: 'none' }) })
}

function goodImpTarget(
  source: NativeFireGoodImpState,
  targets: readonly PrimarySpellTarget[],
): PrimarySpellTarget | null {
  const eligible = (target: PrimarySpellTarget): boolean => (
    target.active
    && !target.pendingRemove
    && (target.actorFlags & 0x2) !== 0
  )
  const current = source.targetId === null
    ? null
    : targets.find((target) => target.id === source.targetId && eligible(target)) ?? null
  if (current !== null) return current

  let selected: PrimarySpellTarget | null = null
  let selectedDistance = Number.POSITIVE_INFINITY
  for (const target of targets) {
    if (!eligible(target)) continue
    const distance = goodImpTargetDistance(source.position, target)
    if (
      distance < selectedDistance
      || (
        distance === selectedDistance
        && selected !== null
        && target.registrationOrder < selected.registrationOrder
      )
    ) {
      selected = target
      selectedDistance = distance
    }
  }
  return selected
}

function goodImpAttackReach(target: PrimarySpellTarget): number {
  return Math.fround(
    (target.bodyRadius + NATIVE_GOOD_IMP_ATTACK_RADIUS)
    * NATIVE_GOOD_IMP_ATTACK_REACH_FACTOR,
  )
}

function goodImpTargetDistance(
  position: Readonly<Vector2>,
  target: PrimarySpellTarget,
): number {
  return Math.hypot(
    target.position.x - position.x,
    target.position.y - position.y,
  )
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function validateNonnegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be finite and non-negative`)
  }
}
