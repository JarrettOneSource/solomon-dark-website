import {
  gameSimulationPlayerRecords,
  getPlayerBelt,
  getPlayerEconomy,
  getPlayerProgression,
  getPlayerSkillBook,
  getPlayerStatBook,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  hagathaOffers,
  projectInventoryRootSlots,
  SPLIT_MIND_CHARM_SELECTOR,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import { hubStudentSnapshotStates } from '../core-server/hub-students.ts'
import { boneyardGateSnapshot } from '../core-kernels/boneyard-gate.ts'
import {
  nativePlayerElementEffectPhase,
  playerLightDriveActive,
} from '../core-kernels/player-lighting.ts'
import {
  playerEntityDisplayHealth,
  playerEntityMovementScale,
  playerLightingAt,
  playerSkillDerivedStatsAt,
  playerSkillRuntimeAt,
} from '../core-server/player-entity-store.ts'
import type { BoneyardEnemySemanticEvent } from '../core-server/boneyard-enemy-store.ts'
import type {
  BoneyardEnemyEventSnapshot,
  GameSnapshot,
  HubPlayerActivity,
  ProtocolPlayerState,
  ProtocolStudentState,
} from '../protocol/game-state.ts'
import {
  projectBoneyardEnemies,
  projectBoneyardEnemyDeathEffects,
  projectBoneyardEnemyDeathEffect,
  projectBoneyardEnemyProjectiles,
  projectBoneyardEnemyProjectileEffects,
  projectBoneyardMageLightningPulses,
  projectBoneyardMaggots,
} from './project-boneyard-enemies.ts'
import { hubSkorchaHatFrame } from '../core-server/hub-skorcha.ts'
import { freezeNativeBelt } from '../core-kernels/native-belt.ts'
import { effectiveSkillNumericValue } from '../core-kernels/player-skill-runtime.ts'
import {
  nativeSecondaryAbilityManaCost,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  NATIVE_SECONDARY_ABILITY_IDS,
} from '../core-kernels/native-secondary-ability-contract.ts'

export function createGameSnapshot(
  state: GameSimulationState,
  hostPlayerId: string | null,
  hubActivities: Readonly<Record<string, HubPlayerActivity | null>> = {},
): GameSnapshot {
  const players = Object.fromEntries(Object.entries(gameSimulationPlayerRecords(state)).map(
    ([playerId, player]) => [playerId, protocolPlayerState(state, playerId, player)],
  ))
  switch (state.world.kind) {
    case 'hub':
      return {
        hostPlayerId,
        levelUpBarrier: state.levelUpBarrier,
        materializingPlayerIds: [],
        modEffects: state.modEffects,
        players,
        primarySpells: state.primarySpells,
        secondaryAbilities: protocolSecondaryAbilities(state.secondaryAbilities),
        run: state.run,
        tick: state.tick,
        world: {
          ambient: state.world.ambient,
          collisionRngState: state.world.collisionRngState,
          kind: 'hub',
          memorial: state.world.memorial,
          participants: Object.fromEntries(Object.entries(state.world.participants).map(
            ([playerId, participant]) => [playerId, {
              activity: hubActivities[playerId] ?? null,
              collegeIntro: participant.collegeIntro,
              region: participant.region,
              transition: participant.transition,
            }],
          )),
          skorcha: state.world.skorcha === null ? null : {
            dismissalIndex: state.world.skorcha.dismissalIndex,
            gesture: state.world.skorcha.gesture,
            gestureTicksRemaining: state.world.skorcha.gestureTicksRemaining,
            hatFrame: hubSkorchaHatFrame(state.world.skorcha),
            position: { ...state.world.skorcha.position },
            variant: state.world.skorcha.variant,
          },
          students: hubStudentSnapshotStates(state.world.studentPopulation)
            .map(protocolStudentState),
          traderAnimationSeed: state.world.traderAnimationSeed,
        },
      }
    case 'boneyard': {
      const runId = state.world.runId
      return {
        hostPlayerId,
        levelUpBarrier: state.levelUpBarrier,
        materializingPlayerIds: [],
        modEffects: state.modEffects,
        players,
        primarySpells: state.primarySpells,
        secondaryAbilities: protocolSecondaryAbilities(state.secondaryAbilities),
        run: state.run,
        tick: state.tick,
        world: {
          arenaTransition: state.world.arenaTransition === null
            ? null
            : {
                ...state.world.arenaTransition,
                cameraBounds: { ...state.world.arenaTransition.cameraBounds },
                combatBounds: { ...state.world.arenaTransition.combatBounds },
                fullBounds: { ...state.world.arenaTransition.fullBounds },
              },
          deathEffects: [
            ...projectBoneyardEnemyDeathEffects(state.world.enemies),
            ...state.world.loot.effects.map(projectBoneyardEnemyDeathEffect),
          ],
          encounter: state.world.encounter === null ? null : {
            acceleration: state.world.encounter.acceleration,
            digBodyOffsetY: state.world.encounter.digBodyOffsetY,
            digEvents: state.world.encounter.digEvents.map((event) => ({
              ...event,
            })),
            digFrame: state.world.encounter.digFrame,
            escapeSpeed: state.world.encounter.escapeSpeed,
            headingDeg: state.world.encounter.headingDeg,
            lifetimeTicksRemaining: state.world.encounter.lifetimeTicksRemaining,
            mouthPose: state.world.encounter.mouthPose,
            mouthPoseTicksRemaining: state.world.encounter.mouthPoseTicksRemaining,
            motion: state.world.encounter.motion,
            phase: state.world.encounter.phase,
            phaseTicksRemaining: state.world.encounter.phaseTicksRemaining,
            position: { ...state.world.encounter.position },
            runEventId: state.world.encounter.runEventId,
            targetPlayerId: state.world.encounter.targetPlayerId,
            transitionOffsetY: state.world.encounter.transitionOffsetY,
            turnRate: state.world.encounter.turnRate,
            voiceEvents: state.world.encounter.voiceEvents.map((event) => ({ ...event })),
            voiceTicksRemaining: state.world.encounter.voiceTicksRemaining,
            walkCycle: state.world.encounter.walkCycle,
          },
          enemies: projectBoneyardEnemies(state.world.enemies, state.tick),
          enemyEvents: state.world.enemyEvents.map((event) => (
            protocolBoneyardEnemyEvent(event, runId)
          )),
          enemyWorldFeedback: { ...state.world.enemyWorldFeedback },
          enemyProjectiles: projectBoneyardEnemyProjectiles(state.world.enemies),
          enemyProjectileEffects: projectBoneyardEnemyProjectileEffects(
            state.world.enemies,
          ),
          mageLightningPulses: projectBoneyardMageLightningPulses(state.world.enemies),
          maggots: projectBoneyardMaggots(state.world.enemies, state.tick),
          gateLeaves: state.world.gateLeaves.map(boneyardGateSnapshot),
          goodies: state.world.loot.goodies.map((goodie) => ({
            active: goodie.active,
            exhausted: goodie.exhausted,
            id: goodie.id,
            phase: goodie.phase,
            position: { ...goodie.position },
            sceneryRegistrationOrdinal: goodie.sceneryRegistrationOrdinal,
            subtype: goodie.subtype,
            timer: goodie.timer,
          })),
          hallOfFameRuns: Object.fromEntries(Object.entries(
            state.world.hallOfFameRuns,
          ).map(([playerId, run]) => [playerId, {
            awesomeness: run.awesomeness,
            awesomestKill: run.awesomestKill,
            elapsedTicks: run.elapsedTicks,
            monstersKilled: run.monstersKilled,
            portraitHeadingIndex: run.portraitHeadingIndex,
            portraitScale: run.portraitScale,
          }])),
          kind: 'boneyard',
          lanternLightRegistration: state.world.lanternLightRegistration,
          loot: state.world.loot.actors.map((actor) => ({
            activationDelayTicks: actor.activationDelayTicks,
            ageTicks: actor.ageTicks,
            alpha: actor.alpha,
            amount: actor.amount,
            animationPhase: actor.animationPhase,
            bonusKind: actor.bonusKind,
            bounceHeight: actor.bounceHeight,
            framePhase: actor.framePhase,
            id: actor.id,
            itemContentId: actor.item?.modContent?.contentId
              ?? actor.item?.modItemContent?.contentId
              ?? null,
            itemNativeSubtype: actor.item?.nativeSubtype ?? null,
            itemNativeTypeId: actor.item?.nativeTypeId ?? null,
            kind: actor.kind,
            nativeTypeId: actor.nativeTypeId,
            orbKind: actor.orbKind,
            orbValue: actor.orbValue,
            painterRegistration: actor.painterRegistration,
            position: { ...actor.position },
            rotationDeg: actor.rotationDeg,
            scatterActive: actor.scatterActive,
            scatterProgress: actor.scatterProgress,
            scatterSeed: actor.scatterSeed,
            source: actor.source,
            spawnTick: actor.spawnTick,
            tier: actor.tier,
          })),
          lootEvents: state.world.lootEvents.map((event) => ({
            ...event,
            position: { ...event.position },
            runId,
          })),
          runId,
          solomonPainterRegistration: state.world.solomonPainterRegistration,
          tutorial: state.world.tutorial,
          waves: state.world.waves === null ? null : {
            interwaveDelayTicks: state.world.waves.interwaveDelayTicks,
            pendingSpawnBudget: state.world.waves.pendingSpawnBudget,
            phase: state.world.waves.phase,
            scheduleIndex: state.world.waves.scheduleIndex,
            spawnDelayTicks: state.world.waves.spawnDelayTicks,
            waveEventId: state.world.waves.waveEventId,
            waveOrdinal: state.world.waves.waveOrdinal,
          },
        },
      }
    }
  }
}

function protocolBoneyardEnemyEvent(
  event: BoneyardEnemySemanticEvent,
  runId: string,
): BoneyardEnemyEventSnapshot {
  return {
    actorId: event.actorId,
    eventId: event.eventId,
    runId,
    tick: event.tick,
    type: event.type,
    ...(event.count === undefined ? {} : { count: event.count }),
    ...(event.deflectPitch === undefined ? {} : { deflectPitch: event.deflectPitch }),
    ...(event.gainScale === undefined ? {} : { gainScale: event.gainScale }),
    ...(event.output === undefined ? {} : { output: event.output }),
    ...(event.painterRegistration === undefined
      ? {}
      : { painterRegistration: event.painterRegistration }),
    ...(event.pitch === undefined ? {} : { pitch: event.pitch }),
    ...(event.projectileId === undefined ? {} : { projectileId: event.projectileId }),
    ...(event.sound === undefined ? {} : { sound: event.sound }),
    ...(event.sourcePosition === undefined
      ? {}
      : { sourcePosition: { ...event.sourcePosition } }),
    ...(event.targetPlayerId === undefined ? {} : { targetPlayerId: event.targetPlayerId }),
  }
}

function protocolPlayerState(
  state: GameSimulationState,
  playerId: string,
  player: Omit<ProtocolPlayerState, 'belt' | 'economy' | 'lighting' | 'movementScale' | 'progression'>,
): ProtocolPlayerState {
  const progression = getPlayerProgression(state, playerId)
  const economy = getPlayerEconomy(state, playerId)
  const lighting = playerLightingAt(state.playerEntities, playerId)
  if (!lighting) throw new Error(`game simulation has no player lighting ${playerId}`)
  const skillBook = getPlayerSkillBook(state, playerId)
  const statBook = getPlayerStatBook(state, playerId)
  const skillRuntime = playerSkillRuntimeAt(state.playerEntities, playerId)
  if (!skillRuntime) throw new Error(`game simulation has no player skill runtime ${playerId}`)
  const derived = playerSkillDerivedStatsAt(state.playerEntities, playerId)
  if (!derived) throw new Error(`game simulation has no player derived skill state ${playerId}`)
  const offensiveFactors = {
    damage: derived.offensiveDamageFactor,
    equipment: skillRuntime.equipmentModifiers,
    globalFlatDamage: derived.offensiveDamageFlat,
    globalManaReduction: derived.offensiveManaCostReduction,
    manaCost: derived.offensiveManaCostFactor,
  }
  const learnedSkills: Array<readonly [number, number, number]> = []
  for (let skillId = 0; skillId < skillBook.permanentRanks.length; skillId += 1) {
    const permanentRank = skillBook.permanentRanks[skillId] ?? 0
    const effectiveRank = skillBook.effectiveRanks[skillId] ?? 0
    if (permanentRank > 0 || effectiveRank > 0) {
      learnedSkills.push([skillId, permanentRank, effectiveRank])
    }
  }
  const secondaryManaCostAuthority = {
    explosiveShieldRawManaCost: effectiveSkillNumericValue(
      skillBook,
      statBook,
      55,
      'mManaCost',
    ),
    golemRawManaCost: effectiveSkillNumericValue(skillBook, statBook, 75, 'mManaCost'),
    magicStormRawManaCost: effectiveSkillNumericValue(skillBook, statBook, 28, 'mManaCost'),
    offensiveFactors,
    skillBook,
  }
  const secondaryManaCosts = NATIVE_SECONDARY_ABILITY_IDS.flatMap((skillId) => (
    (skillBook.effectiveRanks[skillId] ?? 0) < 1
      ? []
      : [[skillId, nativeSecondaryAbilityManaCost(
          secondaryManaCostAuthority,
          skillId,
        )] as const]
  ))
  return {
    ...player,
    belt: freezeNativeBelt(getPlayerBelt(state, playerId).map((entry) => (
      entry && { ...entry }
    ))),
    economy: {
      actionFeedback: economy.actionFeedback && { ...economy.actionFeedback },
      backpack: projectInventoryRootSlots(economy.backpack).map(({ item, slot }) => (
        protocolInventoryItem(item, slot)
      )),
      charmCapacity: economy.charmCapacity,
      collegeIntroPending: economy.collegeIntroPending,
      dowsingFee: economy.dowsingFee,
      dowsingOffers: economy.dowsingOffers.map((offer) => ({ ...offer })),
      equipment: {
        amulet: economy.equipment.amulet && protocolInventoryItem(economy.equipment.amulet),
        hat: economy.equipment.hat && protocolInventoryItem(economy.equipment.hat),
        rings: economy.equipment.rings.map((item) => item && protocolInventoryItem(item)) as [
          HubInventoryItem | null,
          HubInventoryItem | null,
          HubInventoryItem | null,
        ],
        robe: economy.equipment.robe && protocolInventoryItem(economy.equipment.robe),
        weapon: economy.equipment.weapon && protocolInventoryItem(economy.equipment.weapon),
      },
      fomentiusStock: economy.fomentiusStock.map((item) => ({
        ...protocolInventoryItem(item),
        price: item.price,
      })),
      gold: economy.gold,
      hagathaOffers: hagathaOffers(economy).map((offer) => ({
        ...offer,
        members: [...offer.members],
      })),
      npc: {
        boast: { ...economy.npc.boast },
        helpFlags: [...economy.npc.helpFlags],
        librarianLaceRead: economy.npc.librarianLaceRead,
      },
      ownedPerkSelectors: [...economy.ownedPerkSelectors],
      revision: economy.revision,
      storage: projectInventoryRootSlots(economy.storage).map(({ item, slot }) => (
        protocolInventoryItem(item, slot)
      )),
      tonicPurchases: economy.tonicPurchases,
      tutorialPending: economy.tutorialPending,
      unforgeBonuses: { ...economy.unforgeBonuses },
    },
    lighting: {
      deathWeaponPainterRegistration: lighting.deathWeaponPainterRegistration,
      driveActive: playerLightDriveActive(player.primaryCast, progression.lifeState),
      lightRegistration: lighting.lightRegistration,
      overlayEffectPhase: nativePlayerElementEffectPhase(
        player.primaryCast.weaponPulse,
        lighting.overlayEffectPhase,
      ),
    },
    movementScale: playerEntityMovementScale(state.playerEntities, playerId),
    progression: {
      advancedUnlocks: [...skillBook.advancedUnlocks],
      coldSlowTicksRemaining: progression.coldSlowTicksRemaining,
      concentrationSkillIds: [
        skillRuntime.concentrationSkillIdA,
        skillRuntime.concentrationSkillIdB,
      ],
      currentHealth: playerEntityDisplayHealth(state.playerEntities, playerId) ?? 0,
      currentMana: progression.currentMana,
      damageX4TicksRemaining: progression.damageX4TicksRemaining,
      deferredSkillChoices: progression.deferredSkillChoices,
      dazzleTicksRemaining: progression.dazzleTicksRemaining,
      deathEpoch: progression.deathEpoch,
      deathTick: progression.deathTick,
      experience: progression.experience,
      hagathaRuntime: { ...progression.hagathaRuntime },
      inventoryStats: {
        castSpeedPercent: Math.fround(derived.castProgressFactor * 100),
        magicResistancePercent: Math.fround(derived.magicResistance * 100),
        painResistancePercent: Math.fround(derived.damageResistance * 100),
        poisonResistancePercent: Math.fround(derived.poisonResistance * 100),
        walkSpeedPercent: Math.fround(derived.movementFactor * 100),
      },
      learnedSkills,
      learnedSkillOrder: [...skillBook.learnedSkillOrder],
      level: progression.level,
      maximumHealth: progression.maximumHealth,
      maximumMana: progression.maximumMana,
      mindChugTicksRemaining: progression.mindChugTicksRemaining,
      lifeState: progression.lifeState,
      lastDamageTick: progression.lastDamageTick,
      nextThreshold: progression.nextThreshold,
      pendingOffer: progression.pendingOffer,
      poisonDamagePerTick: progression.poisonDamagePerTick,
      poisonTicksRemaining: progression.poisonTicksRemaining,
      previousThreshold: progression.previousThreshold,
      revision: progression.revision,
      secondaryManaCosts,
      selectedPrimarySkillId: skillBook.primarySkillId,
      sorcerorsCharmAvailable: progression.sorcerorsCharmAvailable,
      splitMind: economy.ownedPerkSelectors.includes(SPLIT_MIND_CHARM_SELECTOR),
      weldBuildId: skillBook.weldBuildId,
      weldComponentRanks: skillBook.weldComponentRanks === null
        ? null
        : [...skillBook.weldComponentRanks],
    },
  }
}

function protocolSecondaryAbilities(
  state: GameSimulationState['secondaryAbilities'],
): Omit<GameSimulationState['secondaryAbilities'], 'firewalkerGeometrySequence' | 'rng'> {
  const {
    firewalkerGeometrySequence: _firewalkerGeometrySequence,
    rng: _rng,
    ...snapshot
  } = state
  return snapshot
}

function protocolInventoryItem(
  item: HubInventoryItem,
  inventorySlot: number | null = null,
): HubInventoryItem {
  const { inventorySlot: _inventorySlot, ...identity } = item
  return {
    ...identity,
    ...(inventorySlot === null ? {} : { inventorySlot }),
    ...(item.contents === undefined
      ? {}
      : {
          contents: projectInventoryRootSlots(item.contents).map(({ item: child, slot }) => (
            protocolInventoryItem(child, slot)
          )),
        }),
    iconRecords: [...item.iconRecords],
    ...(item.iconTints === undefined ? {} : { iconTints: [...item.iconTints] }),
    ...(item.nativeEffects === undefined
      ? {}
      : { nativeEffects: item.nativeEffects.map((effect) => ({ ...effect })) }),
  }
}

function protocolStudentState(
  student: ReturnType<typeof hubStudentSnapshotStates>[number],
): ProtocolStudentState {
  return {
    framePhase: student.framePhase,
    gaitDegrees: student.gaitDegrees,
    heading: student.heading,
    headingIndex: student.headingIndex,
    id: student.id,
    painterRegistration: student.painterRegistration,
    position: { ...student.position },
    props: student.props.map((prop) => ({ ...prop })),
    reading: student.reading,
    scale: student.scale,
  }
}
