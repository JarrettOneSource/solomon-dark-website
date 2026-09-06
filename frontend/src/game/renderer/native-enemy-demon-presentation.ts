import {
  NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
  NATIVE_DEMON_CONTROLLER_POINT_SCALE,
  NATIVE_DEMON_EXTREMITY_DRAW_SCALE,
  nativeDemonExtremityTarget,
} from '../core-kernels/boneyard-demon-articulation.ts'
import type {
  NativeEnemyActionFrame,
  NativeEnemyAnimationSample,
} from './native-enemy-animation.ts'
import {
  boundedPose,
  finiteOrZero,
  layer,
  positiveModulo,
  presentation,
  requiredPoint,
  stableUnit,
} from './native-enemy-layers.ts'
import type {
  NativeEnemyAuthoredPointResolver,
  NativeEnemyFamilyPresentation,
  NativeEnemySegmentLayer,
  NativeEnemySpriteLayer,
  NativeEnemyVisualSnapshot,
} from './native-enemy-presentation-model.ts'

export function demonPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const controllerPose = actionFrame?.program.name === 'demon-bomb'
    ? boundedPose(actionFrame.selector, 1)
    : boundedPose(animation?.bodyPose ?? 0, 1)
  const controllerEntry = 19 + controllerPose * 18 + facing
  const points = authoredPoints('Demon', controllerEntry)
  const fallbackFront = nativeDemonExtremityTarget({ x: 0, y: 0 }, enemy.headingDeg, 1, 'front')
  const fallbackRear = nativeDemonExtremityTarget({ x: 0, y: 0 }, enemy.headingDeg, 1, 'rear')
  const projectedFront = animation?.demonFrontExtremityOffset
  const projectedRear = animation?.demonRearExtremityOffset
  const endpointsAreUnset = projectedFront?.x === 0
    && projectedFront.y === 0
    && projectedRear?.x === 0
    && projectedRear.y === 0
  const front = !animation || endpointsAreUnset ? fallbackFront : projectedFront!
  const rear = !animation || endpointsAreUnset ? fallbackRear : projectedRear!
  const bodyOrigin = midpoint(front, rear)
  const endpointRecord = 62 + facing
  const connectorRecord = 98 + facing
  const endpointPoint = requiredPoint(
    authoredPoints('Demon', endpointRecord),
    0,
    `Demon endpoint ${endpointRecord}`,
  )
  const endpointLayers = (
    extremity: 'front' | 'rear',
    endpoint: Readonly<{ x: number; y: number }>,
    controllerPointIndex: 6 | 7,
  ): NativeEnemySpriteLayer[] => {
    const controllerPoint = requiredPoint(
      points,
      controllerPointIndex,
      `Demon controller ${controllerEntry}`,
    )
    return [
      layer('Demon', endpointRecord, `demon-${extremity}-extremity`, {
        applyVerticalOffset: false,
        offset: endpoint,
        scale: NATIVE_DEMON_EXTREMITY_DRAW_SCALE,
      }),
      layer('Demon', connectorRecord, `demon-${extremity}-connector`, {
        applyVerticalOffset: false,
        stretch: {
          end: {
            x: endpoint.x + endpointPoint.x,
            y: endpoint.y + endpointPoint.y,
          },
          start: {
            x: bodyOrigin.x + controllerPoint.x * NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
            y: bodyOrigin.y
              + controllerPoint.y * NATIVE_DEMON_CONTROLLER_DRAW_SCALE
              - 5,
          },
        },
      }),
    ]
  }
  const rearEndpointLayers = endpointLayers('rear', rear, 6)
  const frontEndpointLayers = endpointLayers('front', front, 7)
  const planted = rear.y <= front.y
    ? [...rearEndpointLayers, ...frontEndpointLayers]
    : [...frontEndpointLayers, ...rearEndpointLayers]
  const controller = layer('Demon', controllerEntry, 'demon-controller-body', {
    offset: bodyOrigin,
    scale: NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
  })
  const frontUpper = layer('Demon', 1 + facing, 'demon-front-upper-limb', {
    offset: addScaledPoint(
      bodyOrigin,
      requiredPoint(points, 0, `Demon controller ${controllerEntry}`),
      NATIVE_DEMON_CONTROLLER_POINT_SCALE,
    ),
    rotationRadians: animation?.demonFrontRotationRadians ?? 0,
    scale: NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
  })
  const rearUpper = layer('Demon', 1 + positiveModulo(17 - facing, 18), 'demon-rear-upper-limb', {
    offset: addScaledPoint(
      bodyOrigin,
      requiredPoint(points, 1, `Demon controller ${controllerEntry}`),
      NATIVE_DEMON_CONTROLLER_POINT_SCALE,
    ),
    rotationRadians: animation?.demonRearRotationRadians ?? 0,
    scale: NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
    scaleX: -NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
    scaleY: NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
  })
  const attached = layer('Demon', 80 + facing, 'demon-attached-late', {
    offset: addScaledPoint(
      bodyOrigin,
      requiredPoint(points, 5, `Demon controller ${controllerEntry}`),
      NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
    ),
    scale: NATIVE_DEMON_CONTROLLER_DRAW_SCALE,
  })
  const flames = demonFlameLayers(enemy, spawnAgeTicks, points, bodyOrigin)
  const splitY = bodyOrigin.y
    + requiredPoint(points, 5, `Demon controller ${controllerEntry}`).y
      * NATIVE_DEMON_CONTROLLER_POINT_SCALE
  const behind = flames.filter(({ offset }) => offset.y < splitY)
  const frontFlames = flames.filter(({ offset }) => offset.y >= splitY)
  const body = [...planted, controller, frontUpper, rearUpper, attached]
  return presentation([
    ...planted,
    controller,
    frontUpper,
    rearUpper,
    ...behind,
    attached,
    ...frontFlames,
  ], { hitBody: body })
}

