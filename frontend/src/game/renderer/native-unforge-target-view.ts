import { Container, Graphics, RenderTexture, Sprite, type Renderer, type Texture } from 'pixi.js'
import {
  NATIVE_UNFORGE_CAPTURE_SIZE,
  NATIVE_UNFORGE_TARGET_RECORDS,
  nativeUnforgeTargetFrame,
  type NativeUnforgeTargetFrame,
} from './native-unforge-target.ts'

/** InventoryScreen 0x568B90: two scrolling UI77 images, UI76 multiply, then UI75. */
export class NativeUnforgeTargetView {
  readonly container = new Container({ label: 'native-unforge-target', eventMode: 'none' })
  private readonly target = RenderTexture.create({
    alphaMode: 'no-premultiply-alpha', dynamic: true,
    width: NATIVE_UNFORGE_CAPTURE_SIZE, height: NATIVE_UNFORGE_CAPTURE_SIZE,
    resolution: 1, scaleMode: 'linear',
  })
  private readonly capture = new Container({ eventMode: 'none' })
  private readonly images: readonly [Sprite, Sprite]
  private readonly marker: Sprite

  constructor(texture: (record: number) => Texture) {
    const initial = nativeUnforgeTargetFrame(0, 1, 1600, 900)
    const clipped = new Container({ eventMode: 'none' })
    const clip = new Graphics().rect(...initial.clip).fill(0xffffff)
    clipped.mask = clip
    this.images = [new Sprite(texture(NATIVE_UNFORGE_TARGET_RECORDS.image)), new Sprite(texture(NATIVE_UNFORGE_TARGET_RECORDS.image))]
    for (const image of this.images) image.anchor.set(0.5)
    const multiplyMask = new Sprite(texture(NATIVE_UNFORGE_TARGET_RECORDS.mask))
    multiplyMask.anchor.set(0.5)
    multiplyMask.position.set(NATIVE_UNFORGE_CAPTURE_SIZE / 2)
    multiplyMask.blendMode = 'multiply'
    clipped.addChild(...this.images, multiplyMask)
    this.capture.addChild(clipped, clip)

    const composite = new Sprite(this.target)
    // RenderToSprite's generated quad subtracts half a pixel from each vertex.
    composite.anchor.set(0.5 + 0.5 / NATIVE_UNFORGE_CAPTURE_SIZE)
    composite.label = 'native-unforge-fire'
    this.marker = new Sprite(texture(NATIVE_UNFORGE_TARGET_RECORDS.marker))
    this.marker.anchor.set(0.5)
    this.marker.label = 'native-unforge-marker'
    this.container.addChild(composite, this.marker)
  }

  update(renderer: Renderer, applicationTick: number, reveal: number, width: number, height: number): NativeUnforgeTargetFrame {
    const frame = nativeUnforgeTargetFrame(applicationTick, reveal, width, height)
    this.container.position.set(...frame.anchor)
    this.marker.tint = frame.markerTint
    this.images[0].position.set(...frame.imageCenters[0])
    this.images[1].position.set(...frame.imageCenters[1])
    renderer.render({ clear: true, clearColor: [0, 0, 0, 0], container: this.capture, target: this.target })
    return frame
  }

  destroy(): void {
    this.container.removeFromParent()
    this.container.destroy({ children: true })
    this.capture.destroy({ children: true })
    this.target.destroy(true)
  }
}
