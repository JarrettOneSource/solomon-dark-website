import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import type {
  BoneyardGoodieSnapshot,
  BoneyardLootSnapshot,
} from '../protocol/game-state.ts'
import type { NativeLootAtlas } from './native-loot-assets.ts'

export interface NativeLootVisualLayer {
  readonly alpha: number
  readonly atlas: NativeLootAtlas
  readonly blendMode: 'add' | 'normal'
  readonly entry: number
  readonly offset: Readonly<{ x: number; y: number }>
  readonly role: string
  readonly rotationRadians: number
  readonly scale: Readonly<{ x: number; y: number }>
  readonly tint: number
}

export interface NativeLootPresentationPlan {
  readonly layers: readonly NativeLootVisualLayer[]
  readonly nextScatterSeed: number
}

const FULL_CIRCLE_DEGREES = 360
const GOLD_SCATTER_OFFSET = 8

export function nativeLootPresentationPlan(
  actor: BoneyardLootSnapshot,
  scatterSeed = actor.scatterSeed,
): NativeLootPresentationPlan {
  if (actor.kind === 'orb') return orbPlan(actor, scatterSeed)
  if (actor.kind === 'gold') return goldPlan(actor, scatterSeed)
  if (actor.kind === 'sack') return sackPlan(actor, scatterSeed)
  return bonusPlan(actor, scatterSeed)
}

export function nativeGoodiePresentationPlan(
  goodie: BoneyardGoodieSnapshot,
  tick: number,
): readonly NativeLootVisualLayer[] {
  const layers: NativeLootVisualLayer[] = [layer(
    'goodie-body',
    'DeadHawg',
    145 + goodie.phase,
  )]
  if (goodie.active && goodie.timer < 100 && Math.trunc(tick / 10) % 2 !== 0) {
    layers.push(layer('goodie-active-indicator', 'BadGuys', 33, {
      offset: { x: 0, y: -40 },
    }))
  }
  return Object.freeze(layers)
}

export function nativeLootPainterLayer(
  actor: BoneyardLootSnapshot,
): DynamicPainterLayer {
  return {
    id: `loot:${actor.id}`,
    queueFamily: 'ordinary-dynamic',
    registration: actor.painterRegistration,
    sortBias: 0,
    worldY: actor.position.y,
  }
}

export function nativeGoodiePainterLayer(
  goodie: BoneyardGoodieSnapshot,
): DynamicPainterLayer {
  return {
    id: `goodie:${goodie.id}`,
    queueFamily: 'scenery',
    registration: {
      managerLane: 'scenery',
      registrationOrdinal: goodie.sceneryRegistrationOrdinal,
    },
    sortBias: 0,
    worldY: goodie.position.y,
  }
}

export function nextNativeGoldScatterSeed(source: number): number {
  let value = source >>> 0
  value = (value ^ (value << 21)) >>> 0
  value = (value ^ (value >>> 11)) >>> 0
  value = Math.imul((value ^ (value << 4)) >>> 0, 0x0a67cfcf) >>> 0
  return (value | 0) < 0
    ? (0x80000000 - (value & 0x7fffffff)) >>> 0
    : value
}

function orbPlan(actor: BoneyardLootSnapshot, scatterSeed: number): NativeLootPresentationPlan {
  const angle = degreesToRadians(actor.animationPhase)
  const entry = actor.orbKind === 'health' ? 434 : 435
  if (actor.alpha < 1) {
    const scale = actor.orbValue * actor.alpha * 2
    return plan([layer('orb-fade-in', 'BadGuys', entry, {
      offset: {
        x: 0,
        y: Math.sin(angle) * 3 - 5 + Math.cos(angle) * 15,
      },
      scale: { x: scale, y: scale },
    })], scatterSeed)
  }
  const scale = actor.orbValue * actor.alpha * (Math.cos(angle) * 0.2 + 2)
  const offset = { x: 0, y: Math.sin(angle) * 3 - 5 }
  const shimmerAlpha = Math.sin(angle) ** 2 * 0.75
  return plan([
    layer('orb-core', 'BadGuys', entry, { offset, scale: { x: scale, y: scale } }),
    layer('orb-white-additive', 'BadGuys', entry, {
      alpha: shimmerAlpha,
      blendMode: 'add',
      offset,
      scale: { x: scale, y: scale },
      tint: 0xffffff,
    }),
  ], scatterSeed)
}