export function demonDeathLayers(
  enemy: NativeEnemyVisualSnapshot,
  animation: NativeEnemyAnimationSample,
): NativeEnemySpriteLayer[] {
  const facing = positiveModulo(Math.trunc((enemy.headingDeg + 26) / 52), 7)
  const entry = 55 + facing
  const fade = Math.max(0, 1 - finiteOrZero(animation.deathTick) / 100)
  const offset = midpoint(
    animation.demonFrontExtremityOffset,
    animation.demonRearExtremityOffset,
  )
  return [
    layer('Demon', entry, 'demon-death-body', {
      applyVerticalOffset: false,
      blendMode: 'add',
      offset,
      scale: 1.2,
    }),
    layer('Demon', entry, 'demon-death-additive', {
      applyVerticalOffset: false,
      alpha: fade,
      blendMode: 'add',
      offset,
      scale: 1.2,
    }),
    layer('Demon', entry, 'demon-death-alpha-pass', {
      applyVerticalOffset: false,
      alpha: fade,
      blendMode: 'add',
      offset,
      scale: 1.2,
    }),
  ]
}

function demonFlameLayers(
  enemy: NativeEnemyVisualSnapshot,
  spawnAgeTicks: number,
  controllerPoints: readonly Readonly<{ x: number; y: number }>[],
  bodyOrigin: Readonly<{ x: number; y: number }>,
): NativeEnemySpriteLayer[] {
  const point0 = requiredPoint(controllerPoints, 0, 'Demon controller')
  const point1 = requiredPoint(controllerPoints, 1, 'Demon controller')
  const bases = [
    requiredPoint(controllerPoints, 2, 'Demon controller'),
    requiredPoint(controllerPoints, 3, 'Demon controller'),
    requiredPoint(controllerPoints, 4, 'Demon controller'),
    midpoint(point0, point1),
    midpoint(point1, requiredPoint(controllerPoints, 2, 'Demon controller')),
  ]
  const scales = [0.5, 1.1, 0.5, 0.8, 0.8] as const
  return bases.map((base, index) => {
    const magnitude = stableUnit(enemy, 140 + index * 3) * 4
    const direction = stableUnit(enemy, 141 + index * 3) * Math.PI * 2
    const initialPhase = stableUnit(enemy, 142 + index * 3) * 32
    return layer(
      'DeadHawg',
      46 + Math.floor(positiveModulo(initialPhase + spawnAgeTicks * 0.25, 32)),
      `demon-flame:${index}`,
      {
        blendMode: 'add',
        offset: {
          x: bodyOrigin.x
            + base.x * NATIVE_DEMON_CONTROLLER_POINT_SCALE
            + Math.cos(direction) * magnitude,
          y: bodyOrigin.y
            + base.y * NATIVE_DEMON_CONTROLLER_POINT_SCALE
            + Math.sin(direction) * magnitude,
        },
        scale: scales[index]!,
      },
    )
  })
}

function midpoint(
  first: Readonly<{ x: number; y: number }>,
  second: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

function addScaledPoint(
  origin: Readonly<{ x: number; y: number }>,
  point: Readonly<{ x: number; y: number }>,
  scale: number,
): Readonly<{ x: number; y: number }> {
  return { x: origin.x + point.x * scale, y: origin.y + point.y * scale }
}

export function segment(
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  role: string,
): NativeEnemySegmentLayer {
  return { alpha: 1, end, role, start, tint: 0x777777, width: 1.5 }
}
