import {
  Container,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js'

import { mainMenu } from '../../lib/assets.ts'
import {
  TITLE_BUILD_REVISION,
  layoutTitleBuildRevisionLabel,
} from '../title-build-revision.ts'
import {
  fixedGamePresentationResolution,
  fixedGameStageBounds,
  type FixedGameViewportLayout,
} from './game-viewport.ts'
import {
  TITLE_CLOUD_HEIGHT,
  TITLE_CLOUD_WIDTH,
  TITLE_GRAVE_REGISTRATION,
  TITLE_MAIN_MENU_ATLAS_RECORDS,
  TITLE_RENDER_HEIGHT,
  TITLE_RENDER_WIDTH,
  TITLE_SOLOMON_LAYER_Z,
  createTitleGraveRows,
  stepTitleGraveRow,
  tileStart,
  titleBackdropOffsetsAt,
  titleSolomonCloakPasses,
  type TitleGraveRowState,
} from './title-menu-render-contract.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
} from './game-webgl.ts'
import { nativeSpriteRecordTexture } from './native-sprite-record-texture.ts'
import {
  TITLE_COMPOSITED_ASSET_SOURCES,
  TITLE_STOCK_ASSET_SOURCES,
  TITLE_STOCK_POINT_ASSET_SOURCES,
} from '../game-assets.ts'
import { createNativeUiPixiAdapter } from '../native-ui/pixi.ts'
import {
  type TitleMenuPromptAction,
  type TitleMenuPromptKind,
} from '../title-menu-prompt.ts'

export type TitleMenuScreen = 'root' | 'play'
export type TitleMenuAction =
  | 'back'
  | 'explore'
  | 'hall'
  | 'last-game'
  | 'join-party'
  | 'new-game'
  | 'play'
  | 'settings'
  | 'unavailable'
  | TitleMenuPromptAction

export interface TitleMenuRenderFrame {
  canResume: boolean
  elapsedMs: number
  hoveredAction: TitleMenuAction | null
  pressedAction: TitleMenuAction | null
  prompt: TitleMenuPromptKind | null
  promptBusy: boolean
  reducedMotion: boolean
  screen: TitleMenuScreen
}

export interface TitleMenuRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  render(frame: TitleMenuRenderFrame): void
  resize(viewport: FixedGameViewportLayout, devicePixelRatio?: number): void
}

interface TitleMenuRendererOptions {
  devicePixelRatio?: number
  viewport: FixedGameViewportLayout
}

interface GraveRowView {
  container: Container
  sprites: Sprite[]
}

interface ButtonView {
  action: TitleMenuAction
  container: Container
  hover: Sprite
  label: Container
}

const MAIN_BUTTON_X = 674.5
const MAIN_BUTTON_Y = 421
const MAIN_BUTTON_GAP = 7
const MAIN_BUTTON_HEIGHT = 69

