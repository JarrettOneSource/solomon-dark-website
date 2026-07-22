// The Boneyard: draft your own acre of the grounds. A full-screen drafting
// table: palette on the left, the dig site in the middle, ledger on the right.
//
// The editor works on the semantic doc (src/editor/model.ts); the native
// .boneyard byte layer plugs in behind src/editor/io.ts.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PaletteItem } from '../editor/assets'
import CanvasStage, { type StageHandle } from '../components/boneyard/CanvasStage'
import DraftsDrawer from '../components/boneyard/DraftsDrawer'
import InspectorRail from '../components/boneyard/InspectorRail'
import PaletteRail from '../components/boneyard/PaletteRail'
import PublishDialog from '../components/boneyard/PublishDialog'
import Toolbar from '../components/boneyard/Toolbar'
import { EmptyState } from '../components/ui'
import { findPaletteItem } from '../editor/assets'
import {
  bytesToBase64,
  compileNative,
  docFileValue,
  downloadBlob,
  exportDocJson,
  formatReady,
  importDocJson,
  importNative,
} from '../editor/io'
import type { EditorDoc } from '../editor/model'
import { NATIVE_LABEL, countResidents, createDoc } from '../editor/model'
import type { Tool, ToolStyles } from '../editor/render'
import {
  cloudIdFor,
  initialState,
  listDrafts,
  loadDraft,
  newDraftId,
  reducer,
  saveDraft,
  setCloudId,
} from '../editor/store'
import { playSound } from '../fx/sounds'
import { api } from '../lib/api'
import { art } from '../lib/assets'
import { useAuth } from '../lib/auth'

const NEW_NAMES = [
  'Untitled Acre',
  'The Back Forty',
  'Plot 13',
  'The New Annex',
  'Unconsecrated Ground',
]

function freshDoc() {
  return createDoc(NEW_NAMES[Math.floor(Math.random() * NEW_NAMES.length)])
}

const RAIL_L_KEY = 'sdr:boneyard:railL'
const RAIL_R_KEY = 'sdr:boneyard:railR'
const RAIL_L_DEFAULT = 248
const RAIL_R_DEFAULT = 288
const RAIL_MIN = 180
const RAIL_MAX = 460

function storedRailWidth(key: string, fallback: number): number {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  const v = Number(raw)
  return Number.isFinite(v) && (v === 0 || (v >= RAIL_MIN && v <= RAIL_MAX)) ? v : fallback
}

function MenuItem({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string
  hint?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={hint}
      onClick={onClick}
      className="block w-full px-3.5 py-2 text-left font-display text-[11px] font-bold uppercase tracking-[0.14em] text-bone transition-colors hover:bg-gold/10 hover:text-gold-bright disabled:pointer-events-none disabled:opacity-40"
    >
      {label}
    </button>
  )
}

