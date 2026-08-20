import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubEconomy } from './hub-economy.ts'
import {
  createNativePlayerStaffAction,
  createNativeStaffContactPresentation,
  createNativeStaffKnockback,
  NATIVE_STAFF_MELEE_BASE_PROGRESS,
  nativePlayerStaffActionPose,
  nativeStaffAdmissionTarget,
  nativeStaffContactDamagePerTarget,
  nativeStaffDamageTargets,
  nativeStaffKnockbackTargets,
  stepNativePlayerStaffAction,
  stepNativePlayerStaffVfx,
  stepNativeStaffKnockback,
  type NativePlayerStaffAction,
} from './native-player-staff-action.ts'
import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'
import {
  createPlayerProgression,
  createPlayerSkillBook,
  playerStatBook,
} from './player-progression.ts'
import {
  createPlayerSkillRuntime,
  playerSkillDerivedStats,
  type PlayerStaffAttackOutcome,
} from './player-skill-runtime.ts'

const CONFIG = { discipline: 'body', displayName: 'Staff', element: 'air' } as const

function skillState() {
  const economy = createHubEconomy(1)
  const skillBook = createPlayerSkillBook(CONFIG)
  const statBook = playerStatBook()
  const created = createPlayerSkillRuntime(skillBook, statBook, economy)
  const progression = createPlayerProgression(1)
  return playerSkillDerivedStats(
    created.runtime,
    created.skillBook,
    statBook,
    progression,
    economy,
  )
}

function actionForOutcome(outcome: PlayerStaffAttackOutcome): ReturnType<
  typeof createNativePlayerStaffAction
> {
  const derived = { ...skillState(), flailingChancePercent: outcome === 'normal' ? -1 : 100 }
  for (let seed = 0; seed < 100_000; seed += 1) {
    const candidate = createNativePlayerStaffAction({
      derived,
      headingDegrees: 0,
      id: 1,
      lane: 'primary',
      origin: { x: 0, y: 0 },
      ownerId: 'caster',
      worldKey: 'boneyard:test',
    }, createNativeRng(seed))
    if (candidate.action.outcome === outcome) return candidate
  }
  throw new Error(`No deterministic seed produced ${outcome}`)
}

test('StaffMelee consumes chance, rate, and acceleration in native order and crosses one marker', () => {
  const spawned = actionForOutcome('normal')
  assert.equal(spawned.action.kind, 'player-staff-melee')
  assert.equal(spawned.rng.indexA, 3)
  assert.equal(spawned.rng.indexB, 34)
  assert.equal(nativePlayerStaffActionPose(spawned.action), 0)
  assert.equal(
    spawned.action.swooshPitch,
    Math.fround(
      (spawned.action.baseProgressPerTick - NATIVE_STAFF_MELEE_BASE_PROGRESS) + 1,
    ),
  )

  let action: NativePlayerStaffAction | null = spawned.action
  let contacts = 0
  const poses = new Set<number>()
  while (action !== null) {
    poses.add(nativePlayerStaffActionPose(action))
    const stepped = stepNativePlayerStaffAction(action, { x: 11, y: 22 })
    if (stepped.contact) contacts += 1
    action = stepped.action
  }
  assert.equal(contacts, 1)
  assert.deepEqual([...poses].sort((left, right) => left - right), [0, 4, 5, 6])
})

test('StaffSpin uses the one-word native sign primitive and contacts after eighteen turns', () => {
  const spawned = actionForOutcome('whirl')
  assert.equal(spawned.action.kind, 'player-staff-spin')
  assert.equal(spawned.rng.indexA, 3)
  assert.equal(nativePlayerStaffActionPose(spawned.action), 3)

  let action: NativePlayerStaffAction | null = spawned.action
  let steps = 0
  let contacts = 0
  while (action !== null) {
    const stepped = stepNativePlayerStaffAction(action, { x: 0, y: 0 })
    steps += 1
    if (stepped.contact) contacts += 1
    action = stepped.action
  }
  assert.equal(steps, 18)
  assert.equal(contacts, 1)
})

test('rank-zero Flailing retains the native inclusive-zero proc defect', () => {
  const derived = { ...skillState(), flailingChancePercent: 0 }
  let proc: ReturnType<typeof createNativePlayerStaffAction> | null = null
  for (let seed = 0; seed < 100_000 && proc === null; seed += 1) {
    const candidate = createNativePlayerStaffAction({
      derived,
      headingDegrees: 0,
      id: 1,
      lane: 'primary',
      origin: { x: 0, y: 0 },
      ownerId: 'caster',
      worldKey: 'boneyard:test',
    }, createNativeRng(seed))
    if (candidate.action.outcome !== 'normal') proc = candidate
  }
  assert.ok(proc)
  assert.notEqual(proc.action.outcome, 'normal')
})

test('automatic admission preserves list order and excludes the exact fifty-degree boundary', () => {
  const first = { collisionRadius: 5, id: 'first', position: { x: 0, y: -30 } }
  const second = { collisionRadius: 5, id: 'second', position: { x: 10, y: -20 } }
  assert.equal(nativeStaffAdmissionTarget({
    collisionRadius: 25,
    headingDegrees: 0,
    position: { x: 0, y: 0 },
  }, [first, second])?.id, 'first')

  const atBoundary = {
    collisionRadius: 5,
    id: 'boundary',
    position: {
      x: Math.sin(50 * Math.PI / 180) * 30,
      y: -Math.cos(50 * Math.PI / 180) * 30,
    },
  }
  assert.equal(nativeStaffAdmissionTarget({
    collisionRadius: 25,
    headingDegrees: 0,
    position: { x: 0, y: 0 },
  }, [atBoundary]), null)
})

