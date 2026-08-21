import type { HubEconomyState } from './hub-economy.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import { resolveNativeSkillDamageValue } from './native-offensive-resolution.ts'
import {
  applyNativeEquipmentTransform,
  nativeEquipmentHasFeature,
  resolveEquippedNativeEffects,
  type NativeEquipmentModifiers,
} from './native-equipment-effects.ts'
import {
  PLAYER_HEALTH_RECOVERY_PER_TICK,
  PLAYER_INITIAL_HEALTH,
  PLAYER_INITIAL_MANA,
  PLAYER_MANA_RECOVERY_PER_TICK,
  type PlayerCombatComponent,
} from './player-combat.ts'
import type {
  PlayerProgressionComponent,
  PlayerSkillOffer,
  PlayerSkillBookComponent,
  PlayerStatBookComponent,
} from './player-progression.ts'
import {
  NATIVE_SKILL_CATALOG,
  NATIVE_WELD_COMPONENT_SKILL_IDS,
  nativeSkillCategory,
  nativeSkillRoot,
} from './player-progression.ts'

export const MIND_SKILL_IDS = Object.freeze([56, 57, 58, 59, 60, 61, 62, 63])
export const BODY_SKILL_IDS = Object.freeze([64, 65, 66, 67, 68, 69, 70, 71])
export const CONCENTRATABLE_SKILL_IDS = Object.freeze([
  57, 58, 59, 60, 61, 62, 63,
  65, 66, 67, 68, 69, 70, 71,
])

export const NATIVE_MEDITATION_ACTIVITY_BONUS_SCALE = 0.25
export const NATIVE_CONCENTRATED_ENCHANT_STAFF_TIMING_FACTOR = 1.75
export const NATIVE_CONCENTRATED_DEFLECT_DAMAGE_FACTOR = 5
export const NATIVE_DEFLECT_REFLECTION_PADDING = 25
export const NATIVE_HURRICANE_CHARGE_PER_TICK = Math.fround(0.0015)
export const NATIVE_HURRICANE_RELEASE_PER_TICK = Math.fround(0.03)
export const NATIVE_FLASH_RESPONSE_RADIUS = 100

export type PlayerConcentrationSlot = 'a' | 'b'
export type PlayerStaffDamageLane = 'primary' | 'secondary'
export type PlayerStaffAttackOutcome =
  | 'normal'
  | 'knockback'
  | 'disabling-hit'
  | 'critical-hit'
  | 'whirl'

export interface PlayerSkillRuntimeComponent {
  readonly concentrationSkillIdA: number | null
  readonly concentrationSkillIdB: number | null
  readonly equipmentModifiers: NativeEquipmentModifiers
  readonly hardenArmor: number
  readonly hardenArmorMaximum: number
  readonly hardenArmorPerTick: number
  readonly hurricaneCharge: number
  readonly hurricaneEnabled: boolean
  readonly meditationActivityRampTicks: number
  readonly meditationIdleElapsedTicks: number
  readonly mindstarActive: boolean
  readonly nextConcentrationReplacementSlot: PlayerConcentrationSlot
  readonly staffMeleeAlternate: boolean
}

export interface PlayerSkillDerivedStats {
  readonly castProgressFactor: number
  readonly damageResistance: number
  readonly deflectChancePercent: number
  readonly flashChancePercent: number
  readonly flashDurationTicks: number
  readonly focusInstantRechargeChancePercent: number
  readonly flailingChancePercent: number
  readonly goldAmountMultiplier: number
  readonly healthRecoveryPerTick: number
  readonly magicResistance: number
  readonly manaRecoveryPerTick: number
  readonly maximumHealth: number
  readonly maximumMana: number
  readonly meditationConcentrated: boolean
  readonly meditationIdleDelayTicks: number
  readonly meditationRecoveryMultiplier: number
  readonly movementFactor: number
  readonly offensiveDamageFactor: number
  readonly offensiveManaCostFactor: number
  readonly orbPullMultiplier: number
  readonly pickupRangeScalar: number
  readonly poisonResistance: number
  readonly secondaryRechargeFactor: number
  readonly staffActionTimingFactor: number
  readonly staffDamagePrimary: number
  readonly staffDamageSecondary: number
  readonly staffEquipped: boolean
}

export interface PlayerSkillRuntimeRefreshResult {
  readonly runtime: PlayerSkillRuntimeComponent
  readonly skillBook: PlayerSkillBookComponent
}

