import type { Vector2 } from './vector.ts'

export const NATIVE_HAGATHA_SELECTORS = Object.freeze({
  life: 0,
  mana: 1,
  speed: 2,
  item: 3,
  gold: 4,
  seeker: 5,
  revelation: 6,
  cheatDeath: 7,
  perky: 8,
  scatter: 9,
  war: 10,
  curing: 11,
  lastWord: 12,
  spellwelder: 13,
  weirdCaster: 14,
  drinker: 15,
  glassCannon: 16,
  sorceror: 17,
  focus: 18,
  disfiguring: 19,
  bareHands: 20,
  splitMind: 21,
  curseBosses: 22,
  arcaneAttractor: 23,
  serendipity: 24,
  reverie: 25,
  brute: 26,
  tonic: 27,
} as const)

export const NATIVE_HAGATHA_FACTORS = Object.freeze({
  bareHandsDamage: Math.fround(1.149999976158142),
  bareHandsMana: Math.fround(0.8500000238418579),
  bruteMelee: Math.fround(3),
  brutePush: Math.fround(2),
  cheatDeathRecovery: Math.fround(0.5),
  curingPoison: Math.fround(0.5),
  focusRecharge: Math.fround(1.25),
  glassCannon: Math.fround(2),
  life: Math.fround(1.25),
  mana: Math.fround(1.25),
  serendipityDamage: Math.fround(3),
  speed: Math.fround(1.100000023841858),
  warMana: Math.fround(0.75),
} as const)

export const NATIVE_HAGATHA_REVELATION_MINIMUM_RANK = 2
export const NATIVE_HAGATHA_DRINKER_LETHAL_HEALTH = -10
export const NATIVE_HAGATHA_LAST_WORD_DEATH_TICK = 200
export const NATIVE_HAGATHA_LAST_WORD_ARCHIVE_TICK = 300
export const NATIVE_HAGATHA_LAST_WORD_PRESENTATION_SCALE = 15
export const NATIVE_HAGATHA_LAST_WORD_RADIUS = 825
export const NATIVE_HAGATHA_LAST_WORD_DAMAGE = 5_000
export const NATIVE_HAGATHA_SEEKER_PROGRAM = Object.freeze({
  distanceCap: 300,
  distanceCutoff: 100,
  endDistanceFactor: 0.5,
  idPhaseDegrees: 35,
  innerRadius: 35,
  joinRadius: 50,
  pulseAmplitude: 0.1,
  pulseBase: 0.25,
  tickPhaseDegrees: 2,
  transparentColor: 0xffffff,
  visibleColor: 0xd8ba70,
  width: 3,
} as const)
export const NATIVE_HAGATHA_SEEKER_RAMP_RGBA = Object.freeze([
  0xff, 0xff, 0xff, 0x00,
  0xd8, 0xba, 0x70, 0xff,
] as const)
export const NATIVE_HAGATHA_SEEKER_RAMP_U = Object.freeze({
  transparent: 0.25,
  visible: 0.75,
} as const)
export const NATIVE_HAGATHA_LAST_WORD_SACK_SUFFIXES = Object.freeze([
  'Earthly Possessions',
  'Stuff',
  'Dead Stuff',
  'Bag',
  'Loot',
] as const)

export const NATIVE_HAGATHA_BOSS_TYPE_IDS = Object.freeze([
  1008,
  1009,
  1010,
  1011,
] as const)

const NATIVE_HAGATHA_BOSS_TYPE_ID_SET = new Set<number>(NATIVE_HAGATHA_BOSS_TYPE_IDS)

export interface NativeHagathaRuntimeState {
  readonly cheatDeathCharges: number
  readonly reverieActive: boolean
  readonly serendipityActive: boolean
}

export interface NativeHagathaDerivedModifiers {
  readonly castSpeedFactor: number
  readonly incomingDamageFactor: number
  readonly meleeDamageFactor: number
  readonly movementFactor: number
  readonly offensiveManaFactor: number
  readonly poisonDamageFactor: number
  readonly pushStrengthFactor: number
  readonly rechargeFactor: number
  readonly spellDamageFactor: number
}

export type NativeHagathaSeekerTargetKind = 'bonus' | 'gold' | 'sack'

