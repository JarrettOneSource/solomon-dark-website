import {
  hub,
  skillPicker,
} from '../../lib/assets.ts'
import { boastSelectionKey } from '../core-kernels/boast.ts'
import { NATIVE_BOAST_PRESENTATION } from '../core-kernels/native-hub-npc.ts'
import { nativeHudModalSlideOffset } from '../native-hud-layout.ts'
import {
  createNativeInventoryStatsScroll,
  nativeInventoryStatsScrollOffset,
  retargetNativeInventoryStatsScroll,
} from '../native-inventory-stats-scroll.ts'
import { nativeUiAtlasSource } from '../native-ui/assets.ts'
import { destroyNativeUiPixiFor, nativeUiPixiFor } from '../native-ui/pixi.ts'
import { nativeApplicationTick } from '../native-application-tick.ts'
import type {
  GameModAsset,
} from '../protocol/game-mod-contract.ts'
import {
  BONEYARD_COMBAT_ATLAS_SOURCES,
  boneyardCombatAtlasSourceIsPacked,
  createBoneyardCombatAtlas,
} from './boneyard-combat-atlas.ts'
import {
  type GameTextureMap,
  type GameWebGlApplication,
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
} from './game-webgl.ts'
import {
  HUB_CHAT_PANEL,
  hubNpcSelectorClampScroll,
  intersectNativeUiRects,
} from '../native-ui/core.ts'
import {
  HUB_INVENTORY_INTERACTION,
  HUB_INVENTORY_PARENT_HOLDER,
  HUB_INVENTORY_STATS_PAGES,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_TIMING,
  hubDowsingFieldTint,
  hubDowsingFlashAlpha,
  hubDowsingFlashFeedbackSequence,
  hubDyeModalOpacity,
  hubDyeSelectedPulse,
  hubInventoryFlybyFrame,
  hubInventoryMeleeDamageLine,
  hubInventoryPrimarySpellLines,
  hubInventoryRunSummaryLines,
  hubNativeUiElapsedTicks,
  hubNativeUiReveal,
  hubOwnedPerkSlotRect,
  hubSackPageOffsets,
  hubShopSlideOffset,
} from './hub-inventory-render-contract.ts'
import {
  buildDialogue,
  planBoastDialogue,
} from './hub-inventory/dialogue.ts'
import type {
  ChatRenderState,
  HubInventoryRendererModel,
  InventoryFlybyView,
  InventorySackPages,
  NativeModalBeltAvailability,
  NativeModalHudView,
  RenderContext,
} from './hub-inventory/model.ts'
import { buildNotice } from './hub-inventory/notices.ts'
import type { NativeContextualHoverBox } from './hub-inventory/items.ts'
import {
  buildInventory,
  updateInventoryFlybyView,
} from './hub-inventory/pages.ts'
import {
  buildDyeClothing,
  buildService,
} from './hub-inventory/services.ts'
import {
  type ModPresentationTextures,
  loadModPresentationTextures,
} from './mod-presentation-assets.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import { NativeUnforgeTargetView } from './native-unforge-target-view.ts'
import type { NativeUiCanvas } from './native-ui-canvas.ts'
import {
  PLAYER_CHARACTER_ATLAS_SOURCES,
  PLAYER_CHARACTER_SHEETS,
  createPlayerCharacterAtlas,
} from './player-character-atlas.ts'
import { createNativeElementVfxTextures } from './world-player-textures.ts'
import {
  Container,
  Graphics,
  Sprite,
} from 'pixi.js'

