import { Container, Graphics, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  PRIMARY_SPELL_AIR_LIFETIME_TICKS,
  PRIMARY_SPELL_AIR_REACH,
} from '../core-kernels/primary-spells.ts'
import { hubWorldDepthForActor } from './hub-render-contract.ts'
import { WaterPrimarySpellView } from './primary-spell-water-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export interface PrimarySpellPainterLayer {
  id: string
  sortBias: number
  sourceOrder: number
  worldY: number
}

interface SpellView {
  readonly container: Container
  readonly worldY: number
  destroy(): void
  setTint(tint: number): void
  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void
}

export class PrimarySpellWorldView {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly textures: PlayerWorldTextures
  private readonly views = new Map<number, SpellView>()

  constructor(root: Container, textures: PlayerWorldTextures) {
    this.root = root
    this.textures = textures
  }

  update(spells: PrimarySpellSimulationState, worldKey: string): void {
    this.liveIds.clear()
    for (const state of [...spells.projectiles, ...spells.transients]) {
      if (state.worldKey !== worldKey) continue
      this.liveIds.add(state.id)
      let view = this.views.get(state.id)
      if (!view) {
        view = 'position' in state
          ? new ProjectileSpellView(state, this.textures)
          : state.kind === 'water'
            ? new WaterPrimarySpellView(state, {
                core: this.textures.primarySpells.frost.core,
                glint: this.textures.primarySpells.frost.over,
              })
            : new TransientSpellView(state)
        this.views.set(state.id, view)
        this.root.addChild(view.container)
      }
      view.update(state)
      view.container.zIndex = hubWorldDepthForActor(view.worldY)
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      this.views.delete(id)
      this.root.removeChild(view.container)
      view.destroy()
    }
  }

  painterLayers(): PrimarySpellPainterLayer[] {
    return [...this.views.entries()].map(([id, view], sourceOrder) => ({
      id: `primary-spell:${id}`,
      sortBias: 0,
      sourceOrder,
      worldY: view.worldY,
    }))
  }

  setDepth(id: string, depth: number): void {
    const numericId = Number(id.slice('primary-spell:'.length))
    const view = this.views.get(numericId)
    if (view) view.container.zIndex = depth
  }

  setTint(id: string, tint: number): void {
    const numericId = Number(id.slice('primary-spell:'.length))
    this.views.get(numericId)?.setTint(tint)
  }

  get count(): number {
    return this.views.size
  }

  get kinds(): readonly string[] {
    return [...this.views.values()].map((view) => view.container.label)
  }

  destroy(): void {
    for (const view of this.views.values()) {
      this.root.removeChild(view.container)
      view.destroy()
    }
    this.views.clear()
    this.liveIds.clear()
  }
}

class ProjectileSpellView implements SpellView {
  readonly container: Container
  private readonly extras: Sprite[] = []
  private readonly main: Sprite
  private state: PrimarySpellProjectileState
  private readonly textures: PlayerWorldTextures

  constructor(state: PrimarySpellProjectileState, textures: PlayerWorldTextures) {
    this.state = state
    this.textures = textures
    this.container = new Container({ label: state.kind })
    this.container.eventMode = 'none'
    this.main = new Sprite(this.texture(state))
    this.main.anchor.set(0.5)
    this.main.eventMode = 'none'
    if (state.kind !== 'earth') this.main.blendMode = 'add'
    this.container.addChild(this.main)
    if (state.kind === 'fire') {
      const core = effectSprite(textures.elementVfx.core[0], 0.45, 0.65)
      const spark = effectSprite(textures.elementVfx.spark[0], 0.32, 0.8)
      this.extras.push(core, spark)
      this.container.addChild(core, spark)
    }
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('position' in state)) return
    this.state = state
    this.container.position.set(state.position.x, state.position.y)
    this.main.texture = this.texture(state)
    if (state.kind === 'earth') {
      this.main.scale.set(state.charge)
      this.main.rotation = state.ageTicks * 0.035
    } else if (state.kind === 'ether') {
      this.main.rotation = Math.atan2(state.direction.y, state.direction.x) + Math.PI / 2
      this.main.alpha = 0.92
    } else {
      const phase = state.ageTicks * 0.35
      this.extras[0]?.position.set(Math.cos(phase) * 5, Math.sin(phase) * 5)
      this.extras[1]?.position.set(Math.cos(phase + Math.PI) * 8, Math.sin(phase + Math.PI) * 8)
    }
  }

  get worldY(): number {
    return this.state.position.y
  }

  setTint(tint: number): void {
    this.main.tint = tint
    for (const extra of this.extras) extra.tint = tint
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.extras.length = 0
  }

  private texture(state: PrimarySpellProjectileState): Texture {
    switch (state.kind) {
      case 'earth': return this.textures.primarySpells.boulder
      case 'ether': return this.textures.primarySpells.magicMissile
      case 'fire': {
        const frames = this.textures.primarySpells.fire
        return frames[Math.floor(state.ageTicks / 3) % frames.length]
      }
    }
  }
}

class TransientSpellView implements SpellView {
  readonly container: Container
  private readonly graphics: Graphics[] = []
  private state: PrimarySpellTransientState

  constructor(state: PrimarySpellTransientState) {
    this.state = state
    this.container = new Container({ label: state.kind })
    this.container.eventMode = 'none'
    const points = lightningPoints(state)
    const glow = lightningStroke(points, 0x5da9ff, 7)
    glow.alpha = 0.45
    glow.blendMode = 'add'
    const core = lightningStroke(points, 0xeaf8ff, 2)
    core.blendMode = 'add'
    this.graphics.push(glow, core)
    this.container.addChild(glow, core)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state)) return
    this.state = state
    this.container.position.set(state.origin.x, state.origin.y)
    this.container.alpha = Math.max(0, 1 - state.ageTicks / PRIMARY_SPELL_AIR_LIFETIME_TICKS)
  }

  get worldY(): number {
    return this.state.origin.y + this.state.direction.y * PRIMARY_SPELL_AIR_REACH * 0.5
  }

  setTint(tint: number): void {
    for (const graphic of this.graphics) graphic.tint = tint
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.graphics.length = 0
  }
}

function effectSprite(texture: Texture, scale: number, alpha: number): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.scale.set(scale)
  sprite.alpha = alpha
  sprite.blendMode = 'add'
  sprite.eventMode = 'none'
  return sprite
}

function lightningPoints(state: PrimarySpellTransientState): readonly [number, number][] {
  const perpendicular = { x: -state.direction.y, y: state.direction.x }
  return Array.from({ length: 10 }, (_, index) => {
    const progress = index / 9
    const seed = hash(state.id, index)
    const jitter = index === 0 || index === 9
      ? 0
      : ((seed / 0xffff_ffff) * 2 - 1) * 13
    return [
      state.direction.x * PRIMARY_SPELL_AIR_REACH * progress + perpendicular.x * jitter,
      state.direction.y * PRIMARY_SPELL_AIR_REACH * progress + perpendicular.y * jitter,
    ]
  })
}

function lightningStroke(
  points: readonly [number, number][],
  color: number,
  width: number,
): Graphics {
  const graphics = new Graphics().moveTo(points[0][0], points[0][1])
  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index][0], points[index][1])
  }
  graphics.stroke({ color, width })
  graphics.eventMode = 'none'
  return graphics
}

function hash(id: number, salt: number): number {
  let value = (id ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  return Math.imul(value, 0x846ca68b) >>> 0
}
