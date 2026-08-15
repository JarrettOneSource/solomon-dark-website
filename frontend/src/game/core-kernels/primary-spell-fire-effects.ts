import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_FIRE_BURN_TICKS = 200
export const NATIVE_FIRE_EMBER_INITIAL_HEIGHT = -6
export const NATIVE_FIRE_EMBER_INITIAL_LIFE = 3
export const NATIVE_FIRE_EMBER_GRAVITY = Math.fround(0.15)
export const NATIVE_FIRE_EMBER_GROUNDED_LIFE_STEP = Math.fround(0.015)
export const NATIVE_FIRE_EMBER_IMMOLATE_FOOTPRINT = 110
export const NATIVE_FIRE_EMBER_PHASE_MAGNITUDE = 4

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

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function validateNonnegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be finite and non-negative`)
  }
}
