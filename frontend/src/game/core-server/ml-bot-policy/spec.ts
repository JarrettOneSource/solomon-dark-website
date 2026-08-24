import { ML_BOT_PRIMARY_CURRICULUM } from './primary-curriculum.ts'

export const ML_BOT_POLICY_MODEL_FORMAT = 'solomon-dark-web-bot-policy'
export const ML_BOT_POLICY_ARCHITECTURE = 'mlp-tanh-four-head-v7'

function names(...values: readonly string[]): readonly string[] {
  return Object.freeze(values)
}

function repeated(prefix: string, count: number, suffixes: readonly string[]): readonly string[] {
  return Object.freeze(Array.from({ length: count }, (_, index) => (
    suffixes.map((suffix) => `${prefix}_${index + 1}_${suffix}`)
  )).flat())
}

const EXTENDED_SKILL_MECHANICS = names(
  'quantity', 'strength', 'absorb', 'arcs', 'armor_plus', 'charges', 'flee',
  'fragments', 'freeze', 'hp', 'hoard', 'loss', 'max_armor', 'percent',
  'pierces', 'pushback', 'reflect', 'size', 'slow', 'slowdown', 'speed',
  'speed_up', 'stun_amount', 'to_hit', 'weaken', 'widen',
)

export const ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES = names(
  'present', 'option_id_index_scaled',
  ...Array.from({ length: 16 }, (_, bit) => `skill_id_bit_${bit}`),
  'catalog_known', 'apply_count_scaled',
  'learned_rank_scaled', 'effective_rank_scaled', 'cap_rank_scaled',
  'max_rank_scaled', 'band_index_scaled', 'family_element', 'family_discipline',
  'family_ether', 'family_fire', 'family_air', 'family_water', 'family_earth',
  'family_arcane', 'family_mind', 'family_body', 'family_advanced',
  'family_runtime_only', 'is_primary', 'is_secondary', 'is_passive',
  'is_utility', 'is_weld', 'is_health_up', 'is_mana_up', 'weld_element_ether',
  'weld_element_fire', 'weld_element_air', 'weld_element_water',
  'weld_element_earth', 'weld_build_index_scaled',
  ...Array.from({ length: 16 }, (_, bit) => `weld_build_id_bit_${bit}`),
  'mana_cost_scaled',
  'damage_min_scaled', 'damage_max_scaled', 'range_scaled', 'cooldown_scaled',
  'radius_scaled', 'duration_scaled', 'value_scaled', 'concentration_scaled',
  'chance_scaled', 'mana_cost_present',
  'damage_min_present', 'damage_max_present', 'range_present',
  'cooldown_present', 'radius_present', 'duration_present', 'value_present',
  'concentration_present', 'chance_present',
  ...EXTENDED_SKILL_MECHANICS.flatMap((name) => [`${name}_scaled`, `${name}_present`]),
)

const BLOCK_A = names(
  'self_hp_ratio',
  'self_mana_ratio',
  'self_level_scaled',
  'wave_scaled',
  'self_move_speed_scaled',
  'self_moving',
  'self_cast_active',
  'self_cast_ready',
  'self_poisoned',
  'self_damage_x4',
  'self_mana_current_scaled',
  'self_mana_max_scaled',
  'self_hp_max_scaled',
  'self_cold_slowed',
  'self_dazzled',
  'self_movement_scale',
  'self_mind_chug',
  'self_held_slot_active',
  'self_plane_orb_held',
  'self_magic_shield_ratio',
  'self_stoneskin_remaining_scaled',
  'self_global_cooldown_scaled',
  'self_solomon_locked',
  'self_level_up_pending',
  'wave_phase_dormant',
  'wave_phase_opening',
  'wave_phase_opening_threshold',
  'wave_phase_spawning',
  'wave_phase_wave_threshold',
  'wave_phase_wave_lull_delay',
  'wave_phase_wave_lull',
  'wave_phase_interwave',
)

const BLOCK_B = names(
  'primary_element_fire',
  'primary_element_water',
  'primary_element_earth',
  'primary_element_air',
  'primary_element_ether',
  'primary_welded',
  'primary_build_index_scaled',
  'primary_mana_cost_scaled',
  'primary_range_max_scaled',
  'primary_affordable',
  'primary_effect_active',
)

