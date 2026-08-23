import {
  Container,
  Graphics,
  NineSliceSprite,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
} from 'pixi.js'

import nativeAssetsJson from '../../assets/game/skill-picker-native-assets.json' with { type: 'json' }
import { skillPicker } from '../../lib/assets.ts'
import {
  NATIVE_SKILL_CATALOG,
  SPELL_WELDING_QUICK_DESCRIPTION,
  SPELL_WELDING_SKILL_ID,
  nativeWeldBuild,
  type NativeSkillCatalogEntry,
} from '../core-kernels/player-progression.ts'
import type {
  ProtocolPlayerSkillOffer,
  ProtocolPlayerSkillOfferOption,
} from '../protocol/game-state.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
  type GameTextureMap,
  type GameWebGlApplication,
} from './game-webgl.ts'
import {
  SKILL_PICKER_CARD_FRAME,
  SKILL_PICKER_ICON_ANCHOR_OFFSET,
  SKILL_PICKER_PANEL,
  SKILL_PICKER_SIZE,
  skillPickerCardCenters,
  skillPickerPanelBounds,
  skillPickerSpecialActionBounds,
} from './skill-picker-render-contract.ts'
import type { NativeSkillPickerReveal } from './level-up-presentation.ts'

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

interface NativeAssets {
  readonly atlases: Readonly<Record<'Fonts' | 'Skills' | 'UI', {
    readonly records: Readonly<Record<string, AtlasRecord>>
  }>>
  readonly fonts: Readonly<Record<'body' | 'medium' | 'menu' | 'skill', BitmapFont>>
}

interface AnimatedCorner {
  readonly baseX: number
  readonly baseY: number
  readonly directionX: -1 | 1
  readonly directionY: -1 | 1
  readonly sprite: Sprite
}

export interface SkillPickerRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(
    nowMs: number,
    selectedIndex: number,
    reveal: NativeSkillPickerReveal,
  ): void
  setContentVisible(visible: boolean): void
  setOffer(offer: ProtocolPlayerSkillOffer, specialActionsAvailable: boolean): void
}

const NATIVE_ASSETS = nativeAssetsJson as unknown as NativeAssets

