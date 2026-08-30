import {
  type PlayerCharacterConfig,
  type PlayerPrimaryCastState,
  type PlayerCharacterState,
  type WizardElement,
  resetPlayerPrimaryCast,
} from '../core-kernels/player-character.ts'
import {
  createPlayerLighting,
  stepPlayerOverlayLighting,
  type PlayerLightingState,
} from '../core-kernels/player-lighting.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import { nativeEquipmentHasFeature } from '../core-kernels/native-equipment-effects.ts'
import { createNativeRng, type NativeRngState } from '../core-kernels/native-rng.ts'
import {
  coldSlowPlayer,
  dazzlePlayer,
  damagePlayer,
  playerCanAcceptInput,
  playerCanCast,
  playerDisplayHealth,
  poisonPlayer,
  playerMovementScale,
  respawnPlayerCombat,
  restorePlayerHealth,
  restorePlayerMana,
  resetPlayerCombatForNewRun,
  setPlayerSpectating,
  setPlayerMana,
  stepPlayerCombatTick,
  tryDebitPlayerMana,
} from '../core-kernels/player-combat.ts'
import {
  applyNativeSkillAcquisitionOfferSeeds,
  applyNativeRevelationToConcentrations,
  applyPlayerDamageX4Bonus,
  applyPlayerPotionEffect,
  applyPlayerSkillChoice,
  buildPlayerSkillOffer,
  createPlayerProgression,
  createPlayerSkillBook,
  deferPlayerSkillChoice,
  grantPlayerExperience,
  grantPlayerBonusSkillChoice,
  grantNativeWeirdCasterSkill,
  grantPlayerSkillRanks,
  grantPlayerWeldBuild,
  increaseRandomLearnedSkill,
  openNextPlayerSkillOffer,
  playerStatBook,
  rerollPlayerSkillOffer,
  replacePlayerSkillChoiceWithMod,
  resetPlayerPotionEffects,
  setAutomaticPlayerSkillChoice,
  stepPlayerPotionEffects,
  selectPlayerPrimarySkill,
  synchronizePlayerLevelMilestone,
  unlockPlayerAdvancedSkill,
  type PlayerProgressionComponent,
  type SharedPlayerLevelMilestone,
  type PlayerSkillBookComponent,
  type PlayerStatBookComponent,
} from '../core-kernels/player-progression.ts'
import {
  autofillNewlyLearnedNativeBeltSkills,
  bindNativeBeltItem,
  bindNativeBeltSkill,
  createNativePlayerBelt,
  refreshNativePlayerBelt,
  type PlayerBeltComponent,
} from '../core-kernels/native-belt.ts'
import {
  consumeInventoryItem,
  consumeWizardKey,
  creditLootGold,
  createHubEconomy,
  discardInventoryItem,
  applyNativeStarterEquipmentAppearance,
  NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT,
  insertLootInventoryItem,
  hubEconomyInventoryIsValid,
  projectInventoryItems,
  SORCERORS_CHARM_SELECTOR,
  type HubInventoryItem,
  type HubEconomyState,
} from '../core-kernels/hub-economy.ts'
import {
  NATIVE_TUTORIAL_EQUIPMENT_APPEARANCE,
  rollNativeStarterEquipmentAppearance,
} from '../core-kernels/native-starter-equipment.ts'
import {
  NATIVE_HAGATHA_LAST_WORD_DEATH_TICK,
  NATIVE_HAGATHA_SELECTORS,
  applyNativeHagathaPurchaseRuntime,
  clearNativeHagathaUntilHurt,
  consumeNativeHagathaCheatDeath,
  nativeHagathaDrinkerShouldUseHealthPotion,
  nativeHagathaDrinkerShouldUseManaPotion,
  ownsNativeHagathaSelector,
  removeNativeHagathaRuntime,
} from '../core-kernels/native-hagatha-effects.ts'
import {
  autofillPlayerSkillSelections,
  createPlayerSkillRuntime,
  markPlayerCreativityInsight,
  refreshPlayerCombatFromSkillStats,
  playerSkillDerivedStats,
  refreshPlayerSkillRuntime,
  setPlayerConcentration,
  setPlayerConcentrationSlot,
  setPlayerMindstarActive,
  stepPlayerSkillRuntime,
  type PlayerSkillDerivedStats,
  type PlayerSkillRuntimeComponent,
} from '../core-kernels/player-skill-runtime.ts'

export type PlayerEntityId = number

export interface PlayerIdentityComponent {
  readonly playerId: string
}

export type PlayerLocomotionComponent = Omit<PlayerCharacterState, 'config' | 'primaryCast'>

export interface PlayerEntityStore {
  readonly belts: readonly PlayerBeltComponent[]
  readonly configs: readonly PlayerCharacterConfig[]
  readonly economies: readonly HubEconomyState[]
  readonly entityIds: readonly PlayerEntityId[]
  readonly identities: readonly PlayerIdentityComponent[]
  readonly lightings: readonly PlayerLightingState[]
  readonly locomotions: readonly PlayerLocomotionComponent[]
  readonly nextEntityId: PlayerEntityId
  readonly primaryCasts: readonly PlayerPrimaryCastState[]
  readonly progressions: readonly PlayerProgressionComponent[]
  readonly skillBooks: readonly PlayerSkillBookComponent[]
  readonly skillRuntimes: readonly PlayerSkillRuntimeComponent[]
  readonly statBooks: readonly PlayerStatBookComponent[]
}

export interface PlayerEntityCombatTickResult {
  readonly autoHealthPotionPlayerIds: readonly string[]
  readonly beganDeathEpochPlayerIds: readonly string[]
  readonly cheatDeathPlayerIds: readonly string[]
  readonly completedDeathPresentationPlayerIds: readonly string[]
  readonly deathBurstPlayerIds: readonly string[]
  readonly lastWordArchivePlayerIds: readonly string[]
  readonly lastWordBurstPlayerIds: readonly string[]
  readonly store: PlayerEntityStore
}

export interface PlayerEntityManaDebitResult {
  readonly accepted: boolean
  readonly autoManaPotionUsed: boolean
  readonly store: PlayerEntityStore
}

export interface PlayerEntityDamageResult {
  readonly autoHealthPotionUsed: boolean
  readonly cheatDeathTriggered: boolean
  readonly store: PlayerEntityStore
}

export interface PlayerEntityRespawnResult {
  readonly didRespawn: boolean
  readonly store: PlayerEntityStore
}

export interface PlayerEntityHagathaPurchaseResult {
  readonly rng: NativeRngState
  readonly store: PlayerEntityStore
  readonly weirdCasterSkillId: number | null
}

export interface PlayerEntityRngResult {
  readonly rng: NativeRngState
  readonly store: PlayerEntityStore
}

export interface PlayerEntitySkillSelectionAutofillResult extends PlayerEntityRngResult {}

export interface PlayerEntitySharedExperienceResult {
  readonly milestone: SharedPlayerLevelMilestone | null
  readonly rng: NativeRngState
  readonly store: PlayerEntityStore
}

export interface PlayerEntityLootItemResult {
  readonly accepted: boolean
  readonly store: PlayerEntityStore
}

export interface PlayerEntityRandomSkillIncreaseResult {
  readonly rng: NativeRngState
  readonly skillId: number | null
  readonly store: PlayerEntityStore
}

export function createPlayerEntityStore(): PlayerEntityStore {
  return {
    belts: [],
    configs: [],
    economies: [],
    entityIds: [],
    identities: [],
    lightings: [],
    locomotions: [],
    nextEntityId: 1,
    primaryCasts: [],
    progressions: [],
    skillBooks: [],
    skillRuntimes: [],
    statBooks: [],
  }
}

export function addPlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  config: PlayerCharacterConfig,
  character: PlayerCharacterState,
  offerSeed: number,
  lightRegistration: NativeWorldManagerRegistration = {
    managerLane: 'actor',
    registrationOrdinal: source.nextEntityId - 1,
  },
): PlayerEntityStore {
  if (playerEntityIndex(source, playerId) >= 0) return source
  const economy = createHubEconomy(offerSeed, { starterElement: config.element })
  const statBook = playerStatBook()
  const skillState = createPlayerSkillRuntime(
    createPlayerSkillBook(config),
    statBook,
    economy,
  )
  return {
    belts: [...source.belts, createNativePlayerBelt(skillState.skillBook)],
    configs: [...source.configs, Object.freeze({ ...config })],
    economies: [...source.economies, economy],
    entityIds: [...source.entityIds, source.nextEntityId],
    identities: [...source.identities, Object.freeze({ playerId })],
    lightings: [...source.lightings, createPlayerLighting(lightRegistration)],
    locomotions: [...source.locomotions, locomotionComponent(character)],
    nextEntityId: source.nextEntityId + 1,
    primaryCasts: [...source.primaryCasts, character.primaryCast],
    progressions: [...source.progressions, createPlayerProgression(offerSeed)],
    skillBooks: [...source.skillBooks, skillState.skillBook],
    skillRuntimes: [...source.skillRuntimes, skillState.runtime],
    statBooks: [...source.statBooks, statBook],
  }
}

