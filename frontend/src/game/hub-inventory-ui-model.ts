import type { HubInventoryAction, HubTraderId } from './core-kernels/hub-economy.ts'
import type { ModBoastSelection } from './core-kernels/boast.ts'
import type { HubInteractionId } from './hub-inventory-presentation.ts'
import type { HubNpcChatContent } from './hub-npc-dialogue.ts'
import type { HubInventoryDragModel } from './renderer/hub-inventory/model.ts'
import type { GameSnapshot, NativeHallOfFameRunSnapshot } from './protocol/game-state.ts'

export interface InventoryRunSummary {
  readonly wave: number
  readonly monstersKilled: number
  readonly awesomeness: number
}

export const FRESH_INVENTORY_RUN_SUMMARY: InventoryRunSummary = {
  wave: 0, monstersKilled: 0, awesomeness: 0,
}

type InventoryRunSummaryWorld =
  | { readonly kind: 'hub' }
  | {
      readonly kind: 'boneyard'
      readonly runId: string
      readonly hallOfFameRuns: Readonly<Record<string, Pick<NativeHallOfFameRunSnapshot, 'monstersKilled' | 'awesomeness'>>>
      readonly tutorial: { readonly waveOrdinal: number } | null
      readonly waves: { readonly waveOrdinal: number } | null
    }

export function projectInventoryRunSummary(
  source: Pick<GameSnapshot, 'players'> & { readonly world: InventoryRunSummaryWorld },
  playerId: string,
  expectedRunId?: string,
): InventoryRunSummary | null {
  if (!source.players[playerId]) return null
  const world = source.world
  if (world.kind === 'hub') return expectedRunId === undefined ? FRESH_INVENTORY_RUN_SUMMARY : null
  if (expectedRunId !== undefined && world.runId !== expectedRunId) return null
  const counters = world.hallOfFameRuns[playerId]
  if (!counters) return null
  return {
    wave: world.tutorial?.waveOrdinal ?? world.waves?.waveOrdinal ?? 0,
    monstersKilled: counters.monstersKilled,
    awesomeness: counters.awesomeness,
  }
}

export function sameInventoryRunSummary(
  left: InventoryRunSummary | null,
  right: InventoryRunSummary | null,
): boolean {
  return left === right || (left !== null && right !== null
    && left.wave === right.wave
    && left.monstersKilled === right.monstersKilled
    && left.awesomeness === right.awesomeness)
}

export type InventoryActionHandler = (
  action: HubInventoryAction,
  releasedDrag?: HubInventoryDragModel,
) => void

export interface HubServiceSelection {
  readonly id: number
  readonly owner: 'storage' | null
}

export type InventoryMoveAction = Extract<HubInventoryAction, { readonly type: 'move-inventory-item' }>

export interface HubNpcChatPresentation {
  readonly acceleratedAtMs: number | null
  readonly content: HubNpcChatContent
  readonly phaseStartedAtMs: number
  readonly selectorScroll: number
}

export interface PendingHubNpcSelection {
  readonly action: 'buy-teacher-spell' | 'read-librarian-book' | 'select-boast'
  readonly id: number | ModBoastSelection
  readonly selector: 'boast' | 'books' | 'teacher-spells'
}

export type HubUiSurface =
  | {
      readonly interaction: HubInteractionId
      readonly kind: 'dialogue'
      readonly source: 'college-intro' | 'shortcut' | 'world'
    }
  | { readonly kind: 'inventory' }
  | {
      readonly kind: 'service'
      readonly source: 'shortcut' | 'world'
      readonly trader: HubTraderId
    }
  | null
