import { Container, Sprite } from 'pixi.js'
import { nativeUiPixiFor } from '../../native-ui/pixi.ts'
import { hubInventoryFrameTiles, type HubInventoryItemFrame } from '../hub-inventory-item-frame.ts'
import { addAtlasSprite } from './drawing.ts'
import type { RenderContext } from './model.ts'

export function addInventoryItemFrame(context: RenderContext, layer: Container, frame: HubInventoryItemFrame): void {
  const [x, y, width, height] = frame.rect
  if (!frame.tiled) {
    const sprite = addAtlasSprite(context, layer, 'Inventory', frame.record, x, y)
    sprite.alpha = frame.alpha
    return
  }
  const adapter = nativeUiPixiFor(context.textures)
  const source = adapter.texture('Inventory', frame.record)
  const border = new Container({ label: `native-item-tiled-frame-${frame.record}`, eventMode: 'none' })
  border.position.set(x, y)
  border.alpha = frame.alpha
  for (const tile of hubInventoryFrameTiles(source.orig.width, source.orig.height, width, height, source.source.width, source.source.height)) {
    const sprite = new Sprite(adapter.slice('Inventory', frame.record, tile.sourceUv))
    sprite.position.set(tile.x, tile.y)
    border.addChild(sprite)
  }
  // The retained inventory surface owns sprites. Its shared adapter owns and
  // caches their derived textures; no texture/sprite allocation occurs per tick.
  layer.addChild(border)
}
