// Browser-only failure instrumentation. Imports resolve against the selected
// unchanged source tree; no renderer source is substituted by this probe.
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='

export async function inspectRendererAcquisition(input) {
  const tracker = await trackResources()
  let renderer
  try {
    if (input.kind === 'image-cache') return await inspectImageCache(input.source)
    if (input.kind === 'mod-images') return await inspectModImages(input.assets, tracker)
    if (input.kind === 'mod-images-overlap') return await inspectOverlappingModImages(input, tracker)
    if (input.kind === 'stock-images') return await inspectStockImages(input.sources, tracker)
    if (input.kind === 'static-images') return await inspectStaticImages(tracker)
    if (input.kind === 'workbench') return await inspectWorkbench(tracker)

    const create = await rendererFactory(input)
    const { createRetainedRendererOwner } = await import('/src/game/renderer/retained-renderer-owner.ts')
    const owner = createRetainedRendererOwner(create)
    const releaseGpu = input.holdGpu ? tracker.holdGpu() : () => {}
    const first = await outcome(owner.get())
    const atFailure = tracker.snapshot()
    releaseGpu()
    await tracker.settle()
    const afterFailure = tracker.snapshot()
    let retryError = null
    try {
      // UI renderers retain the scene owner; world factories are created anew.
      renderer = input.kind.endsWith('-world') ? await create() : await owner.get()
    } catch (error) { retryError = message(error) }
    let retainedCanvas = null
    if (renderer) {
      if (renderer.mount) {
        const firstHost = document.createElement('div')
        const nextHost = document.createElement('div')
        for (const host of [firstHost, nextHost]) {
          host.style.cssText = 'width:1600px;height:900px'
          document.body.append(host)
        }
        const detach = renderer.mount(firstHost)
        const canvas = renderer.canvas
        detach()
        const reopened = await owner.get()
        const close = reopened.mount(nextHost)
        // A stale canvas lease must not detach the newer mount.
        detach()
        retainedCanvas = reopened === renderer && reopened.canvas === canvas
          && nextHost.firstElementChild === canvas
        close()
        firstHost.remove()
        nextHost.remove()
        owner.destroy()
      } else {
        document.body.append(renderer.canvas)
        renderer.render(input.initialSnapshot)
        renderer.destroy()
      }
      renderer = null
    }
    await tracker.settle()
    return { first, heldGpu: Boolean(input.holdGpu), atFailure, afterFailure,
      retrySucceeded: retryError === null, retryError, retainedCanvas,
      afterTeardown: tracker.snapshot() }
  } finally {
    renderer?.destroy()
    tracker.restore()
  }
}

async function rendererFactory(input) {
  switch (input.kind) {
    case 'skill-picker': return (await import('/src/game/renderer/skill-picker-renderer.ts')).createSkillPickerRenderer
    case 'skill-book': return (await import('/src/game/renderer/skill-book-renderer.ts')).createSkillBookRenderer
    case 'hud-selector': return (await import('/src/game/renderer/hud-skill-selector-renderer.ts')).createHudSkillSelectorRenderer
    case 'inventory': return (await import('/src/game/renderer/hub-inventory-renderer.ts')).createHubInventoryRenderer
    case 'hub-world': {
      const { createHubWorldRenderer } = await import('/src/game/renderer/hub-world-renderer.ts')
      return () => createHubWorldRenderer(worldOptions(input))
    }
    case 'boneyard-world': {
      const { createBoneyardWorldRenderer } = await import('/src/game/renderer/boneyard-world-renderer.ts')
      return () => createBoneyardWorldRenderer({ ...worldOptions(input), boneyard: input.boneyard, modCatalog: [] })
    }
    default: throw new Error(`Unknown renderer lifecycle case: ${input.kind}`)
  }
}

function worldOptions(input) {
  return { initialSnapshot: input.initialSnapshot, modAssets: input.assets, playerId: 'local',
    viewport: { width: 800, height: 600, displayScale: 1 }, devicePixelRatio: 1, now: () => 1000 }
}

async function inspectImageCache(source) {
  const { loadGameImage, releaseGameImages } = await import('/src/game/game-assets.ts')
  const first = loadGameImage(source)
  const sharesInFlight = first === loadGameImage(source)
  const firstResult = await outcome(first)
  const second = loadGameImage(source)
  const retried = second !== first
  const secondResult = await outcome(second)
  releaseGameImages([source])
  return { sharesInFlight, first: firstResult, retried, second: secondResult }
}