export async function createTitleMenuRenderer(
  options: TitleMenuRendererOptions,
): Promise<TitleMenuRenderer> {
  const textures = await loadGameTextureMap({
    composited: TITLE_COMPOSITED_ASSET_SOURCES,
    stock: TITLE_STOCK_ASSET_SOURCES,
    stockPoint: TITLE_STOCK_POINT_ASSET_SOURCES,
  })
  const resolution = fixedGamePresentationResolution(
    options.devicePixelRatio ?? window.devicePixelRatio,
    options.viewport.displayScale,
  )
  let gpu
  try {
    gpu = await createGameWebGlApplication({
      className: 'title-menu-canvas',
      height: options.viewport.height,
      resolution,
      width: options.viewport.width,
    })
  } catch (error) {
    textures.destroy()
    throw error
  }
  const { application, canvas } = gpu
  canvas.dataset.buildLabel = TITLE_BUILD_REVISION.label
  canvas.dataset.buildRevision = TITLE_BUILD_REVISION.full ?? 'local'
  canvas.dataset.textureSources = JSON.stringify(textures.sources)
  const texture = (source: string) => textureFrom(textures.textures, source)
  const nativeUi = createNativeUiPixiAdapter(textures)
  const titleTexture = (record: number) => (
    nativeUi.slice('Title', record, [0, 0, 1, 1])
  )
  canvas.dataset.compositedTextureAddress = texture(mainMenu.logo).source.addressMode
  canvas.dataset.compositedTextureAlpha = texture(mainMenu.logo).source.alphaMode
  const fontAtlas = texture(TITLE_STOCK_POINT_ASSET_SOURCES[0])
  canvas.dataset.nativeTextureAddress = fontAtlas.source.addressMode
  canvas.dataset.nativeTextureAlpha = fontAtlas.source.alphaMode
  canvas.dataset.titleTextureAddress = titleTexture(
    TITLE_MAIN_MENU_ATLAS_RECORDS.solomonBody,
  ).source.addressMode
  canvas.dataset.titleTextureAlpha = titleTexture(
    TITLE_MAIN_MENU_ATLAS_RECORDS.solomonBody,
  ).source.alphaMode
  const root = new Container({ label: 'title-menu' })
  root.sortableChildren = true
  root.eventMode = 'none'
  application.stage.addChild(root)
  const backdrop = new Container({ label: 'title-menu-backdrop' })
  backdrop.sortableChildren = true
  backdrop.zIndex = 0
  const solomonStage = titleStage('title-menu-solomon-stage', 20)
  const centerStage = titleStage('title-menu-center-stage', 21)
  const versionStage = titleStage('title-menu-version-stage', 22)
  root.addChild(
    backdrop,
    solomonStage,
    centerStage,
    versionStage,
  )

  const gradients: FillGradient[] = []
  const background = new Graphics().rect(
    0, 0, TITLE_RENDER_WIDTH, TITLE_RENDER_HEIGHT,
  ).fill(0x000000)
  background.zIndex = 0
  backdrop.addChild(background)

  const cloudBase = tiledSprites(
    titleTexture(TITLE_MAIN_MENU_ATLAS_RECORDS.cloudBase), 3, 1,
  )
  const cloudDetail = tiledSprites(
    titleTexture(TITLE_MAIN_MENU_ATLAS_RECORDS.cloudDetail), 3, 3,
  )
  const cloudShadow = tiledSprites(
    titleTexture(TITLE_MAIN_MENU_ATLAS_RECORDS.cloudShadow), 3, 4,
  )
  const horizon = tiledSprites(
    titleTexture(TITLE_MAIN_MENU_ATLAS_RECORDS.horizon), 4, 5,
  )
  const grass = tiledSprites(titleTexture(TITLE_MAIN_MENU_ATLAS_RECORDS.grass), 4, 15)
  backdrop.addChild(cloudBase.container)
  backdrop.addChild(stageSprite(
    titleTexture(TITLE_MAIN_MENU_ATLAS_RECORDS.moon), 1304, 101.5, 192, 192, 2,
  ))
  backdrop.addChild(cloudDetail.container, cloudShadow.container, horizon.container)

  const graveTextures = TITLE_MAIN_MENU_ATLAS_RECORDS.graves.map(
    (record) => titleTexture(record),
  )
  const graveWidths = graveTextures.map((graveTexture) => graveTexture.width)
  const graveSimulation = createTitleGraveRows(
    graveWidths,
  )
  const graveViews = graveSimulation.rows.map((_, index) => ({
    container: Object.assign(new Container({ label: `title-graves-${index}` }), {
      zIndex: 6 + index * 3,
    }),
    sprites: [],
  }))
  const fog0 = fogGradient(365, TITLE_RENDER_HEIGHT - 365, 0.7, gradients)
  fog0.zIndex = 7
  const fog1 = fogGradient(365, TITLE_RENDER_HEIGHT - 365, 0.7, gradients)
  fog1.zIndex = 10
  const interRowFog = fogGradient(500, 212, 1, gradients)
  interRowFog.zIndex = 11
  const lowerFog = new Graphics().rect(0, 712, TITLE_RENDER_WIDTH, 188).fill(0x282d3f)
  lowerFog.zIndex = 12
  const fog2 = fogGradient(365, TITLE_RENDER_HEIGHT - 365, 0.7, gradients)
  fog2.zIndex = 14
  backdrop.addChild(
    graveViews[0].container,
    fog0,
    graveViews[1].container,
    fog1,
    interRowFog,
    lowerFog,
    graveViews[2].container,
    fog2,
    grass.container,
  )

  const solomon = createSolomonView(titleTexture)
  solomon.container.zIndex = 20
  solomonStage.addChild(solomon.container)
  centerStage.addChild(containedSprite(texture(mainMenu.logo), 435.5, 0, 829, 395, 21))
  const buildRevision = createTitleBuildRevisionView(fontAtlas)
  versionStage.addChild(buildRevision.container)
  centerStage.addChild(stageSprite(texture(mainMenu.flourish), 601, 440, 67, 262, 23))
  const rightFlourish = stageSprite(texture(mainMenu.flourish), 1102, 440, 67, 262, 23)
  rightFlourish.scale.x = -1
  centerStage.addChild(rightFlourish)

  const rootButtons = new Container({ label: 'title-root-buttons' })
  const playButtons = new Container({ label: 'title-play-buttons' })
  rootButtons.zIndex = 24
  playButtons.zIndex = 24
  const rootButtonViews = [
    createMainButton(texture, 'play', 0, [['play', mainMenu.text.play]]),
    createMainButton(texture, 'explore', 1, [
      ['explore', mainMenu.text.explore],
      ['dark-cloud', mainMenu.text.darkCloud],
    ]),
    createMainButton(texture, 'settings', 2, [['settings', mainMenu.text.settings]]),
    createMainButton(texture, 'hall', 3, [['hall', mainMenu.text.hall]]),
  ]
  const playButtonViews = [
    createMainButton(texture, 'last-game', 0, [
      ['resume', mainMenu.text.resume],
      ['last-game', mainMenu.text.lastGame],
    ]),
    createMainButton(texture, 'new-game', 1, [['new-game', mainMenu.text.newGame]]),
    createMainButton(texture, 'join-party', 2, []),
    createMainButton(texture, 'back', 3, [['back', mainMenu.text.back]]),
  ]
  rootButtons.addChild(...rootButtonViews.map((button) => button.container))
  playButtons.addChild(...playButtonViews.map((button) => button.container))
  centerStage.addChild(rootButtons, playButtons)
  const allButtons = [...rootButtonViews, ...playButtonViews]

  let destroyed = false
  let simulatedTicks = 0
  let currentResolution = resolution
  let currentViewport = options.viewport
  let solomonTick = 0
  let solomonPhase = 0
  let presentedSimulationTick = -1
  let presentedHoveredAction: TitleMenuAction | null | undefined
  let presentedPressedAction: TitleMenuAction | null | undefined
  let presentedCanResume: boolean | undefined
  let presentedScreen: TitleMenuScreen | undefined
  const diagnostics = {
    canResume: false,
    frameCount: 0,
    graveCounts: graveSimulation.rows.map((row) => row.graves.length),
    screen: 'root' as TitleMenuScreen,
    solomonFrame: 0,
    viewportHeight: options.viewport.height,
    viewportWidth: options.viewport.width,
  }
  Object.defineProperty(canvas, '__sdrTitleFrame', {
    configurable: false,
    enumerable: false,
    value: diagnostics,
    writable: false,
  })

  const renderer: TitleMenuRenderer = {
    canvas,
    render(frame) {
      if (destroyed) return
      const elapsedSeconds = frame.reducedMotion ? 0 : Math.max(0, frame.elapsedMs) / 1000
      const targetTicks = Math.floor(elapsedSeconds * 60)
      while (simulatedTicks < targetTicks) {
        for (const row of graveSimulation.rows) {
          stepTitleGraveRow(graveWidths, row, graveSimulation.random)
        }
        const theta = solomonTick * Math.PI / 180
        solomonPhase = (solomonPhase + 0.025 + 0.005 * Math.sin(theta)) % 5
        solomonTick += 1
        simulatedTicks += 1
      }
      const offsets = titleBackdropOffsetsAt(elapsedSeconds)
      positionTiles(cloudBase.sprites, 0, TITLE_CLOUD_WIDTH, 0, TITLE_CLOUD_HEIGHT)
      positionTiles(
        cloudDetail.sprites,
        offsets.cloudDetail,
        TITLE_CLOUD_WIDTH,
        0,
        TITLE_CLOUD_HEIGHT,
      )
      positionTiles(
        cloudShadow.sprites,
        offsets.cloudShadow,
        TITLE_CLOUD_WIDTH,
        0,
        TITLE_CLOUD_HEIGHT,
      )
      positionTiles(horizon.sprites, offsets.horizon, 1024, 522, 31)
      positionTiles(grass.sprites, offsets.grass, 1024, 829, 71)
      if (presentedSimulationTick !== targetTicks) {
        for (let index = 0; index < graveSimulation.rows.length; index += 1) {
          syncGraveRow(graveViews[index], graveSimulation.rows[index], graveTextures)
        }
        updateSolomon(solomon, solomonPhase, solomonTick)
        presentedSimulationTick = targetTicks
      }
      if (presentedScreen !== frame.screen) {
        rootButtons.visible = frame.screen === 'root'
        playButtons.visible = frame.screen === 'play'
        presentedScreen = frame.screen
      }
      if (presentedCanResume !== frame.canResume) {
        playButtonViews[0].label.alpha = frame.canResume ? 1 : 0.36
        presentedCanResume = frame.canResume
      }
      if (presentedHoveredAction !== frame.hoveredAction
        || presentedPressedAction !== frame.pressedAction) {
        for (const button of allButtons) {
          button.hover.alpha = frame.hoveredAction === button.action ? 1 : 0
          button.label.position.set(
            frame.pressedAction === button.action ? 6 : 0,
            frame.pressedAction === button.action ? 6 : 0,
          )
        }
        presentedHoveredAction = frame.hoveredAction
        presentedPressedAction = frame.pressedAction
      }
      application.render()
      diagnostics.frameCount += 1
      diagnostics.canResume = frame.canResume
      diagnostics.graveCounts = graveSimulation.rows.map((row) => row.graves.length)
      diagnostics.screen = frame.screen
      diagnostics.solomonFrame = Math.floor(solomonPhase)
      canvas.dataset.screen = frame.screen
      canvas.dataset.canResume = `${frame.canResume}`
      canvas.dataset.prompt = frame.prompt ?? 'none'
    },
    resize(viewport, nextDevicePixelRatio = window.devicePixelRatio) {
      if (destroyed) return
      const nextResolution = fixedGamePresentationResolution(
        nextDevicePixelRatio,
        viewport.displayScale,
      )
      if (nextResolution === currentResolution
        && viewport.width === currentViewport.width
        && viewport.height === currentViewport.height
        && viewport.nativeStage.x === currentViewport.nativeStage.x
        && viewport.nativeStage.y === currentViewport.nativeStage.y) return
      currentResolution = nextResolution
      currentViewport = viewport
      applyTitleViewport(
        application,
        backdrop,
        solomonStage,
        centerStage,
        versionStage,
        viewport,
        currentResolution,
      )
      canvas.dataset.resolution = `${currentResolution}`
      diagnostics.viewportHeight = viewport.height
      diagnostics.viewportWidth = viewport.width
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      application.stage.removeChild(root)
      root.destroy({ children: true })
      for (const gradient of gradients) gradient.destroy()
      for (const glyphTexture of buildRevision.glyphTextures) glyphTexture.destroy(false)
      nativeUi.destroy()
      textures.destroy()
      application.destroy({ removeView: true })
      canvas.remove()
    },
  }
  applyTitleViewport(
    application,
    backdrop,
    solomonStage,
    centerStage,
    versionStage,
    options.viewport,
    resolution,
  )
  renderer.render({
    canResume: false,
    elapsedMs: 0,
    hoveredAction: null,
    pressedAction: null,
    prompt: null,
    promptBusy: false,
    reducedMotion: false,
    screen: 'root',
  })
  return renderer
}