export function removePlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  return {
    belts: withoutIndex(source.belts, index),
    configs: withoutIndex(source.configs, index),
    economies: withoutIndex(source.economies, index),
    entityIds: withoutIndex(source.entityIds, index),
    identities: withoutIndex(source.identities, index),
    lightings: withoutIndex(source.lightings, index),
    locomotions: withoutIndex(source.locomotions, index),
    nextEntityId: source.nextEntityId,
    primaryCasts: withoutIndex(source.primaryCasts, index),
    progressions: withoutIndex(source.progressions, index),
    skillBooks: withoutIndex(source.skillBooks, index),
    skillRuntimes: withoutIndex(source.skillRuntimes, index),
    statBooks: withoutIndex(source.statBooks, index),
  }
}

export function importPlayerEntity(
  target: PlayerEntityStore,
  source: PlayerEntityStore,
  sourcePlayerId: string,
  targetPlayerId: string,
  lightRegistration: NativeWorldManagerRegistration,
  character?: PlayerCharacterState,
): PlayerEntityStore {
  if (playerEntityIndex(target, targetPlayerId) >= 0) return target
  const index = playerEntityIndex(source, sourcePlayerId)
  if (index < 0) throw new Error(`source player entity ${sourcePlayerId} is missing`)
  const importedCharacter = character ?? playerCharacterProjection(source, index)
  const importedSkillBook = source.skillBooks[index]!
  return {
    belts: [...target.belts, source.belts[index]!],
    configs: [...target.configs, source.configs[index]!],
    economies: [...target.economies, source.economies[index]!],
    entityIds: [...target.entityIds, target.nextEntityId],
    identities: [...target.identities, Object.freeze({ playerId: targetPlayerId })],
    lightings: [...target.lightings, createPlayerLighting(lightRegistration)],
    locomotions: [...target.locomotions, locomotionComponent(importedCharacter)],
    nextEntityId: target.nextEntityId + 1,
    primaryCasts: [
      ...target.primaryCasts,
      resetSelectedPlayerPrimaryCast(importedCharacter.primaryCast, importedSkillBook),
    ],
    progressions: [...target.progressions, source.progressions[index]!],
    skillBooks: [...target.skillBooks, importedSkillBook],
    skillRuntimes: [...target.skillRuntimes, source.skillRuntimes[index]!],
    statBooks: [...target.statBooks, source.statBooks[index]!],
  }
}

export function playerEntityIndex(source: PlayerEntityStore, playerId: string): number {
  return source.identities.findIndex((identity) => identity.playerId === playerId)
}

export function playerEntityId(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityId | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.entityIds[index] ?? null
}

export function playerCharacterAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerCharacterState | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : playerCharacterProjection(source, index)
}

export function playerProgressionAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerProgressionComponent | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.progressions[index] ?? null
}

export function playerEconomyAt(
  source: PlayerEntityStore,
  playerId: string,
): HubEconomyState | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.economies[index] ?? null
}

export function playerBeltAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerBeltComponent | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.belts[index] ?? null
}

export function replacePlayerEconomy(
  source: PlayerEntityStore,
  playerId: string,
  economy: HubEconomyState,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  return replacePlayerSkillState(
    source,
    index,
    source.skillBooks[index]!,
    source.skillRuntimes[index]!,
    economy,
  )
}

export function migratePlayerStarterEquipmentAppearance(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const economy = source.economies[index]!
  if (economy.tutorialPending || economy.collegeIntroPending) return source
  const element = source.configs[index]!.element
  const vividTint = SUPERSEDED_WEB_STARTER_PRIMARY_TINTS[element]
  if (
    !isSupersededWebStarterWearable(economy.equipment.hat, 'hat', vividTint)
    || !isSupersededWebStarterWearable(economy.equipment.robe, 'robe', vividTint)
  ) return source
  const migrated = applyNativeStarterEquipmentAppearance(
    economy,
    rollNativeStarterEquipmentAppearance(
      createNativeRng(source.progressions[index]!.offerSeed),
      element,
    ),
  )
  return migrated === economy
    ? source
    : replacePlayerEconomy(source, playerId, {
        ...migrated,
        revision: economy.revision + 1,
      })
}

export function playerLightingAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerLightingState | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.lightings[index] ?? null
}

export function replacePlayerPainterRegistration(
  source: PlayerEntityStore,
  playerId: string,
  lightRegistration: NativeWorldManagerRegistration,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) throw new Error(`player ${playerId} does not exist`)
  const current = source.lightings[index]!
  const lightings = [...source.lightings]
  lightings[index] = Object.freeze({ ...current, lightRegistration })
  return { ...source, lightings }
}

export function setPlayerDeathWeaponPainterRegistration(
  source: PlayerEntityStore,
  playerId: string,
  deathWeaponPainterRegistration: NativeWorldManagerRegistration | null,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) throw new Error(`player ${playerId} does not exist`)
  const current = source.lightings[index]!
  if (current.deathWeaponPainterRegistration === deathWeaponPainterRegistration) return source
  const lightings = [...source.lightings]
  lightings[index] = Object.freeze({ ...current, deathWeaponPainterRegistration })
  return { ...source, lightings }
}

export function playerSkillBookAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerSkillBookComponent | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.skillBooks[index] ?? null
}

export function setPlayerEntityAutomaticSkillChoice(
  source: PlayerEntityStore,
  playerId: string,
  choiceIndex: number,
): PlayerEntityStore | null {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return null
  const progression = setAutomaticPlayerSkillChoice(source.progressions[index]!, choiceIndex)
  return progression === null ? null : replacePlayerProgression(source, index, progression)
}

export function unlockPlayerEntityAdvancedSkill(
  source: PlayerEntityStore,
  playerId: string,
  skillId: number,
): PlayerEntityStore | null {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return null
  const skillBook = unlockPlayerAdvancedSkill(source.skillBooks[index]!, skillId)
  return skillBook === null ? null : replacePlayerSkillState(
    source,
    index,
    skillBook,
    source.skillRuntimes[index]!,
    source.economies[index]!,
  )
}

export function playerSkillRuntimeAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerSkillRuntimeComponent | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.skillRuntimes[index] ?? null
}

export function setPlayerEntitySkillRuntime(
  source: PlayerEntityStore,
  playerId: string,
  runtime: PlayerSkillRuntimeComponent,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0 || runtime === source.skillRuntimes[index]) return source
  const skillRuntimes = [...source.skillRuntimes]
  skillRuntimes[index] = runtime
  return { ...source, skillRuntimes }
}

export function playerSkillDerivedStatsAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerSkillDerivedStats | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : playerSkillDerivedStats(
    source.skillRuntimes[index]!,
    source.skillBooks[index]!,
    source.statBooks[index]!,
    source.progressions[index]!,
    source.economies[index]!,
  )
}

export function selectPlayerEntityConcentration(
  source: PlayerEntityStore,
  playerId: string,
  skillId: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  if (source.progressions[index]!.mindChugTicksRemaining > 0) {
    throw new Error('concentration cannot change while Mind Chug is active')
  }
  const selected = setPlayerConcentration(
    source.skillRuntimes[index]!,
    source.skillBooks[index]!,
    source.statBooks[index]!,
    source.economies[index]!,
    skillId,
  )
  return replacePlayerSkillState(
    source,
    index,
    selected.skillBook,
    selected.runtime,
    source.economies[index]!,
  )
}

export function selectPlayerEntityConcentrationSlot(
  source: PlayerEntityStore,
  playerId: string,
  skillId: number,
  slot: 0 | 1,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  if (source.progressions[index]!.mindChugTicksRemaining > 0) {
    throw new Error('concentration cannot change while Mind Chug is active')
  }
  const selected = setPlayerConcentrationSlot(
    source.skillRuntimes[index]!,
    source.skillBooks[index]!,
    source.statBooks[index]!,
    source.economies[index]!,
    skillId,
    slot,
  )
  return replacePlayerSkillState(
    source,
    index,
    selected.skillBook,
    selected.runtime,
    source.economies[index]!,
  )
}

