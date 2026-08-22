import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_BONEYARD_WEATHER_COLLISION_RADIUS,
  NATIVE_BONEYARD_WEATHER_FIRST_ACTIVE_ARENA_AGE,
  NATIVE_BONEYARD_WEATHER_SPLASH,
  NativeBoneyardWeather,
  nativeBoneyardWeatherSpawnCount,
  nativeBoneyardWeatherTickSeed,
} from './native-boneyard-weather.ts'

const BOUNDS = { h: 400, w: 600, x: -100, y: -50 }

function weather(mode: number, enhancedEffects: boolean = true): NativeBoneyardWeather {
  return new NativeBoneyardWeather({ enhancedEffects, initialTick: 0, mode })
}

test('world weather keeps clear, rainy, and stormy membership separate from ability rain', () => {
  assert.equal(nativeBoneyardWeatherSpawnCount(0, true), 0)
  assert.equal(nativeBoneyardWeatherSpawnCount(1, false), 3)
  assert.equal(nativeBoneyardWeatherSpawnCount(2, false), 10)
  assert.equal(nativeBoneyardWeatherSpawnCount(2, true), 20)
  assert.equal(nativeBoneyardWeatherSpawnCount(3, true), 0)
  assert.deepEqual(NATIVE_BONEYARD_WEATHER_SPLASH, { atlas: 'DeadHawg', entry: 24 })
})

test('weather begins at Arena age two and reseeds its native stream from the tick', () => {
  const direct = weather(1)
  const stepped = weather(1)
  direct.advanceTo(2, BOUNDS, 900, () => false)
  stepped.advanceTo(1, BOUNDS, 900, () => false)
  assert.equal(stepped.activeDropCount, 0)
  stepped.advanceTo(2, BOUNDS, 900, () => false)
  assert.equal(NATIVE_BONEYARD_WEATHER_FIRST_ACTIVE_ARENA_AGE, 2)
  assert.equal(nativeBoneyardWeatherTickSeed(2), 0x1de6)
  assert.deepEqual(stepped.plan(), direct.plan())
})

test('weather retries collision-only points and emits one streak plus splash per accepted point', () => {
  const source = weather(1)
  let collisionChecks = 0
  source.advanceTo(2, BOUNDS, 900, (_point, radius) => {
    collisionChecks += 1
    assert.equal(radius, NATIVE_BONEYARD_WEATHER_COLLISION_RADIUS)
    return collisionChecks <= 2
  })

  const plan = source.plan()
  assert.equal(plan.drops.length, 3)
  assert.equal(plan.splashes.length, 3)
  assert.ok(collisionChecks > 3)
  assert.ok(plan.drops.every((drop) => drop.length >= 20 && drop.length <= 30))
  assert.ok(plan.drops.every((drop) => drop.start.y < drop.end.y))
  assert.ok(plan.drops.every((drop) => drop.width === 1))
  assert.ok(plan.drops.every((drop) => drop.startAlpha === 0 && drop.endAlpha === 0.5))
})

test('stormy weather uses the native Enhanced Effects count after the Arena warmup', () => {
  const normal = weather(2, false)
  const enhanced = weather(2, true)
  normal.advanceTo(2, BOUNDS, 100, () => false)
  enhanced.advanceTo(2, BOUNDS, 100, () => false)
  assert.equal(normal.activeDropCount, 10)
  assert.equal(normal.activeSplashCount, 10)
  assert.equal(enhanced.activeDropCount, 20)
  assert.equal(enhanced.activeSplashCount, 20)
})

test('weather drops cache their first-draw light while splashes use native alpha and growth', () => {
  const source = weather(1, false)
  source.advanceTo(2, BOUNDS, 100, () => false)
  const initial = source.plan(() => 0.25)
  const initialSplash = initial.splashes[0]!
  assert.ok(initialSplash.alpha >= 0.75 && initialSplash.alpha <= 1)
  assert.ok(initialSplash.scale >= 0.5 && initialSplash.scale <= 0.75)
  assert.equal(source.plan(() => 1).drops[0]!.startColor, initial.drops[0]!.startColor)

  source.advanceTo(3, BOUNDS, 100, () => false)
  const nextSplash = source.plan().splashes[0]!
  assert.ok(nextSplash.alpha < initialSplash.alpha)
  assert.ok(nextSplash.scale > initialSplash.scale)
})

test('weather drops retire only after crossing the native floor and older samples do not rewind', () => {
  const source = weather(1, false)
  source.advanceTo(2, BOUNDS, 1, () => false)
  assert.equal(source.activeDropCount, 3)
  source.advanceTo(3, BOUNDS, 1, () => false)
  assert.equal(source.activeDropCount, 3)
  const current = source.plan()
  source.advanceTo(2, BOUNDS, 1, () => false)
  assert.deepEqual(source.plan(), current)
})

test('production weather visitors expose every persistent actor without rebuilding the plan graph', () => {
  const source = weather(2, true) as NativeBoneyardWeather & {
    visitDrops(
      lightAt: (position: Readonly<{ x: number; y: number }>) => number,
      visitor: (
        index: number,
        id: number,
        x: number,
        y: number,
        length: number,
        color: number,
      ) => void,
    ): void
    visitSplashes(
      visitor: (
        index: number,
        id: number,
        x: number,
        y: number,
        scale: number,
        alpha: number,
      ) => void,
    ): void
  }
  source.advanceTo(2, BOUNDS, 900, () => false)
  const plan = source.plan(() => 0.25)
  const drops: Array<readonly [number, number, number, number, number, number]> = []
  const splashes: Array<readonly [number, number, number, number, number, number]> = []

  assert.equal(typeof source.visitDrops, 'function')
  assert.equal(typeof source.visitSplashes, 'function')
  source.visitDrops(() => 1, (...values) => drops.push(values))
  source.visitSplashes((...values) => splashes.push(values))

  assert.deepEqual(drops, plan.drops.map((drop, index) => [
    index,
    drop.id,
    drop.position.x,
    (drop.start.y + drop.end.y) / 2,
    drop.length,
    drop.startColor,
  ]))
  assert.deepEqual(splashes, plan.splashes.map((splash, index) => [
    index,
    splash.id,
    splash.position.x,
    splash.position.y,
    splash.scale,
    splash.alpha,
  ]))
})
