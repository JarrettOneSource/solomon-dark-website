import type { PlayerCharacterConfig } from '../../core-kernels/player-character.ts'
import {
  NATIVE_PLAYER_MAX_LIGHT_OVERLAY,
  playerLightDriveActive,
} from '../../core-kernels/player-lighting.ts'
import { SPELL_WELDING_SKILL_ID } from '../../core-kernels/player-progression.ts'
import { primaryCastActionEndTick } from '../../core-kernels/primary-spells.ts'
import type { ProtocolPlayerSnapshotFrame, ProtocolPlayerState } from '../game-state.ts'
import { playerBelt, playerEconomy } from './economy.ts'
import { playerCharacterConfig } from './input.ts'
import {
  nativeWorldManagerRegistration,
  nullableNativeWorldManagerRegistration,
  unitVector,
  vector,
} from './native-state.ts'
import { playerProgression } from './stats.ts'
import {
  GameProtocolError,
  boolean,
  boundedInteger,
  finite,
  integer,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  record,
} from './values.ts'

export function playerState(value: unknown, field: string): ProtocolPlayerState {
  const player = playerSnapshotFrame(value, field)
  if (!player.economy) throw new GameProtocolError(`${field}.economy is required`)
  return { ...player, economy: player.economy }
}

export function playerSnapshotFrame(value: unknown, field: string): ProtocolPlayerSnapshotFrame {
  const source = record(value, field)
  onlyKeys(source, field, [
    'belt',
    'config',
    'economy',
    'footstepTick',
    'gaitDegrees',
    'headingIndex',
    'lighting',
    'movementScale',
    'position',
    'primaryCast',
    'progression',
    'velocity',
    'walkCyclePrimary',
  ])
  const config = playerCharacterConfig(source.config, `${field}.config`)
  const economy = source.economy === undefined
    ? undefined
    : playerEconomy(source.economy, `${field}.economy`)
  const progression = playerProgression(source.progression, `${field}.progression`)
  const belt = playerBelt(source.belt, `${field}.belt`, progression, economy)
  const primaryCast = playerPrimaryCastState(
    source.primaryCast,
    `${field}.primaryCast`,
    config.element,
    progression.selectedPrimarySkillId,
    progression.weldBuildId,
  )
  const lighting = playerLighting(source.lighting, `${field}.lighting`)
  if (lighting.driveActive !== playerLightDriveActive(primaryCast, progression.lifeState)) {
    throw new GameProtocolError(`${field}.lighting.driveActive is inconsistent with player state`)
  }
  return {
    belt,
    config,
    ...(economy ? { economy } : {}),
    footstepTick: nonnegativeInteger(source.footstepTick, `${field}.footstepTick`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    lighting,
    movementScale: nonnegativeFinite(source.movementScale, `${field}.movementScale`),
    position: vector(source.position, `${field}.position`),
    primaryCast,
    progression,
    velocity: vector(source.velocity, `${field}.velocity`),
    walkCyclePrimary: finite(source.walkCyclePrimary, `${field}.walkCyclePrimary`),
  }
}

function playerLighting(
  value: unknown,
  field: string,
): ProtocolPlayerState['lighting'] {
  const source = record(value, field)
  onlyKeys(source, field, [
    'blindnessTicksRemaining',
    'deathWeaponPainterRegistration',
    'driveActive',
    'lightRegistration',
    'overlayEffectPhase',
  ])
  const overlayEffectPhase = finite(source.overlayEffectPhase, `${field}.overlayEffectPhase`)
  if (overlayEffectPhase < 0 || overlayEffectPhase > NATIVE_PLAYER_MAX_LIGHT_OVERLAY) {
    throw new GameProtocolError(`${field}.overlayEffectPhase is outside the native domain`)
  }
  return {
    blindnessTicksRemaining: nonnegativeFinite(source.blindnessTicksRemaining, `${field}.blindnessTicksRemaining`),
    deathWeaponPainterRegistration: nullableNativeWorldManagerRegistration(
      source.deathWeaponPainterRegistration,
      `${field}.deathWeaponPainterRegistration`,
      'actor',
    ),
    driveActive: boolean(source.driveActive, `${field}.driveActive`),
    lightRegistration: nativeWorldManagerRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    overlayEffectPhase,
  }
}

function playerPrimaryCastState(
  value: unknown,
  field: string,
  element: PlayerCharacterConfig['element'],
  selectedPrimarySkillId: number,
  weldBuildId: number | null,
): ProtocolPlayerState['primaryCast'] {
  const activeWeldBuildId = selectedPrimarySkillId === 52 ? weldBuildId : null
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionTick',
    'aimDirection',
    'castSequence',
    'channelActive',
    'emissionSequence',
    'etherBlastCharge',
    'etherBlastChargeCueSequence',
    'fizzleSequence',
    'held',
    'lastWeldPlaybackRate',
    'lastWeldSoundVariant',
    'oneShotAttackPoseHeld',
    'selectedPrimaryAgeTicks',
    'selectedPrimaryId',
    'targetId',
    'underpowered',
    'weaponPulse',
  ])
  const actionTick = finite(source.actionTick, `${field}.actionTick`)
  const channelActive = boolean(source.channelActive, `${field}.channelActive`)
  const castElement = primaryCastClockElement(selectedPrimarySkillId, element)
  if (channelActive && (actionTick < 0 || actionTick > 1)) {
    throw new GameProtocolError(`${field}.actionTick is outside the Staff Constant program`)
  }
  if (!channelActive && (actionTick < -1 || actionTick >= primaryCastActionEndTick(castElement))) {
    throw new GameProtocolError(`${field}.actionTick is outside the Staff Cast 1 program`)
  }
  const targetId = source.targetId === null
    ? null
    : limitedString(source.targetId, `${field}.targetId`, 256)
  if (selectedPrimarySkillId !== 24 && activeWeldBuildId !== 1003 && targetId !== null) {
    throw new GameProtocolError(`${field}.targetId is only valid for Air`)
  }
  const lastWeldSoundVariant = source.lastWeldSoundVariant === null
    ? null
    : nonnegativeInteger(
        source.lastWeldSoundVariant,
        `${field}.lastWeldSoundVariant`,
      )
  const weldSoundVariantCount = activeWeldBuildId === 1002
    ? 2
    : activeWeldBuildId === 1009
      ? 3
      : 0
  if ((weldSoundVariantCount === 0 && lastWeldSoundVariant !== null)
    || (lastWeldSoundVariant !== null && lastWeldSoundVariant >= weldSoundVariantCount)) {
    throw new GameProtocolError(`${field}.lastWeldSoundVariant does not match the active build`)
  }
  const lastWeldPlaybackRate = source.lastWeldPlaybackRate === null
    ? null
    : positiveFinite(source.lastWeldPlaybackRate, `${field}.lastWeldPlaybackRate`)
  const weldOneShot = activeWeldBuildId === 1000
    || activeWeldBuildId === 1001
    || activeWeldBuildId === 1002
    || activeWeldBuildId === 1009
  const weldRandomizedStart = activeWeldBuildId === 1006 || activeWeldBuildId === 1008
  if ((!weldOneShot && !weldRandomizedStart && lastWeldPlaybackRate !== null)
    || (lastWeldPlaybackRate !== null
      && (lastWeldPlaybackRate < 0.5 || lastWeldPlaybackRate > 1.5))) {
    throw new GameProtocolError(`${field}.lastWeldPlaybackRate does not match the active build`)
  }
  const selectedPrimaryId = boundedInteger(
    source.selectedPrimaryId,
    `${field}.selectedPrimaryId`,
    -1,
    1009,
  )
  const expectedPrimaryId = activeWeldBuildId ?? selectedPrimarySkillId
  if (selectedPrimaryId !== -1 && selectedPrimaryId !== expectedPrimaryId) {
    throw new GameProtocolError(`${field}.selectedPrimaryId does not match progression`)
  }
  const held = boolean(source.held, `${field}.held`)
  const emissionSequence = nonnegativeInteger(
    source.emissionSequence,
    `${field}.emissionSequence`,
  )
  const oneShotAttackPoseHeld = boolean(
    source.oneShotAttackPoseHeld,
    `${field}.oneShotAttackPoseHeld`,
  )
  const selectedOneShot = selectedPrimaryId === 8
    || selectedPrimaryId === 16
    || selectedPrimaryId === 1000
    || selectedPrimaryId === 1001
    || selectedPrimaryId === 1002
    || selectedPrimaryId === 1009
  if (oneShotAttackPoseHeld && (
    !selectedOneShot
    || channelActive
    || emissionSequence === 0
    || (!held && actionTick < 0)
  )) {
    throw new GameProtocolError(`${field}.oneShotAttackPoseHeld is outside a one-shot burst`)
  }
  const etherBlastCharge = nonnegativeFinite(
    source.etherBlastCharge,
    `${field}.etherBlastCharge`,
  )
  if (etherBlastCharge > 6) {
    throw new GameProtocolError(`${field}.etherBlastCharge exceeds the native maximum`)
  }
  const weaponPulse = nonnegativeFinite(source.weaponPulse, `${field}.weaponPulse`)
  if (weaponPulse > 0.45) {
    throw new GameProtocolError(`${field}.weaponPulse exceeds the native maximum`)
  }
  return {
    actionTick,
    aimDirection: unitVector(source.aimDirection, `${field}.aimDirection`),
    castSequence: nonnegativeInteger(source.castSequence, `${field}.castSequence`),
    channelActive,
    emissionSequence,
    etherBlastCharge,
    etherBlastChargeCueSequence: nonnegativeInteger(
      source.etherBlastChargeCueSequence,
      `${field}.etherBlastChargeCueSequence`,
    ),
    fizzleSequence: nonnegativeInteger(
      source.fizzleSequence,
      `${field}.fizzleSequence`,
    ),
    held,
    lastWeldPlaybackRate,
    lastWeldSoundVariant,
    oneShotAttackPoseHeld,
    selectedPrimaryAgeTicks: nonnegativeInteger(
      source.selectedPrimaryAgeTicks,
      `${field}.selectedPrimaryAgeTicks`,
    ),
    selectedPrimaryId,
    targetId,
    underpowered: boolean(source.underpowered, `${field}.underpowered`),
    weaponPulse,
  }
}

function primaryCastClockElement(
  skillId: number,
  fallback: PlayerCharacterConfig['element'],
): PlayerCharacterConfig['element'] {
  if (skillId === SPELL_WELDING_SKILL_ID) return 'fire'
  if (skillId === 8) return 'ether'
  if (skillId === 16) return 'fire'
  if (skillId === 24) return 'air'
  if (skillId === 32) return 'water'
  if (skillId === 40) return 'earth'
  return fallback
}