export function autofillPlayerEntitySkillSelections(
  source: PlayerEntityStore,
  playerId: string,
  rng: NativeRngState,
): PlayerEntitySkillSelectionAutofillResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { rng, store: source }
  const result = autofillPlayerSkillSelections(
    source.skillRuntimes[index]!,
    source.skillBooks[index]!,
    source.statBooks[index]!,
    source.economies[index]!,
    rng,
  )
  if (
    result.runtime === source.skillRuntimes[index]
    && result.skillBook === source.skillBooks[index]
  ) return { rng: result.rng, store: source }
  const selected = replacePlayerSkillState(
    source,
    index,
    result.skillBook,
    result.runtime,
    source.economies[index]!,
  )
  return {
    rng: result.rng,
    store: selected,
  }
}

export function bindPlayerEntitySkillQuickbar(
  source: PlayerEntityStore,
  playerId: string,
  skillId: number | null,
  slot: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const belt = bindNativeBeltSkill(
    source.belts[index]!,
    source.skillBooks[index]!,
    skillId,
    slot,
  )
  const belts = [...source.belts]
  belts[index] = belt
  return { ...source, belts }
}

export function bindPlayerEntityBeltItem(
  source: PlayerEntityStore,
  playerId: string,
  itemId: number,
  slot: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const belt = bindNativeBeltItem(
    source.belts[index]!,
    source.economies[index]!,
    itemId,
    slot,
  )
  const belts = [...source.belts]
  belts[index] = belt
  return { ...source, belts }
}

export function preparePlayerEntityTutorialLoadout(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const current = source.skillBooks[index]!
  const permanentRanks = [...current.permanentRanks]
  const effectiveRanks = [...current.effectiveRanks]
  permanentRanks[11] = 0
  effectiveRanks[11] = 0
  permanentRanks[72] = Math.max(1, permanentRanks[72] ?? 0)
  effectiveRanks[72] = Math.max(1, effectiveRanks[72] ?? 0)
  const skillBook: PlayerSkillBookComponent = {
    ...current,
    effectiveRanks: Object.freeze(effectiveRanks),
    learnedSkillOrder: Object.freeze([
      ...current.learnedSkillOrder.filter(skillId => skillId !== 11 && skillId !== 72),
      72,
    ]),
    permanentRanks: Object.freeze(permanentRanks),
    primarySkillId: 8,
    weldBuildId: null,
    weldComponentRanks: null,
  }
  let economy = source.economies[index]!
  for (const subtype of [0, 1] as const) {
    const potion = firstNativePotion(economy, subtype)
    if (potion === null) continue
    const discarded = discardInventoryItem(economy, potion.id)
    if (!discarded.accepted) {
      throw new Error(`Tutorial starter potion ${subtype} could not be removed`)
    }
    economy = discarded.state
  }
  economy = applyNativeStarterEquipmentAppearance(
    economy,
    NATIVE_TUTORIAL_EQUIPMENT_APPEARANCE,
  )
  const replaced = replacePlayerSkillState(
    source,
    index,
    skillBook,
    source.skillRuntimes[index]!,
    economy,
  )
  const tutorialIndex = playerEntityIndex(replaced, playerId)
  const belts = [...replaced.belts]
  belts[tutorialIndex] = createNativePlayerBelt(skillBook)
  return { ...replaced, belts }
}

export function forcePlayerEntitySkillOfferIds(
  source: PlayerEntityStore,
  playerId: string,
  skillIds: readonly number[],
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  if (skillIds.some(skillId => !Number.isSafeInteger(skillId) || skillId < 8 || skillId > 79)) {
    throw new RangeError('forced Tutorial skill offers must be native public skill ids')
  }
  return replacePlayerProgression(source, index, {
    ...source.progressions[index]!,
    forcedOfferSkillIds: Object.freeze([...skillIds]),
  })
}

export function selectPlayerEntityPrimarySkill(
  source: PlayerEntityStore,
  playerId: string,
  skillId: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const skillBook = selectPlayerPrimarySkill(source.skillBooks[index]!, skillId)
  if (skillBook === source.skillBooks[index]) return source
  const selected = replacePlayerSkillState(
    source,
    index,
    skillBook,
    source.skillRuntimes[index]!,
    source.economies[index]!,
  )
  return selected
}

function resetPlayerEntityPrimarySelection(
  source: PlayerEntityStore,
  index: number,
  skillBook: PlayerSkillBookComponent,
): PlayerEntityStore {
  const primaryCasts = [...source.primaryCasts]
  primaryCasts[index] = resetSelectedPlayerPrimaryCast(primaryCasts[index]!, skillBook)
  return { ...source, primaryCasts }
}

function resetSelectedPlayerPrimaryCast(
  source: PlayerPrimaryCastState,
  skillBook: PlayerSkillBookComponent,
): PlayerPrimaryCastState {
  return {
    ...source,
    actionTick: -1,
    channelActive: false,
    held: false,
    lastWeldPlaybackRate: null,
    lastWeldSoundVariant: null,
    oneShotAttackPoseHeld: false,
    selectedPrimaryAgeTicks: 0,
    selectedPrimaryId: skillBook.primarySkillId === 52
      ? skillBook.weldBuildId!
      : skillBook.primarySkillId,
    targetId: null,
    underpowered: false,
  }
}

export function selectPlayerEntityConcentrationSkill(
  source: PlayerEntityStore,
  playerId: string,
  skillId: number,
): PlayerEntityStore {
  if (playerEntityIndex(source, playerId) < 0) {
    throw new Error(`player ${playerId} is absent`)
  }
  return selectPlayerEntityConcentration(source, playerId, skillId)
}

export function playerStatBookAt(
  source: PlayerEntityStore,
  playerId: string,
): PlayerStatBookComponent | null {
  const index = playerEntityIndex(source, playerId)
  return index < 0 ? null : source.statBooks[index] ?? null
}

export function playerCharacterRecords(
  source: PlayerEntityStore,
): Readonly<Record<string, PlayerCharacterState>> {
  return Object.fromEntries(source.identities.map((identity, index) => [
    identity.playerId,
    playerCharacterProjection(source, index),
  ]))
}

export function replacePlayerCharacterRecords(
  source: PlayerEntityStore,
  players: Readonly<Record<string, PlayerCharacterState>>,
): PlayerEntityStore {
  const locomotions = source.identities.map((identity, index) => {
    const player = players[identity.playerId]
    return player ? locomotionComponent(player) : source.locomotions[index]!
  })
  const primaryCasts = source.identities.map((identity, index) => (
    players[identity.playerId]?.primaryCast ?? source.primaryCasts[index]!
  ))
  return { ...source, locomotions, primaryCasts }
}

export function replacePlayerCharacter(
  source: PlayerEntityStore,
  playerId: string,
  character: PlayerCharacterState,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const locomotions = [...source.locomotions]
  const primaryCasts = [...source.primaryCasts]
  locomotions[index] = locomotionComponent(character)
  primaryCasts[index] = character.primaryCast
  return { ...source, locomotions, primaryCasts }
}

export function respawnPlayerEntityAt(
  source: PlayerEntityStore,
  playerId: string,
  position: Readonly<{ x: number; y: number }>,
): PlayerEntityRespawnResult {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new RangeError('player respawn position must be finite')
  }
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { didRespawn: false, store: source }
  const progression = respawnPlayerCombat(source.progressions[index]!)
  if (progression === source.progressions[index]) {
    return { didRespawn: false, store: source }
  }
  const character = playerCharacterProjection(source, index)
  const progressions = [...source.progressions]
  progressions[index] = progression
  const store = replacePlayerCharacter(
    { ...source, progressions },
    playerId,
    resetPlayerPrimaryCast({
      ...character,
      position: { x: position.x, y: position.y },
      velocity: { x: 0, y: 0 },
    }),
  )
  return { didRespawn: true, store }
}

