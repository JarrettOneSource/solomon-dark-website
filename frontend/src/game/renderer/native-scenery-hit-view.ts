import { Sprite, type Container } from 'pixi.js'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import { nativePuppetHitAlpha, nativePuppetHitTimer, type NativeWorldPuppetHit } from '../core-kernels/native-puppet-hit.ts'
import { createNativeSurfaceRedraw } from './boneyard-building-surface-view.ts'
import type { BuildingResidents, ResidentTexture, TreeResidents } from './boneyard-renderer-model.ts'
import { nativePuppetHitTint, setNativeDiffuseColor } from './native-texture-color.ts'

interface SceneryRedraw {
  readonly body: { readonly display: Container; destroy(): void }
  readonly proxy: { readonly display: Container; destroy(): void } | null
}

export class NativeSceneryHitView {
  private readonly layers = new Map<string, number>()
  private readonly views = new Map<string, SceneryRedraw>()
  private readonly residents: ReadonlyMap<number, ResidentTexture>
  private readonly proxies = new Map<string, ResidentTexture>()
  private readonly buildingIds = new Set<string>()

  constructor(layers: readonly MainLayer[], residents: ReadonlyMap<number, ResidentTexture>,
    trees: ReadonlyMap<string, TreeResidents>, buildings: ReadonlyMap<string, BuildingResidents>) {
    this.residents = residents
    layers.forEach((layer, index) => {
      if (layer.kind === 'object') this.layers.set(`scenery:${layer.object.eid}`, index)
      else if (layer.part === 'post') this.layers.set(`fencepost:${layer.pieceIndex}`, index)
    })
    for (const [id, tree] of trees) this.proxies.set(`scenery:${id}`, tree.proxy)
    for (const [id, building] of buildings) {
      this.proxies.set(`scenery:${id}`, building.roof)
      this.buildingIds.add(`scenery:${id}`)
    }
  }

  update(hits: readonly NativeWorldPuppetHit[], tick: number, complexLighting: boolean): void {
    const live = new Set<string>()
    for (const hit of hits) {
      if (hit.kind !== 'scenery') continue
      const index = this.layers.get(hit.targetId)
      const resident = index === undefined ? undefined : this.residents.get(index)
      if (!resident || resident.sprite.destroyed) continue
      live.add(hit.targetId)
      let view = this.views.get(hit.targetId)
      if (!view) {
        const proxy = this.proxies.get(hit.targetId)
        view = { body: redraw(resident, true), proxy: proxy && !proxy.sprite.destroyed ? redraw(proxy, false) : null }
        this.views.set(hit.targetId, view)
      }
      const active = nativePuppetHitTimer(hit.feedback, tick) > 0
      const vertexColorsOwnMaterial = complexLighting && this.buildingIds.has(hit.targetId)
      view.body.display.visible = active
      view.body.display.alpha = vertexColorsOwnMaterial ? 1 : nativePuppetHitAlpha(hit.feedback, tick)
      view.body.display.tint = vertexColorsOwnMaterial ? 0xffffff : nativePuppetHitTint(complexLighting)
      // Main enqueues a second ordinary upper proxy; it does not retain hit RGBA.
      if (view.proxy) view.proxy.display.visible = active
        && (complexLighting || !this.buildingIds.has(hit.targetId))
    }
    for (const [id, view] of this.views) {
      if (live.has(id)) continue
      view.body.destroy()
      view.proxy?.destroy()
      this.views.delete(id)
    }
  }

  destroy(): void {
    for (const view of this.views.values()) { view.body.destroy(); view.proxy?.destroy() }
    this.views.clear()
  }
}

function redraw(resident: ResidentTexture, diffuse: boolean): { display: Container; destroy(): void } {
  if (resident.surfaceMesh) {
    const copy = createNativeSurfaceRedraw(resident.surfaceMesh, diffuse)
    copy.mesh.label = diffuse ? 'native-puppet-hit' : 'native-hit-upper-proxy'
    resident.sprite.addChild(copy.mesh)
    return { display: copy.mesh, destroy: copy.destroy }
  }
  if (!(resident.sprite instanceof Sprite)) throw new Error('Native scenery main is missing its glyph or surface')
  const copy = new Sprite({ texture: resident.sprite.texture, eventMode: 'none',
    label: diffuse ? 'native-puppet-hit' : 'native-hit-upper-proxy' })
  copy.anchor.copyFrom(resident.sprite.anchor)
  setNativeDiffuseColor(copy, diffuse)
  resident.sprite.addChild(copy)
  return { display: copy, destroy() { copy.destroy() } }
}
