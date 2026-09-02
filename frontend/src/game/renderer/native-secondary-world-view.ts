import {
  ColorMatrixFilter,
  Container,
  MeshSimple,
  RenderTexture,
  Sprite,
  Texture,
  type Renderer,
} from 'pixi.js'

import type {
  NativeSecondaryActorState,
  NativeSecondarySimulationState,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  nativeWorldPainterRegistration,
  type NativeWorldManagerRegistration,
} from '../core-kernels/native-world-manager-order.ts'
import type { NativeRegionPainterInsertion } from '../region-painter-order.ts'
import { hubWorldDepthForActor } from './hub-render-contract.ts'
import {
  AirPrimarySpellView,
  type NativeAirLightningViewState,
} from './primary-spell-air-view.ts'
import {
  nativeSecondarySpriteKey,
  nativeSecondarySpriteRecord,
} from './native-secondary-assets.ts'
import {
  NativeSecondaryPresentationScratch,
  NATIVE_LEVIATHAN_RENDER_TARGET_SIZE,
  nativeLeviathanCompositePlan,
  nativeSecondaryCompositeOwnerEntries,
  updateNativeSecondaryPresentationPlan,
  type NativeSecondaryGradientDraw,
  type NativeLeviathanCompositePlan,
  type NativeSecondaryMeshDraw,
  type NativeSecondaryPresentationPlan,
  type NativeSecondaryQuadDraw,
  type NativeSecondarySpriteDraw,
  type NativeStormWeatherComposite,
} from './native-secondary-presentation.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'
import {
  nativeArenaPackedColor,
  setNativeArenaVertexColors,
} from './native-arena-render-pipeline.ts'

const QUAD_UVS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
const QUAD_INDICES = new Uint32Array([0, 1, 2, 1, 2, 3])
const STORM_RENDER_TARGET_SIZE = 256
const DIAGNOSTIC_ACTOR_KINDS = new Set<NativeSecondaryActorState['kind']>([
  'acid-rain',
  'dampen-wave',
  'dampened-projectile',
  'freeze-wave-visual',
  'golem',
  'leviathan',
  'leviathan-appendage',
  'plane-orb-shot',
  'storm-cloud',
  'ether-drain',
])

function hotDropUsesDirectPrimitives(kind: NativeSecondaryActorState['kind']): boolean {
  return kind === 'acid-drop' || kind === 'acid-splash' || kind === 'storm-drop'
}

const WHITE_ALPHA_MASK_FILTER = new ColorMatrixFilter()
WHITE_ALPHA_MASK_FILTER.matrix = [
  0, 0, 0, 0, 1,
  0, 0, 0, 0, 1,
  0, 0, 0, 0, 1,
  0, 0, 0, 1, 0,
]
const WHITE_ALPHA_MASK_FILTERS = [WHITE_ALPHA_MASK_FILTER]

export interface NativeSecondaryPainterLayer {
  readonly id: string
  readonly insertions?: readonly NativeRegionPainterInsertion[]
  readonly lane: 'pre-world-queue' | 'world-sorted'
  readonly queueFamily: 'ordinary-dynamic' | 'zanim' | null
  readonly regionLightPoint: Readonly<{ x: number; y: number }> | null
  readonly registration: NativeWorldManagerRegistration | null
  readonly sortBias: number
  readonly sourceOrder: number
  readonly visible?: boolean
  readonly worldY: number
}

type MutableNativeSecondaryPainterLayer = {
  -readonly [Field in keyof NativeSecondaryPainterLayer]: NativeSecondaryPainterLayer[Field]
}

type MutableNativeRegionPainterInsertion = {
  -readonly [Field in keyof NativeRegionPainterInsertion]: NativeRegionPainterInsertion[Field]
}

export interface NativeSecondaryDiagnosticSample {
  readonly compositeOwnerId: number
  readonly depth: number
  readonly id: number
  readonly kind: NativeSecondaryActorState['kind']
  readonly mainDrawMembers: readonly string[]
  readonly mainDrawOffsetsY: readonly number[]
  readonly meshVertexColors: readonly (readonly number[])[]
  readonly leviathanCompositePlan: NativeLeviathanCompositePlan | null
  readonly primitiveCount: number
  readonly sortBias: number
  readonly underlayDepth: number | null
  readonly underlayDrawMembers: readonly string[]
  readonly underlayPrimitiveCount: number
  readonly worldX: number
  readonly worldY: number
}

interface NativeSecondarySpriteBinding {
  alpha: number
  atlas: NativeSecondarySpriteDraw['atlas'] | null
  blend: NativeSecondarySpriteDraw['blend'] | null
  colorMode: NativeSecondarySpriteDraw['colorMode'] | null
  entry: number
  offsetX: number
  offsetY: number
  role: string
  rotationRadians: number
  scaleX: number
  scaleY: number
  sourceOrder: number
  tint: number
}

class NativeSecondaryActorView {
  private readonly cachedPainterLayers: NativeSecondaryPainterLayer[] = []
  readonly container = new Container({ label: 'native-secondary-actor' })
  readonly underlayContainer: Container | null
  private readonly birthPointGain: number
  private currentKind: NativeSecondaryActorState['kind']
  private depth = 0
  private readonly directPrimitives: boolean
  private plan: NativeSecondaryPresentationPlan
  private readonly presentationScratch = new NativeSecondaryPresentationScratch()
  private readonly primitiveParent: Container
  private proxyPainterInsertion: MutableNativeRegionPainterInsertion | null = null
  private proxyPainterLayer: MutableNativeSecondaryPainterLayer | null = null
  private regionLightPoint: Readonly<{ x: number; y: number }> | null = null
  private renderable = true
  private readonly gradientMeshes: MeshSimple[] = []
  private readonly gradientVertices: Float32Array[] = []
  private readonly meshIndices: Uint32Array[] = []
  private readonly meshMeshes: MeshSimple[] = []
  private readonly meshUvs: Float32Array[] = []
  private readonly meshVertexColors: Uint32Array[] = []
  private readonly meshVertices: Float32Array[] = []
  private readonly quadMeshes: MeshSimple[] = []
  private readonly quadVertices: Float32Array[] = []
  private readonly renderer: Renderer
  private readonly spriteBindings: NativeSecondarySpriteBinding[] = []
  private readonly sprites: Sprite[] = []
  private state: NativeSecondaryActorState
  private readonly stormLightning: AirPrimarySpellView | null
  private stormWeather: NativeStormWeatherView | null = null
  private readonly textures: PlayerWorldTextures['secondary']
  private readonly specialTextures: PlayerWorldTextures['secondarySpecial']
  private readonly underlaySpriteBindings: NativeSecondarySpriteBinding[] = []
  private readonly underlaySprites: Sprite[] = []
  private underlayPainterLayer: MutableNativeSecondaryPainterLayer | null = null
  private worldPainterLayer: MutableNativeSecondaryPainterLayer | null = null

