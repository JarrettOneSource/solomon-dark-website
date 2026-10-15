import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import NativeLoader from '../src/game/NativeLoader.tsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const frames = new Map()
const cancelledFrames = []
const cancelledCallbacks = []
const creations = []
const renderers = []
let nextFrame = 0
let root
let strict = false
let props = { progress: 0, stage: 'Loading' }

window.requestAnimationFrame = (callback) => {
  const handle = nextFrame++
  frames.set(handle, callback)
  return handle
}
window.cancelAnimationFrame = (handle) => {
  cancelledFrames.push(handle)
  if (frames.has(handle)) cancelledCallbacks.push(frames.get(handle))
  frames.delete(handle)
}

function render() {
  const loader = createElement(NativeLoader, props)
  root.render(strict ? createElement(StrictMode, null, loader) : loader)
}

window.__nativeLoaderLifecycle = {
  createRenderer(options) {
    return new Promise((resolve, reject) => creations.push({ options, resolve, reject }))
  },
  async mount(options = {}) {
    strict = options.strict ?? false
    props = { ...props, ...options.props }
    root = createRoot(document.getElementById('root'))
    await act(async () => render())
  },
  async update(changes) {
    props = { ...props, ...changes }
    await act(async () => render())
  },
  async resolve(index) {
    const canvas = document.createElement('canvas')
    const record = { mounts: 0, destroys: 0, renders: [], viewports: [] }
    renderers[index] = record
    await act(async () => creations[index].resolve({
      canvas,
      mount(host) {
        record.mounts++
        host.appendChild(canvas)
      },
      render(progress) {
        if (record.destroys) throw new Error('Rendered after destruction')
        record.renders.push(progress)
        canvas.dataset.progress = String(progress)
      },
      resize(viewport) {
        if (record.destroys) throw new Error('Resized after destruction')
        record.viewports.push(viewport)
      },
      destroy() {
        record.pendingFramesAtDestroy = frames.size
        record.destroys++
        canvas.remove()
      },
    }))
  },
  async reject(index) {
    await act(async () => creations[index].reject(new Error('Loader creation failed')))
  },
  async frame() {
    const callbacks = [...frames.values()]
    frames.clear()
    await act(async () => {
      for (const callback of callbacks) callback(performance.now())
    })
  },
  async resize(width, height) {
    await act(async () => {
      const stage = document.querySelector('.native-loader-stage')
      stage.style.width = `${width}px`
      stage.style.height = `${height}px`
      await new Promise(resolve => {
        const observer = new ResizeObserver(() => {
          observer.disconnect()
          resolve()
        })
        observer.observe(stage)
      })
    })
  },
  async replayCancelledFrames() {
    await act(async () => {
      for (const callback of cancelledCallbacks.splice(0)) callback(performance.now())
    })
  },
  async unmount() {
    await act(async () => root.unmount())
  },
  snapshot() {
    return {
      creations: creations.length,
      renderers,
      pendingFrames: frames.size,
      requestedFrames: nextFrame,
      cancelledFrames,
      canvases: document.querySelectorAll('canvas').length,
      status: document.querySelector('[role="status"]')?.textContent ?? null,
      alert: document.querySelector('[role="alert"]')?.textContent ?? null,
    }
  },
}
