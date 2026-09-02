import {
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
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
  buildNativeAirLightningPlanFromFactory,
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
  private readonly activePainterRoots: AirPainterRoot[] = []
  private readonly body: NativeAirLightningBodyView | null
  private readonly bodyPainterRoot: AirPainterRoot | null
  readonly containers: readonly Container[]
  private readonly contactCorona: NativeAirCoronaView | null
  private readonly contactPainterRoot: AirPainterRoot | null
  private readonly factory: NativeAirLightningFactoryPlan
  readonly kind = 'air'
  private plan: ReturnType<typeof buildNativeAirLightningPlan>
  private state: NativeAirLightningViewState
  private readonly sourceCorona: NativeAirCoronaView | null
  private readonly sourcePainterRoot: AirPainterRoot | null

  constructor(
    state: NativeAirLightningViewState,
    textures: NativeAirVfxTextures,
    options: { split?: boolean } = {},
  ) {
    this.state = state
    const construction = buildNativeAirLightningPlan({
      ageTicks: state.ageTicks,
      birthTick: state.birthTick,
      ...localAirGeometry(state),
      id: state.id,
      underpowered: state.underpowered,
    })
    this.factory = construction
    this.body = construction.body
      ? new NativeAirLightningBodyView(
          'air-body',
          construction.body,
          textures,
          options.split ?? true,
        )
      : null
    this.sourceCorona = construction.sourceCorona
      ? new NativeAirCoronaView('air-source-corona', textures)
      : null
    this.contactCorona = construction.contactCorona.alpha > 0
      ? new NativeAirCoronaView('air-contact-corona', textures)
      : null
    this.containers = [
      ...(this.body?.containers ?? []),
      ...(this.sourceCorona ? [this.sourceCorona.container] : []),
      ...(this.contactCorona ? [this.contactCorona.container] : []),
    ]
    this.plan = construction
    this.bodyPainterRoot = this.body ? bodyPainterRoot(this.body, state) : null
    this.sourcePainterRoot = this.sourceCorona
      ? coronaPainterRoot(this.sourceCorona.container, 'source', 0)
      : null
    this.contactPainterRoot = this.contactCorona
      ? coronaPainterRoot(
          this.contactCorona.container,
          'contact',
          AIR_LIGHTNING_CONTACT_SORT_BIAS,
        )
      : null
    this.update(state)
  }

  update(
    state: PrimarySpellProjectileState
      | PrimarySpellTransientState
      | NativeAirLightningViewState,
  ): void {
    if (!('origin' in state) || state.kind !== 'air') return
    this.state = state
    const plan = buildNativeAirLightningPlanFromFactory({
      ageTicks: state.ageTicks,
      id: state.id,
      underpowered: state.underpowered,
    }, this.factory)
    this.plan = plan
    if (this.body) {
      this.body.setOrigin(state.origin)
      this.body.update(plan.body)
    }
    this.sourceCorona?.update(plan.sourceCorona, state.origin)
    this.contactCorona?.update(plan.contactCorona, state.origin)
    this.updatePainterRoots()
  }

  painterRoots(): readonly AirPainterRoot[] {
    return this.activePainterRoots
  }

  setTint(suffix: string, tint: number): void {
    const bodyBand = this.body?.bandContainer(suffix)
    if (bodyBand) {
      bodyBand.tint = tint
      return
    }
    const root = this.painterRoots().find((candidate) => candidate.suffix === suffix)
    if (root) root.container.tint = tint
  }

  painterContainer(suffix: string): Container | null {
    return this.body?.bandContainer(suffix) ?? null
  }

  destroy(): void {
    this.body?.destroy()
    this.sourceCorona?.destroy()
    this.contactCorona?.destroy()
    this.activePainterRoots.length = 0
  }

  private updatePainterRoots(): void {
    const roots = this.activePainterRoots
    roots.length = 0
    if (this.plan.body && this.bodyPainterRoot && this.body) {
      this.bodyPainterRoot.worldY = this.state.origin.y + this.body.boundsY
      for (let index = 0; index < this.body.painterInsertions.length; index += 1) {
        this.body.painterInsertions[index]!.worldY = (
          this.state.origin.y + this.body.bands[index]!.painterY
        )
      }
      roots.push(this.bodyPainterRoot)
    }
    if (this.plan.sourceCorona && this.sourcePainterRoot) {
      this.sourcePainterRoot.worldY = (
        this.state.origin.y + this.plan.sourceCorona.center.y
      )
      roots.push(this.sourcePainterRoot)
    }
    if (this.plan.contactCorona.alpha > 0 && this.contactPainterRoot) {
      this.contactPainterRoot.worldY = (
        this.state.origin.y + this.plan.contactCorona.center.y
      )
      roots.push(this.contactPainterRoot)
    }
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
  insertions?: readonly AirPainterInsertion[]
  lane: 'world-sorted'
  queueFamily: 'ordinary-dynamic'
  regionLightPoint: { x: number, y: number } | null
  sortBias: number
  suffix: string
  visible?: boolean
  worldY: number
}

interface AirPainterInsertion {
  readonly sortBias: 0
  readonly suffix: string
  readonly visible: true
  worldY: number
}

function bodyPainterRoot(
  body: NativeAirLightningBodyView,
  state: NativeAirLightningViewState,
): AirPainterRoot {
  const split = body.bands.length > 0
  return {
    container: body.container,
    ...(split ? { insertions: body.painterInsertions } : {}),
    lane: 'world-sorted',
    queueFamily: 'ordinary-dynamic',
    regionLightPoint: null,
    sortBias: 0,
    suffix: 'body',
    ...(split ? { visible: false } : {}),
    worldY: state.origin.y + body.boundsY,
  }
}

function coronaPainterRoot(
  container: Container,
  suffix: 'contact' | 'source',
  sortBias: number,
): AirPainterRoot {
  return {
    container,
    lane: 'world-sorted',
    queueFamily: 'ordinary-dynamic',
    regionLightPoint: null,
    sortBias,
    suffix,
    worldY: 0,
  }
}

export class NativeAirLightningBodyView {
  readonly container: Container
  readonly containers: readonly Container[]
  readonly bands: readonly NativeZAnimSplitBand[]
  readonly boundsY: number
  readonly painterInsertions: readonly AirPainterInsertion[]
  private readonly bandContainers: readonly Container[]
  private readonly masks: Graphics[]
  private readonly meshResources: readonly AirBodyMeshResource[]

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
    this.painterInsertions = Object.freeze(this.bands.map((band, index) => ({
      sortBias: 0 as const,
      suffix: `body-band-${index}`,
      visible: true as const,
      worldY: band.painterY,
    })))
    this.meshResources = createAirBodyMeshResources(body, textures)
    this.masks = []
    this.bandContainers = this.bands.map((band, bandIndex) => {
      const root = new Container({ label: `${label}-band-${bandIndex}` })
      root.eventMode = 'none'
      const content = new Container({ label: `${label}-band-content-${bandIndex}` })
      content.eventMode = 'none'
      const meshes = createAirBodyMeshes(this.meshResources)
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
    if (!split) this.container.addChild(...createAirBodyMeshes(this.meshResources))
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

  destroy(): void {
    for (const container of this.containers) {
      container.removeFromParent()
      container.destroy({ children: true })
    }
    for (const resource of this.meshResources) resource.geometry.destroy(true)
    this.masks.length = 0
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

interface AirBodyMeshResource {
  readonly alpha: number
  readonly geometry: MeshGeometry
  readonly texture: Texture
  readonly tint: number
}

function createAirBodyMeshResources(
  body: NativeAirLightningFactoryPlan['body'],
  textures: NativeAirVfxTextures,
): readonly AirBodyMeshResource[] {
  return body?.layers.flatMap((layer) => {
    const resources: AirBodyMeshResource[] = [{
      alpha: layer.alpha,
      geometry: new MeshGeometry({
        indices: layer.indices,
        positions: layer.vertices,
        topology: 'triangle-list',
        uvs: layer.uvs,
      }),
      texture: textures.ribbon,
      tint: layer.tint,
    }]
    if (!layer.branch) return resources
    resources.push({
      alpha: layer.alpha,
      geometry: new MeshGeometry({
        indices: layer.branch.indices,
        positions: layer.branch.vertices,
        topology: 'triangle-list',
        uvs: layer.branch.uvs,
      }),
      texture: textures.branches[
        AIR_LIGHTNING_BRANCH_RECORDS.indexOf(layer.branch.textureRecord)
      ],
      tint: layer.tint,
    })
    return resources
  }) ?? []
}

function createAirBodyMeshes(resources: readonly AirBodyMeshResource[]): Mesh[] {
  return resources.map((resource) => {
    const mesh = new Mesh({
      geometry: resource.geometry,
      texture: resource.texture,
    })
    mesh.alpha = resource.alpha
    mesh.blendMode = 'add'
    mesh.eventMode = 'none'
    mesh.tint = resource.tint
    return mesh
  })
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

  destroy(): void {
    this.container.removeFromParent()
    this.container.destroy({ children: true })
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
