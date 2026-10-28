export type NativeElementVfxSprite =
  | 'air'
  | 'aura'
  | 'core'
  | 'earth'
  | 'fire'
  | 'ray'
  | 'spark'
  | 'steam'
  | 'water'
export type NativeElement = 'air' | 'earth' | 'ether' | 'fire' | 'water'
export type NativeElementVfxBlend = 'lighter' | 'source-over'
export type NativeElementVfxColor = readonly [red: number, green: number, blue: number]

export interface NativeElementVfxDraw {
  alpha: number
  anchor?: readonly [x: number, y: number]
  blend: NativeElementVfxBlend
  color: NativeElementVfxColor
  frame: number
  rotation: number
  scale: number
  sprite: NativeElementVfxSprite
  x: number
  y: number
}

export interface NativeElementVfxSpriteMetrics {
  count: number
  height: number
  width: number
}

export type NativeElementVfxStripSprite = Exclude<NativeElementVfxSprite, 'aura' | 'steam'>

export function isNativeElementVfxStripSprite(
  sprite: NativeElementVfxSprite,
): sprite is NativeElementVfxStripSprite {
  return sprite !== 'aura' && sprite !== 'steam'
}

export const NATIVE_ELEMENT_VFX_SPRITES: Readonly<Record<NativeElementVfxStripSprite, NativeElementVfxSpriteMetrics>> = {
  air: { count: 4, height: 59, width: 55 },
  core: { count: 1, height: 26, width: 27 },
  earth: { count: 8, height: 50, width: 50 },
  fire: { count: 12, height: 54, width: 32 },
  ray: { count: 1, height: 40, width: 40 },
  spark: { count: 1, height: 40, width: 40 },
  water: { count: 12, height: 36, width: 38 },
}

export const NATIVE_ELEMENT_VFX_RECORDS: Readonly<Record<NativeElementVfxSprite, readonly number[]>> = Object.freeze({
  air: Object.freeze([1836, 1837, 1838, 1839]),
  aura: Object.freeze([15]),
  core: Object.freeze([110]),
  earth: Object.freeze([238, 239, 240, 241, 242, 243, 244, 245]),
  fire: Object.freeze([255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266]),
  ray: Object.freeze([112]),
  spark: Object.freeze([111]),
  steam: Object.freeze([2002, 2003, 2004, 2005, 2006, 2007]),
  water: Object.freeze([271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282]),
})

export const NATIVE_ELEMENT_VFX_SCALE = {
  held: 6,
  picker: 2,
  staff: 1,
} as const

const NATIVE_CORE_PULSE_AMPLITUDE = 0.15

const WHITE = [1, 1, 1] as const
const AIR = [0.5, 0.75, 0.75] as const
const EARTH_DARK = [0.5, 0.65, 0.5] as const
const EARTH_LIGHT = [0.75, 0.95, 0.75] as const
const ETHER = [1, 0.5, 1] as const
const FIRE = [1, 0.5, 0] as const
const WATER = [1, 0.75, 1] as const
const STEAM_ANCHORS = Object.freeze([
  [16 / 34, 17 / 33],
  [18 / 37, 17 / 34],
  [17 / 35, 16 / 34],
  [16 / 34, 16 / 34],
  [16 / 35, 17 / 35],
  [16 / 34, 18 / 35],
] as const)

function normalizedFrame(tick: number, frameCount: number, divisor = 1): number {
  const frame = Math.floor(tick / divisor) % frameCount
  return frame < 0 ? frame + frameCount : frame
}

function pulse(tick: number, degreesPerTick: number, base: number): number {
  return Math.abs(Math.sin(tick * degreesPerTick * Math.PI / 180))
    * NATIVE_CORE_PULSE_AMPLITUDE + base
}

function nativeHash(value: number): number {
  let mixed = value | 0
  mixed = (mixed << 21) ^ mixed
  mixed ^= mixed >>> 11
  mixed = Math.imul((mixed << 4) ^ mixed, 0x0a67cfcf)
  return Math.abs(mixed | 0)
}

