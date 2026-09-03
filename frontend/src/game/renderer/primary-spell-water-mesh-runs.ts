import {
  Buffer,
  BufferUsage,
  Geometry,
  Mesh,
  Shader,
  Texture,
  compileHighShaderGlProgram,
  localUniformBitGl,
  roundPixelsBitGl,
  type Container,
} from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
  PrimarySpellWaterAuraState,
  PrimarySpellWaterHailState,
  PrimarySpellWaterTransientState,
} from '../core-kernels/primary-spells.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import {
  packWaterFrostTint,
  quantizeWaterFrostAlpha,
  waterFrostJetKind,
  waterFrostJetPlan,
  type WaterFrostJetPlan,
} from '../core-kernels/primary-spell-water.ts'
import {
  NATIVE_ARENA_SATURATION,
  nativeArenaSaturateSample,
  type NativeArenaRgba,
} from './native-arena-render-pipeline.ts'
import {
  NATIVE_AIR_WATER_SPRITES,
  nativeWaterAuraVisualPlan,
} from './primary-spell-air-water-native.ts'

export type NativeWaterMeshActorState =
  | PrimarySpellWaterAuraState
  | PrimarySpellWaterHailState
  | PrimarySpellWaterTransientState

export interface NativeWaterMeshPainterLayer {
  id: string
  lane: 'world-sorted'
  meshActorId: number
  queueFamily: 'ordinary-dynamic' | 'zanim'
  regionLightPoint: null
  registration: NativeWorldManagerRegistration
  sortBias: 0
  worldY: number
}

export interface NativeWaterMeshTextures {
  aura: Texture
  core: Texture
  glint: Texture
  hail: Texture
}

interface NativeWaterMeshRun {
  activeQuadCount: number
  activatedQuadHighWater: number
  capacity: number
  geometry: Geometry
  indexBuffer: Buffer
  indices: Uint32Array
  mesh: Mesh<Geometry, Shader>
  vertexBuffer: Buffer
  vertices: Float32Array
}

interface NativeWaterTextureLayout {
  bottom: number
  left: number
  right: number
  top: number
  uvs: readonly [number, number, number, number, number, number, number, number]
}

interface NativeWaterTextureLayouts {
  aura: NativeWaterTextureLayout
  core: NativeWaterTextureLayout
  glint: NativeWaterTextureLayout
  hail: NativeWaterTextureLayout
}

const VERTICES_PER_QUAD = 4
const INDICES_PER_QUAD = 6
const FLOATS_PER_VERTEX = 9
const BYTES_PER_FLOAT = Float32Array.BYTES_PER_ELEMENT
const VERTEX_STRIDE_BYTES = FLOATS_PER_VERTEX * BYTES_PER_FLOAT

const NATIVE_WATER_MESH_BIT_GL = {
  name: 'native-water-affine-mesh',
  vertex: {
    header: `
      in vec4 aWaterColor;
      in float aWaterAdditive;
      out vec4 vWaterColor;
      out float vWaterAdditive;
    `,
    main: `
      vWaterColor = aWaterColor;
      vWaterAdditive = aWaterAdditive;
    `,
  },
  fragment: {
    header: `
      in vec4 vWaterColor;
      in float vWaterAdditive;
      uniform sampler2D uWaterAtlasTexture;
    `,
    main: 'outColor = vec4(1.0);',
    end: `
      vec4 waterSample = texture(uWaterAtlasTexture, vUV);
      float textureAlpha = waterSample.a;
      vec3 textureColor = waterSample.rgb;
      float groupAlpha = vColor.a;
      vec3 groupColor = groupAlpha > 0.0 ? vColor.rgb / groupAlpha : vec3(0.0);
      vec3 vertexColor = vWaterColor.rgb * groupColor;
      float vertexAlpha = vWaterColor.a * groupAlpha;
      float textureGrey = (textureColor.r + textureColor.g + textureColor.b) / 3.0;
      float vertexGrey = (vertexColor.r + vertexColor.g + vertexColor.b) / 3.0;
      float grey = textureGrey * vertexGrey;
      vec3 realColor = textureColor * vertexColor;
      vec3 nativeColor = mix(vec3(grey), realColor, ${NATIVE_ARENA_SATURATION});
      float finalAlpha = textureAlpha * vertexAlpha;
      vec3 premultipliedColor = nativeColor * finalAlpha;
      finalColor = vWaterAdditive > 0.5
        ? vec4(premultipliedColor, 0.0)
        : vec4(premultipliedColor, finalAlpha);
    `,
  },
}

