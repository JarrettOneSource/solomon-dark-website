export interface AssetProgress {
  completed: number
  total: number
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
  let completed = 0
  onProgress({ completed, total: uniqueSources.length })

  await Promise.all(uniqueSources.map(async (source) => {
    await load(source)
    completed += 1
    onProgress({ completed, total: uniqueSources.length })
  }))
}
