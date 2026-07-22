// Palette source for the Boneyard editor, fed by the generated manifests in
// editor/manifest/ (tools/extract-boneyard-assets.py): the DeadHawg scenery
// catalogue, the Bonedit chrome, and the verified class-to-art mappings.

import type { AtlasEntry } from './manifest'
import { atlasManifests, classesManifest, paletteManifest } from './manifest'
import type { SpriteRef } from './model'
import { NATIVE } from './model'

// Vite bundles what the glob names; DeadHawg and Bonedit carry the editor.
// BadGuys stays out of the bundle: its records are secondary effects, not
// placement variants (see classes.json), and it weighs more than the rest
// of the site put together.
const spriteFiles = {
  ...import.meta.glob('../assets/game/boneyard/deadhawg/*.png', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../assets/game/boneyard/bonedit/*.png', { eager: true, query: '?url', import: 'default' }),
} as Record<string, string>

export function spriteUrl(atlas: string, id: number): string | null {
  const entry = atlasManifests[atlas]?.entries[id]
  if (!entry || !entry.file) return null
  return spriteFiles[`../assets/game/boneyard/${entry.file}`] ?? null
}

export function atlasEntry(atlas: string, id: number): AtlasEntry | null {
  return atlasManifests[atlas]?.entries[id] ?? null
}

/** Where the sprite's feet are, in png-local pixels. Bottom-centre of the
 * visible art: cursor-true regardless of the bundle's logical cell padding
 * (animation banks pad cells generously; a placed piece should sit under the
 * hand). When the format pass pins the game's exact registration for section
 * 11 bounds, adjust HERE and nowhere else. */
export function spriteRefFor(atlas: string, id: number): SpriteRef | null {
  const e = atlasEntry(atlas, id)
  const src = spriteUrl(atlas, id)
  if (!e || !src) return null
  return {
    atlas,
    entry: id,
    src,
    w: e.rect.w,
    h: e.rect.h,
    anchorX: e.rect.w / 2,
    anchorY: e.rect.h,
  }
}

export interface PaletteItem {
  key: string
  label: string
  /** scenery = a static sprite record (section 11); object = a native class. */
  kind: 'scenery' | 'object'
  atlas: string
  entry: number
  src: string
  typeId?: number
  variant?: number
}

export interface PaletteGroup {
  id: string
  tab: 'scenery' | 'classes'
  title: string
  note?: string
  items: PaletteItem[]
}

const CATEGORY_ORDER: { id: keyof typeof paletteManifest.categories; title: string; note?: string }[] = [
  { id: 'graves', title: 'Graves', note: 'Standard-issue accommodation.' },
  { id: 'trees', title: 'Trees', note: 'The Grimwood, by the piece.' },
  { id: 'flora', title: 'Flora', note: 'Weeds with tenure.' },
  { id: 'ground', title: 'Ground', note: 'Dirt, moss, and honest mud.' },
  { id: 'fences', title: 'Fences', note: 'Property lines for the departed.' },
  { id: 'buildings', title: 'Buildings', note: 'Load-bearing gloom.' },
  { id: 'statues', title: 'Statuary', note: 'For residents of standing.' },
  { id: 'props', title: 'Props', note: 'Clutter with intent.' },
  { id: 'markers', title: 'Markers', note: 'Administrative signage.' },
  { id: 'fx', title: 'Ambience', note: 'Fires and hauntings; the game animates its own.' },
  { id: 'unknown', title: 'Oddments', note: 'The catalogue withholds judgement.' },
]

function sceneryGroups(): PaletteGroup[] {
  const groups: PaletteGroup[] = []
  for (const cat of CATEGORY_ORDER) {
    const entries = paletteManifest.categories[cat.id] ?? []
    const items: PaletteItem[] = []
    for (const pe of entries) {
      const src = spriteUrl(paletteManifest.atlas, pe.id)
      if (!src) continue
      items.push({
        key: `dh-${pe.id}`,
        label: pe.label,
        kind: 'scenery',
        atlas: paletteManifest.atlas,
        entry: pe.id,
        src,
      })
    }
    if (items.length > 0) groups.push({ id: `scenery-${cat.id}`, tab: 'scenery', title: cat.title, note: cat.note, items })
  }
  return groups
}

/** The variant list a class places from: its main/base mapping. */
export function classVariantEntries(classId: number): { atlas: string; ids: number[] } | null {
  const cls = classesManifest.classes.find((c) => c.id === classId)
  if (!cls) return null
  const mappings = cls.variantMappings ?? []
  const preferred =
    mappings.find((m) => /main|base|monument|coffer|placed/.test(`${m.selector} ${m.role}`)) ??
    mappings.find((m) => m.entryIdsByVariant?.length) ??
    mappings.find((m) => m.entryIds?.length)
  if (!preferred) return null
  const ids = preferred.entryIdsByVariant ?? preferred.entryIds ?? []
  if (!preferred.atlas || ids.length === 0) return null
  return { atlas: preferred.atlas, ids }
}

const CLASS_GROUPS: { id: number; title: string; note: string }[] = [
  { id: NATIVE.gravestone, title: 'Gravestones', note: 'The genuine article: diggable, lootable, load-registered.' },
  { id: NATIVE.tree, title: 'Trees', note: 'Real trees, with collision and opinions.' },
  { id: NATIVE.monument, title: 'Monuments', note: 'Sixteen ways to be remembered.' },
  { id: NATIVE.building, title: 'Buildings', note: 'Four floor plans, all condemned.' },
  { id: NATIVE.goodie, title: 'Goodies', note: 'Coffers in their several tempers.' },
]

function classGroups(): PaletteGroup[] {
  const groups: PaletteGroup[] = []
  for (const cg of CLASS_GROUPS) {
    const found = classVariantEntries(cg.id)
    if (!found) continue
    const items: PaletteItem[] = []
    found.ids.forEach((entryId, variant) => {
      const src = spriteUrl(found.atlas, entryId)
      if (!src) return
      items.push({
        key: `cls-${cg.id}-${variant}`,
        label: `variant ${variant}`,
        kind: 'object',
        atlas: found.atlas,
        entry: entryId,
        src,
        typeId: cg.id,
        variant,
      })
    })
    if (items.length > 0) groups.push({ id: `class-${cg.id}`, tab: 'classes', title: cg.title, note: cg.note, items })
  }
  return groups
}

export const PALETTE: PaletteGroup[] = [...classGroups(), ...sceneryGroups()]

/** Catalogue label for a DeadHawg entry, when the palette knows one. */
export function sceneryLabel(atlas: string, entry: number): string | null {
  if (atlas !== paletteManifest.atlas) return null
  for (const list of Object.values(paletteManifest.categories)) {
    const hit = list.find((e) => e.id === entry)
    if (hit) return hit.label
  }
  return null
}

export function findPaletteItem(key: string | null): PaletteItem | null {
  if (!key) return null
  for (const group of PALETTE) {
    const hit = group.items.find((i) => i.key === key)
    if (hit) return hit
  }
  return null
}

/** Shared image cache; the renderer and the palette thumbs both feed on it. */
const cache = new Map<string, HTMLImageElement>()

export function spriteImage(src: string, onReady?: () => void): HTMLImageElement {
  let img = cache.get(src)
  if (!img) {
    img = new Image()
    img.src = src
    cache.set(src, img)
  }
  if (onReady) {
    if (img.complete) onReady()
    else img.addEventListener('load', onReady, { once: true })
  }
  return img
}