test('normal, critical, and Whirl contacts use their exact shapes and strict boundaries', () => {
  const normal = actionForOutcome('normal').action
  const critical = actionForOutcome('critical-hit').action
  const whirl = actionForOutcome('whirl').action
  const targets = [
    { collisionRadius: 0, id: 'normal', position: { x: 0, y: -69.999 } },
    { collisionRadius: 0, id: 'far-edge', position: { x: 0, y: -70 } },
    { collisionRadius: 0, id: 'critical-only', position: { x: 0, y: -100 } },
    { collisionRadius: 0, id: 'whirl-inside', position: { x: 99.999, y: 0 } },
    { collisionRadius: 0, id: 'whirl-edge', position: { x: 100, y: 0 } },
  ]
  assert.deepEqual(nativeStaffDamageTargets(normal, targets).map(({ id }) => id), ['normal'])
  assert.deepEqual(
    nativeStaffDamageTargets(critical, targets).map(({ id }) => id),
    ['normal', 'far-edge', 'critical-only'],
  )
  assert.deepEqual(
    nativeStaffDamageTargets(whirl, targets).map(({ id }) => id),
    ['normal', 'far-edge', 'whirl-inside'],
  )
})

test('all three proc knockbacks retain their exact arc, radius, and distance', () => {
  const front = { collisionRadius: 0, id: 'front', position: { x: 0, y: -50 } }
  const side = { collisionRadius: 0, id: 'side', position: { x: 50, y: 0 } }
  const cases = [
    ['knockback', 80, 150, ['front']],
    ['critical-hit', 60, 50, ['front']],
    ['whirl', 365, 50, ['front', 'side']],
  ] as const
  for (const [outcome, arcDegrees, remainingDistance, targetIds] of cases) {
    const action = actionForOutcome(outcome).action
    assert.deepEqual(
      nativeStaffKnockbackTargets(action, [front, side]).map(({ id }) => id),
      targetIds,
    )
    assert.deepEqual(createNativeStaffKnockback(9, action, targetIds), {
      ageTicks: 0,
      arcDegrees,
      id: 9,
      kind: 'player-staff-knockback',
      origin: { x: 0, y: 0 },
      ownerId: 'caster',
      remainingDistance,
      targetIds,
      worldKey: 'boneyard:test',
    })
  }
})

test('staff contact damage distribution preserves the non-Whirl two-share cap', () => {
  assert.equal(nativeStaffContactDamagePerTarget(30, 1, false), 30)
  assert.equal(nativeStaffContactDamagePerTarget(30, 3, false), 20)
  assert.equal(nativeStaffContactDamagePerTarget(30, 3, true), 30)
})

test('proc presentation owns exact RNG budgets, cue pitches, art, and recurrence', () => {
  const expectations = [
    ['normal', 0, null, 0, []],
    ['knockback', 4, 'knockback', 1, [15]],
    ['disabling-hit', 151, 'disable-enemy', 1, Array(50).fill(45)],
    ['critical-hit', 4, 'critical-hit', 1, [15, 40]],
    ['whirl', 1, 'spin-attack', 3, [88]],
  ] as const
  for (const [outcome, words, procSound, pitchCount, entries] of expectations) {
    const action = actionForOutcome(outcome).action
    const rng = createNativeRng(91)
    const result = createNativeStaffContactPresentation(
      20,
      action,
      ['enemy:1'],
      { x: 4, y: -10 },
      0xa0c3c3,
      rng,
    )
    assert.deepEqual(result.rng, advanceNativeRngWords(rng, words))
    assert.equal(result.event.procSound, procSound)
    assert.equal(result.event.procSoundPitches.length, pitchCount)
    assert.deepEqual(result.vfx.map(({ entry }) => entry), entries)
    assert.equal(result.event.swooshPitch, action.swooshPitch)
  }

  const smoke = createNativeStaffContactPresentation(
    1,
    actionForOutcome('knockback').action,
    ['enemy:1'],
    { x: 0, y: 0 },
    0xffffff,
    createNativeRng(5),
  ).vfx[0]!
  assert.equal(smoke.kind, 'player-staff-smoke')
  assert.equal(stepNativePlayerStaffVfx(smoke)?.alpha, Math.fround(0.95))
})

test('terminal Knockback consumes two RNG words per surviving target and applies Dazzle once', () => {
  const action = actionForOutcome('knockback').action
  const actor = createNativeStaffKnockback(5, action, ['enemy:1', 'enemy:2'])!
  let current = { ...actor, remainingDistance: 10 }
  const stepped = stepNativeStaffKnockback(current, {
    'enemy:1': { x: 30, y: 0 },
    'enemy:2': { x: 0, y: 40 },
  }, createNativeRng(8))
  assert.equal(stepped.actor, null)
  assert.deepEqual(stepped.dazzledTargetIds, ['enemy:1', 'enemy:2'])
  assert.equal(stepped.headingPerturbations.length, 2)
  assert.equal(stepped.rng.indexA, 4)
  assert.deepEqual(stepped.displacements, [
    { delta: { x: 10, y: 0 }, targetId: 'enemy:1' },
    { delta: { x: 0, y: 10 }, targetId: 'enemy:2' },
  ])
})