async function inspectModImages(assets, tracker) {
  const { loadGameImage, releaseGameImages } = await import('/src/game/game-assets.ts')
  const { loadModPresentationTextures } = await import('/src/game/renderer/mod-presentation-assets.ts')
  const sources = assets.map(asset => `/api/game/content/${asset.sha256}`)
  const shared = loadGameImage(sources[0])
  const late = loadGameImage(sources[2])
  const first = await outcome(loadModPresentationTextures(assets))
  await Promise.all([shared, late])
  await tracker.settle()
  const nextShared = loadGameImage(sources[0])
  const nextLate = loadGameImage(sources[2])
  const releasedEarly = nextShared !== shared
  const releasedLate = nextLate !== late
  await Promise.all([nextShared, nextLate])
  let retryError = null
  let sharedDuringOwner = false, releasedOnDestroy = false
  const retryPromises = sources.map(loadGameImage)
  try {
    const textures = await loadModPresentationTextures(assets)
    try {
      sharedDuringOwner = sources.every((source, index) => loadGameImage(source) === retryPromises[index])
    } finally { textures.destroy() }
    const reloaded = sources.map(loadGameImage)
    releasedOnDestroy = reloaded.every((promise, index) => promise !== retryPromises[index])
    await Promise.all(reloaded)
  } catch (error) { retryError = message(error) }
  await Promise.allSettled(retryPromises)
  releaseGameImages(sources)
  await tracker.settle()
  return { first, releasedEarly, releasedLate, retrySucceeded: retryError === null,
    retryError, sharedDuringOwner, releasedOnDestroy, afterTeardown: tracker.snapshot() }
}

async function inspectStockImages(sources, tracker) {
  const { loadGameTextureMap } = await import('/src/game/renderer/game-webgl.ts')
  const first = await outcome(loadGameTextureMap({ stock: sources }))
  await tracker.settle()
  const afterFailure = tracker.snapshot()
  const textures = await loadGameTextureMap({ stock: sources })
  textures.destroy()
  await tracker.settle()
  return { first, afterFailure, afterTeardown: tracker.snapshot() }
}

async function inspectOverlappingModImages(input, tracker) {
  const { loadGameImage, releaseGameImages } = await import('/src/game/game-assets.ts')
  const { loadModPresentationTextures } = await import('/src/game/renderer/mod-presentation-assets.ts')
  const sources = input.assets.map(asset => `/api/game/content/${asset.sha256}`)
  const sharedSource = sources[2]
  const firstShared = loadGameImage(sharedSource)
  let sharedSettled = false
  void firstShared.then(() => { sharedSettled = true }, () => { sharedSettled = true })
  const first = await outcome(loadModPresentationTextures(input.assets))
  const overlapPending = !sharedSettled
  if (input.replaceGeneration) releaseGameImages([sharedSource])
  const retryShared = loadGameImage(sharedSource)
  const oldGenerationReplaced = firstShared !== retryShared
  const secondOwner = loadModPresentationTextures([input.assets[2]])
  await window.__releaseLifecycleLateImages()
  const textures = await secondOwner
  await firstShared
  await tracker.settle()
  const sharedAfterFailedCleanup = loadGameImage(sharedSource) === retryShared
  textures.destroy()
  textures.destroy()
  const reloaded = loadGameImage(sharedSource)
  const releasedByLastOwner = reloaded !== retryShared
  await reloaded
  releaseGameImages(sources)
  await tracker.settle()
  return { first, overlapPending, oldGenerationReplaced, sharedAfterFailedCleanup,
    releasedByLastOwner, afterTeardown: tracker.snapshot() }
}

async function inspectStaticImages(tracker) {
  const { loadStaticPainterImages } = await import('/src/game/renderer/boneyard-static-layout.ts')
  const first = await outcome(loadStaticPainterImages())
  await tracker.settle()
  const second = await outcome(loadStaticPainterImages(), 1000)
  return { first, second, images: tracker.snapshot().images }
}

async function inspectWorkbench(tracker) {
  document.body.innerHTML = '<div id="native-ui-stage" style="width:1600px;height:900px"></div>'
    + '<output id="native-ui-status"></output><select id="atlas"></select><input id="record">'
    + ['show-components', 'show-dom', 'show-atlas', 'previous', 'next']
      .map(id => `<button id="${id}"></button>`).join('')
  await import('/src/game/native-ui/native-ui-workbench.ts')
  await waitUntil(() => ['ready', 'error'].includes(document.documentElement.dataset.nativeUiWorkbench))
  await tracker.settle()
  const status = document.documentElement.dataset.nativeUiWorkbench
  const afterLoad = tracker.snapshot()
  window.dispatchEvent(new Event('pagehide'))
  await tracker.settle()
  return { status, afterLoad, afterTeardown: tracker.snapshot() }
}

