interface RetainedRenderer {
  destroy(): void
}

export interface RetainedRendererOwner<Renderer extends RetainedRenderer> {
  destroy(): void
  get(): Promise<Renderer>
}

export function createRetainedRendererOwner<Renderer extends RetainedRenderer>(
  create: () => Promise<Renderer>,
): RetainedRendererOwner<Renderer> {
  let renderer: Promise<Renderer> | null = null
  return {
    destroy() {
      if (renderer) void renderer.then((value) => value.destroy(), () => undefined)
      renderer = null
    },
    get() {
      renderer ??= create()
      return renderer
    },
  }
}
