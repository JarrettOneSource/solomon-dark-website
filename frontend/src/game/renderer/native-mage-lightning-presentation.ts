import { BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS } from '../core-kernels/boneyard-enemy-modifiers.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { BoneyardEnemyEventSnapshot } from '../protocol/game-state.ts'
import type { NativeEnemyVisualSnapshot } from './native-enemy-presentation.ts'

export interface NativeMageLightningLayer {
  readonly alpha: number
  readonly entry: 381 | 382
  readonly position: Readonly<Vector2>
  readonly role: 'mage-lightning-source' | 'mage-lightning-target'
}

export interface NativeMageLightningPlan {
  readonly eventId: number
  readonly layers: readonly NativeMageLightningLayer[]
}

export function sampledMageLightningEventIds(
  enemies: readonly NativeEnemyVisualSnapshot[],
): ReadonlySet<number> {
  const eventIds = new Set<number>()
  for (const enemy of enemies) {
    for (const effect of enemy.animation?.effects ?? []) {
      if (effect.role !== 'mage-lightning-source') continue
      const eventId = (effect.id - 2) / 4
      if (Number.isSafeInteger(eventId) && eventId > 0) eventIds.add(eventId)
    }
  }
  return eventIds
}

export function shouldRenderSemanticMageLightning(
  eventId: number,
  sampledEventIds: ReadonlySet<number>,
): boolean {
  return !sampledEventIds.has(eventId)
}

export function nativeMageLightningPlan(
  event: BoneyardEnemyEventSnapshot,
  ageTicks: number,
): NativeMageLightningPlan | null {
  if (event.type !== 'mage-lightning') {
    throw new Error('Mage lightning presentation requires a mage-lightning event')
  }
  if (!event.sourcePosition || !event.targetPosition) {
    throw new Error('Mage lightning event is missing immutable endpoints')
  }
  if (!Number.isFinite(ageTicks)) {
    throw new RangeError('Mage lightning age must be finite')
  }
  const age = Math.max(0, ageTicks)
  if (age >= BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS) return null
  const alpha = 1 - age / BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS
  return {
    eventId: event.eventId,
    layers: [
      {
        alpha,
        entry: 381,
        position: { ...event.sourcePosition },
        role: 'mage-lightning-source',
      },
      {
        alpha,
        entry: 382,
        position: { ...event.targetPosition },
        role: 'mage-lightning-target',
      },
    ],
  }
}
