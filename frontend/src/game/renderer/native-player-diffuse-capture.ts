import { Matrix, RenderTexture, type Container, type Renderer } from 'pixi.js'
import { renderNativeDiffuseMask } from './native-texture-color.ts'

export const NATIVE_PLAYER_DIFFUSE_TARGET_SIZE = 256

/** PlayerWizard::DrawSpecial captures the complete articulated wizard around (128,153). */
export class NativePlayerDiffuseCapture {
  private readonly transform = new Matrix(1, 0, 0, 1, 128, 153)
  private readonly renderer: Pick<Renderer, 'render'>
  private target: RenderTexture | null = null

  constructor(renderer: Pick<Renderer, 'render'>) {
    this.renderer = renderer
  }

  render(source: Container, excluded: readonly Container[]): RenderTexture {
    this.target ??= RenderTexture.create({
      alphaMode: 'no-premultiply-alpha', dynamic: true, resolution: 1,
      scaleMode: 'linear', height: NATIVE_PLAYER_DIFFUSE_TARGET_SIZE, width: NATIVE_PLAYER_DIFFUSE_TARGET_SIZE,
    })
    const visibility = excluded.map((child) => child.visible)
    for (const child of excluded) child.visible = false
    try {
      renderNativeDiffuseMask(this.renderer, {
        clear: true, clearColor: [1, 1, 1, 0], container: source,
        target: this.target, transform: this.transform,
      })
    } finally {
      excluded.forEach((child, index) => { child.visible = visibility[index]! })
    }
    return this.target
  }

  destroy(): void {
    this.target?.destroy(true)
    this.target = null
  }
}