export interface PlayerSkillRuntimeTickResult {
  readonly manaRecoveryPerTick: number
  readonly runtime: PlayerSkillRuntimeComponent
}

export interface PlayerHarmfulContactResult {
  readonly damage: number
  readonly deflectPitch: number | null
  readonly deflected: boolean
  readonly flash: PlayerFlashResponse | null
  readonly reflectedDamage: number
  readonly rng: NativeRngState
}

export interface PlayerFlashResponse {
  readonly cameraDisplacement: Readonly<{ x: number; y: number }>
  readonly durationTicks: number
  readonly growScales: readonly number[]
  readonly pitch: number
}

export interface PlayerCreativityInsightResult {
  readonly offer: PlayerSkillOffer
  readonly rng: NativeRngState
}

export interface PlayerHardenArmorResult {
  readonly absorbedDamage: number
  readonly damage: number
  readonly runtime: PlayerSkillRuntimeComponent
}

export interface PlayerStaffAttackResult {
  readonly actionTimingFactor: number
  readonly outcome: PlayerStaffAttackOutcome
  readonly rng: NativeRngState
}

export function createPlayerSkillRuntime(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  economy: HubEconomyState,
): PlayerSkillRuntimeRefreshResult {
  return refreshPlayerSkillRuntime({
    concentrationSkillIdA: null,
    concentrationSkillIdB: null,
    equipmentModifiers: resolveEquippedNativeEffects(
      skillBook.permanentRanks,
      economy.equipment,
    ).modifiers,
    hardenArmor: 0,
    hardenArmorMaximum: 0,
    hardenArmorPerTick: 0,
    hurricaneCharge: 0,
    hurricaneEnabled: false,
    meditationActivityRampTicks: 0,
    meditationIdleElapsedTicks: 0,
    mindstarActive: false,
    nextConcentrationReplacementSlot: 'a',
    staffMeleeAlternate: false,
  }, skillBook, statBook, economy)
}

export function refreshPlayerSkillRuntime(
  source: PlayerSkillRuntimeComponent,
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  economy: HubEconomyState,
): PlayerSkillRuntimeRefreshResult {
  const equipment = resolveEquippedNativeEffects(
    skillBook.permanentRanks,
    economy.equipment,
  )
  const effectiveRanks = applyNativeMindstarRanks(
    energizeNativeWeldComponents(
      equipment.effectiveRanks,
      nativeEquipmentHasFeature(equipment.modifiers, 'maximumWeld'),
    ),
    source.mindstarActive,
  )
  const nextSkillBook = ranksEqual(effectiveRanks, skillBook.effectiveRanks)
    ? skillBook
    : { ...skillBook, effectiveRanks }
  const splitMind = economy.ownedPerkSelectors.includes(21)
  const concentrationSkillIdA = validConcentrationSelection(
    source.concentrationSkillIdA,
    nextSkillBook,
  )
  const concentrationSkillIdB = splitMind
    ? validConcentrationSelection(source.concentrationSkillIdB, nextSkillBook)
    : null
  const delay = meditationIdleDelayTicks(nextSkillBook, statBook)
  const hardenArmorMaximum = effectiveSkillNumericValue(
    nextSkillBook,
    statBook,
    36,
    'mMaxArmor',
  )
  const hurricaneEnabled = rank(nextSkillBook, 29) > 0
  const runtime: PlayerSkillRuntimeComponent = Object.freeze({
    ...source,
    concentrationSkillIdA,
    concentrationSkillIdB,
    equipmentModifiers: equipment.modifiers,
    hardenArmor: Math.min(source.hardenArmor, hardenArmorMaximum),
    hardenArmorMaximum,
    hardenArmorPerTick: effectiveSkillNumericValue(
      nextSkillBook,
      statBook,
      36,
      'mArmorPlus',
    ) / 100,
    hurricaneCharge: hurricaneEnabled ? source.hurricaneCharge : 0,
    hurricaneEnabled,
    meditationActivityRampTicks: delay < 0
      ? 0
      : Math.min(source.meditationActivityRampTicks, delay),
    meditationIdleElapsedTicks: delay < 0
      ? 0
      : Math.min(source.meditationIdleElapsedTicks, delay),
  })
  return Object.freeze({ runtime, skillBook: nextSkillBook })
}

