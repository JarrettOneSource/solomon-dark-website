import {
  NATIVE_IMP_BODY_POSE_COUNT,
  NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT,
} from '../core-kernels/boneyard-imp-flight.ts'
import type { NativeEnemyAnimationSample } from './native-enemy-animation.ts'
import {
  boundedPose,
  boundedUnit,
  finiteOrZero,
  layer,
  nativeEnemyFacingBucket,
  positiveModulo,
  presentation,
  stableInteger,
  stableUnit,
  visualChoice,
} from './native-enemy-layers.ts'
import { roundHalfToEven } from '../core-kernels/native-rounding.ts'
import type {
  NativeEnemyFamilyPresentation,
  NativeEnemySpriteLayer,
  NativeEnemyVisualSnapshot,
} from './native-enemy-presentation-model.ts'

export function portalLayers(
  animation: NativeEnemyAnimationSample | undefined,
): NativeEnemySpriteLayer[] {
  if (!animation || animation.alpha <= 0) return []
  const alpha = animation.alpha
  const fixedScale = Math.max(0, animation.stridePhaseDeg)
  const bodyEntry = 46 + positiveModulo(Math.floor(animation.bodyPose), 32)
  const auraEntry = 180 + positiveModulo(Math.floor(animation.gaitPose), 20)
  const layers = [
    layer('DeadHawg', 18, 'portal-outer', {
      alpha: 0.5,
      blendMode: 'add',
      scale: fixedScale * (1 + alpha),
    }),
    layer('DeadHawg', auraEntry, 'portal-aura', {
      blendMode: 'add',
      scale: fixedScale,
    }),
    layer('DeadHawg', bodyEntry, 'portal-body', {
      scale: fixedScale,
      scaleX: fixedScale,
      scaleY: 1 + alpha * 2,
    }),
    layer('DeadHawg', 22, 'portal-core', {
      blendMode: 'add',
      scale: fixedScale,
    }),
  ]
  if (animation.hitFlash > 0) {
    layers.push(layer(
      'BadGuys',
      401 + Math.min(18, Math.floor((1 - boundedUnit(animation.hitFlash)) * 19)),
      'portal-hurt',
      { blendMode: 'add', scale: 2 },
    ))
  }
  return layers
}

export function wraithPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
): NativeEnemyFamilyPresentation {
  const body = [layer('BadGuys', 2070 + facing, 'wraith-body', {
    offset: { x: 0, y: 15 },
    scale: 2,
  })]
  return presentation(body, {
    after: flags.has('BURNING')
      ? wraithWispLayers(
          enemy,
          spawnAgeTicks,
          animation?.state === 'action' ? animation.actionProgress : -1,
        )
      : [],
  })
}

export function impLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
): NativeEnemySpriteLayer[] {
  const pose = animation
    ? positiveModulo(
        Math.floor(finiteOrZero(animation.bodyPose)),
        NATIVE_IMP_BODY_POSE_COUNT,
      )
    : visualChoice(enemy, 1, NATIVE_IMP_BODY_POSE_COUNT)
  const upperFrame = animation?.impEffectFrame
    ?? visualChoice(enemy, 2, NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT)
  return [
    layer('BadGuys', 285 + pose * 12 + facing, 'imp-body', {
      rotationRadians: animation?.impBodyRotationRadians ?? 0,
    }),
    layer(
      'BadGuys',
      333 + boundedPose(upperFrame, NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT - 1),
      'imp-upper-effect',
      {
        alpha: animation && animation.impEffectFrame >= 0
          ? animation.impEffectAlpha
          : 0,
        offset: { x: 0, y: -10 },
      },
    ),
  ]
}

function wraithWispLayers(
  enemy: NativeEnemyVisualSnapshot,
  spawnAgeTicks: number,
  actionProgress: number,
): NativeEnemySpriteLayer[] {
  const result: NativeEnemySpriteLayer[] = []
  const fixedAge = Math.floor(spawnAgeTicks)
  const actionAge = Math.floor(finiteOrZero(actionProgress))
  for (let age = 0; age < Math.min(20, fixedAge + 1); age += 1) {
    const emissionAge = Math.max(0, fixedAge - age)
    if (
      !(actionProgress >= 0 && age <= actionAge)
      && stableInteger(enemy, emissionAge, 4, 120) !== 1
    ) continue
    const angle = stableUnit(enemy, 121, emissionAge) * Math.PI * 2
    const alpha = (0.25 + stableUnit(enemy, 122, emissionAge) * 0.5)
      * (1 - age / 20)
    const radius = 15 + age * 0.45
    result.push(layer('BadGuys', 21, `wraith-soul-wisp:${emissionAge}`, {
      alpha,
      blendMode: 'add',
      offset: {
        x: -Math.cos(angle) * radius,
        y: -15 - Math.sin(angle) * radius - age * 0.2,
      },
    }))
  }
  return result
}

export function coffinSampleLayers(
  animation: NativeEnemyAnimationSample,
): NativeEnemySpriteLayer[] {
  if (animation.coffinState === 'hidden') return []
  const pose = animation.coffinState === 'open'
    ? 12
    : animation.coffinPose
  const result = [layer(
    'BadGuys',
    175 + boundedPose(pose, 12),
    `coffin-${animation.coffinState}`,
    {
      rotationRadians: animation.coffinRotationRadians,
      scaleX: animation.coffinScaleX,
    },
  )]
  if (animation.coffinSecondaryPose !== null) {
    result.push(layer(
      'BadGuys',
      383 + boundedPose(animation.coffinSecondaryPose, 9),
      'coffin-secondary',
      {
        rotationRadians: animation.coffinRotationRadians,
        scaleX: animation.coffinScaleX,
      },
    ))
  }
  for (const maggot of animation.maggots) {
    if (maggot.state === 'death') {
      result.push(layer('DeadHawg', 28, `maggot:${maggot.id}:death`, {
        alpha: maggot.alpha,
        offset: maggot.offset,
        rotationRadians: maggot.rotationRadians,
      }))
      continue
    }
    const facing = nativeEnemyFacingBucket('SKELETON', maggot.headingDeg)
    result.push(layer(
      'BadGuys',
      202 + boundedPose(maggot.pose, 1) * 18 + facing,
      `maggot:${maggot.id}:${maggot.state}`,
      {
        alpha: maggot.alpha,
        offset: maggot.offset,
        rotationRadians: maggot.rotationRadians,
      },
    ))
  }
  return result
}

export function coffinSpawnLayers(
  enemy: NativeEnemyVisualSnapshot,
  spawnAgeTicks: number,
): NativeEnemySpriteLayer[] {
  const waitTicks = visualChoice(enemy, 4, 2) === 0 ? 180 : 360
  if (spawnAgeTicks < waitTicks) return []
  const materializeAge = spawnAgeTicks - waitTicks
  const firstRiseTicks = 10
  const holdTicks = 150 + visualChoice(enemy, 5, 150)
  let stateFrame: number
  if (materializeAge <= firstRiseTicks) {
    stateFrame = roundHalfToEven(Math.min(3, materializeAge * 0.3))
  } else if (materializeAge <= firstRiseTicks + holdTicks) {
    stateFrame = 3
  } else {
    const finalRiseAge = materializeAge - firstRiseTicks - holdTicks
    stateFrame = roundHalfToEven(Math.min(12, 3 + finalRiseAge * 0.2))
  }
  return [layer('BadGuys', 175 + stateFrame, 'coffin-materializing')]
}
