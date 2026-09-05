import { nativeUiGlyphRecordTexture } from '../native-ui/native-ui-glyph-texture.ts'
import type { NativeUiCanvas } from './native-ui-canvas.ts'
import {
  Container,
  FillGradient,
  Graphics,
  Sprite,
  Texture,
  type Application,
} from 'pixi.js'

import { createMenu } from '../../lib/assets.ts'
import {
  CREATE_ENTRY_ANIMATION_MS,
  CREATE_SELECTION_ANIMATION_MS,
  createDisciplineRevealMotionAt,
  createElementRevealMotionAt,
  createEntryMotionAt,
  createHandIdleOffsetAt,
  createSelectedElementMotionAt,
  createSelectionMotionAt,
  type CreateHandPose,
} from '../create-menu-motion.ts'
import type {
  WizardDiscipline,
  WizardElement,
} from '../core-kernels/player-character.ts'
import {
  layoutCreateWizardName,
  validateCreateWizardName,
} from '../create-wizard-name.ts'
import { NATIVE_ELEMENT_VFX_SCALE } from '../element-vfx-native.ts'
import {
  CREATE_ATLAS_RECORDS,
  CREATE_DISCIPLINES,
  CREATE_DISCIPLINE_SIZE,
  CREATE_ELEMENTS,
  CREATE_ELEMENT_SIZE,
  CREATE_HAND_CENTERS,
  CREATE_HAND_LOGICAL_SIZE,
  CREATE_HAND_SIZE,
  CREATE_STARS,
  CREATE_UI_ATLAS_RECORDS,
  createEntryFlashAlpha,
  createSelectionFlashAlpha,
  createStarPresentation,
} from './create-menu-render-contract.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  textureFrom,
} from './game-webgl.ts'
import {
  CREATE_COMPOSITED_ASSET_SOURCES,
  CREATE_STOCK_ASSET_SOURCES,
  CREATE_STOCK_POINT_ASSET_SOURCES,
} from '../game-assets.ts'
import { createNativeUiPixiAdapter } from '../native-ui/pixi.ts'
import {
  fixedGameStageBounds,
  type FixedGameViewportLayout,
} from './game-viewport.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import { createNativeElementVfxTextures } from './world-player-textures.ts'
import {
  BONEYARD_COMBAT_ATLAS_SOURCES,
  boneyardCombatAtlasSourceIsPacked,
  createBoneyardCombatAtlas,
} from './boneyard-combat-atlas.ts'

export type CreateMenuAction = 'back' | WizardElement | WizardDiscipline
export type CreateMenuPhase = 'discipline' | 'element'

export interface CreateMenuRenderFrame {
  applicationTick: number
  displayName: string
  hoveredAction: CreateMenuAction | null
  phase: CreateMenuPhase
  phaseElapsedMs: number
  reducedMotion: boolean
  sceneElapsedMs: number
  selectedElement: WizardElement | null
}

export interface CreateMenuRenderer extends NativeUiCanvas {
  render(frame: CreateMenuRenderFrame): void
  resize(viewport: FixedGameViewportLayout): void
}

interface CreateMenuRendererOptions {
  viewport: FixedGameViewportLayout
}

interface ElementView {
  container: Container
  glyph: Sprite
  highlight: Sprite
  vfx: NativeElementVfxView
}

interface DisciplineView {
  container: Container
  highlight: Sprite
}

interface CreateNameView {
  atlas: Texture
  container: Container
  glyphTextures: Map<string, Texture>
  value: Container
  valueName: string | null
}

interface HandView {
  container: Container
  pose: CreateHandPose | null
  sprites: Sprite[]
}

