import { Container, Sprite, Texture } from 'pixi.js'

import type { BoneyardEnemyProjectileEffectSnapshot, BoneyardEnemyProjectileSnapshot } from '../protocol/game-state.ts'
import { nativePuppetHitAlpha, nativePuppetHitTimer, type NativeWorldPuppetHit } from '../core-kernels/native-puppet-hit.ts'
import { multiplyNativeTints, nativePuppetHitTint, setNativeDiffuseColor } from './native-texture-color.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { nativeEnemyProjectileLifetimeAlpha, nativeEnemyProjectilePlan } from './native-enemy-projectile-presentation.ts'
import type { NativeEnemyProjectileStreak, NativeEnemyProjectileLayer } from './native-enemy-projectile-presentation.ts'
import { createNativeSurfaceMesh, createNativeSurfaceRedraw, type NativeStaticSurfaceMesh } from './boneyard-building-surface-view.ts'

export class NativeEnemyProjectileViews {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly preWorldRoot: Container
  private readonly textures: BoneyardWorldTextures
  private readonly views = new Map<number, NativeEnemyProjectileView>()

  constructor(root: Container, textures: BoneyardWorldTextures, preWorldRoot: Container) {
    this.root = root
    this.preWorldRoot = preWorldRoot
    this.textures = textures
  }

  update(projectiles: readonly BoneyardEnemyProjectileSnapshot[], tick: number,
    effects: readonly BoneyardEnemyProjectileEffectSnapshot[] = [],
    hits?: ReadonlyMap<string, NativeWorldPuppetHit>, complexLighting = true): void {
    this.liveIds.clear()
    const trails = new Map<number, BoneyardEnemyProjectileEffectSnapshot[]>()
    for (const effect of effects) {
      if (effect.kind !== 'firebolt-trail') continue
      const owned = trails.get(effect.ownerProjectileId) ?? []
      owned.push(effect)
      trails.set(effect.ownerProjectileId, owned)
    }
    for (const projectile of projectiles) {
      this.liveIds.add(projectile.id)
      let view = this.views.get(projectile.id)
      if (!view) {
        view = new NativeEnemyProjectileView(this.root, this.textures, this.preWorldRoot)
        this.views.set(projectile.id, view)
      }
      view.update(projectile, tick, trails.get(projectile.id) ?? [], hits?.get(`projectile:${projectile.id}`), complexLighting)
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      view.destroy()
      this.views.delete(id)
    }
  }

  setDepth(id: number, depth: number): void {
    this.views.get(id)?.setDepth(depth)
  }

  setTint(id: number, tint: number): void {
    this.views.get(id)?.setTint(tint)
  }

  setRenderable(renderable: boolean): void {
    for (const view of this.views.values()) view.setRenderable(renderable)
  }

  get size(): number {
    return this.views.size
  }

  get ids(): readonly number[] {
    return [...this.views.keys()].sort((left, right) => left - right)
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy()
    this.views.clear()
    this.liveIds.clear()
  }
}

class NativeEnemyProjectileView {
  private readonly container: Container
  private readonly root: Container
  private readonly underlay = new Container({ label: 'enemy-projectile-underlay' })
  private readonly underlaySprites: Sprite[] = []
  private readonly sprites: Sprite[] = []
  private readonly hitContainer = new Container({ label: 'projectile-hit-main', eventMode: 'none' })
  private readonly hitSprites: Sprite[] = []
  private hitStreak: ReturnType<typeof createNativeSurfaceRedraw> | null = null
  private mainLayers: readonly NativeEnemyProjectileLayer[] = []
  private hitLayers: readonly NativeEnemyProjectileLayer[] = []
  private kind: BoneyardEnemyProjectileSnapshot['kind'] = 'arrow'
  private payload: BoneyardEnemyProjectileSnapshot['payload'] = 'normal'
  private worldTint = 0xffffff
  private streak: NativeStaticSurfaceMesh | null = null
  private readonly textures: BoneyardWorldTextures

  constructor(root: Container, textures: BoneyardWorldTextures, preWorldRoot: Container) {
    this.root = root
    this.textures = textures
    this.container = new Container({ label: 'enemy-projectile' })
    this.container.eventMode = 'none'
    root.addChild(this.container)
    this.underlay.eventMode = 'none'
    this.underlay.zIndex = 0.5
    preWorldRoot.addChild(this.underlay)
  }

