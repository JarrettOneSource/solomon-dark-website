import type { GameModAsset } from './protocol/game-protocol.ts'

export interface GameContentDownloadProgress {
  readonly active: GameModAsset | null
  readonly completedBytes: number
  readonly totalBytes: number
}

interface GameContentCacheOptions {
  readonly cacheStorage?: Pick<CacheStorage, 'open'>
  readonly request?: typeof fetch
  readonly signal?: AbortSignal
  readonly subtle?: SubtleCrypto
}

const CACHE_NAME = 'solomon-dark-game-content-v1'

export class GameModContentLoadError extends Error {
  readonly modId: string

  constructor(modId: string, message: string) {
    super(message)
    this.name = 'GameModContentLoadError'
    this.modId = modId
  }
}

export async function prefetchGameContent(
  assets: readonly GameModAsset[],
  onProgress: (progress: GameContentDownloadProgress) => void = () => {},
  options: GameContentCacheOptions = {},
): Promise<void> {
  const unique = uniqueAssets(assets)
  const totalBytes = unique.reduce((total, asset) => total + asset.byteLength, 0)
  let completedBytes = 0
  onProgress({ active: null, completedBytes, totalBytes })
  const cache = await (options.cacheStorage ?? globalThis.caches)?.open(CACHE_NAME)
  const request = options.request ?? fetch
  const subtle = options.subtle ?? crypto.subtle
  for (const asset of unique) {
    options.signal?.throwIfAborted()
    const url = gameContentUrl(asset)
    const cached = await cache?.match(url)
    if (cached) {
      let bytes: Uint8Array<ArrayBuffer>
      try {
        bytes = new Uint8Array(await cached.arrayBuffer())
      } catch {
        throw new GameModContentLoadError(
          asset.modId,
          `Could not read cached content for ${asset.modId}:${asset.path}.`,
        )
      }
      if (bytes.length === asset.byteLength && await sha256(bytes, subtle) === asset.sha256) {
        completedBytes += bytes.length
        onProgress({ active: asset, completedBytes, totalBytes })
        continue
      }
      await cache?.delete(url)
    }
    let response: Response
    try {
      response = await request(url, {
        cache: 'force-cache',
        credentials: 'same-origin',
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new GameModContentLoadError(
        asset.modId,
        `Could not download ${asset.modId}:${asset.path}.`,
      )
    }
    if (!response.ok || !response.body) {
      throw new GameModContentLoadError(
        asset.modId,
        `Could not download ${asset.modId}:${asset.path}.`,
      )
    }
    const bytes = await readResponse(
      response,
      asset,
      completedBytes,
      totalBytes,
      onProgress,
      options.signal,
    )
    if (bytes.length !== asset.byteLength || await sha256(bytes, subtle) !== asset.sha256) {
      throw new GameModContentLoadError(
        asset.modId,
        `Downloaded content failed verification: ${asset.modId}:${asset.path}.`,
      )
    }
    await cache?.put(url, new Response(bytes, {
      headers: {
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': asset.contentType,
      },
    }))
    completedBytes += bytes.length
    onProgress({ active: asset, completedBytes, totalBytes })
  }
  onProgress({ active: null, completedBytes, totalBytes })
}

export function gameContentUrl(asset: Pick<GameModAsset, 'sha256'>): string {
  return `/api/game/content/${asset.sha256}`
}

async function readResponse(
  response: Response,
  asset: GameModAsset,
  completedBefore: number,
  totalBytes: number,
  onProgress: (progress: GameContentDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body!.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    signal?.throwIfAborted()
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (received > asset.byteLength) {
      throw new GameModContentLoadError(
        asset.modId,
        `Downloaded content is too large: ${asset.modId}:${asset.path}.`,
      )
    }
    onProgress({
      active: asset,
      completedBytes: completedBefore + received,
      totalBytes,
    })
  }
  const joined = new Uint8Array(new ArrayBuffer(received))
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.length
  }
  return joined
}

async function sha256(bytes: Uint8Array<ArrayBuffer>, subtle: SubtleCrypto): Promise<string> {
  const digest = await subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function uniqueAssets(assets: readonly GameModAsset[]): readonly GameModAsset[] {
  const seen = new Map<string, GameModAsset>()
  for (const asset of assets) {
    const existing = seen.get(asset.sha256)
    if (existing && existing.byteLength !== asset.byteLength) {
      throw new GameModContentLoadError(
        asset.modId,
        `Content identity has conflicting sizes: ${asset.sha256}.`,
      )
    }
    seen.set(asset.sha256, existing ?? asset)
  }
  return [...seen.values()]
}
