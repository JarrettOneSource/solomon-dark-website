import { Container, Graphics, Sprite, type Texture } from 'pixi.js'

import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import type { BoneyardEnemyEventSnapshot } from '../protocol/game-state.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { nativeImpContactFireBurstSample } from './native-enemy-attack-effect.ts'
import {
  nativeEnemyPresentationPlan,
  type NativeEnemyFamily,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'

interface ManagedEnemyView {
  family: NativeEnemyFamily
  view: NativeEnemyView
}

export class NativeEnemyViews {
  private readonly attackBursts = new Map<number, NativeEnemyAttackBurstView>()
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, ManagedEnemyView>()

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(enemies: readonly NativeEnemyVisualSnapshot[], tick: number): void {
    const liveIds = this.liveIds
    liveIds.clear()
    for (const enemy of enemies) {
      liveIds.add(enemy.id)
      let managed = this.views.get(enemy.id)
      if (managed && managed.family !== enemy.enemyToken) {
        managed.view.destroy()
        this.views.delete(enemy.id)
        managed = undefined
      }
      if (!managed) {
        const view = new NativeEnemyView(this.root, this.textures, enemy, tick)
        managed = { family: enemy.enemyToken, view }
        this.views.set(enemy.id, managed)
      } else {
        managed.view.update(enemy, tick)
      }
    }
    for (const [id, managed] of this.views) {
      if (liveIds.has(id)) continue
      managed.view.destroy()
      this.views.delete(id)
    }
    for (const [eventId, burst] of this.attackBursts) {
      if (burst.update(tick)) continue
      burst.destroy()
      this.attackBursts.delete(eventId)
    }
  }

  consumeEvent(event: BoneyardEnemyEventSnapshot): void {
    if (event.type !== 'attack-marker' || this.attackBursts.has(event.eventId)) return
    const managed = this.views.get(event.actorId)
    if (!managed || managed.family !== 'IMP') return
    this.attackBursts.set(event.eventId, new NativeEnemyAttackBurstView(
      this.root,
      this.textures,
      event.eventId,
      event.tick,
      managed.view.effectOrigin(15),
      managed.view.depth,
    ))
  }

  setDepth(id: number, depth: number): void {
    this.views.get(id)?.view.setDepth(depth)
  }

  setTint(id: number, tint: number): void {
    this.views.get(id)?.view.setTint(tint)
  }

  setRenderable(renderable: boolean): void {
    for (const managed of this.views.values()) managed.view.setRenderable(renderable)
    for (const burst of this.attackBursts.values()) burst.setRenderable(renderable)
  }

  bodyEntry(id: number): number | null {
    return this.views.get(id)?.view.bodyEntry ?? null
  }

  limbsEntry(id: number): number | null {
    return this.views.get(id)?.view.limbsEntry ?? null
  }

  get size(): number {
    return this.views.size
  }

  get attackBurstCount(): number {
    return this.attackBursts.size
  }

  destroy(): void {
    for (const managed of this.views.values()) managed.view.destroy()
    this.views.clear()
    for (const burst of this.attackBursts.values()) burst.destroy()
    this.attackBursts.clear()
    this.liveIds.clear()
  }
}

class NativeEnemyView {
  private readonly container: Container
  private readonly segments: Graphics
  private readonly root: Container
  private readonly sprites: Sprite[] = []
  private readonly textures: BoneyardWorldTextures
  private renderedBodyEntry: number | null = null
  private renderedLimbsEntry: number | null = null
  private headingDeg = 0

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    enemy: NativeEnemyVisualSnapshot,
    tick: number,
  ) {
    this.root = root
    this.textures = textures
    this.container = new Container({
      label: `enemy:${enemy.enemyToken}:${enemy.id}`,
    })
    this.container.eventMode = 'none'
    this.segments = new Graphics({ label: `enemy-segments:${enemy.id}` })
    this.segments.eventMode = 'none'
    this.container.addChild(this.segments)
    root.addChild(this.container)
    this.update(enemy, tick)
  }

  update(enemy: NativeEnemyVisualSnapshot, tick: number): void {
    const plan = nativeEnemyPresentationPlan(
      enemy,
      tick,
      (atlas, entry) => nativeEnemySpriteRecord(atlas, entry).points,
    )
    this.renderedBodyEntry = plan.layers.find(({ role }) => (
      role.endsWith('-body')
    ))?.entry ?? null
    this.renderedLimbsEntry = plan.layers.find(({ role }) => (
      role.endsWith('-limbs')
    ))?.entry ?? null
    this.segments.clear()
    for (const segment of plan.segments) {
      this.segments
        .moveTo(segment.start.x, segment.start.y)
        .lineTo(segment.end.x, segment.end.y)
        .stroke({
          alpha: segment.alpha,
          color: segment.tint,
          width: segment.width,
        })
    }
    while (this.sprites.length < plan.layers.length) {
      const sprite = new Sprite()
      sprite.eventMode = 'none'
      this.sprites.push(sprite)
      this.container.addChild(sprite)
    }
    while (this.sprites.length > plan.layers.length) {
      const sprite = this.sprites.pop()!
      this.container.removeChild(sprite)
      sprite.destroy()
    }
    plan.layers.forEach((layer, index) => {
      const record = nativeEnemySpriteRecord(layer.atlas, layer.entry)
      const sprite = this.sprites[index]
      sprite.label = `${layer.role}:${layer.atlas}:${layer.entry}`
      sprite.texture = requiredTexture(this.textures, record.source)
      sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
      sprite.position.set(layer.offset.x, layer.offset.y)
      sprite.scale.set(layer.scaleX ?? layer.scale, layer.scaleY ?? layer.scale)
      sprite.rotation = layer.rotationRadians
      sprite.alpha = layer.alpha
      sprite.blendMode = layer.blendMode
      sprite.tint = layer.tint
    })
    this.container.position.set(enemy.position.x, enemy.position.y)
    this.headingDeg = enemy.headingDeg
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  get bodyEntry(): number | null {
    return this.renderedBodyEntry
  }

  get limbsEntry(): number | null {
    return this.renderedLimbsEntry
  }

  get depth(): number {
    return this.container.zIndex
  }

  effectOrigin(distance: number): Readonly<{ x: number; y: number }> {
    const radians = this.headingDeg * Math.PI / 180
    return {
      x: this.container.position.x + Math.sin(radians) * distance,
      y: this.container.position.y - Math.cos(radians) * distance - 1,
    }
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

class NativeEnemyAttackBurstView {
  private readonly basePosition: Readonly<{ x: number; y: number }>
  private readonly container: Container
  private readonly eventId: number
  private readonly frame: Sprite
  private readonly glow: Sprite
  private readonly root: Container
  private readonly spawnTick: number
  private readonly textures: BoneyardWorldTextures

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    eventId: number,
    spawnTick: number,
    position: Readonly<{ x: number; y: number }>,
    depth: number,
  ) {
    this.root = root
    this.textures = textures
    this.eventId = eventId
    this.spawnTick = spawnTick
    this.basePosition = { ...position }
    this.container = new Container({ label: `imp-contact-fire-burst:${eventId}` })
    this.container.eventMode = 'none'
    this.container.position.set(position.x, position.y)
    this.container.zIndex = depth + 0.01
    this.glow = new Sprite()
    this.frame = new Sprite()
    this.glow.label = `imp-contact-fire-burst-glow:${eventId}`
    this.frame.label = `imp-contact-fire-burst-frame:${eventId}`
    this.glow.eventMode = 'none'
    this.frame.eventMode = 'none'
    this.container.addChild(this.glow, this.frame)
    root.addChild(this.container)
    this.update(spawnTick)
  }

  update(tick: number): boolean {
    const age = Math.max(0, tick - this.spawnTick)
    const sample = nativeImpContactFireBurstSample(this.eventId, age)
    if (!sample) return false
    const glowRecord = nativeEnemySpriteRecord('BadGuys', 110)
    const frameRecord = nativeEnemySpriteRecord(
      'BadGuys',
      sample.frameEntry,
    )
    configureBurstSprite(this.glow, glowRecord, this.textures)
    configureBurstSprite(this.frame, frameRecord, this.textures)
    this.container.position.set(
      this.basePosition.x,
      this.basePosition.y + sample.verticalOffset,
    )
    this.glow.alpha = sample.glowAlpha
    this.glow.scale.set(sample.scale * 5)
    this.glow.tint = 0xff8000
    this.frame.alpha = 1
    this.frame.blendMode = 'add'
    this.frame.rotation = sample.frameRotationRadians
    this.frame.scale.set(sample.scale)
    this.frame.tint = 0xffffbf
    return true
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function configureBurstSprite(
  sprite: Sprite,
  record: ReturnType<typeof nativeEnemySpriteRecord>,
  textures: BoneyardWorldTextures,
): void {
  sprite.texture = requiredTexture(textures, record.source)
  sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
}


function requiredTexture(
  textures: BoneyardWorldTextures,
  source: string,
): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native enemy texture was not loaded: ${source}`)
  return texture
}
