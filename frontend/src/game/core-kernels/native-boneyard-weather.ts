import type { BoneyardBounds, BoneyardPoint } from './boneyard.ts'
import { createNativeRng, drawNativeFloat, type NativeRngState } from './native-rng.ts'

export const NATIVE_BONEYARD_WEATHER_SPLASH = Object.freeze({
  atlas: 'DeadHawg' as const,
  entry: 24,
})
export const NATIVE_BONEYARD_WEATHER_COLLISION_RADIUS = 4
export const NATIVE_BONEYARD_WEATHER_FIRST_ACTIVE_ARENA_AGE = 2
export const NATIVE_BONEYARD_WEATHER_RNG_TICK_MULTIPLIER = 0x0ef3
export const NATIVE_BONEYARD_WEATHER_STREAK_WIDTH = 1
export const NATIVE_BONEYARD_WEATHER_STREAK_MIN_LENGTH = 20
export const NATIVE_BONEYARD_WEATHER_STREAK_LENGTH_RANGE = 10

export interface NativeBoneyardWeatherDropPlan {
  readonly end: BoneyardPoint
  readonly endAlpha: number
  readonly endColor: number
  readonly height: number
  readonly id: number
  readonly length: number
  readonly position: BoneyardPoint
  readonly start: BoneyardPoint
  readonly startAlpha: number
  readonly startColor: number
  readonly width: number
}

export interface NativeBoneyardWeatherSplashPlan {
  readonly ageTicks: number
  readonly alpha: number
  readonly id: number
  readonly position: BoneyardPoint
  readonly scale: number
}

export interface NativeBoneyardWeatherPlan {
  readonly drops: readonly NativeBoneyardWeatherDropPlan[]
  readonly mode: number
  readonly spawnCount: number
  readonly splashes: readonly NativeBoneyardWeatherSplashPlan[]
  readonly splashAsset: typeof NATIVE_BONEYARD_WEATHER_SPLASH
  readonly tick: number
}

export type NativeBoneyardWeatherSpawnCollision = (
  position: Readonly<BoneyardPoint>,
  radius: number,
) => boolean

export type NativeBoneyardWeatherDropVisitor = (
  index: number,
  id: number,
  x: number,
  y: number,
  length: number,
  color: number,
) => void

export type NativeBoneyardWeatherSplashVisitor = (
  index: number,
  id: number,
  x: number,
  y: number,
  scale: number,
  alpha: number,
) => void

interface WeatherDropState {
  height: number
  id: number
  length: number
  lightScalar: number | null
  position: BoneyardPoint
}

interface WeatherSplashState {
  ageTicks: number
  growth: number
  id: number
  life: number
  loss: number
  position: BoneyardPoint
  scale: number
}

export interface NativeBoneyardWeatherOptions {
  readonly enhancedEffects: boolean
  readonly initialTick: number
  readonly mode: number
}

export class NativeBoneyardWeather {
  private arenaAge = 0
  private readonly enhancedEffects: boolean
  private readonly drops: WeatherDropState[] = []
  private readonly mode: number
  private readonly splashes: WeatherSplashState[] = []
  private currentTick: number
  private nextId = 1

  constructor(options: NativeBoneyardWeatherOptions) {
    if (!Number.isSafeInteger(options.initialTick) || options.initialTick < 0) {
      throw new RangeError('native Boneyard weather initial tick must be non-negative')
    }
    this.currentTick = options.initialTick
    this.enhancedEffects = options.enhancedEffects
    this.mode = options.mode
  }

  advanceTo(
    tick: number,
    bounds: Readonly<BoneyardBounds>,
    viewportWorldHeight: number,
    collides: NativeBoneyardWeatherSpawnCollision,
  ): void {
    if (!Number.isFinite(tick) || tick < 0) {
      throw new RangeError('native Boneyard weather tick must be a non-negative number')
    }
    const targetTick = Math.floor(tick)
    if (targetTick <= this.currentTick) return
    if (!Number.isFinite(viewportWorldHeight) || viewportWorldHeight <= 0) {
      throw new RangeError('native Boneyard weather viewport height must be positive')
    }
    for (let nextTick = this.currentTick + 1; nextTick <= targetTick; nextTick += 1) {
      let rng = createNativeRng(nativeBoneyardWeatherTickSeed(nextTick))
      this.stepExistingEffects()
      this.arenaAge += 1
      if (this.arenaAge < NATIVE_BONEYARD_WEATHER_FIRST_ACTIVE_ARENA_AGE) continue
      const spawnCount = nativeBoneyardWeatherSpawnCount(this.mode, this.enhancedEffects)
      for (let spawnIndex = 0; spawnIndex < spawnCount; spawnIndex += 1) {
        const sampled = this.sampleClearPoint(bounds, collides, rng)
        rng = sampled.rng
        const length = drawNativeFloat(rng, NATIVE_BONEYARD_WEATHER_STREAK_LENGTH_RANGE)
        rng = length.state
        this.drops.push({
          height: Math.fround(-viewportWorldHeight),
          id: this.nextId,
          length: Math.fround(NATIVE_BONEYARD_WEATHER_STREAK_MIN_LENGTH + length.value),
          lightScalar: null,
          position: sampled.point,
        })
        this.nextId += 1
        rng = this.spawnSplash(sampled.point, rng)
      }
    }
    this.currentTick = targetTick
  }

