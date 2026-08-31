import {
  Container,
  Graphics,
  Sprite,
  Texture,
} from 'pixi.js'

import { hub, skillPicker } from '../../lib/assets.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  NATIVE_DYE_SWATCHES,
  NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
  findInventoryItem,
  inventoryItemsAtSackPath,
  nativeDyeMixedTint,
  inventoryDyeableClothingItems,
  projectInventoryRootSlots,
  type EquipmentSlot,
  type HubInventoryItem,
  type HubShopItem,
  type HubTraderId,
} from '../core-kernels/hub-economy.ts'
import type { PlayerCharacterConfig, WizardElement } from '../core-kernels/player-character.ts'
import {
  nativeSkillColorRoot,
  nativeSkillIconRecord,
} from '../core-kernels/player-progression.ts'
import {
  nativeBeltEntryItem,
  nativeBeltPotionProjection,
  type PlayerBeltComponent,
} from '../core-kernels/native-belt.ts'
import {
  boastSelectionKey,
  type ModBoastSelection,
} from '../core-kernels/boast.ts'
import { NATIVE_BOAST_PRESENTATION } from '../core-kernels/native-hub-npc.ts'
import {
  HUB_TRADER_DIALOGUES,
  equipmentSlotsForItem,
  hubInteractionDialogue,
  type HubInteractionId,
} from '../hub-inventory-presentation.ts'
import {
  hubNpcChatChoices,
  hubNpcSelectorTitle,
  type HubNpcChatContent,
  type HubNpcSelectorRow,
} from '../hub-npc-dialogue.ts'
import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudModalSlideLayout,
  nativeHudModalSlideOffset,
  nativeHudRectCenter,
  type NativeHudControlLayout,
} from '../native-hud-layout.ts'
import { NATIVE_INVENTORY_GOLD_LEDGER } from '../native-inventory-gold-layout.ts'
import { playerCharacterStaffIsFront, playerCharacterStaffOrbOffset } from '../player-character-presentation.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from '../protocol/game-state.ts'
import type { GameModAsset } from '../protocol/game-protocol.ts'
import { nativeUiAtlasSource } from '../native-ui/native-ui-assets.ts'
import {
  measureNativeUiText,
  nativeUiAtlas,
  nativeUiFont,
  nativeUiKerning,
  nativeUiRecord,
  NATIVE_UI_BOAST_SELECTED_TINT,
  NATIVE_UI_BUTTON,
  nativeUiRect,
  planNativeUiBoastMenu,
  planNativeUiButtonChrome,
  wrapNativeUiText,
  type NativeUiAtlasRecord,
  type NativeUiFontName,
} from '../native-ui/core.ts'
import {
  destroyNativeUiPixiFor,
  nativeUiPixiFor,
} from '../native-ui/pixi.ts'
import {
  loadModPresentationTextures,
  type ModPresentationTextures,
} from './mod-presentation-assets.ts'
import {
  BONEYARD_COMBAT_ATLAS_SOURCES,
  boneyardCombatAtlasSourceIsPacked,
  createBoneyardCombatAtlas,
} from './boneyard-combat-atlas.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
  type GameTextureMap,
  type GameWebGlApplication,
} from './game-webgl.ts'
import {
  HUB_DYE_CLOTHING,
  HUB_DOWSING_GRID,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_CHAT_INLINE_EMPHASIS,
  HUB_CHAT_PANEL,
  HUB_EQUIPMENT_SINK_RENDER,
  HUB_HAGATHA_PERK_PANE,
  HUB_HOVER_BOX,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_FLYBY,
  HUB_INVENTORY_PARENT_HOLDER,
  HUB_INVENTORY_ATTRIBUTES_PAGE,
  HUB_INVENTORY_INTERACTION,
  HUB_INVENTORY_STATS_PAGES,
  HUB_ITEM_ICON_TRANSFORMS,
  HUB_MODAL_HUD_CONTROLS,
  HUB_NATIVE_UI_TIMING,
  HUB_NATIVE_UI_SIZE,
  HUB_NPC_SELECTOR,
  HUB_PRIMARY_SPELL_PANE,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  HUB_SHOP_TEXT,
  HUB_STOREGRID_SELECTED_RECORDS,
  HUB_STARTER_EQUIPMENT_PRIMARY_TINT,
  HUB_UNFORGE_CONFIRMATION,
  HUB_UNFORGE_RESULT,
  HUB_UNFORGE_TARGET,
  hubNpcBookArtRecord,
  hubNpcBookDisplayTitle,
  hubNpcSelectorClampScroll,
  hubNpcSelectorContentHeight,
  hubNpcSelectorPriceTint,
  hubNpcSelectorRowRect,
  hubChatTextRuns,
  hubDowsingFieldTint,
  hubDowsingFlashAlpha,
  hubDowsingFlashFeedbackSequence,
  hubDowsingSlotPosition,
  hubDyeItemLayerRects,
  hubDyeModalOpacity,
  hubDyeSelectedPulse,
  hubDyeSwatchRect,
  hubHagathaPerkSlotAlpha,
  hubHagathaTonicPromptCenter,
  hubInventoryEquipmentSlotRects,
  hubInventoryFlybyFrame,
  hubInventoryFlybyPoint,
  hubHagathaTooltipLines,
  hubItemTooltipLines,
  hubInventoryPrimarySpellLines,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
  hubInventoryWizardIdentityText,
  hubNativeUiElapsedTicks,
  hubNativeUiReveal,
  hubOwnedPerkSlotRect,
  hubShopSlideOffset,
  hubSackPageOffsets,
  hubShopSlotPosition,
  hubUnforgeResultLayout,
  hubUnforgeTargetTint,
  type HubTooltipLine,
  type HubTooltipOptions,
  type HubSackPageDirection,
} from './hub-inventory-render-contract.ts'
import { skillPickerRootTint } from './skill-picker-render-contract.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import {
  PLAYER_CHARACTER_ATLAS_SOURCES,
  PLAYER_CHARACTER_SHEETS,
  createPlayerCharacterAtlas,
  type PlayerCharacterAtlas,
} from './player-character-atlas.ts'
import { createNativeElementVfxTextures, type PlayerWorldTextures } from './world-player-textures.ts'

type AtlasName = 'Inventory' | 'Library' | 'Skills' | 'UI'
type FontName = 'body' | 'medium' | 'menu' | 'skill' | 'special-uppercase'

export type HubInventoryPressedControl =
  | 'dowsing'
  | 'message-primary'
  | 'message-secondary'
  | null

export interface HubInventoryRendererNotice {
  readonly actionLabel: string
  readonly body: string
  readonly outcomeTint?: number
  readonly secondaryActionLabel?: string
  readonly summary?: string
  readonly title: string
  readonly variant?: 'standard' | 'unforge-confirmation' | 'unforge-result'
}

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

export interface HubInventoryRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  moveDrag(pointer: { readonly x: number; readonly y: number }): void
  render(nowMs: number, reveal: number, hudProgress?: number): { readonly chatComplete: boolean }
  setModel(model: HubInventoryRendererModel): void
}

