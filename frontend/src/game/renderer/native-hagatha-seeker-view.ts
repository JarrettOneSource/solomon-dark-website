import {
  BufferImageSource,
  Container,
  MeshSimple,
  Texture,
} from 'pixi.js'

import {
  NATIVE_HAGATHA_SEEKER_RAMP_RGBA,
  NATIVE_HAGATHA_SELECTORS,
  nativeHagathaSeekerMeshPlan,
  nativeHagathaSeekerSegments,
} from '../core-kernels/native-hagatha-effects.ts'
import type { GameSnapshot } from '../protocol/game-protocol.ts'

const QUAD_INDICES = new Uint32Array([0, 1, 2, 1, 2, 3])

export class NativeHagathaSeekerView {
  readonly container = new Container({ label: 'hagatha-seeker' })
  private readonly meshes: MeshSimple[] = []
  private readonly rampTexture: Texture
  private renderedSegmentCount = 0
  private readonly root: Container
  private readonly vertices: Float32Array[] = []

  constructor(root: Container) {
    this.root = root
    this.rampTexture = seekerRampTexture()
    this.container.eventMode = 'none'
    this.root.addChild(this.container)
  }

  update(snapshot: GameSnapshot, localPlayerId: string): void {
    this.renderedSegmentCount = 0
    if (snapshot.world.kind !== 'boneyard') {
      this.syncMeshCount([])
      return
    }
    const player = snapshot.players[localPlayerId]
    if (
      player === undefined
      || !player.economy.ownedPerkSelectors.includes(NATIVE_HAGATHA_SELECTORS.seeker)
    ) {
      this.syncMeshCount([])
      return
    }
    const segments = nativeHagathaSeekerSegments(
      player.position,
      snapshot.world.loot.flatMap((actor) => (
        actor.kind === 'gold' || actor.kind === 'sack' || actor.kind === 'bonus'
          ? [{ id: actor.id, kind: actor.kind, position: actor.position }]
          : []
      )),
      snapshot.tick,
    )
    this.renderedSegmentCount = segments.length
    this.syncMeshCount(segments)
    for (const [index, segment] of segments.entries()) {
      const plan = nativeHagathaSeekerMeshPlan(segment)
      this.vertices[index]!.set(plan.vertices)
      this.meshes[index]!.alpha = plan.alpha
    }
  }

  get segmentCount(): number {
    return this.renderedSegmentCount
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
    this.rampTexture.destroy(true)
    this.meshes.length = 0
    this.vertices.length = 0
  }

  private syncMeshCount(
    segments: ReturnType<typeof nativeHagathaSeekerSegments>,
  ): void {
    while (this.meshes.length < segments.length) {
      const segment = segments[this.meshes.length]!
      const plan = nativeHagathaSeekerMeshPlan(segment)
      const vertices = new Float32Array(plan.vertices)
      const mesh = new MeshSimple({
        indices: QUAD_INDICES,
        texture: this.rampTexture,
        topology: 'triangle-list',
        uvs: new Float32Array(plan.uvs),
        vertices,
      })
      mesh.alpha = plan.alpha
      mesh.eventMode = 'none'
      mesh.label = 'hagatha-seeker-segment'
      this.meshes.push(mesh)
      this.vertices.push(vertices)
      this.container.addChild(mesh)
    }
    while (this.meshes.length > segments.length) {
      const mesh = this.meshes.pop()!
      this.vertices.pop()
      this.container.removeChild(mesh)
      mesh.destroy()
    }
  }
}

function seekerRampTexture(): Texture {
  return new Texture({
    label: 'hagatha-seeker-gradient-ramp',
    source: new BufferImageSource({
      addressMode: 'clamp-to-edge',
      alphaMode: 'no-premultiply-alpha',
      format: 'rgba8unorm',
      height: 1,
      label: 'hagatha-seeker-gradient-ramp-source',
      resource: new Uint8Array(NATIVE_HAGATHA_SEEKER_RAMP_RGBA),
      scaleMode: 'linear',
      width: 2,
    }),
  })
}