export function playerSkillDerivedStats(
  runtime: PlayerSkillRuntimeComponent,
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  progression: Pick<PlayerProgressionComponent,
    'damageX4TicksRemaining' | 'mindChugTicksRemaining'
  >,
  economy: HubEconomyState,
): PlayerSkillDerivedStats {
  const selected = (skillId: number): boolean => isPlayerSkillConcentrated(
    runtime,
    progression,
    skillId,
  )
  const value = (skillId: number, property: string): number => (
    effectiveSkillNumericValue(skillBook, statBook, skillId, property)
  )
  const channelMana = value(57, 'mValue')
  const battleMage = value(59, 'mValue')
  const focus = value(60, 'mValue')
  const siegeMage = value(61, 'mValue')
  const resistMagic = value(62, 'mValue')
  const staffDamage = value(65, 'mDamage')
  const telekinesis = value(66, 'mValue')
  const rush = value(67, 'mValue')
  const resistPoison = value(69, 'mValue')
  const fasterCaster = value(70, 'mValue')
  const staffEquipped = economy.equipment.weapon?.nativeTypeId === 7004
    && economy.equipment.weapon.equipmentType === 'staff'
  const modifiers = runtime.equipmentModifiers
  const offensiveDamageFactor = (
    1 + (siegeMage + (selected(61) ? value(61, 'mConcentration') : 0)) / 100
  ) * (progression.damageX4TicksRemaining > 0 ? 4 : 1)
  const offensiveManaCostFactor = Math.max(
    0,
    1 - (battleMage + (selected(59) ? value(59, 'mConcentration') : 0)) / 100,
  )
  const castProgressFactor = applyClassCastSpeed(
    modifiers,
    1 + (fasterCaster + (selected(70) ? value(70, 'mConcentration') : 0)) / 100,
    skillBook.primarySkillId,
  )
  return Object.freeze({
    castProgressFactor,
    damageResistance: clampUnit(modifiers.damageResistance),
    deflectChancePercent: staffEquipped ? value(68, 'mValue') : 0,
    flashChancePercent: value(53, 'mChance'),
    flashDurationTicks: Math.round(value(53, 'mDuration') * 100),
    focusInstantRechargeChancePercent: selected(60) ? value(60, 'mConcentration') : 0,
    flailingChancePercent: value(71, 'mChance'),
    goldAmountMultiplier: modifiers.goldMultiplier,
    healthRecoveryPerTick: applyNativeEquipmentTransform(
      modifiers.healthRecovery,
      PLAYER_HEALTH_RECOVERY_PER_TICK,
    ),
    magicResistance: clampUnit(
      (resistMagic + (selected(62) ? value(62, 'mConcentration') : 0)) / 100
      + modifiers.magicResistance,
    ),
    manaRecoveryPerTick: applyNativeEquipmentTransform(
      modifiers.manaRecovery,
      PLAYER_MANA_RECOVERY_PER_TICK
        * (1 + channelMana / 100)
        * (selected(57) ? 1 + value(57, 'mConcentration') / 100 : 1),
    ),
    maximumHealth: applyNativeEquipmentTransform(
      modifiers.maximumHealth,
      PLAYER_INITIAL_HEALTH + value(64, 'mValue'),
    ),
    maximumMana: applyNativeEquipmentTransform(
      modifiers.maximumMana,
      PLAYER_INITIAL_MANA + value(56, 'mValue'),
    ),
    meditationConcentrated: selected(58),
    meditationIdleDelayTicks: meditationIdleDelayTicks(skillBook, statBook),
    meditationRecoveryMultiplier: rank(skillBook, 58) > 0 ? value(58, 'mValue') : 1,
    movementFactor: applyNativeEquipmentTransform(
      modifiers.walkSpeed,
      (1 + rush / 100) * (selected(67) ? 1 + value(67, 'mConcentration') / 100 : 1),
    ),
    offensiveDamageFactor,
    offensiveManaCostFactor,
    orbPullMultiplier: modifiers.orbPullMultiplier,
    pickupRangeScalar: telekinesis * (selected(66) ? 2.5 : 1.25),
    poisonResistance: clampUnit(
      (resistPoison + (selected(69) ? value(69, 'mConcentration') : 0)) / 100
      + modifiers.poisonResistance,
    ),
    secondaryRechargeFactor: applyNativeEquipmentTransform(
      modifiers.recharge,
      1 + focus / 100,
    ),
    staffActionTimingFactor: selected(65)
      ? NATIVE_CONCENTRATED_ENCHANT_STAFF_TIMING_FACTOR
      : 1,
    staffDamagePrimary: staffDamage,
    staffDamageSecondary: staffDamage,
    staffEquipped,
  })
}

