import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Rectangle, Sprite, Texture, TextureSource } from 'pixi.js'
import deadhawg from '../../editor/manifest/deadhawg.json' with { type: 'json' }
import type { EditorDoc, PlacedObject, Polyline, StaticSprite, Vec2 } from '../../editor/model.ts'
import type { ResidentTexture } from './boneyard-renderer-model.ts'
import { nativeSpriteRecordTexture } from './native-sprite-record-texture.ts'
import type { StaticWorldBuild } from './boneyard-renderer-model.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'

export const STATIC_ART_MANIFEST = deadhawg

export function staticArtDocument(objects: PlacedObject[] = [], sprites: StaticSprite[] = [], fences: Polyline[] = []): EditorDoc {
  return {
    meta: { name: 'native-static-art-invariants', bounds: { x: 0, y: 0, w: 3_200, h: 2_400 } },
    objects, sprites, fences, roads: [], terrain: [], opaque: [], hasTimeline: true,
  }
}

/** Read the generated source as data: importing it would require a PNG loader. */
export function staticArtPackedRecords(): Map<number, number[] | null> {
  const text = readFileSync(new URL('./boneyard-combat-atlas.generated.ts', import.meta.url), 'utf8')
  const entries = new Map<number, number[] | null>()
  for (const match of text.matchAll(/\["boneyard-combat:DeadHawg:(\d+)", (null|\[[^\]]+\])\]/g)) {
    entries.set(Number(match[1]), JSON.parse(match[2]!))
  }
  return entries
}

export function staticArtPage(): TextureSource {
  return new TextureSource({
    width: 2_048, height: 2_048, alphaMode: 'no-premultiply-alpha',
    scaleMode: 'linear', addressMode: 'repeat',
  })
}

export function staticArtTexture(entry: number, source: TextureSource): Texture {
  const packed = staticArtPackedRecords().get(entry)
  assert.ok(packed, `DeadHawg:${entry} must be a nonempty packed record`)
  const [, x, y, width, height, logicalWidth, logicalHeight, trimX, trimY] = packed
  return nativeSpriteRecordTexture({
    frame: new Rectangle(x, y, width, height),
    orig: new Rectangle(0, 0, logicalWidth, logicalHeight),
    source,
    trim: new Rectangle(trimX, trimY, width, height),
  })
}

export function staticArtExpectedRecord(entry: number) {
  const row = STATIC_ART_MANIFEST.entries[entry]
  if (!row || row.empty || !row.file) return null
  return {
    entry, w: row.rect.w, h: row.rect.h,
    anchorX: row.rect.w / 2 - row.origin.x,
    anchorY: row.rect.h / 2 - row.origin.y,
  }
}

/** Consumer-only fixture. Integration tests use the production resident factory. */
export function staticArtConsumerResident(entry: number, texture: Texture, position: Vec2, mainLayerIndex = 0): ResidentTexture {
  const record = staticArtExpectedRecord(entry)
  assert.ok(record)
  const x = position.x - record.anchorX
  const y = position.y - record.anchorY
  const sprite = new Sprite(texture)
  sprite.position.set(x, y)
  return {
    x, y, w: record.w, h: record.h, sprite, texture, mainLayerIndex,
    cleanupSourceKey: `object:record-${entry}`, pixels: new Uint8ClampedArray(0),
    ownsTexture: false, shadowCaster: null, surfaceMesh: null,
  }
}

export function assertNear(actual: number, expected: number, message = ''): void {
  assert.ok(Math.abs(actual - expected) < 1e-5, `${message}: ${actual} != ${expected}`)
}

export function mappedTextureUvs(texture: Texture, coordinates: ArrayLike<number>): number[] {
  const result: number[] = []
  const matrix = texture.textureMatrix.mapCoord
  for (let index = 0; index < coordinates.length; index += 2) {
    const x = coordinates[index]!
    const y = coordinates[index + 1]!
    result.push(x * matrix.a + y * matrix.c + matrix.tx, x * matrix.b + y * matrix.d + matrix.ty)
  }
  return result
}

