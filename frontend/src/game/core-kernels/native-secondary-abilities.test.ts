import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_SECONDARY_ABILITY_IDS,
  type NativeSecondaryAbilityId,
} from './native-secondary-ability-contract.ts'
import {
  applyNativeSecondaryTargetEffect,
  applyNativeSecondaryGolemDamage,
  applyNativeSecondaryEtherBurn,
  applyNativeSecondaryPlayerDamage,
  createNativeSecondaryPlayerState,
  createNativeSecondarySimulation,
  materializeNativePlayerFlashResponse,
  NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS,
  NATIVE_MINDBLAST_DIRECT_RADIUS,
  NATIVE_MINDBLAST_PRESENTATION_RNG_WORDS,
  NATIVE_ETHER_BURN_LIFETIME_TICKS,
  nativePlaneOrbDamage,
  nativeSecondaryAvailableMana,
  nativeSecondaryCooldownCapacityTicks,
  nativeSecondaryStaffCastDurationTicks,
  nativeSecondaryTargetMaterialTint,
  removeNativeSecondaryOwner,
  stepNativeSecondaryAbilities,
  triggerNativePlayerMindblast,
  type NativeSecondarySimulationState,
  type NativeSecondaryTickContext,
} from './native-secondary-abilities.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeFloatRange,
  drawNativeInteger,
  drawNativeSign,
  type NativeRngState,
} from './native-rng.ts'
import {
  bindNativeBeltSkill,
  createNativePlayerBelt,
} from './native-belt.ts'
import {
  nativeLeviathanCurrentScale,
  nativeLeviathanHeadingVector,
} from './native-secondary-leviathan.ts'
import {
  createIdlePlayerCharacterInput,
  createPlayerCharacter,
  type PlayerCharacterInput,
} from './player-character.ts'
import {
  createPlayerSkillBook,
  effectiveSecondaryAbilityRankStats,
  type PlayerSkillBookComponent,
} from './player-progression.ts'

const CONFIG = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

const TARGET_LIGHT_REGISTRATION = Object.freeze({
  managerLane: 'actor' as const,
  registrationOrdinal: 100,
})

const EXPECTED_ACTOR_KIND = new Map<NativeSecondaryAbilityId, string | null>([
  [11, 'leviathan'], [12, null], [15, 'phase-burst'], [21, 'moving-fire'],
  [23, 'fire-patch'], [27, 'storm-cloud'], [30, 'prismatic-wave'], [35, 'freeze-wave'],
  [41, 'earthquake'], [45, 'golem'], [46, null], [48, 'teleport-burst'],
  [49, 'magic-circle'], [50, 'magic-trap'], [51, 'dampen-wave'], [54, null],
  [72, 'acid-rain'], [73, 'fire-patch'], [74, 'ether-drain'], [76, 'comet'],
  [77, 'turn-undead'], [78, null], [79, null],
])

function book(
  skillId: NativeSecondaryAbilityId,
  learnedSkillIds: readonly number[] = [],
  rank = 1,
): PlayerSkillBookComponent {
  const source = createPlayerSkillBook(CONFIG)
  const permanentRanks = [...source.permanentRanks]
  const effectiveRanks = [...source.effectiveRanks]
  for (const learnedSkillId of [skillId, ...learnedSkillIds]) {
    const learnedRank = learnedSkillId === skillId ? rank : 1
    permanentRanks[learnedSkillId] = learnedRank
    effectiveRanks[learnedSkillId] = learnedRank
  }
  return {
    ...source,
    effectiveRanks: Object.freeze(effectiveRanks),
    permanentRanks: Object.freeze(permanentRanks),
  }
}

function input(slot: number | null, aim = { x: 100, y: 0 }): PlayerCharacterInput {
  return {
    ...createIdlePlayerCharacterInput(),
    aim,
    cast: { primary: false, quickbar: slot },
  }
}

function withEffectiveSkillRank(
  source: PlayerSkillBookComponent,
  skillId: number,
  rank: number,
): PlayerSkillBookComponent {
  const permanentRanks = [...source.permanentRanks]
  const effectiveRanks = [...source.effectiveRanks]
  permanentRanks[skillId] = rank
  effectiveRanks[skillId] = rank
  return {
    ...source,
    effectiveRanks: Object.freeze(effectiveRanks),
    permanentRanks: Object.freeze(permanentRanks),
  }
}

function withElementalPrimary(
  source: PlayerSkillBookComponent,
  skillId: 8 | 16 | 24 | 32 | 40,
  rank = 1,
): PlayerSkillBookComponent {
  return { ...withEffectiveSkillRank(source, skillId, rank), primarySkillId: skillId }
}

function context(
  skillId: NativeSecondaryAbilityId,
  tick: number,
  secondary: number | null,
  currentMana = 100,
  learnedSkillIds: readonly number[] = [],
  rank = 1,
): NativeSecondaryTickContext {
  const skillBook = book(skillId, learnedSkillIds, rank)
  return {
    dampenCandidates: () => ({
      casterTargetIds: [7],
      projectileIds: [8, 9],
      shieldTargetIds: [10],
    }),
    golemMovement: (_playerId, _worldKey, _origin, requestedPosition) => requestedPosition,
    golemPlacement: (_playerId, _worldKey, requestedPosition, rng) => ({
      position: requestedPosition,
      rng,
    }),
    phasingDestination: () => ({ x: 20, y: 0 }),
    players: {
      player: {
        belt: bindNativeBeltSkill(
          createNativePlayerBelt(skillBook),
          skillBook,
          skillId,
          0,
        ),
        character: createPlayerCharacter(CONFIG, { x: 0, y: 0 }),
        coldSlowFactor: 0.5,
        currentMana,
        eligible: true,
        enhancedEffects: false,
        explosiveShieldDamage: 0,
        explosiveShieldRawManaCost: 0,
        fireBurnDamage: 2,
        freezeDurationMultiplier: 1,
        focusInstantRechargeChancePercent: 0,
        golemIron: false,
        golemRawManaCost: 50,
        golemReflectFactor: 0,
        input: input(secondary),
        maximumMana: 100,
        magicStormDurationBonusTicks: 0,
        magicStormFrequencyFactor: 1,
        magicStormRawManaCost: 0,
        maximumGolem: false,
        maximumLeviathan: false,
        maximumMagicStorm: false,
        maximumRingOfFire: false,
        maximumRingOfIce: false,
        manaRecoveryPerTick: 0.1,
        offensiveFactors: { damage: 1, manaCost: 1 },
        secondaryRechargeFactor: learnedSkillIds.includes(60) ? 2 : 1,
        skillBook,
        worldKey: 'boneyard:test',
      },
    },
    teleportDestination: (_playerId, rng) => ({
      position: { x: 90, y: 10 },
      rng,
    }),
    target: () => null,
    targets: () => [],
    tick,
  }
}

function cast(skillId: NativeSecondaryAbilityId): ReturnType<typeof stepNativeSecondaryAbilities> {
  return stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(skillId, 1, 0),
  )
}

test('secondary mana underflow is strict: cost greater than mana fails, exact zero succeeds', () => {
  const insufficient = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(11, 1, 0, 74),
  )
  assert.deepEqual(insufficient.manaUnderflowPlayerIds, ['player'])
  assert.equal(insufficient.manaSpent.player, undefined)

  const exact = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(11, 1, 0, 75),
  )
  assert.deepEqual(exact.manaUnderflowPlayerIds, [])
  assert.equal(exact.manaSpent.player, 75)
})

test('Mindblowing Ring births its exact burst and actor-light Shockwave from 502 RNG words', () => {
  const source = createNativeSecondarySimulation(0x52a220)
  const lightRegistration = { managerLane: 'actor' as const, registrationOrdinal: 7 }
  const triggered = triggerNativePlayerMindblast(source, {
    element: 'ether',
    level: 12,
    lightRegistration,
    ownerId: 'player',
    position: { x: 4, y: 5 },
    worldKey: 'boneyard:test',
  })
  assert.equal(triggered.directDamage, 6)
  assert.equal(triggered.directRadius, NATIVE_MINDBLAST_DIRECT_RADIUS)
  assert.deepEqual(
    triggered.state.rng,
    advanceNativeRngWords(source.rng, NATIVE_MINDBLAST_PRESENTATION_RNG_WORDS),
  )
  assert.deepEqual(triggered.state.actors.map(({ kind }) => kind), [
    'mindblast-burst',
    'mindblast-shockwave',
  ])
  const burst = triggered.state.actors[0]!
  assert.equal(burst.ageTicks, 0)
  assert.equal(burst.lifetimeTicks, 230)
  assert.equal(burst.presentationRng, source.rng)
  assert.equal(burst.rank, 12)
  assert.equal(burst.scale, 9)
  assert.equal(burst.skillId, null)
  assert.equal(burst.variant, 0)
  const wave = triggered.state.actors[1]!
  assert.deepEqual(wave.lightRegistration, lightRegistration)
  assert.equal(wave.phase, Math.fround(0.35))
  assert.equal(wave.quantity, 8)
  assert.equal(wave.radius, 75)
  assert.equal(wave.skillId, null)

  const fire = triggerNativePlayerMindblast(createNativeSecondarySimulation(1), {
    element: 'fire',
    level: 12,
    lightRegistration,
    ownerId: 'player',
    position: { x: 4, y: 5 },
    worldKey: 'boneyard:test',
  })
  assert.equal(fire.directDamage, 0)
  assert.equal(fire.state.actors[0]!.variant, 1)
})

test('Mindblast Shockwave contacts every target once, Dazzles, pushes, and publishes its radial light', () => {
  const target = {
    family: 'ZOMBIE',
    id: 1,
    lightRegistration: TARGET_LIGHT_REGISTRATION,
    nativeFlags: 2,
    position: { x: 150, y: 0 },
    radius: 10,
    scale: 1,
    shieldHealth: 0,
  }
  let state = triggerNativePlayerMindblast(createNativeSecondarySimulation(3), {
    element: 'water',
    level: 4,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
    ownerId: 'player',
    position: { x: 0, y: 0 },
    worldKey: 'boneyard:test',
  }).state
  let contactCount = 0
  for (let tick = 1; tick <= 20; tick += 1) {
    const result = stepNativeSecondaryAbilities(state, {
      ...context(35, tick, null),
      targets: (_worldKey, _center, radius) => radius >= 150 ? [target] : [],
    })
    state = result.state
    contactCount += Number(result.knockbacks.length > 0)
    assert.deepEqual(result.damage, [])
    if (tick === 10) {
      assert.equal(result.knockbacks.length, 1)
      assert.ok(Math.abs(Math.hypot(
        result.knockbacks[0]!.delta.x,
        result.knockbacks[0]!.delta.y,
      ) - state.actors.find(({ kind }) => kind === 'mindblast-shockwave')!.alpha * 8) < 1e-5)
    }
  }
  assert.equal(contactCount, 6)
  const wave = state.actors.find(({ kind }) => kind === 'mindblast-shockwave')!
  assert.deepEqual(wave.hitTargetIds, [1])
  assert.ok(state.targetEffects.find(({ targetId }) => targetId === 1)!.dazzleTicks > 0)
})

test('Flash materializes twelve independent children, area Dazzle, feedback, and audio', () => {
  const response = Object.freeze({
    cameraDisplacement: Object.freeze({ x: 1.8, y: -2.4 }),
    durationTicks: 400,
    growScales: Object.freeze([1, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 2]),
    pitch: 1.125,
  })
  let state = materializeNativePlayerFlashResponse(
    createNativeSecondarySimulation(9),
    {
      ownerId: 'player',
      position: { x: 30, y: 50 },
      response,
      targetIds: [4, 2],
      tick: 1,
      worldKey: 'boneyard:test',
    },
  )
  assert.equal(state.actors.filter(({ kind }) => kind === 'flash-response-grow').length, 8)
  assert.equal(state.actors.filter(({ kind }) => kind === 'flash-response-fade').length, 4)
  assert.deepEqual(state.actors.slice(0, 8).map(({ scale }) => scale), response.growScales)
  assert.ok(state.actors.slice(0, 8).every(({ position }) => (
    position.x === 30 && position.y === 50
  )))
  assert.ok(state.actors.slice(8).every(({ position, scale }) => (
    position.x === 30 && position.y === 25 && scale === 6
  )))
  assert.deepEqual(state.targetEffects.map(({ dazzleTicks, targetId }) => ({
    dazzleTicks,
    targetId,
  })), [
    { dazzleTicks: 400, targetId: 4 },
    { dazzleTicks: 400, targetId: 2 },
  ])
  assert.deepEqual(state.events, [{
    actorId: null,
    cameraDisplacement: { x: 1.8, y: -2.4 },
    cameraMagnitude: 0,
    cue: 'flash-spell',
    eventId: 1,
    kind: 'impact',
    ownerId: 'player',
    pitch: 1.125,
    position: { x: 30, y: 50 },
    screenFlash: {
      alpha: 1,
      blue: 1,
      decayPerTick: Math.fround(0.05),
      green: 1,
      pointAttenuated: true,
      red: 1,
    },
    skillId: 53,
    tick: 1,
    worldKey: 'boneyard:test',
  }])

  state = stepNativeSecondaryAbilities(state, context(41, 2, null)).state
  const grow = state.actors.find(({ kind }) => kind === 'flash-response-grow')!
  const fade = state.actors.find(({ kind }) => kind === 'flash-response-fade')!
  assert.equal(grow.alpha, Math.fround(0.95))
  assert.equal(grow.scale, Math.fround(Math.fround(1) * Math.fround(1.05)))
  assert.equal(fade.alpha, Math.fround(0.95))
  assert.equal(fade.scale, 6)
  assert.deepEqual(state.targetEffects.map(({ dazzleTicks }) => dazzleTicks), [399, 399])
})

function expectedScreenFlash(
  red: number,
  green: number,
  blue: number,
  decayPerTick: number,
  pointAttenuated: boolean,
  alpha = 1,
) {
  return {
    alpha: Math.fround(alpha),
    blue: Math.fround(blue),
    decayPerTick: Math.fround(decayPerTick),
    green: Math.fround(green),
    pointAttenuated,
    red: Math.fround(red),
  }
}

function screenFlashes(state: NativeSecondarySimulationState) {
  return state.events.flatMap(({ screenFlash }) => screenFlash === null ? [] : [screenFlash])
}

function finishCommonCastGate(state: NativeSecondarySimulationState): NativeSecondarySimulationState {
  const player = state.players.player
  if (!player) throw new Error('secondary test lost its player state')
  return {
    ...state,
    players: {
      ...state.players,
      player: {
        ...player,
        cooldownTicksBySkill: player.cooldownTicksBySkill.map(() => 0),
        globalCooldownTicks: 0,
        staffCastTicksRemaining: 0,
      },
    },
  }
}

function consumeFreezeWaveConstruction(
  source: NativeRngState,
  snowCount: 100 | 200,
): NativeRngState {
  let rng = source
  for (let index = 0; index < 3; index += 1) {
    rng = drawNativeFloat(rng, 360).state
  }
  for (let index = 0; index < snowCount; index += 1) {
    for (const maximum of [360, 10, 40, 4, 250, 0.5, 360, 1.5]) {
      rng = drawNativeFloat(rng, maximum).state
    }
  }
  return rng
}

function drawUnitVectorForTest(source: NativeRngState) {
  const heading = drawNativeInteger(source, 100_001)
  const degrees = Math.fround(Math.fround(heading.value / 100_000) * 360)
  const radians = degrees * Math.PI / 180
  return {
    rng: heading.state,
    value: {
      x: Math.fround(Math.sin(radians)),
      y: Math.fround(-Math.cos(radians)),
    },
  }
}

function fixedBoundShuffleForTest<T>(
  source: readonly T[],
  sourceRng: NativeRngState,
): { readonly rng: NativeRngState; readonly values: readonly T[] } {
  const values = [...source]
  let rng = sourceRng
  for (let index = 0; index < values.length; index += 1) {
    const selected = drawNativeInteger(rng, values.length)
    rng = selected.state
    ;[values[index], values[selected.value]] = [
      values[selected.value]!,
      values[index]!,
    ]
  }
  return { rng, values }
}

function fireLifetimeTicks(initialLife: number): number {
  let life = Math.fround(initialLife)
  let ticks = 0
  while (life > 0) {
    life = Math.fround(life - Math.fround(0.01))
    ticks += 1
  }
  return ticks
}

test('every one of the closed 23 right-click abilities enters its native runtime family', () => {
  assert.deepEqual([...EXPECTED_ACTOR_KIND.keys()], NATIVE_SECONDARY_ABILITY_IDS)
  for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
    const result = cast(skillId)
    const expectedKind = EXPECTED_ACTOR_KIND.get(skillId)
    if (expectedKind) {
      assert.ok(
        result.state.actors.some(({ kind }) => kind === expectedKind),
        `skill ${skillId} did not create ${expectedKind}`,
      )
    }
    assert.equal(result.state.players.player?.castSequence, 1, `skill ${skillId} did not cast`)
    assert.equal(result.state.players.player?.lastSkillId, skillId)
    assert.ok(
      result.state.events.some((event) => event.skillId === skillId),
      `skill ${skillId} emitted no semantic presentation event`,
    )
  }
})

test('all 23 category-2 rows admit their edge while one-shot or sustained primary state is active', () => {
  for (const channelActive of [false, true]) {
    for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
      const source = context(skillId, 1, 0)
      const character = source.players.player!.character
      const result = stepNativeSecondaryAbilities(
        createNativeSecondarySimulation(123),
        {
          ...source,
          players: {
            player: {
              ...source.players.player!,
              character: {
                ...character,
                primaryCast: {
                  ...character.primaryCast,
                  actionTick: 5,
                  channelActive,
                  held: true,
                },
              },
              input: {
                ...source.players.player!.input,
                cast: { primary: true, quickbar: 0 },
              },
            },
          },
        },
      )
      assert.equal(
        result.state.players.player?.castSequence,
        1,
        `skill ${skillId} channel=${channelActive}`,
      )
    }
  }
})

test('every Cast 2 owner writes one player phase pulse and actionless siblings write none', () => {
  for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
    const accepted = cast(skillId)
    const ownsCastTwo = (accepted.state.players.player?.staffCastTicksRemaining ?? 0) > 0
    const firstActionUpdate = stepNativeSecondaryAbilities(
      accepted.state,
      context(skillId, 2, null),
    )
    assert.deepEqual(
      firstActionUpdate.staffCastPulsePlayerIds,
      ownsCastTwo ? ['player'] : [],
      `skill ${skillId}`,
    )
    const laterUpdate = stepNativeSecondaryAbilities(
      firstActionUpdate.state,
      context(skillId, 3, null),
    )
    assert.deepEqual(laterUpdate.staffCastPulsePlayerIds, [], `skill ${skillId}: repeat`)
  }
})

test('all 23 category-2 rows retain their constructor and effective cooldown capacities', () => {
  assert.deepEqual(NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS, {
    11: 833,
    12: 2_500,
    15: 833,
    21: 2_500,
    23: 50,
    27: 1_250,
    30: 1_250,
    35: 2_500,
    41: 2_500,
    45: 2_500,
    46: 10_000,
    48: 2_500,
    49: 2_500,
    50: 625,
    51: 2_000,
    54: 2_500,
    72: 2_500,
    73: 277,
    74: 3_750,
    76: 1_250,
    77: 1_875,
    78: 50,
    79: 50,
  })
  const expectedEffective = {
    ...NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS,
    15: 100,
    48: 6_000,
  }
  assert.deepEqual(
    Object.fromEntries(NATIVE_SECONDARY_ABILITY_IDS.map((skillId) => [
      skillId,
      nativeSecondaryCooldownCapacityTicks(book(skillId), skillId),
    ])),
    expectedEffective,
  )

  for (let rank = 1; rank <= 8; rank += 1) {
    assert.equal(
      nativeSecondaryCooldownCapacityTicks(book(48, [], rank), 48),
      [0, 6_000, 3_000, 1_500, 1_000, 500, 400, 300, 100][rank],
    )
  }
})

test('every dispatcher-success row arms its native cooldown and HUD capacity', () => {
  const effectiveCapacity = new Map<NativeSecondaryAbilityId, number>(
    NATIVE_SECONDARY_ABILITY_IDS.map((skillId) => [
      skillId,
      nativeSecondaryCooldownCapacityTicks(book(skillId), skillId),
    ] as const),
  )
  for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
    const result = cast(skillId)
    const player = result.state.players.player!
    const capacity = effectiveCapacity.get(skillId)!
    assert.equal(player.cooldownMaximumTicksBySkill[skillId], capacity, `skill ${skillId} capacity`)
    if (skillId === 78 || skillId === 79) {
      assert.equal(player.cooldownTicksBySkill[skillId], 0, `skill ${skillId} current`)
      assert.equal(player.globalCooldownTicks, 0, `skill ${skillId} common`)
    } else {
      assert.equal(
        player.cooldownTicksBySkill[skillId],
        capacity < 150 ? 0 : capacity,
        `skill ${skillId} current`,
      )
      assert.equal(player.globalCooldownTicks, 150, `skill ${skillId} common`)
    }
  }
})

test('Golem sums rank-zero Iron cost before one shared native mana transform', () => {
  const neutral = cast(45)
  assert.deepEqual(neutral.manaSpent, { player: 60 })

  const sourceContext = context(45, 1, 0)
  const transformed = stepNativeSecondaryAbilities(createNativeSecondarySimulation(123), {
    ...sourceContext,
    players: {
      player: {
        ...sourceContext.players.player!,
        offensiveFactors: {
          damage: 1,
          globalManaReduction: 5,
          manaCost: 0.5,
        },
      },
    },
  })
  assert.deepEqual(transformed.manaSpent, { player: 55 })

  const learnedIronContext = context(45, 1, 0, 100, [75])
  const learnedIron = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    learnedIronContext,
  )
  assert.deepEqual(learnedIron.manaSpent, neutral.manaSpent)

  const maximumRank = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(45, 1, 0, 200, [], 12),
  )
  assert.deepEqual(maximumRank.manaSpent, { player: 150 })
})

test('neutral Golem rejects recasts for exactly 2,500 authoritative 100 Hz updates', () => {
  const accepted = cast(45)
  let state: NativeSecondarySimulationState = {
    ...accepted.state,
    actors: [],
  }
  for (let tick = 2; tick <= 1_001; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(45, tick, null)).state
  }
  assert.equal(state.players.player?.cooldownTicksBySkill[45], 1_500)

  const blocked = stepNativeSecondaryAbilities(state, context(45, 1_002, 0))
  assert.equal(blocked.state.players.player?.castSequence, 1)
  assert.equal(blocked.state.players.player?.fizzleSequence, 1)
  assert.equal(blocked.state.players.player?.cooldownTicksBySkill[45], 1_499)

  state = stepNativeSecondaryAbilities(blocked.state, context(45, 1_003, null)).state
  for (let tick = 1_004; tick <= 2_501; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(45, tick, null)).state
  }
  assert.equal(state.players.player?.cooldownTicksBySkill[45], 0)
  const ready = stepNativeSecondaryAbilities(state, context(45, 2_502, 0))
  assert.equal(ready.state.players.player?.castSequence, 2)
  assert.deepEqual(ready.manaSpent, { player: 60 })
})

test('Phasing preserves native accepted-failure and single traversal-streak semantics', () => {
  const successful = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(15, 1, 0),
  )
  assert.deepEqual(successful.manaSpent, { player: 75 })
  assert.deepEqual(successful.relocatedPlayers, { player: { x: 20, y: 0 } })
  assert.equal(successful.state.players.player?.cooldownTicksBySkill[15], 0)
  assert.equal(successful.state.players.player?.globalCooldownTicks, 150)
  const streak = successful.state.actors.find(({ kind }) => kind === 'phase-burst')!
  assert.ok(streak)
  assert.deepEqual({
    alpha: streak.alpha,
    lifetimeTicks: streak.lifetimeTicks,
    position: streak.position,
    rotationRadians: streak.rotationRadians,
    scale: streak.scale,
  }, {
    alpha: 1,
    lifetimeTicks: 20,
    position: { x: 10, y: 0 },
    rotationRadians: 0,
    scale: 2,
  })
  assert.deepEqual(
    successful.state.events.filter(({ screenFlash }) => screenFlash !== null)
      .map(({ position }) => position),
    [{ x: 10, y: 0 }],
  )
  assert.equal(successful.state.events.filter(({ cue }) => cue === 'phase').length, 1)

  let state = successful.state
  state = stepNativeSecondaryAbilities(state, context(15, 2, null)).state
  const faded = state.actors.find(({ id }) => id === streak.id)!
  assert.equal(faded.alpha, Math.fround(1 - Math.fround(0.05)))
  assert.equal(faded.scale, 2)
  for (let tick = 3; tick <= 20; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(15, tick, null)).state
  }
  assert.equal(state.actors.some(({ id }) => id === streak.id), true)
  state = stepNativeSecondaryAbilities(state, context(15, 21, null)).state
  assert.equal(state.actors.some(({ id }) => id === streak.id), false)

  const blockedContext = context(15, 1, 0)
  const blocked = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    { ...blockedContext, phasingDestination: () => null },
  )
  assert.deepEqual(blocked.manaSpent, { player: 75 })
  assert.deepEqual(blocked.relocatedPlayers, {})
  assert.deepEqual(blocked.state.actors, [])
  assert.deepEqual(blocked.state.events, [])
  assert.equal(blocked.state.players.player?.castSequence, 1)
  assert.equal(blocked.state.players.player?.fizzleSequence, 0)
  assert.equal(blocked.state.players.player?.lastSkillId, 15)
  assert.equal(blocked.state.players.player?.cooldownTicksBySkill[15], 0)
  assert.equal(blocked.state.players.player?.cooldownMaximumTicksBySkill[15], 100)
  assert.equal(blocked.state.players.player?.globalCooldownTicks, 150)
})

