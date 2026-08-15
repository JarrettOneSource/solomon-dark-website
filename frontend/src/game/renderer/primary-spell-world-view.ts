import { Container } from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  EarthCalledRockView,
  EarthBoulderImpactView,
  EarthBoulderView,
} from './earth-boulder-view.ts'
import { AirPrimarySpellView } from './primary-spell-air-view.ts'
import {
  EtherPrimaryImpactView,
  EtherPrimaryPierceStreakView,
  EtherPrimarySpellView,
} from './primary-spell-ether-view.ts'
import {
  FireImpactSpellView,
  FireParticleSpellView,
  FirePrimarySpellView,
} from './primary-spell-fire-view.ts'
import { hubWorldDepthForActor } from './hub-render-contract.ts'
import { WaterPrimarySpellView } from './primary-spell-water-view.ts'
import { isNativePlayerStaffTransient } from '../core-kernels/native-player-staff-action.ts'
import {
  PlayerStaffPikeBreakView,
  PlayerStaffVfxView,
} from './player-staff-vfx-view.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export interface PrimarySpellPainterLayer {
  id: string
  lane: 'post-world-queue' | 'world-sorted'
  queueFamily: 'ordinary-dynamic' | 'zanim' | null
  regionLightPoint: { x: number, y: number } | null
  sortBias: number
  sourceOrder: number
  worldY: number
}

interface SpellView {
  readonly containers: readonly Container[]
  readonly kind: string
  destroy(): void
  painterRoots(): readonly SpellPainterRoot[]
  setTint(suffix: string, tint: number): void
  update(
    state: PrimarySpellProjectileState | PrimarySpellTransientState,
    presentationFrame?: number,
  ): void
}

interface SpellPainterRoot {
  container: Container
  lane: 'post-world-queue' | 'world-sorted'
  overlayOwnerId?: string
  queueFamily: 'ordinary-dynamic' | 'zanim' | null
  regionLightPoint: { x: number, y: number } | null
  sortBias: number
  suffix: string
  worldY: number
}

export class PrimarySpellWorldView {
  private readonly liveIds = new Set<number>()
  private readonly root: Container
  private readonly postWorldQueueDepth: number | null
  private readonly textures: PlayerWorldTextures
  private readonly views = new Map<number, SpellView>()

  constructor(
    root: Container,
    textures: PlayerWorldTextures,
    options: { postWorldQueueDepth?: number } = {},
  ) {
    this.root = root
    this.textures = textures
    this.postWorldQueueDepth = options.postWorldQueueDepth ?? null
  }

  update(
    spells: PrimarySpellSimulationState,
    worldKey: string,
    presentationFrame?: number,
  ): void {
    this.liveIds.clear()
    for (const state of [...spells.projectiles, ...spells.transients]) {
      if (state.worldKey !== worldKey) continue
      if (isNativePlayerStaffTransient(state) && (
        state.kind !== 'player-staff-smoke'
        && state.kind !== 'player-staff-move-fade'
        && state.kind !== 'player-staff-perspective-fade'
        && state.kind !== 'player-staff-pike-break'
      )) continue
      this.liveIds.add(state.id)
      let view = this.views.get(state.id)
      if (!view) {
        if (state.kind === 'player-staff-pike-break') {
          view = new PlayerStaffPikeBreakView(state, this.textures)
        } else if (
          state.kind === 'player-staff-smoke'
          || state.kind === 'player-staff-move-fade'
          || state.kind === 'player-staff-perspective-fade'
        ) {
          view = new PlayerStaffVfxView(state, this.textures)
        } else if (state.kind === 'earth-called-rock') {
          view = new EarthCalledRockView(state, this.textures.primarySpells.earth)
        } else if ('position' in state) {
          view = state.kind === 'earth'
            ? new EarthBoulderView(state, this.textures.primarySpells.earth)
            : state.kind === 'ether'
              ? new EtherPrimarySpellView(state, {
                  core: this.textures.elementVfx.core[0],
                  ray: this.textures.elementVfx.ray[0],
                  spark: this.textures.elementVfx.spark[0],
                })
              : new FirePrimarySpellView(state, this.textures.primarySpells.fire)
        } else if (state.kind === 'ether-impact') {
          view = new EtherPrimaryImpactView(state, {
            core: this.textures.elementVfx.core[0],
            ray: this.textures.elementVfx.ray[0],
            spark: this.textures.elementVfx.spark[0],
          })
        } else if (state.kind === 'ether-pierce-streak') {
          view = new EtherPrimaryPierceStreakView(
            state,
            this.textures.primarySpells.etherPierceStreak,
          )
        } else if (state.kind === 'earth-impact') {
          view = new EarthBoulderImpactView(state, this.textures.primarySpells.earth)
        } else if (state.kind === 'fire-impact') {
          view = new FireImpactSpellView(state, this.textures.primarySpells.fire)
        } else if (state.kind === 'water') {
          view = new WaterPrimarySpellView(state, {
            core: this.textures.primarySpells.frost.core,
            glint: this.textures.primarySpells.frost.over,
          })
        } else if (state.kind === 'air') {
          view = new AirPrimarySpellView(state, this.textures.primarySpells.air)
        } else if (state.kind === 'fire') {
          view = new FireParticleSpellView(state, this.textures.primarySpells.fire)
        } else {
          throw new Error('Unsupported primary spell presentation')
        }
        this.views.set(state.id, view)
        this.root.addChild(...view.containers)
      }
      view.update(state, presentationFrame)
      for (const painterRoot of view.painterRoots()) {
        painterRoot.container.zIndex = painterRoot.lane === 'post-world-queue'
          && this.postWorldQueueDepth !== null
          ? this.postWorldQueueDepth
          : hubWorldDepthForActor(painterRoot.worldY + painterRoot.sortBias)
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
          lane: painterRoot.lane,
          queueFamily: painterRoot.queueFamily,
          regionLightPoint: painterRoot.regionLightPoint,
          sortBias: painterRoot.sortBias,
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
    const { numericId, suffix } = parsePainterId(id)
    this.views.get(numericId)?.setTint(suffix, tint)
  }

  setRenderable(renderable: boolean): void {
    for (const view of this.views.values()) {
      for (const container of view.containers) container.renderable = renderable
    }
  }

  promoteOwnerOverlays(ownerDepth: (ownerId: string) => number | undefined): void {
    for (const view of this.views.values()) {
      for (const painterRoot of view.painterRoots()) {
        if (!painterRoot.overlayOwnerId) continue
        const depth = ownerDepth(painterRoot.overlayOwnerId)
        if (depth === undefined) continue
        painterRoot.container.zIndex = Math.max(painterRoot.container.zIndex, depth + 0.5)
      }
    }
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