export function replacePlayerLoadout(
  source: PlayerEntityStore,
  playerId: string,
  character: PlayerCharacterState,
  offerSeed: number,
  options: Readonly<{ starterAppearanceOwner?: WizardElement }> = {},
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const previousEconomy = source.economies[index]!
  const economy = options.starterAppearanceOwner === undefined
    ? previousEconomy
    : {
        ...applyNativeStarterEquipmentAppearance(
          previousEconomy,
          rollNativeStarterEquipmentAppearance(
            createNativeRng(offerSeed),
            options.starterAppearanceOwner,
          ),
        ),
        revision: previousEconomy.revision + 1,
      }
  const statBook = playerStatBook()
  const skillState = createPlayerSkillRuntime(
    createPlayerSkillBook(character.config),
    statBook,
    economy,
  )
  const selectedCharacter = {
    ...character,
    primaryCast: resetSelectedPlayerPrimaryCast(character.primaryCast, skillState.skillBook),
  }
  const previousProgression = source.progressions[index]!
  const weldingOfferBias = nativeEquipmentHasFeature(
    skillState.runtime.equipmentModifiers,
    'weldCalling',
  )
  const disciplineOfferBias = ownsNativeHagathaSelector(
    economy.ownedPerkSelectors,
    NATIVE_HAGATHA_SELECTORS.weirdCaster,
  )
  const freshProgression = {
    ...createPlayerProgression(offerSeed),
    disciplineOfferBias,
    hagathaRuntime: previousProgression.hagathaRuntime,
    revision: previousProgression.revision + 1,
    weldingOfferBias,
  }
  const progression = refreshPlayerCombatFromSkillStats(
    freshProgression,
    playerSkillDerivedStats(
      skillState.runtime,
      skillState.skillBook,
      statBook,
      freshProgression,
      economy,
    ),
  )
  const configs = [...source.configs]
  const economies = [...source.economies]
  const progressions = [...source.progressions]
  const skillBooks = [...source.skillBooks]
  const belts = [...source.belts]
  const skillRuntimes = [...source.skillRuntimes]
  const statBooks = [...source.statBooks]
  configs[index] = Object.freeze({ ...character.config })
  economies[index] = economy
  progressions[index] = progression
  skillBooks[index] = skillState.skillBook
  belts[index] = createNativePlayerBelt(skillState.skillBook)
  skillRuntimes[index] = skillState.runtime
  statBooks[index] = statBook
  return {
    ...replacePlayerCharacter(source, playerId, selectedCharacter),
    belts,
    configs,
    economies,
    progressions,
    skillBooks,
    skillRuntimes,
    statBooks,
  }
}

const SUPERSEDED_WEB_STARTER_PRIMARY_TINTS = Object.freeze({
  air: 0x19ffff,
  earth: 0x00bf00,
  ether: 0xff19ff,
  fire: 0xff1919,
  water: 0x1980ff,
} as const satisfies Readonly<Record<WizardElement, number>>)

function isSupersededWebStarterWearable(
  item: HubInventoryItem | null,
  equipmentType: 'hat' | 'robe',
  primaryTint: number,
): boolean {
  const expected = equipmentType === 'hat'
    ? { iconRecords: [34, 38], name: 'Hat', nativeTypeId: 7005 }
    : { iconRecords: [64, 67], name: 'Robe', nativeTypeId: 7006 }
  return item !== null
    && item.equipmentType === equipmentType
    && item.generatedLevel === undefined
    && item.iconRecords.length === expected.iconRecords.length
    && item.iconRecords.every((record, index) => record === expected.iconRecords[index])
    && item.iconTints?.[0] === primaryTint
    && item.iconTints?.[1] === 0xffffff
    && item.kind === 'equipment'
    && item.modAffixes === undefined
    && item.modItemContent === undefined
    && item.name === expected.name
    && item.nativeEffects === undefined
    && item.nativeSelector === undefined
    && item.nativeSubtype === null
    && item.nativeTypeId === expected.nativeTypeId
    && item.quantity === 1
    && item.rarity === null
    && item.recipeIndex === null
}

export function applyPlayerEntityHagathaPurchaseEffects(
  source: PlayerEntityStore,
  playerId: string,
  purchasedSelectors: readonly number[],
  rng: NativeRngState,
): PlayerEntityHagathaPurchaseResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { rng, store: source, weirdCasterSkillId: null }
  const economy = source.economies[index]!
  let progression = source.progressions[index]!
  let skillBook = source.skillBooks[index]!
  const hagathaRuntime = applyNativeHagathaPurchaseRuntime(
    progression.hagathaRuntime,
    purchasedSelectors,
  )
  if (hagathaRuntime !== progression.hagathaRuntime) {
    progression = { ...progression, hagathaRuntime }
  }
  if (purchasedSelectors.includes(NATIVE_HAGATHA_SELECTORS.revelation)) {
    const runtime = source.skillRuntimes[index]!
    skillBook = applyNativeRevelationToConcentrations(skillBook, [
      runtime.concentrationSkillIdA,
      runtime.concentrationSkillIdB,
    ])
  }
  let weirdCasterSkillId: number | null = null
  if (purchasedSelectors.includes(NATIVE_HAGATHA_SELECTORS.weirdCaster)) {
    const granted = grantNativeWeirdCasterSkill(
      skillBook,
      rng,
      economy.ownedPerkSelectors,
    )
    rng = granted.rng
    skillBook = granted.skillBook
    weirdCasterSkillId = granted.skillId
    if (weirdCasterSkillId !== null) {
      const reseeded = applyNativeSkillAcquisitionOfferSeeds(progression, rng, 1)
      progression = reseeded.progression
      rng = reseeded.rng
    }
  }
  const progressions = [...source.progressions]
  progressions[index] = progression
  const refreshed = replacePlayerSkillState(
    { ...source, progressions },
    index,
    skillBook,
    source.skillRuntimes[index]!,
    economy,
  )
  const autofilled = autofillPlayerEntitySkillSelections(refreshed, playerId, rng)
  const offered = weirdCasterSkillId === null
    ? autofilled
    : refreshPendingPlayerSkillOffer(autofilled.store, index, autofilled.rng)
  return {
    rng: offered.rng,
    store: offered.store,
    weirdCasterSkillId,
  }
}

export function applyPlayerEntityHagathaRemovalEffects(
  source: PlayerEntityStore,
  playerId: string,
  selector: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = source.progressions[index]!
  const hagathaRuntime = removeNativeHagathaRuntime(
    progression.hagathaRuntime,
    selector,
  )
  const progressions = hagathaRuntime === progression.hagathaRuntime
    ? source.progressions
    : source.progressions.map((candidate, candidateIndex) => (
        candidateIndex === index
          ? { ...candidate, hagathaRuntime, revision: candidate.revision + 1 }
          : candidate
      ))
  return replacePlayerSkillState(
    progressions === source.progressions ? source : { ...source, progressions },
    index,
    source.skillBooks[index]!,
    source.skillRuntimes[index]!,
    source.economies[index]!,
  )
}

export function damagePlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  damage: number,
  tick: number,
): PlayerEntityStore {
  return damagePlayerEntityWithResult(source, playerId, damage, tick).store
}

export function damagePlayerEntityWithResult(
  source: PlayerEntityStore,
  playerId: string,
  damage: number,
  tick: number,
  damageAlreadyScaled = false,
): PlayerEntityDamageResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) {
    return { autoHealthPotionUsed: false, cheatDeathTriggered: false, store: source }
  }
  const appliedDamage = damageAlreadyScaled
    ? damage
    : Math.fround(damage * playerSkillDerivedStats(
        source.skillRuntimes[index]!,
        source.skillBooks[index]!,
        source.statBooks[index]!,
        source.progressions[index]!,
        source.economies[index]!,
      ).incomingDamageFactor)
  const damaged = damagePlayer(source.progressions[index]!, appliedDamage, tick)
  if (damaged === source.progressions[index]) {
    return { autoHealthPotionUsed: false, cheatDeathTriggered: false, store: source }
  }
  const resolved = resolveNativeHagathaDamage(
    damaged,
    source.economies[index]!,
    appliedDamage,
  )
  const economies = [...source.economies]
  const progressions = [...source.progressions]
  economies[index] = resolved.economy
  progressions[index] = resolved.progression
  return {
    autoHealthPotionUsed: resolved.autoHealthPotionUsed,
    cheatDeathTriggered: resolved.cheatDeathTriggered,
    store: { ...source, economies, progressions },
  }
}

export function poisonPlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  damagePerSecond: number,
  durationSeconds: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  if (source.progressions[index]!.poisonImmunityTicksRemaining > 0) return source
  const progression = poisonPlayer(
    source.progressions[index]!,
    damagePerSecond,
    durationSeconds,
  )
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function applyPlayerEntityPotionEffect(
  source: PlayerEntityStore,
  playerId: string,
  subtype: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  return replacePlayerProgression(
    source,
    index,
    applyPlayerPotionEffect(source.progressions[index]!, subtype),
  )
}

export function applyPlayerEntityDamageX4Bonus(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  return replacePlayerProgression(
    source,
    index,
    applyPlayerDamageX4Bonus(source.progressions[index]!),
  )
}