export async function createHubInventoryRenderer(
  modAssets: readonly GameModAsset[] = [],
): Promise<HubInventoryRenderer> {
  let gpu: GameWebGlApplication | undefined
  let resources: GameTextureMap | undefined
  let modTextures: ModPresentationTextures | undefined
  try {
    ;[gpu, resources, modTextures] = await Promise.all([
      createGameWebGlApplication({
        backgroundAlpha: 0,
        className: 'hub-inventory-native-canvas',
        height: HUB_NATIVE_UI_SIZE.height,
        resolution: 1,
        width: HUB_NATIVE_UI_SIZE.width,
      }),
      loadGameTextureMap({
        composited: PLAYER_CHARACTER_ATLAS_SOURCES,
        stock: [
          hub.trader.inventoryAtlas,
          hub.trader.skillsAtlas,
          hub.trader.uiAtlas,
          nativeUiAtlasSource('Library'),
          skillPicker.fontsAtlas,
          BONEYARD_COMBAT_ATLAS_SOURCES[0]!,
        ],
      }),
      loadModPresentationTextures(modAssets),
    ])
  } catch (error) {
    gpu?.application.destroy({ removeView: true })
    resources?.destroy()
    modTextures?.destroy()
    throw error
  }

  const application = gpu.application
  const textures = resources
  const root = new Container()
  const dimmer = new Graphics().rect(0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height).fill({ color: 0x000000 })
  const surface = new Container()
  const dowsingFlash = new Graphics()
    .rect(0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height)
    .fill({ color: 0xff0000 })
  dowsingFlash.alpha = 0
  root.addChild(dimmer, surface, dowsingFlash)
  application.stage.addChild(root)
  let currentKind: HubInventoryRendererModel['kind'] = 'inventory'
  let curtainAlpha = 1
  let destroyed = false
  let dowsingFlashStartedAt: number | null = null
  let dowsingFlashTrigger: 'buy-dowsing' | 'dowse' | null = null
  let dowsingFieldTiles: Sprite[] = []
  let noticeRevealStartedAt: number | null = null
  let previousActionFeedbackSequence: number | null = null
  let serviceOverlay: Container | null = null
  let dyeLayer: Container | null = null
  let dyeSelectedPulse: Graphics | null = null
  let chatRenderState: ChatRenderState | null = null
  let playerPreviewVfx: NativeElementVfxView | null = null
  let inventoryDragger: Container | null = null
  let inventoryFlybys: readonly InventoryFlybyView[] = []
  let inventoryItemInfo: Container | null = null
  let inventorySackPages: InventorySackPages | null = null
  let modalHud: Container | null = null
  let unforgeTarget: Sprite | null = null
  let previousNoticeTitle: string | null = null
  let currentModel: HubInventoryRendererModel | null = null

  const texture = (source: string) => textureFrom(textures.textures, source)
  const combatAtlas = createBoneyardCombatAtlas(texture)
  const elementVfxTextures = createNativeElementVfxTextures((source) => (
    boneyardCombatAtlasSourceIsPacked(source) ? combatAtlas.single(source) : texture(source)
  ))
  const playerCharacterAtlas = createPlayerCharacterAtlas((source) => (
    texture(source)
  ))
  gpu.canvas.dataset.playerTextureAlpha = playerCharacterAtlas
    .frame(PLAYER_CHARACTER_SHEETS.robeDynamic.air, 0, 0).source.alphaMode
  gpu.canvas.dataset.playerTextureAddress = playerCharacterAtlas
    .frame(PLAYER_CHARACTER_SHEETS.robeDynamic.air, 0, 0).source.addressMode
  gpu.canvas.dataset.nativeTextureAddress = elementVfxTextures.fire[0]!.source.addressMode
  gpu.canvas.dataset.nativeTextureAlpha = elementVfxTextures.fire[0]!.source.alphaMode

  const context: RenderContext = {
    elementVfxTextures,
    modTextures,
    playerCharacterAtlas,
    textures,
  }

  return {
    canvas: gpu.canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.destroy({ removeView: true })
      playerCharacterAtlas.destroy()
      destroyNativeUiPixiFor(textures)
      for (const frames of Object.values(elementVfxTextures)) {
        for (const texture of frames) texture.destroy(false)
      }
      combatAtlas.destroy()
      textures.destroy()
      modTextures.destroy()
    },
    moveDrag(pointer) {
      if (!inventoryDragger) return
      inventoryDragger.position.set(pointer.x, pointer.y)
    },
    render(nowMs, reveal, hudProgress = reveal) {
      if (destroyed) return { chatComplete: false }
      const clampedReveal = Math.max(0, Math.min(1, reveal))
      const clampedHudProgress = Math.max(0, Math.min(1, hudProgress))
      gpu.canvas.dataset.nativeReveal = clampedReveal >= 1 ? 'settled' : 'revealing'
      gpu.canvas.dataset.nativeRevealProgress = `${clampedReveal}`
      dimmer.alpha = curtainAlpha * clampedReveal
      surface.alpha = clampedReveal
      surface.y = 0
      if (modalHud) modalHud.position.y = nativeHudModalSlideOffset(clampedHudProgress)
      if (serviceOverlay) serviceOverlay.y = currentKind === 'service'
        ? hubShopSlideOffset(clampedReveal)
        : 0
      const flashAlpha = dowsingFlashStartedAt === null
        ? 0
        : hubDowsingFlashAlpha(nowMs - dowsingFlashStartedAt)
      dowsingFlash.alpha = flashAlpha
      if (dowsingFieldTiles.length > 0) {
        const tint = hubDowsingFieldTint(hubNativeUiElapsedTicks(nowMs))
        for (const tile of dowsingFieldTiles) tile.tint = tint
      }
      playerPreviewVfx?.update(nowMs / 10, 1.25)
      if (inventoryItemInfo && currentModel) {
        const selectionStartedAtMs = currentModel.kind === 'inventory'
          ? currentModel.selection?.startedAtMs ?? null
          : currentModel.kind === 'service'
            ? currentModel.inventorySelection?.startedAtMs ?? null
            : null
        inventoryItemInfo.visible = currentModel.kind !== 'dialogue'
          && currentModel.dragging === null
          && selectionStartedAtMs !== null
          && nowMs - selectionStartedAtMs >= HUB_INVENTORY_INTERACTION.itemInfoDelayMs
      }
      gpu.canvas.dataset.nativeItemInfo = inventoryItemInfo?.visible ? 'visible' : 'hidden'
      if (inventoryDragger) {
        for (const child of inventoryDragger.children) {
          if (child.label === 'native-inventory-drag-pulse') {
            child.alpha = 0.15 + (Math.sin(nowMs / 90) + 1) * 0.15
          }
        }
      }
      if (inventoryFlybys.length > 0) {
        const frames = inventoryFlybys.map((flyby) => {
          updateInventoryFlybyView(flyby, nowMs)
          return hubInventoryFlybyFrame(flyby.model.startedAtMs, nowMs)
        })
        const activeIndex = inventoryFlybys.findIndex(({ model }) => model.phase === 'flying')
        const representativeIndex = activeIndex >= 0 ? activeIndex : inventoryFlybys.length - 1
        gpu.canvas.dataset.nativeInventoryFlybyAfterimages = `${inventoryFlybys.reduce(
          (total, flyby, index) => total + frames[index]!.afterimages.length * flyby.model.lanes.length,
          0,
        )}`
        gpu.canvas.dataset.nativeInventoryFlybyMainItems = `${inventoryFlybys.reduce(
          (total, flyby, index) => total + (
            frames[index]!.mainVisible && flyby.model.phase === 'flying'
              ? flyby.model.lanes.length
              : 0
          ),
          0,
        )}`
        gpu.canvas.dataset.nativeInventoryFlybyPhase = activeIndex >= 0 ? 'flying' : 'trailing'
        gpu.canvas.dataset.nativeInventoryFlybyTicks = `${frames[representativeIndex]!.tick}`
      } else {
        delete gpu.canvas.dataset.nativeInventoryFlybyPhase
        delete gpu.canvas.dataset.nativeInventoryFlybyAfterimages
        delete gpu.canvas.dataset.nativeInventoryFlybyMainItems
        delete gpu.canvas.dataset.nativeInventoryFlybyTicks
      }
      if (inventorySackPages) {
        const offsets = hubSackPageOffsets(
          inventorySackPages.transition.direction,
          inventorySackPages.transition.startedAtMs,
          nowMs,
        )
        inventorySackPages.incoming.x = offsets.incomingX
        inventorySackPages.outgoing.x = offsets.outgoingX
        gpu.canvas.dataset.nativeSackPageState = offsets.settled ? 'settled' : 'moving'
        gpu.canvas.dataset.nativeSackPageTicks = `${offsets.ticks}`
      } else {
        delete gpu.canvas.dataset.nativeSackPageState
        delete gpu.canvas.dataset.nativeSackPageTicks
      }
      if (unforgeTarget) {
        const tint = hubUnforgeTargetTint(nowMs / 10)
        unforgeTarget.tint = tint
        gpu.canvas.dataset.nativeUnforgeTint = tint.toString(16).padStart(6, '0')
      } else delete gpu.canvas.dataset.nativeUnforgeTint
      const dyeModal = currentModel?.kind === 'dialogue' ? null : currentModel?.dyeModal ?? null
      if (dyeLayer && dyeModal) {
        const opacity = hubDyeModalOpacity(dyeModal.openedAtMs, dyeModal.closingAtMs, nowMs)
        dyeLayer.alpha = opacity
        const selectedPulse = hubDyeSelectedPulse(dyeModal.selectedAtMs, nowMs)
        if (dyeSelectedPulse) {
          dyeSelectedPulse.alpha = selectedPulse
          dyeSelectedPulse.visible = selectedPulse > 0
        }
        gpu.canvas.dataset.nativeDyeOpacity = opacity.toFixed(2)
        gpu.canvas.dataset.nativeDyePulse = selectedPulse.toFixed(2)
      } else {
        delete gpu.canvas.dataset.nativeDyeOpacity
        delete gpu.canvas.dataset.nativeDyePulse
      }
      gpu.canvas.dataset.dowsingFlash = flashAlpha > 0 ? 'active' : 'idle'
      gpu.canvas.dataset.dowsingFlashTrigger = flashAlpha > 0 ? dowsingFlashTrigger ?? '' : ''
      gpu.canvas.dataset.nativePressedBodyRecord = currentModel !== null
        && currentModel.kind !== 'dialogue'
        && currentModel.pressedControl !== null
        ? '102'
        : '101'
      const noticeReveal = noticeRevealStartedAt === null
        ? 1
        : hubNativeUiReveal(
            nowMs - noticeRevealStartedAt,
            HUB_NATIVE_UI_TIMING.messageBoxRevealPerTick,
          )
      gpu.canvas.dataset.nativeNoticeReveal = noticeRevealStartedAt === null
        ? 'idle'
        : noticeReveal >= 1
          ? 'settled'
          : 'revealing'
      const pulse = 0.82 + Math.sin(nowMs / 260) * 0.08
      for (const child of surface.children) {
        if (child.label === 'native-notice') child.alpha = noticeReveal
        if (child.label === 'native-selection-glow') child.alpha = pulse
        if (typeof child.label === 'string' && child.label.startsWith('native-seal:')) {
          child.rotation = Number(child.label.slice('native-seal:'.length)) + nowMs / 60_000
        }
      }
      let chatComplete = false
      if (currentModel?.kind === 'dialogue' && chatRenderState
        && currentModel.content.kind === 'speech') {
        const acceleratedAtMs = currentModel.acceleratedAtMs
        const normalElapsedMs = acceleratedAtMs === null
          ? Math.max(0, nowMs - currentModel.phaseStartedAtMs)
          : Math.max(0, acceleratedAtMs - currentModel.phaseStartedAtMs)
        const acceleratedElapsedMs = acceleratedAtMs === null
          ? 0
          : Math.max(0, nowMs - acceleratedAtMs)
        const travel = hubNativeUiElapsedTicks(normalElapsedMs) * HUB_NATIVE_UI_TIMING.chatScrollPerTick
          + hubNativeUiElapsedTicks(acceleratedElapsedMs)
            * HUB_NATIVE_UI_TIMING.chatAcceleratedScrollPerTick
        chatRenderState.content.y = HUB_CHAT_PANEL.contentHeight - 36 - travel
        chatComplete = travel > chatRenderState.contentHeight + HUB_CHAT_PANEL.contentHeight - 36
        gpu.canvas.dataset.nativeChatState = chatComplete ? 'complete' : 'scrolling'
      } else if (currentModel?.kind === 'dialogue') {
        gpu.canvas.dataset.nativeChatState = 'choices'
      } else delete gpu.canvas.dataset.nativeChatState
      application.renderer.render(application.stage)
      return { chatComplete }
    },
    setModel(model) {
      if (
        currentModel?.kind === 'dialogue'
        && currentModel.content.kind === 'selector'
        && model.kind === 'dialogue'
        && model.content.kind === 'selector'
        && currentModel.content.selector === model.content.selector
        && currentModel.selectorRows === model.selectorRows
        && currentModel.gold === model.gold
        && currentModel.highlightedSelectorId === model.highlightedSelectorId
        && currentModel.selectedSelectorId === model.selectedSelectorId
        && model.content.selector !== 'boast'
        && chatRenderState
      ) {
        currentModel = model
        chatRenderState.content.y = -hubNpcSelectorClampScroll(
          model.selectorScroll,
          model.selectorRows.length,
        )
        return
      }
      const feedback = model.kind === 'dialogue' ? null : model.economy.actionFeedback
      const nextActionFeedbackSequence = feedback?.sequence ?? 0
      const nextDowsingFlashSequence = hubDowsingFlashFeedbackSequence(feedback)
      if (
        previousActionFeedbackSequence !== null
        && nextActionFeedbackSequence !== previousActionFeedbackSequence
        && nextDowsingFlashSequence === nextActionFeedbackSequence
      ) {
        dowsingFlashStartedAt = performance.now()
        dowsingFlashTrigger = feedback!.action as 'buy-dowsing' | 'dowse'
        dowsingFlash.alpha = 1
        gpu.canvas.dataset.dowsingFlash = 'active'
      }
      previousActionFeedbackSequence = nextActionFeedbackSequence
      const nextNotice = model.kind === 'dialogue' ? null : model.notice
      if (nextNotice && nextNotice.title !== previousNoticeTitle) {
        noticeRevealStartedAt = performance.now()
      } else if (!nextNotice) noticeRevealStartedAt = null
      previousNoticeTitle = nextNotice?.title ?? null
      currentKind = model.kind
      currentModel = model
      if (model.kind === 'dialogue'
          && model.content.kind === 'selector'
          && model.content.selector === 'boast') {
        const plan = planBoastDialogue(model)
        const rows = model.selectorRows.filter((_, index) => (
          plan.rowBounds[index]?.visibleBounds != null
        ))
        gpu.canvas.dataset.nativeBoastMenu = (
          model.selectorRows.length > NATIVE_BOAST_PRESENTATION.stockRowCount
        )
          ? 'mod-expanded'
          : 'stock'
        gpu.canvas.dataset.nativeBoastContentHeight = `${plan.contentHeight}`
        gpu.canvas.dataset.nativeBoastScrollMax = `${plan.maximumScrollY}`
        gpu.canvas.dataset.nativeBoastScrollY = `${plan.scrollY}`
        gpu.canvas.dataset.nativeBoastRows = `${rows.length}`
        gpu.canvas.dataset.nativeBoastIconRecords = rows.map(row => (
          row.boastIcon?.kind === 'stock' ? row.boastIcon.record : 'mod'
        )).join(',')
        gpu.canvas.dataset.nativeBoastHighlighted = model.highlightedSelectorId === null
          ? ''
          : typeof model.highlightedSelectorId === 'number'
            ? `native:${model.highlightedSelectorId}`
            : boastSelectionKey(model.highlightedSelectorId)
      } else {
        delete gpu.canvas.dataset.nativeBoastContentHeight
        delete gpu.canvas.dataset.nativeBoastMenu
        delete gpu.canvas.dataset.nativeBoastScrollMax
        delete gpu.canvas.dataset.nativeBoastScrollY
        delete gpu.canvas.dataset.nativeBoastRows
        delete gpu.canvas.dataset.nativeBoastIconRecords
        delete gpu.canvas.dataset.nativeBoastHighlighted
      }
      if (model.kind !== 'dialogue' && model.sackPath.length > 0) {
        gpu.canvas.dataset.nativeInventoryParentHolder = 'visible'
        gpu.canvas.dataset.nativeInventoryParentHolderAlpha = `${HUB_INVENTORY_PARENT_HOLDER.alpha}`
      } else {
        delete gpu.canvas.dataset.nativeInventoryParentHolder
        delete gpu.canvas.dataset.nativeInventoryParentHolderAlpha
      }
      curtainAlpha = model.kind === 'dialogue' ? 0 : 1
      serviceOverlay = null
      dyeLayer = null
      dyeSelectedPulse = null
      dowsingFieldTiles = []
      chatRenderState = null
      playerPreviewVfx = null
      inventoryDragger = null
      inventoryFlybys = []
      inventoryItemInfo = null
      inventorySackPages = null
      modalHud = null
      unforgeTarget = null
      surface.removeChildren().forEach((child) => child.destroy({ children: true }))
      if (model.kind === 'inventory') {
        const inventory = buildInventory(context, surface, model)
        playerPreviewVfx = inventory.playerPreview
        inventoryDragger = inventory.dragger
        inventoryFlybys = inventory.flybys
        inventoryItemInfo = inventory.itemInfo
        inventorySackPages = inventory.sackPages
        modalHud = inventory.modalHud
      }
      else if (model.kind === 'dialogue') chatRenderState = buildDialogue(context, surface, model)
      else {
        const service = buildService(context, surface, model)
        serviceOverlay = service.overlay
        inventoryDragger = service.dragger
        inventoryFlybys = service.flybys
        inventoryItemInfo = service.itemInfo
        inventorySackPages = service.sackPages
        modalHud = service.modalHud
        dowsingFieldTiles = serviceOverlay.children.filter(
          (child): child is Sprite => child instanceof Sprite && child.label === 'native-dowsing-field',
        )
      }
      if (model.kind !== 'dialogue' && model.dyeModal) {
        const dye = buildDyeClothing(context, surface, model.economy, model.dyeModal)
        dyeLayer = dye.layer
        dyeSelectedPulse = dye.selectedPulse
      }
      unforgeTarget = surface.children.find(
        (child): child is Sprite => child instanceof Sprite && child.label === 'native-unforge-target',
      ) ?? null
      if (nextNotice) {
        buildNotice(
          context,
          surface,
          nextNotice,
          model.kind === 'dialogue' ? null : model.pressedControl,
        )
      }
      if (inventorySackPages) {
        const offsets = hubSackPageOffsets(
          inventorySackPages.transition.direction,
          inventorySackPages.transition.startedAtMs,
          performance.now(),
        )
        inventorySackPages.incoming.x = offsets.incomingX
        inventorySackPages.outgoing.x = offsets.outgoingX
      }
      application.renderer.render(application.stage)
    },
  }
}

interface RenderContext {
  readonly elementVfxTextures: PlayerWorldTextures['elementVfx']
  readonly modTextures: ModPresentationTextures
  readonly playerCharacterAtlas: PlayerCharacterAtlas
  readonly textures: GameTextureMap
}

interface ChatRenderState {
  readonly content: Container
  readonly contentHeight: number
}

interface InventoryBuildState {
  readonly dragger: Container | null
  readonly flybys: readonly InventoryFlybyView[]
  readonly itemInfo: Container | null
  readonly modalHud: Container
  readonly playerPreview: NativeElementVfxView | null
  readonly sackPages: InventorySackPages | null
}

interface InventorySackPages {
  readonly incoming: Container
  readonly outgoing: Container
  readonly transition: HubInventorySackTransitionModel
}

function buildInventory(
  context: RenderContext,
  layer: Container,
  model: {
    readonly belt: PlayerBeltComponent
    readonly config: PlayerCharacterConfig
    readonly economy: ProtocolPlayerEconomy
    readonly companion?: boolean
    readonly dragging?: HubInventoryDragModel | null
    readonly flybys?: readonly HubInventoryFlybyModel[]
    readonly leftPane?: 'hagatha' | 'stats'
    readonly inspection?: HubServiceInspectionModel | null
    readonly progression: ProtocolPlayerProgression
    readonly sackPath: readonly number[]
    readonly sackTransition: HubInventorySackTransitionModel | null
    readonly selection?: HubInventorySelectionModel | null
    readonly statsPage: number
  },
): InventoryBuildState {
  const { economy, progression } = model
  const companion = model.companion ?? false
  const dragging = model.dragging ?? null
  const flybys = model.flybys ?? []
  const hiddenItemIds = new Set(
    flybys.flatMap((flyby) => (
      flyby.phase === 'flying' ? flyby.lanes.map(({ item }) => item.id) : []
    )),
  )
  const selection = model.selection ?? null
  const visibleBackpack = inventoryItemsAtSackPath(economy.backpack, model.sackPath)
    ?? economy.backpack
  const background = new Graphics().rect(0, 0, 1600, 900).fill({ color: 0x000000 })
  layer.addChild(background)

  addInventorySidePanel(context, layer, 'left', companion)
  addInventorySidePanel(context, layer, 'right', companion)
  if (model.leftPane === 'hagatha') addHagathaInventoryPane(context, layer, economy)
  else addStats(context, layer, model, companion, model.statsPage)
  if (!companion && model.leftPane !== 'hagatha' && model.statsPage === 2
      && model.inspection?.kind === 'owned-perk') {
    addOwnedPerkInspection(context, layer, economy, model.inspection, companion)
  }
  const playerPreview = companion ? null : addPlayerPreview(context, layer, model.config.element)
  addEquipment(
    context,
    layer,
    economy,
    selection,
    dragging,
    hiddenItemIds,
    companion,
    model.config.element,
  )

  addTiledAtlas(context, layer, 'UI', 49, 0, 490, 1600, 310)
  addHorizontalChain(context, layer, 0, 470, 1600)
  addHorizontalChain(context, layer, 0, 800, 1600)
  addBackpackFrame(context, layer)
  addBitmapText(context, layer, 'BACKPACK', 'menu', 800, 489, { tint: 0xaaa2a6 })

  let sackPages: InventorySackPages | null = null
  if (model.sackTransition) {
    const outgoing = new Container()
    const incoming = new Container()
    outgoing.label = 'native-sack-page-outgoing'
    incoming.label = 'native-sack-page-incoming'
    addInventoryGridPage(
      context,
      outgoing,
      inventoryItemsAtSackPath(economy.backpack, model.sackTransition.fromPath) ?? [],
      null,
      null,
      model.config.element,
      inventorySackAtPath(economy.backpack, model.sackTransition.fromPath),
      hiddenItemIds,
    )
    addInventoryGridPage(
      context,
      incoming,
      inventoryItemsAtSackPath(economy.backpack, model.sackTransition.toPath) ?? [],
      selection,
      null,
      model.config.element,
      inventorySackAtPath(economy.backpack, model.sackTransition.toPath),
      hiddenItemIds,
    )
    layer.addChild(outgoing, incoming)
    sackPages = { incoming, outgoing, transition: model.sackTransition }
  } else {
    const page = new Container()
    page.label = 'native-sack-page-current'
    addInventoryGridPage(
      context,
      page,
      visibleBackpack,
      selection,
      dragging,
      model.config.element,
      inventorySackAtPath(economy.backpack, model.sackPath),
      hiddenItemIds,
    )
    layer.addChild(page)
  }

  addGold(context, layer, economy.gold)
  const modalHud = addBelt(
    context,
    layer,
    model.belt,
    economy,
    progression,
    model.config.element,
  )
  const unforgeTarget = addCenteredAtlasSprite(
    context,
    layer,
    'UI',
    75,
    ...HUB_UNFORGE_TARGET.center,
  )
  unforgeTarget.label = 'native-unforge-target'

  const flybyViews = flybys.map((flyby) => (
    addInventoryFlyby(context, layer, flyby, model.config.element)
  ))

  const selected = selection ? inventoryItemForSelection(economy, selection) : null
  const selectedCenter = selection
    ? inventorySelectionCenter(economy, selection, companion, model.sackPath)
    : null
  const itemInfo = selected && selectedCenter && !dragging
      && flybys.every(({ phase }) => phase !== 'flying')
    ? addInventoryItemInfo(
        context,
        layer,
        selected,
        selectedCenter.x,
        selectedCenter.y,
        {
          creativityRank: permanentSkillRank(
            progression,
            NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
          ),
          ownedRecipeIndexes: economyRecipeIndexes(economy),
          playerLevel: progression.level,
        },
      )
    : null
  const dragger = dragging
    ? addInventoryDragger(context, layer, inventoryItemForDrag(economy, dragging), dragging, model.config.element)
    : null
  return { dragger, flybys: flybyViews, itemInfo, modalHud, playerPreview, sackPages }
}

