import type { Vector2 } from '../core-kernels/vector.ts'
import {
  AIR_LIGHTNING_BODY_LIFETIME_TICKS,
  buildNativeAirCoronaPlan,
  buildNativeAirLightningFactoryPlan,
  buildNativeAirPathLightSources,
  nativeAirPresentationRandom,
  type NativeAirCoronaPlan,
  type NativeAirLightningFactoryPlan,
  type NativeAirPathLightPlan,
} from './primary-spell-air-native.ts'

export const NATIVE_MAGE_LIGHTNING_BODY_TICKS = AIR_LIGHTNING_BODY_LIFETIME_TICKS
export const NATIVE_MAGE_LIGHTNING_SOURCE_GLOW_TICKS = 1
export const NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_ALPHAS = [
  1,
  0.8,
  0.6,
  0.4,
  0.2,
] as const
export const NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_ALPHAS = [1, 0.6, 0.2] as const
export const NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_BASE_SCALE = 1
export const NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_BASE_SCALE = 0.5
export const NATIVE_MAGE_LIGHTNING_CONTACT_SCALE_JITTER = 0.25

const CONTACT_SAMPLE_SALT = 0x4d414745
const CONTACT_CORONA_SALT = 0x434f524f
const CONTACT_ANGLE_STEP_RADIANS = Math.PI / 180

export interface NativeMageLightningWorldContact {
  readonly kind: 'world'
  /** The factory already sampled the U(15) contact displacement. */
  readonly position: Readonly<Vector2>
}

export interface NativeMageLightningTargetContact {
  readonly kind: 'target-attached'
  /** Local to the target actor. The view must not translate it again. */
  readonly localOffset: Readonly<Vector2>
  readonly targetPlayerId: string
}

export type NativeMageLightningContact =
  | NativeMageLightningTargetContact
  | NativeMageLightningWorldContact

export interface NativeMageLightningPulseInput {
  readonly contact: NativeMageLightningContact
  /** Independently sampled factory endpoint; it is not the contact center. */
  readonly endpoint: Readonly<Vector2>
  readonly midpoint: Readonly<Vector2>
  /** Stable replicated cosmetic seed for this pulse. */
  readonly seed: number
  readonly source: Readonly<Vector2>
  /** Authoritative fixed tick at which the Mage factory created this pulse. */
  readonly tick: number
}

export type NativeMageLightningContactPlan =
  | {
      readonly corona: NativeAirCoronaPlan
      readonly kind: 'world'
      readonly position: Readonly<Vector2>
    }
  | {
      readonly corona: NativeAirCoronaPlan
      readonly kind: 'target-attached'
      readonly localOffset: Readonly<Vector2>
      readonly targetPlayerId: string
    }

export interface NativeMageLightningPulsePlan {
  readonly ageTicks: number
  readonly body: NativeAirLightningFactoryPlan['body']
  readonly contact: NativeMageLightningContactPlan
  readonly endpoint: Readonly<Vector2>
  readonly midpoint: Readonly<Vector2>
  readonly pathLights: readonly NativeAirPathLightPlan[]
  readonly source: Readonly<Vector2>
  readonly sourceCorona: NativeAirCoronaPlan | null
}

/**
 * Projects one native Mage Air factory call. The Mage action owns the repeated
 * pulse cadence; this function owns one pulse and never synthesizes a batch.
 */
export function nativeMageLightningPulsePlan(
  input: NativeMageLightningPulseInput,
  presentationTick: number,
): NativeMageLightningPulsePlan | null {
  if (!Number.isFinite(presentationTick)) {
    throw new RangeError('Mage lightning presentation tick must be finite')
  }
  if (!Number.isSafeInteger(input.tick) || input.tick < 0) {
    throw new RangeError('Mage lightning pulse tick must be a nonnegative safe integer')
  }
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffff_ffff) {
    throw new RangeError('Mage lightning pulse seed must be an unsigned 32-bit integer')
  }
  const ageTicks = Math.max(0, Math.floor(presentationTick - input.tick))
  const contactAlphas = input.contact.kind === 'world'
    ? NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_ALPHAS
    : NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_ALPHAS
  const contactAlpha = contactAlphas[ageTicks]
  if (contactAlpha === undefined) return null

  const localEndpoint = subtract(input.endpoint, input.source)
  const localMidpoint = subtract(input.midpoint, input.source)
  const factory = buildNativeAirLightningFactoryPlan({
    ageTicks,
    birthTick: input.tick,
    endpoint: localEndpoint,
    id: input.seed,
    midpoint: localMidpoint,
  })
  const contactRandom = nativeAirPresentationRandom(input.seed, CONTACT_SAMPLE_SALT)
  const contactScale = (
    input.contact.kind === 'world'
      ? NATIVE_MAGE_LIGHTNING_WORLD_CONTACT_BASE_SCALE
      : NATIVE_MAGE_LIGHTNING_TARGET_CONTACT_BASE_SCALE
  ) + contactRandom() * NATIVE_MAGE_LIGHTNING_CONTACT_SCALE_JITTER
  const contactAngle = contactRandom() * Math.PI * 2
    + ageTicks * CONTACT_ANGLE_STEP_RADIANS
  const contactCenter = input.contact.kind === 'world'
    ? input.contact.position
    : input.contact.localOffset
  const corona = buildNativeAirCoronaPlan({
    alpha: contactAlpha,
    angle: contactAngle,
    center: { ...contactCenter },
    randomSalt: CONTACT_CORONA_SALT ^ ageTicks,
    scale: contactScale,
    seed: input.seed,
  })

  return {
    ageTicks,
    body: factory.body,
    contact: input.contact.kind === 'world'
      ? {
          corona,
          kind: 'world',
          position: { ...input.contact.position },
        }
      : {
          corona,
          kind: 'target-attached',
          localOffset: { ...input.contact.localOffset },
          targetPlayerId: input.contact.targetPlayerId,
        },
    endpoint: { ...input.endpoint },
    midpoint: { ...input.midpoint },
    pathLights: ageTicks === 0
      ? buildNativeAirPathLightSources({
          birthTick: input.tick,
          endpoint: input.endpoint,
          id: input.seed,
          midpoint: input.midpoint,
          origin: input.source,
        })
      : [],
    source: { ...input.source },
    sourceCorona: factory.sourceCorona,
  }
}

function subtract(point: Readonly<Vector2>, origin: Readonly<Vector2>): Vector2 {
  return {
    x: point.x - origin.x,
    y: point.y - origin.y,
  }
}
