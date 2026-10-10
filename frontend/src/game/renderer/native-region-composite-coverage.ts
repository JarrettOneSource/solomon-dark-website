/** Only a steady Region pass covering the viewport may extend into its clipped border. */
export function nativeRegionCompositeCoveragePadding(
  logicalSide: number,
  resolution: number,
  worldScale: number,
  viewport: Readonly<{ width: number; height: number }>,
  steadyView: boolean,
): number {
  if (!steadyView || !(resolution > 0) || !(worldScale > 0)
    || logicalSide * worldScale < Math.max(viewport.width, viewport.height)) return 0
  return 1 / (resolution * worldScale)
}

/** Extend the domain, not the sampling phase: original local x,y still map to x/side,y/side. */
export function writeNativeRegionCompositeQuad(
  vertices: Float32Array,
  uvs: Float32Array,
  logicalSide: number,
  padding: number,
): void {
  const first = -padding
  const firstUv = first / logicalSide
  vertices.set([first, first, logicalSide, first, first, logicalSide, logicalSide, logicalSide])
  uvs.set([firstUv, firstUv, 1, firstUv, firstUv, 1, 1, 1])
}