function addInventoryGridPage(
  context: RenderContext,
  layer: Container,
  source: readonly HubInventoryItem[],
  selection: HubInventorySelectionModel | null,
  dragging: HubInventoryDragModel | null,
  element: WizardElement,
  parentHolderItem: HubInventoryItem | null,
  hiddenItemIds: ReadonlySet<number>,
): void {
  const hasParentRoot = parentHolderItem !== null
  const items = new Map(projectInventoryRootSlots(source)
    .filter(({ slot }) => slot < HUB_INVENTORY_GRID.capacity - (hasParentRoot ? 1 : 0))
    .map(({ item, slot }) => [hubInventoryVisibleSlot(slot, hasParentRoot), item] as const))
  for (let index = 0; index < HUB_INVENTORY_GRID.capacity; index += 1) {
    const position = hubInventorySlotPosition(index)
    const slot = addAtlasSprite(context, layer, 'Inventory', 10, position.x, position.y)
    slot.alpha = HUB_INVENTORY_GRID.slotAlpha
    if (index === HUB_INVENTORY_PARENT_HOLDER.visibleSlot && parentHolderItem) {
      const parentHolder = new Container()
      parentHolder.label = 'native-inventory-parent-holder'
      parentHolder.alpha = HUB_INVENTORY_PARENT_HOLDER.alpha
      addClippedItemIcon(
        context,
        parentHolder,
        parentHolderItem,
        position.x + HUB_INVENTORY_GRID.cellSize / 2,
        position.y + HUB_INVENTORY_GRID.cellSize / 2,
        element,
        [position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize],
      )
      layer.addChild(parentHolder)
    }
    const item = items.get(index)
    if (!item) continue
    const held = hiddenItemIds.has(item.id)
      || (dragging?.owner === 'backpack' && item.id === dragging.itemId)
    if (!held) addClippedItemIcon(
      context,
      layer,
      item,
      position.x + 36,
      position.y + 36,
      element,
      [position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize],
    )
    if (!held && item.quantity > 1) {
      addBitmapText(context, layer, `${item.quantity}`, 'medium', position.x + 61, position.y + 54, {
        align: 'center',
        tint: 0xf4e5b4,
      })
    }
    if (item.id === selection?.id && selection.owner === 'backpack') {
      addInventorySelection(
        layer,
        position.x,
        position.y,
        HUB_INVENTORY_GRID.cellSize,
        HUB_INVENTORY_GRID.cellSize,
      )
    }
  }
}

function inventorySackAtPath(
  backpack: readonly HubInventoryItem[],
  path: readonly number[],
): HubInventoryItem | null {
  const id = path.at(-1)
  if (id === undefined) return null
  const item = findInventoryItem(backpack, id)
  return item?.kind === 'sack' && item.nativeTypeId === 7008 ? item : null
}

interface InventoryFlybyLaneView {
  readonly afterimages: ReadonlyMap<number, Container>
  readonly main: Container
  readonly model: HubInventoryFlybyLaneModel
}

interface InventoryFlybyView {
  readonly container: Container
  readonly lanes: readonly InventoryFlybyLaneView[]
  readonly model: HubInventoryFlybyModel
}

function addInventoryFlyby(
  context: RenderContext,
  layer: Container,
  model: HubInventoryFlybyModel,
  element: WizardElement,
): InventoryFlybyView {
  const container = new Container()
  container.label = 'native-inventory-flyby'
  const lanes = model.lanes.map((lane) => {
    const afterimages = new Map<number, Container>()
    for (const spawnTick of HUB_INVENTORY_FLYBY.afterimageBirthTicks) {
      const afterimage = new Container()
      afterimage.label = `native-inventory-flyby-afterimage-${spawnTick}`
      afterimage.visible = false
      addItemIcon(context, afterimage, lane.item, 0, 0, element)
      afterimages.set(spawnTick, afterimage)
      container.addChild(afterimage)
    }
    const main = new Container()
    main.label = 'native-inventory-flyby-main'
    addItemIcon(context, main, lane.item, 0, 0, element)
    container.addChild(main)
    return { afterimages, main, model: lane }
  })
  layer.addChild(container)
  const view = { container, lanes, model }
  updateInventoryFlybyView(view, model.startedAtMs)
  return view
}

function updateInventoryFlybyView(view: InventoryFlybyView, nowMs: number): void {
  const frame = hubInventoryFlybyFrame(view.model.startedAtMs, nowMs)
  const afterimages = new Map(frame.afterimages.map((afterimage) => (
    [afterimage.spawnTick, afterimage] as const
  )))
  for (const lane of view.lanes) {
    const mainPoint = hubInventoryFlybyPoint(lane.model.from, lane.model.to, frame.mainProgress)
    lane.main.position.set(mainPoint.x, mainPoint.y)
    lane.main.visible = view.model.phase === 'flying' && frame.mainVisible
    for (const [spawnTick, container] of lane.afterimages) {
      const afterimage = afterimages.get(spawnTick)
      container.visible = afterimage !== undefined
      if (!afterimage) continue
      const point = hubInventoryFlybyPoint(lane.model.from, lane.model.to, afterimage.progress)
      container.position.set(point.x, point.y)
      container.alpha = afterimage.alpha
    }
  }
}

function addInventorySidePanel(
  context: RenderContext,
  layer: Container,
  side: 'left' | 'right',
  companion: boolean,
): void {
  const shift = companion ? 0 : side === 'left' ? -53 : 53
  if (side === 'left') {
    for (const x of [233, 24]) {
      addCenteredAtlasSprite(context, layer, 'UI', 30, x + shift, 429)
      addCenteredAtlasSprite(context, layer, 'UI', 30, x + shift, 39)
    }
    addCenteredAtlasSprite(context, layer, 'UI', 33, 53 + shift, 249, -1, 1)
    addCenteredAtlasSprite(context, layer, 'UI', 29, 303 + shift, 449, 1, -1)
    addCenteredAtlasSprite(context, layer, 'UI', 32, 63 + shift, 439, 0.85, 0.85)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 343 + shift, 449, -0.75, 0.75)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 343 + shift, 39, -1, 1)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 73 + shift, 39)
    addCenteredAtlasSprite(context, layer, 'UI', 20, 55 + shift, 119)
  } else {
    for (const x of [1367, 1576]) {
      addCenteredAtlasSprite(context, layer, 'UI', 30, x + shift, 429)
      addCenteredAtlasSprite(context, layer, 'UI', 30, x + shift, 39)
    }
    addCenteredAtlasSprite(context, layer, 'UI', 33, 1547 + shift, 279)
    addCenteredAtlasSprite(context, layer, 'UI', 29, 1297 + shift, 449, -1, -1)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 1527 + shift, 439, 0.85, 0.85)
    addCenteredAtlasSprite(context, layer, 'UI', 32, 1257 + shift, 459, -0.75, 0.75)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 1257 + shift, 39)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 1527 + shift, 39, -1, 1)
    addCenteredAtlasSprite(context, layer, 'UI', 20, 1549 + shift, 119)
  }

  const paneLeft = (side === 'left' ? 103 : 1177) + shift
  addTiledAtlas(context, layer, 'UI', 49, paneLeft, 89, 320, 320)
  addInventoryPaneCorners(context, layer, paneLeft, 89)

  const cornerCenters = side === 'left'
    ? [[107, 128], [108, 398], [109, 128], [110, 398]] as const
    : [[107, 1202], [108, 1472], [109, 1202], [110, 1472]] as const
  cornerCenters.forEach(([record, x], index) => {
    addCenteredAtlasSprite(context, layer, 'UI', record, x + shift, index < 2 ? 114 : 384)
  })
  if (side === 'left') addSectionHeader(context, layer, 'STATS', 217 + shift, 309 + shift, 263 + shift)
  else addSectionHeader(context, layer, 'EQUIP', 1291 + shift, 1383 + shift, 1337 + shift)
}

function addInventoryPaneCorners(
  context: RenderContext,
  layer: Container,
  left: number,
  top: number,
): void {
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, left + 36.5, top + 36.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, left + 283.5, top + 36.5, -1, 1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, left + 36.5, top + 283.5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, left + 283.5, top + 283.5, -1, -1)
}

function addSectionHeader(
  context: RenderContext,
  layer: Container,
  label: string,
  leftX: number,
  rightX: number,
  textX: number,
): void {
  addCenteredAtlasSprite(context, layer, 'UI', 4, leftX, 76)
  addCenteredAtlasSprite(context, layer, 'UI', 4, rightX, 76, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, leftX, 96, 1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, rightX, 96, -1, -1)
  addBitmapText(context, layer, label, 'menu', textX, 96, { tint: 0xaaa2a6 })
}

function addBackpackFrame(context: RenderContext, layer: Container): void {
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, -63.5, 513.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1663.5, 513.5, -1, 1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, -63.5, 775.5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1663.5, 775.5, -1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 21, 481)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 1631, 481)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 21, 809)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 1631, 809)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 722.5, 470)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 877.5, 470, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 722.5, 490, 1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 877.5, 490, -1, -1)
}

