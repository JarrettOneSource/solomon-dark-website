import type { BoneyardBounds, BoneyardPoint, BoneyardScene } from '../core-kernels/boneyard.ts'
import { nativeCompactSurfaceContains } from '../core-kernels/native-ground-auxiliary.ts'
import { buildNativeBridgeSurfaces, buildNativeTerrainSurface, nativeBridgeSurfaceContains, nativeSurfaceQuadBounds, nativeSurfaceQuadContains, type NativeBridgeSurface, type NativeSurfaceQuad } from '../core-kernels/native-terrain-surface.ts'
import type { BoneyardSpiderRemainsSnapshot } from '../protocol/spider-state.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { compactGridCells } from './native-compact-grid.ts'

interface SurfaceRecord {
  readonly selector: number
  readonly position: Readonly<BoneyardPoint>
  readonly bounds: Readonly<BoneyardBounds>
}

/** Arena 004677A0: Terrain +8F24, bridge subtraction, then compact +8F84. */
export class NativeCompactGroundSurface {
  private readonly maximumColumn: number
  private readonly maximumRow: number
  private readonly authored = new Map<number, SurfaceRecord[]>()
  private readonly dynamic = new Map<number, SurfaceRecord[]>()
  private readonly terrain = new Map<number, NativeSurfaceQuad[]>()
  private readonly bridges: readonly NativeBridgeSurface[]
  private lastRemains: readonly BoneyardSpiderRemainsSnapshot[] | null = null

  constructor(scene: BoneyardScene) {
    this.maximumColumn = Math.trunc(Math.trunc(scene.bounds.w) / 50 + 0.5)
    this.maximumRow = Math.trunc(Math.trunc(scene.bounds.h) / 50 + 0.5)
    const surfaces = scene.terrain.map(buildNativeTerrainSurface)
    this.bridges = buildNativeBridgeSurfaces(surfaces, scene.roads)
    for (const { quads } of surfaces) {
      for (const quad of quads) {
        const cells = compactGridCells(nativeSurfaceQuadBounds(quad), this.maximumColumn, this.maximumRow)
        for (let row = cells.top; row <= cells.bottom; row += 1) {
          for (let column = cells.left; column <= cells.right; column += 1) {
            const key = this.key(column, row)
            const entries = this.terrain.get(key)
            if (entries) entries.push(quad)
            else this.terrain.set(key, [quad])
          }
        }
      }
    }
    for (const sprite of scene.sprites) {
      if (sprite.atlasEntry >= 25 && sprite.atlasEntry <= 29) {
        this.insert(this.authored, this.record(sprite.atlasEntry, sprite.pos))
      }
    }
  }

  contains(point: Readonly<BoneyardPoint>, remains: readonly BoneyardSpiderRemainsSnapshot[]): boolean {
    if (remains !== this.lastRemains) {
      this.dynamic.clear()
      for (const { state } of remains) {
        if (state.decal !== null) this.insert(this.dynamic, this.record(state.decal.entry - 114, state.decal.position))
      }
      this.lastRemains = remains
    }
    const nativePoint = { x: Math.fround(point.x), y: Math.fround(point.y) }
    const cell = compactGridCells({ ...nativePoint, w: 0, h: 0 }, this.maximumColumn, this.maximumRow)
    const key = this.key(cell.left, cell.top)
    for (const quad of this.terrain.get(key) ?? []) {
      if (!nativeSurfaceQuadContains(quad, nativePoint)) continue
      for (const bridge of this.bridges) {
        if (nativeBridgeSurfaceContains(bridge, nativePoint)) return false
      }
      return true
    }
    return this.containsRecords(this.authored.get(key), nativePoint)
      || this.containsRecords(this.dynamic.get(key), nativePoint)
  }

  private containsRecords(records: readonly SurfaceRecord[] | undefined, point: Readonly<BoneyardPoint>): boolean {
    if (records === undefined) return false
    for (const record of records) {
      const { bounds } = record
      if (point.x < bounds.x || point.y < bounds.y || point.x > Math.fround(bounds.x + bounds.w) || point.y > Math.fround(bounds.y + bounds.h)) continue
      // 00467932..00467969 subtract only +4/+8. Rotation/scale belong to drawing.
      if (nativeCompactSurfaceContains(record.selector, {
        x: Math.fround(point.x - record.position.x), y: Math.fround(point.y - record.position.y),
      })) return true
    }
    return false
  }

  private record(selector: number, position: Readonly<BoneyardPoint>): SurfaceRecord {
    const glyph = nativeEnemySpriteRecord('DeadHawg', selector + 114)
    const storedPosition = { x: Math.fround(position.x), y: Math.fround(position.y) }
    return { selector, position: storedPosition, bounds: { x: Math.fround(storedPosition.x - glyph.width / 2),
      y: Math.fround(storedPosition.y - glyph.height / 2), w: glyph.width, h: glyph.height } }
  }

  private insert(grid: Map<number, SurfaceRecord[]>, record: SurfaceRecord): void {
    const cells = compactGridCells(record.bounds, this.maximumColumn, this.maximumRow)
    for (let row = cells.top; row <= cells.bottom; row += 1) {
      for (let column = cells.left; column <= cells.right; column += 1) {
        const key = this.key(column, row)
        let entries = grid.get(key)
        if (!entries) { entries = []; grid.set(key, entries) }
        entries.push(record)
      }
    }
  }

  private key(column: number, row: number): number {
    return (row + 1) * (this.maximumColumn + 2) + column + 1
  }
}
