import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
} from 'pixi.js'

import traderAssetsJson from '../../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import fontAssetsJson from '../../assets/game/skill-picker-native-assets.json' with { type: 'json' }
import { hub, playerCharacter, skillPicker } from '../../lib/assets.ts'
import { DOWSING_EQUIPMENT_RECIPES, type HubInventoryItem, type HubShopItem, type HubTraderId } from '../core-kernels/hub-economy.ts'
import type { PlayerCharacterConfig, WizardElement } from '../core-kernels/player-character.ts'
import { HUB_TRADER_DIALOGUES, equipmentSlotsForItem } from '../hub-inventory-presentation.ts'
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
  HUB_INVENTORY_GRID,
  HUB_NATIVE_UI_TIMING,
  HUB_NATIVE_UI_SIZE,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  hubInventoryPrimarySpellLines,
  hubInventorySlotPosition,
} from './hub-inventory-render-contract.ts'

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

export type HubInventoryRendererModel =
  | {
      readonly config: PlayerCharacterConfig
      readonly economy: ProtocolPlayerEconomy
      readonly kind: 'inventory'
      readonly progression: ProtocolPlayerProgression
      readonly selectedItemId: number | null
    }
  | {
      readonly kind: 'dialogue'
      readonly priceExplanation: boolean
      readonly trader: HubTraderId
    }
  | {
      readonly economy: ProtocolPlayerEconomy
      readonly kind: 'service'
      readonly page: number
      readonly notice: HubInventoryRendererNotice | null
      readonly selectedItemId: number | null
      readonly selectedOwner: 'backpack' | 'storage' | null
      readonly trader: HubTraderId
    }

export interface HubInventoryRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(nowMs: number, reveal: number): void
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
  let noticeRevealStartedAt: number | null = null
  let previousDowsingOfferCount: number | null = null

  const context: RenderContext = {
    atlasTextureCache,
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
      textures.destroy()
    },
    render(nowMs, reveal) {
      if (destroyed) return
      const clampedReveal = Math.max(0, Math.min(1, reveal))
      gpu.canvas.dataset.nativeReveal = clampedReveal >= 1 ? 'settled' : 'revealing'
      dimmer.alpha = curtainAlpha * clampedReveal
      surface.alpha = clampedReveal
      surface.y = currentKind === 'service'
        ? -HUB_SHOP_PANEL.slideDistance * (1 - easeOutCubic(clampedReveal))
        : 0
      const flashAlpha = dowsingFlashStartedAt === null
        ? 0
        : Math.max(0, 1 - (nowMs - dowsingFlashStartedAt) / HUB_DOWSING_FLASH.durationMs)
      dowsingFlash.alpha = flashAlpha
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
      application.renderer.render(application.stage)
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
      if (model.kind === 'service' && model.notice && noticeRevealStartedAt === null) {
        noticeRevealStartedAt = performance.now()
      } else if (model.kind !== 'service' || !model.notice) noticeRevealStartedAt = null
      currentKind = model.kind
      curtainAlpha = model.kind === 'inventory' ? 1 : 0.75
      surface.removeChildren().forEach((child) => child.destroy({ children: true }))
      if (model.kind === 'inventory') buildInventory(context, surface, model)
      else if (model.kind === 'dialogue') buildDialogue(context, surface, model)
      else {
        buildService(context, surface, model)
        if (model.notice) buildNotice(context, surface, model.notice)
      }
      application.renderer.render(application.stage)
    },
  }
}

interface RenderContext {
  readonly atlasTextureCache: Map<string, Texture>
  readonly glyphTextureCache: Map<string, Texture>
  readonly textures: GameTextureMap
}

