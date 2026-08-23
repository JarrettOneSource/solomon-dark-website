import { Container, FillGradient, Graphics } from 'pixi.js'

import {
  NATIVE_HAGATHA_SELECTORS,
  nativeHagathaSeekerSegments,
} from '../core-kernels/native-hagatha-effects.ts'
import type { GameSnapshot } from '../protocol/game-protocol.ts'

export class NativeHagathaSeekerView {
  readonly container = new Container({ label: 'hagatha-seeker' })
  private readonly fills: FillGradient[] = []
  private readonly lines: Graphics[] = []
  private renderedSegmentCount = 0
  private readonly root: Container

  constructor(root: Container) {
    this.root = root
    this.container.eventMode = 'none'
    this.root.addChild(this.container)
  }

  update(snapshot: GameSnapshot, localPlayerId: string): void {
    this.renderedSegmentCount = 0
    if (snapshot.world.kind !== 'boneyard') {
      this.syncLineCount(0)
      return
    }
    const player = snapshot.players[localPlayerId]
    if (
      player === undefined
      || !player.economy.ownedPerkSelectors.includes(NATIVE_HAGATHA_SELECTORS.seeker)
    ) {
      this.syncLineCount(0)
      return
    }
    const segments = nativeHagathaSeekerSegments(
      player.position,
      snapshot.world.loot.flatMap((actor) => (
        actor.kind === 'gold' || actor.kind === 'sack' || actor.kind === 'bonus'
          ? [{ id: actor.id, kind: actor.kind, position: actor.position }]
          : []
      )),
      snapshot.tick,
    )
    this.renderedSegmentCount = segments.length
    this.syncLineCount(segments.length)
    for (const [index, segment] of segments.entries()) {
      const line = this.lines[index]!
      const fill = this.fills[index]!
      fill.start = segment.start
      fill.end = segment.end
      fill._tick += 1
      line.alpha = Math.max(0, Math.min(1, segment.alpha))
      line.clear()
        .moveTo(segment.start.x, segment.start.y)
        .lineTo(segment.end.x, segment.end.y)
        .stroke({
          cap: 'butt',
          fill,
          width: segment.width,
        })
    }
  }

  get segmentCount(): number {
    return this.renderedSegmentCount
  }

  setDepth(depth: number): void {
    this.container.zIndex = depth
  }

  destroy(): void {
    this.root.removeChild(this.container)
    this.container.destroy({ children: true })
    for (const fill of this.fills) fill.destroy()
    this.fills.length = 0
    this.lines.length = 0
  }

  private syncLineCount(count: number): void {
    while (this.lines.length < count) {
      const line = new Graphics({ label: 'hagatha-seeker-segment' })
      const fadeOut = this.lines.length % 2 === 1
      line.eventMode = 'none'
      this.lines.push(line)
      this.fills.push(seekerGradient(fadeOut ? 1 : 0, fadeOut ? 0 : 1))
      this.container.addChild(line)
    }
    while (this.lines.length > count) {
      const line = this.lines.pop()!
      const fill = this.fills.pop()!
      this.container.removeChild(line)
      line.destroy()
      fill.destroy()
    }
  }
}

function seekerGradient(startAlpha: number, endAlpha: number): FillGradient {
  const color = (alpha: number) => `rgba(217,186,112,${alpha})`
  return new FillGradient({
    colorStops: [
      { color: color(startAlpha), offset: 0 },
      { color: color(endAlpha), offset: 1 },
    ],
    end: { x: 0, y: 1 },
    start: { x: 0, y: 0 },
    textureSpace: 'global',
  })
}
