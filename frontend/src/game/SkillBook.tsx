import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { NATIVE_SKILL_CATALOG } from './core-kernels/player-progression.ts'
import {
  nativeBeltEntryItem,
  type NativeBeltEntry,
  type PlayerBeltComponent,
} from './core-kernels/native-belt.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudModalSlideLayout,
  type NativeHudPoint,
  type NativeHudRect,
} from './native-hud-layout.ts'
import { setNativeModalSlideProgress } from './native-modal-slide-progress.ts'
import {
  nativeOptionalBookHudProgress,
  nativeOptionalBookKeyAction,
} from './native-optional-book.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from './protocol/game-state.ts'
import type { GameSnapshot } from './protocol/game-protocol.ts'
import NativeBeltPullOffBurst from './NativeBeltPullOffBurst.tsx'
import type { GameClientSession } from './client/game-client-session.ts'
import ModSkillBook from './mod-ui/ModSkillBook.tsx'
import {
  createSkillBookRenderer,
  type SkillBookRenderer,
  type SkillBookRendererPresentation,
} from './renderer/skill-book-renderer.ts'
import {
  nativeBeltPullOffStarted,
  nativeSkillDragStarted,
  nativeSkillBookPagePlacements,
  nativeSkillBookPages,
  nativeSkillQuickbarDropSlot,
  type NativeSkillBookRow,
} from './skill-book-model.ts'
import './skill-book.css'

interface SkillBookProps {
  audio: GameAudioDirector
  belt: PlayerBeltComponent
  economy: ProtocolPlayerEconomy
  element: WizardElement
  inputSuspended: boolean
  inventoryKeyCode: string
  inventoryScreenOpen: boolean
  menuKeyCode: string
  onAssignQuickbarSkill: (skillId: number, slot: number) => void
  onUnassignQuickbarSkill: (slot: number) => void
  onClose: () => void
  onCloseStart?: () => void
  onOpenInventory: () => void
  onSelectConcentration: (skillId: number) => void
  onSelectPrimarySkill: (skillId: number) => void
  playerId: string
  progression: ProtocolPlayerProgression
  session: GameClientSession
  skillsKeyCode: string
  style: CSSProperties
  subscribeSnapshot: (listener: (snapshot: GameSnapshot) => void) => () => void
  topMost: boolean
}

interface SkillBookDragState {
  readonly position: NativeHudPoint
  readonly skillId: number
}

interface SkillBookPullOffBurstState {
  readonly sequence: number
  readonly slot: number
}

