import type { AuthoredBoneyardEnemyRecipe } from './boneyard-enemy-config.ts'
import type { BoneyardPoint } from './boneyard.ts'
import type { BoneyardSpawnPositionPolicy } from './boneyard-wave-timeline.ts'

export type NativePortalFrequency = 0 | 1 | 2 | 3 | 4 | 5

export interface NativePortalFrequencyPreset {
  readonly label: string
  readonly lowerTicks: number
  readonly upperTicks: number
}

export interface NativePortalPhaseDefinition {
  readonly frequency: NativePortalFrequency
  readonly maximumHealth: number
  readonly name: string
  readonly recipeUid: number
  readonly placementPolicy: BoneyardSpawnPositionPolicy
  readonly scriptUid: number
  readonly spawnCount: number
  readonly startWave: number
  readonly triggerUid: number
}

export interface NativePortalProgramDefinition {
  readonly timelineUid: number | null
  readonly phases: readonly NativePortalPhaseDefinition[]
}

export interface NativePortalState {
  readonly ageTicks: number
  readonly alpha: number
  readonly auraPhase: number
  readonly bodyPhase: number
  readonly fixedScale: number
  readonly ticksUntilEjection: number
}

export interface NativePortalEjection {
  readonly childHeadingDeg: number
  readonly verticalVelocity: number
}

export interface NativePortalStepResult {
  readonly ejection: NativePortalEjection | null
  readonly opened: boolean
  readonly state: NativePortalState
}

export const NATIVE_PORTAL_ACTOR_PROGRAM = Object.freeze({
  activeCollisionRadius: 5,
  alphaPerTick: 0.025,
  auraFirstEntry: 180,
  auraFrameCount: 20,
  auraMinimumVelocity: 0.05,
  auraVelocityRange: 0.2,
  bodyFirstEntry: 46,
  bodyFrameCount: 32,
  bodyMinimumVelocity: 0.15,
  bodyVelocityRange: 0.15,
  childBaseHorizontalSpeed: 4.5,
  childForwardDistanceBase: 5,
  childInitialHorizontalSpeed: 6.75,
  childRadialDistance: 30,
  childVerticalOffset: -0.1,
  childVerticalVelocityMinimum: 10,
  childVerticalVelocityRange: 5,
  fixedScaleMinimum: 1.25,
  fixedScaleRange: 0.5,
  initialCountdownBaseTicks: 450,
  materializationTicks: 10,
  placementCollisionRadius: 45,
})

export const NATIVE_PORTAL_FREQUENCY_PRESETS: readonly NativePortalFrequencyPreset[] =
  Object.freeze([
    Object.freeze({ label: 'VERY LOW', lowerTicks: 800, upperTicks: 1_000 }),
    Object.freeze({ label: 'LOW', lowerTicks: 600, upperTicks: 800 }),
    Object.freeze({ label: 'NORMAL', lowerTicks: 300, upperTicks: 400 }),
    Object.freeze({ label: 'HIGH', lowerTicks: 200, upperTicks: 300 }),
    Object.freeze({ label: 'VERY HIGH', lowerTicks: 100, upperTicks: 200 }),
    Object.freeze({ label: 'YOU WILL DIE', lowerTicks: 25, upperTicks: 50 }),
  ])

export const NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256: Readonly<
  Record<string, NativePortalProgramDefinition>
