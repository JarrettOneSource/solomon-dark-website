// Editor state: one reducer, snapshot history, and the local draft drawer.
// Pure module; the page owns it through useReducer.

import type { EditorDoc, PlacedObject, PlayerSpawn, Polyline, SelEntry, Selection, StaticSprite, TerrainPatch, Rect, Vec2 } from './model'
import { createDoc, eid, entryKey, selectionSet } from './model'
import { exportDocJson, importDocJson } from './io'

const HISTORY_CAP = 100

export interface EditorState {
  doc: EditorDoc
  selection: Selection
  past: EditorDoc[]
  future: EditorDoc[]
  /** Snapshot taken when a gesture (drag, brush stroke) begins, so the whole
   * gesture lands as one undo step. */
  gestureBase: EditorDoc | null
  dirty: boolean
  draftId: string
  savedAt: number | null
}

export type EditorAction =
  | { type: 'new-doc'; name: string; draftId: string }
  | { type: 'load-doc'; doc: EditorDoc; draftId: string }
  | { type: 'place-object'; obj: Omit<PlacedObject, 'eid'> }
  | { type: 'place-sprite'; spr: Omit<StaticSprite, 'eid'> }
  | { type: 'add-chain'; kind: 'road' | 'fence'; points: Vec2[]; style: number; widthScale?: number }
  | { type: 'add-terrain'; points: Vec2[]; style: number }
  | { type: 'select'; sel: Selection }
  | { type: 'select-all' }
  | { type: 'delete-selection' }
  | { type: 'delete-entries'; entries: SelEntry[] }
  | { type: 'nudge'; dx: number; dy: number }
  | { type: 'gesture-start' }
  | { type: 'gesture-move'; dx: number; dy: number }
  | { type: 'gesture-place-object'; obj: Omit<PlacedObject, 'eid'> }
  | { type: 'gesture-place-sprite'; spr: Omit<StaticSprite, 'eid'> }
  | { type: 'gesture-erase'; entries: SelEntry[] }
  | { type: 'gesture-end' }
  | { type: 'group-selection' }
  | { type: 'ungroup-selection' }
  | { type: 'duplicate-selection' }
  | { type: 'set-name'; name: string }
  | { type: 'set-bounds'; bounds: Rect }
  | { type: 'set-waves'; waves: import('./waves').WaveDef[] }
  | { type: 'set-spawn'; spawn: PlayerSpawn | undefined }
  | { type: 'move-item'; sel: SelEntry; pos: Vec2 }
  | { type: 'set-object-props'; eid: string; patch: Partial<Pick<PlacedObject, 'variant' | 'rot' | 'scale'>> }
  | { type: 'set-sprite-props'; eid: string; patch: Partial<Pick<StaticSprite, 's0' | 's1' | 's2' | 'flags'>> }
  | { type: 'set-line-props'; entries: SelEntry[]; patch: Partial<Pick<Polyline, 'style' | 'segmentCode' | 'startWidthScale' | 'endWidthScale'>> }
  | { type: 'set-terrain-props'; entries: SelEntry[]; patch: Partial<Pick<TerrainPatch, 'style'>> }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'mark-saved'; at: number }

export function initialState(draftId: string, doc: EditorDoc): EditorState {
  return {
    doc,
    selection: [],
    past: [],
    future: [],
    gestureBase: null,
    dirty: false,
    draftId,
    savedAt: null,
  }
}

function committed(state: EditorState, doc: EditorDoc, selection: Selection = state.selection): EditorState {
  const past = [...state.past, state.doc]
  if (past.length > HISTORY_CAP) past.shift()
  return { ...state, doc, selection, past, future: [], dirty: true }
}

/** Translate every selected thing by a delta. Polylines and terrain move all
 * their points; chained segments arrive pre-expanded in the selection. */
