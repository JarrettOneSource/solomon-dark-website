import assert from 'node:assert/strict'
import { parseArgs } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'

import { chromium } from 'playwright-core'

const { values } = parseArgs({
  options: {
    candidate: { type: 'string' },
    'max-shift': { default: '0', type: 'string' },
    output: { type: 'string' },
    reference: { type: 'string' },
    region: { multiple: true, type: 'string' },
    threshold: { default: '16', type: 'string' },
  },
})

assert.ok(values.reference, '--reference is required')
assert.ok(values.candidate, '--candidate is required')
assert.ok(values.output, '--output is required')

const maxShift = parseUnsignedInteger(values['max-shift'], '--max-shift')
const threshold = parseUnsignedInteger(values.threshold, '--threshold')
assert.ok(threshold <= 255, '--threshold must be at most 255')

const [referenceBytes, candidateBytes] = await Promise.all([
  readFile(values.reference),
  readFile(values.candidate),
])
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage()
  const comparison = await page.evaluate(async ({ candidate, maxShift, reference, regions, threshold }) => {
    const [referenceImage, candidateImage] = await Promise.all([
      decodePng(reference),
      decodePng(candidate),
    ])
    if (
      referenceImage.width !== candidateImage.width
      || referenceImage.height !== candidateImage.height
    ) {
      throw new Error(
        `image dimensions differ: reference ${referenceImage.width}x${referenceImage.height}, `
        + `candidate ${candidateImage.width}x${candidateImage.height}`,
      )
    }

    const width = referenceImage.width
    const height = referenceImage.height
    const referencePixels = pixelsFor(referenceImage)
    const candidatePixels = pixelsFor(candidateImage)
    const parsedRegions = regions.length > 0
      ? regions.map((value) => parseRegion(value, width, height))
      : [{ height, name: 'full', width, x: 0, y: 0 }]
    const metrics = parsedRegions.map((region) => {
      let best
      for (let dy = -maxShift; dy <= maxShift; dy += 1) {
        for (let dx = -maxShift; dx <= maxShift; dx += 1) {
          const score = compareRegion(
            referencePixels,
            candidatePixels,
            width,
            height,
            region,
            dx,
            dy,
            threshold,
          )
          if (!best || score.absoluteChannelDeltaSum < best.absoluteChannelDeltaSum) {
            best = score
          }
        }
      }
      return { ...best, name: region.name, region }
    })

    const overlayCanvas = document.createElement('canvas')
    overlayCanvas.width = width
    overlayCanvas.height = height
    const overlayContext = overlayCanvas.getContext('2d', { alpha: false })
    overlayContext.drawImage(referenceImage, 0, 0)
    overlayContext.globalAlpha = 0.5
    overlayContext.drawImage(candidateImage, 0, 0)

    const diffCanvas = document.createElement('canvas')
    diffCanvas.width = width
    diffCanvas.height = height
    const diffContext = diffCanvas.getContext('2d')
    const diffImage = diffContext.createImageData(width, height)
    for (let index = 0; index < referencePixels.length; index += 4) {
      const red = Math.abs(referencePixels[index] - candidatePixels[index])
      const green = Math.abs(referencePixels[index + 1] - candidatePixels[index + 1])
      const blue = Math.abs(referencePixels[index + 2] - candidatePixels[index + 2])
      const alpha = Math.abs(referencePixels[index + 3] - candidatePixels[index + 3])
      const delta = Math.max(red, green, blue, alpha)
      diffImage.data[index] = 255
      diffImage.data[index + 1] = delta <= threshold ? 180 : 0
      diffImage.data[index + 2] = 0
      diffImage.data[index + 3] = delta
    }
    diffContext.putImageData(diffImage, 0, 0)

    return {
      candidate: { height, width },
      metrics,
      output: {
        diff: diffCanvas.toDataURL('image/png'),
        overlay: overlayCanvas.toDataURL('image/png'),
      },
      reference: { height, width },
      threshold,
    }

    async function decodePng(base64) {
      const binary = atob(base64)
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    }

    function pixelsFor(image) {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, image.width, image.height).data
    }

    function parseRegion(value, imageWidth, imageHeight) {
      const separator = value.indexOf(':')
      if (separator <= 0) throw new Error(`invalid region ${value}`)
      const name = value.slice(0, separator)
      const [x, y, regionWidth, regionHeight] = value.slice(separator + 1).split(',').map(Number)
      if (
        ![x, y, regionWidth, regionHeight].every(Number.isInteger)
        || x < 0
        || y < 0
        || regionWidth <= 0
        || regionHeight <= 0
        || x + regionWidth > imageWidth
        || y + regionHeight > imageHeight
      ) {
        throw new Error(`invalid region bounds ${value} for ${imageWidth}x${imageHeight}`)
      }
      return { height: regionHeight, name, width: regionWidth, x, y }
    }

    function compareRegion(referenceData, candidateData, imageWidth, imageHeight, region, dx, dy, limit) {
      let absoluteChannelDeltaSum = 0
      let comparedPixels = 0
      let exactDifferingPixels = 0
      let thresholdDifferingPixels = 0
      let squaredChannelDeltaSum = 0
      let maxChannelDelta = 0
      let minX = Number.POSITIVE_INFINITY
      let minY = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      let maxY = Number.NEGATIVE_INFINITY

      for (let y = region.y; y < region.y + region.height; y += 1) {
        for (let x = region.x; x < region.x + region.width; x += 1) {
          const candidateX = x + dx
          const candidateY = y + dy
          if (candidateX < 0 || candidateY < 0 || candidateX >= imageWidth || candidateY >= imageHeight) {
            continue
          }
          const referenceIndex = (y * imageWidth + x) * 4
          const candidateIndex = (candidateY * imageWidth + candidateX) * 4
          let exactDifference = false
          let thresholdDifference = false
          for (let channel = 0; channel < 4; channel += 1) {
            const delta = Math.abs(
              referenceData[referenceIndex + channel] - candidateData[candidateIndex + channel],
            )
            absoluteChannelDeltaSum += delta
            squaredChannelDeltaSum += delta * delta
            maxChannelDelta = Math.max(maxChannelDelta, delta)
            exactDifference ||= delta !== 0
            thresholdDifference ||= delta > limit
          }
          comparedPixels += 1
          exactDifferingPixels += Number(exactDifference)
          thresholdDifferingPixels += Number(thresholdDifference)
          if (thresholdDifference) {
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
      }

      const channelCount = comparedPixels * 4
      return {
        absoluteChannelDeltaSum,
        bestOffset: { x: dx, y: dy },
        comparedPixels,
        exactDifferingPixels,
        exactDifferingRatio: exactDifferingPixels / comparedPixels,
        maxChannelDelta,
        meanAbsoluteChannelDelta: absoluteChannelDeltaSum / channelCount,
        rootMeanSquareChannelDelta: Math.sqrt(squaredChannelDeltaSum / channelCount),
        thresholdDiffBounds: thresholdDifferingPixels === 0
          ? null
          : { height: maxY - minY + 1, width: maxX - minX + 1, x: minX, y: minY },
        thresholdDifferingPixels,
        thresholdDifferingRatio: thresholdDifferingPixels / comparedPixels,
      }
    }
  }, {
    candidate: candidateBytes.toString('base64'),
    maxShift,
    reference: referenceBytes.toString('base64'),
    regions: values.region ?? [],
    threshold,
  })

  const serializable = {
    ...comparison,
    candidate: { ...comparison.candidate, path: values.candidate },
    reference: { ...comparison.reference, path: values.reference },
  }
  delete serializable.output
  await Promise.all([
    writeFile(`${values.output}.json`, `${JSON.stringify(serializable, null, 2)}\n`),
    writeDataUrl(`${values.output}-diff.png`, comparison.output.diff),
    writeDataUrl(`${values.output}-overlay.png`, comparison.output.overlay),
  ])
  process.stdout.write(`${JSON.stringify(serializable, null, 2)}\n`)
} finally {
  await browser.close()
}

function parseUnsignedInteger(value, label) {
  const parsed = Number(value)
  assert.ok(Number.isInteger(parsed) && parsed >= 0, `${label} must be a non-negative integer`)
  return parsed
}

async function writeDataUrl(path, value) {
  const marker = 'base64,'
  const markerIndex = value.indexOf(marker)
  assert.notEqual(markerIndex, -1, `invalid data URL for ${path}`)
  await writeFile(path, Buffer.from(value.slice(markerIndex + marker.length), 'base64'))
}