export class NativeWaterMeshRuns {
  private activeRunCount = 0
  private activeAuraCount = 0
  private activeHailCount = 0
  private activeNormalFrostCount = 0
  private readonly depths: number[] = []
  private readonly layerById = new Map<number, NativeWaterMeshPainterLayer>()
  private readonly layouts: NativeWaterTextureLayouts
  private readonly liveIds = new Set<number>()
  private readonly planById = new Map<number, WaterFrostJetPlan>()
  private renderable = true
  private readonly root: Container
  private readonly runActorCounts: number[] = []
  private readonly runQuadCounts: number[] = []
  private readonly runs: NativeWaterMeshRun[] = []
  private readonly runStarts: number[] = []
  private readonly shader: Shader
  private readonly sortedIds: number[] = []
  private readonly stateById = new Map<number, NativeWaterMeshActorState>()

  constructor(root: Container, textures: NativeWaterMeshTextures, shader?: Shader) {
    this.root = root
    this.layouts = waterTextureLayouts(textures)
    const atlasSource = requireCommonWaterAtlasSource(textures)
    this.shader = shader ?? createNativeWaterMeshShaderForSource(atlasSource)
  }

  beginFrame(): void {
    this.activeAuraCount = 0
    this.activeHailCount = 0
    this.activeNormalFrostCount = 0
    this.liveIds.clear()
  }

  update(state: NativeWaterMeshActorState): boolean {
    const created = !this.stateById.has(state.id)
    const registration = nativeWaterMeshPainterRegistration(state)
    this.liveIds.add(state.id)
    if (state.kind === 'water-aura') this.activeAuraCount += 1
    else if (state.kind === 'water-hail') this.activeHailCount += 1
    else this.activeNormalFrostCount += 1
    this.stateById.set(state.id, state)
    if (state.kind === 'water') this.planById.set(state.id, waterFrostJetPlan(state))
    let layer = this.layerById.get(state.id)
    if (!layer) {
      layer = {
        id: `primary-spell:${state.id}`,
        lane: 'world-sorted',
        meshActorId: state.id,
        queueFamily: state.kind === 'water' ? 'zanim' : 'ordinary-dynamic',
        regionLightPoint: null,
        registration,
        sortBias: 0,
        worldY: nativeWaterMeshWorldY(state, this.planById.get(state.id)),
      }
      this.layerById.set(state.id, layer)
    } else {
      if (
        layer.registration.managerLane !== registration.managerLane
        || layer.registration.registrationOrdinal !== registration.registrationOrdinal
      ) {
        throw new Error(`Water mesh actor ${state.id} changed painter registration`)
      }
      layer.worldY = nativeWaterMeshWorldY(state, this.planById.get(state.id))
    }
    return created
  }

  endFrame(): void {
    for (const id of this.stateById.keys()) {
      if (this.liveIds.has(id)) continue
      this.stateById.delete(id)
      this.planById.delete(id)
      this.layerById.delete(id)
    }
  }

  painterLayer(id: number): NativeWaterMeshPainterLayer | null {
    return this.layerById.get(id) ?? null
  }

  has(id: number): boolean {
    return this.stateById.has(id)
  }

  kind(id: number): 'water' | 'water-aura' | 'water-hail' | undefined {
    return this.stateById.get(id)?.kind
  }

  beginDepths(): void {
    this.depths.length = 0
    this.sortedIds.length = 0
  }

  appendDepth(id: number, depth: number): void {
    if (!this.stateById.has(id)) return
    const previousDepth = this.depths.at(-1)
    if (previousDepth !== undefined && depth <= previousDepth) {
      throw new Error('Water mesh depths must be strictly increasing')
    }
    this.sortedIds.push(id)
    this.depths.push(depth)
  }

