import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import type { GameAudioDirector } from './game-audio-director.ts'
import {
  NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE,
  nativeHudSkillSelectorLayout,
  nativeHudSkillSelectorOptions,
  nativeHudSkillSelectorTitle,
  type NativeHudSkillSelectorTarget,
} from './hud-skill-selector.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import {
  createHudSkillSelectorRenderer,
  type HudSkillSelectorRenderer,
  type HudSkillSelectorRendererPresentation,
} from './renderer/hud-skill-selector-renderer.ts'
import { measureNativeBitmapText } from './renderer/skill-picker-renderer.ts'
import './hud-skill-selector.css'

interface HudSkillSelectorProps {
  audio: GameAudioDirector
  onClose: () => void
  onSelectConcentrationSlot: (skillId: number, slot: 0 | 1) => void
  onSelectPrimarySkill: (skillId: number) => void
  progression: ProtocolPlayerProgression
  style: CSSProperties
  target: NativeHudSkillSelectorTarget
}

export default function HudSkillSelector({
  audio,
  onClose,
  onSelectConcentrationSlot,
  onSelectPrimarySkill,
  progression,
  style,
  target,
}: HudSkillSelectorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<HudSkillSelectorRenderer | null>(null)
  const selectionCompletedRef = useRef(false)
  const [rendererState, setRendererState] = useState<'loading' | 'ready' | 'error'>('loading')
  const options = useMemo(
    () => nativeHudSkillSelectorOptions(progression, target),
    [progression, target],
  )
  const title = nativeHudSkillSelectorTitle(target)
  const layout = nativeHudSkillSelectorLayout(
    options.length,
    measureNativeBitmapText(title, 'medium'),
  )
  const presentationRef = useRef<HudSkillSelectorRendererPresentation>({ options, title })
  presentationRef.current = { options, title }

  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  useEffect(() => {
    let disposed = false
    void createHudSkillSelectorRenderer().then((renderer) => {
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
  }, [options, rendererState, title])

  const closeFromBackdrop = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) onClose()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }
  const select = (skillId: number) => {
    if (selectionCompletedRef.current) return
    selectionCompletedRef.current = true
    if (target.kind === 'primary') {
      onSelectPrimarySkill(skillId)
      audio.playSound('click')
    } else if (progression.mindChugTicksRemaining === 0) {
      onSelectConcentrationSlot(skillId, target.slot)
      audio.playSound('click')
      audio.playSound('concentrate')
    }
    onClose()
  }

  return (
    <div
      ref={rootRef}
      aria-label={title}
      aria-modal="true"
      className="main-menu-native-stage hud-skill-selector-stage"
      data-binding={target.binding}
      data-option-count={options.length}
      data-renderer-state={rendererState}
      data-selector-kind={target.kind}
      onKeyDown={handleKeyDown}
      onPointerDown={closeFromBackdrop}
      role="dialog"
      style={style}
      tabIndex={-1}
    >
      <div ref={hostRef} className="hud-skill-selector-renderer" aria-hidden />
      <h2 className="hud-skill-selector-semantic-title">{title}</h2>
      <div className="hud-skill-selector-actions">
        {options.map(({ name, skillId }, index) => {
          const selected = target.kind === 'primary'
            ? progression.selectedPrimarySkillId === skillId
            : progression.concentrationSkillIds[target.slot] === skillId
          return (
            <button
              type="button"
              aria-label={`${name}${selected ? ', selected' : ''}${
                target.kind === 'concentration' && progression.mindChugTicksRemaining > 0
                  ? ', unavailable while Mind Chug is active'
                  : ''
              }`}
              aria-pressed={selected}
              className="hud-skill-selector-action"
              data-skill-id={skillId}
              disabled={rendererState !== 'ready'}
              key={skillId}
              onClick={() => select(skillId)}
              style={{
                height: NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE,
                left: layout.optionLeft + index * NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE,
                top: layout.optionTop,
                width: NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE,
              }}
            />
          )
        })}
      </div>
      {rendererState === 'error' ? (
        <p className="hud-skill-selector-error" role="alert">Skill selector unavailable.</p>
      ) : null}
    </div>
  )
}
