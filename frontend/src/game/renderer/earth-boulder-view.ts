import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellEarthCalledRockState,
  PrimarySpellEarthImpactState,
  PrimarySpellEarthProjectileState,
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import { earthImpactFragmentCount } from '../core-kernels/primary-spell-earth.ts'
import {
  EARTH_BOULDER_LIT_RECORDS,
  EARTH_BOULDER_MAIN_RECORDS,
  earthBoulderImpactPlan,
  earthBoulderPresentationPlan,
} from './earth-boulder-presentation.ts'

export interface EarthBoulderTextures {
  aura: Texture
  litRocks: readonly Texture[]
  openingFlash: Texture
  rocks: readonly Texture[]
}

export class EarthBoulderView {
  readonly container: Container
  readonly containers: readonly Container[]
  readonly kind = 'earth'
  private readonly body = new Container({ label: 'earth-boulder-body' })
  private readonly aura: Sprite
  private readonly openingFlash: Sprite
  private readonly rockSprites: Sprite[] = []
  private readonly visual = new Container({ label: 'earth-boulder-visual' })
  private state: PrimarySpellEarthProjectileState
  private sortBias = 0
  private readonly textures: EarthBoulderTextures

  constructor(state: PrimarySpellEarthProjectileState, textures: EarthBoulderTextures) {
    this.state = state
    this.textures = textures
    this.container = new Container({ label: 'earth' })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.body.eventMode = 'none'
    this.visual.eventMode = 'none'
    this.aura = sprite(textures.aura)
    this.aura.tint = 0xe6ffe6
    this.openingFlash = sprite(textures.openingFlash)
    this.openingFlash.blendMode = 'add'
    this.visual.addChild(this.aura, this.openingFlash, this.body)
    this.container.addChild(this.visual)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('position' in state) || state.kind !== 'earth') return
    this.state = state
    this.container.position.set(state.position.x, state.position.y)
    const plan = earthBoulderPresentationPlan(state, state.ageTicks)
    this.sortBias = plan.sortBias
    this.visual.position.set(plan.visualOffset.x, plan.visualOffset.y)
    this.aura.alpha = plan.aura.alpha
    this.aura.scale.set(plan.aura.scale)
    this.openingFlash.alpha = plan.openingFlash.alpha
    this.openingFlash.rotation = plan.openingFlash.rotation
    this.openingFlash.scale.set(plan.openingFlash.scale)
    syncSprites(this.body, this.rockSprites, plan.rocks.length, () => (
      sprite(this.textures.rocks[0])
    ))
    for (const [index, rock] of plan.rocks.entries()) {
      const rockSprite = this.rockSprites[index]
      rockSprite.texture = this.textures.rocks[EARTH_BOULDER_MAIN_RECORDS.indexOf(rock.record)]
      rockSprite.position.set(rock.position.x, rock.position.y)
      rockSprite.rotation = rock.rotation
      rockSprite.scale.set(rock.scale)
      rockSprite.alpha = plan.bodyAlpha
    }
  }

  get worldY(): number {
    return this.state.position.y
  }

  painterRoots(): readonly EarthPainterRoot[] {
    return [{
      container: this.container,
      lane: 'world-sorted',
      overlayOwnerId: this.state.ownerId,
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: { ...this.state.position },
      sortBias: this.sortBias,
      suffix: '',
      worldY: this.worldY,
    }]
  }

  setTint(suffix: string, tint: number): void {
    if (suffix !== '') return
    this.aura.tint = multiplyTint(tint, 0xe6ffe6)
    this.openingFlash.tint = tint
    for (const rock of this.rockSprites) rock.tint = tint
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.rockSprites.length = 0
  }
}

export class EarthCalledRockView {
  readonly container: Container
  readonly containers: readonly Container[]
  readonly kind = 'earth-called-rock'
  private readonly baseRock: Sprite
  private readonly rock: Sprite
  private state: PrimarySpellEarthCalledRockState
  private readonly textures: EarthBoulderTextures

  constructor(state: PrimarySpellEarthCalledRockState, textures: EarthBoulderTextures) {
    this.state = state
    this.textures = textures
    this.container = new Container({ label: 'earth-called-rock' })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.baseRock = sprite(textures.litRocks[state.variant])
    this.rock = sprite(textures.litRocks[state.variant])
    this.container.addChild(this.baseRock, this.rock)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (state.kind !== 'earth-called-rock') return
    this.state = state
    this.container.position.set(state.position.x, state.position.y)
    this.baseRock.texture = this.textures.litRocks[state.variant]
    this.baseRock.position.set(0, 0)
    this.baseRock.rotation = 0
    this.baseRock.scale.set(state.scale * 0.75)
    this.baseRock.renderable = state.height < 0
    this.rock.texture = this.textures.litRocks[state.variant]
    this.rock.position.set(0, state.height)
    this.rock.rotation = state.rotation * Math.PI / 180
    this.rock.scale.set(state.scale)
  }

