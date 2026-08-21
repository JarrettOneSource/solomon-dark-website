import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
} from 'react'

import { NATIVE_SKILL_CATALOG } from './core-kernels/player-progression.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from './protocol/game-state.ts'
import {
  createSkillBookRenderer,
  type SkillBookRenderer,
  type SkillBookRendererPresentation,
} from './renderer/skill-book-renderer.ts'
import {
  nativeSkillBookPagePlacements,
  nativeSkillBookPages,
  type NativeSkillBookRow,
} from './skill-book-model.ts'
import './skill-book.css'

interface SkillBookProps {
  economy: ProtocolPlayerEconomy
  onAssignBeltSkill: (slot: number, skillId: number) => void
  onClose: () => void
  onOpenInventory: () => void
  onSelectConcentration: (skillId: number) => void
  onSelectPrimarySkill: (skillId: number) => void
  progression: ProtocolPlayerProgression
  style: CSSProperties
  topMost: boolean
}

const ELEMENTAL_PRIMARY_SKILL_IDS = new Set([8, 16, 24, 32, 40])

export default function SkillBook({
  economy,
  onAssignBeltSkill,
  onClose,
  onOpenInventory,
  onSelectConcentration,
  onSelectPrimarySkill,
  progression,
  style,
  topMost,
}: SkillBookProps) {
  const pages = useMemo(() => nativeSkillBookPages(progression), [progression])
  const placements = useMemo(() => nativeSkillBookPagePlacements(pages), [pages])
  const [targetBeltSlot, setTargetBeltSlot] = useState(0)
  const [hoveredSkillId, setHoveredSkillId] = useState<number | null>(null)
  const [openProgress, setOpenProgress] = useState(0)
  const [phase, setPhase] = useState<'opening' | 'settled' | 'closing'>('opening')
  const [rendererState, setRendererState] = useState<'loading' | 'ready' | 'error'>('loading')
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SkillBookRenderer | null>(null)
  const transitionStartedAtRef = useRef(performance.now())
  const transitionStartProgressRef = useRef(0)
  const closeCompletedRef = useRef(false)
  const closeTargetRef = useRef<'closed' | 'inventory'>('closed')
  const presentationRef = useRef<SkillBookRendererPresentation>({
    hoveredSkillId,
    economy,
    openProgress,
    placements,
    progression,
    targetBeltSlot,
  })
  presentationRef.current = {
    hoveredSkillId,
    economy,
    openProgress,
    placements,
    progression,
    targetBeltSlot,
  }

  useEffect(() => subscribeGamePresentationFrames((nowMs) => {
    if (phase === 'settled') return
    const ticks = Math.floor((nowMs - transitionStartedAtRef.current) / 10)
    const progress = phase === 'opening'
      ? Math.min(1, transitionStartProgressRef.current + ticks * 0.025)
      : Math.max(0, transitionStartProgressRef.current - ticks * 0.025)
    setOpenProgress(progress)
    if (phase === 'opening' && progress === 1) setPhase('settled')
    if (phase === 'closing' && progress === 0 && !closeCompletedRef.current) {
      closeCompletedRef.current = true
      onClose()
      if (closeTargetRef.current === 'inventory') onOpenInventory()
    }
  }), [onClose, onOpenInventory, phase])

  useEffect(() => {
    if (topMost) rootRef.current?.focus()
  }, [topMost])

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
  }, [economy, hoveredSkillId, openProgress, placements, progression, targetBeltSlot])

  const assign = (slot: number, skillId: number) => {
    onAssignBeltSkill(slot, skillId)
    setTargetBeltSlot(slot)
  }

  const beginClose = (target: 'closed' | 'inventory' = 'closed') => {
    if (phase === 'closing') return
    closeTargetRef.current = target
    transitionStartProgressRef.current = openProgress
    transitionStartedAtRef.current = performance.now()
    setPhase('closing')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || event.key.toLowerCase() === 't') {
      event.preventDefault()
      event.stopPropagation()
      beginClose()
      return
    }
    if (event.key.toLowerCase() === 'i') {
      event.preventDefault()
      event.stopPropagation()
      beginClose('inventory')
      return
    }
    const slot = event.key >= '1' && event.key <= '7' ? Number(event.key) : null
    if (slot !== null) {
      event.preventDefault()
      setTargetBeltSlot(slot)
    }
  }

  return (
    <div
      ref={rootRef}
      className="main-menu-native-stage skill-book-stage"
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label="Skills"
      tabIndex={-1}
      data-transition-phase={phase}
      data-renderer-state={rendererState}
      onKeyDown={handleKeyDown}
    >
      <div ref={hostRef} className="skill-book-renderer" aria-hidden />
      <h2 className="skill-book-semantic-title">SKILLS</h2>
      <button
        type="button"
        className="skill-book-close-action"
        aria-label="Close skills"
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
                selected={row.id === progression.primarySkillId
                  || progression.concentrationSkillIds.includes(row.id)}
                onAssign={() => assign(targetBeltSlot, row.id)}
                onHover={setHoveredSkillId}
                onSelectConcentration={() => onSelectConcentration(row.id)}
                onSelectPrimary={() => onSelectPrimarySkill(row.id)}
              />
            ))}
          </section>
        ))}
      </div>
      <span className="skill-book-semantic-help">
        hover over a skill icon for more information about a skill.
        touch and hold a skill icon for more information about a skill.
        skills with a gold or green border can be dragged into your belt
      </span>
      <SkillBeltEditor
        progression={progression}
        targetSlot={targetBeltSlot}
        onTarget={setTargetBeltSlot}
        onAssign={assign}
      />
      {rendererState === 'error' ? (
        <p className="skill-book-error" role="alert">Skills renderer unavailable.</p>
      ) : null}
    </div>
  )
}

