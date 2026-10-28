import { Container, Sprite, Texture } from 'pixi.js'
import { nativeDeadSpiderEntry } from '../core-kernels/native-dead-spider.ts'
import type { BoneyardSpiderRemainsSnapshot } from '../protocol/spider-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'

export class NativeDeadSpiderViews {
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, { container: Container; body: Sprite; shadow: Sprite }>()
  private readonly liveIds = new Set<number>()

  constructor(preWorld: Container, textures: BoneyardWorldTextures) {
    this.root = preWorld
    this.textures = textures
  }

  update(remains: readonly BoneyardSpiderRemainsSnapshot[]): void {
    this.liveIds.clear()
    for (const actor of remains) {
      this.liveIds.add(actor.id)
      let view = this.views.get(actor.id)
      if (!view) {
        const container = new Container({ label: `dead-spider:${actor.id}` })
        const shadow = new Sprite(Texture.EMPTY)
        const body = new Sprite(Texture.EMPTY)
        shadow.tint = 0
        shadow.y = 1
        container.eventMode = 'none'
        container.addChild(shadow, body)
        this.root.addChild(container)
        view = { container, body, shadow }
        this.views.set(actor.id, view)
      }
      const entry = nativeDeadSpiderEntry(actor.state)
      view.container.visible = entry !== null && actor.state.life >= 10
      view.container.alpha = Math.min(1, Math.max(0, actor.state.life - 10))
      view.container.position.set(actor.state.position.x, actor.state.position.y)
      if (entry === null) continue
      const record = nativeEnemySpriteRecord('DeadHawg', entry)
      const texture = this.textures.base[record.source]
      if (!texture) throw new Error(`DeadSpider texture was not loaded: ${entry}`)
      for (const sprite of [view.shadow, view.body]) {
        sprite.texture = texture
        sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
        sprite.label = `DeadHawg:${entry}`
      }
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      view.container.removeFromParent()
      view.container.destroy({ children: true })
      this.views.delete(id)
    }
  }

  destroy(): void {
    for (const view of this.views.values()) {
      view.container.removeFromParent()
      view.container.destroy({ children: true })
    }
    this.views.clear()
    this.liveIds.clear()
  }
}
