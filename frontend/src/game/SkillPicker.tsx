import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'

import type { GameAudioDirector } from './game-audio-director.ts'
import {
  NATIVE_SKILL_CATALOG,
  SPELL_WELDING_QUICK_DESCRIPTION,
  SPELL_WELDING_SKILL_ID,
  nativeWeldBuild,
} from './core-kernels/player-progression.ts'
import type { ProtocolPlayerSkillOffer } from './protocol/game-state.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import {
  createSkillPickerRenderer,
  type SkillPickerRenderer,
} from './renderer/skill-picker-renderer.ts'
import { nativeSkillPickerReveal } from './renderer/level-up-presentation.ts'
import { skillPickerCardCenters } from './renderer/skill-picker-render-contract.ts'
import './skill-picker.css'

interface SkillPickerProps {
  audio: GameAudioDirector
  offer: ProtocolPlayerSkillOffer
  onSelect: (choiceIndex: number, offerSequence: number, skillId: number) => void
  presentationId: number
  style: CSSProperties
}

export default function SkillPicker({
  audio,
  offer,
  onSelect,
  presentationId,
  style,
}: SkillPickerProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const offerRef = useRef(offer)
  const revealReadyRef = useRef(false)
  const revealStartedAtRef = useRef<number | null>(null)
  const rendererRef = useRef<SkillPickerRenderer | null>(null)
  const selectedIndexRef = useRef(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [rendererState, setRendererState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [revealReady, setRevealReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    revealStartedAtRef.current = null
    revealReadyRef.current = false
    setRevealReady(false)
  }, [presentationId])

  useEffect(() => {
    selectedIndexRef.current = 0
    setSelectedIndex(0)
    setSubmitting(false)
  }, [offer.sequence])

  useEffect(() => {
    if (revealReady) buttonRefs.current[0]?.focus()
  }, [offer.sequence, revealReady])

  useEffect(() => {
    offerRef.current = offer
    rendererRef.current?.setOffer(offer)
  }, [offer])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let renderer: SkillPickerRenderer | undefined
    setRendererState('loading')
    void createSkillPickerRenderer().then((created) => {
      if (disposed) {
        created.destroy()
        return
      }
      renderer = created
      rendererRef.current = created
      created.setOffer(offerRef.current)
      host.replaceChildren(created.canvas)
      setRendererState('ready')
    }).catch(() => {
      if (!disposed) setRendererState('error')
    })
    const unsubscribe = subscribeGamePresentationFrames((nowMs) => {
      revealStartedAtRef.current ??= nowMs
      const reveal = nativeSkillPickerReveal(nowMs - revealStartedAtRef.current)
      renderer?.render(nowMs, selectedIndexRef.current, reveal)
      const stage = stageRef.current
      if (stage) {
        stage.dataset.revealElapsedMs = `${nowMs - revealStartedAtRef.current}`
        stage.dataset.revealAlpha = `${reveal.revealAlpha}`
        stage.dataset.revealInteractive = `${reveal.interactive}`
      }
      if (reveal.interactive !== revealReadyRef.current) {
        revealReadyRef.current = reveal.interactive
        setRevealReady(reveal.interactive)
      }
    })
    return () => {
      disposed = true
      unsubscribe()
      rendererRef.current = null
      renderer?.destroy()
      host.replaceChildren()
    }
  }, [])

  const moveSelection = (delta: number) => {
    if (submitting || !revealReadyRef.current) return
    const next = (selectedIndexRef.current + delta + offer.options.length) % offer.options.length
    selectedIndexRef.current = next
    setSelectedIndex(next)
    buttonRefs.current[next]?.focus()
    audio.playSound('pick-skill')
  }

  const choose = (index: number) => {
    if (submitting || !revealReadyRef.current) return
    const option = offer.options[index]
    if (!option) return
    selectedIndexRef.current = index
    setSelectedIndex(index)
    setSubmitting(true)
    audio.playSound('click')
    onSelect(index, offer.sequence, option.skillId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(selectedIndexRef.current)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const centers = skillPickerCardCenters(offer.options.length)
  return (
    <div
      ref={stageRef}
      className="main-menu-native-stage skill-picker-stage"
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${offer.level}. Select a skill.`}
      data-offer-sequence={offer.sequence}
      data-presentation-id={presentationId}
      data-renderer-state={rendererState}
      data-reveal-interactive={revealReady}
      onKeyDown={handleKeyDown}
    >
      <div ref={hostRef} className="skill-picker-renderer" aria-hidden />
      <div className="skill-picker-actions">
        {offer.options.map((option, index) => {
          const skill = NATIVE_SKILL_CATALOG[option.skillId]!
          const weldBuild = option.skillId === SPELL_WELDING_SKILL_ID
            ? nativeWeldBuild(option.weldBuildId ?? Number.NaN)
            : null
          const description = weldBuild
            ? `${SPELL_WELDING_QUICK_DESCRIPTION}. ${weldBuild.primarySkillIds
                .map((skillId) => NATIVE_SKILL_CATALOG[skillId]!.name)
                .join(' and ')}.`
            : skill.config?.mQDescription ?? skill.config?.mDescription ?? ''
          return (
            <button
              key={`${index}-${option.skillId}-${option.weldBuildId ?? 0}`}
              ref={(button) => { buttonRefs.current[index] = button }}
              type="button"
              className="skill-picker-action"
              style={{ left: centers[index] }}
              aria-label={`${skill.name}${option.targetRank > 1 ? ` ${option.targetRank}` : ''}, ${skill.family}. ${description}`}
              aria-pressed={selectedIndex === index}
              data-choice-index={index}
              data-skill-id={option.skillId}
              disabled={submitting || !revealReady}
              onClick={() => choose(index)}
              onFocus={() => {
                if (!revealReadyRef.current) return
                if (selectedIndexRef.current === index) return
                selectedIndexRef.current = index
                setSelectedIndex(index)
                audio.playSound('pick-skill')
              }}
              onPointerEnter={() => {
                if (!revealReadyRef.current) return
                if (selectedIndexRef.current === index) return
                selectedIndexRef.current = index
                setSelectedIndex(index)
                audio.playSound('pick-skill')
              }}
            />
          )
        })}
      </div>
      {rendererState === 'error' ? (
        <p className="skill-picker-error" role="alert">Skill picker renderer unavailable.</p>
      ) : null}
    </div>
  )
}