function addStats(
  context: RenderContext,
  layer: Container,
  model: {
    readonly config: PlayerCharacterConfig
    readonly economy: ProtocolPlayerEconomy
    readonly progression: ProtocolPlayerProgression
  },
  companion: boolean,
  page: number,
): void {
  if (!Number.isInteger(page) || page < 0 || page >= HUB_INVENTORY_STATS_PAGES.pageCount) {
    throw new RangeError('native InventoryScreen stats page must be within [0,2]')
  }
  const clipRect = companion
    ? HUB_INVENTORY_STATS_PAGES.companionClipRect
    : HUB_INVENTORY_STATS_PAGES.standaloneClipRect
  const viewport = new Container({ label: 'native-inventory-stats-viewport' })
  const content = new Container({ label: 'native-inventory-stats-content' })
  const mask = new Graphics()
    .rect(clipRect[0], clipRect[1], clipRect[2], clipRect[3])
    .fill({ color: 0xffffff })
  content.mask = mask
  content.y = -page * HUB_INVENTORY_STATS_PAGES.pageHeight
  viewport.addChild(content, mask)
  layer.addChild(viewport)

  const decorationShift = companion ? 0 : -53
  const contentShift = companion ? 53 : 0
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 119 + decorationShift, 151)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 309 + decorationShift, 151)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 164 + decorationShift, 233.5)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 169 + decorationShift, 284.5)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 319 + decorationShift, 256.5)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 119 + decorationShift, 367.5)
  const indicatorX = companion
    ? HUB_INVENTORY_STATS_PAGES.companionIndicatorX
    : HUB_INVENTORY_STATS_PAGES.standaloneIndicatorX
  for (const y of [379, 699]) {
    addCenteredAtlasSprite(context, content, 'Inventory', HUB_INVENTORY_STATS_PAGES.indicatorRecord, indicatorX, y)
  }
  for (const y of [439, 759]) {
    addCenteredAtlasSprite(
      context,
      content,
      'Inventory',
      HUB_INVENTORY_STATS_PAGES.indicatorRecord,
      indicatorX,
      y,
      1,
      -1,
    )
  }
  addInset(content, 86 + contentShift, 112, 227, 29)
  addInset(content, 86 + contentShift, 143, 227, 43)
  addInset(
    content,
    HUB_PRIMARY_SPELL_PANE.headingRect[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.headingRect[1],
    HUB_PRIMARY_SPELL_PANE.headingRect[2],
    HUB_PRIMARY_SPELL_PANE.headingRect[3],
  )
  addInset(
    content,
    HUB_PRIMARY_SPELL_PANE.bodyRect[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.bodyRect[1],
    HUB_PRIMARY_SPELL_PANE.bodyRect[2],
    HUB_PRIMARY_SPELL_PANE.bodyRect[3],
  )
  addInset(content, 86 + contentShift, 330, 227, 54)
  addBitmapText(context, content, model.config.displayName.toUpperCase(), 'menu', 96 + contentShift, 136, { align: 'left', tint: 0xffffff })
  addBitmapText(
    context,
    content,
    hubInventoryWizardIdentityText(
      model.progression.level,
      model.config.element,
      model.config.discipline,
    ),
    'medium',
    96 + contentShift,
    159,
    { align: 'left', tint: 0xe4c56d },
  )
  addBitmapText(context, content, 'MELEE DAMAGE', 'medium', 96 + contentShift, 348, { align: 'left', tint: 0xe4c56d })
  addBitmapText(context, content, '0.5 - 1 / WHACK', 'medium', 96 + contentShift, 371, {
    align: 'left',
    tint: HUB_PRIMARY_SPELL_PANE.textTint,
  })

  const primarySpellLines = hubInventoryPrimarySpellLines(
    model.config.element,
    model.progression.learnedSkills,
  )
  const primaryTextLeft = HUB_PRIMARY_SPELL_PANE.textLeft + contentShift
  addBitmapText(
    context,
    content,
    'PRIMARY SPELL',
    HUB_PRIMARY_SPELL_PANE.headingFont,
    primaryTextLeft,
    HUB_PRIMARY_SPELL_PANE.headingTextBaselineY,
    { align: 'left', tint: 0xe4c56d },
  )
  primarySpellLines.forEach((line, index) => addBitmapTextRuns(
    context,
    content,
    [
      { advanceScale: HUB_PRIMARY_SPELL_PANE.contentAdvanceScale, text: line.text },
      ...(line.unit ? [{
        advanceScale: HUB_PRIMARY_SPELL_PANE.contentAdvanceScale
          * HUB_PRIMARY_SPELL_PANE.inlineUnit.scale,
        italic: HUB_PRIMARY_SPELL_PANE.inlineUnit.italic,
        offsetX: HUB_PRIMARY_SPELL_PANE.inlineUnit.offset[0],
        offsetY: HUB_PRIMARY_SPELL_PANE.inlineUnit.offset[1],
        scale: HUB_PRIMARY_SPELL_PANE.inlineUnit.scale,
        text: line.unit,
      }] : []),
    ],
    HUB_PRIMARY_SPELL_PANE.contentFont,
    primaryTextLeft,
    HUB_PRIMARY_SPELL_PANE.contentTextBaselines[index]!,
    HUB_PRIMARY_SPELL_PANE.textTint,
  ))

  addInventoryAttributePage(context, content, model.progression, contentShift)
  addHagathaInventoryPane(context, content, model.economy, decorationShift, 640)
}

function addInventoryAttributePage(
  context: RenderContext,
  layer: Container,
  progression: ProtocolPlayerProgression,
  shiftX: number,
): void {
  const page = HUB_INVENTORY_ATTRIBUTES_PAGE
  addInset(layer, page.attributesHeadingRect[0] + shiftX, page.attributesHeadingRect[1], page.attributesHeadingRect[2], page.attributesHeadingRect[3])
  addInset(layer, page.attributesBodyRect[0] + shiftX, page.attributesBodyRect[1], page.attributesBodyRect[2], page.attributesBodyRect[3])
  addInset(layer, page.resistancesHeadingRect[0] + shiftX, page.resistancesHeadingRect[1], page.resistancesHeadingRect[2], page.resistancesHeadingRect[3])
  addInset(layer, page.resistancesBodyRect[0] + shiftX, page.resistancesBodyRect[1], page.resistancesBodyRect[2], page.resistancesBodyRect[3])
  addBitmapText(context, layer, 'ATTRIBUTES', 'body', page.titleCenterX + shiftX, page.attributesHeadingTextBaselineY, { tint: 0xe4c56d })
  addBitmapText(context, layer, 'RESISTANCES', 'body', page.titleCenterX + shiftX, page.resistancesHeadingTextBaselineY, { tint: 0xe4c56d })
  const attributeRows = [
    ['HEALTH:', `${nativeRoundedStat(progression.currentHealth)}/${nativeRoundedStat(progression.maximumHealth)}`],
    ['MANA:', `${nativeRoundedStat(progression.currentMana)}/${nativeRoundedStat(progression.maximumMana)}`],
    ['CAST SPEED:', `${nativeRoundedStat(progression.inventoryStats.castSpeedPercent)}%`],
    ['WALK SPEED:', `${nativeRoundedStat(progression.inventoryStats.walkSpeedPercent)}%`],
  ] as const
  attributeRows.forEach(([label, value], index) => {
    const y = page.attributesRows[index]!
    addBitmapText(context, layer, label, 'medium', page.labelRight + shiftX, y, { align: 'right', tint: 0xffffff })
    addBitmapText(context, layer, value, 'medium', page.valueLeft + shiftX, y, { align: 'left', tint: 0xffffff })
  })
  const resistanceRows = [
    ['PAIN:', progression.inventoryStats.painResistancePercent],
    ['MAGIC:', progression.inventoryStats.magicResistancePercent],
    ['POISON:', progression.inventoryStats.poisonResistancePercent],
  ] as const
  resistanceRows.forEach(([label, value], index) => {
    const y = page.resistanceRows[index]!
    addBitmapText(context, layer, label, 'medium', page.labelRight + shiftX, y, { align: 'right', tint: 0xffffff })
    addBitmapText(context, layer, `${nativeRoundedStat(value)}%`, 'medium', page.valueLeft + shiftX, y, { align: 'left', tint: 0xffffff })
  })
}

function nativeRoundedStat(value: number): string {
  return `${Math.round(value)}`
}

function addPlayerPreview(context: RenderContext, layer: Container, element: WizardElement): NativeElementVfxView {
  const seal = addAtlasSprite(context, layer, 'UI', 62, 800, 249, { anchor: 0.5, scale: 1.25 })
  seal.alpha = 0.32
  seal.label = 'native-seal:0'
  const heading = 9
  const centerX = 800
  const centerY = 249
  const actor = new Container({ label: 'native-inventory-player-preview' })
  actor.sortableChildren = true
  actor.position.set(centerX, centerY)
  actor.scale.set(1.25)
  layer.addChild(actor)
  const staffFront = playerCharacterStaffIsFront(heading)
  const layers = [
    [PLAYER_CHARACTER_SHEETS.staffBack, 0, staffFront ? -1 : 1],
    [PLAYER_CHARACTER_SHEETS.robeDynamic[element], 0, 3],
    [PLAYER_CHARACTER_SHEETS.robeFixed[element], 0, 4],
    [PLAYER_CHARACTER_SHEETS.staffFront, 0, staffFront ? 5 : -1],
    [PLAYER_CHARACTER_SHEETS.head[element], null, 7],
  ] as const
  for (const [source, column, zIndex] of layers) {
    if (zIndex < 0) continue
    const sprite = new Sprite(actorFrameTexture(context, source, heading, column))
    sprite.anchor.set(0.5)
    sprite.zIndex = zIndex
    actor.addChild(sprite)
  }
  const vfx = new NativeElementVfxView(element, context.elementVfxTextures)
  const orbOffset = playerCharacterStaffOrbOffset(heading)
  vfx.container.position.set(orbOffset.x, orbOffset.y)
  vfx.container.zIndex = staffFront ? 6 : 2
  actor.addChild(vfx.container)
  vfx.update(0, 1)
  addBitmapText(context, layer, 'KILLS: 0', 'medium', 800, 337, { tint: 0xe7cc71 })
  addBitmapText(context, layer, 'AWESOMENESS: 0', 'medium', 800, 359, { tint: 0xe7cc71 })
  return vfx
}

function actorFrameTexture(
  context: RenderContext,
  sheet: string,
  heading: number,
  column: number | null,
): Texture {
  return context.playerCharacterAtlas.frame(sheet, column ?? 0, heading)
}

function addEquipment(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel | null,
  dragging: HubInventoryDragModel | null,
  hiddenItemIds: ReadonlySet<number>,
  companion: boolean,
  element: WizardElement,
): void {
  const xShift = companion ? 0 : 53
  for (const [x, y] of [[1337, 224], [1337, 289], [1479, 192], [1479, 256], [1479, 321]] as const) {
    addCenteredAtlasSprite(context, layer, 'Inventory', 16, x + xShift, y)
  }
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const draggedBackpack = dragging?.owner === 'backpack'
    ? findInventoryItem(economy.backpack, dragging.itemId)
    : null
  const targetItem = draggedBackpack
  const acceptingSlots = new Set(targetItem ? equipmentSlotsForItem(targetItem, thirdRingUnlocked) : [])
  for (const slot of ['amulet', 'hat', 'weapon', 'robe', 'ring-0', 'ring-1', 'ring-2'] as const) {
    if (slot === 'ring-2' && !thirdRingUnlocked) continue
    const item = itemAtEquipmentSlot(economy, slot)
    const held = hiddenItemIds.has(item?.id ?? -1)
      || (dragging?.owner === 'equipment' && dragging.equipmentSlot === slot)
    for (const [x, y, width, height] of hubInventoryEquipmentSlotRects(slot, companion)) {
      layer.addChild(new Graphics()
        .rect(x, y, width, height)
        .fill({ color: HUB_EQUIPMENT_SINK_RENDER.interiorTint }))
      if (height === 46 || height === 72) {
        addAtlasSprite(
          context,
          layer,
          'Inventory',
          height === 46
            ? HUB_EQUIPMENT_SINK_RENDER.smallFrameRecord
            : HUB_EQUIPMENT_SINK_RENDER.normalFrameRecord,
          x,
          y,
        )
      } else if (HUB_EQUIPMENT_SINK_RENDER.tallPrimitiveOutline) {
        addPrimitiveFrame(layer, x + 1, y, width - 1, height - 1)
      }
      if (item && !held) addClippedItemIcon(
        context,
        layer,
        item,
        x + width / 2,
        y + height / 2,
        element,
        [x, y, width, height],
      )
      if (
        acceptingSlots.has(slot)
        || (selection?.owner === 'equipment'
          && selection.equipmentSlot === slot
          && selection.id === item?.id)
      ) addInventorySelection(layer, x, y, width, height)
    }
  }
}

function addBelt(
  context: RenderContext,
  layer: Container,
  belt: PlayerBeltComponent,
  economy: ProtocolPlayerEconomy,
  progression: ProtocolPlayerProgression,
  element: WizardElement,
): Container {
  const hudLayer = new Container()
  hudLayer.label = 'native-modal-hud'
  layer.addChild(hudLayer)
  const hud = nativeHudModalSlideLayout(
    NATIVE_HUD_BACKBUFFER.width,
    NATIVE_HUD_BACKBUFFER.height,
    0,
  )
  addModalHudControls(context, hudLayer, hud)
  hud.belt.forEach((slot, index) => {
    const { x, y } = nativeHudRectCenter(slot)
    addCenteredAtlasSprite(context, hudLayer, 'UI', 2, x, y)
    const entry = belt[index]
    if (entry?.kind === 'skill') {
      addCenteredAtlasSprite(
        context,
        hudLayer,
        'Skills',
        nativeSkillIconRecord(entry.skillId, progression.weldBuildId),
        x,
        y,
      )
      return
    }
    if (!entry) return
    const potion = entry.kind === 'health-potion'
      ? nativeBeltPotionProjection(economy.backpack, 0)
      : entry.kind === 'mana-potion'
        ? nativeBeltPotionProjection(economy.backpack, 1)
        : null
    const item = potion?.item ?? nativeBeltEntryItem(entry, economy)
    if (!item) return
    addItemIcon(context, hudLayer, item, x, y, element)
    const quantity = potion?.count ?? item.quantity
    if (quantity > 1) addBitmapText(context, hudLayer, `${quantity}`, 'medium', x + 20, y + 22, {
      tint: 0xf4e5b4,
    })
  })
  addCenteredAtlasSprite(context, layer, 'UI', 82, 800.5, 872)
  return hudLayer
}

function addModalHudControls(
  context: RenderContext,
  layer: Container,
  hud: NativeHudControlLayout,
): void {
  for (const [control, rect] of [
    [HUB_MODAL_HUD_CONTROLS.backpack, hud.backpack],
    [HUB_MODAL_HUD_CONTROLS.tome, hud.tome],
  ] as const) {
    const center = nativeHudRectCenter(rect)
    const shadow = addCenteredAtlasSprite(
      context,
      layer,
      'UI',
      control.record,
      center.x + HUB_MODAL_HUD_CONTROLS.shadowOffset[0],
      center.y + HUB_MODAL_HUD_CONTROLS.shadowOffset[1],
    )
    shadow.label = `${control.label}-shadow`
    shadow.tint = HUB_MODAL_HUD_CONTROLS.shadowTint
    const base = addCenteredAtlasSprite(context, layer, 'UI', control.record, center.x, center.y)
    base.label = control.label
  }
}

function buildDialogue(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
): ChatRenderState {
  if (model.content.kind === 'selector') {
    if (model.content.selector === 'boast') {
      return buildBoastDialogue(context, layer, model)
    }
    return buildNpcSelector(context, layer, model)
  }
  const dialogue = hubInteractionDialogue(model.interaction, model.storyOffice)
  addChatPanel(context, layer)
  addBitmapText(
    context,
    layer,
    dialogue.name.toUpperCase(),
    'menu',
    HUB_CHAT_PANEL.titleCenterX,
    HUB_CHAT_PANEL.titleTextBaselineY,
    { tint: HUB_CHAT_PANEL.textTint },
  )

  const viewport = new Container()
  viewport.position.set(HUB_CHAT_PANEL.contentLeft, HUB_CHAT_PANEL.contentTop)
  const mask = new Graphics()
    .rect(0, 0, HUB_CHAT_PANEL.contentWidth, HUB_CHAT_PANEL.contentHeight)
    .fill({ color: 0xffffff })
  const content = new Container()
  viewport.addChild(mask, content)
  viewport.mask = mask
  layer.addChild(viewport)

  let contentHeight = 0
  if (model.content.kind === 'choices') {
    const choices = hubNpcChatChoices(model.interaction, model.storyOffice)
    const rowHeight = Math.min(52, HUB_CHAT_PANEL.contentHeight / Math.max(1, choices.length))
    choices.forEach((choice, index) => addBitmapText(
      context,
      content,
      choice.label,
      'menu',
      HUB_CHAT_PANEL.contentWidth / 2,
      54 + index * rowHeight,
      {
        scale: choice.kind === 'command' ? 1.25 : 1,
        tint: choice.kind === 'command'
          ? HUB_CHAT_PANEL.actionTextTint
          : HUB_CHAT_PANEL.textTint,
      },
    ))
  } else {
    const paragraphs = model.content.lines
    const lineHeight = 27
    for (const paragraph of paragraphs) {
      const lineCount = addChatBitmapText(context, content, paragraph, 0, contentHeight, {
        lineHeight,
        maxWidth: HUB_CHAT_PANEL.contentWidth,
        tint: HUB_CHAT_PANEL.textTint,
      })
      contentHeight += lineCount * lineHeight + 22
    }
  }
  addBitmapText(
    context,
    layer,
    model.content.kind === 'speech' ? 'Skip' : 'Done',
    'menu',
    800,
    HUB_CHAT_PANEL.doneTextBaselineY,
    { tint: HUB_CHAT_PANEL.textTint },
  )
  return { content, contentHeight }
}

function buildBoastDialogue(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
): ChatRenderState {
  const plan = planBoastDialogue(model)
  const rendered = nativeUiPixiFor(context.textures).render(plan, 'native-boast-menu')
  const viewport = rendered.children.find(child => child.label === 'boast:swipe-box')
  if (!(viewport instanceof Container)) {
    throw new Error('native Boast SwipeBox content layer is missing')
  }
  for (const placement of plan.customIcons) {
    const row = model.selectorRows.find(candidate => (
      hubNpcSelectorRendererRowKey(candidate) === placement.id
    ))
    const icon = row?.boastIcon
    if (!row || !icon || icon.kind !== 'mod' || typeof row.id === 'number') continue
    const texture = context.modTextures.spriteFrame(
      `boast:${row.id.modId}:${row.id.contentId}`,
      row.id.modId,
      icon.imagePath,
      icon.frame,
    )
    for (const side of ['left', 'right'] as const) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.position.set(
        side === 'left'
          ? placement.leftEdgeX + icon.frame.logicalWidth / 2
          : placement.rightEdgeX - icon.frame.logicalWidth / 2,
        placement.y,
      )
      if (side === 'right') sprite.scale.x = -1
      if (placement.selected) sprite.tint = NATIVE_UI_BOAST_SELECTED_TINT
      sprite.eventMode = 'none'
      sprite.label = `${placement.id}:custom-icon-${side}`
      viewport.addChild(sprite)
    }
  }
  layer.addChild(rendered)
  return { content: new Container({ label: 'native-boast-static-content' }), contentHeight: 0 }
}

function planBoastDialogue(
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
) {
  const active = model.highlightedSelectorId ?? model.selectedSelectorId
  return planNativeUiBoastMenu({
    height: HUB_NATIVE_UI_SIZE.height,
    rows: model.selectorRows.map(row => ({
      detail: row.detail,
      id: hubNpcSelectorRendererRowKey(row),
      label: row.label,
      ...(row.boastIcon?.kind === 'stock' ? { stockIconRecord: row.boastIcon.record } : {}),
      state: selectorIdsEqual(row.id, active) ? 'selected' : 'idle',
    })),
    scrollY: model.selectorScroll,
    width: HUB_NATIVE_UI_SIZE.width,
  })
}

function hubNpcSelectorRendererRowKey(row: HubNpcSelectorRow): string {
  return typeof row.id === 'number' ? `native:${row.id}` : boastSelectionKey(row.id)
}

function selectorIdsEqual(
  left: HubNpcSelectorRow['id'],
  right: HubNpcSelectorRow['id'] | null,
): boolean {
  if (right === null || typeof left === 'number' || typeof right === 'number') return left === right
  return left.contentId === right.contentId && left.modId === right.modId
}

