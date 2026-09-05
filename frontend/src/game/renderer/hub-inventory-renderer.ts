import { Container, Graphics, Sprite } from 'pixi.js'
import { hub, skillPicker } from '../../lib/assets.ts'
import type {
  EquipmentSlot,
  HubInventoryItem,
  HubTraderId,
} from '../core-kernels/hub-economy.ts'
import type { PlayerCharacterConfig } from '../core-kernels/player-character.ts'
import type { PlayerBeltComponent } from '../core-kernels/native-belt.ts'
import { boastSelectionKey, type ModBoastSelection } from '../core-kernels/boast.ts'
import { NATIVE_BOAST_PRESENTATION } from '../core-kernels/native-hub-npc.ts'
import type { HubInteractionId } from '../hub-inventory-presentation.ts'
import type { HubNpcChatContent, HubNpcSelectorRow } from '../hub-npc-dialogue.ts'
import { nativeHudModalSlideOffset } from '../native-hud-layout.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from '../protocol/game-state.ts'
import type { GameModAsset } from '../protocol/game-protocol.ts'
import { nativeUiAtlasSource } from '../native-ui/native-ui-assets.ts'
import { destroyNativeUiPixiFor } from '../native-ui/pixi.ts'
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
  HUB_CHAT_PANEL,
  HUB_INVENTORY_PARENT_HOLDER,
  HUB_INVENTORY_INTERACTION,
  HUB_NATIVE_UI_TIMING,
  HUB_NATIVE_UI_SIZE,
  hubNpcSelectorClampScroll,
  hubDowsingFieldTint,
  hubDowsingFlashAlpha,
  hubDowsingFlashFeedbackSequence,
  hubDyeModalOpacity,
  hubDyeSelectedPulse,
  hubInventoryFlybyFrame,
  hubInventoryPrimarySpellLines,
  hubNativeUiElapsedTicks,
  hubNativeUiReveal,
  hubShopSlideOffset,
  hubSackPageOffsets,
  hubUnforgeTargetTint,
  type HubStandardNotice,
  type HubSackPageDirection,
} from './hub-inventory-render-contract.ts'
import type { NativeElementVfxView } from './native-element-vfx-view.ts'
import {
  PLAYER_CHARACTER_ATLAS_SOURCES,
  PLAYER_CHARACTER_SHEETS,
  createPlayerCharacterAtlas,
} from './player-character-atlas.ts'
import { createNativeElementVfxTextures } from './world-player-textures.ts'
import type {
  RenderContext,
  InventorySackPages,
  ChatRenderState,
  InventoryFlybyView,
} from './hub-inventory-render-model.ts'
import { buildInventory } from './hub-inventory-page.ts'
import { buildDialogue, planBoastDialogue } from './hub-inventory-dialogue.ts'
import { buildService } from './hub-inventory-service.ts'
import { buildDyeClothing, buildNotice } from './hub-inventory-notices.ts'
import { updateInventoryFlybyView } from './hub-inventory-items.ts'

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
      if (model.kind === 'dialogue') {
        delete gpu.canvas.dataset.nativePrimarySpellBuild
        delete gpu.canvas.dataset.nativePrimarySpellId
        delete gpu.canvas.dataset.nativePrimarySpellLines
      } else {
        gpu.canvas.dataset.nativePrimarySpellBuild = model.progression.weldBuildId === null
          ? ''
          : `${model.progression.weldBuildId}`
        gpu.canvas.dataset.nativePrimarySpellId = `${model.progression.selectedPrimarySkillId}`
        gpu.canvas.dataset.nativePrimarySpellLines = JSON.stringify(
          hubInventoryPrimarySpellLines(model.progression),
        )
      }
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