test('Teleport owns two exact FadeScale bursts, two sound requests, and unconditional relocation', () => {
  const sourceRotation = drawNativeFloat(createNativeRng(123), 360)
  const destinationRotation = drawNativeFloat(sourceRotation.state, 360)
  const castResult = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(48, 1, 0),
  )

  assert.deepEqual(castResult.manaSpent, { player: 10 })
  assert.deepEqual(castResult.relocatedPlayers, { player: { x: 90, y: 10 } })
  assert.equal(castResult.state.players.player?.cooldownTicksBySkill[48], 6_000)
  assert.equal(castResult.state.players.player?.cooldownMaximumTicksBySkill[48], 6_000)
  assert.equal(castResult.state.players.player?.globalCooldownTicks, 150)
  assert.deepEqual(castResult.state.rng, destinationRotation.state)
  assert.deepEqual(castResult.state.events.filter(({ cue }) => cue === 'teleport')
    .map(({ cue, position, screenFlash }) => ({
    cue,
    position,
    screenFlash,
  })), [
    {
      cue: 'teleport',
      position: { x: 0, y: 0 },
      screenFlash: expectedScreenFlash(1, 1, 1, 0.025, false),
    },
    {
      cue: 'teleport',
      position: { x: 90, y: 10 },
      screenFlash: expectedScreenFlash(1, 1, 1, 0.025, true),
    },
  ])

  const bursts = castResult.state.actors.filter(({ kind }) => kind === 'teleport-burst')
  assert.deepEqual(bursts.map((burst) => ({
    ageTicks: burst.ageTicks,
    alpha: burst.alpha,
    lifetimeTicks: burst.lifetimeTicks,
    position: burst.position,
    rotationRadians: burst.rotationRadians,
    scale: burst.scale,
    variant: burst.variant,
  })), [
    {
      ageTicks: 0,
      alpha: 2,
      lifetimeTicks: 20,
      position: { x: 0, y: -15 },
      rotationRadians: sourceRotation.value * Math.PI / 180,
      scale: 1,
      variant: 0,
    },
    {
      ageTicks: 0,
      alpha: 2,
      lifetimeTicks: 20,
      position: { x: 90, y: -5 },
      rotationRadians: destinationRotation.value * Math.PI / 180,
      scale: 8,
      variant: 1,
    },
  ])

  let state = stepNativeSecondaryAbilities(
    castResult.state,
    context(48, 2, null),
  ).state
  const updated = state.actors.filter(({ kind }) => kind === 'teleport-burst')
  assert.deepEqual(updated.map(({ alpha, scale }) => ({ alpha, scale })), [
    {
      alpha: Math.fround(2 - Math.fround(0.1)),
      scale: Math.fround(1 * Math.fround(1.1)),
    },
    {
      alpha: Math.fround(2 - Math.fround(0.1)),
      scale: Math.fround(8 * Math.fround(0.96)),
    },
  ])
  for (let tick = 3; tick <= 20; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(48, tick, null)).state
  }
  assert.equal(state.actors.some(({ kind }) => kind === 'teleport-burst'), true)
  state = stepNativeSecondaryAbilities(state, context(48, 21, null)).state
  assert.equal(state.actors.some(({ kind }) => kind === 'teleport-burst'), false)
})

test('the shared right-click gate owns StaffCast2 occupancy and Faster Caster timing', () => {
  assert.equal(nativeSecondaryStaffCastDurationTicks(book(11)), 51)
  assert.equal(nativeSecondaryStaffCastDurationTicks(book(11, [70])), 46)

  const castResult = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(11, 1, 0),
  )
  assert.equal(castResult.state.players.player?.staffCastTicksRemaining, 51)
  assert.equal(castResult.state.players.player?.globalCooldownTicks, 150)
  assert.deepEqual(castResult.staffCastPulsePlayerIds, [])

  const released = stepNativeSecondaryAbilities(
    castResult.state,
    context(11, 2, null),
  )
  assert.equal(released.state.players.player?.staffCastTicksRemaining, 50)
  assert.deepEqual(released.staffCastPulsePlayerIds, ['player'])
  const blocked = stepNativeSecondaryAbilities(
    released.state,
    context(11, 3, 0),
  )
  assert.deepEqual(blocked.staffCastPulsePlayerIds, [])
  assert.equal(blocked.state.players.player?.castSequence, 1)
  assert.equal(blocked.state.players.player?.fizzleSequence, 0)
  assert.deepEqual(blocked.manaSpent, {})

  let state = blocked.state
  for (let tick = 4; tick <= 151; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(11, tick, null)).state
  }
  assert.equal(state.players.player?.staffCastTicksRemaining, 0)
  assert.equal(state.players.player?.globalCooldownTicks, 0)
  const rowBlocked = stepNativeSecondaryAbilities(state, context(11, 152, 0))
  assert.equal(rowBlocked.state.players.player?.castSequence, 1)
  assert.equal(rowBlocked.state.players.player?.fizzleSequence, 1)
  state = stepNativeSecondaryAbilities(rowBlocked.state, context(11, 153, null)).state
  for (let tick = 154; tick <= 834; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(11, tick, null)).state
  }
  assert.equal(state.players.player?.cooldownTicksBySkill[11], 0)
  const ready = stepNativeSecondaryAbilities(state, context(11, 835, 0))
  assert.equal(ready.state.players.player?.castSequence, 2)
  assert.equal(ready.state.players.player?.staffCastTicksRemaining, 51)
})

test('Focus drains every row and the progression-wide cooldown at the stock rate', () => {
  const castResult = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(15, 1, 0, 100, [60]),
  )
  assert.equal(castResult.state.players.player?.cooldownTicksBySkill[15], 0)
  assert.equal(castResult.state.players.player?.cooldownMaximumTicksBySkill[15], 100)
  assert.equal(castResult.state.players.player?.globalCooldownTicks, 150)

  const stepped = stepNativeSecondaryAbilities(
    castResult.state,
    context(15, 2, null, 100, [60]),
  )
  assert.equal(stepped.state.players.player?.cooldownTicksBySkill[15], 0)
  assert.equal(stepped.state.players.player?.globalCooldownTicks, 148)

  let state = castResult.state
  for (let tick = 2; tick <= 76; tick += 1) {
    state = stepNativeSecondaryAbilities(
      state,
      context(15, tick, null, 100, [60]),
    ).state
  }
  assert.equal(state.players.player?.cooldownTicksBySkill[15], 0)
  assert.equal(state.players.player?.globalCooldownTicks, 0)
})

test('the fixed common cooldown silently blocks otherwise-ready secondary rows', () => {
  const teleport = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(48, 1, 0),
  )
  const teleportedPlayer = teleport.state.players.player!
  const source = {
    ...teleport.state,
    players: {
      player: {
        ...teleportedPlayer,
        heldSlot: null,
        staffCastTicksRemaining: 0,
      },
    },
  }
  const blocked = stepNativeSecondaryAbilities(source, context(15, 2, 0, 100, [48]))
  assert.equal(blocked.state.players.player?.globalCooldownTicks, 149)
  assert.equal(blocked.state.players.player?.cooldownTicksBySkill[48], 5_999)
  assert.equal(blocked.state.players.player?.cooldownTicksBySkill[15], 0)
  assert.equal(blocked.state.players.player?.castSequence, 1)
  assert.equal(blocked.state.players.player?.fizzleSequence, 0)
  assert.deepEqual(blocked.manaSpent, {})
})

test('state-only toggles stay actionless while accepted Planewalker and Dampen retain their owners', () => {
  for (const skillId of [78, 79] as const) {
    const result = cast(skillId)
    assert.equal(result.state.players.player?.staffCastTicksRemaining, 0)
    assert.equal(result.state.players.player?.castSpinTicksRemaining, 0)
  }

  const firewalkerOn = cast(23)
  assert.equal(firewalkerOn.state.players.player?.staffCastTicksRemaining, 51)
  const activeFirewalker = firewalkerOn.state.players.player!
  const firewalkerOff = stepNativeSecondaryAbilities({
    ...firewalkerOn.state,
    players: {
      player: {
        ...activeFirewalker,
        globalCooldownTicks: 0,
        heldSlot: null,
        staffCastTicksRemaining: 0,
      },
    },
  }, context(23, 2, 0))
  assert.equal(firewalkerOff.state.players.player?.firewalker, false)
  assert.equal(firewalkerOff.state.players.player?.staffCastTicksRemaining, 0)

  const planewalkerOn = cast(12)
  const activePlanewalker = planewalkerOn.state.players.player!
  const planewalkerOff = stepNativeSecondaryAbilities({
    ...planewalkerOn.state,
    players: {
      player: {
        ...activePlanewalker,
        cooldownTicksBySkill: activePlanewalker.cooldownTicksBySkill.map((ticks, skillId) => (
          skillId === 12 ? 0 : ticks
        )),
        globalCooldownTicks: 0,
        heldSlot: null,
        staffCastTicksRemaining: 0,
      },
    },
  }, context(12, 2, 0))
  assert.equal(planewalkerOff.state.players.player?.planewalkerTicksRemaining, 0)
  assert.equal(planewalkerOff.state.players.player?.staffCastTicksRemaining, 51)
  assert.equal(planewalkerOff.state.players.player?.cooldownTicksBySkill[12], 2_500)

  const dampen = cast(51)
  assert.equal(dampen.state.players.player?.staffCastTicksRemaining, 0)
  assert.equal(dampen.state.players.player?.castSpinTicksRemaining, 73)
  assert.deepEqual(dampen.staffCastPulsePlayerIds, [])
  assert.equal(dampen.state.players.player?.globalCooldownTicks, 150)
  assert.deepEqual(createNativeSecondaryPlayerState(), {
    castSequence: 0,
    castSpinTicksRemaining: 0,
    cooldownMaximumTicksBySkill: new Array(83).fill(0),
    cooldownTicksBySkill: new Array(83).fill(0),
    firewalker: false,
    fizzleSequence: 0,
    globalCooldownTicks: 0,
    heldSlot: null,
    lastSkillId: null,
    magicShieldAbsorb: 0,
    magicShieldExplosionDamage: 0,
    magicShieldMaximum: 0,
    magicShieldPulseTicks: 0,
    mindstar: false,
    planeOrbHeld: false,
    planewalkerTicksRemaining: 0,
    regenerate: false,
    reservedMana: 0,
    staffCastTicksRemaining: 0,
    stoneskinTicksRemaining: 0,
  })
})

test('native RNG sign and bulk advance preserve the retail word stream', () => {
  const source = createNativeRng(123)
  const sign = drawNativeSign(source, 2)
  assert.ok(sign.value === -2 || sign.value === 2)
  assert.deepEqual(sign.state, advanceNativeRngWords(source, 1))

  let scalar = source
  for (let index = 0; index < 137; index += 1) {
    scalar = drawNativeInteger(scalar, 2).state
  }
  assert.deepEqual(advanceNativeRngWords(source, 137), scalar)
})

test('native float RNG preserves every retail float32 store and ordered range interpolation', () => {
  const words = Array.from({ length: 55 }, () => 0)
  words[31] = 5 << 6
  const source: NativeRngState = {
    indexA: 0,
    indexB: 31,
    words: Object.freeze(words),
  }
  const expectedScalar = Math.fround(
    Math.fround(Math.fround(5) / 100_000) * Math.fround(3),
  )
  assert.equal(expectedScalar, 0.00014999999257270247)
  assert.equal(drawNativeFloat(source, 3).value, expectedScalar)

  const ascending = drawNativeFloatRange(source, 1, 4)
  assert.equal(ascending.value, Math.fround(1 + expectedScalar))
  assert.deepEqual(ascending.state, advanceNativeRngWords(source, 1))

  const descending = drawNativeFloatRange(source, 4, 1)
  assert.equal(descending.value, Math.fround(4 - expectedScalar))
  assert.deepEqual(descending.state, advanceNativeRngWords(source, 1))

  assert.deepEqual(drawNativeFloatRange(source, 2, 2), {
    state: source,
    value: 2,
  })
})

test('Prismatic applies immediately and owns the exact signed constructor plus 19-word emission tick', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 7, position: { x: 100, y: 0 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  let queriedRadius = 0
  const castContext = {
    ...context(30, 1, 0),
    targets: (_worldKey: string, _origin: { x: number; y: number }, radius: number) => {
      queriedRadius = radius
      return [target]
    },
  }
  const initialRng = createNativeRng(123)
  const sign = drawNativeSign(initialRng, 1)
  const color = drawNativeInteger(sign.state, 5)
  const castResult = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    castContext,
  )
  assert.equal(queriedRadius, 350)
  assert.deepEqual(castResult.state.rng, color.state)
  assert.equal(castResult.state.targetEffects[0]?.targetId, 7)
  assert.ok((castResult.state.targetEffects[0]?.prismaticTicks ?? 0) > 0)
  assert.equal(
    castResult.state.events.find(({ cue }) => cue === 'lightning-start')?.pitch,
    0.8,
  )
  const spray = castResult.state.actors.find(({ kind }) => kind === 'prismatic-wave')!
  assert.deepEqual({
    ageTicks: spray.ageTicks,
    alpha: spray.alpha,
    lifetimeTicks: spray.lifetimeTicks,
    position: spray.position,
    presentationRng: spray.presentationRng,
    radius: spray.radius,
    scale: spray.scale,
    slowFactor: spray.slowFactor,
  }, {
    ageTicks: 0,
    alpha: 0,
    lifetimeTicks: 167,
    position: { x: 0, y: -25 },
    presentationRng: color.state,
    radius: 350,
    scale: 2,
    slowFactor: sign.value,
  })

  const movedContext = context(30, 2, null)
  const moved = stepNativeSecondaryAbilities(castResult.state, {
    ...movedContext,
    players: {
      player: {
        ...movedContext.players.player!,
        character: {
          ...movedContext.players.player!.character,
          position: { x: 12, y: 34 },
        },
      },
    },
  }).state
  const advanced = moved.actors.find(({ kind }) => kind === 'prismatic-wave')!
  assert.deepEqual(moved.rng, advanceNativeRngWords(color.state, 19))
  assert.equal(advanced.alpha, Math.fround(0.025))
  assert.equal(advanced.scale, Math.fround(2 + Math.fround(0.065)))
  assert.deepEqual(advanced.position, { x: 12, y: 9 })
})

test('Magic Circle performs its stock first pulse, light RNG, parity emitter, and attached player flash', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 9, position: { x: 100, y: 0 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  const initialRng = createNativeRng(123)
  const light = drawNativeFloat(initialRng, 0.25, true)
  const afterOddTickRing = advanceNativeRngWords(light.state, 10)
  const flashRotation = drawNativeFloat(afterOddTickRing, 360)
  const flashScale = drawNativeFloat(flashRotation.state, 1)
  const flashLife = drawNativeFloat(flashScale.state, 0.25)
  const castResult = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    {
      ...context(49, 1, 0),
      targets: () => [target],
    },
  )
  assert.deepEqual(castResult.manaRecovered, { player: 0.2 })
  assert.deepEqual(castResult.state.rng, flashLife.state)
  assert.equal(castResult.state.targetEffects[0]?.targetId, 9)
  assert.equal(castResult.state.targetEffects[0]?.circleSlowTicks, 20)
  const circle = castResult.state.actors.find(({ kind }) => kind === 'magic-circle')!
  assert.deepEqual({
    ageTicks: circle.ageTicks,
    alpha: circle.alpha,
    lightRegistration: circle.lightRegistration,
    lifetimeTicks: circle.lifetimeTicks,
    miscLightAppendOrdinal: circle.miscLightAppendOrdinal,
    phase: circle.phase,
    presentationRng: circle.presentationRng,
    scale: circle.scale,
  }, {
    ageTicks: 0,
    alpha: Math.fround(0.75 + light.value),
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
    lifetimeTicks: 1_519,
    miscLightAppendOrdinal: 0,
    phase: 1,
    presentationRng: initialRng,
    scale: 4,
  })
  const flash = castResult.state.actors.find(({ kind }) => (
    kind === 'magic-circle-player-flash'
  ))!
  assert.deepEqual({
    alpha: flash.alpha,
    position: flash.position,
    rotationRadians: flash.rotationRadians,
    scale: flash.scale,
  }, {
    alpha: Math.fround(0.5 + flashLife.value),
    position: { x: 0, y: -15 },
    rotationRadians: flashRotation.value * Math.PI / 180,
    scale: Math.fround(1 + flashScale.value * 0.65),
  })

  const evenLight = drawNativeFloat(flashLife.state, 0.25, true)
  const stepped = stepNativeSecondaryAbilities(
    castResult.state,
    context(49, 2, null),
  ).state
  assert.deepEqual(stepped.rng, advanceNativeRngWords(evenLight.state, 5))
  assert.equal(
    stepped.actors.find(({ kind }) => kind === 'magic-circle')?.alpha,
    Math.fround(0.75 + evenLight.value),
  )
})

test('the complete 23-member cast matrix owns exactly the native Region-lane writers', () => {
  const immediate = new Map<NativeSecondaryAbilityId, readonly ReturnType<typeof expectedScreenFlash>[]>([
    [12, [expectedScreenFlash(1, 0, 1, 0.1, false)]],
    [15, [expectedScreenFlash(0, 1, 1, 0.025, true)]],
    [21, [expectedScreenFlash(1, 0.5, 0, 0.01, true)]],
    [23, [expectedScreenFlash(1, 0.5, 0, 0.1, true)]],
    [35, [expectedScreenFlash(0.9, 1, 1, 0.01, true)]],
    [41, [expectedScreenFlash(0.8, 1, 0.8, 0.025, false)]],
    [46, [expectedScreenFlash(1, 1, 1, 0.1, false)]],
    [48, [
      expectedScreenFlash(1, 1, 1, 0.025, false),
      expectedScreenFlash(1, 1, 1, 0.025, true),
    ]],
    [54, [expectedScreenFlash(0.5, 1, 1, 0.1, true)]],
    [73, [expectedScreenFlash(1, 0.5, 0, 0.1, true)]],
    [78, [expectedScreenFlash(0, 0.5, 1, 0.1, true)]],
    [79, [expectedScreenFlash(1, 0.5, 0, 0.1, true)]],
  ])
  const prismaticColors = [
    [1, 0, 0], [1, 0.5, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1],
  ] as const
  const prismaticSign = drawNativeSign(createNativeRng(123), 1)
  const prismaticColor = drawNativeInteger(prismaticSign.state, 5).value

  for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
    const result = cast(skillId)
    const [prismaticRed, prismaticGreen, prismaticBlue] = prismaticColors[prismaticColor]!
    const expected = skillId === 30
      ? [expectedScreenFlash(prismaticRed, prismaticGreen, prismaticBlue, 0.05, true)]
      : skillId === 50
        ? [expectedScreenFlash(1, 0.1, 1, 0.1, false)]
        : immediate.get(skillId) ?? []
    assert.deepEqual(screenFlashes(result.state), expected, `skill ${skillId}`)
  }

  const teleportEvents = cast(48).state.events.filter(({ screenFlash }) => screenFlash !== null)
  assert.deepEqual(teleportEvents.map(({ position }) => position), [
    { x: 0, y: 0 },
    { x: 90, y: 10 },
  ])
})

test('actor-owned Region writes occur on the exact first-update and Circle thresholds', () => {
  let leviathan = cast(11).state
  leviathan = stepNativeSecondaryAbilities(leviathan, context(11, 2, null)).state
  assert.deepEqual(screenFlashes(leviathan), [
    expectedScreenFlash(1, 0.5, 1, 0.05, true),
  ])

  let circle = cast(49).state
  circle = stepNativeSecondaryAbilities(circle, context(49, 2, null)).state
  assert.deepEqual(screenFlashes(circle), [])
  circle = stepNativeSecondaryAbilities(circle, context(49, 3, null)).state
  assert.deepEqual(screenFlashes(circle), [
    expectedScreenFlash(0.75, 1, 1, 0.1, true),
  ])

  let drain = cast(74).state
  drain = stepNativeSecondaryAbilities(drain, context(74, 2, null)).state
  assert.deepEqual(screenFlashes(drain), [
    expectedScreenFlash(1, 0.5, 1, 0.05, true),
  ])
})

test('secondary light enrollment preserves actor, transient, and target-action order', () => {
  const nextOrdinal = { actor: 10, transient: 20 }
  const registerLightProvider = (managerLane: 'actor' | 'transient') => Object.freeze({
    managerLane,
    registrationOrdinal: nextOrdinal[managerLane]++,
  })
  const leviathanContext = context(11, 1, 0)
  const leviathanState = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    { ...leviathanContext, registerLightProvider },
  ).state
  const leviathan = leviathanState.actors.find(({ kind }) => kind === 'leviathan')!
  assert.deepEqual(leviathan.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 10,
  })
  assert.ok(leviathanState.actors
    .filter(({ kind }) => kind === 'leviathan-appendage')
    .every(({ lightRegistration }) => lightRegistration === null))

  const fadeSource: NativeSecondarySimulationState = {
    ...createNativeSecondarySimulation(456),
    actors: [Object.freeze({
      ...leviathan,
      ageTicks: 0,
      alpha: 2,
      id: 1,
      kind: 'ether-fade',
      lifetimeTicks: 19,
      lightRegistration: null,
      miscLightAppendOrdinal: null,
      scale: 2,
      slowFactor: Math.fround(0.1),
      variant: 1,
    })],
    nextActorId: 2,
  }
  const fadeContext = context(11, 2, null)
  const fade = stepNativeSecondaryAbilities(fadeSource, {
    ...fadeContext,
    registerLightProvider,
  }).state.actors[0]!
  assert.deepEqual(fade.lightRegistration, {
    managerLane: 'transient',
    registrationOrdinal: 20,
  })

  const target = {
    family: 'ZOMBIE',
    id: 33,
    lightRegistration: TARGET_LIGHT_REGISTRATION,
    position: { x: 100, y: 0 },
    radius: 10,
    scale: 1,
    shieldHealth: 0,
  }
  const modifiers: NativeSecondarySimulationState = {
    ...createNativeSecondarySimulation(789),
    actors: [
      Object.freeze({
        ...leviathan,
        ageTicks: 0,
        damage: 0.01,
        id: 1,
        kind: 'fire-burn',
        lifetimeTicks: 200,
        lightRegistration: TARGET_LIGHT_REGISTRATION,
        miscLightAppendOrdinal: null,
        targetId: target.id,
      }),
      Object.freeze({
        ...leviathan,
        ageTicks: 0,
        damage: 0.01,
        id: 2,
        kind: 'electric-burn',
        lifetimeTicks: 100,
        lightRegistration: TARGET_LIGHT_REGISTRATION,
        miscLightAppendOrdinal: null,
        targetId: target.id,
      }),
    ],
    nextActorId: 3,
  }
  const modifierContext = context(50, 2, null)
  const steppedModifiers = stepNativeSecondaryAbilities(modifiers, {
    ...modifierContext,
    target: (_worldKey, targetId) => targetId === target.id ? target : null,
    targets: () => [target],
  }).state.actors.filter(({ kind }) => kind === 'fire-burn' || kind === 'electric-burn')
  assert.deepEqual(steppedModifiers.map((actor) => ({
    kind: actor.kind,
    lightRegistration: actor.lightRegistration,
    miscLightAppendOrdinal: actor.miscLightAppendOrdinal,
  })), [
    {
      kind: 'fire-burn',
      lightRegistration: TARGET_LIGHT_REGISTRATION,
      miscLightAppendOrdinal: 0,
    },
    {
      kind: 'electric-burn',
      lightRegistration: TARGET_LIGHT_REGISTRATION,
      miscLightAppendOrdinal: 1,
    },
  ])
})

