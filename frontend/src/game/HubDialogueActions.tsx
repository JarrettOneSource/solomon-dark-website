import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { ModBoastSelection } from './core-kernels/boast.ts'
import type { HubInteractionId } from './hub-inventory-presentation.ts'
import {
  hubNpcChatChoices,
  hubNpcSelectorRowKey,
  hubNpcSelectorTitle,
  type HubNpcChatChoice,
  type HubNpcSelectorRow,
} from './hub-npc-dialogue.ts'
import {
  NATIVE_UI_SWIPE_BOX,
  clampNativeUiSwipeBoxOffset,
  dragNativeUiSwipeBoxOffset,
  planNativeUiBoastMenu,
} from './native-ui/core.ts'
import {
  HUB_CHAT_PANEL,
  HUB_NATIVE_UI_SIZE,
  HUB_NPC_SELECTOR,
  hubNpcSelectorClampScroll,
  hubNpcSelectorDragScroll,
  hubNpcSelectorVisibleRows,
  hubNpcSelectorWheelScroll,
} from './renderer/hub-inventory-render-contract.ts'
import type { HubNpcChatPresentation } from './hub-inventory-ui-model.ts'
import { NativeAction } from './HubNativeAction.tsx'
import { pointerStagePosition, pointInRect, nativeUiActionRect } from './hub-inventory-pointer.ts'