  painterRoots(): readonly EarthPainterRoot[] {
    return [{
      container: this.container,
      lane: 'world-sorted',
      queueFamily: 'ordinary-dynamic',
      regionLightPoint: null,
      sortBias: 0,
      suffix: '',
      worldY: this.state.position.y,
    }]
  }

  setTint(_suffix: string, _tint: number): void {}

  destroy(): void {
    this.container.destroy({ children: true })
  }
}

export class EarthBoulderImpactView {
  readonly containers: readonly Container[]
  readonly kind = 'earth-impact'
  private readonly fragmentRoots: Container[]
  private readonly fragmentSprites: Sprite[]
  private readonly liveFragmentIndexes = new Set<number>()
  private readonly textures: EarthBoulderTextures

  constructor(state: PrimarySpellEarthImpactState, textures: EarthBoulderTextures) {
    this.textures = textures
    const count = earthImpactFragmentCount(state.charge)
    this.fragmentRoots = Array.from({ length: count }, (_, index) => {
      const root = new Container({ label: `earth-impact-fragment-${index}` })
      root.eventMode = 'none'
      return root
    })
    this.fragmentSprites = this.fragmentRoots.map((root) => {
      const result = sprite(textures.litRocks[0])
      root.addChild(result)
      return result
    })
    this.containers = this.fragmentRoots
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state) || state.kind !== 'earth-impact') return
    const plan = earthBoulderImpactPlan(state)
    this.liveFragmentIndexes.clear()
    for (const root of this.fragmentRoots) root.renderable = false
    for (const fragment of plan.fragments) {
      const index = fragment.index
      const fragmentRoot = this.fragmentRoots[index]
      const fragmentSprite = this.fragmentSprites[index]
      this.liveFragmentIndexes.add(index)
      fragmentRoot.renderable = true
      fragmentRoot.position.set(
        state.origin.x + fragment.position.x,
        state.origin.y + fragment.position.y,
      )
      fragmentSprite.texture = this.textures.litRocks[
        EARTH_BOULDER_LIT_RECORDS.indexOf(fragment.record)
      ]
      fragmentSprite.position.set(0, fragment.height)
      fragmentSprite.rotation = fragment.rotation
      fragmentSprite.scale.set(fragment.scale)
      fragmentSprite.alpha = fragment.alpha
    }
  }

  painterRoots(): readonly EarthPainterRoot[] {
    return [...this.liveFragmentIndexes].map((index) => {
      const position = this.fragmentRoots[index].position
      return {
        container: this.fragmentRoots[index],
        lane: 'world-sorted',
        queueFamily: 'ordinary-dynamic',
        regionLightPoint: { x: position.x, y: position.y },
        sortBias: -15,
        suffix: `fragment-${index}`,
        worldY: position.y,
      }
    })
  }

  setTint(suffix: string, tint: number): void {
    if (!suffix.startsWith('fragment-')) return
    const index = Number(suffix.slice('fragment-'.length))
    const fragment = this.fragmentSprites[index]
    if (fragment) fragment.tint = tint
  }

  destroy(): void {
    for (const root of this.fragmentRoots) root.destroy({ children: true })
    this.fragmentRoots.length = 0
    this.fragmentSprites.length = 0
    this.liveFragmentIndexes.clear()
  }
}

interface EarthPainterRoot {
  container: Container
  lane: 'world-sorted'
  overlayOwnerId?: string
  queueFamily: 'ordinary-dynamic'
  regionLightPoint: { x: number, y: number } | null
  sortBias: number
  suffix: string
  worldY: number
}

function sprite(texture: Texture): Sprite {
  const result = new Sprite(texture)
  result.anchor.set(0.5)
  result.eventMode = 'none'
  return result
}

function multiplyTint(first: number, second: number): number {
  const channel = (shift: number) => Math.round(
    ((first >>> shift) & 0xff) * ((second >>> shift) & 0xff) / 0xff,
  )
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

function syncSprites(
  parent: Container,
  sprites: Sprite[],
  count: number,
  create: () => Sprite,
): void {
  while (sprites.length < count) {
    const next = create()
    sprites.push(next)
    parent.addChild(next)
  }
  while (sprites.length > count) {
    const removed = sprites.pop()
    if (!removed) break
    parent.removeChild(removed)
    removed.destroy()
  }
}
