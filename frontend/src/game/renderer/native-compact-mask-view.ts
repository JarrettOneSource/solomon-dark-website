import { Container, Matrix, RenderTexture, Sprite, type Renderer } from 'pixi.js'
import type { BoneyardBounds, BoneyardScene, BoneyardPoint } from '../core-kernels/boneyard.ts'
import { createNativeRng, drawNativeFloat } from '../core-kernels/native-rng.ts'
import { nativePlayerGroundLightTint } from '../core-kernels/native-skill-colors.ts'
import type { BoneyardSpiderRemainsSnapshot } from '../protocol/spider-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import type { BoneyardGroundLightPlayer } from './boneyard-environment-light-plan.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { renderNativeDiffuseMask } from './native-texture-color.ts'
import { compactGridCells } from './native-compact-grid.ts'
import { NativeCompactGroundSurface } from './native-compact-ground-surface.ts'

interface CompactMask {
  readonly id: string
  readonly entry: number
  readonly position: Readonly<BoneyardPoint>
  readonly rotation: number
  readonly scaleX: number
  readonly scaleY: number
  readonly alpha: number
  readonly dynamic: boolean
}

type CompactMaskRenderer = Pick<Renderer, 'render'>
type CompactMaskTextures = Pick<BoneyardWorldTextures, 'base'>

/** Arena +0x8F84: compact masks share a bounded, additive target per player. */
export class NativeCompactMaskView {
  private readonly root: Container
  private readonly ground: Container
  private readonly renderer: CompactMaskRenderer
  private readonly textures: CompactMaskTextures
  private readonly authored: readonly CompactMask[]
  private readonly surface: NativeCompactGroundSurface
  private readonly maximumColumn: number
  private readonly maximumRow: number
  private readonly groundSprites = new Map<string, Sprite>()
  private readonly targets = new Map<string, PlayerMaskTarget>()

  constructor(root: Container, ground: Container, renderer: CompactMaskRenderer, textures: CompactMaskTextures, scene: BoneyardScene) {
    this.surface = new NativeCompactGroundSurface(scene)
    this.root = root
    this.ground = ground
    this.renderer = renderer
    this.textures = textures
    this.maximumColumn = Math.trunc(Math.trunc(scene.bounds.w) / 50 + 0.5)
    this.maximumRow = Math.trunc(Math.trunc(scene.bounds.h) / 50 + 0.5)
    this.authored = scene.sprites.filter(sprite => sprite.atlasEntry >= 25 && sprite.atlasEntry <= 29).map(sprite => ({
      id: sprite.eid, entry: 114 + sprite.atlasEntry, position: sprite.pos,
      rotation: sprite.s0, scaleX: sprite.s1 * ((sprite.flags & 1) !== 0 ? 0.8 : 1),
      scaleY: sprite.s1, alpha: sprite.atlasEntry === 29 ? 1 : 0.75, dynamic: false,
    }))
  }

  specialSurfaceAt(point: Readonly<BoneyardPoint>, remains: readonly BoneyardSpiderRemainsSnapshot[]): boolean {
    return this.surface.contains(point, remains)
  }

  update(
    players: Readonly<Record<string, BoneyardGroundLightPlayer>>,
    remains: readonly BoneyardSpiderRemainsSnapshot[],
    bounds: Readonly<BoneyardBounds>,
    presentationFrame: number,
  ): void {
    const dynamic = remains.flatMap(({ id, state }): CompactMask[] => state.decal === null ? [] : [{
      id: `spider-decal:${id}`, entry: state.decal.entry, position: state.decal.position,
      rotation: state.decal.rotationDeg, scaleX: state.decal.scale, scaleY: state.decal.scale,
      alpha: state.decal.alpha, dynamic: true,
    }])
    const masks = [...this.authored, ...dynamic].filter(mask => intersects(mask, bounds))
    const liveGround = new Set<string>()
    for (const mask of masks) {
      if (!mask.dynamic) continue
      liveGround.add(mask.id)
      let sprite = this.groundSprites.get(mask.id)
      if (!sprite) {
        sprite = new Sprite()
        sprite.eventMode = 'none'
        sprite.label = mask.id
        sprite.zIndex = -0.5
        this.ground.addChild(sprite)
        this.groundSprites.set(mask.id, sprite)
      }
      applyMaskSprite(sprite, mask, this.textures)
    }
    for (const [id, sprite] of this.groundSprites) {
      if (liveGround.has(id)) continue
      sprite.removeFromParent()
      sprite.destroy()
      this.groundSprites.delete(id)
    }
    let slot = 0
    for (const [playerId, player] of Object.entries(players)) {
      const query = { x: player.position.x - 256, y: player.position.y - 256, w: 512, h: 512 }
      const queryCells = compactGridCells(query, this.maximumColumn, this.maximumRow)
      const candidates = masks.filter(mask => {
        const record = nativeEnemySpriteRecord('DeadHawg', mask.entry)
        const cells = compactGridCells({
          x: mask.position.x - record.width / 2, y: mask.position.y - record.height / 2,
          w: record.width, h: record.height,
        }, this.maximumColumn, this.maximumRow)
        return cells.left <= queryCells.right && cells.right >= queryCells.left
          && cells.top <= queryCells.bottom && cells.bottom >= queryCells.top
      })
      let target = this.targets.get(playerId)
      if (candidates.length === 0) {
        if (target) target.composite.visible = false
        slot += 1
        continue
      }
      if (!target) {
        target = new PlayerMaskTarget(this.root, this.textures)
        this.targets.set(playerId, target)
      }
      const sample = drawNativeFloat(createNativeRng(Math.trunc(presentationFrame) ^ slot), 0.050000011920928955)
      const tint = nativePlayerGroundLightTint(player.progression.selectedPrimarySkillId, player.progression.weldBuildId)
      target.update(this.renderer, candidates, player.position, tint, Math.fround(Math.fround(0.95) + sample.value), slot * 2 + 1)
      slot += 1
    }
    for (const [id, target] of this.targets) {
      if (players[id]) continue
      target.destroy()
      this.targets.delete(id)
    }
  }