export function coldSlowPlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  durationTicks: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = coldSlowPlayer(source.progressions[index]!, durationTicks)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function dazzlePlayerEntity(
  source: PlayerEntityStore,
  playerId: string,
  durationTicks: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = dazzlePlayer(source.progressions[index]!, durationTicks)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function tryDebitPlayerEntityMana(
  source: PlayerEntityStore,
  playerId: string,
  cost: number,
): PlayerEntityManaDebitResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { accepted: false, autoManaPotionUsed: false, store: source }
  const progression = source.progressions[index]!
  let economy = source.economies[index]!
  let debit = tryDebitPlayerMana(progression, cost)
  let autoManaPotionUsed = false
  if (
    !debit.accepted
    && nativeHagathaDrinkerShouldUseManaPotion(
      economy.ownedPerkSelectors,
      progression.currentMana,
      progression.maximumMana,
      cost,
    )
  ) {
    const potion = firstNativePotion(economy, 1)
    if (potion !== null) {
      const consumed = consumeInventoryItem(economy, potion.id)
      if (consumed.accepted) {
        economy = consumed.state
        debit = tryDebitPlayerMana(applyPlayerPotionEffect(progression, 1), cost)
        autoManaPotionUsed = true
      }
    }
  }
  const economies = economy === source.economies[index]
    ? source.economies
    : replaceIndex(source.economies, index, economy)
  const progressions = debit.combat === source.progressions[index]
    ? source.progressions
    : replaceIndex(source.progressions, index, debit.combat)
  return {
    accepted: debit.accepted,
    autoManaPotionUsed,
    store: economies === source.economies && progressions === source.progressions
      ? source
      : { ...source, economies, progressions },
  }
}

export function restorePlayerEntityHealth(
  source: PlayerEntityStore,
  playerId: string,
  amount: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = restorePlayerHealth(source.progressions[index]!, amount)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function restorePlayerEntityMana(
  source: PlayerEntityStore,
  playerId: string,
  amount: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = restorePlayerMana(source.progressions[index]!, amount)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function setPlayerEntityMana(
  source: PlayerEntityStore,
  playerId: string,
  currentMana: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = setPlayerMana(source.progressions[index]!, currentMana)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function setPlayerEntityMindstar(
  source: PlayerEntityStore,
  playerId: string,
  active: boolean,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const refreshed = setPlayerMindstarActive(
    source.skillRuntimes[index]!,
    active,
    source.skillBooks[index]!,
    source.statBooks[index]!,
    source.economies[index]!,
  )
  if (
    refreshed.runtime === source.skillRuntimes[index]
    && refreshed.skillBook === source.skillBooks[index]
  ) return source
  return replacePlayerSkillState(
    source,
    index,
    refreshed.skillBook,
    refreshed.runtime,
    source.economies[index]!,
  )
}

export function stepPlayerEntityCombatTick(
  source: PlayerEntityStore,
  actingPlayerIds: ReadonlySet<string> = new Set(),
  mutations: Readonly<{
    filterMana?: (playerId: string, delta: number, current: number, maximum: number) => number
    filterPoisonDamage?: (playerId: string, amount: number) => number
    manaCeiling?: (playerId: string, maximum: number) => number
  }> = {},
): PlayerEntityCombatTickResult {
  const autoHealthPotionPlayerIds: string[] = []
  const beganDeathEpochPlayerIds: string[] = []
  const cheatDeathPlayerIds: string[] = []
  const completedDeathPresentationPlayerIds: string[] = []
  const deathBurstPlayerIds: string[] = []
  const lastWordArchivePlayerIds: string[] = []
  const lastWordBurstPlayerIds: string[] = []
  let changed = false
  const economies = [...source.economies]
  const skillRuntimes = [...source.skillRuntimes]
  const progressions = [...source.progressions]
  for (const [index, progression] of source.progressions.entries()) {
    const derived = playerSkillDerivedStats(
      source.skillRuntimes[index]!,
      source.skillBooks[index]!,
      source.statBooks[index]!,
      progression,
      source.economies[index]!,
    )
    const skillTick = stepPlayerSkillRuntime(
      source.skillRuntimes[index]!,
      derived,
      {
        acting: source.primaryCasts[index]!.actionTick >= 0
          || actingPlayerIds.has(source.identities[index]!.playerId),
        moving: Math.hypot(
          source.locomotions[index]!.velocity.x,
          source.locomotions[index]!.velocity.y,
        ) > 0.01,
        primaryChannel: source.primaryCasts[index]!.channelActive
          ? selectedPurePrimaryChannel(source.skillBooks[index]!.primarySkillId)
          : null,
        primaryUnderpowered: source.primaryCasts[index]!.underpowered,
      },
    )
    skillRuntimes[index] = skillTick.runtime
    const potionStepped = stepPlayerPotionEffects(progression)
    const playerId = source.identities[index]!.playerId
    const baseManaRecoveryPerTick = mutations.filterMana
      ? mutations.filterMana(
          playerId,
          skillTick.baseManaRecoveryPerTick,
          potionStepped.currentMana,
          potionStepped.maximumMana,
        )
      : skillTick.baseManaRecoveryPerTick
    const nativePoisonDamagePerTick = Math.fround(
      potionStepped.poisonDamagePerTick
        * derived.poisonDamageFactor
        * derived.incomingDamageFactor,
    )
    const poisonDamagePerTick = mutations.filterPoisonDamage
      ? mutations.filterPoisonDamage(
          source.identities[index]!.playerId,
          nativePoisonDamagePerTick,
        )
      : nativePoisonDamagePerTick
    let result = stepPlayerCombatTick(potionStepped, {
      healthRecoveryPerTick: derived.healthRecoveryPerTick,
      manaCeiling: mutations.manaCeiling?.(playerId, potionStepped.maximumMana),
      manaRecoveryPerTick: baseManaRecoveryPerTick,
      poisonDamagePerTick,
    })
    const meditationManaRecoveryPerTick = skillTick.meditationManaRecoveryPerTick === 0
      ? 0
      : mutations.filterMana
        ? mutations.filterMana(
            playerId,
            skillTick.meditationManaRecoveryPerTick,
            result.combat.currentMana,
            result.combat.maximumMana,
          )
        : skillTick.meditationManaRecoveryPerTick
    if (meditationManaRecoveryPerTick !== 0 && result.combat.lifeState === 'alive') {
      result = {
        ...result,
        combat: setPlayerMana(result.combat, Math.max(0, Math.min(
          result.combat.maximumMana,
          result.combat.currentMana + meditationManaRecoveryPerTick,
        ))),
      }
    }
    const resolved = poisonDamagePerTick > 0 && potionStepped.poisonTicksRemaining > 0
      ? resolveNativeHagathaDamage(
          result.combat,
          source.economies[index]!,
          poisonDamagePerTick,
        )
      : {
          autoHealthPotionUsed: false,
          cheatDeathTriggered: false,
          economy: source.economies[index]!,
          progression: result.combat,
        }
    progressions[index] = resolved.progression
    economies[index] = resolved.economy
    if (resolved.autoHealthPotionUsed) autoHealthPotionPlayerIds.push(playerId)
    if (resolved.cheatDeathTriggered) cheatDeathPlayerIds.push(playerId)
    if (result.beganDeathEpoch && resolved.progression.lifeState === 'dying') {
      beganDeathEpochPlayerIds.push(playerId)
    }
    if (
      result.completedDeathPresentation
      && resolved.progression.lifeState === 'dying'
    ) completedDeathPresentationPlayerIds.push(playerId)
    if (result.emittedDeathBurst) deathBurstPlayerIds.push(playerId)
    if (
      ownsNativeHagathaSelector(
        source.economies[index]!.ownedPerkSelectors,
        NATIVE_HAGATHA_SELECTORS.lastWord,
      )
    ) {
      if (
        progression.deathTick < NATIVE_HAGATHA_LAST_WORD_DEATH_TICK
        && resolved.progression.deathTick >= NATIVE_HAGATHA_LAST_WORD_DEATH_TICK
      ) {
        lastWordBurstPlayerIds.push(playerId)
      }
      if (result.completedDeathPresentation) {
        lastWordArchivePlayerIds.push(playerId)
      }
    }
    changed ||= resolved.progression !== progression
      || resolved.economy !== source.economies[index]
      || skillTick.runtime !== source.skillRuntimes[index]
  }
  return {
    autoHealthPotionPlayerIds: Object.freeze(autoHealthPotionPlayerIds),
    beganDeathEpochPlayerIds: Object.freeze(beganDeathEpochPlayerIds),
    cheatDeathPlayerIds: Object.freeze(cheatDeathPlayerIds),
    completedDeathPresentationPlayerIds: Object.freeze(
      completedDeathPresentationPlayerIds,
    ),
    deathBurstPlayerIds: Object.freeze(deathBurstPlayerIds),
    lastWordArchivePlayerIds: Object.freeze(lastWordArchivePlayerIds),
    lastWordBurstPlayerIds: Object.freeze(lastWordBurstPlayerIds),
    store: changed ? { ...source, economies, progressions, skillRuntimes } : source,
  }
}

function selectedPurePrimaryChannel(
  skillId: PlayerSkillBookComponent['primarySkillId'],
): 'air' | 'earth' | 'ether' | 'fire' | 'water' | null {
  switch (skillId) {
    case 8: return 'ether'
    case 16: return 'fire'
    case 24: return 'air'
    case 32: return 'water'
    case 40: return 'earth'
    case 52: return null
  }
}

export function setPlayerEntitySpectating(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const progression = setPlayerSpectating(source.progressions[index]!)
  return progression === source.progressions[index]
    ? source
    : replacePlayerProgression(source, index, progression)
}

export function playerEntityCanAcceptInput(
  source: PlayerEntityStore,
  playerId: string,
): boolean {
  const progression = playerProgressionAt(source, playerId)
  return progression ? playerCanAcceptInput(progression) : false
}

export function playerEntityCanCast(
  source: PlayerEntityStore,
  playerId: string,
): boolean {
  const progression = playerProgressionAt(source, playerId)
  return progression ? playerCanCast(progression) : false
}

export function playerEntityDisplayHealth(
  source: PlayerEntityStore,
  playerId: string,
): number | null {
  const progression = playerProgressionAt(source, playerId)
  return progression ? playerDisplayHealth(progression) : null
}

export function playerEntityMovementScale(
  source: PlayerEntityStore,
  playerId: string,
): number {
  const progression = playerProgressionAt(source, playerId)
  const derived = playerSkillDerivedStatsAt(source, playerId)
  return progression && derived
    ? playerMovementScale(progression) * derived.movementFactor
    : 1
}

export function stepPlayerEntityOverlayLightingTick(
  source: PlayerEntityStore,
): PlayerEntityStore {
  let changed = false
  const lightings = source.lightings.map((lighting) => {
    const stepped = stepPlayerOverlayLighting(lighting)
    changed ||= stepped !== lighting
    return stepped
  })
  return changed ? { ...source, lightings } : source
}

export function resetPlayerEntitiesForNewRun(
  source: PlayerEntityStore,
  placements: Readonly<Record<string, PlayerCharacterState>>,
  lightRegistrations: Readonly<Record<string, NativeWorldManagerRegistration>> | null = null,
  options: Readonly<{ preserveConcentrations?: boolean }> = {},
): PlayerEntityStore {
  const placementIds = Object.keys(placements)
  if (
    placementIds.length !== source.identities.length
    || source.identities.some(({ playerId }) => !Object.hasOwn(placements, playerId))
  ) {
    throw new Error('new run requires exactly one placement for every player entity')
  }
  if (
    lightRegistrations !== null
    && (
      Object.keys(lightRegistrations).length !== source.identities.length
      || source.identities.some(({ playerId }) => !Object.hasOwn(lightRegistrations, playerId))
    )
  ) {
    throw new Error('new run requires exactly one light registration for every player entity')
  }
  const skillStates = source.identities.map((_, index) => {
    const created = createPlayerSkillRuntime(
      source.skillBooks[index]!,
      source.statBooks[index]!,
      source.economies[index]!,
    )
    if (options.preserveConcentrations !== true) return created
    const current = source.skillRuntimes[index]!
    return refreshPlayerSkillRuntime({
      ...created.runtime,
      concentrationSkillIdA: current.concentrationSkillIdA,
      concentrationSkillIdB: current.concentrationSkillIdB,
      nextConcentrationReplacementSlot: current.nextConcentrationReplacementSlot,
    }, created.skillBook, source.statBooks[index]!, source.economies[index]!)
  })
  const resetSkillBooks = skillStates.map(({ skillBook }) => skillBook)
  const progressions = source.progressions.map((progression, index) => {
    const reset = resetPlayerPotionEffects(resetPlayerCombatForNewRun(progression))
    const derived = playerSkillDerivedStats(
      skillStates[index]!.runtime,
      skillStates[index]!.skillBook,
      source.statBooks[index]!,
      reset,
      source.economies[index]!,
    )
    return refreshPlayerCombatFromSkillStats(reset, derived)
  })
  return {
    ...source,
    lightings: source.lightings.map((lighting, index) => createPlayerLighting(
      lightRegistrations === null
        ? lighting.lightRegistration
        : lightRegistrations[source.identities[index]!.playerId]!,
    )),
    locomotions: source.identities.map(({ playerId }) => (
      locomotionComponent(placements[playerId]!)
    )),
    primaryCasts: source.identities.map(({ playerId }, index) => (
      resetSelectedPlayerPrimaryCast(
        placements[playerId]!.primaryCast,
        resetSkillBooks[index]!,
      )
    )),
    progressions,
    skillBooks: resetSkillBooks.every((skillBook, index) => (
      skillBook === source.skillBooks[index]
    )) ? source.skillBooks : resetSkillBooks,
    skillRuntimes: skillStates.map(({ runtime }) => runtime),
  }
}

export function grantPlayerEntityExperience(
  source: PlayerEntityStore,
  playerId: string,
  amount: number,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) throw new Error(`player entity store has no player ${playerId}`)
  const previous = source.progressions[index]!
  const progressions = [...source.progressions]
  const granted = grantPlayerExperience(
    previous,
    source.skillBooks[index]!,
    amount,
    sourceGameplayRng,
    ownsSorcerorsCharm(source, index),
  )
  progressions[index] = granted.progression
  return finalizeNewPlayerEntitySkillOffer(
    { ...source, progressions },
    index,
    previous.pendingOffer?.sequence,
    granted.rng,
  )
}

export function creditPlayerEntityLootGold(
  source: PlayerEntityStore,
  playerId: string,
  amount: number,
): PlayerEntityStore {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return source
  const economies = [...source.economies]
  economies[index] = creditLootGold(economies[index]!, amount)
  return { ...source, economies }
}

export function insertPlayerEntityLootItem(
  source: PlayerEntityStore,
  playerId: string,
  item: HubInventoryItem,
): PlayerEntityLootItemResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { accepted: false, store: source }
  const inserted = insertLootInventoryItem(source.economies[index]!, item)
  if (!inserted.accepted) return { accepted: false, store: source }
  const economies = [...source.economies]
  economies[index] = inserted.state
  return { accepted: true, store: { ...source, economies } }
}

export function grantPlayerEntityInventoryItems(
  source: PlayerEntityStore,
  playerId: string,
  items: readonly HubInventoryItem[],
): PlayerEntityLootItemResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0 || items.length === 0) return { accepted: false, store: source }
  let economy = source.economies[index]!
  for (const item of items) {
    const inserted = insertLootInventoryItem(economy, item)
    if (!inserted.accepted) return { accepted: false, store: source }
    economy = inserted.state
  }
  if (
    projectInventoryItems(economy.backpack).length > NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT
    || !hubEconomyInventoryIsValid(economy)
  ) {
    return { accepted: false, store: source }
  }
  const economies = [...source.economies]
  economies[index] = economy
  return { accepted: true, store: { ...source, economies } }
}

