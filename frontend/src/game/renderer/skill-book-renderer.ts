import {
  Container,
  Graphics,
  MeshSimple,
  NineSliceSprite,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
} from 'pixi.js'

import nativeAssetsJson from '../../assets/game/skill-picker-native-assets.json' with { type: 'json' }
import { hub, skillPicker } from '../../lib/assets.ts'
import {
  NATIVE_SKILL_CATALOG,
  nativeSkillRoot,
  nativeWeldBuild,
} from '../core-kernels/player-progression.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from '../protocol/game-state.ts'
import type {
  NativeSkillBookPagePlacement,
  NativeSkillBookRow,
} from '../skill-book-model.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
  type GameTextureMap,
} from './game-webgl.ts'
import {
  addBitmapText,
  spriteFor,
  textureFor,
} from './skill-picker-renderer.ts'
import { skillPickerRootTint } from './skill-picker-render-contract.ts'

interface NativeAssets {
  readonly fonts: Readonly<Record<'body' | 'medium' | 'menu' | 'skill', {
    readonly metrics: readonly [number, number, number]
  }>>
}

export interface SkillBookRendererPresentation {
  readonly draggedSkillId: number | null
  readonly economy: ProtocolPlayerEconomy
  readonly hoveredSkillId: number | null
  readonly openProgress: number
  readonly placements: readonly NativeSkillBookPagePlacement[]
  readonly progression: ProtocolPlayerProgression
  readonly targetQuickbarSlot: number
}

export interface SkillBookRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  setPresentation(presentation: SkillBookRendererPresentation): void
}

const NATIVE_ASSETS = nativeAssetsJson as unknown as NativeAssets
const QUICKBAR_SLOT_X = [468, 528, 588, 648, 898, 958, 1018, 1078] as const
const QUICKBAR_SLOT_Y = 832.5

export async function createSkillBookRenderer(): Promise<SkillBookRenderer> {
  let gpu: Awaited<ReturnType<typeof createGameWebGlApplication>> | undefined
  let textures: GameTextureMap | undefined
  try {
    ;[gpu, textures] = await Promise.all([
      createGameWebGlApplication({
        backgroundAlpha: 0,
        className: 'skill-book-canvas',
        height: 900,
        resolution: 1,
        width: 1600,
      }),
      loadGameTextureMap([
        hub.hud.mouseRight,
        hub.hud.backpack,
        hub.hud.inventoryDigits,
        hub.hud.potionBlue,
        hub.hud.potionRed,
        hub.hud.tome,
        hub.hud.xpFill,
        hub.hud.xpFrame,
        skillPicker.fontsAtlas,
        skillPicker.skillsAtlas,
        skillPicker.uiAtlas,
      ]),
    ])
  } catch (error) {
    gpu?.application.destroy({ removeView: true })
    textures?.destroy()
    throw error
  }

  const application = gpu.application
  const resources = textures
  const root = new Container()
  const content = new Container()
  const usesTouchHelp = window.matchMedia('(pointer: coarse)').matches
  root.addChild(content)
  application.stage.addChild(root)

  let destroyed = false
  return {
    canvas: gpu.canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.destroy({ removeView: true })
      resources.destroy()
    },
    setPresentation(presentation) {
      if (destroyed) return
      content.removeChildren().forEach((child) => child.destroy({ children: true }))
      root.alpha = presentation.openProgress ** 3
      drawSkillScreenChrome(content, resources)
      addShadowedText(content, resources, 'SKILLS', 'medium', 800, 53, 0xb6b2b4)
      for (const placement of presentation.placements) {
        drawSkillPage(content, resources, placement, presentation)
      }
      addShadowedText(
        content,
        resources,
        usesTouchHelp
          ? 'touch and hold a skill icon for more\ninformation about a skill.'
          : 'hover over a skill icon for more\ninformation about a skill.',
        'body',
        800,
        160,
        0xffffff,
      )
      addShadowedText(
        content,
        resources,
        'skills with a gold or green border\ncan be dragged into your belt',
        'body',
        800,
        690,
        0xffffff,
      )
      drawSkillQuickbar(content, resources, presentation)
      drawInventoryHud(content, resources, presentation.economy)
      drawHoveredTooltip(content, resources, presentation)
      application.renderer.render(application.stage)
    },
  }
}