> = Object.freeze({
  '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f': Object.freeze({
    timelineUid: null,
    phases: Object.freeze([
      phase(2, 1549.240478515625, 'Deep Portal 2', 36_822, 'dark', 36_824, 6, 42, 36_825),
      phase(2, 1780.095947265625, 'Deep Portal 3', 36_826, 'dark', 36_828, 8, 51, 36_829),
      phase(3, 2162.73486328125, 'Deep Portal 4', 36_830, 'dark', 36_832, 7, 62, 36_833),
      phase(3, 2541.89404296875, 'Deep Portal 5', 36_834, 'dark', 36_836, 10, 67, 36_837),
      phase(4, 3683.826904296875, 'Deep Portal 6', 36_838, 'dark', 36_840, 10, 77, 36_841),
      phase(4, 4138.1962890625, 'Deep Portal 7', 36_842, 'dark', 36_844, 10, 81, 36_845),
    ]),
  }),
  '9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9': Object.freeze({
    timelineUid: 36_773,
    phases: Object.freeze([
      phase(3, 426.1180114746094, 'Deep Portal', 36_814, 'light', 36_816, 3, 24, 36_817),
      phase(2, 1225.6409912109375, 'Deep Portal 2', 36_829, 'dark', 36_831, 6, 41, 36_832),
      phase(2, 2178.35205078125, 'Deep Portal 3', 36_833, 'dark', 36_835, 5, 50, 36_836),
      phase(3, 2609.382568359375, 'Deep Portal 4', 36_837, 'dark', 36_839, 8, 57, 36_840),
      phase(3, 2445.91796875, 'Deep Portal 5', 36_841, 'dark', 36_843, 7, 66, 36_844),
      phase(4, 3787.1787109375, 'Deep Portal 6', 36_845, 'dark', 36_847, 9, 75, 36_848),
      phase(4, 4295.083984375, 'Deep Portal 7', 36_849, 'dark', 36_851, 12, 81, 36_852),
    ]),
  }),
  'bd3c38468481b7337b1e7382e5503cc214356906571763a68188b23e821e73fb': Object.freeze({
    timelineUid: 34_414,
    phases: Object.freeze([
      phase(3, 463.1650085449219, 'Deep Portal', 35_010, 'light', 35_012, 3, 22, 35_013),
      phase(2, 1311.77099609375, 'Deep Portal 2', 35_027, 'dark', 35_029, 4, 50, 35_030),
      phase(2, 1878.112060546875, 'Deep Portal 3', 35_031, 'dark', 35_033, 5, 59, 35_034),
      phase(3, 2192.487548828125, 'Deep Portal 4', 35_035, 'dark', 35_037, 8, 64, 35_038),
      phase(3, 2684.22900390625, 'Deep Portal 5', 35_039, 'dark', 35_041, 8, 70, 35_042),
      phase(4, 2987.844970703125, 'Deep Portal 6', 35_043, 'dark', 35_045, 8, 78, 35_046),
      phase(4, 4373.61181640625, 'Deep Portal 7', 35_047, 'dark', 35_049, 10, 86, 35_050),
    ]),
  }),
  '8c2f97d2ed54431987e3cb54b7ae3c1098bf1c4517f59ade6aea57759187adb0': Object.freeze({
    timelineUid: null,
    phases: Object.freeze([
      phase(2, 1227.72900390625, 'Deep Portal 2', 37_334, 'dark', 37_336, 5, 46, 37_337),
      phase(2, 1682.0860595703125, 'Deep Portal 3', 37_338, 'dark', 37_340, 7, 51, 37_341),
      phase(3, 2526.32763671875, 'Deep Portal 4', 37_342, 'dark', 37_344, 8, 62, 37_345),
      phase(3, 2666.993896484375, 'Deep Portal 5', 37_346, 'dark', 37_348, 8, 69, 37_349),
      phase(4, 3671.751953125, 'Deep Portal 6', 37_350, 'dark', 37_352, 9, 75, 37_353),
      phase(4, 3463.2080078125, 'Deep Portal 7', 37_354, 'dark', 37_356, 10, 89, 37_357),
    ]),
  }),
  'bec9377cf539bb193e8af6ad72fa78a5e47e44206a1fef4d6bf3bfbda3f04a08': Object.freeze({
    timelineUid: 36_789,
    phases: Object.freeze([
      phase(3, 413.33050537109375, 'Deep Portal', 36_828, 'light', 36_830, 3, 23, 36_831),
      phase(2, 1350.592529296875, 'Deep Portal 2', 36_845, 'dark', 36_847, 4, 40, 36_848),
      phase(2, 1762.6719970703125, 'Deep Portal 3', 36_849, 'dark', 36_851, 8, 54, 36_852),
      phase(3, 2617.7451171875, 'Deep Portal 4', 36_853, 'dark', 36_855, 7, 57, 36_856),
      phase(3, 2493.5458984375, 'Deep Portal 5', 36_857, 'dark', 36_859, 10, 64, 36_860),
      phase(4, 2828.01416015625, 'Deep Portal 6', 36_861, 'dark', 36_863, 8, 72, 36_864),
      phase(4, 3674.659912109375, 'Deep Portal 7', 36_865, 'dark', 36_867, 12, 84, 36_868),
    ]),
  }),
  'ec2b27a1415c944c233158da8c21324760cd896e1228143aa18d262f65fa2a45': Object.freeze({
    timelineUid: 36_747,
    phases: Object.freeze([
      phase(3, 537.2244873046875, 'Deep Portal', 37_383, 'light', 37_385, 3, 24, 37_386),
      phase(2, 1587.814453125, 'Deep Portal 2', 37_400, 'dark', 37_402, 4, 42, 37_403),
      phase(2, 1763.001953125, 'Deep Portal 3', 37_404, 'dark', 37_406, 5, 49, 37_407),
      phase(3, 2138.794921875, 'Deep Portal 4', 37_408, 'dark', 37_410, 9, 59, 37_411),
      phase(3, 2985.48583984375, 'Deep Portal 5', 37_412, 'dark', 37_414, 9, 65, 37_415),
      phase(4, 2804.6201171875, 'Deep Portal 6', 37_416, 'dark', 37_418, 8, 74, 37_419),
      phase(4, 3506.22802734375, 'Deep Portal 7', 37_420, 'dark', 37_422, 9, 86, 37_423),
    ]),
  }),
  '624b79ae325daa714b24017e0a308c64519f7481eb206e4489968217b1a2e123': Object.freeze({
    timelineUid: null,
    phases: Object.freeze([
      phase(2, 1389.2880859375, 'Deep Portal 2', 37_403, 'dark', 37_405, 6, 46, 37_406),
      phase(2, 2136.783935546875, 'Deep Portal 3', 37_407, 'dark', 37_409, 6, 54, 37_410),
      phase(3, 2122.842529296875, 'Deep Portal 4', 37_411, 'dark', 37_413, 8, 64, 37_414),
      phase(3, 2718.968994140625, 'Deep Portal 5', 37_415, 'dark', 37_417, 10, 69, 37_418),
      phase(4, 3305.302001953125, 'Deep Portal 6', 37_419, 'dark', 37_421, 8, 80, 37_422),
      phase(4, 3706.0400390625, 'Deep Portal 7', 37_423, 'dark', 37_425, 11, 83, 37_426),
    ]),
  }),
  'e62e5e847562d822382fba14709d5367c9cd7de40f8b4fa52ecea3bfc8d9a430': Object.freeze({
    timelineUid: 36_767,
    phases: Object.freeze([
      phase(3, 479.36651611328125, 'Deep Portal', 37_383, 'light', 37_385, 3, 28, 37_386),
      phase(2, 1616.159912109375, 'Deep Portal 2', 37_400, 'dark', 37_402, 7, 46, 37_403),
      phase(2, 1931.949951171875, 'Deep Portal 3', 37_404, 'dark', 37_406, 6, 53, 37_407),
      phase(3, 2568.7177734375, 'Deep Portal 4', 37_408, 'dark', 37_410, 6, 61, 37_411),
      phase(3, 2558.56201171875, 'Deep Portal 5', 37_412, 'dark', 37_414, 7, 72, 37_415),
      phase(4, 3788.553955078125, 'Deep Portal 6', 37_416, 'dark', 37_418, 10, 76, 37_419),
      phase(4, 3404.8759765625, 'Deep Portal 7', 37_420, 'dark', 37_422, 11, 84, 37_423),
    ]),
  }),
  '506200e6f89dd26150c7fcc76f5cddfdb321412657ac979ea5924b567b4a2933': Object.freeze({
    timelineUid: 36_802,
    phases: Object.freeze([
      phase(3, 486.99700927734375, 'Deep Portal', 37_471, 'light', 37_473, 3, 26, 37_474),
      phase(2, 1385.845458984375, 'Deep Portal 2', 37_488, 'dark', 37_490, 4, 51, 37_491),
      phase(2, 1981.6419677734375, 'Deep Portal 3', 37_492, 'dark', 37_494, 5, 59, 37_495),
      phase(3, 2191.392578125, 'Deep Portal 4', 37_496, 'dark', 37_498, 9, 61, 37_499),
      phase(3, 2476.01416015625, 'Deep Portal 5', 37_500, 'dark', 37_502, 7, 73, 37_503),
      phase(4, 3016.08984375, 'Deep Portal 6', 37_504, 'dark', 37_506, 8, 83, 37_507),
      phase(4, 3432.89599609375, 'Deep Portal 7', 37_508, 'dark', 37_510, 10, 86, 37_511),
    ]),
  }),
  'cd4d1ba948ca6624fffb967b02b7c93a6d00cbf9b5ec2c4541330b0616a1c239': Object.freeze({
    timelineUid: 36_758,
    phases: Object.freeze([
      phase(3, 435.13751220703125, 'Deep Portal', 37_361, 'light', 37_363, 3, 27, 37_364),
      phase(2, 1280.3115234375, 'Deep Portal 2', 37_376, 'dark', 37_378, 7, 48, 37_379),
      phase(2, 2027.8480224609375, 'Deep Portal 3', 37_380, 'dark', 37_382, 8, 53, 37_383),
      phase(3, 2179.37744140625, 'Deep Portal 4', 37_384, 'dark', 37_386, 8, 59, 37_387),
      phase(3, 2452.884033203125, 'Deep Portal 5', 37_388, 'dark', 37_390, 7, 71, 37_391),
      phase(4, 2939.009521484375, 'Deep Portal 6', 37_392, 'dark', 37_394, 10, 79, 37_395),
      phase(4, 3288.488037109375, 'Deep Portal 7', 37_396, 'dark', 37_398, 9, 85, 37_399),
    ]),
  }),
  'efa240ce741df0f781228206d024bb1903c7210d1163eccf80c87e835365422f': Object.freeze({
    timelineUid: null,
    phases: Object.freeze([
      phase(2, 1262.613037109375, 'Deep Portal 2', 37_348, 'dark', 37_350, 4, 48, 37_351),
      phase(2, 1615.06005859375, 'Deep Portal 3', 37_352, 'dark', 37_354, 8, 51, 37_355),
      phase(3, 2418.8974609375, 'Deep Portal 4', 37_356, 'dark', 37_358, 8, 63, 37_359),
      phase(3, 2609.9970703125, 'Deep Portal 5', 37_360, 'dark', 37_362, 8, 73, 37_363),
      phase(4, 2990.732421875, 'Deep Portal 6', 37_364, 'dark', 37_366, 11, 80, 37_367),
      phase(4, 3719.66015625, 'Deep Portal 7', 37_368, 'dark', 37_370, 9, 83, 37_371),
    ]),
  }),
  '1be4c308ccd442d70060cc66e3daa7b073faf035fd92d6b49fad4c33a91ef0c1': Object.freeze({
    timelineUid: 36_799,
    phases: Object.freeze([
      phase(3, 485.85400390625, 'Deep Portal', 37_397, 'light', 37_399, 3, 22, 37_400),
      phase(2, 1274.29052734375, 'Deep Portal 2', 37_416, 'dark', 37_418, 6, 42, 37_419),
      phase(2, 2190.748046875, 'Deep Portal 3', 37_420, 'dark', 37_422, 5, 54, 37_423),
      phase(3, 2196.22998046875, 'Deep Portal 4', 37_424, 'dark', 37_426, 6, 58, 37_427),
      phase(3, 2403.8251953125, 'Deep Portal 5', 37_428, 'dark', 37_430, 7, 67, 37_431),
      phase(4, 3013.3916015625, 'Deep Portal 6', 37_432, 'dark', 37_434, 8, 77, 37_435),
      phase(4, 3959.39599609375, 'Deep Portal 7', 37_436, 'dark', 37_438, 11, 88, 37_439),
    ]),
  }),
})