const BLOCK_C = repeated('secondary', 8, names(
  'occupied',
  'element_fire',
  'element_water',
  'element_earth',
  'element_air',
  'element_ether',
  'band_index_scaled',
  'mana_cost_scaled',
  'cooldown_scaled',
  'cooldown_remaining_scaled',
  'ready',
  'affordable',
  'effect_active',
  'held',
  'is_primary_binding',
))

const BLOCK_D = repeated('enemy', 8, names(
  'present',
  'dx',
  'dy',
  'distance_scaled',
  'hp_ratio',
  'radius_scaled',
  'velocity_dx',
  'velocity_dy',
  'in_primary_range',
  'is_current_target',
  'targeted_by_own_minion',
))

const BLOCK_E = names(
  'target_present',
  'target_dx',
  'target_dy',
  'target_distance_scaled',
  'target_contact_distance_scaled',
  'target_hp_ratio',
  'target_radius_scaled',
  'target_in_primary_range',
  'primary_max_range_scaled',
)

const BLOCK_F = Object.freeze([
  ...names(
    'clearance_east_scaled',
    'clearance_southeast_scaled',
    'clearance_south_scaled',
    'clearance_southwest_scaled',
    'clearance_west_scaled',
    'clearance_northwest_scaled',
    'clearance_north_scaled',
    'clearance_northeast_scaled',
  ),
  ...Array.from({ length: 7 }, (_, row) => Array.from({ length: 7 }, (_, column) => (
    row === 3 && column === 3 ? null : `walkability_patch_row_${row + 1}_col_${column + 1}`
  ))).flat().filter((name): name is string => name !== null),
])

const BLOCK_G = Object.freeze([
  ...repeated('pickup', 4, names(
    'present',
    'dx',
    'dy',
    'distance_scaled',
    'type_gold',
    'type_health_orb',
    'type_mana_orb',
    'type_item_carrier',
    'type_powerup',
    'item_identity_known',
    'item_stock_health',
    'item_stock_mana',
    'item_stock_wizard_chug',
    'item_stock_antidote',
    'item_stock_mind_chug',
    'item_stock_rejuvenation',
    'item_custom',
    'item_is_equipment',
    'item_is_wizard_key',
    'item_stack_count_scaled',
    'item_amount_scaled',
  )),
  'pickup_count_scaled',
])

const BLOCK_I = Object.freeze([
  ...repeated('ally', 4, names(
    'present',
    'dx',
    'dy',
    'distance_scaled',
    'hp_ratio',
    'mana_ratio',
    'alive',
    'is_human',
    'intent_dx',
    'intent_dy',
  )),
  'ally_count_scaled',
])

const BLOCK_H = names(
  'enemy_count_scaled',
  'threat_count_scaled',
  'nearest_enemy_dx',
  'nearest_enemy_dy',
  'nearest_enemy_distance_scaled',
  'nearest_threat_dx',
  'nearest_threat_dy',
  'nearest_threat_distance_scaled',
  'escape_dx',
  'escape_dy',
  'arena_center_dx',
  'arena_center_dy',
  'arena_center_distance_scaled',
  'arena_x_normalized',
  'arena_y_normalized',
  'edge_pressure',
  'element_fire',
  'element_water',
  'element_earth',
  'element_air',
  'element_ether',
  'discipline_mind',
  'discipline_body',
  'discipline_arcane',
  'hp_delta',
  'mana_delta',
  'target_hp_delta',
  'enemy_count_delta',
  'previous_move_dx',
  'previous_move_dy',
  'previous_cast_primary',
  'previous_cast_secondary',
  'time_since_damage_scaled',
  'time_since_cast_scaled',
  'time_since_move_scaled',
  'previous_target_action_scaled',
  'previous_target_switched',
  'has_spell_welding_skill',
  'weld_offer_pending',
  'offensive_damage_multiplier_scaled',
  'offensive_mana_multiplier_scaled',
  'cast_speed_multiplier_scaled',
  'secondary_recharge_multiplier_scaled',
)

const BLOCK_J = names(
  'self_damage_x4_remaining_scaled',
  'self_poison_immunity_remaining_scaled',
  'self_all_concentration_remaining_scaled',
)

