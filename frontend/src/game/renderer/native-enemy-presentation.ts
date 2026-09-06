import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import { demonSkullPresentation } from './native-demon-skull-presentation.ts'
import type { NativeEnemyActionFrame, NativeEnemyActionName, NativeEnemyActionProgramName, NativeEnemyAnimationSample, NativeEnemyEffectSample, NativeEnemyMaggotSample } from './native-enemy-animation.ts'
import { NATIVE_ENEMY_ACTION_PROGRAMS, nativeEnemyActionFrame } from './native-enemy-animation.ts'
import { demonDeathLayers, demonPresentation } from './native-enemy-demon-presentation.ts'
import { EMPTY_FAMILY_PRESENTATION, boundedUnit, finiteOrZero, layer, nativeEnemyFacingBucket, normalizeEnemyFlag, presentation } from './native-enemy-layers.ts'
import type { NativeEnemyAuthoredPointResolver, NativeEnemyFamily, NativeEnemyFamilyPresentation, NativeEnemyPresentationPlan, NativeEnemySegmentLayer, NativeEnemySpriteLayer, NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'
import { archerPresentation, magePresentation, skeletonPresentation } from './native-enemy-skeleton-presentation.ts'
import { coffinSampleLayers, coffinSpawnLayers, impLayers, portalLayers, wraithPresentation } from './native-enemy-sprite-presentation.ts'
import { zombiePresentation } from './native-enemy-zombie-presentation.ts'
import { facultyPresentation } from './native-faculty-presentation.ts'
import { heartmongerPresentation } from './native-heartmonger-presentation.ts'
import { nativeSpiderPresentation } from './native-spider-presentation.ts'
import { nativePuppetHitTint } from './native-texture-color.ts'
const ACTIONS_BY_FAMILY: Readonly<
  Record<NativeEnemyFamily, readonly NativeEnemyActionName[]>
> = {
  DEMONSKULL: ['demon-skull-bite', 'demon-skull-eyes', 'demon-skull-mouth', 'demon-skull-spit', 'demon-skull-flair', 'demon-skull-scream'],
  DIREFACULTY: ['faculty-throw', 'faculty-two-hand', 'faculty-lightning'],
  SKELETON: ['skeleton-claw-a', 'skeleton-claw-b', 'skeleton-weapon', 'skeleton-pike'],
  SKELETONARCHER: ['archer-shot'],
  SKELETONMAGE: ['mage-cast-short', 'mage-cast-long'],
  IMP: [],
  PORTAL: [],
  ZOMBIE: ['zombie-beat'],
  WRAITH: ['wraith-drain'],
  DEMON: ['demon-bomb'],
  COFFIN: [],
  SPIDER: [],
  COCOON: [],
  HEARTMONGER: [],
}

export function nativeEnemyPresentationPlan(
  enemy: NativeEnemyVisualSnapshot,
  tick: number,
  authoredPoints: NativeEnemyAuthoredPointResolver,
  complexLighting = true,
): NativeEnemyPresentationPlan {
  const family = enemy.enemyToken
  const animation = enemy.animation
  const sampledHeading = family === 'ZOMBIE'
    ? enemy.headingDeg + (animation?.zombieAngularOffsetDeg ?? 0)
    : family === 'DIREFACULTY' ? enemy.faculty?.bodyHeadingDeg ?? enemy.headingDeg
    : enemy.headingDeg
  const facing = nativeEnemyFacingBucket(family, sampledHeading)
  const spawnAgeTicks = Math.max(0, tick - enemy.spawnTick)
  if (
    animation?.state === 'action'
    && animation.action !== null
    && !ACTIONS_BY_FAMILY[family].includes(animation.action)
  ) {
    throw new Error(`native enemy action ${animation.action} is invalid for ${family}`)
  }
  const actionFrame = animation?.state === 'action'
    && animation.action !== null
    && isNativeEnemyActionProgramName(animation.action)
    ? nativeEnemyActionFrame(animation.action, animation.actionProgress)
    : null
  const familyPresentation = animation?.state === 'death'
    ? family === 'DEMON'
      ? presentation(demonDeathLayers(enemy, animation))
      : family === 'DEMONSKULL' ? demonSkullPresentation(enemy, tick)
      : family === 'DIREFACULTY' ? facultyPresentation(enemy, facing, animation, tick, authoredPoints)
      : EMPTY_FAMILY_PRESENTATION
    : familyLayers(
        enemy,
        facing,
        spawnAgeTicks,
        animation,
        actionFrame,
        authoredPoints,
      )
  const layers = animation
    ? applyAuthoritativeSample(
        familyPresentation,
        effectLayers(animation.effects),
        family === 'PORTAL' ? { ...animation, hitFlash: 0 } : animation,
        complexLighting,
      )
    : [
        ...familyPresentation.before,
        ...familyPresentation.body,
        ...familyPresentation.after,
      ]
  const segments = animation
    ? applySegmentSample(familyPresentation.segments, animation, complexLighting)
    : familyPresentation.segments
  return {
    actionFrame,
    facing,
    family,
    layers,
    segments,
    spawnAgeTicks,
  }
}

export function nativeEnemyViewPlanInputsEqual(
  previous: NativeEnemyVisualSnapshot,
  previousTick: number,
  current: NativeEnemyVisualSnapshot,
  currentTick: number,
): boolean {
  return previous.id === current.id
    && previous.demonSkull === current.demonSkull
    && previous.nativeTypeId === current.nativeTypeId
    && previous.enemyToken === current.enemyToken
    && previous.armored === current.armored
    && previous.headgear === current.headgear
    && previous.weapon === current.weapon
    && previous.arrowType === current.arrowType
    && previous.burning === current.burning
    && previous.mageElement === current.mageElement
    && previous.rotten === current.rotten
    && previous.headingDeg === current.headingDeg
    && previous.mageCloak === current.mageCloak
    && previous.scale === current.scale
    && previous.spawnTick === current.spawnTick
    && previous.lighting.charge === current.lighting.charge
    && previous.faculty === current.faculty
    && enemyFlagsEqual(previous.flags, current.flags)
    && (
      !enemyPresentationUsesTick(current)
      || previousTick === currentTick
    )
    && enemyAnimationSamplesEqual(previous.animation, current.animation)
}

function enemyPresentationUsesTick(enemy: NativeEnemyVisualSnapshot): boolean {
  switch (enemy.enemyToken) {
    case 'DEMONSKULL': return true
    case 'DIREFACULTY': return true
    case 'SKELETON':
      return enemy.burning
    case 'SKELETONARCHER':
      return enemy.burning
        || enemy.arrowType === 'fire'
        || enemy.arrowType === 'poison'
    case 'SKELETONMAGE':
      return enemy.lighting.charge > 0
        || enemy.animation?.state === 'action'
        || enemy.burning
    case 'ZOMBIE':
      return enemy.rotten
    case 'WRAITH':
      return enemy.burning
    case 'DEMON':
    case 'COFFIN':
      return true
    case 'HEARTMONGER':
    case 'IMP':
    case 'PORTAL':
    case 'SPIDER':
    case 'COCOON':
      return false
  }
}

function enemyFlagsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (normalizeEnemyFlag(left[index]!) !== normalizeEnemyFlag(right[index]!)) return false
  }
  return true
}