function buildNpcSelector(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
): ChatRenderState {
  if (model.content.kind !== 'selector') {
    throw new TypeError('native NPC selector renderer requires selector content')
  }
  const selector = model.content.selector
  if (selector === 'boast') {
    throw new TypeError('native Boast selector requires the dedicated BoastBox renderer')
  }
  const [panelLeft, panelTop, panelWidth, panelHeight] = HUB_NPC_SELECTOR.panelRect
  addNativeNineSlice(
    context,
    layer,
    'UI',
    HUB_CHAT_PANEL.uiRecord,
    panelLeft,
    panelTop,
    panelWidth,
    panelHeight,
    HUB_CHAT_PANEL.edgeUvOrigin,
  )
  addBitmapText(
    context,
    layer,
    hubNpcSelectorTitle(selector),
    'menu',
    HUB_CHAT_PANEL.titleCenterX,
    HUB_NPC_SELECTOR.titleTextBaselineY,
    { tint: HUB_NPC_SELECTOR.rowTextTint },
  )

  const [viewportLeft, viewportTop, viewportWidth, viewportHeight] = HUB_NPC_SELECTOR.viewportRect
  const viewport = new Container()
  viewport.position.set(viewportLeft, viewportTop)
  const mask = new Graphics()
    .rect(0, 0, viewportWidth, viewportHeight)
    .fill({ color: 0xffffff })
  const content = new Container()
  const scroll = hubNpcSelectorClampScroll(model.selectorScroll, model.selectorRows.length)
  content.position.y = -scroll
  viewport.addChild(mask, content)
  viewport.mask = mask
  layer.addChild(viewport)

  if (model.selectorRows.length === 0) {
    addBitmapText(
      context,
      content,
      selector === 'teacher-spells' ? 'ALL SPELLS\nALREADY BOUGHT!' : 'NO ENTRIES',
      'menu',
      viewportWidth / 2,
      HUB_NPC_SELECTOR.emptyTextBaselineY - viewportTop,
      { align: 'center', tint: HUB_NPC_SELECTOR.rowTextTint },
    )
  }

  model.selectorRows.forEach((row, index) => {
    const [, globalTop] = hubNpcSelectorRowRect(index, 0)
    const rowX = HUB_NPC_SELECTOR.rowInsetX
    const rowY = globalTop - viewportTop
    const active = selectorIdsEqual(
      row.id,
      model.highlightedSelectorId ?? model.selectedSelectorId,
    )
    const rowTint = active
      ? NATIVE_UI_BOAST_SELECTED_TINT
      : HUB_NPC_SELECTOR.rowTextTint
    const frame = new Container()
    addNativeNineSlice(
      context,
      frame,
      'UI',
      HUB_NPC_SELECTOR.rowRecord,
      rowX,
      rowY,
      HUB_NPC_SELECTOR.rowWidth,
      HUB_NPC_SELECTOR.rowHeight,
      HUB_CHAT_PANEL.edgeUvOrigin,
    )
    if (active) frame.tint = HUB_NPC_SELECTOR.selectedTint
    content.addChild(frame)
    if (selector === 'teacher-spells') {
      addTeacherSpellSelectorRow(context, content, row, rowX, rowY, model.gold, rowTint)
    } else {
      addBookSelectorRow(context, content, row, rowX, rowY, rowTint)
    }
  })

  if (selector === 'teacher-spells') {
    addCenteredAtlasSprite(
      context,
      layer,
      'UI',
      21,
      ...HUB_NPC_SELECTOR.balanceIconCenter,
    )
    addBitmapText(
      context,
      layer,
      `${model.gold}`,
      'body',
      ...HUB_NPC_SELECTOR.balanceTextBaseline,
      { align: 'left', tint: 0xffffff },
    )
  }
  addBitmapText(
    context,
    layer,
    'DONE',
    'menu',
    HUB_CHAT_PANEL.titleCenterX,
    HUB_NPC_SELECTOR.doneTextBaselineY,
    { tint: HUB_NPC_SELECTOR.rowTextTint },
  )
  return {
    content,
    contentHeight: hubNpcSelectorContentHeight(model.selectorRows.length),
  }
}

function addTeacherSpellSelectorRow(
  context: RenderContext,
  layer: Container,
  row: HubNpcSelectorRow,
  x: number,
  y: number,
  gold: number,
  tint: number,
): void {
  if (typeof row.id !== 'number') throw new TypeError('native Teacher row ID must be numeric')
  const root = nativeSkillColorRoot(row.id)
  const centerX = x + 43
  const centerY = y + HUB_NPC_SELECTOR.rowHeight / 2
  const backing = addCenteredAtlasSprite(
    context,
    layer,
    'Skills',
    HUB_NPC_SELECTOR.spellBackingRecord,
    centerX,
    centerY,
  )
  backing.tint = skillPickerRootTint(root)
  addCenteredAtlasSprite(
    context,
    layer,
    'Skills',
    HUB_NPC_SELECTOR.spellFrameRecord,
    centerX,
    centerY,
    HUB_NPC_SELECTOR.spellFrameScale,
  )
  const icon = addCenteredAtlasSprite(
    context,
    layer,
    'Skills',
    nativeSkillIconRecord(row.id),
    centerX,
    centerY,
  )
  icon.tint = 0xffffff
  addBitmapText(context, layer, row.label, 'special-uppercase', x + 90, y + 31, {
    align: 'left',
    tint,
  })
  addBitmapText(context, layer, row.detail.toUpperCase(), 'medium', x + 90, y + 49, {
    align: 'left',
    lineHeight: HUB_NPC_SELECTOR.spellDescriptionLineHeight,
    maxWidth: HUB_NPC_SELECTOR.spellDescriptionWidth,
    scale: HUB_NPC_SELECTOR.spellDescriptionScale,
    tint,
  })
  if (row.price !== null) {
    addBitmapText(context, layer, `${row.price}`, 'body', x + HUB_NPC_SELECTOR.rowWidth - 3, y + 80, {
      align: 'right',
      tint: hubNpcSelectorPriceTint(row.price, gold),
    })
  }
}

function addBookSelectorRow(
  context: RenderContext,
  layer: Container,
  row: HubNpcSelectorRow,
  x: number,
  y: number,
  tint: number,
): void {
  if (typeof row.id !== 'number') throw new TypeError('native Book row ID must be numeric')
  const record = hubNpcBookArtRecord(row.label)
  const artWidth = nativeUiRecord('Library', record).logicalSize[0]
  const art = addCenteredAtlasSprite(
    context,
    layer,
    'Library',
    record,
    x + HUB_NPC_SELECTOR.bookArtInsetX + artWidth / 2,
    y + HUB_NPC_SELECTOR.rowHeight / 2,
  )
  art.tint = tint
  addBitmapText(
    context,
    layer,
    hubNpcBookDisplayTitle(row.label),
    'special-uppercase',
    x + HUB_NPC_SELECTOR.bookTextInsetX,
    y + HUB_NPC_SELECTOR.rowHeight / 2 - 15,
    {
      align: 'left',
      lineHeight: 22,
      maxWidth: HUB_NPC_SELECTOR.rowWidth - HUB_NPC_SELECTOR.bookTextInsetX - 15,
      tint,
    },
  )
}

function buildService(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): {
  readonly dragger: Container | null
  readonly flybys: readonly InventoryFlybyView[]
  readonly itemInfo: Container | null
  readonly modalHud: Container
  readonly overlay: Container
  readonly sackPages: InventorySackPages | null
} {
  const inventory = buildInventory(context, layer, {
    belt: model.belt,
    companion: true,
    config: model.config,
    economy: model.economy,
    dragging: model.dragging,
    flybys: model.flybys,
    inspection: model.inspection,
    leftPane: model.trader === 'hagatha' ? 'hagatha' : 'stats',
    progression: model.progression,
    sackPath: model.sackPath,
    sackTransition: model.sackTransition,
    selection: model.inventorySelection,
    statsPage: model.statsPage,
  })
  const overlay = new Container()
  overlay.label = 'native-service-overlay'
  layer.addChild(overlay)
  const { width } = HUB_SHOP_PANEL
  addShopPanel(context, overlay, model.trader === 'shlorio' && model.economy.dowsingOffers.length > 0)
  const dialogue = HUB_TRADER_DIALOGUES[model.trader]
  const titleFont: FontName = measureNativeUiText(dialogue.title, 'menu') > width - 55
    ? 'medium'
    : 'menu'
  addBitmapText(context, overlay, dialogue.title, titleFont, 800, HUB_SHOP_TEXT.titleTextBaselineY, {
    tint: HUB_SHOP_TEXT.goldTint,
  })

  if (model.trader === 'shlorio' && model.economy.dowsingOffers.length === 0) {
    addCenteredAtlasSprite(context, overlay, 'UI', 15, 800, 75)
    overlay.addChild(new Graphics()
      .rect(...HUB_DOWSING_PREROLL.referenceDropRect)
      .fill({ color: 0x000000 }))
    addDowsingButton(
      context,
      overlay,
      model.economy.dowsingFee,
      model.pressedControl === 'dowsing',
    )
    addDoneControl(context, overlay)
    addServiceInspection(context, layer, model)
    if (inventory.dragger) layer.addChild(inventory.dragger)
    for (const flyby of inventory.flybys) layer.addChild(flyby.container)
    return {
      dragger: inventory.dragger,
      flybys: inventory.flybys,
      itemInfo: inventory.itemInfo,
      modalHud: inventory.modalHud,
      overlay,
      sackPages: inventory.sackPages,
    }
  }

  if (model.trader === 'luthacus') {
    addStoreGrid(
      context,
      overlay,
      model.economy.storage,
      model,
      'storage',
    )
  } else if (model.trader === 'shlorio') {
    addDowsingGrid(context, overlay, serviceItems(model), model)
  } else {
    addStoreGrid(context, overlay, serviceItems(model), model, null)
  }
  addDoneControl(context, overlay)
  addServiceInspection(context, layer, model)
  if (inventory.dragger) layer.addChild(inventory.dragger)
  for (const flyby of inventory.flybys) layer.addChild(flyby.container)
  return {
    dragger: inventory.dragger,
    flybys: inventory.flybys,
    itemInfo: inventory.itemInfo,
    modalHud: inventory.modalHud,
    overlay,
    sackPages: inventory.sackPages,
  }
}

function buildDyeClothing(
  context: RenderContext,
  root: Container,
  economy: ProtocolPlayerEconomy,
  model: HubInventoryDyeModalModel,
): { readonly layer: Container; readonly selectedPulse: Graphics | null } {
  const layer = new Container()
  layer.label = 'native-dye-clothing'
  layer.alpha = 0
  layer.addChild(new Graphics()
    .rect(0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height)
    .fill({ color: 0x000000, alpha: HUB_NATIVE_UI_TIMING.messageBoxCurtainAlpha }))
  const [panelLeft, panelTop, panelWidth, panelHeight] = HUB_DYE_CLOTHING.panelRect
  layer.addChild(new Graphics()
    .rect(panelLeft, panelTop, panelWidth, panelHeight)
    .fill({ color: 0x090908, alpha: 0.96 })
    .stroke({ color: 0xd8ba70, width: 3 }))
  layer.addChild(new Graphics()
    .rect(panelLeft + 7, panelTop + 7, panelWidth - 14, panelHeight - 14)
    .stroke({ color: 0xeadab3, width: 1 }))
  addBitmapText(
    context,
    layer,
    'FABRIC DYE',
    'menu',
    HUB_NATIVE_UI_SIZE.width / 2,
    HUB_DYE_CLOTHING.titleTextBaselineY,
    { tint: 0xe4c56d },
  )
  const instruction = model.pending
    ? 'DYEING...'
    : model.targetItemId !== null
      ? 'CHOOSE DYE CLOTH OR DYE TRIM'
      : model.swatchRows.length === 0
        ? 'MIX ONE OR MORE COLORS'
        : 'CHOOSE A HAT OR ROBE FROM YOUR BACKPACK'
  addBitmapText(
    context,
    layer,
    instruction,
    'medium',
    HUB_NATIVE_UI_SIZE.width / 2,
    HUB_DYE_CLOTHING.instructionTextBaselineY,
    { tint: 0xffffff },
  )

  let selectedPulse: Graphics | null = null
  for (let index = 0; index < NATIVE_DYE_SWATCHES.length; index += 1) {
    const rect = hubDyeSwatchRect(index)
    layer.addChild(new Graphics()
      .rect(...rect)
      .fill({ color: NATIVE_DYE_SWATCHES[index]! })
      .stroke({ color: 0x201c13, width: 2 }))
    if (index === model.selectedRow) {
      selectedPulse = new Graphics()
        .rect(rect[0] - 4, rect[1] - 4, rect[2] + 8, rect[3] + 8)
        .stroke({ color: 0xffffff, width: 3 })
      selectedPulse.label = 'native-dye-selected-pulse'
      layer.addChild(selectedPulse)
    }
  }

  const mixedTint = nativeDyeMixedTint(model.swatchRows)
  const [tubLeft, tubTop, tubWidth, tubHeight] = HUB_DYE_CLOTHING.tubRect
  const tub = new Graphics()
    .roundRect(tubLeft, tubTop, tubWidth, tubHeight, 18)
    .fill({
      color: mixedTint ?? 0xffffff,
      alpha: mixedTint === null ? HUB_DYE_CLOTHING.emptyTubAlpha : 1,
    })
    .stroke({ color: 0xeadab3, width: 3 })
  layer.addChild(tub)
  addBitmapText(context, layer, 'DYE TUB', 'medium', tubLeft + tubWidth / 2, tubTop + tubHeight + 25, {
    tint: 0xe4c56d,
  })

  const projected = projectInventoryRootSlots(
    inventoryItemsAtSackPath(economy.backpack, model.path) ?? [],
  ).filter(({ slot }) => (
    slot < HUB_INVENTORY_GRID.capacity - (model.path.length > 0 ? 1 : 0)
  ))
  const eligibleIds = new Set(inventoryDyeableClothingItems(economy.backpack).map(({ item }) => item.id))
  projected.forEach(({ item, slot }) => {
    if (!eligibleIds.has(item.id)) return
    const visibleSlot = hubInventoryVisibleSlot(slot, model.path.length > 0)
    const { x, y } = hubInventorySlotPosition(visibleSlot)
    layer.addChild(new Graphics()
      .rect(x + 2, y + 2, HUB_INVENTORY_GRID.cellSize - 4, HUB_INVENTORY_GRID.cellSize - 4)
      .stroke({ color: item.id === model.targetItemId ? 0xffffff : 0xd8ba70, width: 3 }))
  })
  if (model.targetItemId !== null) {
    const target = projected.find(({ item }) => item.id === model.targetItemId)
    if (target) {
      const rects = hubDyeItemLayerRects(hubInventoryVisibleSlot(
        target.slot,
        model.path.length > 0,
      ))
      layer.addChild(new Graphics()
        .rect(...rects.cloth)
        .fill({ color: 0x000000, alpha: 0.38 })
        .stroke({ color: 0xffffff, width: 2 }))
      layer.addChild(new Graphics()
        .rect(...rects.trim)
        .fill({ color: 0x000000, alpha: 0.38 })
        .stroke({ color: 0xffffff, width: 2 }))
      addBitmapText(
        context,
        layer,
        'CLOTH',
        'body',
        rects.cloth[0] + rects.cloth[2] / 2,
        rects.cloth[1] + 26,
        { tint: 0xffffff },
      )
      addBitmapText(
        context,
        layer,
        'TRIM',
        'body',
        rects.trim[0] + rects.trim[2] / 2,
        rects.trim[1] + 22,
        { tint: 0xffffff },
      )
    }
  }

  const [cancelLeft, cancelTop, cancelWidth, cancelHeight] = HUB_DYE_CLOTHING.cancelRect
  layer.addChild(new Graphics()
    .rect(cancelLeft, cancelTop, cancelWidth, cancelHeight)
    .fill({ color: 0x191916 })
    .stroke({ color: 0xd8ba70, width: 2 }))
  addBitmapText(
    context,
    layer,
    'CANCEL',
    'menu',
    cancelLeft + cancelWidth / 2,
    cancelTop + 31,
    { tint: 0xffffff },
  )
  root.addChild(layer)
  return { layer, selectedPulse }
}

function buildNotice(
  context: RenderContext,
  layer: Container,
  notice: HubInventoryRendererNotice,
  pressedControl: HubInventoryPressedControl,
): void {
  if (notice.variant === 'unforge-confirmation' || notice.variant === 'unforge-result') {
    buildUnforgeNotice(context, layer, notice, pressedControl)
    return
  }
  const noticeLayer = new Container()
  noticeLayer.label = 'native-notice'
  noticeLayer.addChild(new Graphics()
    .rect(0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height)
    .fill({ color: 0x000000, alpha: 0.75 }))
  addTiledAtlas(context, noticeLayer, 'UI', HUB_DOWSING_MSGBOX.horizontalEdgeRecord, 607, 151.5, 386, 19)
  addTiledAtlas(context, noticeLayer, 'UI', HUB_DOWSING_MSGBOX.horizontalEdgeRecord, 607, 529.5, 386, 19)
  addTiledAtlas(context, noticeLayer, 'UI', HUB_DOWSING_MSGBOX.verticalEdgeRecord, 529, 234.5, 21, 231)
  addTiledAtlas(context, noticeLayer, 'UI', HUB_DOWSING_MSGBOX.verticalEdgeRecord, 1050, 234.5, 21, 231)

  HUB_DOWSING_MSGBOX.outerCornerCenters.forEach(([x, y], index) => {
    addCenteredAtlasSprite(context, noticeLayer, 'UI', 107 + index, x, y)
  })
  addTiledAtlas(
    context,
    noticeLayer,
    'UI',
    HUB_DOWSING_MSGBOX.interiorBackgroundRecord,
    ...HUB_DOWSING_MSGBOX.interiorClipRect,
  )
  addNativeNineSlice(
    context,
    noticeLayer,
    'UI',
    HUB_DOWSING_MSGBOX.innerPanelRecord,
    ...HUB_DOWSING_MSGBOX.innerPanelRect,
    HUB_DOWSING_MSGBOX.innerPanelEdgeUvOrigin,
  )
  const skullHeader = addCenteredAtlasSprite(
    context,
    noticeLayer,
    'UI',
    18,
    ...HUB_DOWSING_MSGBOX.skullHeaderCenter,
  )
  skullHeader.rotation = Math.PI / 2
  for (const [x, y, scale] of HUB_DOWSING_MSGBOX.arrowCentersAndScales) {
    addCenteredAtlasSprite(context, noticeLayer, 'UI', 8, x, y, scale)
  }

  addBitmapText(
    context,
    noticeLayer,
    notice.title,
    'menu',
    HUB_DOWSING_MSGBOX.bodyLeft,
    HUB_DOWSING_MSGBOX.titleTextBaselineY,
    { align: 'left', tint: 0xffffff },
  )
  addBitmapText(context, noticeLayer, notice.body, 'medium', HUB_DOWSING_MSGBOX.bodyLeft, HUB_DOWSING_MSGBOX.bodyTextBaselineY, {
    align: 'left',
    lineHeight: 17,
    maxWidth: HUB_DOWSING_MSGBOX.bodyMaxWidth,
    tint: 0xffffff,
  })
  addMessageBoxButton(
    context,
    noticeLayer,
    notice.actionLabel,
    pressedControl === 'message-primary',
  )
  layer.addChild(noticeLayer)
}

