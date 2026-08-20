import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
} from 'pixi.js'

import traderAssetsJson from '../../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import fontAssetsJson from '../../assets/game/skill-picker-native-assets.json' with { type: 'json' }
import { elementVfx, hub, playerCharacter, skillPicker } from '../../lib/assets.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  type EquipmentSlot,
  type HubInventoryItem,
  type HubShopItem,
  type HubTraderId,
} from '../core-kernels/hub-economy.ts'
import type { PlayerCharacterConfig, WizardElement } from '../core-kernels/player-character.ts'
import { HUB_TRADER_DIALOGUES, equipmentSlotsForItem } from '../hub-inventory-presentation.ts'
import { playerCharacterStaffIsFront, playerCharacterStaffOrbOffset } from '../player-character-presentation.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from '../protocol/game-state.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
  type GameTextureMap,
  type GameWebGlApplication,
} from './game-webgl.ts'
import {
  HUB_DOWSING_FLASH,
  HUB_DOWSING_GRID,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_CHAT_INLINE_EMPHASIS,
  HUB_CHAT_PANEL,
  HUB_EQUIPMENT_SINK_RENDER,
  HUB_HAGATHA_PERK_PANE,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_INTERACTION,
  HUB_ITEM_ICON_TRANSFORMS,
  HUB_NATIVE_UI_TIMING,
  HUB_NATIVE_UI_SIZE,
  HUB_PRIMARY_SPELL_PANE,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  HUB_SHOP_TEXT,
  HUB_STARTER_EQUIPMENT_PRIMARY_TINT,
  hubChatTextRuns,
  hubDowsingFieldTint,
  hubDowsingSlotPosition,
  hubInventoryEquipmentSlotRects,
  hubInventoryItemInfoText,
  hubInventoryPrimarySpellLines,
  hubInventorySlotPosition,
  hubShopSlotPosition,
} from './hub-inventory-render-contract.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import { createNativeElementVfxTextures, type PlayerWorldTextures } from './world-player-textures.ts'

type AtlasName = 'Inventory' | 'Skills' | 'UI'
type FontName = 'body' | 'medium' | 'menu' | 'skill'

interface AtlasRecord {
  readonly frame: readonly [number, number, number, number]
  readonly logicalSize: readonly [number, number]
  readonly metrics?: readonly [number, number, number]
  readonly trimOrigin: readonly [number, number]
}

interface BitmapFont {
  readonly glyphs: Readonly<Record<string, AtlasRecord>>
  readonly kerning: readonly (readonly [number, number, number])[]
  readonly metrics: readonly [number, number, number]
  readonly spaceAdvance: number
}

interface TraderAssets {
  readonly atlases: Readonly<Record<AtlasName, {
    readonly records: Readonly<Record<string, AtlasRecord>>
  }>>
}

interface FontAssets {
  readonly fonts: Readonly<Record<FontName, BitmapFont>>
}

export interface HubInventoryRendererNotice {
  readonly actionLabel: string
  readonly body: string
  readonly title: string
}

export type HubTraderChatPhase = 'choices' | 'intro' | 'prices'

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

export type HubInventoryRendererModel =
  | {
      readonly config: PlayerCharacterConfig
      readonly dragging: HubInventoryDragModel | null
      readonly economy: ProtocolPlayerEconomy
      readonly kind: 'inventory'
      readonly notice: HubInventoryRendererNotice | null
      readonly progression: ProtocolPlayerProgression
      readonly selection: HubInventorySelectionModel | null
    }
  | {
      readonly acceleratedAtMs: number | null
      readonly kind: 'dialogue'
      readonly phase: HubTraderChatPhase
      readonly phaseStartedAtMs: number
      readonly trader: HubTraderId
    }
  | {
      readonly config: PlayerCharacterConfig
      readonly dragging: HubInventoryDragModel | null
      readonly economy: ProtocolPlayerEconomy
      readonly kind: 'service'
      readonly notice: HubInventoryRendererNotice | null
      readonly progression: ProtocolPlayerProgression
      readonly inventorySelection: HubInventorySelectionModel | null
      readonly selectedItemId: number | null
      readonly selectedOwner: 'storage' | null
      readonly trader: HubTraderId
    }

export interface HubInventoryRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  moveDrag(pointer: { readonly x: number; readonly y: number }): void
  render(nowMs: number, reveal: number): { readonly chatComplete: boolean }
  setModel(model: HubInventoryRendererModel): void
}

const TRADER_ASSETS = traderAssetsJson as unknown as TraderAssets
const FONT_ASSETS = fontAssetsJson as unknown as FontAssets
const ATLAS_SOURCE: Readonly<Record<AtlasName, string>> = {
  Inventory: hub.trader.inventoryAtlas,
  Skills: hub.trader.skillsAtlas,
  UI: hub.trader.uiAtlas,
}

