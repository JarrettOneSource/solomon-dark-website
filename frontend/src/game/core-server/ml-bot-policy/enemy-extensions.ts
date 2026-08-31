import { NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM } from '../../core-kernels/boneyard-zombie-beat.ts'
import type { NativeSecondarySimulationState } from '../../core-kernels/native-secondary-abilities.ts'
import {
  NATIVE_ARCHER_ACTION_PROGRAM,
  NATIVE_DEMON_BOMB_ACTION_PROGRAM,
  NATIVE_MAGE_ACTION_PROGRAMS,
  NATIVE_SKELETON_ACTION_PROGRAMS,
  NATIVE_SKELETON_CLAW_MARKERS,
  NATIVE_SKELETON_WEAPON_MARKERS,
  type BoneyardEnemyActor,
  type BoneyardMaggotActor,
} from '../boneyard-enemy-store.ts'
import type { MlBotPolicyEnemyRow } from './enemies.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export interface MlBotPolicyEnemyExtensionOptions {
  readonly secondaryAbilities: NativeSecondarySimulationState
  readonly selfPlayerId: string
  readonly tick: number
  readonly worldKey: string
}

interface EnemyClockObservation {
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'cooldown' | 'dormant' | 'knockback' | 'open' | 'opening' | 'orbit' | 'range-control' | 'recover' | 'windup'
  readonly phaseRemainingTicks: number
  readonly timeToActionEndTicks: number | null
  readonly timeToStrikeTicks: number | null
}

export function observeMlBotPolicyEnemyExtensions(
  rows: readonly MlBotPolicyEnemyRow[],
  options: MlBotPolicyEnemyExtensionOptions,
): Float32Array {
  const block = new Float32Array(8 * 44)
  for (let slot = 0; slot < Math.min(8, rows.length); slot += 1) {
    const row = rows[slot]!
    const start = slot * 44
    const speciesIndex = [
      'skeleton', 'archer', 'mage', 'imp', 'zombie', 'wraith', 'demon', 'coffin', 'maggot',
    ].indexOf(row.species)
    block[start + speciesIndex] = 1
    const facing = headingVector(row.headingDeg)
    block[start + 9] = facing.x
    block[start + 10] = facing.y
    const clock = row.species === 'maggot'
      ? maggotClock(row.source as BoneyardMaggotActor, options.tick)
      : enemyClock(row.source as BoneyardEnemyActor)
    const phaseIndex = [
      'approach', 'range-control', 'orbit', 'windup', 'recover', 'cooldown',
      'knockback', 'dormant', 'opening', 'open',
    ].indexOf(clock.phase)
    block[start + 11 + phaseIndex] = 1
    block[start + 21] = actionTime(clock.timeToStrikeTicks)
    block[start + 22] = actionTime(clock.timeToActionEndTicks)
    block[start + 23] = phaseTime(clock.phaseRemainingTicks)
    block[start + 24] = Number(clock.markerEmitted)
    block[start + 25] = Number(row.targetPlayerId === options.selfPlayerId)
    block[start + 26] = Number(contactTarget(row) === options.selfPlayerId)
    block[start + 27] = scaledUnsigned(row.maximumHealth, ML_BOT_POLICY_SCALES.hp)
    const shield = row.species === 'maggot' ? { current: 0, maximum: 0 } : {
      current: (row.source as BoneyardEnemyActor).shieldHealth,
      maximum: (row.source as BoneyardEnemyActor).shieldMaximumHealth,
    }
    block[start + 28] = ratio(shield.current, shield.maximum)
    const family = row.species === 'maggot'
      ? null
      : (row.source as BoneyardEnemyActor).config.family
    block[start + 29] = Number(family !== null && 'armor' in family && family.armor)
    appendStatuses(block, start, row.id, options)
  }
  return block
}

