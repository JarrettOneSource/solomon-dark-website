import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeDeathWeaponActor, createNativeGolemDeathAnimation, NATIVE_GOLEM_DEATH_MAX_AGE, stepNativeGolemDeathAnimation } from './native-death-animations.ts'
import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'
import { nativeDeathWeapons, nativeGolemDeathAnimation } from '../protocol/codecs/death-animations.ts'
import { legacyDeathWeaponActor } from '../save/legacy-death-animations.ts'
import { stepNativeBouncerMotion } from './native-bouncer.ts'
import { nativeEtherDrainWorldAnimationContact, refreshNativeEtherDrainWorldAnimations, createNativeEtherDrainState } from './native-ether-drain.ts'

test('Golem death constructor consumes its273 words once and mutable motion retires all fragments', () => {
  for (const enhanced of [false, true]) {
    const seed = createNativeRng(123)
    let current = createNativeGolemDeathAnimation(seed, { x: 100, y: 200 }, enhanced)
    assert.deepEqual(current.rng, advanceNativeRngWords(seed, 273))
    assert.equal(current.animation.fragments.filter(fragment => fragment !== null).length, 30)
    const before = structuredClone(current.animation)
    for (let tick = 1; tick <= (enhanced ? NATIVE_GOLEM_DEATH_MAX_AGE.on : NATIVE_GOLEM_DEATH_MAX_AGE.off); tick++) {
      current = stepNativeGolemDeathAnimation(current.animation, tick, current.rng)
    }
    assert.ok(current.animation.fragments.every(fragment => fragment === null))
    assert.equal(before.fragments.filter(fragment => fragment !== null).length, 30)
  }
})

test('native settled eligibility and retained Golem indices use ordinary registration radius and independent pressure', () => {
  const targets = [
    { bounceVelocity: 0, position: { x: 600, y: 0 }, ref: { kind: 'golem-fragment' as const, id: 1, index: 0 } },
    { bounceVelocity: -1, position: { x: 0, y: 0 }, ref: { kind: 'golem-fragment' as const, id: 1, index: 1 } },
    { bounceVelocity: 0, position: { x: 1024, y: 0 }, ref: { kind: 'golem-fragment' as const, id: 1, index: 2 } },
  ]
  const registered = refreshNativeEtherDrainWorldAnimations(createNativeEtherDrainState(), targets, { x: 0, y: 0 }, false)
  assert.deepEqual(registered.worldAnimationRefs, targets.slice(0, 2).map(target => target.ref))
  const field = { alpha: 1, id: 2, position: { x: 0, y: 0 } }
  assert.ok(nativeEtherDrainWorldAnimationContact(field, targets[0]!)!.delta.x < 0,
    'animation pressure has no separate512 cutoff')
  assert.equal(nativeEtherDrainWorldAnimationContact(field, targets[1]!), null,
    'zero height alone is not native eligibility while its stored bounce is nonzero')
  const moved = targets.map((target, index) => index === 0 ? { ...target, position: { x: 1500, y: 0 } } : target)
  assert.deepEqual(refreshNativeEtherDrainWorldAnimations(registered, moved, field.position, true).worldAnimationRefs,
    registered.worldAnimationRefs)
})

test('current mutable Golem state rejects partial slots, obsolete motion and impossible constructor values', () => {
  const good = createNativeGolemDeathAnimation(createNativeRng(37), { x: 100, y: 100 }, true).animation
  assert.deepEqual(nativeGolemDeathAnimation(good, 'golem', true), good)
  for (const invalid of ['slots', 'life', 'settled', 'star']) {
    const source = invalid === 'slots' ? { ...good, fragments: good.fragments.slice(1) }
      : invalid === 'star' ? { ...good, starStepDegrees: 8 }
      : { ...good, fragments: good.fragments.map((fragment, index) => index !== 0 ? fragment
          : invalid === 'life' ? { ...fragment!, life: 11 } : { ...fragment!, bounceVelocity: 0 }) }
    assert.throws(() => nativeGolemDeathAnimation(source, 'golem', true), /golem/)
  }
})

