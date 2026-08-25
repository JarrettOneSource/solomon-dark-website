import {
  EQUIPMENT_SLOTS,
  HUB_ITEM_KINDS,
  type EquipmentSlot,
  type HubItemKind,
} from '../../core-kernels/hub-economy.ts'
import { GAME_RUN_PHASES } from '../../core-kernels/game-run.ts'
import {
  createNativeEquipmentModifiers,
  type NativeEquipmentModifiers,
} from '../../core-kernels/native-equipment-effects.ts'
import {
  NATIVE_SECONDARY_ABILITY_IDS,
  type NativeSecondaryAbilityId,
} from '../../core-kernels/native-secondary-ability-contract.ts'
import {
  NATIVE_SECONDARY_ACTOR_KINDS,
  type NativeSecondaryActorKind,
} from '../../core-kernels/native-secondary-abilities.ts'
import { PLAYER_LIFE_STATES } from '../../core-kernels/player-combat.ts'
import type { NativePlayerPrimarySkillId } from '../../core-kernels/player-progression.ts'
import { BONEYARD_SOLOMON_PHASES } from '../../core-kernels/boneyard-encounter.ts'
import { BONEYARD_WAVE_DIRECTOR_PHASES } from '../../core-kernels/boneyard-wave-director.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardWaveEnemyToken,
} from '../../core-kernels/boneyard-wave-schema.ts'
import type {
  BoneyardEnemyBrain,
  BoneyardEnemyProjectileKind,
} from '../boneyard-enemy-store.ts'

type EnemyFamily = BoneyardEnemyBrain['family']
type EnemyBrainFor<F extends EnemyFamily> = Extract<BoneyardEnemyBrain, { family: F }>
type EnemyPolicyPhase =
  | 'approach'
  | 'clocked-attack'
  | 'cooldown'
  | 'dormant'
  | 'knockback'
  | 'open'
  | 'opening'
  | 'orbit'
  | 'range-control'
  | null

type EnemyPhaseMap = {
  readonly [F in EnemyFamily]: Readonly<Record<EnemyBrainFor<F>['phase'], EnemyPolicyPhase>>
}

export const ML_BOT_POLICY_ENEMY_PHASE_MAP = Object.freeze({
  archer: Object.freeze({
    attack: 'clocked-attack',
    death: null,
    'range-control': 'range-control',
  }),
  coffin: Object.freeze({
    death: null,
    hidden: 'dormant',
    holding: 'dormant',
    open: 'open',
    opening: 'opening',
    rising: 'dormant',
  }),
  demon: Object.freeze({ approach: 'approach', bomb: 'clocked-attack', death: null }),
  imp: Object.freeze({
    death: null,
    flight: 'approach',
  }),
  mage: Object.freeze({ cast: 'clocked-attack', death: null, 'range-control': 'range-control' }),
  skeleton: Object.freeze({ approach: 'approach', attack: 'clocked-attack', death: null }),
  wraith: Object.freeze({
    approach: 'approach',
    cooldown: 'cooldown',
    death: null,
    drain: 'clocked-attack',
    orbit: 'orbit',
  }),
  zombie: Object.freeze({
    approach: 'approach',
    death: null,
    knockback: 'knockback',
    swipe: 'clocked-attack',
  }),
}) satisfies EnemyPhaseMap

export const ML_BOT_POLICY_ENEMY_TOKEN_SPECIES = Object.freeze({
  COFFIN: 'coffin',
  DEMON: 'demon',
  IMP: 'imp',
  SKELETON: 'skeleton',
  SKELETONARCHER: 'archer',
  SKELETONMAGE: 'mage',
  WRAITH: 'wraith',
  ZOMBIE: 'zombie',
}) satisfies Readonly<Record<BoneyardWaveEnemyToken, EnemyFamily>>

export const ML_BOT_POLICY_WAVE_PHASES = Object.freeze({
  dormant: 'wave_phase_dormant',
  interwave: 'wave_phase_interwave',
  opening: 'wave_phase_opening',
  'opening-threshold': 'wave_phase_opening_threshold',
  spawning: 'wave_phase_spawning',
  'wave-lull': 'wave_phase_wave_lull',
  'wave-lull-delay': 'wave_phase_wave_lull_delay',
  'wave-threshold': 'wave_phase_wave_threshold',
}) satisfies Readonly<Record<typeof BONEYARD_WAVE_DIRECTOR_PHASES[number], string>>

export const ML_BOT_POLICY_SOLOMON_PHASES = Object.freeze({
  digging: false,
  escaping: false,
  gone: false,
  'retreat-accelerating': false,
  'retreat-hold': false,
  speaking: true,
  turning: true,
}) satisfies Readonly<Record<typeof BONEYARD_SOLOMON_PHASES[number], boolean>>

