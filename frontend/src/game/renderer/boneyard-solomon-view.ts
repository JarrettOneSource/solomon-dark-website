import { spriteRefFor } from '../../editor/assets.ts'
import type { SpriteRef, Vec2 } from '../../editor/model.ts'
import type { LoadedBoneyard, SolomonDigState } from '../core-kernels/boneyard.ts'
import type { BoneyardSolomonSnapshot } from '../protocol/game-state.ts'
import type { NativeSolomonSetPieceLighting } from './boneyard-lighting.ts'
import {
  NATIVE_SOLOMON_DIRT_DRAW_PASSES,
  NATIVE_SOLOMON_DIRT_VISIBLE_TICKS,
  type NativeSolomonDirtState,
  nativeSolomonDirtDrawOperations,
  nativeSolomonDirtEventDelta,
  nativeSolomonDirtStateAt,
} from './boneyard-solomon-dirt-presentation.ts'
import { type BoneyardSolomonClipRect, boneyardSolomonVisualState } from './boneyard-solomon-render.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { Container, Graphics, Sprite, Texture } from 'pixi.js'

export class BoneyardSolomonView {
  private readonly actorRoot = new Container({ label: 'solomon-actor' })
  private readonly body: Sprite
  private readonly clipMask = new Graphics()
  private readonly dirtRoot = new Container({ label: 'solomon-flydirt' })
  private readonly dirtViews = new Map<number, BoneyardSolomonDirtView>()
  private readonly digState: SolomonDigState
  private readonly graveMark: Sprite
  private readonly lantern: Sprite
  private readonly mouth: Sprite
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures
  private currentFrame = 2
  private currentClipRectWorld: BoneyardSolomonClipRect | null = null
  private lastDigEventId: number | null = null

  constructor(
    boneyard: LoadedBoneyard,
    root: Container,
    textures: BoneyardWorldTextures,
  ) {
    const state = boneyard.scene.solomonDig!
    this.root = root
    this.textures = textures
    this.digState = state
    this.lantern = new Sprite(textures.lantern)
    this.lantern.pivot.set(14.5, 22.5)
    this.lantern.position.set(state.lanternPosition.x, state.lanternPosition.y)
    this.body = new Sprite(textures.solomonDig[0])
    this.body.anchor.set(0.5)
    this.mouth = new Sprite(textures.solomonDialogueMouth[0][0])
    this.mouth.anchor.set(0.5)
    this.mouth.zIndex = 1
    this.mouth.visible = false
    this.graveMark = plantedSprite(
      textures.solomonGraveMark,
      requiredSpriteRef(13),
      { x: -10, y: -113 },
    )
    this.graveMark.zIndex = 2
    this.dirtRoot.zIndex = 3
    this.actorRoot.position.set(state.position.x, state.position.y)
    this.actorRoot.sortableChildren = true
    this.actorRoot.addChild(
      this.body,
      this.mouth,
      this.graveMark,
      this.clipMask,
      this.dirtRoot,
    )
    root.addChild(this.actorRoot, this.lantern)
  }