function enemyAnimationSamplesEqual(
  left: NativeEnemyAnimationSample | undefined,
  right: NativeEnemyAnimationSample | undefined,
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  if (left.spider?.bodyHeadingDeg !== right.spider?.bodyHeadingDeg
    || left.spider?.outlineAlpha !== right.spider?.outlineAlpha
    || left.spider?.outlineTint !== right.spider?.outlineTint) return false
  return left.action === right.action
    && left.actionProgress === right.actionProgress
    && left.alpha === right.alpha
    && left.bodyPose === right.bodyPose
    && left.coffinPose === right.coffinPose
    && left.coffinRotationRadians === right.coffinRotationRadians
    && left.coffinScaleX === right.coffinScaleX
    && left.coffinSecondaryPose === right.coffinSecondaryPose
    && left.coffinState === right.coffinState
    && left.deathEpoch === right.deathEpoch
    && left.deathTick === right.deathTick
    && left.demonFrontExtremityOffset.x === right.demonFrontExtremityOffset.x
    && left.demonFrontExtremityOffset.y === right.demonFrontExtremityOffset.y
    && left.demonFrontRotationRadians === right.demonFrontRotationRadians
    && left.demonRearExtremityOffset.x === right.demonRearExtremityOffset.x
    && left.demonRearExtremityOffset.y === right.demonRearExtremityOffset.y
    && left.demonRearRotationRadians === right.demonRearRotationRadians
    && left.gaitPose === right.gaitPose
    && left.headFacingOffset === right.headFacingOffset
    && left.hitFlash === right.hitFlash
    && left.impBodyRotationRadians === right.impBodyRotationRadians
    && left.impEffectAlpha === right.impEffectAlpha
    && left.impEffectFrame === right.impEffectFrame
    && left.limbHeadingDeg === right.limbHeadingDeg
    && left.headVariant === right.headVariant
    && left.state === right.state
    && left.stridePhaseDeg === right.stridePhaseDeg
    && left.verticalOffset === right.verticalOffset
    && left.zombieAngularOffsetDeg === right.zombieAngularOffsetDeg
    && left.zombieAttackSide === right.zombieAttackSide
    && left.zombieBodyRotationRadians === right.zombieBodyRotationRadians
    && left.zombieBodyType === right.zombieBodyType
    && left.zombieFrontArmPose === right.zombieFrontArmPose
    && left.zombieFrontArmRotationRadians === right.zombieFrontArmRotationRadians
    && left.zombieHeadType === right.zombieHeadType
    && left.zombieHeadRotationRadians === right.zombieHeadRotationRadians
    && left.zombieRearArmPose === right.zombieRearArmPose
    && left.zombieRearArmRotationRadians === right.zombieRearArmRotationRadians
    && enemyEffectSamplesEqual(left.effects, right.effects)
    && enemyMaggotSamplesEqual(left.maggots, right.maggots)
}