export async function createCreateMenuRenderer(
  options: CreateMenuRendererOptions,
): Promise<CreateMenuRenderer> {
  const textures = await loadGameTextureMap({
    composited: CREATE_COMPOSITED_ASSET_SOURCES,
    stock: [
      ...CREATE_STOCK_ASSET_SOURCES,
      BONEYARD_COMBAT_ATLAS_SOURCES[0]!,
    ],
    stockPoint: CREATE_STOCK_POINT_ASSET_SOURCES,
  })
  let gpu
  try {
    gpu = await createGameWebGlApplication({
      className: 'create-menu-canvas',
      height: options.viewport.height,
      width: options.viewport.width,
    })
  } catch (error) {
    textures.destroy()
    throw error
  }

  const { application, canvas } = gpu
  const texture = (source: string) => textureFrom(textures.textures, source)
  const nativeUi = createNativeUiPixiAdapter(textures)
  const createTexture = (record: number) => (
    nativeUi.slice('Create', record, [0, 0, 1, 1])
  )
  const createLogicalTexture = (record: number) => nativeUi.texture('Create', record)
  const combatAtlas = createBoneyardCombatAtlas(texture)
  const vfxTextures = createNativeElementVfxTextures((source) => (
    boneyardCombatAtlasSourceIsPacked(source) ? combatAtlas.single(source) : texture(source)
  ))
  canvas.dataset.textureSources = JSON.stringify(textures.sources)
  canvas.dataset.compositedTextureAddress = texture(
    createMenu.textNameCaption,
  ).source.addressMode
  canvas.dataset.compositedTextureAlpha = texture(
    createMenu.textNameCaption,
  ).source.alphaMode
  canvas.dataset.createTextureAddress = createTexture(
    CREATE_ATLAS_RECORDS.hands.raised[0],
  ).source.addressMode
  canvas.dataset.createTextureAlpha = createTexture(
    CREATE_ATLAS_RECORDS.hands.raised[0],
  ).source.alphaMode
  canvas.dataset.nativeTextureAddress = vfxTextures.fire[0]!.source.addressMode
  canvas.dataset.nativeTextureAlpha = vfxTextures.fire[0]!.source.alphaMode
  canvas.dataset.nativeRecordUvs = JSON.stringify({
    etherCore: textureUvs(vfxTextures.core[0]!),
    etherRay: textureUvs(vfxTextures.ray[0]!),
    fireFrame258: textureUvs(vfxTextures.fire[3]!),
    waterFrame275: textureUvs(vfxTextures.water[4]!),
  })

  const root = new Container({ label: 'create-menu' })
  root.eventMode = 'none'
  root.sortableChildren = true
  application.stage.addChild(root)
  const nativeActionStage = createStage('create-menu-native-action-stage', 1)
  const nativeBackStage = createStage('create-menu-native-back-stage', 2)
  const nativeNameStage = createStage('create-menu-native-name-stage', 2)
  const nativeDiceStage = createStage('create-menu-native-dice-stage', 2)
  const gradients: FillGradient[] = []

  const backgroundGradient = new FillGradient({
    colorStops: [
      { color: 0x000000, offset: 0 },
      { color: 0x404040, offset: 1 },
    ],
    end: { x: 0, y: 1 },
    start: { x: 0, y: 0 },
    textureSpace: 'local',
  })
  gradients.push(backgroundGradient)
  const background = new Graphics()
    .rect(0, 0, options.viewport.width, options.viewport.height)
    .fill(backgroundGradient)
  background.zIndex = 0
  root.addChild(
    background,
    nativeActionStage,
    nativeBackStage,
    nativeNameStage,
    nativeDiceStage,
  )

  const wheel = centeredSprite(
    createTexture(CREATE_ATLAS_RECORDS.arcaneWheel), 800, 800, 276, 276, 1,
  )
  wheel.scale.set(3)
  wheel.alpha = 0.05
  nativeActionStage.addChild(wheel)

  const starSprites = CREATE_STARS.map((star) => {
    const starTexture = createTexture(
      star.large ? CREATE_ATLAS_RECORDS.stars.large : CREATE_ATLAS_RECORDS.stars.small,
    )
    const sprite = new Sprite(starTexture)
    sprite.eventMode = 'none'
    sprite.position.set(star.x, star.y)
    sprite.zIndex = 2
    sprite.visible = false
    nativeActionStage.addChild(sprite)
    return sprite
  })

  const leftHand = createHandView(createLogicalTexture, false)
  leftHand.container.zIndex = 3
  nativeActionStage.addChild(leftHand.container)

  const elementViews = Object.fromEntries(CREATE_ELEMENTS.map((element) => {
    const container = new Container({ label: `create-element-${element}` })
    container.eventMode = 'none'
    container.zIndex = 4
    const vfx = new NativeElementVfxView(element, vfxTextures)
    const glyphTexture = createTexture(CREATE_ATLAS_RECORDS.elements[element])
    const glyph = centeredSprite(glyphTexture, 0, 0, CREATE_ELEMENT_SIZE[element].width,
      CREATE_ELEMENT_SIZE[element].height, 1)
    const highlight = centeredSprite(glyphTexture, 0, 0, CREATE_ELEMENT_SIZE[element].width,
      CREATE_ELEMENT_SIZE[element].height, 2)
    highlight.blendMode = 'add'
    highlight.alpha = 0
    container.addChild(vfx.container, glyph, highlight)
    nativeActionStage.addChild(container)
    return [element, { container, glyph, highlight, vfx }] as const
  })) as Record<WizardElement, ElementView>

  const heldVfxContainer = new Container({ label: 'create-selected-element' })
  heldVfxContainer.eventMode = 'none'
  heldVfxContainer.zIndex = 4
  nativeActionStage.addChild(heldVfxContainer)
  const heldVfxViews: Partial<Record<WizardElement, NativeElementVfxView>> = {}

  const rightHand = createHandView(createLogicalTexture, true)
  rightHand.container.zIndex = 5
  nativeActionStage.addChild(rightHand.container)

  const disciplineViews = Object.fromEntries(CREATE_DISCIPLINES.map((discipline) => {
    const container = new Container({ label: `create-discipline-${discipline}` })
    container.eventMode = 'none'
    container.zIndex = 6
    const disciplineTexture = createTexture(CREATE_ATLAS_RECORDS.disciplines[discipline])
    const size = CREATE_DISCIPLINE_SIZE[discipline]
    const glyph = centeredSprite(disciplineTexture, 0, 0, size.width, size.height, 0)
    const highlight = centeredSprite(disciplineTexture, 0, 0, size.width, size.height, 1)
    highlight.blendMode = 'add'
    highlight.alpha = 0
    container.addChild(glyph, highlight)
    nativeActionStage.addChild(container)
    return [discipline, { container, highlight }] as const
  })) as Record<WizardDiscipline, DisciplineView>

  const elementPrompt = stageSprite(
    createTexture(CREATE_ATLAS_RECORDS.chooseElement), 620, 793, 361, 92, 7,
  )
  const disciplinePrompt = stageSprite(
    createTexture(CREATE_ATLAS_RECORDS.chooseDiscipline), 620, 793, 361, 87, 7,
  )
  nativeActionStage.addChild(elementPrompt, disciplinePrompt)
  const name = createNameView(
    texture,
    nativeUi,
    gradients,
    texture(CREATE_STOCK_POINT_ASSET_SOURCES[0]),
  )
  name.container.zIndex = 8
  nativeNameStage.addChild(name.container)
  const backTexture = nativeUi.slice(
    'UI', CREATE_UI_ATLAS_RECORDS.backSkull, [0, 0, 1, 1],
  )
  const back = stageSprite(backTexture, 10, 9, 31, 33, 8)
  back.alpha = 0.76
  const backHighlight = stageSprite(backTexture, 10, 9, 31, 33, 9)
  backHighlight.blendMode = 'add'
  backHighlight.alpha = 0
  nativeBackStage.addChild(back, backHighlight)
  nativeDiceStage.addChild(stageSprite(
    createTexture(CREATE_ATLAS_RECORDS.dice), 1520, 0, 80, 54, 8,
  ))
  const flash = new Graphics().rect(
    0, 0, options.viewport.width, options.viewport.height,
  ).fill(0xffffff)
  flash.zIndex = 3
  flash.alpha = 0
  root.addChild(flash)

  let currentViewport = options.viewport
  let destroyed = false
  let cachedMotion: ReturnType<typeof createEntryMotionAt> | null = null
  let cachedMotionPhase: CreateMenuPhase | null = null
  let cachedMotionTick = -1
  const diagnostics = {
    applicationTick: 0,
    element: null as WizardElement | null,
    frameCount: 0,
    phase: 'element' as CreateMenuPhase,
    spriteCount: countSprites(root),
    viewportHeight: options.viewport.height,
    viewportWidth: options.viewport.width,
  }
  Object.defineProperty(canvas, '__sdrCreateFrame', {
    configurable: false,
    enumerable: false,
    value: diagnostics,
    writable: false,
  })

  const renderer: CreateMenuRenderer = {
    canvas,
    mount: gpu.mount,
    render(frame) {
      if (destroyed) return
      const phaseElapsedMs = Math.max(0, frame.phaseElapsedMs)
      const motionElapsedMs = Math.min(
        phaseElapsedMs,
        frame.phase === 'element'
          ? CREATE_ENTRY_ANIMATION_MS
          : CREATE_SELECTION_ANIMATION_MS,
      )
      const motionTick = Math.floor(motionElapsedMs / 10)
      if (!cachedMotion || cachedMotionPhase !== frame.phase || cachedMotionTick !== motionTick) {
        cachedMotion = frame.phase === 'element'
          ? createEntryMotionAt(motionElapsedMs)
          : createSelectionMotionAt(motionElapsedMs)
        cachedMotionPhase = frame.phase
        cachedMotionTick = motionTick
      }
      const motion = cachedMotion
      const idle = createHandIdleOffsetAt(frame.reducedMotion ? 0 : frame.sceneElapsedMs)
      const tick = frame.reducedMotion ? 0 : frame.applicationTick

      wheel.rotation = (frame.reducedMotion ? 0 : frame.sceneElapsedMs / 1000 * 10)
        * Math.PI / 180
      updateHand(leftHand, motion.leftPose, createLogicalTexture, {
        x: CREATE_HAND_CENTERS.left.x + motion.leftOffset.x + motion.leftImpulse.x + idle.x,
        y: CREATE_HAND_CENTERS.left.y + motion.leftOffset.y + motion.leftImpulse.y + idle.y,
      })
      updateHand(rightHand, motion.rightPose, createLogicalTexture, {
        x: CREATE_HAND_CENTERS.right.x + motion.rightOffset.x + motion.rightImpulse.x + idle.x,
        y: CREATE_HAND_CENTERS.right.y + motion.rightOffset.y + motion.rightImpulse.y + idle.y,
      })

      updateElementViews(elementViews, frame, motion.elementsVisible, motionElapsedMs, tick)
      updateHeldVfx(
        heldVfxContainer,
        heldVfxViews,
        frame,
        motionElapsedMs,
        tick,
        vfxTextures,
      )
      updateDisciplineViews(disciplineViews, frame, motion.disciplinesVisible,
        motionElapsedMs)
      updateCreateNameView(name, frame.displayName)

      elementPrompt.visible = frame.phase === 'element' && motion.elementsVisible
      disciplinePrompt.visible = frame.phase === 'discipline' && motion.disciplinesVisible
      backHighlight.alpha = frame.hoveredAction === 'back' ? 0.25 : 0
      flash.alpha = frame.reducedMotion
        ? 0
        : frame.phase === 'element'
          ? createEntryFlashAlpha(phaseElapsedMs)
          : createSelectionFlashAlpha(phaseElapsedMs)
      updateStars(starSprites, frame)

      application.render()
      diagnostics.applicationTick = tick
      diagnostics.element = frame.selectedElement
      diagnostics.frameCount += 1
      diagnostics.phase = frame.phase
      diagnostics.spriteCount = countSprites(root)
      canvas.dataset.phase = frame.phase
      canvas.dataset.selectedElement = frame.selectedElement ?? ''
      canvas.dataset.wizardName = frame.displayName
    },
    resize(viewport) {
      if (destroyed) return
      if (viewport.width === currentViewport.width
        && viewport.height === currentViewport.height
        && viewport.nativeStage.x === currentViewport.nativeStage.x
        && viewport.nativeStage.y === currentViewport.nativeStage.y) return
      currentViewport = viewport
      applyCreateViewport(
        application,
        background,
        backgroundGradient,
        flash,
        nativeActionStage,
        nativeBackStage,
        nativeNameStage,
        nativeDiceStage,
        viewport,
      )
      diagnostics.viewportHeight = viewport.height
      diagnostics.viewportWidth = viewport.width
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      application.stage.removeChild(root)
      root.destroy({ children: true })
      for (const gradient of gradients) gradient.destroy()
      for (const glyphTexture of name.glyphTextures.values()) glyphTexture.destroy(false)
      for (const frames of Object.values(vfxTextures)) {
        for (const frame of frames) frame.destroy(false)
      }
      combatAtlas.destroy()
      nativeUi.destroy()
      textures.destroy()
      gpu.destroy()
    },
  }
  applyCreateViewport(
    application,
    background,
    backgroundGradient,
    flash,
    nativeActionStage,
    nativeBackStage,
    nativeNameStage,
    nativeDiceStage,
    options.viewport,
  )
  renderer.render({
    applicationTick: 0,
    displayName: 'HELVIDIUS',
    hoveredAction: null,
    phase: 'element',
    phaseElapsedMs: 0,
    reducedMotion: false,
    sceneElapsedMs: 0,
    selectedElement: null,
  })
  return renderer
}