  commitDepths(): void {
    const sortedIds = this.sortedIds
    const depths = this.depths

    const runStarts = this.runStarts
    const runActorCounts = this.runActorCounts
    const runQuadCounts = this.runQuadCounts
    runStarts.length = 0
    runActorCounts.length = 0
    runQuadCounts.length = 0
    let previousDepth = Number.NEGATIVE_INFINITY
    for (let index = 0; index < sortedIds.length; index += 1) {
      const id = sortedIds[index]!
      const depth = depths[index]!
      const state = this.stateById.get(id)!
      const quadCount = nativeWaterMeshQuadCount(state, this.planById.get(id))
      if (depth !== previousDepth + 1) {
        runStarts.push(index)
        runActorCounts.push(1)
        runQuadCounts.push(quadCount)
      } else {
        runActorCounts[runActorCounts.length - 1]! += 1
        runQuadCounts[runQuadCounts.length - 1]! += quadCount
      }
      previousDepth = depth
    }

    for (let runIndex = 0; runIndex < runStarts.length; runIndex += 1) {
      const start = runStarts[runIndex]!
      const actorCount = runActorCounts[runIndex]!
      const quadCount = runQuadCounts[runIndex]!
      const run = this.ensureRun(runIndex, quadCount)
      let quadOrdinal = 0
      for (let ordinal = 0; ordinal < actorCount; ordinal += 1) {
        const id = sortedIds[start + ordinal]!
        const state = this.stateById.get(id)!
        quadOrdinal = writeNativeWaterMeshActor(
          run.vertices,
          quadOrdinal,
          state,
          this.planById.get(id),
          this.layouts,
        )
      }
      updateRunActiveQuads(run, quadCount)
      run.mesh.zIndex = depths[start]!
      run.mesh.renderable = this.renderable
    }
    for (let index = runStarts.length; index < this.activeRunCount; index += 1) {
      const run = this.runs[index]!
      updateRunActiveQuads(run, 0)
      run.mesh.renderable = false
    }
    this.activeRunCount = runStarts.length
  }

  setRenderable(renderable: boolean): void {
    this.renderable = renderable
    for (let index = 0; index < this.activeRunCount; index += 1) {
      this.runs[index]!.mesh.renderable = renderable
    }
  }

  get count(): number {
    return this.stateById.size
  }

  get auraCount(): number {
    return this.activeAuraCount
  }

  get hailCount(): number {
    return this.activeHailCount
  }

  get normalFrostCount(): number {
    return this.activeNormalFrostCount
  }

  get runCount(): number {
    return this.activeRunCount
  }

  destroy(): void {
    for (const run of this.runs) {
      this.root.removeChild(run.mesh)
      run.mesh.destroy()
      run.geometry.destroy(true)
    }
    this.shader.destroy(true)
    this.runs.length = 0
    this.runStarts.length = 0
    this.runActorCounts.length = 0
    this.runQuadCounts.length = 0
    this.sortedIds.length = 0
    this.activeRunCount = 0
    this.activeAuraCount = 0
    this.activeHailCount = 0
    this.activeNormalFrostCount = 0
    this.depths.length = 0
    this.layerById.clear()
    this.liveIds.clear()
    this.planById.clear()
    this.stateById.clear()
  }

  private ensureRun(index: number, quadCount: number): NativeWaterMeshRun {
    let run = this.runs[index]
    if (run && run.capacity >= quadCount) return run
    const capacity = nextPowerOfTwo(quadCount)
    const replacement = createNativeWaterMeshRun(index, capacity, this.shader)
    if (run) {
      const childIndex = this.root.getChildIndex(run.mesh)
      this.root.removeChild(run.mesh)
      run.mesh.destroy()
      run.geometry.destroy(true)
      this.root.addChildAt(replacement.mesh, childIndex)
    } else {
      this.root.addChild(replacement.mesh)
    }
    this.runs[index] = replacement
    run = replacement
    return run
  }
}

