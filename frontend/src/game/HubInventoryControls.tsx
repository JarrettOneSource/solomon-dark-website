import { pointerStagePosition } from './hub-inventory-pointer.ts'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { HAGATHA_PERKS } from './core-kernels/hub-economy.ts'
import type { PlayerBeltComponent } from './core-kernels/native-belt.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import type { NativeHudRect } from './native-hud-layout.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'
import { nativeBeltPullOffStarted } from './skill-book-model.ts'
import { nativeInventoryStatsDragStep } from './native-inventory-stats-scroll.ts'
import { intersectNativeUiRects } from './native-ui/core.ts'
import type {
  HubServiceInspectionModel,
} from './renderer/hub-inventory/model.ts'
import {
  HUB_INVENTORY_STATS_PAGES,
  hubOwnedPerkSlotRect,
} from './renderer/hub-inventory-render-contract.ts'
import { NativeAction } from './HubNativeAction.tsx'

import NativeBeltPullOffBurst from './NativeBeltPullOffBurst.tsx'
import type { HubUiSurface } from './hub-inventory-ui-model.ts'

export function HubInventoryFooter({
  blocked, surface, stats, belt, skillsRect, resumeRect, semanticTooltip,
  hasParentSack, label, onOpenSkills, onInventoryBack, onClose,
}: {
  blocked: boolean
  surface: Exclude<HubUiSurface, null>
  stats: ComponentProps<typeof InventoryStatsActions>
  belt: ComponentProps<typeof InventoryBeltActions>
  skillsRect: readonly [number, number, number, number]
  resumeRect: readonly [number, number, number, number]
  semanticTooltip: string | null
  hasParentSack: boolean
  label: string
  onOpenSkills: () => void
  onInventoryBack: () => void
  onClose: () => void
}) {
  const inventoryControlsVisible = surface.kind !== 'dialogue' && !blocked
  return (
    <>
      {inventoryControlsVisible && !(surface.kind === 'service' && surface.trader === 'hagatha')
        ? <InventoryStatsActions {...stats} /> : null}
      {inventoryControlsVisible ? <InventoryBeltActions {...belt} /> : null}
      {semanticTooltip ? (
        <span className="hub-native-ui-semantic" role="tooltip">{semanticTooltip}</span>
      ) : null}
      {inventoryControlsVisible && surface.kind === 'inventory' ? (
        <NativeAction data={{ 'data-inventory-skills': 'true' }} label="Open skills"
          rect={skillsRect} onClick={onOpenSkills} />
      ) : null}
      {inventoryControlsVisible ? (
        <NativeAction data={{ 'data-inventory-resume': 'true' }} gameBack
          label={hasParentSack ? 'Return to parent inventory' : 'Close inventory'}
          rect={resumeRect} onClick={onInventoryBack} />
      ) : surface.kind === 'dialogue' ? (
        <button className="hub-native-ui-semantic" data-game-back="true" onClick={onClose} type="button">
          Close {label}
        </button>
      ) : null}
    </>
  )
}

interface StatsPointerPress {
  readonly pointerId: number
  readonly start: { readonly x: number; readonly y: number }
}

