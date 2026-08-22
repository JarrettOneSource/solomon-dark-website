import {
  BufferImageSource,
  Container,
  Particle,
  ParticleContainer,
  Sprite,
  Texture,
} from 'pixi.js'

import { spriteRefFor } from '../../editor/assets.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import {
  NATIVE_BONEYARD_WEATHER_SPLASH,
  NATIVE_BONEYARD_WEATHER_STREAK_WIDTH,
  NativeBoneyardWeather,
} from '../core-kernels/native-boneyard-weather.ts'
import type { NativeBoneyardWeatherLightingOrder } from './boneyard-lighting.ts'

const WEATHER_STREAK_RAMP_HEIGHT = 256

export class NativeBoneyardWeatherView {
  private readonly dropContainer: ParticleContainer<Particle>
  private readonly dropTexture: Texture
  private readonly dropViews: Particle[] = []
  private readonly root: Container
  private readonly splashContainer = new Container({ label: 'native-boneyard-weather-splashes' })
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
    this.dropTexture = weatherStreakRampTexture()
    this.dropContainer = new ParticleContainer({
      dynamicProperties: {
        color: true,
        position: true,
        vertex: true,
      },
      texture: this.dropTexture,
    })
    this.dropContainer.label = 'native-boneyard-weather-streaks'
    this.root.addChild(this.splashContainer, this.dropContainer)
  }

  update(lightAt: (position: Readonly<BoneyardPoint>) => number = () => 1): void {
    while (this.dropViews.length < this.weather.activeDropCount) this.addDropView()
    while (this.splashViews.length < this.weather.activeSplashCount) this.addSplashView()
    this.weather.visitDrops(lightAt, this.updateDropView)
    this.weather.visitSplashes(this.updateSplashView)
    for (
      let index = this.weather.activeDropCount;
      index < this.dropViews.length;
      index += 1
    ) this.dropViews[index]!.alpha = 0
    for (
      let index = this.weather.activeSplashCount;
      index < this.splashViews.length;
      index += 1
    ) this.splashViews[index]!.renderable = false
  }

  setDepth(order: NativeBoneyardWeatherLightingOrder): void {
    this.splashContainer.zIndex = order.splashZIndex
    this.dropContainer.zIndex = order.streakZIndex
  }

  setRenderable(renderable: boolean): void {
    this.splashContainer.renderable = renderable
    this.dropContainer.renderable = renderable
  }

  destroy(): void {
    this.root.removeChild(this.splashContainer, this.dropContainer)
    this.splashContainer.destroy({ children: true })
    this.dropContainer.removeParticles()
    this.dropContainer.destroy()
    this.dropTexture.destroy(true)
    this.dropViews.length = 0
    this.splashViews.length = 0
  }

  private addDropView(): void {
    const particle = new Particle({
      anchorX: 0.5,
      anchorY: 0.5,
      texture: this.dropTexture,
    })
    particle.alpha = 0
    this.dropViews.push(particle)
    this.dropContainer.addParticle(particle)
  }

  private addSplashView(): void {
    const sprite = new Sprite({
      label: `native-boneyard-weather-splash:${NATIVE_BONEYARD_WEATHER_SPLASH.atlas}:${NATIVE_BONEYARD_WEATHER_SPLASH.entry}`,
      texture: this.splashTexture,
    })
    sprite.anchor.set(this.splashAnchor.x, this.splashAnchor.y)
    sprite.blendMode = 'add'
    sprite.eventMode = 'none'
    sprite.renderable = false
    this.splashViews.push(sprite)
    this.splashContainer.addChild(sprite)
  }

  private readonly updateDropView = (
    index: number,
    _id: number,
    x: number,
    y: number,
    length: number,
    color: number,
  ): void => {
    const particle = this.dropViews[index]!
    particle.alpha = 1
    particle.x = x
    particle.y = y
    particle.scaleX = NATIVE_BONEYARD_WEATHER_STREAK_WIDTH
    particle.scaleY = length / WEATHER_STREAK_RAMP_HEIGHT
    particle.tint = color
  }

  private readonly updateSplashView = (
    index: number,
    _id: number,
    x: number,
    y: number,
    scale: number,
    alpha: number,
  ): void => {
    const sprite = this.splashViews[index]!
    sprite.renderable = true
    sprite.position.set(x, y)
    sprite.scale.set(scale)
    sprite.alpha = alpha
  }
}

export function nativeBoneyardWeatherStreakRampPixels(): Uint8Array {
  const pixels = new Uint8Array(WEATHER_STREAK_RAMP_HEIGHT * 4)
  for (let row = 0; row < WEATHER_STREAK_RAMP_HEIGHT; row += 1) {
    const offset = row * 4
    pixels[offset] = 0xff
    pixels[offset + 1] = 0xff
    pixels[offset + 2] = 0xff
    pixels[offset + 3] = Math.round(
      row / (WEATHER_STREAK_RAMP_HEIGHT - 1) * 0.5 * 0xff,
    )
  }
  return pixels
}

function weatherStreakRampTexture(): Texture {
  return new Texture({
    label: 'native-boneyard-weather-streak-ramp',
    source: new BufferImageSource({
      alphaMode: 'premultiply-alpha-on-upload',
      height: WEATHER_STREAK_RAMP_HEIGHT,
      label: 'native-boneyard-weather-streak-ramp-source',
      resource: nativeBoneyardWeatherStreakRampPixels(),
      scaleMode: 'linear',
      width: 1,
    }),
  })
}
