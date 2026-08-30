import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_SECONDARY_ABILITY_CONTRACTS,
  NATIVE_SECONDARY_ABILITY_IDS,
  NATIVE_SECONDARY_BELT_SLOT_COUNT,
  NATIVE_SECONDARY_KEYBOARD_SLOTS,
  NATIVE_SECONDARY_RIGHT_MOUSE_SLOT,
  nativeSecondaryAbilityContract,
} from './native-secondary-ability-contract.ts'
import { NATIVE_SECONDARY_AUDIO_CUES } from './native-secondary-abilities.ts'

const EXPECTED = [
  [11, 'Call Leviathan', 'aimed-world-point', 'BadGuys:343..372', 'leviathan-roar'],
  [12, 'Planewalker', 'self', 'BadGuys:75', 'planewalker-on'],
  [15, 'Phasing', 'actor-heading-forward-probe', 'BadGuys:53', 'phase'],
  [21, 'Ring of Fire', 'caster-center', 'DeadHawg:46..77', 'big-fire'],
  [23, 'Firewalker', 'self-trail', 'DeadHawg:46..77', 'ignite'],
  [27, 'Magic Storm', 'aimed-world-point', 'BadGuys:0,11,78,84', 'magic-storm'],
  [30, 'Prismatic Shock', 'caster-center-radius-350', 'BadGuys:58', 'prismatic-shock'],
  [35, 'Ring of Ice', 'caster-center', 'DeadHawg:114,121', 'ring-of-ice'],
  [41, 'Earthquake', 'caster-center', 'DeadHawg:200..202', 'earthquake-loop'],
  [45, 'Raise Golem', 'collision-adjusted-aimed-world-point', 'Golem:1..208', 'quake-crack-small'],
  [46, 'Stoneskin', 'self', 'player:actor flag 0x1 material treatment', 'stoneskin-on'],
  [48, 'Teleport', 'arena-farthest-lattice-or-region-origin', 'BadGuys:90', 'teleport'],
  [49, 'Magic Circle', 'aimed-world-point', 'BadGuys:48', 'magic-circle'],
  [50, 'Magic Trap', 'aimed-world-point', 'BadGuys:111,112,15,85', 'set-trap'],
  [51, 'Dampen', 'caster-center-rectangle', 'BadGuys:10,11', 'flash'],
  [54, 'Magic Shield', 'self', 'BadGuys:49', 'magic-shield-up'],
  [72, 'Acid Rain', 'aimed-world-point-strict-radius-200', 'BadGuys:0,10', 'magic-storm'],
  [73, 'Fire Wall', 'line-perpendicular-to-aim', 'DeadHawg:46..77', 'ignite'],
  [74, 'Ether Drain', 'aimed-world-point', 'BadGuys:75', 'distort-reality'],
  [76, 'Call Comet', 'aimed-world-point', 'DeadHawg:5', 'comet-loop'],
  [77, 'Turn Undead', 'caster-center', 'BadGuys:48', 'level-up'],
  [78, 'Mindstar', 'self', 'Region:cyan point-gain feedback', 'mindstar'],
  [79, 'Regenerate', 'self', 'Region:orange point-gain feedback', 'mindstar'],
] as const