function moveEntries(doc: EditorDoc, entries: SelEntry[], dx: number, dy: number): EditorDoc {
  if (entries.length === 0 || (dx === 0 && dy === 0)) return doc
  const keys = new Set(entries.map(entryKey))
  const shift = (p: Vec2): Vec2 => ({ x: p.x + dx, y: p.y + dy })
  return {
    ...doc,
    objects: doc.objects.map((o) => (keys.has(`object:${o.eid}`) ? { ...o, pos: shift(o.pos) } : o)),
    sprites: doc.sprites.map((s) => (keys.has(`sprite:${s.eid}`) ? { ...s, pos: shift(s.pos) } : s)),
    roads: doc.roads.map((r) => (keys.has(`road:${r.eid}`) ? { ...r, points: r.points.map(shift) } : r)),
    fences: doc.fences.map((f) => (keys.has(`fence:${f.eid}`) ? { ...f, points: f.points.map(shift) } : f)),
    terrain: doc.terrain.map((t) =>
      keys.has(`terrain:${t.eid}`)
        ? { ...t, pos: shift(t.pos), points: t.points ? t.points.map(shift) : t.points }
        : t,
    ),
  }
}

function removeEntries(doc: EditorDoc, entries: SelEntry[]): EditorDoc {
  if (entries.length === 0) return doc
  const keys = new Set(entries.map(entryKey))
  const groups = { ...(doc.groups ?? {}) }
  for (const e of entries) delete groups[e.eid]
  return {
    ...doc,
    objects: doc.objects.filter((o) => !keys.has(`object:${o.eid}`)),
    sprites: doc.sprites.filter((s) => !keys.has(`sprite:${s.eid}`)),
    roads: doc.roads.filter((r) => !keys.has(`road:${r.eid}`)),
    fences: doc.fences.filter((f) => !keys.has(`fence:${f.eid}`)),
    terrain: doc.terrain.filter((t) => !keys.has(`terrain:${t.eid}`)),
    groups,
  }
}

function sameSelection(a: Selection, b: Selection): boolean {
  if (a.length !== b.length) return false
  const keys = selectionSet(a)
  return b.every((e) => keys.has(entryKey(e)))
}

