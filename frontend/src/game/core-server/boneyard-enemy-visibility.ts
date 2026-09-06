import type { BoneyardBounds, BoneyardPoint } from '../core-kernels/boneyard.ts'
import { NATIVE_LIGHT_OUTER_DISTANCE, nativeBoneyardRadialLightScalar, type NativeBoneyardRadialLight } from '../core-kernels/native-boneyard-lighting.ts'
import { createIdlePlayerCharacterInput, type PlayerCharacterInput, type PlayerCharacterState } from '../core-kernels/player-character.ts'
import { nativePrimaryViewBounds } from '../core-kernels/primary-spell-targeting.ts'

export function createBoneyardEnemyVisibility(
  bounds: Readonly<BoneyardBounds>,
  players: Readonly<Record<string, PlayerCharacterState>>,
  inputs: Readonly<Record<string, PlayerCharacterInput>>,
  lights: readonly NativeBoneyardRadialLight[],
) {
  const views = Object.entries(players).map(([id, player]) => {
    const input = inputs[id] ?? createIdlePlayerCharacterInput()
    return nativePrimaryViewBounds({ bounds, focus: player.position, padding: 0, scale: 1.35,
      viewportWidth: input.viewportWidth, viewportHeight: input.viewportHeight })
  })
  const minX = Math.min(...views.map(view => view.x))
  const minY = Math.min(...views.map(view => view.y))
  return {
    ...(views.length === 0 ? {} : { nativeViewBounds: { x: minX, y: minY,
      w: Math.max(...views.map(view => view.x + view.w)) - minX,
      h: Math.max(...views.map(view => view.y + view.h)) - minY } }),
    nativeVisibility(position: Readonly<BoneyardPoint>) {
      // Badguy +0xC8 references the static (-32,-44,64,56) rectangle.
      const onscreen = views.some((view) => position.x - 32 < view.x + view.w
        && position.x + 32 > view.x && position.y - 44 < view.y + view.h
        && position.y + 12 > view.y)
      const admitted = onscreen && lights.some((light) => (
        (position.x - light.position.x) ** 2 + (position.y - light.position.y) ** 2
          < (light.radius * NATIVE_LIGHT_OUTER_DISTANCE) ** 2
      ))
      return { admitted, intensity: admitted ? nativeBoneyardRadialLightScalar(position, lights) : 0 }
    },
    projectedPointVisible(position: Readonly<BoneyardPoint>) {
      return views.some((view) => position.x >= view.x && position.x <= view.x + view.w
        && position.y >= view.y && position.y <= view.y + view.h)
    },
  }
}