export function InventoryStatsActions({
  companion,
  economy,
  onInspectionFocus,
  onInspectionHover,
  onPage,
  onRemove,
  offset,
  page,
}: {
  companion: boolean
  economy: ProtocolPlayerEconomy
  onInspectionFocus: (inspection: HubServiceInspectionModel | null) => void
  onInspectionHover: (inspection: HubServiceInspectionModel | null) => void
  onPage: (page: number) => void
  onRemove: ((selector: number) => void) | null
  offset: number
  page: number
}) {
  const pressRef = useRef<StatsPointerPress | null>(null)
  const swipeRef = useRef<HTMLButtonElement>(null)
  const clipRect = companion
    ? HUB_INVENTORY_STATS_PAGES.companionClipRect
    : HUB_INVENTORY_STATS_PAGES.standaloneClipRect
  const step = useCallback((delta: -1 | 1) => {
    const next = Math.max(0, Math.min(HUB_INVENTORY_STATS_PAGES.pageCount - 1, page + delta))
    if (next !== page) onPage(next)
  }, [onPage, page])
  useEffect(() => {
    const swipe = swipeRef.current
    if (!swipe) return
    const wheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return
      event.preventDefault()
      step(event.deltaY > 0 ? 1 : -1)
    }
    swipe.addEventListener('wheel', wheel, { passive: false })
    return () => swipe.removeEventListener('wheel', wheel)
  }, [step])
  const clearPress = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || (event && event.pointerId !== press.pointerId)) return
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pressRef.current = null
  }
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    const delta = nativeInventoryStatsDragStep(press.start, pointerStagePosition(event))
    if (delta === null) return
    clearPress(event)
    if (delta !== 0) step(delta)
  }
  const clipped = ([left, top, width, height]: readonly [number, number, number, number]) => {
    const visible = intersectNativeUiRects(
      { left, top: top - offset, width, height },
      { left: clipRect[0], top: clipRect[1], width: clipRect[2], height: clipRect[3] },
    )
    return visible ? [visible.left, visible.top, visible.width, visible.height] as const : null
  }
  return (
    <section aria-label="Player Stats Pages" data-native-stats-page={page} data-native-stats-offset={offset}>
      <NativeAction
        buttonRef={swipeRef}
        data={{ 'data-native-stats-swipe': 'true' }}
        label="Scroll player stats"
        rect={clipRect}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.repeat) return
          if (event.key === 'ArrowUp' || event.key === 'PageUp') {
            event.preventDefault()
            step(-1)
          } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
            event.preventDefault()
            step(1)
          }
        }}
        onLostPointerCapture={() => { pressRef.current = null }}
        onPointerCancel={clearPress}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          pressRef.current = {
            pointerId: event.pointerId,
            start: pointerStagePosition(event),
          }
        }}
        onPointerMove={move}
        onPointerUp={clearPress}
      />
      {([
        { direction: 'down', target: 1, y: 379 },
        { direction: 'down', target: 2, y: 699 },
        { direction: 'up', target: 0, y: 439 },
        { direction: 'up', target: 1, y: 759 },
      ] as const).map(({ direction, target, y }) => {
        const x = companion
          ? HUB_INVENTORY_STATS_PAGES.companionIndicatorX
          : HUB_INVENTORY_STATS_PAGES.standaloneIndicatorX
        const size = HUB_INVENTORY_STATS_PAGES.actionSize
        const rect = clipped([x - size / 2, y - size / 2, size, size])
        return rect ? (
          <NativeAction
            key={`${direction}-${target}`}
            data={{ 'data-native-stats-arrow': direction }}
            label={`${direction === 'up' ? 'Previous' : 'Next'} player stats page`}
            rect={rect}
            onClick={() => { if (target !== page) onPage(target) }}
          />
        ) : null
      })}
      {economy.ownedPerkSelectors.slice(0, 9).map((selector, index) => {
        const [left, top, width, height] = hubOwnedPerkSlotRect(index)
        const inspection = { index, kind: 'owned-perk' as const, selector }
        const rect = clipped([left - (companion ? 0 : 53), top + 640, width, height])
        if (!rect) return null
        return (
          <NativeAction
            key={`${selector}-${index}`}
            data={{ 'data-owned-hagatha-selector': selector }}
            label={selector === 27 || onRemove === null
              ? `Inspect ${HAGATHA_PERKS[selector]!.name}`
              : `Remove ${HAGATHA_PERKS[selector]!.name}`}
            rect={rect}
            onBlur={() => onInspectionFocus(null)}
            onClick={selector === 27 || onRemove === null ? undefined : () => onRemove(selector)}
            onFocus={() => onInspectionFocus(inspection)}
            onPointerEnter={() => onInspectionHover(inspection)}
            onPointerLeave={() => onInspectionHover(null)}
          />
        )
      })}
    </section>
  )
}

export function InventoryBeltActions({
  audio,
  belt,
  disabled,
  onActivate,
  onPullOff,
  rects,
}: {
  audio: GameAudioDirector
  belt: PlayerBeltComponent
  disabled: boolean
  onActivate: (slot: number, pointer: Vector2) => void
  onPullOff: (slot: number) => void
  rects: readonly NativeHudRect[]
}) {
  const pressRef = useRef<{
    readonly origin: { readonly x: number; readonly y: number }
    readonly pointerId: number
    readonly slot: number
  } | null>(null)
  const [burst, setBurst] = useState<{ readonly sequence: number; readonly slot: number } | null>(null)
  const finish = (event: ReactPointerEvent<HTMLButtonElement>, activate = false) => {
    const press = pressRef.current
    if (press?.pointerId !== event.pointerId) return
    pressRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (activate && !disabled) {
      onActivate(press.slot, { x: event.clientX, y: event.clientY })
    }
  }
  return (
    <>
      {belt.flatMap((entry, slot) => entry === null ? [] : [(
        <NativeAction
          data={{ 'data-native-belt-slot': slot, 'data-native-belt-populated': 'true' }}
          disabled={disabled}
          key={slot}
          label={`Activate belt slot ${slot + 1}; drag to remove`}
          rect={[
            rects[slot]!.x,
            rects[slot]!.y,
            rects[slot]!.width,
            rects[slot]!.height,
          ]}
          onLostPointerCapture={finish}
          onPointerCancel={finish}
          onPointerDown={(event) => {
            if (event.button !== 0 || disabled) return
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            pressRef.current = {
              origin: pointerStagePosition(event),
              pointerId: event.pointerId,
              slot,
            }
          }}
          onPointerMove={(event) => {
            const press = pressRef.current
            if (!press || press.pointerId !== event.pointerId || disabled) return
            if (!nativeBeltPullOffStarted(press.origin, pointerStagePosition(event))) return
            pressRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            audio.playSound('poof')
            setBurst((current) => ({ sequence: (current?.sequence ?? 0) + 1, slot }))
            onPullOff(slot)
          }}
          onPointerUp={(event) => finish(event, true)}
        />
      )])}
      {burst ? (
        <NativeBeltPullOffBurst
          className="hub-inventory-belt-pull-off-burst"
          key={`${burst.slot}:${burst.sequence}`}
          onComplete={() => setBurst((current) => (
            current?.sequence === burst.sequence && current.slot === burst.slot ? null : current
          ))}
          style={{
            left: rects[burst.slot]!.x + rects[burst.slot]!.width / 2,
            top: rects[burst.slot]!.y + rects[burst.slot]!.height / 2,
          }}
        />
      ) : null}
    </>
  )
}
