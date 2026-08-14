export const EARTH_BOULDER_LIT_RECORDS = [2008, 2009, 2010] as const
export const EARTH_FRAGMENT_ENHANCED_ALPHA = 10
export const EARTH_FRAGMENT_SUBCLASS_ALPHA_STEP = Math.fround(0.025)
export const EARTH_FRAGMENT_BASE_ALPHA_STEP = Math.fround(0.015)

export interface EarthImpactSeed {
  birthTick: number
  charge: number
  id: number
}

export interface EarthFragmentState {
  alpha: number
  height: number
  index: number
  position: { x: number, y: number }
  record: typeof EARTH_BOULDER_LIT_RECORDS[number]
  rotation: number
  scale: number
  velocity: { x: number, y: number }
  verticalVelocity: number
}

interface MutableEarthFragment extends EarthFragmentState {
  alive: boolean
  bounceCount: number
  bounceSeed: number
  rotationStep: number
}

export function earthImpactFragmentCount(charge: number): number {
  return Math.floor(Math.max(8, 30 * charge))
}

export function earthImpactLifetimeTicks(seed: EarthImpactSeed): number {
  let fragments = createFragments(seed)
  let ageTicks = 0
  while (fragments.some(({ alive }) => alive)) {
    ageTicks += 1
    fragments = fragments.map((fragment) => advanceFragment(
      fragment,
      seed,
      seed.birthTick + ageTicks,
    ))
  }
  return ageTicks
}

export function earthImpactFragmentsAtAge(
  seed: EarthImpactSeed,
  ageTicks: number,
): EarthFragmentState[] {
  const wholeTicks = Math.max(0, Math.floor(ageTicks))
  const blend = Math.max(0, Math.min(1, ageTicks - wholeTicks))
  let fragments = createFragments(seed)
  for (let tick = 1; tick <= wholeTicks; tick += 1) {
    fragments = fragments.map((fragment) => advanceFragment(
      fragment,
      seed,
      seed.birthTick + tick,
    ))
  }
  if (blend === 0) return fragments.filter(({ alive }) => alive).map(publicFragment)
  const next = fragments.map((fragment) => advanceFragment(
    fragment,
    seed,
    seed.birthTick + wholeTicks + 1,
  ))
  return fragments.flatMap((fragment, index) => {
    if (!fragment.alive) return []
    const after = next[index]
    return [after.alive ? interpolateFragment(fragment, after, blend) : publicFragment(fragment)]
  })
}

function createFragments(seed: EarthImpactSeed): MutableEarthFragment[] {
  const count = earthImpactFragmentCount(seed.charge)
  const q = Math.min(seed.charge, 1)
  const radius = Math.max(8, 30 * seed.charge)
  const angleStep = 360 / radius
  let angle = earthVisualUnitRandom(seed.id, 0x8000) * 360
  return Array.from({ length: count }, (_, index) => {
    const radians = angle * Math.PI / 180
    const direction = {
      x: Math.cos(radians),
      y: Math.sin(radians) * 0.8,
    }
    const bounceSeed = Math.fround(-(earthVisualUnitRandom(seed.id, lane(index, 0)) * 3 + 2))
    const verticalScale = earthVisualUnitRandom(seed.id, lane(index, 4)) * 1.5 * q + 0.75
    const verticalVelocity = Math.fround(bounceSeed * verticalScale)
    const spawnDistance = earthVisualUnitRandom(seed.id, lane(index, 6)) * 45 * seed.charge
    const speed = earthVisualUnitRandom(seed.id, lane(index, 9)) * 1.5 * seed.charge + 1.5
    const scaleProbe = (earthVisualUnitRandom(seed.id, lane(index, 7)) * 0.75 + 0.5)
      * seed.charge
    const scaleSource = scaleProbe >= Math.fround(0.45)
      ? (earthVisualUnitRandom(seed.id, lane(index, 8)) * 0.75 + 0.5) * seed.charge
      : Math.fround(0.45)
    const fragment: MutableEarthFragment = {
      alive: true,
      alpha: EARTH_FRAGMENT_ENHANCED_ALPHA,
      bounceCount: 0,
      bounceSeed: verticalVelocity,
      height: Math.fround(-earthVisualUnitRandom(seed.id, lane(index, 5)) * 50 * q),
      index,
      position: {
        x: Math.fround(direction.x * spawnDistance),
        y: Math.fround(direction.y * spawnDistance),
      },
      record: EARTH_BOULDER_LIT_RECORDS[earthVisualRandomInt(seed.id, lane(index, 3), 3)],
      rotation: Math.fround(earthVisualUnitRandom(seed.id, lane(index, 1)) * 360),
      rotationStep: Math.fround(earthVisualUnitRandom(seed.id, lane(index, 2)) * 10 + 1),
      scale: Math.min(0.75, Math.fround(scaleSource * Math.fround(0.65))),
      velocity: {
        x: Math.fround(direction.x * speed),
        y: Math.fround(direction.y * speed),
      },
      verticalVelocity,
    }
    const jitter = (earthVisualUnitRandom(seed.id, lane(index, 10)) * 2 - 1)
      * angleStep / 3
    angle = Math.fround(angle + angleStep + jitter)
    return fragment
  })
}