export function refreshPlayerCombatFromSkillStats<T extends PlayerCombatComponent>(
  source: T,
  derived: Pick<PlayerSkillDerivedStats, 'maximumHealth' | 'maximumMana'>,
): T {
  const healthRatio = source.maximumHealth > 0
    ? source.currentHealth / source.maximumHealth
    : 1
  const manaRatio = source.maximumMana > 0
    ? source.currentMana / source.maximumMana
    : 1
  return {
    ...source,
    currentHealth: Math.min(
      derived.maximumHealth,
      Math.max(0, derived.maximumHealth * healthRatio),
    ),
    currentMana: Math.min(
      derived.maximumMana,
      Math.max(0, derived.maximumMana * manaRatio),
    ),
    maximumHealth: derived.maximumHealth,
    maximumMana: derived.maximumMana,
  }
}

export function resolvePlayerHarmfulContact(
  runtime: PlayerSkillRuntimeComponent,
  derived: PlayerSkillDerivedStats,
  progression: Pick<PlayerProgressionComponent, 'mindChugTicksRemaining'>,
  damage: number,
  kind: 'magic' | 'physical',
  deflectable: boolean,
  reflectionSourceInRange: boolean,
  sourceRng: NativeRngState,
): PlayerHarmfulContactResult {
  if (!Number.isFinite(damage) || damage < 0) {
    throw new RangeError('incoming player damage must be finite and non-negative')
  }
  let rng = sourceRng
  let flash: PlayerFlashResponse | null = null
  if (damage > 0 && derived.flashChancePercent > 0) {
    const chance = drawNativeInteger(rng, 100)
    rng = chance.state
    if (
      chance.value > 0
      && chance.value <= Math.round(derived.flashChancePercent)
    ) {
      const pitch = drawNativeFloat(rng, Math.fround(0.2))
      const heading = drawNativeInteger(pitch.state, 100_001)
      rng = heading.state
      const headingDegrees = Math.fround(
        Math.fround(heading.value / 100_000) * 360,
      )
      const headingRadians = headingDegrees * Math.PI / 180
      const growScales: number[] = []
      for (let index = 0; index < 8; index += 1) {
        const scale = drawNativeFloat(rng, 1)
        rng = scale.state
        growScales.push(Math.fround(2 - scale.value))
      }
      flash = Object.freeze({
        cameraDisplacement: Object.freeze({
          x: Math.fround(Math.sin(headingRadians) * 3),
          y: Math.fround(-Math.cos(headingRadians) * 3),
        }),
        durationTicks: derived.flashDurationTicks,
        growScales: Object.freeze(growScales),
        pitch: Math.fround(1 + pitch.value),
      })
    }
  }
  if (deflectable) {
    const draw = drawNativeInteger(rng, 100)
    rng = draw.state
    if (draw.value < derived.deflectChancePercent) {
      const pitch = drawNativeFloat(rng, 1, true)
      return Object.freeze({
        damage: 0,
        deflectPitch: Math.fround(1 + pitch.value),
        deflected: true,
        flash,
        reflectedDamage: kind === 'physical'
          && reflectionSourceInRange
          && isPlayerSkillConcentrated(runtime, progression, 68)
          ? damage * NATIVE_CONCENTRATED_DEFLECT_DAMAGE_FACTOR
          : 0,
        rng: pitch.state,
      })
    }
  }
  const resistedDamage = damage * (1 - (kind === 'magic'
      ? derived.magicResistance
      : derived.damageResistance))
  return Object.freeze({
    damage: Math.max(0, resistedDamage - runtime.hardenArmor),
    deflectPitch: null,
    deflected: false,
    flash,
    reflectedDamage: 0,
    rng,
  })
}

