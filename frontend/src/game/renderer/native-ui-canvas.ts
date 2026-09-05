import type { Application } from 'pixi.js'

export interface NativeUiCanvas {
  readonly canvas: HTMLCanvasElement
  /** Attach only this canvas. Closing the lease preserves retained renderer resources. */
  mount(host: HTMLElement): () => void
  destroy(): void
}

interface Size {
  readonly width: number
  readonly height: number
}

/** Preserve fractional scale; round physical dimensions to remove CSS transform noise. */
export function nativeUiCanvasResolution(logical: Size, displayed: Size, pixelRatio: number): number {
  return Math.max(
    Math.round(displayed.width * pixelRatio) / logical.width,
    Math.round(displayed.height * pixelRatio) / logical.height,
  )
}

export function createNativeUiCanvas(
  application: Application,
  canvas: HTMLCanvasElement,
): NativeUiCanvas {
  let detach: (() => void) | null = null
  return {
    canvas,
    mount(host) {
      detach?.()
      const disconnect = observeMountedCanvas(application, canvas, host)
      const close = () => {
        if (detach !== close) return
        detach = null
        disconnect()
        canvas.remove()
      }
      detach = close
      return close
    },
    destroy() {
      detach?.()
      application.destroy({ removeView: true })
    },
  }
}

function observeMountedCanvas(
  application: Application,
  canvas: HTMLCanvasElement,
  host: HTMLElement,
): () => void {
  const renderer = application.renderer
  let frame: number | null = null
  let resizing = false
  let media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
  const schedule = () => {
    if (frame === null && !resizing) frame = requestAnimationFrame(update)
  }
  const update = () => {
    frame = null
    const bounds = canvas.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return
    const resolution = nativeUiCanvasResolution(renderer.screen, bounds, window.devicePixelRatio)
    if (renderer.resolution === resolution) return
    resizing = true
    renderer.resize(renderer.screen.width, renderer.screen.height, resolution)
    resizing = false
    canvas.dataset.resolution = `${resolution}`
    application.render()
  }
  const pixelRatioChanged = () => {
    media.removeEventListener('change', pixelRatioChanged)
    media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    media.addEventListener('change', pixelRatioChanged)
    schedule()
  }
  host.append(canvas)
  const resizeObserver = new ResizeObserver(schedule)
  resizeObserver.observe(canvas)
  resizeObserver.observe(host)
  const presentationObserver = new MutationObserver(schedule)
  for (let element: HTMLElement | null = canvas; element; element = element.parentElement) {
    presentationObserver.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
    })
  }
  media.addEventListener('change', pixelRatioChanged)
  window.addEventListener('resize', schedule)
  renderer.on('resize', schedule)
  update()
  return () => {
    resizeObserver.disconnect()
    presentationObserver.disconnect()
    media.removeEventListener('change', pixelRatioChanged)
    window.removeEventListener('resize', schedule)
    renderer.off('resize', schedule)
    if (frame !== null) cancelAnimationFrame(frame)
  }
}