function buildUnforgeNotice(
  context: RenderContext,
  layer: Container,
  notice: HubInventoryRendererNotice,
  pressedControl: HubInventoryPressedControl,
): void {
  const confirmation = notice.variant === 'unforge-confirmation'
  const resultLayout = confirmation ? null : hubUnforgeResultLayout(Math.max(
    measureNativeUiText(notice.title, 'menu'),
    measureNativeUiText(notice.summary ?? 'Unforging bonus:', 'medium'),
    measureNativeUiText(notice.body, 'medium'),
  ))
  const innerPanelRect = confirmation
    ? HUB_UNFORGE_CONFIRMATION.innerPanelRect
    : resultLayout!.innerPanelRect
  const bodyLeft = confirmation ? HUB_UNFORGE_CONFIRMATION.bodyLeft : resultLayout!.bodyLeft
  const titleTextBaselineY = confirmation
    ? HUB_UNFORGE_CONFIRMATION.titleTextBaselineY
    : HUB_UNFORGE_RESULT.titleTextBaselineY
  const noticeLayer = new Container()
  noticeLayer.label = 'native-notice'
  noticeLayer.addChild(new Graphics()
    .rect(0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height)
    .fill({ color: 0x000000, alpha: HUB_NATIVE_UI_TIMING.messageBoxCurtainAlpha }))
  addContentSizedMessageBox(context, noticeLayer, innerPanelRect)

  addBitmapText(
    context,
    noticeLayer,
    notice.title,
    'menu',
    bodyLeft,
    titleTextBaselineY,
    { align: 'left', tint: 0xffffff },
  )
  if (confirmation) {
    addBitmapText(
      context,
      noticeLayer,
      notice.body,
      'medium',
      HUB_UNFORGE_CONFIRMATION.bodyLeft,
      HUB_UNFORGE_CONFIRMATION.bodyTextBaselineY,
      {
        align: 'left',
        lineHeight: 17,
        maxWidth: HUB_UNFORGE_CONFIRMATION.bodyMaxWidth,
        tint: 0xffffff,
      },
    )
    addContentSizedMessageButton(
      context,
      noticeLayer,
      notice.actionLabel,
      HUB_UNFORGE_CONFIRMATION.primaryButtonRect,
      pressedControl === 'message-primary',
    )
    addContentSizedMessageButton(
      context,
      noticeLayer,
      notice.secondaryActionLabel ?? 'CANCEL',
      HUB_UNFORGE_CONFIRMATION.secondaryButtonRect,
      pressedControl === 'message-secondary',
    )
  } else {
    addBitmapText(
      context,
      noticeLayer,
      notice.summary ?? 'Unforging bonus:',
      'medium',
      resultLayout!.bodyLeft,
      HUB_UNFORGE_RESULT.summaryTextBaselineY,
      { align: 'left', tint: HUB_SHOP_TEXT.goldTint },
    )
    addBitmapText(
      context,
      noticeLayer,
      notice.body,
      'medium',
      resultLayout!.bodyLeft,
      HUB_UNFORGE_RESULT.outcomeTextBaselineY,
      { align: 'left', tint: notice.outcomeTint ?? 0x40ff40 },
    )
    addContentSizedMessageButton(
      context,
      noticeLayer,
      notice.actionLabel,
      resultLayout!.primaryButtonRect,
      pressedControl === 'message-primary',
    )
  }
  layer.addChild(noticeLayer)
}

function addContentSizedMessageBox(
  context: RenderContext,
  layer: Container,
  innerRect: readonly [number, number, number, number],
): void {
  const [x, y, width, height] = innerRect
  addTiledAtlas(context, layer, 'UI', HUB_DOWSING_MSGBOX.horizontalEdgeRecord, x + 66.5, y - 11.5, width - 133, 19)
  addTiledAtlas(context, layer, 'UI', HUB_DOWSING_MSGBOX.horizontalEdgeRecord, x + 66.5, y + height - 7.5, width - 133, 19)
  addTiledAtlas(context, layer, 'UI', HUB_DOWSING_MSGBOX.verticalEdgeRecord, x - 11.5, y + 71.5, 21, height - 143)
  addTiledAtlas(context, layer, 'UI', HUB_DOWSING_MSGBOX.verticalEdgeRecord, x + width - 9.5, y + 71.5, 21, height - 143)
  const corners = [
    [x + 24, y + 27],
    [x + width - 24, y + 27],
    [x + 24, y + height - 27],
    [x + width - 24, y + height - 27],
  ] as const
  corners.forEach(([centerX, centerY], index) => {
    addCenteredAtlasSprite(context, layer, 'UI', 107 + index, centerX, centerY)
  })
  addTiledAtlas(
    context,
    layer,
    'UI',
    HUB_DOWSING_MSGBOX.interiorBackgroundRecord,
    x - 5,
    y - 5,
    width + 10,
    height + 10,
  )
  addNativeNineSlice(
    context,
    layer,
    'UI',
    HUB_DOWSING_MSGBOX.innerPanelRecord,
    x,
    y,
    width,
    height,
    HUB_DOWSING_MSGBOX.innerPanelEdgeUvOrigin,
  )
  const centerX = x + width / 2
  const skull = addCenteredAtlasSprite(context, layer, 'UI', 18, centerX, y - 42)
  skull.rotation = Math.PI / 2
  addCenteredAtlasSprite(context, layer, 'UI', 8, centerX, y + height + 55)
  addCenteredAtlasSprite(context, layer, 'UI', 8, centerX - 75, y + height + 42, 0.75)
  addCenteredAtlasSprite(context, layer, 'UI', 8, centerX + 75, y + height + 42, 0.75)
}

function addContentSizedMessageButton(
  context: RenderContext,
  layer: Container,
  label: string,
  [left, top, width, height]: readonly [number, number, number, number],
  pressed: boolean,
): void {
  addNativeButton(
    context,
    layer,
    `content-message-${label}`,
    label,
    [left, top, width, height],
    pressed,
    left + width / 2,
    top + 45,
  )
}

function addStoreGrid(
  context: RenderContext,
  layer: Container,
  items: readonly (HubInventoryItem | HubShopItem)[],
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
  owner: 'storage' | null,
): void {
  const addressedItems = owner === 'storage'
    ? new Map(projectInventoryRootSlots(items).map(({ item, slot }) => [slot, item] as const))
    : null
  for (let index = 0; index < HUB_SHOP_GRID.retainedCapacity; index += 1) {
    const { x, y } = hubShopSlotPosition(index)
    const slot = addAtlasSprite(context, layer, 'Inventory', 10, x, y)
    slot.alpha = HUB_SHOP_GRID.slotAlpha
    const item = addressedItems?.get(index) ?? items[index]
    if (!item) continue
    const held = owner === 'storage'
      && model.dragging?.owner === 'storage'
      && model.dragging.itemId === item.id
    const selected = item.id === model.selectedItemId && model.selectedOwner === owner
    const price = 'price' in item && typeof item.price === 'number' ? item.price : null
    if (selected && !held) {
      const record = owner === 'storage'
        ? HUB_STOREGRID_SELECTED_RECORDS.takeClickAgain
        : price !== null && price > model.economy.gold
          ? HUB_STOREGRID_SELECTED_RECORDS.unaffordable
          : HUB_STOREGRID_SELECTED_RECORDS.buyClickAgain
      const unaffordable = record === HUB_STOREGRID_SELECTED_RECORDS.unaffordable
      addAtlasSprite(
        context,
        layer,
        'UI',
        record,
        x + (unaffordable ? -0.5 : 3),
        y + (unaffordable ? 5.5 : 11),
      )
    } else if (!held && model.trader === 'hagatha') {
      const selector = 'recipeIndex' in item ? item.recipeIndex ?? -1 : -1
      if (selector >= 0) addAtlasSprite(context, layer, 'Skills', 127 + selector, x + 36, y + 36, { anchor: 0.5 })
      else addAtlasSprite(context, layer, 'Inventory', 5, x + 36, y + 36, { anchor: 0.5, scale: 0.6 })
    } else if (!held) addClippedItemIcon(
      context,
      layer,
      item,
      x + 36,
      y + 36,
      model.config.element,
      [x, y, HUB_SHOP_GRID.cellSize, HUB_SHOP_GRID.cellSize],
    )
    if (!held && price !== null) {
      addBitmapText(
        context,
        layer,
        `${price}`,
        HUB_SHOP_TEXT.priceFont,
        x + HUB_SHOP_TEXT.priceTextRightOffsetX,
        y + HUB_SHOP_TEXT.priceTextBaselineOffsetY,
        {
          align: 'right',
          tint: price > model.economy.gold
            ? HUB_SHOP_TEXT.unaffordableTint
            : HUB_SHOP_TEXT.affordableTint,
        },
      )
    } else if (!held && item.quantity > 1) {
      addBitmapText(
        context,
        layer,
        `${item.quantity}`,
        HUB_SHOP_TEXT.priceFont,
        x + HUB_SHOP_TEXT.priceTextRightOffsetX,
        y + HUB_SHOP_TEXT.priceTextBaselineOffsetY,
        {
          align: 'right',
          tint: 0xf4e5b4,
        },
      )
    }
  }
}

function addDowsingGrid(
  context: RenderContext,
  layer: Container,
  items: readonly HubShopItem[],
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): void {
  for (let index = 0; index < HUB_DOWSING_GRID.retainedCapacity; index += 1) {
    const { x, y } = hubDowsingSlotPosition(index)
    const slot = addAtlasSprite(context, layer, 'Inventory', 10, x, y)
    slot.alpha = HUB_DOWSING_GRID.slotAlpha
    const item = items[index]
    if (!item) continue
    const selected = item.id === model.selectedItemId
    if (selected) {
      const record = item.price > model.economy.gold
        ? HUB_STOREGRID_SELECTED_RECORDS.unaffordable
        : HUB_STOREGRID_SELECTED_RECORDS.buyClickAgain
      const unaffordable = record === HUB_STOREGRID_SELECTED_RECORDS.unaffordable
      addAtlasSprite(
        context,
        layer,
        'UI',
        record,
        x + (unaffordable ? -0.5 : 3),
        y + (unaffordable ? 5.5 : 11),
      )
    } else addClippedItemIcon(
      context,
      layer,
      item,
      x + 36,
      y + 36,
      model.config.element,
      [x, y, HUB_DOWSING_GRID.cellSize, HUB_DOWSING_GRID.cellSize],
    )
    addBitmapText(
      context,
      layer,
      `${item.price}`,
      HUB_SHOP_TEXT.priceFont,
      x + HUB_SHOP_TEXT.priceTextRightOffsetX,
      y + HUB_SHOP_TEXT.priceTextBaselineOffsetY,
      {
        align: 'right',
        tint: item.price > model.economy.gold
          ? HUB_SHOP_TEXT.unaffordableTint
          : HUB_SHOP_TEXT.affordableTint,
      },
    )
  }
}

function serviceItems(model: Extract<HubInventoryRendererModel, { kind: 'service' }>): readonly HubShopItem[] {
  if (model.trader === 'fomentius') return model.economy.fomentiusStock
  if (model.trader === 'hagatha') return model.economy.hagathaOffers.map((offer) => ({
    equipmentType: null,
    iconRecords: offer.selector < 0 ? [10] : [],
    id: offer.selector,
    kind: 'equipment',
    name: offer.name,
    nativeSubtype: offer.selector,
    nativeTypeId: 0,
    price: offer.price,
    quantity: 1,
    rarity: null,
    recipeIndex: offer.selector,
  }))
  return model.economy.dowsingOffers.map((offer) => {
    const recipe = DOWSING_EQUIPMENT_RECIPES[offer.recipeIndex]!
    return {
      equipmentType: recipe.type,
      iconRecords: recipe.iconRecords,
      id: offer.id,
      kind: 'equipment',
      name: recipe.name,
      nativeSubtype: null,
      nativeTypeId: recipe.nativeTypeId,
      price: offer.price,
      quantity: 1,
      rarity: recipe.rarity,
      recipeIndex: recipe.sourceIndex,
    }
  })
}

function addServiceInspection(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): void {
  const inspection = model.inspection
  if (!inspection || model.notice) return
  if (inspection.kind === 'owned-perk') {
    if (
      (model.trader !== 'hagatha' && model.statsPage !== 2)
      || model.economy.ownedPerkSelectors[inspection.index] !== inspection.selector
    ) return
    addOwnedPerkInspection(context, layer, model.economy, inspection, true)
    return
  }
  if (model.trader === 'hagatha') {
    const index = model.economy.hagathaOffers.findIndex(
      ({ selector }) => selector === inspection.id,
    )
    const offer = model.economy.hagathaOffers[index]
    if (!offer || inspection.owner !== null) return
    const { x, y } = hubShopSlotPosition(index)
    addNativeContextualHoverBox(
      context,
      layer,
      hubHagathaTooltipLines({
        bundleSelectors: offer.members,
        cheatDeathCharges: null,
        firstMixed: offer.price === offer.basePrice,
        price: offer.price,
        selector: offer.selector,
      }),
      x + HUB_SHOP_GRID.cellSize / 2,
      y + HUB_SHOP_GRID.cellSize / 2,
      HUB_HOVER_BOX.shopSourceGap,
    )
    return
  }

  const projectedStorage = model.trader === 'luthacus'
    ? projectInventoryRootSlots(model.economy.storage)
    : null
  const items = projectedStorage?.map(({ item }) => item) ?? serviceItems(model)
  const index = items.findIndex(({ id }) => id === inspection.id)
  const item = items[index]
  if (!item) return
  if (model.trader === 'luthacus' && inspection.owner !== 'storage') return
  if (model.trader !== 'luthacus' && inspection.owner !== null) return
  const displayIndex = projectedStorage?.[index]?.slot ?? index
  const position = model.trader === 'shlorio'
    ? hubDowsingSlotPosition(index)
    : hubShopSlotPosition(displayIndex)
  const cellSize = model.trader === 'shlorio'
    ? HUB_DOWSING_GRID.cellSize
    : HUB_SHOP_GRID.cellSize
  addNativeContextualHoverBox(
    context,
    layer,
    hubItemTooltipLines(item, {
      creativityRank: permanentSkillRank(
        model.progression,
        NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
      ),
      ownedRecipeIndexes: economyRecipeIndexes(model.economy),
      playerLevel: model.progression.level,
      price: model.trader === 'luthacus' ? null : hubShopItemPrice(item),
    }),
    position.x + cellSize / 2,
    position.y + cellSize / 2,
    HUB_HOVER_BOX.shopSourceGap,
  )
}