function SkillBookEntry({
  index,
  onAssign,
  onHover,
  onSelectConcentration,
  onSelectPrimary,
  row,
  selected,
}: {
  index: number
  onAssign: () => void
  onHover: (skillId: number | null) => void
  onSelectConcentration: () => void
  onSelectPrimary: () => void
  row: NativeSkillBookRow
  selected: boolean
}) {
  const isPrimary = ELEMENTAL_PRIMARY_SKILL_IDS.has(row.id)
  const action = row.category === 2
    ? onAssign
    : isPrimary
      ? onSelectPrimary
      : row.category === 3 && !selected
        ? onSelectConcentration
        : undefined
  const dragStart = (event: DragEvent<HTMLButtonElement>) => {
    if (row.category !== 2) {
      event.preventDefault()
      return
    }
    event.dataTransfer.setData('application/x-solomon-skill-id', `${row.id}`)
    event.dataTransfer.effectAllowed = 'copy'
  }
  return (
    <button
      type="button"
      className="skill-book-entry-action"
      style={{ left: index === 0 ? 56.5 : 236.5 + 160 * (index - 1) }}
      aria-label={`${row.name}, rank ${row.effectiveRank}`}
      aria-disabled={action === undefined}
      aria-pressed={selected}
      data-category={row.category}
      data-dependency-ids={row.dependencyIds.join(',')}
      data-skill-id={row.id}
      draggable={row.category === 2}
      onClick={action}
      onDragStart={dragStart}
      onFocus={() => onHover(row.id)}
      onBlur={() => onHover(null)}
      onPointerEnter={() => onHover(row.id)}
      onPointerLeave={() => onHover(null)}
    />
  )
}

function SkillBeltEditor({
  onAssign,
  onTarget,
  progression,
  targetSlot,
}: {
  onAssign: (slot: number, skillId: number) => void
  onTarget: (slot: number) => void
  progression: ProtocolPlayerProgression
  targetSlot: number
}) {
  return (
    <div className="skill-book-belt-actions" aria-label="Eight slot skill belt">
      {progression.secondaryBelt.map((skillId, slot) => {
        const skill = skillId === null ? null : NATIVE_SKILL_CATALOG[skillId]
        return (
          <button
            key={slot}
            type="button"
            className="skill-book-belt-action"
            aria-label={skill
              ? `Belt ${slot + 1}, ${skill.name}${slot === 0 ? ', right mouse button' : `, key ${slot}`}`
              : `Belt ${slot + 1}, empty${slot === 0 ? ', right mouse button' : `, key ${slot}`}`}
            aria-pressed={slot === targetSlot}
            data-target={slot === targetSlot || undefined}
            onClick={() => onTarget(slot)}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('application/x-solomon-skill-id')) {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              const droppedSkillId = Number(event.dataTransfer.getData('application/x-solomon-skill-id'))
              if (Number.isSafeInteger(droppedSkillId)) onAssign(slot, droppedSkillId)
            }}
          />
        )
      })}
    </div>
  )
}
