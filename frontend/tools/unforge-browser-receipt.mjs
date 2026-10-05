import assert from 'node:assert/strict'

/** Green/blue motion distinguishes the scrolling capture from the red-only marker pulse. */
export async function unforgeBrowserReceipt(page, dialog, label) {
  const bounds = await dialog.locator('canvas.hub-inventory-native-canvas').boundingBox()
  assert.ok(bounds, `${label} has no painted inventory canvas`)
  const clip = {
    x: bounds.x + bounds.width * 1524 / 1600,
    y: bounds.y + bounds.height * 835 / 900,
    width: bounds.width * 76 / 1600,
    height: bounds.height * 64 / 900,
  }
  const frames = []
  for (let sample = 0; sample < 6; sample += 1) {
    frames.push((await page.screenshot({ clip })).toString('base64'))
    if (sample < 5) await page.waitForTimeout(220)
  }
  const receipt = await page.evaluate(async frames => {
    const pixels = await Promise.all(frames.map(async frame => {
      const image = new Image()
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve; image.onerror = reject
      })
      image.src = `data:image/png;base64,${frame}`
      await loaded
      const canvas = document.createElement('canvas')
      canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, canvas.width, canvas.height).data
    }))
    let changedGreenBluePixels = 0; let nonBlackPixels = 0
    for (let offset = 0; offset < pixels[0].length; offset += 4) {
      if (pixels[0][offset] + pixels[0][offset + 1] + pixels[0][offset + 2] > 24) nonBlackPixels += 1
      if (pixels.slice(1).some(frame => Math.abs(frame[offset + 1] - pixels[0][offset + 1]) > 2
        || Math.abs(frame[offset + 2] - pixels[0][offset + 2]) > 2)) changedGreenBluePixels += 1
    }
    return { changedGreenBluePixels, nonBlackPixels, samples: pixels.length }
  }, frames)
  assert.ok(receipt.nonBlackPixels > 20, JSON.stringify({ label, ...receipt }))
  assert.ok(receipt.changedGreenBluePixels > 5, JSON.stringify({ label, ...receipt }))
  return { label, ...receipt }
}