function addOwnedPerkInspection(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  inspection: Extract<HubServiceInspectionModel, { kind: 'owned-perk' }>,
  companion: boolean,
): void {
  if (economy.ownedPerkSelectors[inspection.index] !== inspection.selector) return
  const [baseLeft, top, width, height] = hubOwnedPerkSlotRect(inspection.index)
  const left = baseLeft - (companion ? 0 : 53)
  addNativeContextualHoverBox(
    context,
    layer,
    hubHagathaTooltipLines({
      cheatDeathCharges: inspection.selector === 7 ? 1 : null,
      firstMixed: true,
      price: null,
      selector: inspection.selector,
    }),
    left + width / 2,
    top + height / 2,
    HUB_HOVER_BOX.ownedPerkSourceGap,
  )
}

function economyRecipeIndexes(economy: ProtocolPlayerEconomy): readonly number[] {
  const equipment = [
    economy.equipment.hat,
    economy.equipment.robe,
    economy.equipment.amulet,
    economy.equipment.weapon,
    ...economy.equipment.rings,
  ]
  const visit = (item: HubInventoryItem): readonly number[] => [
    ...(item.recipeIndex === null ? [] : [item.recipeIndex]),
    ...(item.contents ?? []).flatMap(visit),
  ]
  return Object.freeze([
    ...economy.backpack,
    ...economy.storage,
    ...equipment.filter((item): item is HubInventoryItem => item !== null),
  ].flatMap(visit))
}

function permanentSkillRank(
  progression: ProtocolPlayerProgression,
  skillId: number,
): number {
  return progression.learnedSkills.find(([candidate]) => candidate === skillId)?.[1] ?? 0
}

function hubShopItemPrice(item: HubInventoryItem | HubShopItem): number | null {
  return 'price' in item && typeof item.price === 'number' ? item.price : null
}

function addChatPanel(context: RenderContext, layer: Container): void {
  addNativeNineSlice(
    context,
    layer,
    'UI',
    HUB_CHAT_PANEL.uiRecord,
    HUB_CHAT_PANEL.left,
    HUB_CHAT_PANEL.top,
    HUB_CHAT_PANEL.width,
    HUB_CHAT_PANEL.height,
    HUB_CHAT_PANEL.edgeUvOrigin,
  )
}

function addShopPanel(context: RenderContext, layer: Container, purple: boolean): void {
  const { backgroundHeight, backgroundRepeat, settledLeft: left, settledTop: top, width } = HUB_SHOP_PANEL
  for (const blendMode of HUB_SHOP_PANEL.backgroundBlendModes) {
    const backgroundTiles = addRepeatedAtlas(
      context,
      layer,
      'UI',
      49,
      left,
      top,
      width,
      backgroundHeight,
      ...backgroundRepeat,
    )
    for (const tile of backgroundTiles) {
      tile.blendMode = blendMode
      tile.tint = purple ? hubDowsingFieldTint(0) : HUB_SHOP_TEXT.normalBackgroundTint
      if (purple) tile.label = 'native-dowsing-field'
    }
  }
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 557.5, 16.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1041.5, 16.5, -1, 1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 557.5, 333.5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1041.5, 333.5, -1, -1)
  addCenteredAtlasSprite(context, layer, 'Skills', 4, 600, 25)
  addCenteredAtlasSprite(context, layer, 'Skills', 4, 1000, 25, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 588.5, 13)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 1011.5, 13, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 588.5, 33, 1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 1011.5, 33, -1, -1)

  for (let index = 0; index < 5; index += 1) {
    addCenteredAtlasSprite(context, layer, 'UI', 74, 570.5 + index * 129, -35, 1, -1)
  }
  for (let index = 0; index < 10; index += 1) {
    const leftRail = addCenteredAtlasSprite(context, layer, 'UI', 74, 506, -13 + index * 44)
    leftRail.rotation = Math.PI / 2
    const rightRail = addCenteredAtlasSprite(context, layer, 'UI', 74, 1093, -13 + index * 44, 1, -1)
    rightRail.rotation = Math.PI / 2
  }
  addCenteredAtlasSprite(context, layer, 'UI', 73, 1063, 355)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 536, 355, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 1063, -5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 536, -5, -1, -1)
}

function addHagathaInventoryPane(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  offsetX = 0,
  offsetY = 0,
): void {
  const left = HUB_HAGATHA_PERK_PANE.left + offsetX
  const top = HUB_HAGATHA_PERK_PANE.top + offsetY
  for (const [x, y] of [[323, 227], [166, 247], [166, 312], [166, 182], [111, 125]] as const) {
    addCenteredAtlasSprite(context, layer, 'Inventory', 16, x + offsetX, y + offsetY)
  }
  addAtlasSprite(context, layer, 'Inventory', 3, 362 + offsetX, 218 + offsetY)
  layer.addChild(new Graphics()
    .rect(left, top, HUB_HAGATHA_PERK_PANE.innerWidth, HUB_HAGATHA_PERK_PANE.innerHeight)
    .fill({ color: HUB_HAGATHA_PERK_PANE.innerPanelTint })
    .stroke({ color: 0xffffff, width: 1 }))
  addBitmapText(
    context,
    layer,
    'CHARMS/CURSES',
    'medium',
    HUB_HAGATHA_PERK_PANE.titleCenterX + offsetX,
    HUB_HAGATHA_PERK_PANE.titleTextBaselineY + offsetY,
    { tint: HUB_HAGATHA_PERK_PANE.titleTint },
  )
  for (let index = 0; index < HUB_HAGATHA_PERK_PANE.columns * HUB_HAGATHA_PERK_PANE.rows; index += 1) {
    const centerX = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[0] + offsetX
      + (index % HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
    const centerY = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[1] + offsetY
      + Math.floor(index / HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
    const selector = economy.ownedPerkSelectors[index]
    const slot = addCenteredAtlasSprite(
      context,
      layer,
      'Inventory',
      10,
      centerX,
      centerY,
      HUB_HAGATHA_PERK_PANE.slotScale,
    )
    slot.alpha = hubHagathaPerkSlotAlpha(index, economy.charmCapacity)
    if (selector !== undefined) addCenteredAtlasSprite(
      context,
      layer,
      'Skills',
      127 + selector,
      centerX,
      centerY,
      HUB_HAGATHA_PERK_PANE.slotScale,
    )
  }
  const tonicPromptCenter = hubHagathaTonicPromptCenter(economy.charmCapacity)
  if (tonicPromptCenter) {
    addCenteredAtlasSprite(
      context,
      layer,
      'Inventory',
      HUB_HAGATHA_PERK_PANE.tonicPromptRecord,
      tonicPromptCenter[0] + offsetX,
      tonicPromptCenter[1] + offsetY,
    )
  }
}

function addDoneControl(context: RenderContext, layer: Container): void {
  addCenteredAtlasSprite(context, layer, 'UI', 72, 800, 387)
  const middle = addCenteredAtlasSprite(context, layer, 'UI', 12, 800, 385)
  middle.alpha = HUB_SHOP_PANEL.doneMiddleAlpha
  const inner = addCenteredAtlasSprite(context, layer, 'UI', 86, 800, 385)
  inner.tint = HUB_SHOP_PANEL.doneInnerTint
  addBitmapText(context, layer, 'DONE', 'menu', 800, HUB_SHOP_TEXT.doneTextBaselineY, { tint: 0xffffff })
}

function addDowsingButton(
  context: RenderContext,
  layer: Container,
  fee: number,
  pressed: boolean,
): void {
  const copyOffset = addNativeButton(
    context,
    layer,
    'dowsing',
    'DOWSE',
    HUB_DOWSING_PREROLL.buttonActionRect,
    pressed,
    800,
    HUB_DOWSING_PREROLL.labelTextBaselineY,
  )
  addBitmapText(
    context,
    layer,
    `${fee} GOLD`,
    'medium',
    800 + copyOffset,
    HUB_DOWSING_PREROLL.feeTextBaselineY + copyOffset,
    { tint: HUB_SHOP_TEXT.goldTint },
  )
}

function addMessageBoxButton(
  context: RenderContext,
  layer: Container,
  label: string,
  pressed: boolean,
): void {
  addNativeButton(
    context,
    layer,
    'message-primary',
    label,
    HUB_DOWSING_MSGBOX.primaryButtonActionRect,
    pressed,
    800,
    HUB_DOWSING_MSGBOX.primaryButtonTextBaselineY,
  )
}

function addNativeButton(
  context: RenderContext,
  layer: Container,
  id: string,
  label: string,
  [left, top, width, height]: readonly [number, number, number, number],
  pressed: boolean,
  labelCenterX: number,
  labelBaselineY: number,
): number {
  const chrome = planNativeUiButtonChrome({
    bounds: nativeUiRect(left, top, width, height),
    id,
    state: pressed ? 'pressed' : 'idle',
  })
  layer.addChild(nativeUiPixiFor(context.textures).render(chrome, `${id}:chrome`))
  const copyOffset = pressed ? NATIVE_UI_BUTTON.pressedOffset : 0
  addBitmapText(
    context,
    layer,
    label,
    'menu',
    labelCenterX + copyOffset,
    labelBaselineY + copyOffset,
    { tint: HUB_DOWSING_MSGBOX.primaryButtonTextTint },
  )
  return copyOffset
}

function addHorizontalChain(context: RenderContext, layer: Container, x: number, y: number, width: number): void {
  addTiledAtlas(context, layer, 'UI', 10, x, y, width, 24, 1.25)
}

function addInset(layer: Container, x: number, y: number, width: number, height: number): void {
  layer.addChild(new Graphics().rect(x, y, width, height).fill({ color: 0x191916 }))
  addPrimitiveFrame(layer, x + 1, y, width, height)
}

function addPrimitiveFrame(layer: Container, x: number, y: number, width: number, height: number): void {
  layer.addChild(new Graphics().rect(x, y, width, height).stroke({ color: 0x000000, width: 2 }))
  layer.addChild(new Graphics().rect(x + 1, y + 1, width - 2, height - 2).stroke({
    color: 0xeadab3,
    width: 1,
  }))
  layer.addChild(new Graphics().rect(x + 2, y + 2, width - 4, height - 4).stroke({
    color: 0xd8ba70,
    width: 1,
  }))
  layer.addChild(new Graphics().rect(x + 3, y + 3, width - 6, height - 6).stroke({
    color: 0x15130b,
    width: 1,
  }))
}

function addGold(context: RenderContext, layer: Container, gold: number): void {
  addCenteredAtlasSprite(
    context,
    layer,
    'UI',
    NATIVE_INVENTORY_GOLD_LEDGER.iconRecord,
    ...NATIVE_INVENTORY_GOLD_LEDGER.iconCenter,
  )
  addBitmapText(
    context,
    layer,
    gold.toLocaleString(),
    'body',
    NATIVE_INVENTORY_GOLD_LEDGER.textLeft,
    NATIVE_INVENTORY_GOLD_LEDGER.textBaselineY,
    { align: 'left', tint: 0xffffff },
  )
}

function addInventorySelection(
  layer: Container,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  layer.addChild(new Graphics()
    .rect(x + 1, y + 1, width - 2, height - 2)
    .stroke({ color: HUB_INVENTORY_INTERACTION.selectionTint, width: 2 }))
}

function inventoryItemForSelection(
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel,
): HubInventoryItem | null {
  return selection.owner === 'backpack'
    ? findInventoryItem(economy.backpack, selection.id)
    : selection.equipmentSlot === null
      ? null
      : itemAtEquipmentSlot(economy, selection.equipmentSlot)
}

function inventoryItemForDrag(
  economy: ProtocolPlayerEconomy,
  dragging: HubInventoryDragModel,
): HubInventoryItem | null {
  return dragging.owner === 'backpack'
    ? findInventoryItem(economy.backpack, dragging.itemId)
    : dragging.owner === 'storage'
      ? findInventoryItem(economy.storage, dragging.itemId)
    : dragging.equipmentSlot === null
      ? null
      : itemAtEquipmentSlot(economy, dragging.equipmentSlot)
}

function inventorySelectionCenter(
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel,
  companion: boolean,
  sackPath: readonly number[],
): { readonly x: number; readonly y: number } | null {
  if (selection.owner === 'backpack') {
    const visible = inventoryItemsAtSackPath(economy.backpack, sackPath) ?? economy.backpack
    const selected = projectInventoryRootSlots(visible).find(({ item }) => item.id === selection.id)
    const hasParentRoot = sackPath.length > 0
    if (!selected || selected.slot >= HUB_INVENTORY_GRID.capacity - (hasParentRoot ? 1 : 0)) {
      return null
    }
    const position = hubInventorySlotPosition(hubInventoryVisibleSlot(
      selected.slot,
      hasParentRoot,
    ))
    return { x: position.x + 36, y: position.y + 36 }
  }
  if (selection.equipmentSlot === null) return null
  const [rect] = hubInventoryEquipmentSlotRects(selection.equipmentSlot, companion)
  if (!rect) return null
  return { x: rect[0] + rect[2] / 2, y: rect[1] + rect[3] / 2 }
}

function itemAtEquipmentSlot(
  economy: ProtocolPlayerEconomy,
  slot: EquipmentSlot,
): HubInventoryItem | null {
  switch (slot) {
    case 'amulet': return economy.equipment.amulet
    case 'hat': return economy.equipment.hat
    case 'ring-0': return economy.equipment.rings[0]
    case 'ring-1': return economy.equipment.rings[1]
    case 'ring-2': return economy.equipment.rings[2]
    case 'robe': return economy.equipment.robe
    case 'weapon': return economy.equipment.weapon
  }
}

function addInventoryItemInfo(
  context: RenderContext,
  layer: Container,
  item: HubInventoryItem,
  sourceCenterX: number,
  sourceCenterY: number,
  options: HubTooltipOptions,
): Container {
  const info = addNativeContextualHoverBox(
    context,
    layer,
    hubItemTooltipLines(item, options),
    sourceCenterX,
    sourceCenterY,
    HUB_HOVER_BOX.shopSourceGap,
  )
  info.label = 'native-inventory-item-info'
  info.visible = false
  return info
}

function addNativeContextualHoverBox(
  context: RenderContext,
  layer: Container,
  lines: readonly HubTooltipLine[],
  sourceCenterX: number,
  sourceCenterY: number,
  sourceGap: number,
): Container {
  const rendered = lines.map((line) => {
    const font = nativeUiFont(line.font)
    const wrapped = wrapNativeUiText(line.text, line.font, HUB_HOVER_BOX.contentMaxWidth)
    return { font, line, wrapped }
  })
  const contentWidth = Math.max(0, ...rendered.flatMap(({ line, wrapped }) => (
    wrapped.map((text) => measureNativeUiText(text, line.font))
  )))
  const contentHeight = rendered.reduce((height, { font, wrapped }, index) => (
    height
    + wrapped.length * font.metrics[0]
    + (index === rendered.length - 1 ? 0 : HUB_HOVER_BOX.lineGap)
  ), 0)
  const width = contentWidth + HUB_HOVER_BOX.contentMargin * 2
  const height = contentHeight + HUB_HOVER_BOX.contentMargin * 2
  const margin = HUB_HOVER_BOX.viewportMargin
  let x = sourceCenterX + sourceGap
  if (x + width > HUB_NATIVE_UI_SIZE.width - margin) x = sourceCenterX - sourceGap - width
  x = Math.max(margin, Math.min(HUB_NATIVE_UI_SIZE.width - margin - width, x))
  const y = Math.max(
    margin,
    Math.min(HUB_NATIVE_UI_SIZE.height - margin - height, sourceCenterY - height / 2),
  )

  const info = new Container()
  info.label = 'native-contextual-hover-box'
  info.position.set(x, y)
  info.addChild(new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0x000000 })
    .stroke({ color: 0xffffff, width: 1 }))
  let cursorY = HUB_HOVER_BOX.contentMargin
  for (const { font, line, wrapped } of rendered) {
    addBitmapText(
      context,
      info,
      line.text,
      line.font,
      HUB_HOVER_BOX.contentMargin,
      cursorY,
      {
        align: 'left',
        lineHeight: font.metrics[0],
        maxWidth: HUB_HOVER_BOX.contentMaxWidth,
        tint: line.tint,
      },
    )
    cursorY += wrapped.length * font.metrics[0] + HUB_HOVER_BOX.lineGap
  }
  layer.addChild(info)
  return info
}

