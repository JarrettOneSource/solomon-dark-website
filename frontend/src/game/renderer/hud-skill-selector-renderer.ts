import { Container, Graphics } from 'pixi.js'

import { skillPicker } from '../../lib/assets.ts'
import {
  NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE,
  NATIVE_HUD_SKILL_SELECTOR_CENTER_X,
  NATIVE_HUD_SKILL_SELECTOR_CENTER_Y,
  nativeHudSkillSelectorLayout,
  type NativeHudSkillSelectorOption,
} from '../hud-skill-selector.ts'
import { destroyNativeUiPixiFor } from '../native-ui/native-ui-pixi.ts'
import {
  createGameWebGlApplication,
  loadGameTextureMap,
  type GameTextureMap,
  type GameWebGlApplication,
} from './game-webgl.ts'
import {
  addBitmapText,
  measureNativeBitmapText,
  spriteFor,
} from './skill-picker-renderer.ts'

export interface HudSkillSelectorRendererPresentation {
  readonly options: readonly NativeHudSkillSelectorOption[]
  readonly title: string
}

export interface HudSkillSelectorRenderer {
  readonly canvas: HTMLCanvasElement
  destroy(): void
  setPresentation(presentation: HudSkillSelectorRendererPresentation): void
}

export async function createHudSkillSelectorRenderer(): Promise<HudSkillSelectorRenderer> {
  let gpu: GameWebGlApplication | undefined
  let textures: GameTextureMap | undefined
  try {
    ;[gpu, textures] = await Promise.all([
      createGameWebGlApplication({
        backgroundAlpha: 0,
        className: 'hud-skill-selector-canvas',
        height: 900,
        resolution: 1,
        width: 1_600,
      }),
      loadGameTextureMap({
        stock: [
          skillPicker.fontsAtlas,
          skillPicker.skillsAtlas,
        ],
      }),
    ])
  } catch (error) {
    gpu?.application.destroy({ removeView: true })
    textures?.destroy()
    throw error
  }

  const application = gpu.application
  const resources = textures
  const root = new Container()
  application.stage.addChild(root)
  let destroyed = false

  return {
    canvas: gpu.canvas,
    destroy() {
      if (destroyed) return
      destroyed = true
      application.destroy({ removeView: true })
      destroyNativeUiPixiFor(resources)
      resources.destroy()
    },
    setPresentation({ options, title }) {
      if (destroyed) return
      root.removeChildren().forEach((child) => child.destroy({ children: true }))
      const layout = nativeHudSkillSelectorLayout(
        options.length,
        measureNativeBitmapText(title, 'medium'),
      )
      root.addChild(new Graphics()
        .rect(layout.panelLeft, layout.panelTop, layout.panelWidth, layout.panelHeight)
        .fill({ color: 0x000000, alpha: 0.95 }))
      const titleLayer = new Container()
      titleLayer.alpha = 0.75
      addBitmapText(
        titleLayer,
        resources,
        title,
        'medium',
        NATIVE_HUD_SKILL_SELECTOR_CENTER_X,
        layout.titleY,
        { tint: 0xd9ba70 },
      )
      root.addChild(titleLayer)
      options.forEach(({ iconRecord }, index) => {
        const icon = spriteFor(resources, 'Skills', iconRecord)
        icon.anchor.set(0.5)
        icon.position.set(
          layout.optionLeft
            + NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE / 2
            + index * NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE,
          NATIVE_HUD_SKILL_SELECTOR_CENTER_Y,
        )
        root.addChild(icon)
      })
      application.renderer.render(application.stage)
    },
  }
}