function drawSkillScreenChrome(layer: Container, textures: GameTextureMap): void {
  layer.addChild(new Graphics().rect(0, 0, 1600, 900).fill(0x000000))
  const leather = new TilingSprite({
    height: 760,
    texture: textureFor(textures, 'UI', 49),
    width: 1600,
  })
  leather.position.set(0, 50)
  layer.addChild(leather)
  for (const [y, rotation] of [[-300, 0], [700, Math.PI]] as const) {
    const seal = spriteFor(textures, 'UI', 3)
    seal.anchor.set(0.5)
    seal.alpha = 0.16
    seal.position.set(800, y)
    seal.rotation = rotation
    layer.addChild(seal)
  }
  for (const y of [44, 807]) {
    const chain = new TilingSprite({
      height: 19,
      texture: textureFor(textures, 'UI', 10),
      width: 1600,
    })
    chain.position.set(0, y)
    layer.addChild(chain)
  }
  for (const right of [false, true]) {
    for (const bottom of [false, true]) {
      const bricks = spriteFor(textures, 'UI', 30)
      bricks.anchor.set(0.5)
      bricks.scale.set(right ? -1 : 1, bottom ? -1 : 1)
      bricks.position.set(right ? 1495 : 105, bottom ? 846 : 54)
      layer.addChild(bricks)
      const statue = spriteFor(textures, 'UI', bottom ? 32 : 31)
      statue.anchor.set(0.5)
      statue.scale.x = right ? -1 : 1
      statue.position.set(right ? 1530 : 70, bottom ? 814 : 86)
      layer.addChild(statue)
    }
  }
}

function drawSkillPage(
  layer: Container,
  textures: GameTextureMap,
  placement: NativeSkillBookPagePlacement,
  presentation: SkillBookRendererPresentation,
): void {
  placement.page.rows.forEach((row, index) => {
    const centerX = placement.x + (index === 0 ? 100 : 280 + 160 * (index - 1))
    const centerY = placement.y + 80
    if (index > 0) {
      const previousCenterX = placement.x + (index === 1 ? 100 : 280 + 160 * (index - 2))
      const arrow = spriteFor(textures, 'Skills', 6)
      arrow.anchor.set(0.5)
      arrow.position.set((previousCenterX + centerX) / 2, centerY)
      layer.addChild(arrow)
    }
    drawSkillEntry(layer, textures, row, centerX, centerY, presentation)
  })
}

