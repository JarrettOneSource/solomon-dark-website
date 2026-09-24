import { NATIVE_ACTOR_SEPARATION_EPSILON } from './core-kernels/actor-physics.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import { PLAYER_CHARACTER_RADIUS } from './core-kernels/player-character.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import {
  HUB_INTERACTION_GEOMETRY,
  HUB_INTERACTION_IDS,
  hubInteractionWithinRange,
  type HubInteractionAvailability,
  type HubInteractionId,
} from './hub-inventory-presentation.ts'

/** GameNPC +0x170 and PlayerWizard +0x1D8; private to this participant's live Hub. */
export interface HubNpcContactState {
  candidate: HubInteractionId | null
  eligibleTicks: number
  lastTick: number | null
  readonly engaged: Set<HubInteractionId>
}

export function createHubNpcContactState(): HubNpcContactState {
  return { candidate: null, eligibleTicks: 0, engaged: new Set(), lastTick: null }
}

/**
 * Retail 0x0054B0F0..278: six forward-facing contact ticks start Chat.
 * 0x00505010 only rearms the NPC after leaving its native interaction radius.
 * This selects local dialogue presentation; purchases and hints keep their host actions.
 */
export function stepHubNpcContact(state: HubNpcContactState, sample: {
  readonly availability: HubInteractionAvailability
  readonly enabled: boolean
  readonly movement: Readonly<Vector2>
  readonly position: Readonly<Vector2>
  readonly region: HubRegionId
  readonly tick: number
}): HubInteractionId | null {
  const { availability, enabled, movement, position, region } = sample
  const tick = Math.floor(sample.tick)
  if (!Number.isSafeInteger(tick)) return null
  if (state.lastTick !== null && tick < state.lastTick) {
    state.candidate = null
    state.eligibleTicks = 0
    state.engaged.clear()
    state.lastTick = null
  }
  for (const id of state.engaged) {
    if ((id === 'polisher' && !availability.storyOffice)
      || !hubInteractionWithinRange(id, region, position, availability)) state.engaged.delete(id)
  }
  const elapsed = state.lastTick === null ? 1 : Math.max(0, tick - state.lastTick)
  state.lastTick = tick
  const moveLength = Math.hypot(movement.x, movement.y)
  let candidate: HubInteractionId | null = null
  let nearest = Infinity
  if (enabled && moveLength > 0) {
    for (const id of HUB_INTERACTION_IDS) {
      // Paintings own an eulogy action, not the named-NPC collision Chat path.
      if (id.startsWith('painting-') || state.engaged.has(id)) continue
      if (id === 'polisher' && !availability.storyOffice) continue
      if (id === 'skorcha' && availability.skorchaPosition === null) continue
      const geometry = HUB_INTERACTION_GEOMETRY[id]
      if (geometry.region !== region) continue
      const target = id === 'skorcha' ? availability.skorchaPosition! : geometry.position
      const dx = target.x - position.x
      const dy = target.y - position.y
      const distance = Math.hypot(dx, dy)
      const contactRadius = PLAYER_CHARACTER_RADIUS + geometry.radius + NATIVE_ACTOR_SEPARATION_EPSILON
      if (distance === 0 || distance > contactRadius + 1e-7 || distance >= nearest) continue
      const facing = Math.fround((movement.x * dx + movement.y * dy) / (moveLength * distance))
      if (facing <= Math.fround(0.7)) continue
      candidate = id
      nearest = distance
    }
  }
  if (candidate === null) {
    state.candidate = null
    state.eligibleTicks = 0
    return null
  }
  state.eligibleTicks = state.candidate === candidate ? state.eligibleTicks + elapsed : 1
  state.candidate = candidate
  if (state.eligibleTicks < 6) return null
  state.engaged.add(candidate)
  state.candidate = null
  state.eligibleTicks = 0
  return candidate
}
