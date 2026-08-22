import { Container, Rectangle, Sprite, Texture } from 'pixi.js'

import fontAssetsJson from '../../assets/game/skill-picker-native-assets.json' with { type: 'json' }
import uiAssetsJson from '../../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import { skillPicker } from '../../lib/assets.ts'
import {
  NATIVE_PAUSE_ART_RECORDS,
  NATIVE_PAUSE_EDGE_UV_START,
  NATIVE_PAUSE_TEXT_TINT,
  NATIVE_PAUSE_MENU_ROWS,
  nativePauseMenuRenderPlan,
  type NativeSimpleMenuAction,
  type NativeSimpleMenuRow,
  type NativePauseMenuRenderPlan,
} from '../pause-menu-contract.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
  type GameTextureMap,
  type GameWebGlApplication,
} from './game-webgl.ts'

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

interface FontAssets {
  readonly fonts: Readonly<Record<'menu', BitmapFont>>
}

interface UiAssets {
  readonly atlases: Readonly<Record<'UI', {
    readonly records: Readonly<Record<string, AtlasRecord>>
  }>>
}

interface RowView {
  readonly action: NativeSimpleMenuAction
  readonly label: Container
}

interface FrameView {
  readonly bottom: Sprite
  readonly bottomLeft: Sprite
  readonly bottomRight: Sprite
  readonly left: Sprite
  readonly right: Sprite
  readonly top: Sprite
  readonly topLeft: Sprite
  readonly topRight: Sprite
}

export interface GameplayPauseRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(reveal: number): void
}

const FONT_ASSETS = fontAssetsJson as unknown as FontAssets
const UI_ASSETS = uiAssetsJson as unknown as UiAssets
const MENU_FONT = FONT_ASSETS.fonts.menu
const UI_RECORDS = UI_ASSETS.atlases.UI.records
const STAGE_WIDTH = 1600
const STAGE_HEIGHT = 900

