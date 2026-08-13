// Installs Pixi's static CSP-safe sync paths; this module removes the need for eval.
import 'pixi.js/unsafe-eval'
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Texture,
} from 'pixi.js'

import {
  BONEYARD_SPRITE_SOURCES,
  spriteImage,
  spriteRefFor,
} from '../../editor/assets.ts'
import type { EditorDoc, SpriteRef, Vec2 } from '../../editor/model.ts'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import {
  drawNativeBoneyardBase,
  drawNativeBoneyardForeground,
  drawNativeBoneyardMainBand,
  nativeBoneyardMainLayers,
  STAGE_TEXTURES,
  type Camera,
} from '../../editor/render.ts'
import {
  nativeGateLeaf,
  nativeGateHingeArtPosition,
  nativeGatePainterRoot,
  type NativeGateLeaf,
} from '../../editor/native-fence-geometry.ts'
import {
  buildBoneyardPainterOrder,
} from '../boneyard-painter-order.ts'
import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import type { GameSnapshot, LoadedBoneyard } from '../protocol/game-protocol.ts'
import { PlayerWorldView } from './hub-actors.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { initialHubResolution } from './hub-render-contract.ts'
import {
  BONEYARD_CAMERA_ZOOM,
  boneyardCamera,
  boneyardStaticTiles,
  boneyardWorldPosition,
} from './boneyard-render-contract.ts'
import {
  destroyBoneyardWorldTextures,
  loadBoneyardWorldTextures,
  type BoneyardWorldTextures,
} from './boneyard-textures.ts'
import {
  nativeBoneyardLightScalar,
  nativeBoneyardLightTint,
  nativeLanternLightSource,
  nativePlayerLightSource,
} from './boneyard-lighting.ts'

interface BoneyardRendererFrameDiagnostics {
  frameCount: number
  foregroundZIndex: number
  gateLeafCount: number
  localPlayerPainterRow: number
  localPlayerZIndex: number
  lanternLightIntensity: number
  lightSourceCount: number
  mainAboveLocal: boolean
  mainBelowLocal: boolean
  maxDynamicZIndex: number
  maxMainLightScalar: number
  maxMainZIndex: number
  minMainLightScalar: number
  painterBandCount: number
  playerCount: number
  playerScreenX: number
  playerScreenY: number
  playerWalkPose: number
  playerX: number
  playerY: number
  solomonFrame: number
  staticLayerCount: number
  staticPaintCount: number
  tick: number
}

export interface BoneyardWorldRenderer {
  readonly canvas: HTMLCanvasElement
  camera(snapshot: GameSnapshot): Camera
  destroy(): void
  render(snapshot: GameSnapshot): void
  resize(viewport: GameViewportLayout, devicePixelRatio?: number): void
}

interface BoneyardWorldRendererOptions {
  boneyard: LoadedBoneyard
  devicePixelRatio?: number
  initialSnapshot: GameSnapshot
  playerId: string
  viewport: GameViewportLayout
}

interface ResidentTexture {
  sprite: Sprite
  texture: Texture
}

interface StaticWorldBuild {
  foreground: Container
  mainSprites: ReadonlyMap<number, Sprite>
  residents: ResidentTexture[]
  staticPaintCount: number
}

