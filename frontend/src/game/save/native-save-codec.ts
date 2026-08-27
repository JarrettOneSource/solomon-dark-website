const SYNCBUFFER_MAX_BYTES = 64 * 1024 * 1024
const SYNCBUFFER_MAX_DEPTH = 128
const SYNCBUFFER_MAX_NODES = 1_000_000
const DARKDATA_MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024

export const NATIVE_DARKDATA_KEY = new TextEncoder().encode(
  'MagicEncryptionWord="SolomonDarkEncryption"'
  + '|there$w#st w&187sfj21\t89n4v 1984x98mn12xc39931c87241@@@@@@',
)

export interface NativeChunkNode {
  readonly children: readonly NativeChunkNode[]
  readonly offset: number
  readonly payload: Uint8Array
  readonly payloadOffset: number
}

export interface NativeNamedBuffer {
  readonly buffer: NativeSyncBuffer
  readonly name: string
  readonly nameOffset: number
}

export interface NativeSyncBuffer {
  readonly endOffset: number
  readonly namedBuffers: readonly NativeNamedBuffer[]
  readonly offset: number
  readonly root: NativeChunkNode
}

export class NativeSaveFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NativeSaveFormatError'
  }
}

class NativeCursor {
  private readonly bytes: Uint8Array
  private nodeCount = 0
  offset = 0

  constructor(bytes: Uint8Array) {
    if (bytes.byteLength > SYNCBUFFER_MAX_BYTES) {
      throw new NativeSaveFormatError(
        `SyncBuffer input is ${bytes.byteLength} bytes; limit is ${SYNCBUFFER_MAX_BYTES}`,
      )
    }
    this.bytes = bytes
  }

  u32(claim: string): number {
    if (this.offset + 4 > this.bytes.byteLength) {
      throw new NativeSaveFormatError(
        `truncated ${claim} u32 at 0x${this.offset.toString(16)}`,
      )
    }
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      4,
    ).getUint32(0, true)
    this.offset += 4
    return value
  }

  take(size: number, claim: string): Uint8Array {
    if (!Number.isSafeInteger(size) || size < 0 || this.offset + size > this.bytes.byteLength) {
      throw new NativeSaveFormatError(
        `truncated ${claim} at 0x${this.offset.toString(16)}: need ${size} bytes`,
      )
    }
    const value = this.bytes.slice(this.offset, this.offset + size)
    this.offset += size
    return value
  }

  string(claim: string): { readonly name: string; readonly offset: number } {
    const offset = this.offset
    const size = this.u32(`${claim} length`)
    const raw = this.take(size, claim)
    if (raw.byteLength === 0 || raw[raw.byteLength - 1] !== 0) {
      throw new NativeSaveFormatError(`${claim} is not NUL-terminated`)
    }
    let name: string
    try {
      name = new TextDecoder('utf-8', { fatal: true }).decode(raw.subarray(0, -1))
    } catch {
      throw new NativeSaveFormatError(`${claim} is not UTF-8`)
    }
    return { name, offset }
  }

  parseNode(depth: number): NativeChunkNode {
    if (depth > SYNCBUFFER_MAX_DEPTH) {
      throw new NativeSaveFormatError(
        `SyncBuffer nesting exceeds ${SYNCBUFFER_MAX_DEPTH} levels`,
      )
    }
    this.nodeCount += 1
    if (this.nodeCount > SYNCBUFFER_MAX_NODES) {
      throw new NativeSaveFormatError(
        `SyncBuffer node count exceeds ${SYNCBUFFER_MAX_NODES}`,
      )
    }
    const offset = this.offset
    const payloadLength = this.u32('node payload length')
    const payloadOffset = this.offset
    const payload = this.take(payloadLength, 'node payload')
    const childCount = this.u32('node child count')
    if (childCount > Math.floor((this.bytes.byteLength - this.offset) / 8)) {
      throw new NativeSaveFormatError(
        `node at 0x${offset.toString(16)} declares impossible child count ${childCount}`,
      )
    }
    const children: NativeChunkNode[] = []
    for (let index = 0; index < childCount; index += 1) {
      children.push(this.parseNode(depth + 1))
    }
    return Object.freeze({ children: Object.freeze(children), offset, payload, payloadOffset })
  }

  parseBuffer(depth: number): NativeSyncBuffer {
    const offset = this.offset
    const root = this.parseNode(depth)
    const count = this.u32('named-buffer count')
    if (count > Math.floor((this.bytes.byteLength - this.offset) / 13)) {
      throw new NativeSaveFormatError(
        `buffer at 0x${offset.toString(16)} declares impossible named-buffer count ${count}`,
      )
    }
    const names = new Set<string>()
    const namedBuffers: NativeNamedBuffer[] = []
    for (let index = 0; index < count; index += 1) {
      const { name, offset: nameOffset } = this.string(`named buffer ${index} name`)
      if (names.has(name)) {
        throw new NativeSaveFormatError(
          `buffer at 0x${offset.toString(16)} has ambiguous duplicate name ${JSON.stringify(name)}`,
        )
      }
      names.add(name)
      namedBuffers.push(Object.freeze({
        buffer: this.parseBuffer(depth + 1),
        name,
        nameOffset,
      }))
    }
    return Object.freeze({
      endOffset: this.offset,
      namedBuffers: Object.freeze(namedBuffers),
      offset,
      root,
    })
  }

  finish(): void {
    if (this.offset !== this.bytes.byteLength) {
      throw new NativeSaveFormatError(
        `SyncBuffer ended at 0x${this.offset.toString(16)} with `
        + `${this.bytes.byteLength - this.offset} unclaimed bytes`,
      )
    }
  }
}

