export interface AssetProgress {
  activeSource: string | null
  completed: number
  total: number
}

export interface AssetBatch<Stage> {
  load: (source: string) => Promise<unknown>
  sources: readonly string[]
  stage: Stage
}

export interface StagedAssetProgress<Stage> extends AssetProgress {
  stage: Stage
}

type AssetTree = string | readonly AssetTree[] | { readonly [key: string]: AssetTree }

export function collectAssetSources(tree: AssetTree): string[] {
  const sources: string[] = []
  const seen = new Set<string>()

  const visit = (node: AssetTree) => {
    if (typeof node === 'string') {
      if (!seen.has(node)) {
        seen.add(node)
        sources.push(node)
      }
      return
    }
    for (const child of Array.isArray(node) ? node : Object.values(node)) visit(child)
  }

  visit(tree)
  return sources
}

export async function loadAssetBatch(
  sources: readonly string[],
  load: (source: string) => Promise<unknown>,
  onProgress: (progress: AssetProgress) => void,
): Promise<void> {
  const uniqueSources = [...new Set(sources)]
  const pending = new Set(uniqueSources)
  let completed = 0
  onProgress({
    activeSource: firstPendingSource(pending),
    completed,
    total: uniqueSources.length,
  })

  await Promise.all(uniqueSources.map(async (source) => {
    await load(source)
    pending.delete(source)
    completed += 1
    onProgress({
      activeSource: firstPendingSource(pending),
      completed,
      total: uniqueSources.length,
    })
  }))
}

export async function loadAssetBatches<Stage>(
  batches: readonly AssetBatch<Stage>[],
  onProgress: (progress: StagedAssetProgress<Stage>) => void,
): Promise<void> {
  const seen = new Set<string>()
  const plannedBatches = batches.map((batch) => ({
    ...batch,
    sources: batch.sources.filter((source) => {
      if (seen.has(source)) return false
      seen.add(source)
      return true
    }),
  }))
  const total = plannedBatches.reduce((sum, batch) => sum + batch.sources.length, 0)
  let completedBeforeBatch = 0

  for (const batch of plannedBatches) {
    await loadAssetBatch(batch.sources, batch.load, (progress) => {
      onProgress({
        ...progress,
        completed: completedBeforeBatch + progress.completed,
        stage: batch.stage,
        total,
      })
    })
    completedBeforeBatch += batch.sources.length
  }
}

export function assetDisplayName(source: string): string {
  const path = source.split(/[?#]/, 1)[0]
  const encodedName = path.slice(path.lastIndexOf('/') + 1)
  return decodeURIComponent(encodedName)
    .replace(/-[A-Za-z0-9_-]{8}(?=\.[^.]+$)/, '')
}

function firstPendingSource(pending: ReadonlySet<string>): string | null {
  return pending.values().next().value ?? null
}
