import type { BoneyardBounds, BoneyardPoint } from './boneyard.ts'
import { createNativeRng, drawNativeFloat, type NativeRngState } from './native-rng.ts'

export const NATIVE_BONEYARD_WEATHER_SPLASH = Object.freeze({
  atlas: 'DeadHawg' as const,
  entry: 24,
})
export const NATIVE_BONEYARD_WEATHER_COLLISION_RADIUS = 4
export const NATIVE_BONEYARD_WEATHER_MAX_SPAWN_ATTEMPTS = 1_024
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

interface WeatherDropState {
  height: number
  id: number
  length: number
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
  readonly seed: number
}

export class NativeBoneyardWeather {
  private readonly enhancedEffects: boolean
  private readonly drops: WeatherDropState[] = []
  private readonly mode: number
  private readonly splashes: WeatherSplashState[] = []
  private currentTick: number
  private nextId = 1
  private rng: NativeRngState

  constructor(options: NativeBoneyardWeatherOptions) {
    if (!Number.isSafeInteger(options.initialTick) || options.initialTick < 0) {
      throw new RangeError('native Boneyard weather initial tick must be non-negative')
    }
    if (!Number.isSafeInteger(options.seed)) {
      throw new RangeError('native Boneyard weather seed must be a safe integer')
    }
    this.currentTick = options.initialTick
    this.enhancedEffects = options.enhancedEffects
    this.mode = options.mode
    this.rng = createNativeRng(options.seed)
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
    const spawnCount = nativeBoneyardWeatherSpawnCount(this.mode, this.enhancedEffects)
    for (let nextTick = this.currentTick + 1; nextTick <= targetTick; nextTick += 1) {
      this.stepExistingEffects()
      for (let spawnIndex = 0; spawnIndex < spawnCount; spawnIndex += 1) {
        const point = this.sampleClearPoint(bounds, collides)
        if (point === null) continue
        const length = drawNativeFloat(this.rng, NATIVE_BONEYARD_WEATHER_STREAK_LENGTH_RANGE)
        this.rng = length.state
        this.drops.push({
          height: Math.fround(-viewportWorldHeight),
          id: this.nextId,
          length: Math.fround(NATIVE_BONEYARD_WEATHER_STREAK_MIN_LENGTH + length.value),
          position: point,
        })
        this.nextId += 1
        this.spawnSplash(point)
      }
    }
    this.currentTick = targetTick
  }

  plan(lightAt: (position: Readonly<BoneyardPoint>) => number = () => 1): NativeBoneyardWeatherPlan {
    const drops = this.drops.map((drop) => {
      const scalar = clampUnit(lightAt(drop.position))
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

  get activeDropCount(): number {
    return this.drops.length
  }

  get activeSplashCount(): number {
    return this.splashes.length
  }

  private sampleClearPoint(
    bounds: Readonly<BoneyardBounds>,
    collides: NativeBoneyardWeatherSpawnCollision,
  ): BoneyardPoint | null {
    for (let attempt = 0; attempt < NATIVE_BONEYARD_WEATHER_MAX_SPAWN_ATTEMPTS; attempt += 1) {
      const x = drawNativeFloat(this.rng, bounds.w)
      this.rng = x.state
      const y = drawNativeFloat(this.rng, bounds.h)
      this.rng = y.state
      const point = {
        x: Math.fround(bounds.x + x.value),
        y: Math.fround(bounds.y + y.value),
      }
      if (!collides(point, NATIVE_BONEYARD_WEATHER_COLLISION_RADIUS)) return point
    }
    return null
  }

  private spawnSplash(position: BoneyardPoint): void {
    const initialScale = drawNativeFloat(this.rng, 0.25)
    this.rng = initialScale.state
    const loss = drawNativeFloat(this.rng, 0.05)
    this.rng = loss.state
    const factor = drawNativeFloat(this.rng, 0.25)
    this.rng = factor.state
    const scaleFactor = Math.fround(0.75 + factor.value)
    this.splashes.push({
      ageTicks: 0,
      growth: 1.01,
      id: this.nextId,
      life: Math.fround(scaleFactor * 0.5),
      loss: Math.fround((0.05 + loss.value) * scaleFactor),
      position: { ...position },
      scale: Math.fround(0.5 + initialScale.value),
    })
    this.nextId += 1
  }

  private stepExistingEffects(): void {
    for (let index = this.drops.length - 1; index >= 0; index -= 1) {
      const drop = this.drops[index]!
      drop.height = Math.fround(drop.height + drop.length)
      if (drop.height > 0) this.drops.splice(index, 1)
    }
    for (let index = this.splashes.length - 1; index >= 0; index -= 1) {
      const splash = this.splashes[index]!
      splash.ageTicks += 1
      splash.life = Math.fround(splash.life - splash.loss)
      splash.scale = Math.fround(splash.scale * splash.growth)
      if (splash.life <= 0) this.splashes.splice(index, 1)
    }
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

export function nativeBoneyardWeatherSeed(runId: string, sourceSeed: string): number {
  let hash = 0x811c9dc5
  for (const value of `${runId}:${sourceSeed}`) {
    hash ^= value.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function grayscaleColor(scalar: number): number {
  const channel = Math.round(clampUnit(scalar) * 255)
  return (channel << 16) | (channel << 8) | channel
}