function drawSkillEntry(
  layer: Container,
  textures: GameTextureMap,
  row: NativeSkillBookRow,
  centerX: number,
  centerY: number,
  presentation: SkillBookRendererPresentation,
): void {
  const weldBuild = row.weldBuildId === null ? null : nativeWeldBuild(row.weldBuildId)
  if (row.id === 52 && !weldBuild) throw new Error('learned Spell Welding has no native build')
  const card = new NineSliceSprite({
    bottomHeight: 20,
    height: 280,
    leftWidth: 20,
    rightWidth: 20,
    texture: textureFor(textures, 'Skills', 5),
    topHeight: 20,
    width: 180,
  })
  layer.addChild(new Graphics()
    .roundRect(centerX - 90, centerY - 45, 180, 280, 8)
    .fill({
      color: row.id === presentation.progression.selectedPrimarySkillId ? 0x6d526f : 0x3b333d,
      alpha: row.id === presentation.progression.selectedPrimarySkillId ? 0.58 : 0.42,
    }))
  card.position.set(centerX - 90, centerY - 45)
  card.tint = row.id === presentation.progression.selectedPrimarySkillId ? 0x8b708c : 0x5e565f
  card.alpha = 0.72
  layer.addChild(card)

  if (weldBuild) addWeldGlow(
    layer,
    textures,
    weldBuild.colorRoots,
    centerX,
    centerY,
  )
  else {
    const rootGlow = spriteFor(textures, 'Skills', 164)
    rootGlow.anchor.set(0.5)
    rootGlow.position.set(centerX, centerY)
    rootGlow.tint = skillPickerRootTint(nativeSkillRoot(row.id))
    rootGlow.alpha = 0.45
    layer.addChild(rootGlow)
  }

  const selectedPrimary = row.id === presentation.progression.selectedPrimarySkillId
  const selectedConcentration = presentation.progression.concentrationSkillIds.includes(row.id)
  const draggable = row.category === 1 || row.category === 2
  const frame = spriteFor(textures, 'Skills', draggable && !selectedPrimary ? 14 : 5)
  frame.anchor.set(0.5)
  frame.position.set(centerX, centerY)
  if (selectedPrimary) frame.tint = 0x75cf79
  else if (!draggable) frame.tint = 0x8f8790
  layer.addChild(frame)

  const iconRecord = weldBuild?.skillScreenIconRecord ?? row.iconRecord
  const iconShadow = spriteFor(textures, 'Skills', iconRecord)
  iconShadow.anchor.set(0.5)
  iconShadow.position.set(centerX + 2, centerY + 2)
  iconShadow.tint = 0x000000
  iconShadow.alpha = 0.75
  layer.addChild(iconShadow)
  const icon = spriteFor(textures, 'Skills', iconRecord)
  icon.anchor.set(0.5)
  icon.position.set(centerX, centerY)
  layer.addChild(icon)

  const name = weldBuild?.syntheticName ?? row.name
  const description = weldBuild?.pairDescription ?? row.description
  if (selectedPrimary) {
    addShadowedText(layer, textures, 'CASTING', 'skill', centerX, centerY - 48, 0x9ad89e)
  } else if (selectedConcentration) {
    addShadowedText(layer, textures, 'CONCENTRATING', 'skill', centerX, centerY - 48, 0x9ad89e)
  }
  addShadowedText(layer, textures, name.toUpperCase(), 'skill', centerX, centerY + 67, 0xffffff)
  addShadowedText(
    layer,
    textures,
    NATIVE_SKILL_CATALOG[row.id]?.family.toUpperCase() ?? '',
    'skill',
    centerX,
    centerY + 87,
    0xffffff,
  )
  addShadowedText(
    layer,
    textures,
    description.toUpperCase(),
    'body',
    centerX,
    centerY + 123,
    0xdedede,
    145,
  )
  const footer = row.category === 1
    ? 'PRIMARY CAST'
    : row.category === 2
      ? 'SECONDARY CAST'
      : row.category === 3
        ? 'CONCENTRATION'
        : ''
  if (footer) addShadowedText(layer, textures, footer, 'skill', centerX, centerY + 205, 0xffffff)
}

function drawHoveredTooltip(
  layer: Container,
  textures: GameTextureMap,
  presentation: SkillBookRendererPresentation,
): void {
  const hovered = presentation.hoveredSkillId
  if (hovered === null) return
  let row: NativeSkillBookRow | undefined
  let centerX = 800
  let centerY = 400
  for (const placement of presentation.placements) {
    const index = placement.page.rows.findIndex(({ id }) => id === hovered)
    if (index < 0) continue
    row = placement.page.rows[index]
    centerX = placement.x + (index === 0 ? 100 : 280 + 160 * (index - 1))
    centerY = placement.y + 80
    break
  }
  if (!row) return
  const skill = NATIVE_SKILL_CATALOG[row.id]
  if (!skill) return
  const title = row.name
  const description = skill.config?.mDescription ?? row.description
  const x = Math.min(1_225, Math.max(15, centerX - 180))
  const y = Math.min(540, Math.max(105, centerY - 250))
  const statLines = nativeTooltipStatLines(row)
  const height = 132 + statLines.length * 16
  layer.addChild(new Graphics()
    .rect(x, y, 360, height)
    .fill({ color: 0x000000, alpha: 0.94 }))
  addBitmapText(layer, textures, `${title} ${row.effectiveRank}/${maximumRank(row)}`.toUpperCase(), 'medium', x + 16, y + 15, {
    align: 'left',
    tint: 0xe2b4e5,
  })
  addBitmapText(layer, textures, categoryName(row.category), 'skill', x + 16, y + 40, {
    align: 'left',
    tint: 0xe2b4e5,
  })
  addBitmapText(layer, textures, description.toUpperCase(), 'body', x + 16, y + 60, {
    align: 'left',
    lineHeight: 14,
    maxWidth: 328,
    tint: 0xd7d4d7,
  })
  const statsY = y + 100
  statLines.forEach((line, index) => addBitmapText(
    layer,
    textures,
    line,
    'body',
    x + 24,
    statsY + index * 16,
    { align: 'left', tint: 0xd7d4d7 },
  ))
}