export function nativePortalProgram(sourceSha256: string): NativePortalProgramDefinition {
  const program = NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256[sourceSha256]
  if (!program) {
    throw new Error(`default Boneyard ${sourceSha256} has no extracted Deep Portal program`)
  }
  return program
}

export function nativePortalRecipe(
  source: NativePortalPhaseDefinition,
): AuthoredBoneyardEnemyRecipe {
  return Object.freeze({
    archerAccuracyMode: 0,
    attackSpeed: 1,
    chaseSpeed: 1,
    classification: 'multiple-boss',
    experience: source.maximumHealth * 2,
    extraDamage: 0,
    family: Object.freeze({ frequency: source.frequency, kind: 'portal' as const }),
    lootPolicies: Object.freeze({
      gold: 4,
      item: 4,
      orb: 4,
      potion: 0,
      powerup: 4,
      specificItem: 4,
    }),
    maximumHealth: source.maximumHealth,
    movementScale: 1,
    name: source.name,
    onDeathProgram: null,
    primaryDamage: 2,
    secondaryDamage: 0,
    tertiaryDamage: 0,
    uid: source.recipeUid,
  })
}

export function createNativePortalState(
  frequency: NativePortalFrequency,
  random: () => number,
): NativePortalState {
  const preset = nativePortalFrequencyPreset(frequency)
  return Object.freeze({
    ageTicks: 0,
    alpha: 0,
    auraPhase: 0,
    bodyPhase: 0,
    fixedScale: Math.fround(
      NATIVE_PORTAL_ACTOR_PROGRAM.fixedScaleMinimum
      + unit(random()) * NATIVE_PORTAL_ACTOR_PROGRAM.fixedScaleRange,
    ),
    ticksUntilEjection: NATIVE_PORTAL_ACTOR_PROGRAM.initialCountdownBaseTicks
      + randomInteger(random, Math.floor(preset.upperTicks / 3)),
  })
}