function applyTitleViewport(
  application: Application,
  backdrop: Container,
  solomonStage: Container,
  centerStage: Container,
  versionStage: Container,
  viewport: FixedGameViewportLayout,
  resolution: number,
): void {
  application.renderer.resize(viewport.width, viewport.height, resolution)
  const backdropScale = Math.max(
    viewport.width / TITLE_RENDER_WIDTH,
    viewport.height / TITLE_RENDER_HEIGHT,
  )
  backdrop.scale.set(backdropScale)
  backdrop.position.set(
    (viewport.width - TITLE_RENDER_WIDTH * backdropScale) / 2,
    viewport.height - TITLE_RENDER_HEIGHT * backdropScale,
  )
  const solomonBounds = fixedGameStageBounds(viewport, 'left', 'bottom')
  const centerBounds = fixedGameStageBounds(viewport, 'center', 'center')
  const versionBounds = fixedGameStageBounds(viewport, 'right', 'top')
  solomonStage.position.set(solomonBounds.x, solomonBounds.y)
  centerStage.position.set(centerBounds.x, centerBounds.y)
  versionStage.position.set(versionBounds.x, versionBounds.y)
  const canvas = application.canvas as HTMLCanvasElement
  canvas.dataset.centerStage = `${centerBounds.x},${centerBounds.y}`
  canvas.dataset.solomonStage = `${solomonBounds.x},${solomonBounds.y}`
  canvas.dataset.versionStage = `${versionBounds.x},${versionBounds.y}`
  canvas.dataset.viewportHeight = `${viewport.height}`
  canvas.dataset.viewportWidth = `${viewport.width}`
}

