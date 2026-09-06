import { createNativeRng, drawNativeFloat, drawNativeInteger } from '../core-kernels/native-rng.ts'
import type { NativeEnemyAnimationSample } from './native-enemy-animation.ts'
import { boundedPose, finiteOrZero, layer, presentation, requiredPoint, rotatePoint, stableInteger, stableUnit, visualChoice } from './native-enemy-layers.ts'
import type { NativeEnemyAuthoredPointResolver, NativeEnemyFamilyPresentation, NativeEnemySpriteLayer, NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'
export function zombiePresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const body = zombieLayers(enemy, facing, animation, authoredPoints)
  const after = enemy.rotten ? zombieFlyblownLayers(spawnAgeTicks) : []
  if (enemy.rotten) {
    after.push(...zombieFadeParticleLayers(enemy, spawnAgeTicks))
  }
  return presentation(body, {
    after,
  })
}

function zombieLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemySpriteLayer[] {
  const bodyType = animation && animation.zombieBodyType >= 0
    ? boundedPose(animation.zombieBodyType, 3)
    : visualChoice(enemy, 3, 3)
  const headRoll = visualChoice(enemy, 4, 8)
  const headType = animation && animation.zombieHeadType >= 0
    ? boundedPose(animation.zombieHeadType, 3)
    : headRoll < 6 ? 0 : headRoll - 5
  const gaitPose = animation?.gaitPose ?? 0
  const rearArmPose = animation?.zombieRearArmPose ?? 0
  const frontArmPose = animation?.zombieFrontArmPose ?? 0
  const bodyRotationRadians = animation?.zombieBodyRotationRadians ?? 0
  const bodyScale = bodyType === 3 ? 1.15 : 1
  const headingRadians = enemy.headingDeg * Math.PI / 180
  const forward = bodyType === 3
    ? { x: Math.sin(headingRadians), y: -Math.cos(headingRadians) }
    : { x: 0, y: 0 }
  const bodyRootOffset = { x: 1, y: bodyType === 3 ? -8 : 0 }
  const bodyEntry = 2203 + bodyType * 18 + facing
  const bodyPoints = authoredPoints('BadGuys', bodyEntry)
  const transformBodyPoint = (point: Readonly<{ x: number; y: number }>) => {
    const scaled = { x: point.x * bodyScale, y: point.y * bodyScale }
    const rotated = rotatePoint(scaled, bodyRotationRadians)
    return {
      x: rotated.x + bodyRootOffset.x,
      y: rotated.y + bodyRootOffset.y,
    }
  }
  const headPoint = transformBodyPoint(
    requiredPoint(bodyPoints, 0, `Zombie body ${bodyEntry}`),
  )
  const rearArmPoint = transformBodyPoint(
    requiredPoint(bodyPoints, 1, `Zombie body ${bodyEntry}`),
  )
  const frontArmPoint = transformBodyPoint(
    requiredPoint(bodyPoints, 2, `Zombie body ${bodyEntry}`),
  )
  const bodyShift = { x: forward.x * -5, y: forward.y * -5 }
  const bodyOffset = bodyType === 3
    ? {
        x: bodyRootOffset.x + bodyShift.x,
        y: bodyRootOffset.y + bodyShift.y,
      }
    : bodyRootOffset
  const layers = [
    layer('BadGuys', 2365 + boundedPose(gaitPose, 7) * 18 + facing, 'zombie-base', {
      offset: {
        x: forward.x * 4,
        y: forward.y * 4 - Math.abs(Math.sin(
          finiteOrZero(animation?.stridePhaseDeg ?? 0) * 0.5 * Math.PI / 180,
        )),
      },
      scale: bodyType === 3 ? 2 : 1,
    }),
    layer('BadGuys', bodyEntry, 'zombie-body', {
      offset: bodyOffset,
      rotationRadians: bodyRotationRadians,
      scale: bodyScale,
    }),
    layer(
      'BadGuys',
      2095 + boundedPose(rearArmPose, 2) * 18 + facing,
      'zombie-arm-rear',
      {
        offset: rearArmPoint,
        rotationRadians: animation?.zombieRearArmRotationRadians ?? 0,
        scale: bodyScale,
      },
    ),
    layer(
      'BadGuys',
      2149 + boundedPose(frontArmPose, 2) * 18 + facing,
      'zombie-arm-front',
      {
        offset: frontArmPoint,
        rotationRadians: animation?.zombieFrontArmRotationRadians ?? 0,
        scale: bodyScale,
      },
    ),
  ]
  if (bodyType === 3) {
    const overlayShift = { x: forward.x * -4, y: forward.y * -4 }
    layers.push(
      layer('BadGuys', 2275 + facing, 'zombie-body-overlay-rear', {
        offset: {
          x: rearArmPoint.x + overlayShift.x,
          y: rearArmPoint.y + overlayShift.y,
        },
        rotationRadians: animation?.zombieRearArmRotationRadians ?? 0,
        scale: bodyScale,
      }),
      layer('BadGuys', 2275 + facing, 'zombie-body-overlay-front', {
        offset: {
          x: frontArmPoint.x + overlayShift.x,
          y: frontArmPoint.y + overlayShift.y,
        },
        rotationRadians: animation?.zombieFrontArmRotationRadians ?? 0,
        scale: bodyScale,
      }),
    )
  }
  layers.push(layer('BadGuys', 2293 + headType * 18 + facing, 'zombie-head', {
      offset: headPoint,
      rotationRadians: animation?.zombieHeadRotationRadians ?? 0,
    }))
  return layers
}