test('toggle Region feedback follows native on/off ownership without synthetic toggle actors', () => {
  for (const skillId of [23, 78, 79] as const) {
    let state = stepNativeSecondaryAbilities(
      createNativeSecondarySimulation(7),
      context(skillId, 1, 0),
    ).state
    state = stepNativeSecondaryAbilities(state, context(skillId, 2, null)).state
    state = finishCommonCastGate(state)
    state = stepNativeSecondaryAbilities(state, context(skillId, 3, 0)).state
    assert.equal(screenFlashes(state).length, 2, `skill ${skillId}`)
    if (skillId === 78 || skillId === 79) {
      assert.deepEqual(state.actors, [], `skill ${skillId} allocated a non-native actor`)
    }
  }

  let planewalker = cast(12).state
  planewalker = stepNativeSecondaryAbilities(planewalker, context(12, 2, null)).state
  planewalker = finishCommonCastGate(planewalker)
  planewalker = stepNativeSecondaryAbilities(planewalker, context(12, 3, 0)).state
  assert.deepEqual(screenFlashes(planewalker), [
    expectedScreenFlash(1, 0, 1, 0.1, false),
  ])
})

test('Planewalker overrides only the active duration and releases the configured primary on expiry', () => {
  let state = cast(12).state
  assert.equal(state.players.player?.planewalkerTicksRemaining, 800)
  let result: ReturnType<typeof stepNativeSecondaryAbilities> | null = null
  for (let tick = 2; tick <= 799; tick += 1) {
    result = stepNativeSecondaryAbilities(state, context(12, tick, null))
    state = result.state
  }

  const activeContext = context(12, 800, null)
  result = stepNativeSecondaryAbilities(state, {
    ...activeContext,
    players: {
      player: {
        ...activeContext.players.player!,
        input: {
          ...activeContext.players.player!.input,
          cast: { primary: true, quickbar: null },
        },
      },
    },
  })
  state = result.state
  assert.deepEqual(result.primaryOverridePlayerIds, ['player'])
  assert.equal(state.actors.filter(({ kind }) => kind === 'plane-orb-shot').length, 1)

  const expiryContext = context(12, 801, null)
  result = stepNativeSecondaryAbilities(state, {
    ...expiryContext,
    players: {
      player: {
        ...expiryContext.players.player!,
        input: {
          ...expiryContext.players.player!.input,
          cast: { primary: true, quickbar: null },
        },
      },
    },
  })
  assert.equal(result.state.players.player?.planewalkerTicksRemaining, 0)
  assert.deepEqual(result.primaryOverridePlayerIds, [])
  assert.equal(result.state.actors.filter(({ kind }) => kind === 'plane-orb-shot').length, 1)
  assert.equal(result.state.events.at(-1)?.cue, 'planewalker-off')
})

test('Magic Trap selector owns native color, contact kind, and added modifier', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 33, position: { x: 100, y: 0 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  const rows = [
    { blue: 1, cue: 'magic-missile', damageKind: 'magic', green: 0.1, primarySkillId: 8, red: 1, selector: 0 },
    { blue: 0.1, cue: 'throw-fire', damageKind: 'fire', green: 0.35, primarySkillId: 16, red: 1, selector: 1 },
    { blue: 1, cue: 'lightning-start', damageKind: 'lightning', green: 1, primarySkillId: 24, red: 0.1, selector: 2 },
    { blue: 1, cue: 'ice-start', damageKind: 'ice', green: 0.5, primarySkillId: 32, red: 0.1, selector: 3 },
    { blue: 0.1, cue: 'start-boulder', damageKind: 'magic', green: 1, primarySkillId: 40, red: 0.1, selector: 4 },
  ] as const

  for (const row of rows) {
    const castContext = context(50, 1, 0)
    const authority = castContext.players.player!
    const skillBook = withElementalPrimary(authority.skillBook, row.primarySkillId)
    const initialRng = createNativeRng(123)
    const etherDamage = drawNativeFloatRange(initialRng, 1, 2)
    const expectedBaseDamage = row.selector === 0
      ? etherDamage.value
      : [0, 4, 2.5, 2.5, 10][row.selector]!
    let state = stepNativeSecondaryAbilities(
      { ...createNativeSecondarySimulation(123), rng: initialRng },
      {
        ...castContext,
        players: { player: { ...authority, skillBook } },
      },
    ).state
    const trap = state.actors.find(({ kind }) => kind === 'magic-trap')
    assert.deepEqual(trap && {
      damage: trap.damage,
      frame: trap.frame,
      phase: trap.phase,
      scale: trap.scale,
      variant: trap.variant,
    }, {
      damage: Math.fround(expectedBaseDamage * Math.fround(5)),
      frame: 0,
      phase: Math.fround(3),
      scale: 0,
      variant: row.selector,
    })
    assert.deepEqual(state.rng, row.selector === 0 ? etherDamage.state : initialRng)
    assert.deepEqual(state.events.flatMap(({ cue }) => cue === null ? [] : [cue]), [
      'set-trap',
      row.cue,
    ])
    assert.deepEqual(screenFlashes(state), [
      expectedScreenFlash(row.red, row.green, row.blue, 0.1, false),
    ])

    let triggerResult: ReturnType<typeof stepNativeSecondaryAbilities> | null = null
    for (let tick = 2; tick <= 26; tick += 1) {
      const tickContext = context(50, tick, null)
      triggerResult = stepNativeSecondaryAbilities(state, {
        ...tickContext,
        players: {
          player: { ...tickContext.players.player!, skillBook },
        },
        target: (_worldKey, targetId) => targetId === target.id ? target : null,
        targets: () => [target],
      })
      state = triggerResult.state
    }
    assert.ok(triggerResult)
    assert.deepEqual(
      triggerResult.damage.map(({ kind }) => kind),
      row.selector === 2 ? [] : [row.damageKind],
    )
    assert.deepEqual(screenFlashes(state), [
      expectedScreenFlash(row.red, row.green, row.blue, 0.1, false),
      expectedScreenFlash(row.red, row.green, row.blue, 0.05, true),
    ])
    const burnKind = row.selector === 1 ? 'fire-burn' : 'electric-burn'
    const burns = state.actors.filter(({ kind }) => kind === burnKind)
    assert.equal(burns.length, row.selector === 1 || row.selector === 2 ? 1 : 0)
    if (row.selector === 1) {
      assert.deepEqual(burns.map(({ lifetimeTicks, targetId }) => ({ lifetimeTicks, targetId })), [
        { lifetimeTicks: 200, targetId: target.id },
      ])
    }
    if (row.selector === 2) {
      assert.deepEqual(burns.map(({ alpha, lifetimeTicks, targetId, variant }) => ({
        alpha, lifetimeTicks, targetId, variant,
      })), [
        { alpha: 0, lifetimeTicks: 100, targetId: target.id, variant: 2 },
      ])
    }
    assert.equal(
      state.targetEffects.some(({ coldSlowTicks, targetId }) => (
        targetId === target.id && coldSlowTicks > 0
      )),
      row.selector === 3,
    )
  }
})

test('Magic Trap water payload owns float32 contact and truncating ColdSlow lifetime', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 33, position: { x: 100, y: 0 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  const castContext = context(50, 1, 0)
  const authority = castContext.players.player!
  const skillBook = withElementalPrimary(authority.skillBook, 32)
  const slowFactor = Math.fround(0.5 / 1.3)
  let state = stepNativeSecondaryAbilities(createNativeSecondarySimulation(123), {
    ...castContext,
    players: { player: { ...authority, coldSlowFactor: slowFactor, skillBook } },
  }).state
  const fullPayload = state.actors.find(({ kind }) => kind === 'magic-trap')!.damage
  assert.equal(fullPayload, Math.fround(2.5 * Math.fround(5)))

  let expectedCharge = Math.fround(0)
  for (let age = 1; age < 150; age += 1) {
    expectedCharge = Math.min(1, Math.fround(expectedCharge + Math.fround(1 / 800)))
    const tickContext = context(50, age + 1, null)
    state = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      players: {
        player: { ...tickContext.players.player!, coldSlowFactor: slowFactor, skillBook },
      },
    }).state
  }

  expectedCharge = Math.min(1, Math.fround(expectedCharge + Math.fround(1 / 800)))
  const triggerContext = context(50, 151, null)
  const trigger = stepNativeSecondaryAbilities(state, {
    ...triggerContext,
    players: {
      player: { ...triggerContext.players.player!, coldSlowFactor: slowFactor, skillBook },
    },
    target: (_worldKey, targetId) => targetId === target.id ? target : null,
    targets: () => [target],
  })
  assert.deepEqual(trigger.damage, [{
    amount: Math.fround(fullPayload * expectedCharge),
    kind: 'ice',
    ownerId: 'player',
    sourceActorId: 1,
    targetId: target.id,
  }])
  assert.equal(Math.trunc(400 * expectedCharge), 74)
  const effect = trigger.state.targetEffects.find(({ targetId }) => targetId === target.id)
  assert.deepEqual(effect && {
    coldSlowTicks: effect.coldSlowTicks,
    targetId: effect.targetId,
    timeScale: effect.timeScale,
    worldKey: effect.worldKey,
  }, {
    coldSlowTicks: 74,
    targetId: target.id,
    timeScale: slowFactor,
    worldKey: 'boneyard:test',
  })
})

test('Magic Trap ElectricBurn owns exact target-following RNG, light state, and 100 damage updates', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 33, position: { x: 100, y: 0 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  const castContext = context(50, 1, 0)
  const authority = castContext.players.player!
  const skillBook = withElementalPrimary(authority.skillBook, 24)
  let state = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    {
      ...castContext,
      players: { player: { ...authority, skillBook } },
    },
  ).state
  let terminal: ReturnType<typeof stepNativeSecondaryAbilities> | null = null
  for (let tick = 2; tick <= 26; tick += 1) {
    const tickContext = context(50, tick, null)
    terminal = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      players: { player: { ...tickContext.players.player!, skillBook } },
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [target],
    })
    state = terminal.state
  }
  assert.ok(terminal)
  assert.deepEqual(terminal.damage, [])
  const born = state.actors.find(({ kind }) => kind === 'electric-burn')
  assert.ok(born)
  assert.deepEqual({
    ageTicks: born.ageTicks,
    alpha: born.alpha,
    lightRegistration: born.lightRegistration,
    lifetimeTicks: born.lifetimeTicks,
    miscLightAppendOrdinal: born.miscLightAppendOrdinal,
    radius: born.radius,
    targetId: born.targetId,
  }, {
    ageTicks: 0,
    alpha: 0,
    lightRegistration: TARGET_LIGHT_REGISTRATION,
    lifetimeTicks: 100,
    miscLightAppendOrdinal: 0,
    radius: Math.fround(0.5),
    targetId: target.id,
  })

  const rng = createNativeRng(16)
  state = { ...state, rng }
  const light = drawNativeFloat(rng, 0.25, true)
  const scalarGate = drawNativeInteger(light.state, 3)
  assert.equal(scalarGate.value, 1)
  const scalar = drawNativeFloat(scalarGate.state, 0.5)
  const movedTarget = { ...target, position: { x: 125, y: -20 } }
  const firstTickContext = context(50, 27, null)
  let result = stepNativeSecondaryAbilities(state, {
    ...firstTickContext,
    players: { player: { ...firstTickContext.players.player!, skillBook } },
    target: (_worldKey, targetId) => targetId === target.id ? movedTarget : null,
    targets: () => [movedTarget],
  })
  const live = result.state.actors.find(({ kind }) => kind === 'electric-burn')
  assert.deepEqual(result.state.rng, scalar.state)
  assert.deepEqual(live && {
    ageTicks: live.ageTicks,
    alpha: live.alpha,
    phase: live.phase,
    position: live.position,
    radius: live.radius,
  }, {
    ageTicks: 1,
    alpha: Math.fround(1),
    phase: Math.fround(Math.fround(0.25) + scalar.value),
    position: movedTarget.position,
    radius: Math.fround(Math.fround(0.5) + light.value),
  })
  assert.deepEqual(result.damage, [{
    amount: born.damage,
    kind: 'lightning',
    ownerId: 'player',
    sourceActorId: born.id,
    targetId: target.id,
  }])

  let damageUpdates = result.damage.length
  state = result.state
  for (let tick = 28; tick <= 126; tick += 1) {
    const tickContext = context(50, tick, null)
    result = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      players: { player: { ...tickContext.players.player!, skillBook } },
      target: (_worldKey, targetId) => targetId === target.id ? movedTarget : null,
      targets: () => [movedTarget],
    })
    damageUpdates += result.damage.length
    assert.ok(result.damage.every(({ amount, kind }) => (
      amount === born.damage && kind === 'lightning'
    )))
    state = result.state
  }
  assert.equal(damageUpdates, 100)
  assert.equal(state.actors.some(({ kind }) => kind === 'electric-burn'), false)
})

test('Magic Trap ElectricBurn reattachment max-refreshes one target modifier and replaces its payload', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 33, position: { x: 100, y: 0 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  const firstCastContext = context(50, 1, 0)
  const firstAuthority = firstCastContext.players.player!
  const firstSkillBook = withElementalPrimary(firstAuthority.skillBook, 24)
  let state = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    {
      ...firstCastContext,
      players: { player: { ...firstAuthority, skillBook: firstSkillBook } },
    },
  ).state
  for (let tick = 2; tick <= 26; tick += 1) {
    const tickContext = context(50, tick, null)
    state = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      players: { player: { ...tickContext.players.player!, skillBook: firstSkillBook } },
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [target],
    }).state
  }
  const original = state.actors.find(({ kind }) => kind === 'electric-burn')!

  for (let tick = 27; tick <= 46; tick += 1) {
    const tickContext = context(50, tick, null)
    state = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      players: { player: { ...tickContext.players.player!, skillBook: firstSkillBook } },
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [target],
    }).state
  }
  assert.equal(state.actors.find(({ id }) => id === original.id)?.ageTicks, 20)

  const secondCastContext = context(50, 47, 0, 100, [], 2)
  const secondAuthority = secondCastContext.players.player!
  const secondSkillBook = withElementalPrimary(secondAuthority.skillBook, 24)
  state = stepNativeSecondaryAbilities(finishCommonCastGate(state), {
    ...secondCastContext,
    players: { player: { ...secondAuthority, skillBook: secondSkillBook } },
    target: (_worldKey, targetId) => targetId === target.id ? target : null,
    targets: () => [target],
  }).state
  const secondTrap = state.actors.find(({ kind }) => kind === 'magic-trap')!
  let expectedCharge = Math.fround(0)
  for (let tick = 48; tick <= 72; tick += 1) {
    expectedCharge = Math.min(1, Math.fround(
      expectedCharge + Math.fround(1 / 800),
    ))
    const tickContext = context(50, tick, null, 100, [], 2)
    state = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      players: { player: { ...tickContext.players.player!, skillBook: secondSkillBook } },
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [target],
    }).state
  }

  const electricBurns = state.actors.filter(({ kind }) => kind === 'electric-burn')
  assert.equal(electricBurns.length, 1)
  assert.deepEqual(electricBurns.map(({ ageTicks, damage, id, lifetimeTicks }) => ({
    ageTicks, damage, id, lifetimeTicks,
  })), [{
    ageTicks: 0,
    damage: Math.fround(
      Math.fround(secondTrap.damage * expectedCharge) / 100,
    ),
    id: original.id,
    lifetimeTicks: 100,
  }])
})

test('Magic Trap owns float32 charge, 32 shimmer emissions, split query geometry, and 502-word terminal RNG', () => {
  const armingTarget = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 33, position: { x: 150, y: 50 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  const payloadOnlyTarget = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 34, position: { x: 240, y: 140 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  let state = cast(50).state
  const fullPayload = state.actors.find(({ kind }) => kind === 'magic-trap')!.damage
  let expectedCharge = Math.fround(0)

  for (let age = 1; age <= 24; age += 1) {
    expectedCharge = Math.min(1, Math.fround(expectedCharge + Math.fround(1 / 800)))
    const tickContext = context(50, age + 1, null)
    const result = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      target: (_worldKey, targetId) => targetId === armingTarget.id
        ? armingTarget
        : targetId === payloadOnlyTarget.id ? payloadOnlyTarget : null,
      targets: () => [armingTarget, payloadOnlyTarget],
    })
    assert.deepEqual(result.damage, [], `trap triggered before age 25 at age ${age}`)
    if (age === 1) {
      const trapDamage = drawNativeFloatRange(createNativeRng(123), 1, 2)
      const rotation = drawNativeFloat(trapDamage.state, 360)
      const alpha = drawNativeFloat(rotation.state, 0.25)
      const shimmer = result.state.actors.find(({ kind }) => kind === 'magic-trap-shimmer')
      const shimmerScalar = Math.fround(
        Math.fround(3) * Math.fround(0.8999999761581421),
      )
      assert.deepEqual(shimmer && {
        ageTicks: shimmer.ageTicks,
        alpha: shimmer.alpha,
        rotationRadians: shimmer.rotationRadians,
        scale: shimmer.scale,
        variant: shimmer.variant,
      }, {
        ageTicks: 0,
        alpha: Math.fround(0.75 + alpha.value),
        rotationRadians: rotation.value * Math.PI / 180,
        scale: Math.fround(shimmerScalar * Math.fround(3)),
        variant: 0,
      })
    }
    state = result.state
  }

  const preTriggerRng = state.rng
  expectedCharge = Math.min(1, Math.fround(expectedCharge + Math.fround(1 / 800)))
  const triggerContext = context(50, 26, null)
  const trigger = stepNativeSecondaryAbilities(state, {
    ...triggerContext,
    target: (_worldKey, targetId) => targetId === armingTarget.id
      ? armingTarget
      : targetId === payloadOnlyTarget.id ? payloadOnlyTarget : null,
    targets: () => [armingTarget, payloadOnlyTarget],
  })
  assert.deepEqual(trigger.damage.map(({ targetId }) => targetId), [
    armingTarget.id,
    payloadOnlyTarget.id,
  ])
  assert.ok(trigger.damage.every(({ amount }) => (
    amount === Math.fround(fullPayload * expectedCharge)
  )))
  assert.equal(trigger.state.actors.some(({ kind }) => kind === 'magic-trap'), false)
  const burst = trigger.state.actors.find(({ kind }) => kind === 'magic-trap-burst')
  assert.deepEqual(burst && {
    lifetimeTicks: burst.lifetimeTicks,
    presentationRng: burst.presentationRng,
  }, {
    lifetimeTicks: 116,
    presentationRng: preTriggerRng,
  })
  assert.deepEqual(
    trigger.state.rng,
    advanceNativeRngWords(preTriggerRng, 502 + 2),
  )
  assert.equal(trigger.state.events.at(-1)?.cue, 'trap')
  assert.equal(trigger.state.events.at(-1)?.cameraMagnitude, 1.25)
  assert.ok(trigger.state.actors.some(({ kind }) => kind === 'magic-trap-shimmer'))

  let afterTrigger = trigger.state
  for (let tick = 27; tick <= 47; tick += 1) {
    afterTrigger = stepNativeSecondaryAbilities(
      afterTrigger,
      context(50, tick, null),
    ).state
  }
  assert.equal(afterTrigger.actors.some(({ kind }) => kind === 'magic-trap-shimmer'), false)
  assert.equal(afterTrigger.actors.some(({ kind }) => kind === 'magic-trap-burst'), true)

  let fullCharge = cast(50).state
  for (let age = 1; age <= 800; age += 1) {
    fullCharge = stepNativeSecondaryAbilities(
      fullCharge,
      context(50, age + 1, null),
    ).state
  }
  const chargedTrap = fullCharge.actors.find(({ kind }) => kind === 'magic-trap')
  assert.deepEqual(chargedTrap && {
    ageTicks: chargedTrap.ageTicks,
    frame: chargedTrap.frame,
    phase: chargedTrap.phase,
    scale: chargedTrap.scale,
  }, {
    ageTicks: 800,
    frame: 0,
    phase: 0,
    scale: 1,
  })
  assert.equal(fullCharge.nextActorId, 34)
  assert.deepEqual(fullCharge.rng, advanceNativeRngWords(createNativeRng(123), 1 + 32 * 2))
})

test('Magic Trap weld dispatch uses host RNG and Plane Orb preserves the selected build', () => {
  const source = createNativeSecondarySimulation(123)
  const weldContext = context(50, 1, 0)
  const weldAuthority = weldContext.players.player!
  const weldChoice = drawNativeInteger(source.rng, 2)
  const weldSkillBook = withEffectiveSkillRank(weldAuthority.skillBook, 16, 2)
  const welded = stepNativeSecondaryAbilities(source, {
    ...weldContext,
    players: {
      player: {
        ...weldAuthority,
        skillBook: { ...weldSkillBook, primarySkillId: 52, weldBuildId: 1000 },
      },
    },
  }).state
  const weldSelector = [0, 1][weldChoice.value]!
  const weldedTrap = welded.actors.find(({ kind }) => kind === 'magic-trap')
  const weldEtherDamage = drawNativeFloatRange(weldChoice.state, 1, 2)
  assert.deepEqual(weldedTrap && {
    damage: weldedTrap.damage,
    variant: weldedTrap.variant,
  }, {
    damage: weldSelector === 0
      ? Math.fround(weldEtherDamage.value * Math.fround(5))
      : Math.fround(7 * Math.fround(5)),
    variant: weldSelector,
  })
  assert.deepEqual(welded.rng, weldSelector === 0 ? weldEtherDamage.state : weldChoice.state)

  let planewalker = cast(12).state
  planewalker = stepNativeSecondaryAbilities(planewalker, context(50, 2, null)).state
  planewalker = stepNativeSecondaryAbilities(
    finishCommonCastGate(planewalker),
    context(50, 3, 0),
  ).state
  assert.equal(
    planewalker.actors.find(({ kind }) => kind === 'magic-trap')?.variant,
    0,
  )
  assert.deepEqual(screenFlashes(planewalker).at(-1),
    expectedScreenFlash(1, 0.1, 1, 0.1, false))
})

test('Plane Orb damage sums only the seven native Ether-line ranks', () => {
  const sourceBook = createPlayerSkillBook(CONFIG)
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  const nativeRanks = new Map([
    [8, 1], [10, 2], [9, 3], [13, 4], [14, 5], [15, 6], [12, 7],
  ])
  for (const [skillId, rank] of nativeRanks) {
    permanentRanks[skillId] = rank
    effectiveRanks[skillId] = rank
  }
  permanentRanks[11] = 10
  effectiveRanks[11] = 10
  const skillBook: PlayerSkillBookComponent = {
    ...sourceBook,
    effectiveRanks: Object.freeze(effectiveRanks),
    permanentRanks: Object.freeze(permanentRanks),
  }
  assert.equal(nativePlaneOrbDamage(skillBook), 0.56)

  const enableContext = context(12, 1, 0, 1_000)
  let state = stepNativeSecondaryAbilities(createNativeSecondarySimulation(123), {
    ...enableContext,
    players: {
      player: { ...enableContext.players.player!, skillBook },
    },
  }).state
  const releasedContext = context(12, 2, null)
  state = stepNativeSecondaryAbilities(state, {
    ...releasedContext,
    players: {
      player: { ...releasedContext.players.player!, skillBook },
    },
  }).state
  const orbContext = context(12, 3, null)
  state = stepNativeSecondaryAbilities(state, {
    ...orbContext,
    players: {
      player: {
        ...orbContext.players.player!,
        input: {
          ...orbContext.players.player!.input,
          cast: { primary: true, quickbar: null },
        },
        skillBook,
      },
    },
  }).state
  assert.equal(state.actors.find(({ kind }) => kind === 'plane-orb-shot')?.damage, 0.56)
})