export const ML_BOT_POLICY_ITEM_CLASSES = Object.freeze({
  antidote: 'potion',
  dye: 'misc',
  equipment: 'equipment',
  'health-potion': 'potion',
  key: 'key',
  'mana-potion': 'potion',
  'mind-chug': 'potion',
  'mod-item': 'misc',
  'mod-potion': 'potion',
  'rejuvenation-potion': 'potion',
  sack: 'sack',
  'skill-book': 'misc',
  'wizard-chug': 'potion',
}) satisfies Readonly<Record<HubItemKind, 'equipment' | 'key' | 'misc' | 'potion' | 'sack'>>

export const ML_BOT_POLICY_EQUIPMENT_SLOT_NAMES = Object.freeze({
  amulet: 'amulet',
  hat: 'hat',
  'ring-0': 'ring_1',
  'ring-1': 'ring_2',
  'ring-2': 'ring_3',
  robe: 'robe',
  weapon: 'weapon',
}) satisfies Readonly<Record<EquipmentSlot, string>>

export const ML_BOT_POLICY_SECONDARY_SKILLS = Object.freeze(Object.fromEntries(
  NATIVE_SECONDARY_ABILITY_IDS.map((skillId) => [skillId, true]),
)) as Readonly<Record<NativeSecondaryAbilityId, true>>

export const ML_BOT_POLICY_PRIMARY_SKILLS = Object.freeze({
  8: 'ether',
  16: 'fire',
  24: 'air',
  32: 'water',
  40: 'earth',
  52: 'weld',
}) satisfies Readonly<Record<NativePlayerPrimarySkillId, 'air' | 'earth' | 'ether' | 'fire' | 'water' | 'weld'>>

export const ML_BOT_POLICY_EQUIPMENT_MODIFIER_FAMILIES = Object.freeze({
  castSpeedFlat: 'mobility',
  castSpeedMultiplier: 'mobility',
  classCastSpeedFlat: 'mobility',
  classCastSpeedMultiplier: 'mobility',
  classDamageFlat: 'offense',
  classDamageMultiplier: 'offense',
  classManaCostFlat: 'resource',
  classManaCostMultiplier: 'resource',
  classRecharge: 'resource',
  damageResistance: 'defense',
  featureBits: 'feature',
  globalDamageFlat: 'offense',
  globalDamageMultiplier: 'offense',
  globalManaCostFlat: 'resource',
  globalManaCostMultiplier: 'resource',
  goldMultiplier: 'mobility',
  healthRecovery: 'resource',
  magicResistance: 'defense',
  manaRecovery: 'resource',
  maximumHealth: 'defense',
  maximumMana: 'resource',
  meleeDamageFlat: 'offense',
  meleeDamageMultiplier: 'offense',
  orbPullMultiplier: 'mobility',
  poisonResistance: 'defense',
  recharge: 'resource',
  skillDamageFlat: 'offense',
  skillDamageMultiplier: 'offense',
  walkSpeed: 'mobility',
  weldEffect: 'offense',
}) satisfies Readonly<Record<keyof NativeEquipmentModifiers,
  'defense' | 'feature' | 'mobility' | 'offense' | 'resource'>>

type SecondaryActorClass = 'effect' | 'minion' | 'presentation' | 'status-carrier'

export const ML_BOT_POLICY_SECONDARY_ACTOR_CLASSES = Object.freeze({
  'acid-drop': 'presentation',
  'acid-rain': 'effect',
  'acid-splash': 'presentation',
  comet: 'effect',
  'comet-debris': 'presentation',
  'comet-impact': 'presentation',
  'comet-trail': 'presentation',
  'dampen-wave': 'effect',
  'earthquake': 'effect',
  'earthquake-debris': 'presentation',
  'earthquake-dust': 'presentation',
  'earthquake-quake': 'presentation',
  'earthquake-scenery-wobble': 'presentation',
  'electric-burn': 'status-carrier',
  'ether-bolt': 'effect',
  'ether-burn': 'status-carrier',
  'ether-burn-flare': 'presentation',
  'ether-drain': 'effect',
  'ether-drain-capture-flare': 'presentation',
  'ether-drain-cloud': 'presentation',
  'ether-drain-debris': 'presentation',
  'ether-fade': 'presentation',
  'fire-burn': 'status-carrier',
  'fire-burn-flame': 'presentation',
  'fire-patch': 'effect',
  'flash-response-fade': 'presentation',
  'flash-response-grow': 'presentation',
  'freeze-wave': 'effect',
  'freeze-wave-visual': 'presentation',
  'frost-burn-flare': 'presentation',
  golem: 'minion',
  'golem-death': 'presentation',
  'ice-blast': 'effect',
  leviathan: 'effect',
  'leviathan-appendage': 'effect',
  'leviathan-mote': 'presentation',
  'magic-circle': 'effect',
  'magic-circle-player-flash': 'presentation',
  'magic-trap': 'effect',
  'magic-trap-burst': 'effect',
  'magic-trap-shimmer': 'presentation',
  'mindblast-burst': 'effect',
  'mindblast-shockwave': 'effect',
  'moving-fire': 'effect',
  'phase-burst': 'presentation',
  'plane-orb-particle': 'presentation',
  'plane-orb-shot': 'effect',
  'prismatic-wave': 'effect',
  'ring-fire-explosion': 'effect',
  'ring-fire-fragment': 'presentation',
  'shield-break': 'presentation',
  'shield-explosion': 'effect',
  shockwave: 'effect',
  'storm-cloud': 'effect',
  'storm-drop': 'presentation',
  'storm-strike': 'effect',
  'teleport-burst': 'presentation',
  'turn-undead': 'effect',
}) satisfies Readonly<Record<NativeSecondaryActorKind, SecondaryActorClass>>

