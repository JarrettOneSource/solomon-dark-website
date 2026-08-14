// Installs Pixi's static CSP-safe sync paths; this module removes the need for eval.
import 'pixi.js/unsafe-eval'
import {
  Application,
  Container,
  Graphics,
  MeshSimple,
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
  nativeGateArtVertices,
  nativeGateLeaf,
  nativeGateHingeArtPosition,
  nativeGatePainterRoot,
  NATIVE_GATE_ART_INDICES,
  NATIVE_GATE_ART_UVS,
  type NativeGateLeaf,
} from '../../editor/native-fence-geometry.ts'
import {
  buildBoneyardPainterOrder,
  type DynamicPainterLayer,
  type StaticPainterLayer,
} from '../boneyard-painter-order.ts'
import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import type { GameSnapshot, LoadedBoneyard } from '../protocol/game-protocol.ts'
import { PlayerWorldView } from './hub-actors.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { initialHubResolution } from './hub-render-contract.ts'
import {
  BONEYARD_CAMERA_ZOOM,
  type BoneyardBounds,
  boneyardCamera,
  boneyardResidentIsVisible,
  boneyardStaticTiles,
  boneyardVisibleWorldBounds,
  boneyardWorldPosition,
} from './boneyard-render-contract.ts'
import {
  destroyBoneyardWorldTextures,
  loadBoneyardWorldTextures,
  type BoneyardWorldTextures,
} from './boneyard-textures.ts'
import {
  NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
  nativeAcceptedBoneyardLightSources,
  nativeBoneyardLightScalar,
  nativeBoneyardLightTint,
  nativeLanternLightSource,
  nativePlayerLightSource,
  nativeSolomonSetPieceLighting,
  type NativeBoneyardLightSource,
  type NativeSolomonSetPieceLighting,
} from './boneyard-lighting.ts'
import { BoneyardRegionLightField } from './boneyard-region-light-field.ts'
import { NativeEnemyViews } from './native-enemy-view.ts'
import {
  nativeEnemyPainterLayer,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'
import { PrimarySpellWorldView } from './primary-spell-world-view.ts'

interface BoneyardRendererFrameDiagnostics {
  enemyCount: number
  enemyFamilies: string
  frameCount: number
  foregroundZIndex: number
  gateLeafCount: number
  cameraRenderGroup: boolean
  culledResidentCount: number
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
  primarySpellCount: number
  primarySpellKinds: readonly string[]
  playerScreenX: number
  playerScreenY: number
  playerWalkPose: number
  playerX: number
  playerY: number
  solomonFrame: number
  staticLayerCount: number
  staticPaintCount: number
  tick: number
  residentCount: number
  regionLightCompositeZIndex: number
  visibleMainLayerCount: number
  visibleOversizedResidentCount: number
  visibleResidentCount: number
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

interface ResidentTexture extends BoneyardBounds {
  mainLayerIndex: number | null
  sprite: Sprite
  texture: Texture
}

interface StaticWorldBuild {
  foreground: Container
  mainResidents: ReadonlyMap<number, ResidentTexture>
  residents: ResidentTexture[]
  staticPaintCount: number
}

class BoneyardResidentVisibility {
  private readonly residents: readonly ResidentTexture[]
  readonly visibleMainResidents: ResidentTexture[] = []
  culledResidentCount = 0
  visibleOversizedResidentCount = 0
  visibleResidentCount = 0

  constructor(residents: readonly ResidentTexture[]) {
    this.residents = residents
  }

  update(camera: Camera, viewport: GameViewportLayout): void {
    const view = boneyardVisibleWorldBounds(camera, viewport)
    this.culledResidentCount = 0
    this.visibleMainResidents.length = 0
    this.visibleOversizedResidentCount = 0
    this.visibleResidentCount = 0
    for (const resident of this.residents) {
      const visible = boneyardResidentIsVisible(resident, view)
      resident.sprite.renderable = visible
      if (!visible) {
        this.culledResidentCount += 1
        continue
      }
      this.visibleResidentCount += 1
      if (resident.w > view.w || resident.h > view.h) {
        this.visibleOversizedResidentCount += 1
      }
      if (resident.mainLayerIndex !== null) this.visibleMainResidents.push(resident)
    }
  }
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
  const world = new Container({ isRenderGroup: true, label: 'boneyard-world' })
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
    staticWorld.mainResidents,
    staticWorld.foreground,
  )
  const regionLightField = new BoneyardRegionLightField(
    world,
    textures.regionLightGlyph,
    viewport,
    initialResolution,
  )
  const visibility = new BoneyardResidentVisibility(staticWorld.residents)
  const canvas = application.canvas as HTMLCanvasElement
  canvas.className = 'boneyard-world-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.gameRenderer = 'pixi-webgl'
  canvas.dataset.rendererName = application.renderer.name
  canvas.dataset.resolution = `${initialResolution}`
  canvas.dataset.regionLightComposite = 'multiply-pre-main'
  canvas.dataset.regionLightEntry = 'DeadHawg:18'
  canvas.dataset.regionLighting = 'native-region-field+object-scalar'
  canvas.dataset.staticCulling = 'exact-world-bounds'
  canvas.dataset.staticPaintCount = `${staticWorld.staticPaintCount}`
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  canvas.dataset.viewportHeight = `${viewport.height}`
  canvas.dataset.viewportWidth = `${viewport.width}`

  let destroyed = false
  let frameCount = 0
  let resolution = initialResolution
  const frameDiagnostics: BoneyardRendererFrameDiagnostics = {
    enemyCount: 0,
    enemyFamilies: '',
    frameCount: 0,
    foregroundZIndex: 0,
    gateLeafCount: 0,
    cameraRenderGroup: world.isRenderGroup,
    culledResidentCount: 0,
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
    primarySpellCount: 0,
    primarySpellKinds: [],
    playerScreenX: Number.NaN,
    playerScreenY: Number.NaN,
    playerWalkPose: 0,
    playerX: Number.NaN,
    playerY: Number.NaN,
    solomonFrame: 0,
    staticLayerCount: mainLayers.length,
    staticPaintCount: staticWorld.staticPaintCount,
    tick: options.initialSnapshot.tick,
    residentCount: staticWorld.residents.length,
    regionLightCompositeZIndex: NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
    visibleMainLayerCount: 0,
    visibleOversizedResidentCount: 0,
    visibleResidentCount: 0,
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
      const camera = cameraFor(snapshot)
      visibility.update(camera, viewport)
      const painter = scene.update(
        snapshot,
        options.playerId,
        frameCount,
        visibility.visibleMainResidents,
      )
      regionLightField.render(
        application.renderer,
        scene.currentLightSources,
        camera,
        viewport,
      )
      const worldPosition = boneyardWorldPosition(camera, viewport)
      world.scale.set(BONEYARD_CAMERA_ZOOM)
      world.position.set(worldPosition.x, worldPosition.y)
      application.render()

      frameDiagnostics.frameCount = frameCount
      frameDiagnostics.enemyCount = scene.enemyCount
      frameDiagnostics.enemyFamilies = scene.enemyFamilies
      frameDiagnostics.foregroundZIndex = painter.foregroundZIndex
      frameDiagnostics.gateLeafCount = snapshot.world.gateLeaves.length
      frameDiagnostics.culledResidentCount = visibility.culledResidentCount
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
      frameDiagnostics.playerCount = scene.playerCount
      frameDiagnostics.primarySpellCount = scene.primarySpellCount
      frameDiagnostics.primarySpellKinds = scene.primarySpellKinds
      frameDiagnostics.playerScreenX = (player.position.x - camera.x) * camera.zoom
        + viewport.width / 2
      frameDiagnostics.playerScreenY = (player.position.y - camera.y) * camera.zoom
        + viewport.height / 2
      frameDiagnostics.playerWalkPose = scene.playerWalkPose(options.playerId)
      frameDiagnostics.playerX = player.position.x
      frameDiagnostics.playerY = player.position.y
      frameDiagnostics.solomonFrame = scene.solomonFrame
      frameDiagnostics.tick = snapshot.tick
      frameDiagnostics.visibleMainLayerCount = visibility.visibleMainResidents.length
      frameDiagnostics.visibleOversizedResidentCount = visibility.visibleOversizedResidentCount
      frameDiagnostics.visibleResidentCount = visibility.visibleResidentCount
      canvas.dataset.enemyCount = `${scene.enemyCount}`
      canvas.dataset.enemyFamilies = scene.enemyFamilies
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
      regionLightField.resize(viewport, resolution)
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
      regionLightField.destroy()
      for (const resident of staticWorld?.residents ?? []) resident.texture.destroy(true)
      staticWorld = null
      world.destroy({ children: true })
      destroyBoneyardWorldTextures(textures)
      application.destroy({ removeView: true })
      canvas.remove()
    },
  }

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
  private readonly dynamicLayers: DynamicPainterLayer[] = []
  private readonly enemies: NativeEnemyViews
  private readonly foreground: Container
  private readonly gateLeaves = new Map<string, BoneyardGateLeafSnapshot>()
  private readonly gates: BoneyardGateViews
  private readonly lightSourceCandidates: NativeBoneyardLightSource[] = []
  private readonly lightSources: NativeBoneyardLightSource[] = []
  private readonly livePlayerIds = new Set<string>()
  private readonly mainLayers: readonly MainLayer[]
  private readonly mainResidents: ReadonlyMap<number, ResidentTexture>
  private readonly players = new Map<string, PlayerWorldView>()
  private readonly primarySpells: PrimarySpellWorldView
  private readonly positionedDynamics = new Map<string, { row: number; zIndex: number }>()
  private readonly root: Container
  private readonly solomon: BoneyardSolomonView | null
  private readonly staticPainterLayers: StaticPainterLayer[]
  private readonly textures: BoneyardWorldTextures
  private visibleEnemyFamilies = ''

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    textures: BoneyardWorldTextures,
    mainLayers: readonly MainLayer[],
    mainResidents: ReadonlyMap<number, ResidentTexture>,
    foreground: Container,
  ) {
    this.boneyard = boneyard
    this.root = root
    this.textures = textures
    this.mainLayers = mainLayers
    this.mainResidents = mainResidents
    this.foreground = foreground
    this.primarySpells = new PrimarySpellWorldView(root, textures)
    this.staticPainterLayers = mainLayers.map((layer, layerIndex) => ({
      layerIndex,
      worldY: layer.worldY,
      sortBias: layer.sortBias,
      sourceOrder: layer.sourceOrder,
    }))
    this.gates = new BoneyardGateViews(root, textures)
    this.enemies = new NativeEnemyViews(root, textures)
    this.solomon = boneyard.scene.solomonDig
      ? new BoneyardSolomonView(boneyard, root, textures)
      : null
  }

  update(
    snapshot: GameSnapshot,
    localPlayerId: string,
    presentationFrame: number,
    visibleMainResidents: readonly ResidentTexture[],
  ): BoneyardPainterFrame {
    requireBoneyardSnapshot(snapshot, this.boneyard.runId)
    const enemySnapshots = nativeEnemySnapshots(snapshot)
    const livePlayerIds = this.livePlayerIds
    livePlayerIds.clear()
    for (const playerId in snapshot.players) {
      const player = snapshot.players[playerId]
      livePlayerIds.add(playerId)
      let view = this.players.get(playerId)
      if (!view) {
        view = new PlayerWorldView(player.config.element, this.textures)
        this.players.set(playerId, view)
        this.root.addChild(view.container)
      }
      view.update(player, snapshot.tick)
    }
    for (const [playerId, view] of this.players) {
      if (livePlayerIds.has(playerId)) continue
      this.root.removeChild(view.container)
      view.destroy()
      this.players.delete(playerId)
    }
    this.primarySpells.update(
      snapshot.primarySpells,
      `boneyard:${snapshot.world.runId}`,
    )
    this.gates.update(snapshot.world.gateLeaves)
    this.enemies.update(enemySnapshots, snapshot.tick)
    this.visibleEnemyFamilies = [...new Set(
      enemySnapshots.map((enemy) => enemy.enemyToken),
    )].sort().join(',')
    this.solomon?.update(snapshot.tick)

    const dig = this.boneyard.scene.solomonDig
    const lanternLight = dig
      ? nativeLanternLightSource(dig.lanternPosition, presentationFrame)
      : null
    const lightSourceCandidates = this.lightSourceCandidates
    lightSourceCandidates.length = 0
    for (const playerId in snapshot.players) {
      lightSourceCandidates.push(nativePlayerLightSource(snapshot.players[playerId]))
    }
    if (lanternLight) lightSourceCandidates.push(lanternLight)
    const lightSources = nativeAcceptedBoneyardLightSources(
      lightSourceCandidates,
      this.lightSources,
    )
    let maxMainLightScalar = 0
    let minMainLightScalar = 1
    for (const resident of visibleMainResidents) {
      const layerIndex = resident.mainLayerIndex
      if (layerIndex === null) continue
      const scalar = nativeBoneyardLightScalar(
        this.mainLayers[layerIndex].pos,
        lightSources,
      )
      resident.sprite.tint = nativeBoneyardLightTint(scalar)
      maxMainLightScalar = Math.max(maxMainLightScalar, scalar)
      minMainLightScalar = Math.min(minMainLightScalar, scalar)
    }
    for (const [id, view] of this.players) {
      const player = snapshot.players[id]
      if (!player) continue
      view.setWorldTint(nativeBoneyardLightTint(
        nativeBoneyardLightScalar(player.position, lightSources),
      ))
    }
    for (const spell of snapshot.primarySpells.projectiles) {
      if (spell.worldKey !== `boneyard:${snapshot.world.runId}`) continue
      this.primarySpells.setTint(
        `primary-spell:${spell.id}`,
        nativeBoneyardLightTint(nativeBoneyardLightScalar(spell.position, lightSources)),
      )
    }
    for (const effect of snapshot.primarySpells.transients) {
      if (effect.worldKey !== `boneyard:${snapshot.world.runId}`) continue
      this.primarySpells.setTint(
        `primary-spell:${effect.id}`,
        nativeBoneyardLightTint(nativeBoneyardLightScalar(effect.origin, lightSources)),
      )
    }
    for (const enemy of enemySnapshots) {
      this.enemies.setTint(enemy.id, nativeBoneyardLightTint(
        nativeBoneyardLightScalar(enemy.position, lightSources),
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
      this.solomon?.setLighting(nativeSolomonSetPieceLighting(
        dig.position,
        dig.lanternPosition,
        lightSources,
      ))
    }

    const localPlayer = snapshot.players[localPlayerId]
    if (!localPlayer) throw new Error('Boneyard renderer lost its local player.')
    const gateLeaves = this.gateLeaves
    gateLeaves.clear()
    for (const leaf of snapshot.world.gateLeaves) {
      gateLeaves.set(`${leaf.fenceEid}:${leaf.side}`, leaf)
    }
    const dynamicLayers = this.dynamicLayers
    dynamicLayers.length = 0
    for (const playerId in snapshot.players) {
      const player = snapshot.players[playerId]
      dynamicLayers.push({
        id: `player:${playerId}`,
        worldY: player.position.y,
        sortBias: 0,
        sourceOrder: dynamicLayers.length,
      })
    }
    for (const layer of this.primarySpells.painterLayers()) {
      dynamicLayers.push({ ...layer, sourceOrder: dynamicLayers.length })
    }
    for (const enemy of enemySnapshots) {
      dynamicLayers.push(nativeEnemyPainterLayer(enemy, dynamicLayers.length))
    }
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
    for (const layer of this.staticPainterLayers) {
      layer.worldY = runtimeMainWorldY(this.mainLayers[layer.layerIndex], gateLeaves)
    }
    const order = buildBoneyardPainterOrder({
      referenceY: localPlayer.position.y,
      staticLayers: this.staticPainterLayers,
      dynamicLayers,
    })
    let maxMainZIndex = 0
    let minMainZIndex = Number.POSITIVE_INFINITY
    for (const band of order.bands) {
      band.layerIndexes.forEach((layerIndex, position) => {
        const depth = band.zIndex + ((position + 1) / (band.layerIndexes.length + 1)) * 0.5
        maxMainZIndex = Math.max(maxMainZIndex, depth)
        minMainZIndex = Math.min(minMainZIndex, depth)
        const resident = this.mainResidents.get(layerIndex)
        if (resident?.sprite.renderable) resident.sprite.zIndex = depth
        const layer = this.mainLayers[layerIndex]
        if (isMovingGateBody(layer)) {
          this.gates.setDepth(layer.fence.eid, layer.pieceIndex, depth)
        }
      })
    }
    const positionedDynamics = this.positionedDynamics
    positionedDynamics.clear()
    let maxDynamicZIndex = 0
    for (const layer of order.dynamicLayers) {
      positionedDynamics.set(layer.id, layer)
      maxDynamicZIndex = Math.max(maxDynamicZIndex, layer.zIndex)
    }
    for (const [id, view] of this.players) {
      view.setDepth(positionedDynamics.get(`player:${id}`)?.zIndex ?? 1)
    }
    for (const layer of this.primarySpells.painterLayers()) {
      this.primarySpells.setDepth(
        layer.id,
        positionedDynamics.get(layer.id)?.zIndex ?? 1,
      )
    }
    for (const enemy of enemySnapshots) {
      this.enemies.setDepth(
        enemy.id,
        positionedDynamics.get(`enemy:${enemy.id}`)?.zIndex ?? 1,
      )
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
      mainAboveLocal: maxMainZIndex > localPlayerZIndex,
      mainBelowLocal: minMainZIndex < localPlayerZIndex,
      maxDynamicZIndex,
      maxMainLightScalar,
      maxMainZIndex,
      minMainLightScalar: visibleMainResidents.length > 0 ? minMainLightScalar : 0,
      painterBandCount: order.bands.length,
    }
  }

  get playerCount(): number {
    return this.players.size
  }

  get enemyCount(): number {
    return this.enemies.size
  }

  get enemyFamilies(): string {
    return this.visibleEnemyFamilies
  }

  get currentLightSources(): readonly NativeBoneyardLightSource[] {
    return this.lightSources
  }

  get primarySpellCount(): number {
    return this.primarySpells.count
  }

  get primarySpellKinds(): readonly string[] {
    return this.primarySpells.kinds
  }

  playerWalkPose(playerId: string): number {
    return this.players.get(playerId)?.walkPose ?? 0
  }

  get solomonFrame(): number {
    return this.solomon?.frame ?? 0
  }

  destroy(): void {
    this.primarySpells.destroy()
    this.enemies.destroy()
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

  setLighting(lighting: NativeSolomonSetPieceLighting): void {
    this.digRoot.tint = lighting.digRootTint
    this.lantern.tint = lighting.lanternTint
  }

  destroy(): void {
    this.root.removeChild(this.digRoot, this.lantern)
    this.digRoot.destroy({ children: true })
    this.lantern.destroy()
  }
}

class BoneyardGateViews {
  private readonly leaves = new Map<string, BoneyardGateLeafView>()
  private readonly liveLeafIds = new Set<string>()
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
    const live = this.liveLeafIds
    live.clear()
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
    this.liveLeafIds.clear()
  }
}

class BoneyardGateLeafView {
  readonly container = new Container({ label: 'gate-leaf' })
  private readonly gateLeaf: MeshSimple
  private readonly gateVertices = new Float32Array(8)
  private readonly hinge: Sprite
  private readonly lines = new Graphics()
  private readonly root: Container

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    const leafRef = requiredSpriteRef(7)
    const hingeRef = requiredSpriteRef(8)
    const leafTexture = requiredTexture(textures, leafRef)
    const hingeTexture = requiredTexture(textures, hingeRef)
    this.gateLeaf = new MeshSimple({
      texture: leafTexture,
      vertices: this.gateVertices,
      uvs: new Float32Array(NATIVE_GATE_ART_UVS),
      indices: new Uint32Array(NATIVE_GATE_ART_INDICES),
      topology: 'triangle-list',
    })
    this.hinge = plantedSprite(hingeTexture, hingeRef, { x: 0, y: 0 })
    this.gateLeaf.eventMode = 'none'
    this.gateLeaf.zIndex = 0
    this.hinge.zIndex = 1
    this.lines.zIndex = 2
    this.container.sortableChildren = true
    this.container.addChild(this.gateLeaf, this.hinge, this.lines)
    root.addChild(this.container)
  }

  update(state: BoneyardGateLeafSnapshot): void {
    const leaf = nativeGateLeaf(state.hinge, state.tip)
    nativeGateArtVertices(leaf, this.gateVertices)
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
  const mainResidents = new Map<number, ResidentTexture>()
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
        mainResidents.set(layerIndex, resident)
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
  return { foreground, mainResidents, residents, staticPaintCount }
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
    ? residentTexture(crop.canvas, bounds.x + crop.x, bounds.y + crop.y, layerIndex)
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

function residentTexture(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  mainLayerIndex: number | null = null,
): ResidentTexture {
  const texture = Texture.from(canvas, true)
  texture.source.style.scaleMode = 'nearest'
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  sprite.eventMode = 'none'
  return {
    h: canvas.height,
    mainLayerIndex,
    sprite,
    texture,
    w: canvas.width,
    x,
    y,
  }
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

function nativeEnemySnapshots(snapshot: GameSnapshot): readonly NativeEnemyVisualSnapshot[] {
  const world = snapshot.world as typeof snapshot.world & {
    waves?: { enemies: readonly NativeEnemyVisualSnapshot[] } | null
  }
  return world.waves?.enemies ?? []
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