function titleStage(label: string, zIndex: number): Container {
  const stage = new Container({ label })
  stage.eventMode = 'none'
  stage.sortableChildren = true
  stage.zIndex = zIndex
  return stage
}

function createTitleBuildRevisionView(atlas: Texture): {
  container: Container
  glyphTextures: Texture[]
} {
  const layout = layoutTitleBuildRevisionLabel(TITLE_BUILD_REVISION.label)
  const container = new Container({ label: 'title-build-revision' })
  const glyphTextures: Texture[] = []
  container.eventMode = 'none'
  container.position.set(TITLE_RENDER_WIDTH - 1 - layout.right, 12)

  for (const glyph of layout.glyphs) {
    const glyphTexture = nativeSpriteRecordTexture({
      frame: new Rectangle(
        glyph.atlasX,
        glyph.atlasY,
        glyph.width,
        glyph.height,
      ),
      source: atlas.source,
    })
    const sprite = new Sprite(glyphTexture)
    sprite.eventMode = 'none'
    sprite.position.set(glyph.left, glyph.top)
    sprite.tint = 0xd8ba70
    glyphTextures.push(glyphTexture)
    container.addChild(sprite)
  }

  return { container, glyphTextures }
}

function tiledSprites(texture: Texture, count: number, zIndex: number) {
  const container = new Container()
  container.zIndex = zIndex
  const sprites = Array.from({ length: count }, () => {
    const sprite = new Sprite(texture)
    sprite.eventMode = 'none'
    container.addChild(sprite)
    return sprite
  })
  return { container, sprites }
}

