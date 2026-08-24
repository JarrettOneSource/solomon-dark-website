import {
  NATIVE_HUB_NPC_CATALOG,
} from '../core-kernels/native-hub-npc.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import type { Vector2 } from '../core-kernels/vector.ts'

export type HubSkorchaGesture = 0 | 1 | 2
export type HubSkorchaVariant = 0 | 1 | 2

export interface HubSkorchaState {
  readonly dismissalIndex: 0 | 1 | 2
  readonly gesture: HubSkorchaGesture
  readonly gestureTicksRemaining: number
  readonly hatActive: boolean
  readonly hatPhaseDegrees: number
  readonly hatRateDegreesPerTick: number
  readonly position: Vector2
  readonly rng: NativeRngState
  readonly variant: HubSkorchaVariant
}

export interface HubSkorchaPopulationResult {
  readonly rng: NativeRngState
  readonly skorcha: HubSkorchaState | null
}

export function createHubSkorcha(seed: number): HubSkorchaState | null {
  return createHubSkorchaPopulation(seed).skorcha
}

export function createHubSkorchaPopulation(seed: number): HubSkorchaPopulationResult {
  return drawHubSkorchaPopulation(createNativeRng(seed ^ 5007))
}

export function drawHubSkorchaPopulation(
  sourceRng: NativeRngState,
): HubSkorchaPopulationResult {
  const presence = drawNativeInteger(
    sourceRng,
    NATIVE_HUB_NPC_CATALOG.skorcha.presenceDrawCount,
  )
  if (presence.value !== NATIVE_HUB_NPC_CATALOG.skorcha.presenceDrawValue) {
    return Object.freeze({ rng: presence.state, skorcha: null })
  }
  const placement = drawNativeInteger(
    presence.state,
    NATIVE_HUB_NPC_CATALOG.skorcha.placements.length,
  )
  const skorcha = createHubSkorchaAtVariant(
    placement.state,
    placement.value as HubSkorchaVariant,
  )
  return Object.freeze({ rng: skorcha.rng, skorcha })
}

export function createHubSkorchaAtVariant(
  sourceRng: NativeRngState,
  variant: HubSkorchaVariant,
): HubSkorchaState {
  const placement = NATIVE_HUB_NPC_CATALOG.skorcha.placements[variant]
  if (!placement) throw new RangeError('native Skorcha placement is invalid')
  const gesture = drawNativeInteger(
    sourceRng,
    NATIVE_HUB_NPC_CATALOG.skorcha.animationStateCount,
  )
  const dismissal = drawNativeInteger(gesture.state, 3)
  const delay = drawNativeInteger(
    dismissal.state,
    NATIVE_HUB_NPC_CATALOG.skorcha.animationDelay.drawCount,
  )
  return {
    dismissalIndex: dismissal.value as 0 | 1 | 2,
    gesture: gesture.value as HubSkorchaGesture,
    gestureTicksRemaining: delay.value
      + NATIVE_HUB_NPC_CATALOG.skorcha.animationDelay.offsetTicks,
    hatActive: false,
    hatPhaseDegrees: 0,
    hatRateDegreesPerTick: 0,
    position: { x: placement.x, y: placement.y },
    rng: delay.state,
    variant,
  }
}

export function stepHubSkorcha(source: HubSkorchaState): HubSkorchaState {
  const hat = stepHubSkorchaHat(source)
  const withHat = { ...source, ...hat }
  if (source.gestureTicksRemaining > 1) {
    return { ...withHat, gestureTicksRemaining: source.gestureTicksRemaining - 1 }
  }
  let rng = withHat.rng
  let gesture: HubSkorchaGesture
  do {
    const draw = drawNativeInteger(
      rng,
      NATIVE_HUB_NPC_CATALOG.skorcha.animationStateCount,
    )
    rng = draw.state
    gesture = draw.value as HubSkorchaGesture
  } while (gesture === source.gesture)
  const delay = drawNativeInteger(
    rng,
    NATIVE_HUB_NPC_CATALOG.skorcha.animationDelay.drawCount,
  )
  return {
    ...withHat,
    gesture,
    gestureTicksRemaining: delay.value
      + NATIVE_HUB_NPC_CATALOG.skorcha.animationDelay.offsetTicks,
    rng: delay.state,
  }
}

export function hubSkorchaHatFrame(source: HubSkorchaState): 0 | 1 | 2 | 3 | 4 {
  if (!source.hatActive) return 0
  const phaseRadians = Math.fround(source.hatPhaseDegrees * Math.PI / 180)
  const wave = Math.fround(Math.sin(phaseRadians))
  return Math.max(0, Math.min(4, Math.round(Math.fround(wave * 3.99)))) as 0 | 1 | 2 | 3 | 4
}

function stepHubSkorchaHat(source: HubSkorchaState): Pick<
  HubSkorchaState,
  'hatActive' | 'hatPhaseDegrees' | 'hatRateDegreesPerTick' | 'rng'
> {
  if (!source.hatActive) {
    const gate = drawNativeInteger(source.rng, 200)
    if (gate.value !== 2) return { ...source, rng: gate.state }
    const rate = drawNativeFloat(gate.state, 3)
    return {
      hatActive: true,
      hatPhaseDegrees: 0,
      hatRateDegreesPerTick: Math.fround(Math.fround(rate.value + 1) * 0.45),
      rng: rate.state,
    }
  }
  const hatPhaseDegrees = Math.fround(
    source.hatPhaseDegrees + source.hatRateDegreesPerTick,
  )
  return hatPhaseDegrees < 180
    ? { ...source, hatPhaseDegrees }
    : {
        hatActive: false,
        hatPhaseDegrees: 0,
        hatRateDegreesPerTick: source.hatRateDegreesPerTick,
        rng: source.rng,
      }
}
