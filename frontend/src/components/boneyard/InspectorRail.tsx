// The surveyor's ledger: plot details, or the papers of whatever is held.

import { memo } from 'react'
import type { Dispatch } from 'react'
import { sceneryLabel } from '../../editor/assets'
import type { EditorDoc, Polyline, Selection, TerrainPatch } from '../../editor/model'
import { NATIVE_LABEL, selectionSet, soleSelection } from '../../editor/model'
import type { EditorAction } from '../../editor/store'
import {
  FENCE_STYLE_LABEL,
  ROAD_STYLE_LABEL,
  ROAD_TEXTURES,
  TERRAIN_STYLE_LABEL,
  TERRAIN_TEXTURES,
} from '../../editor/textures'

interface Props {
  doc: EditorDoc
  selection: Selection
  dispatch: Dispatch<EditorAction>
  onCollapse?: () => void
}

function NumField({
  label,
  value,
  onCommit,
  step = 1,
}: {
  label: string
  value: number
  onCommit: (v: number) => void
  step?: number
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-5 font-mono text-[10px] uppercase text-bone-dim/70">{label}</span>
      <input
        type="number"
        className="input !px-2 !py-1 font-mono !text-xs"
        value={Math.round(value)}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onCommit(v)
        }}
      />
    </label>
  )
}

/** Fractional scalar field (rotation, scale, alpha) for scenery records. */
function SpriteScalar({
  label,
  value,
  step,
  onCommit,
}: {
  label: string
  value: number
  step: number
  onCommit: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-10 font-mono text-[10px] uppercase text-bone-dim/70">{label}</span>
      <input
        type="number"
        className="input !px-2 !py-1 font-mono !text-xs"
        value={Number(value.toFixed(2))}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onCommit(v)
        }}
      />
    </label>
  )
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-bone-dim/80">{k}</span>
      <span className="font-mono text-bone">{v}</span>
    </div>
  )
}

function SectionTitle({ text }: { text: string }) {
  return <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-gold">{text}</h3>
}

function EvictButton({ label, dispatch }: { label: string; dispatch: Dispatch<EditorAction> }) {
  return (
    <button
      type="button"
      className="btn btn-blood mt-4 w-full !py-2 !text-[11px]"
      onClick={() => dispatch({ type: 'delete-selection' })}
    >
      {label}
    </button>
  )
}

function lineLength(points: { x: number; y: number }[]): number {
  return Math.round(
    points.reduce((acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y)), 0),
  )
}