  constructor(
    state: NativeSecondarySimulationState['actors'][number],
    textures: PlayerWorldTextures,
    renderer: Renderer,
    root: Container,
    pointGain = 1,
  ) {
    this.state = state
    this.birthPointGain = pointGain
    this.currentKind = state.kind
    this.directPrimitives = hotDropUsesDirectPrimitives(state.kind)
    this.textures = textures.secondary
    this.specialTextures = textures.secondarySpecial
    this.renderer = renderer
    this.primitiveParent = this.directPrimitives ? root : this.container
    this.container.label = `native-secondary:${state.kind}:${state.id}`
    this.container.eventMode = 'none'
    this.container.sortableChildren = true
    this.plan = updateNativeSecondaryPresentationPlan(
      this.presentationScratch,
      state,
      state.ageTicks,
      pointGain,
    )
    this.underlayContainer = state.kind === 'acid-rain'
      ? new Container({ label: 'native-secondary-underlay' })
      : null
    if (this.underlayContainer) {
      this.underlayContainer.label = `native-secondary-underlay:${state.kind}:${state.id}`
      this.underlayContainer.eventMode = 'none'
      this.underlayContainer.sortableChildren = true
    }
    this.stormLightning = state.kind === 'storm-strike'
      ? new AirPrimarySpellView(
          stormStrikeTransient(state),
          textures.primarySpells.air,
          { split: false },
        )
      : null
    if (this.stormLightning) {
      this.container.addChild(...this.stormLightning.containers)
    }
    this.update(state)
  }

