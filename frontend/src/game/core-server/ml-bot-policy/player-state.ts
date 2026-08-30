import { isSolomonPlayerLocked } from '../../core-kernels/boneyard-encounter.ts'
import {
  NATIVE_SECONDARY_ABILITY_CONTRACTS,
  NATIVE_SECONDARY_ABILITY_IDS,
} from '../../core-kernels/native-secondary-ability-contract.ts'
import {
  NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS,
  createNativeSecondaryPlayerState,
} from '../../core-kernels/native-secondary-abilities.ts'
import { nativePrimarySkillProfile } from '../../core-kernels/native-primary-skill-profile.ts'
import { playerCanCast, playerMovementScale } from '../../core-kernels/player-combat.ts'
import {
  MAX_PLAYER_LEVEL,
  NATIVE_WELD_BUILDS,
  type NativePlayerPrimarySkillId,
} from '../../core-kernels/player-progression.ts'
import {
  PLAYER_CHARACTER_STEADY_SPEED,
  playerPrimaryCastOwnsFacing,
} from '../../core-kernels/player-character.ts'
import {
  PRIMARY_SPELL_AIR_REACH,
  PRIMARY_SPELL_WATER_REACH,
} from '../../core-kernels/primary-spells.ts'
import {
  getPlayerBelt,
  getPlayerCharacter,
  getPlayerProgression,
  getPlayerSkillBook,
  getPlayerStatBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import { nativeBeltSkillProjection } from '../../core-kernels/native-belt.ts'
import {
  playerSkillDerivedStatsAt,
  playerSkillRuntimeAt,
} from '../player-entity-store.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export interface MlBotPolicyEffectActivity {
  readonly primaryEffectActive: boolean
  readonly secondaryEffectActive: readonly boolean[]
}

export interface MlBotPolicySecondarySlot {
  readonly affordable: boolean
  readonly occupied: boolean
  readonly ready: boolean
  readonly skillId: number | null
}

export interface MlBotPolicyPlayerObservation {
  readonly blockA: Float32Array
  readonly blockB: Float32Array
  readonly blockC: Float32Array
  readonly primaryAffordable: boolean
  readonly primaryRange: number
  readonly secondarySlots: readonly MlBotPolicySecondarySlot[]
}

const PRIMARY_SKILL_IDS = new Set<number>([8, 16, 24, 32, 40, 52])