const EXPECTED_ART = new Map<number, readonly string[]>([
  [11, ['BadGuys:343..372', 'BadGuys:39', 'BadGuys:11', 'BadGuys:22', 'procedural:Ether FadeMM']],
  [12, ['BadGuys:75', 'images:etherplane.png', 'BadGuys:11,45', 'BadGuys:11']],
  [15, ['BadGuys:53']],
  [21, ['DeadHawg:46..77', 'DeadHawg:18', 'BadGuys:15,251..254,267..270', 'BadGuys:333..342']],
  [23, ['DeadHawg:46..77', 'BadGuys:333..342']],
  [27, ['BadGuys:0,11,78,84', 'procedural:width-2 blue-white gradient', 'render_target:three BadGuys-78 passes plus moving and white-mask branches']],
  [30, ['BadGuys:58', 'BadGuys:111', 'BadGuys:10,11']],
  [35, ['DeadHawg:114,121', 'BadGuys:72', 'target-material:Frozen and ColdSlow', 'BadGuys:10,11 FrostBurn']],
  [41, ['DeadHawg:200..202', 'BadGuys:62', 'BadGuys:10', 'BadGuys:2008..2010']],
  [45, ['Golem:1..208', 'BadGuys:15,36,62,86,238..245,2008..2010', 'DeadHawg:78..87', 'UI:23']],
  [46, ['player:actor flag 0x1 material treatment']],
  [48, ['BadGuys:90', 'BadGuys:90']],
  [49, ['BadGuys:48', 'BadGuys:7']],
  [50, ['BadGuys:111,112,15,85', 'BadGuys:16', 'BadGuys:158..167,15,17,74', 'BadGuys:333..342']],
  [51, ['BadGuys:10,11', 'BadGuys:48']],
  [54, ['BadGuys:49', 'BadGuys:68', 'BadGuys:15', 'DeadHawg:2', 'BadGuys:158..167', 'BadGuys:17,74', 'DeadHawg:18']],
  [72, ['BadGuys:0,10', 'procedural:width-3 green-blue gradient']],
  [73, ['DeadHawg:46..77', 'BadGuys:333..342']],
  [74, ['BadGuys:75', 'BadGuys:38', 'BadGuys:10..11', 'DeadHawg:177..179', 'BadGuys:36', 'region_light:radius 2']],
  [76, ['DeadHawg:5', 'BadGuys:51,15', 'DeadHawg:203..207,6', 'region_overlay:white full-screen rectangle']],
  [77, ['BadGuys:48']],
  [78, ['Region:cyan point-gain feedback']],
  [79, ['Region:orange point-gain feedback']],
])

const EXPECTED_AUDIO_PATHS = new Map<number, readonly string[]>([
  [11, ['sounds/LeviathanRoar__Stream.wav', 'sounds/PlaneCross__Loop.wav']],
  [12, ['sounds/planewalker__Stream.wav', 'sounds/PlanewalkerOff__Stream.wav', 'sounds/PlaneCross__Loop.wav', 'sounds/distortreality.wav', 'sounds/lightningstart.wav']],
  [15, ['sounds/phase.wav']],
  [21, ['sounds/bigfire.wav', 'sounds/nuke.wav']],
  [23, ['sounds/ignite.wav', 'sounds/lowfire__loop.wav']],
  [27, ['sounds/magicstorm.wav', 'sounds/lightningstart.wav', 'sounds/thunder__Stream.wav', 'sounds/rainfall__loop.wav', 'sounds/steadywind__loop.wav']],
  [30, ['sounds/prismaticspray__stream.wav', 'sounds/lightningstart.wav']],
  [35, ['sounds/ringofice.wav']],
  [41, ['sounds/earthquake__loop.wav', 'sounds/rockhit.wav', 'sounds/QuakeCracks__Stream.wav', 'sounds/QuakeCrackSmall__Stream.wav']],
  [45, ['sounds/QuakeCrackSmall__Stream.wav', 'sounds/GolemProvoke__Stream.wav', 'sounds/KnockbackGolem.wav', 'sounds/stonestep.wav', 'sounds/stonebreak.wav', 'sounds/flamelashstart.wav', 'sounds/GolemDie__Stream.wav', 'sounds/rockhit.wav']],
  [46, ['sounds/StoneSkin__Stream.wav', 'sounds/stoneskin.wav']],
  [48, ['sounds/teleport.wav', 'sounds/teleport.wav']],
  [49, ['sounds/magiccircle.wav']],
  [50, ['sounds/settrap__Stream.wav', 'sounds/magicmissile.wav', 'sounds/throwfire.wav', 'sounds/lightningstart.wav', 'sounds/icestart.wav', 'sounds/startboulder.wav', 'sounds/trap__stream.wav', 'sounds/electric__loop.wav']],
  [51, ['sounds/flash.wav', 'sounds/dampen__stream.wav']],
  [54, ['sounds/magicshieldup.wav', 'sounds/hitshield.wav', 'sounds/popshield.wav', 'sounds/magicshieldexplode.wav']],
  [72, ['sounds/magicstorm.wav', 'sounds/acidsizzle.wav', 'sounds/rainfall__loop.wav']],
  [73, ['sounds/ignite.wav', 'sounds/fireballhit.wav', 'sounds/lowfire__loop.wav']],
  [74, ['sounds/distortreality.wav', 'sounds/lightningstart.wav', 'sounds/PlaneCross__Loop.wav', 'sounds/steadywind__loop.wav']],
  [76, ['sounds/comet__loop.wav', 'sounds/cometwhistle.wav', 'sounds/explodesteam.wav', 'sounds/magicshieldexplode.wav', 'sounds/bigfire.wav', 'sounds/ringofice.wav']],
  [77, ['sounds/levelup.wav', 'sounds/levelup.wav']],
  [78, ['sounds/mindstar__stream.wav']],
  [79, ['sounds/mindstar__stream.wav']],
])