function applyCreateViewport(
  application: Application,
  background: Graphics,
  backgroundGradient: FillGradient,
  flash: Graphics,
  nativeActionStage: Container,
  nativeBackStage: Container,
  nativeNameStage: Container,
  nativeDiceStage: Container,
  viewport: FixedGameViewportLayout,
): void {
  application.renderer.resize(viewport.width, viewport.height)
  background.clear().rect(0, 0, viewport.width, viewport.height).fill(backgroundGradient)
  flash.clear().rect(0, 0, viewport.width, viewport.height).fill(0xffffff)
  const actionBounds = fixedGameStageBounds(viewport, 'center', 'bottom')
  const backBounds = fixedGameStageBounds(viewport, 'left', 'top')
  const nameBounds = fixedGameStageBounds(viewport, 'center', 'top')
  const diceBounds = fixedGameStageBounds(viewport, 'right', 'top')
  nativeActionStage.position.set(actionBounds.x, actionBounds.y)
  nativeBackStage.position.set(backBounds.x, backBounds.y)
  nativeNameStage.position.set(nameBounds.x, nameBounds.y)
  nativeDiceStage.position.set(diceBounds.x, diceBounds.y)
  const canvas = application.canvas as HTMLCanvasElement
  canvas.dataset.actionStage = `${actionBounds.x},${actionBounds.y}`
  canvas.dataset.backStage = `${backBounds.x},${backBounds.y}`
  canvas.dataset.diceStage = `${diceBounds.x},${diceBounds.y}`
  canvas.dataset.nameStage = `${nameBounds.x},${nameBounds.y}`
  canvas.dataset.viewportHeight = `${viewport.height}`
  canvas.dataset.viewportWidth = `${viewport.width}`
}