function visualRandom(tick: number, channel: number): number {
  return nativeHash((tick + 1) ^ Math.imul(channel + 1, 0x45d9f3b)) / 0x8000_0000
}

function draw(
  sprite: NativeElementVfxSprite,
  scale: number,
  options: Partial<Omit<NativeElementVfxDraw, 'scale' | 'sprite'>> = {},
): NativeElementVfxDraw {
  return {
    ...(options.anchor === undefined ? {} : { anchor: options.anchor }),
    alpha: options.alpha ?? 1,
    blend: options.blend ?? 'source-over',
    color: options.color ?? WHITE,
    frame: options.frame ?? 0,
    rotation: options.rotation ?? 0,
    scale,
    sprite,
    x: options.x ?? 0,
    y: options.y ?? 0,
  }
}

function etherPlan(tick: number, scale: number): NativeElementVfxDraw[] {
  const plan: NativeElementVfxDraw[] = []
  let randomChannel = 0
  for (let pass = 0; pass < 2; pass += 1) {
    plan.push(
      draw('core', pulse(tick, 15, 2.5) * scale, {
        alpha: 0.2 + visualRandom(tick, randomChannel++) * 0.25,
        color: ETHER,
      }),
      draw('core', pulse(tick, 5, 1.5) * scale, {
        alpha: 0.35 + visualRandom(tick, randomChannel++) * 0.55,
        color: ETHER,
      }),
      draw('spark', (1 + visualRandom(tick, randomChannel++) * 0.1) * scale, {
        alpha: Math.abs(Math.sin(tick * 5 * Math.PI / 180)) * 0.35,
        blend: 'lighter',
        rotation: Math.sin(tick * Math.PI / 180) * scale * 50,
      }),
    )

    const particleCount = Math.floor(visualRandom(tick, randomChannel++) * 10) + 2
    for (let particle = 0; particle < particleCount; particle += 1) {
      const radius = visualRandom(tick, randomChannel++) * 20 * scale
      const angle = visualRandom(tick, randomChannel++) * Math.PI * 2
      plan.push(draw('spark', (0.25 + visualRandom(tick, randomChannel++) * 0.2) * scale, {
        alpha: visualRandom(tick, randomChannel++) * 0.75,
        blend: 'lighter',
        rotation: visualRandom(tick, randomChannel++) * 360,
        x: Math.sin(angle) * radius,
        y: -Math.cos(angle) * radius,
      }))
    }

    plan.push(draw('ray', (1 + visualRandom(tick, randomChannel++) * 0.3) * scale, {
      alpha: Math.abs(Math.sin(tick * 8 * Math.PI / 180)) * 0.55,
      blend: 'lighter',
      rotation: Math.sin(tick * 0.5 * Math.PI / 180) * scale * 50,
    }))
  }
  return plan
}

function firePlan(tick: number, scale: number): NativeElementVfxDraw[] {
  const frame = normalizedFrame(tick, 12, 5)
  return [
    draw('core', pulse(tick, 15, 3.5) * scale, {
      alpha: 0.2 + visualRandom(tick, 0) * 0.25,
      color: FIRE,
    }),
    draw('fire', 2 * scale, { blend: 'lighter', frame }),
    draw('fire', 2 * scale, { alpha: 0.5, frame }),
  ]
}

