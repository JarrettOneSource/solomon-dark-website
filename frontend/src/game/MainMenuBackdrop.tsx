import { useEffect, useRef } from 'react'
import { mainMenu } from '../lib/assets'
import { loadGameImage } from './game-assets'

const WIDTH = 1600
const HEIGHT = 900
const HORIZON_Y = 522
const CLOUD_HEIGHT = 553
const CLOUD_WIDTH = (512 * CLOUD_HEIGHT) / 218
const DETAIL_PHASE = 0.384
const SHADOW_PHASE = 0.075
const HORIZON_OFFSET = 356
const GRASS_OFFSET = 385

interface Layers {
  cloudBase: HTMLImageElement
  cloudDetail: HTMLImageElement
  cloudShadow: HTMLImageElement
  grass: HTMLImageElement
  graves: HTMLImageElement[]
  horizon: HTMLImageElement
  moon: HTMLImageElement
}

interface GraveRow {
  baseline: number
  gray: number
  scale: number
  speedPerTick: number
}

interface Grave {
  imageIndex: number
  rotation: number
  x: number
}

interface GraveRowState extends GraveRow {
  graves: Grave[]
  nextImageIndex: number
}

interface NativeRandom {
  integer(maxExclusive: number): number
  signedFloat(maximum: number): number
}

// MainMenu_Init and MainMenu_Tick pass these exact values to 0x00598470.
const GRAVE_ROWS: readonly GraveRow[] = [
  {
    baseline: HEIGHT - 348,
    gray: 0,
    scale: 0.3,
    speedPerTick: 0.1 * 0.5,
  },
  {
    baseline: HEIGHT - 188,
    gray: 0.5,
    scale: 0.7,
    speedPerTick: 0.2 * 0.5,
  },
  {
    baseline: HEIGHT,
    gray: 1,
    scale: 1.1,
    speedPerTick: 0.4 * 0.5,
  },
]

// Title.bundle records 16..24. The native sprite renderer rotates around the
// logical registration point, not the visible crop center.
const GRAVE_REGISTRATION: ReadonlyArray<readonly [number, number]> = [
  [0, -173.5], [0, -76.5], [0.5, -89.5], [0.5, -92], [0.5, -89.5],
  [0, -116], [0.5, -118], [0, -89], [0, -47.5],
]

function tile(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  offset: number,
  y: number,
  width: number,
  height: number,
) {
  let x = -(((offset % width) + width) % width)
  while (x > 0) x -= width
  for (; x < WIDTH; x += width) ctx.drawImage(image, x, y, width, height)
}

// FUN_00401120/FUN_00401170: the stock 30-bit, 55-value additive generator.
function makeNativeRandom(seed = 0x5d1f2a93): NativeRandom {
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
    signedFloat(maximum: number) {
      const magnitude = (integer(100001) / 100000) * maximum
      return integer(2) === 1 ? -magnitude : magnitude
    },
  }
}

function shouldSpawnGrave(
  images: HTMLImageElement[],
  row: GraveRowState,
) {
  const last = row.graves.at(-1)
  if (!last) return true
  const nextWidth = images[row.nextImageIndex].naturalWidth
  const lastWidth = images[last.imageIndex].naturalWidth
  return last.x + (nextWidth + lastWidth) * 0.5 * row.scale < WIDTH + 100
}

function stepGraveRow(
  images: HTMLImageElement[],
  row: GraveRowState,
  random: NativeRandom,
  seedPass: boolean,
) {
  const seedAdvance = seedPass ? Math.min(row.speedPerTick * 250, 25) : 0
  const advance = row.speedPerTick + seedAdvance
  for (const grave of row.graves) grave.x -= advance
  const removed = row.graves.some((grave) => grave.x < -200)
  row.graves = row.graves.filter((grave) => grave.x >= -200)

  if (shouldSpawnGrave(images, row)) {
    const imageIndex = row.nextImageIndex
    row.graves.push({
      imageIndex,
      rotation: random.signedFloat(10),
      x: WIDTH + 100 + 50 * row.scale * row.scale,
    })
    row.nextImageIndex = random.integer(10) === 1
      ? random.integer(images.length)
      : (imageIndex + 1) % images.length
  }
  return removed
}

function createGraveRows(images: HTMLImageElement[], random: NativeRandom) {
  return GRAVE_ROWS.map<GraveRowState>((definition) => {
    const row = {
      ...definition,
      graves: [],
      nextImageIndex: random.integer(3),
    }
    while (!stepGraveRow(images, row, random, true)) {
      // The stock initializer repeatedly advances and fills until the oldest
      // generated grave crosses its -200 removal boundary.
    }
    return row
  })
}

function drawGraves(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], row: GraveRowState) {
  ctx.filter = row.gray === 1 ? 'none' : `brightness(${row.gray * 100}%)`
  for (const grave of row.graves) {
    const image = images[grave.imageIndex]
    const [centerX, centerY] = GRAVE_REGISTRATION[grave.imageIndex]
    ctx.save()
    ctx.translate(grave.x, row.baseline)
    ctx.rotate(grave.rotation * Math.PI / 180)
    ctx.scale(row.scale, row.scale)
    ctx.drawImage(image, -image.naturalWidth / 2 + centerX, -image.naturalHeight / 2 + centerY)
    ctx.restore()
  }
  ctx.filter = 'none'
}