test('Plane Orb birth owns its 181-word constructor/burst, exact audio, flash, and perspective children', () => {
  const enabled = cast(12).state
  const initialRng = enabled.rng
  const planeContext = context(12, 2, null)
  const authority = planeContext.players.player!
  const born = stepNativeSecondaryAbilities(enabled, {
    ...planeContext,
    players: {
      player: {
        ...authority,
        input: {
          ...authority.input,
          cast: { primary: true, quickbar: null },
        },
      },
    },
  }).state

  const maximumScale = drawNativeFloat(initialRng, 1.5)
  assert.deepEqual(born.rng, advanceNativeRngWords(initialRng, 181))
  const orb = born.actors.find(({ kind }) => kind === 'plane-orb-shot')!
  assert.deepEqual({
    enhanced: orb.enhanced,
    phase: orb.phase,
    position: orb.position,
    scale: orb.scale,
    slowFactor: orb.slowFactor,
    velocity: orb.velocity,
  }, {
    enhanced: false,
    phase: 1,
    position: { x: 0, y: 0 },
    scale: 0.5,
    slowFactor: 1 + maximumScale.value,
    velocity: { x: 1.75, y: 0 },
  })

  const particles = born.actors.filter(({ kind }) => kind === 'plane-orb-particle')
  assert.equal(particles.length, 27)
  assert.equal(particles.filter(({ variant }) => variant === 11).length, 9)
  assert.equal(particles.filter(({ variant }) => variant === 45).length, 18)

  const radius = drawNativeFloat(maximumScale.state, 100)
  const jitter = drawNativeFloat(radius.state, 10, true)
  const scale = drawNativeFloat(jitter.state, 4)
  const speed = drawNativeFloat(scale.state, 5)
  const life = drawNativeFloat(speed.state, 0.05)
  const jitterRadians = jitter.value * Math.PI / 180
  const positionDirection = {
    x: Math.fround(Math.sin(jitterRadians)),
    y: Math.fround(-Math.cos(jitterRadians)),
  }
  const velocityDirection = {
    x: Math.fround(Math.sin(0)),
    y: Math.fround(-Math.cos(0)),
  }
  assert.deepEqual(particles[0], {
    ...particles[0],
    alpha: 1,
    position: {
      x: Math.fround(radius.value * positionDirection.x),
      y: Math.fround(radius.value * positionDirection.y),
    },
    quantity: 0.5,
    rotationRadians: 0,
    scale: Math.fround(1 + scale.value),
    slowFactor: Math.fround(
      Math.fround(0.1) * Math.fround(0.1 + life.value),
    ),
    variant: 11,
    velocity: {
      x: Math.fround(-speed.value * velocityDirection.x),
      y: Math.fround(-speed.value * velocityDirection.y),
    },
  })

  const birthEvents = born.events.filter(({ eventId }) => eventId >= enabled.nextEventId)
  assert.deepEqual(birthEvents.map(({ cue, pitch }) => ({ cue, pitch })), [
    { cue: 'distort-reality', pitch: 1 },
    { cue: 'lightning-start', pitch: 2 },
  ])
  assert.deepEqual(birthEvents[1]?.screenFlash,
    expectedScreenFlash(1, 0, 1, 0.1, false, 0.1))

  const firstBefore = particles[0]!
  const steppedContext = context(12, 3, null)
  const steppedAuthority = steppedContext.players.player!
  const stepped = stepNativeSecondaryAbilities(born, {
    ...steppedContext,
    players: {
      player: {
        ...steppedAuthority,
        input: {
          ...steppedAuthority.input,
          cast: { primary: true, quickbar: null },
        },
      },
    },
  }).state
  const firstAfter = stepped.actors.find(({ id }) => id === firstBefore.id)!
  assert.deepEqual({
    ageTicks: firstAfter.ageTicks,
    alpha: firstAfter.alpha,
    position: firstAfter.position,
    velocity: firstAfter.velocity,
  }, {
    ageTicks: 1,
    alpha: Math.fround(1 - firstBefore.slowFactor),
    position: {
      x: Math.fround(firstBefore.position.x + firstBefore.velocity.x),
      y: Math.fround(firstBefore.position.y + firstBefore.velocity.y),
    },
    velocity: {
      x: Math.fround(firstBefore.velocity.x * Math.fround(0.95)),
      y: Math.fround(firstBefore.velocity.y * Math.fround(0.95)),
    },
  })
})

test('Plane Orb uses the exact sixth-update contact center, enhanced five-word mote, and moving fade boundary', () => {
  let enabled = cast(12).state
  const castContext = context(12, 2, null)
  const withPrimary = (base: NativeSecondaryTickContext, enhancedEffects: boolean) => ({
    ...base,
    players: {
      player: {
        ...base.players.player!,
        enhancedEffects,
        input: {
          ...base.players.player!.input,
          cast: { primary: true, quickbar: null },
        },
      },
    },
  })
  enabled = stepNativeSecondaryAbilities(
    enabled,
    withPrimary(castContext, true),
  ).state
  const beforeMoteRng = enabled.rng
  const particleIds = new Set(enabled.actors
    .filter(({ kind }) => kind === 'plane-orb-particle')
    .map(({ id }) => id))
  const enhancedStep = stepNativeSecondaryAbilities(
    enabled,
    withPrimary(context(12, 3, null), true),
  ).state
  assert.deepEqual(enhancedStep.rng, advanceNativeRngWords(beforeMoteRng, 5))
  const parent = enhancedStep.actors.find(({ kind }) => kind === 'plane-orb-shot')!
  const mote = enhancedStep.actors.find(({ kind, id }) => (
    kind === 'plane-orb-particle' && !particleIds.has(id)
  ))!
  const heading = drawNativeFloat(beforeMoteRng, 360)
  const verticalJitter = drawNativeFloat(heading.state, 5)
  const moteScale = drawNativeFloat(verticalJitter.state, 0.5)
  const moteSpeed = drawNativeFloat(moteScale.state, 3)
  const moteLife = drawNativeFloat(moteSpeed.state, 0.15)
  const headingRadians = heading.value * Math.PI / 180
  const direction = {
    x: Math.fround(Math.sin(headingRadians)),
    y: Math.fround(-Math.cos(headingRadians)),
  }
  const radialDistance = Math.fround(parent.scale * 20)
  assert.deepEqual({
    position: mote.position,
    quantity: mote.quantity,
    rotationRadians: mote.rotationRadians,
    scale: mote.scale,
    slowFactor: mote.slowFactor,
    variant: mote.variant,
    velocity: mote.velocity,
  }, {
    position: {
      x: Math.fround(parent.position.x + radialDistance * direction.x),
      y: Math.fround(
        parent.position.y + radialDistance * direction.y
          - 15 - verticalJitter.value,
      ),
    },
    quantity: 0.5,
    rotationRadians: headingRadians,
    scale: Math.fround(0.5 + moteScale.value),
    slowFactor: Math.fround(
      Math.fround(0.1) * Math.fround(0.15 + moteLife.value),
    ),
    variant: 11,
    velocity: {
      x: Math.fround(moteSpeed.value * direction.x),
      y: Math.fround(moteSpeed.value * direction.y),
    },
  })

  let normalEnabled = cast(12).state
  normalEnabled = stepNativeSecondaryAbilities(
    normalEnabled,
    withPrimary(context(12, 2, null), false),
  ).state
  const queryRows: Array<{ position: { x: number; y: number }; radius: number }> = []
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 77, position: { x: 20, y: -15 }, radius: 1, scale: 1, shieldHealth: 0,
  }
  let pulseDamage = 0
  for (let tick = 3; tick <= 8; tick += 1) {
    const base = context(12, tick, null)
    const result = stepNativeSecondaryAbilities(normalEnabled, {
      ...withPrimary(base, false),
      targets: (_worldKey, position, radius) => {
        queryRows.push({ position, radius })
        return [target]
      },
    })
    normalEnabled = result.state
    pulseDamage += result.damage.reduce((sum, contact) => sum + contact.amount, 0)
  }
  const afterSix = normalEnabled.actors.find(({ kind }) => kind === 'plane-orb-shot')!
  assert.deepEqual(queryRows, [{
    position: { x: afterSix.position.x, y: Math.fround(afterSix.position.y - 15) },
    radius: afterSix.radius,
  }])
  assert.equal(afterSix.ageTicks, 6)
  assert.equal(afterSix.quantity, 0)
  assert.equal(afterSix.radius, Math.fround(afterSix.scale * 2))
  assert.equal(
    pulseDamage,
    nativePlaneOrbDamage(context(12, 1, 0).players.player!.skillBook) * 5,
  )

  for (let tick = 9; tick <= 1_001; tick += 1) {
    normalEnabled = stepNativeSecondaryAbilities(
      normalEnabled,
      context(12, tick, null),
    ).state
  }
  const lastActive = normalEnabled.actors.find(({ kind }) => kind === 'plane-orb-shot')!
  assert.equal(lastActive.ageTicks, 999)
  const fading = stepNativeSecondaryAbilities(
    normalEnabled,
    context(12, 1_002, null),
  ).state.actors.find(({ kind }) => kind === 'plane-orb-shot')!
  assert.equal(fading.ageTicks, 1_000)
  assert.equal(fading.phase, lastActive.phase)
  assert.equal(fading.scale, Math.max(0, Math.fround(
    lastActive.scale - Math.fround(0.02),
  )))
  assert.notDeepEqual(fading.position, lastActive.position)
})

test('Dampen and Turn Undead consume their complete native child-animation RNG programs', () => {
  const dampenInitial = createNativeRng(123)
  const dampen = cast(51).state
  const dampenActor = dampen.actors.find(({ kind }) => kind === 'dampen-wave')!
  assert.deepEqual(
    dampenActor.presentationRng,
    advanceNativeRngWords(dampenInitial, 2),
  )
  assert.deepEqual(
    dampen.rng,
    advanceNativeRngWords(dampenInitial, 2 + 360 * 8 + 30 * 3),
  )
  assert.equal(dampenActor.lifetimeTicks, 100)

  const undeadInitial = createNativeRng(123)
  const undead = cast(77).state
  const children = undead.actors.filter(({ kind }) => kind === 'turn-undead')
  assert.equal(children.length, 35)
  const firstHeading = drawNativeFloat(undeadInitial, 360)
  const firstScale = drawNativeFloat(firstHeading.state, 1)
  const firstIncrement = drawNativeFloat(firstScale.state, 40)
  const secondScale = drawNativeFloat(firstIncrement.state, 1)
  assert.equal(children[0]?.rotationRadians, firstHeading.value * Math.PI / 180)
  assert.equal(children[0]?.scale, 1 + firstScale.value)
  assert.equal(
    children[1]?.rotationRadians,
    Math.fround(firstHeading.value + 20 + firstIncrement.value) * Math.PI / 180,
  )
  assert.equal(children[1]?.scale, 1 + secondScale.value)
  assert.deepEqual(undead.rng, advanceNativeRngWords(undeadInitial, 71))
})

test('Dampen removes projectiles, disrupts casters, rolls shield dispels, and owns CastSpin', () => {
  const initialRng = createNativeRng(123)
  const actionIdentity = drawNativeInteger(initialRng, 100_000)
  const shieldRoll = drawNativeInteger(actionIdentity.state, 100)
  const result = cast(51)

  assert.deepEqual(result.removedProjectileIds, [8, 9])
  assert.deepEqual(result.disruptedTargetIds, [7])
  assert.deepEqual(result.dispelledShieldTargetIds, shieldRoll.value < 0x33 ? [10] : [])
  assert.equal(result.state.players.player?.castSpinTicksRemaining, 73)
  assert.deepEqual(
    result.state.targetEffects.find(({ targetId }) => targetId === 7),
    {
      circleSlowFactor: 1,
      circleSlowTicks: 0,
      coldSlowFactor: 1,
      coldSlowMaterial: false,
      coldSlowTicks: 0,
      dazzleMaximumTicks: 0,
      dazzleTicks: 0,
      disruptedTicks: 600,
      electricBurn: null,
      fleeTicks: 0,
      frostBurnDamagePerTick: 0,
      frostBurnOwnerId: null,
      frostBurnSkillId: null,
      frostBurnSourceActorId: null,
      frostBurnTicks: 0,
      frozenTicks: 0,
      frozenTimeScale: 1,
      movementModifierOrder: [],
      prismaticTicks: 0,
      stunFactor: 1,
      stunTicks: 0,
      steamed: null,
      targetId: 7,
      timeScale: 1,
      weakenFactor: 1,
      worldKey: 'boneyard:test',
    },
  )
  assert.deepEqual(
    result.state.events.map(({ cue, kind }) => ({ cue, kind })),
    [
      { cue: 'flash', kind: 'cast' },
      { cue: 'dampen', kind: 'pulse' },
      { cue: null, kind: 'cast' },
    ],
  )
})

test('Turn Undead filters the four native families and installs exact flee and weaken state', () => {
  const targets = [
    { family: 'SKELETON', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 1, position: { x: 10, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'SKELETONARCHER', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 2, position: { x: 20, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'SKELETONMAGE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 3, position: { x: 30, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 4, position: { x: 40, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'DEMON', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 5, position: { x: 50, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
  ] as const
  const base = context(77, 1, 0)
  const result = stepNativeSecondaryAbilities(createNativeSecondarySimulation(123), {
    ...base,
    targets: () => targets,
  })
  const stats = effectiveSecondaryAbilityRankStats(base.players.player!.skillBook, 77).values

  assert.deepEqual(
    result.state.targetEffects.map(({ fleeTicks, targetId, weakenFactor }) => ({
      fleeTicks,
      targetId,
      weakenFactor,
    })),
    [1, 2, 3, 4].map((targetId) => ({
      fleeTicks: Math.round(stats.mFlee * 100),
      targetId,
      weakenFactor: Math.max(0, 1 - stats.mWeaken / 100),
    })),
  )
  assert.deepEqual(
    result.state.events.filter(({ cue }) => cue === 'level-up')
      .map(({ pitch }) => pitch),
    [2, 3],
  )
  assert.equal(result.state.actors.filter(({ kind }) => kind === 'turn-undead').length, 35)
})

test('Mindstar and Regenerate share their toggle stream while Regenerate restores native health per tick', () => {
  for (const skillId of [78, 79] as const) {
    const enabled = cast(skillId)
    assert.deepEqual(
      enabled.state.events.map(({ cue, kind }) => ({ cue, kind })),
      [{ cue: 'mindstar', kind: 'toggle-on' }],
    )
    assert.equal(enabled.state.players.player?.[skillId === 78 ? 'mindstar' : 'regenerate'], true)
  }

  let state = cast(79).state
  const active = stepNativeSecondaryAbilities(state, context(79, 2, null))
  state = active.state
  assert.equal(active.healthRecovered.player, 1.5 / 100)
  assert.equal(state.players.player?.regenerate, true)
  state = stepNativeSecondaryAbilities(state, context(79, 3, 0)).state
  assert.equal(state.players.player?.regenerate, false)
  assert.deepEqual(
    state.events.filter(({ tick }) => tick === 3).map(({ cue, kind }) => ({ cue, kind })),
    [{ cue: 'mindstar', kind: 'toggle-off' }],
  )
})

test('secondary input is a held edge and the shared cooldown gate is silent', () => {
  let state = createNativeSecondarySimulation(1)
  let result = stepNativeSecondaryAbilities(state, context(15, 1, 0))
  state = result.state
  assert.equal(result.relocatedPlayers.player?.x, 20)
  assert.equal(state.players.player?.cooldownTicksBySkill[15], 0)
  assert.equal(state.players.player?.globalCooldownTicks, 150)

  result = stepNativeSecondaryAbilities(state, context(15, 2, 0))
  state = result.state
  assert.equal(result.relocatedPlayers.player, undefined)
  assert.equal(state.players.player?.castSequence, 1)

  state = stepNativeSecondaryAbilities(state, context(15, 3, null)).state
  result = stepNativeSecondaryAbilities(state, context(15, 4, 0))
  assert.equal(result.relocatedPlayers.player, undefined)
  assert.equal(result.state.players.player?.fizzleSequence, 0)
  assert.equal(result.state.players.player?.cooldownTicksBySkill[48], 0)
})

test('Focus accelerates retained cooldowns and its concentration owns one instant roll', () => {
  const acceleratedContext = context(48, 1, 0)
  const acceleratedPlayer = {
    ...acceleratedContext.players.player!,
    secondaryRechargeFactor: 2,
  }
  let result = stepNativeSecondaryAbilities(createNativeSecondarySimulation(1), {
    ...acceleratedContext,
    players: { player: acceleratedPlayer },
  })
  assert.equal(result.state.players.player?.cooldownTicksBySkill[48], 6_000)
  const recoveryContext = context(48, 2, null)
  result = stepNativeSecondaryAbilities(result.state, {
    ...recoveryContext,
    players: {
      player: { ...recoveryContext.players.player!, secondaryRechargeFactor: 2 },
    },
  })
  assert.equal(result.state.players.player?.cooldownTicksBySkill[48], 5_998)

  let seed = 0
  let chanceState = drawNativeFloat(createNativeRng(seed), 360).state
  chanceState = drawNativeFloat(chanceState, 360).state
  let chance = drawNativeInteger(chanceState, 100)
  while (chance.value < 75) {
    seed += 1
    chanceState = drawNativeFloat(createNativeRng(seed), 360).state
    chanceState = drawNativeFloat(chanceState, 360).state
    chance = drawNativeInteger(chanceState, 100)
  }
  const instantContext = context(48, 1, 0)
  result = stepNativeSecondaryAbilities(
    { ...createNativeSecondarySimulation(), rng: createNativeRng(seed) },
    {
      ...instantContext,
      players: {
        player: {
          ...instantContext.players.player!,
          focusInstantRechargeChancePercent: 25,
        },
      },
    },
  )
  assert.equal(result.state.players.player?.cooldownTicksBySkill[48], 0)
  assert.equal(result.state.players.player?.cooldownMaximumTicksBySkill[48], 6_000)
  assert.equal(result.state.players.player?.globalCooldownTicks, 0)
  assert.equal(result.state.players.player?.staffCastTicksRemaining, 51)
  assert.deepEqual(result.state.rng, chance.state)
})

test('rank refresh clamps dynamic cooldown current before native-rate recurrence', () => {
  const castResult = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    context(48, 1, 0),
  )
  const refreshed = stepNativeSecondaryAbilities(
    castResult.state,
    context(48, 2, null, 100, [], 2),
  )
  assert.equal(refreshed.state.players.player?.cooldownMaximumTicksBySkill[48], 3_000)
  assert.equal(refreshed.state.players.player?.cooldownTicksBySkill[48], 2_999)
})

test('Fire Wall is the recovered 300-unit eleven-patch construction', () => {
  const source = createNativeSecondarySimulation(123)
  const result = stepNativeSecondaryAbilities(source, context(73, 1, 0))
  const patches = result.state.actors.filter(({ kind }) => kind === 'fire-patch')
  assert.equal(patches.length, 11)
  assert.ok(patches.every((patch, index) => (
    Math.hypot(patch.position.x - 100, patch.position.y - (-150 + index * 30)) <= 10
  )))
  assert.deepEqual(
    patches.map(({ scale }) => Number(scale.toFixed(6))),
    Array.from({ length: 11 }, (_, index) => Number(
      (0.8 + 0.6 * Math.sin(Math.PI * index / 10)).toFixed(6),
    )),
  )
  assert.ok(patches.every(({ lifetimeTicks }) => lifetimeTicks === 700))
  assert.ok(patches.every(({ radius, slowFactor }) => (
    radius === 0 && slowFactor === Math.fround(7)
  )))

  let rng = source.rng
  const phase = drawNativeFloat(rng, 32); rng = phase.state
  const mirror = drawNativeSign(rng, 1); rng = mirror.state
  const radialDistance = drawNativeFloat(rng, 10); rng = radialDistance.state
  const radialDirection = drawUnitVectorForTest(rng); rng = radialDirection.rng
  assert.deepEqual(patches[0], {
    ...patches[0],
    lifetimeTicks: fireLifetimeTicks(7),
    phase: phase.value,
    position: {
      x: Math.fround(100 + radialDirection.value.x * radialDistance.value),
      y: Math.fround(-150 + radialDirection.value.y * radialDistance.value),
    },
    quantity: mirror.value,
  })
  for (let index = 1; index < 11; index += 1) {
    rng = drawNativeFloat(rng, 32).state
    rng = drawNativeSign(rng, 1).state
    rng = drawNativeFloat(rng, 10).state
    rng = drawUnitVectorForTest(rng).rng
  }
  assert.deepEqual(result.state.rng, rng)
})

test('secondary materialization applies Battle and Siege once at cost and actor birth', () => {
  const baselineContext = context(73, 1, 0)
  const baseline = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    baselineContext,
  )
  const scaled = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    {
      ...baselineContext,
      players: {
        player: {
          ...baselineContext.players.player!,
          offensiveFactors: { damage: 2, manaCost: 0.5 },
        },
      },
    },
  )
  const baselinePatch = baseline.state.actors.find(({ kind }) => kind === 'fire-patch')
  const scaledPatch = scaled.state.actors.find(({ kind }) => kind === 'fire-patch')
  assert.ok(baselinePatch)
  assert.ok(scaledPatch)
  assert.equal(scaledPatch.damage, baselinePatch.damage * 2)
  assert.equal(scaled.manaSpent.player, baseline.manaSpent.player! * 0.5)
})

test('Ring of Fire owns the exact seven-word construction for thirty segments and one contact wave', () => {
  const source = createNativeSecondarySimulation(123)
  const result = stepNativeSecondaryAbilities(source, context(21, 1, 0))
  const actors = result.state.actors
  const segments = actors.filter(({ kind }) => kind === 'moving-fire')
  assert.equal(segments.length, 30)
  assert.equal(actors.filter(({ kind }) => kind === 'shockwave').length, 1)
  assert.equal(new Set(segments.map(({ variant }) => variant)).size, 30)

  let rng = source.rng
  const phase = drawNativeFloat(rng, 32); rng = phase.state
  const mirror = drawNativeSign(rng, 1); rng = mirror.state
  const jitter = drawNativeFloat(rng, 2, true); rng = jitter.state
  const radialDistance = drawNativeFloat(rng, 30); rng = radialDistance.state
  const radialDirection = drawUnitVectorForTest(rng); rng = radialDirection.rng
  const speed = drawNativeFloat(rng, 0.025); rng = speed.state
  const radians = jitter.value * Math.PI / 180
  const heading = { x: Math.sin(radians), y: -Math.cos(radians) }
  assert.deepEqual(segments[0], {
    ...segments[0],
    lifetimeTicks: 106,
    phase: phase.value,
    position: {
      x: Math.fround(
        heading.x * 25 + radialDirection.value.x * radialDistance.value,
      ),
      y: Math.fround(
        heading.y * 25 + radialDirection.value.y * radialDistance.value * 0.8,
      ),
    },
    quantity: mirror.value,
    radius: 0,
    rotationRadians: radians,
    slowFactor: Math.fround(Math.fround(0.7) * Math.fround(1.5)),
    velocity: {
      x: Math.fround(heading.x * 2.5 * (1 - speed.value)),
      y: Math.fround(heading.y * 2.5 * (1 - speed.value)),
    },
  })
  for (let index = 1; index < 30; index += 1) {
    rng = drawNativeFloat(rng, 32).state
    rng = drawNativeSign(rng, 1).state
    rng = drawNativeFloat(rng, 2, true).state
    rng = drawNativeFloat(rng, 30).state
    rng = drawUnitVectorForTest(rng).rng
    rng = drawNativeFloat(rng, 0.025).state
  }
  assert.deepEqual(result.state.rng, rng)
})

test('Burning Man adds the native Region pulse and a radius-165 half-damage explosion per first contact', () => {
  const castContext = context(21, 1, 0)
  let state = stepNativeSecondaryAbilities(createNativeSecondarySimulation(123), {
    ...castContext,
    players: {
      player: { ...castContext.players.player!, maximumRingOfFire: true },
    },
  }).state
  const wave = state.actors.find(({ kind }) => kind === 'shockwave')!
  assert.equal(wave.variant, 1)
  assert.equal(state.events.find(({ cue }) => cue === 'big-fire')?.cameraMagnitude, 0.25)
  const first = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 91, nativeFlags: 0x2, position: { x: 10, y: 0 }, radius: 10,
    scale: 1, shieldHealth: 0,
  }
  const second = { ...first, id: 92, position: { x: 100, y: 0 } }
  let result: ReturnType<typeof stepNativeSecondaryAbilities> | null = null
  for (let tick = 2; tick <= 11; tick += 1) {
    const tickContext = context(21, tick, null)
    result = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      targets: (_worldKey, center, radius) => radius === 165
        ? [first, second]
        : center.x === 0 ? [first] : [],
    })
    state = result.state
  }
  assert.ok(result)
  const explosion = state.actors.find(({ kind }) => kind === 'ring-fire-explosion')!
  assert.deepEqual({
    damage: explosion.damage,
    position: explosion.position,
    radius: explosion.radius,
    scale: explosion.scale,
  }, {
    damage: Math.fround(wave.damage * 0.5),
    position: first.position,
    radius: 165,
    scale: Math.fround(1.5),
  })
  assert.equal(state.actors.filter(({ kind }) => kind === 'ring-fire-fragment').length, 3)
  const explosionEvents = state.events.filter(({ actorId }) => actorId === explosion.id)
  assert.deepEqual(explosionEvents.map(({ cue }) => cue), ['fireball-hit', 'throw-fire'])
  assert.ok(explosionEvents[0]!.pitch >= 0.9 && explosionEvents[0]!.pitch <= 1.1)
  assert.equal(explosionEvents[1]!.pitch, Math.fround(0.8))
  assert.deepEqual(result!.damage.map(({ amount, targetId }) => ({ amount, targetId })), [
    { amount: wave.damage, targetId: first.id },
    { amount: Math.fround(wave.damage * 0.5), targetId: first.id },
    { amount: Math.fround(wave.damage * 0.5), targetId: second.id },
  ])
})

