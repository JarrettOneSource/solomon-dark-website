import { Container, FillGradient, Graphics } from 'pixi.js'

import { nativeGatePainterRoot } from '../../editor/native-fence-geometry.ts'
import type { Vec2 } from '../../editor/model.ts'
import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import {
  nativeBoneyardComplexShadowRecords,
  nativeBoneyardFenceGrateShadows,
  nativeBoneyardPackedShadowAlpha,
  nativeBoneyardProjectedShadowEdges,
  nativeBoneyardRailsShadows,
  nativeBoneyardWallShadow,
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
interface StaticShadowView {
  caster: NativeBoneyardComplexShadowCaster
  depthOwner: ShadowDepthOwner
  graphics: Graphics
  gradients: FillGradient[]
}

interface DynamicShadowView {
  caster: NativeBoneyardComplexShadowCaster
  graphics: Graphics
  gradients: FillGradient[]
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
      return { caster, depthOwner, gradients: [], graphics }
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
      const result = renderCaster(
        view.graphics,
        view.gradients,
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
        const graphics = shadowGraphics(id)
        view = { caster: gateCaster(id, gate), gradients: [], graphics }
        this.dynamicViews.set(id, view)
        this.root.addChild(graphics)
      } else {
        view.caster = gateCaster(id, gate)
      }
      view.graphics.zIndex = depth - NATIVE_SHADOW_DEPTH_OFFSET
      const result = renderCaster(
        view.graphics,
        view.gradients,
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
      destroyGradients(view.gradients)
      this.root.removeChild(view.graphics)
      view.graphics.destroy()
      this.dynamicViews.delete(id)
    }
    return { casterCount, quadCount, recordCount }
  }

  destroy(): void {
    for (const view of this.staticViews) {
      destroyGradients(view.gradients)
      this.root.removeChild(view.graphics)
      view.graphics.destroy()
    }
    for (const view of this.dynamicViews.values()) {
      destroyGradients(view.gradients)
      this.root.removeChild(view.graphics)
      view.graphics.destroy()
    }
    this.dynamicViews.clear()
    this.liveDynamicIds.clear()
  }
}

function renderCaster(
  graphics: Graphics,
  gradients: FillGradient[],
  caster: NativeBoneyardComplexShadowCaster,
  sources: readonly NativeBoneyardLightSource[],
  presentationFrame: number,
): { quadCount: number; recordCount: number } {
  destroyGradients(gradients)
  graphics.clear()
  const records = nativeBoneyardComplexShadowRecords(caster, sources, presentationFrame)
  let quadCount = 0
  for (const record of records) {
    if (caster.program?.kind === 'fence-grate') {
      const grate = nativeBoneyardFenceGrateShadows(caster.program, record)
      for (const bar of grate.bars) {
        drawProjectedEdge(graphics, gradients, bar)
        quadCount += 1
      }
      graphics
        .moveTo(grate.rail.start.x, grate.rail.start.y)
        .lineTo(grate.rail.end.x, grate.rail.end.y)
        .stroke({
          alpha: nativeBoneyardPackedShadowAlpha(grate.rail.alpha),
          color: 0x000000,
          width: grate.rail.width,
        })
      quadCount += 1
      continue
    }
    if (caster.program?.kind === 'rails') {
      for (const rail of nativeBoneyardRailsShadows(caster.program, record)) {
        graphics
          .moveTo(rail.start.x, rail.start.y)
          .lineTo(rail.end.x, rail.end.y)
          .stroke({
            alpha: nativeBoneyardPackedShadowAlpha(rail.alpha),
            color: 0x000000,
            width: rail.width,
          })
        quadCount += 1
      }
      continue
    }
    if (caster.program?.kind === 'wall') {
      drawProjectedEdge(graphics, gradients, nativeBoneyardWallShadow(caster.program, record))
      quadCount += 1
      continue
    }
    for (const edge of nativeBoneyardProjectedShadowEdges(caster, record)) {
      drawProjectedEdge(graphics, gradients, edge)
      quadCount += 1
    }
  }
  graphics.renderable = quadCount > 0
  return { quadCount, recordCount: records.length }
}

function drawProjectedEdge(
  graphics: Graphics,
  gradients: FillGradient[],
  edge: NativeBoneyardProjectedShadowEdge,
): void {
  const gradient = new FillGradient({
    colorStops: [
      { color: [0, 0, 0, nativeBoneyardPackedShadowAlpha(edge.baseAlpha)], offset: 0 },
      { color: [0, 0, 0, nativeBoneyardPackedShadowAlpha(edge.tipAlpha)], offset: 1 },
    ],
    end: midpoint(edge.tipStart, edge.tipEnd),
    start: midpoint(edge.baseStart, edge.baseEnd),
    textureSpace: 'global',
  })
  gradients.push(gradient)
  graphics.poly([
    edge.baseStart.x,
    edge.baseStart.y,
    edge.baseEnd.x,
    edge.baseEnd.y,
    edge.tipEnd.x,
    edge.tipEnd.y,
    edge.tipStart.x,
    edge.tipStart.y,
  ]).fill(gradient)
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

function shadowGraphics(id: string): Graphics {
  const graphics = new Graphics({ label: `complex-shadow:${id}` })
  graphics.eventMode = 'none'
  graphics.renderable = false
  return graphics
}

function midpoint(start: Vec2, end: Vec2): Vec2 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

function destroyGradients(gradients: FillGradient[]): void {
  for (const gradient of gradients) gradient.destroy()
  gradients.length = 0
}
