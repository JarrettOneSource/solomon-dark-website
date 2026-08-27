import {
  createNativeHagathaRuntimeState,
  NATIVE_HAGATHA_SELECTORS,
} from '../core-kernels/native-hagatha-effects.ts'
import {
  createPlayerProgression,
  createPlayerSkillBook,
  nativeSkillCategory,
  playerStatBook,
  type NativePlayerPrimarySkillId,
  type PlayerSkillBookComponent,
} from '../core-kernels/player-progression.ts'
import {
  migrateSkillQuickbarToNativeBelt,
  nativeBeltSkillProjection,
  type PlayerBeltComponent,
} from '../core-kernels/native-belt.ts'
import {
  createPlayerSkillRuntime,
  playerSkillDerivedStats,
  setPlayerConcentrationSlot,
} from '../core-kernels/player-skill-runtime.ts'
import type {
  PlayerCharacterConfig,
  WizardDiscipline,
  WizardElement,
} from '../core-kernels/player-character.ts'
import {
  createNativeSecondaryPlayerState,
} from '../core-kernels/native-secondary-abilities.ts'
import { nativeHagathaOutcomeStateIsValid } from '../core-kernels/hub-economy.ts'
import {
  createGameSimulation,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  createGameSaveDocument,
  restoreGameSaveDocument,
  restoreGameSaveProfile,
} from './game-save-document.ts'
import {
  createNativeGameSaveSource,
  createPortableGameProfileFromNative,
  encodePortableGameProfile,
  nativeSourceBytes,
  parsePortableGameProfile,
  validateNativeGameSaveSource,
  type NativeGameSaveSource,
  type PortableGameProfile,
} from './portable-game-profile.ts'
import {
  NATIVE_FIRST_MIX_COUNT,
  NATIVE_HAGATHA_OWNERSHIP_COUNT,
  loadNativeHubTemplate,
  patchNativeDarkdata,
  patchNativeGamestate,
} from './native-save-bridge.ts'
import { createNativeSaveArchive } from './native-save-archive.ts'
import { NativeSaveFormatError } from './native-save-codec.ts'

const ELEMENT_BY_ROOT: Readonly<Record<number, WizardElement>> = Object.freeze({
  0: 'ether',
  1: 'fire',
  2: 'air',
  3: 'water',
  4: 'earth',
})
const DISCIPLINE_BY_ROOT: Readonly<Record<number, WizardDiscipline>> = Object.freeze({
  5: 'body',
  6: 'mind',
  7: 'arcane',
})
const STARTING_SKILLS: Readonly<Record<WizardElement, readonly [number, number]>> = Object.freeze({
  air: Object.freeze([24, 27] as const),
  earth: Object.freeze([40, 45] as const),
  ether: Object.freeze([8, 11] as const),
  fire: Object.freeze([16, 21] as const),
  water: Object.freeze([32, 35] as const),
})

export interface PortableImportResult {
  readonly character: PlayerCharacterConfig
  readonly document: string
  readonly playerId: string
  readonly warnings: readonly string[]
}

export interface PortableExportResult {
  readonly archive: Uint8Array
  readonly portable: PortableGameProfile
  readonly warnings: readonly string[]
}

function portableCharacter(profile: PortableGameProfile): PlayerCharacterConfig {
  const element = ELEMENT_BY_ROOT[profile.wizard.elementRoot]
  const discipline = DISCIPLINE_BY_ROOT[profile.wizard.disciplineRoot]
  if (!element || !discipline) throw new NativeSaveFormatError('portable class roots are invalid')
  const [primary, secondary] = STARTING_SKILLS[element]
  if (
    profile.wizard.startingPrimary !== primary
    || profile.wizard.startingSecondary !== secondary
  ) throw new NativeSaveFormatError('portable class roots and starting spells disagree')
  return Object.freeze({ discipline, displayName: profile.wizard.name, element })
}