export interface NativeHagathaSeekerTarget {
  readonly id: number
  readonly kind: NativeHagathaSeekerTargetKind
  readonly position: Readonly<Vector2>
}

export interface NativeHagathaSeekerSegment {
  readonly alpha: number
  readonly end: Readonly<Vector2>
  readonly endVisible: boolean
  readonly start: Readonly<Vector2>
  readonly startVisible: boolean
  readonly targetId: number
  readonly targetKind: NativeHagathaSeekerTargetKind
  readonly width: number
}

export interface NativeHagathaSeekerMeshPlan {
  readonly alpha: number
  readonly alphaByte: number
  readonly uvs: readonly number[]
  readonly vertices: readonly number[]
}

export function ownsNativeHagathaSelector(
  ownedSelectors: readonly number[],
  selector: number,
): boolean {
  return ownedSelectors.includes(selector)
}

export function createNativeHagathaRuntimeState(): NativeHagathaRuntimeState {
  return Object.freeze({
    cheatDeathCharges: 0,
    reverieActive: false,
    serendipityActive: false,
  })
}

export function applyNativeHagathaPurchaseRuntime(
  source: NativeHagathaRuntimeState,
  purchasedSelectors: readonly number[],
): NativeHagathaRuntimeState {
  const cheatDeathCharges = purchasedSelectors.includes(NATIVE_HAGATHA_SELECTORS.cheatDeath)
    ? 1
    : source.cheatDeathCharges
  const serendipityActive = purchasedSelectors.includes(NATIVE_HAGATHA_SELECTORS.serendipity)
    ? true
    : source.serendipityActive
  const reverieActive = purchasedSelectors.includes(NATIVE_HAGATHA_SELECTORS.reverie)
    ? true
    : source.reverieActive
  return cheatDeathCharges === source.cheatDeathCharges
      && serendipityActive === source.serendipityActive
      && reverieActive === source.reverieActive
    ? source
    : Object.freeze({ cheatDeathCharges, reverieActive, serendipityActive })
}

export function removeNativeHagathaRuntime(
  source: NativeHagathaRuntimeState,
  selector: number,
): NativeHagathaRuntimeState {
  const cheatDeathCharges = selector === NATIVE_HAGATHA_SELECTORS.cheatDeath
    ? 0
    : source.cheatDeathCharges
  const serendipityActive = selector === NATIVE_HAGATHA_SELECTORS.serendipity
    ? false
    : source.serendipityActive
  const reverieActive = selector === NATIVE_HAGATHA_SELECTORS.reverie
    ? false
    : source.reverieActive
  return cheatDeathCharges === source.cheatDeathCharges
      && serendipityActive === source.serendipityActive
      && reverieActive === source.reverieActive
    ? source
    : Object.freeze({ cheatDeathCharges, reverieActive, serendipityActive })
}

export function clearNativeHagathaUntilHurt(
  source: NativeHagathaRuntimeState,
  remainingDamage: number,
): NativeHagathaRuntimeState {
  if (!Number.isFinite(remainingDamage) || remainingDamage < 0) {
    throw new RangeError('remaining Hagatha damage must be finite and non-negative')
  }
  if (remainingDamage === 0 || (!source.serendipityActive && !source.reverieActive)) {
    return source
  }
  return Object.freeze({
    ...source,
    reverieActive: false,
    serendipityActive: false,
  })
}

export function consumeNativeHagathaCheatDeath(
  source: NativeHagathaRuntimeState,
  maximumHealth: number,
): Readonly<{
  currentHealth: number
  runtime: NativeHagathaRuntimeState
  triggered: boolean
}> {
  if (!Number.isFinite(maximumHealth) || maximumHealth <= 0) {
    throw new RangeError('Cheat Death maximum health must be finite and positive')
  }
  if (source.cheatDeathCharges === 0) {
    return Object.freeze({ currentHealth: 0, runtime: source, triggered: false })
  }
  if (source.cheatDeathCharges !== 1) {
    throw new RangeError('Cheat Death charges must be zero or one')
  }
  return Object.freeze({
    currentHealth: Math.fround(maximumHealth * NATIVE_HAGATHA_FACTORS.cheatDeathRecovery),
    runtime: Object.freeze({ ...source, cheatDeathCharges: 0 }),
    triggered: true,
  })
}