export interface HubInventoryRenderer extends NativeUiCanvas {
  moveDrag(pointer: { readonly x: number; readonly y: number }): void
  render(nowMs: number, reveal: number, hudProgress?: number): {
    readonly chatComplete: boolean
    readonly statsOffset: number | null
  }
  setBeltAvailability(value: NativeModalBeltAvailability): void
  setModel(model: HubInventoryRendererModel): number | null
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
    gpu?.destroy()
    resources?.destroy()
    modTextures?.destroy()
    throw error
  }

  const application = gpu.application
  const canvas = gpu.canvas
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
  let inventoryCaption: Container | null = null
  let modalHud: NativeModalHudView | null = null
  let beltAvailability: NativeModalBeltAvailability | null = null
  let previousNoticeTitle: string | null = null
  let currentModel: HubInventoryRendererModel | null = null
  let statsContent: Container | null = null
  let statsInspection: NativeContextualHoverBox | null = null
  let statsOffset: number | null = null
  let statsScroll = createNativeInventoryStatsScroll(0, 0)

  function renderStats(nowMs: number): number | null {
    if (!statsContent) {
      statsOffset = null
      delete canvas.dataset.nativeStatsOffsetY
      return null
    }
    const offset = nativeInventoryStatsScrollOffset(statsScroll, nowMs)
    statsOffset = offset
    statsContent.y = -offset
    canvas.dataset.nativeStatsOffsetY = `${offset}`
    if (statsInspection && currentModel && currentModel.kind !== 'dialogue'
        && currentModel.inspection?.kind === 'owned-perk') {
      const companion = currentModel.kind === 'service'
      const [left, top, width, height] = hubOwnedPerkSlotRect(currentModel.inspection.index)
      const source = { left: left - (companion ? 0 : 53), top: top + 640 - offset, width, height }
      const clip = companion ? HUB_INVENTORY_STATS_PAGES.companionClipRect
        : HUB_INVENTORY_STATS_PAGES.standaloneClipRect
      statsInspection.visible = intersectNativeUiRects(source, {
        left: clip[0], top: clip[1], width: clip[2], height: clip[3],
      }) !== null
      statsInspection.setSourceCenter(source.left + width / 2, source.top + height / 2)
    }
    return offset
  }

  const texture = (source: string) => textureFrom(textures.textures, source)
  const combatAtlas = createBoneyardCombatAtlas(texture)
  const elementVfxTextures = createNativeElementVfxTextures((source) => (
    boneyardCombatAtlasSourceIsPacked(source) ? combatAtlas.single(source) : texture(source)
  ))
  const playerCharacterAtlas = createPlayerCharacterAtlas((source) => (
    texture(source)
  ))
  canvas.dataset.playerTextureAlpha = playerCharacterAtlas
    .frame(PLAYER_CHARACTER_SHEETS.robeDynamic.air, 0, 0).source.alphaMode
  canvas.dataset.playerTextureAddress = playerCharacterAtlas
    .frame(PLAYER_CHARACTER_SHEETS.robeDynamic.air, 0, 0).source.addressMode
  canvas.dataset.nativeTextureAddress = elementVfxTextures.fire[0]!.source.addressMode
  canvas.dataset.nativeTextureAlpha = elementVfxTextures.fire[0]!.source.alphaMode

  const unforgeTarget = new NativeUnforgeTargetView((record) => nativeUiPixiFor(textures).texture('UI', record))
  const context: RenderContext = {
    elementVfxTextures,
    modTextures,
    playerCharacterAtlas,
    textures,
    unforgeTarget: unforgeTarget.container,
  }

  function renderDowsing(nowMs: number): void {
    const flashAlpha = dowsingFlashStartedAt === null
      ? 0
      : hubDowsingFlashAlpha(nowMs - dowsingFlashStartedAt)
    dowsingFlash.alpha = flashAlpha
    if (dowsingFieldTiles.length > 0) {
      const tint = hubDowsingFieldTint(hubNativeUiElapsedTicks(nowMs))
      for (const tile of dowsingFieldTiles) tile.tint = tint
    }
    canvas.dataset.dowsingFlash = flashAlpha > 0 ? 'active' : 'idle'
    canvas.dataset.dowsingFlashTrigger = flashAlpha > 0 ? dowsingFlashTrigger ?? '' : ''
  }

  function renderItemSelection(nowMs: number): void {
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
    canvas.dataset.nativeItemInfo = inventoryItemInfo?.visible ? 'visible' : 'hidden'
    if (inventoryDragger) {
      for (const child of inventoryDragger.children) {
        if (child.label === 'native-inventory-drag-pulse') {
          child.alpha = 0.15 + (Math.sin(nowMs / 90) + 1) * 0.15
        }
      }
    }
  }

  function renderFlybys(nowMs: number): void {
    if (inventoryFlybys.length > 0) {
      const frames = inventoryFlybys.map((flyby) => {
        updateInventoryFlybyView(flyby, nowMs)
        return hubInventoryFlybyFrame(flyby.model.startedAtMs, nowMs)
      })
      const activeIndex = inventoryFlybys.findIndex(({ model }) => model.phase === 'flying')
      const representativeIndex = activeIndex >= 0 ? activeIndex : inventoryFlybys.length - 1
      canvas.dataset.nativeInventoryFlybyAfterimages = `${inventoryFlybys.reduce(
        (total, flyby, index) => total + frames[index]!.afterimages.length * flyby.model.lanes.length,
        0,
      )}`
      canvas.dataset.nativeInventoryFlybyMainItems = `${inventoryFlybys.reduce(
        (total, flyby, index) => total + (
          frames[index]!.mainVisible && flyby.model.phase === 'flying'
            ? flyby.model.lanes.length
            : 0
        ),
        0,
      )}`
      canvas.dataset.nativeInventoryFlybyPhase = activeIndex >= 0 ? 'flying' : 'trailing'
      canvas.dataset.nativeInventoryFlybyTicks = `${frames[representativeIndex]!.tick}`
    } else {
      delete canvas.dataset.nativeInventoryFlybyPhase
      delete canvas.dataset.nativeInventoryFlybyAfterimages
      delete canvas.dataset.nativeInventoryFlybyMainItems
      delete canvas.dataset.nativeInventoryFlybyTicks
    }
  }

  function renderSackPages(nowMs: number): void {
    if (inventorySackPages) {
      const offsets = hubSackPageOffsets(
        inventorySackPages.transition.direction,
        inventorySackPages.transition.startedAtMs,
        nowMs,
      )
      inventorySackPages.incoming.position.set(0, offsets.incomingY)
      inventorySackPages.outgoing.position.set(0, offsets.outgoingY)
      inventorySackPages.caption.visible = offsets.settled
      canvas.dataset.nativeSackPageState = offsets.settled ? 'settled' : 'moving'
      canvas.dataset.nativeSackPageTicks = `${offsets.ticks}`
      canvas.dataset.nativeSackIncomingX = `${inventorySackPages.incoming.x}`
      canvas.dataset.nativeSackOutgoingX = `${inventorySackPages.outgoing.x}`
      canvas.dataset.nativeSackIncomingY = `${inventorySackPages.incoming.y}`
      canvas.dataset.nativeSackOutgoingY = `${inventorySackPages.outgoing.y}`
      const clip = inventorySackPages.clip.getLocalBounds()
      canvas.dataset.nativeSackClip = `${clip.x},${clip.y},${clip.width},${clip.height}`
    } else {
      delete canvas.dataset.nativeSackPageState
      delete canvas.dataset.nativeSackPageTicks
      delete canvas.dataset.nativeSackIncomingX
      delete canvas.dataset.nativeSackOutgoingX
      delete canvas.dataset.nativeSackIncomingY
      delete canvas.dataset.nativeSackOutgoingY
      delete canvas.dataset.nativeSackClip
    }
    if (inventoryCaption) canvas.dataset.nativeSackCaptionVisible = `${inventoryCaption.visible}`
    else delete canvas.dataset.nativeSackCaptionVisible
  }

  function renderItemEffects(nowMs: number, reveal: number): void {
    if (unforgeTarget.container.parent) {
      const tick = nativeApplicationTick(nowMs)
      const frame = unforgeTarget.update(application.renderer, tick, reveal, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height)
      const tint = frame.markerTint
      canvas.dataset.nativeUnforgeTint = tint.toString(16).padStart(6, '0')
    } else delete canvas.dataset.nativeUnforgeTint
    const dyeModal = currentModel?.kind === 'dialogue' ? null : currentModel?.dyeModal ?? null
    if (dyeLayer && dyeModal) {
      const opacity = hubDyeModalOpacity(dyeModal.openedAtMs, dyeModal.closingAtMs, nowMs)
      dyeLayer.alpha = opacity
      const selectedPulse = hubDyeSelectedPulse(dyeModal.selectedAtMs, nowMs)
      if (dyeSelectedPulse) {
        dyeSelectedPulse.alpha = selectedPulse
        dyeSelectedPulse.visible = selectedPulse > 0
      }
      canvas.dataset.nativeDyeOpacity = opacity.toFixed(2)
      canvas.dataset.nativeDyePulse = selectedPulse.toFixed(2)
    } else {
      delete canvas.dataset.nativeDyeOpacity
      delete canvas.dataset.nativeDyePulse
    }
  }

  function renderNotices(nowMs: number): void {
    canvas.dataset.nativePressedBodyRecord = currentModel !== null
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
    canvas.dataset.nativeNoticeReveal = noticeRevealStartedAt === null
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
  }

  function renderChat(nowMs: number): boolean {
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
      canvas.dataset.nativeChatState = chatComplete ? 'complete' : 'scrolling'
    } else if (currentModel?.kind === 'dialogue') {
      canvas.dataset.nativeChatState = 'choices'
    } else delete canvas.dataset.nativeChatState
    return chatComplete
  }

  function scrollExistingSelector(model: HubInventoryRendererModel): boolean {
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
      return true
    }
    return false
  }

  function beginModelTransition(model: HubInventoryRendererModel): Exclude<HubInventoryRendererModel, { kind: 'dialogue' }>['notice'] {
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
      canvas.dataset.dowsingFlash = 'active'
    }
    previousActionFeedbackSequence = nextActionFeedbackSequence
    const nextNotice = model.kind === 'dialogue' ? null : model.notice
    if (nextNotice && nextNotice.title !== previousNoticeTitle) {
      noticeRevealStartedAt = performance.now()
    } else if (!nextNotice) noticeRevealStartedAt = null
    previousNoticeTitle = nextNotice?.title ?? null
    return nextNotice
  }

  function writeModelDiagnostics(model: HubInventoryRendererModel): void {
    canvas.dataset.nativeInventoryRunSummary = JSON.stringify(
      model.kind === 'inventory' ? hubInventoryRunSummaryLines(model.runSummary) : [],
    )
    if (model.kind === 'dialogue') {
      delete canvas.dataset.nativePrimarySpellBuild
      delete canvas.dataset.nativePrimarySpellId
      delete canvas.dataset.nativePrimarySpellLines
      delete canvas.dataset.nativeMeleeDamageLine
    } else {
      canvas.dataset.nativePrimarySpellBuild = model.progression.weldBuildId === null
        ? ''
        : `${model.progression.weldBuildId}`
      canvas.dataset.nativePrimarySpellId = `${model.progression.selectedPrimarySkillId}`
      canvas.dataset.nativePrimarySpellLines = JSON.stringify(
        hubInventoryPrimarySpellLines(model.progression),
      )
      canvas.dataset.nativeMeleeDamageLine = JSON.stringify(hubInventoryMeleeDamageLine(model.progression))
    }
    if (model.kind === 'dialogue'
        && model.content.kind === 'selector'
        && model.content.selector === 'boast') {
      const plan = planBoastDialogue(model)
      const rows = model.selectorRows.filter((_, index) => (
        plan.rowBounds[index]?.visibleBounds != null
      ))
      canvas.dataset.nativeBoastMenu = (
        model.selectorRows.length > NATIVE_BOAST_PRESENTATION.stockRowCount
      )
        ? 'mod-expanded'
        : 'stock'
      canvas.dataset.nativeBoastContentHeight = `${plan.contentHeight}`
      canvas.dataset.nativeBoastScrollMax = `${plan.maximumScrollY}`
      canvas.dataset.nativeBoastScrollY = `${plan.scrollY}`
      canvas.dataset.nativeBoastRows = `${rows.length}`
      canvas.dataset.nativeBoastIconRecords = rows.map(row => (
        row.boastIcon?.kind === 'stock' ? row.boastIcon.record : 'mod'
      )).join(',')
      canvas.dataset.nativeBoastHighlighted = model.highlightedSelectorId === null
        ? ''
        : typeof model.highlightedSelectorId === 'number'
          ? `native:${model.highlightedSelectorId}`
          : boastSelectionKey(model.highlightedSelectorId)
    } else {
      delete canvas.dataset.nativeBoastContentHeight
      delete canvas.dataset.nativeBoastMenu
      delete canvas.dataset.nativeBoastScrollMax
      delete canvas.dataset.nativeBoastScrollY
      delete canvas.dataset.nativeBoastRows
      delete canvas.dataset.nativeBoastIconRecords
      delete canvas.dataset.nativeBoastHighlighted
    }
    if (model.kind !== 'dialogue' && model.sackPath.length > 0) {
      canvas.dataset.nativeInventoryParentHolder = 'visible'
      canvas.dataset.nativeInventoryParentHolderAlpha = '1'
      canvas.dataset.nativeInventoryParentPadAlpha = `${HUB_INVENTORY_PARENT_HOLDER.pad.alpha}`
    } else {
      delete canvas.dataset.nativeInventoryParentHolder
      delete canvas.dataset.nativeInventoryParentHolderAlpha
      delete canvas.dataset.nativeInventoryParentPadAlpha
    }
  }

  function rebuildSurface(model: HubInventoryRendererModel, nextNotice: Exclude<HubInventoryRendererModel, { kind: 'dialogue' }>['notice']): void {
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
    statsContent = null
    statsInspection = null
    inventoryCaption = null
    delete canvas.dataset.nativeSackCaption
    modalHud = null
    unforgeTarget.container.removeFromParent()
    surface.removeChildren().forEach((child) => child.destroy({ children: true }))
    if (model.kind === 'inventory') {
      const inventory = buildInventory(context, surface, model)
      playerPreviewVfx = inventory.playerPreview
      inventoryDragger = inventory.dragger
      inventoryFlybys = inventory.flybys
      inventoryItemInfo = inventory.itemInfo
      inventorySackPages = inventory.sackPages
      statsContent = inventory.statsContent
      statsInspection = inventory.statsInspection
      inventoryCaption = inventory.caption
      canvas.dataset.nativeSackCaption = inventory.captionText
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
      statsContent = service.statsContent
      statsInspection = service.statsInspection
      inventoryCaption = service.caption
      canvas.dataset.nativeSackCaption = service.captionText
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
    if (nextNotice) {
      buildNotice(
        context,
        surface,
        nextNotice,
        model.kind === 'dialogue' ? null : model.pressedControl,
      )
    }
    if (modalHud && beltAvailability) modalHud.updateAvailability(beltAvailability)
    renderSackPages(performance.now())
    renderStats(performance.now())
  }

  return {
    canvas,
    mount(host) {
      const page = currentModel?.kind === 'inventory' || currentModel?.kind === 'service'
        ? currentModel.statsPage : 0
      statsScroll = createNativeInventoryStatsScroll(page, performance.now())
      renderStats(performance.now())
      application.renderer.render(application.stage)
      return gpu.mount(host)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      unforgeTarget.destroy()
      gpu.destroy()
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
      if (destroyed) return { chatComplete: false, statsOffset: null }
      const clampedReveal = Math.max(0, Math.min(1, reveal))
      const clampedHudProgress = Math.max(0, Math.min(1, hudProgress))
      canvas.dataset.nativeReveal = clampedReveal >= 1 ? 'settled' : 'revealing'
      canvas.dataset.nativeRevealProgress = `${clampedReveal}`
      dimmer.alpha = curtainAlpha * clampedReveal
      surface.alpha = clampedReveal
      surface.y = 0
      if (modalHud) modalHud.layer.position.y = nativeHudModalSlideOffset(clampedHudProgress)
      if (serviceOverlay) serviceOverlay.y = currentKind === 'service'
        ? hubShopSlideOffset(clampedReveal)
        : 0
      renderDowsing(nowMs)
      playerPreviewVfx?.update(nowMs / 10, 1.25)
      renderItemSelection(nowMs)
      renderFlybys(nowMs)
      renderSackPages(nowMs)
      const statsOffset = renderStats(nowMs)
      renderItemEffects(nowMs, clampedReveal)
      renderNotices(nowMs)
      const chatComplete = renderChat(nowMs)
      application.renderer.render(application.stage)
      return { chatComplete, statsOffset }
    },
    setModel(model) {
      if (scrollExistingSelector(model)) return null
      if (model.kind !== 'dialogue') {
        statsScroll = retargetNativeInventoryStatsScroll(statsScroll, model.statsPage, performance.now())
      }
      const nextNotice = beginModelTransition(model)
      currentKind = model.kind
      currentModel = model
      writeModelDiagnostics(model)
      rebuildSurface(model, nextNotice)
      renderItemEffects(performance.now(), surface.alpha)
      application.renderer.render(application.stage)
      return statsOffset
    },
    setBeltAvailability(value) {
      beltAvailability = value
      if (!modalHud) return
      modalHud.updateAvailability(value)
    },
  }
}
