import type { Vec2 } from '../../editor/model.ts'
import type { BoneyardSceneryActorPoses } from '../client/boneyard-presentation-timeline.ts'
import type { NativeTreeOcclusionFrame, NativeTreeOcclusionHistory } from './boneyard-tree-occlusion.ts'

export interface BoneyardTreeFrameSource {
  epoch: string
  tick: number
  currentFrame: NativeTreeOcclusionFrame
  focusPlayerId: string | null
  sampleActors?: (tick: number) => BoneyardSceneryActorPoses | null
  sampleFocus?: (tick: number, playerId: string) => Readonly<Vec2> | null
  actorPositions: (poses: BoneyardSceneryActorPoses) => readonly Readonly<Vec2>[]
  cameraBounds: (focus: Readonly<Vec2>) => NativeTreeOcclusionFrame['cameraBounds']
}

/** No stateful timeline sampling and no guessed camera history across epochs. */
export class BoneyardTreeFrameHistory {
  private epoch: string | null = null
  private epochStartTick = 0
  private lastTick = 0

  frame(source: BoneyardTreeFrameSource): {
    current: NativeTreeOcclusionFrame
    history?: NativeTreeOcclusionHistory
  } {
    const tick = Math.floor(source.tick)
    if (source.epoch !== this.epoch || tick < this.lastTick) {
      this.epoch = source.epoch
      this.epochStartTick = tick
      this.lastTick = tick
    }
    const start = Math.max(this.epochStartTick, this.lastTick + 1)
    this.lastTick = tick
    if (!source.sampleActors || !source.sampleFocus || source.focusPlayerId === null) {
      return { current: source.currentFrame }
    }
    const frames = new Map<number, NativeTreeOcclusionFrame | null>()
    const sample = (at: number): NativeTreeOcclusionFrame | null => {
      if (frames.has(at)) return frames.get(at)!
      const actors = source.sampleActors!(at)
      const focus = source.sampleFocus!(at, source.focusPlayerId!)
      const value = actors && focus ? {
        actorPositions: source.actorPositions(actors),
        cameraBounds: source.cameraBounds(focus),
      } : null
      frames.set(at, value)
      return value
    }
    const current = sample(tick)
    if (!current) return { current: source.currentFrame }
    let first = Math.min(tick, start)
    let last = tick
    // Pure history is contiguous within its retained range. Binary search avoids
    // replaying a long suspended-tab gap while keeping every available scan.
    while (first < last) {
      const middle = first + Math.floor((last - first) / 2)
      if (sample(middle)) last = middle
      else first = middle + 1
    }
    return { current, history: { fromTick: first, sample } }
  }
}