// Memoized, and held-piece lists come from one Set instead of a nested scan:
// this rail re-renders on every drag frame, since the doc moves under it.
export default memo(function InspectorRail({ doc, selection, dispatch, onCollapse }: Props) {
  const sole = soleSelection(selection)
  const kinds = new Set(selection.map((e) => e.kind))
  const selObject = sole?.kind === 'object' ? doc.objects.find((o) => o.eid === sole.eid) : null
  const selSprite = sole?.kind === 'sprite' ? doc.sprites.find((s) => s.eid === sole.eid) : null

  const selKeys = kinds.size === 1 ? selectionSet(selection) : null
  const heldRoads: Polyline[] =
    selKeys && kinds.has('road') ? doc.roads.filter((r) => selKeys.has(`road:${r.eid}`)) : []
  const heldFences: Polyline[] =
    selKeys && kinds.has('fence') ? doc.fences.filter((f) => selKeys.has(`fence:${f.eid}`)) : []
  const heldTerrain: TerrainPatch[] =
    selKeys && kinds.has('terrain') ? doc.terrain.filter((t) => selKeys.has(`terrain:${t.eid}`)) : []

  const groups = doc.groups ?? {}
  const anyGrouped = selection.some((e) => groups[e.eid])
  const recipes = doc.opaque.filter((c) => c.kind === 'monsterRecipe').length

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-gold/15 bg-abyss/70">
      <div className="flex items-center justify-between border-b border-gold/15 px-4 py-3">
        <div className="kicker">The ledger</div>
        {onCollapse && (
          <button
            type="button"
            title="Tuck the ledger away"
            aria-label="Collapse the ledger"
            className="rounded px-1.5 py-0.5 text-xs text-bone-dim hover:bg-gold/10 hover:text-gold-bright"
            onClick={onCollapse}
          >
            ❯
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {selObject || selSprite ? (
          <section>
            <SectionTitle
              text={selObject ? (NATIVE_LABEL[selObject.typeId] ?? `Class ${selObject.typeId}`) : 'Scenery sprite'}
            />
            <p className="text-fell mt-0.5 text-[11px] text-bone-dim/70">
              {(() => {
                const it = (selObject ?? selSprite)!
                if (!it.sprite) return 'Papers pending.'
                const label = sceneryLabel(it.sprite.atlas, it.sprite.entry)
                const variant = selObject?.variant !== undefined ? ` · variant ${selObject.variant}` : ''
                return `${label ? `${label} · ` : ''}${it.sprite.atlas} ${it.sprite.entry}${variant}`
              })()}
            </p>
            <div className="mt-3 space-y-2">
              <NumField
                label="x"
                value={(selObject ?? selSprite)!.pos.x}
                onCommit={(x) =>
                  dispatch({ type: 'move-item', sel: sole!, pos: { x, y: (selObject ?? selSprite)!.pos.y } })
                }
              />
              <NumField
                label="y"
                value={(selObject ?? selSprite)!.pos.y}
                onCommit={(y) =>
                  dispatch({ type: 'move-item', sel: sole!, pos: { x: (selObject ?? selSprite)!.pos.x, y } })
                }
              />
            </div>
            {selSprite && (
              <div className="mt-3 space-y-2 border-t border-gold/10 pt-3">
                <SpriteScalar
                  label="rot°"
                  value={selSprite.s0}
                  step={15}
                  onCommit={(v) => dispatch({ type: 'set-sprite-props', eid: selSprite.eid, patch: { s0: v } })}
                />
                <SpriteScalar
                  label="scale"
                  value={selSprite.s1}
                  step={0.1}
                  onCommit={(v) => dispatch({ type: 'set-sprite-props', eid: selSprite.eid, patch: { s1: Math.max(0.1, v) } })}
                />
                <SpriteScalar
                  label="alpha"
                  value={selSprite.s2}
                  step={0.1}
                  onCommit={(v) => dispatch({ type: 'set-sprite-props', eid: selSprite.eid, patch: { s2: Math.min(1, Math.max(0.05, v)) } })}
                />
              </div>
            )}
            <EvictButton label="Evict" dispatch={dispatch} />
          </section>
        ) : heldRoads.length > 0 ? (
          <section>
            <SectionTitle text={heldRoads.length === 1 ? 'Road segment' : 'Road'} />
            <div className="mt-3 space-y-1.5">
              <Row k="Segments" v={heldRoads.length} />
              <Row k="Length" v={`${heldRoads.reduce((acc, r) => acc + lineLength(r.points), 0)} u`} />
            </div>
            <div className="mt-3 border-t border-gold/10 pt-3">
              <span className="label">Surface</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ROAD_TEXTURES.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    title={ROAD_STYLE_LABEL[i]}
                    aria-pressed={heldRoads.every((r) => (r.style ?? 0) === i)}
                    onClick={() => dispatch({ type: 'set-line-props', entries: selection, patch: { style: i } })}
                    className={`h-8 w-10 rounded-sm border bg-cover bg-center ${
                      heldRoads.every((r) => (r.style ?? 0) === i)
                        ? 'border-gold/80 shadow-[0_0_10px_rgba(200,168,98,.35)]'
                        : 'border-black/60 opacity-75 hover:border-gold/40 hover:opacity-100'
                    }`}
                    style={{ backgroundImage: `url(${src})` }}
                  />
                ))}
              </div>
            </div>
            <EvictButton label="Tear out" dispatch={dispatch} />
          </section>
        ) : heldFences.length > 0 ? (
          <section>
            <SectionTitle text={heldFences.length === 1 ? 'Fence segment' : 'Fence'} />
            <div className="mt-3 space-y-1.5">
              <Row k="Segments" v={heldFences.length} />
              <Row k="Length" v={`${heldFences.reduce((acc, f) => acc + lineLength(f.points), 0)} u`} />
            </div>
            <div className="mt-3 border-t border-gold/10 pt-3">
              <span className="label">Make</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {FENCE_STYLE_LABEL.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={heldFences.every((f) => (f.segmentCode ?? f.style ?? 0) === i)}
                    onClick={() => dispatch({ type: 'set-line-props', entries: selection, patch: { segmentCode: i, style: i } })}
                    className={`rounded-sm border px-2 py-1 font-display text-[10px] font-bold uppercase tracking-[0.1em] ${
                      heldFences.every((f) => (f.segmentCode ?? f.style ?? 0) === i)
                        ? 'border-gold/70 text-gold-bright'
                        : 'border-black/60 text-bone hover:border-gold/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <EvictButton label="Tear out" dispatch={dispatch} />
          </section>
        ) : heldTerrain.length > 0 ? (
          <section>
            <SectionTitle text={heldTerrain.length === 1 ? 'Terrain cut' : 'Terrain'} />
            <div className="mt-3 space-y-1.5">
              <Row k="Cuts" v={heldTerrain.length} />
              <Row
                k="Length"
                v={`${heldTerrain.reduce((acc, t) => acc + lineLength(t.points ?? [t.pos]), 0)} u`}
              />
            </div>
            <div className="mt-3 border-t border-gold/10 pt-3">
              <span className="label">Cut</span>
              <div className="mt-1.5 flex gap-1.5">
                {TERRAIN_TEXTURES.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    title={TERRAIN_STYLE_LABEL[i]}
                    aria-pressed={heldTerrain.every((t) => (t.style ?? t.entry ?? 0) === i)}
                    onClick={() => dispatch({ type: 'set-terrain-props', entries: selection, patch: { style: i } })}
                    className={`h-8 w-10 rounded-sm border bg-cover bg-center ${
                      heldTerrain.every((t) => (t.style ?? t.entry ?? 0) === i)
                        ? 'border-gold/80 shadow-[0_0_10px_rgba(200,168,98,.35)]'
                        : 'border-black/60 opacity-75 hover:border-gold/40 hover:opacity-100'
                    }`}
                    style={{ backgroundImage: `url(${src})` }}
                  />
                ))}
              </div>
            </div>
            <EvictButton label="Fill in" dispatch={dispatch} />
          </section>
        ) : selection.length > 1 ? (
          <section>
            <SectionTitle text="The held" />
            <div className="mt-3 space-y-1.5">
              <Row k="Pieces" v={selection.length} />
              {(['object', 'sprite', 'road', 'fence', 'terrain'] as const).map((k) => {
                const n = selection.filter((e) => e.kind === k).length
                if (n === 0) return null
                const label = { object: 'Placed', sprite: 'Scenery', road: 'Road segments', fence: 'Fence segments', terrain: 'Terrain cuts' }[k]
                return <Row key={k} k={label} v={n} />
              })}
            </div>
            <div className="mt-3 flex gap-2 border-t border-gold/10 pt-3">
              <button
                type="button"
                className="btn btn-stone flex-1 !py-2 !text-[11px]"
                disabled={selection.length < 2}
                onClick={() => dispatch({ type: 'group-selection' })}
              >
                Group
              </button>
              <button
                type="button"
                className="btn btn-stone flex-1 !py-2 !text-[11px]"
                disabled={!anyGrouped}
                onClick={() => dispatch({ type: 'ungroup-selection' })}
              >
                Ungroup
              </button>
            </div>
            {anyGrouped && (
              <p className="text-fell mt-2 text-[11px] text-bone-dim/60">
                Bound together: picking one holds the lot.
              </p>
            )}
            <EvictButton label="Evict all" dispatch={dispatch} />
          </section>
        ) : (
          <section>
            <SectionTitle text="The plot" />
            <label className="mt-3 block">
              <span className="label">Name</span>
              <input
                className="input"
                value={doc.meta.name}
                maxLength={48}
                onChange={(e) => dispatch({ type: 'set-name', name: e.target.value })}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NumField
                label="w"
                value={doc.meta.bounds.w}
                step={64}
                onCommit={(w) => {
                  const width = Math.max(512, Math.min(16384, w))
                  dispatch({ type: 'set-bounds', bounds: { ...doc.meta.bounds, x: -width / 2, w: width } })
                }}
              />
              <NumField
                label="h"
                value={doc.meta.bounds.h}
                step={64}
                onCommit={(h) => {
                  const height = Math.max(512, Math.min(16384, h))
                  dispatch({ type: 'set-bounds', bounds: { ...doc.meta.bounds, y: -height / 2, h: height } })
                }}
              />
            </div>
            <p className="text-fell mt-1.5 text-[11px] text-bone-dim/60">
              The plot stays centred on the origin, as the stock grounds are.
            </p>
            <div className="mt-4 space-y-1.5 border-t border-gold/10 pt-3">
              <Row k="Placed pieces" v={doc.objects.length} />
              <Row k="Scenery sprites" v={doc.sprites.length} />
              <Row k="Road segments" v={doc.roads.length} />
              <Row k="Fence segments" v={doc.fences.length} />
              <Row k="Terrain cuts" v={doc.terrain.length} />
            </div>
          </section>
        )}

        <section className="border-t border-gold/10 pt-4">
          <SectionTitle text="The waves" />
          <p className="text-fell mt-1.5 text-[11px] leading-relaxed text-bone-dim/70">
            {recipes > 0
              ? `${recipes} spawn ${recipes === 1 ? 'recipe rides' : 'recipes ride'} along untouched. Wave authoring opens when the format layer clears it.`
              : 'New plots defer to the generator: it writes the waves, you write the scenery. Wave authoring arrives with the format layer.'}
          </p>
        </section>
      </div>
    </aside>
  )
})