export function grantPlayerEntitySkillRanks(
  source: PlayerEntityStore,
  playerId: string,
  skillId: number,
  ranks: number,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { rng: sourceGameplayRng, store: source }
  const previousSkillBook = source.skillBooks[index]!
  const skillBook = grantPlayerSkillRanks(previousSkillBook, skillId, ranks)
  const acquisitionCount = Math.max(
    0,
    (skillBook.permanentRanks[skillId] ?? 0)
      - (previousSkillBook.permanentRanks[skillId] ?? 0),
  )
  const reseeded = applyNativeSkillAcquisitionOfferSeeds(
    source.progressions[index]!,
    sourceGameplayRng,
    acquisitionCount,
  )
  return skillBook === previousSkillBook
    ? { rng: sourceGameplayRng, store: source }
    : refreshPendingPlayerSkillOffer(
        replacePlayerSkillState(
          replacePlayerProgression(source, index, reseeded.progression),
          index,
          skillBook,
          source.skillRuntimes[index]!,
          source.economies[index]!,
        ),
        index,
        reseeded.rng,
      )
}

export function grantPlayerEntityWeldBuild(
  source: PlayerEntityStore,
  playerId: string,
  buildId: number,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { rng: sourceGameplayRng, store: source }
  const previousSkillBook = source.skillBooks[index]!
  const skillBook = grantPlayerWeldBuild(previousSkillBook, buildId)
  const acquisitionCount = skillBook.permanentRanks.reduce((count, rank, skillId) => (
    count + Math.max(0, rank - (previousSkillBook.permanentRanks[skillId] ?? 0))
  ), 0)
  const reseeded = applyNativeSkillAcquisitionOfferSeeds(
    source.progressions[index]!,
    sourceGameplayRng,
    acquisitionCount,
  )
  return refreshPendingPlayerSkillOffer(
    replacePlayerSkillState(
      replacePlayerProgression(source, index, reseeded.progression),
      index,
      skillBook,
      source.skillRuntimes[index]!,
      source.economies[index]!,
    ),
    index,
    reseeded.rng,
  )
}