function createStage(label: string, zIndex: number): Container {
  const stage = new Container({ label })
  stage.eventMode = 'none'
  stage.sortableChildren = true
  stage.zIndex = zIndex
  return stage
}

function updateElementViews(
  views: Readonly<Record<WizardElement, ElementView>>,
  frame: CreateMenuRenderFrame,
  elementsVisible: boolean,
  elapsedMs: number,
  tick: number,
): void {
  for (const element of CREATE_ELEMENTS) {
    const view = views[element]
    if (frame.phase !== 'element') {
      view.container.visible = false
      continue
    }
    const reveal = createElementRevealMotionAt(element, elapsedMs)
    view.container.visible = elementsVisible && reveal.opacity > 0
    view.container.position.set(reveal.position.x, reveal.position.y)
    view.container.alpha = reveal.opacity
    view.highlight.alpha = frame.hoveredAction === element ? 0.18 : 0
    if (view.container.visible) view.vfx.update(tick, NATIVE_ELEMENT_VFX_SCALE.picker)
  }
}

function updateHeldVfx(
  container: Container,
  views: Partial<Record<WizardElement, NativeElementVfxView>>,
  frame: CreateMenuRenderFrame,
  elapsedMs: number,
  tick: number,
  textures: ConstructorParameters<typeof NativeElementVfxView>[1],
): void {
  container.visible = frame.phase === 'discipline' && frame.selectedElement !== null
  for (const view of Object.values(views)) view.container.visible = false
  if (!container.visible || !frame.selectedElement) return
  let view = views[frame.selectedElement]
  if (!view) {
    view = new NativeElementVfxView(frame.selectedElement, textures)
    views[frame.selectedElement] = view
    container.addChild(view.container)
  }
  const motion = createSelectedElementMotionAt(frame.selectedElement, elapsedMs)
  view.container.visible = true
  view.container.position.set(motion.position.x, motion.position.y)
  view.update(tick, motion.scale * NATIVE_ELEMENT_VFX_SCALE.picker)
}