export function observeMlBotPolicyPlayerState(
  state: GameSimulationState,
  playerId: string,
  activity: MlBotPolicyEffectActivity,
): MlBotPolicyPlayerObservation {
  const player = getPlayerCharacter(state, playerId)
  const progression = getPlayerProgression(state, playerId)
  const skillBook = getPlayerSkillBook(state, playerId)
  const statBook = getPlayerStatBook(state, playerId)
  const derived = playerSkillDerivedStatsAt(state.playerEntities, playerId)
  const runtime = playerSkillRuntimeAt(state.playerEntities, playerId)
  if (!derived || !runtime) throw new Error(`ML bot policy player ${playerId} has no skill runtime`)
  const secondary = state.secondaryAbilities.players[playerId]
    ?? createNativeSecondaryPlayerState()
  const castActive = playerPrimaryCastOwnsFacing(player.primaryCast)
    || secondary.staffCastTicksRemaining > 0
    || secondary.castSpinTicksRemaining > 0
  const castReady = playerCanCast(progression)
    && !castActive
    && secondary.globalCooldownTicks === 0
  const availableMana = progression.currentMana
  const primaryProfile = nativePrimarySkillProfile(skillBook, statBook, {
    damage: derived.offensiveDamageFactor,
    equipment: runtime.equipmentModifiers,
    globalFlatDamage: derived.offensiveDamageFlat,
    globalManaReduction: derived.offensiveManaCostReduction,
    manaCost: derived.offensiveManaCostFactor,
  })
  const primaryRange = primaryProfile.kind === 'air'
    ? PRIMARY_SPELL_AIR_REACH
    : primaryProfile.kind === 'water'
      ? PRIMARY_SPELL_WATER_REACH
      : ML_BOT_POLICY_SCALES.range
  const primaryAffordable = availableMana >= primaryProfile.manaCost

  const blockA = new Float32Array(32)
  blockA[0] = ratio(progression.currentHealth, progression.maximumHealth)
  blockA[1] = ratio(progression.currentMana, progression.maximumMana)
  blockA[2] = scaledUnsigned(progression.level, MAX_PLAYER_LEVEL)
  blockA[3] = state.world.kind === 'boneyard' && state.world.waves
    ? scaledUnsigned(state.world.waves.waveOrdinal, ML_BOT_POLICY_SCALES.wave)
    : 0
  blockA[4] = scaledUnsigned(
    PLAYER_CHARACTER_STEADY_SPEED * derived.movementFactor * playerMovementScale(progression),
    ML_BOT_POLICY_SCALES.velocity,
  )
  blockA[5] = Number(player.velocity.x !== 0 || player.velocity.y !== 0)
  blockA[6] = Number(castActive)
  blockA[7] = Number(castReady)
  blockA[8] = Number(progression.poisonTicksRemaining > 0)
  blockA[9] = Number(progression.damageX4TicksRemaining > 0)
  blockA[10] = scaledUnsigned(progression.currentMana, ML_BOT_POLICY_SCALES.mana)
  blockA[11] = scaledUnsigned(progression.maximumMana, ML_BOT_POLICY_SCALES.mana)
  blockA[12] = scaledUnsigned(progression.maximumHealth, ML_BOT_POLICY_SCALES.hp)
  blockA[13] = Number(progression.coldSlowTicksRemaining > 0)
  blockA[14] = Number(progression.dazzleTicksRemaining > 0)
  blockA[15] = clampSigned(playerMovementScale(progression))
  blockA[16] = Number(progression.mindChugTicksRemaining > 0)
  blockA[17] = Number(secondary.heldSlot !== null)
  blockA[18] = Number(secondary.planeOrbHeld)
  blockA[19] = ratio(secondary.magicShieldAbsorb, secondary.magicShieldMaximum)
  blockA[20] = statusTime(secondary.stoneskinTicksRemaining)
  blockA[21] = scaledUnsigned(
    secondary.globalCooldownTicks,
    NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS,
  )
  blockA[22] = Number(
    state.world.kind === 'boneyard'
    && state.world.encounter !== null
    && isSolomonPlayerLocked(state.world.encounter, playerId),
  )
  blockA[23] = Number(progression.pendingOffer !== null || state.levelUpBarrier !== null)
  const wavePhase = state.world.kind === 'boneyard' && state.world.waves
    ? state.world.waves.phase
    : 'dormant'
  const wavePhaseIndex = [
    'dormant', 'opening', 'opening-threshold', 'spawning', 'wave-threshold',
    'wave-lull-delay', 'wave-lull', 'interwave',
  ].indexOf(wavePhase)
  blockA[24 + wavePhaseIndex] = 1

  const blockB = new Float32Array(11)
  for (const element of primaryElements(skillBook.primarySkillId, skillBook.weldBuildId)) {
    blockB[{ fire: 0, water: 1, earth: 2, air: 3, ether: 4 }[element]] = 1
  }
  blockB[5] = Number(skillBook.primarySkillId === 52 && skillBook.weldBuildId !== null)
  blockB[6] = primaryBuildIndex(skillBook.primarySkillId, skillBook.weldBuildId)
  blockB[7] = scaledUnsigned(primaryProfile.manaCost, ML_BOT_POLICY_SCALES.mana)
  blockB[8] = scaledUnsigned(primaryRange, ML_BOT_POLICY_SCALES.range)
  blockB[9] = Number(primaryAffordable)
  blockB[10] = Number(activity.primaryEffectActive)

  const blockC = new Float32Array(8 * 15)
  const secondarySlots: MlBotPolicySecondarySlot[] = []
  const quickbar = nativeBeltSkillProjection(getPlayerBelt(state, playerId))
  for (let slot = 0; slot < 8; slot += 1) {
    const start = slot * 15
    const skillId = quickbar[slot]
    const occupied = skillId !== null
      && (NATIVE_SECONDARY_ABILITY_IDS as readonly number[]).includes(skillId)
    const isPrimaryBinding = skillId !== null && PRIMARY_SKILL_IDS.has(skillId)
    const rank = skillId === null ? 0 : skillBook.effectiveRanks[skillId] ?? 0
    const contract = occupied
      ? NATIVE_SECONDARY_ABILITY_CONTRACTS.find(({ skillId: id }) => id === skillId)
      : undefined
    const manaCost = contract
      ? contract.rank.manaCost[Math.min(rank, contract.rank.manaCost.length - 1)] ?? 0
      : 0
    const cooldown = skillId === null ? 0 : secondary.cooldownTicksBySkill[skillId] ?? 0
    const cooldownMaximum = skillId === null
      ? 0
      : secondary.cooldownMaximumTicksBySkill[skillId] ?? 0
    const ready = occupied
      && cooldown === 0
      && secondary.globalCooldownTicks === 0
      && playerCanCast(progression)
    const affordable = occupied && availableMana >= manaCost
    blockC[start] = Number(occupied)
    const element = skillId === null ? null : secondaryElement(skillId)
    if (element !== null) blockC[start + { fire: 1, water: 2, earth: 3, air: 4, ether: 5 }[element]] = 1
    blockC[start + 6] = skillId === null ? 0 : secondaryBandIndex(skillId)
    blockC[start + 7] = scaledUnsigned(manaCost, ML_BOT_POLICY_SCALES.mana)
    blockC[start + 8] = scaledUnsigned(
      cooldownMaximum / ML_BOT_POLICY_SCALES.tickRate,
      ML_BOT_POLICY_SCALES.cooldownSeconds,
    )
    blockC[start + 9] = scaledUnsigned(
      cooldown / ML_BOT_POLICY_SCALES.tickRate,
      ML_BOT_POLICY_SCALES.cooldownSeconds,
    )
    blockC[start + 10] = Number(ready)
    blockC[start + 11] = Number(affordable)
    blockC[start + 12] = Number(activity.secondaryEffectActive[slot] ?? false)
    blockC[start + 13] = Number(secondary.heldSlot === slot)
    blockC[start + 14] = Number(isPrimaryBinding)
    secondarySlots.push({ affordable, occupied, ready, skillId })
  }
  return {
    blockA,
    blockB,
    blockC,
    primaryAffordable,
    primaryRange,
    secondarySlots: Object.freeze(secondarySlots),
  }
}