export function playerDeflectReflectionSourceInRange(
  playerPosition: Readonly<{ x: number; y: number }>,
  playerRadius: number,
  sourcePosition: Readonly<{ x: number; y: number }>,
  sourceRadius: number,
): boolean {
  if (
    !Number.isFinite(playerRadius)
    || playerRadius < 0
    || !Number.isFinite(sourceRadius)
    || sourceRadius < 0
  ) throw new RangeError('reflection radii must be finite and non-negative')
  const deltaX = sourcePosition.x - playerPosition.x
  const deltaY = sourcePosition.y - playerPosition.y
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    throw new RangeError('reflection positions must be finite')
  }
  const reach = playerRadius + sourceRadius + NATIVE_DEFLECT_REFLECTION_PADDING
  return deltaX * deltaX + deltaY * deltaY < reach * reach
}

export function resolvePlayerStaffAttack(
  derived: PlayerSkillDerivedStats,
  sourceRng: NativeRngState,
): PlayerStaffAttackResult {
  if (!derived.staffEquipped) throw new Error('staff attack requires an equipped staff')
  const chance = drawNativeFloat(sourceRng, 100)
  let rng = chance.state
  let outcome: PlayerStaffAttackOutcome = 'normal'
  if (derived.flailingChancePercent >= chance.value) {
    const selected = drawNativeInteger(rng, 4)
    rng = selected.state
    outcome = (['knockback', 'disabling-hit', 'critical-hit', 'whirl'] as const)[
      selected.value
    ]!
  }
  return Object.freeze({
    actionTimingFactor: derived.staffActionTimingFactor,
    outcome,
    rng,
  })
}

export function playerStaffDamage(
  runtime: PlayerSkillRuntimeComponent,
  derived: PlayerSkillDerivedStats,
  progression: Pick<PlayerProgressionComponent, 'mindChugTicksRemaining'>,
  outcome: PlayerStaffAttackOutcome,
): number {
  const baseDamage = resolveNativeSkillDamageValue(
    65,
    derived.staffDamagePrimary,
    {
      damage: derived.offensiveDamageFactor,
      equipment: runtime.equipmentModifiers,
      manaCost: derived.offensiveManaCostFactor,
    },
  )
  const procDamageFactor = outcome === 'critical-hit' ? 3 : 1
  const concentrationFactor = outcome !== 'normal'
      && isPlayerSkillConcentrated(runtime, progression, 71)
    ? 1.2
    : 1
  return Math.max(1, baseDamage) * procDamageFactor * concentrationFactor
}

export function togglePlayerStaffMeleeLane(
  source: PlayerSkillRuntimeComponent,
): PlayerSkillRuntimeComponent {
  return Object.freeze({ ...source, staffMeleeAlternate: !source.staffMeleeAlternate })
}

export function playerPoisonDurationSeconds(
  derived: PlayerSkillDerivedStats,
  durationSeconds: number,
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new RangeError('poison duration must be finite and non-negative')
  }
  return durationSeconds * (1 - derived.poisonResistance)
}

export function stepPlayerSkillRuntime(
  source: PlayerSkillRuntimeComponent,
  derived: PlayerSkillDerivedStats,
  activity: Readonly<{
    acting: boolean
    moving: boolean
    primaryChannel?: 'air' | 'earth' | 'ether' | 'fire' | 'water' | null
    primaryUnderpowered?: boolean
  }>,
): PlayerSkillRuntimeTickResult {
  const active = activity.acting || activity.moving
  let meditationActivityRampTicks = source.meditationActivityRampTicks
  let meditationIdleElapsedTicks = source.meditationIdleElapsedTicks
  if (derived.meditationIdleDelayTicks >= 0) {
    if (active) {
      meditationActivityRampTicks = Math.min(
        derived.meditationIdleDelayTicks,
        meditationActivityRampTicks + 1,
      )
      if (!derived.meditationConcentrated) meditationIdleElapsedTicks = 0
    }
    meditationIdleElapsedTicks = Math.min(
      derived.meditationIdleDelayTicks,
      meditationIdleElapsedTicks + 1,
    )
  }
  const meditationReady = derived.meditationIdleDelayTicks >= 0
    && meditationIdleElapsedTicks >= derived.meditationIdleDelayTicks
  const activityMultiplier = meditationActivityRampTicks > 0
    ? 1 + (derived.meditationRecoveryMultiplier - 1)
      * NATIVE_MEDITATION_ACTIVITY_BONUS_SCALE
    : derived.meditationRecoveryMultiplier
  const manaRecoveryPerTick = meditationReady
    ? derived.manaRecoveryPerTick * activityMultiplier
    : derived.manaRecoveryPerTick
  meditationActivityRampTicks = Math.max(0, meditationActivityRampTicks - 1)
  const hurricaneCharge = source.hurricaneEnabled
      && activity.primaryChannel === 'air'
      && !activity.primaryUnderpowered
    ? Math.min(1, Math.fround(source.hurricaneCharge + NATIVE_HURRICANE_CHARGE_PER_TICK))
    : Math.max(0, Math.fround(source.hurricaneCharge - NATIVE_HURRICANE_RELEASE_PER_TICK))
  const hardenArmor = activity.primaryChannel === 'water'
    ? activity.primaryUnderpowered
      ? 0
      : Math.min(
          source.hardenArmorMaximum,
          Math.fround(source.hardenArmor + source.hardenArmorPerTick),
        )
    : source.hardenArmor
  return Object.freeze({
    manaRecoveryPerTick,
    runtime: Object.freeze({
      ...source,
      hardenArmor,
      hurricaneCharge,
      meditationActivityRampTicks,
      meditationIdleElapsedTicks,
    }),
  })
}