export const ML_BOT_POLICY_ENEMY_PROJECTILE_CLASSES = Object.freeze({
  arrow: 'projectile',
  'demon-bomb': 'projectile',
  firebolt: 'projectile',
  'guided-missile': 'projectile',
  'poison-pool': 'area',
}) satisfies Readonly<Record<BoneyardEnemyProjectileKind, 'area' | 'projectile'>>

export function validateMlBotPolicyClosedUnions(): void {
  assertMlBotPolicyClosedUnion(
    'enemy tokens',
    Object.keys(BONEYARD_WAVE_ENEMY_TYPES),
    ML_BOT_POLICY_ENEMY_TOKEN_SPECIES,
  )
  assertMlBotPolicyClosedUnion('wave phases', BONEYARD_WAVE_DIRECTOR_PHASES, ML_BOT_POLICY_WAVE_PHASES)
  assertMlBotPolicyClosedUnion('Solomon phases', BONEYARD_SOLOMON_PHASES, ML_BOT_POLICY_SOLOMON_PHASES)
  assertMlBotPolicyClosedUnion('item kinds', HUB_ITEM_KINDS, ML_BOT_POLICY_ITEM_CLASSES)
  assertMlBotPolicyClosedUnion('equipment slots', EQUIPMENT_SLOTS, ML_BOT_POLICY_EQUIPMENT_SLOT_NAMES)
  assertMlBotPolicyClosedUnion(
    'secondary skill ids',
    NATIVE_SECONDARY_ABILITY_IDS.map(String),
    ML_BOT_POLICY_SECONDARY_SKILLS,
  )
  assertMlBotPolicyClosedUnion(
    'primary skill ids',
    ['8', '16', '24', '32', '40', '52'],
    ML_BOT_POLICY_PRIMARY_SKILLS,
  )
  assertMlBotPolicyClosedUnion(
    'equipment modifier fields',
    Object.keys(createNativeEquipmentModifiers()),
    ML_BOT_POLICY_EQUIPMENT_MODIFIER_FAMILIES,
  )
  assertMlBotPolicyClosedUnion('player life states', PLAYER_LIFE_STATES, {
    alive: true,
    dying: true,
    'lethal-pending': true,
    spectating: true,
  })
  assertMlBotPolicyClosedUnion('run phases', GAME_RUN_PHASES, {
    active: true,
    'game-over': true,
    hub: true,
    loadout: true,
  })
  assertMlBotPolicyClosedUnion(
    'secondary actor kinds',
    NATIVE_SECONDARY_ACTOR_KINDS,
    ML_BOT_POLICY_SECONDARY_ACTOR_CLASSES,
  )
  assertMlBotPolicyClosedUnion(
    'enemy projectile kinds',
    ['arrow', 'demon-bomb', 'firebolt', 'guided-missile', 'poison-pool'],
    ML_BOT_POLICY_ENEMY_PROJECTILE_CLASSES,
  )
}

export function assertMlBotPolicyClosedUnion(
  label: string,
  members: readonly (number | string)[],
  mapping: Readonly<Record<number | string, unknown>>,
): void {
  const expected = [...new Set(members.map(String))].sort()
  const actual = Object.keys(mapping).sort()
  const missing = expected.filter((member) => !actual.includes(member))
  const unexpected = actual.filter((member) => !expected.includes(member))
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `ML bot policy ${label} are not closed; missing=[${missing.join(',')}], `
      + `unexpected=[${unexpected.join(',')}]`,
    )
  }
}