export default function SkillBook({
  audio,
  belt: initialBelt,
  economy: initialEconomy,
  element,
  inputSuspended,
  inventoryKeyCode,
  inventoryScreenOpen,
  menuKeyCode,
  onAssignQuickbarSkill,
  onClose,
  onCloseStart,
  onOpenInventory,
  onSelectConcentration,
  onSelectPrimarySkill,
  onUnassignQuickbarSkill,
  playerId,
  progression: initialProgression,
  session,
  skillsKeyCode,
  style,
  subscribeSnapshot,
  topMost,
}: SkillBookProps) {
  const [{ beltEntries, economy, progression }, setModel] = useState(() => ({
    beltEntries: initialBelt,
    economy: initialEconomy,
    progression: initialProgression,
  }))
  const pages = useMemo(() => nativeSkillBookPages(progression), [progression])
  const placements = useMemo(() => nativeSkillBookPagePlacements(pages), [pages])
  const [targetQuickbarSlot, setTargetQuickbarSlot] = useState<number | null>(null)
  const [drag, setDrag] = useState<SkillBookDragState | null>(null)
  const [hoveredSkillId, setHoveredSkillId] = useState<number | null>(null)
  const [pullOffBurst, setPullOffBurst] = useState<SkillBookPullOffBurstState | null>(null)
  const [openProgress, setOpenProgress] = useState(0)
  const [phase, setPhase] = useState<'opening' | 'settled' | 'closing'>('opening')
  const [rendererState, setRendererState] = useState<'loading' | 'ready' | 'error'>('loading')
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SkillBookRenderer | null>(null)
  const transitionStartedAtRef = useRef(performance.now())
  const transitionStartProgressRef = useRef(0)
  const closeCompletedRef = useRef(false)
  const closeStartedRef = useRef(false)
  const closeTargetRef = useRef<'closed' | 'inventory'>('closed')
  const hudProgress = nativeOptionalBookHudProgress(openProgress, inventoryScreenOpen)
  const presentationRef = useRef<SkillBookRendererPresentation>({
    belt: beltEntries,
    dragPosition: drag?.position ?? null,
    draggedSkillId: drag?.skillId ?? null,
    economy,
    element,
    hoveredSkillId,
    hudProgress,
    openProgress,
    placements,
    progression,
    targetQuickbarSlot,
  })
  presentationRef.current = {
    belt: beltEntries,
    dragPosition: drag?.position ?? null,
    draggedSkillId: drag?.skillId ?? null,
    economy,
    element,
    hoveredSkillId,
    hudProgress,
    openProgress,
    placements,
    progression,
    targetQuickbarSlot,
  }

  useLayoutEffect(() => {
    setNativeModalSlideProgress('skills', 0)
  }, [])

  useEffect(() => subscribeSnapshot((snapshot) => {
    const player = snapshot.players[playerId]
    if (!player) return
    setModel((current) => sameSkillBookModel(
      current.beltEntries,
      current.economy,
      current.progression,
      player.belt,
      player.economy,
      player.progression,
    ) ? current : {
      beltEntries: player.belt,
      economy: player.economy,
      progression: player.progression,
    })
  }), [playerId, subscribeSnapshot])

  useEffect(() => subscribeGamePresentationFrames((nowMs) => {
    rendererRef.current?.render(nowMs)
    if (phase === 'settled') return
    const ticks = Math.floor((nowMs - transitionStartedAtRef.current) / 10)
    const progress = phase === 'opening'
      ? Math.min(1, transitionStartProgressRef.current + ticks * 0.025)
      : Math.max(0, transitionStartProgressRef.current - ticks * 0.025)
    setNativeModalSlideProgress('skills', progress)
    setOpenProgress(progress)
    if (phase === 'opening' && progress === 1) setPhase('settled')
    if (phase === 'closing' && progress === 0 && !closeCompletedRef.current) {
      closeCompletedRef.current = true
      onClose()
    }
  }), [onClose, phase])

  useEffect(() => {
    if (topMost && !inputSuspended) rootRef.current?.focus()
  }, [inputSuspended, topMost])

  useEffect(() => {
    let disposed = false
    setRendererState('loading')
    void createSkillBookRenderer().then((renderer) => {
      if (disposed) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      renderer.setPresentation(presentationRef.current)
      setRendererState('ready')
    }).catch(() => {
      if (!disposed) setRendererState('error')
    })
    return () => {
      disposed = true
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    if (rendererState !== 'ready') return
    const host = hostRef.current
    const renderer = rendererRef.current
    if (!host || !renderer) return
    host.replaceChildren(renderer.canvas)
    return () => {
      if (renderer.canvas.parentElement === host) host.replaceChildren()
    }
  }, [rendererState])

  useEffect(() => {
    rendererRef.current?.setPresentation(presentationRef.current)
  }, [
    drag,
    economy,
    hoveredSkillId,
    hudProgress,
    openProgress,
    placements,
    progression,
    rendererState,
    targetQuickbarSlot,
  ])

  const assign = (skillId: number, slot: number) => {
    onAssignQuickbarSkill(skillId, slot)
    audio.playSound('pick-skill')
    setTargetQuickbarSlot(null)
    setDrag(null)
  }
  const nativePointForClient = (clientX: number, clientY: number): NativeHudPoint | null => {
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0 || bounds.height === 0) return null
    return {
      x: (clientX - bounds.left) * NATIVE_HUD_BACKBUFFER.width / bounds.width,
      y: (clientY - bounds.top) * NATIVE_HUD_BACKBUFFER.height / bounds.height,
    }
  }

  const beginClose = (target: 'closed' | 'inventory' = 'closed') => {
    if (closeStartedRef.current) return
    closeStartedRef.current = true
    setDrag(null)
    setTargetQuickbarSlot(null)
    onCloseStart?.()
    audio.playSound('open-panel')
    closeTargetRef.current = target
    transitionStartProgressRef.current = openProgress
    transitionStartedAtRef.current = performance.now()
    if (target === 'inventory') onOpenInventory()
    setPhase('closing')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = nativeOptionalBookKeyAction(event.code, 'skills', {
      inventory: inventoryKeyCode,
      menu: menuKeyCode,
      skills: skillsKeyCode,
    })
    if (action?.type === 'close') {
      event.preventDefault()
      event.stopPropagation()
      beginClose()
      return
    }
    if (action?.type === 'replace' && action.target === 'inventory') {
      event.preventDefault()
      event.stopPropagation()
      beginClose('inventory')
      return
    }
    const slot = event.key >= '1' && event.key <= '7' ? Number(event.key) : null
    if (slot !== null) {
      event.preventDefault()
      event.stopPropagation()
      setTargetQuickbarSlot(slot)
    }
  }
  const modalHud = nativeHudModalSlideLayout(
    NATIVE_HUD_BACKBUFFER.width,
    NATIVE_HUD_BACKBUFFER.height,
    hudProgress,
  )
  const backpack = modalHud.backpack
  const tome = modalHud.tome
  const belt = modalHud.belt

  return (
    <div
      ref={rootRef}
      className="main-menu-native-stage skill-book-stage"
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label="Skills"
      inert={inputSuspended || phase === 'closing' || undefined}
      tabIndex={-1}
      data-transition-phase={phase}
      data-transition-target={phase === 'closing' ? closeTargetRef.current : ''}
      data-open-progress={openProgress}
      data-dragged-skill-id={drag?.skillId ?? ''}
      data-drag-position-x={drag?.position.x ?? ''}
      data-drag-position-y={drag?.position.y ?? ''}
      data-hovered-skill-id={hoveredSkillId ?? ''}
      data-input-suspended={inputSuspended}
      data-renderer-state={rendererState}
      onKeyDown={handleKeyDown}
    >
      <div ref={hostRef} className="skill-book-renderer" aria-hidden />
      <h2 className="skill-book-semantic-title">SKILLS</h2>
      <button
        type="button"
        className="skill-book-inventory-action"
        aria-label="Open inventory"
        data-skill-book-inventory="true"
        style={{ height: backpack.height, left: backpack.x, top: backpack.y, width: backpack.width }}
        onClick={() => beginClose('inventory')}
      />
      <button
        type="button"
        className="skill-book-close-action"
        aria-label="Close skills"
        data-skill-book-resume="true"
        data-game-back="true"
        style={{ height: tome.height, left: tome.x, top: tome.y, width: tome.width }}
        onClick={() => beginClose()}
      />
      <div className="skill-book-pages" aria-label="Learned skill dependency pages">
        {placements.map(({ page, x, y }) => (
          <section
            key={page.rootSkillId}
            className="skill-book-page-actions"
            data-root-skill-id={page.rootSkillId}
            style={{ height: page.height, left: x, top: y, width: page.width }}
          >
            {page.rows.map((row, index) => (
              <SkillBookEntry
                key={row.id}
                index={index}
                row={row}
                selected={row.id === progression.selectedPrimarySkillId
                  || progression.concentrationSkillIds.includes(row.id)}
                nativePointForClient={nativePointForClient}
                onDragEnd={() => {
                  setDrag(null)
                  setTargetQuickbarSlot(null)
                }}
                onDragMove={(skillId, position) => {
                  setHoveredSkillId(null)
                  setDrag({ position, skillId })
                  setTargetQuickbarSlot(nativeSkillQuickbarDropSlot(position, belt))
                }}
                onHover={setHoveredSkillId}
                onPointerDrop={(skillId, position) => {
                  const slot = nativeSkillQuickbarDropSlot(position, belt)
                  if (slot !== null) assign(skillId, slot)
                  else {
                    setDrag(null)
                    setTargetQuickbarSlot(null)
                  }
                }}
                onSelectConcentration={() => {
                  onSelectConcentration(row.id)
                  audio.playSound('click')
                  audio.playSound('concentrate')
                }}
                onSelectPrimary={() => {
                  onSelectPrimarySkill(row.id)
                  audio.playSound('click')
                }}
                concentrationLocked={progression.mindChugTicksRemaining > 0}
              />
            ))}
          </section>
        ))}
      </div>
      <span className="skill-book-semantic-help">
        Hover over a skill icon for more information about a skill.
        Skills with a gold or green border can be dragged into your belt.
      </span>
      <SkillQuickbarEditor
        beltEntries={beltEntries}
        beltRects={belt}
        draggedSkillId={drag?.skillId ?? null}
        economy={economy}
        nativePointForClient={nativePointForClient}
        onPullOff={(slot) => {
          onUnassignQuickbarSkill(slot)
          audio.playSound('poof')
          setPullOffBurst((current) => ({ sequence: (current?.sequence ?? 0) + 1, slot }))
          setTargetQuickbarSlot(null)
        }}
        onTarget={setTargetQuickbarSlot}
        targetSlot={targetQuickbarSlot}
      />
      <ModSkillBook session={session} />
      {pullOffBurst ? (
        <NativeBeltPullOffBurst
          key={pullOffBurst.sequence}
          className="skill-book-pull-off-burst"
          onComplete={() => setPullOffBurst((current) => (
            current?.sequence === pullOffBurst.sequence ? null : current
          ))}
          style={{
            left: belt[pullOffBurst.slot]!.x + belt[pullOffBurst.slot]!.width / 2,
            top: belt[pullOffBurst.slot]!.y + belt[pullOffBurst.slot]!.height / 2,
          }}
        />
      ) : null}
      {rendererState === 'error' ? (
        <p className="skill-book-error" role="alert">Skills renderer unavailable.</p>
      ) : null}
    </div>
  )
}

