import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import BoneyardCanvas, { type BoneyardCanvasHandle } from '../boneyard/BoneyardCanvas'
import { BoneyardLayersPanel, BoneyardSelectionPanel } from '../boneyard/BoneyardSidebar'
import {
  DEFAULT_BONEYARD_LAYERS,
  type BoneyardDocument,
  type BoneyardLayers,
  type SceneSelection,
} from '../boneyard/model.ts'
import { BoneyardParseError, parseBoneyard } from '../boneyard/parser.ts'
import { art } from '../lib/assets'

const SAMPLE_URL = '/samples/story0.boneyard'
const MAX_FILE_BYTES = 256 * 1024 * 1024

type LoadedBoneyard = Readonly<{
  document: BoneyardDocument
  fileName: string
  sha256: string
}>

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

export default function BoneyardViewer() {
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<BoneyardCanvasHandle>(null)
  const dragDepth = useRef(0)
  const [loaded, setLoaded] = useState<LoadedBoneyard | null>(null)
  const [layers, setLayers] = useState<BoneyardLayers>(DEFAULT_BONEYARD_LAYERS)
  const [selection, setSelection] = useState<SceneSelection | null>(null)
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBytes = useCallback(async (bytes: Uint8Array, fileName: string) => {
    setBusy(true)
    setError(null)
    try {
      const document = parseBoneyard(bytes)
      const hash = await sha256(bytes)
      setLoaded({ document, fileName, sha256: hash })
      setSelection(null)
    } catch (exception) {
      setError(exception instanceof BoneyardParseError
        ? exception.message
        : 'The Boneyard could not be opened in this browser.')
    } finally {
      setBusy(false)
    }
  }, [])

  const loadFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.boneyard')) {
      setError('Choose a .boneyard file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Boneyards larger than 256 MiB are not supported.')
      return
    }
    await loadBytes(new Uint8Array(await file.arrayBuffer()), file.name)
  }, [loadBytes])

  const loadSample = useCallback(async (signal?: AbortSignal) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(SAMPLE_URL, { signal })
      if (!response.ok) throw new Error(`Sample request failed: ${response.status}`)
      await loadBytes(new Uint8Array(await response.arrayBuffer()), 'story0.boneyard')
    } catch (exception) {
      if (exception instanceof DOMException && exception.name === 'AbortError') return
      setError('The built-in Boneyard sample could not be loaded.')
      setBusy(false)
    }
  }, [loadBytes])

  useEffect(() => {
    const controller = new AbortController()
    void loadSample(controller.signal)
    return () => controller.abort()
  }, [loadSample])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.matches('input, textarea, select')) return
      if (event.key === 'Escape') {
        setSelection(null)
        setLeftPanelOpen(false)
        setRightPanelOpen(false)
      } else if (event.key === '0') {
        canvasRef.current?.fit()
      } else if (event.key === '+' || event.key === '=') {
        canvasRef.current?.zoomBy(1.25)
      } else if (event.key === '-') {
        canvasRef.current?.zoomBy(0.8)
      } else if (event.key.toLowerCase() === 'o') {
        inputRef.current?.click()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const changeSelection = (value: SceneSelection | null) => {
    setSelection(value)
    if (value && window.innerWidth < 1280) setRightPanelOpen(true)
  }

  return (
    <div
      className="relative flex h-dvh w-screen flex-col overflow-hidden bg-abyss text-bone"
      onDragEnter={(event) => {
        event.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        void loadFile(event.dataTransfer.files?.[0])
      }}
    >
      <header className="z-30 flex h-15 flex-none items-center gap-2 border-b border-gold/20 bg-[#0b090f]/95 px-3 shadow-xl backdrop-blur md:gap-4 md:px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="Return to Solomon Dark">
          <img src={art.skullGold} alt="" className="h-7 drop-shadow-[0_0_8px_rgba(200,168,98,.35)]" />
          <span className="hidden font-display text-xs font-bold uppercase tracking-[0.16em] text-gold sm:block">
            Boneyard Viewer
          </span>
        </Link>

        <div className="mx-1 h-6 w-px bg-gold/15 md:mx-2" />
        <button type="button" className="viewer-tool" onClick={() => inputRef.current?.click()} title="Open Boneyard (O)">
          <span aria-hidden="true">↥</span><span className="hidden sm:inline">Open</span>
        </button>
        <button type="button" className="viewer-tool hidden md:inline-flex" onClick={() => void loadSample()}>
          Sample
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".boneyard,application/octet-stream"
          className="hidden"
          onChange={(event) => {
            void loadFile(event.target.files?.[0])
            event.currentTarget.value = ''
          }}
        />

        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="viewer-icon" onClick={() => canvasRef.current?.zoomBy(0.8)} aria-label="Zoom out">−</button>
          <button type="button" className="viewer-zoom" onClick={() => canvasRef.current?.fit()} title="Fit map (0)">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="viewer-icon" onClick={() => canvasRef.current?.zoomBy(1.25)} aria-label="Zoom in">+</button>
          <button type="button" className="viewer-tool ml-1 lg:hidden" onClick={() => setLeftPanelOpen((value) => !value)}>
            Layers
          </button>
          <button type="button" className="viewer-tool ml-1 xl:hidden" onClick={() => setRightPanelOpen((value) => !value)}>
            Inspect
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {loaded && (
          <aside className="hidden w-69 flex-none border-r border-gold/15 lg:block">
            <BoneyardLayersPanel
              {...loaded}
              layers={layers}
              onLayerChange={(key, value) => setLayers((current) => ({ ...current, [key]: value }))}
            />
          </aside>
        )}

        <main className="relative min-w-0 flex-1">
          {loaded ? (
            <BoneyardCanvas
              ref={canvasRef}
              document={loaded.document}
              layers={layers}
              selection={selection}
              onSelectionChange={changeSelection}
              onZoomChange={setZoom}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md text-center">
                <img src={art.bannerFetching} alt="" className="mx-auto max-w-full opacity-80" />
                <p className="text-fell mt-5 text-lg text-bone-dim">
                  {busy ? 'Fetching the grounds…' : 'Drop a Boneyard here, or open one from your machine.'}
                </p>
                {!busy && (
                  <button type="button" className="btn btn-gold mt-5" onClick={() => inputRef.current?.click()}>
                    Open Boneyard
                  </button>
                )}
              </div>
            </div>
          )}

          {busy && loaded && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-abyss/65 backdrop-blur-sm">
              <div className="gold-banner animate-pulse">Reading SyncBuffer</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-x-4 top-4 z-30 mx-auto flex max-w-2xl items-start gap-3 rounded border border-blood/55 bg-[#260d11]/95 p-3 shadow-2xl">
              <span className="text-blood">✕</span>
              <div className="text-sm text-[#f1c5c5]">{error}</div>
              <button type="button" className="ml-auto text-bone-dim hover:text-bone" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded border border-white/8 bg-black/45 px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-bone-dim/60 backdrop-blur-sm">
            Drag to pan · wheel to zoom · click to inspect · double-click to fit
          </div>
        </main>

        {loaded && (
          <aside className="hidden w-76 flex-none border-l border-gold/15 xl:block">
            <BoneyardSelectionPanel selection={selection} />
          </aside>
        )}

        {loaded && leftPanelOpen && (
          <aside className="absolute inset-y-0 left-0 z-40 w-72 border-r border-gold/25 shadow-2xl lg:hidden">
            <BoneyardLayersPanel
              {...loaded}
              layers={layers}
              onLayerChange={(key, value) => setLayers((current) => ({ ...current, [key]: value }))}
            />
          </aside>
        )}
        {loaded && rightPanelOpen && (
          <aside className="absolute inset-y-0 right-0 z-40 w-76 max-w-[88vw] border-l border-gold/25 shadow-2xl xl:hidden">
            <BoneyardSelectionPanel selection={selection} />
          </aside>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-arcane bg-[#07161b]/90 shadow-[inset_0_0_80px_rgba(65,227,255,.12)] backdrop-blur-sm">
          <div className="text-center">
            <div className="text-5xl text-arcane">⌖</div>
            <div className="mt-4 font-display text-lg font-bold uppercase tracking-[0.2em] text-arcane">
              Open these grounds
            </div>
            <div className="mt-2 text-sm text-bone-dim">The file stays in your browser.</div>
          </div>
        </div>
      )}
    </div>
  )
}
