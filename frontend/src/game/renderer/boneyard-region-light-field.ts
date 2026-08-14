import {
  Container,
  RenderTexture,
  Sprite,
  type Renderer,
  type Texture,
} from 'pixi.js'

import { spriteRefFor } from '../../editor/assets.ts'
import type { Camera } from '../../editor/render.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import {
  NATIVE_REGION_LIGHT_ATLAS,
  NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
  NATIVE_REGION_LIGHT_ENTRY,
  nativeRegionLightStamp,
  type NativeBoneyardLightSource,
} from './boneyard-lighting.ts'

export class BoneyardRegionLightField {
  private readonly composite: Sprite
  private readonly glyph: Texture
  private readonly glyphRef
  private readonly renderTexture: RenderTexture
  private readonly root: Container
  private readonly sourceContainer = new Container({ label: 'boneyard-region-light-sources' })
  private readonly sourceSprites: Sprite[] = []

  constructor(
    root: Container,
    glyph: Texture,
    viewport: GameViewportLayout,
    resolution: number,
  ) {
    const glyphRef = spriteRefFor(
      NATIVE_REGION_LIGHT_ATLAS,
      NATIVE_REGION_LIGHT_ENTRY,
    )
    if (!glyphRef) throw new Error('Native Region light glyph is missing.')
    this.root = root
    this.glyph = glyph
    this.glyphRef = glyphRef
    this.sourceContainer.eventMode = 'none'
    this.renderTexture = RenderTexture.create({
      dynamic: true,
      height: viewport.height,
      resolution,
      width: viewport.width,
    })
    this.composite = new Sprite(this.renderTexture)
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
    this.syncSourceSprites(sources, camera, viewport)
    renderer.render({
      clear: true,
      clearColor: 0x000000,
      container: this.sourceContainer,
      target: this.renderTexture,
    })
    this.composite.position.set(
      camera.x - viewport.width / 2 / camera.zoom,
      camera.y - viewport.height / 2 / camera.zoom,
    )
    this.composite.scale.set(1 / camera.zoom)
  }

  resize(viewport: GameViewportLayout, resolution: number): void {
    this.renderTexture.resize(viewport.width, viewport.height, resolution)
  }

  destroy(): void {
    this.root.removeChild(this.composite)
    this.sourceContainer.destroy({ children: true })
    this.composite.destroy()
    this.renderTexture.destroy(true)
  }

  private syncSourceSprites(
    sources: readonly NativeBoneyardLightSource[],
    camera: Camera,
    viewport: GameViewportLayout,
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
        x: (source.position.x - camera.x) * camera.zoom + viewport.width / 2,
        y: (source.position.y - camera.y) * camera.zoom + viewport.height / 2,
      }, this.glyphRef, camera.zoom)
      sprite.alpha = stamp.alpha
      sprite.anchor.set(stamp.anchorX, stamp.anchorY)
      sprite.position.set(stamp.x, stamp.y)
      sprite.scale.set(stamp.scale)
    }
  }
}