/** Native Harden is a persistent flat armor lane; incoming contact never consumes it. */
export function applyPlayerHardenArmor(
  source: PlayerSkillRuntimeComponent,
  damage: number,
): PlayerHardenArmorResult {
  if (!Number.isFinite(damage) || damage < 0) {
    throw new RangeError('incoming Harden damage must be finite and non-negative')
  }
  const absorbedDamage = Math.min(source.hardenArmor, damage)
  return Object.freeze({
    absorbedDamage,
    damage: damage - absorbedDamage,
    runtime: source,
  })
}

export function setPlayerMindstarActive(
  source: PlayerSkillRuntimeComponent,
  active: boolean,
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  economy: HubEconomyState,
): PlayerSkillRuntimeRefreshResult {
  return refreshPlayerSkillRuntime(
    source.mindstarActive === active ? source : { ...source, mindstarActive: active },
    skillBook,
    statBook,
    economy,
  )
}

export function setPlayerConcentration(
  source: PlayerSkillRuntimeComponent,
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  economy: HubEconomyState,
  skillId: number,
): PlayerSkillRuntimeRefreshResult {
  if (validConcentrationSelection(skillId, skillBook) === null) {
    throw new RangeError(`skill ${skillId} cannot be concentrated by this player`)
  }
  if (source.concentrationSkillIdA === skillId || source.concentrationSkillIdB === skillId) {
    throw new Error(`skill ${skillId} is already concentrated`)
  }
  const splitMind = economy.ownedPerkSelectors.includes(21)
  const slot = source.concentrationSkillIdA === null
    ? 'a'
    : splitMind && source.concentrationSkillIdB === null
      ? 'b'
      : splitMind
        ? source.nextConcentrationReplacementSlot
        : 'a'
  return refreshPlayerSkillRuntime({
    ...source,
    ...(slot === 'a'
      ? { concentrationSkillIdA: skillId }
      : { concentrationSkillIdB: skillId }),
    nextConcentrationReplacementSlot: splitMind
      ? slot === 'a' ? 'b' : 'a'
      : 'a',
  }, skillBook, statBook, economy)
}

export function isPlayerSkillConcentrated(
  source: Pick<PlayerSkillRuntimeComponent,
    'concentrationSkillIdA' | 'concentrationSkillIdB'
  >,
  progression: Pick<PlayerProgressionComponent, 'mindChugTicksRemaining'>,
  skillId: number,
): boolean {
  return progression.mindChugTicksRemaining > 0
    || source.concentrationSkillIdA === skillId
    || source.concentrationSkillIdB === skillId
}

export function creativityRecognizesConcentration(
  source: Pick<PlayerSkillRuntimeComponent, 'concentrationSkillIdA'>,
): boolean {
  return source.concentrationSkillIdA === 63
}