  update(
    state: NativeSecondarySimulationState['actors'][number],
    presentationFrame = state.ageTicks,
  ): void {
    this.state = state
    if (this.currentKind !== state.kind) {
      this.currentKind = state.kind
      this.container.label = `native-secondary:${state.kind}:${state.id}`
      if (this.underlayContainer) {
        this.underlayContainer.label = `native-secondary-underlay:${state.kind}:${state.id}`
      }
    }
    this.plan = updateNativeSecondaryPresentationPlan(
      this.presentationScratch,
      state,
      presentationFrame,
      state.kind === 'ring-fire-explosion' ? this.birthPointGain : 1,
    )
    this.regionLightPoint = state.kind === 'earthquake-debris'
      ? { ...state.position }
      : null
    if (!this.directPrimitives) {
      this.container.position.set(this.plan.root.x, this.plan.root.y)
    }
    if (this.underlayContainer) {
      this.underlayContainer.position.set(this.plan.root.x, this.plan.root.y)
    }
    if (
      state.kind === 'acid-drop'
      || state.kind === 'acid-splash'
      || state.kind === 'storm-drop'
    ) {
      this.updateHotDropPrimitives()
      return
    }
    if (state.kind === 'storm-strike') {
      this.stormLightning?.update(stormStrikeTransient(state))
    }
    if (this.plan.stormComposite) {
      if (!this.stormWeather) {
        this.stormWeather = new NativeStormWeatherView(this.textures)
        this.container.addChild(this.stormWeather.composite)
      }
      this.stormWeather.update(this.plan.stormComposite, this.renderer)
    } else if (this.stormWeather) {
      this.container.removeChild(this.stormWeather.composite)
      this.stormWeather.destroy()
      this.stormWeather = null
    }
    while (this.meshMeshes.length < this.plan.meshes.length) {
      this.addMesh(this.plan.meshes[this.meshMeshes.length]!)
    }
    while (this.meshMeshes.length > this.plan.meshes.length) this.removeMesh()
    for (let index = 0; index < this.plan.meshes.length; index += 1) {
      applyMesh(
        this.meshMeshes[index]!,
        this.meshVertices[index]!,
        this.meshUvs[index]!,
        this.meshIndices[index]!,
        this.meshVertexColors[index]!,
        this.plan.meshes[index]!,
        this.specialTextures,
        index,
      )
    }
    while (this.gradientMeshes.length < this.plan.gradients.length) {
      this.addGradient(this.plan.gradients[this.gradientMeshes.length]!)
    }
    while (this.gradientMeshes.length > this.plan.gradients.length) this.removeGradient()
    for (let index = 0; index < this.plan.gradients.length; index += 1) {
      applyGradient(
        this.gradientMeshes[index]!,
        this.gradientVertices[index]!,
        this.plan.gradients[index]!,
      )
    }
    while (this.quadMeshes.length < this.plan.quads.length) this.addQuadMesh()
    while (this.quadMeshes.length > this.plan.quads.length) this.removeQuadMesh()
    for (let index = 0; index < this.plan.quads.length; index += 1) {
      applyQuad(
        this.quadMeshes[index]!,
        this.quadVertices[index]!,
        this.plan.quads[index]!,
        this.textures,
        index,
      )
    }
    while (this.sprites.length < this.plan.draws.length) {
      const sprite = new Sprite()
      sprite.eventMode = 'none'
      this.spriteBindings.push({} as NativeSecondarySpriteBinding)
      this.sprites.push(sprite)
      this.container.addChild(sprite)
    }
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]!
      const draw = this.plan.draws[index]
      sprite.visible = draw !== undefined
      if (draw) applyDraw(
        sprite,
        this.spriteBindings[index]!,
        draw,
        this.textures,
        this.plan.meshes.length + this.plan.quads.length + index,
      )
    }
    while (this.underlaySprites.length < this.plan.underlayDraws.length) {
      const sprite = new Sprite()
      sprite.eventMode = 'none'
      this.underlaySpriteBindings.push({} as NativeSecondarySpriteBinding)
      this.underlaySprites.push(sprite)
      this.underlayContainer?.addChild(sprite)
    }
    for (let index = 0; index < this.underlaySprites.length; index += 1) {
      const sprite = this.underlaySprites[index]!
      const draw = this.plan.underlayDraws[index]
      sprite.visible = draw !== undefined
      if (draw) applyDraw(
        sprite,
        this.underlaySpriteBindings[index]!,
        draw,
        this.textures,
        index,
      )
    }
  }

  private updateHotDropPrimitives(): void {
    const gradient = this.plan.gradients[0]
    if (!gradient) {
      if (this.gradientMeshes.length > 0) this.removeGradient()
    } else {
      if (this.gradientMeshes.length === 0) this.addGradient(gradient)
      applyGradient(
        this.gradientMeshes[0]!,
        this.gradientVertices[0]!,
        gradient,
      )
      const mesh = this.gradientMeshes[0]!
      mesh.position.set(this.plan.root.x, this.plan.root.y)
    }

    const draw = this.plan.draws[0]
    let sprite = this.sprites[0]
    if (!draw) {
      if (sprite) sprite.visible = false
      return
    }
    if (!sprite) {
      sprite = new Sprite()
      sprite.eventMode = 'none'
      sprite.renderable = this.renderable
      this.spriteBindings.push({} as NativeSecondarySpriteBinding)
      this.sprites.push(sprite)
      this.primitiveParent.addChild(sprite)
    }
    sprite.visible = true
    applyDraw(
      sprite,
      this.spriteBindings[0]!,
      draw,
      this.textures,
      0,
    )
    sprite.position.set(
      this.plan.root.x + draw.offset.x,
      this.plan.root.y + draw.offset.y,
    )
  }

  painterLayer(id: number, sourceOrder: number): NativeSecondaryPainterLayer {
    const layer = this.worldPainterLayer ??= {
      id: `secondary:${id}`,
      lane: 'world-sorted',
      queueFamily: this.plan.queueFamily,
      regionLightPoint: this.regionLightPoint,
      registration: nativeWorldPainterRegistration(this.state),
      sortBias: this.plan.sortBias,
      sourceOrder,
      worldY: this.plan.worldY,
    }
    layer.queueFamily = this.plan.queueFamily
    layer.regionLightPoint = this.regionLightPoint
    layer.registration = nativeWorldPainterRegistration(this.state)
    layer.sortBias = this.plan.sortBias
    layer.sourceOrder = sourceOrder
    layer.worldY = this.plan.worldY
    return layer
  }

  painterLayers(id: number, sourceOrder: number): NativeSecondaryPainterLayer[] {
    const layers = this.cachedPainterLayers
    layers.length = 0
    if (this.plan.underlayDraws.length > 0) {
      const layer = this.underlayPainterLayer ??= {
        id: `secondary-underlay:${id}`,
        lane: 'pre-world-queue',
        queueFamily: null,
        regionLightPoint: null,
        registration: null,
        sortBias: 0,
        sourceOrder,
        worldY: this.plan.root.y,
      }
      layer.sourceOrder = sourceOrder
      layer.worldY = this.plan.root.y
      layers.push(layer)
    }
    const proxyOwner = this.currentKind === 'acid-rain'
      || this.currentKind === 'storm-cloud'
    if (this.plan.draws.length === 0 && this.currentKind === 'acid-rain') return layers
    if (!proxyOwner) {
      layers.push(this.painterLayer(id, sourceOrder + layers.length))
      return layers
    }
    const insertion = this.proxyPainterInsertion ??= {
      id: `secondary:${id}`,
      sortBias: this.plan.sortBias,
      visible: true,
      worldY: this.plan.worldY,
    }
    insertion.sortBias = this.plan.sortBias
    insertion.worldY = this.plan.worldY
    const layer = this.proxyPainterLayer ??= {
      id: `secondary-owner:${id}`,
      insertions: Object.freeze([insertion]),
      lane: 'world-sorted',
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: this.regionLightPoint,
      registration: nativeWorldPainterRegistration(this.state),
      sortBias: 0,
      sourceOrder: sourceOrder + layers.length,
      visible: false,
      worldY: this.state.position.y,
    }
    layer.regionLightPoint = this.regionLightPoint
    layer.registration = nativeWorldPainterRegistration(this.state)
    layer.sourceOrder = sourceOrder + layers.length
    layer.worldY = this.state.position.y
    layers.push(layer)
    return layers
  }

  diagnosticSample(
    id: number,
    compositeOwnerId: number,
  ): NativeSecondaryDiagnosticSample {
    return {
      compositeOwnerId,
      depth: this.depth,
      id,
      kind: this.currentKind,
      mainDrawMembers: this.plan.draws.map(({ atlas, blend, entry }) => (
        `${atlas}:${entry}:${blend}`
      )),
      mainDrawOffsetsY: this.plan.draws.map(({ offset }) => offset.y),
      meshVertexColors: this.plan.meshes.map(({ vertexColors }) => vertexColors),
      leviathanCompositePlan: null,
      primitiveCount: this.primitiveCount,
      sortBias: this.plan.sortBias,
      underlayDepth: this.plan.underlayDraws.length > 0
        ? this.underlayContainer?.zIndex ?? null
        : null,
      underlayDrawMembers: this.plan.underlayDraws.map(({ atlas, blend, entry }) => (
        `${atlas}:${entry}:${blend}`
      )),
      underlayPrimitiveCount: this.plan.underlayDraws.length,
      worldX: this.plan.root.x,
      worldY: this.plan.worldY,
    }
  }

  setDepth(depth: number): void {
    this.depth = depth
    if (!this.directPrimitives) {
      this.container.zIndex = depth
      return
    }
    for (const mesh of this.gradientMeshes) mesh.zIndex = depth
    for (const sprite of this.sprites) sprite.zIndex = depth
  }

  setUnderlayDepth(depth: number): void {
    if (this.underlayContainer) this.underlayContainer.zIndex = depth
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  setRenderable(renderable: boolean): void {
    this.renderable = renderable
    this.container.renderable = renderable
    if (this.underlayContainer) this.underlayContainer.renderable = renderable
    if (!this.directPrimitives) return
    for (const mesh of this.gradientMeshes) mesh.renderable = renderable
    for (const sprite of this.sprites) sprite.renderable = renderable
  }

  get kind(): NativeSecondaryActorState['kind'] {
    return this.currentKind
  }

  get leviathanScale(): number {
    return this.state.scale
  }

  get usesDirectPrimitives(): boolean {
    return this.directPrimitives
  }

  get primitiveCount(): number {
    return this.plan.draws.length
      + this.plan.gradients.length
      + this.plan.meshes.length
      + this.plan.quads.length
      + this.plan.underlayDraws.length
      + Number(this.plan.stormComposite !== null)
      + Number(this.stormLightning !== null)
  }

  get sampledPointGain(): number {
    return this.birthPointGain
  }

  destroy(): void {
    if (this.stormWeather) {
      this.container.removeChild(this.stormWeather.composite)
      this.stormWeather.destroy()
      this.stormWeather = null
    }
    if (this.stormLightning) {
      for (const container of this.stormLightning.containers) {
        container.removeFromParent()
      }
      this.stormLightning.destroy()
    }
    if (this.directPrimitives) {
      for (const mesh of this.gradientMeshes) {
        mesh.parent?.removeChild(mesh)
        mesh.destroy()
      }
      for (const sprite of this.sprites) {
        sprite.parent?.removeChild(sprite)
        sprite.destroy()
      }
    }
    this.container.destroy({ children: true })
    this.underlayContainer?.destroy({ children: true })
    this.gradientMeshes.length = 0
    this.gradientVertices.length = 0
    this.cachedPainterLayers.length = 0
    this.meshIndices.length = 0
    this.meshMeshes.length = 0
    this.meshUvs.length = 0
    this.meshVertexColors.length = 0
    this.meshVertices.length = 0
    this.quadMeshes.length = 0
    this.quadVertices.length = 0
    this.spriteBindings.length = 0
    this.sprites.length = 0
    this.underlaySpriteBindings.length = 0
    this.underlaySprites.length = 0
  }

  private addQuadMesh(): void {
    const vertices = new Float32Array(8)
    const texture = this.textures[nativeSecondarySpriteKey('BadGuys', 36)]
    if (!texture) throw new Error('Native secondary assembly beam texture was not loaded')
    const mesh = new MeshSimple({
      indices: QUAD_INDICES,
      texture,
      topology: 'triangle-list',
      uvs: QUAD_UVS,
      vertices,
    })
    mesh.eventMode = 'none'
    mesh.renderable = this.renderable
    this.quadMeshes.push(mesh)
    this.quadVertices.push(vertices)
    this.container.addChild(mesh)
  }

  private addMesh(draw: NativeSecondaryMeshDraw): void {
    const indices = new Uint32Array(draw.indices)
    const uvs = new Float32Array(draw.uvs)
    const vertexColors = new Uint32Array(draw.vertexColors)
    const vertices = new Float32Array(draw.vertices)
    const mesh = new MeshSimple({
      indices,
      texture: this.specialTextures.etherPlane,
      topology: 'triangle-list',
      uvs,
      vertices,
    })
    mesh.eventMode = 'none'
    setNativeArenaVertexColors(mesh, vertexColors)
    this.meshIndices.push(indices)
    this.meshMeshes.push(mesh)
    this.meshUvs.push(uvs)
    this.meshVertexColors.push(vertexColors)
    this.meshVertices.push(vertices)
    this.container.addChild(mesh)
  }

  private addGradient(draw: NativeSecondaryGradientDraw): void {
    const vertices = new Float32Array(8)
    const mesh = new MeshSimple({
      indices: QUAD_INDICES,
      texture: Texture.WHITE,
      topology: 'triangle-list',
      uvs: QUAD_UVS,
      vertices,
    })
    mesh.eventMode = 'none'
    mesh.renderable = this.renderable
    setNativeArenaVertexColors(mesh, new Uint32Array([
      nativeArenaPackedColor(draw.topColor, draw.topAlpha),
      nativeArenaPackedColor(draw.topColor, draw.topAlpha),
      nativeArenaPackedColor(draw.bottomColor, draw.bottomAlpha),
      nativeArenaPackedColor(draw.bottomColor, draw.bottomAlpha),
    ]))
    this.gradientMeshes.push(mesh)
    this.gradientVertices.push(vertices)
    this.primitiveParent.addChild(mesh)
  }

  private removeGradient(): void {
    const mesh = this.gradientMeshes.pop()!
    this.gradientVertices.pop()
    mesh.parent?.removeChild(mesh)
    mesh.destroy()
  }

  private removeMesh(): void {
    const mesh = this.meshMeshes.pop()!
    this.meshIndices.pop()
    this.meshUvs.pop()
    this.meshVertexColors.pop()
    this.meshVertices.pop()
    this.container.removeChild(mesh)
    mesh.destroy()
  }

  private removeQuadMesh(): void {
    const mesh = this.quadMeshes.pop()!
    this.quadVertices.pop()
    this.container.removeChild(mesh)
    mesh.destroy()
  }
}