function goldPlan(actor: BoneyardLootSnapshot, sourceSeed: number): NativeLootPresentationPlan {
  if (!actor.scatterActive) {
    const layers = [layer('gold-settled', 'BadGuys', 198 + actor.tier, {
      rotationRadians: degreesToRadians(actor.rotationDeg),
    })]
    const pulse = Math.sin(degreesToRadians(actor.animationPhase))
    if (pulse > 0) {
      layers.push(layer('gold-pulse', 'BadGuys', 73, {
        blendMode: 'add',
        offset: { x: -5, y: -5 },
        rotationRadians: degreesToRadians(actor.animationPhase),
        scale: { x: pulse * 1.25, y: pulse * 1.25 },
      }))
    }
    return plan(layers, sourceSeed)
  }

  const layers: NativeLootVisualLayer[] = [layer(
    'gold-scatter-base',
    'BadGuys',
    188 + Math.max(0, Math.min(9, Math.trunc(actor.scatterProgress))),
  )]
  let seed = sourceSeed
  const copies = actor.tier === 0 ? 0 : actor.tier === 1 ? 1 : actor.tier === 2 ? 2 : 4
  for (let index = 0; index < copies; index += 1) {
    seed = nextNativeGoldScatterSeed(seed)
    const direction = nativeAngleVector(seed % FULL_CIRCLE_DEGREES)
    layers.push(layer(`gold-scatter-copy-${index}`, 'BadGuys', 188 + actor.tier, {
      offset: {
        x: direction.x * GOLD_SCATTER_OFFSET,
        y: direction.y * GOLD_SCATTER_OFFSET,
      },
    }))
  }
  return plan(layers, seed)
}

function sackPlan(actor: BoneyardLootSnapshot, scatterSeed: number): NativeLootPresentationPlan {
  const offset = { x: 0, y: actor.bounceHeight }
  if (actor.itemNativeTypeId === 7001) {
    return plan([layer(
      'potion-sack',
      'BadGuys',
      436 + (actor.itemNativeSubtype ?? 0),
      { offset },
    )], scatterSeed)
  }
  if (actor.itemNativeTypeId === 7012) {
    return plan([layer('misc-sack', 'BadGuys', 33, { offset })], scatterSeed)
  }
  return plan([
    layer('equipment-sack-support', 'BadGuys', 67, { offset }),
    layer('equipment-sack-shell', 'BadGuys', 442 + actor.tier, { offset }),
  ], scatterSeed)
}

function bonusPlan(actor: BoneyardLootSnapshot, scatterSeed: number): NativeLootPresentationPlan {
  const frame = Math.max(0, Math.min(17, Math.trunc(actor.framePhase)))
  const supportOffset = { x: 0, y: -5 }
  const supportTint = actor.bonusKind === 0
    ? 0xffbfbf
    : actor.bonusKind === 1
      ? 0xbfffff
      : 0xd9ba70
  const layers = [
    layer('bonus-support-clockwise', 'BadGuys', 7, {
      alpha: actor.alpha * 0.5,
      blendMode: 'add',
      offset: supportOffset,
      rotationRadians: degreesToRadians(actor.rotationDeg),
      scale: { x: 2.5, y: 2.5 },
      tint: supportTint,
    }),
    layer('bonus-support-counterclockwise', 'BadGuys', 7, {
      alpha: actor.alpha * 0.25,
      blendMode: 'add',
      offset: supportOffset,
      rotationRadians: degreesToRadians(-actor.rotationDeg * 0.5),
      scale: { x: 2.25, y: 2.25 },
    }),
  ]
  const entry = actor.bonusKind === 0
    ? 140 + frame
    : actor.bonusKind === 1
      ? 122 + frame
      : 61
  layers.push(layer('bonus-body', 'BadGuys', entry, { alpha: actor.alpha }))
  return plan(layers, scatterSeed)
}

function plan(
  layers: readonly NativeLootVisualLayer[],
  nextScatterSeed: number,
): NativeLootPresentationPlan {
  return { layers: Object.freeze(layers), nextScatterSeed }
}

function layer(
  role: string,
  atlas: NativeLootAtlas,
  entry: number,
  overrides: Partial<Omit<NativeLootVisualLayer, 'atlas' | 'entry' | 'role'>> = {},
): NativeLootVisualLayer {
  return {
    alpha: overrides.alpha ?? 1,
    atlas,
    blendMode: overrides.blendMode ?? 'normal',
    entry,
    offset: overrides.offset ?? { x: 0, y: 0 },
    role,
    rotationRadians: overrides.rotationRadians ?? 0,
    scale: overrides.scale ?? { x: 1, y: 1 },
    tint: overrides.tint ?? 0xffffff,
  }
}

function nativeAngleVector(degrees: number): Readonly<{ x: number; y: number }> {
  const radians = degreesToRadians(degrees)
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}
