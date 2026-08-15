import {
  Container,
  MeshSimple,
  Sprite,
  type Texture,
} from 'pixi.js'

import type {
  PrimarySpellAirTransientState,
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  AIR_LIGHTNING_BRANCH_RECORDS,
  AIR_LIGHTNING_CORONA_FORK_RECORDS,
  buildNativeAirLightningPlan,
  type NativeAirCoronaPlan,
} from './primary-spell-air-native.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

type AirTextures = PlayerWorldTextures['primarySpells']['air']

const FORK_REGISTRATION = [
  { height: 56, originX: -3, originY: 0.5, record: 1836, width: 45 },
  { height: 53, originX: -0.5, originY: 2, record: 1837, width: 48 },
  { height: 50, originX: -2, originY: -1.5, record: 1838, width: 51 },
  { height: 41, originX: 0, originY: 0, record: 1839, width: 31 },
] as const

export class AirPrimarySpellView {
  private readonly bodyContainer: Container
  private readonly body: readonly MeshSimple[]
  readonly containers: readonly Container[]
  private readonly contactCorona: AirCoronaView
  readonly kind = 'air'
  private plan: ReturnType<typeof buildNativeAirLightningPlan>
  private state: PrimarySpellAirTransientState
  private readonly sourceCorona: AirCoronaView

  constructor(state: PrimarySpellAirTransientState, textures: AirTextures) {
    this.state = state
    this.bodyContainer = new Container({ label: 'air-body' })
    this.bodyContainer.eventMode = 'none'
    const construction = buildNativeAirLightningPlan({
      ageTicks: 0,
      birthTick: state.birthTick,
      ...localAirGeometry(state),
      id: state.id,
      underpowered: state.underpowered,
    })
    this.body = construction.body?.layers.flatMap((layer) => {
      const mesh = new MeshSimple({
        indices: layer.indices,
        texture: textures.ribbon,
        topology: 'triangle-list',
        uvs: layer.uvs,
        vertices: layer.vertices,
      })
      mesh.alpha = layer.alpha
      mesh.autoUpdate = false
      mesh.blendMode = 'add'
      mesh.eventMode = 'none'
      mesh.tint = layer.tint
      if (!layer.branch) return [mesh]
      const branch = new MeshSimple({
        indices: layer.branch.indices,
        texture: textures.branches[
          AIR_LIGHTNING_BRANCH_RECORDS.indexOf(layer.branch.textureRecord)
        ],
        topology: 'triangle-list',
        uvs: layer.branch.uvs,
        vertices: layer.branch.vertices,
      })
      branch.alpha = layer.alpha
      branch.autoUpdate = false
      branch.blendMode = 'add'
      branch.eventMode = 'none'
      branch.tint = layer.tint
      return [mesh, branch]
    }) ?? []
    this.bodyContainer.addChild(...this.body)
    this.sourceCorona = new AirCoronaView('air-source-corona', textures)
    this.contactCorona = new AirCoronaView('air-contact-corona', textures)
    this.containers = [
      this.bodyContainer,
      this.sourceCorona.container,
      this.contactCorona.container,
    ]
    this.plan = construction
    this.update(state)
  }

  update(state: PrimarySpellProjectileState | PrimarySpellTransientState): void {
    if (!('origin' in state) || state.kind !== 'air') return
    this.state = state
    this.bodyContainer.position.set(state.origin.x, state.origin.y)
    const plan = buildNativeAirLightningPlan({
      ageTicks: state.ageTicks,
      birthTick: state.birthTick,
      ...localAirGeometry(state),
      id: state.id,
      underpowered: state.underpowered,
    })
    this.plan = plan
    this.bodyContainer.visible = plan.body !== null
    for (const mesh of this.body) mesh.visible = plan.body !== null
    this.sourceCorona.update(plan.sourceCorona, state.origin)
    this.contactCorona.update(plan.contactCorona, state.origin)
  }

