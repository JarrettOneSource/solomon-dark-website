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
  readonly economy: ProtocolPlayerEconomy
  readonly hoveredSkillId: number | null
  readonly openProgress: number
  readonly placements: readonly NativeSkillBookPagePlacement[]
  readonly progression: ProtocolPlayerProgression
  readonly targetBeltSlot: number
}

export interface SkillBookRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  setPresentation(presentation: SkillBookRendererPresentation): void
}

const NATIVE_ASSETS = nativeAssetsJson as unknown as NativeAssets
const BELT_SLOT_X = [468, 528, 588, 648, 898, 958, 1018, 1078] as const
const BELT_SLOT_Y = 832.5

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
      addShadowedText(content, resources, 'SKILLS', 'medium', 800, 19, 0xffffff)
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
      drawSkillBelt(content, resources, presentation)
      drawInventoryHud(content, resources, presentation.economy)
      application.renderer.render(application.stage)
    },
  }
}

function drawInventoryHud(
  layer: Container,
  textures: GameTextureMap,
  economy: ProtocolPlayerEconomy,
): void {
  const image = (
    source: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
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
  const subtype = kind === 'health-potion' ? 0 : 1
  return economy.backpack
    .filter((item) => item.nativeTypeId === 7001 && item.nativeSubtype === subtype)
    .reduce((total, item) => total + item.quantity, 0)
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

  const topChain = new TilingSprite({
    height: 19,
    texture: textureFor(textures, 'UI', 10),
    width: 1600,
  })
  topChain.position.set(0, 44)
  const bottomChain = new TilingSprite({
    height: 19,
    texture: textureFor(textures, 'UI', 10),
    width: 1600,
  })
  bottomChain.position.set(0, 807)
  layer.addChild(topChain, bottomChain)

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
  if (row.id === 52 && !weldBuild) {
    throw new Error('learned Spell Welding row has no active native build')
  }
  const card = new NineSliceSprite({
    bottomHeight: 20,
    height: 280,
    leftWidth: 20,
    rightWidth: 20,
    texture: textureFor(textures, 'Skills', weldBuild ? 14 : 5),
    topHeight: 20,
    width: 180,
  })
  card.position.set(centerX - 90, centerY - 45)
  card.tint = row.id === presentation.progression.primarySkillId ? 0x8b708c : 0x5e565f
  card.alpha = 0.72
  layer.addChild(card)

  if (weldBuild) addWeldGlow(layer, textures, weldBuild.colorRoots, centerX, centerY)
  else {
    const rootGlow = spriteFor(textures, 'Skills', 164)
    rootGlow.anchor.set(0.5)
    rootGlow.position.set(centerX, centerY)
    rootGlow.tint = skillPickerRootTint(nativeSkillRoot(row.id))
    rootGlow.alpha = 0.45
    layer.addChild(rootGlow)
  }

  const selectedPrimary = row.id === presentation.progression.primarySkillId
  const selectedConcentration = presentation.progression.concentrationSkillIds.includes(row.id)
  const borderTint = selectedPrimary || selectedConcentration
    ? 0x75cf79
    : row.category === 2 ? 0xe8ca65 : 0x8f8790
  layer.addChild(new Graphics()
    .rect(centerX - 43, centerY - 43, 86, 86)
    .stroke({ color: borderTint, width: 3 }))

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
    presentation.hoveredSkillId === row.id ? 0xffffff : 0xdedede,
    145,
  )
  const footer = selectedPrimary
    ? 'PRIMARY CAST'
    : selectedConcentration
      ? 'CONCENTRATION'
      : row.category === 2 ? 'SECONDARY CAST' : ''
  if (footer) addShadowedText(layer, textures, footer, 'skill', centerX, centerY + 205, 0xffffff)
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

function drawSkillBelt(
  layer: Container,
  textures: GameTextureMap,
  presentation: SkillBookRendererPresentation,
): void {
  presentation.progression.secondaryBelt.forEach((skillId, slot) => {
    const x = BELT_SLOT_X[slot]!
    const back = new Graphics()
      .rect(x, BELT_SLOT_Y, 53, 53)
      .fill({ color: 0x050505, alpha: 0.78 })
      .stroke({ color: 0x8a7440, width: 2 })
    layer.addChild(back)
    if (skillId !== null) {
      const row = presentation.placements
        .flatMap(({ page }) => page.rows)
        .find(({ id }) => id === skillId)
      if (row) {
        const icon = spriteFor(textures, 'Skills', row.iconRecord)
        icon.anchor.set(0.5)
        icon.position.set(x + 26.5, BELT_SLOT_Y + 26.5)
        icon.alpha = 0.375
        layer.addChild(icon)
      }
    }
    if (slot === presentation.targetBeltSlot) {
      const target = new Graphics()
        .rect(x - 3, BELT_SLOT_Y - 3, 59, 59)
        .stroke({ color: 0x75cf79, width: 1 })
      layer.addChild(target)
    }
    if (slot === 0) {
      const mouse = new Sprite(textureFrom(textures.textures, hub.hud.mouseRight))
      mouse.position.set(x + 15.5, BELT_SLOT_Y + 44.5)
      mouse.width = 22
      mouse.height = 31
      layer.addChild(mouse)
    } else {
      addShadowedText(layer, textures, `${slot}`, 'body', x + 48, BELT_SLOT_Y + 49, 0xffffff)
    }
  })
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
