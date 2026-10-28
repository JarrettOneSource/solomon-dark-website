const HAIL_FRAME_MAGIC = 0x4c494148
const HAIL_FRAME_FORMAT_VERSION = 2
const HAIL_FRAME_HEADER_BYTES = 16
const FLOAT64_COLUMN_COUNT = 4
const FLOAT32_COLUMN_COUNT = 12
const UINT16_COLUMN_COUNT = 1
const UINT8_COLUMN_COUNT = 3
let emptyHailFrameBase64: string | undefined
const BYTES_PER_HAIL_ROW = (
  FLOAT64_COLUMN_COUNT * Float64Array.BYTES_PER_ELEMENT
  + FLOAT32_COLUMN_COUNT * Float32Array.BYTES_PER_ELEMENT
  + UINT16_COLUMN_COUNT * Uint16Array.BYTES_PER_ELEMENT
  + UINT8_COLUMN_COUNT * Uint8Array.BYTES_PER_ELEMENT
)

interface NodeBufferEncodedValue {
  toString(encoding: 'base64'): string
}

interface NodeBufferConstructor {
  from(
    value: ArrayBufferLike,
    byteOffset: number,
    byteLength: number,
  ): NodeBufferEncodedValue
  from(value: string, encoding: 'base64'): Uint8Array
}

interface Base64Uint8ArrayConstructor extends Uint8ArrayConstructor {
  fromBase64?: (
    value: string,
    options?: {
      alphabet?: 'base64'
      lastChunkHandling?: 'strict'
    },
  ) => Uint8Array
}

interface Base64Uint8Array extends Uint8Array {
  toBase64?: () => string
}

export class PrimarySpellWaterHailFrameError extends Error {
  override name = 'PrimarySpellWaterHailFrameError'
}

export class PrimarySpellWaterHailFrameRows {
  readonly birthTicks: Float64Array
  readonly bounceProgresses: Float32Array
  readonly bounceSoundIndexes: Uint8Array
  readonly bounceSoundPitches: Float32Array
  readonly bounceSoundSequences: Float64Array
  readonly heights: Float32Array
  readonly horizontalVelocityXs: Float32Array
  readonly horizontalVelocityYs: Float32Array
  readonly ids: Float64Array
  readonly length: number
  readonly ownerIndexes: Uint8Array
  readonly painterRegistrationOrdinals: Float64Array
  readonly positionXs: Float32Array
  readonly positionYs: Float32Array
  readonly rotationDegrees: Float32Array
  readonly rotationStepDegrees: Float32Array
  readonly savedBounceVelocities: Float32Array
  readonly scales: Float32Array
  readonly transientPositions: Uint16Array
  readonly verticalVelocities: Float32Array
  readonly worldKeyIndexes: Uint8Array

  private readonly bytes: Uint8Array

  private constructor(buffer: ArrayBuffer, length: number) {
    this.bytes = new Uint8Array(buffer)
    this.length = length
    let offset = HAIL_FRAME_HEADER_BYTES
    const float64 = () => {
      const column = new Float64Array(buffer, offset, length)
      offset += length * Float64Array.BYTES_PER_ELEMENT
      return column
    }
    const float32 = () => {
      const column = new Float32Array(buffer, offset, length)
      offset += length * Float32Array.BYTES_PER_ELEMENT
      return column
    }
    const uint16 = () => {
      const column = new Uint16Array(buffer, offset, length)
      offset += length * Uint16Array.BYTES_PER_ELEMENT
      return column
    }
    const uint8 = () => {
      const column = new Uint8Array(buffer, offset, length)
      offset += length * Uint8Array.BYTES_PER_ELEMENT
      return column
    }

    this.ids = float64()
    this.birthTicks = float64()
    this.bounceSoundSequences = float64()
    this.painterRegistrationOrdinals = float64()
    this.bounceProgresses = float32()
    this.bounceSoundPitches = float32()
    this.heights = float32()
    this.horizontalVelocityXs = float32()
    this.horizontalVelocityYs = float32()
    this.positionXs = float32()
    this.positionYs = float32()
    this.rotationDegrees = float32()
    this.rotationStepDegrees = float32()
    this.savedBounceVelocities = float32()
    this.scales = float32()
    this.verticalVelocities = float32()
    this.transientPositions = uint16()
    this.bounceSoundIndexes = uint8()
    this.ownerIndexes = uint8()
    this.worldKeyIndexes = uint8()
    if (offset !== buffer.byteLength) {
      throw new PrimarySpellWaterHailFrameError('Hail frame column layout is inconsistent')
    }
    for (const property of Object.keys(this)) {
      Object.defineProperty(this, property, { enumerable: false })
    }
    Object.defineProperty(this, 'data', {
      enumerable: true,
      get: () => this.toBase64(),
    })
  }

  get data(): string {
    return this.toBase64()
  }

  static create(length: number): PrimarySpellWaterHailFrameRows {
    if (!Number.isInteger(length) || length < 0) {
      throw new RangeError('Hail frame length must be a nonnegative integer')
    }
    const byteLength = hailFrameByteLength(length)
    const buffer = new ArrayBuffer(byteLength)
    const header = new DataView(buffer, 0, HAIL_FRAME_HEADER_BYTES)
    header.setUint32(0, HAIL_FRAME_MAGIC, true)
    header.setUint16(4, HAIL_FRAME_FORMAT_VERSION, true)
    header.setUint16(6, HAIL_FRAME_HEADER_BYTES, true)
    header.setUint32(8, length, true)
    header.setUint32(12, byteLength, true)
    return new PrimarySpellWaterHailFrameRows(buffer, length)
  }

