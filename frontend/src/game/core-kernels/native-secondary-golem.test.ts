import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeRng } from './native-rng.ts'
import {
  NATIVE_GOLEM_DEATH_PRESENTATION_RNG_DRAWS,
  consumeNativeGolemDeathPresentationRng,
  damageNativeSecondaryGolem,
  nativeInitialGolemArticulation,
  stepNativeSecondaryGolem,
  type NativeGolemKernelActor,
} from './native-secondary-golem.ts'

const noMovement = (requestedPosition: { x: number; y: number }) => requestedPosition

test('Golem assembly advances by two and the 400-tick damage gate owns both health channels', () => {
  const assembling = stepNativeSecondaryGolem(golem({ ageTicks: 199 }), {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: createNativeRng(1),
    targets: [],
  })
  assert.equal(assembling.actor.ageTicks, 201)
  assert.equal(assembling.actor.golem.phase, 'assembly')
  const active = stepNativeSecondaryGolem(assembling.actor, {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: assembling.rng,
    targets: [],
  })
  assert.equal(active.actor.ageTicks, 202)
  assert.equal(active.actor.golem.phase, 'provoke')

  const grace = golem({ ageTicks: 399, golem: golemState({
    currentHealth: 50,
    maximumHealth: 50,
    reflectFactor: 0.5,
  }) })
  assert.deepEqual(damageNativeSecondaryGolem(grace, {
    primaryDamage: 20,
    reflectablePhysicalSourceInRange: true,
    secondaryDamage: 10,
  }), {
    actor: grace,
    ignored: true,
    killed: false,
    reflectedDamage: 0,
  })
  const damaged = damageNativeSecondaryGolem({ ...grace, ageTicks: 400 }, {
    primaryDamage: 20,
    reflectablePhysicalSourceInRange: true,
    secondaryDamage: 10,
  })
  assert.equal(damaged.actor?.golem.currentHealth, 20)
  assert.equal(damaged.reflectedDamage, 10)
  assert.equal(damaged.killed, false)
  assert.equal(damageNativeSecondaryGolem({ ...grace, ageTicks: 400 }, {
    primaryDamage: 40,
    reflectablePhysicalSourceInRange: false,
    secondaryDamage: 10,
  }).killed, true)
})

test('Golem preserves the four distinct pre-increment assembly sound milestones', () => {
  for (const ageTicks of [0, 50, 100, 200] as const) {
    const result = stepNativeSecondaryGolem(golem({ ageTicks }), {
      ownerPosition: null,
      resolveMovement: noMovement,
      rng: createNativeRng(1),
      targets: [],
    })
    assert.equal(result.assemblyMilestone, ageTicks)
  }
  const active = stepNativeSecondaryGolem(golem({ ageTicks: 201 }), {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: createNativeRng(1),
    targets: [],
  })
  assert.equal(active.assemblyMilestone, null)
})

test('Golem publishes native foot anchors, alternating gait paths, bob, and attack limb state', () => {
  const initial = nativeInitialGolemArticulation({ x: 0, y: 0 }, 0)
  assert.deepEqual(initial.leftFoot, { x: 10, y: 19 })
  assert.deepEqual(initial.rightFoot, { x: -10, y: 19 })

  const source = golem({
    ageTicks: 400,
    golem: golemState({
      ...initial,
      gaitTick: 49,
      phase: 'active',
      provokeRollBound: 1_200,
      targetPollTicksRemaining: 1,
    }),
  })
  let footResolutions = 0
  const stepped = stepNativeSecondaryGolem(source, {
    ownerPosition: null,
    resolveFootTarget: (current) => {
      footResolutions += 1
      return current
    },
    resolveMovement: noMovement,
    rng: createNativeRng(22),
    targets: [{ id: 4, position: { x: 200, y: 0 }, radius: 10 }],
  })
  assert.equal(stepped.actor.golem.gaitTick, 50)
  assert.equal(footResolutions, 1)
  assert.deepEqual(stepped.actor.golem.rightFootPrevious, initial.rightFoot)
  assert.deepEqual(stepped.actor.golem.rightFootNext, initial.rightFoot)
  assert.equal(
    stepped.actor.golem.rightFootProgress,
    Math.fround(Math.fround(0.015) * Math.fround(1.06)),
  )
  assert.equal(Number.isFinite(stepped.actor.golem.rightFootBob.y), true)

  const attack = stepNativeSecondaryGolem(golem({
    ageTicks: 400,
    golem: golemState({
      ...initial,
      phase: 'active',
      poseVariant: 0,
      provokeRollBound: 1_200,
      targetPollTicksRemaining: 1,
    }),
  }), {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: createNativeRng(1),
    targets: [{ id: 5, position: { x: 0, y: -60 }, radius: 20 }],
  })
  assert.equal(attack.actor.golem.poseVariant, 1)
  assert.equal(attack.actor.golem.actionHeadingOffsetDegrees, 38)
  assert.equal(attack.actor.golem.leftLimbMode, 0)
  assert.equal(attack.actor.golem.rightLimbMode, 1)
})

