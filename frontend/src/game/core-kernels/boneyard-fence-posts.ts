import type { BoneyardFence, BoneyardPoint } from './boneyard.ts'

type FencePostSource = Pick<BoneyardFence,
  'points' | 'style' | 'segmentCode' | 'startPostVariant' | 'endPostVariant'>

/** 0x0064AC90 constructs shared endpoints before any fence bodies. */
export function nativeBoneyardFencePosts<T extends FencePostSource>(fences: readonly T[]): {
  fence: T
  pos: BoneyardPoint
  postVariant: number
  postStyle: 0 | 1
}[] {
  const posts = new Map<string, { fence: T; pos: BoneyardPoint; postVariant: number; postStyle: 0 | 1 }>()
  for (const fence of fences) {
    if ((fence.segmentCode ?? fence.style ?? 0) === 3) continue
    for (const pos of fence.points.slice(0, 2)) {
      const key = `${pos.x},${pos.y}`
      if (!posts.has(key)) posts.set(key, { fence, pos, postVariant: 0, postStyle: 0 })
      // Rails changes the shared post, including one introduced by an earlier grate.
      if ((fence.segmentCode ?? fence.style ?? 0) === 4) posts.get(key)!.postStyle = 1
    }
  }
  // Explicit selectors overwrite the already-shared post in source order.
  for (const fence of fences) {
    if ((fence.segmentCode ?? fence.style ?? 0) === 3) continue
    const variants = [fence.startPostVariant, fence.endPostVariant]
    fence.points.slice(0, 2).forEach((pos, endpoint) => {
      const variant = variants[endpoint]
      if (variant === undefined || variant === 0xffffffff) return
      posts.get(`${pos.x},${pos.y}`)!.postVariant = variant
    })
  }
  return [...posts.values()]
}
