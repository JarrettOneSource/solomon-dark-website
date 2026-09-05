import type { HubInventoryAction, HubTraderId } from './core-kernels/hub-economy.ts'
import type { ModBoastSelection } from './core-kernels/boast.ts'
import type { HubInteractionId } from './hub-inventory-presentation.ts'
import type { HubNpcChatContent } from './hub-npc-dialogue.ts'

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
