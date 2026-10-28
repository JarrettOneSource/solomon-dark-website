export function installGameTextureUploadSmokeProbe() {
  const contextIds = new WeakMap()
  const uploads = []
  let nextContextId = 0
  window.__sdrTextureUploadProbe = {
    mark(canvas) {
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
      return { contextId: contextIds.get(context), start: uploads.length }
    },
    uploads,
  }
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const original = prototype.texImage2D
    prototype.texImage2D = function (...args) {
      const result = original.apply(this, args)
      const image = args.length === 6 ? args[5] : args[8]
      if (image instanceof HTMLImageElement) {
        let contextId = contextIds.get(this)
        if (contextId === undefined) {
          contextId = nextContextId++
          contextIds.set(this, contextId)
        }
        uploads.push({ contextId, source: image.currentSrc || image.src })
      }
      return result
    }
  }
}
