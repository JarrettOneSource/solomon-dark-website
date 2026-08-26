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

import { hub, skillPicker } from '../../lib/assets.ts'
import {
  NATIVE_SKILL_CATALOG,
  nativeSkillRoot,
  nativeWeldBuild,
  playerExperienceProgress,
} from '../core-kernels/player-progression.ts'
import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudModalSlideLayout,
  type NativeHudControlLayout,
  type NativeHudPoint,
} from '../native-hud-layout.ts'
import { nativeUiFont } from '../native-ui/native-ui-catalog.ts'
import {
  destroyNativeUiPixiFor,
  nativeUiPixiFor,
} from '../native-ui/native-ui-pixi.ts'
import {
  measureNativeUiText,
  wrapNativeUiText,
} from '../native-ui/native-ui-text.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from '../protocol/game-state.ts'
import {
  NATIVE_SKILL_DRAGGER_SCALE,
  nativeSkillBookTooltipLines,
  type NativeSkillBookPagePlacement,
  type NativeSkillBookRow,
  type NativeSkillBookTooltipLineKind,
} from '../skill-book-model.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
  type GameTextureMap,
} from './game-webgl.ts'
import {
  NATIVE_SKILL_HOVER_BOX,
  NATIVE_SKILL_PAGE_PANEL,
  NATIVE_SKILL_ROW_PRESENTATION,
  NATIVE_SKILL_SCREEN_ROOT,
  NATIVE_SKILL_SCREEN_SIZE,
  measureNativeSkillExactText,
  nativeSkillExactTextRuns,
  nativeSkillPageDisplayName,
  nativeSkillPageTextHeight,
  nativeSkillPageTint,
  nativeSkillPageWrappedLines,
  nativeSkillRootTint,
  nativeSkillScreenSealTransform,
  nativeSkillScreenTick,
} from './skill-book-render-contract.ts'
import {
  addBitmapText,
  spriteFor,
  textureFor,
} from './skill-picker-renderer.ts'

export interface SkillBookRendererPresentation {
  readonly dragPosition: Readonly<NativeHudPoint> | null
  readonly draggedSkillId: number | null
  readonly economy: ProtocolPlayerEconomy
  readonly hoveredSkillId: number | null
  readonly openProgress: number
  readonly placements: readonly NativeSkillBookPagePlacement[]
  readonly progression: ProtocolPlayerProgression
  readonly targetQuickbarSlot: number | null
}

export interface SkillBookRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(nowMs: number): void
  setPresentation(presentation: SkillBookRendererPresentation): void
}

