import { Container, Sprite, type Texture } from 'pixi.js'

import type {
  PrimarySpellEarthImpactState,
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  EARTH_BOULDER_LIT_RECORDS,
  EARTH_BOULDER_MAIN_RECORDS,
  earthBoulderImpactPlan,
  earthBoulderPresentationPlan,
} from './earth-boulder-presentation.ts'

export interface EarthBoulderTextures {
  glimmer: Texture
  litRocks: readonly Texture[]
  rocks: readonly Texture[]
}

export class EarthBoulderView {
  readonly container: Container
  readonly containers: readonly Container[]
  readonly kind = 'earth'
  private readonly body = new Container({ label: 'earth-boulder-body' })
  private readonly called = new Container({ label: 'earth-boulder-called-rocks' })
  private readonly calledSprites: Sprite[] = []
  private readonly glimmer: Sprite
  private readonly rockSprites: Sprite[] = []
  private state: PrimarySpellProjectileState
  private readonly textures: EarthBoulderTextures

  constructor(state: PrimarySpellProjectileState, textures: EarthBoulderTextures) {
    if (state.kind !== 'earth') throw new Error('EarthBoulderView requires an Earth projectile')
    this.state = state
    this.textures = textures
    this.container = new Container({ label: 'earth' })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.body.eventMode = 'none'
    this.called.eventMode = 'none'
    this.glimmer = sprite(textures.glimmer)
    this.container.addChild(this.glimmer, this.body, this.called)
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('position' in state) || state.kind !== 'earth') return
    this.state = state
    this.container.position.set(state.position.x, state.position.y)
    const plan = earthBoulderPresentationPlan(state)
    this.glimmer.alpha = plan.glimmer.alpha
    this.glimmer.scale.set(plan.glimmer.scale)
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
    syncSprites(this.called, this.calledSprites, plan.calledRocks.length, () => (
      sprite(this.textures.litRocks[0])
    ))
    for (const [index, rock] of plan.calledRocks.entries()) {
      const rockSprite = this.calledSprites[index]
      rockSprite.texture = this.textures.litRocks[EARTH_BOULDER_LIT_RECORDS.indexOf(rock.record)]
      rockSprite.position.set(rock.position.x, rock.position.y)
      rockSprite.rotation = rock.rotation
      rockSprite.scale.set(rock.scale)
      rockSprite.alpha = rock.alpha
    }
  }

  get worldY(): number {
    return this.state.position.y
  }

  painterRoots(): readonly EarthPainterRoot[] {
    return [{ container: this.container, suffix: '', worldY: this.worldY }]
  }

  setTint(tint: number): void {
    this.glimmer.tint = tint
    for (const rock of this.rockSprites) rock.tint = tint
    for (const rock of this.calledSprites) rock.tint = tint
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.rockSprites.length = 0
    this.calledSprites.length = 0
  }
}

export class EarthBoulderImpactView {
  readonly container: Container
  readonly containers: readonly Container[]
  readonly kind = 'earth-impact'
  private readonly fragmentSprites: Sprite[] = []
  private state: PrimarySpellEarthImpactState
  private readonly textures: EarthBoulderTextures

  constructor(state: PrimarySpellEarthImpactState, textures: EarthBoulderTextures) {
    this.state = state
    this.textures = textures
    this.container = new Container({ label: 'earth-impact' })
    this.containers = [this.container]
    this.container.eventMode = 'none'
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state) || state.kind !== 'earth-impact') return
    this.state = state
    this.container.position.set(state.origin.x, state.origin.y)
    const plan = earthBoulderImpactPlan(state)
    syncSprites(this.container, this.fragmentSprites, plan.fragments.length, () => (
      sprite(this.textures.litRocks[0])
    ))
    for (const [index, fragment] of plan.fragments.entries()) {
      const fragmentSprite = this.fragmentSprites[index]
      fragmentSprite.texture = this.textures.litRocks[
        EARTH_BOULDER_LIT_RECORDS.indexOf(fragment.record)
      ]
      fragmentSprite.position.set(fragment.position.x, fragment.position.y)
      fragmentSprite.rotation = fragment.rotation
      fragmentSprite.scale.set(fragment.scale)
      fragmentSprite.alpha = plan.alpha
    }
  }

  get worldY(): number {
    return this.state.origin.y
  }

  painterRoots(): readonly EarthPainterRoot[] {
    return [{ container: this.container, suffix: '', worldY: this.worldY }]
  }

  setTint(tint: number): void {
    for (const fragment of this.fragmentSprites) fragment.tint = tint
  }

  destroy(): void {
    this.container.destroy({ children: true })
    this.fragmentSprites.length = 0
  }
}

interface EarthPainterRoot {
  container: Container
  suffix: string
  worldY: number
}

function sprite(texture: Texture): Sprite {
  const result = new Sprite(texture)
  result.anchor.set(0.5)
  result.eventMode = 'none'
  return result
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