export function consumePlayerEntityWizardKey(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityLootItemResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { accepted: false, store: source }
  const consumed = consumeWizardKey(source.economies[index]!)
  if (!consumed.consumed) return { accepted: false, store: source }
  const economies = [...source.economies]
  economies[index] = consumed.state
  return { accepted: true, store: { ...source, economies } }
}

export function grantPlayerEntityBonusSkillChoice(
  source: PlayerEntityStore,
  playerId: string,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { rng: sourceGameplayRng, store: source }
  const granted = grantPlayerBonusSkillChoice(
    source.progressions[index]!,
    source.skillBooks[index]!,
    sourceGameplayRng,
    ownsSorcerorsCharm(source, index),
  )
  return finalizeNewPlayerEntitySkillOffer(
    replacePlayerProgression(source, index, granted.progression),
    index,
    source.progressions[index]!.pendingOffer?.sequence,
    granted.rng,
  )
}

export function increaseRandomPlayerEntitySkill(
  source: PlayerEntityStore,
  playerId: string,
  rng: NativeRngState,
): PlayerEntityRandomSkillIncreaseResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return { rng, skillId: null, store: source }
  const increased = increaseRandomLearnedSkill(source.skillBooks[index]!, rng)
  if (increased.skillId === null) return { ...increased, store: source }
  const reseeded = applyNativeSkillAcquisitionOfferSeeds(
    source.progressions[index]!,
    increased.rng,
    1,
  )
  const refreshed = replacePlayerSkillState(
    replacePlayerProgression(source, index, reseeded.progression),
    index,
    increased.skillBook,
    source.skillRuntimes[index]!,
    source.economies[index]!,
  )
  const autofilled = autofillPlayerEntitySkillSelections(
    refreshed,
    playerId,
    reseeded.rng,
  )
  const offered = refreshPendingPlayerSkillOffer(
    autofilled.store,
    index,
    autofilled.rng,
  )
  return {
    rng: offered.rng,
    skillId: increased.skillId,
    store: offered.store,
  }
}

export function grantSharedPlayerEntityExperience(
  source: PlayerEntityStore,
  playerId: string,
  amount: number,
  participantIds: readonly string[],
  sourceGameplayRng: NativeRngState,
): PlayerEntitySharedExperienceResult {
  const sourceIndex = playerEntityIndex(source, playerId)
  if (sourceIndex < 0) throw new Error(`player entity store has no player ${playerId}`)
  const stableParticipantIds = [...new Set(participantIds)].sort()
  if (!stableParticipantIds.includes(playerId)) {
    throw new Error('shared experience source must belong to the participant cohort')
  }
  for (const participantId of stableParticipantIds) {
    if (playerEntityIndex(source, participantId) < 0) {
      throw new Error(`shared experience cohort has no player ${participantId}`)
    }
  }
  const previous = source.progressions[sourceIndex]!
  let gameplayRng = sourceGameplayRng
  const awarded = grantPlayerExperience(
    previous,
    source.skillBooks[sourceIndex]!,
    amount,
    gameplayRng,
    ownsSorcerorsCharm(source, sourceIndex),
  )
  let finalized = finalizeNewPlayerEntitySkillOffer(
    replacePlayerProgression(source, sourceIndex, awarded.progression),
    sourceIndex,
    previous.pendingOffer?.sequence,
    awarded.rng,
  )
  gameplayRng = finalized.rng
  let store = finalized.store
  if (awarded.progression.level === previous.level) {
    return { milestone: null, rng: gameplayRng, store }
  }
  const crossedLevels = Object.freeze(Array.from(
    { length: awarded.progression.level - previous.level },
    (_, index) => previous.level + index + 1,
  ))
  const milestone: SharedPlayerLevelMilestone = Object.freeze({
    crossedLevels,
    experience: awarded.progression.experience,
    level: awarded.progression.level,
  })
  for (const participantId of stableParticipantIds) {
    const index = playerEntityIndex(store, participantId)
    if (index === sourceIndex) continue
    const previousProgression = store.progressions[index]!
    const synchronized = synchronizePlayerLevelMilestone(
      previousProgression,
      store.skillBooks[index]!,
      milestone,
      gameplayRng,
      ownsSorcerorsCharm(store, index),
    )
    finalized = finalizeNewPlayerEntitySkillOffer(
      replacePlayerProgression(store, index, synchronized.progression),
      index,
      previousProgression.pendingOffer?.sequence,
      synchronized.rng,
    )
    store = finalized.store
    gameplayRng = finalized.rng
  }
  return { milestone, rng: gameplayRng, store }
}

export function synchronizePlayerEntityLevelMilestone(
  source: PlayerEntityStore,
  playerId: string,
  milestone: SharedPlayerLevelMilestone,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) throw new Error(`player entity store has no player ${playerId}`)
  const previous = source.progressions[index]!
  const synchronized = synchronizePlayerLevelMilestone(
    previous,
    source.skillBooks[index]!,
    milestone,
    sourceGameplayRng,
    ownsSorcerorsCharm(source, index),
  )
  let progression = synchronized.progression
  if (progression.level > previous.level) {
    progression = {
      ...progression,
      currentHealth: progression.maximumHealth,
      currentMana: progression.maximumMana,
    }
  }
  return finalizeNewPlayerEntitySkillOffer(
    replacePlayerProgression(source, index, progression),
    index,
    previous.pendingOffer?.sequence,
    synchronized.rng,
  )
}