function importedSkillBook(
  profile: PortableGameProfile,
  character: PlayerCharacterConfig,
): PlayerSkillBookComponent {
  const base = createPlayerSkillBook(character)
  const permanentRanks = profile.wizard.permanentRanks.map(Number)
  for (let root = 0; root < 8; root += 1) permanentRanks[root] = 1
  const learnedOrder = [...profile.wizard.learnedOrder]
  for (let skillId = 8; skillId <= 79; skillId += 1) {
    if ((permanentRanks[skillId] ?? 0) > 0 && !learnedOrder.includes(skillId)) {
      learnedOrder.push(skillId)
    }
  }
  const advancedUnlocks = profile.wizard.advancedUnlocks.map((unlocked, index) => (
    unlocked || (permanentRanks[index + 72] ?? 0) > 0
  ))
  const selectedPrimary = profile.wizard.selectedPrimarySkillId
  const primarySkillId = (
    selectedPrimary === 8
    || selectedPrimary === 16
    || selectedPrimary === 24
    || selectedPrimary === 32
    || selectedPrimary === 40
  ) && (permanentRanks[selectedPrimary] ?? 0) > 0
    ? selectedPrimary
    : base.primarySkillId
  return Object.freeze({
    ...base,
    advancedUnlocks: Object.freeze(advancedUnlocks),
    disciplineRoot: profile.wizard.disciplineRoot,
    effectiveRanks: Object.freeze([...permanentRanks]),
    elementRoot: profile.wizard.elementRoot,
    learnedSkillOrder: Object.freeze(learnedOrder),
    permanentRanks: Object.freeze(permanentRanks),
    primarySkillId: primarySkillId as NativePlayerPrimarySkillId,
    weldBuildId: null,
    weldComponentRanks: null,
  })
}

function importedBelt(
  profile: PortableGameProfile,
  skillBook: PlayerSkillBookComponent,
): PlayerBeltComponent {
  return migrateSkillQuickbarToNativeBelt(profile.wizard.skillQuickbar.map(skillId => (
    skillId !== null
    && skillId !== 52
    && (skillBook.permanentRanks[skillId] ?? 0) > 0
    && (nativeSkillCategory(skillId) === 1 || nativeSkillCategory(skillId) === 2)
      ? skillId
      : null
  )))
}