function positionTiles(
  sprites: readonly Sprite[],
  offset: number,
  width: number,
  y: number,
  height: number,
): void {
  const start = tileStart(offset, width)
  for (let index = 0; index < sprites.length; index += 1) {
    const sprite = sprites[index]
    sprite.position.set(start + index * width, y)
    sprite.width = width
    sprite.height = height
  }
}

function fogGradient(
  y: number,
  height: number,
  bottomAlpha: number,
  gradients: FillGradient[],
): Graphics {
  const gradient = new FillGradient({
    colorStops: [
      { color: 'rgba(41, 46, 64, 0)', offset: 0 },
      { color: `rgba(41, 46, 64, ${bottomAlpha})`, offset: 1 },
    ],
    end: { x: 0, y: 1 },
    start: { x: 0, y: 0 },
    textureSpace: 'local',
  })
  gradients.push(gradient)
  return new Graphics().rect(0, y, TITLE_RENDER_WIDTH, height).fill(gradient)
}

function syncGraveRow(
  view: GraveRowView,
  row: TitleGraveRowState,
  textures: readonly Texture[],
): void {
  while (view.sprites.length < row.graves.length) {
    const sprite = new Sprite()
    sprite.eventMode = 'none'
    view.container.addChild(sprite)
    view.sprites.push(sprite)
  }
  for (let index = 0; index < view.sprites.length; index += 1) {
    const sprite = view.sprites[index]
    const grave = row.graves[index]
    sprite.visible = Boolean(grave)
    if (!grave) continue
    const graveTexture = textures[grave.imageIndex]
    const [centerX, centerY] = TITLE_GRAVE_REGISTRATION[grave.imageIndex]
    sprite.texture = graveTexture
    sprite.anchor.set(
      0.5 - centerX / graveTexture.width,
      0.5 - centerY / graveTexture.height,
    )
    sprite.position.set(grave.x, row.baseline)
    sprite.rotation = grave.rotation * Math.PI / 180
    sprite.scale.set(row.scale)
    sprite.tint = row.gray === 1
      ? 0xffffff
      : row.gray === 0.5
        ? 0x808080
        : 0x000000
  }
}

