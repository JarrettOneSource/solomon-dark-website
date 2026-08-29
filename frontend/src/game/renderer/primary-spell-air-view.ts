import {
  Container,
  Graphics,
  MeshSimple,
  Sprite,
  type Texture,
} from 'pixi.js'

import type {
  PrimarySpellAirTransientState,
  PrimarySpellProjectileState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import { NATIVE_BROWSER_ENHANCED_EFFECTS } from '../game-settings.ts'
import {
  buildNativeZAnimSplitBands,
  type NativeZAnimSplitBand,
} from '../native-zanim-split.ts'
import {
  AIR_LIGHTNING_BRANCH_RECORDS,
  AIR_LIGHTNING_CONTACT_SORT_BIAS,
  AIR_LIGHTNING_CORONA_FORK_RECORDS,
  buildNativeAirLightningPlan,
  type NativeAirCoronaPlan,
  type NativeAirLightningFactoryPlan,
} from './primary-spell-air-native.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

export type NativeAirVfxTextures = PlayerWorldTextures['primarySpells']['air']
export type NativeAirLightningViewState = Omit<
  PrimarySpellAirTransientState,
  'lightRegistration' | 'painterRegistrations'
>

const FORK_REGISTRATION = [
  { height: 56, originX: -3, originY: 0.5, record: 1836, width: 45 },
  { height: 53, originX: -0.5, originY: 2, record: 1837, width: 48 },
  { height: 50, originX: -2, originY: -1.5, record: 1838, width: 51 },
  { height: 41, originX: 0, originY: 0, record: 1839, width: 31 },
] as const

export class AirPrimarySpellView {
  private readonly body: NativeAirLightningBodyView
  readonly containers: readonly Container[]
  private readonly contactCorona: NativeAirCoronaView
  readonly kind = 'air'
  private plan: ReturnType<typeof buildNativeAirLightningPlan>
  private state: NativeAirLightningViewState
  private readonly sourceCorona: NativeAirCoronaView

  constructor(state: NativeAirLightningViewState, textures: NativeAirVfxTextures) {
    this.state = state
    const construction = buildNativeAirLightningPlan({
      ageTicks: 0,
      birthTick: state.birthTick,
      ...localAirGeometry(state),
      id: state.id,
      underpowered: state.underpowered,
    })
    this.body = new NativeAirLightningBodyView('air-body', construction.body, textures)
    this.sourceCorona = new NativeAirCoronaView('air-source-corona', textures)
    this.contactCorona = new NativeAirCoronaView('air-contact-corona', textures)
    this.containers = [
      ...this.body.containers,
      this.sourceCorona.container,
      this.contactCorona.container,
    ]
    this.plan = construction
    this.update(state)
  }

  update(
    state: PrimarySpellProjectileState
      | PrimarySpellTransientState
      | NativeAirLightningViewState,
  ): void {
    if (!('origin' in state) || state.kind !== 'air') return
    this.state = state
    this.body.setOrigin(state.origin)
    const plan = buildNativeAirLightningPlan({
      ageTicks: state.ageTicks,
      birthTick: state.birthTick,
      ...localAirGeometry(state),
      id: state.id,
      underpowered: state.underpowered,
    })
    this.plan = plan
    this.body.update(plan.body)
    this.sourceCorona.update(plan.sourceCorona, state.origin)
    this.contactCorona.update(plan.contactCorona, state.origin)
  }

  painterRoots(): readonly AirPainterRoot[] {
    const roots: AirPainterRoot[] = []
    if (this.plan.body) {
      roots.push({
        container: this.body.container,
        insertions: this.body.bands.map((band, index) => ({
          sortBias: 0,
          suffix: `body-band-${index}`,
          visible: true,
          worldY: this.state.origin.y + band.painterY,
        })),
        lane: 'world-sorted',
        queueFamily: 'ordinary-dynamic',
        regionLightPoint: null,
        sortBias: 0,
        suffix: 'body',
        visible: false,
        worldY: this.state.origin.y + this.body.boundsY,
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
        sortBias: AIR_LIGHTNING_CONTACT_SORT_BIAS,
        suffix: 'contact',
        worldY: this.state.origin.y + this.plan.contactCorona.center.y,
      })
    }
    return roots
  }

  setTint(suffix: string, tint: number): void {
    const bodyBand = this.body.bandContainer(suffix)
    if (bodyBand) {
      bodyBand.tint = tint
      return
    }
    const root = this.painterRoots().find((candidate) => candidate.suffix === suffix)
    if (root) root.container.tint = tint
  }

  painterContainer(suffix: string): Container | null {
    return this.body.bandContainer(suffix)
  }

  destroy(): void {
    for (const container of this.containers) container.destroy({ children: true })
  }
}

function localAirGeometry(state: NativeAirLightningViewState): {
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
  insertions?: readonly Readonly<{
    sortBias: number
    suffix: string
    visible: boolean
    worldY: number
  }>[]
  lane: 'world-sorted'
  queueFamily: 'ordinary-dynamic'
  regionLightPoint: { x: number, y: number } | null
  sortBias: number
  suffix: string
  visible?: boolean
  worldY: number
}

export class NativeAirLightningBodyView {
  readonly container: Container
  readonly containers: readonly Container[]
  readonly bands: readonly NativeZAnimSplitBand[]
  readonly boundsY: number
  private readonly bandContainers: readonly Container[]
  private readonly masks: Graphics[]

  constructor(
    label: string,
    body: NativeAirLightningFactoryPlan['body'],
    textures: NativeAirVfxTextures,
    split = true,
  ) {
    this.container = new Container({ label })
    this.container.eventMode = 'none'
    const bounds = airBodyBounds(body)
    this.boundsY = bounds.y
    this.bands = split
      ? buildNativeZAnimSplitBands(
          label,
          bounds,
          NATIVE_BROWSER_ENHANCED_EFFECTS,
        )
      : Object.freeze([])
    this.masks = []
    this.bandContainers = this.bands.map((band, bandIndex) => {
      const root = new Container({ label: `${label}-band-${bandIndex}` })
      root.eventMode = 'none'
      const content = new Container({ label: `${label}-band-content-${bandIndex}` })
      content.eventMode = 'none'
      const meshes = createAirBodyMeshes(body, textures)
      content.addChild(...meshes)
      const mask = new Graphics()
        .rect(0, band.clip.y, band.clip.width, band.clip.height)
        .fill(0xffffff)
      mask.eventMode = 'none'
      content.mask = mask
      root.addChild(content, mask)
      this.masks.push(mask)
      return root
    })
    if (!split) this.container.addChild(...createAirBodyMeshes(body, textures))
    this.containers = Object.freeze([this.container, ...this.bandContainers])
    this.update(body)
  }

  update(body: NativeAirLightningFactoryPlan['body']): void {
    this.container.visible = body !== null
    for (const container of this.bandContainers) container.visible = body !== null
  }

  setOrigin(origin: Readonly<{ x: number; y: number }>): void {
    this.container.position.set(origin.x, origin.y)
    for (let index = 0; index < this.bandContainers.length; index += 1) {
      this.bandContainers[index]!.position.set(origin.x, origin.y)
      this.masks[index]!.position.x = -origin.x
    }
  }

  bandContainer(suffix: string): Container | null {
    if (!suffix.startsWith('body-band-')) return null
    const index = Number(suffix.slice('body-band-'.length))
    return Number.isSafeInteger(index) ? this.bandContainers[index] ?? null : null
  }
}

function airBodyBounds(
  body: NativeAirLightningFactoryPlan['body'],
): { height: number; y: number } {
  if (!body) return { height: 0, y: 0 }
  const ys = body.layers.flatMap((layer) => [
    ...vertexYs(layer.vertices),
    ...(layer.branch ? vertexYs(layer.branch.vertices) : []),
  ])
  if (ys.length === 0) return { height: 0, y: 0 }
  const minimum = Math.min(...ys)
  const maximum = Math.max(...ys)
  return { height: maximum - minimum, y: minimum }
}

function createAirBodyMeshes(
  body: NativeAirLightningFactoryPlan['body'],
  textures: NativeAirVfxTextures,
): MeshSimple[] {
  return body?.layers.flatMap((layer) => {
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
}

function vertexYs(vertices: ArrayLike<number>): number[] {
  const ys: number[] = []
  for (let index = 1; index < vertices.length; index += 2) ys.push(vertices[index]!)
  return ys
}

export class NativeAirCoronaView {
  readonly container: Container
  private readonly circles: readonly Sprite[]
  private readonly forks: readonly Sprite[]
  private readonly textures: NativeAirVfxTextures

  constructor(label: string, textures: NativeAirVfxTextures) {
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
