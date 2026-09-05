import { createHash } from 'node:crypto'
import { link, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { promisify } from 'node:util'
import { deserialize, serialize } from 'node:v8'
import { gzip, gunzip } from 'node:zlib'

import { GAME_PROTOCOL_VERSION } from '../protocol/game-protocol.ts'
import { runArchivePlayers, type RunArchive } from './run-archive.ts'

const compress = promisify(gzip)
const decompress = promisify(gunzip)
const ARCHIVE_FILE = /^[0-9a-f-]{36}\.sdrrun\.gz$/
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000

interface RunArchiveReceipt {
  readonly file: string
  readonly bytes: number
  readonly sha256: string
  readonly serializationMs: number
}

/** Private operator artifacts, published atomically after the gameplay tick yields. */
export class RunArchiveStore {
  private readonly directory: string
  private queue: Promise<void> = Promise.resolve()

  constructor(directory: string) {
    this.directory = directory
  }

  save(archive: RunArchive): Promise<RunArchiveReceipt> {
    // A burst of completed parties must yield between world serializations.
    const operation = this.queue.then(() => this.write(archive))
    // Preserve each caller's rejection while allowing later captures to proceed.
    this.queue = operation.then(() => {}, () => {})
    return operation
  }

  async close(): Promise<void> {
    await this.queue
  }

  async prune(now = Date.now()): Promise<number> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const files = new Set(await readdir(this.directory))
    let removed = 0
    for (const file of files) {
      const temporary = /^\.writing-[A-Za-z0-9]{6}$/.test(file)
      if ((!temporary && !ARCHIVE_FILE.test(file)) || files.has(`${file}.keep`)) continue
      const path = join(this.directory, file)
      if ((await stat(path)).mtimeMs >= now - RETENTION_MS) continue
      if (temporary) await rm(path, { recursive: true })
      else {
        await rm(path)
        await rm(`${path}.json`, { force: true })
      }
      removed += 1
    }
    return removed
  }

  private async write(archive: RunArchive): Promise<RunArchiveReceipt> {
    const file = `${archive.id}.sdrrun.gz`
    if (!ARCHIVE_FILE.test(file)) throw new Error('Run archive id is invalid')
    await setImmediate()
    const startedAt = performance.now()
    const bytes = serialize(archive)
    const serializationMs = performance.now() - startedAt
    const compressed = await compress(bytes)
    const receipt = {
      file,
      bytes: compressed.length,
      sha256: createHash('sha256').update(compressed).digest('hex'),
      serializationMs,
    }
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const path = join(this.directory, file)
    const summary = JSON.stringify({
      ...receipt,
      id: archive.id,
      runId: archive.runId,
      sessionId: archive.sessionId,
      revision: archive.revision,
      protocolVersion: archive.protocolVersion,
      endedAtUtc: archive.endedAtUtc,
      endReason: archive.endReason,
      boneyard: archive.loadedBoneyard.choice.name,
      players: runArchivePlayers(archive),
      lastAliveTick: archive.lastAlive?.state.tick ?? null,
      worstTick: archive.worstTick.state.tick,
      worstTickMs: archive.worstTick.tickMs,
      performance: archive.performance,
    })
    const temporary = await mkdtemp(join(this.directory, '.writing-'))
    try {
      await writeFile(join(temporary, 'capture'), compressed, { mode: 0o600 })
      await writeFile(join(temporary, 'summary'), summary, { mode: 0o600 })
      await link(join(temporary, 'capture'), path)
      await link(join(temporary, 'summary'), `${path}.json`)
      return receipt
    } finally {
      await rm(temporary, { recursive: true })
    }
  }
}

export async function readRunArchive(path: string): Promise<RunArchive> {
  const bytes = await decompress(await readFile(path))
  // Only operator-owned server captures enter this path; there is no public upload/import route.
  const archive: RunArchive = deserialize(bytes)
  if (archive?.schemaVersion !== 1 || archive.protocolVersion !== GAME_PROTOCOL_VERSION) {
    throw new Error('Run archive schema or gameplay protocol does not match this checkout')
  }
  if (!/^[0-9a-f]{40}$/.test(archive.revision)
    || !(archive.lastAliveByPlayer instanceof Map)
    || archive.loadedBoneyard?.runId !== archive.runId
    || archive.worstTick?.state.world.kind !== 'boneyard') {
    throw new Error('Run archive metadata or checkpoint is invalid')
  }
  return archive
}
