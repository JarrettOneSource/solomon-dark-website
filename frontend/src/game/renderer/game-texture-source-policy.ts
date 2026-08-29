export type GameTextureSourcePolicy = 'composited' | 'stock' | 'stock-point'

export interface GameTextureSourceGroups {
  readonly composited?: readonly string[]
  readonly stock?: readonly string[]
  readonly stockPoint?: readonly string[]
}

export interface GameTextureSourcePlan {
  readonly policies: Readonly<Record<string, GameTextureSourcePolicy>>
  readonly sources: readonly string[]
}

export function planGameTextureSources(
  groups: GameTextureSourceGroups,
): GameTextureSourcePlan {
  const sources: string[] = []
  const policies: Record<string, GameTextureSourcePolicy> = {}
  const add = (policy: GameTextureSourcePolicy, members: readonly string[] = []) => {
    for (const source of members) {
      if (source.length === 0) throw new RangeError('game texture source must not be empty')
      const existing = policies[source]
      if (existing) {
        throw new RangeError(
          `game texture source is classified as both ${existing} and ${policy}: ${source}`,
        )
      }
      policies[source] = policy
      sources.push(source)
    }
  }

  add('stock', groups.stock)
  add('stock-point', groups.stockPoint)
  add('composited', groups.composited)
  if (sources.length === 0) throw new RangeError('game texture source plan must not be empty')
  return {
    policies: Object.freeze(policies),
    sources: Object.freeze(sources),
  }
}
