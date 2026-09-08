import { BONEYARD_SKELETON_WEAPONS } from '../core-kernels/boneyard-enemy-config-model.ts'
import { nativeDesaturateColor } from '../core-kernels/native-color.ts'
import { nativeEighteenWayFacingBucket } from '../core-kernels/boneyard-mage-lightning.ts'
import { nativeSkeletonHeadFacing } from '../core-kernels/boneyard-skeleton-family-animation.ts'
import type { NativeEnemyActionFrame, NativeEnemyAnimationSample } from './native-enemy-animation.ts'
import { bankPose, boundedPose, boundedUnit, finiteOrZero, layer, packRgb, positiveModulo, presentation, requiredPoint, stableInclusiveUnit, stableInteger, toEnemyLocalSpace } from './native-enemy-layers.ts'
import type { NativeEnemyAuthoredPointResolver, NativeEnemyFamilyPresentation, NativeEnemySegmentLayer, NativeEnemySpriteLayer, NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'
const HEADGEAR_BASES = [1477, 1531, 1549, 1495, 1513, 1567] as const

export function skeletonPresentation(
  enemy: NativeEnemyVisualSnapshot,
  facing: number,
  spawnAgeTicks: number,
  animation: NativeEnemyAnimationSample | undefined,
  actionFrame: NativeEnemyActionFrame | null,
  authoredPoints: NativeEnemyAuthoredPointResolver,
  applicationTick: number,
): NativeEnemyFamilyPresentation {
  const source = skeletonLayers(enemy, facing, animation, actionFrame)
  const weapon = BONEYARD_SKELETON_WEAPONS.indexOf(enemy.weapon)
  const segments: NativeEnemySegmentLayer[] = []
  const bodyPose = actionFrame?.selector ?? animation?.bodyPose ?? 0
  if (weapon === 2 || weapon === 3) {
    const weaponLayer = source.find(({ role }) => role === 'skeleton-weapon')
    if (weaponLayer) {
      const points = authoredPoints(weaponLayer.atlas, weaponLayer.entry)
      const first = requiredPoint(points, 0, `Skeleton weapon ${weaponLayer.entry}`)
      if (weapon === 2) {
        source.splice(source.indexOf(weaponLayer) + 1, 0,
          layer('BadGuys', 46, 'skeleton-mace-head', { offset: first, scale: 1 / enemy.scale }))
      } else {
        const second = requiredPoint(points, 1, `Skeleton flail ${weaponLayer.entry}`)
        const orbit = bodyPose === 0 && skeletonFlailHasIdleOrbit(enemy)
        const angle = Math.fround(Math.imul(enemy.id, 35)
          - Math.trunc(applicationTick) * 10) * Math.PI / 180
        const end = orbit ? {
          x: first.x + Math.sin(angle) * 20,
          y: first.y - Math.cos(angle) * 20 * .800000011920929,
        } : second
        const phase = Math.sin((animation?.bodyGaitPhase ?? 0) * 90 * Math.PI / 180)
        const heading = enemy.headingDeg * Math.PI / 180
        const head = orbit ? end : {
          x: second.x - Math.cos(heading) * phase * 3,
          y: second.y - Math.sin(heading) * phase * 3,
        }
        segments.push({ alpha: 1, beforeRole: 'skeleton-flail-head', blendMode: 'normal',
          start: { x: first.x / enemy.scale, y: first.y / enemy.scale },
          end: { x: end.x / enemy.scale, y: end.y / enemy.scale },
          role: 'skeleton-flail-chain', tint: 0x3f3f3f, width: 3 / enemy.scale })
        source.splice(orbit ? source.indexOf(weaponLayer) + 1 : 1, 0,
          layer('BadGuys', 46, 'skeleton-flail-head', { offset: head, scale: 1 / enemy.scale }))
      }
    }
  } else if (weapon === 5) {
    const pose = bankPose(bodyPose, 3)
    if (pose !== null) {
      const points = authoredPoints('BadGuys', 991 + pose * 18 + facing)
      const target = animation?.pikeTargetOffset
      source.splice(1, 0, layer('BadGuys', target ? 56 : 54, 'skeleton-pike-shaft', {
        stretch: {
          start: target ? { x: target.x, y: target.y - 25 }
            : requiredPoint(points, 0, 'Skeleton pike'),
          end: requiredPoint(points, 1, 'Skeleton pike'),
        },
        scaleX: 7 / 8 / enemy.scale,
      }))
    }
  }
  const composed = skeletonFamilyComposition(
    enemy,
    animation,
    spawnAgeTicks,
    source,
    enemy.burning,
    'skeleton',
  )
  return presentation(composed.layers, { hitBody: composed.hitBody,
    segments: enemy.burning ? [...segments, ...([1, 2] as const).flatMap(pass => segments.map(segment => ({
      ...segment, beforeRole: `${segment.beforeRole}:burn-glow-${pass}`, blendMode: 'add' as const,
      role: `${segment.role}:burn-glow-${pass}`,
    })))] : segments })
}

export function skeletonFlailHasIdleOrbit(enemy: NativeEnemyVisualSnapshot): boolean {
  return stableInteger(enemy, 0, 2, 74) === 1
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
          tint: 0x007f00,
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
  applicationTick: number,
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
  const second = requiredPoint(authored, 1, `Mage body ${bodyLayer.entry}`)
  const charge = animation?.mageChargeSuppressed ? [] : mageChargeLayers(
    enemy.mageElement,
    enemy.lighting.charge,
    spawnAgeTicks,
    [first, second],
    applicationTick,
  ).map(source => toEnemyLocalSpace(source, enemy.scale))
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
    1729 + boundedPose(bodyPose, 4) * 18 + facing,
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
  const cloak = layer('BadGuys', 1459 + facing, 'mage-cloak')
  const cloakPoint = requiredPoint(
    authoredPoints(cloak.atlas, cloak.entry),
    0,
    `Mage cloak ${cloak.entry}`,
  )
  return cloakPoint.x < 0
    ? [limbs, cloak, body, headgearLayer]
    : [limbs, body, cloak, headgearLayer]
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
  const bodyGlowTint = burningTint(0.25 + stableInclusiveUnit(enemy, 73, fixedAge) * 0.75)
  const baseTint = !includeFire && enemy.lighting.charge > 0 ? 0xffffff
    : !includeFire && burning ? bodyGlowTint : burning
    ? burningTint(stableInclusiveUnit(enemy, 72, fixedAge) * 0.5)
    : packRgb(neutral, neutral, 1)
  const articulated = source.map((sourceLayer) => {
    let y = 0
    if (sourceLayer.role.endsWith('-limbs')) y = -bob
    else if (
      sourceLayer.role.endsWith('-body')
      || sourceLayer.role === 'skeleton-weapon'
      || sourceLayer.role === 'skeleton-mace-head'
      || sourceLayer.role === 'mage-cloak'
    ) y = -bodyHeight - bob * 2
    else if (sourceLayer.role.endsWith('-headgear')) y = -bodyHeight - 2 - bob * 3
    return {
      ...sourceLayer,
      offset: { x: sourceLayer.offset.x / enemy.scale, y: (sourceLayer.offset.y + y) / enemy.scale },
      ...(sourceLayer.stretch ? { stretch: {
        start: { x: sourceLayer.stretch.start.x / enemy.scale, y: sourceLayer.stretch.start.y / enemy.scale },
        end: { x: sourceLayer.stretch.end.x / enemy.scale, y: sourceLayer.stretch.end.y / enemy.scale },
      } } : {}),
      tint: baseTint,
    }
  })
  const base = insertHeldBeforeHeadgear(articulated, held ? toEnemyLocalSpace(held, enemy.scale) : null)
  if (!burning) return { hitBody: articulated, layers: base }

  const glowTint = includeFire ? bodyGlowTint : burningTint(0.25 + stableInclusiveUnit(enemy, 76, fixedAge) * 0.75)
  const flailHeadIndex = articulated.findIndex(({ role }) => role === 'skeleton-flail-head')
  const glowPass = (pass: 1 | 2) => articulated.map((sourceLayer, index) => ({
    ...sourceLayer,
    blendMode: 'add' as const,
    role: `${sourceLayer.role}:burn-glow-${pass}`,
    tint: flailHeadIndex >= 0 && (pass === 2 || index >= flailHeadIndex) ? baseTint : glowTint,
  }))
  const firstGlow = glowPass(1)
  const secondGlow = glowPass(2)
  const fire = includeFire
    ? skeletonFamilyBurningFireLayers(enemy, fixedAge, glowTint, familyRole)
      .map(source => toEnemyLocalSpace(source, enemy.scale))
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

function burningTint(green: number): number {
  const color = nativeDesaturateColor([1, Math.fround(green), 0, 1], .5)
  return packRgb(color[0], color[1], color[2])
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
  applicationTick: number,
): NativeEnemySpriteLayer[] {
  const strength = Math.fround(Math.fround(boundedUnit(charge)) ** 2)
  if (strength === 0) return []
  const sockets = points.map(point => ({ x: point.x, y: point.y - 5 }))
  if (element === 'fire') {
    const entry = 255 + Math.floor(spawnAgeTicks / 5) % 12
    return [...sockets.map((offset, pointIndex) => layer('BadGuys', entry, `mage-fire-charge:${pointIndex}:sheet`, {
      alpha: strength, blendMode: 'add', offset, scale: 1.25,
    })), ...sockets.map((offset, pointIndex) => layer('BadGuys', 70, `mage-fire-charge:${pointIndex}:glow`, {
      blendMode: 'add', offset, tint: packRgb(1, .5, 0),
    }))]
  }
  if (element === 'lightning') {
    return [...sockets.map((offset, pointIndex) => layer('BadGuys',
      1836 + positiveModulo(Math.trunc(applicationTick / 8) + pointIndex * 10, 4),
      `mage-lightning-charge:${pointIndex}:sheet`, { alpha: strength, blendMode: 'add', offset, scale: .5 },
    )), ...sockets.map((offset, pointIndex) => layer('BadGuys', 70, `mage-lightning-charge:${pointIndex}:glow`, {
      blendMode: 'add', offset, scale: .75, tint: packRgb(.75, 1, 1),
    }))]
  }
  const entry = element === 'frost' ? 381 : 382
  return sockets.map((offset, pointIndex) => layer(
    'BadGuys',
    entry,
    `mage-${element}-charge:${pointIndex}`,
    {
      alpha: strength,
      blendMode: 'add',
      offset,
      rotationRadians: spawnAgeTicks * 2 * Math.PI / 180,
    },
  ))
}