class NativeStormWeatherView {
  readonly composite: Sprite
  private readonly renderTexture: RenderTexture
  private readonly source = new Container({ label: 'storm-weather-render-target-source' })
  private readonly sourceSpriteBindings: NativeSecondarySpriteBinding[] = []
  private readonly sourceSprites: Sprite[] = []
  private readonly textures: PlayerWorldTextures['secondary']

  constructor(textures: PlayerWorldTextures['secondary']) {
    this.textures = textures
    this.source.eventMode = 'none'
    this.source.sortableChildren = true
    this.renderTexture = RenderTexture.create({
      alphaMode: 'no-premultiply-alpha',
      dynamic: true,
      height: STORM_RENDER_TARGET_SIZE,
      resolution: 1,
      scaleMode: 'linear',
      width: STORM_RENDER_TARGET_SIZE,
    })
    this.composite = new Sprite(this.renderTexture)
    this.composite.anchor.set(0.5)
    this.composite.eventMode = 'none'
    this.composite.label = 'storm-weather-render-target-composite'
    this.composite.zIndex = -1
  }

  update(plan: NativeStormWeatherComposite, renderer: Renderer): void {
    while (this.sourceSprites.length < plan.draws.length) {
      const sprite = new Sprite()
      sprite.eventMode = 'none'
      this.sourceSpriteBindings.push({} as NativeSecondarySpriteBinding)
      this.sourceSprites.push(sprite)
      this.source.addChild(sprite)
    }
    for (let index = 0; index < this.sourceSprites.length; index += 1) {
      const sprite = this.sourceSprites[index]!
      const draw = plan.draws[index]
      sprite.visible = draw !== undefined
      if (!draw) continue
      applyDraw(
        sprite,
        this.sourceSpriteBindings[index]!,
        draw,
        this.textures,
        index,
      )
      sprite.position.set(
        STORM_RENDER_TARGET_SIZE / 2 + draw.offset.x,
        STORM_RENDER_TARGET_SIZE / 2 + draw.offset.y,
      )
    }
    renderer.render({
      clear: true,
      clearColor: [0, 0, 0, 0],
      container: this.source,
      target: this.renderTexture,
    })
    this.composite.position.set(plan.offset.x, plan.offset.y)
    this.composite.scale.set(plan.scale)
  }

