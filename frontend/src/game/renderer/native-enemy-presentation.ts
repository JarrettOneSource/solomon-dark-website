import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import {
  NATIVE_IMP_BODY_POSE_COUNT,
  NATIVE_IMP_UPPER_EFFECT_FRAME_COUNT,
} from '../core-kernels/boneyard-imp-flight.ts'
import { nativeEighteenWayFacingBucket } from '../core-kernels/boneyard-mage-lightning.ts'
import { nativeSkeletonHeadFacing } from '../core-kernels/boneyard-skeleton-family-animation.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from '../core-kernels/native-rng.ts'
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
  lighting: Readonly<{ charge: number; glow: number; providerCopies: 0 | 1 | 2 }>
  mageCloak: boolean
  nativeTypeId: number
  lightRegistration: NativeWorldManagerRegistration
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
  scaleX?: number
  scaleY?: number
  tint: number
}

export interface NativeEnemySegmentLayer {
  alpha: number
  end: Readonly<{ x: number; y: number }>
  role: string
  start: Readonly<{ x: number; y: number }>
  tint: number
  width: number
}

export interface NativeEnemyPresentationPlan {
  actionFrame: NativeEnemyActionFrame | null
  deathProgram: NativeEnemyDeathProgram | null
  facing: number
  family: NativeEnemyFamily
  layers: readonly NativeEnemySpriteLayer[]
  segments: readonly NativeEnemySegmentLayer[]
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
  IMP: [],
  ZOMBIE: ['zombie-beat'],
  WRAITH: ['wraith-drain'],
  DEMON: ['demon-bomb'],
  COFFIN: [],
}

interface NativeEnemyFamilyPresentation {
  after: readonly NativeEnemySpriteLayer[]
  before: readonly NativeEnemySpriteLayer[]
  body: readonly NativeEnemySpriteLayer[]
  segments: readonly NativeEnemySegmentLayer[]
}