  plan(lightAt: (position: Readonly<BoneyardPoint>) => number = () => 1): NativeBoneyardWeatherPlan {
    const drops = this.drops.map((drop) => {
      if (drop.lightScalar === null) drop.lightScalar = clampUnit(lightAt(drop.position))
      const scalar = drop.lightScalar
      const color = grayscaleColor(scalar)
      return {
        end: {
          x: drop.position.x,
          y: drop.position.y + drop.height,
        },
        endAlpha: 0.5,
        endColor: color,
        height: drop.height,
        id: drop.id,
        length: drop.length,
        position: { ...drop.position },
        start: {
          x: drop.position.x,
          y: drop.position.y + drop.height - drop.length,
        },
        startAlpha: 0,
        startColor: color,
        width: NATIVE_BONEYARD_WEATHER_STREAK_WIDTH,
      }
    })
    const splashes = this.splashes.map((splash) => ({
      ageTicks: splash.ageTicks,
      alpha: Math.min(1, Math.max(0, splash.life)),
      id: splash.id,
      position: { ...splash.position },
      scale: splash.scale,
    }))
    return {
      drops,
      mode: this.mode,
      spawnCount: nativeBoneyardWeatherSpawnCount(this.mode, this.enhancedEffects),
      splashes,
      splashAsset: NATIVE_BONEYARD_WEATHER_SPLASH,
      tick: this.currentTick,
    }
  }

  visitDrops(
    lightAt: (position: Readonly<BoneyardPoint>) => number,
    visitor: NativeBoneyardWeatherDropVisitor,
  ): void {
    for (let index = 0; index < this.drops.length; index += 1) {
      const drop = this.drops[index]!
      if (drop.lightScalar === null) drop.lightScalar = clampUnit(lightAt(drop.position))
      visitor(
        index,
        drop.id,
        drop.position.x,
        drop.position.y + drop.height - drop.length / 2,
        drop.length,
        grayscaleColor(drop.lightScalar),
      )
    }
  }

  visitSplashes(visitor: NativeBoneyardWeatherSplashVisitor): void {
    for (let index = 0; index < this.splashes.length; index += 1) {
      const splash = this.splashes[index]!
      visitor(
        index,
        splash.id,
        splash.position.x,
        splash.position.y,
        splash.scale,
        Math.min(1, Math.max(0, splash.life)),
      )
    }
  }

  get activeDropCount(): number {
    return this.drops.length
  }

  get activeSplashCount(): number {
    return this.splashes.length
  }

  private sampleClearPoint(
    bounds: Readonly<BoneyardBounds>,
    collides: NativeBoneyardWeatherSpawnCollision,
    source: NativeRngState,
  ): { point: BoneyardPoint; rng: NativeRngState } {
    let rng = source
    for (;;) {
      const x = drawNativeFloat(rng, bounds.w)
      rng = x.state
      const y = drawNativeFloat(rng, bounds.h)
      rng = y.state
      const point = {
        x: Math.fround(bounds.x + x.value),
        y: Math.fround(bounds.y + y.value),
      }
      if (!collides(point, NATIVE_BONEYARD_WEATHER_COLLISION_RADIUS)) return { point, rng }
    }
  }

  private spawnSplash(position: BoneyardPoint, source: NativeRngState): NativeRngState {
    const initialScale = drawNativeFloat(source, 0.25)
    const loss = drawNativeFloat(initialScale.state, 0.05)
    const factor = drawNativeFloat(loss.state, 0.25)
    const scaleFactor = Math.fround(0.75 + factor.value)
    this.splashes.push({
      ageTicks: 0,
      growth: Math.fround(1 + scaleFactor * 0.01),
      id: this.nextId,
      life: scaleFactor,
      loss: Math.fround((0.05 + loss.value) * scaleFactor),
      position: { ...position },
      scale: Math.fround(0.5 + initialScale.value),
    })
    this.nextId += 1
    return factor.state
  }

  private stepExistingEffects(): void {
    let survivingDrops = 0
    for (let index = 0; index < this.drops.length; index += 1) {
      const drop = this.drops[index]!
      drop.height = Math.fround(drop.height + drop.length)
      if (drop.height <= 0) this.drops[survivingDrops++] = drop
    }
    this.drops.length = survivingDrops
    let survivingSplashes = 0
    for (let index = 0; index < this.splashes.length; index += 1) {
      const splash = this.splashes[index]!
      splash.ageTicks += 1
      splash.life = Math.fround(splash.life - splash.loss)
      splash.scale = Math.fround(splash.scale * splash.growth)
      if (splash.life > 0) this.splashes[survivingSplashes++] = splash
    }
    this.splashes.length = survivingSplashes
  }

}

export function nativeBoneyardWeatherSpawnCount(
  mode: number,
  enhancedEffects: boolean,
): number {
  if (mode === 1) return 3
  if (mode === 2) return enhancedEffects ? 20 : 10
  return 0
}

export function nativeBoneyardWeatherTickSeed(tick: number): number {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('native Boneyard weather tick must be a non-negative safe integer')
  }
  return (Math.imul(tick, NATIVE_BONEYARD_WEATHER_RNG_TICK_MULTIPLIER) >>> 0) & 0x3fff_ffff
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function grayscaleColor(scalar: number): number {
  const channel = Math.round(clampUnit(scalar) * 255)
  return (channel << 16) | (channel << 8) | channel
}
