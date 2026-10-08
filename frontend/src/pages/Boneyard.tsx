// The Boneyard: draft your own acre of the grounds. A full-screen drafting
// table: palette on the left, the dig site in the middle, ledger on the right.
//
// The editor works on the semantic doc (src/editor/model.ts); the native
// .boneyard byte layer plugs in behind src/editor/io.ts.

import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PaletteItem } from '../editor/assets'
import CanvasStage, { type StageHandle } from '../components/boneyard/CanvasStage'
import DraftsDrawer from '../components/boneyard/DraftsDrawer'
import InspectorRail from '../components/boneyard/InspectorRail'
import PaletteRail from '../components/boneyard/PaletteRail'
import PublishDialog from '../components/boneyard/PublishDialog'
import Toolbar from '../components/boneyard/Toolbar'
import WavesEditor from '../components/boneyard/WavesEditor'
import { findPaletteItem } from '../editor/assets'
import {
  bytesToBase64,
  compileNative,
  docFileValue,
  downloadBlob,
  exportDocJson,
  formatReady,
  importDocFile,
} from '../editor/io'
import type { EditorDoc } from '../editor/model'
import { NATIVE_LABEL, countResidents, createDoc } from '../editor/model'
import type { Tool, ToolStyles } from '../editor/render'
import { saveDraftToCloud, setCloudId } from '../editor/cloud'
import {
  initialState,
  listDrafts,
  loadDraft,
  newDraftId,
  reducer,
  saveDraft,
  type WorkshopRequest,
} from '../editor/store'
import { playSound } from '../fx/sounds'
import { api } from '../lib/api'
import { art } from '../lib/assets'
import { useAuth } from '../lib/auth'
import '../editor/workshop.css'

const EditorTestRuntime = lazy(() => import('../editor/EditorTestRuntime.tsx'))

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
  let raw: string | null
  try { raw = localStorage.getItem(key) } catch { return fallback }
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

