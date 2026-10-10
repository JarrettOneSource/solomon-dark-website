import assert from 'node:assert/strict'

// Observe the normal public Pixi application tree; never modify its material.
export function installStormMaterialProbe() {
  const apps = []
  const previous = window.__PIXI_APP_INIT__
  window.__PIXI_APP_INIT__ = app => {
    previous?.(app)
    apps.push(app)
  }
  const samples = []
  const probeDiagnostics = { callbacks: 0, appCount: 0, traversals: 0, nodes: 0, maximumNodes: 0, maximumCallbackMs: 0, totalCallbackMs: 0, lastActorCount: null }
  window.__stormMaterialProbeDiagnostics = probeDiagnostics
  window.__stormMaterialSamples = samples
  let animationFrame = 0
  window.__stopStormMaterialProbe = () => cancelAnimationFrame(animationFrame)
  const observe = () => {
    const startedAt = performance.now()
    let visitedNodes = 0
    probeDiagnostics.callbacks += 1
    probeDiagnostics.appCount = apps.length
    for (const app of apps) {
      if (!app.stage || !app.canvas?.matches('.boneyard-world-canvas')) continue
      const frame = app.canvas.__sdrBoneyardFrame
      probeDiagnostics.lastActorCount = frame?.secondaryAbilityCount ?? null
      if (!(frame?.secondaryAbilityCount > 0)) continue
      probeDiagnostics.traversals += 1
      const visit = node => {
        visitedNodes += 1
        if (!node.visible || !node.renderable) return
        if (node.label?.startsWith('secondary:storm-weather-strike-flash:')) {
          const source = node.texture.source
          samples.push({ alpha: node.alpha, blend: node.blendMode,
            filterCount: node.filters?.length ?? 0, label: node.label,
            resolution: app.renderer.resolution, sourceAlphaMode: source.alphaMode,
            sourceAddressMode: source.style.addressMode, sourceId: source.uid,
            tick: frame?.tick, tint: node.tint, observedAtMs: performance.now() })
        }
        for (const child of node.children ?? []) visit(child)
      }
      visit(app.stage)
    }
    if (samples.length > 2000) samples.splice(0, samples.length - 2000)
    probeDiagnostics.nodes += visitedNodes
    probeDiagnostics.maximumNodes = Math.max(probeDiagnostics.maximumNodes, visitedNodes)
    const duration = performance.now() - startedAt
    probeDiagnostics.totalCallbackMs += duration
    probeDiagnostics.maximumCallbackMs = Math.max(probeDiagnostics.maximumCallbackMs, duration)
    animationFrame = requestAnimationFrame(observe)
  }
  animationFrame = requestAnimationFrame(observe)
}

export async function acceptStormMaterial({ page, screenshotRoot }) {
  try {
    await page.waitForFunction(() => window.__stormMaterialSamples?.some(sample => sample.alpha > 0),
      undefined, { timeout: 15000 })
  } finally {
    await page.evaluate(() => window.__stopStormMaterialProbe?.())
  }
  const samples = await page.evaluate(() => [...window.__stormMaterialSamples])
  const probeDiagnostics = await page.evaluate(() => ({ ...window.__stormMaterialProbeDiagnostics }))
  assert.ok(samples.length > 0, 'the real Storm cast never rendered its strike')
  for (const sample of samples) {
    assert.equal(sample.label, 'secondary:storm-weather-strike-flash:BadGuys:78')
    assert.equal(sample.filterCount, 0, 'the compiled strike must not allocate a synthetic color/alpha filter')
    assert.equal(sample.blend, 'normal')
    assert.equal(sample.tint, 0xffffff)
    assert.equal(sample.sourceAlphaMode, 'no-premultiply-alpha')
    assert.equal(sample.sourceAddressMode, 'repeat')
    assert.ok(sample.alpha >= 0 && sample.alpha <= .75)
    assert.ok(Number.isFinite(sample.resolution) && sample.resolution > 0)
  }
  const screenshot = `${screenshotRoot}/storm-material-strike.png`
  await page.screenshot({ path: screenshot })
  return { scope: 'Compiled Boneyard client, real UI Storm cast and unmodified public Pixi tree observation; declared host skill/equipment/combat fixtures.',
    sampleCount: samples.length, sourceIds: [...new Set(samples.map(sample => sample.sourceId))],
    resolutions: [...new Set(samples.map(sample => sample.resolution))],
    alphaRange: [Math.min(...samples.map(sample => sample.alpha)), Math.max(...samples.map(sample => sample.alpha))],
    samples, probeDiagnostics, screenshot }
}