export function DialogueActions({
  chat,
  gold,
  interaction,
  onAccelerate,
  onAdvance,
  onChoice,
  onDone,
  onSelectorHighlight,
  onSelectRow,
  onSelectorDone,
  onSelectorScroll,
  pendingSelection,
  selectorRows,
  storyOffice,
}: {
  chat: HubNpcChatPresentation
  gold: number
  onAccelerate: () => void
  onAdvance: () => void
  onChoice: (choice: HubNpcChatChoice) => void
  onDone: () => void
  onSelectorHighlight: (id: number | ModBoastSelection | null) => void
  onSelectRow: (
    selector: 'boast' | 'books' | 'teacher-spells',
    id: number | ModBoastSelection,
  ) => void
  onSelectorDone: () => void
  onSelectorScroll: (scroll: number) => void
  pendingSelection: boolean
  selectorRows: readonly HubNpcSelectorRow[]
  storyOffice: boolean
  interaction: HubInteractionId
}) {
  const selectorPointerRef = useRef<{
    distance: number
    lastY: number
    moved: boolean
    pointerId: number
  } | null>(null)
  const suppressSelectorClickRef = useRef(false)

  if (chat.content.kind === 'speech') {
    const speech = chat.content
    return (
      <div className="hub-native-dialogue-actions">
        <div className="hub-native-ui-semantic">
          {speech.lines.map((line, index) => <p key={`${speech.key}-${index}`}>{line}</p>)}
        </div>
        <NativeAction
          label="Accelerate dialogue"
          rect={[
            HUB_CHAT_PANEL.contentLeft,
            HUB_CHAT_PANEL.contentTop,
            HUB_CHAT_PANEL.contentWidth,
            HUB_CHAT_PANEL.contentHeight,
          ]}
          onClick={onAccelerate}
        />
        <NativeAction label="Skip" rect={HUB_CHAT_PANEL.doneRect} onClick={onAdvance} />
      </div>
    )
  }

  if (chat.content.kind === 'selector') {
    const selector = chat.content.selector
    if (selector === 'boast') return (
      <BoastSelectorActions
        onDone={onSelectorDone}
        onHighlight={onSelectorHighlight}
        onScrollY={onSelectorScroll}
        onSelect={(id) => onSelectRow('boast', id)}
        pendingSelection={pendingSelection}
        rows={selectorRows}
        scrollY={chat.selectorScroll}
      />
    )
    const scroll = hubNpcSelectorClampScroll(chat.selectorScroll, selectorRows.length)
    const visibleRows = hubNpcSelectorVisibleRows(selectorRows.length, scroll)
    const wheel = (event: ReactWheelEvent<HTMLElement>) => {
      if (event.deltaY === 0) return
      onSelectorScroll(hubNpcSelectorWheelScroll(scroll, event.deltaY, selectorRows.length))
    }
    const beginPointer = (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      selectorPointerRef.current = {
        distance: 0,
        lastY: pointerStagePosition(event).y,
        moved: false,
        pointerId: event.pointerId,
      }
      suppressSelectorClickRef.current = false
    }
    const movePointer = (event: ReactPointerEvent<HTMLElement>) => {
      const press = selectorPointerRef.current
      if (!press || press.pointerId !== event.pointerId) return
      const nextY = pointerStagePosition(event).y
      const deltaY = nextY - press.lastY
      press.lastY = nextY
      press.distance += Math.abs(deltaY)
      if (!press.moved && press.distance >= 4) {
        press.moved = true
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      if (deltaY !== 0) {
        onSelectorScroll(hubNpcSelectorDragScroll(scroll, deltaY, selectorRows.length))
      }
    }
    const finishPointer = (event: ReactPointerEvent<HTMLElement>) => {
      const press = selectorPointerRef.current
      if (!press || press.pointerId !== event.pointerId) return
      suppressSelectorClickRef.current = press.moved
      if (press.moved) window.setTimeout(() => { suppressSelectorClickRef.current = false }, 0)
      selectorPointerRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }
    const keyScroll = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const delta = event.key === 'ArrowUp'
        ? -HUB_NPC_SELECTOR.wheelStep
        : event.key === 'ArrowDown'
          ? HUB_NPC_SELECTOR.wheelStep
          : event.key === 'PageUp'
            ? -HUB_NPC_SELECTOR.viewportRect[3]
            : event.key === 'PageDown'
              ? HUB_NPC_SELECTOR.viewportRect[3]
              : 0
      if (delta === 0) return
      event.preventDefault()
      onSelectorScroll(hubNpcSelectorClampScroll(scroll + delta, selectorRows.length))
    }
    return (
      <section
        className="hub-native-dialogue-actions"
        aria-label={hubNpcSelectorTitle(selector)}
        data-native-selector={selector}
        data-native-selector-scroll={scroll}
        onLostPointerCapture={() => { selectorPointerRef.current = null }}
        onPointerCancel={finishPointer}
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={finishPointer}
        onWheel={wheel}
      >
        <span className="hub-native-ui-semantic" role="status">
          {visibleRows.length === 0 && selector === 'teacher-spells'
            ? 'ALL SPELLS ALREADY BOUGHT!'
            : `${hubNpcSelectorTitle(selector)}. ${selectorRows.length} entries.`}
        </span>
        <NativeAction
          data={{ 'data-native-selector-swipebox': 'true' }}
          label={`Scroll ${hubNpcSelectorTitle(selector)}`}
          rect={HUB_NPC_SELECTOR.viewportRect}
          onKeyDown={keyScroll}
        />
        {visibleRows.map(({ index, rect }) => {
          const row = selectorRows[index]!
          return (
          <NativeAction
            key={`${selector}-${hubNpcSelectorRowKey(row)}`}
            data={{
              'data-native-selector-id': typeof row.id === 'number' ? row.id : row.id.contentId,
              'data-native-selector-kind': selector,
              'data-native-selector-mod-id': typeof row.id === 'number' ? '' : row.id.modId,
              'data-native-selector-price': row.price ?? '',
              'data-native-selector-affordable': row.price === null || gold >= row.price
                ? 'true'
                : 'false',
            }}
            disabled={pendingSelection}
            label={`${row.label}${row.price === null ? '' : `, ${row.price} gold`}. ${row.detail}`}
            rect={rect}
            onBlur={() => onSelectorHighlight(null)}
            onClick={() => {
              if (suppressSelectorClickRef.current) {
                return
              }
              onSelectRow(selector, row.id)
            }}
            onFocus={() => onSelectorHighlight(row.id)}
            onKeyDown={keyScroll}
            onPointerEnter={() => onSelectorHighlight(row.id)}
            onPointerLeave={() => onSelectorHighlight(null)}
          />
          )
        })}
        <NativeAction gameBack label="Done" rect={HUB_NPC_SELECTOR.doneRect} onClick={onSelectorDone} />
      </section>
    )
  }

  const choices = hubNpcChatChoices(interaction, storyOffice)
  return (
    <div className="hub-native-dialogue-actions">
      {choices.map((choice, index) => (
        <NativeAction
          key={choice.kind === 'question' ? choice.key : choice.selector}
          data={{
            'data-native-chat-choice': choice.kind,
            'data-native-chat-key': choice.kind === 'question' ? choice.key : choice.selector,
            'data-service-trader': choice.kind === 'command'
              && ['fomentius', 'hagatha', 'luthacus', 'shlorio'].includes(choice.selector)
              ? choice.selector
              : '',
          }}
          label={choice.label}
          rect={[590, 145 + index * 52, 420, 45]}
          onClick={() => onChoice(choice)}
        />
      ))}
      <NativeAction gameBack label="Done" rect={HUB_CHAT_PANEL.doneRect} onClick={onDone} />
    </div>
  )
}