function zombieFlyblownLayers(spawnAgeTicks: number): NativeEnemySpriteLayer[] {
  const rotationRadians = spawnAgeTicks * 0.25 * Math.PI / 180
  const result = [
    layer('BadGuys', 65, 'zombie-gas-cloud:front', {
      alpha: 0.5,
      offset: { x: 0, y: -15 },
      rotationRadians,
      scaleX: 1.5,
      scaleY: 1.2,
      tint: 0x0d1a0d,
    }),
    layer('BadGuys', 65, 'zombie-gas-cloud:mirrored', {
      alpha: 0.5,
      offset: { x: 0, y: -20 },
      rotationRadians,
      scaleX: -1.5,
      scaleY: 1.2,
      tint: 0x0d1a0d,
    }),
  ]
  let state = createNativeRng(Math.floor(spawnAgeTicks / 10))
  const count = drawNativeInteger(state, 16)
  state = count.state
  for (let index = 0; index < count.value + 5; index += 1) {
    const alpha = drawNativeFloat(state, 0.5)
    state = alpha.state
    const radius = drawNativeFloat(state, 20)
    state = radius.state
    const doubled = drawNativeInteger(state, 5)
    state = doubled.state
    const angle = drawNativeFloat(state, 360)
    state = angle.state
    const verticalBase = drawNativeFloat(state, 10)
    state = verticalBase.state
    const finalRadius = (radius.value + 1) * (doubled.value === 3 ? 2 : 1)
    const radians = angle.value * Math.PI / 180
    result.push(layer('BadGuys', 26, `zombie-fly:${index}`, {
      alpha: alpha.value + 0.25,
      offset: {
        x: Math.cos(radians) * finalRadius,
        y: Math.sin(radians) * finalRadius * 0.8 - verticalBase.value - 15,
      },
    }))
  }
  return result
}

function zombieFadeParticleLayers(
  enemy: NativeEnemyVisualSnapshot,
  spawnAgeTicks: number,
): NativeEnemySpriteLayer[] {
  const fixedAge = Math.floor(spawnAgeTicks)
  const result: NativeEnemySpriteLayer[] = []
  for (let age = 0; age < Math.min(40, fixedAge + 1); age += 1) {
    const emissionAge = Math.max(0, fixedAge - age)
    if (stableInteger(enemy, emissionAge, 75, 210) !== 3) continue
    const angle = stableUnit(enemy, 211, emissionAge) * Math.PI * 2
    const radius = stableUnit(enemy, 212, emissionAge) * 20
    const velocityAngle = stableUnit(enemy, 213, emissionAge) * Math.PI * 2
    const velocity = 0.25 + stableUnit(enemy, 214, emissionAge) * 0.75
    result.push(layer(
      'BadGuys',
      10 + stableInteger(enemy, emissionAge, 2, 215),
      `zombie-fade-particle:${emissionAge}`,
      {
        alpha: Math.sin((1 - age / 40) * Math.PI / 2),
        blendMode: 'add',
        offset: {
          x: 1 + Math.cos(angle) * radius + Math.cos(velocityAngle) * velocity * age,
          y: -15 + Math.sin(angle) * radius + Math.sin(velocityAngle) * velocity * age,
        },
        rotationRadians: velocityAngle,
        scale: 0.5 + stableUnit(enemy, 216, emissionAge) * 0.5,
      },
    ))
  }
  return result
}