const EMPTY_FAMILY_PRESENTATION: NativeEnemyFamilyPresentation = Object.freeze({
  after: Object.freeze([]),
  before: Object.freeze([]),
  body: Object.freeze([]),
  segments: Object.freeze([]),
})

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
  const familyPresentation = animation?.state === 'death'
    ? EMPTY_FAMILY_PRESENTATION
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
    ? applyAuthoritativeSample(
        familyPresentation,
        effectLayers(animation.effects),
        animation,
      )
    : [
        ...familyPresentation.before,
        ...familyPresentation.body,
        ...familyPresentation.after,
      ]
  const segments = animation
    ? applySegmentSample(familyPresentation.segments, animation)
    : familyPresentation.segments
  return {
    actionFrame,
    deathProgram,
    facing,
    family,
    layers,
    segments,
    spawnAgeTicks,
  }
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
  flags: ReadonlySet<string>,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  switch (enemy.enemyToken) {
    case 'SKELETON': return skeletonPresentation(
      enemy,
      facing,
      flags,
      spawnAgeTicks,
      animation,
      actionFrame,
      authoredPoints,
    )
    case 'SKELETONARCHER': return archerPresentation(
      enemy,
      facing,
      flags,
      spawnAgeTicks,
      animation,
      actionFrame,
      authoredPoints,
    )
    case 'SKELETONMAGE': return magePresentation(
      enemy,
      facing,
      flags,
      spawnAgeTicks,
      animation,
      actionFrame,
      authoredPoints,
    )
    case 'IMP': return presentation(impLayers(enemy, facing, animation))
    case 'ZOMBIE': return zombiePresentation(
      enemy,
      facing,
      flags,
      spawnAgeTicks,
      animation,
      authoredPoints,
    )
    case 'WRAITH': return wraithPresentation(
      enemy,
      facing,
      flags,
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

function presentation(
  body: readonly NativeEnemySpriteLayer[],
  options: Partial<Pick<
    NativeEnemyFamilyPresentation,
    'after' | 'before' | 'segments'
  >> = {},
): NativeEnemyFamilyPresentation {
  return {
    after: options.after ?? [],
    before: options.before ?? [],
    body,
    segments: options.segments ?? [],
  }
}

function skeletonPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const body = skeletonLayers(enemy, facing, animation, actionFrame)
  const weapon = selectedFlagValue([...flags], WEAPON_BY_FLAG, 0)
  const segments: NativeEnemySegmentLayer[] = []
  if (weapon === 2 || weapon === 3) {
    const weaponLayer = body.find(({ role }) => role === 'skeleton-weapon')
    if (weaponLayer) {
      const points = authoredPoints(weaponLayer.atlas, weaponLayer.entry)
      const first = requiredPoint(points, 0, `Skeleton weapon ${weaponLayer.entry}`)
      if (weapon === 2) {
        body.push(layer('BadGuys', 46, 'skeleton-mace-head', { offset: first }))
      } else {
        const second = requiredPoint(points, 1, `Skeleton flail ${weaponLayer.entry}`)
        segments.push(segment(first, second, 'skeleton-flail-chain'))
        body.push(layer('BadGuys', 46, 'skeleton-flail-head', { offset: second }))
      }
    }
  } else if (weapon === 5) {
    const headingRadians = enemy.headingDeg * Math.PI / 180
    const reach = actionFrame?.program.name === 'skeleton-pike' ? 64 : 54
    body.push(layer(
      'BadGuys',
      actionFrame?.program.name === 'skeleton-pike' ? 56 : 54,
      'skeleton-pike-shaft',
      {
        offset: {
          x: Math.cos(headingRadians) * reach * 0.5,
          y: Math.sin(headingRadians) * reach * 0.5 - 18,
        },
        rotationRadians: headingRadians + Math.PI / 2,
        scaleX: 1,
        scaleY: reach / 136,
      },
    ))
  }
  const burning = flags.has('BURNING')
    ? burningLayers(enemy, spawnAgeTicks, [
        { x: -9, y: -20 },
        { x: 9, y: -27 },
        { x: 0, y: -38 },
      ], 'skeleton')
    : []
  return presentation(body, { after: burning, segments })
}

function archerPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const body = skeletonArcherLayers(facing, flags, animation, actionFrame)
  const bodyLayer = body.find(({ role }) => role === 'archer-body')!
  const bowPoint = requiredPoint(
    authoredPoints(bodyLayer.atlas, bodyLayer.entry),
    0,
    `Archer body ${bodyLayer.entry}`,
  )
  if (actionFrame && actionFrame.selector !== 0) {
    if (flags.has('FIREARROW')) {
      body.push(layer(
        'BadGuys',
        255 + Math.floor(spawnAgeTicks / 5) % 12,
        'archer-held-fire-arrow',
        { offset: bowPoint },
      ))
    } else if (flags.has('POISONARROW')) {
      body.push(layer(
        'BadGuys',
        271 + Math.floor(spawnAgeTicks / 6) % 12,
        'archer-held-poison-arrow',
        { offset: bowPoint },
      ))
    }
  }
  const burning = flags.has('BURNING')
    ? burningLayers(enemy, spawnAgeTicks, [
        bowPoint,
        { x: -bowPoint.x, y: bowPoint.y + 5 },
        { x: 0, y: -18 },
      ], 'archer')
    : []
  return presentation(body, { after: burning })
}

function magePresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const body = skeletonMageLayers(
    enemy,
    facing,
    flags,
    animation,
    actionFrame,
    authoredPoints,
  )
  const bodyLayer = body.find(({ role }) => role === 'mage-body')!
  const authored = authoredPoints(bodyLayer.atlas, bodyLayer.entry)
  const first = requiredPoint(authored, 0, `Mage body ${bodyLayer.entry}`)
  const second = authored[1] ?? { x: -first.x, y: first.y }
  const after = mageChargeLayers(
    flags,
    enemy.lighting.charge,
    spawnAgeTicks,
    [first, second],
  )
  after.push(...mageCastParticleLayers(
    enemy,
    animation,
    spawnAgeTicks,
    [first, second],
  ))
  if (flags.has('BURNING')) {
    after.push(...burningLayers(enemy, spawnAgeTicks, [first, second], 'mage'))
  }
  return presentation(body, { after })
}

function zombiePresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  flags: ReadonlySet<string>,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const body = zombieLayers(enemy, facing, animation, authoredPoints)
  const after = flags.has('ROTTEN') ? zombieFlyblownLayers(spawnAgeTicks) : []
  if (flags.has('ROTTEN')) {
    after.push(...zombieFadeParticleLayers(enemy, spawnAgeTicks))
  }
  return presentation(body, {
    after,
  })
}