function importPortableState(
  profile: PortableGameProfile,
  playerId: string,
  character: PlayerCharacterConfig,
): GameSimulationState {
  let state = createGameSimulation({ [playerId]: character }, {
    gameRngSeed: profile.wizard.offerSeed,
  })
  const economy = state.playerEntities.economies[0]
  if (!economy) throw new NativeSaveFormatError('portable import has no economy owner')
  const ownedPerkSelectors = [...profile.wizard.perkSelectors]
  const tonicPurchases = ownedPerkSelectors.filter(selector => selector === 27).length
  if (!nativeHagathaOutcomeStateIsValid(
    ownedPerkSelectors,
    tonicPurchases,
    profile.wizard.perkCapacity,
  )) throw new NativeSaveFormatError('portable Hagatha outcome state is invalid')
  const npc = {
    ...economy.npc,
    boast: Object.freeze({
      failed: profile.profile.boast.failed,
      failureSequence: profile.profile.boast.failed ? 1 : 0,
      selected: profile.profile.boast.selected,
      succeeded: profile.profile.boast.succeeded,
    }),
    helpFlags: Object.freeze([...profile.profile.helpPending]),
    librarianLaceRead: profile.profile.librarianLaceRead,
  }
  const importedEconomy = Object.freeze({
    ...economy,
    charmCapacity: profile.wizard.perkCapacity,
    collegeIntroPending: profile.profile.tutorialPending,
    dowsingFee: profile.profile.dowsingFee,
    firstMixedSelectors: Object.freeze(profile.profile.firstMixed.flatMap((mixed, selector) => (
      mixed ? [selector] : []
    ))),
    gold: profile.profile.gold,
    hagathaBundleSelectors: Object.freeze([...profile.profile.hagathaBundleSelectors]),
    npc,
    ownedPerkSelectors: Object.freeze(ownedPerkSelectors),
    revision: economy.revision + 1,
    tutorialPending: profile.profile.tutorialPending,
    tonicPurchases,
    unforgeBonuses: Object.freeze({
      ...economy.unforgeBonuses,
      experience: profile.wizard.experienceBonus,
      manaCostReduction: profile.wizard.manaCostReduction,
      offensiveDamage: profile.wizard.offensiveDamageFlat,
    }),
  })
  const skillBook = importedSkillBook(profile, character)
  const statBook = playerStatBook()
  const hagathaRuntime = Object.freeze({
    ...createNativeHagathaRuntimeState(),
    cheatDeathCharges: profile.wizard.cheatDeathCharges,
  })
  let skillState = createPlayerSkillRuntime(skillBook, statBook, importedEconomy)
  for (const slot of [0, 1] as const) {
    const skillId = profile.wizard.concentrationSkillIds[slot]
    if (
      skillId !== null
      && (skillBook.permanentRanks[skillId] ?? 0) > 0
      && nativeSkillCategory(skillId) === 3
      && (slot === 0 || importedEconomy.ownedPerkSelectors.includes(21))
    ) {
      skillState = setPlayerConcentrationSlot(
        skillState.runtime,
        skillState.skillBook,
        statBook,
        importedEconomy,
        skillId,
        slot,
      )
    }
  }
  skillState = Object.freeze({
    ...skillState,
    runtime: Object.freeze({
      ...skillState.runtime,
      nextConcentrationReplacementSlot: profile.wizard.nextConcentrationSlot === 0
        ? 'a'
        : 'b',
    }),
  })
  const derived = playerSkillDerivedStats(
    skillState.runtime,
    skillState.skillBook,
    statBook,
    {
      damageX4TicksRemaining: 0,
      hagathaRuntime,
      mindChugTicksRemaining: 0,
    },
    importedEconomy,
  )
  const restoredVital = (current: number, savedMaximum: number, maximum: number) => (
    Math.fround(maximum * Math.fround(current / savedMaximum))
  )
  const baseProgression = createPlayerProgression(profile.wizard.offerSeed)
  const pendingChoiceCount = profile.wizard.pendingSkillChoices
  const progression = Object.freeze({
    ...baseProgression,
    currentHealth: restoredVital(
      profile.wizard.currentHealth,
      profile.wizard.maximumHealth,
      derived.maximumHealth,
    ),
    currentMana: restoredVital(
      profile.wizard.currentMana,
      profile.wizard.maximumMana,
      derived.maximumMana,
    ),
    deferredSkillChoices: profile.wizard.deferredSkillChoices,
    experience: profile.wizard.experience,
    hagathaRuntime,
    level: profile.wizard.level,
    maximumHealth: derived.maximumHealth,
    maximumMana: derived.maximumMana,
    nextThreshold: profile.wizard.nextThreshold,
    offerSeed: profile.wizard.offerSeed,
    pendingLevels: Object.freeze(Array.from(
      { length: pendingChoiceCount },
      () => profile.wizard.level,
    )),
    poisonImmunityTicksRemaining: profile.wizard.poisonImmunityTicks,
    previousThreshold: profile.wizard.previousThreshold,
    revision: baseProgression.revision + 1,
  })
  const secondaryPlayer = {
    ...createNativeSecondaryPlayerState(),
    firewalker: profile.wizard.firewalkerActive,
    reservedMana: profile.wizard.firewalkerActive ? 50 : 0,
  }
  state = {
    ...state,
    levelUpBarrier: pendingChoiceCount === 0 ? null : Object.freeze({
      barrierId: 1,
      milestoneExperience: profile.wizard.experience,
      milestoneLevel: profile.wizard.level,
      participantIds: Object.freeze([playerId]),
      pendingPlayerIds: Object.freeze([playerId]),
      runId: null,
      sourcePlayerId: playerId,
    }),
    nextLevelUpBarrierId: pendingChoiceCount === 0 ? 1 : 2,
    playerEntities: {
      ...state.playerEntities,
      belts: Object.freeze([importedBelt(profile, skillState.skillBook)]),
      economies: Object.freeze([importedEconomy]),
      progressions: Object.freeze([progression]),
      skillBooks: Object.freeze([skillState.skillBook]),
      skillRuntimes: Object.freeze([skillState.runtime]),
      statBooks: Object.freeze([statBook]),
    },
    secondaryAbilities: {
      ...state.secondaryAbilities,
      players: Object.freeze({ [playerId]: Object.freeze(secondaryPlayer) }),
    },
  }
  return state
}