  painterRoots(): readonly AirPainterRoot[] {
    const roots: AirPainterRoot[] = []
    if (this.plan.body) {
      roots.push({
        container: this.bodyContainer,
        lane: 'world-sorted',
        queueFamily: 'ordinary-dynamic',
        regionLightPoint: null,
        sortBias: 0,
        suffix: 'body',
        worldY: this.state.origin.y + this.plan.midpoint.y,
      })
    }
    if (this.plan.sourceCorona) {
      roots.push({
        container: this.sourceCorona.container,
        lane: 'world-sorted',
        queueFamily: 'ordinary-dynamic',
        regionLightPoint: null,
        sortBias: 0,
        suffix: 'source',
        worldY: this.state.origin.y + this.plan.sourceCorona.center.y,
      })
    }
    if (this.plan.contactCorona.alpha > 0) {
      roots.push({
        container: this.contactCorona.container,
        lane: 'world-sorted',
        queueFamily: 'ordinary-dynamic',
        regionLightPoint: null,
        sortBias: 0,
        suffix: 'contact',
        worldY: this.state.origin.y + this.plan.contactCorona.center.y,
      })
    }
    return roots
  }

  setTint(suffix: string, tint: number): void {
    const root = this.painterRoots().find((candidate) => candidate.suffix === suffix)
    if (root) root.container.tint = tint
  }

  destroy(): void {
    for (const container of this.containers) container.destroy({ children: true })
  }
}

function localAirGeometry(state: PrimarySpellAirTransientState): {
  endpoint: { x: number; y: number }
  midpoint: { x: number; y: number }
} {
  return {
    endpoint: {
      x: state.endpoint.x - state.origin.x,
      y: state.endpoint.y - state.origin.y,
    },
    midpoint: {
      x: state.midpoint.x - state.origin.x,
      y: state.midpoint.y - state.origin.y,
    },
  }
}

interface AirPainterRoot {
  container: Container
  lane: 'world-sorted'
  queueFamily: 'ordinary-dynamic'
  regionLightPoint: { x: number, y: number } | null
  sortBias: number
  suffix: string
  worldY: number
}

class AirCoronaView {
  readonly container: Container
  private readonly circles: readonly Sprite[]
  private readonly forks: readonly Sprite[]
  private readonly textures: AirTextures

  constructor(label: string, textures: AirTextures) {
    this.textures = textures
    this.container = new Container({ label })
    this.container.eventMode = 'none'
    this.circles = Array.from({ length: 4 }, () => additiveSprite(textures.circle))
    this.forks = Array.from({ length: 2 }, () => additiveSprite(textures.forks[0]))
    this.container.addChild(...this.circles, ...this.forks)
  }

  update(plan: NativeAirCoronaPlan | null, origin: { x: number; y: number }): void {
    this.container.visible = plan !== null
    if (!plan) return
    this.container.position.set(
      origin.x + plan.center.x,
      origin.y + plan.center.y,
    )
    this.container.alpha = plan.alpha
    for (let index = 0; index < this.circles.length; index += 1) {
      const sprite = this.circles[index]
      const circle = plan.circles[index]
      sprite.alpha = circle.alpha
      sprite.scale.set(circle.scale)
      sprite.tint = circle.tint
    }
    for (let index = 0; index < this.forks.length; index += 1) {
      const sprite = this.forks[index]
      const fork = plan.forks[index]
      applyForkTexture(sprite, fork.record, this.textures.forks)
      sprite.alpha = fork.alpha
      sprite.rotation = fork.rotation
      sprite.scale.set(fork.scale)
      sprite.tint = fork.tint
    }
  }
}

function additiveSprite(texture: Texture): Sprite {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.blendMode = 'add'
  sprite.eventMode = 'none'
  return sprite
}

function applyForkTexture(
  sprite: Sprite,
  record: typeof AIR_LIGHTNING_CORONA_FORK_RECORDS[number],
  textures: readonly Texture[],
): void {
  const index = record - AIR_LIGHTNING_CORONA_FORK_RECORDS[0]
  const registration = FORK_REGISTRATION[index]
  sprite.texture = textures[index]
  sprite.anchor.set(
    (registration.width / 2 - registration.originX) / registration.width,
    (registration.height / 2 - registration.originY) / registration.height,
  )
}
