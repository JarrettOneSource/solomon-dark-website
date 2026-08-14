export const LOADER_RENDER_WIDTH = 480
export const LOADER_RENDER_HEIGHT = 320
export const LOADER_BACKGROUND = 0x000054

export const LOADER_LOGO_BOUNDS = { height: 227, width: 388, x: 41, y: 13 } as const
export const LOADER_URL_BOUNDS = { height: 18, width: 244, x: 119, y: 251 } as const
// The extractor applies the native 90-degree record transform. These assets
// are already in their final horizontal screen orientation.
export const LOADER_FRAME_BOUNDS = { height: 54, width: 230, x: 125, y: 263 } as const
export const LOADER_FILL_BOUNDS = { height: 18, width: 192, x: 144, y: 282 } as const
export const LOADER_FILL_CLIP = { height: 18, width: 192, x: 144, y: 282 } as const

export function loaderFillWidth(progress: number): number {
  const bounded = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  return bounded * LOADER_FILL_CLIP.width
}

export function loaderProgressPercent(progress: number): number {
  const bounded = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  return bounded === 1 ? 100 : Math.floor(bounded * 100)
}