test('Golem acquires, follows, attacks at marker 37, and applies the 90-degree contact arc', () => {
  const target = { id: 1, position: { x: 0, y: -60 }, radius: 20 }
  const started = stepNativeSecondaryGolem(golem({
    ageTicks: 400,
    golem: golemState({
      phase: 'active',
      provokeRollBound: 1_200,
      targetPollTicksRemaining: 1,
    }),
  }), {
    ownerPosition: { x: 100, y: 100 },
    resolveMovement: noMovement,
    rng: createNativeRng(1),
    targets: [target],
  })
  assert.equal(started.actor.golem.phase, 'attack')
  assert.equal(started.actor.golem.actionTick, 0)
  assert.equal(started.actor.rotationRadians, 0)
  assert.ok(started.actor.golem.actionDurationTicks >= 71)
  assert.ok(started.actor.golem.actionDurationTicks <= 90)

  const impact = stepNativeSecondaryGolem({
    ...started.actor,
    golem: { ...started.actor.golem, actionTick: 36 },
  }, {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: started.rng,
    targets: [target, { id: 2, position: { x: 60, y: 0 }, radius: 1 }],
  })
  assert.equal(impact.actor.golem.actionTick, 37)
  assert.deepEqual(impact.contact?.targetIds, [1])
  assert.equal(impact.contact?.impulse, 120)
  assert.ok((impact.contact?.damage ?? 0) >= 5)
  assert.ok((impact.contact?.damage ?? 0) <= 10)

  const moved = stepNativeSecondaryGolem(golem({
    ageTicks: 400,
    golem: golemState({
      phase: 'active',
      provokeRollBound: 1_200,
      targetPollTicksRemaining: 1,
    }),
  }), {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: createNativeRng(1),
    targets: [{ ...target, position: { x: 200, y: 0 }, radius: 10 }],
  })
  assert.deepEqual(moved.actor.position, { x: 0.5, y: 0 })
})

test('Golem target polling, owner orbit, provoke roll, and death RNG consumption preserve native boundaries', () => {
  const target = { id: 1, position: { x: 200, y: 0 }, radius: 10 }
  const waiting = stepNativeSecondaryGolem(golem({
    ageTicks: 400,
    golem: golemState({
      phase: 'active',
      provokeRollBound: 1_200,
      targetPollTicksRemaining: 2,
    }),
  }), {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: createNativeRng(9),
    targets: [target],
  })
  assert.equal(waiting.actor.targetId, null)
  assert.equal(waiting.actor.golem.targetPollTicksRemaining, 1)
  const acquired = stepNativeSecondaryGolem(waiting.actor, {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: waiting.rng,
    targets: [target],
  })
  assert.equal(acquired.actor.targetId, 1)
  assert.equal(acquired.actor.golem.targetPollTicksRemaining, 50)

  const orbitRng = createNativeRng(11)
  const orbiting = stepNativeSecondaryGolem(golem({
    ageTicks: 400,
    golem: golemState({
      phase: 'active',
      provokeRollBound: 1_200,
      targetPollTicksRemaining: 2,
    }),
  }), {
    ownerPosition: { x: 100, y: 100 },
    resolveMovement: noMovement,
    rng: orbitRng,
    targets: [],
  })
  assert.notEqual(orbiting.actor.golem.orbitHeadingRadians, null)
  assert.notEqual(orbiting.actor.golem.orbitDirection, 0)
  assert.equal(orbiting.rng.indexA, orbitRng.indexA + 3)

  const forcedProvokeRng = createNativeRng(3)
  const forcedProvoke = stepNativeSecondaryGolem(golem({
    ageTicks: 400,
    golem: golemState({ phase: 'active', provokeRollBound: 0 }),
  }), {
    ownerPosition: null,
    resolveMovement: noMovement,
    rng: forcedProvokeRng,
    targets: [],
  })
  assert.equal(forcedProvoke.actor.golem.phase, 'provoke')
  assert.equal(forcedProvoke.actor.golem.provokeRollBound, 1_200)
  assert.equal(forcedProvoke.provokeStarted, true)
  assert.deepEqual(forcedProvoke.rng, forcedProvokeRng)

  const consumed = consumeNativeGolemDeathPresentationRng(createNativeRng(1))
  assert.equal(NATIVE_GOLEM_DEATH_PRESENTATION_RNG_DRAWS, 273)
  assert.equal(consumed.indexA, 53)
  assert.equal(consumed.indexB, 29)
  assert.deepEqual(consumed.words.slice(0, 10), [
    380_316_920, 858_837_861, 165_412_957, 263_955_530, 460_736_039,
    724_691_569, 111_685_784, 836_377_353, 948_063_137, 710_698_666,
  ])
})

function golem(overrides: Partial<NativeGolemKernelActor> = {}): NativeGolemKernelActor {
  return {
    ageTicks: 0,
    damageMinimum: 5,
    golem: golemState(),
    id: 1,
    ownerId: 'player:1',
    position: { x: 0, y: 0 },
    rotationRadians: 0,
    targetId: null,
    ...overrides,
  }
}

function golemState(
  overrides: Partial<NativeGolemKernelActor['golem']> = {},
): NativeGolemKernelActor['golem'] {
  return {
    ...nativeInitialGolemArticulation({ x: 0, y: 0 }, 0),
    actionDurationTicks: 0,
    actionTick: 0,
    currentHealth: 100,
    damageMaximum: 10,
    iron: false,
    maximumHealth: 100,
    orbitDirection: 0,
    orbitHeadingRadians: null,
    phase: 'assembly',
    poseVariant: 0,
    provokeRollBound: 0,
    reflectFactor: 0,
    targetPollTicksRemaining: 0,
    ...overrides,
  }
}