export function isNativeWaterMeshActorState(
  state: PrimarySpellProjectileState | PrimarySpellTransientState,
): state is NativeWaterMeshActorState {
  return state.kind === 'water-aura'
    || state.kind === 'water-hail'
    || (state.kind === 'water' && waterFrostJetKind(state.id, state.underpowered) === 'normal')
}

export function nativeWaterMeshComposite(
  background: NativeArenaRgba,
  texture: NativeArenaRgba,
  tint: NativeArenaRgba,
  additive: boolean,
  texturePremultiplied: boolean,
): NativeArenaRgba {
  const sampled: NativeArenaRgba = texturePremultiplied && texture[3] > 0
    ? [texture[0] / texture[3], texture[1] / texture[3], texture[2] / texture[3], texture[3]]
    : texture
  const color = nativeArenaSaturateSample(sampled, tint)
  const alpha = texture[3] * tint[3]
  return additive
    ? [
        color[0] * alpha + background[0],
        color[1] * alpha + background[1],
        color[2] * alpha + background[2],
        background[3],
      ]
    : [
        color[0] * alpha + background[0] * (1 - alpha),
        color[1] * alpha + background[1] * (1 - alpha),
        color[2] * alpha + background[2] * (1 - alpha),
        alpha + background[3] * (1 - alpha),
      ]
}

function nativeWaterMeshPainterRegistration(
  state: NativeWaterMeshActorState,
): NativeWorldManagerRegistration {
  const painterRegistrations = state.painterRegistrations
  const registration = painterRegistrations?.[0]
  const expectedLane = state.kind === 'water' ? 'transient' : 'actor'
  if (
    painterRegistrations?.length !== 1
    || registration?.managerLane !== expectedLane
  ) {
    throw new Error(`${state.kind} lost its ${expectedLane}-manager painter registration`)
  }
  return registration
}

function nativeWaterMeshWorldY(
  state: NativeWaterMeshActorState,
  plan: WaterFrostJetPlan | undefined,
): number {
  if (state.kind === 'water-aura') return state.origin.y
  return state.kind === 'water-hail' ? state.position.y : plan!.worldY
}

function nativeWaterMeshQuadCount(
  state: NativeWaterMeshActorState,
  plan: WaterFrostJetPlan | undefined,
): number {
  return state.kind === 'water' ? plan!.draws.length : 1
}

function writeNativeWaterMeshActor(
  vertices: Float32Array,
  firstQuad: number,
  state: NativeWaterMeshActorState,
  plan: WaterFrostJetPlan | undefined,
  layouts: NativeWaterTextureLayouts,
): number {
  if (state.kind === 'water-aura') {
    const plan = nativeWaterAuraVisualPlan(state)
    writeNativeWaterMeshQuad(vertices, firstQuad, {
      additive: true,
      alpha: quantizeAlpha(plan.alpha),
      layout: layouts.aura,
      position: state.origin,
      rotation: plan.rotationRadians,
      scale: plan.scale,
      tint: plan.tint,
    })
    return firstQuad + 1
  }
  if (state.kind === 'water-hail') {
    writeNativeWaterMeshQuad(vertices, firstQuad, {
      additive: false,
      alpha: quantizeAlpha(state.life),
      layout: layouts.hail,
      position: { x: state.position.x, y: state.position.y + state.height },
      rotation: state.rotationDegrees * Math.PI / 180,
      scale: state.scale,
      tint: 0xffffff,
    })
    return firstQuad + 1
  }
  let quad = firstQuad
  for (const draw of plan!.draws) {
    writeNativeWaterMeshQuad(vertices, quad, {
      additive: draw.blend === 'add',
      alpha: quantizeWaterFrostAlpha(draw.alpha),
      layout: draw.sprite === 'core' ? layouts.core : layouts.glint,
      position: draw.position,
      rotation: draw.rotation,
      scale: draw.scale,
      tint: packWaterFrostTint(draw.color),
    })
    quad += 1
  }
  return quad
}