export async function createBoneyardWorldRenderer(
  options: BoneyardWorldRendererOptions,
): Promise<BoneyardWorldRenderer> {
  requireBoneyardSnapshot(options.initialSnapshot, options.boneyard.runId)
  const [textures] = await Promise.all([
    loadBoneyardWorldTextures(),
    loadStaticPainterImages(),
  ])
  const application = new Application()
  const devicePixelRatio = options.devicePixelRatio ?? window.devicePixelRatio
  let viewport = options.viewport
  const initialResolution = initialHubResolution({
    devicePixelRatio,
    displayScale: viewport.displayScale,
  })
  try {
    await application.init({
      antialias: false,
      autoDensity: true,
      autoStart: false,
      background: 0x000000,
      height: viewport.height,
      powerPreference: 'high-performance',
      preference: 'webgl',
      preferWebGLVersion: 2,
      resolution: initialResolution,
      roundPixels: false,
      width: viewport.width,
    })
    if (!application.renderer.name.toLowerCase().includes('webgl')) {
      throw new Error('WebGL is unavailable; the CPU canvas fallback is not supported.')
    }
  } catch (error) {
    if (application.renderer) application.destroy({ removeView: true })
    destroyBoneyardWorldTextures(textures)
    throw error
  }
  application.stop()

  const document = editorDocument(options.boneyard)
  const world = new Container({ label: 'boneyard-world' })
  world.sortableChildren = true
  application.stage.addChild(world)

  let staticWorld: StaticWorldBuild | null = null
  try {
    staticWorld = await buildStaticWorld(document, world)
  } catch (error) {
    application.stage.removeChild(world)
    world.destroy({ children: true })
    application.destroy({ removeView: true })
    destroyBoneyardWorldTextures(textures)
    throw error
  }

  const mainLayers = nativeBoneyardMainLayers(document)
  const scene = new BoneyardDynamicScene(
    options.boneyard,
    world,
    textures,
    mainLayers,
    staticWorld.mainSprites,
    staticWorld.foreground,
  )
  const canvas = application.canvas as HTMLCanvasElement
  canvas.className = 'boneyard-world-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.gameRenderer = 'pixi-webgl'
  canvas.dataset.rendererName = application.renderer.name
  canvas.dataset.resolution = `${initialResolution}`
  canvas.dataset.regionLighting = 'native-object-scalar'
  canvas.dataset.staticPaintCount = `${staticWorld.staticPaintCount}`
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  canvas.dataset.viewportHeight = `${viewport.height}`
  canvas.dataset.viewportWidth = `${viewport.width}`

  let destroyed = false
  let frameCount = 0
  let resolution = initialResolution
  const frameDiagnostics: BoneyardRendererFrameDiagnostics = {
    frameCount: 0,
    foregroundZIndex: 0,
    gateLeafCount: 0,
    localPlayerPainterRow: 0,
    localPlayerZIndex: 0,
    lanternLightIntensity: 0,
    lightSourceCount: 0,
    mainAboveLocal: false,
    mainBelowLocal: false,
    maxDynamicZIndex: 0,
    maxMainLightScalar: 0,
    maxMainZIndex: 0,
    minMainLightScalar: 0,
    painterBandCount: 0,
    playerCount: 0,
    playerScreenX: Number.NaN,
    playerScreenY: Number.NaN,
    playerWalkPose: 0,
    playerX: Number.NaN,
    playerY: Number.NaN,
    solomonFrame: 0,
    staticLayerCount: mainLayers.length,
    staticPaintCount: staticWorld.staticPaintCount,
    tick: options.initialSnapshot.tick,
  }
  Object.defineProperty(canvas, '__sdrBoneyardFrame', {
    configurable: false,
    enumerable: false,
    value: frameDiagnostics,
    writable: false,
  })

  const cameraFor = (snapshot: GameSnapshot): Camera => {
    requireBoneyardSnapshot(snapshot, options.boneyard.runId)
    return boneyardCamera(
      snapshot.players[options.playerId]?.position ?? options.boneyard.scene.spawn,
      options.boneyard.scene.bounds,
      viewport,
    )
  }

  const renderer: BoneyardWorldRenderer = {
    canvas,
    camera: cameraFor,
    render(snapshot) {
      if (destroyed) return
      requireBoneyardSnapshot(snapshot, options.boneyard.runId)
      const player = snapshot.players[options.playerId]
      if (!player) return
      frameCount += 1
      const painter = scene.update(snapshot, options.playerId, frameCount)
      const camera = cameraFor(snapshot)
      const worldPosition = boneyardWorldPosition(camera, viewport)
      world.scale.set(BONEYARD_CAMERA_ZOOM)
      world.position.set(worldPosition.x, worldPosition.y)
      application.render()

      frameDiagnostics.frameCount = frameCount
      frameDiagnostics.foregroundZIndex = painter.foregroundZIndex
      frameDiagnostics.gateLeafCount = snapshot.world.gateLeaves.length
      frameDiagnostics.localPlayerPainterRow = painter.localPlayerPainterRow
      frameDiagnostics.localPlayerZIndex = painter.localPlayerZIndex
      frameDiagnostics.lanternLightIntensity = painter.lanternLightIntensity
      frameDiagnostics.lightSourceCount = painter.lightSourceCount
      frameDiagnostics.mainAboveLocal = painter.mainAboveLocal
      frameDiagnostics.mainBelowLocal = painter.mainBelowLocal
      frameDiagnostics.maxDynamicZIndex = painter.maxDynamicZIndex
      frameDiagnostics.maxMainLightScalar = painter.maxMainLightScalar
      frameDiagnostics.maxMainZIndex = painter.maxMainZIndex
      frameDiagnostics.minMainLightScalar = painter.minMainLightScalar
      frameDiagnostics.painterBandCount = painter.painterBandCount
      frameDiagnostics.playerCount = Object.keys(snapshot.players).length
      frameDiagnostics.playerScreenX = (player.position.x - camera.x) * camera.zoom
        + viewport.width / 2
      frameDiagnostics.playerScreenY = (player.position.y - camera.y) * camera.zoom
        + viewport.height / 2
      frameDiagnostics.playerWalkPose = scene.playerWalkPose(options.playerId)
      frameDiagnostics.playerX = player.position.x
      frameDiagnostics.playerY = player.position.y
      frameDiagnostics.solomonFrame = scene.solomonFrame
      frameDiagnostics.tick = snapshot.tick
    },
    resize(nextViewport, nextDevicePixelRatio = window.devicePixelRatio) {
      if (destroyed) return
      const nextResolution = initialHubResolution({
        devicePixelRatio: nextDevicePixelRatio,
        displayScale: nextViewport.displayScale,
      })
      if (
        nextResolution === resolution
        && nextViewport.height === viewport.height
        && nextViewport.width === viewport.width
      ) return
      viewport = nextViewport
      resolution = nextResolution
      application.renderer.resize(viewport.width, viewport.height, resolution)
      canvas.dataset.resolution = `${resolution}`
      canvas.dataset.viewportHeight = `${viewport.height}`
      canvas.dataset.viewportWidth = `${viewport.width}`
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      application.stage.removeChild(world)
      scene.destroy()
      for (const resident of staticWorld?.residents ?? []) resident.texture.destroy(true)
      staticWorld = null
      world.destroy({ children: true })
      destroyBoneyardWorldTextures(textures)
      application.destroy({ removeView: true })
      canvas.remove()
    },
  }

  scene.update(options.initialSnapshot, options.playerId, 0)
  renderer.render(options.initialSnapshot)
  return renderer
}

