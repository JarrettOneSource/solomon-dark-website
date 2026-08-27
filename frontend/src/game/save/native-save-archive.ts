import { NativeSaveFormatError } from './native-save-codec.ts'

const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024
const MAX_FILES = 256
const MAX_MANIFEST_BYTES = 128 * 1024
const ZIP_LOCAL_FILE = 0x04034b50
const ZIP_CENTRAL_FILE = 0x02014b50
const ZIP_END = 0x06054b50
const ZIP_UTF8 = 0x0800
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export interface NativeArchiveFile {
  readonly bytes: Uint8Array
  readonly path: string
}

export interface NativeSaveArchive {
  readonly darkdata: Uint8Array
  readonly gamestate: Uint8Array
  readonly retainedFiles?: readonly NativeArchiveFile[]
  readonly runName: string
}

interface ZipEntry {
  readonly compressedSize: number
  readonly compression: number
  readonly crc32: number
  readonly flags: number
  readonly localOffset: number
  readonly path: string
  readonly uncompressedSize: number
}

function requireRange(bytes: Uint8Array, offset: number, size: number, claim: string): void {
  if (
    !Number.isSafeInteger(offset)
    || !Number.isSafeInteger(size)
    || offset < 0
    || size < 0
    || offset + size > bytes.byteLength
  ) throw new NativeSaveFormatError(`native save archive has truncated ${claim}`)
}

function u16(bytes: Uint8Array, offset: number, claim: string): number {
  requireRange(bytes, offset, 2, claim)
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true)
}

function u32(bytes: Uint8Array, offset: number, claim: string): number {
  requireRange(bytes, offset, 4, claim)
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true)
}

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(offset, value, true)
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value, true)
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }
  return result
}

const CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) !== 0
    ? 0xedb88320 ^ (crc >>> 1)
    : crc >>> 1
  return crc >>> 0
}))

export function nativeArchiveCrc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff
  for (const value of bytes) crc = CRC_TABLE[(crc ^ value) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffff_ffff) >>> 0
}

function validatePath(path: string): string {
  if (
    path.length === 0
    || path.length > 512
    || path.includes('\\')
    || path.includes(':')
    || path.startsWith('/')
    || path.endsWith('/')
    || path.split('/').some(part => part.length === 0 || part === '.' || part === '..')
    || /[\u0000-\u001f\u007f-\u009f]/u.test(path)
  ) throw new NativeSaveFormatError(`native save archive path is unsafe: ${JSON.stringify(path)}`)
  return path
}

function validateRetainedPath(path: string): string {
  const validated = validatePath(path)
  const canonical = validated.toLowerCase()
  if (
    !canonical.startsWith('solomondark/')
    || canonical === 'solomondark/darkdata.cfg'
    || canonical === 'solomondark/settings.txt'
    || /^solomondark\/savegames\/.+\/gamestate\.sav$/i.test(validated)
  ) throw new NativeSaveFormatError(`native retained file path is invalid: ${validated}`)
  return validated
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

function dosDateTime(): { readonly date: number; readonly time: number } {
  // Launcher-native archives pin 2000-01-01T00:00:00.
  return { date: ((2000 - 1980) << 9) | (1 << 5) | 1, time: 0 }
}

export function createStoredZip(files: readonly NativeArchiveFile[]): Uint8Array {
  if (files.length === 0 || files.length > MAX_FILES) {
    throw new NativeSaveFormatError('native save archive file count is invalid')
  }
  const seen = new Set<string>()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0
  const stamp = dosDateTime()
  for (const file of files) {
    const path = validatePath(file.path)
    const canonical = path.toLowerCase()
    if (seen.has(canonical)) throw new NativeSaveFormatError('native save archive has duplicate paths')
    seen.add(canonical)
    const name = encoder.encode(path)
    const crc = nativeArchiveCrc32(file.bytes)
    const local = new Uint8Array(30 + name.byteLength)
    writeU32(local, 0, ZIP_LOCAL_FILE)
    writeU16(local, 4, 20)
    writeU16(local, 6, ZIP_UTF8)
    writeU16(local, 8, 0)
    writeU16(local, 10, stamp.time)
    writeU16(local, 12, stamp.date)
    writeU32(local, 14, crc)
    writeU32(local, 18, file.bytes.byteLength)
    writeU32(local, 22, file.bytes.byteLength)
    writeU16(local, 26, name.byteLength)
    writeU16(local, 28, 0)
    local.set(name, 30)
    localParts.push(local, file.bytes)

    const central = new Uint8Array(46 + name.byteLength)
    writeU32(central, 0, ZIP_CENTRAL_FILE)
    writeU16(central, 4, 20)
    writeU16(central, 6, 20)
    writeU16(central, 8, ZIP_UTF8)
    writeU16(central, 10, 0)
    writeU16(central, 12, stamp.time)
    writeU16(central, 14, stamp.date)
    writeU32(central, 16, crc)
    writeU32(central, 20, file.bytes.byteLength)
    writeU32(central, 24, file.bytes.byteLength)
    writeU16(central, 28, name.byteLength)
    writeU16(central, 30, 0)
    writeU16(central, 32, 0)
    writeU16(central, 34, 0)
    writeU16(central, 36, 0)
    writeU32(central, 38, 0)
    writeU32(central, 42, localOffset)
    central.set(name, 46)
    centralParts.push(central)
    localOffset += local.byteLength + file.bytes.byteLength
  }
  const central = concat(centralParts)
  const end = new Uint8Array(22)
  writeU32(end, 0, ZIP_END)
  writeU16(end, 4, 0)
  writeU16(end, 6, 0)
  writeU16(end, 8, files.length)
  writeU16(end, 10, files.length)
  writeU32(end, 12, central.byteLength)
  writeU32(end, 16, localOffset)
  writeU16(end, 20, 0)
  const result = concat([...localParts, central, end])
  if (result.byteLength > MAX_ARCHIVE_BYTES) {
    throw new NativeSaveFormatError('native save archive exceeds 16 MiB')
  }
  return result
}

function findEnd(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.byteLength - 65_557)
  for (let offset = bytes.byteLength - 22; offset >= start; offset -= 1) {
    if (u32(bytes, offset, 'ZIP end signature') === ZIP_END) {
      const commentLength = u16(bytes, offset + 20, 'ZIP comment length')
      if (offset + 22 + commentLength === bytes.byteLength) return offset
    }
  }
  throw new NativeSaveFormatError('native save archive has no ZIP end record')
}

function parseCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new NativeSaveFormatError('native save archive size is invalid')
  }
  const end = findEnd(bytes)
  if (u16(bytes, end + 4, 'ZIP disk') !== 0 || u16(bytes, end + 6, 'ZIP central disk') !== 0) {
    throw new NativeSaveFormatError('multi-disk native save archives are unsupported')
  }
  const diskCount = u16(bytes, end + 8, 'ZIP disk entry count')
  const count = u16(bytes, end + 10, 'ZIP entry count')
  const size = u32(bytes, end + 12, 'ZIP central size')
  const start = u32(bytes, end + 16, 'ZIP central offset')
  if (count === 0 || count > MAX_FILES || diskCount !== count || start + size !== end) {
    throw new NativeSaveFormatError('native save archive central directory is invalid')
  }
  const entries: ZipEntry[] = []
  const seen = new Set<string>()
  let offset = start
  let expanded = 0
  for (let index = 0; index < count; index += 1) {
    if (u32(bytes, offset, `central entry ${index}`) !== ZIP_CENTRAL_FILE) {
      throw new NativeSaveFormatError(`native save archive central entry ${index} is invalid`)
    }
    const flags = u16(bytes, offset + 8, 'ZIP flags')
    const compression = u16(bytes, offset + 10, 'ZIP compression')
    const crc32 = u32(bytes, offset + 16, 'ZIP CRC')
    const compressedSize = u32(bytes, offset + 20, 'ZIP compressed size')
    const uncompressedSize = u32(bytes, offset + 24, 'ZIP uncompressed size')
    const nameLength = u16(bytes, offset + 28, 'ZIP name length')
    const extraLength = u16(bytes, offset + 30, 'ZIP extra length')
    const commentLength = u16(bytes, offset + 32, 'ZIP entry comment length')
    const disk = u16(bytes, offset + 34, 'ZIP entry disk')
    const localOffset = u32(bytes, offset + 42, 'ZIP local offset')
    requireRange(bytes, offset + 46, nameLength + extraLength + commentLength, 'ZIP entry')
    let path: string
    try {
      path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    } catch {
      throw new NativeSaveFormatError('native save archive path is not UTF-8')
    }
    validatePath(path)
    const canonical = path.toLowerCase()
    if (seen.has(canonical)) throw new NativeSaveFormatError('native save archive has duplicate paths')
    seen.add(canonical)
    if ((flags & 1) !== 0 || (flags & ~ZIP_UTF8 & ~0x0008) !== 0 || disk !== 0) {
      throw new NativeSaveFormatError('native save archive uses unsupported ZIP features')
    }
    if (compression !== 0 && compression !== 8) {
      throw new NativeSaveFormatError(`native save archive compression ${compression} is unsupported`)
    }
    expanded += uncompressedSize
    if (expanded > MAX_EXPANDED_BYTES) {
      throw new NativeSaveFormatError('native save archive expands beyond 64 MiB')
    }
    entries.push({ compressedSize, compression, crc32, flags, localOffset, path, uncompressedSize })
    offset += 46 + nameLength + extraLength + commentLength
  }
  if (offset !== end) throw new NativeSaveFormatError('native save archive central size drifted')
  return entries
}