function writeNativeWaterMeshQuad(
  vertices: Float32Array,
  quad: number,
  draw: Readonly<{
    additive: boolean
    alpha: number
    layout: NativeWaterTextureLayout
    position: Readonly<{ x: number, y: number }>
    rotation: number
    scale: number
    tint: number
  }>,
): void {
  const cosine = Math.cos(draw.rotation)
  const sine = Math.sin(draw.rotation)
  const { layout } = draw
  const points = [
    [layout.left, layout.top],
    [layout.right, layout.top],
    [layout.right, layout.bottom],
    [layout.left, layout.bottom],
  ] as const
  const red = ((draw.tint >> 16) & 0xff) / 255
  const green = ((draw.tint >> 8) & 0xff) / 255
  const blue = (draw.tint & 0xff) / 255
  for (let vertex = 0; vertex < VERTICES_PER_QUAD; vertex += 1) {
    const localX = points[vertex]![0] * draw.scale
    const localY = points[vertex]![1] * draw.scale
    const offset = (quad * VERTICES_PER_QUAD + vertex) * FLOATS_PER_VERTEX
    vertices[offset] = localX * cosine - localY * sine + draw.position.x
    vertices[offset + 1] = localX * sine + localY * cosine + draw.position.y
    vertices[offset + 2] = layout.uvs[vertex * 2]!
    vertices[offset + 3] = layout.uvs[vertex * 2 + 1]!
    vertices[offset + 4] = red
    vertices[offset + 5] = green
    vertices[offset + 6] = blue
    vertices[offset + 7] = draw.alpha
    vertices[offset + 8] = Number(draw.additive)
  }
}

function createNativeWaterMeshRun(
  index: number,
  capacity: number,
  shader: Shader,
): NativeWaterMeshRun {
  const vertices = new Float32Array(capacity * VERTICES_PER_QUAD * FLOATS_PER_VERTEX)
  const indices = new Uint32Array(capacity * INDICES_PER_QUAD)
  const vertexBuffer = new Buffer({
    data: vertices,
    label: `primary-water-mesh-vertices:${index}`,
    shrinkToFit: false,
    usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
  })
  const indexBuffer = new Buffer({
    data: indices,
    label: `primary-water-mesh-indices:${index}`,
    shrinkToFit: false,
    usage: BufferUsage.INDEX | BufferUsage.COPY_DST,
  })
  const geometry = new Geometry({
    attributes: {
      aPosition: {
        buffer: vertexBuffer,
        format: 'float32x2',
        offset: 0,
        stride: VERTEX_STRIDE_BYTES,
      },
      aUV: {
        buffer: vertexBuffer,
        format: 'float32x2',
        offset: 2 * BYTES_PER_FLOAT,
        stride: VERTEX_STRIDE_BYTES,
      },
      aWaterColor: {
        buffer: vertexBuffer,
        format: 'float32x4',
        offset: 4 * BYTES_PER_FLOAT,
        stride: VERTEX_STRIDE_BYTES,
      },
      aWaterAdditive: {
        buffer: vertexBuffer,
        format: 'float32',
        offset: 8 * BYTES_PER_FLOAT,
        stride: VERTEX_STRIDE_BYTES,
      },
    },
    indexBuffer,
    topology: 'triangle-list',
  })
  const mesh = new Mesh({
    geometry,
    label: `primary-water-mesh-run:${index}`,
    shader,
    texture: Texture.WHITE,
  })
  mesh.eventMode = 'none'
  mesh.renderable = false
  return {
    activeQuadCount: 0,
    activatedQuadHighWater: 0,
    capacity,
    geometry,
    indexBuffer,
    indices,
    mesh,
    vertexBuffer,
    vertices,
  }
}

function updateRunActiveQuads(run: NativeWaterMeshRun, count: number): void {
  const previousCount = run.activeQuadCount
  if (count > previousCount) {
    for (let quad = previousCount; quad < count; quad += 1) {
      writeNativeWaterMeshQuadIndices(run.indices, quad)
    }
  } else if (count < previousCount) {
    run.indices.fill(
      0,
      count * INDICES_PER_QUAD,
      previousCount * INDICES_PER_QUAD,
    )
  }
  if (count !== previousCount) {
    run.activatedQuadHighWater = Math.max(
      run.activatedQuadHighWater,
      count,
      previousCount,
    )
    run.indexBuffer.update(
      run.activatedQuadHighWater
        * INDICES_PER_QUAD
        * Uint32Array.BYTES_PER_ELEMENT,
    )
  }
  run.activeQuadCount = count
  if (count === 0) return
  const vertexFloats = count * VERTICES_PER_QUAD * FLOATS_PER_VERTEX
  const vertexBytes = vertexFloats * BYTES_PER_FLOAT
  run.vertexBuffer.update(vertexBytes)
}

