import { Rectangle, Texture } from 'pixi.js'

export type NativeSpriteRecordSourceUv = readonly [
  left: number,
  top: number,
  right: number,
  bottom: number,
]

interface NativeSpriteRecordTextureOptions {
  readonly frame: Rectangle
  readonly orig?: Rectangle
  readonly source: Texture['source']
  readonly sourceUv?: NativeSpriteRecordSourceUv
  readonly trim?: Rectangle
}

interface NativeSpriteRecordUvs {
  readonly x0: number
  readonly x1: number
  readonly x2: number
  readonly x3: number
  readonly y0: number
  readonly y1: number
  readonly y2: number
  readonly y3: number
}

const FULL_RECORD_UV = [0, 0, 1, 1] as const

export function nativeSpriteRecordTexture({
  frame,
  orig,
  source,
  sourceUv = FULL_RECORD_UV,
  trim,
}: NativeSpriteRecordTextureOptions): Texture {
  assertSourceUv(sourceUv)
  const recordFrame = frame.clone()
  const [left, top, right, bottom] = sourceUv
  const texture = new Texture({
    dynamic: true,
    frame: new Rectangle(
      recordFrame.x + recordFrame.width * left,
      recordFrame.y + recordFrame.height * top,
      recordFrame.width * (right - left),
      recordFrame.height * (bottom - top),
    ),
    orig,
    source,
    trim,
  })
  const applyNativeUvs = (): void => {
    Object.assign(texture.uvs, nativeSpriteRecordUvs(
      recordFrame,
      { height: source.height, width: source.width },
      sourceUv,
    ))
  }
  texture.on('update', applyNativeUvs)
  applyNativeUvs()
  return texture
}

export function nativeSpriteRecordUvs(
  frame: Readonly<{ height: number; width: number; x: number; y: number }>,
  page: Readonly<{ height: number; width: number }>,
  sourceUv: NativeSpriteRecordSourceUv = FULL_RECORD_UV,
): NativeSpriteRecordUvs {
  assertFinitePositive(page.width, 'native sprite page width')
  assertFinitePositive(page.height, 'native sprite page height')
  assertFinitePositive(frame.width, 'native sprite record width')
  assertFinitePositive(frame.height, 'native sprite record height')
  if (!Number.isFinite(frame.x) || !Number.isFinite(frame.y)) {
    throw new RangeError('native sprite record origin must be finite')
  }
  assertSourceUv(sourceUv)
  const [left, top, right, bottom] = sourceUv
  const recordLeft = (frame.x + 0.5) / page.width
  const recordTop = (frame.y + 0.5) / page.height
  const recordRight = (frame.x + frame.width + 0.25) / page.width
  const recordBottom = (frame.y + frame.height + 0.25) / page.height
  const x0 = mix(recordLeft, recordRight, left)
  const x1 = mix(recordLeft, recordRight, right)
  const y0 = mix(recordTop, recordBottom, top)
  const y1 = mix(recordTop, recordBottom, bottom)
  return {
    x0,
    x1,
    x2: x1,
    x3: x0,
    y0,
    y1: y0,
    y2: y1,
    y3: y1,
  }
}

function assertSourceUv(sourceUv: NativeSpriteRecordSourceUv): void {
  const [left, top, right, bottom] = sourceUv
  if (
    !sourceUv.every(Number.isFinite)
    || left < 0
    || top < 0
    || right > 1
    || bottom > 1
    || right <= left
    || bottom <= top
  ) throw new RangeError('native sprite record UV must be an ordered unit rectangle')
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive`)
}

function mix(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}