function buildInventory(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'inventory' }>,
): void {
  const { economy, progression } = model
  const background = new Graphics().rect(0, 0, 1600, 900).fill({ color: 0x000000 })
  layer.addChild(background)

  addInventorySidePanel(context, layer, 0, false)
  addInventorySidePanel(context, layer, 1212.5, true)
  addHorizontalChain(context, layer, 0, 470, 1600)
  addHorizontalChain(context, layer, 0, 800, 1600)
  addBitmapText(context, layer, 'STATS', 'menu', 208, 84, { tint: 0xaaa2a6 })
  addBitmapText(context, layer, 'EQUIP', 'menu', 1398, 84, { tint: 0xaaa2a6 })
  addBitmapText(context, layer, 'BACKPACK', 'menu', 800, 480, { tint: 0xaaa2a6 })

  addStats(context, layer, model)
  addPlayerPreview(context, layer, model.config.element)
  addEquipment(context, layer, economy, model.selectedItemId)
  addTiledAtlas(context, layer, 'UI', 49, 0, 490, 1600, 310)

  for (let index = 0; index < HUB_INVENTORY_GRID.capacity; index += 1) {
    const position = hubInventorySlotPosition(index)
    addAtlasSprite(context, layer, 'Inventory', 10, position.x, position.y, { scale: 0.9375 })
    const item = economy.backpack[index]
    if (!item) continue
    addItemIcon(context, layer, item, position.x + 33.75, position.y + 33.75, 57)
    if (item.quantity > 1) {
      addBitmapText(context, layer, `${item.quantity}`, 'medium', position.x + 56, position.y + 51, {
        align: 'center',
        tint: 0xf4e5b4,
      })
    }
    if (item.id === model.selectedItemId) addSelectionGlow(layer, position.x, position.y, 67.5, 67.5)
  }

  addGold(context, layer, economy.gold, 15, 850)
  addBelt(context, layer, economy.backpack)
  const exit = addAtlasSprite(context, layer, 'UI', 75, 1530, 842, { scale: 1.2 })
  exit.tint = 0xffdc54

  const primarySpellLines = hubInventoryPrimarySpellLines(model.config.element, progression.learnedSkills)
  addBitmapText(context, layer, 'PRIMARY SPELL', 'medium', 96, 217, { align: 'left', tint: 0xe4c56d })
  primarySpellLines.forEach((line, index) => addBitmapText(
    context,
    layer,
    line,
    'medium',
    96,
    247 + index * 19,
    { align: 'left', tint: 0xd9f7ff },
  ))

  const selected = economy.backpack.find(({ id }) => id === model.selectedItemId)
  if (selected) {
    addBitmapText(context, layer, selected.name.toUpperCase(), 'body', 800, 390, { tint: 0xf3ead1 })
    addBitmapText(
      context,
      layer,
      `${(selected.rarity ?? selected.kind).replaceAll('-', ' ').toUpperCase()}  x${selected.quantity}`,
      'body',
      800,
      407,
      { tint: 0xc9b986 },
    )
    const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
    equipmentSlotsForItem(selected, thirdRingUnlocked).forEach((slot, index) => {
      addNativeButton(context, layer, `EQUIP ${equipmentSlotLabel(slot)}`, 680 + index * 130, 425, 125, 36)
    })
  }
}

function addInventorySidePanel(
  context: RenderContext,
  layer: Container,
  left: number,
  mirrored: boolean,
): void {
  addTiledAtlas(context, layer, 'UI', 30, left, 0, 387.5, 470)
  const guardianRecord = mirrored ? 31 : 32
  const guardianXs = mirrored
    ? [left + 2, left + 238]
    : [left - 18, left + 210]
  for (const x of guardianXs) {
    addAtlasSprite(context, layer, 'UI', guardianRecord, x, -8)
    addAtlasSprite(context, layer, 'UI', guardianRecord, x, 306)
  }
  addTiledAtlas(context, layer, 'UI', 49, left + 31, 74, 330, 352)
  if (mirrored) addAtlasSprite(context, layer, 'Inventory', 16, left + 203, 148)
  else addAtlasSprite(context, layer, 'UI', 33, left, 151)
  addHorizontalChain(context, layer, left + 32, 63, 330)
  addHorizontalChain(context, layer, left + 32, 407, 330)
  addVerticalChain(context, layer, left + 29, 73, 350)
  addVerticalChain(context, layer, left + 345, 73, 350)
  const corners = [
    [107, left + (mirrored ? 0 : 32), 68],
    [108, left + 302, 68],
    [109, left + (mirrored ? 0 : 32), 337],
    [110, left + 302, 337],
  ] as const
  for (const [record, x, y] of corners) addAtlasSprite(context, layer, 'UI', record, x, y)
}