async function inflateRaw(bytes: Uint8Array, maximumBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new NativeSaveFormatError('this browser cannot read compressed native save archives')
  }
  const stream = new Blob([new Uint8Array(bytes)]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maximumBytes) {
        await reader.cancel()
        throw new NativeSaveFormatError('native save archive entry exceeds its declared size')
      }
      chunks.push(new Uint8Array(value))
    }
  } catch (cause) {
    if (cause instanceof NativeSaveFormatError) throw cause
    throw new NativeSaveFormatError('native save archive deflate stream is invalid')
  }
  return concat(chunks)
}

export async function readZip(bytes: Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  const entries = parseCentralDirectory(bytes)
  const result = new Map<string, Uint8Array>()
  for (const entry of entries) {
    const offset = entry.localOffset
    if (u32(bytes, offset, 'ZIP local signature') !== ZIP_LOCAL_FILE) {
      throw new NativeSaveFormatError(`native save archive local record for ${entry.path} is invalid`)
    }
    const flags = u16(bytes, offset + 6, 'ZIP local flags')
    const compression = u16(bytes, offset + 8, 'ZIP local compression')
    const localCrc32 = u32(bytes, offset + 14, 'ZIP local CRC')
    const localCompressedSize = u32(bytes, offset + 18, 'ZIP local compressed size')
    const localUncompressedSize = u32(bytes, offset + 22, 'ZIP local uncompressed size')
    const nameLength = u16(bytes, offset + 26, 'ZIP local name length')
    const extraLength = u16(bytes, offset + 28, 'ZIP local extra length')
    requireRange(bytes, offset + 30, nameLength + extraLength + entry.compressedSize, 'ZIP local data')
    let localPath: string
    try {
      localPath = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    } catch {
      throw new NativeSaveFormatError('native save archive local path is not UTF-8')
    }
    if (localPath !== entry.path || flags !== entry.flags || compression !== entry.compression) {
      throw new NativeSaveFormatError(`native save archive local metadata drifted for ${entry.path}`)
    }
    const usesDescriptor = (flags & 0x0008) !== 0
    if (
      (!usesDescriptor && (
        localCrc32 !== entry.crc32
        || localCompressedSize !== entry.compressedSize
        || localUncompressedSize !== entry.uncompressedSize
      ))
      || (usesDescriptor && (
        (localCrc32 !== 0 && localCrc32 !== entry.crc32)
        || (localCompressedSize !== 0 && localCompressedSize !== entry.compressedSize)
        || (localUncompressedSize !== 0 && localUncompressedSize !== entry.uncompressedSize)
      ))
    ) throw new NativeSaveFormatError(`native save archive local sizes drifted for ${entry.path}`)
    const compressed = bytes.slice(
      offset + 30 + nameLength + extraLength,
      offset + 30 + nameLength + extraLength + entry.compressedSize,
    )
    const expanded = entry.compression === 0
      ? compressed
      : await inflateRaw(compressed, entry.uncompressedSize)
    if (
      expanded.byteLength !== entry.uncompressedSize
      || nativeArchiveCrc32(expanded) !== entry.crc32
    ) throw new NativeSaveFormatError(`native save archive integrity failed for ${entry.path}`)
    result.set(entry.path, expanded)
  }
  return result
}

interface LauncherManifestFile {
  readonly path: string
  readonly sha256: string
  readonly size: number
}

interface LauncherManifest {
  readonly files: readonly LauncherManifestFile[]
  readonly name: string | null
  readonly schemaVersion: number
  readonly slot: number
}

function parseManifest(bytes: Uint8Array): LauncherManifest {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new NativeSaveFormatError('native save manifest size is invalid')
  }
  let value: unknown
  try {
    value = JSON.parse(decoder.decode(bytes))
  } catch {
    throw new NativeSaveFormatError('native save manifest is not valid UTF-8 JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeSaveFormatError('native save manifest is invalid')
  }
  const source = value as Record<string, unknown>
  if (
    Object.keys(source).some(key => !['files', 'name', 'schemaVersion', 'slot'].includes(key))
    || source.schemaVersion !== 1
    || !Number.isSafeInteger(source.slot)
    || Number(source.slot) < 0
    || Number(source.slot) > 7
    || (source.name !== null && (
      typeof source.name !== 'string'
      || source.name.length > 40
      || /[\u0000-\u001f\u007f-\u009f]/u.test(source.name)
    ))
    || !Array.isArray(source.files)
    || source.files.length === 0
    || source.files.length > MAX_FILES - 1
  ) throw new NativeSaveFormatError('native save manifest contract is invalid')
  const paths = new Set<string>()
  const files = source.files.map((entry, index): LauncherManifestFile => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new NativeSaveFormatError(`native save manifest file ${index} is invalid`)
    }
    const file = entry as Record<string, unknown>
    if (
      Object.keys(file).some(key => !['path', 'sha256', 'size'].includes(key))
      || typeof file.path !== 'string'
      || !file.path.toLowerCase().startsWith('solomondark/')
      || typeof file.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !Number.isSafeInteger(file.size)
      || Number(file.size) < 0
    ) throw new NativeSaveFormatError(`native save manifest file ${index} is invalid`)
    const path = validatePath(file.path)
    const canonical = path.toLowerCase()
    if (paths.has(canonical)) {
      throw new NativeSaveFormatError('native save manifest has duplicate paths')
    }
    paths.add(canonical)
    return { path, sha256: file.sha256, size: Number(file.size) }
  })
  return {
    files,
    name: source.name as string | null,
    schemaVersion: 1,
    slot: Number(source.slot),
  }
}

