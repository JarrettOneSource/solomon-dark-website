import {
  NATIVE_GATE_ART_INDICES,
  NATIVE_GATE_ART_UVS,
  type NativeGateLeaf,
  nativeGateArtVertices,
  nativeGateHingeArtPosition,
  nativeGateLeaf,
  nativeGateRules,
} from '../../editor/native-fence-geometry.ts'
import type { BoneyardGateLeafSnapshot } from '../core-kernels/boneyard.ts'
import { plantedSprite, requiredSpriteRef, requiredTexture } from './boneyard-solomon-view.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { Container, type ContainerChild, Graphics, MeshSimple, Sprite } from 'pixi.js'

export class BoneyardGateViews {
  private readonly leaves = new Map<string, BoneyardGateLeafView>()
  private readonly liveLeafIds = new Set<string>()
  private readonly root: Container
  private readonly textures: BoneyardWorldTextures

  constructor(
    root: Container,
    textures: BoneyardWorldTextures,
  ) {
    this.root = root
    this.textures = textures
  }

  update(leaves: readonly BoneyardGateLeafSnapshot[]): void {
    const live = this.liveLeafIds
    live.clear()
    for (const state of leaves) {
      const key = `${state.fenceEid}:${state.side}`
      live.add(key)
      let view = this.leaves.get(key)
      if (!view) {
        view = new BoneyardGateLeafView(this.root, this.textures)
        this.leaves.set(key, view)
      }
      view.update(state)
    }
    for (const [key, view] of this.leaves) {
      if (live.has(key)) continue
      view.destroy()
      this.leaves.delete(key)
    }
  }

  setDepth(fenceEid: string, side: number, depth: number): void {
    this.leaves.get(`${fenceEid}:${side}`)?.setDepth(depth)
  }

  depthOwner(fenceEid: string, side: number): ContainerChild | null {
    return this.leaves.get(`${fenceEid}:${side}`)?.container ?? null
  }

  setTint(fenceEid: string, side: number, tint: number): void {
    this.leaves.get(`${fenceEid}:${side}`)?.setTint(tint)
  }

  destroy(): void {
    for (const view of this.leaves.values()) view.destroy()
    this.leaves.clear()
    this.liveLeafIds.clear()
  }
}

class BoneyardGateLeafView {
  readonly container = new Container({ label: 'gate-leaf' })
  private readonly gateLeaf: MeshSimple
  private readonly gateVertices = new Float32Array(8)
  private readonly hinge: Sprite
  private readonly lines = new Graphics()
  private readonly root: Container

  constructor(root: Container, textures: BoneyardWorldTextures) {
    this.root = root
    const leafRef = requiredSpriteRef(7)
    const hingeRef = requiredSpriteRef(8)
    const leafTexture = requiredTexture(textures, leafRef)
    const hingeTexture = requiredTexture(textures, hingeRef)
    this.gateLeaf = new MeshSimple({
      texture: leafTexture,
      vertices: this.gateVertices,
      uvs: new Float32Array(NATIVE_GATE_ART_UVS),
      indices: new Uint32Array(NATIVE_GATE_ART_INDICES),
      topology: 'triangle-list',
    })
    this.hinge = plantedSprite(hingeTexture, hingeRef, { x: 0, y: 0 })
    this.gateLeaf.eventMode = 'none'
    this.gateLeaf.zIndex = 0
    this.hinge.zIndex = 1
    this.lines.zIndex = 2
    this.container.sortableChildren = true
    this.container.addChild(this.gateLeaf, this.hinge, this.lines)
    root.addChild(this.container)
  }

  update(state: BoneyardGateLeafSnapshot): void {
    const leaf = nativeGateLeaf(state.hinge, state.tip)
    nativeGateArtVertices(leaf, this.gateVertices)
    const hingeArt = nativeGateHingeArtPosition(leaf)
    this.hinge.position.set(hingeArt.x, hingeArt.y)
    drawGateLines(this.lines, leaf)
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setTint(tint: number): void {
    this.container.tint = tint
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function drawGateLines(graphics: Graphics, leaf: NativeGateLeaf): void {
  const [tipRule, centerRule] = nativeGateRules(leaf)
  graphics.clear()
  graphics
    .moveTo(tipRule.start.x, tipRule.start.y)
    .lineTo(tipRule.end.x, tipRule.end.y)
    .moveTo(centerRule.start.x, centerRule.start.y)
    .lineTo(centerRule.end.x, centerRule.end.y)
    .stroke({ color: 0x000000, width: 3 })
}