async function trackResources() {
  const { createGameWebGlApplication, loadGameTextureMap } = await import('/src/game/renderer/game-webgl.ts')
  const warmGpu = await createGameWebGlApplication({ className: 'lifecycle-probe-warmup', width: 1, height: 1 })
  const Application = warmGpu.application.constructor
  warmGpu.destroy()
  const warmTextures = await loadGameTextureMap({ stock: [PIXEL] })
  const Texture = warmTextures.textures[PIXEL].constructor
  warmTextures.destroy()
  const originalInit = Application.prototype.init
  const originalDestroy = Application.prototype.destroy
  const originalUvs = Texture.prototype.updateUvs
  const OriginalImage = window.Image
  const originalDecode = HTMLImageElement.prototype.decode
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const applications = new Map(), sources = new Set(), images = new Set(), contexts = new Map()
  let pendingInitializations = 0, pendingDecodes = 0, gpuGate = null
  Application.prototype.init = async function (...args) {
    const gate = gpuGate
    pendingInitializations += 1
    const row = { application: this, canvas: null, destroyCalls: 0, completed: false }
    applications.set(this, row)
    try {
      const result = await originalInit.apply(this, args)
      row.canvas = this.canvas
      if (gate) await gate
      row.completed = true
      return result
    } finally { pendingInitializations -= 1 }
  }
  Application.prototype.destroy = function (...args) {
    const row = applications.get(this)
    if (row) row.destroyCalls += 1
    return originalDestroy.apply(this, args)
  }
  Texture.prototype.updateUvs = function (...args) {
    if (this.source?.resource instanceof HTMLImageElement) sources.add(this.source)
    return originalUvs.apply(this, args)
  }
  window.Image = new Proxy(OriginalImage, {
    construct(target, args) {
      const value = Reflect.construct(target, args)
      images.add(value)
      return value
    },
  })
  HTMLImageElement.prototype.decode = async function (...args) {
    pendingDecodes += 1
    try { return await originalDecode.apply(this, args) } finally { pendingDecodes -= 1 }
  }
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    const gl = originalGetContext.call(this, kind, ...args)
    if (gl && (kind === 'webgl' || kind === 'webgl2')) contexts.set(this, gl)
    return gl
  }
  return {
    holdGpu() {
      let release
      gpuGate = new Promise(resolve => { release = resolve })
      return () => { gpuGate = null; release() }
    },
    async settle() {
      const quiet = () => pendingInitializations === 0 && pendingDecodes === 0
        && [...images].every(image => image.complete)
      await waitUntil(quiet)
      // Flush loader/decode continuations and any next bounded-load worker.
      await new Promise(resolve => setTimeout(resolve, 0))
      await waitUntil(quiet)
      await new Promise(resolve => setTimeout(resolve, 0))
    },
    snapshot() {
      const apps = [...applications.values()].map(row => ({
        completed: row.completed, destroyCalls: row.destroyCalls,
        contextLost: row.canvas ? contexts.get(row.canvas)?.isContextLost() ?? null : null,
      }))
      return { applications: apps, imageSourceCount: sources.size,
        liveImageSources: [...sources].filter(source => !source.destroyed).length,
        images: [...images].map(image => ({ source: image.src, complete: image.complete, width: image.naturalWidth })) }
    },
    restore() {
      Application.prototype.init = originalInit
      Application.prototype.destroy = originalDestroy
      Texture.prototype.updateUvs = originalUvs
      window.Image = OriginalImage
      HTMLImageElement.prototype.decode = originalDecode
      HTMLCanvasElement.prototype.getContext = originalGetContext
    },
  }
}

async function outcome(promise, timeoutMs = 20000) {
  let timer
  try {
    return await Promise.race([
      promise.then(() => ({ status: 'resolved' }), error => ({ status: 'rejected', error: message(error) })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs) }),
    ])
  } finally { clearTimeout(timer) }
}

async function waitUntil(predicate) {
  const deadline = performance.now() + 20000
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error('Renderer lifecycle probe did not settle')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

function message(error) { return error instanceof Error ? error.message : String(error) }
