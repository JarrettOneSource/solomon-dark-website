import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import {
  NATIVE_IMP_BODY_POSE_COUNT,
  NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT,
} from '../core-kernels/boneyard-imp-flight.ts'
import { nativeEighteenWayFacingBucket } from '../core-kernels/boneyard-mage-lightning.ts'
import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  NATIVE_ENEMY_DEATH_PROGRAMS,
  nativeEnemyActionFrame,
  type NativeEnemyActionFrame,
  type NativeEnemyActionName,
  type NativeEnemyActionProgramName,
  type NativeEnemyAnimationSample,
  type NativeEnemyDeathProgram,
  type NativeEnemyEffectSample,
  type NativeEnemySampleAtlas,
} from './native-enemy-animation.ts'

export const NATIVE_ENEMY_FAMILIES = [
  'SKELETON',
  'SKELETONARCHER',
  'SKELETONMAGE',
  'IMP',
  'ZOMBIE',
  'WRAITH',
  'DEMON',
  'COFFIN',
] as const

export type NativeEnemyFamily = typeof NATIVE_ENEMY_FAMILIES[number]
export type NativeEnemyAtlas = NativeEnemySampleAtlas

export interface NativeEnemyVisualSnapshot {
  animation?: NativeEnemyAnimationSample
  armored: boolean
  enemyToken: NativeEnemyFamily
  flags: readonly string[]
  headingDeg: number
  id: number
  nativeTypeId: number
  position: Readonly<{ x: number; y: number }>
  shieldHealth: number
  shieldMaximumHealth: number
  spawnTick: number
}

export interface NativeEnemySpriteLayer {
  alpha: number
  atlas: NativeEnemyAtlas
  blendMode: 'add' | 'normal'
  entry: number
  offset: Readonly<{ x: number; y: number }>
  role: string
  rotationRadians: number
  scale: number
  tint: number
}

export interface NativeEnemyPresentationPlan {
  actionFrame: NativeEnemyActionFrame | null
  deathProgram: NativeEnemyDeathProgram | null
  facing: number
  family: NativeEnemyFamily
  layers: readonly NativeEnemySpriteLayer[]
  spawnAgeTicks: number
}

export type NativeEnemyAuthoredPointResolver = (
  atlas: NativeEnemyAtlas,
  entry: number,
) => readonly Readonly<{ x: number; y: number }>[]

const HEADGEAR_BASES = [1477, 1531, 1549, 1495] as const
const WEAPON_BY_FLAG = new Map([
  ['SWORD', 1],
  ['MACE', 2],
  ['FLAIL', 3],
  ['AXE', 4],
  ['PIKE', 5],
] as const)
const HEADGEAR_BY_FLAG = new Map([
  ['HELM', 1],
  ['HORNED', 2],
  ['HOODED', 3],
] as const)
const ACTIONS_BY_FAMILY: Readonly<
  Record<NativeEnemyFamily, readonly NativeEnemyActionName[]>
> = {
  SKELETON: ['skeleton-claw-a', 'skeleton-claw-b', 'skeleton-weapon', 'skeleton-pike'],
  SKELETONARCHER: ['archer-shot'],
  SKELETONMAGE: ['mage-cast-short', 'mage-cast-long'],
  IMP: ['imp-contact'],
  ZOMBIE: ['zombie-beat'],
  WRAITH: ['wraith-drain'],
  DEMON: ['demon-bomb'],
  COFFIN: [],
}

export function roundHalfToEven(value: number): number {
  if (!Number.isFinite(value)) throw new Error('native facing value must be finite')
  const integer = Math.trunc(value)
  const fraction = value - integer
  const distance = Math.abs(fraction)
  if (distance < 0.5) return integer
  const direction = Math.sign(fraction)
  if (distance > 0.5) return integer + direction
  return Math.abs(integer % 2) === 0 ? integer : integer + direction
}

export function nativeEnemyFacingBucket(
  family: NativeEnemyFamily,
  headingDeg: number,
): number {
  if (family === 'COFFIN') return 0
  if (!Number.isFinite(headingDeg)) throw new Error('native facing value must be finite')
  if (family === 'IMP') {
    return positiveModulo(Math.trunc((headingDeg + 15) / 30), 12)
  }
  if (isNativeEnemyFamily(family)) {
    return nativeEighteenWayFacingBucket(headingDeg)
  }
  throw new Error(`unsupported native enemy family ${String(family)}`)
}