function updateDisciplineViews(
  views: Readonly<Record<WizardDiscipline, DisciplineView>>,
  frame: CreateMenuRenderFrame,
  disciplinesVisible: boolean,
  elapsedMs: number,
): void {
  for (const discipline of CREATE_DISCIPLINES) {
    const view = views[discipline]
    view.container.visible = frame.phase === 'discipline' && disciplinesVisible
    if (!view.container.visible) continue
    const position = createDisciplineRevealMotionAt(discipline, elapsedMs)
    view.container.position.set(position.x, position.y)
    view.highlight.alpha = frame.hoveredAction === discipline ? 0.18 : 0
  }
}

function updateStars(
  sprites: readonly Sprite[],
  frame: CreateMenuRenderFrame,
): void {
  const active = frame.phase === 'discipline' && !frame.reducedMotion
  for (let index = 0; index < sprites.length; index += 1) {
    const sprite = sprites[index]
    if (!active) {
      sprite.visible = false
      continue
    }
    const star = CREATE_STARS[index]
    const presentation = createStarPresentation(star, frame.phaseElapsedMs)
    sprite.visible = presentation.visible
    if (!presentation.visible) continue
    const baseWidth = star.large ? 23.2 : 3.52
    const scale = baseWidth / sprite.texture.width * presentation.scale
    sprite.position.set(star.x, presentation.y)
    sprite.scale.set(scale)
    sprite.alpha = presentation.alpha
  }
}