export function nativeHagathaDerivedModifiers(
  ownedSelectors: readonly number[],
  runtime: NativeHagathaRuntimeState,
  weaponEquipped: boolean,
): NativeHagathaDerivedModifiers {
  const glass = ownsNativeHagathaSelector(
    ownedSelectors,
    NATIVE_HAGATHA_SELECTORS.glassCannon,
  )
  const bareHands = !weaponEquipped && ownsNativeHagathaSelector(
    ownedSelectors,
    NATIVE_HAGATHA_SELECTORS.bareHands,
  )
  return Object.freeze({
    castSpeedFactor: ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.speed)
      ? NATIVE_HAGATHA_FACTORS.speed
      : 1,
    incomingDamageFactor: glass ? NATIVE_HAGATHA_FACTORS.glassCannon : 1,
    meleeDamageFactor: Math.fround(
      (glass ? NATIVE_HAGATHA_FACTORS.glassCannon : 1)
        * (ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.brute)
          ? NATIVE_HAGATHA_FACTORS.bruteMelee
          : 1),
    ),
    movementFactor: ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.speed)
      ? NATIVE_HAGATHA_FACTORS.speed
      : 1,
    offensiveManaFactor: Math.fround(
      (runtime.reverieActive ? 0 : 1)
        * (ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.war)
          ? NATIVE_HAGATHA_FACTORS.warMana
          : 1)
        * (bareHands ? NATIVE_HAGATHA_FACTORS.bareHandsMana : 1),
    ),
    poisonDamageFactor: ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.curing)
      ? NATIVE_HAGATHA_FACTORS.curingPoison
      : 1,
    pushStrengthFactor: ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.brute)
      ? NATIVE_HAGATHA_FACTORS.brutePush
      : 1,
    rechargeFactor: ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.focus)
      ? NATIVE_HAGATHA_FACTORS.focusRecharge
      : 1,
    spellDamageFactor: Math.fround(
      (runtime.serendipityActive ? NATIVE_HAGATHA_FACTORS.serendipityDamage : 1)
        * (bareHands ? NATIVE_HAGATHA_FACTORS.bareHandsDamage : 1)
        * (glass ? NATIVE_HAGATHA_FACTORS.glassCannon : 1),
    ),
  })
}

export function nativeHagathaRevelationRank(
  rank: number,
  ownedSelectors: readonly number[],
): number {
  if (!Number.isInteger(rank) || rank < 0) {
    throw new RangeError('Hagatha skill rank must be a non-negative integer')
  }
  return ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.revelation)
    ? Math.max(NATIVE_HAGATHA_REVELATION_MINIMUM_RANK, rank)
    : rank
}

export function nativeHagathaBossDamageFactor(
  ownedSelectors: readonly number[],
  nativeTypeId: number,
): number {
  return ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.curseBosses)
      && NATIVE_HAGATHA_BOSS_TYPE_ID_SET.has(nativeTypeId)
    ? 3
    : 1
}

export function nativeHagathaDrinkerShouldUseHealthPotion(
  ownedSelectors: readonly number[],
  currentHealth: number,
): boolean {
  return ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.drinker)
    && currentHealth <= NATIVE_HAGATHA_DRINKER_LETHAL_HEALTH
}

export function nativeHagathaDrinkerShouldUseManaPotion(
  ownedSelectors: readonly number[],
  currentMana: number,
  maximumMana: number,
  cost: number,
): boolean {
  if (![currentMana, maximumMana, cost].every(Number.isFinite)) return false
  return ownsNativeHagathaSelector(ownedSelectors, NATIVE_HAGATHA_SELECTORS.drinker)
    && cost > currentMana
    && cost < maximumMana
}

