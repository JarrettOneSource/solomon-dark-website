import {
  Container,
  FillGradient,
  Graphics,
  Sprite,
  Texture,
} from 'pixi.js'

import { spriteRefFor } from '../../editor/assets.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import {
  NativeBoneyardWeather,
  type NativeBoneyardWeatherDropPlan,
} from '../core-kernels/native-boneyard-weather.ts'

interface DropView {
  readonly fill: FillGradient
  readonly graphic: Graphics
}

export class NativeBoneyardWeatherView {
  readonly container = new Container({ label: 'native-boneyard-weather' })
  private readonly dropViews: DropView[] = []
  private readonly root: Container
  private readonly splashAnchor: BoneyardPoint
  private readonly splashTexture: Texture
  private readonly splashViews: Sprite[] = []
  private readonly weather: NativeBoneyardWeather

  constructor(
    root: Container,
    splashTexture: Texture,
    weather: NativeBoneyardWeather,
  ) {
    const ref = spriteRefFor('DeadHawg', 24)
    if (!ref) throw new Error('Native Boneyard weather splash record 24 is unavailable.')
    this.root = root
    this.splashAnchor = {
      x: ref.anchorX / ref.w,
      y: ref.anchorY / ref.h,
    }
    this.splashTexture = splashTexture
    this.weather = weather
    this.container.sortableChildren = true
    this.root.addChild(this.container)
  }

  update(lightAt: (position: Readonly<BoneyardPoint>) => number = () => 1): void {
    const plan = this.weather.plan(lightAt)
    while (this.dropViews.length < plan.drops.length) this.addDropView()
    while (this.splashViews.length < plan.splashes.length) this.addSplashView()
    for (let index = 0; index < this.dropViews.length; index += 1) {
      const view = this.dropViews[index]!
      const drop = plan.drops[index]
      view.graphic.renderable = drop !== undefined
      if (drop) applyDrop(view, drop)
    }
    for (let index = 0; index < this.splashViews.length; index += 1) {
      const sprite = this.splashViews[index]!
      const splash = plan.splashes[index]
      sprite.renderable = splash !== undefined
      if (!splash) continue
      sprite.label = `native-boneyard-weather-splash:${plan.splashAsset.atlas}:${plan.splashAsset.entry}`
      sprite.texture = this.splashTexture
      sprite.anchor.set(this.splashAnchor.x, this.splashAnchor.y)
      sprite.position.set(splash.position.x, splash.position.y)
      sprite.rotation = 0
      sprite.scale.set(splash.scale)
      sprite.alpha = splash.alpha
      sprite.tint = 0xffffff
      sprite.zIndex = 1_000 + splash.id
    }
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  setRenderable(renderable: boolean): void {
    this.container.renderable = renderable
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
    for (const view of this.dropViews) view.fill.destroy()
    this.dropViews.length = 0
    this.splashViews.length = 0
  }

  private addDropView(): void {
    const fill = new FillGradient({
      colorStops: [
        { color: 'rgba(255,255,255,0)', offset: 0 },
        { color: 'rgba(255,255,255,0.5)', offset: 1 },
      ],
      end: { x: 0, y: 1 },
      start: { x: 0, y: 0 },
      textureSpace: 'local',
    })
    const graphic = new Graphics({ label: 'native-boneyard-weather-drop' })
    graphic.eventMode = 'none'
    this.dropViews.push({ fill, graphic })
    this.container.addChild(graphic)
  }

  private addSplashView(): void {
    const sprite = new Sprite(this.splashTexture)
    sprite.eventMode = 'none'
    sprite.renderable = false
    this.splashViews.push(sprite)
    this.container.addChild(sprite)
  }
}

function applyDrop(view: DropView, drop: NativeBoneyardWeatherDropPlan): void {
  view.graphic.label = `native-boneyard-weather-drop:${drop.id}`
  view.graphic.clear()
    .moveTo(drop.start.x, drop.start.y)
    .lineTo(drop.end.x, drop.end.y)
    .stroke({ cap: 'butt', fill: view.fill, width: drop.width })
  view.graphic.tint = drop.startColor
  view.graphic.alpha = 1
  view.graphic.zIndex = drop.id
}