test('Burning Man replays registered Ember pre-tick contacts and consumes contacted fragments', () => {
  const castContext = context(21, 1, 0)
  let state = stepNativeSecondaryAbilities(createNativeSecondarySimulation(123), {
    ...castContext,
    players: {
      player: { ...castContext.players.player!, maximumRingOfFire: true },
    },
  }).state
  const wave = state.actors.find(({ kind }) => kind === 'shockwave')!
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 91, nativeFlags: 0x2, position: { x: 10, y: 0 }, radius: 10,
    scale: 1, shieldHealth: 0,
  }
  let result: ReturnType<typeof stepNativeSecondaryAbilities> | null = null
  for (let tick = 2; tick <= 11; tick += 1) {
    const tickContext = context(21, tick, null)
    result = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      targets: (_worldKey, center, radius) => radius === 165 || radius === 7
        ? [target]
        : center.x === 0 ? [target] : [],
    })
    state = result.state
  }
  assert.ok(result)
  assert.equal(state.actors.some(({ kind }) => kind === 'ring-fire-fragment'), false)
  assert.deepEqual(result.damage.map(({ amount }) => amount), [
    wave.damage,
    Math.fround(wave.damage * 0.5),
    Math.fround(wave.damage / 3),
    Math.fround(wave.damage / 3),
    Math.fround(wave.damage / 3),
  ])
})

test('Shockwave applies the summed native damage lane and normalized displacement recurrence', () => {
  let state = cast(21).state
  const wave = state.actors.find(({ kind }) => kind === 'shockwave')!
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 91,
    position: { x: 10, y: 0 },
    radius: 1,
    scale: 1,
    shieldHealth: 0,
  }
  let result: ReturnType<typeof stepNativeSecondaryAbilities> | null = null
  for (let tick = 2; tick <= 11; tick += 1) {
    const base = context(21, tick, null)
    result = stepNativeSecondaryAbilities(state, {
      ...base,
      targets: (_worldKey, _center, radius) => radius > 100 ? [target] : [],
    })
    state = result.state
  }
  assert.ok(result)
  assert.deepEqual(
    result.damage.filter(({ sourceActorId }) => sourceActorId === wave.id),
    [{
      amount: wave.damage,
      kind: 'fire',
      ownerId: 'player',
      sourceActorId: wave.id,
      targetId: target.id,
    }],
  )
  assert.deepEqual(
    result.knockbacks.filter(({ sourceActorId }) => sourceActorId === wave.id),
    [{ delta: { x: 6, y: 0 }, sourceActorId: wave.id, targetId: target.id }],
  )
})

test('MovingFire translates before accelerating and Earthquake publishes its exact shake ramp', () => {
  let ring = cast(21).state
  const born = ring.actors.find(({ kind }) => kind === 'moving-fire')!
  ring = stepNativeSecondaryAbilities(ring, context(21, 2, null)).state
  const moved = ring.actors.find(({ id }) => id === born.id)!
  assert.equal(moved.position.x, born.position.x + born.velocity.x)
  assert.equal(moved.position.y, born.position.y + born.velocity.y)
  assert.equal(moved.velocity.x, Math.fround(born.velocity.x * Math.fround(1.01)))
  assert.equal(moved.velocity.y, Math.fround(born.velocity.y * Math.fround(1.01)))

  let quake = cast(41).state
  const quakeBorn = quake.actors.find(({ kind }) => kind === 'earthquake')!
  assert.notEqual(quakeBorn.rotationRadians, 0)
  assert.equal(quakeBorn.phase, Math.fround(-5))
  assert.equal(quakeBorn.quantity, Math.fround(2))
  quake = stepNativeSecondaryAbilities(quake, context(41, 2, null)).state
  const stepped = quake.actors.find(({ kind }) => kind === 'earthquake')!
  assert.deepEqual(stepped.position, quakeBorn.position)
  assert.equal(stepped.alpha, 1)
  assert.equal(stepped.phase, Math.fround(Math.fround(-5) + Math.fround(0.05)))
  assert.ok(stepped.velocity.x >= -3 && stepped.velocity.x <= 3)
  assert.equal(stepped.velocity.y, Math.fround(Math.sin(
    quakeBorn.lifetimeTicks * 20 * Math.PI / 180,
  ) * 10))
  assert.deepEqual(
    quake.events.filter(({ cue }) => cue !== null).slice(-2).map(({ cue }) => cue),
    ['rock-hit', 'quake-cracks'],
  )
})

test('Earthquake cast owns the strict group-4 scenery ledger and persistent fixed-bound wobble order', () => {
  const scenery = [
    { id: 0, position: { x: 40, y: 0 }, typeId: 2001 },
    { id: 1, position: { x: 80, y: 0 }, typeId: 2029 },
    { id: 2, position: { x: 120, y: 0 }, typeId: 2040 },
    { id: 3, position: { x: 160, y: 0 }, typeId: 2061 },
    { id: 4, position: { x: 512, y: 0 }, typeId: 2001 },
  ] as const
  const source = createNativeSecondarySimulation(321)
  const castContext: NativeSecondaryTickContext = {
    ...context(41, 1, 0),
    sceneryTargets: () => scenery,
  }
  const result = stepNativeSecondaryAbilities(source, castContext)
  const rotation = drawNativeFloat(source.rng, 360)
  const shuffled = fixedBoundShuffleForTest(scenery.slice(0, 4), rotation.state)
  assert.deepEqual(result.state.rng, shuffled.rng)

  const quake = result.state.actors.find(({ kind }) => kind === 'earthquake')!
  const wobbleById = new Map(result.state.actors
    .filter(({ kind }) => kind === 'earthquake-scenery-wobble')
    .map((actor) => [actor.id, actor] as const))
  assert.deepEqual(
    quake.hitTargetIds.map((id) => wobbleById.get(id)?.targetId),
    shuffled.values.map(({ id }) => id),
  )
  assert.equal(wobbleById.size, 4)
  assert.equal([...wobbleById.values()].some(({ targetId }) => targetId === 4), false)
  assert.ok([...wobbleById.values()].every(({ lifetimeTicks, phase }) => (
    lifetimeTicks === Number.MAX_SAFE_INTEGER && phase === 0
  )))

  let expectedRng = drawNativeFloat(shuffled.rng, 3, true).state
  const multiplier = drawNativeSign(expectedRng, 1); expectedRng = multiplier.state
  const adjustment = drawNativeFloat(expectedRng, 1.5); expectedRng = adjustment.state
  const stepped = stepNativeSecondaryAbilities(result.state, {
    ...castContext,
    players: {
      player: { ...castContext.players.player!, input: input(null) },
    },
    tick: 2,
  })
  const steppedQuake = stepped.state.actors.find(({ id }) => id === quake.id)!
  const selectedWobble = stepped.state.actors.find(({ id }) => (
    id === quake.hitTargetIds[0]
  ))!
  assert.equal(steppedQuake.frame, 1)
  assert.equal(
    selectedWobble.phase,
    Math.fround(adjustment.value * multiplier.value),
  )
  assert.ok(stepped.state.actors
    .filter(({ kind }) => kind === 'earthquake-scenery-wobble')
    .filter(({ id }) => id !== selectedWobble.id)
    .every(({ phase }) => phase === 0))

  const terminal = {
    ...stepped.state,
    actors: stepped.state.actors.map((actor) => actor.id === quake.id
      ? { ...actor, ageTicks: actor.lifetimeTicks - 1 }
      : actor),
  }
  const retired = stepNativeSecondaryAbilities(terminal, {
    ...castContext,
    players: {
      player: { ...castContext.players.player!, input: input(null) },
    },
    tick: 3,
  }).state
  assert.equal(retired.actors.some(({ id }) => id === quake.id), false)
  assert.equal(retired.actors.some(({ id }) => id === selectedWobble.id), true)
  assert.equal(
    retired.actors.find(({ id }) => id === selectedWobble.id)?.phase,
    selectedWobble.phase,
  )
})

test('Earthquake keys its strict hostile pulse to post-decrement remaining and consumes exact pause and heading RNG', () => {
  const castResult = cast(41)
  const quake = castResult.state.actors.find(({ kind }) => kind === 'earthquake')!
  const targets = [
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 1, position: { x: 20, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 2, position: { x: 40, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 3, position: { x: 60, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 4, position: { x: 80, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 5, position: { x: 512, y: 0 }, radius: 100, scale: 1, shieldHealth: 0 },
  ]
  const pulseSource = {
    ...castResult.state,
    actors: castResult.state.actors.map((actor) => actor.id === quake.id
      ? { ...actor, lifetimeTicks: 211 }
      : actor),
    rng: createNativeRng(1),
  }
  const pulseContext = context(41, 2, null)
  const result = stepNativeSecondaryAbilities(pulseSource, {
    ...pulseContext,
    targets: () => targets,
  })

  let rng = drawNativeFloat(pulseSource.rng, 3, true).state
  const quakeRotation = drawNativeFloat(rng, 360); rng = quakeRotation.state
  const quakeScale = drawNativeInteger(rng, 4); rng = quakeScale.state
  const shuffled = fixedBoundShuffleForTest(targets.slice(0, 4), rng); rng = shuffled.rng
  const expectedHeadings: { deltaDegrees: number; targetId: number }[] = []
  const expectedPauses = new Map<number, number>()
  for (const target of shuffled.values.slice(0, 2)) {
    const pauseGate = drawNativeInteger(rng, 2); rng = pauseGate.state
    let pauseTicks = 1
    if (pauseGate.value === 1) {
      const pause = drawNativeInteger(rng, 50); rng = pause.state
      pauseTicks = 50 + pause.value
    }
    const heading = drawNativeSign(rng, 15); rng = heading.state
    expectedHeadings.push({ deltaDegrees: heading.value, targetId: target.id })
    expectedPauses.set(target.id, pauseTicks)
  }
  const debrisGate = drawNativeInteger(rng, 15); rng = debrisGate.state
  assert.notEqual(debrisGate.value, 1)
  assert.deepEqual(result.state.rng, rng)
  assert.deepEqual(result.headingPerturbations, expectedHeadings)
  assert.deepEqual(result.disruptedTargetIds, [...expectedPauses.keys()].sort((a, b) => a - b))
  assert.equal(result.disruptedTargetIds.includes(5), false)
  for (const [targetId, disruptedTicks] of expectedPauses) {
    assert.equal(
      result.state.targetEffects.find((effect) => effect.targetId === targetId)?.disruptedTicks,
      disruptedTicks,
    )
  }

  const child = result.state.actors.find(({ kind }) => kind === 'earthquake-quake')!
  const scaleX = Math.fround(2 + quakeScale.value)
  assert.deepEqual({
    alpha: child.alpha,
    lifetimeTicks: child.lifetimeTicks,
    phase: child.phase,
    rotationRadians: child.rotationRadians,
    scale: child.scale,
    slowFactor: child.slowFactor,
  }, {
    alpha: 1,
    lifetimeTicks: 180,
    phase: 0,
    rotationRadians: quakeRotation.value * Math.PI / 180,
    scale: scaleX,
    slowFactor: Math.fround(Math.fround(0.8) * scaleX),
  })
})

test('enhanced Earthquake births exact FadeSin dust and lit Anim_BoulderBit state', () => {
  const scenery = [{ id: 7, position: { x: 50, y: 40 }, typeId: 2001 }]
  const base = context(41, 1, 0)
  const enhancedContext: NativeSecondaryTickContext = {
    ...base,
    players: {
      player: { ...base.players.player!, enhancedEffects: true },
    },
    sceneryTargets: () => scenery,
  }
  const castResult = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(77),
    enhancedContext,
  )
  const source = { ...castResult.state, rng: createNativeRng(17) }
  const result = stepNativeSecondaryAbilities(source, {
    ...enhancedContext,
    players: {
      player: { ...enhancedContext.players.player!, input: input(null) },
    },
    tick: 2,
  })

  let rng = drawNativeFloat(source.rng, 3, true).state
  const wobbleSign = drawNativeSign(rng, 1); rng = wobbleSign.state
  const wobbleAmount = drawNativeFloat(rng, 1.5); rng = wobbleAmount.state
  const dustGate = drawNativeInteger(rng, 30); rng = dustGate.state
  assert.equal(dustGate.value, 1)
  const dustVelocity = drawNativeFloat(rng, 0.25); rng = dustVelocity.state
  const dustMagnitude = drawNativeFloat(rng, 0.5); rng = dustMagnitude.state
  const dustRotation = drawNativeFloat(rng, 360); rng = dustRotation.state
  const dustScale = drawNativeFloat(rng, 2); rng = dustScale.state
  const dustDistance = drawNativeFloat(rng, 30); rng = dustDistance.state
  const dustDirection = drawUnitVectorForTest(rng); rng = dustDirection.rng
  const debrisGate = drawNativeInteger(rng, 15); rng = debrisGate.state
  assert.equal(debrisGate.value, 1)

  const directionHeading = drawNativeFloat(rng, 360); rng = directionHeading.state
  const bounce = drawNativeFloat(rng, 3); rng = bounce.state
  const discardedHeight = drawNativeFloat(rng, 50); rng = discardedHeight.state
  const debrisRotation = drawNativeFloat(rng, 360); rng = debrisRotation.state
  const rotationStep = drawNativeFloat(rng, 10); rng = rotationStep.state
  const record = drawNativeInteger(rng, 3); rng = record.state
  const radius = drawNativeFloat(rng, 300); rng = radius.state
  const verticalFactor = drawNativeFloat(rng, 1.5); rng = verticalFactor.state
  const height = drawNativeFloat(rng, 50); rng = height.state
  const offset = drawNativeFloat(rng, 15); rng = offset.state
  const firstScale = drawNativeFloat(rng, 0.75); rng = firstScale.state
  assert.ok(Math.fround(0.5 + firstScale.value) >= 0.45)
  const secondScale = drawNativeFloat(rng, 0.75); rng = secondScale.state
  const scaleMultiplier = drawNativeFloat(rng, 0.35); rng = scaleMultiplier.state
  const speed = drawNativeFloat(rng, 1.5); rng = speed.state
  assert.deepEqual(result.state.rng, rng)

  const wobble = result.state.actors.find(({ kind }) => (
    kind === 'earthquake-scenery-wobble'
  ))!
  assert.equal(
    wobble.phase,
    Math.fround(wobbleSign.value * wobbleAmount.value),
  )
  const dust = result.state.actors.find(({ kind }) => kind === 'earthquake-dust')!
  assert.deepEqual({
    alpha: dust.alpha,
    lifetimeTicks: dust.lifetimeTicks,
    position: dust.position,
    quantity: dust.quantity,
    rotationRadians: dust.rotationRadians,
    scale: dust.scale,
    targetId: dust.targetId,
    velocity: dust.velocity,
  }, {
    alpha: 1,
    lifetimeTicks: 360,
    position: {
      x: Math.fround(50 + dustDirection.value.x * dustDistance.value),
      y: Math.fround(40 + dustDirection.value.y * dustDistance.value),
    },
    quantity: Math.fround(0.5 + dustMagnitude.value),
    rotationRadians: dustRotation.value * Math.PI / 180,
    scale: Math.fround(2 + dustScale.value),
    targetId: 7,
    velocity: { x: Math.fround((dustVelocity.value + 0.25) / 3), y: 0 },
  })

  const debrisDirectionRadians = directionHeading.value * Math.PI / 180
  const debrisDirection = {
    x: Math.fround(Math.sin(debrisDirectionRadians)),
    y: Math.fround(-Math.cos(debrisDirectionRadians)),
  }
  const bounceSeed = Math.fround(-(2 + bounce.value))
  const verticalVelocity = Math.fround(
    Math.fround(Math.fround(verticalFactor.value + 0.75) * bounceSeed)
      * Math.fround(0.5),
  )
  const actorScale = Math.fround(
    Math.min(Math.fround(0.75), Math.fround(0.5 + secondScale.value))
      * Math.fround(0.3 + scaleMultiplier.value),
  )
  const planarSpeed = Math.fround(1.5 + speed.value)
  const radialDistance = Math.fround(radius.value + offset.value)
  const debris = result.state.actors.find(({ kind }) => kind === 'earthquake-debris')!
  assert.deepEqual({
    alpha: debris.alpha,
    endpoint: debris.endpoint,
    enhanced: debris.enhanced,
    phase: debris.phase,
    position: debris.position,
    quantity: debris.quantity,
    rotationRadians: debris.rotationRadians,
    scale: debris.scale,
    variant: debris.variant,
    velocity: debris.velocity,
  }, {
    alpha: 10,
    endpoint: { x: verticalVelocity, y: Math.fround(1 + rotationStep.value) },
    enhanced: true,
    phase: Math.fround(-height.value),
    position: {
      x: Math.fround(debrisDirection.x * radialDistance),
      y: Math.fround(debrisDirection.y * radialDistance),
    },
    quantity: bounceSeed,
    rotationRadians: debrisRotation.value * Math.PI / 180,
    scale: actorScale,
    variant: record.value,
    velocity: {
      x: Math.fround(debrisDirection.x * planarSpeed),
      y: Math.fround(
        Math.fround(debrisDirection.y * Math.fround(0.8)) * planarSpeed,
      ),
    },
  })
})

test('Earthquake child actors retain their exact sine and three-tick bouncer lifecycles', () => {
  const castResult = cast(41)
  const quake = castResult.state.actors.find(({ kind }) => kind === 'earthquake')!
  const pulseSource = {
    ...castResult.state,
    actors: castResult.state.actors.map((actor) => actor.id === quake.id
      ? { ...actor, lifetimeTicks: 211 }
      : actor),
    rng: createNativeRng(1),
  }
  const pulseContext = context(41, 2, null)
  const pulse = stepNativeSecondaryAbilities(pulseSource, pulseContext).state
  const child = pulse.actors.find(({ kind }) => kind === 'earthquake-quake')!
  let childState: NativeSecondarySimulationState = {
    ...pulse,
    actors: [child],
    events: [],
    rng: createNativeRng(99),
    targetEffects: [],
  }
  let expectedRng = childState.rng
  let expectedScaleX = child.scale
  let expectedScaleY = child.slowFactor
  for (let tick = 0; tick < 90; tick += 1) {
    expectedScaleX = Math.fround(expectedScaleX + Math.fround(0.005))
    expectedScaleY = Math.fround(expectedScaleY + Math.fround(0.005))
    childState = stepNativeSecondaryAbilities(
      childState,
      context(41, 3 + tick, null),
    ).state
  }
  const edgeJump = drawNativeFloat(expectedRng, 0.75); expectedRng = edgeJump.state
  const edgeDelta = Math.fround(0.25 + edgeJump.value)
  expectedScaleX = Math.fround(expectedScaleX + edgeDelta)
  expectedScaleY = Math.fround(expectedScaleY + edgeDelta)
  const atHalfCycle = childState.actors.find(({ kind }) => kind === 'earthquake-quake')!
  assert.equal(atHalfCycle.phase, 180)
  assert.equal(atHalfCycle.alpha, Math.fround(child.alpha * Math.fround(0.95)))
  assert.equal(atHalfCycle.scale, expectedScaleX)
  assert.equal(atHalfCycle.slowFactor, expectedScaleY)
  assert.deepEqual(childState.rng, expectedRng)
  for (let tick = 0; tick < 90; tick += 1) {
    childState = stepNativeSecondaryAbilities(
      childState,
      context(41, 93 + tick, null),
    ).state
  }
  expectedRng = drawNativeFloat(expectedRng, 0.75).state
  assert.equal(childState.actors.some(({ kind }) => kind === 'earthquake-quake'), false)
  assert.deepEqual(childState.rng, expectedRng)

  const enhancedBase = context(41, 1, 0)
  const enhancedContext: NativeSecondaryTickContext = {
    ...enhancedBase,
    players: {
      player: { ...enhancedBase.players.player!, enhancedEffects: true },
    },
    sceneryTargets: () => [{ id: 7, position: { x: 50, y: 40 }, typeId: 2001 }],
  }
  const enhancedCast = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(77),
    enhancedContext,
  )
  const enhanced = stepNativeSecondaryAbilities(
    { ...enhancedCast.state, rng: createNativeRng(17) },
    {
      ...enhancedContext,
      players: {
        player: { ...enhancedContext.players.player!, input: input(null) },
      },
      tick: 2,
    },
  ).state
  const dust = enhanced.actors.find(({ kind }) => kind === 'earthquake-dust')!
  const debris = enhanced.actors.find(({ kind }) => kind === 'earthquake-debris')!
  const isolated = {
    ...enhanced,
    actors: [dust, debris],
    events: [],
    rng: createNativeRng(500),
    targetEffects: [],
  }
  const skipped = stepNativeSecondaryAbilities(isolated, context(41, 3, null)).state
  const skippedDust = skipped.actors.find(({ kind }) => kind === 'earthquake-dust')!
  const skippedDebris = skipped.actors.find(({ kind }) => kind === 'earthquake-debris')!
  assert.equal(skippedDust.phase, Math.fround(0.5))
  assert.equal(
    skippedDust.alpha,
    Math.fround(Math.sin(0.5 * Math.PI / 180) * dust.quantity),
  )
  assert.deepEqual(skippedDust.position, {
    x: Math.fround(dust.position.x + dust.velocity.x),
    y: dust.position.y,
  })
  assert.deepEqual(skippedDebris.position, debris.position)
  assert.equal(skippedDebris.phase, debris.phase)
  assert.equal(
    skippedDebris.alpha,
    Math.fround(debris.alpha - Math.fround(0.025)),
  )
  assert.deepEqual(skipped.rng, isolated.rng)

  const moved = stepNativeSecondaryAbilities(skipped, context(41, 4, null)).state
  const movedDebris = moved.actors.find(({ kind }) => kind === 'earthquake-debris')!
  assert.deepEqual(movedDebris.position, {
    x: Math.fround(debris.position.x + debris.velocity.x),
    y: Math.fround(debris.position.y + debris.velocity.y),
  })
  assert.equal(
    movedDebris.phase,
    Math.fround(debris.phase + debris.endpoint.x),
  )
  assert.equal(
    movedDebris.endpoint.x,
    Math.fround(debris.endpoint.x + Math.fround(0.4)),
  )
  assert.equal(
    movedDebris.alpha,
    Math.fround(
      Math.fround(skippedDebris.alpha - Math.fround(0.015))
        - Math.fround(0.025),
    ),
  )
})

test('Raise Golem ignores aim and orders signed facing, placement, then constructor RNG', () => {
  const sourceRng = createNativeRng(123)
  const placementSign = drawNativeSign(sourceRng, 45)
  const base = context(45, 1, 0)
  const character = base.players.player!.character
  const placementHeading = Math.fround(
    character.headingIndex * 15 + placementSign.value,
  )
  const radians = placementHeading * Math.PI / 180
  const requested = {
    x: Math.fround(character.position.x + Math.fround(
      Math.fround(Math.sin(radians)) * 100,
    )),
    y: Math.fround(character.position.y + Math.fround(
      -Math.fround(Math.cos(radians)) * 100,
    )),
  }
  const placementPhase = drawNativeFloat(placementSign.state, 360)
  const pose = drawNativeInteger(placementPhase.state, 2)
  let capturedRequested: { x: number; y: number } | null = null
  let capturedRng: NativeRngState | null = null
  const result = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    {
      ...base,
      golemPlacement: (_playerId, _worldKey, position, rng) => {
        capturedRequested = position
        capturedRng = rng
        return { position: { x: 12, y: 34 }, rng: placementPhase.state }
      },
      players: {
        player: {
          ...base.players.player!,
          input: input(0, { x: 9_000, y: -9_000 }),
        },
      },
    },
  )
  const golem = result.state.actors.find(({ kind }) => kind === 'golem')!

  assert.deepEqual(capturedRequested, requested)
  assert.deepEqual(capturedRng, placementSign.state)
  assert.deepEqual(golem.position, { x: 12, y: 34 })
  assert.equal(golem.golem?.poseVariant, pose.value)
  const fullRotation = Math.PI * 2
  assert.equal(
    golem.rotationRadians,
    ((((placementHeading + 180) * Math.PI / 180) % fullRotation)
      + fullRotation) % fullRotation,
  )
  assert.deepEqual(result.facingHeadingIndexes, {
    player: ((placementHeading / 15) % 24 + 24) % 24,
  })
  assert.deepEqual(result.state.rng, pose.state)
})