interface BoneyardPainterFrame {
  foregroundZIndex: number
  localPlayerPainterRow: number
  localPlayerZIndex: number
  lanternLightIntensity: number
  lightSourceCount: number
  mainAboveLocal: boolean
  mainBelowLocal: boolean
  maxDynamicZIndex: number
  maxMainLightScalar: number
  maxMainZIndex: number
  minMainLightScalar: number
  painterBandCount: number
}

class BoneyardDynamicScene {
  private readonly boneyard: LoadedBoneyard
  private readonly foreground: Container
  private readonly gates: BoneyardGateViews
  private readonly mainLayers: readonly MainLayer[]
  private readonly mainSprites: ReadonlyMap<number, Sprite>
  private readonly players = new Map<string, PlayerWorldView>()
  private readonly root: Container
  private readonly solomon: BoneyardSolomonView | null
  private readonly textures: BoneyardWorldTextures

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    textures: BoneyardWorldTextures,
    mainLayers: readonly MainLayer[],
    mainSprites: ReadonlyMap<number, Sprite>,
    foreground: Container,
  ) {
    this.boneyard = boneyard
    this.root = root
    this.textures = textures
    this.mainLayers = mainLayers
    this.mainSprites = mainSprites
    this.foreground = foreground
    this.gates = new BoneyardGateViews(root, textures)
    this.solomon = boneyard.scene.solomonDig
      ? new BoneyardSolomonView(boneyard, root, textures)
      : null
  }

  update(
    snapshot: GameSnapshot,
    localPlayerId: string,
    presentationFrame: number,
  ): BoneyardPainterFrame {
    requireBoneyardSnapshot(snapshot, this.boneyard.runId)
    const liveIds = new Set(Object.keys(snapshot.players))
    for (const [playerId, view] of this.players) {
      if (liveIds.has(playerId)) continue
      this.root.removeChild(view.container)
      view.destroy()
      this.players.delete(playerId)
    }
    for (const [playerId, player] of Object.entries(snapshot.players)) {
      let view = this.players.get(playerId)
      if (!view) {
        view = new PlayerWorldView(player.config.element, this.textures)
        this.players.set(playerId, view)
        this.root.addChild(view.container)
      }
      view.update(player, snapshot.tick)
    }
    this.gates.update(snapshot.world.gateLeaves)
    this.solomon?.update(snapshot.tick)

    const dig = this.boneyard.scene.solomonDig
    const lanternLight = dig
      ? nativeLanternLightSource(dig.lanternPosition, presentationFrame)
      : null
    const lightSources = [
      ...Object.values(snapshot.players).map(nativePlayerLightSource),
      ...(lanternLight ? [lanternLight] : []),
    ]
    const mainLightScalars: number[] = []
    for (const [layerIndex, sprite] of this.mainSprites) {
      const scalar = nativeBoneyardLightScalar(
        this.mainLayers[layerIndex].pos,
        lightSources,
      )
      sprite.tint = nativeBoneyardLightTint(scalar)
      mainLightScalars.push(scalar)
    }
    for (const [id, view] of this.players) {
      const player = snapshot.players[id]
      if (!player) continue
      view.setWorldTint(nativeBoneyardLightTint(
        nativeBoneyardLightScalar(player.position, lightSources),
      ))
    }
    for (const leaf of snapshot.world.gateLeaves) {
      const position = nativeGatePainterRoot(leaf.hinge, leaf.tip)
      this.gates.setTint(
        leaf.fenceEid,
        leaf.side,
        nativeBoneyardLightTint(nativeBoneyardLightScalar(position, lightSources)),
      )
    }
    if (dig) {
      this.solomon?.setLighting(
        nativeBoneyardLightTint(nativeBoneyardLightScalar(dig.position, lightSources)),
        nativeBoneyardLightTint(
          nativeBoneyardLightScalar(dig.lanternPosition, lightSources),
        ),
      )
    }

    const localPlayer = snapshot.players[localPlayerId]
    if (!localPlayer) throw new Error('Boneyard renderer lost its local player.')
    const gateLeaves = new Map(snapshot.world.gateLeaves.map((leaf) => [
      `${leaf.fenceEid}:${leaf.side}`,
      leaf,
    ]))
    const dynamicLayers = Object.entries(snapshot.players).map(([id, player], sourceOrder) => ({
      id: `player:${id}`,
      worldY: player.position.y,
      sortBias: 0,
      sourceOrder,
    }))
    if (dig) {
      dynamicLayers.push({
        id: 'solomon-dig',
        worldY: dig.position.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
      dynamicLayers.push({
        id: 'lantern',
        worldY: dig.lanternPosition.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
    }
    const order = buildBoneyardPainterOrder({
      referenceY: localPlayer.position.y,
      staticLayers: this.mainLayers.map((layer, layerIndex) => ({
        layerIndex,
        worldY: runtimeMainWorldY(layer, gateLeaves),
        sortBias: layer.sortBias,
        sourceOrder: layer.sourceOrder,
      })),
      dynamicLayers,
    })
    const staticDepths: number[] = []
    for (const band of order.bands) {
      band.layerIndexes.forEach((layerIndex, position) => {
        const depth = band.zIndex + ((position + 1) / (band.layerIndexes.length + 1)) * 0.5
        staticDepths.push(depth)
        const sprite = this.mainSprites.get(layerIndex)
        if (sprite) sprite.zIndex = depth
        const layer = this.mainLayers[layerIndex]
        if (isMovingGateBody(layer)) {
          this.gates.setDepth(layer.fence.eid, layer.pieceIndex, depth)
        }
      })
    }
    const positionedDynamics = new Map(order.dynamicLayers.map((layer) => [layer.id, layer]))
    for (const [id, view] of this.players) {
      view.setDepth(positionedDynamics.get(`player:${id}`)?.zIndex ?? 1)
    }
    this.solomon?.setDigDepth(positionedDynamics.get('solomon-dig')?.zIndex ?? 1)
    this.solomon?.setLanternDepth(positionedDynamics.get('lantern')?.zIndex ?? 1)
    this.foreground.zIndex = order.foregroundZIndex
    const localPainter = positionedDynamics.get(`player:${localPlayerId}`)
    const localPlayerZIndex = localPainter?.zIndex ?? 1
    return {
      foregroundZIndex: order.foregroundZIndex,
      localPlayerPainterRow: localPainter?.row ?? 0,
      localPlayerZIndex,
      lanternLightIntensity: lanternLight?.intensity ?? 0,
      lightSourceCount: lightSources.length,
      mainAboveLocal: staticDepths.some((depth) => depth > localPlayerZIndex),
      mainBelowLocal: staticDepths.some((depth) => depth < localPlayerZIndex),
      maxDynamicZIndex: Math.max(0, ...order.dynamicLayers.map((layer) => layer.zIndex)),
      maxMainLightScalar: Math.max(0, ...mainLightScalars),
      maxMainZIndex: Math.max(0, ...staticDepths),
      minMainLightScalar: Math.min(1, ...mainLightScalars),
      painterBandCount: order.bands.length,
    }
  }

  playerWalkPose(playerId: string): number {
    return this.players.get(playerId)?.walkPose ?? 0
  }

  get solomonFrame(): number {
    return this.solomon?.frame ?? 0
  }

  destroy(): void {
    this.gates.destroy()
    this.solomon?.destroy()
    for (const view of this.players.values()) view.destroy()
    this.players.clear()
  }
}

class BoneyardSolomonView {
  private readonly dig: Sprite
  private readonly digRoot = new Container({ label: 'solomon-dig' })
  private readonly graveDirt: Sprite
  private readonly lantern: Sprite
  private readonly program: readonly number[]
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly ticksPerFrame: number
  private currentFrame = 0

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    textures: BoneyardWorldTextures,
  ) {
    const state = boneyard.scene.solomonDig!
    this.root = root
    this.textures = textures
    this.program = state.frameProgram
    this.ticksPerFrame = state.ticksPerFrame
    this.graveDirt = new Sprite(textures.graveDirt)
    this.graveDirt.position.set(
      state.gravePosition.x - 16,
      state.gravePosition.y + 105,
    )
    this.graveDirt.zIndex = 0
    this.lantern = new Sprite(textures.lantern)
    this.lantern.position.set(
      state.lanternPosition.x - 14.5,
      state.lanternPosition.y - 22.5,
    )
    this.dig = new Sprite(textures.solomonDig[0])
    this.dig.anchor.set(0.5)
    this.dig.position.set(state.position.x, state.position.y)
    this.dig.zIndex = 1
    this.digRoot.sortableChildren = true
    this.digRoot.addChild(this.graveDirt, this.dig)
    root.addChild(this.digRoot, this.lantern)
  }

  update(tick: number): void {
    const programIndex = Math.floor(tick / this.ticksPerFrame) % this.program.length
    this.currentFrame = this.program[programIndex]
    this.dig.texture = this.textures.solomonDig[this.currentFrame]
  }

  get frame(): number {
    return this.currentFrame
  }

  setDigDepth(depth: number): void {
    this.digRoot.zIndex = depth
  }

  setLanternDepth(depth: number): void {
    this.lantern.zIndex = depth
  }

  setLighting(digTint: number, lanternTint: number): void {
    this.dig.tint = digTint
    this.lantern.tint = lanternTint
  }

  destroy(): void {
    this.root.removeChild(this.digRoot, this.lantern)
    this.digRoot.destroy({ children: true })
    this.lantern.destroy()
  }
}

class BoneyardGateViews {
  private readonly leaves = new Map<string, BoneyardGateLeafView>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
  ) {
    this.root = root
    this.textures = textures
  }

  update(leaves: readonly BoneyardGateLeafSnapshot[]): void {
    const live = new Set<string>()
    for (const state of leaves) {
      const key = `${state.fenceEid}:${state.side}`
      live.add(key)
      let view = this.leaves.get(key)
      if (!view) {
        view = new BoneyardGateLeafView(this.root, this.textures)
        this.leaves.set(key, view)
      }
      view.update(state)
    }
    for (const [key, view] of this.leaves) {
      if (live.has(key)) continue
      view.destroy()
      this.leaves.delete(key)
    }
  }

  setDepth(fenceEid: string, side: number, depth: number): void {
    this.leaves.get(`${fenceEid}:${side}`)?.setDepth(depth)
  }

  setTint(fenceEid: string, side: number, tint: number): void {
    this.leaves.get(`${fenceEid}:${side}`)?.setTint(tint)
  }

  destroy(): void {
    for (const view of this.leaves.values()) view.destroy()
    this.leaves.clear()
  }
}

class BoneyardGateLeafView {
  readonly container = new Container({ label: 'gate-leaf' })
  private readonly gateLeaf: Sprite
  private readonly hinge: Sprite
  private readonly lines = new Graphics()
  private readonly root: Container

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    const leafRef = requiredSpriteRef(7)
    const hingeRef = requiredSpriteRef(8)
    const leafTexture = requiredTexture(textures, leafRef)
    const hingeTexture = requiredTexture(textures, hingeRef)
    this.gateLeaf = plantedSprite(leafTexture, leafRef, { x: 0, y: 0 })
    this.hinge = plantedSprite(hingeTexture, hingeRef, { x: 0, y: 0 })
    this.gateLeaf.zIndex = 0
    this.hinge.zIndex = 1
    this.lines.zIndex = 2
    this.container.sortableChildren = true
    this.container.addChild(this.gateLeaf, this.hinge, this.lines)
    root.addChild(this.container)
  }

  update(state: BoneyardGateLeafSnapshot): void {
    const leaf = nativeGateLeaf(state.hinge, state.tip)
    this.gateLeaf.position.set(leaf.p0.x, leaf.p0.y)
    const hingeArt = nativeGateHingeArtPosition(leaf)
    this.hinge.position.set(hingeArt.x, hingeArt.y)
    drawGateLines(this.lines, leaf)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function drawGateLines(graphics: Graphics, leaf: NativeGateLeaf): void {
  graphics.clear()
  graphics
    .moveTo(leaf.p1.x, leaf.p1.y)
    .lineTo(leaf.p3.x, leaf.p3.y + 32)
    .moveTo(
      (leaf.p0.x + leaf.p1.x) / 2,
      (leaf.p0.y + leaf.p1.y) / 2,
    )
    .lineTo(
      (leaf.p2.x + leaf.p3.x) / 2,
      (leaf.p2.y + leaf.p3.y) / 2,
    )
    .stroke({ color: 0x000000, width: 3 })
}

async function buildStaticWorld(
  document: EditorDoc,
  root: Container,
): Promise<StaticWorldBuild> {
  const base = new Container({ label: 'boneyard-base' })
  const foreground = new Container({ label: 'boneyard-foreground' })
  base.zIndex = 0
  root.addChild(base, foreground)
  const residents: ResidentTexture[] = []
  const mainSprites = new Map<number, Sprite>()
  let staticPaintCount = 0
  try {
    residents.push(...await buildTiledStaticLayer(
      document,
      base,
      false,
      (context, width, height, camera) => {
        drawNativeBoneyardBase(context, width, height, camera, document)
        staticPaintCount += 1
      },
    ))

    const mainLayers = nativeBoneyardMainLayers(document)
    for (let layerIndex = 0; layerIndex < mainLayers.length; layerIndex += 1) {
      const layer = mainLayers[layerIndex]
      if (isMovingGateBody(layer)) continue
      const resident = buildMainLayerResident(document, layer, layerIndex)
      staticPaintCount += 1
      if (resident) {
        root.addChild(resident.sprite)
        residents.push(resident)
        mainSprites.set(layerIndex, resident.sprite)
      }
      if (layerIndex % 12 === 11) await nextFrame()
    }

    residents.push(...await buildTiledStaticLayer(
      document,
      foreground,
      true,
      (context, width, height, camera) => {
        drawNativeBoneyardForeground(context, width, height, camera, document)
        staticPaintCount += 1
      },
    ))
  } catch (error) {
    for (const resident of residents) resident.texture.destroy(true)
    throw error
  }
  return { foreground, mainSprites, residents, staticPaintCount }
}

async function buildTiledStaticLayer(
  document: EditorDoc,
  target: Container,
  alpha: boolean,
  paint: (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    camera: Camera,
  ) => void,
): Promise<ResidentTexture[]> {
  const residents: ResidentTexture[] = []
  for (const tile of boneyardStaticTiles(document.meta.bounds)) {
    const width = Math.ceil(tile.w)
    const height = Math.ceil(tile.h)
    const canvas = documentNodeCanvas(width, height)
    const context = canvas.getContext('2d', { alpha, willReadFrequently: alpha })
    if (!context) throw new Error('Boneyard static tile could not acquire Canvas2D.')
    paint(
      context,
      width,
      height,
      { x: tile.x + width / 2, y: tile.y + height / 2, zoom: 1 },
    )
    const crop = alpha ? cropTransparentCanvas(canvas) : { canvas, x: 0, y: 0 }
    if (crop) {
      const resident = residentTexture(crop.canvas, tile.x + crop.x, tile.y + crop.y)
      target.addChild(resident.sprite)
      residents.push(resident)
    }
    await nextFrame()
  }
  return residents
}

function buildMainLayerResident(
  document: EditorDoc,
  layer: MainLayer,
  layerIndex: number,
): ResidentTexture | null {
  const bounds = mainLayerCaptureBounds(layer)
  const canvas = documentNodeCanvas(bounds.w, bounds.h)
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) throw new Error('Boneyard painter layer could not acquire Canvas2D.')
  drawNativeBoneyardMainBand(
    context,
    bounds.w,
    bounds.h,
    {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
      zoom: 1,
    },
    document,
    [layerIndex],
  )
  const crop = cropTransparentCanvas(canvas)
  return crop
    ? residentTexture(crop.canvas, bounds.x + crop.x, bounds.y + crop.y)
    : null
}

function mainLayerCaptureBounds(layer: MainLayer): { h: number; w: number; x: number; y: number } {
  const ref = layer.kind === 'object'
    ? spriteRefFor(layer.atlas, layer.atlasEntry)
    : layer.part === 'post'
      ? spriteRefFor('DeadHawg', 36 + (layer.postVariant ?? 0))
      : null
  if (ref) {
    return {
      x: Math.floor(layer.pos.x - ref.anchorX) - 1,
      y: Math.floor(layer.pos.y - ref.anchorY) - 1,
      w: Math.ceil(ref.w) + 2,
      h: Math.ceil(ref.h) + 2,
    }
  }

  const points = layer.kind === 'fence' ? layer.fence.points : [layer.pos]
  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxX = Math.max(...points.map((point) => point.x))
  const maxY = Math.max(...points.map((point) => point.y))
  const margin = 256
  const x = Math.floor(minX - margin)
  const y = Math.floor(minY - margin)
  return {
    x,
    y,
    w: Math.max(1, Math.ceil(maxX + margin) - x),
    h: Math.max(1, Math.ceil(maxY + margin) - y),
  }
}

function cropTransparentCanvas(
  canvas: HTMLCanvasElement,
): { canvas: HTMLCanvasElement; x: number; y: number } | null {
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) throw new Error('Boneyard texture crop could not acquire Canvas2D.')
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX || maxY < minY) return null
  const cropped = documentNodeCanvas(maxX - minX + 1, maxY - minY + 1)
  const croppedContext = cropped.getContext('2d', { alpha: true })
  if (!croppedContext) throw new Error('Boneyard cropped texture could not acquire Canvas2D.')
  croppedContext.drawImage(
    canvas,
    minX,
    minY,
    cropped.width,
    cropped.height,
    0,
    0,
    cropped.width,
    cropped.height,
  )
  return { canvas: cropped, x: minX, y: minY }
}

