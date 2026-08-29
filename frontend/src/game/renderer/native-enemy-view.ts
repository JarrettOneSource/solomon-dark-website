import { Container, Graphics, Sprite, type Texture } from 'pixi.js'

import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import type { BoneyardEnemyEventSnapshot } from '../protocol/game-state.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import {
  nativeEnemyRawFireBurstSample,
  nativeEnemyRawFireBurstPainterPolicy,
  nativeDemonBombMuzzleOrigin,
  nativeImpContactBurstOrigin,
  nativeImpLandingFlarePainterPolicy,
  nativeImpLandingFlareSample,
  type NativeEnemyAuxiliaryPainterPolicy,
  type NativeEnemyRawFireBurstKind,
} from './native-enemy-attack-effect.ts'
import {
  nativeEnemyPresentationPlan,
  type NativeEnemyFamily,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'

interface ManagedEnemyView {
  family: NativeEnemyFamily
  view: NativeEnemyView
}

export interface NativeEnemyAuxiliaryPainterLayer extends NativeEnemyAuxiliaryPainterPolicy {
  readonly eventId: number
  readonly id: string
  readonly registration: NativeWorldManagerRegistration | null
  readonly worldY: number
}

interface NativeEnemyAuxiliaryEffectView {
  destroy(): void
  painterLayer(): NativeEnemyAuxiliaryPainterLayer
  setDepth(depth: number): void
  setRenderable(renderable: boolean): void
  update(tick: number): boolean
}

export class NativeEnemyViews {
  private readonly auxiliaryEffects = new Map<number, NativeEnemyAuxiliaryEffectView>()
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly preWorldRoot: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, ManagedEnemyView>()

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    preWorldRoot: Container = root,
  ) {
    this.root = root
    this.preWorldRoot = preWorldRoot
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
    for (const [eventId, effect] of this.auxiliaryEffects) {
      if (effect.update(tick)) continue
      effect.destroy()
      this.auxiliaryEffects.delete(eventId)
    }
  }

  consumeEvent(event: BoneyardEnemyEventSnapshot): void {
    if (this.auxiliaryEffects.has(event.eventId)) return
    const managed = this.views.get(event.actorId)
    if (!managed) return
    if (
      event.type === 'enemy-action-sound'
      && managed.family === 'IMP'
      && event.sound?.startsWith('imp-vocal-')
    ) {
      this.auxiliaryEffects.set(event.eventId, new NativeImpLandingFlareView(
        this.preWorldRoot,
        this.textures,
        event.eventId,
        event.tick,
        managed.view.position,
      ))
      return
    }
    if (event.type !== 'attack-marker') return
    if (managed.family !== 'IMP' && managed.family !== 'DEMON') return
    const kind: NativeEnemyRawFireBurstKind = managed.family === 'IMP'
      ? 'imp-contact'
      : 'demon-bomb-muzzle'
    const position = kind === 'imp-contact'
      ? managed.view.impContactOrigin()
      : managed.view.demonBombMuzzleOrigin()
    if (kind === 'imp-contact' && event.painterRegistration === undefined) {
      throw new Error('Imp contact effect lost its transient painter registration')
    }
    this.auxiliaryEffects.set(event.eventId, new NativeEnemyRawFireBurstView(
      this.root,
      this.textures,
      kind,
      event.painterRegistration ?? null,
      event.eventId,
      event.tick,
      position,
    ))
  }

  painterLayers(): readonly NativeEnemyAuxiliaryPainterLayer[] {
    return [...this.auxiliaryEffects.values()].map((effect) => effect.painterLayer())
  }

  setAuxiliaryEffectDepth(eventId: number, depth: number): void {
    this.auxiliaryEffects.get(eventId)?.setDepth(depth)
  }

  setDepth(id: number, depth: number): void {
    this.views.get(id)?.view.setDepth(depth)
  }

  setTint(id: number, tint: number): void {
    this.views.get(id)?.view.setTint(tint)
  }

  setRenderable(renderable: boolean): void {
    for (const managed of this.views.values()) managed.view.setRenderable(renderable)
    for (const effect of this.auxiliaryEffects.values()) effect.setRenderable(renderable)
  }

  bodyEntry(id: number): number | null {
    return this.views.get(id)?.view.bodyEntry ?? null
  }

  limbsEntry(id: number): number | null {
    return this.views.get(id)?.view.limbsEntry ?? null
  }

  scale(id: number): number | null {
    return this.views.get(id)?.view.scale ?? null
  }

  get size(): number {
    return this.views.size
  }

  get auxiliaryEffectCount(): number {
    return this.auxiliaryEffects.size
  }

  destroy(): void {
    for (const managed of this.views.values()) managed.view.destroy()
    this.views.clear()
    for (const effect of this.auxiliaryEffects.values()) effect.destroy()
    this.auxiliaryEffects.clear()
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
  private demonMuzzleOffset: Readonly<{ x: number; y: number }> | null = null

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
    const demonController = plan.layers.find(({ role }) => role === 'demon-controller-body')
    if (demonController) {
      const points = nativeEnemySpriteRecord(
        demonController.atlas,
        demonController.entry,
      ).points
      const muzzle = points[5]
      if (!muzzle) throw new Error(`Demon controller ${demonController.entry} lacks point 5`)
      this.demonMuzzleOffset = nativeDemonBombMuzzleOrigin(
        { x: 0, y: 0 },
        enemy.headingDeg,
        { x: muzzle.x + demonController.offset.x, y: muzzle.y },
        demonController.offset.y,
      )
    } else {
      this.demonMuzzleOffset = null
    }
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
    this.container.scale.set(enemy.scale)
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

  get position(): Readonly<{ x: number; y: number }> {
    return { x: this.container.position.x, y: this.container.position.y }
  }

  get scale(): number {
    return this.container.scale.x
  }

  impContactOrigin(): Readonly<{ x: number; y: number }> {
    return nativeImpContactBurstOrigin(this.position, this.headingDeg)
  }

  demonBombMuzzleOrigin(): Readonly<{ x: number; y: number }> {
    if (!this.demonMuzzleOffset) throw new Error('Demon bomb marker has no controller point 5')
    return {
      x: this.container.position.x + this.demonMuzzleOffset.x,
      y: this.container.position.y + this.demonMuzzleOffset.y,
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

class NativeEnemyRawFireBurstView {
  private readonly basePosition: Readonly<{ x: number; y: number }>
  private readonly container: Container
  private readonly eventId: number
  private readonly frame: Sprite
  private readonly glow: Sprite
  private readonly kind: NativeEnemyRawFireBurstKind
  private readonly registration: NativeWorldManagerRegistration | null
  private readonly root: Container
  private readonly spawnTick: number
  private readonly textures: BoneyardWorldTextures

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    kind: NativeEnemyRawFireBurstKind,
    registration: NativeWorldManagerRegistration | null,
    eventId: number,
    spawnTick: number,
    position: Readonly<{ x: number; y: number }>,
  ) {
    this.root = root
    this.textures = textures
    this.eventId = eventId
    this.kind = kind
    this.registration = registration
    this.spawnTick = spawnTick
    this.basePosition = { ...position }
    this.container = new Container({ label: `${kind}-fire-burst:${eventId}` })
    this.container.eventMode = 'none'
    this.container.position.set(position.x, position.y)
    this.glow = new Sprite()
    this.frame = new Sprite()
    this.glow.label = `${kind}-fire-burst-glow:${eventId}`
    this.frame.label = `${kind}-fire-burst-frame:${eventId}`
    this.glow.eventMode = 'none'
    this.frame.eventMode = 'none'
    this.container.addChild(this.glow, this.frame)
    root.addChild(this.container)
    this.update(spawnTick)
  }

  update(tick: number): boolean {
    const age = Math.max(0, tick - this.spawnTick)
    const sample = nativeEnemyRawFireBurstSample(this.kind, this.eventId, age)
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

  painterLayer(): NativeEnemyAuxiliaryPainterLayer {
    return {
      eventId: this.eventId,
      id: `enemy-auxiliary-effect:${this.eventId}`,
      registration: this.registration,
      ...nativeEnemyRawFireBurstPainterPolicy(this.kind),
      worldY: this.container.position.y,
    }
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

class NativeImpLandingFlareView {
  private readonly eventId: number
  private readonly position: Readonly<{ x: number; y: number }>
  private readonly root: Container
  private readonly spawnTick: number
  private readonly sprite = new Sprite()
  private readonly textures: BoneyardWorldTextures

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
    eventId: number,
    spawnTick: number,
    position: Readonly<{ x: number; y: number }>,
  ) {
    this.root = root
    this.textures = textures
    this.eventId = eventId
    this.spawnTick = spawnTick
    this.position = { ...position }
    this.sprite.eventMode = 'none'
    this.sprite.label = `imp-landing-flare:${eventId}`
    root.addChild(this.sprite)
    this.update(spawnTick)
  }

  update(tick: number): boolean {
    const sample = nativeImpLandingFlareSample(
      this.eventId,
      Math.max(0, tick - this.spawnTick),
    )
    if (!sample) return false
    configureBurstSprite(
      this.sprite,
      nativeEnemySpriteRecord('BadGuys', 15),
      this.textures,
    )
    this.sprite.position.set(this.position.x, this.position.y)
    this.sprite.alpha = sample.alpha
    this.sprite.blendMode = 'add'
    this.sprite.scale.set(sample.scaleX, sample.scaleY)
    this.sprite.tint = 0xff0000 | (Math.round(sample.green * 255) << 8)
    return true
  }

  painterLayer(): NativeEnemyAuxiliaryPainterLayer {
    return {
      eventId: this.eventId,
      id: `enemy-auxiliary-effect:${this.eventId}`,
      registration: null,
      ...nativeImpLandingFlarePainterPolicy(),
      worldY: this.position.y,
    }
  }

  setDepth(depth: number): void {
    this.sprite.zIndex = depth
  }

  setRenderable(renderable: boolean): void {
    this.sprite.renderable = renderable
  }

  destroy(): void {
    this.root.removeChild(this.sprite)
    this.sprite.destroy()
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
