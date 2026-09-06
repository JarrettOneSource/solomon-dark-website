import { Container, Sprite, type Texture } from 'pixi.js'
import { nativeEighteenWayFacingBucket } from '../core-kernels/boneyard-mage-lightning.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import type { NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'
import { createHeartmongerTendrils, heartmongerTendrilLayers, moveHeartmongerTendrils, type HeartmongerTendrils } from './native-heartmonger-tendrils.ts'

export class NativeHeartmongerTendrilView {
  private readonly container: Container
  private readonly sprites: Sprite[]
  private state: HeartmongerTendrils
  private shadowDirection: Readonly<BoneyardPoint> = { x: 0, y: 0 }
  private origin: Readonly<BoneyardPoint>

  constructor(root: Container, texture: Texture, enemy: NativeEnemyVisualSnapshot) {
    this.origin = enemy.position
    this.container = new Container({ label: `heartmonger-tendrils:${enemy.id}` })
    this.container.eventMode = 'none'
    const record = nativeEnemySpriteRecord('BadGuys', 19)
    this.sprites = Array.from({ length: 18 }, () => {
      const sprite = new Sprite(texture)
      sprite.eventMode = 'none'
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      this.container.addChild(sprite)
      return sprite
    })
    root.addChild(this.container)
    this.state = createHeartmongerTendrils(enemy.position, enemy.headingDeg,
      createNativeRng(enemy.id + enemy.spawnTick)).state
    this.update(enemy)
  }

  update(enemy: NativeEnemyVisualSnapshot): void {
    const phase = enemy.animation?.gaitPose ?? 0
    const entry = 200 + Math.trunc(phase) * 18 + nativeEighteenWayFacingBucket(enemy.headingDeg)
    const next = moveHeartmongerTendrils(this.state, phase, enemy.position,
      nativeEnemySpriteRecord('Heartmonger', entry).points)
    const moved = this.origin.x !== enemy.position.x || this.origin.y !== enemy.position.y
    this.origin = enemy.position
    if (next === this.state && !moved) return
    this.state = next
    this.draw()
  }

  setShadowDirection(direction: Readonly<BoneyardPoint>): void {
    if (direction.x === this.shadowDirection.x && direction.y === this.shadowDirection.y) return
    this.shadowDirection = direction
    this.draw()
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  destroy(): void {
    this.container.removeFromParent()
    this.container.destroy({ children: true })
  }

  private draw(): void {
    heartmongerTendrilLayers(this.state, this.origin, this.shadowDirection).forEach((layer, index) => {
      const sprite = this.sprites[index]!
      sprite.label = layer.role
      sprite.position.set(layer.offset.x, layer.offset.y)
      sprite.rotation = layer.rotationRadians
      sprite.tint = layer.tint
    })
  }
}