function residentTexture(canvas: HTMLCanvasElement, x: number, y: number): ResidentTexture {
  const texture = Texture.from(canvas, true)
  texture.source.style.scaleMode = 'nearest'
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  sprite.eventMode = 'none'
  return { sprite, texture }
}

function isMovingGateBody(layer: MainLayer | undefined): layer is Extract<MainLayer, { kind: 'fence' }> {
  return Boolean(
    layer
    && layer.kind === 'fence'
    && layer.part === 'body'
    && (layer.fence.segmentCode ?? layer.fence.style ?? 0) === 2,
  )
}

function runtimeMainWorldY(
  layer: MainLayer,
  gateLeaves: ReadonlyMap<string, BoneyardGateLeafSnapshot>,
): number {
  if (!isMovingGateBody(layer)) return layer.worldY
  const leaf = gateLeaves.get(`${layer.fence.eid}:${layer.pieceIndex}`)
  return leaf ? nativeGatePainterRoot(leaf.hinge, leaf.tip).y : layer.worldY
}

function editorDocument(loaded: LoadedBoneyard): EditorDoc {
  const scene = loaded.scene
  return {
    meta: { name: scene.name, bounds: { ...scene.bounds } },
    objects: scene.objects.map((object) => ({ ...object, pos: { ...object.pos } })),
    sprites: scene.sprites.map((sprite) => ({ ...sprite, pos: { ...sprite.pos } })),
    roads: scene.roads.map((road) => ({
      ...road,
      points: road.points.map((point) => ({ ...point })),
      ...(road.quad ? { quad: road.quad.map((point) => ({ ...point })) } : {}),
    })),
    fences: scene.fences.map((fence) => ({
      ...fence,
      points: fence.points.map((point) => ({ ...point })),
    })),
    terrain: scene.terrain.map(({ points, ...terrain }) => ({
      ...terrain,
      ...(points ? { points: points.map((point) => ({ ...point })) } : {}),
    })),
    opaque: [],
    hasTimeline: false,
    spawn: { ...scene.spawn },
  }
}