test('Fete of Clay, not Iron Golem, owns the two-summon cap', () => {
  const castTwice = (maximumGolem: boolean) => {
    let state = createNativeSecondarySimulation(77)
    for (const [tick, slot] of [[1, 0], [2, null], [3, 0]] as const) {
      const tickContext = context(45, tick, slot)
      state = stepNativeSecondaryAbilities(state, {
        ...tickContext,
        players: {
          player: {
            ...tickContext.players.player!,
            golemIron: true,
            maximumGolem,
          },
        },
      }).state
      if (tick === 2) state = finishCommonCastGate(state)
    }
    return state
  }
  assert.equal(castTwice(false).actors.filter(({ kind }) => kind === 'golem').length, 1)
  const maximumState = castTwice(true)
  const maximum = maximumState.actors.filter(({ kind }) => kind === 'golem')
  assert.equal(maximum.length, 2)
  assert.ok(maximum.every(({ golem }) => golem?.iron === true))

  const lowId = maximum[0]!.id
  const highId = maximum[1]!.id
  let evictionState: NativeSecondarySimulationState = {
    ...maximumState,
    actors: maximumState.actors.map((actor) => actor.id === lowId
      ? { ...actor, golem: { ...actor.golem!, currentHealth: 1 } }
      : actor),
  }
  for (const [tick, slot] of [[4, null], [5, 0]] as const) {
    if (tick === 5) evictionState = finishCommonCastGate(evictionState)
    const tickContext = context(45, tick, slot)
    evictionState = stepNativeSecondaryAbilities(evictionState, {
      ...tickContext,
      players: {
        player: {
          ...tickContext.players.player!,
          golemIron: true,
          maximumGolem: true,
        },
      },
    }).state
  }
  assert.equal(evictionState.actors.some(({ id }) => id === lowId), false)
  assert.equal(evictionState.actors.some(({ id }) => id === highId), true)
})

test('Golem terminal damage owns the exact four-cue death sequence', () => {
  let state = cast(45).state
  for (let tick = 2; tick <= 401; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(45, tick, null)).state
  }
  const golem = state.actors.find(({ kind }) => kind === 'golem')!
  const result = applyNativeSecondaryGolemDamage(state, golem.id, {
    primaryDamage: 10_000,
    reflectablePhysicalSourceInRange: false,
    secondaryDamage: 0,
  }, 2)
  assert.equal(result.killed, true)
  assert.equal(result.state.actors.some(({ id }) => id === golem.id), false)
  assert.equal(result.state.actors.some(({ kind }) => kind === 'golem-death'), true)
  assert.deepEqual(
    result.state.events.flatMap(({ cue }) => cue === null ? [] : [cue]).slice(-4),
    ['stone-break', 'flame-lash-start', 'golem-die', 'rock-hit'],
  )
})

test('Golem assembly layers its crack stream with the native rise and impact point sounds', () => {
  let state = cast(45).state
  for (let tick = 2; tick <= 103; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(45, tick, null)).state
  }
  const assembly = state.events
    .filter(({ cue }) => cue === 'quake-crack-small'
      || cue === 'flame-lash-start'
      || cue === 'rock-hit')
    .map(({ cue, pitch, tick }) => ({ cue, pitch, tick }))
  assert.deepEqual(assembly, [
    { cue: 'quake-crack-small', pitch: 1, tick: 2 },
    { cue: 'flame-lash-start', pitch: 0.8, tick: 2 },
    { cue: 'quake-crack-small', pitch: 1, tick: 27 },
    { cue: 'rock-hit', pitch: 1, tick: 27 },
    { cue: 'quake-crack-small', pitch: 1, tick: 52 },
    { cue: 'rock-hit', pitch: 1, tick: 52 },
    { cue: 'quake-crack-small', pitch: 1, tick: 102 },
    { cue: 'rock-hit', pitch: 1, tick: 102 },
  ])
  assert.equal(state.events.some(({ cue, tick }) => (
    tick === 103 && (cue === 'quake-crack-small' || cue === 'rock-hit')
  )), false)
})

test('Firewalker emits immediately, then while stationary, preserving its seven-word births and global geometry cycle', () => {
  const initial = createNativeSecondarySimulation(123)
  const activationContext = context(23, 1, 0)
  const activationAuthority = activationContext.players.player!
  let rng = initial.rng
  const activationPhase = drawNativeFloat(rng, 32); rng = activationPhase.state
  const activationMirror = drawNativeSign(rng, 1); rng = activationMirror.state
  const activationPerpendicular = drawNativeFloat(rng, 10, true); rng = activationPerpendicular.state
  const activationForward = drawNativeFloat(rng, 8); rng = activationForward.state
  const activationScale = drawNativeFloat(rng, 0.5); rng = activationScale.state
  const activationLife = drawNativeFloat(rng, 0.25); rng = activationLife.state
  const activationDuration = effectiveSecondaryAbilityRankStats(
    activationAuthority.skillBook,
    23,
  ).values.mDuration ?? 2
  const activationRemainingLife = Math.fround(
    activationDuration * Math.fround(1.1 - activationLife.value),
  )

  let state = stepNativeSecondaryAbilities(initial, activationContext).state
  const activationPatch = state.actors.find(({ kind }) => kind === 'fire-patch')!
  assert.deepEqual({
    enhanced: activationPatch.enhanced,
    lifetimeTicks: activationPatch.lifetimeTicks,
    phase: activationPatch.phase,
    position: activationPatch.position,
    quantity: activationPatch.quantity,
    scale: activationPatch.scale,
    slowFactor: activationPatch.slowFactor,
  }, {
    enhanced: true,
    lifetimeTicks: fireLifetimeTicks(activationRemainingLife),
    phase: activationPhase.value,
    position: {
      x: activationAuthority.character.position.x
        + activationAuthority.character.velocity.y * 0.01 * activationPerpendicular.value
        + activationAuthority.character.velocity.x * 0.01 * activationForward.value,
      y: activationAuthority.character.position.y
        - activationAuthority.character.velocity.x * 0.01 * activationPerpendicular.value
        + activationAuthority.character.velocity.y * 0.01 * activationForward.value,
    },
    quantity: activationMirror.value,
    scale: 1 - activationScale.value,
    slowFactor: activationRemainingLife,
  })
  assert.deepEqual(state.rng, rng)
  assert.equal(state.firewalkerGeometrySequence, 0)

  const base = context(23, 10, null)
  const authority = base.players.player!
  const velocity = { x: 100, y: 50 }
  const movingAuthority = {
    ...authority,
    character: { ...authority.character, velocity },
  }
  rng = state.rng
  const phase = drawNativeFloat(rng, 32); rng = phase.state
  const mirror = drawNativeSign(rng, 1); rng = mirror.state
  const perpendicular = drawNativeFloat(rng, 10, true); rng = perpendicular.state
  const forward = drawNativeFloat(rng, 8); rng = forward.state
  const scale = drawNativeFloat(rng, 0.5); rng = scale.state
  const life = drawNativeFloat(rng, 0.25); rng = life.state
  const duration = effectiveSecondaryAbilityRankStats(authority.skillBook, 23)
    .values.mDuration ?? 2
  const remainingLife = Math.fround(duration * Math.fround(1.1 - life.value))

  state = stepNativeSecondaryAbilities(state, {
    ...base,
    players: { player: movingAuthority },
  }).state
  const first = state.actors.find(({ id }) => id !== activationPatch.id)!
  assert.deepEqual({
    enhanced: first.enhanced,
    lifetimeTicks: first.lifetimeTicks,
    phase: first.phase,
    position: first.position,
    quantity: first.quantity,
    scale: first.scale,
    slowFactor: first.slowFactor,
  }, {
    enhanced: true,
    lifetimeTicks: fireLifetimeTicks(remainingLife),
    phase: phase.value,
    position: {
      x: velocity.y * 0.01 * perpendicular.value
        + velocity.x * 0.01 * forward.value,
      y: -velocity.x * 0.01 * perpendicular.value
        + velocity.y * 0.01 * forward.value,
    },
    quantity: mirror.value,
    scale: 1 - scale.value,
    slowFactor: remainingLife,
  })
  assert.deepEqual(state.rng, rng)
  assert.equal(state.firewalkerGeometrySequence, 1)

  for (const tick of [20, 30, 40]) {
    const stationary = context(23, tick, null)
    state = stepNativeSecondaryAbilities(state, stationary).state
  }
  const patches = state.actors.filter(({ kind }) => kind === 'fire-patch')
  assert.equal(patches.length, 5)
  assert.deepEqual(
    patches.map(({ enhanced }) => enhanced),
    [true, true, false, false, true],
  )
  assert.deepEqual(patches[2]?.position, { x: 0, y: 0 })
  assert.equal(state.firewalkerGeometrySequence, 1)
})

test('Fire contact uses the global third-tick lane, strict center radius, one response draw, and one Burn modifier', () => {
  const castState = cast(73).state
  const patch = castState.actors.find(({ kind }) => kind === 'fire-patch')!
  assert.equal(patch.enhanced, true)
  const contactRadius = Math.fround(32 * patch.scale)
  const outside = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 401,
    position: { x: patch.position.x + contactRadius, y: patch.position.y },
    radius: 100,
    scale: 1.5,
    shieldHealth: 0,
  }
  const outsideContext = context(73, 3, null)
  const isolated = { ...castState, actors: [patch] }
  const rejected = stepNativeSecondaryAbilities(isolated, {
    ...outsideContext,
    target: (_worldKey, targetId) => targetId === outside.id ? outside : null,
    targets: () => [outside],
  })
  assert.deepEqual(rejected.damage, [])
  assert.equal(rejected.state.actors.some(({ kind }) => kind === 'fire-burn'), false)
  assert.deepEqual(rejected.state.rng, isolated.rng)

  const inside = {
    ...outside,
    id: 402,
    position: { x: patch.position.x + contactRadius - 0.001, y: patch.position.y },
  }
  const response = drawNativeFloat(isolated.rng, 0.5)
  const accepted = stepNativeSecondaryAbilities(isolated, {
    ...outsideContext,
    target: (_worldKey, targetId) => targetId === inside.id ? inside : null,
    targets: () => [inside],
  })
  const lane = Math.fround(
    Math.fround(Math.fround(patch.damage / 100) * 3) * Math.fround(0.5),
  )
  assert.deepEqual(accepted.damage, [{
    amount: lane + lane,
    kind: 'fire',
    ownerId: 'player',
    sourceActorId: patch.id,
    targetId: inside.id,
  }])
  assert.deepEqual(accepted.state.rng, response.state)
  const burn = accepted.state.actors.filter(({ kind }) => kind === 'fire-burn')
  assert.equal(burn.length, 1)
  assert.deepEqual({
    ageTicks: burn[0]?.ageTicks,
    damage: burn[0]?.damage,
    lifetimeTicks: burn[0]?.lifetimeTicks,
    position: burn[0]?.position,
    scale: burn[0]?.scale,
    targetId: burn[0]?.targetId,
  }, {
    ageTicks: 0,
    damage: Math.fround(2 / 200),
    lifetimeTicks: 200,
    position: inside.position,
    scale: inside.scale,
    targetId: inside.id,
  })

  const disabled = { ...isolated, actors: [{ ...patch, enhanced: false }] }
  const presentationOnly = stepNativeSecondaryAbilities(disabled, {
    ...outsideContext,
    target: (_worldKey, targetId) => targetId === inside.id ? inside : null,
    targets: () => [inside],
  })
  assert.deepEqual(presentationOnly.damage, [])
  assert.deepEqual(presentationOnly.state.rng, disabled.rng)
  assert.equal(
    presentationOnly.state.actors.some(({ kind }) => kind === 'fire-burn'),
    false,
  )
})

test('Burn owns two RNG words per tick, target-scaled flame and light, max merge, terminal fade, and 200 damage ticks', () => {
  const castState = cast(73).state
  const patch = castState.actors.find(({ kind }) => kind === 'fire-patch')!
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 403,
    position: { x: patch.position.x, y: patch.position.y },
    radius: 10,
    scale: 1.75,
    shieldHealth: 0,
  }
  const contactContext = context(73, 3, null)
  const contacted = stepNativeSecondaryAbilities(
    { ...castState, actors: [patch] },
    {
      ...contactContext,
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [target],
    },
  ).state
  const born = contacted.actors.find(({ kind }) => kind === 'fire-burn')!
  const burnOnly = { ...contacted, actors: [born] }
  const tickContext = context(73, 4, null)
  const scaleDraw = drawNativeFloat(burnOnly.rng, 0.25)
  const lightDraw = drawNativeFloat(scaleDraw.state, 0.1)
  const first = stepNativeSecondaryAbilities(burnOnly, {
    ...tickContext,
    target: (_worldKey, targetId) => targetId === target.id ? target : null,
  })
  assert.deepEqual(first.state.rng, lightDraw.state)
  assert.deepEqual(first.damage, [{
    amount: Math.fround(2 / 200),
    kind: 'fire',
    ownerId: 'player',
    sourceActorId: born.id,
    targetId: target.id,
  }])
  const activeBurn = first.state.actors.find(({ kind }) => kind === 'fire-burn')!
  assert.deepEqual({
    ageTicks: activeBurn.ageTicks,
    alpha: activeBurn.alpha,
    lightRegistration: activeBurn.lightRegistration,
    miscLightAppendOrdinal: activeBurn.miscLightAppendOrdinal,
    position: activeBurn.position,
    radius: activeBurn.radius,
    scale: activeBurn.scale,
  }, {
    ageTicks: 1,
    alpha: 1,
    lightRegistration: TARGET_LIGHT_REGISTRATION,
    miscLightAppendOrdinal: 0,
    position: target.position,
    radius: Math.fround(0.1 + lightDraw.value),
    scale: target.scale,
  })
  const flame = first.state.actors.find(({ kind }) => kind === 'fire-burn-flame')!
  assert.deepEqual({
    alpha: flame.alpha,
    frame: flame.frame,
    position: flame.position,
    scale: flame.scale,
    skillId: flame.skillId,
  }, {
    alpha: Math.fround(0.125),
    frame: 334,
    position: { x: target.position.x, y: Math.fround(target.position.y - 15) },
    scale: Math.fround((1 + scaleDraw.value) * target.scale),
    skillId: 73,
  })

  const strongerContext = context(73, 6, null)
  const strongerAuthority = {
    ...strongerContext.players.player!,
    fireBurnDamage: 4,
  }
  const refreshed = stepNativeSecondaryAbilities(
    { ...first.state, actors: [activeBurn, patch] },
    {
      ...strongerContext,
      players: { player: strongerAuthority },
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [target],
    },
  ).state
  const merged = refreshed.actors.filter(({ kind }) => kind === 'fire-burn')
  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.ageTicks, 0)
  assert.equal(merged[0]?.damage, Math.fround(4 / 200))

  let state: NativeSecondarySimulationState = { ...contacted, actors: [born] }
  let burnDamage = 0
  let fadeAt49TicksRemaining: number | null = null
  for (let index = 1; index <= 200; index += 1) {
    const base = context(73, 3 + index, null)
    const result = stepNativeSecondaryAbilities(state, {
      ...base,
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
    })
    burnDamage += result.damage.reduce((sum, contact) => sum + contact.amount, 0)
    state = result.state
    if (index === 152) {
      fadeAt49TicksRemaining = state.actors.find(({ kind }) => kind === 'fire-burn')?.alpha ?? null
    }
  }
  assert.equal(fadeAt49TicksRemaining, Math.fround(49 / 50))
  assert.equal(state.actors.some(({ kind }) => kind === 'fire-burn'), false)
  assert.ok(Math.abs(burnDamage - Math.fround(2 / 200) * 200) < 1e-12)
})

test('EtherBurn owns three RNG words, records 246 through 250, target MiscLight, and no periodic damage', () => {
  const target = {
    family: 'ZOMBIE',
    id: 414,
    lightRegistration: TARGET_LIGHT_REGISTRATION,
    position: { x: 40, y: 60 },
    radius: 10,
    scale: 1.5,
    shieldHealth: 0,
  }
  let state = applyNativeSecondaryEtherBurn(createNativeSecondarySimulation(14), {
    ownerId: 'player',
    rank: 2,
    target,
    worldKey: 'boneyard:test',
  })
  const born = state.actors.find(({ kind }) => kind === 'ether-burn')!
  assert.equal(born.lifetimeTicks, NATIVE_ETHER_BURN_LIFETIME_TICKS)
  const scaleDraw = drawNativeFloat(state.rng, Math.fround(0.25), true)
  const lightDraw = drawNativeFloat(scaleDraw.state, Math.fround(0.1))
  const tickContext = context(11, 6, null)
  const first = stepNativeSecondaryAbilities(state, {
    ...tickContext,
    target: (_worldKey, targetId) => targetId === target.id ? target : null,
  })
  assert.deepEqual(first.damage, [])
  assert.deepEqual(first.state.rng, lightDraw.state)
  const active = first.state.actors.find(({ kind }) => kind === 'ether-burn')!
  assert.deepEqual({
    ageTicks: active.ageTicks,
    alpha: active.alpha,
    lightRegistration: active.lightRegistration,
    miscLightAppendOrdinal: active.miscLightAppendOrdinal,
    position: active.position,
    radius: active.radius,
  }, {
    ageTicks: 1,
    alpha: 1,
    lightRegistration: TARGET_LIGHT_REGISTRATION,
    miscLightAppendOrdinal: 0,
    position: target.position,
    radius: Math.fround(0.1 + lightDraw.value),
  })
  const flare = first.state.actors.find(({ kind }) => kind === 'ether-burn-flare')!
  assert.deepEqual({
    alpha: flare.alpha,
    frame: flare.frame,
    position: flare.position,
    scale: flare.scale,
    skillId: flare.skillId,
  }, {
    alpha: Math.fround(0.125),
    frame: 247,
    position: { x: target.position.x, y: Math.fround(target.position.y - 15) },
    scale: Math.fround((1 + scaleDraw.value) * target.scale),
    skillId: 14,
  })

  state = applyNativeSecondaryEtherBurn({
    ...first.state,
    actors: [{ ...active, ageTicks: 200 }],
  }, {
    ownerId: 'player',
    rank: 3,
    target,
    worldKey: 'boneyard:test',
  })
  assert.equal(state.actors.filter(({ kind }) => kind === 'ether-burn').length, 1)
  assert.equal(state.actors[0]!.ageTicks, 0)
  assert.equal(state.actors[0]!.rank, 3)

  const fading = {
    ...state,
    actors: [{ ...state.actors[0]!, ageTicks: 251 }],
  }
  const fadeContext = context(11, 7, null)
  const faded = stepNativeSecondaryAbilities(fading, {
    ...fadeContext,
    target: (_worldKey, targetId) => targetId === target.id ? target : null,
  }).state.actors.find(({ kind }) => kind === 'ether-burn')!
  assert.equal(faded.alpha, Math.fround(49 / 50))
})

test('toggle reserves stack, release immediately, and overload clears the full set', () => {
  let state = createNativeSecondarySimulation(2)
  state = stepNativeSecondaryAbilities(state, context(23, 1, 0)).state
  assert.equal(state.players.player?.firewalker, true)
  assert.equal(state.players.player?.reservedMana, 50)
  assert.equal(nativeSecondaryAvailableMana(100, state.players.player!), 50)

  state = stepNativeSecondaryAbilities(state, context(23, 2, null)).state
  state = stepNativeSecondaryAbilities(finishCommonCastGate(state), context(23, 3, 0)).state
  assert.equal(state.players.player?.firewalker, false)
  assert.equal(state.players.player?.reservedMana, 0)

  state = stepNativeSecondaryAbilities(state, context(78, 4, null)).state
  state = stepNativeSecondaryAbilities(state, context(78, 5, 0)).state
  assert.equal(state.players.player?.mindstar, true)
  assert.equal(state.players.player?.reservedMana, 60)
  state = stepNativeSecondaryAbilities(state, context(79, 6, null, 100, [78])).state
  state = stepNativeSecondaryAbilities(state, context(79, 7, 0, 100, [78])).state
  assert.equal(state.players.player?.reservedMana, 85)
  state = stepNativeSecondaryAbilities(state, context(23, 8, null, 100, [78, 79])).state
  const overloaded = stepNativeSecondaryAbilities(state, context(23, 9, 0, 100, [78, 79]))
  state = overloaded.state
  assert.equal(state.players.player?.mindstar, false)
  assert.equal(state.players.player?.regenerate, false)
  assert.equal(state.players.player?.firewalker, false)
  assert.equal(state.players.player?.reservedMana, 0)
  assert.deepEqual(overloaded.overloadedPlayerIds, ['player'])
  assert.ok(state.events.some(({ kind }) => kind === 'overload'))
})

test('Firewalker toggle-off keeps the Region write but owns no ignite request', () => {
  let state = cast(23).state
  assert.deepEqual(
    state.events.filter(({ tick }) => tick === 1).map(({ cue, kind }) => ({ cue, kind })),
    [{ cue: 'ignite', kind: 'toggle-on' }],
  )
  state = stepNativeSecondaryAbilities(state, context(23, 2, null)).state
  state = stepNativeSecondaryAbilities(finishCommonCastGate(state), context(23, 3, 0)).state
  const off = state.events.filter(({ tick }) => tick === 3)
  assert.deepEqual(off.map(({ cue, kind }) => ({ cue, kind })), [
    { cue: null, kind: 'toggle-off' },
  ])
  assert.deepEqual(off[0]?.screenFlash, expectedScreenFlash(1, 0.5, 0, 0.1, true))
  assert.equal(state.actors.some(({ kind }) => kind === 'fire-patch'), true)
})

test('Stoneskin requests apply, refresh, and exactly one natural-removal callback', () => {
  let state = cast(46).state
  assert.deepEqual(
    state.events.filter(({ tick }) => tick === 1).map(({ cue }) => cue),
    ['stoneskin-on', 'stoneskin', null],
  )
  assert.equal(state.players.player?.stoneskinTicksRemaining, 600)

  state = stepNativeSecondaryAbilities(state, context(46, 2, null)).state
  state = stepNativeSecondaryAbilities(finishCommonCastGate(state), context(46, 3, 0)).state
  assert.deepEqual(
    state.events.filter(({ tick }) => tick === 3).map(({ cue }) => cue),
    ['stoneskin-on', 'stoneskin', null],
  )
  assert.equal(state.players.player?.stoneskinTicksRemaining, 600)

  for (let tick = 4; tick <= 602; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(46, tick, null)).state
  }
  assert.equal(state.players.player?.stoneskinTicksRemaining, 1)
  state = stepNativeSecondaryAbilities(state, context(46, 603, null)).state
  assert.equal(state.players.player?.stoneskinTicksRemaining, 0)
  assert.deepEqual(
    state.events.filter(({ tick }) => tick === 603).map(({ cue, kind }) => ({ cue, kind })),
    [{ cue: 'stoneskin', kind: 'pulse' }],
  )
  state = stepNativeSecondaryAbilities(state, context(46, 604, null)).state
  assert.equal(state.events.filter(({ cue, tick }) => cue === 'stoneskin' && tick >= 603).length, 1)
})