export function createWebGameSaveFromPortableProfile(
  profile: PortableGameProfile,
): PortableImportResult {
  const character = portableCharacter(profile)
  const playerId = `native-${profile.nativeSource.gamestateSha256.slice(0, 24)}`
  const state = importPortableState(profile, playerId, character)
  const importedBook = state.playerEntities.skillBooks[0]!
  const importedBeltSkills = nativeBeltSkillProjection(state.playerEntities.belts[0]!)
  const importedRuntime = state.playerEntities.skillRuntimes[0]!
  const warnings = [
    ...profile.warnings,
    ...(profile.profile.nativeStorage.payloadLength !== 4
      || profile.profile.nativeStorage.childCount !== 0
      ? ['Native Luthacus storage remains in the source attachment and is not available during web play.']
      : []),
    ...(profile.wizard.advancedUnlocks.some((unlocked, index) => (
      unlocked && profile.wizard.permanentRanks[index + 72] === 0
    ))
      ? ['Purchased-but-unlearned advanced spells are a web retention extension and cannot be reconstructed from retail disk bytes.']
      : []),
    ...(importedBook.primarySkillId !== profile.wizard.selectedPrimarySkillId
      ? ['Stock selected a transient Plane Orb or a Weld whose build identity is not on disk; web play starts on the creation-element primary.']
      : []),
    ...(profile.wizard.skillQuickbar.some((skillId, slot) => (
      skillId !== importedBeltSkills[slot]
    ))
      ? ['Native Belt entries that depend on an unpersisted Weld build or non-durable effective rank remain in the native attachment but are unavailable in web play.']
      : []),
    ...(profile.wizard.concentrationSkillIds.some((skillId, slot) => (
      skillId !== (slot === 0
        ? importedRuntime.concentrationSkillIdA
        : importedRuntime.concentrationSkillIdB)
    ))
      ? ['Native concentrations backed only by non-materialized equipment state reset during web import.']
      : []),
  ]
  return Object.freeze({
    character,
    document: createGameSaveDocument({
      integrity: 'local-only',
      loadedBoneyard: null,
      mods: [],
      modState: {},
      nativeSource: profile.nativeSource,
      playerId,
      state,
    }),
    playerId,
    warnings: Object.freeze(warnings),
  })
}

async function sourceForWebExport(
  source: NativeGameSaveSource | null,
): Promise<NativeGameSaveSource> {
  if (source !== null) return validateNativeGameSaveSource(source)
  const template = await loadNativeHubTemplate()
  return createNativeGameSaveSource(
    template.darkdata,
    template.gamestate,
    template.runName,
  )
}