function addInventoryDragger(
  context: RenderContext,
  layer: Container,
  item: HubInventoryItem | null,
  dragging: HubInventoryDragModel,
  element: WizardElement,
): Container | null {
  if (!item) return null
  const dragger = new Container()
  dragger.label = 'native-inventory-dragger'
  dragger.position.set(dragging.pointer.x, dragging.pointer.y)
  const shadow = new Container()
  shadow.position.set(4, 4)
  addItemIcon(context, shadow, item, 0, 0, element, { alpha: 0.85, tintOverride: 0x000000 })
  const ordinary = new Container()
  addItemIcon(context, ordinary, item, 0, 0, element)
  const pulse = new Container()
  pulse.label = 'native-inventory-drag-pulse'
  pulse.blendMode = 'add'
  addItemIcon(context, pulse, item, 0, 0, element)
  dragger.addChild(shadow, ordinary, pulse)
  layer.addChild(dragger)
  return dragger
}

function addItemIcon(
  context: RenderContext,
  layer: Container,
  item: Pick<
    HubInventoryItem,
    'equipmentType' | 'iconRecords' | 'iconTints' | 'modContent' | 'modItemContent' | 'recipeIndex'
  >,
  centerX: number,
  centerY: number,
  element: WizardElement,
  options: {
    readonly alpha?: number
    readonly tintOverride?: number
  } = {},
): readonly Sprite[] {
  const modContent = item.modContent ?? item.modItemContent
  if (modContent) {
    const textures = [
      context.modTextures.texture(modContent),
      ...(item.modItemContent
        ? [context.modTextures.iconTrim(item.modItemContent)].filter((value): value is Texture => value !== null)
        : []),
    ]
    const tints = item.modItemContent?.wearable?.slot === 'hat'
      || item.modItemContent?.wearable?.slot === 'robe'
      ? item.iconTints ?? [0xffffff, 0xffffff]
      : [0xffffff, 0xffffff]
    return textures.map((texture, index) => {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.position.set(centerX, centerY)
      sprite.alpha = options.alpha ?? 1
      sprite.tint = options.tintOverride ?? tints[index] ?? 0xffffff
      layer.addChild(sprite)
      return sprite
    })
  }
  const transform = item.equipmentType === null
    ? null
    : HUB_ITEM_ICON_TRANSFORMS[item.equipmentType]
  const recipe = item.recipeIndex === null
    ? null
    : DOWSING_EQUIPMENT_RECIPES[item.recipeIndex]
  const iconTints = item.equipmentType === 'hat' || item.equipmentType === 'robe'
    ? item.iconTints
      ?? recipe?.iconTints
      ?? [HUB_STARTER_EQUIPMENT_PRIMARY_TINT[element], 0xffffff]
    : [null, null]
  const sprites: Sprite[] = []
  for (const [index, record] of item.iconRecords.entries()) {
    if (!nativeUiAtlas('Inventory').records[`${record}`]) continue
    const sprite = addAtlasSprite(
      context,
      layer,
      'Inventory',
      record,
      centerX + (transform?.translation[0] ?? 0),
      centerY + (transform?.translation[1] ?? 0),
      { anchor: 0.5 },
    )
    sprite.alpha = options.alpha ?? 1
    sprite.rotation = (transform?.rotationDegrees ?? 0) * Math.PI / 180
    sprite.tint = options.tintOverride ?? iconTints[index] ?? 0xffffff
    sprites.push(sprite)
  }
  return sprites
}

function addClippedItemIcon(
  context: RenderContext,
  layer: Container,
  item: Pick<
    HubInventoryItem,
    'equipmentType' | 'iconRecords' | 'iconTints' | 'modContent' | 'modItemContent' | 'recipeIndex'
  >,
  centerX: number,
  centerY: number,
  element: WizardElement,
  clipRect: readonly [number, number, number, number],
): readonly Sprite[] {
  const clipped = new Container()
  const content = new Container()
  const mask = new Graphics().rect(...clipRect).fill({ color: 0xffffff })
  content.mask = mask
  clipped.addChild(content, mask)
  layer.addChild(clipped)
  return addItemIcon(context, content, item, centerX, centerY, element)
}

function addAtlasSprite(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  x: number,
  y: number,
  options: { readonly anchor?: number; readonly scale?: number } = {},
): Sprite {
  const sprite = new Sprite(atlasTexture(context, atlas, record))
  sprite.anchor.set(options.anchor ?? 0)
  sprite.position.set(x, y)
  sprite.scale.set(options.scale ?? 1)
  layer.addChild(sprite)
  return sprite
}

function addCenteredAtlasSprite(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  centerX: number,
  centerY: number,
  scaleX = 1,
  scaleY = scaleX,
): Sprite {
  const sprite = addAtlasSprite(context, layer, atlas, record, centerX, centerY, { anchor: 0.5 })
  sprite.scale.set(scaleX, scaleY)
  return sprite
}

function addNativeNineSlice(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  x: number,
  y: number,
  width: number,
  height: number,
  edgeUvOrigin: number,
): void {
  const definition = nativeUiRecord(atlas, record)
  const [cornerWidth, cornerHeight] = definition.logicalSize
  const middleWidth = width - cornerWidth * 2
  const middleHeight = height - cornerHeight * 2

  addAtlasSprite(context, layer, atlas, record, x, y)
  const topRight = addAtlasSprite(context, layer, atlas, record, x + width, y)
  topRight.scale.x = -1
  const bottomLeft = addAtlasSprite(context, layer, atlas, record, x, y + height)
  bottomLeft.scale.y = -1
  const bottomRight = addAtlasSprite(context, layer, atlas, record, x + width, y + height)
  bottomRight.scale.set(-1, -1)

  const horizontalEdge = atlasSliceTexture(context, atlas, record, edgeUvOrigin, 0, 1, 1)
  const verticalEdge = atlasSliceTexture(context, atlas, record, 0, edgeUvOrigin, 1, 1)
  const center = atlasSliceTexture(context, atlas, record, edgeUvOrigin, edgeUvOrigin, 1, 1)
  addStretchedTexture(layer, horizontalEdge, x + cornerWidth, y, middleWidth, cornerHeight)
  addStretchedTexture(layer, horizontalEdge, x + cornerWidth, y + height - cornerHeight, middleWidth, cornerHeight, false, true)
  addStretchedTexture(layer, verticalEdge, x, y + cornerHeight, cornerWidth, middleHeight)
  addStretchedTexture(layer, verticalEdge, x + width - cornerWidth, y + cornerHeight, cornerWidth, middleHeight, true)
  addStretchedTexture(layer, center, x + cornerWidth, y + cornerHeight, middleWidth, middleHeight)
}

function addStretchedTexture(
  layer: Container,
  texture: Texture,
  x: number,
  y: number,
  width: number,
  height: number,
  flipX = false,
  flipY = false,
): Sprite {
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  sprite.width = width
  sprite.height = height
  if (flipX) {
    sprite.x += width
    sprite.scale.x *= -1
  }
  if (flipY) {
    sprite.y += height
    sprite.scale.y *= -1
  }
  layer.addChild(sprite)
  return sprite
}

function addTiledAtlas(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  x: number,
  y: number,
  width: number,
  height: number,
  scale = 1,
): void {
  const definition = nativeUiRecord(atlas, record)
  const tileWidth = definition.logicalSize[0] * scale
  const tileHeight = definition.logicalSize[1] * scale
  for (let tileY = 0; tileY < height; tileY += tileHeight) {
    for (let tileX = 0; tileX < width; tileX += tileWidth) {
      const visibleWidth = Math.min(tileWidth, width - tileX)
      const visibleHeight = Math.min(tileHeight, height - tileY)
      if (visibleWidth === tileWidth && visibleHeight === tileHeight) {
        addAtlasSprite(context, layer, atlas, record, x + tileX, y + tileY, { scale })
        continue
      }
      const texture = atlasSliceTexture(
        context,
        atlas,
        record,
        0,
        0,
        visibleWidth / tileWidth,
        visibleHeight / tileHeight,
      )
      addStretchedTexture(layer, texture, x + tileX, y + tileY, visibleWidth, visibleHeight)
    }
  }
}

function addRepeatedAtlas(
  context: RenderContext,
  layer: Container,
  atlas: AtlasName,
  record: number,
  x: number,
  y: number,
  width: number,
  height: number,
  columns: number,
  rows: number,
): Sprite[] {
  const sprites: Sprite[] = []
  const definition = nativeUiRecord(atlas, record)
  const [tileWidth, tileHeight] = definition.logicalSize
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const offsetX = column * tileWidth
      const offsetY = row * tileHeight
      const visibleWidth = Math.min(tileWidth, width - offsetX)
      const visibleHeight = Math.min(tileHeight, height - offsetY)
      if (visibleWidth <= 0 || visibleHeight <= 0) continue
      const texture = visibleWidth === tileWidth && visibleHeight === tileHeight
        ? atlasTexture(context, atlas, record)
        : atlasSliceTexture(
            context,
            atlas,
            record,
            0,
            0,
            visibleWidth / tileWidth,
            visibleHeight / tileHeight,
          )
      const sprite = addStretchedTexture(
        layer,
        texture,
        x + offsetX,
        y + offsetY,
        visibleWidth,
        visibleHeight,
      )
      sprites.push(sprite)
    }
  }
  return sprites
}

function atlasTexture(context: RenderContext, atlas: AtlasName, record: number): Texture {
  return nativeUiPixiFor(context.textures).texture(atlas, record)
}

function atlasSliceTexture(
  context: RenderContext,
  atlas: AtlasName,
  record: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): Texture {
  return nativeUiPixiFor(context.textures).slice(atlas, record, [left, top, right, bottom])
}

function addBitmapText(
  context: RenderContext,
  layer: Container,
  text: string,
  fontName: FontName,
  x: number,
  y: number,
  options: {
    readonly align?: 'center' | 'left' | 'right'
    readonly lineHeight?: number
    readonly maxWidth?: number
    readonly scale?: number
    readonly tint?: number
  } = {},
): void {
  layer.addChild(nativeUiPixiFor(context.textures).text({
    align: options.align,
    font: nativeUiFontName(fontName),
    lineHeight: options.lineHeight,
    maxWidth: options.maxWidth,
    scale: options.scale,
    text,
    tint: options.tint,
    x,
    y,
  }))
}

interface BitmapTextRun {
  readonly advanceScale?: number
  readonly italic?: boolean
  readonly offsetX?: number
  readonly offsetY?: number
  readonly scale?: number
  readonly text: string
}

function addBitmapTextRuns(
  context: RenderContext,
  layer: Container,
  runs: readonly BitmapTextRun[],
  fontName: FontName,
  x: number,
  y: number,
  tint: number,
): void {
  const nativeFontName = nativeUiFontName(fontName)
  const font = nativeUiFont(nativeFontName)
  let cursor = x
  let previous = -1
  for (const run of runs) {
    const scale = run.scale ?? 1
    const advanceScale = run.advanceScale ?? scale
    for (const character of run.text) {
      const code = character.codePointAt(0)!
      if (character === ' ') {
        cursor += font.spaceAdvance * advanceScale
        previous = code
        continue
      }
      const glyph = font.glyphs[`${code}`]
      if (!glyph?.metrics) continue
      cursor += nativeUiKerning(nativeFontName, previous, code) * advanceScale
      const sprite = nativeUiPixiFor(context.textures).glyph(nativeFontName, code)
      sprite.anchor.set(0.5)
      sprite.scale.set(scale)
      if (run.italic) applyExactTextItalic(sprite, glyph)
      sprite.tint = tint
      sprite.position.set(
        cursor + glyph.metrics[1] * scale + (run.offsetX ?? 0),
        y + glyph.metrics[2] * scale + (run.offsetY ?? 0),
      )
      layer.addChild(sprite)
      cursor += glyph.metrics[0] * advanceScale
      previous = code
    }
  }
}

interface StyledGlyphCharacter {
  readonly character: string
  readonly italic: boolean
}

function addChatBitmapText(
  context: RenderContext,
  layer: Container,
  source: string,
  x: number,
  y: number,
  options: {
    readonly lineHeight: number
    readonly maxWidth: number
    readonly tint: number
  },
): number {
  const font = nativeUiFont('menu')
  const lines = wrapChatBitmapText(source, options.maxWidth)
  lines.forEach((line, lineIndex) => {
    let cursor = x
    let previous = -1
    for (const { character, italic } of line) {
      const code = character.codePointAt(0)!
      if (character === ' ') {
        cursor += font.spaceAdvance
        previous = code
        continue
      }
      const glyph = font.glyphs[`${code}`]
      if (!glyph?.metrics) continue
      cursor += nativeUiKerning('menu', previous, code)
      const sprite = nativeUiPixiFor(context.textures).glyph('menu', code)
      sprite.anchor.set(0.5)
      if (italic) applyExactTextItalic(sprite, glyph)
      sprite.tint = options.tint
      sprite.position.set(
        cursor + glyph.metrics[1],
        y + lineIndex * options.lineHeight + glyph.metrics[2],
      )
      layer.addChild(sprite)
      cursor += glyph.metrics[0]
      previous = code
    }
  })
  return lines.length
}

function applyExactTextItalic(sprite: Sprite, glyph: NativeUiAtlasRecord): void {
  const glyphHeight = glyph.frame[3]
  if (glyphHeight <= 0) return
  const totalDelta = HUB_CHAT_INLINE_EMPHASIS.glyphTopDelta
    - HUB_CHAT_INLINE_EMPHASIS.glyphBottomDelta
  const italicAngle = Math.atan(totalDelta / glyphHeight)
  sprite.skew.x = -italicAngle
  sprite.scale.y /= Math.cos(italicAngle)
}

function wrapChatBitmapText(source: string, maxWidth: number): StyledGlyphCharacter[][] {
  const characters = hubChatTextRuns(source).flatMap(({ italic, text }) => (
    [...text].map((character) => ({ character, italic }))
  ))
  const lines: StyledGlyphCharacter[][] = []
  let paragraph: StyledGlyphCharacter[] = []
  const flushParagraph = (): void => {
    lines.push(...wrapChatParagraph(paragraph, maxWidth))
    paragraph = []
  }
  for (const character of characters) {
    if (character.character === '\n') flushParagraph()
    else paragraph.push(character)
  }
  flushParagraph()
  return lines
}

function wrapChatParagraph(
  paragraph: readonly StyledGlyphCharacter[],
  maxWidth: number,
): StyledGlyphCharacter[][] {
  if (paragraph.length === 0) return [[]]
  const lines: StyledGlyphCharacter[][] = []
  let line: StyledGlyphCharacter[] = []
  let index = 0
  while (index < paragraph.length) {
    const spaces: StyledGlyphCharacter[] = []
    while (paragraph[index]?.character === ' ') spaces.push(paragraph[index++]!)
    const word: StyledGlyphCharacter[] = []
    while (index < paragraph.length && paragraph[index]!.character !== ' ') word.push(paragraph[index++]!)
    const candidate = [...line, ...spaces, ...word]
    if (line.length > 0 && word.length > 0 && measureStyledBitmapText(candidate) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  lines.push(line)
  return lines
}

function measureStyledBitmapText(text: readonly StyledGlyphCharacter[]): number {
  return measureNativeUiText(text.map(({ character }) => character).join(''), 'menu')
}

function nativeUiFontName(fontName: FontName): NativeUiFontName {
  return fontName === 'skill' ? 'skill-uppercase' : fontName
}