export function expectedRecordUvs(entry: number, coordinates: ArrayLike<number>): number[] {
  const row = STATIC_ART_MANIFEST.entries[entry]!
  const u0 = (row.rect.x + 0.5) / 2_048
  const v0 = (row.rect.y + 0.5) / 2_048
  const du = (row.rect.w - 0.25) / 2_048
  const dv = (row.rect.h - 0.25) / 2_048
  const result: number[] = []
  for (let index = 0; index < coordinates.length; index += 2) {
    result.push(u0 + coordinates[index]! * du, v0 + coordinates[index + 1]! * dv)
  }
  return result
}

export function assertArrayNear(actual: ArrayLike<number>, expected: ArrayLike<number>, message: string): void {
  assert.equal(actual.length, expected.length, message)
  for (let index = 0; index < actual.length; index += 1) assertNear(actual[index]!, expected[index]!, `${message}[${index}]`)
}

/** Exercise the real build/cleanup owner, while making no GPU or pixel-parity claim. */
export async function withStaticWorldFixture(
  document: EditorDoc,
  cleanupBounds: { x: number; y: number; w: number; h: number },
  check: (build: StaticWorldBuild, root: import('pixi.js').Container, page: TextureSource, textures: ReadonlyMap<number, Texture>) => Promise<void> | void,
): Promise<void> {
  const { createServer } = await import('vite')
  const { Container } = await import('pixi.js')
  const globals = ['window', 'Image', 'requestAnimationFrame'] as const
  const previous = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  const canvas = () => {
    const value = { width: 0, height: 0, getContext: (kind: string) => kind === '2d' ? context : null }
    const context = new Proxy({
      canvas: value,
      getImageData: (_x: number, _y: number, width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4)
        // Coverage is synthetic. It permits comparison of source ownership and
        // transforms, while retained browser captures own actual sampling proof.
        for (let index = 3; index < data.length; index += 4) data[index] = 255
        return { data }
      },
      createPattern: () => null,
    }, { get(target, key) { return key in target ? Reflect.get(target, key) : () => undefined } })
    return value
  }
  class FixtureImage {
    complete = true
    naturalWidth = 2048
    naturalHeight = 2048
    width = 2048
    height = 2048
    src = ''
    addEventListener() {}
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { document: { createElement: canvas } } })
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FixtureImage })
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (callback: () => void) => { queueMicrotask(callback); return 1 } })
  const rootPath = fileURLToPath(new URL('../../../', import.meta.url))
  const baseline = process.env.NATIVE_STATIC_ART_BASELINE_SOURCE
  const server = await createServer({
    appType: 'custom', logLevel: 'silent', root: rootPath,
    server: { middlewareMode: true },
    plugins: baseline ? [{
      name: 'independent-static-art-baseline', enforce: 'pre',
      load(id) { return id === `${rootPath}src/game/renderer/boneyard-static-world.ts` ? readFileSync(baseline, 'utf8') : null },
    }] : [],
  })
  const page = staticArtPage(), root = new Container()
  const textures = new Map<number, Texture>()
  let build: StaticWorldBuild | undefined
  try {
    const module = await server.ssrLoadModule('/src/game/renderer/boneyard-static-world.ts') as typeof import('./boneyard-static-world.ts')
    const scene = { ...document, bounds: document.meta.bounds } as unknown as LoadedBoneyard['scene']
    const glyph = (entry: number) => {
      let texture = textures.get(entry)
      if (!texture) { texture = staticArtTexture(entry, page); textures.set(entry, texture) }
      return texture
    }
    build = await module.buildStaticWorld(document, scene, root,
      { ground: Texture.WHITE, roads: [] }, { glyph, fenceGrate: Texture.WHITE }, cleanupBounds)
    await check(build, root, page, textures)
  } finally {
    build?.surface.destroy()
    if (build) {
      const { destroyResidentTexture } = await import('./boneyard-resident-lifetime.ts')
      for (const resident of build.residents) destroyResidentTexture(resident)
    }
    root.destroy({ children: true })
    for (const texture of textures.values()) texture.destroy(false)
    page.destroy()
    await server.close()
    globals.forEach((key, index) => {
      const descriptor = previous[index]
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    })
  }
}