  update(encounter: BoneyardSolomonSnapshot | null, tick: number, lanternPosition: SolomonDigState['lanternPosition'] | null): void {
    this.lantern.visible = lanternPosition !== null
    if (lanternPosition !== null) this.lantern.position.set(lanternPosition.x, lanternPosition.y)
    if (encounter === null) {
      this.clearDirt()
      this.lastDigEventId = null
      const programIndex = Math.floor(tick / this.digState.ticksPerFrame)
        % this.digState.frameProgram.length
      const frame = this.digState.frameProgram[programIndex]
      this.currentFrame = frame + 2
      this.body.texture = this.textures.solomonDig[frame]
      this.actorRoot.position.set(this.digState.position.x, this.digState.position.y)
      this.actorRoot.visible = true
      this.body.position.y = 5
      this.currentClipRectWorld = {
        height: 100,
        width: 200,
        x: this.digState.position.x - 100,
        y: this.digState.position.y - 100,
      }
      this.clipMask.clear().rect(-100, -100, 200, 100).fill(0xffffff)
      this.body.mask = this.clipMask
      this.mouth.mask = null
      this.mouth.visible = false
      this.graveMark.visible = true
      return
    }
    this.updateDirt(encounter, tick)
    const visual = boneyardSolomonVisualState(encounter, this.digState, tick)
    this.currentClipRectWorld = visual.clipRectWorld
    this.currentFrame = visual.nativeBodyRecord
    this.actorRoot.position.set(
      encounter.position.x,
      encounter.position.y,
    )
    this.actorRoot.visible = visual.visible
    if (!visual.visible) return
    this.body.position.y = visual.offsetY
    this.mouth.position.y = visual.offsetY
    if (visual.clipRectWorld === null) {
      this.body.mask = null
      this.mouth.mask = null
      this.clipMask.clear()
    } else {
      const clipLeft = visual.clipRectWorld.x - encounter.position.x
      const clipTop = visual.clipRectWorld.y - encounter.position.y
      this.clipMask.clear().rect(
        clipLeft,
        clipTop,
        visual.clipRectWorld.width,
        visual.clipRectWorld.height,
      ).fill(0xffffff)
      this.body.mask = this.clipMask
      this.mouth.mask = this.clipMask
    }
    this.graveMark.visible = visual.graveMarkVisible
    if (visual.bodyBank === 'dig') {
      this.body.texture = this.textures.solomonDig[visual.bodyPose]
    } else if (visual.bodyBank === 'dialogue') {
      this.body.texture = this.textures.solomonDialogueBody[visual.direction]
    } else {
      this.body.texture = this.textures.solomonWalk[visual.bodyPose][visual.direction]
    }
    this.mouth.visible = visual.mouthPose !== null
    if (visual.mouthPose !== null) {
      this.mouth.texture = this.textures.solomonDialogueMouth[visual.mouthPose][visual.direction]
    }
  }

  get frame(): number {
    return this.currentFrame
  }

  get bodyOffsetY(): number {
    return this.body.position.y
  }

  get bodyTint(): number {
    return this.body.tint
  }

  get clipRectWorld(): BoneyardSolomonClipRect | null {
    return this.currentClipRectWorld
  }

  get dirtTint(): number {
    return this.dirtRoot.tint
  }

  get graveMarkTint(): number {
    return this.graveMark.tint
  }

  get dirtCount(): number {
    return this.dirtViews.size
  }

  get dirtPassCount(): number {
    return this.dirtViews.size * NATIVE_SOLOMON_DIRT_DRAW_PASSES
  }

  get graveMarkPassCount(): number {
    return Number(this.actorRoot.visible && this.graveMark.visible)
  }

  get dirt(): Readonly<{
    eventId: number
    state: NativeSolomonDirtState
  }> | null {
    let latest: BoneyardSolomonDirtView | null = null
    for (const view of this.dirtViews.values()) {
      if (latest === null || view.eventId > latest.eventId) latest = view
    }
    if (latest === null || latest.state === null) return null
    return { eventId: latest.eventId, state: latest.state }
  }

  setActorDepth(depth: number): void {
    this.actorRoot.zIndex = depth
  }

  setActorRenderable(renderable: boolean): void {
    this.actorRoot.renderable = renderable
  }

  get lanternWorldX(): number {
    return this.lantern.visible ? this.lantern.position.x : Number.NaN
  }

  get lanternWorldY(): number {
    return this.lantern.visible ? this.lantern.position.y : Number.NaN
  }

  setLanternDepth(depth: number): void {
    this.lantern.zIndex = depth
  }

  setLighting(lighting: NativeSolomonSetPieceLighting): void {
    this.body.tint = lighting.bodyTint
    this.graveMark.tint = lighting.bodyTint
    this.dirtRoot.tint = lighting.dirtTint
    this.mouth.tint = lighting.bodyTint
    this.lantern.tint = lighting.lanternTint
  }