test('Stoneskin and Magic Shield intercept damage at the authoritative player boundary', () => {
  const stoneskin = cast(46).state
  const blocked = applyNativeSecondaryPlayerDamage(
    stoneskin, 'player', 500, 2, { x: 0, y: 0 }, 'boneyard:test',
  )
  assert.equal(blocked.healthDamage, 0)
  assert.equal(blocked.absorbedDamage, 500)

  const shield = cast(54).state
  const hit = applyNativeSecondaryPlayerDamage(
    shield, 'player', 10, 2, { x: 0, y: 0 }, 'boneyard:test',
  )
  assert.equal(hit.healthDamage, 0)
  assert.equal(hit.state.players.player?.magicShieldAbsorb, 15)
  assert.equal(hit.state.players.player?.magicShieldPulseTicks, 40)
  const broken = applyNativeSecondaryPlayerDamage(
    hit.state, 'player', 20, 3, { x: 0, y: 0 }, 'boneyard:test',
  )
  assert.equal(broken.state.players.player?.magicShieldAbsorb, 0)
  assert.equal(broken.state.actors.filter(({ kind }) => kind === 'shield-break').length, 20)
  assert.equal(broken.state.events.at(-1)?.cue, 'pop-shield')

  const explosiveContext = context(54, 1, 0)
  const explosiveShield = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(123),
    {
      ...explosiveContext,
      players: {
        player: {
          ...explosiveContext.players.player!,
          explosiveShieldDamage: 12,
        },
      },
    },
  ).state
  const explosiveBreak = applyNativeSecondaryPlayerDamage(
    explosiveShield, 'player', 30, 2, { x: 4, y: 5 }, 'boneyard:test',
  ).state
  const breakActors = explosiveBreak.actors.filter(({ kind }) => kind === 'shield-break')
  assert.equal(breakActors.length, 20)
  const firstBreakRotation = drawNativeFloat(advanceNativeRngWords(createNativeRng(123), 1), 360)
  const firstBreakAlpha = drawNativeFloat(firstBreakRotation.state, 0.75)
  const firstBreakScale = drawNativeFloat(firstBreakAlpha.state, 0.25)
  assert.deepEqual({
    alpha: breakActors[0]!.alpha,
    lifetimeTicks: breakActors[0]!.lifetimeTicks,
    position: breakActors[0]!.position,
    rotationRadians: breakActors[0]!.rotationRadians,
    scale: breakActors[0]!.scale,
  }, {
    alpha: Math.fround(0.5 + firstBreakAlpha.value),
    lifetimeTicks: 26,
    position: { x: 4, y: -30 },
    rotationRadians: firstBreakRotation.value * Math.PI / 180,
    scale: Math.fround(2 + firstBreakScale.value),
  })
  const explosion = explosiveBreak.actors.find(({ kind }) => kind === 'shield-explosion')!
  assert.deepEqual({
    damage: explosion.damage,
    lifetimeTicks: explosion.lifetimeTicks,
    position: explosion.position,
    presentationRng: explosion.presentationRng,
    radius: explosion.radius,
  }, {
    damage: 12,
    lifetimeTicks: 116,
    position: { x: 4, y: 5 },
    presentationRng: advanceNativeRngWords(createNativeRng(123), 61),
    radius: 110,
  })
  const shieldWave = explosiveBreak.actors.find(({ kind, skillId }) => (
    kind === 'shockwave' && skillId === 54
  ))!
  assert.deepEqual({
    damage: shieldWave.damage,
    lifetimeTicks: shieldWave.lifetimeTicks,
    phase: shieldWave.phase,
    radius: shieldWave.radius,
    slowFactor: shieldWave.slowFactor,
    variant: shieldWave.variant,
  }, {
    damage: 0,
    lifetimeTicks: 36,
    phase: Math.fround(0.35),
    radius: 75,
    slowFactor: Math.fround(0.0375),
    variant: 1,
  })
  assert.deepEqual(explosiveBreak.rng, advanceNativeRngWords(createNativeRng(123), 563))

  const contactRadii: number[] = []
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 92,
    position: { x: 114, y: 5 },
    radius: 1,
    scale: 1,
    shieldHealth: 0,
  }
  const stepContext = context(54, 3, null)
  const exploded = stepNativeSecondaryAbilities(explosiveBreak, {
    ...stepContext,
    targets: (_worldKey, _center, radius) => {
      contactRadii.push(radius)
      return radius === 110 ? [target] : []
    },
  })
  assert.deepEqual(contactRadii, [110])
  assert.deepEqual(exploded.damage, [{
    amount: 12,
    kind: 'magic',
    ownerId: 'player',
    sourceActorId: explosion.id,
    targetId: target.id,
  }])
  assert.deepEqual(screenFlashes(explosiveBreak), [
    expectedScreenFlash(0.5, 1, 1, 0.1, true),
    expectedScreenFlash(0.5, 1, 1, 0.05, true),
  ])
  assert.equal(
    explosiveBreak.events.find(({ cue }) => cue === 'magic-shield-explode')?.cameraMagnitude,
    1.25,
  )
})

test('Ether Drain and Leviathan preserve their recovered phase boundaries', () => {
  let drain = cast(74).state
  for (let tick = 2; tick <= 41; tick += 1) {
    drain = stepNativeSecondaryAbilities(drain, context(74, tick, null)).state
  }
  assert.equal(drain.actors.find(({ kind }) => kind === 'ether-drain')?.phase, 0)
  assert.equal(
    drain.actors.find(({ kind }) => kind === 'ether-drain')?.scale,
    0.9999995827674866,
  )
  drain = stepNativeSecondaryAbilities(drain, context(74, 42, null)).state
  assert.equal(drain.actors.find(({ kind }) => kind === 'ether-drain')?.phase, 1)
  assert.equal(drain.actors.find(({ kind }) => kind === 'ether-drain')?.scale, 1)
  for (let tick = 43; tick <= 1_042; tick += 1) {
    drain = stepNativeSecondaryAbilities(drain, context(74, tick, null)).state
  }
  assert.equal(drain.actors.find(({ kind }) => kind === 'ether-drain')?.phase, 2)
  for (let tick = 1_043; tick <= 1_062; tick += 1) {
    drain = stepNativeSecondaryAbilities(drain, context(74, tick, null)).state
  }
  assert.equal(drain.actors.some(({ kind }) => kind === 'ether-drain'), false)

  const leviathan = cast(11).state.actors.find(({ kind }) => kind === 'leviathan')!
  assert.equal(leviathan.lifetimeTicks, 1_664)
  assert.equal(leviathan.quantity, 1)
})

test('Call Leviathan selects inclusive quantity while the full outfit skips the selector and doubles damage', () => {
  const source = createNativeSecondarySimulation(123)
  const ordinaryContext = context(11, 1, 0, 100, [], 5)
  const ordinary = stepNativeSecondaryAbilities(source, ordinaryContext).state
  const ordinaryParent = ordinary.actors.find(({ kind }) => kind === 'leviathan')!
  const ordinaryAppendages = ordinary.actors.filter(({ kind }) => kind === 'leviathan-appendage')
  const configured = effectiveSecondaryAbilityRankStats(
    ordinaryContext.players.player!.skillBook,
    11,
  )
  assert.equal(ordinaryParent.quantity, 5)
  assert.equal(ordinaryAppendages.length, ordinaryParent.quantity)
  assert.equal(ordinaryParent.damage, configured.values.mDamage)
  assert.ok(ordinaryAppendages.every(({ damage }) => damage === configured.values.mDamage))
  assert.deepEqual(
    ordinary.rng,
    advanceNativeRngWords(source.rng, 2 + 5 * ordinaryParent.quantity),
  )

  const maximumContext = {
    ...ordinaryContext,
    players: {
      player: {
        ...ordinaryContext.players.player!,
        maximumLeviathan: true,
      },
    },
  }
  const maximum = stepNativeSecondaryAbilities(source, maximumContext).state
  const maximumParent = maximum.actors.find(({ kind }) => kind === 'leviathan')!
  const maximumAppendages = maximum.actors.filter(({ kind }) => kind === 'leviathan-appendage')
  assert.equal(maximumParent.quantity, 5)
  assert.equal(maximumAppendages.length, 5)
  assert.equal(maximumParent.damage, configured.values.mDamage * 2)
  assert.ok(maximumAppendages.every(({ damage }) => damage === configured.values.mDamage * 2))
  assert.deepEqual(maximum.rng, advanceNativeRngWords(source.rng, 1 + 5 * 5))
})

test('Leviathan owns the exact 1664-update overlapping scale and enhanced five-word child edge', () => {
  const castContext = context(11, 1, 0)
  const enhancedContext = {
    ...castContext,
    players: {
      player: {
        ...castContext.players.player!,
        enhancedEffects: true,
      },
    },
  }
  let enhanced = stepNativeSecondaryAbilities(
    createNativeSecondarySimulation(321),
    enhancedContext,
  ).state
  const beforeMote = enhanced.rng
  enhanced = stepNativeSecondaryAbilities(
    enhanced,
    { ...enhancedContext, tick: 2, players: {
      player: { ...enhancedContext.players.player!, input: input(null) },
    } },
  ).state
  assert.deepEqual(enhanced.rng, advanceNativeRngWords(beforeMote, 5))
  const mote = enhanced.actors.find(({ kind }) => kind === 'leviathan-mote')!
  assert.ok(mote)
  assert.equal(mote.variant, 11)
  assert.equal(mote.quantity, 0.5)
  assert.ok(mote.alpha > 0 && mote.alpha < 0.8)

  let state = cast(11).state
  const stepToAge = (age: number): void => {
    while ((state.actors.find(({ kind }) => kind === 'leviathan')?.ageTicks ?? age) < age) {
      const tick = (state.actors.find(({ kind }) => kind === 'leviathan')?.ageTicks ?? 0) + 2
      state = stepNativeSecondaryAbilities(state, context(11, tick, null)).state
    }
  }
  stepToAge(40)
  let parent = state.actors.find(({ kind }) => kind === 'leviathan')!
  assert.equal(parent.phase, 0)
  assert.equal(parent.scale, Math.fround(parent.slowFactor * nativeLeviathanCurrentScale(40)))
  stepToAge(41)
  parent = state.actors.find(({ kind }) => kind === 'leviathan')!
  assert.equal(parent.phase, 1)
  assert.equal(parent.scale, parent.slowFactor)
  stepToAge(1_640)
  parent = state.actors.find(({ kind }) => kind === 'leviathan')!
  assert.equal(parent.phase, 2)
  assert.equal(parent.scale, Math.fround(parent.slowFactor * nativeLeviathanCurrentScale(1_640)))
  stepToAge(1_663)
  assert.equal(state.actors.some(({ kind }) => kind === 'leviathan'), true)
  state = stepNativeSecondaryAbilities(state, context(11, 1_665, null)).state
  assert.equal(state.actors.some(({ kind }) => (
    kind === 'leviathan' || kind === 'leviathan-appendage'
  )), false)
})

test('Leviathan deploys on active update 59, respects visibility, acquires one tick before firing, and toggles its bank', () => {
  let state = cast(11).state
  for (let age = 1; age <= 98; age += 1) {
    state = stepNativeSecondaryAbilities(state, context(11, age + 1, null)).state
  }
  let appendage = state.actors.find(({ kind }) => kind === 'leviathan-appendage')!
  assert.ok(appendage.slowFactor >= Math.fround(0.05000000074505806))
  assert.equal(appendage.targetId, null)

  const parent = state.actors.find(({ kind }) => kind === 'leviathan')!
  const wander = drawNativeFloat(state.rng, 5.800000190734863)
  let nextHeading = Math.fround(
    appendage.rotationRadians * 180 / Math.PI
      + Math.fround(0.20000000298023224)
      + wander.value,
  )
  if (nextHeading > 360) nextHeading = Math.fround(nextHeading - 360)
  const direction = nativeLeviathanHeadingVector(nextHeading)
  const queryOrigin = {
    x: parent.position.x + appendage.endpoint.x,
    y: parent.position.y + appendage.endpoint.y,
  }
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 500,
    position: {
      x: queryOrigin.x + direction.x * 100,
      y: queryOrigin.y + direction.y * 100,
    },
    radius: 10,
    scale: 1,
    shieldHealth: 0,
  }
  const targetContext = (tick: number, blocked: boolean): NativeSecondaryTickContext => ({
    ...context(11, tick, null),
    lineObstruction: () => blocked,
    target: (_worldKey, targetId) => targetId === target.id ? target : null,
    targets: () => [target],
  })

  state = stepNativeSecondaryAbilities(state, targetContext(100, true)).state
  appendage = state.actors.find(({ kind }) => kind === 'leviathan-appendage')!
  assert.ok(appendage.slowFactor < Math.fround(0.05000000074505806))
  assert.equal(appendage.targetId, null)
  state = stepNativeSecondaryAbilities(state, targetContext(101, false)).state
  appendage = state.actors.find(({ kind }) => kind === 'leviathan-appendage')!
  assert.equal(appendage.targetId, target.id)
  assert.equal(state.actors.some(({ kind }) => kind === 'ether-bolt'), false)

  const bankBefore = appendage.phase
  state = {
    ...state,
    actors: state.actors.map((actor) => actor.id === appendage.id
      ? { ...actor, quantity: 1 }
      : actor),
  }
  const beforeFire = state.rng
  const fired = stepNativeSecondaryAbilities(state, targetContext(102, false))
  appendage = fired.state.actors.find(({ kind }) => kind === 'leviathan-appendage')!
  const bolt = fired.state.actors.find(({ kind }) => kind === 'ether-bolt')!
  const shotFade = fired.state.actors.find(({ kind }) => kind === 'ether-fade')!
  assert.ok(bolt)
  assert.equal(bolt.quantity, 100)
  assert.equal(bolt.radius, 10)
  assert.equal(bolt.lifetimeTicks, 200)
  assert.ok(shotFade)
  assert.equal(shotFade.alpha, 1)
  assert.equal(shotFade.scale, 1.5)
  assert.equal(shotFade.slowFactor, Math.fround(0.05))
  assert.equal(shotFade.variant, 0)
  assert.deepEqual(fired.state.rng, advanceNativeRngWords(beforeFire, 3))
  assert.ok(appendage.quantity >= 75 && appendage.quantity <= 100)
  assert.ok(appendage.phase === bankBefore || appendage.phase === (bankBefore === 0 ? 1 : 0))

  let boltOnly: NativeSecondarySimulationState = {
    ...fired.state,
    actors: [bolt],
  }
  for (let update = 1; update <= 199; update += 1) {
    boltOnly = stepNativeSecondaryAbilities(
      boltOnly,
      context(11, 102 + update, null),
    ).state
  }
  const fadingBolt = boltOnly.actors.find(({ kind }) => kind === 'ether-bolt')!
  assert.ok(fadingBolt)
  assert.equal(fadingBolt.ageTicks, 199)
  assert.equal(fadingBolt.quantity, -99)
  assert.ok(fadingBolt.alpha > 0)

  const expired = stepNativeSecondaryAbilities(
    boltOnly,
    context(11, 302, null),
  ).state
  assert.equal(expired.actors.some(({ kind }) => kind === 'ether-bolt'), false)

  const contactPosition = {
    x: fadingBolt.position.x + fadingBolt.velocity.x,
    y: fadingBolt.position.y + fadingBolt.velocity.y,
  }
  const contactTarget = { ...target, id: 501, position: contactPosition }
  const finalContact = stepNativeSecondaryAbilities(boltOnly, {
    ...context(11, 302, null),
    targets: () => [contactTarget],
  })
  assert.deepEqual(finalContact.damage, [{
    amount: bolt.damage,
    kind: 'magic',
    ownerId: bolt.ownerId,
    sourceActorId: bolt.id,
    targetId: contactTarget.id,
  }])
  assert.equal(finalContact.state.actors.some(({ kind }) => kind === 'ether-bolt'), false)
  const contactFade = finalContact.state.actors.find(({ kind }) => kind === 'ether-fade')!
  assert.equal(contactFade.variant, 1)
  assert.equal(contactFade.alpha, 2)
  assert.equal(contactFade.scale, 2)
  assert.equal(contactFade.slowFactor, Math.fround(0.1))
  assert.equal(contactFade.lifetimeTicks, 19)
})

test('Ether Drain retains its strict ellipse and applies exact pressure, contact tiers, and RNG', () => {
  const targets = [
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 1, position: { x: 119, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 2, position: { x: 114, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 3, position: { x: 109, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 4, nativeFlags: 1, position: { x: 109, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 5, position: { x: 612, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 6, position: { x: 100, y: 820 }, radius: 10, scale: 1, shieldHealth: 0 },
    { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 7, position: { x: 1_123, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 },
  ]
  const byId = new Map(targets.map((target) => [target.id, target]))
  const queryRadii: number[] = []
  const tickContext = (tick: number): NativeSecondaryTickContext => ({
    ...context(74, tick, null),
    target: (_worldKey, targetId) => byId.get(targetId) ?? null,
    targets: (_worldKey, _center, radius) => {
      queryRadii.push(radius)
      return targets
    },
  })
  let state = cast(74).state
  for (let tick = 2; tick <= 41; tick += 1) {
    state = stepNativeSecondaryAbilities(state, tickContext(tick)).state
  }
  const beforeContactRng = state.rng
  const result = stepNativeSecondaryAbilities(state, tickContext(42))
  const parent = result.state.actors.find(({ kind }) => kind === 'ether-drain')!
  const baseDamage = parent.damage / 100

  assert.deepEqual(queryRadii, [1_024, 1_024, 1_024])
  assert.deepEqual(parent.hitTargetIds, [1, 2, 3, 4, 5, 7])
  assert.deepEqual(result.damage.map(({ amount, targetId }) => ({ amount, targetId })), [
    { amount: baseDamage, targetId: 1 },
    { amount: baseDamage * 2, targetId: 2 },
    { amount: baseDamage * 4, targetId: 3 },
    { amount: baseDamage * 8, targetId: 4 },
  ])
  assert.deepEqual(result.knockbacks.map(({ targetId }) => targetId), [1, 2, 3, 4, 5])
  assert.equal(result.knockbacks.at(-1)?.delta.x, -0.1 * parent.alpha * 1.1)
  assert.deepEqual(result.state.rng, advanceNativeRngWords(beforeContactRng, 4))
})

test('Ether Drain owns exact SuckCloud/SuckDebris RNG, travel, and callback boundaries', () => {
  let state = cast(74).state
  for (let tick = 2; tick <= 42; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(74, tick, null)).state
  }
  const parentBeforeChildren = state.actors.find(({ kind }) => kind === 'ether-drain')!

  let childSeed = 1
  for (;; childSeed += 1) {
    const gate = drawNativeInteger(createNativeRng(childSeed), 5)
    if (gate.value !== 1) continue
    const debrisGate = drawNativeInteger(advanceNativeRngWords(gate.state, 7), 50)
    if (debrisGate.value === 1) break
  }
  const childRng = createNativeRng(childSeed)
  const born = stepNativeSecondaryAbilities(
    { ...state, rng: childRng },
    context(74, 43, null),
  ).state
  const cloud = born.actors.find(({ kind }) => kind === 'ether-drain-cloud')!
  const debris = born.actors.find(({ kind }) => kind === 'ether-drain-debris')!
  assert.ok(cloud)
  assert.ok(debris)
  assert.deepEqual(born.rng, advanceNativeRngWords(childRng, 13))

  const cloudGate = drawNativeInteger(childRng, 5)
  const cloudScale = drawNativeFloat(cloudGate.state, 1.5)
  const cloudRotation = drawNativeFloat(cloudScale.state, 360)
  const cloudAlpha = drawNativeFloat(cloudRotation.state, 0.15)
  const cloudSpeed = drawNativeFloat(cloudAlpha.state, 3)
  const cloudRecord = drawNativeInteger(cloudSpeed.state, 2)
  const cloudRadius = drawNativeFloat(cloudRecord.state, 100)
  const cloudDirection = drawUnitVectorForTest(cloudRadius.state)
  assert.equal(cloud.variant, cloudRecord.value)
  assert.equal(cloud.scale, Math.fround(1 + cloudScale.value))
  assert.equal(cloud.alpha, Math.fround(0.1 + cloudAlpha.value))
  assert.deepEqual(cloud.position, {
    x: Math.fround(parentBeforeChildren.position.x + cloudDirection.value.x * cloudRadius.value),
    y: Math.fround(parentBeforeChildren.position.y + cloudDirection.value.y * cloudRadius.value),
  })
  assert.equal(cloud.quantity, Math.fround((5 + cloudSpeed.value) * Math.fround(0.5)))

  const debrisGate = drawNativeInteger(cloudDirection.rng, 50)
  const debrisOscillation = drawNativeFloat(debrisGate.state, 360)
  const debrisRotation = drawNativeFloat(debrisOscillation.state, 360)
  const debrisDirection = drawUnitVectorForTest(debrisRotation.state)
  const debrisRecord = drawNativeInteger(debrisDirection.rng, 3)
  assert.equal(debris.variant, debrisRecord.value)
  assert.equal(debris.phase, debrisOscillation.value)
  assert.equal(debris.rotationRadians, debrisRotation.value * Math.PI / 180)
  assert.deepEqual(debris.endpoint, parentBeforeChildren.position)
  assert.deepEqual(debris.hitTargetIds, [parentBeforeChildren.id])
  assert.ok(Math.abs(debris.quantity - 1_024) < 0.001)

  const callbackRng = createNativeRng(500)
  const callback = stepNativeSecondaryAbilities({
    ...born,
    actors: [
      { ...parentBeforeChildren, freezeTicks: 99, phase: 2, quantity: 99, scale: 1, slowFactor: 0 },
      { ...debris, quantity: 0.5, slowFactor: 1 },
    ],
    rng: callbackRng,
  }, context(74, 44, null)).state
  assert.deepEqual(callback.rng, advanceNativeRngWords(callbackRng, 3))
  assert.equal(callback.actors.some(({ kind }) => kind === 'ether-drain-debris'), false)
  assert.equal(callback.actors.some(({ kind }) => kind === 'ether-drain-capture-flare'), false)
  assert.equal(callback.actors.find(({ kind }) => kind === 'ether-drain')?.slowFactor, 2)

  const noCallback = stepNativeSecondaryAbilities({
    ...born,
    actors: [
      { ...parentBeforeChildren, freezeTicks: 99, phase: 2, quantity: 99, scale: 1, slowFactor: 1 },
      { ...cloud, phase: 179, slowFactor: 2 },
    ],
  }, context(74, 44, null)).state
  assert.equal(noCallback.actors.some(({ kind }) => kind === 'ether-drain-cloud'), false)
  assert.equal(
    noCallback.actors.find(({ kind }) => kind === 'ether-drain')?.slowFactor,
    Math.fround(1 - Math.fround(0.1)),
  )
})

test('Magic Storm emits drops before its seven-draw strike geometry and owns the 101-step fade', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 17,
    position: { x: 400, y: 0 },
    radius: 10,
    scale: 1,
    shieldHealth: 0,
  }
  const source = createNativeSecondarySimulation(123)
  let state = stepNativeSecondaryAbilities(source, context(27, 1, 0)).state
  const born = state.actors.find(({ kind }) => kind === 'storm-cloud')!
  assert.equal(born.alpha, 0)
  assert.equal(born.scale, Math.fround(0.01))
  assert.equal(born.quantity, 50)
  assert.equal(born.radius, 500)
  assert.equal(born.variant, 0)
  assert.deepEqual(born.presentationRng, source.rng)
  assert.equal((state.rng.indexA - source.rng.indexA + 55) % 55, 32)

  for (let tick = 2; tick <= 50; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(27, tick, null)).state
  }
  const beforeStrikeRng = state.rng
  const queryRadii: number[] = []
  const struck = stepNativeSecondaryAbilities(state, {
    ...context(27, 51, null),
    targets: (_worldKey, _center, radius) => {
      queryRadii.push(radius)
      return [target]
    },
  })
  state = struck.state
  assert.deepEqual(queryRadii, [500])
  assert.equal(struck.damage.length, 1)
  assert.ok(struck.damage[0]!.amount >= 4 && struck.damage[0]!.amount <= 6)
  assert.equal((state.rng.indexA - beforeStrikeRng.indexA + 55) % 55, 12)
  assert.equal(state.nextActorId, 103)
  assert.equal(state.actors.filter(({ kind }) => kind === 'storm-drop').length, 66)
  const bolt = state.actors.find(({ kind }) => kind === 'storm-strike')!
  assert.deepEqual(bolt.endpoint, { x: 400, y: -15 })
  assert.notDeepEqual(bolt.position, bolt.midpoint)
  assert.ok(bolt.position.y >= -275 && bolt.position.y <= -75)
  assert.ok(bolt.midpoint.y >= -290 && bolt.midpoint.y <= 110)
  assert.equal(bolt.lifetimeTicks, 1)

  const cloud = state.actors.find(({ kind }) => kind === 'storm-cloud')!
  assert.equal(cloud.frame, Math.fround(1 - 0.10000000149011612))
  state = {
    ...state,
    actors: [{
      ...cloud,
      ageTicks: cloud.freezeTicks,
      alpha: 1,
      scale: 1,
    }],
  }
  for (let tick = 0; tick < 100; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(27, 1_100 + tick, null)).state
  }
  assert.ok(state.actors.some(({ kind }) => kind === 'storm-cloud'))
  state = stepNativeSecondaryAbilities(state, context(27, 1_200, null)).state
  assert.equal(state.actors.some(({ kind }) => kind === 'storm-cloud'), false)
})

test('Magic Tornado consumes the cloud visual prefix, heading, and fixed native step', () => {
  const source = createNativeSecondarySimulation(123)
  const castResult = stepNativeSecondaryAbilities(
    source,
    context(27, 1, 0, 100, [28]),
  )
  const born = castResult.state.actors.find(({ kind }) => kind === 'storm-cloud')!
  assert.equal(born.variant, 1)
  assert.equal((castResult.state.rng.indexA - source.rng.indexA + 55) % 55, 33)
  const stepped = stepNativeSecondaryAbilities(
    castResult.state,
    context(27, 2, null, 100, [28]),
  ).state
  const moved = stepped.actors.find(({ kind }) => kind === 'storm-cloud')!
  assert.deepEqual(moved.position, {
    x: Math.fround(
      born.position.x
        + Math.cos(moved.rotationRadians) * Math.fround(0.349999994),
    ),
    y: Math.fround(
      born.position.y
        + Math.sin(moved.rotationRadians) * Math.fround(0.349999994),
    ),
  })
  assert.equal((stepped.rng.indexA - castResult.state.rng.indexA + 55) % 55, 4)
})

