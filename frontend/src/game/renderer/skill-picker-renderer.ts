import type { NativeUiCanvas } from './native-ui-canvas.ts'
import {
  Container,
  MeshSimple,
  NineSliceSprite,
  Rectangle,
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
  SKILL_PICKER_INSIGHT_COMPOSITE,
  SKILL_PICKER_INSIGHT_LABEL_Y,
  SKILL_PICKER_OFFER_CACHE_BOUNDS,
  SKILL_PICKER_PANEL,
  SKILL_PICKER_SIZE,
  skillPickerCardPresentation,
  skillPickerCardCenters,
  skillPickerCardUsesLiveLayer,
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

interface AnimatedCorner {
  readonly baseX: number
  readonly baseY: number
  readonly directionX: -1 | 1
  readonly directionY: -1 | 1
  readonly sprite: Sprite
}

interface InsightCardTreatment {
  readonly cardIndex: number
  readonly pulsing: readonly Container[]
}

export interface SkillPickerRenderer extends NativeUiCanvas {
  render(
    nowMs: number,
    selectedIndex: number,
    reveal: NativeSkillPickerReveal,
  ): void
  setContentVisible(visible: boolean): void
  setDetailOption(index: number | null): void
  setOffer(offer: ProtocolPlayerSkillOffer, specialActionsAvailable: boolean): void
}

export type SkillPickerFontName = 'body' | 'medium' | 'menu' | 'skill-uppercase'

export async function createSkillPickerRenderer(): Promise<SkillPickerRenderer> {
  let gpu: GameWebGlApplication | undefined
  let textures: GameTextureMap | undefined
  try {
    ;[gpu, textures] = await Promise.all([
      createGameWebGlApplication({
        backgroundAlpha: 0,
        className: 'skill-picker-canvas',
        height: SKILL_PICKER_SIZE.height,
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
    gpu?.destroy()
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
  const staticOfferLayer = new Container()
  staticOfferLayer.boundsArea = new Rectangle(
    SKILL_PICKER_OFFER_CACHE_BOUNDS.x,
    SKILL_PICKER_OFFER_CACHE_BOUNDS.y,
    SKILL_PICKER_OFFER_CACHE_BOUNDS.width,
    SKILL_PICKER_OFFER_CACHE_BOUNDS.height,
  )
  const insightOfferLayer = new Container()
  offerLayer.addChild(staticOfferLayer, insightOfferLayer)
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
  const refreshTextCache = () => {
    if (!staticOfferLayer.isCachedAsTexture) return
    staticOfferLayer.cacheAsTexture({
      antialias: false,
      resolution: application.renderer.resolution,
      scaleMode: 'nearest',
    })
    staticOfferLayer.updateCacheTexture()
  }
  application.renderer.on('resize', refreshTextCache)

  return {
    canvas: gpu.canvas,
    mount: gpu.mount,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.renderer.off('resize', refreshTextCache)
      gpu.destroy()
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
        for (const pulsing of treatment.pulsing) pulsing.alpha = insightAlpha
        insightPanels[treatment.cardIndex]!.alpha = insightAlpha
      }
      application.renderer.render(application.stage)
      const cacheResolution = `${staticOfferLayer.renderGroup?.texture?.source.resolution ?? 0}`
      if (gpu.canvas.dataset.nativeTextCacheResolution !== cacheResolution) {
        gpu.canvas.dataset.nativeTextCacheResolution = cacheResolution
      }
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
      staticOfferLayer.removeChildren().forEach((child) => child.destroy({ children: true }))
      insightOfferLayer.removeChildren().forEach((child) => child.destroy({ children: true }))
      const levelLine = `Y O U   A R E   N O W   L E V E L   ${offer.level}`
      for (let degrees = 0; degrees < 360; degrees += 45) {
        const radians = degrees * Math.PI / 180
        addBitmapText(
          staticOfferLayer,
          resources,
          levelLine,
          'menu',
          800 + Math.cos(radians) * 5,
          262.5 + Math.sin(radians) * 5,
          { align: 'center', tint: 0x000000 },
        )
      }
      addBitmapText(
        staticOfferLayer,
        resources,
        levelLine,
        'menu',
        800,
        262.5,
        { align: 'center', tint: 0xe0bd58 },
      )
      const centers = skillPickerCardCenters(offer.options.length)
      offer.options.forEach((option, index) => {
        const insight = addSkillCard(
          skillPickerCardUsesLiveLayer(option) ? insightOfferLayer : staticOfferLayer,
          resources,
          option,
          centers[index]!,
        )
        insightPanels[index]!.visible = insight !== null
        if (insight !== null) {
          insightCardTreatments.push({ cardIndex: index, pulsing: insight })
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
          staticOfferLayer.addChild(action)
        }
      }
      if (!staticOfferLayer.isCachedAsTexture) {
        staticOfferLayer.cacheAsTexture({
          antialias: false,
          resolution: application.renderer.resolution,
          scaleMode: 'nearest',
        })
      }
      staticOfferLayer.updateCacheTexture()
      application.renderer.render(application.stage)
    },
  }
}

function addSkillCard(
  layer: Container,
  textures: GameTextureMap,
  option: ProtocolPlayerSkillOfferOption,
  centerX: number,
): readonly Container[] | null {
  const presentation = skillPickerCardPresentation(option)
  const insight = option.insight === true
  const pulsing: Container[] = []
  const aura = centeredSkillSprite(textures, 13, centerX, 1.15)
  aura.blendMode = SKILL_PICKER_INSIGHT_COMPOSITE.preserved.aura.blendMode
  aura.tint = SKILL_PICKER_INSIGHT_COMPOSITE.preserved.aura.tint
  layer.addChild(aura)

  if (insight) {
    const constantGlow = centeredSkillSprite(textures, 164, centerX, 1.15)
    constantGlow.blendMode = SKILL_PICKER_INSIGHT_COMPOSITE.constant.glow.blendMode
    constantGlow.tint = SKILL_PICKER_INSIGHT_COMPOSITE.constant.glow.tint
    layer.addChild(constantGlow)

    const pulseGlow = new Container()
    pulseGlow.alpha = 0
    const glow = centeredSkillSprite(textures, 164, centerX, 1.15)
    glow.blendMode = SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.glow.blendMode
    glow.tint = SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.glow.tint
    pulseGlow.addChild(glow)
    layer.addChild(pulseGlow)
    pulsing.push(pulseGlow)
  } else if (presentation.glowTints.length === 2) {
    addWeldGlow(layer, textures, presentation.glowTints, centerX)
  } else {
    const glow = centeredSkillSprite(textures, 164, centerX, 1.15)
    glow.tint = presentation.rootTint
    layer.addChild(glow)
  }

  const frame = centeredSkillSprite(textures, presentation.frameRecord, centerX)
  layer.addChild(frame)

  if (insight) {
    const pulseFrame = new Container()
    pulseFrame.alpha = 0
    const insightFrame = centeredSkillSprite(textures, presentation.frameRecord, centerX)
    insightFrame.blendMode = SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.frame.blendMode
    insightFrame.tint = SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.frame.tint
    pulseFrame.addChild(insightFrame)
    layer.addChild(pulseFrame)
    pulsing.push(pulseFrame)
  }

  const shadow = centeredSkillSprite(textures, presentation.iconRecord, centerX)
  shadow.position.set(
    centerX + SKILL_PICKER_ICON_ANCHOR_OFFSET.x,
    SKILL_PICKER_CARD_FRAME.y + SKILL_PICKER_ICON_ANCHOR_OFFSET.y,
  )
  shadow.blendMode = SKILL_PICKER_INSIGHT_COMPOSITE.preserved.iconShadow.blendMode
  shadow.tint = SKILL_PICKER_INSIGHT_COMPOSITE.preserved.iconShadow.tint
  layer.addChild(shadow)
  const icon = centeredSkillSprite(textures, presentation.iconRecord, centerX)
  icon.blendMode = SKILL_PICKER_INSIGHT_COMPOSITE.preserved.icon.blendMode
  icon.tint = SKILL_PICKER_INSIGHT_COMPOSITE.preserved.icon.tint
  layer.addChild(icon)

  if (insight) {
    addInsightCardTextPass(
      layer,
      textures,
      presentation,
      centerX,
      SKILL_PICKER_INSIGHT_COMPOSITE.constant.text,
    )
    const pulseText = new Container()
    pulseText.alpha = 0
    addBitmapText(
      pulseText,
      textures,
      'Insight',
      'body',
      centerX,
      SKILL_PICKER_INSIGHT_LABEL_Y,
      {
        align: 'center',
        blendMode: SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.label.blendMode,
        tint: SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.label.tint,
      },
    )
    addInsightCardTextPass(
      pulseText,
      textures,
      presentation,
      centerX,
      SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.text,
    )
    layer.addChild(pulseText)
    pulsing.push(pulseText)
  } else {
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
      'skill-uppercase',
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
  }
  return insight ? Object.freeze(pulsing) : null
}

function centeredSkillSprite(
  textures: GameTextureMap,
  record: number,
  centerX: number,
  scale = 1,
): Sprite {
  const sprite = spriteFor(textures, 'Skills', record)
  sprite.anchor.set(0.5)
  sprite.position.set(centerX, SKILL_PICKER_CARD_FRAME.y)
  sprite.scale.set(scale)
  return sprite
}

function addInsightCardTextPass(
  layer: Container,
  textures: GameTextureMap,
  presentation: ReturnType<typeof skillPickerCardPresentation>,
  centerX: number,
  treatment: Readonly<{ blendMode: 'add'; tint: number }>,
): void {
  addBitmapText(
    layer,
    textures,
    presentation.nameLines.join('\n'),
    'medium',
    centerX,
    presentation.nameBaselineY,
    { align: 'center', blendMode: treatment.blendMode, lineHeight: 17, tint: treatment.tint },
  )
  addBitmapText(
    layer,
    textures,
    presentation.familyLabel,
    'skill-uppercase',
    centerX,
    presentation.familyBaselineY,
    { align: 'center', blendMode: treatment.blendMode, tint: treatment.tint },
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
      blendMode: treatment.blendMode,
      lineHeight: 17,
      maxWidth: SKILL_PICKER_CARD_TEXT.wrapWidth,
      tint: treatment.tint,
    },
  )
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
    insightCard.blendMode = SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.panel.blendMode
    insightCard.tint = SKILL_PICKER_INSIGHT_COMPOSITE.pulsing.panel.tint
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
    blendMode?: 'add' | 'normal'
    lineHeight?: number
    maxWidth?: number
    tint?: number
  } = {},
): void {
  const rendered = nativeUiPixiFor(textures).text({
    align: options.align,
    font: fontName,
    lineHeight: options.lineHeight,
    maxWidth: options.maxWidth,
    text,
    tint: options.tint,
    x,
    y,
  })
  for (const glyph of rendered.children) {
    glyph.blendMode = options.blendMode ?? 'normal'
  }
  layer.addChild(rendered)
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
