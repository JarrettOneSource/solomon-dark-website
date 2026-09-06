import { Container, Sprite } from 'pixi.js'
import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { NativeBossSpellMesh } from './native-boss-spell-mesh.ts'
import { nativeBossSpellLayers } from './native-boss-spell-presentation.ts'
import { nativeDarkLightningBody } from './native-dark-lightning.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { NativeRainCloud } from './native-rain-cloud.ts'
import { NativeAirLightningBodyView } from './primary-spell-air-view.ts'

type BossSpellView = { mesh: NativeBossSpellMesh | null; root: Container; sprites: Sprite[]; body: NativeAirLightningBodyView | null; rain: NativeRainCloud | null }

export class NativeBossSpellViews {
  private readonly views = new Map<number, BossSpellView>()
  private readonly root: Container
  private readonly textures: Pick<BoneyardWorldTextures, 'base' | 'greenPlasma'>

  constructor(root: Container, textures: Pick<BoneyardWorldTextures, 'base' | 'greenPlasma'>) {
    this.root = root
    this.textures = textures
  }

  update(spells: readonly NativeBossSpell[], tick: number, viewHeight = 900): void {
    const live = new Set<number>()
    for (const spell of spells) {
      live.add(spell.id)
      let view = this.views.get(spell.id)
      if (view === undefined) {
        if (spell.kind === 'blightning') {
          const texture = (entry: number) => this.textures.base[nativeEnemySpriteRecord('BadGuys', entry).source]!
          const body = new NativeAirLightningBodyView(`boss-spell:${spell.id}`, nativeDarkLightningBody(spell), {
            ribbon: texture(64), branches: [texture(373), texture(374)],
          })
          view = { mesh: null, root: body.container, sprites: [], body, rain: null }
          this.root.addChild(...body.containers)
        } else {
          view = { mesh: spell.kind === 'ultra-banish' || spell.kind === 'mouth-beam-segment' ? new NativeBossSpellMesh(spell, this.textures.greenPlasma) : null, root: new Container({ label: `boss-spell:${spell.kind}:${spell.id}` }), sprites: [], body: null,
            rain: spell.kind === 'rain-of-bones' ? new NativeRainCloud(spell, tick) : null }
          view.root.eventMode = 'none'
          if (view.mesh !== null) view.root.addChild(view.mesh.mesh)
          this.root.addChild(view.root)
        }
        this.views.set(spell.id, view)
      }
      if (view.body !== null) {
        view.body.setOrigin(spell.position)
        continue
      }
      if (view.mesh !== null && (spell.kind === 'ultra-banish' || spell.kind === 'mouth-beam-segment')) view.mesh.update(spell, tick, viewHeight)
      const layers = [
        ...(spell.kind === 'rain-of-bones' ? view.rain!.update(spell, tick) : []),
        ...nativeBossSpellLayers(spell, tick),
      ]
      while (view.sprites.length < layers.length) {
        const sprite = new Sprite()
        sprite.eventMode = 'none'
        view.root.addChild(sprite)
        view.sprites.push(sprite)
      }
      while (view.sprites.length > layers.length) view.sprites.pop()!.destroy()
      layers.forEach((layer, index) => {
        const sprite = view.sprites[index]!
        const record = nativeEnemySpriteRecord(layer.atlas, layer.entry)
        const texture = this.textures.base[record.source]
        if (texture === undefined) throw new Error(`Boss spell texture is missing: ${record.source}`)
        sprite.texture = texture
        sprite.label = layer.role
        sprite.anchor.set(record.anchorX / record.width, record.anchorY / record.height)
        sprite.position.set(layer.offset.x, layer.offset.y)
        sprite.rotation = layer.rotationRadians
        sprite.scale.set(layer.scaleX ?? layer.scale, layer.scaleY ?? layer.scale)
        sprite.alpha = layer.alpha
        sprite.blendMode = layer.blendMode
        sprite.tint = layer.tint
      })
      view.root.position.set(spell.position.x, spell.position.y)
    }
    for (const [id, view] of this.views) {
      if (live.has(id)) continue
      if (view.body !== null) view.body.destroy()
      else { view.mesh?.destroy(); view.root.destroy({ children: true }) }
      this.views.delete(id)
    }
  }

  painterLayers(spells: readonly NativeBossSpell[]): readonly DynamicPainterLayer[] {
    return spells.map((spell): DynamicPainterLayer => {
      const body = this.views.get(spell.id)?.body
      const base = { id: `boss-spell:${spell.id}`, registration: spell.painterRegistration,
        sortBias: spell.kind === 'ultra-banish' ? 50 : spell.kind === 'green-fire' ? -25 : spell.kind === 'death-magic' ? spell.painterSortBias : spell.kind === 'heartmonger-flicker' ? -200 : 0, worldY: spell.position.y }
      if (body) return { ...base, queueFamily: 'ordinary-dynamic', visible: false,
        worldY: spell.position.y + body.boundsY,
        insertions: body.painterInsertions.map((insertion) => ({
          id: `${base.id}:${insertion.suffix}`, sortBias: 0, visible: true,
          worldY: spell.position.y + insertion.worldY,
        })) }
      if (spell.kind === 'rain-of-bones') return { ...base, queueFamily: 'ordinary-dynamic', visible: false,
        insertions: [{ id: `${base.id}:cloud`, sortBias: 0, visible: true, worldY: spell.position.y + 350 }] }
      return { ...base, queueFamily: spell.painterRegistration.managerLane === 'transient' ? 'zanim' : 'ordinary-dynamic' }
    })
  }

  applyPainterDepths(spells: readonly NativeBossSpell[], depths: ReadonlyMap<string, Readonly<{ zIndex: number }>>): void {
    for (const spell of spells) {
      const view = this.views.get(spell.id)
      if (view === undefined) continue
      const id = `boss-spell:${spell.id}`
      if (view.body !== null) {
        for (const insertion of view.body.painterInsertions) {
          view.body.bandContainer(insertion.suffix)!.zIndex = depths.get(`${id}:${insertion.suffix}`)?.zIndex ?? 1
        }
      } else view.root.zIndex = depths.get(spell.kind === 'rain-of-bones' ? `${id}:cloud` : id)?.zIndex ?? 1
    }
  }

  destroy(): void {
    for (const view of this.views.values()) {
      if (view.body !== null) view.body.destroy()
      else { view.mesh?.destroy(); view.root.destroy({ children: true }) }
    }
    this.views.clear()
  }
}