  destroy(): void {
    for (const sprite of this.groundSprites.values()) { sprite.removeFromParent(); sprite.destroy() }
    for (const target of this.targets.values()) target.destroy()
    this.groundSprites.clear()
    this.targets.clear()
  }
}

class PlayerMaskTarget {
  readonly composite: Sprite
  private readonly target = RenderTexture.create({
    alphaMode: 'no-premultiply-alpha', dynamic: true, width: 256, height: 256, resolution: 1, scaleMode: 'linear',
  })
  private readonly masks = new Container()
  private readonly stamps: Sprite[] = []
  private readonly radialSource = new Container()
  private readonly radial: Sprite
  private readonly textures: CompactMaskTextures

  constructor(root: Container, textures: CompactMaskTextures) {
    this.textures = textures
    const radial = nativeEnemySpriteRecord('DeadHawg', 9)
    this.radial = new Sprite(textures.base[radial.source])
    this.radial.anchor.set(radial.anchorX / radial.width, radial.anchorY / radial.height)
    this.radial.scale.set(2.009999990463257)
    this.radial.position.set(128, 128)
    this.radial.blendMode = 'multiply'
    this.radialSource.addChild(this.radial)
    this.composite = new Sprite(this.target)
    this.composite.anchor.set(128.5 / 256)
    this.composite.scale.set(2.0250000953674316)
    this.composite.blendMode = 'add'
    this.composite.eventMode = 'none'
    this.composite.label = 'native-compact-player-mask'
    root.addChild(this.composite)
  }

  update(renderer: CompactMaskRenderer, masks: readonly CompactMask[], player: Readonly<BoneyardPoint>, tint: number, alpha: number, depth: number): void {
    while (this.stamps.length < masks.length) {
      const sprite = new Sprite()
      sprite.blendMode = 'add'
      this.masks.addChild(sprite)
      this.stamps.push(sprite)
    }
    for (let index = 0; index < this.stamps.length; index += 1) {
      const sprite = this.stamps[index]!
      sprite.visible = index < masks.length
      if (sprite.visible) applyMaskSprite(sprite, masks[index]!, this.textures)
    }
    renderNativeDiffuseMask(renderer, {
      clear: true, clearColor: [1, 1, 1, 0], container: this.masks, target: this.target,
      transform: new Matrix(0.5, 0, 0, 0.5, 128 - player.x * 0.5, 128 - player.y * 0.5),
    })
    renderer.render({ clear: false, container: this.radialSource, target: this.target })
    this.composite.visible = true
    this.composite.tint = tint
    this.composite.alpha = alpha
    this.composite.position.set(player.x, player.y)
    this.composite.zIndex = depth
  }

  destroy(): void {
    this.composite.removeFromParent()
    this.composite.destroy()
    this.masks.destroy({ children: true })
    this.radialSource.destroy({ children: true })
    this.target.destroy(true)
  }
}

function applyMaskSprite(sprite: Sprite, mask: CompactMask, textures: CompactMaskTextures): void {
  const record = nativeEnemySpriteRecord('DeadHawg', mask.entry)
  sprite.texture = textures.base[record.source]!
  sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
  sprite.position.set(mask.position.x, mask.position.y)
  sprite.scale.set(mask.scaleX, mask.scaleY)
  sprite.rotation = mask.rotation * Math.PI / 180
  sprite.alpha = mask.alpha
}

function intersects(mask: CompactMask, bounds: Readonly<BoneyardBounds>): boolean {
  const record = nativeEnemySpriteRecord('DeadHawg', mask.entry)
  return mask.position.x + record.width / 2 >= bounds.x
    && mask.position.y + record.height / 2 >= bounds.y
    && mask.position.x - record.width / 2 <= bounds.x + bounds.w
    && mask.position.y - record.height / 2 <= bounds.y + bounds.h
}