  destroy(): void {
    this.clearDirt()
    this.root.removeChild(this.actorRoot, this.lantern)
    this.actorRoot.destroy({ children: true })
    this.lantern.destroy()
  }

  private updateDirt(encounter: BoneyardSolomonSnapshot, tick: number): void {
    const delta = nativeSolomonDirtEventDelta(
      this.lastDigEventId,
      encounter.digEvents,
    )
    this.lastDigEventId = delta.eventId
    for (const event of delta.events) {
      const ageTicks = Math.floor(tick - event.tick)
      if (ageTicks >= 0 && ageTicks < NATIVE_SOLOMON_DIRT_VISIBLE_TICKS) {
        this.dirtViews.set(event.id, new BoneyardSolomonDirtView(
          this.dirtRoot,
          this.textures.solomonFlydirt,
          event.id,
          event.tick,
          encounter.position,
        ))
      }
    }

    for (const [eventId, view] of this.dirtViews) {
      if (view.update(tick, encounter.position)) continue
      view.destroy()
      this.dirtViews.delete(eventId)
    }
  }

  private clearDirt(): void {
    for (const view of this.dirtViews.values()) view.destroy()
    this.dirtViews.clear()
  }
}

class BoneyardSolomonDirtView {
  readonly eventId: number
  state: NativeSolomonDirtState | null = null

  private readonly birthPosition: Readonly<{ x: number; y: number }>
  private readonly birthTick: number
  private readonly root: Container
  private readonly sprites: readonly Sprite[]

  constructor(
    root: Container,
    texture: Texture,
    eventId: number,
    birthTick: number,
    birthPosition: Readonly<{ x: number; y: number }>,
  ) {
    this.root = root
    this.eventId = eventId
    this.birthTick = birthTick
    this.birthPosition = { ...birthPosition }
    this.sprites = Array.from(
      { length: NATIVE_SOLOMON_DIRT_DRAW_PASSES },
      () => {
        const sprite = new Sprite(texture)
        sprite.anchor.set(0.5)
        root.addChild(sprite)
        return sprite
      },
    )
  }

  update(
    tick: number,
    actorPosition: Readonly<{ x: number; y: number }>,
  ): boolean {
    const ageTicks = Math.floor(tick - this.birthTick)
    if (ageTicks < 0) return true
    const state = nativeSolomonDirtStateAt(this.birthPosition, ageTicks)
    this.state = state
    if (state === null) return false
    const operations = nativeSolomonDirtDrawOperations(state)
    for (let index = 0; index < this.sprites.length; index += 1) {
      const sprite = this.sprites[index]!
      const operation = operations[index]!
      sprite.alpha = operation.alpha
      sprite.position.set(
        operation.position.x - actorPosition.x,
        operation.position.y - actorPosition.y,
      )
      sprite.rotation = operation.headingDegrees * Math.PI / 180
    }
    return true
  }

  destroy(): void {
    this.root.removeChild(...this.sprites)
    for (const sprite of this.sprites) sprite.destroy()
    this.state = null
  }
}

export function plantedSprite(texture: Texture, ref: SpriteRef, position: Vec2): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(ref.anchorX / ref.w, ref.anchorY / ref.h)
  sprite.position.set(position.x, position.y)
  sprite.eventMode = 'none'
  return sprite
}

export function requiredSpriteRef(entry: number): SpriteRef {
  const ref = spriteRefFor('DeadHawg', entry)
  if (!ref) throw new Error(`Boneyard DeadHawg record ${entry} is unavailable.`)
  return ref
}

export function requiredTexture(textures: BoneyardWorldTextures, ref: SpriteRef): Texture {
  const texture = textures.base[ref.src]
  if (!texture) throw new Error(`Boneyard texture was not loaded: ${ref.src}`)
  return texture
}