function wraithPresentation(
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

function demonPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const demon = demonLayers(facing, animation, actionFrame, authoredPoints)
  const controller = demon.find(({ role }) => role === 'demon-controller-body')!
  const points = authoredPoints(controller.atlas, controller.entry)
  const flames = demonFlameLayers(enemy, spawnAgeTicks, points)
  const splitY = requiredPoint(points, 5, `Demon controller ${controller.entry}`).y
  return presentation(demon, {
    after: flames.filter(({ offset }) => offset.y >= splitY),
    before: flames.filter(({ offset }) => offset.y < splitY),
  })
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
  const limbPose = animation?.gaitPose ?? 0
  const bodySelector = actionFrame?.selector ?? animation?.bodyPose ?? 0
  const bodyBase = armored
    ? weapon === 0 ? 613 : weapon === 5 ? 991 : 919
    : weapon === 0 ? 1117 : weapon === 5 ? 1405 : 1333
  const bodyPoseCount = weapon === 0
    ? armored ? 9 : 12
    : weapon === 5 ? 3 : 4
  const bodyPose = bankPose(bodySelector, bodyPoseCount)
  const result = [
    layer('BadGuys', 1585 + boundedPose(limbPose, 7) * 18 + facing, 'skeleton-limbs'),
  ]
  if (bodyPose !== null) {
    result.push(layer('BadGuys', bodyBase + bodyPose * 18 + facing, 'skeleton-body'))
  }
  const weaponBase = weapon === 1
    ? 1045
    : weapon === 2 || weapon === 3
      ? 847
      : weapon === 4
        ? 775
        : null
  if (weaponBase !== null) {
    const weaponPose = bankPose(bodySelector, 4)
    if (weaponPose !== null) {
      result.push(layer(
        'BadGuys',
        weaponBase + weaponPose * 18 + facing,
        'skeleton-weapon',
      ))
    }
  }
  result.push(layer(
    'BadGuys',
    HEADGEAR_BASES[headgear] + nativeSkeletonHeadFacing(
      facing,
      animation?.headFacingOffset ?? 0,
    ),
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
  const limbPose = animation?.gaitPose ?? 0
  const bodyPose = actionFrame?.selector ?? animation?.bodyPose ?? 0
  return [
    layer('BadGuys', 1585 + boundedPose(limbPose, 7) * 18 + facing, 'archer-limbs'),
    layer('BadGuys', 451 + boundedPose(bodyPose, 8) * 18 + facing, 'archer-body'),
    layer('BadGuys', HEADGEAR_BASES[headgear] + nativeSkeletonHeadFacing(
      facing,
      animation?.headFacingOffset ?? 0,
    ), 'archer-headgear', {
      offset: { x: 0, y: -4 },
    }),
  ]
}

function skeletonMageLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  sourceFlags: ReadonlySet<string>,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemySpriteLayer[] {
  const flags = [...sourceFlags]
  const headgear = selectedFlagValue(flags, HEADGEAR_BY_FLAG, 0)
  const limbPose = animation?.gaitPose ?? 0
  const bodyPose = actionFrame?.selector ?? animation?.bodyPose ?? 0
  const limbs = layer(
    'BadGuys',
    1585 + boundedPose(limbPose, 7) * 18 + facing,
    'mage-limbs',
  )
  const body = layer(
    'BadGuys',
    enemy.mageCloak
      ? 1459 + facing
      : 1729 + boundedPose(bodyPose, 4) * 18 + facing,
    'mage-body',
  )
  const headgearLayer = layer(
    'BadGuys',
    HEADGEAR_BASES[headgear] + nativeSkeletonHeadFacing(
      facing,
      animation?.headFacingOffset ?? 0,
    ),
    'mage-headgear',
    {
      offset: { x: 0, y: -4 },
    },
  )
  if (!enemy.mageCloak) return [limbs, body, headgearLayer]
  const cloakPoint = requiredPoint(
    authoredPoints(body.atlas, body.entry),
    0,
    `Mage cloak ${body.entry}`,
  )
  return cloakPoint.x < 0
    ? [body, limbs, headgearLayer]
    : [limbs, body, headgearLayer]
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
  const bodyRootOffset = bodyType === 3 ? { x: 0, y: -8 } : { x: 0, y: 0 }
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
  const bodyShift = rotatePoint({ x: 0, y: -5 }, bodyRotationRadians)
  const bodyOffset = bodyType === 3
    ? {
        x: bodyRootOffset.x + bodyShift.x,
        y: bodyRootOffset.y + bodyShift.y,
      }
    : bodyRootOffset
  const layers = [
    layer('BadGuys', 2365 + boundedPose(gaitPose, 7) * 18 + facing, 'zombie-base'),
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
    const overlayShift = rotatePoint({ x: 0, y: -4 }, bodyRotationRadians)
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

function burningLayers(
  enemy: NativeEnemyVisualSnapshot,
  spawnAgeTicks: number,
  attachmentPoints: readonly Readonly<{ x: number; y: number }>[],
  familyRole: string,
): NativeEnemySpriteLayer[] {
  return attachmentPoints.map((offset, index) => layer(
    'DeadHawg',
    46 + positiveModulo(
      Math.floor(spawnAgeTicks + stableUnit(enemy, 70 + index) * 32),
      32,
    ),
    `${familyRole}-burning-fire:${index}`,
    {
      alpha: 0.75 + stableUnit(enemy, 80 + index) * 0.25,
      blendMode: 'add',
      offset,
      scale: 0.5 + stableUnit(enemy, 90 + index) * 0.35,
    },
  ))
}

function mageChargeLayers(
  flags: ReadonlySet<string>,
  charge: number,
  spawnAgeTicks: number,
  points: readonly Readonly<{ x: number; y: number }>[],
): NativeEnemySpriteLayer[] {
  const strength = boundedUnit(charge) ** 2
  if (strength === 0) return []
  let element: 'fire' | 'frost' | 'lightning' | 'poison' = 'fire'
  for (const flag of flags) {
    if (flag === 'CASTFIRE') element = 'fire'
    else if (flag === 'CASTLIGHTNING') element = 'lightning'
    else if (flag === 'CASTFROST') element = 'frost'
    else if (flag === 'CASTPOISON') element = 'poison'
  }
  if (element === 'fire') {
    const entry = 255 + Math.floor(spawnAgeTicks / 5) % 12
    return points.flatMap((offset, pointIndex) => [
      layer('BadGuys', entry, `mage-fire-charge:${pointIndex}:full`, {
        alpha: strength,
        offset,
        scale: strength,
      }),
      layer('BadGuys', entry, `mage-fire-charge:${pointIndex}:half`, {
        alpha: strength * 0.5,
        offset,
        scale: strength * 1.2,
      }),
    ])
  }
  if (element === 'lightning') {
    const entry = 1836 + Math.floor(spawnAgeTicks) % 4
    return points.flatMap((offset, pointIndex) => [
      layer('BadGuys', entry, `mage-lightning-charge:${pointIndex}:full`, {
        alpha: strength,
        blendMode: 'add',
        offset,
        scale: strength,
      }),
      layer('BadGuys', entry, `mage-lightning-charge:${pointIndex}:tint`, {
        alpha: strength * 0.5,
        blendMode: 'add',
        offset,
        scale: strength * 1.35,
        tint: 0x80c8ff,
      }),
    ])
  }
  const entry = element === 'frost' ? 381 : 382
  return points.map((offset, pointIndex) => layer(
    'BadGuys',
    entry,
    `mage-${element}-charge:${pointIndex}`,
    {
      alpha: strength,
      blendMode: 'add',
      offset,
      scale: strength,
    },
  ))
}

function mageCastParticleLayers(
  enemy: NativeEnemyVisualSnapshot,
  animation: NativeEnemyAnimationSample | undefined,
  spawnAgeTicks: number,
  points: readonly Readonly<{ x: number; y: number }>[],
): NativeEnemySpriteLayer[] {
  if (animation?.state !== 'action') return []
  const fixedAge = Math.floor(spawnAgeTicks)
  const actionAge = Math.min(
    19,
    fixedAge,
    Math.ceil(animation.actionProgress / 0.25),
  )
  const result: NativeEnemySpriteLayer[] = []
  for (let age = 0; age <= actionAge; age += 1) {
    const emissionAge = Math.max(0, fixedAge - age)
    for (let lane = 0; lane < 2; lane += 1) {
      if (stableInteger(enemy, emissionAge, 5, 180 + lane) !== 1) continue
      const angle = stableUnit(enemy, 182 + lane, emissionAge) * Math.PI * 2
      const magnitude = stableUnit(enemy, 184 + lane, emissionAge) * 5
      const drift = age * (0.1 + stableUnit(enemy, 186 + lane, emissionAge) * 0.2)
      const point = points[lane]!
      result.push(layer(
        'BadGuys',
        10 + stableInteger(enemy, emissionAge, 2, 188 + lane),
        `mage-cast-particle:${lane}:${emissionAge}`,
        {
          alpha: (1 - age / 20) * (
            0.5 + stableUnit(enemy, 190 + lane, emissionAge) * 0.5
          ),
          blendMode: 'add',
          offset: {
            x: point.x + Math.cos(angle) * magnitude + Math.cos(angle) * drift,
            y: point.y + Math.sin(angle) * magnitude + Math.sin(angle) * drift,
          },
          rotationRadians: angle,
          scale: 0.5 + stableUnit(enemy, 192 + lane, emissionAge) * 0.5,
        },
      ))
    }
  }
  return result
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

function demonFlameLayers(
  enemy: NativeEnemyVisualSnapshot,
  spawnAgeTicks: number,
  controllerPoints: readonly Readonly<{ x: number; y: number }>[],
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
          x: base.x + Math.cos(direction) * magnitude,
          y: base.y + Math.sin(direction) * magnitude,
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

function rotatePoint(
  point: Readonly<{ x: number; y: number }>,
  rotationRadians: number,
): Readonly<{ x: number; y: number }> {
  const cosine = Math.cos(rotationRadians)
  const sine = Math.sin(rotationRadians)
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  }
}

function segment(
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>,
  role: string,
): NativeEnemySegmentLayer {
  return { alpha: 1, end, role, start, tint: 0x777777, width: 1.5 }
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
  family: NativeEnemyFamilyPresentation,
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
  const before = family.before.map(transform)
  const body = family.body.map(transform)
  const after = family.after.map(transform)
  const effects = effectSampleLayers.map(transform)
  const hitFlash = boundedUnit(animation.hitFlash)
  if (hitFlash === 0) return [...before, ...body, ...after, ...effects]
  return [
    ...before,
    ...body,
    ...body.filter((source) => source.alpha > 0).map((source) => ({
      ...source,
      alpha: source.alpha * hitFlash,
      blendMode: 'normal' as const,
      role: `hit:${source.role}`,
      tint: 0xff0000,
    })),
    ...after,
    ...effects,
  ]
}

function applySegmentSample(
  segments: readonly NativeEnemySegmentLayer[],
  animation: NativeEnemyAnimationSample,
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
      tint: 0xff0000,
    })),
  ]
}

function layer(
  atlas: NativeEnemyAtlas,
  entry: number,
  role: string,
  options: Partial<Pick<
    NativeEnemySpriteLayer,
    | 'alpha'
    | 'blendMode'
    | 'offset'
    | 'rotationRadians'
    | 'scale'
    | 'scaleX'
    | 'scaleY'
    | 'tint'
  >> = {},
): NativeEnemySpriteLayer {
  const result: NativeEnemySpriteLayer = {
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
  if (options.scaleX !== undefined) result.scaleX = options.scaleX
  if (options.scaleY !== undefined) result.scaleY = options.scaleY
  return result
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

function stableUnit(
  enemy: NativeEnemyVisualSnapshot,
  channel: number,
  epoch = 0,
): number {
  let value = (
    (enemy.id >>> 0)
    ^ Math.imul((Math.floor(enemy.spawnTick) + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul((channel + 1) >>> 0, 0x85ebca6b)
    ^ Math.imul((epoch + 1) >>> 0, 0xc2b2ae35)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value = (value ^ (value >>> 16)) >>> 0
  return value / 0x1_0000_0000
}

function stableInteger(
  enemy: NativeEnemyVisualSnapshot,
  epoch: number,
  count: number,
  channel: number,
): number {
  return Math.floor(stableUnit(enemy, channel, epoch) * count)
}

function boundedPose(value: number, maximum: number): number {
  return Math.min(maximum, Math.max(0, Math.floor(finiteOrZero(value))))
}

function bankPose(value: number, count: number): number | null {
  const pose = Math.floor(finiteOrZero(value))
  return pose >= 0 && pose < count ? pose : null
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
