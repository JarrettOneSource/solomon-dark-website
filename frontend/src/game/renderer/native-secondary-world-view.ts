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
  nativeSecondaryPresentationPlan,
  nativeSecondaryCompositeOwnerEntries,
  type NativeSecondaryGradientDraw,
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
const LEVIATHAN_RENDER_TARGET_SIZE = 256
const DIAGNOSTIC_ACTOR_KINDS = new Set<NativeSecondaryActorState['kind']>([
  'acid-rain',
  'dampen-wave',
  'dampened-projectile',
  'freeze-wave-visual',
  'golem',
  'leviathan',
  'leviathan-appendage',
  'storm-cloud',
])

const WHITE_ALPHA_MASK_FILTER = new ColorMatrixFilter()
WHITE_ALPHA_MASK_FILTER.matrix = [
  0, 0, 0, 0, 1,
  0, 0, 0, 0, 1,
  0, 0, 0, 0, 1,
  0, 0, 0, 1, 0,
]

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

export interface NativeSecondaryDiagnosticSample {
  readonly compositeOwnerId: number
  readonly depth: number
  readonly id: number
  readonly kind: NativeSecondaryActorState['kind']
  readonly mainDrawMembers: readonly string[]
  readonly mainDrawOffsetsY: readonly number[]
  readonly primitiveCount: number
  readonly sortBias: number
  readonly underlayDepth: number | null
  readonly underlayDrawMembers: readonly string[]
  readonly underlayPrimitiveCount: number
  readonly worldX: number
  readonly worldY: number
}

class NativeSecondaryActorView {
  readonly container = new Container({ label: 'native-secondary-actor' })
  readonly underlayContainer: Container | null
  private readonly birthPointGain: number
  private currentKind: NativeSecondaryActorState['kind']
  private plan: NativeSecondaryPresentationPlan
  private regionLightPoint: Readonly<{ x: number; y: number }> | null = null
  private readonly gradientMeshes: MeshSimple[] = []
  private readonly gradientVertices: Float32Array[] = []
  private readonly meshIndices: Uint32Array[] = []
  private readonly meshMeshes: MeshSimple[] = []
  private readonly meshUvs: Float32Array[] = []
  private readonly meshVertices: Float32Array[] = []
  private readonly quadMeshes: MeshSimple[] = []
  private readonly quadVertices: Float32Array[] = []
  private readonly renderer: Renderer
  private readonly sprites: Sprite[] = []
  private state: NativeSecondaryActorState
  private readonly stormLightning: AirPrimarySpellView | null
  private stormWeather: NativeStormWeatherView | null = null
  private readonly textures: PlayerWorldTextures['secondary']
  private readonly specialTextures: PlayerWorldTextures['secondarySpecial']
  private readonly underlaySprites: Sprite[] = []

