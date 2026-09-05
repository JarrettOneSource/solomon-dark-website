import { pointerStagePosition } from './hub-inventory-pointer.ts'
import {
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { HAGATHA_PERKS } from './core-kernels/hub-economy.ts'
import type { PlayerBeltComponent } from './core-kernels/native-belt.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import type { NativeHudRect } from './native-hud-layout.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'
import { nativeBeltPullOffStarted } from './skill-book-model.ts'
import type {
  HubServiceInspectionModel,
} from './renderer/hub-inventory/model.ts'
import {
  HUB_INVENTORY_STATS_PAGES,
  hubInventoryStatsArrowRect,
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
  page,
}: {
  companion: boolean
  economy: ProtocolPlayerEconomy
  onInspectionFocus: (inspection: HubServiceInspectionModel | null) => void
  onInspectionHover: (inspection: HubServiceInspectionModel | null) => void
  onPage: (page: number) => void
  onRemove: ((selector: number) => void) | null
  page: number
}) {
  const pressRef = useRef<StatsPointerPress | null>(null)
  const clipRect = companion
    ? HUB_INVENTORY_STATS_PAGES.companionClipRect
    : HUB_INVENTORY_STATS_PAGES.standaloneClipRect
  const step = (delta: -1 | 1) => {
    const next = Math.max(0, Math.min(HUB_INVENTORY_STATS_PAGES.pageCount - 1, page + delta))
    if (next !== page) onPage(next)
  }
  const clearPress = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || (event && event.pointerId !== press.pointerId)) return
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pressRef.current = null
  }
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    const point = pointerStagePosition(event)
    const deltaY = point.y - press.start.y
    clearPress(event)
    if (Math.abs(deltaY) <= HUB_INVENTORY_STATS_PAGES.dragThresholdPixels) return
    step(deltaY < 0 ? 1 : -1)
  }
  return (
    <section aria-label="Player Stats Pages" data-native-stats-page={page}>
      <NativeAction
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
        onPointerUp={finish}
        onWheel={(event) => {
          if (event.deltaY === 0) return
          event.preventDefault()
          step(event.deltaY > 0 ? 1 : -1)
        }}
      />
      {(['up', 'down'] as const).map((direction) => {
        const rect = hubInventoryStatsArrowRect(page, direction, companion)
        return rect ? (
          <NativeAction
            key={direction}
            data={{ 'data-native-stats-arrow': direction }}
            label={`${direction === 'up' ? 'Previous' : 'Next'} player stats page`}
            rect={rect}
            onClick={() => step(direction === 'up' ? -1 : 1)}
          />
        ) : null
      })}
      {page === 2 ? economy.ownedPerkSelectors.slice(0, 9).map((selector, index) => {
        const [left, top, width, height] = hubOwnedPerkSlotRect(index)
        const inspection = { index, kind: 'owned-perk' as const, selector }
        return (
          <NativeAction
            key={`${selector}-${index}`}
            data={{ 'data-owned-hagatha-selector': selector }}
            label={selector === 27 || onRemove === null
              ? `Inspect ${HAGATHA_PERKS[selector]!.name}`
              : `Remove ${HAGATHA_PERKS[selector]!.name}`}
            rect={[left - (companion ? 0 : 53), top, width, height]}
            onBlur={() => onInspectionFocus(null)}
            onClick={selector === 27 || onRemove === null ? undefined : () => onRemove(selector)}
            onFocus={() => onInspectionFocus(inspection)}
            onPointerEnter={() => onInspectionHover(inspection)}
            onPointerLeave={() => onInspectionHover(null)}
          />
        )
      }) : null}
    </section>
  )
}

export function InventoryBeltActions({
  audio,
  belt,
  disabled,
  onPullOff,
  rects,
}: {
  audio: GameAudioDirector
  belt: PlayerBeltComponent
  disabled: boolean
  onPullOff: (slot: number) => void
  rects: readonly NativeHudRect[]
}) {
  const pressRef = useRef<{
    readonly origin: { readonly x: number; readonly y: number }
    readonly pointerId: number
    readonly slot: number
  } | null>(null)
  const [burst, setBurst] = useState<{ readonly sequence: number; readonly slot: number } | null>(null)
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pressRef.current?.pointerId !== event.pointerId) return
    pressRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  return (
    <>
      {belt.flatMap((entry, slot) => entry === null ? [] : [(
        <NativeAction
          data={{ 'data-native-belt-slot': slot, 'data-native-belt-populated': 'true' }}
          disabled={disabled}
          key={slot}
          label={`Remove belt slot ${slot + 1}`}
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
          onPointerUp={finish}
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
