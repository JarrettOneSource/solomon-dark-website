import assert from 'node:assert/strict'
import './native-weld-flame-camera.test.ts'
import test from 'node:test'
import { createNativeWeldFlameLashFade, nativeFlameLashFadeLight, stepNativeWeldFlameLashFade } from './native-weld-flame-lash.ts'
import { nativeFlameFadeAlpha } from './native-weld-flame-state.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

const base = { direction: { x: 1, y: 0 }, id: 4, origin: { x: 100, y: 200 }, ownerId: 'wizard',
  rng: createNativeRng(42), tick: 5, vector: [8, 2, 1, .8, 0, 0, 0, 0], worldKey: 'boneyard:1' }

test('Flame source/endpoint/chain consume their complete 5/7/6-word birth programs', () => {
  for (const variant of ['source', 'endpoint', 'chain'] as const) {
    const result = createNativeWeldFlameLashFade({ ...base, variant })
    const ranges = [360, 360, ...(variant === 'endpoint' ? [.5] : []), variant === 'source' ? 15 : 10,
      360, .5, ...(variant === 'source' ? [] : [.75])]
    let expected = base.rng
    for (const range of ranges) expected = drawNativeFloat(expected, Math.fround(range)).state
    assert.deepEqual(result.rng, expected)
    assert.equal(result.actor.ageTicks, 0)
    assert.equal(result.actor.flameVisual.kind, 'native-birth-v1')
    assert.equal(result.actor.alpha, Math.fround((variant === 'source' ? .5 : 1) - Math.fround(variant === 'source' ? .1 : .2)))
    assert.ok(result.actor.baseScale >= (variant === 'source' ? .75 : .5))
    assert.ok(result.actor.baseScale <= (variant === 'source' ? 1.25 : 1))
    assert.deepEqual(result.actor.painterRegistrations?.map(x => x.managerLane), ['transient'])
    assert.equal(result.actor.lightRegistration, variant === 'source' ? null : result.actor.painterRegistrations![0])
  }
})

test('birth tick is native update one, with exact f32 tiny tails and no extra lifetime', () => {
  for (const variant of ['source', 'endpoint', 'chain'] as const) {
    for (const enhancedEffects of [true, false]) for (const alpha of (variant === 'endpoint' ? [.5, 1] : [1]) as (.5 | 1)[]) {
      const born = createNativeWeldFlameLashFade({ ...base, variant, enhancedEffects, alpha })
      const birthAlpha = variant === 'source' ? .5 : alpha
      let current: typeof born.actor | null = born.actor
      let visibleTicks = 0
      while (current) {
        assert.equal(current.ageTicks, visibleTicks)
        assert.equal(current.alpha, nativeFlameFadeAlpha(birthAlpha, current.alphaStep, visibleTicks))
        visibleTicks += 1
        current = stepNativeWeldFlameLashFade(current)
      }
      assert.equal(visibleTicks, enhancedEffects ? (birthAlpha === .5 && variant !== 'source' ? 2 : 5) : birthAlpha === .5 ? 1 : 2)
    }
  }
  assert.equal(nativeFlameFadeAlpha(.5, Math.fround(.1), 4), 2 ** -26)
  assert.equal(nativeFlameFadeAlpha(1, Math.fround(.2), 4), 2 ** -25)
})

test('lit fade providers use surviving wrapper updates and a fixed retained radius', () => {
  for (const alpha of [.5, 1] as const) {
    const born = createNativeWeldFlameLashFade({ ...base, variant: 'endpoint', alpha }).actor
    const first = nativeFlameLashFadeLight(born)!
    const next = stepNativeWeldFlameLashFade(born)!
    assert.equal(first.intensity, Math.fround(alpha + Math.fround(-.05)))
    assert.equal(first.radius, Math.fround(alpha * born.wrapperScalar))
    assert.equal(nativeFlameLashFadeLight(next)!.radius, first.radius)
  }
  assert.equal(nativeFlameLashFadeLight(createNativeWeldFlameLashFade({ ...base, variant: 'source' }).actor), null)
})

test('explicit legacy suppression keeps the old unstepped lifetime and no provider', () => {
  const fresh = createNativeWeldFlameLashFade({ ...base, variant: 'chain' }).actor
  const legacy = { ...fresh, flameVisual: { kind: 'legacy-suppressed' as const }, alpha: 1,
    ageTicks: 0, baseScale: .075, lightRegistration: null,
    painterRegistrations: [{ managerLane: 'actor' as const, registrationOrdinal: 4 }] }
  let actor: typeof fresh | null = legacy
  let updates = 0
  while (actor) { updates += 1; assert.equal(nativeFlameLashFadeLight(actor), null); actor = stepNativeWeldFlameLashFade(actor) }
  assert.equal(updates, 6)
})