test('Tempest doubles only Storm base activity and the cloud remains at its immutable world aim', () => {
  const initial = context(27, 1, 0)
  const aim = { x: 321, y: 222 }
  let state = stepNativeSecondaryAbilities(createNativeSecondarySimulation(8), {
    ...initial,
    players: {
      player: {
        ...initial.players.player!,
        input: input(0, aim),
        magicStormDurationBonusTicks: 75,
        maximumMagicStorm: true,
      },
    },
  }).state
  const born = state.actors.find(({ kind }) => kind === 'storm-cloud')!
  assert.deepEqual(born.position, aim)
  assert.equal(born.freezeTicks, 2_075)
  assert.equal(born.lifetimeTicks, 2_176)

  const movedOwnerContext = context(27, 2, null)
  state = stepNativeSecondaryAbilities(state, {
    ...movedOwnerContext,
    players: {
      player: {
        ...movedOwnerContext.players.player!,
        character: {
          ...movedOwnerContext.players.player!.character,
          position: { x: -900, y: -800 },
        },
      },
    },
  }).state
  assert.deepEqual(state.actors.find(({ id }) => id === born.id)?.position, aim)
})

test('Magic Storm owns the per-tick ambient flash roll and thunder edge through fade', () => {
  const castState = cast(27).state
  const cloud = castState.actors.find(({ kind }) => kind === 'storm-cloud')!
  const fading: NativeSecondarySimulationState = {
    ...castState,
    actors: [{
      ...cloud,
      ageTicks: cloud.freezeTicks,
      alpha: 1,
      frame: 0.4,
      scale: 1,
    }],
    rng: createNativeRng(163),
  }
  const flashed = stepNativeSecondaryAbilities(
    fading,
    context(27, 2_000, null),
  ).state
  assert.equal(flashed.actors[0]!.frame, 1)
  assert.equal(flashed.events.at(-1)?.cue, 'thunder')
  assert.equal((flashed.rng.indexA - fading.rng.indexA + 55) % 55, 2)

  const decayed = stepNativeSecondaryAbilities({
    ...flashed,
    rng: createNativeRng(1),
  }, context(27, 2_001, null)).state
  assert.equal(decayed.actors[0]!.frame, Math.fround(1 - 0.10000000149011612))
})

test('Ring of Ice owns the float32 93-tick expansion and one-contact ledger', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 3, position: { x: 100, y: 0 }, radius: 10, scale: 1, shieldHealth: 0,
  }
  const source = createNativeSecondarySimulation(123)
  let state = stepNativeSecondaryAbilities(source, context(35, 1, 0)).state
  const born = state.actors.find(({ kind }) => kind === 'freeze-wave')!
  const visual = state.actors.find(({ kind }) => kind === 'freeze-wave-visual')!
  assert.equal(born.phase, Math.fround(0.924))
  assert.equal(visual.lifetimeTicks, 175)
  assert.deepEqual(visual.presentationRng, source.rng)
  assert.deepEqual(state.rng, consumeFreezeWaveConstruction(source.rng, 100))
  assert.equal(state.actors.some(({ kind }) => kind === 'ice-blast'), false)
  const queryRadii: number[] = []
  for (let age = 1; age <= 92; age += 1) {
    state = stepNativeSecondaryAbilities(state, {
      ...context(35, age + 1, null),
      targets: (_worldKey, _center, radius) => {
        queryRadii.push(radius)
        return [target]
      },
    }).state
  }
  const wave = state.actors.find(({ kind }) => kind === 'freeze-wave')!
  assert.equal(wave.ageTicks, 92)
  assert.equal(wave.radius, 75 + 92 * 6)
  assert.deepEqual(queryRadii, [135, 195, 255, 315, 375, 435, 495, 555, 615])
  assert.deepEqual(wave.hitTargetIds, [3])
  state = stepNativeSecondaryAbilities(state, context(35, 94, null)).state
  assert.equal(state.actors.some(({ kind }) => kind === 'freeze-wave'), false)

  const enhancedContext = context(35, 1, 0)
  const enhanced = stepNativeSecondaryAbilities(source, {
    ...enhancedContext,
    players: {
      player: {
        ...enhancedContext.players.player!,
        enhancedEffects: true,
      },
    },
  }).state
  assert.equal(
    enhanced.actors.find(({ kind }) => kind === 'freeze-wave-visual')?.enhanced,
    true,
  )
  assert.deepEqual(enhanced.rng, consumeFreezeWaveConstruction(source.rng, 200))
})

test('FreezeWave installs target-owned Frozen material and the exact final-200 thaw ramp', () => {
  const target = {
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 41, nativeFlags: 0x2, position: { x: 100, y: 0 }, radius: 10,
    scale: 1, shieldHealth: 0,
  }
  let state = cast(35).state
  for (let tick = 2; tick <= 11; tick += 1) {
    const tickContext = context(35, tick, null)
    state = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [target],
    }).state
  }
  const effect = state.targetEffects.find(({ targetId }) => targetId === target.id)!
  const freezeSeconds = effectiveSecondaryAbilityRankStats(
    context(35, 1, 0).players.player!.skillBook,
    35,
  ).values.mDamage
  assert.equal(effect.frozenTicks, Math.trunc(freezeSeconds * 100))
  assert.equal(effect.coldSlowTicks, 0)
  assert.equal(effect.timeScale, 0)
  assert.equal(nativeSecondaryTargetMaterialTint(0xffffff, effect), 0x93bfff)

  const thawSource = {
    ...state,
    targetEffects: [{
      ...effect,
      frozenTicks: 201,
      frozenTimeScale: 0,
      timeScale: 0,
    }],
  }
  const thaw = stepNativeSecondaryAbilities(thawSource, context(35, 12, null)).state
    .targetEffects[0]!
  assert.equal(thaw.frozenTicks, 200)
  assert.equal(thaw.frozenTimeScale, Math.fround(0.005))
  assert.equal(thaw.timeScale, Math.fround(0.005))
  assert.equal(nativeSecondaryTargetMaterialTint(0xffffff, thaw), 0x93c0ff)

  const expired = stepNativeSecondaryAbilities({
    ...state,
    targetEffects: [{
      ...effect,
      frozenTicks: 1,
      frozenTimeScale: Math.fround(0.995),
      timeScale: Math.fround(0.995),
    }],
  }, context(35, 12, null)).state
  assert.equal(expired.targetEffects.some(({ targetId }) => targetId === target.id), false)
})

test('distinct native movement modifiers multiply instead of selecting one minimum factor', () => {
  let state = createNativeSecondarySimulation(123)
  state = applyNativeSecondaryTargetEffect(state, 'boneyard:test', 41, {
    coldSlowFactor: 0.5,
    coldSlowMaterial: true,
    coldSlowTicks: 1,
  })
  state = applyNativeSecondaryTargetEffect(state, 'boneyard:test', 41, {
    circleSlowFactor: 0.5,
    circleSlowTicks: 3,
  })
  state = applyNativeSecondaryTargetEffect(state, 'boneyard:test', 41, {
    stunFactor: 0.5,
    stunTicks: 2,
  })
  state = applyNativeSecondaryTargetEffect(state, 'boneyard:test', 41, {
    dazzleTicks: 100,
  })
  let effect = state.targetEffects[0]!
  assert.deepEqual(effect.movementModifierOrder, [
    'cold-slow', 'circle-slow', 'stun', 'dazzle',
  ])
  assert.equal(effect.timeScale, Math.fround(Math.fround(Math.fround(0.5 * 0.5) * 0.5) * 0.01))
  assert.equal(effect.coldSlowMaterial, true)

  state = stepNativeSecondaryAbilities(state, context(49, 1, null)).state
  effect = state.targetEffects[0]!
  assert.equal(effect.coldSlowTicks, 0)
  assert.equal(effect.circleSlowTicks, 2)
  assert.equal(effect.coldSlowMaterial, false)
  assert.equal(effect.timeScale, Math.fround(Math.fround(0.5 * 0.5) * 0.01))

  state = stepNativeSecondaryAbilities(state, context(49, 2, null)).state
  effect = state.targetEffects[0]!
  assert.equal(effect.circleSlowTicks, 1)
  assert.equal(effect.stunTicks, 0)
  assert.equal(effect.timeScale, Math.fround(0.5 * 0.02))

  let forward = createNativeSecondarySimulation(123)
  forward = applyNativeSecondaryTargetEffect(forward, 'boneyard:test', 42, {
    coldSlowFactor: 0.1,
    coldSlowTicks: 10,
  })
  forward = applyNativeSecondaryTargetEffect(forward, 'boneyard:test', 42, {
    circleSlowFactor: 0.1,
    circleSlowTicks: 10,
  })
  forward = applyNativeSecondaryTargetEffect(forward, 'boneyard:test', 42, {
    stunFactor: 0.7,
    stunTicks: 10,
  })
  let reverse = createNativeSecondarySimulation(123)
  reverse = applyNativeSecondaryTargetEffect(reverse, 'boneyard:test', 42, {
    stunFactor: 0.7,
    stunTicks: 10,
  })
  reverse = applyNativeSecondaryTargetEffect(reverse, 'boneyard:test', 42, {
    circleSlowFactor: 0.1,
    circleSlowTicks: 10,
  })
  reverse = applyNativeSecondaryTargetEffect(reverse, 'boneyard:test', 42, {
    coldSlowFactor: 0.1,
    coldSlowTicks: 10,
  })
  assert.deepEqual(forward.targetEffects[0]?.movementModifierOrder, [
    'cold-slow', 'circle-slow', 'stun',
  ])
  assert.deepEqual(reverse.targetEffects[0]?.movementModifierOrder, [
    'stun', 'circle-slow', 'cold-slow',
  ])
  assert.equal(forward.targetEffects[0]?.timeScale, 0.00699999975040555)
  assert.equal(reverse.targetEffects[0]?.timeScale, 0.007000000216066837)
})

test('FreezeWave selects ColdSlow for flag 0x40 and Frostburn adds exact damage and target flares', () => {
  const coldTarget = {
    family: 'OBJECT', lightRegistration: TARGET_LIGHT_REGISTRATION,
    id: 51, nativeFlags: 0x40, position: { x: 100, y: 0 }, radius: 10,
    scale: 1, shieldHealth: 0,
  }
  let cold = cast(35).state
  for (let tick = 2; tick <= 11; tick += 1) {
    const tickContext = context(35, tick, null)
    cold = stepNativeSecondaryAbilities(cold, {
      ...tickContext,
      targets: () => [coldTarget],
    }).state
  }
  const coldEffect = cold.targetEffects[0]!
  assert.equal(coldEffect.coldSlowTicks > 0, true)
  assert.equal(coldEffect.coldSlowMaterial, true)
  assert.equal(coldEffect.frozenTicks, 0)
  assert.equal(coldEffect.timeScale, 0.5)
  assert.equal(nativeSecondaryTargetMaterialTint(0xffffff, coldEffect), 0xbfffff)

  const target = { ...coldTarget, family: 'ZOMBIE', id: 52, nativeFlags: 0x2 }
  const maximumContext = context(35, 1, 0)
  let state = stepNativeSecondaryAbilities(createNativeSecondarySimulation(123), {
    ...maximumContext,
    players: {
      player: { ...maximumContext.players.player!, maximumRingOfIce: true },
    },
  }).state
  for (let tick = 2; tick <= 11; tick += 1) {
    const tickContext = context(35, tick, null)
    state = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [target],
    }).state
  }
  const effect = state.targetEffects[0]!
  assert.equal(effect.frostBurnDamagePerTick, Math.fround(0.01))
  assert.equal(effect.frostBurnTicks, effect.frozenTicks * 100)
  assert.equal(effect.frostBurnOwnerId, 'player')
  assert.equal(effect.frostBurnSkillId, 35)

  let frostDamageUpdates = 0
  for (let tick = 12; tick <= 31; tick += 1) {
    const tickContext = context(35, tick, null)
    const result = stepNativeSecondaryAbilities(state, {
      ...tickContext,
      target: (_worldKey, targetId) => targetId === target.id ? target : null,
      targets: () => [],
    })
    frostDamageUpdates += result.damage.filter(({ amount, targetId }) => (
      amount === Math.fround(0.01) && targetId === target.id
    )).length
    state = result.state
  }
  assert.equal(frostDamageUpdates, 20)
  assert.equal(state.actors.some(({ kind }) => kind === 'frost-burn-flare'), true)
})

test('Acid Rain creates exact children and separates cloud from residue ownership', () => {
  let state = cast(72).state
  const field = state.actors.find(({ kind }) => kind === 'acid-rain')!
  assert.equal(field.damage, Math.fround(2 / 6))
  assert.equal(field.quantity, 50)
  assert.equal(field.lightRegistration?.managerLane, 'actor')
  assert.ok(field.rotationRadians >= 0 && field.rotationRadians < 1)

  state = stepNativeSecondaryAbilities(state, context(72, 2, null)).state
  const activeField = state.actors.find(({ kind }) => kind === 'acid-rain')!
  assert.equal(activeField.phase, Math.fround(0.05))
  assert.equal(activeField.lightRegistration?.managerLane, 'actor')
  const firstDrops = state.actors.filter(({ kind }) => kind === 'acid-drop')
  assert.equal(firstDrops.length, 2)
  assert.ok(firstDrops.every((drop) => (
    drop.phase === -175 && drop.quantity === 0 && drop.scale === Math.fround(0.1)
  )))
  const firstDrop = firstDrops[0]!
  state = stepNativeSecondaryAbilities(state, context(72, 3, null)).state
  const fallen = state.actors.find(({ id }) => id === firstDrop.id)!
  assert.equal(fallen.phase, -155)
  assert.equal(fallen.quantity, 4)

  for (let tick = 4; tick <= 20
    && !state.actors.some(({ kind }) => kind === 'acid-splash'); tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(72, tick, null)).state
  }
  const splash = state.actors.find(({ kind }) => kind === 'acid-splash')!
  assert.ok(splash)
  assert.equal(splash.alpha, Math.fround(0.25))
  assert.deepEqual(splash.velocity, { x: 0, y: Math.fround(-1.5) })
  assert.ok(splash.scale >= 0.375 && splash.scale < 0.75)

  state = {
    ...state,
    actors: [{
      ...field,
      ageTicks: 1_500,
      alpha: 1,
      phase: 1,
      quantity: 25,
      scale: 1,
    }],
  }
  for (let tick = 0; tick < 2_099; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(72, 2_000 + tick, null)).state
  }
  const residue = state.actors.find(({ kind }) => kind === 'acid-rain')!
  assert.ok(residue)
  assert.equal(residue.phase, 0)
  assert.equal(residue.lightRegistration?.managerLane, 'actor')
  state = stepNativeSecondaryAbilities(state, context(72, 4_099, null)).state
  assert.equal(state.actors.some(({ kind }) => kind === 'acid-rain'), false)
})

test('Call Comet allocates one exact variable-life trail on every fall update', () => {
  let state = cast(76).state
  const comet = state.actors.find(({ kind }) => kind === 'comet')!
  assert.ok(comet.rotationRadians > 70 * Math.PI / 180)
  assert.ok(comet.rotationRadians <= Math.PI / 2)
  state = stepNativeSecondaryAbilities(state, context(76, 2, null)).state
  const trail = state.actors.find(({ kind }) => kind === 'comet-trail')!
  assert.ok(trail.alpha >= 0.5 && trail.alpha <= 1)
  assert.ok(trail.phase >= 0.25 && trail.phase <= 0.5)
  assert.equal(trail.scale, Math.fround(2.5))
  assert.ok(
    trail.quantity === Math.fround(0.99)
      || trail.quantity === Math.fround(1.015),
  )
  const rotation = trail.rotationRadians
  state = stepNativeSecondaryAbilities(state, context(76, 3, null)).state
  const advanced = state.actors.find(({ id }) => id === trail.id)!
  assert.equal(advanced.phase, Math.fround(trail.phase - Math.fround(0.025)))
  assert.equal(advanced.rotationRadians, Math.fround(rotation * trail.quantity))
})

test('Frostburn Jewels propagates through Call Comet into its shared FreezeWave', () => {
  const castContext = context(76, 1, 0)
  let state = stepNativeSecondaryAbilities(createNativeSecondarySimulation(9), {
    ...castContext,
    players: {
      player: { ...castContext.players.player!, maximumRingOfIce: true },
    },
  }).state
  const comet = state.actors.find(({ kind }) => kind === 'comet')!
  assert.equal(comet.quantity, 1)
  state = {
    ...state,
    actors: [{ ...comet, ageTicks: 399 }],
  }
  state = stepNativeSecondaryAbilities(state, context(76, 2, null)).state
  const wave = state.actors.find(({ kind }) => kind === 'freeze-wave')!
  assert.equal(wave.variant, 1)
  assert.equal(wave.freezeTicks, comet.freezeTicks)
})

test('Comet whistles after crossing below 175 ticks remaining and impacts exactly on tick 400', () => {
  let state = cast(76).state
  for (let tick = 2; tick <= 225; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(76, tick, null)).state
  }
  assert.equal(state.actors.find(({ kind }) => kind === 'comet')?.ageTicks, 224)
  state = stepNativeSecondaryAbilities(state, context(76, 226, null)).state
  assert.equal(state.events.some(({ kind }) => kind === 'whistle'), false)
  state = stepNativeSecondaryAbilities(state, context(76, 227, null)).state
  assert.ok(state.events.some(({ kind }) => kind === 'whistle'))
  for (let tick = 228; tick <= 401; tick += 1) {
    state = stepNativeSecondaryAbilities(state, context(76, tick, null)).state
  }
  assert.equal(state.actors.some(({ kind }) => kind === 'comet'), false)
  assert.equal(state.actors.some(({ kind }) => kind === 'comet-impact'), true)
  assert.equal(state.actors.some(({ kind }) => kind === 'freeze-wave'), true)
  assert.deepEqual(screenFlashes(state), [
    expectedScreenFlash(1, 1, 1, 0.005, false),
  ])
  const visual = state.actors.find(({ kind }) => kind === 'freeze-wave-visual')!
  assert.equal(visual.lifetimeTicks, 175)
  const debris = state.actors.filter(({ kind }) => kind === 'comet-debris')
  assert.ok(debris.length >= 33 && debris.length <= 72)
  assert.ok(debris.every((piece) => (
    piece.variant >= 0 && piece.variant <= 4
      && piece.scale >= 0.55 && piece.scale <= 1.05
      && piece.phase >= -20 && piece.phase <= 0
      && piece.endpoint.x === piece.endpoint.y
      && piece.endpoint.x >= -6.25 && piece.endpoint.x <= -2.5
  )))
  const anisotropic = debris.find((piece) => {
    const dx = piece.position.x - 100
    const dy = piece.position.y
    return Math.abs(dx) > 1 && Math.abs(dy) > 1
  })!
  const dx = anisotropic.position.x - 100
  const dy = anisotropic.position.y
  assert.ok(Math.abs(
    anisotropic.velocity.x / dx / 1.5 - anisotropic.velocity.y / dy
  ) < 1e-6)

  const isolated = {
    ...state,
    actors: [anisotropic],
  }
  const skipped = stepNativeSecondaryAbilities(isolated, context(76, 402, null)).state
    .actors[0]!
  assert.equal(skipped.ageTicks, anisotropic.ageTicks + 1)
  assert.equal(skipped.alpha, anisotropic.alpha)
  assert.deepEqual(skipped.position, anisotropic.position)
  assert.equal(skipped.phase, anisotropic.phase)

  const advancedState = stepNativeSecondaryAbilities(isolated, context(76, 403, null)).state
  const advanced = advancedState.actors[0]!
  assert.equal(advanced.alpha, Math.fround(anisotropic.alpha - Math.fround(0.015)))
  assert.notDeepEqual(advanced.position, anisotropic.position)
  assert.equal(advanced.phase, Math.fround(anisotropic.phase + anisotropic.endpoint.x))

  const bounceSource = {
    ...isolated,
    actors: [{
      ...anisotropic,
      endpoint: { x: Math.fround(0.2), y: Math.fround(-3) },
      phase: Math.fround(-0.1),
    }],
  }
  const bounced = stepNativeSecondaryAbilities(bounceSource, context(76, 403, null)).state
  assert.equal((bounced.rng.indexA - bounceSource.rng.indexA + 55) % 55, 2)
  assert.ok(bounced.actors[0]!.endpoint.x < 0)
  assert.equal(bounced.actors[0]!.phase, bounced.actors[0]!.endpoint.x)
})

test('death or disconnect cleanup retires player-owned actors and state once', () => {
  const state = cast(45).state
  const result = stepNativeSecondaryAbilities(state, {
    ...context(45, 2, null),
    players: {},
  })
  assert.deepEqual(result.state.players, {})
  assert.equal(result.state.actors.length, 0)

  const frost = removeNativeSecondaryOwner({
    ...state,
    targetEffects: [{
      circleSlowFactor: 1,
      circleSlowTicks: 0,
      coldSlowFactor: 1,
      coldSlowMaterial: false,
      coldSlowTicks: 0,
      dazzleMaximumTicks: 0,
      dazzleTicks: 0,
      disruptedTicks: 0,
      electricBurn: null,
      fleeTicks: 0,
      frostBurnDamagePerTick: Math.fround(0.01),
      frostBurnOwnerId: 'player',
      frostBurnSkillId: 35,
      frostBurnSourceActorId: 99,
      frostBurnTicks: 50_000,
      frozenTicks: 500,
      frozenTimeScale: 0,
      movementModifierOrder: ['frozen'],
      prismaticTicks: 0,
      stunFactor: 1,
      stunTicks: 0,
      steamed: null,
      targetId: 7,
      timeScale: 0,
      weakenFactor: 1,
      worldKey: 'boneyard:test',
    }],
  }, 'player')
  assert.equal(frost.targetEffects[0]?.frostBurnTicks, 0)
  assert.equal(frost.targetEffects[0]?.frozenTicks, 500)
})

test('Magic Storm lightning consumes Prismatic susceptibility and Acid Rain uses exact target count', () => {
  const target = { family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: 1, position: { x: 0, y: 0 }, radius: 10, scale: 1, shieldHealth: 0 }
  let state = createNativeSecondarySimulation(7)
  state = stepNativeSecondaryAbilities(state, {
    ...context(30, 1, 0),
    targets: () => [target],
  }).state
  state = stepNativeSecondaryAbilities(state, {
    ...context(30, 2, null),
    targets: () => [target],
  }).state
  assert.ok(state.targetEffects.some(({ prismaticTicks }) => prismaticTicks > 0))

  const rain = cast(72).state
  const targets = Array.from({ length: 7 }, (_, index) => ({
    family: 'ZOMBIE', lightRegistration: TARGET_LIGHT_REGISTRATION, id: index + 1, position: { x: 100, y: 0 }, radius: 10, scale: 1, shieldHealth: 0,
  }))
  let rainState: NativeSecondarySimulationState = rain
  let pulseDamage = 0
  const pulseAmounts: number[] = []
  for (let tick = 2; tick <= 80; tick += 1) {
    const stepped = stepNativeSecondaryAbilities(rainState, {
      ...context(72, tick, null),
      targets: () => targets,
    })
    rainState = stepped.state
    pulseDamage += stepped.damage.length
    pulseAmounts.push(...stepped.damage.map(({ amount }) => amount))
  }
  assert.equal(pulseDamage, 3)
  assert.deepEqual(pulseAmounts, Array(3).fill(Math.fround(2 / 6)))
})

test('Acid Rain uses the strict native radius-200 root attack area', () => {
  const cases = [
    { hit: true, name: 'inside horizontal edge', offset: { x: 199.999, y: 0 }, radius: 1 },
    { hit: false, name: 'exact horizontal edge', offset: { x: 200, y: 0 }, radius: 1 },
    { hit: false, name: 'body overlap beyond edge', offset: { x: 225, y: 0 }, radius: 100 },
    { hit: true, name: 'inside diagonal', offset: { x: 141, y: 141 }, radius: 50 },
    { hit: false, name: 'outside diagonal', offset: { x: 142, y: 142 }, radius: 50 },
    { hit: false, name: 'overhead cloud proxy', offset: { x: 0, y: 350 }, radius: 100 },
  ] as const

  for (const expected of cases) {
    const castState = cast(72).state
    const field = castState.actors.find(({ kind }) => kind === 'acid-rain')!
    const source: NativeSecondarySimulationState = {
      ...castState,
      actors: [{
        ...field,
        ageTicks: 100,
        alpha: 1,
        phase: 1,
        quantity: 1,
        scale: 1,
      }],
    }
    const target = {
      family: 'ZOMBIE',
      id: 1,
      lightRegistration: TARGET_LIGHT_REGISTRATION,
      position: {
        x: field.position.x + expected.offset.x,
        y: field.position.y + expected.offset.y,
      },
      radius: expected.radius,
      scale: 1,
      shieldHealth: 0,
    }
    let queryCenter: Readonly<{ x: number; y: number }> | null = null
    let queryRadius: number | null = null
    const result = stepNativeSecondaryAbilities(source, {
      ...context(72, 101, null),
      targets: (_worldKey, center, radius) => {
        queryCenter = center
        queryRadius = radius
        return [target]
      },
    })

    assert.deepEqual(queryCenter, field.position, expected.name)
    assert.equal(queryRadius, 200, expected.name)
    assert.equal(result.damage.length, expected.hit ? 1 : 0, expected.name)
  }
})
