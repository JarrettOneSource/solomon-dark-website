import nativeCatalogJson from './native-skill-catalog.json' with { type: 'json' }

export const NATIVE_SECONDARY_ABILITY_IDS = Object.freeze([
  11, 12, 15, 21, 23, 27, 30, 35, 41, 45, 46, 48,
  49, 50, 51, 54, 72, 73, 74, 76, 77, 78, 79,
] as const)

export type NativeSecondaryAbilityId = typeof NATIVE_SECONDARY_ABILITY_IDS[number]

export const NATIVE_SECONDARY_BELT_SLOT_COUNT = 8
export const NATIVE_SECONDARY_RIGHT_MOUSE_SLOT = 0
export const NATIVE_SECONDARY_KEYBOARD_SLOTS = Object.freeze([1, 2, 3, 4, 5, 6, 7] as const)

type NativeSecondaryTimingValue = boolean | number | string | readonly boolean[] | readonly number[] | readonly string[]

export interface NativeSecondaryAudioContract {
  readonly event: string
  readonly path: string
  readonly playbackRate?: number
  readonly trigger: string
}

export interface NativeSecondaryAbilityContract {
  readonly action: Readonly<{ mode: number; name: string; ticks: number }> | null
  readonly art: readonly string[]
  readonly audio: readonly NativeSecondaryAudioContract[]
  readonly authority: string
  readonly category: 2
  readonly cleanup: string
  readonly name: string
  readonly rank: Readonly<{
    configSha256: string
    manaCost: readonly number[]
    maximumLevel: number
  }>
  readonly skillId: NativeSecondaryAbilityId
  readonly targeting: string
  readonly timing: Readonly<Record<string, NativeSecondaryTimingValue>>
}

interface NativeCatalogRow {
  readonly config: null | Readonly<{
    readonly mHoard?: number | readonly number[]
    readonly mManaCost?: number | readonly number[]
    readonly mMaxLevel?: number
  }>
  readonly config_sha256?: string
  readonly id: number
  readonly name: string
}

type ContractSeed = Omit<NativeSecondaryAbilityContract, 'category' | 'rank'>

const MINDSTAR_AUDIO = audio(
  sound(
    'mindstar',
    'sounds/mindstar__stream.wav',
    'toggle on or off before immediate progression refresh',
  ),
)

function sound(
  event: string,
  path: string,
  trigger: string,
  playbackRate?: number,
): NativeSecondaryAudioContract {
  return Object.freeze({
    event,
    path,
    ...(playbackRate === undefined ? {} : { playbackRate }),
    trigger,
  })
}

function audio(...events: readonly NativeSecondaryAudioContract[]): readonly NativeSecondaryAudioContract[] {
  return Object.freeze(events)
}

function define(seed: ContractSeed): NativeSecondaryAbilityContract {
  const row = (nativeCatalogJson.skills as readonly NativeCatalogRow[])
    .find(({ id }) => id === seed.skillId)
  if (!row || row.name !== seed.name || !row.config) {
    throw new Error(`native secondary skill catalog mismatch for ${seed.skillId}`)
  }
  const maximumLevel = row.config.mMaxLevel
  const configuredCost = row.config.mManaCost ?? row.config.mHoard
  const manaCost = typeof configuredCost === 'number'
    ? [0, configuredCost]
    : configuredCost
  if (!Number.isInteger(maximumLevel) || maximumLevel! < 1 || !manaCost?.length) {
    throw new Error(`native secondary rank schedule is incomplete for ${seed.skillId}`)
  }
  if (!row.config_sha256) {
    throw new Error(`native secondary config provenance is missing for ${seed.skillId}`)
  }
  return Object.freeze({
    ...seed,
    art: Object.freeze([...seed.art]),
    audio: Object.freeze([...seed.audio]),
    category: 2,
    rank: Object.freeze({
      configSha256: row.config_sha256,
      manaCost: Object.freeze([...manaCost]),
      maximumLevel: maximumLevel!,
    }),
    timing: Object.freeze({ ...seed.timing }),
  })
}