export function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'new-doc':
      return initialState(action.draftId, createDoc(action.name))

    case 'load-doc':
      return { ...initialState(action.draftId, action.doc), savedAt: Date.now() }

    case 'place-object': {
      const obj: PlacedObject = { ...action.obj, eid: eid('o') }
      return committed(state, { ...state.doc, objects: [...state.doc.objects, obj] }, [{ kind: 'object', eid: obj.eid }])
    }

    case 'place-sprite': {
      const spr: StaticSprite = { ...action.spr, eid: eid('s') }
      return committed(state, { ...state.doc, sprites: [...state.doc.sprites, spr] }, [{ kind: 'sprite', eid: spr.eid }])
    }

    case 'add-chain': {
      // A drawn path becomes native two-point segments sharing a chain.
      if (action.points.length < 2) return state
      const chain = eid('c')
      const prefix = action.kind === 'road' ? 'r' : 'f'
      const segments: Polyline[] = []
      for (let i = 1; i < action.points.length; i++) {
        const seg: Polyline = {
          eid: eid(prefix),
          typeId: action.kind === 'road' ? 3004 : 3005,
          points: [action.points[i - 1], action.points[i]],
          style: action.style,
          chain,
        }
        if (action.kind === 'road') {
          seg.startWidthScale = action.widthScale ?? 1
          seg.endWidthScale = action.widthScale ?? 1
        } else {
          seg.segmentCode = action.style
        }
        segments.push(seg)
      }
      const doc =
        action.kind === 'road'
          ? { ...state.doc, roads: [...state.doc.roads, ...segments] }
          : { ...state.doc, fences: [...state.doc.fences, ...segments] }
      const sel: Selection = segments.map((s) => ({ kind: action.kind, eid: s.eid }))
      return committed(state, doc, sel)
    }

    case 'add-terrain': {
      if (action.points.length < 2) return state
      const patch: TerrainPatch = {
        eid: eid('t'),
        pos: action.points[0],
        points: action.points,
        style: action.style,
      }
      return committed(state, { ...state.doc, terrain: [...state.doc.terrain, patch] }, [
        { kind: 'terrain', eid: patch.eid },
      ])
    }

    case 'select':
      if (sameSelection(state.selection, action.sel)) return state
      return { ...state, selection: action.sel }

    case 'select-all': {
      const sel: Selection = [
        ...state.doc.objects.map((o): SelEntry => ({ kind: 'object', eid: o.eid })),
        ...state.doc.sprites.map((s): SelEntry => ({ kind: 'sprite', eid: s.eid })),
        ...state.doc.roads.map((r): SelEntry => ({ kind: 'road', eid: r.eid })),
        ...state.doc.fences.map((f): SelEntry => ({ kind: 'fence', eid: f.eid })),
        ...state.doc.terrain.map((t): SelEntry => ({ kind: 'terrain', eid: t.eid })),
      ]
      if (sameSelection(state.selection, sel)) return state
      return { ...state, selection: sel }
    }

    case 'delete-selection': {
      if (state.selection.length === 0) return state
      return committed(state, removeEntries(state.doc, state.selection), [])
    }

    case 'delete-entries': {
      if (action.entries.length === 0) return state
      const keys = new Set(action.entries.map(entryKey))
      const selection = state.selection.filter((e) => !keys.has(entryKey(e)))
      return committed(state, removeEntries(state.doc, action.entries), selection)
    }

    case 'nudge': {
      if (state.selection.length === 0) return state
      return committed(state, moveEntries(state.doc, state.selection, action.dx, action.dy))
    }

    case 'gesture-start':
      return { ...state, gestureBase: state.doc }

    case 'gesture-move': {
      if (!state.gestureBase || state.selection.length === 0) return state
      // Total delta from the gesture base: no drift, no accumulation error.
      return { ...state, doc: moveEntries(state.gestureBase, state.selection, action.dx, action.dy), dirty: true }
    }

    case 'gesture-place-object': {
      if (!state.gestureBase) return state
      const obj: PlacedObject = { ...action.obj, eid: eid('o') }
      return { ...state, doc: { ...state.doc, objects: [...state.doc.objects, obj] }, dirty: true }
    }

    case 'gesture-place-sprite': {
      if (!state.gestureBase) return state
      const spr: StaticSprite = { ...action.spr, eid: eid('s') }
      return { ...state, doc: { ...state.doc, sprites: [...state.doc.sprites, spr] }, dirty: true }
    }

    case 'gesture-erase': {
      if (!state.gestureBase || action.entries.length === 0) return state
      const keys = new Set(action.entries.map(entryKey))
      const selection = state.selection.filter((e) => !keys.has(entryKey(e)))
      return { ...state, doc: removeEntries(state.doc, action.entries), selection, dirty: true }
    }

    case 'gesture-end': {
      if (!state.gestureBase) return state
      if (state.gestureBase === state.doc) return { ...state, gestureBase: null }
      const past = [...state.past, state.gestureBase]
      if (past.length > HISTORY_CAP) past.shift()
      return { ...state, gestureBase: null, past, future: [] }
    }

    case 'group-selection': {
      if (state.selection.length < 2) return state
      const id = eid('g')
      const groups = { ...(state.doc.groups ?? {}) }
      for (const e of state.selection) groups[e.eid] = id
      return committed(state, { ...state.doc, groups })
    }

    case 'ungroup-selection': {
      if (state.selection.length === 0) return state
      const groups = { ...(state.doc.groups ?? {}) }
      let touched = false
      for (const e of state.selection) {
        if (groups[e.eid]) {
          delete groups[e.eid]
          touched = true
        }
      }
      if (!touched) return state
      return committed(state, { ...state.doc, groups })
    }

    case 'duplicate-selection': {
      if (state.selection.length === 0) return state
      const keys = selectionSet(state.selection)
      const OFF = 32
      const groups = { ...(state.doc.groups ?? {}) }
      const groupMap = new Map<string, string>()
      const chainMap = new Map<string, string>()
      const mapGroup = (oldEid: string, newEid: string) => {
        const g = groups[oldEid]
        if (!g) return
        if (!groupMap.has(g)) groupMap.set(g, eid('g'))
        groups[newEid] = groupMap.get(g)!
      }
      const mapChain = (c?: string): string | undefined => {
        if (!c) return undefined
        if (!chainMap.has(c)) chainMap.set(c, eid('c'))
        return chainMap.get(c)
      }
      const sel: Selection = []
      const objects = [...state.doc.objects]
      for (const o of state.doc.objects) {
        if (!keys.has(`object:${o.eid}`)) continue
        const copy: PlacedObject = { ...o, eid: eid('o'), uid: undefined, raw: o.raw, pos: { x: o.pos.x + OFF, y: o.pos.y + OFF } }
        objects.push(copy)
        mapGroup(o.eid, copy.eid)
        sel.push({ kind: 'object', eid: copy.eid })
      }
      const sprites = [...state.doc.sprites]
      for (const s of state.doc.sprites) {
        if (!keys.has(`sprite:${s.eid}`)) continue
        const copy: StaticSprite = { ...s, eid: eid('s'), pos: { x: s.pos.x + OFF, y: s.pos.y + OFF } }
        sprites.push(copy)
        mapGroup(s.eid, copy.eid)
        sel.push({ kind: 'sprite', eid: copy.eid })
      }
      const dupLine = (l: Polyline, prefix: string): Polyline => ({
        ...l,
        eid: eid(prefix),
        uid: undefined,
        previousUid: undefined,
        nextUid: undefined,
        raw: undefined,
        chain: mapChain(l.chain),
        points: l.points.map((p) => ({ x: p.x + OFF, y: p.y + OFF })),
      })
      const roads = [...state.doc.roads]
      for (const r of state.doc.roads) {
        if (!keys.has(`road:${r.eid}`)) continue
        const copy = dupLine(r, 'r')
        roads.push(copy)
        mapGroup(r.eid, copy.eid)
        sel.push({ kind: 'road', eid: copy.eid })
      }
      const fences = [...state.doc.fences]
      for (const f of state.doc.fences) {
        if (!keys.has(`fence:${f.eid}`)) continue
        const copy = dupLine(f, 'f')
        fences.push(copy)
        mapGroup(f.eid, copy.eid)
        sel.push({ kind: 'fence', eid: copy.eid })
      }
      const terrain = [...state.doc.terrain]
      for (const t of state.doc.terrain) {
        if (!keys.has(`terrain:${t.eid}`)) continue
        const copy: TerrainPatch = {
          ...t,
          eid: eid('t'),
          uid: undefined,
          raw: undefined,
          pos: { x: t.pos.x + OFF, y: t.pos.y + OFF },
          points: t.points?.map((p) => ({ x: p.x + OFF, y: p.y + OFF })),
        }
        terrain.push(copy)
        mapGroup(t.eid, copy.eid)
        sel.push({ kind: 'terrain', eid: copy.eid })
      }
      if (sel.length === 0) return state
      return committed(state, { ...state.doc, objects, sprites, roads, fences, terrain, groups }, sel)
    }

    case 'set-name':
      return committed(state, { ...state.doc, meta: { ...state.doc.meta, name: action.name } })

    case 'set-bounds':
      return committed(state, { ...state.doc, meta: { ...state.doc.meta, bounds: action.bounds } })

    case 'set-waves':
      return committed(state, { ...state.doc, waves: action.waves })

    case 'set-spawn':
      return committed(state, { ...state.doc, spawn: action.spawn })

    case 'move-item': {
      const e = action.sel
      const current =
        e.kind === 'object'
          ? state.doc.objects.find((o) => o.eid === e.eid)?.pos
          : e.kind === 'sprite'
            ? state.doc.sprites.find((s) => s.eid === e.eid)?.pos
            : e.kind === 'terrain'
              ? state.doc.terrain.find((t) => t.eid === e.eid)?.pos
              : (e.kind === 'road' ? state.doc.roads : state.doc.fences).find((l) => l.eid === e.eid)?.points[0]
      if (!current) return state
      return committed(state, moveEntries(state.doc, [e], action.pos.x - current.x, action.pos.y - current.y))
    }

    case 'set-object-props': {
      const objects = state.doc.objects.map((o) => (o.eid === action.eid ? { ...o, ...action.patch } : o))
      return committed(state, { ...state.doc, objects })
    }

    case 'set-sprite-props': {
      const sprites = state.doc.sprites.map((s) => (s.eid === action.eid ? { ...s, ...action.patch } : s))
      return committed(state, { ...state.doc, sprites })
    }

    case 'set-line-props': {
      const keys = new Set(action.entries.map(entryKey))
      const patchLine = (l: Polyline, kind: 'road' | 'fence'): Polyline => {
        if (!keys.has(`${kind}:${l.eid}`)) return l
        const next = { ...l, ...action.patch }
        // Fences mirror style and segmentCode; keep them agreeing.
        if (kind === 'fence' && action.patch.style !== undefined) next.segmentCode = action.patch.style
        if (kind === 'fence' && action.patch.segmentCode !== undefined) next.style = action.patch.segmentCode
        return next
      }
      return committed(state, {
        ...state.doc,
        roads: state.doc.roads.map((r) => patchLine(r, 'road')),
        fences: state.doc.fences.map((f) => patchLine(f, 'fence')),
      })
    }

    case 'set-terrain-props': {
      const keys = new Set(action.entries.map(entryKey))
      const terrain = state.doc.terrain.map((t) =>
        keys.has(`terrain:${t.eid}`) ? { ...t, ...action.patch, entry: action.patch.style ?? t.entry } : t,
      )
      return committed(state, { ...state.doc, terrain })
    }

    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return {
        ...state,
        doc: prev,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        selection: [],
        dirty: true,
      }
    }

    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        ...state,
        doc: next,
        past: [...state.past, state.doc],
        future: state.future.slice(1),
        selection: [],
        dirty: true,
      }
    }

    case 'mark-saved':
      return { ...state, dirty: false, savedAt: action.at }
  }
}

