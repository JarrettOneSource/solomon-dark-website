import { type ModBoastSelection } from '../../core-kernels/boast.ts'
import {
  type EquipmentSlot,
  type HubInventoryItem,
  type HubTraderId,
} from '../../core-kernels/hub-economy.ts'
import { type PlayerBeltComponent } from '../../core-kernels/native-belt.ts'
import { type PlayerCharacterConfig } from '../../core-kernels/player-character.ts'
import { type HubInteractionId } from '../../hub-inventory-presentation.ts'
import {
  type HubNpcChatContent,
  type HubNpcSelectorRow,
} from '../../hub-npc-dialogue.ts'
import {
  type ProtocolPlayerEconomy,
  type ProtocolPlayerProgression,
} from '../../protocol/game-state.ts'
import { type GameTextureMap } from '../game-webgl.ts'
import {
  type HubSackPageDirection,
  type HubStandardNotice,
} from '../hub-inventory-render-contract.ts'
import { type ModPresentationTextures } from '../mod-presentation-assets.ts'
import { type NativeElementVfxView } from '../native-element-vfx-view.ts'
import { type PlayerCharacterAtlas } from '../player-character-atlas.ts'
import { type PlayerWorldTextures } from '../world-player-textures.ts'
import { type Container } from 'pixi.js'

export type AtlasName = 'Inventory' | 'Library' | 'Skills' | 'UI'

export type FontName = 'body' | 'medium' | 'menu' | 'skill-uppercase' | 'special-uppercase'

export type HubInventoryPressedControl =
  | 'dowsing'
  | 'message-primary'
  | 'message-secondary'
  | null

export interface HubContentSizedRendererNotice {
  readonly actionLabel: string
  readonly body: string
  readonly outcomeTint?: number
  readonly secondaryActionLabel?: string
  readonly summary?: string
  readonly title: string
  readonly variant: 'unforge-confirmation' | 'unforge-result'
}

export type HubInventoryRendererNotice = HubStandardNotice | HubContentSizedRendererNotice

export interface HubInventorySelectionModel {
  readonly equipmentSlot: EquipmentSlot | null
  readonly id: number
  readonly owner: 'backpack' | 'equipment'
  readonly startedAtMs: number
}

export interface HubInventoryDragModel {
  readonly equipmentSlot: EquipmentSlot | null
  readonly itemId: number
  readonly owner: 'backpack' | 'equipment' | 'storage'
  readonly pointer: { readonly x: number; readonly y: number }
}

export interface HubInventoryFlybyLaneModel {
  readonly from: { readonly x: number; readonly y: number }
  readonly item: HubInventoryItem
  readonly to: { readonly x: number; readonly y: number }
}

export interface HubInventoryFlybyModel {
  readonly lanes: readonly HubInventoryFlybyLaneModel[]
  readonly phase: 'flying' | 'trailing'
  readonly startedAtMs: number
}

export interface HubInventorySackTransitionModel {
  readonly direction: HubSackPageDirection
  readonly fromPath: readonly number[]
  readonly startedAtMs: number
  readonly toPath: readonly number[]
}

export interface HubInventoryDyeModalModel {
  readonly closingAtMs: number | null
  readonly dyeItemId: number
  readonly openedAtMs: number
  readonly path: readonly number[]
  readonly pending: boolean
  readonly selectedAtMs: number | null
  readonly selectedRow: number | null
  readonly swatchRows: readonly number[]
  readonly targetItemId: number | null
}

export type HubServiceInspectionModel =
  | {
      readonly id: number
      readonly kind: 'store-item'
      readonly owner: 'storage' | null
    }
  | {
      readonly index: number
      readonly kind: 'owned-perk'
      readonly selector: number
    }

export type HubInventoryRendererModel =
  | {
      readonly belt: PlayerBeltComponent
      readonly config: PlayerCharacterConfig
      readonly dragging: HubInventoryDragModel | null
      readonly dyeModal: HubInventoryDyeModalModel | null
      readonly economy: ProtocolPlayerEconomy
      readonly flybys: readonly HubInventoryFlybyModel[]
      readonly inspection: HubServiceInspectionModel | null
      readonly kind: 'inventory'
      readonly notice: HubInventoryRendererNotice | null
      readonly pressedControl: HubInventoryPressedControl
      readonly progression: ProtocolPlayerProgression
      readonly sackPath: readonly number[]
      readonly sackTransition: HubInventorySackTransitionModel | null
      readonly selection: HubInventorySelectionModel | null
      readonly statsPage: number
    }
  | {
      readonly acceleratedAtMs: number | null
      readonly content: HubNpcChatContent
      readonly gold: number
      readonly interaction: HubInteractionId
      readonly kind: 'dialogue'
      readonly phaseStartedAtMs: number
      readonly highlightedSelectorId: number | ModBoastSelection | null
      readonly selectedSelectorId: number | ModBoastSelection | null
      readonly selectorScroll: number
      readonly selectorRows: readonly HubNpcSelectorRow[]
      readonly storyOffice: boolean
    }
  | {
      readonly belt: PlayerBeltComponent
      readonly config: PlayerCharacterConfig
      readonly dragging: HubInventoryDragModel | null
      readonly dyeModal: HubInventoryDyeModalModel | null
      readonly economy: ProtocolPlayerEconomy
      readonly flybys: readonly HubInventoryFlybyModel[]
      readonly kind: 'service'
      readonly notice: HubInventoryRendererNotice | null
      readonly pressedControl: HubInventoryPressedControl
      readonly progression: ProtocolPlayerProgression
      readonly sackPath: readonly number[]
      readonly sackTransition: HubInventorySackTransitionModel | null
      readonly inventorySelection: HubInventorySelectionModel | null
      readonly inspection: HubServiceInspectionModel | null
      readonly selectedItemId: number | null
      readonly selectedOwner: 'storage' | null
      readonly statsPage: number
      readonly trader: HubTraderId
    }

export interface RenderContext {
  readonly elementVfxTextures: PlayerWorldTextures['elementVfx']
  readonly modTextures: ModPresentationTextures
  readonly playerCharacterAtlas: PlayerCharacterAtlas
  readonly textures: GameTextureMap
}

export interface ChatRenderState {
  readonly content: Container
  readonly contentHeight: number
}

export interface InventoryBuildState {
  readonly dragger: Container | null
  readonly flybys: readonly InventoryFlybyView[]
  readonly itemInfo: Container | null
  readonly modalHud: Container
  readonly playerPreview: NativeElementVfxView | null
  readonly sackPages: InventorySackPages | null
}

export interface InventorySackPages {
  readonly incoming: Container
  readonly outgoing: Container
  readonly transition: HubInventorySackTransitionModel
}

interface InventoryFlybyLaneView {
  readonly afterimages: ReadonlyMap<number, Container>
  readonly main: Container
  readonly model: HubInventoryFlybyLaneModel
}

export interface InventoryFlybyView {
  readonly container: Container
  readonly lanes: readonly InventoryFlybyLaneView[]
  readonly model: HubInventoryFlybyModel
}
