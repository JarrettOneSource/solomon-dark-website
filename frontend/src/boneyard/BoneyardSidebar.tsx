import { formatBytes } from '../lib/format'
import type {
  BoneyardDocument,
  BoneyardLayers,
  SceneSelection,
} from './model.ts'

type LayerKey = keyof BoneyardLayers

const LAYERS: readonly Readonly<{
  key: LayerKey
  label: string
  color: string
}>[] = [
  { key: 'terrain', label: 'Terrain', color: '#7fb35f' },
  { key: 'roads', label: 'Roads', color: '#c8a862' },
  { key: 'fences', label: 'Fences', color: '#d1b978' },
  { key: 'sprites', label: 'Ground detail', color: '#8fa56f' },
  { key: 'objects', label: 'World objects', color: '#b45fe0' },
  { key: 'spawn', label: 'Player spawn', color: '#41e3ff' },
  { key: 'grid', label: 'Coordinate grid', color: '#6d6774' },
]

function countForLayer(document: BoneyardDocument, key: LayerKey): number | null {
  switch (key) {
    case 'terrain': return document.scene.terrain.length
    case 'roads': return document.scene.roads.length
    case 'fences': return document.scene.fences.length
    case 'sprites': return document.scene.sprites.length
    case 'objects': return document.scene.worldObjects.length
    case 'spawn': return 1
    case 'grid': return null
  }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <dt className="text-xs text-bone-dim/70">{label}</dt>
      <dd className="font-mono text-[11px] text-bone">{value}</dd>
    </div>
  )
}

