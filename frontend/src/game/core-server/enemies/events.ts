import type { NativeRngState } from '../../core-kernels/native-rng.ts'
import { drawNativeInteger } from '../../core-kernels/native-rng.ts'
import type { DeathEffectOwner } from './death-effects.ts'
import type { BoneyardEnemyActionSound, BoneyardEnemyActor, BoneyardEnemyActorId, BoneyardEnemyDeathSound, BoneyardEnemySemanticEvent, BoneyardEnemySemanticEventType, BoneyardEnemyStore, BoneyardPlayerDamageSound, BoneyardPlayerDamageSoundRequest, BoneyardPlayerDamageSoundResult, WorkingStep } from './model.ts'
import { NATIVE_IMP_SPLIT_CHILD_COUNT } from './programs.ts'
import { drawUnit } from './random.ts'
export const NATIVE_IMP_VOCAL_SOUNDS = Object.freeze([
  'imp-vocal-1',
  'imp-vocal-2',
  'imp-vocal-3',
  'imp-vocal-4',
  'imp-vocal-5',
  'imp-vocal-6',
  'imp-vocal-7',
  'imp-vocal-8',
] as const)

export const NATIVE_IMP_BITE_SOUNDS = Object.freeze([
  'bite-1',
  'bite-2',
  'bite-3',
] as const)

export function emitBoneyardPlayerDamageSound(
  source: BoneyardEnemyStore,
  request: BoneyardPlayerDamageSoundRequest,
  sourceRng: NativeRngState,
): BoneyardPlayerDamageSoundResult {
  const delay = drawNativeInteger(sourceRng, 41)
  const cue = drawNativeInteger(delay.state, 3)
  const sound = `wizard-ouch-${cue.value + 1}` as BoneyardPlayerDamageSound
  const event = Object.freeze({
    actorId: request.actorId,
    eventId: source.nextEventId,
    gainScale: wizardOuchGain(request.currentHealth),
    pitch: 1,
    sound,
    sourcePosition: Object.freeze({ ...request.position }),
    targetPlayerId: request.playerId,
    tick: request.tick,
    type: 'player-damage-sound' as const,
  })
  return {
    deadlineTick: Math.trunc(Math.fround((request.tick + 20 + delay.value)
      * Math.min(1, Math.max(0, Math.fround((request.currentHealth - 25) / 20))))),
    event,
    rng: cue.state,
    store: {
      ...source,
      nextEventId: source.nextEventId + 1,
    },
  }
}

export function nativeWizardOuchCooldownReady(
  tick: number,
  deadlineTick: number,
): boolean {
  return tick > deadlineTick
}

function wizardOuchGain(currentHealth: number): number {
  const healthScalar = Math.min(1, Math.max(0, (currentHealth - 25) / 20))
  return 0.25 + 0.75 * (1 - healthScalar)
}

export function emitEnemyDeathSounds(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  outputCount: number | undefined,
): void {
  switch (actor.config.enemyToken) {
    case 'SPIDER':
      emitEnemyDeathSound(work, tick, actor, 'spider-die', 0.95 + drawUnit(work) * 0.15)
      return
    case 'COCOON': return
    case 'HEARTMONGER':
    case 'DIREFACULTY':
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      emitEnemyDeathSound(work, tick, actor, 'skeleton-die', 0.8 + drawUnit(work) * 0.2)
      return
    case 'IMP':
      if (outputCount === NATIVE_IMP_SPLIT_CHILD_COUNT) {
        emitEnemyDeathSound(work, tick, actor, 'imp-split', 0.9 + drawUnit(work) * 0.2)
      } else {
        emitEnemyDeathSound(work, tick, actor, 'firey-death', 0.8 + drawUnit(work) * 0.2)
      }
      return
    case 'PORTAL':
      emitEnemyDeathSound(work, tick, actor, 'portal-die', 1)
      return
    case 'ZOMBIE':
      if (actor.config.family.rotten) {
        for (let index = 0; index < 3; index += 1) {
          emitEnemyDeathSound(
            work,
            tick,
            actor,
            'zombie-poison-splat',
            0.9 + drawUnit(work) * 0.15,
          )
        }
      }
      emitEnemyDeathSound(work, tick, actor, 'zombie-die', 0.8 + drawUnit(work) * 0.2)
      emitEnemyDeathSound(
        work,
        tick,
        actor,
        'zombie-die-groan',
        0.8 + drawUnit(work) * 0.2,
      )
      return
    case 'WRAITH':
      emitEnemyDeathSound(work, tick, actor, 'flash', 1)
      emitEnemyDeathSound(work, tick, actor, 'banshee-die', 0.9 + drawUnit(work) * 0.2)
      emitEnemyDeathSound(work, tick, actor, 'banshee-die', 0.9 + drawUnit(work) * 0.2)
      emitEnemyDeathSound(work, tick, actor, 'banshee-die', 0.8 + drawUnit(work) * 0.4)
      return
    case 'DEMON':
      emitEnemyDeathSound(work, tick, actor, 'firey-death', 0.8 + drawUnit(work) * 0.2)
      return
    case 'COFFIN':
      emitEnemyDeathSound(work, tick, actor, 'coffin-break', 1 + drawUnit(work) * 0.1)
  }
}

export function emitEnemyDeathSound(
  work: WorkingStep,
  tick: number,
  actor: DeathEffectOwner,
  sound: BoneyardEnemyDeathSound,
  pitch: number,
  gainScale = 1,
): void {
  emitEvent(work, tick, 'enemy-death-sound', actor.id, {
    gainScale,
    pitch,
    sound,
    sourcePosition: { ...actor.position },
  })
}

export function emitEnemyActionSound(
  work: WorkingStep,
  tick: number,
  actor: DeathEffectOwner,
  sound: BoneyardEnemyActionSound,
  pitch: number,
  gainScale = 1,
): void {
  emitEvent(work, tick, 'enemy-action-sound', actor.id, {
    gainScale,
    pitch,
    sound,
    sourcePosition: { ...actor.position },
  })
}

export function emitEvent(
  work: WorkingStep,
  tick: number,
  type: BoneyardEnemySemanticEventType,
  actorId: BoneyardEnemyActorId,
  patch: Omit<Partial<BoneyardEnemySemanticEvent>, 'actorId' | 'eventId' | 'tick' | 'type'> = {},
): number {
  const eventId = work.nextEventId
  work.nextEventId += 1
  work.events.push(Object.freeze({
    actorId,
    eventId,
    tick,
    type,
    ...patch,
  }))
  return eventId
}