  static fromBase64(
    encoded: string,
    maximumLength: number,
  ): PrimarySpellWaterHailFrameRows {
    if (!Number.isInteger(maximumLength) || maximumLength < 0) {
      throw new RangeError('maximum Hail frame length must be a nonnegative integer')
    }
    if (encoded === EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS.toBase64()) {
      return EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS
    }
    const buffer = decodeCanonicalBase64(encoded)
    if (buffer.byteLength < HAIL_FRAME_HEADER_BYTES) {
      throw new PrimarySpellWaterHailFrameError('Hail frame header is truncated')
    }
    const header = new DataView(buffer, 0, HAIL_FRAME_HEADER_BYTES)
    if (header.getUint32(0, true) !== HAIL_FRAME_MAGIC) {
      throw new PrimarySpellWaterHailFrameError('Hail frame magic is invalid')
    }
    if (header.getUint16(4, true) !== HAIL_FRAME_FORMAT_VERSION) {
      throw new PrimarySpellWaterHailFrameError('Hail frame version is unsupported')
    }
    if (header.getUint16(6, true) !== HAIL_FRAME_HEADER_BYTES) {
      throw new PrimarySpellWaterHailFrameError('Hail frame header length is invalid')
    }
    const length = header.getUint32(8, true)
    if (length > maximumLength) {
      throw new PrimarySpellWaterHailFrameError(
        `Hail frame may contain at most ${maximumLength} rows`,
      )
    }
    const expectedByteLength = hailFrameByteLength(length)
    if (
      header.getUint32(12, true) !== expectedByteLength
      || buffer.byteLength !== expectedByteLength
    ) {
      throw new PrimarySpellWaterHailFrameError('Hail frame payload length is invalid')
    }
    return new PrimarySpellWaterHailFrameRows(buffer, length)
  }

  toBase64(): string {
    if (this.length !== 0) return encodeBase64(this.bytes)
    emptyHailFrameBase64 ??= encodeBase64(this.bytes)
    return emptyHailFrameBase64
  }

}

export const EMPTY_PRIMARY_SPELL_HAIL_FRAME_ROWS = PrimarySpellWaterHailFrameRows.create(0)

export function maximumPrimarySpellHailFrameBase64Length(maximumRows: number): number {
  if (!Number.isInteger(maximumRows) || maximumRows < 0) {
    throw new RangeError('maximum Hail frame rows must be a nonnegative integer')
  }
  return base64EncodedLength(hailFrameByteLength(maximumRows))
}

function hailFrameByteLength(length: number): number {
  const byteLength = HAIL_FRAME_HEADER_BYTES + length * BYTES_PER_HAIL_ROW
  if (!Number.isSafeInteger(byteLength) || byteLength > 0xffff_ffff) {
    throw new RangeError('Hail frame byte length is unavailable')
  }
  return byteLength
}

function isCanonicalBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return false
  }
  if (value.endsWith('==')) {
    return (base64Sextet(value.charCodeAt(value.length - 3)) & 0x0f) === 0
  }
  if (value.endsWith('=')) {
    return (base64Sextet(value.charCodeAt(value.length - 2)) & 0x03) === 0
  }
  return true
}

function encodeBase64(bytes: Uint8Array): string {
  const native = (bytes as Base64Uint8Array).toBase64
  if (native) return native.call(bytes)
  const nodeBuffer = nodeBufferConstructor()
  if (nodeBuffer) {
    return nodeBuffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')
  }
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function decodeCanonicalBase64(value: string): ArrayBuffer {
  if (value.length === 0 || value.length % 4 !== 0) throw canonicalBase64Error()
  const native = (Uint8Array as Base64Uint8ArrayConstructor).fromBase64
  if (native) {
    let bytes: Uint8Array
    try {
      bytes = native(value, {
        alphabet: 'base64',
        lastChunkHandling: 'strict',
      })
    } catch (error) {
      if (error instanceof SyntaxError) throw canonicalBase64Error()
      throw error
    }
    if (value.length !== base64EncodedLength(bytes.byteLength)) {
      throw canonicalBase64Error()
    }
    return exactArrayBuffer(bytes)
  }
  if (!isCanonicalBase64(value)) throw canonicalBase64Error()
  const nodeBuffer = nodeBufferConstructor()
  if (nodeBuffer) return exactArrayBuffer(nodeBuffer.from(value, 'base64'))
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.byteOffset === 0
    && bytes.byteLength === bytes.buffer.byteLength
    && bytes.buffer instanceof ArrayBuffer
  ) {
    return bytes.buffer
  }
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

function base64EncodedLength(byteLength: number): number {
  return Math.ceil(byteLength / 3) * 4
}

function base64Sextet(code: number): number {
  if (code >= 65 && code <= 90) return code - 65
  if (code >= 97 && code <= 122) return code - 71
  if (code >= 48 && code <= 57) return code + 4
  if (code === 43) return 62
  if (code === 47) return 63
  return -1
}

function canonicalBase64Error(): PrimarySpellWaterHailFrameError {
  return new PrimarySpellWaterHailFrameError('Hail frame is not canonical base64')
}

function nodeBufferConstructor(): NodeBufferConstructor | undefined {
  return (globalThis as typeof globalThis & { Buffer?: NodeBufferConstructor }).Buffer
}