export function BoneyardLayersPanel({
  document,
  fileName,
  sha256,
  layers,
  onLayerChange,
}: Readonly<{
  document: BoneyardDocument
  fileName: string
  sha256: string
  layers: BoneyardLayers
  onLayerChange: (key: LayerKey, value: boolean) => void
}>) {
  const bounds = document.scene.bounds
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0d0b11]">
      <section className="border-b border-gold/15 p-4">
        <div className="kicker text-[10px]">Loaded Boneyard</div>
        <h2 className="mt-1 truncate font-display text-base font-bold text-gold-bright" title={document.internalName}>
          {document.internalName}
        </h2>
        <div className="mt-1 truncate font-mono text-[10px] text-bone-dim/65" title={fileName}>{fileName}</div>
        <dl className="mt-4">
          <Stat label="File size" value={formatBytes(document.stats.bytes)} />
          <Stat label="Sync chunks" value={document.stats.chunks.toLocaleString()} />
          <Stat label="Max depth" value={document.stats.maxDepth} />
          <Stat label="Named buffers" value={document.stats.namedBuffers} />
          <Stat
            label="Map span"
            value={`${Math.round(bounds.maxX - bounds.minX)} × ${Math.round(bounds.maxY - bounds.minY)}`}
          />
        </dl>
        <div className="mt-3 truncate font-mono text-[9px] text-bone-dim/45" title={sha256}>
          sha256 {sha256 || 'calculating…'}
        </div>
      </section>

      <section className="p-4">
        <div className="kicker mb-3 text-[10px]">Map layers</div>
        <div className="space-y-1">
          {LAYERS.map((layer) => {
            const count = countForLayer(document, layer.key)
            return (
              <label
                key={layer.key}
                className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 text-sm transition-colors hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={layers[layer.key]}
                  onChange={(event) => onLayerChange(layer.key, event.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`h-3 w-3 rounded-sm border transition-opacity ${layers[layer.key] ? 'opacity-100' : 'opacity-25'}`}
                  style={{ backgroundColor: layer.color, borderColor: layer.color }}
                />
                <span className={layers[layer.key] ? 'text-bone' : 'text-bone-dim/50'}>{layer.label}</span>
                {count !== null && <span className="ml-auto font-mono text-[10px] text-bone-dim/55">{count}</span>}
              </label>
            )
          })}
        </div>
      </section>

      {document.diagnostics.length > 0 && (
        <section className="mt-auto border-t border-gold/15 p-4">
          <div className="kicker mb-2 text-[10px] text-gold">Opaque records</div>
          <ul className="space-y-1 text-xs leading-relaxed text-bone-dim">
            {document.diagnostics.map((message) => <li key={message}>• {message}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}

function selectionTitle(selection: SceneSelection): string {
  switch (selection.kind) {
    case 'spawn': return 'Player spawn'
    case 'worldObject': return selection.typeName
    case 'road': return `Road ${selection.index + 1}`
    case 'fence': return `Fence ${selection.index + 1}`
    case 'terrain': return `Terrain ${selection.index + 1}`
    case 'sprite': return `Ground detail ${selection.index + 1}`
  }
}

export function BoneyardSelectionPanel({ selection }: Readonly<{ selection: SceneSelection | null }>) {
  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0d0b11] p-7 text-center">
        <div className="text-3xl text-gold/30">⌖</div>
        <div className="mt-3 font-display text-xs font-bold uppercase tracking-[0.18em] text-gold/75">
          Inspect the grounds
        </div>
        <p className="mt-2 max-w-48 text-xs leading-relaxed text-bone-dim/60">
          Select an object, road, fence, terrain region, or ground detail on the map.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0d0b11] p-4">
      <div className="kicker text-[10px]">Native record</div>
      <h2 className="mt-1 font-display text-base font-bold text-gold-bright">{selectionTitle(selection)}</h2>
      <dl className="mt-4">
        {selection.kind === 'spawn' && (
          <>
            <Stat label="Position" value={`${selection.position.x.toFixed(2)}, ${selection.position.y.toFixed(2)}`} />
            <Stat label="Direction" value={`${selection.direction.toFixed(2)}°`} />
          </>
        )}
        {selection.kind === 'worldObject' && (
          <>
            <Stat label="Type ID" value={selection.typeId} />
            <Stat label="Object index" value={selection.index} />
            <Stat label="Position" value={`${selection.position.x.toFixed(2)}, ${selection.position.y.toFixed(2)}`} />
            <Stat label="Velocity" value={`${selection.velocity.x.toFixed(2)}, ${selection.velocity.y.toFixed(2)}`} />
            <Stat label="Variant" value={selection.variant ?? '—'} />
            <Stat label="Sync chunks" value={selection.chunks.length} />
            <Stat label="First byte" value={selection.chunks[0]?.offset ?? '—'} />
          </>
        )}
        {selection.kind === 'road' && (
          <>
            <Stat label="UID" value={selection.uid} />
            <Stat label="Style" value={selection.style} />
            <Stat label="Start" value={`${selection.start.x.toFixed(2)}, ${selection.start.y.toFixed(2)}`} />
            <Stat label="End" value={`${selection.end.x.toFixed(2)}, ${selection.end.y.toFixed(2)}`} />
            <Stat label="Previous UID" value={selection.previousUid ?? '—'} />
            <Stat label="Next UID" value={selection.nextUid ?? '—'} />
            <Stat label="End scales" value={`${selection.startScale.toFixed(2)} / ${selection.endScale.toFixed(2)}`} />
            <Stat label="Payload byte" value={selection.chunk.offset} />
          </>
        )}
        {selection.kind === 'fence' && (
          <>
            <Stat label="UID" value={selection.uid} />
            <Stat label="Style" value={selection.style} />
            <Stat label="Start" value={`${selection.start.x.toFixed(2)}, ${selection.start.y.toFixed(2)}`} />
            <Stat label="End" value={`${selection.end.x.toFixed(2)}, ${selection.end.y.toFixed(2)}`} />
            <Stat label="Previous UID" value={selection.previousUid ?? '—'} />
            <Stat label="Next UID" value={selection.nextUid ?? '—'} />
            <Stat label="Payload byte" value={selection.chunk.offset} />
          </>
        )}
        {selection.kind === 'terrain' && (
          <>
            <Stat label="UID" value={selection.uid} />
            <Stat label="Mode" value={selection.mode} />
            <Stat label="Vertices" value={selection.points.length} />
            <Stat label="Weights" value={selection.weights.length} />
            <Stat label="Scale" value={selection.scale.toFixed(3)} />
            <Stat label="Payload byte" value={selection.chunk.offset} />
          </>
        )}
        {selection.kind === 'sprite' && (
          <>
            <Stat label="Atlas entry" value={selection.atlasEntryId} />
            <Stat label="Position" value={`${selection.position.x.toFixed(2)}, ${selection.position.y.toFixed(2)}`} />
            <Stat label="Rotation" value={`${selection.rotation.toFixed(2)}°`} />
            <Stat label="Scale" value={`${selection.scaleX.toFixed(3)} × ${selection.scaleY.toFixed(3)}`} />
            <Stat label="Flags" value={`0x${selection.flags.toString(16).padStart(2, '0')}`} />
          </>
        )}
      </dl>

      <div className="mt-6 rounded border border-arcane/15 bg-arcane/5 p-3 text-[11px] leading-relaxed text-bone-dim/65">
        These values come directly from the retail SyncBuffer. The viewer never rewrites the file.
      </div>
    </div>
  )
}
