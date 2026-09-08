import { createNativeRng, drawNativeFloat, drawNativeInteger } from '../core-kernels/native-rng.ts'
import type { NativeEnemyAnimationSample } from './native-enemy-animation.ts'
import { boundedPose, finiteOrZero, layer, packRgb, presentation, requiredPoint, rotatePoint, toEnemyLocalSpace, visualChoice } from './native-enemy-layers.ts'
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
  return presentation(body, {
    after: after.map(source => toEnemyLocalSpace({ ...source,
      offset: { x: source.offset.x, y: source.offset.y + (animation?.zombieBodyType === 3 ? -8 : 0) },
    }, enemy.scale)),
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
  const armSocketRotationRadians = animation?.zombieArmSocketRotationRadians ?? 0
  const bodyScale = bodyType === 3 ? 1.149999976158142 : 1
  const headingRadians = enemy.headingDeg * Math.PI / 180
  const forward = bodyType === 3
    ? { x: Math.sin(headingRadians), y: -Math.cos(headingRadians) }
    : { x: 0, y: 0 }
  const bodyRootOffset = { x: 0, y: bodyType === 3 ? -8 : 0 }
  const bodyEntry = 2203 + bodyType * 18 + facing
  const bodyPoints = authoredPoints('BadGuys', bodyEntry)
  const transformBodyPoint = (point: Readonly<{ x: number; y: number }>, rotation: number) => {
    const rotated = rotatePoint(point, rotation)
    return {
      x: rotated.x + bodyRootOffset.x,
      y: rotated.y + bodyRootOffset.y,
    }
  }
  const headPoint = transformBodyPoint(
    requiredPoint(authoredPoints('BadGuys', 2293 + facing), bodyType === 3 ? 1 : 0, 'Zombie head socket'),
    bodyRotationRadians * .5,
  )
  const rearArmPoint = transformBodyPoint(
    requiredPoint(bodyPoints, 1, `Zombie body ${bodyEntry}`),
    armSocketRotationRadians,
  )
  const frontArmPoint = transformBodyPoint(
    requiredPoint(bodyPoints, 2, `Zombie body ${bodyEntry}`),
    armSocketRotationRadians,
  )
  const bodyShift = { x: forward.x * -5, y: forward.y * -5 }
  const torsoAnchor = requiredPoint(authoredPoints('BadGuys', 2203 + facing), 0, 'Zombie torso anchor')
  const bodyOffset = {
    x: bodyRootOffset.x + torsoAnchor.x + bodyShift.x,
    y: bodyRootOffset.y + torsoAnchor.y + bodyShift.y,
  }
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
  return layers.map(source => ({ ...source,
    offset: { x: source.offset.x / enemy.scale, y: source.offset.y / enemy.scale },
  }))
}

function zombieFlyblownLayers(spawnAgeTicks: number): NativeEnemySpriteLayer[] {
  const rotationRadians = spawnAgeTicks * 0.25 * Math.PI / 180
  const result = [
    layer('BadGuys', 65, 'zombie-gas-cloud:puff', {
      alpha: .5, offset: { x: 0, y: -15 }, scale: 1.5, tint: packRgb(.05, .1, .05),
    }),
    layer('BadGuys', 11, 'zombie-gas-cloud:front', {
      alpha: 0.5,
      offset: { x: 0, y: -15 },
      rotationRadians,
      scaleX: 1.5,
      scaleY: 1.2000000476837158,
      tint: packRgb(.05, .1, .05),
    }),
    layer('BadGuys', 11, 'zombie-gas-cloud:mirrored', {
      alpha: 0.5,
      blendMode: 'add',
      offset: { x: 0, y: -20 },
      rotationRadians,
      scaleX: -1.5,
      scaleY: 1.2000000476837158,
      tint: packRgb(.05, .1, .05),
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
    const finalRadius = (radius.value + 10) * (doubled.value === 3 ? 2 : 1)
    const radians = angle.value * Math.PI / 180
    result.push(layer('BadGuys', 26, `zombie-fly:${index}`, {
      alpha: alpha.value + 0.25,
      tint: 0,
      offset: {
        x: Math.sin(radians) * finalRadius,
        y: -Math.cos(radians) * finalRadius * .800000011920929 - verticalBase.value - 15,
      },
    }))
  }
  return result
}