export async function createSkillBookRenderer(): Promise<SkillBookRenderer> {
  const constructedAtMs = performance.now()
  let gpu: Awaited<ReturnType<typeof createGameWebGlApplication>> | undefined
  let textures: GameTextureMap | undefined
  try {
    ;[gpu, textures] = await Promise.all([
      createGameWebGlApplication({
        backgroundAlpha: 0,
        className: 'skill-book-canvas',
        height: NATIVE_SKILL_SCREEN_SIZE.height,
        resolution: 1,
        width: NATIVE_SKILL_SCREEN_SIZE.width,
      }),
      loadGameTextureMap([
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
  const curtain = new Graphics()
    .rect(0, 0, NATIVE_SKILL_SCREEN_SIZE.width, NATIVE_SKILL_SCREEN_SIZE.height)
    .fill(0x000000)
  const field = new Container()
  const ambient = new Container()
  const fixtures = new Container()
  const overlay = new Container()
  const pages = new Container()
  const hud = new Container()
  const hover = new Container()
  const dragger = new Container()
  root.addChild(curtain, ambient, fixtures, field, overlay, pages, hud, hover, dragger)
  application.stage.addChild(root)

  drawSkillScreenField(field, resources)
  const sealSprites = drawSkillScreenAmbient(ambient, resources)
  drawSkillScreenFixtures(fixtures, resources)
  drawSkillScreenOverlay(overlay, resources)

  let destroyed = false
  let lastSealTick = -1
  const renderer: SkillBookRenderer = {
    canvas: gpu.canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.destroy({ removeView: true })
      destroyNativeUiPixiFor(resources)
      resources.destroy()
    },
    render(nowMs) {
      if (destroyed) return
      const screenTick = nativeSkillScreenTick(nowMs - constructedAtMs)
      if (screenTick !== lastSealTick) {
        const transforms = sealSprites.map((seal, index) => {
          const transform = nativeSkillScreenSealTransform(index, screenTick)
          seal.position.set(transform.x, transform.y)
          seal.rotation = transform.rotationDegrees * Math.PI / 180
          return transform
        })
        if (import.meta.env.DEV) {
          gpu.canvas.dataset.nativeSealMotion = [
            screenTick,
            transforms[0]!.rotationDegrees,
            transforms[0]!.y,
            ...transforms.map(({ x }) => x),
          ].join(',')
        }
        lastSealTick = screenTick
      }
      application.renderer.render(application.stage)
    },
    setPresentation(presentation) {
      if (destroyed) return
      const progress = presentation.openProgress
      curtain.alpha = progress
      field.alpha = progress ** 3
      ambient.alpha = progress ** 9
      fixtures.alpha = progress ** 9
      overlay.alpha = progress ** 3
      pages.alpha = progress ** 2
      hud.alpha = progress
      hover.alpha = progress ** 2
      destroyChildren(pages)
      destroyChildren(hud)
      destroyChildren(hover)
      destroyChildren(dragger)
      for (const placement of presentation.placements) {
        drawSkillPage(pages, resources, placement, presentation)
      }
      const hudLayout = nativeHudModalSlideLayout(
        NATIVE_HUD_BACKBUFFER.width,
        NATIVE_HUD_BACKBUFFER.height,
        progress,
      )
      drawSkillQuickbar(hud, resources, presentation, hudLayout)
      drawInventoryHud(
        hud,
        resources,
        presentation.economy,
        presentation.progression,
        hudLayout,
      )
      drawNativeHoverBox(hover, resources, presentation)
      drawSkillDragger(dragger, resources, presentation)
      renderer.render(performance.now())
    },
  }
  return renderer
}

function drawSkillDragger(
  layer: Container,
  textures: GameTextureMap,
  presentation: SkillBookRendererPresentation,
): void {
  if (presentation.draggedSkillId === null || presentation.dragPosition === null) return
  const row = presentation.placements
    .flatMap(({ page }) => page.rows)
    .find(({ id }) => id === presentation.draggedSkillId)
  if (!row) return
  const weld = row.weldBuildId === null ? null : nativeWeldBuild(row.weldBuildId)
  const glow = spriteFor(textures, 'Skills', 164)
  glow.anchor.set(0.5)
  glow.position.copyFrom(presentation.dragPosition)
  glow.scale.set(NATIVE_SKILL_DRAGGER_SCALE)
  glow.tint = nativeSkillRootTint(nativeSkillRoot(row.id))
  layer.addChild(glow)
  const icon = spriteFor(
    textures,
    'Skills',
    weld?.skillsAtlasIconRecord ?? row.iconRecord,
  )
  icon.anchor.set(0.5)
  icon.position.copyFrom(presentation.dragPosition)
  icon.scale.set(NATIVE_SKILL_DRAGGER_SCALE)
  layer.addChild(icon)
}

function drawSkillScreenField(layer: Container, textures: GameTextureMap): void {
  layer.addChild(new Graphics()
    .rect(
      0,
      NATIVE_SKILL_SCREEN_ROOT.leatherTop,
      NATIVE_SKILL_SCREEN_SIZE.width,
      NATIVE_SKILL_SCREEN_ROOT.leatherHeight,
    )
    .fill(0x000000))
  const leather = new TilingSprite({
    height: NATIVE_SKILL_SCREEN_ROOT.leatherHeight,
    texture: textureFor(textures, 'UI', NATIVE_SKILL_SCREEN_ROOT.leatherRecord),
    width: NATIVE_SKILL_SCREEN_SIZE.width,
  })
  leather.position.set(0, NATIVE_SKILL_SCREEN_ROOT.leatherTop)
  layer.addChild(leather)
}

function drawSkillScreenAmbient(layer: Container, textures: GameTextureMap): Sprite[] {
  const seals: Sprite[] = []
  for (let index = 0; index < NATIVE_SKILL_SCREEN_ROOT.ambientCount; index += 1) {
    const seal = spriteFor(textures, 'UI', NATIVE_SKILL_SCREEN_ROOT.ambientRecord)
    const transform = nativeSkillScreenSealTransform(index, 0)
    seal.anchor.set(0.5)
    seal.alpha = NATIVE_SKILL_SCREEN_ROOT.ambientAlpha
    seal.blendMode = 'add'
    seal.position.set(transform.x, transform.y)
    seal.rotation = transform.rotationDegrees * Math.PI / 180
    seal.scale.set(NATIVE_SKILL_SCREEN_ROOT.ambientScale)
    layer.addChild(seal)
    seals.push(seal)
  }
  return seals
}

function drawSkillScreenFixtures(layer: Container, textures: GameTextureMap): void {
  for (const placement of NATIVE_SKILL_SCREEN_ROOT.topFlourishes) {
    const sprite = spriteFor(textures, 'UI', placement.record)
    sprite.anchor.set(0.5)
    sprite.position.set(placement.x, placement.y)
    sprite.rotation = placement.rotationDegrees * Math.PI / 180
    layer.addChild(sprite)
  }
  for (const placement of NATIVE_SKILL_SCREEN_ROOT.topWizards) {
    const sprite = spriteFor(textures, 'UI', placement.record)
    sprite.anchor.set(0.5)
    sprite.position.set(placement.x, placement.y)
    sprite.scale.x = placement.mirrorX ? -1 : 1
    layer.addChild(sprite)
  }
  for (const placement of NATIVE_SKILL_SCREEN_ROOT.bottomMasonry) {
    const sprite = spriteFor(textures, 'UI', placement.record)
    sprite.anchor.set(0.5)
    sprite.position.set(placement.x, placement.y)
    layer.addChild(sprite)
  }
  const clippedWarriors = new Container()
  const clip = NATIVE_SKILL_SCREEN_ROOT.bottomWarriorClip
  const mask = new Graphics().rect(clip.x, clip.y, clip.width, clip.height).fill(0xffffff)
  clippedWarriors.addChild(mask)
  clippedWarriors.mask = mask
  for (const placement of NATIVE_SKILL_SCREEN_ROOT.bottomWarriors) {
    const sprite = spriteFor(textures, 'UI', placement.record)
    sprite.anchor.set(0.5)
    sprite.position.set(placement.x, placement.y)
    sprite.scale.x = placement.mirrorX ? -1 : 1
    clippedWarriors.addChild(sprite)
  }
  layer.addChild(clippedWarriors)
}

function drawSkillScreenOverlay(layer: Container, textures: GameTextureMap): void {
  for (const y of [NATIVE_SKILL_SCREEN_ROOT.topChainY, NATIVE_SKILL_SCREEN_ROOT.bottomChainY]) {
    const chain = new TilingSprite({
      height: 19,
      texture: textureFor(textures, 'UI', 10),
      width: NATIVE_SKILL_SCREEN_SIZE.width,
    })
    chain.position.set(0, y)
    layer.addChild(chain)
  }
  for (const [x, y] of [[-30, 37], [1_560, 37], [-30, 827], [1_560, 827]] as const) {
    const endcap = spriteFor(textures, 'UI', 71)
    endcap.position.set(x, y)
    layer.addChild(endcap)
  }
  const titleBackingPlacement = NATIVE_SKILL_SCREEN_ROOT.titleBacking
  const titleBacking = new NineSliceSprite({
    bottomHeight: 5,
    height: titleBackingPlacement.height,
    leftWidth: 5,
    rightWidth: 5,
    texture: textureFor(textures, 'UI', 4),
    topHeight: 5,
    width: titleBackingPlacement.width,
  })
  titleBacking.position.set(titleBackingPlacement.x, titleBackingPlacement.y)
  layer.addChild(titleBacking)
  addShadowedText(
    layer,
    textures,
    'SKILLS',
    'menu',
    800,
    NATIVE_SKILL_SCREEN_ROOT.titleY,
    NATIVE_SKILL_SCREEN_ROOT.titleTint,
  )
  const usesTouchHelp = window.matchMedia('(pointer: coarse)').matches
  addShadowedText(
    layer,
    textures,
    usesTouchHelp
      ? 'tap a skill icon for more'
      : 'hover over a skill icon for more',
    'menu',
    800,
    NATIVE_SKILL_SCREEN_ROOT.helpTopY,
    NATIVE_SKILL_SCREEN_ROOT.helpTint,
    Number.POSITIVE_INFINITY,
    NATIVE_SKILL_SCREEN_ROOT.helpAlpha,
  )
  addShadowedText(
    layer,
    textures,
    'information about a skill.',
    'menu',
    800,
    NATIVE_SKILL_SCREEN_ROOT.helpTopY + NATIVE_SKILL_SCREEN_ROOT.helpLineGap,
    NATIVE_SKILL_SCREEN_ROOT.helpTint,
    Number.POSITIVE_INFINITY,
    NATIVE_SKILL_SCREEN_ROOT.helpAlpha,
  )
  addShadowedText(
    layer,
    textures,
    'skills with a gold or green border',
    'menu',
    800,
    NATIVE_SKILL_SCREEN_ROOT.helpBottomY,
    NATIVE_SKILL_SCREEN_ROOT.helpTint,
    Number.POSITIVE_INFINITY,
    NATIVE_SKILL_SCREEN_ROOT.helpAlpha,
  )
  addShadowedText(
    layer,
    textures,
    'can be dragged into your belt',
    'menu',
    800,
    NATIVE_SKILL_SCREEN_ROOT.helpBottomY + NATIVE_SKILL_SCREEN_ROOT.helpLineGap,
    NATIVE_SKILL_SCREEN_ROOT.helpTint,
    Number.POSITIVE_INFINITY,
    NATIVE_SKILL_SCREEN_ROOT.helpAlpha,
  )
}

function drawSkillPage(
  layer: Container,
  textures: GameTextureMap,
  placement: NativeSkillBookPagePlacement,
  presentation: SkillBookRendererPresentation,
): void {
  const selection = firstPageSelection(placement, presentation.progression)
  const tint = nativeSkillPageTint(nativeSkillRoot(placement.page.rootSkillId))
  const panelAlpha = selection === null
    ? NATIVE_SKILL_PAGE_PANEL.unselectedAlpha
    : NATIVE_SKILL_PAGE_PANEL.selectedAlpha
  layer.addChild(new Graphics()
    .rect(
      placement.x + NATIVE_SKILL_PAGE_PANEL.inset,
      placement.y + NATIVE_SKILL_PAGE_PANEL.inset,
      placement.page.width - NATIVE_SKILL_PAGE_PANEL.inset * 2,
      NATIVE_SKILL_PAGE_PANEL.height - NATIVE_SKILL_PAGE_PANEL.inset * 2,
    )
    .fill({ alpha: panelAlpha, color: tint }))
  const panel = nativePagePanel(textures, placement)
  panel.alpha = panelAlpha
  panel.tint = tint
  layer.addChild(panel)
  const edgePassCount = selection === null ? 1 : 2
  for (let index = 0; index < edgePassCount; index += 1) {
    const edge = nativePagePanel(textures, placement)
    edge.alpha = NATIVE_SKILL_PAGE_PANEL.additiveAlpha
    edge.blendMode = 'add'
    layer.addChild(edge)
  }
  placement.page.rows.forEach((row, index) => {
    const centerX = placement.x + rowCenterX(index)
    const centerY = placement.y + NATIVE_SKILL_ROW_PRESENTATION.rowCenterY
    if (index > 0) {
      const arrow = spriteFor(textures, 'Skills', 6)
      arrow.anchor.set(0.5)
      arrow.position.set(placement.x + (rowCenterX(index - 1) + rowCenterX(index)) / 2, centerY)
      layer.addChild(arrow)
    }
    drawSkillEntry(
      layer,
      textures,
      row,
      centerX,
      centerY,
      selection?.row.id === row.id ? selection.kind : null,
    )
  })
}

function nativePagePanel(
  textures: GameTextureMap,
  placement: NativeSkillBookPagePlacement,
): NineSliceSprite {
  const panel = new NineSliceSprite({
    bottomHeight: NATIVE_SKILL_PAGE_PANEL.slice,
    height: NATIVE_SKILL_PAGE_PANEL.height,
    leftWidth: NATIVE_SKILL_PAGE_PANEL.slice,
    rightWidth: NATIVE_SKILL_PAGE_PANEL.slice,
    texture: textureFor(textures, 'Skills', 0),
    topHeight: NATIVE_SKILL_PAGE_PANEL.slice,
    width: placement.page.width,
  })
  panel.position.set(placement.x, placement.y)
  return panel
}

function firstPageSelection(
  placement: NativeSkillBookPagePlacement,
  progression: ProtocolPlayerProgression,
): { kind: 'concentration' | 'primary'; row: NativeSkillBookRow } | null {
  for (const row of placement.page.rows) {
    if (row.id === progression.selectedPrimarySkillId) return { kind: 'primary', row }
    if (progression.concentrationSkillIds.includes(row.id)) return { kind: 'concentration', row }
  }
  return null
}

function rowCenterX(index: number): number {
  return index === 0
    ? NATIVE_SKILL_ROW_PRESENTATION.rootCenterX
    : NATIVE_SKILL_ROW_PRESENTATION.dependentFirstCenterX
      + NATIVE_SKILL_ROW_PRESENTATION.dependentPitchX * (index - 1)
}

function drawSkillEntry(
  layer: Container,
  textures: GameTextureMap,
  row: NativeSkillBookRow,
  centerX: number,
  centerY: number,
  selection: 'concentration' | 'primary' | null,
): void {
  const weldBuild = row.weldBuildId === null ? null : nativeWeldBuild(row.weldBuildId)
  if (row.id === 52 && !weldBuild) throw new Error('learned Spell Welding has no native build')
  const aura = spriteFor(textures, 'Skills', 13)
  aura.anchor.set(0.5)
  aura.position.set(centerX, centerY)
  aura.scale.set(NATIVE_SKILL_ROW_PRESENTATION.auraScale)
  layer.addChild(aura)
  if (weldBuild) addWeldGlow(layer, textures, weldBuild.colorRoots, centerX, centerY)
  else {
    const rootGlow = spriteFor(textures, 'Skills', 164)
    rootGlow.anchor.set(0.5)
    rootGlow.position.set(centerX, centerY)
    rootGlow.scale.set(NATIVE_SKILL_ROW_PRESENTATION.auraScale)
    rootGlow.tint = nativeSkillPageTint(nativeSkillRoot(row.id))
    layer.addChild(rootGlow)
  }

  const actionable = row.category === 1 || row.category === 2 || row.category === 3
  const frame = spriteFor(
    textures,
    'Skills',
    selection === null && actionable
      ? NATIVE_SKILL_ROW_PRESENTATION.actionableFrameRecord
      : NATIVE_SKILL_ROW_PRESENTATION.ordinaryFrameRecord,
  )
  frame.anchor.set(0.5)
  frame.position.set(centerX, centerY)
  if (selection !== null) {
    frame.alpha = NATIVE_SKILL_ROW_PRESENTATION.selectedFrameAlpha
    frame.tint = NATIVE_SKILL_ROW_PRESENTATION.selectedFrameTint
  }
  layer.addChild(frame)

  const iconRecord = weldBuild?.skillScreenIconRecord ?? row.iconRecord
  const iconShadow = spriteFor(textures, 'Skills', iconRecord)
  iconShadow.anchor.set(0.5)
  iconShadow.position.set(
    centerX + NATIVE_SKILL_ROW_PRESENTATION.iconShadowOffset,
    centerY + NATIVE_SKILL_ROW_PRESENTATION.iconShadowOffset,
  )
  iconShadow.tint = 0x000000
  layer.addChild(iconShadow)
  const icon = spriteFor(textures, 'Skills', iconRecord)
  icon.anchor.set(0.5)
  icon.position.set(centerX, centerY)
  layer.addChild(icon)

  if (selection !== null) {
    addShadowedText(
      layer,
      textures,
      selection === 'primary' ? 'casting' : 'concentrate',
      'body',
      centerX,
      centerY - 45,
      NATIVE_SKILL_ROW_PRESENTATION.selectedFrameTint,
    )
  }
  const name = nativeSkillPageDisplayName(
    weldBuild?.syntheticName ?? row.name,
    row.effectiveRank,
  )
  const nameLines = nativeSkillPageWrappedLines(name)
  const pageTop = centerY - NATIVE_SKILL_ROW_PRESENTATION.rowCenterY
  const nameY = pageTop + NATIVE_SKILL_ROW_PRESENTATION.nameBaselineY
  addShadowedText(layer, textures, nameLines.join('\n'), 'medium', centerX, nameY, 0xffffff)
  addShadowedText(
    layer,
    textures,
    NATIVE_SKILL_CATALOG[row.id]?.family.toUpperCase() ?? '',
    'skill',
    centerX,
    nameY + nativeSkillPageTextHeight(nameLines),
    0xffffff,
  )
  const descriptionLines = nativeSkillPageWrappedLines(
    weldBuild?.pairDescription ?? row.description,
  )
  const descriptionY = pageTop
    + NATIVE_SKILL_ROW_PRESENTATION.descriptionCenterY
    - nativeSkillPageTextHeight(descriptionLines) / 2
  addBitmapText(layer, textures, descriptionLines.join('\n'), 'medium', centerX, descriptionY, {
    lineHeight: nativeUiFont('medium').metrics[0],
    tint: 0xffffff,
  })
  const footer = row.category === 1
    ? 'primary cast'
    : row.category === 2
      ? 'secondary cast'
      : ''
  if (footer) {
    addShadowedText(
      layer,
      textures,
      footer,
      'body',
      centerX,
      pageTop + NATIVE_SKILL_ROW_PRESENTATION.footerBaselineY,
      0xffffff,
    )
  }
}

function drawNativeHoverBox(
  layer: Container,
  textures: GameTextureMap,
  presentation: SkillBookRendererPresentation,
): void {
  const hovered = presentation.hoveredSkillId
  if (hovered === null) return
  let row: NativeSkillBookRow | undefined
  let sourceX = 0
  let sourceY = 0
  for (const placement of presentation.placements) {
    const index = placement.page.rows.findIndex(({ id }) => id === hovered)
    if (index < 0) continue
    row = placement.page.rows[index]
    sourceX = placement.x + rowCenterX(index)
    sourceY = placement.y + NATIVE_SKILL_ROW_PRESENTATION.rowCenterY
    break
  }
  if (!row) return
  const semanticLines = nativeSkillBookTooltipLines(row)
  if (semanticLines.length === 0) return
  const rendered = semanticLines.map((line) => {
    const sources = line.kind === 'description'
      ? wrapNativeUiText(line.text, 'body', NATIVE_SKILL_HOVER_BOX.contentMaxWidth)
      : line.text.split('\n')
    return { kind: line.kind, sources }
  })
  const contentWidth = Math.min(
    NATIVE_SKILL_HOVER_BOX.contentMaxWidth,
    Math.max(0, ...rendered.flatMap(({ sources }) => sources.map(measureNativeSkillExactText))),
  )
  const lineHeight = nativeUiFont('body').metrics[0]
  const contentHeight = rendered.reduce((height, { sources }, index) => (
    height
    + sources.length * lineHeight
    + (index === rendered.length - 1 ? 0 : NATIVE_SKILL_HOVER_BOX.lineGap)
  ), 0)
  const width = contentWidth + NATIVE_SKILL_HOVER_BOX.contentMargin * 2
  const height = contentHeight + NATIVE_SKILL_HOVER_BOX.contentMargin * 2
  const margin = NATIVE_SKILL_HOVER_BOX.viewportMargin
  const x = Math.max(
    margin,
    Math.min(NATIVE_SKILL_SCREEN_SIZE.width - margin - width, sourceX - width / 2),
  )
  let y = sourceY - NATIVE_SKILL_HOVER_BOX.sourceGap - height
  if (y < margin) y = sourceY + NATIVE_SKILL_HOVER_BOX.sourceGap
  y = Math.max(margin, Math.min(NATIVE_SKILL_SCREEN_SIZE.height - margin - height, y))

  const info = new Container()
  info.label = 'native-skill-hover-box'
  info.position.set(x, y)
  info.addChild(new Graphics()
    .rect(0, 0, width, height)
    .fill(0x000000)
    .stroke({ color: 0xffffff, width: 1 }))
  let cursorY = NATIVE_SKILL_HOVER_BOX.contentMargin
  for (const { kind, sources } of rendered) {
    for (const source of sources) {
      addNativeExactTextLine(
        info,
        textures,
        source,
        NATIVE_SKILL_HOVER_BOX.contentMargin,
        cursorY,
        nativeHoverLineTint(kind, row),
      )
      cursorY += lineHeight
    }
    cursorY += NATIVE_SKILL_HOVER_BOX.lineGap
  }
  layer.addChild(info)
}

function nativeHoverLineTint(kind: NativeSkillBookTooltipLineKind, row: NativeSkillBookRow): number {
  if (kind === 'boost') return 0xff80ff
  if (kind === 'bonus') return 0xd9ba70
  if (kind === 'title') return nativeSkillPageTint(nativeSkillRoot(row.id))
  if (kind === 'category') return dimTint(nativeSkillPageTint(nativeSkillRoot(row.id)), 0.75)
  return 0xbfbfbf
}

function dimTint(tint: number, amount: number): number {
  const red = Math.round(((tint >> 16) & 0xff) * amount)
  const green = Math.round(((tint >> 8) & 0xff) * amount)
  const blue = Math.round((tint & 0xff) * amount)
  return (red << 16) | (green << 8) | blue
}

function addNativeExactTextLine(
  layer: Container,
  textures: GameTextureMap,
  source: string,
  x: number,
  y: number,
  tint: number,
): void {
  let cursor = x
  for (const run of nativeSkillExactTextRuns(source)) {
    const text = nativeUiPixiFor(textures).text({
      align: 'left',
      font: 'body',
      scale: run.scale,
      text: run.text,
      tint,
      x: cursor + run.offsetX,
      y: y + run.offsetY,
    })
    if (run.italic) text.skew.x = -Math.atan(0.125)
    layer.addChild(text)
    cursor += measureNativeUiText(run.text, 'body', run.scale)
  }
}

function addWeldGlow(
  layer: Container,
  textures: GameTextureMap,
  colorRoots: readonly [number, number],
  centerX: number,
  centerY: number,
): void {
  const half = 57 * NATIVE_SKILL_ROW_PRESENTATION.auraScale / 2
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
    mesh.tint = nativeSkillPageTint(triangle.root)
    layer.addChild(mesh)
  }
}

function drawSkillQuickbar(
  layer: Container,
  textures: GameTextureMap,
  presentation: SkillBookRendererPresentation,
  hudLayout: NativeHudControlLayout,
): void {
  presentation.progression.skillQuickbar.forEach((skillId, slot) => {
    const rect = hudLayout.belt[slot]!
    const { height, width, x, y } = rect
    const selectedPrimary = skillId === presentation.progression.selectedPrimarySkillId
    layer.addChild(new Graphics()
      .rect(x, y, width, height)
      .fill({ alpha: 0.78, color: 0x050505 })
      .stroke({
        alpha: 0.72,
        color: selectedPrimary ? 0x40ffff : 0x6d6035,
        width: 2,
      }))
    if (skillId !== null) {
      const row = presentation.placements
        .flatMap(({ page }) => page.rows)
        .find(({ id }) => id === skillId)
      const record = row?.iconRecord ?? NATIVE_SKILL_CATALOG[skillId]?.skills_atlas_icon_record
      if (record !== undefined) {
        const weld = skillId === 52
          ? nativeWeldBuild(presentation.progression.weldBuildId ?? Number.NaN)
          : null
        const icon = spriteFor(textures, 'Skills', weld?.skillsAtlasIconRecord ?? record)
        icon.anchor.set(0.5)
        icon.position.set(x + width / 2, y + height / 2)
        icon.alpha = 0.375
        layer.addChild(icon)
      }
    }
    if (presentation.draggedSkillId !== null && slot === presentation.targetQuickbarSlot) {
      layer.addChild(new Graphics()
        .rect(x - 3, y - 3, width + 6, height + 6)
        .stroke({ color: 0x40ffff, width: 1 }))
    }
  })
}

function drawInventoryHud(
  layer: Container,
  textures: GameTextureMap,
  economy: ProtocolPlayerEconomy,
  progression: ProtocolPlayerProgression,
  hudLayout: NativeHudControlLayout,
): void {
  const image = (source: string, x: number, y: number, width: number, height: number) => {
    const sprite = new Sprite(textureFrom(textures.textures, source))
    sprite.position.set(x, y)
    sprite.width = width
    sprite.height = height
    layer.addChild(sprite)
    return sprite
  }
  const { backpack, belt, tome } = hudLayout
  const redSlot = belt[3]!
  const blueSlot = belt[4]!
  image(hub.hud.potionRed, redSlot.x + 3, redSlot.y + 0.5, 53, 50)
  image(hub.hud.backpack, backpack.x, backpack.y, backpack.width, backpack.height)
  const xpFillX = backpack.x + 67.5
  const xpFillY = backpack.y + 8
  const xpFill = image(hub.hud.xpFill, xpFillX, xpFillY, 4, 48)
  const xpProgress = playerExperienceProgress(progression)
  const xpMask = new Graphics()
    .rect(xpFillX, xpFillY + (1 - xpProgress) * 48, 4, xpProgress * 48)
    .fill(0xffffff)
  layer.addChild(xpMask)
  xpFill.mask = xpMask
  image(hub.hud.xpFrame, backpack.x + 64, backpack.y + 4, 12, 56)
  image(hub.hud.tome, tome.x, tome.y, tome.width, tome.height)
  image(hub.hud.potionBlue, blueSlot.x + 5, blueSlot.y + 0.5, 50, 49)
  const counts = [
    { count: inventoryQuantity(economy, 'health-potion'), x: redSlot.x + 24, y: redSlot.y + 52.5 },
    { count: inventoryQuantity(economy, 'mana-potion'), x: blueSlot.x + 25, y: blueSlot.y + 52.5 },
  ]
  const digitTexture = textureFrom(textures.textures, hub.hud.inventoryDigits)
  for (const { count, x, y } of counts) {
    const frame = new Rectangle(Math.min(9, Math.max(0, count)) * 8, 0, 8, 14)
    const digit = new Sprite(new Texture({ source: digitTexture.source, frame }))
    digit.position.set(x, y)
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
  alpha = 1,
): void {
  const textLayer = new Container()
  textLayer.alpha = alpha
  const lineHeight = nativeUiFont(font === 'skill' ? 'skill-uppercase' : font).metrics[0]
  const shadowOffset = NATIVE_SKILL_ROW_PRESENTATION.textShadowOffset
  addBitmapText(textLayer, textures, text, font, x + shadowOffset, y + shadowOffset, {
    lineHeight,
    maxWidth,
    tint: 0x000000,
  })
  addBitmapText(textLayer, textures, text, font, x, y, { lineHeight, maxWidth, tint })
  layer.addChild(textLayer)
}

function destroyChildren(layer: Container): void {
  layer.removeChildren().forEach((child) => child.destroy({ children: true }))
}
