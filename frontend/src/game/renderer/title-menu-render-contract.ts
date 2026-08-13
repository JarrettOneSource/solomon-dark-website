export const TITLE_RENDER_WIDTH = 1600
export const TITLE_RENDER_HEIGHT = 900
export const TITLE_HORIZON_Y = 522
export const TITLE_CLOUD_HEIGHT = 553
export const TITLE_CLOUD_WIDTH = (512 * TITLE_CLOUD_HEIGHT) / 218
export const TITLE_DETAIL_PHASE = 0.384
export const TITLE_SHADOW_PHASE = 0.075
export const TITLE_HORIZON_OFFSET = 356
export const TITLE_GRASS_OFFSET = 385

export interface TitleGraveRowDefinition {
  baseline: number
  gray: number
  scale: number
  speedPerTick: number
}

export interface TitleGrave {
  imageIndex: number
  rotation: number
  x: number
}

export interface TitleGraveRowState extends TitleGraveRowDefinition {
  graves: TitleGrave[]
  nextImageIndex: number
}

interface NativeRandom {
  integer(maxExclusive: number): number
  signedFloat(maximum: number): number
}

// MainMenu_Init and MainMenu_Tick pass these exact values to 0x00598470.
export const TITLE_GRAVE_ROWS: readonly TitleGraveRowDefinition[] = [
  {
    baseline: TITLE_RENDER_HEIGHT - 348,
    gray: 0,
    scale: 0.3,
    speedPerTick: 0.1 * 0.5,
  },
  {
    baseline: TITLE_RENDER_HEIGHT - 188,
    gray: 0.5,
    scale: 0.7,
    speedPerTick: 0.2 * 0.5,
  },
  {
    baseline: TITLE_RENDER_HEIGHT,
    gray: 1,
    scale: 1.1,
    speedPerTick: 0.4 * 0.5,
  },
]

// Title.bundle records 16..24. The native sprite renderer rotates around the
// logical registration point rather than the visible crop center.
export const TITLE_GRAVE_REGISTRATION: ReadonlyArray<readonly [number, number]> = [
  [0, -173.5], [0, -76.5], [0.5, -89.5], [0.5, -92], [0.5, -89.5],
  [0, -116], [0.5, -118], [0, -89], [0, -47.5],
]

export function createTitleGraveRows(
  imageWidths: readonly number[],
  seed = 0x5d1f2a93,
): { random: NativeRandom; rows: TitleGraveRowState[] } {
  const random = makeNativeRandom(seed)
  const rows = TITLE_GRAVE_ROWS.map<TitleGraveRowState>((definition) => {
    const row = {
      ...definition,
      graves: [],
      nextImageIndex: random.integer(3),
    }
    while (!stepTitleGraveRow(imageWidths, row, random, true)) {
      // Stock fills and advances until the oldest seed grave crosses -200.
    }
    return row
  })
  return { random, rows }
}

export function stepTitleGraveRow(
  imageWidths: readonly number[],
  row: TitleGraveRowState,
  random: NativeRandom,
  seedPass = false,
): boolean {
  const seedAdvance = seedPass ? Math.min(row.speedPerTick * 250, 25) : 0
  const advance = row.speedPerTick + seedAdvance
  for (const grave of row.graves) grave.x -= advance
  const removed = row.graves.some((grave) => grave.x < -200)
  row.graves = row.graves.filter((grave) => grave.x >= -200)

  if (shouldSpawnGrave(imageWidths, row)) {
    const imageIndex = row.nextImageIndex
    row.graves.push({
      imageIndex,
      rotation: random.signedFloat(10),
      x: TITLE_RENDER_WIDTH + 100 + 50 * row.scale * row.scale,
    })
    row.nextImageIndex = random.integer(10) === 1
      ? random.integer(imageWidths.length)
      : (imageIndex + 1) % imageWidths.length
  }
  return removed
}

export function titleBackdropOffsetsAt(elapsedSeconds: number) {
  const elapsed = Math.max(0, elapsedSeconds)
  const detailPhase = (TITLE_DETAIL_PHASE + elapsed / (200 / 3)) % 1
  const shadowPhase = (TITLE_SHADOW_PHASE + elapsed / (400 / 9)) % 1
  return {
    cloudDetail: (1 - detailPhase) * TITLE_CLOUD_WIDTH,
    cloudShadow: (1 - shadowPhase) * TITLE_CLOUD_WIDTH,
    grass: TITLE_GRASS_OFFSET + elapsed * 21,
    horizon: TITLE_HORIZON_OFFSET + elapsed * 3,
  }
}

export function tileStart(offset: number, width: number): number {
  const wrapped = ((offset % width) + width) % width
  return wrapped === 0 ? 0 : -wrapped
}

// FUN_00401120/FUN_00401170: the stock 30-bit, 55-value additive generator.
function makeNativeRandom(seed: number): NativeRandom {
  const values = new Uint32Array(55)
  values[0] = seed & 0x3fffffff
  values[1] = 1
  for (let index = 2; index < values.length; index += 1) {
    values[index] = (values[index - 2] + values[index - 1]) & 0x3fffffff
  }

  let firstIndex = 0
  let secondIndex = 31
  const next = () => {
    const value = (values[firstIndex] + values[secondIndex]) & 0x3fffffff
    values[firstIndex] = value
    firstIndex = (firstIndex + 1) % values.length
    secondIndex = (secondIndex + 1) % values.length
    return value
  }
  const integer = (maxExclusive: number) => {
    let powerOfTwo = 2
    while (powerOfTwo < maxExclusive) powerOfTwo *= 2
    return ((next() >>> 6) & (powerOfTwo - 1)) % maxExclusive
  }
  return {
    integer,
    signedFloat(maximum) {
      const magnitude = (integer(100001) / 100000) * maximum
      return integer(2) === 1 ? -magnitude : magnitude
    },
  }
}

function shouldSpawnGrave(
  imageWidths: readonly number[],
  row: TitleGraveRowState,
): boolean {
  const last = row.graves.at(-1)
  if (!last) return true
  const nextWidth = imageWidths[row.nextImageIndex]
  const lastWidth = imageWidths[last.imageIndex]
  return last.x + (nextWidth + lastWidth) * 0.5 * row.scale < TITLE_RENDER_WIDTH + 100
}
