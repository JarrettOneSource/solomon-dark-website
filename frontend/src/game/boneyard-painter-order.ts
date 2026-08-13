export interface StaticPainterLayer {
  layerIndex: number
  worldY: number
  sortBias: number
  sourceOrder: number
}

export interface DynamicPainterLayer {
  id: string
  worldY: number
  sortBias: number
  sourceOrder: number
}

export interface StaticPainterBand {
  id: string
  layerIndexes: number[]
  row: number
  zIndex: number
}

export interface PositionedDynamicLayer {
  id: string
  row: number
  zIndex: number
}

export interface BoneyardPainterOrder {
  bands: StaticPainterBand[]
  dynamicLayers: PositionedDynamicLayer[]
  foregroundZIndex: number
}

interface StaticEntry extends StaticPainterLayer {
  kind: 'static'
  row: number
}

interface DynamicEntry extends DynamicPainterLayer {
  kind: 'dynamic'
  row: number
}

type PainterEntry = StaticEntry | DynamicEntry

export function nativePainterRow(worldY: number, sortBias: number, referenceY: number): number {
  const relative = Math.trunc(worldY) + Math.trunc(sortBias) - Math.trunc(referenceY)
  return Math.trunc(relative / 2)
}

export function buildBoneyardPainterOrder({
  referenceY,
  staticLayers,
  dynamicLayers,
}: {
  referenceY: number
  staticLayers: readonly StaticPainterLayer[]
  dynamicLayers: readonly DynamicPainterLayer[]
}): BoneyardPainterOrder {
  const entries: PainterEntry[] = [
    ...dynamicLayers.map((layer): DynamicEntry => ({
      ...layer,
      kind: 'dynamic',
      row: nativePainterRow(layer.worldY, layer.sortBias, referenceY),
    })),
    ...staticLayers.map((layer): StaticEntry => ({
      ...layer,
      kind: 'static',
      row: nativePainterRow(layer.worldY, layer.sortBias, referenceY),
    })),
  ]
  entries.sort((left, right) => (
    left.row - right.row
    || Number(left.kind === 'static') - Number(right.kind === 'static')
    || left.sourceOrder - right.sourceOrder
  ))

  const bands: StaticPainterBand[] = []
  const positionedDynamics: PositionedDynamicLayer[] = []
  let pendingStatic: StaticPainterBand | null = null
  let zIndex = 1

  const flushStatic = () => {
    if (!pendingStatic) return
    bands.push(pendingStatic)
    pendingStatic = null
    zIndex += 1
  }

  for (const entry of entries) {
    if (entry.kind === 'static') {
      pendingStatic ??= {
        id: `static-${bands.length}`,
        layerIndexes: [],
        row: entry.row,
        zIndex,
      }
      pendingStatic.layerIndexes.push(entry.layerIndex)
      continue
    }

    flushStatic()
    positionedDynamics.push({ id: entry.id, row: entry.row, zIndex })
    zIndex += 1
  }
  flushStatic()

  return {
    bands,
    dynamicLayers: positionedDynamics,
    foregroundZIndex: zIndex,
  }
}
