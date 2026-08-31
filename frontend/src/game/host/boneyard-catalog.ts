import { createHash, randomBytes } from 'node:crypto'
import { basename } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { parseBoneyard } from '../../editor/format/boneyard.ts'
import type {
  BoneyardChoice,
  BoneyardScene,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'
import { NATIVE_GENERATED_BONEYARDS } from './native-generated-boneyards.ts'
import { STOCK_TUTORIAL_BONEYARD } from './stock-tutorial-boneyard.ts'
import { STOCK_TUTORIAL_BONEYARD_ID } from '../core-kernels/native-tutorial.ts'
import {
  boneyardGeometrySha256,
  projectBoneyard,
} from './project-boneyard.ts'

export const DEFAULT_BONEYARD_CHOICE: BoneyardChoice = {
  id: 'default-random',
  name: 'Random Boneyard',
  source: 'default',
}

export const STOCK_TUTORIAL_CHOICE: BoneyardChoice = {
  id: STOCK_TUTORIAL_BONEYARD_ID,
  name: 'Tutorial',
  source: 'default',
}

export interface ModBoneyardEntry {
  choice: BoneyardChoice
  geometrySha256: string
  scene: BoneyardScene
  sourceSha256: string
  webLuaContentId?: string
}

export interface BoneyardCatalog {
  choices: readonly BoneyardChoice[]
  modEntries: ReadonlyMap<string, ModBoneyardEntry>
}

export function projectModBoneyard(
  modId: string,
  modName: string,
  target: string,
  bytes: Uint8Array,
): ModBoneyardEntry {
  const sourceSha256 = createHash('sha256').update(bytes).digest('hex')
  const scene = projectBoneyard(parseBoneyard(bytes))
  const slug = basename(target, '.boneyard')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .toLowerCase()
    .slice(0, 64)
  const identitySha256 = createHash('sha256')
    .update(`${target}\0${sourceSha256}`)
    .digest('hex')
  return {
    choice: {
      id: `mod:${modId}:${slug}:${identitySha256.slice(0, 12)}`,
      name: basename(target, '.boneyard'),
      source: 'mod',
      modId,
      modName,
    },
    geometrySha256: boneyardGeometrySha256(scene),
    scene,
    sourceSha256,
  }
}

export function createBoneyardCatalog(
  modEntries: readonly ModBoneyardEntry[] = [],
): BoneyardCatalog {
  const entries = new Map<string, ModBoneyardEntry>()
  for (const entry of modEntries) {
    if (entry.choice.source !== 'mod') throw new Error('Catalog entries must be mod Boneyards')
    if (entry.choice.id === DEFAULT_BONEYARD_CHOICE.id || entries.has(entry.choice.id)) {
      throw new Error(`Duplicate Boneyard id: ${entry.choice.id}`)
    }
    entries.set(entry.choice.id, entry)
  }
  return {
    choices: [
      DEFAULT_BONEYARD_CHOICE,
      ...[...entries.values()].map((entry) => entry.choice),
    ],
    modEntries: entries,
  }
}

export function recoverSavedBoneyardRoadLinks(
  catalog: BoneyardCatalog,
  loaded: LoadedBoneyard,
): LoadedBoneyard {
  if (loaded.scene.roads.every(road => nativeRoadLinkMask(road.linkMask))) {
    return loaded
  }
  if (!loaded.scene.roads.every(road => road.linkMask === undefined)) {
    throw new Error('saved Boneyard Road links are invalid')
  }

  const canonical = canonicalSavedBoneyardSource(catalog, loaded)
  if (canonical === null) throw new Error('saved Boneyard content is unavailable')
  const canonicalRoads = new Map(canonical.scene.roads.map(road => [road.eid, road]))
  if (
    canonicalRoads.size !== canonical.scene.roads.length
    || new Set(loaded.scene.roads.map(road => road.eid)).size !== loaded.scene.roads.length
    || canonicalRoads.size !== loaded.scene.roads.length
  ) throw new Error('saved Boneyard Road membership does not match its source')

  const roads = loaded.scene.roads.map((road) => {
    const source = canonicalRoads.get(road.eid)
    if (
      source === undefined
      || !isDeepStrictEqual(roadWithoutLinkMask(road), roadWithoutLinkMask(source))
    ) throw new Error('saved Boneyard Road geometry does not match its source')
    return { ...road, linkMask: source.linkMask }
  })
  const scene = { ...loaded.scene, roads }
  return {
    ...loaded,
    choice: canonical.choice,
    geometrySha256: boneyardGeometrySha256(scene),
    scene,
    sourceSha256: canonical.sourceSha256,
  }
}

export function materializeBoneyard(
  catalog: BoneyardCatalog,
  boneyardId: string,
  seedBytes: Buffer = randomBytes(16),
): LoadedBoneyard | null {
  if (seedBytes.length < 4) throw new Error('Boneyard seed needs at least four bytes')
  const seed = seedBytes.toString('hex')
  const runId = randomBytes(16).toString('hex')
  if (boneyardId === DEFAULT_BONEYARD_CHOICE.id) {
    const template = NATIVE_GENERATED_BONEYARDS[
      seedBytes.readUInt32BE(0) % NATIVE_GENERATED_BONEYARDS.length
    ]
    return {
      choice: DEFAULT_BONEYARD_CHOICE,
      runId,
      seed,
      sourceSha256: template.sourceSha256,
      geometrySha256: template.geometrySha256,
      scene: template.scene,
    }
  }
  const entry = catalog.modEntries.get(boneyardId)
  if (!entry) return null
  return {
    choice: entry.choice,
    geometrySha256: entry.geometrySha256,
    runId,
    scene: entry.scene,
    seed,
    sourceSha256: entry.sourceSha256,
  }
}

export function materializeStockTutorial(
  seedBytes: Buffer = randomBytes(16),
): LoadedBoneyard {
  if (seedBytes.length < 4) throw new Error('Tutorial seed needs at least four bytes')
  return {
    choice: STOCK_TUTORIAL_CHOICE,
    geometrySha256: STOCK_TUTORIAL_BONEYARD.geometrySha256,
    runId: randomBytes(16).toString('hex'),
    scene: STOCK_TUTORIAL_BONEYARD.scene,
    seed: seedBytes.toString('hex'),
    sourceSha256: STOCK_TUTORIAL_BONEYARD.sourceSha256,
  }
}

function canonicalSavedBoneyardSource(
  catalog: BoneyardCatalog,
  loaded: LoadedBoneyard,
): Pick<ModBoneyardEntry, 'choice' | 'scene' | 'sourceSha256'> | null {
  if (loaded.choice.source === 'mod') {
    const entry = catalog.modEntries.get(loaded.choice.id)
    return entry?.sourceSha256 === loaded.sourceSha256 ? entry : null
  }
  if (loaded.choice.id === DEFAULT_BONEYARD_CHOICE.id) {
    const template = NATIVE_GENERATED_BONEYARDS.find(candidate => (
      candidate.sourceSha256 === loaded.sourceSha256
    ))
    return template ? { ...template, choice: DEFAULT_BONEYARD_CHOICE } : null
  }
  if (
    loaded.choice.id === STOCK_TUTORIAL_CHOICE.id
    && loaded.sourceSha256 === STOCK_TUTORIAL_BONEYARD.sourceSha256
  ) {
    return { ...STOCK_TUTORIAL_BONEYARD, choice: STOCK_TUTORIAL_CHOICE }
  }
  return null
}

function nativeRoadLinkMask(value: unknown): value is 0 | 1 | 2 | 3 {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3
}

function roadWithoutLinkMask(
  road: BoneyardScene['roads'][number],
): Omit<BoneyardScene['roads'][number], 'linkMask'> {
  const { linkMask: _linkMask, ...geometry } = road
  return geometry
}