function airPlan(tick: number, scale: number): NativeElementVfxDraw[] {
  const primaryPulse = pulse(tick, 15, 3.5)
  const secondaryPulse = pulse(tick, 1, 3.5)
  const stage = normalizedFrame(tick, 8)
  let hash = nativeHash(Math.trunc(tick / 8))
  const offsetAngle = (hash % 36_000) / 360_000 * 360 * Math.PI / 180
  hash = nativeHash(hash)
  const radius = (hash % 36_000) / 360_000 * 10
  hash = nativeHash(hash)
  const rotation = (hash % 36_000) / 360_000 * 360
  hash = nativeHash(hash)
  const particleScale = (0.75 + (hash % 36_000) / 360_000 * 0.25) * scale
  hash = nativeHash(hash)
  const frame = hash % 4
  const particleAlpha = Math.sin(stage * Math.PI / 8)

  return [
    draw('core', primaryPulse * scale, {
      alpha: 0.2 + visualRandom(tick, 0) * 0.25,
      blend: 'lighter',
      color: AIR,
    }),
    draw('core', secondaryPulse * 0.75 * scale, {
      alpha: 0.5,
      blend: 'lighter',
      color: AIR,
    }),
    draw('core', secondaryPulse * 0.5 * scale, {
      alpha: 0.5,
      blend: 'lighter',
      color: AIR,
    }),
    draw('core', secondaryPulse * (0.2 + visualRandom(tick, 1) * 0.2) * scale, {
      alpha: 0.25,
      blend: 'lighter',
      color: AIR,
    }),
    draw('air', particleScale, {
      alpha: particleAlpha,
      blend: 'lighter',
      frame,
      rotation,
      x: Math.sin(offsetAngle) * radius,
      y: -Math.cos(offsetAngle) * radius,
    }),
    draw('air', scale, {
      alpha: particleAlpha * 0.25,
      blend: 'lighter',
      frame: 3 - frame,
      rotation: rotation + 90,
      x: Math.sin(offsetAngle) * radius,
      y: -Math.cos(offsetAngle) * radius,
    }),
  ]
}

function waterPlan(tick: number, scale: number): NativeElementVfxDraw[] {
  const plan = [
    draw('water', 1.8 * scale, { frame: normalizedFrame(tick, 12, 8) }),
    draw('core', pulse(tick, 15, 3.5) * scale, {
      alpha: 0.2 + visualRandom(tick, 0) * 0.25,
      blend: 'lighter' as const,
      color: WATER,
    }),
  ]
  for (let pass = 0; pass < 2; pass += 1) {
    plan.push(draw('ray', (1 + visualRandom(tick, pass + 1) * 0.3) * scale, {
      alpha: Math.abs(Math.sin(tick * 11 * Math.PI / 180)) * 0.55,
      rotation: Math.sin(tick * 0.5 * Math.PI / 180) * scale * 50,
    }))
  }
  return plan
}

function earthPlan(tick: number, scale: number): NativeElementVfxDraw[] {
  const frame = normalizedFrame(tick, 8)
  return [
    draw('earth', 1.5 * scale, { color: EARTH_DARK, frame: 7 - frame }),
    draw('earth', 1.8 * scale, { alpha: 0.1, blend: 'lighter', frame }),
    draw('core', pulse(tick, 15, 3.5) * scale, {
      alpha: 0.2 + visualRandom(tick, 0) * 0.25,
      blend: 'lighter',
      color: EARTH_LIGHT,
    }),
    draw('core', pulse(tick, 1, 1) * scale, {
      alpha: 0.25,
      blend: 'lighter',
    }),
  ]
}

function multiplyPlan(
  plan: readonly NativeElementVfxDraw[],
  color: NativeElementVfxColor,
  alpha = 1,
  blend: NativeElementVfxBlend | null = null,
): NativeElementVfxDraw[] {
  return plan.map((operation) => ({
    ...operation,
    alpha: operation.alpha * alpha,
    blend: blend ?? operation.blend,
    color: [
      operation.color[0] * color[0],
      operation.color[1] * color[1],
      operation.color[2] * color[2],
    ] as NativeElementVfxColor,
  }))
}

function airCompanionPlan(tick: number, scale: number): NativeElementVfxDraw[] {
  return airPlan(tick, scale).slice(-2)
}

function steamPlan(tick: number, scale: number): NativeElementVfxDraw[] {
  const outerGreen = 0.5 + visualRandom(tick, 0) * 0.5
  const innerGreen = 0.5 + visualRandom(tick, 1) * 0.5
  const alpha = 0.2 + visualRandom(tick, 2) * 0.25
  const green = outerGreen * innerGreen
  const frame = normalizedFrame(tick, 6, 8)
  return [
    draw('steam', 1.8 * scale, {
      alpha,
      anchor: STEAM_ANCHORS[frame],
      color: [1, green, 0],
      frame,
    }),
    draw('core', pulse(tick, 15, 3.5) * scale, {
      alpha,
      color: [1, green, 0],
    }),
  ]
}