test('the native right-click system is the exact closed 23-member category-2 set', () => {
  assert.deepEqual(NATIVE_SECONDARY_ABILITY_IDS, EXPECTED.map(([skillId]) => skillId))
  assert.equal(NATIVE_SECONDARY_ABILITY_CONTRACTS.length, 23)
  assert.equal(new Set(NATIVE_SECONDARY_ABILITY_IDS).size, 23)
  for (const [skillId, name, targeting, art, firstAudioEvent] of EXPECTED) {
    const contract = nativeSecondaryAbilityContract(skillId)
    assert.equal(contract.skillId, skillId)
    assert.equal(contract.name, name)
    assert.equal(contract.category, 2)
    assert.equal(contract.targeting, targeting)
    assert.ok(contract.art.includes(art), `${name} lost ${art}`)
    assert.equal(contract.audio[0]?.event, firstAudioEvent)
    assert.ok(contract.rank.maximumLevel > 0)
    assert.ok(contract.rank.manaCost.length > 0)
    assert.ok(contract.authority.length > 0)
    assert.ok(contract.cleanup.length > 0)
  }
})

test('every member pins the complete native art and audio ownership census', () => {
  for (const contract of NATIVE_SECONDARY_ABILITY_CONTRACTS) {
    assert.deepEqual(contract.art, EXPECTED_ART.get(contract.skillId), contract.name)
    assert.deepEqual(
      contract.audio.map(({ path }) => path),
      EXPECTED_AUDIO_PATHS.get(contract.skillId),
      contract.name,
    )
  }
  const contractedCues = new Set(
    NATIVE_SECONDARY_ABILITY_CONTRACTS.flatMap(({ audio }) => (
      audio.map(({ event }) => event)
    )),
  )
  assert.deepEqual(
    NATIVE_SECONDARY_AUDIO_CUES.filter((cue) => !contractedCues.has(cue)),
    ['flash-spell', 'fizzle'],
  )
  assert.deepEqual(
    [...contractedCues].filter((cue) => !NATIVE_SECONDARY_AUDIO_CUES.includes(
      cue as typeof NATIVE_SECONDARY_AUDIO_CUES[number],
    )),
    [],
  )
})

test('the native skill quickbar maps right mouse and all seven keyboard slots', () => {
  assert.equal(NATIVE_SECONDARY_BELT_SLOT_COUNT, 8)
  assert.equal(NATIVE_SECONDARY_RIGHT_MOUSE_SLOT, 0)
  assert.deepEqual(NATIVE_SECONDARY_KEYBOARD_SLOTS, [1, 2, 3, 4, 5, 6, 7])
})

test('mana hoards are reserve schedules, not secondary-cast costs', () => {
  assert.deepEqual(nativeSecondaryAbilityContract(23).rank.manaCost, [0])
  assert.deepEqual(nativeSecondaryAbilityContract(78).rank.manaCost, [0])
  assert.deepEqual(nativeSecondaryAbilityContract(79).rank.manaCost, [0])
})