export function parseNativeSyncBuffer(bytes: Uint8Array): NativeSyncBuffer {
  const cursor = new NativeCursor(bytes)
  const result = cursor.parseBuffer(0)
  cursor.finish()
  return result
}

function u32(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new NativeSaveFormatError(`u32 value ${value} is invalid`)
  }
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, true)
  return bytes
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }
  return result
}

function encodeNode(node: NativeChunkNode): Uint8Array {
  return concat([
    u32(node.payload.byteLength),
    node.payload,
    u32(node.children.length),
    ...node.children.map(encodeNode),
  ])
}

export function encodeNativeSyncBuffer(buffer: NativeSyncBuffer): Uint8Array {
  const names = new Set<string>()
  const named: Uint8Array[] = []
  for (const item of buffer.namedBuffers) {
    if (names.has(item.name)) {
      throw new NativeSaveFormatError(
        `cannot encode ambiguous duplicate named buffer ${JSON.stringify(item.name)}`,
      )
    }
    names.add(item.name)
    const name = concat([new TextEncoder().encode(item.name), Uint8Array.of(0)])
    named.push(concat([u32(name.byteLength), name, encodeNativeSyncBuffer(item.buffer)]))
  }
  return concat([encodeNode(buffer.root), u32(named.length), ...named])
}

export function xorNativeDarkdata(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes, (value, index) => (
    value ^ NATIVE_DARKDATA_KEY[index % NATIVE_DARKDATA_KEY.byteLength]!
  ))
}

function decodeVarint(
  bytes: Uint8Array,
  start: number,
  claim: string,
): { readonly offset: number; readonly value: number } {
  let value = 0
  let offset = start
  for (let index = 0; index < 5; index += 1) {
    if (offset >= bytes.byteLength) {
      throw new NativeSaveFormatError(
        `truncated ${claim} varint at 0x${start.toString(16)}`,
      )
    }
    const byte = bytes[offset++]!
    if (value > 0x01ff_ffff) {
      throw new NativeSaveFormatError(
        `overflowing ${claim} varint at 0x${start.toString(16)}`,
      )
    }
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return { offset, value }
  }
  throw new NativeSaveFormatError(`overlong ${claim} varint at 0x${start.toString(16)}`)
}

function encodeVarint(source: number): Uint8Array {
  if (!Number.isSafeInteger(source) || source < 0 || source > 0xffff_ffff) {
    throw new NativeSaveFormatError(`varint value ${source} does not fit u32`)
  }
  let value = source
  const groups = [value & 0x7f]
  value = Math.floor(value / 128)
  while (value > 0) {
    groups.push(value & 0x7f)
    value = Math.floor(value / 128)
  }
  groups.reverse()
  return Uint8Array.from(groups, (group, index) => (
    group | (index + 1 < groups.length ? 0x80 : 0)
  ))
}

