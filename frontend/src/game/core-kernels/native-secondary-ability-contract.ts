import nativeCatalogJson from './native-skill-catalog.json' with { type: 'json' }

export const NATIVE_SECONDARY_ABILITY_IDS = Object.freeze([
  11, 12, 15, 21, 23, 27, 30, 35, 41, 45, 46, 48,
  49, 50, 51, 54, 72, 73, 74, 76, 77, 78, 79,
] as const)

export type NativeSecondaryAbilityId = typeof NATIVE_SECONDARY_ABILITY_IDS[number]

export const NATIVE_SECONDARY_BELT_SLOT_COUNT = 8
export const NATIVE_SECONDARY_RIGHT_MOUSE_SLOT = 0
export const NATIVE_SECONDARY_KEYBOARD_SLOTS = Object.freeze([1, 2, 3, 4, 5, 6, 7] as const)

type NativeSecondaryTimingValue = boolean | number | string | readonly number[] | readonly string[]

export interface NativeSecondaryAudioContract {
  readonly event: string
  readonly path: string
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

function sound(event: string, path: string, trigger: string): NativeSecondaryAudioContract {
  return Object.freeze({ event, path, trigger })
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
    art: ['BadGuys:343..372', 'BadGuys:11,39'],
    audio: audio(
      sound('leviathan-roar', 'sounds/LeviathanRoar__Stream.wav', 'cast creation'),
      sound('plane-cross-loop', 'sounds/PlaneCross__Loop.wav', 'renew while Leviathan is live'),
    ),
    authority: 'Host owns aimed spawn, appendage targeting, EtherBolt damage, and phase clocks.',
    cleanup: 'Scale-out retires Leviathan; bolts finish contact or 100-tick fade; world teardown stops renewal.',
    name: 'Call Leviathan',
    skillId: 11,
    targeting: 'aimed-world-point',
    timing: {
      activeTicks: 1_600,
      boltLifetimeTicks: 100,
      phases: ['scale-in', 'active', 'scale-out'],
      scaleInTicks: 40,
      scaleOutTicks: 25,
    },
  }),
  define({
    action: null,
    art: ['BadGuys:PlaneOrb'],
    audio: audio(
      sound('planewalker-on', 'sounds/planewalker__Stream.wav', 'toggle on'),
      sound('planewalker-off', 'sounds/PlanewalkerOff__Stream.wav', 'toggle off or modifier expiry'),
      sound('plane-cross-loop', 'sounds/PlaneCross__Loop.wav', 'renew while modifier is live'),
    ),
    authority: 'Host installs Mod_Planewalker, saves the previous secondary selection, and forces Plane Orb 80.',
    cleanup: 'Removal clears plane state, restores the saved selection, and stops plane ambience.',
    name: 'Planewalker',
    skillId: 12,
    targeting: 'self',
    timing: { duration: 'mDuration*100' },
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
    art: ['DeadHawg:46..77'],
    audio: audio(
      sound('big-fire', 'sounds/bigfire.wav', 'ring creation'),
      sound('nuke', 'sounds/nuke.wav', 'shockwave creation after fire ring'),
    ),
    authority: 'Host materializes all 30 fire segments and owns unique Shockwave contact and push state.',
    cleanup: 'Segments finish Fire lifetimes; Shockwave retires after expansion and releases target identity.',
    name: 'Ring of Fire',
    skillId: 21,
    targeting: 'caster-center',
    timing: { angleStepDegrees: 12, segmentCount: 30, shockwaveQueryPeriodTicks: 10 },
  }),
  define({
    action: null,
    art: ['DeadHawg:46..77', 'BadGuys:11'],
    audio: audio(
      sound('ignite', 'sounds/ignite.wav', 'toggle on'),
      sound('low-fire-loop', 'sounds/lowfire__loop.wav', 'renew while any patch is live'),
    ),
    authority: 'Host owns toggle reserve and trail patch placement/contact.',
    cleanup: 'Toggle-off stops new patches and removes reserve; existing 200-tick patches finish independently.',
    name: 'Firewalker',
    skillId: 23,
    targeting: 'self-trail',
    timing: { contactPeriodTicks: 3, manaReserve: 50, patchLifetimeTicks: 200 },
  }),
  define({
    action: null,
    art: ['BadGuys:storm-cloud', 'BadGuys:11'],
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
    timing: { activeTicks: 1_000, strikeResetTicks: 'uniform-integer-30..120' },
  }),
  define({
    action: null,
    art: ['BadGuys:10,11'],
    audio: audio(
      sound('prismatic-shock', 'sounds/prismaticspray__stream.wav', 'wave creation'),
      sound('lightning-start', 'sounds/lightningstart.wav', 'modifier application'),
    ),
    authority: 'Host owns the caster rectangle query and target Mod_Prismatic merge.',
    cleanup: 'Wave children self-retire and target modifiers expire through modifier ownership.',
    name: 'Prismatic Shock',
    skillId: 30,
    targeting: 'caster-center-rectangle',
    timing: { duration: 'mDuration*100' },
  }),
  define({
    action: null,
    art: ['DeadHawg:16,17'],
    audio: audio(sound('ring-of-ice', 'sounds/ringofice.wav', 'FreezeWave creation')),
    authority: 'Host owns FreezeWave expansion, ten-tick queries, freeze/damage, and three blast children.',
    cleanup: 'Wave and burst children retire after their expansion and fade programs.',
    name: 'Ring of Ice',
    skillId: 35,
    targeting: 'caster-center',
    timing: { iceBlastCount: 3, queryPeriodTicks: 10 },
  }),
  define({
    action: null,
    art: ['DeadHawg:200..202', 'BadGuys:2008..2010,62'],
    audio: audio(
      sound('earthquake-loop', 'sounds/earthquake__loop.wav', 'renew while quake is live'),
      sound('quake-cracks', 'sounds/QuakeCracks__Stream.wav', 'large crack creation'),
      sound('quake-crack-small', 'sounds/QuakeCrackSmall__Stream.wav', 'small crack creation'),
      sound('rock-hit', 'sounds/rockhit.wav', 'rock impact'),
    ),
    authority: 'Host owns duration, shuffled disruption targets, heading/action mutations, and world shake.',
    cleanup: 'Counter zero retires the actor, clears shake, releases target state, and stops loop renewal.',
    name: 'Earthquake',
    skillId: 41,
    targeting: 'caster-center',
    timing: { disruptPeriodTicks: 30, duration: 'mDuration*100' },
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
      sound('golem-provoke', 'sounds/GolemProvoke__Stream.wav', 'assembled combat activation'),
      sound('quake-crack-small', 'sounds/QuakeCrackSmall__Stream.wav', 'assembly crack'),
      sound('knockback-golem', 'sounds/KnockbackGolem.wav', 'knockback contact'),
      sound('stone-step', 'sounds/stonestep.wav', 'walk marker'),
      sound('golem-die', 'sounds/GolemDie__Stream.wav', 'death'),
      sound('stone-break', 'sounds/stonebreak.wav', 'death fragments'),
      sound('rock-hit', 'sounds/rockhit.wav', 'fragment impact'),
    ),
    authority: 'Host owns collision-adjusted placement, one summon per owner, AI, health, damage, and assembly.',
    cleanup: 'Replacement, owner death/disconnect, or world teardown retires body/AI; registered fragments finish.',
    name: 'Raise Golem',
    skillId: 45,
    targeting: 'collision-adjusted-aimed-world-point',
    timing: { assemblyMilestones: [0, 50, 100, 200], contactEnableAge: 400, naturalExpiry: false },
  }),
  define({
    action: null,
    art: ['Player:stone-material'],
    audio: audio(
      sound('stoneskin-on', 'sounds/StoneSkin__Stream.wav', 'cast application'),
      sound('stoneskin', 'sounds/stoneskin.wav', 'modifier callback and removal presentation'),
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
    art: ['BadGuys:90'],
    audio: audio(sound('teleport', 'sounds/teleport.wav', 'accepted relocation')),
    authority: 'Host resolves a collision-safe destination near aim and commits relocation atomically.',
    cleanup: 'Burst children self-retire; rejected relocation creates no actor.',
    name: 'Teleport',
    skillId: 48,
    targeting: 'safe-relocation-near-aim',
    timing: { cooldown: 'mCooldown*100' },
  }),
  define({
    action: null,
    art: ['BadGuys:48,7'],
    audio: audio(sound('magic-circle', 'sounds/magiccircle.wav', 'circle creation')),
    authority: 'Host owns position, ten-tick slow query, and the live owner MP-recovery branch.',
    cleanup: 'At lifetime zero the circle unregisters; spin-away children finish independently.',
    name: 'Magic Circle',
    skillId: 49,
    targeting: 'aimed-world-point',
    timing: { effectPeriodTicks: 10, lifetimeTicks: 1_500 },
  }),
  define({
    action: null,
    art: ['BadGuys:393..400,16', 'BadGuys:158..167,15'],
    audio: audio(
      sound('set-trap', 'sounds/settrap__Stream.wav', 'trap placement'),
      sound('trap', 'sounds/trap__stream.wav', 'terminal trigger'),
    ),
    authority: 'Host owns charge, 25-tick target polling, element payload, damage, status, and terminal edge.',
    cleanup: 'Trigger removes the trap after children spawn; teardown releases it without replaying trigger effects.',
    name: 'Magic Trap',
    skillId: 50,
    targeting: 'aimed-world-point',
    timing: { fullChargeTicks: 800, triggerPollPeriodTicks: 25 },
  }),
  define({
    action: { mode: 21, name: 'Action_PlayerWizard_CastSpin', ticks: 73 },
    art: ['BadGuys:10,11,48'],
    audio: audio(
      sound('flash', 'sounds/flash.wav', 'accepted cast'),
      sound('dampen', 'sounds/dampen__stream.wav', 'accepted cast before CastSpin presentation'),
    ),
    authority: 'Host owns the caster rectangle, projectile interruption, shield dispel rolls, and action mode.',
    cleanup: 'World children self-retire; cast spin ends only after its strict phase boundary or death.',
    name: 'Dampen',
    skillId: 51,
    targeting: 'caster-center-rectangle',
    timing: { castSpinTicks: 73, shieldDispelPercent: 50 },
  }),
  define({
    action: null,
    art: ['BadGuys:68'],
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
    timing: { hitPulseDecayPerTick: 0.05, hitPulseStart: 2, hitPulseTicks: 40 },
  }),
  define({
    action: null,
    art: ['BadGuys:10,acid-drop'],
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
      damagePeriodTicks: 25,
      dropsPerTick: 2,
      enhancedDropsPerTick: 5,
      targetsPerPulse: 'min(n,floor(n/3)+1)',
    },
  }),
  define({
    action: null,
    art: ['DeadHawg:46..77'],
    audio: audio(
      sound('ignite', 'sounds/ignite.wav', 'wall creation'),
      sound('fireball-hit', 'sounds/fireballhit.wav', 'contact presentation'),
      sound('low-fire-loop', 'sounds/lowfire__loop.wav', 'renew while patches are live'),
    ),
    authority: 'Host builds the aim-perpendicular line and owns every patch contact and lifetime.',
    cleanup: 'Independent patches fade and retire after 200 ticks; final retirement stops low-fire renewal.',
    name: 'Fire Wall',
    skillId: 73,
    targeting: 'line-perpendicular-to-aim',
    timing: {
      contactPeriodTicks: 3,
      lineLength: 300,
      patchCount: 11,
      patchLifetimeTicks: 200,
      patchSpacing: 30,
    },
  }),
  define({
    action: null,
    art: ['DeadHawg:177..179'],
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
      phases: ['scale-in', 'active', 'scale-out'],
      scaleInTicks: 40,
      scaleOutTicks: 20,
    },
  }),
  define({
    action: null,
    art: ['DeadHawg:5,203..207,6', 'BadGuys:51,15'],
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
      countdownStart: 8_000,
      countdownStep: 20,
      impactTicks: 400,
      whistleTicksRemaining: 175,
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
    targeting: 'aimed-area',
    timing: { fleeDuration: 'mFlee*100' },
  }),
  define({
    action: null,
    art: ['Player:activation-flash'],
    audio: MINDSTAR_AUDIO,
    authority: 'Host toggles +0x8DD, owns reserve, and refreshes temporary ranks immediately.',
    cleanup: 'Toggle-off, mana overload, death/session reset, or teardown removes ranks and reserve in one refresh.',
    name: 'Mindstar',
    skillId: 78,
    targeting: 'self',
    timing: { refresh: 'toggle-and-normal-progression-refresh' },
  }),
  define({
    action: null,
    art: ['Player:activation-flash'],
    audio: MINDSTAR_AUDIO,
    authority: 'Host toggles +0x8DE, owns reserve, and applies fixed-update recovery.',
    cleanup: 'Toggle-off, mana overload, death/session reset, or teardown stops healing and reserve immediately.',
    name: 'Regenerate',
    skillId: 79,
    targeting: 'self',
    timing: { healingPerUpdate: '1.5/tickRate', refresh: 'fixed-update-while-active' },
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