export function stepNativePortalState(
  source: NativePortalState,
  frequency: NativePortalFrequency,
  random: () => number,
): NativePortalStepResult {
  validatePortalState(source)
  const ageTicks = source.ageTicks + 1
  if (ageTicks <= NATIVE_PORTAL_ACTOR_PROGRAM.materializationTicks) {
    return {
      ejection: null,
      opened: ageTicks === NATIVE_PORTAL_ACTOR_PROGRAM.materializationTicks,
      state: Object.freeze({ ...source, ageTicks }),
    }
  }

  const bodyPhase = Math.fround(positiveModulo(
    source.bodyPhase
      + NATIVE_PORTAL_ACTOR_PROGRAM.bodyMinimumVelocity
      + unit(random()) * NATIVE_PORTAL_ACTOR_PROGRAM.bodyVelocityRange,
    NATIVE_PORTAL_ACTOR_PROGRAM.bodyFrameCount,
  ))
  const auraPhase = Math.fround(positiveModulo(
    source.auraPhase
      + NATIVE_PORTAL_ACTOR_PROGRAM.auraMinimumVelocity
      + unit(random()) * NATIVE_PORTAL_ACTOR_PROGRAM.auraVelocityRange,
    NATIVE_PORTAL_ACTOR_PROGRAM.auraFrameCount,
  ))
  const alpha = Math.fround(Math.min(
    1,
    source.alpha + Math.fround(NATIVE_PORTAL_ACTOR_PROGRAM.alphaPerTick),
  ))
  if (source.ticksUntilEjection > 1) {
    return {
      ejection: null,
      opened: false,
      state: Object.freeze({
        ...source,
        ageTicks,
        alpha,
        auraPhase,
        bodyPhase,
        ticksUntilEjection: source.ticksUntilEjection - 1,
      }),
    }
  }

  const childHeadingDeg = unit(random()) * 360
  const verticalVelocity = Math.fround(-(
    NATIVE_PORTAL_ACTOR_PROGRAM.childVerticalVelocityMinimum
    + unit(random()) * NATIVE_PORTAL_ACTOR_PROGRAM.childVerticalVelocityRange
  ))
  return {
    ejection: Object.freeze({ childHeadingDeg, verticalVelocity }),
    opened: false,
    state: Object.freeze({
      ...source,
      ageTicks,
      alpha,
      auraPhase,
      bodyPhase,
      ticksUntilEjection: nextPortalEjectionCountdown(frequency, random),
    }),
  }
}

