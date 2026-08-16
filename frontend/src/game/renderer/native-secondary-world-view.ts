import {
  ColorMatrixFilter,
  Container,
  FillGradient,
  Graphics,
  MeshSimple,
  RenderTexture,
  Sprite,
  type Renderer,
} from 'pixi.js'

import type {
  NativeSecondaryActorState,
  NativeSecondarySimulationState,
} from '../core-kernels/native-secondary-abilities.ts'
import type { PrimarySpellAirTransientState } from '../core-kernels/primary-spells.ts'
import { hubWorldDepthForActor } from './hub-render-contract.ts'
import { AirPrimarySpellView } from './primary-spell-air-view.ts'
import {
  nativeSecondarySpriteKey,
  nativeSecondarySpriteRecord,
} from './native-secondary-assets.ts'
import {
  nativeSecondaryPresentationPlan,
  type NativeSecondaryGradientDraw,
  type NativeSecondaryMeshDraw,
  type NativeSecondaryPresentationPlan,
  type NativeSecondaryQuadDraw,
  type NativeSecondarySpriteDraw,
  type NativeStormWeatherComposite,
} from './native-secondary-presentation.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const QUAD_UVS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
const QUAD_INDICES = new Uint32Array([0, 1, 2, 1, 2, 3])
const STORM_RENDER_TARGET_SIZE = 256
const WHITE_ALPHA_MASK_FILTER = new ColorMatrixFilter()
WHITE_ALPHA_MASK_FILTER.matrix = [
  0, 0, 0, 0, 1,
  0, 0, 0, 0, 1,
  0, 0, 0, 0, 1,
  0, 0, 0, 1, 0,
]

export interface NativeSecondaryPainterLayer {
  readonly id: string
  readonly lane: 'world-sorted'
  readonly queueFamily: 'ordinary-dynamic' | 'zanim'
  readonly regionLightPoint: Readonly<{ x: number; y: number }> | null
  readonly sortBias: number
  readonly sourceOrder: number
  readonly worldY: number
}

class NativeSecondaryActorView {
  readonly container = new Container({ label: 'native-secondary-actor' })
  private currentKind: NativeSecondaryActorState['kind']
  private plan: NativeSecondaryPresentationPlan
  private regionLightPoint: Readonly<{ x: number; y: number }> | null = null
  private readonly gradientFills: FillGradient[] = []
  private readonly gradients: Graphics[] = []
  private readonly meshIndices: Uint32Array[] = []
  private readonly meshMeshes: MeshSimple[] = []
  private readonly meshUvs: Float32Array[] = []
  private readonly meshVertices: Float32Array[] = []
  private readonly quadMeshes: MeshSimple[] = []
  private readonly quadVertices: Float32Array[] = []
  private readonly renderer: Renderer
  private readonly sprites: Sprite[] = []
  private readonly stormLightning: AirPrimarySpellView | null
  private stormWeather: NativeStormWeatherView | null = null
  private readonly textures: PlayerWorldTextures['secondary']
  private readonly specialTextures: PlayerWorldTextures['secondarySpecial']