  constructor(
    state: NativeSecondarySimulationState['actors'][number],
    textures: PlayerWorldTextures,
    renderer: Renderer,
    pointGain = 1,
  ) {
    this.state = state
    this.birthPointGain = pointGain
    this.currentKind = state.kind
    this.textures = textures.secondary
    this.specialTextures = textures.secondarySpecial
    this.renderer = renderer
    this.container.eventMode = 'none'
    this.container.sortableChildren = true
    this.plan = nativeSecondaryPresentationPlan(state, state.ageTicks, pointGain)
    this.underlayContainer = state.kind === 'acid-rain'
      ? new Container({ label: 'native-secondary-underlay' })
      : null
    if (this.underlayContainer) {
      this.underlayContainer.eventMode = 'none'
      this.underlayContainer.sortableChildren = true
    }
    this.stormLightning = state.kind === 'storm-strike'
      ? new AirPrimarySpellView(
          stormStrikeTransient(state),
          textures.primarySpells.air,
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
    pointGain = 1,
  ): void {
    this.state = state
    this.currentKind = state.kind
    this.plan = nativeSecondaryPresentationPlan(
      state,
      presentationFrame,
      state.kind === 'ring-fire-explosion' ? this.birthPointGain : pointGain,
    )
    this.regionLightPoint = state.kind === 'earthquake-debris'
      ? { ...state.position }
      : null
    this.container.label = `native-secondary:${state.kind}:${state.id}`
    this.container.position.set(this.plan.root.x, this.plan.root.y)
    if (this.underlayContainer) {
      this.underlayContainer.label = `native-secondary-underlay:${state.kind}:${state.id}`
      this.underlayContainer.position.set(this.plan.root.x, this.plan.root.y)
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
      this.sprites.push(sprite)
      this.container.addChild(sprite)
    }
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]!
      const draw = this.plan.draws[index]
      sprite.visible = draw !== undefined
      if (draw) applyDraw(
        sprite,
        draw,
        this.textures,
        this.plan.meshes.length + this.plan.quads.length + index,
      )
    }
    while (this.underlaySprites.length < this.plan.underlayDraws.length) {
      const sprite = new Sprite()
      sprite.eventMode = 'none'
      this.underlaySprites.push(sprite)
      this.underlayContainer?.addChild(sprite)
    }
    for (let index = 0; index < this.underlaySprites.length; index += 1) {
      const sprite = this.underlaySprites[index]!
      const draw = this.plan.underlayDraws[index]
      sprite.visible = draw !== undefined
      if (draw) applyDraw(sprite, draw, this.textures, index)
    }
  }

  painterLayer(id: number, sourceOrder: number): NativeSecondaryPainterLayer {
    return {
      id: `secondary:${id}`,
      lane: 'world-sorted',
      queueFamily: this.plan.queueFamily,
      regionLightPoint: this.regionLightPoint,
      registration: nativeWorldPainterRegistration(this.state),
      sortBias: this.plan.sortBias,
      sourceOrder,
      worldY: this.plan.worldY,
    }
  }

  painterLayers(id: number, sourceOrder: number): NativeSecondaryPainterLayer[] {
    const underlay = this.plan.underlayDraws.length > 0
      ? [{
        id: `secondary-underlay:${id}`,
        lane: 'pre-world-queue' as const,
        queueFamily: null,
        regionLightPoint: null,
        registration: null,
        sortBias: 0,
        sourceOrder,
        worldY: this.plan.root.y,
      }]
      : []
    const proxyOwner = this.currentKind === 'acid-rain'
      || this.currentKind === 'storm-cloud'
    const world = this.plan.draws.length > 0 || this.currentKind !== 'acid-rain'
      ? [proxyOwner
          ? {
              id: `secondary-owner:${id}`,
              insertions: Object.freeze([Object.freeze({
                id: `secondary:${id}`,
                sortBias: this.plan.sortBias,
                visible: true,
                worldY: this.plan.worldY,
              })]),
              lane: 'world-sorted' as const,
              queueFamily: 'ordinary-dynamic' as const,
              regionLightPoint: this.regionLightPoint,
              registration: nativeWorldPainterRegistration(this.state),
              sortBias: 0,
              sourceOrder: sourceOrder + underlay.length,
              visible: false,
              worldY: this.state.position.y,
            }
          : this.painterLayer(id, sourceOrder + underlay.length)]
      : []
    return [...underlay, ...world]
  }

  diagnosticSample(
    id: number,
    compositeOwnerId: number,
  ): NativeSecondaryDiagnosticSample {
    return {
      compositeOwnerId,
      depth: this.container.zIndex,
      id,
      kind: this.currentKind,
      mainDrawMembers: this.plan.draws.map(({ atlas, blend, entry }) => (
        `${atlas}:${entry}:${blend}`
      )),
      mainDrawOffsetsY: this.plan.draws.map(({ offset }) => offset.y),
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
    this.container.zIndex = depth
  }

  setUnderlayDepth(depth: number): void {
    if (this.underlayContainer) this.underlayContainer.zIndex = depth
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  get kind(): NativeSecondaryActorState['kind'] {
    return this.currentKind
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
    this.container.destroy({ children: true })
    this.underlayContainer?.destroy({ children: true })
    this.gradientMeshes.length = 0
    this.gradientVertices.length = 0
    this.meshIndices.length = 0
    this.meshMeshes.length = 0
    this.meshUvs.length = 0
    this.meshVertices.length = 0
    this.quadMeshes.length = 0
    this.quadVertices.length = 0
    this.sprites.length = 0
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
    this.quadMeshes.push(mesh)
    this.quadVertices.push(vertices)
    this.container.addChild(mesh)
  }

  private addMesh(draw: NativeSecondaryMeshDraw): void {
    const indices = new Uint32Array(draw.indices)
    const uvs = new Float32Array(draw.uvs)
    const vertices = new Float32Array(draw.vertices)
    const mesh = new MeshSimple({
      indices,
      texture: this.specialTextures.etherPlane,
      topology: 'triangle-list',
      uvs,
      vertices,
    })
    mesh.eventMode = 'none'
    this.meshIndices.push(indices)
    this.meshMeshes.push(mesh)
    this.meshUvs.push(uvs)
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
    setNativeArenaVertexColors(mesh, new Uint32Array([
      nativeArenaPackedColor(draw.topColor, draw.topAlpha),
      nativeArenaPackedColor(draw.topColor, draw.topAlpha),
      nativeArenaPackedColor(draw.bottomColor, draw.bottomAlpha),
      nativeArenaPackedColor(draw.bottomColor, draw.bottomAlpha),
    ]))
    this.gradientMeshes.push(mesh)
    this.gradientVertices.push(vertices)
    this.container.addChild(mesh)
  }

  private removeGradient(): void {
    const mesh = this.gradientMeshes.pop()!
    this.gradientVertices.pop()
    this.container.removeChild(mesh)
    mesh.destroy()
  }

  private removeMesh(): void {
    const mesh = this.meshMeshes.pop()!
    this.meshIndices.pop()
    this.meshUvs.pop()
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
      this.sourceSprites.push(sprite)
      this.source.addChild(sprite)
    }
    for (let index = 0; index < this.sourceSprites.length; index += 1) {
      const sprite = this.sourceSprites[index]!
      const draw = plan.draws[index]
      sprite.visible = draw !== undefined
      if (!draw) continue
      applyDraw(sprite, draw, this.textures, index)
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
    this.sourceSprites.length = 0
  }
}

class NativeLeviathanCompositeView {
  readonly container = new Container({ label: 'leviathan-render-target-owner' })
  readonly memberIds = new Set<number>()
  private readonly composite: Sprite
  private readonly renderTexture: RenderTexture
  private readonly source = new Container({ label: 'leviathan-render-target-source' })

  constructor() {
    this.container.eventMode = 'none'
    this.source.eventMode = 'none'
    this.source.sortableChildren = true
    this.renderTexture = RenderTexture.create({
      alphaMode: 'no-premultiply-alpha',
      dynamic: true,
      height: LEVIATHAN_RENDER_TARGET_SIZE,
      resolution: 1,
      scaleMode: 'linear',
      width: LEVIATHAN_RENDER_TARGET_SIZE,
    })
    this.composite = new Sprite(this.renderTexture)
    this.composite.anchor.set(0.5)
    this.composite.eventMode = 'none'
    this.composite.label = 'leviathan-render-target-composite'
    this.container.addChild(this.composite)
  }

  update(
    parent: NativeSecondaryActorView,
    members: readonly Readonly<{ id: number; view: NativeSecondaryActorView }>[],
    renderer: Renderer,
    root: Container,
  ): void {
    for (const child of [...this.source.children]) root.addChild(child)
    const parentSample = parent.diagnosticSample(0, 0)
    this.container.position.set(parentSample.worldX, parentSample.worldY)
    this.memberIds.clear()
    for (const { id, view } of members) {
      this.memberIds.add(id)
      const layer = view.painterLayer(id, id)
      view.container.zIndex = layer.worldY + layer.sortBias
      this.source.addChild(view.container)
    }
    this.source.position.set(
      LEVIATHAN_RENDER_TARGET_SIZE / 2 - parentSample.worldX,
      LEVIATHAN_RENDER_TARGET_SIZE / 2 - parentSample.worldY,
    )
    renderer.render({
      clear: true,
      clearColor: [0, 0, 0, 0],
      container: this.source,
      target: this.renderTexture,
    })
  }

  releaseMembers(root: Container): void {
    for (const child of [...this.source.children]) root.addChild(child)
    this.memberIds.clear()
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  destroy(): void {
    this.source.removeChildren()
    this.source.destroy()
    this.container.destroy({ children: true })
    this.renderTexture.destroy(true)
    this.memberIds.clear()
  }
}

function applyGradient(
  mesh: MeshSimple,
  vertices: Float32Array,
  draw: NativeSecondaryGradientDraw,
): void {
  vertices.set([
    draw.topLeft.x, draw.topLeft.y,
    draw.topLeft.x + draw.width, draw.topLeft.y,
    draw.topLeft.x, draw.topLeft.y + draw.height,
    draw.topLeft.x + draw.width, draw.topLeft.y + draw.height,
  ])
  mesh.label = draw.role
}

export class NativeSecondaryWorldView {
  private readonly compositeOwnerByActorId = new Map<number, number>()
  private readonly liveIds = new Set<number>()
  private readonly leviathanComposites = new Map<number, NativeLeviathanCompositeView>()
  private readonly root: Container
  private readonly preWorldRoot: Container
  private readonly renderer: Renderer
  private readonly textures: PlayerWorldTextures
  private readonly views = new Map<number, NativeSecondaryActorView>()

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
        view = new NativeSecondaryActorView(
          actor,
          this.textures,
          this.renderer,
          pointGainAt(actor.position),
        )
        this.views.set(actor.id, view)
        if (view.underlayContainer) this.preWorldRoot.addChild(view.underlayContainer)
        this.root.addChild(view.container)
      }
      view.update(actor, presentationFrame, pointGainAt(actor.position))
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      if (view.underlayContainer) {
        view.underlayContainer.parent?.removeChild(view.underlayContainer)
      }
      view.container.parent?.removeChild(view.container)
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
    for (const layer of this.painterLayers()) {
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

  painterLayers(): NativeSecondaryPainterLayer[] {
    const layers: NativeSecondaryPainterLayer[] = []
    for (const [id, view] of this.views) {
      if (this.compositeOwnerByActorId.has(id)) continue
      layers.push(...view.painterLayers(id, layers.length))
    }
    return layers
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
      view.container.renderable = this.compositeForMember(id) ? true : renderable
      if (view.underlayContainer) view.underlayContainer.renderable = renderable
    }
  }

  get count(): number {
    return this.views.size
  }

  get kinds(): readonly NativeSecondaryActorState['kind'][] {
    return [...new Set([...this.views.values()].map(({ kind }) => kind))].sort()
  }

  get primitiveCount(): number {
    let count = 0
    for (const view of this.views.values()) count += view.primitiveCount
    return count
  }

  get diagnosticSamples(): readonly NativeSecondaryDiagnosticSample[] {
    return [...this.views.entries()].flatMap(([id, view]) => {
      if (!DIAGNOSTIC_ACTOR_KINDS.has(view.kind)) return []
      const ownerId = this.compositeOwnerByActorId.get(id) ?? id
      const sample = view.diagnosticSample(id, ownerId)
      const composite = this.leviathanComposites.get(ownerId)
      return [composite ? { ...sample, depth: composite.container.zIndex } : sample]
    })
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
    this.compositeOwnerByActorId.clear()
    this.liveIds.clear()
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
        composite = new NativeLeviathanCompositeView()
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
  draw: NativeSecondarySpriteDraw,
  textures: PlayerWorldTextures['secondary'],
  sourceOrder: number,
): void {
  const record = nativeSecondarySpriteRecord(draw.atlas, draw.entry)
  const texture = textures[nativeSecondarySpriteKey(draw.atlas, draw.entry)]
  if (!texture) throw new Error(`Native secondary texture was not loaded: ${draw.atlas}:${draw.entry}`)
  sprite.label = `secondary:${draw.role}:${draw.atlas}:${draw.entry}`
  sprite.texture = texture
  sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
  sprite.alpha = draw.alpha
  sprite.blendMode = draw.blend
  sprite.filters = draw.colorMode === 'alpha-mask'
    ? [WHITE_ALPHA_MASK_FILTER]
    : null
  sprite.position.set(draw.offset.x, draw.offset.y)
  sprite.rotation = draw.rotationRadians
  sprite.scale.set(draw.scaleX, draw.scaleY)
  sprite.tint = draw.tint
  sprite.zIndex = sourceOrder
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
  draw: NativeSecondaryMeshDraw,
  textures: PlayerWorldTextures['secondarySpecial'],
  sourceOrder: number,
): void {
  vertices.set(draw.vertices)
  uvs.set(draw.uvs)
  indices.set(draw.indices)
  mesh.label = `secondary:${draw.role}:${draw.texture}`
  mesh.texture = textures.etherPlane
  mesh.alpha = draw.alpha
  mesh.blendMode = draw.blend
  mesh.tint = draw.tint
  mesh.zIndex = sourceOrder
}