const BLOCK_K = repeated('enemy', 8, names(
  'species_skeleton',
  'species_archer',
  'species_mage',
  'species_imp',
  'species_zombie',
  'species_wraith',
  'species_demon',
  'species_coffin',
  'species_maggot',
  'facing_dx',
  'facing_dy',
  'phase_approach',
  'phase_range_control',
  'phase_orbit',
  'phase_windup',
  'phase_recover',
  'phase_cooldown',
  'phase_knockback',
  'phase_dormant',
  'phase_opening',
  'phase_open',
  'time_to_strike_scaled',
  'time_to_action_end_scaled',
  'phase_remaining_scaled',
  'marker_emitted',
  'targeting_self',
  'contact_targeting_self',
  'max_hp_scaled',
  'shield_ratio',
  'armored',
  'status_cold_slow',
  'status_cold_slow_remaining_scaled',
  'status_frozen',
  'status_frozen_remaining_scaled',
  'status_stunned',
  'status_stun_remaining_scaled',
  'status_fleeing',
  'status_flee_remaining_scaled',
  'status_dazzled',
  'status_disrupted',
  'status_prismatic',
  'status_burning',
  'status_weaken_factor_scaled',
  'status_time_scale',
))

const BLOCK_L = names(
  'target_velocity_dx',
  'target_velocity_dy',
  'target_facing_dx',
  'target_facing_dy',
)

const BLOCK_M = repeated('obstacle', 8, names(
  'present',
  'nearest_dx',
  'nearest_dy',
  'clearance_scaled',
  'normal_dx',
  'normal_dy',
  'radius_scaled',
  'extent_x_scaled',
  'extent_y_scaled',
  'kind_circle',
  'kind_segment',
  'kind_polygon',
  'is_destructible',
))

const BLOCK_N = Object.freeze([
  ...repeated('hazard', 12, names(
    'present',
    'kind_arrow',
    'kind_demon_bomb',
    'kind_firebolt',
    'kind_guided_missile',
    'kind_poison_pool',
    'kind_mage_lightning',
    'dx',
    'dy',
    'distance_scaled',
    'velocity_dx',
    'velocity_dy',
    'radius_scaled',
    'time_to_contact_scaled',
    'remaining_time_scaled',
    'kind_projectile',
    'kind_area',
    'kind_beam',
    'homing',
    'targeting_self',
    'damage_scaled',
    'applies_cold',
    'applies_poison',
    'already_hit_me',
  )),
  'hazard_count_scaled',
])

const BLOCK_O = Object.freeze([
  ...repeated('potion', 12, names(
    'present',
    'count_scaled',
    'stock_health',
    'stock_mana',
    'stock_wizard_chug',
    'stock_antidote',
    'stock_mind_chug',
    'stock_rejuvenation',
    'custom',
    'restores_hp_fraction',
    'restores_mana_fraction',
    'damage_multiplier_scaled',
    'cures_poison',
    'poison_immunity_duration_scaled',
    'concentrates_all',
    'effect_duration_scaled',
    'custom_effect_known',
    'identity_hash_a',
    'identity_hash_b',
  )),
  'potion_type_count_scaled',
  'potion_total_count_scaled',
])

const BLOCK_P = Object.freeze([
  ...['hat', 'robe', 'weapon', 'ring_1', 'ring_2', 'ring_3', 'amulet'].flatMap((slot) => (
    names(
      'present',
      'catalog_known',
      'identity_hash_a',
      'identity_hash_b',
      'rarity_scaled',
      'level_scaled',
      'set_complete',
      'offense_effect_scaled',
      'resource_effect_scaled',
      'mobility_effect_scaled',
      'defense_effect_scaled',
      'targeted_effect_present',
      'target_kind_scaled',
      'target_magnitude_scaled',
      'special_feature_present',
    ).map((suffix) => `equipment_${slot}_${suffix}`)
  )),
])

const BLOCK_Q = names(
  'inventory_item_total_count_scaled',
  'inventory_potion_count_scaled',
  'inventory_equipment_count_scaled',
  'inventory_sack_count_scaled',
  'inventory_misc_count_scaled',
  'inventory_perk_count_scaled',
  'inventory_registered_custom_count_scaled',
  'inventory_wizard_key_count_scaled',
  'inventory_has_wizard_key',
)

