import { Container, Sprite, Texture } from 'pixi.js'

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
  type GameTextureMap,
  type GameWebGlApplication,
} from './game-webgl.ts'
import { nativeUiRecord } from '../native-ui/native-ui-catalog.ts'
import { createNativeUiPixiAdapter } from '../native-ui/native-ui-pixi.ts'

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
      loadGameTextureMap({
        stock: [skillPicker.fontsAtlas, skillPicker.uiAtlas],
      }),
    ])
  } catch (error) {
    gpu?.application.destroy({ removeView: true })
    textures?.destroy()
    throw error
  }

  const application = gpu.application
  const resources = textures
  const nativeUi = createNativeUiPixiAdapter(resources)
  const root = new Container({ label: 'native-simple-menu' })
  const rowsLayer = new Container({ label: 'native-simple-menu-rows' })
  const chromeLayer = new Container({ label: 'native-simple-menu-chrome' })
  root.eventMode = 'none'
  rowsLayer.eventMode = 'none'
  chromeLayer.eventMode = 'none'
  root.addChild(rowsLayer, chromeLayer)
  application.stage.addChild(root)

  const idleRowTexture = nativeUi.texture('UI', NATIVE_PAUSE_ART_RECORDS.idleRow)
  const rowEndTexture = nativeUi.texture('UI', NATIVE_PAUSE_ART_RECORDS.rowEnd)
  const rowEdgeTexture = nativeUi.slice(
    'UI',
    NATIVE_PAUSE_ART_RECORDS.rowEnd,
    [NATIVE_PAUSE_EDGE_UV_START, 0, 1, 1],
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
    const [rowEndWidth, rowEndHeight] = nativeUiRecord('UI', NATIVE_PAUSE_ART_RECORDS.rowEnd).logicalSize
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

    const label = nativeUi.text({
      font: 'menu',
      text: row.label,
      tint: NATIVE_PAUSE_TEXT_TINT,
      x: 0,
      y: 0,
    })
    label.position.set(row.labelX, row.labelY)
    rowsLayer.addChild(label)
    return { action: row.action, label }
  })

  const frameTexture = nativeUi.texture('UI', NATIVE_PAUSE_ART_RECORDS.frame)
  const frameHorizontalEdge = nativeUi.slice(
    'UI',
    NATIVE_PAUSE_ART_RECORDS.frame,
    [NATIVE_PAUSE_EDGE_UV_START, 0, 1, 1],
  )
  const frameVerticalEdge = nativeUi.slice(
    'UI',
    NATIVE_PAUSE_ART_RECORDS.frame,
    [0, NATIVE_PAUSE_EDGE_UV_START, 1, 1],
  )
  const frame = createFrameView(
    chromeLayer,
    frameTexture,
    frameHorizontalEdge,
    frameVerticalEdge,
  )

  const header = new Sprite(nativeUi.texture('UI', NATIVE_PAUSE_ART_RECORDS.header))
  header.anchor.set(0.5)
  header.eventMode = 'none'
  chromeLayer.addChild(header)

  const arrowTexture = nativeUi.texture('UI', NATIVE_PAUSE_ART_RECORDS.arrow)
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
      nativeUi.destroy()
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
  const [cornerWidth, cornerHeight] = nativeUiRecord('UI', NATIVE_PAUSE_ART_RECORDS.frame).logicalSize
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