function enemyClock(actor: BoneyardEnemyActor): EnemyClockObservation {
  const speed = Math.max(0, actor.config.attackSpeed * actor.staffActionFactor)
  const brain = actor.brain
  switch (brain.family) {
    case 'skeleton': {
      if (brain.phase === 'approach') return passiveClock('approach')
      if (brain.phase === 'death') return passiveClock('recover')
      const program = NATIVE_SKELETON_ACTION_PROGRAMS[brain.action]
      if (brain.action === 'claw') {
        const nextMarker = NATIVE_SKELETON_CLAW_MARKERS.find((marker) => marker > brain.actionProgress)
          ?? NATIVE_SKELETON_CLAW_MARKERS[0] + program.strictEnd + 1
        return {
          markerEmitted: brain.markerEmitted,
          phase: 'windup',
          phaseRemainingTicks: 0,
          timeToActionEndTicks: ticksForProgress(program.strictEnd + 1 - brain.actionProgress, program.progressPerTick * speed),
          timeToStrikeTicks: ticksForProgress(nextMarker - brain.actionProgress, program.progressPerTick * speed),
        }
      }
      const markers = brain.action === 'weapon'
        ? NATIVE_SKELETON_WEAPON_MARKERS
        : [program.markerProgress]
      return progressClock(brain.actionProgress, program, program.progressPerTick * speed, markers, brain.markerEmitted)
    }
    case 'archer':
      return brain.phase === 'range-control'
        ? passiveClock('range-control')
        : brain.phase === 'death'
          ? passiveClock('recover')
          : progressClock(
              brain.actionProgress,
              NATIVE_ARCHER_ACTION_PROGRAM,
              NATIVE_ARCHER_ACTION_PROGRAM.progressPerTick * speed,
              [NATIVE_ARCHER_ACTION_PROGRAM.markerProgress],
              brain.markerEmitted,
            )
    case 'mage': {
      if (brain.phase === 'range-control') return passiveClock('range-control')
      if (brain.phase === 'death') return passiveClock('recover')
      const program = NATIVE_MAGE_ACTION_PROGRAMS[brain.castProgram]
      return progressClock(
        brain.actionProgress,
        program,
        program.progressPerTick * (1 + brain.castRoll) * speed,
        [program.markerProgress],
        brain.markerEmitted,
      )
    }
    case 'imp': return brain.phase === 'death'
      ? passiveClock('recover')
      : passiveClock('approach')
    case 'portal': return brain.phase === 'death'
      ? passiveClock('recover')
      : passiveClock('dormant')
    case 'zombie':
      if (brain.phase === 'approach') return passiveClock('approach', brain.phaseTicksRemaining)
      if (brain.phase === 'knockback') return passiveClock('knockback', brain.impactStateTicksRemaining)
      if (brain.phase === 'death') return passiveClock('recover')
      return progressClock(brain.actionProgress, {
        markerProgress: NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress,
        strictEnd: NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.completionProgress,
      }, brain.actionRate, [NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress], brain.markerEmitted)
    case 'wraith':
      if (brain.phase === 'death') return passiveClock('recover')
      if (brain.contactCooldownTicks > 0) {
        return passiveClock('cooldown', brain.contactCooldownTicks)
      }
      return brain.flybyTicksRemaining > 0
        ? passiveClock('orbit', brain.flybyTicksRemaining)
        : passiveClock('approach')
    case 'demon':
      if (brain.phase === 'approach') return passiveClock('approach')
      if (brain.phase === 'death') return passiveClock('recover')
      return progressClock(
        brain.actionProgress,
        NATIVE_DEMON_BOMB_ACTION_PROGRAM,
        NATIVE_DEMON_BOMB_ACTION_PROGRAM.progressPerTick * speed,
        [NATIVE_DEMON_BOMB_ACTION_PROGRAM.markerProgress],
        brain.markerEmitted,
      )
    case 'coffin': {
      if (brain.phase === 'opening') return passiveClock('opening', brain.phaseTicksRemaining)
      if (brain.phase === 'open') return passiveClock('open', brain.phaseTicksRemaining)
      if (brain.phase === 'death') return passiveClock('recover')
      return passiveClock('dormant', brain.phaseTicksRemaining)
    }
  }
}

