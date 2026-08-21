import { createHash, randomBytes } from 'node:crypto'
import { basename } from 'node:path'

import { parseBoneyard } from '../../editor/format/boneyard.ts'
import type {
  BoneyardChoice,
  BoneyardScene,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'
import { NATIVE_GENERATED_BONEYARDS } from './native-generated-boneyards.ts'
import {
  boneyardGeometrySha256,
  projectBoneyard,
} from './project-boneyard.ts'

export const DEFAULT_BONEYARD_CHOICE: BoneyardChoice = {
  id: 'default-random',
  name: 'Random Boneyard',
  source: 'default',
}

export interface ModBoneyardEntry {
  choice: BoneyardChoice
  geometrySha256: string
  scene: BoneyardScene
  sourceSha256: string
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
    ...entry,
    runId,
    seed,
  }
}