function sameSkillBookModel(
  currentBelt: PlayerBeltComponent,
  currentEconomy: ProtocolPlayerEconomy,
  currentProgression: ProtocolPlayerProgression,
  nextBelt: PlayerBeltComponent,
  nextEconomy: ProtocolPlayerEconomy,
  nextProgression: ProtocolPlayerProgression,
): boolean {
  return currentEconomy.revision === nextEconomy.revision
    && currentBelt.every((entry, index) => beltEntriesEqual(entry, nextBelt[index] ?? null))
    && currentProgression.revision === nextProgression.revision
    && currentProgression.selectedPrimarySkillId === nextProgression.selectedPrimarySkillId
    && currentProgression.weldBuildId === nextProgression.weldBuildId
    && currentProgression.mindChugTicksRemaining === nextProgression.mindChugTicksRemaining
    && currentProgression.splitMind === nextProgression.splitMind
    && currentProgression.concentrationSkillIds.every((skillId, index) => (
      skillId === nextProgression.concentrationSkillIds[index]
    ))
}

function beltEntriesEqual(left: NativeBeltEntry | null, right: NativeBeltEntry | null): boolean {
  if (left === null || right === null) return left === right
  if (left.kind !== right.kind) return false
  if (left.kind === 'skill' && right.kind === 'skill') return left.skillId === right.skillId
  if (left.kind === 'item' && right.kind === 'item') {
    return left.itemId === right.itemId && left.nativeTypeId === right.nativeTypeId
  }
  return true
}

