import { BONEYARD_SKELETON_WEAPONS } from '../core-kernels/boneyard-enemy-config-model.ts'
import { nativeEighteenWayFacingBucket } from '../core-kernels/boneyard-mage-lightning.ts'
import { nativeSkeletonHeadFacing } from '../core-kernels/boneyard-skeleton-family-animation.ts'
import type { NativeEnemyActionFrame, NativeEnemyAnimationSample } from './native-enemy-animation.ts'
import { bankPose, boundedPose, boundedUnit, finiteOrZero, layer, packRgb, positiveModulo, presentation, requiredPoint, stableInclusiveUnit, stableInteger, stableUnit } from './native-enemy-layers.ts'
import type { NativeEnemyAuthoredPointResolver, NativeEnemyFamilyPresentation, NativeEnemySegmentLayer, NativeEnemySpriteLayer, NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'
const HEADGEAR_BASES = [1477, 1531, 1549, 1495, 1513, 1567] as const

export function skeletonPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const source = skeletonLayers(enemy, facing, animation, actionFrame)
  const weapon = BONEYARD_SKELETON_WEAPONS.indexOf(enemy.weapon)
  const segments: NativeEnemySegmentLayer[] = []
  if (weapon === 2 || weapon === 3) {
    const weaponLayer = source.find(({ role }) => role === 'skeleton-weapon')
    if (weaponLayer) {
      const points = authoredPoints(weaponLayer.atlas, weaponLayer.entry)
      const first = requiredPoint(points, 0, `Skeleton weapon ${weaponLayer.entry}`)
      if (weapon === 2) {
        source.push(layer('BadGuys', 46, 'skeleton-mace-head', { offset: first }))
      } else {
        const second = requiredPoint(points, 1, `Skeleton flail ${weaponLayer.entry}`)
        segments.push({ alpha: 1, start: first, end: second, role: 'skeleton-flail-chain', tint: 0x777777, width: 1.5 })
        source.push(layer('BadGuys', 46, 'skeleton-flail-head', { offset: second }))
      }
    }
  } else if (weapon === 5) {
    const headingRadians = enemy.headingDeg * Math.PI / 180
    const reach = actionFrame?.program.name === 'skeleton-pike' ? 64 : 54
    source.push(layer(
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
  const composed = skeletonFamilyComposition(
    enemy,
    animation,
    spawnAgeTicks,
    source,
    enemy.burning,
    'skeleton',
  )
  return presentation(composed.layers, { hitBody: composed.hitBody, segments })
}

export function archerPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const source = skeletonArcherLayers(enemy, facing, animation, actionFrame)
  const bodyLayer = source.find(({ role }) => role === 'archer-body')!
  const bowPoint = requiredPoint(
    authoredPoints(bodyLayer.atlas, bodyLayer.entry),
    0,
    `Archer body ${bodyLayer.entry}`,
  )
  const bodyPose = actionFrame?.selector ?? animation?.bodyPose ?? 0
  let held: NativeEnemySpriteLayer | null = null
  if (Math.floor(finiteOrZero(bodyPose)) !== 8) {
    if (enemy.arrowType === 'fire') {
      held = layer(
        'BadGuys',
        255 + Math.floor(spawnAgeTicks / 5) % 12,
        'archer-held-fire-arrow',
        {
          alpha: boundedUnit(enemy.lighting.charge),
          blendMode: 'add',
          offset: { x: bowPoint.x, y: bowPoint.y - 5 },
        },
      )
    } else if (enemy.arrowType === 'poison') {
      held = layer(
        'BadGuys',
        271 + Math.floor(spawnAgeTicks / 6) % 12,
        'archer-held-poison-arrow',
        {
          alpha: boundedUnit(enemy.lighting.charge),
          blendMode: 'add',
          offset: { x: bowPoint.x, y: bowPoint.y - 5 },
          tint: 0x008000,
        },
      )
    }
  }
  const composed = skeletonFamilyComposition(
    enemy,
    animation,
    spawnAgeTicks,
    source,
    enemy.burning,
    'archer',
    held,
  )
  return presentation(composed.layers, { hitBody: composed.hitBody })
}

export function magePresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemyFamilyPresentation {
  const source = skeletonMageLayers(
    enemy,
    facing,
    animation,
    actionFrame,
    authoredPoints,
  )
  const bodyLayer = source.find(({ role }) => role === 'mage-body')!
  const authored = authoredPoints(bodyLayer.atlas, bodyLayer.entry)
  const first = requiredPoint(authored, 0, `Mage body ${bodyLayer.entry}`)
  const second = authored[1] ?? { x: -first.x, y: first.y }
  const charge = mageChargeLayers(
    enemy.mageElement,
    enemy.lighting.charge,
    spawnAgeTicks,
    [first, second],
  )
  const particles = mageCastParticleLayers(
    enemy,
    animation,
    spawnAgeTicks,
    [first, second],
  )
  const head = source.find(({ role }) => role === 'mage-headgear')!
  const body = source.filter(({ role }) => role !== 'mage-headgear')
  const composedBody = skeletonFamilyComposition(
    enemy,
    animation,
    spawnAgeTicks,
    body,
    enemy.burning,
    'mage',
  )
  const composedHead = skeletonFamilyComposition(
    enemy,
    animation,
    spawnAgeTicks,
    [head],
    enemy.burning,
    'mage',
    null,
    false,
  )
  return presentation([
    ...composedBody.layers,
    ...charge,
    ...composedHead.layers,
  ], {
    after: particles,
    hitBody: [...composedBody.hitBody, ...composedHead.hitBody],
  })
}

function skeletonLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
): NativeEnemySpriteLayer[] {
  const weapon = BONEYARD_SKELETON_WEAPONS.indexOf(enemy.weapon)
  const headgear = enemy.headgear
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
  ))
  return result
}

function skeletonArcherLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
): NativeEnemySpriteLayer[] {
  const headgear = enemy.headgear
  const limbPose = animation?.gaitPose ?? 0
  const bodyPose = actionFrame?.selector ?? animation?.bodyPose ?? 0
  const limbFacing = nativeEighteenWayFacingBucket(animation?.limbHeadingDeg ?? enemy.headingDeg)
  return [
    layer('BadGuys', 1585 + boundedPose(limbPose, 7) * 18 + limbFacing, 'archer-limbs'),
    layer('BadGuys', 451 + boundedPose(bodyPose, 8) * 18 + facing, 'archer-body'),
    layer('BadGuys', HEADGEAR_BASES[headgear] + nativeSkeletonHeadFacing(
      facing,
      animation?.headFacingOffset ?? 0,
    ), 'archer-headgear'),
  ]
}

function skeletonMageLayers(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
): NativeEnemySpriteLayer[] {
  const headgear = enemy.headgear
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

interface SkeletonFamilyComposition {
  readonly hitBody: readonly NativeEnemySpriteLayer[]
  readonly layers: readonly NativeEnemySpriteLayer[]
}

function skeletonFamilyComposition(
  enemy: NativeEnemyVisualSnapshot,
  animation: NativeEnemyAnimationSample | undefined,
  spawnAgeTicks: number,
  source: readonly NativeEnemySpriteLayer[],
  burning: boolean,
  familyRole: string,
  held: NativeEnemySpriteLayer | null = null,
  includeFire = true,
): SkeletonFamilyComposition {
  const fixedAge = Math.floor(spawnAgeTicks)
  const bob = Math.abs(Math.sin(
    finiteOrZero(animation?.stridePhaseDeg ?? 0) * 0.5 * Math.PI / 180,
  ))
  const bodyHeight = stableInclusiveUnit(enemy, 70) * 3
  const neutral = 1 - stableInclusiveUnit(enemy, 71) * 0.15
  const baseTint = burning
    ? packRgb(1, stableInclusiveUnit(enemy, 72, fixedAge) * 0.5, 0)
    : packRgb(neutral, neutral, 1)
  const articulated = source.map((sourceLayer) => {
    let y = 0
    if (sourceLayer.role.endsWith('-limbs')) y = -bob
    else if (
      sourceLayer.role.endsWith('-body')
      || sourceLayer.role === 'skeleton-weapon'
    ) y = -bodyHeight - bob * 2
    else if (sourceLayer.role.endsWith('-headgear')) y = -bodyHeight - 2 - bob * 3
    return {
      ...sourceLayer,
      offset: { x: sourceLayer.offset.x, y: sourceLayer.offset.y + y },
      tint: baseTint,
    }
  })
  const base = insertHeldBeforeHeadgear(articulated, held)
  if (!burning) return { hitBody: articulated, layers: base }

  const glowTint = packRgb(
    1,
    0.25 + stableInclusiveUnit(enemy, 73, fixedAge) * 0.75,
    0,
  )
  const glowPass = (pass: 1 | 2) => articulated.map((sourceLayer) => ({
    ...sourceLayer,
    blendMode: 'add' as const,
    role: `${sourceLayer.role}:burn-glow-${pass}`,
    tint: glowTint,
  }))
  const firstGlow = glowPass(1)
  const secondGlow = glowPass(2)
  const fire = includeFire
    ? skeletonFamilyBurningFireLayers(enemy, fixedAge, glowTint, familyRole)
    : []
  return {
    hitBody: [...articulated, ...firstGlow, ...secondGlow],
    layers: [...base, ...fire, ...firstGlow, ...secondGlow],
  }
}

function insertHeldBeforeHeadgear(
  source: readonly NativeEnemySpriteLayer[],
  held: NativeEnemySpriteLayer | null,
): readonly NativeEnemySpriteLayer[] {
  if (!held) return source
  const headIndex = source.findIndex(({ role }) => role.endsWith('-headgear'))
  if (headIndex < 0) return [...source, held]
  return [
    ...source.slice(0, headIndex),
    held,
    ...source.slice(headIndex),
  ]
}

function skeletonFamilyBurningFireLayers(
  enemy: NativeEnemyVisualSnapshot,
  fixedAge: number,
  tint: number,
  familyRole: string,
): readonly NativeEnemySpriteLayer[] {
  const headingRadians = enemy.headingDeg * Math.PI / 180
  const direction = {
    x: Math.sin(headingRadians),
    y: -Math.cos(headingRadians),
  }
  const entry = 46 + positiveModulo(Math.floor(fixedAge / 2), 32)
  return [
    layer('DeadHawg', entry, `${familyRole}-burning-fire:upper`, {
      blendMode: 'add',
      offset: { x: direction.x * 2, y: -40 + direction.y * 2 },
      scaleX: 0.5,
      scaleY: 0.85,
      tint,
    }),
    layer('DeadHawg', entry, `${familyRole}-burning-fire:lower`, {
      blendMode: 'add',
      offset: { x: 0, y: -20 },
      scaleX: 0.4,
      scaleY: 0.75,
      tint,
    }),
  ]
}

function mageChargeLayers(
  element: NativeEnemyVisualSnapshot['mageElement'],
  charge: number,
  spawnAgeTicks: number,
  points: readonly Readonly<{ x: number; y: number }>[],
): NativeEnemySpriteLayer[] {
  const strength = boundedUnit(charge) ** 2
  if (strength === 0) return []
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