async function loadStaticPainterImages(): Promise<void> {
  await Promise.all([...new Set([...BONEYARD_SPRITE_SOURCES, ...STAGE_TEXTURES])]
    .map(loadStaticPainterImage))
}

function loadStaticPainterImage(source: string): Promise<void> {
  const image = spriteImage(source)
  if (image.complete && image.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const loaded = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(new Error(`could not load Boneyard painter asset: ${source}`))
    }
    const cleanup = () => {
      image.removeEventListener('load', loaded)
      image.removeEventListener('error', failed)
    }
    image.addEventListener('load', loaded)
    image.addEventListener('error', failed)
  })
}

function plantedSprite(texture: Texture, ref: SpriteRef, position: Vec2): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(ref.anchorX / ref.w, ref.anchorY / ref.h)
  sprite.position.set(position.x, position.y)
  sprite.eventMode = 'none'
  return sprite
}

function requiredSpriteRef(entry: number): SpriteRef {
  const ref = spriteRefFor('DeadHawg', entry)
  if (!ref) throw new Error(`Boneyard DeadHawg record ${entry} is unavailable.`)
  return ref
}

function requiredTexture(textures: BoneyardWorldTextures, ref: SpriteRef): Texture {
  const texture = textures.base[ref.src]
  if (!texture) throw new Error(`Boneyard texture was not loaded: ${ref.src}`)
  return texture
}

function requireBoneyardSnapshot(snapshot: GameSnapshot, runId: string): asserts snapshot is GameSnapshot & {
  world: Extract<GameSnapshot['world'], { kind: 'boneyard' }>
} {
  if (snapshot.world.kind !== 'boneyard' || snapshot.world.runId !== runId) {
    throw new Error('Boneyard renderer received a snapshot for another scene.')
  }
}

function documentNodeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = window.document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