  destroy(): void {
    this.source.destroy({ children: true })
    this.composite.destroy()
    this.renderTexture.destroy(true)
    this.sourceSpriteBindings.length = 0
    this.sourceSprites.length = 0
  }
}

class NativeLeviathanCompositeView {
  readonly container = new Container({ label: 'leviathan-render-target-owner' })
  readonly memberIds = new Set<number>()
  private readonly appendageSource = new Container({ label: 'leviathan-appendage-target-source' })
  private readonly clear: Sprite
  private readonly compositeGlow: Sprite
  private readonly compositeNormal: Sprite
  private readonly mask: Sprite
  private readonly maskClip: Sprite
  private readonly memberViews = new Map<number, NativeSecondaryActorView>()
  private plan = nativeLeviathanCompositePlan(0)
  private readonly renderTexture: RenderTexture
  private readonly source = new Container({ label: 'leviathan-render-target-source' })

  constructor(textures: PlayerWorldTextures) {
    this.container.eventMode = 'none'
    this.container.sortableChildren = true
    this.source.eventMode = 'none'
    this.source.sortableChildren = true
    this.appendageSource.eventMode = 'none'
    this.appendageSource.sortableChildren = true
    this.renderTexture = RenderTexture.create({
      alphaMode: 'no-premultiply-alpha',
      dynamic: true,
      height: NATIVE_LEVIATHAN_RENDER_TARGET_SIZE,
      resolution: 1,
      scaleMode: 'linear',
      width: NATIVE_LEVIATHAN_RENDER_TARGET_SIZE,
    })
    this.compositeNormal = new Sprite(this.renderTexture)
    this.compositeNormal.anchor.set(0.5)
    this.compositeNormal.eventMode = 'none'
    this.compositeNormal.label = 'leviathan-render-target-composite-normal'
    this.compositeNormal.zIndex = 1
    this.compositeGlow = new Sprite(this.renderTexture)
    this.compositeGlow.alpha = 0.5
    this.compositeGlow.anchor.set(0.5)
    this.compositeGlow.blendMode = 'add'
    this.compositeGlow.eventMode = 'none'
    this.compositeGlow.label = 'leviathan-render-target-composite-add'
    this.compositeGlow.zIndex = 2

    const maskRecord = nativeSecondarySpriteRecord('BadGuys', 39)
    const maskTexture = textures.secondary[nativeSecondarySpriteKey('BadGuys', 39)]
    if (!maskTexture) throw new Error('Native Leviathan mask texture was not loaded')
    this.mask = new Sprite(maskTexture)
    this.mask.anchor.set(
      maskRecord.anchorX / maskRecord.width,
      maskRecord.anchorY / maskRecord.height,
    )
    this.mask.blendMode = 'multiply'
    this.mask.eventMode = 'none'
    this.mask.label = 'leviathan-appendage-lower-mask'
    this.mask.position.set(
      NATIVE_LEVIATHAN_RENDER_TARGET_SIZE / 2,
      NATIVE_LEVIATHAN_RENDER_TARGET_SIZE / 2,
    )
    this.mask.zIndex = 1
    this.maskClip = new Sprite(Texture.WHITE)
    this.maskClip.eventMode = 'none'
    this.maskClip.label = 'leviathan-appendage-mask-clip'
    this.mask.mask = this.maskClip
    this.clear = new Sprite(Texture.WHITE)
    this.clear.blendMode = 'multiply'
    this.clear.eventMode = 'none'
    this.clear.label = 'leviathan-appendage-lower-clear'
    this.clear.tint = 0x000000
    this.clear.zIndex = 2
    this.source.addChild(this.appendageSource, this.mask, this.maskClip, this.clear)
    this.container.addChild(this.compositeNormal, this.compositeGlow)
  }