function createHandView(
  texture: (record: number) => Texture,
  flipped: boolean,
): HandView {
  const container = new Container({
    label: flipped ? 'create-hand-right' : 'create-hand-left',
  })
  container.eventMode = 'none'
  const scaleX = CREATE_HAND_SIZE.width / CREATE_HAND_LOGICAL_SIZE.width
  const scaleY = CREATE_HAND_SIZE.height / CREATE_HAND_LOGICAL_SIZE.height
  container.scale.set(flipped ? -scaleX : scaleX, scaleY)
  const sprites = CREATE_ATLAS_RECORDS.hands.raised.map((record) => {
    const sprite = new Sprite(texture(record))
    sprite.anchor.set(0.5)
    sprite.eventMode = 'none'
    sprite.visible = false
    container.addChild(sprite)
    return sprite
  })
  return { container, pose: null, sprites }
}

function updateHand(
  view: HandView,
  pose: CreateHandPose,
  texture: (record: number) => Texture,
  position: { x: number; y: number },
): void {
  if (view.pose !== pose) {
    const records = CREATE_ATLAS_RECORDS.hands[pose]
    for (let index = 0; index < view.sprites.length; index += 1) {
      const sprite = view.sprites[index]
      const record = records.at(index)
      sprite.visible = record !== undefined
      if (record !== undefined) sprite.texture = texture(record)
    }
    view.pose = pose
  }
  view.container.position.set(position.x, position.y)
}