function maggotClock(actor: BoneyardMaggotActor, tick: number): EnemyClockObservation {
  if (actor.movementPhase === 'emerging') return passiveClock('approach')
  const remaining = Math.max(0, actor.nextAttackTick - tick)
  const phase = actor.lastAttackTick !== null && remaining > 0 ? 'cooldown' : 'approach'
  return {
    markerEmitted: false,
    phase,
    phaseRemainingTicks: remaining,
    timeToActionEndTicks: actor.targetPlayerId === null ? null : remaining,
    timeToStrikeTicks: actor.targetPlayerId === null ? null : remaining,
  }
}

function progressClock(
  progress: number,
  program: Readonly<{ markerProgress: number; strictEnd: number }>,
  rate: number,
  markers: readonly number[],
  markerEmitted: boolean,
): EnemyClockObservation {
  const nextMarker = markers.find((marker) => marker > progress) ?? null
  return {
    markerEmitted,
    phase: nextMarker === null ? 'recover' : 'windup',
    phaseRemainingTicks: 0,
    timeToActionEndTicks: ticksForProgress(Math.max(0, program.strictEnd - progress), rate),
    timeToStrikeTicks: nextMarker === null ? null : ticksForProgress(nextMarker - progress, rate),
  }
}

function passiveClock(
  phase: EnemyClockObservation['phase'],
  phaseRemainingTicks = 0,
): EnemyClockObservation {
  return {
    markerEmitted: false,
    phase,
    phaseRemainingTicks,
    timeToActionEndTicks: null,
    timeToStrikeTicks: null,
  }
}

function ticksForProgress(progress: number, rate: number): number | null {
  return rate > 0 ? Math.max(0, progress / rate) : null
}

function contactTarget(row: MlBotPolicyEnemyRow): string | null {
  if (row.species === 'maggot') return null
  const brain = (row.source as BoneyardEnemyActor).brain
  return 'contactTargetPlayerId' in brain ? brain.contactTargetPlayerId : null
}

function appendStatuses(
  block: Float32Array,
  start: number,
  targetId: number,
  options: MlBotPolicyEnemyExtensionOptions,
): void {
  const effect = options.secondaryAbilities.targetEffects.find((candidate) => (
    candidate.worldKey === options.worldKey && candidate.targetId === targetId
  ))
  if (!effect) {
    block[start + 42] = 1
    block[start + 43] = 1
    return
  }
  block[start + 30] = Number(effect.coldSlowTicks > 0)
  block[start + 31] = statusTime(effect.coldSlowTicks)
  block[start + 32] = Number(effect.frozenTicks > 0)
  block[start + 33] = statusTime(effect.frozenTicks)
  block[start + 34] = Number(effect.stunTicks > 0)
  block[start + 35] = statusTime(effect.stunTicks)
  block[start + 36] = Number(effect.fleeTicks > 0)
  block[start + 37] = statusTime(effect.fleeTicks)
  block[start + 38] = Number(effect.dazzleTicks > 0)
  block[start + 39] = Number(effect.disruptedTicks > 0)
  block[start + 40] = Number(effect.prismaticTicks > 0)
  const carrierBurn = options.secondaryAbilities.actors.some((actor) => (
    actor.targetId === targetId
    && actor.worldKey === options.worldKey
    && (actor.kind === 'fire-burn' || actor.kind === 'ether-burn' || actor.kind === 'electric-burn')
  ))
  block[start + 41] = Number(
    effect.electricBurn !== null
    || effect.frostBurnTicks > 0
    || effect.steamed !== null
    || carrierBurn,
  )
  block[start + 42] = clampSigned(effect.weakenFactor)
  block[start + 43] = clampSigned(effect.timeScale)
}

function headingVector(degrees: number): { x: number; y: number } {
  const radians = degrees * Math.PI / 180
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

function actionTime(ticks: number | null): number {
  return ticks === null
    ? 1
    : scaledUnsigned(
        ticks / ML_BOT_POLICY_SCALES.tickRate,
        ML_BOT_POLICY_SCALES.enemyActionSeconds,
      )
}

function phaseTime(ticks: number): number {
  return scaledUnsigned(
    ticks / ML_BOT_POLICY_SCALES.tickRate,
    ML_BOT_POLICY_SCALES.enemyPhaseSeconds,
  )
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