test('death-weapon wire state preserves an absent owner and rejects duplicate ownership and impossible clocks', () => {
  const actor = createNativeDeathWeaponActor({ deathEpoch: 1, headingIndex: 6, id: 1, ownerId: 'departed',
    painterRegistration: { managerLane: 'actor', registrationOrdinal: 5 }, position: { x: 100, y: 200 },
    tick: 100, weapon: { kind: 'staff', selector: 2 } }, createNativeRng(37)).actor
  assert.deepEqual(nativeDeathWeapons([actor], 'deathWeapons', 100), [actor])
  for (const invalid of ['birth', 'age', 'life', 'settled', 'selector', 'lane', 'id', 'epoch', 'registration', 'extra']) {
    const other = { ...actor, id: 2, deathEpoch: 2,
      painterRegistration: { managerLane: 'actor' as const, registrationOrdinal: 6 } }
    const actors = invalid === 'id' ? [actor, { ...other, id: actor.id }]
      : invalid === 'epoch' ? [actor, { ...other, deathEpoch: actor.deathEpoch }]
      : invalid === 'registration' ? [actor, { ...other, painterRegistration: actor.painterRegistration }]
      : [invalid === 'birth' ? { ...actor, birthTick: 101 }
        : invalid === 'age' ? { ...actor, ageTicks: 1 }
        : invalid === 'life' ? { ...actor, life: 100000 }
        : invalid === 'settled' ? { ...actor, motion: { ...actor.motion, bounceVelocity: 0 } }
        : invalid === 'selector' ? { ...actor, weapon: { ...actor.weapon, selector: 6 } }
        : invalid === 'lane' ? { ...actor, painterRegistration: { ...actor.painterRegistration, managerLane: 'transient' } }
        : { ...actor, replaySeed: 37 }]
    assert.throws(() => nativeDeathWeapons(actors, 'deathWeapons', 100), /deathWeapons/, invalid)
  }
})

test('legacy settled drops normalize their retired vertical velocity before current admission', () => {
  const actor = legacyDeathWeaponActor({ deathEpoch: 1, headingIndex: 6, playerId: 'departed', runId: 'old-run',
    weapon: { kind: 'wand', selector: 0 } }, 298, { x: 100, y: 200 }, 600, 1,
  { managerLane: 'actor', registrationOrdinal: 5 })
  assert.equal(actor.motion.bounceVelocity, 0)
  assert.deepEqual(actor.motion.velocity, { x: 0, y: 0 })
  assert.equal(actor.motion.verticalVelocity, 0)
  assert.deepEqual(nativeDeathWeapons([actor], 'deathWeapons', 600), [actor])
})

test('the scoped Bouncer owner settles an exact-plane landing and uses the recorded double motion constants', () => {
  const calls: string[] = []
  const stepped = stepNativeBouncerMotion({ bounceVelocity: -1, height: -1, position: { x: 100, y: 200 },
    rotationDegrees: 0, rotationStepDegrees: 3, velocity: { x: 2.25, y: -1.5 }, verticalVelocity: 1 }, 1,
  { float: maximum => { calls.push(`float:${maximum}`); return 0 },
    integer: maximum => { calls.push(`integer:${maximum}`); return 1 } })
  assert.deepEqual(calls, ['float:10', 'integer:2'])
  assert.equal(stepped.motion.height, 0)
  assert.equal(stepped.motion.bounceVelocity, 0)
  assert.deepEqual(stepped.motion.velocity, { x: 0, y: 0 })
  assert.equal(stepped.motion.verticalVelocity, 0)
  const airborne = stepNativeBouncerMotion({ ...stepped.motion, height: -10, bounceVelocity: -2,
    verticalVelocity: -2 }, 2, { float: () => { throw new Error('unexpected bounce') },
    integer: () => { throw new Error('unexpected bounce') } })
  assert.equal(airborne.motion.verticalVelocity, Math.fround(-2 + .4))
  const bounced = stepNativeBouncerMotion({ ...stepped.motion, height: -1, bounceVelocity: -3,
    velocity: { x: 2.25, y: -1.5 }, verticalVelocity: 2 }, 2, { float: () => 0, integer: () => 1 })
  assert.deepEqual(bounced.motion.velocity, { x: Math.fround(2.25 * .65), y: Math.fround(-1.5 * .65) })
})