function SkillBookEntry({
  concentrationLocked,
  index,
  nativePointForClient,
  onDragEnd,
  onDragMove,
  onHover,
  onPointerDrop,
  onSelectConcentration,
  onSelectPrimary,
  row,
  selected,
}: {
  concentrationLocked: boolean
  index: number
  nativePointForClient: (clientX: number, clientY: number) => NativeHudPoint | null
  onDragEnd: () => void
  onDragMove: (skillId: number, position: NativeHudPoint) => void
  onHover: (skillId: number | null) => void
  onPointerDrop: (skillId: number, position: NativeHudPoint) => void
  onSelectConcentration: () => void
  onSelectPrimary: () => void
  row: NativeSkillBookRow
  selected: boolean
}) {
  const draggable = row.category === 1 || row.category === 2
    || row.category === 3
  const selectable = row.category === 1
    || (row.category === 3 && !selected && !concentrationLocked)
  const pressRef = useRef<{
    dragging: boolean
    pointerId: number
    origin: NativeHudPoint
  } | null>(null)
  const suppressClickRef = useRef(false)
  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    const position = nativePointForClient(event.clientX, event.clientY)
    if (press.dragging && !cancelled && position) onPointerDrop(row.id, position)
    else {
      onDragEnd()
      if (!cancelled) {
        onHover(row.id)
        event.currentTarget.focus({ preventScroll: true })
      }
    }
    if (cancelled) suppressClickRef.current = false
    pressRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  return (
    <button
      type="button"
      className="skill-book-entry-action"
      data-game-default-focus={index === 0 || undefined}
      style={{ left: index === 0 ? 56.5 : 236.5 + 160 * (index - 1) }}
      aria-label={`${row.name}, rank ${row.effectiveRank}${draggable ? ', assign to selected belt slot' : ''}`}
      aria-disabled={!draggable && !selectable}
      aria-pressed={selected}
      data-category={row.category}
      data-dependency-ids={row.dependencyIds.join(',')}
      data-skill-id={row.id}
      draggable={false}
      onBlur={() => onHover(null)}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          event.preventDefault()
          return
        }
        if (row.category === 1) onSelectPrimary()
        if (row.category === 3 && !selected && !concentrationLocked) onSelectConcentration()
      }}
      onFocus={() => onHover(row.id)}
      onPointerEnter={() => onHover(row.id)}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') onHover(null)
      }}
      onPointerCancel={(event) => finishPointer(event, true)}
      onPointerDown={(event) => {
        if (!draggable || event.button !== 0) return
        const origin = nativePointForClient(event.clientX, event.clientY)
        if (!origin) return
        pressRef.current = {
          dragging: false,
          origin,
          pointerId: event.pointerId,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const press = pressRef.current
        if (!press || press.pointerId !== event.pointerId) return
        const position = nativePointForClient(event.clientX, event.clientY)
        if (!position) return
        if (!press.dragging) {
          if (!nativeSkillDragStarted(press.origin, position)) return
          press.dragging = true
          suppressClickRef.current = true
        }
        onDragMove(row.id, position)
      }}
      onPointerUp={(event) => finishPointer(event, false)}
    />
  )
}