export function nativeEnemyPresentationPlan(
  enemy: NativeEnemyVisualSnapshot,
  tick: number,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyPresentationPlan {
  const family = enemy.enemyToken
  if (!isNativeEnemyFamily(family)) {
    throw new Error(`unsupported native enemy family ${String(family)}`)
  }
  const animation = enemy.animation
  const sampledHeading = family === 'ZOMBIE'
    ? enemy.headingDeg + (animation?.zombieAngularOffsetDeg ?? 0)
    : enemy.headingDeg
  const facing = nativeEnemyFacingBucket(family, sampledHeading)
  const flags = normalizedFlags(enemy.flags)
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
  const deathProgram = animation?.state === 'death'
    ? NATIVE_ENEMY_DEATH_PROGRAMS[family]
    : null
  const baseLayers = animation?.state === 'death'
    ? []
    : familyLayers(
        enemy,
        facing,
        flags,
        spawnAgeTicks,
        animation,
        actionFrame,
        authoredPoints,
      )
  const layers = animation
    ? applyAuthoritativeSample(baseLayers, effectLayers(animation.effects), animation)
    : baseLayers
  return {
    actionFrame,
    deathProgram,
    facing,
    family,
    layers,
    spawnAgeTicks,
  }
}

export function nativeEnemyPainterLayer(
  enemy: NativeEnemyVisualSnapshot,
  sourceOrder: number,
): DynamicPainterLayer {
  return {
    id: `enemy:${enemy.id}`,
    queueFamily: 'ordinary-dynamic',
    sortBias: 0,
    sourceOrder,
    worldY: enemy.position.y,
  }
}

function familyLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemySpriteLayer[] {
  switch (enemy.enemyToken) {
    case 'SKELETON': return skeletonLayers(enemy, facing, animation, actionFrame)
    case 'SKELETONARCHER': return skeletonArcherLayers(facing, flags, animation, actionFrame)
    case 'SKELETONMAGE': return skeletonMageLayers(facing, flags, animation, actionFrame)
    case 'IMP': return impLayers(enemy, facing, animation)
    case 'ZOMBIE': return zombieLayers(enemy, facing, flags, animation, authoredPoints)
    case 'WRAITH': return [layer('BadGuys', 2070 + facing, 'wraith-body', {
      offset: { x: 0, y: 15 },
      scale: 2,
    })]
    case 'DEMON': return demonLayers(facing, animation, actionFrame, authoredPoints)
    case 'COFFIN': return animation
      ? coffinSampleLayers(animation)
      : coffinSpawnLayers(enemy, spawnAgeTicks)
  }
}

function skeletonLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
): NativeEnemySpriteLayer[] {
  const weapon = selectedFlagValue(enemy.flags, WEAPON_BY_FLAG, 0)
  const headgear = selectedFlagValue(enemy.flags, HEADGEAR_BY_FLAG, 0)
  const armored = enemy.armored
  const sampledPose = visualPose(animation, actionFrame)
  const limbPose = actionFrame?.program.name === 'skeleton-claw-a'
    || actionFrame?.program.name === 'skeleton-claw-b'
    ? actionFrame.frameIndex
    : sampledPose
  const bodyBase = armored
    ? weapon === 0 ? 613 : weapon === 5 ? 991 : 919
    : weapon === 0 ? 1117 : weapon === 5 ? 1405 : 1333
  const bodyPose = !armored && weapon === 5
    ? boundedPose(sampledPose, 2)
    : !armored && weapon !== 0
      ? boundedPose(sampledPose, 3)
      : 0
  const result = [
    layer('BadGuys', 1585 + boundedPose(limbPose, 7) * 18 + facing, 'skeleton-limbs'),
    layer('BadGuys', bodyBase + bodyPose * 18 + facing, 'skeleton-body'),
  ]
  const weaponBase = weapon === 1
    ? 1045
    : weapon === 2 || weapon === 3
      ? 847
      : weapon === 4
        ? 775
        : null
  if (weaponBase !== null) {
    result.push(layer(
      'BadGuys',
      weaponBase + boundedPose(sampledPose, 3) * 18 + facing,
      'skeleton-weapon',
    ))
  }
  result.push(layer(
    'BadGuys',
    HEADGEAR_BASES[headgear] + facing,
    'skeleton-headgear',
    { offset: { x: 0, y: -4 } },
  ))
  return result
}

function skeletonArcherLayers(
  facing: number,
  sourceFlags: ReadonlySet<string>,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
): NativeEnemySpriteLayer[] {
  const flags = [...sourceFlags]
  const headgear = selectedFlagValue(flags, HEADGEAR_BY_FLAG, 0)
  const pose = visualPose(animation, actionFrame)
  return [
    layer('BadGuys', 1585 + boundedPose(pose, 7) * 18 + facing, 'archer-limbs'),
    layer('BadGuys', 451 + boundedPose(pose, 8) * 18 + facing, 'archer-body'),
    layer('BadGuys', HEADGEAR_BASES[headgear] + facing, 'archer-headgear', {
      offset: { x: 0, y: -4 },
    }),
  ]
}