function enemyEffectSamplesEqual(
  left: readonly NativeEnemyEffectSample[],
  right: readonly NativeEnemyEffectSample[],
): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const first = left[index]!
    const second = right[index]!
    if (
      first.id !== second.id
      || first.alpha !== second.alpha
      || first.atlas !== second.atlas
      || first.blendMode !== second.blendMode
      || first.entry !== second.entry
      || first.offset.x !== second.offset.x
      || first.offset.y !== second.offset.y
      || first.role !== second.role
      || first.rotationRadians !== second.rotationRadians
      || first.scale !== second.scale
    ) return false
  }
  return true
}

function enemyMaggotSamplesEqual(
  left: readonly NativeEnemyMaggotSample[],
  right: readonly NativeEnemyMaggotSample[],
): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const first = left[index]!
    const second = right[index]!
    if (
      first.id !== second.id
      || first.alpha !== second.alpha
      || first.headingDeg !== second.headingDeg
      || first.offset.x !== second.offset.x
      || first.offset.y !== second.offset.y
      || first.pose !== second.pose
      || first.rotationRadians !== second.rotationRadians
      || first.state !== second.state
    ) return false
  }
  return true
}

export function nativeEnemyPainterLayer(
  enemy: NativeEnemyVisualSnapshot,
): DynamicPainterLayer {
  return {
    id: `enemy:${enemy.id}`,
    queueFamily: 'ordinary-dynamic',
    registration: enemy.lightRegistration,
    sortBias: 0,
    worldY: enemy.position.y,
  }
}

function familyLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  switch (enemy.enemyToken) {
    case 'SPIDER': return nativeSpiderPresentation(facing, animation)
    case 'COCOON': return EMPTY_FAMILY_PRESENTATION
    case 'DEMONSKULL': return demonSkullPresentation(enemy, spawnAgeTicks + enemy.spawnTick)
    case 'DIREFACULTY': return facultyPresentation(enemy, facing, animation, spawnAgeTicks + enemy.spawnTick, authoredPoints)
    case 'HEARTMONGER': return heartmongerPresentation(enemy, facing, animation, authoredPoints)
    case 'SKELETON': return skeletonPresentation(
      enemy,
      facing,
      spawnAgeTicks,
      animation,
      actionFrame,
      authoredPoints,
    )
    case 'SKELETONARCHER': return archerPresentation(
      enemy,
      facing,
      spawnAgeTicks,
      animation,
      actionFrame,
      authoredPoints,
    )
    case 'SKELETONMAGE': return magePresentation(
      enemy,
      facing,
      spawnAgeTicks,
      animation,
      actionFrame,
      authoredPoints,
    )
    case 'IMP': return presentation(impLayers(enemy, facing, animation))
    case 'PORTAL': return presentation(portalLayers(animation))
    case 'ZOMBIE': return zombiePresentation(
      enemy,
      facing,
      spawnAgeTicks,
      animation,
      authoredPoints,
    )
    case 'WRAITH': return wraithPresentation(
      enemy,
      facing,
      spawnAgeTicks,
      animation,
    )
    case 'DEMON': return demonPresentation(
      enemy,
      facing,
      spawnAgeTicks,
      animation,
      actionFrame,
      authoredPoints,
    )
    case 'COFFIN': return presentation(animation
      ? coffinSampleLayers(animation)
      : coffinSpawnLayers(enemy, spawnAgeTicks))
  }
}