function addStats(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'inventory' }>,
): void {
  addAtlasSprite(context, layer, 'UI', 20, 222, 215)
  addInset(context, layer, 86, 112, 227, 29)
  addBitmapText(context, layer, model.config.displayName.toUpperCase(), 'menu', 96, 122, { align: 'left', tint: 0xffffff })
  addInset(context, layer, 86, 143, 227, 43)
  addBitmapText(context, layer, `LEVEL ${model.progression.level}`, 'medium', 96, 151, { align: 'left', tint: 0xe4c56d })
  addBitmapText(context, layer, `${model.config.element.toUpperCase()} ${model.config.discipline.toUpperCase()}`, 'medium', 96, 169, { align: 'left', tint: 0xe4c56d })
  addInset(context, layer, 86, 208, 227, 102)
  addInset(context, layer, 86, 330, 227, 54)
  addBitmapText(context, layer, 'MELEE DAMAGE', 'medium', 96, 339, { align: 'left', tint: 0xe4c56d })
  addBitmapText(context, layer, '0.5 - 1 / WHACK', 'medium', 96, 365, { align: 'left', tint: 0xd9f7ff })
}

function addPlayerPreview(context: RenderContext, layer: Container, element: WizardElement): void {
  const seal = addAtlasSprite(context, layer, 'UI', 62, 800, 250, { anchor: 0.5, scale: 1.25 })
  seal.alpha = 0.32
  seal.label = 'native-seal:0'
  const previewSources = [
    playerCharacter.staffBack,
    playerCharacter.robeFixed[element],
    playerCharacter.robeDynamic[element],
    playerCharacter.head[element],
    playerCharacter.staffFront,
  ]
  for (const source of previewSources) {
    const base = textureFrom(context.textures.textures, source)
    const frame = new Texture({
      frame: new Rectangle(0, 0, 170, 170),
      source: base.source,
    })
    const sprite = new Sprite(frame)
    sprite.anchor.set(0.5)
    sprite.position.set(800, 260)
    sprite.scale.set(1.25)
    layer.addChild(sprite)
  }
  addBitmapText(context, layer, 'KILLS: 0', 'medium', 800, 337, { tint: 0xe7cc71 })
  addBitmapText(context, layer, 'AWESOMENESS: 0', 'medium', 800, 359, { tint: 0xe7cc71 })
}

function addEquipment(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  selectedItemId: number | null,
): void {
  const slots: [HubInventoryItem | null, number, number, number, number][] = [
    [economy.equipment.amulet, 1301, 170, 46, 46],
    [economy.equipment.hat, 1355, 144, 68, 68],
    [economy.equipment.weapon, 1275, 224, 68, 68],
    [economy.equipment.robe, 1355, 224, 68, 105],
    [economy.equipment.weapon, 1435, 224, 68, 68],
    [economy.equipment.rings[0], 1301, 303, 46, 46],
    [economy.equipment.rings[1], 1435, 303, 46, 46],
  ]
  if (economy.ownedPerkSelectors.includes(19)) {
    slots.push([economy.equipment.rings[2], 1435, 350, 46, 46])
  }
  for (const [item, x, y, width, height] of slots) {
    addAtlasSprite(context, layer, 'Inventory', width > 46 ? 10 : 9, x, y, {
      scale: width > 46 ? 0.9375 : 1,
    })
    if (item) addItemIcon(context, layer, item, x + width / 2, y + height / 2, Math.min(width - 8, height - 8))
    if (item?.id === selectedItemId) addSelectionGlow(layer, x, y, width, height)
  }
}