function createSolomonView(titleTexture: (record: number) => Texture) {
  const container = new Container({ label: 'title-solomon' })
  container.position.set(0, 300)
  container.sortableChildren = true
  const body = stageSprite(
    titleTexture(TITLE_MAIN_MENU_ATLAS_RECORDS.solomonBody),
    48, 106, 208, 498, TITLE_SOLOMON_LAYER_Z.body,
  )
  const eyes = stageSprite(
    titleTexture(TITLE_MAIN_MENU_ATLAS_RECORDS.solomonEyes),
    50, 230, 171, 30, TITLE_SOLOMON_LAYER_Z.eyes,
  )
  const cloaks = Array.from({ length: 4 }, () => {
    const sprite = new Sprite()
    sprite.eventMode = 'none'
    sprite.zIndex = TITLE_SOLOMON_LAYER_Z.cloak
    return sprite
  })
  const cloakTextures = TITLE_MAIN_MENU_ATLAS_RECORDS.solomonCloaks.map(
    (record) => titleTexture(record),
  )
  container.addChild(body, eyes, ...cloaks)
  return { cloakTextures, cloaks, container, eyes }
}

function updateSolomon(
  view: ReturnType<typeof createSolomonView>,
  phase: number,
  tick: number,
): void {
  for (const [spriteIndex, pass] of titleSolomonCloakPasses(phase).entries()) {
    const sprite = view.cloaks[spriteIndex]
    sprite.texture = view.cloakTextures[pass.index]
    sprite.position.set(-40, pass.y)
    sprite.width = 366
    sprite.height = pass.height
    sprite.alpha = pass.alpha
  }
  view.eyes.y = 230 + Math.sin(tick * Math.PI / 180)
}

function createMainButton(
  texture: (source: string) => Texture,
  action: TitleMenuAction,
  row: number,
  labels: readonly (readonly [string, string])[],
  labelAlpha = 1,
): ButtonView {
  const view = createButtonChrome(texture, action, 353, 69)
  view.container.position.set(
    MAIN_BUTTON_X,
    MAIN_BUTTON_Y + row * (MAIN_BUTTON_HEIGHT + MAIN_BUTTON_GAP),
  )
  addLabels(view.label, texture, labels, 353, 69, labelAlpha)
  return view
}

function createButtonChrome(
  texture: (source: string) => Texture,
  action: TitleMenuAction,
  width: number,
  height: number,
): ButtonView {
  const container = new Container({ label: `title-button-${action}` })
  const stone = stageSprite(texture(mainMenu.button), 0, 0, width, height, 0)
  const hover = stageSprite(texture(mainMenu.buttonHover), 0, 0, width, height, 1)
  hover.alpha = 0
  const cornerTexture = texture(mainMenu.buttonCorner)
  const railTexture = texture(mainMenu.buttonRail)
  const cornerWidth = 70
  const chromeHeight = 85
  const chromeTop = -6
  const cornerOffset = -6
  const railX = 64
  const railWidth = 225
  const left = stageSprite(cornerTexture, cornerOffset, chromeTop, cornerWidth, chromeHeight, 2)
  const right = stageSprite(
    cornerTexture,
    width - cornerOffset,
    chromeTop,
    cornerWidth,
    chromeHeight,
    2,
  )
  right.scale.x = -1
  const rail = stageSprite(railTexture, railX, chromeTop, railWidth, chromeHeight, 2)
  const label = new Container({ label: `title-button-${action}-label` })
  label.zIndex = 3
  container.addChild(stone, hover, left, right, rail, label)
  return { action, container, hover, label }
}

function addLabels(
  container: Container,
  texture: (source: string) => Texture,
  labels: readonly (readonly [string, string])[],
  width: number,
  height: number,
  alpha: number,
): void {
  if (labels.length === 0) return
  const textures = labels.map(([, source]) => texture(source))
  const totalHeight = textures.reduce((sum, labelTexture) => sum + labelTexture.height, 0)
  let y = (height - totalHeight) / 2
  for (let index = 0; index < textures.length; index += 1) {
    const labelTexture = textures[index]
    const sprite = new Sprite(labelTexture)
    sprite.position.set((width - labelTexture.width) / 2, y)
    sprite.alpha = alpha
    sprite.eventMode = 'none'
    sprite.label = labels[index][0]
    container.addChild(sprite)
    y += labelTexture.height
  }
}

function stageSprite(
  texture: Texture,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
): Sprite {
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  sprite.width = width
  sprite.height = height
  sprite.zIndex = zIndex
  sprite.eventMode = 'none'
  return sprite
}

function containedSprite(
  texture: Texture,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
): Sprite {
  const scale = Math.min(width / texture.width, height / texture.height)
  const targetWidth = texture.width * scale
  const targetHeight = texture.height * scale
  return stageSprite(
    texture,
    x + (width - targetWidth) / 2,
    y + (height - targetHeight) / 2,
    targetWidth,
    targetHeight,
    zIndex,
  )
}
