import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  EarthBoulderImpactView,
  EarthBoulderView,
} from './earth-boulder-view.ts'
import { AirPrimarySpellView } from './primary-spell-air-view.ts'
import { EtherPrimarySpellView } from './primary-spell-ether-view.ts'
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
  readonly containers: readonly Container[]
  readonly kind: string
  destroy(): void
  painterRoots(): readonly SpellPainterRoot[]
  setTint(tint: number): void
  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void
}

interface SpellPainterRoot {
  container: Container
  suffix: string
  worldY: number
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
        if ('position' in state) {
          view = state.kind === 'earth'
            ? new EarthBoulderView(state, this.textures.primarySpells.earth)
            : state.kind === 'ether'
              ? new EtherPrimarySpellView(state, {
                  core: this.textures.elementVfx.core[0],
                  ray: this.textures.elementVfx.ray[0],
                  spark: this.textures.elementVfx.spark[0],
                })
              : new ProjectileSpellView(state, this.textures)
        } else {
          view = state.kind === 'earth-impact'
            ? new EarthBoulderImpactView(state, this.textures.primarySpells.earth)
            : state.kind === 'water'
              ? new WaterPrimarySpellView(state, {
                  core: this.textures.primarySpells.frost.core,
                  glint: this.textures.primarySpells.frost.over,
                })
              : new AirPrimarySpellView(state, this.textures.primarySpells.air)
        }
        this.views.set(state.id, view)
        this.root.addChild(...view.containers)
      }
      view.update(state)
      for (const painterRoot of view.painterRoots()) {
        painterRoot.container.zIndex = hubWorldDepthForActor(painterRoot.worldY)
      }
    }
    for (const [id, view] of this.views) {
      if (this.liveIds.has(id)) continue
      this.views.delete(id)
      for (const container of view.containers) this.root.removeChild(container)
      view.destroy()
    }
  }

  painterLayers(): PrimarySpellPainterLayer[] {
    const layers: PrimarySpellPainterLayer[] = []
    for (const [id, view] of this.views) {
      for (const painterRoot of view.painterRoots()) {
        layers.push({
          id: painterRoot.suffix.length > 0
            ? `primary-spell:${id}:${painterRoot.suffix}`
            : `primary-spell:${id}`,
          sortBias: 0,
          sourceOrder: layers.length,
          worldY: painterRoot.worldY,
        })
      }
    }
    return layers
  }

  setDepth(id: string, depth: number): void {
    const parsed = parsePainterId(id)
    const view = this.views.get(parsed.numericId)
    const painterRoot = view?.painterRoots().find(({ suffix }) => suffix === parsed.suffix)
    if (painterRoot) painterRoot.container.zIndex = depth
  }

  setTint(id: string, tint: number): void {
    const { numericId } = parsePainterId(id)
    this.views.get(numericId)?.setTint(tint)
  }

  get count(): number {
    return this.views.size
  }

  get kinds(): readonly string[] {
    return [...this.views.values()].map((view) => view.kind)
  }

  destroy(): void {
    for (const view of this.views.values()) {
      for (const container of view.containers) this.root.removeChild(container)
      view.destroy()
    }
    this.views.clear()
    this.liveIds.clear()
  }
}

class ProjectileSpellView implements SpellView {
  readonly container: Container
  readonly containers: readonly Container[]
  private readonly extras: Sprite[] = []
  readonly kind: string
  private readonly main: Sprite
  private state: PrimarySpellProjectileState
  private readonly textures: PlayerWorldTextures

  constructor(state: PrimarySpellProjectileState, textures: PlayerWorldTextures) {
    this.state = state
    this.textures = textures
    this.kind = state.kind
    this.container = new Container({ label: state.kind })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.main = new Sprite(this.texture(state))
    this.main.anchor.set(0.5)
    this.main.eventMode = 'none'
    this.main.blendMode = 'add'
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
    if (state.kind === 'fire') {
      const phase = state.ageTicks * 0.35
      this.extras[0]?.position.set(Math.cos(phase) * 5, Math.sin(phase) * 5)
      this.extras[1]?.position.set(Math.cos(phase + Math.PI) * 8, Math.sin(phase + Math.PI) * 8)
    }
  }

  get worldY(): number {
    return this.state.position.y
  }

  painterRoots(): readonly SpellPainterRoot[] {
    return [{ container: this.container, suffix: '', worldY: this.worldY }]
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
      case 'earth': throw new Error('Earth projectiles require EarthBoulderView')
      case 'ether': throw new Error('Ether projectiles use EtherPrimarySpellView')
      case 'fire': {
        const frames = this.textures.primarySpells.fire
        return frames[Math.floor(state.ageTicks / 3) % frames.length]
      }
    }
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

function parsePainterId(id: string): { numericId: number; suffix: string } {
  const value = id.slice('primary-spell:'.length)
  const separator = value.indexOf(':')
  return separator < 0
    ? { numericId: Number(value), suffix: '' }
    : {
        numericId: Number(value.slice(0, separator)),
        suffix: value.slice(separator + 1),
      }
}
