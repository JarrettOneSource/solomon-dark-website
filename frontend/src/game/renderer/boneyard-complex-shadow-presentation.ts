import {
  Container,
  Geometry,
  Mesh,
  Shader,
  Texture,
} from 'pixi.js'

import { nativeGatePainterRoot } from '../../editor/native-fence-geometry.ts'
import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import {
  nativeBoneyardComplexShadowRecords,
  nativeBoneyardFenceGrateShadows,
  nativeBoneyardProjectedShadowEdges,
  nativeBoneyardRailsShadows,
  nativeBoneyardWallShadow,
  type NativeBoneyardComplexShadowCaster,
  type NativeBoneyardProjectedShadowEdge,
} from './boneyard-complex-shadows.ts'
import type { NativeBoneyardLightSource } from './boneyard-lighting.ts'
import {
  buildNativeBoneyardShadowMesh,
  nativeBoneyardShadowLineQuad,
} from './boneyard-shadow-mesh.ts'

interface ShadowDepthOwner {
  renderable: boolean
  zIndex: number
}

export interface BoneyardComplexShadowStaticCaster {
  caster: NativeBoneyardComplexShadowCaster
  depthOwner: ShadowDepthOwner
}

export interface BoneyardComplexShadowFrame {
  casterCount: number
  quadCount: number
  recordCount: number
}

const NATIVE_SHADOW_DEPTH_OFFSET = 0.001
interface StaticShadowView {
  caster: NativeBoneyardComplexShadowCaster
  depthOwner: ShadowDepthOwner
  mesh: ShadowMeshView
}

interface DynamicShadowView {
  caster: NativeBoneyardComplexShadowCaster
  mesh: ShadowMeshView
}

interface ShadowMeshView {
  geometry: Geometry
  mesh: Mesh<Geometry, Shader>
}

export class BoneyardComplexShadowPresentation {
  private readonly dynamicViews = new Map<string, DynamicShadowView>()
  private readonly liveDynamicIds = new Set<string>()
  private readonly root: Container
  private readonly shader = shadowShader()
  private readonly staticViews: readonly StaticShadowView[]

  constructor(
    root: Container,
    staticCasters: readonly BoneyardComplexShadowStaticCaster[],
  ) {
    this.root = root
    this.staticViews = staticCasters.map(({ caster, depthOwner }) => {
      const mesh = shadowMesh(caster.id, this.shader)
      root.addChild(mesh.mesh)
      return { caster, depthOwner, mesh }
    })
  }

  render(
    sources: readonly NativeBoneyardLightSource[],
    presentationFrame: number,
    gateLeaves: readonly BoneyardGateLeafSnapshot[],
    gateDepths: ReadonlyMap<string, number>,
  ): BoneyardComplexShadowFrame {
    let casterCount = 0
    let quadCount = 0
    let recordCount = 0
    for (const view of this.staticViews) {
      if (!view.depthOwner.renderable) {
        view.mesh.mesh.renderable = false
        continue
      }
      view.mesh.mesh.zIndex = view.depthOwner.zIndex - NATIVE_SHADOW_DEPTH_OFFSET
      const result = renderCaster(
        view.mesh,
        view.caster,
        sources,
        presentationFrame,
      )
      if (result.quadCount > 0) casterCount += 1
      quadCount += result.quadCount
      recordCount += result.recordCount
    }

    const liveDynamicIds = this.liveDynamicIds
    liveDynamicIds.clear()
    for (const gate of gateLeaves) {
      const key = `${gate.fenceEid}:${gate.side}`
      const depth = gateDepths.get(key)
      if (depth === undefined) continue
      const id = `gate:${key}`
      liveDynamicIds.add(id)
      let view = this.dynamicViews.get(id)
      if (!view) {
        const mesh = shadowMesh(id, this.shader)
        view = { caster: gateCaster(id, gate), mesh }
        this.dynamicViews.set(id, view)
        this.root.addChild(mesh.mesh)
      } else {
        view.caster = gateCaster(id, gate)
      }
      view.mesh.mesh.zIndex = depth - NATIVE_SHADOW_DEPTH_OFFSET
      const result = renderCaster(
        view.mesh,
        view.caster,
        sources,
        presentationFrame,
      )
      if (result.quadCount > 0) casterCount += 1
      quadCount += result.quadCount
      recordCount += result.recordCount
    }
    for (const [id, view] of this.dynamicViews) {
      if (liveDynamicIds.has(id)) continue
      destroyShadowMesh(this.root, view.mesh)
      this.dynamicViews.delete(id)
    }
    return { casterCount, quadCount, recordCount }
  }