test('critical native VFX and lifecycle constants cannot collapse to generic effects', () => {
  assert.deepEqual(nativeSecondaryAbilityContract(11).timing, {
    activeAgeTicks: '41..1640 inclusive (1600 updates)',
    activeTicks: 1_600,
    boltCountdownTicks: 100,
    boltFadeTicks: 101,
    boltLifetimeTicks: 200,
    firstDeployedActiveUpdate: 59,
    phases: ['scale-in', 'active', 'scale-out'],
    scaleInTicks: 41,
    scaleOutAgeTicks: '1640..1664 inclusive (25 updates)',
    scaleOutTicks: 25,
    shotResetTicks: '75+Integer(26)',
    totalLiveTicks: 1_664,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(11).art, [
    'BadGuys:343..372',
    'BadGuys:39',
    'BadGuys:11',
    'BadGuys:22',
    'procedural:Ether FadeMM',
  ])
  assert.deepEqual(nativeSecondaryAbilityContract(12).timing, {
    birthParticleCount: 27,
    birthParticleRngWords: 180,
    coreRotationDegreesPerTick: 1.5,
    damagePeriodTicks: 6,
    damageMultiplier: 5,
    damageRankIds: [8, 10, 9, 13, 14, 15, 12],
    damagePerTick: '2*sum(effective ranks)/100; excludes Call Leviathan 11',
    duration: 'mDuration*100',
    enhancedMeshSegments: 15,
    enhancedMotesPerActiveTick: 1,
    enhancedMoteRngWords: 5,
    meshTriangles: '3*N',
    meshUv: 'world_xy/192 repeat',
    meshVertices: '1+2*N',
    normalMeshSegments: 7,
    orbAccelerationMultiplier: 0.980000019,
    orbActiveBranchUpdates: 999,
    orbCountdownTicks: 1_000,
    orbFadeStartAge: 1_000,
    orbFadeScalePerTick: 0.02,
    orbInitialScale: 0.5,
    orbInitialSpeed: 1.75,
    orbScaleGrowthPerTick: 0.01,
  })
  assert.equal(nativeSecondaryAbilityContract(12).audio.at(-1)?.playbackRate, 2)
  assert.deepEqual(nativeSecondaryAbilityContract(21).timing, {
    angleStepDegrees: 12,
    burningManExplosionDamage: '0.5*waveDamage per eligible target',
    burningManExplosionRadius: 165,
    cameraMagnitude: 0.25,
    segmentCount: 30,
    segmentRngWords: 7,
    shockwaveQueryPeriodTicks: 10,
  })
  assert.equal(
    nativeSecondaryAbilityContract(23).audio[0]?.trigger,
    'toggle on; toggle off is silent',
  )
  assert.equal(
    nativeSecondaryAbilityContract(46).audio[1]?.trigger,
    'modifier apply, refresh, and removal callbacks',
  )
  assert.deepEqual(nativeSecondaryAbilityContract(30).timing, {
    childrenPerTick: 3,
    duration: 'mDuration*100',
    emissionTicks: 100,
    rngWordsPerTick: 19,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(45).timing, {
    assemblyMilestones: [0, 50, 100, 200],
    contactEnableAge: 400,
    naturalExpiry: false,
    placementDistance: 100,
    placementMask: '0x205 without actor flag 0x400',
    placementRadius: 25,
    placementRingCount: 'round-even(pi*(searchRadius+25)/searchRadius)',
    placementRingExpansion: 'searchRadius+=multiplier*25; multiplier*=1+Float(1)',
    placementRingGeometry: 'x radius searchRadius; y radius searchRadius*0.8',
  })
  assert.deepEqual(nativeSecondaryAbilityContract(49).timing, {
    effectPeriodTicks: 10,
    firstEffectUpdate: 0,
    lifetimeTicks: 1_500,
    ringChildLossPerTick: 0.05,
    ringChildrenEvenTick: 1,
    ringChildrenOddTick: 2,
  })
  assert.equal(
    nativeSecondaryAbilityContract(49).audio[0]?.trigger,
    'native counter 1498 / Website actor age 2',
  )
  assert.deepEqual(nativeSecondaryAbilityContract(50).timing, {
    armingQueryWidth: 130,
    cameraPulseCutoff: 0.001,
    cameraPulseInitial: 1.25,
    cameraPulseMultiplierPerTick: 0.94,
    damageSelectorSkillIds: [8, 16, 24, 32, 40],
    electricBurnChainCount: 0,
    electricBurnConditionalFloatBound: 0.5,
    electricBurnDamageDivisor: 100,
    electricBurnDurationTicks: 100,
    electricBurnIntegerBound: 3,
    electricBurnLightBaseIntensity: 0.5,
    electricBurnLightRadius: 1,
    electricBurnSignedJitterBound: 0.25,
    etherDamageRangeProperties: ['mDamage1', 'mDamage2'],
    etherDamageRngWords: 1,
    fullPayloadFormula: 'f32(baseDamage * trap mDamage[effective rank])',
    fullChargeTicks: 800,
    nonEtherDamageRngWords: 0,
    payloadQueryWidth: 300,
    shimmerEmissionTicks: 32,
    shimmerRngWordsPerTick: 2,
    terminalPresentationRngWords: 502,
    terminalPayloadFormula: 'f32(fullPayload * charge); no minimum clamp',
    triggerPollPeriodTicks: 25,
    waterSlowDurationTicks: 'max(50,trunc(400*charge))',
    waterSlowFactor: 'f32(0.5 / permafrostSlowScale)',
  })
  assert.deepEqual(nativeSecondaryAbilityContract(50).audio.map(({ event }) => event), [
    'set-trap',
    'magic-missile',
    'throw-fire',
    'lightning-start',
    'ice-start',
    'start-boulder',
    'trap',
    'electric-loop',
  ])
  assert.deepEqual(nativeSecondaryAbilityContract(51).action, {
    mode: 21,
    name: 'Action_PlayerWizard_CastSpin',
    ticks: 73,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(72).timing, {
    activeTicks: 1_500,
    contactDamageFormula: 'f32(mDamage[effective rank] / 6)',
    damagePeriodTicks: 25,
    dropsPerTick: 2,
    enhancedDropsPerTick: 5,
    fieldPassOne: 'world-sorted additive BadGuys[10] at y -175, tint (0.41,0.55,0.32), alpha 0.75*c, rotation a*0.03125*p degrees, scale (5*s,4*s)',
    fieldPassTwo: 'world-sorted source-over BadGuys[10] at y -175-50*s, tint (0.25,0.45,0.15), alpha c, rotation -0.5*a degrees, scale (7.5*s*p,6*s)',
    initialPulseDelayTicks: 50,
    maximumLifetimeTicks: 3_600,
    residuePass: 'pre-world source-over BadGuys[10] at ground root, tint (0.05,0.1,0.05), residue alpha, uniform scale 4.5',
    splashGate: 'Integer(4)==3 after raindrop allocation',
    targetArea: 'strict root-center circle at aimed ground point, radius 200; exact edge excluded; no body-radius expansion',
    targetsPerPulse: 'min(n,floor(n/3)+1)',
  })
  assert.deepEqual(nativeSecondaryAbilityContract(73).timing, {
    contactPeriodTicks: 3,
    lineLength: 300,
    patchCount: 11,
    patchLifetimeScalar: 7,
    patchLifetimeTicks: 700,
    patchSpacing: 30,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(74).timing, {
    activeTicks: 1_000,
    candidateRefreshAgeTicks: '1,18,35,105,205,...,1005',
    childSpawnAgeTicks: '42..990 inclusive (949 ticks)',
    contactDamageTiers: 'd2<400:1x; d2<225:2x; d2<100:4x; target flag 0x1 doubles again',
    contactRngWords: 'one Float(0.5) per hostile dispatch',
    gameplayAgeTicks: '41..990 inclusive (950 ticks)',
    nominalScaleInTicks: 40,
    phases: ['scale-in', 'active', 'scale-out'],
    scaleInTicks: 41,
    scaleOutTicks: 20,
    suckCloudSuccessRngWords: 8,
    suckDebrisRngWordsPerTick: 3,
    suckDebrisSuccessRngWords: 5,
    totalLiveTicks: 1_061,
  })
  assert.deepEqual(nativeSecondaryAbilityContract(76).timing, {
    debrisBounceDamping: 0.65,
    debrisGravity: 0.4,
    debrisLifeDecay: '0.015 on each non-skipped airborne update and every settled update',
    fallTicks: 400,
    impact: 'when actor +0x14C countdown reaches zero',
    impactAdditiveFadeTicks: 500,
    impactRingFadeTicks: 1_000,
    impactTicks: 400,
    queryRadius: 400,
    screenFlash: 'RGBA(1,1,1,1), float32 alpha -0.005; clamps on update 201',
    trailLife: '0.5*(0.5+Float(0.5)); decay 0.025',
    warningPostUpdateTicksRemaining: 174,
  })
  assert.equal(nativeSecondaryAbilityContract(78).audio[0]?.path, 'sounds/mindstar__stream.wav')
  assert.deepEqual(
    nativeSecondaryAbilityContract(79).audio,
    nativeSecondaryAbilityContract(78).audio,
  )

  const serialized = JSON.stringify(NATIVE_SECONDARY_ABILITY_CONTRACTS).toLowerCase()
  for (const forbidden of ['generic', 'placeholder', 'approximate', 'unknown', 'todo', 'tbd']) {
    assert.equal(serialized.includes(forbidden), false, `contract contains ${forbidden}`)
  }
})