export function decompressNativeDarkdata(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength === 0) throw new NativeSaveFormatError('darkdata codec input is empty')
  const marker = bytes[0]!
  let offset = 1
  const output: number[] = []
  while (offset < bytes.byteLength) {
    const value = bytes[offset++]!
    if (value !== marker) {
      output.push(value)
    } else {
      if (offset >= bytes.byteLength) {
        throw new NativeSaveFormatError(`truncated marker command at 0x${(offset - 1).toString(16)}`)
      }
      if (bytes[offset] === 0) {
        output.push(marker)
        offset += 1
      } else {
        const length = decodeVarint(bytes, offset, 'match length')
        const distance = decodeVarint(bytes, length.offset, 'match distance')
        offset = distance.offset
        if (length.value === 0) throw new NativeSaveFormatError('back-reference has zero length')
        if (distance.value === 0 || distance.value > output.length) {
          throw new NativeSaveFormatError(
            `back-reference distance ${distance.value} exceeds decoded prefix ${output.length}`,
          )
        }
        if (output.length + length.value > DARKDATA_MAX_DECOMPRESSED_BYTES) {
          throw new NativeSaveFormatError('darkdata decompression exceeds the native 32 MiB ceiling')
        }
        for (let index = 0; index < length.value; index += 1) {
          output.push(output[output.length - distance.value]!)
        }
      }
    }
    if (output.length > DARKDATA_MAX_DECOMPRESSED_BYTES) {
      throw new NativeSaveFormatError('darkdata decompression exceeds the native 32 MiB ceiling')
    }
  }
  return Uint8Array.from(output)
}

export function compressNativeDarkdata(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength === 0) return new Uint8Array()
  const frequencies = new Uint32Array(256)
  for (const value of bytes) frequencies[value] = frequencies[value]! + 1
  let marker = 0
  for (let value = 1; value < frequencies.length; value += 1) {
    if (frequencies[value]! < frequencies[marker]!) marker = value
  }

  const previous = new Int32Array(bytes.byteLength)
  previous.fill(-1)
  const heads = new Int32Array(65_536)
  heads.fill(-1)
  for (let index = 0; index < Math.max(0, bytes.byteLength - 1); index += 1) {
    const key = (bytes[index]! << 8) | bytes[index + 1]!
    previous[index] = heads[key]!
    heads[key] = index
  }

  const output: number[] = [marker]
  let position = 0
  let remaining = bytes.byteLength
  while (remaining > 3) {
    let candidate = previous[position]!
    let bestLength = 3
    let bestDistance = 0
    while (candidate !== -1) {
      const distance = position - candidate
      if (distance > 99_999) break
      if (bytes[candidate + 3] === bytes[position + 3]) {
        const limit = Math.min(distance, remaining)
        let matchLength = 2
        while (
          matchLength < limit
          && bytes[candidate + matchLength] === bytes[position + matchLength]
        ) matchLength += 1
        if (matchLength > bestLength) {
          bestLength = matchLength
          bestDistance = distance
        }
      }
      candidate = previous[candidate]!
    }

    let accept = bestLength >= 8
    if (bestLength === 4) accept = bestDistance <= 0x7f
    else if (bestLength === 5) accept = bestDistance <= 0x3fff
    else if (bestLength === 6) accept = bestDistance <= 0x1f_ffff
    else if (bestLength === 7) accept = bestDistance <= 0x0fff_ffff

    if (accept) {
      output.push(marker, ...encodeVarint(bestLength), ...encodeVarint(bestDistance))
      position += bestLength
      remaining -= bestLength
    } else {
      const value = bytes[position]!
      output.push(value)
      if (value === marker) output.push(0)
      position += 1
      remaining -= 1
    }
  }
  while (position < bytes.byteLength) {
    const value = bytes[position++]!
    output.push(value)
    if (value === marker) output.push(0)
  }
  return Uint8Array.from(output)
}

export function decodeNativeDarkdata(bytes: Uint8Array): NativeSyncBuffer {
  return parseNativeSyncBuffer(xorNativeDarkdata(decompressNativeDarkdata(bytes)))
}

export function encodeNativeDarkdata(buffer: NativeSyncBuffer): Uint8Array {
  return compressNativeDarkdata(xorNativeDarkdata(encodeNativeSyncBuffer(buffer)))
}

export function nativeBytesEqual(first: Uint8Array, second: Uint8Array): boolean {
  return first.byteLength === second.byteLength
    && first.every((value, index) => value === second[index])
}

export function replaceNativeNodeChild(
  node: NativeChunkNode,
  index: number,
  child: NativeChunkNode,
): NativeChunkNode {
  if (!Number.isSafeInteger(index) || index < 0 || index >= node.children.length) {
    throw new NativeSaveFormatError(`native node child index ${index} is invalid`)
  }
  const children = [...node.children]
  children[index] = child
  return Object.freeze({ ...node, children: Object.freeze(children) })
}