function createNameView(
  texture: (source: string) => Texture,
  nativeUi: ReturnType<typeof createNativeUiPixiAdapter>,
  gradients: FillGradient[],
  fontAtlas: Texture,
): CreateNameView {
  const container = new Container({ label: 'create-name' })
  container.position.set(558, 17)
  container.eventMode = 'none'
  const fieldGradient = new FillGradient({
    colorStops: [
      { color: 0x292929, offset: 0 },
      { color: 0x202020, offset: 1 },
    ],
    end: { x: 0, y: 1 },
    start: { x: 0, y: 0 },
    textureSpace: 'local',
  })
  gradients.push(fieldGradient)
  const field = new Graphics().rect(50, 12, 384, 49).fill(fieldGradient)
  const nameEndTexture = nativeUi.slice(
    'UI', CREATE_UI_ATLAS_RECORDS.nameEnd, [0, 0, 1, 1],
  )
  const nameRailTexture = nativeUi.slice(
    'UI', CREATE_UI_ATLAS_RECORDS.nameEnd, [71 / 72, 0, 1, 1],
  )
  const rail = stageSprite(nameRailTexture, 72, 0, 340, 76, 1)
  const leftEnd = stageSprite(nameEndTexture, 0, 0, 72, 76, 2)
  const rightEnd = stageSprite(nameEndTexture, 484, 0, 72, 76, 2)
  rightEnd.scale.x = -1
  const caption = stageSprite(texture(createMenu.textNameCaption), 174, -10, 136, 15, 3)
  const value = new Container({ label: 'create-name-value' })
  value.eventMode = 'none'
  value.mask = field
  value.zIndex = 3
  const clear = stageSprite(texture(createMenu.textNameClear), 412, 30, 12, 11, 3)
  clear.alpha = 0.65
  container.addChild(field, rail, leftEnd, rightEnd, caption, value, clear)
  return {
    atlas: fontAtlas,
    container,
    glyphTextures: new Map(),
    value,
    valueName: null,
  }
}

function updateCreateNameView(view: CreateNameView, displayName: string): void {
  const validation = validateCreateWizardName(displayName)
  const nextName = validation.ok ? validation.value.toUpperCase() : ''
  if (view.valueName === nextName) return
  for (const child of view.value.removeChildren()) child.destroy()
  if (!validation.ok) {
    view.valueName = nextName
    return
  }
  const layout = layoutCreateWizardName(validation.value)

  for (const glyph of layout.glyphs) {
    let glyphTexture = view.glyphTextures.get(glyph.character)
    if (!glyphTexture) {
      glyphTexture = nativeUiGlyphRecordTexture(view.atlas.source, glyph)
      view.glyphTextures.set(glyph.character, glyphTexture)
    }
    const sprite = new Sprite(glyphTexture)
    sprite.eventMode = 'none'
    sprite.anchor.set(0.5)
    sprite.position.set(glyph.centerX, glyph.centerY)
    sprite.tint = 0xd8ba70
    view.value.addChild(sprite)
  }
  view.valueName = layout.value
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

function centeredSprite(
  texture: Texture,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
): Sprite {
  const sprite = stageSprite(texture, x, y, width, height, zIndex)
  sprite.anchor.set(0.5)
  return sprite
}

function textureUvs(texture: Texture): readonly number[] {
  const uvs = texture.uvs
  return [uvs.x0, uvs.y0, uvs.x1, uvs.y1, uvs.x2, uvs.y2, uvs.x3, uvs.y3]
}

function countSprites(container: Container): number {
  let count = 0
  for (const child of container.children) {
    if (child instanceof Sprite) count += 1
    if (child instanceof Container) count += countSprites(child)
  }
  return count
}
