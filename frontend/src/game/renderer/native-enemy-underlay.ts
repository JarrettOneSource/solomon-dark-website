import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import type { NativeBoneyardComplexShadowRecord } from './boneyard-complex-shadows.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import type { NativeEnemyAtlas, NativeEnemyFamily, NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'

export const NATIVE_ENEMY_DIRECTIONAL_SHADOW_FAMILIES: ReadonlySet<NativeEnemyFamily> = new Set([
  'SKELETON', 'SKELETONARCHER', 'SKELETONMAGE', 'ZOMBIE', 'DIREFACULTY', 'HEARTMONGER', 'SPIDER',
])

type Quad<T> = readonly [T, T, T, T]
export interface NativeEnemyUnderlayLayer {
  readonly alphas: Quad<number>
  readonly atlas: NativeEnemyAtlas
  readonly blendMode: 'normal' | 'add'
  readonly entry: number
  readonly role: string
  readonly tint: number
  readonly vertices: Quad<Readonly<BoneyardPoint>>
}

/** Enemy +0x28 commands, before the Region light-map multiply. */
export function nativeEnemyUnderlayPlan(
  enemy: NativeEnemyVisualSnapshot,
  tick: number,
  records: readonly NativeBoneyardComplexShadowRecord[],
  lightScalar: number,
  complexShadows: boolean,
): readonly NativeEnemyUnderlayLayer[] {
  const animation = enemy.animation
  switch (enemy.enemyToken) {
    case 'IMP':
    case 'COCOON':
    case 'WRAITH': return []
    case 'DEMONSKULL': return [spriteQuad('BadGuys', 67, 'demon-skull-shadow',
      enemy.demonSkull?.bodyOffset ?? { x: 0, y: 0 }, 4 * enemy.scale)]
    case 'DEMON': return [spriteQuad('BadGuys', 67, 'demon-shadow',
      animation?.demonShadowOffset ?? { x: 0, y: 0 }, 2, 2, .5)]
    case 'COFFIN': {
      if (complexShadows || !animation || animation.coffinState === 'hidden') return []
      const entry = 383 + Math.min(9, Math.max(0, Math.trunc(animation.coffinPose)))
      const layer = spriteQuad('BadGuys', entry, 'coffin-shadow', { x: 0, y: 0 }, 1, 1, 1, 0)
      const shift = nativeEnemySpriteRecord('BadGuys', entry).height * .25
      const corner = (index: 0 | 1 | 2 | 3) => transform({
        x: layer.vertices[index].x + (index < 2 ? shift : 0),
        y: layer.vertices[index].y + (index < 2 ? shift * 1.25 : 0),
      }, animation.coffinScaleX, 1, animation.coffinRotationRadians)
      return [{ ...layer, vertices: [corner(0), corner(1), corner(2), corner(3)] }]
    }
    case 'PORTAL': {
      if (!animation || animation.alpha <= 0) return []
      const alpha = animation.alpha
      const scale = animation.stridePhaseDeg
      const age = Math.max(0, Math.floor(tick - enemy.spawnTick) + 1)
      const pulse = Math.fround(.5 + Math.sin(age * 3 * Math.PI / 180) * .5)
      const green = pulse * .5
      const blue = pulse / 3
      const luminance = Math.fround(.3086000084877014 + green * .6093999743461609 + blue * .0820000022649765)
      const channel = (value: number) => Math.trunc(Math.fround((luminance + value) * .5) * 255)
      const tint = (channel(1) << 16) | (channel(green) << 8) | channel(blue)
      return [
        spriteQuad('DeadHawg', 18, 'portal-ground-shadow', { x: 0, y: 0 }, .5, .5, alpha, 0),
        spriteQuad('DeadHawg', 22, 'portal-ground-glow', { x: 0, y: 0 }, scale, scale * .800000011920929, alpha, tint, 'add'),
        spriteQuad('DeadHawg', 180 + Math.trunc(animation.gaitPose) % 20, 'portal-ground-aura',
          { x: 0, y: 0 }, scale, scale * .800000011920929, alpha, 0xffffff, 'add'),
      ]
    }
    case 'SKELETON':
    case 'SPIDER':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
    case 'ZOMBIE':
    case 'DIREFACULTY':
    case 'HEARTMONGER': break
  }
  const size = enemy.enemyToken === 'HEARTMONGER' ? 2 : 1
  const heading = (animation?.limbHeadingDeg ?? enemy.headingDeg) * Math.PI / 180
  const offset = { x: -5 * Math.sin(heading), y: 5 * Math.cos(heading) }
  if (enemy.enemyToken === 'SPIDER') {
    // Spider temporarily moves its native root forward ten before the shared callback.
    offset.x += Math.fround(enemy.position.x + Math.fround(10 * Math.fround(Math.sin(heading)))) - enemy.position.x
    offset.y += Math.fround(enemy.position.y - Math.fround(10 * Math.fround(Math.cos(heading)))) - enemy.position.y
  }
  const layers: NativeEnemyUnderlayLayer[] = []
  if (complexShadows) {
    for (const record of records) {
      const width = size * 10
      const spread = (1 - record.distanceFraction) ** 3 * 10
      const length = Math.min(record.projectionDistance, 150)
      const gait = animation?.shadowLateralOffset ?? 0
      const perpendicular = { x: record.direction.y, y: -record.direction.x }
      const point = (along: number, across: number): BoneyardPoint => ({
        x: Math.fround(offset.x + record.direction.x * along + perpendicular.x * across),
        y: Math.fround(offset.y + record.direction.y * along + perpendicular.y * across),
      })
      const baseAlpha = record.baseAlpha * lightScalar
      const tipAlpha = (1 - record.behindScalar) * (1 - record.distanceFraction)
      layers.push({ atlas: 'BadGuys', entry: 80, role: 'enemy-directional-shadow', tint: 0, blendMode: 'normal',
        alphas: [tipAlpha, tipAlpha, baseAlpha, baseAlpha],
        vertices: [point(length, gait + width + spread), point(length, gait - width - spread),
          point(0, width), point(0, -width)] })
    }
  }
  layers.push(spriteQuad('BadGuys', 67, 'enemy-ground-shadow', offset,
    size * (complexShadows ? .800000011920929 : 1)))
  return layers
}

function spriteQuad(atlas: NativeEnemyAtlas, entry: number, role: string,
  offset: Readonly<BoneyardPoint>, scaleX: number, scaleY = scaleX, alpha = 1,
  tint = 0xffffff, blendMode: 'normal' | 'add' = 'normal'): NativeEnemyUnderlayLayer {
  const record = nativeEnemySpriteRecord(atlas, entry)
  const left = Math.fround(offset.x - record.anchorX * scaleX)
  const right = Math.fround(offset.x + (record.width - record.anchorX) * scaleX)
  const top = Math.fround(offset.y - record.anchorY * scaleY)
  const bottom = Math.fround(offset.y + (record.height - record.anchorY) * scaleY)
  return { atlas, entry, role, tint, blendMode, alphas: [alpha, alpha, alpha, alpha],
    vertices: [{ x: left, y: top }, { x: right, y: top }, { x: left, y: bottom }, { x: right, y: bottom }] }
}

function transform(point: Readonly<BoneyardPoint>, scaleX: number, scaleY: number, rotation: number): BoneyardPoint {
  const x = point.x * scaleX
  const y = point.y * scaleY
  return { x: Math.fround(x * Math.cos(rotation) - y * Math.sin(rotation)),
    y: Math.fround(x * Math.sin(rotation) + y * Math.cos(rotation)) }
}