function BoastSelectorActions({
  onDone,
  onHighlight,
  onScrollY,
  onSelect,
  pendingSelection,
  rows,
  scrollY,
}: Readonly<{
  onDone: () => void
  onHighlight: (id: number | ModBoastSelection | null) => void
  onScrollY: (scrollY: number) => void
  onSelect: (id: number | ModBoastSelection) => void
  pendingSelection: boolean
  rows: readonly HubNpcSelectorRow[]
  scrollY: number
}>) {
  const dragRef = useRef<{
    moved: boolean
    pointerId: number
    pointerY: number
    scrollY: number
    startedY: number
  } | null>(null)
  const suppressClickRef = useRef(false)
  const plan = planNativeUiBoastMenu({
    height: HUB_NATIVE_UI_SIZE.height,
    rows: rows.map(row => ({
      detail: row.detail,
      id: hubNpcSelectorRowKey(row),
      label: row.label,
      ...(row.boastIcon?.kind === 'stock' ? { stockIconRecord: row.boastIcon.record } : {}),
    })),
    scrollY,
    width: HUB_NATIVE_UI_SIZE.width,
  })
  const rowsById = new Map(rows.map(row => [hubNpcSelectorRowKey(row), row]))
  const updateScrollY = (next: number) => onScrollY(clampNativeUiSwipeBoxOffset(
    next,
    plan.contentHeight,
    plan.viewportBounds.height,
  ))
  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const point = pointerStagePosition(event)
    if (!pointInRect(point, nativeUiActionRect(plan.viewportBounds))) return
    dragRef.current = {
      moved: false,
      pointerId: event.pointerId,
      pointerY: point.y,
      scrollY: plan.scrollY,
      startedY: point.y,
    }
  }
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const pointerY = pointerStagePosition(event).y
    const next = dragNativeUiSwipeBoxOffset(
      drag.scrollY,
      drag.pointerY,
      pointerY,
      plan.contentHeight,
      plan.viewportBounds.height,
    )
    if (!drag.moved && Math.abs(pointerY - drag.startedY) >= 3) {
      drag.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    drag.pointerY = pointerY
    drag.scrollY = next
    if (drag.moved) {
      event.preventDefault()
      onHighlight(null)
      updateScrollY(next)
    }
  }
  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressClickRef.current = drag.moved
    if (drag.moved) window.setTimeout(() => { suppressClickRef.current = false }, 0)
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  const wheel = (event: ReactWheelEvent<HTMLElement>) => {
    if (event.deltaY === 0) return
    const point = pointerStagePosition(event)
    if (!pointInRect(point, nativeUiActionRect(plan.viewportBounds))) return
    const next = clampNativeUiSwipeBoxOffset(
      plan.scrollY + Math.sign(event.deltaY) * NATIVE_UI_SWIPE_BOX.wheelStep,
      plan.contentHeight,
      plan.viewportBounds.height,
    )
    if (next === plan.scrollY) return
    event.preventDefault()
    onHighlight(null)
    updateScrollY(next)
  }
  const keyScroll = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === 'ArrowUp'
      ? -NATIVE_UI_SWIPE_BOX.wheelStep
      : event.key === 'ArrowDown'
        ? NATIVE_UI_SWIPE_BOX.wheelStep
        : event.key === 'PageUp'
          ? -plan.viewportBounds.height
          : event.key === 'PageDown'
            ? plan.viewportBounds.height
            : 0
    if (delta === 0) return
    event.preventDefault()
    onHighlight(null)
    updateScrollY(plan.scrollY + delta)
  }
  return (
    <section
      aria-label={hubNpcSelectorTitle('boast')}
      className="hub-native-dialogue-actions hub-native-boast-actions"
      data-native-selector="boast"
      data-native-selector-content-height={plan.contentHeight}
      data-native-selector-scroll-max={plan.maximumScrollY}
      data-native-selector-scroll-y={plan.scrollY}
      onLostPointerCapture={() => { dragRef.current = null }}
      onPointerCancel={endDrag}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onWheel={wheel}
    >
      <span className="hub-native-ui-semantic" role="status">
        {`${hubNpcSelectorTitle('boast')}. ${rows.length} entries. Drag to scroll.`}
      </span>
      <NativeAction
        data={{ 'data-native-selector-swipebox': 'true' }}
        label={`Scroll ${hubNpcSelectorTitle('boast')}`}
        onKeyDown={keyScroll}
        rect={nativeUiActionRect(plan.viewportBounds)}
      />
      {plan.actions.filter(({ id }) => id !== 'done').map((action) => {
        const row = rowsById.get(action.id)!
        return (
          <NativeAction
            key={`boast-${action.id}`}
            data={{
              'data-native-selector-id': typeof row.id === 'number' ? row.id : row.id.contentId,
              'data-native-selector-kind': 'boast',
              'data-native-selector-mod-id': typeof row.id === 'number' ? '' : row.id.modId,
              'data-native-selector-price': '',
            }}
            disabled={pendingSelection}
            label={`${row.label}. ${row.detail}`}
            rect={nativeUiActionRect(action.bounds)}
            onBlur={() => onHighlight(null)}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false
                return
              }
              onSelect(row.id)
            }}
            onFocus={() => onHighlight(row.id)}
            onKeyDown={keyScroll}
            onPointerEnter={() => onHighlight(row.id)}
            onPointerLeave={() => onHighlight(null)}
          />
        )
      })}
      <NativeAction
        gameBack
        label="Done"
        rect={nativeUiActionRect(plan.doneBounds)}
        onClick={onDone}
      />
    </section>
  )
}
