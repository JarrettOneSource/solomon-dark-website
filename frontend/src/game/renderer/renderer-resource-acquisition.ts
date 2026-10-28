interface RendererResourceAcquisition<Resource> {
  readonly promise: Promise<Resource>
  readonly destroy: (resource: Resource) => void
}

type AcquiredResources<Resources extends readonly unknown[]> = {
  -readonly [Index in keyof Resources]: Resources[Index]
}

export function acquireRendererResources<const Resources extends readonly unknown[]>(
  acquisitions: { readonly [Index in keyof Resources]: RendererResourceAcquisition<Resources[Index]> },
): Promise<AcquiredResources<Resources>> {
  return Promise.all(acquisitions.map(({ promise }) => promise)).catch((error: unknown) => {
    // Preserve fail-fast readiness while retiring every successful sibling,
    // including resources that finish after the caller has observed the error.
    for (const { promise, destroy } of acquisitions) {
      void promise.then(destroy, () => undefined).catch((cleanupError: unknown) => {
        console.error('Renderer acquisition cleanup failed.', cleanupError)
      })
    }
    throw error
  }) as Promise<AcquiredResources<Resources>>
}