export default function Boneyard({ onBack, request }: { onBack?: () => void; request?: WorkshopRequest }) {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1050px)').matches)
  const [compactRail, setCompactRail] = useState<'palette' | 'inspector' | null>(null)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1050px)')
    const update = () => { setCompact(query.matches); setCompactRail(null) }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const [testDoc, setTestDoc] = useState<EditorDoc | null>(() => (
    request?.kind === 'open' && request.test && formatReady() ? structuredClone(request.doc) : null
  ))
  const testButtonRef = useRef<HTMLButtonElement>(null)
  const returnToEditing = useCallback(() => {
    setTestDoc(null)
    requestAnimationFrame(() => testButtonRef.current?.focus())
  }, [])
  const { user } = useAuth()
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => {
      if (request?.kind === 'new') return initialState(newDraftId(), freshDoc())
      if (request?.kind === 'open') return { ...initialState(request.draftId, request.doc), savedAt: request.savedAt }
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
  const [wavesOpen, setWavesOpen] = useState(false)
  const [annalsBusy, setAnnalsBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [localSaveFailedFor, setLocalSaveFailedFor] = useState<EditorDoc | null>(null)
  const localSaveFailed = localSaveFailedFor === state.doc
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
    const t = setTimeout(() => { try { localStorage.setItem(RAIL_L_KEY, String(leftW)) } catch { /* View preferences must not block editing when storage is full. */ } }, 250)
    return () => clearTimeout(t)
  }, [leftW])
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(RAIL_R_KEY, String(rightW)) } catch { /* The draft has its own actionable save warning. */ } }, 250)
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
      try {
        saveDraft(state.draftId, state.doc, countResidents(state.doc))
        setLocalSaveFailedFor(null)
        dispatch({ type: 'mark-saved', at: Date.now() })
      } catch {
        setLocalSaveFailedFor(state.doc)
        setNotice('Local autosave is unavailable. Save to cloud or export a copy before leaving.')
      }
    }, 800)
    return () => clearTimeout(t)
  }, [state.doc, state.dirty, state.draftId])

  // Leaving cancels the pending autosave, so write the latest edits first. When the device refuses,
  // keep the player here once; the header then explains how to keep the work.
  const saveBeforeLeaving = useCallback((): boolean => {
    if (!state.dirty) return true
    try {
      saveDraft(state.draftId, state.doc, countResidents(state.doc))
      return true
    } catch {
      if (localSaveFailed) return true
      setLocalSaveFailedFor(state.doc)
      setNotice('Local autosave is unavailable. Save to cloud or export a copy before leaving.')
      return false
    }
  }, [localSaveFailed, state.dirty, state.doc, state.draftId])

  // The keyboard: tools, history, housekeeping. Arrows nudge the held
  // pieces, or walk the camera when the hands are empty.
  const hasSelection = state.selection.length > 0
  useEffect(() => {
    if (testDoc) return
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
        case 's': case 'S': setTool('spawn'); break
        case 'g': case 'G': setSnap((s) => !s); break
        case 'Delete':
        case 'Backspace':
          dispatch({ type: 'delete-selection' })
          break
        case 'Escape':
          dispatch({ type: 'select', sel: [] })
          if (tool === 'place' || tool === 'brush' || tool === 'spawn') {
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
  }, [tool, hasSelection, testDoc])

  const openDraft = useCallback((id: string) => {
    const doc = loadDraft(id)
    if (!doc) {
      say('Could not open this draft.')
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
    say(`Opened ${name} from the cloud.`)
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
      await saveDraftToCloud(api.boneyards, state.draftId, state.doc.meta.name || 'Untitled Acre', {
        name: state.doc.meta.name || undefined,
        document: docFileValue(state.doc),
        ...(compiled !== undefined ? { compiledBoneyard: compiled } : {}),
      })
      say('Draft saved to the cloud.')
    } catch (err) {
      say(err instanceof Error ? err.message : 'Could not save this draft to the cloud.')
    } finally {
      setAnnalsBusy(false)
    }
  }, [user, annalsBusy, state.doc, state.draftId, say])

  const onImportFile = useCallback(async (file: File) => {
    try {
      dispatch({ type: 'load-doc', doc: await importDocFile(file), draftId: newDraftId() })
      say(`Opened ${file.name}.`)
    } catch (err) {
      say(err instanceof Error ? err.message : 'Could not read this file.')
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
      say(err instanceof Error ? err.message : 'Could not export this Boneyard.')
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
  const onEditWaves = useCallback(() => setWavesOpen(true), [])

  const publishTitle = !user
    ? 'Sign in to publish a Boneyard.'
    : !formatReady()
      ? 'The Boneyard exporter is unavailable.'
      : 'Publish this Boneyard to the Library.'

  const groups = state.doc.groups ?? {}
  const selectionGrouped = state.selection.some((e) => groups[e.eid])

  return (
    <>
    <div className="boneyard-workshop flex h-full flex-col" data-editor-active={!testDoc} inert={Boolean(testDoc) || undefined} aria-hidden={Boolean(testDoc) || undefined} style={testDoc ? { visibility: 'hidden' } : undefined}>
      {/* the drafting-table header: the way home, the plot's papers, the desk */}
      <div className="flex items-center gap-3 border-b border-gold/15 bg-abyss/80 px-3 py-1.5">
        {onBack ? <button type="button" className="btn btn-stone flex shrink-0 items-center gap-2 !px-2.5 !py-1.5 !text-[10px]" onClick={() => { if (saveBeforeLeaving()) onBack() }}>← The Dark Cloud</button> : <Link
          to="/"
          className="btn btn-stone flex shrink-0 items-center gap-2 !px-2.5 !py-1.5 !text-[10px]"
          onClick={event => { if (!saveBeforeLeaving()) event.preventDefault() }}
          title="Home"
        >
          <img src={art.skullGold} alt="" className="h-3.5 w-auto" />
          Home
        </Link>}
        <span className="h-5 w-px shrink-0 bg-gold/15" />
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="h-display text-base leading-tight">Boneyard Editor</h1>
          <span className="hidden truncate font-mono text-xs text-bone-dim/70 md:inline">
            {state.doc.meta.name || 'Untitled acre'}
          </span>
          <span
            className={`font-mono text-[10px] uppercase tracking-wider ${
              state.dirty ? 'text-gold/80' : 'text-bone-dim/50'
            }`}
            title={localSaveFailed ? 'Save to cloud or export a copy before leaving.' : state.savedAt ? `Saved locally at ${new Date(state.savedAt).toLocaleTimeString()}` : 'Not saved'}
          >
            {localSaveFailed ? 'Local save unavailable' : state.dirty ? 'Saving…' : state.savedAt ? 'Saved locally' : 'Not saved'}
          </span>
        </div>

        {notice && <p className="text-fell min-w-0 truncate text-xs text-gold/90">{notice}</p>}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button ref={testButtonRef} type="button" className="btn btn-gold editor-test-button" disabled={!formatReady()} onClick={() => { setDeskOpen(false); setTestDoc(structuredClone(state.doc)) }} title="Play this layout with a disposable wizard. Your saved game is untouched.">
            <span aria-hidden>▶</span> Test Boneyard
          </button>
          <div className="relative">
            <button
              type="button"
              className="btn btn-stone !px-3 !py-2 !text-[11px]"
              aria-haspopup="menu"
              aria-expanded={deskOpen}
              onClick={() => setDeskOpen((v) => !v)}
            >
              File ▾
            </button>
            {deskOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDeskOpen(false)} />
                <div className="panel absolute right-0 top-full z-50 mt-1.5 w-52 py-1.5" role="menu">
                  <MenuItem label="Drafts…" hint="Open local and cloud drafts" onClick={() => { setDeskOpen(false); setChestOpen(true) }} />
                  <MenuItem label="Import…" hint="Open a .boneyard or a JSON draft" onClick={() => { setDeskOpen(false); fileRef.current?.click() }} />
                  <MenuItem label="Export draft" hint="Save the draft as JSON" onClick={() => { setDeskOpen(false); exportJson() }} />
                  <MenuItem
                    label="Download .boneyard"
                    hint={formatReady() ? 'Export a .boneyard file' : 'The Boneyard exporter is unavailable.'}
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
            title={user ? 'Save this draft to the cloud' : 'Sign in to save drafts to the cloud.'}
          >
            {annalsBusy ? 'Lodging…' : 'Save to cloud'}
          </button>
          {user && formatReady() ? (
            <button
              type="button"
              className="btn btn-gold !px-3.5 !py-2 !text-[11px]"
              onClick={() => setPublishOpen(true)}
              title="Publish this Boneyard to the Library"
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

      <div className="editor-workflow-strip">
        <span><b>01</b> Shape the grounds</span><i aria-hidden>→</i><span><b>02</b> Test privately</span><i aria-hidden>→</i><span><b>03</b> Return and refine</span>
        <small>Your draft stays with you</small>
      </div>
      {/* the table itself */}
      <div className="flex min-h-0 flex-1 flex-col">
        {compact && <div className="editor-compact-tools">
          <button type="button" aria-expanded={compactRail === 'palette'} onClick={() => setCompactRail(current => current === 'palette' ? null : 'palette')}>✦ Palette</button>
          <span>Tap a tool, then shape the grounds</span>
          <button type="button" aria-expanded={compactRail === 'inspector'} onClick={() => setCompactRail(current => current === 'inspector' ? null : 'inspector')}>Inspector ☷</button>
        </div>}
        <div
          className="editor-workspace relative grid min-h-0 flex-1"
          style={{ gridTemplateColumns: `${leftW}px 5px minmax(0,1fr) 5px ${rightW}px` }}
        >
          {compact && compactRail && <button type="button" className="editor-rail-backdrop" aria-label="Close panel" onClick={() => setCompactRail(null)} />}
          <div className="editor-palette-slot" data-open={compactRail === 'palette'}>
            {(compact ? compactRail === 'palette' : leftW > 0) && <PaletteRail activeKey={activeKey} onPick={item => { onPalettePick(item); if (compact) setCompactRail(null) }} onCollapse={compact ? () => setCompactRail(null) : collapseLeft} />}
          </div>
          <div
            className="editor-rail-divider cursor-col-resize bg-black/30 transition-colors hover:bg-gold/25"
            title="Drag to resize the palette · double-click to reset"
            onPointerDown={startRailDrag('left')}
            onDoubleClick={() => setLeftW(RAIL_L_DEFAULT)}
          />
          <div className="editor-stage-slot relative flex min-h-0 flex-col">
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
              active={!testDoc}
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
            className="editor-rail-divider cursor-col-resize bg-black/30 transition-colors hover:bg-gold/25"
            title="Drag to resize the inspector · double-click to reset"
            onPointerDown={startRailDrag('right')}
            onDoubleClick={() => setRightW(RAIL_R_DEFAULT)}
          />
          <div className="editor-inspector-slot" data-open={compactRail === 'inspector'}>
          {(compact ? compactRail === 'inspector' : rightW > 0) && (
            <InspectorRail
              doc={state.doc}
              selection={state.selection}
              dispatch={dispatch}
              onCollapse={compact ? () => setCompactRail(null) : collapseRight}
              onEditWaves={onEditWaves}
            />
          )}
          </div>
          {!compact && leftW === 0 && (
            <button
              type="button"
              title="Open palette"
              aria-label="Open palette"
              className="absolute left-1.5 top-2 z-10 rounded border border-gold/25 bg-abyss/85 px-2 py-1.5 text-xs text-bone-dim backdrop-blur-sm hover:border-gold/60 hover:text-gold-bright"
              onClick={() => setLeftW(RAIL_L_DEFAULT)}
            >
              ❯
            </button>
          )}
          {!compact && rightW === 0 && (
            <button
              type="button"
              title="Open inspector"
              aria-label="Open inspector"
              className="absolute right-1.5 top-2 z-10 rounded border border-gold/25 bg-abyss/85 px-2 py-1.5 text-xs text-bone-dim backdrop-blur-sm hover:border-gold/60 hover:text-gold-bright"
              onClick={() => setRightW(RAIL_R_DEFAULT)}
            >
              ❮
            </button>
          )}
        </div>
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

      {wavesOpen && (
        <WavesEditor
          waves={state.doc.waves ?? []}
          onKeep={(waves) => {
            dispatch({ type: 'set-waves', waves })
            setWavesOpen(false)
            say(
              waves.length === 0
                ? 'Default waves restored.'
                : `${waves.length} wave${waves.length === 1 ? '' : 's'} saved.`,
            )
          }}
          onClose={() => setWavesOpen(false)}
        />
      )}

      {publishOpen && (
        <PublishDialog doc={state.doc} draftId={state.draftId} onClose={() => setPublishOpen(false)} />
      )}
    </div>
    {testDoc && <Suspense fallback={<div className="editor-test-loading"><p>Opening private test…</p><button className="btn btn-stone" onClick={returnToEditing}>Return to editing</button></div>}>
      <EditorTestRuntime accountUsername={user?.username ?? null} doc={testDoc} onReturn={returnToEditing} />
    </Suspense>}
    </>
  )
}
