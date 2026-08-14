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

export const ETHER_PRIMARY_FLIGHT_RECORDS = {
  core: 110,
  ray: 112,
  spark: 111,
} as const

export const ETHER_PRIMARY_PHASE_DEGREES_PER_TICK = 9
export const ETHER_PRIMARY_ROOT_OFFSET = { x: 0, y: -10 } as const

const ETHER_PURPLE = 0xff80ff
const WHITE = 0xffffff

export function etherPrimaryPhase(projectileId: number, ageTicks: number): number {
  return visualRandom(projectileId, 0, 0) * 360
    + ageTicks * ETHER_PRIMARY_PHASE_DEGREES_PER_TICK
}

export function etherPrimaryFlightPlan(
  projectileId: number,
  ageTicks: number,
): EtherPrimaryFlightPlan {
  const phase = etherPrimaryPhase(projectileId, ageTicks)
  let randomChannel = 0
  const random = (): number => visualRandom(projectileId, ageTicks, ++randomChannel)
  const sampledScale = 1 + random() * 0.5
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

  return { draws, phase, sampledScale }
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