function writeNativeWaterMeshQuadIndices(indices: Uint32Array, quad: number): void {
  const vertex = quad * VERTICES_PER_QUAD
  const offset = quad * INDICES_PER_QUAD
  indices[offset] = vertex
  indices[offset + 1] = vertex + 1
  indices[offset + 2] = vertex + 2
  indices[offset + 3] = vertex
  indices[offset + 4] = vertex + 2
  indices[offset + 5] = vertex + 3
}

export function createNativeWaterMeshShader(textures: NativeWaterMeshTextures): Shader {
  return createNativeWaterMeshShaderForSource(requireCommonWaterAtlasSource(textures))
}

function createNativeWaterMeshShaderForSource(
  atlasSource: NativeWaterMeshTextures['core']['source'],
): Shader {
  if (atlasSource.alphaMode !== 'no-premultiply-alpha') {
    throw new Error('Water mesh atlas must use the native non-premultiplied source policy')
  }
  return new Shader({
    glProgram: compileHighShaderGlProgram({
      bits: [
        localUniformBitGl,
        roundPixelsBitGl,
        NATIVE_WATER_MESH_BIT_GL,
      ],
      name: 'native-water-affine-mesh',
    }),
    resources: {
      uWaterAtlasTexture: atlasSource,
    },
  })
}

function requireCommonWaterAtlasSource(
  textures: NativeWaterMeshTextures,
): NativeWaterMeshTextures['core']['source'] {
  const source = textures.core.source
  if (
    textures.aura.source !== source
    || textures.glint.source !== source
    || textures.hail.source !== source
  ) {
    throw new Error('Water mesh textures must share one packed atlas source')
  }
  return source
}

function waterTextureLayouts(textures: NativeWaterMeshTextures): NativeWaterTextureLayouts {
  const aura = NATIVE_AIR_WATER_SPRITES.coldAura
  const hail = NATIVE_AIR_WATER_SPRITES.hail
  return {
    aura: registeredTextureLayout(textures.aura, aura),
    core: centeredTextureLayout(textures.core),
    glint: centeredTextureLayout(textures.glint),
    hail: registeredTextureLayout(textures.hail, hail),
  }
}

function registeredTextureLayout(
  texture: Texture,
  registration: Readonly<{
    anchorX: number
    anchorY: number
    height: number
    width: number
  }>,
): NativeWaterTextureLayout {
  const trim = texture.trim
  const left = (trim?.x ?? 0) - registration.anchorX
  const top = (trim?.y ?? 0) - registration.anchorY
  return {
    bottom: top + (trim?.height ?? registration.height),
    left,
    right: left + (trim?.width ?? registration.width),
    top,
    uvs: textureUvs(texture),
  }
}

function centeredTextureLayout(texture: Texture): NativeWaterTextureLayout {
  const trim = texture.trim
  const left = (trim?.x ?? 0) - texture.orig.width * 0.5
  const top = (trim?.y ?? 0) - texture.orig.height * 0.5
  return {
    bottom: top + (trim?.height ?? texture.orig.height),
    left,
    right: left + (trim?.width ?? texture.orig.width),
    top,
    uvs: textureUvs(texture),
  }
}

function textureUvs(
  texture: Texture,
): readonly [number, number, number, number, number, number, number, number] {
  const uvs = texture.uvs
  return [uvs.x0, uvs.y0, uvs.x1, uvs.y1, uvs.x2, uvs.y2, uvs.x3, uvs.y3]
}

function quantizeAlpha(alpha: number): number {
  return Math.trunc(Math.min(1, Math.max(0, alpha)) * 255) / 255
}

function nextPowerOfTwo(value: number): number {
  let result = 1
  while (result < value) result *= 2
  return result
}