export async function createGameplayPauseRenderer(
  rows: readonly NativeSimpleMenuRow[] = NATIVE_PAUSE_MENU_ROWS,
): Promise<GameplayPauseRenderer> {
  let gpu: GameWebGlApplication | undefined
  let textures: GameTextureMap | undefined
  try {
    ;[gpu, textures] = await Promise.all([
      createGameWebGlApplication({
        backgroundAlpha: 0,
        className: 'gameplay-pause-canvas',
        height: STAGE_HEIGHT,
        resolution: 1,
        width: STAGE_WIDTH,
      }),
      loadGameTextureMap([skillPicker.fontsAtlas, skillPicker.uiAtlas]),
    ])
  } catch (error) {
    gpu?.application.destroy({ removeView: true })
    textures?.destroy()
    throw error
  }

  const application = gpu.application
  const resources = textures
  const root = new Container({ label: 'native-simple-menu' })
  const rowsLayer = new Container({ label: 'native-simple-menu-rows' })
  const chromeLayer = new Container({ label: 'native-simple-menu-chrome' })
  root.eventMode = 'none'
  rowsLayer.eventMode = 'none'
  chromeLayer.eventMode = 'none'
  root.addChild(rowsLayer, chromeLayer)
  application.stage.addChild(root)

  const idleRowTexture = textureForUiRecord(resources, NATIVE_PAUSE_ART_RECORDS.idleRow)
  const rowEndTexture = textureForUiRecord(resources, NATIVE_PAUSE_ART_RECORDS.rowEnd)
  const rowEdgeTexture = edgeTexture(
    resources,
    NATIVE_PAUSE_ART_RECORDS.rowEnd,
    'right',
  )
  const initialPlan = nativePauseMenuRenderPlan(0, null, rows)
  const rowViews = initialPlan.rows.map((row): RowView => {
    const body = new Sprite(idleRowTexture)
    body.position.set(row.bounds.left, row.bounds.top)
    body.eventMode = 'none'
    rowsLayer.addChild(body)

    const surroundLeft = row.bounds.left - 6
    const surroundTop = row.bounds.top - 6
    const surroundRight = row.bounds.left + row.bounds.width + 6
    const surroundWidth = surroundRight - surroundLeft
    const [rowEndWidth, rowEndHeight] = record(NATIVE_PAUSE_ART_RECORDS.rowEnd).logicalSize
    const leftEnd = new Sprite(rowEndTexture)
    leftEnd.position.set(surroundLeft, surroundTop)
    leftEnd.eventMode = 'none'
    const connector = new Sprite(rowEdgeTexture)
    connector.position.set(surroundLeft + rowEndWidth, surroundTop)
    connector.width = surroundWidth - rowEndWidth * 2
    connector.height = rowEndHeight
    connector.eventMode = 'none'
    const rightEnd = new Sprite(rowEndTexture)
    rightEnd.position.set(surroundRight, surroundTop)
    rightEnd.scale.x = -1
    rightEnd.eventMode = 'none'
    rowsLayer.addChild(leftEnd, connector, rightEnd)

    const label = createBitmapText(resources, row.label)
    label.position.set(row.labelX, row.labelY)
    rowsLayer.addChild(label)
    return { action: row.action, label }
  })

  const frameTexture = textureForUiRecord(resources, NATIVE_PAUSE_ART_RECORDS.frame)
  const frameHorizontalEdge = edgeTexture(
    resources,
    NATIVE_PAUSE_ART_RECORDS.frame,
    'right',
  )
  const frameVerticalEdge = edgeTexture(
    resources,
    NATIVE_PAUSE_ART_RECORDS.frame,
    'bottom',
  )
  const frame = createFrameView(
    chromeLayer,
    frameTexture,
    frameHorizontalEdge,
    frameVerticalEdge,
  )

  const header = new Sprite(textureForUiRecord(resources, NATIVE_PAUSE_ART_RECORDS.header))
  header.anchor.set(0.5)
  header.eventMode = 'none'
  chromeLayer.addChild(header)

  const arrowTexture = textureForUiRecord(resources, NATIVE_PAUSE_ART_RECORDS.arrow)
  const arrows = initialPlan.arrows.map(() => {
    const arrow = new Sprite(arrowTexture)
    arrow.anchor.set(0.5)
    arrow.eventMode = 'none'
    chromeLayer.addChild(arrow)
    return arrow
  })

  gpu.canvas.dataset.pauseRenderer = 'native-simple-menu'
  let frameRevision = 0
  let destroyed = false

  return {
    canvas: gpu.canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.destroy({ removeView: true })
      resources.destroy()
    },
    render(reveal) {
      if (destroyed) return
      const plan = nativePauseMenuRenderPlan(reveal, null, rows)
      root.alpha = plan.alpha
      updateRows(rowViews, plan)
      updateFrame(frame, plan)
      header.position.set(plan.header.x, plan.header.y)
      header.rotation = plan.header.rotation
      for (let index = 0; index < arrows.length; index += 1) {
        const definition = plan.arrows[index]!
        const arrow = arrows[index]!
        arrow.position.set(definition.x, definition.y)
        arrow.scale.set(definition.scale)
      }
      application.renderer.render(application.stage)
      frameRevision += 1
      gpu.canvas.dataset.pauseBodyRecords = plan.rows.map(({ bodyRecord }) => bodyRecord).join(',')
      gpu.canvas.dataset.pauseFrameRevision = `${frameRevision}`
      gpu.canvas.dataset.pauseReveal = `${plan.alpha}`
    },
  }
}

function createFrameView(
  layer: Container,
  cornerTexture: Texture,
  horizontalEdgeTexture: Texture,
  verticalEdgeTexture: Texture,
): FrameView {
  const topLeft = new Sprite(cornerTexture)
  const topRight = new Sprite(cornerTexture)
  const bottomLeft = new Sprite(cornerTexture)
  const bottomRight = new Sprite(cornerTexture)
  topRight.scale.x = -1
  bottomLeft.scale.y = -1
  bottomRight.scale.set(-1, -1)

  const top = new Sprite(horizontalEdgeTexture)
  const bottom = new Sprite(horizontalEdgeTexture)
  bottom.scale.y = -1
  const left = new Sprite(verticalEdgeTexture)
  const right = new Sprite(verticalEdgeTexture)
  right.scale.x = -1
  for (const sprite of [top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight]) {
    sprite.eventMode = 'none'
  }
  layer.addChild(top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight)
  return { bottom, bottomLeft, bottomRight, left, right, top, topLeft, topRight }
}