export function effectLayers(
  effects: readonly NativeEnemyEffectSample[],
): NativeEnemySpriteLayer[] {
  return effects.map((effect) => layer(
    effect.atlas,
    effect.entry,
    `effect:${effect.id}:${effect.role}`,
    {
      alpha: effect.alpha,
      blendMode: effect.blendMode,
      offset: effect.offset,
      rotationRadians: effect.rotationRadians,
      scale: effect.scale,
    },
  ))
}

export function applyAuthoritativeSample(
  family: NativeEnemyFamilyPresentation,
  effectSampleLayers: readonly NativeEnemySpriteLayer[],
  animation: NativeEnemyAnimationSample,
  complexLighting = true,
): NativeEnemySpriteLayer[] {
  const alpha = boundedUnit(animation.alpha)
  const transform = (source: NativeEnemySpriteLayer): NativeEnemySpriteLayer => {
    const verticalOffset = source.applyVerticalOffset === false
      ? 0
      : finiteOrZero(animation.verticalOffset)
    return {
      ...source,
      alpha: source.alpha * alpha,
      offset: {
        x: source.offset.x,
        y: source.offset.y + verticalOffset,
      },
      ...(source.stretch === undefined ? {} : {
        stretch: {
          end: { x: source.stretch.end.x, y: source.stretch.end.y + verticalOffset },
          start: { x: source.stretch.start.x, y: source.stretch.start.y + verticalOffset },
        },
      }),
    }
  }
  const before = family.before.map(transform)
  const body = family.body.map(transform)
  const hitBody = family.hitBody.map(transform)
  const after = family.after.map(transform)
  const effects = effectSampleLayers.map(transform)
  const hitFlash = boundedUnit(animation.hitFlash)
  if (hitFlash === 0) return [...before, ...body, ...after, ...effects]
  return [
    ...before,
    ...body,
    ...hitBody.filter((source) => source.alpha > 0).map((source) => ({
      ...source,
      alpha: source.alpha * hitFlash,
      role: `hit:${source.role}`,
      textureColor: 'diffuse' as const,
      tint: nativePuppetHitTint(complexLighting, source.tint),
    })),
    ...after,
    ...effects,
  ]
}

export function applySegmentSample(
  segments: readonly NativeEnemySegmentLayer[],
  animation: NativeEnemyAnimationSample,
  complexLighting = true,
): NativeEnemySegmentLayer[] {
  const alpha = boundedUnit(animation.alpha)
  const verticalOffset = finiteOrZero(animation.verticalOffset)
  const transformed = segments.map((source) => ({
    ...source,
    alpha: source.alpha * alpha,
    end: { x: source.end.x, y: source.end.y + verticalOffset },
    start: { x: source.start.x, y: source.start.y + verticalOffset },
  }))
  const hitFlash = boundedUnit(animation.hitFlash)
  if (hitFlash === 0) return transformed
  return [
    ...transformed,
    ...transformed.map((source) => ({
      ...source,
      alpha: source.alpha * hitFlash,
      role: `hit:${source.role}`,
      tint: nativePuppetHitTint(complexLighting, source.tint),
    })),
  ]
}

function isNativeEnemyActionProgramName(
  value: NativeEnemyActionName,
): value is NativeEnemyActionProgramName {
  return Object.hasOwn(NATIVE_ENEMY_ACTION_PROGRAMS, value)
}