export function markPlayerCreativityInsight(
  source: Pick<PlayerSkillRuntimeComponent, 'concentrationSkillIdA'>,
  offer: PlayerSkillOffer,
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  sourceRng: NativeRngState,
): PlayerCreativityInsightResult {
  if (!creativityRecognizesConcentration(source)) return { offer, rng: sourceRng }
  const chance = drawNativeInteger(sourceRng, 5)
  if (chance.value !== 1) return { offer, rng: chance.state }
  const candidateIds = offer.options.flatMap((option, optionIndex) => {
    // Retail compares the displayed option index to 52. With at most four
    // choices this typo never excludes the Spell Welding row by identity.
    if (optionIndex === 52) return []
    const currentRank = rank(skillBook, option.skillId)
    if (nativeSkillCategory(option.skillId) === 4 && currentRank === 0) return []
    const maximumRank = statBook.entries[option.skillId]?.maximumLevel ?? 0
    return currentRank < maximumRank - 2 ? [option.skillId] : []
  })
  if (candidateIds.length === 0) return { offer, rng: chance.state }
  const selected = drawNativeInteger(chance.state, candidateIds.length)
  const insightSkillId = candidateIds[selected.value]!
  return {
    offer: Object.freeze({
      ...offer,
      options: Object.freeze(offer.options.map((option) => (
        option.skillId === insightSkillId
          ? Object.freeze({ ...option, insight: true as const })
          : option
      ))),
    }),
    rng: selected.state,
  }
}

export function effectiveSkillNumericValue(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  skillId: number,
  property: string,
): number {
  const entry = statBook.entries[skillId]
  if (entry === undefined || entry.id !== skillId) {
    throw new RangeError(`missing native stat row ${skillId}`)
  }
  const configured = entry.numericProperties[property]
  const effectiveRank = rank(skillBook, skillId)
  const value = typeof configured === 'number'
    ? configured
    : configured?.[Math.min(effectiveRank, configured.length - 1)]
  return value ?? 0
}

export function nativeSkillClass(skillId: number): number {
  const root = nativeSkillRoot(skillId)
  if (root === null) throw new RangeError(`skill ${skillId} has no native class`)
  return root
}

export function playerSecondaryRechargeFactor(
  derived: Pick<PlayerSkillDerivedStats, 'secondaryRechargeFactor'>,
  modifiers: NativeEquipmentModifiers,
  skillId: number,
): number {
  const classRecharge = modifiers.classRecharge[nativeSkillClass(skillId)]
  if (classRecharge === undefined) return derived.secondaryRechargeFactor
  return Math.max(
    derived.secondaryRechargeFactor,
    applyNativeEquipmentTransform(classRecharge, 1),
  )
}

function applyClassCastSpeed(
  modifiers: NativeEquipmentModifiers,
  base: number,
  skillId: number,
): number {
  const classId = nativeSkillClass(skillId)
  return Math.max(0, (
    modifiers.castSpeedMultiplier * base
    + modifiers.castSpeedFlat
  ) * modifiers.classCastSpeedMultiplier[classId]!
    + modifiers.classCastSpeedFlat[classId]!)
}

function applyNativeMindstarRanks(
  baseRanks: readonly number[],
  active: boolean,
): readonly number[] {
  if (!active) return Object.freeze([...baseRanks])
  return Object.freeze(baseRanks.map((baseRank, skillId) => {
    if (skillId < 8 || skillId > 77 || baseRank < 1) return baseRank
    return Math.min(nativeSkillMaximumLevel(skillId), baseRank + 1)
  }))
}

function energizeNativeWeldComponents(
  baseRanks: readonly number[],
  active: boolean,
): readonly number[] {
  if (!active) return baseRanks
  const ranks = [...baseRanks]
  for (const skillId of NATIVE_WELD_COMPONENT_SKILL_IDS) {
    if ((ranks[skillId] ?? 0) === 0) ranks[skillId] = 1
  }
  return Object.freeze(ranks)
}

function validConcentrationSelection(
  skillId: number | null,
  skillBook: PlayerSkillBookComponent,
): number | null {
  if (skillId === null) return null
  return CONCENTRATABLE_SKILL_IDS.includes(skillId)
      && rank(skillBook, skillId) > 0
    ? skillId
    : null
}

function meditationIdleDelayTicks(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
): number {
  return rank(skillBook, 58) > 0
    ? Math.trunc(effectiveSkillNumericValue(skillBook, statBook, 58, 'mSeconds') * 100)
    : -1
}

function nativeSkillMaximumLevel(skillId: number): number {
  return NATIVE_SKILL_CATALOG[skillId]?.config?.mMaxLevel ?? 0
}

function rank(skillBook: PlayerSkillBookComponent, skillId: number): number {
  return skillBook.effectiveRanks[skillId] ?? 0
}

function ranksEqual(first: readonly number[], second: readonly number[]): boolean {
  return first.length === second.length
    && first.every((rank, index) => rank === second[index])
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}