function addBelt(context: RenderContext, layer: Container, backpack: readonly HubInventoryItem[]): void {
  const potions = backpack.filter((item) => item.kind.includes('potion')).slice(0, 2)
  const startX = 468
  for (let index = 0; index < 11; index += 1) {
    const x = startX + index * 62
    addAtlasSprite(context, layer, 'Inventory', 9, x, 849)
    const item = index === 3 ? potions[0] : index === 7 ? potions[1] : null
    if (item) addItemIcon(context, layer, item, x + 25.5, 874, 47)
  }
  addAtlasSprite(context, layer, 'Inventory', 0, 731, 838, { scale: 0.75 })
  addAtlasSprite(context, layer, 'Inventory', 10, 810, 839, { scale: 0.38 })
  addAtlasSprite(context, layer, 'UI', 48, 870, 840, { scale: 0.42 })
}

function buildDialogue(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
): void {
  const dialogue = HUB_TRADER_DIALOGUES[model.trader]
  const left = 350
  const top = 150
  addLeatherPanel(context, layer, left, top, 900, 590)
  addBitmapText(context, layer, dialogue.name.toUpperCase(), 'medium', 800, top + 55, { tint: 0xe6c76c })
  const paragraphs = model.priceExplanation ? dialogue.priceExplanation : dialogue.intro
  let y = top + 115
  for (const paragraph of paragraphs) {
    addBitmapText(context, layer, paragraph, 'body', left + 75, y, {
      align: 'left',
      lineHeight: 25,
      maxWidth: 750,
      tint: 0xf1ead5,
    })
    y += Math.max(58, wrapBitmapText(paragraph, FONT_ASSETS.fonts.body, 750).length * 25 + 22)
  }
  const labels = model.priceExplanation
    ? ['DONE']
    : [dialogue.actionLabel.toUpperCase(), ...(dialogue.priceExplanation.length > 0 ? ['YOUR PRICES'] : []), 'GOODBYE']
  const width = labels.length === 1 ? 220 : 240
  const gap = 20
  const total = labels.length * width + (labels.length - 1) * gap
  labels.forEach((label, index) => addNativeButton(
    context,
    layer,
    label,
    800 - total / 2 + index * (width + gap),
    top + 500,
    width,
    56,
  ))
}