export async function createNativeSaveArchive(
  save: NativeSaveArchive,
  slot = 0,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(slot) || slot < 0 || slot > 7) {
    throw new NativeSaveFormatError('native save archive slot is invalid')
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(save.runName)) {
    throw new NativeSaveFormatError('native save archive run name is invalid')
  }
  const semanticGamestatePath = `solomondark/savegames/${save.runName}/gamestate.sav`
  const retainedFiles = [...(save.retainedFiles ?? [])]
  for (const file of retainedFiles) {
    validateRetainedPath(file.path)
  }
  const rawFiles: NativeArchiveFile[] = [
    { bytes: save.darkdata, path: 'solomondark/darkdata.cfg' },
    {
      bytes: save.gamestate,
      path: semanticGamestatePath,
    },
    ...retainedFiles,
  ]
  const manifest: LauncherManifest = {
    files: await Promise.all(rawFiles.map(async file => ({
      path: file.path,
      sha256: await sha256(file.bytes),
      size: file.bytes.byteLength,
    }))),
    name: 'Browser Game',
    schemaVersion: 1,
    slot,
  }
  return createStoredZip([
    { bytes: encoder.encode(JSON.stringify(manifest)), path: 'manifest.json' },
    ...rawFiles.map(file => ({ ...file, path: `savegames/${file.path}` })),
  ])
}

export async function readNativeSaveArchive(bytes: Uint8Array): Promise<NativeSaveArchive> {
  const files = await readZip(bytes)
  const canonicalFiles = new Map(
    [...files].map(([path, contents]) => [path.toLowerCase(), contents] as const),
  )
  const manifestBytes = canonicalFiles.get('manifest.json')
  if (!manifestBytes) throw new NativeSaveFormatError('native save archive has no manifest.json')
  const manifest = parseManifest(manifestBytes)
  if (files.size !== manifest.files.length + 1) {
    throw new NativeSaveFormatError('native save archive file count does not match its manifest')
  }
  const manifestPaths = new Set(manifest.files.map(file => `savegames/${file.path}`.toLowerCase()))
  if ([...canonicalFiles.keys()].some(path => path !== 'manifest.json' && !manifestPaths.has(path))) {
    throw new NativeSaveFormatError('native save archive contains a file absent from its manifest')
  }
  for (const expected of manifest.files) {
    const actual = canonicalFiles.get(`savegames/${expected.path}`.toLowerCase())
    if (
      !actual
      || actual.byteLength !== expected.size
      || await sha256(actual) !== expected.sha256
    ) throw new NativeSaveFormatError(`native save archive manifest failed for ${expected.path}`)
  }
  const darkdata = canonicalFiles.get('savegames/solomondark/darkdata.cfg')
  const gameRows = manifest.files.filter(({ path }) => (
    /^solomondark\/savegames\/[A-Za-z0-9._-]{1,64}\/gamestate\.sav$/i.test(path)
  ))
  if (!darkdata || gameRows.length !== 1) {
    throw new NativeSaveFormatError('native save archive does not contain one current wizard')
  }
  const path = gameRows[0]!.path
  const gamestate = canonicalFiles.get(`savegames/${path}`.toLowerCase())!
  const semanticPaths = new Set([
    'solomondark/darkdata.cfg',
    path.toLowerCase(),
  ])
  const retainedFiles = manifest.files
    .filter(file => !semanticPaths.has(file.path.toLowerCase()))
    .map(file => {
      validateRetainedPath(file.path)
      return Object.freeze({
        bytes: canonicalFiles.get(`savegames/${file.path}`.toLowerCase())!,
        path: file.path,
      })
    })
  return Object.freeze({
    darkdata,
    gamestate,
    retainedFiles: Object.freeze(retainedFiles),
    runName: path.split('/')[2]!,
  })
}
