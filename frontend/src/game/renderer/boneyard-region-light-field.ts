import {
  Container,
  MeshSimple,
  RenderTexture,
  Sprite,
  type Renderer,
  type Texture,
} from 'pixi.js'

import { spriteRefFor } from '../../editor/assets.ts'
import { destroyOwnedMeshGeometry } from './destroy-owned-mesh-geometry.ts'
import type { Camera } from '../../editor/render.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import {
  NATIVE_REGION_LIGHT_ATLAS,
  NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
  NATIVE_DEFAULT_LIGHT_QUALITY,
  NATIVE_REGION_LIGHT_ENTRY,
  nativeRegionLightManagerPlan,
  nativeRegionLightTargetPlan,
  nativeRegionLightStamp,
  type NativeBoneyardLightSource,
} from './boneyard-lighting.ts'
import { nativeRegionCompositeCoveragePadding, writeNativeRegionCompositeQuad } from './native-region-composite-coverage.ts'

export class BoneyardRegionLightField {
  private readonly composite: MeshSimple
  private readonly compositeVertices = new Float32Array(8)
  private readonly compositeUvs = new Float32Array(8)
  private readonly glyph: Texture
  private readonly glyphRef
  private readonly renderTexture: RenderTexture
  private readonly root: Container
  private readonly sourceContainer = new Container({ label: 'boneyard-region-light-sources' })
  private readonly sourceSprites: Sprite[] = []
  private logicalSide: number
  private physicalSide: number
  private quality: number
  private compositePadding = -1
  private compositeSide = -1

  constructor(
    root: Container,
    glyph: Texture,
    viewport: GameViewportLayout,
    resolution: number,
    quality = NATIVE_DEFAULT_LIGHT_QUALITY,
  ) {
    const glyphRef = spriteRefFor(
      NATIVE_REGION_LIGHT_ATLAS,
      NATIVE_REGION_LIGHT_ENTRY,
    )
    if (!glyphRef) throw new Error('Native Region light glyph is missing.')
    const target = nativeRegionLightTargetPlan(viewport, resolution, quality)
    this.root = root
    this.glyph = glyph
    this.glyphRef = glyphRef
    this.sourceContainer.eventMode = 'none'
    this.renderTexture = RenderTexture.create({
      alphaMode: 'no-premultiply-alpha',
      dynamic: true,
      height: target.logicalSide,
      resolution: target.renderResolution,
      scaleMode: 'linear',
      width: target.logicalSide,
    })
    this.logicalSide = target.logicalSide
    this.physicalSide = target.physicalSide
    this.quality = quality
    this.composite = new MeshSimple({
      texture: this.renderTexture,
      vertices: this.compositeVertices,
      uvs: this.compositeUvs,
      indices: new Uint32Array([0, 1, 2, 2, 1, 3]),
      roundPixels: false,
    })
    this.setViewportCoverage(resolution, 1, viewport, false)
    this.composite.blendMode = 'multiply'
    this.composite.eventMode = 'none'
    this.composite.label = 'boneyard-region-light-composite'
    this.composite.zIndex = NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX
    root.addChild(this.composite)
  }

  render(
    renderer: Renderer,
    sources: readonly NativeBoneyardLightSource[],
    camera: Camera,
    viewport: GameViewportLayout,
  ): void {
    const manager = nativeRegionLightManagerPlan({ camera, viewport }, this.quality)
    this.syncSourceSprites(sources, manager.topLeft)
    renderer.render({
      clear: true,
      clearColor: 0x000000,
      container: this.sourceContainer,
      target: this.renderTexture,
    })
    this.composite.position.set(
      manager.topLeft.x,
      manager.topLeft.y,
    )
    this.composite.scale.set(1)
  }

  resize(viewport: GameViewportLayout, resolution: number): void {
    const target = nativeRegionLightTargetPlan(viewport, resolution, this.quality)
    this.logicalSide = target.logicalSide
    this.physicalSide = target.physicalSide
    this.renderTexture.resize(
      target.logicalSide,
      target.logicalSide,
      target.renderResolution,
    )
  }

  setQuality(quality: number, viewport: GameViewportLayout, resolution: number): void {
    if (quality === this.quality) return
    this.quality = quality
    this.resize(viewport, resolution)
  }

  setCompositeZIndex(zIndex: number): void {
    this.composite.zIndex = zIndex
  }

  setViewportCoverage(
    resolution: number,
    worldScale: number,
    viewport: GameViewportLayout,
    steadyView: boolean,
  ): void {
    const padding = nativeRegionCompositeCoveragePadding(
      this.logicalSide, resolution, worldScale, viewport, steadyView,
    )
    if (padding === this.compositePadding && this.logicalSide === this.compositeSide) return
    writeNativeRegionCompositeQuad(this.compositeVertices, this.compositeUvs, this.logicalSide, padding)
    this.composite.geometry.getBuffer('aUV').update()
    this.compositePadding = padding
    this.compositeSide = this.logicalSide
  }

  get targetLogicalSide(): number {
    return this.logicalSide
  }

  get targetPhysicalSide(): number {
    return this.physicalSide
  }

  destroy(): void {
    this.root.removeChild(this.composite)
    this.sourceContainer.destroy({ children: true })
    destroyOwnedMeshGeometry(this.composite)
    this.composite.destroy()
    this.renderTexture.destroy(true)
  }

  private syncSourceSprites(
    sources: readonly NativeBoneyardLightSource[],
    topLeft: Readonly<{ x: number; y: number }>,
  ): void {
    while (this.sourceSprites.length < sources.length) {
      const sprite = new Sprite(this.glyph)
      sprite.eventMode = 'none'
      this.sourceSprites.push(sprite)
      this.sourceContainer.addChild(sprite)
    }
    for (let index = 0; index < this.sourceSprites.length; index += 1) {
      const sprite = this.sourceSprites[index]
      const source = sources[index]
      sprite.visible = Boolean(source)
      if (!source) continue
      const stamp = nativeRegionLightStamp(source, {
        x: source.position.x - topLeft.x,
        y: source.position.y - topLeft.y,
      }, this.glyphRef, 1)
      sprite.alpha = stamp.alpha
      sprite.anchor.set(stamp.anchorX, stamp.anchorY)
      sprite.position.set(stamp.x, stamp.y)
      sprite.scale.set(stamp.scale)
    }
  }
}