function primaryElements(
  primarySkillId: NativePlayerPrimarySkillId,
  weldBuildId: number | null,
): readonly ('air' | 'earth' | 'ether' | 'fire' | 'water')[] {
  if (primarySkillId !== 52) return [primaryElement(primarySkillId)]
  const weld = NATIVE_WELD_BUILDS.find(({ id }) => id === weldBuildId)
  return weld ? weld.primarySkillIds.map(primaryElement) : []
}

function primaryElement(skillId: number): 'air' | 'earth' | 'ether' | 'fire' | 'water' {
  switch (skillId) {
    case 8: return 'ether'
    case 16: return 'fire'
    case 24: return 'air'
    case 32: return 'water'
    case 40: return 'earth'
    default: throw new Error(`primary skill ${skillId} has no element`)
  }
}

function primaryBuildIndex(primarySkillId: NativePlayerPrimarySkillId, weldBuildId: number | null): number {
  if (primarySkillId === 52) return weldBuildId === null ? 0 : clampSigned((weldBuildId - 1_000) / 10)
  return { 8: 0, 16: 0.2, 24: 0.4, 32: 0.6, 40: 0.8 }[primarySkillId]
}

function secondaryElement(skillId: number): 'air' | 'earth' | 'ether' | 'fire' | 'water' | null {
  if (skillId >= 8 && skillId <= 15) return 'ether'
  if (skillId >= 16 && skillId <= 23) return 'fire'
  if (skillId >= 24 && skillId <= 31) return 'air'
  if (skillId >= 32 && skillId <= 39) return 'water'
  if (skillId >= 40 && skillId <= 47) return 'earth'
  return null
}

function secondaryBandIndex(skillId: number): number {
  const first = skillId >= 8 && skillId <= 47 ? Math.floor(skillId / 8) * 8 : null
  return first === null ? 0 : (skillId - first) / 8
}

function statusTime(ticks: number): number {
  return scaledUnsigned(
    ticks / ML_BOT_POLICY_SCALES.tickRate,
    ML_BOT_POLICY_SCALES.statusDurationSeconds,
  )
}

function ratio(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value))
}