export function applyPlayerEntitySkillChoice(
  source: PlayerEntityStore,
  playerId: string,
  selection: { choiceIndex: number; offerSequence: number; skillId: number },
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult | null {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return null
  const applied = applyPlayerSkillChoice(
    source.progressions[index]!,
    source.skillBooks[index]!,
    selection,
    sourceGameplayRng,
    source.economies[index]!.ownedPerkSelectors,
  )
  if (!applied) return null
  const progressions = [...source.progressions]
  progressions[index] = applied.progression
  const refreshed = replacePlayerSkillState(
    { ...source, progressions },
    index,
    applied.skillBook,
    source.skillRuntimes[index]!,
    source.economies[index]!,
  )
  const autofilled = autofillPlayerEntitySkillSelections(
    refreshed,
    playerId,
    applied.rng,
  )
  const opened = openNextPlayerSkillOffer(
    autofilled.store.progressions[index]!,
    autofilled.store.skillBooks[index]!,
    autofilled.rng,
    ownsSorcerorsCharm(autofilled.store, index),
  )
  return finalizeNewPlayerEntitySkillOffer(
    replacePlayerProgression(autofilled.store, index, opened.progression),
    index,
    source.progressions[index]!.pendingOffer?.sequence,
    opened.rng,
  )
}

export function replacePlayerEntitySkillChoiceWithMod(
  source: PlayerEntityStore,
  playerId: string,
  offerSequence: number,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult | null {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return null
  const progression = replacePlayerSkillChoiceWithMod(
    source.progressions[index]!,
    offerSequence,
    sourceGameplayRng,
  )
  if (progression === null) return null
  const opened = openNextPlayerSkillOffer(
    progression.progression,
    source.skillBooks[index]!,
    progression.rng,
    ownsSorcerorsCharm(source, index),
  )
  return finalizeNewPlayerEntitySkillOffer(
    replacePlayerProgression(source, index, opened.progression),
    index,
    source.progressions[index]!.pendingOffer?.sequence,
    opened.rng,
  )
}

export function rerollPlayerEntitySkillOffer(
  source: PlayerEntityStore,
  playerId: string,
  offerSequence: number,
  nextOfferSeed: number,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult | null {
  const index = playerEntityIndex(source, playerId)
  if (index < 0 || !ownsSorcerorsCharm(source, index)) return null
  const progression = rerollPlayerSkillOffer(
    source.progressions[index]!,
    source.skillBooks[index]!,
    offerSequence,
    nextOfferSeed,
    sourceGameplayRng,
  )
  return progression === null
    ? null
    : finalizeNewPlayerEntitySkillOffer(
        replacePlayerProgression(source, index, progression.progression),
        index,
        source.progressions[index]!.pendingOffer?.sequence,
        progression.rng,
      )
}

export function deferPlayerEntitySkillChoice(
  source: PlayerEntityStore,
  playerId: string,
  offerSequence: number,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult | null {
  const index = playerEntityIndex(source, playerId)
  if (index < 0) return null
  const progression = deferPlayerSkillChoice(
    source.progressions[index]!,
    source.skillBooks[index]!,
    offerSequence,
    sourceGameplayRng,
    ownsSorcerorsCharm(source, index),
  )
  return progression === null
    ? null
    : finalizeNewPlayerEntitySkillOffer(
        replacePlayerProgression(source, index, progression.progression),
        index,
        source.progressions[index]!.pendingOffer?.sequence,
        progression.rng,
      )
}

function resolveNativeHagathaDamage(
  source: PlayerProgressionComponent,
  sourceEconomy: HubEconomyState,
  remainingDamage: number,
): Readonly<{
  autoHealthPotionUsed: boolean
  cheatDeathTriggered: boolean
  economy: HubEconomyState
  progression: PlayerProgressionComponent
}> {
  const hagathaRuntime = clearNativeHagathaUntilHurt(
    source.hagathaRuntime,
    remainingDamage,
  )
  let progression = hagathaRuntime === source.hagathaRuntime
    ? source
    : { ...source, hagathaRuntime }
  let economy = sourceEconomy
  let autoHealthPotionUsed = false
  if (
    progression.lifeState === 'lethal-pending'
    && nativeHagathaDrinkerShouldUseHealthPotion(
      economy.ownedPerkSelectors,
      progression.currentHealth,
    )
  ) {
    const potion = firstNativePotion(economy, 0)
    if (potion !== null) {
      const consumed = consumeInventoryItem(economy, potion.id)
      if (consumed.accepted) {
        economy = consumed.state
        progression = {
          ...applyPlayerPotionEffect(progression, 0),
          deathAgeTicks: 0,
          deathTick: 0,
          lifeState: 'alive',
        }
        autoHealthPotionUsed = true
      }
    }
  }
  let cheatDeathTriggered = false
  if (progression.lifeState === 'lethal-pending') {
    const cheatDeath = consumeNativeHagathaCheatDeath(
      progression.hagathaRuntime,
      progression.maximumHealth,
    )
    if (cheatDeath.triggered) {
      progression = {
        ...progression,
        currentHealth: cheatDeath.currentHealth,
        deathAgeTicks: 0,
        deathTick: 0,
        hagathaRuntime: cheatDeath.runtime,
        lifeState: 'alive',
      }
      cheatDeathTriggered = true
    }
  }
  return Object.freeze({
    autoHealthPotionUsed,
    cheatDeathTriggered,
    economy,
    progression,
  })
}

function firstNativePotion(
  economy: HubEconomyState,
  subtype: 0 | 1,
): HubInventoryItem | null {
  return projectInventoryItems(economy.backpack).find(({ item }) => (
    item.nativeTypeId === 7001
    && item.nativeSubtype === subtype
    && item.modContent === undefined
  ))?.item ?? null
}

function withoutIndex<T>(source: readonly T[], index: number): T[] {
  return [...source.slice(0, index), ...source.slice(index + 1)]
}

function replaceIndex<T>(source: readonly T[], index: number, value: T): readonly T[] {
  const replaced = [...source]
  replaced[index] = value
  return replaced
}

function replacePlayerProgression(
  source: PlayerEntityStore,
  index: number,
  progression: PlayerProgressionComponent,
): PlayerEntityStore {
  const progressions = [...source.progressions]
  progressions[index] = progression
  return { ...source, progressions }
}

function refreshPendingPlayerSkillOffer(
  source: PlayerEntityStore,
  index: number,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult {
  const progression = source.progressions[index]!
  if (progression.pendingOffer === null) return { rng: sourceGameplayRng, store: source }
  const built = buildPlayerSkillOffer(
    progression,
    source.skillBooks[index]!,
    progression.pendingOffer.sequence,
    sourceGameplayRng,
  )
  const progressions = [...source.progressions]
  progressions[index] = {
    ...progression,
    pendingOffer: built.offer,
    revision: progression.revision + 1,
  }
  return markCurrentPlayerEntityCreativityInsight(
    { ...source, progressions },
    index,
    built.rng,
  )
}

function finalizeNewPlayerEntitySkillOffer(
  source: PlayerEntityStore,
  index: number,
  previousOfferSequence: number | undefined,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult {
  const offer = source.progressions[index]!.pendingOffer
  if (offer === null || offer.sequence === previousOfferSequence) {
    return { rng: sourceGameplayRng, store: source }
  }
  return markCurrentPlayerEntityCreativityInsight(source, index, sourceGameplayRng)
}

function markCurrentPlayerEntityCreativityInsight(
  source: PlayerEntityStore,
  index: number,
  sourceGameplayRng: NativeRngState,
): PlayerEntityRngResult {
  const progression = source.progressions[index]!
  const offer = progression.pendingOffer
  if (offer === null) return { rng: sourceGameplayRng, store: source }
  const insight = markPlayerCreativityInsight(
    source.skillRuntimes[index]!,
    offer,
    source.skillBooks[index]!,
    source.statBooks[index]!,
    sourceGameplayRng,
  )
  return {
    rng: insight.rng,
    store: insight.offer === offer
      ? source
      : replacePlayerProgression(source, index, {
          ...progression,
          pendingOffer: insight.offer,
        }),
  }
}

function replacePlayerSkillState(
  source: PlayerEntityStore,
  index: number,
  skillBook: PlayerSkillBookComponent,
  runtime: PlayerSkillRuntimeComponent,
  economy: HubEconomyState,
): PlayerEntityStore {
  const previousSkillBook = source.skillBooks[index]!
  const refreshed = refreshPlayerSkillRuntime(
    runtime,
    skillBook,
    source.statBooks[index]!,
    economy,
  )
  const derived = playerSkillDerivedStats(
    refreshed.runtime,
    refreshed.skillBook,
    source.statBooks[index]!,
    source.progressions[index]!,
    economy,
  )
  const economies = [...source.economies]
  const belts = [...source.belts]
  const progressions = [...source.progressions]
  const skillBooks = [...source.skillBooks]
  const skillRuntimes = [...source.skillRuntimes]
  economies[index] = economy
  belts[index] = refreshNativePlayerBelt(
    autofillNewlyLearnedNativeBeltSkills(
      source.belts[index]!,
      previousSkillBook,
      refreshed.skillBook,
    ),
    refreshed.skillBook,
    economy,
  )
  const currentProgression = source.progressions[index]!
  const weldingOfferBias = nativeEquipmentHasFeature(
    refreshed.runtime.equipmentModifiers,
    'weldCalling',
  )
  const disciplineOfferBias = ownsNativeHagathaSelector(
    economy.ownedPerkSelectors,
    NATIVE_HAGATHA_SELECTORS.weirdCaster,
  )
  const biasedProgression = currentProgression.weldingOfferBias === weldingOfferBias
      && currentProgression.disciplineOfferBias === disciplineOfferBias
    ? currentProgression
    : { ...currentProgression, disciplineOfferBias, weldingOfferBias }
  progressions[index] = refreshPlayerCombatFromSkillStats(
    biasedProgression,
    derived,
  )
  skillBooks[index] = refreshed.skillBook
  skillRuntimes[index] = refreshed.runtime
  const replaced = { ...source, belts, economies, progressions, skillBooks, skillRuntimes }
  const primarySelectionChanged = refreshed.skillBook.primarySkillId
      !== previousSkillBook.primarySkillId
    || (
      refreshed.skillBook.primarySkillId === 52
      && refreshed.skillBook.weldBuildId !== previousSkillBook.weldBuildId
    )
  return primarySelectionChanged
    ? resetPlayerEntityPrimarySelection(replaced, index, refreshed.skillBook)
    : replaced
}

function ownsSorcerorsCharm(source: PlayerEntityStore, index: number): boolean {
  return source.economies[index]!.ownedPerkSelectors.includes(SORCERORS_CHARM_SELECTOR)
}

function locomotionComponent(character: PlayerCharacterState): PlayerLocomotionComponent {
  return {
    footstepTick: character.footstepTick,
    gaitDegrees: character.gaitDegrees,
    headingIndex: character.headingIndex,
    position: character.position,
    velocity: character.velocity,
    walkCyclePrimary: character.walkCyclePrimary,
  }
}

function playerCharacterProjection(
  source: PlayerEntityStore,
  index: number,
): PlayerCharacterState {
  return {
    config: source.configs[index]!,
    ...source.locomotions[index]!,
    primaryCast: source.primaryCasts[index]!,
  }
}
