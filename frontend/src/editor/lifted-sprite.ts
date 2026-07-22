// Canvas filters are surprisingly expensive when applied to hundreds of
// sprites on every frame. Bake the editor's small brightness lift once per
// decoded image, then reuse the resulting pixels like an ordinary sprite.

const lifted = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

export function liftedSpriteSource(
  image: HTMLImageElement,
  makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): CanvasImageSource {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return image

  const cached = lifted.get(image)
  if (cached) return cached

  const canvas = makeCanvas()
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) return image

  context.filter = 'brightness(1.12)'
  context.drawImage(image, 0, 0)
  lifted.set(image, canvas)
  return canvas
}
