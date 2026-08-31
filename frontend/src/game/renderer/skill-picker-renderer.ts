import {
  Container,
  MeshSimple,
  NineSliceSprite,
  Sprite,
  TilingSprite,
  type Texture,
} from 'pixi.js'

import { skillPicker } from '../../lib/assets.ts'
import type {
  ProtocolPlayerSkillOffer,
  ProtocolPlayerSkillOfferOption,
} from '../protocol/game-state.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  type GameTextureMap,
  type GameWebGlApplication,
} from './game-webgl.ts'
import {
  SKILL_PICKER_CARD_FRAME,
  SKILL_PICKER_CARD_TEXT,
  SKILL_PICKER_ICON_ANCHOR_OFFSET,
  SKILL_PICKER_INSIGHT_LABEL_Y,
  SKILL_PICKER_INSIGHT_TINT,
  SKILL_PICKER_PANEL,
  SKILL_PICKER_SIZE,
  skillPickerCardPresentation,
  skillPickerCardCenters,
  skillPickerDetailPresentation,
  skillPickerInsightAlpha,
  skillPickerPanelBounds,
  skillPickerSpecialActionBounds,
} from './skill-picker-render-contract.ts'
import { drawNativeSkillHoverBox } from './native-skill-hover-box.ts'
import type { NativeSkillPickerReveal } from './level-up-presentation.ts'
import { nativeUiRecord } from '../native-ui/core.ts'
import {
  destroyNativeUiPixiFor,
  nativeUiPixiFor,
} from '../native-ui/pixi.ts'
import { measureNativeUiText } from '../native-ui/core.ts'

interface AnimatedCorner {
  readonly baseX: number
  readonly baseY: number
  readonly directionX: -1 | 1
  readonly directionY: -1 | 1
  readonly sprite: Sprite
}

interface InsightCardTreatment {
  readonly cardIndex: number
  readonly container: Container
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
  setDetailOption(index: number | null): void
  setOffer(offer: ProtocolPlayerSkillOffer, specialActionsAvailable: boolean): void
}