function advanceFragment(
  source: MutableEarthFragment,
  seed: EarthImpactSeed,
  globalTick: number,
): MutableEarthFragment {
  if (!source.alive) return source
  const fragment: MutableEarthFragment = {
    ...source,
    position: { ...source.position },
    velocity: { ...source.velocity },
  }
  const motionActive = fragment.height !== 0
  if (!(motionActive && globalTick % 3 === 0)) {
    if (motionActive) {
      fragment.position.x = Math.fround(fragment.position.x + fragment.velocity.x)
      fragment.position.y = Math.fround(fragment.position.y + fragment.velocity.y)
      fragment.height = Math.fround(fragment.height + fragment.verticalVelocity)
      fragment.verticalVelocity = Math.fround(fragment.verticalVelocity + Math.fround(0.4))
      if (fragment.height > 0) {
        fragment.rotationStep = Math.fround(
          earthVisualUnitRandom(seed.id, bounceLane(fragment.index, fragment.bounceCount, 0)) * 10 + 1,
        )
        fragment.bounceSeed = Math.fround(fragment.bounceSeed * Math.fround(0.3))
        fragment.verticalVelocity = fragment.bounceSeed
        if (earthVisualRandomInt(
          seed.id,
          bounceLane(fragment.index, fragment.bounceCount, 1),
          2,
        ) === 1) {
          fragment.velocity.x = Math.fround(fragment.velocity.x * Math.fround(0.65))
          fragment.velocity.y = Math.fround(fragment.velocity.y * Math.fround(0.65))
        }
        fragment.bounceCount += 1
        if (fragment.verticalVelocity > -0.75) {
          fragment.bounceSeed = 0
          fragment.verticalVelocity = 0
          fragment.velocity.x = 0
          fragment.velocity.y = 0
          fragment.rotationStep = 0
        }
        fragment.height = fragment.verticalVelocity
      }
      fragment.rotation = Math.fround(fragment.rotation + fragment.rotationStep)
    }
    fragment.alpha = Math.fround(fragment.alpha - EARTH_FRAGMENT_BASE_ALPHA_STEP)
  }
  fragment.alpha = Math.fround(fragment.alpha - EARTH_FRAGMENT_SUBCLASS_ALPHA_STEP)
  fragment.alive = fragment.alpha > 0
  return fragment
}

function interpolateFragment(
  first: MutableEarthFragment,
  second: MutableEarthFragment,
  blend: number,
): EarthFragmentState {
  return {
    alpha: lerp(first.alpha, second.alpha, blend),
    height: lerp(first.height, second.height, blend),
    index: first.index,
    position: {
      x: lerp(first.position.x, second.position.x, blend),
      y: lerp(first.position.y, second.position.y, blend),
    },
    record: first.record,
    rotation: lerp(first.rotation, second.rotation, blend),
    scale: first.scale,
    velocity: {
      x: lerp(first.velocity.x, second.velocity.x, blend),
      y: lerp(first.velocity.y, second.velocity.y, blend),
    },
    verticalVelocity: lerp(first.verticalVelocity, second.verticalVelocity, blend),
  }
}

function publicFragment(fragment: MutableEarthFragment): EarthFragmentState {
  return {
    alpha: fragment.alpha,
    height: fragment.height,
    index: fragment.index,
    position: { ...fragment.position },
    record: fragment.record,
    rotation: fragment.rotation,
    scale: fragment.scale,
    velocity: { ...fragment.velocity },
    verticalVelocity: fragment.verticalVelocity,
  }
}

function lane(index: number, sample: number): number {
  return 0x9000 + index * 16 + sample
}

function bounceLane(index: number, bounce: number, sample: number): number {
  return 0xc000 + index * 32 + bounce * 2 + sample
}

export function earthVisualUnitRandom(id: number, salt: number): number {
  return visualHash(id, salt) / 0x1_0000_0000
}

export function earthVisualRandomInt(id: number, salt: number, exclusiveMax: number): number {
  return Math.floor(earthVisualUnitRandom(id, salt) * exclusiveMax)
}

function visualHash(id: number, salt: number): number {
  let value = (id ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value ^= value >>> 16
  return value >>> 0
}

function lerp(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
}