export function nativePortalChildPosition(
  portalPosition: Readonly<BoneyardPoint>,
  portalHeadingDeg: number,
  childHeadingDeg: number,
  childRadius: number,
): Readonly<BoneyardPoint> {
  if (!Number.isFinite(childRadius) || childRadius <= 0) {
    throw new RangeError('Portal child radius must be finite and positive')
  }
  const radial = headingVector(childHeadingDeg)
  const forward = headingVector(portalHeadingDeg)
  const forwardDistance = NATIVE_PORTAL_ACTOR_PROGRAM.childForwardDistanceBase + childRadius
  return Object.freeze({
    x: Math.fround(
      portalPosition.x
      + radial.x * NATIVE_PORTAL_ACTOR_PROGRAM.childRadialDistance
      + forward.x * forwardDistance,
    ),
    y: Math.fround(
      portalPosition.y
      + radial.y * NATIVE_PORTAL_ACTOR_PROGRAM.childRadialDistance
      + forward.y * forwardDistance,
    ),
  })
}

export function nativePortalCollisionRadius(state: NativePortalState): number {
  return state.ageTicks < NATIVE_PORTAL_ACTOR_PROGRAM.materializationTicks
    ? NATIVE_PORTAL_ACTOR_PROGRAM.placementCollisionRadius
    : NATIVE_PORTAL_ACTOR_PROGRAM.activeCollisionRadius
}