export function nativeHagathaSeekerSegments(
  playerPosition: Readonly<Vector2>,
  targets: readonly NativeHagathaSeekerTarget[],
  tick: number,
): readonly NativeHagathaSeekerSegment[] {
  if (!Number.isFinite(tick) || tick < 0) {
    throw new RangeError('Seeker presentation tick must be finite and non-negative')
  }
  const segments: NativeHagathaSeekerSegment[] = []
  for (const target of targets) {
    const deltaX = target.position.x - playerPosition.x
    const deltaY = target.position.y - playerPosition.y
    const distance = Math.hypot(deltaX, deltaY)
    if (!(distance > NATIVE_HAGATHA_SEEKER_PROGRAM.distanceCutoff)) continue
    const directionX = deltaX / distance
    const directionY = deltaY / distance
    const cappedDistance = Math.min(distance, NATIVE_HAGATHA_SEEKER_PROGRAM.distanceCap)
    const phaseDegrees = Math.fround(
      NATIVE_HAGATHA_SEEKER_PROGRAM.tickPhaseDegrees * tick
      + NATIVE_HAGATHA_SEEKER_PROGRAM.idPhaseDegrees * target.id,
    )
    const phaseRadians = Math.fround(
      phaseDegrees * Math.fround(Math.PI) / 180,
    )
    const alpha = Math.fround(
      NATIVE_HAGATHA_SEEKER_PROGRAM.pulseBase
      + NATIVE_HAGATHA_SEEKER_PROGRAM.pulseAmplitude
      * Math.fround(Math.sin(phaseRadians)),
    )
    const point = (distanceAlong: number): Vector2 => ({
      x: Math.fround(playerPosition.x + directionX * distanceAlong),
      y: Math.fround(playerPosition.y + directionY * distanceAlong),
    })
    segments.push(
      Object.freeze({
        alpha,
        end: point(NATIVE_HAGATHA_SEEKER_PROGRAM.joinRadius),
        endVisible: true,
        start: point(NATIVE_HAGATHA_SEEKER_PROGRAM.innerRadius),
        startVisible: false,
        targetId: target.id,
        targetKind: target.kind,
        width: NATIVE_HAGATHA_SEEKER_PROGRAM.width,
      }),
      Object.freeze({
        alpha,
        end: point(cappedDistance * NATIVE_HAGATHA_SEEKER_PROGRAM.endDistanceFactor),
        endVisible: false,
        start: point(NATIVE_HAGATHA_SEEKER_PROGRAM.joinRadius),
        startVisible: true,
        targetId: target.id,
        targetKind: target.kind,
        width: NATIVE_HAGATHA_SEEKER_PROGRAM.width,
      }),
    )
  }
  return Object.freeze(segments)
}

export function nativeHagathaSeekerMeshPlan(
  segment: NativeHagathaSeekerSegment,
): NativeHagathaSeekerMeshPlan {
  const deltaX = segment.end.x - segment.start.x
  const deltaY = segment.end.y - segment.start.y
  const length = Math.hypot(deltaX, deltaY)
  if (!(length > 0) || !Number.isFinite(segment.width) || segment.width <= 0) {
    throw new RangeError('Seeker mesh segment must have distinct endpoints and positive width')
  }
  const halfWidth = segment.width * 0.5
  const perpendicularX = -deltaY / length * halfWidth
  const perpendicularY = deltaX / length * halfWidth
  const vertex = (value: number): number => Math.fround(value)
  const startU = segment.startVisible
    ? NATIVE_HAGATHA_SEEKER_RAMP_U.visible
    : NATIVE_HAGATHA_SEEKER_RAMP_U.transparent
  const endU = segment.endVisible
    ? NATIVE_HAGATHA_SEEKER_RAMP_U.visible
    : NATIVE_HAGATHA_SEEKER_RAMP_U.transparent
  const alphaByte = Math.trunc(Math.min(1, Math.max(0, segment.alpha)) * 0xff)
  return Object.freeze({
    alpha: alphaByte / 0xff,
    alphaByte,
    uvs: Object.freeze([
      startU, 0.5,
      startU, 0.5,
      endU, 0.5,
      endU, 0.5,
    ]),
    vertices: Object.freeze([
      vertex(segment.start.x - perpendicularX),
      vertex(segment.start.y - perpendicularY),
      vertex(segment.start.x + perpendicularX),
      vertex(segment.start.y + perpendicularY),
      vertex(segment.end.x - perpendicularX),
      vertex(segment.end.y - perpendicularY),
      vertex(segment.end.x + perpendicularX),
      vertex(segment.end.y + perpendicularY),
    ]),
  })
}
