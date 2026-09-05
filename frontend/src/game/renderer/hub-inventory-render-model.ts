import type { Container } from 'pixi.js'
import type { ModPresentationTextures } from './mod-presentation-assets.ts'
import type { GameTextureMap } from './game-webgl.ts'
import type { NativeElementVfxView } from './native-element-vfx-view.ts'
import type { PlayerCharacterAtlas } from './player-character-atlas.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'
import type {
  HubInventoryFlybyLaneModel,
  HubInventoryFlybyModel,
  HubInventorySackTransitionModel,
} from './hub-inventory-renderer.ts'

export interface RenderContext {
  readonly elementVfxTextures: PlayerWorldTextures['elementVfx']
  readonly modTextures: ModPresentationTextures
  readonly playerCharacterAtlas: PlayerCharacterAtlas
  readonly textures: GameTextureMap
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

export interface ChatRenderState {
  readonly content: Container
  readonly contentHeight: number
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