  destroy(): void {
    for (const view of this.staticViews) {
      destroyShadowMesh(this.root, view.mesh)
    }
    for (const view of this.dynamicViews.values()) {
      destroyShadowMesh(this.root, view.mesh)
    }
    this.dynamicViews.clear()
    this.liveDynamicIds.clear()
    this.shader.destroy(true)
  }
}

function renderCaster(
  view: ShadowMeshView,
  caster: NativeBoneyardComplexShadowCaster,
  sources: readonly NativeBoneyardLightSource[],
  presentationFrame: number,
): { quadCount: number; recordCount: number } {
  const records = nativeBoneyardComplexShadowRecords(caster, sources, presentationFrame)
  const projectedEdges: NativeBoneyardProjectedShadowEdge[] = []
  const lineQuads: NativeBoneyardProjectedShadowEdge[] = []
  for (const record of records) {
    if (caster.program?.kind === 'fence-grate') {
      const grate = nativeBoneyardFenceGrateShadows(caster.program, record)
      for (const bar of grate.bars) {
        projectedEdges.push(bar)
      }
      lineQuads.push(nativeBoneyardShadowLineQuad(grate.rail))
      continue
    }
    if (caster.program?.kind === 'rails') {
      for (const rail of nativeBoneyardRailsShadows(caster.program, record)) {
        lineQuads.push(nativeBoneyardShadowLineQuad(rail))
      }
      continue
    }
    if (caster.program?.kind === 'wall') {
      projectedEdges.push(nativeBoneyardWallShadow(caster.program, record))
      continue
    }
    for (const edge of nativeBoneyardProjectedShadowEdges(caster, record)) {
      projectedEdges.push(edge)
    }
  }
  const mesh = buildNativeBoneyardShadowMesh(projectedEdges, lineQuads)
  updateShadowMesh(view, mesh)
  const quadCount = projectedEdges.length + lineQuads.length
  view.mesh.renderable = quadCount > 0
  return { quadCount, recordCount: records.length }
}

function gateCaster(
  id: string,
  state: BoneyardGateLeafSnapshot,
): NativeBoneyardComplexShadowCaster {
  const position = nativeGatePainterRoot(state.hinge, state.tip)
  return {
    id,
    outline: [],
    position,
    program: {
      construction: 'gate',
      end: { ...state.tip },
      kind: 'fence-grate',
      start: { ...state.hinge },
    },
  }
}

function shadowMesh(id: string, shader: Shader): ShadowMeshView {
  const geometry = new Geometry({
    attributes: {
      aAlpha: { buffer: new Float32Array(), format: 'float32' },
      aPosition: { buffer: new Float32Array(), format: 'float32x2' },
    },
    indexBuffer: new Uint32Array(),
    label: `complex-shadow:${id}`,
  })
  const mesh = new Mesh({ geometry, shader, texture: Texture.EMPTY })
  mesh.eventMode = 'none'
  mesh.label = `complex-shadow:${id}`
  mesh.renderable = false
  return { geometry, mesh }
}

function updateShadowMesh(
  view: ShadowMeshView,
  mesh: ReturnType<typeof buildNativeBoneyardShadowMesh>,
): void {
  const positionBuffer = view.geometry.getBuffer('aPosition')
  positionBuffer.data = mesh.positions
  positionBuffer.update()
  const alphaBuffer = view.geometry.getBuffer('aAlpha')
  alphaBuffer.data = mesh.alphas
  alphaBuffer.update()
  view.geometry.indexBuffer.data = mesh.indices
  view.geometry.indexBuffer.update()
}

function destroyShadowMesh(root: Container, view: ShadowMeshView): void {
  root.removeChild(view.mesh)
  view.mesh.destroy()
  view.geometry.destroy(true)
}

function shadowShader(): Shader {
  return Shader.from({
    gl: {
      fragment: `
        in float vAlpha;
        out vec4 finalColor;
        void main(void) {
          finalColor = vec4(0.0, 0.0, 0.0, vAlpha);
        }
      `,
      name: 'boneyard-complex-shadow',
      vertex: `
        in vec2 aPosition;
        in float aAlpha;
        uniform mat3 uProjectionMatrix;
        uniform mat3 uWorldTransformMatrix;
        uniform vec4 uWorldColorAlpha;
        uniform mat3 uTransformMatrix;
        uniform vec4 uColor;
        out float vAlpha;
        void main(void) {
          mat3 matrix = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
          gl_Position = vec4((matrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
          vAlpha = aAlpha * uWorldColorAlpha.a * uColor.a;
        }
      `,
    },
  })
}