const BLOCK_R = Object.freeze([
  ...repeated('own_effect', 6, names(
    'present',
    'source_primary',
    'source_slot_1',
    'source_slot_2',
    'source_slot_3',
    'source_slot_4',
    'source_slot_5',
    'source_slot_6',
    'source_slot_7',
    'source_slot_8',
    'family_projectile',
    'family_area',
    'family_channel',
    'dx',
    'dy',
    'distance_scaled',
    'velocity_dx',
    'velocity_dy',
    'radius_scaled',
    'remaining_time_scaled',
    'damage_scaled',
    'held',
    'has_target',
  )),
  'own_effect_count_scaled',
  'own_projectile_count_scaled',
  'own_area_count_scaled',
])

const BLOCK_S = Object.freeze([
  ...repeated('minion', 4, names(
    'present',
    'owner_is_self',
    'dx',
    'dy',
    'distance_scaled',
    'hp_ratio',
    'max_hp_scaled',
    'iron',
    'phase_assembly',
    'phase_active',
    'phase_attack',
    'phase_provoke',
    'has_target',
    'reflect_factor_scaled',
    'age_scaled',
  )),
  'own_minion_count_scaled',
  'ally_minion_count_scaled',
])

const BLOCK_T = Object.freeze([
  ...ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.map((name) => `equipped_primary_${name}`),
  ...repeated('equipped_secondary', 8, ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES),
])

const BLOCK_DEFINITIONS = [
  ['A', BLOCK_A], ['B', BLOCK_B], ['C', BLOCK_C], ['D', BLOCK_D],
  ['E', BLOCK_E], ['F', BLOCK_F], ['G', BLOCK_G], ['I', BLOCK_I],
  ['H', BLOCK_H], ['J', BLOCK_J], ['K', BLOCK_K], ['L', BLOCK_L],
  ['M', BLOCK_M], ['N', BLOCK_N], ['O', BLOCK_O], ['P', BLOCK_P],
  ['Q', BLOCK_Q], ['R', BLOCK_R], ['S', BLOCK_S], ['T', BLOCK_T],
] as const

export interface MlBotPolicyBlock {
  readonly end: number
  readonly key: typeof BLOCK_DEFINITIONS[number][0]
  readonly names: readonly string[]
  readonly start: number
}

let blockStart = 0
export const ML_BOT_POLICY_BLOCKS: readonly MlBotPolicyBlock[] = Object.freeze(
  BLOCK_DEFINITIONS.map(([key, blockNames]) => {
    const block = Object.freeze({
      end: blockStart + blockNames.length,
      key,
      names: blockNames,
      start: blockStart,
    })
    blockStart = block.end
    return block
  }),
)

export const ML_BOT_POLICY_OBSERVATION_NAMES = Object.freeze(
  ML_BOT_POLICY_BLOCKS.flatMap(({ names: blockNames }) => blockNames),
)

const COMPASS_ACTIONS = names(
  'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast',
)

export const ML_BOT_POLICY_ACTION_HEADS = Object.freeze({
  ability: names(
    'none',
    'primary',
    ...Array.from({ length: 8 }, (_, index) => `secondary_${index + 1}`),
    ...Array.from({ length: 12 }, (_, index) => `drink_potion_${index + 1}`),
  ),
  aim: names('center', ...COMPASS_ACTIONS),
  movement: names('idle', ...COMPASS_ACTIONS),
  target: names(
    'keep_current',
    ...Array.from({ length: 8 }, (_, index) => `enemy_${index + 1}`),
  ),
})