function SkillQuickbarEditor({
  beltEntries,
  beltRects,
  draggedSkillId,
  economy,
  nativePointForClient,
  onPullOff,
  onTarget,
  targetSlot,
}: {
  beltEntries: PlayerBeltComponent
  beltRects: readonly NativeHudRect[]
  draggedSkillId: number | null
  economy: ProtocolPlayerEconomy
  nativePointForClient: (clientX: number, clientY: number) => NativeHudPoint | null
  onPullOff: (slot: number) => void
  onTarget: (slot: number) => void
  targetSlot: number | null
}) {
  return (
    <div className="skill-book-quickbar-actions" aria-label="Eight slot item belt">
      {beltEntries.map((entry, slot) => {
        const skill = entry?.kind === 'skill' ? NATIVE_SKILL_CATALOG[entry.skillId] : null
        const item = entry && entry.kind !== 'skill' ? nativeBeltEntryItem(entry, economy) : null
        const label = skill?.name
          ?? (entry?.kind === 'health-potion' ? 'Health Potion' : null)
          ?? (entry?.kind === 'mana-potion' ? 'Mana Potion' : null)
          ?? item?.name
          ?? 'Unavailable item'
        return (
          <SkillQuickbarSlot
            key={slot}
            ariaLabel={entry !== null
              ? `Belt ${slot + 1}, ${label}${slot === 0 ? ', right mouse button' : `, key ${slot}`}`
              : `Belt ${slot + 1}, empty${slot === 0 ? ', right mouse button' : `, key ${slot}`}`}
            belt={beltRects[slot]!}
            nativePointForClient={nativePointForClient}
            onPullOff={onPullOff}
            onTarget={onTarget}
            populated={entry !== null}
            showDropTarget={draggedSkillId !== null && slot === targetSlot}
            slot={slot}
            target={slot === targetSlot}
          />
        )
      })}
    </div>
  )
}

function SkillQuickbarSlot({
  ariaLabel,
  belt,
  nativePointForClient,
  onPullOff,
  onTarget,
  populated,
  showDropTarget,
  slot,
  target,
}: {
  ariaLabel: string
  belt: NativeHudRect
  nativePointForClient: (clientX: number, clientY: number) => NativeHudPoint | null
  onPullOff: (slot: number) => void
  onTarget: (slot: number) => void
  populated: boolean
  showDropTarget: boolean
  slot: number
  target: boolean
}) {
  const pressRef = useRef<{
    pointerId: number
    origin: NativeHudPoint
  } | null>(null)
  const suppressClickRef = useRef(false)
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pressRef.current?.pointerId !== event.pointerId) return
    pressRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  return (
    <button
      type="button"
      className="skill-book-quickbar-action"
      aria-label={ariaLabel}
      aria-pressed={target}
      data-target={target || undefined}
      style={{
        height: belt.height,
        left: belt.x,
        top: belt.y,
        width: belt.width,
      }}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          event.preventDefault()
          return
        }
        onTarget(slot)
      }}
      onPointerCancel={finish}
      onPointerDown={(event) => {
        if (!populated || event.button !== 0) return
        const origin = nativePointForClient(event.clientX, event.clientY)
        if (!origin) return
        pressRef.current = { origin, pointerId: event.pointerId }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const press = pressRef.current
        if (!press || press.pointerId !== event.pointerId) return
        const position = nativePointForClient(event.clientX, event.clientY)
        if (!position || !nativeBeltPullOffStarted(press.origin, position)) return
        suppressClickRef.current = true
        pressRef.current = null
        onPullOff(slot)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerUp={finish}
    >
      {showDropTarget ? <span className="skill-book-drop-target">Drop skill</span> : null}
    </button>
  )
}