function updateFrame(frame: FrameView, plan: NativePauseMenuRenderPlan): void {
  const [cornerWidth, cornerHeight] = record(NATIVE_PAUSE_ART_RECORDS.frame).logicalSize
  const { bottom, height, left, right, top, width } = plan.chrome
  frame.topLeft.position.set(left, top)
  frame.topRight.position.set(right, top)
  frame.bottomLeft.position.set(left, bottom)
  frame.bottomRight.position.set(right, bottom)

  frame.top.position.set(left + cornerWidth, top)
  frame.top.width = width - cornerWidth * 2
  frame.top.height = cornerHeight
  frame.top.scale.y = Math.abs(frame.top.scale.y)

  frame.bottom.position.set(left + cornerWidth, bottom)
  frame.bottom.width = width - cornerWidth * 2
  frame.bottom.height = cornerHeight
  frame.bottom.scale.y = -Math.abs(frame.bottom.scale.y)

  frame.left.position.set(left, top + cornerHeight)
  frame.left.width = cornerWidth
  frame.left.height = height - cornerHeight * 2
  frame.left.scale.x = Math.abs(frame.left.scale.x)

  frame.right.position.set(right, top + cornerHeight)
  frame.right.width = cornerWidth
  frame.right.height = height - cornerHeight * 2
  frame.right.scale.x = -Math.abs(frame.right.scale.x)
}

function updateRows(
  views: readonly RowView[],
  plan: NativePauseMenuRenderPlan,
): void {
  for (const view of views) {
    const row = plan.rows.find(({ action }) => action === view.action)!
    view.label.position.set(row.labelX, row.labelY)
  }
}

function createBitmapText(resources: GameTextureMap, text: string): Container {
  const container = new Container({ label: text })
  container.eventMode = 'none'
  const width = measureBitmapText(text)
  let cursor = -width / 2
  let previous = -1
  for (const character of text) {
    const code = character.codePointAt(0)!
    if (character === ' ') {
      cursor += MENU_FONT.spaceAdvance
      previous = code
      continue
    }
    const glyph = MENU_FONT.glyphs[`${code}`]
    if (!glyph?.metrics) continue
    cursor += kerning(previous, code)
    const sprite = spriteForGlyph(resources, glyph)
    sprite.anchor.set(0.5)
    sprite.position.set(cursor + glyph.metrics[1], glyph.metrics[2])
    sprite.tint = NATIVE_PAUSE_TEXT_TINT
    sprite.eventMode = 'none'
    container.addChild(sprite)
    cursor += glyph.metrics[0]
    previous = code
  }
  return container
}

function measureBitmapText(text: string): number {
  let width = 0
  let previous = -1
  for (const character of text) {
    const code = character.codePointAt(0)!
    if (character === ' ') width += MENU_FONT.spaceAdvance
    else {
      const glyph = MENU_FONT.glyphs[`${code}`]
      if (glyph?.metrics) width += kerning(previous, code) + glyph.metrics[0]
    }
    previous = code
  }
  return width
}

function kerning(first: number, second: number): number {
  if (first < 0) return 0
  return MENU_FONT.kerning.find(([left, right]) => left === first && right === second)?.[2] ?? 0
}

function spriteForGlyph(resources: GameTextureMap, glyph: AtlasRecord): Sprite {
  const source = textureFrom(resources.textures, skillPicker.fontsAtlas)
  const [x, y, width, height] = glyph.frame
  return new Sprite(new Texture({
    frame: new Rectangle(x, y, width, height),
    source: source.source,
  }))
}

function textureForUiRecord(resources: GameTextureMap, recordId: number): Texture {
  const atlasRecord = record(recordId)
  const source = textureFrom(resources.textures, skillPicker.uiAtlas)
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

function edgeTexture(
  resources: GameTextureMap,
  recordId: number,
  edge: 'bottom' | 'right',
): Texture {
  const atlasRecord = record(recordId)
  const source = textureFrom(resources.textures, skillPicker.uiAtlas)
  const [x, y, width, height] = atlasRecord.frame
  if (edge === 'right') {
    const edgeWidth = width * (1 - NATIVE_PAUSE_EDGE_UV_START)
    return new Texture({
      frame: new Rectangle(x + width - edgeWidth, y, edgeWidth, height),
      source: source.source,
    })
  }
  const edgeHeight = height * (1 - NATIVE_PAUSE_EDGE_UV_START)
  return new Texture({
    frame: new Rectangle(x, y + height - edgeHeight, width, edgeHeight),
    source: source.source,
  })
}

function record(recordId: number): AtlasRecord {
  const atlasRecord = UI_RECORDS[`${recordId}`]
  if (!atlasRecord) throw new Error(`native UI.${recordId} was not extracted`)
  return atlasRecord
}