function nativePortalFrequencyPreset(
  frequency: NativePortalFrequency,
): NativePortalFrequencyPreset {
  const preset = NATIVE_PORTAL_FREQUENCY_PRESETS[frequency]
  if (!preset) throw new RangeError('Portal frequency must be within 0..5')
  return preset
}

function nextPortalEjectionCountdown(
  frequency: NativePortalFrequency,
  random: () => number,
): number {
  const preset = nativePortalFrequencyPreset(frequency)
  const regular = preset.lowerTicks
    + randomInteger(random, preset.upperTicks - preset.lowerTicks + 1)
  return randomInteger(random, 8) === 1
    ? randomInteger(random, preset.upperTicks)
    : regular
}

function headingVector(headingDeg: number): Readonly<BoneyardPoint> {
  if (!Number.isFinite(headingDeg)) throw new RangeError('Portal heading must be finite')
  const radians = headingDeg * Math.PI / 180
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

function randomInteger(random: () => number, count: number): number {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('Portal random integer count must be a positive safe integer')
  }
  return Math.min(count - 1, Math.floor(unit(random()) * count))
}

function unit(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('Portal random unit must be within 0..1')
  }
  return value
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function validatePortalState(source: NativePortalState): void {
  if (!Number.isSafeInteger(source.ageTicks) || source.ageTicks < 0) {
    throw new RangeError('Portal age must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(source.ticksUntilEjection) || source.ticksUntilEjection < 0) {
    throw new RangeError('Portal countdown must be a non-negative safe integer')
  }
}

function phase(
  frequency: NativePortalFrequency,
  maximumHealth: number,
  name: string,
  recipeUid: number,
  placementPolicy: BoneyardSpawnPositionPolicy,
  scriptUid: number,
  spawnCount: number,
  startWave: number,
  triggerUid: number,
): NativePortalPhaseDefinition {
  return Object.freeze({
    frequency,
    maximumHealth,
    name,
    recipeUid,
    placementPolicy,
    scriptUid,
    spawnCount,
    startWave,
    triggerUid,
  })
}
