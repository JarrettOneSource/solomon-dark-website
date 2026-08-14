import {
  Container,
  MeshSimple,
  Sprite,
  type Texture,
} from 'pixi.js'

import type {
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import { PRIMARY_SPELL_AIR_REACH } from '../core-kernels/primary-spells.ts'
import {
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
  private state: PrimarySpellTransientState
  private readonly sourceCorona: AirCoronaView

  constructor(state: PrimarySpellTransientState, textures: AirTextures) {
    this.state = state
    this.bodyContainer = new Container({ label: 'air-body' })
    this.bodyContainer.eventMode = 'none'
    const construction = buildNativeAirLightningPlan({
      ageTicks: 0,
      direction: state.direction,
      id: state.id,
      reach: PRIMARY_SPELL_AIR_REACH,
    })
    this.body = construction.body?.layers.map((layer) => {
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
      return mesh
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
      direction: state.direction,
      id: state.id,
      reach: PRIMARY_SPELL_AIR_REACH,
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
        suffix: 'body',
        worldY: this.state.origin.y + this.plan.midpoint.y,
      })
    }
    if (this.plan.sourceCorona) {
      roots.push({
        container: this.sourceCorona.container,
        suffix: 'source',
        worldY: this.state.origin.y + this.plan.sourceCorona.center.y,
      })
    }
    if (this.plan.contactCorona.alpha > 0) {
      roots.push({
        container: this.contactCorona.container,
        suffix: 'contact',
        worldY: this.state.origin.y + this.plan.contactCorona.center.y,
      })
    }
    return roots
  }

  setTint(tint: number): void {
    for (const container of this.containers) container.tint = tint
  }

  destroy(): void {
    for (const container of this.containers) container.destroy({ children: true })
  }
}

interface AirPainterRoot {
  container: Container
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
