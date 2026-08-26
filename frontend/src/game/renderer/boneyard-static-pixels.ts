export interface BoneyardStaticPixelRegion {
  readonly height: number
  readonly pixels: Uint8ClampedArray
  readonly width: number
  readonly x: number
  readonly y: number
}

export function cropBoneyardStaticPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): BoneyardStaticPixelRegion | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX || maxY < minY) return null

  const croppedWidth = maxX - minX + 1
  const croppedHeight = maxY - minY + 1
  if (croppedWidth === width && croppedHeight === height) {
    return { height, pixels, width, x: 0, y: 0 }
  }

  const cropped = new Uint8ClampedArray(croppedWidth * croppedHeight * 4)
  for (let y = 0; y < croppedHeight; y += 1) {
    const sourceStart = ((minY + y) * width + minX) * 4
    const targetStart = y * croppedWidth * 4
    cropped.set(
      pixels.subarray(sourceStart, sourceStart + croppedWidth * 4),
      targetStart,
    )
  }
  return {
    height: croppedHeight,
    pixels: cropped,
    width: croppedWidth,
    x: minX,
    y: minY,
  }
}