function buildService(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): void {
  if (model.trader === 'luthacus') {
    buildInventoryShop(context, layer, model)
    return
  }
  const { settledLeft: left, settledTop: top, width, height } = HUB_SHOP_PANEL
  addLeatherPanel(context, layer, left, top, width, height)
  const dialogue = HUB_TRADER_DIALOGUES[model.trader]
  const titleFont: FontName = measureBitmapText(dialogue.title, FONT_ASSETS.fonts.medium) > width - 100
    ? 'body'
    : 'medium'
  addBitmapText(context, layer, dialogue.title, titleFont, 800, top + 52, { tint: 0xe6c76c })
  addGold(context, layer, model.economy.gold, left + 22, top + 425)

  if (model.trader === 'shlorio' && model.economy.dowsingOffers.length === 0) {
    addNativeSeal(context, layer, 800, top + 235, 0.42, 0.58)
    addNativeButton(context, layer, 'DOWSE', 680, top + 300, 240, 64)
    addAtlasSprite(context, layer, 'UI', 15, 693, top + 370)
    addBitmapText(context, layer, `${model.economy.dowsingFee.toLocaleString()} GOLD`, 'medium', 800, top + 420, { tint: 0xf1d274 })
    addNativeButton(context, layer, 'DONE', left + width - 150, top + 425, 120, 48)
    return
  }

  const items = serviceItems(model)
  const pageSize = model.trader === 'shlorio' ? HUB_DOWSING_GRID.pageSize : HUB_SHOP_GRID.pageSize
  const visible = items.slice(model.page * pageSize, (model.page + 1) * pageSize)
  const columns = model.trader === 'shlorio' ? 3 : 4
  const pitchX = model.trader === 'shlorio' ? 150 : 135
  const gridLeft = 800 - ((columns - 1) * pitchX) / 2
  visible.forEach((item, index) => {
    const itemLayer = new Container()
    itemLayer.alpha = item.price > model.economy.gold ? 0.42 : 1
    layer.addChild(itemLayer)
    const column = index % columns
    const row = Math.floor(index / columns)
    const centerX = gridLeft + column * pitchX
    const centerY = top + 145 + row * 112
    addAtlasSprite(context, itemLayer, 'UI', 72, centerX - 85.5, centerY + 34)
    addAtlasSprite(context, itemLayer, 'UI', 12, centerX - 67.5, centerY + 39)
    addAtlasSprite(context, itemLayer, 'Inventory', 10, centerX, centerY, { anchor: 0.5, scale: 0.9375 })
    if (model.trader === 'hagatha') {
      const selector = item.recipeIndex ?? -1
      if (selector >= 0) addAtlasSprite(context, itemLayer, 'Skills', 127 + selector, centerX, centerY, { anchor: 0.5 })
      else addAtlasSprite(context, itemLayer, 'Inventory', 5, centerX, centerY, { anchor: 0.5, scale: 0.6 })
    } else addItemIcon(context, itemLayer, item, centerX, centerY, 58)
    const name = item.name.toUpperCase()
    const nameLines = wrapBitmapText(name, FONT_ASSETS.fonts.body, 122)
    addBitmapText(context, itemLayer, name, 'body', centerX, centerY + 44, {
      lineHeight: 13,
      maxWidth: 122,
      tint: 0xf3ead1,
    })
    addBitmapText(context, itemLayer, `${item.price}`, 'body', centerX, centerY + 48 + nameLines.length * 13, { tint: 0xe7c969 })
    if (item.id === model.selectedItemId) addSelectionGlow(layer, centerX - 37, centerY - 37, 74, 74)
  })
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  if (pages > 1) {
    addShopScrollControl(context, layer, '<', 690, top + 382)
    addShopScrollControl(context, layer, '>', 820, top + 382)
  }
  addBitmapText(context, layer, `PAGE ${model.page + 1} / ${pages}`, 'medium', 800, top + 371, { tint: 0xc9b986 })
  addNativeButton(context, layer, 'DONE', left + width - 150, top + 425, 120, 48)
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
  const left = 360
  const top = 205
  const width = 880
  const height = 390
  addLeatherPanel(context, noticeLayer, left, top, width, height)
  addBitmapText(context, noticeLayer, notice.title, 'menu', 800, top + 62, { tint: 0xe6c76c })
  addBitmapText(context, noticeLayer, notice.body, 'body', left + 85, top + 135, {
    align: 'left',
    lineHeight: 27,
    maxWidth: width - 170,
    tint: 0xf1ead5,
  })
  addNativeButton(context, noticeLayer, notice.actionLabel, 690, top + 305, 220, 56)
  layer.addChild(noticeLayer)
}

function buildInventoryShop(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): void {
  const left = 155
  const top = 45
  const width = 1290
  const height = 810
  addLeatherPanel(context, layer, left, top, width, height)
  addBitmapText(context, layer, HUB_TRADER_DIALOGUES.luthacus.title, 'menu', 800, top + 48, { tint: 0xe6c76c })
  addBitmapText(context, layer, 'BACKPACK', 'menu', 470, top + 108, { tint: 0xaaa2a6 })
  addBitmapText(context, layer, 'SCAVENGED GOODS', 'menu', 1130, top + 108, { tint: 0xaaa2a6 })
  addInventoryShopCollection(context, layer, model.economy.backpack, 230, top + 145, model.selectedItemId, model.selectedOwner === 'backpack')
  addInventoryShopCollection(context, layer, model.economy.storage, 890, top + 145, model.selectedItemId, model.selectedOwner === 'storage')
  const selected = selectedInventoryItem(model)
  if (selected) {
    addBitmapText(context, layer, selected.name.toUpperCase(), 'body', 800, top + 610, { tint: 0xf3ead1 })
    addNativeButton(context, layer, model.selectedOwner === 'backpack' ? 'STORE' : 'TAKE', 680, top + 650, 240, 54)
  }
  addGold(context, layer, model.economy.gold, left + 28, top + 735)
  addNativeButton(context, layer, 'DONE', left + width - 155, top + 735, 125, 48)
}

