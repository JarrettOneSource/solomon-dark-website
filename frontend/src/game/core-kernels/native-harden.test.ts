import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeHarden, interpolateNativeHardenCoating, nativeHardenBreakAngleStep, stepNativeHarden } from './native-harden.ts'
import { createNativeHardenBreakup, createNativeHardenChip, stepNativeHardenEffect } from './native-harden-effects.ts'
import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'

test('all eleven Harden ranks accrue physical armor with an independent coating clock', () => {
  const rates = [0, 8, 12, 18, 25, 30, 35, 40, 45, 50, 60]
  const caps = [0, 25, 50, 75, 100, 125, 150, 175, 200, 250, 300]
  for (const [rank, rate] of rates.entries()) {
    let state = createNativeHarden()
    for (let tick = 0; tick < 1_000; tick++) state = stepNativeHarden(state, 'water', rate / 100, caps[rank]!)
    assert.equal(state.armor, caps[rank], `rank ${rank}`)
    assert.equal(state.coating, rank === 0 ? 0 : 1)
    assert.strictEqual(stepNativeHarden(state, 'other', rate / 100, caps[rank]!), state)
    assert.deepEqual(stepNativeHarden(state, 'idle', rate / 100, caps[rank]!), { armor: 0, coating: 0 })
    assert.deepEqual(stepNativeHarden(state, 'weak-water', rate / 100, caps[rank]!), { armor: 0, coating: 0 })
  }
})

test('coating retains the native float-store threshold crossings and idle identity', () => {
  let state = createNativeHarden()
  assert.strictEqual(stepNativeHarden(state, 'idle', 0.12, 50), state)
  assert.strictEqual(stepNativeHarden(state, 'water', 0, 0), state)
  for (let tick = 0; tick < 50; tick++) state = stepNativeHarden(state, 'water', 0.12, 50)
  assert.ok(state.coating < 0.25)
  state = stepNativeHarden(state, 'water', 0.12, 50)
  assert.ok(state.coating > 0.25)
  for (let tick = 51; tick < 200; tick++) state = stepNativeHarden(state, 'water', 0.12, 50)
  assert.ok(state.coating < 1)
  assert.equal(stepNativeHarden(state, 'water', 0.12, 50).coating, 1)
})

test('coating interpolates its held buildup but release and fresh casts stay discrete', () => {
  assert.equal(interpolateNativeHardenCoating(0.2, 0.4, true, 0.5), 0.30000000000000004)
  assert.equal(interpolateNativeHardenCoating(1, 0, true, 0.5), 1)
  assert.equal(interpolateNativeHardenCoating(1, 0, true, 1), 0)
  assert.equal(interpolateNativeHardenCoating(0, 0.4, false, 0.5), 0)
  assert.equal(interpolateNativeHardenCoating(0, 0.4, false, 1), 0.4)
})

test('breakup drains each strict coating threshold, five fragment records, and native RNG words', () => {
  const origin = { x: 100, y: 200 }
  const seed = createNativeRng(42)
  const cases = [
    [0.05, null, 0], [0.10000000149011612, null, 0], [0.15, 90, 4],
    [0.20000000298023224, 60, 6], [0.30000001192092896, 45, 8],
    [0.4000000059604645, 35, 11], [0.5, 20, 18], [1, 20, 18],
  ] as const
  const records = new Set<number>()
  for (const [coating, angleStep, count] of cases) {
    assert.equal(nativeHardenBreakAngleStep(coating), angleStep)
    const result = createNativeHardenBreakup(coating, origin, 'water', 'boneyard:test', 10, 1, seed)
    const shards = result.effects.filter((effect) => effect.kind === 'harden-shard')
    assert.equal(shards.length, count)
    assert.equal(result.effects.filter((effect) => effect.kind === 'harden-burst').length, count > 0 ? 1 : 0)
    assert.deepEqual(result.rng, advanceNativeRngWords(seed, 2 + 9 * count))
    assert.equal(result.nextId, result.effects.length + 1)
    assert.ok(result.pitch >= 0.9 && result.pitch <= 1.1)
    for (const shard of shards) {
      records.add(shard.record)
      assert.equal(shard.life, 10)
      assert.ok(shard.height <= 0 && shard.height >= -20)
      assert.ok(shard.verticalVelocity <= -2 && shard.verticalVelocity >= -5)
    }
  }
  assert.deepEqual([...records].sort(), [446, 447, 448, 449, 450])
})

