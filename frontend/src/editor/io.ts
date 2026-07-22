// Import/export boundary between the editor and the native byte layer.
// Everything that touches format/ goes through here so the editor keeps
// working (drafts, JSON) while the byte layer is still in the vault.

import { classVariantEntries, spriteRefFor } from './assets'
import { FORMAT_READY, STATIC_SPRITE_ATLAS_BASE, newBoneyard, parseBoneyard, serializeBoneyard } from './format/boneyard'
import type { BoneyardPlacedObject, BoneyardStaticSprite } from './format/boneyard'
import blankFixtureUrl from './format/blank-fixture.boneyard?url'
import type { EditorDoc } from './model'

export { STATIC_SPRITE_ATLAS_BASE }

export function formatReady(): boolean {
  return FORMAT_READY
}

export class FormatPendingError extends Error {
  constructor() {
    super('The native compiler is still in the vault. Drafts and JSON export work; .boneyard comes with the format layer.')
  }
}

/** Attach render sprite refs to a parsed doc: the byte layer knows entries,
 * the manifest knows pixels. Placed objects prefer the payload's own atlas
 * entry, then fall back to the class-catalog variant mapping. */
function hydrate(doc: EditorDoc): EditorDoc {
  for (const obj of doc.objects as BoneyardPlacedObject[]) {
    if (obj.sprite) continue
    const direct = typeof obj.atlasEntry === 'number' ? spriteRefFor('DeadHawg', obj.atlasEntry) : null
    if (direct) {
      obj.sprite = direct
      continue
    }
    const mapping = classVariantEntries(obj.typeId)
    if (mapping && obj.variant !== undefined) {
      const entry = mapping.ids[obj.variant]
      if (entry !== undefined) obj.sprite = spriteRefFor(mapping.atlas, entry) ?? undefined
    }
  }
  for (const spr of doc.sprites as BoneyardStaticSprite[]) {
    if (spr.sprite) continue
    const entry = typeof spr.deadHawgEntry === 'number' ? spr.deadHawgEntry : spr.atlasEntry + STATIC_SPRITE_ATLAS_BASE
    spr.sprite = spriteRefFor('DeadHawg', entry) ?? undefined
  }
  return doc
}

export function importNative(bytes: Uint8Array): EditorDoc {
  if (!FORMAT_READY) throw new FormatPendingError()
  return hydrate(parseBoneyard(bytes))
}

export function exportNative(doc: EditorDoc): Uint8Array {
  if (!FORMAT_READY) throw new FormatPendingError()
  return serializeBoneyard(doc)
}

// The blank editor save from the stock Create New Boneyard flow: the envelope
// and default TimeLine donor for plots drafted from scratch.
let fixtureCache: Uint8Array | null = null

async function blankFixture(): Promise<Uint8Array> {
  if (!fixtureCache) {
    const res = await fetch(blankFixtureUrl)
    if (!res.ok) throw new Error('The blank plot template failed to arrive.')
    fixtureCache = new Uint8Array(await res.arrayBuffer())
  }
  return fixtureCache
}

/** Editor-drawn road paths are runs of two-point segments sharing a chain.
 * Native roads link through previousUid/nextUid, so before serializing we
 * hand each chained segment a UID and stitch the run together. Allocation
 * mirrors the serializer's own generator (max existing, floor 50000) so the
 * two never collide. */
function linkChains(doc: EditorDoc) {
  const used: number[] = [50_000]
  const collect = (u?: number) => {
    if (typeof u === 'number') used.push(u)
  }
  doc.roads.forEach((r) => collect(r.uid))
  doc.fences.forEach((f) => collect(f.uid))
  doc.terrain.forEach((t) => collect(t.uid))
  const rich = doc as EditorDoc & {
    recipes?: { monsters?: { uid?: number }[]; npcs?: { uid?: number }[]; uidGroups?: { uid?: number }[] }
    timeline?: { records?: { reservedUids?: number[] }[] }
  }
  rich.recipes?.monsters?.forEach((m) => collect(m.uid))
  rich.recipes?.npcs?.forEach((n) => collect(n.uid))
  rich.recipes?.uidGroups?.forEach((g) => collect(g.uid))
  rich.timeline?.records?.forEach((rec) => rec.reservedUids?.forEach((u) => collect(u)))
  let next = Math.max(...used) + 1

  const chains = new Map<string, typeof doc.roads>()
  for (const road of doc.roads) {
    if (!road.chain || road.uid !== undefined) continue
    const list = chains.get(road.chain) ?? []
    list.push(road)
    chains.set(road.chain, list)
  }
  for (const run of chains.values()) {
    for (const seg of run) seg.uid = next++
    run.forEach((seg, i) => {
      seg.previousUid = i > 0 ? run[i - 1].uid : 0xffffffff
      seg.nextUid = i < run.length - 1 ? run[i + 1].uid : 0xffffffff
    })
  }
}

/** Compile any editor doc to native bytes. Parsed docs re-serialize over their
 * own envelope; scratch drafts graft onto the blank fixture (default TimeLine
 * included, so the retail loader has something to start). */
export async function compileNative(doc: EditorDoc): Promise<Uint8Array> {
  if (!FORMAT_READY) throw new FormatPendingError()
  // Work on a clone: chain linking assigns UIDs, and the live editor doc
  // should not grow serialization artifacts.
  const work = structuredClone(doc)
  linkChains(work)
  const meta = work.meta as EditorDoc['meta'] & { raw?: { file?: string } }
  if (meta.raw?.file) return serializeBoneyard(work)
  const base = newBoneyard(work.meta.name || 'Untitled Acre', await blankFixture())
  const b = work.meta.bounds
  base.meta.bounds = { ...base.meta.bounds, x: b.x, y: b.y, w: b.w, h: b.h }
  base.objects = work.objects as typeof base.objects
  base.roads = work.roads as typeof base.roads
  base.fences = work.fences as typeof base.fences
  base.terrain = work.terrain as typeof base.terrain
  base.sprites = work.sprites as typeof base.sprites
  return serializeBoneyard(base)
}

/** The editor's own interchange: the semantic doc, versioned, as JSON. */
export interface DocFile {
  format: 'sdr-boneyard-doc'
  version: 1
  doc: EditorDoc
}

export function exportDocJson(doc: EditorDoc): string {
  const file: DocFile = { format: 'sdr-boneyard-doc', version: 1, doc }
  return JSON.stringify(file, null, 2)
}

export function importDocValue(value: unknown): EditorDoc {
  const file = value as Partial<DocFile>
  if (file?.format !== 'sdr-boneyard-doc' || !file.doc) {
    throw new Error('Not a boneyard draft. Wrong drawer entirely.')
  }
  return file.doc
}

export function importDocJson(text: string): EditorDoc {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not JSON. The Archivist has standards.')
  }
  return importDocValue(parsed)
}

export function docFileValue(doc: EditorDoc): DocFile {
  return { format: 'sdr-boneyard-doc', version: 1, doc }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function downloadBlob(name: string, data: Uint8Array | string, type: string) {
  // Copy byte views into a fresh ArrayBuffer so Blob's typing stays happy.
  const part: BlobPart = typeof data === 'string' ? data : new Uint8Array(data).buffer
  const url = URL.createObjectURL(new Blob([part], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
