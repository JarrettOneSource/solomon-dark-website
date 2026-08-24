import { Container, Graphics } from 'pixi.js'
import type { HubPlayerActivityItem } from '../hub-player-activity.ts'
import type { HubPlayerActivity } from '../protocol/game-state.ts'
import type { NativeWorldScreenPoint } from './native-world-nameplate.ts'

export const HUB_PLAYER_ACTIVITY_WORLD_OFFSET_Y = -78

export interface HubPlayerActivityLayerDiagnostics {
  readonly activities: readonly HubPlayerActivity[]
  readonly playerIds: readonly string[]
  readonly visibleCount: number
}

export class HubPlayerActivityLayer {
  readonly container = new Container({ label: 'hub-player-activities' })
  private readonly views = new Map<string, HubPlayerActivityView>()

  constructor() {
    this.container.eventMode = 'none'
  }

  update(
    items: readonly HubPlayerActivityItem[],
    project: (point: Readonly<{ x: number; y: number }>) => NativeWorldScreenPoint | null,
  ): HubPlayerActivityLayerDiagnostics {
    const live = new Set<string>()
    const activities: HubPlayerActivity[] = []
    const playerIds: string[] = []
    for (const item of items) {
      live.add(item.playerId)
      let view = this.views.get(item.playerId)
      if (!view) {
        view = new HubPlayerActivityView()
        this.views.set(item.playerId, view)
        this.container.addChild(view.container)
      }
      view.update(item.activity)
      const point = project({
        x: item.position.x,
        y: item.position.y + HUB_PLAYER_ACTIVITY_WORLD_OFFSET_Y,
      })
      const visible = point !== null
      view.container.visible = visible
      view.container.renderable = visible
      if (point === null) continue
      view.container.position.set(Math.round(point.x), Math.round(point.y))
      activities.push(item.activity)
      playerIds.push(item.playerId)
    }

    for (const [playerId, view] of this.views) {
      if (live.has(playerId)) continue
      this.views.delete(playerId)
      this.container.removeChild(view.container)
      view.destroy()
    }
    return { activities, playerIds, visibleCount: playerIds.length }
  }

  destroy(): void {
    for (const view of this.views.values()) {
      this.container.removeChild(view.container)
      view.destroy()
    }
    this.views.clear()
    this.container.destroy({ children: true })
  }
}

class HubPlayerActivityView {
  readonly container = new Container({ label: 'hub-player-activity' })
  private readonly badge = new Graphics({ label: 'hub-player-activity-badge' })
  private activity: HubPlayerActivity | null = null

  constructor() {
    this.container.eventMode = 'none'
    this.badge.eventMode = 'none'
    this.container.addChild(this.badge)
  }

  update(activity: HubPlayerActivity): void {
    if (this.activity === activity) return
    this.activity = activity
    const badge = this.badge.clear()
      .circle(0, 0, 10)
      .fill({ alpha: 0.9, color: 0x0b0d12 })
      .circle(0, 0, 10)
      .stroke({ alpha: 0.95, color: 0xd8ba72, width: 1.5 })
    if (activity === 'paused') {
      badge
        .roundRect(-4.5, -5, 3, 10, 1)
        .fill({ color: 0xf0d58f })
        .roundRect(1.5, -5, 3, 10, 1)
        .fill({ color: 0xf0d58f })
      return
    }
    for (const x of [-4.5, 0, 4.5]) {
      badge.circle(x, 0, 1.5).fill({ color: 0xf0d58f })
    }
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}