// ---------- the draft drawer (localStorage) ----------

export interface DraftMeta {
  id: string
  name: string
  updatedAt: number
  residents: number
}

const INDEX_KEY = 'sdr:boneyard:drafts'
const DRAFT_PREFIX = 'sdr:boneyard:draft:'

export function listDrafts(): DraftMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as DraftMeta[]
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch {
    return []
  }
}

export function newDraftId(): string {
  return `d${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

export function saveDraft(id: string, doc: EditorDoc, residents: number) {
  const meta: DraftMeta = { id, name: doc.meta.name, updatedAt: Date.now(), residents }
  const index = listDrafts().filter((d) => d.id !== id)
  index.unshift(meta)
  localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, 40)))
  localStorage.setItem(DRAFT_PREFIX + id, exportDocJson(doc))
}

export function loadDraft(id: string): EditorDoc | null {
  const raw = localStorage.getItem(DRAFT_PREFIX + id)
  if (!raw) return null
  try {
    return importDocJson(raw)
  } catch {
    return null
  }
}

export function deleteDraft(id: string) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(listDrafts().filter((d) => d.id !== id)))
  localStorage.removeItem(DRAFT_PREFIX + id)
}

// ---------- local draft -> Annals (cloud) mapping ----------

const CLOUD_MAP_KEY = 'sdr:boneyard:cloudmap'

function cloudMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_MAP_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function cloudIdFor(draftId: string): number | null {
  return cloudMap()[draftId] ?? null
}

export function setCloudId(draftId: string, cloudId: number | null) {
  const map = cloudMap()
  if (cloudId === null) delete map[draftId]
  else map[draftId] = cloudId
  localStorage.setItem(CLOUD_MAP_KEY, JSON.stringify(map))
}
