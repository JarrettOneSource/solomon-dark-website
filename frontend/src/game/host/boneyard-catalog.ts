import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'

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

export async function loadModBoneyardsFromStageReport(
  reportPath: string,
): Promise<readonly ModBoneyardEntry[]> {
  const absoluteReportPath = resolve(reportPath)
  const report = parseRecord(JSON.parse(await readFile(absoluteReportPath, 'utf8')), 'stage report')
  const enabledMods = parseArray(report.enabledMods, 'stage report enabledMods')
  const stageRoot = resolve(dirname(absoluteReportPath), '..')
  const finalOverlays = new Map<string, { modId: string; modName: string; target: string }>()
  for (const [modIndex, rawMod] of enabledMods.entries()) {
    const mod = parseRecord(rawMod, `enabledMods[${modIndex}]`)
    const modId = parseString(mod.Id, `enabledMods[${modIndex}].Id`, 128)
    const modName = parseString(mod.Name, `enabledMods[${modIndex}].Name`, 256)
    const overlays = parseArray(mod.overlays, `enabledMods[${modIndex}].overlays`)
    for (const [overlayIndex, rawOverlay] of overlays.entries()) {
      const overlay = parseRecord(rawOverlay, `enabledMods[${modIndex}].overlays[${overlayIndex}]`)
      const target = parseString(
        overlay.Target,
        `enabledMods[${modIndex}].overlays[${overlayIndex}].Target`,
        512,
      ).replaceAll('\\', '/')
      if (extname(target).toLowerCase() !== '.boneyard') continue
      if (!target.startsWith('data/levels/') && !target.startsWith('sandbox/DarkCloud/mylevels/')) {
        throw new Error(`${modId}: Boneyard overlay target is outside supported level roots`)
      }
      finalOverlays.set(target.toLowerCase(), { modId, modName, target })
    }
  }
  const entries: ModBoneyardEntry[] = []
  for (const { modId, modName, target } of finalOverlays.values()) {
    const targetPath = resolve(stageRoot, ...target.split('/'))
    assertWithin(stageRoot, targetPath)
    const bytes = await readFile(targetPath)
    const sourceSha256 = createHash('sha256').update(bytes).digest('hex')
    const scene = projectBoneyard(parseBoneyard(new Uint8Array(bytes)))
    const slug = basename(target, '.boneyard')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .toLowerCase()
      .slice(0, 64)
    const identitySha256 = createHash('sha256')
      .update(`${target}\0${sourceSha256}`)
      .digest('hex')
    entries.push({
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
    })
  }
  return entries
}

function assertWithin(root: string, path: string): void {
  const child = relative(root, path)
  if (!child || child === '..' || child.startsWith(`..${sep}`) || child.startsWith(sep)) {
    throw new Error('Boneyard overlay target escapes the staged game root')
  }
}

function parseRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function parseArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`)
  return value
}

function parseString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new Error(`${field} must be a nonempty string of at most ${maximum} characters`)
  }
  return value
}