function addInventoryShopCollection(
  context: RenderContext,
  layer: Container,
  items: readonly HubInventoryItem[],
  left: number,
  top: number,
  selectedItemId: number | null,
  selectedOwner: boolean,
): void {
  for (let index = 0; index < 28; index += 1) {
    const x = left + (index % 7) * 76
    const y = top + Math.floor(index / 7) * 76
    addAtlasSprite(context, layer, 'Inventory', 10, x, y, { scale: 0.9375 })
    const item = items[index]
    if (item) {
      addItemIcon(context, layer, item, x + 33.75, y + 33.75, 57)
      if (item.quantity > 1) {
        addBitmapText(context, layer, `${item.quantity}`, 'medium', x + 56, y + 51, {
          tint: 0xf4e5b4,
        })
      }
    }
    if (item?.id === selectedItemId && selectedOwner) addSelectionGlow(layer, x, y, 67.5, 67.5)
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

function selectedInventoryItem(model: Extract<HubInventoryRendererModel, { kind: 'service' }>): HubInventoryItem | null {
  if (model.selectedItemId === null || !model.selectedOwner) return null
  const items = model.selectedOwner === 'backpack' ? model.economy.backpack : model.economy.storage
  return items.find((item) => item.id === model.selectedItemId) ?? null
}

function equipmentSlotLabel(slot: ReturnType<typeof equipmentSlotsForItem>[number]): string {
  switch (slot) {
    case 'amulet': return 'AMULET'
    case 'hat': return 'HAT'
    case 'ring-0': return 'RING I'
    case 'ring-1': return 'RING II'
    case 'ring-2': return 'RING III'
    case 'robe': return 'ROBE'
    case 'weapon': return 'WEAPON'
  }
}

function addLeatherPanel(
  context: RenderContext,
  layer: Container,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  const shadow = new Graphics().rect(left + 8, top + 10, width, height).fill({ color: 0x000000, alpha: 0.8 })
  layer.addChild(shadow)
  addTiledAtlas(context, layer, 'UI', 49, left, top, width, height)
  const shade = new Graphics().rect(left, top, width, height).fill({ color: 0x080706, alpha: 0.32 })
  layer.addChild(shade)
  addHorizontalChain(context, layer, left + 8, top - 7, width - 16)
  addHorizontalChain(context, layer, left + 8, top + height - 13, width - 16)
  addVerticalChain(context, layer, left - 5, top + 8, height - 16)
  addVerticalChain(context, layer, left + width - 17, top + 8, height - 16)
  addAtlasSprite(context, layer, 'UI', 107, left - 17, top - 18)
  addAtlasSprite(context, layer, 'UI', 108, left + width - 68, top - 18)
  addAtlasSprite(context, layer, 'UI', 109, left - 17, top + height - 68)
  addAtlasSprite(context, layer, 'UI', 110, left + width - 68, top + height - 68)
}

function addHorizontalChain(context: RenderContext, layer: Container, x: number, y: number, width: number): void {
  addTiledAtlas(context, layer, 'UI', 10, x, y, width, 24, 1.25)
}

function addVerticalChain(context: RenderContext, layer: Container, x: number, y: number, height: number): void {
  addTiledAtlas(context, layer, 'UI', 79, x, y, 27, height, 1.25)
}

function addInset(_context: RenderContext, layer: Container, x: number, y: number, width: number, height: number): void {
  layer.addChild(new Graphics().rect(x, y, width, height).fill({ color: 0x080807, alpha: 0.9 }))
  layer.addChild(new Graphics().rect(x, y, width, height).stroke({ color: 0xb99b55, width: 2 }))
}

function addNativeButton(
  context: RenderContext,
  layer: Container,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  layer.addChild(new Graphics().rect(x, y, width, height).fill({ color: 0x090806, alpha: 0.92 }))
  layer.addChild(new Graphics().rect(x, y, width, height).stroke({ color: 0xb99b55, width: 2 }))
  addBitmapText(context, layer, label, 'medium', x + width / 2, y + height / 2 - 5, { tint: 0xf0d77e })
}

function addShopScrollControl(
  context: RenderContext,
  layer: Container,
  label: string,
  x: number,
  y: number,
): void {
  const decoration = addAtlasSprite(context, layer, 'Skills', 4, x - 22.5, y + 7, { scale: 1 })
  decoration.alpha = 0.58
  decoration.tint = 0xbda45f
  addBitmapText(context, layer, label, 'medium', x + 45, y + 14, { tint: 0xf0d77e })
}

function addGold(context: RenderContext, layer: Container, gold: number, x: number, y: number): void {
  addAtlasSprite(context, layer, 'UI', 21, x, y, { scale: 0.62 })
  addBitmapText(context, layer, gold.toLocaleString(), 'body', x + 42, y + 20, { align: 'left', tint: 0xffffff })
}

function addSelectionGlow(layer: Container, x: number, y: number, width: number, height: number): void {
  const glow = new Graphics()
    .rect(x - 2, y - 2, width + 4, height + 4)
    .stroke({ color: 0xf0d56f, width: 3 })
  glow.label = 'native-selection-glow'
  layer.addChild(glow)
}

function addNativeSeal(
  context: RenderContext,
  layer: Container,
  x: number,
  y: number,
  scale: number,
  alpha: number,
): void {
  for (let index = 0; index < 8; index += 1) {
    const rotation = index * Math.PI / 4
    const arc = addAtlasSprite(context, layer, 'UI', 3, x, y, { anchor: 0.5, scale })
    arc.alpha = alpha
    arc.rotation = rotation
    arc.label = `native-seal:${rotation}`
  }
}

function addItemIcon(
  context: RenderContext,
  layer: Container,
  item: Pick<HubInventoryItem, 'iconRecords'>,
  centerX: number,
  centerY: number,
  fit: number,
): void {
  for (const record of item.iconRecords) {
    const definition = TRADER_ASSETS.atlases.Inventory.records[`${record}`]
    if (!definition) continue
    const scale = Math.min(1.25, fit / Math.max(...definition.logicalSize))
    addAtlasSprite(context, layer, 'Inventory', record, centerX, centerY, { anchor: 0.5, scale })
  }
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
      const sprite = addAtlasSprite(context, layer, atlas, record, x + tileX, y + tileY, { scale })
      const remainingWidth = width - tileX
      const remainingHeight = height - tileY
      sprite.width = Math.min(tileWidth, remainingWidth)
      sprite.height = Math.min(tileHeight, remainingHeight)
    }
  }
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

function addBitmapText(
  context: RenderContext,
  layer: Container,
  text: string,
  fontName: FontName,
  x: number,
  y: number,
  options: {
    readonly align?: 'center' | 'left'
    readonly lineHeight?: number
    readonly maxWidth?: number
    readonly tint?: number
  } = {},
): void {
  const font = FONT_ASSETS.fonts[fontName]
  const lines = wrapBitmapText(text, font, options.maxWidth ?? Number.POSITIVE_INFINITY)
  const lineHeight = options.lineHeight ?? font.metrics[0]
  lines.forEach((line, lineIndex) => {
    const width = measureBitmapText(line, font)
    let cursor = options.align === 'left' ? x : x - width / 2
    let previous = -1
    for (const character of line) {
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
      sprite.tint = options.tint ?? 0xffffff
      sprite.position.set(cursor + glyph.metrics[1], y + lineIndex * lineHeight + glyph.metrics[2])
      layer.addChild(sprite)
      cursor += glyph.metrics[0]
      previous = code
    }
  })
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
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && measureBitmapText(next, font) > maxWidth) {
      lines.push(current)
      current = word
    } else current = next
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
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
