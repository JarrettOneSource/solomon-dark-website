import { Container, Graphics } from 'pixi.js'

import { nativeGateLeaf, nativeGatePainterRoot } from '../../editor/native-fence-geometry.ts'
import type { Vec2 } from '../../editor/model.ts'
import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import {
  nativeBoneyardComplexShadowRecords,
  nativeBoneyardProjectedShadowEdges,
  type NativeBoneyardComplexShadowCaster,
  type NativeBoneyardProjectedShadowEdge,
} from './boneyard-complex-shadows.ts'
import type { NativeBoneyardLightSource } from './boneyard-lighting.ts'

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
const NATIVE_SHADOW_GRADIENT_STEPS = 12

interface StaticShadowView {
  caster: NativeBoneyardComplexShadowCaster
  depthOwner: ShadowDepthOwner
  graphics: Graphics
}

interface DynamicShadowView {
  caster: NativeBoneyardComplexShadowCaster
  graphics: Graphics
}

export class BoneyardComplexShadowPresentation {
  private readonly dynamicViews = new Map<string, DynamicShadowView>()
  private readonly liveDynamicIds = new Set<string>()
  private readonly root: Container
  private readonly staticViews: readonly StaticShadowView[]

  constructor(
    root: Container,
    staticCasters: readonly BoneyardComplexShadowStaticCaster[],
  ) {
    this.root = root
    this.staticViews = staticCasters.map(({ caster, depthOwner }) => {
      const graphics = shadowGraphics(caster.id)
      root.addChild(graphics)
      return { caster, depthOwner, graphics }
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
        view.graphics.renderable = false
        continue
      }
      view.graphics.zIndex = view.depthOwner.zIndex - NATIVE_SHADOW_DEPTH_OFFSET
      const result = renderCaster(view.graphics, view.caster, sources, presentationFrame)
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
        const graphics = shadowGraphics(id)
        view = { caster: gateCaster(id, gate), graphics }
        this.dynamicViews.set(id, view)
        this.root.addChild(graphics)
      } else {
        view.caster = gateCaster(id, gate)
      }
      view.graphics.zIndex = depth - NATIVE_SHADOW_DEPTH_OFFSET
      const result = renderCaster(view.graphics, view.caster, sources, presentationFrame)
      if (result.quadCount > 0) casterCount += 1
      quadCount += result.quadCount
      recordCount += result.recordCount
    }
    for (const [id, view] of this.dynamicViews) {
      if (liveDynamicIds.has(id)) continue
      this.root.removeChild(view.graphics)
      view.graphics.destroy()
      this.dynamicViews.delete(id)
    }
    return { casterCount, quadCount, recordCount }
  }

  destroy(): void {
    for (const view of this.staticViews) {
      this.root.removeChild(view.graphics)
      view.graphics.destroy()
    }
    for (const view of this.dynamicViews.values()) {
      this.root.removeChild(view.graphics)
      view.graphics.destroy()
    }
    this.dynamicViews.clear()
    this.liveDynamicIds.clear()
  }
}

function renderCaster(
  graphics: Graphics,
  caster: NativeBoneyardComplexShadowCaster,
  sources: readonly NativeBoneyardLightSource[],
  presentationFrame: number,
): { quadCount: number; recordCount: number } {
  graphics.clear()
  const records = nativeBoneyardComplexShadowRecords(caster, sources, presentationFrame)
  let quadCount = 0
  for (const record of records) {
    for (const edge of nativeBoneyardProjectedShadowEdges(caster, record)) {
      drawProjectedEdge(graphics, edge)
      quadCount += 1
    }
  }
  graphics.renderable = quadCount > 0
  return { quadCount, recordCount: records.length }
}

function drawProjectedEdge(
  graphics: Graphics,
  edge: NativeBoneyardProjectedShadowEdge,
): void {
  for (let step = 0; step < NATIVE_SHADOW_GRADIENT_STEPS; step += 1) {
    const startT = step / NATIVE_SHADOW_GRADIENT_STEPS
    const endT = (step + 1) / NATIVE_SHADOW_GRADIENT_STEPS
    const alphaT = (startT + endT) / 2
    const alpha = edge.baseAlpha + (edge.tipAlpha - edge.baseAlpha) * alphaT
    const startA = interpolate(edge.baseStart, edge.tipStart, startT)
    const startB = interpolate(edge.baseEnd, edge.tipEnd, startT)
    const endA = interpolate(edge.baseStart, edge.tipStart, endT)
    const endB = interpolate(edge.baseEnd, edge.tipEnd, endT)
    graphics
      .poly([
        startA.x,
        startA.y,
        startB.x,
        startB.y,
        endB.x,
        endB.y,
        endA.x,
        endA.y,
      ])
      .fill({ alpha, color: 0x000000 })
  }
}

function gateCaster(
  id: string,
  state: BoneyardGateLeafSnapshot,
): NativeBoneyardComplexShadowCaster {
  const leaf = nativeGateLeaf(state.hinge, state.tip)
  const position = nativeGatePainterRoot(state.hinge, state.tip)
  return {
    id,
    outline: [leaf.p0, leaf.p1, leaf.p3, leaf.p2].map((point) => ({
      x: point.x - position.x,
      y: point.y - position.y,
    })),
    position,
  }
}

function shadowGraphics(id: string): Graphics {
  const graphics = new Graphics({ label: `complex-shadow:${id}` })
  graphics.eventMode = 'none'
  graphics.renderable = false
  return graphics
}

function interpolate(start: Vec2, end: Vec2, phase: number): Vec2 {
  return {
    x: start.x + (end.x - start.x) * phase,
    y: start.y + (end.y - start.y) * phase,
  }
}