function skeletonMageLayers(
  facing: number,
  sourceFlags: ReadonlySet<string>,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
): NativeEnemySpriteLayer[] {
  const flags = [...sourceFlags]
  const headgear = selectedFlagValue(flags, HEADGEAR_BY_FLAG, 0)
  const pose = visualPose(animation, actionFrame)
  return [
    layer('BadGuys', 1585 + boundedPose(pose, 7) * 18 + facing, 'mage-limbs'),
    layer('BadGuys', 1729 + boundedPose(pose, 4) * 18 + facing, 'mage-body'),
    layer('BadGuys', HEADGEAR_BASES[headgear] + facing, 'mage-headgear', {
      offset: { x: 0, y: -4 },
    }),
  ]
}

function impLayers(
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

function zombieLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
  animation: NativeEnemyAnimationSample | undefined,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemySpriteLayer[] {
  const bodyType = animation && animation.zombieBodyType >= 0
    ? boundedPose(animation.zombieBodyType, 2)
    : visualChoice(enemy, 3, 3)
  const headRoll = visualChoice(enemy, 4, 8)
  const headType = animation && animation.zombieHeadType >= 0
    ? boundedPose(animation.zombieHeadType, 2)
    : headRoll < 6 ? 0 : headRoll - 5
  const flyblownSide = flags.has('ROTTEN')
    ? animation && animation.zombieFlyblownSide >= 0
      ? boundedPose(animation.zombieFlyblownSide, 1)
      : visualChoice(enemy, 5, 2)
    : -1
  const gaitPose = visualPose(animation, null)
  const rearArmPose = animation?.zombieRearArmPose ?? 0
  const frontArmPose = animation?.zombieFrontArmPose ?? 0
  const bodyEntry = 2203 + bodyType * 18 + facing
  const bodyPoints = authoredPoints('BadGuys', bodyEntry)
  const headPoint = requiredPoint(bodyPoints, 0, `Zombie body ${bodyEntry}`)
  const rearArmPoint = requiredPoint(bodyPoints, 1, `Zombie body ${bodyEntry}`)
  const frontArmPoint = requiredPoint(bodyPoints, 2, `Zombie body ${bodyEntry}`)
  return [
    layer('BadGuys', 2365 + boundedPose(gaitPose, 7) * 18 + facing, 'zombie-base'),
    layer('BadGuys', bodyEntry, 'zombie-body', {
      rotationRadians: animation?.zombieBodyRotationRadians ?? 0,
    }),
    layer(
      'BadGuys',
      2095 + boundedPose(rearArmPose + (flyblownSide === 0 ? 1 : 0), 2) * 18 + facing,
      'zombie-arm-rear',
      {
        offset: rearArmPoint,
        rotationRadians: animation?.zombieRearArmRotationRadians ?? 0,
      },
    ),
    layer(
      'BadGuys',
      2149 + boundedPose(frontArmPose + (flyblownSide === 1 ? 1 : 0), 2) * 18 + facing,
      'zombie-arm-front',
      {
        offset: frontArmPoint,
        rotationRadians: animation?.zombieFrontArmRotationRadians ?? 0,
      },
    ),
    layer('BadGuys', 2293 + headType * 18 + facing, 'zombie-head', {
      offset: headPoint,
      rotationRadians: animation?.zombieHeadRotationRadians ?? 0,
    }),
  ]
}

function demonLayers(
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemySpriteLayer[] {
  const controllerPose = actionFrame?.program.name === 'demon-bomb'
    ? boundedPose(actionFrame.selector, 1)
    : boundedPose(animation?.bodyPose ?? 0, 1)
  const controllerEntry = 19 + controllerPose * 18 + facing
  const points = authoredPoints('Demon', controllerEntry)
  return [
    layer('Demon', 62 + facing, 'demon-rear-limb', {
      offset: requiredPoint(points, 1, `Demon controller ${controllerEntry}`),
      rotationRadians: animation?.demonRearLimbRotationRadians ?? 0,
    }),
    layer('Demon', 98 + facing, 'demon-rear-joint', {
      offset: requiredPoint(points, 7, `Demon controller ${controllerEntry}`),
      rotationRadians: animation?.demonRearJointRotationRadians ?? 0,
    }),
    layer('Demon', controllerEntry, 'demon-controller-body'),
    layer('Demon', 1 + facing, 'demon-front-limb', {
      offset: requiredPoint(points, 0, `Demon controller ${controllerEntry}`),
      rotationRadians: animation?.demonFrontLimbRotationRadians ?? 0,
    }),
    layer('Demon', 80 + facing, 'demon-front-joint', {
      offset: requiredPoint(points, 6, `Demon controller ${controllerEntry}`),
      rotationRadians: animation?.demonFrontJointRotationRadians ?? 0,
    }),
  ]
}

function coffinSampleLayers(
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
  )]
  if (animation.coffinSecondaryPose !== null) {
    result.push(layer(
      'BadGuys',
      383 + boundedPose(animation.coffinSecondaryPose, 9),
      'coffin-secondary',
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

function coffinSpawnLayers(
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

function effectLayers(
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

function applyAuthoritativeSample(
  bodyLayers: readonly NativeEnemySpriteLayer[],
  effectSampleLayers: readonly NativeEnemySpriteLayer[],
  animation: NativeEnemyAnimationSample,
): NativeEnemySpriteLayer[] {
  const alpha = boundedUnit(animation.alpha)
  const transform = (source: NativeEnemySpriteLayer): NativeEnemySpriteLayer => ({
    ...source,
    alpha: source.alpha * alpha,
    offset: {
      x: source.offset.x,
      y: source.offset.y + finiteOrZero(animation.verticalOffset),
    },
  })
  const body = bodyLayers.map(transform)
  const effects = effectSampleLayers.map(transform)
  const hitFlash = boundedUnit(animation.hitFlash)
  if (hitFlash === 0) return [...body, ...effects]
  return [
    ...body,
    ...body.filter((source) => source.alpha > 0).map((source) => ({
      ...source,
      alpha: source.alpha * hitFlash,
      blendMode: 'normal' as const,
      role: `hit:${source.role}`,
      tint: 0xff0000,
    })),
    ...effects,
  ]
}

function visualPose(
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
): number {
  if (actionFrame) return actionFrame.selector
  if (!animation) return 0
  return animation.state === 'locomotion' ? animation.gaitPose : animation.bodyPose
}

function layer(
  atlas: NativeEnemyAtlas,
  entry: number,
  role: string,
  options: Partial<Pick<
    NativeEnemySpriteLayer,
    'alpha' | 'blendMode' | 'offset' | 'rotationRadians' | 'scale' | 'tint'
  >> = {},
): NativeEnemySpriteLayer {
  return {
    alpha: options.alpha ?? 1,
    atlas,
    blendMode: options.blendMode ?? 'normal',
    entry,
    offset: options.offset ?? { x: 0, y: 0 },
    role,
    rotationRadians: options.rotationRadians ?? 0,
    scale: options.scale ?? 1,
    tint: options.tint ?? 0xffffff,
  }
}

function normalizedFlags(flags: readonly string[]): Set<string> {
  return new Set(flags.map((flag) => flag.toUpperCase().replace(/^FLAG_/, '')))
}

function selectedFlagValue<T extends number>(
  flags: readonly string[],
  values: ReadonlyMap<string, T>,
  fallback: T | 0,
): T | 0 {
  let selected: T | 0 = fallback
  for (const source of flags) {
    const value = values.get(source.toUpperCase().replace(/^FLAG_/, ''))
    if (value !== undefined) selected = value
  }
  return selected
}

function visualChoice(
  enemy: NativeEnemyVisualSnapshot,
  channel: number,
  count: number,
): number {
  let value = (
    (enemy.id >>> 0)
    ^ Math.imul((Math.floor(enemy.spawnTick) + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul(channel + 1, 0x85ebca6b)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value = (value ^ (value >>> 16)) >>> 0
  return value % count
}

function boundedPose(value: number, maximum: number): number {
  return Math.min(maximum, Math.max(0, Math.floor(finiteOrZero(value))))
}

function boundedUnit(value: number): number {
  return Math.min(1, Math.max(0, finiteOrZero(value)))
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function isNativeEnemyFamily(value: string): value is NativeEnemyFamily {
  return (NATIVE_ENEMY_FAMILIES as readonly string[]).includes(value)
}

function isNativeEnemyActionProgramName(
  value: NativeEnemyActionName,
): value is NativeEnemyActionProgramName {
  return Object.hasOwn(NATIVE_ENEMY_ACTION_PROGRAMS, value)
}

function requiredPoint(
  points: readonly Readonly<{ x: number; y: number }>[],
  index: number,
  owner: string,
): Readonly<{ x: number; y: number }> {
  const point = points[index]
  if (!point) throw new Error(`${owner} is missing authored point ${index}`)
  return point
}