export type SkillPickerFontName = 'body' | 'medium' | 'menu' | 'skill'

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
      loadGameTextureMap({
        stock: [
          skillPicker.fontsAtlas,
          skillPicker.skillsAtlas,
          skillPicker.uiAtlas,
        ],
      }),
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
  const detailLayer = new Container()
  ambient.alpha = 0
  panelLayer.alpha = 0
  chromeLayer.alpha = 0
  offerLayer.alpha = 0
  detailLayer.alpha = 0
  root.addChild(ambient, panelLayer, chromeLayer, offerLayer, detailLayer)
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
  let insightCardTreatments: InsightCardTreatment[] = []
  let insightPanels: NineSliceSprite[] = []
  let selectionPanels: NineSliceSprite[] = []
  let displayedOffer: ProtocolPlayerSkillOffer | null = null
  const nativeScreenStartedAtMs = performance.now()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let destroyed = false

  return {
    canvas: gpu.canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.destroy({ removeView: true })
      destroyNativeUiPixiFor(resources)
      resources.destroy()
    },
    render(nowMs, selectedIndex, reveal) {
      if (destroyed) return
      ambient.alpha = reveal.ambientAlpha
      panelLayer.alpha = reveal.panelAlpha
      chromeLayer.alpha = reveal.panelAlpha
      offerLayer.alpha = reveal.panelAlpha
      detailLayer.alpha = reveal.panelAlpha
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
      const insightAlpha = reducedMotion
        ? 0.5
        : skillPickerInsightAlpha(Math.floor((nowMs - nativeScreenStartedAtMs) / 10))
      for (const treatment of insightCardTreatments) {
        treatment.container.alpha = insightAlpha
        insightPanels[treatment.cardIndex]!.alpha = insightAlpha
      }
      application.renderer.render(application.stage)
    },
    setContentVisible(visible) {
      offerLayer.visible = visible
      detailLayer.visible = visible
      for (const treatment of insightCardTreatments) {
        insightPanels[treatment.cardIndex]!.visible = visible
      }
      application.renderer.render(application.stage)
    },
    setDetailOption(index) {
      detailLayer.removeChildren().forEach((child) => child.destroy({ children: true }))
      const option = index === null ? undefined : displayedOffer?.options[index]
      gpu.canvas.dataset.nativeDetailChoiceIndex = option ? `${index}` : ''
      gpu.canvas.dataset.nativeDetailSkillId = option ? `${option.skillId}` : ''
      if (option && index !== null && displayedOffer) {
        const detail = skillPickerDetailPresentation(option)
        drawNativeSkillHoverBox(detailLayer, resources, {
          lines: detail.lines,
          row: detail.row,
          sourceX: skillPickerCardCenters(displayedOffer.options.length)[index]!,
          sourceY: SKILL_PICKER_CARD_FRAME.y,
        })
      }
      application.renderer.render(application.stage)
    },
    setOffer(offer, specialActionsAvailable) {
      displayedOffer = offer
      detailLayer.removeChildren().forEach((child) => child.destroy({ children: true }))
      gpu.canvas.dataset.nativeDetailChoiceIndex = ''
      gpu.canvas.dataset.nativeDetailSkillId = ''
      const panel = rebuildPanel(panelLayer, resources, offer.options.length)
      animatedCorners = panel.corners
      insightPanels = panel.insightCards
      selectionPanels = panel.cards
      insightCardTreatments = []
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
        const insight = addSkillCard(offerLayer, resources, option, centers[index]!)
        insightPanels[index]!.visible = insight !== null
        if (insight !== null) {
          insightCardTreatments.push({ cardIndex: index, container: insight })
        }
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
  option: ProtocolPlayerSkillOfferOption,
  centerX: number,
): Container | null {
  const presentation = skillPickerCardPresentation(option)
  const aura = spriteFor(textures, 'Skills', 13)
  aura.anchor.set(0.5)
  aura.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
  aura.scale.set(1.15)
  layer.addChild(aura)

  if (presentation.glowTints.length === 2) {
    addWeldGlow(layer, textures, presentation.glowTints, centerX)
  } else {
    const glow = spriteFor(textures, 'Skills', 164)
    glow.anchor.set(0.5)
    glow.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
    glow.scale.set(1.15)
    glow.tint = presentation.rootTint
    layer.addChild(glow)
  }

  const frame = spriteFor(textures, 'Skills', presentation.frameRecord)
  frame.anchor.set(0.5)
  frame.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
  layer.addChild(frame)

  const shadow = spriteFor(textures, 'Skills', presentation.iconRecord)
  shadow.anchor.set(0.5)
  shadow.position.set(
    centerX + SKILL_PICKER_ICON_ANCHOR_OFFSET.x,
    SKILL_PICKER_CARD_FRAME.y + SKILL_PICKER_ICON_ANCHOR_OFFSET.y,
  )
  shadow.tint = 0x000000
  layer.addChild(shadow)
  const icon = spriteFor(textures, 'Skills', presentation.iconRecord)
  icon.anchor.set(0.5)
  icon.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
  layer.addChild(icon)

  let insightTreatment: Container | null = null
  if (option.insight === true) {
    insightTreatment = new Container()
    insightTreatment.alpha = 0
    const insightAura = spriteFor(textures, 'Skills', 13)
    insightAura.anchor.set(0.5)
    insightAura.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
    insightAura.scale.set(1.15)
    insightAura.tint = SKILL_PICKER_INSIGHT_TINT
    const insightGlow = spriteFor(textures, 'Skills', 164)
    insightGlow.anchor.set(0.5)
    insightGlow.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
    insightGlow.scale.set(1.15)
    insightGlow.tint = SKILL_PICKER_INSIGHT_TINT
    const insightFrame = spriteFor(textures, 'Skills', presentation.frameRecord)
    insightFrame.anchor.set(0.5)
    insightFrame.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
    insightFrame.tint = SKILL_PICKER_INSIGHT_TINT
    const insightIcon = spriteFor(textures, 'Skills', presentation.iconRecord)
    insightIcon.anchor.set(0.5)
    insightIcon.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
    insightIcon.tint = SKILL_PICKER_INSIGHT_TINT
    insightTreatment.addChild(insightAura, insightGlow, insightFrame, insightIcon)
    addBitmapText(
      insightTreatment,
      textures,
      'Insight',
      'body',
      centerX,
      SKILL_PICKER_INSIGHT_LABEL_Y,
      { align: 'center', tint: SKILL_PICKER_INSIGHT_TINT },
    )
    layer.addChild(insightTreatment)
  }

  addShadowedBitmapText(
    layer,
    textures,
    presentation.nameLines.join('\n'),
    'medium',
    centerX,
    presentation.nameBaselineY,
    presentation.rootTint,
  )
  addShadowedBitmapText(
    layer,
    textures,
    presentation.familyLabel,
    'skill',
    centerX,
    presentation.familyBaselineY,
    presentation.rootTint,
  )
  addBitmapText(
    layer,
    textures,
    presentation.descriptionLines.join('\n'),
    'medium',
    centerX,
    presentation.descriptionBaselineY,
    {
      align: 'center',
      lineHeight: 17,
      maxWidth: SKILL_PICKER_CARD_TEXT.wrapWidth,
      tint: 0xffffff,
    },
  )
  return insightTreatment
}