function selectedWeldPlan(
  buildId: number,
  tick: number,
  scale: number,
): NativeElementVfxDraw[] {
  switch (buildId) {
    case 1000:
      return [
        ...firePlan(tick, scale),
        ...multiplyPlan(etherPlan(tick, scale), WHITE, 0.25),
      ]
    case 1001:
      return [
        ...waterPlan(tick, scale),
        ...multiplyPlan(etherPlan(tick, scale), WHITE, 0.25),
      ]
    case 1002:
      return [
        ...airPlan(tick, scale),
        ...multiplyPlan(etherPlan(tick, scale), WHITE, 0.25),
      ]
    case 1003:
      return [
        ...multiplyPlan(earthPlan(tick, scale), FIRE),
        draw('core', scale * 2, { color: [1, 0.75, 0] }),
        ...(scale > 1
          ? [draw('core', scale * 2, {
              alpha: Math.min(scale - 1, 1),
              blend: 'lighter',
              color: [1, 0.75, 0],
            })]
          : []),
        ...airCompanionPlan(tick, scale),
      ]
    case 1004:
      return [
        ...waterPlan(tick, scale),
        ...airCompanionPlan(tick, scale),
      ]
    case 1005:
      return steamPlan(tick, scale)
    case 1006:
      return [
        ...multiplyPlan(earthPlan(tick, scale * 0.75), ETHER),
        ...multiplyPlan(earthPlan(tick, scale), ETHER, 1, 'lighter'),
      ]
    case 1007:
      return [...earthPlan(tick, scale), ...firePlan(tick, scale)]
    case 1008:
      return [...earthPlan(tick, scale), ...waterPlan(tick, scale)]
    case 1009:
      return [
        draw('aura', (1.5 + Math.abs(Math.sin(tick * Math.PI / 180)) * 0.5) * scale, {
          color: [0.5, 0.75, 0.5],
          rotation: tick * 8,
        }),
        ...multiplyPlan(airPlan(tick, scale * 1.25), WHITE, 0.5),
      ]
    case 1010:
      return [...etherPlan(tick, scale), ...etherPlan(tick, scale)]
    case 1011:
      return [...firePlan(tick, scale), ...firePlan(tick, scale)]
    case 1012:
      return [...waterPlan(tick, scale), ...waterPlan(tick, scale)]
    case 1013:
      return [...airPlan(tick, scale), ...airPlan(tick, scale)]
    case 1014:
      return [...earthPlan(tick, scale), ...earthPlan(tick, scale)]
    default:
      return []
  }
}

export function nativeElementVfxPlan(
  element: NativeElement,
  tick: number,
  scale: number,
): NativeElementVfxDraw[] {
  return nativeElementVfxPlanAtPhase(element, Math.floor(tick), scale)
}

export function nativeElementVfxPlanAtPhase(
  element: NativeElement,
  phase: number,
  scale: number,
): NativeElementVfxDraw[] {
  switch (element) {
    case 'ether': return etherPlan(phase, scale)
    case 'fire': return firePlan(phase, scale)
    case 'air': return airPlan(phase, scale)
    case 'water': return waterPlan(phase, scale)
    case 'earth': return earthPlan(phase, scale)
  }
}

export function nativeSelectedPrimaryElementVfxPlan(
  selectedPrimaryId: number,
  tick: number,
  scale: number,
): NativeElementVfxDraw[] {
  const phase = Math.floor(tick)
  switch (selectedPrimaryId) {
    case 8: return etherPlan(phase, scale)
    case 16: return firePlan(phase, scale)
    case 24: return airPlan(phase, scale)
    case 32: return waterPlan(phase, scale)
    case 40: return earthPlan(phase, scale)
    default: return selectedWeldPlan(selectedPrimaryId, phase, scale)
  }
}