function drawFogGradient(ctx: CanvasRenderingContext2D, y: number, height: number, bottomAlpha: number) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + height)
  gradient.addColorStop(0, 'rgb(41 46 64 / 0)')
  gradient.addColorStop(1, `rgb(41 46 64 / ${bottomAlpha})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, y, WIDTH, height)
}

function paint(
  ctx: CanvasRenderingContext2D,
  layers: Layers,
  graveRows: GraveRowState[],
  elapsedSeconds: number,
) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  // The native backbuffer is black before MainMenu_Render builds the lower
  // blue-gray haze through its ordered translucent passes.
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Native fields +0x408 and +0x40C wrap after 66.667s and 44.444s.
  tile(ctx, layers.cloudBase, 0, 0, CLOUD_WIDTH, CLOUD_HEIGHT)
  ctx.drawImage(layers.moon, 1304, 101.5, 192, 192)
  const detailPhase = (DETAIL_PHASE + elapsedSeconds / (200 / 3)) % 1
  const shadowPhase = (SHADOW_PHASE + elapsedSeconds / (400 / 9)) % 1
  ctx.globalAlpha = 0.5
  tile(ctx, layers.cloudDetail, (1 - detailPhase) * CLOUD_WIDTH, 0, CLOUD_WIDTH, CLOUD_HEIGHT)
  ctx.globalAlpha = 0.9
  tile(ctx, layers.cloudShadow, (1 - shadowPhase) * CLOUD_WIDTH, 0, CLOUD_WIDTH, CLOUD_HEIGHT)
  ctx.globalAlpha = 1

  // The silhouette, three grave depths, and foreground grass use the exact
  // stock rates: 3, 3/6/12, and 21 pixels per second respectively.
  tile(ctx, layers.horizon, HORIZON_OFFSET + elapsedSeconds * 3, HORIZON_Y, 1024, 31)
  graveRows.forEach((row, index) => {
    drawGraves(ctx, layers.graves, row)
    // MainMenu_Render subtracts the quad's y origin from the client height.
    // The pass therefore reaches its full 0.7 opacity at the bottom edge.
    drawFogGradient(ctx, 365, HEIGHT - 365, 0.7)
    if (index === 1) {
      // The inter-row veil ends at the middle-row baseline: 500 + 212 = 712.
      // The solid fill continues from that fully opaque edge without a seam.
      drawFogGradient(ctx, 500, row.baseline - 500, 1)
      // The state-color setter truncates the solid pass to packed 8-bit RGB.
      ctx.fillStyle = 'rgb(40 45 63)'
      ctx.fillRect(0, row.baseline, WIDTH, HEIGHT - row.baseline)
    }
  })
  tile(ctx, layers.grass, GRASS_OFFSET + elapsedSeconds * 21, HEIGHT - 71, 1024, 71)
}

export default function MainMenuBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.imageSmoothingEnabled = true

    let animationFrame = 0
    let disposed = false
    let cleanupObserver = () => {}

    Promise.all([
      loadGameImage(mainMenu.cloudBase),
      loadGameImage(mainMenu.cloudDetail),
      loadGameImage(mainMenu.cloudShadow),
      loadGameImage(mainMenu.grass),
      loadGameImage(mainMenu.horizon),
      loadGameImage(mainMenu.moon),
      ...mainMenu.graves.map(loadGameImage),
    ]).then(([cloudBase, cloudDetail, cloudShadow, grass, horizon, moon, ...graves]) => {
      if (disposed) return
      const layers: Layers = { cloudBase, cloudDetail, cloudShadow, grass, graves, horizon, moon }
      const random = makeNativeRandom()
      const graveRows = createGraveRows(graves, random)
      let simulatedTicks = 0
      const render = (elapsedSeconds: number) => {
        const targetTicks = Math.floor(elapsedSeconds * 60)
        while (simulatedTicks < targetTicks) {
          for (const row of graveRows) stepGraveRow(graves, row, random, false)
          simulatedTicks += 1
        }
        paint(ctx, layers, graveRows, elapsedSeconds)
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reducedMotion) {
        render(0)
        return
      }

      let startedAt = performance.now()
      let priorElapsed = 0
      const frame = (now: number) => {
        render(priorElapsed + (now - startedAt) / 1000)
        animationFrame = requestAnimationFrame(frame)
      }
      const start = () => {
        cancelAnimationFrame(animationFrame)
        startedAt = performance.now()
        animationFrame = requestAnimationFrame(frame)
      }
      const stop = () => {
        priorElapsed += (performance.now() - startedAt) / 1000
        cancelAnimationFrame(animationFrame)
      }

      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) start()
        else stop()
      })
      observer.observe(canvas)
      cleanupObserver = () => observer.disconnect()
    })

    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
      cleanupObserver()
    }
  }, [])

  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-hidden className="main-menu-backdrop" />
}