  update(
    parent: NativeSecondaryActorView,
    members: readonly Readonly<{ id: number; view: NativeSecondaryActorView }>[],
    renderer: Renderer,
    root: Container,
  ): void {
    this.releaseMembers(root)
    const parentSample = parent.diagnosticSample(0, 0)
    this.container.position.set(parentSample.worldX, parentSample.worldY)
    for (const { id, view } of members) {
      this.memberIds.add(id)
      this.memberViews.set(id, view)
      if (view === parent) {
        view.container.position.set(0, 0)
        view.container.zIndex = 0
        this.container.addChild(view.container)
        continue
      }
      const layer = view.painterLayer(id, id)
      view.container.zIndex = layer.worldY + layer.sortBias
      this.appendageSource.addChild(view.container)
    }
    this.appendageSource.position.set(
      NATIVE_LEVIATHAN_RENDER_TARGET_SIZE / 2 - parentSample.worldX,
      NATIVE_LEVIATHAN_RENDER_TARGET_SIZE / 2 - parentSample.worldY,
    )
    const plan = nativeLeviathanCompositePlan(parent.leviathanScale)
    this.plan = plan
    this.mask.blendMode = plan.mask.blend
    this.mask.scale.set(plan.mask.scale)
    this.maskClip.position.set(0, plan.mask.clipTop)
    this.maskClip.width = plan.clear.height
    this.maskClip.height = plan.clear.height
    this.clear.blendMode = plan.clear.blend
    this.clear.position.set(plan.clear.x, plan.clear.y)
    this.clear.tint = plan.clear.color
    this.clear.width = plan.clear.width
    this.clear.height = plan.clear.height
    this.compositeNormal.alpha = plan.outputs[0]!.alpha
    this.compositeNormal.blendMode = plan.outputs[0]!.blend
    this.compositeGlow.alpha = plan.outputs[1]!.alpha
    this.compositeGlow.blendMode = plan.outputs[1]!.blend
    renderer.render({
      clear: true,
      clearColor: [0, 0, 0, 0],
      container: this.source,
      target: this.renderTexture,
    })
  }

  releaseMembers(root: Container): void {
    for (const view of this.memberViews.values()) {
      const sample = view.diagnosticSample(0, 0)
      view.container.position.set(sample.worldX, sample.worldY)
      root.addChild(view.container)
    }
    this.memberViews.clear()
    this.memberIds.clear()
  }