export async function createSkillPickerRenderer(): Promise<SkillPickerRenderer> {
  let gpu: GameWebGlApplication | undefined
  let textures: GameTextureMap | undefined
  try {
    ;[gpu, textures] = await Promise.all([
      createGameWebGlApplication({
        backgroundAlpha: 0,
        className: 'skill-picker-canvas',
        height: SKILL_PICKER_SIZE.height,
        resolution: 1,
        width: SKILL_PICKER_SIZE.width,
      }),
      loadGameTextureMap([
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
  const ambient = new Container()
  const panelLayer = new Container()
  const chromeLayer = new Container()
  const offerLayer = new Container()
  const dimmer = new Graphics().rect(0, 0, 1600, 900).fill({ color: 0x000000 })
  dimmer.alpha = 0
  ambient.alpha = 0
  panelLayer.alpha = 0
  chromeLayer.alpha = 0
  offerLayer.alpha = 0
  root.addChild(dimmer, ambient, panelLayer, chromeLayer, offerLayer)
  application.stage.addChild(root)

  const arcSprites: Sprite[] = []
  for (let index = 0; index < 8; index += 1) {
    const arc = spriteFor(resources, 'UI', 3)
    arc.anchor.set(0.5)
    arc.position.set(800, 450)
    arc.scale.set(1.9)
    arc.rotation = index * Math.PI / 4
    arcSprites.push(arc)
    ambient.addChild(arc)
  }
  const ringSprites: Sprite[] = []
  for (const centerY of [350, 550]) {
    const ring = spriteFor(resources, 'UI', 62)
    ring.anchor.set(0.5)
    ring.position.set(800, centerY)
    ring.scale.set(1.6)
    ringSprites.push(ring)
    ambient.addChild(ring)
  }
  const heading = spriteFor(resources, 'UI', 37)
  heading.anchor.set(0.5)
  heading.position.set(800, 215)
  chromeLayer.addChild(heading)
  const instruction = spriteFor(resources, 'UI', 59)
  instruction.anchor.set(0.5)
  instruction.position.set(800, 655.5)
  chromeLayer.addChild(instruction)

  let animatedCorners: AnimatedCorner[] = []
  let selectionPanels: NineSliceSprite[] = []
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let destroyed = false

  return {
    canvas: gpu.canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.destroy({ removeView: true })
      resources.destroy()
    },
    render(nowMs, selectedIndex, reveal) {
      if (destroyed) return
      dimmer.alpha = reveal.curtainAlpha
      ambient.alpha = reveal.ambientAlpha
      panelLayer.alpha = reveal.panelAlpha
      chromeLayer.alpha = reveal.panelAlpha
      offerLayer.alpha = reveal.panelAlpha
      const phase = reducedMotion ? 0 : nowMs / 1000
      for (let index = 0; index < arcSprites.length; index += 1) {
        arcSprites[index]!.rotation = index * Math.PI / 4 + phase * 0.08
      }
      for (const ring of ringSprites) ring.rotation = -phase * 0.04
      const cornerSpread = 3.75 + 3.75 * Math.sin(phase * 1.35)
      for (const corner of animatedCorners) {
        corner.sprite.position.set(
          corner.baseX + corner.directionX * cornerSpread,
          corner.baseY + corner.directionY * cornerSpread,
        )
      }
      heading.y = 215 + Math.sin(phase * 1.15) * 4.5
      instruction.y = 655.5 + Math.sin(phase * 1.15 + Math.PI) * 3
      for (let index = 0; index < selectionPanels.length; index += 1) {
        const selected = index === selectedIndex
        selectionPanels[index]!.alpha = selected
          ? 0.98 + Math.sin(phase * 5) * 0.02
          : 0.78
        selectionPanels[index]!.tint = selected ? 0xd9f5f6 : 0xffffff
      }
      application.renderer.render(application.stage)
    },
    setContentVisible(visible) {
      offerLayer.visible = visible
      application.renderer.render(application.stage)
    },
    setOffer(offer, specialActionsAvailable) {
      const panel = rebuildPanel(panelLayer, resources, offer.options.length)
      animatedCorners = panel.corners
      selectionPanels = panel.cards
      offerLayer.removeChildren().forEach((child) => child.destroy({ children: true }))
      const levelLine = `Y O U   A R E   N O W   L E V E L   ${offer.level}`
      for (let degrees = 0; degrees < 360; degrees += 45) {
        const radians = degrees * Math.PI / 180
        addBitmapText(
          offerLayer,
          resources,
          levelLine,
          'menu',
          800 + Math.cos(radians) * 5,
          262.5 + Math.sin(radians) * 5,
          { align: 'center', tint: 0x000000 },
        )
      }
      addBitmapText(
        offerLayer,
        resources,
        levelLine,
        'menu',
        800,
        262.5,
        { align: 'center', tint: 0xe0bd58 },
      )
      const centers = skillPickerCardCenters(offer.options.length)
      offer.options.forEach((option, index) => {
        const skill = NATIVE_SKILL_CATALOG[option.skillId]
        if (!skill) throw new Error(`skill picker has no catalog row ${option.skillId}`)
        addSkillCard(offerLayer, resources, skill, option, centers[index]!)
      })
      if (specialActionsAvailable) {
        const bounds = skillPickerSpecialActionBounds(offer.options.length)
        for (const [record, actionBounds] of [
          [57, bounds.save],
          [56, bounds.reroll],
        ] as const) {
          const action = spriteFor(resources, 'UI', record)
          action.anchor.set(0.5)
          action.position.set(
            actionBounds.left + actionBounds.width / 2,
            actionBounds.top + actionBounds.height / 2,
          )
          offerLayer.addChild(action)
        }
      }
      application.renderer.render(application.stage)
    },
  }
}

function addSkillCard(
  layer: Container,
  textures: GameTextureMap,
  skill: NativeSkillCatalogEntry,
  option: ProtocolPlayerSkillOfferOption,
  centerX: number,
): void {
  const aura = spriteFor(textures, 'Skills', 13)
  aura.anchor.set(0.5)
  aura.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
  aura.scale.set(1.15)
  layer.addChild(aura)

  const glow = spriteFor(textures, 'Skills', 164)
  glow.anchor.set(0.5)
  glow.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
  glow.scale.set(1.15)
  layer.addChild(glow)

  const frame = spriteFor(textures, 'Skills', 5)
  frame.anchor.set(0.5)
  frame.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
  layer.addChild(frame)

  const weldBuild = option.skillId === SPELL_WELDING_SKILL_ID
    ? nativeWeldBuild(option.weldBuildId ?? Number.NaN)
    : null
  if (option.skillId === SPELL_WELDING_SKILL_ID && !weldBuild) {
    throw new Error('Spell Welding choice has no native synthetic build')
  }
  if (option.skillId !== SPELL_WELDING_SKILL_ID && option.weldBuildId !== undefined) {
    throw new Error('ordinary skill choice carries a Spell Welding build')
  }
  const iconRecord = weldBuild?.skillsAtlasIconRecord ?? skill.skills_atlas_icon_record
  const shadow = spriteFor(textures, 'Skills', iconRecord)
  shadow.anchor.set(0.5)
  shadow.position.set(
    centerX + SKILL_PICKER_ICON_ANCHOR_OFFSET.x,
    SKILL_PICKER_CARD_FRAME.y + SKILL_PICKER_ICON_ANCHOR_OFFSET.y,
  )
  shadow.tint = 0x062932
  shadow.alpha = 0.92
  layer.addChild(shadow)
  const icon = spriteFor(textures, 'Skills', iconRecord)
  icon.anchor.set(0.5)
  icon.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
  layer.addChild(icon)

  const name = `${skill.name}${option.targetRank > 1 ? ` ${option.targetRank}` : ''}`.toUpperCase()
  const tint = skillTextTint(skill.family)
  addBitmapText(layer, textures, name, 'medium', centerX, 449, {
    align: 'center',
    tint,
  })
  addBitmapText(layer, textures, skill.family.toUpperCase(), 'skill', centerX, 468, {
    align: 'center',
    tint,
  })
  const quickDescription = weldBuild
    ? SPELL_WELDING_QUICK_DESCRIPTION
    : skill.config?.mQDescription ?? skill.config?.mDescription ?? ''
  addBitmapText(layer, textures, quickDescription.toUpperCase(), 'medium', centerX, 506, {
    align: 'center',
    lineHeight: 18,
    maxWidth: 110,
    tint: 0xffffff,
  })
}

function rebuildPanel(
  layer: Container,
  textures: GameTextureMap,
  optionCount: number,
): { cards: NineSliceSprite[]; corners: AnimatedCorner[] } {
  layer.removeChildren().forEach((child) => child.destroy({ children: true }))
  const bounds = skillPickerPanelBounds(optionCount)
  const backgroundRecord = NATIVE_ASSETS.atlases.UI.records['49']!
  const background = new TilingSprite({
    height: bounds.height,
    texture: textureFor(textures, 'UI', 49),
    tileScale: {
      x: bounds.width / (5 * backgroundRecord.logicalSize[0]),
      y: bounds.height / (2 * backgroundRecord.logicalSize[1]),
    },
    width: bounds.width,
  })
  background.position.set(bounds.left, bounds.top)
  layer.addChild(background)

  const topChain = new TilingSprite({
    height: 19,
    texture: textureFor(textures, 'UI', 10),
    width: bounds.width - 20,
  })
  topChain.position.set(bounds.left + 10, bounds.top - 2)
  const bottomChain = new TilingSprite({
    height: 19,
    texture: textureFor(textures, 'UI', 10),
    width: bounds.width - 20,
  })
  bottomChain.position.set(bounds.left + 10, bounds.top + bounds.height - 15)
  const leftChain = new TilingSprite({
    height: bounds.height - 20,
    texture: textureFor(textures, 'UI', 79),
    width: 21,
  })
  leftChain.position.set(bounds.left, bounds.top + 10)
  const rightChain = new TilingSprite({
    height: bounds.height - 20,
    texture: textureFor(textures, 'UI', 79),
    width: 21,
  })
  rightChain.position.set(bounds.left + bounds.width - 17, bounds.top + 10)
  layer.addChild(topChain, bottomChain, leftChain, rightChain)

  const baseLeft = bounds.left + 37
  const baseRight = bounds.left + bounds.width - 37
  const baseTop = bounds.top + 37
  const baseBottom = bounds.top + bounds.height - 37
  const cornerDefinitions = [
    { baseX: baseLeft, baseY: baseTop, directionX: -1, directionY: -1, record: 107 },
    { baseX: baseRight, baseY: baseTop, directionX: 1, directionY: -1, record: 108 },
    { baseX: baseLeft, baseY: baseBottom, directionX: -1, directionY: 1, record: 109 },
    { baseX: baseRight, baseY: baseBottom, directionX: 1, directionY: 1, record: 110 },
  ] as const
  const corners = cornerDefinitions.map((definition): AnimatedCorner => {
    const sprite = spriteFor(textures, 'UI', definition.record)
    sprite.anchor.set(0.5)
    sprite.position.set(definition.baseX, definition.baseY)
    layer.addChild(sprite)
    return { ...definition, sprite }
  })

  const cards = skillPickerCardCenters(optionCount).map((centerX) => {
    const card = new NineSliceSprite({
      bottomHeight: 30,
      height: SKILL_PICKER_PANEL.cardHeight,
      leftWidth: 30,
      rightWidth: 30,
      texture: textureFor(textures, 'Skills', 0),
      topHeight: 30,
      width: SKILL_PICKER_PANEL.cardWidth,
    })
    card.position.set(centerX - SKILL_PICKER_PANEL.cardWidth / 2, SKILL_PICKER_PANEL.cardTop)
    layer.addChild(card)
    return card
  })
  return { cards, corners }
}

function skillTextTint(family: string): number {
  switch (family.toLowerCase()) {
    case 'fire': return 0xf0b5bd
    case 'water': return 0xb8dcf2
    case 'air': return 0xc5eef2
    case 'earth': return 0xc8d9b4
    case 'ether': return 0xd9c3ed
    case 'mind': return 0xd4def5
    case 'arcane': return 0xdeccef
    default: return 0xf0e9df
  }
}

export function spriteFor(
  textures: GameTextureMap,
  atlas: 'Fonts' | 'Skills' | 'UI',
  record: number,
): Sprite {
  return new Sprite(textureFor(textures, atlas, record))
}

export function textureFor(
  textures: GameTextureMap,
  atlas: 'Fonts' | 'Skills' | 'UI',
  record: number,
): Texture {
  const atlasRecord = NATIVE_ASSETS.atlases[atlas].records[`${record}`]
  if (!atlasRecord) throw new Error(`native ${atlas}.${record} was not extracted`)
  const source = textureFrom(textures.textures, atlas === 'Fonts'
    ? skillPicker.fontsAtlas
    : atlas === 'Skills'
      ? skillPicker.skillsAtlas
      : skillPicker.uiAtlas)
  const [x, y, width, height] = atlasRecord.frame
  const [logicalWidth, logicalHeight] = atlasRecord.logicalSize
  const [trimX, trimY] = atlasRecord.trimOrigin
  return new Texture({
    frame: new Rectangle(x, y, width, height),
    orig: new Rectangle(0, 0, logicalWidth, logicalHeight),
    source: source.source,
    trim: new Rectangle(trimX, trimY, width, height),
  })
}

export function addBitmapText(
  layer: Container,
  textures: GameTextureMap,
  text: string,
  fontName: keyof NativeAssets['fonts'],
  x: number,
  y: number,
  options: {
    align?: 'center' | 'left'
    lineHeight?: number
    maxWidth?: number
    tint?: number
  } = {},
): void {
  const font = NATIVE_ASSETS.fonts[fontName]
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
      const sprite = spriteForGlyph(textures, glyph)
      sprite.anchor.set(0.5)
      sprite.tint = options.tint ?? 0xffffff
      sprite.position.set(
        cursor + glyph.metrics[1],
        y + lineIndex * lineHeight + glyph.metrics[2],
      )
      layer.addChild(sprite)
      cursor += glyph.metrics[0]
      previous = code
    }
  })
}

function spriteForGlyph(textures: GameTextureMap, glyph: AtlasRecord): Sprite {
  const source = textureFrom(textures.textures, skillPicker.fontsAtlas)
  const [x, y, width, height] = glyph.frame
  return new Sprite(new Texture({
    frame: new Rectangle(x, y, width, height),
    source: source.source,
  }))
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

export function measureNativeBitmapText(
  text: string,
  fontName: keyof NativeAssets['fonts'],
): number {
  return measureBitmapText(text, NATIVE_ASSETS.fonts[fontName])
}

function kerning(font: BitmapFont, first: number, second: number): number {
  if (first < 0) return 0
  return font.kerning.find(([left, right]) => left === first && right === second)?.[2] ?? 0
}