  constructor(
    state: NativeSecondarySimulationState['actors'][number],
    textures: PlayerWorldTextures,
    renderer: Renderer,
  ) {
    this.currentKind = state.kind
    this.textures = textures.secondary
    this.specialTextures = textures.secondarySpecial
    this.renderer = renderer
    this.container.eventMode = 'none'
    this.container.sortableChildren = true
    this.plan = nativeSecondaryPresentationPlan(state)
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

  update(state: NativeSecondarySimulationState['actors'][number], presentationFrame = state.ageTicks): void {
    this.currentKind = state.kind
    this.plan = nativeSecondaryPresentationPlan(state, presentationFrame)
    this.regionLightPoint = state.kind === 'earthquake-debris'
      ? { ...state.position }
      : null
    this.container.label = `native-secondary:${state.kind}:${state.id}`
    this.container.position.set(this.plan.root.x, this.plan.root.y)
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
    while (this.gradients.length < this.plan.gradients.length) {
      this.addGradient(this.plan.gradients[this.gradients.length]!)
    }
    while (this.gradients.length > this.plan.gradients.length) this.removeGradient()
    for (let index = 0; index < this.plan.gradients.length; index += 1) {
      applyGradient(
        this.gradients[index]!,
        this.gradientFills[index]!,
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
  }

  painterLayer(id: number, sourceOrder: number): NativeSecondaryPainterLayer {
    return {
      id: `secondary:${id}`,
      lane: 'world-sorted',
      queueFamily: this.plan.queueFamily,
      regionLightPoint: this.regionLightPoint,
      sortBias: this.plan.sortBias,
      sourceOrder,
      worldY: this.plan.worldY,
    }
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
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
      + Number(this.plan.stormComposite !== null)
      + Number(this.stormLightning !== null)
  }

  destroy(): void {
    if (this.stormWeather) {
      this.container.removeChild(this.stormWeather.composite)
      this.stormWeather.destroy()
      this.stormWeather = null
    }
    this.container.destroy({ children: true })
    for (const gradient of this.gradientFills) gradient.destroy()
    this.gradientFills.length = 0
    this.gradients.length = 0
    this.meshIndices.length = 0
    this.meshMeshes.length = 0
    this.meshUvs.length = 0
    this.meshVertices.length = 0
    this.quadMeshes.length = 0
    this.quadVertices.length = 0
    this.sprites.length = 0
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
    const fill = new FillGradient({
      colorStops: [
        { color: colorWithAlpha(draw.startColor, draw.startAlpha), offset: 0 },
        { color: colorWithAlpha(draw.endColor, draw.endAlpha), offset: 1 },
      ],
      end: { x: 0, y: 1 },
      start: { x: 0, y: 0 },
      textureSpace: 'local',
    })
    const graphic = new Graphics()
    graphic.eventMode = 'none'
    this.gradientFills.push(fill)
    this.gradients.push(graphic)
    this.container.addChild(graphic)
  }

  private removeGradient(): void {
    const graphic = this.gradients.pop()!
    const fill = this.gradientFills.pop()!
    this.container.removeChild(graphic)
    graphic.destroy()
    fill.destroy()
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
      dynamic: true,
      height: STORM_RENDER_TARGET_SIZE,
      resolution: 1,
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
      clearColor: 'rgba(255,255,255,0)',
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

function applyGradient(
  graphic: Graphics,
  fill: FillGradient,
  draw: NativeSecondaryGradientDraw,
): void {
  graphic.label = draw.role
  graphic.clear()
    .moveTo(draw.start.x, draw.start.y)
    .lineTo(draw.end.x, draw.end.y)
    .stroke({ cap: 'butt', fill, width: draw.width })
}

function colorWithAlpha(color: number, alpha: number): string {
  const red = color >> 16 & 0xff
  const green = color >> 8 & 0xff
  const blue = color & 0xff
  return `rgba(${red},${green},${blue},${alpha})`
}

export class NativeSecondaryWorldView {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly renderer: Renderer
  private readonly textures: PlayerWorldTextures
  private readonly views = new Map<number, NativeSecondaryActorView>()

  constructor(root: Container, textures: PlayerWorldTextures, renderer: Renderer) {
    this.root = root
    this.textures = textures
    this.renderer = renderer
  }

  update(
    state: Pick<NativeSecondarySimulationState, 'actors'>,
    worldKey: string,
    presentationFrame?: number,
  ): void {
    this.liveIds.clear()
    for (const actor of state.actors) {
      if (actor.worldKey !== worldKey) continue
      if (actor.kind === 'earthquake-scenery-wobble') continue
      this.liveIds.add(actor.id)
      let view = this.views.get(actor.id)
      if (!view) {
        view = new NativeSecondaryActorView(actor, this.textures, this.renderer)
        this.views.set(actor.id, view)
        this.root.addChild(view.container)
      }
      view.update(actor, presentationFrame)
      view.setDepth(hubWorldDepthForActor(actor.position.y))
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      this.root.removeChild(view.container)
      view.destroy()
      this.views.delete(id)
    }
  }

  painterLayers(): NativeSecondaryPainterLayer[] {
    return [...this.views.entries()].map(([id, view], index) => view.painterLayer(id, index))
  }

  setDepth(id: string, depth: number): void {
    this.views.get(Number(id.slice('secondary:'.length)))?.setDepth(depth)
  }

  setTint(id: string, tint: number): void {
    this.views.get(Number(id.slice('secondary:'.length)))?.setTint(tint)
  }

  setRenderable(renderable: boolean): void {
    for (const view of this.views.values()) view.container.renderable = renderable
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

  destroy(): void {
    for (const view of this.views.values()) {
      this.root.removeChild(view.container)
      view.destroy()
    }
    this.views.clear()
    this.liveIds.clear()
  }
}

function stormStrikeTransient(
  actor: NativeSecondaryActorState,
): PrimarySpellAirTransientState {
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
  const texture = textures[nativeSecondarySpriteKey(draw.atlas, draw.entry)]
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
