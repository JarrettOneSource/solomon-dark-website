import { Container, Sprite, type Texture } from 'pixi.js'
import type { NativePlayerRescueProtection } from '../core-kernels/native-player-rescue.ts'
import { nativeSparkleScale, type NativeSparkleState } from '../core-kernels/native-sparkle.ts'
import { nativeEnemySpriteGeometry } from './native-enemy-assets.ts'

export class NativeRescueSparkleViews {
  private readonly views = new Map<string, { sprite: Sprite; particle: NativeSparkleState }>()

  constructor(private readonly root: Container, private readonly texture: Texture) {}

  update(
    players: Readonly<Record<string, { progression: { rescueProtection: NativePlayerRescueProtection } }>>,
    worldKey: string,
  ): void {
    const liveIds = new Set<string>()
    for (const [ownerId, player] of Object.entries(players)) {
      for (const particle of player.progression.rescueProtection.particles) {
        if (particle.worldKey !== worldKey) continue
        const id = `rescue-sparkle:${ownerId}:${particle.id}`
        liveIds.add(id)
        let view = this.views.get(id)
        if (!view) {
          const record = nativeEnemySpriteGeometry('BadGuys', 73)
          const sprite = new Sprite(this.texture)
          sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
          sprite.blendMode = 'add'
          sprite.eventMode = 'none'
          sprite.label = id
          this.root.addChild(sprite)
          view = { sprite, particle }
          this.views.set(id, view)
        }
        view.particle = particle
        view.sprite.position.copyFrom(particle.position)
        view.sprite.alpha = particle.alpha
        view.sprite.rotation = particle.rotationDegrees * Math.PI / 180
        view.sprite.scale.set(nativeSparkleScale(particle.timer))
        view.sprite.renderable = particle.alpha > 0 && particle.timer > 0
      }
    }
    for (const [id, view] of this.views) {
      if (liveIds.has(id)) continue
      this.root.removeChild(view.sprite)
      view.sprite.destroy()
      this.views.delete(id)
    }
  }

  painterLayers() {
    return [...this.views].map(([id, { particle, sprite }]) => {
      if (particle.painterRegistration === null) throw new Error(`rescue Sparkle ${id} lost its registration`)
      return { id, queueFamily: 'ordinary-dynamic' as const, registration: particle.painterRegistration,
        worldY: particle.position.y, sortBias: 0, target: sprite }
    })
  }

  setDepth(id: string, depth: number): void {
    const view = this.views.get(id)
    if (view) view.sprite.zIndex = depth
  }

  destroy(): void {
    for (const view of this.views.values()) {
      this.root.removeChild(view.sprite)
      view.sprite.destroy()
    }
    this.views.clear()
  }
}