  update(projectile: BoneyardEnemyProjectileSnapshot, tick: number,
    trails: readonly BoneyardEnemyProjectileEffectSnapshot[], hit: NativeWorldPuppetHit | undefined, complexLighting: boolean): void {
    const plan = nativeEnemyProjectilePlan(projectile, tick)
    this.kind = projectile.kind
    this.payload = projectile.payload
    this.updateStreak(plan.streak)
    this.mainLayers = [...plan.layers, ...trails.map(effect => ({
      alpha: effect.alpha * nativeEnemyProjectileLifetimeAlpha(projectile, Math.floor(projectile.ageTicks)),
      atlas: effect.atlas, blendMode: effect.blendMode, entry: effect.entry,
      offset: { x: effect.position.x - projectile.position.x, y: effect.position.y - projectile.position.y },
      role: 'firebolt-trail', rotationRadians: effect.rotationRadians, scale: effect.scale, scaleY: effect.scale, tint: effect.tint,
    }))]
    updateNativeProjectileSprites(this.container, this.sprites, this.mainLayers, this.textures)
    updateNativeProjectileSprites(this.underlay, this.underlaySprites, plan.underlays, this.textures)
    const activeHit = hit !== undefined && nativePuppetHitTimer(hit.feedback, tick) > 0
    const hitAlpha = hit === undefined ? 0 : nativePuppetHitAlpha(hit.feedback, tick)
    this.hitLayers = activeHit ? this.mainLayers.map((layer, index) => {
      const ownColor = projectile.kind === 'firebolt' || (projectile.kind === 'arrow' && index > 0)
      return { ...layer, role: `hit:${layer.role}`, textureColor: 'diffuse' as const,
        alpha: layer.alpha * (ownColor ? 1 : hitAlpha), tint: ownColor ? layer.tint : nativePuppetHitTint(complexLighting, layer.tint) }
    }) : []
    if (activeHit && this.streak !== null && this.hitStreak === null) {
      this.hitStreak = createNativeSurfaceRedraw(this.streak, false)
      this.hitStreak.mesh.label = 'hit:arrow-velocity-streak'
      this.hitContainer.addChildAt(this.hitStreak.mesh, 0)
    }
    if (this.hitStreak) this.hitStreak.mesh.visible = activeHit && plan.streak !== null
    updateNativeProjectileSprites(this.hitContainer, this.hitSprites, this.hitLayers, this.textures)
    this.hitContainer.visible = activeHit
    this.container.addChild(this.hitContainer)
    this.applyTint()
    this.underlay.position.set(plan.position.x, plan.position.y)
    this.container.label = `enemy-projectile:${projectile.kind}:${projectile.id}`
    this.container.position.set(plan.position.x, plan.position.y)
  }

  private updateStreak(plan: NativeEnemyProjectileStreak | null): void {
    if (plan === null) {
      if (this.streak) this.streak.mesh.visible = false
      return
    }
    if (!this.streak) {
      this.streak = createNativeSurfaceMesh(Texture.WHITE, {
        positions: new Float32Array(8),
        uvs: new Float32Array(8),
        indices: new Uint32Array([0, 1, 2, 2, 1, 3]),
        colors: new Uint8Array(16),
      })
      this.streak.mesh.label = 'arrow-velocity-streak'
      this.container.addChildAt(this.streak.mesh, 0)
    }
    const x = plan.end.x - plan.start.x
    const y = plan.end.y - plan.start.y
    const length = Math.hypot(x, y)
    const halfWidth = length === 0 ? 0 : plan.width / (2 * length)
    const normalX = -y * halfWidth
    const normalY = x * halfWidth
    const geometry = this.streak.mesh.geometry
    const positions = geometry.getBuffer('aPosition')
    positions.data.set([
      plan.start.x - normalX, plan.start.y - normalY,
      plan.start.x + normalX, plan.start.y + normalY,
      plan.end.x - normalX, plan.end.y - normalY,
      plan.end.x + normalX, plan.end.y + normalY,
    ])
    positions.update()
    const alpha = Math.round(plan.alpha * 255)
    this.streak.colors.set([
      128, 128, 128, alpha, 128, 128, 128, alpha,
      128, 128, 128, 0, 128, 128, 128, 0,
    ])
    geometry.getBuffer('aColor').update()
    this.streak.mesh.visible = true
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setTint(tint: number): void {
    this.worldTint = tint
    this.applyTint()
  }

  private applyTint(): void {
    const tint = (layer: NativeEnemyProjectileLayer, index: number): number => (
      this.kind === 'firebolt' || (this.kind === 'arrow' && this.payload === 'fire' && index > 0)
        ? layer.tint : multiplyNativeTints(layer.tint, this.worldTint)
    )
    this.mainLayers.forEach((layer, index) => { this.sprites[index]!.tint = tint(layer, index) })
    this.hitLayers.forEach((layer, index) => { this.hitSprites[index]!.tint = tint(layer, index) })
    if (this.streak) this.streak.mesh.tint = this.worldTint
    if (this.hitStreak) this.hitStreak.mesh.tint = this.worldTint
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
    this.underlay.renderable = renderable
  }

  destroy(): void {
    this.hitStreak?.destroy()
    this.streak?.destroy()
    this.underlay.destroy({ children: true })
    this.underlaySprites.length = 0
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
    this.sprites.length = 0
  }
}

function requiredTexture(textures: BoneyardWorldTextures, source: string): Texture {
  const texture = textures.base[source]
  if (!texture) throw new Error(`Native enemy projectile texture was not loaded: ${source}`)
  return texture
}

export function updateNativeProjectileSprites(
  container: Container,
  sprites: Sprite[],
  layers: readonly NativeEnemyProjectileLayer[],
  textures: BoneyardWorldTextures,
): void {
  while (sprites.length < layers.length) {
    const sprite = new Sprite()
    sprite.eventMode = 'none'
    sprites.push(sprite)
    container.addChild(sprite)
  }
  for (const [index, sprite] of sprites.entries()) {
    const layer = layers[index]
    sprite.visible = layer !== undefined
    if (!layer) continue
    const record = nativeEnemySpriteRecord(layer.atlas, layer.entry)
    sprite.label = `${layer.role}:${layer.atlas}:${layer.entry}`
    sprite.texture = requiredTexture(textures, record.source)
    sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
    sprite.alpha = layer.alpha
    sprite.blendMode = layer.blendMode
    sprite.position.set(layer.offset.x, layer.offset.y)
    sprite.rotation = layer.rotationRadians
    sprite.scale.set(layer.scale, layer.scaleY)
    sprite.tint = layer.tint
    setNativeDiffuseColor(sprite, layer.textureColor === 'diffuse')
  }
}
