import assert from 'node:assert/strict'

export async function assertStockCloudSurfaces(page) {
  const screenshot = await page.screenshot({ scale: 'css' })
  // Decode outside the application's CSP; this is screenshot analysis, not game UI.
  const reader = await page.context().browser().newPage()
  let means
  try {
    means = await reader.evaluate(async encoded => {
      const source = new Image()
      source.src = `data:image/png;base64,${encoded}`
      await source.decode()
      const canvas = document.createElement('canvas')
      canvas.width = source.width
      canvas.height = source.height
      const context = canvas.getContext('2d')
      context.drawImage(source, 0, 0)
      return [[260, 95, 140, 50], [270, 160, 160, 13], [40, 285, 15, 135], [5, 275, 30, 145]].map(rect => {
        const { data } = context.getImageData(...rect)
        let sum = 0
        for (let index = 0; index < data.length; index += 4) sum += (data[index] + data[index + 1] + data[index + 2]) / 3
        return sum / (data.length / 4)
      })
    }, screenshot.toString('base64'))
  } finally {
    await reader.close()
    await page.bringToFront()
  }
  const reference = [12.85, 53.60, 54.89, 30.46]
  for (let index = 0; index < means.length; index += 1) {
    assert.ok(Math.abs(means[index] - reference[index]) < 4, `Stock surface ${index} brightness ${means[index]} differs from ${reference[index]}`)
  }
  return means
}

export async function assertNativeCloudChrome(scope) {
  assert.deepEqual(await scope.locator('[data-native-ui-unsupported]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-native-ui-unsupported'))), [])
  const plainControls = await scope.locator('button').evaluateAll(buttons => buttons.filter(button => {
    const art = button.querySelector('[data-native-ui-plan], [data-native-ui-font], [data-native-ui-content-text]')
      ?? button.closest('[data-native-ui-tabs]')?.querySelector('[data-native-ui-plan]')
    return button.getClientRects().length > 0 && !art
  }).map(button => button.getAttribute('aria-label') ?? button.textContent))
  assert.deepEqual(plainControls, [], 'all Dark Cloud controls must use the kit')
}

export async function darkCloudGeometry(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return page.evaluate(() => {
    const rect = selector => {
      const bounds = document.querySelector(selector).getBoundingClientRect()
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    }
    const records = selector => [...document.querySelectorAll(`${selector} [data-native-ui-record]`)]
      .map(record => record.getAttribute('data-native-ui-record'))
    const slices = selector => [...document.querySelectorAll(`${selector} [data-native-ui-slice]`)]
      .map(record => record.getAttribute('data-native-ui-slice'))
    const touchTargets = [...document.querySelectorAll(
      '.dark-cloud-heading button, .dark-cloud-tabs button, .dark-cloud-footer button, .dark-cloud-row-actions button',
    )].filter(element => element.getClientRects().length > 0)
      .map(element => element.getBoundingClientRect().height)
    const scene = document.querySelector('.dark-cloud-scene')
    return {
      scene: rect('.dark-cloud-scene'),
      stage: rect('.dark-cloud-stage'),
      list: rect('.dark-cloud-list-frame'),
      tabs: rect('.dark-cloud-tabs'),
      selectedTabBracket: rect('[data-native-ui-node="mods:bracket-left"]'),
      restingTabBracket: rect('[data-native-ui-node="subscribed:bracket-left"]'),
      search: rect('[data-native-dark-cloud-tool="search"]'),
      sort: rect('[data-native-dark-cloud-tool="sort"]'),
      primary: rect('.dark-cloud-primary-button'),
      options: rect('[data-native-dark-cloud-tool="options"]'),
      stageTransform: getComputedStyle(document.querySelector('.dark-cloud-stage')).transform,
      horizontalOverflow: Math.max(0, scene.scrollWidth - scene.clientWidth),
      minimumTouchTarget: Math.min(...touchTargets),
      sceneArtRecords: records('.dark-cloud-native-scene-art'),
      listArtRecords: records('.dark-cloud-native-list-art'),
      listFrames: [...scene.querySelectorAll('.dark-cloud-native-list-art [data-native-ui-nine-slice]')].map(node => node.dataset.nativeUiNineSlice),
      tabRecords: slices('.dark-cloud-tabs'),
      footerRecords: records('.dark-cloud-footer'),
      footerSlices: slices('.dark-cloud-footer'),
      unsupportedBitmapText: [...scene.querySelectorAll('[data-native-ui-unsupported]')]
        .map(node => node.getAttribute('data-native-ui-unsupported')),
    }
  })
}

export function assertRectClose(actual, expected, tolerance = 0.6) {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(actual[key] - expected[key]) <= tolerance, JSON.stringify({ actual, expected }))
  }
}

export async function assertNativePanel(panel, { stoneFooter }) {
  const records = await panel.locator('.dark-cloud-native-panel-art [data-native-ui-record]')
    .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-native-ui-record')))
  assert.deepEqual(records, ['UI.18', 'UI.18'])
  const frames = await panel.locator('.dark-cloud-native-panel-art [data-native-ui-nine-slice]').evaluateAll(nodes => nodes.map(node => ({
    record: node.dataset.nativeUiNineSlice,
    shadow: node.querySelector('i').style.backgroundBlendMode === 'multiply',
  })))
  assert.deepEqual(frames, [{ record: 'UI.17', shadow: true }, { record: 'UI.17', shadow: false }])
  assert.equal(await panel.locator('[data-native-ui-unsupported]').count(), 0)
  assert.equal(
    await panel.locator('[data-native-ui-stone-button] [data-native-ui-record="UI.105"]').count(),
    stoneFooter ? 1 : 0,
  )
}

export async function assertPressedFace(button, idleRecord, pressedRecord) {
  assert.equal(await button.locator(`[data-native-ui-record="UI.${idleRecord}"]`).count(), 1)
  await button.dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' })
  assert.equal(await button.locator(`[data-native-ui-record="UI.${pressedRecord}"]`).count(), 1)
  await button.dispatchEvent('pointerup', { button: 0, pointerType: 'mouse' })
  assert.equal(await button.locator(`[data-native-ui-record="UI.${idleRecord}"]`).count(), 1)
}