function addWeldGlow(
  layer: Container,
  textures: GameTextureMap,
  tints: readonly number[],
  centerX: number,
): void {
  const [width, height] = nativeUiRecord('Skills', 164).logicalSize
  const halfWidth = width * 1.15 / 2
  const halfHeight = height * 1.15 / 2
  const triangles = [
    {
      tint: tints[0]!,
      uvs: [0, 0, 1, 0, 0, 1],
      vertices: [-halfWidth, -halfHeight, halfWidth, -halfHeight, -halfWidth, halfHeight],
    },
    {
      tint: tints[1]!,
      uvs: [1, 0, 0, 1, 1, 1],
      vertices: [halfWidth, -halfHeight, -halfWidth, halfHeight, halfWidth, halfHeight],
    },
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
    mesh.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
    mesh.tint = triangle.tint
    layer.addChild(mesh)
  }
}

function rebuildPanel(
  layer: Container,
  textures: GameTextureMap,
  optionCount: number,
): {
  cards: NineSliceSprite[]
  corners: AnimatedCorner[]
  insightCards: NineSliceSprite[]
} {
  layer.removeChildren().forEach((child) => child.destroy({ children: true }))
  const bounds = skillPickerPanelBounds(optionCount)
  const backgroundRecord = nativeUiRecord('UI', 49)
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

  const cards: NineSliceSprite[] = []
  const insightCards: NineSliceSprite[] = []
  for (const centerX of skillPickerCardCenters(optionCount)) {
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
    const insightCard = new NineSliceSprite({
      bottomHeight: 30,
      height: SKILL_PICKER_PANEL.cardHeight,
      leftWidth: 30,
      rightWidth: 30,
      texture: textureFor(textures, 'Skills', 0),
      topHeight: 30,
      width: SKILL_PICKER_PANEL.cardWidth,
    })
    insightCard.alpha = 0
    insightCard.position.set(
      centerX - SKILL_PICKER_PANEL.cardWidth / 2,
      SKILL_PICKER_PANEL.cardTop,
    )
    insightCard.tint = SKILL_PICKER_INSIGHT_TINT
    insightCard.visible = false
    layer.addChild(card, insightCard)
    cards.push(card)
    insightCards.push(insightCard)
  }
  return { cards, corners, insightCards }
}

export function spriteFor(
  textures: GameTextureMap,
  atlas: 'Fonts' | 'Inventory' | 'Skills' | 'UI',
  record: number,
): Sprite {
  return nativeUiPixiFor(textures).sprite({ atlas, kind: 'sprite', record, x: 0, y: 0 })
}

export function textureFor(
  textures: GameTextureMap,
  atlas: 'Fonts' | 'Skills' | 'UI',
  record: number,
): Texture {
  return nativeUiPixiFor(textures).texture(atlas, record)
}

export function addBitmapText(
  layer: Container,
  textures: GameTextureMap,
  text: string,
  fontName: SkillPickerFontName,
  x: number,
  y: number,
  options: {
    align?: 'center' | 'left'
    lineHeight?: number
    maxWidth?: number
    tint?: number
  } = {},
): void {
  layer.addChild(nativeUiPixiFor(textures).text({
    align: options.align,
    font: nativeUiFontName(fontName),
    lineHeight: options.lineHeight,
    maxWidth: options.maxWidth,
    text,
    tint: options.tint,
    x,
    y,
  }))
}

function addShadowedBitmapText(
  layer: Container,
  textures: GameTextureMap,
  text: string,
  fontName: SkillPickerFontName,
  x: number,
  y: number,
  tint: number,
): void {
  const options = {
    align: 'center' as const,
    ...(fontName === 'medium' ? { lineHeight: 17 } : {}),
  }
  addBitmapText(
    layer,
    textures,
    text,
    fontName,
    x + SKILL_PICKER_CARD_TEXT.textShadowOffset,
    y + SKILL_PICKER_CARD_TEXT.textShadowOffset,
    { ...options, tint: 0x000000 },
  )
  addBitmapText(layer, textures, text, fontName, x, y, { ...options, tint })
}

export function measureNativeBitmapText(
  text: string,
  fontName: SkillPickerFontName,
): number {
  return measureNativeUiText(text, nativeUiFontName(fontName))
}

function nativeUiFontName(fontName: SkillPickerFontName) {
  return fontName === 'skill' ? 'skill-uppercase' as const : fontName
}