  forgetMember(id: number): void {
    this.memberIds.delete(id)
    this.memberViews.delete(id)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  get diagnosticPlan(): NativeLeviathanCompositePlan {
    return this.plan
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  destroy(): void {
    this.source.destroy({ children: true })
    this.container.destroy({ children: true })
    this.renderTexture.destroy(true)
    this.memberIds.clear()
    this.memberViews.clear()
  }
}

function applyGradient(
  mesh: MeshSimple,
  vertices: Float32Array,
  draw: NativeSecondaryGradientDraw,
): void {
  const left = draw.topLeft.x
  const top = draw.topLeft.y
  const right = left + draw.width
  const bottom = top + draw.height
  vertices[0] = left
  vertices[1] = top
  vertices[2] = right
  vertices[3] = top
  vertices[4] = left
  vertices[5] = bottom
  vertices[6] = right
  vertices[7] = bottom
  if (mesh.label !== draw.role) mesh.label = draw.role
}

export class NativeSecondaryWorldView {
  private readonly cachedDiagnosticSamples: NativeSecondaryDiagnosticSample[] = []
  private readonly cachedKinds: NativeSecondaryActorState['kind'][] = []
  private readonly cachedPainterLayers: NativeSecondaryPainterLayer[] = []
  private readonly compositeOwnerByActorId = new Map<number, number>()
  private readonly diagnosticViewIds = new Set<number>()
  private readonly kindCounts = new Map<NativeSecondaryActorState['kind'], number>()
  private readonly liveIds = new Set<number>()
  private readonly leviathanComposites = new Map<number, NativeLeviathanCompositeView>()
  private readonly root: Container
  private readonly preWorldRoot: Container
  private readonly renderer: Renderer
  private readonly textures: PlayerWorldTextures
  private readonly views = new Map<number, NativeSecondaryActorView>()
  private totalPrimitiveCount = 0

  constructor(
    root: Container,
    textures: PlayerWorldTextures,
    renderer: Renderer,
    options: { readonly preWorldRoot?: Container } = {},
  ) {
    this.root = root
    this.preWorldRoot = options.preWorldRoot ?? root
    this.textures = textures
    this.renderer = renderer
  }

  update(
    state: Pick<NativeSecondarySimulationState, 'actors'>,
    worldKey: string,
    presentationFrame?: number,
    pointGainAt: (position: Readonly<{ x: number, y: number }>) => number = () => 1,
  ): void {
    this.liveIds.clear()
    for (const actor of state.actors) {
      if (actor.worldKey !== worldKey) continue
      if (actor.kind === 'earthquake-scenery-wobble') continue
      this.liveIds.add(actor.id)
      let view = this.views.get(actor.id)
      if (!view) {
        const birthPointGain = actor.kind === 'ring-fire-explosion'
          ? pointGainAt(actor.position)
          : 1
        view = new NativeSecondaryActorView(
          actor,
          this.textures,
          this.renderer,
          this.root,
          birthPointGain,
        )
        this.views.set(actor.id, view)
        this.addKind(view.kind)
        if (DIAGNOSTIC_ACTOR_KINDS.has(view.kind)) this.diagnosticViewIds.add(actor.id)
        this.totalPrimitiveCount += view.primitiveCount
        if (view.underlayContainer) this.preWorldRoot.addChild(view.underlayContainer)
        if (!view.usesDirectPrimitives) this.root.addChild(view.container)
      }
      const previousKind = view.kind
      const previousPrimitiveCount = view.primitiveCount
      view.update(actor, presentationFrame)
      this.totalPrimitiveCount += view.primitiveCount - previousPrimitiveCount
      if (view.kind !== previousKind) {
        this.removeKind(previousKind)
        this.addKind(view.kind)
        if (DIAGNOSTIC_ACTOR_KINDS.has(view.kind)) this.diagnosticViewIds.add(actor.id)
        else this.diagnosticViewIds.delete(actor.id)
      }
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      if (view.underlayContainer) {
        view.underlayContainer.parent?.removeChild(view.underlayContainer)
      }
      view.container.parent?.removeChild(view.container)
      this.diagnosticViewIds.delete(id)
      this.removeKind(view.kind)
      this.totalPrimitiveCount -= view.primitiveCount
      this.compositeForMember(id)?.forgetMember(id)
      view.destroy()
      this.views.delete(id)
    }
    this.compositeOwnerByActorId.clear()
    for (const [actorId, parentId] of nativeSecondaryCompositeOwnerEntries(
      state.actors,
      worldKey,
    )) {
      if (this.views.has(parentId)) this.compositeOwnerByActorId.set(actorId, parentId)
    }
    this.syncLeviathanComposites()
    const painterLayers = this.cachedPainterLayers
    painterLayers.length = 0
    for (const [id, view] of this.views) {
      if (this.compositeOwnerByActorId.has(id)) continue
      painterLayers.push(...view.painterLayers(id, painterLayers.length))
    }
    for (const layer of painterLayers) {
      this.setDepth(
        layer.id,
        layer.lane === 'pre-world-queue'
          ? 0.5
          : hubWorldDepthForActor(layer.worldY + layer.sortBias),
      )
    }
  }

  fireExplosionPointGain(id: number): number | undefined {
    const view = this.views.get(id)
    return view?.kind === 'ring-fire-explosion'
      ? view.sampledPointGain
      : undefined
  }

  painterLayers(): readonly NativeSecondaryPainterLayer[] {
    return this.cachedPainterLayers
  }

  setDepth(id: string, depth: number): void {
    if (id.startsWith('secondary-underlay:')) {
      const requestedId = Number(id.slice('secondary-underlay:'.length))
      this.views.get(requestedId)?.setUnderlayDepth(depth)
      return
    }
    const requestedId = Number(id.slice('secondary:'.length))
    const ownerId = this.compositeOwnerByActorId.get(requestedId) ?? requestedId
    const composite = this.leviathanComposites.get(ownerId)
    if (composite) composite.setDepth(depth)
    else this.views.get(ownerId)?.setDepth(depth)
  }

  setTint(id: string, tint: number): void {
    if (id.startsWith('secondary-underlay:')) return
    const requestedId = Number(id.slice('secondary:'.length))
    const ownerId = this.compositeOwnerByActorId.get(requestedId) ?? requestedId
    const composite = this.leviathanComposites.get(ownerId)
    if (composite) composite.setTint(tint)
    else this.views.get(ownerId)?.setTint(tint)
  }

  setRenderable(renderable: boolean): void {
    for (const composite of this.leviathanComposites.values()) {
      composite.setRenderable(renderable)
    }
    for (const [id, view] of this.views) {
      view.setRenderable(this.compositeForMember(id) ? true : renderable)
    }
  }

  get count(): number {
    return this.views.size
  }

  get kinds(): readonly NativeSecondaryActorState['kind'][] {
    return this.cachedKinds
  }

  get primitiveCount(): number {
    return this.totalPrimitiveCount
  }

  get diagnosticSamples(): readonly NativeSecondaryDiagnosticSample[] {
    const samples = this.cachedDiagnosticSamples
    samples.length = 0
    for (const id of this.diagnosticViewIds) {
      const view = this.views.get(id)
      if (!view) continue
      const ownerId = this.compositeOwnerByActorId.get(id) ?? id
      const sample = view.diagnosticSample(id, ownerId)
      const composite = this.leviathanComposites.get(ownerId)
      samples.push(composite ? {
        ...sample,
        depth: composite.container.zIndex,
        leviathanCompositePlan: composite.diagnosticPlan,
      } : sample)
    }
    return samples
  }

  destroy(): void {
    for (const composite of this.leviathanComposites.values()) {
      composite.releaseMembers(this.root)
      this.root.removeChild(composite.container)
      composite.destroy()
    }
    this.leviathanComposites.clear()
    for (const view of this.views.values()) {
      if (view.underlayContainer) {
        view.underlayContainer.parent?.removeChild(view.underlayContainer)
      }
      view.container.parent?.removeChild(view.container)
      view.destroy()
    }
    this.views.clear()
    this.cachedDiagnosticSamples.length = 0
    this.cachedKinds.length = 0
    this.cachedPainterLayers.length = 0
    this.compositeOwnerByActorId.clear()
    this.diagnosticViewIds.clear()
    this.kindCounts.clear()
    this.liveIds.clear()
    this.totalPrimitiveCount = 0
  }

  private addKind(kind: NativeSecondaryActorState['kind']): void {
    const count = this.kindCounts.get(kind) ?? 0
    this.kindCounts.set(kind, count + 1)
    if (count > 0) return
    this.cachedKinds.push(kind)
    this.cachedKinds.sort()
  }

  private removeKind(kind: NativeSecondaryActorState['kind']): void {
    const count = this.kindCounts.get(kind)!
    if (count > 1) {
      this.kindCounts.set(kind, count - 1)
      return
    }
    this.kindCounts.delete(kind)
    const index = this.cachedKinds.indexOf(kind)
    if (index >= 0) this.cachedKinds.splice(index, 1)
  }

  private compositeForMember(id: number): NativeLeviathanCompositeView | null {
    for (const composite of this.leviathanComposites.values()) {
      if (composite.memberIds.has(id)) return composite
    }
    return null
  }

  private syncLeviathanComposites(): void {
    const childrenByParent = new Map<number, number[]>()
    for (const [actorId, parentId] of this.compositeOwnerByActorId) {
      const children = childrenByParent.get(parentId) ?? []
      children.push(actorId)
      childrenByParent.set(parentId, children)
    }
    for (const [parentId, composite] of this.leviathanComposites) {
      if (childrenByParent.has(parentId)) continue
      composite.releaseMembers(this.root)
      this.root.removeChild(composite.container)
      composite.destroy()
      this.leviathanComposites.delete(parentId)
    }
    for (const [parentId, childIds] of childrenByParent) {
      const parent = this.views.get(parentId)
      if (!parent) continue
      let composite = this.leviathanComposites.get(parentId)
      if (!composite) {
        composite = new NativeLeviathanCompositeView(this.textures)
        this.leviathanComposites.set(parentId, composite)
        this.root.addChild(composite.container)
      }
      const members = [parentId, ...childIds]
        .flatMap((id) => {
          const view = this.views.get(id)
          return view ? [{ id, view }] : []
        })
      composite.update(parent, members, this.renderer, this.root)
    }
  }
}

function stormStrikeTransient(
  actor: NativeSecondaryActorState,
): NativeAirLightningViewState {
  if (actor.kind !== 'storm-strike') {
    throw new TypeError('Storm lightning presentation requires a strike actor')
  }
  const endpoint = {
    x: actor.endpoint.x - actor.position.x,
    y: actor.endpoint.y - actor.position.y,
  }
  const midpoint = {
    x: actor.midpoint.x - actor.position.x,
    y: actor.midpoint.y - actor.position.y,
  }
  const length = Math.hypot(endpoint.x, endpoint.y)
  return {
    ageTicks: actor.ageTicks,
    birthTick: actor.phase,
    direction: length > 0
      ? { x: endpoint.x / length, y: endpoint.y / length }
      : { x: 1, y: 0 },
    endpoint,
    hurricaneCharge: 0,
    id: actor.id,
    kind: 'air',
    midpoint,
    origin: { x: 0, y: 0 },
    ownerId: actor.ownerId,
    targetId: actor.targetId === null ? null : String(actor.targetId),
    underpowered: false,
    variant: 0,
    worldKey: actor.worldKey,
  }
}

function applyDraw(
  sprite: Sprite,
  binding: NativeSecondarySpriteBinding,
  draw: NativeSecondarySpriteDraw,
  textures: PlayerWorldTextures['secondary'],
  sourceOrder: number,
): void {
  const sourceChanged = binding.atlas !== draw.atlas || binding.entry !== draw.entry
  if (sourceChanged) {
    const record = nativeSecondarySpriteRecord(draw.atlas, draw.entry)
    const texture = textures[nativeSecondarySpriteKey(draw.atlas, draw.entry)]
    if (!texture) {
      throw new Error(`Native secondary texture was not loaded: ${draw.atlas}:${draw.entry}`)
    }
    sprite.texture = texture
    sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
    binding.atlas = draw.atlas
    binding.entry = draw.entry
  }
  if (sourceChanged || binding.role !== draw.role) {
    sprite.label = `secondary:${draw.role}:${draw.atlas}:${draw.entry}`
    binding.role = draw.role
  }
  if (binding.colorMode !== draw.colorMode) {
    sprite.filters = draw.colorMode === 'alpha-mask' ? WHITE_ALPHA_MASK_FILTERS : null
    binding.colorMode = draw.colorMode
  }
  if (binding.alpha !== draw.alpha) {
    binding.alpha = draw.alpha
    sprite.alpha = draw.alpha
  }
  if (binding.blend !== draw.blend) {
    binding.blend = draw.blend
    sprite.blendMode = draw.blend
  }
  if (binding.offsetX !== draw.offset.x || binding.offsetY !== draw.offset.y) {
    binding.offsetX = draw.offset.x
    binding.offsetY = draw.offset.y
    sprite.position.set(draw.offset.x, draw.offset.y)
  }
  if (binding.rotationRadians !== draw.rotationRadians) {
    binding.rotationRadians = draw.rotationRadians
    sprite.rotation = draw.rotationRadians
  }
  if (binding.scaleX !== draw.scaleX || binding.scaleY !== draw.scaleY) {
    binding.scaleX = draw.scaleX
    binding.scaleY = draw.scaleY
    sprite.scale.set(draw.scaleX, draw.scaleY)
  }
  if (binding.tint !== draw.tint) {
    binding.tint = draw.tint
    sprite.tint = draw.tint
  }
  if (binding.sourceOrder !== sourceOrder) {
    binding.sourceOrder = sourceOrder
    sprite.zIndex = sourceOrder
  }
}

function applyQuad(
  mesh: MeshSimple,
  vertices: Float32Array,
  draw: NativeSecondaryQuadDraw,
  textures: PlayerWorldTextures['secondary'],
  sourceOrder: number,
): void {
  const texture = draw.atlas === null || draw.entry === null
    ? Texture.WHITE
    : textures[nativeSecondarySpriteKey(draw.atlas, draw.entry)]
  if (!texture) throw new Error(`Native secondary texture was not loaded: ${draw.atlas}:${draw.entry}`)
  vertices.set(draw.vertices)
  mesh.label = `secondary:${draw.role}:${draw.atlas}:${draw.entry}`
  mesh.texture = texture
  mesh.alpha = draw.alpha
  mesh.blendMode = draw.blend
  mesh.tint = draw.tint
  mesh.zIndex = sourceOrder
}

function applyMesh(
  mesh: MeshSimple,
  vertices: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
  vertexColors: Uint32Array,
  draw: NativeSecondaryMeshDraw,
  textures: PlayerWorldTextures['secondarySpecial'],
  sourceOrder: number,
): void {
  vertices.set(draw.vertices)
  uvs.set(draw.uvs)
  indices.set(draw.indices)
  vertexColors.set(draw.vertexColors)
  mesh.label = `secondary:${draw.role}:${draw.texture}`
  mesh.texture = textures.etherPlane
  mesh.alpha = draw.alpha
  mesh.blendMode = draw.blend
  mesh.tint = draw.tint
  mesh.zIndex = sourceOrder
}