export default function Boneyard() {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => {
      const last = listDrafts()[0]
      if (last) {
        const doc = loadDraft(last.id)
        if (doc) return { ...initialState(last.id, doc), savedAt: last.updatedAt }
      }
      return initialState(newDraftId(), freshDoc())
    },
  )
  const [tool, setTool] = useState<Tool>('select')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [snap, setSnap] = useState(true)
  const [grid, setGrid] = useState(true)
  const [styles, setStyles] = useState<ToolStyles>({
    road: 0,
    roadWidth: 1,
    fence: 0,
    terrain: 0,
    brushRadius: 96,
    brushDensity: 3,
    eraseRadius: 48,
  })
  const [chestOpen, setChestOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [annalsBusy, setAnnalsBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [deskOpen, setDeskOpen] = useState(false)
  const [leftW, setLeftW] = useState<number>(() => storedRailWidth(RAIL_L_KEY, RAIL_L_DEFAULT))
  const [rightW, setRightW] = useState<number>(() => storedRailWidth(RAIL_R_KEY, RAIL_R_DEFAULT))
  const leftWRef = useRef(leftW)
  leftWRef.current = leftW
  const rightWRef = useRef(rightW)
  rightWRef.current = rightW
  const stageRef = useRef<StageHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const activeItem = findPaletteItem(activeKey)
  const placeLabel = activeItem
    ? activeItem.kind === 'object' && activeItem.typeId !== undefined
      ? `${NATIVE_LABEL[activeItem.typeId] ?? 'piece'} · ${activeItem.label}`
      : activeItem.label
    : null

  // Live mirrors so the memoized rails get callbacks that never change
  // identity: a gesture on the stage must not re-render the catalogue.
  const toolRef = useRef(tool)
  toolRef.current = tool
  const activeKeyRef = useRef(activeKey)
  activeKeyRef.current = activeKey

  // Rail widths land in localStorage a beat after the drag settles, not on
  // every pointer move of the gutter.
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(RAIL_L_KEY, String(leftW)), 250)
    return () => clearTimeout(t)
  }, [leftW])
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(RAIL_R_KEY, String(rightW)), 250)
    return () => clearTimeout(t)
  }, [rightW])

  // Rail gutters: drag to size, drag small to tuck away, double-click resets.
  const startRailDrag = useCallback((side: 'left' | 'right') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const base = side === 'left' ? leftWRef.current : rightWRef.current
    const apply = side === 'left' ? setLeftW : setRightW
    const onMove = (ev: PointerEvent) => {
      const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX
      const raw = base + delta
      apply(raw < 110 ? 0 : Math.min(RAIL_MAX, Math.max(RAIL_MIN, raw)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  const say = useCallback((line: string) => {
    setNotice(line)
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  // The quill keeps up on its own: drafts ink themselves shortly after edits.
  useEffect(() => {
    if (!state.dirty) return
    const t = setTimeout(() => {
      saveDraft(state.draftId, state.doc, countResidents(state.doc))
      dispatch({ type: 'mark-saved', at: Date.now() })
    }, 800)
    return () => clearTimeout(t)
  }, [state.doc, state.dirty, state.draftId])

  // The keyboard: tools, history, housekeeping. Arrows nudge the held
  // pieces, or walk the camera when the hands are empty.
  const hasSelection = state.selection.length > 0
  useEffect(() => {
    const arrow = (dx: number, dy: number, fine: boolean) => {
      if (hasSelection) dispatch({ type: 'nudge', dx: fine ? Math.sign(dx) : dx, dy: fine ? Math.sign(dy) : dy })
      else stageRef.current?.panBy(dx * 10, dy * 10)
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault()
            dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
            return
          case 'y':
            e.preventDefault()
            dispatch({ type: 'redo' })
            return
          case 'a':
            e.preventDefault()
            dispatch({ type: 'select-all' })
            return
          case 'd':
            e.preventDefault()
            dispatch({ type: 'duplicate-selection' })
            return
          case 'g':
            e.preventDefault()
            dispatch({ type: e.shiftKey ? 'ungroup-selection' : 'group-selection' })
            return
        }
        return
      }
      if (e.altKey) return

      switch (e.key) {
        case 'v': case 'V': setTool('select'); break
        case 'b': case 'B': setTool('place'); break
        case 'p': case 'P': setTool('brush'); break
        case 'e': case 'E': setTool('erase'); break
        case 'h': case 'H': setTool('pan'); break
        case 'r': case 'R': setTool('road'); break
        case 'f': case 'F': setTool('fence'); break
        case 't': case 'T': setTool('terrain'); break
        case 'g': case 'G': setSnap((s) => !s); break
        case 'Delete':
        case 'Backspace':
          dispatch({ type: 'delete-selection' })
          break
        case 'Escape':
          dispatch({ type: 'select', sel: [] })
          if (tool === 'place' || tool === 'brush') {
            setTool('select')
            setActiveKey(null)
          }
          break
        case 'ArrowUp': e.preventDefault(); arrow(0, -16, e.shiftKey); break
        case 'ArrowDown': e.preventDefault(); arrow(0, 16, e.shiftKey); break
        case 'ArrowLeft': e.preventDefault(); arrow(-16, 0, e.shiftKey); break
        case 'ArrowRight': e.preventDefault(); arrow(16, 0, e.shiftKey); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool, hasSelection])

  const openDraft = useCallback((id: string) => {
    const doc = loadDraft(id)
    if (!doc) {
      say('That draft would not open. The chest keeps its secrets.')
      return
    }
    dispatch({ type: 'load-doc', doc, draftId: id })
    setChestOpen(false)
  }, [say])

  const breakNewGround = useCallback(() => {
    dispatch({ type: 'new-doc', name: freshDoc().meta.name, draftId: newDraftId() })
    setChestOpen(false)
  }, [])

  const openCloud = useCallback((doc: EditorDoc, cloudId: number, name: string) => {
    const id = newDraftId()
    dispatch({ type: 'load-doc', doc, draftId: id })
    setCloudId(id, cloudId)
    setChestOpen(false)
    say(`${name} came down from the Annals.`)
  }, [say])

  // Lodge the current draft in the Annals: create once, then last-write-wins.
  const sendToAnnals = useCallback(async () => {
    if (!user || annalsBusy) return
    setAnnalsBusy(true)
    try {
      let compiled: string | undefined
      if (formatReady()) {
        try {
          compiled = bytesToBase64(await compileNative(state.doc))
        } catch {
          compiled = undefined
        }
      }
      let cloudId = cloudIdFor(state.draftId)
      if (cloudId === null) {
        const created = await api.boneyards.create(state.doc.meta.name || 'Untitled Acre')
        cloudId = created.id
        setCloudId(state.draftId, cloudId)
      }
      await api.boneyards.update(cloudId, {
        name: state.doc.meta.name || undefined,
        document: docFileValue(state.doc),
        ...(compiled !== undefined ? { compiledBoneyard: compiled } : {}),
      })
      say('The Annals hold it now. The chronicler sends regards.')
    } catch (err) {
      say(err instanceof Error ? err.message : 'The Annals are not answering.')
    } finally {
      setAnnalsBusy(false)
    }
  }, [user, annalsBusy, state.doc, state.draftId, say])

  const onImportFile = useCallback(async (file: File) => {
    try {
      if (file.name.endsWith('.boneyard')) {
        const doc = importNative(new Uint8Array(await file.arrayBuffer()))
        dispatch({ type: 'load-doc', doc, draftId: newDraftId() })
        say(`Opened ${file.name}. Handle with the respect the dead prefer.`)
      } else {
        const doc = importDocJson(await file.text())
        dispatch({ type: 'load-doc', doc, draftId: newDraftId() })
        say(`Draft ${file.name} restored from paper.`)
      }
    } catch (err) {
      say(err instanceof Error ? err.message : 'That file declined to be read.')
    }
  }, [say])

  const exportJson = useCallback(() => {
    const name = state.doc.meta.name.trim().replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-') || 'boneyard'
    downloadBlob(`${name}.sdr-boneyard.json`, exportDocJson(state.doc), 'application/json')
    playSound('tomeGet', 0.14)
  }, [state.doc])

  const exportBoneyard = useCallback(async () => {
    try {
      const bytes = await compileNative(state.doc)
      const name = state.doc.meta.name.trim().replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-') || 'boneyard'
      downloadBlob(`${name}.boneyard`, bytes, 'application/octet-stream')
      playSound('tomeGet', 0.14)
    } catch (err) {
      say(err instanceof Error ? err.message : 'The compiler declined.')
    }
  }, [state.doc, say])

  // Stable handlers for the memoized chrome: identity never changes, so
  // stage gestures re-render only the stage.
  const onPalettePick = useCallback((item: PaletteItem) => {
    const t = toolRef.current
    if (activeKeyRef.current === item.key && (t === 'place' || t === 'brush')) {
      setActiveKey(null)
      setTool('select')
    } else {
      setActiveKey(item.key)
      setTool((prev) => (prev === 'brush' ? 'brush' : 'place'))
    }
  }, [])
  const collapseLeft = useCallback(() => setLeftW(0), [])
  const collapseRight = useCallback(() => setRightW(0), [])
  const onStyles = useCallback((patch: Partial<ToolStyles>) => setStyles((s) => ({ ...s, ...patch })), [])
  const onUndo = useCallback(() => dispatch({ type: 'undo' }), [])
  const onRedo = useCallback(() => dispatch({ type: 'redo' }), [])
  const onSnap = useCallback(() => setSnap((s) => !s), [])
  const onGrid = useCallback(() => setGrid((g) => !g), [])
  const onGroup = useCallback(() => dispatch({ type: 'group-selection' }), [])
  const onUngroup = useCallback(() => dispatch({ type: 'ungroup-selection' }), [])
  const onDuplicate = useCallback(() => dispatch({ type: 'duplicate-selection' }), [])
  const onDelete = useCallback(() => dispatch({ type: 'delete-selection' }), [])
  const onPlaced = useCallback(() => playSound('poof', 0.1), [])
  const onDeleted = useCallback(() => playSound('bonecrack', 0.14), [])
  const onExitPlace = useCallback(() => {
    setTool('select')
    setActiveKey(null)
  }, [])

  const publishTitle = !user
    ? 'Publishing wants a signed-in wizard.'
    : !formatReady()
      ? 'Publishing opens when the native compiler leaves the vault.'
      : 'Publish this plot to the Library.'

  const groups = state.doc.groups ?? {}
  const selectionGrouped = state.selection.some((e) => groups[e.eid])

  return (
    <div className="flex h-full flex-col">
      {/* the drafting-table header: the way home, the plot's papers, the desk */}
      <div className="flex items-center gap-3 border-b border-gold/15 bg-abyss/80 px-3 py-1.5">
        <Link
          to="/"
          className="btn btn-stone flex shrink-0 items-center gap-2 !px-2.5 !py-1.5 !text-[10px]"
          title="Back to the College"
        >
          <img src={art.skullGold} alt="" className="h-3.5 w-auto" />
          The College
        </Link>
        <span className="h-5 w-px shrink-0 bg-gold/15" />
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="h-display text-base leading-tight">The Boneyard</h1>
          <span className="hidden truncate font-mono text-xs text-bone-dim/70 md:inline">
            {state.doc.meta.name || 'Untitled acre'}
          </span>
          <span
            className={`font-mono text-[10px] uppercase tracking-wider ${
              state.dirty ? 'text-gold/80' : 'text-bone-dim/50'
            }`}
            title={state.savedAt ? `Last inked ${new Date(state.savedAt).toLocaleTimeString()}` : 'Not yet inked'}
          >
            {state.dirty ? 'inking…' : state.savedAt ? 'inked' : 'unwritten'}
          </span>
        </div>

        {notice && <p className="text-fell min-w-0 truncate text-xs text-gold/90">{notice}</p>}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className="btn btn-stone !px-3 !py-2 !text-[11px]"
              aria-haspopup="menu"
              aria-expanded={deskOpen}
              onClick={() => setDeskOpen((v) => !v)}
            >
              The desk ▾
            </button>
            {deskOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDeskOpen(false)} />
                <div className="panel absolute right-0 top-full z-50 mt-1.5 w-52 py-1.5" role="menu">
                  <MenuItem label="Drafts…" hint="The chest of drafts, local and cloud" onClick={() => { setDeskOpen(false); setChestOpen(true) }} />
                  <MenuItem label="Import…" hint="Open a .boneyard or a JSON draft" onClick={() => { setDeskOpen(false); fileRef.current?.click() }} />
                  <MenuItem label="Export draft" hint="Save the draft as JSON" onClick={() => { setDeskOpen(false); exportJson() }} />
                  <MenuItem
                    label="Download .boneyard"
                    hint={formatReady() ? 'Compile a native .boneyard' : 'The native compiler is still in the vault.'}
                    disabled={!formatReady()}
                    onClick={() => { setDeskOpen(false); exportBoneyard() }}
                  />
                </div>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".boneyard,.json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImportFile(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn btn-stone !px-3 !py-2 !text-[11px]"
            onClick={sendToAnnals}
            disabled={!user || annalsBusy}
            title={user ? 'Lodge this draft in the Annals (cloud)' : 'The Annals take drafts from signed-in wizards.'}
          >
            {annalsBusy ? 'Lodging…' : 'To the Annals'}
          </button>
          {user && formatReady() ? (
            <button
              type="button"
              className="btn btn-gold !px-3.5 !py-2 !text-[11px]"
              onClick={() => setPublishOpen(true)}
              title="Publish this plot to the Library"
            >
              Publish
            </button>
          ) : (
            <span aria-disabled="true" title={publishTitle} className="btn btn-gold !px-3.5 !py-2 !text-[11px] cursor-not-allowed select-none opacity-45">
              Publish
            </span>
          )}
        </div>
      </div>

      {/* the table itself */}
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div
          className="relative grid min-h-0 flex-1"
          style={{ gridTemplateColumns: `${leftW}px 5px minmax(0,1fr) 5px ${rightW}px` }}
        >
          {leftW > 0 ? (
            <PaletteRail activeKey={activeKey} onPick={onPalettePick} onCollapse={collapseLeft} />
          ) : (
            <div className="bg-abyss/40" />
          )}
          <div
            className="cursor-col-resize bg-black/30 transition-colors hover:bg-gold/25"
            title="Drag to size the catalogue · double-click resets"
            onPointerDown={startRailDrag('left')}
            onDoubleClick={() => setLeftW(RAIL_L_DEFAULT)}
          />
          <div className="relative flex min-h-0 flex-col">
            <Toolbar
              tool={tool}
              canUndo={state.past.length > 0}
              canRedo={state.future.length > 0}
              snap={snap}
              showGrid={grid}
              styles={styles}
              selectionCount={state.selection.length}
              selectionGrouped={selectionGrouped}
              placeLabel={placeLabel}
              onTool={setTool}
              onStyles={onStyles}
              onUndo={onUndo}
              onRedo={onRedo}
              onSnap={onSnap}
              onGrid={onGrid}
              onGroup={onGroup}
              onUngroup={onUngroup}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
            <CanvasStage
              ref={stageRef}
              doc={state.doc}
              selection={state.selection}
              tool={tool}
              activeItem={activeItem}
              snap={snap}
              showGrid={grid}
              styles={styles}
              dispatch={dispatch}
              onPlaced={onPlaced}
              onDeleted={onDeleted}
              onExitPlace={onExitPlace}
            />
          </div>
          <div
            className="cursor-col-resize bg-black/30 transition-colors hover:bg-gold/25"
            title="Drag to size the ledger · double-click resets"
            onPointerDown={startRailDrag('right')}
            onDoubleClick={() => setRightW(RAIL_R_DEFAULT)}
          />
          {rightW > 0 ? (
            <InspectorRail
              doc={state.doc}
              selection={state.selection}
              dispatch={dispatch}
              onCollapse={collapseRight}
            />
          ) : (
            <div className="bg-abyss/40" />
          )}
          {leftW === 0 && (
            <button
              type="button"
              title="Open the catalogue"
              aria-label="Open the catalogue"
              className="absolute left-1.5 top-2 z-10 rounded border border-gold/25 bg-abyss/85 px-2 py-1.5 text-xs text-bone-dim backdrop-blur-sm hover:border-gold/60 hover:text-gold-bright"
              onClick={() => setLeftW(RAIL_L_DEFAULT)}
            >
              ❯
            </button>
          )}
          {rightW === 0 && (
            <button
              type="button"
              title="Open the ledger"
              aria-label="Open the ledger"
              className="absolute right-1.5 top-2 z-10 rounded border border-gold/25 bg-abyss/85 px-2 py-1.5 text-xs text-bone-dim backdrop-blur-sm hover:border-gold/60 hover:text-gold-bright"
              onClick={() => setRightW(RAIL_R_DEFAULT)}
            >
              ❮
            </button>
          )}
        </div>
      </div>

      {/* narrow contraptions get a polite refusal */}
      <div className="p-6 md:hidden">
        <EmptyState
          title="The drafting table wants a desk"
          line="Surveying sixty acres through a keyhole helps no one. Return on a wider contraption."
        />
      </div>

      {chestOpen && (
        <DraftsDrawer
          currentId={state.draftId}
          onOpen={openDraft}
          onOpenCloud={openCloud}
          onNew={breakNewGround}
          onClose={() => setChestOpen(false)}
        />
      )}

      {publishOpen && (
        <PublishDialog doc={state.doc} draftId={state.draftId} onClose={() => setPublishOpen(false)} />
      )}
    </div>
  )
}