export const NATIVE_SECONDARY_ABILITY_CONTRACTS: readonly NativeSecondaryAbilityContract[] = Object.freeze([
  define({
    action: null,
    art: [
      'BadGuys:343..372',
      'BadGuys:39',
      'BadGuys:11',
      'BadGuys:22',
      'procedural:Ether FadeMM',
    ],
    audio: audio(
      sound('leviathan-roar', 'sounds/LeviathanRoar__Stream.wav', 'cast creation'),
      sound('plane-cross-loop', 'sounds/PlaneCross__Loop.wav', 'renew while Leviathan is live'),
    ),
    authority: 'Host owns aimed spawn, appendage targeting, EtherBolt damage, and phase clocks.',
    cleanup: 'Age 1664 retires Leviathan after the active/fade overlap; EtherBolts retain contact through 101 fade updates and retire on contact or update 200; FadeMM and enhanced motes finish independently; world teardown stops renewal.',
    name: 'Call Leviathan',
    skillId: 11,
    targeting: 'aimed-world-point',
    timing: {
      activeTicks: 1_600,
      activeAgeTicks: '41..1640 inclusive (1600 updates)',
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
    },
  }),
  define({
    action: null,
    art: ['BadGuys:75', 'images:etherplane.png', 'BadGuys:11,45', 'BadGuys:11'],
    audio: audio(
      sound('planewalker-on', 'sounds/planewalker__Stream.wav', 'toggle on'),
      sound('planewalker-off', 'sounds/PlanewalkerOff__Stream.wav', 'toggle off or modifier expiry'),
      sound('plane-cross-loop', 'sounds/PlaneCross__Loop.wav', 'renew while modifier is live'),
      sound('distort-reality', 'sounds/distortreality.wav', 'each Plane Orb birth'),
      sound('lightning-start', 'sounds/lightningstart.wav', 'each Plane Orb birth', 2),
    ),
    authority: 'Host installs Mod_Planewalker, preserves the configured primary selection, and overrides primary casting with Plane Orb 80 while active.',
    cleanup: 'Removal clears plane state, restores the saved selection, and stops plane ambience; orbs shrink after countdown and registered perspective children finish independently.',
    name: 'Planewalker',
    skillId: 12,
    targeting: 'self',
    timing: {
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
    },
  }),
  define({
    action: null,
    art: ['BadGuys:53'],
    audio: audio(sound('phase', 'sounds/phase.wav', 'accepted traversal')),
    authority: 'Host performs the heading-aligned collision probe and commits only its accepted destination.',
    cleanup: 'Traversal art self-retires; rejected probes leave no persistent actor.',
    name: 'Phasing',
    skillId: 15,
    targeting: 'aim-heading-forward-probe',
    timing: { cooldown: 'mCooldown*100', probeLimit: 20 },
  }),
  define({
    action: null,
    art: [
      'DeadHawg:46..77',
      'DeadHawg:18',
      'BadGuys:15,251..254,267..270',
      'BadGuys:333..342',
    ],
    audio: audio(
      sound('big-fire', 'sounds/bigfire.wav', 'ring creation'),
      sound('nuke', 'sounds/nuke.wav', 'shockwave creation after fire ring'),
    ),
    authority: 'Host materializes all 30 fire segments, owns unique Shockwave contact and push state, emits Region camera magnitude 0.25, and applies Burning-Man contact explosions.',
    cleanup: 'Segments finish Fire lifetimes; Shockwave retires after expansion and releases target identity.',
    name: 'Ring of Fire',
    skillId: 21,
    targeting: 'caster-center',
    timing: {
      angleStepDegrees: 12,
      burningManExplosionDamage: '0.5*waveDamage per eligible target',
      burningManExplosionRadius: 165,
      cameraMagnitude: 0.25,
      segmentCount: 30,
      segmentRngWords: 7,
      shockwaveQueryPeriodTicks: 10,
    },
  }),
  define({
    action: null,
    art: ['DeadHawg:46..77', 'BadGuys:333..342'],
    audio: audio(
      sound('ignite', 'sounds/ignite.wav', 'toggle on; toggle off is silent'),
      sound('low-fire-loop', 'sounds/lowfire__loop.wav', 'renew while any patch is live'),
    ),
    authority: 'Host owns toggle reserve and trail patch placement/contact.',
    cleanup: 'Toggle-off stops new patches and removes reserve; existing patches finish their independently randomized rank-duration lifecycles.',
    name: 'Firewalker',
    skillId: 23,
    targeting: 'self-trail',
    timing: {
      activationPatch: 'immediate; contact geometry forced on; does not advance periodic global cycle',
      constructionRngWords: 7,
      contactPeriodTicks: 3,
      manaReserve: 50,
      patchLifetime: 'mDuration*(1.1-RandomFloat(0.25)); float32 -0.01/tick',
      periodicContactGeometryCycle: [true, false, false],
      periodicPatchGlobalTicks: 10,
    },
  }),
  define({
    action: null,
    art: [
      'BadGuys:0,11,78,84',
      'procedural:width-2 blue-white gradient',
      'render_target:three BadGuys-78 passes plus moving and white-mask branches',
    ],
    audio: audio(
      sound('magic-storm', 'sounds/magicstorm.wav', 'cloud creation'),
      sound('lightning-start', 'sounds/lightningstart.wav', 'strike creation'),
      sound('thunder', 'sounds/thunder__Stream.wav', 'strike presentation'),
      sound('rainfall-loop', 'sounds/rainfall__loop.wav', 'renew while cloud is live'),
      sound('steady-wind-loop', 'sounds/steadywind__loop.wav', 'renew while cloud is live'),
    ),
    authority: 'Host owns cloud RNG, target queries, lightning contacts, and fade transition.',
    cleanup: 'After active lifetime the cloud fades, stops queries, retires, and releases both ambient loops.',
    name: 'Magic Storm',
    skillId: 27,
    targeting: 'aimed-world-point',
    timing: {
      activeTicks: 1_000,
      tempestActiveTicks: 2_000,
      ambientFlashRoll: 'RandomInt(1000)==3 every tick; winner consumes Float(0.35)',
      constructorRngDraws: 31,
      dropsPerTick: 2,
      enhancedDropsPerTick: 5,
      enhancedTornadoDropsPerTick: 2,
      fadePerTick: 0.01,
      fadeTicks: 101,
      firstStrikeTicks: 50,
      flashDecayPerTick: 0.100000001,
      queryRadius: 500,
      strikeResetTicks: 'uniform integer 30..120 divided by tornado frequency factor',
      tornadoConstructorRngDraws: 32,
      tornadoDropsPerTick: 1,
      tornadoMovementPerTick: 0.349999994,
    },
  }),
  define({
    action: null,
    art: ['BadGuys:58', 'BadGuys:111', 'BadGuys:10,11'],
    audio: audio(
      sound('prismatic-shock', 'sounds/prismaticspray__stream.wav', 'wave creation'),
      sound('lightning-start', 'sounds/lightningstart.wav', 'modifier application at pitch 0.8'),
    ),
    authority: 'Host owns the immediate caster radius-350 query, target Mod_Prismatic merge, and exact 19-word visual emission cadence.',
    cleanup: 'The spray retires after 100 emission ticks; independently registered children and target modifiers finish through their own ownership.',
    name: 'Prismatic Shock',
    skillId: 30,
    targeting: 'caster-center-radius-350',
    timing: { childrenPerTick: 3, duration: 'mDuration*100', emissionTicks: 100, rngWordsPerTick: 19 },
  }),
  define({
    action: null,
    art: [
      'DeadHawg:114,121',
      'BadGuys:72',
      'target-material:Frozen and ColdSlow',
      'BadGuys:10,11 FrostBurn',
    ],
    audio: audio(sound('ring-of-ice', 'sounds/ringofice.wav', 'FreezeWave creation')),
    authority: 'Host owns FreezeWave expansion, ten-tick queries, Frozen/ColdSlow clocks and material, FrostBurn damage/source, and three blast children.',
    cleanup: 'Wave and burst children retire after their expansion and fade programs.',
    name: 'Ring of Ice',
    skillId: 35,
    targeting: 'caster-center',
    timing: {
      enhancedWhirlSnowCount: 200,
      frostBurnDamagePerTick: 0.01,
      frostBurnDuration: 'freezeTicks*100',
      frozenThawTicks: 200,
      frozenTimeScalePerTick: 0.005,
      iceBlastCount: 3,
      initialLife: 0.924,
      initialRadius: 75,
      lifePerTick: 0.01,
      lifetimeTicks: 93,
      maximumChildLifetimeTicks: 175,
      normalWhirlSnowCount: 100,
      presentationRngDraws: '3+8*N (803 normal, 1603 enhanced)',
      queryPeriodTicks: 10,
      radiusPerTick: 6,
    },
  }),
  define({
    action: null,
    art: ['DeadHawg:200..202', 'BadGuys:62', 'BadGuys:10', 'BadGuys:2008..2010'],
    audio: audio(
      sound('earthquake-loop', 'sounds/earthquake__loop.wav', 'renew while quake is live'),
      sound('rock-hit', 'sounds/rockhit.wav', 'first live update before the large crack'),
      sound('quake-cracks', 'sounds/QuakeCracks__Stream.wav', 'large crack creation'),
      sound('quake-crack-small', 'sounds/QuakeCrackSmall__Stream.wav', 'small crack creation'),
    ),
    authority: 'Host owns duration, shuffled disruption targets, heading/action mutations, and world shake.',
    cleanup: 'Counter zero retires the actor, clears shake, releases target state, and stops loop renewal.',
    name: 'Earthquake',
    skillId: 41,
    targeting: 'caster-center',
    timing: {
      disruptClock: 'post-decrement remaining % 30 == 0',
      disruptPeriodTicks: 30,
      duration: 'mDuration*100',
      enhancedDustLifetimeTicks: 360,
      floorPhasePerTick: 0.05,
      floorPhaseStart: -5,
      floorThresholds: [0.6, 3],
      quakeChildLifetimeTicks: 180,
    },
  }),
  define({
    action: null,
    art: [
      'Golem:1..208',
      'BadGuys:15,36,62,86,238..245,2008..2010',
      'DeadHawg:78..87',
      'UI:23',
    ],
    audio: audio(
      sound('quake-crack-small', 'sounds/QuakeCrackSmall__Stream.wav', 'assembly crack'),
      sound('golem-provoke', 'sounds/GolemProvoke__Stream.wav', 'assembled combat activation'),
      sound('knockback-golem', 'sounds/KnockbackGolem.wav', 'knockback contact'),
      sound('stone-step', 'sounds/stonestep.wav', 'walk marker'),
      sound('stone-break', 'sounds/stonebreak.wav', 'death sequence first: fragment release'),
      sound('flame-lash-start', 'sounds/flamelashstart.wav', 'death sequence second'),
      sound('golem-die', 'sounds/GolemDie__Stream.wav', 'death sequence third'),
      sound('rock-hit', 'sounds/rockhit.wav', 'death sequence fourth and assembly impact'),
    ),
    authority: 'Host owns collision-adjusted placement, one summon per owner, AI, health, damage, and assembly.',
    cleanup: 'Replacement, owner death/disconnect, or world teardown retires body/AI; registered fragments finish.',
    name: 'Raise Golem',
    skillId: 45,
    targeting: 'collision-adjusted-aimed-world-point',
    timing: {
      assemblyMilestones: [0, 50, 100, 200],
      contactEnableAge: 400,
      naturalExpiry: false,
      placementDistance: 100,
      placementMask: '0x205 without actor flag 0x400',
      placementRadius: 25,
      placementRingCount: 'round-even(pi*(searchRadius+25)/searchRadius)',
      placementRingExpansion: 'searchRadius+=multiplier*25; multiplier*=1+Float(1)',
      placementRingGeometry: 'x radius searchRadius; y radius searchRadius*0.8',
    },
  }),
  define({
    action: null,
    art: ['player:actor flag 0x1 material treatment'],
    audio: audio(
      sound('stoneskin-on', 'sounds/StoneSkin__Stream.wav', 'cast application'),
      sound('stoneskin', 'sounds/stoneskin.wav', 'modifier apply, refresh, and removal callbacks'),
    ),
    authority: 'Host installs or max-merges Mod_StoneSkin and blocks native magic/physical damage lanes.',
    cleanup: 'Expiry or teardown clears invulnerability and stone material once.',
    name: 'Stoneskin',
    skillId: 46,
    targeting: 'self',
    timing: { duration: 'mDuration*100' },
  }),
  define({
    action: null,
    art: ['BadGuys:90', 'BadGuys:90'],
    audio: audio(
      sound('teleport', 'sounds/teleport.wav', 'source burst creation'),
      sound('teleport', 'sounds/teleport.wav', 'destination burst creation'),
    ),
    authority: 'Arena ignores aim, shuffles the 100-unit inset lattice, chooses the first maximum actor-distance score, and collision-adjusts it; indoor Regions return their fixed origin.',
    cleanup: 'The source and destination FadeScale children each self-retire after 20 ticks.',
    name: 'Teleport',
    skillId: 48,
    targeting: 'arena-farthest-lattice-or-region-origin',
    timing: {
      burstAlpha: '2-0.1 per fixed tick',
      burstLifetimeTicks: 20,
      cooldown: 'mCooldown*100',
      destinationScale: '8*0.96 per fixed tick',
      sourceScale: '1*1.1 per fixed tick',
    },
  }),
  define({
    action: null,
    art: ['BadGuys:48', 'BadGuys:7'],
    audio: audio(sound(
      'magic-circle',
      'sounds/magiccircle.wav',
      'native counter 1498 / Website actor age 2',
    )),
    authority: 'Host owns position, immediate/ten-tick slow and MP pulses, exact ring RNG cadence, and the flickering shadow-casting Region light.',
    cleanup: 'At native lifetime zero the circle unregisters; centered record-48 spin-away and player-attached record-7 children finish independently.',
    name: 'Magic Circle',
    skillId: 49,
    targeting: 'aimed-world-point',
    timing: {
      effectPeriodTicks: 10,
      firstEffectUpdate: 0,
      lifetimeTicks: 1_500,
      ringChildLossPerTick: 0.05,
      ringChildrenEvenTick: 1,
      ringChildrenOddTick: 2,
    },
  }),
  define({
    action: null,
    art: [
      'BadGuys:111,112,15,85',
      'BadGuys:16',
      'BadGuys:158..167,15,17,74',
      'BadGuys:333..342',
    ],
    audio: audio(
      sound('set-trap', 'sounds/settrap__Stream.wav', 'trap placement'),
      sound('magic-missile', 'sounds/magicmissile.wav', 'Magic-bound trap placement after set-trap'),
      sound('throw-fire', 'sounds/throwfire.wav', 'Fire-bound trap placement after set-trap'),
      sound('lightning-start', 'sounds/lightningstart.wav', 'Lightning-bound trap placement after set-trap'),
      sound('ice-start', 'sounds/icestart.wav', 'Ice-bound trap placement after set-trap'),
      sound('start-boulder', 'sounds/startboulder.wav', 'Earth-bound trap placement after set-trap'),
      sound('trap', 'sounds/trap__stream.wav', 'terminal trigger'),
      sound('electric-loop', 'sounds/electric__loop.wav', 'while an air-selector target ElectricBurn is live'),
    ),
    authority: 'Host selects the weld component first, resolves that selector\'s effective-rank primary damage, consumes the Ether-only inclusive range draw, stores the float32 trap payload, then owns charge, both queries, modifiers, shimmer RNG, and the terminal edge. Air attaches one target-owned 100-update ElectricBurn with exact per-update RNG and damage.',
    cleanup: 'Trigger removes the parent after independent shimmer and 502-word terminal children spawn. ElectricBurn merges by maximum remaining duration with replacement payload; its light and loop cease on modifier retirement.',
    name: 'Magic Trap',
    skillId: 50,
    targeting: 'aimed-world-point',
    timing: {
      armingQueryWidth: 130,
      damageSelectorSkillIds: [8, 16, 24, 32, 40],
      etherDamageRangeProperties: ['mDamage1', 'mDamage2'],
      etherDamageRngWords: 1,
      nonEtherDamageRngWords: 0,
      fullPayloadFormula: 'f32(baseDamage * trap mDamage[effective rank])',
      terminalPayloadFormula: 'f32(fullPayload * charge); no minimum clamp',
      waterSlowFactor: 'f32(0.5 / permafrostSlowScale)',
      waterSlowDurationTicks: 'max(50,trunc(400*charge))',
      fullChargeTicks: 800,
      payloadQueryWidth: 300,
      electricBurnChainCount: 0,
      electricBurnConditionalFloatBound: 0.5,
      electricBurnDamageDivisor: 100,
      electricBurnDurationTicks: 100,
      electricBurnIntegerBound: 3,
      electricBurnLightBaseIntensity: 0.5,
      electricBurnLightRadius: 1,
      electricBurnSignedJitterBound: 0.25,
      cameraPulseCutoff: 0.001,
      cameraPulseInitial: 1.25,
      cameraPulseMultiplierPerTick: 0.94,
      shimmerEmissionTicks: 32,
      shimmerRngWordsPerTick: 2,
      terminalPresentationRngWords: 502,
      triggerPollPeriodTicks: 25,
    },
  }),
  define({
    action: { mode: 21, name: 'Action_PlayerWizard_CastSpin', ticks: 73 },
    art: ['BadGuys:10,11', 'BadGuys:48'],
    audio: audio(
      sound('flash', 'sounds/flash.wav', 'accepted cast'),
      sound('dampen', 'sounds/dampen__stream.wav', 'accepted cast before CastSpin presentation'),
    ),
    authority: 'Host owns the caster rectangle, projectile interruption, shield dispel rolls, and action mode.',
    cleanup: 'World children self-retire; cast spin ends only after its strict phase boundary or death.',
    name: 'Dampen',
    skillId: 51,
    targeting: 'caster-center-rectangle',
    timing: {
      additiveChildren: 30,
      castSpinTicks: 73,
      moveFadeChildren: 360,
      shieldDispelDenominator: 100,
      shieldDispelNumerator: 51,
      visualRngWords: 2_970,
    },
  }),
  define({
    action: null,
    art: [
      'BadGuys:49',
      'BadGuys:68',
      'BadGuys:15',
      'DeadHawg:2',
      'BadGuys:158..167',
      'BadGuys:17,74',
      'DeadHawg:18',
    ],
    audio: audio(
      sound('magic-shield-up', 'sounds/magicshieldup.wav', 'shield installation'),
      sound('hit-shield', 'sounds/hitshield.wav', 'absorbed contact'),
      sound('pop-shield', 'sounds/popshield.wav', 'break before particles'),
      sound('magic-shield-explode', 'sounds/magicshieldexplode.wav', 'explosive break contact'),
    ),
    authority: 'Host owns absorb amount, hit pulse, break edge, twenty particles, and optional explosion contact.',
    cleanup: 'Break clears absorb/explosion after one event; death/disconnect/world teardown clears residual pulse.',
    name: 'Magic Shield',
    skillId: 54,
    targeting: 'self',
    timing: {
      breakChildren: 20,
      breakRngWords: 60,
      cameraPulseDecayPerTick: 0.94,
      cameraPulseInitial: 1.25,
      explosionContactRadius: 110,
      explosionVisualRngWords: 502,
      fuzzySpearChildren: 100,
      hitPulseDecayPerTick: 0.05,
      hitPulseStart: 2,
      hitPulseTicks: 40,
      shockwaveFadeThreshold: 0.0375,
      shockwaveInitialLife: 0.35,
      shockwaveInitialRadius: 75,
      shockwaveRadiusPerTick: 6,
      spriteArrayFrameRates: [0.15, 0.225],
    },
  }),
  define({
    action: null,
    art: ['BadGuys:0,10', 'procedural:width-3 green-blue gradient'],
    audio: audio(
      sound('magic-storm', 'sounds/magicstorm.wav', 'accepted cast'),
      sound('acid-sizzle', 'sounds/acidsizzle.wav', 'damage and residue pulses with native pitch'),
      sound('rainfall-loop', 'sounds/rainfall__loop.wav', 'renew through active and residue ownership'),
    ),
    authority: 'Host owns shuffled target selection, direct damage, drop identity, active clock, and residue.',
    cleanup: 'Actor retires only after active lifetime and residue fade; loop renewal ends with residue ownership.',
    name: 'Acid Rain',
    skillId: 72,
    targeting: 'aimed-world-point',
    timing: {
      activeTicks: 1_500,
      contactDamageFormula: 'f32(mDamage[effective rank] / 6)',
      damagePeriodTicks: 25,
      dropsPerTick: 2,
      enhancedDropsPerTick: 5,
      fieldPassOne: 'additive BadGuys[10] tint (0.41,0.55,0.32), alpha 0.75*g, rotation a*0.03125*p degrees, scale (5*s,4*s)',
      fieldPassTwo: 'source-over BadGuys[10] tint (0.25,0.45,0.15), alpha g, rotation -0.5*a degrees, y -50*s, scale (7.5*s*p,6*s)',
      initialPulseDelayTicks: 50,
      maximumLifetimeTicks: 3_600,
      residuePass: 'source-over BadGuys[10] tint (0.05,0.1,0.05), rain alpha, uniform scale 4.5',
      splashGate: 'Integer(4)==3 after raindrop allocation',
      targetsPerPulse: 'min(n,floor(n/3)+1)',
    },
  }),
  define({
    action: null,
    art: ['DeadHawg:46..77', 'BadGuys:333..342'],
    audio: audio(
      sound('ignite', 'sounds/ignite.wav', 'wall creation'),
      sound('fireball-hit', 'sounds/fireballhit.wav', 'contact presentation'),
      sound('low-fire-loop', 'sounds/lowfire__loop.wav', 'renew while patches are live'),
    ),
    authority: 'Host builds the aim-perpendicular line and owns every patch contact and lifetime.',
    cleanup: 'Independent patches fade and retire after 700 ticks; final retirement stops low-fire renewal.',
    name: 'Fire Wall',
    skillId: 73,
    targeting: 'line-perpendicular-to-aim',
    timing: {
      contactPeriodTicks: 3,
      lineLength: 300,
      patchCount: 11,
      patchLifetimeScalar: 7,
      patchLifetimeTicks: 700,
      patchSpacing: 30,
    },
  }),
  define({
    action: null,
    art: [
      'BadGuys:75',
      'BadGuys:38',
      'BadGuys:10..11',
      'DeadHawg:177..179',
      'BadGuys:36',
      'region_light:radius 2',
    ],
    audio: audio(
      sound('distort-reality', 'sounds/distortreality.wav', 'field creation'),
      sound('lightning-start', 'sounds/lightningstart.wav', 'drain contact'),
      sound('plane-cross-loop', 'sounds/PlaneCross__Loop.wav', 'renew while field is live'),
      sound('steady-wind-loop', 'sounds/steadywind__loop.wav', 'renew while field is live'),
    ),
    authority: 'Host owns scale phases, both target arrays, drain contacts, active clock, and cell lists.',
    cleanup: 'Scale-out precedes retirement; teardown releases arrays/cells and registered children finish.',
    name: 'Ether Drain',
    skillId: 74,
    targeting: 'aimed-world-point',
    timing: {
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
    },
  }),
  define({
    action: null,
    art: [
      'DeadHawg:5',
      'BadGuys:51,15',
      'DeadHawg:203..207,6',
      'region_overlay:white full-screen rectangle',
    ],
    audio: audio(
      sound('comet-loop', 'sounds/comet__loop.wav', 'renew while comet is airborne'),
      sound('comet-whistle', 'sounds/cometwhistle.wav', 'late fall countdown'),
      sound('explode-steam', 'sounds/explodesteam.wav', 'impact layer one'),
      sound('magic-shield-explode', 'sounds/magicshieldexplode.wav', 'impact layer two'),
      sound('big-fire', 'sounds/bigfire.wav', 'impact layer three'),
      sound('ring-of-ice', 'sounds/ringofice.wav', 'FreezeWave impact layer'),
    ),
    authority: 'Host owns countdown, fall path, terminal damage/freeze query, FreezeWave, and world color.',
    cleanup: 'Impact restores world color, stops loop renewal, and leaves registered debris/wave children to finish.',
    name: 'Call Comet',
    skillId: 76,
    targeting: 'aimed-world-point',
    timing: {
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
    },
  }),
  define({
    action: null,
    art: ['BadGuys:48'],
    audio: audio(
      sound('level-up', 'sounds/levelup.wav', 'cast start at pitch 2'),
      sound('level-up', 'sounds/levelup.wav', 'cast completion at pitch 3'),
    ),
    authority: 'Host filters Skeleton, Archer, Mage, and Zombie and installs their flee deadline.',
    cleanup: 'Burst self-retires; each target resumes ordinary behavior when flee expires or it dies.',
    name: 'Turn Undead',
    skillId: 77,
    targeting: 'caster-center',
    timing: { fleeDuration: 'mFlee*100 fixed ticks' },
  }),
  define({
    action: null,
    art: ['Region:cyan point-gain feedback'],
    audio: MINDSTAR_AUDIO,
    authority: 'Host toggles +0x8DD, owns reserve, and refreshes temporary ranks immediately.',
    cleanup: 'Toggle-off, mana overload, death/session reset, or teardown removes ranks and reserve in one refresh.',
    name: 'Mindstar',
    skillId: 78,
    targeting: 'self',
    timing: { refresh: 'immediate on toggle and every normal progression refresh' },
  }),
  define({
    action: null,
    art: ['Region:orange point-gain feedback'],
    audio: MINDSTAR_AUDIO,
    authority: 'Host toggles +0x8DE, owns reserve, and applies fixed-update recovery.',
    cleanup: 'Toggle-off, mana overload, death/session reset, or teardown stops healing and reserve immediately.',
    name: 'Regenerate',
    skillId: 79,
    targeting: 'self',
    timing: { healingPerUpdate: '1.5/tickRate', refresh: 'fixed update while active' },
  }),
])

const CONTRACTS_BY_ID = new Map(
  NATIVE_SECONDARY_ABILITY_CONTRACTS.map((contract) => [contract.skillId, contract]),
)

export function nativeSecondaryAbilityContract(
  skillId: NativeSecondaryAbilityId,
): NativeSecondaryAbilityContract {
  const contract = CONTRACTS_BY_ID.get(skillId)
  if (!contract) throw new RangeError(`skill ${skillId} is not a native secondary ability`)
  return contract
}

export function isNativeSecondaryAbilityId(skillId: number): skillId is NativeSecondaryAbilityId {
  return CONTRACTS_BY_ID.has(skillId as NativeSecondaryAbilityId)
}