export async function createPortableGameProfileFromWebSave(
  document: string,
): Promise<PortableGameProfile> {
  const restored = restoreGameSaveDocument(document)
  const profile = restoreGameSaveProfile(document)
  const source = await sourceForWebExport(restored.nativeSource)
  const sourceBytes = nativeSourceBytes(source)
  const base = await createPortableGameProfileFromNative(
    sourceBytes.darkdata,
    sourceBytes.gamestate,
    source.runName,
    sourceBytes.retainedFiles,
  )
  const index = restored.state.playerEntities.identities.findIndex(
    identity => identity.playerId === restored.playerId,
  )
  if (index < 0) throw new NativeSaveFormatError('web save has no portable wizard owner')
  const character = restored.state.playerEntities.configs[index]
  const progression = restored.state.playerEntities.progressions[index]
  const skillBook = restored.state.playerEntities.skillBooks[index]
  const belt = restored.state.playerEntities.belts[index]
  const skillRuntime = restored.state.playerEntities.skillRuntimes[index]
  const wizardEconomy = restored.state.playerEntities.economies[index]
  if (!character || !progression || !skillBook || !belt || !skillRuntime || !wizardEconomy) {
    throw new NativeSaveFormatError('web save portable wizard components are incomplete')
  }
  const [startingPrimary, startingSecondary] = STARTING_SKILLS[character.element]
  const secondary = restored.state.secondaryAbilities.players[restored.playerId]
    ?? createNativeSecondaryPlayerState()
  const derived = playerSkillDerivedStats(
    skillRuntime,
    skillBook,
    restored.state.playerEntities.statBooks[index]!,
    progression,
    profile.economy,
  )
  const firstMixed = Array.from({ length: NATIVE_FIRST_MIX_COUNT }, (_, selector) => (
    profile.economy.firstMixedSelectors.includes(selector)
  ))
  const hagathaOwnership = Array.from(
    { length: NATIVE_HAGATHA_OWNERSHIP_COUNT },
    (_, selector) => selector === 8 || selector >= 28
      ? base.wizard.hagathaOwnership[selector]!
      : selector === 27
        ? profile.economy.tonicPurchases > 0
        : profile.economy.ownedPerkSelectors.includes(selector),
  )
  const beltSkills = nativeBeltSkillProjection(belt)
  const warnings = [
    ...base.warnings,
    ...(profile.economy.storage.length > 0
      ? ['Web Luthacus storage cannot replace the opaque retail item tree; the native attachment keeps its prior storage.']
      : []),
    ...(profile.economy.tutorialPending !== profile.economy.collegeIntroPending
      ? ['Retail has one first-play gate; export combines the browser Tutorial and College obligations.']
      : []),
    ...(skillBook.advancedUnlocks.some((unlocked, offset) => (
      unlocked && (skillBook.permanentRanks[offset + 72] ?? 0) === 0
    ))
      ? ['Purchased-but-unlearned advanced spells cannot persist in an unmodified retail save.']
      : []),
    ...(profile.hagathaRuntime.serendipityActive || profile.hagathaRuntime.reverieActive
      ? ['Active Serendipity/Reverie until-hurt effects are not retail disk members and reset in stock.']
      : []),
    ...(profile.economy.unforgeBonuses.maximumHealth !== 0
      || profile.economy.unforgeBonuses.maximumMana !== 0
      ? ['Web Unforge maximum-health/maximum-mana base bonuses have no retail disk fields and reset after stock reload.']
      : []),
    ...(skillBook.primarySkillId === 52 || beltSkills.includes(52)
      ? ['Retail does not serialize the active synthetic Weld build ID; selected or belted Spell Welding resets to the creation-element primary on stock export.']
      : []),
  ]
  const portableSeed: PortableGameProfile = Object.freeze({
    ...base,
    nativeSource: source,
    profile: Object.freeze({
      ...base.profile,
      boast: Object.freeze({
        failed: wizardEconomy.npc.boast.failed,
        selected: wizardEconomy.npc.boast.selected,
        succeeded: wizardEconomy.npc.boast.succeeded,
      }),
      dowsingFee: profile.economy.dowsingFee,
      firstMixed: Object.freeze(firstMixed),
      gold: profile.economy.gold,
      hagathaBundleSelectors: Object.freeze([...profile.economy.hagathaBundleSelectors]),
      helpPending: Object.freeze([...profile.economy.npc.helpFlags]),
      librarianLaceRead: profile.economy.npc.librarianLaceRead,
      tutorialPending: profile.economy.tutorialPending || profile.economy.collegeIntroPending,
    }),
    warnings: Object.freeze(warnings),
    wizard: Object.freeze({
      ...base.wizard,
      advancedUnlocks: Object.freeze([...skillBook.advancedUnlocks]),
      cheatDeathCharges: progression.hagathaRuntime.cheatDeathCharges,
      cheatDeathEnabled: profile.economy.ownedPerkSelectors.includes(
        NATIVE_HAGATHA_SELECTORS.cheatDeath,
      ),
      concentrationSkillIds: Object.freeze([
        skillRuntime.concentrationSkillIdA,
        skillRuntime.concentrationSkillIdB,
      ] as const),
      currentHealth: progression.currentHealth,
      currentMana: progression.currentMana,
      deferredSkillChoices: progression.deferredSkillChoices,
      disciplineRoot: skillBook.disciplineRoot,
      elementRoot: skillBook.elementRoot,
      experience: progression.experience,
      experienceBonus: profile.economy.unforgeBonuses.experience,
      firewalkerActive: secondary.firewalker,
      hagathaOwnership: Object.freeze(hagathaOwnership),
      learnedOrder: Object.freeze([...skillBook.learnedSkillOrder]),
      level: progression.level,
      manaCostReduction: profile.economy.unforgeBonuses.manaCostReduction,
      maximumHealth: progression.maximumHealth,
      maximumMana: progression.maximumMana,
      meditationIdleDelay: derived.meditationIdleDelayTicks,
      name: character.displayName,
      nextConcentrationSlot: skillRuntime.nextConcentrationReplacementSlot === 'a' ? 0 : 1,
      nextThreshold: progression.nextThreshold,
      offerSeed: progression.offerSeed,
      offensiveDamageFlat: profile.economy.unforgeBonuses.offensiveDamage,
      pendingSkillChoices: progression.pendingLevels.length,
      perkCapacity: profile.economy.charmCapacity,
      perkSelectors: Object.freeze([...profile.economy.ownedPerkSelectors]),
      permanentRanks: Object.freeze([...skillBook.permanentRanks]),
      poisonImmunityTicks: progression.poisonImmunityTicksRemaining,
      previousThreshold: progression.previousThreshold,
      selectedPrimarySkillId: skillBook.primarySkillId === 52
        ? startingPrimary
        : skillBook.primarySkillId,
      skillQuickbar: Object.freeze(beltSkills.map(skillId => (
        skillId === 52 ? null : skillId
      ))),
      startingPrimary,
      startingSecondary,
      weldEffect: skillRuntime.equipmentModifiers.weldEffect,
    }),
  })
  const darkdata = patchNativeDarkdata(sourceBytes.darkdata, portableSeed.profile)
  const gamestate = patchNativeGamestate(
    sourceBytes.gamestate,
    portableSeed.wizard,
    portableSeed.profile.boast,
  )
  const portable = Object.freeze({
    ...portableSeed,
    nativeSource: await createNativeGameSaveSource(
      darkdata,
      gamestate,
      source.runName,
      sourceBytes.retainedFiles,
    ),
  })
  return parsePortableGameProfile(encodePortableGameProfile(portable))
}

export async function exportWebGameSaveToNativeArchive(
  document: string,
): Promise<PortableExportResult> {
  const portable = await createPortableGameProfileFromWebSave(document)
  const bytes = nativeSourceBytes(portable.nativeSource)
  return Object.freeze({
    archive: await createNativeSaveArchive({
      darkdata: bytes.darkdata,
      gamestate: bytes.gamestate,
      retainedFiles: bytes.retainedFiles,
      runName: portable.nativeSource.runName,
    }),
    portable,
    warnings: portable.warnings,
  })
}
