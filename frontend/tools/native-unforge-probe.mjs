import { Container, Graphics, RenderTexture } from 'pixi.js'
import { nativeUiAtlasSource } from '../src/game/native-ui/assets.ts'
import { destroyNativeUiPixiFor, nativeUiPixiFor } from '../src/game/native-ui/pixi.ts'
import { createGameWebGlApplication, loadGameTextureMap } from '../src/game/renderer/game-webgl.ts'
import { NativeUnforgeTargetView } from '../src/game/renderer/native-unforge-target-view.ts'

export async function inspectNativeUnforge(reference) {
  const gpu = await createGameWebGlApplication({ className: 'native-unforge-probe', width: 256, height: 256, backgroundAlpha: 0 })
  const resources = await loadGameTextureMap({ stock: [nativeUiAtlasSource('UI')] })
  const adapter = nativeUiPixiFor(resources)
  const view = new NativeUnforgeTargetView(record => adapter.texture('UI', record))
  const composite = view.container.children[0]
  const captured = composite.texture
  const target = RenderTexture.create({ alphaMode: 'no-premultiply-alpha', width: 256, height: 256 })
  const sentinel = new Graphics().rect(10, 10, 20, 20).fill(0x123456)
  gpu.application.stage.addChild(view.container, sentinel)
  const records = Object.fromEntries(Object.entries(reference.records).map(([key, value]) => [key, {
    ...value, pixels: Uint8Array.from(atob(value.rgba), character => character.charCodeAt(0)),
  }]))
  const samples = []
  try {
    for (let tick = 0; tick <= 440; tick += 8) {
      view.update(gpu.application.renderer, tick, 1, 256, 256)
      const actual = gpu.application.renderer.extract.pixels({ target: captured }).pixels
      const expected = referenceCapture(records, tick)
      samples.push({ tick, ...compare(actual, expected), visiblePixels: alphaPixels(actual) })
    }
    const final = []
    for (const [tick, reveal] of [[0, 1], [90, 1], [270, 1], [8, 0.5], [432, 0]]) {
      view.container.alpha = reveal
      view.update(gpu.application.renderer, tick, reveal, 256, 256)
      gpu.application.renderer.render({ container: gpu.application.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
      const actual = gpu.application.renderer.extract.pixels({ target }).pixels
      const expected = referenceComposite(records, referenceCapture(records, tick), tick, reveal)
      for (let y = 10; y < 30; y += 1) for (let x = 10; x < 30; x += 1) expected.set([18, 52, 86, 255], (y * 256 + x) * 4)
      final.push({ tick, reveal, ...compare(actual, expected) })
    }
    const replacement = new Container()
    gpu.application.stage.addChild(replacement)
    replacement.addChild(view.container)
    view.update(gpu.application.renderer, 441, 1, 256, 256)
    const retainedTarget = composite.texture === captured
    const borrowed = [75, 76, 77].map(record => adapter.texture('UI', record))
    view.destroy()
    return { samples, final, retainedTarget, targetDestroyed: captured.destroyed, borrowedTexturesAlive: borrowed.every(texture => !texture.destroyed) }
  } finally {
    if (!view.container.destroyed) view.destroy()
    target.destroy(true)
    gpu.destroy()
    destroyNativeUiPixiFor(resources)
    resources.destroy()
  }
}

// Independent stock program: integer scissor, two normal image draws and
// ZERO/SRCCOLOR mask. Each D3D target write rounds to its eight-bit channels.
function referenceCapture(records, tick) {
  const output = new Uint8Array(256 * 256 * 4)
  const scroll = Math.trunc(tick / 8) % 55
  for (let y = 109; y < 148; y += 1) for (let x = 103; x < 154; x += 1) {
    let pixel = [0, 0, 0, 0]
    for (const centerY of [128 - scroll, 182 - scroll]) {
      const source = recordPixel(records['77'], x + 0.5, y + 0.5, 128, centerY)
      if (source) pixel = blend(pixel, source)
    }
    const mask = recordPixel(records['76'], x + 0.5, y + 0.5, 128, 128)
    if (mask) pixel = pixel.map((value, channel) => Math.round(value * mask[channel]))
    output.set(pixel, (y * 256 + x) * 4)
  }
  return output
}

function referenceComposite(records, capture, tick, reveal) {
  const output = new Uint8Array(256 * 256 * 4)
  const anchorX = 218 + (1 - reveal) * 25
  const red = Math.round((Math.sin(tick * Math.PI / 180) * 0.2 + 0.6) * 255) / 255
  for (let y = 80; y < 256; y += 1) for (let x = 70; x < 256; x += 1) {
    const sample = linear(capture, 256, 256, x - anchorX + 128.5, y - 224 + 128.5)
    sample[3] *= reveal
    let pixel = blend([0, 0, 0, 0], sample, false)
    const marker = recordPixel(records['75'], x + 0.5, y + 0.5, anchorX, 224)
    if (marker) { marker[0] *= red; marker[3] *= reveal; pixel = blend(pixel, marker, false) }
    output.set(pixel, (y * 256 + x) * 4)
  }
  return output
}

function recordPixel(record, x, y, centerX, centerY) {
  const [width, height] = record.record.logicalSize
  const relativeX = x - centerX + width / 2
  const relativeY = y - centerY + height / 2
  if (relativeX < 0 || relativeX >= width || relativeY < 0 || relativeY >= height) return null
  return linear(record.pixels, width, height, relativeX * (width - 1) / width, relativeY * (height - 1) / height)
}

function linear(pixels, width, height, x, y) {
  x = Math.max(0, Math.min(width - 1, x)); y = Math.max(0, Math.min(height - 1, y))
  const left = Math.floor(x); const top = Math.floor(y)
  const right = Math.min(width - 1, left + 1); const bottom = Math.min(height - 1, top + 1)
  const fx = x - left; const fy = y - top
  return [0, 1, 2, 3].map(channel => (
    pixels[(top * width + left) * 4 + channel] * (1 - fx) * (1 - fy)
    + pixels[(top * width + right) * 4 + channel] * fx * (1 - fy)
    + pixels[(bottom * width + left) * 4 + channel] * (1 - fx) * fy
    + pixels[(bottom * width + right) * 4 + channel] * fx * fy
  ) / 255)
}

function blend(destination, source, nativeAlpha = true) {
  const alpha = source[3]
  return destination.map((value, channel) => Math.round(
    255 * (channel === 3 && !nativeAlpha ? alpha : source[channel] * alpha) + value * (1 - alpha),
  ))
}

function compare(actual, expected) {
  let differentChannels = 0; let maximumError = 0
  const failures = []
  for (let offset = 0; offset < actual.length; offset += 1) {
    const error = Math.abs(actual[offset] - expected[offset])
    maximumError = Math.max(maximumError, error)
    if (error > 2) { differentChannels += 1; if (failures.length < 8) failures.push({ offset, actual: actual[offset], expected: expected[offset] }) }
  }
  return { differentChannels, maximumError, failures }
}

function alphaPixels(pixels) {
  let count = 0
  for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset]) count += 1
  return count
}
