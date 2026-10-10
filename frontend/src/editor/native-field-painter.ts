import {
  createNativeArenaFieldLattice,
  nativeArenaFieldDescriptor,
  nativeArenaFieldTileCorners,
  nativeArenaFieldVisibleRange,
  type NativeArenaFieldBounds,
  type NativeArenaFieldLattice,
} from '../game/native-arena-field.ts'

interface FieldCamera {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

const descriptor = nativeArenaFieldDescriptor(0) // Bonedit always uses record 12.
const sourceX = descriptor.uvs[0]! * descriptor.page.width
const sourceY = descriptor.uvs[1]! * descriptor.page.height
const sourceWidth = (descriptor.uvs[2]! - descriptor.uvs[0]!) * descriptor.page.width
const sourceHeight = (descriptor.uvs[5]! - descriptor.uvs[1]!) * descriptor.page.height
const lattices = new WeakMap<NativeArenaFieldBounds, NativeArenaFieldLattice>()

/** Editor documents retain immutable authored bounds across pointer gestures. */
export function nativeEditorFieldLattice(bounds: NativeArenaFieldBounds): NativeArenaFieldLattice {
  let lattice = lattices.get(bounds)
  if (!lattice) {
    lattice = createNativeArenaFieldLattice(bounds)
    lattices.set(bounds, lattice)
  }
  return lattice
}

/**
 * The shared field descriptor's endpoints address the full original atlas.
 * Canvas drawImage with a fractional source crop has different tied-edge
 * ownership. Instead sample the full page through the exact UV-derived affine
 * transform, clipping only output coverage. D3D9 has integer pixel centers and
 * top-left inclusion; Canvas samples half-integer centers. The +0.5 placement
 * below is in actual device pixels, independent of CSS density and zoom.
 *
 * Low-quality Canvas smoothing is the measured bilinear path. The Mac browser
 * qualification in ledger 272 compares all pixels, including tile seams, with
 * an independent integer-center bilinear oracle. This is a sampler contract,
 * not a claim about native final lighting/composition RGB.
 *
 * Returns the strict primary-view tile count, or -1 while the atlas is unready.
 */
export function drawNativeEditorField(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  bounds: NativeArenaFieldBounds,
  cam: FieldCamera,
  cssWidth: number,
  cssHeight: number,
): number {
  if (!atlas.complete || atlas.naturalWidth === 0) return -1
  if (atlas.naturalWidth !== descriptor.page.width || atlas.naturalHeight !== descriptor.page.height) {
    throw new Error('Native editor field requires the full 2048 by 2048 DeadHawg atlas')
  }
  const transform = ctx.getTransform()
  if (transform.b !== 0 || transform.c !== 0 || !(transform.a > 0) || !(transform.d > 0)) {
    throw new Error('Native editor field requires a positive axis-aligned device transform')
  }
  const lattice = nativeEditorFieldLattice(bounds)
  const range = nativeArenaFieldVisibleRange(lattice, {
    x: cam.x - cssWidth / (2 * cam.zoom),
    y: cam.y - cssHeight / (2 * cam.zoom),
    w: cssWidth / cam.zoom,
    h: cssHeight / cam.zoom,
  })
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'low'
  for (let xi = range.xStart; xi < range.xEnd; xi += 1) {
    for (let yi = range.yStart; yi < range.yEnd; yi += 1) {
      const corners = nativeArenaFieldTileCorners(lattice.x[xi]!, lattice.y[yi]!)
      const left = ((corners.left - cam.x) * cam.zoom + cssWidth / 2) * transform.a + transform.e
      const top = ((corners.top - cam.y) * cam.zoom + cssHeight / 2) * transform.d + transform.f
      const right = ((corners.right - cam.x) * cam.zoom + cssWidth / 2) * transform.a + transform.e
      const bottom = ((corners.bottom - cam.y) * cam.zoom + cssHeight / 2) * transform.d + transform.f
      const pixelLeft = Math.ceil(left)
      const pixelTop = Math.ceil(top)
      const pixelWidth = Math.ceil(right) - pixelLeft
      const pixelHeight = Math.ceil(bottom) - pixelTop
      if (pixelWidth === 0 || pixelHeight === 0) continue
      const scaleX = (right - left) / sourceWidth
      const scaleY = (bottom - top) / sourceHeight
      ctx.save()
      ctx.beginPath()
      ctx.rect(pixelLeft, pixelTop, pixelWidth, pixelHeight)
      ctx.clip()
      ctx.drawImage(
        atlas,
        left + 0.5 - sourceX * scaleX,
        top + 0.5 - sourceY * scaleY,
        descriptor.page.width * scaleX,
        descriptor.page.height * scaleY,
      )
      ctx.restore()
    }
  }
  ctx.restore()
  return range.tileCount
}