test('physical hit chipping has both native chance outcomes without damaging retaliation', () => {
  const outcomes = new Set<boolean>()
  for (let seed = 1; seed <= 10; seed++) {
    const rng = createNativeRng(seed)
    const result = createNativeHardenChip({ x: 10, y: 20 }, rng)
    outcomes.add(result.chip !== null)
    assert.deepEqual(result.rng, advanceNativeRngWords(rng, result.chip === null ? 1 : 12))
    if (result.chip) assert.ok(result.chip.pitch >= 1 && result.chip.pitch <= 1.1)
  }
  assert.deepEqual([...outcomes].sort(), [false, true])
})

test('Harden fragments follow native Bouncer motion, skip ticks, settle, and retire', () => {
  const seed = createNativeRng(1)
  const born = createNativeHardenBreakup(1, { x: 0, y: 0 }, 'water', 'boneyard:test', 0, 1, seed)
  const first = born.effects[0]!
  assert.ok(first.kind === 'harden-shard')
  const source = { ...first, height: -5, position: { x: 0, y: 0 }, velocity: { x: 1, y: 2 },
    verticalVelocity: -2, bounceVelocity: -2, rotationDegrees: 10, rotationStepDegrees: 1 }
  const skipped = stepNativeHardenEffect(source, 3, born.rng, () => true)
  assert.deepEqual(skipped.effect, { ...source, ageTicks: 3 })
  assert.strictEqual(skipped.rng, born.rng)
  const advanced = stepNativeHardenEffect(source, 1, born.rng, () => true)
  assert.ok(advanced.effect)
  assert.deepEqual(advanced.effect.position, { x: 1, y: 2 })
  assert.equal(advanced.effect.height, -7)
  assert.equal(advanced.effect.verticalVelocity, -1.600000023841858)
  assert.equal(advanced.effect.rotationDegrees, 11)
  let effect = advanced.effect
  let rng = advanced.rng
  let settled = false
  let retired = false
  for (let tick = 2; tick <= 1_100; tick++) {
    const stepped = stepNativeHardenEffect(effect, tick, rng, () => true)
    if (!stepped.effect) { retired = true; break }
    if (effect.height === 0) {
      settled = true
      assert.deepEqual(stepped.effect.position, effect.position)
      assert.equal(stepped.effect.rotationDegrees, effect.rotationDegrees)
      assert.strictEqual(stepped.rng, rng)
    }
    effect = stepped.effect
    rng = stepped.rng
  }
  assert.equal(settled, true)
  assert.equal(retired, true)
  const burst = born.effects.at(-1)!
  assert.ok(burst.kind === 'harden-burst')
  let faded = burst
  for (let tick = 1; tick < 20; tick++) {
    const result = stepNativeHardenEffect(faded, tick, rng, () => true)
    assert.ok(result.effect)
    faded = result.effect
  }
  assert.equal(stepNativeHardenEffect(faded, 20, rng, () => true).effect, null)
})

test('Harden chips retire inside static collision polygons while retaining the landing RNG draws', () => {
  const seed = createNativeRng(3)
  const birth = createNativeHardenBreakup(1, { x: 0, y: 0 }, 'water', 'boneyard:test', 0, 1, seed)
  const shard = birth.effects[0]!
  assert.ok(shard.kind === 'harden-shard')
  const landing = { ...shard, position: { x: 1, y: 2 }, velocity: { x: 3, y: 4 },
    height: -0.25, verticalVelocity: 0.5 }
  const allowed = stepNativeHardenEffect(landing, 1, birth.rng, (position) => {
    assert.deepEqual(position, { x: 4, y: 6 })
    return true
  })
  const blocked = stepNativeHardenEffect(landing, 1, birth.rng, () => false)
  assert.ok(allowed.effect)
  assert.equal(blocked.effect, null)
  assert.deepEqual(blocked.rng, allowed.rng)
})
