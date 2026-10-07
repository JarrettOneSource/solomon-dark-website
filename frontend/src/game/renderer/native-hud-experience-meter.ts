import { Graphics, Sprite, type Container, type Texture } from 'pixi.js'
import type { NativeHudPoint } from '../native-hud-layout.ts'

export function addNativeHudExperienceMeter(
  layer: Container,
  textures: { readonly fill: Texture; readonly frame: Texture },
  backpack: NativeHudPoint,
  progress: number,
): (progress: number) => void {
  const fillX = backpack.x + 67.5
  const fillY = backpack.y + 8
  const fill = new Sprite(textures.fill)
  fill.position.set(fillX, fillY)
  fill.width = 4
  fill.height = 48
  const mask = new Graphics()
  const frame = new Sprite(textures.frame)
  frame.position.set(backpack.x + 64, backpack.y + 4)
  frame.width = 12
  frame.height = 56
  layer.addChild(fill, mask, frame)
  fill.mask = mask
  let paintedProgress = -1
  const update = (nextProgress: number) => {
    if (nextProgress === paintedProgress) return
    paintedProgress = nextProgress
    mask.clear().rect(fillX, fillY + (1 - nextProgress) * 48, 4, nextProgress * 48)
      .fill(0xffffff)
  }
  update(progress)
  return update
}
