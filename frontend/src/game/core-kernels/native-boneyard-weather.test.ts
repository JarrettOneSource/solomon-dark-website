import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_BONEYARD_WEATHER_COLLISION_RADIUS,
  NATIVE_BONEYARD_WEATHER_SPLASH,
  NativeBoneyardWeather,
  nativeBoneyardWeatherSeed,
  nativeBoneyardWeatherSpawnCount,
} from './native-boneyard-weather.ts'

const BOUNDS = { h: 400, w: 600, x: -100, y: -50 }

test('world weather keeps clear, rainy, and stormy membership separate from ability rain', () => {
  assert.equal(nativeBoneyardWeatherSpawnCount(0, true), 0)
  assert.equal(nativeBoneyardWeatherSpawnCount(1, false), 3)
  assert.equal(nativeBoneyardWeatherSpawnCount(2, false), 10)
  assert.equal(nativeBoneyardWeatherSpawnCount(2, true), 20)
  assert.equal(nativeBoneyardWeatherSpawnCount(3, true), 0)
  assert.deepEqual(NATIVE_BONEYARD_WEATHER_SPLASH, { atlas: 'DeadHawg', entry: 24 })
})

test('rainy mode samples collision-free points and emits one streak plus splash per accepted point', () => {
  const weather = new NativeBoneyardWeather({
    enhancedEffects: true,
    initialTick: 0,
    mode: 1,
    seed: nativeBoneyardWeatherSeed('weather-run', 'weather-seed'),
  })
  let collisionChecks = 0
  weather.advanceTo(1, BOUNDS, 900, (point, radius) => {
    collisionChecks += 1
    assert.equal(radius, NATIVE_BONEYARD_WEATHER_COLLISION_RADIUS)
    return collisionChecks <= 2 || point.x < BOUNDS.x || point.y < BOUNDS.y
  })

  const plan = weather.plan()
  assert.equal(plan.drops.length, 3)
  assert.equal(plan.splashes.length, 3)
  assert.ok(collisionChecks > 3)
  assert.ok(plan.drops.every((drop) => drop.length >= 20 && drop.length <= 30))
  assert.ok(plan.drops.every((drop) => drop.start.y < drop.end.y))
  assert.ok(plan.drops.every((drop) => drop.width === 1))
  assert.ok(plan.drops.every((drop) => drop.startAlpha === 0 && drop.endAlpha === 0.5))
})

test('stormy enhanced weather retains a bounded local presentation population', () => {
  const weather = new NativeBoneyardWeather({
    enhancedEffects: true,
    initialTick: 0,
    mode: 2,
    seed: 77,
  })
  weather.advanceTo(1, BOUNDS, 100, () => true)
  assert.equal(weather.activeDropCount, 0)
  assert.equal(weather.activeSplashCount, 0)

  weather.advanceTo(2, BOUNDS, 100, () => false)
  assert.equal(weather.activeDropCount, 20)
  assert.equal(weather.activeSplashCount, 20)
  weather.advanceTo(100, BOUNDS, 100, () => true)
  assert.ok(weather.activeDropCount <= 100)
  assert.ok(weather.activeSplashCount <= 100)
})

test('weather uses a private deterministic seed and does not depend on authoritative RNG state', () => {
  const first = new NativeBoneyardWeather({
    enhancedEffects: false,
    initialTick: 10,
    mode: 1,
    seed: nativeBoneyardWeatherSeed('same-run', 'same-seed'),
  })
  const second = new NativeBoneyardWeather({
    enhancedEffects: false,
    initialTick: 10,
    mode: 1,
    seed: nativeBoneyardWeatherSeed('same-run', 'same-seed'),
  })
  first.advanceTo(11, BOUNDS, 900, () => true)
  second.advanceTo(11, BOUNDS, 900, () => true)
  assert.deepEqual(first.plan(), second.plan())
  assert.notEqual(
    nativeBoneyardWeatherSeed('same-run', 'same-seed'),
    nativeBoneyardWeatherSeed('other-run', 'same-seed'),
  )
})

test('weather drops retire after crossing the native floor while splashes fade and grow', () => {
  const weather = new NativeBoneyardWeather({
    enhancedEffects: false,
    initialTick: 0,
    mode: 1,
    seed: 3,
  })
  weather.advanceTo(1, BOUNDS, 1, () => false)
  const first = weather.plan()
  const firstSplash = first.splashes[0]!
  weather.advanceTo(2, BOUNDS, 1, () => true)
  const second = weather.plan()
  assert.equal(second.drops.length, 0)
  assert.ok(second.splashes[0]!.ageTicks > firstSplash.ageTicks)
  assert.ok(second.splashes[0]!.scale > firstSplash.scale)
  assert.ok(second.splashes[0]!.alpha < firstSplash.alpha)
})

test('weather ignores repeated or older presentation samples without rewinding local effects', () => {
  const weather = new NativeBoneyardWeather({
    enhancedEffects: false,
    initialTick: 0,
    mode: 1,
    seed: 3,
  })
  weather.advanceTo(2, BOUNDS, 100, () => false)
  const current = weather.plan()
  weather.advanceTo(1, BOUNDS, 100, () => false)
  assert.deepEqual(weather.plan(), current)
})
