import type { Vec2 } from '../../editor/model.ts'
import { worldToScreen, type Camera } from '../../editor/render.ts'
import type { GameViewportLayout } from './game-viewport.ts'
import { initialHubResolution } from './hub-render-contract.ts'
import {
  nativeDirectEnvironmentLightAlpha,
} from './boneyard-environment-light-plan.ts'

export interface BoneyardEnvironmentLightImages {
  aperture: HTMLImageElement
}

export function paintBoneyardEnvironmentLight(
  canvas: HTMLCanvasElement,
  players: Readonly<Record<string, { readonly position: Vec2 }>>,
  camera: Camera,
  viewport: GameViewportLayout,
  now: number,
  images: BoneyardEnvironmentLightImages,
): void {
  const resolution = initialHubResolution({
    devicePixelRatio: window.devicePixelRatio || 1,
    displayScale: viewport.displayScale,
  })
  const width = Math.round(viewport.width * resolution)
  const height = Math.round(viewport.height * resolution)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(resolution, 0, 0, resolution, 0, 0)
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  context.clearRect(0, 0, viewport.width, viewport.height)
  context.globalCompositeOperation = 'lighter'

  let playerIndex = 0
  for (const playerId in players) {
    const position = worldToScreen(
      players[playerId]!.position,
      camera,
      viewport.width,
      viewport.height,
    )
    context.globalAlpha = nativeDirectEnvironmentLightAlpha(now, playerIndex)
    context.drawImage(
      images.aperture,
      position.x - 168 * camera.zoom,
      position.y - 153 * camera.zoom,
      images.aperture.naturalWidth * camera.zoom,
      images.aperture.naturalHeight * camera.zoom,
    )
    playerIndex += 1
  }
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
}
