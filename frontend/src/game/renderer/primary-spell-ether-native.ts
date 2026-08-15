import type { PrimarySpellEtherImpactState } from '../core-kernels/primary-spells.ts'
import type { NativeBoneyardLightSource } from './boneyard-lighting.ts'

export type EtherPrimaryBlend = 'add' | 'normal'
export type EtherPrimaryRole =
  | 'fixed-spark'
  | 'inner-core'
  | 'outer-core'
  | 'radial-spark'
  | 'ray'
export type EtherPrimarySprite = 'core' | 'ray' | 'spark'

export interface EtherPrimaryDraw {
  alpha: number
  blend: EtherPrimaryBlend
  pass: 0 | 1
  role: EtherPrimaryRole
  rotationDegrees: number
  scale: number
  sprite: EtherPrimarySprite
  tint: number
  x: number
  y: number
}

export interface EtherPrimaryFlightPlan {
  draws: readonly EtherPrimaryDraw[]
  phase: number
  sampledScale: number
}

export interface EtherPrimaryImpactPlan extends EtherPrimaryFlightPlan {
  fade: number
  position: { x: number; y: number }
  regionLightPoint: null
  worldY: number
}

export const ETHER_PRIMARY_FLIGHT_RECORDS = {
  core: 110,
  ray: 112,
  spark: 111,
} as const

export const ETHER_PRIMARY_PHASE_DEGREES_PER_TICK = 9
export const ETHER_PRIMARY_UNDERPOWERED_PHASE_DEGREES_PER_TICK = 7.2
export const ETHER_PRIMARY_ROOT_OFFSET = { x: 0, y: -10 } as const
export const ETHER_PRIMARY_IMPACT_SORT_BIAS = 100
export const ETHER_PRIMARY_IMPACT_LIGHT_RADIUS = 0.75

const ETHER_PURPLE = 0xff80ff
const WHITE = 0xffffff

export function etherPrimaryPhase(
  projectileId: number,
  ageTicks: number,
  underpowered = false,
): number {
  return visualRandom(projectileId, 0, 0) * 360
    + ageTicks * (underpowered
      ? ETHER_PRIMARY_UNDERPOWERED_PHASE_DEGREES_PER_TICK
      : ETHER_PRIMARY_PHASE_DEGREES_PER_TICK)
}

export function etherPrimaryFlightPlan(
  projectileId: number,
  ageTicks: number,
  underpowered = false,
): EtherPrimaryFlightPlan {
  const phase = etherPrimaryPhase(projectileId, ageTicks, underpowered)
  return etherPrimaryCompositorPlan(
    projectileId,
    Math.floor(ageTicks),
    phase,
    1,
    underpowered ? 0.5 : 1,
  )
}

export function etherPrimaryImpactFade(ageTicks: number): number {
  let fade = Math.fround(2)
  for (let tick = 0; tick <= Math.floor(ageTicks); tick += 1) {
    fade = Math.fround(fade - Math.fround(0.1))
  }
  return fade
}

export function etherPrimaryImpactPlan(
  state: PrimarySpellEtherImpactState,
): EtherPrimaryImpactPlan {
  const ageTicks = Math.floor(state.ageTicks)
  const fade = etherPrimaryImpactFade(ageTicks)
  const plan = etherPrimaryCompositorPlan(
    state.id,
    state.birthTick + ageTicks,
    state.birthTick + ageTicks,
    2,
    fade,
  )
  return {
    ...plan,
    fade,
    position: { ...state.origin },
    regionLightPoint: null,
    worldY: state.origin.y + ETHER_PRIMARY_IMPACT_SORT_BIAS,
  }
}

export function etherPrimaryImpactLightSource(
  state: PrimarySpellEtherImpactState,
): NativeBoneyardLightSource {
  let intensity = Math.fround(1)
  for (let tick = 0; tick <= Math.floor(state.ageTicks); tick += 1) {
    intensity = Math.fround(intensity + Math.fround(-0.05))
  }
  return {
    castsDirectionalShadow: false,
    intensity: Math.min(intensity, 1),
    position: { ...state.origin },
    radius: ETHER_PRIMARY_IMPACT_LIGHT_RADIUS,
  }
}

export function etherPrimaryCompositorPlan(
  projectileId: number,
  sampleTick: number,
  phase: number,
  overallScale: number,
  alphaMultiplier: number,
): EtherPrimaryFlightPlan {
  let randomChannel = 0
  const random = (): number => visualRandom(projectileId, sampleTick, ++randomChannel)
  const sampledScale = (1 + random() * 0.5) * overallScale
  const draws: EtherPrimaryDraw[] = []
  const corePulse = 0.15 * Math.abs(sinDegrees(15 * phase))

  for (const pass of [0, 1] as const) {
    draws.push(
      draw(pass, 'outer-core', 'core', 'normal', (2.5 + corePulse) * sampledScale, {
        alpha: 0.2 + random() * 0.25,
        tint: ETHER_PURPLE,
      }),
      draw(pass, 'inner-core', 'core', 'normal', (1.5 + corePulse) * sampledScale, {
        alpha: 0.35 + random() * 0.55,
        tint: ETHER_PURPLE,
      }),
      draw(pass, 'fixed-spark', 'spark', 'add', (1 + random() * 0.1) * sampledScale, {
        alpha: 0.35 * Math.abs(sinDegrees(5 * phase)),
        rotationDegrees: 50 * sampledScale * sinDegrees(phase),
      }),
    )

    const particleCount = Math.floor(random() * 10) + 2
    for (let particle = 0; particle < particleCount; particle += 1) {
      const angle = random() * Math.PI * 2
      const radius = random() * 20 * sampledScale
      draws.push(draw(
        pass,
        'radial-spark',
        'spark',
        'add',
        (0.25 + random() * 0.2) * sampledScale,
        {
          alpha: random() * 0.75,
          rotationDegrees: random() * 360,
          x: Math.sin(angle) * radius,
          y: -Math.cos(angle) * radius,
        },
      ))
    }

    draws.push(draw(pass, 'ray', 'ray', 'add', (1 + random() * 0.3) * sampledScale, {
      alpha: 0.55 * Math.abs(sinDegrees(8 * phase)),
      rotationDegrees: 50 * sampledScale * sinDegrees(0.5 * phase),
    }))
  }

  return {
    draws: alphaMultiplier === 1
      ? draws
      : draws.map((operation) => ({
          ...operation,
          alpha: Math.fround(operation.alpha * alphaMultiplier),
        })),
    phase,
    sampledScale,
  }
}

function draw(
  pass: 0 | 1,
  role: EtherPrimaryRole,
  sprite: EtherPrimarySprite,
  blend: EtherPrimaryBlend,
  scale: number,
  options: Partial<Pick<EtherPrimaryDraw, 'alpha' | 'rotationDegrees' | 'tint' | 'x' | 'y'>> = {},
): EtherPrimaryDraw {
  return {
    alpha: options.alpha ?? 1,
    blend,
    pass,
    role,
    rotationDegrees: options.rotationDegrees ?? 0,
    scale,
    sprite,
    tint: options.tint ?? WHITE,
    x: options.x ?? 0,
    y: options.y ?? 0,
  }
}

function sinDegrees(degrees: number): number {
  return Math.sin(degrees * Math.PI / 180)
}

function visualRandom(projectileId: number, ageTicks: number, channel: number): number {
  let value = (
    projectileId
    ^ Math.imul(ageTicks + 1, 0x9e37_79b1)
    ^ Math.imul(channel + 1, 0x85eb_ca6b)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb_352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846c_a68b) >>> 0
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}