function nativeTooltipStatLines(row: NativeSkillBookRow): readonly string[] {
  const config = NATIVE_SKILL_CATALOG[row.id]?.config
  if (!config) return [`CURRENT LEVEL: ${row.effectiveRank}`]
  const lines = [`CURRENT LEVEL: ${row.effectiveRank}`]
  const labels: Readonly<Record<string, string>> = {
    mAbsorb: 'ABSORB',
    mChance: 'CHANCE',
    mCooldown: 'COOLDOWN',
    mDamage: 'DAMAGE',
    mDamage1: 'DAMAGE MINIMUM',
    mDamage2: 'DAMAGE MAXIMUM',
    mDuration: 'DURATION',
    mFreeze: 'FREEZE',
    mHP: 'HIT POINTS',
    mHoard: 'HOARD',
    mManaCost: 'MANA COST',
    mQuantity: row.id === 11 ? 'APPENDAGES: UP TO' : 'QUANTITY',
    mRadius: 'RADIUS',
    mSlow: 'SLOW',
  }
  for (const [property, label] of Object.entries(labels)) {
    const configured = config[property]
    if (typeof configured !== 'number' && !Array.isArray(configured)) continue
    const value = typeof configured === 'number'
      ? configured
      : configured[Math.min(row.effectiveRank, configured.length - 1)]
    if (typeof value === 'number') lines.push(`${label}: ${formatNativeNumber(value)}`)
    if (lines.length === 6) break
  }
  return lines
}

function maximumRank(row: NativeSkillBookRow): number {
  const config = NATIVE_SKILL_CATALOG[row.id]?.config
  return config?.mCapLevel && config.mCapLevel > 0
    ? config.mCapLevel
    : config?.mMaxLevel ?? row.effectiveRank
}

function categoryName(category: number): string {
  if (category === 1) return 'PRIMARY CAST'
  if (category === 2) return 'SECONDARY CAST'
  if (category === 3) return 'CONCENTRATION'
  return 'PASSIVE SKILL'
}

function formatNativeNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Math.round(value * 100) / 100}`
}

function addWeldGlow(
  layer: Container,
  textures: GameTextureMap,
  colorRoots: readonly [number, number],
  centerX: number,
  centerY: number,
): void {
  const half = 57 / 2
  const triangles = [
    { root: colorRoots[0], uvs: [0, 0, 1, 0, 0, 1], vertices: [-half, -half, half, -half, -half, half] },
    { root: colorRoots[1], uvs: [1, 0, 0, 1, 1, 1], vertices: [half, -half, -half, half, half, half] },
  ] as const
  for (const triangle of triangles) {
    const mesh = new MeshSimple({
      indices: new Uint32Array([0, 1, 2]),
      texture: textureFor(textures, 'Skills', 164),
      topology: 'triangle-list',
      uvs: new Float32Array(triangle.uvs),
      vertices: new Float32Array(triangle.vertices),
    })
    mesh.autoUpdate = false
    mesh.eventMode = 'none'
    mesh.position.set(centerX, centerY)
    mesh.tint = skillPickerRootTint(triangle.root)
    mesh.alpha = 0.45
    layer.addChild(mesh)
  }
}

function drawSkillQuickbar(
  layer: Container,
  textures: GameTextureMap,
  presentation: SkillBookRendererPresentation,
): void {
  presentation.progression.skillQuickbar.forEach((skillId, slot) => {
    const x = QUICKBAR_SLOT_X[slot]!
    const occupied = skillId !== null
    const selectedPrimary = skillId === presentation.progression.selectedPrimarySkillId
    layer.addChild(new Graphics()
      .rect(x, QUICKBAR_SLOT_Y, 53, 53)
      .fill({ color: 0x050505, alpha: 0.78 })
      .stroke({ color: selectedPrimary ? 0x75cf79 : 0x8a7440, width: occupied ? 2 : 1 }))
    if (skillId !== null) {
      const row = presentation.placements
        .flatMap(({ page }) => page.rows)
        .find(({ id }) => id === skillId)
      if (row) {
        const weld = row.weldBuildId === null ? null : nativeWeldBuild(row.weldBuildId)
        const icon = spriteFor(textures, 'Skills', weld?.skillsAtlasIconRecord ?? row.iconRecord)
        icon.anchor.set(0.5)
        icon.position.set(x + 26.5, QUICKBAR_SLOT_Y + 26.5)
        icon.alpha = 0.375
        layer.addChild(icon)
      }
    }
    if (presentation.draggedSkillId !== null && slot === presentation.targetQuickbarSlot) {
      layer.addChild(new Graphics()
        .rect(x - 3, QUICKBAR_SLOT_Y - 3, 59, 59)
        .stroke({ color: 0x75cf79, width: 1 }))
    }
    if (slot === 0) {
      const mouse = new Sprite(textureFrom(textures.textures, hub.hud.mouseRight))
      mouse.position.set(x + 15.5, QUICKBAR_SLOT_Y + 44.5)
      mouse.width = 22
      mouse.height = 31
      layer.addChild(mouse)
    } else {
      addShadowedText(layer, textures, `${slot}`, 'body', x + 48, QUICKBAR_SLOT_Y + 49, 0xffffff)
    }
  })
}

function drawInventoryHud(
  layer: Container,
  textures: GameTextureMap,
  economy: ProtocolPlayerEconomy,
): void {
  const image = (source: string, x: number, y: number, width: number, height: number) => {
    const sprite = new Sprite(textureFrom(textures.textures, source))
    sprite.position.set(x, y)
    sprite.width = width
    sprite.height = height
    layer.addChild(sprite)
  }
  image(hub.hud.potionRed, 651, 833, 53, 50)
  image(hub.hud.backpack, 734, 824, 58, 62)
  image(hub.hud.xpFill, 801.5, 832, 4, 48)
  image(hub.hud.xpFrame, 798, 828, 12, 56)
  image(hub.hud.tome, 814, 824, 58, 62)
  image(hub.hud.potionBlue, 903, 833, 50, 49)
  const counts = [
    { count: inventoryQuantity(economy, 'health-potion'), x: 672 },
    { count: inventoryQuantity(economy, 'mana-potion'), x: 923 },
  ]
  const digitTexture = textureFrom(textures.textures, hub.hud.inventoryDigits)
  for (const { count, x } of counts) {
    const frame = new Rectangle(Math.min(9, Math.max(0, count)) * 8, 0, 8, 14)
    const digit = new Sprite(new Texture({ source: digitTexture.source, frame }))
    digit.position.set(x, 885)
    layer.addChild(digit)
  }
}

function inventoryQuantity(
  economy: ProtocolPlayerEconomy,
  kind: 'health-potion' | 'mana-potion',
): number {
  return economy.backpack.reduce((total, item) => (
    item.kind === kind ? total + item.quantity : total
  ), 0)
}

function addShadowedText(
  layer: Container,
  textures: GameTextureMap,
  text: string,
  font: 'body' | 'medium' | 'menu' | 'skill',
  x: number,
  y: number,
  tint: number,
  maxWidth = Number.POSITIVE_INFINITY,
): void {
  const lineHeight = NATIVE_ASSETS.fonts[font].metrics[0]
  addBitmapText(layer, textures, text, font, x + 2, y + 2, {
    lineHeight,
    maxWidth,
    tint: 0x000000,
  })
  addBitmapText(layer, textures, text, font, x, y, { lineHeight, maxWidth, tint })
}