export async function createHubInventoryRenderer(): Promise<HubInventoryRenderer> {
  let gpu: GameWebGlApplication | undefined
  let resources: GameTextureMap | undefined
  try {
    ;[gpu, resources] = await Promise.all([
      createGameWebGlApplication({
        backgroundAlpha: 0,
        className: 'hub-inventory-native-canvas',
        height: HUB_NATIVE_UI_SIZE.height,
        resolution: 1,
        width: HUB_NATIVE_UI_SIZE.width,
      }),
      loadGameTextureMap([
        hub.trader.inventoryAtlas,
        hub.trader.skillsAtlas,
        hub.trader.uiAtlas,
        skillPicker.fontsAtlas,
        ...Object.values(elementVfx.common),
        ...Object.values(elementVfx.frames),
        playerCharacter.staffBack,
        playerCharacter.staffFront,
        ...Object.values(playerCharacter.robeDynamic),
        ...Object.values(playerCharacter.robeFixed),
        ...Object.values(playerCharacter.head),
      ]),
    ])
  } catch (error) {
    gpu?.application.destroy({ removeView: true })
    resources?.destroy()
    throw error
  }

  const application = gpu.application
  const textures = resources
  const atlasTextureCache = new Map<string, Texture>()
  const glyphTextureCache = new Map<string, Texture>()
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
  let dowsingFieldTiles: Sprite[] = []
  let noticeRevealStartedAt: number | null = null
  let previousDowsingOfferCount: number | null = null
  let serviceOverlay: Container | null = null
  let chatRenderState: ChatRenderState | null = null
  let playerPreviewVfx: NativeElementVfxView | null = null
  let inventoryDragger: Container | null = null
  let inventoryItemInfo: Container | null = null
  let previousNoticeTitle: string | null = null
  let currentModel: HubInventoryRendererModel | null = null

  const elementVfxTextures = createNativeElementVfxTextures((source) => textureFrom(textures.textures, source))

  const context: RenderContext = {
    atlasTextureCache,
    elementVfxTextures,
    glyphTextureCache,
    textures,
  }

  return {
    canvas: gpu.canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.destroy({ removeView: true })
      for (const texture of atlasTextureCache.values()) texture.destroy(false)
      for (const texture of glyphTextureCache.values()) texture.destroy(false)
      for (const frames of Object.values(elementVfxTextures)) {
        for (const texture of frames) texture.destroy(false)
      }
      textures.destroy()
    },
    moveDrag(pointer) {
      if (!inventoryDragger) return
      inventoryDragger.position.set(pointer.x, pointer.y)
    },
    render(nowMs, reveal) {
      if (destroyed) return { chatComplete: false }
      const clampedReveal = Math.max(0, Math.min(1, reveal))
      gpu.canvas.dataset.nativeReveal = clampedReveal >= 1 ? 'settled' : 'revealing'
      dimmer.alpha = curtainAlpha * clampedReveal
      surface.alpha = clampedReveal
      surface.y = 0
      if (serviceOverlay) serviceOverlay.y = currentKind === 'service'
        ? -HUB_SHOP_PANEL.slideDistance * (1 - easeOutCubic(clampedReveal))
        : 0
      const flashAlpha = dowsingFlashStartedAt === null
        ? 0
        : Math.max(0, 1 - (nowMs - dowsingFlashStartedAt) / HUB_DOWSING_FLASH.durationMs)
      dowsingFlash.alpha = flashAlpha
      if (dowsingFieldTiles.length > 0) {
        const tint = hubDowsingFieldTint(nowMs / 10)
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
      if (inventoryDragger) {
        for (const child of inventoryDragger.children) {
          if (child.label === 'native-inventory-drag-pulse') {
            child.alpha = 0.15 + (Math.sin(nowMs / 90) + 1) * 0.15
          }
        }
      }
      gpu.canvas.dataset.dowsingFlash = flashAlpha > 0 ? 'active' : 'idle'
      const noticeReveal = noticeRevealStartedAt === null
        ? 1
        : Math.min(1, ((nowMs - noticeRevealStartedAt) / 10) * HUB_NATIVE_UI_TIMING.messageBoxRevealPerTick)
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
      if (currentModel?.kind === 'dialogue' && chatRenderState && currentModel.phase !== 'choices') {
        const acceleratedAtMs = currentModel.acceleratedAtMs
        const normalElapsedMs = acceleratedAtMs === null
          ? Math.max(0, nowMs - currentModel.phaseStartedAtMs)
          : Math.max(0, acceleratedAtMs - currentModel.phaseStartedAtMs)
        const acceleratedElapsedMs = acceleratedAtMs === null
          ? 0
          : Math.max(0, nowMs - acceleratedAtMs)
        const travel = normalElapsedMs / 10 * HUB_NATIVE_UI_TIMING.chatScrollPerTick
          + acceleratedElapsedMs / 10 * HUB_NATIVE_UI_TIMING.chatAcceleratedScrollPerTick
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
      const nextDowsingOfferCount = model.kind === 'service' && model.trader === 'shlorio'
        ? model.economy.dowsingOffers.length
        : null
      if (previousDowsingOfferCount === 0 && nextDowsingOfferCount !== null && nextDowsingOfferCount > 0) {
        dowsingFlashStartedAt = performance.now()
        dowsingFlash.alpha = 1
        gpu.canvas.dataset.dowsingFlash = 'active'
      }
      previousDowsingOfferCount = nextDowsingOfferCount
      const nextNotice = model.kind === 'dialogue' ? null : model.notice
      if (nextNotice && nextNotice.title !== previousNoticeTitle) {
        noticeRevealStartedAt = performance.now()
      } else if (!nextNotice) noticeRevealStartedAt = null
      previousNoticeTitle = nextNotice?.title ?? null
      currentKind = model.kind
      currentModel = model
      curtainAlpha = model.kind === 'dialogue' ? 0 : 1
      serviceOverlay = null
      dowsingFieldTiles = []
      chatRenderState = null
      playerPreviewVfx = null
      inventoryDragger = null
      inventoryItemInfo = null
      surface.removeChildren().forEach((child) => child.destroy({ children: true }))
      if (model.kind === 'inventory') {
        const inventory = buildInventory(context, surface, model)
        playerPreviewVfx = inventory.playerPreview
        inventoryDragger = inventory.dragger
        inventoryItemInfo = inventory.itemInfo
      }
      else if (model.kind === 'dialogue') chatRenderState = buildDialogue(context, surface, model)
      else {
        const service = buildService(context, surface, model)
        serviceOverlay = service.overlay
        inventoryDragger = service.dragger
        inventoryItemInfo = service.itemInfo
        dowsingFieldTiles = serviceOverlay.children.filter(
          (child): child is Sprite => child instanceof Sprite && child.label === 'native-dowsing-field',
        )
      }
      if (nextNotice) buildNotice(context, surface, nextNotice)
      application.renderer.render(application.stage)
    },
  }
}

interface RenderContext {
  readonly atlasTextureCache: Map<string, Texture>
  readonly elementVfxTextures: PlayerWorldTextures['elementVfx']
  readonly glyphTextureCache: Map<string, Texture>
  readonly textures: GameTextureMap
}

interface ChatRenderState {
  readonly content: Container
  readonly contentHeight: number
}

interface InventoryBuildState {
  readonly dragger: Container | null
  readonly itemInfo: Container | null
  readonly playerPreview: NativeElementVfxView | null
}

function buildInventory(
  context: RenderContext,
  layer: Container,
  model: {
    readonly config: PlayerCharacterConfig
    readonly economy: ProtocolPlayerEconomy
    readonly companion?: boolean
    readonly dragging?: HubInventoryDragModel | null
    readonly leftPane?: 'hagatha' | 'stats'
    readonly progression: ProtocolPlayerProgression
    readonly selection?: HubInventorySelectionModel | null
  },
): InventoryBuildState {
  const { economy, progression } = model
  const companion = model.companion ?? false
  const dragging = model.dragging ?? null
  const selection = model.selection ?? null
  const leftShift = companion ? 53 : 0
  const background = new Graphics().rect(0, 0, 1600, 900).fill({ color: 0x000000 })
  layer.addChild(background)

  addInventorySidePanel(context, layer, 'left', companion)
  addInventorySidePanel(context, layer, 'right', companion)
  if (model.leftPane === 'hagatha') addHagathaInventoryPane(context, layer, economy)
  else addStats(context, layer, model, companion)
  const playerPreview = companion ? null : addPlayerPreview(context, layer, model.config.element)
  addEquipment(context, layer, economy, selection, dragging, companion, model.config.element)

  addTiledAtlas(context, layer, 'UI', 49, 0, 490, 1600, 310)
  addHorizontalChain(context, layer, 0, 470, 1600)
  addHorizontalChain(context, layer, 0, 800, 1600)
  addBackpackFrame(context, layer)
  addBitmapText(context, layer, 'BACKPACK', 'menu', 800, 489, { tint: 0xaaa2a6 })

  for (let index = 0; index < HUB_INVENTORY_GRID.capacity; index += 1) {
    const position = hubInventorySlotPosition(index)
    const slot = addAtlasSprite(context, layer, 'Inventory', 10, position.x, position.y)
    slot.alpha = HUB_INVENTORY_GRID.slotAlpha
    const item = economy.backpack[index]
    if (!item) continue
    const held = dragging?.owner === 'backpack' && item.id === dragging.itemId
    if (!held) addClippedItemIcon(
      context,
      layer,
      item,
      position.x + 36,
      position.y + 36,
      model.config.element,
      [position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize],
    )
    if (!held && item.quantity > 1) {
      addBitmapText(context, layer, `${item.quantity}`, 'medium', position.x + 61, position.y + 54, {
        align: 'center',
        tint: 0xf4e5b4,
      })
    }
    if (item.id === selection?.id && selection.owner === 'backpack') {
      addInventorySelection(layer, position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize)
    }
  }

  addGold(context, layer, economy.gold)
  addBelt(context, layer, economy.backpack, model.config.element)
  addCenteredAtlasSprite(context, layer, 'UI', 75, 1562, 868)

  if (model.leftPane !== 'hagatha') {
    const primarySpellLines = hubInventoryPrimarySpellLines(model.config.element, progression.learnedSkills)
    const textLeft = HUB_PRIMARY_SPELL_PANE.textLeft + leftShift
    addBitmapText(
      context,
      layer,
      'PRIMARY SPELL',
      HUB_PRIMARY_SPELL_PANE.headingFont,
      textLeft,
      HUB_PRIMARY_SPELL_PANE.headingTextBaselineY,
      { align: 'left', tint: 0xe4c56d },
    )
    primarySpellLines.forEach((line, index) => addBitmapTextRuns(
      context,
      layer,
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
      textLeft,
      HUB_PRIMARY_SPELL_PANE.contentTextBaselines[index]!,
      HUB_PRIMARY_SPELL_PANE.textTint,
    ))
  }

  const selected = selection ? inventoryItemForSelection(economy, selection) : null
  const selectedCenter = selection ? inventorySelectionCenter(economy, selection, companion) : null
  const itemInfo = selected && selectedCenter && !dragging
    ? addInventoryItemInfo(context, layer, selected, selectedCenter.x, selectedCenter.y)
    : null
  const dragger = dragging
    ? addInventoryDragger(context, layer, inventoryItemForDrag(economy, dragging), dragging, model.config.element)
    : null
  return { dragger, itemInfo, playerPreview }
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
    readonly progression: ProtocolPlayerProgression
  },
  companion: boolean,
): void {
  const decorationShift = companion ? 0 : -53
  const contentShift = companion ? 53 : 0
  addCenteredAtlasSprite(context, layer, 'Inventory', 16, 119 + decorationShift, 151)
  addCenteredAtlasSprite(context, layer, 'Inventory', 16, 309 + decorationShift, 151)
  addCenteredAtlasSprite(context, layer, 'Inventory', 16, 164 + decorationShift, 233.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 16, 169 + decorationShift, 284.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 16, 319 + decorationShift, 256.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 16, 119 + decorationShift, 367.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 13, 391 + decorationShift, 379)
  addCenteredAtlasSprite(context, layer, 'Inventory', 13, 391 + decorationShift, 439, 1, -1)
  addInset(layer, 86 + contentShift, 112, 227, 29)
  addInset(layer, 86 + contentShift, 143, 227, 43)
  addInset(
    layer,
    HUB_PRIMARY_SPELL_PANE.headingRect[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.headingRect[1],
    HUB_PRIMARY_SPELL_PANE.headingRect[2],
    HUB_PRIMARY_SPELL_PANE.headingRect[3],
  )
  addInset(
    layer,
    HUB_PRIMARY_SPELL_PANE.bodyRect[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.bodyRect[1],
    HUB_PRIMARY_SPELL_PANE.bodyRect[2],
    HUB_PRIMARY_SPELL_PANE.bodyRect[3],
  )
  addInset(layer, 86 + contentShift, 330, 227, 54)
  addBitmapText(context, layer, model.config.displayName.toUpperCase(), 'menu', 96 + contentShift, 136, { align: 'left', tint: 0xffffff })
  addBitmapText(context, layer, `LEVEL ${model.progression.level}`, 'medium', 96 + contentShift, 159, { align: 'left', tint: 0xe4c56d })
  addBitmapText(context, layer, `${model.config.element.toUpperCase()} ${model.config.discipline.toUpperCase()}`, 'medium', 96 + contentShift, 175, { align: 'left', tint: 0xe4c56d })
  addBitmapText(context, layer, 'MELEE DAMAGE', 'medium', 96 + contentShift, 348, { align: 'left', tint: 0xe4c56d })
  addBitmapText(context, layer, '0.5 - 1 / WHACK', 'medium', 96 + contentShift, 371, {
    align: 'left',
    tint: HUB_PRIMARY_SPELL_PANE.textTint,
  })
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
    [playerCharacter.staffBack, 0, staffFront ? -1 : 1],
    [playerCharacter.robeDynamic[element], 0, 3],
    [playerCharacter.robeFixed[element], 0, 4],
    [playerCharacter.staffFront, 0, staffFront ? 5 : -1],
    [playerCharacter.head[element], null, 7],
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
  source: string,
  heading: number,
  column: number | null,
): Texture {
  const key = `actor.${source}.${heading}.${column ?? 0}`
  const cached = context.atlasTextureCache.get(key)
  if (cached) return cached
  const base = textureFrom(context.textures.textures, source)
  const texture = new Texture({
    frame: new Rectangle((column ?? 0) * 170, heading * 170, 170, 170),
    source: base.source,
  })
  context.atlasTextureCache.set(key, texture)
  return texture
}

function addEquipment(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel | null,
  dragging: HubInventoryDragModel | null,
  companion: boolean,
  element: WizardElement,
): void {
  const xShift = companion ? 0 : 53
  for (const [x, y] of [[1337, 224], [1337, 289], [1479, 192], [1479, 256], [1479, 321]] as const) {
    addCenteredAtlasSprite(context, layer, 'Inventory', 16, x + xShift, y)
  }
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const draggedBackpack = dragging?.owner === 'backpack'
    ? economy.backpack.find(({ id }) => id === dragging.itemId) ?? null
    : null
  const targetItem = draggedBackpack
  const acceptingSlots = new Set(targetItem ? equipmentSlotsForItem(targetItem, thirdRingUnlocked) : [])
  for (const slot of ['amulet', 'hat', 'weapon', 'robe', 'ring-0', 'ring-1', 'ring-2'] as const) {
    if (slot === 'ring-2' && !thirdRingUnlocked) continue
    const item = itemAtEquipmentSlot(economy, slot)
    const held = dragging?.owner === 'equipment' && dragging.equipmentSlot === slot
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
  backpack: readonly HubInventoryItem[],
  element: WizardElement,
): void {
  const potions = backpack.filter((item) => item.kind.includes('potion')).slice(0, 2)
  const centers = [494.5, 554.5, 614.5, 674.5, 924.5, 984.5, 1044.5, 1104.5]
  centers.forEach((x, index) => {
    addCenteredAtlasSprite(context, layer, 'UI', 2, x, 874)
    const item = index === 3 ? potions[0] : index === 4 ? potions[1] : null
    if (item) addItemIcon(context, layer, item, x, 874, element)
  })
  addCenteredAtlasSprite(context, layer, 'UI', 82, 800.5, 872)
  for (const [record, x, y] of [[47, 764.5, 876], [47, 759.5, 871], [48, 844.5, 876], [48, 839.5, 871]] as const) {
    addCenteredAtlasSprite(context, layer, 'UI', record, x, y)
  }
}

function buildDialogue(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
): ChatRenderState {
  const dialogue = HUB_TRADER_DIALOGUES[model.trader]
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
  if (model.phase === 'choices') {
    const hasPriceQuestion = dialogue.priceLabel !== null
    addBitmapText(
      context,
      content,
      dialogue.actionLabel,
      'menu',
      HUB_CHAT_PANEL.contentWidth / 2,
      HUB_CHAT_PANEL.primaryChoiceTextBaselineY - HUB_CHAT_PANEL.contentTop,
      {
      scale: 1.25,
      tint: HUB_CHAT_PANEL.actionTextTint,
      },
    )
    if (hasPriceQuestion) {
      addBitmapText(
        context,
        content,
        dialogue.priceLabel!,
        'menu',
        HUB_CHAT_PANEL.contentWidth / 2,
        HUB_CHAT_PANEL.secondaryChoiceTextBaselineY - HUB_CHAT_PANEL.contentTop,
        { tint: HUB_CHAT_PANEL.textTint },
      )
    }
  } else {
    const paragraphs = model.phase === 'prices' ? dialogue.priceExplanation : dialogue.intro
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
    model.phase === 'choices' ? 'Done' : 'Skip',
    'menu',
    800,
    HUB_CHAT_PANEL.doneTextBaselineY,
    { tint: HUB_CHAT_PANEL.textTint },
  )
  return { content, contentHeight }
}

function buildService(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): { readonly dragger: Container | null; readonly itemInfo: Container | null; readonly overlay: Container } {
  const inventory = buildInventory(context, layer, {
    companion: true,
    config: model.config,
    economy: model.economy,
    dragging: model.dragging,
    leftPane: model.trader === 'hagatha' ? 'hagatha' : 'stats',
    progression: model.progression,
    selection: model.inventorySelection,
  })
  const overlay = new Container()
  overlay.label = 'native-service-overlay'
  layer.addChild(overlay)
  const { width } = HUB_SHOP_PANEL
  addShopPanel(context, overlay, model.trader === 'shlorio' && model.economy.dowsingOffers.length > 0)
  const dialogue = HUB_TRADER_DIALOGUES[model.trader]
  const titleFont: FontName = measureBitmapText(dialogue.title, FONT_ASSETS.fonts.menu) > width - 55
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
    addDowsingButton(context, overlay, model.economy.dowsingFee)
    addDoneControl(context, overlay)
    if (inventory.dragger) layer.addChild(inventory.dragger)
    return { dragger: inventory.dragger, itemInfo: inventory.itemInfo, overlay }
  }

  if (model.trader === 'luthacus') {
    addStoreGrid(context, overlay, model.economy.storage, model, 'storage')
  } else if (model.trader === 'shlorio') {
    addDowsingGrid(context, overlay, serviceItems(model), model)
  } else {
    addStoreGrid(context, overlay, serviceItems(model), model, null)
  }
  addDoneControl(context, overlay)
  if (inventory.dragger) layer.addChild(inventory.dragger)
  return { dragger: inventory.dragger, itemInfo: inventory.itemInfo, overlay }
}

function buildNotice(
  context: RenderContext,
  layer: Container,
  notice: HubInventoryRendererNotice,
): void {
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
  addMessageBoxButton(context, noticeLayer, notice.actionLabel)
  layer.addChild(noticeLayer)
}

function addStoreGrid(
  context: RenderContext,
  layer: Container,
  items: readonly (HubInventoryItem | HubShopItem)[],
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
  owner: 'storage' | null,
): void {
  for (let index = 0; index < HUB_SHOP_GRID.retainedCapacity; index += 1) {
    const { x, y } = hubShopSlotPosition(index)
    const slot = addAtlasSprite(context, layer, 'Inventory', 10, x, y)
    slot.alpha = HUB_SHOP_GRID.slotAlpha
    const item = items[index]
    if (!item) continue
    const held = owner === 'storage'
      && model.dragging?.owner === 'storage'
      && model.dragging.itemId === item.id
    const selected = item.id === model.selectedItemId && model.selectedOwner === owner
    if (selected && !held) {
      const record = owner === 'storage'
        ? 111
        : 'price' in item && item.price > model.economy.gold ? 46 : 84
      addAtlasSprite(context, layer, 'UI', record, x + (record === 46 ? -0.5 : 3), y + (record === 46 ? 5.5 : 11))
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
    if (!held && 'price' in item) {
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
      addAtlasSprite(context, layer, 'UI', item.price > model.economy.gold ? 46 : 84, x + 1, y + 11)
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
): void {
  const { left, top } = HUB_HAGATHA_PERK_PANE
  for (const [x, y] of [[323, 227], [166, 247], [166, 312], [166, 182], [111, 125]] as const) {
    addCenteredAtlasSprite(context, layer, 'Inventory', 16, x, y)
  }
  addAtlasSprite(context, layer, 'Inventory', 3, 362, 218)
  layer.addChild(new Graphics()
    .rect(left, top, HUB_HAGATHA_PERK_PANE.innerWidth, HUB_HAGATHA_PERK_PANE.innerHeight)
    .fill({ color: HUB_HAGATHA_PERK_PANE.innerPanelTint })
    .stroke({ color: 0xffffff, width: 1 }))
  addBitmapText(
    context,
    layer,
    'CHARMS/CURSES',
    'medium',
    HUB_HAGATHA_PERK_PANE.titleCenterX,
    HUB_HAGATHA_PERK_PANE.titleTextBaselineY,
    { tint: HUB_HAGATHA_PERK_PANE.titleTint },
  )
  for (let index = 0; index < HUB_HAGATHA_PERK_PANE.columns * HUB_HAGATHA_PERK_PANE.rows; index += 1) {
    const centerX = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[0]
      + (index % HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
    const centerY = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[1]
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
    if (selector === undefined) slot.tint = HUB_HAGATHA_PERK_PANE.emptySlotTint
    else addCenteredAtlasSprite(
      context,
      layer,
      'Skills',
      127 + selector,
      centerX,
      centerY,
      HUB_HAGATHA_PERK_PANE.slotScale,
    )
  }
  addCenteredAtlasSprite(context, layer, 'Inventory', 5, ...HUB_HAGATHA_PERK_PANE.bundleCenter)
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
): void {
  addCenteredAtlasSprite(context, layer, 'UI', 101, ...HUB_DOWSING_PREROLL.buttonCenter)
  addCenteredAtlasSprite(context, layer, 'UI', 54, ...HUB_DOWSING_PREROLL.buttonSideCenters[0])
  addCenteredAtlasSprite(context, layer, 'UI', 54, ...HUB_DOWSING_PREROLL.buttonSideCenters[1], -1, 1)
  addBitmapText(context, layer, 'DOWSE', 'menu', 800, HUB_DOWSING_PREROLL.labelTextBaselineY, {
    tint: HUB_SHOP_TEXT.goldTint,
  })
  addBitmapText(context, layer, `${fee} GOLD`, 'medium', 800, HUB_DOWSING_PREROLL.feeTextBaselineY, {
    tint: HUB_SHOP_TEXT.goldTint,
  })
}

function addMessageBoxButton(context: RenderContext, layer: Container, label: string): void {
  addCenteredAtlasSprite(context, layer, 'UI', 101, ...HUB_DOWSING_MSGBOX.primaryButtonCenter)
  addCenteredAtlasSprite(context, layer, 'UI', 54, ...HUB_DOWSING_MSGBOX.primaryButtonSideCenters[0])
  addCenteredAtlasSprite(context, layer, 'UI', 54, ...HUB_DOWSING_MSGBOX.primaryButtonSideCenters[1], -1, 1)
  addBitmapText(context, layer, label, 'menu', 800, HUB_DOWSING_MSGBOX.primaryButtonTextBaselineY, {
    tint: HUB_DOWSING_MSGBOX.primaryButtonTextTint,
  })
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
  addCenteredAtlasSprite(context, layer, 'UI', 21, 38, 868)
  addBitmapText(context, layer, gold.toLocaleString(), 'body', 48, 870, { align: 'left', tint: 0xffffff })
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
    ? economy.backpack.find(({ id }) => id === selection.id) ?? null
    : selection.equipmentSlot === null
      ? null
      : itemAtEquipmentSlot(economy, selection.equipmentSlot)
}

function inventoryItemForDrag(
  economy: ProtocolPlayerEconomy,
  dragging: HubInventoryDragModel,
): HubInventoryItem | null {
  return dragging.owner === 'backpack'
    ? economy.backpack.find(({ id }) => id === dragging.itemId) ?? null
    : dragging.owner === 'storage'
      ? economy.storage.find(({ id }) => id === dragging.itemId) ?? null
    : dragging.equipmentSlot === null
      ? null
      : itemAtEquipmentSlot(economy, dragging.equipmentSlot)
}

function inventorySelectionCenter(
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel,
  companion: boolean,
): { readonly x: number; readonly y: number } | null {
  if (selection.owner === 'backpack') {
    const index = economy.backpack.findIndex(({ id }) => id === selection.id)
    if (index < 0) return null
    const position = hubInventorySlotPosition(index)
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
): Container {
  const text = hubInventoryItemInfoText(item)
  const lines: readonly { readonly font: FontName; readonly text: string }[] = [
    { font: 'menu', text: text.title.toUpperCase() },
    ...(text.description ? [{ font: 'body' as const, text: text.description.toUpperCase() }] : []),
    ...(text.instruction ? [{ font: 'body' as const, text: text.instruction.toUpperCase() }] : []),
  ]
  const padding = HUB_INVENTORY_INTERACTION.itemInfoPadding
  const width = Math.max(...lines.map((line) => measureBitmapText(line.text, FONT_ASSETS.fonts[line.font])))
    + padding * 2
  const height = lines.length * 28 + padding * 2
  const margin = HUB_INVENTORY_INTERACTION.itemInfoViewportMargin
  let x = sourceCenterX + HUB_INVENTORY_INTERACTION.itemInfoOffset
  if (x + width > HUB_NATIVE_UI_SIZE.width - margin) {
    x = sourceCenterX - HUB_INVENTORY_INTERACTION.itemInfoOffset - width
  }
  x = Math.max(margin, Math.min(HUB_NATIVE_UI_SIZE.width - margin - width, x))
  const y = Math.max(
    margin,
    Math.min(HUB_NATIVE_UI_SIZE.height - margin - height, sourceCenterY - height / 2),
  )
  const info = new Container()
  info.label = 'native-inventory-item-info'
  info.position.set(x, y)
  info.addChild(new Graphics().rect(0, 0, width, height).fill({ color: 0x000000 }))
  lines.forEach((line, index) => addBitmapText(
    context,
    info,
    line.text,
    line.font,
    padding,
    padding + index * 28,
    { align: 'left', tint: 0xffffff },
  ))
  info.visible = false
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
  item: Pick<HubInventoryItem, 'equipmentType' | 'iconRecords' | 'recipeIndex'>,
  centerX: number,
  centerY: number,
  element: WizardElement,
  options: {
    readonly alpha?: number
    readonly tintOverride?: number
  } = {},
): readonly Sprite[] {
  const transform = item.equipmentType === null
    ? null
    : HUB_ITEM_ICON_TRANSFORMS[item.equipmentType]
  const recipe = item.recipeIndex === null
    ? null
    : DOWSING_EQUIPMENT_RECIPES[item.recipeIndex]
  const iconTints = item.equipmentType === 'hat' || item.equipmentType === 'robe'
    ? recipe?.iconTints ?? [HUB_STARTER_EQUIPMENT_PRIMARY_TINT[element], 0xffffff]
    : [null, null]
  const sprites: Sprite[] = []
  for (const [index, record] of item.iconRecords.entries()) {
    if (!TRADER_ASSETS.atlases.Inventory.records[`${record}`]) continue
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
  item: Pick<HubInventoryItem, 'equipmentType' | 'iconRecords' | 'recipeIndex'>,
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
  const definition = TRADER_ASSETS.atlases[atlas].records[`${record}`]
  if (!definition) throw new Error(`native ${atlas}.${record} was not extracted`)
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
  const definition = TRADER_ASSETS.atlases[atlas].records[`${record}`]
  if (!definition) throw new Error(`native ${atlas}.${record} was not extracted`)
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
  const definition = TRADER_ASSETS.atlases[atlas].records[`${record}`]
  if (!definition) throw new Error(`native ${atlas}.${record} was not extracted`)
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
  const key = `${atlas}.${record}`
  const cached = context.atlasTextureCache.get(key)
  if (cached) return cached
  const definition = TRADER_ASSETS.atlases[atlas].records[`${record}`]
  if (!definition) throw new Error(`native ${atlas}.${record} was not extracted`)
  const source = textureFrom(context.textures.textures, ATLAS_SOURCE[atlas])
  const [x, y, width, height] = definition.frame
  const [logicalWidth, logicalHeight] = definition.logicalSize
  const [trimX, trimY] = definition.trimOrigin
  const texture = new Texture({
    frame: new Rectangle(x, y, width, height),
    orig: new Rectangle(0, 0, logicalWidth, logicalHeight),
    source: source.source,
    trim: new Rectangle(trimX, trimY, width, height),
  })
  context.atlasTextureCache.set(key, texture)
  return texture
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
  const key = `${atlas}.${record}:slice:${left},${top},${right},${bottom}`
  const cached = context.atlasTextureCache.get(key)
  if (cached) return cached
  const definition = TRADER_ASSETS.atlases[atlas].records[`${record}`]
  if (!definition) throw new Error(`native ${atlas}.${record} was not extracted`)
  const [x, y, width, height] = definition.frame
  const sliceWidth = width * (right - left)
  const sliceHeight = height * (bottom - top)
  const source = textureFrom(context.textures.textures, ATLAS_SOURCE[atlas])
  const texture = new Texture({
    frame: new Rectangle(x + width * left, y + height * top, sliceWidth, sliceHeight),
    orig: new Rectangle(0, 0, sliceWidth, sliceHeight),
    source: source.source,
  })
  context.atlasTextureCache.set(key, texture)
  return texture
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
  const font = FONT_ASSETS.fonts[fontName]
  const scale = options.scale ?? 1
  const lines = wrapBitmapText(text, font, (options.maxWidth ?? Number.POSITIVE_INFINITY) / scale)
  const lineHeight = (options.lineHeight ?? font.metrics[0]) * scale
  lines.forEach((line, lineIndex) => {
    const width = measureBitmapText(line, font) * scale
    let cursor = options.align === 'left'
      ? x
      : options.align === 'right'
        ? x - width
        : x - width / 2
    let previous = -1
    for (const character of line) {
      const code = character.codePointAt(0)!
      if (character === ' ') {
        cursor += font.spaceAdvance * scale
        previous = code
        continue
      }
      const glyph = font.glyphs[`${code}`]
      if (!glyph?.metrics) continue
      cursor += kerning(font, previous, code) * scale
      const sprite = new Sprite(glyphTexture(context, glyph, code))
      sprite.anchor.set(0.5)
      sprite.scale.set(scale)
      sprite.tint = options.tint ?? 0xffffff
      sprite.position.set(
        cursor + glyph.metrics[1] * scale,
        y + lineIndex * lineHeight + glyph.metrics[2] * scale,
      )
      layer.addChild(sprite)
      cursor += glyph.metrics[0] * scale
      previous = code
    }
  })
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
  const font = FONT_ASSETS.fonts[fontName]
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
      cursor += kerning(font, previous, code) * advanceScale
      const sprite = new Sprite(glyphTexture(context, glyph, code))
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
  const font = FONT_ASSETS.fonts.menu
  const lines = wrapChatBitmapText(source, font, options.maxWidth)
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
      cursor += kerning(font, previous, code)
      const sprite = new Sprite(glyphTexture(context, glyph, code))
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

function applyExactTextItalic(sprite: Sprite, glyph: AtlasRecord): void {
  const glyphHeight = glyph.frame[3]
  if (glyphHeight <= 0) return
  const totalDelta = HUB_CHAT_INLINE_EMPHASIS.glyphTopDelta
    - HUB_CHAT_INLINE_EMPHASIS.glyphBottomDelta
  const italicAngle = Math.atan(totalDelta / glyphHeight)
  sprite.skew.x = -italicAngle
  sprite.scale.y /= Math.cos(italicAngle)
}

function wrapChatBitmapText(source: string, font: BitmapFont, maxWidth: number): StyledGlyphCharacter[][] {
  const characters = hubChatTextRuns(source).flatMap(({ italic, text }) => (
    [...text].map((character) => ({ character, italic }))
  ))
  const lines: StyledGlyphCharacter[][] = []
  let paragraph: StyledGlyphCharacter[] = []
  const flushParagraph = (): void => {
    lines.push(...wrapChatParagraph(paragraph, font, maxWidth))
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
  font: BitmapFont,
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
    if (line.length > 0 && word.length > 0 && measureStyledBitmapText(candidate, font) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  lines.push(line)
  return lines
}

function measureStyledBitmapText(text: readonly StyledGlyphCharacter[], font: BitmapFont): number {
  return measureBitmapText(text.map(({ character }) => character).join(''), font)
}

function glyphTexture(context: RenderContext, glyph: AtlasRecord, code: number): Texture {
  const [x, y, width, height] = glyph.frame
  const key = `${code}.${x}.${y}.${width}.${height}`
  const cached = context.glyphTextureCache.get(key)
  if (cached) return cached
  const source = textureFrom(context.textures.textures, skillPicker.fontsAtlas)
  const texture = new Texture({ frame: new Rectangle(x, y, width, height), source: source.source })
  context.glyphTextureCache.set(key, texture)
  return texture
}

function wrapBitmapText(text: string, font: BitmapFont, maxWidth: number): string[] {
  if (!Number.isFinite(maxWidth)) return text.split('\n')
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (current && measureBitmapText(next, font) > maxWidth) {
        lines.push(current)
        current = word
      } else current = next
    }
    if (current) lines.push(current)
    else lines.push('')
  }
  return lines
}

function measureBitmapText(text: string, font: BitmapFont): number {
  let width = 0
  let previous = -1
  for (const character of text) {
    const code = character.codePointAt(0)!
    if (character === ' ') width += font.spaceAdvance
    else {
      const glyph = font.glyphs[`${code}`]
      if (glyph?.metrics) width += kerning(font, previous, code) + glyph.metrics[0]
    }
    previous = code
  }
  return width
}

function kerning(font: BitmapFont, first: number, second: number): number {
  if (first < 0) return 0
  return font.kerning.find(([left, right]) => left === first && right === second)?.[2] ?? 0
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3
}