export const ML_BOT_POLICY_SCALES = Object.freeze({
  aimOffsetWorld: 60,
  allyCount: 50,
  cooldownSeconds: 60,
  edgePressureRange: 480,
  effectLifetimeSeconds: 60,
  enemyActionSeconds: 2,
  enemyCount: 16,
  enemyPhaseSeconds: 5,
  equipmentEffect: 4,
  equipmentRarity: 2,
  equipmentTargetKind: 8,
  globalCooldownTicks: 150,
  hazardContactSeconds: 10,
  hazardLifetimeSeconds: 60,
  historySeconds: 5,
  hp: 1_000,
  inventoryCountSaturation: 99,
  level: 75,
  mana: 2_000,
  minionAgeSeconds: 60,
  minionCount: 4,
  multiplier: 4,
  ownEffectCount: 16,
  patchRadius: 3,
  patchSpacing: 60,
  pickupCount: 8,
  potionSlots: 12,
  radius: 100,
  range: 1_000,
  rayRange: 480,
  rayStep: 60,
  skillDamage: 500,
  skillBand: 8,
  skillAbsorb: 600,
  skillArcs: 12,
  skillArmorPlus: 60,
  skillChance: 100,
  skillCharges: 6,
  skillConcentration: 25,
  skillDurationSeconds: 30,
  skillFlee: 6,
  skillFragments: 10,
  skillFreeze: 100,
  skillHp: 700,
  skillHoard: 60,
  skillId: 81,
  skillLoss: 80,
  skillMaxArmor: 300,
  skillPercent: 90,
  skillPierces: 8,
  skillPushback: 100,
  skillQuantity: 14,
  skillReflect: 250,
  skillRadius: 20,
  skillRank: 20,
  skillSize: 210,
  skillSlow: 95,
  skillSlowdown: 50,
  skillSpeed: 350,
  skillSpeedUp: 350,
  skillStrength: 2_100,
  skillStunAmount: 100,
  skillToHit: 25,
  skillValue: 1_250,
  skillWeaken: 85,
  skillWiden: 150,
  statusDurationSeconds: 60,
  targetAction: 8,
  threatCount: 8,
  threatRadiusWorld: 340,
  tickRate: 100,
  velocity: 1_000,
  wave: 20,
})

export interface MlBotPolicyContract {
  readonly actionHeads: typeof ML_BOT_POLICY_ACTION_HEADS
  readonly architecture: string
  readonly choiceHiddenSize: number
  readonly choiceTrajectoryVersion: number
  readonly hiddenSizes: readonly number[]
  readonly mainTrajectoryVersion: number
  readonly modelFormat: string
  readonly modelVersion: number
  readonly observationNames: readonly string[]
  readonly observationVersion: number
  readonly optionDescriptorNames: readonly string[]
  readonly primaryCurriculum: typeof ML_BOT_PRIMARY_CURRICULUM
}

export const ML_BOT_POLICY_SPEC: MlBotPolicyContract = Object.freeze({
  actionHeads: ML_BOT_POLICY_ACTION_HEADS,
  architecture: ML_BOT_POLICY_ARCHITECTURE,
  choiceHiddenSize: 128,
  choiceTrajectoryVersion: 7,
  hiddenSizes: Object.freeze([512, 256]),
  mainTrajectoryVersion: 7,
  modelFormat: ML_BOT_POLICY_MODEL_FORMAT,
  modelVersion: 7,
  observationNames: ML_BOT_POLICY_OBSERVATION_NAMES,
  observationVersion: 7,
  optionDescriptorNames: ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
  primaryCurriculum: ML_BOT_PRIMARY_CURRICULUM,
})

export function validateMlBotPolicyContract(candidate: MlBotPolicyContract): void {
  requireEqual(candidate.modelFormat, ML_BOT_POLICY_MODEL_FORMAT, 'model format')
  requireEqual(candidate.architecture, ML_BOT_POLICY_ARCHITECTURE, 'architecture')
  requireEqual(candidate.modelVersion, 7, 'model version')
  requireEqual(candidate.observationVersion, 7, 'observation version')
  requireEqual(candidate.mainTrajectoryVersion, 7, 'main trajectory version')
  requireEqual(candidate.choiceTrajectoryVersion, 7, 'choice trajectory version')
  requireNames(candidate.hiddenSizes.map(String), ['512', '256'], 'hidden sizes')
  requireEqual(candidate.choiceHiddenSize, 128, 'choice hidden size')
  requireNames(candidate.observationNames, ML_BOT_POLICY_OBSERVATION_NAMES, 'observation names')
  requireNames(
    candidate.optionDescriptorNames,
    ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
    'option descriptor names',
  )
  requireEqual(
    JSON.stringify(candidate.primaryCurriculum),
    JSON.stringify(ML_BOT_PRIMARY_CURRICULUM),
    'primary curriculum',
  )
  for (const head of ['movement', 'target', 'ability', 'aim'] as const) {
    requireNames(candidate.actionHeads[head], ML_BOT_POLICY_ACTION_HEADS[head], `${head} actions`)
  }
}

function requireEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`ML bot policy ${label} does not match schema v7`)
}

function requireNames(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`ML bot policy ${label} do not match schema v7`)
  }
}
